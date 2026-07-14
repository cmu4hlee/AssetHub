/**
 * 员工资质模块路由聚合
 * 符合《医学装备整体运维管理服务规范》要求
 */

const express = require('express');
const router = express.Router();
const moduleConfig = require('../config/module.config');

const staffQualificationRouter = require('./staff-qualification');
const qualificationRoutes = require('./staff.routes');
const trainingRoutes = require('./training.routes');
const assessmentRoutes = require('./assessment.routes');
const staffDashboardRoutes = require('./staff-dashboard.routes');

/**
 * 检查功能是否启用
 * @param {string} featureName - 功能名称
 * @returns {boolean} 是否启用
 */
function isFeatureEnabled(featureName) {
  const feature = moduleConfig.features[featureName];
  return feature && feature.enabled;
}

// 资质管理路由（使用新的MVC结构）
if (isFeatureEnabled('qualification_management')) {
  router.use('/', staffQualificationRouter);
  router.use('/qualifications', staffQualificationRouter);
}

// 培训管理路由
if (isFeatureEnabled('training_management')) {
  router.use('/training', trainingRoutes);
  router.use('/training-records', staffQualificationRouter);
}

// 考核管理路由
if (isFeatureEnabled('competency_assessment')) {
  router.use('/assessments', assessmentRoutes);
}

// 仪表盘数据
router.use('/dashboard', staffDashboardRoutes);

// 模块统计概览
router.get('/statistics', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const isSuperAdmin = req.user.role === 'super_admin';

    const staffQualificationService = require('../services/staff-qualification.service');
    const stats = await staffQualificationService.getStatistics(tenantId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 模块状态接口
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

// 模块健康检查
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Staff Qualification Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Staff Qualification API',
    endpoints: {
      health: '/api/staff/health',
      status: '/api/staff/status',
      qualifications: '/api/staff/qualifications',
      'qualifications/expiring': '/api/staff/qualifications/expiring',
      'training-records': '/api/staff/training-records',
      assessments: '/api/staff/assessments',
      statistics: '/api/staff/statistics',
      dashboard: '/api/staff/dashboard',
    },
  });
});

module.exports = router;
