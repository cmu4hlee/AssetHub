const db = require('../../config/database');
const { addTenantFilter, getTenantId } = require('../../middleware/tenant-filter');
const { publishAsync } = require('../../core/EventBus');
const logger = require('../../config/logger');
const assetStatusService = require('../asset-status.service');

const ENGINEER_ROLES = ['maintenance_admin', 'maintenance_engineer'];

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const workOrderCounter = new Map();

function generateWorkOrderNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateKey = `${year}${month}${day}`;

  const count = (workOrderCounter.get(dateKey) || 0) + 1;
  workOrderCounter.set(dateKey, count);

  const sequence = count.toString().padStart(4, '0');
  const timestamp = Date.now().toString().slice(-6);

  return `WO${dateKey}${sequence}${timestamp}`;
}

function validateWorkOrderInput(data) {
  const errors = [];

  if (data.asset_code !== undefined) {
    if (typeof data.asset_code !== 'string' || data.asset_code.length > 50) {
      errors.push('资产编号格式不正确');
    }
  }

  if (data.title !== undefined) {
    if (typeof data.title !== 'string' || data.title.length === 0) {
      errors.push('工单标题不能为空');
    } else if (data.title.length > 200) {
      errors.push('工单标题不能超过200个字符');
    }
  }

  if (data.description !== undefined && data.description.length > 1000) {
    errors.push('工单描述不能超过1000个字符');
  }

  if (data.priority !== undefined) {
    const validPriorities = ['urgent', 'high', 'normal', 'low'];
    if (!validPriorities.includes(data.priority)) {
      errors.push(`工单优先级必须是[${validPriorities.join(', ')}]之一`);
    }
  }

  if (data.estimated_hours !== undefined) {
    const hours = parseFloat(data.estimated_hours);
    if (isNaN(hours) || hours < 0 || hours > 9999) {
      errors.push('预计工时必须在0-9999之间');
    }
  }

  if (data.source_type !== undefined) {
    // 与 work_orders 表 enum('fault','preventive','inspection','other') 保持一致
    const validSourceTypes = ['fault', 'preventive', 'inspection', 'other'];
    if (!validSourceTypes.includes(data.source_type)) {
      errors.push(`工单来源必须是[${validSourceTypes.join(', ')}]之一`);
    }
  }

  if (data.labor_cost !== undefined) {
    const cost = parseFloat(data.labor_cost);
    if (isNaN(cost) || cost < 0 || cost > 999999.99) {
      errors.push('人工费用必须在0-999999.99之间');
    }
  }

  if (data.outsourcing_cost !== undefined) {
    const cost = parseFloat(data.outsourcing_cost);
    if (isNaN(cost) || cost < 0 || cost > 999999.99) {
      errors.push('外包费用必须在0-999999.99之间');
    }
  }

  return errors;
}

