const express = require('express');
const router = express.Router();
const depreciationRouter = require('./depreciation');

// 挂载折旧管理路由
router.use('/', depreciationRouter);

// 健康检查路由
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Depreciation Management Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Depreciation Management API',
    endpoints: {
      health: '/api/depreciation/health',
      list: '/api/depreciation',
      detail: '/api/depreciation/:id',
      'summary/by-department': '/api/depreciation/summary/by-department',
      'summary/by-type': '/api/depreciation/summary/by-type',
      'summary/by-month': '/api/depreciation/summary/by-month',
      calculate: '/api/depreciation/calculate',
      export: '/api/depreciation/export',
      methods: '/api/depreciation/methods',
    },
  });
});

module.exports = router;
