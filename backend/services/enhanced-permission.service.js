const BaseService = require('../core/BaseService');
const { AppError } = require('../utils/error-handler');

class EnhancedPermissionService extends BaseService {
  constructor(options = {}) {
    super({ name: 'EnhancedPermissionService', ...options });
  }

  /**
   * 获取数据权限范围定义
   */
  getDataScopeDefinitions() {
    return [
      { value: 'all', label: '全部数据', desc: '可以查看和操作所有数据' },
      { value: 'department', label: '本部门数据', desc: '只能查看和操作所属部门的数据' },
      { value: 'custom', label: '自定义部门', desc: '只能查看和操作指定部门的数据' },
      { value: 'own', label: '仅本人数据', desc: '只能查看和操作自己创建/负责的数据' },
    ];
  }

  /**
   * 获取角色的数据权限范围
   */
  async getRoleDataScope(role, tenantId) {
    if (!tenantId || tenantId <= 0) {
      throw new AppError('无效的租户ID', 400, 'INVALID_TENANT_ID');
    }

    const result = await this.findOne(
      'SELECT data_scope, custom_departments FROM role_data_scopes WHERE role = ? AND tenant_id = ?',
      [role, tenantId],
    );

    if (!result) {
      // 返回默认值
      return {
        data_scope: 'department',
        custom_departments: [],
      };
    }

    return {
      data_scope: result.data_scope || 'department',
      custom_departments: result.custom_departments ? JSON.parse(result.custom_departments) : [],
    };
  }

  /**
   * 设置角色的数据权限范围
   */
  async setRoleDataScope(role, tenantId, dataScope, customDepartments = []) {
    if (!tenantId || tenantId <= 0) {
      throw new AppError('无效的租户ID', 400, 'INVALID_TENANT_ID');
    }

    const validScopes = ['all', 'department', 'custom', 'own'];
    if (!validScopes.includes(dataScope)) {
      throw new AppError('无效的数据权限范围', 400, 'INVALID_DATA_SCOPE');
    }

    if (dataScope === 'custom' && (!customDepartments || customDepartments.length === 0)) {
      throw new AppError('自定义部门数据权限范围必须指定部门', 400, 'MISSING_CUSTOM_DEPARTMENTS');
    }

    const customDeptsJson = JSON.stringify(customDepartments);

    const existing = await this.findOne(
      'SELECT id FROM role_data_scopes WHERE role = ? AND tenant_id = ?',
      [role, tenantId],
    );

    if (existing) {
      await this.execute(
        'UPDATE role_data_scopes SET data_scope = ?, custom_departments = ?, updated_at = NOW() WHERE role = ? AND tenant_id = ?',
        [dataScope, customDeptsJson, role, tenantId],
      );
    } else {
      await this.execute(
        'INSERT INTO role_data_scopes (role, tenant_id, data_scope, custom_departments, created_at) VALUES (?, ?, ?, ?, NOW())',
        [role, tenantId, dataScope, customDeptsJson],
      );
    }

    this.emitEvent('permission:data_scope_updated', { role, tenantId, dataScope });
    return { role, data_scope: dataScope, custom_departments: customDepartments };
  }

  /**
   * 获取用户的数据权限范围
   */
  async getUserDataScope(userId, tenantId) {
    if (!tenantId || tenantId <= 0) {
      throw new AppError('无效的租户ID', 400, 'INVALID_TENANT_ID');
    }

    // 首先检查用户是否有自定义数据范围
    const userScope = await this.findOne(
      'SELECT data_scope, custom_departments FROM user_data_scopes WHERE user_id = ? AND tenant_id = ?',
      [userId, tenantId],
    );

    if (userScope) {
      return {
        data_scope: userScope.data_scope || 'department',
        custom_departments: userScope.custom_departments ? JSON.parse(userScope.custom_departments) : [],
        is_custom: true,
      };
    }

    // 如果没有自定义，则获取用户角色的数据范围
    const userRoles = await this.findMany(
      'SELECT role FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ? AND status = ?',
      [userId, tenantId, 'active'],
    );

    if (!userRoles || userRoles.length === 0) {
      return {
        data_scope: 'own',
        custom_departments: [],
        is_custom: false,
      };
    }

    // 取角色中最高权限的数据范围
    const scopeLevels = { all: 4, department: 3, custom: 2, own: 1 };
    let maxScope = 'own';
    let maxLevel = 1;

    for (const userRole of userRoles) {
      const roleScope = await this.getRoleDataScope(userRole.role, tenantId);
      const level = scopeLevels[roleScope.data_scope] || 1;
      if (level > maxLevel) {
        maxLevel = level;
        maxScope = roleScope.data_scope;
      }
    }

    return {
      data_scope: maxScope,
      custom_departments: [],
      is_custom: false,
    };
  }

