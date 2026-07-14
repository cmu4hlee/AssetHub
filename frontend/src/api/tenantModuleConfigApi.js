import api from '../utils/api';

export const tenantModuleConfigAPI = {
  getTenants: params => api.get('/tenant-module-config/tenants', { params }),
  getTenantModules: tenantId => api.get(`/tenant-module-config/tenants/${tenantId}/modules`),
  getModuleDependencies: moduleId => api.get(`/tenant-module-config/modules/${moduleId}/dependencies`),
  getModuleMenus: (tenantId, moduleId) =>
    api.get(`/tenant-module-config/tenants/${tenantId}/modules/${moduleId}/menus`),
  getConfigLogs: params => api.get('/tenant-module-config/logs', { params }),
  checkModuleDependencies: (moduleId, action) =>
    api.post(`/tenant-module-config/modules/${moduleId}/check-dependencies`, { action }),
  updateTenantModules: (tenantId, modules) =>
    api.put(`/tenant-module-config/tenants/${tenantId}/modules`, modules),
  updateTenantModuleMenus: (tenantId, moduleId, menus) =>
    api.put(`/tenant-module-config/tenants/${tenantId}/modules/${moduleId}/menus`, menus),
};

