const db = require('../../../config/database');
const locationService = require('./location.service');

const normalizeString = value => (typeof value === 'string' ? value.trim() : value);

class ZoneLocationPipelineService {
  constructor() {
    this.initialized = false;
    this.kafkaProducer = null;
    this.kafkaClient = null;
    this.mqttClient = null;
  }

  async init() {
    if (this.initialized) {
      return;
    }
    try {
      await this.ensureTimeSeriesTable();
    } catch (error) {
      console.error('[ZoneLocation] 时序表初始化失败:', error.message);
    }
    try {
      await this.initKafkaProducer();
    } catch (error) {
      console.warn('[ZoneLocation] Kafka 初始化跳过:', error.message);
    }
    try {
      await this.initMqttSubscriber();
    } catch (error) {
      console.warn('[ZoneLocation] MQTT 初始化跳过:', error.message);
    }
    this.initialized = true;
  }

  async ensureTimeSeriesTable() {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS iot_zone_location_ts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        device_id VARCHAR(100) NOT NULL,
        asset_code VARCHAR(100) NULL,
        location_code VARCHAR(100) NULL,
        area_name VARCHAR(200) NULL,
        building_name VARCHAR(200) NULL,
        floor_number INT NULL,
        rssi INT NULL,
        accuracy DECIMAL(10, 2) NULL,
        battery_level INT NULL,
        event_time DATETIME NOT NULL,
        ingest_source VARCHAR(50) NOT NULL DEFAULT 'http',
        payload_json LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_zone_ts_tenant_device_time (tenant_id, device_id, event_time),
        INDEX idx_zone_ts_asset_time (asset_code, event_time),
        INDEX idx_zone_ts_location_code_time (location_code, event_time),
        INDEX idx_zone_ts_event_time (event_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='区域定位时序数据表';
    `);
  }

  async initKafkaProducer() {
    if (process.env.IOT_ZONE_KAFKA_ENABLED !== 'true') {
      return;
    }

    try {
      // 延迟加载，避免未安装依赖导致服务启动失败
      const { Kafka } = require('kafkajs');
      const brokers = (process.env.IOT_ZONE_KAFKA_BROKERS || '127.0.0.1:9092')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

      this.kafkaClient = new Kafka({
        clientId: process.env.IOT_ZONE_KAFKA_CLIENT_ID || 'assettube-zone-location',
        brokers,
      });

      this.kafkaProducer = this.kafkaClient.producer();
      await this.kafkaProducer.connect();
      console.log('[ZoneLocation] Kafka producer connected:', brokers.join(','));
    } catch (error) {
      console.warn('[ZoneLocation] Kafka init skipped:', error.message);
      this.kafkaProducer = null;
    }
  }

  async initMqttSubscriber() {
    if (process.env.IOT_ZONE_MQTT_ENABLED !== 'true') {
      return;
    }

    try {
      // 延迟加载，避免未安装依赖导致服务启动失败
      const mqtt = require('mqtt');
      const brokerUrl = process.env.IOT_ZONE_MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';
      const topic = process.env.IOT_ZONE_MQTT_TOPIC || 'iot/zone/+/up';

      this.mqttClient = mqtt.connect(brokerUrl, {
        username: process.env.IOT_ZONE_MQTT_USERNAME || undefined,
        password: process.env.IOT_ZONE_MQTT_PASSWORD || undefined,
      });

      this.mqttClient.on('connect', () => {
        this.mqttClient.subscribe(topic, err => {
          if (err) {
            console.error('[ZoneLocation] MQTT subscribe failed:', err.message);
            return;
          }
          console.log('[ZoneLocation] MQTT subscribed:', topic);
        });
      });

      this.mqttClient.on('message', async (receivedTopic, messageBuffer) => {
        try {
          const payload = JSON.parse(messageBuffer.toString('utf-8'));
          await this.ingestEvent(payload, 'mqtt', { mqtt_topic: receivedTopic });
        } catch (error) {
          console.error('[ZoneLocation] MQTT message process failed:', error.message);
        }
      });

      this.mqttClient.on('error', error => {
        console.error('[ZoneLocation] MQTT client error:', error.message);
      });
    } catch (error) {
      console.warn('[ZoneLocation] MQTT init skipped:', error.message);
      this.mqttClient = null;
    }
  }

  normalizePayload(rawPayload = {}) {
    const values =
      rawPayload && typeof rawPayload.values === 'object' && rawPayload.values
        ? rawPayload.values
        : {};
    const merged = { ...values, ...rawPayload };

    const eventTime =
      merged.event_time ||
      merged.eventTime ||
      (merged.ts ? new Date(Number(merged.ts)).toISOString() : undefined);

    return {
      device_id: normalizeString(merged.device_id || merged.deviceId),
      asset_code: normalizeString(merged.asset_code || merged.assetCode),
      location_code: normalizeString(merged.location_code || merged.locationCode),
      area_name: normalizeString(merged.area_name || merged.areaName),
      building_name: normalizeString(merged.building_name || merged.buildingName),
      floor_number: merged.floor_number ?? merged.floorNumber,
      rssi: merged.rssi,
      accuracy: merged.accuracy,
      battery_level: merged.battery_level ?? merged.batteryLevel,
      event_time: eventTime,
      payload: merged,
    };
  }

  normalizeEventTime(eventTimeInput) {
    const eventTime = eventTimeInput ? new Date(eventTimeInput) : new Date();
    return Number.isNaN(eventTime.getTime()) ? new Date() : eventTime;
  }

  parseIntSafe(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  parseFloatSafe(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  buildPayloadJson(payload, meta) {
    if (process.env.IOT_PIPELINE_DISABLE_RAW_PAYLOAD === 'true') {
      return null;
    }
    return JSON.stringify({ ...payload, ...meta });
  }

  async resolveDeviceMap(deviceIds) {
    const uniqueIds = Array.from(new Set((deviceIds || []).filter(Boolean)));
    if (uniqueIds.length === 0) return new Map();

    const placeholders = uniqueIds.map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT device_id, tenant_id, device_type
       FROM iot_devices
       WHERE device_id IN (${placeholders})`,
      uniqueIds,
    );
    return new Map(rows.map(item => [item.device_id, item]));
  }

