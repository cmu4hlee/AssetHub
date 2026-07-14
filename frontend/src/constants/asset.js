/**
 * 资产管理模块公共常量
 * 集中管理资产状态、类型等，避免在多个组件中重复定义
 */

// 资产状态（与数据库值保持一致：中文 key）
// 闭环：闲置 → 在用 → 维修 → 报废（也可：闲置 → 调配中 → 在用）
export const ASSET_STATUS = {
  '在用': { text: '在用', color: 'green', tone: 'success', icon: 'check-circle' },
  '闲置': { text: '闲置', color: 'blue', tone: 'cyan', icon: 'pause-circle' },
  '维修': { text: '维修', color: 'orange', tone: 'warning', icon: 'tool' },
  '报废': { text: '报废', color: 'red', tone: 'danger', icon: 'stop' },
  '调配中': { text: '调配中', color: 'purple', tone: 'purple', icon: 'swap' },
};

export const ASSET_STATUS_TRANSITIONS = {
  '在用': ['维修', '闲置', '调配中', '报废'],
  '闲置': ['在用', '调配中', '报废'],
  '维修': ['在用', '报废'],
  '调配中': ['在用', '闲置'],
  '报废': [],
};

// 资产变更类型
export const ASSET_CHANGE_TYPE = {
  create: { text: '新增', color: 'green' },
  update: { text: '修改', color: 'blue' },
  delete: { text: '删除', color: 'red' },
  transfer: { text: '调拨', color: 'cyan' },
  maintain: { text: '维修', color: 'orange' },
  scrap: { text: '报废', color: 'red' },
  accept: { text: '验收', color: 'purple' },
  inspect: { text: '巡检', color: 'gold' },
};

// 折旧方法
export const DEPRECIATION_METHOD = {
  straight_line: { text: '直线法', desc: '每年折旧额相等' },
  double_declining: { text: '双倍余额递减法', desc: '前期折旧多，后期少' },
  sum_of_years: { text: '年数总和法', desc: '按年数总和分摊' },
  none: { text: '不计提折旧', desc: '不进行折旧计算' },
};

// 验收申请状态（与 quality-control 模块共用）
export const ACCEPTANCE_STATUS = {
  draft: { text: '草稿', color: 'default' },
  pending: { text: '待审核', color: 'warning' },
  approved: { text: '已通过', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
};

// 维修工单状态
export const MAINTENANCE_STATUS = {
  pending: { text: '待派工', color: 'default' },
  assigned: { text: '已派工', color: 'processing' },
  in_progress: { text: '维修中', color: 'blue' },
  pending_acceptance: { text: '待验收', color: 'gold' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'default' },
};

export const MAINTENANCE_STATUS_TRANSITIONS = {
  pending: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['pending_acceptance', 'cancelled'],
  pending_acceptance: ['completed', 'in_progress'],
  completed: [],
  cancelled: [],
};

export const MAINTENANCE_PRIORITY = {
  low: { text: '低', color: 'default', tone: 'cyan' },
  medium: { text: '中', color: 'blue', tone: 'primary' },
  high: { text: '高', color: 'orange', tone: 'warning' },
  urgent: { text: '紧急', color: 'red', tone: 'danger' },
};

// 巡检状态
export const INSPECTION_STATUS = {
  scheduled: { text: '待巡检', color: 'default' },
  in_progress: { text: '巡检中', color: 'processing' },
  completed: { text: '已完成', color: 'success' },
  overdue: { text: '已逾期', color: 'red' },
  skipped: { text: '已跳过', color: 'default' },
};

// 通用工具函数
export const getStatusInfo = (status, statusMap, fallback = { text: '-', color: 'default' }) => {
  return statusMap?.[status] || fallback;
};
