const express = require('express');
const router = express.Router();
const labelsRouter = require('./labels');

// 挂载标签管理路由
router.use('/', labelsRouter);

// 健康检查路由
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Label Management Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Label Management API',
    endpoints: {
      health: '/api/asset-labels/health',
      templates: '/api/asset-labels/templates',
      'generate-zpl': '/api/asset-labels/generate-zpl/:templateId/:assetCode',
      'generate-zpl-batch': '/api/asset-labels/generate-zpl-batch',
      print: '/api/asset-labels/print',
      'print-queue': '/api/asset-labels/print-queue',
    },
  });
});

module.exports = router;
