/**
 * 开机率管理模块路由入口
 */

const express = require('express');
const router = express.Router();
const moduleConfig = require('../config/module.config');
const { authenticate } = require('../../../middleware/auth');

const operationLogRoutes = require('./operation-log.routes');
const uptimeRoutes = require('./uptime.routes');

// 检查功能是否启用
function isFeatureEnabled(featureName) {
  const feature = moduleConfig.features[featureName];
  return feature && feature.enabled;
}

// 挂载运行记录路由
if (isFeatureEnabled('operation_log')) {
  router.use('/operation-logs', operationLogRoutes);
  router.use('/batch-operation-logs', operationLogRoutes);
}

// 挂载开机率统计路由
if (isFeatureEnabled('uptime_statistics')) {
  router.use('/statistics', uptimeRoutes);
}

// 模块状态接口
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

// 获取模块配置
router.get('/config', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      schema: moduleConfig.config_schema,
      default: moduleConfig.default_config,
    },
  });
});

// 健康检查路由
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Uptime Management Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Uptime Management API',
    endpoints: {
      status: '/api/uptime/status',
      config: '/api/uptime/config',
      health: '/api/uptime/health',
      statistics: '/api/uptime/statistics',
      dashboard: '/api/uptime/statistics/dashboard',
      'operation-logs': '/api/uptime/operation-logs',
    },
  });
});

module.exports = router;
