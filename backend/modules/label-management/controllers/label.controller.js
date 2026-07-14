const db = require('../../../config/database');
const logger = require('../../../config/logger');
const labelService = require('../services/label.service');

// 定义错误类型
const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class LabelController {
  /**
   * 获取标签模板列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getTemplates(req, res) {
    try {
      const { page = 1, pageSize = 20 } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        logger.warn('获取标签模板列表缺少租户ID', { path: req.path, method: req.method });
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      logger.info('获取标签模板列表请求', { tenantId, page, pageSize });

      const result = await labelService.getTemplates({
        page,
        pageSize,
        tenantId,
      });

      logger.info('获取标签模板列表成功', {
        tenantId,
        count: result.data.length,
        total: result.pagination.total,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取标签模板列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取标签模板列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取标签模板详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getTemplateById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const template = await labelService.getTemplateById(id, tenantId);

      if (!template) {
        return res.status(404).json({ success: false, message: '标签模板不存在' });
      }

      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('获取标签模板详情失败', {
        error: error.message,
        stack: error.stack,
        templateId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '获取标签模板详情失败', error: error.message });
    }
  }

  /**
   * 创建标签模板
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createTemplate(req, res) {
    try {
      const templateData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const userId = req.user?.id;

      if (!templateData.name || !templateData.width || !templateData.height || !templateData.elements) {
        return res.status(400).json({
          success: false,
          message: '模板名称、宽度、高度和元素不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await labelService.createTemplate(templateData, tenantId, userId);

      logger.info('创建标签模板成功', {
        templateId: result.id,
        templateName: templateData.name,
        tenantId,
      });

      res.json({
        success: true,
        message: '标签模板创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建标签模板失败', {
        error: error.message,
        stack: error.stack,
        templateName: req.body?.name,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: '模板名称已存在' });
      }

      res.status(500).json({ success: false, message: '创建标签模板失败', error: error.message });
    }
  }

  /**
   * 更新标签模板
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateTemplate(req, res) {
    try {
      const { id } = req.params;
      const templateData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const success = await labelService.updateTemplate(id, templateData, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '标签模板不存在' });
      }

      logger.info('更新标签模板成功', {
        templateId: id,
        templateName: templateData.name,
        tenantId,
      });

      res.json({ success: true, message: '标签模板更新成功' });
    } catch (error) {
      logger.error('更新标签模板失败', {
        error: error.message,
        stack: error.stack,
        templateId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '更新标签模板失败', error: error.message });
    }
  }

  /**
   * 删除标签模板
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deleteTemplate(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const success = await labelService.deleteTemplate(id, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '标签模板不存在' });
      }

      logger.info('删除标签模板成功', {
        templateId: id,
        tenantId,
      });

      res.json({ success: true, message: '标签模板删除成功' });
    } catch (error) {
      logger.error('删除标签模板失败', {
        error: error.message,
        stack: error.stack,
        templateId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '删除标签模板失败', error: error.message });
    }
  }

  /**
   * 生成ZPL标签
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async generateZPL(req, res) {
    try {
      const { templateId, assetCode } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!templateId || !assetCode) {
        return res.status(400).json({
          success: false,
          message: '模板ID和资产编码不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await labelService.generateZPL(templateId, assetCode, tenantId);

      logger.info('生成ZPL标签成功', {
        templateId,
        assetCode,
        tenantId,
      });

      res.json({
        success: true,
        message: 'ZPL生成成功',
        data: result,
      });
    } catch (error) {
      logger.error('生成ZPL标签失败', {
        error: error.message,
        stack: error.stack,
        templateId: req.params?.templateId,
        assetCode: req.params?.assetCode,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      if (error.message === '资产不存在') {
        return res.status(404).json({ success: false, message: '资产不存在' });
      }
      if (error.message === '标签模板不存在') {
        return res.status(404).json({ success: false, message: '标签模板不存在' });
      }

      res.status(500).json({ success: false, message: '生成ZPL标签失败', error: error.message });
    }
  }

  /**
   * 批量生成ZPL标签
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async generateZPLBatch(req, res) {
    try {
      const { asset_codes, template_id, quantity_per_asset = 1 } = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!asset_codes || !Array.isArray(asset_codes) || !template_id) {
        return res.status(400).json({
          success: false,
          message: '资产编码列表和模板ID不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await labelService.generateZPLBatch({
        assetCodes: asset_codes,
        templateId: template_id,
        quantityPerAsset: quantity_per_asset,
        tenantId,
      });

      logger.info('批量生成ZPL标签成功', {
        templateId: template_id,
        assetCount: asset_codes.length,
        quantityPerAsset: quantity_per_asset,
        tenantId,
      });

      res.json({
        success: true,
        message: 'ZPL批量生成成功',
        data: result,
      });
    } catch (error) {
      logger.error('批量生成ZPL标签失败', {
        error: error.message,
        stack: error.stack,
        templateId: req.body?.template_id,
        batchSize: Array.isArray(req.body?.asset_codes) ? req.body.asset_codes.length : 0,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '批量生成ZPL标签失败', error: error.message });
    }
  }

  /**
   * 打印标签
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async printLabel(req, res) {
    try {
      const { asset_code, template_id, printer_ip, printer_port = 9100, quantity = 1 } = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!asset_code || !template_id || !printer_ip) {
        return res.status(400).json({
          success: false,
          message: '资产编码、模板ID和打印机IP不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await labelService.printLabel({
        assetCode: asset_code,
        templateId: template_id,
        printerIp: printer_ip,
        printerPort: printer_port,
        quantity,
        tenantId,
      });

      logger.info('打印标签成功', {
        assetCode: asset_code,
        templateId: template_id,
        printerIp: printer_ip,
        quantity,
        tenantId,
      });

      res.json({
        success: true,
        message: '打印任务已发送',
        data: result,
      });
    } catch (error) {
      logger.error('打印标签失败', {
        error: error.message,
        stack: error.stack,
        assetCode: req.body?.asset_code,
        templateId: req.body?.template_id,
        printerIp: req.body?.printer_ip,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      if (error.message === '资产不存在') {
        return res.status(404).json({ success: false, message: '资产不存在' });
      }
      if (error.message === '标签模板不存在') {
        return res.status(404).json({ success: false, message: '标签模板不存在' });
      }

      res.status(500).json({ success: false, message: '打印标签失败', error: error.message });
    }
  }

  /**
   * 测试打印机连接
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async testPrinterConnection(req, res) {
    try {
      const { printer_ip, printer_port = 9100 } = req.body || {};

      if (!printer_ip) {
        return res.status(400).json({
          success: false,
          message: '打印机IP地址不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await labelService.testPrinterConnection(printer_ip, printer_port);

      res.json({
        success: true,
        message: '打印机连接测试成功',
        data: result,
      });
    } catch (error) {
      logger.error('测试打印机连接失败', {
        error: error.message,
        stack: error.stack,
        printerIp: req.body?.printer_ip,
        printerPort: req.body?.printer_port,
      });
      res.status(500).json({ success: false, message: '测试打印机连接失败', error: error.message });
    }
  }

  /**
   * 获取打印队列
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getPrintQueue(req, res) {
    try {
      const { status } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        logger.warn('获取打印队列缺少租户ID', { path: req.path, method: req.method });
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const queue = await labelService.getPrintQueue(status, tenantId);

      res.json({ success: true, data: queue });
    } catch (error) {
      logger.error('获取打印队列失败', {
        error: error.message,
        stack: error.stack,
        status: req.query?.status,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '获取打印队列失败', error: error.message });
    }
  }

  /**
   * 更新打印任务状态
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updatePrintQueueStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, error_message } = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!status) {
        return res.status(400).json({
          success: false,
          message: '状态不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await labelService.updatePrintQueueStatus(id, status, error_message, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '打印任务不存在' });
      }

      res.json({ success: true, message: '打印任务状态更新成功' });
    } catch (error) {
      logger.error('更新打印任务状态失败', {
        error: error.message,
        stack: error.stack,
        queueId: req.params?.id,
        status: req.body?.status,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '更新打印任务状态失败', error: error.message });
    }
  }
}

module.exports = new LabelController();
