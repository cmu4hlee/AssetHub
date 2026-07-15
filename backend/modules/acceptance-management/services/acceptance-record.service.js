/**
 * 验收记录 - 核心服务层
 *
 * 将 legacy backend/routes/acceptance.js 中的业务逻辑抽离至此，
 * 实现 Controller → Service → DB 的三层架构。
 *
 * 涵盖：记录 CRUD、状态管理、检查清单管理、文件管理、批量创建、资产查询
 */
const db = require('../../../config/database');
const { TransactionManager } = require('../../../utils/error-handler');
const { publish } = require('../../../core/EventBus');

const VALID_STATUSES = ['待验收', '验收中', '已验收', '验收不合格'];

const logger = {
  error: (msg, e) => console.error(`[acceptance-record] ${msg}:`, e),
  info: (msg) => console.log(`[acceptance-record] ${msg}`),
};

// ============================================
// 校验函数
// ============================================

function validateRecordInput(data) {
  const errors = [];

  if (data.assetCode !== undefined) {
    if (typeof data.assetCode !== 'string' || data.assetCode.length > 50) {
      errors.push('资产编号格式不正确（最长50字符）');
    }
  }
  if (data.assetName !== undefined) {
    if (typeof data.assetName !== 'string' || data.assetName.length > 100) {
      errors.push('资产名称格式不正确（最长100字符）');
    }
  }
  if (data.supplier !== undefined && data.supplier !== null) {
    if (typeof data.supplier !== 'string' || data.supplier.length > 200) {
      errors.push('供应商格式不正确（最长200字符）');
    }
  }
  if (data.acceptanceDate !== undefined && data.acceptanceDate !== null) {
    if (typeof data.acceptanceDate !== 'string') {
      errors.push('验收日期格式不正确');
    }
  }
  if (data.acceptancePerson !== undefined) {
    if (typeof data.acceptancePerson !== 'string' || data.acceptancePerson.length > 50) {
      errors.push('验收人格式不正确（最长50字符）');
    }
  }
  if (data.department !== undefined) {
    if (typeof data.department !== 'string' || data.department.length > 100) {
      errors.push('使用科室格式不正确（最长100字符）');
    }
  }
  if (data.functionalDepartment !== undefined && data.functionalDepartment !== null) {
    if (typeof data.functionalDepartment !== 'string' || data.functionalDepartment.length > 100) {
      errors.push('职能部门格式不正确（最长100字符）');
    }
  }
  if (data.status !== undefined) {
    if (!VALID_STATUSES.includes(data.status)) {
      errors.push(`状态必须是[${VALID_STATUSES.join(', ')}]之一`);
    }
  }
  if (data.remark !== undefined && data.remark !== null) {
    if (typeof data.remark !== 'string' || data.remark.length > 500) {
      errors.push('备注格式不正确（最长500字符）');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// 记录 CRUD
// ============================================

/**
 * @param {Object} opts
 * @param {{whereClause:string, params:Array}} opts.tenantFilter
 * @param {{clause:string, params:Array}|null} opts.departmentScope - null=无限制, {clause,params}=按科室过滤
 * @param {number|string} opts.page
 * @param {number|string} opts.pageSize
 * @param {string} [opts.status]
 * @param {string} [opts.keyword] - 同时搜索资产编号和资产名称
 * @param {string} [opts.assetCode]
 * @param {string} [opts.assetName]
 * @param {string} [opts.department]
 */
async function listRecords({ tenantFilter, departmentScope, page, pageSize, status, keyword, assetCode, assetName, department }) {
  const pageNum = parseInt(page, 10) || 1;
  const pageSizeNum = parseInt(pageSize, 10) || 10;
  const offset = (pageNum - 1) * pageSizeNum;

  let filterClause = '';
  const filterParams = [];

  if (status) { filterClause += ' AND a.status = ?'; filterParams.push(status); }
  if (keyword) {
    filterClause += ' AND (a.asset_code LIKE ? OR a.asset_name LIKE ?)';
    filterParams.push(`%${keyword}%`, `%${keyword}%`);
  } else {
    if (assetCode) { filterClause += ' AND a.asset_code LIKE ?'; filterParams.push(`%${assetCode}%`); }
    if (assetName) { filterClause += ' AND a.asset_name LIKE ?'; filterParams.push(`%${assetName}%`); }
  }
  if (department) { filterClause += ' AND a.department LIKE ?'; filterParams.push(`%${department}%`); }

  const deptClause = departmentScope?.clause || '';
  const deptParams = departmentScope?.params || [];

  const baseWhere = `WHERE 1=1${tenantFilter.whereClause}${deptClause}${filterClause}`;

  const [records] = await db.execute(
    `SELECT a.* FROM asset_acceptance_records a ${baseWhere} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    [...tenantFilter.params, ...deptParams, ...filterParams, pageSizeNum, offset],
  );

  const [totalResult] = await db.execute(
    `SELECT COUNT(*) as total FROM asset_acceptance_records a ${baseWhere}`,
    [...tenantFilter.params, ...deptParams, ...filterParams],
  );

  const total = totalResult[0]?.total || 0;

  return {
    records,
    pagination: { total, page: pageNum, pageSize: pageSizeNum, totalPages: Math.ceil(total / pageSizeNum) },
  };
}

async function getRecord(id, tenantFilter) {
  const [rows] = await db.execute(
    `SELECT * FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );
  return rows[0] || null;
}

async function getRecordWithFiles(id, tenantFilter) {
  const record = await getRecord(id, tenantFilter);
  if (!record) return null;

  const [files] = await db.execute(
    'SELECT * FROM asset_acceptance_files WHERE acceptance_id = ? AND tenant_id = ? AND is_deleted = 0',
    [id, record.tenant_id],
  );

  return { record, files };
}

async function createRecord(data, userId, tenantId) {
  const {
    assetId, assetCode, assetName, supplier,
    acceptanceDate, acceptancePerson, department,
    functionalDepartment, status = '待验收', remark,
  } = data;

  if (!assetCode || !assetName || !acceptanceDate || !acceptancePerson || !department) {
    throw Object.assign(new Error('缺少必填字段'), { statusCode: 400 });
  }

  const validation = validateRecordInput({
    assetCode, assetName, supplier, acceptanceDate,
    acceptancePerson, department, functionalDepartment, status, remark,
  });
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors.join('; ')), { statusCode: 400 });
  }

  // 解析实际资产ID
  let actualAssetId = assetId || null;
  if (actualAssetId) {
    actualAssetId = await resolveAssetId(actualAssetId, assetCode, tenantId);
  } else if (assetCode) {
    actualAssetId = await resolveAssetByCode(assetCode, tenantId);
  }

  const result = await TransactionManager.executeTransaction(async (connection) => {
    const [insertResult] = await connection.execute(
      `INSERT INTO asset_acceptance_records
        (tenant_id, asset_id, asset_code, asset_name, supplier, acceptance_date,
         acceptance_person, department, functional_department, status, remark,
         created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [tenantId, actualAssetId, assetCode, assetName, supplier || null,
       acceptanceDate, acceptancePerson, department, functionalDepartment || null,
       status, remark || null, userId],
    );
    return insertResult;
  });

  return {
    id: result.insertId,
    assetId: actualAssetId, assetCode, assetName, supplier,
    acceptanceDate, acceptancePerson, department, functionalDepartment, status, remark,
  };
}

async function updateRecord(id, data, tenantFilter) {
  if (data.assetId || data.assetCode) {
    const tenantId = tenantFilter.params[0]; // 第一个参数通常是 tenant_id
    let actualAssetId = data.assetId || null;
    if (data.assetCode) {
      actualAssetId = await resolveAssetByCode(data.assetCode, tenantId, actualAssetId);
    }
    data.assetId = actualAssetId;
  }

  // 检查记录存在性
  const oldRecord = await getRecord(id, tenantFilter);
  if (!oldRecord) {
    throw Object.assign(new Error('验收记录不存在'), { statusCode: 404 });
  }

  const merged = {
    assetId: data.assetId ?? oldRecord.asset_id,
    assetCode: data.assetCode ?? oldRecord.asset_code,
    assetName: data.assetName ?? oldRecord.asset_name,
    supplier: data.supplier ?? oldRecord.supplier,
    acceptanceDate: data.acceptanceDate ?? oldRecord.acceptance_date,
    acceptancePerson: data.acceptancePerson ?? oldRecord.acceptance_person,
    department: data.department ?? oldRecord.department,
    functionalDepartment: data.functionalDepartment ?? oldRecord.functional_department,
    status: data.status ?? oldRecord.status,
    remark: data.remark ?? oldRecord.remark,
  };

  await db.execute(
    `UPDATE asset_acceptance_records
     SET asset_id=?, asset_code=?, asset_name=?, supplier=?, acceptance_date=?,
         acceptance_person=?, department=?, functional_department=?, status=?, remark=?,
         updated_at=NOW()
     WHERE id=?${tenantFilter.whereClause}`,
    [merged.assetId, merged.assetCode, merged.assetName, merged.supplier,
     merged.acceptanceDate, merged.acceptancePerson, merged.department,
     merged.functionalDepartment, merged.status, merged.remark,
     id, ...tenantFilter.params],
  );
}

async function deleteRecord(id, tenantFilter, deletedBy = null) {
  const record = await getRecord(id, tenantFilter);
  if (!record) {
    throw Object.assign(new Error('验收记录不存在'), { statusCode: 404 });
  }

  const now = new Date();
  // 软删关联文件
  await db.execute(
    `UPDATE asset_acceptance_files SET is_deleted = 1, deleted_at = ?, deleted_by = ?
     WHERE acceptance_id = ? AND tenant_id = ? AND is_deleted = 0`,
    [now, deletedBy, id, record.tenant_id],
  );
  // 软删检查清单
  await db.execute(
    `UPDATE asset_acceptance_checklist SET is_deleted = 1, deleted_at = ?, deleted_by = ?
     WHERE acceptance_id = ? AND is_deleted = 0`,
    [now, deletedBy, id],
  );
  // 软删记录
  await db.execute(
    `UPDATE asset_acceptance_records SET is_deleted = 1, deleted_at = ?, deleted_by = ?
     WHERE id = ?${tenantFilter.whereClause} AND is_deleted = 0`,
    [now, deletedBy, id, ...tenantFilter.params],
  );
}

// ============================================
// 状态管理
// ============================================

async function updateStatus(id, newStatus, tenantFilter) {
  const record = await getRecord(id, tenantFilter);
  if (!record) {
    throw Object.assign(new Error('验收记录不存在'), { statusCode: 404 });
  }

  if (!VALID_STATUSES.includes(newStatus)) {
    throw Object.assign(
      new Error(`状态必须是[${VALID_STATUSES.join(', ')}]之一`),
      { statusCode: 400 },
    );
  }

  // 状态检查清单阻断器
  if (newStatus === '已验收') {
    const stats = await getChecklistStats(id);
    if (stats.total === 0) {
      throw Object.assign(new Error('请先初始化并完成验收检查清单'), { statusCode: 400 });
    }
    if (stats.unchecked > 0) {
      throw Object.assign(
        new Error(`仍有 ${stats.unchecked} 个检查项未检查，不能标记为已验收`),
        { statusCode: 400 },
      );
    }
    if (stats.failed > 0) {
      throw Object.assign(
        new Error(`存在 ${stats.failed} 个不通过检查项，不能标记为已验收`),
        { statusCode: 400 },
      );
    }
  }

  // 状态变更事件
  const fromStatus = record.status;
  await db.execute(
    `UPDATE asset_acceptance_records SET status = ?, updated_at = NOW() WHERE id = ?${tenantFilter.whereClause}`,
    [newStatus, id, ...tenantFilter.params],
  );

  // 异步发布状态变更事件（用于通知、审计等）
  try {
    publish('acceptance:status-changed', {
      recordId: id,
      tenantId: record.tenant_id,
      assetCode: record.asset_code,
      assetName: record.asset_name,
      fromStatus,
      toStatus: newStatus,
    });
  } catch (e) {
    logger.error('发布状态变更事件失败', e);
  }
}

// ============================================
// 检查清单管理
// ============================================

async function getChecklistStats(acceptanceId) {
  const [rows] = await db.execute(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN is_passed = 0 THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN is_passed IS NULL THEN 1 ELSE 0 END) as unchecked
     FROM asset_acceptance_checklist WHERE acceptance_id = ? AND is_deleted = 0`,
    [acceptanceId],
  );

  return {
    total: Number(rows[0]?.total || 0),
    passed: Number(rows[0]?.passed || 0),
    failed: Number(rows[0]?.failed || 0),
    unchecked: Number(rows[0]?.unchecked || 0),
  };
}

async function getChecklistDetail(acceptanceId) {
  const [checklist] = await db.execute(
    'SELECT * FROM asset_acceptance_checklist WHERE acceptance_id = ? AND is_deleted = 0 ORDER BY category, sort_order, id',
    [acceptanceId],
  );
  return checklist;
}

async function initChecklist(acceptanceId, tenantId) {
  // 检查是否已初始化
  const [existing] = await db.execute(
    'SELECT COUNT(*) as cnt FROM asset_acceptance_checklist WHERE acceptance_id = ? AND is_deleted = 0',
    [acceptanceId],
  );
  if (existing[0].cnt > 0) {
    throw Object.assign(new Error('检查清单已存在，请勿重复初始化'), { statusCode: 400 });
  }

  const [templates] = await db.execute(
    'SELECT category, item_name, item_description FROM asset_acceptance_templates WHERE (tenant_id = ? OR tenant_id IS NULL) AND is_enabled = 1 AND is_deleted = 0 ORDER BY sort_order, id',
    [tenantId],
  );

  for (const t of templates) {
    await db.execute(
      'INSERT INTO asset_acceptance_checklist (acceptance_id, tenant_id, category, item_name, item_description) VALUES (?, ?, ?, ?, ?)',
      [acceptanceId, tenantId, t.category, t.item_name, t.item_description],
    );
  }

  // 更新状态为验收中
  await db.execute(
    'UPDATE asset_acceptance_records SET status = "验收中", updated_at = NOW() WHERE id = ?',
    [acceptanceId],
  );

  return { count: templates.length };
}

async function updateChecklistItem(acceptanceId, checkId, { is_passed, remark }, checkedBy) {
  await db.execute(
    'UPDATE asset_acceptance_checklist SET is_passed = ?, remark = ?, checked_by = ?, checked_at = NOW() WHERE id = ? AND acceptance_id = ?',
    [is_passed, remark || null, checkedBy, checkId, acceptanceId],
  );
}

async function batchUpdateChecklist(acceptanceId, items, checkedBy) {
  for (const item of items) {
    await db.execute(
      'UPDATE asset_acceptance_checklist SET is_passed = ?, remark = ?, checked_by = ?, checked_at = NOW() WHERE id = ? AND acceptance_id = ?',
      [item.is_passed, item.remark || null, checkedBy, item.id, acceptanceId],
    );
  }
}

async function passAllChecklist(acceptanceId, checkedBy) {
  await db.execute(
    'UPDATE asset_acceptance_checklist SET is_passed = 1, checked_by = ?, checked_at = NOW() WHERE acceptance_id = ? AND is_passed IS NULL',
    [checkedBy, acceptanceId],
  );
  await db.execute(
    'UPDATE asset_acceptance_records SET status = "已验收", updated_at = NOW() WHERE id = ?',
    [acceptanceId],
  );
}

// ============================================
// 文件管理
// ============================================

async function addFiles(acceptanceId, tenantId, files, uploadedBy) {
  const filePromises = files.map(file =>
    db.execute(
      `INSERT INTO asset_acceptance_files
        (tenant_id, acceptance_id, file_type, file_name, file_path, file_size, mime_type, uploaded_by, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [tenantId, acceptanceId, file.fileType || '验收资料', file.originalname,
       file.path, file.size, file.mimetype, uploadedBy],
    ),
  );
  await Promise.all(filePromises);
}

async function getFiles(acceptanceId, tenantId) {
  const [files] = await db.execute(
    'SELECT * FROM asset_acceptance_files WHERE acceptance_id = ? AND tenant_id = ? AND is_deleted = 0 ORDER BY uploaded_at DESC',
    [acceptanceId, tenantId],
  );
  return files;
}

async function getFileById(fileId, tenantFilter) {
  const [rows] = await db.execute(
    `SELECT * FROM asset_acceptance_files WHERE id = ?${tenantFilter.whereClause} AND is_deleted = 0`,
    [fileId, ...tenantFilter.params],
  );
  return rows[0] || null;
}

async function deleteFile(fileId, tenantFilter, deletedBy = null) {
  const file = await getFileById(fileId, tenantFilter);
  if (!file) return false;

  // 异步删除物理文件（不阻塞响应）
  const fs = require('fs');
  try {
    await fs.promises.unlink(file.file_path);
  } catch (e) {
    logger.error('删除文件失败', e);
  }

  await db.execute(
    `UPDATE asset_acceptance_files SET is_deleted = 1, deleted_at = NOW(), deleted_by = ?
     WHERE id = ?${tenantFilter.whereClause} AND is_deleted = 0`,
    [deletedBy, fileId, ...tenantFilter.params],
  );
  return true;
}

// ============================================
// 资产查询
// ============================================

async function getAssetInfoByCode(code) {
  const [assets] = await db.execute(
    `SELECT id, asset_code, asset_name, brand, model, department_new, tenant_id
     FROM assets WHERE asset_code = ? LIMIT 1`,
    [code],
  );

  if (assets.length === 0) return null;

  const asset = assets[0];
  let departmentName = null;

  if (asset.department_new) {
    const [depts] = await db.execute(
      'SELECT department_name FROM departments WHERE department_code = ? AND tenant_id = ? LIMIT 1',
      [asset.department_new, asset.tenant_id],
    );
    if (depts.length > 0) {
      departmentName = depts[0].department_name;
    }
  }

  return {
    assetId: asset.id,
    assetCode: asset.asset_code,
    assetName: asset.asset_name,
    supplier: asset.brand ? `${asset.brand} ${asset.model || ''}`.trim() : null,
    department: departmentName,
  };
}

// ============================================
// 批量创建
// ============================================

async function batchCreateRecords(records, defaultData, tenantId, userId) {
  const results = [];
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const r = { ...defaultData, ...records[i] };

    if (!r.assetCode || !r.assetName || !r.acceptanceDate || !r.acceptancePerson || !r.department) {
      errors.push({ index: i, error: '缺少必填字段' });
      continue;
    }

    try {
      let actualAssetId = await resolveAssetByCode(r.assetCode, tenantId, r.assetId || null);

      const [insertResult] = await db.execute(
        `INSERT INTO asset_acceptance_records
          (tenant_id, asset_id, asset_code, asset_name, supplier, acceptance_date,
           acceptance_person, department, functional_department, status, remark,
           created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [tenantId, actualAssetId, r.assetCode, r.assetName, r.supplier || null,
         r.acceptanceDate, r.acceptancePerson, r.department, r.functionalDepartment || null,
         r.status || '待验收', r.remark || null, userId],
      );
      results.push({ id: insertResult.insertId, assetCode: r.assetCode });
    } catch (err) {
      errors.push({ index: i, assetCode: r.assetCode, error: err.message });
    }
  }

  return { results, errors };
}

// ============================================
// 内部辅助
// ============================================

async function resolveAssetByCode(assetCode, tenantId, fallbackId = null) {
  if (!assetCode) return fallbackId;
  const [rows] = await db.execute(
    'SELECT id FROM assets WHERE asset_code = ? AND tenant_id = ? LIMIT 1',
    [assetCode, tenantId],
  );
  return rows.length > 0 ? rows[0].id : fallbackId;
}

async function resolveAssetId(assetId, assetCode, tenantId) {
  if (!assetId) {
    return assetCode ? await resolveAssetByCode(assetCode, tenantId) : null;
  }
  const [rows] = await db.execute(
    'SELECT id FROM assets WHERE id = ? AND tenant_id = ? LIMIT 1',
    [assetId, tenantId],
  );
  if (rows.length > 0) return assetId;
  throw Object.assign(new Error('资产不存在'), { statusCode: 404 });
}

module.exports = {
  VALID_STATUSES,
  validateRecordInput,
  listRecords,
  getRecord,
  getRecordWithFiles,
  createRecord,
  updateRecord,
  deleteRecord,
  updateStatus,
  getChecklistStats,
  getChecklistDetail,
  initChecklist,
  updateChecklistItem,
  batchUpdateChecklist,
  passAllChecklist,
  addFiles,
  getFiles,
  getFileById,
  deleteFile,
  getAssetInfoByCode,
  batchCreateRecords,
};
