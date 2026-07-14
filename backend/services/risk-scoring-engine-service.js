const db = require('../config/database');
const predictiveMaintenanceService = require('./predictive-maintenance-service');

let messageBroker = null;
let tablesReadyPromise = null;

const MISSING_TABLE_ERRORS = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_PARSE_ERROR']);
const LEVEL_RANK = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const DEFAULT_WEIGHTS = {
  market: 0.25,
  compliance: 0.35,
  device: 0.4,
};

const DEFAULT_COOLDOWN_HOURS = {
  low: 24,
  medium: 12,
  high: 4,
  critical: 1,
};
const DEFAULT_TREND_DAYS = 30;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const round2 = value => Math.round(Number(value || 0) * 100) / 100;

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

const buildWhereClause = ({ tenantId, assetCodes = [], alias = '' }) => {
  const conditions = [];
  const params = [];
  const prefix = alias ? `${alias}.` : '';

  const normalizedTenantId = requireTenantId(tenantId);
  if (normalizedTenantId) {
    conditions.push(`${prefix}tenant_id = ?`);
    params.push(normalizedTenantId);
  }

  const normalizedCodes = normalizeAssetCodes(assetCodes);
  if (normalizedCodes.length > 0) {
    conditions.push(`${prefix}asset_code IN (${normalizedCodes.map(() => '?').join(',')})`);
    params.push(...normalizedCodes);
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
};

const normalizeWeights = weights => {
  const candidate = {
    market: toNumber(weights?.market, DEFAULT_WEIGHTS.market),
    compliance: toNumber(weights?.compliance, DEFAULT_WEIGHTS.compliance),
    device: toNumber(weights?.device, DEFAULT_WEIGHTS.device),
  };
  const positiveSum = Math.max(0.0001, candidate.market + candidate.compliance + candidate.device);
  return {
    market: candidate.market / positiveSum,
    compliance: candidate.compliance / positiveSum,
    device: candidate.device / positiveSum,
  };
};

const normalizeTrendDays = days =>
  clamp(Math.round(toNumber(days, DEFAULT_TREND_DAYS)), 7, 180);

const resolveTrendDirection = delta => {
  const normalizedDelta = toNumber(delta, 0);
  if (normalizedDelta > 1) return 'up';
  if (normalizedDelta < -1) return 'down';
  return 'flat';
};

const normalizeDateBucket = value => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const classifyLevel = score => {
  if (score >= 80) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
};

const getNow = () => new Date();

const parseDate = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addHours = (date, hours) => new Date(date.getTime() + hours * 3600000);

const getMessageBroker = () => {
  if (messageBroker === false) return null;
  if (messageBroker) return messageBroker;

  try {
    // 按需加载，避免在未启用消息总线时影响主流程。
    // eslint-disable-next-line global-require
    messageBroker = require('./messaging/message-broker');
    return messageBroker;
  } catch (_error) {
    messageBroker = false;
    return null;
  }
};

const publishRiskEvent = async (eventType, data) => {
  const broker = getMessageBroker();
  if (!broker || !broker.isConnected || typeof broker.publishEvent !== 'function') {
    return false;
  }
  try {
    await broker.publishEvent(eventType, data);
    return true;
  } catch (_error) {
    return false;
  }
};

const ensureEngineTables = async () => {
  if (tablesReadyPromise) return tablesReadyPromise;

  tablesReadyPromise = (async () => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS risk_alert_state (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        asset_code VARCHAR(100) NOT NULL,
        ema_score DECIMAL(10, 2) NOT NULL DEFAULT 0,
        last_raw_score DECIMAL(10, 2) NOT NULL DEFAULT 0,
        last_alert_level VARCHAR(20) NOT NULL DEFAULT 'low',
        last_alert_at DATETIME NULL,
        cooldown_until DATETIME NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_risk_alert_state_tenant_asset (tenant_id, asset_code),
        INDEX idx_risk_alert_state_tenant_level (tenant_id, last_alert_level),
        INDEX idx_risk_alert_state_cooldown (cooldown_until)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS risk_score_snapshots (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        asset_code VARCHAR(100) NOT NULL,
        market_risk DECIMAL(10, 2) NOT NULL DEFAULT 0,
        compliance_risk DECIMAL(10, 2) NOT NULL DEFAULT 0,
        device_risk DECIMAL(10, 2) NOT NULL DEFAULT 0,
        raw_score DECIMAL(10, 2) NOT NULL DEFAULT 0,
        smoothed_score DECIMAL(10, 2) NOT NULL DEFAULT 0,
        alert_level VARCHAR(20) NOT NULL DEFAULT 'low',
        fatigue_suppressed TINYINT(1) NOT NULL DEFAULT 0,
        suppress_reason VARCHAR(100) NULL,
        confidence DECIMAL(6, 4) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_risk_score_snapshots_tenant_asset_time (tenant_id, asset_code, created_at),
        INDEX idx_risk_score_snapshots_tenant_level (tenant_id, alert_level, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  })();

  return tablesReadyPromise;
};

const fetchAssets = async ({ tenantId, assetCodes = [], limit = 100 }) => {
  const normalizedLimit = clamp(toNumber(limit, 100), 1, 500);
  const where = buildWhereClause({ tenantId, assetCodes });
  const rows = await safeRows(
    `SELECT
       id,
       asset_code,
       asset_name,
       status,
       purchase_price,
       purchase_date,
       depreciation_years,
       department_new
     FROM assets
     ${where.sql}
     ORDER BY updated_at DESC
     LIMIT ?`,
    [...where.params, normalizedLimit],
  );

  return rows.filter(item => String(item.asset_code || '').trim());
};

const fetchMaintenanceCostMap = async ({ tenantId, assetCodes = [] }) => {
  const where = buildWhereClause({ tenantId, assetCodes });
  if (!where.sql) return new Map();

  const rows = await safeRows(
    `SELECT
       asset_code,
       ROUND(COALESCE(SUM(COALESCE(maintenance_cost, 0)), 0), 2) AS maintenance_cost_180d
     FROM maintenance_logs
     ${where.sql}
       AND COALESCE(maintenance_date, created_at) >= DATE_SUB(NOW(), INTERVAL 180 DAY)
     GROUP BY asset_code`,
    where.params,
  );

  return new Map(rows.map(item => [item.asset_code, item]));
};

const fetchComplianceSignals = async ({ tenantId, assetCodes = [] }) => {
  const normalizedCodes = normalizeAssetCodes(assetCodes);
  if (normalizedCodes.length === 0) return new Map();

  const tenant = normalizeTenantId(tenantId);
  const codePlaceholders = normalizedCodes.map(() => '?').join(',');
  const assetClause = `a.asset_code IN (${codePlaceholders})`;
  const tenantClause = tenant ? ' AND a.tenant_id = ?' : '';
  const assetParams = tenant ? [...normalizedCodes, tenant] : [...normalizedCodes];

  const assessmentRows = await safeRows(
    `SELECT
       a.asset_code,
       AVG(COALESCE(ra.risk_score, 0)) AS assessment_risk
     FROM assets a
     LEFT JOIN risk_assessments ra
       ON ra.asset_id = a.id
      AND ra.tenant_id = a.tenant_id
      AND ra.assessment_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
     WHERE ${assetClause}${tenantClause}
     GROUP BY a.asset_code`,
    assetParams,
  );

  const metrologyWhere = buildWhereClause({ tenantId, assetCodes, alias: 'm' });
  const metrologyRows = await safeRows(
    `SELECT
       m.asset_code,
       COUNT(*) AS overdue_metrology
     FROM metrology_records m
     ${metrologyWhere.sql}
       AND m.next_metrology_date IS NOT NULL
       AND m.next_metrology_date < CURDATE()
     GROUP BY m.asset_code`,
    metrologyWhere.params,
  );

  const adverseWhere = buildWhereClause({ tenantId, assetCodes, alias: 'ar' });
  const adverseRows = await safeRows(
    `SELECT
       ar.asset_code,
       COUNT(*) AS adverse_events_180d
     FROM adverse_reaction_records ar
     ${adverseWhere.sql}
       AND COALESCE(ar.created_at, NOW()) >= DATE_SUB(NOW(), INTERVAL 180 DAY)
     GROUP BY ar.asset_code`,
    adverseWhere.params,
  );

  const merged = new Map();
  [...assessmentRows, ...metrologyRows, ...adverseRows].forEach(item => {
    const assetCode = String(item.asset_code || '').trim();
    if (!assetCode) return;
    if (!merged.has(assetCode)) {
      merged.set(assetCode, {});
    }
    merged.set(assetCode, { ...merged.get(assetCode), ...item });
  });

  return merged;
};

const fetchDeviceAlertMap = async ({ tenantId, assetCodes = [] }) => {
  const where = buildWhereClause({ tenantId, assetCodes, alias: 'la' });
  if (!where.sql) return new Map();

  const rows = await safeRows(
    `SELECT
       la.asset_code,
       COUNT(*) AS pending_alerts
     FROM location_alerts la
     ${where.sql}
       AND la.is_handled = 0
     GROUP BY la.asset_code`,
    where.params,
  );

  return new Map(rows.map(item => [item.asset_code, item]));
};

const calcMarketRisk = ({ asset, maintenanceCost180d = 0, externalSignal = null }) => {
  const purchasePrice = Math.max(1, toNumber(asset.purchase_price));
  const purchaseDate = parseDate(asset.purchase_date);
  const now = getNow();
  const ageDays =
    purchaseDate && !Number.isNaN(purchaseDate.getTime())
      ? Math.max(0, Math.floor((now.getTime() - purchaseDate.getTime()) / 86400000))
      : 0;
  const designLifeDays = Math.max(365, toNumber(asset.depreciation_years, 8) * 365);

  const agePressure = clamp(safeDivide(ageDays, designLifeDays) * 100, 0, 100);
  const costRatio = safeDivide(toNumber(maintenanceCost180d), purchasePrice);
  const costPressure = clamp(costRatio * 100, 0, 100);

  const modelRisk = clamp(10 + agePressure * 0.4 + costPressure * 0.6, 0, 100);
  if (externalSignal == null) {
    return round2(modelRisk);
  }

  return round2(clamp(modelRisk * 0.7 + toNumber(externalSignal) * 0.3, 0, 100));
};

const calcComplianceRisk = signal => {
  const assessmentRisk = clamp(toNumber(signal?.assessment_risk, 25), 0, 100);
  const overduePenalty = Math.min(25, toNumber(signal?.overdue_metrology) * 12);
  const adversePenalty = Math.min(20, toNumber(signal?.adverse_events_180d) * 6);
  return round2(clamp(assessmentRisk * 0.6 + overduePenalty + adversePenalty, 0, 100));
};

const calcDeviceRisk = ({ predictiveSignal, pendingAlerts = 0 }) => {
  const failureRisk = clamp(toNumber(predictiveSignal?.failure_probability_30d, 35), 0, 100);
  const alertPenalty = Math.min(25, toNumber(pendingAlerts) * 5);
  return round2(clamp(failureRisk * 0.75 + alertPenalty, 0, 100));
};

const calcCompositeRisk = ({ marketRisk, complianceRisk, deviceRisk, weights }) =>
  round2(
    marketRisk * weights.market +
      complianceRisk * weights.compliance +
      deviceRisk * weights.device,
  );

const loadAlertStates = async ({ tenantId, assetCodes = [] }) => {
  const normalizedTenantId = requireTenantId(tenantId);
  const normalizedCodes = normalizeAssetCodes(assetCodes);
  if (!normalizedTenantId || normalizedCodes.length === 0) return new Map();

  const rows = await safeRows(
    `SELECT
       asset_code,
       ema_score,
       last_raw_score,
       last_alert_level,
       last_alert_at,
       cooldown_until
     FROM risk_alert_state
     WHERE tenant_id = ?
       AND asset_code IN (${normalizedCodes.map(() => '?').join(',')})`,
    [normalizedTenantId, ...normalizedCodes],
  );

  return new Map(rows.map(item => [item.asset_code, item]));
};

const evaluateAlertFatigue = ({
  level,
  rawScore,
  smoothedScore,
  previousState,
  now,
  dedupeDelta,
  cooldownHoursMap,
}) => {
  if (!previousState) {
    return {
      suppressed: false,
      suppress_reason: null,
      next_cooldown_until: addHours(now, cooldownHoursMap[level]),
      next_last_alert_at: now,
    };
  }

  const previousLevel = previousState.last_alert_level || 'low';
  const previousRank = LEVEL_RANK[previousLevel] || 1;
  const nextRank = LEVEL_RANK[level] || 1;
  const previousCooldown = parseDate(previousState.cooldown_until);

  if (previousCooldown && previousCooldown > now && nextRank <= previousRank) {
    return {
      suppressed: true,
      suppress_reason: 'cooldown',
      next_cooldown_until: previousCooldown,
      next_last_alert_at: previousState.last_alert_at ? parseDate(previousState.last_alert_at) : null,
    };
  }

  if (
    previousLevel === level &&
    Math.abs(toNumber(previousState.last_raw_score) - rawScore) < dedupeDelta &&
    Math.abs(toNumber(previousState.ema_score) - smoothedScore) < dedupeDelta
  ) {
    return {
      suppressed: true,
      suppress_reason: 'dedupe',
      next_cooldown_until: previousCooldown,
      next_last_alert_at: previousState.last_alert_at ? parseDate(previousState.last_alert_at) : null,
    };
  }

  return {
    suppressed: false,
    suppress_reason: null,
    next_cooldown_until: addHours(now, cooldownHoursMap[level]),
    next_last_alert_at: now,
  };
};

const upsertAlertState = async ({ tenantId, item }) => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) return;

  await db.execute(
    `INSERT INTO risk_alert_state (
       tenant_id,
       asset_code,
       ema_score,
       last_raw_score,
       last_alert_level,
       last_alert_at,
       cooldown_until
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       ema_score = VALUES(ema_score),
       last_raw_score = VALUES(last_raw_score),
       last_alert_level = VALUES(last_alert_level),
       last_alert_at = VALUES(last_alert_at),
       cooldown_until = VALUES(cooldown_until),
       updated_at = CURRENT_TIMESTAMP`,
    [
      normalizedTenantId,
      item.asset_code,
      item.smoothed_score,
      item.raw_score,
      item.alert_level,
      item.last_alert_at,
      item.cooldown_until,
    ],
  );
};

const insertSnapshot = async ({ tenantId, item }) => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) return null;

  const [result] = await db.execute(
    `INSERT INTO risk_score_snapshots (
       tenant_id,
       asset_code,
       market_risk,
       compliance_risk,
       device_risk,
       raw_score,
       smoothed_score,
       alert_level,
       fatigue_suppressed,
       suppress_reason,
       confidence
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalizedTenantId,
      item.asset_code,
      item.market_risk,
      item.compliance_risk,
      item.device_risk,
      item.raw_score,
      item.smoothed_score,
      item.alert_level,
      item.fatigue_suppressed ? 1 : 0,
      item.suppress_reason || null,
      item.confidence,
    ],
  );

  return result?.insertId || null;
};

const buildActions = item => {
  const actions = [];
  if (item.device_risk >= 70) {
    actions.push('优先安排该资产的预防性维保并核查IoT在线稳定性');
  }
  if (item.compliance_risk >= 60) {
    actions.push('补齐计量/合规检查，并更新风险评估结论');
  }
  if (item.market_risk >= 65) {
    actions.push('评估替代采购与供应链价格波动影响');
  }
  if (item.fatigue_suppressed) {
    actions.push('当前告警已降噪抑制，进入观察窗口');
  }
  if (actions.length === 0) {
    actions.push('维持例行巡检，保持风险监控频率');
  }
  return actions;
};

const getRiskTrend = async ({
  tenantId,
  assetCodes = [],
  days = DEFAULT_TREND_DAYS,
}) => {
  const normalizedTenantId = requireTenantId(tenantId);
  const normalizedDays = normalizeTrendDays(days);

  await ensureEngineTables();

  const normalizedCodes = normalizeAssetCodes(assetCodes);
  const assetFilterSql =
    normalizedCodes.length > 0
      ? ` AND asset_code IN (${normalizedCodes.map(() => '?').join(',')})`
      : '';

  const rows = await safeRows(
    `SELECT
       DATE(created_at) AS snapshot_date,
       ROUND(AVG(smoothed_score), 2) AS average_score,
       ROUND(MAX(smoothed_score), 2) AS max_score,
       ROUND(MIN(smoothed_score), 2) AS min_score,
       SUM(CASE WHEN alert_level IN ('high', 'critical') THEN 1 ELSE 0 END) AS high_risk_count,
       SUM(CASE WHEN fatigue_suppressed = 1 THEN 1 ELSE 0 END) AS suppressed_count,
       COUNT(*) AS sample_count
     FROM risk_score_snapshots
     WHERE tenant_id = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL ${normalizedDays} DAY)
       ${assetFilterSql}
     GROUP BY DATE(created_at)
     ORDER BY snapshot_date ASC`,
    [normalizedTenantId, ...normalizedCodes],
  );

  const points = rows
    .map(item => ({
      date: normalizeDateBucket(item.snapshot_date),
      average_score: round2(item.average_score),
      max_score: round2(item.max_score),
      min_score: round2(item.min_score),
      high_risk_count: Math.max(0, Math.round(toNumber(item.high_risk_count, 0))),
      suppressed_count: Math.max(0, Math.round(toNumber(item.suppressed_count, 0))),
      sample_count: Math.max(0, Math.round(toNumber(item.sample_count, 0))),
    }))
    .filter(item => item.date);

  const latest = points[points.length - 1] || null;
  const previous = points.length > 1 ? points[points.length - 2] : null;
  const scoreDelta =
    latest && previous ? round2(latest.average_score - previous.average_score) : 0;
  const sampleCount = points.reduce((sum, item) => sum + item.sample_count, 0);
  const peakHighRisk = points.reduce(
    (max, item) => Math.max(max, item.high_risk_count),
    0,
  );

  return {
    generated_at: new Date().toISOString(),
    days: normalizedDays,
    asset_scope: normalizedCodes.length > 0 ? normalizedCodes.length : 'all',
    total_points: points.length,
    points,
    summary: {
      latest_average_score: latest?.average_score ?? 0,
      previous_average_score: previous?.average_score ?? null,
      score_delta: scoreDelta,
      trend_direction: resolveTrendDirection(scoreDelta),
      latest_high_risk_count: latest?.high_risk_count ?? 0,
      peak_high_risk_count: peakHighRisk,
      average_samples_per_day: round2(safeDivide(sampleCount, Math.max(1, points.length))),
    },
  };
};

const score = async ({
  tenantId,
  assetCodes = [],
  limit = 100,
  weights = DEFAULT_WEIGHTS,
  smoothing = 0.55,
  dedupeDelta = 3,
  cooldownHours = DEFAULT_COOLDOWN_HOURS,
  externalMarketSignals = {},
  persist = true,
}) => {
  const normalizedTenantId = requireTenantId(tenantId);
  const normalizedSmoothing = clamp(toNumber(smoothing, 0.55), 0.05, 0.95);
  const normalizedWeights = normalizeWeights(weights);
  const normalizedCooldownHours = {
    low: clamp(toNumber(cooldownHours?.low, DEFAULT_COOLDOWN_HOURS.low), 1, 72),
    medium: clamp(toNumber(cooldownHours?.medium, DEFAULT_COOLDOWN_HOURS.medium), 1, 72),
    high: clamp(toNumber(cooldownHours?.high, DEFAULT_COOLDOWN_HOURS.high), 1, 72),
    critical: clamp(toNumber(cooldownHours?.critical, DEFAULT_COOLDOWN_HOURS.critical), 1, 72),
  };

  const assets = await fetchAssets({
    tenantId: normalizedTenantId,
    assetCodes,
    limit,
  });
  if (assets.length === 0) {
    return {
      generated_at: new Date().toISOString(),
      total_assets: 0,
      scores: [],
      summary: {
        average_score: 0,
        high_risk_assets: 0,
        suppressed_alerts: 0,
      },
    };
  }

  const normalizedCodes = assets.map(item => item.asset_code);

  if (persist && normalizedTenantId) {
    await ensureEngineTables();
  }

  const [maintenanceCostMap, complianceMap, alertMap, predictiveMap, stateMap] = await Promise.all([
    fetchMaintenanceCostMap({ tenantId: normalizedTenantId, assetCodes: normalizedCodes }),
    fetchComplianceSignals({ tenantId: normalizedTenantId, assetCodes: normalizedCodes }),
    fetchDeviceAlertMap({ tenantId: normalizedTenantId, assetCodes: normalizedCodes }),
    predictiveMaintenanceService.predictRiskByAsset({
      tenantId: normalizedTenantId,
      assetCodes: normalizedCodes,
      limit: normalizedCodes.length,
      lookbackDays: 90,
    }),
    loadAlertStates({ tenantId: normalizedTenantId, assetCodes: normalizedCodes }),
  ]);

  const now = getNow();
  const results = [];

  for (const asset of assets) {
    const assetCode = asset.asset_code;
    const maintenanceCost = maintenanceCostMap.get(assetCode)?.maintenance_cost_180d || 0;
    const marketRisk = calcMarketRisk({
      asset,
      maintenanceCost180d: maintenanceCost,
      externalSignal: externalMarketSignals?.[assetCode],
    });
    const complianceRisk = calcComplianceRisk(complianceMap.get(assetCode) || {});
    const deviceRisk = calcDeviceRisk({
      predictiveSignal: predictiveMap[assetCode],
      pendingAlerts: alertMap.get(assetCode)?.pending_alerts || 0,
    });

    const rawScore = calcCompositeRisk({
      marketRisk,
      complianceRisk,
      deviceRisk,
      weights: normalizedWeights,
    });
    const previousState = stateMap.get(assetCode);
    const previousEma = toNumber(previousState?.ema_score, rawScore);
    const smoothedScore = round2(
      normalizedSmoothing * rawScore + (1 - normalizedSmoothing) * previousEma,
    );
    const alertLevel = classifyLevel(smoothedScore);

    const fatigue = evaluateAlertFatigue({
      level: alertLevel,
      rawScore,
      smoothedScore,
      previousState,
      now,
      dedupeDelta: clamp(toNumber(dedupeDelta, 3), 0.5, 10),
      cooldownHoursMap: normalizedCooldownHours,
    });

    const confidence = round2(
      clamp(
        0.45 +
          (toNumber(predictiveMap[assetCode]?.confidence) || 0) * 0.35 +
          (complianceMap.has(assetCode) ? 0.1 : 0) +
          (alertMap.has(assetCode) ? 0.1 : 0),
        0.35,
        0.99,
      ),
    );

    const item = {
      asset_code: assetCode,
      asset_name: asset.asset_name,
      department: asset.department_new || null,
      market_risk: marketRisk,
      compliance_risk: complianceRisk,
      device_risk: deviceRisk,
      raw_score: rawScore,
      smoothed_score: smoothedScore,
      alert_level: alertLevel,
      fatigue_suppressed: fatigue.suppressed,
      suppress_reason: fatigue.suppress_reason,
      confidence,
      cooldown_until: fatigue.next_cooldown_until,
      last_alert_at: fatigue.next_last_alert_at,
    };
    item.actions = buildActions(item);
    results.push(item);
  }

  // Batch persist all alert states and snapshots instead of sequential writes
  if (persist && normalizedTenantId && results.length > 0) {
    const persistStartTime = Date.now();
    const upsertPromises = results.map(item =>
      upsertAlertState({ tenantId: normalizedTenantId, item }),
    );
    const snapshotPromises = results.map(item =>
      insertSnapshot({ tenantId: normalizedTenantId, item }),
    );
    const [upsertResults, snapshotResults] = await Promise.all([
      Promise.all(upsertPromises),
      Promise.all(snapshotPromises),
    ]);
    results.forEach((item, idx) => {
      item.risk_snapshot_id = snapshotResults[idx] || null;
      item.risk_snapshot_at = new Date().toISOString();
    });
    const persistDuration = Date.now() - persistStartTime;
    if (persistDuration > 2000) {
      console.warn(`[RiskEngine] Batch persist took ${persistDuration}ms for ${results.length} assets`);
    }
  } else {
    results.forEach(item => {
      item.risk_snapshot_id = null;
      item.risk_snapshot_at = null;
    });
  }

  results.sort((a, b) => b.smoothed_score - a.smoothed_score);

  const summary = {
    average_score: round2(
      safeDivide(
        results.reduce((sum, item) => sum + item.smoothed_score, 0),
        Math.max(1, results.length),
      ),
    ),
    high_risk_assets: results.filter(item => LEVEL_RANK[item.alert_level] >= LEVEL_RANK.high).length,
    suppressed_alerts: results.filter(item => item.fatigue_suppressed).length,
  };

  if (persist && normalizedTenantId) {
    await publishRiskEvent('risk.score.updated', {
      tenant_id: normalizedTenantId,
      total_assets: results.length,
      high_risk_assets: summary.high_risk_assets,
      generated_at: new Date().toISOString(),
    });
  }

  return {
    generated_at: new Date().toISOString(),
    engine: {
      name: 'UnifiedRiskScoringEngine',
      version: '0.1.0',
      weights: normalizedWeights,
      smoothing: normalizedSmoothing,
      cooldown_hours: normalizedCooldownHours,
      dedupe_delta: clamp(toNumber(dedupeDelta, 3), 0.5, 10),
    },
    total_assets: results.length,
    scores: results.map(item => ({
      ...item,
      cooldown_until: item.cooldown_until ? item.cooldown_until.toISOString() : null,
      last_alert_at: item.last_alert_at ? item.last_alert_at.toISOString() : null,
    })),
    summary,
  };
};

module.exports = {
  score,
  getRiskTrend,
  ensureEngineTables,
  internals: {
    normalizeWeights,
    normalizeTrendDays,
    resolveTrendDirection,
    calcMarketRisk,
    calcComplianceRisk,
    calcDeviceRisk,
    calcCompositeRisk,
    evaluateAlertFatigue,
    classifyLevel,
  },
};
