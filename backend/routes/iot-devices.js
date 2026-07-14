const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate } = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');
const { verifyIngestToken } = require('../modules/iot-management/controllers/ingest-auth.util');
const IOT_DEVICES_TRACE_LOG_ENABLED = process.env.IOT_DEVICES_TRACE_LOG_ENABLED === 'true';
const iotDevicesTraceLog = (...args) => {
  if (IOT_DEVICES_TRACE_LOG_ENABLED) {
    console.log(...args);
  }
};

function logIotDevicesError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: getTenantId(req) || null,
    userId: req?.user?.id || null,
    username: req?.user?.username || null,
    userRole: req?.user?.role || null,
    ...context,
  });
}

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

const parseOptionalNumber = value => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

function validateCoordinate(name, value, min, max) {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) {
    return { valid: true, value: null };
  }

  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    return {
      valid: false,
      message: `${name} 必须是 ${min} 到 ${max} 之间的数字`,
    };
  }

  return { valid: true, value: parsed };
}

const IOT_DEVICE_ASSET_LOCATION_JOIN =
  'LEFT JOIN asset_locations al ON d.device_id = al.device_id AND al.is_active = 1 AND al.tenant_id = d.tenant_id';
const IOT_DEVICE_ASSET_JOIN =
  'LEFT JOIN assets a ON al.asset_code = a.asset_code AND a.tenant_id = al.tenant_id';
const IOT_DEVICE_LINKED_DEVICE_JOIN =
  'LEFT JOIN iot_devices d ON al.device_id = d.device_id AND d.tenant_id = al.tenant_id';

// ==================== 设备管理 ====================

// 获取设备列表
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, device_type, status } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'd');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (keyword) {
      whereClause += ' AND (d.device_id LIKE ? OR d.device_name LIKE ?)';
      const keywordParam = `%${keyword}%`;
      params.push(keywordParam, keywordParam);
    }

    if (device_type) {
      whereClause += ' AND d.device_type = ?';
      params.push(device_type);
    }

    if (status) {
      whereClause += ' AND d.status = ?';
      params.push(status);
    }

    // 获取总数
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM iot_devices d ${whereClause}`,
      params,
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
       ${IOT_DEVICE_ASSET_LOCATION_JOIN}
       ${IOT_DEVICE_ASSET_JOIN}
       ${whereClause}
       ORDER BY d.created_at DESC
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
    logIotDevicesError('获取设备列表失败', error, req, {
      page: req.query?.page || 1,
      pageSize: req.query?.pageSize || 20,
      keyword: req.query?.keyword || null,
      deviceType: req.query?.device_type || null,
      status: req.query?.status || null,
    });
    res.status(500).json({ success: false, message: '获取设备列表失败', error: error.message });
  }
});

// ==================== 设备特定路由（必须在 /:id 之前） ====================

// 获取设备的关联资产
router.get('/:deviceId/assets', authenticate, async (req, res) => {
  try {
    const { deviceId } = req.params;

    // 通过device_id查找
    const tenantFilter = addTenantFilter(req, 'd');
    const [device] = await db.execute(
      `SELECT d.device_id FROM iot_devices d WHERE d.device_id = ? ${tenantFilter.whereClause}`,
      [deviceId, ...tenantFilter.params],
    );
    if (device.length === 0) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    const locationTenantScope = buildTenantScopedClause(getTenantId(req), 'al');
    const [rows] = await db.execute(
      `SELECT a.id as asset_id, a.asset_code, a.asset_name, al.last_update_time
       FROM asset_locations al
       ${IOT_DEVICE_ASSET_JOIN}
       WHERE al.device_id = ? AND al.is_active = 1${locationTenantScope.clause}`,
      [deviceId, ...locationTenantScope.params],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    logIotDevicesError('获取设备资产失败', error, req, {
      deviceId: req.params?.deviceId || null,
    });
    res.status(500).json({ success: false, message: '获取设备资产失败', error: error.message });
  }
});

// 获取设备数据（需要认证）
router.get('/:deviceId/data', authenticate, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { page = 1, pageSize = 50, start_date, end_date } = req.query;
    const offset = (page - 1) * pageSize;

    // 验证设备是否存在
    const deviceTenantFilter = addTenantFilter(req, 'd');
    const [devices] = await db.execute(
      `SELECT device_id FROM iot_devices d WHERE device_id = ? ${deviceTenantFilter.whereClause}`,
      [deviceId, ...deviceTenantFilter.params],
    );
    if (devices.length === 0) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    // 从位置历史记录中获取数据（通过device_id）
    const tenantId = getTenantId(req);
    let whereClause = 'WHERE device_id = ? AND tenant_id = ?';
    const params = [deviceId, tenantId];

    if (start_date) {
      whereClause += ' AND record_time >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND record_time <= ?';
      params.push(end_date);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM asset_location_history ${whereClause}`,
      params,
    );
    const { total } = countRows[0];

    const [rows] = await db.execute(
      `SELECT * FROM asset_location_history
       ${whereClause}
       ORDER BY record_time DESC
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
    logIotDevicesError('获取设备数据失败', error, req, {
      deviceId: req.params?.deviceId || null,
    });
    res.status(500).json({ success: false, message: '获取设备数据失败', error: error.message });
  }
});

// ==================== 单个设备操作 ====================

// 获取设备详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 添加租户过滤验证
    const tenantFilter = addTenantFilter(req, 'd');
    const [rows] = await db.execute(
      `SELECT d.* FROM iot_devices d WHERE d.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    // 获取关联的资产信息
    const locationTenantScope = buildTenantScopedClause(getTenantId(req), 'al');
    const [assets] = await db.execute(
      `SELECT a.id, a.asset_code, a.asset_name, al.device_id, al.last_update_time
       FROM asset_locations al
       ${IOT_DEVICE_ASSET_JOIN}
       WHERE al.device_id = ? AND al.is_active = 1${locationTenantScope.clause}`,
      [rows[0].device_id, ...locationTenantScope.params],
    );

    res.json({
      success: true,
      data: {
        ...rows[0],
        linked_assets: assets,
      },
    });
  } catch (error) {
    logIotDevicesError('获取设备详情失败', error, req, {
      deviceId: req.params?.id || null,
    });
    res.status(500).json({ success: false, message: '获取设备详情失败', error: error.message });
  }
});

