const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { authenticate } = require('../../../middleware/auth');

// 获取所有盘点记录
router.get('/', authenticate, inventoryController.listInventory.bind(inventoryController));

// 盘点统计汇总
router.get('/statistics', authenticate, inventoryController.getStatistics.bind(inventoryController));

// 获取自助盘点窗口
router.get('/self/windows', authenticate, inventoryController.getSelfCheckWindows.bind(inventoryController));

// 获取我的盘点资产
router.get('/self/assets', authenticate, inventoryController.getMyAssets.bind(inventoryController));

// 自助盘点确认
router.post('/self/confirm', authenticate, inventoryController.confirmSelfCheck.bind(inventoryController));

// 获取单个盘点记录详情
router.get('/:id', authenticate, inventoryController.getInventoryById.bind(inventoryController));

// 创建盘点记录
router.post('/', authenticate, inventoryController.createInventory.bind(inventoryController));

// 更新盘点记录
router.put('/:id', authenticate, inventoryController.updateInventory.bind(inventoryController));

// 删除盘点记录
router.delete('/:id', authenticate, inventoryController.deleteInventory.bind(inventoryController));

// 更新盘点状态
router.put('/:id/status', authenticate, inventoryController.updateStatus.bind(inventoryController));

// 启动盘点
router.post('/:id/start', authenticate, inventoryController.startInventory.bind(inventoryController));

// 完成盘点
router.post('/:id/complete', authenticate, inventoryController.completeInventory.bind(inventoryController));

// 获取盘点统计信息
router.get('/:id/statistics', authenticate, inventoryController.getInventoryStatistics.bind(inventoryController));

// 扫描资产（移动端扫码盘点）
router.post('/:id/scan', authenticate, inventoryController.scanAsset.bind(inventoryController));

// 获取扫描历史
router.get('/:id/scan-logs', authenticate, inventoryController.getScanLogs.bind(inventoryController));

// 添加盘点明细
router.post('/:id/details', authenticate, inventoryController.addDetail.bind(inventoryController));

// 批量添加盘点明细
router.post('/:id/details/batch', authenticate, inventoryController.batchAddDetails.bind(inventoryController));

// 更新盘点明细
router.put('/:id/details/:detailId', authenticate, inventoryController.updateDetail.bind(inventoryController));

// 删除盘点明细
router.delete('/:id/details/:detailId', authenticate, inventoryController.deleteDetail.bind(inventoryController));

module.exports = router;
