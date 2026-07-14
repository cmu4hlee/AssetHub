const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../config/logger');
const {
  generateToken,
  authenticate,
  authorize,
  requireSystemAdmin,
} = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');
const appConfig = require('../config/app.config');
const { logAudit } = require('../middleware/auditLogger');
const { initializeRegistrationDemoData, enableAllModulesForTenant } = require('../services/registration-demo-data.service');

const loginTokenExpiry = Number.parseInt(String(appConfig?.jwt?.expiresIn || ''), 10) || 24 * 60 * 60;

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

// 密码复杂度验证函数（增强版）
function validatePassword(password, options = {}) {
  const errors = [];
  const warnings = [];
  
  const {
    minLength = 8,
    maxLength = 128,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = true,
    checkCommonPasswords = true,
    checkSequentialChars = true,
    checkRepeatedChars = true,
  } = options;

  // 基础长度检查
  if (!password || password.length < minLength) {
    errors.push(`密码长度至少为 ${minLength} 位`);
  }
  if (password && password.length > maxLength) {
    errors.push(`密码长度不能超过 ${maxLength} 位`);
  }

  // 字符类型检查
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('密码必须包含至少一个大写字母');
  }
  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('密码必须包含至少一个小写字母');
  }
  if (requireNumbers && !/[0-9]/.test(password)) {
    errors.push('密码必须包含至少一个数字');
  }
  if (requireSpecialChars && !/[!@#$%^&*()_+\-={}[\]:;'"|,.<>/?]/.test(password)) {
    errors.push('密码必须包含至少一个特殊字符');
  }

  // 高级安全检查
  if (checkCommonPasswords && password) {
    const commonPasswords = [
      'password', '123456', '12345678', 'qwerty', 'abc123',
      'letmein', 'welcome', 'admin123', 'login', 'master'
    ];
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      errors.push('密码包含常见弱密码模式，请使用更复杂的密码');
    }
  }

  // 检查连续字符
  if (checkSequentialChars && password) {
    const sequentialPatterns = [
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      '0123456789',
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm'
    ];
    
    for (const pattern of sequentialPatterns) {
      for (let i = 0; i < pattern.length - 2; i++) {
        const seq = pattern.substring(i, i + 3);
        if (password.includes(seq)) {
          warnings.push('密码包含连续字符序列，建议避免');
          break;
        }
      }
      if (warnings.length > 0) break;
    }
  }

  // 检查重复字符
  if (checkRepeatedChars && password) {
    const repeatedPattern = /(.)\1{2,}/;
    if (repeatedPattern.test(password)) {
      warnings.push('密码包含重复字符，建议避免');
    }
  }

  // 计算密码强度
  let strength = 0;
  if (password && password.length >= 12) strength += 2;
  else if (password && password.length >= 8) strength += 1;
  if (password && /[A-Z]/.test(password)) strength += 1;
  if (password && /[a-z]/.test(password)) strength += 1;
  if (password && /[0-9]/.test(password)) strength += 1;
  if (password && /[!@#$%^&*()_+\-={}[\]:;'"|,.<>/?]/.test(password)) strength += 1;
  if (password && password.length >= 16 && strength >= 5) strength += 1;

  const strengthLabels = ['极弱', '弱', '中等', '强', '极强'];
  const strengthIndex = Math.min(Math.floor(strength / 1.5), 4);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    strength: strengthLabels[strengthIndex],
    strengthScore: strength,
    suggestions: [
      '建议使用至少12位密码',
      '混合使用大小写字母、数字和特殊字符',
      '避免使用个人信息（生日、姓名等）',
      '定期更换密码（建议每90天）',
    ],
  };
}

// 数据库查询辅助函数（带重试机制）
async function executeQuery(query, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await db.execute(query, params);
      return result;
    } catch (error) {
      // 如果是连接丢失错误，尝试重试
      if (error.code === 'PROTOCOL_CONNECTION_LOST' && i < retries - 1) {
        console.log(`数据库连接丢失，正在重试 (${i + 1}/${retries})...`);
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      // 其他错误或已达到最大重试次数，抛出错误
      throw error;
    }
  }
}

const RESERVED_USERNAMES = new Set([
  'suadmin',
  'super_admin',
  'system_admin',
  'root',
  'admin',
]);

const normalizeUsername = username =>
  typeof username === 'string' ? username.trim() : username;

const isReservedUsername = username => {
  const normalized = normalizeUsername(username);
  return (
    typeof normalized === 'string' && RESERVED_USERNAMES.has(normalized.toLowerCase())
  );
};

async function isUsernameTaken(username) {
  const normalized = normalizeUsername(username);
  const [existingUsers] = await executeQuery(
    'SELECT id FROM users WHERE username = ? LIMIT 1',
    [normalized],
  );
  if (existingUsers.length > 0) {
    return true;
  }

  const [existingSuperUsers] = await executeQuery(
    'SELECT id FROM super_users WHERE username = ? LIMIT 1',
    [normalized],
  );
  return existingSuperUsers.length > 0;
}

