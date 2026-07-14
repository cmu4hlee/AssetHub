const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate } = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');
const { verifyIngestToken } = require('../modules/iot-management/controllers/ingest-auth.util');

const ASSET_LOCATION_TRACE_LOG_ENABLED =
  process.env.ASSET_LOCATION_TRACE_LOG_ENABLED === 'true';
const assetLocationTraceLog = (...args) => {
  if (ASSET_LOCATION_TRACE_LOG_ENABLED) {
    console.warn(...args);
  }
};

function logAssetLocationError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: getTenantId(req) || null,
    ...context,
  });
  if (ASSET_LOCATION_TRACE_LOG_ENABLED && error?.stack) {
    assetLocationTraceLog(`${message} stack:`, error.stack);
  }
}

const buildTenantScopedLocationClause = (tenantId, alias = '') => {
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
const ASSET_LOCATION_DEVICE_JOIN =
  'LEFT JOIN iot_devices d ON al.device_id = d.device_id AND d.tenant_id = al.tenant_id';
const ASSET_LOCATION_DEVICE_LIST_JOIN =
  'LEFT JOIN iot_devices ld ON al.device_id = ld.device_id AND ld.tenant_id = al.tenant_id';

// ==================== 资产位置管理 ====================

// 根路径：返回所有资产位置汇总
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: '租户ID缺失' });
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    const [rows] = await db.execute(
      `SELECT a.id, a.asset_code, a.asset_name, al.building_name, al.floor_number, al.room_number, al.area_name, al.latitude, al.longitude, al.last_update_time
       FROM assets a
       LEFT JOIN asset_locations al ON a.asset_code = al.asset_code
       WHERE a.tenant_id = ? AND a.status != 'scrapped'
       ORDER BY al.last_update_time DESC, a.created_at DESC
       LIMIT ? OFFSET ?`,
      [tenantId, Number(pageSize), Number(offset)]
    );
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM assets WHERE tenant_id = ? AND status != 'scrapped'`,
      [tenantId]
    );
    res.json({
      success: true,
      data: { list: rows, pagination: { total: countRows[0].total, page: Number(page), pageSize: Number(pageSize) } },
    });
  } catch (e) {
    logger.error('获取资产位置列表失败', { error: e.message });
    res.status(500).json({ success: false, message: '获取资产位置列表失败', error: e.message });
  }
});

// 获取资产当前位置
router.get('/assets/:assetIdOrCode/location', authenticate, async (req, res) => {
  try {
    const { assetIdOrCode } = req.params;

    // 检查assetIdOrCode是否为数字
    const isNumeric = /^\d+$/.test(assetIdOrCode);

    // 添加租户过滤
    const assetTenantFilter = addTenantFilter(req, 'a');

    // 根据类型构建查询条件
    let whereClause;
    let params;

    if (isNumeric) {
      // 如果是数字，尝试通过id或asset_code查找
      whereClause = `(a.id = ? OR a.asset_code = ?) AND al.is_active = 1 ${assetTenantFilter.whereClause}`;
      params = [parseInt(assetIdOrCode), assetIdOrCode, ...assetTenantFilter.params];
    } else {
      // 如果是字符串，只尝试通过asset_code查找
      whereClause = `a.asset_code = ? AND al.is_active = 1 ${assetTenantFilter.whereClause}`;
      params = [assetIdOrCode, ...assetTenantFilter.params];
    }

    const [rows] = await db.execute(
      `SELECT al.*, a.asset_code, a.asset_name, a.brand, a.model
       FROM asset_locations al
       ${ASSET_LOCATION_ASSET_JOIN}
       WHERE ${whereClause}
       ORDER BY al.last_update_time DESC
       LIMIT 1`,
      params,
    );

    if (rows.length === 0) {
      return res.json({
        success: false,
        message: '该资产尚未配置位置信息',
        data: null,
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logAssetLocationError('获取资产位置失败', error, req, {
      assetIdOrCode: req.params.assetIdOrCode,
    });
    res.status(500).json({ success: false, message: '获取资产位置失败', error: error.message });
  }
});

// 批量获取资产位置
router.post('/assets/locations', authenticate, async (req, res) => {
  try {
    const { assetCodes } = req.body;

    if (!assetCodes || !Array.isArray(assetCodes) || assetCodes.length === 0) {
      return res.status(400).json({ success: false, message: '请提供资产编号列表' });
    }

    const placeholders = assetCodes.map(() => '?').join(',');
    // 添加租户过滤
    const assetTenantFilter = addTenantFilter(req, 'a');
    const [rows] = await db.execute(
      `SELECT al.*, a.asset_code, a.asset_name, a.brand, a.model
       FROM asset_locations al
       ${ASSET_LOCATION_ASSET_JOIN}
       WHERE a.asset_code IN (${placeholders}) AND al.is_active = 1 ${assetTenantFilter.whereClause}
       ORDER BY al.last_update_time DESC`,
      [...assetCodes, ...assetTenantFilter.params],
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

    res.json({
      success: true,
      data: Array.from(locationMap.values()),
    });
  } catch (error) {
    logAssetLocationError('批量获取资产位置失败', error, req, {
      batchSize: Array.isArray(req.body?.assetCodes) ? req.body.assetCodes.length : 0,
    });
    res.status(500).json({ success: false, message: '批量获取资产位置失败', error: error.message });
  }
});

// 更新资产位置
router.post('/assets/:assetIdOrCode/location', authenticate, async (req, res) => {
  try {
    const { assetIdOrCode } = req.params;
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
    } = req.body;

    // 验证必填字段
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: '纬度和经度不能为空' });
    }

    // 检查assetIdOrCode是否为数字
    const isNumeric = /^\d+$/.test(assetIdOrCode);

    // 添加租户过滤
    const assetTenantFilter = addTenantFilter(req, 'a');

    // 根据类型构建查询条件
    let whereClause;
    let params;

    if (isNumeric) {
      // 如果是数字，尝试通过id或asset_code查找
      whereClause = `(a.id = ? OR a.asset_code = ?) ${assetTenantFilter.whereClause}`;
      params = [parseInt(assetIdOrCode), assetIdOrCode, ...assetTenantFilter.params];
    } else {
      // 如果是字符串，只尝试通过asset_code查找
      whereClause = `a.asset_code = ? ${assetTenantFilter.whereClause}`;
      params = [assetIdOrCode, ...assetTenantFilter.params];
    }

    // 验证资产是否存在并属于当前租户
    const [assets] = await db.execute(
      `SELECT id, asset_code FROM assets a WHERE ${whereClause}`,
      params,
    );
    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const assetCode = assets[0].asset_code;

    // 获取当前位置（用于计算移动距离）
    const tenantId = getTenantId(req);
    const locationTenantScope = buildTenantScopedLocationClause(tenantId);
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

    const updatedBy = req.user.real_name || req.user.username || '系统管理员';

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

    res.json({
      success: true,
      message: '位置更新成功',
      data: {
        asset_code: assetCode,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        movement_distance: movementDistance,
      },
    });
  } catch (error) {
    logAssetLocationError('更新资产位置失败', error, req, {
      assetIdOrCode: req.params.assetIdOrCode,
      updateSource: req.body?.update_source || null,
    });
    res.status(500).json({
      success: false,
      message: '更新资产位置失败',
      error: error.message,
    });
  }
});

// 获取资产位置历史
router.get('/assets/:assetIdOrCode/location/history', authenticate, async (req, res) => {
  try {
    const { assetIdOrCode } = req.params;
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    // 检查assetIdOrCode是否为数字
    const isNumeric = /^\d+$/.test(assetIdOrCode);

    // 添加租户过滤
    const assetTenantFilter = addTenantFilter(req, 'a');

    // 根据类型构建查询条件
    let whereClause;
    let params;

    if (isNumeric) {
      // 如果是数字，尝试通过id或asset_code查找
      whereClause = `(a.id = ? OR a.asset_code = ?) ${assetTenantFilter.whereClause}`;
      params = [parseInt(assetIdOrCode), assetIdOrCode, ...assetTenantFilter.params];
    } else {
      // 如果是字符串，只尝试通过asset_code查找
      whereClause = `a.asset_code = ? ${assetTenantFilter.whereClause}`;
      params = [assetIdOrCode, ...assetTenantFilter.params];
    }

    // 验证资产是否存在并属于当前租户
    const [assetExists] = await db.execute(
      `SELECT asset_code FROM assets a WHERE ${whereClause}`,
      params,
    );
    if (assetExists.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const assetCode = assetExists[0].asset_code;

    // 获取总数
    const tenantId = getTenantId(req);

    // 根据是否有租户ID构建查询条件
    let countQuery, dataQuery, countParams, dataParams;

    if (tenantId) {
      // 如果有租户ID，添加租户过滤
      countQuery =
        'SELECT COUNT(*) as total FROM asset_location_history WHERE asset_code = ? AND tenant_id = ?';
      countParams = [assetCode, tenantId];

      dataQuery = `SELECT * FROM asset_location_history
       WHERE asset_code = ? AND tenant_id = ?
       ORDER BY record_time DESC
       LIMIT ? OFFSET ?`;
      dataParams = [assetCode, tenantId, parseInt(pageSize), offset];
    } else {
      // 如果没有租户ID，只按资产ID查询
      countQuery = 'SELECT COUNT(*) as total FROM asset_location_history WHERE asset_code = ?';
      countParams = [assetCode];

      dataQuery = `SELECT * FROM asset_location_history
       WHERE asset_code = ?
       ORDER BY record_time DESC
       LIMIT ? OFFSET ?`;
      dataParams = [assetCode, parseInt(pageSize), offset];
    }

    const [countRows] = await db.execute(countQuery, countParams);
    const { total } = countRows[0];

    // 获取数据
    const [rows] = await db.execute(dataQuery, dataParams);

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logAssetLocationError('获取位置历史失败', error, req, {
      assetIdOrCode: req.params.assetIdOrCode,
      page: Number(req.query?.page) || 1,
      pageSize: Number(req.query?.pageSize) || 20,
    });
    res.status(500).json({ success: false, message: '获取位置历史失败', error: error.message });
  }
});

// 查询指定区域内的资产
router.post('/assets/in-area', authenticate, async (req, res) => {
  try {
    const { minLatitude, maxLatitude, minLongitude, maxLongitude, building_name, floor_number } =
      req.body;

    let whereClause = 'WHERE al.is_active = 1';
    const params = [];

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

    // 添加租户过滤
    const assetTenantFilter = addTenantFilter(req, 'a');
    whereClause += assetTenantFilter.whereClause;
    params.push(...assetTenantFilter.params);

    const [rows] = await db.execute(
      `SELECT al.*, a.asset_code, a.asset_name, a.brand, a.model, a.status
       FROM asset_locations al
       ${ASSET_LOCATION_ASSET_JOIN}
       ${whereClause}
       ORDER BY al.last_update_time DESC`,
      params,
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    logAssetLocationError('查询区域资产失败', error, req, {
      buildingName: req.body?.building_name || null,
      floorNumber: req.body?.floor_number || null,
    });
    res.status(500).json({ success: false, message: '查询区域资产失败', error: error.message });
  }
});

// ==================== 设备管理 ====================

// 获取设备列表
router.get('/devices', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, device_type } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (keyword) {
      whereClause += ' AND (device_id LIKE ? OR device_name LIKE ?)';
      const keywordParam = `%${keyword}%`;
      params.push(keywordParam, keywordParam);
    }

    if (device_type) {
      whereClause += ' AND device_type = ?';
      params.push(device_type);
    }

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'id');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    // 获取总数（使用 iot_devices 表）
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM iot_devices id ${whereClause}`,
      params,
    );
    const { total } = countRows[0];

    // 获取数据（使用 iot_devices 表）
    const [rows] = await db.execute(
      `SELECT * FROM iot_devices id
       ${whereClause}
       ORDER BY id.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logAssetLocationError('获取设备列表失败', error, req, {
      page: Number(req.query?.page) || 1,
      pageSize: Number(req.query?.pageSize) || 20,
      keyword: req.query?.keyword || null,
      deviceType: req.query?.device_type || null,
    });
    res.status(500).json({ success: false, message: '获取设备列表失败', error: error.message });
  }
});

// 创建设备
router.post('/devices', authenticate, async (req, res) => {
  try {
    const {
      device_id,
      device_name,
      device_type,
      manufacturer,
      model,
      status = 'active',
      remark,
    } = req.body;

    if (!device_id || !device_name || !device_type) {
      return res.status(400).json({ success: false, message: '设备ID、名称和类型不能为空' });
    }

    // 获取当前租户ID
    const tenantId = getTenantId(req);

    const [result] = await db.execute(
      `INSERT INTO iot_devices (
        device_id, device_name, device_type, manufacturer, model, status, remark, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [device_id, device_name, device_type, manufacturer, model, status, remark, tenantId],
    );

    res.json({
      success: true,
      message: '设备创建成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    logAssetLocationError('创建设备失败', error, req, {
      deviceId: req.body?.device_id || null,
      deviceType: req.body?.device_type || null,
    });
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: '设备ID已存在' });
    }
    res.status(500).json({ success: false, message: '创建设备失败', error: error.message });
  }
});