  /**
   * 设置用户的数据权限范围
   */
  async setUserDataScope(userId, tenantId, dataScope, customDepartments = []) {
    if (!tenantId || tenantId <= 0) {
      throw new AppError('无效的租户ID', 400, 'INVALID_TENANT_ID');
    }

    const validScopes = ['all', 'department', 'custom', 'own'];
    if (!validScopes.includes(dataScope)) {
      throw new AppError('无效的数据权限范围', 400, 'INVALID_DATA_SCOPE');
    }

    if (dataScope === 'custom' && (!customDepartments || customDepartments.length === 0)) {
      throw new AppError('自定义部门数据权限范围必须指定部门', 400, 'MISSING_CUSTOM_DEPARTMENTS');
    }

    const customDeptsJson = JSON.stringify(customDepartments);

    const existing = await this.findOne(
      'SELECT id FROM user_data_scopes WHERE user_id = ? AND tenant_id = ?',
      [userId, tenantId],
    );

    if (existing) {
      await this.execute(
        'UPDATE user_data_scopes SET data_scope = ?, custom_departments = ?, updated_at = NOW() WHERE user_id = ? AND tenant_id = ?',
        [dataScope, customDeptsJson, userId, tenantId],
      );
    } else {
      await this.execute(
        'INSERT INTO user_data_scopes (user_id, tenant_id, data_scope, custom_departments, created_at) VALUES (?, ?, ?, ?, NOW())',
        [userId, tenantId, dataScope, customDeptsJson],
      );
    }

    this.emitEvent('permission:user_data_scope_updated', { userId, tenantId, dataScope });
    return { user_id: userId, data_scope: dataScope, custom_departments: customDepartments };
  }

  /**
   * 获取用户的所有权限（角色权限 + 用户个人权限）
   */
  async getUserPermissions(userId, tenantId) {
    if (!tenantId || tenantId <= 0) {
      throw new AppError('无效的租户ID', 400, 'INVALID_TENANT_ID');
    }

    // 获取用户角色
    const userRoles = await this.findMany(
      'SELECT role FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ? AND status = ?',
      [userId, tenantId, 'active'],
    );

    if (!userRoles || userRoles.length === 0) {
      return [];
    }

    // 收集所有角色的权限
    const allPermissions = new Set();

    for (const userRole of userRoles) {
      const rolePerms = await this.findOne(
        'SELECT permissions FROM role_permissions WHERE role = ? AND tenant_id = ?',
        [userRole.role, tenantId],
      );

      if (rolePerms && rolePerms.permissions) {
        try {
          const perms = typeof rolePerms.permissions === 'string'
            ? JSON.parse(rolePerms.permissions)
            : rolePerms.permissions;
          perms.forEach(p => allPermissions.add(p));
        } catch (e) {
          console.error('解析角色权限失败:', e);
        }
      }
    }

    // 获取用户个人额外权限
    const userPerms = await this.findMany(
      'SELECT permission, is_allowed FROM user_permissions WHERE user_id = ? AND tenant_id = ?',
      [userId, tenantId],
    );

    for (const perm of userPerms) {
      if (perm.is_allowed) {
        allPermissions.add(perm.permission);
      } else {
        allPermissions.delete(perm.permission);
      }
    }

    return Array.from(allPermissions);
  }

  /**
   * 检查用户是否有特定权限
   */
  async checkUserPermission(userId, tenantId, permission) {
    const permissions = await this.getUserPermissions(userId, tenantId);
    return permissions.includes('*') || permissions.includes(permission);
  }

  /**
   * 添加用户个人权限
   */
  async addUserPermission(userId, tenantId, permission) {
    if (!tenantId || tenantId <= 0) {
      throw new AppError('无效的租户ID', 400, 'INVALID_TENANT_ID');
    }

    const existing = await this.findOne(
      'SELECT id FROM user_permissions WHERE user_id = ? AND tenant_id = ? AND permission = ?',
      [userId, tenantId, permission],
    );

    if (existing) {
      await this.execute(
        'UPDATE user_permissions SET is_allowed = 1, updated_at = NOW() WHERE user_id = ? AND tenant_id = ? AND permission = ?',
        [userId, tenantId, permission],
      );
    } else {
      await this.execute(
        'INSERT INTO user_permissions (user_id, tenant_id, permission, is_allowed, created_at) VALUES (?, ?, ?, 1, NOW())',
        [userId, tenantId, permission],
      );
    }

    this.emitEvent('permission:user_permission_added', { userId, tenantId, permission });
    return { user_id: userId, permission, is_allowed: true };
  }

