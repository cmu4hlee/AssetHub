// ============================================================
// 采购与招标 — 付款管理 TenderingPaymentService
// 5 态：draft → submitted → paying → paid / failed
// 监听 tender:payment:paid 自动 mark milestone paid + invoice paid 提示
// 与 tender_payment_milestones / tender_invoices / tender_contracts 关联
// ============================================================

const BaseService = require('../../../core/BaseService');
const db = require('../../../config/database');
const { AppError } = require('../../../utils/error-handler');
const logger = require('../../../config/logger');

const PAYMENT_STATUSES = ['draft', 'submitted', 'paying', 'paid', 'failed', 'cancelled'];
const PAYMENT_TRANSITIONS = {
  draft:     ['submitted', 'cancelled'],
  submitted: ['paying', 'cancelled', 'failed'],
  paying:    ['paid', 'failed', 'cancelled'],
  paid:      [],   // 终态
  failed:    ['submitted', 'cancelled'],
  cancelled: [],   // 终态
};

const PAY_METHODS = ['bank_transfer', 'check', 'cash', 'other'];

function isValidPayTransition(from, to) {
  return (PAYMENT_TRANSITIONS[from] || []).includes(to);
}
function parsePositiveInt(v, fallback) {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
function normalizeMoney(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function nowStr() { return new Date().toISOString().slice(0, 19).replace('T', ' '); }
async function emit(name, payload) {
  try {
    const { getEventBus } = require('../../../core/EventBus');
    getEventBus().publish(name, payload);
  } catch (e) { logger.warn(`[PaymentService] 事件 ${name} 失败: ${e.message}`); }
}
function buildPaymentCode() {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rnd = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  return `PAY${date}-${rnd}`;
}

function validatePayMethod(m) { return PAY_METHODS.includes(m) ? m : 'bank_transfer'; }

class TenderingPaymentService extends BaseService {
  constructor(options = {}) {
    super({ name: 'TenderingPaymentService', ...options });
  }

  async _existsPaymentTable() {
    const [rows] = await db.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tender_payments'` );
    return rows.length > 0;
  }

  async _selectPayment(id, tenantId, { withFiles = false } = {}) {
    const [rows] = await db.execute(
      `SELECT * FROM tender_payments WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1`,
      [id, tenantId],
    );
    if (rows.length === 0) throw new AppError('付款单不存在', 404, 'PAYMENT_NOT_FOUND');
    const p = rows[0];
    if (withFiles) {
      const [files] = await db.execute(
        `SELECT id, file_type, original_name, file_name, file_path, mime_type, file_size, uploaded_by, created_at
         FROM tender_payment_files WHERE payment_id = ? ORDER BY id DESC`, [id]);
      p.files = files;
    }
    return p;
  }

  async listPayments(tenantId, params) {
    if (!(await this._existsPaymentTable())) {
      return { data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
    }
    const { page = 1, pageSize = 20, status, contract_id, milestone_id, invoice_id, supplier_id, pay_from, pay_to, keyword } = params;
    const pageNum = parsePositiveInt(page, 1);
    const pageSizeNum = parsePositiveInt(pageSize, 20);
    const offset = (pageNum - 1) * pageSizeNum;
    const where = ['tenant_id = ?', 'deleted_at IS NULL'];
    const qp = [tenantId];
    if (status && PAYMENT_STATUSES.includes(status)) { where.push('status = ?'); qp.push(status); }
    if (contract_id) { where.push('contract_id = ?'); qp.push(contract_id); }
    if (milestone_id) { where.push('milestone_id = ?'); qp.push(milestone_id); }
    if (invoice_id) { where.push('invoice_id = ?'); qp.push(invoice_id); }
    if (supplier_id) { where.push('supplier_id = ?'); qp.push(supplier_id); }
    if (pay_from) { where.push('pay_date >= ?'); qp.push(pay_from); }
    if (pay_to) { where.push('pay_date <= ?'); qp.push(pay_to); }
    if (keyword) { where.push('(payment_code LIKE ? OR payee_name LIKE ? OR remark LIKE ?)'); qp.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
    const whereSQL = `WHERE ${where.join(' AND ')}`;
    const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM tender_payments ${whereSQL}`, qp);
    const total = Number(countRows[0]?.total || 0);
    const [rows] = await db.execute(
      `SELECT id, payment_code, contract_id, milestone_id, invoice_id, tender_id, supplier_id,
              payee_name, amount, currency, pay_method, bank_name, bank_account,
              pay_date, paid_at, status, failure_reason, applicant_id,
              created_by, created_at, updated_at
       FROM tender_payments ${whereSQL}
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...qp, pageSizeNum, offset],
    );
    return {
      data: rows,
      pagination: { page: pageNum, pageSize: pageSizeNum, total, totalPages: pageSizeNum > 0 ? Math.ceil(total / pageSizeNum) : 0 },
    };
  }

  async getPaymentById(id, tenantId) {
    return this._selectPayment(id, tenantId, { withFiles: true });
  }

  async createPayment(tenantId, body, user) {
    if (!(await this._existsPaymentTable())) {
      throw new AppError('tender_payments 表不存在，请执行 011_payments_acceptances_logs.sql', 500, 'PAYMENT_TABLE_MISSING');
    }
    const amount = normalizeMoney(body.amount);
    if (Number.isNaN(amount)) throw new AppError('付款金额非法', 400, 'INVALID_AMOUNT');
    const payMethod = validatePayMethod(body.pay_method);
    const payCode = buildPaymentCode();
    const [r] = await db.execute(
      `INSERT INTO tender_payments (
        tenant_id, payment_code, contract_id, milestone_id, invoice_id, tender_id, supplier_id,
        applicant_id, payee_name, amount, currency, pay_method, bank_name, bank_account,
        pay_date, status, remark, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, payCode, body.contract_id || null, body.milestone_id || null,
        body.invoice_id || null, body.tender_id || null, body.supplier_id || null,
        user?.id || null, body.payee_name || null, amount,
        String(body.currency || 'CNY').trim() || 'CNY',
        payMethod, body.bank_name || null, body.bank_account || null,
        body.pay_date || null, 'draft', body.remark || null,
        user?.id || null, nowStr(),
      ],
    );
    await emit('tender:payment:created', { id: r.insertId, payment_code: payCode, tenantId, userId: user?.id });
    return { id: r.insertId, payment_code: payCode, status: 'draft' };
  }

  async updatePayment(id, tenantId, body) {
    const p = await this._selectPayment(id, tenantId);
    if (p.status !== 'draft') throw new AppError('仅 draft 可编辑', 400, 'INVALID_STATUS');
    const allowed = ['payee_name', 'amount', 'currency', 'pay_method', 'bank_name', 'bank_account',
      'pay_date', 'contract_id', 'milestone_id', 'invoice_id', 'tender_id', 'supplier_id', 'remark'];
    const setCols = []; const setVals = [];
    for (const k of allowed) {
      if (body[k] === undefined) continue;
      setCols.push(`${k} = ?`);
      setVals.push(k === 'amount' ? normalizeMoney(body[k])
        : k === 'pay_method' ? validatePayMethod(body[k])
        : body[k]);
    }
    if (setCols.length === 0) throw new AppError('无可更新字段', 400, 'EMPTY_UPDATE');
    setCols.push('updated_at = ?'); setVals.push(nowStr());
    setVals.push(id, tenantId);
    await db.execute(`UPDATE tender_payments SET ${setCols.join(', ')} WHERE id = ? AND tenant_id = ?`, setVals);
    await emit('tender:payment:updated', { id, tenantId });
    return { id };
  }

  async _transition(id, tenantId, user, fromStatus, toStatus, extra = {}) {
    const p = await this._selectPayment(id, tenantId);
    if (p.status !== fromStatus) {
      throw new AppError(`当前状态 ${p.status}，不能从 ${fromStatus} 流转到 ${toStatus}`, 400, 'INVALID_TRANSITION');
    }
    if (!isValidPayTransition(fromStatus, toStatus)) {
      throw new AppError(`状态机不允许 ${fromStatus} → ${toStatus}`, 400, 'INVALID_TRANSITION');
    }

    // 高风险门：submitted → paying(意味着走付款流程)→ 先查已批准 record 放行
    if (toStatus === 'paying' && user) {
      const triggerAction = 'pay';
      const entityType = 'tender_payments';
      let alreadyApproved = false;
      try {
        const ApprovalEngine = require('./approval-engine.service');
        const engine = new ApprovalEngine();
        alreadyApproved = await engine.hasApprovedRecord({
          tenantId, entity_type: entityType, entity_id: id, trigger_action: triggerAction,
        });
      } catch (e) {
        logger.warn(`[PaymentService] hasApprovedRecord 异常，按未批准处理: ${e.message}`);
      }
      if (!alreadyApproved) {
        try {
          const ApprovalEngine = require('./approval-engine.service');
          const engine = new ApprovalEngine();
          const ctx = { amount: Number(p.amount || 0) };
          const approval = await engine.requestApproval({
            tenantId, entity_type: entityType, entity_id: id,
            trigger_action: triggerAction, context: ctx, initiator: user, new_status: toStatus,
          });
          if (approval.approved === false) {
            await emit('tender:payment:approval_pending', {
              id, tenantId, userId: user.id, record_id: approval.record_id,
              flow_code: approval.flow?.flow_code,
            });
            return { id, status: p.status, pending_approval: true, record_id: approval.record_id };
          }
        } catch (e) {
          logger.warn(`[PaymentService] 审批引擎不可用，放行: ${e.message}`);
        }
      } else {
        logger.info(`[PaymentService] entity=${id} trigger=${triggerAction} 已批准,跳过审批门,落地 status=${toStatus}`);
      }
    }
    const setCols = ['status = ?', 'updated_at = ?'];
    const setVals = [toStatus, nowStr()];
    if (toStatus === 'paid') { setCols.push('paid_at = ?'); setVals.push(nowStr()); }
    if (toStatus === 'failed' && extra.failure_reason) {
      setCols.push('failure_reason = ?'); setVals.push(String(extra.failure_reason).slice(0, 500));
    }
    if (toStatus === 'submitted' && user?.id) {
      setCols.push('approved_by = ?, approved_at = ?'); setVals.push(user.id, nowStr());
    }
    setVals.push(id, tenantId);
    await db.execute(`UPDATE tender_payments SET ${setCols.join(', ')} WHERE id = ? AND tenant_id = ?`, setVals);
    await emit(`tender:payment:${toStatus}`, { id, tenantId, userId: user?.id, from: fromStatus, to: toStatus, payment: { ...p, status: toStatus } });
    return { id, status: toStatus };
  }

  async submitPayment(id, tenantId, user)  { return this._transition(id, tenantId, user, 'draft', 'submitted'); }
  async payPayment(id, tenantId, user)     { return this._transition(id, tenantId, user, 'submitted', 'paying'); }
  async completePayment(id, tenantId, user){ return this._transition(id, tenantId, user, 'paying', 'paid'); }
  async failPayment(id, tenantId, user, reason) { return this._transition(id, tenantId, user, 'submitted', 'failed', { failure_reason: reason }); }
  async reSubmitPayment(id, tenantId, user) { return this._transition(id, tenantId, user, 'failed', 'submitted'); }
  async cancelPayment(id, tenantId, user)  {
    const p = await this._selectPayment(id, tenantId);
    if (p.status === 'paid') throw new AppError('已付付款单不可取消', 400, 'INVALID_TRANSITION');
    return this._transition(id, tenantId, user, p.status, 'cancelled');
  }
  async deletePayment(id, tenantId) {
    const p = await this._selectPayment(id, tenantId);
    if (p.status !== 'draft') throw new AppError('仅 draft 可删除', 400, 'INVALID_STATUS');
    await db.execute(`UPDATE tender_payments SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
    await emit('tender:payment:deleted', { id, tenantId });
    return { id };
  }

  async getPaymentStatistics(tenantId) {
    if (!(await this._existsPaymentTable())) {
      return { by_status: [], total: { count: 0, amount: 0 } };
    }
    const [byStatus] = await db.execute(
      `SELECT status, COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS amount
       FROM tender_payments WHERE tenant_id = ? AND deleted_at IS NULL GROUP BY status`,
      [tenantId]);
    const [totals] = await db.execute(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS amount FROM tender_payments
       WHERE tenant_id = ? AND deleted_at IS NULL`, [tenantId]);
    return {
      by_status: byStatus,
      total: { count: Number(totals[0]?.cnt || 0), amount: Number(totals[0]?.amount || 0) },
    };
  }
}

module.exports = TenderingPaymentService;
