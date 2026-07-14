const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const appConfig = require('../config/app.config');
const { sendVerificationCode } = require('../services/sms-code-service');
const { generateToken } = require('../middleware/auth');

const CODE_EXPIRES_MS = 5 * 60 * 1000;
const PHONE_PATTERN = /^1[3-9]\d{9}$/;

// 时序安全的验证码比较
function timingSafeCompareCode(storedCode, inputCode) {
  if (typeof storedCode !== 'string' || typeof inputCode !== 'string') {
    return false;
  }
  if (storedCode.length !== inputCode.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(storedCode), Buffer.from(inputCode));
  } catch {
    return false;
  }
}

const normalizePhone = phone => (typeof phone === 'string' ? phone.trim() : '');

const parseTenantId = value => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

async function getTenantIdForVerification(req, phone) {
  const requestedTenantId = parseTenantId(req.headers['x-tenant-id']);
  if (requestedTenantId !== null) {
    return requestedTenantId;
  }

  const tenantCode = typeof req.body?.tenant_code === 'string' ? req.body.tenant_code.trim() : '';
  if (/^\d{4}$/.test(tenantCode)) {
    const [tenants] = await db.execute(
      'SELECT id FROM tenants WHERE tenant_code = ? AND status = ? LIMIT 1',
      [tenantCode, 'active'],
    );
    if (tenants.length > 0) {
      return tenants[0].id;
    }
  }

  const [tenantRoles] = await db.execute(
    `SELECT ur.tenant_id
       FROM user_tenant_roles AS ur
       INNER JOIN users AS u ON u.id = ur.user_id
      WHERE u.phone = ? AND ur.status = 'active'
      ORDER BY ur.is_default DESC, ur.id ASC
      LIMIT 1`,
    [phone],
  );

  return tenantRoles[0]?.tenant_id || null;
}

async function consumeVerificationCode({ phone, tenantId, code }) {
  if (!tenantId) {
    return { valid: false, status: 400, message: '请先选择企业后再获取验证码' };
  }

  const [verificationRecords] = await db.execute(
    `SELECT id, code, expires_at
       FROM sms_verification_codes
      WHERE phone = ? AND tenant_id = ?
      ORDER BY created_at DESC
      LIMIT 1`,
    [phone, tenantId],
  );

  if (verificationRecords.length === 0) {
    return { valid: false, status: 400, message: '验证码已过期，请重新获取' };
  }

  const record = verificationRecords[0];
  const expiresAt = new Date(record.expires_at);
  if (Date.now() > expiresAt.getTime()) {
    await db.execute('DELETE FROM sms_verification_codes WHERE id = ?', [record.id]);
    return { valid: false, status: 400, message: '验证码已过期，请重新获取' };
  }

  if (!timingSafeCompareCode(record.code, code)) {
    return { valid: false, status: 400, message: '验证码错误' };
  }

  await db.execute('DELETE FROM sms_verification_codes WHERE id = ?', [record.id]);
  return { valid: true };
}