// ==================== 资产设备绑定 ====================

// 绑定设备到资产
router.post('/assets/:assetIdOrCode/bind-device', authenticate, async (req, res) => {
  try {
    const { assetIdOrCode } = req.params;
    const { device_id, device_type } = req.body;

    if (!device_id || !device_type) {
      return res.status(400).json({ success: false, message: '设备ID和类型不能为空' });
    }

    // 检查设备是否存在且属于当前租户
    const tenantFilter = addTenantFilter(req, 'id');
    const [devices] = await db.execute(
      `SELECT id FROM iot_devices id WHERE id.device_id = ? ${tenantFilter.whereClause}`,
      [device_id, ...tenantFilter.params],
    );
    if (devices.length === 0) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    // 检查assetIdOrCode是否为数字
    const isNumeric = /^\d+$/.test(assetIdOrCode);

    // 添加租户过滤
    const assetTenantFilter = addTenantFilter(req, 'a');

    // 根据类型构建查询条件
    let whereClause;
    let params;

    if (isNumeric) {
      // 如果是数字，尝试通过id或asset_code查找
      whereClause = `(a.id = ? OR a.asset_code = ?) ${assetTenantFilter.whereClause}`;
      params = [parseInt(assetIdOrCode), assetIdOrCode, ...assetTenantFilter.params];
    } else {
      // 如果是字符串，只尝试通过asset_code查找
      whereClause = `a.asset_code = ? ${assetTenantFilter.whereClause}`;
      params = [assetIdOrCode, ...assetTenantFilter.params];
    }

    // 验证资产是否存在且属于当前租户
    const [assets] = await db.execute(
      `SELECT asset_code FROM assets a WHERE ${whereClause}`,
      params,
    );
    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const assetCode = assets[0].asset_code;

    // 更新资产位置信息中的设备信息
    const tenantId = getTenantId(req);
    const locationTenantScope = buildTenantScopedLocationClause(tenantId);
    await db.execute(
      `UPDATE asset_locations
       SET device_id = ?, device_type = ?
       WHERE asset_code = ?${locationTenantScope.clause}`,
      [device_id, device_type, assetCode, ...locationTenantScope.params],
    );

    res.json({ success: true, message: '设备绑定成功' });
  } catch (error) {
    logAssetLocationError('绑定设备失败', error, req, {
      assetIdOrCode: req.params.assetIdOrCode,
      deviceId: req.body?.device_id || null,
      deviceType: req.body?.device_type || null,
    });
    res.status(500).json({ success: false, message: '绑定设备失败', error: error.message });
  }
});

