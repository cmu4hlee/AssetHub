/**
 * 特种设备管理模块路由入口
 */

const express = require('express');
const router = express.Router();
const specialEquipmentRouter = require('./special-equipment');
const moduleConfig = require('../config/module.config');
const { authenticate } = require('../../../middleware/auth');

// 挂载特种设备管理路由
router.use('/', specialEquipmentRouter);

// 模块状态路由
router.get('/status', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      module_id: moduleConfig.id,
      name: moduleConfig.name,
      version: moduleConfig.version,
      features: Object.entries(moduleConfig.features).map(([key, feature]) => ({
        id: key,
        name: feature.name,
        enabled: feature.enabled,
      })),
      config: moduleConfig.default_config,
    },
  });
});

// 健康检查路由
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Special Equipment Management Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Special Equipment Management API',
    endpoints: {
      health: '/api/special-equipment/health',
      status: '/api/special-equipment/status',
      equipment: '/api/special-equipment',
      inspections: '/api/special-equipment/inspections',
      'expiring-inspections': '/api/special-equipment/expiring-inspections',
      statistics: '/api/special-equipment/statistics/overview',
    },
  });
});

module.exports = router;
