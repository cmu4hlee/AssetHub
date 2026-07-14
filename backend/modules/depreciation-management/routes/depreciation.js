const express = require('express');
const router = express.Router();
const depreciationController = require('../controllers/depreciation.controller');
const { authenticate } = require('../../../middleware/auth');

// ==================== 折旧管理路由 ====================

// 获取折旧列表
router.get('/', authenticate, depreciationController.getDepreciationList);

// 获取折旧详情
router.get('/:id', authenticate, depreciationController.getDepreciationDetail);

// 按部门汇总
router.get('/summary/by-department', authenticate, depreciationController.getSummaryByDepartment);

// 按类型汇总
router.get('/summary/by-type', authenticate, depreciationController.getSummaryByType);

// 按月份趋势
router.get('/summary/by-month', authenticate, depreciationController.getSummaryByMonth);

// 计算折旧
router.post('/calculate', authenticate, depreciationController.calculateDepreciation);

// 导出折旧数据
router.get('/export', authenticate, depreciationController.exportDepreciation);

// 获取折旧方法列表
router.get('/methods', authenticate, depreciationController.getDepreciationMethods);

module.exports = router;
