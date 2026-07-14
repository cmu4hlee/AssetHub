/**
 * 模块路由包装器
 * 为所有模块路由自动注入：
 * 1. 认证中间件 (authenticate)
 * 2. 租户过滤中间件 (tenantFilterMiddleware)
 * 3. 模块权限检查 (requireModuleAccess)
 * 4. 错误隔离中间件 (moduleIsolationMiddleware)
 * 5. 数据访问守卫 (dataAccessGuard)
 */

const { authenticate } = require('../middleware/auth');
const { tenantFilterMiddleware } = require('../middleware/tenant-filter');
const { requireModuleAccess } = require('../middleware/module-permission');
const { moduleIsolationMiddleware, asyncHandler } = require('../middleware/module-error-handler');
const { createModuleRateLimiter } = require('../middleware/rate-limit');
const { dataAccessGuard } = require('./data-access-guard');
const { runInModuleContext } = require('./module-context');
const logger = require('../config/logger');

/**
 * 创建受保护的模块路由
 * @param {string} moduleId - 模块ID
 * @param {Function} routerFactory - 路由工厂函数 (router) => void
 * @param {Object} options - 配置选项
 * @param {boolean} options.requireAuth - 是否需要认证（默认true）
 * @param {boolean} options.requireTenant - 是否需要租户过滤（默认true）
 * @param {boolean} options.requireModule - 是否需要模块权限检查（默认true）
 * @param {boolean} options.isolation - 是否启用错误隔离（默认true）
 * @param {boolean} options.dataGuard - 是否启用数据访问守卫（默认true）
 * @param {boolean} options.rateLimit - 是否启用模块级限流（默认true）
 * @returns {express.Router}
 */
function createModuleRouter(moduleId, routerFactory, options = {}) {
  const {
    requireAuth = true,
    requireTenant = true,
    requireModule = true,
    isolation = true,
    dataGuard = true,
    rateLimit: enableModuleRateLimit = true, // 模块级限流（默认启用）
  } = options;

  const express = require('express');
  const router = express.Router();

  // 0. 模块上下文中间件：通过 AsyncLocalStorage 将 moduleId 传播到 DB 层，
  //    使数据库层能按模块统计连接、执行配额隔离、审计跨模块表访问
  if (moduleId) {
    router.use((req, res, next) => {
      runInModuleContext(moduleId, next);
    });
  }

  // 0.5 模块级限流：每个模块独立配额，单个模块被刷爆不会耗尽全局配额
  if (moduleId && enableModuleRateLimit) {
    const moduleLimiter = createModuleRateLimiter(moduleId);
    if (moduleLimiter) {
      router.use(moduleLimiter);
    }
  }

  // 1. 认证中间件
  if (requireAuth) {
    router.use(authenticate);
  }

  // 2. 租户过滤中间件
  if (requireTenant) {
    router.use(tenantFilterMiddleware());
  }

  // 3. 模块权限检查中间件
  if (requireModule && moduleId && moduleId !== 'system') {
    router.use(requireModuleAccess(moduleId));
  }

  // 4. 数据访问守卫
  if (dataGuard && moduleId) {
    router.use(dataAccessGuard(moduleId));
  }

  // 5. 错误隔离中间件
  if (isolation) {
    router.use(moduleIsolationMiddleware(moduleId));
  }

  // 6. 注册模块路由
  routerFactory(router);

  // 标记此 router 已受模块保护，避免 moduleRoute 重复注入中间件
  router.__moduleRouteProtected = moduleId;

  logger.debug(`模块路由已创建: ${moduleId}`);
  return router;
}

/**
 * 包装异步路由处理函数，自动捕获异常
 * @param {Function} fn - 异步处理函数
 * @returns {Function} Express中间件
 */
function wrapAsync(fn) {
  return asyncHandler(fn);
}

/**
 * 为现有路由添加模块保护（用于迁移旧路由）
 * 将认证、租户过滤、权限检查、数据访问守卫、错误隔离中间件应用到路由
 * @param {express.Router} router - Express路由实例
 * @param {string} moduleId - 模块ID
 * @param {Object} options - 配置选项
 * @returns {Array} 已应用的中间件数组（兼容旧调用方）
 */
function protectModuleRouter(router, moduleId, options = {}) {
  const {
    requireAuth = true,
    requireTenant = true,
    requireModule = true,
    isolation = true,
    dataGuard = true,
    rateLimit: enableModuleRateLimit = true, // 模块级限流（默认启用）
  } = options;

  const middlewares = [];

  // 0. 模块上下文中间件（必须最先执行）：通过 AsyncLocalStorage 传播 moduleId
  if (moduleId) {
    const contextMiddleware = (req, res, next) => runInModuleContext(moduleId, next);
    middlewares.push(contextMiddleware);
    router.use(contextMiddleware);
  }

  // 0.5 模块级限流：每个模块独立配额，单个模块被刷爆不会耗尽全局配额
  if (moduleId && enableModuleRateLimit) {
    const moduleLimiter = createModuleRateLimiter(moduleId);
    if (moduleLimiter) {
      middlewares.push(moduleLimiter);
      router.use(moduleLimiter);
    }
  }

  // 1. 认证中间件
  if (requireAuth) {
    middlewares.push(authenticate);
    router.use(authenticate);
  }

  // 2. 租户过滤中间件
  if (requireTenant) {
    const tenantMw = tenantFilterMiddleware();
    middlewares.push(tenantMw);
    router.use(tenantMw);
  }

  // 3. 模块权限检查中间件
  if (requireModule && moduleId && moduleId !== 'system') {
    const accessMw = requireModuleAccess(moduleId);
    middlewares.push(accessMw);
    router.use(accessMw);
  }

  // 4. 数据访问守卫
  if (dataGuard && moduleId) {
    const guardMw = dataAccessGuard(moduleId);
    middlewares.push(guardMw);
    router.use(guardMw);
  }

  // 5. 错误隔离中间件
  if (isolation) {
    const isolationMw = moduleIsolationMiddleware(moduleId);
    middlewares.push(isolationMw);
    router.use(isolationMw);
  }

  // 标记此 router 已受模块保护，避免 moduleRoute 重复注入中间件
  if (moduleId) {
    router.__moduleRouteProtected = moduleId;
  }

  return middlewares;
}

module.exports = {
  createModuleRouter,
  wrapAsync,
  protectModuleRouter,
};
