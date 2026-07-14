const db = require('../config/database');

const MISSING_TABLE_ERRORS = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_PARSE_ERROR']);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const safeDivide = (numerator, denominator) => {
  if (!denominator) return 0;
  return numerator / denominator;
};

const normalizeTenantId = tenantId => {
  const parsed = Number.parseInt(String(tenantId ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const requireTenantId = tenantId => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) {
    throw new Error('当前用户未分配企业空间');
  }
  return normalizedTenantId;
};

const normalizeAssetCodes = assetCodes => {
  if (!Array.isArray(assetCodes)) return [];
  return Array.from(
    new Set(
      assetCodes
        .map(code => String(code || '').trim())
        .filter(Boolean)
        .slice(0, 200),
    ),
  );
};

const safeRows = async (sql, params = []) => {
  try {
    const [rows] = await db.execute(sql, params);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    if (MISSING_TABLE_ERRORS.has(error.code)) {
      return [];
    }
    throw error;
  }
};

const buildAssetFilter = ({ tenantId, assetCodes = [] }) => {
  const conditions = [];
  const params = [];

  const normalizedTenantId = normalizeTenantId(tenantId);
  if (normalizedTenantId) {
    conditions.push('tenant_id = ?');
    params.push(normalizedTenantId);
  }

  const normalizedCodes = normalizeAssetCodes(assetCodes);
  if (normalizedCodes.length > 0) {
    conditions.push(`asset_code IN (${normalizedCodes.map(() => '?').join(',')})`);
    params.push(...normalizedCodes);
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
};

const calcFailureProbability = features => {
  const sampleCount = toNumber(features.sample_count);
  const errorRate = safeDivide(toNumber(features.error_events), sampleCount);
  const offlineRate = safeDivide(toNumber(features.offline_events), sampleCount);
  const lowBatteryRate = safeDivide(toNumber(features.low_battery_events), sampleCount);
  const weakSignalRate = safeDivide(toNumber(features.weak_signal_events), sampleCount);
  const envAnomalyRate = safeDivide(
    toNumber(features.temp_anomaly_events) + toNumber(features.humidity_anomaly_events),
    Math.max(1, toNumber(features.env_samples)),
  );

  const recentRequestScore = Math.min(20, toNumber(features.request_count_30d) * 4);
  const unresolvedScore = Math.min(18, toNumber(features.unresolved_workorders) * 6);
  const costRatio = safeDivide(
    toNumber(features.maintenance_cost_180d),
    Math.max(1, toNumber(features.purchase_price)),
  );
  const costPressureScore = Math.min(15, costRatio * 100 * 0.2);

  const raw =
    8 +
    errorRate * 35 +
    offlineRate * 22 +
    lowBatteryRate * 10 +
    weakSignalRate * 8 +
    envAnomalyRate * 12 +
    recentRequestScore +
    unresolvedScore +
    costPressureScore;

  return clamp(raw, 1, 99);
};

const calcRulDays = ({ asset, features, failureProbability }) => {
  const purchaseDate = asset.purchase_date ? new Date(asset.purchase_date) : null;
  const now = new Date();
  const ageDays =
    purchaseDate && !Number.isNaN(purchaseDate.getTime())
      ? Math.max(0, Math.floor((now.getTime() - purchaseDate.getTime()) / 86400000))
      : 0;

  const usefulLifeYears = Math.max(1, toNumber(asset.depreciation_years, 8));
  const designLifeDays = usefulLifeYears * 365;
  const wearRatio = clamp(safeDivide(ageDays, designLifeDays), 0, 1.5);

  const sampleCount = toNumber(features.sample_count);
  const errorRate = safeDivide(toNumber(features.error_events), sampleCount);
  const offlineRate = safeDivide(toNumber(features.offline_events), sampleCount);
  const envAnomalyRate = safeDivide(
    toNumber(features.temp_anomaly_events) + toNumber(features.humidity_anomaly_events),
    Math.max(1, toNumber(features.env_samples)),
  );
  const requestLoad = clamp(safeDivide(toNumber(features.request_count_180d), 12), 0, 1);

  const stress = 0.4 * errorRate + 0.3 * offlineRate + 0.2 * envAnomalyRate + 0.1 * requestLoad;
  const remainingRatio = clamp(
    1 - (0.65 * wearRatio + 0.45 * safeDivide(failureProbability, 100) + 0.25 * stress),
    0.05,
    1,
  );

  return Math.round(Math.max(15, designLifeDays * remainingRatio));
};

const calcConfidence = features => {
  const sampleScore = clamp(safeDivide(toNumber(features.sample_count), 200), 0, 0.45);
  const maintenanceScore = clamp(safeDivide(toNumber(features.request_count_180d), 40), 0, 0.2);
  const envScore = clamp(safeDivide(toNumber(features.env_samples), 200), 0, 0.2);
  return clamp(0.35 + sampleScore + maintenanceScore + envScore, 0.35, 0.99);
};

const classifyRiskLevel = probability => {
  if (probability >= 80) return 'critical';
  if (probability >= 65) return 'high';
  if (probability >= 45) return 'medium';
  return 'low';
};

const mergeRowsByAssetCode = rows => {
  const map = new Map();
  rows.forEach(row => {
    const assetCode = String(row.asset_code || '').trim();
    if (!assetCode) return;
    if (!map.has(assetCode)) {
      map.set(assetCode, {});
    }
    map.set(assetCode, { ...map.get(assetCode), ...row });
  });
  return map;
};

const fetchAssets = async ({ tenantId, assetCodes = [], limit = 50 }) => {
  const normalizedLimit = clamp(toNumber(limit, 50), 1, 200);
  const filter = buildAssetFilter({ tenantId, assetCodes });
  const rows = await safeRows(
    `SELECT
       id,
       asset_code,
       asset_name,
       status,
       purchase_date,
       purchase_price,
       depreciation_years,
       department_new
     FROM assets
     ${filter.whereSql}
     ORDER BY updated_at DESC
     LIMIT ?`,
    [...filter.params, normalizedLimit],
  );

  return rows.filter(item => String(item.asset_code || '').trim());
};

const fetchFeatureMaps = async ({ tenantId, assetCodes = [], lookbackDays = 90 }) => {
  const normalizedCodes = normalizeAssetCodes(assetCodes);
  if (normalizedCodes.length === 0) {
    return new Map();
  }

  const normalizedLookback = clamp(toNumber(lookbackDays, 90), 7, 365);
  const tenant = normalizeTenantId(tenantId);
  const codePlaceholders = normalizedCodes.map(() => '?').join(',');
  const inClause = `asset_code IN (${codePlaceholders})`;

  const baseConditions = [inClause];
  const baseParams = [...normalizedCodes];
  if (tenant) {
    baseConditions.push('tenant_id = ?');
    baseParams.push(tenant);
  }

  const baseWhere = baseConditions.join(' AND ');

  const iotRows = await safeRows(
    `SELECT
       asset_code,
       COUNT(*) AS sample_count,
       SUM(CASE WHEN COALESCE(error_code, '') <> '' THEN 1 ELSE 0 END) AS error_events,
       SUM(CASE WHEN runtime_state IN ('offline', '离线', '故障', '停机', 'error') THEN 1 ELSE 0 END) AS offline_events,
       SUM(CASE WHEN battery_level IS NOT NULL AND battery_level < 20 THEN 1 ELSE 0 END) AS low_battery_events,
       SUM(CASE WHEN signal_strength IS NOT NULL AND signal_strength < 20 THEN 1 ELSE 0 END) AS weak_signal_events,
       AVG(COALESCE(cpu_usage, 0)) AS avg_cpu_usage,
       AVG(COALESCE(memory_usage, 0)) AS avg_memory_usage
     FROM iot_asset_monitor_ts
     WHERE ${baseWhere}
       AND event_time >= DATE_SUB(NOW(), INTERVAL ${normalizedLookback} DAY)
     GROUP BY asset_code`,
    baseParams,
  );

  const envRows = await safeRows(
    `SELECT
       asset_code,
       COUNT(*) AS env_samples,
       SUM(CASE WHEN temperature IS NOT NULL AND (temperature < 5 OR temperature > 35) THEN 1 ELSE 0 END) AS temp_anomaly_events,
       SUM(CASE WHEN humidity IS NOT NULL AND (humidity < 20 OR humidity > 80) THEN 1 ELSE 0 END) AS humidity_anomaly_events
     FROM iot_environment_monitor_ts
     WHERE ${baseWhere}
       AND event_time >= DATE_SUB(NOW(), INTERVAL ${normalizedLookback} DAY)
     GROUP BY asset_code`,
    baseParams,
  );

  const requestRows = await safeRows(
    `SELECT
       asset_code,
       SUM(CASE WHEN COALESCE(request_date, created_at) >= DATE_SUB(NOW(), INTERVAL 180 DAY) THEN 1 ELSE 0 END) AS request_count_180d,
       SUM(CASE WHEN COALESCE(request_date, created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS request_count_30d
     FROM maintenance_requests
     WHERE ${baseWhere}
     GROUP BY asset_code`,
    baseParams,
  );

  const workorderRows = await safeRows(
    `SELECT
       asset_code,
       COUNT(*) AS unresolved_workorders
     FROM maintenance_workorders
     WHERE ${baseWhere}
       AND status NOT IN ('completed', 'closed', 'cancelled')
     GROUP BY asset_code`,
    baseParams,
  );

  const costRows = await safeRows(
    `SELECT
       asset_code,
       ROUND(COALESCE(SUM(COALESCE(maintenance_cost, 0)), 0), 2) AS maintenance_cost_180d
     FROM maintenance_logs
     WHERE ${baseWhere}
       AND COALESCE(maintenance_date, created_at) >= DATE_SUB(NOW(), INTERVAL 180 DAY)
     GROUP BY asset_code`,
    baseParams,
  );

  const mergedRows = [
    ...iotRows,
    ...envRows,
    ...requestRows,
    ...workorderRows,
    ...costRows,
  ];

  return mergeRowsByAssetCode(mergedRows);
};

const predict = async ({ tenantId, assetCodes = [], limit = 50, lookbackDays = 90 }) => {
  const normalizedTenantId = requireTenantId(tenantId);
  const assets = await fetchAssets({ tenantId: normalizedTenantId, assetCodes, limit });
  const featureMap = await fetchFeatureMaps({
    tenantId: normalizedTenantId,
    assetCodes: assets.map(item => item.asset_code),
    lookbackDays,
  });

  const predictions = assets.map(asset => {
    const featureRow =
      featureMap instanceof Map ? featureMap.get(asset.asset_code) : featureMap[asset.asset_code];
    const features = {
      ...(featureRow || {}),
      purchase_price: toNumber(asset.purchase_price),
    };

    const failureProbability = calcFailureProbability(features);
    const rulDays = calcRulDays({
      asset,
      features,
      failureProbability,
    });
    const confidence = calcConfidence(features);

    return {
      asset_code: asset.asset_code,
      asset_name: asset.asset_name,
      department: asset.department_new || null,
      risk_level: classifyRiskLevel(failureProbability),
      failure_probability_7d: clamp(Math.round(failureProbability * 0.6 * 100) / 100, 0.1, 99),
      failure_probability_30d: Math.round(failureProbability * 100) / 100,
      rul_days: rulDays,
      confidence: Math.round(confidence * 10000) / 10000,
      feature_snapshot: {
        sample_count: toNumber(features.sample_count),
        error_events: toNumber(features.error_events),
        offline_events: toNumber(features.offline_events),
        low_battery_events: toNumber(features.low_battery_events),
        weak_signal_events: toNumber(features.weak_signal_events),
        temp_anomaly_events: toNumber(features.temp_anomaly_events),
        humidity_anomaly_events: toNumber(features.humidity_anomaly_events),
        request_count_30d: toNumber(features.request_count_30d),
        request_count_180d: toNumber(features.request_count_180d),
        unresolved_workorders: toNumber(features.unresolved_workorders),
        maintenance_cost_180d: toNumber(features.maintenance_cost_180d),
      },
    };
  });

  predictions.sort((a, b) => b.failure_probability_30d - a.failure_probability_30d);

  return {
    generated_at: new Date().toISOString(),
    model: {
      name: 'PredictiveMaintenanceBaseline',
      version: '0.1.0',
      lookback_days: clamp(toNumber(lookbackDays, 90), 7, 365),
      notes: '规则+统计特征融合基线模型，可平滑升级为机器学习模型。',
    },
    total_assets: predictions.length,
    predictions,
  };
};

const predictRiskByAsset = async options => {
  const result = await predict(options);
  const byAssetCode = {};
  result.predictions.forEach(item => {
    byAssetCode[item.asset_code] = item;
  });
  return byAssetCode;
};

module.exports = {
  predict,
  predictRiskByAsset,
  internals: {
    calcFailureProbability,
    calcRulDays,
    calcConfidence,
    classifyRiskLevel,
    normalizeAssetCodes,
  },
};
