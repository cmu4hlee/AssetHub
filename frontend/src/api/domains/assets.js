import { api, apiWithBatching } from '../client';
import { normalizeListResult } from '../normalizers';

const getNormalizedList = request => request.then(normalizeListResult);

const flattenDepartments = departments => {
  const result = [];
  const visit = items => {
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      const { children, ...department } = item;
      result.push(department);
      visit(children);
    });
  };
  visit(departments);
  return result;
};

const getNormalizedDepartments = request =>
  getNormalizedList(request).then(result => ({
    ...result,
    data: flattenDepartments(result.data),
  }));

export const assetAPI = {
  getAssets: params => getNormalizedList(apiWithBatching.get('/assets', { params })),
  getAssetsNoCache: params => getNormalizedList(api.get('/assets', { params })),
  getAsset: id => apiWithBatching.get(`/assets/${id}`),
  createAsset: data => apiWithBatching.post('/assets', data),
  updateAsset: (id, data) => apiWithBatching.put(`/assets/${id}`, data),
  deleteAsset: id => apiWithBatching.delete(`/assets/${id}`),
  getCategories: params => getNormalizedList(apiWithBatching.get('/assets/categories/list', { params })),
  createCategory: data => apiWithBatching.post('/assets/categories', data),
  updateCategory: (id, data) => apiWithBatching.put(`/assets/categories/${id}`, data),
  deleteCategory: id => apiWithBatching.delete(`/assets/categories/${id}`),
  getDepartments: keyword => getNormalizedDepartments(
    apiWithBatching.get('/assets/departments/list', { params: keyword ? { keyword } : {} })
  ),
  checkAssetCodeDuplicate: (assetCode, excludeId) =>
    apiWithBatching.get('/assets/duplicate-check', {
      params: {
        asset_code: assetCode,
        ...(excludeId ? { exclude_id: excludeId } : {}),
      },
    }),
  getStatistics: params => apiWithBatching.get('/assets/statistics/overview', { params }),
  getDepartmentStatistics: params => apiWithBatching.get('/assets/statistics/by-department', { params }),
  getAssetImages: assetCode => getNormalizedList(apiWithBatching.get(`/assets/${assetCode}/images`)),
  getAssetChangeLogs: assetCode =>
    getNormalizedList(apiWithBatching.get(`/assets/${assetCode}/change-logs`)),
  applyTransfer: (assetCode, data = {}) => {
    const payload = { ...data };
    if (!payload.target_department) {
      payload.target_department = payload.to_department ?? payload.to_department_id;
    }
    if (!payload.to_department) {
      payload.to_department = payload.target_department;
    }
    return apiWithBatching.post(`/assets/${assetCode}/transfer-apply`, payload);
  },
  getTransferRequests: params => getNormalizedList(apiWithBatching.get('/assets/transfer-requests', { params })),
  approveTransferRequest: (id, data = {}) => {
    const payload = { ...data };
    if (typeof payload.approved === 'boolean' && !payload.action) {
      payload.action = payload.approved ? 'approve' : 'reject';
    }
    return apiWithBatching.post(`/assets/transfer-requests/${id}/approve`, payload);
  },
  getAssetTransitions: id => getNormalizedList(apiWithBatching.get(`/assets/${id}/transitions`)),
  applyAssetTransition: (id, data) => apiWithBatching.post(`/workflow/transition/${id}`, data),
  downloadTemplate: () =>
    api.get('/assets/import-template', {
      responseType: 'blob',
    }).then(response => response.data),
  importAssets: file => {
    const formData = new FormData();
    formData.append('file', file);
    return apiWithBatching.post('/assets/import', formData, {
      headers: {
      },
    });
  },
  exportAssets: params =>
    api.get('/assets/export', {
      params,
      responseType: 'blob',
    }).then(response => response.data),
  createAssetShareLink: (assetId, data) => apiWithBatching.post(`/assets/${assetId}/share`, data),
  getAssetShareLinks: assetId => getNormalizedList(apiWithBatching.get(`/assets/${assetId}/shares`)),
  deleteAssetShareLink: shareId => apiWithBatching.delete(`/assets/shares/${shareId}`),
  getAssetsByCodeRange: (start, end) => getNormalizedList(
    apiWithBatching.get('/assets/by-code-range', { params: { start, end } })
  ),
  getExpiringWarranties: params =>
    getNormalizedList(apiWithBatching.get('/assets/statistics/expiring-warranties', { params })),
  getDashboardData: () => api.get('/dashboard'),
};

