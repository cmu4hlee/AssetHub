const express = require('express');
const router = express.Router();
const qualityAssuranceController = require('../controllers/quality-assurance.controller');
const { authenticate } = require('../../../middleware/auth');

// ==================== 质控记录管理 ====================

// 获取质控记录列表
router.get('/quality-control', authenticate, qualityAssuranceController.getQualityControlList);

// 获取质控记录详情
router.get('/quality-control/:id', authenticate, qualityAssuranceController.getQualityControlById);

// 创建质控记录
router.post('/quality-control', authenticate, qualityAssuranceController.createQualityControl);

// 更新质控记录
router.put('/quality-control/:id', authenticate, qualityAssuranceController.updateQualityControl);

// 删除质控记录
router.delete('/quality-control/:id', authenticate, qualityAssuranceController.deleteQualityControl);

// 获取即将到期的质控记录
router.get('/quality-control/expiring', authenticate, qualityAssuranceController.getExpiringQualityControl);

// 获取质控统计数据
router.get('/quality-control/statistics', authenticate, qualityAssuranceController.getQualityControlStatistics);

// ==================== 资产质控历史 ====================

// 获取资产的质控历史
router.get('/asset/:assetCode/history', authenticate, qualityAssuranceController.getAssetQualityHistory);

// ==================== 数据分析 ====================

// 分析质量趋势
router.get('/analysis/trend', authenticate, qualityAssuranceController.analyzeQualityTrend);

// 分析缺陷分布
router.get('/analysis/distribution', authenticate, qualityAssuranceController.analyzeDefectDistribution);

// 生成质量报告
router.get('/analysis/report', authenticate, qualityAssuranceController.generateQualityReport);

// ==================== 健康检查 ====================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Quality Assurance Management Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Quality Assurance Management API',
    endpoints: {
      health: '/api/quality-control/health',
      'quality-control': '/api/quality-control/quality-control',
      analysis: '/api/quality-control/analysis',
      statistics: '/api/quality-control/quality-control/statistics',
    },
  });
});

module.exports = router;
