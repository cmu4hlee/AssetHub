const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/device.controller');
const { authenticate } = require('../../../middleware/auth');

// ==================== 设备管理 ====================

// 获取设备列表
router.get('/', authenticate, deviceController.getDevices);

// ==================== 资产设备关联（必须放在 /:id 之前） ====================

// 获取设备的关联资产（必须在 /:id 路由之前定义）
router.get('/:deviceId/assets', authenticate, deviceController.getDeviceAssets);

// ==================== 单个设备操作 ====================

// 获取设备详情
router.get('/:id', authenticate, deviceController.getDeviceById);

// 创建设备
router.post('/', authenticate, deviceController.createDevice);

// 更新设备
router.put('/:id', authenticate, deviceController.updateDevice);

// 删除设备
router.delete('/:id', authenticate, deviceController.deleteDevice);

// ==================== 资产设备关联 ====================

// 关联设备到资产
router.post('/assets/:assetCode/link', authenticate, deviceController.linkDeviceToAsset);

// 解绑设备
router.post('/assets/:assetCode/unlink', authenticate, deviceController.unlinkDeviceFromAsset);

// 获取资产的关联设备
router.get('/assets/:assetCode/devices', authenticate, deviceController.getAssetDevices);

module.exports = router;
