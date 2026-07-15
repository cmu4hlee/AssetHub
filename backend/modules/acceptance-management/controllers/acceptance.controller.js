/**
 * 验收管理 - 控制器（薄层）
 *
 * 重构说明：业务逻辑已抽离到以下 service，本文件仅负责 HTTP 包装：
 *   - services/acceptance-application.service.js   申请工作流（CRUD + 状态流转 + 软删）
 *   - services/acceptance-template.service.js      模板 CRUD
 *   - services/acceptance-statistics.service.js    概览/趋势/报告
 *   - services/acceptance.service.js               团队 / 提醒（既有）
 *   - services/acceptance-record.service.js         验收记录 CRUD（走 legacy 路由）
 *
 * 本文件只做 4 件事：
 *   1. 解析 query / params / req.user
 *   2. 解析 tenantFilter
 *   3. 调用 service
 *   4. 把 service 抛出的业务异常转成 HTTP 响应
 */
const { getTenantId } = require('../../../middleware/tenant-filter');
const { checkModuleHealth } = require('../../../core/module-health');
const {
  logger,
  resolveTenantFilter,
  checkDepartmentPermission,
} = require('../utils/helpers');

const applicationService = require('../services/acceptance-application.service');
const templateService = require('../services/acceptance-template.service');
const statisticsService = require('../services/acceptance-statistics.service');
const acceptanceService = require('../services/acceptance.service');

/**
 * 通用错误响应：按 HTTP 语义返回
 *   - statusCode 自定义优先
 *   - 否则根据错误消息文本判断（业务错误 400、404、403，其他 500）
 */
function handleError(res, error, defaultMessage) {
  logger.error(`${defaultMessage}:`, error);
  const message = error?.message || defaultMessage;
  const statusCode = error?.statusCode || (/不存在|无效|不能|已存在|仅|必须|过期|权限|不允许/.test(message) ? 400 : 500);
  res.status(statusCode).json({ success: false, message });
}

/**
 * 通用成功响应
 */
function ok(res, data, message) {
  const body = { success: true };
  if (data !== undefined) body.data = data;
  if (message) body.message = message;
  res.json(body);
}

/**
 * 解析 tenantFilter（无 tenant 返回 false，已直接响应）
 */
function getTenantFilter(req, res) {
  return resolveTenantFilter(req, res);
}

// ============================================
// 验收申请工作流
// ============================================

const getApplications = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    const result = await applicationService.listApplications({
      tenantFilter,
      page: req.query.page,
      pageSize: req.query.pageSize,
      status: req.query.status,
      priority: req.query.priority,
      keyword: req.query.keyword,
      department: req.query.department,
    });
    ok(res, { data: result.records, pagination: result.pagination });
  } catch (error) {
    handleError(res, error, '获取验收申请列表失败');
  }
};

const getApplication = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    const data = await applicationService.getApplicationWithApprovals({
      id: parseInt(req.params.id, 10),
      tenantFilter,
    });
    if (!data) return res.status(404).json({ success: false, message: '验收申请不存在' });
    ok(res, data);
  } catch (error) {
    handleError(res, error, '获取验收申请详情失败');
  }
};

const createApplication = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
    const { department, functional_department } = req.body;
    const permission = await checkDepartmentPermission(req, department, functional_department);
    const data = await applicationService.createApplication({
      tenantId, body: req.body, user: req.user, permission,
    });
    ok(res, data, '验收申请创建成功');
  } catch (error) {
    handleError(res, error, '创建验收申请失败');
  }
};

const updateApplication = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    await applicationService.updateApplication({
      id: parseInt(req.params.id, 10),
      tenantFilter,
      body: req.body,
      user: req.user,
    });
    ok(res, null, '验收申请更新成功');
  } catch (error) {
    handleError(res, error, '更新验收申请失败');
  }
};

const submitApplication = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    await applicationService.transitionStatus({
      id: parseInt(req.params.id, 10),
      tenantFilter,
      action: 'submit',
      toStatus: '待审批',
      defaultComment: '提交申请',
      requireApprover: false,
      body: req.body,
      user: req.user,
    });
    ok(res, null, '提交申请成功');
  } catch (error) {
    handleError(res, error, '提交验收申请失败');
  }
};

