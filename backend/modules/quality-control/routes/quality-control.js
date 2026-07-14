const express = require('express');
const router = express.Router();
const qualityControlController = require('../controllers/quality-control.controller');
const { authenticate, authorize } = require('../../../middleware/auth');

// 质量控制模块权限集合：
//   GET 路由：view_all | view_own_department | metrology.view | maintenance.view | asset.view_*
//   POST/PUT/DELETE 路由：edit_all | edit_own_department | metrology.edit
//   统计/资产历史：放宽到 view 类权限
const QC_GET_ROLES = ['quality_control.view_all', 'quality_control.view_own_department', 'metrology.view', 'maintenance.view', 'asset.view_all', 'asset.view_own_department'];
const QC_WRITE_ROLES = ['quality_control.edit_all', 'quality_control.edit_own_department', 'metrology.edit', 'asset.edit_all', 'asset.edit_own_department'];

// ==================== 质量控制记录列表 ====================

// 获取质量控制记录列表
router.get('/', authenticate, authorize(QC_GET_ROLES), qualityControlController.getQualityControlRecords);

// 兼容历史路径
router.get('/quality-control', authenticate, authorize(QC_GET_ROLES), qualityControlController.getQualityControlRecords);

// ==================== 统计相关（必须在 /:id 路由之前） ====================

// 获取质量控制统计
router.get('/statistics', authenticate, authorize(QC_GET_ROLES), qualityControlController.getQualityControlStatistics);

// 兼容历史路径
router.get('/quality-control/statistics', authenticate, authorize(QC_GET_ROLES), qualityControlController.getQualityControlStatistics);

// 获取高级质量控制统计
router.get('/statistics/advanced', authenticate, authorize(QC_GET_ROLES), qualityControlController.getAdvancedQualityControlStatistics);

// 兼容历史路径
router.get('/quality-control/statistics/advanced', authenticate, authorize(QC_GET_ROLES), qualityControlController.getAdvancedQualityControlStatistics);

// 获取即将到期质控记录
router.get('/expiring', authenticate, authorize(QC_GET_ROLES), qualityControlController.getExpiringQualityControlRecords);

// 兼容历史路径
router.get('/quality-control/expiring', authenticate, authorize(QC_GET_ROLES), qualityControlController.getExpiringQualityControlRecords);

// ==================== 单个记录操作 ====================

// 获取质量控制记录详情
router.get('/:id', authenticate, authorize(QC_GET_ROLES), qualityControlController.getQualityControlRecordById);

// 兼容历史路径
router.get('/quality-control/:id', authenticate, authorize(QC_GET_ROLES), qualityControlController.getQualityControlRecordById);

// 创建质量控制记录
router.post('/', authenticate, authorize(QC_WRITE_ROLES), qualityControlController.createQualityControlRecord);

// 兼容历史路径
router.post('/quality-control', authenticate, authorize(QC_WRITE_ROLES), qualityControlController.createQualityControlRecord);

// 更新质量控制记录
router.put('/:id', authenticate, authorize(QC_WRITE_ROLES), qualityControlController.updateQualityControlRecord);

// 兼容历史路径
router.put('/quality-control/:id', authenticate, authorize(QC_WRITE_ROLES), qualityControlController.updateQualityControlRecord);

// 删除质量控制记录
router.delete('/:id', authenticate, authorize(QC_WRITE_ROLES), qualityControlController.deleteQualityControlRecord);

// 兼容历史路径
router.delete('/quality-control/:id', authenticate, authorize(QC_WRITE_ROLES), qualityControlController.deleteQualityControlRecord);

// ==================== 资产关联功能 ====================

// 获取资产质量管理历史（必须在 /:id 路由之后）
router.get('/asset/:assetCode/history', authenticate, authorize(QC_GET_ROLES), qualityControlController.getAssetQualityHistory);

module.exports = router;
