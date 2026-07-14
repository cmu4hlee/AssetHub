const BaseService = require('../core/BaseService');

const SENSITIVE_FIELDS = new Set([
  'password', 'token', 'secret', 'api_key', 'apikey', 'access_token',
  'refresh_token', 'authorization', 'credential', 'private_key',
  'secret_key', 'old_password', 'new_password', 'confirm_password',
]);

class AuditLogService extends BaseService {
  constructor(options = {}) {
    super({ name: 'AuditLogService', ...options });
  }

  sanitizeObject(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sanitizeObject(item));

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.has(lowerKey) || SENSITIVE_FIELDS.has(key)) {
        sanitized[key] = '***';
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  async recordLog(logData) {
    try {
      const {
        tenant_id, user_id, username, real_name, role,
        action_type, module, resource_type, resource_id, resource_name,
        action_description, old_value, new_value,
        ip_address, user_agent, request_method, request_path, request_params,
        response_status, error_message, execution_time,
      } = logData;

      const oldValueJson = old_value ? JSON.stringify(this.sanitizeObject(old_value)) : null;
      const newValueJson = new_value ? JSON.stringify(this.sanitizeObject(new_value)) : null;

      const columns = [
        'tenant_id', 'user_id', 'username', 'real_name', 'role',
        'action_type', 'module', 'resource_type', 'resource_id', 'resource_name',
        'action_description', 'old_value', 'new_value',
        'ip_address', 'user_agent', 'request_method', 'request_path', 'request_params',
        'response_status', 'error_message', 'execution_time',
      ];

      const values = [
        tenant_id || 0, user_id, username, real_name, role,
        action_type, module, resource_type || null, resource_id || null, resource_name || null,
        action_description || null, oldValueJson, newValueJson,
        ip_address, user_agent, request_method, request_path, request_params,
        response_status || null, error_message || null, execution_time || null,
      ];

      const placeholders = columns.map(() => '?').join(', ');
      const insertSql = `INSERT INTO audit_logs (${columns.join(', ')}) VALUES (${placeholders})`;

      try {
        await this.execute(insertSql, values);
      } catch (dbError) {
        if (dbError.code === 'ER_BAD_FIELD_ERROR') {
          console.warn('[审计日志] 表缺少列，将尝试基础插入');
        } else {
          throw dbError;
        }
      }
    } catch (error) {
      console.error('[审计日志] 记录失败:', error);
    }
  }

  async queryLogs(tenantId, { page = 1, pageSize = 20, action_type, module, user_id, start_date, end_date } = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    let whereClause = 'WHERE tenant_id = ?';
    const params = [tenantId];

    if (action_type) {
      whereClause += ' AND action_type = ?';
      params.push(action_type);
    }
    if (module) {
      whereClause += ' AND module = ?';
      params.push(module);
    }
    if (user_id) {
      whereClause += ' AND user_id = ?';
      params.push(user_id);
    }
    if (start_date) {
      whereClause += ' AND created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND created_at <= ?';
      params.push(end_date);
    }

    const countResult = await this.findOne(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
      params,
    );
    const {total} = countResult;

    const logs = await this.findMany(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    return {
      data: logs,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize)),
      },
    };
  }
}

module.exports = AuditLogService;
