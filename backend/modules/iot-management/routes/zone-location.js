const express = require('express');
const router = express.Router();
const zoneLocationController = require('../controllers/zone-location.controller');
const { authenticate } = require('../../../middleware/auth');

const requireMonitoringManageRole = (req, res, next) => {
  const allowedRoles = new Set(['system_admin', 'asset_admin', 'maintenance_admin', 'maintenance_engineer']);
  const userRole = req.user?.role;

  if (req.user?.is_super_admin || userRole === 'super_admin' || allowedRoles.has(userRole)) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: '当前账号无权写入监测样例数据',
  });
};

// 硬件上报接口（无需认证，供外部网关/信标设备调用）
router.post('/ingest', zoneLocationController.ingest);
router.post('/ingest/batch', zoneLocationController.ingestBatch);
router.post('/sample', authenticate, requireMonitoringManageRole, zoneLocationController.ingestSample);

// 管理查询接口（需认证）
router.get('/devices/:deviceId/latest', authenticate, zoneLocationController.getLatestByDevice);
router.get('/assets/:assetCode/latest', authenticate, zoneLocationController.getLatestByAsset);
router.get('/assets/:assetCode/series', authenticate, zoneLocationController.getAssetSeries);
router.get('/pipeline/health', authenticate, zoneLocationController.pipelineHealth);
router.get('/pipeline/docs', authenticate, zoneLocationController.pipelineDocs);

module.exports = router;
