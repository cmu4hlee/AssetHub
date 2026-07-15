const db = require('../../config/database');
const { getTenantId } = require('../../middleware/tenant-filter');
const costsService = require('./costs.service');

function badRequest(message) {
  return { statusCode: 400, body: { success: false, message } };
}

async function getEfficiencyOverview(query, req) {
  const { start_date, end_date } = query;

  const tenantId = getTenantId(req);
  let whereClause = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (start_date) {
    whereClause += ' AND maintenance_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND maintenance_date <= ?';
    params.push(end_date);
  }

  const [totalResult] = await db.execute(
    `SELECT
       COUNT(*) as total_maintenance,
       SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) as completed_maintenance,
       AVG(maintenance_duration) as avg_maintenance_time,
       MAX(maintenance_duration) as max_maintenance_time,
       MIN(maintenance_duration) as min_maintenance_time
     FROM maintenance_logs
     ${whereClause}`,
    params,
  );

  const totalStats = totalResult[0];
  const completionRate =
    totalStats.total_maintenance > 0
      ? ((totalStats.completed_maintenance / totalStats.total_maintenance) * 100).toFixed(2)
      : '0.00';

  const [typeResult] = await db.execute(
    `SELECT
       maintenance_type,
       COUNT(*) as maintenance_count,
       SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) as completed_count,
       AVG(maintenance_duration) as avg_duration
     FROM maintenance_logs
     ${whereClause}
     GROUP BY maintenance_type
     ORDER BY maintenance_count DESC`,
    params,
  );

  return {
    success: true,
    data: {
      overview: {
        total_maintenance: totalStats.total_maintenance,
        completed_maintenance: totalStats.completed_maintenance,
        completion_rate: completionRate,
        avg_maintenance_time: totalStats.avg_maintenance_time,
        max_maintenance_time: totalStats.max_maintenance_time,
        min_maintenance_time: totalStats.min_maintenance_time,
      },
      by_maintenance_type: typeResult,
    },
    message: '维护效率分析成功',
  };
}

async function getEfficiencyResponseTime(query, req) {
  const { start_date, end_date } = query;

  const tenantId = getTenantId(req);
  let whereClause = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (start_date) {
    whereClause += ' AND maintenance_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND maintenance_date <= ?';
    params.push(end_date);
  }

  const [result] = await db.execute(
    `SELECT
       DATE(maintenance_date) as maintenance_date,
       AVG(TIMESTAMPDIFF(HOUR, created_at, maintenance_date)) as avg_response_hours,
       COUNT(*) as maintenance_count
     FROM maintenance_logs
     ${whereClause}
     GROUP BY DATE(maintenance_date)
     ORDER BY maintenance_date ASC`,
    params,
  );

  return {
    success: true,
    data: result,
    message: '维护响应时间分析成功',
    date_count: result.length,
  };
}

async function getEfficiencyTechnician(query, req) {
  const { start_date, end_date, limit = 10 } = query;

  const tenantId = getTenantId(req);
  let whereClause = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (start_date) {
    whereClause += ' AND maintenance_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND maintenance_date <= ?';
    params.push(end_date);
  }

  const [result] = await db.execute(
    `SELECT
       maintenance_person as technician,
       COUNT(*) as maintenance_count,
       SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) as completed_count,
       AVG(maintenance_duration) as avg_maintenance_time,
       SUM(maintenance_cost) as total_cost
     FROM maintenance_logs
     ${whereClause}
     GROUP BY maintenance_person
     ORDER BY maintenance_count DESC
     LIMIT ?`,
    [...params, parseInt(limit, 10)],
  );

  const technicianEfficiency = result.map(item => ({
    ...item,
    completion_rate:
      item.maintenance_count > 0
        ? ((item.completed_count / item.maintenance_count) * 100).toFixed(2)
        : '0.00',
  }));

  return {
    success: true,
    data: technicianEfficiency,
    message: '技术人员维护效率分析成功',
    technician_count: technicianEfficiency.length,
    limit: parseInt(limit, 10),
  };
}

