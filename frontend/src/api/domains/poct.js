/**
 * POCT 临床科室日常质控管理 - API 客户端
 */
import { api } from '../client';

export const poctAPI = {
  // 健康检查
  health: () => api.get('/poct-quality-control/health'),

  // ============ 监测科目 ============
  getSubjects: params => api.get('/poct-quality-control/subjects', { params }),
  createSubject: data => api.post('/poct-quality-control/subjects', data),
  updateSubject: (id, data) => api.put(`/poct-quality-control/subjects/${id}`, data),
  deleteSubject: id => api.delete(`/poct-quality-control/subjects/${id}`),

  // ============ 科室启用科目 ============
  getDepartmentSubjects: departmentId =>
    api.get(`/poct-quality-control/department-subjects/${departmentId}`),
  upsertDepartmentSubject: data =>
    api.post('/poct-quality-control/department-subjects', data),
  removeDepartmentSubject: (departmentId, subjectId) =>
    api.delete(`/poct-quality-control/department-subjects/${departmentId}/${subjectId}`),

  // ============ 班次 ============
  getShifts: () => api.get('/poct-quality-control/shifts'),
  createShift: data => api.post('/poct-quality-control/shifts', data),
  updateShift: (id, data) => api.put(`/poct-quality-control/shifts/${id}`, data),
  deleteShift: id => api.delete(`/poct-quality-control/shifts/${id}`),

  // ============ 排班 ============
  getSchedules: params => api.get('/poct-quality-control/schedules', { params }),
  upsertSchedule: data => api.post('/poct-quality-control/schedules', data),
  deleteSchedule: id => api.delete(`/poct-quality-control/schedules/${id}`),

  // ============ 质控记录 ============
  getRecords: params => api.get('/poct-quality-control/records', { params }),
  getRecordDetail: id => api.get(`/poct-quality-control/records/${id}`),
  createRecord: data => api.post('/poct-quality-control/records', data),
  updateRecord: (id, data) => api.put(`/poct-quality-control/records/${id}`, data),
  deleteRecord: id => api.delete(`/poct-quality-control/records/${id}`),
  getShiftTasks: params => api.get('/poct-quality-control/records/shift-tasks', { params }),
  getStatistics: params => api.get('/poct-quality-control/records/statistics', { params }),
  exportRecords: params => api.get('/poct-quality-control/records/export', { params }),

  // ============ 签名 ============
  addSignature: data => api.post('/poct-quality-control/signatures', data),

  // ============ 提醒规则 ============
  getReminders: () => api.get('/poct-quality-control/reminders'),
  upsertReminder: data => api.post('/poct-quality-control/reminders', data),
  updateReminder: (id, data) => api.put(`/poct-quality-control/reminders/${id}`, data),
  deleteReminder: id => api.delete(`/poct-quality-control/reminders/${id}`),
};
