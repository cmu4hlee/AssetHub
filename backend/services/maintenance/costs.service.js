const db = require('../../config/database');
const { addTenantFilter, getTenantId } = require('../../middleware/tenant-filter');

function badRequest(message) {
  return { statusCode: 400, body: { success: false, message } };
}

function notFound(message) {
  return { statusCode: 404, body: { success: false, message } };
}

async function getCostTrend(query, req) {
  const { start_date, end_date, interval = 'month' } = query;

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

  const allowedFormats = {
    day: '%Y-%m-%d',
    week: '%Y-%u',
    month: '%Y-%m',
    quarter: '%Y-Q',
    year: '%Y',
  };
  const dateFormat = allowedFormats[interval] || '%Y-%m';

  // 参数顺序必须与 SQL 中 ? 出现的顺序一致：DATE_FORMAT 的 dateFormat 在前，tenant_id 在 whereClause 中
  const queryParams = [dateFormat, ...params];

  const [result] = await db.execute(
    `SELECT
       DATE_FORMAT(ml.maintenance_date, ?) as period,
       SUM(ml.maintenance_cost) as total_cost,
       COUNT(*) as maintenance_count
     FROM maintenance_logs ml
     ${whereClause}
     GROUP BY period
     ORDER BY period ASC`,
    queryParams,
  );

  return {
    success: true,
    data: result,
    message: '成本趋势分析成功',
    interval,
    period_count: result.length,
  };
}

async function getCostDepartment(query, req) {
  const { start_date, end_date } = query;

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
       a.department,
       SUM(ml.maintenance_cost) as total_cost,
       COUNT(*) as maintenance_count,
       AVG(ml.maintenance_cost) as avg_cost
     FROM maintenance_logs ml
     LEFT JOIN assets a ON ml.asset_code = a.asset_code AND a.tenant_id = ml.tenant_id
     ${whereClause}
     GROUP BY a.department
     ORDER BY total_cost DESC`,
    params,
  );

  return {
    success: true,
    data: result,
    message: '部门成本分布分析成功',
    department_count: result.length,
  };
}

async function getCostAssetType(query, req) {
  const { start_date, end_date } = query;

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
       ac.name as asset_type,
       SUM(ml.maintenance_cost) as total_cost,
       COUNT(*) as maintenance_count,
       AVG(ml.maintenance_cost) as avg_cost
     FROM maintenance_logs ml
     LEFT JOIN assets a ON ml.asset_code = a.asset_code AND a.tenant_id = ml.tenant_id
     LEFT JOIN asset_categories ac ON a.category_id = ac.id
     ${whereClause}
     GROUP BY ac.name
     ORDER BY total_cost DESC`,
    params,
  );

  return {
    success: true,
    data: result,
    message: '资产类别成本分布分析成功',
    asset_type_count: result.length,
  };
}

async function getCostMaintenanceType(query, req) {
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
       maintenance_type,
       SUM(maintenance_cost) as total_cost,
       COUNT(*) as maintenance_count,
       AVG(maintenance_cost) as avg_cost
     FROM maintenance_logs
     ${whereClause}
     GROUP BY maintenance_type
     ORDER BY total_cost DESC`,
    params,
  );

  return {
    success: true,
    data: result,
    message: '维护类型成本分布分析成功',
    maintenance_type_count: result.length,
  };
}

async function getHighCostAssets(query, req) {
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
       a.asset_name,
       ac.name as asset_type,
       a.department,
       SUM(ml.maintenance_cost) as total_cost,
       COUNT(*) as maintenance_count,
       AVG(ml.maintenance_cost) as avg_cost
     FROM maintenance_logs ml
     LEFT JOIN assets a ON ml.asset_code = a.asset_code AND a.tenant_id = ml.tenant_id
     LEFT JOIN asset_categories ac ON a.category_id = ac.id
     ${whereClause}
     GROUP BY ml.asset_code, a.asset_name, ac.name, a.department
     ORDER BY total_cost DESC
     LIMIT ?`,
    [...params, parseInt(limit, 10)],
  );

  return {
    success: true,
    data: result,
    message: '高成本资产分析成功',
    limit: parseInt(limit, 10),
    asset_count: result.length,
  };
}

