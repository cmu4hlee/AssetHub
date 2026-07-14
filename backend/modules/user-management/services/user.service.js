const BaseService = require('../../../core/BaseService');
const { AppError } = require('../../../utils/error-handler');
const bcrypt = require('bcryptjs');
const { ALL_ROLES, isValidRole } = require('../../../config/roles.config');

const RESERVED_USERNAMES = new Set([
  'suadmin',
  'super_admin',
  'system_admin',
  'root',
  'admin',
]);

class UserService extends BaseService {
  constructor(options = {}) {
    super({ name: 'UserService', ...options });
  }

  normalizeUsername(username) {
    return typeof username === 'string' ? username.trim() : username;
  }

  isReservedUsername(username) {
    const normalized = this.normalizeUsername(username);
    return typeof normalized === 'string' && RESERVED_USERNAMES.has(normalized.toLowerCase());
  }

  async isUsernameTaken(username) {
    const normalized = this.normalizeUsername(username);
    const existingUsers = await this.findOne(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [normalized],
    );
    if (existingUsers) return true;

    const existingSuperUsers = await this.findOne(
      'SELECT id FROM super_users WHERE username = ? LIMIT 1',
      [normalized],
    );
    return !!existingSuperUsers;
  }

  validatePassword(password) {
    const errors = [];
    if (!password || password.length < 8) errors.push('密码长度至少为8位');
    if (!/[A-Z]/.test(password)) errors.push('密码必须包含至少一个大写字母');
    if (!/[a-z]/.test(password)) errors.push('密码必须包含至少一个小写字母');
    if (!/[0-9]/.test(password)) errors.push('密码必须包含至少一个数字');
    if (!/[!@#$%^&*()_+\-={}[\]:;'"|,.<>/?]/.test(password)) errors.push('密码必须包含至少一个特殊字符');
    return { valid: errors.length === 0, errors };
  }

  async listUsers(tenantId, { page = 1, pageSize = 20, keyword, role, status, sortBy = 'created_at', sortOrder = 'DESC' } = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    let whereClause = 'WHERE u.tenant_id = ?';
    const params = [tenantId];

    // 允许排序的字段白名单
    const allowedSortFields = ['created_at', 'updated_at', 'username', 'real_name', 'status'];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    if (keyword) {
      whereClause += ' AND (u.username LIKE ? OR u.real_name LIKE ? OR u.phone LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (role) {
      whereClause += ' AND utr.role = ?';
      params.push(role);
    }

    if (status) {
      whereClause += ' AND u.status = ?';
      params.push(status);
    }

    const countResult = await this.findOne(
      `SELECT COUNT(*) as total FROM users u LEFT JOIN user_tenant_roles utr ON u.id = utr.user_id AND utr.tenant_id = ? ${whereClause}`,
      [tenantId, ...params],
    );
    const {total} = countResult;

    // role 字段用 subquery 取用户默认租户的角色（跨租户），
    // utr JOIN 仍保留给 status/role 过滤用（语义保持原样：当前租户下）。
    // 修复：users.tenant_id 与 user_tenant_roles.tenant_id 不一致的历史数据，
    // 列表能正确显示默认角色，而不是显示 null。
    const users = await this.findMany(
      `SELECT u.id, u.username, u.real_name, u.phone, u.email,
              (SELECT role FROM user_tenant_roles
                WHERE user_id = u.id AND status = 'active'
                ORDER BY is_default DESC, id ASC
                LIMIT 1) AS role,
              u.department_code, u.tenant_id, u.status, u.created_at, u.updated_at
       FROM users u
       LEFT JOIN user_tenant_roles utr ON u.id = utr.user_id AND utr.tenant_id = ?
       ${whereClause}
       ORDER BY u.${orderField} ${orderDirection}
       LIMIT ? OFFSET ?`,
      [tenantId, ...params, parseInt(pageSize), offset],
    );

    return {
      data: users,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize)),
      },
    };
  }

  async getUserById(id, tenantId) {
    if (!tenantId || tenantId <= 0) {
      throw new AppError('无效的租户ID', 400, 'INVALID_TENANT_ID');
    }
    // 跨租户读取用户的"默认租户角色"：先取 is_default=1 的角色，没有再取最早分配的那一条。
    // 修复：当 users.tenant_id 与 user_tenant_roles.tenant_id 不一致时（历史数据），
    // 编辑页能正确显示当前角色，而不是显示 null。
    const user = await this.findOne(
      `SELECT u.id, u.username, u.real_name, u.phone, u.email,
              (SELECT role FROM user_tenant_roles
                WHERE user_id = u.id AND status = 'active'
                ORDER BY is_default DESC, id ASC
                LIMIT 1) AS role,
              (SELECT tenant_id FROM user_tenant_roles
                WHERE user_id = u.id AND status = 'active'
                ORDER BY is_default DESC, id ASC
                LIMIT 1) AS role_tenant_id,
              u.department_code, u.tenant_id, u.status, u.created_at, u.updated_at
       FROM users u
       WHERE u.id = ? AND u.tenant_id = ?`,
      [id, tenantId],
    );
    if (!user) {
      throw new AppError('用户不存在', 404, 'USER_NOT_FOUND');
    }
    return user;
  }

  async getUserByUsername(username) {
    const normalized = this.normalizeUsername(username);
    const user = await this.findOne(
      'SELECT * FROM users WHERE username = ? LIMIT 1',
      [normalized],
    );
    return user;
  }

  async getSuperUserByUsername(username) {
    const normalized = this.normalizeUsername(username);
    const user = await this.findOne(
      'SELECT * FROM super_users WHERE username = ? LIMIT 1',
      [normalized],
    );
    return user;
  }

  async createUser(tenantId, userData) {
    const { username, password, real_name, phone, email, role, department } = userData;

    if (!username || !password) {
      throw new AppError('用户名和密码不能为空', 400, 'MISSING_REQUIRED_FIELDS');
    }

    if (this.isReservedUsername(username)) {
      throw new AppError('该用户名为系统保留名称，不可使用', 400, 'RESERVED_USERNAME');
    }

    const taken = await this.isUsernameTaken(username);
    if (taken) {
      throw new AppError('用户名已存在', 409, 'USERNAME_TAKEN');
    }

    const validation = this.validatePassword(password);
    if (!validation.valid) {
      throw new AppError(validation.errors.join('; '), 400, 'INVALID_PASSWORD');
    }

    const userRole = role ?? 'user';
    if (!isValidRole(userRole)) {
      throw new AppError(`无效的角色: ${userRole}，请选择有效的系统角色`, 400, 'INVALID_ROLE');
    }

    if (userRole === 'super_admin') {
      throw new AppError('不允许通过此接口创建超级管理员', 400, 'FORBIDDEN_ROLE');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await this.execute(
      `INSERT INTO users (username, password, real_name, phone, email, department_code, tenant_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
      [
        this.normalizeUsername(username),
        hashedPassword,
        real_name ?? null,
        phone ?? null,
        email ?? null,
        userData.department_code ?? null,
        tenantId,
      ],
    );

    await this.execute(
      'INSERT INTO user_tenant_roles (user_id, tenant_id, role, status, created_at) VALUES (?, ?, ?, "active", NOW())',
      [result.insertId, tenantId, userRole],
    );

    this.emitEvent('user:created', { id: result.insertId, username, tenantId, role: userRole });
    return { id: result.insertId, username, real_name: real_name ?? null, role: userRole };
  }

  async updateUser(id, tenantId, userData) {
    const existingUser = await this.getUserById(id, tenantId);

    if (userData.role !== undefined) {
      if (!isValidRole(userData.role)) {
        throw new AppError(`无效的角色: ${userData.role}`, 400, 'INVALID_ROLE');
      }
      if (userData.role === 'super_admin') {
        throw new AppError('不允许通过此接口设置超级管理员角色', 400, 'FORBIDDEN_ROLE');
      }
    }

    const userFields = [];
    const userValues = [];
    const allowedUserFields = ['real_name', 'phone', 'email', 'department_code', 'status'];

    const roleFields = [];
    const roleValues = [];
    const allowedRoleFields = ['role'];

    for (const field of allowedUserFields) {
      if (userData[field] !== undefined) {
        userFields.push(`${field} = ?`);
        userValues.push(typeof userData[field] === 'object' ? JSON.stringify(userData[field]) : userData[field]);
      }
    }

    for (const field of allowedRoleFields) {
      if (userData[field] !== undefined) {
        roleFields.push(`${field} = ?`);
        roleValues.push(typeof userData[field] === 'object' ? JSON.stringify(userData[field]) : userData[field]);
      }
    }

    if (userFields.length === 0 && roleFields.length === 0) {
      throw new AppError('没有需要更新的字段', 400, 'NO_FIELDS_TO_UPDATE');
    }

    if (userFields.length > 0) {
      userValues.push(id, tenantId);
      const [result] = await this.execute(
        `UPDATE users SET ${userFields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
        userValues,
      );

      if (result.affectedRows === 0) {
        throw new AppError('用户更新失败', 500, 'UPDATE_FAILED');
      }
    }

    if (roleFields.length > 0) {
      // 修复：先尝试在当前操作者租户下查找角色记录；找不到时跨租户 fallback 到用户已有的任一角色记录。
      // 解决"角色更改不成功 没有保存"：当 users.tenant_id 与 user_tenant_roles.tenant_id 不一致时，
      // 之前 SQL WHERE user_id=? AND tenant_id=? 命中 0 行但 controller 仍返回 success，
      // 导致前端以为保存成功实际数据库无变化。
      const targetRoleRow = await this.findOne(
        `SELECT id, tenant_id, is_default FROM user_tenant_roles
         WHERE user_id = ? AND status = 'active'
         ORDER BY (tenant_id = ?) DESC, is_default DESC, id ASC
         LIMIT 1`,
        [id, tenantId],
      );

      if (!targetRoleRow) {
        throw new AppError(
          '该用户尚未分配租户角色，请先在"角色管理"中为用户分配角色',
          400,
          'NO_TENANT_ROLE',
        );
      }

      roleValues.push(id, targetRoleRow.tenant_id);
      const [roleResult] = await this.execute(
        `UPDATE user_tenant_roles SET ${roleFields.join(', ')}, updated_at = NOW() WHERE user_id = ? AND tenant_id = ?`,
        roleValues,
      );

      if (roleResult.affectedRows === 0) {
        throw new AppError('用户角色更新失败', 500, 'ROLE_UPDATE_FAILED');
      }
    }

    this.emitEvent('user:updated', { id, tenantId, old_value: existingUser });
    return { id };
  }

  async changePassword(id, tenantId, { oldPassword, newPassword }) {
    const user = await this.findOne(
      'SELECT id, password FROM users WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (!user) {
      throw new AppError('用户不存在', 404, 'USER_NOT_FOUND');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new AppError('原密码不正确', 400, 'INVALID_PASSWORD');
    }

    const validation = this.validatePassword(newPassword);
    if (!validation.valid) {
      throw new AppError(validation.errors.join('; '), 400, 'INVALID_PASSWORD');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.execute(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [hashedPassword, id, tenantId],
    );

    this.emitEvent('user:password_changed', { id, tenantId });
    return { success: true };
  }

  async resetPassword(id, tenantId, newPassword) {
    const validation = this.validatePassword(newPassword);
    if (!validation.valid) {
      throw new AppError(validation.errors.join('; '), 400, 'INVALID_PASSWORD');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const [result] = await this.execute(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [hashedPassword, id, tenantId],
    );

    if (result.affectedRows === 0) {
      throw new AppError('用户不存在', 404, 'USER_NOT_FOUND');
    }

    this.emitEvent('user:password_reset', { id, tenantId });
    return { success: true };
  }

  async batchAssignRole(tenantId, { user_ids, role }) {
    if (!tenantId || tenantId <= 0) {
      throw new AppError('无效的租户ID', 400, 'INVALID_TENANT_ID');
    }

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      throw new AppError('请选择至少一个用户', 400, 'MISSING_USER_IDS');
    }

    if (!role) {
      throw new AppError('请指定角色', 400, 'MISSING_ROLE');
    }

    if (!isValidRole(role)) {
      throw new AppError(`无效的角色: ${role}`, 400, 'INVALID_ROLE');
    }

    if (role === 'super_admin') {
      throw new AppError('不允许批量分配超级管理员角色', 400, 'FORBIDDEN_ROLE');
    }

    const placeholders = user_ids.map(() => '?').join(',');
    const [existingUsers] = await this.execute(
      `SELECT u.id, u.username, u.real_name FROM users u
       WHERE u.id IN (${placeholders}) AND u.tenant_id = ? AND u.status = 'active'`,
      [...user_ids, tenantId],
    );

    if (!existingUsers || existingUsers.length === 0) {
      throw new AppError('未找到符合条件的用户', 404, 'USERS_NOT_FOUND');
    }

    const validUserIds = existingUsers.map(u => u.id);
    const skippedCount = user_ids.length - validUserIds.length;

    for (const userId of validUserIds) {
      const [existingRole] = await this.execute(
        'SELECT id FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
        [userId, tenantId],
      );

      if (existingRole && existingRole.length > 0) {
        await this.execute(
          'UPDATE user_tenant_roles SET role = ?, status = "active", updated_at = NOW() WHERE user_id = ? AND tenant_id = ?',
          [role, userId, tenantId],
        );
      } else {
        await this.execute(
          'INSERT INTO user_tenant_roles (user_id, tenant_id, role, status, created_at) VALUES (?, ?, ?, "active", NOW())',
          [userId, tenantId, role],
        );
      }
    }

    this.emitEvent('user:batch_role_assigned', { tenantId, user_ids: validUserIds, role });

    return {
      success: true,
      assigned_count: validUserIds.length,
      skipped_count: skippedCount,
      role,
    };
  }

  async deleteUser(id, tenantId) {
    if (!tenantId || tenantId <= 0) {
      throw new AppError('无效的租户ID', 400, 'INVALID_TENANT_ID');
    }

    const user = await this.getUserById(id, tenantId);

    // 检查是否有待处理的维保工单
    const workOrderCount = await this.findOne(
      'SELECT COUNT(*) as count FROM maintenance_work_orders WHERE assigned_to = ? AND status IN ("pending", "in_progress")',
      [id],
    );
    if (workOrderCount && workOrderCount.count > 0) {
      throw new AppError(`该用户有待处理的维保工单(${workOrderCount.count}个)，无法删除`, 400, 'HAS_PENDING_WORK_ORDERS');
    }

    // 检查是否有关联的资产负责人（assets 表 responsible_person 存储的是姓名）
    const assetCount = await this.findOne(
      'SELECT COUNT(*) as count FROM assets WHERE responsible_person = ? AND tenant_id = ?',
      [user.real_name, tenantId],
    );
    if (assetCount && assetCount.count > 0) {
      throw new AppError(`该用户是${assetCount.count}个资产的负责人，无法删除`, 400, 'HAS_ASSETS_ASSIGNED');
    }

    const [result] = await this.execute(
      'DELETE FROM users WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (result.affectedRows === 0) {
      throw new AppError('用户删除失败', 500, 'DELETE_FAILED');
    }

    this.emitEvent('user:deleted', { id, username: user.username, tenantId });
    return { id };
  }

  async authenticateUser(username, password) {
    let user = await this.getSuperUserByUsername(username);
    let isSuperUser = false;

    if (!user) {
      user = await this.getUserByUsername(username);
    } else {
      isSuperUser = true;
    }

    if (!user) {
      return { authenticated: false, reason: '用户名或密码错误' };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return { authenticated: false, reason: '用户名或密码错误' };
    }

    if (user.status === 'disabled') {
      return { authenticated: false, reason: '账号已被禁用' };
    }

    return { authenticated: true, user, isSuperUser };
  }

  async consumeSmsVerificationCode(phone, code, tenantId) {
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return { valid: false, status: 400, message: '手机号格式不正确' };
    }

    if (!code || !/^\d{6}$/.test(String(code))) {
      return { valid: false, status: 400, message: '请输入6位验证码' };
    }

    if (!tenantId) {
      return { valid: false, status: 400, message: '请选择企业空间后重新获取验证码' };
    }

    const record = await this.findOne(
      'SELECT id, code, expires_at FROM sms_verification_codes WHERE phone = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 1',
      [phone, tenantId],
    );

    if (!record) {
      return { valid: false, status: 400, message: '验证码不存在或已过期' };
    }

    if (new Date(record.expires_at) < new Date()) {
      return { valid: false, status: 400, message: '验证码已过期' };
    }

    if (record.code !== String(code)) {
      return { valid: false, status: 400, message: '验证码错误' };
    }

    await this.execute(
      'DELETE FROM sms_verification_codes WHERE id = ?',
      [record.id],
    );

    return { valid: true };
  }

  // 清理过期的短信验证码，防止表数据无限增长
  async cleanupExpiredSmsCodes() {
    const [result] = await this.execute(
      'DELETE FROM sms_verification_codes WHERE expires_at < NOW()',
    );
    if (result.affectedRows > 0) {
      console.log(`清理了 ${result.affectedRows} 条过期短信验证码`);
    }
    return result.affectedRows;
  }

  /**
   * 获取"未配置权限"用户列表
   * 指在当前租户下有 user_tenant_roles 关联但 role_permissions 表里没有显式权限配置的用户
   */
  async getUnconfiguredUsers(tenantId) {
    if (!tenantId) return [];
    return this.findMany(
      `SELECT u.id, u.username, u.real_name, u.email, u.phone, u.status,
              utr.role, MAX(utr.is_default) AS is_default
         FROM super_users u
         INNER JOIN user_tenant_roles utr ON utr.user_id = u.id
         LEFT JOIN role_permissions rp ON rp.role = utr.role
        WHERE utr.tenant_id = ?
          AND utr.status = 'active'
        GROUP BY u.id, u.username, u.real_name, u.email, u.phone, u.status, utr.role
       HAVING COUNT(rp.id) = 0`,
      [tenantId],
    );
  }

  /**
   * 统计当前租户下各角色的用户数量
   */
  async getUserRoleStats(tenantId) {
    if (!tenantId) return [];
    return this.findMany(
      `SELECT utr.role,
              COUNT(DISTINCT u.id) AS user_count,
              SUM(CASE WHEN u.status = 'active' THEN 1 ELSE 0 END) AS active_count,
              SUM(CASE WHEN u.status = 'inactive' THEN 1 ELSE 0 END) AS inactive_count
         FROM user_tenant_roles utr
         LEFT JOIN super_users u ON u.id = utr.user_id
        WHERE utr.tenant_id = ? AND utr.status = 'active'
        GROUP BY utr.role
        ORDER BY user_count DESC`,
      [tenantId],
    );
  }
}

module.exports = UserService;
