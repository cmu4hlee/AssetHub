/**
 * 租户过滤辅助函数
 * 用于在所有查询中添加租户过滤条件
 */

const { isSuperAdmin: checkIsSuperAdmin } = require('../config/roles.config');
const logger = require('../config/logger');

/**
 * 为查询添加租户过滤条件
 * @param {Object} req - Express请求对象
 * @param {string} tableAlias - 表别名（如 'a', 'ar'）
 * @param {Object} options - 可选配置
 * @param {boolean} options.skip - 是否跳过租户过滤（用于某些不需要租户隔离的表）
 * @param {boolean} options.allowSuperAdminAll - 是否允许超级管理员查看所有租户数据（默认true）
 * @returns {Object} - { whereClause: string, params: Array }
 */
function addTenantFilter(req, tableAlias = '', options = {}) {
  if (options.skip) {
    return { whereClause: '', params: [] };
  }

  const prefix = tableAlias ? `${tableAlias}.` : '';
  let whereClause = '';
  const params = [];

  const userIsSuperAdmin = checkIsSuperAdmin(req.user);
  const tenantId = req.user && (req.user.tenant_id || req.user.tenantId);
  const iotTenantId = req.iotAuth && req.iotAuth.tenant_id;
  const effectiveTenantId = tenantId || iotTenantId;

  if (userIsSuperAdmin) {
    if (effectiveTenantId && options.allowSuperAdminAll !== false) {
      const validTenantId = parseInt(effectiveTenantId);
      if (validTenantId && validTenantId > 0) {
        whereClause = ` AND ${prefix}tenant_id = ?`;
        params.push(validTenantId);
      } else {
        whereClause = '';
      }
    } else {
      whereClause = '';
    }
  } else {
    if (effectiveTenantId) {
      const validTenantId = parseInt(effectiveTenantId);
      if (!validTenantId || validTenantId <= 0) {
        throw new Error('INVALID_TENANT_ID');
      }

      whereClause = ` AND ${prefix}tenant_id = ?`;
      params.push(validTenantId);
    } else {
      throw new Error('MISSING_TENANT_ID');
    }
  }

  return { whereClause, params };
}

/**
 * Express中间件：自动为所有SQL查询注入租户过滤
 * 通过拦截 req.dbQuery 包装器实现
 * @param {Object} options - 配置选项
 * @param {Array<string>} options.skipTables - 不需要租户过滤的表名列表
 */
function tenantFilterMiddleware(options = {}) {
  const skipTables = new Set(options.skipTables || []);

  return (req, res, next) => {
    if (!req.user) return next();

    const tenantId = getTenantId(req);
    if (!tenantId && !checkIsSuperAdmin(req.user)) {
      return res.status(400).json({
        success: false,
        message: '当前用户未分配企业空间',
        code: 'REQUIRE_TENANT',
      });
    }

    req.tenantFilter = {
      tenantId,
      isSuperAdmin: checkIsSuperAdmin(req.user),
      skipTables,
    };

    next();
  };
}

/**
 * 为SQL语句自动添加租户过滤条件（中间件版本）
 * 适用于模块路由的统一租户过滤
 * @param {string} tableName - 主表名
 * @param {string} tableAlias - 表别名
 */
function requireTenantFilter(tableName, tableAlias = '') {
  return (req, res, next) => {
    try {
      if (!req.user) return next();

      const filter = addTenantFilter(req, tableAlias);
      req._tenantFilter = filter;
      req._tenantTable = tableName;

      next();
    } catch (error) {
      logger.error(`租户过滤失败 [${tableName}]:`, error.message);
      return res.status(400).json({
        success: false,
        message: '租户信息无效',
        code: 'INVALID_TENANT',
      });
    }
  };
}

function normalizeTenantId(value) {
  if (value == null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

/**
 * 构建完整的WHERE子句
 * @param {Object} tenantFilter - 租户过滤对象
 * @param {Array} additionalConditions - 额外的条件数组
 * @param {Array} additionalParams - 额外的参数数组
 * @returns {Object} - { whereClause: string, params: Array }
 */
function buildWhereClause(tenantFilter, additionalConditions = [], additionalParams = []) {
  let conditions = [];
  const params = [...tenantFilter.params, ...additionalParams];

  // 处理租户过滤条件
  if (tenantFilter.whereClause) {
    conditions.push(tenantFilter.whereClause.replace(' AND ', ''));
  }

  // 添加额外条件
  conditions = conditions.concat(additionalConditions);

  // 构建完整的WHERE子句
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return { whereClause, params };
}

/**
 * 为INSERT语句添加租户ID
 * 超级管理员：以当前进入的租户空间为准（由请求头 X-Tenant-ID 在 auth 中写入 req.user.tenant_id），未选空间时为 null。
 * 其他用户：使用其所属租户或请求体中的 tenant_id。
 * @param {Object} req - Express请求对象
 * @returns {number|null} - 租户ID
 */
function getTenantId(req) {
  if (req.user) {
    const tid = normalizeTenantId(req.user.tenant_id ?? req.user.tenantId);
    if (checkIsSuperAdmin(req.user)) {
      return tid;
    }
    if (tid != null) return tid;
  }

  return null;
}

/**
 * 验证用户是否有权限访问指定租户的数据
 * @param {Object} req - Express请求对象
 * @param {number} tenantId - 要访问的租户ID
 * @returns {boolean} - 是否有权限
 */
function canAccessTenant(req, tenantId) {
  // 如果req.user不存在，返回false
  if (!req.user) {
    return false;
  }
  // 超级管理员可以访问所有租户
  if (checkIsSuperAdmin(req.user)) {
    return true;
  }
  // 系统管理员和普通用户只能访问自己的租户
  const userTenantId = normalizeTenantId(req.user.tenant_id ?? req.user.tenantId);
  const targetTenantId = normalizeTenantId(tenantId);
  return userTenantId != null && targetTenantId != null && userTenantId === targetTenantId;
}

/**
 * 要求当前请求必须带有租户空间（超级管理员未选企业时返回 400）
 * 用于创建/更新等必须指定租户的接口。
 */
function requireTenantId(req, res, next) {
  if (!req.user) return next();
  const tenantId = getTenantId(req);
  if (tenantId == null || tenantId === '' || Number.isNaN(tenantId)) {
    return res.status(400).json({
      success: false,
      message:
        checkIsSuperAdmin(req.user) ? '请先选择企业空间' : '当前用户未分配企业空间',
      code: 'REQUIRE_TENANT',
    });
  }
  next();
}

module.exports = {
  addTenantFilter,
  tenantFilterMiddleware,
  requireTenantFilter,
  getTenantId,
  canAccessTenant,
  buildWhereClause,
  requireTenantId,
  normalizeTenantId,
};
