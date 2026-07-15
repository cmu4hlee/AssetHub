const db = require('../../config/database');
const { addTenantFilter, getTenantId } = require('../../middleware/tenant-filter');

function badRequest(message) {
  return { statusCode: 400, body: { success: false, message } };
}

function notFound(message) {
  return { statusCode: 404, body: { success: false, message } };
}

async function tableExists(tableName) {
  const [rows] = await db.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return rows.length > 0;
}

async function updateUsage(body, req) {
  const {
    asset_code,
    usage_amount,
    usage_type,
    usage_date = new Date().toISOString().split('T')[0],
  } = body;

  if (!asset_code || !usage_amount) {
    return badRequest('资产编号和使用量不能为空');
  }

  const tenantId = getTenantId(req);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [assets] = await connection.execute(
      'SELECT asset_name FROM assets WHERE asset_code = ? AND tenant_id = ?',
      [asset_code, tenantId],
    );

    if (assets.length === 0) {
      await connection.rollback();
      return notFound('资产不存在');
    }

    const assetName = assets[0].asset_name;

    const [planResult] = await connection.execute(
      `UPDATE preventive_maintenance_plans
       SET current_usage = current_usage + ?,
           updated_at = NOW()
       WHERE asset_code = ? AND tenant_id = ? AND trigger_type = 'usage'`,
      [usage_amount, asset_code, tenantId],
    );

    // BUG-U1 修复：UPDATE 已将 current_usage 加上 usage_amount，SELECT 读取的是更新后的值，
    // 因此阈值判断条件应为 current_usage >= usage_threshold（不再重复加 usage_amount）
    const [thresholdResult] = await connection.execute(
      `SELECT id, plan_name, usage_threshold, current_usage
       FROM preventive_maintenance_plans
       WHERE asset_code = ? AND tenant_id = ? AND trigger_type = 'usage'
       AND current_usage >= usage_threshold AND status = '启用'`,
      [asset_code, tenantId],
    );

    const triggeredPlans = [];
    for (const plan of thresholdResult) {
      // BUG-U1 修复：plan.current_usage 已是 UPDATE 之后的值，无需再加 usage_amount
      const updatedUsage = Number(plan.current_usage);

      // BUG-U2 修复：去重检查，避免同一计划重复创建触发记录
      const [existingTrigger] = await connection.execute(
        `SELECT id FROM usage_triggered_maintenance
         WHERE plan_id = ? AND tenant_id = ? AND status = 'pending'`,
        [plan.id, tenantId],
      );

      if (existingTrigger.length > 0) {
        triggeredPlans.push({
          plan_id: plan.id,
          plan_name: plan.plan_name,
          current_usage: updatedUsage,
          usage_threshold: plan.usage_threshold,
          status: '已存在待处理触发记录',
        });
        continue;
      }

      await connection.execute(
        `INSERT INTO usage_triggered_maintenance
         (tenant_id, asset_code, asset_name, plan_id, trigger_date, current_usage, threshold_usage, usage_type, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          asset_code,
          assetName,
          plan.id,
          usage_date,
          updatedUsage,
          plan.usage_threshold,
          usage_type || '小时',
          'pending',
        ],
      );

      triggeredPlans.push({
        plan_id: plan.id,
        plan_name: plan.plan_name,
        current_usage: updatedUsage,
        usage_threshold: plan.usage_threshold,
        status: '达到阈值',
      });
    }

    await connection.commit();

    return {
      success: true,
      message: '使用量更新成功',
      data: {
        asset_code,
        usage_amount,
        updated_plans: planResult.affectedRows,
        triggered_plans: triggeredPlans,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getUsageHistory(query, req) {
  const { asset_code, start_date, end_date, page = 1, pageSize = 20 } = query;
  const offset = (page - 1) * pageSize;

  if (!asset_code) {
    return badRequest('资产编号不能为空');
  }

  const tenantId = getTenantId(req);
  let whereClause = 'WHERE asset_code = ? AND tenant_id = ?';
  const params = [asset_code, tenantId];

  if (start_date) {
    whereClause += ' AND created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND created_at <= ?';
    params.push(end_date);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM usage_triggered_maintenance ${whereClause}`,
    params,
  );
  const { total } = countResult[0];

  const [rows] = await db.execute(
    `SELECT * FROM usage_triggered_maintenance
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize, 10), offset],
  );

  return {
    success: true,
    data: rows,
    pagination: {
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

async function getUsageStatistics(query, req) {
  const { asset_code, start_date, end_date } = query;

  if (!asset_code) {
    return badRequest('资产编号不能为空');
  }

  const tenantId = getTenantId(req);
  let whereClause = 'WHERE asset_code = ? AND tenant_id = ?';
  const params = [asset_code, tenantId];

  if (start_date) {
    whereClause += ' AND created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND created_at <= ?';
    params.push(end_date);
  }

  const [statsResult] = await db.execute(
    `SELECT
       SUM(current_usage) as total_usage,
       AVG(current_usage) as avg_usage,
       MAX(current_usage) as max_usage,
       MIN(current_usage) as min_usage,
       COUNT(*) as usage_count
     FROM usage_triggered_maintenance
     ${whereClause}`,
    params,
  );

  const [trendResult] = await db.execute(
    `SELECT
       DATE(created_at) as usage_date,
       SUM(current_usage) as daily_usage
     FROM usage_triggered_maintenance
     ${whereClause}
     GROUP BY DATE(created_at)
     ORDER BY usage_date ASC`,
    params,
  );

  return {
    success: true,
    data: {
      statistics: statsResult[0],
      trend: trendResult,
    },
  };
}

async function checkUsageThresholds(req) {
  const tenantId = getTenantId(req);

  const [result] = await db.execute(
    `SELECT
       pmp.id, pmp.plan_name, pmp.asset_code, pmp.asset_name,
       pmp.current_usage, pmp.usage_threshold, pmp.usage_type
     FROM preventive_maintenance_plans pmp
     WHERE pmp.tenant_id = ? AND pmp.trigger_type = 'usage'
     AND pmp.current_usage >= pmp.usage_threshold AND pmp.status = '启用'`,
    [tenantId],
  );

  return {
    success: true,
    data: result,
    count: result.length,
  };
}

async function getUsageRecordsLegacy(query, req) {
  const { page = 1, pageSize = 20, asset_code, usage_type, start_date, end_date } = query;
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  const params = [];

  const tenantFilter = addTenantFilter(req, 'aur');
  whereClause += tenantFilter.whereClause;
  params.push(...tenantFilter.params);

  if (asset_code) {
    whereClause += ' AND aur.asset_code LIKE ?';
    params.push(`%${asset_code}%`);
  }
  if (usage_type) {
    whereClause += ' AND aur.usage_type = ?';
    params.push(usage_type);
  }
  if (start_date) {
    whereClause += ' AND aur.usage_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND aur.usage_date <= ?';
    params.push(end_date);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM asset_usage_records aur ${whereClause}`,
    params,
  );
  const { total } = countResult[0];

  const [rows] = await db.execute(
    `SELECT aur.* FROM asset_usage_records aur
     ${whereClause}
     ORDER BY aur.usage_date DESC, aur.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize, 10), offset],
  );

  return {
    success: true,
    data: rows,
    pagination: {
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

async function createUsageRecordLegacy(body, req) {
  const { asset_code, usage_date, usage_value, usage_type, cumulative_value, operator, remark } = body;

  if (!asset_code || !usage_date || !usage_value || !usage_type || cumulative_value === undefined) {
    return badRequest('资产编号、使用日期、使用值、使用类型和累计值不能为空');
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
  const tenantId = getTenantId(req);

  const [result] = await db.execute(
    `INSERT INTO asset_usage_records (
      tenant_id, asset_code, asset_name, usage_date, usage_value, usage_type,
      cumulative_value, operator, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      asset.asset_code,
      asset.asset_name,
      usage_date,
      usage_value,
      usage_type,
      cumulative_value,
      operator || null,
      remark || null,
    ],
  );

  await db.execute(
    `UPDATE preventive_maintenance_plans
     SET current_usage = ?
     WHERE asset_code = ? AND tenant_id = ? AND trigger_type = 'usage' AND status = '启用'`,
    [cumulative_value, asset.asset_code, tenantId],
  );

  return {
    success: true,
    message: '资产使用量记录创建成功',
    data: { id: result.insertId },
  };
}

async function getUsageTriggeredLegacy(query, req) {
  const { page = 1, pageSize = 20, asset_code, status } = query;
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  const params = [];

  const tenantFilter = addTenantFilter(req, 'utm');
  whereClause += tenantFilter.whereClause;
  params.push(...tenantFilter.params);

  if (asset_code) {
    whereClause += ' AND utm.asset_code LIKE ?';
    params.push(`%${asset_code}%`);
  }
  if (status) {
    whereClause += ' AND utm.status = ?';
    params.push(status);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM usage_triggered_maintenance utm ${whereClause}`,
    params,
  );
  const { total } = countResult[0];

  const [rows] = await db.execute(
    `SELECT utm.* FROM usage_triggered_maintenance utm
     ${whereClause}
     ORDER BY utm.trigger_date DESC, utm.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize, 10), offset],
  );

  return {
    success: true,
    data: rows,
    pagination: {
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

async function processUsageTriggeredLegacy(id, body, req) {
  const { work_order_id } = body;

  const tenantFilter = addTenantFilter(req, 'utm');
  const [existing] = await db.execute(
    `SELECT id, asset_code, asset_name, plan_id FROM usage_triggered_maintenance utm WHERE utm.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (existing.length === 0) {
    return notFound('使用量触发记录不存在');
  }

  await db.execute(
    `UPDATE usage_triggered_maintenance
     SET status = 'processed', work_order_id = ?, updated_at = NOW()
     WHERE id = ? ${tenantFilter.whereClause}`,
    [work_order_id || null, id, ...tenantFilter.params],
  );

  if (work_order_id) {
    const tenantId = getTenantId(req);
    await db.execute(
      `UPDATE work_orders
       SET source_type = 'usage_triggered'
       WHERE id = ? AND tenant_id = ?`,
      [work_order_id, tenantId],
    );
  }

  return {
    success: true,
    message: '使用量触发记录处理成功',
  };
}

async function checkUsageTriggeredLegacy(req) {
  const tenantId = getTenantId(req);

  const [plans] = await db.execute(
    `SELECT
      id, asset_code, asset_name, current_usage, usage_threshold, usage_type, plan_name
    FROM preventive_maintenance_plans
    WHERE tenant_id = ?
    AND status = '启用'
    AND trigger_type = 'usage'
    AND usage_threshold IS NOT NULL
    AND current_usage >= usage_threshold`,
    [tenantId],
  );

  const triggeredPlans = [];

  for (const plan of plans) {
    const [existing] = await db.execute(
      `SELECT id FROM usage_triggered_maintenance
      WHERE tenant_id = ? AND plan_id = ? AND status = 'pending'`,
      [tenantId, plan.id],
    );

    if (existing.length === 0) {
      const [result] = await db.execute(
        `INSERT INTO usage_triggered_maintenance (
          tenant_id, asset_code, asset_name, plan_id,
          trigger_date, current_usage, threshold_usage,
          usage_type, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          plan.asset_code,
          plan.asset_name,
          plan.id,
          new Date().toISOString().split('T')[0],
          plan.current_usage,
          plan.usage_threshold,
          plan.usage_type,
          'pending',
        ],
      );

      triggeredPlans.push({
        ...plan,
        trigger_id: result.insertId,
      });
    }
  }

  return {
    success: true,
    message: '使用量触发检查完成',
    data: {
      checked_plans: plans.length,
      triggered_plans: triggeredPlans.length,
      triggered_details: triggeredPlans,
    },
  };
}

