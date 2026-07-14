const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SYSTEM_ADMIN: 'system_admin',
  ASSET_ADMIN: 'asset_admin',
  DEPARTMENT_ADMIN: 'department_admin',
  METROLOGY_ADMIN: 'metrology_admin',
  QUALITY_ADMIN: 'quality_admin',
  MAINTENANCE_ADMIN: 'maintenance_admin',
  MAINTENANCE_ENGINEER: 'maintenance_engineer',
  ACCEPTANCE_ADMIN: 'acceptance_admin',
  TRANSFER_ADMIN: 'transfer_admin',
  INVENTORY_ADMIN: 'inventory_admin',
  USER: 'user',
};

const ALL_ROLES = Object.values(ROLES);

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN];

const BUSINESS_ADMIN_ROLES = [
  ROLES.ASSET_ADMIN,
  ROLES.DEPARTMENT_ADMIN,
  ROLES.METROLOGY_ADMIN,
  ROLES.QUALITY_ADMIN,
  ROLES.MAINTENANCE_ADMIN,
  ROLES.ACCEPTANCE_ADMIN,
  ROLES.TRANSFER_ADMIN,
  ROLES.INVENTORY_ADMIN,
];

const SYSTEM_ROLES = [...ADMIN_ROLES, ...BUSINESS_ADMIN_ROLES];

const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: [],
  [ROLES.SYSTEM_ADMIN]: [ROLES.SUPER_ADMIN],
  [ROLES.ASSET_ADMIN]: [ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN],
  [ROLES.DEPARTMENT_ADMIN]: [ROLES.ASSET_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN],
  [ROLES.METROLOGY_ADMIN]: [ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN],
  [ROLES.QUALITY_ADMIN]: [ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN],
  [ROLES.MAINTENANCE_ADMIN]: [ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN],
  [ROLES.MAINTENANCE_ENGINEER]: [ROLES.MAINTENANCE_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN],
  [ROLES.ACCEPTANCE_ADMIN]: [ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN],
  [ROLES.TRANSFER_ADMIN]: [ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN],
  [ROLES.INVENTORY_ADMIN]: [ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN],
  [ROLES.USER]: [ROLES.DEPARTMENT_ADMIN, ROLES.ASSET_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN],
};

const DATA_SCOPES = {
  ALL: 'all',
  DEPARTMENT: 'department',
  CUSTOM: 'custom',
  OWN: 'own',
};

const DATA_SCOPE_LEVELS = {
  [DATA_SCOPES.ALL]: 4,
  [DATA_SCOPES.DEPARTMENT]: 3,
  [DATA_SCOPES.CUSTOM]: 2,
  [DATA_SCOPES.OWN]: 1,
};

const DEFAULT_ROLE_DATA_SCOPES = {
  [ROLES.SUPER_ADMIN]: DATA_SCOPES.ALL,
  [ROLES.SYSTEM_ADMIN]: DATA_SCOPES.ALL,
  [ROLES.ASSET_ADMIN]: DATA_SCOPES.DEPARTMENT,
  [ROLES.DEPARTMENT_ADMIN]: DATA_SCOPES.DEPARTMENT,
  [ROLES.METROLOGY_ADMIN]: DATA_SCOPES.DEPARTMENT,
  [ROLES.QUALITY_ADMIN]: DATA_SCOPES.DEPARTMENT,
  [ROLES.MAINTENANCE_ADMIN]: DATA_SCOPES.DEPARTMENT,
  [ROLES.MAINTENANCE_ENGINEER]: DATA_SCOPES.DEPARTMENT,
  [ROLES.ACCEPTANCE_ADMIN]: DATA_SCOPES.DEPARTMENT,
  [ROLES.TRANSFER_ADMIN]: DATA_SCOPES.DEPARTMENT,
  [ROLES.INVENTORY_ADMIN]: DATA_SCOPES.DEPARTMENT,
  [ROLES.USER]: DATA_SCOPES.OWN,
};

const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: ['*'],
  [ROLES.SYSTEM_ADMIN]: ['*'],
  [ROLES.ASSET_ADMIN]: [
    'asset.view_own_department', 'asset.edit_own_department', 'asset.add',
    'asset.delete_own_department', 'asset.export', 'image.upload', 'image.delete',
    'image.view', 'document.upload', 'document.download', 'document.link',
    'document.unlink', 'document.review', 'maintenance.view', 'maintenance.add',
    'maintenance.edit', 'statistics.view', 'transfer.view', 'transfer.apply',
    'inventory.view', 'inventory.create',
  ],
  [ROLES.DEPARTMENT_ADMIN]: [
    'asset.view_own_department', 'image.view', 'document.download',
    'maintenance.view', 'statistics.view',
  ],
  [ROLES.METROLOGY_ADMIN]: [
    'asset.view_own_department', 'quality_control.view_own_department', 'statistics.view',
  ],
  [ROLES.QUALITY_ADMIN]: [
    'asset.view_own_department', 'quality_control.view_all', 'quality_control.edit_all', 'statistics.view',
  ],
  [ROLES.MAINTENANCE_ADMIN]: [
    'asset.view_own_department', 'maintenance.view', 'maintenance.add', 'maintenance.edit',
    'maintenance.delete', 'maintenance.approve', 'statistics.view',
    'warranty.view', 'warranty.add', 'warranty.edit', 'warranty.delete',
    'warranty.contract.manage', 'warranty.invoice.manage', 'warranty.payment.manage',
    'warranty.archive.manage', 'warranty.reminder.manage',
  ],
  [ROLES.MAINTENANCE_ENGINEER]: [
    'asset.view_own_department', 'maintenance.view', 'maintenance.add', 'maintenance.edit',
    'statistics.view',
    'warranty.view', 'warranty.add', 'warranty.edit',
  ],
  [ROLES.ACCEPTANCE_ADMIN]: [
    'asset.view_own_department', 'asset.add', 'asset.edit_own_department',
    'statistics.view', 'image.view', 'document.upload', 'document.download',
  ],
  [ROLES.TRANSFER_ADMIN]: [
    'asset.view_own_department', 'transfer.view', 'transfer.apply', 'transfer.approve',
    'statistics.view', 'image.view',
  ],
  [ROLES.INVENTORY_ADMIN]: [
    'asset.view_own_department', 'inventory.view', 'inventory.create', 'inventory.edit',
    'inventory.complete', 'statistics.view', 'image.view',
  ],
  [ROLES.USER]: [],
};