async function getCosts(query, req) {
  const {
    asset_code,
    cost_type,
    start_date,
    end_date,
    department,
  } = query;
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(query.pageSize, 10) || 20, 1), 200);
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  const params = [];

  const tenantFilter = addTenantFilter(req, 'mc');
  whereClause += tenantFilter.whereClause;
  params.push(...tenantFilter.params);

  if (asset_code) {
    whereClause += ' AND mc.asset_code LIKE ?';
    params.push(`%${asset_code}%`);
  }
  if (cost_type) {
    whereClause += ' AND mc.cost_type = ?';
    params.push(cost_type);
  }
  if (start_date) {
    whereClause += ' AND mc.cost_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND mc.cost_date <= ?';
    params.push(end_date);
  }
  if (department) {
    whereClause += ' AND mc.department LIKE ?';
    params.push(`%${department}%`);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM maintenance_costs mc ${whereClause}`,
    params,
  );
  const { total } = countResult[0];

  const [rows] = await db.execute(
    `SELECT mc.* FROM maintenance_costs mc
     ${whereClause}
     ORDER BY mc.cost_date DESC, mc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    success: true,
    data: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

async function createCost(body, req) {
  const {
    maintenance_log_id,
    work_order_id,
    asset_code,
    cost_date,
    cost_type,
    amount,
    description,
    department,
    location,
  } = body;

  if (!asset_code || !cost_date || !cost_type || !amount) {
    return badRequest('资产编号、成本日期、成本类型和金额不能为空');
  }

  const assetTenantFilter = addTenantFilter(req, 'a');
  const [assets] = await db.execute(
    `SELECT a.asset_code, a.asset_name FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
    [asset_code, ...assetTenantFilter.params],
  );

  if (assets.length === 0) {
    return notFound('资产不存在');
  }

  const asset = assets[0];
  const createdBy = req.user.real_name || req.user.username || '系统管理员';
  const tenantId = getTenantId(req);

  const [result] = await db.execute(
    `INSERT INTO maintenance_costs (
      tenant_id, maintenance_log_id, work_order_id, asset_code, asset_name,
      cost_date, cost_type, amount, description, department, location, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      maintenance_log_id || null,
      work_order_id || null,
      asset.asset_code,
      asset.asset_name,
      cost_date,
      cost_type,
      amount,
      description || null,
      department || null,
      location || null,
      createdBy,
    ],
  );

  return {
    success: true,
    message: '维护成本记录创建成功',
    data: { id: result.insertId },
  };
}

async function updateCost(id, body, req) {
  const {
    maintenance_log_id,
    work_order_id,
    cost_date,
    cost_type,
    amount,
    description,
    department,
    location,
  } = body;

  const updateFields = [];
  const updateValues = [];

  if (maintenance_log_id !== undefined) {
    updateFields.push('maintenance_log_id = ?');
    updateValues.push(maintenance_log_id);
  }
  if (work_order_id !== undefined) {
    updateFields.push('work_order_id = ?');
    updateValues.push(work_order_id);
  }
  if (cost_date !== undefined) {
    updateFields.push('cost_date = ?');
    updateValues.push(cost_date);
  }
  if (cost_type !== undefined) {
    updateFields.push('cost_type = ?');
    updateValues.push(cost_type);
  }
  if (amount !== undefined) {
    updateFields.push('amount = ?');
    updateValues.push(amount);
  }
  if (description !== undefined) {
    updateFields.push('description = ?');
    updateValues.push(description);
  }
  if (department !== undefined) {
    updateFields.push('department = ?');
    updateValues.push(department);
  }
  if (location !== undefined) {
    updateFields.push('location = ?');
    updateValues.push(location);
  }

  if (updateFields.length === 0) {
    return badRequest('没有要更新的字段');
  }

  const tenantFilter = addTenantFilter(req, 'mc');
  const [existing] = await db.execute(
    `SELECT id FROM maintenance_costs mc WHERE mc.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (existing.length === 0) {
    return notFound('维护成本记录不存在');
  }

  updateFields.push('updated_at = NOW()');
  updateValues.push(id);

  await db.execute(
    `UPDATE maintenance_costs mc SET ${updateFields.join(', ')} WHERE mc.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
    [...updateValues, ...tenantFilter.params],
  );

  return { success: true, message: '维护成本记录更新成功' };
}

async function deleteCost(id, req) {
  const tenantFilter = addTenantFilter(req, 'mc');
  const [existing] = await db.execute(
    `SELECT id FROM maintenance_costs mc WHERE mc.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (existing.length === 0) {
    return notFound('维护成本记录不存在');
  }

  await db.execute(
    `DELETE mc FROM maintenance_costs mc WHERE mc.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
    [id, ...tenantFilter.params],
  );

  return { success: true, message: '维护成本记录删除成功' };
}

async function getCostAnalysis(query, req) {
  const { start_date, end_date, department, asset_code } = query;

  let whereClause = 'WHERE 1=1';
  const params = [];

  const tenantFilter = addTenantFilter(req, 'mc');
  whereClause += tenantFilter.whereClause;
  params.push(...tenantFilter.params);

  if (start_date) {
    whereClause += ' AND mc.cost_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND mc.cost_date <= ?';
    params.push(end_date);
  }
  if (department) {
    whereClause += ' AND mc.department LIKE ?';
    params.push(`%${department}%`);
  }
  if (asset_code) {
    whereClause += ' AND mc.asset_code LIKE ?';
    params.push(`%${asset_code}%`);
  }

  const [summary] = await db.execute(
    `SELECT
      SUM(CASE WHEN cost_type = 'labor' THEN amount ELSE 0 END) AS labor_cost,
      SUM(CASE WHEN cost_type = 'material' THEN amount ELSE 0 END) AS material_cost,
      SUM(CASE WHEN cost_type = 'external' THEN amount ELSE 0 END) AS external_cost,
      SUM(CASE WHEN cost_type = 'other' THEN amount ELSE 0 END) AS other_cost,
      SUM(amount) AS total_cost,
      COUNT(*) AS cost_count
    FROM maintenance_costs mc
    ${whereClause}`,
    params,
  );

  const [assetDistribution] = await db.execute(
    `SELECT
      asset_code,
      asset_name,
      SUM(amount) AS total_cost,
      COUNT(*) AS maintenance_count
    FROM maintenance_costs mc
    ${whereClause}
    GROUP BY asset_code, asset_name
    ORDER BY total_cost DESC
    LIMIT 10`,
    params,
  );

  const [departmentDistribution] = await db.execute(
    `SELECT
      department,
      SUM(amount) AS total_cost,
      COUNT(*) AS maintenance_count
    FROM maintenance_costs mc
    ${whereClause}
    GROUP BY department
    ORDER BY total_cost DESC`,
    params,
  );

  const [monthlyTrend] = await db.execute(
    `SELECT
      DATE_FORMAT(cost_date, '%Y-%m') AS month,
      SUM(amount) AS total_cost,
      SUM(CASE WHEN cost_type = 'labor' THEN amount ELSE 0 END) AS labor_cost,
      SUM(CASE WHEN cost_type = 'material' THEN amount ELSE 0 END) AS material_cost,
      SUM(CASE WHEN cost_type = 'external' THEN amount ELSE 0 END) AS external_cost,
      SUM(CASE WHEN cost_type = 'other' THEN amount ELSE 0 END) AS other_cost
    FROM maintenance_costs mc
    ${whereClause}
    GROUP BY DATE_FORMAT(cost_date, '%Y-%m')
    ORDER BY month ASC`,
    params,
  );

  return {
    success: true,
    data: {
      summary: summary[0],
      assetDistribution,
      departmentDistribution,
      monthlyTrend,
    },
  };
}

module.exports = {
  getCostTrend,
  getCostDepartment,
  getCostAssetType,
  getCostMaintenanceType,
  getHighCostAssets,
  getCosts,
  createCost,
  updateCost,
  deleteCost,
  getCostAnalysis,
};