function buildWorkOrderWhereClause(query, req, alias = 'wo') {
  const {
    asset_code,
    status,
    priority,
    source_type,
    source_types, // 旧 source_type IN 过滤，保留以防回退
    from_plan,    // 1 → 预防性维护工单 (maintenance_plan_id IS NOT NULL)
    from_request, // 1 → 维修工单 (maintenance_request_id IS NOT NULL)
    include_orphan, // 1 → 包含 plan_id 和 req_id 都为 NULL 的孤儿工单（兜底）
    assigned_to,
    start_date,
    end_date,
    keyword,
    has_signature,
  } = query;

  let whereClause = 'WHERE 1=1';
  const params = [];

  const tenantFilter = addTenantFilter(req, alias);
  whereClause += tenantFilter.whereClause;
  params.push(...tenantFilter.params);

  if (asset_code) {
    whereClause += ` AND ${alias}.asset_code LIKE ?`;
    params.push(`%${asset_code}%`);
  }
  if (status) {
    whereClause += ` AND ${alias}.status = ?`;
    params.push(status);
  }
  // "已签字" 过滤器: 工程师或申请人任一有签名的工单
  if (has_signature === '1' || has_signature === 'true') {
    whereClause += ` AND (${alias}.engineer_signature IS NOT NULL OR ${alias}.applicant_signature IS NOT NULL)`;
  }
  if (priority) {
    whereClause += ` AND ${alias}.priority = ?`;
    params.push(priority);
  }
  if (source_type) {
    whereClause += ` AND ${alias}.source_type = ?`;
    params.push(source_type);
  }
  // 工单管理 Tab 拆分：
  //   from_plan=1        → 预防性维护工单（maintenance_plan_id IS NOT NULL）
  //   from_request=1     → 维修工单（maintenance_request_id IS NOT NULL）
  //   include_orphan=1   → 加上 plan_id 和 req_id 都为 NULL 的孤儿工单（兜底）
  // 注意：from_plan 和 from_request 互斥；同时传以 from_request 为准
  if (from_plan === '1' || from_plan === 'true') {
    whereClause += ` AND ${alias}.maintenance_plan_id IS NOT NULL`;
  } else if (from_request === '1' || from_request === 'true') {
    whereClause += ` AND (${alias}.maintenance_request_id IS NOT NULL`;
    if (include_orphan === '1' || include_orphan === 'true') {
      whereClause += ` OR (${alias}.maintenance_plan_id IS NULL AND ${alias}.maintenance_request_id IS NULL)`;
    }
    whereClause += `)`;
  } else if (source_types) {
    // 回退：旧 source_type IN 过滤（如前端没升级）
    const list = String(source_types)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (list.length > 0) {
      whereClause += ` AND ${alias}.source_type IN (${list.map(() => '?').join(',')})`;
      params.push(...list);
    }
  }
  if (assigned_to) {
    whereClause += ` AND ${alias}.assigned_to LIKE ?`;
    params.push(`%${assigned_to}%`);
  }
  if (start_date) {
    whereClause += ` AND DATE(${alias}.created_at) >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ` AND DATE(${alias}.created_at) <= ?`;
    params.push(end_date);
  }
  if (keyword) {
    whereClause += ` AND (${alias}.work_order_no LIKE ? OR ${alias}.title LIKE ? OR ${alias}.asset_name LIKE ?)`;
    const keywordParam = `%${keyword}%`;
    params.push(keywordParam, keywordParam, keywordParam);
  }

  return { whereClause, params };
}

async function getWorkOrders(query, req) {
  const pageNumber = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.pageSize, 10) || 20, 1), 200);
  const offset = (pageNumber - 1) * limit;

  const userRole = req.user?.role;
  const userName = req.user?.real_name || req.user?.username;

  const { whereClause, params } = buildWorkOrderWhereClause(query, req, 'wo');

  let roleBasedFilter = '';
  const roleBasedParams = [];

  if (userRole === 'maintenance_engineer' && userName) {
    roleBasedFilter = ' AND wo.assigned_to = ?';
    roleBasedParams.push(userName);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM work_orders wo ${whereClause} ${roleBasedFilter}`,
    [...params, ...roleBasedParams],
  );
  const {total} = countResult[0];

  const [rows] = await db.execute(
    `SELECT wo.* FROM work_orders wo
     ${whereClause} ${roleBasedFilter}
     ORDER BY wo.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, ...roleBasedParams, limit, offset],
  );

  return {
    success: true,
    data: rows,
    pagination: {
      page: pageNumber,
      pageSize: limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getDispatchPanel(query, req) {
  const {
    engineer_limit = 8,
    room_limit = 8,
    sort_by = 'in_progress',
  } = query;
  const engineerLimit = Math.max(parseInt(engineer_limit, 10) || 8, 1);
  const roomLimit = Math.max(parseInt(room_limit, 10) || 8, 1);
  const { whereClause, params } = buildWorkOrderWhereClause(query, req, 'wo');
  const dispatchSortBy = ['in_progress', 'total'].includes(sort_by)
    ? sort_by
    : 'in_progress';
  const orderMetric =
    dispatchSortBy === 'total'
      ? 'total_count'
      : 'in_progress_count';

  const [overviewRows] = await db.execute(
    `SELECT
      COUNT(*) AS total_count,
      SUM(CASE WHEN wo.status = 'pending_review' THEN 1 ELSE 0 END) AS pending_review_count,
      SUM(CASE WHEN wo.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
      SUM(CASE WHEN wo.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
      MAX(wo.updated_at) AS last_updated_at
    FROM work_orders wo
    ${whereClause}`,
    params,
  );

  const [rawTechnicianRows] = await db.execute(
    `SELECT
      COALESCE(NULLIF(TRIM(wo.assigned_to), ''), '未分配') AS engineer_name,
      COUNT(*) AS total_count,
      SUM(CASE WHEN wo.status = 'pending_review' THEN 1 ELSE 0 END) AS pending_review_count,
      SUM(CASE WHEN wo.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
      SUM(CASE WHEN wo.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
      MAX(wo.updated_at) AS last_updated_at
    FROM work_orders wo
    ${whereClause}
    GROUP BY engineer_name
    ORDER BY ${orderMetric} DESC, in_progress_count DESC, total_count DESC, engineer_name ASC`,
    params,
  );

  // 取本租户下「真实工程师」姓名集合（username 与 real_name 都计入，因 assigned_to 可能存任一种）
  let engineerNameSet = new Set();
  try {
    const tenantFilter = addTenantFilter(req, 'utr');
    const tenantId = tenantFilter.params[0];
    if (tenantId) {
      const [engRows] = await db.execute(
        `SELECT DISTINCT u.username, u.real_name
         FROM users u
         INNER JOIN user_tenant_roles utr ON u.id = utr.user_id AND utr.tenant_id = ?
         WHERE utr.role IN (?, ?) AND utr.status = 'active'`,
        [tenantId, 'maintenance_admin', 'maintenance_engineer'],
      );
      for (const e of engRows) {
        if (e.username) engineerNameSet.add(String(e.username).trim());
        if (e.real_name) engineerNameSet.add(String(e.real_name).trim());
      }
    }
  } catch (_e) {
    engineerNameSet = new Set();
  }

  // 归类：工程师 / 其他人员（已分配但非工程师角色）/ 未分配
  const engineerGroups = [];
  let otherTotal = 0, otherPendingReview = 0, otherInProgress = 0, otherCompleted = 0;
  let otherLastUpdated = null;
  let unassigned = null;
  const num = (v) => parseInt(v, 10) || 0;
  for (const row of (rawTechnicianRows || [])) {
    const name = (row.engineer_name || '').trim();
    if (name === '未分配') {
      unassigned = row;
      continue;
    }
    if (engineerNameSet.has(name)) {
      engineerGroups.push(row);
    } else {
      otherTotal += num(row.total_count);
      otherPendingReview += num(row.pending_review_count);
      otherInProgress += num(row.in_progress_count);
      otherCompleted += num(row.completed_count);
      if (row.last_updated_at && (!otherLastUpdated || row.last_updated_at > otherLastUpdated)) {
        otherLastUpdated = row.last_updated_at;
      }
    }
  }

  // 工程师按负荷排序并限制数量（避免 UI 溢出），其余聚合为「其他人员」
  engineerGroups.sort((a, b) => (
    num(b[orderMetric]) - num(a[orderMetric])
    || num(b.in_progress_count) - num(a.in_progress_count)
    || num(b.total_count) - num(a.total_count)
    || String(a.engineer_name).localeCompare(String(b.engineer_name))
  ));
  const limitedEngineerGroups = engineerGroups.slice(0, engineerLimit);

  const technicians = [...limitedEngineerGroups];
  if (otherTotal > 0) {
    technicians.push({
      engineer_name: '其他人员',
      total_count: otherTotal,
      pending_review_count: otherPendingReview,
      in_progress_count: otherInProgress,
      completed_count: otherCompleted,
      last_updated_at: otherLastUpdated,
    });
  }
  if (unassigned) {
    technicians.push(unassigned);
  }

  let roomRows = [];
  try {
    [roomRows] = await db.execute(
      `SELECT
        COALESCE(NULLIF(TRIM(a.location), ''), '未配置位置') AS room_name,
        COUNT(*) AS total_count,
        SUM(CASE WHEN wo.status = 'pending_review' THEN 1 ELSE 0 END) AS pending_review_count,
        SUM(CASE WHEN wo.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
        SUM(CASE WHEN wo.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
        MAX(wo.updated_at) AS last_updated_at
      FROM work_orders wo
      LEFT JOIN assets a
        ON a.asset_code = wo.asset_code COLLATE utf8mb4_unicode_ci
        AND a.tenant_id = wo.tenant_id
        AND a.is_deleted = 0
      ${whereClause}
      GROUP BY room_name
      ORDER BY ${orderMetric} DESC, in_progress_count DESC, total_count DESC, room_name ASC
      LIMIT ?`,
      [...params, roomLimit],
    );
  } catch (_error) {
    const [fallbackRoomRows] = await db.execute(
      `SELECT
        '未配置位置' AS room_name,
        COUNT(*) AS total_count,
        SUM(CASE WHEN wo.status = 'pending_review' THEN 1 ELSE 0 END) AS pending_review_count,
        SUM(CASE WHEN wo.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
        SUM(CASE WHEN wo.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
        MAX(wo.updated_at) AS last_updated_at
      FROM work_orders wo
      ${whereClause}`,
      params,
    );
    roomRows = fallbackRoomRows;
  }

  return {
    success: true,
    data: {
      generated_at: new Date().toISOString(),
      overview: overviewRows?.[0] || {
        total_count: 0,
        pending_review_count: 0,
        in_progress_count: 0,
        completed_count: 0,
        last_updated_at: null,
      },
      technicians: technicians,
      rooms: roomRows || [],
    },
  };
}

async function getWorkOrder(id, req) {
  const tenantFilter = addTenantFilter(req, 'wo');
  const userRole = req.user?.role;
  const userName = req.user?.real_name || req.user?.username;

  let roleBasedFilter = '';
  const roleBasedParams = [];

  if (userRole === 'maintenance_engineer' && userName) {
    roleBasedFilter = ' AND wo.assigned_to = ?';
    roleBasedParams.push(userName);
  }

  const [rows] = await db.execute(
    `SELECT wo.* FROM work_orders wo
     WHERE wo.id = ? ${tenantFilter.whereClause} ${roleBasedFilter}`,
    [id, ...tenantFilter.params, ...roleBasedParams],
  );

  if (rows.length === 0) {
    throw createHttpError(404, '工单不存在');
  }

  const workorder = rows[0];

  const [materials] = await db.execute('SELECT * FROM work_order_materials WHERE work_order_id = ?', [id]);
  workorder.materials = materials;

  const [history] = await db.execute(
    'SELECT * FROM work_order_history WHERE work_order_id = ? ORDER BY action_at DESC',
    [id],
  );
  workorder.history = history;

  return { success: true, data: workorder };
}

async function createWorkOrder(body, req) {
  const errors = validateWorkOrderInput(body);
  if (errors.length > 0) {
    throw createHttpError(400, errors.join('; '));
  }

  const {
    asset_code,
    maintenance_plan_id,
    maintenance_request_id,
    source_type,
    title,
    description,
    priority,
    estimated_hours,
    assigned_to,
  } = body;

  if (!asset_code || !source_type || !title) {
    throw createHttpError(400, '资产编号、来源类型和标题不能为空');
  }

  const assetTenantFilter = addTenantFilter(req, 'a');
  const [assets] = await db.execute(
    `SELECT a.asset_code, a.asset_name FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
    [asset_code, ...assetTenantFilter.params],
  );

  if (assets.length === 0) {
    throw createHttpError(404, '资产不存在');
  }

  const asset = assets[0];
  const createdBy = body.created_by || req.user?.real_name || req.user?.username || '系统管理员';
  const tenantId = getTenantId(req);

  const workOrderNo = `WO${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;

  const [result] = await db.execute(
    `INSERT INTO work_orders (
      work_order_no, tenant_id, asset_code, asset_name, maintenance_plan_id,
      maintenance_request_id,
      source_type, title, description, priority, estimated_hours, assigned_to,
      status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      workOrderNo,
      tenantId,
      asset.asset_code,
      asset.asset_name,
      maintenance_plan_id || null,
      maintenance_request_id || null,
      source_type,
      title,
      description || null,
      priority || 'normal',
      estimated_hours || null,
      assigned_to || null,
      // 默认 status='pending' (待分配); 如果传了 assigned_to, 下面 if 块会改为 'assigned' (已派工)
      'pending',
      createdBy,
    ],
  );

  const workOrderId = result.insertId;

  await db.execute(
    `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
     VALUES (?, ?, ?, ?, ?)`,
    [workOrderId, 'create', '创建工单', createdBy, new Date()],
  );

  if (assigned_to) {
    await db.execute(
      "UPDATE work_orders SET status = 'assigned', assigned_at = ? WHERE id = ? AND tenant_id = ?",
      [
        new Date(),
        workOrderId,
        tenantId,
      ],
    );

    await db.execute(
      `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
       VALUES (?, ?, ?, ?, ?)`,
      [workOrderId, 'assign', `分配给 ${assigned_to}`, createdBy, new Date()],
    );
  }

  return {
    success: true,
    message: '工单创建成功',
    data: { id: workOrderId, work_order_no: workOrderNo },
  };
}

async function updateWorkOrder(id, body, req) {
  const errors = validateWorkOrderInput(body);
  if (errors.length > 0) {
    throw createHttpError(400, errors.join('; '));
  }

  const {
    status,
    assigned_to,
    priority,
    description,
    estimated_hours,
    actual_hours,
    fault_cause,
    solution,
    acceptance_result,
    satisfaction_score,
  } = body;

  const tenantFilter = addTenantFilter(req, 'wo');
  const userRole = req.user?.role;
  const userName = req.user?.real_name || req.user?.username;

  let roleBasedFilter = '';
  const roleBasedParams = [];

  if (userRole === 'maintenance_engineer' && userName) {
    roleBasedFilter = ' AND wo.assigned_to = ?';
    roleBasedParams.push(userName);
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.execute(
      `SELECT id, status FROM work_orders wo WHERE wo.id = ? ${tenantFilter.whereClause} ${roleBasedFilter}`,
      [id, ...tenantFilter.params, ...roleBasedParams],
    );

    if (existing.length === 0) {
      await connection.rollback();
      throw createHttpError(404, '工单不存在或无权限操作');
    }

    const workorder = existing[0];
    const createdBy = req.user.real_name || req.user.username || '系统管理员';
    const updateFields = [];
    const updateValues = [];

    if (status && status !== workorder.status) {
      updateFields.push('status = ?');
      updateValues.push(status);

      switch (status) {
        case 'pending':
          updateFields.push('assigned_at = ?');
          updateValues.push(null);
          break;
        case 'assigned':
          updateFields.push('assigned_at = ?');
          updateValues.push(new Date());
          break;
        case 'in_progress':
          updateFields.push('started_at = ?');
          updateValues.push(new Date());
          break;
        case 'pending_acceptance':
          updateFields.push('completed_at = ?');
          updateValues.push(new Date());
          break;
        case 'completed':
          updateFields.push('accepted_at = ?');
          updateValues.push(new Date());
          break;
        default:
          break;
      }

      await connection.execute(
        `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, 'status_change', `状态变更为 ${status}`, createdBy, new Date()],
      );
    }

    if (assigned_to) {
      updateFields.push('assigned_to = ?');
      updateValues.push(assigned_to);
      await connection.execute(
        `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, 'assign', `分配给 ${assigned_to}`, createdBy, new Date()],
      );
    }

    if (priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(priority);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (estimated_hours !== undefined) {
      updateFields.push('estimated_hours = ?');
      updateValues.push(estimated_hours);
    }
    if (actual_hours !== undefined) {
      updateFields.push('actual_hours = ?');
      updateValues.push(actual_hours);
    }
    if (fault_cause !== undefined) {
      updateFields.push('fault_cause = ?');
      updateValues.push(fault_cause);
    }
    if (solution !== undefined) {
      updateFields.push('solution = ?');
      updateValues.push(solution);
    }
    if (acceptance_result !== undefined) {
      updateFields.push('acceptance_result = ?');
      updateValues.push(acceptance_result);
    }
    if (satisfaction_score !== undefined) {
      updateFields.push('satisfaction_score = ?');
      updateValues.push(satisfaction_score);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = ?');
      updateValues.push(new Date());
      updateValues.push(id);

      await connection.execute(
        `UPDATE work_orders SET ${updateFields.join(', ')} WHERE id = ? ${tenantFilter.whereClause.replace(/wo\./g, '')}`,
        [...updateValues, ...tenantFilter.params],
      );
    }

    await connection.commit();
    return { success: true, message: '工单更新成功' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function addWorkOrderMaterials(id, materials, req) {
  if (!Array.isArray(materials)) {
    throw createHttpError(400, '物料列表必须是数组');
  }

  const tenantFilter = addTenantFilter(req, 'wo');
  const [existing] = await db.execute(
    `SELECT id FROM work_orders wo WHERE wo.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (existing.length === 0) {
    throw createHttpError(404, '工单不存在');
  }

  for (const material of materials) {
    // 兼容 name / material_name 两种字段名
    const materialName = material.material_name || material.name;
    if (!materialName) {
      throw createHttpError(400, '物料名称不能为空');
    }
    if (material.quantity === undefined || material.quantity === null) {
      throw createHttpError(400, '物料数量不能为空');
    }
    const unit = material.unit || '个';
    const quantity = parseFloat(material.quantity);
    const unitPrice = parseFloat(material.unit_price || 0);
    const totalCost = material.total_cost !== undefined
      ? parseFloat(material.total_cost)
      : quantity * unitPrice;

    await db.execute(
      `INSERT INTO work_order_materials (work_order_id, material_name, specification, quantity, unit, unit_price, total_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        materialName,
        material.specification || null,
        quantity,
        unit,
        unitPrice || null,
        totalCost || null,
      ],
    );
  }

  const createdBy = req.user.real_name || req.user.username || '系统管理员';

  await db.execute(
    `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, 'add_materials', `添加${materials.length}项物料消耗`, createdBy, new Date()],
  );

  return { success: true, message: '物料消耗添加成功' };
}

async function deleteWorkOrder(id, req) {
  const tenantFilter = addTenantFilter(req, 'wo');
  const [existing] = await db.execute(
    `SELECT id FROM work_orders wo WHERE wo.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (existing.length === 0) {
    throw createHttpError(404, '工单不存在');
  }

  const createdBy = req.user.real_name || req.user.username || '系统管理员';

  await db.execute(
    `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, 'delete', '删除工单', createdBy, new Date()],
  );

  await db.execute(
    `DELETE FROM work_orders WHERE id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  return { success: true, message: '工单删除成功' };
}

async function getLegacyWorkOrders(query, req) {
  const {
    asset_code,
    status,
    priority,
    assigned_to,
    start_date,
    end_date,
    keyword,
  } = query;

  const pageNumber = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.pageSize, 10) || 20, 1), 200);
  const offset = (pageNumber - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params = [];

  const tenantFilter = addTenantFilter(req, 'mwo');
  whereClause += tenantFilter.whereClause;
  params.push(...tenantFilter.params);

  if (asset_code) {
    whereClause += ' AND mwo.asset_code = ?';
    params.push(asset_code);
  }
  if (status) {
    whereClause += ' AND mwo.status = ?';
    params.push(status);
  }
  if (has_signature === '1' || has_signature === 'true') {
    whereClause += ' AND (mwo.engineer_signature IS NOT NULL OR mwo.applicant_signature IS NOT NULL)';
  }
  if (priority) {
    whereClause += ' AND mwo.priority = ?';
    params.push(priority);
  }
  if (assigned_to) {
    whereClause += ' AND mwo.assigned_to = ?';
    params.push(assigned_to);
  }
  if (start_date) {
    whereClause += ' AND DATE(mwo.created_at) >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND DATE(mwo.created_at) <= ?';
    params.push(end_date);
  }
  if (keyword) {
    whereClause += ' AND (mwo.title LIKE ? OR mwo.description LIKE ? OR mwo.work_order_no LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM maintenance_workorders mwo ${whereClause}`,
    params,
  );

  const [rows] = await db.execute(
    `SELECT mwo.* FROM maintenance_workorders mwo ${whereClause} ORDER BY mwo.priority ASC, mwo.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    success: true,
    data: rows,
    pagination: {
      current: pageNumber,
      pageSize: limit,
      total: countResult[0].total,
    },
  };
}

async function getLegacyWorkOrder(id, req) {
  const tenantFilter = addTenantFilter(req, 'mwo');
  const [rows] = await db.execute(
    `SELECT mwo.* FROM maintenance_workorders mwo WHERE mwo.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (rows.length === 0) {
    throw createHttpError(404, '维护工单不存在');
  }

  return { success: true, data: rows[0] };
}

async function createLegacyWorkOrder(body, req) {
  const {
    asset_code,
    title,
    description,
    priority,
    planned_start_date,
    planned_end_date,
    estimated_hours,
    assigned_to,
    materials,
    labor_cost,
    outsourcing_cost,
    other_cost,
  } = body;

  if (!asset_code) {
    throw createHttpError(400, '关联资产不能为空');
  }
  if (!title) {
    throw createHttpError(400, '工单标题不能为空');
  }

  const tenantId = getTenantId(req);
  const workOrderNo = generateWorkOrderNo();
  const createdBy = req.user.real_name || req.user.username || '系统管理员';

  // BUG-009 修复：maintenance_workorders 表无 remark 列
  const [result] = await db.execute(
    `INSERT INTO maintenance_workorders (
      tenant_id, work_order_no, asset_code, title, description, priority,
      planned_start_date, planned_end_date, estimated_hours, assigned_to,
      materials, labor_cost, outsourcing_cost, other_cost,
      status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      workOrderNo,
      asset_code,
      title,
      description || null,
      priority || 3,
      planned_start_date || null,
      planned_end_date || null,
      estimated_hours || null,
      assigned_to || null,
      materials ? JSON.stringify(materials) : null,
      labor_cost || 0,
      outsourcing_cost || 0,
      other_cost || 0,
      'pending',
      createdBy,
    ],
  );

  const materialCost = materials
    ? materials.reduce((sum, item) => sum + (item.quantity * item.unit_price || 0), 0)
    : 0;
  const totalCost = (labor_cost || 0) + (outsourcing_cost || 0) + (other_cost || 0) + materialCost;

  if (totalCost > 0) {
    // BUG-008b 修复：maintenance_costs 实际表结构为 cost_type enum('labor','material','external','other') + amount
    // 无 related_type/related_id/labor_cost/material_cost/outsourcing_cost/other_cost/total_cost 列
    const costEntries = [];
    if (Number(labor_cost) > 0) costEntries.push({ cost_type: 'labor', amount: Number(labor_cost) });
    if (materialCost > 0) costEntries.push({ cost_type: 'material', amount: materialCost });
    if (Number(outsourcing_cost) > 0) costEntries.push({ cost_type: 'external', amount: Number(outsourcing_cost) });
    if (Number(other_cost) > 0) costEntries.push({ cost_type: 'other', amount: Number(other_cost) });

    for (const entry of costEntries) {
      await db.execute(
        `INSERT INTO maintenance_costs (
          tenant_id, work_order_id, asset_code, cost_date, cost_type, amount, description, created_by
        ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)`,
        [tenantId, result.insertId, asset_code, entry.cost_type, entry.amount, `工单 ${workOrderNo} 成本`, createdBy],
      );
    }
  }

  return {
    success: true,
    message: '维护工单创建成功',
    data: { id: result.insertId, work_order_no: workOrderNo },
  };
}

async function updateLegacyWorkOrder(id, body, req) {
  const {
    title,
    description,
    priority,
    planned_start_date,
    planned_end_date,
    estimated_hours,
    assigned_to,
    materials,
    labor_cost,
    outsourcing_cost,
    other_cost,
    work_content,
    actual_start_date,
    actual_end_date,
    actual_hours,
    status,
  } = body;

  const updateFields = [];
  const updateValues = [];

  if (title !== undefined) {
    updateFields.push('title = ?');
    updateValues.push(title);
  }
  if (description !== undefined) {
    updateFields.push('description = ?');
    updateValues.push(description);
  }
  if (priority !== undefined) {
    updateFields.push('priority = ?');
    updateValues.push(priority);
  }
  if (planned_start_date !== undefined) {
    updateFields.push('planned_start_date = ?');
    updateValues.push(planned_start_date);
  }
  if (planned_end_date !== undefined) {
    updateFields.push('planned_end_date = ?');
    updateValues.push(planned_end_date);
  }
  if (estimated_hours !== undefined) {
    updateFields.push('estimated_hours = ?');
    updateValues.push(estimated_hours);
  }
  if (assigned_to !== undefined) {
    updateFields.push('assigned_to = ?');
    updateValues.push(assigned_to);
  }
  if (materials !== undefined) {
    updateFields.push('materials = ?');
    updateValues.push(JSON.stringify(materials));
  }
  if (labor_cost !== undefined) {
    updateFields.push('labor_cost = ?');
    updateValues.push(labor_cost);
  }
  if (outsourcing_cost !== undefined) {
    updateFields.push('outsourcing_cost = ?');
    updateValues.push(outsourcing_cost);
  }
  if (other_cost !== undefined) {
    updateFields.push('other_cost = ?');
    updateValues.push(other_cost);
  }
  if (work_content !== undefined) {
    updateFields.push('work_content = ?');
    updateValues.push(work_content);
  }
  if (actual_start_date !== undefined) {
    updateFields.push('actual_start_date = ?');
    updateValues.push(actual_start_date);
  }
  if (actual_end_date !== undefined) {
    updateFields.push('actual_end_date = ?');
    updateValues.push(actual_end_date);
  }
  if (actual_hours !== undefined) {
    updateFields.push('actual_hours = ?');
    updateValues.push(actual_hours);
  }
  if (status !== undefined) {
    updateFields.push('status = ?');
    updateValues.push(status);
  }

  if (updateFields.length === 0) {
    throw createHttpError(400, '没有要更新的字段');
  }

  const tenantFilter = addTenantFilter(req, 'mwo');
  const [existing] = await db.execute(
    `SELECT id, asset_code, work_order_no FROM maintenance_workorders mwo WHERE mwo.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (existing.length === 0) {
    throw createHttpError(404, '维护工单不存在');
  }

  updateFields.push('updated_at = NOW()');
  updateValues.push(id);

  await db.execute(
    `UPDATE maintenance_workorders mwo SET ${updateFields.join(', ')} WHERE mwo.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
    [...updateValues, ...tenantFilter.params],
  );

  return { success: true, message: '维护工单更新成功' };
}

async function deleteLegacyWorkOrder(id, req) {
  const tenantFilter = addTenantFilter(req, 'mwo');
  const [workorders] = await db.execute(
    `SELECT mwo.status FROM maintenance_workorders mwo WHERE mwo.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (workorders.length === 0) {
    throw createHttpError(404, '维护工单不存在');
  }

  if (!['in_progress', 'pending_review'].includes(workorders[0].status)) {
    throw createHttpError(400, '只能删除进行中或待审核状态的工单');
  }

  const [result] = await db.execute(
    `DELETE mwo FROM maintenance_workorders mwo WHERE mwo.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
    [id, ...tenantFilter.params],
  );

  if (result.affectedRows === 0) {
    throw createHttpError(404, '维护工单不存在');
  }

  return { success: true, message: '维护工单删除成功' };
}

/**
 * 获取工单历史轨迹 (Timeline)
 */
async function getWorkOrderHistory(id, req) {
  const located = await locateWorkOrder(id, req);
  if (!located) {
    return { success: false, message: '工单不存在' };
  }

  const { tenantFilter } = located;
  const [histories] = await db.execute(
    `SELECT id, action_type, action_description, action_by, action_at, created_at
     FROM work_order_history
     WHERE work_order_id = ?
     ORDER BY action_at DESC, id DESC
     LIMIT 50`,
    [id]
  );

  return {
    success: true,
    data: histories,
  };
}

async function assignWorkOrder(id, body, req) {
  const { assigned_to } = body;

  if (!assigned_to) {
    throw createHttpError(400, '请指定负责人');
  }

  const located = await locateWorkOrder(id, req);
  if (!located) {
    throw createHttpError(404, '维护工单不存在');
  }

  // 分配功能已移除，保留此函数但放宽状态限制
  if (!['pending', 'in_progress', 'pending_review', 'completed', 'closed'].includes(located.row.status)) {
    throw createHttpError(400, '该工单状态不允许操作');
  }

  const [engineerUsers] = await db.execute(
    `SELECT u.id, u.username, u.real_name, utr.role
     FROM users u
     LEFT JOIN user_tenant_roles utr ON u.id = utr.user_id AND utr.tenant_id = ?
     WHERE (u.username = ? OR u.real_name = ?)
     LIMIT 1`,
    [located.tenantFilter.params[0], assigned_to, assigned_to],
  );

  if (engineerUsers.length === 0) {
    throw createHttpError(400, '未找到该工程师用户，请检查用户名或姓名是否正确');
  }

  const engineerRole = engineerUsers[0].role;
  if (!ENGINEER_ROLES.includes(engineerRole)) {
    throw createHttpError(400, `用户 "${assigned_to}" 不是有效的工程师角色，无法分配工单`);
  }

  const assignedBy = req.user.real_name || req.user.username || '系统管理员';
  const { table, alias, tenantFilter } = located;

  if (table === 'work_orders') {
    // 新表：无 assigned_by 字段，记录到 history
    await db.execute(
      `UPDATE ${table} ${alias} SET
        ${alias}.assigned_to = ?,
        ${alias}.assigned_at = NOW(),
        ${alias}.status = 'assigned',
        ${alias}.updated_at = NOW()
      WHERE ${alias}.id = ? ${tenantFilter.whereClause}`,
      [assigned_to, id, ...tenantFilter.params],
    );
    await db.execute(
      `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, 'assign', `分配给 ${assigned_to}（由 ${assignedBy} 分配）`, assignedBy, new Date()],
    );
  } else {
    // 旧表：保持原逻辑
    await db.execute(
      `UPDATE ${table} ${alias} SET
        ${alias}.assigned_to = ?,
        ${alias}.assigned_by = ?,
        ${alias}.assigned_at = NOW(),
        ${alias}.status = 'assigned',
        ${alias}.updated_at = NOW()
      WHERE ${alias}.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [assigned_to, assignedBy, id, ...tenantFilter.params],
    );
  }

  // 派单成功后发飞书通知事件（异步，不阻塞）
  emitWorkOrderAssigned(id, assigned_to, assignedBy, located.tenantFilter.params[0]).catch(() => {});

  return { success: true, message: '工单分配成功' };
}

// 内部辅助：派单后发飞书通知事件
async function emitWorkOrderAssigned(id, assignedTo, assignedBy, tenantId) {
  try {
    // 查工单基本信息用于通知（work_orders 表字段为 fault_cause，非 fault_description）
    const [rows] = await db.execute(
      'SELECT work_order_no, asset_code, asset_name, fault_cause FROM work_orders WHERE id = ? AND tenant_id = ? LIMIT 1',
      [id, tenantId],
    );
    const wo = rows?.[0] || {};
    publishAsync('workorder:assigned', {
      id,
      workOrderNo: wo.work_order_no,
      asset_code: wo.asset_code,
      asset_name: wo.asset_name,
      fault_cause: wo.fault_cause,
      assignedTo,
      assignedBy,
      tenantId,
    }).catch(e => logger.warn('发布 workorder:assigned 事件失败:', e.message));
  } catch (e) {
    logger.warn('派单后查工单信息失败:', e.message);
  }
}

async function startWorkOrder(id, req) {
  const userRole = req.user?.role;
  const userName = req.user?.real_name || req.user?.username;

  let roleBasedFilter = '';
  const roleBasedParams = [];

  if (userRole === 'maintenance_engineer' && userName) {
    roleBasedFilter = ' AND mwo.assigned_to = ?';
    roleBasedParams.push(userName);
  }

  const located = await locateWorkOrder(id, req, roleBasedFilter, roleBasedParams);
  if (!located) {
    throw createHttpError(404, '维护工单不存在或无权限操作');
  }

  if (!['assigned', 'in_progress'].includes(located.row.status)) {
    throw createHttpError(400, '该工单无法开始');
  }

  const { table, alias, tenantFilter } = located;

  if (table === 'work_orders') {
    // 新表：用 started_at 字段
    await db.execute(
      `UPDATE ${table} ${alias} SET
        ${alias}.status = 'in_progress',
        ${alias}.started_at = NOW(),
        ${alias}.updated_at = NOW()
      WHERE ${alias}.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    const startedBy = req.user.real_name || req.user.username || '系统管理员';
    await db.execute(
      `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, 'start', '开始维修', startedBy, new Date()],
    );
  } else {
    // 旧表：用 actual_start_date 字段
    await db.execute(
      `UPDATE ${table} ${alias} SET
        ${alias}.status = 'in_progress',
        ${alias}.actual_start_date = NOW(),
        ${alias}.updated_at = NOW()
      WHERE ${alias}.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [id, ...tenantFilter.params],
    );
  }

  return { success: true, message: '工单已开始' };
}

async function completeWorkOrder(id, body, req) {
  const {
    work_content,
    actual_hours,
    labor_cost,
    outsourcing_cost,
    other_cost,
    materials,
    engineer_signature,
  } = body;

  // 工程师手写签名（base64 PNG）—— 新流程必填
  // 不传则保持老流程（status=completed），向后兼容
  const useNewFlow = engineer_signature !== undefined && engineer_signature !== null && engineer_signature !== '';

  const userRole = req.user?.role;
  const userName = req.user?.real_name || req.user?.username;

  let roleBasedFilter = '';
  const roleBasedParams = [];

  if (userRole === 'maintenance_engineer' && userName) {
    roleBasedFilter = ' AND mwo.assigned_to = ?';
    roleBasedParams.push(userName);
  }

  const located = await locateWorkOrder(id, req, roleBasedFilter, roleBasedParams);
  if (!located) {
    throw createHttpError(404, '维护工单不存在或无权限操作');
  }

  if (located.row.status !== 'in_progress' && located.row.status !== 'assigned') {
    throw createHttpError(400, '该工单无法完成');
  }

  // 新流程必须传工程师手写签名
  if (useNewFlow && typeof engineer_signature !== 'string') {
    throw createHttpError(400, '工程师手写签名不能为空');
  }

  // assigned 状态：先自动「开始维修」再完成（一键完成）
  const { table, alias, tenantFilter } = located;
  if (located.row.status === 'assigned') {
    const startedBy = req.user.real_name || req.user.username || '系统管理员';
    if (table === 'work_orders') {
      await db.execute(
        `UPDATE ${table} ${alias} SET ${alias}.status = 'in_progress', ${alias}.started_at = NOW(), ${alias}.updated_at = NOW() WHERE ${alias}.id = ? ${tenantFilter.whereClause}`,
        [id, ...tenantFilter.params],
      );
    } else {
      // 旧表：用 actual_start_date
      await db.execute(
        `UPDATE ${table} ${alias} SET ${alias}.status = 'in_progress', ${alias}.actual_start_date = NOW(), ${alias}.updated_at = NOW() WHERE ${alias}.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
        [id, ...tenantFilter.params],
      );
    }
    await db.execute(
      `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at) VALUES (?, ?, ?, ?, ?)`,
      [id, 'start', '开始维修（一键完成）', startedBy, new Date()],
    );
  }

  const tenantId = getTenantId(req);
  const completedBy = req.user.real_name || req.user.username || '系统管理员';
  const assetCode = located.row.asset_code;
  const workOrderNo = located.row.work_order_no;

  const materialCost = materials
    ? materials.reduce((sum, item) => sum + (item.quantity * item.unit_price || 0), 0)
    : 0;
  const totalCost = (labor_cost || 0) + (outsourcing_cost || 0) + (other_cost || 0) + materialCost;

  if (table === 'work_orders') {
    // 新表：无 work_content/labor_cost 等字段，work_content 存到 solution
    // 新流程：签名后置 pending_acceptance（待申请人评价），老流程保持 completed
    if (useNewFlow) {
      await db.execute(
        `UPDATE ${table} ${alias} SET
          ${alias}.status = 'pending_acceptance',
          ${alias}.actual_hours = ?,
          ${alias}.completed_at = NOW(),
          ${alias}.solution = ?,
          ${alias}.engineer_signature = ?,
          ${alias}.engineer_signed_at = NOW(),
          ${alias}.updated_at = NOW()
        WHERE ${alias}.id = ? ${tenantFilter.whereClause}`,
        [actual_hours || null, work_content || null, engineer_signature, id, ...tenantFilter.params],
      );
    } else {
      await db.execute(
        `UPDATE ${table} ${alias} SET
          ${alias}.status = 'completed',
          ${alias}.actual_hours = ?,
          ${alias}.completed_at = NOW(),
          ${alias}.solution = ?,
          ${alias}.updated_at = NOW()
        WHERE ${alias}.id = ? ${tenantFilter.whereClause}`,
        [actual_hours || null, work_content || null, id, ...tenantFilter.params],
      );
    }
    // 记录完成操作到 history（新表无 completed_by 字段）
    const actionDesc = useNewFlow
      ? `工单待评价（由 ${completedBy} 签名完成，总成本 ${totalCost}，等待申请人评价）`
      : `工单完成（由 ${completedBy} 完成，总成本 ${totalCost}）`;
    await db.execute(
      `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, 'complete', actionDesc, completedBy, new Date()],
    );
  } else {
    // 旧表：保持原逻辑
    await db.execute(
      `UPDATE ${table} ${alias} SET
        ${alias}.status = 'completed',
        ${alias}.work_content = ?,
        ${alias}.actual_hours = ?,
        ${alias}.actual_end_date = NOW(),
        ${alias}.labor_cost = ?,
        ${alias}.outsourcing_cost = ?,
        ${alias}.other_cost = ?,
        ${alias}.materials = ?,
        ${alias}.completed_by = ?,
        ${alias}.completed_at = NOW(),
        ${alias}.updated_at = NOW()
      WHERE ${alias}.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [
        work_content || null,
        actual_hours || null,
        labor_cost || 0,
        outsourcing_cost || 0,
        other_cost || 0,
        materials ? JSON.stringify(materials) : null,
        completedBy,
        id,
        ...tenantFilter.params,
      ],
    );
  }

  if (totalCost > 0) {
    // 动态检测 maintenance_costs 表字段（表结构可能不同）
    try {
      const [costCols] = await db.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_costs'"
      );
      const costColNames = costCols.map(c => c.COLUMN_NAME);

      const costInsertCols = [];
      const costInsertVals = [];

      // 必填字段
      if (costColNames.includes('tenant_id')) { costInsertCols.push('tenant_id'); costInsertVals.push(tenantId); }
      if (costColNames.includes('asset_code')) { costInsertCols.push('asset_code'); costInsertVals.push(assetCode); }
      if (costColNames.includes('cost_date')) { costInsertCols.push('cost_date'); costInsertVals.push(new Date().toISOString().split('T')[0]); }
      if (costColNames.includes('amount')) { costInsertCols.push('amount'); costInsertVals.push(totalCost); }
      if (costColNames.includes('description')) { costInsertCols.push('description'); costInsertVals.push(`工单 ${workOrderNo} 完成成本`); }
      if (costColNames.includes('created_by')) { costInsertCols.push('created_by'); costInsertVals.push(completedBy); }
      // cost_type: enum('labor','material','external','other')，用 'other' 表示综合成本
      if (costColNames.includes('cost_type')) { costInsertCols.push('cost_type'); costInsertVals.push('other'); }
      // 可选字段
      if (costColNames.includes('work_order_id')) { costInsertCols.push('work_order_id'); costInsertVals.push(id); }
      if (costColNames.includes('asset_name') && located.row.asset_name) { costInsertCols.push('asset_name'); costInsertVals.push(located.row.asset_name); }

      if (costInsertCols.length > 0) {
        const costPlaceholders = costInsertCols.map(() => '?').join(', ');
        await db.execute(
          `INSERT INTO maintenance_costs (${costInsertCols.join(', ')}) VALUES (${costPlaceholders})`,
          costInsertVals,
        );
      }
    } catch (costError) {
      console.warn('[WorkOrder] 记录维护成本失败:', costError.message);
      // 不影响工单完成流程
    }
  }

  // 工单完成时自动创建维护日志
  try {
    const [logTables] = await db.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_logs'"
    );
    if (logTables.length > 0) {
      const [logColumns] = await db.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_logs'"
      );
      const logColNames = logColumns.map(c => c.COLUMN_NAME);

      const insertCols = ['tenant_id', 'asset_code', 'maintenance_type', 'maintenance_date', 'maintenance_person', 'maintenance_content', 'source_type', 'source_id', 'created_by'];
      const insertVals = [
        tenantId,
        assetCode,
        '故障维修',
        new Date().toISOString().split('T')[0],
        completedBy,
        work_content || `工单 ${workOrderNo} 完成`,
        'workorder',
        id,
        completedBy,
      ];

      // 可选字段
      if (logColNames.includes('asset_name') && located.row.asset_name) { insertCols.push('asset_name'); insertVals.push(located.row.asset_name); }
      if (logColNames.includes('status')) { insertCols.push('status'); insertVals.push('已完成'); }
      if (logColNames.includes('work_order_id')) { insertCols.push('work_order_id'); insertVals.push(id); }
      if (logColNames.includes('work_order_no')) { insertCols.push('work_order_no'); insertVals.push(workOrderNo); }
      if (logColNames.includes('actual_hours') && actual_hours) { insertCols.push('actual_hours'); insertVals.push(actual_hours); }
      if (logColNames.includes('maintenance_cost')) { insertCols.push('maintenance_cost'); insertVals.push(totalCost); }
      // maintenance_result enum 为中文值，传 '正常' 而非 'normal'
      if (logColNames.includes('maintenance_result')) { insertCols.push('maintenance_result'); insertVals.push('正常'); }
      if (logColNames.includes('quality_check')) { insertCols.push('quality_check'); insertVals.push('待检查'); }

      const placeholders = insertCols.map(() => '?').join(', ');
      await db.execute(
        `INSERT INTO maintenance_logs (${insertCols.join(', ')}) VALUES (${placeholders})`,
        insertVals
      );
    }
  } catch (logError) {
    console.warn('[WorkOrder] 自动创建维护日志失败:', logError.message);
    // 不影响工单完成流程
  }

  // P0-4 修复: 工单完成后恢复资产状态, 统一走 assetStatusService.transition
  // WORKORDER_COMPLETED 事件: 仅在当前是「维修」+ 无其他活跃工单时回退「在用」
  await assetStatusService.transition(
    db,
    assetCode,
    assetStatusService.EVENTS.WORKORDER_COMPLETED,
    { tenantId, excludeWorkOrderId: id }
  );

  // 工单完成后发飞书通知事件（异步，不阻塞）
  try {
    // 新流程：触发"待评价"事件（通知申请人去评价）；老流程：触发"已完成"事件
    const eventName = useNewFlow ? 'workorder:pending_acceptance' : 'workorder:completed';
    publishAsync(eventName, {
      id,
      workOrderNo: located.row.work_order_no,
      asset_code: assetCode,
      completedBy,
      tenantId,
    }).catch(e => logger.warn(`发布 ${eventName} 事件失败:`, e.message));
  } catch (_) {}

  return {
    success: true,
    message: useNewFlow ? '工单已签名完成，等待申请人评价' : '工单已完成',
  };
}

/**
 * 申请人评价工单
 * Body: { rating, comment?, signature? }
 *  - rating: 必填 1-5
 *  - comment: 评价内容（可选）
 *  - signature: 申请人手写签名 base64（可选）
 * 评价成功后：status = closed
 */
async function evaluateWorkOrder(id, body, req) {
  const { rating, comment, signature } = body || {};

  // 评分必填且 1-5
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    throw createHttpError(400, '请填写 1-5 星评分');
  }

  // 签名若提供必须是字符串
  if (signature !== undefined && signature !== null && signature !== '' && typeof signature !== 'string') {
    throw createHttpError(400, '签名格式不正确');
  }

  const located = await locateWorkOrder(id, req);
  if (!located) {
    throw createHttpError(404, '维护工单不存在或无权限操作');
  }

  if (located.row.status !== 'pending_acceptance') {
    throw createHttpError(400, '该工单当前状态不可评价（需先由工程师签名完成）');
  }

  const { table, alias, tenantFilter } = located;
  const tenantId = getTenantId(req);
  const evaluatedBy = req.user.real_name || req.user.username || '系统管理员';

  if (table === 'work_orders') {
    await db.execute(
      `UPDATE ${table} ${alias} SET
        ${alias}.status = 'closed',
        ${alias}.applicant_rating = ?,
        ${alias}.applicant_comment = ?,
        ${alias}.applicant_signature = ?,
        ${alias}.applicant_signed_at = ?,
        ${alias}.applicant_signed_by = ?,
        ${alias}.evaluated_at = NOW(),
        ${alias}.satisfaction_score = ?,
        ${alias}.accepted_at = NOW(),
        ${alias}.accepted_by = ?,
        ${alias}.updated_at = NOW()
      WHERE ${alias}.id = ? ${tenantFilter.whereClause}`,
      [
        ratingNum,
        comment || null,
        signature || null,
        signature ? new Date() : null,
        evaluatedBy,
        ratingNum,
        evaluatedBy,
        id,
        ...tenantFilter.params,
      ],
    );

    // 写入历史
    await db.execute(
      `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        'evaluate',
        `申请人评价（${ratingNum} 星${comment ? '，备注：' + comment : ''}，由 ${evaluatedBy} 评价）`,
        evaluatedBy,
        new Date(),
      ],
    );
  } else {
    // 旧表：写最少必要字段
    await db.execute(
      `UPDATE ${table} ${alias} SET
        ${alias}.status = 'closed',
        ${alias}.satisfaction_score = ?,
        ${alias}.updated_at = NOW()
      WHERE ${alias}.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [ratingNum, id, ...tenantFilter.params],
    );
    await db.execute(
      `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, 'evaluate', `评价（${ratingNum} 星，${evaluatedBy}）`, evaluatedBy, new Date()],
    );
  }

  // 发评价完成事件
  try {
    publishAsync('workorder:evaluated', {
      id,
      workOrderNo: located.row.work_order_no,
      asset_code: located.row.asset_code,
      rating: ratingNum,
      evaluatedBy,
      tenantId,
    }).catch(e => logger.warn('发布 workorder:evaluated 事件失败:', e.message));
  } catch (_) {}

  return { success: true, message: '评价完成，工单已关闭' };
}

async function closeWorkOrder(id, remark, req) {
  const located = await locateWorkOrder(id, req);
  if (!located) {
    throw createHttpError(404, '维护工单不存在');
  }

  if (!['completed', 'pending_acceptance', 'cancelled'].includes(located.row.status)) {
    throw createHttpError(400, '该工单无法关闭');
  }

  const { table, alias, tenantFilter } = located;
  const closedBy = req.user.real_name || req.user.username || '系统管理员';

  if (table === 'work_orders') {
    // 新表：无 remark 字段，记录到 history
    await db.execute(
      `UPDATE ${table} ${alias} SET
        ${alias}.status = 'closed',
        ${alias}.updated_at = NOW()
      WHERE ${alias}.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    await db.execute(
      `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, 'close', `关闭工单${remark ? '（' + remark + '）' : ''}`, closedBy, new Date()],
    );
  } else {
    // BUG-009 修复：旧表 maintenance_workorders 无 remark 列，仅更新状态
    await db.execute(
      `UPDATE ${table} ${alias} SET
        ${alias}.status = 'closed',
        ${alias}.updated_at = NOW()
      WHERE ${alias}.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [id, ...tenantFilter.params],
    );
  }

  return { success: true, message: '工单已关闭' };
}

async function cancelWorkOrder(id, cancelReason, req) {
  const located = await locateWorkOrder(id, req);
  if (!located) {
    throw createHttpError(404, '维护工单不存在');
  }

  if (['closed', 'completed', 'cancelled'].includes(located.row.status)) {
    throw createHttpError(400, '该工单无法取消');
  }

  const { table, alias, tenantFilter } = located;
  const cancelledBy = req.user.real_name || req.user.username || '系统管理员';

  if (table === 'work_orders') {
    // 新表：无 cancel_reason 字段，记录到 history
    await db.execute(
      `UPDATE ${table} ${alias} SET
        ${alias}.status = 'cancelled',
        ${alias}.updated_at = NOW()
      WHERE ${alias}.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    await db.execute(
      `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, 'cancel', `取消工单${cancelReason ? '（' + cancelReason + '）' : ''}`, cancelledBy, new Date()],
    );
  } else {
    // 旧表：有 cancel_reason 字段
    await db.execute(
      `UPDATE ${table} ${alias} SET
        ${alias}.status = 'cancelled',
        ${alias}.cancel_reason = ?,
        ${alias}.updated_at = NOW()
      WHERE ${alias}.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [cancelReason || null, id, ...tenantFilter.params],
    );
  }

  return { success: true, message: '工单已取消' };
}

// ==================== 辅助函数（Bug3/Bug4 修复） ====================

/**
 * 定位工单所在表（新表 work_orders 或旧表 maintenance_workorders）
 * @returns {{ table: string, alias: string, row: object, tenantFilter: object } | null}
 */
async function locateWorkOrder(id, req, roleBasedFilter = '', roleBasedParams = []) {
  // 先查新表 work_orders
  const newTenantFilter = addTenantFilter(req, 'wo');
  const [newRows] = await db.execute(
    `SELECT * FROM work_orders wo WHERE wo.id = ? ${newTenantFilter.whereClause} ${roleBasedFilter.replace(/mwo\./g, 'wo.')}`,
    [id, ...newTenantFilter.params, ...roleBasedParams],
  );
  if (newRows.length > 0) {
    return { table: 'work_orders', alias: 'wo', row: newRows[0], tenantFilter: newTenantFilter };
  }
  // 再查旧表 maintenance_workorders
  const oldTenantFilter = addTenantFilter(req, 'mwo');
  const [oldRows] = await db.execute(
    `SELECT * FROM maintenance_workorders mwo WHERE mwo.id = ? ${oldTenantFilter.whereClause} ${roleBasedFilter}`,
    [id, ...oldTenantFilter.params, ...roleBasedParams],
  );
  if (oldRows.length > 0) {
    return { table: 'maintenance_workorders', alias: 'mwo', row: oldRows[0], tenantFilter: oldTenantFilter };
  }
  return null;
}

// P0-4 修复: 旧的 restoreAssetStatusIfNeeded 已删除, 改用 assetStatusService.transition
// (调用点见 completeWorkOrder / 类似流程, 事件: WORKORDER_COMPLETED)

async function getEngineers(req) {
  const tenantFilter = addTenantFilter(req, 'utr');
  const tenantId = tenantFilter.params[0];

  if (!tenantId) {
    throw createHttpError(400, '无法获取租户信息');
  }

  const placeholders = ENGINEER_ROLES.map(() => '?').join(',');
  const [engineers] = await db.execute(
    `SELECT DISTINCT u.id, u.username, u.real_name, u.phone, u.email, utr.role
     FROM users u
     INNER JOIN user_tenant_roles utr ON u.id = utr.user_id AND utr.tenant_id = ?
     WHERE utr.role IN (${placeholders}) AND utr.status = 'active'
     ORDER BY u.real_name, u.username`,
    [tenantId, ...ENGINEER_ROLES],
  );

  return {
    success: true,
    data: engineers.map(e => ({
      id: e.id,
      username: e.username,
      real_name: e.real_name,
      phone: e.phone,
      email: e.email,
      role: e.role,
    })),
  };
}

/**
 * 工单统计: 总数 / 待派工 / 进行中 / 待评价 / 已完成 / 逾期
 * 逾期定义: 申请 expected_repair_date < 当前日期 且 状态非 closed/cancelled
 */
async function getWorkOrderStatistics(query, req) {
  const tenantFilter = addTenantFilter(req, 'wo');
  const whereClause = `WHERE 1=1 ${tenantFilter.whereClause.replace('WHERE', 'AND')}`;

  // 1. 状态分布
  const [statusRows] = await db.execute(
    `SELECT wo.status, COUNT(*) AS count
     FROM work_orders wo
     ${whereClause}
     GROUP BY wo.status`,
    tenantFilter.params
  );

  // 2. 优先级分布
  const [priorityRows] = await db.execute(
    `SELECT wo.priority, COUNT(*) AS count
     FROM work_orders wo
     ${whereClause}
     GROUP BY wo.priority`,
    tenantFilter.params
  );

  // 3. 逾期: 关联 maintenance_requests.expected_repair_date
  const [overdueRows] = await db.execute(
    `SELECT COUNT(*) AS overdue_count
     FROM work_orders wo
     INNER JOIN maintenance_requests mr ON mr.id = wo.maintenance_request_id
     ${whereClause.replace('wo.', 'mr.').replace('${tenantFilter.whereClause}', '${tenantFilter.whereClause}')}
       AND mr.expected_repair_date IS NOT NULL
       AND mr.expected_repair_date < CURDATE()
       AND wo.status NOT IN ('closed', 'cancelled', 'completed', 'pending_acceptance')`,
    tenantFilter.params
  );

  // 4. 平均工时 (已完成/已关闭)
  const [hoursRows] = await db.execute(
    `SELECT
      AVG(actual_hours) AS avg_actual,
      AVG(estimated_hours) AS avg_estimated,
      COUNT(CASE WHEN actual_hours IS NOT NULL THEN 1 END) AS with_hours
     FROM work_orders wo
     ${whereClause}
       AND wo.status IN ('closed', 'completed', 'pending_acceptance')`,
    tenantFilter.params
  );

  // 5. 平均评分
  const [ratingRows] = await db.execute(
    `SELECT AVG(applicant_rating) AS avg_rating, COUNT(*) AS rated_count
     FROM work_orders wo
     ${whereClause}
       AND applicant_rating IS NOT NULL AND applicant_rating > 0`,
    tenantFilter.params
  );

  const statusMap = {};
  for (const r of statusRows) statusMap[r.status] = r.count;
  const priorityMap = {};
  for (const r of priorityRows) priorityMap[r.priority] = r.count;

  return {
    success: true,
    data: {
      total: Object.values(statusMap).reduce((a, b) => a + b, 0),
      by_status: statusMap,
      by_priority: priorityMap,
      pending: statusMap.pending || 0,                  // 待派工
      assigned: statusMap.assigned || 0,
      in_progress: statusMap.in_progress || 0,         // 进行中
      pending_acceptance: statusMap.pending_acceptance || 0,  // 待评价
      completed: statusMap.completed || 0,
      closed: statusMap.closed || 0,
      cancelled: statusMap.cancelled || 0,
      overdue: overdueRows[0]?.overdue_count || 0,
      avg_actual_hours: Number(hoursRows[0]?.avg_actual || 0).toFixed(1),
      avg_estimated_hours: Number(hoursRows[0]?.avg_estimated || 0).toFixed(1),
      with_hours_count: hoursRows[0]?.with_hours || 0,
      avg_rating: Number(ratingRows[0]?.avg_rating || 0).toFixed(1),
      rated_count: ratingRows[0]?.rated_count || 0,
    },
  };
}

module.exports = {
  getWorkOrders,
  getDispatchPanel,
  getWorkOrder,
  createWorkOrder,
  updateWorkOrder,
  addWorkOrderMaterials,
  deleteWorkOrder,
  getLegacyWorkOrders,
  getLegacyWorkOrder,
  createLegacyWorkOrder,
  updateLegacyWorkOrder,
  deleteLegacyWorkOrder,
  assignWorkOrder,
  startWorkOrder,
  completeWorkOrder,
  evaluateWorkOrder,
  closeWorkOrder,
  cancelWorkOrder,
  getEngineers,
  getWorkOrderStatistics,
  getWorkOrderHistory,
};
