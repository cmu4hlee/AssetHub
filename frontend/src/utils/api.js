import api from '../api/client';
export { api, getApiErrorMessage, normalizeApiMessage } from '../api/client';

export { i18nAPI } from '../api/domains/i18n';

export { assetAPI, assetImageAPI, depreciationAPI, financeAPI } from '../api/domains/assets';
export { sparePartsAPI, maintenanceAPI as monitoringMaintenanceAPI, metrologyAPI } from '../api/domains/monitoring';

export {
  inventoryAPI,
  transferAPI,
  idleAPI,
  scrappingAPI,
} from '../api/domains/asset-operations';

// 从 assets.js 导出完整版本（包含监控方法、正确的 /iot/devices 路径等）
export {
  tempAssetAPI,
  locationCodeAPI,
  assetLocationAPI,
  iotDeviceAPI,
  assetAIAnalysisAPI,
  assetLabelAPI,
} from '../api/domains/assets';

export { userAPI, rolesPermissionsAPI, enhancedPermissionsAPI, tenantAPI, departmentsAPI } from '../api/domains/users';

export {
  maintenanceAPI,
  acceptanceAPI,
  acceptanceManagementAPI,
  qualityControlAPI,
  adverseReactionAPI,
  aiAPI,
} from '../api/domains/maintenance';

export { poctAPI } from '../api/domains/poct';

// 保修管理（独立模块，2026-07-16 从 maintenance 拆出）
export { warrantyAPI } from '../api/domains/warranty';

export { technicalDocumentsAPI, technicalDocumentsAI, auditLogsAPI, backupAPI } from '../api/domains/documents';
export { knowledgeBaseAPI } from '../api/domains/knowledgeBase';

export {
  systemConfigAPI,
  moduleAPI,
  moduleConfigAPI,
  dashboardAPI,
  cloudSyncAPI,
  notificationAPI,
} from '../api/domains/platform';

export { wechatMpAPI } from '../api/domains/wechat-mp';

export { complianceAPI, riskAPI, staffAPI, uptimeAPI } from '../api/domains/modules';

export { inspectionAPI } from '../api/domains/inspection';

export { default as desktopPrefsAPI } from '../api/domains/desktop-preferences';

// 智能预警 API
export const intelligentAlertAPI = {
  getOverview: () => api.get('/intelligent-alerts/overview'),
  getAlerts: params => api.get('/intelligent-alerts', { params }),
  markAsRead: (alertId, data) => api.post(`/intelligent-alerts/${alertId}/read`, data),
  markAsHandled: (alertId, data) => api.post(`/intelligent-alerts/${alertId}/handle`, data),
  unhandleAlert: alertId => api.post(`/intelligent-alerts/${alertId}/unhandle`),
  markAllAsRead: data => api.post('/intelligent-alerts/read-all', data),
  markAllAsHandled: data => api.post('/intelligent-alerts/handle-all', data),
  getSettings: () => api.get('/intelligent-alerts/settings'),
  updateSettings: data => api.post('/intelligent-alerts/settings', data),
};

// 站内消息 API（WebSocket 落库的历史消息）
export const inAppNotificationAPI = {
  list: params => api.get('/in-app-notifications', { params }),
  unreadCount: params => api.get('/in-app-notifications/unread-count', { params }),
  markAsRead: id => api.post(`/in-app-notifications/${id}/read`),
  markAllAsRead: data => api.post('/in-app-notifications/read-all', data || {}),
  batchRead: ids => api.post('/in-app-notifications/batch-read', { ids }),
  remove: id => api.delete(`/in-app-notifications/${id}`),
  batchRemove: ids => api.delete('/in-app-notifications/batch', { data: { ids } }),
  clearRead: () => api.post('/in-app-notifications/clear-read'),
};

// 接收人策略 API
export const recipientStrategyAPI = {
  getMeta: () => api.get('/recipient-strategies/meta'),
  list: params => api.get('/recipient-strategies', { params }),
  getForEvent: eventCode => api.get(`/recipient-strategies/event/${eventCode}`),
  create: data => api.post('/recipient-strategies', data),
  update: (id, data) => api.put(`/recipient-strategies/${id}`, data),
  remove: id => api.delete(`/recipient-strategies/${id}`),
  batchDelete: ids => api.post('/recipient-strategies/batch-delete', { ids }),
  preview: (eventCode, payload) =>
    api.post('/recipient-strategies/preview', { eventCode, payload }),
};

// 通知偏好 API（DND / 紧急度阈值）
export const notificationPreferenceAPI = {
  getMeta: () => api.get('/notification-preferences/meta'),
  getMine: () => api.get('/notification-preferences/me'),
  getEffective: eventCode => api.get('/notification-preferences/me/effective', { params: eventCode ? { eventCode } : {} }),
  upsert: data => api.post('/notification-preferences', data),
  remove: id => api.delete(`/notification-preferences/${id}`),
  preview: (urgency, now, eventCode) => api.post('/notification-preferences/preview', { urgency, now, eventCode }),
  getForUser: userId => api.get(`/notification-preferences/user/${userId}`),
};

export default api;
