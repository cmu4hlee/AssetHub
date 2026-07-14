const express = require('express');
const router = express.Router();
const safetyInspectionController = require('../controllers/safety-inspection.controller');
const { authenticate } = require('../../../middleware/auth');

// ============ 检测记录 ============
// 必须在 /:id 路由之前定义特殊路由
router.get('/expiring', authenticate, safetyInspectionController.getExpiringInspections);
router.get('/statistics', authenticate, safetyInspectionController.getStatistics);
router.get('/issues', authenticate, safetyInspectionController.getIssues);
router.get('/issues/:id', authenticate, safetyInspectionController.getIssueById);
router.put('/issues/:id', authenticate, safetyInspectionController.updateIssue);
router.get('/', authenticate, safetyInspectionController.getInspections);
router.get('/:id', authenticate, safetyInspectionController.getInspectionById);
router.post('/', authenticate, safetyInspectionController.createInspection);
router.put('/:id', authenticate, safetyInspectionController.updateInspection);
router.post('/:id/review', authenticate, safetyInspectionController.reviewInspection);
router.delete('/:id', authenticate, safetyInspectionController.deleteInspection);

module.exports = router;
