/**
 * 折旧管理控制器
 */
const depreciationService = require('../services/depreciation.service');
const logger = require('../../../config/logger');

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

/**
 * 获取租户ID
 */
function getTenantId(req) {
  return req.user?.tenant_id || req.headers['x-tenant-id'] || null;
}

/**
 * 处理租户错误
 */
function handleTenantError(res, error) {
  if (error?.message === 'MISSING_TENANT_ID' || error?.message === 'INVALID_TENANT_ID') {
    res.status(400).json({
      success: false,
      message: '当前租户信息无效，请重新进入企业空间后重试',
      error: error.message,
    });
    return true;
  }
  return false;
}

/**
 * 日志记录折旧错误
 */
function logDepreciationError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: getTenantId(req),
    userId: req?.user?.id || null,
    username: req?.user?.username || null,
    userRole: req?.user?.role || null,
    ...context,
  });
}

class DepreciationController {
  /**
   * 获取折旧列表
   * GET /api/depreciation
   */
  async getDepreciationList(req, res) {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await depreciationService.getDepreciationList(req);

      res.json({
        success: true,
        data: result.assets,
        summary: result.summary,
        method: result.method,
        methodLabel: result.methodLabel,
        asOfDate: result.asOfDate,
        pagination: result.pagination,
      });
    } catch (error) {
      if (handleTenantError(res, error)) {
        return;
      }
      logDepreciationError('获取折旧数据失败', error, req, {
        page: req.query?.page || null,
        pageSize: req.query?.pageSize || null,
      });
      res.status(500).json({
        success: false,
        message: '获取折旧数据失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取折旧详情
   * GET /api/depreciation/:id
   */
  async getDepreciationDetail(req, res) {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const id = parseInt(req.params.id, 10);
      if (!id || id <= 0) {
        return res.status(400).json({
          success: false,
          message: '无效的资产ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await depreciationService.getDepreciationDetail(req, id);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: '资产不存在或无权限访问',
          errorType: ERROR_TYPES.NOT_FOUND,
        });
      }

      res.json({
        success: true,
        data: result.asset,
        depreciation: result.depreciation,
        method: result.method,
        methodLabel: result.methodLabel,
        asOfDate: result.asOfDate,
      });
    } catch (error) {
      if (handleTenantError(res, error)) {
        return;
      }
      logDepreciationError('获取资产折旧详情失败', error, req, {
        assetId: req.params?.id || null,
      });
      res.status(500).json({
        success: false,
        message: '获取资产折旧详情失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 按部门汇总
   * GET /api/depreciation/summary/by-department
   */
  async getSummaryByDepartment(req, res) {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await depreciationService.getSummaryByDepartment(req);

      res.json({
        success: true,
        data: result.summaries,
        method: result.method,
        methodLabel: result.methodLabel,
        asOfDate: result.asOfDate,
      });
    } catch (error) {
      if (handleTenantError(res, error)) {
        return;
      }
      logDepreciationError('获取部门折旧汇总失败', error, req);
      res.status(500).json({
        success: false,
        message: '获取部门折旧汇总失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 按类型汇总
   * GET /api/depreciation/summary/by-type
   */
  async getSummaryByType(req, res) {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await depreciationService.getSummaryByType(req);

      res.json({
        success: true,
        data: result.summaries,
        method: result.method,
        methodLabel: result.methodLabel,
        asOfDate: result.asOfDate,
      });
    } catch (error) {
      if (handleTenantError(res, error)) {
        return;
      }
      logDepreciationError('获取类型折旧汇总失败', error, req);
      res.status(500).json({
        success: false,
        message: '获取类型折旧汇总失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 按月份趋势
   * GET /api/depreciation/summary/by-month
   */
  async getSummaryByMonth(req, res) {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await depreciationService.getSummaryByMonth(req);

      res.json({
        success: true,
        data: {
          months: result.months,
          trend: result.trend,
        },
        method: result.method,
        methodLabel: result.methodLabel,
        asOfDate: result.asOfDate,
      });
    } catch (error) {
      if (handleTenantError(res, error)) {
        return;
      }
      logDepreciationError('获取月度折旧趋势失败', error, req, {
        months: req.query?.months || null,
      });
      res.status(500).json({
        success: false,
        message: '获取月度折旧趋势失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 计算折旧
   * POST /api/depreciation/calculate
   */
  async calculateDepreciation(req, res) {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const { assets } = req.body || {};
      if (!Array.isArray(assets)) {
        return res.status(400).json({
          success: false,
          message: '请提供有效的资产列表',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await depreciationService.calculateDepreciation(req);

      res.json({
        success: true,
        data: result.assets,
        summary: result.summary,
        method: result.method,
        methodLabel: result.methodLabel,
        asOfDate: result.asOfDate,
      });
    } catch (error) {
      logDepreciationError('计算折旧失败', error, req, {
        assetsCount: Array.isArray(req.body?.assets) ? req.body.assets.length : null,
      });
      res.status(500).json({
        success: false,
        message: '计算折旧失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 导出折旧数据
   * GET /api/depreciation/export
   */
  async exportDepreciation(req, res) {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await depreciationService.exportDepreciation(req);

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      if (handleTenantError(res, error)) {
        return;
      }
      logDepreciationError('导出折旧数据失败', error, req, {
        format: req.query?.format || 'csv',
      });
      res.status(500).json({
        success: false,
        message: '导出折旧数据失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取折旧方法列表
   * GET /api/depreciation/methods
   */
  getDepreciationMethods(req, res) {
    const methods = depreciationService.getDepreciationMethods();

    res.json({
      success: true,
      data: methods,
    });
  }
}

module.exports = new DepreciationController();
