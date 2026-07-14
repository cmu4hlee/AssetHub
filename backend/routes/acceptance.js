const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// 验收模块权限集合
const AC_GET_ROLES = ['acceptance.view', 'asset.view_all', 'asset.view_own_department', 'maintenance.view'];
const AC_WRITE_ROLES = ['acceptance.add', 'acceptance.edit', 'asset.edit_all', 'asset.edit_own_department'];
const AC_APPROVE_ROLES = ['acceptance.approve', 'acceptance.add', 'asset.edit_all'];
const { addTenantFilter, getTenantId, requireTenantId } = require('../middleware/tenant-filter');
const { fileSecurity } = require('../middleware/fileSecurity');
const { TransactionManager } = require('../utils/error-handler');

// 生成唯一ID的函数
const generateUniqueId = () => {
  return crypto.randomBytes(16).toString('hex');
};

// 模拟logger对象
const logger = {
  error: (message, error) => {
    console.error(`[ERROR] ${message}:`, error);
  },
  info: message => {
    console.log(`[INFO] ${message}`);
  },
};

const resolveTenantFilter = (req, res) => {
  try {
    return addTenantFilter(req);
  } catch (error) {
    if (error.message === 'MISSING_TENANT_ID') {
      res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
      return null;
    }
    if (error.message === 'INVALID_TENANT_ID') {
      res.status(400).json({ success: false, message: '无效的企业空间ID' });
      return null;
    }
    throw error;
  }
};

async function hasTenantAsset(assetId, tenantId, executor = db) {
  if (assetId === undefined || assetId === null || assetId === '') {
    return false;
  }

  const [rows] = await executor.execute(
    'SELECT id FROM assets WHERE id = ? AND tenant_id = ? LIMIT 1',
    [assetId, tenantId],
  );
  return rows.length > 0;
}

// 验收状态选项
const VALID_ACCEPTANCE_STATUSES = ['待验收', '验收中', '已验收', '验收不合格'];

