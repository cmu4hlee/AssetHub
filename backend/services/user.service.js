const BaseService = require('../core/BaseService');
const { AppError } = require('../utils/error-handler');
const bcrypt = require('bcryptjs');

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

  async listUsers(tenantId, { page = 1, pageSize = 20, keyword, role } = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    let whereClause = 'WHERE tenant_id = ?';
    const params = [tenantId];

    if (keyword) {
      whereClause += ' AND (username LIKE ? OR real_name LIKE ? OR phone LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }

    const countResult = await this.findOne(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params,
    );
    const {total} = countResult;

    const users = await this.findMany(
      `SELECT id, username, real_name, phone, email, role, department, department_code, tenant_id, managed_departments, status, created_at, updated_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
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
    const user = await this.findOne(
      'SELECT id, username, real_name, phone, email, role, department, department_code, tenant_id, managed_departments, status, created_at, updated_at FROM users WHERE id = ? AND tenant_id = ?',
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

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await this.execute(
      `INSERT INTO users (username, password, real_name, phone, email, role, department, department_code, tenant_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
      [
        this.normalizeUsername(username),
        hashedPassword,
        real_name ?? null,
        phone ?? null,
        email ?? null,
        role ?? 'user',
        department ?? null,
        userData.department_code ?? null,
        tenantId,
      ],
    );

    this.emitEvent('user:created', { id: result.insertId, username, tenantId });
    return { id: result.insertId, username, real_name: real_name ?? null };
  }

  async updateUser(id, tenantId, userData) {
    const existingUser = await this.getUserById(id, tenantId);

    const fields = [];
    const values = [];
    const allowedFields = ['real_name', 'phone', 'email', 'role', 'department', 'department_code', 'managed_departments', 'status'];

    for (const field of allowedFields) {
      if (userData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(typeof userData[field] === 'object' ? JSON.stringify(userData[field]) : userData[field]);
      }
    }

    if (fields.length === 0) {
      throw new AppError('没有需要更新的字段', 400, 'NO_FIELDS_TO_UPDATE');
    }

    values.push(id, tenantId);
    const [result] = await this.execute(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      throw new AppError('用户更新失败', 500, 'UPDATE_FAILED');
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

  async deleteUser(id, tenantId) {
    const user = await this.getUserById(id, tenantId);

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
}

module.exports = UserService;
