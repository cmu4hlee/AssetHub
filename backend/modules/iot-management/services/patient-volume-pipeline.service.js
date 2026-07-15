const db = require('../../../config/database');

const normalizeString = value => (typeof value === 'string' ? value.trim() : value);
const PATIENT_VOLUME_ASSET_JOIN =
  'a.asset_code COLLATE utf8mb4_unicode_ci = ts.asset_code AND a.tenant_id = ts.tenant_id';

class PatientVolumePipelineService {
  constructor() {
    this.initialized = false;
  }

  async init() {
    if (this.initialized) {
      return;
    }
    try {
      await this.ensureTimeSeriesTable();
    } catch (error) {
      console.error('[PatientVolume] 时序表初始化失败:', error.message);
    }
    this.initialized = true;
  }

  async ensureTimeSeriesTable() {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS iot_patient_volume_ts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        asset_code VARCHAR(100) NOT NULL,
        patient_id VARCHAR(100) NOT NULL,
        event_time DATETIME NOT NULL,
        ingest_source VARCHAR(50) NOT NULL DEFAULT 'http',
        payload_json LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_patient_volume_tenant_asset_time (tenant_id, asset_code, event_time),
        INDEX idx_patient_volume_tenant_patient_time (tenant_id, patient_id, event_time),
        INDEX idx_patient_volume_event_time (event_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='患者量统计时序数据表';
    `);
  }

  normalizePayload(rawPayload = {}) {
    const values =
      rawPayload && typeof rawPayload.values === 'object' && rawPayload.values ? rawPayload.values : {};
    const merged = { ...values, ...rawPayload };
    const eventTime =
      merged.event_time ||
      merged.eventTime ||
      merged.usage_time ||
      merged.usageTime ||
      (merged.ts ? new Date(Number(merged.ts)).toISOString() : undefined);

    return {
      patient_id: normalizeString(merged.patient_id || merged.patientId),
      asset_code: normalizeString(merged.asset_code || merged.assetCode),
      tenant_id: merged.tenant_id ?? merged.tenantId,
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

  buildPayloadJson(payload, meta) {
    if (process.env.IOT_PIPELINE_DISABLE_RAW_PAYLOAD === 'true') {
      return null;
    }
    return JSON.stringify({ ...payload, ...meta });
  }

  async resolveAssetMatches(assetCodes) {
    const uniqueCodes = Array.from(new Set((assetCodes || []).filter(Boolean)));
    if (uniqueCodes.length === 0) return new Map();

    const placeholders = uniqueCodes.map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT id, tenant_id, asset_code, asset_name
       FROM assets
       WHERE asset_code IN (${placeholders})`,
      uniqueCodes,
    );

    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.asset_code)) {
        map.set(row.asset_code, []);
      }
      map.get(row.asset_code).push(row);
    }

    return map;
  }

  resolveAssetRecord(assetRows, tenantHint) {
    if (!Array.isArray(assetRows) || assetRows.length === 0) {
      return { error: 'asset_code 对应资产不存在' };
    }

    const normalizedTenantHint = Number.isFinite(tenantHint) ? tenantHint : null;
    if (normalizedTenantHint !== null) {
      const matched = assetRows.find(row => Number(row.tenant_id) === normalizedTenantHint);
      if (!matched) {
        return { error: 'asset_code 对应资产不存在或不属于当前租户' };
      }
      return { record: matched };
    }

    const distinctTenants = new Set(
      assetRows.map(row => Number(row.tenant_id)).filter(item => Number.isFinite(item)),
    );
    if (distinctTenants.size > 1) {
      return { error: 'asset_code 命中多个租户，请提供 tenant_id 或使用企业IoT令牌' };
    }

    return { record: assetRows[0] };
  }

  async insertBatchRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const chunkSize = Math.max(parseInt(process.env.IOT_BATCH_INSERT_CHUNK_SIZE || '300', 10), 50);

    for (let index = 0; index < rows.length; index += chunkSize) {
      const chunk = rows.slice(index, index + chunkSize);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
      const values = chunk.flat();
      await db.execute(
        `INSERT INTO iot_patient_volume_ts (
          tenant_id, asset_code, patient_id, event_time, ingest_source, payload_json
        ) VALUES ${placeholders}`,
        values,
      );
    }
  }

  async ingestEvent(rawPayload, source = 'http', meta = {}) {
    const batchResult = await this.ingestBatch([rawPayload], source, meta);
    if (batchResult.success !== 1 || !batchResult.results[0]?.success) {
      throw new Error(batchResult.results[0]?.message || '患者量数据接收失败');
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
    const assetMatches = await this.resolveAssetMatches(normalizedEvents.map(item => item.asset_code));
    const expectedTenantId = meta?.iot_auth_tenant_id ? Number(meta.iot_auth_tenant_id) : null;

    const results = [];
    const insertRows = [];

    normalizedEvents.forEach(payload => {
      if (!payload.patient_id) {
        results.push({ success: false, message: 'patient_id 不能为空' });
        return;
      }

      if (!payload.asset_code) {
        results.push({ success: false, message: 'asset_code 不能为空' });
        return;
      }

      const payloadTenantId = this.parseIntSafe(payload.tenant_id);
      const tenantHint = Number.isFinite(expectedTenantId) ? expectedTenantId : payloadTenantId;
      const assetResolution = this.resolveAssetRecord(assetMatches.get(payload.asset_code), tenantHint);
      if (!assetResolution.record) {
        results.push({ success: false, message: assetResolution.error || '资产解析失败' });
        return;
      }

      const normalizedEventTime = this.normalizeEventTime(payload.event_time);
      const payloadJson = this.buildPayloadJson(payload.payload, meta);

      insertRows.push([
        assetResolution.record.tenant_id,
        payload.asset_code,
        payload.patient_id,
        normalizedEventTime,
        source,
        payloadJson,
      ]);

      results.push({
        success: true,
        data: {
          tenant_id: assetResolution.record.tenant_id,
          asset_code: payload.asset_code,
          patient_id: payload.patient_id,
          asset_name: assetResolution.record.asset_name || null,
          event_time: normalizedEventTime.toISOString(),
          source,
        },
      });
    });

    if (insertRows.length > 0) {
      await this.insertBatchRows(insertRows);
    }

    const successCount = results.filter(item => item.success).length;
    return {
      total: events.length,
      success: successCount,
      failed: events.length - successCount,
      results,
    };
  }

  async getLatestByAsset(assetCode, tenantId) {
    await this.init();

    const [rows] = await db.execute(
      `SELECT ts.*, a.asset_name
       FROM iot_patient_volume_ts ts
       LEFT JOIN assets a ON ${PATIENT_VOLUME_ASSET_JOIN} AND a.is_deleted = 0
       WHERE ts.tenant_id = ? AND ts.asset_code = ?
       ORDER BY ts.event_time DESC
       LIMIT 1`,
      [tenantId, assetCode],
    );

    return rows.length > 0 ? rows[0] : null;
  }

  async getAssetSeries(assetCode, tenantId, query = {}) {
    await this.init();

    const limit = Math.min(parseInt(query.limit || 30, 10), 365);
    const granularity = String(query.granularity || 'day').trim().toLowerCase() === 'hour' ? 'hour' : 'day';
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

    const bucketExpression =
      granularity === 'hour'
        ? "DATE_FORMAT(event_time, '%Y-%m-%d %H:00:00')"
        : "DATE_FORMAT(event_time, '%Y-%m-%d 00:00:00')";

    const [rows] = await db.execute(
      `SELECT ${bucketExpression} AS bucket_time,
              COUNT(*) AS usage_count,
              COUNT(DISTINCT patient_id) AS unique_patient_count,
              MIN(event_time) AS first_event_time,
              MAX(event_time) AS last_event_time
       FROM iot_patient_volume_ts
       ${whereClause}
       GROUP BY bucket_time
       ORDER BY bucket_time DESC
       LIMIT ?`,
      [...params, limit],
    );

    return rows;
  }

  async getUsageStats(tenantId, query = {}) {
    await this.init();

    const page = Math.max(parseInt(query.page || 1, 10), 1);
    const pageSize = Math.min(Math.max(parseInt(query.pageSize || 20, 10), 1), 100);
    const offset = (page - 1) * pageSize;
    const params = [tenantId];
    let whereClause = 'WHERE ts.tenant_id = ?';

    if (query.asset_code) {
      whereClause += ' AND ts.asset_code = ?';
      params.push(String(query.asset_code).trim());
    }

    if (query.keyword) {
      const keyword = `%${String(query.keyword).trim()}%`;
      whereClause += ' AND (ts.asset_code LIKE ? OR a.asset_name LIKE ?)';
      params.push(keyword, keyword);
    }

    if (query.start_time) {
      whereClause += ' AND ts.event_time >= ?';
      params.push(query.start_time);
    }

    if (query.end_time) {
      whereClause += ' AND ts.event_time <= ?';
      params.push(query.end_time);
    }

    // Use index-covered JOIN: use STRAIGHT_JOIN to avoid optimizer mis-ordering, drop COLLATE for speed
    const joinClause =
      'STRAIGHT_JOIN assets a ON a.asset_code = ts.asset_code AND a.tenant_id = ts.tenant_id AND a.is_deleted = 0';

    // Single query: get summary + paginated data in one round-trip
    // Force MySQL to use index for the GROUP BY / ORDER
    const [rows] = await db.execute(
      `SELECT ts.asset_code,
              COALESCE(a.asset_name, ts.asset_code) AS asset_name,
              COUNT(*) AS usage_count,
              COUNT(DISTINCT ts.patient_id) AS unique_patient_count,
              MIN(ts.event_time) AS first_use_time,
              MAX(ts.event_time) AS last_use_time
       FROM iot_patient_volume_ts ts
       ${joinClause}
       ${whereClause}
       GROUP BY ts.asset_code, a.asset_name
       ORDER BY last_use_time DESC, ts.asset_code ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    // Fast approximate total using SQL_CALC_FOUND_ROWS — single extra metadata fetch
    const [totalRows] = await db.execute(
      `SELECT SQL_CALC_FOUND_ROWS ts.asset_code
       FROM iot_patient_volume_ts ts
       ${joinClause}
       ${whereClause}
       GROUP BY ts.asset_code, a.asset_name
       LIMIT 1`,
      params,
    );

    let total = 0;
    if (db._pool || db.pool) {
      const [countResult] = await db.execute('SELECT FOUND_ROWS() AS total');
      total = Number(countResult?.[0]?.total || 0);
    }

    // Fetch summary stats separately (this is a lightweight scan with good index coverage)
    const [summaryRows] = await db.execute(
      `SELECT
         COUNT(*) AS total_records,
         COUNT(DISTINCT ts.patient_id) AS total_patients,
         COUNT(DISTINCT ts.asset_code) AS asset_count
       FROM iot_patient_volume_ts ts
       USE INDEX (idx_patient_volume_tenant_asset_time)
       WHERE ts.tenant_id = ?
         AND ts.event_time ${query.start_time ? '>= ?' : 'IS NOT NULL'} ${query.end_time ? 'AND ts.event_time <= ?' : ''}`,
      query.start_time && query.end_time
        ? [tenantId, query.start_time, query.end_time]
        : query.start_time
          ? [tenantId, query.start_time]
          : query.end_time
            ? [tenantId, query.end_time]
            : [tenantId],
    );

    const summary = summaryRows?.[0] || {};

    return {
      list: rows,
      summary: {
        total_records: Number(summary.total_records || 0),
        total_patients: Number(summary.total_patients || 0),
        asset_count: Number(summary.asset_count || 0),
      },
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  async getRecentRecords(tenantId, query = {}) {
    await this.init();

    const page = Math.max(parseInt(query.page || 1, 10), 1);
    const pageSize = Math.min(Math.max(parseInt(query.pageSize || 20, 10), 1), 100);
    const offset = (page - 1) * pageSize;
    const params = [tenantId];
    let whereClause = 'WHERE ts.tenant_id = ?';

    if (query.asset_code) {
      whereClause += ' AND ts.asset_code = ?';
      params.push(String(query.asset_code).trim());
    }

    if (query.patient_id) {
      whereClause += ' AND ts.patient_id LIKE ?';
      params.push(`%${String(query.patient_id).trim()}%`);
    }

    if (query.keyword) {
      const keyword = `%${String(query.keyword).trim()}%`;
      whereClause += ' AND (ts.asset_code LIKE ? OR a.asset_name LIKE ? OR ts.patient_id LIKE ?)';
      params.push(keyword, keyword, keyword);
    }

    if (query.start_time) {
      whereClause += ' AND ts.event_time >= ?';
      params.push(query.start_time);
    }

    if (query.end_time) {
      whereClause += ' AND ts.event_time <= ?';
      params.push(query.end_time);
    }

    const joinClause = `LEFT JOIN assets a ON ${PATIENT_VOLUME_ASSET_JOIN} AND a.is_deleted = 0`;

    const [summaryRows] = await db.execute(
      `SELECT COUNT(*) AS total_records,
              COUNT(DISTINCT ts.asset_code) AS asset_count,
              COUNT(DISTINCT ts.patient_id) AS patient_count,
              MIN(ts.event_time) AS earliest_event_time,
              MAX(ts.event_time) AS latest_event_time
       FROM iot_patient_volume_ts ts
       ${joinClause}
       ${whereClause}`,
      params,
    );

    const [rows] = await db.execute(
      `SELECT ts.id,
              ts.asset_code,
              COALESCE(a.asset_name, ts.asset_code) AS asset_name,
              ts.patient_id,
              ts.event_time,
              ts.ingest_source,
              ts.created_at
       FROM iot_patient_volume_ts ts
       ${joinClause}
       ${whereClause}
       ORDER BY ts.event_time DESC, ts.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    const summary = summaryRows?.[0] || {};
    const total = Number(summary.total_records || 0);

    return {
      list: rows,
      summary: {
        total_records: total,
        asset_count: Number(summary.asset_count || 0),
        patient_count: Number(summary.patient_count || 0),
        earliest_event_time: summary.earliest_event_time || null,
        latest_event_time: summary.latest_event_time || null,
      },
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  async getPatientListByAsset(assetCode, tenantId, query = {}) {
    await this.init();

    const page = Math.max(parseInt(query.page || 1, 10), 1);
    const pageSize = Math.min(Math.max(parseInt(query.pageSize || 20, 10), 1), 100);
    const offset = (page - 1) * pageSize;
    const params = [tenantId, assetCode];
    let whereClause = 'WHERE ts.tenant_id = ? AND ts.asset_code = ?';

    if (query.patient_id) {
      whereClause += ' AND ts.patient_id LIKE ?';
      params.push(`%${String(query.patient_id).trim()}%`);
    }

    if (query.start_time) {
      whereClause += ' AND ts.event_time >= ?';
      params.push(query.start_time);
    }

    if (query.end_time) {
      whereClause += ' AND ts.event_time <= ?';
      params.push(query.end_time);
    }

    const joinClause = `LEFT JOIN assets a ON ${PATIENT_VOLUME_ASSET_JOIN} AND a.is_deleted = 0`;

    const [summaryRows] = await db.execute(
      `SELECT COUNT(*) AS total_records,
              COUNT(DISTINCT ts.patient_id) AS unique_patient_count,
              MIN(ts.event_time) AS first_event_time,
              MAX(ts.event_time) AS last_event_time,
              MAX(a.asset_name) AS asset_name
       FROM iot_patient_volume_ts ts
       ${joinClause}
       ${whereClause}`,
      params,
    );

    const [rows] = await db.execute(
      `SELECT ts.id,
              ts.asset_code,
              COALESCE(a.asset_name, ts.asset_code) AS asset_name,
              ts.patient_id,
              ts.event_time,
              ts.ingest_source,
              ts.created_at
       FROM iot_patient_volume_ts ts
       ${joinClause}
       ${whereClause}
       ORDER BY ts.event_time DESC, ts.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    const summary = summaryRows?.[0] || {};
    const total = Number(summary.total_records || 0);

    return {
      list: rows,
      summary: {
        asset_code: assetCode,
        asset_name: summary.asset_name || null,
        total_records: total,
        unique_patient_count: Number(summary.unique_patient_count || 0),
        first_event_time: summary.first_event_time || null,
        last_event_time: summary.last_event_time || null,
      },
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  async getAllRecords(tenantId, query = {}) {
    await this.init();

    const batchSize = Math.min(Math.max(parseInt(query.batchSize || 5000, 10), 1000), 20000);
    const params = [tenantId];
    let whereClause = 'WHERE ts.tenant_id = ?';

    if (query.asset_code) {
      whereClause += ' AND ts.asset_code = ?';
      params.push(String(query.asset_code).trim());
    }

    if (query.patient_id) {
      whereClause += ' AND ts.patient_id LIKE ?';
      params.push(`%${String(query.patient_id).trim()}%`);
    }

    if (query.keyword) {
      const keyword = `%${String(query.keyword).trim()}%`;
      whereClause += ' AND (ts.asset_code LIKE ? OR a.asset_name LIKE ? OR ts.patient_id LIKE ?)';
      params.push(keyword, keyword, keyword);
    }

    if (query.start_time) {
      whereClause += ' AND ts.event_time >= ?';
      params.push(query.start_time);
    }

    if (query.end_time) {
      whereClause += ' AND ts.event_time <= ?';
      params.push(query.end_time);
    }

    const joinClause = `LEFT JOIN assets a ON ${PATIENT_VOLUME_ASSET_JOIN} AND a.is_deleted = 0`;

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM iot_patient_volume_ts ts
       ${joinClause}
       ${whereClause}`,
      params,
    );

    const total = Number(countRows?.[0]?.total || 0);

    if (total === 0) {
      return {
        data: [],
        total: 0,
        meta: { duration: 0, batchSize, fetchedCount: 0 },
      };
    }

    const allData = [];
    let offset = 0;

    const listSql = `SELECT ts.id,
              ts.asset_code,
              COALESCE(a.asset_name, ts.asset_code) AS asset_name,
              ts.patient_id,
              ts.event_time,
              ts.ingest_source,
              ts.created_at
       FROM iot_patient_volume_ts ts
       ${joinClause}
       ${whereClause}
       ORDER BY ts.event_time DESC, ts.id DESC
       LIMIT ? OFFSET ?`;

    while (offset < total) {
      const [rows] = await db.execute(listSql, [...params, batchSize, offset]);
      if (rows.length === 0) break;
      allData.push(...rows);
      offset += batchSize;
      if (rows.length < batchSize) break;
    }

    return {
      data: allData,
      total,
      meta: {
        duration: Date.now() - (query._startTime || Date.now()),
        batchSize,
        fetchedCount: allData.length,
      },
    };
  }

  async getAllAssetStats(tenantId, query = {}) {
    await this.init();

    const batchSize = Math.min(Math.max(parseInt(query.batchSize || 5000, 10), 1000), 20000);
    const params = [tenantId];
    let whereClause = 'WHERE ts.tenant_id = ?';

    if (query.asset_code) {
      whereClause += ' AND ts.asset_code = ?';
      params.push(String(query.asset_code).trim());
    }

    if (query.keyword) {
      const keyword = `%${String(query.keyword).trim()}%`;
      whereClause += ' AND (ts.asset_code LIKE ? OR a.asset_name LIKE ?)';
      params.push(keyword, keyword);
    }

    if (query.start_time) {
      whereClause += ' AND ts.event_time >= ?';
      params.push(query.start_time);
    }

    if (query.end_time) {
      whereClause += ' AND ts.event_time <= ?';
      params.push(query.end_time);
    }

    const joinClause = `LEFT JOIN assets a ON ${PATIENT_VOLUME_ASSET_JOIN} AND a.is_deleted = 0`;

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM (
         SELECT ts.asset_code
         FROM iot_patient_volume_ts ts
         ${joinClause}
         ${whereClause}
         GROUP BY ts.asset_code, a.asset_name
       ) AS grouped_assets`,
      params,
    );

    const total = Number(countRows?.[0]?.total || 0);

    if (total === 0) {
      return {
        data: [],
        total: 0,
        meta: { duration: 0, batchSize, fetchedCount: 0 },
      };
    }

    const allData = [];
    let offset = 0;

    const listSql = `SELECT ts.asset_code,
              COALESCE(a.asset_name, ts.asset_code) AS asset_name,
              COUNT(*) AS usage_count,
              COUNT(DISTINCT ts.patient_id) AS unique_patient_count,
              MIN(ts.event_time) AS first_use_time,
              MAX(ts.event_time) AS last_use_time
       FROM iot_patient_volume_ts ts
       ${joinClause}
       ${whereClause}
       GROUP BY ts.asset_code, a.asset_name
       ORDER BY last_use_time DESC, ts.asset_code ASC
       LIMIT ? OFFSET ?`;

    while (offset < total) {
      const [rows] = await db.execute(listSql, [...params, batchSize, offset]);
      if (rows.length === 0) break;
      allData.push(...rows);
      offset += batchSize;
      if (rows.length < batchSize) break;
    }

    const [summaryRows] = await db.execute(
      `SELECT COUNT(*) AS total_records,
              COUNT(DISTINCT ts.patient_id) AS total_patients,
              COUNT(DISTINCT ts.asset_code) AS asset_count
       FROM iot_patient_volume_ts ts
       ${joinClause}
       ${whereClause}`,
      params,
    );

    const summary = summaryRows?.[0] || {};

    return {
      data: allData,
      total,
      summary: {
        total_records: Number(summary.total_records || 0),
        total_patients: Number(summary.total_patients || 0),
        asset_count: Number(summary.asset_count || 0),
      },
      meta: {
        duration: Date.now() - (query._startTime || Date.now()),
        batchSize,
        fetchedCount: allData.length,
      },
    };
  }

  getPipelineHealth() {
    return {
      http_ingest_enabled: true,
      mqtt_enabled: false,
      kafka_enabled: false,
      tsdb: process.env.IOT_PATIENT_VOLUME_TSDB || 'mysql_ts_table',
      initialized: this.initialized,
    };
  }

  getPipelineDocs() {
    return {
      open_source_inspiration: ['ThingsBoard', 'OpenTelemetry'],
      http_ingest_path: '/api/iot/patient-volume/ingest',
      http_ingest_batch_path: '/api/iot/patient-volume/ingest/batch',
      usage_stats_path: '/api/iot/patient-volume/assets/usage-stats?page=1&pageSize=20',
      recent_records_path: '/api/iot/patient-volume/records/recent?page=1&pageSize=20',
      asset_latest_path: '/api/iot/patient-volume/assets/:assetCode/latest',
      asset_series_path: '/api/iot/patient-volume/assets/:assetCode/series?granularity=day&limit=30',
      asset_patients_path: '/api/iot/patient-volume/assets/:assetCode/patients?page=1&pageSize=20',
      auth: {
        mode: 'jwt',
        login_path: '/api/users/login',
        bearer_header: 'Authorization: Bearer <login_jwt>',
        note: '请先使用用户名/密码登录获取 JWT，再调用患者量上报接口',
      },
      payload_examples: {
        flat: {
          patient_id: 'PATIENT-0001',
          asset_code: 'ASSET-DEMO-001',
          event_time: new Date().toISOString(),
        },
        thingsboard_style: {
          ts: Date.now(),
          values: {
            patient_id: 'PATIENT-0001',
            asset_code: 'ASSET-DEMO-001',
          },
        },
      },
    };
  }
}

module.exports = new PatientVolumePipelineService();
