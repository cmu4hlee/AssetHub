/**
 * 设备风险管理模块路由
 */

const express = require('express');
const router = express.Router();
const moduleConfig = require('../config/module.config');
const { authenticate } = require('../../../middleware/auth');

router.get('/', authenticate, (req, res) => {
  res.json({
    success: true,
    message: '风险管理API',
    endpoints: {
      status: '/api/risk/status',
      dashboard: '/api/risk/dashboard',
      assessments: '/api/risk/assessments',
      classification: '/api/risk/classification',
      controls: '/api/risk/controls',
    },
  });
});

// 健康检查端点（公开，无需认证）
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Asset Risk Management Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 检查功能是否启用
function isFeatureEnabled(featureName) {
  const feature = moduleConfig.features[featureName];
  return feature && feature.enabled;
}

// 风险评估路由
if (isFeatureEnabled('risk_assessment')) {
  router.use('/assessments', require('./risk-assessment.routes'));
}

// 风险分级路由
if (isFeatureEnabled('risk_classification')) {
  router.use('/classification', require('./risk-classification.routes'));
}

// 风险控制路由
if (isFeatureEnabled('risk_control')) {
  router.use('/controls', require('./risk-control.routes'));
}

// 仪表盘数据
try {
  const dashboardRouter = require('./risk-dashboard.routes');
  router.use('/dashboard', authenticate, dashboardRouter);
} catch (err) {
  console.error('加载风险仪表盘路由失败:', err.message);
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

module.exports = router;
