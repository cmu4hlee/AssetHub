const db = require('../../../config/database');

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

const ASSET_LOCATION_ASSET_JOIN =
  'LEFT JOIN assets a ON al.asset_code = a.asset_code AND al.tenant_id = a.tenant_id';

// 尝试加载redis模块，如果失败则使用内存缓存作为降级方案
let redis = null;
let useMemoryCache = false;
const memoryCache = new Map();
const CACHE_TTL = 300; // 缓存过期时间（秒）

try {
  const redisModule = require('../../../services/redis');
  redis = redisModule.redis;
  useMemoryCache = false;
} catch (error) {
  console.warn('Redis模块加载失败，将使用内存缓存作为降级方案:', error.message);
  useMemoryCache = true;
  redis = null;
}

class LocationService {
  /**
   * 获取资产当前位置
   * @param {string} assetCode - 资产编码
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 资产位置信息
   */
  async getAssetLocation(assetCode, tenantId) {
    // 生成缓存键
    const cacheKey = `asset_location:${tenantId}:${assetCode}`;

    try {
      // 尝试从缓存获取
      if (useMemoryCache) {
        // 使用内存缓存
        const cachedItem = memoryCache.get(cacheKey);
        if (cachedItem && Date.now() < cachedItem.expiry) {
          return cachedItem.data;
        } else if (cachedItem && Date.now() >= cachedItem.expiry) {
          // 缓存过期，删除
          memoryCache.delete(cacheKey);
        }
      } else if (redis) {
        // 使用Redis缓存
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
          return JSON.parse(cachedData);
        }
      }
    } catch (error) {
      console.error('缓存读取失败:', error);
      // 缓存失败不影响主流程，继续执行数据库查询
    }

    const [rows] = await db.execute(
      `SELECT al.*, a.asset_code, a.asset_name, a.brand, a.model
       FROM asset_locations al
       ${ASSET_LOCATION_ASSET_JOIN}
       WHERE a.asset_code = ? AND al.is_active = 1 AND a.tenant_id = ?
       ORDER BY al.last_update_time DESC
       LIMIT 1`,
      [assetCode, tenantId],
    );

    const result = rows.length > 0 ? rows[0] : null;

    try {
      // 缓存结果
      if (result) {
        if (useMemoryCache) {
          // 使用内存缓存
          memoryCache.set(cacheKey, {
            data: result,
            expiry: Date.now() + CACHE_TTL * 1000,
          });
        } else if (redis) {
          // 使用Redis缓存
          await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
        }
      }
    } catch (error) {
      console.error('缓存写入失败:', error);
      // 缓存失败不影响主流程
    }

