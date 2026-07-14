const express = require('express');
const router = express.Router();
const assetMonitoringRouter = require('./asset-monitoring');

router.use('/', assetMonitoringRouter);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Asset Monitoring Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Asset Monitoring API',
    endpoints: {
      health: '/api/iot-asset-monitoring/health',
      ingest: '/api/iot-asset-monitoring/ingest',
      ingest_batch: '/api/iot-asset-monitoring/ingest/batch',
      sample: '/api/iot-asset-monitoring/sample',
      'device latest': '/api/iot-asset-monitoring/devices/:deviceId/latest',
      'asset latest': '/api/iot-asset-monitoring/assets/:assetCode/latest',
      'asset series': '/api/iot-asset-monitoring/assets/:assetCode/series',
      'pipeline health': '/api/iot-asset-monitoring/pipeline/health',
      'pipeline docs': '/api/iot-asset-monitoring/pipeline/docs',
    },
  });
});

module.exports = router;
