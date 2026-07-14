import { api, apiWithBatching } from '../client';
import { normalizeListResult } from '../normalizers';

const getNormalizedList = request => request.then(normalizeListResult);

export const assetLocationAPI = {
  getLocations: params => getNormalizedList(api.get('/asset-location', { params })),
  getLocation: id => api.get(`/asset-location/${id}`),
  updateLocation: (id, data) => api.put(`/asset-location/${id}`, data),
  getLocationAlerts: params => getNormalizedList(api.get('/location-alerts', { params })),
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
};

export const iotDeviceAPI = {
  getDevices: params => getNormalizedList(api.get('/iot-devices', { params })),
  getDevice: id => api.get(`/iot-devices/${id}`),
  createDevice: data => api.post('/iot-devices', data),
  updateDevice: (id, data) => api.put(`/iot-devices/${id}`, data),
  deleteDevice: id => api.delete(`/iot-devices/${id}`),
  getDeviceData: (id, params) => api.get(`/iot-devices/${id}/data`, { params }),
};

export const locationCodeAPI = {
  getLocationCodes: params => getNormalizedList(api.get('/location-codes', { params })),
  createLocationCode: data => api.post('/location-codes', data),
  updateLocationCode: (id, data) => api.put(`/location-codes/${id}`, data),
  deleteLocationCode: id => api.delete(`/location-codes/${id}`),
};

export const assetAIAnalysisAPI = {
  analyzeAsset: (assetCode, data) => api.post(`/asset-ai-analysis/${assetCode}`, data),
  getAnalysisHistory: params => getNormalizedList(api.get('/asset-ai-analysis', { params })),
  getAnalysisReport: id => api.get(`/asset-ai-analysis/${id}/report`),
};

export const assetLabelAPI = {
  getLabels: params => getNormalizedList(api.get('/asset-labels', { params })),
  createLabel: data => api.post('/asset-labels', data),
  updateLabel: (id, data) => api.put(`/asset-labels/${id}`, data),
  deleteLabel: id => api.delete(`/asset-labels/${id}`),
  batchPrint: data => api.post('/asset-labels/batch-print', data),
};

export const tempAssetAPI = {
  getTempAssets: params => getNormalizedList(api.get('/temp-assets', { params })),
  createTempAsset: data => api.post('/temp-assets', data),
  updateTempAsset: (id, data) => api.put(`/temp-assets/${id}`, data),
  deleteTempAsset: id => api.delete(`/temp-assets/${id}`),
  convertToAsset: id => api.post(`/temp-assets/${id}/convert`),
};