// 创建设备
router.post('/', authenticate, async (req, res) => {
  try {
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
    } = req.body;

    if (!device_id || !device_name || !device_type) {
      return res.status(400).json({ success: false, message: '设备ID、名称和类型不能为空' });
    }

    // 验证设备类型是否有效
    const validDeviceTypes = ['RFID', 'GPS', '蓝牙', 'WiFi', 'UWB', '其他'];
    if (!validDeviceTypes.includes(device_type)) {
      return res.status(400).json({
        success: false,
        message: `设备类型无效，必须是以下之一：${validDeviceTypes.join('、')}`,
      });
    }

    // 验证状态是否有效
    const validStatuses = ['在线', '离线', '故障', '维护中'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `设备状态无效，必须是以下之一：${validStatuses.join('、')}`,
      });
    }

    const tenantId = getTenantId(req);
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

    res.json({
      success: true,
      message: '设备创建成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    logIotDevicesError('创建设备失败', error, req, {
      deviceId: req.body?.device_id || null,
      deviceType: req.body?.device_type || null,
    });
    iotDevicesTraceLog('错误堆栈:', error.stack);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: '设备ID已存在' });
    }
    res.status(500).json({
      success: false,
      message: '创建设备失败',
      error: error.message,
    });
  }
});

// 更新设备
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
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
    } = req.body;

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
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }

    // 验证设备类型（如果提供）
    if (device_type !== undefined) {
      const validDeviceTypes = ['RFID', 'GPS', '蓝牙', 'WiFi', 'UWB', '其他'];
      if (!validDeviceTypes.includes(device_type)) {
        return res.status(400).json({
          success: false,
          message: `设备类型无效，必须是以下之一：${validDeviceTypes.join('、')}`,
        });
      }
    }

    // 验证状态（如果提供）
    if (status !== undefined) {
      const validStatuses = ['在线', '离线', '故障', '维护中'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `设备状态无效，必须是以下之一：${validStatuses.join('、')}`,
        });
      }
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    // 验证设备是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'd');
    const [existing] = await db.execute(
      `SELECT id FROM iot_devices d WHERE d.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    await db.execute(
      `UPDATE iot_devices d SET ${updateFields.join(', ')} WHERE d.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [...updateValues, ...tenantFilter.params],
    );

    res.json({ success: true, message: '设备更新成功' });
  } catch (error) {
    logIotDevicesError('更新设备失败', error, req, {
      deviceId: req.params?.id || null,
    });
    res.status(500).json({ success: false, message: '更新设备失败', error: error.message });
  }
});