// 解绑设备
router.post('/assets/:assetIdOrCode/unbind-device', authenticate, async (req, res) => {
  try {
    const { assetIdOrCode } = req.params;

    // 检查assetIdOrCode是否为数字
    const isNumeric = /^\d+$/.test(assetIdOrCode);

    // 添加租户过滤
    const assetTenantFilter = addTenantFilter(req, 'a');

    // 根据类型构建查询条件
    let whereClause;
    let params;

    if (isNumeric) {
      // 如果是数字，尝试通过id或asset_code查找
      whereClause = `(a.id = ? OR a.asset_code = ?) ${assetTenantFilter.whereClause}`;
      params = [parseInt(assetIdOrCode), assetIdOrCode, ...assetTenantFilter.params];
    } else {
      // 如果是字符串，只尝试通过asset_code查找
      whereClause = `a.asset_code = ? ${assetTenantFilter.whereClause}`;
      params = [assetIdOrCode, ...assetTenantFilter.params];
    }

    // 验证资产是否存在且属于当前租户
    const [assets] = await db.execute(
      `SELECT asset_code FROM assets a WHERE ${whereClause}`,
      params,
    );
    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const assetCode = assets[0].asset_code;

    const tenantId = getTenantId(req);
    const locationTenantScope = buildTenantScopedLocationClause(tenantId);
    await db.execute(
      `UPDATE asset_locations
       SET device_id = NULL, device_type = NULL
       WHERE asset_code = ?${locationTenantScope.clause}`,
      [assetCode, ...locationTenantScope.params],
    );

    res.json({ success: true, message: '设备解绑成功' });
  } catch (error) {
    logAssetLocationError('解绑设备失败', error, req, {
      assetIdOrCode: req.params.assetIdOrCode,
    });
    res.status(500).json({ success: false, message: '解绑设备失败', error: error.message });
  }
});

