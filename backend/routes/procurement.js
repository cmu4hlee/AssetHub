/**
 * @swagger
 * /api/procurement:
 *   get:
 *     summary: 获取采购申请列表
 *     description: 分页获取采购申请记录
 *     tags: [采购管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页数量
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 搜索关键词
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: 部门名称
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending, approved, rejected, executing, completed]
 *         description: 状态
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 开始日期
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 结束日期
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 *   post:
 *     summary: 创建采购申请
 *     description: 创建新的采购申请
 *     tags: [采购管理]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: 采购标题
 *               asset_name:
 *                 type: string
 *                 description: 资产名称（别名）
 *               department:
 *                 type: string
 *                 description: 需求部门
 *               request_type:
 *                 type: string
 *                 enum: [purchase, lease, custom]
 *                 default: purchase
 *                 description: 采购类型
 *               request_date:
 *                 type: string
 *                 format: date
 *                 description: 申请日期
 *               budget:
 *                 type: number
 *                 description: 预算金额
 *               estimated_cost:
 *                 type: number
 *                 description: 预估费用（别名）
 *               justification:
 *                 type: string
 *                 description: 申请理由
 *               reason:
 *                 type: string
 *                 description: 原因（别名）
 *               specification:
 *                 type: string
 *                 description: 规格要求
 *               quantity:
 *                 type: integer
 *                 description: 数量
 *               expected_date:
 *                 type: string
 *                 format: date
 *                 description: 期望日期
 *               currency:
 *                 type: string
 *                 default: CNY
 *                 description: 币种
 *     responses:
 *       201:
 *         description: 创建成功
 *       400:
 *         description: 参数错误
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/procurement/{id}/approve:
 *   put:
 *     summary: 审批采购申请
 *     description: 审批通过或驳回采购申请
 *     tags: [采购管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 采购申请ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 description: 审批动作
 *               approved:
 *                 type: boolean
 *                 description: 是否批准（与action二选一）
 *               comment:
 *                 type: string
 *                 description: 审批意见
 *               opinion:
 *                 type: string
 *                 description: 审批意见（别名）
 *     responses:
 *       200:
 *         description: 审批成功
 *       400:
 *         description: 审批动作无效
 *       403:
 *         description: 无权审批
 *       404:
 *         description: 采购申请不存在
 *       500:
 *         description: 服务器错误
 */

const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getTenantId, requireTenantId } = require('../middleware/tenant-filter');
const { fileSecurity } = require('../middleware/fileSecurity');
const { TransactionManager } = require('../utils/error-handler');

const router = express.Router();
const procurementUploadDir = path.join(__dirname, '../uploads/procurement');
fs.mkdirSync(procurementUploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: procurementUploadDir,
    filename: (req, file, cb) => {
      const safeName = String(file.originalname || 'file').replace(/[^\w.-]/g, '_');
      cb(null, `${Date.now()}-${safeName}`);
    },
  }),
});

const APPROVER_ROLES = new Set(['super_admin', 'system_admin']);
const STATUS_ALIASES = {
  draft: 'draft',
  pending: 'pending',
  pending_approval: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  executing: 'executing',
  completed: 'completed',
};
let procurementColumnsCache = null;
let procurementColumnsPromise = null;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeStatus(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return STATUS_ALIASES[normalized] || null;
}

function normalizeDate(value) {
  const source = String(value || '').trim();
  if (!source) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) {
    return source;
  }

  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeMoney(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : Number.NaN;
}

function normalizeNullablePositiveInt(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
}

function buildRequestCode() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `CG${datePart}${Date.now().toString().slice(-6)}${randomPart}`;
}

function hasColumn(columns, name) {
  return columns instanceof Set && columns.has(name);
}

function pickFirstExistingColumn(columns, candidates = []) {
  return candidates.find(column => hasColumn(columns, column)) || null;
}

function buildSelectExpression(columns, candidates = [], fallback = 'NULL') {
  const column = pickFirstExistingColumn(columns, candidates);
  return column ? `pr.${column}` : fallback;
}

async function getProcurementColumns(forceRefresh = false) {
  if (procurementColumnsCache && !forceRefresh) {
    return procurementColumnsCache;
  }

  if (procurementColumnsPromise && !forceRefresh) {
    return procurementColumnsPromise;
  }

  procurementColumnsPromise = db
    .execute(
      `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'procurement_requests'
      `,
    )
    .then(([rows]) => {
      const columns = new Set(rows.map(item => item.COLUMN_NAME));
      procurementColumnsCache = columns;
      procurementColumnsPromise = null;
      return columns;
    })
    .catch(error => {
      procurementColumnsPromise = null;
      throw error;
    });

  return procurementColumnsPromise;
}

