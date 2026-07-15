/**
 * 资产调拨路由模块
 * 统一复用 services/transfer-approval-service（单一数据源：asset_transfer_requests）
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate, authorize } = require('../../middleware/auth');

const ASSET_TRANSFER_ROLES = ['transfer.apply', 'asset.edit_all', 'asset.edit_own_department'];
const ASSET_TRANSFER_APPROVE_ROLES = ['transfer.approve', 'asset.edit_all'];
const { addTenantFilter, getTenantId } = require('../../middleware/tenant-filter');
const logger = require('../../config/logger');

const {
  createTransferRequest,
  approveTransferRequest,
} = require('../../services/transfer-approval-service');

const normalizeText = value => (value == null ? '' : String(value).trim());

const resolveTargetDepartment = async (connection, tenantId, rawDepartment) => {
  const normalizedDepartment = normalizeText(rawDepartment);
  if (!normalizedDepartment) {
    return '';
  }
  const [departments] = await connection.execute(
    `SELECT department_name
     FROM departments
     WHERE tenant_id = ?
       AND (
         CAST(id AS CHAR) = ?
         OR department_code = ?
         OR department_name = ?
       )
     LIMIT 1`,
    [tenantId, normalizedDepartment, normalizedDepartment, normalizedDepartment],
  );
  return departments[0]?.department_name || normalizedDepartment;
};

/**
 * 获取调拨申请列表
 */
router.get('/transfer-requests', authenticate, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(req.query.pageSize || req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * pageSize;
    const { status } = req.query;

    const tenantFilter = addTenantFilter(req, 't');
    const conditions = [];
    const params = [];
    if (tenantFilter.whereClause) {
      conditions.push(tenantFilter.whereClause.replace(/^\s*AND\s+/i, ''));
      params.push(...tenantFilter.params);
    }

    const statusMap = {
      待审批: 'pending',
      已批准: 'approved',
      已完成: 'completed',
      已拒绝: 'rejected',
      已取消: 'rejected',
    };
    if (status && status !== 'all') {
      conditions.push('t.status = ?');
      params.push(statusMap[status] || status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [requests] = await db.execute(
      `SELECT
        t.id,
        t.asset_code,
        t.asset_name,
        t.current_department,
        t.target_department,
        t.reason,
        t.applicant,
        t.status,
        t.approved_by,
        t.approved_at,
        t.created_at,
        t.comment,
        t.updated_at
       FROM asset_transfer_requests t
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM asset_transfer_requests t ${whereClause}`,
      params,
    );

    res.json({
      success: true,
      data: requests,
      pagination: {
        page,
        pageSize,
        total: countResult[0]?.total || 0,
      },
    });
  } catch (error) {
    logger.error('Get transfer requests failed:', error);
    res.status(500).json({ success: false, message: '获取调拨申请失败' });
  }
});

/**
 * 提交调拨申请
 */
router.post('/:id/transfer-apply', authenticate, authorize(ASSET_TRANSFER_ROLES), async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const assetIdentifier = normalizeText(req.params.id);
    const tenantId = getTenantId(req);
    const applicant = req.user.real_name || req.user.username;
    const reason = normalizeText(req.body.reason);
    const rawTargetDepartment =
      req.body.target_department ?? req.body.to_department ?? req.body.to_department_id;

    if (!assetIdentifier) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '资产标识不能为空' });
    }
    if (!reason) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '调配原因不能为空' });
    }

    const targetDepartment = await resolveTargetDepartment(connection, tenantId, rawTargetDepartment);
    if (!targetDepartment) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '目标部门不能为空' });
    }

    const result = await createTransferRequest(connection, {
      tenantId,
      assetCode: assetIdentifier, // 兼容资产编号或数值 id，核心内部会锁定并校验资产
      assetId: null,
      assetName: null,
      currentDepartment: null,
      targetDepartment,
      reason,
      applicant,
    });

    if (!result.success) {
      await connection.rollback();
      return res.status(result.code || 400).json({ success: false, message: result.message });
    }

    await connection.commit();

    res.json({
      success: true,
      message: '调拨申请已提交',
      data: {
        request_id: result.id,
        asset_code: result.asset_code,
        target_department: targetDepartment,
      },
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Transfer apply failed:', error);
    res.status(500).json({ success: false, message: '申请调拨失败' });
  } finally {
    connection.release();
  }
});

/**
 * 审批调拨申请
 */
router.post('/transfer-requests/:request_id/approve', authenticate, authorize(ASSET_TRANSFER_APPROVE_ROLES), async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { request_id } = req.params;
    const tenantId = getTenantId(req);
    const approver = req.user.real_name || req.user.username;
    const { action, comment } = req.body;

    const approved =
      typeof req.body.approved === 'boolean'
        ? req.body.approved
        : action === 'approve'
          ? true
          : action === 'reject'
            ? false
            : null;

    if (approved == null) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: '审批参数无效，请传 approved 或 action=approve/reject',
      });
    }

    const result = await approveTransferRequest(connection, {
      id: request_id,
      approved,
      approver,
      tenantId,
      comment,
    });

    if (!result.success) {
      await connection.rollback();
      const statusCode = result.code || 400;
      return res.status(statusCode).json({ success: false, message: result.message });
    }

    await connection.commit();

    res.json({ success: true, message: result.message });
  } catch (error) {
    await connection.rollback();
    logger.error('Transfer approve failed:', error);
    res.status(500).json({ success: false, message: '审批失败' });
  } finally {
    connection.release();
  }
});

module.exports = router;
