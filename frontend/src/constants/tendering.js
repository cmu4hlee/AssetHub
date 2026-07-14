/**
 * 招标采购模块公共字典常量
 * 集中管理状态/类型标签，避免在多个组件中重复定义
 *
 * 命名规范：
 *  - REQUEST_*  采购申请（前置于招标流程）
 *  - TENDER_*  招标项目
 *  - BID_*     投标
 *  - CONTRACT_* 合同
 *  - ACCEPTANCE_* 验收
 *  - INVOICE_* 发票
 *  - PAYMENT_* 付款
 *  - SUPPLIER_* 供应商
 */

// ============================================================
// 采购申请状态
// 闭环：草稿 → 待审批 → 已审批 → 已定标 → 合同签订 → 验收 → 完成
// ============================================================
export const REQUEST_STATUS = {
  draft: { text: '草稿', color: 'default' },
  applying: { text: '待审批', color: 'warning' },
  approved: { text: '已审批', color: 'processing' },
  rejected: { text: '已驳回', color: 'error' },
  awarded: { text: '已定标', color: 'cyan' },
  contract_signing: { text: '合同签订中', color: 'gold' },
  accepting: { text: '验收中', color: 'lime' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'default' },
};

// 采购申请状态流转（用于按钮显隐和流程进度展示）
export const REQUEST_STATUS_TRANSITIONS = {
  draft: ['applying', 'cancelled'],
  applying: ['approved', 'rejected'],
  approved: ['awarded', 'cancelled'],
  rejected: ['draft', 'cancelled'],
  awarded: ['contract_signing'],
  contract_signing: ['accepting'],
  accepting: ['completed', 'rejected'],
  completed: [],
  cancelled: [],
};

// ============================================================
// 招标项目状态
// 闭环：草稿 → 已发布 → 投标中 → 评标中 → 已定标 → 合同签订 → 完成
// ============================================================
export const TENDER_STATUS = {
  draft: { text: '草稿', color: 'default' },
  published: { text: '已发布', color: 'processing' },
  bidding: { text: '投标中', color: 'blue' },
  evaluating: { text: '评标中', color: 'gold' },
  awarded: { text: '已定标', color: 'success' },
  contract_signing: { text: '合同签订中', color: 'cyan' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'red' },
};

// ============================================================
// 采购流程分类
// ============================================================
export const TENDER_CATEGORY = {
  simple: { text: '简易采购', color: 'blue', desc: '小额、快速采购流程' },
  agreement: { text: '协议采购', color: 'purple', desc: '框架协议下的采购' },
  tender: { text: '招标采购', color: 'gold', desc: '公开/邀请招标' },
};

// ============================================================
// 招标类型
// ============================================================
export const TENDER_TYPE = {
  asset_purchase: { text: '资产购置', color: 'blue' },
  parts: { text: '资产配件', color: 'orange' },
  maintenance_service: { text: '维修服务', color: 'green' },
};

// ============================================================
// 招标方式
// ============================================================
export const TENDER_METHOD = {
  public: { text: '公开招标', color: 'blue' },
  invite: { text: '邀请招标', color: 'gold' },
  competitive: { text: '竞争性谈判', color: 'purple' },
};

// ============================================================
// 投标状态
// ============================================================
export const BID_STATUS = {
  draft: { text: '草稿', color: 'default' },
  submitted: { text: '已提交', color: 'processing' },
  withdrawn: { text: '已撤销', color: 'default' },
  won: { text: '中标', color: 'success' },
  lost: { text: '未中标', color: 'red' },
};

// ============================================================
// 供应商状态
// ============================================================
export const SUPPLIER_STATUS = {
  pending: { text: '待审核', color: 'default' },
  qualified: { text: '合格', color: 'success' },
  rejected: { text: '不合格', color: 'red' },
  blacklisted: { text: '黑名单', color: 'volcano' },
};

// 供应商类别（多选）
export const SUPPLIER_CATEGORIES = {
  repair: { text: '维修维护服务', color: 'blue' },
  parts: { text: '配件供应', color: 'cyan' },
  asset: { text: '资产供应', color: 'geekblue' },
  consumable: { text: '耗材供应', color: 'purple' },
};

// 供应商资质审核状态
export const REVIEW_STATUS = {
  pending: { text: '待审核', color: 'default' },
  approved: { text: '已通过', color: 'success' },
  rejected: { text: '已驳回', color: 'red' },
};

// 招标邀请状态
export const INVITATION_STATUS = {
  pending: { text: '待查看', color: 'default' },
  viewed: { text: '已查看', color: 'processing' },
  submitted: { text: '已投标', color: 'success' },
  expired: { text: '已过期', color: 'red' },
};

// 供应商资质类型
export const QUALIFICATION_TYPE_LABELS = {
  business_license: '营业执照',
  tax_cert: '税务登记证',
  qualification: '行业资质证书',
  authorization: '授权代理证书',
  financial: '财务报表',
  other: '其他材料',
};

// 评标推荐标记
export const RECOMMEND_LABELS = {
  0: { text: '未推荐', color: 'default' },
  1: { text: '推荐中标', color: 'success' },
};

