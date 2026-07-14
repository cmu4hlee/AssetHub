const express = require('express');
const multer = require('multer');
const router = express.Router();
const assetMonitoringController = require('../controllers/asset-monitoring.controller');
const { authenticate } = require('../../../middleware/auth');
const { fileSecurity } = require('../../../middleware/fileSecurity');

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter(req, file, cb) {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('只支持 JPG、PNG、GIF、WEBP、BMP 图片上传'), false);
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
});

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

const handleMulterError = (err, req, res, next) => {
  if (!err) {
    next();
    return;
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ success: false, message: '图片大小超过限制（单张最大 10MB）' });
    return;
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    res.status(400).json({ success: false, message: '图片数量超过限制（最多 5 张）' });
    return;
  }

  res.status(400).json({ success: false, message: err.message || '图片上传失败' });
};

const requireExternalReportRole = (req, res, next) => {
  if (hasMonitoringManageRole(req)) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: '当前账号无权调用第三方故障上报接口',
  });
};

router.post('/ingest', assetMonitoringController.ingest);
router.post('/ingest/batch', assetMonitoringController.ingestBatch);
router.post(
  '/sample',
  authenticate,
  requireMonitoringManageRole,
  assetMonitoringController.ingestSample,
);
router.post(
  '/external-report',
  authenticate,
  requireExternalReportRole,
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'screenshots', maxCount: 5 },
    { name: 'image', maxCount: 1 },
    { name: 'screenshot', maxCount: 1 },
  ]),
  fileSecurity(),
  handleMulterError,
  assetMonitoringController.externalReport,
);
router.get(
  '/assets/:assetCode/error-reports',
  authenticate,
  assetMonitoringController.getAssetErrorReports,
);
router.get('/devices/:deviceId/latest', authenticate, assetMonitoringController.getLatestByDevice);
router.get('/assets/:assetCode/latest', authenticate, assetMonitoringController.getLatestByAsset);
router.get('/assets/:assetCode/series', authenticate, assetMonitoringController.getAssetSeries);
router.get('/pipeline/health', authenticate, assetMonitoringController.pipelineHealth);
router.get('/pipeline/docs', authenticate, assetMonitoringController.pipelineDocs);

module.exports = router;
