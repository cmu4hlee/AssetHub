const express = require('express');
const router = express.Router();
const inventoryRouter = require('./inventory');

// 挂载盘点管理路由
router.use('/', inventoryRouter);

// 健康检查路由
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Inventory Management Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Inventory Management API',
    endpoints: {
      health: '/api/inventory/health',
      list: 'GET /api/inventory',
      create: 'POST /api/inventory',
      update: 'PUT /api/inventory/:id',
      delete: 'DELETE /api/inventory/:id',
      details: {
        add: 'POST /api/inventory/:id/details',
        batchAdd: 'POST /api/inventory/:id/details/batch',
        update: 'PUT /api/inventory/:id/details/:detailId',
        delete: 'DELETE /api/inventory/:id/details/:detailId',
      },
      status: {
        update: 'PUT /api/inventory/:id/status',
        start: 'POST /api/inventory/:id/start',
        complete: 'POST /api/inventory/:id/complete',
      },
      scan: {
        asset: 'POST /api/inventory/:id/scan',
        logs: 'GET /api/inventory/:id/scan-logs',
      },
      inventoryStatistics: 'GET /api/inventory/:id/statistics',
      selfCheck: {
        windows: 'GET /api/inventory/self/windows',
        assets: 'GET /api/inventory/self/assets',
        confirm: 'POST /api/inventory/self/confirm',
      },
    },
  });
});

module.exports = router;