export const assetImageAPI = {
  getAllImages: params => api.get('/asset-images', { params }),
  getAssetImages: assetCode => api.get(`/assets/${assetCode}/images`),
  uploadImages: (assetCode, images, descriptions = []) => {
    const formData = new FormData();
    images.forEach((image, index) => {
      formData.append('images', image);
      formData.append('descriptions[]', descriptions[index] || '');
    });
    // 必须清除默认的 Content-Type，让浏览器自动添加 multipart/form-data; boundary=...
    return api.post(`/assets/${assetCode}/images`, formData, {    });
  },
  updateImageDescription: (imageId, description) => {
    return api.put(`/assets/images/${imageId}`, { description });
  },
  deleteImage: imageId => api.delete(`/assets/images/${imageId}`),
};

export const inventoryAPI = {
  getInventories: params => getNormalizedList(api.get('/inventory', { params })),
  getInventory: id => api.get(`/inventory/${id}`),
  createInventory: data => api.post('/inventory', data),
  updateInventory: (id, data) => api.put(`/inventory/${id}`, data),
  addInventoryDetail: (id, data) => api.post(`/inventory/${id}/details`, data),
  batchAddInventoryDetails: (id, details) => api.post(`/inventory/${id}/details/batch`, { details }),
  updateInventoryDetail: (id, detailId, data) => api.put(`/inventory/${id}/details/${detailId}`, data),
  deleteInventoryDetail: (id, detailId) => api.delete(`/inventory/${id}/details/${detailId}`),
  updateInventoryStatus: (id, status) => api.put(`/inventory/${id}/status`, { status }),
  getInventoryStatistics: id => api.get(`/inventory/${id}/statistics`),
  deleteInventory: id => api.delete(`/inventory/${id}`),
  scanAsset: (id, data) => api.post(`/inventory/${id}/scan`, data),
  getScanLogs: (id, params) => getNormalizedList(api.get(`/inventory/${id}/scan-logs`, { params })),
  completeInventory: id => api.post(`/inventory/${id}/complete`),
  getSelfInventoryWindows: () => api.get('/inventory/self/windows'),
  getSelfInventoryAssets: inventoryId => getNormalizedList(
    api.get('/inventory/self/assets', { params: { inventory_id: inventoryId } })
  ),
  confirmSelfInventory: data => api.post('/inventory/self/confirm', data),
};

export const transferAPI = {
  getTransfers: params => getNormalizedList(api.get('/transfer', { params })),
  getTransfer: id => api.get(`/transfer/${id}`),
  createTransfer: data => api.post('/transfer', data),
  approveTransfer: (id, data) => api.put(`/transfer/${id}/approve`, data),
  completeTransfer: (id, data) => api.put(`/transfer/${id}/complete`, data),
  deleteTransfer: id => api.delete(`/transfer/${id}`),
};

export const scrappingAPI = {
  getList: params => getNormalizedList(api.get('/scrapping', { params })),
  getOne: id => api.get(`/scrapping/${id}`),
  create: data => api.post('/scrapping', data),
  update: (id, data) => api.put(`/scrapping/${id}`, data),
  delete: id => api.delete(`/scrapping/${id}`),
  submitAppraise: (id, data) => api.post(`/scrapping/${id}/appraise`, data),
  approve: (id, data) => api.post(`/scrapping/${id}/approve`, data),
  dispose: (id, data) => api.post(`/scrapping/${id}/dispose`, data),
  complete: (id, data) => api.post(`/scrapping/${id}/complete`, data),
  getStatistics: params => api.get('/scrapping/statistics/summary', { params }),
};

export const depreciationAPI = {
  getDepreciation: params => api.get('/depreciation', { params }),
  getDepreciationDetail: (id, params) => api.get(`/depreciation/${id}`, { params }),
  getSummaryByDepartment: params => api.get('/depreciation/summary/by-department', { params }),
  getSummaryByType: params => api.get('/depreciation/summary/by-type', { params }),
  getSummaryByMonth: params => api.get('/depreciation/summary/by-month', { params }),
  calculate: data => api.post('/depreciation/calculate', data),
  export: params => api.get('/depreciation/export', { params }),
};

