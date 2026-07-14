/**
 * 特种设备管理路由
 */

const express = require('express');
const router = express.Router();
const specialEquipmentController = require('../controllers/special-equipment.controller');
const { authenticate } = require('../../../middleware/auth');

// ==================== 特种设备管理 ====================

// 获取特种设备列表
router.get('/', authenticate, specialEquipmentController.getEquipments);

// 获取特种设备详情
router.get('/:id', authenticate, specialEquipmentController.getEquipmentById);

// 创建设备
router.post('/', authenticate, specialEquipmentController.createEquipment);

// 更新设备
router.put('/:id', authenticate, specialEquipmentController.updateEquipment);

// 删除设备
router.delete('/:id', authenticate, specialEquipmentController.deleteEquipment);

// ==================== 检验记录管理 ====================

// 获取检验记录列表
router.get('/inspections', authenticate, specialEquipmentController.getInspections);

// 创建检验记录
router.post('/inspections', authenticate, specialEquipmentController.createInspection);

// 更新检验记录
router.put('/inspections/:id', authenticate, specialEquipmentController.updateInspection);

// 删除检验记录
router.delete('/inspections/:id', authenticate, specialEquipmentController.deleteInspection);

// ==================== 统计分析 ====================

// 获取即将到期检验的设备
router.get('/expiring-inspections', authenticate, specialEquipmentController.getExpiringInspections);

// 获取特种设备统计
router.get('/statistics/overview', authenticate, specialEquipmentController.getStatistics);

module.exports = router;
