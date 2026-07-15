const express = require('express');
const router = express.Router();
const controller = require('../controllers/acceptance.controller');
const { protectModuleRouter } = require('../../../core/module-router');
const { runInModuleContext } = require('../../../core/module-context');

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

// ==================== 受保护端点（需认证 + 租户隔离 + 模块上下文）====================
protectModuleRouter(router, 'acceptance-management', {
  requireAuth: true,
  requireTenant: true,
  requireModule: false, // 暂不强制模块权限检查，避免影响现有用户
  isolation: true,
  dataGuard: false,
});

// 验收申请工作流
router.get('/applications', controller.getApplications);
router.get('/applications/:id', controller.getApplication);
router.post('/applications', controller.createApplication);
router.put('/applications/:id', controller.updateApplication);
router.delete('/applications/:id', controller.deleteApplication);
router.post('/applications/:id/submit', controller.submitApplication);
router.post('/applications/:id/approve', controller.approveApplication);
router.post('/applications/:id/reject', controller.rejectApplication);
router.post('/applications/:id/withdraw', controller.withdrawApplication);
router.post('/applications/:id/complete', controller.completeApplication);

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

module.exports = router;
