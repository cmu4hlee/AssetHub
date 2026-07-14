/**
 * 预防性维护控制器
 */
const preventiveMaintenanceService = require('../services/preventive-maintenance.service');
const logger = require('../../../config/logger');

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class PreventiveMaintenanceController {
  // ==================== 维护计划管理 ====================

  /**
   * 获取维护计划列表
   */
  async getMaintenancePlans(req, res) {
    try {
      const { page, pageSize, keyword, assetCode, status } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await preventiveMaintenanceService.getMaintenancePlans({
        page,
        pageSize,
        keyword,
        assetCode,
        status,
        tenantId,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取维护计划列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取维护计划列表失败', error: error.message });
    }
  }

  /**
   * 获取维护计划详情
   */
  async getMaintenancePlan(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const plan = await preventiveMaintenanceService.getMaintenancePlan(id, tenantId);

      if (!plan) {
        return res.status(404).json({ success: false, message: '维护计划不存在' });
      }

      res.json({ success: true, data: plan });
    } catch (error) {
      logger.error('获取维护计划详情失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取维护计划详情失败', error: error.message });
    }
  }

  /**
   * 创建维护计划
   */
  async createMaintenancePlan(req, res) {
    try {
      const planData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await preventiveMaintenanceService.createMaintenancePlan(planData, tenantId);

      res.json({
        success: true,
        message: '维护计划创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建维护计划失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '创建维护计划失败' });
    }
  }

  /**
   * 更新维护计划
   */
  async updateMaintenancePlan(req, res) {
    try {
      const { id } = req.params;
      const planData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await preventiveMaintenanceService.updateMaintenancePlan(id, planData, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '维护计划不存在' });
      }

      res.json({ success: true, message: '维护计划更新成功' });
    } catch (error) {
      logger.error('更新维护计划失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '更新维护计划失败' });
    }
  }

  /**
   * 完成维护计划
   */
  async completeMaintenancePlan(req, res) {
    try {
      const { id } = req.params;
      const completionData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await preventiveMaintenanceService.completeMaintenancePlan(id, completionData, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '维护计划不存在' });
      }

      res.json({ success: true, message: '维护计划完成成功' });
    } catch (error) {
      logger.error('完成维护计划失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '完成维护计划失败' });
    }
  }

  /**
   * 获取维护计划历史
   */
  async getMaintenancePlanHistory(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const history = await preventiveMaintenanceService.getMaintenancePlanHistory(id, tenantId);

      res.json({ success: true, data: history });
    } catch (error) {
      logger.error('获取维护计划历史失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取维护计划历史失败', error: error.message });
    }
  }

  /**
   * 删除维护计划
   */
  async deleteMaintenancePlan(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await preventiveMaintenanceService.deleteMaintenancePlan(id, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '维护计划不存在' });
      }

      res.json({ success: true, message: '维护计划删除成功' });
    } catch (error) {
      logger.error('删除维护计划失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '删除维护计划失败', error: error.message });
    }
  }

  // ==================== 维护模板管理 ====================

  /**
   * 获取维护模板列表
   */
  async getMaintenanceTemplates(req, res) {
    try {
      const { page, pageSize, keyword } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await preventiveMaintenanceService.getMaintenanceTemplates({
        page,
        pageSize,
        keyword,
        tenantId,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取维护模板列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取维护模板列表失败', error: error.message });
    }
  }

  /**
   * 创建维护模板
   */
  async createMaintenanceTemplate(req, res) {
    try {
      const templateData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await preventiveMaintenanceService.createMaintenanceTemplate(templateData, tenantId);

      res.json({
        success: true,
        message: '维护模板创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建维护模板失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '创建维护模板失败' });
    }
  }

  /**
   * 更新维护模板
   */
  async updateMaintenanceTemplate(req, res) {
    try {
      const { id } = req.params;
      const templateData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await preventiveMaintenanceService.updateMaintenanceTemplate(id, templateData, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '维护模板不存在' });
      }

      res.json({ success: true, message: '维护模板更新成功' });
    } catch (error) {
      logger.error('更新维护模板失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '更新维护模板失败' });
    }
  }

  /**
   * 删除维护模板
   */
  async deleteMaintenanceTemplate(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await preventiveMaintenanceService.deleteMaintenanceTemplate(id, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '维护模板不存在' });
      }

      res.json({ success: true, message: '维护模板删除成功' });
    } catch (error) {
      logger.error('删除维护模板失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '删除维护模板失败', error: error.message });
    }
  }

  // ==================== 维护提醒管理 ====================

  /**
   * 获取维护提醒列表
   */
  async getMaintenanceReminders(req, res) {
    try {
      const { page, pageSize } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await preventiveMaintenanceService.getMaintenanceReminders({
        page,
        pageSize,
        tenantId,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取维护提醒列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取维护提醒列表失败', error: error.message });
    }
  }

  /**
   * 发送维护提醒
   */
  async sendMaintenanceReminder(req, res) {
    try {
      const reminderData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await preventiveMaintenanceService.sendMaintenanceReminder(reminderData, tenantId);

      res.json({
        success: true,
        message: '维护提醒发送成功',
        data: result,
      });
    } catch (error) {
      logger.error('发送维护提醒失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '发送维护提醒失败' });
    }
  }

  /**
   * 配置维护提醒
   */
  async configMaintenanceReminder(req, res) {
    try {
      const { id } = req.params;
      const configData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await preventiveMaintenanceService.configMaintenanceReminder(id, configData, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '维护提醒不存在' });
      }

      res.json({ success: true, message: '维护提醒配置成功' });
    } catch (error) {
      logger.error('配置维护提醒失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '配置维护提醒失败' });
    }
  }

  // ==================== 维护效率分析 ====================

  /**
   * 获取效率概览
   */
  async getEfficiencyOverview(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const overview = await preventiveMaintenanceService.getEfficiencyOverview({ startDate, endDate }, tenantId);

      res.json({ success: true, data: overview });
    } catch (error) {
      logger.error('获取效率概览失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取效率概览失败', error: error.message });
    }
  }
}

module.exports = new PreventiveMaintenanceController();
