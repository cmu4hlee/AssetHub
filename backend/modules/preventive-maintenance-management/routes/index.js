const express = require('express');
const router = express.Router();
const preventiveMaintenanceController = require('../controllers/preventive-maintenance.controller');
const { authenticate } = require('../../../middleware/auth');

// ==================== 维护计划管理 ====================

// 获取维护计划列表
router.get('/plans', authenticate, preventiveMaintenanceController.getMaintenancePlans);

// 获取维护计划详情
router.get('/plans/:id', authenticate, preventiveMaintenanceController.getMaintenancePlan);

// 创建维护计划
router.post('/plans', authenticate, preventiveMaintenanceController.createMaintenancePlan);

// 更新维护计划
router.put('/plans/:id', authenticate, preventiveMaintenanceController.updateMaintenancePlan);

// 完成维护计划
router.post('/plans/:id/complete', authenticate, preventiveMaintenanceController.completeMaintenancePlan);

// 获取维护计划历史
router.get('/plans/:id/history', authenticate, preventiveMaintenanceController.getMaintenancePlanHistory);

// 删除维护计划
router.delete('/plans/:id', authenticate, preventiveMaintenanceController.deleteMaintenancePlan);

// ==================== 维护模板管理 ====================

// 获取维护模板列表
router.get('/templates', authenticate, preventiveMaintenanceController.getMaintenanceTemplates);

// 创建维护模板
router.post('/templates', authenticate, preventiveMaintenanceController.createMaintenanceTemplate);

// 更新维护模板
router.put('/templates/:id', authenticate, preventiveMaintenanceController.updateMaintenanceTemplate);

// 删除维护模板
router.delete('/templates/:id', authenticate, preventiveMaintenanceController.deleteMaintenanceTemplate);

// ==================== 维护提醒管理 ====================

// 获取维护提醒列表
router.get('/reminders', authenticate, preventiveMaintenanceController.getMaintenanceReminders);

// 发送维护提醒
router.post('/reminders/send', authenticate, preventiveMaintenanceController.sendMaintenanceReminder);

// 配置维护提醒
router.post('/reminders/config', authenticate, preventiveMaintenanceController.configMaintenanceReminder);

// ==================== 维护效率分析 ====================

// 获取效率概览
router.get('/efficiency/overview', authenticate, preventiveMaintenanceController.getEfficiencyOverview);

// ==================== 健康检查 ====================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Preventive Maintenance Management Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Preventive Maintenance Management API',
    endpoints: {
      health: '/api/maintenance/health',
      plans: '/api/maintenance/plans',
      templates: '/api/maintenance/templates',
      reminders: '/api/maintenance/reminders',
      efficiency: '/api/maintenance/efficiency',
    },
  });
});

module.exports = router;
