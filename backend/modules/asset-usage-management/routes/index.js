const express = require('express');
const router = express.Router();
const assetUsageController = require('../controllers/asset-usage.controller');
const { authenticate } = require('../../../middleware/auth');

// ==================== 使用记录管理 ====================

// 获取使用记录列表
router.get('/records', authenticate, assetUsageController.getUsageRecords);

// 获取使用记录详情
router.get('/records/:id', authenticate, assetUsageController.getUsageRecordById);

// 借出资产
router.post('/checkout', authenticate, assetUsageController.checkoutAsset);

// 归还资产
router.post('/return/:id', authenticate, assetUsageController.returnAsset);

// 获取资产使用状态
router.get('/asset/:assetCode/status', authenticate, assetUsageController.getAssetUsageStatus);

// 获取使用统计
router.get('/statistics', authenticate, assetUsageController.getUsageStatistics);

// 获取用户的使用记录
router.get('/user/:userId/records', authenticate, assetUsageController.getUserUsageRecords);

// ==================== 健康检查 ====================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Asset Usage Management Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Asset Usage Management API',
    endpoints: {
      health: '/api/asset-usage/health',
      records: '/api/asset-usage/records',
      checkout: '/api/asset-usage/checkout',
      return: '/api/asset-usage/return',
      statistics: '/api/asset-usage/statistics',
    },
  });
});

module.exports = router;
