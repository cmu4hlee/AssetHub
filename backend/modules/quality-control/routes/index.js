const express = require('express');
const router = express.Router();
const qualityControlRouter = require('./quality-control');

// 挂载质量控制路由
router.use('/', qualityControlRouter);

// 健康检查路由
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Quality Control Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Quality Control API',
    endpoints: {
      health: '/api/quality-control/health',
      records: '/api/quality-control',
      statistics: '/api/quality-control/statistics',
      expiring: '/api/quality-control/expiring',
    },
  });
});

module.exports = router;