  async resolveAssetByDeviceMap(deviceIds) {
    const uniqueIds = Array.from(new Set((deviceIds || []).filter(Boolean)));
    if (uniqueIds.length === 0) return new Map();

    const placeholders = uniqueIds.map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT device_id, asset_code
       FROM asset_locations
       WHERE is_active = 1 AND device_id IN (${placeholders})
       ORDER BY last_update_time DESC`,
      uniqueIds,
    );

    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.device_id)) {
        map.set(row.device_id, row.asset_code || null);
      }
    }
    return map;
  }

  async insertBatchRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const chunkSize = Math.max(parseInt(process.env.IOT_BATCH_INSERT_CHUNK_SIZE || '300', 10), 50);

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
      const values = chunk.flat();
      await db.execute(
        `INSERT INTO iot_zone_location_ts (
          tenant_id, device_id, asset_code, location_code, area_name, building_name,
          floor_number, rssi, accuracy, battery_level, event_time, ingest_source, payload_json
        ) VALUES ${placeholders}`,
        values,
      );
    }
  }

  async publishKafkaEventsBatch(eventPayloads) {
    if (!this.kafkaProducer || !Array.isArray(eventPayloads) || eventPayloads.length === 0) {
      return false;
    }

    const topic = process.env.IOT_ZONE_KAFKA_TOPIC || 'iot.zone.location.raw';
    const chunkSize = Math.max(parseInt(process.env.IOT_KAFKA_BATCH_SIZE || '500', 10), 50);

    try {
      for (let i = 0; i < eventPayloads.length; i += chunkSize) {
        const chunk = eventPayloads.slice(i, i + chunkSize);
        await this.kafkaProducer.send({
          topic,
          messages: chunk.map(item => ({
            key: item.device_id,
            value: JSON.stringify(item),
          })),
        });
      }
      return true;
    } catch (error) {
      console.error('[ZoneLocation] Kafka batch publish failed:', error.message);
      return false;
    }
  }

  async ingestEvent(rawPayload, source = 'http', meta = {}) {
    const batchResult = await this.ingestBatch([rawPayload], source, meta);
    if (batchResult.success !== 1 || !batchResult.results[0]?.success) {
      throw new Error(batchResult.results[0]?.message || '区域定位数据接收失败');
    }
    return batchResult.results[0].data;
  }

  async ingestBatch(rawEvents = [], source = 'http_batch', meta = {}) {
    await this.init();
    const events = Array.isArray(rawEvents) ? rawEvents : [];
    if (events.length === 0) {
      return { total: 0, success: 0, failed: 0, results: [] };
    }

    const normalizedEvents = events.map(item => this.normalizePayload(item || {}));
    const deviceMap = await this.resolveDeviceMap(normalizedEvents.map(item => item.device_id));
    const assetByDeviceMap = await this.resolveAssetByDeviceMap(normalizedEvents.map(item => item.device_id));
    const expectedTenantId = meta?.iot_auth_tenant_id ? Number(meta.iot_auth_tenant_id) : null;

    const results = [];
    const insertRows = [];
    const kafkaEvents = [];

    for (const payload of normalizedEvents) {
      if (!payload.device_id) {
        results.push({ success: false, message: 'device_id 不能为空' });
        continue;
      }

      if (!payload.location_code && !payload.area_name) {
        results.push({ success: false, message: 'location_code 和 area_name 不能同时为空' });
        continue;
      }

      const device = deviceMap.get(payload.device_id);
      if (!device) {
        results.push({ success: false, message: '设备不存在' });
        continue;
      }
      if (
        expectedTenantId !== null &&
        Number.isFinite(expectedTenantId) &&
        Number(device.tenant_id) !== expectedTenantId
      ) {
        results.push({ success: false, message: '设备租户与令牌所属企业不一致' });
        continue;
      }

      let assetCode = payload.asset_code || null;
      let locationUpdateResult = null;
      if (payload.location_code) {
        try {
          locationUpdateResult = await locationService.handleBeaconLocationReport(
            payload.device_id,
            payload.location_code,
            { expectedTenantId },
          );
          assetCode = locationUpdateResult?.asset_code || assetCode;
        } catch (error) {
          results.push({ success: false, message: error.message || '区域定位更新失败' });
          continue;
        }
      }
      if (!assetCode) {
        assetCode = assetByDeviceMap.get(payload.device_id) || null;
      }

      const normalizedEventTime = this.normalizeEventTime(payload.event_time);
      const payloadJson = this.buildPayloadJson(payload.payload, meta);

      insertRows.push([
        device.tenant_id,
        payload.device_id,
        assetCode,
        payload.location_code || null,
        payload.area_name || null,
        payload.building_name || null,
        this.parseIntSafe(payload.floor_number),
        this.parseIntSafe(payload.rssi),
        this.parseFloatSafe(payload.accuracy),
        this.parseIntSafe(payload.battery_level),
        normalizedEventTime,
        source,
        payloadJson,
      ]);

      const eventData = {
        tenant_id: device.tenant_id,
        device_id: payload.device_id,
        asset_code: assetCode,
        location_code: payload.location_code || null,
        event_time: normalizedEventTime.toISOString(),
        source,
        location_update: locationUpdateResult,
      };

      kafkaEvents.push({
        ...eventData,
        payload: payloadJson ? JSON.parse(payloadJson) : { ...payload.payload, ...meta },
      });
      results.push({ success: true, data: eventData });
    }

    if (insertRows.length > 0) {
      await this.insertBatchRows(insertRows);
      await this.publishKafkaEventsBatch(kafkaEvents);
    }

    const successCount = results.filter(item => item.success).length;
    return {
      total: events.length,
      success: successCount,
      failed: events.length - successCount,
      results,
    };
  }

  async publishKafkaEvent(eventPayload) {
    if (!this.kafkaProducer) {
      return false;
    }

    const topic = process.env.IOT_ZONE_KAFKA_TOPIC || 'iot.zone.location.raw';

    try {
      await this.kafkaProducer.send({
        topic,
        messages: [
          {
            key: eventPayload.device_id,
            value: JSON.stringify(eventPayload),
          },
        ],
      });
      return true;
    } catch (error) {
      console.error('[ZoneLocation] Kafka publish failed:', error.message);
      return false;
    }
  }

  async getLatestByDevice(deviceId, tenantId) {
    const [rows] = await db.execute(
      `SELECT * FROM iot_zone_location_ts
       WHERE tenant_id = ? AND device_id = ?
       ORDER BY event_time DESC
       LIMIT 1`,
      [tenantId, deviceId],
    );

    return rows.length > 0 ? rows[0] : null;
  }

  async getAssetSeries(assetCode, tenantId, query = {}) {
    const limit = Math.min(parseInt(query.limit || 200, 10), 1000);
    const params = [tenantId, assetCode];
    let whereClause = 'WHERE tenant_id = ? AND asset_code = ?';

    if (query.start_time) {
      whereClause += ' AND event_time >= ?';
      params.push(query.start_time);
    }

    if (query.end_time) {
      whereClause += ' AND event_time <= ?';
      params.push(query.end_time);
    }

    const [rows] = await db.execute(
      `SELECT * FROM iot_zone_location_ts
       ${whereClause}
       ORDER BY event_time DESC
       LIMIT ?`,
      [...params, limit],
    );

    return rows;
  }

  async getLatestByAsset(assetCode, tenantId) {
    const [rows] = await db.execute(
      `SELECT * FROM iot_zone_location_ts
       WHERE tenant_id = ? AND asset_code = ?
       ORDER BY event_time DESC
       LIMIT 1`,
      [tenantId, assetCode],
    );

    return rows.length > 0 ? rows[0] : null;
  }

  getPipelineHealth() {
    return {
      mqtt_enabled: process.env.IOT_ZONE_MQTT_ENABLED === 'true',
      mqtt_connected: !!this.mqttClient?.connected,
      kafka_enabled: process.env.IOT_ZONE_KAFKA_ENABLED === 'true',
      kafka_connected: !!this.kafkaProducer,
      tsdb: process.env.IOT_ZONE_TSDB || 'mysql_ts_table',
      initialized: this.initialized,
    };
  }

  getPipelineDocs() {
    return {
      open_source_inspiration: ['ThingsBoard', 'EMQX'],
      http_ingest_path: '/api/iot/zone-location/ingest',
      http_ingest_batch_path: '/api/iot/zone-location/ingest/batch',
      auth: {
        token_header: 'x-iot-token',
        bearer_header: 'Authorization: Bearer <token>',
        query_token: 'token',
      },
      mqtt: {
        enabled: process.env.IOT_ZONE_MQTT_ENABLED === 'true',
        topic: process.env.IOT_ZONE_MQTT_TOPIC || 'iot/zone/+/up',
      },
      kafka: {
        enabled: process.env.IOT_ZONE_KAFKA_ENABLED === 'true',
        topic: process.env.IOT_ZONE_KAFKA_TOPIC || 'iot.zone.location.raw',
      },
      payload_examples: {
        flat: {
          device_id: 'TEST001',
          asset_code: 'ASSET-DEMO-001',
          location_code: 'B1-3F-ROOM308',
          area_name: '影像科CT区',
          event_time: new Date().toISOString(),
        },
        thingsboard_style: {
          device_id: 'TEST001',
          ts: Date.now(),
          values: {
            location_code: 'B1-3F-ROOM308',
            area_name: '影像科CT区',
            rssi: -67,
            battery_level: 84,
          },
        },
      },
    };
  }
}

module.exports = new ZoneLocationPipelineService();
