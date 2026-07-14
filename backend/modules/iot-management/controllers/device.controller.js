const deviceService = require('../services/device.service');
const db = require('../../../config/database');
const logger = require('../../../config/logger');

// 定义错误类型
const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class DeviceController {
  /**
   * 获取设备列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getDevices(req, res) {
    try {
      const { page, pageSize, keyword, device_type, status } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      // 验证租户ID
      if (!tenantId) {
        logger.warn('获取设备列表缺少租户ID', { path: req.path, method: req.method });
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      logger.info('获取设备列表请求', {
        tenantId,
        page,
        pageSize,
        keyword,
        device_type,
        status,
      });

      const result = await deviceService.getDevices({
        page,
        pageSize,
        keyword,
        device_type,
        status,
        tenantId,
      });

      logger.info('获取设备列表成功', {
        tenantId,
        count: result.data.length,
        total: result.pagination.total,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取设备列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取设备列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取设备详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getDeviceById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      const device = await deviceService.getDeviceById(id, tenantId);

      if (!device) {
        return res.status(404).json({ success: false, message: '设备不存在' });
      }

      res.json({ success: true, data: device });
    } catch (error) {
      logger.error('获取设备详情失败', {
        error: error.message,
        stack: error.stack,
        deviceId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '获取设备详情失败', error: error.message });
    }
  }

  /**
   * 创建设备
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createDevice(req, res) {
    try {
      const deviceData = req.body;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      if (!deviceData.device_id || !deviceData.device_name || !deviceData.device_type) {
        return res.status(400).json({ success: false, message: '设备ID、名称和类型不能为空' });
      }

      const result = await deviceService.createDevice(deviceData, tenantId);

      res.json({
        success: true,
        message: '设备创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建设备失败', {
        error: error.message,
        stack: error.stack,
        deviceId: req.body?.device_id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: '设备ID已存在' });
      }
      res.status(500).json({ success: false, message: '创建设备失败', error: error.message });
    }
  }

  /**
   * 更新设备
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateDevice(req, res) {
    try {
      const { id } = req.params;
      const deviceData = req.body;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      const success = await deviceService.updateDevice(id, deviceData, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '设备不存在' });
      }

      res.json({ success: true, message: '设备更新成功' });
    } catch (error) {
      logger.error('更新设备失败', {
        error: error.message,
        stack: error.stack,
        deviceId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '更新设备失败', error: error.message });
    }
  }

  /**
   * 删除设备
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deleteDevice(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      const success = await deviceService.deleteDevice(id, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '设备不存在' });
      }

      res.json({ success: true, message: '设备删除成功' });
    } catch (error) {
      logger.error('删除设备失败', {
        error: error.message,
        stack: error.stack,
        deviceId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '删除设备失败', error: error.message });
    }
  }

  /**
   * 关联设备到资产
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async linkDeviceToAsset(req, res) {
    try {
      const { assetCode } = req.params;
      const { device_id, device_type } = req.body;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      if (!device_id || !device_type) {
        return res.status(400).json({ success: false, message: '设备ID和类型不能为空' });
      }

      await deviceService.linkDeviceToAsset(assetCode, device_id, device_type, tenantId);

      res.json({ success: true, message: '设备关联成功' });
    } catch (error) {
      logger.error('关联设备失败', {
        error: error.message,
        stack: error.stack,
        assetCode: req.params?.assetCode,
        deviceId: req.body?.device_id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '关联设备失败', error: error.message });
    }
  }

  /**
   * 解绑设备
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async unlinkDeviceFromAsset(req, res) {
    try {
      const { assetCode } = req.params;
      const { device_id } = req.body;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      if (!device_id) {
        return res.status(400).json({ success: false, message: '设备ID不能为空' });
      }

      const success = await deviceService.unlinkDeviceFromAsset(assetCode, device_id, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '设备或资产不存在' });
      }

      res.json({ success: true, message: '设备解绑成功' });
    } catch (error) {
      logger.error('解绑设备失败', {
        error: error.message,
        stack: error.stack,
        assetCode: req.params?.assetCode,
        deviceId: req.body?.device_id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '解绑设备失败', error: error.message });
    }
  }

  /**
   * 获取资产的关联设备
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getAssetDevices(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      // 这里可以扩展实现，获取资产的关联设备列表
      const [rows] = await db.execute(
        `SELECT d.*, al.last_update_time as linked_time
         FROM asset_locations al
         LEFT JOIN iot_devices d ON al.device_id = d.device_id AND d.tenant_id = al.tenant_id
         WHERE al.asset_code = ? AND al.is_active = 1 AND al.device_id IS NOT NULL AND al.tenant_id = ?`,
        [assetCode, tenantId],
      );

      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error('获取资产设备失败', {
        error: error.message,
        stack: error.stack,
        assetCode: req.params?.assetCode,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '获取资产设备失败', error: error.message });
    }
  }

  /**
   * 获取设备的关联资产
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getDeviceAssets(req, res) {
    try {
      const { deviceId } = req.params;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      // 这里可以扩展实现，获取设备的关联资产列表
      const [rows] = await db.execute(
        `SELECT a.id as asset_id, a.asset_code, a.asset_name, al.last_update_time
         FROM asset_locations al
         LEFT JOIN assets a ON al.asset_code = a.asset_code AND a.tenant_id = al.tenant_id
         WHERE al.device_id = ? AND al.is_active = 1 AND al.tenant_id = ?`,
        [deviceId, tenantId],
      );

      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error('获取设备资产失败', {
        error: error.message,
        stack: error.stack,
        deviceId: req.params?.deviceId,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '获取设备资产失败', error: error.message });
    }
  }
}

module.exports = new DeviceController();