async function getAssetUsage(query, req) {
  const { page = 1, pageSize = 20, asset_code, keyword } = query;
  const offset = (page - 1) * pageSize;
  const tenantId = getTenantId(req);

  let whereClause = 'WHERE pmp.tenant_id = ? AND pmp.trigger_type IN ("usage", "both")';
  const params = [tenantId];

  if (asset_code) {
    whereClause += ' AND pmp.asset_code = ?';
    params.push(asset_code);
  }

  if (keyword) {
    whereClause += ' AND (a.asset_code LIKE ? OR a.asset_name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total
     FROM preventive_maintenance_plans pmp
     LEFT JOIN assets a ON pmp.asset_code = a.asset_code AND a.tenant_id = pmp.tenant_id AND a.is_deleted = 0
     ${whereClause}`,
    params,
  );

  const [rows] = await db.execute(
    `SELECT
       pmp.id as plan_id,
       pmp.plan_name,
       pmp.asset_code,
       a.asset_name,
       a.model,
       pmp.usage_threshold,
       pmp.current_usage,
       NULL as last_usage_date,
       pmp.trigger_type,
       pmp.status as plan_status
     FROM preventive_maintenance_plans pmp
     LEFT JOIN assets a ON pmp.asset_code = a.asset_code AND a.tenant_id = pmp.tenant_id AND a.is_deleted = 0
     ${whereClause}
     ORDER BY (pmp.current_usage / pmp.usage_threshold) DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize, 10), offset],
  );

  const data = rows.map(row => ({
    ...row,
    usage_rate:
      row.usage_threshold > 0 ? ((row.current_usage / row.usage_threshold) * 100).toFixed(1) : 0,
  }));

  return {
    success: true,
    data,
    pagination: {
      current: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      total: countResult[0].total,
    },
  };
}

