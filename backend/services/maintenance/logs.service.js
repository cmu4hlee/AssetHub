const fs = require('fs');
const path = require('path');
const db = require('../../config/database');
const { addTenantFilter, getTenantId } = require('../../middleware/tenant-filter');

// 构建附件 URL：在反代 / HTTPS 环境下正确返回外网可访问地址
// 优先级：FRONTEND_URL（同源部署时拼接相对路径）> PUBLIC_BASE_URL（专门配置附件域名）> req 信息（开发环境）
const buildAttachmentUrl = (req, logId, attachmentId) => {
  const apiPath = `/api/maintenance/logs/${logId}/attachments/${attachmentId}`;
  const feUrl = String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || process.env.BACKEND_PUBLIC_URL || '').replace(/\/+$/, '');

  // 同源部署：前端通过反代访问后端，使用前端域名拼接相对 API 路径
  if (feUrl) {
    try {
      const u = new URL(feUrl);
      return `${u.protocol}//${u.host}${apiPath}`;
    } catch (_e) { /* ignore */ }
  }
  // 独立的附件 CDN / 后端公网域名
  if (publicBaseUrl) {
    try {
      const u = new URL(publicBaseUrl);
      return `${u.protocol}//${u.host}${apiPath}`;
    } catch (_e) { /* ignore */ }
  }
  // 兜底：使用 req 信息（开发环境可用）
  const protocol = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = req.get('host') || `${req.headers['x-forwarded-host'] || ''}`.split(',')[0].trim() || `${req.hostname || 'localhost'}`;
  return `${protocol}://${host}${apiPath}`;
};

let iconv = null;
try {
  // 可选依赖：不存在时回退到 UTF-8 修复策略
  iconv = require('iconv-lite');
} catch (error) {
  iconv = null;
}

const MAINTENANCE_TYPE_MAP = {
  定期维护: '定期保养',
  故障维修: '故障维修',
  预防性维护: '预防性维护',
  日常维护: '日常维护',
  定期保养: '定期保养',
  临时保养: '临时保养',
  其他: '其他',
};
const VALID_MAINTENANCE_TYPES = new Set(['日常维护', '预防性维护', '故障维修', '定期保养', '临时保养', '其他']);

const LOG_STATUS_MAP = {
  待分配: '进行中',
  已分配: '进行中',
  进行中: '进行中',
  已完成: '已完成',
  已取消: '已取消',
};
const VALID_LOG_STATUS = new Set(['已完成', '进行中', '已取消']);

function normalizeMaintenanceType(value) {
  if (!value) return '其他';
  const raw = String(value).trim();
  return MAINTENANCE_TYPE_MAP[raw] || (VALID_MAINTENANCE_TYPES.has(raw) ? raw : '其他');
}

function normalizeLogStatus(value) {
  if (value === undefined || value === null || value === '') return '已完成';
  const raw = String(value).trim();
  return LOG_STATUS_MAP[raw] || (VALID_LOG_STATUS.has(raw) ? raw : '已完成');
}

function resolveAttachmentPath(filePath) {
  return path.join(__dirname, '../..', filePath);
}

