/**
 * 开机率管理模块 API（基于现有 utils/api 统一封装）
 */

import { api } from '../../api/client';
import { uptimeAPI } from '../../utils/api';

// 运行记录
export const getOperationLogs = uptimeAPI.getOperationLogs;
export const createOperationLog = uptimeAPI.createOperationLog;
export const updateOperationLog = uptimeAPI.updateOperationLog;
export const deleteOperationLog = uptimeAPI.deleteOperationLog;

export const batchCreateOperationLogs = (logs: Array<Record<string, unknown>>) =>
  api.post('/uptime/batch-operation-logs', { logs });

// 开机率统计
export const getUptimeStatistics = uptimeAPI.getUptime;
export const createUptimeStatistics = uptimeAPI.createUptime;
export const updateUptimeStatistics = uptimeAPI.updateUptime;
export const deleteUptimeStatistics = uptimeAPI.deleteUptime;

export const getUptimeDashboard = uptimeAPI.getDashboard;
export const getUptimeOverview = uptimeAPI.getDashboard;
export const calculateUptime = (payload: Record<string, unknown>) =>
  api.post('/uptime/calculate', payload);

// 模块状态
export const getUptimeStatus = () => api.get('/uptime/status');
export const getUptimeConfig = () => api.get('/uptime/config');
