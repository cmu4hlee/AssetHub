const express = require('express');
const router = express.Router();
const controller = require('../controllers/acceptance.controller');
const { protectModuleRouter } = require('../../../core/module-router');
const { runInModuleContext } = require('../../../core/module-context');
const { validateBody, validateQuery, validateParams } = require('../../../middleware/zod-validator');
const {
  CreateApplicationSchema,
  UpdateApplicationSchema,
  ListQuerySchema,
  IdParamSchema,
} = require('../../../schemas/acceptance.schemas');

// ==================== 公开端点（无需认证）====================
// 健康检查：必须在认证中间件之前注册，用于 K8s/监控探测
router.get('/health', (req, res, next) => {
  runInModuleContext('acceptance-management', () => controller.getModuleHealth(req, res));
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Acceptance Management API',
    endpoints: {
      health: '/api/acceptance-management/health',
      applications: '/api/acceptance-management/applications',
      templates: '/api/acceptance-management/templates',
      statistics: '/api/acceptance-management/statistics/overview',
      reports: '/api/acceptance-management/reports/:id',
      reminders: '/api/acceptance-management/reminders',
    },
  });
});

// ==================== 供应商协同填写（公开，无需认证，必须在 protectModuleRouter 之前注册）====================
router.post('/supplier-fill/:token', runInModuleContext('acceptance-management', () => controller.supplierFill));

// ==================== 受保护端点（需认证 + 租户隔离 + 模块上下文）====================
protectModuleRouter(router, 'acceptance-management', {
  requireAuth: true,
  requireTenant: true,
  requireModule: false, // 暂不强制模块权限检查，避免影响现有用户
  isolation: true,
  dataGuard: false,
});

// 验收申请工作流
router.get('/applications', validateQuery(ListQuerySchema), controller.getApplications);
router.get('/applications/:id', validateParams(IdParamSchema), controller.getApplication);
router.post('/applications', validateBody(CreateApplicationSchema), controller.createApplication);
router.put('/applications/:id', validateParams(IdParamSchema), validateBody(UpdateApplicationSchema), controller.updateApplication);
router.delete('/applications/:id', validateParams(IdParamSchema), controller.deleteApplication);
router.post('/applications/:id/submit', validateParams(IdParamSchema), controller.submitApplication);
router.post('/applications/:id/approve', validateParams(IdParamSchema), controller.approveApplication);
router.post('/applications/:id/reject', validateParams(IdParamSchema), controller.rejectApplication);
router.post('/applications/:id/withdraw', validateParams(IdParamSchema), controller.withdrawApplication);
router.post('/applications/:id/complete', validateParams(IdParamSchema), controller.completeApplication);

// 申请-资产多对多关联
router.get('/applications/:id/assets', controller.listApplicationAssets);
router.post('/applications/:id/assets', controller.addApplicationAssets);
router.delete('/applications/:id/assets/:assetId', controller.removeApplicationAsset);
router.delete('/applications/:id/assets', controller.clearApplicationAssets);

// 验收模板管理
router.get('/templates', controller.getTemplates);
router.get('/templates/categories', controller.getTemplateCategories);
router.post('/templates', controller.createTemplate);
router.put('/templates/:id', controller.updateTemplate);
router.delete('/templates/:id', controller.deleteTemplate);

// 统计扩展
router.get('/statistics/overview', controller.getStatisticsOverview);
router.get('/statistics/trend', controller.getStatisticsTrend);

// 验收报告
router.get('/reports/:id', controller.getReport);
router.get('/reports/:id/pdf', controller.getReportPdf);
router.post('/reports/:id/generate', controller.generateReport);

// 提醒管理
router.get('/reminders', controller.getReminders);
router.get('/reminders/stats', controller.getReminderStats);
router.post('/reminders', controller.createReminder);
router.put('/reminders/:id/status', controller.updateReminderStatus);
router.delete('/reminders/:id', controller.deleteReminder);

// 验收小组管理
router.get('/teams/:recordId', controller.getTeamMembers);
router.post('/teams/:recordId', controller.addTeamMember);
router.put('/teams/:recordId/:memberId', controller.updateTeamMember);
router.delete('/teams/:recordId/:memberId', controller.deleteTeamMember);

// 供应商协同：邀请供应商填写（生成令牌 + 公开链接）
router.post('/records/:id/invite-supplier', controller.inviteSupplier);

module.exports = router;
