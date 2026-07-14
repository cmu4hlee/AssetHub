/**
 * 审计日志服务
 * 提供结构化的操作审计日志记录和查询
 */

const db = require('../config/database');
const logger = require('../config/logger');

class AuditLoggerService {
  constructor() {
    this.operationTypes = {
      CREATE: 'create',
      UPDATE: 'update',
      DELETE: 'delete',
      VIEW: 'view',
      EXPORT: 'export',
      IMPORT: 'import',
      LOGIN: 'login',
      LOGOUT: 'logout',
      APPROVE: 'approve',
      REJECT: 'reject',
      TRANSFER: 'transfer',
      ASSIGN: 'assign',
    };

    this.resourceTypes = {
      ASSET: 'asset',
      USER: 'user',
      DEPARTMENT: 'department',
      MAINTENANCE: 'maintenance',
      QUALITY_CONTROL: 'quality_control',
      INVENTORY: 'inventory',
      TRANSFER: 'transfer',
      TENANT: 'tenant',
      ROLE: 'role',
      PERMISSION: 'permission',
      SYSTEM_CONFIG: 'system_config',
      BACKUP: 'backup',
      AUDIT_LOG: 'audit_log',
    };

    this.auditColumnsCache = null;
    this.auditColumnsCacheAt = 0;
    this.auditColumnsCacheTtlMs = 60 * 1000;
  }

  async getAuditLogColumns() {
    if (
      this.auditColumnsCache &&
      Date.now() - this.auditColumnsCacheAt < this.auditColumnsCacheTtlMs
    ) {
      return this.auditColumnsCache;
    }

    const [rows] = await db.execute(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs'`,
    );
    const columns = new Set(rows.map(item => item.COLUMN_NAME));
    this.auditColumnsCache = columns;
    this.auditColumnsCacheAt = Date.now();
    return columns;
  }

  pickField(payload, keys, fallback = null) {
    for (const key of keys) {
      if (payload[key] !== undefined) {
        return payload[key];
      }
    }
    return fallback;
  }

  normalizeOperation(value) {
    if (value === null || value === undefined || value === '') {
      return 'unknown';
    }
    return String(value).toLowerCase();
  }

