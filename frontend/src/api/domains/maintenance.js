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
    return api.post(`/maintenance/logs/${logId}/attachments`, formData, {      timeout: 60000,
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
    return api.post(`/maintenance/requests/${requestId}/attachments`, formData, {      timeout: 60000,
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
  /**
   * 批量创建预防性维护计划
   * @param {Object} payload
   *   - { plans: [...] }                                            多计划模式
   *   - { asset_codes: [...], template: {...} }                     模板模式
   *   - { category_ids: [1,2], template: {...} }                    按资产种类
   *   - { department_codes: ['DEP001'], template: {...} }           按部门
   *   - { category_ids: [...], department_codes: [...], template: {...} }  组合
   */
  batchCreateMaintenancePlans: payload => api.post('/maintenance/plans/batch', payload),
  /**
   * 预览批量创建会匹配到的资产（不实际插入）
   * @param {Object} params
   *   - category_ids: number[]   资产种类ID列表
   *   - department_codes: string[]  部门 code 列表
   */
  previewBatchMaintenanceAssets: ({ category_ids = [], department_codes = [] } = {}) => {
    const qs = new URLSearchParams();
    if (category_ids.length) qs.set('category_ids', category_ids.join(','));
    if (department_codes.length) qs.set('department_codes', department_codes.join(','));
    const query = qs.toString();
    return api.get(`/maintenance/plans/preview-assets${query ? `?${query}` : ''}`);
  },
  updateMaintenancePlan: (id, data) => api.put(`/maintenance/plans/${id}`, data),
  completeMaintenancePlan: (id, data) => api.post(`/maintenance/plans/${id}/complete`, data),
  deleteMaintenancePlan: id => api.delete(`/maintenance/plans/${id}`),
  getMaintenancePlanHistory: id => api.get(`/maintenance/plans/${id}/history`),

  getMaintenanceRequests: params => getNormalizedList(api.get('/maintenance/requests', { params })),
  getMaintenanceRequest: id => api.get(`/maintenance/requests/${id}`),
  getMaintenanceRequestLatestLog: id => api.get(`/maintenance/requests/${id}/latest-log`),
  getMaintenanceRequestHistory: id => api.get(`/maintenance/requests/${id}/history`),
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

  getEfficiencyOverview: params => api.get('/preventive-maintenance/efficiency/overview', { params }),
  getEfficiencyResponseTime: params => api.get('/preventive-maintenance/efficiency/response-time', { params }),
  getEfficiencyTechnician: params => api.get('/preventive-maintenance/efficiency/technician', { params }),
  getEfficiencyAssetFrequency: params => api.get('/preventive-maintenance/efficiency/asset-frequency', { params }),
  // ===== 维护成本管理（后端：backend/routes/maintenance/costs.router.js => /api/maintenance/costs）=====
  getMaintenanceCosts: params => api.get('/maintenance/costs', { params }),
  getCostAnalysis: params => api.get('/maintenance/costs/analysis', { params }),
  createMaintenanceCost: data => api.post('/maintenance/costs', data),
  updateMaintenanceCost: (id, data) => api.put(`/maintenance/costs/${id}`, data),
  deleteMaintenanceCost: id => api.delete(`/maintenance/costs/${id}`),
  // 成本趋势（旧效率页分析路径有误，已修正为真实路由，保留作为兜底）
  getCostTrendAnalysis: params => api.get('/maintenance/costs/trend', { params }),
  getMaintenanceDashboardOverview: params => api.get('/maintenance/dashboard/overview', { params }),
  getTypeDistribution: params => api.get('/maintenance/analysis/type-distribution', { params }),

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
  evaluateMaintenanceWorkOrder: (id, data) => api.post(`/maintenance/workorders/${id}/evaluate`, data),
  closeMaintenanceWorkOrder: (id, data) => api.post(`/maintenance/workorders/${id}/close`, data),
  cancelMaintenanceWorkOrder: (id, data) => api.post(`/maintenance/workorders/${id}/cancel`, data),
  // 2026-07-17 配件库完善: 工单材料明细(关联备件 part_id 联动扣库存)
  addMaintenanceWorkOrderMaterials: (id, materials) => api.post(`/maintenance/workorders/${id}/materials`, { materials }),
  getEngineers: params => api.get('/maintenance/workorders/engineers', { params }),
  getWorkOrderDispatchPanel: params => api.get('/maintenance/workorders/dispatch-panel', { params }),
  getWorkOrderHistory: id => api.get(`/maintenance/workorders/${id}/history`),
  getWorkOrderStatistics: params => api.get('/maintenance/workorders/statistics', { params }),

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
  // 验收检查清单相关（后端：backend/routes/acceptance.js）
  getChecklist: id => apiWithBatching.get(`/acceptance/records/${id}/checklist`),
  getChecklistStats: id => apiWithBatching.get(`/acceptance/records/${id}/checklist/stats`),
  initChecklist: id => apiWithBatching.post(`/acceptance/records/${id}/checklist/init`),
  updateChecklistItem: (id, checkId, data) =>
    apiWithBatching.put(`/acceptance/records/${id}/checklist/${checkId}`, data),
  passAllChecklist: id => apiWithBatching.put(`/acceptance/records/${id}/checklist/pass-all`),
  getAssetFillInfo: code => apiWithBatching.get(`/acceptance/assets/${code}/fill-info`),
  inviteSupplier: id => apiWithBatching.post(`/acceptance-management/records/${id}/invite-supplier`),
};

export const acceptanceManagementAPI = {
  getStatisticsOverview: params =>
    apiWithBatching.get('/acceptance-management/statistics/overview', { params }),

  // 验收提醒
  getReminders: params =>
    getNormalizedList(apiWithBatching.get('/acceptance-management/reminders', { params })),
  getReminderStats: () => apiWithBatching.get('/acceptance-management/reminders/stats'),
  createReminder: data => apiWithBatching.post('/acceptance-management/reminders', data),
  updateReminderStatus: (id, status) =>
    apiWithBatching.put(`/acceptance-management/reminders/${id}/status`, { status }),
  deleteReminder: id => apiWithBatching.delete(`/acceptance-management/reminders/${id}`),

  // 验收小组
  getTeamMembers: recordId =>
    apiWithBatching.get(`/acceptance-management/teams/${recordId}`),
  addTeamMember: (recordId, data) =>
    apiWithBatching.post(`/acceptance-management/teams/${recordId}`, data),
  updateTeamMember: (recordId, memberId, data) =>
    apiWithBatching.put(`/acceptance-management/teams/${recordId}/${memberId}`, data),
  deleteTeamMember: (recordId, memberId) =>
    apiWithBatching.delete(`/acceptance-management/teams/${recordId}/${memberId}`),

  // 验收报告
  getReport: id => apiWithBatching.get(`/acceptance-management/reports/${id}`),
  generateReport: id =>
    apiWithBatching.post(`/acceptance-management/reports/${id}/generate`),
  exportReportPdf: async (id) => {
    const response = await apiWithBatching.get(
      `/acceptance-management/reports/${id}/pdf`,
      { responseType: 'blob' },
    );
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `acceptance_report_${id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

// warranty 模块后端 API 已迁出至 /api/warranty，详见 ./warranty.js
// （2026-07-16：保修管理从日常维修中独立出来，成立单独模块）

export const qualityControlAPI = {
  getMetrologyRecords: params => getNormalizedList(api.get('/metrology', { params })),
  getMetrologyRecord: id => api.get(`/metrology/${id}`),
  createMetrologyRecord: data => api.post('/metrology', data),
  updateMetrologyRecord: (id, data) => api.put(`/metrology/${id}`, data),
  deleteMetrologyRecord: id => api.delete(`/metrology/${id}`),
  getMetrologyAttachments: id => api.get(`/metrology/${id}/attachments`),
  uploadMetrologyAttachments: (id, files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
      if (file.name) {
        formData.append('originalFileName', encodeURIComponent(file.name));
      }
    });
    return api.post(`/metrology/${id}/attachments`, formData, {
      headers: {
      },
    });
  },
  deleteMetrologyAttachment: attachmentId => api.delete(`/metrology/attachments/${attachmentId}`),
  getExpiringMetrology: params =>
    getNormalizedList(api.get('/metrology/expiring', { params })),
  getMetrologyStatistics: params => api.get('/metrology/statistics', { params }),
  getAdvancedMetrologyStatistics: params => api.get('/metrology/statistics/advanced', { params }),
  getMetrologyReport: params => api.get('/metrology/report', { params, responseType: 'blob' }),
  getQualityControlRecords: params =>
    getNormalizedList(api.get('/quality-control', { params })),
  getQualityControlRecord: id => api.get(`/quality-control/${id}`),
  createQualityControlRecord: data => api.post('/quality-control', data),
  updateQualityControlRecord: (id, data) => api.put(`/quality-control/${id}`, data),
  deleteQualityControlRecord: id => api.delete(`/quality-control/${id}`),
  uploadQualityControlAttachments: (id, files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
      if (file.name) {
        formData.append('originalFileName', encodeURIComponent(file.name));
      }
    });
    return api.post(`/quality-control/${id}/attachments`, formData, {
      headers: {
      },
    });
  },
  deleteQualityControlAttachment: attachmentId =>
    api.delete(`/quality-control/attachments/${attachmentId}`),
  getExpiringQualityControl: params =>
    getNormalizedList(api.get('/quality-control/expiring', { params })),
  getQualityControlStatistics: params => api.get('/quality-control/statistics', { params }),
  getAssetQualityHistory: assetCode =>
    getNormalizedList(api.get(`/quality-control/asset/${assetCode}/history`)),
  analyzeMetrologyReport: (formData, onUploadProgress) =>
    api.post('/metrology/analyze-report', formData, {
      headers: {
      },
      onUploadProgress,
    }),
  createMetrologyRecordFromFile: (formData, onUploadProgress) =>
    api.post('/metrology/from-file', formData, {
      headers: {
      },
      onUploadProgress,
    }),
  // 计量证书批量导入
  getMetrologyImportTemplate: () =>
    api
      .get('/metrology/import-template', { responseType: 'blob' })
      .then(response => response.data),
  validateMetrologyImport: file => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/metrology/import/validate', formData);
  },
  importMetrologyRecords: file => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/metrology/import', formData);
  },
  // 资产批量重新关联(补救:导入时未匹配 / 新增资产后可重跑)
  reassociateAssets: ({ ids, force = false, includeAll = false } = {}) =>
    api.post('/metrology/reassociate', { ids, force, includeAll }),
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
      },
    });
  },
  deleteAttachment: attachmentId => api.delete(`/adverse-reaction/attachments/${attachmentId}`),
  approveRecord: (id, data) => api.post(`/adverse-reaction/${id}/approve`, data),
  closeRecord: (id, data) => api.post(`/adverse-reaction/${id}/close`, data),
  getWorkflow: id => api.get(`/adverse-reaction/${id}/workflow`),
  getStatistics: params => api.get('/adverse-reaction/statistics/overview', { params }),
  getStatisticsByDepartment: params => api.get('/adverse-reaction/statistics/by-department', { params }),
  getStatisticsByAsset: params => api.get('/adverse-reaction/statistics/by-asset', { params }),
  getHandleEfficiency: params => api.get('/adverse-reaction/statistics/handle-efficiency', { params }),
  getOverdueAlerts: () => getNormalizedList(api.get('/adverse-reaction/alerts/overdue')),
  getExportUrl: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v && v !== '') query.set(k, v); });
    const qs = query.toString();
    return `/api/adverse-reaction/export/excel${qs ? `?${qs}` : ''}`;
  },
  // 根因分析
  getRootCauseAnalyses: id => api.get(`/adverse-reaction/${id}/root-cause`),
  createRootCauseAnalysis: (id, data) => api.post(`/adverse-reaction/${id}/root-cause`, data),
  updateRootCauseAnalysis: (id, analysisId, data) =>
    api.put(`/adverse-reaction/${id}/root-cause/${analysisId}`, data),
  verifyRootCauseAnalysis: (id, analysisId) =>
    api.post(`/adverse-reaction/${id}/root-cause/${analysisId}/verify`),
  deleteRootCauseAnalysis: (id, analysisId) =>
    api.delete(`/adverse-reaction/${id}/root-cause/${analysisId}`),
  // 预防措施
  getPreventiveMeasures: id => api.get(`/adverse-reaction/${id}/preventive-measures`),
  createPreventiveMeasure: (id, data) =>
    api.post(`/adverse-reaction/${id}/preventive-measures`, data),
  updatePreventiveMeasure: (id, measureId, data) =>
    api.put(`/adverse-reaction/${id}/preventive-measures/${measureId}`, data),
  verifyPreventiveMeasure: (id, measureId, data) =>
    api.post(`/adverse-reaction/${id}/preventive-measures/${measureId}/verify`, data),
  deletePreventiveMeasure: (id, measureId) =>
    api.delete(`/adverse-reaction/${id}/preventive-measures/${measureId}`),
  // 监管上报
  markAuthorityReport: (id, data) => api.post(`/adverse-reaction/${id}/authority-report`, data),
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

  // ==================== 临时保养（按需/轻量维护, 区别于正式维修工单） ====================
  getTemporaryRecords: params => getNormalizedList(api.get('/preventive-maintenance/temporary', { params })),
  getTemporaryRecord: id => api.get(`/preventive-maintenance/temporary/${id}`),
  createTemporaryRecord: data => api.post('/preventive-maintenance/temporary', data),
  updateTemporaryRecord: (id, data) => api.put(`/preventive-maintenance/temporary/${id}`, data),
  deleteTemporaryRecord: id => api.delete(`/preventive-maintenance/temporary/${id}`),
  getTemporaryStatistics: () => api.get('/preventive-maintenance/temporary/statistics/overview'),
};
