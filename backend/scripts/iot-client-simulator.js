#!/usr/bin/env node
/**
 * 物联网模块模拟客户端：向服务端发送设备上报数据，用于测试接入链路。
 *
 * 用法：
 *   1) 先做种子数据并拿到 Token（仅需一次）：
 *      node scripts/iot-client-simulator.js --seed
 *   2) 使用 Token 发送模拟数据（可多次）：
 *      IOT_INGEST_TOKEN=<上一步输出的token> node scripts/iot-client-simulator.js
 *   或指定参数：
 *      node scripts/iot-client-simulator.js --base-url http://localhost:5174 --token <token> --device-id SIM-001
 *
 * 环境变量：
 *   BASE_URL           API 根地址，默认 http://localhost:5174
 *   IOT_INGEST_TOKEN   上报用 Token（与后端 iot_tenant_tokens 或 IOT_*_INGEST_TOKEN 一致）
 *   DEVICE_ID          模拟设备 ID，默认 SIM-DEVICE-001
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';
const API_PREFIX = '/api/iot';
const DEFAULT_DEVICE_ID = process.env.DEVICE_ID || 'SIM-DEVICE-001';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { seed: false, baseUrl: BASE_URL, token: process.env.IOT_INGEST_TOKEN || '', deviceId: DEFAULT_DEVICE_ID };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed') out.seed = true;
    else if (args[i] === '--base-url' && args[i + 1]) {
      out.baseUrl = args[++i];
    } else if (args[i] === '--token' && args[i + 1]) {
      out.token = args[++i];
    } else if (args[i] === '--device-id' && args[i + 1]) {
      out.deviceId = args[++i];
    }
  }
  return out;
}

function hashIotToken(rawToken) {
  const pepper = String(process.env.IOT_TOKEN_PEPPER || process.env.JWT_SECRET || '').trim();
  if (!pepper) {
    throw new Error('缺少 IOT_TOKEN_PEPPER 或 JWT_SECRET，无法生成 IoT 令牌哈希');
  }
  return crypto.createHash('sha256').update(`${rawToken}:${pepper}`).digest('hex');
}

async function seedDatabase(deviceId) {
  const db = require('../config/database');

  const [tenants] = await db.execute('SELECT id FROM tenants ORDER BY id ASC LIMIT 1');
  if (!tenants || tenants.length === 0) {
    throw new Error('未找到租户，请先创建企业/租户');
  }
  const tenantId = tenants[0].id;

  let assetCode;
  const [assets] = await db.execute(
    'SELECT asset_code FROM assets WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1',
    [tenantId],
  );
  if (assets && assets.length > 0) {
    assetCode = assets[0].asset_code;
  } else {
    let categoryId;
    const [cats] = await db.execute(
      'SELECT id FROM asset_categories WHERE tenant_id = ? ORDER BY id ASC LIMIT 1',
      [tenantId],
    );
    if (cats && cats.length > 0) {
      categoryId = cats[0].id;
    } else {
      const [ins] = await db.execute(
        `INSERT INTO asset_categories (tenant_id, name, code, parent_id, description)
         VALUES (?, 'IoT模拟分类', 'IOT-SIM', 0, 'iot-client-simulator')`,
        [tenantId],
      );
      categoryId = ins.insertId;
    }
    assetCode = `IOT-SIM-${Date.now().toString().slice(-6)}`;
    await db.execute(
      `INSERT INTO assets (
        tenant_id, asset_code, asset_name, category_id, purchase_price, current_value, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, assetCode, 'IoT模拟资产', categoryId, 10000, 10000, '在用', 1],
    );
  }

  const [devRows] = await db.execute(
    'SELECT id FROM iot_devices WHERE tenant_id = ? AND device_id = ? LIMIT 1',
    [tenantId, deviceId],
  );
  if (devRows.length === 0) {
    await db.execute(
      `INSERT INTO iot_devices (
        tenant_id, device_id, device_name, device_type, status, remark
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, deviceId, `模拟设备-${deviceId}`, 'GPS', '在线', 'iot-client-simulator'],
    );
  }

  const [locRows] = await db.execute(
    'SELECT id FROM asset_locations WHERE tenant_id = ? AND asset_code = ? AND is_active = 1 LIMIT 1',
    [tenantId, assetCode],
  );
  if (locRows.length > 0) {
    await db.execute(
      'UPDATE asset_locations SET device_id = ?, device_type = ?, updated_at = NOW(), last_update_time = NOW() WHERE id = ?',
      [deviceId, 'GPS', locRows[0].id],
    );
  } else {
    await db.execute(
      `INSERT INTO asset_locations (
        tenant_id, asset_code, device_id, device_type, floor_number, building_name,
        room_number, area_name, latitude, longitude, last_update_time, is_active
      ) VALUES (?, ?, ?, ?, 3, '模拟楼', '101', '模拟区', 41.83, 123.46, NOW(), 1)`,
      [tenantId, assetCode, deviceId, 'GPS'],
    );
  }

  const locationCode = 'SIM-LOC-01';
  try {
    const [lcRows] = await db.execute(
      'SELECT id FROM location_codes WHERE location_code = ? AND is_active = 1 LIMIT 1',
      [locationCode],
    );
    if (lcRows.length === 0) {
      await db.execute(
        `INSERT INTO location_codes (tenant_id, location_code, location_name, area_name, building_name, floor_number, latitude, longitude, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [tenantId, locationCode, '模拟信标位置', '模拟区', '模拟楼', 3, 41.83, 123.46],
      );
    }
  } catch (e) {
    // location_codes 表可能不存在，忽略
  }

  const rawToken = `iot_sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const tokenHash = hashIotToken(rawToken);
  const tokenPrefix = `${rawToken.slice(0, 8)}...${rawToken.slice(-4)}`;
  await db.execute(
    `INSERT INTO iot_tenant_tokens (
      tenant_id, token_name, token_hash, token_prefix, scope_json, status, created_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'active', 'iot-client-simulator', NOW())`,
    [tenantId, `sim-${Date.now()}`, tokenHash, tokenPrefix, JSON.stringify(['all'])],
  );

  await db.end().catch(() => {});
  return { rawToken, assetCode, tenantId };
}

async function sendPayload({ baseUrl, token, deviceId, assetCode }) {
  const base = baseUrl.replace(/\/$/, '') + API_PREFIX;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-iot-token'] = token;

  const results = [];

  const run = async (name, method, url, data) => {
    try {
      const res = await axios({ method, url, data, headers, timeout: 10000 });
      results.push({ name, ok: true, status: res.status, data: res.data });
      console.log(`[OK] ${name} -> ${res.status}`);
    } catch (err) {
      const status = err.response?.status;
      const body = err.response?.data;
      results.push({ name, ok: false, status, body });
      console.log(`[FAIL] ${name} -> ${status || err.message}`, body ? JSON.stringify(body).slice(0, 200) : '');
    }
  };

  const now = new Date().toISOString();

  await run(
    '地理定位(设备位置)',
    'post',
    `${base}/location/devices/${encodeURIComponent(deviceId)}/data`,
    {
      latitude: 41.833956,
      longitude: 123.461925,
      altitude: 0,
      signal_strength: -65,
      battery_level: 91,
      other_data: { source: 'iot-client-simulator', ts: now },
    },
  );

  await run(
    '信标位置(beacon-location)',
    'post',
    `${base}/location/beacon-location`,
    { device_id: deviceId, location_code: 'SIM-LOC-01' },
  );

  await run(
    '区域定位(zone-location)',
    'post',
    `${base}/zone-location/ingest`,
    {
      device_id: deviceId,
      asset_code: assetCode || undefined,
      location_code: 'SIM-LOC-01',
      area_name: '模拟区',
      building_name: '模拟楼',
      floor_number: 3,
      rssi: -70,
      battery_level: 90,
      event_time: now,
    },
  );

  await run(
    '资产监测(asset-monitoring)',
    'post',
    `${base}/asset-monitoring/ingest`,
    {
      device_id: deviceId,
      asset_code: assetCode || undefined,
      runtime_state: 'running',
      signal_strength: -72,
      battery_level: 88,
      cpu_usage: 25.5,
      memory_usage: 60.2,
      event_time: now,
    },
  );

  await run(
    '环境监测(environment-monitoring)',
    'post',
    `${base}/environment-monitoring/ingest`,
    {
      device_id: deviceId,
      asset_code: assetCode || undefined,
      temperature: 23.1,
      humidity: 46.2,
      pressure: 1013.2,
      battery_level: 85,
      event_time: now,
    },
  );

  return results;
}

async function main() {
  const { seed, baseUrl, token, deviceId } = parseArgs();

  if (seed) {
    console.log('执行种子数据（设备、资产、绑定、位置编码、Token）...');
    const { rawToken, assetCode } = await seedDatabase(deviceId);
    console.log('\n种子数据已就绪。请使用以下 Token 调用模拟发送：');
    console.log(`  IOT_INGEST_TOKEN=${  rawToken  } node scripts/iot-client-simulator.js`);
    console.log('或：');
    console.log(`  node scripts/iot-client-simulator.js --token ${  rawToken}`);
    console.log('\n可选：--device-id', deviceId, '--base-url', baseUrl);
    console.log('资产编码（用于前端查看）:', assetCode);
    return;
  }

  if (!token) {
    console.error('请设置 IOT_INGEST_TOKEN 或使用 --token <token>。可先执行 --seed 生成 Token。');
    process.exitCode = 1;
    return;
  }

  let assetCode = null;
  try {
    const db = require('../config/database');
    const [rows] = await db.execute(
      `SELECT al.asset_code FROM asset_locations al
       INNER JOIN iot_devices d ON al.device_id = d.device_id AND al.tenant_id = d.tenant_id
       WHERE d.device_id = ? AND al.is_active = 1 LIMIT 1`,
      [deviceId],
    );
    if (rows && rows.length > 0) assetCode = rows[0].asset_code;
    await db.end().catch(() => {});
  } catch (_error) {
    // Device lookup is optional for the simulator.
  }

  console.log('模拟物联网客户端发送数据 ->', baseUrl, 'device:', deviceId);
  const results = await sendPayload({ baseUrl, token, deviceId, assetCode });
  const failed = results.filter(r => !r.ok);
  if (failed.length > 0) {
    console.log('\n失败项:', failed.map(f => f.name).join(', '));
    process.exitCode = 1;
  } else {
    console.log('\n全部上报成功。');
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