async function getLogs(query, req) {
  const {
    page = 1,
    pageSize = 20,
    asset_code,
    maintenance_type,
    status,
    start_date,
    end_date,
    keyword,
  } = query;

  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  const params = [];

  const tenantFilter = addTenantFilter(req, 'ml');
  whereClause += tenantFilter.whereClause;
  params.push(...tenantFilter.params);

  if (req.user.role !== 'super_admin' && req.user.role !== 'system_admin') {
    if (
      req.user.managed_departments &&
      Array.isArray(req.user.managed_departments) &&
      req.user.managed_departments.length > 0
    ) {
      try {
        if (!req.user.managed_departments.includes('*')) {
          const placeholders = req.user.managed_departments.map(() => '?').join(',');
          const currentTenantId = getTenantId(req);
          const [deptRows] = await db.execute(
            `SELECT department_name FROM departments WHERE department_code IN (${placeholders}) AND tenant_id = ?`,
            [...req.user.managed_departments, currentTenantId],
          );

          const deptNames = deptRows.map(row => row.department_name);

          if (deptNames.length > 0) {
            const deptPlaceholders = deptNames.map(() => '?').join(',');
            whereClause += ` AND EXISTS (
              SELECT 1 FROM assets a
              WHERE a.asset_code = ml.asset_code
              AND a.tenant_id = ml.tenant_id
              AND (a.department IN (${deptPlaceholders}) OR a.department_new IN (${deptPlaceholders}))
            )`;
            params.push(...deptNames, ...deptNames);
          }
        }
      } catch (deptError) {
        console.error('查询管理科室失败:', deptError);
      }
    }
  }

  if (asset_code) {
    whereClause += ' AND ml.asset_code LIKE ?';
    params.push(`%${asset_code}%`);
  }
  if (maintenance_type) {
    whereClause += ' AND ml.maintenance_type = ?';
    params.push(maintenance_type);
  }
  if (status) {
    whereClause += ' AND ml.status = ?';
    params.push(status);
  }
  if (start_date) {
    whereClause += ' AND ml.maintenance_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND ml.maintenance_date <= ?';
    params.push(end_date);
  }
  if (keyword) {
    whereClause += ' AND (ml.asset_code LIKE ? OR ml.asset_name LIKE ? OR ml.maintenance_person LIKE ?)';
    const keywordParam = `%${keyword}%`;
    params.push(keywordParam, keywordParam, keywordParam);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM maintenance_logs ml ${whereClause}`,
    params,
  );
  const {total} = countResult[0];

  const [rows] = await db.execute(
    `SELECT ml.*, a.department, a.location
     FROM maintenance_logs ml
     LEFT JOIN assets a ON ml.asset_code = a.asset_code AND a.tenant_id = ml.tenant_id AND a.is_deleted = 0
     ${whereClause}
     ORDER BY ml.maintenance_date DESC, ml.created_at DESC
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

async function createLog(body, req) {
  let {
    asset_code,
    maintenance_type,
    maintenance_date,
    maintenance_person,
    maintenance_content,
    maintenance_cost,
    parts_replaced,
    next_maintenance_date,
    status,
    remark,
    maintenance_duration,
    maintenance_location,
    maintenance_method,
    supplier_name,
    warranty_info,
    quality_check,
    quality_check_person,
    quality_check_date,
    source_type,
    source_id,
    work_order_id,
    work_order_no,
    other_cost,
  } = body;

  if (!asset_code || !maintenance_type || !maintenance_date || !maintenance_person) {
    return {
      statusCode: 400,
      body: { success: false, message: '资产编号、维护类型、维护日期和维护人员不能为空' },
    };
  }

  maintenance_type = normalizeMaintenanceType(String(maintenance_type).trim());
  status = normalizeLogStatus(status);
  if (maintenance_date && typeof maintenance_date === 'object' && maintenance_date.format) {
    maintenance_date = maintenance_date.format('YYYY-MM-DD');
  } else if (maintenance_date) {
    maintenance_date = String(maintenance_date).slice(0, 10);
  }
  if (next_maintenance_date && typeof next_maintenance_date === 'object' && next_maintenance_date.format) {
    next_maintenance_date = next_maintenance_date.format('YYYY-MM-DD');
  } else if (next_maintenance_date) {
    next_maintenance_date = String(next_maintenance_date).slice(0, 10);
  }

  const assetTenantFilter = addTenantFilter(req, 'a');
  const [assets] = await db.execute(
    `SELECT a.id, a.asset_code, a.asset_name, a.tenant_id FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
    [asset_code, ...assetTenantFilter.params],
  );

  // 软校验: DB 中已有 18+ 个 orphan 维修日志 (asset_code 引用了已删除资产) -
  // 维修日志是有意保留历史的, asset_code 字符串无 FK. 不阻断创建, 用占位名.
  let asset;
  if (assets.length > 0) {
    asset = assets[0];
  } else {
    console.warn(
      `[createLog] asset_code="${asset_code}" 在 tenant ${req.user?.tenant_id || '?'} 下未找到, 创建 orphan 维修日志 (历史记录保留)`,
    );
    asset = {
      id: null,
      asset_code,
      asset_name: body.asset_name || `已删除资产(${asset_code})`,
      tenant_id: getTenantId(req) || req.user?.tenant_id,
    };
  }
  const createdBy = req.user.real_name || req.user.username || '系统管理员';
  const tenantId =
    req.user.role === 'super_admin' ? asset.tenant_id || getTenantId(req) : getTenantId(req);

  // BUG-L1 修复：INSERT 维护日志 + UPDATE 资产状态 使用事务包裹，确保数据一致性
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO maintenance_logs (
        tenant_id, asset_code, asset_name, maintenance_type, maintenance_method,
        maintenance_date, maintenance_person, maintenance_location,
        maintenance_content, maintenance_cost, maintenance_duration,
        supplier_name, parts_replaced, warranty_info,
        next_maintenance_date, status,
        quality_check, quality_check_person, quality_check_date,
        remark, source_type, source_id, work_order_id, work_order_no, other_cost, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        asset.asset_code,
        asset.asset_name,
        maintenance_type,
        maintenance_method || null,
        maintenance_date,
        maintenance_person,
        maintenance_location || null,
        maintenance_content || null,
        maintenance_cost || 0,
        maintenance_duration || null,
        supplier_name || null,
        parts_replaced || null,
        warranty_info || null,
        next_maintenance_date || null,
        status,
        quality_check || '待检查',
        quality_check_person || null,
        quality_check_date || null,
        remark || null,
        source_type || 'manual',
        source_id || null,
        work_order_id || null,
        work_order_no || null,
        other_cost || 0,
        createdBy,
      ],
    );

    if (maintenance_type === '故障维修' && status === '进行中') {
      await connection.execute(
        `UPDATE assets a SET a.status = ?
         WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
        ['维修', asset_code, ...assetTenantFilter.params],
      );
    }

    await connection.commit();

    return {
      statusCode: 200,
      body: {
        success: true,
        message: '维护日志创建成功',
        data: { id: result.insertId },
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateLog(id, body, req) {
  const {
    maintenance_type,
    maintenance_date,
    maintenance_person,
    maintenance_content,
    maintenance_cost,
    parts_replaced,
    next_maintenance_date,
    status,
    remark,
    maintenance_duration,
    maintenance_location,
    maintenance_method,
    supplier_name,
    warranty_info,
    quality_check,
    quality_check_person,
    quality_check_date,
    source_type,
    source_id,
    work_order_id,
    work_order_no,
    other_cost,
  } = body;

  const updateFields = [];
  const updateValues = [];

  if (maintenance_type !== undefined) {
    updateFields.push('maintenance_type = ?');
    updateValues.push(normalizeMaintenanceType(String(maintenance_type).trim()));
  }
  if (maintenance_date !== undefined) {
    const d = maintenance_date;
    const dateStr = d && typeof d === 'object' && d.format ? d.format('YYYY-MM-DD') : String(d).slice(0, 10);
    updateFields.push('maintenance_date = ?');
    updateValues.push(dateStr);
  }
  if (maintenance_person !== undefined) {
    updateFields.push('maintenance_person = ?');
    updateValues.push(maintenance_person);
  }
  if (maintenance_content !== undefined) {
    updateFields.push('maintenance_content = ?');
    updateValues.push(maintenance_content);
  }
  if (maintenance_cost !== undefined) {
    updateFields.push('maintenance_cost = ?');
    updateValues.push(maintenance_cost);
  }
  if (parts_replaced !== undefined) {
    updateFields.push('parts_replaced = ?');
    updateValues.push(parts_replaced);
  }
  if (next_maintenance_date !== undefined) {
    updateFields.push('next_maintenance_date = ?');
    updateValues.push(next_maintenance_date);
  }
  if (status !== undefined) {
    updateFields.push('status = ?');
    updateValues.push(normalizeLogStatus(String(status).trim()));
  }
  if (remark !== undefined) {
    updateFields.push('remark = ?');
    updateValues.push(remark);
  }
  if (maintenance_duration !== undefined) {
    updateFields.push('maintenance_duration = ?');
    updateValues.push(maintenance_duration);
  }
  if (maintenance_location !== undefined) {
    updateFields.push('maintenance_location = ?');
    updateValues.push(maintenance_location);
  }
  if (maintenance_method !== undefined) {
    updateFields.push('maintenance_method = ?');
    updateValues.push(maintenance_method);
  }
  if (supplier_name !== undefined) {
    updateFields.push('supplier_name = ?');
    updateValues.push(supplier_name);
  }
  if (warranty_info !== undefined) {
    updateFields.push('warranty_info = ?');
    updateValues.push(warranty_info);
  }
  if (quality_check !== undefined) {
    updateFields.push('quality_check = ?');
    updateValues.push(quality_check);
  }
  if (quality_check_person !== undefined) {
    updateFields.push('quality_check_person = ?');
    updateValues.push(quality_check_person);
  }
  if (quality_check_date !== undefined) {
    updateFields.push('quality_check_date = ?');
    updateValues.push(quality_check_date);
  }
  if (source_type !== undefined) {
    updateFields.push('source_type = ?');
    updateValues.push(source_type);
  }
  if (source_id !== undefined) {
    updateFields.push('source_id = ?');
    updateValues.push(source_id);
  }
  if (work_order_id !== undefined) {
    updateFields.push('work_order_id = ?');
    updateValues.push(work_order_id);
  }
  if (work_order_no !== undefined) {
    updateFields.push('work_order_no = ?');
    updateValues.push(work_order_no);
  }
  if (other_cost !== undefined) {
    updateFields.push('other_cost = ?');
    updateValues.push(other_cost);
  }

  if (updateFields.length === 0) {
    return {
      statusCode: 400,
      body: { success: false, message: '没有要更新的字段' },
    };
  }

  const tenantFilter = addTenantFilter(req, 'ml');
  const [existing] = await db.execute(
    `SELECT id, maintenance_type, status, asset_code FROM maintenance_logs ml WHERE ml.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (existing.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '维护日志不存在' },
    };
  }

  const oldLog = existing[0];
  const newStatus = status !== undefined ? normalizeLogStatus(String(status).trim()) : oldLog.status;

  updateFields.push('updated_at = NOW()');
  updateValues.push(id);

  await db.execute(
    `UPDATE maintenance_logs ml SET ${updateFields.join(', ')} WHERE ml.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
    [...updateValues, ...tenantFilter.params],
  );

  // BUG-L2 修复：故障维修日志从"进行中"变为"已完成"或"已取消"时，恢复资产状态为"在用"
  const maintenanceTypeForCheck = maintenance_type !== undefined
    ? normalizeMaintenanceType(String(maintenance_type).trim())
    : oldLog.maintenance_type;

  if (maintenanceTypeForCheck === '故障维修'
      && oldLog.status === '进行中'
      && newStatus !== '进行中'
      && oldLog.asset_code) {
    const assetTenantFilter = addTenantFilter(req, 'a');
    await db.execute(
      `UPDATE assets a SET a.status = ?
       WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
      ['在用', oldLog.asset_code, ...assetTenantFilter.params],
    );
  }

  return {
    statusCode: 200,
    body: { success: true, message: '维护日志更新成功' },
  };
}

async function deleteLog(id, req) {
  const tenantFilter = addTenantFilter(req, 'ml');
  const [existing] = await db.execute(
    `SELECT id FROM maintenance_logs ml WHERE ml.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (existing.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '维护日志不存在' },
    };
  }

  const [result] = await db.execute(
    `DELETE ml FROM maintenance_logs ml WHERE ml.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
    [id, ...tenantFilter.params],
  );

  if (result.affectedRows === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '维护日志不存在' },
    };
  }

  return {
    statusCode: 200,
    body: { success: true, message: '维护日志删除成功' },
  };
}

async function getLogById(id, req) {
  const tenantFilter = addTenantFilter(req, 'ml');
  const [rows] = await db.execute(
    `SELECT ml.*, a.department, a.location, a.brand, a.model
     FROM maintenance_logs ml
     LEFT JOIN assets a ON ml.asset_code = a.asset_code AND a.tenant_id = ml.tenant_id AND a.is_deleted = 0
     WHERE ml.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (rows.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '维护日志不存在' },
    };
  }

  return {
    statusCode: 200,
    body: { success: true, data: rows[0] },
  };
}

async function getStatistics(query, req) {
  const { asset_code, start_date, end_date, selectedDepartmentId } = query;

  let whereClause = 'WHERE 1=1';
  const params = [];

  const tenantFilter = addTenantFilter(req, 'ml');
  whereClause += tenantFilter.whereClause;
  params.push(...tenantFilter.params);

  let departmentFilter = '';
  const departmentParams = [];

  if (selectedDepartmentId && !isNaN(parseInt(selectedDepartmentId, 10))) {
    if (req.user.role === 'system_admin' || req.user.role === 'asset_admin') {
      const [dept] = await db.execute(
        'SELECT department_name FROM departments WHERE id = ? AND tenant_id = ?',
        [selectedDepartmentId, getTenantId(req)],
      );
      if (dept.length > 0) {
        departmentFilter = ` AND EXISTS (
          SELECT 1 FROM assets a
          WHERE a.asset_code = ml.asset_code
          AND a.department = ?
        )`;
        departmentParams.push(dept[0].department_name);
      } else {
        return { success: true, data: {} };
      }
    } else if (req.user.role === 'department_admin') {
      if (
        req.user.managed_departments &&
        req.user.managed_departments.includes(parseInt(selectedDepartmentId, 10))
      ) {
        const [dept] = await db.execute(
          'SELECT department_name FROM departments WHERE id = ? AND tenant_id = ?',
          [selectedDepartmentId, getTenantId(req)],
        );
        if (dept.length > 0) {
          departmentFilter = ` AND EXISTS (
            SELECT 1 FROM assets a
            WHERE a.asset_code = ml.asset_code
            AND a.department = ?
          )`;
          departmentParams.push(dept[0].department_name);
        } else {
          return { success: true, data: {} };
        }
      } else {
        return { success: true, data: {} };
      }
    } else {
      return { success: true, data: {} };
    }
  } else if (req.user.role !== 'system_admin' && req.user.role !== 'asset_admin') {
    if (
      req.user.managed_departments &&
      Array.isArray(req.user.managed_departments) &&
      req.user.managed_departments.length > 0
    ) {
      try {
        const placeholders = req.user.managed_departments.map(() => '?').join(',');
        const [deptRows] = await db.execute(
          `SELECT department_name FROM departments WHERE id IN (${placeholders}) AND tenant_id = ?`,
          [...req.user.managed_departments, getTenantId(req)],
        );

        if (deptRows.length > 0) {
          const deptNames = deptRows.map(row => row.department_name);
          const deptPlaceholders = deptNames.map(() => '?').join(',');
          departmentFilter = ` AND EXISTS (
            SELECT 1 FROM assets a
            WHERE a.asset_code = ml.asset_code
            AND a.department IN (${deptPlaceholders})
          )`;
          departmentParams.push(...deptNames);
        } else {
          return { success: true, data: {} };
        }
      } catch (deptError) {
        console.error('获取管理科室名称失败:', deptError);
        return { success: true, data: {} };
      }
    } else {
      return { success: true, data: {} };
    }
  }

  whereClause += departmentFilter;
  params.push(...departmentParams);

  if (asset_code) {
    whereClause += ' AND ml.asset_code = ?';
    params.push(asset_code);
  }
  if (start_date) {
    whereClause += ' AND ml.maintenance_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND ml.maintenance_date <= ?';
    params.push(end_date);
  }

  const [stats] = await db.execute(
    `SELECT
      COUNT(*) as total_count,
      SUM(maintenance_cost) as total_cost,
      COUNT(CASE WHEN maintenance_type = '故障维修' THEN 1 END) as fault_repair_count,
      COUNT(CASE WHEN maintenance_type = '预防性维护' THEN 1 END) as preventive_count,
      COUNT(CASE WHEN maintenance_type = '日常维护' THEN 1 END) as routine_count,
      COUNT(CASE WHEN status = '已完成' THEN 1 END) as completed_count,
      COUNT(CASE WHEN status = '进行中' THEN 1 END) as in_progress_count
     FROM maintenance_logs ml
     ${whereClause}`,
    params,
  );

  return { success: true, data: stats[0] || {} };
}

async function getAttachments(logId, req) {
  const tenantFilter = addTenantFilter(req, 'ml');
  const [rows] = await db.execute(
    `SELECT mla.*
     FROM maintenance_log_attachments mla
     INNER JOIN maintenance_logs ml ON ml.id = mla.maintenance_log_id
     WHERE mla.maintenance_log_id = ? ${tenantFilter.whereClause}
     ORDER BY mla.upload_date DESC`,
    [logId, ...tenantFilter.params],
  );

  const attachments = rows.map(attachment => ({
    ...attachment,
    file_url: `${buildAttachmentUrl(req, logId, attachment.id)}`,
  }));

  return { success: true, data: attachments };
}

async function uploadAttachment(logId, req) {
  const tenantFilter = addTenantFilter(req, 'ml');
  const [logs] = await db.execute(
    `SELECT ml.id FROM maintenance_logs ml WHERE ml.id = ? ${tenantFilter.whereClause}`,
    [logId, ...tenantFilter.params],
  );
  if (logs.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '维护日志不存在' },
    };
  }

  if (!req.file) {
    return {
      statusCode: 400,
      body: { success: false, message: '请选择要上传的文件' },
    };
  }

  const { file } = req;
  let fileName = null;

  if (req.parsedFileName) {
    fileName = req.parsedFileName;
  } else {
    fileName = file.originalname;

    if (typeof file.originalname === 'string' && !/[\u4e00-\u9fa5]/.test(file.originalname)) {
      try {
        const latin1Buffer = Buffer.from(file.originalname, 'latin1');
        const utf8Decoded = latin1Buffer.toString('utf8');
        const chineseMatch = utf8Decoded.match(/[\u4e00-\u9fa5]+/g);

        if (chineseMatch && chineseMatch.length > 0) {
          const replacementCount = (utf8Decoded.match(/\uFFFD/g) || []).length;
          const replacementRatio = replacementCount / utf8Decoded.length;
          if (replacementRatio < 0.3) {
            fileName = utf8Decoded;
          }
        }

        if (!/[\u4e00-\u9fa5]/.test(fileName) && iconv) {
          const encodings = ['gbk', 'gb2312', 'gb18030'];
          for (const encoding of encodings) {
            try {
              const decoded = iconv.decode(latin1Buffer, encoding);
              if (/[\u4e00-\u9fa5]/.test(decoded)) {
                fileName = decoded;
                break;
              }
            } catch (error) {
              // ignore and continue
            }
          }
        }
      } catch (error) {
        console.error('[附件上传] 编码修复失败:', error);
      }
    }
  }

  if (!fileName) {
    fileName = file.originalname;
  }

  const uploadedBy = req.user.real_name || req.user.username || '系统管理员';
  const filePath = `/uploads/maintenance-attachments/${file.filename}`;
  const fileUrl = `${req.protocol}://${req.get('host')}${filePath}`;
  // BUG-L5 修复：INSERT 时包含 tenant_id 字段，确保多租户数据完整性
  const attachmentTenantId = getTenantId(req);

  const [result] = await db.execute(
    `INSERT INTO maintenance_log_attachments
      (tenant_id, maintenance_log_id, file_name, file_path, file_type, file_size, uploaded_by, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [attachmentTenantId, logId, fileName, filePath, file.mimetype, file.size, uploadedBy, null],
  );

  return {
    statusCode: 200,
    body: {
      success: true,
      message: '附件上传成功',
      data: {
        id: result.insertId,
        file_name: fileName,
        file_path: filePath,
        file_url: fileUrl,
        file_type: file.mimetype,
        file_size: file.size,
        uploaded_by: uploadedBy,
        upload_date: new Date().toISOString(),
      },
    },
  };
}

async function getAttachment(logId, attachmentId, req) {
  const tenantFilter = addTenantFilter(req, 'ml');
  const [attachments] = await db.execute(
    `SELECT mla.*
     FROM maintenance_log_attachments mla
     INNER JOIN maintenance_logs ml ON ml.id = mla.maintenance_log_id
     WHERE mla.id = ? AND mla.maintenance_log_id = ? ${tenantFilter.whereClause}`,
    [attachmentId, logId, ...tenantFilter.params],
  );

  if (attachments.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '附件不存在' },
    };
  }

  const attachment = attachments[0];
  const filePath = resolveAttachmentPath(attachment.file_path);

  if (!fs.existsSync(filePath)) {
    return {
      statusCode: 404,
      body: { success: false, message: '文件不存在' },
    };
  }

  return {
    statusCode: 200,
    data: {
      attachment,
      filePath,
    },
  };
}

async function deleteAttachment(logId, attachmentId, req) {
  const tenantFilter = addTenantFilter(req, 'ml');
  const [attachments] = await db.execute(
    `SELECT mla.*
     FROM maintenance_log_attachments mla
     INNER JOIN maintenance_logs ml ON ml.id = mla.maintenance_log_id
     WHERE mla.id = ? AND mla.maintenance_log_id = ? ${tenantFilter.whereClause}`,
    [attachmentId, logId, ...tenantFilter.params],
  );

  if (attachments.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '附件不存在' },
    };
  }

  const attachment = attachments[0];
  const filePath = resolveAttachmentPath(attachment.file_path);

  await db.execute('DELETE FROM maintenance_log_attachments WHERE id = ? AND maintenance_log_id = ?', [
    attachmentId,
    logId,
  ]);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error(`删除文件失败: ${filePath}`, error);
    }
  }

  return {
    statusCode: 200,
    body: { success: true, message: '附件删除成功' },
  };
}

module.exports = {
  getLogs,
  createLog,
  updateLog,
  deleteLog,
  getLogById,
  getStatistics,
  getAttachments,
  uploadAttachment,
  getAttachment,
  deleteAttachment,
};
