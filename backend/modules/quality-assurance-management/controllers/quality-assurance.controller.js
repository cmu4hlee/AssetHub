/**
 * 质控管理控制器
 */
const qualityAssuranceService = require('../services/quality-assurance.service');
const logger = require('../../../config/logger');

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class QualityAssuranceController {
  /**
   * 获取质控记录列表
   */
  async getQualityControlList(req, res) {
    try {
      const { page, pageSize, keyword, assetCode, status, startDate, endDate } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await qualityAssuranceService.getQualityControlList({
        page,
        pageSize,
        keyword,
        assetCode,
        status,
        startDate,
        endDate,
        tenantId,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取质控记录列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取质控记录列表失败', error: error.message });
    }
  }

  /**
   * 获取质控记录详情
   */
  async getQualityControlById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const record = await qualityAssuranceService.getQualityControlById(id, tenantId);

      if (!record) {
        return res.status(404).json({ success: false, message: '质控记录不存在' });
      }

      res.json({ success: true, data: record });
    } catch (error) {
      logger.error('获取质控记录详情失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取质控记录详情失败', error: error.message });
    }
  }

  /**
   * 创建质控记录
   */
  async createQualityControl(req, res) {
    try {
      const qcData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await qualityAssuranceService.createQualityControl(qcData, tenantId);

      res.json({
        success: true,
        message: '质控记录创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建质控记录失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '创建质控记录失败' });
    }
  }

  /**
   * 更新质控记录
   */
  async updateQualityControl(req, res) {
    try {
      const { id } = req.params;
      const qcData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await qualityAssuranceService.updateQualityControl(id, qcData, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '质控记录不存在' });
      }

      res.json({ success: true, message: '质控记录更新成功' });
    } catch (error) {
      logger.error('更新质控记录失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '更新质控记录失败' });
    }
  }

  /**
   * 删除质控记录
   */
  async deleteQualityControl(req, res) {
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

      const success = await qualityAssuranceService.deleteQualityControl(id, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '质控记录不存在' });
      }

      res.json({ success: true, message: '质控记录删除成功' });
    } catch (error) {
      logger.error('删除质控记录失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '删除质控记录失败', error: error.message });
    }
  }

  /**
   * 获取即将到期的质控记录
   */
  async getExpiringQualityControl(req, res) {
    try {
      const { days } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const records = await qualityAssuranceService.getExpiringQualityControl({ days }, tenantId);

      res.json({ success: true, data: records });
    } catch (error) {
      logger.error('获取即将到期质控记录失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取即将到期质控记录失败', error: error.message });
    }
  }

  /**
   * 获取质控统计数据
   */
  async getQualityControlStatistics(req, res) {
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

      const statistics = await qualityAssuranceService.getQualityControlStatistics({ startDate, endDate }, tenantId);

      res.json({ success: true, data: statistics });
    } catch (error) {
      logger.error('获取质控统计数据失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取质控统计数据失败', error: error.message });
    }
  }

  /**
   * 获取资产的质控历史
   */
  async getAssetQualityHistory(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const history = await qualityAssuranceService.getAssetQualityHistory(assetCode, tenantId);

      res.json({ success: true, data: history });
    } catch (error) {
      logger.error('获取资产质控历史失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取资产质控历史失败', error: error.message });
    }
  }

  /**
   * 分析质量趋势
   */
  async analyzeQualityTrend(req, res) {
    try {
      const { startDate, endDate, interval } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const trend = await qualityAssuranceService.analyzeQualityTrend({ startDate, endDate, interval }, tenantId);

      res.json({ success: true, data: trend });
    } catch (error) {
      logger.error('分析质量趋势失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '分析质量趋势失败', error: error.message });
    }
  }

  /**
   * 分析缺陷分布
   */
  async analyzeDefectDistribution(req, res) {
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

      const distribution = await qualityAssuranceService.analyzeDefectDistribution({ startDate, endDate }, tenantId);

      res.json({ success: true, data: distribution });
    } catch (error) {
      logger.error('分析缺陷分布失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '分析缺陷分布失败', error: error.message });
    }
  }

  /**
   * 生成质量报告
   */
  async generateQualityReport(req, res) {
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

      const [statistics, trend, distribution] = await Promise.all([
        qualityAssuranceService.getQualityControlStatistics({ startDate, endDate }, tenantId),
        qualityAssuranceService.analyzeQualityTrend({ startDate, endDate }, tenantId),
        qualityAssuranceService.analyzeDefectDistribution({ startDate, endDate }, tenantId),
      ]);

      res.json({
        success: true,
        data: {
          statistics,
          trend,
          distribution,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('生成质量报告失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '生成质量报告失败', error: error.message });
    }
  }
}

module.exports = new QualityAssuranceController();