async function getEfficiencyAssetFrequency(query, req) {
  const { start_date, end_date, limit = 10 } = query;

  const tenantId = getTenantId(req);
  let whereClause = 'WHERE ml.tenant_id = ?';
  const params = [tenantId];

  if (start_date) {
    whereClause += ' AND ml.maintenance_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND ml.maintenance_date <= ?';
    params.push(end_date);
  }

  const [result] = await db.execute(
    `SELECT
       ml.asset_code,
       MAX(a.asset_name) as asset_name,
       MAX(a.department) as department,
       COUNT(*) as maintenance_count,
       AVG(ml.maintenance_duration) as avg_maintenance_time,
       SUM(ml.maintenance_cost) as total_cost
     FROM maintenance_logs ml
     LEFT JOIN assets a ON ml.asset_code = a.asset_code AND ml.tenant_id = a.tenant_id AND a.is_deleted = 0
     ${whereClause}
     GROUP BY ml.asset_code
     ORDER BY maintenance_count DESC
     LIMIT ?`,
    [...params, parseInt(limit, 10)],
  );

  return {
    success: true,
    data: result,
    message: '资产维护频率分析成功',
    asset_count: result.length,
    limit: parseInt(limit, 10),
  };
}

async function getAssetHistoryAnalysis(query, req) {
  const { asset_code, start_date, end_date } = query;

  if (!asset_code) {
    return badRequest('资产编号不能为空');
  }

  const tenantId = getTenantId(req);
  let whereClause = 'WHERE m.tenant_id = ? AND m.asset_code = ?';
  const params = [tenantId, asset_code];

  if (start_date) {
    whereClause += ' AND m.maintenance_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND m.maintenance_date <= ?';
    params.push(end_date);
  }

  const [rows] = await db.execute(
    `SELECT
      m.*,
      e.effectiveness_score,
      e.overall_score,
      e.problem_resolved
    FROM maintenance_logs m
    LEFT JOIN maintenance_evaluations e ON m.id = e.maintenance_log_id AND e.tenant_id = m.tenant_id
    ${whereClause}
    ORDER BY m.maintenance_date DESC`,
    params,
  );

  return { success: true, data: rows };
}

async function getEffectivenessStats(query, req) {
  const { start_date, end_date, maintenance_type } = query;

  if (!start_date || !end_date) {
    return badRequest('开始日期和结束日期不能为空');
  }

  const tenantId = getTenantId(req);
  let whereClause = 'WHERE e.tenant_id = ? AND m.maintenance_date BETWEEN ? AND ?';
  const params = [tenantId, start_date, end_date];

  if (maintenance_type) {
    whereClause += ' AND e.maintenance_type = ?';
    params.push(maintenance_type);
  }

  const [rows] = await db.execute(
    `SELECT
      e.maintenance_type AS maintenance_type,
      COUNT(*) AS total_maintenance,
      SUM(CASE WHEN problem_resolved THEN 1 ELSE 0 END) AS resolved_count,
      ROUND(SUM(CASE WHEN problem_resolved THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) AS resolution_rate,
      AVG(effectiveness_score) AS avg_effectiveness_score,
      AVG(overall_score) AS avg_overall_score,
      SUM(downtime_hours) AS total_downtime
    FROM maintenance_evaluations e
    JOIN maintenance_logs m ON e.maintenance_log_id = m.id AND e.tenant_id = m.tenant_id
    ${whereClause}
    GROUP BY e.maintenance_type
    ORDER BY resolution_rate DESC`,
    params,
  );

  return { success: true, data: rows };
}

async function getCostTrendAnalysis(query, req) {
  const { period = 'monthly', start_date, end_date } = query;

  const tenantId = getTenantId(req);
  let whereClause = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (start_date) {
    whereClause += ' AND maintenance_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND maintenance_date <= ?';
    params.push(end_date);
  }

  let groupByClause = '';
  let periodFormat = '';

  switch (period) {
    case 'monthly':
      periodFormat = 'DATE_FORMAT(maintenance_date, "%Y-%m") AS period';
      groupByClause = 'GROUP BY DATE_FORMAT(maintenance_date, "%Y-%m")';
      break;
    case 'quarterly':
      periodFormat = 'CONCAT(YEAR(maintenance_date), "-Q", QUARTER(maintenance_date)) AS period';
      groupByClause = 'GROUP BY YEAR(maintenance_date), QUARTER(maintenance_date)';
      break;
    case 'yearly':
      periodFormat = 'YEAR(maintenance_date) AS period';
      groupByClause = 'GROUP BY YEAR(maintenance_date)';
      break;
    default:
      periodFormat = 'DATE_FORMAT(maintenance_date, "%Y-%m") AS period';
      groupByClause = 'GROUP BY DATE_FORMAT(maintenance_date, "%Y-%m")';
  }

  // maintenance_logs 表仅有 maintenance_cost 列；人工/材料/外包费用明细在 maintenance_costs 表
  const [rows] = await db.execute(
    `SELECT
      ${periodFormat},
      COUNT(*) AS maintenance_count,
      SUM(maintenance_cost) AS total_cost,
      AVG(maintenance_cost) AS avg_cost_per_maintenance
    FROM maintenance_logs
    ${whereClause}
    ${groupByClause}
    ORDER BY period`,
    params,
  );

  return { success: true, data: rows };
}

