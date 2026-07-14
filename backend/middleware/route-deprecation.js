/**
 * 路由弃用中间件
 * 为旧版路由添加弃用警告头，引导前端迁移到模块路由
 */

const logger = require('../config/logger');
const { registry } = require('../core/route-registry');
const { createModuleRateLimiter } = require('./rate-limit');
const { runInModuleContext } = require('../core/module-context');

/**
 * 为旧路由添加弃用警告
 * @param {string} path - 路由路径
 * @param {string} migrationTarget - 迁移目标路径
 * @returns {Function} Express中间件
 */
function deprecationWarning(path, migrationTarget = null) {
  return (req, res, next) => {
    const warningMessage = migrationTarget
      ? `This API is deprecated. Please migrate to ${migrationTarget}`
      : 'This API is deprecated and will be removed in a future version';

    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.setHeader('Warning', `299 - "${warningMessage}"`);

    if (migrationTarget) {
      res.setHeader('Link', `<${migrationTarget}>; rel="successor-version"`);
    }

    logger.warn(`[Deprecation] 旧路由被访问: ${req.method} ${req.path} -> ${migrationTarget || '无迁移目标'}`);

    next();
  };
}

/**
 * 创建带弃用标记的路由包装器
 * @param {string} path - 路由挂载路径
 * @param {Function} router - Express路由
 * @param {string} migrationTarget - 迁移目标路径
 * @returns {Array} [中间件, 路由]
 */
function deprecatedRoute(path, router, migrationTarget = null) {
  registry.registerLegacyRoute(path, router, migrationTarget);
  return [deprecationWarning(path, migrationTarget), router];
}

/**
 * 创建模块路由包装器（推荐）
 * 自动为未受保护的模块注入模块上下文 + 模块级限流。
 * 已通过 createModuleRouter/protectModuleRouter 自保护的模块（router.__moduleRouteProtected 标记）跳过注入。
 * @param {string} path - 路由挂载路径
 * @param {string} moduleId - 模块ID
 * @param {Function} router - Express路由
 * @returns {Array} [中间件...] 用于 app.use(...moduleRoute(...)) 展开
 */
function moduleRoute(path, moduleId, router) {
  registry.registerModuleRoute(path, moduleId, router);

  // 已自保护的模块（createModuleRouter/protectModuleRouter）直接返回，避免重复注入
  if (router && router.__moduleRouteProtected) {
    return [router];
  }

  // 为未自保护的模块注入模块上下文 + 模块级限流
  const middlewares = [];

  if (moduleId) {
    const contextMiddleware = (req, res, next) => runInModuleContext(moduleId, next);
    middlewares.push(contextMiddleware);

    const moduleLimiter = createModuleRateLimiter(moduleId);
    if (moduleLimiter) {
      middlewares.push(moduleLimiter);
    }
  }

  middlewares.push(router);
  return middlewares;
}

module.exports = {
  deprecationWarning,
  deprecatedRoute,
  moduleRoute,
};
