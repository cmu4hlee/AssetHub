#!/usr/bin/env node
const db = require('../config/database');

const DEVICE_PRESETS = [
  {
    device_id: 'TEST001',
    device_name: '区域定位信标-TEST001',
    device_type: '蓝牙',
    status: '在线',
  },
  {
    device_id: 'ENV001',
    device_name: '环境监测探头-ENV001',
    device_type: 'WiFi',
    status: '在线',
  },
  {
    device_id: 'MON001',
    device_name: '资产状态探头-MON001',
    device_type: 'WiFi',
    status: '在线',
  },
];

async function getTenantId() {
  const [rows] = await db.execute('SELECT id FROM tenants ORDER BY id ASC LIMIT 1');
  if (!rows || rows.length === 0) {
    throw new Error('未找到租户，请先创建企业/租户');
  }
  return rows[0].id;
}

async function getAssetCode(tenantId) {
  const [rows] = await db.execute(
    'SELECT asset_code FROM assets WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1',
    [tenantId],
  );
  if (!rows || rows.length === 0) {
    return '';
  }
  return rows[0].asset_code;
}

async function ensureCategoryId(tenantId) {
  const [rows] = await db.execute(
    'SELECT id FROM asset_categories WHERE tenant_id = ? ORDER BY id ASC LIMIT 1',
    [tenantId],
  );
  if (rows.length > 0) {
    return rows[0].id;
  }

  const [insert] = await db.execute(
    `INSERT INTO asset_categories (tenant_id, name, code, parent_id, description)
     VALUES (?, 'IoT测试分类', 'IOT-DEMO', 0, '自动创建的IoT演示分类')`,
    [tenantId],
  );
  return insert.insertId;
}

async function ensureAssetCode(tenantId) {
  const existing = await getAssetCode(tenantId);
  if (existing) {
    return existing;
  }

  const categoryId = await ensureCategoryId(tenantId);
  const assetCode = `IOT-DEMO-${Date.now().toString().slice(-6)}`;
  await db.execute(
    `INSERT INTO assets (
      tenant_id, asset_code, asset_name, category_id, purchase_price, current_value, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, assetCode, 'IoT演示资产', categoryId, 10000, 10000, '在用', 1],
  );
  return assetCode;
}

async function upsertDevice(tenantId, preset) {
  const [exists] = await db.execute(
    'SELECT id FROM iot_devices WHERE tenant_id = ? AND device_id = ? LIMIT 1',
    [tenantId, preset.device_id],
  );

  if (exists.length > 0) {
    await db.execute(
      `UPDATE iot_devices
       SET device_name = ?, device_type = ?, status = ?, updated_at = NOW()
       WHERE tenant_id = ? AND device_id = ?`,
      [preset.device_name, preset.device_type, preset.status, tenantId, preset.device_id],
    );
    return;
  }

  await db.execute(
    `INSERT INTO iot_devices (
      tenant_id, device_id, device_name, device_type, status, remark
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, preset.device_id, preset.device_name, preset.device_type, preset.status, 'demo-seeded'],
  );
}

async function bindAssetLocation(tenantId, assetCode, deviceId, deviceType) {
  const [exists] = await db.execute(
    'SELECT id FROM asset_locations WHERE tenant_id = ? AND asset_code = ? AND is_active = 1 LIMIT 1',
    [tenantId, assetCode],
  );

  if (exists.length > 0) {
    await db.execute(
      `UPDATE asset_locations
       SET device_id = ?, device_type = ?, updated_at = NOW(), last_update_time = NOW()
       WHERE id = ?`,
      [deviceId, deviceType, exists[0].id],
    );
    return;
  }

  await db.execute(
    `INSERT INTO asset_locations (
      tenant_id, asset_code, device_id, device_type, floor_number, building_name,
      room_number, area_name, address, latitude, longitude, location_accuracy,
      signal_strength, update_source, last_update_time, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)`,
    [
      tenantId,
      assetCode,
      deviceId,
      deviceType,
      3,
      '住院楼B1',
      '308',
      '影像科CT区',
      '中国医科大学附属第四医院',
      41.833956,
      123.461925,
      2.5,
      -58,
      '设备自动上报',
    ],
  );
}

