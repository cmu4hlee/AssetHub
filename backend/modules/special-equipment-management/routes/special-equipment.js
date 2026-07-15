/**
 * 特种设备管理路由
 */

const express = require('express');
const router = express.Router();
const specialEquipmentController = require('../controllers/special-equipment.controller');
const { authenticate } = require('../../../middleware/auth');
const { auditLogger } = require('../../../middleware/auditLogger');

// ==================== 特种设备管理 ====================

// 获取特种设备列表
router.get('/', authenticate, specialEquipmentController.getEquipments);

// 获取特种设备详情
router.get('/:id', authenticate, specialEquipmentController.getEquipmentById);

// 创建设备
router.post('/', authenticate,
  auditLogger('create', 'special-equipment', (req) => ({
    resource_type: '特种设备',
    resource_name: req.body?.equipment_name || req.body?.equipment_code,
    action_description: `创建特种设备：${req.body?.equipment_name || req.body?.equipment_code || '-'}`,
  })),
  specialEquipmentController.createEquipment
);

// 更新设备
router.put('/:id', authenticate,
  auditLogger('update', 'special-equipment', (req) => ({
    resource_type: '特种设备',
    resource_id: req.params?.id,
    resource_name: req.body?.equipment_name,
    action_description: `更新特种设备 #${req.params?.id}`,
  })),
  specialEquipmentController.updateEquipment
);

// 删除设备
router.delete('/:id', authenticate,
  auditLogger('delete', 'special-equipment', (req) => ({
    resource_type: '特种设备',
    resource_id: req.params?.id,
    action_description: `删除特种设备 #${req.params?.id}`,
  })),
  specialEquipmentController.deleteEquipment
);

// ==================== 检验记录管理 ====================

// 获取检验记录列表
router.get('/inspections', authenticate, specialEquipmentController.getInspections);

// 创建检验记录
router.post('/inspections', authenticate,
  auditLogger('create', 'special-equipment-inspection', (req) => ({
    resource_type: '检验记录',
    resource_name: req.body?.inspection_code,
    action_description: `创建检验记录：${req.body?.inspection_code || '-'}`,
  })),
  specialEquipmentController.createInspection
);

// 更新检验记录
router.put('/inspections/:id', authenticate,
  auditLogger('update', 'special-equipment-inspection', (req) => ({
    resource_type: '检验记录',
    resource_id: req.params?.id,
    resource_name: req.body?.inspection_code,
    action_description: `更新检验记录 #${req.params?.id}`,
  })),
  specialEquipmentController.updateInspection
);

// 删除检验记录
router.delete('/inspections/:id', authenticate,
  auditLogger('delete', 'special-equipment-inspection', (req) => ({
    resource_type: '检验记录',
    resource_id: req.params?.id,
    action_description: `删除检验记录 #${req.params?.id}`,
  })),
  specialEquipmentController.deleteInspection
);

// ==================== 统计分析 ====================

// 获取即将到期检验的设备
router.get('/expiring-inspections', authenticate, specialEquipmentController.getExpiringInspections);

// 获取特种设备统计
router.get('/statistics/overview', authenticate, specialEquipmentController.getStatistics);

module.exports = router;