// 删除设备
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 验证设备是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'd');
    const [existing] = await db.execute(
      `SELECT d.id, d.device_id FROM iot_devices d WHERE d.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    const locationTenantScope = buildTenantScopedClause(getTenantId(req));
    const [linked] = await db.execute(
      `SELECT COUNT(*) as count FROM asset_locations WHERE device_id = ? AND is_active = 1${locationTenantScope.clause}`,
      [existing[0].device_id, ...locationTenantScope.params],
    );

    if (linked[0].count > 0) {
      return res.status(400).json({ success: false, message: '设备已关联资产，请先解绑后再删除' });
    }

    await db.execute(
      `DELETE d FROM iot_devices d WHERE d.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [id, ...tenantFilter.params],
    );

    res.json({ success: true, message: '设备删除成功' });
  } catch (error) {
    logIotDevicesError('删除设备失败', error, req, {
      deviceId: req.params?.id || null,
    });
    res.status(500).json({ success: false, message: '删除设备失败', error: error.message });
  }
});

// ==================== 资产设备关联 ====================

// 关联设备到资产
router.post('/assets/:assetCode/link', authenticate, async (req, res) => {
  try {
    const { assetCode } = req.params;
    const { device_id, device_type } = req.body;

    if (!device_id || !device_type) {
      return res.status(400).json({ success: false, message: '设备ID和类型不能为空' });
    }

    // 检查设备是否存在
    // 添加租户过滤验证
    const tenantFilter = addTenantFilter(req, 'd');
    const [devices] = await db.execute(
      `SELECT d.id FROM iot_devices d WHERE d.device_id = ? ${tenantFilter.whereClause}`,
      [device_id, ...tenantFilter.params],
    );
    if (devices.length === 0) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    // 检查资产是否存在
    const assetTenantFilter = addTenantFilter(req, 'a');
    const [assets] = await db.execute(
      `SELECT asset_code FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
      [assetCode, ...assetTenantFilter.params],
    );
    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    // 检查设备是否已关联其他资产
    const tenantId = getTenantId(req);
    const locationTenantScope = buildTenantScopedClause(tenantId);
    const [existing] = await db.execute(
      `SELECT asset_code FROM asset_locations WHERE device_id = ? AND is_active = 1${locationTenantScope.clause}`,
      [device_id, ...locationTenantScope.params],
    );
    if (existing.length > 0 && existing[0].asset_code !== assetCode) {
      return res.status(400).json({ success: false, message: '该设备已关联其他资产' });
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
        [device_id, device_type, tenantId, assetCode, ...locationTenantScope.params],
      );
    } else {
      // 创建新的位置记录
      await db.execute(
        `INSERT INTO asset_locations (asset_code, device_id, device_type, last_update_time, is_active, tenant_id)
         VALUES (?, ?, ?, NOW(), 1, ?)`,
        [assetCode, device_id, device_type, tenantId],
      );
    }

    // 更新设备状态为在线（使用上面已声明的tenantFilter）
    await db.execute(
      `UPDATE iot_devices d SET d.status = ?, d.last_online_time = NOW() WHERE d.device_id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      ['在线', device_id, ...tenantFilter.params],
    );

    res.json({ success: true, message: '设备关联成功' });
  } catch (error) {
    logIotDevicesError('关联设备失败', error, req, {
      assetCode: req.params?.assetCode || null,
      deviceId: req.body?.device_id || null,
    });
    res.status(500).json({ success: false, message: '关联设备失败', error: error.message });
  }
});

