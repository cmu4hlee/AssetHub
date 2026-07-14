const db = require('../../../config/database');

const normalizeString = value => (typeof value === 'string' ? value.trim() : value);

const hasMeaningfulMetricValue = value => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim() !== '';
  }

  return true;
};

class EnvironmentMonitoringPipelineService {
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
      console.error('[EnvironmentMonitoring] 时序表初始化失败:', error.message);
    }
    try {
      await this.initKafkaProducer();
    } catch (error) {
      console.warn('[EnvironmentMonitoring] Kafka 初始化跳过:', error.message);
    }
    try {
      await this.initMqttSubscriber();
    } catch (error) {
      console.warn('[EnvironmentMonitoring] MQTT 初始化跳过:', error.message);
    }
    this.initialized = true;
  }

  async ensureTimeSeriesTable() {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS iot_environment_monitor_ts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        device_id VARCHAR(100) NOT NULL,
        asset_code VARCHAR(100) NULL,
        temperature DECIMAL(10, 2) NULL,
        humidity DECIMAL(10, 2) NULL,
        pressure DECIMAL(12, 2) NULL,
        co2 DECIMAL(10, 2) NULL,
        pm25 DECIMAL(10, 2) NULL,
        voc DECIMAL(10, 2) NULL,
        battery_level INT NULL,
        event_time DATETIME NOT NULL,
        ingest_source VARCHAR(50) NOT NULL DEFAULT 'http',
        payload_json LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_env_ts_tenant_device_time (tenant_id, device_id, event_time),
        INDEX idx_env_ts_asset_time (asset_code, event_time),
        INDEX idx_env_ts_event_time (event_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='环境监测时序数据表';
    `);
  }

  async initKafkaProducer() {
    if (process.env.IOT_ENV_KAFKA_ENABLED !== 'true') {
      return;
    }

    try {
      const { Kafka } = require('kafkajs');
      const brokers = (process.env.IOT_ENV_KAFKA_BROKERS || '127.0.0.1:9092')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

      this.kafkaClient = new Kafka({
        clientId: process.env.IOT_ENV_KAFKA_CLIENT_ID || 'assettube-env-monitoring',
        brokers,
      });

      this.kafkaProducer = this.kafkaClient.producer();
      await this.kafkaProducer.connect();
      console.log('[EnvMonitoring] Kafka producer connected:', brokers.join(','));
    } catch (error) {
      console.warn('[EnvMonitoring] Kafka init skipped:', error.message);
      this.kafkaProducer = null;
    }
  }

  async initMqttSubscriber() {
    if (process.env.IOT_ENV_MQTT_ENABLED !== 'true') {
      return;
    }

    try {
      const mqtt = require('mqtt');
      const brokerUrl = process.env.IOT_ENV_MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';
      const topic = process.env.IOT_ENV_MQTT_TOPIC || 'iot/environment/+/up';

      this.mqttClient = mqtt.connect(brokerUrl, {
        username: process.env.IOT_ENV_MQTT_USERNAME || undefined,
        password: process.env.IOT_ENV_MQTT_PASSWORD || undefined,
      });

      this.mqttClient.on('connect', () => {
        this.mqttClient.subscribe(topic, err => {
          if (err) {
            console.error('[EnvMonitoring] MQTT subscribe failed:', err.message);
            return;
          }
          console.log('[EnvMonitoring] MQTT subscribed:', topic);
        });
      });

      this.mqttClient.on('message', async (receivedTopic, messageBuffer) => {
        try {
          const payload = JSON.parse(messageBuffer.toString('utf-8'));
          await this.ingestEvent(payload, 'mqtt', { mqtt_topic: receivedTopic });
        } catch (error) {
          console.error('[EnvMonitoring] MQTT message process failed:', error.message);
        }
      });

      this.mqttClient.on('error', error => {
        console.error('[EnvMonitoring] MQTT client error:', error.message);
      });
    } catch (error) {
      console.warn('[EnvMonitoring] MQTT init skipped:', error.message);
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
      temperature: merged.temperature,
      humidity: merged.humidity,
      pressure: merged.pressure,
      co2: merged.co2,
      pm25: merged.pm25,
      voc: merged.voc,
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
      `SELECT device_id, tenant_id
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
        `INSERT INTO iot_environment_monitor_ts (
          tenant_id, device_id, asset_code,
          temperature, humidity, pressure, co2, pm25, voc,
          battery_level, event_time, ingest_source, payload_json
        ) VALUES ${placeholders}`,
        values,
      );
    }
  }

  async publishKafkaEventsBatch(eventPayloads) {
    if (!this.kafkaProducer || !Array.isArray(eventPayloads) || eventPayloads.length === 0) {
      return false;
    }

    const topic = process.env.IOT_ENV_KAFKA_TOPIC || 'iot.environment.raw';
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
      console.error('[EnvMonitoring] Kafka batch publish failed:', error.message);
      return false;
    }
  }

  async ingestEvent(rawPayload, source = 'http', meta = {}) {
    const batchResult = await this.ingestBatch([rawPayload], source, meta);
    if (batchResult.success !== 1 || !batchResult.results[0]?.success) {
      throw new Error(batchResult.results[0]?.message || '环境监测数据接收失败');
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

    normalizedEvents.forEach(payload => {
      if (!payload.device_id) {
        results.push({ success: false, message: 'device_id 不能为空' });
        return;
      }

      const hasEnvironmentMetric =
        hasMeaningfulMetricValue(payload.temperature) ||
        hasMeaningfulMetricValue(payload.humidity) ||
        hasMeaningfulMetricValue(payload.pressure) ||
        hasMeaningfulMetricValue(payload.co2) ||
        hasMeaningfulMetricValue(payload.pm25) ||
        hasMeaningfulMetricValue(payload.voc);

      if (!hasEnvironmentMetric) {
        results.push({ success: false, message: '环境参数不能为空（temperature/humidity/pressure/co2/pm25/voc）' });
        return;
      }

      const device = deviceMap.get(payload.device_id);
      if (!device) {
        results.push({ success: false, message: '设备不存在' });
        return;
      }
      if (
        expectedTenantId !== null &&
        Number.isFinite(expectedTenantId) &&
        Number(device.tenant_id) !== expectedTenantId
      ) {
        results.push({ success: false, message: '设备租户与令牌所属企业不一致' });
        return;
      }

      const assetCode = payload.asset_code || assetByDeviceMap.get(payload.device_id) || null;
      const normalizedEventTime = this.normalizeEventTime(payload.event_time);
      const payloadJson = this.buildPayloadJson(payload.payload, meta);

      insertRows.push([
        device.tenant_id,
        payload.device_id,
        assetCode,
        this.parseFloatSafe(payload.temperature),
        this.parseFloatSafe(payload.humidity),
        this.parseFloatSafe(payload.pressure),
        this.parseFloatSafe(payload.co2),
        this.parseFloatSafe(payload.pm25),
        this.parseFloatSafe(payload.voc),
        this.parseIntSafe(payload.battery_level),
        normalizedEventTime,
        source,
        payloadJson,
      ]);

      const eventData = {
        tenant_id: device.tenant_id,
        device_id: payload.device_id,
        asset_code: assetCode,
        event_time: normalizedEventTime.toISOString(),
        source,
      };

      kafkaEvents.push({
        ...eventData,
        payload: payloadJson ? JSON.parse(payloadJson) : { ...payload.payload, ...meta },
      });
      results.push({ success: true, data: eventData });
    });

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

    const topic = process.env.IOT_ENV_KAFKA_TOPIC || 'iot.environment.raw';

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
      console.error('[EnvMonitoring] Kafka publish failed:', error.message);
      return false;
    }
  }

  async getLatestByDevice(deviceId, tenantId) {
    const [rows] = await db.execute(
      `SELECT * FROM iot_environment_monitor_ts
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
      `SELECT * FROM iot_environment_monitor_ts
       ${whereClause}
       ORDER BY event_time DESC
       LIMIT ?`,
      [...params, limit],
    );

    return rows;
  }

  async getLatestByAsset(assetCode, tenantId) {
    const [rows] = await db.execute(
      `SELECT * FROM iot_environment_monitor_ts
       WHERE tenant_id = ? AND asset_code = ?
       ORDER BY event_time DESC
       LIMIT 1`,
      [tenantId, assetCode],
    );
    return rows.length > 0 ? rows[0] : null;
  }

  getPipelineHealth() {
    return {
      mqtt_enabled: process.env.IOT_ENV_MQTT_ENABLED === 'true',
      mqtt_connected: !!this.mqttClient?.connected,
      kafka_enabled: process.env.IOT_ENV_KAFKA_ENABLED === 'true',
      kafka_connected: !!this.kafkaProducer,
      tsdb: process.env.IOT_ENV_TSDB || 'mysql_ts_table',
      initialized: this.initialized,
    };
  }

  getPipelineDocs() {
    return {
      open_source_inspiration: ['ThingsBoard', 'EMQX'],
      http_ingest_path: '/api/iot/environment-monitoring/ingest',
      http_ingest_batch_path: '/api/iot/environment-monitoring/ingest/batch',
      auth: {
        token_header: 'x-iot-token',
        bearer_header: 'Authorization: Bearer <token>',
        query_token: 'token',
      },
      mqtt: {
        enabled: process.env.IOT_ENV_MQTT_ENABLED === 'true',
        topic: process.env.IOT_ENV_MQTT_TOPIC || 'iot/environment/+/up',
      },
      kafka: {
        enabled: process.env.IOT_ENV_KAFKA_ENABLED === 'true',
        topic: process.env.IOT_ENV_KAFKA_TOPIC || 'iot.environment.raw',
      },
      payload_examples: {
        flat: {
          device_id: 'ENV001',
          asset_code: 'ASSET-DEMO-001',
          temperature: 22.6,
          humidity: 47.1,
          co2: 532.5,
          event_time: new Date().toISOString(),
        },
        thingsboard_style: {
          device_id: 'ENV001',
          ts: Date.now(),
          values: {
            temperature: 22.8,
            humidity: 46.8,
            pm25: 11.2,
            voc: 0.18,
          },
        },
      },
    };
  }
}

module.exports = new EnvironmentMonitoringPipelineService();
