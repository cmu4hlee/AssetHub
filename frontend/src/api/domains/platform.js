import { api, apiWithBatching } from '../client';

export const systemConfigAPI = {
  // 系统状态
  getSystemStatus: () => api.get('/system-config/status'),
  getDatabaseConfig: () => api.get('/system-config/database'),
  updateDatabaseConfig: data => api.put('/system-config/database', data),
  testDatabaseConnection: data => api.post('/system-config/database/test', data),
  // 飞书配置
  getFeishuConfig: () => api.get('/system-config/feishu'),
  updateFeishuConfig: data => api.put('/system-config/feishu', data),
  testFeishuConnection: data => api.post('/system-config/feishu/test', data),
  // 邮件 SMTP 配置
  getEmailConfig: () => api.get('/system-config/email'),
  updateEmailConfig: data => api.put('/system-config/email', data),
  testEmailConnection: data => api.post('/system-config/email/test', data),
  // 企业 IoT Token 管理（对应后端 /system-config/iot-tokens/*）
  getIotTokenScopes: () => api.get('/system-config/iot-tokens/scopes'),
  getIotTokens: () => api.get('/system-config/iot-tokens'),
  getIotTokenUsageGuide: params => api.get('/system-config/iot-tokens/usage-guide', { params }),
  generateIotToken: data => api.post('/system-config/iot-tokens/generate', data),
  revokeIotToken: id => api.post(`/system-config/iot-tokens/${id}/revoke`),
  rotateIotToken: (id, data) => api.post(`/system-config/iot-tokens/${id}/rotate`, data),
  verifyIotToken: data => api.post('/system-config/iot-tokens/verify', data),
};

export const chatAPI = {
  getRooms: () => api.get('/chat-rooms'),
  createRoom: data => api.post('/chat-rooms', data),
  getRoomDetails: roomId => api.get(`/chat-rooms/${roomId}`),
  joinRoom: (roomId, data) => api.post(`/chat-rooms/${roomId}/join`, data),
  leaveRoom: (roomId, data) => api.post(`/chat-rooms/${roomId}/leave`, data),
  getRoomUsers: roomId => api.get(`/chat-rooms/${roomId}/users`),
  sendMessage: (roomId, data) => api.post(`/chat-rooms/${roomId}/messages`, data),
  getRoomMessages: (roomId, params) => api.get(`/chat-rooms/${roomId}/messages`, { params }),
  getOnlineUsers: () => api.get('/chat-rooms/online-users'),
  userOffline: userId => api.post(`/chat-rooms/users/${userId}/offline`),
};

export const moduleAPI = {
  registerModule: data => api.post('/modules/register', data),
  getModules: params => api.get('/modules/list', { params }),
  getModule: moduleId => api.get(`/modules/${moduleId}`),
  updateModule: (moduleId, data) => api.put(`/modules/${moduleId}`, data),
  deleteModule: moduleId => api.delete(`/modules/${moduleId}`),
  getModuleDependencies: moduleId => api.get(`/modules/${moduleId}/dependencies`),
  addModuleDependencies: (moduleId, data) => api.post(`/modules/${moduleId}/dependencies`, data),
  deleteModuleDependency: (moduleId, depId) => api.delete(`/modules/${moduleId}/dependencies/${depId}`),
  getModuleStatus: moduleId => api.get(`/modules/${moduleId}/status`),
  updateModuleStatus: (moduleId, data) => api.put(`/modules/${moduleId}/status`, data),
  getModuleLogs: (moduleId, params) => api.get(`/modules/${moduleId}/logs`, { params }),
  checkConflicts: params => api.get('/modules/check-conflicts', { params }),
  getDependencyGraph: params => api.get('/modules/dependency-graph', { params }),
};

