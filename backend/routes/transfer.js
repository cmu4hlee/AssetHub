const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { addTenantFilter, getTenantId, requireTenantId } = require('../middleware/tenant-filter');
const eventBus = require('../core/EventBus').getEventBus();

// 安全发布事件（fail-soft）
function safeEmit(eventName, payload) {
  try { eventBus.emit(eventName, payload || {}); } catch (e) { /* 静默 */ }
}

// 调配模块权限集合
const TR_GET_ROLES = ['transfer.view', 'asset.view_all', 'asset.view_own_department'];
const TR_WRITE_ROLES = ['transfer.apply', 'asset.edit_all', 'asset.edit_own_department'];
const TR_APPROVE_ROLES = ['transfer.approve', 'transfer.complete', 'asset.edit_all'];

// 统一复用调配核心逻辑（单一数据源：asset_transfer_requests）
const {
  findTransferRequestById,
  createTransferRequest,
  approveTransferRequest,
  deleteTransferRequest,
} = require('../services/transfer-approval-service');

const TRANSFER_REQUEST_ASSET_JOIN =
  'LEFT JOIN assets a ON t.asset_code = a.asset_code AND a.tenant_id = t.tenant_id AND a.is_deleted = 0';

// 兼容中文状态筛选值 -> 数据库状态
const STATUS_MAP = {
  待审批: 'pending',
  已批准: 'approved',
  已完成: 'completed',
  已取消: 'rejected',
  已拒绝: 'rejected',
};

// 将数据库状态转换为前端展示状态
const STATUS_TO_LABEL = {
  pending: '待审批',
  approved: '已批准',
  completed: '已完成',
  rejected: '已取消',
};

async function fetchManagedDepartmentNames(departmentCodes, tenantId) {
  if (!Array.isArray(departmentCodes) || departmentCodes.length === 0) {
    return [];
  }
  const placeholders = departmentCodes.map(() => '?').join(',');
  const [rows] = await db.execute(
    `SELECT department_name FROM departments WHERE tenant_id = ? AND department_code IN (${placeholders})`,
    [tenantId, ...departmentCodes],
  );
  return rows.map(row => row.department_name);
}