// 获取资产的设备列表
router.get('/assets/:assetIdOrCode/devices', authenticate, async (req, res) => {
  try {
    const { assetIdOrCode } = req.params;

    // 检查assetIdOrCode是否为数字
    const isNumeric = /^\d+$/.test(assetIdOrCode);

    // 添加租户过滤
    const assetTenantFilter = addTenantFilter(req, 'a');

    // 根据类型构建查询条件
    let whereClause;
    let params;

    if (isNumeric) {
      // 如果是数字，尝试通过id或asset_code查找
      whereClause = `(a.id = ? OR a.asset_code = ?) ${assetTenantFilter.whereClause}`;
      params = [parseInt(assetIdOrCode), assetIdOrCode, ...assetTenantFilter.params];
    } else {
      // 如果是字符串，只尝试通过asset_code查找
      whereClause = `a.asset_code = ? ${assetTenantFilter.whereClause}`;
      params = [assetIdOrCode, ...assetTenantFilter.params];
    }

    // 验证资产是否存在且属于当前租户
    const [assets] = await db.execute(
      `SELECT asset_code FROM assets a WHERE ${whereClause}`,
      params,
    );
    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const assetCode = assets[0].asset_code;

    const tenantId = getTenantId(req);
    const locationTenantScope = buildTenantScopedLocationClause(tenantId, 'al');
    const [rows] = await db.execute(
      `SELECT al.device_id, al.device_type, ld.device_name, ld.manufacturer, ld.model, ld.status
       FROM asset_locations al
       ${ASSET_LOCATION_DEVICE_LIST_JOIN}
       WHERE al.asset_code = ? AND al.is_active = 1 AND al.device_id IS NOT NULL${locationTenantScope.clause}`,
      [assetCode, ...locationTenantScope.params],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    logAssetLocationError('获取资产设备失败', error, req, {
      assetIdOrCode: req.params.assetIdOrCode,
    });
    res.status(500).json({ success: false, message: '获取资产设备失败', error: error.message });
  }
});

// ==================== 区域定位API（外部设备调用） ====================

// 区域定位接口：通过信标设备ID和位置编号更新资产位置（无需认证，供外部设备调用）
router.post('/beacon-location', async (req, res) => {
  try {
    const { device_id, location_code } = req.body;

    // 验证必填字段
    if (!device_id) {
      return res.status(400).json({ success: false, message: '信标设备ID不能为空' });
    }
    if (!location_code) {
      return res.status(400).json({ success: false, message: '位置编号不能为空' });
    }

    if (
      !(await verifyIngestToken(req, res, {
        moduleName: '区域定位',
        scope: 'zone-location',
      }))
    ) {
      return;
    }

    // 1. 验证设备是否存在
    const deviceTenantFilter = addTenantFilter(req, 'id');
    const [devices] = await db.execute(
      `SELECT id, device_id, device_type, status, tenant_id
       FROM iot_devices id
       WHERE id.device_id = ? ${deviceTenantFilter.whereClause}`,
      [device_id, ...deviceTenantFilter.params],
    );
    if (devices.length === 0) {
      return res.status(404).json({ success: false, message: '信标设备不存在' });
    }
    const device = devices[0];
    const tenantId = req.iotAuth?.tenant_id || device.tenant_id || null;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无法确定租户信息，请求被拒绝' });
    }

    // 2. 查找位置编码信息
    const [locations] = await db.execute(
      'SELECT * FROM location_codes WHERE location_code = ? AND is_active = 1 AND tenant_id = ?',
      [location_code, tenantId],
    );
    if (locations.length === 0) {
      return res.status(404).json({ success: false, message: '位置编号不存在或已停用' });
    }
    const locationInfo = locations[0];

    // 3. 通过设备ID查找关联的资产（从asset_locations表查找）
    const [assetLocations] = await db.execute(
      'SELECT asset_code FROM asset_locations WHERE device_id = ? AND is_active = 1 AND tenant_id = ?',
      [device_id, tenantId],
    );

    if (assetLocations.length === 0) {
      return res.status(404).json({
        success: false,
        message: '该信标设备未关联任何资产，请先在系统中绑定资产',
      });
    }

    const assetCode = assetLocations[0].asset_code;

    // 4. 验证资产是否存在
    const [assets] = await db.execute(
      'SELECT asset_code, asset_name, tenant_id FROM assets WHERE asset_code = ? AND tenant_id = ?',
      [assetCode, tenantId],
    );
    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '关联的资产不存在' });
    }
    const asset = assets[0];

    // 5. 更新设备状态为在线
    const updateDeviceSql = tenantId
      ? 'UPDATE iot_devices SET status = ?, last_online_time = NOW() WHERE device_id = ? AND tenant_id = ?'
      : 'UPDATE iot_devices SET status = ?, last_online_time = NOW() WHERE device_id = ?';
    const updateDeviceParams = tenantId ? ['在线', device_id, tenantId] : ['在线', device_id];
    await db.execute(updateDeviceSql, updateDeviceParams);

    // 6. 获取当前位置用于计算移动距离
    const locationTenantScope = buildTenantScopedLocationClause(tenantId);
    const [currentLocations] = await db.execute(
      `SELECT latitude, longitude
       FROM asset_locations
       WHERE asset_code = ? AND is_active = 1${locationTenantScope.clause}
       ORDER BY last_update_time DESC
       LIMIT 1`,
      [assetCode, ...locationTenantScope.params],
    );

    let movementDistance = null;
    if (
      currentLocations.length > 0 &&
      currentLocations[0].latitude &&
      currentLocations[0].longitude &&
      locationInfo.latitude &&
      locationInfo.longitude
    ) {
      const current = currentLocations[0];
      // 计算两点之间的距离（使用 Haversine 公式）
      const R = 6371000; // 地球半径（米）
      const dLat =
        ((parseFloat(locationInfo.latitude) - parseFloat(current.latitude)) * Math.PI) / 180;
      const dLon =
        ((parseFloat(locationInfo.longitude) - parseFloat(current.longitude)) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((parseFloat(current.latitude) * Math.PI) / 180) *
          Math.cos((parseFloat(locationInfo.latitude) * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      movementDistance = R * c;
    }

    // 7. 更新资产位置信息
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
          device_id,
          device.device_type || null,
          locationInfo.latitude || null,
          locationInfo.longitude || null,
          locationInfo.floor_number || null,
          locationInfo.building_name || null,
          locationInfo.room_number || null,
          locationInfo.area_name || locationInfo.location_name || null,
          tenantId,
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
          device_id,
          device.device_type || null,
          locationInfo.latitude || null,
          locationInfo.longitude || null,
          locationInfo.floor_number || null,
          locationInfo.building_name || null,
          locationInfo.room_number || null,
          locationInfo.area_name || locationInfo.location_name || null,
          tenantId,
        ],
      );
    }

    // 8. 记录位置历史
    await db.execute(
      `INSERT INTO asset_location_history (
        asset_code, device_id, device_type,
        latitude, longitude,
        floor_number, building_name, room_number,
        area_name,
        movement_distance, record_time, update_source, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), '设备自动上报', ?)`,
      [
        assetCode,
        device_id,
        device.device_type || null,
        locationInfo.latitude || null,
        locationInfo.longitude || null,
        locationInfo.floor_number || null,
        locationInfo.building_name || null,
        locationInfo.room_number || null,
        locationInfo.area_name || locationInfo.location_name || null,
        movementDistance,
        tenantId,
      ],
    );

    res.json({
      success: true,
      message: '位置更新成功',
      data: {
        device_id,
        location_code,
        location_name: locationInfo.location_name,
        asset_code: asset.asset_code,
        asset_name: asset.asset_name,
        movement_distance: movementDistance,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    logAssetLocationError('区域定位更新失败', error, req, {
      deviceId: req.body?.device_id || null,
      locationCode: req.body?.location_code || null,
    });
    res.status(500).json({
      success: false,
      message: '区域定位更新失败',
      error: error.message,
    });
  }
});