// 解绑设备
router.post('/assets/:assetCode/unlink', authenticate, async (req, res) => {
  try {
    const { assetCode } = req.params;
    const { device_id } = req.body;

    if (!device_id) {
      return res.status(400).json({ success: false, message: '设备ID不能为空' });
    }

    // 获取资产信息
    const assetTenantFilter = addTenantFilter(req, 'a');
    const [assets] = await db.execute(
      `SELECT asset_code FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
      [assetCode, ...assetTenantFilter.params],
    );
    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const locationTenantScope = buildTenantScopedClause(getTenantId(req));
    await db.execute(
      `UPDATE asset_locations
       SET device_id = NULL, device_type = NULL, updated_at = NOW()
       WHERE asset_code = ? AND device_id = ?${locationTenantScope.clause}`,
      [assetCode, device_id, ...locationTenantScope.params],
    );

    res.json({ success: true, message: '设备解绑成功' });
  } catch (error) {
    logIotDevicesError('解绑设备失败', error, req, {
      assetCode: req.params?.assetCode || null,
      deviceId: req.body?.device_id || null,
    });
    res.status(500).json({ success: false, message: '解绑设备失败', error: error.message });
  }
});

// 获取资产的关联设备
router.get('/assets/:assetCode/devices', authenticate, async (req, res) => {
  try {
    const { assetCode } = req.params;

    // 获取资产信息
    const assetTenantFilter = addTenantFilter(req, 'a');
    const [assets] = await db.execute(
      `SELECT asset_code FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
      [assetCode, ...assetTenantFilter.params],
    );
    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const locationTenantScope = buildTenantScopedClause(getTenantId(req), 'al');
    const [rows] = await db.execute(
      `SELECT d.*, al.last_update_time as linked_time
       FROM asset_locations al
       ${IOT_DEVICE_LINKED_DEVICE_JOIN}
       WHERE al.asset_code = ? AND al.is_active = 1 AND al.device_id IS NOT NULL${locationTenantScope.clause}`,
      [assetCode, ...locationTenantScope.params],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    logIotDevicesError('获取资产设备失败', error, req, {
      assetCode: req.params?.assetCode || null,
    });
    res.status(500).json({ success: false, message: '获取资产设备失败', error: error.message });
  }
});

// ==================== 硬件数据接口（外部设备使用） ====================

// 硬件数据上报接口（无需用户登录，使用 IoT 上报令牌验证）
router.post('/:deviceId/data', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const {
      latitude,
      longitude,
      altitude,
      signal_strength,
      battery_level,
      temperature,
      humidity,
      other_data,
    } = req.body;

    if (
      !(await verifyIngestToken(req, res, {
        moduleName: 'IoT设备数据',
        scope: 'iot-devices',
      }))
    ) {
      return;
    }

    const latitudeResult = validateCoordinate('latitude', latitude, -90, 90);
    if (!latitudeResult.valid) {
      return res.status(400).json({ success: false, message: latitudeResult.message });
    }

    const longitudeResult = validateCoordinate('longitude', longitude, -180, 180);
    if (!longitudeResult.valid) {
      return res.status(400).json({ success: false, message: longitudeResult.message });
    }

    // 验证设备是否存在（添加租户过滤验证）
    const tenantFilter = buildTenantScopedClause(req.iotAuth?.tenant_id || getTenantId(req), 'd');
    const [devices] = await db.execute(
      `SELECT d.id, d.device_id, d.device_type, d.status, d.tenant_id
       FROM iot_devices d
       WHERE d.device_id = ? ${tenantFilter.clause}`,
      [deviceId, ...tenantFilter.params],
    );
    if (devices.length === 0) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    const device = devices[0];
    const locationTenantScope = buildTenantScopedClause(device.tenant_id);

    // 更新设备状态为在线
    await db.execute(
      `UPDATE iot_devices d SET status = ?, last_online_time = NOW() WHERE d.device_id = ? ${tenantFilter.clause}`,
      ['在线', deviceId, ...tenantFilter.params],
    );

    // 查找关联的资产
    const [locations] = await db.execute(
      `SELECT asset_code FROM asset_locations WHERE device_id = ? AND is_active = 1${locationTenantScope.clause}`,
      [deviceId, ...locationTenantScope.params],
    );

    if (locations.length > 0) {
      const assetCode = locations[0].asset_code;

      // 如果有位置信息，更新资产位置
      if (latitudeResult.value !== null && longitudeResult.value !== null) {
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
              latitudeResult.value,
              longitudeResult.value,
              altitude ? parseFloat(altitude) : null,
              signal_strength ? parseInt(signal_strength) : null,
              battery_level ? parseInt(battery_level) : null,
              device.tenant_id,
              assetCode,
              ...locationTenantScope.params,
            ],
          );

          // 记录位置历史（包含device_id）
          await db.execute(
            `INSERT INTO asset_location_history (
              asset_code, device_id, device_type, latitude, longitude, altitude,
              signal_strength, battery_level, record_time, update_source, tenant_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), '设备自动上报', ?)`,
            [
              assetCode,
              deviceId,
              device.device_type || null,
              latitudeResult.value,
              longitudeResult.value,
              altitude ? parseFloat(altitude) : null,
              signal_strength ? parseInt(signal_strength) : null,
              battery_level ? parseInt(battery_level) : null,
              device.tenant_id,
            ],
          );
        }
      }
    }

    // 存储设备数据（如果有设备数据表）
    // 这里可以扩展存储温度、湿度等其他传感器数据

    res.json({
      success: true,
      message: '数据上报成功',
      data: {
        device_id: deviceId,
        received_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    logIotDevicesError('数据上报失败', error, req, {
      deviceId: req.params?.deviceId || null,
    });
    res.status(500).json({ success: false, message: '数据上报失败', error: error.message });
  }
});

module.exports = router;
