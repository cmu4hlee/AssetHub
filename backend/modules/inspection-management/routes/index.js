/**
 * 巡检管理模块路由聚合
 */

const express = require('express');
const router = express.Router();
const inspectionRouter = require('./inspection');
const extendedRouter = require('./inspection-extended');
const moduleConfig = require('../config/module.config');

// 挂载巡检业务路由
router.use('/', inspectionRouter);
// 扩展能力（计划/路线/PDF/转工单/日历/通知/统计增强/模板复制/批量任务/复核）
router.use('/', extendedRouter);

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
    message: 'Inspection Management Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Inspection Management API',
    endpoints: {
      health: '/api/inspection/health',
      status: '/api/inspection/status',
      templates: '/api/inspection/templates',
      tasks: '/api/inspection/tasks',
      records: '/api/inspection/records',
      issues: '/api/inspection/issues',
      statistics: '/api/inspection/statistics',
    },
  });
});

module.exports = router;