    return result;
  }

  /**
   * 批量获取资产位置
   * @param {Array<string>} assetCodes - 资产编码列表
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 资产位置列表
   */
  async getBatchAssetLocations(assetCodes, tenantId) {
    if (!assetCodes || assetCodes.length === 0) {
      return [];
    }

    const placeholders = assetCodes.map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT al.*, a.asset_code, a.asset_name, a.brand, a.model
       FROM asset_locations al
       ${ASSET_LOCATION_ASSET_JOIN}
       WHERE a.asset_code IN (${placeholders}) AND al.is_active = 1 AND a.tenant_id = ?
       ORDER BY al.last_update_time DESC`,
      [...assetCodes, tenantId],
    );

    // 每个资产只返回最新的位置
    const locationMap = new Map();
    rows.forEach(row => {
      if (
        !locationMap.has(row.asset_code) ||
        new Date(row.last_update_time) > new Date(locationMap.get(row.asset_code).last_update_time)
      ) {
        locationMap.set(row.asset_code, row);
      }
    });

    return Array.from(locationMap.values());
  }

  /**
   * 更新资产位置
   * @param {string} assetCode - 资产编码
   * @param {Object} locationData - 位置数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 更新结果
   */
  async updateAssetLocation(assetCode, locationData, tenantId) {
    const {
      latitude,
      longitude,
      altitude,
      floor_number,
      building_name,
      room_number,
      area_name,
      address,
      location_accuracy,
      update_source = '手动更新',
      remark,
    } = locationData;

    // 验证必填字段
    if (!latitude || !longitude) {
      throw new Error('纬度和经度不能为空');
    }

    // 验证资产是否存在
    const [assets] = await db.execute(
      'SELECT asset_code FROM assets WHERE asset_code = ? AND tenant_id = ?',
      [assetCode, tenantId],
    );

    if (assets.length === 0) {
      throw new Error('资产不存在');
    }

    // 获取当前位置（用于计算移动距离）
    const locationTenantScope = buildTenantScopedClause(tenantId);
    const [currentLocations] = await db.execute(
      `SELECT latitude, longitude
       FROM asset_locations
       WHERE asset_code = ? AND is_active = 1${locationTenantScope.clause}
       ORDER BY last_update_time DESC
       LIMIT 1`,
      [assetCode, ...locationTenantScope.params],
    );

    let movementDistance = null;
    if (currentLocations.length > 0) {
      const current = currentLocations[0];
      // 计算两点之间的距离（使用 Haversine 公式）
      const R = 6371000; // 地球半径（米）
      const dLat = ((parseFloat(latitude) - parseFloat(current.latitude)) * Math.PI) / 180;
      const dLon = ((parseFloat(longitude) - parseFloat(current.longitude)) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((parseFloat(current.latitude) * Math.PI) / 180) *
          Math.cos((parseFloat(latitude) * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      movementDistance = R * c;
    }

    // 更新或插入位置信息
    const [existing] = await db.execute(
      `SELECT id FROM asset_locations WHERE asset_code = ? AND is_active = 1${locationTenantScope.clause}`,
      [assetCode, ...locationTenantScope.params],
    );

    if (existing.length > 0) {
      // 更新现有位置
      await db.execute(
        `UPDATE asset_locations SET
          latitude = ?, longitude = ?, altitude = ?,
          floor_number = ?, building_name = ?, room_number = ?,
          area_name = ?, address = ?, location_accuracy = ?,
          last_update_time = NOW(), update_source = ?, remark = ?,
          updated_at = NOW(), tenant_id = ?
         WHERE asset_code = ? AND is_active = 1${locationTenantScope.clause}`,
        [
          parseFloat(latitude),
          parseFloat(longitude),
          altitude ? parseFloat(altitude) : null,
          floor_number ? parseInt(floor_number) : null,
          building_name,
          room_number,
          area_name,
          address,
          location_accuracy ? parseFloat(location_accuracy) : null,
          update_source,
          remark,
          tenantId,
          assetCode,
          ...locationTenantScope.params,
        ],
      );
    } else {
      // 插入新位置
      await db.execute(
        `INSERT INTO asset_locations (
          asset_code, latitude, longitude, altitude,
          floor_number, building_name, room_number,
          area_name, address, location_accuracy,
          last_update_time, update_source, remark, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
        [
          assetCode,
          parseFloat(latitude),
          parseFloat(longitude),
          altitude ? parseFloat(altitude) : null,
          floor_number ? parseInt(floor_number) : null,
          building_name,
          room_number,
          area_name,
          address,
          location_accuracy ? parseFloat(location_accuracy) : null,
          update_source,
          remark,
          tenantId,
        ],
      );
    }

    // 如果移动距离大于0，记录到历史表
    if (movementDistance !== null && movementDistance > 0) {
      await db.execute(
        `INSERT INTO asset_location_history (
          asset_code, latitude, longitude, altitude,
          floor_number, building_name, room_number,
          area_name, address, location_accuracy,
          movement_distance, record_time, update_source, remark, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
        [
          assetCode,
          parseFloat(latitude),
          parseFloat(longitude),
          altitude ? parseFloat(altitude) : null,
          floor_number ? parseInt(floor_number) : null,
          building_name,
          room_number,
          area_name,
          address,
          location_accuracy ? parseFloat(location_accuracy) : null,
          movementDistance,
          update_source,
          remark,
          tenantId,
        ],
      );
    }

    return {
      asset_code: assetCode,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      movement_distance: movementDistance,
    };
  }

  /**
   * 获取资产位置历史
   * @param {string} assetCode - 资产编码
   * @param {string} tenantId - 租户ID
   * @param {number} page - 页码
   * @param {number} pageSize - 每页大小
   * @returns {Promise<Object>} 位置历史和分页信息
   */
  async getAssetLocationHistory(assetCode, tenantId, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;

    // 获取总数
    const [countRows] = await db.execute(
      'SELECT COUNT(*) as total FROM asset_location_history WHERE asset_code = ? AND tenant_id = ?',
      [assetCode, tenantId],
    );
    const { total } = countRows[0];

    // 获取数据
    const [rows] = await db.execute(
      `SELECT * FROM asset_location_history
       WHERE asset_code = ? AND tenant_id = ?
       ORDER BY record_time DESC
       LIMIT ? OFFSET ?`,
      [assetCode, tenantId, parseInt(pageSize), offset],
    );

    return {
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 查询指定区域内的资产
   * @param {Object} areaParams - 区域参数
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 区域内的资产列表
   */
  async getAssetsInArea(areaParams, tenantId) {
    const { minLatitude, maxLatitude, minLongitude, maxLongitude, building_name, floor_number } =
      areaParams;

    let whereClause = 'WHERE al.is_active = 1 AND a.tenant_id = ?';
    const params = [tenantId];

    if (minLatitude !== undefined && maxLatitude !== undefined) {
      whereClause += ' AND al.latitude BETWEEN ? AND ?';
      params.push(parseFloat(minLatitude), parseFloat(maxLatitude));
    }

    if (minLongitude !== undefined && maxLongitude !== undefined) {
      whereClause += ' AND al.longitude BETWEEN ? AND ?';
      params.push(parseFloat(minLongitude), parseFloat(maxLongitude));
    }

    if (building_name) {
      whereClause += ' AND al.building_name = ?';
      params.push(building_name);
    }

    if (floor_number !== undefined) {
      whereClause += ' AND al.floor_number = ?';
      params.push(parseInt(floor_number));
    }

    const [rows] = await db.execute(
      `SELECT al.*, a.asset_code, a.asset_name, a.brand, a.model, a.status
       FROM asset_locations al
       ${ASSET_LOCATION_ASSET_JOIN}
       ${whereClause}
       ORDER BY al.last_update_time DESC`,
      params,
    );

    return rows;
  }

  /**
   * 处理设备自动上报的位置数据
   * @param {string} deviceId - 设备ID
   * @param {Object} locationData - 位置数据
   * @returns {Promise<Object>} 处理结果
   */
  async handleDeviceLocationReport(deviceId, locationData, options = {}) {
    const { latitude, longitude, altitude, signal_strength, battery_level, other_data } =
      locationData;
    const expectedTenantId = options?.expectedTenantId || null;

    // 验证设备是否存在
    const deviceLookupSql = expectedTenantId
      ? 'SELECT id, device_id, device_type, status, tenant_id FROM iot_devices WHERE device_id = ? AND tenant_id = ?'
      : 'SELECT id, device_id, device_type, status, tenant_id FROM iot_devices WHERE device_id = ?';
    const deviceLookupParams = expectedTenantId ? [deviceId, expectedTenantId] : [deviceId];
    const [devices] = await db.execute(deviceLookupSql, deviceLookupParams);

    if (devices.length === 0) {
      throw new Error('设备不存在');
    }

    const device = devices[0];
    const locationTenantScope = buildTenantScopedClause(device.tenant_id);

    // 更新设备状态为在线
    await db.execute(
      'UPDATE iot_devices SET status = ?, last_online_time = NOW() WHERE device_id = ? AND tenant_id = ?',
      ['在线', deviceId, device.tenant_id],
    );

    // 查找关联的资产
    const [locations] = await db.execute(
      `SELECT asset_code FROM asset_locations WHERE device_id = ? AND is_active = 1${locationTenantScope.clause}`,
      [deviceId, ...locationTenantScope.params],
    );

    if (locations.length === 0) {
      throw new Error('该设备未关联任何资产');
    }

    const assetCode = locations[0].asset_code;

    // 更新资产位置
    if (latitude !== undefined && longitude !== undefined) {
      const [existing] = await db.execute(
        `SELECT id FROM asset_locations WHERE asset_code = ? AND is_active = 1${locationTenantScope.clause}`,
        [assetCode, ...locationTenantScope.params],
      );

      if (existing.length > 0) {
        // 更新位置
        await db.execute(
          `UPDATE asset_locations SET
            latitude = ?, longitude = ?, altitude = ?,
            signal_strength = ?, battery_level = ?,
            last_update_time = NOW(), update_source = '设备自动上报',
            updated_at = NOW(), tenant_id = ?
           WHERE asset_code = ? AND is_active = 1${locationTenantScope.clause}`,
          [
            parseFloat(latitude),
            parseFloat(longitude),
            altitude ? parseFloat(altitude) : null,
            signal_strength ? parseInt(signal_strength) : null,
            battery_level ? parseInt(battery_level) : null,
            device.tenant_id,
            assetCode,
            ...locationTenantScope.params,
          ],
        );

        // 记录位置历史
        await db.execute(
          `INSERT INTO asset_location_history (
            asset_code, device_id, device_type, latitude, longitude, altitude,
            signal_strength, battery_level, record_time, update_source, tenant_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), '设备自动上报', ?)`,
          [
            assetCode,
            deviceId,
            device.device_type || null,
            parseFloat(latitude),
            parseFloat(longitude),
            altitude ? parseFloat(altitude) : null,
            signal_strength ? parseInt(signal_strength) : null,
            battery_level ? parseInt(battery_level) : null,
            device.tenant_id,
          ],
        );
      }
    }

    return {
      device_id: deviceId,
      asset_code: assetCode,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * 处理信标设备的位置上报
   * @param {string} deviceId - 设备ID
   * @param {string} locationCode - 位置编码
   * @returns {Promise<Object>} 处理结果
   */
  async handleBeaconLocationReport(deviceId, locationCode, options = {}) {
    const expectedTenantId = options?.expectedTenantId || null;

    // 验证设备是否存在
    const deviceLookupSql = expectedTenantId
      ? 'SELECT id, device_id, device_type, status, tenant_id FROM iot_devices WHERE device_id = ? AND tenant_id = ?'
      : 'SELECT id, device_id, device_type, status, tenant_id FROM iot_devices WHERE device_id = ?';
    const deviceLookupParams = expectedTenantId ? [deviceId, expectedTenantId] : [deviceId];
    const [devices] = await db.execute(deviceLookupSql, deviceLookupParams);

    if (devices.length === 0) {
      throw new Error('信标设备不存在');
    }

    const device = devices[0];
    const locationTenantScope = buildTenantScopedClause(device.tenant_id);

    // 查找位置编码信息
    const [locations] = await db.execute(
      'SELECT * FROM location_codes WHERE location_code = ? AND is_active = 1',
      [locationCode],
    );

    if (locations.length === 0) {
      throw new Error('位置编号不存在或已停用');
    }

    const locationInfo = locations[0];

    // 查找关联的资产
    const [assetLocations] = await db.execute(
      `SELECT asset_code FROM asset_locations WHERE device_id = ? AND is_active = 1${locationTenantScope.clause}`,
      [deviceId, ...locationTenantScope.params],
    );

    if (assetLocations.length === 0) {
      throw new Error('该信标设备未关联任何资产');
    }

    const assetCode = assetLocations[0].asset_code;

    // 更新设备状态为在线
    await db.execute(
      'UPDATE iot_devices SET status = ?, last_online_time = NOW() WHERE device_id = ? AND tenant_id = ?',
      ['在线', deviceId, device.tenant_id],
    );

    // 更新资产位置
    const [existing] = await db.execute(
      `SELECT id FROM asset_locations WHERE asset_code = ? AND is_active = 1${locationTenantScope.clause}`,
      [assetCode, ...locationTenantScope.params],
    );

    if (existing.length > 0) {
      // 更新现有位置
      await db.execute(
        `UPDATE asset_locations SET
          device_id = ?, device_type = ?,
          latitude = ?, longitude = ?,
          floor_number = ?, building_name = ?, room_number = ?,
          area_name = ?,
          last_update_time = NOW(), update_source = '设备自动上报',
          updated_at = NOW(), tenant_id = ?
         WHERE asset_code = ? AND is_active = 1${locationTenantScope.clause}`,
        [
          deviceId,
          device.device_type || null,
          locationInfo.latitude || null,
          locationInfo.longitude || null,
          locationInfo.floor_number || null,
          locationInfo.building_name || null,
          locationInfo.room_number || null,
          locationInfo.area_name || locationInfo.location_name || null,
          device.tenant_id,
          assetCode,
          ...locationTenantScope.params,
        ],
      );
    } else {
      // 插入新位置
      await db.execute(
        `INSERT INTO asset_locations (
          asset_code, device_id, device_type,
          latitude, longitude,
          floor_number, building_name, room_number,
          area_name,
          last_update_time, update_source, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), '设备自动上报', ?)`,
        [
          assetCode,
          deviceId,
          device.device_type || null,
          locationInfo.latitude || null,
          locationInfo.longitude || null,
          locationInfo.floor_number || null,
          locationInfo.building_name || null,
          locationInfo.room_number || null,
          locationInfo.area_name || locationInfo.location_name || null,
          device.tenant_id,
        ],
      );
    }

    // 记录位置历史
    await db.execute(
      `INSERT INTO asset_location_history (
        asset_code, device_id, device_type,
        latitude, longitude,
        floor_number, building_name, room_number,
        area_name,
        record_time, update_source, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), '设备自动上报', ?)`,
      [
        assetCode,
        deviceId,
        device.device_type || null,
        locationInfo.latitude || null,
        locationInfo.longitude || null,
        locationInfo.floor_number || null,
        locationInfo.building_name || null,
        locationInfo.room_number || null,
        locationInfo.area_name || locationInfo.location_name || null,
        device.tenant_id,
      ],
    );

    return {
      device_id: deviceId,
      location_code: locationCode,
      location_name: locationInfo.location_name,
      asset_code: assetCode,
      updated_at: new Date().toISOString(),
    };
  }
}

module.exports = new LocationService();
