/**
 * 特种设备管理路由
 * 注意：所有「单段静态路径」GET 路由（/、/import-template、/export、
 * /inspections、/expiring-inspections）必须注册在 GET /:id 之前，
 * 否则会被 /:id 参数路由劫持。
 */

const express = require('express');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const specialEquipmentController = require('../controllers/special-equipment.controller');
const { authenticate } = require('../../../middleware/auth');
const { auditLogger } = require('../../../middleware/auditLogger');

// 导入文件上传（内存存储，不落盘）
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const ok = ['.xlsx', '.xls'].includes(ext) || /excel|spreadsheet|officedocument/.test(file.mimetype || '');
    if (ok) cb(null, true);
    else cb(new Error('仅支持 Excel 文件（.xlsx / .xls）'), false);
  },
});

const handleImportUpload = (req, res, next) => {
  importUpload.single('file')(req, res, err => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: '文件大小超过限制（最大10MB）' });
      }
      return res.status(400).json({ success: false, message: err.message || '文件上传失败' });
    }
    return next();
  });
};

// ==================== 单段 GET 静态路由（须在 /:id 之前） ====================

router.get('/', authenticate, specialEquipmentController.getEquipments);
router.get('/import-template', authenticate, specialEquipmentController.getImportTemplate);
router.get('/export', authenticate, specialEquipmentController.exportEquipments);
router.get('/inspections', authenticate, specialEquipmentController.getInspections);
router.get('/expiring-inspections', authenticate, specialEquipmentController.getExpiringInspections);
router.get('/statistics/overview', authenticate, specialEquipmentController.getStatistics);

// ==================== 参数路由 ====================

router.get('/:id', authenticate, specialEquipmentController.getEquipmentById);

router.post('/', authenticate,
  auditLogger('create', 'special-equipment', req => ({
    resource_type: '特种设备',
    resource_name: req.body?.equipment_name || req.body?.equipment_code,
    action_description: `创建特种设备：${req.body?.equipment_name || req.body?.equipment_code || '-'}`,
  })),
  specialEquipmentController.createEquipment
);

router.put('/:id', authenticate,
  auditLogger('update', 'special-equipment', req => ({
    resource_type: '特种设备',
    resource_id: req.params?.id,
    resource_name: req.body?.equipment_name,
    action_description: `更新特种设备 #${req.params?.id}`,
  })),
  specialEquipmentController.updateEquipment
);

router.delete('/:id', authenticate,
  auditLogger('delete', 'special-equipment', req => ({
    resource_type: '特种设备',
    resource_id: req.params?.id,
    action_description: `删除特种设备 #${req.params?.id}`,
  })),
  specialEquipmentController.deleteEquipment
);

// ==================== 批量操作 ====================

router.post('/batch-delete', authenticate,
  auditLogger('batch-delete', 'special-equipment', req => ({
    resource_type: '特种设备',
    action_description: `批量删除 ${req.body?.ids?.length || 0} 台特种设备`,
  })),
  specialEquipmentController.batchDelete
);

router.post('/batch-update-status', authenticate,
  auditLogger('batch-update-status', 'special-equipment', req => ({
    resource_type: '特种设备',
    action_description: `批量更新 ${req.body?.ids?.length || 0} 台特种设备状态`,
  })),
  specialEquipmentController.batchUpdateStatus
);

// ==================== 批量导入 ====================

router.post('/import/validate', authenticate, handleImportUpload, specialEquipmentController.validateImport);

router.post('/import', authenticate, handleImportUpload,
  auditLogger('import', 'special-equipment', req => ({
    resource_type: '特种设备',
    action_description: '批量导入特种设备（Excel）',
  })),
  specialEquipmentController.importEquipments
);

// ==================== 检验记录管理 ====================

router.post('/inspections', authenticate,
  auditLogger('create', 'special-equipment-inspection', req => ({
    resource_type: '检验记录',
    resource_name: req.body?.inspection_code,
    action_description: `创建检验记录：${req.body?.inspection_code || '-'}`,
  })),
  specialEquipmentController.createInspection
);

router.put('/inspections/:id', authenticate,
  auditLogger('update', 'special-equipment-inspection', req => ({
    resource_type: '检验记录',
    resource_id: req.params?.id,
    resource_name: req.body?.inspection_code,
    action_description: `更新检验记录 #${req.params?.id}`,
  })),
  specialEquipmentController.updateInspection
);

router.delete('/inspections/:id', authenticate,
  auditLogger('delete', 'special-equipment-inspection', req => ({
    resource_type: '检验记录',
    resource_id: req.params?.id,
    action_description: `删除检验记录 #${req.params?.id}`,
  })),
  specialEquipmentController.deleteInspection
);

module.exports = router;