  normalizeNumber(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  toDbJson(value) {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string') {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  parseDbJson(value) {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value !== 'string') {
      return value;
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  normalizePayload(payload = {}) {
    const operation = this.normalizeOperation(
      this.pickField(payload, ['operation', 'action_type', 'actionType'], 'unknown'),
    );
    const resourceType = this.pickField(
      payload,
      ['resourceType', 'resource_type'],
      'unknown',
    );
    const responseStatus = this.normalizeNumber(
      this.pickField(payload, ['responseStatus', 'response_status']),
    );
    const explicitStatus = this.pickField(payload, ['status'], null);
    const status =
      explicitStatus ||
      (responseStatus != null ? (responseStatus >= 400 ? 'failed' : 'success') : 'success');

    return {
      tenantId: this.normalizeNumber(this.pickField(payload, ['tenantId', 'tenant_id'])),
      userId: this.normalizeNumber(this.pickField(payload, ['userId', 'user_id'])),
      username: this.pickField(payload, ['username'], null),
      realName: this.pickField(payload, ['realName', 'real_name'], null),
      role: this.pickField(payload, ['role'], null),
      operation,
      resourceType,
      resourceId: this.pickField(payload, ['resourceId', 'resource_id'], null),
      resourceName: this.pickField(payload, ['resourceName', 'resource_name'], null),
      oldValues: this.pickField(payload, ['oldValues', 'old_values', 'old_value'], null),
      newValues: this.pickField(payload, ['newValues', 'new_values', 'new_value'], null),
      changes: this.pickField(payload, ['changes'], null),
      ipAddress: this.pickField(payload, ['ipAddress', 'ip_address'], null),
      userAgent: this.pickField(payload, ['userAgent', 'user_agent'], null),
      description: this.pickField(payload, ['description', 'action_description'], null),
      status,
      responseStatus,
      errorMessage: this.pickField(payload, ['errorMessage', 'error_message'], null),
      requestId: this.pickField(payload, ['requestId', 'request_id'], null),
      duration: this.normalizeNumber(this.pickField(payload, ['duration', 'execution_time'])),
      module: this.pickField(payload, ['module'], resourceType || 'system'),
      requestMethod: this.pickField(payload, ['requestMethod', 'request_method'], null),
      requestPath: this.pickField(payload, ['requestPath', 'request_path'], null),
      requestParams: this.pickField(payload, ['requestParams', 'request_params'], null),
    };
  }

  pickAuditColumns(columns) {
    return {
      operation: columns.has('operation')
        ? 'operation'
        : columns.has('action_type')
          ? 'action_type'
          : null,
      description: columns.has('description')
        ? 'description'
        : columns.has('action_description')
          ? 'action_description'
          : null,
      oldValues: columns.has('old_values')
        ? 'old_values'
        : columns.has('old_value')
          ? 'old_value'
          : null,
      newValues: columns.has('new_values')
        ? 'new_values'
        : columns.has('new_value')
          ? 'new_value'
          : null,
      status: columns.has('status') ? 'status' : null,
      responseStatus: columns.has('response_status') ? 'response_status' : null,
      duration: columns.has('duration')
        ? 'duration'
        : columns.has('execution_time')
          ? 'execution_time'
          : null,
      requestId: columns.has('request_id') ? 'request_id' : null,
      changes: columns.has('changes') ? 'changes' : null,
    };
  }

  /**
   * 记录审计日志
   */
  async log(payload = {}) {
    try {
      const normalized = this.normalizePayload(payload);
      const columns = await this.getAuditLogColumns();
      const col = this.pickAuditColumns(columns);

      const row = {};
      const set = (columnName, value, fallbackValue = null) => {
        if (!columns.has(columnName)) return;
        const picked = value === undefined ? fallbackValue : value;
        row[columnName] = picked === undefined ? null : picked;
      };

      set('tenant_id', normalized.tenantId);
      set('user_id', normalized.userId);
      set('username', normalized.username);
      set('real_name', normalized.realName);
      set('role', normalized.role);

      if (col.operation) {
        set(col.operation, normalized.operation || 'unknown');
      }
      if (columns.has('module')) {
        set('module', normalized.module || 'system');
      }

      set('resource_type', normalized.resourceType || 'unknown');
      set('resource_id', normalized.resourceId);
      set('resource_name', normalized.resourceName);

      if (col.oldValues) {
        set(col.oldValues, this.toDbJson(normalized.oldValues));
      }
      if (col.newValues) {
        set(col.newValues, this.toDbJson(normalized.newValues));
      }
      if (col.changes) {
        set(col.changes, this.toDbJson(normalized.changes));
      }

      set('ip_address', normalized.ipAddress);
      set('user_agent', normalized.userAgent);

      if (col.description) {
        set(col.description, normalized.description);
      }
      if (col.status) {
        set(col.status, normalized.status || 'success');
      }
      if (col.responseStatus) {
        const fallbackStatus = normalized.status === 'failed' ? 500 : 200;
        set(col.responseStatus, normalized.responseStatus ?? fallbackStatus);
      }
      set('error_message', normalized.errorMessage);

      if (col.requestId) {
        set(col.requestId, normalized.requestId);
      }
      if (col.duration) {
        set(col.duration, normalized.duration);
      }

      set('request_method', normalized.requestMethod);
      set('request_path', normalized.requestPath);
      set('request_params', this.toDbJson(normalized.requestParams));

      const entries = Object.entries(row);
      if (entries.length === 0) {
        throw new Error('audit_logs 表中没有可写入的字段');
      }

      const sql = `INSERT INTO audit_logs (${entries.map(([key]) => key).join(', ')})
        VALUES (${entries.map(() => '?').join(', ')})`;
      const values = entries.map(([, value]) => (value === undefined ? null : value));
      const [result] = await db.execute(sql, values);

      return {
        success: true,
        logId: result.insertId,
      };
    } catch (error) {
      logger.error('Failed to write audit log:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 批量记录审计日志
   */
  async logBatch(logs) {
    const results = [];
    for (const log of logs) {
      results.push(await this.log(log));
    }
    return results;
  }

  /**
   * 查询审计日志
   */
  async query({
    tenantId,
    userId,
    operation,
    resourceType,
    resourceId,
    status,
    startDate,
    endDate,
    keyword,
    page = 1,
    pageSize = 20,
  }) {
    try {
      const columns = await this.getAuditLogColumns();
      const col = this.pickAuditColumns(columns);
      const timeColumn = columns.has('created_at')
        ? 'created_at'
        : columns.has('updated_at')
          ? 'updated_at'
          : null;
      const createdAtSelect = columns.has('created_at')
        ? 'created_at'
        : columns.has('updated_at')
          ? 'updated_at AS created_at'
          : 'NULL AS created_at';
      const orderByClause = timeColumn ? `${timeColumn} DESC` : 'id DESC';

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (columns.has('tenant_id')) {
        if (tenantId) {
          whereClause += ' AND tenant_id = ?';
          params.push(tenantId);
        } else {
          whereClause += ' AND tenant_id = -1';
        }
      }

      if (userId && columns.has('user_id')) {
        whereClause += ' AND user_id = ?';
        params.push(userId);
      }

      if (operation && col.operation) {
        whereClause += ` AND ${col.operation} = ?`;
        params.push(operation);
      }

      if (resourceType && columns.has('resource_type')) {
        whereClause += ' AND resource_type = ?';
        params.push(resourceType);
      }

      if (resourceId && columns.has('resource_id')) {
        whereClause += ' AND resource_id = ?';
        params.push(resourceId);
      }

      if (status) {
        if (col.status) {
          whereClause += ` AND ${col.status} = ?`;
          params.push(status);
        } else if (col.responseStatus) {
          if (status === 'success') {
            whereClause += ` AND ${col.responseStatus} < 400`;
          } else if (status === 'failed') {
            whereClause += ` AND ${col.responseStatus} >= 400`;
          }
        }
      }

      if (startDate && timeColumn) {
        whereClause += ` AND ${timeColumn} >= ?`;
        params.push(startDate);
      }

      if (endDate && timeColumn) {
        whereClause += ` AND ${timeColumn} <= ?`;
        params.push(endDate);
      }

      if (keyword) {
        const likeKeyword = `%${keyword}%`;
        const keywordClauses = [];
        if (columns.has('resource_name')) keywordClauses.push('resource_name LIKE ?');
        if (col.description) keywordClauses.push(`${col.description} LIKE ?`);
        if (columns.has('username')) keywordClauses.push('username LIKE ?');
        if (keywordClauses.length > 0) {
          whereClause += ` AND (${keywordClauses.join(' OR ')})`;
          params.push(...keywordClauses.map(() => likeKeyword));
        }
      }

      // 获取总数
      const [countResult] = await db.execute(
        `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
        params,
      );
      const {total} = countResult[0];

      const statusSelect = col.status
        ? `${col.status} AS status`
        : col.responseStatus
          ? `CASE WHEN ${col.responseStatus} >= 400 THEN 'failed' ELSE 'success' END AS status`
          : '\'unknown\' AS status';
      const durationSelect = col.duration ? `${col.duration} AS duration` : 'NULL AS duration';
      const descriptionSelect = col.description ? `${col.description} AS description` : 'NULL AS description';
      const operationSelect = col.operation ? `${col.operation} AS operation` : 'NULL AS operation';

      // 获取数据
      const [logs] = await db.execute(
        `SELECT 
          id,
          ${columns.has('tenant_id') ? 'tenant_id' : 'NULL AS tenant_id'},
          ${columns.has('user_id') ? 'user_id' : 'NULL AS user_id'},
          ${columns.has('username') ? 'username' : 'NULL AS username'},
          ${operationSelect},
          ${columns.has('resource_type') ? 'resource_type' : 'NULL AS resource_type'},
          ${columns.has('resource_id') ? 'resource_id' : 'NULL AS resource_id'},
          ${columns.has('resource_name') ? 'resource_name' : 'NULL AS resource_name'},
          ${descriptionSelect},
          ${statusSelect},
          ${columns.has('ip_address') ? 'ip_address' : 'NULL AS ip_address'},
          ${createdAtSelect},
          ${durationSelect}
        FROM audit_logs
        ${whereClause}
        ORDER BY ${orderByClause}
        LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize],
      );

      if (logs.length === 0) {
        return {
          success: true,
          data: [],
          pagination: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
          },
        };
      }

      const oldValuesSelect = col.oldValues ? `${col.oldValues} AS old_values` : 'NULL AS old_values';
      const newValuesSelect = col.newValues ? `${col.newValues} AS new_values` : 'NULL AS new_values';
      const changesSelect = col.changes ? `${col.changes} AS changes` : 'NULL AS changes';
      const errorSelect = columns.has('error_message') ? 'error_message' : 'NULL AS error_message';
      const userAgentSelect = columns.has('user_agent') ? 'user_agent' : 'NULL AS user_agent';
      const requestIdSelect = col.requestId ? `${col.requestId} AS request_id` : 'NULL AS request_id';

      // 获取详情（旧值、新值、变更）
      const [details] = await db.execute(
        `SELECT 
          id, ${oldValuesSelect}, ${newValuesSelect}, ${changesSelect},
          ${errorSelect}, ${userAgentSelect}, ${requestIdSelect}
        FROM audit_logs
        WHERE id IN (${logs.map(() => '?').join(',')})`,
        logs.map(l => l.id),
      );

      const detailMap = new Map(details.map(d => [d.id, d]));

      const enrichedLogs = logs.map(log => ({
        ...log,
        old_values: this.parseDbJson(detailMap.get(log.id)?.old_values),
        new_values: this.parseDbJson(detailMap.get(log.id)?.new_values),
        changes: this.parseDbJson(detailMap.get(log.id)?.changes),
        error_message: detailMap.get(log.id)?.error_message,
        user_agent: detailMap.get(log.id)?.user_agent,
        request_id: detailMap.get(log.id)?.request_id,
      }));

      return {
        success: true,
        data: enrichedLogs,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      logger.error('Failed to query audit logs:', error);
      return {
        success: false,
        message: '查询审计日志失败',
        error: error.message,
      };
    }
  }

  /**
   * 获取审计统计
   */
  async getStatistics({ tenantId, startDate, endDate }) {
    try {
      const columns = await this.getAuditLogColumns();
      const col = this.pickAuditColumns(columns);

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (tenantId && columns.has('tenant_id')) {
        whereClause += ' AND tenant_id = ?';
        params.push(tenantId);
      }

      if (startDate) {
        whereClause += ' AND created_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND created_at <= ?';
        params.push(endDate);
      }

      // 操作类型统计
      const operationStats = col.operation
        ? (
            await db.execute(
              `SELECT ${col.operation} AS operation, COUNT(*) as count
               FROM audit_logs
               ${whereClause}
               GROUP BY ${col.operation}
               ORDER BY count DESC`,
              params,
            )
          )[0]
        : [];

      // 资源类型统计
      const resourceStats = columns.has('resource_type')
        ? (
            await db.execute(
              `SELECT resource_type, COUNT(*) as count
               FROM audit_logs
               ${whereClause}
               GROUP BY resource_type
               ORDER BY count DESC`,
              params,
            )
          )[0]
        : [];

      // 用户活跃度统计
      const userStats = columns.has('user_id') && columns.has('username')
        ? (
            await db.execute(
              `SELECT user_id, username, COUNT(*) as count
               FROM audit_logs
               ${whereClause}
               GROUP BY user_id, username
               ORDER BY count DESC
               LIMIT 10`,
              params,
            )
          )[0]
        : [];

      // 每日趋势
      const dailyTrend = columns.has('created_at')
        ? (
            await db.execute(
              `SELECT DATE(created_at) as date, COUNT(*) as count
               FROM audit_logs
               ${whereClause}
               GROUP BY DATE(created_at)
               ORDER BY date DESC
               LIMIT 30`,
              params,
            )
          )[0]
        : [];

      // 成功/失败统计
      let statusStats = [];
      if (col.status) {
        [statusStats] = await db.execute(
          `SELECT ${col.status} AS status, COUNT(*) as count
           FROM audit_logs
           ${whereClause}
           GROUP BY ${col.status}`,
          params,
        );
      } else if (col.responseStatus) {
        [statusStats] = await db.execute(
          `SELECT CASE WHEN ${col.responseStatus} >= 400 THEN 'failed' ELSE 'success' END AS status,
                  COUNT(*) AS count
           FROM audit_logs
           ${whereClause}
           GROUP BY CASE WHEN ${col.responseStatus} >= 400 THEN 'failed' ELSE 'success' END`,
          params,
        );
      }

      return {
        success: true,
        data: {
          operationStats,
          resourceStats,
          userStats,
          dailyTrend,
          statusStats,
        },
      };
    } catch (error) {
      logger.error('Failed to get audit statistics:', error);
      return {
        success: false,
        message: '获取审计统计失败',
        error: error.message,
      };
    }
  }

  /**
   * 导出审计日志
   */
  async export({
    tenantId,
    startDate,
    endDate,
    format = 'csv',
  }) {
    try {
      const result = await this.query({
        tenantId,
        startDate,
        endDate,
        page: 1,
        pageSize: 10000, // 最大导出10000条
      });

      if (!result.success) {
        return result;
      }

      if (format === 'csv') {
        // 生成CSV
        const headers = [
          'ID', '租户ID', '用户ID', '用户名', '操作', '资源类型',
          '资源ID', '资源名称', '描述', '状态', 'IP地址', '创建时间',
        ];
        const rows = result.data.map(log => [
          log.id,
          log.tenant_id,
          log.user_id,
          log.username,
          log.operation,
          log.resource_type,
          log.resource_id,
          log.resource_name,
          log.description,
          log.status,
          log.ip_address,
          log.created_at,
        ]);

        return {
          success: true,
          format: 'csv',
          headers,
          rows,
        };
      }

      return {
        success: true,
        format: 'json',
        data: result.data,
      };
    } catch (error) {
      logger.error('Failed to export audit logs:', error);
      return {
        success: false,
        message: '导出审计日志失败',
        error: error.message,
      };
    }
  }

  /**
   * 清理过期日志
   */
  async cleanup(retentionDays = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const [result] = await db.execute(
        'DELETE FROM audit_logs WHERE created_at < ?',
        [cutoffDate.toISOString().split('T')[0]],
      );

      logger.info(`Cleaned up ${result.affectedRows} audit logs older than ${retentionDays} days`);

      return {
        success: true,
        deletedCount: result.affectedRows,
      };
    } catch (error) {
      logger.error('Failed to cleanup audit logs:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new AuditLoggerService();
