/**
 * 高风险操作 Hook
 * 提供状态管理和操作反馈的React Hook
 *
 * @author Claude AI Assistant
 * @date 2026-05-01
 */

import { useState, useCallback } from 'react';
import { message } from 'antd';
import {
  executeHighRiskOperation,
  createMaintenanceLog,
  createMaintenancePlan,
  createMaintenanceRequest,
  createMaintenanceWorkOrder,
  deleteMaintenanceLog,
  deleteMaintenancePlan,
  approveMaintenanceRequest,
} from '../utils/highRiskOperation';

/**
 * 高风险操作Hook
 *
 * @param {Object} options - Hook配置
 * @param {boolean} options.showConfirm - 默认是否显示确认对话框
 * @param {Function} options.onSuccess - 全局成功回调
 * @param {Function} options.onError - 全局错误回调
 * @returns {Object} - Hook API
 *
 * @example
 * ```jsx
 * import { useHighRiskOperation } from '../hooks/useHighRiskOperation';
 *
 * function MyComponent() {
 *   const {
 *     execute,
 *     createLog,
 *     createPlan,
 *     loading,
 *     error,
 *   } = useHighRiskOperation({
 *     onSuccess: (data) => console.log('成功', data),
 *     onError: (error) => console.error('失败', error),
 *   });
 *
 *   const handleCreate = async () => {
 *     const result = await createLog({
 *       asset_code: '000000555',
 *       maintenance_type: '故障维修',
 *     });
 *
 *     if (result.success) {
 *       message.success('创建成功');
 *     }
 *   };
 *
 *   return <button onClick={handleCreate} disabled={loading}>创建</button>;
 * }
 * ```
 */
export const useHighRiskOperation = (options = {}) => {
  const { showConfirm = false, onSuccess, onError } = options;

  // 状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  // 执行高风险操作
  const execute = useCallback(async (operationOptions) => {
    setLoading(true);
    setError(null);

    try {
      const result = await executeHighRiskOperation({
        ...operationOptions,
        showConfirm: operationOptions.showConfirm !== undefined ? operationOptions.showConfirm : showConfirm,
      });

      setLastResult(result);

      if (result.success) {
        onSuccess?.(result.data, result);
        return result;
      } else {
        const errorMsg = result.error || '操作失败';
        setError(errorMsg);
        onError?.(new Error(errorMsg), result);
        return result;
      }
    } catch (err) {
      const errorMsg = err.message || '操作异常';
      setError(errorMsg);
      const errorResult = { success: false, error: errorMsg };
      setLastResult(errorResult);
      onError?.(err, errorResult);
      return errorResult;
    } finally {
      setLoading(false);
    }
  }, [showConfirm, onSuccess, onError]);

  // 创建维修日志
  const createLog = useCallback(async (data, options = {}) => {
    return execute({
      operation: 'createMaintenanceLog',
      ...options,
      method: 'POST',
      url: '/maintenance/logs',
      data,
    });
  }, [execute]);

  // 创建预防性维护计划
  const createPlan = useCallback(async (data, options = {}) => {
    return execute({
      operation: 'createMaintenancePlan',
      ...options,
      method: 'POST',
      url: '/maintenance/plans',
      data,
    });
  }, [execute]);

  // 创建故障维修申请
  const createRequest = useCallback(async (data, options = {}) => {
    return execute({
      operation: 'createMaintenanceRequest',
      ...options,
      method: 'POST',
      url: '/maintenance/requests',
      data,
    });
  }, [execute]);

  // 创建维修工单
  const createWorkOrder = useCallback(async (data, options = {}) => {
    return execute({
      operation: 'createMaintenanceWorkOrder',
      ...options,
      method: 'POST',
      url: '/maintenance/workorders',
      data,
    });
  }, [execute]);

  // 删除维修日志
  const deleteLog = useCallback(async (id, options = {}) => {
    return execute({
      operation: 'deleteMaintenanceLog',
      ...options,
      method: 'DELETE',
      url: `/maintenance/logs/${id}`,
    });
  }, [execute]);

  // 删除预防性维护计划
  const deletePlan = useCallback(async (id, options = {}) => {
    return execute({
      operation: 'deleteMaintenancePlan',
      ...options,
      method: 'DELETE',
      url: `/maintenance/plans/${id}`,
    });
  }, [execute]);

  // 审批维修申请
  const approveRequest = useCallback(async (id, approved, comment, options = {}) => {
    return execute({
      operation: 'approveMaintenanceRequest',
      ...options,
      method: 'POST',
      url: `/maintenance/requests/${id}/approve`,
      data: { approved, comment },
    });
  }, [execute]);

  // 重置状态
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setLastResult(null);
  }, []);

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // 状态
    loading,
    error,
    lastResult,
    isLoading: loading,

    // 通用方法
    execute,

    // 维修日志
    createLog,
    deleteLog,

    // 预防性维护
    createPlan,
    deletePlan,

    // 故障维修申请
    createRequest,
    approveRequest,

    // 维修工单
    createWorkOrder,

    // 状态管理
    reset,
    clearError,
  };
};

/**
 * 导出便捷方法
 */
export const useMaintenanceOperations = (options = {}) => {
  const hook = useHighRiskOperation(options);

  return {
    // 维修日志
    createMaintenanceLog: hook.createLog,
    deleteMaintenanceLog: hook.deleteLog,

    // 预防性维护
    createPreventivePlan: hook.createPlan,
    deletePreventivePlan: hook.deletePlan,

    // 故障维修
    createFaultRequest: hook.createRequest,
    approveMaintenance: hook.approveRequest,

    // 维修工单
    createWorkOrder: hook.createWorkOrder,

    // 状态
    loading: hook.loading,
    error: hook.error,

    // 通用执行
    execute: hook.execute,
    reset: hook.reset,
  };
};

export default useHighRiskOperation;
