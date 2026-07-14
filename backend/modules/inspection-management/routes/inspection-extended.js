/**
 * 巡检管理扩展路由
 * 注意：挂在 /inspection 之下（与 inspection.js 合并）
 */
const express = require('express');
const router = express.Router();
const ctl = require('../controllers/inspection-extended.controller');
const { authenticate } = require('../../../middleware/auth');

// ============ 模板复制 ============
router.post('/templates/:id/copy', authenticate, ctl.copyTemplate);

// ============ 任务批量 ============
router.post('/tasks/batch', authenticate, ctl.batchCreateTasks);
router.post('/tasks/:id/schedule-next', authenticate, ctl.scheduleNextTask);

// ============ 巡检计划 ============
router.get('/plans', authenticate, ctl.getPlans);
router.get('/plans/:id', authenticate, ctl.getPlanById);
router.post('/plans', authenticate, ctl.createPlan);
router.put('/plans/:id', authenticate, ctl.updatePlan);
router.delete('/plans/:id', authenticate, ctl.deletePlan);
router.post('/plans/:id/dispatch', authenticate, ctl.dispatchPlanNow);

// ============ 巡检路线 ============
router.get('/routes', authenticate, ctl.getRoutes);
router.get('/routes/:id', authenticate, ctl.getRouteById);
router.post('/routes', authenticate, ctl.createRoute);
router.put('/routes/:id', authenticate, ctl.updateRoute);
router.delete('/routes/:id', authenticate, ctl.deleteRoute);

// ============ 复核（专门接口）============
router.post('/records/:id/review', authenticate, ctl.reviewRecord);

// ============ 异常转工单 ============
router.post('/issues/:id/convert-work-order', authenticate, ctl.convertToWorkOrder);

// ============ 问题操作历史 ============
router.get('/issues/:id/history', authenticate, ctl.getIssueHistory);

// ============ 巡检日历 ============
router.get('/calendar', authenticate, ctl.getCalendar);

// ============ 记录单 PDF 导出 ============
router.get('/records/:id/pdf', authenticate, ctl.exportRecordPdf);

// ============ 通知 ============
router.get('/notifications', authenticate, ctl.getNotifications);
router.post('/notifications/:id/read', authenticate, ctl.markNotificationRead);

// ============ 增强统计 ============
router.get('/statistics/enriched', authenticate, ctl.getEnrichedStatistics);

module.exports = router;
