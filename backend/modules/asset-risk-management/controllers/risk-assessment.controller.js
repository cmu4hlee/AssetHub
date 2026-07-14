/**
 * 风险评估控制器
 */
const riskAssessmentService = require('../services/risk-assessment.service');
const logger = require('../../../config/logger');

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class RiskAssessmentController {
  /**
   * 获取风险评估列表
   */
  async getRiskAssessments(req, res) {
    try {
      const { page, pageSize, keyword, riskLevel, assetCode } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await riskAssessmentService.getRiskAssessments({
        page,
        pageSize,
        keyword,
        riskLevel,
        assetCode,
        tenantId,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取风险评估列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取风险评估列表失败', error: error.message });
    }
  }

  /**
   * 获取风险评估详情
   */
  async getRiskAssessmentById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const assessment = await riskAssessmentService.getRiskAssessmentById(id, tenantId);

      if (!assessment) {
        return res.status(404).json({ success: false, message: '风险评估不存在' });
      }

      res.json({ success: true, data: assessment });
    } catch (error) {
      logger.error('获取风险评估详情失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取风险评估详情失败', error: error.message });
    }
  }

  /**
   * 创建风险评估
   */
  async createRiskAssessment(req, res) {
    try {
      const assessmentData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await riskAssessmentService.createRiskAssessment(assessmentData, tenantId);

      res.json({
        success: true,
        message: '风险评估创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建风险评估失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '创建风险评估失败' });
    }
  }

  /**
   * 更新风险评估
   */
  async updateRiskAssessment(req, res) {
    try {
      const { id } = req.params;
      const assessmentData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await riskAssessmentService.updateRiskAssessment(id, assessmentData, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '风险评估不存在' });
      }

      res.json({ success: true, message: '风险评估更新成功' });
    } catch (error) {
      logger.error('更新风险评估失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '更新风险评估失败' });
    }
  }

  /**
   * 删除风险评估
   */
  async deleteRiskAssessment(req, res) {
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

      const success = await riskAssessmentService.deleteRiskAssessment(id, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '风险评估不存在' });
      }

      res.json({ success: true, message: '风险评估删除成功' });
    } catch (error) {
      logger.error('删除风险评估失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '删除风险评估失败', error: error.message });
    }
  }
}

module.exports = new RiskAssessmentController();
