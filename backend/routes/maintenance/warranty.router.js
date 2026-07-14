const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { authenticate, authorize } = require('../../middleware/auth');

// 保修模块权限集合
const WT_GET_ROLES = ['maintenance.view', 'warranty.view', 'asset.view_all', 'asset.view_own_department'];
const WT_WRITE_ROLES = ['maintenance.add', 'maintenance.edit', 'warranty.view', 'asset.edit_all', 'asset.edit_own_department'];
const WT_DELETE_ROLES = ['maintenance.delete', 'maintenance.edit', 'asset.delete_all', 'asset.delete_own_department'];
const { fileSecurity } = require('../../middleware/fileSecurity');
const warrantyService = require('../../services/maintenance/warranty.service');

const router = express.Router();

// 文件上传配置
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadPath = path.join(__dirname, '../../uploads/warranty-files');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename(req, file, cb) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const prefix = req.params.type || 'file';
    cb(null, `${prefix}-${timestamp}-${random}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
});

const handleMulterError = (err, _req, res, next) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: '文件大小超过限制（最大50MB）' });
    }
    if (err.message && err.message.includes('不支持的文件类型')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(400).json({ success: false, message: `文件上传失败: ${err.message}` });
  }
  next();
};

function sendResult(res, result) {
  if (result && result.statusCode && result.statusCode !== 200) {
    return res.status(result.statusCode).json(result.body);
  }
  if (result && result.body) {
    return res.json(result.body);
  }
  return res.json(result);
}

// =====================================================
// 保修合同管理
// =====================================================
router.get('/warranty/contracts', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getContracts(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取保修合同列表失败:', error);
    res.status(500).json({ success: false, message: '获取保修合同列表失败', error: error.message });
  }
});

router.get('/warranty/contracts/:id', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getContractById(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取保修合同详情失败:', error);
    res.status(500).json({ success: false, message: '获取保修合同详情失败', error: error.message });
  }
});

router.post('/warranty/contracts', authenticate, authorize(WT_WRITE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.createContract(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('创建保修合同失败:', error);
    res.status(500).json({ success: false, message: '创建保修合同失败', error: error.message });
  }
});

router.put('/warranty/contracts/:id', authenticate, authorize(WT_WRITE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.updateContract(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('更新保修合同失败:', error);
    res.status(500).json({ success: false, message: '更新保修合同失败', error: error.message });
  }
});

router.delete('/warranty/contracts/:id', authenticate, authorize(WT_DELETE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.deleteContract(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('删除保修合同失败:', error);
    res.status(500).json({ success: false, message: '删除保修合同失败', error: error.message });
  }
});

// =====================================================
// 发票管理
// =====================================================
router.get('/warranty/invoices', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getInvoices(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取发票列表失败:', error);
    res.status(500).json({ success: false, message: '获取发票列表失败', error: error.message });
  }
});

router.get('/warranty/invoices/:id', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getInvoiceById(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取发票详情失败:', error);
    res.status(500).json({ success: false, message: '获取发票详情失败', error: error.message });
  }
});

router.post('/warranty/invoices', authenticate, authorize(WT_WRITE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.createInvoice(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('创建发票失败:', error);
    res.status(500).json({ success: false, message: '创建发票失败', error: error.message });
  }
});

router.put('/warranty/invoices/:id', authenticate, authorize(WT_WRITE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.updateInvoice(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('更新发票失败:', error);
    res.status(500).json({ success: false, message: '更新发票失败', error: error.message });
  }
});

router.delete('/warranty/invoices/:id', authenticate, authorize(WT_DELETE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.deleteInvoice(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('删除发票失败:', error);
    res.status(500).json({ success: false, message: '删除发票失败', error: error.message });
  }
});

// =====================================================
// 付款管理
// =====================================================
router.get('/warranty/payments', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getPayments(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取付款列表失败:', error);
    res.status(500).json({ success: false, message: '获取付款列表失败', error: error.message });
  }
});

router.get('/warranty/payments/:id', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getPaymentById(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取付款详情失败:', error);
    res.status(500).json({ success: false, message: '获取付款详情失败', error: error.message });
  }
});

router.post('/warranty/payments', authenticate, authorize(WT_WRITE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.createPayment(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('创建付款记录失败:', error);
    res.status(500).json({ success: false, message: '创建付款记录失败', error: error.message });
  }
});

router.put('/warranty/payments/:id', authenticate, authorize(WT_WRITE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.updatePayment(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('更新付款记录失败:', error);
    res.status(500).json({ success: false, message: '更新付款记录失败', error: error.message });
  }
});

router.delete('/warranty/payments/:id', authenticate, authorize(WT_DELETE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.deletePayment(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('删除付款记录失败:', error);
    res.status(500).json({ success: false, message: '删除付款记录失败', error: error.message });
  }
});

// =====================================================
// 档案管理
// =====================================================
router.get('/warranty/archives', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getArchives(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取档案列表失败:', error);
    res.status(500).json({ success: false, message: '获取档案列表失败', error: error.message });
  }
});

router.get('/warranty/archives/:id', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getArchiveById(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取档案详情失败:', error);
    res.status(500).json({ success: false, message: '获取档案详情失败', error: error.message });
  }
});

router.post('/warranty/archives', authenticate, authorize(WT_WRITE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.createArchive(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('创建档案失败:', error);
    res.status(500).json({ success: false, message: '创建档案失败', error: error.message });
  }
});

router.put('/warranty/archives/:id', authenticate, authorize(WT_WRITE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.updateArchive(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('更新档案失败:', error);
    res.status(500).json({ success: false, message: '更新档案失败', error: error.message });
  }
});

router.delete('/warranty/archives/:id', authenticate, authorize(WT_DELETE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.deleteArchive(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('删除档案失败:', error);
    res.status(500).json({ success: false, message: '删除档案失败', error: error.message });
  }
});

// =====================================================
// 保修信息维护
// =====================================================
router.get('/warranty/info', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getWarrantyInfo(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取保修信息列表失败:', error);
    res.status(500).json({ success: false, message: '获取保修信息列表失败', error: error.message });
  }
});

router.get('/warranty/info/:id', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getWarrantyInfoById(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取保修信息详情失败:', error);
    res.status(500).json({ success: false, message: '获取保修信息详情失败', error: error.message });
  }
});

router.post('/warranty/info', authenticate, authorize(WT_WRITE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.createWarrantyInfo(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('创建保修信息失败:', error);
    res.status(500).json({ success: false, message: '创建保修信息失败', error: error.message });
  }
});

router.put('/warranty/info/:id', authenticate, authorize(WT_WRITE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.updateWarrantyInfo(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('更新保修信息失败:', error);
    res.status(500).json({ success: false, message: '更新保修信息失败', error: error.message });
  }
});

router.delete('/warranty/info/:id', authenticate, authorize(WT_DELETE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.deleteWarrantyInfo(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('删除保修信息失败:', error);
    res.status(500).json({ success: false, message: '删除保修信息失败', error: error.message });
  }
});

// =====================================================
// 在保清单 / 过保清单 / 维修清单
// =====================================================
router.get('/warranty/in-warranty', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getInWarrantyList(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取在保清单失败:', error);
    res.status(500).json({ success: false, message: '获取在保清单失败', error: error.message });
  }
});

router.get('/warranty/out-warranty', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getOutWarrantyList(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取过保清单失败:', error);
    res.status(500).json({ success: false, message: '获取过保清单失败', error: error.message });
  }
});

router.get('/warranty/repair-list', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getRepairList(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取维修清单失败:', error);
    res.status(500).json({ success: false, message: '获取维修清单失败', error: error.message });
  }
});

// =====================================================
// 保修历史记录
// =====================================================
router.get('/warranty/history', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getHistory(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取保修历史记录失败:', error);
    res.status(500).json({ success: false, message: '获取保修历史记录失败', error: error.message });
  }
});

// =====================================================
// 保修提醒管理
// =====================================================
router.get('/warranty/reminders', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getReminders(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取保修提醒列表失败:', error);
    res.status(500).json({ success: false, message: '获取保修提醒列表失败', error: error.message });
  }
});

router.post('/warranty/reminders', authenticate, authorize(WT_WRITE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.createReminder(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('创建保修提醒失败:', error);
    res.status(500).json({ success: false, message: '创建保修提醒失败', error: error.message });
  }
});

router.put('/warranty/reminders/:id', authenticate, authorize(WT_WRITE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.updateReminder(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('更新保修提醒失败:', error);
    res.status(500).json({ success: false, message: '更新保修提醒失败', error: error.message });
  }
});

router.delete('/warranty/reminders/:id', authenticate, authorize(WT_DELETE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.deleteReminder(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('删除保修提醒失败:', error);
    res.status(500).json({ success: false, message: '删除保修提醒失败', error: error.message });
  }
});

router.get('/warranty/reminders/check', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.checkExpiringWarranties(req);
    sendResult(res, result);
  } catch (error) {
    console.error('检查保修到期失败:', error);
    res.status(500).json({ success: false, message: '检查保修到期失败', error: error.message });
  }
});

// =====================================================
// 保修提醒配置
// =====================================================
router.get('/warranty/reminder-configs', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getReminderConfigs(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取提醒配置失败:', error);
    res.status(500).json({ success: false, message: '获取提醒配置失败', error: error.message });
  }
});

router.post('/warranty/reminder-configs', authenticate, authorize(WT_WRITE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.saveReminderConfig(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('保存提醒配置失败:', error);
    res.status(500).json({ success: false, message: '保存提醒配置失败', error: error.message });
  }
});

router.delete('/warranty/reminder-configs/:id', authenticate, authorize(WT_DELETE_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.deleteReminderConfig(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('删除提醒配置失败:', error);
    res.status(500).json({ success: false, message: '删除提醒配置失败', error: error.message });
  }
});

// =====================================================
// 保修统计
// =====================================================
router.get('/warranty/statistics', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const result = await warrantyService.getStatistics(req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取保修统计失败:', error);
    res.status(500).json({ success: false, message: '获取保修统计失败', error: error.message });
  }
});

// =====================================================
// 文件上传/下载（发票、档案、付款凭证）
// =====================================================
router.post('/warranty/upload/:type', authenticate, upload.single('file'), fileSecurity(), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要上传的文件' });
    }
    const filePath = `/uploads/warranty-files/${req.file.filename}`;
    return res.json({
      success: true,
      message: '文件上传成功',
      data: {
        file_path: filePath,
        file_name: req.file.originalname,
        file_size: req.file.size,
        file_type: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error('文件上传失败:', error);
    res.status(500).json({ success: false, message: '文件上传失败', error: error.message });
  }
});

router.get('/warranty/files/:filename', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../uploads/warranty-files', req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('获取文件失败:', error);
    res.status(500).json({ success: false, message: '获取文件失败', error: error.message });
  }
});

router.get('/warranty/files/:filename/download', authenticate, authorize(WT_GET_ROLES), async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../uploads/warranty-files', req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }
    res.download(path.resolve(filePath));
  } catch (error) {
    console.error('下载文件失败:', error);
    res.status(500).json({ success: false, message: '下载文件失败', error: error.message });
  }
});

module.exports = router;
