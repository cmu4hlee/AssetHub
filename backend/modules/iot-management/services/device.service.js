const db = require('../../../config/database');
const { redis } = require('../../../services/redis');
const logger = require('../../../config/logger');
const CACHE_TTL = 300; // 缓存过期时间（秒）

const buildTenantScopedClause = (tenantId, alias = '') => {
  if (!tenantId) {
    return { clause: '', params: [] };
  }

  const prefix = alias ? `${alias}.` : '';
  return {
    clause: ` AND ${prefix}tenant_id = ?`,
    params: [tenantId],
  };
};

const DEVICE_ASSET_LOCATION_JOIN =
  'LEFT JOIN asset_locations al ON d.device_id = al.device_id AND al.is_active = 1 AND al.tenant_id = d.tenant_id';
const DEVICE_ASSET_JOIN =
  'LEFT JOIN assets a ON al.asset_code = a.asset_code AND a.tenant_id = al.tenant_id';

class DeviceService {
  /**
   * 获取设备列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页大小
   * @param {string} params.keyword - 关键词
   * @param {string} params.device_type - 设备类型
   * @param {string} params.status - 设备状态
   * @param {string} params.tenantId - 租户ID
   * @returns {Promise<Object>} 设备列表和分页信息
   */
  async getDevices(params) {
    const { page = 1, pageSize = 20, keyword, device_type, status, tenantId } = params;

    // 生成缓存键
    const cacheKey = `devices:${tenantId}:${page}:${pageSize}:${keyword || ''}:${device_type || ''}:${status || ''}`;

    try {
      // 尝试从缓存获取
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (error) {
      logger.warn('Redis缓存读取失败', {
        error: error.message,
        tenantId,
        cacheKey,
      });
      // 缓存失败不影响主流程，继续执行数据库查询
    }

    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE d.tenant_id = ?';
    const queryParams = [tenantId];

    if (keyword) {
      whereClause += ' AND (d.device_id LIKE ? OR d.device_name LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (device_type) {
      whereClause += ' AND d.device_type = ?';
      queryParams.push(device_type);
    }

    if (status) {
      whereClause += ' AND d.status = ?';
      queryParams.push(status);
    }

    // 获取总数
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM iot_devices d ${whereClause}`,
      queryParams,
    );
    const { total } = countRows[0];

    // 获取数据，同时查询关联的资产信息
    const [rows] = await db.execute(
      `SELECT
        d.*,
        al.asset_code as linked_asset_code,
        a.asset_code,
        a.asset_name
       FROM iot_devices d
       ${DEVICE_ASSET_LOCATION_JOIN}
       ${DEVICE_ASSET_JOIN}
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(pageSize), offset],
    );

    const result = {
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };

    try {
      // 缓存结果
      await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
    } catch (error) {
      logger.warn('Redis缓存写入失败', {
        error: error.message,
        tenantId,
        cacheKey,
      });
      // 缓存失败不影响主流程
    }