  /**
   * 移除用户个人权限
   */
  async removeUserPermission(userId, tenantId, permission) {
    if (!tenantId || tenantId <= 0) {
      throw new AppError('无效的租户ID', 400, 'INVALID_TENANT_ID');
    }

    await this.execute(
      'DELETE FROM user_permissions WHERE user_id = ? AND tenant_id = ? AND permission = ? AND is_allowed = 1',
      [userId, tenantId, permission],
    );

    this.emitEvent('permission:user_permission_removed', { userId, tenantId, permission });
    return { user_id: userId, permission };
  }

  /**
   * 拒绝用户权限（显式拒绝）
   */
  async denyUserPermission(userId, tenantId, permission) {
    if (!tenantId || tenantId <= 0) {
      throw new AppError('无效的租户ID', 400, 'INVALID_TENANT_ID');
    }

    const existing = await this.findOne(
      'SELECT id FROM user_permissions WHERE user_id = ? AND tenant_id = ? AND permission = ?',
      [userId, tenantId, permission],
    );

    if (existing) {
      await this.execute(
        'UPDATE user_permissions SET is_allowed = 0, updated_at = NOW() WHERE user_id = ? AND tenant_id = ? AND permission = ?',
        [userId, tenantId, permission],
      );
    } else {
      await this.execute(
        'INSERT INTO user_permissions (user_id, tenant_id, permission, is_allowed, created_at) VALUES (?, ?, ?, 0, NOW())',
        [userId, tenantId, permission],
      );
    }

    this.emitEvent('permission:user_permission_denied', { userId, tenantId, permission });
    return { user_id: userId, permission, is_allowed: false };
  }

  /**
   * 获取用户的菜单权限
   */
  async getUserMenuPermissions(userId, tenantId) {
    if (!tenantId || tenantId <= 0) {
      throw new AppError('无效的租户ID', 400, 'INVALID_TENANT_ID');
    }

    // 获取用户角色
    const userRoles = await this.findMany(
      'SELECT role FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ? AND status = ?',
      [userId, tenantId, 'active'],
    );

    if (!userRoles || userRoles.length === 0) {
      return {};
    }

    // 收集所有角色的菜单权限
    const allMenus = {};

    for (const userRole of userRoles) {
      const roleMenus = await this.findOne(
        'SELECT menu_permissions FROM role_menu_permissions WHERE role = ? AND tenant_id = ?',
        [userRole.role, tenantId],
      );

      if (roleMenus && roleMenus.menu_permissions) {
        try {
          const menus = typeof roleMenus.menu_permissions === 'string'
            ? JSON.parse(roleMenus.menu_permissions)
            : roleMenus.menu_permissions;
          Object.assign(allMenus, menus);
        } catch (e) {
          console.error('解析角色菜单权限失败:', e);
        }
      }
    }

    return allMenus;
  }

  /**
   * 设置用户菜单权限
   */
  async setUserMenuPermission(userId, tenantId, menuKey, isVisible) {
    if (!tenantId || tenantId <= 0) {
      throw new AppError('无效的租户ID', 400, 'INVALID_TENANT_ID');
    }

    const existing = await this.findOne(
      'SELECT id FROM user_menu_permissions WHERE user_id = ? AND tenant_id = ? AND menu_key = ?',
      [userId, tenantId, menuKey],
    );

    if (existing) {
      await this.execute(
        'UPDATE user_menu_permissions SET is_visible = ?, updated_at = NOW() WHERE user_id = ? AND tenant_id = ? AND menu_key = ?',
        [isVisible ? 1 : 0, userId, tenantId, menuKey],
      );
    } else {
      await this.execute(
        'INSERT INTO user_menu_permissions (user_id, tenant_id, menu_key, is_visible, created_at) VALUES (?, ?, ?, ?, NOW())',
        [userId, tenantId, menuKey, isVisible ? 1 : 0],
      );
    }

    this.emitEvent('permission:user_menu_updated', { userId, tenantId, menuKey, isVisible });
    return { user_id: userId, menu_key: menuKey, is_visible: isVisible };
  }

  /**
   * 获取审计日志
   */
  async getAuditLogs(tenantId, { page = 1, pageSize = 20, userId, action, startDate, endDate } = {}) {
    if (!tenantId || tenantId <= 0) {
      throw new AppError('无效的租户ID', 400, 'INVALID_TENANT_ID');
    }

    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    let whereClause = 'WHERE tenant_id = ?';
    const params = [tenantId];

    if (userId) {
      whereClause += ' AND user_id = ?';
      params.push(userId);
    }

    if (action) {
      whereClause += ' AND action = ?';
      params.push(action);
    }

    if (startDate) {
      whereClause += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND created_at <= ?';
      params.push(endDate);
    }

    const countResult = await this.findOne(
      `SELECT COUNT(*) as total FROM permission_audit_logs ${whereClause}`,
      params,
    );
    const { total } = countResult;

    const logs = await this.findMany(
      `SELECT * FROM permission_audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    return {
      data: logs,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize)),
      },
    };
  }
}

module.exports = EnhancedPermissionService;