async function consumeSmsVerificationCode(phone, code, tenantId, options = {}) {
  const { allowNullTenant = false } = options;

  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return { valid: false, status: 400, message: '手机号格式不正确' };
  }

  if (!code || !/^\d{6}$/.test(String(code))) {
    return { valid: false, status: 400, message: '请输入6位验证码' };
  }

  if (!tenantId && !allowNullTenant) {
    return { valid: false, status: 400, message: '请选择企业空间后重新获取验证码' };
  }

  const tenantClause = tenantId ? 'tenant_id = ?' : 'tenant_id IS NULL';
  const params = tenantId ? [phone, tenantId] : [phone];

  const [verificationRecords] = await executeQuery(
    `SELECT id, code, expires_at
       FROM sms_verification_codes
      WHERE phone = ? AND ${tenantClause}
      ORDER BY created_at DESC
      LIMIT 1`,
    params,
  );

  if (verificationRecords.length === 0) {
    return { valid: false, status: 400, message: '验证码已过期，请重新获取' };
  }

  const record = verificationRecords[0];
  if (Date.now() > new Date(record.expires_at).getTime()) {
    await executeQuery('DELETE FROM sms_verification_codes WHERE id = ?', [record.id]);
    return { valid: false, status: 400, message: '验证码已过期，请重新获取' };
  }

  if (!timingSafeCompareCode(record.code, String(code))) {
    return { valid: false, status: 400, message: '验证码错误' };
  }

  await executeQuery('DELETE FROM sms_verification_codes WHERE id = ?', [record.id]);
  return { valid: true };
}

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     tags:
 *       - 用户管理
 *     summary: 用户登录
 *     description: 用户登录接口，验证用户名和密码，返回 JWT token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *                 description: 用户名
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *                 description: 密码
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *                         token:
 *                           type: string
 *                           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 用户名或密码错误，或用户已被禁用
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// 用户登录
router.post('/login', async (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const { password, tenant_code } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空',
      });
    }

    // 优先检查是否是超级管理员
    const superResult = await executeQuery(
      'SELECT id, username, password, real_name, email, phone, status FROM super_users WHERE username = ?',
      [username],
    );
    const superUsers = Array.isArray(superResult) ? (superResult[0] || []) : [];

    if (superUsers.length > 0) {
      const superUser = superUsers[0];
      if (!superUser.password || typeof superUser.password !== 'string') {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误',
        });
      }
      let isPasswordValid = false;
      try {
        isPasswordValid = await bcrypt.compare(password, superUser.password);
      } catch (e) {
        console.error('超级管理员密码校验异常:', e.message);
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误',
        });
      }
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误',
        });
      }

      // 检查状态
      if (superUser.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误',
        });
      }

      // 更新登录信息
      await executeQuery(
        'UPDATE super_users SET last_login_at = CURRENT_TIMESTAMP, login_count = login_count + 1 WHERE id = ?',
        [superUser.id],
      );

      // 生成token
      const token = generateToken({
        id: superUser.id,
        username: superUser.username,
        real_name: superUser.real_name,
        department_code: null,
        role: 'super_admin',
        tenant_id: null,
      });

      // 记录登录日志
      req.user = {
        id: superUser.id,
        username: superUser.username,
        real_name: superUser.real_name,
        role: 'super_admin',
      };

      await logAudit(req, {
        action_type: 'login',
        module: 'users',
        resource_type: 'super_user',
        resource_id: superUser.id,
        resource_name: superUser.real_name || superUser.username,
        action_description: `超级管理员登录：${superUser.real_name || superUser.username}`,
        response_status: 200,
      });

      // 获取所有企业列表，超级管理员可以查看和选择所有企业
      const entResult = await executeQuery(
        'SELECT id, tenant_code, tenant_name, status, created_at FROM tenants WHERE status = ? ORDER BY created_at DESC',
        ['active'],
      );
      const enterprises = Array.isArray(entResult) ? (entResult[0] || []) : [];

      // 返回超级管理员信息，包含所有企业列表
      return res.json({
        success: true,
        message: '超级管理员登录成功',
        data: {
          user: {
            id: superUser.id,
            username: superUser.username,
            real_name: superUser.real_name,
            department_code: null,
            role: 'super_admin',
            status: superUser.status,
            tenant_id: null,
            tenant_name: '超级管理员',
            managedDepartments: [],
            is_super_admin: true,
          },
          token,
          defaultRoute: '/tenants',
          tokenExpiry: loginTokenExpiry,
          enterprises: (Array.isArray(enterprises) ? enterprises : []).map(enterprise => ({
            ...enterprise,
            role: 'super_admin', // 超级管理员在所有企业中都是超级管理员
          })),
        },
      });
    }

    // 先查找用户（获取role字段用于初始判断）
    const usersResult = await executeQuery(
      'SELECT id, username, password, real_name, status FROM users WHERE username = ?',
      [username],
    );
    const users = Array.isArray(usersResult) ? (usersResult[0] || []) : [];

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
      });
    }

    const user = users[0];
    if (!user.password || typeof user.password !== 'string') {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
      });
    }
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } catch (e) {
      console.error('用户密码校验异常:', e.message);
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
      });
    }
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
      });
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
      });
    }

    // 简化登录逻辑：不发送企业编码，由后端处理用户关联的企业
    let userTenantId = null;
    let userTenantName = null;

    // 查询用户关联的所有企业
    let enterprises = [];

    // 仅超级用户表(super_users)可成为超级管理员，这里统一按普通用户租户角色处理
    const isSuperAdmin = false;
    user.role = 'user';
    // 查询用户在所有租户中的角色信息
    const utrResult = await executeQuery(
      `SELECT t.id, t.tenant_code, t.tenant_name, t.status, t.created_at, ur.role, ur.is_default
       FROM tenants t
       INNER JOIN user_tenant_roles ur ON t.id = ur.tenant_id
       WHERE ur.user_id = ? AND ur.status = "active" AND t.status = "active"
       ORDER BY ur.is_default DESC, ur.id ASC`,
      [user.id],
    );
    const userTenantRoles = Array.isArray(utrResult) ? (utrResult[0] || []) : [];

    if (userTenantRoles.length === 0) {
      return res.status(403).json({
        success: false,
        message: '用户未分配可用企业角色，请联系管理员',
      });
    }

    enterprises = userTenantRoles;
    const defaultTenant = enterprises[0];

    userTenantId = defaultTenant.id;
    userTenantName = defaultTenant.tenant_name;
    user.role = defaultTenant.role || 'user';

    // 更新用户对象的租户信息
    user.tenant_id = userTenantId;
    user.tenant_name = userTenantName;

    // 生成token，使用用户在默认企业的角色
    const token = generateToken(user);

    // 系统管理员默认拥有所有科室（按租户过滤）
    let managedDepartments = [];
    if (user.role === 'system_admin' && userTenantId) {
      try {
        const deptResult = await db.execute(
          'SELECT department_code FROM departments WHERE tenant_id = ?',
          [userTenantId],
        );
        const allDepartments = Array.isArray(deptResult) ? (deptResult[0] || []) : [];
        managedDepartments = allDepartments.map(dept => dept.department_code);
      } catch (e) {
        console.error('获取所有科室失败:', e);
        // 如果获取失败，保持空数组
      }
    }

    // 将用户信息附加到请求对象，供日志记录使用
    // 注意：用户登录时不绑定tenant_id，因为用户可能有多个租户
    // 审计日志中使用默认企业的tenant_id
    req.user = {
      id: user.id,
      username: user.username,
      real_name: user.real_name,
      role: user.role,
    };

    // 记录登录日志，使用默认企业的tenant_id
    await logAudit(
      req,
      {
        action_type: 'login',
        module: 'users',
        resource_type: 'user',
        resource_id: user.id,
        resource_name: user.real_name || user.username,
        action_description: `用户登录：${user.real_name || user.username} - 默认企业：${userTenantName}`,
        response_status: 200,
      },
      {
        // 传递额外的tenant_id信息给logAudit
        tenantId: userTenantId,
      },
    );

    // 登录成功后的默认跳转建议
    let defaultRoute = '/dashboard'; // 普通用户默认页面
    if (user.role === 'super_admin') {
      defaultRoute = '/tenants'; // 超级管理员默认页面
    } else if (user.role === 'system_admin') {
      defaultRoute = '/users'; // 系统管理员默认页面
    }

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          real_name: user.real_name,
          department_code: user.department_code,
          role: user.role,
          status: user.status,
          tenant_id: user.tenant_id,
          tenant_name: user.tenant_name || null,
          managedDepartments,
        },
        token,
        defaultRoute, // 登录成功后的默认跳转路由建议
        tokenExpiry: loginTokenExpiry, // 令牌过期时间（秒）
        enterprises: (Array.isArray(enterprises) ? enterprises : []).map(enterprise => ({
          ...enterprise,
          role: enterprise.role || 'user',
        })),
      },
    });
  } catch (err) {
    const errorMessage = (err && typeof err.message === 'string' ? err.message : String(err || 'Unknown error')).slice(0, 200);
    console.error('用户登录失败:', errorMessage);
    if (process.env.NODE_ENV !== 'production' && err && err.stack) {
      console.error('登录错误堆栈:', err.stack);
    }

    if (res.headersSent) return;

    const sendJson = (status, body) => {
      try {
        res.status(status).json(body);
      } catch (e) {
        res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));
      }
    };

    if (err && err.code === 'PROTOCOL_CONNECTION_LOST') {
      return sendJson(503, { success: false, message: '数据库连接失败，请稍后重试', error: '数据库服务暂时不可用' });
    }
    if (err && err.code === 'ECONNREFUSED') {
      return sendJson(503, { success: false, message: '数据库连接失败，请稍后重试', error: '数据库服务暂时不可用' });
    }
    if (err && err.code === 'ER_ACCESS_DENIED_ERROR') {
      return sendJson(503, { success: false, message: '数据库访问拒绝，请检查数据库配置', error: '数据库认证失败' });
    }
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      return sendJson(503, { success: false, message: '数据库表缺失，请执行迁移或初始化', error: errorMessage });
    }

    sendJson(500, {
      success: false,
      message: '登录失败，请稍后重试',
      error: errorMessage,
    });
  }
});

