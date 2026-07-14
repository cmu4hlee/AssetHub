const express = require('express');
const router = express.Router();
const zoneLocationController = require('../controllers/zone-location.controller');
const { authenticate } = require('../../../middleware/auth');

const hasMonitoringManageRole = req => {
  const allowedRoles = new Set(['system_admin', 'asset_admin', 'maintenance_admin', 'maintenance_engineer']);
  const userRole = req.user?.role;
  return req.user?.is_super_admin || userRole === 'super_admin' || allowedRoles.has(userRole);
};

const requireMonitoringManageRole = (req, res, next) => {
  if (hasMonitoringManageRole(req)) {
    next();
    return;
  }
  res.status(403).json({
    success: false,
    message: '当前账号无权写入监测样例数据',
  });
};

router.post('/ingest', zoneLocationController.ingest);
router.post('/ingest/batch', zoneLocationController.ingestBatch);
router.post('/sample', authenticate, requireMonitoringManageRole, zoneLocationController.ingestSample);
router.get('/devices/:deviceId/latest', authenticate, zoneLocationController.getLatestByDevice);
router.get('/assets/:assetCode/latest', authenticate, zoneLocationController.getLatestByAsset);
router.get('/assets/:assetCode/series', authenticate, zoneLocationController.getAssetSeries);
router.get('/pipeline/health', authenticate, zoneLocationController.pipelineHealth);
router.get('/pipeline/docs', authenticate, zoneLocationController.pipelineDocs);

module.exports = router;