// ==================== 区域定位管理 ====================

// 获取已关联信标设备的资产列表
router.get('/beacon-assets', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, device_type, status } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE al.is_active = 1 AND al.device_id IS NOT NULL';
    const params = [];

    // 添加租户过滤
    const assetTenantFilter = addTenantFilter(req, 'a');
    whereClause += assetTenantFilter.whereClause;
    params.push(...assetTenantFilter.params);

    if (keyword) {
      whereClause += ' AND (a.asset_code LIKE ? OR a.asset_name LIKE ?)';
      const keywordParam = `%${keyword}%`;
      params.push(keywordParam, keywordParam);
    }

    if (device_type) {
      whereClause += ' AND al.device_type = ?';
      params.push(device_type);
    }

    if (status) {
      whereClause += ' AND d.status = ?';
      params.push(status);
    }

    // 获取总数
    const [countRows] = await db.execute(
      `SELECT COUNT(DISTINCT al.asset_code) as total
       FROM asset_locations al
       ${ASSET_LOCATION_ASSET_JOIN}
       ${ASSET_LOCATION_DEVICE_JOIN}
       ${whereClause}`,
      params,
    );
    const total = countRows[0]?.total || 0;

    // 获取数据
    const [rows] = await db.execute(
      `SELECT
        a.asset_code,
        a.asset_name,
        a.department,
        a.status as asset_status,
        al.device_id,
        al.device_type,
        al.latitude,
        al.longitude,
        al.floor_number,
        al.building_name,
        al.room_number,
        al.area_name,
        al.address,
        al.last_update_time,
        al.location_accuracy,
        al.signal_strength,
        al.battery_level,
        COALESCE(d.device_name, '') as device_name,
        COALESCE(d.status, '离线') as device_status,
        d.last_online_time
       FROM asset_locations al
       ${ASSET_LOCATION_ASSET_JOIN}
       ${ASSET_LOCATION_DEVICE_JOIN}
       ${whereClause}
       ORDER BY al.last_update_time DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    res.json({
      success: true,
      data: rows || [],
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logAssetLocationError('获取区域定位资产列表失败', error, req, {
      page: Number(req.query?.page) || 1,
      pageSize: Number(req.query?.pageSize) || 20,
      keyword: req.query?.keyword || null,
      deviceType: req.query?.device_type || null,
      status: req.query?.status || null,
    });
    res.status(500).json({
      success: false,
      message: '获取区域定位资产列表失败',
      error: error.message,
    });
  }
});

module.exports = router;