function resetProcurementColumnsCache() {
  procurementColumnsCache = null;
  procurementColumnsPromise = null;
}

function mapProcurementRow(row) {
  return {
    id: row.id,
    request_code: row.request_code,
    request_no: row.request_code,
    title: row.title,
    request_type: row.request_type,
    request_date: row.request_date,
    requester_id: row.requester_id,
    requester_name: row.requester_name || null,
    department_id: row.department_id,
    department: row.department_name || row.department_code || null,
    budget_amount: row.budget_amount,
    budget: row.budget_amount,
    currency: row.currency,
    description: row.description,
    justification: row.justification,
    status: row.status,
    approver_id: row.approver_id,
    approver_name: row.approver_name || null,
    approval_date: row.approval_date,
    approval_comments: row.approval_comments,
    tenant_id: row.tenant_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildProcurementDetailSelect(columns) {
  return `
    SELECT
      pr.id,
      ${hasColumn(columns, 'tenant_id') ? 'pr.tenant_id' : 'NULL'} AS tenant_id,
      ${hasColumn(columns, 'title') ? 'pr.title' : 'NULL'} AS title,
      ${hasColumn(columns, 'department') ? 'pr.department' : 'NULL'} AS department,
      ${hasColumn(columns, 'department_id') ? 'pr.department_id' : 'NULL'} AS department_id,
      ${hasColumn(columns, 'applicant') ? 'pr.applicant' : 'NULL'} AS applicant,
      ${hasColumn(columns, 'requester_id') ? 'pr.requester_id' : 'NULL'} AS requester_id,
      ${hasColumn(columns, 'applicant_id') ? 'pr.applicant_id' : 'NULL'} AS applicant_id,
      ${hasColumn(columns, 'budget_amount') ? 'pr.budget_amount' : hasColumn(columns, 'budget') ? 'pr.budget' : 'NULL'} AS budget_amount,
      ${hasColumn(columns, 'description') ? 'pr.description' : 'NULL'} AS description,
      ${hasColumn(columns, 'justification') ? 'pr.justification' : 'NULL'} AS justification,
      ${hasColumn(columns, 'remark') ? 'pr.remark' : 'NULL'} AS remark,
      ${hasColumn(columns, 'acceptance_record_id') ? 'pr.acceptance_record_id' : 'NULL'} AS acceptance_record_id,
      ${hasColumn(columns, 'status') ? 'pr.status' : 'NULL'} AS status
    FROM procurement_requests pr
    WHERE pr.id = ? ${hasColumn(columns, 'tenant_id') ? 'AND pr.tenant_id = ?' : ''}
    LIMIT 1
  `;
}

async function ensureAcceptanceRecordExists(tenantId, acceptanceRecordId, columns) {
  if (!acceptanceRecordId || !hasColumn(columns, 'acceptance_record_id')) {
    return true;
  }

  const [rows] = await db.execute(
    `SELECT id FROM acceptance_records WHERE id = ? ${tenantId ? 'AND tenant_id = ?' : ''} LIMIT 1`,
    tenantId ? [acceptanceRecordId, tenantId] : [acceptanceRecordId],
  );

  return rows.length > 0;
}

async function resolveDepartmentId(tenantId, departmentInput) {
  const keyword = String(departmentInput || '').trim();
  if (!tenantId || !keyword) {
    return null;
  }

  const [rows] = await db.execute(
    `
    SELECT id
    FROM departments
    WHERE tenant_id = ?
      AND (
        department_name = ?
        OR department_code = ?
        OR department_name LIKE ?
        OR department_code LIKE ?
      )
    ORDER BY
      CASE
        WHEN department_name = ? THEN 0
        WHEN department_code = ? THEN 1
        ELSE 2
      END,
      id ASC
    LIMIT 1
    `,
    [tenantId, keyword, keyword, `%${keyword}%`, `%${keyword}%`, keyword, keyword],
  );

  return rows[0]?.id || null;
}

function buildDescription(body = {}) {
  const lines = [];
  const title = String(body.asset_name || body.title || '').trim();
  const specification = String(body.specification || '').trim();
  const {quantity} = body;
  const expectedDate = normalizeDate(body.expected_date);
  const reason = String(body.reason || body.justification || '').trim();
  const originalDescription = String(body.description || '').trim();

  if (title) lines.push(`采购对象：${title}`);
  if (specification) lines.push(`规格要求：${specification}`);
  if (quantity !== undefined && quantity !== null && quantity !== '') lines.push(`数量：${quantity}`);
  if (expectedDate) lines.push(`期望日期：${expectedDate}`);
  if (reason) lines.push(`申请原因：${reason}`);
  if (originalDescription) lines.push(`补充说明：${originalDescription}`);

  return lines.join('\n') || null;
}

function handleProcurementError(res, error, actionLabel) {
  console.error(`${actionLabel}失败:`, error);

  if (error?.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({
      success: false,
      message: '采购管理数据表不存在，请先初始化 procurement_requests 相关表结构',
      error: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: `${actionLabel}失败`,
    error: error.message,
  });
}

function buildProcurementQueryContext(columns) {
  const requestCodeExpr = buildSelectExpression(columns, ['request_code', 'request_no'], 'CAST(pr.id AS CHAR)');
  const requestDateExpr = buildSelectExpression(
    columns,
    ['request_date', 'approved_at', 'created_at'],
    'NULL',
  );
  const requestTypeExpr = buildSelectExpression(columns, ['request_type'], "'purchase'");
  const budgetExpr = buildSelectExpression(columns, ['budget_amount', 'budget'], 'NULL');
  const descriptionExpr = buildSelectExpression(columns, ['description', 'remark'], 'NULL');
  const justificationExpr = buildSelectExpression(columns, ['justification'], 'NULL');
  const approvalCommentsExpr = buildSelectExpression(
    columns,
    ['approval_comments', 'approval_opinion', 'opinion'],
    'NULL',
  );
  const approvalDateExpr = buildSelectExpression(columns, ['approval_date', 'approved_at'], 'NULL');
  const tenantExpr = buildSelectExpression(columns, ['tenant_id'], 'NULL');
  const createdAtExpr = buildSelectExpression(columns, ['created_at'], 'NULL');
  const updatedAtExpr = buildSelectExpression(columns, ['updated_at'], 'NULL');

  const joins = [];
  let departmentNameExpr = 'NULL';
  let departmentCodeExpr = 'NULL';
  let departmentIdExpr = 'NULL';
  if (hasColumn(columns, 'department_id')) {
    departmentIdExpr = 'pr.department_id';
    joins.push(
      `LEFT JOIN departments d ON d.id = pr.department_id${
        hasColumn(columns, 'tenant_id') ? ' AND d.tenant_id = pr.tenant_id' : ''}`,
    );
    departmentNameExpr = 'd.department_name';
    departmentCodeExpr = 'd.department_code';
  } else if (hasColumn(columns, 'department')) {
    departmentNameExpr = 'pr.department';
  }

  let requesterIdExpr = 'NULL';
  let requesterNameExpr = 'NULL';
  if (hasColumn(columns, 'requester_id')) {
    requesterIdExpr = 'pr.requester_id';
    joins.push(
      `LEFT JOIN users requester ON requester.id = pr.requester_id${
        hasColumn(columns, 'tenant_id') ? ' AND requester.tenant_id = pr.tenant_id' : ''}`,
    );
    requesterNameExpr = 'COALESCE(requester.real_name, requester.username)';
  } else if (hasColumn(columns, 'applicant_id')) {
    requesterIdExpr = 'pr.applicant_id';
    joins.push(
      `LEFT JOIN users requester ON requester.id = pr.applicant_id${
        hasColumn(columns, 'tenant_id') ? ' AND requester.tenant_id = pr.tenant_id' : ''}`,
    );
    requesterNameExpr = 'COALESCE(requester.real_name, requester.username)';
  } else if (hasColumn(columns, 'applicant')) {
    requesterNameExpr = 'pr.applicant';
  }

  let approverIdExpr = 'NULL';
  let approverNameExpr = 'NULL';
  if (hasColumn(columns, 'approver_id')) {
    approverIdExpr = 'pr.approver_id';
    joins.push(
      `LEFT JOIN users approver ON approver.id = pr.approver_id${
        hasColumn(columns, 'tenant_id') ? ' AND approver.tenant_id = pr.tenant_id' : ''}`,
    );
    approverNameExpr = 'COALESCE(approver.real_name, approver.username)';
  } else if (hasColumn(columns, 'approved_by')) {
    approverNameExpr = 'pr.approved_by';
  }

  return {
    requestCodeExpr,
    requestDateExpr,
    requestTypeExpr,
    budgetExpr,
    descriptionExpr,
    justificationExpr,
    approvalCommentsExpr,
    approvalDateExpr,
    tenantExpr,
    createdAtExpr,
    updatedAtExpr,
    departmentIdExpr,
    departmentNameExpr,
    departmentCodeExpr,
    requesterIdExpr,
    requesterNameExpr,
    approverIdExpr,
    approverNameExpr,
    fromClause: `FROM procurement_requests pr ${joins.join(' ')}`.trim(),
  };
}

async function listProcurements(req, res) {
  try {
    const columns = await getProcurementColumns();
    const queryContext = buildProcurementQueryContext(columns);
    const tenantId = getTenantId(req);
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize ?? req.query.limit, 20);
    const offset = (page - 1) * pageSize;
    const keyword = String(req.query.keyword || '').trim();
    const department = String(req.query.department || '').trim();
    const status = normalizeStatus(req.query.status);
    const startDate = normalizeDate(req.query.start_date);
    const endDate = normalizeDate(req.query.end_date);

    const whereConditions = [];
    const params = [];

    if (hasColumn(columns, 'tenant_id')) {
      whereConditions.push('pr.tenant_id = ?');
      params.push(tenantId);
    }

    // 横向越权防护：非管理员只能查看自己创建的采购申请
    // APPROVER_ROLES（super_admin/system_admin）可查看全部，便于审批
    if (!APPROVER_ROLES.has(req.user.role)) {
      const requesterColumn = pickFirstExistingColumn(columns, ['requester_id', 'applicant_id']);
      if (requesterColumn) {
        whereConditions.push(`pr.${requesterColumn} = ?`);
        params.push(req.user.id);
      }
    }

    if (status && hasColumn(columns, 'status')) {
      whereConditions.push('pr.status = ?');
      params.push(status);
    }

    if (keyword) {
      const searchColumns = [];
      const requestCodeColumn = pickFirstExistingColumn(columns, ['request_code', 'request_no']);
      if (requestCodeColumn) searchColumns.push(`pr.${requestCodeColumn}`);
      if (hasColumn(columns, 'title')) searchColumns.push('pr.title');
      if (hasColumn(columns, 'description')) searchColumns.push('pr.description');
      if (hasColumn(columns, 'justification')) searchColumns.push('pr.justification');
      if (hasColumn(columns, 'remark')) searchColumns.push('pr.remark');
      if (hasColumn(columns, 'department')) searchColumns.push('pr.department');

      if (searchColumns.length > 0) {
        whereConditions.push(`(${searchColumns.map(column => `${column} LIKE ?`).join(' OR ')})`);
        params.push(...searchColumns.map(() => `%${keyword}%`));
      }
    }

    if (department) {
      if (hasColumn(columns, 'department')) {
        whereConditions.push('pr.department LIKE ?');
        params.push(`%${department}%`);
      } else if (hasColumn(columns, 'department_id')) {
        whereConditions.push('(d.department_name LIKE ? OR d.department_code LIKE ?)');
        params.push(`%${department}%`, `%${department}%`);
      }
    }

    const requestDateColumn = pickFirstExistingColumn(columns, ['request_date', 'created_at']);
    if (startDate && requestDateColumn) {
      whereConditions.push(`DATE(pr.${requestDateColumn}) >= ?`);
      params.push(startDate);
    }

    if (endDate && requestDateColumn) {
      whereConditions.push(`DATE(pr.${requestDateColumn}) <= ?`);
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total ${queryContext.fromClause} ${whereClause}`,
      params,
    );

    const orderByColumn = pickFirstExistingColumn(columns, ['created_at', 'id']) || 'id';
    const [rows] = await db.execute(
      `
      SELECT
        pr.id,
        ${queryContext.requestCodeExpr} AS request_code,
        ${queryContext.requestTypeExpr} AS request_type,
        ${queryContext.requestDateExpr} AS request_date,
        ${queryContext.requesterIdExpr} AS requester_id,
        ${queryContext.requesterNameExpr} AS requester_name,
        ${queryContext.departmentIdExpr} AS department_id,
        ${queryContext.departmentNameExpr} AS department_name,
        ${queryContext.departmentCodeExpr} AS department_code,
        ${queryContext.budgetExpr} AS budget_amount,
        ${queryContext.descriptionExpr} AS description,
        ${queryContext.justificationExpr} AS justification,
        ${hasColumn(columns, 'status') ? 'pr.status' : "'pending'"} AS status,
        ${queryContext.approverIdExpr} AS approver_id,
        ${queryContext.approverNameExpr} AS approver_name,
        ${queryContext.approvalDateExpr} AS approval_date,
        ${queryContext.approvalCommentsExpr} AS approval_comments,
        ${queryContext.tenantExpr} AS tenant_id,
        ${queryContext.createdAtExpr} AS created_at,
        ${queryContext.updatedAtExpr} AS updated_at,
        ${hasColumn(columns, 'title') ? 'pr.title' : 'NULL'} AS title,
        ${hasColumn(columns, 'currency') ? 'pr.currency' : "'CNY'"} AS currency
      ${queryContext.fromClause}
      ${whereClause}
      ORDER BY pr.${orderByColumn} DESC, pr.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset],
    );

    const total = Number(countRows[0]?.total || 0);

    return res.json({
      success: true,
      message: '获取采购申请列表成功',
      data: rows.map(mapProcurementRow),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
      },
    });
  } catch (error) {
    return handleProcurementError(res, error, '获取采购申请列表');
  }
}

