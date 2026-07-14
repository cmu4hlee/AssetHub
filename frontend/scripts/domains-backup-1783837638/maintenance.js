import { api, apiWithBatching } from '../client';
import { normalizeListResult } from '../normalizers';

const AI_ASSISTANT_TIMEOUT_MS = 10 * 60 * 1000;
const getNormalizedList = request => request.then(normalizeListResult);

export const maintenanceAPI = {
  getMaintenanceLogs: params => getNormalizedList(api.get('/maintenance/logs', { params })),
  getMaintenanceStatistics: params => api.get('/maintenance/statistics', { params }),
  getMaintenanceLog: id => api.get(`/maintenance/logs/${id}`),
  createMaintenanceLog: data => api.post('/maintenance/logs', data),
  updateMaintenanceLog: (id, data) => api.put(`/maintenance/logs/${id}`, data),
  deleteMaintenanceLog: id => api.delete(`/maintenance/logs/${id}`),
  getMaintenanceLogAttachments: logId =>
    getNormalizedList(api.get(`/maintenance/logs/${logId}/attachments`)),
  uploadMaintenanceLogAttachment: (logId, formData) => {
    return api.post(`/maintenance/logs/${logId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    })
      .then(response => response.data)
      .catch(error => {
        console.error('上传附件 API 错误:', error);
        if (error.response) {
          return Promise.reject({
            success: false,
            message: error.response.data?.message || error.response.data?.error || '上传失败',
            error: error.response.data,
          });
        }
        if (error.request) {
          return Promise.reject({
            success: false,
            message: '网络错误，请检查服务器连接',
          });
        }
        return Promise.reject({
          success: false,
          message: error.message || '上传失败',
        });
      });
  },
  deleteMaintenanceLogAttachment: (logId, attachmentId) => {
    return api.delete(`/maintenance/logs/${logId}/attachments/${attachmentId}`);
  },
  downloadMaintenanceLogAttachment: async (logId, attachmentId, fileName) => {
    try {
      const response = await api.get(`/maintenance/logs/${logId}/attachments/${attachmentId}/download`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || '附件';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      return { success: true };
    } catch (error) {
      console.error('下载附件失败:', error);
      let errorMessage = '下载失败';

      if (error.response && error.response.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          errorMessage = errorData.message || '下载失败';
        } catch (e) {
          errorMessage = error.response.status === 401 ? '缺少认证令牌' : '下载失败';
        }
      } else if (error.response && error.response.data) {
        errorMessage = error.response.data.message || '下载失败';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return { success: false, message: errorMessage };
    }
  },

  getMaintenanceRequestAttachments: requestId =>
    getNormalizedList(api.get(`/maintenance/requests/${requestId}/attachments`)),
  uploadMaintenanceRequestAttachment: (requestId, formData) => {
    return api.post(`/maintenance/requests/${requestId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    })
      .then(response => response.data)
      .catch(error => {
        console.error('上传维修申请附件 API 错误:', error);
        if (error.response) {
          return Promise.reject({
            success: false,
            message: error.response.data?.message || error.response.data?.error || '上传失败',
            error: error.response.data,
          });
        }
        if (error.request) {
          return Promise.reject({
            success: false,
            message: '网络错误，请检查服务器连接',
          });
        }
        return Promise.reject({
          success: false,
          message: error.message || '上传失败',
        });
      });
  },
  deleteMaintenanceRequestAttachment: (requestId, attachmentId) =>
    api.delete(`/maintenance/requests/${requestId}/attachments/${attachmentId}`),
  downloadMaintenanceRequestAttachment: async (requestId, attachmentId, fileName) => {
    try {
      const response = await api.get(
        `/maintenance/requests/${requestId}/attachments/${attachmentId}/download`,
        { responseType: 'blob' },
      );
      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || '附件';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      return { success: true };
    } catch (error) {
      console.error('下载维修申请附件失败:', error);
      let errorMessage = '下载失败';
      if (error.response && error.response.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          errorMessage = errorData.message || '下载失败';
        } catch (e) {
          errorMessage = error.response.status === 401 ? '缺少认证令牌' : '下载失败';
        }
      } else if (error.response && error.response.data) {
        errorMessage = error.response.data.message || '下载失败';
      } else if (error.message) {
        errorMessage = error.message;
      }
      return { success: false, message: errorMessage };
    }
  },

  getMaintenancePlans: params => getNormalizedList(api.get('/maintenance/plans', { params })),
  getMaintenancePlan: id => api.get(`/maintenance/plans/${id}`),
  createMaintenancePlan: data => api.post('/maintenance/plans', data),
  updateMaintenancePlan: (id, data) => api.put(`/maintenance/plans/${id}`, data),
  completeMaintenancePlan: (id, data) => api.post(`/maintenance/plans/${id}/complete`, data),
  deleteMaintenancePlan: id => api.delete(`/maintenance/plans/${id}`),
  getMaintenancePlanHistory: id => api.get(`/maintenance/plans/${id}/history`),

  getMaintenanceRequests: params => getNormalizedList(api.get('/maintenance/requests', { params })),
  getMaintenanceRequest: id => api.get(`/maintenance/requests/${id}`),
  createMaintenanceRequest: data => api.post('/maintenance/requests', data),
  submitAIMaintenanceRequest: data => api.post('/maintenance/ai/submit-request', data),
  updateMaintenanceRequest: (id, data) => api.put(`/maintenance/requests/${id}`, data),
  approveMaintenanceRequest: (id, data) => api.post(`/maintenance/requests/${id}/approve`, data),
  startMaintenanceRequest: (id, data) => api.post(`/maintenance/requests/${id}/start`, data),
  completeMaintenanceRequest: (id, data) => api.post(`/maintenance/requests/${id}/complete`, data),
  cancelMaintenanceRequest: id => api.post(`/maintenance/requests/${id}/cancel`),
  deleteMaintenanceRequest: id => api.delete(`/maintenance/requests/${id}`),

  getMaintenanceTemplates: params => getNormalizedList(api.get('/maintenance/templates', { params })),
  getMaintenanceTemplate: id => api.get(`/maintenance/templates/${id}`),
  createMaintenanceTemplate: data => api.post('/maintenance/templates', data),
  updateMaintenanceTemplate: (id, data) => api.put(`/maintenance/templates/${id}`, data),
  deleteMaintenanceTemplate: id => api.delete(`/maintenance/templates/${id}`),
  recommendMaintenanceTemplates: params =>
    getNormalizedList(api.get('/maintenance/templates/recommend', { params })),

  getEfficiencyOverview: params => api.get('/maintenance/efficiency/overview', { params }),
  getEfficiencyResponseTime: params => api.get('/maintenance/efficiency/response-time', { params }),
  getEfficiencyTechnician: params => api.get('/maintenance/efficiency/technician', { params }),
  getEfficiencyAssetFrequency: params => api.get('/maintenance/efficiency/asset-frequency', { params }),

  getMaintenanceReminders: params => getNormalizedList(api.get('/maintenance/reminders', { params })),
  sendMaintenanceReminder: data => api.post('/maintenance/reminders/send', data),
  configMaintenanceReminder: data => api.post('/maintenance/reminders/config', data),
  checkMaintenanceReminders: () => api.get('/maintenance/reminders/check'),

  getSecondaryAssetTypes: params =>
    getNormalizedList(api.get('/maintenance/asset-types/secondary', { params })),

  getMaintenanceWorkOrders: params => getNormalizedList(api.get('/maintenance/workorders', { params })),
  getMaintenanceWorkOrder: id => api.get(`/maintenance/workorders/${id}`),
  createMaintenanceWorkOrder: data => api.post('/maintenance/workorders', data),
  updateMaintenanceWorkOrder: (id, data) => api.put(`/maintenance/workorders/${id}`, data),
  deleteMaintenanceWorkOrder: id => api.delete(`/maintenance/workorders/${id}`),
  assignMaintenanceWorkOrder: (id, data) => api.post(`/maintenance/workorders/${id}/assign`, data),
  startMaintenanceWorkOrder: (id, data) => api.post(`/maintenance/workorders/${id}/start`, data),
  completeMaintenanceWorkOrder: (id, data) => api.post(`/maintenance/workorders/${id}/complete`, data),
  closeMaintenanceWorkOrder: (id, data) => api.post(`/maintenance/workorders/${id}/close`, data),
  cancelMaintenanceWorkOrder: (id, data) => api.post(`/maintenance/workorders/${id}/cancel`, data),

  getAssetUsage: params => getNormalizedList(api.get('/maintenance/usage/asset-usage', { params })),
  getUsageRecords: params => getNormalizedList(api.get('/maintenance/usage/records', { params })),
  getUsageTriggeredRecords: params =>
    getNormalizedList(api.get('/maintenance/usage/triggered', { params })),
  recordAssetUsage: data => api.post('/maintenance/usage/records', data),
  triggerMaintenancePlan: (planId, data) => api.post(`/maintenance/plans/${planId}/trigger`, data),
};