async function getUsageRecords(query, req) {
  const { page = 1, pageSize = 20, asset_code, start_date, end_date } = query;
  const offset = (page - 1) * pageSize;
  const tenantId = getTenantId(req);

  if (!(await tableExists('maintenance_usage_records'))) {
    return {
      success: true,
      data: [],
      pagination: {
        current: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        total: 0,
      },
    };
  }

  let whereClause = 'WHERE mur.tenant_id = ?';
  const params = [tenantId];

  if (asset_code) {
    whereClause += ' AND mur.asset_code = ?';
    params.push(asset_code);
  }

  if (start_date) {
    whereClause += ' AND DATE(mur.usage_date) >= ?';
    params.push(start_date);
  }

  if (end_date) {
    whereClause += ' AND DATE(mur.usage_date) <= ?';
    params.push(end_date);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM maintenance_usage_records mur ${whereClause}`,
    params,
  );

  const [rows] = await db.execute(
    `SELECT mur.*, a.asset_name
     FROM maintenance_usage_records mur
     LEFT JOIN assets a ON mur.asset_code = a.asset_code AND a.tenant_id = mur.tenant_id AND a.is_deleted = 0
     ${whereClause}
     ORDER BY mur.usage_date DESC, mur.id DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize, 10), offset],
  );

  return {
    success: true,
    data: rows,
    pagination: {
      current: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      total: countResult[0].total,
    },
  };
}

