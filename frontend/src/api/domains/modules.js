import { api } from '../client';
import { normalizeListResult } from '../normalizers';

const getNormalizedList = request => request.then(normalizeListResult);

const mapListData = (result, mapper) => ({
  ...result,
  data: Array.isArray(result?.data) ? result.data.map(mapper) : [],
});

export const complianceAPI = {
  getDashboardStats: () => api.get('/compliance/dashboard-stats'),

  getMaintenanceTemplates: params =>
    getNormalizedList(api.get('/compliance/maintenance-level/templates', { params })),
  getMaintenanceTemplate: id => api.get(`/compliance/maintenance-level/templates/${id}`),
  createMaintenanceTemplate: data => api.post('/compliance/maintenance-level/templates', data),
  updateMaintenanceTemplate: (id, data) =>
    api.put(`/compliance/maintenance-level/templates/${id}`, data),
  deleteMaintenanceTemplate: id => api.delete(`/compliance/maintenance-level/templates/${id}`),

  getMaintenancePlans: params =>
    getNormalizedList(api.get('/compliance/maintenance-level/plans', { params })),
  getMaintenancePlan: id => api.get(`/maintenance/plans/${id}`),
  // 合规模块当前只提供“计划列表/生成”，单条 CRUD 暂复用通用保养计划接口。
  createMaintenancePlan: data => api.post('/maintenance/plans', data),
  updateMaintenancePlan: (id, data) => api.put(`/maintenance/plans/${id}`, data),
  deleteMaintenancePlan: id => api.delete(`/maintenance/plans/${id}`),
  generateMaintenancePlans: data =>
    api.post('/compliance/maintenance-level/plans/generate', data || {}),

  getSpecialEquipmentStatistics: () =>
    api.get('/compliance/special-equipment/statistics/overview'),
  getSpecialEquipment: params =>
    getNormalizedList(api.get('/compliance/special-equipment', { params })),
  createSpecialEquipment: data => api.post('/compliance/special-equipment', data),
  updateSpecialEquipment: (id, data) => api.put(`/compliance/special-equipment/${id}`, data),
  deleteSpecialEquipment: id => api.delete(`/compliance/special-equipment/${id}`),
  getSpecialEquipmentInspections: params =>
    getNormalizedList(api.get('/compliance/special-equipment/inspections', { params })),
  createSpecialEquipmentInspection: data =>
    api.post('/compliance/special-equipment/inspections', data),
  updateSpecialEquipmentInspection: (id, data) =>
    api.put(`/compliance/special-equipment/inspections/${id}`, data),
  deleteSpecialEquipmentInspection: id =>
    api.delete(`/compliance/special-equipment/inspections/${id}`),
  getSpecialEquipmentExpiringInspections: params =>
    getNormalizedList(api.get('/compliance/special-equipment/expiring-inspections', { params })),

  // 特种设备导入/导出
  getSpecialEquipmentImportTemplate: () =>
    api.get('/compliance/special-equipment/import-template', { responseType: 'blob' }),
  validateSpecialEquipmentImport: formData =>
    api.post('/compliance/special-equipment/import/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  importSpecialEquipment: formData =>
    api.post('/compliance/special-equipment/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  exportSpecialEquipment: params =>
    api.get('/compliance/special-equipment/export', { params, responseType: 'blob' }),

  getSafetyInspections: params =>
    getNormalizedList(api.get('/compliance/safety-inspections', { params })),
  createSafetyInspection: data => api.post('/compliance/safety-inspections', data),
  updateSafetyInspection: (id, data) => api.put(`/compliance/safety-inspections/${id}`, data),
  deleteSafetyInspection: id => api.delete(`/compliance/safety-inspections/${id}`),
};

export const riskAPI = {
  getDashboardStats: () => api.get('/risk/dashboard'),
  getAssessments: params => getNormalizedList(api.get('/risk/assessments', { params })),
  getRiskAssessments: params => getNormalizedList(api.get('/risk/assessments', { params })),
  createRiskAssessment: data => api.post('/risk/assessments', data),
  updateRiskAssessment: (id, data) => api.put(`/risk/assessments/${id}`, data),
  deleteRiskAssessment: id => api.delete(`/risk/assessments/${id}`),

  getRiskClassifications: params =>
    getNormalizedList(api.get('/risk/classification', { params })),
  createRiskClassification: data => api.post('/risk/classification', data),
  updateRiskClassification: (id, data) => api.put(`/risk/classification/${id}`, data),
  deleteRiskClassification: id => api.delete(`/risk/classification/${id}`),

  getRiskControls: params => getNormalizedList(api.get('/risk/controls', { params })),
  createRiskControl: data => api.post('/risk/controls', data),
  updateRiskControl: (id, data) => api.put(`/risk/controls/${id}`, data),
  deleteRiskControl: id => api.delete(`/risk/controls/${id}`),
};

export const staffAPI = {
  getDashboardStats: () => api.get('/staff/dashboard'),
  getStaff: params =>
    getNormalizedList(api.get('/staff', { params })).then(result =>
      mapListData(result, item => ({
        ...item,
        name: item.name || item.staff_name || item.staff_real_name || item.staff_username || '',
        position: item.position || item.qualification_type || '',
        department: item.department || '',
      }))
    ),
  getQualifications: params => getNormalizedList(api.get('/staff/qualifications', { params })),
  createQualification: data => api.post('/staff/qualifications', data),
  updateQualification: (id, data) => api.put(`/staff/qualifications/${id}`, data),
  deleteQualification: id => api.delete(`/staff/qualifications/${id}`),
  deleteStaff: id => api.delete(`/staff/${id}`),

  getTrainingRecords: params =>
    getNormalizedList(api.get('/staff/training-records', { params })),
  createTrainingRecord: data => api.post('/staff/training-records', data),
  updateTrainingRecord: (id, data) => api.put(`/staff/training-records/${id}`, data),
  deleteTrainingRecord: id => api.delete(`/staff/training-records/${id}`),

  getAssessments: params => getNormalizedList(api.get('/staff/assessments', { params })),
  createAssessment: data => api.post('/staff/assessments', data),
  updateAssessment: (id, data) => api.put(`/staff/assessments/${id}`, data),
  deleteAssessment: id => api.delete(`/staff/assessments/${id}`),
};

export const uptimeAPI = {
  getDashboard: () => api.get('/uptime/statistics/dashboard'),
  getOverview: () => api.get('/uptime/statistics/overview'),

  getOperationLogs: params =>
    getNormalizedList(api.get('/uptime/operation-logs', { params })),
  createOperationLog: data => api.post('/uptime/operation-logs', data),
  updateOperationLog: (id, data) => api.put(`/uptime/operation-logs/${id}`, data),
  deleteOperationLog: id => api.delete(`/uptime/operation-logs/${id}`),

  getStatistics: params => getNormalizedList(api.get('/uptime/statistics', { params })),
  getUptime: params => getNormalizedList(api.get('/uptime', { params })),
  createUptime: data => api.post('/uptime', data),
  updateUptime: (id, data) => api.put(`/uptime/${id}`, data),
  deleteUptime: id => api.delete(`/uptime/${id}`),
};