// 获取调配记录列表（统一读取 asset_transfer_requests）
router.get('/', authenticate, authorize(TR_GET_ROLES), async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

    // 先检查表是否存在
    try {
      const [tableCheck] = await db.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_transfer_requests'",
      );
      if (tableCheck.length === 0) {
        return res.status(500).json({
          success: false,
          message:
            'asset_transfer_requests 表不存在，请先运行创建表脚本: node scripts/create-asset-transfer-requests-table.js',
        });
      }
    } catch (tableError) {
      console.error('检查表存在性失败:', tableError.message);
    }

    const currentUser = req.user.real_name || req.user.username || '';
    const whereConditions = [];
    const params = [];

    const tenantFilter = addTenantFilter(req, 't');
    if (tenantFilter.whereClause) {
      whereConditions.push(tenantFilter.whereClause.trim().replace(/^AND\s+/, ''));
      params.push(...tenantFilter.params);
    }

    // 非系统管理员：仅可见自己提交的申请或自己管理部门相关的申请
    if (currentUser && req.user.role !== 'super_admin' && req.user.role !== 'system_admin') {
      const managedDeptNames =
        req.user.managed_departments && Array.isArray(req.user.managed_departments) && req.user.managed_departments.length > 0
          ? await fetchManagedDepartmentNames(req.user.managed_departments, getTenantId(req))
          : [];

      if (managedDeptNames.length > 0) {
        const deptPlaceholders = managedDeptNames.map(() => '?').join(',');
        whereConditions.push(
          `(t.applicant = ? OR t.current_department IN (${deptPlaceholders}) OR t.target_department IN (${deptPlaceholders}))`,
        );
        params.push(currentUser, ...managedDeptNames, ...managedDeptNames);
      } else {
        whereConditions.push('t.applicant = ?');
        params.push(currentUser);
      }
    }

    if (status) {
      const dbStatus = STATUS_MAP[status] || status;
      whereConditions.push('t.status = ?');
      params.push(dbStatus);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 兼容可选字段
    let commentField = ', t.comment as remark';
    let updatedAtField = ', t.updated_at';
    try {
      const [columns] = await db.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_transfer_requests' AND COLUMN_NAME IN ('comment', 'updated_at')",
      );
      const columnNames = columns.map(col => col.COLUMN_NAME);
      if (!columnNames.includes('comment')) commentField = ", '' as remark";
      if (!columnNames.includes('updated_at')) updatedAtField = ', NULL as updated_at';
    } catch (colError) {
      console.warn('检查字段失败，使用默认值:', colError.message);
      commentField = ", '' as remark";
      updatedAtField = ', NULL as updated_at';
    }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM asset_transfer_requests t ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const [rows] = await db.execute(
      `SELECT
        t.id,
        t.asset_code,
        t.asset_name,
        t.current_department as from_department,
        t.target_department as to_department,
        DATE(t.created_at) as transfer_date,
        CASE
          WHEN t.status = 'pending' THEN '待审批'
          WHEN t.status = 'approved' THEN '已批准'
          WHEN t.status = 'rejected' THEN '已取消'
          WHEN t.status = 'completed' THEN '已完成'
          ELSE t.status
        END as status,
        t.reason as transfer_reason,
        t.applicant,
        t.approved_by,
        t.approved_at${commentField},
        t.created_at${updatedAtField}
       FROM asset_transfer_requests t
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize, 10), offset],
    );

    const processedRows = rows.map(row => ({
      ...row,
      transfer_no: `SQ${String(row.id).padStart(8, '0')}`,
    }));

    res.json({
      success: true,
      data: processedRows,
      pagination: {
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize, 10)),
      },
    });
  } catch (error) {
    console.error('获取调配记录失败:', error.message);
    res.status(500).json({ success: false, message: '获取调配记录失败', error: error.message });
  }
});

// 调配统计汇总
router.get('/statistics', authenticate, authorize(TR_GET_ROLES), async (req, res) => {
  try {
    const tenantFilter = addTenantFilter(req, 't');
    const whereClause = tenantFilter.whereClause ? `WHERE 1=1 ${tenantFilter.whereClause}` : '';
    const params = [...tenantFilter.params];

    const [rows] = await db.execute(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejected
       FROM asset_transfer_requests t
       ${whereClause}`,
      params,
    );

    res.json({ success: true, data: rows[0] || {} });
  } catch (error) {
    console.error('获取调配统计失败:', error);
    res.status(500).json({ success: false, message: '获取调配统计失败', error: error.message });
  }
});