async function getTechnicianPerformance(query, req) {
  const { start_date, end_date } = query;

  const tenantId = getTenantId(req);
  let whereClause =
    'WHERE tenant_id = ? AND maintenance_person IS NOT NULL AND maintenance_person != ""';
  const params = [tenantId];

  if (start_date) {
    whereClause += ' AND maintenance_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND maintenance_date <= ?';
    params.push(end_date);
  }

  const [rows] = await db.execute(
    `SELECT
      maintenance_person,
      COUNT(*) AS maintenance_count,
      SUM(maintenance_cost) AS total_cost,
      AVG(maintenance_cost) AS avg_cost,
      MAX(maintenance_cost) AS max_cost,
      MIN(maintenance_cost) AS min_cost
    FROM maintenance_logs
    ${whereClause}
    GROUP BY maintenance_person
    ORDER BY maintenance_count DESC`,
    params,
  );

  return { success: true, data: rows };
}

async function getTypeDistribution(query, req) {
  const { start_date, end_date } = query;

  const tenantId = getTenantId(req);
  let whereClause = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (start_date) {
    whereClause += ' AND maintenance_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND maintenance_date <= ?';
    params.push(end_date);
  }

  const [rows] = await db.execute(
    `SELECT
      maintenance_type,
      COUNT(*) AS maintenance_count,
      SUM(maintenance_cost) AS total_cost,
      AVG(maintenance_cost) AS avg_cost,
      MAX(maintenance_cost) AS max_cost,
      MIN(maintenance_cost) AS min_cost
    FROM maintenance_logs
    ${whereClause}
    GROUP BY maintenance_type
    ORDER BY maintenance_count DESC`,
    params,
  );

  return { success: true, data: rows };
}

async function getFrequencyAnalysis(query, req) {
  const { start_date, end_date, limit = 10 } = query;

  const tenantId = getTenantId(req);
  let whereClause = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (start_date) {
    whereClause += ' AND maintenance_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND maintenance_date <= ?';
    params.push(end_date);
  }

  const [rows] = await db.execute(
    `SELECT
      asset_code,
      asset_name,
      maintenance_type,
      COUNT(*) AS maintenance_count,
      MIN(maintenance_date) AS first_maintenance_date,
      MAX(maintenance_date) AS last_maintenance_date,
      DATEDIFF(MAX(maintenance_date), MIN(maintenance_date)) AS days_between,
      CASE
        WHEN DATEDIFF(MAX(maintenance_date), MIN(maintenance_date)) > 0
        THEN COUNT(*) / (DATEDIFF(MAX(maintenance_date), MIN(maintenance_date)) / 30.44)
        ELSE 0
      END AS monthly_frequency,
      SUM(maintenance_cost) AS total_cost
    FROM maintenance_logs
    ${whereClause}
    GROUP BY asset_code, asset_name, maintenance_type
    ORDER BY maintenance_count DESC
    LIMIT ?`,
    [...params, parseInt(limit, 10)],
  );

  return { success: true, data: rows };
}