async function createUsageRecord(body, req) {
  const { asset_code, usage_value, usage_date, usage_type, remark } = body;

  if (!asset_code || usage_value === undefined) {
    return badRequest('资产编号和使用量不能为空');
  }

  const tenantId = getTenantId(req);
  const recordedBy = req.user.real_name || req.user.username || '系统管理员';

  const [assets] = await db.execute(
    'SELECT asset_code, asset_name FROM assets WHERE asset_code = ? AND tenant_id = ?',
    [asset_code, tenantId],
  );

  if (assets.length === 0) {
    return notFound('资产不存在');
  }

  const [result] = await db.execute(
    `INSERT INTO maintenance_usage_records
     (tenant_id, asset_code, usage_value, usage_date, usage_type, recorded_by, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      asset_code,
      usage_value,
      usage_date || new Date(),
      usage_type || 'manual',
      recordedBy,
      remark || null,
    ],
  );

  await db.execute(
    `UPDATE preventive_maintenance_plans pmp
     SET pmp.current_usage = ?,
         pmp.last_usage_date = NOW(),
         pmp.updated_at = NOW()
     WHERE pmp.asset_code = ? AND pmp.tenant_id = ? AND pmp.trigger_type = 'usage'`,
    [usage_value, asset_code, tenantId],
  );

  const [plans] = await db.execute(
    `SELECT id, plan_name, usage_threshold FROM preventive_maintenance_plans
     WHERE asset_code = ? AND tenant_id = ? AND trigger_type = 'usage'
     AND status = '启用'
     AND current_usage >= usage_threshold`,
    [asset_code, tenantId],
  );

  const triggeredPlans = [];
  for (const plan of plans) {
    const [existing] = await db.execute(
      'SELECT id FROM maintenance_usage_triggered WHERE plan_id = ? AND asset_code = ? AND tenant_id = ? AND status = "triggered"',
      [plan.id, asset_code, tenantId],
    );

    if (existing.length === 0) {
      await db.execute(
        `INSERT INTO maintenance_usage_triggered
         (tenant_id, plan_id, asset_code, current_usage, usage_threshold, trigger_type, status, triggered_at)
         VALUES (?, ?, ?, ?, ?, "usage", "triggered", NOW())`,
        [tenantId, plan.id, asset_code, usage_value, plan.usage_threshold],
      );
      triggeredPlans.push(plan.plan_name);
    }
  }

  return {
    success: true,
    message: '使用量记录成功',
    data: { id: result.insertId },
    triggered: triggeredPlans,
  };
}

async function getTriggeredRecords(query, req) {
  const { page = 1, pageSize = 20, asset_code, status, start_date, end_date } = query;
  const offset = (page - 1) * pageSize;
  const tenantId = getTenantId(req);

  if (!(await tableExists('maintenance_usage_triggered'))) {
    return {
      success: true,
      data: [],
      pagination: {
        current: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        total: 0,
      },
    };
  }

  let whereClause = 'WHERE mut.tenant_id = ?';
  const params = [tenantId];

  if (asset_code) {
    whereClause += ' AND mut.asset_code = ?';
    params.push(asset_code);
  }

  if (status) {
    whereClause += ' AND mut.status = ?';
    params.push(status);
  }

  if (start_date) {
    whereClause += ' AND DATE(mut.triggered_at) >= ?';
    params.push(start_date);
  }

  if (end_date) {
    whereClause += ' AND DATE(mut.triggered_at) <= ?';
    params.push(end_date);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM maintenance_usage_triggered mut ${whereClause}`,
    params,
  );

  const [rows] = await db.execute(
    `SELECT mut.*, pmp.plan_name, a.asset_name
     FROM maintenance_usage_triggered mut
     LEFT JOIN preventive_maintenance_plans pmp ON mut.plan_id = pmp.id
     LEFT JOIN assets a ON mut.asset_code = a.asset_code AND a.tenant_id = mut.tenant_id AND a.is_deleted = 0
     ${whereClause}
     ORDER BY mut.triggered_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize, 10), offset],
  );

  return {
    success: true,
    data: rows,
    pagination: {
      current: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      total: countResult[0].total,
    },
  };
}

// 忽略使用量触发记录（更新 maintenance_usage_triggered 表的 status 为 ignored）
async function ignoreTriggeredRecord(id, body, req) {
  const { remark } = body || {};
  const tenantId = getTenantId(req);

  if (!(await tableExists('maintenance_usage_triggered'))) {
    return notFound('使用量触发记录不存在');
  }

  const [existing] = await db.execute(
    `SELECT id, status, plan_id, asset_code FROM maintenance_usage_triggered
     WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
  );

  if (existing.length === 0) {
    return notFound('使用量触发记录不存在');
  }

  const record = existing[0];

  if (record.status === 'processed') {
    return badRequest('已处理的记录不能忽略');
  }

  if (record.status === 'ignored') {
    return {
      statusCode: 200,
      body: { success: true, message: '该记录已被忽略，无需重复操作' },
    };
  }

  // 动态检测可用列，避免因表结构差异导致更新失败
  let setClause = "status = 'ignored', processed_at = NOW()";
  const params = [];

  try {
    const [cols] = await db.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_usage_triggered'`,
    );
    const colNames = cols.map(c => c.COLUMN_NAME);

    if (colNames.includes('updated_at')) {
      setClause += ', updated_at = NOW()';
    }
    if (colNames.includes('remark') && remark) {
      setClause += ', remark = ?';
      params.push(remark);
    }
  } catch (e) {
    // 检测失败时使用基础字段
  }

  params.push(id, tenantId);

  await db.execute(
    `UPDATE maintenance_usage_triggered
     SET ${setClause}
     WHERE id = ? AND tenant_id = ?`,
    params,
  );

  return {
    statusCode: 200,
    body: { success: true, message: '已忽略该触发记录' },
  };
}

module.exports = {
  updateUsage,
  getUsageHistory,
  getUsageStatistics,
  checkUsageThresholds,
  getUsageRecordsLegacy,
  createUsageRecordLegacy,
  getUsageTriggeredLegacy,
  processUsageTriggeredLegacy,
  checkUsageTriggeredLegacy,
  getAssetUsage,
  getUsageRecords,
  createUsageRecord,
  getTriggeredRecords,
  ignoreTriggeredRecord,
};