async function createProcurement(req, res) {
  try {
    const columns = await getProcurementColumns();
    const tenantId = getTenantId(req);
    const title = String(req.body.title || req.body.asset_name || '').trim();
    const department = String(req.body.department || '').trim();
    const requestType = ['purchase', 'lease', 'custom'].includes(req.body.request_type)
      ? req.body.request_type
      : 'purchase';
    const requestDate = normalizeDate(req.body.request_date) || new Date().toISOString().slice(0, 10);
    const budgetAmount = normalizeMoney(req.body.budget ?? req.body.estimated_cost);
    const justification = String(req.body.justification || req.body.reason || '').trim() || null;
    const description = buildDescription(req.body);

    if (!title) {
      return res.status(400).json({
        success: false,
        message: '采购标题不能为空',
      });
    }

    // 验证字段长度
    if (title.length > 200) {
      return res.status(400).json({ success: false, message: '采购标题长度不能超过200个字符' });
    }
    if (department.length > 100) {
      return res.status(400).json({ success: false, message: '部门名称长度不能超过100个字符' });
    }

    if (Number.isNaN(budgetAmount)) {
      return res.status(400).json({
        success: false,
        message: '预算金额必须是大于等于 0 的数字',
      });
    }

    // 验证数量字段
    const quantity = req.body.quantity;
    if (quantity !== undefined && quantity !== null && quantity !== '') {
      const numQuantity = Number(quantity);
      if (Number.isNaN(numQuantity) || numQuantity <= 0 || !Number.isInteger(numQuantity)) {
        return res.status(400).json({ success: false, message: '数量必须是正整数' });
      }
    }

    const departmentId = await resolveDepartmentId(tenantId, department);
    const requestCode = buildRequestCode();
    const now = new Date();
    const fields = [];
    const values = [];

    if (hasColumn(columns, 'request_code')) {
      fields.push('request_code');
      values.push(requestCode);
    } else if (hasColumn(columns, 'request_no')) {
      fields.push('request_no');
      values.push(requestCode);
    }

    if (hasColumn(columns, 'title')) {
      fields.push('title');
      values.push(title);
    }
    if (hasColumn(columns, 'request_type')) {
      fields.push('request_type');
      values.push(requestType);
    }
    if (hasColumn(columns, 'request_date')) {
      fields.push('request_date');
      values.push(requestDate);
    }
    if (hasColumn(columns, 'requester_id')) {
      fields.push('requester_id');
      values.push(req.user.id);
    } else if (hasColumn(columns, 'applicant_id')) {
      fields.push('applicant_id');
      values.push(req.user.id);
    } else if (hasColumn(columns, 'applicant')) {
      fields.push('applicant');
      values.push(req.user.real_name || req.user.username || null);
    }
    if (hasColumn(columns, 'department_id')) {
      fields.push('department_id');
      values.push(departmentId);
    } else if (hasColumn(columns, 'department')) {
      fields.push('department');
      values.push(department || null);
    }
    if (hasColumn(columns, 'budget_amount')) {
      fields.push('budget_amount');
      values.push(budgetAmount);
    } else if (hasColumn(columns, 'budget')) {
      fields.push('budget');
      values.push(budgetAmount);
    }
    if (hasColumn(columns, 'currency')) {
      fields.push('currency');
      values.push(String(req.body.currency || 'CNY').trim() || 'CNY');
    }
    if (hasColumn(columns, 'description')) {
      fields.push('description');
      values.push(description);
    }
    if (hasColumn(columns, 'justification')) {
      fields.push('justification');
      values.push(justification);
    } else if (hasColumn(columns, 'remark')) {
      fields.push('remark');
      values.push(description || justification);
    }
    if (hasColumn(columns, 'status')) {
      fields.push('status');
      values.push('pending');
    }
    if (hasColumn(columns, 'tenant_id')) {
      fields.push('tenant_id');
      values.push(tenantId);
    }
    if (hasColumn(columns, 'created_at')) {
      fields.push('created_at');
      values.push(now);
    }
    if (hasColumn(columns, 'updated_at')) {
      fields.push('updated_at');
      values.push(now);
    }

    // 使用事务确保数据一致性
    const result = await TransactionManager.executeTransaction(async connection => {
      const [insertResult] = await connection.execute(
        `INSERT INTO procurement_requests (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
        values,
      );
      return insertResult;
    });

    return res.status(201).json({
      success: true,
      message: '采购申请创建成功',
      data: {
        id: result.insertId,
        request_code: requestCode,
        request_no: requestCode,
        title,
        status: 'pending',
        tenant_id: tenantId,
      },
    });
  } catch (error) {
    return handleProcurementError(res, error, '创建采购申请');
  }
}

async function updateProcurement(req, res) {
  try {
    const columns = await getProcurementColumns();
    const tenantId = getTenantId(req);
    const requestId = parsePositiveInt(req.params.id, 0);

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: '采购申请 ID 无效',
      });
    }

    const selectParams = hasColumn(columns, 'tenant_id') ? [requestId, tenantId] : [requestId];
    const [rows] = await db.execute(buildProcurementDetailSelect(columns), selectParams);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '采购单不存在',
      });
    }

    const current = rows[0];

    // 状态前置校验：已进入审批流程（approved/rejected/executing/completed）的采购申请不可修改
    // 仅 draft/pending 状态可修改，避免审批后被篡改
    if (hasColumn(columns, 'status')) {
      const currentStatus = normalizeStatus(current.status) || (current.status ? String(current.status).toLowerCase() : 'pending');
      if (!['draft', 'pending'].includes(currentStatus)) {
        return res.status(403).json({
          success: false,
          message: `当前状态为「${currentStatus}」，仅草稿/待审批状态可修改`,
        });
      }
    }

    // 横向越权校验：非管理员只能修改自己创建的采购申请
    if (!APPROVER_ROLES.has(req.user.role)) {
      const requesterId = current.requester_id || current.applicant_id;
      if (requesterId && Number(requesterId) !== Number(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: '无权修改他人的采购申请',
        });
      }
    }

    const title = req.body.title !== undefined
      ? String(req.body.title || '').trim()
      : current.title;
    if (hasColumn(columns, 'title') && !title) {
      return res.status(400).json({
        success: false,
        message: '采购标题不能为空',
      });
    }

    const budgetInput = req.body.budget ?? req.body.budget_amount ?? req.body.estimated_cost;
    const budgetAmount = budgetInput !== undefined
      ? normalizeMoney(budgetInput)
      : normalizeMoney(current.budget_amount);
    if (Number.isNaN(budgetAmount)) {
      return res.status(400).json({
        success: false,
        message: '预算金额必须是大于等于 0 的数字',
      });
    }

    const acceptanceRecordIdInput = req.body.acceptance_record_id;
    const acceptanceRecordId = acceptanceRecordIdInput !== undefined
      ? normalizeNullablePositiveInt(acceptanceRecordIdInput)
      : normalizeNullablePositiveInt(current.acceptance_record_id);
    if (Number.isNaN(acceptanceRecordId)) {
      return res.status(400).json({
        success: false,
        message: '验收记录 ID 无效',
      });
    }

    if (!(await ensureAcceptanceRecordExists(tenantId, acceptanceRecordId, columns))) {
      return res.status(400).json({
        success: false,
        message: '关联验收单不存在',
      });
    }

    const department = req.body.department !== undefined
      ? String(req.body.department || '').trim() || null
      : current.department;
    const applicant = req.body.applicant !== undefined
      ? String(req.body.applicant || '').trim() || null
      : current.applicant;
    const remark = req.body.remark !== undefined
      ? String(req.body.remark || '').trim() || null
      : current.remark;
    const description = req.body.description !== undefined
      ? String(req.body.description || '').trim() || null
      : current.description;
    const justification = req.body.justification !== undefined
      ? String(req.body.justification || '').trim() || null
      : current.justification;

    const updateFields = [];
    const updateValues = [];
    const pushUpdate = (column, value) => {
      if (hasColumn(columns, column)) {
        updateFields.push(`${column} = ?`);
        updateValues.push(value);
      }
    };

    pushUpdate('title', title);
    pushUpdate('department', department);

    if (hasColumn(columns, 'department_id') && req.body.department !== undefined) {
      pushUpdate('department_id', await resolveDepartmentId(tenantId, department));
    }

    pushUpdate('applicant', applicant);
    pushUpdate('budget_amount', budgetAmount);
    pushUpdate('budget', budgetAmount);
    pushUpdate('description', description);
    pushUpdate('justification', justification);
    pushUpdate('remark', remark);
    pushUpdate('acceptance_record_id', acceptanceRecordId);

    if (hasColumn(columns, 'updated_at')) {
      updateFields.push('updated_at = ?');
      updateValues.push(new Date());
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '当前采购表没有可更新字段',
      });
    }

    await db.execute(
      `
      UPDATE procurement_requests
      SET ${updateFields.join(', ')}
      WHERE id = ? ${hasColumn(columns, 'tenant_id') ? 'AND tenant_id = ?' : ''}
      `,
      hasColumn(columns, 'tenant_id')
        ? [...updateValues, requestId, tenantId]
        : [...updateValues, requestId],
    );

    return res.json({
      success: true,
      message: '采购申请更新成功',
      data: {
        id: requestId,
        title,
        budget: budgetAmount,
        tenant_id: tenantId,
      },
    });
  } catch (error) {
    return handleProcurementError(res, error, '更新采购申请');
  }
}

async function uploadProcurementFile(req, res) {
  try {
    const tenantId = getTenantId(req);
    const requestId = parsePositiveInt(req.params.id, 0);

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: '采购申请 ID 无效',
      });
    }

    const [requests] = await db.execute(
      'SELECT id, requester_id, applicant_id, status FROM procurement_requests WHERE id = ? AND tenant_id = ? LIMIT 1',
      [requestId, tenantId],
    );
    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: '采购单不存在',
      });
    }

    // 横向越权校验：非管理员只能给自己创建的采购单上传附件
    if (!APPROVER_ROLES.has(req.user.role)) {
      const requesterId = requests[0].requester_id || requests[0].applicant_id;
      if (requesterId && Number(requesterId) !== Number(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: '无权为他人的采购申请上传附件',
        });
      }
    }

    // 状态前置校验：已审批完成的采购单不可再上传附件
    const currentStatus = normalizeStatus(requests[0].status) || (requests[0].status ? String(requests[0].status).toLowerCase() : 'pending');
    if (!['draft', 'pending'].includes(currentStatus)) {
      return res.status(403).json({
        success: false,
        message: `当前状态为「${currentStatus}」，仅草稿/待审批状态可上传附件`,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传采购附件',
      });
    }

    const fileType = String(req.body.file_type || req.body.type || 'attachment').trim() || 'attachment';
    const [result] = await db.execute(
      `
      INSERT INTO procurement_files (
        tenant_id, procurement_request_id, file_type, original_name, file_name,
        file_path, mime_type, file_size, uploaded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        tenantId,
        requestId,
        fileType,
        req.file.originalname || null,
        req.file.filename || null,
        req.file.path || null,
        req.file.mimetype || null,
        req.file.size || 0,
        req.user?.id || null,
      ],
    );

    return res.status(201).json({
      success: true,
      message: '采购附件上传成功',
      data: {
        id: result.insertId,
        request_id: requestId,
        file_type: fileType,
      },
    });
  } catch (error) {
    return handleProcurementError(res, error, '上传采购附件');
  }
}

async function approveProcurement(req, res) {
  try {
    const columns = await getProcurementColumns();
    if (!APPROVER_ROLES.has(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '当前角色无权审批采购申请',
      });
    }

    if (!hasColumn(columns, 'status')) {
      return res.status(500).json({
        success: false,
        message: '当前采购表缺少 status 字段，无法执行审批动作',
      });
    }

    const tenantId = getTenantId(req);
    const requestId = parsePositiveInt(req.params.id, 0);
    const action = String(req.body.action || '').trim().toLowerCase();
    const approvedFlag = req.body.approved;
    const comment = String(req.body.comment || req.body.opinion || '').trim() || null;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: '采购申请 ID 无效',
      });
    }

    let nextStatus = null;
    if (action === 'approve' || approvedFlag === true) {
      nextStatus = 'approved';
    } else if (action === 'reject' || approvedFlag === false) {
      nextStatus = 'rejected';
    }

    if (!nextStatus) {
      return res.status(400).json({
        success: false,
        message: '审批动作无效，必须为 approve/reject 或 approved 布尔值',
      });
    }

    const requestCodeExpr = buildSelectExpression(columns, ['request_code', 'request_no'], 'CAST(id AS CHAR)');
    const [rows] = await db.execute(
      `SELECT pr.id, ${requestCodeExpr} AS request_code, ${hasColumn(columns, 'title') ? 'pr.title' : 'NULL AS title'}, ${hasColumn(columns, 'status') ? 'pr.status' : "'pending'"} AS status FROM procurement_requests pr WHERE pr.id = ? AND ${hasColumn(columns, 'tenant_id') ? 'pr.tenant_id = ? AND ' : ''}1=1 LIMIT 1`,
      hasColumn(columns, 'tenant_id') ? [requestId, tenantId] : [requestId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '采购申请不存在',
      });
    }

    // 状态前置校验：仅 pending 状态可审批，避免重复审批或审批已完结流程
    const currentStatus = normalizeStatus(rows[0].status) || (rows[0].status ? String(rows[0].status).toLowerCase() : 'pending');
    if (currentStatus !== 'pending') {
      return res.status(403).json({
        success: false,
        message: `当前状态为「${currentStatus}」，仅待审批状态可执行审批动作`,
      });
    }

    const approvalDate = new Date();
    const updateFields = ['status = ?'];
    const updateValues = [nextStatus];

    if (hasColumn(columns, 'approver_id')) {
      updateFields.push('approver_id = ?');
      updateValues.push(req.user.id);
    } else if (hasColumn(columns, 'approved_by')) {
      updateFields.push('approved_by = ?');
      updateValues.push(req.user.real_name || req.user.username || null);
    }
    if (hasColumn(columns, 'approval_date')) {
      updateFields.push('approval_date = ?');
      updateValues.push(approvalDate);
    } else if (hasColumn(columns, 'approved_at')) {
      updateFields.push('approved_at = ?');
      updateValues.push(approvalDate);
    }
    if (hasColumn(columns, 'approval_comments')) {
      updateFields.push('approval_comments = ?');
      updateValues.push(comment);
    } else if (hasColumn(columns, 'approval_opinion')) {
      updateFields.push('approval_opinion = ?');
      updateValues.push(comment);
    } else if (hasColumn(columns, 'remark')) {
      updateFields.push('remark = ?');
      updateValues.push(comment);
    }
    if (hasColumn(columns, 'updated_at')) {
      updateFields.push('updated_at = ?');
      updateValues.push(approvalDate);
    }

    await db.execute(
      `
      UPDATE procurement_requests
      SET ${updateFields.join(', ')}
      WHERE id = ? ${hasColumn(columns, 'tenant_id') ? 'AND tenant_id = ?' : ''}
      `,
      hasColumn(columns, 'tenant_id')
        ? [...updateValues, requestId, tenantId]
        : [...updateValues, requestId],
    );

    return res.json({
      success: true,
      message: nextStatus === 'approved' ? '采购申请已批准' : '采购申请已驳回',
      data: {
        id: requestId,
        request_code: rows[0].request_code,
        title: rows[0].title,
        status: nextStatus,
        approval_comments: comment,
      },
    });
  } catch (error) {
    return handleProcurementError(res, error, '审批采购申请');
  }
}

router.get(['/', '/requests'], authenticate, requireTenantId, listProcurements);
router.post(['/', '/requests'], authenticate, requireTenantId, createProcurement);
router.put(['/:id', '/requests/:id'], authenticate, requireTenantId, updateProcurement);
router.post(
  ['/:id/files', '/requests/:id/files'],
  authenticate,
  requireTenantId,
  upload.single('file'),
  fileSecurity(),
  uploadProcurementFile,
);
router.put(['/:id/approve', '/requests/:id/approve'], authenticate, requireTenantId, approveProcurement);

router.__testables = {
  resetProcurementColumnsCache,
};

module.exports = router;
