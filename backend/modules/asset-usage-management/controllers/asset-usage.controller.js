/**
 * 资产使用管理控制器
 */
const assetUsageService = require('../services/asset-usage.service');
const logger = require('../../../config/logger');

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class AssetUsageController {
  /**
   * 获取使用记录列表
   */
  async getUsageRecords(req, res) {
    try {
      const { page, pageSize, keyword, assetCode } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await assetUsageService.getUsageRecords({
        page,
        pageSize,
        keyword,
        assetCode,
        tenantId,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取使用记录列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取使用记录列表失败', error: error.message });
    }
  }

  /**
   * 获取使用记录详情
   */
  async getUsageRecordById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const record = await assetUsageService.getUsageRecordById(id, tenantId);

      if (!record) {
        return res.status(404).json({ success: false, message: '使用记录不存在' });
      }

      res.json({ success: true, data: record });
    } catch (error) {
      logger.error('获取使用记录详情失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取使用记录详情失败', error: error.message });
    }
  }

  /**
   * 借出资产
   */
  async checkoutAsset(req, res) {
    try {
      const usageData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await assetUsageService.checkoutAsset(usageData, tenantId);

      res.json({
        success: true,
        message: '资产借出成功',
        data: result,
      });
    } catch (error) {
      logger.error('借出资产失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '借出资产失败' });
    }
  }

  /**
   * 归还资产
   */
  async returnAsset(req, res) {
    try {
      const { id } = req.params;
      const returnData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await assetUsageService.returnAsset(id, returnData, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '使用记录不存在' });
      }

      res.json({ success: true, message: '资产归还成功' });
    } catch (error) {
      logger.error('归还资产失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '归还资产失败' });
    }
  }

  /**
   * 获取资产使用状态
   */
  async getAssetUsageStatus(req, res) {
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

      const status = await assetUsageService.getAssetUsageStatus(assetCode, tenantId);

      res.json({ success: true, data: status });
    } catch (error) {
      logger.error('获取资产使用状态失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取资产使用状态失败', error: error.message });
    }
  }

  /**
   * 获取使用统计
   */
  async getUsageStatistics(req, res) {
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

      const statistics = await assetUsageService.getUsageStatistics({ startDate, endDate }, tenantId);

      res.json({ success: true, data: statistics });
    } catch (error) {
      logger.error('获取使用统计失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取使用统计失败', error: error.message });
    }
  }

  /**
   * 获取用户的使用记录
   */
  async getUserUsageRecords(req, res) {
    try {
      const { userId } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const records = await assetUsageService.getUserUsageRecords(userId, tenantId);

      res.json({ success: true, data: records });
    } catch (error) {
      logger.error('获取用户使用记录失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取用户使用记录失败', error: error.message });
    }
  }
}

module.exports = new AssetUsageController();
