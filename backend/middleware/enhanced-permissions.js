const PermissionService = require('../services/permission.service');
const { getDatabase } = require('../core/DatabaseInterface');

const permissionService = new PermissionService({ db: getDatabase() });

const dataScopes = {
  ALL: 'all',
  DEPARTMENT: 'department',
  OWN: 'own',
  CUSTOM: 'custom',
};

const actions = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  EXPORT: 'export',
  IMPORT: 'import',
};

const dataScopePermissions = {
  VIEW_ALL_DATA: 'view_all_data',
  VIEW_DEPARTMENT_DATA: 'view_department_data',
  VIEW_OWN_DATA: 'view_own_data',
  EDIT_ALL_DATA: 'edit_all_data',
  EDIT_DEPARTMENT_DATA: 'edit_department_data',
  EDIT_OWN_DATA: 'edit_own_data',
  DELETE_ALL_DATA: 'delete_all_data',
  DELETE_DEPARTMENT_DATA: 'delete_department_data',
  DELETE_OWN_DATA: 'delete_own_data',
  APPROVE_ALL_DATA: 'approve_all_data',
  APPROVE_DEPARTMENT_DATA: 'approve_department_data',
  EXPORT_ALL_DATA: 'export_all_data',
  EXPORT_DEPARTMENT_DATA: 'export_department_data',
};

async function getRoleDataScope(role, tenantId) {
  try {
    // 多租户：优先读 tenant_role_data_scopes（per-tenant 覆盖）
    if (tenantId) {
      try {
        const database = getDatabase();
        const rows = await database.execute(
          'SELECT data_scope FROM tenant_role_data_scopes WHERE tenant_id = ? AND role = ? LIMIT 1',
          [tenantId, role],
        );
        const result = Array.isArray(rows) ? rows[0] : rows;
        if (result && result.length > 0) {
          return result[0].data_scope;
        }
      } catch (e) {
        // tenant_role_data_scopes 表不存在等：忽略，继续回退
      }
    }

    const dataScope = await permissionService.getRoleDataScope(role, tenantId);
    if (dataScope && dataScope !== 'own') return dataScope;

    const roleDataScopes = {
      'super_admin': dataScopes.ALL,
      'system_admin': dataScopes.ALL,
      'asset_admin': dataScopes.DEPARTMENT,
      'department_admin': dataScopes.DEPARTMENT,
      'user': dataScopes.OWN,
    };

    return roleDataScopes[role] || dataScopes.OWN;
  } catch (error) {
    console.error('获取角色数据范围失败:', error);
    return dataScopes.OWN;
  }
}

async function getUserDataScope(userId, tenantId) {
  try {
    const result = await permissionService.findOne(
      'SELECT data_scope, custom_department_codes FROM user_data_scopes WHERE user_id = ? AND tenant_id = ?',
      [userId, tenantId],
    );

    if (result) {
      return {
        scope: result.data_scope,
        customDepartments: result.custom_department_codes
          ? result.custom_department_codes.split(',')
          : [],
      };
    }

    return null;
  } catch (error) {
    console.error('获取用户数据范围失败:', error);
    return null;
  }
}

const requireDataScope = (requiredScope, resourceType) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: '需要先登录' });
      }

      const {user} = req;
      const tenantId = user.tenant_id;

      if (user.is_super_admin || user.role === 'super_admin' || user.role === 'system_admin') {
        return next();
      }

      const userDataScope = await getUserDataScope(user.id, tenantId);
      const effectiveScope = userDataScope?.scope || await getRoleDataScope(user.role, tenantId);

      const scopeHierarchy = {
        [dataScopes.ALL]: 4,
        [dataScopes.DEPARTMENT]: 3,
        [dataScopes.CUSTOM]: 2,
        [dataScopes.OWN]: 1,
      };

      const requiredLevel = scopeHierarchy[requiredScope] || 1;
      const effectiveLevel = scopeHierarchy[effectiveScope] || 1;

      if (effectiveLevel < requiredLevel) {
        return res.status(403).json({
          success: false,
          message: `需要${requiredScope}权限才能访问此${resourceType}`,
          required_scope: requiredScope,
          current_scope: effectiveScope,
        });
      }

      if (effectiveScope === dataScopes.CUSTOM && userDataScope?.customDepartments?.length > 0) {
        req.user.custom_departments = userDataScope.customDepartments;
      }

      req.user.data_scope = effectiveScope;
      next();
    } catch (error) {
      console.error('数据范围验证失败:', error);
      return res.status(500).json({ success: false, message: '数据范围验证失败' });
    }
  };
};

