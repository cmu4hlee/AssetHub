const express = require('express');
const router = express.Router();
const controller = require('../controllers/inspection.controller');
const { authenticate } = require('../../../middleware/auth');

// ============ 巡检模板 ============
router.get('/templates', authenticate, controller.getTemplates);
router.get('/templates/:id', authenticate, controller.getTemplateById);
router.post('/templates', authenticate, controller.createTemplate);
router.put('/templates/:id', authenticate, controller.updateTemplate);
router.delete('/templates/:id', authenticate, controller.deleteTemplate);

// ============ 巡检任务 ============
// 必须在 /:id 路由之前定义特殊路由
router.get('/tasks/expiring', authenticate, controller.getExpiringTasks);
router.get('/tasks', authenticate, controller.getTasks);
router.get('/tasks/:id', authenticate, controller.getTaskById);
router.post('/tasks', authenticate, controller.createTask);
router.put('/tasks/:id', authenticate, controller.updateTask);
router.delete('/tasks/:id', authenticate, controller.deleteTask);

// ============ 巡检记录单 ============
router.get('/records', authenticate, controller.getRecords);
router.get('/records/:id', authenticate, controller.getRecordById);
router.post('/records', authenticate, controller.createRecord);
router.put('/records/:id', authenticate, controller.updateRecord);
router.delete('/records/:id', authenticate, controller.deleteRecord);

// ============ 巡检问题 ============
router.get('/issues', authenticate, controller.getIssues);
router.get('/issues/:id', authenticate, controller.getIssueById);
router.put('/issues/:id', authenticate, controller.updateIssue);

// ============ 统计分析 ============
router.get('/statistics', authenticate, controller.getStatistics);

module.exports = router;
