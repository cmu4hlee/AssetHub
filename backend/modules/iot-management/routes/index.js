const express = require('express');
const router = express.Router();
const iotDevicesRouter = require('./iot-devices');
const assetLocationRouter = require('./asset-location');
const assetMonitoringRouter = require('./asset-monitoring');
const environmentMonitoringRouter = require('./environment-monitoring');
const zoneLocationRouter = require('./zone-location');
const patientVolumeRouter = require('./patient-volume');

// 挂载设备管理路由
router.use('/devices', iotDevicesRouter);

// 挂载资产位置管理路由
router.use('/location', assetLocationRouter);

// 挂载资产监测管理路由
router.use('/asset-monitoring', assetMonitoringRouter);

// 挂载环境监测管理路由
router.use('/environment-monitoring', environmentMonitoringRouter);

// 挂载区域定位管理路由
router.use('/zone-location', zoneLocationRouter);

// 挂载患者流量统计路由
router.use('/patient-volume', patientVolumeRouter);

// 健康检查路由
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Management Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Management API',
    endpoints: {
      health: '/api/iot/health',
      devices: '/api/iot/devices',
      location: '/api/iot/location',
      'asset-monitoring': '/api/iot/asset-monitoring',
      'environment-monitoring': '/api/iot/environment-monitoring',
      'zone-location': '/api/iot/zone-location',
      'patient-volume': '/api/iot/patient-volume',
    },
  });
});

module.exports = router;
