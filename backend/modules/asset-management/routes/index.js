const express = require('express');
const router = express.Router();
const assetsRouter = require('./assets');

// 挂载资产路由
router.use('/assets', assetsRouter);

// 健康检查路由
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Asset Management Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Asset Management API',
    endpoints: {
      health: '/api/asset-management/health',
      assets: '/api/asset-management/assets',
      categories: '/api/asset-management/assets/categories',
      locations: '/api/asset-management/assets/locations',
    },
  });
});

module.exports = router;
