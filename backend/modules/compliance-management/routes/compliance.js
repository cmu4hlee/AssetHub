/**
 * 合规性管理路由
 * 符合《医学装备整体运维管理服务规范》要求
 */

const express = require('express');
const router = express.Router();
const complianceController = require('../controllers/compliance.controller');
const { authenticate } = require('../../../middleware/auth');

// 路由中间件
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ============================================
// 模块基础路由
// ============================================

// 获取模块状态
router.get('/status', authenticate, asyncHandler(complianceController.getStatus));

// 获取仪表板统计数据
router.get('/dashboard-stats', authenticate, asyncHandler(complianceController.getDashboardStats));

// ============================================
// 分级保养管理
// ============================================

// 获取保养模板列表
router.get('/maintenance-templates', authenticate, asyncHandler(complianceController.getMaintenanceTemplates));

// 获取单个保养模板
router.get('/maintenance-templates/:id', authenticate, asyncHandler(complianceController.getMaintenanceTemplateById));

// 创建保养模板
router.post('/maintenance-templates', authenticate, asyncHandler(complianceController.createMaintenanceTemplate));

// 更新保养模板
router.put('/maintenance-templates/:id', authenticate, asyncHandler(complianceController.updateMaintenanceTemplate));

// 删除保养模板
router.delete('/maintenance-templates/:id', authenticate, asyncHandler(complianceController.deleteMaintenanceTemplate));

// 获取保养计划列表
router.get('/maintenance-plans', authenticate, asyncHandler(complianceController.getMaintenancePlans));

// 生成分级保养计划
router.post('/maintenance-plans/generate', authenticate, asyncHandler(complianceController.generateMaintenancePlans));

module.exports = router;