async function getChecklistStats(acceptanceId) {
  const [rows] = await db.execute(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN is_passed = 0 THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN is_passed IS NULL THEN 1 ELSE 0 END) as unchecked
     FROM asset_acceptance_checklist WHERE acceptance_id = ?`,
    [acceptanceId],
  );

  return {
    total: Number(rows[0].total || 0),
    passed: Number(rows[0].passed || 0),
    failed: Number(rows[0].failed || 0),
    unchecked: Number(rows[0].unchecked || 0),
  };
}

async function getAcceptanceStatusBlocker(acceptanceId, status) {
  if (!VALID_ACCEPTANCE_STATUSES.includes(status)) {
    return `状态必须是[${VALID_ACCEPTANCE_STATUSES.join(', ')}]之一`;
  }

  if (status !== '已验收') {
    return null;
  }

  const stats = await getChecklistStats(acceptanceId);
  if (stats.total === 0) {
    return '请先初始化并完成验收检查清单';
  }
  if (stats.unchecked > 0) {
    return `仍有 ${stats.unchecked} 个检查项未检查，不能标记为已验收`;
  }
  if (stats.failed > 0) {
    return `存在 ${stats.failed} 个不通过检查项，不能标记为已验收`;
  }

  return null;
}

/**
 * 验证验收记录输入数据
 * @param {Object} data 输入数据
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateAcceptanceInput(data) {
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
    if (!VALID_ACCEPTANCE_STATUSES.includes(data.status)) {
      errors.push(`状态必须是[${VALID_ACCEPTANCE_STATUSES.join(', ')}]之一`);
    }
  }

  if (data.remark !== undefined && data.remark !== null) {
    if (typeof data.remark !== 'string' || data.remark.length > 500) {
      errors.push('备注格式不正确（最长500字符）');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads/acceptance');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage });

// ============================================
// 资产验收管理 API
// ============================================

// 获取验收记录列表
router.get('/records', authenticate, authorize(AC_GET_ROLES), async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status, assetCode, assetName, department } = req.query;
    const pageNum = Number.parseInt(page, 10) || 1;
    const pageSizeNum = Number.parseInt(pageSize, 10) || 10;
    const offset = (pageNum - 1) * pageSizeNum;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    let departmentScopeClause = '';
    let departmentScopeParams = [];

    // 根据用户的管理科室过滤验收记录
    // 系统管理员可以看到所有验收记录
    if (req.user.role !== 'system_admin' && req.user.role !== 'super_admin') {
      if (
        req.user.managed_departments &&
        Array.isArray(req.user.managed_departments) &&
        req.user.managed_departments.length > 0
      ) {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
        }

        const placeholders = req.user.managed_departments.map(() => '?').join(',');
        departmentScopeClause = ` AND (department IN (
          SELECT department_name FROM departments WHERE tenant_id = ? AND department_code IN (${placeholders})
        ) OR functional_department IN (
          SELECT department_name FROM departments WHERE tenant_id = ? AND department_code IN (${placeholders})
        ))`;
        departmentScopeParams = [
          tenantId,
          ...req.user.managed_departments,
          tenantId,
          ...req.user.managed_departments,
        ];
      } else {
        // 非系统管理员但没有管理科室，返回空结果
        return res.json({
          success: true,
          data: {
            records: [],
            pagination: {
              total: 0,
              page: pageNum,
              pageSize: pageSizeNum,
              totalPages: 0,
            },
          },
        });
      }
    }

    let filterClause = '';
    const filterParams = [];

    if (status) {
      filterClause += ' AND status = ?';
      filterParams.push(status);
    }

    if (assetCode) {
      filterClause += ' AND asset_code LIKE ?';
      filterParams.push(`%${assetCode}%`);
    }

    if (assetName) {
      filterClause += ' AND asset_name LIKE ?';
      filterParams.push(`%${assetName}%`);
    }

    if (department) {
      filterClause += ' AND department LIKE ?';
      filterParams.push(`%${department}%`);
    }

    const baseWhere = `WHERE 1=1${tenantFilter.whereClause}${departmentScopeClause}${filterClause}`;

    const query = `SELECT * FROM asset_acceptance_records ${baseWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const params = [...tenantFilter.params, ...departmentScopeParams, ...filterParams, pageSizeNum, offset];

    const [records] = await db.execute(query, params);

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM asset_acceptance_records ${baseWhere}`;
    const countParams = [...tenantFilter.params, ...departmentScopeParams, ...filterParams];

    const [totalResult] = await db.execute(countQuery, countParams);
    const total = totalResult[0]?.total || 0;

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          total,
          page: pageNum,
          pageSize: pageSizeNum,
          totalPages: Math.ceil(total / pageSizeNum),
        },
      },
    });
  } catch (error) {
    logger.error('获取验收记录列表失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取验收记录详情
router.get('/records/:id', authenticate, authorize(AC_GET_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    // 先获取验收记录
    const [record] = await db.execute(
      `SELECT * FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (record.length === 0) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    const acceptanceRecord = record[0];

    // 权限检查：非系统管理员只能查看自己管理科室的验收记录
    if (req.user.role !== 'system_admin' && req.user.role !== 'super_admin') {
      if (
        req.user.managed_departments &&
        Array.isArray(req.user.managed_departments) &&
        req.user.managed_departments.length > 0
      ) {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
        }

        // 获取用户管理的科室名称
        const placeholders = req.user.managed_departments.map(() => '?').join(',');
        const [deptRows] = await db.execute(
          `SELECT department_name FROM departments WHERE tenant_id = ? AND department_code IN (${placeholders})`,
          [tenantId, ...req.user.managed_departments],
        );

        const managedDeptNames = deptRows.map(row => row.department_name);

        // 检查验收记录的科室是否在用户管理的科室列表中
        if (
          !managedDeptNames.includes(acceptanceRecord.department) &&
          !managedDeptNames.includes(acceptanceRecord.functional_department)
        ) {
          return res
            .status(403)
            .json({ success: false, message: '权限不足，只能查看自己管理科室的验收记录' });
        }
      } else {
        return res.status(403).json({ success: false, message: '权限不足，用户未分配管理科室' });
      }
    }

    // 获取关联文件
    const [files] = await db.execute(
      'SELECT * FROM asset_acceptance_files WHERE acceptance_id = ? AND tenant_id = ?',
      [id, acceptanceRecord.tenant_id],
    );

    res.json({
      success: true,
      data: {
        record: acceptanceRecord,
        files,
      },
    });
  } catch (error) {
    logger.error('获取验收记录详情失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 创建验收记录
router.post('/records', authenticate, requireTenantId, authorize(AC_WRITE_ROLES), async (req, res) => {
  try {
    const {
      assetId,
      assetCode,
      assetName,
      supplier,
      acceptanceDate,
      acceptancePerson,
      department,
      functionalDepartment,
      status = '待验收',
      remark,
    } = req.body;

    // 验证必填字段
    if (!assetCode || !assetName || !acceptanceDate || !acceptancePerson || !department) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
    }

    // 验证输入数据
    const validation = validateAcceptanceInput({
      assetCode,
      assetName,
      supplier,
      acceptanceDate,
      acceptancePerson,
      department,
      functionalDepartment,
      status,
      remark,
    });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.errors.join('; ') });
    }

    // 验证资产是否存在（如果提供了资产ID或资产编号）
    let actualAssetId = assetId;
    if (assetId !== undefined && assetId !== null && assetId !== '') {
      if (!(await hasTenantAsset(assetId, tenantId))) {
        return res.status(404).json({ success: false, message: '资产不存在' });
      }
    } else if (assetCode) {
      // 通过资产编号查询资产ID
      const [assetRows] = await db.execute(
        'SELECT id FROM assets WHERE asset_code = ? AND tenant_id = ? LIMIT 1',
        [assetCode, tenantId],
      );
      if (assetRows.length > 0) {
        actualAssetId = assetRows[0].id;
      }
    }

    // 权限检查：非系统管理员只能创建自己管理科室的验收记录
    if (req.user.role !== 'system_admin' && req.user.role !== 'super_admin') {
      if (
        req.user.managed_departments &&
        Array.isArray(req.user.managed_departments) &&
        req.user.managed_departments.length > 0
      ) {
        // 获取用户管理的科室名称
        const placeholders = req.user.managed_departments.map(() => '?').join(',');
        const [deptRows] = await db.execute(
          `SELECT department_name FROM departments WHERE tenant_id = ? AND department_code IN (${placeholders})`,
          [tenantId, ...req.user.managed_departments],
        );

        const managedDeptNames = deptRows.map(row => row.department_name);

        // 检查验收记录的科室是否在用户管理的科室列表中
        if (
          !managedDeptNames.includes(department) &&
          (!functionalDepartment || !managedDeptNames.includes(functionalDepartment))
        ) {
          return res
            .status(403)
            .json({ success: false, message: '权限不足，只能创建自己管理科室的验收记录' });
        }
      } else {
        return res.status(403).json({ success: false, message: '权限不足，用户未分配管理科室' });
      }
    }

    // 使用事务创建验收记录
    const result = await TransactionManager.executeTransaction(async connection => {
      const [insertResult] = await connection.execute(
        'INSERT INTO asset_acceptance_records (tenant_id, asset_id, asset_code, asset_name, supplier, acceptance_date, acceptance_person, department, functional_department, status, remark, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [
          tenantId,
          actualAssetId,
          assetCode,
          assetName,
          supplier,
          acceptanceDate,
          acceptancePerson,
          department,
          functionalDepartment,
          status,
          remark,
          req.user.username,
        ],
      );
      return insertResult;
    });

    res.json({
      success: true,
      data: {
        id: result.insertId,
        assetId,
        assetCode,
        assetName,
        supplier,
        acceptanceDate,
        acceptancePerson,
        department,
        functionalDepartment,
        status,
        remark,
      },
    });
  } catch (error) {
    logger.error('创建验收记录失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 更新验收记录
router.put('/records/:id', authenticate, authorize(AC_WRITE_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;
    const {
      assetId,
      assetCode,
      assetName,
      supplier,
      acceptanceDate,
      acceptancePerson,
      department,
      functionalDepartment,
      status,
      remark,
    } = req.body;

    // 验证记录是否存在
    const [existingRecord] = await db.execute(
      `SELECT * FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (existingRecord.length === 0) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    const oldRecord = existingRecord[0];
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
    }

    if (assetId !== undefined && assetId !== null && assetId !== '') {
      if (!(await hasTenantAsset(assetId, tenantId))) {
        return res.status(404).json({ success: false, message: '资产不存在' });
      }
    }

    // 权限检查：非系统管理员只能更新自己管理科室的验收记录
    if (req.user.role !== 'system_admin' && req.user.role !== 'super_admin') {
      if (
        req.user.managed_departments &&
        Array.isArray(req.user.managed_departments) &&
        req.user.managed_departments.length > 0
      ) {
        // 获取用户管理的科室名称
        const placeholders = req.user.managed_departments.map(() => '?').join(',');
        const [deptRows] = await db.execute(
          `SELECT department_name FROM departments WHERE tenant_id = ? AND department_code IN (${placeholders})`,
          [tenantId, ...req.user.managed_departments],
        );

        const managedDeptNames = deptRows.map(row => row.department_name);

        // 检查验收记录的科室是否在用户管理的科室列表中
        const recordDepartment = department || oldRecord.department;
        const recordFunctionalDepartment = functionalDepartment || oldRecord.functional_department;

        if (
          !managedDeptNames.includes(recordDepartment) &&
          (!recordFunctionalDepartment || !managedDeptNames.includes(recordFunctionalDepartment))
        ) {
          return res
            .status(403)
            .json({ success: false, message: '权限不足，只能更新自己管理科室的验收记录' });
        }
      } else {
        return res.status(403).json({ success: false, message: '权限不足，用户未分配管理科室' });
      }
    }

    await db.execute(
      `UPDATE asset_acceptance_records SET asset_id = ?, asset_code = ?, asset_name = ?, supplier = ?, acceptance_date = ?, acceptance_person = ?, department = ?, functional_department = ?, status = ?, remark = ?, updated_at = NOW() WHERE id = ?${tenantFilter.whereClause}`,
      [
        assetId,
        assetCode,
        assetName,
        supplier,
        acceptanceDate,
        acceptancePerson,
        department,
        functionalDepartment,
        status,
        remark,
        id,
        ...tenantFilter.params,
      ],
    );

    res.json({
      success: true,
      message: '验收记录更新成功',
    });
  } catch (error) {
    logger.error('更新验收记录失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 更新验收状态
router.put('/records/:id/status', authenticate, authorize(AC_APPROVE_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    // 验证记录是否存在
    const [existingRecord] = await db.execute(
      `SELECT * FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (existingRecord.length === 0) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    const record = existingRecord[0];
    const statusBlocker = await getAcceptanceStatusBlocker(id, status);
    if (statusBlocker) {
      return res.status(400).json({ success: false, message: statusBlocker });
    }

    // 权限检查：非系统管理员只能更新自己管理科室的验收记录状态
    if (req.user.role !== 'system_admin' && req.user.role !== 'super_admin') {
      if (
        req.user.managed_departments &&
        Array.isArray(req.user.managed_departments) &&
        req.user.managed_departments.length > 0
      ) {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
        }

        // 获取用户管理的科室名称
        const placeholders = req.user.managed_departments.map(() => '?').join(',');
        const [deptRows] = await db.execute(
          `SELECT department_name FROM departments WHERE tenant_id = ? AND department_code IN (${placeholders})`,
          [tenantId, ...req.user.managed_departments],
        );

        const managedDeptNames = deptRows.map(row => row.department_name);

        // 检查验收记录的科室是否在用户管理的科室列表中
        if (
          !managedDeptNames.includes(record.department) &&
          (!record.functional_department ||
            !managedDeptNames.includes(record.functional_department))
        ) {
          return res
            .status(403)
            .json({ success: false, message: '权限不足，只能更新自己管理科室的验收记录状态' });
        }
      } else {
        return res.status(403).json({ success: false, message: '权限不足，用户未分配管理科室' });
      }
    }

    await db.execute(
      `UPDATE asset_acceptance_records SET status = ?, updated_at = NOW() WHERE id = ?${tenantFilter.whereClause}`,
      [status, id, ...tenantFilter.params],
    );

    res.json({
      success: true,
      message: '验收状态更新成功',
    });
  } catch (error) {
    logger.error('更新验收状态失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 删除验收记录
router.delete('/records/:id', authenticate, authorize(AC_WRITE_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    // 验证记录是否存在
    const [existingRecord] = await db.execute(
      `SELECT * FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (existingRecord.length === 0) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    const record = existingRecord[0];

    // 权限检查：非系统管理员只能删除自己管理科室的验收记录
    if (req.user.role !== 'system_admin' && req.user.role !== 'super_admin') {
      if (
        req.user.managed_departments &&
        Array.isArray(req.user.managed_departments) &&
        req.user.managed_departments.length > 0
      ) {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
        }

        // 获取用户管理的科室名称
        const placeholders = req.user.managed_departments.map(() => '?').join(',');
        const [deptRows] = await db.execute(
          `SELECT department_name FROM departments WHERE tenant_id = ? AND department_code IN (${placeholders})`,
          [tenantId, ...req.user.managed_departments],
        );

        const managedDeptNames = deptRows.map(row => row.department_name);

        // 检查验收记录的科室是否在用户管理的科室列表中
        if (
          !managedDeptNames.includes(record.department) &&
          (!record.functional_department ||
            !managedDeptNames.includes(record.functional_department))
        ) {
          return res
            .status(403)
            .json({ success: false, message: '权限不足，只能删除自己管理科室的验收记录' });
        }
      } else {
        return res.status(403).json({ success: false, message: '权限不足，用户未分配管理科室' });
      }
    }

    // 删除关联的文件
    await db.execute('DELETE FROM asset_acceptance_files WHERE acceptance_id = ? AND tenant_id = ?', [
      id,
      record.tenant_id,
    ]);

    // 删除验收记录
    await db.execute(`DELETE FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`, [
      id,
      ...tenantFilter.params,
    ]);

    res.json({
      success: true,
      message: '验收记录删除成功',
    });
  } catch (error) {
    logger.error('删除验收记录失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ============================================
// 验收文件管理 API
// ============================================

// 上传验收文件
router.post('/records/:id/files', authenticate, authorize(AC_WRITE_ROLES), upload.array('files', 10), fileSecurity(), async (req, res) => {
  try {
    const { id } = req.params;
    const { fileType } = req.body;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    // 验证验收记录是否存在
    const [existingRecord] = await db.execute(
      `SELECT * FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (existingRecord.length === 0) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    const acceptanceRecord = existingRecord[0];

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要上传的文件' });
    }

    // 保存文件信息到数据库
    const filePromises = req.files.map(file => {
      return db.execute(
        'INSERT INTO asset_acceptance_files (tenant_id, acceptance_id, file_type, file_name, file_path, file_size, mime_type, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
        [
          acceptanceRecord.tenant_id,
          id,
          fileType,
          file.originalname,
          file.path,
          file.size,
          file.mimetype,
          req.user.username,
        ],
      );
    });

    await Promise.all(filePromises);

    res.json({
      success: true,
      message: '文件上传成功',
      data: {
        files: req.files.map(file => ({
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
        })),
      },
    });
  } catch (error) {
    logger.error('上传验收文件失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取验收文件列表
router.get('/records/:id/files', authenticate, authorize(AC_GET_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    // 验证验收记录是否存在
    const [existingRecord] = await db.execute(
      `SELECT * FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (existingRecord.length === 0) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    const acceptanceRecord = existingRecord[0];

    const [files] = await db.execute(
      'SELECT * FROM asset_acceptance_files WHERE acceptance_id = ? AND tenant_id = ?',
      [id, acceptanceRecord.tenant_id],
    );

    res.json({
      success: true,
      data: files,
    });
  } catch (error) {
    logger.error('获取验收文件列表失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 删除验收文件
router.delete('/files/:id', authenticate, authorize(AC_WRITE_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    // 获取文件信息
    const [file] = await db.execute(
      `SELECT * FROM asset_acceptance_files WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (file.length === 0) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    // 删除文件
    if (fs.existsSync(file[0].file_path)) {
      fs.unlinkSync(file[0].file_path);
    }

    // 从数据库删除记录
    await db.execute(`DELETE FROM asset_acceptance_files WHERE id = ?${tenantFilter.whereClause}`, [
      id,
      ...tenantFilter.params,
    ]);

    res.json({
      success: true,
      message: '文件删除成功',
    });
  } catch (error) {
    logger.error('删除验收文件失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 下载验收文件
router.get('/files/:id/download', authenticate, authorize(AC_GET_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    // 获取文件信息
    const [file] = await db.execute(
      `SELECT * FROM asset_acceptance_files WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (file.length === 0) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    const filePath = file[0].file_path;
    const fileName = file[0].file_name;

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    // 下载文件
    res.download(filePath, fileName, err => {
      if (err) {
        logger.error('下载验收文件失败:', err);
        res.status(500).json({ success: false, message: '文件下载失败' });
      }
    });
  } catch (error) {
    logger.error('下载验收文件失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ============================================
// 验收统计 API
// ============================================

// 获取验收统计信息
router.get('/statistics', authenticate, authorize(AC_GET_ROLES), async (req, res) => {
  try {
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    // 总验收记录数
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total FROM asset_acceptance_records WHERE 1=1${tenantFilter.whereClause}`,
      [...tenantFilter.params],
    );

    // 各状态验收记录数
    const [statusResult] = await db.execute(
      `SELECT status, COUNT(*) as count FROM asset_acceptance_records WHERE 1=1${tenantFilter.whereClause} GROUP BY status`,
      [...tenantFilter.params],
    );

    // 各部门验收记录数
    const [departmentResult] = await db.execute(
      `SELECT department, COUNT(*) as count FROM asset_acceptance_records WHERE 1=1${tenantFilter.whereClause} GROUP BY department ORDER BY count DESC LIMIT 10`,
      [...tenantFilter.params],
    );

    const statusCounts = {};
    for (const row of statusResult) {
      statusCounts[row.status] = row.count;
    }

    res.json({
      success: true,
      data: {
        total: totalResult[0].total,
        ...statusCounts,
        statusDistribution: statusResult,
        departmentDistribution: departmentResult,
      },
    });
  } catch (error) {
    logger.error('获取验收统计信息失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ============================================
// 批量操作 API
// ============================================

// 批量创建验收记录
router.post('/records/batch', authenticate, requireTenantId, authorize(AC_WRITE_ROLES), async (req, res) => {
  try {
    const { records, defaultData } = req.body;
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: '请提供至少一条记录' });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const r = { ...defaultData, ...records[i] };

      if (!r.assetCode || !r.assetName || !r.acceptanceDate || !r.acceptancePerson || !r.department) {
        errors.push({ index: i, error: '缺少必填字段' });
        continue;
      }

      try {
        let actualAssetId = r.assetId;
        if (r.assetCode) {
          const [assetRows] = await db.execute(
            'SELECT id FROM assets WHERE asset_code = ? AND tenant_id = ? LIMIT 1',
            [r.assetCode, tenantId],
          );
          if (assetRows.length > 0) {
            actualAssetId = assetRows[0].id;
          }
        }

        const [insertResult] = await db.execute(
          'INSERT INTO asset_acceptance_records (tenant_id, asset_id, asset_code, asset_name, supplier, acceptance_date, acceptance_person, department, functional_department, status, remark, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
          [
            tenantId, actualAssetId, r.assetCode, r.assetName, r.supplier || null,
            r.acceptanceDate, r.acceptancePerson, r.department, r.functionalDepartment || null,
            r.status || '待验收', r.remark || null, req.user.username,
          ],
        );

        results.push({ id: insertResult.insertId, assetCode: r.assetCode });
      } catch (err) {
        errors.push({ index: i, assetCode: r.assetCode, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `批量创建完成，成功 ${results.length} 条，失败 ${errors.length} 条`,
      data: { results, errors },
    });
  } catch (error) {
    logger.error('批量创建验收记录失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 根据资产编号自动填充信息
router.get('/assets/:code/fill-info', authenticate, authorize(AC_GET_ROLES), async (req, res) => {
  try {
    const { code } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [assets] = await db.execute(
      'SELECT id, asset_code, asset_name, brand, model, department_new, responsible_person, tenant_id FROM assets WHERE asset_code = ? LIMIT 1',
      [code],
    );

    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const asset = assets[0];

    // 获取部门名称
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

    res.json({
      success: true,
      data: {
        assetId: asset.id,
        assetCode: asset.asset_code,
        assetName: asset.asset_name,
        supplier: asset.brand ? `${asset.brand} ${asset.model || ''}`.trim() : null,
        department: departmentName,
      },
    });
  } catch (error) {
    logger.error('获取资产信息失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取验收检查清单模板
router.get('/templates', authenticate, authorize(AC_GET_ROLES), async (req, res) => {
  try {
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [templates] = await db.execute(
      'SELECT * FROM asset_acceptance_templates WHERE (tenant_id = ? OR tenant_id IS NULL) ORDER BY sort_order, id',
      [getTenantId(req)],
    );

    // 按类别分组
    const grouped = {};
    for (const t of templates) {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push({
        id: t.id,
        item_name: t.item_name,
        item_description: t.item_description,
        is_required: t.is_required,
        sort_order: t.sort_order,
      });
    }

    res.json({ success: true, data: grouped });
  } catch (error) {
    logger.error('获取验收模板失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ============================================
// 验收检查清单 API
// ============================================

// 获取验收记录的检查清单
router.get('/records/:id/checklist', authenticate, authorize(AC_GET_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [record] = await db.execute(
      `SELECT id FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (record.length === 0) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    const [checklist] = await db.execute(
      'SELECT * FROM asset_acceptance_checklist WHERE acceptance_id = ? ORDER BY category, sort_order, id',
      [id],
    );

    res.json({ success: true, data: checklist });
  } catch (error) {
    logger.error('获取检查清单失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 从模板初始化检查清单
router.post('/records/:id/checklist/init', authenticate, authorize(AC_WRITE_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [record] = await db.execute(
      `SELECT id, tenant_id FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (record.length === 0) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    const tenantId = record[0].tenant_id;

    // 先检查是否已有检查项
    const [existing] = await db.execute(
      'SELECT COUNT(*) as cnt FROM asset_acceptance_checklist WHERE acceptance_id = ?',
      [id],
    );
    if (existing[0].cnt > 0) {
      return res.status(400).json({ success: false, message: '检查清单已存在，请勿重复初始化' });
    }

    // 从模板获取检查项
    const [templates] = await db.execute(
      'SELECT category, item_name, item_description FROM asset_acceptance_templates WHERE (tenant_id = ? OR tenant_id IS NULL) ORDER BY sort_order, id',
      [tenantId],
    );

    for (const t of templates) {
      await db.execute(
        'INSERT INTO asset_acceptance_checklist (acceptance_id, tenant_id, category, item_name, item_description) VALUES (?, ?, ?, ?, ?)',
        [id, tenantId, t.category, t.item_name, t.item_description],
      );
    }

    // 更新状态为验收中
    await db.execute(
      'UPDATE asset_acceptance_records SET status = "验收中", updated_at = NOW() WHERE id = ?',
      [id],
    );

    res.json({ success: true, message: '检查清单初始化成功', data: { count: templates.length } });
  } catch (error) {
    logger.error('初始化检查清单失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 更新检查项状态
router.put('/records/:id/checklist/:checkId', authenticate, authorize(AC_WRITE_ROLES), async (req, res) => {
  try {
    const { id, checkId } = req.params;
    const { is_passed, remark } = req.body;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [record] = await db.execute(
      `SELECT id FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (record.length === 0) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    await db.execute(
      'UPDATE asset_acceptance_checklist SET is_passed = ?, remark = ?, checked_by = ?, checked_at = NOW() WHERE id = ? AND acceptance_id = ?',
      [is_passed, remark || null, req.user.real_name || req.user.username, checkId, id],
    );

    res.json({ success: true, message: '检查项更新成功' });
  } catch (error) {
    logger.error('更新检查项失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 批量更新检查项
router.put('/records/:id/checklist/batch', authenticate, authorize(AC_WRITE_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [record] = await db.execute(
      `SELECT id FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (record.length === 0) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    for (const item of items) {
      await db.execute(
        'UPDATE asset_acceptance_checklist SET is_passed = ?, remark = ?, checked_by = ?, checked_at = NOW() WHERE id = ? AND acceptance_id = ?',
        [item.is_passed, item.remark || null, req.user.real_name || req.user.username, item.id, id],
      );
    }

    res.json({ success: true, message: '批量更新成功' });
  } catch (error) {
    logger.error('批量更新检查项失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 获取检查清单统计
router.get('/records/:id/checklist/stats', authenticate, authorize(AC_GET_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [record] = await db.execute(
      `SELECT id FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (record.length === 0) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    const [total] = await db.execute(
      'SELECT COUNT(*) as total FROM asset_acceptance_checklist WHERE acceptance_id = ?',
      [id],
    );
    const [passed] = await db.execute(
      'SELECT COUNT(*) as count FROM asset_acceptance_checklist WHERE acceptance_id = ? AND is_passed = 1',
      [id],
    );
    const [failed] = await db.execute(
      'SELECT COUNT(*) as count FROM asset_acceptance_checklist WHERE acceptance_id = ? AND is_passed = 0',
      [id],
    );
    const [unchecked] = await db.execute(
      'SELECT COUNT(*) as count FROM asset_acceptance_checklist WHERE acceptance_id = ? AND is_passed IS NULL',
      [id],
    );

    const [byCategory] = await db.execute(
      `SELECT category, COUNT(*) as total, 
        SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN is_passed = 0 THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN is_passed IS NULL THEN 1 ELSE 0 END) as unchecked
       FROM asset_acceptance_checklist WHERE acceptance_id = ? GROUP BY category`,
      [id],
    );

    res.json({
      success: true,
      data: {
        total: total[0].total,
        passed: passed[0].count,
        failed: failed[0].count,
        unchecked: unchecked[0].count,
        byCategory,
      },
    });
  } catch (error) {
    logger.error('获取检查清单统计失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 一键通过所有检查项
router.put('/records/:id/checklist/pass-all', authenticate, authorize(AC_APPROVE_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [record] = await db.execute(
      `SELECT id FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (record.length === 0) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    await db.execute(
      'UPDATE asset_acceptance_checklist SET is_passed = 1, checked_by = ?, checked_at = NOW() WHERE acceptance_id = ? AND is_passed IS NULL',
      [req.user.real_name || req.user.username, id],
    );

    // 自动标记为已验收
    await db.execute(
      'UPDATE asset_acceptance_records SET status = "已验收", updated_at = NOW() WHERE id = ?',
      [id],
    );

    res.json({ success: true, message: '所有检查项已通过，验收记录已标记为已验收' });
  } catch (error) {
    logger.error('一键通过失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

module.exports = router;
