/**
 * 合规性管理路由统一导出
 * 符合《医学装备整体运维管理服务规范》要求
 */

const express = require('express');
const router = express.Router();
const complianceRouter = require('./compliance');
const { authenticate } = require('../../../middleware/auth');

// 挂载合规管理路由
router.use('/', complianceRouter);

// 根路由 - 返回API信息
router.get('/', authenticate, (req, res) => {
  res.json({
    success: true,
    message: '合规性管理API',
    endpoints: {
      status: '/api/compliance/status',
      'dashboard-stats': '/api/compliance/dashboard-stats',
      'maintenance-templates': '/api/compliance/maintenance-templates',
      'maintenance-plans': '/api/compliance/maintenance-plans',
      'special-equipment': '/api/compliance/special-equipment',
      'safety-inspections': '/api/compliance/safety-inspections',
      'staff-qualifications': '/api/compliance/staff-qualifications',
      'uptime-statistics': '/api/compliance/uptime-statistics',
    },
  });
});

// 健康检查路由
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Compliance Management Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
