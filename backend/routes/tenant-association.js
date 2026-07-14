const express = require('express');
const router = express.Router();
const db = require('../config/database');
const jwt = require('jsonwebtoken');
const appConfig = require('../config/app.config');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: '未授权' });
  }

  jwt.verify(token, appConfig.jwt.secret, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token无效' });
    }
    req.user = user;
    next();
  });
}

function generateTenantCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

router.post('/create', authenticateToken, async (req, res) => {
  const { tenant_name, contact_person, contact_phone, remark } = req.body;
  const user_id = req.user.userId;

  if (!tenant_name) {
    return res.status(400).json({ success: false, message: '请输入企业名称' });
  }

  try {
    let tenantCode;
    let isUnique = false;
    let maxAttempts = 10;
    while (!isUnique && maxAttempts > 0) {
      tenantCode = generateTenantCode();
      const [existing] = await db.execute('SELECT id FROM tenants WHERE tenant_code = ?', [tenantCode]);
      if (existing.length === 0) {
        isUnique = true;
      }
      maxAttempts--;
    }
    if (!isUnique) {
      return res.status(500).json({ success: false, message: '无法生成企业编码，请稍后重试' });
    }

    const [result] = await db.execute(
      'INSERT INTO tenants (tenant_code, tenant_name, contact_person, contact_phone, remark, status) VALUES (?, ?, ?, ?, ?, ?)',
      [tenantCode, tenant_name, contact_person || '', contact_phone || '', remark || '', 'active'],
    );

    const tenant_id = result.insertId;

    await db.execute(
      'INSERT INTO user_tenant_roles (user_id, tenant_id, role, status, is_default) VALUES (?, ?, ?, ?, ?)',
      [user_id, tenant_id, 'system_admin', 'active', 1],
    );

    const invitation_code = `${tenant_id}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await db.execute(
      'UPDATE tenants SET invitation_code = ? WHERE id = ?',
      [invitation_code, tenant_id],
    );

    res.json({
      success: true,
      data: {
        tenant_id,
        tenant_name,
        tenant_code: tenantCode,
        invitation_code,
        role: 'system_admin',
      },
    });
  } catch (error) {
    console.log('创建企业失败:', error.message);
    res.status(500).json({ success: false, message: '创建失败' });
  }
});

router.post('/join', authenticateToken, async (req, res) => {
  const { tenant_code } = req.body;
  const user_id = req.user.userId;

  if (!tenant_code || tenant_code.length !== 4 || !/^\d{4}$/.test(tenant_code)) {
    return res.status(400).json({ success: false, message: '请输入4位数字的企业编码' });
  }

  try {
    const [tenants] = await db.execute(
      'SELECT id, tenant_name, status FROM tenants WHERE tenant_code = ?',
      [tenant_code],
    );

    if (tenants.length === 0) {
      return res.status(404).json({ success: false, message: '企业编码无效' });
    }

    const tenant = tenants[0];

    if (tenant.status !== 'active') {
      return res.status(400).json({ success: false, message: '企业已被停用' });
    }

    const [existing] = await db.execute(
      'SELECT id FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
      [user_id, tenant.id],
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: '您已经是该企业成员' });
    }

    await db.execute(
      'INSERT INTO user_tenant_roles (user_id, tenant_id, role, status, is_default) VALUES (?, ?, ?, ?, ?)',
      [user_id, tenant.id, 'asset_admin', 'active', 1],
    );

    // 通知系统管理员有新用户加入企业
    try {
      const [adminResult] = await db.execute(
        `SELECT u.id FROM users u
         INNER JOIN user_tenant_roles utr ON u.id = utr.user_id AND utr.tenant_id = ? AND utr.role = 'system_admin' AND utr.status = 'active'
         WHERE u.status = 'active'`,
        [tenant.id],
      );
      if (adminResult && adminResult.length > 0) {
        const { getEventBus } = require('../core/EventBus');
        getEventBus().emit('notification:role_request', {
          tenant_id: tenant.id,
          user_id,
          requested_role: 'asset_admin',
          admins: adminResult.map(a => a.id),
          message: '新用户加入企业，默认角色为资产管理员，请确认或调整角色设置',
        });
      }
    } catch (e) {
      console.error('通知管理员失败:', e);
    }

    res.json({
      success: true,
      data: {
        tenant_id: tenant.id,
        tenant_name: tenant.tenant_name,
        role: 'asset_admin',
      },
    });
  } catch (error) {
    console.log('加入企业失败:', error.message);
    res.status(500).json({ success: false, message: '加入失败' });
  }
});

router.get('/my-tenant', authenticateToken, async (req, res) => {
  const user_id = req.user.userId;

  try {
    const [tenantRoles] = await db.execute(
      `SELECT ur.tenant_id, ur.role, t.tenant_name, t.invitation_code 
       FROM user_tenant_roles ur 
       LEFT JOIN tenants t ON t.id = ur.tenant_id 
       WHERE ur.user_id = ? AND ur.status = ?`,
      [user_id, 'active'],
    );

    res.json({
      success: true,
      data: tenantRoles,
    });
  } catch (error) {
    console.log('获取企业失败:', error.message);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

module.exports = router;
