const BaseService = require('../core/BaseService');

class PermissionService extends BaseService {
  constructor(options = {}) {
    super({ name: 'PermissionService', ...options });
  }

  async getRoleDataScope(role, tenantId) {
    const result = await this.findOne(
      'SELECT data_scope FROM role_data_scopes WHERE role = ? AND tenant_id = ?',
      [role, tenantId],
    );
    return result?.data_scope || 'own';
  }

  async setRoleDataScope(role, tenantId, dataScope) {
    const existing = await this.findOne(
      'SELECT id FROM role_data_scopes WHERE role = ? AND tenant_id = ?',
      [role, tenantId],
    );

    if (existing) {
      await this.execute(
        'UPDATE role_data_scopes SET data_scope = ?, updated_at = NOW() WHERE role = ? AND tenant_id = ?',
        [dataScope, role, tenantId],
      );
    } else {
      await this.execute(
        'INSERT INTO role_data_scopes (role, tenant_id, data_scope, created_at) VALUES (?, ?, ?, NOW())',
        [role, tenantId, dataScope],
      );
    }

    this.emitEvent('permission:data_scope_updated', { role, tenantId, dataScope });
    return { role, dataScope };
  }

  async getRolePermissions(role, tenantId) {
    const result = await this.findOne(
      'SELECT permissions FROM role_permissions WHERE role = ? AND tenant_id = ?',
      [role, tenantId],
    );
    if (!result || !result.permissions) return [];
    try {
      return typeof result.permissions === 'string' ? JSON.parse(result.permissions) : result.permissions;
    } catch {
      return [];
    }
  }

  async setRolePermissions(role, tenantId, permissions) {
    const permissionsJson = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);
    const existing = await this.findOne(
      'SELECT id FROM role_permissions WHERE role = ? AND tenant_id = ?',
      [role, tenantId],
    );

    if (existing) {
      await this.execute(
        'UPDATE role_permissions SET permissions = ?, updated_at = NOW() WHERE role = ? AND tenant_id = ?',
        [permissionsJson, role, tenantId],
      );
    } else {
      await this.execute(
        'INSERT INTO role_permissions (role, tenant_id, permissions, created_at) VALUES (?, ?, ?, NOW())',
        [role, tenantId, permissionsJson],
      );
    }

    this.emitEvent('permission:role_permissions_updated', { role, tenantId });
    return { role, permissions };
  }

  async getModulePermissions(moduleId, tenantId) {
    const result = await this.findOne(
      'SELECT permissions FROM module_permissions WHERE module_id = ? AND tenant_id = ?',
      [moduleId, tenantId],
    );
    if (!result || !result.permissions) return {};
    try {
      return typeof result.permissions === 'string' ? JSON.parse(result.permissions) : result.permissions;
    } catch {
      return {};
    }
  }

  async checkModuleAccess(moduleId, tenantId, role) {
    const permissions = await this.getModulePermissions(moduleId, tenantId);
    if (!permissions || Object.keys(permissions).length === 0) return true;
    return permissions[role] !== false;
  }

  async getUserAccessibleModules(userId, tenantId) {
    const result = await this.findMany(
      'SELECT module_id, permissions FROM module_permissions WHERE tenant_id = ?',
      [tenantId],
    );
    return result;
  }
}

module.exports = PermissionService;