async function consumeVerificationCodeWithoutTenant(phone, code) {
  if (!PHONE_PATTERN.test(phone)) {
    return { valid: false, status: 400, message: '手机号格式不正确' };
  }

  if (!/^\d{6}$/.test(code)) {
    return { valid: false, status: 400, message: '请输入6位验证码' };
  }

  // Find any valid verification code for this phone with null tenant_id (for new user registration)
  const [verificationRecords] = await db.execute(
    `SELECT id, code, expires_at, tenant_id
       FROM sms_verification_codes
      WHERE phone = ? AND tenant_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [phone],
  );

  if (verificationRecords.length === 0) {
    return { valid: false, status: 400, message: '验证码已过期，请重新获取' };
  }

  const record = verificationRecords[0];
  const expiresAt = new Date(record.expires_at);
  if (Date.now() > expiresAt.getTime()) {
    await db.execute('DELETE FROM sms_verification_codes WHERE id = ?', [record.id]);
    return { valid: false, status: 400, message: '验证码已过期，请重新获取' };
  }

  if (!timingSafeCompareCode(record.code, code)) {
    return { valid: false, status: 400, message: '验证码错误' };
  }

  await db.execute('DELETE FROM sms_verification_codes WHERE id = ?', [record.id]);
  return { valid: true };
}

async function buildLoginPayload(userId, isNewUser = false) {
  const [users] = await db.execute(
    'SELECT id, username, real_name, department_code, phone, status FROM users WHERE id = ? LIMIT 1',
    [userId],
  );

  if (users.length === 0) {
    throw new Error('用户不存在');
  }

  const user = users[0];
  if (user.status !== 'active') {
    return { status: 403, body: { success: false, message: '用户已被禁用，请联系管理员' } };
  }

  const [tenantRoles] = await db.execute(
    `SELECT t.id, t.tenant_code, t.tenant_name, t.status, t.created_at, ur.role, ur.is_default
       FROM user_tenant_roles ur
       INNER JOIN tenants t ON t.id = ur.tenant_id
      WHERE ur.user_id = ? AND ur.status = 'active' AND t.status = 'active'
      ORDER BY ur.is_default DESC, ur.id ASC`,
    [user.id],
  );

  if (tenantRoles.length === 0) {
    // Generate token for user without tenant association
    const userForToken = {
      id: user.id,
      username: user.username,
      real_name: user.real_name,
      department_code: user.department_code,
      role: 'user',
      tenant_id: null,
    };
    const token = generateToken(userForToken);

    return {
      status: 200,
      body: {
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            real_name: user.real_name,
            phone: user.phone,
            tenant_id: null,
            tenant_name: null,
            role: 'user',
          },
          enterprises: [],
        },
        needsTenantAssociation: true,
        isNewUser,
      },
    };
  }

  const defaultTenant = tenantRoles[0];
  const userForToken = {
    id: user.id,
    username: user.username,
    real_name: user.real_name,
    department_code: user.department_code,
    role: defaultTenant.role || 'user',
    tenant_id: defaultTenant.id,
  };

  const token = generateToken(userForToken);

  return {
    status: 200,
    body: {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          real_name: user.real_name,
          phone: user.phone,
          tenant_id: defaultTenant.id,
          tenant_name: defaultTenant.tenant_name,
          role: defaultTenant.role || 'user',
        },
        enterprises: tenantRoles.map(tenant => ({
          id: tenant.id,
          tenant_code: tenant.tenant_code,
          tenant_name: tenant.tenant_name,
          role: tenant.role || 'user',
        })),
      },
      needsTenantAssociation: false,
    },
  };
}

router.post('/send-code', async (req, res) => {
  const phone = normalizePhone(req.body?.phone);

  if (!phone) {
    return res.status(400).json({ success: false, message: '手机号不能为空' });
  }

  if (!PHONE_PATTERN.test(phone)) {
    return res.status(400).json({ success: false, message: '手机号格式不正确' });
  }

  try {
    let tenantId = await getTenantIdForVerification(req, phone);

    // For new users (no existing user record for this phone), allow sending code without tenant
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE phone = ? LIMIT 1',
      [phone],
    );

    const isNewUser = existingUsers.length === 0;

    if (!tenantId && isNewUser) {
      // New user, allow sending verification code without tenant
      // Use tenant_id = NULL, which will be consumed during login-with-code
      tenantId = null;
    } else if (!tenantId && !isNewUser) {
      // Existing user without tenant association
      return res.status(400).json({
        success: false,
        message: '请先输入有效企业编码，或登录后选择企业再获取验证码',
      });
    }

    const result = await sendVerificationCode(phone);
    const expiresAt = new Date(Date.now() + CODE_EXPIRES_MS);

    // 先删除旧验证码（包括过期的），避免重复记录
    if (tenantId) {
      await db.execute(
        'DELETE FROM sms_verification_codes WHERE phone = ? AND tenant_id = ?',
        [phone, tenantId],
      );
    } else {
      await db.execute(
        'DELETE FROM sms_verification_codes WHERE phone = ? AND tenant_id IS NULL',
        [phone],
      );
    }

    // 插入新验证码
    await db.execute(
      `INSERT INTO sms_verification_codes (phone, code, tenant_id, expires_at)
       VALUES (?, ?, ?, ?)`,
      [phone, result.codeValue, tenantId, expiresAt],
    );

    return res.json({
      success: true,
      message: '验证码已发送',
      expiresIn: CODE_EXPIRES_MS / 1000,
    });
  } catch (error) {
    console.error('发送验证码失败:', error.message);
    return res.status(500).json({ success: false, message: error.message || '发送失败' });
  }
});

router.post('/verify-code', async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

  if (!phone || !PHONE_PATTERN.test(phone)) {
    return res.status(400).json({ success: false, message: '手机号格式不正确' });
  }

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ success: false, message: '请输入6位验证码' });
  }

  try {
    const tenantId = await getTenantIdForVerification(req, phone);
    const result = await consumeVerificationCode({ phone, tenantId, code });
    if (!result.valid) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    return res.json({ success: true, message: '验证码校验成功' });
  } catch (error) {
    console.error('校验验证码失败:', error.message);
    return res.status(500).json({ success: false, message: '验证码校验失败' });
  }
});

router.post('/login-with-code', async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

  if (!phone) {
    return res.status(400).json({ success: false, message: '手机号不能为空' });
  }

  if (!PHONE_PATTERN.test(phone)) {
    return res.status(400).json({ success: false, message: '手机号格式不正确' });
  }

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ success: false, message: '请输入6位验证码' });
  }

  try {
    const tenantId = await getTenantIdForVerification(req, phone);

    // Try to verify the code with tenantId if available, or without tenantId for new users
    let verificationResult;
    if (tenantId) {
      verificationResult = await consumeVerificationCode({ phone, tenantId, code });
    } else {
      // For new users without tenant, try to find any valid verification code for this phone
      verificationResult = await consumeVerificationCodeWithoutTenant(phone, code);
    }

    if (!verificationResult.valid) {
      return res.status(verificationResult.status).json({ success: false, message: verificationResult.message });
    }

    const [users] = await db.execute(
      'SELECT id, username, real_name, status FROM users WHERE phone = ? ORDER BY id ASC LIMIT 1',
      [phone],
    );

    let userId = users[0]?.id;
    let isNewUser = false;

    if (!userId) {
      // Auto-register new user with null tenant_id
      isNewUser = true;
      const tempPassword = `${Math.random().toString(36).slice(-8)}A1!`;
      const hashedPassword = await bcrypt.hash(tempPassword, 12);
      const [insertResult] = await db.execute(
        `INSERT INTO users (username, password, real_name, phone, status)
         VALUES (?, ?, ?, ?, ?)`,
        [phone, hashedPassword, phone, phone, 'active'],
      );
      userId = insertResult.insertId;
      // Note: No tenant association is created - tenant_id remains null
      // New user will be redirected to choose create/join enterprise
    }

    const payload = await buildLoginPayload(userId, isNewUser);
    return res.status(payload.status).json(payload.body);
  } catch (error) {
    console.error('验证码登录失败:', error.message);
    return res.status(500).json({ success: false, message: '登录失败', error: error.message });
  }
});

module.exports = router;
module.exports.__test__ = {
  normalizePhone,
  parseTenantId,
  getTenantIdForVerification,
  consumeVerificationCode,
  consumeVerificationCodeWithoutTenant,
  buildLoginPayload,
};