// ============================================================
// 合同状态：起草 → 审批 → 签订 → 执行 → 归档
// ============================================================
export const CONTRACT_STATUS = {
  draft: { text: '起草中', color: 'default' },
  pending_review: { text: '待审批', color: 'processing' },
  approved: { text: '审批通过', color: 'gold' },
  rejected: { text: '审批驳回', color: 'red' },
  signed: { text: '已签订', color: 'success' },
  executing: { text: '执行中', color: 'blue' },
  archived: { text: '已归档', color: 'green' },
  terminated: { text: '已终止', color: 'volcano' },
};

// 合同类型
export const CONTRACT_TYPE = {
  purchase: { text: '采购合同', color: 'blue' },
  lease: { text: '租赁合同', color: 'purple' },
  service: { text: '服务合同', color: 'green' },
};

// 合同状态流转矩阵（用于前端按钮显隐控制）
// draft → pending_review（提交审批）
// pending_review → approved / rejected
// rejected → draft / pending_review
// approved → signed
// signed → executing
// executing → archived / terminated
export const CONTRACT_STATUS_TRANSITIONS = {
  draft: ['pending_review'],
  pending_review: ['approved', 'rejected'],
  rejected: ['draft', 'pending_review'],
  approved: ['signed'],
  signed: ['executing'],
  executing: ['archived', 'terminated'],
  archived: [],
  terminated: [],
};

// ============================================================
// 验收状态（与数据库 ENUM 对齐：pending/accepted/rejected/closed）
// ============================================================
export const ACCEPTANCE_STATUS = {
  pending: { text: '待验收', color: 'default' },
  accepted: { text: '已通过', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
  closed: { text: '已关闭', color: 'magenta' },
};

// 验收状态流转
export const ACCEPTANCE_STATUS_TRANSITIONS = {
  pending: ['accepted', 'rejected'],
  accepted: ['closed'],
  rejected: ['pending'],
  closed: [],
};

// ============================================================
// 发票状态（与数据库 ENUM 对齐：draft/pending/verified/claimed/paid/archived/cancelled/errored）
// ============================================================
export const INVOICE_STATUS = {
  draft: { text: '待提交', color: 'default' },
  pending: { text: '待核验', color: 'processing' },
  verified: { text: '已核验', color: 'cyan' },
  claimed: { text: '已认领', color: 'gold' },
  paid: { text: '已付款', color: 'success' },
  archived: { text: '已归档', color: 'green' },
  cancelled: { text: '已取消', color: 'default' },
  errored: { text: '异常', color: 'error' },
};

// 发票状态流转
export const INVOICE_STATUS_TRANSITIONS = {
  draft: ['pending', 'cancelled'],
  pending: ['verified', 'errored', 'cancelled'],
  verified: ['claimed', 'cancelled'],
  claimed: ['paid', 'cancelled'],
  paid: ['archived'],
  archived: [],
  cancelled: [],
  errored: ['pending', 'cancelled'],
};

// ============================================================
// 付款状态（与数据库 ENUM 对齐：draft/submitted/paying/paid/failed/cancelled）
// ============================================================
export const PAYMENT_STATUS = {
  draft: { text: '草稿', color: 'default' },
  submitted: { text: '已提交', color: 'processing' },
  paying: { text: '付款中', color: 'gold' },
  paid: { text: '已付款', color: 'success' },
  failed: { text: '付款失败', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
};

// 付款状态流转
export const PAYMENT_STATUS_TRANSITIONS = {
  draft: ['submitted', 'cancelled'],
  submitted: ['paying', 'cancelled'],
  paying: ['paid', 'failed'],
  paid: [],
  failed: ['submitted', 'cancelled'],
  cancelled: [],
};

// 付款方式
export const PAYMENT_METHOD = {
  bank_transfer: { text: '银行转账' },
  check: { text: '支票' },
  cash: { text: '现金' },
  other: { text: '其他' },
};

// 发票类型
export const INVOICE_KIND = {
  vat_special: { text: '增值税专票', color: 'blue' },
  vat_general: { text: '增值税普票', color: 'cyan' },
  receipt: { text: '收据', color: 'default' },
  e_invoice: { text: '电子发票', color: 'geekblue' },
  other: { text: '其他', color: 'default' },
};

// ============================================================
// 通用工具函数
// ============================================================

/**
 * 从状态映射中获取状态信息，找不到时返回 fallback
 * @param {string} status - 状态 key
 * @param {object} statusMap - 状态映射表
 * @param {object} fallback - 兜底值
 */
export const getStatusInfo = (status, statusMap, fallback = { text: '-', color: 'default' }) => {
  return statusMap?.[status] || fallback;
};

/**
 * 格式化金额（人民币）
 * @param {number|string} value
 * @param {boolean} withSymbol - 是否带 ¥ 符号
 * @param {number} digits - 小数位数
 */
export const formatMoney = (value, withSymbol = true, digits = 2) => {
  if (value == null) return '-';
  const n = Number(value);
  if (Number.isNaN(n)) return '-';
  const formatted = n.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return withSymbol ? `¥${formatted}` : formatted;
};

/**
 * 格式化日期时间，截掉秒
 */
export const formatDateTime = value => {
  if (!value) return '-';
  return String(value).replace('T', ' ').slice(0, 16);
};

// 兼容旧名称（部分组件使用 TENDER_TYPE_LABELS / STATUS_LABELS / SUPPLIER_STATUS）
export const TENDER_TYPE_LABELS = TENDER_TYPE;
export const STATUS_LABELS = TENDER_STATUS;
export const SUPPLIER_STATUS_LABELS = SUPPLIER_STATUS;
