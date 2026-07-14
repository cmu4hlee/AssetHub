const express = require('express');
const router = express.Router();
const geoLocationRouter = require('./geo-location');

router.use('/', geoLocationRouter);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Geo Location Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Geo Location API',
    endpoints: {
      health: '/api/iot-geo-location/health',
      ingest: '/api/iot-geo-location/ingest',
      ingest_batch: '/api/iot-geo-location/ingest/batch',
      sample: '/api/iot-geo-location/sample',
      'device latest': '/api/iot-geo-location/devices/:deviceId/latest',
      'asset latest': '/api/iot-geo-location/assets/:assetCode/latest',
      'asset series': '/api/iot-geo-location/assets/:assetCode/series',
      'pipeline health': '/api/iot-geo-location/pipeline/health',
      'pipeline docs': '/api/iot-geo-location/pipeline/docs',
    },
  });
});

module.exports = router;
