const express = require('express');
const router = express.Router();
const patientVolumeController = require('../controllers/patient-volume.controller');
const { authenticate } = require('../../../middleware/auth');

const hasMonitoringManageRole = req => {
  const allowedRoles = new Set(['system_admin', 'asset_admin', 'maintenance_admin', 'maintenance_engineer']);
  const userRole = req.user?.role;

  return req.user?.is_super_admin || userRole === 'super_admin' || allowedRoles.has(userRole);
};

const requirePatientVolumeIngestRole = (req, res, next) => {
  if (hasMonitoringManageRole(req)) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: '当前账号无权上报患者量数据',
  });
};

const requireMonitoringManageRole = (req, res, next) => {
  if (hasMonitoringManageRole(req)) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: '当前账号无权写入患者量样例数据',
  });
};

router.post('/ingest', authenticate, requirePatientVolumeIngestRole, patientVolumeController.ingest);
router.post('/ingest/batch', authenticate, requirePatientVolumeIngestRole, patientVolumeController.ingestBatch);
router.post('/sample', authenticate, requireMonitoringManageRole, patientVolumeController.ingestSample);
router.get('/assets/usage-stats', authenticate, patientVolumeController.getUsageStats);
router.get('/assets/usage-stats/all', authenticate, patientVolumeController.getAllAssetStats);
router.get('/records/recent', authenticate, patientVolumeController.getRecentRecords);
router.get('/records/all', authenticate, patientVolumeController.getAllRecords);
router.get('/assets/:assetCode/patients', authenticate, patientVolumeController.getPatientListByAsset);
router.get('/assets/:assetCode/latest', authenticate, patientVolumeController.getLatestByAsset);
router.get('/assets/:assetCode/series', authenticate, patientVolumeController.getAssetSeries);
router.get('/pipeline/health', authenticate, patientVolumeController.pipelineHealth);
router.get('/pipeline/docs', authenticate, patientVolumeController.pipelineDocs);

module.exports = router;
