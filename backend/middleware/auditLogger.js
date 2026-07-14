const AuditLogService = require('../services/audit-log.service');
const { getDatabase } = require('../core/DatabaseInterface');
const { getCurrentModuleId } = require('../core/module-context');

const auditLogService = new AuditLogService({ db: getDatabase() });

const SENSITIVE_FIELDS = new Set([
  'password', 'token', 'secret', 'api_key', 'apikey', 'access_token',
  'refresh_token', 'authorization', 'credential', 'private_key',
  'secret_key', 'old_password', 'new_password', 'confirm_password',
]);

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

function sanitizeObject(obj, sensitiveFields = SENSITIVE_FIELDS) {
  return auditLogService.sanitizeObject(obj);
}

async function logAudit(req, options = {}, extraOptions = {}) {
  try {
    const {
      action_type, module, resource_type, resource_id, resource_name,
      action_description, old_value, new_value, response_status,
      error_message, execution_time,
    } = options;

    const user = req.user || {};
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;
    const requestMethod = req.method || null;
    const requestPath = req.originalUrl || req.path || null;

    let requestParams = null;
    if (req.body && Object.keys(req.body).length > 0) {
      requestParams = JSON.stringify(sanitizeObject(req.body));
    } else if (req.query && Object.keys(req.query).length > 0) {
      requestParams = JSON.stringify(sanitizeObject(req.query));
    }

    const tenantId = extraOptions.tenantId || user.tenant_id || 0;

    await auditLogService.recordLog({
      tenant_id: tenantId,
      user_id: user.id || null,
      username: user.username || null,
      real_name: user.real_name || null,
      role: user.role || null,
      action_type,
      module,
      resource_type: resource_type || null,
      resource_id: resource_id || null,
      resource_name: resource_name || null,
      action_description: action_description || null,
      old_value,
      new_value,
      ip_address: ipAddress,
      user_agent: userAgent,
      request_method: requestMethod,
      request_path: requestPath,
      request_params: requestParams,
      response_status: response_status || null,
      error_message: error_message || null,
      execution_time: execution_time || null,
    });
  } catch (error) {
    console.error('[审计日志] 记录失败:', error);
  }
}

function auditLogger(actionType, module, getResourceInfo = null) {
  return async (req, res, next) => {
    const startTime = Date.now();
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      const executionTime = Date.now() - startTime;
      const responseStatus = res.statusCode || 200;
      const errorMessage = data.success === false ? data.message || data.error : null;

      // 自动从模块上下文获取 moduleId（当未显式传入 module 参数时）
      const effectiveModule = module || getCurrentModuleId() || 'unknown';

      let resourceInfo = {};
      if (getResourceInfo) {
        try {
          resourceInfo = getResourceInfo(req, res) || {};
        } catch (e) {
          console.error('[审计日志] 获取资源信息失败:', e);
        }
      }

      logAudit(req, {
        action_type: actionType,
        module: effectiveModule,
        resource_type: resourceInfo.resource_type,
        resource_id: resourceInfo.resource_id,
        resource_name: resourceInfo.resource_name,
        action_description: resourceInfo.action_description || `${actionType} ${effectiveModule}`,
        old_value: resourceInfo.old_value,
        new_value: resourceInfo.new_value,
        response_status: responseStatus,
        error_message: errorMessage,
        execution_time: executionTime,
      }).catch(err => {
        console.error('[审计日志] 异步记录失败:', err);
      });

      return originalJson(data);
    };

    next();
  };
}

module.exports = {
  logAudit,
  auditLogger,
  getClientIp,
  sanitizeObject,
  SENSITIVE_FIELDS,
};
