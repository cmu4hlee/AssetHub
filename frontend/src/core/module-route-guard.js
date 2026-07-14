/**
 * 模块路由守卫
 * 基于模块启用状态动态控制路由访问
 */

import { MODULE_REGISTRY, isModuleEnabled, getModuleDependencies, areDependenciesMet } from './module-registry';

// 模块ID到路由分组的映射
const MODULE_ROUTE_GROUP_MAP = {
  'assets': 'asset-management',
  'inventory': 'inventory-management',
  'transfer': 'asset-management',
  'idle': 'asset-management',
  'maintenance': 'maintenance-management',
  'quality': 'quality-control',
  'documents': 'technical-documents',
  'iot': 'iot-management',
  'ai': 'asset-ai-assistant',
  'compliance': 'compliance-management',
  'risk': 'asset-risk-management',
  'staff': 'staff-qualification',
  'uptime': 'uptime-management',
  'users': 'user-management',
  'dashboard': 'system',
  'system': 'system',
  'tendering': 'tendering-management',
  'procurement': 'procurement-management',
};

// moduleId -> groupId 反向映射，用于将 moduleId 转换为 MODULE_REGISTRY 的 key
const MODULE_ID_TO_GROUP_ID = (() => {
  const mapping = {};
  for (const [groupId, moduleId] of Object.entries(MODULE_ROUTE_GROUP_MAP)) {
    if (!mapping[moduleId]) {
      mapping[moduleId] = groupId;
    }
  }
  return mapping;
})();

/**
 * 检查路由是否可访问
 * @param {string} path - 路由路径
 * @param {Array<string>} enabledModules - 已启用的模块ID列表
 * @returns {Object} { accessible: boolean, reason?: string, redirect?: string }
 */
export function checkRouteAccess(path, enabledModules) {
  // 公开路由始终可访问
  if (path === '/login' || path === '/register' || path === '/tenant-association') {
    return { accessible: true };
  }

  // 系统路由始终可访问
  if (path.startsWith('/system') || path === '/dashboard' || path === '/dashboard-desktop') {
    return { accessible: true };
  }

  // 查找路径对应的模块
  const moduleId = resolveModuleByPath(path);
  if (!moduleId) {
    // 未匹配到模块的路由，允许访问（向后兼容）
    return { accessible: true };
  }

  // moduleId 需要转换为 groupId 才能查 MODULE_REGISTRY
  const groupId = MODULE_ID_TO_GROUP_ID[moduleId] || moduleId;

  // 检查模块是否启用
  if (!isModuleEnabled(groupId)) {
    return {
      accessible: false,
      reason: `模块 ${MODULE_REGISTRY[groupId]?.name || moduleId} 未启用`,
      redirect: '/dashboard',
    };
  }

  // 检查依赖是否满足
  if (!areDependenciesMet(groupId, enabledModules)) {
    const deps = getModuleDependencies(groupId);
    const missing = deps.filter(d => !enabledModules.includes(d));
    return {
      accessible: false,
      reason: `缺少依赖模块: ${missing.join(', ')}`,
      redirect: '/dashboard',
    };
  }

  return { accessible: true };
}

/**
 * 根据路径解析模块ID
 * @param {string} pathname - 路径名
 * @returns {string|null}
 */
export function resolveModuleByPath(pathname) {
  for (const [groupId, moduleId] of Object.entries(MODULE_ROUTE_GROUP_MAP)) {
    const config = MODULE_REGISTRY[groupId];
    if (config && config.routePrefix) {
      const prefix = config.routePrefix;
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        return moduleId;
      }
    }
  }
  return null;
}

/**
 * 过滤路由列表，只保留可访问的路由
 * @param {Array} routes - 路由列表
 * @param {Array<string>} enabledModules - 已启用的模块ID列表
 * @returns {Array}
 */
export function filterAccessibleRoutes(routes, enabledModules) {
  return routes.filter(route => {
    const result = checkRouteAccess(route.path, enabledModules);
    return result.accessible;
  });
}

/**
 * 获取模块路由配置（用于动态路由加载）
 * @param {string} moduleId - 模块ID
 * @param {Array<string>} enabledModules - 已启用的模块ID列表
 * @returns {Object|null}
 */
export function getModuleRouteConfig(moduleId, enabledModules) {
  if (!isModuleEnabled(moduleId)) return null;
  if (!areDependenciesMet(moduleId, enabledModules)) return null;

  const config = MODULE_REGISTRY[moduleId];
  if (!config) return null;

  return {
    id: moduleId,
    name: config.name,
    routePrefix: config.routePrefix,
    icon: config.icon,
  };
}

/**
 * 获取所有可访问的模块路由配置
 * @param {Array<string>} enabledModules - 已启用的模块ID列表
 * @returns {Array}
 */
export function getAccessibleModuleConfigs(enabledModules) {
  return Object.keys(MODULE_REGISTRY)
    .map(id => getModuleRouteConfig(id, enabledModules))
    .filter(Boolean);
}