export const moduleConfigAPI = {
  enableModule: data => apiWithBatching.post('/module-configs/enable', data),
  disableModule: data => apiWithBatching.post('/module-configs/disable', data),
  getModuleConfigs: params => apiWithBatching.get('/module-configs/list', { params }),
  getModuleConfig: moduleId => apiWithBatching.get(`/module-configs/${moduleId}`),
  updateModuleConfig: (moduleId, data) => apiWithBatching.put(`/module-configs/${moduleId}`, data),
  validateConfig: (moduleId, params) =>
    apiWithBatching.get(`/module-configs/${moduleId}/validate`, { params }),
  getConfigVersions: moduleId => apiWithBatching.get(`/module-configs/${moduleId}/versions`),
  createConfigVersion: (moduleId, data) =>
    apiWithBatching.post(`/module-configs/${moduleId}/versions`, data),
  rollbackConfig: (moduleId, data) => apiWithBatching.post(`/module-configs/${moduleId}/rollback`, data),
  compareVersions: (moduleId, versionId) =>
    apiWithBatching.get(`/module-configs/${moduleId}/versions/${versionId}/compare`),
  deleteConfigVersion: (moduleId, versionId) =>
    apiWithBatching.delete(`/module-configs/${moduleId}/versions/${versionId}`),
  backupConfig: moduleId => apiWithBatching.get(`/module-configs/${moduleId}/backup`),
  restoreConfig: (moduleId, data) => apiWithBatching.post(`/module-configs/${moduleId}/restore`, data),
  getModuleMenus: moduleId => apiWithBatching.get(`/module-configs/${moduleId}/menus`),
  updateModuleMenus: (moduleId, data) => apiWithBatching.put(`/module-configs/${moduleId}/menus`, data),
};

export const dashboardAPI = {
  getConfigs: () => api.get('/dashboard-configs'),
  getConfig: id => api.get(`/dashboard-configs/${id}`),
  getActiveConfig: () => api.get('/dashboard-configs/active'),
  createConfig: data => api.post('/dashboard-configs', data),
  updateConfig: (id, data) => api.put(`/dashboard-configs/${id}`, data),
  deleteConfig: id => api.delete(`/dashboard-configs/${id}`),
  getDashboardData: id => api.get(`/dashboard-configs/${id}/data`),
};

export const cloudSyncAPI = {
  getSources: () => api.get('/cloud-sync/sources'),
  createSource: data => api.post('/cloud-sync/sources', data),
  updateSource: (id, data) => api.put(`/cloud-sync/sources/${id}`, data),
  deleteSource: id => api.delete(`/cloud-sync/sources/${id}`),
  getEvents: params => api.get('/cloud-sync/events', { params }),
};

export const menuAPI = {
  getMenuTree: () => api.get('/menus/menu-tree'),
  getMenus: () => api.get('/menus/menus'),
  getBuiltinMenus: () => api.get('/menus/builtin-menus'),
  getDefaultMenus: () => api.get('/menus/default-menus'),
};

export const notificationAPI = {
  // 元数据
  getMetadata: () => api.get('/notifications/metadata'),
  // 模板
  getTemplates: params => api.get('/notifications/templates', { params }),
  getTemplate: id => api.get(`/notifications/templates/${id}`),
  createTemplate: data => api.post('/notifications/templates', data),
  updateTemplate: (id, data) => api.put(`/notifications/templates/${id}`, data),
  deleteTemplate: id => api.delete(`/notifications/templates/${id}`),
  // 规则
  getRules: params => api.get('/notifications/rules', { params }),
  getRule: id => api.get(`/notifications/rules/${id}`),
  createRule: data => api.post('/notifications/rules', data),
  updateRule: (id, data) => api.put(`/notifications/rules/${id}`, data),
  deleteRule: id => api.delete(`/notifications/rules/${id}`),
  testRule: (id, data) => api.post(`/notifications/rules/${id}/test`, data),
  // 发送记录
  getLogs: params => api.get('/notifications/logs', { params }),
  getLogStats: params => api.get('/notifications/logs/stats', { params }),
};
