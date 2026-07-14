const crypto = require('crypto');
const { getDatabase } = require('../../../core/DatabaseInterface');
const { getEventBus } = require('../../../core/EventBus');
const userService = require('../services/user.service');
const { logAudit } = require('../../../middleware/auditLogger');

const db = getDatabase();
const eventBus = getEventBus();

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

// 密码复杂度验证函数
function validatePassword(password) {
  const errors = [];
  if (!password || password.length < 8) errors.push('密码长度至少为8位');
  if (!/[A-Z]/.test(password)) errors.push('密码必须包含至少一个大写字母');
  if (!/[a-z]/.test(password)) errors.push('密码必须包含至少一个小写字母');
  if (!/[0-9]/.test(password)) errors.push('密码必须包含至少一个数字');
  if (!/[!@#$%^&*()_+\-={}[\]:;'"|,.<>/?]/.test(password)) {
    errors.push('密码必须包含至少一个特殊字符');
  }
  return { valid: errors.length === 0, errors };
}

// 数据库查询辅助函数（带重试机制）
async function executeQuery(query, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await db.execute(query, params);
      return result;
    } catch (error) {
      if (error.code === 'PROTOCOL_CONNECTION_LOST' && i < retries - 1) {
        console.log(`数据库连接丢失，正在重试 (${i + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}

const RESERVED_USERNAMES = new Set(['suadmin', 'super_admin', 'system_admin', 'root', 'admin']);
const normalizeUsername = username => typeof username === 'string' ? username.trim() : username;

async function isUsernameTaken(username) {
  const normalized = normalizeUsername(username);
  const [existingUsers] = await executeQuery('SELECT id FROM users WHERE username = ? LIMIT 1', [normalized]);
  if (existingUsers.length > 0) return true;
  const [existingSuperUsers] = await executeQuery('SELECT id FROM super_users WHERE username = ? LIMIT 1', [normalized]);
  return existingSuperUsers.length > 0;
}

class UserController {
  constructor() {
    this.db = db;
    this.eventBus = eventBus;
    this.userService = new userService({ db, eventBus });
  }

  async login(req, res) {
    const bcrypt = require('bcryptjs');
    const { generateToken } = require('../../../middleware/auth');
    const appConfig = require('../../../config/app.config');
    const loginTokenExpiry = Number.parseInt(String(appConfig?.jwt?.expiresIn || ''), 10) || 24 * 60 * 60;

    try {
      const username = normalizeUsername(req.body?.username);
      const { password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
      }

      // 优先检查超级管理员
      const superResult = await executeQuery(
        'SELECT id, username, password, real_name, email, phone, status FROM super_users WHERE username = ?',
        [username],
      );
      const superUsers = Array.isArray(superResult) ? (superResult[0] || []) : [];

      if (superUsers.length > 0) {
        const superUser = superUsers[0];
        if (!superUser.password || typeof superUser.password !== 'string') {
          return res.status(401).json({ success: false, message: '用户名或密码错误' });
        }

        const isPasswordValid = await bcrypt.compare(password, superUser.password);
        if (!isPasswordValid) {
          return res.status(401).json({ success: false, message: '用户名或密码错误' });
        }

        if (superUser.status !== 'active') {
          return res.status(401).json({ success: false, message: '用户名或密码错误' });
        }

        await executeQuery(
          'UPDATE super_users SET last_login_at = CURRENT_TIMESTAMP, login_count = login_count + 1 WHERE id = ?',
          [superUser.id],
        );

        const token = generateToken({
          id: superUser.id,
          username: superUser.username,
          real_name: superUser.real_name,
          department_code: null,
          role: 'super_admin',
          tenant_id: null,
        });

        req.user = { id: superUser.id, username: superUser.username, real_name: superUser.real_name, role: 'super_admin' };

        await logAudit(req, {
          action_type: 'login',
          module: 'users',
          resource_type: 'super_user',
          resource_id: superUser.id,
          resource_name: superUser.real_name || superUser.username,
          action_description: `超级管理员登录：${superUser.real_name || superUser.username}`,
          response_status: 200,
        });

        const entResult = await executeQuery(
          'SELECT id, tenant_code, tenant_name, status, created_at FROM tenants WHERE status = ? ORDER BY created_at DESC',
          ['active'],
        );
        const enterprises = Array.isArray(entResult) ? (entResult[0] || []) : [];

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
            enterprises: enterprises.map(e => ({ ...e, role: 'super_admin' })),
          },
        });
      }

      // 普通用户登录
      const usersResult = await executeQuery(
        'SELECT id, username, password, real_name, status FROM users WHERE username = ?',
        [username],
      );
      const users = Array.isArray(usersResult) ? (usersResult[0] || []) : [];

      if (users.length === 0) {
        return res.status(401).json({ success: false, message: '用户名或密码错误' });
      }

      const user = users[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid || user.status !== 'active') {
        return res.status(401).json({ success: false, message: '用户名或密码错误' });
      }

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
        return res.status(403).json({ success: false, message: '用户未分配可用企业角色，请联系管理员' });
      }

      const enterprises = userTenantRoles;
      const defaultTenant = enterprises[0];

      user.tenant_id = defaultTenant.id;
      user.tenant_name = defaultTenant.tenant_name;
      user.role = defaultTenant.role || 'user';

      const token = generateToken(user);

      let managedDepartments = [];
      if (user.role === 'system_admin' && user.tenant_id) {
        try {
          const deptResult = await db.execute('SELECT department_code FROM departments WHERE tenant_id = ?', [user.tenant_id]);
          const allDepartments = Array.isArray(deptResult) ? (deptResult[0] || []) : [];
          managedDepartments = allDepartments.map(dept => dept.department_code);
        } catch (e) {
          console.error('获取所有科室失败:', e);
        }
      }

      req.user = { id: user.id, username: user.username, real_name: user.real_name, role: user.role };

      await logAudit(req, {
        action_type: 'login',
        module: 'users',
        resource_type: 'user',
        resource_id: user.id,
        resource_name: user.real_name || user.username,
        action_description: `用户登录：${user.real_name || user.username} - 默认企业：${user.tenant_name}`,
        response_status: 200,
      }, { tenantId: user.tenant_id });

      let defaultRoute = '/dashboard';
      if (user.role === 'super_admin') defaultRoute = '/tenants';
      else if (user.role === 'system_admin') defaultRoute = '/users';

      const warnings = [];
      if (['system_admin', 'asset_admin', 'department_admin'].includes(user.role) && user.tenant_id) {
        try {
          const [unconfiguredResult] = await executeQuery(
            `SELECT COUNT(*) as count
             FROM users u
             WHERE u.tenant_id = ? AND u.status = 'active'
             AND NOT EXISTS (
               SELECT 1 FROM user_tenant_roles utr 
               WHERE utr.user_id = u.id AND utr.tenant_id = u.tenant_id AND utr.status = 'active'
             )`,
            [user.tenant_id],
          );
          const unconfiguredCount = unconfiguredResult?.[0]?.count || 0;
          if (unconfiguredCount > 0) {
            warnings.push({
              type: 'unconfigured_users',
              message: `您有 ${unconfiguredCount} 个用户尚未配置角色权限，请及时处理`,
              count: unconfiguredCount,
            });
          }
        } catch (e) {
          console.error('检查未配置权限用户失败:', e);
        }
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
          defaultRoute,
          tokenExpiry: loginTokenExpiry,
          enterprises: enterprises.map(e => ({ ...e, role: e.role || 'user' })),
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    } catch (err) {
      const errorMessage = (err && typeof err.message === 'string' ? err.message : String(err || 'Unknown error')).slice(0, 200);
      console.error('用户登录失败:', errorMessage);
      if (err && err.code === 'PROTOCOL_CONNECTION_LOST') {
        return res.status(503).json({ success: false, message: '数据库连接失败，请稍后重试' });
      }
      res.status(500).json({ success: false, message: '登录失败，请稍后重试', error: errorMessage });
    }
  }

  async getUsers(req, res) {
    try {
      const { page, pageSize, keyword, role, status } = req.query;
      const tenantId = req.user.tenant_id;

      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const result = await this.userService.listUsers(tenantId, { page, pageSize, keyword, role });

      const warnings = [];
      try {
        const [unconfiguredResult] = await executeQuery(
          `SELECT COUNT(*) as count
           FROM users u
           WHERE u.tenant_id = ? AND u.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM user_tenant_roles utr 
             WHERE utr.user_id = u.id AND utr.tenant_id = u.tenant_id AND utr.status = 'active'
           )`,
          [tenantId],
        );
        const unconfiguredCount = unconfiguredResult?.[0]?.count || 0;
        if (unconfiguredCount > 0) {
          warnings.push({
            type: 'unconfigured_users',
            message: `有 ${unconfiguredCount} 个用户尚未配置角色权限`,
            count: unconfiguredCount,
          });
        }
      } catch (e) {
        console.error('检查未配置权限用户失败:', e);
      }

      res.json({ 
        success: true, 
        ...result,
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    } catch (error) {
      console.error('获取用户列表失败:', error);
      res.status(500).json({ success: false, message: '获取用户列表失败', error: error.message });
    }
  }

  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;
      const user = await this.userService.getUserById(id, tenantId);
      res.json({ success: true, data: user });
    } catch (error) {
      console.error('获取用户详情失败:', error);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async createUser(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const userData = req.body;
      const result = await this.userService.createUser(tenantId, userData);

      const warnings = [];
      if (!userData.role) {
        warnings.push({
          type: 'missing_role',
          message: '新用户尚未分配角色，请及时为用户分配适当角色以获取系统权限',
        });
      }

      res.json({ 
        success: true, 
        message: '用户创建成功', 
        data: result,
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    } catch (error) {
      console.error('创建用户失败:', error);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;
      const userData = req.body;
      const result = await this.userService.updateUser(id, tenantId, userData);

      const warnings = [];
      if (userData.role) {
        const { ROLE_DISPLAY_NAMES } = require('../../../config/roles.config');
        const roleName = ROLE_DISPLAY_NAMES[userData.role] || userData.role;
        warnings.push({
          type: 'role_updated',
          message: `用户角色已更新为「${roleName}」，相关权限将立即生效`,
        });
      }

      res.json({ 
        success: true, 
        message: '用户更新成功', 
        data: result,
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    } catch (error) {
      console.error('更新用户失败:', error);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;
      await this.userService.deleteUser(id, tenantId);
      res.json({ success: true, message: '用户删除成功' });
    } catch (error) {
      console.error('删除用户失败:', error);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async batchAssignRole(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const { user_ids, role } = req.body;
      const result = await this.userService.batchAssignRole(tenantId, { user_ids, role });

      const message = result.skipped_count > 0
        ? `已成功为 ${result.assigned_count} 个用户分配角色，跳过 ${result.skipped_count} 个无效用户`
        : `已成功为 ${result.assigned_count} 个用户分配角色`;

      res.json({ success: true, message, data: result });
    } catch (error) {
      console.error('批量分配角色失败:', error);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async changePassword(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;
      const { oldPassword, newPassword } = req.body;
      await this.userService.changePassword(id, tenantId, { oldPassword, newPassword });
      res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
      console.error('修改密码失败:', error);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async getProfile(req, res) {
    try {
      const {user} = req;
      res.json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          real_name: user.real_name,
          role: user.role,
          tenant_id: user.tenant_id,
          managed_departments: user.managed_departments,
        },
      });
    } catch (error) {
      console.error('获取用户信息失败:', error);
      res.status(500).json({ success: false, message: '获取用户信息失败', error: error.message });
    }
  }

  async getRoles(req, res) {
    try {
      const { ALL_ROLES, ROLE_DISPLAY_NAMES } = require('../../../config/roles.config');
      const userRole = req.user?.role;

      let roles = ALL_ROLES.map(roleCode => ({
        value: roleCode,
        label: ROLE_DISPLAY_NAMES[roleCode] || roleCode,
      }));

      if (userRole === 'system_admin') {
        roles = roles.filter(r => r.value !== 'super_admin');
      }

      res.json({ success: true, data: roles });
    } catch (error) {
      console.error('获取角色列表失败:', error);
      const { ALL_ROLES, ROLE_DISPLAY_NAMES } = require('../../../config/roles.config');
      res.json({ success: true, data: ALL_ROLES.map(r => ({ value: r, label: ROLE_DISPLAY_NAMES[r] || r })) });
    }
  }

  async getPendingRoleRequests(req, res) {
    try {
      const [requests] = await executeQuery(
        `SELECT ur.id, u.username, u.real_name, u.email, u.phone, ur.role, ur.created_at
         FROM user_tenant_roles ur
         INNER JOIN users u ON ur.user_id = u.id
         WHERE ur.tenant_id = ? AND ur.status = "pending"
         ORDER BY ur.created_at DESC`,
        [req.user.tenant_id],
      );
      res.json({ success: true, data: requests || [] });
    } catch (error) {
      console.error('获取待审核请求失败:', error);
      res.status(500).json({ success: false, message: '获取失败', error: error.message });
    }
  }

  async approveRoleRequest(req, res) {
    try {
      const { id } = req.params;
      const { approved } = req.body;

      const [requests] = await executeQuery(
        `SELECT ur.id, ur.user_id, ur.tenant_id FROM user_tenant_roles ur
         WHERE ur.id = ? AND ur.status = "pending" AND ur.tenant_id = ?`,
        [id, req.user.tenant_id],
      );

      if (!requests || requests.length === 0) {
        return res.status(404).json({ success: false, message: '请求不存在' });
      }

      if (approved) {
        await executeQuery(
          'UPDATE user_tenant_roles SET status = "active", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [id],
        );
        res.json({ success: true, message: '批准成功' });
      } else {
        await executeQuery('DELETE FROM user_tenant_roles WHERE id = ?', [id]);
        res.json({ success: true, message: '已拒绝' });
      }
    } catch (error) {
      console.error('审核请求失败:', error);
      res.status(500).json({ success: false, message: '审核失败', error: error.message });
    }
  }

  async register(req, res) {
    const bcrypt = require('bcryptjs');
    const { generateToken } = require('../../../middleware/auth');
    const appConfig = require('../../../config/app.config');
    const loginTokenExpiry = Number.parseInt(String(appConfig?.jwt?.expiresIn || ''), 10) || 24 * 60 * 60;

    try {
      const username = normalizeUsername(req.body?.username);
      const { password, real_name, email, phone } = req.body;

      if (!username || !password) {
        return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
      }

      if (RESERVED_USERNAMES.has(username.toLowerCase())) {
        return res.status(400).json({ success: false, message: '该用户名为系统保留名称，不可注册' });
      }

      const { valid, errors } = validatePassword(password);
      if (!valid) {
        return res.status(400).json({ success: false, message: errors.join('；') });
      }

      const taken = await isUsernameTaken(username);
      if (taken) {
        return res.status(400).json({ success: false, message: '用户名已被占用' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await executeQuery(
        'INSERT INTO users (username, password, real_name, email, phone, status) VALUES (?, ?, ?, ?, ?, "active")',
        [username, hashedPassword, real_name || null, email || null, phone || null],
      );

      const userId = result.insertId;

      // 分配默认角色（user）
      await executeQuery(
        'INSERT INTO user_tenant_roles (user_id, tenant_id, role, status, is_default) VALUES (?, ?, "user", "active", 1)',
        [userId, req.body.tenant_id || null],
      );

      const token = generateToken({
        id: userId,
        username,
        real_name: real_name || null,
        department_code: null,
        role: 'user',
        tenant_id: req.body.tenant_id || null,
      });

      res.status(201).json({
        success: true,
        message: '注册成功',
        data: {
          user: {
            id: userId,
            username,
            real_name: real_name || null,
            role: 'user',
            status: 'active',
            tenant_id: req.body.tenant_id || null,
          },
          token,
          tokenExpiry: loginTokenExpiry,
        },
        warnings: [
          {
            type: 'default_role',
            message: '您的账户已分配默认角色（普通用户），请联系系统管理员分配更合适的角色权限',
          },
        ],
      });
    } catch (err) {
      const errorMessage = (err && typeof err.message === 'string' ? err.message : String(err || 'Unknown error')).slice(0, 200);
      console.error('用户注册失败:', errorMessage);
      res.status(500).json({ success: false, message: '注册失败，请稍后重试', error: errorMessage });
    }
  }

  async refreshToken(req, res) {
    const { generateToken } = require('../../../middleware/auth');
    const appConfig = require('../../../config/app.config');
    const loginTokenExpiry = Number.parseInt(String(appConfig?.jwt?.expiresIn || ''), 10) || 24 * 60 * 60;

    try {
      const user = req.user;
      if (!user || !user.id) {
        return res.status(401).json({ success: false, message: '无效的用户信息' });
      }

      const token = generateToken({
        id: user.id,
        username: user.username,
        real_name: user.real_name,
        department_code: user.department_code || null,
        role: user.role,
        tenant_id: user.tenant_id,
      });

      res.json({
        success: true,
        message: 'Token刷新成功',
        data: { token, tokenExpiry: loginTokenExpiry },
      });
    } catch (err) {
      const errorMessage = (err && typeof err.message === 'string' ? err.message : String(err || 'Unknown error')).slice(0, 200);
      console.error('刷新Token失败:', errorMessage);
      res.status(500).json({ success: false, message: '刷新Token失败', error: errorMessage });
    }
  }

  async joinEnterprise(req, res) {
    try {
      const userId = req.user.id;
      const { tenant_id, role } = req.body;

      if (!tenant_id) {
        return res.status(400).json({ success: false, message: '缺少企业ID' });
      }

      // 检查企业是否存在且状态正常
      const [tenants] = await executeQuery(
        'SELECT id, tenant_name FROM tenants WHERE id = ? AND status = "active"',
        [tenant_id],
      );
      if (!tenants || tenants.length === 0) {
        return res.status(404).json({ success: false, message: '企业不存在或已停用' });
      }

      // 检查是否已加入该企业
      const [existing] = await executeQuery(
        'SELECT id, status FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
        [userId, tenant_id],
      );
      if (existing && existing.length > 0) {
        const existingStatus = existing[0].status;
        if (existingStatus === 'active') {
          return res.status(400).json({ success: false, message: '您已加入该企业' });
        }
        if (existingStatus === 'pending') {
          return res.status(400).json({ success: false, message: '您已提交申请，请等待审核' });
        }
      }

      // 创建加入申请（status=pending）
      const requestedRole = role || 'user';
      await executeQuery(
        'INSERT INTO user_tenant_roles (user_id, tenant_id, role, status, is_default) VALUES (?, ?, ?, "pending", 0)',
        [userId, tenant_id, requestedRole],
      );

      // 通知系统管理员有新用户加入申请
      try {
        const [adminResult] = await executeQuery(
          `SELECT u.id, u.username, u.real_name 
           FROM users u 
           INNER JOIN user_tenant_roles utr ON u.id = utr.user_id AND utr.tenant_id = ? AND utr.role = 'system_admin' AND utr.status = 'active'
           WHERE u.status = 'active'`,
          [tenant_id],
        );
        if (adminResult && adminResult.length > 0) {
          const { getEventBus } = require('../../../core/EventBus');
          getEventBus().emit('notification:role_request', {
            tenant_id,
            user_id: userId,
            requested_role: requestedRole,
            admins: adminResult.map(a => a.id),
            message: `新用户申请加入企业，申请角色: ${requestedRole}，请及时审核`,
          });
        }
      } catch (e) {
        console.error('通知管理员失败:', e);
      }

      res.json({ 
        success: true, 
        message: '加入企业申请已提交，请等待审核',
        warnings: [
          {
            type: 'pending_approval',
            message: '您的申请需要系统管理员审核通过后才能使用系统功能',
          },
        ],
      });
    } catch (err) {
      const errorMessage = (err && typeof err.message === 'string' ? err.message : String(err || 'Unknown error')).slice(0, 200);
      console.error('加入企业失败:', errorMessage);
      res.status(500).json({ success: false, message: '加入企业失败', error: errorMessage });
    }
  }

  async getPendingUsers(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const [pendingUsers] = await executeQuery(
        `SELECT ur.id, u.username, u.real_name, u.email, u.phone, ur.role, ur.created_at
         FROM user_tenant_roles ur
         INNER JOIN users u ON ur.user_id = u.id
         WHERE ur.tenant_id = ? AND ur.status = "pending"
         ORDER BY ur.created_at DESC`,
        [tenantId],
      );

      res.json({ success: true, data: pendingUsers || [] });
    } catch (err) {
      const errorMessage = (err && typeof err.message === 'string' ? err.message : String(err || 'Unknown error')).slice(0, 200);
      console.error('获取待审核用户失败:', errorMessage);
      res.status(500).json({ success: false, message: '获取待审核用户失败', error: errorMessage });
    }
  }

  async approveUser(req, res) {
    try {
      const { id } = req.params;
      const { approved } = req.body;
      const tenantId = req.user.tenant_id;

      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const [requests] = await executeQuery(
        'SELECT id, user_id FROM user_tenant_roles WHERE id = ? AND tenant_id = ? AND status = "pending"',
        [id, tenantId],
      );

      if (!requests || requests.length === 0) {
        return res.status(404).json({ success: false, message: '待审核记录不存在' });
      }

      if (approved) {
        await executeQuery(
          'UPDATE user_tenant_roles SET status = "active", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [id],
        );
        res.json({ success: true, message: '用户已批准' });
      } else {
        await executeQuery('DELETE FROM user_tenant_roles WHERE id = ?', [id]);
        res.json({ success: true, message: '已拒绝该用户' });
      }
    } catch (err) {
      const errorMessage = (err && typeof err.message === 'string' ? err.message : String(err || 'Unknown error')).slice(0, 200);
      console.error('审批用户失败:', errorMessage);
      res.status(500).json({ success: false, message: '审批用户失败', error: errorMessage });
    }
  }

  async getUnconfiguredUsers(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const users = await this.userService.getUnconfiguredUsers(tenantId);
      res.json({ success: true, data: users });
    } catch (err) {
      const errorMessage = (err && typeof err.message === 'string' ? err.message : String(err || 'Unknown error')).slice(0, 200);
      console.error('获取未配置权限用户失败:', errorMessage);
      res.status(500).json({ success: false, message: '获取未配置权限用户失败', error: errorMessage });
    }
  }

  async getUserRoleStats(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const stats = await this.userService.getUserRoleStats(tenantId);
      res.json({ success: true, data: stats });
    } catch (err) {
      const errorMessage = (err && typeof err.message === 'string' ? err.message : String(err || 'Unknown error')).slice(0, 200);
      console.error('获取用户角色统计失败:', errorMessage);
      res.status(500).json({ success: false, message: '获取用户角色统计失败', error: errorMessage });
    }
  }

  // 获取用户在各企业的角色列表
  async getUserRoles(req, res) {
    try {
      const { id } = req.params;

      const [users] = await executeQuery('SELECT id FROM users WHERE id = ?', [id]);
      if (!users || users.length === 0) {
        return res.status(404).json({ success: false, message: '用户不存在' });
      }

      let userRoles;
      if (req.user.role === 'super_admin') {
        // 超级管理员可查看用户在所有企业的角色
        [userRoles] = await executeQuery(
          `SELECT ur.id, ur.user_id, ur.tenant_id, ur.role, ur.is_default, ur.status,
                  t.tenant_name, t.tenant_code
           FROM user_tenant_roles ur
           LEFT JOIN tenants t ON ur.tenant_id = t.id
           WHERE ur.user_id = ?`,
          [id],
        );
      } else {
        // 系统管理员只能查看用户在当前企业的角色
        [userRoles] = await executeQuery(
          `SELECT ur.id, ur.user_id, ur.tenant_id, ur.role, ur.is_default, ur.status,
                  t.tenant_name, t.tenant_code
           FROM user_tenant_roles ur
           LEFT JOIN tenants t ON ur.tenant_id = t.id
           WHERE ur.user_id = ? AND ur.tenant_id = ?`,
          [id, req.user.tenant_id],
        );
      }

      res.json({ success: true, data: userRoles || [] });
    } catch (error) {
      console.error('获取用户角色列表失败:', error);
      res.status(500).json({ success: false, message: '获取用户角色列表失败', error: error.message });
    }
  }

  // 为用户添加/更新在某个企业的角色
  async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { tenant_id, role, is_default } = req.body;

      if (role === 'super_admin') {
        return res.status(400).json({ success: false, message: '禁止通过租户角色分配 super_admin' });
      }

      // 检查用户是否存在
      const [users] = await executeQuery('SELECT id, username, real_name FROM users WHERE id = ?', [id]);
      if (!users || users.length === 0) {
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
            details: { current_role: req.user.role, target_role: role },
          });
        }
      }

      // 检查企业是否存在
      const [tenants] = await executeQuery('SELECT id, tenant_name FROM tenants WHERE id = ?', [tenant_id]);
      if (!tenants || tenants.length === 0) {
        return res.status(404).json({ success: false, message: '企业不存在' });
      }
      const tenant = tenants[0];

      // 获取旧角色信息
      const [existingRoles] = await executeQuery(
        'SELECT role, is_default FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
        [id, tenant_id],
      );
      const oldRole = existingRoles && existingRoles.length > 0 ? existingRoles[0].role : null;
      const isUpdate = existingRoles && existingRoles.length > 0;

      // 如果设置为默认角色，先取消其他默认角色
      if (is_default) {
        await executeQuery('UPDATE user_tenant_roles SET is_default = 0 WHERE user_id = ?', [id]);
      }

      if (isUpdate) {
        await executeQuery(
          `UPDATE user_tenant_roles SET role = ?, is_default = ?, status = ?, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ? AND tenant_id = ?`,
          [role, is_default ? 1 : 0, 'active', id, tenant_id],
        );
      } else {
        await executeQuery(
          `INSERT INTO user_tenant_roles (user_id, tenant_id, role, is_default, status, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [id, tenant_id, role, is_default ? 1 : 0, 'active'],
        );
      }

      // 记录审计日志
      try {
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
      } catch (auditErr) {
        console.error('记录审计日志失败:', auditErr.message);
      }

      res.json({ success: true, message: isUpdate ? '用户角色更新成功' : '用户角色添加成功' });
    } catch (error) {
      console.error('更新用户角色失败:', error);
      res.status(500).json({ success: false, message: '更新用户角色失败', error: error.message });
    }
  }

  // 删除用户在某个企业的角色
  async deleteUserRole(req, res) {
    try {
      const { id, tenantId } = req.params;

      // 系统管理员只能删除自己租户下的用户角色
      if (req.user.role === 'system_admin' && parseInt(tenantId) !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: '只能删除自己租户下的用户角色' });
      }

      const [result] = await executeQuery(
        'DELETE FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
        [id, tenantId],
      );

      if (result && result.affectedRows > 0) {
        res.json({ success: true, message: '用户角色删除成功' });
      } else {
        res.status(404).json({ success: false, message: '用户角色不存在' });
      }
    } catch (error) {
      console.error('删除用户角色失败:', error);
      res.status(500).json({ success: false, message: '删除用户角色失败', error: error.message });
    }
  }
}

module.exports = new UserController();
