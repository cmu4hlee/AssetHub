const uptimeService = require('../services/uptime.service');
const logger = require('../../../config/logger');

// 定义错误类型
const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class UptimeController {
  /**
   * 获取开机率统计列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getStatisticsList(req, res) {
    try {
      const { page = 1, pageSize = 20, period } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        logger.warn('获取开机率统计列表缺少租户ID', { path: req.path, method: req.method });
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      logger.info('获取开机率统计列表请求', {
        tenantId,
        page,
        pageSize,
        period,
      });

      const result = await uptimeService.getUptimeStatisticsList({
        tenantId,
        page,
        pageSize,
        period,
      });

      logger.info('获取开机率统计列表成功', {
        tenantId,
        count: result.data.length,
        total: result.pagination.total,
      });

      res.json({
        success: true,
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取开机率统计列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取开机率统计列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 创建开机率统计
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createStatistic(req, res) {
    try {
      const data = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      if (!data.asset_id) {
        return res.status(400).json({
          success: false,
          message: '资产ID不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      logger.info('创建设备开机率统计', {
        tenantId,
        assetId: data.asset_id,
        period: data.period,
      });

      const result = await uptimeService.createUptimeStatistic(data, tenantId);

      res.status(201).json({
        success: true,
        message: '创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建设备开机率统计失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '创建设备开机率统计失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 更新开机率统计
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateStatistic(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      logger.info('更新开机率统计', {
        tenantId,
        id,
      });

      const result = await uptimeService.updateUptimeStatistic(id, data, tenantId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.message,
        });
      }

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('更新开机率统计失败', {
        error: error.message,
        stack: error.stack,
        id: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '更新开机率统计失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 删除开机率统计
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deleteStatistic(req, res) {
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

      logger.info('删除开机率统计', {
        tenantId,
        id,
      });

      const result = await uptimeService.deleteUptimeStatistic(id, tenantId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.message,
        });
      }

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('删除开机率统计失败', {
        error: error.message,
        stack: error.stack,
        id: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '删除开机率统计失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 根据运行日志计算月度开机率
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async calculateFromLogs(req, res) {
    try {
      const { year, month } = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      logger.info('计算月度开机率', {
        tenantId,
        year,
        month,
      });

      const result = await uptimeService.calculateFromOperationLogs({ year, month }, tenantId);

      if (!result.success) {
        return res.status(409).json({
          success: false,
          message: result.message,
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: result.data,
        warning: result.warning,
      });
    } catch (error) {
      logger.error('计算月度开机率失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '计算月度开机率失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取仪表盘数据
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getDashboard(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      logger.info('获取开机率仪表盘数据', {
        tenantId,
      });

      const result = await uptimeService.getDashboard(tenantId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('获取开机率仪表盘数据失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取开机率仪表盘数据失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取开机率概览
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getOverview(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      logger.info('获取开机率概览', {
        tenantId,
      });

      const result = await uptimeService.getOverview(tenantId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('获取开机率概览失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取开机率概览失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }
}

module.exports = new UptimeController();
