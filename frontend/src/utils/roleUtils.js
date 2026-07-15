/**
 * 角色相关工具函数
 */
import crypto from './crypto';

// ==================== 角色定义 ====================

// 管理员角色列表
export const ADMIN_ROLES = ['super_admin', 'system_admin'];

// 业务管理员角色列表（拥有比普通用户更多的权限）
export const BUSINESS_ADMIN_ROLES = [
  'asset_admin',
  'department_admin',
  'metrology_admin',
  'quality_admin',
  'maintenance_admin',
  'maintenance_engineer',
  'acceptance_admin',
  'transfer_admin',
  'inventory_admin',
];

// 所有系统角色列表
export const ALL_SYSTEM_ROLES = [...ADMIN_ROLES, ...BUSINESS_ADMIN_ROLES, 'user'];

// 角色显示名称映射
export const ROLE_DISPLAY_NAMES = {
  super_admin: '超级管理员',
  system_admin: '系统管理员',
  asset_admin: '资产管理员',
  department_admin: '科室管理员',
  metrology_admin: '计量管理员',
  quality_admin: '质量管理员',
  maintenance_admin: '维护管理员',
  maintenance_engineer: '维修工程师',
  acceptance_admin: '验收管理员',
  transfer_admin: '调配管理员',
  inventory_admin: '盘点管理员',
  user: '普通用户',
};

// 角色权限级别（数字越大权限越高）
export const ROLE_LEVELS = {
  super_admin: 100,
  system_admin: 90,
  asset_admin: 70,
  department_admin: 60,
  metrology_admin: 65,
  quality_admin: 65,
  maintenance_admin: 65,
  maintenance_engineer: 50,
  acceptance_admin: 65,
  transfer_admin: 65,
  inventory_admin: 65,
  user: 10,
};

// ==================== 角色检查函数 ====================

/**
 * 检查是否为管理员角色
 * @param {string} role - 用户角色
 * @returns {boolean} 是否为管理员
 */
export const isAdminRole = role => ADMIN_ROLES.includes(role);

export const isSuperAdmin = user => {
  if (!user) return false;
  return user.is_super_admin === true || user.role === 'super_admin';
};

export const isBusinessAdminRole = role => BUSINESS_ADMIN_ROLES.includes(role);

/**
 * 检查是否为系统角色
 * @param {string} role - 用户角色
 * @returns {boolean} 是否为系统角色
 */
export const isSystemRole = role => ALL_SYSTEM_ROLES.includes(role);

/**
 * 获取角色显示名称
 * @param {string} role - 角色代码
 * @returns {string} 显示名称
 */
export const getRoleDisplayName = role => ROLE_DISPLAY_NAMES[role] || role || '未知角色';

/**
 * 获取角色权限级别
 * @param {string} role - 角色代码
 * @returns {number} 权限级别
 */
export const getRoleLevel = role => ROLE_LEVELS[role] || 0;

/**
 * 比较两个角色的权限级别
 * @param {string} roleA - 角色A
 * @param {string} roleB - 角色B
 * @returns {number} 正数表示A权限更高，负数表示B权限更高，0表示相等
 */
export const compareRoleLevel = (roleA, roleB) => getRoleLevel(roleA) - getRoleLevel(roleB);

/**
 * 检查角色A是否拥有比角色B更高的或相等的权限
 * @param {string} roleA - 角色A
 * @param {string} roleB - 角色B
 * @returns {boolean}
 */
export const hasHigherOrEqualRole = (roleA, roleB) => compareRoleLevel(roleA, roleB) >= 0;

// ==================== 菜单权限检查 ====================

/**
 * 超级管理员专属菜单key列表
 */
export const SUPER_ADMIN_ONLY_MENUS = ['/system-settings', '/database-connection', '/api-docs', '/api-documentation'];

/**
 * 检查是否为超级管理员专属菜单
 * @param {string} menuKey - 菜单路径
 * @returns {boolean} 是否为超级管理员专属
 */
export const isSuperAdminOnlyMenu = menuKey => SUPER_ADMIN_ONLY_MENUS.includes(menuKey);

/**
 * 检查用户是否有访问指定菜单的权限
 * @param {Object} user - 用户对象
 * @param {string} menuKey - 菜单路径
 * @param {string[]} visibleMenuKeys - 用户可见的菜单键列表
 * @param {boolean} menuPermissionLoaded - 权限是否已加载
 * @returns {boolean} 是否有权限
 */
export const canAccessMenu = (user, menuKey, visibleMenuKeys = [], menuPermissionLoaded = false) => {
  // 超级管理员总是可以访问所有菜单
  if (user?.role === 'super_admin') return true;

  // 超级管理员专属菜单检查
  if (isSuperAdminOnlyMenu(menuKey) && user?.role !== 'super_admin') {
    return false;
  }

  // 管理员总是可以访问非超级管理员专属菜单
  if (isAdminRole(user?.role)) return true;

  // 权限未加载时默认允许（避免页面闪烁）
  if (!menuPermissionLoaded) return true;

  // 可见菜单为空时允许（兼容旧版本）
  if (!visibleMenuKeys || visibleMenuKeys.length === 0) return true;

  // 检查是否在可见菜单中
  return visibleMenuKeys.includes(menuKey);
};

/**
 * 检查用户是否可以访问某个功能模块
 * @param {Object} user - 用户对象
 * @param {string} moduleId - 模块ID
 * @returns {boolean}
 */
export const canAccessModule = (user, moduleId) => {
  if (!user || !moduleId) return false;

  // 超级管理员可以访问所有模块
  if (user.role === 'super_admin') return true;

  // 检查用户启用的模块列表
  const enabledModules = user.enabled_modules || [];
  if (enabledModules.includes(moduleId)) return true;

  // 某些模块有依赖关系
  const moduleFallbacks = {
    'safety-inspection-management': ['compliance-management'],
    'asset-risk-management': ['compliance-management'],
    'staff-qualification': ['compliance-management'],
    'uptime-management': ['compliance-management'],
    'iot-geo-location-management': ['iot-management'],
    'iot-zone-location-management': ['iot-management'],
    'iot-asset-monitoring-management': ['iot-management'],
    'iot-environment-monitoring-management': ['iot-management'],
    'iot-patient-volume-management': ['iot-management'],
  };

  const fallbacks = moduleFallbacks[moduleId] || [];
  return fallbacks.some(fallbackId => enabledModules.includes(fallbackId));
};

// ==================== 用户相关函数 ====================

/**
 * 从localStorage获取当前用户
 * @returns {Object|null} 用户对象
 */
export const getCurrentUser = () => {
  return crypto.getItem('user');
};

/**
 * 检查当前用户是否为管理员
 * @returns {boolean} 是否为管理员
 */
export const isCurrentUserAdmin = () => {
  const user = getCurrentUser();
  return isAdminRole(user?.role);
};

/**
 * 检查当前用户是否为超级管理员
 * @returns {boolean} 是否为超级管理员
 */
export const isCurrentUserSuperAdmin = () => {
  const user = getCurrentUser();
  return user?.role === 'super_admin';
};

/**
 * 获取当前用户的角色显示名称
 * @returns {string}
 */
export const getCurrentUserRoleDisplayName = () => {
  const user = getCurrentUser();
  return getRoleDisplayName(user?.role);
};

/**
 * 检查当前用户是否拥有指定角色或更高级别
 * @param {string} requiredRole - 要求的最低角色
 * @returns {boolean}
 */
export const currentUserHasRole = requiredRole => {
  const user = getCurrentUser();
  if (!user?.role) return false;
  return hasHigherOrEqualRole(user.role, requiredRole);
};