export const financeAPI = {
  // 预算管理
  getBudgets: params => api.get('/finance/budgets', { params }),
  createBudget: data => api.post('/finance/budgets', data),
  updateBudget: (id, data) => api.put(`/finance/budgets/${id}`, data),
  deleteBudget: id => api.delete(`/finance/budgets/${id}`),
  getBudgetSummary: params => api.get('/finance/budgets/summary', { params }),
  exportBudgets: params =>
    api.get('/finance/budgets/export', { params, responseType: 'blob' }).then(response => response.data),

  // 收支记录
  getTransactions: params => api.get('/finance/transactions', { params }),
  createTransaction: data => api.post('/finance/transactions', data),
  updateTransaction: (id, data) => api.put(`/finance/transactions/${id}`, data),
  deleteTransaction: id => api.delete(`/finance/transactions/${id}`),
  getTransactionSummary: params => api.get('/finance/transactions/summary', { params }),
  exportTransactions: params =>
    api.get('/finance/transactions/export', { params, responseType: 'blob' }).then(response => response.data),

  // 财务报表
  getOverview: params => api.get('/finance/reports/overview', { params }),
};

export const tempAssetAPI = {
  getTempAssets: params => getNormalizedList(api.get('/temp-assets', { params })),
  getTempAsset: id => api.get(`/temp-assets/${id}`),
  createTempAsset: data => api.post('/temp-assets', data),
  updateTempAsset: (id, data) => api.put(`/temp-assets/${id}`, data),
  deleteTempAsset: id => api.delete(`/temp-assets/${id}`),
};

export const locationCodeAPI = {
  getLocationCodes: params => getNormalizedList(apiWithBatching.get('/location-codes', { params })),
  createLocationCode: data => apiWithBatching.post('/location-codes', data),
  updateLocationCode: (id, data) => apiWithBatching.put(`/location-codes/${id}`, data),
  deleteLocationCode: id => apiWithBatching.delete(`/location-codes/${id}`),
  getLocationCode: id => apiWithBatching.get(`/location-codes/${id}`),
};

export const assetLocationAPI = {
  getLocations: params => getNormalizedList(apiWithBatching.get('/asset-location', { params })),
  getAssetLocation: assetCode => apiWithBatching.get(`/asset-location/assets/${assetCode}/location`),
  getAssetsLocations: assetCodes => apiWithBatching.post('/asset-location/assets/locations', { assetCodes }),
  updateAssetLocation: (assetCode, data) => apiWithBatching.post(`/asset-location/assets/${assetCode}/location`, data),
  getAssetLocationHistory: (assetCode, params) => getNormalizedList(
    apiWithBatching.get(`/asset-location/assets/${assetCode}/location/history`, { params })
  ),
  getAssetsInArea: data => apiWithBatching.post('/asset-location/assets/in-area', data),
  getBeaconAssets: params => getNormalizedList(apiWithBatching.get('/asset-location/beacon-assets', { params })),
  getDevices: params => getNormalizedList(apiWithBatching.get('/asset-location/devices', { params })),
  createDevice: data => apiWithBatching.post('/asset-location/devices', data),
  bindDevice: (assetCode, data) => apiWithBatching.post(`/asset-location/assets/${assetCode}/bind-device`, data),
  unbindDevice: (assetCode, data) =>
    apiWithBatching.post(`/asset-location/assets/${assetCode}/unbind-device`, data),
  getAssetDevices: assetCode =>
    getNormalizedList(apiWithBatching.get(`/asset-location/assets/${assetCode}/devices`)),
  // 资产监控
  getAssetMonitoringPipelineHealth: () => api.get('/iot/asset-monitoring/pipeline/health'),
  getAssetMonitoringPipelineDocs: () => api.get('/iot/asset-monitoring/pipeline/docs'),
  getAssetMonitoringLatestByDevice: deviceId => api.get(`/iot/asset-monitoring/devices/${deviceId}/latest`),
  getAssetMonitoringSeriesByAsset: (assetCode, params) =>
    api.get(`/iot/asset-monitoring/assets/${assetCode}/series`, { params }),
  getAssetMonitoringErrorReportsByAsset: (assetCode, params) =>
    api.get(`/iot/asset-monitoring/assets/${assetCode}/error-reports`, { params }),
  ingestAssetMonitoringSample: events => api.post('/iot/asset-monitoring/sample', { events }),
  // 患者流量
  getPatientVolumePipelineHealth: () => api.get('/iot/patient-volume/pipeline/health'),
  getPatientVolumePipelineDocs: () => api.get('/iot/patient-volume/pipeline/docs'),
  getPatientVolumeUsageStats: params => api.get('/iot/patient-volume/assets/usage-stats', { params }),
  getPatientVolumeRecentRecords: params => api.get('/iot/patient-volume/records/recent', { params }),
  getPatientVolumeSeriesByAsset: (assetCode, params) =>
    api.get(`/iot/patient-volume/assets/${assetCode}/series`, { params }),
  getPatientVolumePatientsByAsset: (assetCode, params) =>
    api.get(`/iot/patient-volume/assets/${assetCode}/patients`, { params }),
  ingestPatientVolumeSample: events => api.post('/iot/patient-volume/sample', { events }),
  // 环境监控
  getEnvironmentPipelineHealth: () => api.get('/iot/environment-monitoring/pipeline/health'),
  getEnvironmentPipelineDocs: () => api.get('/iot/environment-monitoring/pipeline/docs'),
  getEnvironmentLatestByDevice: deviceId =>
    api.get(`/iot/environment-monitoring/devices/${deviceId}/latest`),
  getEnvironmentSeriesByAsset: (assetCode, params) =>
    api.get(`/iot/environment-monitoring/assets/${assetCode}/series`, { params }),
  ingestEnvironmentSample: events => api.post('/iot/environment-monitoring/sample', { events }),
};

