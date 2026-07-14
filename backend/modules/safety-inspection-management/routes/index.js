/**
 * 安全检测管理模块路由聚合
 */

const express = require('express');
const router = express.Router();
const safetyInspectionRouter = require('./safety-inspection');
const moduleConfig = require('../config/module.config');

// 挂载安全检测路由
router.use('/', safetyInspectionRouter);

// 模块状态路由
router.get('/status', (req, res) => {
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
    message: 'Safety Inspection Management Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Safety Inspection Management API',
    endpoints: {
      health: '/api/safety-inspection/health',
      status: '/api/safety-inspection/status',
      list: '/api/safety-inspection',
      expiring: '/api/safety-inspection/expiring',
    },
  });
});

module.exports = router;