export const acceptanceAPI = {
  getAcceptanceRecords: params =>
    getNormalizedList(apiWithBatching.get('/acceptance/records', { params })),
  getAcceptanceRecord: id => apiWithBatching.get(`/acceptance/records/${id}`),
  createAcceptanceRecord: data => apiWithBatching.post('/acceptance/records', data),
  updateAcceptanceRecord: (id, data) => apiWithBatching.put(`/acceptance/records/${id}`, data),
  updateAcceptanceStatus: (id, status) =>
    apiWithBatching.put(`/acceptance/records/${id}/status`, { status }),
  deleteAcceptanceRecord: id => apiWithBatching.delete(`/acceptance/records/${id}`),
  uploadFiles: (id, files, fileType) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('fileType', fileType);
    return apiWithBatching.post(`/acceptance/records/${id}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getAcceptanceFiles: id => getNormalizedList(apiWithBatching.get(`/acceptance/records/${id}/files`)),
  deleteAcceptanceFile: fileId => apiWithBatching.delete(`/acceptance/files/${fileId}`),
  downloadAcceptanceFile: fileId =>
    api.get(`/acceptance/files/${fileId}/download`, {
      responseType: 'blob',
    }),
  getAcceptanceStatistics: () => apiWithBatching.get('/acceptance/statistics'),
};

export const acceptanceManagementAPI = {
  getStatisticsOverview: params =>
    apiWithBatching.get('/acceptance-management/statistics/overview', { params }),
};

// warranty 模块后端尚未实现，stub 避免 import 失败；调用方需处理空数据
export const warrantyAPI = {
  getReminders: () => Promise.resolve({ success: true, data: [] }),
  getReminderConfigs: () => Promise.resolve({ success: true, data: [] }),
  createReminderConfig: () => Promise.resolve({ success: false, message: 'warranty 模块未实现' }),
  updateReminderConfig: () => Promise.resolve({ success: false, message: 'warranty 模块未实现' }),
  deleteReminderConfig: () => Promise.resolve({ success: false, message: 'warranty 模块未实现' }),
  getContracts: () => Promise.resolve({ success: true, data: [] }),
  createContract: () => Promise.resolve({ success: false, message: 'warranty 模块未实现' }),
  updateContract: () => Promise.resolve({ success: false, message: 'warranty 模块未实现' }),
  deleteContract: () => Promise.resolve({ success: false, message: 'warranty 模块未实现' }),
  // Dashboard 保修卡片需要 — 后端路由未实现时返回空数据
  getStatistics: () => Promise.resolve({ success: true, data: { status_stats: [], contract_stats: [], expiring_soon: 0 } }),
  checkExpiringWarranties: () => Promise.resolve({ success: true, data: { warranty_info_expiring: [], assets_expiring: [] } }),
};

export const qualityControlAPI = {
  getMetrologyRecords: params => getNormalizedList(api.get('/quality-control/metrology', { params })),
  getMetrologyRecord: id => api.get(`/quality-control/metrology/${id}`),
  createMetrologyRecord: data => api.post('/quality-control/metrology', data),
  updateMetrologyRecord: (id, data) => api.put(`/quality-control/metrology/${id}`, data),
  deleteMetrologyRecord: id => api.delete(`/quality-control/metrology/${id}`),
  uploadMetrologyAttachments: (id, files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
      if (file.name) {
        formData.append('originalFileName', encodeURIComponent(file.name));
      }
    });
    return api.post(`/quality-control/metrology/${id}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  deleteMetrologyAttachment: attachmentId => api.delete(`/quality-control/metrology/attachments/${attachmentId}`),
  getExpiringMetrology: params =>
    getNormalizedList(api.get('/quality-control/metrology/expiring', { params })),
  getMetrologyStatistics: params => api.get('/quality-control/metrology/statistics', { params }),
  getQualityControlRecords: params =>
    getNormalizedList(api.get('/quality-control/quality-control', { params })),
  getQualityControlRecord: id => api.get(`/quality-control/quality-control/${id}`),
  createQualityControlRecord: data => api.post('/quality-control/quality-control', data),
  updateQualityControlRecord: (id, data) => api.put(`/quality-control/quality-control/${id}`, data),
  deleteQualityControlRecord: id => api.delete(`/quality-control/quality-control/${id}`),
  uploadQualityControlAttachments: (id, files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
      if (file.name) {
        formData.append('originalFileName', encodeURIComponent(file.name));
      }
    });
    return api.post(`/quality-control/quality-control/${id}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  deleteQualityControlAttachment: attachmentId =>
    api.delete(`/quality-control/quality-control/attachments/${attachmentId}`),
  getExpiringQualityControl: params =>
    getNormalizedList(api.get('/quality-control/quality-control/expiring', { params })),
  getQualityControlStatistics: params => api.get('/quality-control/quality-control/statistics', { params }),
  getAssetQualityHistory: assetCode =>
    getNormalizedList(api.get(`/quality-control/asset/${assetCode}/history`)),
  analyzeMetrologyReport: (formData, onUploadProgress) =>
    api.post('/quality-control/metrology/analyze-report', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    }),
  createMetrologyRecordFromFile: (formData, onUploadProgress) =>
    api.post('/quality-control/metrology/from-file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    }),
};

export const adverseReactionAPI = {
  getRecords: params => getNormalizedList(api.get('/adverse-reaction', { params })),
  getRecord: id => api.get(`/adverse-reaction/${id}`),
  createRecord: data => api.post('/adverse-reaction', data),
  updateRecord: (id, data) => api.put(`/adverse-reaction/${id}`, data),
  deleteRecord: id => api.delete(`/adverse-reaction/${id}`),
  uploadAttachments: (id, files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
      if (file.name) {
        formData.append('originalFileName', encodeURIComponent(file.name));
      }
    });
    return api.post(`/adverse-reaction/${id}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  deleteAttachment: attachmentId => api.delete(`/adverse-reaction/attachments/${attachmentId}`),
  approveRecord: (id, data) => api.post(`/adverse-reaction/${id}/approve`, data),
  closeRecord: (id, data) => api.post(`/adverse-reaction/${id}/close`, data),
  getWorkflow: id => api.get(`/adverse-reaction/${id}/workflow`),
  getStatistics: params => api.get('/adverse-reaction/statistics/overview', { params }),
  getOverdueAlerts: () => getNormalizedList(api.get('/adverse-reaction/alerts/overdue')),
};

export const aiAPI = {
  initConversation: data => api.post('maintenance/ai/init', data),
  sendMessage: data => api.post('maintenance/ai/message', data),
  processAudio: formData => {
    return api.post('maintenance/ai/audio', formData, {
      timeout: AI_ASSISTANT_TIMEOUT_MS,
    })
      .then(response => response.data)
      .catch(error => {
        console.error('处理音频 API 错误:', error);
        if (error.response) {
          return Promise.reject({
            success: false,
            message: error.response.data?.message || error.response.data?.error || '处理音频失败',
            error: error.response.data,
          });
        }
        if (error.request) {
          return Promise.reject({
            success: false,
            message: '网络错误，请检查服务器连接',
          });
        }
        return Promise.reject({
          success: false,
          message: error.message || '处理音频失败',
        });
      });
  },
  analyzeMaintenance: params => api.get('maintenance/ai/analysis', { params }),
  getPending: () => api.get('maintenance/ai/pending'),
};