// 工单状态与优先级分布（替换前端 Math.random 模拟数据）
async function getWorkOrderDistribution(query, req) {
  const { start_date, end_date } = query;
  const tenantId = getTenantId(req);

  let whereClause = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (start_date) {
    whereClause += ' AND created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND created_at <= ?';
    params.push(end_date);
  }

  // 状态映射（英文枚举 -> 中文标签）
  const statusMap = {
    pending: { name: '待分配', color: '#8c8c8c' },
    assigned: { name: '已分配', color: '#1890ff' },
    in_progress: { name: '进行中', color: '#13c2c2' },
    pending_acceptance: { name: '待审核', color: '#faad14' },
    completed: { name: '已完成', color: '#52c41a' },
    closed: { name: '已关闭', color: '#722ed1' },
    cancelled: { name: '已取消', color: '#ff4d4f' },
  };

  // 优先级映射
  const priorityMap = {
    urgent: { name: '紧急', color: '#ff4d4f' },
    high: { name: '高', color: '#fa8c16' },
    normal: { name: '中', color: '#1890ff' },
    low: { name: '低', color: '#52c41a' },
  };

  let statusRows = [];
  let priorityRows = [];

  try {
    [statusRows] = await db.execute(
      `SELECT status, COUNT(*) AS count FROM work_orders ${whereClause} GROUP BY status`,
      params,
    );
  } catch (e) {
    // work_orders 表可能不存在
  }

  try {
    [priorityRows] = await db.execute(
      `SELECT priority, COUNT(*) AS count FROM work_orders ${whereClause} GROUP BY priority`,
      params,
    );
  } catch (e) {
    // 忽略
  }

  const statusDistribution = statusRows
    .map(row => {
      const info = statusMap[row.status] || { name: row.status, color: '#8c8c8c' };
      return { name: info.name, value: row.count, color: info.color };
    })
    .filter(item => item.value > 0);

  const priorityDistribution = priorityRows
    .map(row => {
      const info = priorityMap[row.priority] || { name: row.priority, color: '#8c8c8c' };
      return { name: info.name, value: row.count, color: info.color };
    })
    .filter(item => item.value > 0);

  return {
    success: true,
    data: {
      statusDistribution,
      priorityDistribution,
    },
  };
}

async function getSecondaryAssetTypes(query, req) {
  const { keyword } = query;
  const tenantId = getTenantId(req);

  let whereClause = 'WHERE ac.parent_id != 0 AND ac.tenant_id = ?';
  const params = [tenantId];

  if (keyword) {
    whereClause += ' AND ac.name LIKE ?';
    params.push(`%${keyword}%`);
  }

  const [rows] = await db.execute(
    `SELECT
       ac.id,
       ac.name,
       ac.code,
       ac.parent_id,
       p.name as parent_name
     FROM asset_categories ac
     LEFT JOIN asset_categories p ON ac.parent_id = p.id
     ${whereClause}
     ORDER BY ac.name ASC`,
    params,
  );

  return {
    success: true,
    data: rows,
    count: rows.length,
    message: '获取二级资产类型成功',
  };
}

/**
 * 成本分析汇总
 * 返回:
 *   - assetDistribution: 高成本资产 Top N
 *   - summary: 汇总指标 (total_cost, avg_cost, total_count, top_asset_name)
 * 给维护效率分析页用
 */
async function getCostAnalysis(query, req) {
  const { start_date, end_date, limit = 10 } = query;

  // 复用 costsService 拿高成本资产列表
  const highCostResult = await costsService.getHighCostAssets({ start_date, end_date, limit }, req);
  const assetDistribution = highCostResult?.data || [];

  // 算汇总
  const tenantId = getTenantId(req);
  let whereClause = 'WHERE tenant_id = ?';
  const summaryParams = [tenantId];
  if (start_date) {
    whereClause += ' AND maintenance_date >= ?';
    summaryParams.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND maintenance_date <= ?';
    summaryParams.push(end_date);
  }
  const [summaryRows] = await db.execute(
    `SELECT
       COUNT(*) AS total_count,
       COALESCE(SUM(maintenance_cost), 0) AS total_cost,
       COALESCE(AVG(maintenance_cost), 0) AS avg_cost
     FROM maintenance_logs
     ${whereClause}`,
    summaryParams,
  );
  const row = summaryRows[0] || {};
  const summary = {
    total_count: Number(row.total_count || 0),
    total_cost: Number(row.total_cost || 0),
    avg_cost: Number(row.avg_cost || 0),
    top_asset_name: assetDistribution[0]?.asset_name || '-',
    top_asset_cost: Number(assetDistribution[0]?.total_cost || 0),
  };

  return {
    success: true,
    data: { assetDistribution, summary },
    message: '成本分析成功',
  };
}

module.exports = {
  getEfficiencyOverview,
  getEfficiencyResponseTime,
  getEfficiencyTechnician,
  getEfficiencyAssetFrequency,
  getAssetHistoryAnalysis,
  getEffectivenessStats,
  getCostTrendAnalysis,
  getCostAnalysis,
  getTechnicianPerformance,
  getTypeDistribution,
  getFrequencyAnalysis,
  getWorkOrderDistribution,
  getSecondaryAssetTypes,
};
