/**
 * 路由注册中心
 * 统一管理新旧路由体系，逐步迁移到模块体系
 * 旧路由标记为 deprecated，优先使用 modules/ 下的模块路由
 */

const logger = require('../config/logger');

class RouteRegistry {
  constructor() {
    this.routes = new Map();
    this.deprecatedRoutes = new Set();
    this.moduleRoutes = new Map();
  }

  /**
   * 注册模块路由（推荐）
   * @param {string} path - 路由路径
   * @param {string} moduleId - 模块ID
   * @param {Function} router - Express路由
   */
  registerModuleRoute(path, moduleId, router) {
    this.moduleRoutes.set(path, { moduleId, router });
    logger.info(`[RouteRegistry] 模块路由已注册: ${path} -> ${moduleId}`);
  }

  /**
   * 注册旧版路由（标记为 deprecated）
   * @param {string} path - 路由路径
   * @param {Function} router - Express路由
   * @param {string} migrationTarget - 迁移目标模块路径
   */
  registerLegacyRoute(path, router, migrationTarget = null) {
    this.routes.set(path, { router, migrationTarget, isLegacy: true });
    this.deprecatedRoutes.add(path);
    logger.warn(`[RouteRegistry] ⚠️ 旧路由已注册(deprecated): ${path}${migrationTarget ? ` -> 请迁移到: ${migrationTarget}` : ''}`);
  }

  /**
   * 检查路径是否已注册模块路由
   * @param {string} path - 路由路径
   * @returns {boolean}
   */
  hasModuleRoute(path) {
    return this.moduleRoutes.has(path);
  }

  /**
   * 检查路径是否为旧版路由
   * @param {string} path - 路由路径
   * @returns {boolean}
   */
  isDeprecated(path) {
    return this.deprecatedRoutes.has(path);
  }

  /**
   * 获取所有已注册的路由信息
   * @returns {Array}
   */
  getAllRoutes() {
    const result = [];

    for (const [path, info] of this.moduleRoutes) {
      result.push({
        path,
        type: 'module',
        moduleId: info.moduleId,
        status: 'active',
      });
    }

    for (const [path, info] of this.routes) {
      result.push({
        path,
        type: 'legacy',
        migrationTarget: info.migrationTarget,
        status: 'deprecated',
      });
    }

    return result;
  }

  /**
   * 生成迁移报告
   * @returns {Object}
   */
  generateMigrationReport() {
    const legacyRoutes = [];
    const moduleRoutes = [];

    for (const [path, info] of this.routes) {
      legacyRoutes.push({
        path,
        migrationTarget: info.migrationTarget,
      });
    }

    for (const [path, info] of this.moduleRoutes) {
      moduleRoutes.push({
        path,
        moduleId: info.moduleId,
      });
    }

    return {
      summary: {
        totalLegacy: legacyRoutes.length,
        totalModule: moduleRoutes.length,
        migrationProgress: moduleRoutes.length / (legacyRoutes.length + moduleRoutes.length),
      },
      legacyRoutes,
      moduleRoutes,
    };
  }
}

const registry = new RouteRegistry();

module.exports = {
  RouteRegistry,
  registry,
};
