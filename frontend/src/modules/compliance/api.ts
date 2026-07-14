/**
 * 合规性管理模块 API（基于现有 utils/api 统一封装）
 */

import { api } from '../../api/client';
import { complianceAPI } from '../../utils/api';

// 分级保养
export const getMaintenanceTemplates = complianceAPI.getMaintenanceTemplates;
export const createMaintenanceTemplate = complianceAPI.createMaintenanceTemplate;
export const updateMaintenanceTemplate = complianceAPI.updateMaintenanceTemplate;
export const deleteMaintenanceTemplate = complianceAPI.deleteMaintenanceTemplate;

export const getMaintenancePlans = complianceAPI.getMaintenancePlans;
export const createMaintenancePlan = complianceAPI.createMaintenancePlan;
export const updateMaintenancePlan = complianceAPI.updateMaintenancePlan;
export const deleteMaintenancePlan = complianceAPI.deleteMaintenancePlan;
export const generateMaintenancePlans = complianceAPI.generateMaintenancePlans;

// 兼容旧调用：执行计划统一复用计划更新接口
export const executeMaintenancePlan = (id: number, data: Record<string, unknown>) =>
  complianceAPI.updateMaintenancePlan(id, { ...data, status: 'completed' });

// 保养统计
export const getMaintenanceStatistics = complianceAPI.getDashboardStats;

// 特种设备
export const getSpecialEquipment = complianceAPI.getSpecialEquipment;
export const createSpecialEquipment = complianceAPI.createSpecialEquipment;
export const updateSpecialEquipment = complianceAPI.updateSpecialEquipment;
export const deleteSpecialEquipment = complianceAPI.deleteSpecialEquipment;
export const getSpecialEquipmentInspections = complianceAPI.getSpecialEquipmentInspections;
export const addSpecialEquipmentInspection = complianceAPI.createSpecialEquipmentInspection;
export const updateSpecialEquipmentInspection = complianceAPI.updateSpecialEquipmentInspection;
export const deleteSpecialEquipmentInspection = complianceAPI.deleteSpecialEquipmentInspection;
export const getExpiringInspections = complianceAPI.getSpecialEquipmentExpiringInspections;
export const getSpecialEquipmentStats = complianceAPI.getSpecialEquipmentStatistics;

// 安全检测
export const getSafetyInspections = complianceAPI.getSafetyInspections;
export const createSafetyInspection = complianceAPI.createSafetyInspection;
export const updateSafetyInspection = complianceAPI.updateSafetyInspection;
export const deleteSafetyInspection = complianceAPI.deleteSafetyInspection;

// 兼容旧命名
export const updateRectification = complianceAPI.updateSafetyInspection;
export const getExpiringSafetyInspections = (days = 90) =>
  api.get('/compliance/safety-inspections/expiring', { params: { days } });
export const getSafetyInspectionStats = () => api.get('/compliance/safety-inspections/statistics/overview');

// 模块状态
export const getComplianceStatus = () => api.get('/compliance/status');