// 获取单个调配记录详情
router.get('/:id', authenticate, authorize(TR_GET_ROLES), async (req, res) => {
  try {
    const { id } = req.params;

    let commentField = ', t.comment as remark';
    let updatedAtField = ', t.updated_at';
    try {
      const [columns] = await db.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_transfer_requests' AND COLUMN_NAME IN ('comment', 'updated_at')",
      );
      const columnNames = columns.map(col => col.COLUMN_NAME);
      if (!columnNames.includes('comment')) commentField = ", '' as remark";
      if (!columnNames.includes('updated_at')) updatedAtField = ', NULL as updated_at';
    } catch (colError) {
      console.warn('检查字段失败，使用默认值:', colError.message);
      commentField = ", '' as remark";
      updatedAtField = ', NULL as updated_at';
    }

    const tenantFilter = addTenantFilter(req, 't');
    const [rows] = await db.execute(
      `SELECT
        t.id,
        t.asset_code,
        t.asset_name,
        t.current_department as from_department,
        t.target_department as to_department,
        DATE(t.created_at) as transfer_date,
        CASE
          WHEN t.status = 'pending' THEN '待审批'
          WHEN t.status = 'approved' THEN '已批准'
          WHEN t.status = 'rejected' THEN '已取消'
          WHEN t.status = 'completed' THEN '已完成'
          ELSE t.status
        END as status,
        t.reason as transfer_reason,
        t.applicant,
        t.approved_by,
        t.approved_at${commentField},
        t.created_at${updatedAtField},
        a.brand,
        a.model
       FROM asset_transfer_requests t
       ${TRANSFER_REQUEST_ASSET_JOIN}
       WHERE t.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '调配记录不存在' });
    }

    res.json({
      success: true,
      data: { ...rows[0], transfer_no: `SQ${String(rows[0].id).padStart(8, '0')}` },
    });
  } catch (error) {
    console.error('获取调配详情失败:', error);
    res.status(500).json({ success: false, message: '获取调配详情失败', error: error.message });
  }
});

// 创建调配申请（统一写入 asset_transfer_requests；系统管理员可审批后直接执行）
router.post('/', authenticate, requireTenantId, authorize(TR_WRITE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
      asset_code,
      to_department,
      target_department,
      from_department,
      reason,
      remark,
    } = req.body;
    const tenantId = getTenantId(req);
    const applicant = req.user?.real_name || req.user?.username || '系统管理员';
    const targetDept = (target_department || to_department || '').toString().trim();

    if (!asset_code) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '资产编号不能为空' });
    }
    if (!targetDept) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '调入部门不能为空' });
    }

    const createResult = await createTransferRequest(connection, {
      tenantId,
      assetCode: asset_code,
      assetId: null, // createTransferRequest 内部会按 asset_code 锁定并校验资产
      assetName: null,
      currentDepartment: from_department || null,
      targetDepartment: targetDept,
      reason: reason || remark || null,
      applicant,
    });

    if (!createResult.success) {
      await connection.rollback();
      connection.release();
      return res.status(createResult.code || 400).json({ success: false, message: createResult.message });
    }

    // 系统管理员直接审批执行（审批即调拨）
    if (req.user?.role === 'system_admin') {
      const approver = applicant;
      const approveResult = await approveTransferRequest(connection, {
        id: createResult.id,
        approved: true,
        approver,
        tenantId,
        comment: '系统管理员直接调拨',
      });
      if (!approveResult.success) {
        await connection.rollback();
        connection.release();
        return res.status(approveResult.code || 400).json({ success: false, message: approveResult.message });
      }
      // 兼容历史 transfer_records（若表存在则写入一条已完成记录作为审计）
      try {
        await connection.execute(
          `INSERT INTO transfer_records
             (transfer_no, asset_code, from_department, to_department, transfer_date, transfer_reason, created_by, remark, status, approver, approve_date, tenant_id)
           VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, '已完成', ?, CURDATE(), ?)`,
          [
            `SQ${String(createResult.id).padStart(8, '0')}`,
            createResult.asset_code,
            from_department || null,
            targetDept,
            reason || remark || null,
            approver,
            remark || null,
            approver,
            tenantId,
          ],
        );
      } catch (recErr) {
        if (recErr.code !== 'ER_NO_SUCH_TABLE') throw recErr;
      }
    }

    await connection.commit();
    safeEmit('transfer:created', {
      tenantId, transferId: createResult.id, assetCode: createResult.asset_code,
      actorUserId: req.user?.id, source: 'transfer.create',
    });
    res.json({
      success: true,
      message: req.user?.role === 'system_admin' ? '调配申请已创建并直接执行' : '调配申请已提交，等待审批',
      data: { id: createResult.id, asset_code: createResult.asset_code, status: req.user?.role === 'system_admin' ? 'approved' : 'pending' },
    });
  } catch (error) {
    await connection.rollback();
    console.error('创建调配申请失败:', error.message);
    res.status(500).json({ success: false, message: '创建调配申请失败', error: error.message });
  } finally {
    connection.release();
  }
});

// 审批调配（批准并实际调拨）
router.put('/:id/approve', authenticate, authorize(TR_APPROVE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { comment } = req.body;
    const tenantId = getTenantId(req);
    const approver = req.user.real_name || req.user.username || '系统管理员';

    const result = await approveTransferRequest(connection, {
      id,
      approved: true,
      approver,
      tenantId,
      comment,
    });

    if (!result.success) {
      await connection.rollback();
      connection.release();
      return res.status(result.code || 400).json({ success: false, message: result.message });
    }

    await connection.commit();
    safeEmit('transfer:approved', {
      tenantId, transferId: parseInt(id), approver,
      actorUserId: req.user?.id, source: 'transfer.approve',
    });
    res.json({ success: true, message: result.message });
  } catch (error) {
    await connection.rollback();
    console.error('审批调配失败:', error.message);
    res.status(500).json({ success: false, message: '审批调配失败', error: error.message });
  } finally {
    connection.release();
  }
});

// 完成调配（幂等：已批准即已完成调拨，直接返回成功；待审批则执行审批调拨）
router.put('/:id/complete', authenticate, authorize(TR_APPROVE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { comment } = req.body;
    const tenantId = getTenantId(req);
    const approver = req.user.real_name || req.user.username || '系统管理员';

    const request = await findTransferRequestById(connection, id, tenantId);
    if (!request) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '调配申请不存在' });
    }

    if (request.status === 'approved') {
      // 已审批的调拨即为已完成，直接成功（幂等）
      await connection.commit();
      safeEmit('transfer:completed', {
        tenantId, transferId: parseInt(id),
        actorUserId: req.user?.id, source: 'transfer.complete',
      });
      connection.release();
      return res.json({ success: true, message: '调配已完成' });
    }
    if (request.status !== 'pending') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '该调配申请已拒绝，无法完成' });
    }

    const result = await approveTransferRequest(connection, {
      id,
      approved: true,
      approver,
      tenantId,
      comment,
    });
    if (!result.success) {
      await connection.rollback();
      connection.release();
      return res.status(result.code || 400).json({ success: false, message: result.message });
    }

    await connection.commit();
    safeEmit('transfer:completed', {
      tenantId, transferId: parseInt(id),
      actorUserId: req.user?.id, source: 'transfer.complete-approve',
    });
    res.json({ success: true, message: result.message });
  } catch (error) {
    await connection.rollback();
    console.error('完成调配失败:', error.message);
    res.status(500).json({ success: false, message: '完成调配失败', error: error.message });
  } finally {
    connection.release();
  }
});

// 拒绝调配申请
router.put('/:id/reject', authenticate, authorize(TR_APPROVE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { comment } = req.body;
    const tenantId = getTenantId(req);
    const rejecter = req.user.real_name || req.user.username || '系统管理员';

    const { rejectTransferRequest } = require('../services/transfer-approval-service');
    const result = await rejectTransferRequest(connection, {
      id,
      approver: rejecter,
      tenantId,
      comment,
    });

    if (!result.success) {
      await connection.rollback();
      connection.release();
      return res.status(result.code || 400).json({ success: false, message: result.message });
    }

    await connection.commit();
    safeEmit('transfer:rejected', {
      tenantId, transferId: parseInt(id), rejecter,
      actorUserId: req.user?.id, source: 'transfer.reject',
    });
    res.json({ success: true, message: result.message });
  } catch (error) {
    await connection.rollback();
    console.error('拒绝调配失败:', error.message);
    res.status(500).json({ success: false, message: '拒绝调配失败', error: error.message });
  } finally {
    connection.release();
  }
});

// 删除调配申请（统一删除 asset_transfer_requests，并修正资产状态）
router.delete('/:id', authenticate, authorize(TR_WRITE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const tenantId = getTenantId(req);

    const result = await deleteTransferRequest(connection, { id, tenantId });
    if (!result.success) {
      await connection.rollback();
      connection.release();
      return res.status(result.code || 404).json({ success: false, message: result.message });
    }

    await connection.commit();
    res.json({ success: true, message: result.message });
  } catch (error) {
    await connection.rollback();
    console.error('删除调配申请失败:', error.message);
    res.status(500).json({ success: false, message: '删除调配申请失败', error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