export const iotDeviceAPI = {
  getDevices: params => getNormalizedList(apiWithBatching.get('/iot/devices', { params })),
  createDevice: data => apiWithBatching.post('/iot/devices', data),
  updateDevice: (id, data) => apiWithBatching.put(`/iot/devices/${id}`, data),
  deleteDevice: id => apiWithBatching.delete(`/iot/devices/${id}`),
  getDevice: id => apiWithBatching.get(`/iot/devices/${id}`),
  linkDevice: (assetCode, data) => apiWithBatching.post(`/iot/assets/${assetCode}/devices`, data),
  unlinkDevice: (assetCode, deviceId) =>
    apiWithBatching.delete(`/iot/assets/${assetCode}/devices/${deviceId}`),
  getDeviceAssets: deviceId => getNormalizedList(apiWithBatching.get(`/iot/devices/${deviceId}/assets`)),
  getAssetDevices: assetCode =>
    getNormalizedList(apiWithBatching.get(`/iot/assets/${assetCode}/devices`)),
  reportData: (deviceId, data) => apiWithBatching.post(`/iot/devices/${deviceId}/data`, data),
  getDeviceData: (deviceId, params) =>
    getNormalizedList(apiWithBatching.get(`/iot/devices/${deviceId}/data`, { params })),
};

export const assetAIAnalysisAPI = {
  getDimensions: () => api.get('/asset-ai-analysis/dimensions'),
  getDatasources: () => api.get('/asset-ai-analysis/datasources'),
  analyzeAsset: (assetCode, data) => api.post(`/asset-ai-analysis/analyze-asset/${assetCode}`, data),
  analyzeAssets: data => api.post('/asset-ai-analysis/analyze-assets', data),
  customAnalysis: data => api.post('/asset-ai-analysis/custom-analysis', data),
  getAnalysisHistory: params => api.get('/asset-ai-analysis/analysis-history', { params }),
  getAnalysisReport: id => api.get(`/asset-ai-analysis/reports/${id}`),
  getQuestionRecords: () => getNormalizedList(api.get('/asset-ai-analysis/question-records')),
};

export const assetLabelAPI = {
  getTemplates: params => getNormalizedList(api.get('/asset-labels/templates', { params })),
  getTemplate: id => api.get(`/asset-labels/templates/${id}`),
  createTemplate: data => api.post('/asset-labels/templates', data),
  updateTemplate: (id, data) => api.put(`/asset-labels/templates/${id}`, data),
  deleteTemplate: id => api.delete(`/asset-labels/templates/${id}`),
  generateZPL: (templateId, assetCode) => api.get(`/asset-labels/generate-zpl/${templateId}/${assetCode}`),
  batchGenerateZPL: (assetCodes, templateId) =>
    api.post('/asset-labels/generate-zpl-batch', {
      asset_codes: assetCodes,
      template_id: templateId,
    }),
  printZPL: (asset_code, template_id, printer_ip, printer_port = 9100, quantity = 1) =>
    api.post('/asset-labels/print', {
      asset_code,
      template_id,
      printer_ip,
      printer_port,
      quantity,
    }),
  getPrintQueue: params => getNormalizedList(api.get('/asset-labels/print-queue', { params })),
  updatePrintJobStatus: (id, status, error_message) =>
    api.put(`/asset-labels/print-queue/${id}/status`, { status, error_message }),
};
