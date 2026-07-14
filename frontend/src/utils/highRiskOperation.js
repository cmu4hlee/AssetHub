/**
 * 高风险操作封装工具
 * 提供统一的高风险操作处理接口，自动处理幂等性和二次确认
 *
 * @author Claude AI Assistant
 * @date 2026-05-01
 */

import { message, Modal } from 'antd';
import { api } from '../api/client';

/**
 * 高风险操作类型枚举
 */
export const HighRiskActionType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  REJECT: 'reject',
};

/**
 * 高风险操作配置
 */
const HIGH_RISK_CONFIG = {
  // 需要高风险确认的操作
  createOperations: [
    '/maintenance/logs',
    '/maintenance/plans',
    '/maintenance/requests',
    '/maintenance/workorders',
    '/maintenance/templates',
  ],
  // 需要确认的操作类型
  confirmableActions: ['create', 'update', 'delete', 'approve', 'reject'],
  // 确认超时时间（毫秒）
  confirmationTimeout: 5 * 60 * 1000, // 5分钟
};

/**
 * 判断是否是高风险操作
 * @param {string} method - HTTP方法
 * @param {string} url - 请求URL
 * @returns {boolean}
 */
export const isHighRiskOperation = (method, url) => {
  const normalizedMethod = String(method).toLowerCase();
  const normalizedUrl = String(url).toLowerCase();

  // POST请求通常是创建操作
  if (normalizedMethod === 'post') {
    return HIGH_RISK_CONFIG.createOperations.some(op => normalizedUrl.includes(op));
  }

  // PUT和DELETE也是高风险操作
  if (normalizedMethod === 'put' || normalizedMethod === 'delete') {
    return normalizedUrl.includes('/maintenance/');
  }

  return false;
};

/**
 * 执行高风险操作
 * 自动处理幂等性和二次确认
 *
 * @param {Object} options - 操作配置
 * @param {string} options.method - HTTP方法 (POST, PUT, DELETE)
 * @param {string} options.url - API路径
 * @param {Object} options.data - 请求数据
 * @param {Object} options.params - URL参数
 * @param {Object} options.headers - 自定义请求头
 * @param {string} options.confirmTitle - 确认对话框标题
 * @param {string} options.confirmContent - 确认对话框内容
 * @param {boolean} options.showConfirm - 是否显示确认对话框
 * @param {Function} options.onSuccess - 成功回调
 * @param {Function} options.onError - 失败回调
 * @param {Function} options.beforeRequest - 请求前回调
 * @returns {Promise<Object>} - 操作结果
 *
 * @example
 * ```javascript
 * // 基础用法
 * const result = await executeHighRiskOperation({
 *   method: 'POST',
 *   url: '/maintenance/logs',
 *   data: { asset_code: '000000555', maintenance_type: '故障维修' },
 * });
 *
 * // 带确认对话框
 * const result = await executeHighRiskOperation({
 *   method: 'POST',
 *   url: '/maintenance/logs',
 *   data: { asset_code: '000000555' },
 *   confirmTitle: '确认创建',
 *   confirmContent: '确定要创建这条维修日志吗？',
 *   showConfirm: true,
 * });
 *
 * // 带回调
 * const result = await executeHighRiskOperation({
 *   method: 'POST',
 *   url: '/maintenance/logs',
 *   data: { asset_code: '000000555' },
 *   onSuccess: (data) => console.log('创建成功', data),
 *   onError: (error) => console.error('创建失败', error),
 * });
 * ```
 */