const requireAction = (action, resource) => {
  const permissionMap = {
    [`${actions.CREATE}_${resource}`]: [`create_${resource}`, `edit_${resource}`, `manage_${resource}`],
    [`${actions.READ}_${resource}`]: [`view_${resource}`, `edit_${resource}`, `manage_${resource}`, `view_all_${resource}`, `view_department_${resource}`, `view_own_${resource}`],
    [`${actions.UPDATE}_${resource}`]: [`edit_${resource}`, `manage_${resource}`, `edit_all_${resource}`, `edit_department_${resource}`, `edit_own_${resource}`],
    [`${actions.DELETE}_${resource}`]: [`delete_${resource}`, `manage_${resource}`, `delete_all_${resource}`, `delete_department_${resource}`, `delete_own_${resource}`],
    [`${actions.APPROVE}_${resource}`]: [`approve_${resource}`, `manage_${resource}`, `approve_all_${resource}`],
    [`${actions.EXPORT}_${resource}`]: [`export_${resource}`, `manage_${resource}`, `export_all_${resource}`, `export_department_${resource}`],
    [`${actions.IMPORT}_${resource}`]: [`import_${resource}`, `manage_${resource}`],
  };

  const requiredPermissions = permissionMap[`${action}_${resource}`] || [`${action}_${resource}`];

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: '需要先登录' });
      }

      if (req.user.is_super_admin || req.user.role === 'super_admin' || req.user.role === 'system_admin') {
        return next();
      }

      const userPermissions = req.user.permissions || [];
      const hasPermission = requiredPermissions.some(p =>
        userPermissions.includes(p) || userPermissions.includes('manage_all'),
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `没有${action}此${resource}的权限`,
          required: requiredPermissions,
          current: userPermissions,
        });
      }

      next();
    } catch (error) {
      console.error('操作权限验证失败:', error);
      return res.status(500).json({ success: false, message: '操作权限验证失败' });
    }
  };
};

const checkTimeBasedAccess = (allowedHours = null, allowedDays = null) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: '需要先登录' });
      }

      if (req.user.is_super_admin || req.user.role === 'super_admin') {
        return next();
      }

      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay();

      const effectiveAllowedHours = allowedHours || [0, 23];
      const effectiveAllowedDays = allowedDays || [1, 2, 3, 4, 5];

      if (currentHour < effectiveAllowedHours[0] || currentHour > effectiveAllowedHours[1]) {
        return res.status(403).json({
          success: false,
          message: '当前时间不在允许访问的时间范围内',
          allowed_hours: effectiveAllowedHours,
          current_hour: currentHour,
        });
      }

      if (!effectiveAllowedDays.includes(currentDay)) {
        return res.status(403).json({
          success: false,
          message: '当前日期不在允许访问的日期范围内',
          allowed_days: effectiveAllowedDays,
          current_day: currentDay,
        });
      }

      next();
    } catch (error) {
      console.error('时间访问验证失败:', error);
      return res.status(500).json({ success: false, message: '时间访问验证失败' });
    }
  };
};

async function getRoleHierarchy(role) {
  const roleHierarchy = {
    'super_admin': [],
    'system_admin': ['super_admin'],
    'asset_admin': ['system_admin', 'super_admin'],
    'department_admin': ['asset_admin', 'system_admin', 'super_admin'],
    'user': ['department_admin', 'asset_admin', 'system_admin', 'super_admin'],
  };

  const ancestors = roleHierarchy[role] || [];

  for (const ancestor of ancestors) {
    const parentAncestors = await getRoleHierarchy(ancestor);
    ancestors.push(...parentAncestors);
  }

  return [...new Set(ancestors)];
}

async function getInheritedPermissions(role, tenantId) {
  try {
    const ancestors = await getRoleHierarchy(role);
    const allPermissions = new Set();

    for (const ancestorRole of ancestors) {
      const rows = await permissionService.findMany(
        'SELECT permission FROM role_permissions WHERE role = ?',
        [ancestorRole],
      );
      rows.forEach(p => allPermissions.add(p.permission));
    }

    return Array.from(allPermissions);
  } catch (error) {
    console.error('获取继承权限失败:', error);
    return [];
  }
}