const approveApplication = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    await applicationService.transitionStatus({
      id: parseInt(req.params.id, 10),
      tenantFilter,
      action: 'approve',
      toStatus: '已批准',
      defaultComment: '审批通过',
      requireApprover: true,
      body: req.body,
      user: req.user,
    });
    ok(res, null, '审批通过成功');
  } catch (error) {
    handleError(res, error, '审批通过失败');
  }
};

const rejectApplication = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    await applicationService.transitionStatus({
      id: parseInt(req.params.id, 10),
      tenantFilter,
      action: 'reject',
      toStatus: '已拒绝',
      defaultComment: '审批拒绝',
      requireApprover: true,
      body: req.body,
      user: req.user,
    });
    ok(res, null, '审批拒绝成功');
  } catch (error) {
    handleError(res, error, '审批拒绝失败');
  }
};

const withdrawApplication = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    await applicationService.transitionStatus({
      id: parseInt(req.params.id, 10),
      tenantFilter,
      action: 'withdraw',
      toStatus: '已撤回',
      defaultComment: '撤回申请',
      requireApprover: false,
      body: req.body,
      user: req.user,
    });
    ok(res, null, '撤回申请成功');
  } catch (error) {
    handleError(res, error, '撤回验收申请失败');
  }
};

const completeApplication = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    await applicationService.completeApplication({
      id: parseInt(req.params.id, 10),
      tenantFilter,
      body: req.body,
      user: req.user,
    });
    ok(res, null, '验收申请已完成');
  } catch (error) {
    handleError(res, error, '完成验收申请失败');
  }
};

const deleteApplication = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    await applicationService.softDeleteApplication({
      id: parseInt(req.params.id, 10),
      tenantFilter,
      user: req.user,
    });
    ok(res, null, '验收申请已删除');
  } catch (error) {
    handleError(res, error, '删除验收申请失败');
  }
};

// ============================================
// 验收模板管理（CRUD）
// ============================================

const getTemplates = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
    const data = await templateService.listTemplates({
      tenantId,
      grouped: req.query.grouped !== 'false',
      category: req.query.category,
    });
    ok(res, data.records);
  } catch (error) {
    handleError(res, error, '获取验收模板失败');
  }
};

const getTemplateCategories = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
    const data = await templateService.listCategories({ tenantId });
    ok(res, data);
  } catch (error) {
    handleError(res, error, '获取模板分类失败');
  }
};

const createTemplate = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
    const data = await templateService.createTemplate({ tenantId, body: req.body });
    ok(res, data, '模板创建成功');
  } catch (error) {
    handleError(res, error, '创建验收模板失败');
  }
};

const updateTemplate = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
    await templateService.updateTemplate({
      id: parseInt(req.params.id, 10),
      tenantId,
      body: req.body,
    });
    ok(res, null, '模板更新成功');
  } catch (error) {
    handleError(res, error, '更新验收模板失败');
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
    await templateService.softDeleteTemplate({
      id: parseInt(req.params.id, 10),
      tenantId,
      user: req.user,
    });
    ok(res, null, '模板删除成功');
  } catch (error) {
    handleError(res, error, '删除验收模板失败');
  }
};

// ============================================
// 统计扩展
// ============================================

const getStatisticsOverview = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    const data = await statisticsService.getStatisticsOverview({
      tenantFilter,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    ok(res, data);
  } catch (error) {
    handleError(res, error, '获取验收统计概览失败');
  }
};

const getStatisticsTrend = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    const data = await statisticsService.getStatisticsTrend({
      tenantFilter,
      months: req.query.months,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    ok(res, data);
  } catch (error) {
    handleError(res, error, '获取验收趋势失败');
  }
};

// ============================================
// 验收报告
// ============================================

const getReport = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    const data = await statisticsService.getReport({
      id: parseInt(req.params.id, 10),
      tenantFilter,
    });
    if (!data) return res.status(404).json({ success: false, message: '验收记录不存在' });
    ok(res, data);
  } catch (error) {
    handleError(res, error, '获取验收报告失败');
  }
};

const generateReport = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    const data = await statisticsService.generateReport({
      id: parseInt(req.params.id, 10),
      tenantFilter,
      user: req.user,
    });
    ok(res, data, '验收报告生成成功');
  } catch (error) {
    handleError(res, error, '生成验收报告失败');
  }
};

// ============================================
// 提醒管理
// ============================================

const getReminders = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    const data = await acceptanceService.listReminders({
      tenantFilter,
      page: req.query.page,
      pageSize: req.query.pageSize,
      status: req.query.status,
      reminder_type: req.query.reminder_type,
    });
    ok(res, { data: data.records, pagination: data.pagination });
  } catch (error) {
    handleError(res, error, '获取验收提醒失败');
  }
};