const ROLE_DISPLAY_NAMES = {
  [ROLES.SUPER_ADMIN]: '超级管理员',
  [ROLES.SYSTEM_ADMIN]: '系统管理员',
  [ROLES.ASSET_ADMIN]: '资产管理员',
  [ROLES.DEPARTMENT_ADMIN]: '科室管理员',
  [ROLES.METROLOGY_ADMIN]: '计量管理员',
  [ROLES.QUALITY_ADMIN]: '质控管理员',
  [ROLES.MAINTENANCE_ADMIN]: '维修管理员',
  [ROLES.MAINTENANCE_ENGINEER]: '维修工程师',
  [ROLES.ACCEPTANCE_ADMIN]: '验收管理员',
  [ROLES.TRANSFER_ADMIN]: '调配管理员',
  [ROLES.INVENTORY_ADMIN]: '盘点管理员',
  [ROLES.USER]: '普通用户',
};

const ROLE_LEVELS = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.SYSTEM_ADMIN]: 90,
  [ROLES.ASSET_ADMIN]: 70,
  [ROLES.DEPARTMENT_ADMIN]: 60,
  [ROLES.METROLOGY_ADMIN]: 65,
  [ROLES.QUALITY_ADMIN]: 65,
  [ROLES.MAINTENANCE_ADMIN]: 65,
  [ROLES.MAINTENANCE_ENGINEER]: 50,
  [ROLES.ACCEPTANCE_ADMIN]: 65,
  [ROLES.TRANSFER_ADMIN]: 65,
  [ROLES.INVENTORY_ADMIN]: 65,
  [ROLES.USER]: 10,
};

function isSuperAdmin(user) {
  if (!user) return false;
  return user.is_super_admin === true || user.role === ROLES.SUPER_ADMIN;
}

function isSystemAdmin(user) {
  if (!user) return false;
  return user.role === ROLES.SYSTEM_ADMIN;
}

function isAdminRole(user) {
  if (!user) return false;
  return ADMIN_ROLES.includes(user.role);
}

function isBusinessAdminRole(role) {
  return BUSINESS_ADMIN_ROLES.includes(role);
}

function isSystemRole(role) {
  return SYSTEM_ROLES.includes(role);
}

function isValidRole(role) {
  return ALL_ROLES.includes(role);
}

function getRoleLevel(role) {
  return ROLE_LEVELS[role] || 0;
}

function hasHigherOrEqualRole(roleA, roleB) {
  return getRoleLevel(roleA) >= getRoleLevel(roleB);
}

function getRoleAncestors(role) {
  const ancestors = [];
  const visited = new Set();
  const queue = [role];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    const parents = ROLE_HIERARCHY[current] || [];
    for (const parent of parents) {
      if (!visited.has(parent)) {
        ancestors.push(parent);
        queue.push(parent);
      }
    }
  }

  return [...new Set(ancestors)];
}

function getDefaultDataScope(role) {
  return DEFAULT_ROLE_DATA_SCOPES[role] || DATA_SCOPES.OWN;
}

function getDefaultPermissions(role) {
  return DEFAULT_ROLE_PERMISSIONS[role] || [];
}

function getDataScopeLevel(scope) {
  return DATA_SCOPE_LEVELS[scope] || 0;
}

module.exports = {
  ROLES,
  ALL_ROLES,
  ADMIN_ROLES,
  BUSINESS_ADMIN_ROLES,
  SYSTEM_ROLES,
  ROLE_HIERARCHY,
  DATA_SCOPES,
  DATA_SCOPE_LEVELS,
  DEFAULT_ROLE_DATA_SCOPES,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_DISPLAY_NAMES,
  ROLE_LEVELS,
  isSuperAdmin,
  isSystemAdmin,
  isAdminRole,
  isBusinessAdminRole,
  isSystemRole,
  isValidRole,
  getRoleLevel,
  hasHigherOrEqualRole,
  getRoleAncestors,
  getDefaultDataScope,
  getDefaultPermissions,
  getDataScopeLevel,
};
