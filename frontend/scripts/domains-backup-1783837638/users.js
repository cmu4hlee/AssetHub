import { api } from '../client';

export const userAPI = {
  login: data => api.post('/users/login', data),
  register: data => api.post('/users/register', data),
  getProfile: () => api.get('/users/profile'),
  getUsers: params => api.get('/users', { params }),
  getUser: id => api.get(`/users/${id}`),
  createUser: data => api.post('/users', data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deleteUser: id => api.delete(`/users/${id}`),
  changePassword: (id, data) => api.put(`/users/${id}/change-password`, data),
  getRoles: () => api.get('/users/roles'),
  joinEnterprise: data => api.post('/users/join-enterprise', data),
  getPendingRoleRequests: () => api.get('/users/role-requests/pending'),
  approveRoleRequest: (id, data) => api.put(`/users/role-requests/${id}/approve`, data),
  updateUserRole: (userId, data) => api.post(`/users/${userId}/roles`, data),
  deleteUserRole: (userId, tenantId) => api.delete(`/users/${userId}/roles/${tenantId}`),
  getUserRoles: userId => api.get(`/users/${userId}/roles`),
  sendVerificationCode: (phone, tenantOptions = {}) => {
    const { tenantId, tenantCode } = tenantOptions;
    const requestConfig = tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : undefined;
    return api.post('/sms-verification/send-code', { phone, tenant_code: tenantCode }, requestConfig);
  },
  verifyCode: (phone, code, tenantId) => api.post('/sms-verification/verify-code', { phone, code }, tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : undefined),
  loginWithCode: (phone, code, tenantId) => api.post('/sms-verification/login-with-code', { phone, code }, tenantId ? { headers: { 'X-Tenant-ID': tenantId } } : undefined),
};

export const rolesPermissionsAPI = {
  getPermissionDefinitions: () => api.get('/roles-permissions/permissions/definitions'),
  getPermissionList: () => api.get('/roles-permissions/permissions/list'),
  getRoles: () => api.get('/roles-permissions/roles'),
  getRolePermissions: role => api.get(`/roles-permissions/roles/${role}/permissions`),
  createRole: data => api.post('/roles-permissions/roles', data),
  updateRole: (role, data) => api.put(`/roles-permissions/roles/${role}`, data),
  deleteRole: role => api.delete(`/roles-permissions/roles/${role}`),
  updateRolePermissions: (role, permissions) =>
    api.put(`/roles-permissions/roles/${role}/permissions`, { permissions }),
  batchUpdateRolePermissions: rolePermissions =>
    api.put('/roles-permissions/roles/permissions/batch', { rolePermissions }),
  getUserPermissions: () => api.get('/roles-permissions/user/permissions'),
  checkPermission: permission => api.post('/roles-permissions/user/check-permission', { permission }),
  getMenuDefinitions: () => api.get('/roles-permissions/menus/definitions'),
  getMenuList: () => api.get('/roles-permissions/menus/list'),
  getRoleMenus: role => api.get(`/roles-permissions/roles/${role}/menus`),
  updateRoleMenus: (role, menuPermissions) =>
    api.put(`/roles-permissions/roles/${role}/menus`, { menuPermissions }),
  getUserMenus: () => api.get('/roles-permissions/user/menus'),
  forceUpdateMenus: () => api.post('/roles-permissions/menus/force-update'),
  getUsers: () => api.get('/users'),
};

export const enhancedPermissionsAPI = {
  getDataScopeDefinitions: () => api.get('/enhanced-permissions/data-scopes/definitions'),
  getRoleDataScope: role => api.get(`/enhanced-permissions/roles/${role}/data-scope`),
  setRoleDataScope: (role, data) => api.put(`/enhanced-permissions/roles/${role}/data-scope`, data),
  getUserDataScope: userId => api.get(`/enhanced-permissions/users/${userId}/data-scope`),
  setUserDataScope: (userId, data) =>
    api.put(`/enhanced-permissions/users/${userId}/data-scope`, data),
  getUserPermissions: userId => api.get(`/enhanced-permissions/users/${userId}/permissions`),
  addUserPermission: (userId, permission) =>
    api.post(`/enhanced-permissions/users/${userId}/permissions`, { permission }),
  removeUserPermission: (userId, permission) =>
    api.delete(`/enhanced-permissions/users/${userId}/permissions/${permission}`),
  denyUserPermission: (userId, permission) =>
    api.post(`/enhanced-permissions/users/${userId}/permissions/deny`, { permission }),
  removeUserPermissionDeny: (userId, permission) =>
    api.delete(`/enhanced-permissions/users/${userId}/permissions/deny/${permission}`),
  getUserMenuPermissions: userId => api.get(`/enhanced-permissions/users/${userId}/menu-permissions`),
  setUserMenuPermission: (userId, data) =>
    api.post(`/enhanced-permissions/users/${userId}/menu-permissions`, data),
  removeUserMenuPermission: (userId, menuKey) =>
    api.delete(`/enhanced-permissions/users/${userId}/menu-permissions/${menuKey}`),
  getAuditLogs: params => api.get('/enhanced-permissions/audit-logs', { params }),
  getResourcePermissions: params => api.get('/enhanced-permissions/resource-permissions', { params }),
};

export const tenantAPI = {
  getTenants: params => api.get('/tenants', { params }),
  getTenant: id => api.get(`/tenants/${id}`),
  createTenant: data => api.post('/tenants', data),
  updateTenant: (id, data) => api.put(`/tenants/${id}`, data),
  deleteTenant: id => api.delete(`/tenants/${id}`),
  getCurrentTenant: () => api.get('/tenants/current/info'),
};

export const departmentsAPI = {
  getDepartments: params => api.get('/departments', { params }),
  getDepartmentById: id => api.get(`/departments/${id}`),
  createDepartment: data => api.post('/departments', data),
  updateDepartment: (id, data) => api.put(`/departments/${id}`, data),
  deleteDepartment: id => api.delete(`/departments/${id}`),
};