/**
 * @swagger
 * /api/users/refresh-token:
 *   post:
 *     tags:
 *       - 用户管理
 *     summary: 刷新令牌
 *     description: 使用当前有效的令牌刷新获取新的令牌
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 令牌刷新成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         token:
 *                           type: string
 *                           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                         tokenExpiry:
 *                           type: integer
 *                           example: 2592000
 *       401:
 *         description: 无效的认证令牌
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// 刷新令牌
router.post('/refresh-token', authenticate, async (req, res) => {
  try {
    const { id, username, real_name, department_code, role, tenant_id } = req.user;

    // 获取最新的用户信息（包括状态）
    const [users] = await db.execute(
      `SELECT u.id, u.username, u.real_name, u.department_code, utr.role, u.status
       FROM users u
       JOIN user_tenant_roles utr ON u.id = utr.user_id
       WHERE u.id = ? AND u.status = ? AND utr.tenant_id = ?`,
      [id, 'active', req.user.tenant_id],
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户不存在或已禁用',
      });
    }

    const user = users[0];

    // 如果不是超级管理员，验证租户状态
    if (user.role !== 'super_admin' && user.tenant_id) {
      const [tenants] = await db.execute(
        'SELECT status, subscription_end_date FROM tenants WHERE id = ?',
        [user.tenant_id],
      );

      if (tenants.length === 0 || tenants[0].status !== 'active') {
        return res.status(403).json({
          success: false,
          message: '租户已被停用',
        });
      }

      // 检查企业订阅是否过期
      if (
        tenants[0].subscription_end_date &&
        new Date(tenants[0].subscription_end_date) < new Date()
      ) {
        return res.status(403).json({
          success: false,
          message: '该企业订阅已过期，请联系管理员续费',
        });
      }

      // 获取租户名称
      const [tenantDetails] = await db.execute('SELECT tenant_name FROM tenants WHERE id = ?', [
        user.tenant_id,
      ]);
      user.tenant_name = tenantDetails[0]?.tenant_name || null;
    }

    // 生成新的令牌
    const token = generateToken(user);

    // 记录令牌刷新日志
    await logAudit(req, {
      action_type: 'refresh_token',
      module: 'users',
      resource_type: 'user',
      resource_id: user.id,
      resource_name: user.real_name || user.username,
      action_description: `用户刷新令牌：${user.real_name || user.username}`,
      response_status: 200,
    });

    res.json({
      success: true,
      message: '令牌刷新成功',
      data: {
        token,
        tokenExpiry: 30 * 24 * 60 * 60, // 令牌过期时间（秒）
      },
    });
  } catch (error) {
    console.error('刷新令牌失败:', error);

    // 根据错误类型返回不同的错误信息
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '无效的认证令牌，请重新登录',
      });
    }

    res.status(500).json({
      success: false,
      message: '刷新令牌失败，请稍后重试',
      error: error.message,
    });
  }
});

// 用户注册
// 生成唯一企业编码（事务内重试机制防止竞态）
async function generateUniqueTenantCode(connection, retries = 10) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const [existing] = await connection.execute(
      'SELECT id FROM tenants WHERE tenant_code = ? LIMIT 1 FOR UPDATE',
      [code],
    );
    if (existing.length === 0) {
      return code;
    }
  }
  throw new Error('无法生成唯一的企业编号，请稍后重试');
}

// 事务内验证短信验证码
async function consumeSmsVerificationCodeWithTx(connection, phone, code, tenantId, options = {}) {
  const { allowNullTenant = false } = options;

  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return { valid: false, status: 400, message: '手机号格式不正确' };
  }

  if (!code || !/^\d{6}$/.test(String(code))) {
    return { valid: false, status: 400, message: '请输入6位验证码' };
  }

  if (!tenantId && !allowNullTenant) {
    return { valid: false, status: 400, message: '请先选择企业后再进行验证' };
  }

  const tenantClause = tenantId ? 'tenant_id = ?' : 'tenant_id IS NULL';
  const params = tenantId ? [phone, tenantId] : [phone];

  const [verificationRecords] = await connection.execute(
    `SELECT id, code, expires_at FROM sms_verification_codes
     WHERE phone = ? AND ${tenantClause}
     ORDER BY created_at DESC LIMIT 1`,
    params,
  );

  if (verificationRecords.length === 0) {
    return { valid: false, status: 400, message: '验证码已过期，请重新获取' };
  }

  const record = verificationRecords[0];
  if (Date.now() > new Date(record.expires_at).getTime()) {
    await connection.execute('DELETE FROM sms_verification_codes WHERE id = ?', [record.id]);
    return { valid: false, status: 400, message: '验证码已过期，请重新获取' };
  }

  if (!timingSafeCompareCode(record.code, String(code))) {
    return { valid: false, status: 400, message: '验证码错误' };
  }

  await connection.execute('DELETE FROM sms_verification_codes WHERE id = ?', [record.id]);
  return { valid: true };
}

router.post('/register', async (req, res) => {
  const {
    username: rawUsername,
    password,
    real_name,
    tenant_code,
    tenant_name,
    tenant_option,
    email,
    phone,
    code,
    managed_departments,
  } = req.body;
  const username = normalizeUsername(rawUsername);

  if (!username || !password || !real_name) {
    return res.status(400).json({ success: false, message: '用户名、密码和真实姓名不能为空' });
  }

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ success: false, message: '用户名长度必须在3-20个字符之间' });
  }

  if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ success: false, message: '手机号格式不正确' });
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({
      success: false,
      message: '密码复杂度验证失败',
      errors: passwordValidation.errors,
    });
  }

  if (!tenant_option) {
    return res.status(400).json({ success: false, message: '请选择企业空间选项' });
  }

  if (isReservedUsername(username)) {
    return res.status(400).json({ success: false, message: '该用户名为系统保留，请更换用户名' });
  }

  if (await isUsernameTaken(username)) {
    return res.status(400).json({ success: false, message: '用户名已存在' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    const result = await db.transaction(async (connection) => {
      let tenantId = null;
      const userRole = tenant_option === 'create' ? 'system_admin' : 'asset_admin';
      const userStatus = tenant_option === 'create' ? 'active' : 'pending';

      if (tenant_option === 'create') {
        if (!tenant_name) {
          throw { status: 400, message: '请输入企业名称' };
        }

        const generatedTenantCode = await generateUniqueTenantCode(connection);

        const [tenantResult] = await connection.execute(
          `INSERT INTO tenants (
            tenant_code, tenant_name, contact_person, contact_phone, contact_email,
            address, license_no, max_users, max_assets, subscription_type, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generatedTenantCode,
            tenant_name,
            real_name || null,
            phone || null,
            email || null,
            null,
            null,
            100,
            10000,
            'free',
            'active',
          ],
        );

        tenantId = tenantResult.insertId;

        const [allModules] = await connection.execute(
          'SELECT id, default_config, version FROM system_modules WHERE status = ?',
          ['stable'],
        );

        if (allModules.length > 0) {
          const now = new Date();
          for (const mod of allModules) {
            await connection.execute(
              `INSERT INTO tenant_module_configs (tenant_id, module_id, enabled, config, version, enabled_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [tenantId, mod.id, 1, mod.default_config || null, mod.version || '1.0.0', now, now],
            );
          }
        }
      } else if (tenant_option === 'join') {
        if (!tenant_code || tenant_code.length !== 4) {
          throw { status: 400, message: '请输入4位数字的企业编码' };
        }

        const [tenants] = await connection.execute(
          'SELECT id, status FROM tenants WHERE tenant_code = ? FOR UPDATE',
          [tenant_code],
        );
        if (tenants.length === 0) {
          throw { status: 400, message: '企业编码不存在，请检查输入' };
        }

        const tenant = tenants[0];
        if (tenant.status !== 'active') {
          throw { status: 400, message: '企业已被停用，请联系管理员' };
        }

        tenantId = tenant.id;
      } else {
        throw { status: 400, message: '无效的企业空间选项' };
      }

      // 验证并存储管理部门（仅加入企业路径有效，新创建企业暂无科室）
      let validDeptCodes = [];
      if (
        tenant_option === 'join' &&
        Array.isArray(managed_departments) &&
        managed_departments.length > 0
      ) {
        const placeholders = managed_departments.map(() => '?').join(',');
        const [existingDepts] = await connection.execute(
          `SELECT department_code FROM departments WHERE tenant_id = ? AND department_code IN (${placeholders})`,
          [tenantId, ...managed_departments],
        );
        if (existingDepts.length !== managed_departments.length) {
          throw { status: 400, message: '部分科室不存在于该企业，请重新选择' };
        }
        validDeptCodes = managed_departments;
      }

      if (phone || code) {
        let verification;
        if (tenant_option === 'create') {
          verification = await consumeSmsVerificationCodeWithTx(connection, phone, code, null, { allowNullTenant: true });
        } else {
          verification = await consumeSmsVerificationCodeWithTx(connection, phone, code, tenantId);
        }

        if (!verification.valid) {
          throw { status: verification.status, message: verification.message };
        }
      }

      const [userResult] = await connection.execute(
        `INSERT INTO users (username, password, real_name, email, phone, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [username, hashedPassword, real_name, email || null, phone || null, userStatus],
      );

      await connection.execute(
        `INSERT INTO user_tenant_roles (user_id, tenant_id, role, is_default, status, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [userResult.insertId, tenantId, userRole, 1, userStatus],
      );

      // 写入管理部门关联（注册时选中的科室）
      if (validDeptCodes.length > 0) {
        for (const deptCode of validDeptCodes) {
          await connection.execute(
            `INSERT INTO user_managed_departments (user_id, tenant_id, department_code)
             VALUES (?, ?, ?)`,
            [userResult.insertId, tenantId, deptCode],
          );
        }
      }

      return { userId: userResult.insertId, tenantId, userRole, userStatus };
    });

    let message =
      result.userStatus === 'active'
        ? '注册成功，企业空间已创建'
        : '注册成功，加入申请已提交，请等待管理员审核';

    const responseData = {
      id: result.userId,
      tenant_id: result.tenantId,
      tenant_option,
      role: result.userRole,
    };

    if (result.userStatus === 'active' && result.tenantId) {
      try {
        await enableAllModulesForTenant(result.tenantId);
      } catch (moduleError) {
        console.error('注册后启用模块失败:', moduleError);
      }

      try {
        await initializeRegistrationDemoData({
          tenantId: result.tenantId,
          userId: result.userId,
          username,
          realName: real_name,
          phone,
        });
        responseData.demo_data_initialized = true;
        message = '注册成功，企业空间已创建，并已初始化测试数据';
      } catch (seedError) {
        console.error('注册后初始化测试数据失败:', seedError);
        responseData.demo_data_initialized = false;
        responseData.demo_data_warning = '测试数据初始化失败，可稍后在系统内手动补充';
        message = '注册成功，企业空间已创建，但测试数据初始化失败';
      }
    }

    await logAudit(req, {
      action_type: 'register',
      module: 'users',
      resource_type: 'user',
      resource_id: result.userId,
      resource_name: real_name,
      action_description: `用户注册：${real_name} (${username}) - ${result.userStatus === 'active' ? '创建企业' : '加入企业'}`,
      new_value: { username, real_name, tenant_option, tenant_id: result.tenantId, role: result.userRole },
      response_status: 200,
    }, { tenantId: result.tenantId });

    res.json({ success: true, message, data: responseData });
  } catch (error) {
    console.error('用户注册失败:', error);
    const status = error.status || 500;
    const message = error.message || '注册失败';
    res.status(status).json({ success: false, message });
  }
});

// 申请加入企业
router.post('/join-enterprise', authenticate, async (req, res) => {
  try {
    const { tenant_code } = req.body;

    // 验证企业编码格式
    if (!tenant_code || tenant_code.length !== 4 || isNaN(tenant_code)) {
      return res.status(400).json({ success: false, message: '请输入有效的4位数字企业编码' });
    }

    // 验证企业编码是否存在
    const [tenants] = await executeQuery(
      'SELECT id, tenant_name, status FROM tenants WHERE tenant_code = ?',
      [tenant_code],
    );

    if (tenants.length === 0) {
      return res.status(400).json({ success: false, message: '企业编码不存在' });
    }

    const tenant = tenants[0];

    // 验证企业状态是否激活
    if (tenant.status !== 'active') {
      return res.status(400).json({ success: false, message: '该企业已被停用' });
    }

    // 获取当前用户信息
    const userId = req.user.id;

    // 检查用户是否已经在该企业中
    const [existingRoles] = await executeQuery(
      'SELECT id FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
      [userId, tenant.id],
    );

    if (existingRoles.length > 0) {
      return res.status(400).json({ success: false, message: '您已经是该企业的成员' });
    }

    // 已经通过existingRoles检查了用户是否关联到该企业，不需要再检查users表

    // 创建用户-租户关联记录，状态为待审核
    await executeQuery(
      `INSERT INTO user_tenant_roles (user_id, tenant_id, role, status, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId, tenant.id, 'asset_admin', 'pending'],
    );

    res.json({
      success: true,
      message: '申请已提交，请等待管理员审核',
      data: {
        tenant_id: tenant.id,
        tenant_name: tenant.tenant_name,
        tenant_code: tenant.tenant_code,
        status: 'pending',
      },
    });
  } catch (error) {
    console.error('用户申请加入企业失败:', error);
    res.status(500).json({ success: false, message: '申请失败，请稍后重试', error: error.message });
  }
});

// 获取待审核用户列表（仅系统管理员）
router.get('/pending', authenticate, authorize(['system_admin']), async (req, res) => {
  try {
    const [users] = await db.execute(
      `SELECT u.id, u.username, u.real_name, u.email, u.phone, utr.role, u.created_at
       FROM users u
       JOIN user_tenant_roles utr ON u.id = utr.user_id
       WHERE utr.tenant_id = ? AND utr.status = 'pending'
       ORDER BY u.created_at DESC`,
      [req.user.tenant_id],
    );

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('获取待审核用户列表失败:', error);
    res
      .status(500)
      .json({ success: false, message: '获取待审核用户列表失败', error: error.message });
  }
});

// 审核用户（仅系统管理员）
router.put('/:id/approve', authenticate, authorize(['system_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;

    // 验证用户是否存在且属于当前租户
    const [userRoles] = await db.execute(
      'SELECT id FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ? AND status = "pending"',
      [id, req.user.tenant_id],
    );

    if (userRoles.length === 0) {
      return res.status(404).json({ success: false, message: '待审核用户不存在' });
    }

    if (approved) {
      await db.execute(
        'UPDATE user_tenant_roles SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND tenant_id = ? AND status = ?',
        ['active', id, req.user.tenant_id, 'pending'],
      );
      await db.execute('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        'active',
        id,
      ]);
    } else {
      await db.execute(
        'DELETE FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ? AND status = ?',
        [id, req.user.tenant_id, 'pending'],
      );
    }

    res.json({
      success: true,
      message: approved ? '用户审核通过' : '用户审核拒绝',
    });
  } catch (error) {
    console.error('审核用户失败:', error);
    res.status(500).json({ success: false, message: '审核用户失败', error: error.message });
  }
});

// 审核用户加入企业请求（仅系统管理员）
router.put(
  '/role-requests/:id/approve',
  authenticate,
  authorize(['system_admin']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { approved } = req.body;

      // 验证请求是否存在且属于当前租户
      const [requests] = await executeQuery(
        `SELECT ur.id, ur.user_id, ur.tenant_id, ur.role
       FROM user_tenant_roles ur
       WHERE ur.id = ? AND ur.status = "pending" AND ur.tenant_id = ?`,
        [id, req.user.tenant_id],
      );

      if (requests.length === 0) {
        return res.status(404).json({ success: false, message: '待审核的加入请求不存在' });
      }

      const request = requests[0];

      if (approved) {
        // 审核通过，更新用户-租户角色状态为active
        await executeQuery(
          `UPDATE user_tenant_roles
         SET status = "active", updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
          [id],
        );

        res.json({
          success: true,
          message: '用户加入申请已通过',
        });
      } else {
        // 审核拒绝，删除该请求
        await executeQuery('DELETE FROM user_tenant_roles WHERE id = ?', [id]);

        res.json({
          success: true,
          message: '用户加入申请已拒绝',
        });
      }
    } catch (error) {
      console.error('审核用户加入企业请求失败:', error);
      res
        .status(500)
        .json({ success: false, message: '审核失败，请稍后重试', error: error.message });
    }
  },
);

// 获取待审核的加入企业请求（仅系统管理员）
router.get(
  '/role-requests/pending',
  authenticate,
  authorize(['system_admin']),
  async (req, res) => {
    try {
      const [requests] = await executeQuery(
        `SELECT ur.id, u.username, u.real_name, u.email, u.phone, ur.role, ur.created_at
       FROM user_tenant_roles ur
       INNER JOIN users u ON ur.user_id = u.id
       WHERE ur.tenant_id = ? AND ur.status = "pending"
       ORDER BY ur.created_at DESC`,
        [req.user.tenant_id],
      );

      res.json({
        success: true,
        data: requests,
      });
    } catch (error) {
      console.error('获取待审核加入请求失败:', error);
      res
        .status(500)
        .json({ success: false, message: '获取失败，请稍后重试', error: error.message });
    }
  },
);

// 获取当前用户信息
router.get('/profile', authenticate, async (req, res) => {
  try {
    const authenticatedUser = req.user;
    if (!authenticatedUser) {
      return res.status(401).json({ success: false, message: '未登录或登录已过期' });
    }

    // 获取租户信息（失败时仅记录日志，不导致 500）
    let tenantInfo = null;
    if (authenticatedUser.tenant_id) {
      try {
        const [tenants] = await executeQuery(
          'SELECT tenant_name, tenant_code FROM tenants WHERE id = ?',
          [authenticatedUser.tenant_id],
        );
        if (tenants && tenants.length > 0) {
          tenantInfo = {
            tenant_id: authenticatedUser.tenant_id,
            tenant_name: tenants[0].tenant_name,
            tenant_code: tenants[0].tenant_code,
          };
        }
      } catch (tenantErr) {
        console.warn('获取租户信息失败（已忽略）:', tenantErr.message);
      }
    }

    res.json({
      success: true,
      data: {
        id: authenticatedUser.id,
        username: authenticatedUser.username,
        real_name: authenticatedUser.real_name,
        department_code: authenticatedUser.department_code,
        role: authenticatedUser.role,
        email: authenticatedUser.email,
        phone: authenticatedUser.phone,
        status: authenticatedUser.status,
        managed_departments: authenticatedUser.managed_departments,
        tenant_id: authenticatedUser.tenant_id,
        created_at: authenticatedUser.created_at,
        ...tenantInfo,
      },
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ success: false, message: '获取用户信息失败', error: error.message });
  }
});

// 系统管理员创建新用户
router.post('/', authenticate, authorize('manage_users'), async (req, res) => {
  try {
    const {
      username: rawUsername,
      password,
      real_name,
      department_code,
      role,
      managed_departments,
      email,
      phone,
      status,
      tenant_id,
    } = req.body;
    const username = normalizeUsername(rawUsername);

    if (!username || !password || !real_name || !role) {
      return res
        .status(400)
        .json({ success: false, message: '用户名、密码、真实姓名和角色不能为空' });
    }

    // 验证密码复杂度
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: '密码复杂度验证失败',
        errors: passwordValidation.errors,
      });
    }

    if (isReservedUsername(username)) {
      return res.status(400).json({ success: false, message: '该用户名为系统保留，请更换用户名' });
    }

    // 检查用户名是否已存在（users + super_users）
    if (await isUsernameTaken(username)) {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 12);

    // 确定租户ID：
    // - 创建新企业空间：使用新创建的企业ID
    // - 加入现有企业空间：使用现有企业ID
    // - 超级管理员创建的用户：如果指定了tenant_id则使用，否则为null（允许创建跨租户用户）
    // - 系统管理员（租户级）创建的用户：如果指定了tenant_id则使用，否则使用当前用户的租户ID
    // - 普通用户创建的用户：使用当前用户的租户ID
    let finalTenantId = tenant_id;
    if (req.user && req.user.role === 'super_admin') {
      // 超级管理员如果指定了tenant_id则使用，否则为null（允许创建跨租户用户）
      // 保持传入的tenant_id不变
    } else if (req.user && req.user.tenant_id) {
      // 系统管理员（租户级）和普通用户使用自己的租户ID
      finalTenantId = req.user.tenant_id;
    }

    // 非超级管理员必须存在租户上下文
    if (!finalTenantId && req.user.role !== 'super_admin') {
      return res.status(400).json({
        success: false,
        message: '当前用户未分配企业空间，无法创建用户',
      });
    }

    // 验证管理科室
    if (
      managed_departments &&
      Array.isArray(managed_departments) &&
      managed_departments.length > 0
    ) {
      // 如果有租户ID，验证所有科室都属于该租户
      if (finalTenantId) {
        const placeholders = managed_departments.map(() => '?').join(',');
        const [departments] = await db.execute(
          `SELECT id FROM departments WHERE id IN (${placeholders}) AND tenant_id = ?`,
          [...managed_departments, finalTenantId],
        );

        if (departments.length !== managed_departments.length) {
          return res.status(400).json({ success: false, message: '部分管理科室不属于当前企业' });
        }
      }
    }

    // 系统管理员（租户级）创建的用户必须属于同一租户
    if (
      req.user.role === 'system_admin' &&
      finalTenantId &&
      req.user.tenant_id &&
      finalTenantId !== req.user.tenant_id
    ) {
      return res
        .status(403)
        .json({ success: false, message: '系统管理员只能创建自己租户内的用户' });
    }

    // 系统管理员（租户级）不能创建超级管理员角色
    if (req.user.role === 'system_admin' && role === 'super_admin') {
      return res.status(403).json({ success: false, message: '系统管理员不能创建超级管理员角色' });
    }

    // 超级管理员创建的用户，如果角色是system_admin，必须指定tenant_id
    if (req.user.role === 'super_admin' && role === 'system_admin' && !finalTenantId) {
      return res
        .status(400)
        .json({ success: false, message: '创建系统管理员（租户级）时必须指定租户' });
    }

    // 确定user表中存储的角色：只有super_admin存储在user表中，其他角色存储在user_tenant_roles表中
    const userRoleInUsersTable = role === 'super_admin' ? role : 'user';

    // 创建用户 - 不再使用tenant_id字段和role字段
    const [result] = await db.execute(
      `INSERT INTO users (
        username, password, real_name, department_code, email, phone, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        hashedPassword,
        real_name,
        department_code || null,
        email || null,
        phone || null,
        status || 'active',
      ],
    );

    // 在user_tenant_roles表中创建关联记录 - 不再存储managed_departments
    if (finalTenantId) {
      await executeQuery(
        `INSERT INTO user_tenant_roles (user_id, tenant_id, role, is_default, status, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [result.insertId, finalTenantId, role, 1, 'active'],
      );

      // 在user_managed_departments表中创建管理科室关联记录
      if (
        managed_departments &&
        Array.isArray(managed_departments) &&
        managed_departments.length > 0
      ) {
        for (const deptId of managed_departments) {
          await executeQuery(
            `INSERT INTO user_managed_departments (user_id, tenant_id, department_code)
             VALUES (?, ?, ?)`,
            [result.insertId, finalTenantId, deptId],
          );
        }
      }
    }

    // 记录创建用户日志
    await logAudit(req, {
      action_type: 'create',
      module: 'users',
      resource_type: 'user',
      resource_id: result.insertId,
      resource_name: real_name,
      action_description: `创建用户：${real_name} (${username})`,
      new_value: { username, real_name, role, department_code, status: status || 'active' },
      response_status: 200,
    });

    res.json({
      success: true,
      message: '用户创建成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error('创建用户失败:', error);
    res.status(500).json({ success: false, message: '创建用户失败', error: error.message });
  }
});

// 获取用户列表（系统管理员）
router.get('/', authenticate, authorize('manage_users'), async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, role: roleFilter, status } = req.query;
    const offset = (page - 1) * pageSize;

    // 生成缓存键
    const cacheKey = `users:list:${JSON.stringify({
      user_id: req.user.id,
      role: req.user.role,
      page,
      pageSize,
      keyword,
      role_filter: roleFilter,
      status,
      tenant_id: req.user.tenant_id,
    })}`;

    // 尝试从缓存获取数据
    const cachedData = await req.cacheService.get(cacheKey);
    if (cachedData !== null) {
      console.log(`✅ 从Redis获取用户列表缓存: 用户${req.user.id} - 页码${page} - 每页${pageSize}`);
      return res.json(cachedData);
    }

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (keyword) {
      whereClause += ' AND (username LIKE ? OR real_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const keywordParam = `%${keyword}%`;
      params.push(keywordParam, keywordParam, keywordParam, keywordParam);
    }

    if (roleFilter) {
      whereClause += ' AND utr.role = ?';
      params.push(roleFilter);
    }

    if (status) {
      whereClause += ' AND u.status = ?';
      params.push(status);
    }

    // 修改查询逻辑，同时包含已关联用户和申请中的用户
    let querySql = '';
    let countSql = '';

    if (req.user.role !== 'super_admin' && req.user.tenant_id) {
      // 系统管理员（租户级）：查询user_tenant_roles表中属于当前租户的所有用户，同时确保包含当前用户自己

      // 获取总数：查询user_tenant_roles表中属于当前租户的所有用户
      countSql = `
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        JOIN user_tenant_roles utr ON u.id = utr.user_id AND utr.tenant_id = ?
        ${keyword ? ' WHERE (u.username LIKE ? OR u.real_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)' : ' WHERE 1=1'}
        ${roleFilter ? ' AND utr.role = ?' : ''}
        ${status ? ' AND u.status = ?' : ''}`;

      // 获取数据：查询user_tenant_roles表中属于当前租户的所有用户
      querySql = `
        SELECT
          u.id,
          u.username,
          u.real_name,
          u.department_code,
          utr.role,
          u.email,
          u.phone,
          u.status,
          u.created_at,
          u.updated_at,
          COALESCE(utr.status, 'active') as membership_status
        FROM users u
        JOIN user_tenant_roles utr ON u.id = utr.user_id AND utr.tenant_id = ?
        ${keyword ? ' WHERE (u.username LIKE ? OR u.real_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)' : ' WHERE 1=1'}
        ${roleFilter ? ' AND utr.role = ?' : ''}
        ${status ? ' AND u.status = ?' : ''}
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?`;

      // 构建参数数组
      const tenantId = getTenantId(req);
      const keywordParam = keyword ? `%${keyword}%` : null;

      const countParams = [tenantId];
      if (keyword) countParams.push(keywordParam, keywordParam, keywordParam, keywordParam);
      if (roleFilter) countParams.push(roleFilter);
      if (status) countParams.push(status);

      const queryParams = [tenantId];
      if (keyword) queryParams.push(keywordParam, keywordParam, keywordParam, keywordParam);
      if (roleFilter) queryParams.push(roleFilter);
      if (status) queryParams.push(status);
      queryParams.push(parseInt(pageSize), offset);

      // 执行查询
      const [countResult] = await db.execute(countSql, countParams);
      const { total } = countResult[0];

      const [rows] = await db.execute(querySql, queryParams);

      // 为每个用户单独查询管理科室
      const usersWithDepartments = await Promise.all(
        rows.map(async user => {
          // 从user_managed_departments表获取用户管理的科室
          let managedDepartments = [];
          try {
            const [managedDepartmentsResult] = await db.execute(
              'SELECT department_code FROM user_managed_departments WHERE user_id = ? AND tenant_id = ?',
              [user.id, tenantId],
            );

            // 直接使用department_code字段
            if (managedDepartmentsResult.length > 0) {
              managedDepartments = managedDepartmentsResult.map(dept => dept.department_code);
            }
          } catch (e) {
            console.error('获取管理科室失败:', e);
          }
          return {
            ...user,
            managed_departments: managedDepartments,
          };
        }),
      );

      const result = {
        success: true,
        data: usersWithDepartments,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };

      // 缓存结果，过期时间1分钟
      await req.cacheService.set(cacheKey, result, 60);

      return res.json(result);
    } else {
      // 超级管理员：使用原始查询逻辑
      // 获取总数
      console.log(`📊 从数据库获取用户列表: 用户${req.user.id} - 页码${page} - 每页${pageSize}`);

      // 超级管理员查询需要考虑user_tenant_roles表中的角色
      const superAdminCountSql = `
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        LEFT JOIN user_tenant_roles utr ON u.id = utr.user_id
        ${whereClause}`;

      const [countResult] = await db.execute(superAdminCountSql, params);
      const { total } = countResult[0];

      // 获取数据
      const [rows] = await db.execute(
        `SELECT
          u.id,
          u.username,
          u.real_name,
          u.department_code,
          NULLIF(GROUP_CONCAT(DISTINCT utr.role ORDER BY utr.role SEPARATOR ', '), '') as role,
          u.email,
          u.phone,
          u.status,
          u.created_at,
          u.updated_at
         FROM users u
         LEFT JOIN user_tenant_roles utr ON u.id = utr.user_id
         ${whereClause}
         GROUP BY
          u.id,
          u.username,
          u.real_name,
          u.department_code,
          u.email,
          u.phone,
          u.status,
          u.created_at,
          u.updated_at
         ORDER BY u.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(pageSize), offset],
      );

      // 为每个用户单独查询管理科室
      const usersWithDepartments = await Promise.all(
        rows.map(async user => {
          // 从user_managed_departments表获取用户管理的科室
          let managedDepartments = [];
          try {
            // 超级管理员需要查询所有租户的管理科室，需要为每个用户查找所有相关租户
            const [userTenants] = await db.execute(
              'SELECT tenant_id FROM user_tenant_roles WHERE user_id = ?',
              [user.id],
            );

            // 收集所有租户的管理科室
            for (const tenant of userTenants) {
              const [managedDepartmentsResult] = await db.execute(
                'SELECT department_code FROM user_managed_departments WHERE user_id = ? AND tenant_id = ?',
                [user.id, tenant.tenant_id],
              );

              // 直接使用department_code字段
              if (managedDepartmentsResult.length > 0) {
                managedDepartments = [
                  ...managedDepartments,
                  ...managedDepartmentsResult.map(dept => dept.department_code),
                ];
              }
            }
          } catch (e) {
            console.error('获取管理科室失败:', e);
          }
          return {
            ...user,
            managed_departments: managedDepartments,
          };
        }),
      );

      const result = {
        success: true,
        data: usersWithDepartments,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };

      // 缓存结果，过期时间1分钟
      await req.cacheService.set(cacheKey, result, 60);

      return res.json(result);
    }
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ success: false, message: '获取用户列表失败', error: error.message });
  }
});

// 获取角色列表（必须在 /:id 路由之前）
router.get('/roles', authenticate, async (req, res) => {
  try {
    // 检查 roles 表是否存在
    const [tables] = await db.execute(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'roles'
    `);

    let roles;
    if (tables.length > 0) {
      // 从 roles 表获取角色信息
      [roles] = await db.execute(`
        SELECT
          r.role_code as role,
          r.role_name as label,
          r.description,
          r.is_system_role,
          r.is_active
        FROM roles r
        WHERE r.is_active = 1
        ORDER BY
          CASE r.role_code
            WHEN 'super_admin' THEN 1
            WHEN 'system_admin' THEN 2
            WHEN 'asset_admin' THEN 3
            WHEN 'department_admin' THEN 4
            ELSE 5
          END,
          r.created_at
      `);

      // 转换为兼容格式 { value, label }
      // 根据用户角色过滤：系统管理员（租户级）不能看到超级管理员角色
      const userRole = req.user?.role;
      roles = roles.map(r => ({
        value: r.role,
        label: r.label || r.role_name || r.role,
      }));

      // 系统管理员（租户级）不能看到超级管理员角色
      if (userRole === 'system_admin') {
        roles = roles.filter(r => r.value !== 'super_admin');
      }
    } else {
      // 如果 roles 表不存在，使用默认角色（兼容旧系统）
      // 引用 roles.config.js 的 ROLE_DISPLAY_NAMES 保持角色定义同步
      const { ROLE_DISPLAY_NAMES, ROLES } = require('../config/roles.config');
      const userRole = req.user?.role;

      // 角色展示顺序：管理员角色在前，业务角色在中，普通用户在后
      const orderedRoleCodes = [
        ROLES.SUPER_ADMIN,
        ROLES.SYSTEM_ADMIN,
        ROLES.ASSET_ADMIN,
        ROLES.DEPARTMENT_ADMIN,
        ROLES.METROLOGY_ADMIN,
        ROLES.QUALITY_ADMIN,
        ROLES.MAINTENANCE_ADMIN,
        ROLES.MAINTENANCE_ENGINEER,
        ROLES.ACCEPTANCE_ADMIN,
        ROLES.TRANSFER_ADMIN,
        ROLES.INVENTORY_ADMIN,
        ROLES.USER,
      ];

      roles = orderedRoleCodes
        .filter(roleCode => {
          // 超级管理员角色只有超级管理员可见
          if (roleCode === ROLES.SUPER_ADMIN && userRole !== 'super_admin') {
            return false;
          }
          return true;
        })
        .map(roleCode => ({
          value: roleCode,
          label: ROLE_DISPLAY_NAMES[roleCode] || roleCode,
        }));
    }

    res.json({ success: true, data: roles });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    res.status(500).json({ success: false, message: '获取角色列表失败', error: error.message });
  }
});

// 导出用户列表（系统管理员）
router.get('/export', authenticate, authorize('manage_users'), async (req, res) => {
  try {
    let query = `SELECT u.id, u.username, u.real_name, u.department_code, u.email, u.phone, u.status, u.created_at
                 FROM users u`;
    const params = [];

    if (req.user.role !== 'super_admin') {
      query = `SELECT u.id, u.username, u.real_name, u.department_code, u.email, u.phone, u.status, u.created_at
               FROM users u
               INNER JOIN user_tenant_roles utr ON u.id = utr.user_id
               WHERE utr.tenant_id = ?`;
      params.push(req.user.tenant_id);
    }

    const [users] = await db.execute(query, params);
    return res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('导出用户数据失败:', error);
    return res.status(500).json({ success: false, message: '导出用户数据失败', error: error.message });
  }
});

// 获取单个用户信息（系统管理员）
router.get('/by-username/:username', authenticate, async (req, res) => {
  try {
    const { username } = req.params;

    const [result] = await db.execute(
      `SELECT u.id, u.username, u.real_name, u.department_code, u.email, u.phone, u.status, u.created_at
       FROM users u
       WHERE u.username = ?
       LIMIT 1`,
      [username],
    );

    if (result.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const user = result[0];

    const [userRoles] = await db.execute(
      'SELECT role FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ? AND status = ?',
      [user.id, req.user.tenant_id, 'active'],
    );

    res.json({
      success: true,
      data: {
        ...user,
        role: userRoles[0]?.role || null,
      },
    });
  } catch (error) {
    logger.error('Get user by username failed:', error);
    res.status(500).json({
      success: false,
      message: '按用户名查询用户失败',
      error: error.message,
    });
  }
});

router.get('/:id', authenticate, authorize('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    // 对于系统管理员，需要通过user_tenant_roles表关联查询用户
    let users;
    let query;
    let params;

    if (req.user.role === 'super_admin') {
      // 超级管理员可以查看所有用户
      query = `SELECT u.id, u.username, u.real_name, u.department_code, u.email, u.phone, u.status, u.created_at, u.updated_at
               FROM users u
               WHERE u.id = ?`;
      params = [id];
    } else {
      // 系统管理员只能查看自己租户下的用户
      query = `SELECT u.id, u.username, u.real_name, u.department_code, u.email, u.phone, u.status, u.created_at, u.updated_at
               FROM users u
               JOIN user_tenant_roles utr ON u.id = utr.user_id
               WHERE utr.tenant_id = ? AND u.id = ?`;
      params = [req.user.tenant_id, id];
    }

    const [result] = await db.execute(query, params);
    users = result;

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const user = users[0];

    // 从user_tenant_roles表获取用户在当前租户的角色
    const [userRoles] = await db.execute(
      'SELECT role FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ? AND status = ?',
      [user.id, req.user.tenant_id, 'active'],
    );

    // 从user_managed_departments表获取用户管理的科室
    let managedDepartments = [];
    try {
      const [managedDepartmentsResult] = await db.execute(
        'SELECT department_code FROM user_managed_departments WHERE user_id = ? AND tenant_id = ?',
        [user.id, req.user.tenant_id],
      );
      managedDepartments = managedDepartmentsResult.map(dept => dept.department_code);
    } catch (e) {
      console.error('获取管理科室失败:', e);
    }

    // 确定正确的角色：优先使用租户角色，否则使用用户表中的角色
    const correctRole = userRoles.length > 0 ? userRoles[0].role : user.role;

    // 准备返回数据
    const returnData = {
      ...user,
      role: correctRole, // 确保返回正确的租户角色
      managed_departments: managedDepartments,
      tenant_role: correctRole, // 保留tenant_role字段以兼容旧代码
    };

    res.json({
      success: true,
      data: returnData,
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ success: false, message: '获取用户信息失败', error: error.message });
  }
});

// 更新用户信息
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      real_name,
      department_code,
      role,
      managed_departments,
      email,
      phone,
      status,
      updated_by,
    } = req.body;

    // 超级管理员和系统管理员（租户级）可以更新用户，普通用户只能更新自己的基本信息
    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'system_admin';
    if (!isAdmin && req.user.id !== parseInt(id)) {
      return res.status(403).json({ success: false, message: '只能更新自己的信息' });
    }

    // 验证租户权限：系统管理员（租户级）只能更新自己租户的用户
    if (req.user.role === 'system_admin') {
      const [userRoles] = await db.execute(
        'SELECT COUNT(*) as count FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
        [id, req.user.tenant_id],
      );
      if (userRoles[0].count === 0) {
        return res.status(403).json({ success: false, message: '只能更新自己租户内的用户' });
      }
    }

    // 只有超级管理员和系统管理员（租户级）可以修改角色
    // 资产管理员可以修改自己的管理科室
    if (!isAdmin && role) {
      return res.status(403).json({ success: false, message: '只有系统管理员可以修改角色' });
    }

    // 普通用户不能修改管理科室
    if (!isAdmin && managed_departments !== undefined) {
      return res.status(403).json({ success: false, message: '只有系统管理员可以修改管理科室' });
    }

    // 普通用户不能通过资料更新接口修改密码
    if (!isAdmin && req.body.password && req.body.password.trim() !== '') {
      return res.status(403).json({ success: false, message: '请使用修改密码接口完成密码修改' });
    }

    // 管理员更新用户状态时，限制状态值
    if (status !== undefined && isAdmin) {
      const validStatus = new Set(['active', 'inactive']);
      if (!validStatus.has(status)) {
        return res.status(400).json({ success: false, message: '无效的用户状态' });
      }
    }

    // 系统管理员（租户级）不能创建或修改超级管理员角色
    if (req.user.role === 'system_admin' && role === 'super_admin') {
      return res
        .status(403)
        .json({ success: false, message: '系统管理员不能创建或修改超级管理员角色' });
    }

    // 验证角色是否有效（不允许创建不存在的角色）
    if (role) {
      const { ALL_ROLES } = require('../config/roles.config');
      const validRoles = ALL_ROLES;
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: '无效的角色' });
      }
    }

    // 验证管理科室
    if (
      managed_departments !== undefined &&
      Array.isArray(managed_departments) &&
      managed_departments.length > 0
    ) {
      // 超级管理员可以跳过科室所属租户的验证
      if (req.user.role !== 'super_admin') {
        // 获取当前企业的ID
        const currentTenantId = req.user.tenant_id;

        // 验证所有科室都属于当前企业
        const placeholders = managed_departments.map(() => '?').join(',');
        const [departments] = await db.execute(
          `SELECT department_code FROM departments WHERE department_code IN (${placeholders}) AND tenant_id = ?`,
          [...managed_departments, currentTenantId],
        );

        if (departments.length !== managed_departments.length) {
          return res.status(400).json({ success: false, message: '部分管理科室不属于当前企业' });
        }
      }
    }

    // 构建更新SQL - 不再在users表中更新managed_departments和tenant_id
    const updateFields = [];
    const updateValues = [];
    // 使用当前请求的租户ID作为用户的租户ID
    const userTenantId = req.user.tenant_id;

    if (real_name !== undefined) {
      updateFields.push('real_name = ?');
      updateValues.push(real_name);
    }
    if (department_code !== undefined) {
      updateFields.push('department_code = ?');
      updateValues.push(department_code || null);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email || null);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone || null);
    }
    if (status !== undefined && isAdmin) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (updated_by !== undefined) {
      updateFields.push('updated_by = ?');
      updateValues.push(updated_by);
    }

    // 如果密码存在且不为空，则更新密码
    if (req.body.password && req.body.password.trim() !== '') {
      // 验证密码复杂度
      const passwordValidation = validatePassword(req.body.password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          message: '密码复杂度验证失败',
          errors: passwordValidation.errors,
        });
      }

      const hashedPassword = await bcrypt.hash(req.body.password, 12);
      updateFields.push('password = ?');
      updateValues.push(hashedPassword);
    }

    let userExists = true;
    let result = null;

    // 更新users表（如果有字段需要更新）
    if (updateFields.length > 0) {
      updateFields.push('updated_at = NOW()');
      updateValues.push(id);

      [result] = await db.execute(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
        [...updateValues, userTenantId],
      );

      if (result.affectedRows === 0) {
        userExists = false;
      }
    } else {
      // 如果没有更新users表字段，验证用户是否存在
      const [existingUsers] = await db.execute('SELECT id FROM users WHERE id = ? AND tenant_id = ?', [id, userTenantId]);
      if (existingUsers.length === 0) {
        userExists = false;
      }
    }

    // 如果更新了角色，更新user_tenant_roles表
    if (role !== undefined && isAdmin && userTenantId && userExists) {
      try {
        // 检查user_tenant_roles表中是否存在关联记录
        const [existingRoles] = await db.execute(
          'SELECT id FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
          [id, userTenantId],
        );

        if (existingRoles.length > 0) {
          // 更新现有关联记录 - 确保status字段被正确设置
          await db.execute(
            'UPDATE user_tenant_roles SET role = ?, status = ?, updated_at = NOW() WHERE user_id = ? AND tenant_id = ?',
            [role, 'active', id, userTenantId],
          );
        } else {
          // 创建新的关联记录 - 不再存储managed_departments
          await executeQuery(
            `INSERT INTO user_tenant_roles (user_id, tenant_id, role, is_default, status, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [id, userTenantId, role || 'user', 1, 'active'],
          );
        }
      } catch (roleUpdateError) {
        console.error('更新 user_tenant_roles 失败:', roleUpdateError);
      }
    }

    // 如果更新了管理科室，更新user_managed_departments表
    if (managed_departments !== undefined && userTenantId && userExists) {
      try {
        // 1. 先删除用户在当前企业的所有管理科室关联
        await executeQuery(
          'DELETE FROM user_managed_departments WHERE user_id = ? AND tenant_id = ?',
          [id, userTenantId],
        );

        // 2. 如果有新的管理科室，重新创建关联
        if (Array.isArray(managed_departments) && managed_departments.length > 0) {
          for (const deptId of managed_departments) {
            await executeQuery(
              `INSERT INTO user_managed_departments (user_id, tenant_id, department_code)
               VALUES (?, ?, ?)`,
              [id, userTenantId, deptId],
            );
          }
        }
      } catch (error) {
        console.error('更新用户管理科室失败:', error);
        // 只记录错误，不影响其他更新操作
      }
    }

    if (!userExists) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    res.json({ success: true, message: '用户信息更新成功' });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({ success: false, message: '更新用户信息失败', error: error.message });
  }
});

// 更改密码
router.put('/:id/change-password', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    // 验证参数
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: '旧密码和新密码不能为空' });
    }

    // 验证新密码复杂度
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: '新密码复杂度验证失败',
        errors: passwordValidation.errors,
      });
    }

    // 超级管理员和系统管理员（租户级）可以更改用户密码，普通用户只能更改自己的
    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'system_admin';
    if (!isAdmin && req.user.id !== parseInt(id)) {
      return res.status(403).json({ success: false, message: '只能更改自己的密码' });
    }

    // 验证租户权限：系统管理员（租户级）只能更改自己租户的用户密码
    if (req.user.role === 'system_admin') {
      const [targetUserRoles] = await db.execute(
        'SELECT COUNT(*) as count FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
        [id, req.user.tenant_id],
      );
      if (targetUserRoles[0].count === 0) {
        return res.status(403).json({ success: false, message: '只能更改自己租户内的用户密码' });
      }
    }

    // 获取用户当前密码
    const [users] = await db.execute('SELECT password FROM users WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 如果是普通用户，需要验证旧密码（管理员不需要验证旧密码）
    if (!isAdmin) {
      const isPasswordValid = await bcrypt.compare(oldPassword, users[0].password);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: '旧密码错误' });
      }
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // 更新密码
    await db.execute('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?', [
      hashedPassword,
      id,
      req.user.tenant_id,
    ]);

    res.json({ success: true, message: '密码更改成功' });
  } catch (error) {
    console.error('更改密码失败:', error);
    res.status(500).json({ success: false, message: '更改密码失败', error: error.message });
  }
});

// 删除用户（系统管理员）
router.delete('/:id', authenticate, authorize('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;

    // 防止删除自己
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ success: false, message: '不能删除自己的账号' });
    }

    // 先获取用户信息（用于日志记录）
    const [users] = await db.execute('SELECT username, real_name FROM users WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 只删除用户与当前企业的关联，不真正删除用户
    // 系统管理员（租户级）只能删除自己租户的用户关联
    let result;
    if (req.user.role === 'system_admin') {
      // 系统管理员只能删除自己租户的用户关联
      [result] = await db.execute(
        'DELETE FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
        [id, req.user.tenant_id],
      );
    } else {
      // 超级管理员可以删除所有关联
      [result] = await db.execute('DELETE FROM user_tenant_roles WHERE user_id = ?', [id]);
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '用户在当前企业中不存在' });
    }

    // 记录删除用户关联日志
    await logAudit(req, {
      action_type: 'delete',
      module: 'users',
      resource_type: 'user_tenant_role',
      resource_id: parseInt(id),
      resource_name: users[0].real_name || users[0].username,
      action_description: `删除用户与企业的关联：${users[0].real_name || users[0].username} (${users[0].username})`,
      old_value: {
        user: users[0],
        tenant_id: req.user.tenant_id,
        deleted_at: new Date().toISOString(),
      },
      response_status: 200,
    });

    res.json({ success: true, message: '用户与企业的关联已删除' });
  } catch (error) {
    console.error('删除用户关联失败:', error);
    res.status(500).json({ success: false, message: '删除用户关联失败', error: error.message });
  }
});

// 获取用户在所有企业的角色列表
router.get('/:id/roles', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查用户是否存在
    const [users] = await db.execute('SELECT id FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    let userRoles;
    if (req.user.role === 'super_admin') {
      // 超级管理员可以查看用户在所有企业的角色列表
      [userRoles] = await db.execute(
        `SELECT ur.id, ur.user_id, ur.tenant_id, ur.role, ur.is_default, ur.status,
                t.tenant_name, t.tenant_code
         FROM user_tenant_roles ur
         LEFT JOIN tenants t ON ur.tenant_id = t.id
         WHERE ur.user_id = ?`,
        [id],
      );
    } else {
      // 系统管理员只能查看用户在当前企业的角色列表
      [userRoles] = await db.execute(
        `SELECT ur.id, ur.user_id, ur.tenant_id, ur.role, ur.is_default, ur.status,
                t.tenant_name, t.tenant_code
         FROM user_tenant_roles ur
         LEFT JOIN tenants t ON ur.tenant_id = t.id
         WHERE ur.user_id = ? AND ur.tenant_id = ?`,
        [id, req.user.tenant_id],
      );
    }

    res.json({
      success: true,
      data: userRoles,
    });
  } catch (error) {
    console.error('获取用户角色列表失败:', error);
    res.status(500).json({ success: false, message: '获取用户角色列表失败', error: error.message });
  }
});

// 批量分配用户角色
router.post('/batch/roles', authenticate, requireSystemAdmin, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { user_ids, tenant_id, role } = req.body;

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ success: false, message: '请提供要分配的用户ID列表' });
    }

    if (user_ids.length > 200) {
      return res.status(400).json({ success: false, message: '单次最多批量分配200个用户' });
    }

    if (!tenant_id) {
      return res.status(400).json({ success: false, message: '请提供企业ID' });
    }

    if (!role) {
      return res.status(400).json({ success: false, message: '请提供角色' });
    }

    if (role === 'super_admin') {
      return res.status(400).json({ success: false, message: '禁止通过租户角色分配 super_admin' });
    }

    // 系统管理员只能操作自己租户
    if (req.user.role === 'system_admin' && tenant_id !== req.user.tenant_id) {
      return res.status(403).json({ success: false, message: '只能操作自己租户下的用户角色' });
    }

    // 角色级别限制
    if (req.user.role === 'system_admin') {
      const roleLevels = {
        super_admin: 100, system_admin: 90, asset_admin: 70,
        metrology_admin: 65, quality_admin: 65, maintenance_admin: 65,
        acceptance_admin: 65, transfer_admin: 65, inventory_admin: 65,
        department_admin: 60, user: 10,
      };
      const currentUserLevel = roleLevels[req.user.role] || 0;
      const targetRoleLevel = roleLevels[role] || 0;
      if (targetRoleLevel >= currentUserLevel) {
        return res.status(403).json({
          success: false,
          message: '无权分配该角色，只能分配低于自己级别的角色',
        });
      }
    }

    // 检查企业是否存在
    const [tenants] = await connection.execute('SELECT id, tenant_name FROM tenants WHERE id = ?', [tenant_id]);
    if (tenants.length === 0) {
      return res.status(404).json({ success: false, message: '企业不存在' });
    }
    const tenant = tenants[0];

    await connection.beginTransaction();

    let successCount = 0;
    const errors = [];

    for (const userId of user_ids) {
      try {
        // 检查用户是否存在
        const [users] = await connection.execute('SELECT id, username, real_name FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
          errors.push({ user_id: userId, message: '用户不存在' });
          continue;
        }

        // 获取旧角色
        const [existingRoles] = await connection.execute(
          'SELECT role FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
          [userId, tenant_id],
        );

        if (existingRoles.length > 0) {
          await connection.execute(
            'UPDATE user_tenant_roles SET role = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND tenant_id = ?',
            [role, 'active', userId, tenant_id],
          );
        } else {
          await connection.execute(
            'INSERT INTO user_tenant_roles (user_id, tenant_id, role, is_default, status, created_at) VALUES (?, ?, ?, 0, ?, NOW())',
            [userId, tenant_id, role, 'active'],
          );
        }

        successCount++;
      } catch (innerError) {
        errors.push({ user_id: userId, message: innerError.message });
      }
    }

    await connection.commit();

    // 记录审计日志
    await logAudit(req, {
      action_type: 'BATCH_ASSIGN_USER_ROLE',
      module: 'user-management',
      resource_type: 'user_role_batch',
      resource_name: `${user_ids.length}个用户`,
      action_description: `批量分配角色: ${user_ids.length}个用户在 ${tenant.tenant_name} 的角色设为 ${role}，成功 ${successCount}，失败 ${errors.length}`,
      new_value: JSON.stringify({ user_ids, tenant_id, role, successCount, errors }),
      response_status: 200,
    });

    res.json({
      success: true,
      message: `批量分配完成：成功 ${successCount} 个，失败 ${errors.length} 个`,
      data: { success_count: successCount, total: user_ids.length, errors },
    });

  } catch (error) {
    await connection.rollback();
    console.error('批量分配角色失败:', error);
    res.status(500).json({ success: false, message: '批量分配角色失败', error: error.message });
  } finally {
    connection.release();
  }
});

// 为用户添加/更新在某个企业的角色
router.post('/:id/roles', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, role, is_default } = req.body;

    if (role === 'super_admin') {
      return res.status(400).json({ success: false, message: '禁止通过租户角色分配 super_admin' });
    }

    // 检查用户是否存在
    const [users] = await db.execute('SELECT id, username, real_name FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const targetUser = users[0];

    // 系统管理员只能操作自己租户下的用户角色
    if (req.user.role === 'system_admin' && tenant_id !== req.user.tenant_id) {
      return res.status(403).json({ success: false, message: '只能操作自己租户下的用户角色' });
    }

    // 角色级别限制：system_admin 只能分配低于自己级别的角色
    if (req.user.role === 'system_admin') {
      const roleLevels = {
        super_admin: 100,
        system_admin: 90,
        asset_admin: 70,
        metrology_admin: 65,
        quality_admin: 65,
        maintenance_admin: 65,
        acceptance_admin: 65,
        transfer_admin: 65,
        inventory_admin: 65,
        department_admin: 60,
        user: 10,
      };

      const currentUserLevel = roleLevels[req.user.role] || 0;
      const targetRoleLevel = roleLevels[role] || 0;

      if (targetRoleLevel >= currentUserLevel) {
        return res.status(403).json({
          success: false,
          message: '无权分配该角色，只能分配低于自己级别的角色',
          details: {
            current_role: req.user.role,
            current_level: currentUserLevel,
            target_role: role,
            target_level: targetRoleLevel,
          },
        });
      }
    }

    // 检查企业是否存在
    const [tenants] = await db.execute('SELECT id, tenant_name FROM tenants WHERE id = ?', [tenant_id]);
    if (tenants.length === 0) {
      return res.status(404).json({ success: false, message: '企业不存在' });
    }

    const tenant = tenants[0];

    // 获取旧角色信息用于审计
    const [existingRoles] = await db.execute(
      'SELECT role, is_default FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
      [id, tenant_id],
    );

    const oldRole = existingRoles.length > 0 ? existingRoles[0].role : null;
    const isUpdate = existingRoles.length > 0;

    // 如果设置为默认角色，先取消其他默认角色
    if (is_default) {
      await db.execute('UPDATE user_tenant_roles SET is_default = 0 WHERE user_id = ?', [id]);
    }

    if (isUpdate) {
      // 更新现有记录 - 确保status字段被正确处理
      await db.execute(
        `UPDATE user_tenant_roles SET role = ?,
                is_default = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND tenant_id = ?`,
        [role, is_default ? 1 : 0, 'active', id, tenant_id],
      );
    } else {
      // 添加新记录
      await db.execute(
        `INSERT INTO user_tenant_roles (user_id, tenant_id, role, is_default, status, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [id, tenant_id, role, is_default ? 1 : 0, 'active'],
      );
    }

    // 记录审计日志
    await logAudit(req, {
      action_type: isUpdate ? 'UPDATE_USER_ROLE' : 'CREATE_USER_ROLE',
      module: 'user-management',
      resource_type: 'user_role',
      resource_id: id,
      resource_name: `${targetUser.username}(${targetUser.real_name})`,
      action_description: `${isUpdate ? '更新' : '分配'}用户角色: ${targetUser.username} 在 ${tenant.tenant_name} 的角色从 ${oldRole || '无'} 变更为 ${role}`,
      old_value: oldRole ? JSON.stringify({ role: oldRole, tenant_id, is_default: existingRoles[0]?.is_default }) : null,
      new_value: JSON.stringify({ role, tenant_id, is_default: is_default ? 1 : 0 }),
      response_status: 200,
    });

    res.json({ success: true, message: isUpdate ? '用户角色更新成功' : '用户角色添加成功' });
  } catch (error) {
    console.error('更新用户角色失败:', error);
    res.status(500).json({ success: false, message: '更新用户角色失败', error: error.message });
  }
});

// 删除用户在某个企业的角色
router.delete('/:id/roles/:tenantId', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { id, tenantId } = req.params;

    // 系统管理员只能删除自己租户下的用户角色
    if (req.user.role === 'system_admin' && parseInt(tenantId) !== req.user.tenant_id) {
      return res.status(403).json({ success: false, message: '只能删除自己租户下的用户角色' });
    }

    // 删除用户在该企业的角色
    const [result] = await db.execute(
      'DELETE FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (result.affectedRows > 0) {
      res.json({ success: true, message: '用户角色删除成功' });
    } else {
      res.status(404).json({ success: false, message: '用户角色不存在' });
    }
  } catch (error) {
    console.error('删除用户角色失败:', error);
    res.status(500).json({ success: false, message: '删除用户角色失败', error: error.message });
  }
});

module.exports = router;
module.exports.validatePassword = validatePassword;
module.exports.normalizeUsername = normalizeUsername;
module.exports.isReservedUsername = isReservedUsername;
module.exports.isUsernameTaken = isUsernameTaken;
module.exports.__test__ = {
  validatePassword,
  normalizeUsername,
  isReservedUsername,
  isUsernameTaken,
  consumeSmsVerificationCode,
};
