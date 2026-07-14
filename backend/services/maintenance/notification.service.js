/**
 * 维修通知服务
 * 订阅 EventBus 的 MAINTENANCE_APPROVED 事件
 * 仅通过 Socket.IO 实时推送给工程师角色（业务流程已移除短信通知）
 *
 * 注：登录/注册/密码重置等账户安全相关的短信由 services/sms-code-service.js
 *     和 routes/sms-verification.js 提供，与业务流程通知解耦，互不影响。
 */

const logger = require('../../config/logger');
const { subscribe, SYSTEM_EVENTS } = require('../../core/EventBus');
const { pushToRole, pushToUser } = require('../../core/socket');

// 工程师角色列表
const ENGINEER_ROLES = ['maintenance_admin', 'maintenance_engineer'];

/**
 * 处理维修审批通过事件
 * @param {Object} eventData - 事件数据
 */
async function handleMaintenanceApproved(eventData) {
  const { request, workOrderNo, approver } = eventData;

  logger.info(`[MaintenanceNotify] 收到维修审批通过事件: 工单 ${workOrderNo}, 资产 ${request.asset_code}`);

  try {
    // 通过 Socket.IO 实时推送给工程师角色
    const socketData = {
      type: 'maintenance_approved',
      title: '新维修工单待处理',
      workOrderNo,
      requestId: request.id,
      requestNo: request.request_no,
      assetCode: request.asset_code,
      assetName: request.asset_name,
      faultDescription: request.fault_description,
      faultLevel: request.fault_level,
      approver,
      timestamp: new Date().toISOString(),
      actionUrl: '/maintenance/workorders',
    };

    pushToRole(ENGINEER_ROLES, 'maintenance:notification', socketData);
    logger.info(`[MaintenanceNotify] WebSocket 推送已发送给工程师角色`);
  } catch (error) {
    logger.error('[MaintenanceNotify] 处理维修审批通知失败:', error.message);
  }
}

/**
 * 维修申请创建 → 实时推送给审批人（维修管理员 / 资产管理员）
 */
function handleRequestCreated(eventData) {
  try {
    const socketData = {
      type: 'maintenance_request_created',
      title: '新维修申请待审批',
      requestId: eventData.id,
      requestNo: eventData.requestNo,
      assetCode: eventData.asset_code,
      assetName: eventData.asset_name,
      faultLevel: eventData.fault_level,
      faultDescription: eventData.fault_description,
      requestPerson: eventData.request_person,
      timestamp: new Date().toISOString(),
      actionUrl: '/maintenance/requests',
    };
    pushToRole(['maintenance_admin', 'asset_admin'], 'maintenance:notification', socketData);
  } catch (error) {
    logger.error('[MaintenanceNotify] 处理维修申请创建通知失败:', error.message);
  }
}

/**
 * 维修申请审批通过 → 实时推送给工程师（待开始维修）
 */
function handleRequestApproved(eventData) {
  try {
    const { request, approver } = eventData;
    const socketData = {
      type: 'maintenance_request_approved',
      title: '维修申请已批准，待开始维修',
      requestId: request?.id,
      requestNo: request?.request_no,
      assetCode: request?.asset_code,
      assetName: request?.asset_name,
      faultLevel: request?.fault_level,
      faultDescription: request?.fault_description,
      approver,
      timestamp: new Date().toISOString(),
      actionUrl: '/maintenance/requests',
    };
    pushToRole(ENGINEER_ROLES, 'maintenance:notification', socketData);
  } catch (error) {
    logger.error('[MaintenanceNotify] 处理维修申请批准通知失败:', error.message);
  }
}

/**
 * 维修开始 → 实时推送给申请人 + 被指派工程师
 */
function handleRequestStarted(eventData) {
  try {
    const socketData = {
      type: 'maintenance_request_started',
      title: '维修已开始',
      requestId: eventData.id,
      requestNo: eventData.requestNo,
      assetCode: eventData.asset_code,
      assetName: eventData.asset_name,
      repairPerson: eventData.repair_person,
      timestamp: new Date().toISOString(),
      actionUrl: `/maintenance/requests/${eventData.id}`,
    };
    if (eventData.request_person_id) {
      pushToUser(eventData.request_person_id, 'maintenance:notification', socketData);
    }
    if (eventData.repair_person_id) {
      pushToUser(eventData.repair_person_id, 'maintenance:notification', socketData);
    }
  } catch (error) {
    logger.error('[MaintenanceNotify] 处理维修开始通知失败:', error.message);
  }
}

/**
 * 初始化维修通知订阅
 * 在服务器启动时调用
 */
function initMaintenanceNotification() {
  subscribe(SYSTEM_EVENTS.MAINTENANCE_APPROVED, handleMaintenanceApproved);
  // 维修申请生命周期实时推送
  subscribe('maintenance_request:created', handleRequestCreated);
  subscribe('maintenance_request:approved', handleRequestApproved);
  subscribe('maintenance_request:started', handleRequestStarted);
  logger.info('[MaintenanceNotify] 维修审批通知订阅已注册（已移除短信通道）');
}

module.exports = {
  initMaintenanceNotification,
  handleMaintenanceApproved,
  handleRequestCreated,
  handleRequestApproved,
  handleRequestStarted,
};
