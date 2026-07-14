/**
 * 人员资质模块 API（复用现有 utils/api）
 */

import { api } from '../../api/client';
import { staffAPI } from '../../utils/api';

export const getStaffDashboard = staffAPI.getDashboardStats;
export const getStaff = staffAPI.getStaff;
export const getQualifications = staffAPI.getQualifications;
export const createQualification = staffAPI.createQualification;
export const updateQualification = staffAPI.updateQualification;
export const deleteQualification = staffAPI.deleteQualification;

export const getTrainingRecords = staffAPI.getTrainingRecords;
export const createTrainingRecord = staffAPI.createTrainingRecord;
export const updateTrainingRecord = staffAPI.updateTrainingRecord;
export const deleteTrainingRecord = staffAPI.deleteTrainingRecord;

export const getAssessments = staffAPI.getAssessments;
export const createAssessment = staffAPI.createAssessment;
export const updateAssessment = staffAPI.updateAssessment;
export const deleteAssessment = staffAPI.deleteAssessment;

export const getStaffStatus = () => api.get('/staff/status');
