const db = require('../../config/database');
const { addTenantFilter, getTenantId } = require('../../middleware/tenant-filter');

function badRequest(message) {
  return { statusCode: 400, body: { success: false, message } };
}

function notFound(message) {
  return { statusCode: 404, body: { success: false, message } };
}

async function getEvaluations(query, req) {
  const {
    page = 1,
    pageSize = 20,
    asset_code,
    maintenance_type,
    start_date,
    end_date,
  } = query;
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  const params = [];

  const tenantFilter = addTenantFilter(req, 'me');
  whereClause += tenantFilter.whereClause;
  params.push(...tenantFilter.params);

  if (asset_code) {
    whereClause += ' AND me.asset_code LIKE ?';
    params.push(`%${asset_code}%`);
  }
  if (maintenance_type) {
    whereClause += ' AND me.maintenance_type = ?';
    params.push(maintenance_type);
  }
  if (start_date) {
    whereClause += ' AND me.maintenance_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND me.maintenance_date <= ?';
    params.push(end_date);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM maintenance_evaluations me ${whereClause}`,
    params,
  );
  const { total } = countResult[0];

  const [rows] = await db.execute(
    `SELECT me.*, m.maintenance_person, m.maintenance_content
     FROM maintenance_evaluations me
     LEFT JOIN maintenance_logs m ON me.maintenance_log_id = m.id AND m.tenant_id = me.tenant_id
     ${whereClause}
     ORDER BY me.evaluation_date DESC, me.created_at DESC
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

async function createEvaluation(body, req) {
  const {
    maintenance_log_id,
    asset_code,
    asset_name,
    maintenance_date,
    maintenance_type,
    effectiveness_score,
    problem_resolved,
    downtime_hours,
    production_impact,
    technician_skill_score,
    response_time_score,
    quality_score,
    overall_score,
    evaluator,
    evaluation_remark,
  } = body;

  if (!maintenance_log_id || !asset_code || !maintenance_date || !maintenance_type) {
    return badRequest('必填字段不能为空');
  }

  const logTenantFilter = addTenantFilter(req, 'ml');
  const [logs] = await db.execute(
    `SELECT ml.id, ml.asset_code, ml.asset_name, ml.maintenance_date, ml.maintenance_type
     FROM maintenance_logs ml WHERE ml.id = ? ${logTenantFilter.whereClause}`,
    [maintenance_log_id, ...logTenantFilter.params],
  );
  if (logs.length === 0) {
    return notFound('维护日志不存在');
  }

  // BUG-E1 修复：检查该日志是否已被评价过，防止重复评价
  const log = logs[0];
  const evalTenantFilter = addTenantFilter(req, 'me');
  const [existingEval] = await db.execute(
    `SELECT id FROM maintenance_evaluations me WHERE me.maintenance_log_id = ? ${evalTenantFilter.whereClause}`,
    [maintenance_log_id, ...evalTenantFilter.params],
  );
  if (existingEval.length > 0) {
    return {
      statusCode: 409,
      body: { success: false, message: '该维护日志已被评价过，不能重复评价' },
    };
  }

  const tenantId = getTenantId(req);
  const evaluationDate = new Date();

  const [result] = await db.execute(
    `INSERT INTO maintenance_evaluations (
      tenant_id, maintenance_log_id, asset_code, asset_name, maintenance_date, maintenance_type,
      effectiveness_score, problem_resolved, downtime_hours, production_impact,
      technician_skill_score, response_time_score, quality_score, overall_score,
      evaluation_date, evaluator, evaluation_remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      maintenance_log_id,
      asset_code,
      asset_name || null,
      maintenance_date,
      maintenance_type,
      effectiveness_score || null,
      problem_resolved !== undefined ? problem_resolved : true,
      downtime_hours || 0,
      production_impact || null,
      technician_skill_score || null,
      response_time_score || null,
      quality_score || null,
      overall_score || null,
      evaluationDate,
      evaluator || req.user.real_name || req.user.username,
      evaluation_remark || null,
    ],
  );

  return {
    success: true,
    message: '维护效果评估创建成功',
    data: { id: result.insertId },
  };
}

async function updateEvaluation(id, body, req) {
  const {
    asset_name,
    effectiveness_score,
    problem_resolved,
    downtime_hours,
    production_impact,
    technician_skill_score,
    response_time_score,
    quality_score,
    overall_score,
    evaluator,
    evaluation_remark,
  } = body;

  const tenantFilter = addTenantFilter(req, 'me');
  const [existing] = await db.execute(
    `SELECT id FROM maintenance_evaluations me WHERE me.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (existing.length === 0) {
    return notFound('维护效果评估记录不存在');
  }

  const updateFields = [];
  const updateValues = [];

  if (asset_name !== undefined) {
    updateFields.push('asset_name = ?');
    updateValues.push(asset_name);
  }
  if (effectiveness_score !== undefined) {
    updateFields.push('effectiveness_score = ?');
    updateValues.push(effectiveness_score);
  }
  if (problem_resolved !== undefined) {
    updateFields.push('problem_resolved = ?');
    updateValues.push(problem_resolved);
  }
  if (downtime_hours !== undefined) {
    updateFields.push('downtime_hours = ?');
    updateValues.push(downtime_hours);
  }
  if (production_impact !== undefined) {
    updateFields.push('production_impact = ?');
    updateValues.push(production_impact);
  }
  if (technician_skill_score !== undefined) {
    updateFields.push('technician_skill_score = ?');
    updateValues.push(technician_skill_score);
  }
  if (response_time_score !== undefined) {
    updateFields.push('response_time_score = ?');
    updateValues.push(response_time_score);
  }
  if (quality_score !== undefined) {
    updateFields.push('quality_score = ?');
    updateValues.push(quality_score);
  }
  if (overall_score !== undefined) {
    updateFields.push('overall_score = ?');
    updateValues.push(overall_score);
  }
  if (evaluator !== undefined) {
    updateFields.push('evaluator = ?');
    updateValues.push(evaluator);
  }
  if (evaluation_remark !== undefined) {
    updateFields.push('evaluation_remark = ?');
    updateValues.push(evaluation_remark);
  }

  if (updateFields.length === 0) {
    return badRequest('没有要更新的字段');
  }

  updateFields.push('updated_at = NOW()');
  updateValues.push(id);

  await db.execute(
    `UPDATE maintenance_evaluations me SET ${updateFields.join(', ')} WHERE me.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
    [...updateValues, ...tenantFilter.params],
  );

  return { success: true, message: '维护效果评估更新成功' };
}

module.exports = {
  getEvaluations,
  createEvaluation,
  updateEvaluation,
};
