/**
 * 风险管理模块 API（复用现有 utils/api）
 */

import { api } from '../../api/client';
import { riskAPI } from '../../utils/api';

export const getRiskDashboard = riskAPI.getDashboardStats;

export const getRiskAssessments = riskAPI.getRiskAssessments;
export const createRiskAssessment = riskAPI.createRiskAssessment;
export const updateRiskAssessment = riskAPI.updateRiskAssessment;
export const deleteRiskAssessment = riskAPI.deleteRiskAssessment;

export const getRiskClassifications = riskAPI.getRiskClassifications;
export const createRiskClassification = riskAPI.createRiskClassification;
export const updateRiskClassification = riskAPI.updateRiskClassification;
export const deleteRiskClassification = riskAPI.deleteRiskClassification;

export const getRiskControls = riskAPI.getRiskControls;
export const createRiskControl = riskAPI.createRiskControl;
export const updateRiskControl = riskAPI.updateRiskControl;
export const deleteRiskControl = riskAPI.deleteRiskControl;

export const getRiskStatus = () => api.get('/risk/status');
