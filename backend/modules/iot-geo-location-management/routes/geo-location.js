const express = require('express');
const router = express.Router();
const geoLocationController = require('../controllers/geo-location.controller');
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

router.post('/ingest', geoLocationController.ingest);
router.post('/ingest/batch', geoLocationController.ingestBatch);
router.post('/sample', authenticate, requireMonitoringManageRole, geoLocationController.ingestSample);
router.get('/devices/:deviceId/latest', authenticate, geoLocationController.getLatestByDevice);
router.get('/assets/:assetCode/latest', authenticate, geoLocationController.getLatestByAsset);
router.get('/assets/:assetCode/series', authenticate, geoLocationController.getAssetSeries);
router.get('/pipeline/health', authenticate, geoLocationController.pipelineHealth);
router.get('/pipeline/docs', authenticate, geoLocationController.pipelineDocs);

module.exports = router;
