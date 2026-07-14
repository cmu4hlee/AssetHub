/**
 * 安全增强中间件
 * 用于处理认证、授权和租户隔离的安全问题
 */

const { authenticate } = require('./auth');
const { addTenantFilter } = require('./tenant-filter');

/**
 * 安全认证中间件
 * 增强原有的认证逻辑，添加更严格的安全检查
 */
const secureAuthenticate = async (req, res, next) => {
  try {
    // 首先进行基本认证
    await new Promise((resolve, reject) => {
      authenticate(req, res, err => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 额外安全检查
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '认证失败',
        error: 'AUTHENTICATION_FAILED',
        code: 1006,
      });
    }

    // 验证用户信息的完整性
    if (!req.user.id || !req.user.username || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: '用户信息不完整',
        error: 'INCOMPLETE_USER_INFO',
        code: 1007,
      });
    }

    // 记录安全事件
    console.log(
      `🔒 安全认证: 用户 ${req.user.username} (角色: ${req.user.role}) 访问 ${req.method} ${req.path}`,
    );

    next();
  } catch (error) {
    console.error('安全认证失败:', error);

    if (error.message.includes('MISSING_TENANT_ID')) {
      return res.status(403).json({
        success: false,
        message: '缺少租户信息',
        error: 'TENANT_ID_REQUIRED',
        code: 2001,
      });
    }

    return res.status(401).json({
      success: false,
      message: '认证失败',
      error: 'AUTHENTICATION_FAILED',
      code: 1008,
    });
  }
};

/**
 * 安全租户过滤中间件
 * 强制要求租户隔离，防止数据泄露
 */
const secureTenantFilter = (tableAlias = '') => {
  return async (req, res, next) => {
    try {
      // 确保用户已认证
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '需要先登录',
          error: 'UNAUTHORIZED',
          code: 1009,
        });
      }

      // 应用租户过滤
      const tenantFilter = addTenantFilter(req, tableAlias);

      // 将过滤条件添加到请求对象
      req.secureTenantFilter = tenantFilter;

      next();
    } catch (error) {
      console.error('租户过滤失败:', error);

      if (error.message === 'MISSING_TENANT_ID') {
        return res.status(403).json({
          success: false,
          message: '缺少租户信息，无法访问此资源',
          error: 'TENANT_ID_REQUIRED',
          code: 2010,
        });
      } else if (error.message === 'INVALID_TENANT_ID') {
        return res.status(400).json({
          success: false,
          message: '无效的租户ID',
          error: 'INVALID_TENANT_ID',
          code: 2011,
        });
      }

      return res.status(500).json({
        success: false,
        message: '租户验证失败',
        error: 'TENANT_VALIDATION_FAILED',
        code: 2012,
      });
    }
  };
};

/**
 * 权限增强检查
 * 确保用户只能访问其有权限的资源
 */
const enhancedPermissionCheck = requiredPermission => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '需要先登录',
          error: 'UNAUTHORIZED',
          code: 1010,
        });
      }

      // 超级管理员拥有所有权限
      if (req.user.role === 'super_admin') {
        return next();
      }

      // 检查基本权限
      const permissionMap = {
        // 资产管理权限
        manage_assets: ['system_admin', 'asset_admin'],
        view_assets: ['system_admin', 'asset_admin', 'department_admin', 'user'],

        // 用户管理权限
        manage_users: ['system_admin'],
        view_users: ['system_admin'],

        // 部门管理权限
        manage_departments: ['system_admin', 'department_admin'],
        view_departments: ['system_admin', 'department_admin', 'asset_admin'],

        // 计量管理权限
        manage_metrology: ['system_admin', 'asset_admin', 'metrology_admin'],
        view_metrology: ['system_admin', 'asset_admin', 'department_admin', 'user'],

        // 质量控制权限
        manage_quality_control: ['system_admin', 'asset_admin', 'quality_admin'],
        view_quality_control: ['system_admin', 'asset_admin', 'department_admin', 'user'],

        // 维修维护权限
        manage_maintenance: ['system_admin', 'asset_admin', 'maintenance_admin'],
        view_maintenance: ['system_admin', 'asset_admin', 'department_admin', 'user'],

        // 资产验收权限
        manage_acceptance: ['system_admin', 'asset_admin', 'acceptance_admin'],
        view_acceptance: ['system_admin', 'asset_admin', 'department_admin', 'user'],

        // 资产调配权限
        manage_transfer: ['system_admin', 'asset_admin', 'transfer_admin'],
        view_transfer: ['system_admin', 'asset_admin', 'department_admin', 'user'],

        // 资产盘点权限
        manage_inventory: ['system_admin', 'asset_admin', 'inventory_admin'],
        view_inventory: ['system_admin', 'asset_admin', 'department_admin', 'user'],
      };

      const allowedRoles = permissionMap[requiredPermission] || [];

      if (!allowedRoles.includes(req.user.role)) {
        console.warn(
          `🚫 权限拒绝: 用户 ${req.user.username} (${req.user.role}) 尝试访问需要 ${requiredPermission} 权限的资源`,
        );

        return res.status(403).json({
          success: false,
          message: '权限不足',
          error: 'INSUFFICIENT_PERMISSIONS',
          code: 1011,
          required_permission: requiredPermission,
          user_role: req.user.role,
        });
      }

      next();
    } catch (error) {
      console.error('权限检查失败:', error);
      return res.status(500).json({
        success: false,
        message: '权限检查失败',
        error: 'PERMISSION_CHECK_FAILED',
        code: 1012,
      });
    }
  };
};

/**
 * 请求频率限制中间件
 * 防止API被滥用
 */
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(); // 未认证用户不限制
      }

      const userId = req.user.id;
      const now = Date.now();
      const windowStart = now - windowMs;

      // 获取用户的请求记录
      if (!userRequests.has(userId)) {
        userRequests.set(userId, []);
      }

      const requests = userRequests.get(userId);

      // 清理过期的请求记录
      const validRequests = requests.filter(time => time > windowStart);
      userRequests.set(userId, validRequests);

      // 检查是否超过限制
      if (validRequests.length >= maxRequests) {
        console.warn(`🚫 频率限制: 用户 ${req.user.username} 请求过于频繁`);

        return res.status(429).json({
          success: false,
          message: '请求过于频繁，请稍后再试',
          error: 'RATE_LIMIT_EXCEEDED',
          code: 1013,
          retry_after: Math.ceil(windowMs / 1000),
        });
      }

      // 记录当前请求
      validRequests.push(now);
      userRequests.set(userId, validRequests);

      next();
    } catch (error) {
      console.error('频率限制检查失败:', error);
      next(); // 出错时允许请求继续
    }
  };
};

module.exports = {
  secureAuthenticate,
  secureTenantFilter,
  enhancedPermissionCheck,
  rateLimitByUser,
};
