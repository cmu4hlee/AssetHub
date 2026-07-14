const express = require('express');
const router = express.Router();
const environmentMonitoringRouter = require('./environment-monitoring');

router.use('/', environmentMonitoringRouter);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Environment Monitoring Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Environment Monitoring API',
    endpoints: {
      health: '/api/iot-environment-monitoring/health',
      ingest: '/api/iot-environment-monitoring/ingest',
      ingest_batch: '/api/iot-environment-monitoring/ingest/batch',
      sample: '/api/iot-environment-monitoring/sample',
      'device latest': '/api/iot-environment-monitoring/devices/:deviceId/latest',
      'asset latest': '/api/iot-environment-monitoring/assets/:assetCode/latest',
      'asset series': '/api/iot-environment-monitoring/assets/:assetCode/series',
      'pipeline health': '/api/iot-environment-monitoring/pipeline/health',
      'pipeline docs': '/api/iot-environment-monitoring/pipeline/docs',
    },
  });
});

module.exports = router;
