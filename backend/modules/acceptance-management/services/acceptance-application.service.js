/**
 * 验收申请 - 服务层
 *
 * 涵盖：申请 CRUD、状态流转（submit/approve/reject/withdraw/complete）、软删。
 *
 * 面向 controller 的方法接收显式参数（tenantFilter / tenantId / 业务字段 / user），
 * 不直接依赖 req/res，由 controller 负责 HTTP 语义和权限前置。
 */
const db = require('../../../config/database');
const { getTenantId } = require('../../../middleware/tenant-filter');
const {
  logger,
  generateApplicationCode,
  canTransitionApplicationStatus,
  validateApplicationInput,
} = require('../utils/helpers');

/**
 * 解析分页参数
 */
function parsePagination(page, pageSize) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSizeNum = Math.min(200, parseInt(pageSize, 10) || 20);
  return {
    page: pageNum,
    pageSize: pageSizeNum,
    offset: (pageNum - 1) * pageSizeNum,
  };
}

/**
 * 获取验收申请列表
 */
async function listApplications({ tenantFilter, page, pageSize, status, priority, keyword, department }) {
  const { pageNum, pageSizeNum, offset } = parsePagination(page, pageSize);
  let filterClause = '';
  const filterParams = [];
  if (status) { filterClause += ' AND status = ?'; filterParams.push(status); }
  if (priority) { filterClause += ' AND priority = ?'; filterParams.push(priority); }
  if (department) { filterClause += ' AND department LIKE ?'; filterParams.push(`%${department}%`); }
  if (keyword) {
    filterClause += ' AND (title LIKE ? OR application_code LIKE ? OR asset_name LIKE ?)';
    filterParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const baseWhere = `WHERE is_deleted = 0${tenantFilter.whereClause}${filterClause}`;
  const query = `SELECT * FROM acceptance_applications ${baseWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const params = [...tenantFilter.params, ...filterParams, pageSizeNum, offset];

  const [records] = await db.execute(query, params);
  const [totalResult] = await db.execute(
    `SELECT COUNT(*) as total FROM acceptance_applications ${baseWhere}`,
    [...tenantFilter.params, ...filterParams],
  );
  const total = totalResult[0]?.total || 0;
  return {
    records,
    pagination: {
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(total / pageSizeNum),
    },
  };
}

/**
 * 获取申请详情 + 审批轨迹
 */
async function getApplicationWithApprovals({ id, tenantFilter }) {
  const [records] = await db.execute(
    `SELECT * FROM acceptance_applications WHERE id = ? AND is_deleted = 0${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );
  if (records.length === 0) return null;
  const [approvals] = await db.execute(
    'SELECT * FROM acceptance_approvals WHERE application_id = ? AND is_deleted = 0 ORDER BY created_at ASC',
    [id],
  );
  return { ...records[0], approvals };
}

/**
 * 创建申请
 */
async function createApplication({ tenantId, body, user, permission }) {
  const {
    title, asset_code, asset_name, supplier, planned_acceptance_date,
    department, functional_department, priority = '中', description,
  } = body;

  const validation = validateApplicationInput({ title, asset_code, priority, description });
  if (!validation.valid) {
    const err = new Error(validation.errors.join('; '));
    err.statusCode = 400;
    throw err;
  }
  if (!permission.allowed) {
    const err = new Error(permission.message || '无权限');
    err.statusCode = 403;
    throw err;
  }

  const applicationCode = generateApplicationCode(tenantId);
  const applicantName = user.real_name || user.username;

  const [result] = await db.execute(
    `INSERT INTO acceptance_applications
       (tenant_id, application_code, title, asset_code, asset_name, supplier, planned_acceptance_date,
        applicant_id, applicant_name, department, functional_department, priority, status, description,
        created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '草稿', ?, ?, NOW(), NOW())`,
    [
      tenantId, applicationCode, title, asset_code || null, asset_name || null, supplier || null,
      planned_acceptance_date || null, user.id, applicantName, department || null,
      functional_department || null, priority, description || null, user.username,
    ],
  );

  // 记录"创建"审批流水（用于显示）
  await db.execute(
    `INSERT INTO acceptance_approvals (tenant_id, application_id, approver_name, action, comment, from_status, to_status, created_at)
     VALUES (?, ?, ?, 'submit', '创建申请', NULL, '草稿', NOW())`,
    [tenantId, result.insertId, applicantName],
  );

  return { id: result.insertId, application_code: applicationCode };
}

/**
 * 更新申请（仅草稿状态可编辑）
 */
async function updateApplication({ id, tenantFilter, body, user }) {
  const [existing] = await db.execute(
    `SELECT status FROM acceptance_applications WHERE id = ? AND is_deleted = 0${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );
  if (existing.length === 0) {
    const err = new Error('验收申请不存在');
    err.statusCode = 404;
    throw err;
  }
  if (existing[0].status !== '草稿') {
    const err = new Error('只有草稿状态的申请可以编辑');
    err.statusCode = 400;
    throw err;
  }

  const {
    title, asset_code, asset_name, supplier, planned_acceptance_date,
    department, functional_department, priority, description,
  } = body;
  const validation = validateApplicationInput({ title, asset_code, priority, description });
  if (!validation.valid) {
    const err = new Error(validation.errors.join('; '));
    err.statusCode = 400;
    throw err;
  }

  await db.execute(
    `UPDATE acceptance_applications
     SET title=?, asset_code=?, asset_name=?, supplier=?, planned_acceptance_date=?,
         department=?, functional_department=?, priority=?, description=?,
         updated_by=?, updated_at=NOW()
     WHERE id=?`,
    [
      title, asset_code || null, asset_name || null, supplier || null, planned_acceptance_date || null,
      department || null, functional_department || null, priority || '中', description || null,
      user.username, id,
    ],
  );
}

/**
 * 通用状态转换（submit/approve/reject/withdraw 共用）
 */
async function transitionStatus({ id, tenantFilter, action, toStatus, defaultComment, requireApprover, body, user }) {
  const { comment } = body || {};

  const [existing] = await db.execute(
    `SELECT id, status, tenant_id FROM acceptance_applications WHERE id = ? AND is_deleted = 0${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );
  if (existing.length === 0) {
    const err = new Error('验收申请不存在');
    err.statusCode = 404;
    throw err;
  }
  const fromStatus = existing[0].status;
  if (!canTransitionApplicationStatus(fromStatus, toStatus)) {
    const err = new Error(`不允许从[${fromStatus}]转换到[${toStatus}]`);
    err.statusCode = 400;
    throw err;
  }

  const approverName = user.real_name || user.username;
  const updateFields = ['status = ?', 'updated_at = NOW()'];
  const updateParams = [toStatus];
  if (requireApprover) {
    updateFields.push('approval_comment = ?', 'approved_by = ?', 'approved_at = NOW()');
    updateParams.push(comment || defaultComment, approverName);
  }
  updateParams.push(id);

  await db.execute(
    `UPDATE acceptance_applications SET ${updateFields.join(', ')} WHERE id = ?`,
    updateParams,
  );

  await db.execute(
    `INSERT INTO acceptance_approvals (tenant_id, application_id, approver_name, action, comment, from_status, to_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [existing[0].tenant_id, id, approverName, action, comment || defaultComment, fromStatus, toStatus],
  );
}

/**
 * 完成申请（已批准 → 已完成），可绑定验收记录
 */
async function completeApplication({ id, tenantFilter, body, user }) {
  const { acceptance_record_id, comment } = body;

  const [existing] = await db.execute(
    `SELECT id, status, tenant_id FROM acceptance_applications WHERE id = ? AND is_deleted = 0${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );
  if (existing.length === 0) {
    const err = new Error('验收申请不存在');
    err.statusCode = 404;
    throw err;
  }
  if (existing[0].status !== '已批准') {
    const err = new Error('只有已批准的申请可以完成');
    err.statusCode = 400;
    throw err;
  }

  const approverName = user.real_name || user.username;
  await db.execute(
    `UPDATE acceptance_applications
     SET status='已完成', acceptance_record_id=?, approval_comment=?, approved_by=?, approved_at=NOW(), updated_at=NOW()
     WHERE id=?`,
    [acceptance_record_id || null, comment || null, approverName, id],
  );
  await db.execute(
    `INSERT INTO acceptance_approvals (tenant_id, application_id, approver_name, action, comment, from_status, to_status, created_at)
     VALUES (?, ?, ?, 'complete', ?, '已批准', '已完成', NOW())`,
    [existing[0].tenant_id, id, approverName, comment || '验收完成'],
  );
}

/**
 * 软删申请（仅草稿/已撤回/已拒绝可删，级联软删审批记录）
 */
async function softDeleteApplication({ id, tenantFilter, user }) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.execute(
      `SELECT id, status, tenant_id FROM acceptance_applications WHERE id = ? AND is_deleted = 0${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (existing.length === 0) {
      await connection.rollback();
      const err = new Error('验收申请不存在');
      err.statusCode = 404;
      throw err;
    }
    const status = existing[0].status;
    if (status !== '草稿' && status !== '已撤回' && status !== '已拒绝') {
      await connection.rollback();
      const err = new Error(`仅【草稿/已撤回/已拒绝】状态可删除，当前状态：${status}`);
      err.statusCode = 400;
      throw err;
    }

    const deletedBy = user?.username || null;
    const now = new Date();

    // 1) 软删申请主表
    const [result] = await connection.execute(
      `UPDATE acceptance_applications SET is_deleted = 1, deleted_at = ?, deleted_by = ?
       WHERE id = ? AND is_deleted = 0${tenantFilter.whereClause}`,
      [now, deletedBy, id, ...tenantFilter.params],
    );
    if (result.affectedRows === 0) {
      await connection.rollback();
      const err = new Error('验收申请不存在');
      err.statusCode = 404;
      throw err;
    }

    // 2) 级联软删审批记录
    await connection.execute(
      `UPDATE acceptance_approvals SET is_deleted = 1, deleted_at = ?, deleted_by = ?
       WHERE application_id = ? AND is_deleted = 0`,
      [now, deletedBy, id],
    );

    await connection.commit();
  } catch (err) {
    try { await connection.rollback(); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    connection.release();
  }
}

// ============================================
// 申请-资产多对多关联（acceptance_application_assets）
// 仅 草稿/已撤回/已拒绝 状态可编辑
// ============================================

/**
 * 校验申请状态可编辑
 */
async function assertApplicationEditable({ applicationId, tenantFilter }) {
  const [rows] = await db.execute(
    `SELECT status FROM acceptance_applications WHERE id = ? AND is_deleted = 0${tenantFilter.whereClause}`,
    [applicationId, ...tenantFilter.params],
  );
  if (rows.length === 0) {
    const err = new Error('验收申请不存在');
    err.statusCode = 404;
    throw err;
  }
  const status = rows[0].status;
  if (status !== '草稿' && status !== '已撤回' && status !== '已拒绝') {
    const err = new Error(`仅【草稿/已撤回/已拒绝】状态可编辑资产列表，当前状态：${status}`);
    err.statusCode = 400;
    throw err;
  }
}

/**
 * 列出申请关联的资产
 */
async function listApplicationAssets({ applicationId, tenantFilter }) {
  const [rows] = await db.execute(
    `SELECT * FROM acceptance_application_assets
     WHERE application_id = ? AND tenant_id = ? AND is_deleted = 0
     ORDER BY order_index ASC, id ASC`,
    [applicationId, tenantFilter.params[0]],
  );
  return rows;
}

/**
 * 批量添加资产（事务）
 * @param items 数组，每项包含 asset_name（必填）/ asset_code / asset_brand / asset_model /
 *              asset_specification / purchase_date / purchase_amount / order_index
 */
async function addApplicationAssets({ applicationId, tenantFilter, items, user }) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('items 必须是非空数组');
    err.statusCode = 400;
    throw err;
  }
  for (const it of items) {
    if (!it.asset_name) {
      const err = new Error('每个资产必须包含 asset_name');
      err.statusCode = 400;
      throw err;
    }
  }
  await assertApplicationEditable({ applicationId, tenantFilter });

  const tenantId = tenantFilter.params[0];
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 取当前最大 order_index，新条目从 max+1 开始
    const [maxRows] = await connection.execute(
      `SELECT COALESCE(MAX(order_index), 0) AS max_idx
       FROM acceptance_application_assets
       WHERE application_id = ? AND tenant_id = ? AND is_deleted = 0`,
      [applicationId, tenantId],
    );
    let nextIdx = (maxRows[0]?.max_idx || 0) + 1;

    const insertedIds = [];
    for (const it of items) {
      const orderIndex = it.order_index || nextIdx;
      const [result] = await connection.execute(
        `INSERT INTO acceptance_application_assets
           (tenant_id, application_id, asset_name, asset_code, asset_brand, asset_model,
            asset_specification, purchase_date, purchase_amount, order_index, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          tenantId, applicationId, it.asset_name,
          it.asset_code || null, it.asset_brand || null, it.asset_model || null,
          it.asset_specification || null, it.purchase_date || null, it.purchase_amount || null,
          orderIndex,
        ],
      );
      insertedIds.push(result.insertId);
      nextIdx = orderIndex + 1;
    }

    await connection.commit();
    return { ids: insertedIds, count: insertedIds.length };
  } catch (err) {
    try { await connection.rollback(); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * 软删单个资产关联
 */
async function removeApplicationAsset({ applicationId, assetLinkId, tenantFilter, user }) {
  await assertApplicationEditable({ applicationId, tenantFilter });

  const [result] = await db.execute(
    `UPDATE acceptance_application_assets
     SET is_deleted = 1, deleted_at = NOW(), deleted_by = ?
     WHERE id = ? AND application_id = ? AND tenant_id = ? AND is_deleted = 0`,
    [user?.username || null, assetLinkId, applicationId, tenantFilter.params[0]],
  );
  if (result.affectedRows === 0) {
    const err = new Error('资产关联不存在或已被删除');
    err.statusCode = 404;
    throw err;
  }
}

/**
 * 软删申请下所有资产关联
 */
async function clearApplicationAssets({ applicationId, tenantFilter, user }) {
  await assertApplicationEditable({ applicationId, tenantFilter });

  await db.execute(
    `UPDATE acceptance_application_assets
     SET is_deleted = 1, deleted_at = NOW(), deleted_by = ?
     WHERE application_id = ? AND tenant_id = ? AND is_deleted = 0`,
    [user?.username || null, applicationId, tenantFilter.params[0]],
  );
}

module.exports = {
  listApplications,
  getApplicationWithApprovals,
  createApplication,
  updateApplication,
  transitionStatus,
  completeApplication,
  softDeleteApplication,
  // 申请-资产关联
  listApplicationAssets,
  addApplicationAssets,
  removeApplicationAsset,
  clearApplicationAssets,
};
