const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');
const { authenticate } = require('../../../middleware/auth');

// ==================== 资产位置管理 ====================

// 获取资产当前位置
router.get('/assets/:assetCode/location', authenticate, locationController.getAssetLocation);

// 批量获取资产位置
router.post('/assets/locations', authenticate, locationController.getBatchAssetLocations);

// 更新资产位置
router.post('/assets/:assetCode/location', authenticate, locationController.updateAssetLocation);

// 获取资产位置历史
router.get(
  '/assets/:assetCode/location/history',
  authenticate,
  locationController.getAssetLocationHistory,
);

// 查询指定区域内的资产
router.post('/assets/in-area', authenticate, locationController.getAssetsInArea);

// ==================== 设备数据上报 ====================

// 设备自动上报位置数据（无需认证，供外部设备调用）
router.post('/devices/:deviceId/data', locationController.handleDeviceLocationReport);

// 信标设备位置上报（无需认证，供外部设备调用）
router.post('/beacon-location', locationController.handleBeaconLocationReport);

module.exports = router;
