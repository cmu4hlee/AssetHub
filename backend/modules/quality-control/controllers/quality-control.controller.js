const qualityControlService = require('../services/quality-control.service');
const logger = require('../../../config/logger');

// 定义错误类型
const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class QualityControlController {
  /**
   * 获取质量控制记录列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getQualityControlRecords(req, res) {
    try {
      const { page = 1, pageSize = 10, keyword, qc_type, result, status, start_date, end_date } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        logger.warn('获取质量控制记录列表缺少租户ID', { path: req.path, method: req.method });
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      logger.info('获取质量控制记录列表请求', {
        tenantId,
        page,
        pageSize,
        keyword,
        qc_type,
        result,
        status,
      });

      const resultData = await qualityControlService.getQualityControlRecords({
        page,
        pageSize,
        keyword,
        qc_type,
        result,
        status,
        start_date,
        end_date,
      }, tenantId);

      logger.info('获取质量控制记录列表成功', {
        tenantId,
        count: resultData.data.length,
        total: resultData.pagination.total,
      });

      res.json({
        success: true,
        data: resultData.data,
        pagination: resultData.pagination,
      });
    } catch (error) {
      logger.error('获取质量控制记录列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取质量控制记录列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取质量控制记录详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getQualityControlRecordById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const record = await qualityControlService.getQualityControlRecordById(id, tenantId);

      if (!record) {
        return res.status(404).json({ success: false, message: '质量控制记录不存在' });
      }

      res.json({ success: true, data: record });
    } catch (error) {
      logger.error('获取质量控制记录详情失败', {
        error: error.message,
        stack: error.stack,
        recordId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '获取质量控制记录详情失败', error: error.message });
    }
  }

  /**
   * 创建质量控制记录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createQualityControlRecord(req, res) {
    try {
      const recordData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const createdBy = req.user?.username || 'system';

      if (!recordData.asset_code || !recordData.qc_type || !recordData.qc_date || !recordData.qc_item || !recordData.result) {
        return res.status(400).json({
          success: false,
          message: '资产编号、质控类型、质控日期、质控项目和质控结果不能为空',
        });
      }

      const resultData = await qualityControlService.createQualityControlRecord(recordData, tenantId, createdBy);

      res.json({
        success: true,
        message: '质量控制记录创建成功',
        data: resultData,
      });
    } catch (error) {
      logger.error('创建质量控制记录失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || '创建质量控制记录失败',
        error: error.message,
      });
    }
  }

  /**
   * 更新质量控制记录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateQualityControlRecord(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const updatedBy = req.user?.username || 'system';

      const result = await qualityControlService.updateQualityControlRecord(id, updateData, tenantId, updatedBy);

      res.json({
        success: true,
        message: '质量控制记录更新成功',
        data: result,
      });
    } catch (error) {
      logger.error('更新质量控制记录失败', {
        error: error.message,
        stack: error.stack,
        recordId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || '更新质量控制记录失败',
        error: error.message,
      });
    }
  }

  /**
   * 删除质量控制记录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deleteQualityControlRecord(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const result = await qualityControlService.deleteQualityControlRecord(id, tenantId);

      res.json({
        success: true,
        message: '质量控制记录删除成功',
        data: result,
      });
    } catch (error) {
      logger.error('删除质量控制记录失败', {
        error: error.message,
        stack: error.stack,
        recordId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || '删除质量控制记录失败',
        error: error.message,
      });
    }
  }

  /**
   * 获取质量控制统计
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getQualityControlStatistics(req, res) {
    try {
      const { start_date, end_date } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const result = await qualityControlService.getQualityControlStatistics({ start_date, end_date }, tenantId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('获取质量控制统计失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || '获取质量控制统计失败',
        error: error.message,
      });
    }
  }

  /**
   * 获取高级质量控制统计
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getAdvancedQualityControlStatistics(req, res) {
    try {
      const { start_date, end_date } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const result = await qualityControlService.getAdvancedQualityControlStatistics({ start_date, end_date }, tenantId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('获取高级质量控制统计失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || '获取高级质量控制统计失败',
        error: error.message,
      });
    }
  }

  /**
   * 获取即将到期质控记录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getExpiringQualityControlRecords(req, res) {
    try {
      const { days = 30 } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const result = await qualityControlService.getExpiringQualityControlRecords({ days }, tenantId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('获取即将到期质控记录失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || '获取即将到期质控记录失败',
        error: error.message,
      });
    }
  }

  /**
   * 获取资产质量管理历史
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getAssetQualityHistory(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const history = await qualityControlService.getAssetQualityHistory(assetCode, tenantId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      logger.error('获取资产质量管理历史失败', {
        error: error.message,
        stack: error.stack,
        assetCode: req.params?.assetCode,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || '获取资产质量管理历史失败',
        error: error.message,
      });
    }
  }
}

module.exports = new QualityControlController();
