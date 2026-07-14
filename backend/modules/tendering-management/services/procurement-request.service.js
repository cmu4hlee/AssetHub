// ============================================================
// 采购申请前置服务（tendering-management 模块内部）
// 把历史上 procurement_requests 单表语义，迁移为 tender_projects 表的前置阶段（tender_category='simple'/'agreement'）
// 全部数据走 tender_projects 表，不再写 procurement_requests（旧表只读）
// ============================================================

const BaseService = require('../../../core/BaseService');
const db = require('../../../config/database');
const { AppError } = require('../../../utils/error-handler');
const logger = require('../../../config/logger');

const PROCUREMENT_STATUS_ALIASES = {
  draft: 'applying',
  pending: 'applying',
  pending_approval: 'applying',
  approved: 'awarded',
  rejected: 'cancelled',
  executing: 'contract_signing',
  completed: 'completed',
};
const CATEGORY_FOR_PROCUREMENT = ['simple', 'agreement'];

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeMoney(value) {
  if (value === undefined || value === null || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : Number.NaN;
}

function normalizeDate(value) {
  if (!value) return null;
  const source = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) return source;
  const d = new Date(source);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildRequestCode(category) {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const prefix = category === 'simple' ? 'CGJ' : category === 'agreement' ? 'CGA' : 'CG';
  return `${prefix}${datePart}${Date.now().toString().slice(-6)}${randomPart}`;
}

function ensureSchemaCompatibility(columns) {
  // 期望 tender_projects 上有 tender_category / requestor_id / request_budget 等列
  const missing = [
    'tender_category', 'requestor_id', 'requestor_name', 'request_department',
    'request_budget', 'expected_delivery_date', 'asset_specification',
    'procurement_request_id',
  ].filter(c => !columns.has(c));
  return missing;
}

class ProcurementRequestService extends BaseService {
  constructor(options = {}) {
    super({ name: 'ProcurementRequestService', ...options });
  }

  async _columns() {
    const [rows] = await db.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tender_projects'`,
    );
    return new Set(rows.map(r => r.COLUMN_NAME));
  }

  async listProcurementRequests(tenantId, { page = 1, pageSize = 20, status, category, keyword, department } = {}) {
    const columns = await this._columns();
    const missing = ensureSchemaCompatibility(columns);
    if (missing.length > 0) {
      throw new AppError(
        `tender_projects 缺少合并所需的字段：${missing.join(',')}。请执行 009_unify_procurement_tendering.sql 迁移。`,
        500,
        'TENDER_PROCUREMENT_SCHEMA_MISSING',
      );
    }
    const pageNum = parsePositiveInt(page, 1);
    const pageSizeNum = parsePositiveInt(pageSize, 20);
    const offset = (pageNum - 1) * pageSizeNum;

    const where = ['tenant_id = ?', "tender_category IN ('simple','agreement')", 'deleted_at IS NULL'];
    const params = [tenantId];
    if (category && CATEGORY_FOR_PROCUREMENT.includes(category)) {
      where[1] = 'tender_category = ?';
      params.push(category);
    }
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (department) {
      where.push('request_department LIKE ?');
      params.push(`%${department}%`);
    }
    if (keyword) {
      where.push('(title LIKE ? OR tender_code LIKE ? OR requestor_name LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    const whereClause = `WHERE ${where.join(' AND ')}`;

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM tender_projects ${whereClause}`,
      params,
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.execute(
      `SELECT id, tender_code AS request_code, title, tender_category, status,
              requestor_id, requestor_name, request_department,
              request_budget, expected_delivery_date, asset_specification,
              created_by, created_at, updated_at
       FROM tender_projects ${whereClause}
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, pageSizeNum, offset],
    );

    return {
      data: rows,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: pageSizeNum > 0 ? Math.ceil(total / pageSizeNum) : 0,
      },
    };
  }

  async getProcurementRequestById(id, tenantId) {
    const [rows] = await db.execute(
      `SELECT * FROM tender_projects
       WHERE id = ? AND tenant_id = ? AND tender_category IN ('simple','agreement')
         AND deleted_at IS NULL LIMIT 1`,
      [id, tenantId],
    );
    if (rows.length === 0) {
      throw new AppError('采购申请不存在', 404, 'PROCUREMENT_REQUEST_NOT_FOUND');
    }
    return rows[0];
  }

  async createProcurementRequest(tenantId, body, user) {
    const columns = await this._columns();
    const missing = ensureSchemaCompatibility(columns);
    if (missing.length > 0) {
      throw new AppError(
        `tender_projects 缺少合并所需的字段：${missing.join(',')}。请执行 009_unify_procurement_tendering.sql 迁移。`,
        500,
        'TENDER_PROCUREMENT_SCHEMA_MISSING',
      );
    }
    const title = String(body.title || body.asset_name || '').trim();
    if (!title) throw new AppError('采购标题不能为空', 400, 'MISSING_TITLE');
    const category = CATEGORY_FOR_PROCUREMENT.includes(body.tender_category) ? body.tender_category : 'simple';
    const requestBudget = normalizeMoney(body.budget_amount ?? body.budget ?? body.estimated_cost ?? body.request_budget);
    if (Number.isNaN(requestBudget)) {
      throw new AppError('预算金额必须是大于等于 0 的数字', 400, 'INVALID_BUDGET');
    }
    const expectedDate = normalizeDate(body.expected_date ?? body.expected_delivery_date);
    const requestCode = buildRequestCode(category);
    const now = new Date();

    const [insert] = await db.execute(
      `INSERT INTO tender_projects (
        tenant_id, tender_code, title, tender_type, tender_category,
        requestor_id, requestor_name, request_department, request_budget,
        expected_delivery_date, asset_specification,
        currency, status, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, requestCode, title, 'asset_purchase', category,
        user?.id || null, user?.real_name || user?.username || null,
        body.department || body.request_department || null, requestBudget,
        expectedDate, body.specification || body.asset_specification || null,
        String(body.currency || 'CNY').trim() || 'CNY', 'applying',
        user?.id || null, now,
      ],
    );

    publishAsync('procurement:request:created', {
      id: insert.insertId,
      request_code: requestCode,
      title,
      category,
      requestor_id: user?.id,
      tenantId,
    }).catch(e => logger.warn('发布 procurement:request:created 事件失败:', e.message));

    return { id: insert.insertId, request_code: requestCode, title, status: 'applying', tender_category: category };
  }

  async updateProcurementRequest(id, tenantId, body) {
    const existing = await this.getProcurementRequestById(id, tenantId);
    if (existing.status !== 'applying') {
      throw new AppError('只能修改采购申请前置阶段的记录', 400, 'INVALID_STATUS');
    }
    const title = body.title !== undefined ? String(body.title).trim() : existing.title;
    if (!title) throw new AppError('采购标题不能为空', 400, 'MISSING_TITLE');

    const budgetInput = body.budget_amount ?? body.budget ?? body.estimated_cost ?? body.request_budget;
    const requestBudget = budgetInput !== undefined ? normalizeMoney(budgetInput) : existing.request_budget;
    if (Number.isNaN(requestBudget)) throw new AppError('预算金额非法', 400, 'INVALID_BUDGET');

    const requestor = body.requestor_name !== undefined
      ? String(body.requestor_name).trim()
      : existing.requestor_name;
    const department = body.department !== undefined || body.request_department !== undefined
      ? String(body.department || body.request_department || '').trim()
      : existing.request_department;
    const expectedDate = (body.expected_date !== undefined || body.expected_delivery_date !== undefined)
      ? normalizeDate(body.expected_date ?? body.expected_delivery_date)
      : existing.expected_delivery_date;
    const specification = body.specification !== undefined || body.asset_specification !== undefined
      ? String(body.specification || body.asset_specification || '').trim() || null
      : existing.asset_specification;

    await db.execute(
      `UPDATE tender_projects SET
        title = ?, request_budget = ?, requestor_name = ?,
        request_department = ?, expected_delivery_date = ?, asset_specification = ?,
        updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [title, requestBudget, requestor, department, expectedDate, specification, id, tenantId],
    );
    publishAsync('procurement:request:updated', { id, tenantId });
    return { id };
  }

  async submitProcurementRequest(id, tenantId, user) {
    const existing = await this.getProcurementRequestById(id, tenantId);
    if (existing.status !== 'applying') {
      throw new AppError('仅 applying 状态的采购申请可提交', 400, 'INVALID_STATUS');
    }
    // applying 已是可提交状态；保留原 record id；不修改 status，仅打日志/事件
    publishAsync('procurement:request:submitted', { id, tenantId, userId: user?.id });
    return { id, status: 'applying' };
  }

  async approveProcurementRequest(id, tenantId, user, opinion, action /* 'approve' | 'reject' */) {
    const existing = await this.getProcurementRequestById(id, tenantId);
    if (existing.status !== 'applying') {
      throw new AppError('仅 applying 状态的采购申请可审批', 400, 'INVALID_STATUS');
    }
    const next = action === 'reject' ? 'cancelled' : (existing.tender_category === 'simple' ? 'completed' : 'awarded');
    await db.execute(
      `UPDATE tender_projects SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [next, id, tenantId],
    );
    publishAsync('procurement:request:approved', {
      id, tenantId, approverId: user?.id, action, next, opinion,
    });
    return { id, status: next };
  }

  async deleteProcurementRequest(id, tenantId) {
    const existing = await this.getProcurementRequestById(id, tenantId);
    if (existing.status !== 'applying') {
      throw new AppError('只能删除 applying 状态的采购申请', 400, 'INVALID_STATUS');
    }
    await db.execute(
      `UPDATE tender_projects SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [id, tenantId],
    );
    publishAsync('procurement:request:deleted', { id, tenantId });
    return { id };
  }
}

let publishAsync;
try {
  // 复用 tendering-management 内部事件总线，避免循环依赖
  const { getEventBus } = require('../../../core/EventBus');
  publishAsync = (eventName, payload) => Promise.resolve().then(() => getEventBus().publish(eventName, payload));
} catch (e) {
  publishAsync = async () => {};
  logger.warn('ProcurementRequestService 未能加载 EventBus.publish:', e.message);
}

module.exports = ProcurementRequestService;
