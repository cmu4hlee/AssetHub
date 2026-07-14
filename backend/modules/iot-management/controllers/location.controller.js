const locationService = require('../services/location.service');
const logger = require('../../../config/logger');

// 定义错误类型
const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

function mapIngestError(error) {
  const message = error?.message || '位置上报失败';

  if (/租户|权限|不一致|无权/.test(message)) {
    return {
      status: 403,
      errorType: ERROR_TYPES.FORBIDDEN,
      message,
    };
  }

  if (/不存在|未关联|未找到|停用/.test(message)) {
    return {
      status: 404,
      errorType: ERROR_TYPES.NOT_FOUND,
      message,
    };
  }

  if (/不能为空|缺少|无效|非法|必须/.test(message)) {
    return {
      status: 400,
      errorType: ERROR_TYPES.VALIDATION_ERROR,
      message,
    };
  }

  return {
    status: 500,
    errorType: ERROR_TYPES.INTERNAL_ERROR,
    message: '位置上报失败',
  };
}

class LocationController {
  /**
   * 获取资产当前位置
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getAssetLocation(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      // 验证参数
      if (!assetCode) {
        logger.warn('获取资产位置缺少资产编码', { path: req.path, method: req.method });
        return res.status(400).json({
          success: false,
          message: '缺少资产编码',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      if (!tenantId) {
        logger.warn('获取资产位置缺少租户ID', { path: req.path, method: req.method });
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      logger.info('获取资产位置请求', { tenantId, assetCode });

      const location = await locationService.getAssetLocation(assetCode, tenantId);

      if (!location) {
        logger.info('资产位置信息不存在', { tenantId, assetCode });
        return res.json({ success: false, message: '该资产尚未配置位置信息', data: null });
      }

      logger.info('获取资产位置成功', { tenantId, assetCode });

      res.json({ success: true, data: location });
    } catch (error) {
      logger.error('获取资产位置失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
        assetCode: req.params.assetCode,
      });

      res.status(500).json({
        success: false,
        message: '获取资产位置失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 批量获取资产位置
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getBatchAssetLocations(req, res) {
    try {
      const { assetCodes } = req.body;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      if (!assetCodes || !Array.isArray(assetCodes) || assetCodes.length === 0) {
        return res.status(400).json({ success: false, message: '请提供资产编号列表' });
      }

      const locations = await locationService.getBatchAssetLocations(assetCodes, tenantId);

      res.json({ success: true, data: locations });
    } catch (error) {
      console.error('批量获取资产位置失败:', error);
      res
        .status(500)
        .json({ success: false, message: '批量获取资产位置失败', error: error.message });
    }
  }

  /**
   * 更新资产位置
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateAssetLocation(req, res) {
    try {
      const { assetCode } = req.params;
      const locationData = req.body;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      const result = await locationService.updateAssetLocation(assetCode, locationData, tenantId);

      res.json({
        success: true,
        message: '位置更新成功',
        data: result,
      });
    } catch (error) {
      console.error('更新资产位置失败:', error);
      res.status(500).json({ success: false, message: '更新资产位置失败', error: error.message });
    }
  }

  /**
   * 获取资产位置历史
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getAssetLocationHistory(req, res) {
    try {
      const { assetCode } = req.params;
      const { page = 1, pageSize = 20 } = req.query;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      const result = await locationService.getAssetLocationHistory(
        assetCode,
        tenantId,
        page,
        pageSize,
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error('获取位置历史失败:', error);
      res.status(500).json({ success: false, message: '获取位置历史失败', error: error.message });
    }
  }

  /**
   * 查询指定区域内的资产
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getAssetsInArea(req, res) {
    try {
      const areaParams = req.body;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      const assets = await locationService.getAssetsInArea(areaParams, tenantId);

      res.json({ success: true, data: assets });
    } catch (error) {
      console.error('查询区域资产失败:', error);
      res.status(500).json({ success: false, message: '查询区域资产失败', error: error.message });
    }
  }

  /**
   * 处理设备自动上报的位置数据
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async handleDeviceLocationReport(req, res) {
    try {
      const { deviceId } = req.params;
      const locationData = req.body;

      const result = await locationService.handleDeviceLocationReport(deviceId, locationData);

      res.json({
        success: true,
        message: '数据上报成功',
        data: result,
      });
    } catch (error) {
      const mappedError = mapIngestError(error);
      if (mappedError.status >= 500) {
        console.error('数据上报失败:', error);
      }
      res.status(mappedError.status).json({
        success: false,
        message: mappedError.message,
        error: error.message,
        errorType: mappedError.errorType,
      });
    }
  }

  /**
   * 处理信标设备的位置上报
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async handleBeaconLocationReport(req, res) {
    try {
      const { device_id, location_code } = req.body;

      if (!device_id) {
        return res.status(400).json({ success: false, message: '信标设备ID不能为空' });
      }

      if (!location_code) {
        return res.status(400).json({ success: false, message: '位置编号不能为空' });
      }

      const result = await locationService.handleBeaconLocationReport(device_id, location_code);

      res.json({
        success: true,
        message: '位置更新成功',
        data: result,
      });
    } catch (error) {
      const mappedError = mapIngestError(error);
      if (mappedError.status >= 500) {
        console.error('区域定位更新失败:', error);
      }
      res.status(mappedError.status).json({
        success: false,
        message: mappedError.message,
        error: error.message,
        errorType: mappedError.errorType,
      });
    }
  }
}

module.exports = new LocationController();