async function getUserAllPermissions(userId, tenantId, role) {
  try {
    const rolePermissions = new Set();
    const userPermissions = new Set();

    const rolePerms = await permissionService.findMany(
      'SELECT permission FROM role_permissions WHERE role = ?',
      [role],
    );
    rolePerms.forEach(p => rolePermissions.add(p.permission));

    const inheritedPermissions = await getInheritedPermissions(role, tenantId);
    inheritedPermissions.forEach(p => rolePermissions.add(p));

    const userPerms = await permissionService.findMany(
      'SELECT permission FROM user_permissions WHERE user_id = ? AND tenant_id = ?',
      [userId, tenantId],
    );
    userPerms.forEach(p => userPermissions.add(p.permission));

    const userDeniedPerms = new Set();
    const deniedPerms = await permissionService.findMany(
      'SELECT permission FROM user_permission_denies WHERE user_id = ? AND tenant_id = ?',
      [userId, tenantId],
    );
    deniedPerms.forEach(p => userDeniedPerms.add(p.permission));

    const finalPermissions = new Set([...rolePermissions, ...userPermissions]);
    userDeniedPerms.forEach(p => finalPermissions.delete(p));

    return Array.from(finalPermissions);
  } catch (error) {
    console.error('获取用户所有权限失败:', error);
    return [];
  }
}

async function getUserMenuPermissions(userId, tenantId, role) {
  try {
    const userMenus = new Set();
    const menus = await permissionService.findMany(
      'SELECT menu_key FROM user_menu_permissions WHERE user_id = ? AND tenant_id = ?',
      [userId, tenantId],
    );
    menus.forEach(m => userMenus.add(m.menu_key));

    const roleMenus = new Set();
    const roleMenuPerms = await permissionService.findMany(
      'SELECT menu_key FROM role_menu_permissions WHERE role = ?',
      [role],
    );
    roleMenuPerms.forEach(m => roleMenus.add(m.menu_key));

    const allMenus = new Set([...roleMenus, ...userMenus]);
    return Array.from(allMenus);
  } catch (error) {
    console.error('获取用户菜单权限失败:', error);
    return [];
  }
}

async function setUserDataScope(userId, tenantId, dataScope, customDepartments = null) {
  try {
    await permissionService.execute(
      `INSERT INTO user_data_scopes (user_id, tenant_id, data_scope, custom_department_codes, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE data_scope = ?, custom_department_codes = ?, updated_at = NOW()`,
      [userId, tenantId, dataScope, customDepartments, dataScope, customDepartments],
    );
    return true;
  } catch (error) {
    console.error('设置用户数据范围失败:', error);
    return false;
  }
}

async function addUserPermission(userId, tenantId, permission) {
  try {
    await permissionService.execute(
      'INSERT INTO user_permissions (user_id, tenant_id, permission, created_at) VALUES (?, ?, ?, NOW())',
      [userId, tenantId, permission],
    );
    return true;
  } catch (error) {
    console.error('添加用户权限失败:', error);
    return false;
  }
}

async function denyUserPermission(userId, tenantId, permission) {
  try {
    await permissionService.execute(
      `INSERT INTO user_permission_denies (user_id, tenant_id, permission, created_at)
       VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE created_at = NOW()`,
      [userId, tenantId, permission],
    );
    return true;
  } catch (error) {
    console.error('拒绝用户权限失败:', error);
    return false;
  }
}

async function removeUserPermission(userId, tenantId, permission) {
  try {
    await permissionService.execute(
      'DELETE FROM user_permissions WHERE user_id = ? AND tenant_id = ? AND permission = ?',
      [userId, tenantId, permission],
    );
    return true;
  } catch (error) {
    console.error('移除用户权限失败:', error);
    return false;
  }
}

async function removeUserPermissionDeny(userId, tenantId, permission) {
  try {
    await permissionService.execute(
      'DELETE FROM user_permission_denies WHERE user_id = ? AND tenant_id = ? AND permission = ?',
      [userId, tenantId, permission],
    );
    return true;
  } catch (error) {
    console.error('移除权限拒绝失败:', error);
    return false;
  }
}

module.exports = {
  dataScopes,
  actions,
  dataScopePermissions,
  getRoleDataScope,
  getUserDataScope,
  requireDataScope,
  requireAction,
  checkTimeBasedAccess,
  getRoleHierarchy,
  getInheritedPermissions,
  getUserAllPermissions,
  getUserMenuPermissions,
  setUserDataScope,
  addUserPermission,
  denyUserPermission,
  removeUserPermission,
  removeUserPermissionDeny,
};
