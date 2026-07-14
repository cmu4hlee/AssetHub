/**
 * 微服务通用租户过滤与查询构建器
 */

const toInt = value => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const createTenantFilter = options => {
  const {
    required = true,
    superAdminBypass = true,
    tenantIdHeader = 'x-tenant-id',
  } = options || {};

  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '未授权，请先登录',
        code: 'UNAUTHORIZED',
      });
    }

    const isSuperAdmin = user.role === 'super_admin' || user.role === 'suadmin';
    const headerTenantId = req.headers[tenantIdHeader];
    const userTenantId = user.tenant_id;

    if (isSuperAdmin && superAdminBypass) {
      const tenantId = toInt(headerTenantId ?? userTenantId);
      req.tenantFilter = {
        enabled: Number.isFinite(tenantId),
        tenantId,
        isSuperAdmin: true,
      };
      return next();
    }

    const tenantId = toInt(headerTenantId ?? userTenantId);
    if (required && !Number.isFinite(tenantId)) {
      return res.status(403).json({
        success: false,
        message: '缺少租户信息',
        code: 'MISSING_TENANT_ID',
      });
    }

    req.tenantFilter = {
      enabled: Number.isFinite(tenantId),
      tenantId,
      isSuperAdmin: false,
    };
    return next();
  };
};

const createTenantQueryBuilder = options => {
  const {
    tableAlias = '',
    tenantIdColumn = 'tenant_id',
  } = options || {};

  return {
    build(req) {
      const filter = req.tenantFilter || {};
      if (filter.isSuperAdmin && !filter.enabled) {
        return { whereClause: '', params: [], enabled: false };
      }

      if (!filter.enabled || !Number.isFinite(filter.tenantId)) {
        return { whereClause: '', params: [], enabled: false };
      }

      const column = tableAlias ? `${tableAlias}.${tenantIdColumn}` : tenantIdColumn;
      return {
        whereClause: ` AND ${column} = ?`,
        params: [filter.tenantId],
        enabled: true,
        tenantId: filter.tenantId,
      };
    },
  };
};

module.exports = {
  createTenantFilter,
  createTenantQueryBuilder,
};
