/**
 * 资产AI助手控制器
 */
const assetAIAssistantService = require('../services/asset-ai-assistant.service');
const logger = require('../../../config/logger');

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class AssetAIAssistantController {
  /**
   * 获取AI助手配置
   */
  async getAssistantConfig(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const config = await assetAIAssistantService.getAssistantConfig(tenantId);

      res.json({ success: true, data: config });
    } catch (error) {
      logger.error('获取AI助手配置失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取AI助手配置失败', error: error.message });
    }
  }

  /**
   * 更新AI助手配置
   */
  async updateAssistantConfig(req, res) {
    try {
      const configData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await assetAIAssistantService.updateAssistantConfig(configData, tenantId);

      res.json({
        success: true,
        message: 'AI助手配置更新成功',
        data: result,
      });
    } catch (error) {
      logger.error('更新AI助手配置失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '更新AI助手配置失败' });
    }
  }

  /**
   * 创建会话
   */
  async createSession(req, res) {
    try {
      const sessionData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await assetAIAssistantService.createSession(sessionData, tenantId);

      res.json({
        success: true,
        message: '会话创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建会话失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '创建会话失败' });
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(req, res) {
    try {
      const messageData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await assetAIAssistantService.sendMessage(messageData, tenantId);

      res.json({
        success: true,
        message: '消息发送成功',
        data: result,
      });
    } catch (error) {
      logger.error('发送消息失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '发送消息失败' });
    }
  }

  /**
   * 获取会话历史
   */
  async getSessionHistory(req, res) {
    try {
      const { sessionId } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const history = await assetAIAssistantService.getSessionHistory(sessionId, tenantId);

      res.json({ success: true, data: history });
    } catch (error) {
      logger.error('获取会话历史失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取会话历史失败', error: error.message });
    }
  }

  /**
   * 关闭会话
   */
  async closeSession(req, res) {
    try {
      const { sessionId } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await assetAIAssistantService.closeSession(sessionId, tenantId);

      res.json({ success: true, message: '会话已关闭' });
    } catch (error) {
      logger.error('关闭会话失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '关闭会话失败', error: error.message });
    }
  }

  /**
   * 获取助手状态
   */
  async getAssistantStatus(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const status = await assetAIAssistantService.getAssistantStatus(tenantId);

      res.json({ success: true, data: status });
    } catch (error) {
      logger.error('获取助手状态失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取助手状态失败', error: error.message });
    }
  }
}

module.exports = new AssetAIAssistantController();
