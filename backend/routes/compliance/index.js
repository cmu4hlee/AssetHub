/**
 * 合规性管理路由统一导出
 * 符合《医学装备整体运维管理服务规范》要求
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate } = require('../../middleware/auth');
const { getTenantId } = require('../../middleware/tenant-filter');

router.get('/', authenticate, (req, res) => {
  res.json({
    success: true,
    message: '合规性管理API',
    endpoints: {
      status: '/api/compliance/status',
      'dashboard-stats': '/api/compliance/dashboard-stats',
      'maintenance-level': '/api/compliance/maintenance-level',
      uptime: '/api/compliance/uptime',
      staff: '/api/compliance/staff',
      'special-equipment': '/api/compliance/special-equipment',
      'safety-inspection': '/api/compliance/safety-inspection',
    },
  });
});

router.get('/status', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      module_id: 'compliance-management',
      name: '合规性管理',
      version: '1.0.0',
      features: [
        { id: 'maintenance_level', name: '分级保养', enabled: true },
        { id: 'uptime', name: '开机率统计', enabled: true },
        { id: 'staff', name: '人员资质', enabled: true },
        { id: 'special_equipment', name: '特种设备', enabled: true },
        { id: 'safety_inspection', name: '安全检测', enabled: true },
      ],
    },
  });
});

router.get('/dashboard-stats', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (tenantId == null) {
      return res.status(400).json({
        success: false,
        message:
          req.user?.role === 'super_admin' ? '请先选择企业空间' : '当前用户未分配企业空间',
        code: 'REQUIRE_TENANT',
      });
    }

    let maintenanceStats = { total: 0, pending: 0, processing: 0, completed: 0 };

    try {
      const [maintenanceResult] = await db.execute(
        `SELECT 
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
          COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0) as processing,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed
        FROM maintenance_plans WHERE tenant_id = ?`,
        [tenantId],
      );
      if (maintenanceResult[0]) {
        maintenanceStats = {
          total: Number(maintenanceResult[0].total || 0),
          pending: Number(maintenanceResult[0].pending || 0),
          processing: Number(maintenanceResult[0].processing || 0),
          completed: Number(maintenanceResult[0].completed || 0),
        };
      }
    } catch (error) {
      console.warn('maintenance_plans table not available:', error.message);
    }

    res.json({
      success: true,
      data: {
        maintenance: maintenanceStats,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 分级保养管理
router.use('/maintenance-level', require('./maintenance-level'));

// 开机率统计管理
router.use('/uptime', require('./uptime-statistics'));

// 人员资质管理
router.use('/staff', require('./staff-qualification'));

// 特种设备管理
router.use('/special-equipment', require('./special-equipment'));

// 安全检测管理
router.use('/safety-inspection', require('./safety-inspection'));

module.exports = router;
