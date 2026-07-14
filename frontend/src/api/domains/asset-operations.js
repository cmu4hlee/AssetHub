import { api, apiWithBatching } from '../client';
import { normalizeListResult } from '../normalizers';

const getNormalizedList = request => request.then(normalizeListResult);

export const inventoryAPI = {
  getInventories: params => getNormalizedList(api.get('/inventory', { params })),
  getInventory: id => api.get(`/inventory/${id}`),
  createInventory: data => api.post('/inventory', data),
  updateInventory: (id, data) => api.put(`/inventory/${id}`, data),
  deleteInventory: id => api.delete(`/inventory/${id}`),
  addInventoryDetail: (id, data) => api.post(`/inventory/${id}/details`, data),
  batchAddInventoryDetails: (id, details) => api.post(`/inventory/${id}/details/batch`, { details }),
  updateInventoryDetail: (id, detailId, data) => api.put(`/inventory/${id}/details/${detailId}`, data),
  deleteInventoryDetail: (id, detailId) => api.delete(`/inventory/${id}/details/${detailId}`),
  startInventory: id => api.post(`/inventory/${id}/start`),
  completeInventory: id => api.post(`/inventory/${id}/complete`),
  getInventoryStatistics: id => api.get(`/inventory/${id}/statistics`),
  getInventoriesStatistics: () => api.get('/inventory/statistics'),
  scanAsset: (id, data) => api.post(`/inventory/${id}/scan`, data),
  updateInventoryStatus: (id, status) => api.put(`/inventory/${id}/status`, { status }),
  getInventoryPlans: params => getNormalizedList(api.get('/inventory-plans', { params })),
  createInventoryPlan: data => api.post('/inventory-plans', data),
  getInventoryTasks: params => getNormalizedList(api.get('/inventory-tasks', { params })),
  getInventoryReports: params => getNormalizedList(api.get('/inventory-reports', { params })),
  getSelfInventoryWindows: () => api.get('/inventory/self/windows'),
  getSelfInventoryAssets: inventoryId => api.get('/inventory/self/assets', { params: { inventory_id: inventoryId } }),
  confirmSelfInventory: data => api.post('/inventory/self/confirm', data),
};

export const transferAPI = {
  getTransfers: params => getNormalizedList(api.get('/transfer', { params })),
  getTransfer: id => api.get(`/transfer/${id}`),
  createTransfer: data => api.post('/transfer', data),
  approveTransfer: (id, data) => api.post(`/transfer/${id}/approve`, data),
  completeTransfer: id => api.post(`/transfer/${id}/complete`),
  rejectTransfer: (id, data) => api.put(`/transfer/${id}/reject`, data),
  deleteTransfer: id => api.delete(`/transfer/${id}`),
  getTransferStats: () => api.get('/transfer/statistics'),
};

export const idleAPI = {
  getIdleAssets: params => getNormalizedList(api.get('/idle', { params })),
  getIdleAsset: id => api.get(`/idle/${id}`),
  getIdleStatistics: () => api.get('/idle/statistics'),
  createIdleAsset: data => api.post('/idle', data),
  allocateIdleAsset: (id, data) => api.put(`/idle/${id}/allocate`, data),
  cancelIdleAsset: id => api.put(`/idle/${id}/cancel`),
  deleteIdleAsset: id => api.delete(`/idle/${id}`),
  batchAllocateIdleAssets: data => api.put('/idle/batch/allocate', data),
  batchCancelIdleAssets: data => api.put('/idle/batch/cancel', data),
  batchDeleteIdleAssets: data => api.delete('/idle/batch', data),
};

export const scrappingAPI = {
  getScrappingRecords: params => getNormalizedList(api.get('/scrapping', { params })),
  getScrappingRecord: id => api.get(`/scrapping/${id}`),
  createScrappingRequest: data => api.post('/scrapping', data),
  updateScrapping: (id, data) => api.put(`/scrapping/${id}`, data),
  approveScrapping: (id, data) => api.post(`/scrapping/${id}/approve`, data),
  rejectScrapping: (id, data) => api.post(`/scrapping/${id}/reject`, data),
  appraiseScrapping: (id, data) => api.post(`/scrapping/${id}/appraise`, data),
  disposeScrapping: (id, data) => api.post(`/scrapping/${id}/dispose`, data),
  completeScrapping: id => api.post(`/scrapping/${id}/complete`),
  archiveScrapping: (id, data) => api.post(`/scrapping/${id}/archive`, data),
  uploadScrappingFile: (id, formData, config) => api.post(`/scrapping/${id}/files`, formData, config),
  deleteScrapping: id => api.delete(`/scrapping/${id}`),
  getScrappingStats: () => api.get('/scrapping/stats'),
};

export const depreciationAPI = {
  getDepreciationRecords: params => getNormalizedList(api.get('/depreciation', { params })),
  getDepreciationRecord: id => api.get(`/depreciation/${id}`),
  calculateDepreciation: data => api.post('/depreciation/calculate', data),
  getAssetDepreciation: assetCode => api.get(`/asset-depreciation/${assetCode}`),
};
