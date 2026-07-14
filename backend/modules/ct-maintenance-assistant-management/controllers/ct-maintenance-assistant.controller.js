/**
 * CT维护助手控制器
 */
const ctMaintenanceAssistantService = require('../services/ct-maintenance-assistant.service');
const logger = require('../../../config/logger');

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class CTMaintenanceAssistantController {
  /**
   * 获取CT维护助手配置
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

      const config = await ctMaintenanceAssistantService.getAssistantConfig(tenantId);

      res.json({ success: true, data: config });
    } catch (error) {
      logger.error('获取CT维护助手配置失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取CT维护助手配置失败', error: error.message });
    }
  }

  /**
   * 更新CT维护助手配置
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

      const result = await ctMaintenanceAssistantService.updateAssistantConfig(configData, tenantId);

      res.json({
        success: true,
        message: 'CT维护助手配置更新成功',
        data: result,
      });
    } catch (error) {
      logger.error('更新CT维护助手配置失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '更新CT维护助手配置失败' });
    }
  }

  /**
   * 知识问答
   */
  async knowledgeQuery(req, res) {
    try {
      const queryData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await ctMaintenanceAssistantService.knowledgeQuery(queryData, tenantId);

      res.json({
        success: true,
        message: '查询成功',
        data: result,
      });
    } catch (error) {
      logger.error('知识问答失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '知识问答失败' });
    }
  }

  /**
   * 维修建议
   */
  async maintenanceAdvice(req, res) {
    try {
      const maintenanceData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await ctMaintenanceAssistantService.maintenanceAdvice(maintenanceData, tenantId);

      res.json({
        success: true,
        message: '维修建议生成成功',
        data: result,
      });
    } catch (error) {
      logger.error('维修建议失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '维修建议失败' });
    }
  }

  /**
   * 排障指导
   */
  async troubleshootingGuide(req, res) {
    try {
      const troubleshootingData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await ctMaintenanceAssistantService.troubleshootingGuide(troubleshootingData, tenantId);

      res.json({
        success: true,
        message: '排障指导生成成功',
        data: result,
      });
    } catch (error) {
      logger.error('排障指导失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '排障指导失败' });
    }
  }

  /**
   * 巡检清单
   */
  async getInspectionChecklist(req, res) {
    try {
      const checklistData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await ctMaintenanceAssistantService.getInspectionChecklist(checklistData, tenantId);

      res.json({
        success: true,
        message: '巡检清单获取成功',
        data: result,
      });
    } catch (error) {
      logger.error('获取巡检清单失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '获取巡检清单失败' });
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

      const status = await ctMaintenanceAssistantService.getAssistantStatus(tenantId);

      res.json({ success: true, data: status });
    } catch (error) {
      logger.error('获取助手状态失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取助手状态失败', error: error.message });
    }
  }
}

module.exports = new CTMaintenanceAssistantController();