async function seedZoneData(tenantId, assetCode) {
  const now = Date.now();
  for (let i = 0; i < 20; i += 1) {
    const eventAt = new Date(now - (20 - i) * 3 * 60 * 1000);
    await db.execute(
      `INSERT INTO iot_zone_location_ts (
        tenant_id, device_id, asset_code, location_code, area_name, building_name,
        floor_number, rssi, accuracy, battery_level, event_time, ingest_source, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        'TEST001',
        assetCode,
        `B1-3F-R${300 + i}`,
        i % 2 === 0 ? '影像科CT区' : '影像科MRI区',
        '住院楼B1',
        3,
        -72 + i,
        1.2 + (i % 4) * 0.15,
        95 - i,
        eventAt,
        'seed',
        JSON.stringify({ source: 'seed-iot-demo-data', seq: i }),
      ],
    );
  }
}

async function seedEnvironmentData(tenantId, assetCode) {
  const now = Date.now();
  for (let i = 0; i < 20; i += 1) {
    const eventAt = new Date(now - (20 - i) * 3 * 60 * 1000);
    await db.execute(
      `INSERT INTO iot_environment_monitor_ts (
        tenant_id, device_id, asset_code, temperature, humidity, pressure, co2, pm25, voc,
        battery_level, event_time, ingest_source, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        'ENV001',
        assetCode,
        22 + (i % 6) * 0.4,
        45 + (i % 5) * 1.1,
        1012 + (i % 3) * 0.7,
        520 + i * 6,
        10 + (i % 4) * 1.3,
        0.12 + (i % 4) * 0.03,
        90 - i,
        eventAt,
        'seed',
        JSON.stringify({ source: 'seed-iot-demo-data', seq: i }),
      ],
    );
  }
}

async function seedAssetMonitoringData(tenantId, assetCode) {
  const now = Date.now();
  for (let i = 0; i < 20; i += 1) {
    const eventAt = new Date(now - (20 - i) * 3 * 60 * 1000);
    await db.execute(
      `INSERT INTO iot_asset_monitor_ts (
        tenant_id, device_id, asset_code, runtime_state, signal_strength, battery_level,
        cpu_usage, memory_usage, error_code, event_time, ingest_source, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        'MON001',
        assetCode,
        i % 7 === 0 ? 'warning' : 'running',
        -58 - (i % 6),
        92 - i,
        25 + (i % 5) * 5.2,
        40 + (i % 4) * 7.5,
        i % 11 === 0 ? 'E-LOW-SIGNAL' : null,
        eventAt,
        'seed',
        JSON.stringify({ source: 'seed-iot-demo-data', seq: i }),
      ],
    );
  }
}

async function main() {
  try {
    const tenantId = await getTenantId();
    const assetCode = await ensureAssetCode(tenantId);

    for (const preset of DEVICE_PRESETS) {
      await upsertDevice(tenantId, preset);
    }

    await bindAssetLocation(tenantId, assetCode, 'TEST001', '蓝牙');
    await seedZoneData(tenantId, assetCode);
    await seedEnvironmentData(tenantId, assetCode);
    await seedAssetMonitoringData(tenantId, assetCode);

    console.log('✅ IoT 演示数据写入完成');
    console.log(`tenant_id: ${tenantId}`);
    console.log(`asset_code: ${assetCode}`);
    console.log('device_ids: TEST001 / ENV001 / MON001');
  } catch (error) {
    console.error('❌ IoT 演示数据写入失败:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end().catch(() => {});
  }
}

main()
  .catch(error => {
    console.error('❌ IoT 演示数据写入异常:', error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode || 0);
  });
