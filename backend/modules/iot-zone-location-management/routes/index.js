const express = require('express');
const router = express.Router();
const zoneLocationRouter = require('./zone-location');

router.use('/', zoneLocationRouter);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Zone Location Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Zone Location API',
    endpoints: {
      health: '/api/iot-zone-location/health',
      ingest: '/api/iot-zone-location/ingest',
      ingest_batch: '/api/iot-zone-location/ingest/batch',
      sample: '/api/iot-zone-location/sample',
      'device latest': '/api/iot-zone-location/devices/:deviceId/latest',
      'asset latest': '/api/iot-zone-location/assets/:assetCode/latest',
      'asset series': '/api/iot-zone-location/assets/:assetCode/series',
      'pipeline health': '/api/iot-zone-location/pipeline/health',
      'pipeline docs': '/api/iot-zone-location/pipeline/docs',
    },
  });
});

module.exports = router;