const getReminderStats = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    const stats = await acceptanceService.getReminderStats(tenantFilter);
    ok(res, stats);
  } catch (error) {
    handleError(res, error, '获取验收提醒统计失败');
  }
};

const createReminder = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
    const data = await acceptanceService.createReminder(tenantId, req.body);
    ok(res, data, '提醒创建成功');
  } catch (error) {
    handleError(res, error, '创建验收提醒失败');
  }
};

const updateReminderStatus = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    const { status } = req.body;
    const data = await acceptanceService.updateReminderStatus(
      parseInt(req.params.id, 10),
      tenantFilter,
      status,
    );
    ok(res, data, '提醒状态已更新');
  } catch (error) {
    handleError(res, error, '更新提醒状态失败');
  }
};

const deleteReminder = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    const ok2 = await acceptanceService.deleteReminder(
      parseInt(req.params.id, 10),
      tenantFilter,
      req.user?.username,
    );
    if (!ok2) return res.status(404).json({ success: false, message: '提醒不存在或无权限' });
    ok(res, null, '提醒删除成功');
  } catch (error) {
    handleError(res, error, '删除提醒失败');
  }
};

// ============================================
// 验收小组管理
// ============================================

const getTeamMembers = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    const record = await acceptanceService.findAcceptanceRecord(
      parseInt(req.params.recordId, 10),
      tenantFilter,
    );
    if (!record) return res.status(404).json({ success: false, message: '验收记录不存在' });
    const members = await acceptanceService.listTeamMembers(
      parseInt(req.params.recordId, 10),
      tenantFilter,
    );
    ok(res, members);
  } catch (error) {
    handleError(res, error, '获取验收小组成员失败');
  }
};

const addTeamMember = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    const record = await acceptanceService.findAcceptanceRecord(
      parseInt(req.params.recordId, 10),
      tenantFilter,
    );
    if (!record) return res.status(404).json({ success: false, message: '验收记录不存在' });
    const result = await acceptanceService.addTeamMember(
      tenantId,
      parseInt(req.params.recordId, 10),
      req.body,
    );
    ok(res, result, '成员添加成功');
  } catch (error) {
    handleError(res, error, '添加验收小组成员失败');
  }
};

const updateTeamMember = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    const ok2 = await acceptanceService.updateTeamMember(
      parseInt(req.params.memberId, 10),
      parseInt(req.params.recordId, 10),
      tenantFilter,
      req.body,
    );
    if (!ok2) return res.status(404).json({ success: false, message: '成员不存在或无权限' });
    ok(res, null, '成员更新成功');
  } catch (error) {
    handleError(res, error, '更新验收小组成员失败');
  }
};

const deleteTeamMember = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req, res);
    if (!tenantFilter) return;
    const ok2 = await acceptanceService.deleteTeamMember(
      parseInt(req.params.memberId, 10),
      parseInt(req.params.recordId, 10),
      tenantFilter,
      req.user?.username,
    );
    if (!ok2) return res.status(404).json({ success: false, message: '成员不存在或无权限' });
    ok(res, null, '成员删除成功');
  } catch (error) {
    handleError(res, error, '删除验收小组成员失败');
  }
};

// ============================================
// 模块健康检查
// ============================================

const getModuleHealth = async (req, res) => {
  const result = await checkModuleHealth({
    tables: [
      'asset_acceptance_records',
      'asset_acceptance_templates',
      'acceptance_applications',
      'acceptance_approvals',
      'acceptance_teams',
      'acceptance_reminders',
      'asset_acceptance_checklist',
      'asset_acceptance_files',
    ],
  });
  res.json(result);
};

// ============================================
// 导出
// ============================================

module.exports = {
  // 申请工作流
  getApplications,
  getApplication,
  createApplication,
  updateApplication,
  submitApplication,
  approveApplication,
  rejectApplication,
  withdrawApplication,
  completeApplication,
  deleteApplication,
  // 模板
  getTemplates,
  getTemplateCategories,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  // 统计
  getStatisticsOverview,
  getStatisticsTrend,
  // 报告
  getReport,
  generateReport,
  // 提醒
  getReminders,
  getReminderStats,
  createReminder,
  updateReminderStatus,
  deleteReminder,
  // 小组
  getTeamMembers,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
  // 健康检查
  getModuleHealth,
};
