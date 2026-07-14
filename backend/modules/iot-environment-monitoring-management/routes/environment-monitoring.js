const express = require('express');
const router = express.Router();
const environmentMonitoringController = require('../controllers/environment-monitoring.controller');
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

router.post('/ingest', environmentMonitoringController.ingest);
router.post('/ingest/batch', environmentMonitoringController.ingestBatch);
router.post('/sample', authenticate, requireMonitoringManageRole, environmentMonitoringController.ingestSample);
router.get('/devices/:deviceId/latest', authenticate, environmentMonitoringController.getLatestByDevice);
router.get('/assets/:assetCode/latest', authenticate, environmentMonitoringController.getLatestByAsset);
router.get('/assets/:assetCode/series', authenticate, environmentMonitoringController.getAssetSeries);
router.get('/pipeline/health', authenticate, environmentMonitoringController.pipelineHealth);
router.get('/pipeline/docs', authenticate, environmentMonitoringController.pipelineDocs);

module.exports = router;
