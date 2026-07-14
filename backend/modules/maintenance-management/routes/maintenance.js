const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenance.controller');
const { protectModuleRouter } = require('../../../core/module-router');

// 应用模块保护中间件链
const moduleMiddlewares = protectModuleRouter(router, 'maintenance-management', {
  requireAuth: true,
  requireTenant: true,
  requireModule: true,
  isolation: true,
  dataGuard: true,
});

// ==================== 维护日志路由 ====================

// 获取维护日志列表
router.get('/logs', maintenanceController.getLogs);

// 获取维护日志详情（必须在 /logs/:id/attachments 之前）
router.get('/logs/:id', maintenanceController.getLogById);

// 获取维护统计
router.get('/statistics', maintenanceController.getStatistics);

// 创建维护日志
router.post('/logs', maintenanceController.createLog);

// 更新维护日志
router.put('/logs/:id', maintenanceController.updateLog);

// 删除维护日志
router.delete('/logs/:id', maintenanceController.deleteLog);

// 获取维护日志附件列表
router.get('/logs/:id/attachments', maintenanceController.getAttachments);

// 上传维护日志附件
router.post('/logs/:id/attachments', maintenanceController.uploadAttachment);

// ==================== 维修申请路由 ====================

// 获取维修申请列表
router.get('/requests', maintenanceController.getRequests);

// 获取维修申请详情
router.get('/requests/:id', maintenanceController.getRequestById);

// 创建维修申请
router.post('/requests', maintenanceController.createRequest);

// 更新维修申请
router.put('/requests/:id', maintenanceController.updateRequest);

// 审批维修申请
router.post('/requests/:id/approve', maintenanceController.approveRequest);

// 开始维修
router.post('/requests/:id/start', maintenanceController.startRequest);

// 完成维修
router.post('/requests/:id/complete', maintenanceController.completeRequest);

// 取消维修申请
router.post('/requests/:id/cancel', maintenanceController.cancelRequest);

// 删除维修申请
router.delete('/requests/:id', maintenanceController.deleteRequest);

// ==================== 维修工单路由 ====================

// 获取工单列表
router.get('/workorders', maintenanceController.getWorkOrders);

// 获取工单详情
router.get('/workorders/:id', maintenanceController.getWorkOrderById);

// 创建工单
router.post('/workorders', maintenanceController.createWorkOrder);

// 更新工单
router.put('/workorders/:id', maintenanceController.updateWorkOrder);

// 评价工单（申请人）
router.post('/workorders/:id/evaluate', maintenanceController.evaluateWorkOrder);

// 删除工单
router.delete('/workorders/:id', maintenanceController.deleteWorkOrder);

// ==================== 维修计划路由 ====================

// 获取维修计划列表
router.get('/plans', maintenanceController.getPlans);

// 获取维修计划详情
router.get('/plans/:id', maintenanceController.getPlanById);

// 创建维修计划
router.post('/plans', maintenanceController.createPlan);

// 更新维修计划
router.put('/plans/:id', maintenanceController.updatePlan);

// 删除维修计划
router.delete('/plans/:id', maintenanceController.deletePlan);

// ==================== 维修费用路由 ====================

// 获取维修费用列表
router.get('/costs', maintenanceController.getCosts);

// 获取费用趋势
router.get('/costs/trend', maintenanceController.getCostTrend);

// 获取部门费用统计
router.get('/costs/department', maintenanceController.getCostDepartment);

// 创建维修费用
router.post('/costs', maintenanceController.createCost);

// 更新维修费用
router.put('/costs/:id', maintenanceController.updateCost);

// 删除维修费用
router.delete('/costs/:id', maintenanceController.deleteCost);

// ==================== 维修模板路由 ====================

// 获取维修模板列表
router.get('/templates', maintenanceController.getTemplates);

// 获取维修模板详情
router.get('/templates/:id', maintenanceController.getTemplateById);

// 创建维修模板
router.post('/templates', maintenanceController.createTemplate);

// 更新维修模板
router.put('/templates/:id', maintenanceController.updateTemplate);

// 删除维修模板
router.delete('/templates/:id', maintenanceController.deleteTemplate);

// ==================== 维修提醒路由 ====================

// 获取维修提醒列表
router.get('/reminders', maintenanceController.getReminders);

// ==================== 维修分析路由 ====================

// 获取维修分析数据
router.get('/analytics', maintenanceController.getAnalytics);

// ==================== 使用统计路由 ====================

// 获取使用统计数据
router.get('/usage', maintenanceController.getUsage);

// ==================== 效率评估路由 ====================

// 获取效率评估数据
router.get('/evaluations', maintenanceController.getEvaluations);

// ==================== 健康检查路由 ====================

router.get('/health', maintenanceController.getModuleHealth);

// ==================== 根路由 ====================

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Maintenance Management API',
    endpoints: {
      health: '/api/maintenance/health',
      logs: '/api/maintenance/logs',
      requests: '/api/maintenance/requests',
      workorders: '/api/maintenance/workorders',
      plans: '/api/maintenance/plans',
      costs: '/api/maintenance/costs',
      templates: '/api/maintenance/templates',
      reminders: '/api/maintenance/reminders',
      analytics: '/api/maintenance/analytics',
      usage: '/api/maintenance/usage',
      evaluations: '/api/maintenance/evaluations',
      statistics: '/api/maintenance/statistics',
    },
  });
});

module.exports = router;
