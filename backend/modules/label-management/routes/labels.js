const express = require('express');
const router = express.Router();
const labelController = require('../controllers/label.controller');
const { authenticate } = require('../../../middleware/auth');

// ==================== 标签模板管理 ====================

// 获取标签模板列表
router.get('/templates', authenticate, labelController.getTemplates);

// 获取标签模板详情
router.get('/templates/:id', authenticate, labelController.getTemplateById);

// 创建标签模板
router.post('/templates', authenticate, labelController.createTemplate);

// 更新标签模板
router.put('/templates/:id', authenticate, labelController.updateTemplate);

// 删除标签模板
router.delete('/templates/:id', authenticate, labelController.deleteTemplate);

// ==================== ZPL生成 ====================

// 生成ZPL标签
router.get('/generate-zpl/:templateId/:assetCode', authenticate, labelController.generateZPL);

// 批量生成ZPL标签
router.post('/generate-zpl-batch', authenticate, labelController.generateZPLBatch);

// ==================== 标签打印 ====================

// 打印标签
router.post('/print', authenticate, labelController.printLabel);

// 测试打印机连接
router.post('/printer/test-connection', authenticate, labelController.testPrinterConnection);

// ==================== 打印队列管理 ====================

// 获取打印队列
router.get('/print-queue', authenticate, labelController.getPrintQueue);

// 更新打印任务状态
router.put('/print-queue/:id/status', authenticate, labelController.updatePrintQueueStatus);

module.exports = router;
