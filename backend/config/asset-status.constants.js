/**
 * 资产状态常量 - 单一数据源
 * 所有模块应引用此文件确保状态值一致性
 */

/** 资产主状态 ENUM 值（用于 assets 表 status 字段） */
const ASSET_STATUSES = {
  IN_USE: '在用',           // 资产正在使用
  IDLE: '闲置',             // 资产闲置
  MAINTENANCE: '维修',       // 资产在维修中（简称）
  SCRAPPED: '报废',         // 资产已报废
  TRANSFERRING: '调配中',    // 资产正在调配中
};

/** 资产状态值数组（用于验证和列表） */
const ASSET_STATUS_LIST = [
  ASSET_STATUSES.IN_USE,
  ASSET_STATUSES.IDLE,
  ASSET_STATUSES.MAINTENANCE,
  ASSET_STATUSES.SCRAPPED,
  ASSET_STATUSES.TRANSFERRING,
];

/** 维修申请状态 ENUM 值（用于 maintenance_requests 表 status 字段） */
const MAINTENANCE_REQUEST_STATUSES = {
  PENDING_APPROVAL: '待审批',   // 待审批
  APPROVED: '已批准',           // 已批准
  UNDER_REPAIR: '维修中',       // 维修中
  COMPLETED: '已完成',         // 已完成
  REJECTED: '已拒绝',          // 已拒绝
  CANCELLED: '已取消',         // 已取消
};

/** 维修申请状态值数组 */
const MAINTENANCE_REQUEST_STATUS_LIST = [
  MAINTENANCE_REQUEST_STATUSES.PENDING_APPROVAL,
  MAINTENANCE_REQUEST_STATUSES.APPROVED,
  MAINTENANCE_REQUEST_STATUSES.UNDER_REPAIR,
  MAINTENANCE_REQUEST_STATUSES.COMPLETED,
  MAINTENANCE_REQUEST_STATUSES.REJECTED,
  MAINTENANCE_REQUEST_STATUSES.CANCELLED,
];

/** 状态别名映射（兼容历史数据中可能存在的其他写法） */
const STATUS_ALIASES = {
  // 资产状态别名
  'idle': ASSET_STATUSES.IDLE,
  'standby': ASSET_STATUSES.IDLE,
  '维修中': ASSET_STATUSES.MAINTENANCE,
  '维护中': ASSET_STATUSES.MAINTENANCE,
  'scrapped': ASSET_STATUSES.SCRAPPED,
  '调配中': ASSET_STATUSES.TRANSFERRING,

  // 维修申请状态别名
  '已审批': MAINTENANCE_REQUEST_STATUSES.APPROVED,
  '进行中': MAINTENANCE_REQUEST_STATUSES.UNDER_REPAIR,
  '处理中': MAINTENANCE_REQUEST_STATUSES.UNDER_REPAIR,
};

/**
 * 规范化状态值
 * @param {string} status - 原始状态值
 * @param {string} type - 'asset' 或 'maintenance_request'
 * @returns {string} 规范化后的状态值
 */
function normalizeStatus(status, type = 'asset') {
  if (!status) return null;

  // 先检查是否是已知的状态值
  const statusStr = String(status).trim();
  if (type === 'asset') {
    if (ASSET_STATUS_LIST.includes(statusStr)) return statusStr;
    return STATUS_ALIASES[statusStr] || statusStr;
  } else if (type === 'maintenance_request') {
    if (MAINTENANCE_REQUEST_STATUS_LIST.includes(statusStr)) return statusStr;
    return STATUS_ALIASES[statusStr] || statusStr;
  }
  return statusStr;
}

/**
 * 检查是否是有效的资产状态
 * @param {string} status
 * @returns {boolean}
 */
function isValidAssetStatus(status) {
  if (!status) return false;
  const statusStr = String(status).trim();
  return ASSET_STATUS_LIST.includes(statusStr) || Object.values(STATUS_ALIASES).includes(statusStr);
}

module.exports = {
  ASSET_STATUSES,
  ASSET_STATUS_LIST,
  MAINTENANCE_REQUEST_STATUSES,
  MAINTENANCE_REQUEST_STATUS_LIST,
  STATUS_ALIASES,
  normalizeStatus,
  isValidAssetStatus,
};