export const executeHighRiskOperation = async (options) => {
  const {
    method = 'POST',
    url,
    data = {},
    params = {},
    headers = {},
    confirmTitle = '高风险操作确认',
    confirmContent = '此操作可能会产生重要影响，是否继续？',
    showConfirm = false,
    onSuccess,
    onError,
    beforeRequest,
  } = options;

  // 前置检查
  if (!url) {
    const error = new Error('URL不能为空');
    onError?.(error);
    return { success: false, error: error.message };
  }

  try {
    // 显示确认对话框（如果需要）
    if (showConfirm) {
      const confirmed = await new Promise((resolve, reject) => {
        Modal.confirm({
          title: confirmTitle,
          content: confirmContent,
          okText: '确认',
          cancelText: '取消',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (!confirmed) {
        const error = new Error('用户取消操作');
        onError?.(error);
        return { success: false, error: error.message, cancelled: true };
      }
    }

    // 执行前置回调
    beforeRequest?.();

    // 构建请求配置
    const config = {
      method: method.toUpperCase(),
      url,
      data,
      params,
      headers: {
        ...headers,
        // 确保幂等性键存在
        'Idempotency-Key': headers['Idempotency-Key'] || generateIdempotencyKey(),
      },
    };

    // 发送请求
    // 注意：axios拦截器会自动处理幂等性键和高风险确认
    const response = await api.request(config);

    // 处理响应
    if (response.success !== false) {
      const result = {
        success: true,
        data: response.data || response,
        message: response.message || '操作成功',
      };

      // 调用成功回调
      onSuccess?.(result.data, result);

      return result;
    } else {
      throw new Error(response.message || '操作失败');
    }
  } catch (error) {
    // 构建错误结果
    const errorResult = {
      success: false,
      error: error.message || '操作失败',
      status: error.response?.status,
      data: error.response?.data,
    };

    // 调用错误回调
    onError?.(error, errorResult);

    // 显示错误消息
    if (!errorResult.cancelled) {
      message.error(errorResult.error);
    }

    return errorResult;
  }
};

/**
 * 生成幂等性键
 * @returns {string}
 */
export const generateIdempotencyKey = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `web-${timestamp}-${random}`;
};

/**
 * 创建维修日志（高风险操作封装）
 *
 * @param {Object} data - 维修日志数据
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>}
 *
 * @example
 * ```javascript
 * const result = await createMaintenanceLog({
 *   asset_code: '000000555',
 *   maintenance_type: '故障维修',
 *   maintenance_date: '2026-05-01',
 *   maintenance_person: '张三',
 *   maintenance_content: '设备检修',
 *   maintenance_cost: 500.00,
 * });
 * ```
 */
export const createMaintenanceLog = async (data, options = {}) => {
  return executeHighRiskOperation({
    method: 'POST',
    url: '/maintenance/logs',
    data,
    confirmTitle: options.confirmTitle || '创建维修日志',
    confirmContent: options.confirmContent || '确定要创建这条维修日志吗？',
    showConfirm: options.showConfirm || false,
    onSuccess: options.onSuccess,
    onError: options.onError,
    beforeRequest: options.beforeRequest,
  });
};

/**
 * 创建预防性维护计划（高风险操作封装）
 *
 * @param {Object} data - 计划数据
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>}
 *
 * @example
 * ```javascript
 * const result = await createMaintenancePlan({
 *   asset_code: '000000555',
 *   plan_name: '季度维护计划',
 *   maintenance_type: '预防性维护',
 *   cycle_type: '按季度',
 *   cycle_value: 1,
 *   next_maintenance_date: '2026-07-01',
 * });
 * ```
 */
export const createMaintenancePlan = async (data, options = {}) => {
  return executeHighRiskOperation({
    method: 'POST',
    url: '/maintenance/plans',
    data,
    confirmTitle: options.confirmTitle || '创建维护计划',
    confirmContent: options.confirmContent || '确定要创建这个维护计划吗？',
    showConfirm: options.showConfirm || false,
    onSuccess: options.onSuccess,
    onError: options.onError,
    beforeRequest: options.beforeRequest,
  });
};

/**
 * 创建故障维修申请（高风险操作封装）
 *
 * @param {Object} data - 申请数据
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>}
 *
 * @example
 * ```javascript
 * const result = await createMaintenanceRequest({
 *   asset_code: '000000555',
 *   fault_description: '设备无法启动',
 *   fault_level: '紧急',
 *   request_date: '2026-05-01',
 *   request_department: '设备科',
 * });
 * ```
 */
export const createMaintenanceRequest = async (data, options = {}) => {
  return executeHighRiskOperation({
    method: 'POST',
    url: '/maintenance/requests',
    data,
    confirmTitle: options.confirmTitle || '创建维修申请',
    confirmContent: options.confirmContent || '确定要提交这个维修申请吗？',
    showConfirm: options.showConfirm || false,
    onSuccess: options.onSuccess,
    onError: options.onError,
    beforeRequest: options.beforeRequest,
  });
};

/**
 * 创建维修工单（高风险操作封装）
 *
 * @param {Object} data - 工单数据
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>}
 *
 * @example
 * ```javascript
 * const result = await createMaintenanceWorkOrder({
 *   asset_code: '000000555',
 *   title: '设备年度检修',
 *   description: '进行全面的设备检修',
 *   priority: 2,
 *   assigned_to: '工程师A',
 * });
 * ```
 */
export const createMaintenanceWorkOrder = async (data, options = {}) => {
  return executeHighRiskOperation({
    method: 'POST',
    url: '/maintenance/workorders',
    data,
    confirmTitle: options.confirmTitle || '创建维修工单',
    confirmContent: options.confirmContent || '确定要创建这个维修工单吗？',
    showConfirm: options.showConfirm || false,
    onSuccess: options.onSuccess,
    onError: options.onError,
    beforeRequest: options.beforeRequest,
  });
};

/**
 * 删除维修日志（高风险操作封装）
 *
 * @param {number} id - 日志ID
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>}
 */
export const deleteMaintenanceLog = async (id, options = {}) => {
  return executeHighRiskOperation({
    method: 'DELETE',
    url: `/maintenance/logs/${id}`,
    confirmTitle: options.confirmTitle || '删除维修日志',
    confirmContent: options.confirmContent || '确定要删除这条维修日志吗？此操作不可恢复！',
    showConfirm: options.showConfirm !== false, // 默认显示确认
    onSuccess: options.onSuccess,
    onError: options.onError,
    beforeRequest: options.beforeRequest,
  });
};

/**
 * 删除预防性维护计划（高风险操作封装）
 *
 * @param {number} id - 计划ID
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>}
 */
export const deleteMaintenancePlan = async (id, options = {}) => {
  return executeHighRiskOperation({
    method: 'DELETE',
    url: `/maintenance/plans/${id}`,
    confirmTitle: options.confirmTitle || '删除维护计划',
    confirmContent: options.confirmContent || '确定要删除这个维护计划吗？此操作不可恢复！',
    showConfirm: options.showConfirm !== false, // 默认显示确认
    onSuccess: options.onSuccess,
    onError: options.onError,
    beforeRequest: options.beforeRequest,
  });
};

/**
 * 审批维修申请（高风险操作封装）
 *
 * @param {number} id - 申请ID
 * @param {boolean} approved - 是否批准
 * @param {string} comment - 审批意见
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>}
 *
 * @example
 * ```javascript
 * const result = await approveMaintenanceRequest(1, true, '同意维修');
 * ```
 */
export const approveMaintenanceRequest = async (id, approved, comment = '', options = {}) => {
  return executeHighRiskOperation({
    method: 'POST',
    url: `/maintenance/requests/${id}/approve`,
    data: { approved, comment },
    confirmTitle: options.confirmTitle || (approved ? '批准申请' : '拒绝申请'),
    confirmContent: options.confirmContent || (approved ? '确定要批准这个申请吗？' : '确定要拒绝这个申请吗？'),
    showConfirm: options.showConfirm !== false,
    onSuccess: options.onSuccess,
    onError: options.onError,
    beforeRequest: options.beforeRequest,
  });
};

/**
 * 导出所有高风险操作函数
 */
export default {
  executeHighRiskOperation,
  generateIdempotencyKey,
  isHighRiskOperation,
  createMaintenanceLog,
  createMaintenancePlan,
  createMaintenanceRequest,
  createMaintenanceWorkOrder,
  deleteMaintenanceLog,
  deleteMaintenancePlan,
  approveMaintenanceRequest,
};
