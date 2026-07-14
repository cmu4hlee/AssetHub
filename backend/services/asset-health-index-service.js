const db = require('../config/database');
const riskScoringEngineService = require('./risk-scoring-engine-service');

const MISSING_TABLE_ERRORS = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_PARSE_ERROR']);
let tablesReadyPromise = null;

const DEFAULT_WEIGHTS = {
  status: 0.35,
  cost: 0.25,
  risk_inverse: 0.25,
  strategy: 0.15,
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

const normalizeStringArray = input => {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map(item => String(item || '').trim())
        .filter(Boolean),
    ),
  );
};

const normalizeWeights = weights => {
  const candidate = {
    status: toNumber(weights?.status, DEFAULT_WEIGHTS.status),
    cost: toNumber(weights?.cost, DEFAULT_WEIGHTS.cost),
    risk_inverse: toNumber(weights?.risk_inverse, DEFAULT_WEIGHTS.risk_inverse),
    strategy: toNumber(weights?.strategy, DEFAULT_WEIGHTS.strategy),
  };
  const sum = Math.max(
    0.0001,
    candidate.status + candidate.cost + candidate.risk_inverse + candidate.strategy,
  );
  return {
    status: candidate.status / sum,
    cost: candidate.cost / sum,
    risk_inverse: candidate.risk_inverse / sum,
    strategy: candidate.strategy / sum,
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

const ensureHealthTables = async () => {
  if (tablesReadyPromise) return tablesReadyPromise;

  tablesReadyPromise = (async () => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asset_health_snapshots (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        asset_code VARCHAR(100) NOT NULL,
        health_index DECIMAL(10, 2) NOT NULL DEFAULT 0,
        health_grade VARCHAR(5) NOT NULL DEFAULT 'E',
        status_component DECIMAL(10, 2) NOT NULL DEFAULT 0,
        cost_component DECIMAL(10, 2) NOT NULL DEFAULT 0,
        risk_inverse_component DECIMAL(10, 2) NOT NULL DEFAULT 0,
        strategic_component DECIMAL(10, 2) NOT NULL DEFAULT 0,
        portfolio_overall_index DECIMAL(10, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_asset_health_snapshots_tenant_asset_time (tenant_id, asset_code, created_at),
        INDEX idx_asset_health_snapshots_tenant_time (tenant_id, created_at),
        INDEX idx_asset_health_snapshots_tenant_grade (tenant_id, health_grade, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  })();

  return tablesReadyPromise;
};

const insertHealthSnapshot = async ({ tenantId, item, overallIndex }) => {
  const normalizedTenantId = requireTenantId(tenantId);
  if (!normalizedTenantId || !item?.asset_code) return;

  await db.execute(
    `INSERT INTO asset_health_snapshots (
       tenant_id,
       asset_code,
       health_index,
       health_grade,
       status_component,
       cost_component,
       risk_inverse_component,
       strategic_component,
       portfolio_overall_index
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalizedTenantId,
      item.asset_code,
      item.health_index,
      item.health_grade,
      item.components?.status ?? 0,
      item.components?.cost_efficiency ?? 0,
      item.components?.risk_inverse ?? 0,
      item.components?.strategic_fit ?? 0,
      overallIndex,
    ],
  );
};

const classifyHealthGrade = score => {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'E';
};

const { ASSET_STATUS_LIST, normalizeStatus } = require('../config/asset-status.constants');

const statusScore = status => {
  const normalized = String(status || '').toLowerCase();
  if (['active', '在用', '使用中', 'online'].some(item => normalized.includes(item))) return 90;
  if (['idle', '闲置', 'standby'].some(item => normalized.includes(item))) return 65;
  if (['repair', '维护', '维修', '故障'].some(item => normalized.includes(item))) return 40;
  if (['scrap', '报废', 'retired'].some(item => normalized.includes(item))) return 8;
  return 55;
};

const strategyScore = ({
  asset,
  strategicDepartments = [],
  strategicAssetCodes = [],
}) => {
  const department = String(asset.department_new || '');
  const assetCode = String(asset.asset_code || '');
  const status = String(asset.status || '').toLowerCase();
  const now = new Date();
  const purchaseDate = asset.purchase_date ? new Date(asset.purchase_date) : null;
  const ageYears =
    purchaseDate && !Number.isNaN(purchaseDate.getTime())
      ? Math.max(0, (now.getTime() - purchaseDate.getTime()) / 31536000000)
      : 0;

  let score = 45;
  if (strategicAssetCodes.includes(assetCode)) score += 20;
  if (strategicDepartments.includes(department)) score += 15;
  if (status.includes('active') || status.includes('在用') || status.includes('使用中')) score += 10;
  if (ageYears <= 5) score += 10;
  else if (ageYears <= 8) score += 5;

  return clamp(score, 0, 100);
};

const fetchAssets = async ({ tenantId, assetCodes = [], limit = 100 }) => {
  const normalizedTenantId = requireTenantId(tenantId);
  const normalizedCodes = normalizeStringArray(assetCodes);
  const conditions = [];
  const params = [];

  if (normalizedTenantId) {
    conditions.push('tenant_id = ?');
    params.push(normalizedTenantId);
  }
  if (normalizedCodes.length > 0) {
    conditions.push(`asset_code IN (${normalizedCodes.map(() => '?').join(',')})`);
    params.push(...normalizedCodes);
  }

  const rows = await safeRows(
    `SELECT
       id,
       asset_code,
       asset_name,
       status,
       department_new,
       purchase_date,
       purchase_price,
       depreciation_years
     FROM assets
     ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY updated_at DESC
     LIMIT ?`,
    [...params, clamp(toNumber(limit, 100), 1, 500)],
  );

  return rows.filter(item => String(item.asset_code || '').trim());
};

const fetchCostMap = async ({ tenantId, assetCodes = [] }) => {
  const normalizedTenantId = requireTenantId(tenantId);
  const normalizedCodes = normalizeStringArray(assetCodes);
  if (!normalizedTenantId || normalizedCodes.length === 0) {
    return new Map();
  }

  const rows = await safeRows(
    `SELECT
       asset_code,
       ROUND(COALESCE(SUM(COALESCE(maintenance_cost, 0)), 0), 2) AS maintenance_cost_365d
     FROM maintenance_logs
     WHERE tenant_id = ?
       AND asset_code IN (${normalizedCodes.map(() => '?').join(',')})
       AND COALESCE(maintenance_date, created_at) >= DATE_SUB(NOW(), INTERVAL 365 DAY)
     GROUP BY asset_code`,
    [normalizedTenantId, ...normalizedCodes],
  );

  return new Map(rows.map(item => [item.asset_code, item]));
};

const calcCostScore = ({ purchasePrice, annualMaintenanceCost }) => {
  const ratio = safeDivide(toNumber(annualMaintenanceCost), Math.max(1, toNumber(purchasePrice)));
  return round2(clamp(100 - ratio * 120, 0, 100));
};

const computeHealthIndex = async ({
  tenantId,
  assetCodes = [],
  limit = 100,
  weights = DEFAULT_WEIGHTS,
  strategicDepartments = [],
  strategicAssetCodes = [],
  persist = true,
}) => {
  const normalizedTenantId = requireTenantId(tenantId);
  const normalizedWeights = normalizeWeights(weights);
  const normalizedStrategicDepartments = normalizeStringArray(strategicDepartments);
  const normalizedStrategicAssetCodes = normalizeStringArray(strategicAssetCodes);

  const assets = await fetchAssets({
    tenantId: normalizedTenantId,
    assetCodes,
    limit,
  });
  if (assets.length === 0) {
    return {
      generated_at: new Date().toISOString(),
      total_assets: 0,
      health_index: [],
      portfolio: {
        overall_index: 0,
        distribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
      },
      by_department: [],
    };
  }

  const assetCodeList = assets.map(item => item.asset_code);
  if (persist && normalizedTenantId) {
    await ensureHealthTables();
  }

  const [costMap, riskResult] = await Promise.all([
    fetchCostMap({ tenantId: normalizedTenantId, assetCodes: assetCodeList }),
    riskScoringEngineService.score({
      tenantId: normalizedTenantId,
      assetCodes: assetCodeList,
      limit: assetCodeList.length,
      persist: false,
    }),
  ]);
  const riskMap = new Map(
    (riskResult.scores || []).map(item => [item.asset_code, item.smoothed_score]),
  );

  const healthIndex = assets.map(asset => {
    const annualMaintenanceCost = toNumber(costMap.get(asset.asset_code)?.maintenance_cost_365d, 0);
    const status_component = statusScore(asset.status);
    const cost_component = calcCostScore({
      purchasePrice: asset.purchase_price,
      annualMaintenanceCost,
    });
    const risk_inverse_component = round2(100 - toNumber(riskMap.get(asset.asset_code), 50));
    const strategy_component = strategyScore({
      asset,
      strategicDepartments: normalizedStrategicDepartments,
      strategicAssetCodes: normalizedStrategicAssetCodes,
    });

    const index = round2(
      status_component * normalizedWeights.status +
        cost_component * normalizedWeights.cost +
        risk_inverse_component * normalizedWeights.risk_inverse +
        strategy_component * normalizedWeights.strategy,
    );

    return {
      asset_code: asset.asset_code,
      asset_name: asset.asset_name,
      department: asset.department_new || null,
      health_index: index,
      health_grade: classifyHealthGrade(index),
      components: {
        status: round2(status_component),
        cost_efficiency: round2(cost_component),
        risk_inverse: round2(risk_inverse_component),
        strategic_fit: round2(strategy_component),
      },
      references: {
        annual_maintenance_cost: round2(annualMaintenanceCost),
        risk_score: round2(100 - risk_inverse_component),
      },
    };
  });

  healthIndex.sort((a, b) => b.health_index - a.health_index);

  const distribution = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  healthIndex.forEach(item => {
    distribution[item.health_grade] += 1;
  });

  const overallIndex = round2(
    safeDivide(
      healthIndex.reduce((sum, item) => sum + item.health_index, 0),
      healthIndex.length,
    ),
  );

  const deptMap = new Map();
  healthIndex.forEach(item => {
    const key = item.department || '未分配';
    if (!deptMap.has(key)) {
      deptMap.set(key, {
        department: key,
        asset_count: 0,
        total_index: 0,
      });
    }
    const target = deptMap.get(key);
    target.asset_count += 1;
    target.total_index += item.health_index;
  });

  const byDepartment = Array.from(deptMap.values())
    .map(item => ({
      department: item.department,
      asset_count: item.asset_count,
      average_health_index: round2(safeDivide(item.total_index, item.asset_count)),
    }))
    .sort((a, b) => b.average_health_index - a.average_health_index);

  if (persist && normalizedTenantId) {
    for (const item of healthIndex) {
      // 顺序写入避免在数据库低并发配置下触发瞬时连接压力。
      // eslint-disable-next-line no-await-in-loop
      await insertHealthSnapshot({
        tenantId: normalizedTenantId,
        item,
        overallIndex,
      });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    total_assets: healthIndex.length,
    model: {
      name: 'PortfolioHealthIndex',
      version: '0.1.0',
      weights: normalizedWeights,
    },
    health_index: healthIndex,
    portfolio: {
      overall_index: overallIndex,
      distribution,
    },
    by_department: byDepartment,
  };
};

const getHealthTrend = async ({
  tenantId,
  assetCodes = [],
  days = DEFAULT_TREND_DAYS,
}) => {
  const normalizedTenantId = requireTenantId(tenantId);
  const normalizedDays = normalizeTrendDays(days);

  await ensureHealthTables();

  const normalizedCodes = normalizeStringArray(assetCodes);
  const assetFilterSql =
    normalizedCodes.length > 0
      ? ` AND asset_code IN (${normalizedCodes.map(() => '?').join(',')})`
      : '';

  const rows = await safeRows(
    `SELECT
       DATE(created_at) AS snapshot_date,
       ROUND(AVG(health_index), 2) AS average_health_index,
       ROUND(MAX(health_index), 2) AS max_health_index,
       ROUND(MIN(health_index), 2) AS min_health_index,
       ROUND(AVG(portfolio_overall_index), 2) AS average_portfolio_index,
       SUM(CASE WHEN health_grade IN ('D', 'E') THEN 1 ELSE 0 END) AS low_health_count,
       COUNT(*) AS sample_count
     FROM asset_health_snapshots
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
      average_health_index: round2(item.average_health_index),
      max_health_index: round2(item.max_health_index),
      min_health_index: round2(item.min_health_index),
      average_portfolio_index: round2(item.average_portfolio_index),
      low_health_count: Math.max(0, Math.round(toNumber(item.low_health_count, 0))),
      sample_count: Math.max(0, Math.round(toNumber(item.sample_count, 0))),
    }))
    .filter(item => item.date);

  const latest = points[points.length - 1] || null;
  const previous = points.length > 1 ? points[points.length - 2] : null;
  const healthDelta =
    latest && previous ? round2(latest.average_health_index - previous.average_health_index) : 0;
  const sampleCount = points.reduce((sum, item) => sum + item.sample_count, 0);
  const peakLowHealth = points.reduce(
    (max, item) => Math.max(max, item.low_health_count),
    0,
  );

  return {
    generated_at: new Date().toISOString(),
    days: normalizedDays,
    asset_scope: normalizedCodes.length > 0 ? normalizedCodes.length : 'all',
    total_points: points.length,
    points,
    summary: {
      latest_average_health_index: latest?.average_health_index ?? 0,
      previous_average_health_index: previous?.average_health_index ?? null,
      health_delta: healthDelta,
      trend_direction: resolveTrendDirection(healthDelta),
      latest_low_health_count: latest?.low_health_count ?? 0,
      peak_low_health_count: peakLowHealth,
      average_samples_per_day: round2(safeDivide(sampleCount, Math.max(1, points.length))),
    },
  };
};

module.exports = {
  computeHealthIndex,
  getHealthTrend,
  ensureHealthTables,
  internals: {
    normalizeWeights,
    normalizeTrendDays,
    resolveTrendDirection,
    statusScore,
    strategyScore,
    classifyHealthGrade,
    calcCostScore,
  },
};