    return result;
  }

  /**
   * 获取设备详情
   * @param {number} id - 设备ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 设备详情
   */
  async getDeviceById(id, tenantId) {
    const [rows] = await db.execute(
      'SELECT d.* FROM iot_devices d WHERE d.id = ? AND d.tenant_id = ?',
      [id, tenantId],
    );

    if (rows.length === 0) {
      return null;
    }

    // 获取关联的资产信息
    const locationTenantScope = buildTenantScopedClause(tenantId, 'al');
    const [assets] = await db.execute(
      `SELECT a.id, a.asset_code, a.asset_name, al.device_id, al.last_update_time
       FROM asset_locations al
       ${DEVICE_ASSET_JOIN}
       WHERE al.device_id = ? AND al.is_active = 1${locationTenantScope.clause}`,
      [rows[0].device_id, ...locationTenantScope.params],
    );

    return {
      ...rows[0],
      linked_assets: assets,
    };
  }

  /**
   * 创建设备
   * @param {Object} deviceData - 设备数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createDevice(deviceData, tenantId) {
    const {
      device_id,
      device_name,
      device_type,
      manufacturer,
      model,
      serial_number,
      mac_address,
      firmware_version,
      status = '离线',
      remark,
    } = deviceData;

    // 验证设备类型是否有效
    const validDeviceTypes = ['RFID', 'GPS', '蓝牙', 'WiFi', 'UWB', '其他'];
    if (!validDeviceTypes.includes(device_type)) {
      throw new Error(`设备类型无效，必须是以下之一：${validDeviceTypes.join('、')}`);
    }

    // 验证状态是否有效
    const validStatuses = ['在线', '离线', '故障', '维护中'];
    if (status && !validStatuses.includes(status)) {
      throw new Error(`设备状态无效，必须是以下之一：${validStatuses.join('、')}`);
    }

    // 检查设备ID是否已存在
    const [existing] = await db.execute(
      'SELECT id FROM iot_devices WHERE device_id = ? AND tenant_id = ?',
      [device_id, tenantId],
    );

    if (existing.length > 0) {
      throw new Error('设备ID已存在');
    }

    const [result] = await db.execute(
      `INSERT INTO iot_devices (
        tenant_id, device_id, device_name, device_type, manufacturer, model,
        serial_number, mac_address, firmware_version, status, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        device_id,
        device_name,
        device_type,
        manufacturer || null,
        model || null,
        serial_number || null,
        mac_address || null,
        firmware_version || null,
        status || '离线',
        remark || null,
      ],
    );

    return { id: result.insertId };
  }

  /**
   * 更新设备
   * @param {number} id - 设备ID
   * @param {Object} deviceData - 设备数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 更新结果
   */
  async updateDevice(id, deviceData, tenantId) {
    const {
      device_name,
      device_type,
      manufacturer,
      model,
      serial_number,
      mac_address,
      firmware_version,
      status,
      remark,
    } = deviceData;

    const updateFields = [];
    const updateValues = [];

    if (device_name !== undefined) {
      updateFields.push('device_name = ?');
      updateValues.push(device_name);
    }
    if (device_type !== undefined) {
      updateFields.push('device_type = ?');
      updateValues.push(device_type);
    }
    if (manufacturer !== undefined) {
      updateFields.push('manufacturer = ?');
      updateValues.push(manufacturer);
    }
    if (model !== undefined) {
      updateFields.push('model = ?');
      updateValues.push(model);
    }
    if (serial_number !== undefined) {
      updateFields.push('serial_number = ?');
      updateValues.push(serial_number);
    }
    if (mac_address !== undefined) {
      updateFields.push('mac_address = ?');
      updateValues.push(mac_address);
    }
    if (firmware_version !== undefined) {
      updateFields.push('firmware_version = ?');
      updateValues.push(firmware_version);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (remark !== undefined) {
      updateFields.push('remark = ?');
      updateValues.push(remark);
    }

    if (updateFields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    // 验证设备类型（如果提供）
    if (device_type !== undefined) {
      const validDeviceTypes = ['RFID', 'GPS', '蓝牙', 'WiFi', 'UWB', '其他'];
      if (!validDeviceTypes.includes(device_type)) {
        throw new Error(`设备类型无效，必须是以下之一：${validDeviceTypes.join('、')}`);
      }
    }

    // 验证状态（如果提供）
    if (status !== undefined) {
      const validStatuses = ['在线', '离线', '故障', '维护中'];
      if (!validStatuses.includes(status)) {
        throw new Error(`设备状态无效，必须是以下之一：${validStatuses.join('、')}`);
      }
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id, tenantId);

    const [result] = await db.execute(
      `UPDATE iot_devices SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      updateValues,
    );

    return result.affectedRows > 0;
  }

  /**
   * 删除设备
   * @param {number} id - 设备ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteDevice(id, tenantId) {
    // 检查设备是否关联了资产
    const [device] = await db.execute(
      'SELECT device_id FROM iot_devices WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (device.length === 0) {
      throw new Error('设备不存在');
    }

    const [linked] = await db.execute(
      `SELECT COUNT(*) as count FROM asset_locations WHERE device_id = ? AND is_active = 1${buildTenantScopedClause(tenantId).clause}`,
      [device[0].device_id, ...buildTenantScopedClause(tenantId).params],
    );

    if (linked[0].count > 0) {
      throw new Error('设备已关联资产，请先解绑后再删除');
    }

    const [result] = await db.execute('DELETE FROM iot_devices WHERE id = ? AND tenant_id = ?', [
      id,
      tenantId,
    ]);

    return result.affectedRows > 0;
  }

  /**
   * 更新设备状态
   * @param {string} deviceId - 设备ID
   * @param {string} status - 设备状态
   * @returns {Promise<boolean>} 更新结果
   */
  async updateDeviceStatus(deviceId, status, tenantId = null) {
    const tenantScope = buildTenantScopedClause(tenantId);
    const [result] = await db.execute(
      `UPDATE iot_devices SET status = ?, last_online_time = NOW() WHERE device_id = ?${tenantScope.clause}`,
      [status, deviceId, ...tenantScope.params],
    );

    return result.affectedRows > 0;
  }

  /**
   * 关联设备到资产
   * @param {string} assetCode - 资产编码
   * @param {string} deviceId - 设备ID
   * @param {string} deviceType - 设备类型
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 关联结果
   */
  async linkDeviceToAsset(assetCode, deviceId, deviceType, tenantId) {
    // 检查设备是否存在
    const [devices] = await db.execute(
      'SELECT id FROM iot_devices WHERE device_id = ? AND tenant_id = ?',
      [deviceId, tenantId],
    );

    if (devices.length === 0) {
      throw new Error('设备不存在');
    }

    // 检查资产是否存在
    const [assets] = await db.execute(
      'SELECT asset_code FROM assets WHERE asset_code = ? AND tenant_id = ?',
      [assetCode, tenantId],
    );

    if (assets.length === 0) {
      throw new Error('资产不存在');
    }

    const locationTenantScope = buildTenantScopedClause(tenantId);
    // 检查设备是否已关联其他资产
    const [existing] = await db.execute(
      `SELECT asset_code FROM asset_locations WHERE device_id = ? AND is_active = 1${locationTenantScope.clause}`,
      [deviceId, ...locationTenantScope.params],
    );

    if (existing.length > 0 && existing[0].asset_code !== assetCode) {
      throw new Error('该设备已关联其他资产');
    }

    // 检查资产是否已有位置记录
    const [locations] = await db.execute(
      `SELECT id FROM asset_locations WHERE asset_code = ? AND is_active = 1${locationTenantScope.clause}`,
      [assetCode, ...locationTenantScope.params],
    );

    if (locations.length > 0) {
      // 更新现有位置记录
      await db.execute(
        `UPDATE asset_locations
         SET device_id = ?, device_type = ?, updated_at = NOW(), tenant_id = ?
         WHERE asset_code = ? AND is_active = 1${locationTenantScope.clause}`,
        [deviceId, deviceType, tenantId, assetCode, ...locationTenantScope.params],
      );
    } else {
      // 创建新的位置记录
      await db.execute(
        `INSERT INTO asset_locations (asset_code, device_id, device_type, last_update_time, is_active, tenant_id)
         VALUES (?, ?, ?, NOW(), 1, ?)`,
        [assetCode, deviceId, deviceType, tenantId],
      );
    }

    // 更新设备状态为在线
    await this.updateDeviceStatus(deviceId, '在线', tenantId);

    return true;
  }

  /**
   * 解绑设备
   * @param {string} assetCode - 资产编码
   * @param {string} deviceId - 设备ID
   * @returns {Promise<boolean>} 解绑结果
   */
  async unlinkDeviceFromAsset(assetCode, deviceId, tenantId) {
    const tenantScope = buildTenantScopedClause(tenantId);
    const [result] = await db.execute(
      `UPDATE asset_locations
       SET device_id = NULL, device_type = NULL, updated_at = NOW()
       WHERE asset_code = ? AND device_id = ?${tenantScope.clause}`,
      [assetCode, deviceId, ...tenantScope.params],
    );

    return result.affectedRows > 0;
  }
}

module.exports = new DeviceService();
