/**
 * 风险控制控制器
 */
const riskControlService = require('../services/risk-control.service');
const logger = require('../../../config/logger');

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class RiskControlController {
  /**
   * 获取风险控制措施列表
   */
  async getRiskControls(req, res) {
    try {
      const { page, pageSize, keyword, riskLevel, status } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await riskControlService.getRiskControls({
        page,
        pageSize,
        keyword,
        riskLevel,
        status,
        tenantId,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取风险控制措施列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取风险控制措施列表失败', error: error.message });
    }
  }

  /**
   * 获取风险控制措施详情
   */
  async getRiskControlById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const control = await riskControlService.getRiskControlById(id, tenantId);

      if (!control) {
        return res.status(404).json({ success: false, message: '风险控制措施不存在' });
      }

      res.json({ success: true, data: control });
    } catch (error) {
      logger.error('获取风险控制措施详情失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取风险控制措施详情失败', error: error.message });
    }
  }

  /**
   * 创建风险控制措施
   */
  async createRiskControl(req, res) {
    try {
      const controlData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await riskControlService.createRiskControl(controlData, tenantId);

      res.json({
        success: true,
        message: '风险控制措施创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建风险控制措施失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '创建风险控制措施失败' });
    }
  }

  /**
   * 更新风险控制措施
   */
  async updateRiskControl(req, res) {
    try {
      const { id } = req.params;
      const controlData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await riskControlService.updateRiskControl(id, controlData, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '风险控制措施不存在' });
      }

      res.json({ success: true, message: '风险控制措施更新成功' });
    } catch (error) {
      logger.error('更新风险控制措施失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '更新风险控制措施失败' });
    }
  }

  /**
   * 删除风险控制措施
   */
  async deleteRiskControl(req, res) {
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

      const success = await riskControlService.deleteRiskControl(id, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '风险控制措施不存在' });
      }

      res.json({ success: true, message: '风险控制措施删除成功' });
    } catch (error) {
      logger.error('删除风险控制措施失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '删除风险控制措施失败', error: error.message });
    }
  }

  /**
   * 获取高风险资产列表
   */
  async getHighRiskAssets(req, res) {
    try {
      const { threshold } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const assets = await riskControlService.getHighRiskAssets({ threshold }, tenantId);

      res.json({ success: true, data: assets });
    } catch (error) {
      logger.error('获取高风险资产列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取高风险资产列表失败', error: error.message });
    }
  }
}

module.exports = new RiskControlController();
