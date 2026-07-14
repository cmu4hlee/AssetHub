/**
 * 巡检管理模块 API（增强版）
 */

import { api } from '../client';
import { normalizeListResult } from '../normalizers';

const getNormalizedList = request => request.then(normalizeListResult);

export const inspectionAPI = {
  // ============ 巡检模板 ============
  getTemplates: params => getNormalizedList(api.get('/inspection/templates', { params })),
  getTemplate: id => api.get(`/inspection/templates/${id}`),
  createTemplate: data => api.post('/inspection/templates', data),
  updateTemplate: (id, data) => api.put(`/inspection/templates/${id}`, data),
  deleteTemplate: id => api.delete(`/inspection/templates/${id}`),
  copyTemplate: (id, target_name) => api.post(`/inspection/templates/${id}/copy`, { target_name }),

  // ============ 巡检任务 ============
  getTasks: params => getNormalizedList(api.get('/inspection/tasks', { params })),
  getTask: id => api.get(`/inspection/tasks/${id}`),
  createTask: data => api.post('/inspection/tasks', data),
  updateTask: (id, data) => api.put(`/inspection/tasks/${id}`, data),
  deleteTask: id => api.delete(`/inspection/tasks/${id}`),
  getExpiringTasks: (days = 3) => api.get('/inspection/tasks/expiring', { params: { days } }),
  batchCreateTasks: data => api.post('/inspection/tasks/batch', data),
  scheduleNextTask: id => api.post(`/inspection/tasks/${id}/schedule-next`),

  // ============ 巡检记录单 ============
  getRecords: params => getNormalizedList(api.get('/inspection/records', { params })),
  getRecord: id => api.get(`/inspection/records/${id}`),
  createRecord: data => api.post('/inspection/records', data),
  updateRecord: (id, data) => api.put(`/inspection/records/${id}`, data),
  deleteRecord: id => api.delete(`/inspection/records/${id}`),
  reviewRecord: (id, data) => api.post(`/inspection/records/${id}/review`, data),
  exportRecordPdf: id => api.get(`/inspection/records/${id}/pdf`, { responseType: 'blob' }),

  // ============ 巡检问题 ============
  getIssues: params => getNormalizedList(api.get('/inspection/issues', { params })),
  getIssue: id => api.get(`/inspection/issues/${id}`),
  updateIssue: (id, data) => api.put(`/inspection/issues/${id}`, data),
  getIssueHistory: id => api.get(`/inspection/issues/${id}/history`),
  convertIssueToWorkOrder: id => api.post(`/inspection/issues/${id}/convert-work-order`),

  // ============ 巡检计划 ============
  getPlans: params => getNormalizedList(api.get('/inspection/plans', { params })),
  getPlan: id => api.get(`/inspection/plans/${id}`),
  createPlan: data => api.post('/inspection/plans', data),
  updatePlan: (id, data) => api.put(`/inspection/plans/${id}`, data),
  deletePlan: id => api.delete(`/inspection/plans/${id}`),
  dispatchPlan: id => api.post(`/inspection/plans/${id}/dispatch`),

  // ============ 巡检路线 ============
  getRoutes: params => getNormalizedList(api.get('/inspection/routes', { params })),
  getRoute: id => api.get(`/inspection/routes/${id}`),
  createRoute: data => api.post('/inspection/routes', data),
  updateRoute: (id, data) => api.put(`/inspection/routes/${id}`, data),
  deleteRoute: id => api.delete(`/inspection/routes/${id}`),

  // ============ 日历/统计/通知 ============
  getCalendar: params => api.get('/inspection/calendar', { params }),
  getStatistics: params => api.get('/inspection/statistics', { params }),
  getEnrichedStatistics: params => api.get('/inspection/statistics/enriched', { params }),
  getNotifications: params => getNormalizedList(api.get('/inspection/notifications', { params })),
  markNotificationRead: id => api.post(`/inspection/notifications/${id}/read`),

  // ============ 模块状态 ============
  getStatus: () => api.get('/inspection/status'),
};

export default inspectionAPI;
