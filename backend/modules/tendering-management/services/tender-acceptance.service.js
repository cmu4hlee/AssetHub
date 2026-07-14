// ============================================================
// 采购与招标 — 验收管理 TenderingAcceptanceService
// 4 态：pending → accepted / rejected → closed（终态）
// accepted 后会自动：1) 触发 assets 入库；2) 联动 invoice 从 claimed → paid 可选
// rejected 后允许 reprocess 重新进入 pending
// ============================================================

const BaseService = require('../../../core/BaseService');
const db = require('../../../config/database');
const { AppError } = require('../../../utils/error-handler');
const logger = require('../../../config/logger');

const ACCEPTANCE_STATUSES = ['pending', 'accepted', 'rejected', 'closed'];
const ACCEPTANCE_TRANSITIONS = {
  pending:  ['accepted', 'rejected'],
  accepted: ['closed'],
  rejected: ['pending'],   // 重新提交
  closed:   [],           // 终态
};

function isValidAccTransition(from, to) { return (ACCEPTANCE_TRANSITIONS[from] || []).includes(to); }
function nowStr() { return new Date().toISOString().slice(0, 19).replace('T', ' '); }

async function emit(name, payload) {
  try {
    const { getEventBus } = require('../../../core/EventBus');
    getEventBus().publish(name, payload);
  } catch (e) { logger.warn(`[AcceptanceService] 事件 ${name} 失败: ${e.message}`); }
}

function buildAcceptanceCode() {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rnd = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  return `YZS${date}-${rnd}`;
}

class TenderingAcceptanceService extends BaseService {
  constructor(options = {}) {
    super({ name: 'TenderingAcceptanceService', ...options });
  }

  async _exists() {
    const [rows] = await db.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tender_acceptances'`);
    return rows.length > 0;
  }

  async _select(id, tenantId, withFiles = false) {
    const [rows] = await db.execute(
      `SELECT * FROM tender_acceptances WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1`,
      [id, tenantId],
    );
    if (rows.length === 0) throw new AppError('验收单不存在', 404, 'ACCEPTANCE_NOT_FOUND');
    const a = rows[0];
    if (withFiles) {
      const [files] = await db.execute(
        `SELECT id, file_type, original_name, file_name, file_path, mime_type, file_size, uploaded_by, created_at
         FROM tender_acceptance_files WHERE acceptance_id = ? ORDER BY id DESC`, [id]);
      a.files = files;
    }
    return a;
  }

  async list(tenantId, params) {
    if (!(await this._exists())) {
      return { data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
    }
    const { page = 1, pageSize = 20, status, contract_id, tender_id, asset_id, invoice_id, keyword } = params;
    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const where = ['tenant_id = ?', 'deleted_at IS NULL'];
    const qp = [tenantId];
    if (status && ACCEPTANCE_STATUSES.includes(status)) { where.push('status = ?'); qp.push(status); }
    if (contract_id) { where.push('contract_id = ?'); qp.push(contract_id); }
    if (tender_id) { where.push('tender_id = ?'); qp.push(tender_id); }
    if (asset_id) { where.push('asset_id = ?'); qp.push(asset_id); }
    if (invoice_id) { where.push('invoice_id = ?'); qp.push(invoice_id); }
    if (keyword) { where.push('(acceptance_code LIKE ? OR inspection_note LIKE ? OR remark LIKE ?)'); qp.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
    const whereSQL = `WHERE ${where.join(' AND ')}`;
    const [cr] = await db.execute(`SELECT COUNT(*) AS total FROM tender_acceptances ${whereSQL}`, qp);
    const total = Number(cr[0]?.total || 0);
    const [rows] = await db.execute(
      `SELECT id, acceptance_code, contract_id, tender_id, asset_id, invoice_id, scheduled_date, accepted_at,
              accepted_quantity, rejected_quantity, inspector_id, status, inspection_note, remark,
              created_by, created_at, updated_at
       FROM tender_acceptances ${whereSQL}
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...qp, parseInt(pageSize, 10), offset],
    );
    return { data: rows, pagination: { page: parseInt(page, 10), pageSize: parseInt(pageSize, 10), total, totalPages: Math.ceil(total / parseInt(pageSize, 10)) || 0 } };
  }

  async getById(id, tenantId) { return this._select(id, tenantId, true); }

  async create(tenantId, body, user) {
    if (!(await this._exists())) throw new AppError('tender_acceptances 表不存在', 500, 'ACCEPTANCE_TABLE_MISSING');
    const code = buildAcceptanceCode();
    const [r] = await db.execute(
      `INSERT INTO tender_acceptances (
        tenant_id, acceptance_code, contract_id, tender_id, asset_id, invoice_id,
        scheduled_date, accepted_quantity, rejected_quantity, inspector_id,
        inspection_note, remark, status, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, code, body.contract_id || null, body.tender_id || null, body.asset_id || null,
        body.invoice_id || null, body.scheduled_date || null,
        Number(body.accepted_quantity || 0), Number(body.rejected_quantity || 0),
        body.inspector_id || user?.id || null,
        body.inspection_note || null, body.remark || null, 'pending',
        user?.id || null, nowStr(),
      ],
    );
    await emit('tender:acceptance:created', { id: r.insertId, acceptance_code: code, tenantId, userId: user?.id });
    return { id: r.insertId, acceptance_code: code, status: 'pending' };
  }

  async update(id, tenantId, body) {
    const a = await this._select(id, tenantId);
    if (a.status !== 'pending') throw new AppError('仅 pending 可编辑', 400, 'INVALID_STATUS');
    const allowed = ['scheduled_date', 'accepted_quantity', 'rejected_quantity', 'inspector_id',
      'inspection_note', 'remark', 'contract_id', 'tender_id', 'asset_id', 'invoice_id'];
    const set = []; const val = [];
    for (const k of allowed) {
      if (body[k] === undefined) continue;
      set.push(`${k} = ?`);
      val.push(['accepted_quantity', 'rejected_quantity'].includes(k) ? Number(body[k] || 0) : body[k]);
    }
    if (set.length === 0) throw new AppError('无可更新字段', 400, 'EMPTY_UPDATE');
    set.push('updated_at = ?'); val.push(nowStr());
    val.push(id, tenantId);
    await db.execute(`UPDATE tender_acceptances SET ${set.join(', ')} WHERE id = ? AND tenant_id = ?`, val);
    return { id };
  }

  async _transition(id, tenantId, user, fromStatus, toStatus, extra = {}) {
    const a = await this._select(id, tenantId);
    if (a.status !== fromStatus) {
      throw new AppError(`当前状态 ${a.status}，不能从 ${fromStatus} 流转到 ${toStatus}`, 400, 'INVALID_TRANSITION');
    }
    if (!isValidAccTransition(fromStatus, toStatus)) {
      throw new AppError(`状态机不允许 ${fromStatus} → ${toStatus}`, 400, 'INVALID_TRANSITION');
    }

    // 高风险门：pending → accepted(数量>=5 触发验收审批)
    if (toStatus === 'accepted' && user) {
      const triggerAction = 'accept';
      const entityType = 'tender_acceptances';
      let alreadyApproved = false;
      try {
        const ApprovalEngine = require('./approval-engine.service');
        const engine = new ApprovalEngine();
        alreadyApproved = await engine.hasApprovedRecord({
          tenantId, entity_type: entityType, entity_id: id, trigger_action: triggerAction,
        });
      } catch (e) {
        logger.warn(`[AcceptanceService] hasApprovedRecord 异常，按未批准处理: ${e.message}`);
      }
      if (!alreadyApproved) {
        try {
          const ApprovalEngine = require('./approval-engine.service');
          const engine = new ApprovalEngine();
          const ctx = { accepted_quantity: Number(a.accepted_quantity || 0) };
          const approval = await engine.requestApproval({
            tenantId, entity_type: entityType, entity_id: id,
            trigger_action: triggerAction, context: ctx, initiator: user, new_status: toStatus,
          });
          if (approval.approved === false) {
            await emit('tender:acceptance:approval_pending', {
              id, tenantId, userId: user.id, record_id: approval.record_id,
              flow_code: approval.flow?.flow_code,
            });
            return { id, status: a.status, pending_approval: true, record_id: approval.record_id };
          }
        } catch (e) {
          logger.warn(`[AcceptanceService] 审批引擎不可用，放行: ${e.message}`);
        }
      } else {
        logger.info(`[AcceptanceService] entity=${id} trigger=${triggerAction} 已批准,跳过审批门,落地 status=${toStatus}`);
      }
    }
    const setCols = ['status = ?', 'updated_at = ?'];
    const setVals = [toStatus, nowStr()];
    if (toStatus === 'accepted') {
      setCols.push('accepted_at = ?'); setVals.push(nowStr());
      if (extra.accepted_quantity != null) {
        setCols.push('accepted_quantity = ?'); setVals.push(Number(extra.accepted_quantity));
      }
      if (extra.rejected_quantity != null) {
        setCols.push('rejected_quantity = ?'); setVals.push(Number(extra.rejected_quantity));
      }
      if (extra.inspection_note != null) {
        setCols.push('inspection_note = ?'); setVals.push(String(extra.inspection_note).slice(0, 2000));
      }
    }
    setVals.push(id, tenantId);
    await db.execute(`UPDATE tender_acceptances SET ${setCols.join(', ')} WHERE id = ? AND tenant_id = ?`, setVals);

    const ctx = { id, tenantId, userId: user?.id, from: fromStatus, to: toStatus, acceptance: { ...a, status: toStatus } };
    await emit(`tender:acceptance:${toStatus}`, ctx);
    return { id, status: toStatus };
  }

  async accept(id, tenantId, user, extra = {}) {
    const r = await this._transition(id, tenantId, user, 'pending', 'accepted', extra);
    // 资产入库触发：往 assets 表写一笔已验收记录
    try {
      const acc = await this._select(id, tenantId);
      if (acc.tender_id && !acc.asset_id) {
        // 暴露事件让 assets 模块接管（或用订阅器）
        await emit('tender:acceptance:asset-entry', { id, tender_id: acc.tender_id, accepted_quantity: acc.accepted_quantity, tenantId });
      }
    } catch (e) { /* 忽略 */ }
    return r;
  }

  async reject(id, tenantId, user, reason) {
    return this._transition(id, tenantId, user, 'pending', 'rejected', { inspection_note: reason });
  }

  async reprocess(id, tenantId, user) { return this._transition(id, tenantId, user, 'rejected', 'pending'); }

  async close(id, tenantId, user) { return this._transition(id, tenantId, user, 'accepted', 'closed'); }

  async delete(id, tenantId) {
    const a = await this._select(id, tenantId);
    if (a.status !== 'pending') throw new AppError('仅 pending 可删除', 400, 'INVALID_STATUS');
    await db.execute(`UPDATE tender_acceptances SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
    return { id };
  }

  async getStatistics(tenantId) {
    if (!(await this._exists())) return { by_status: [], total: { count: 0 } };
    const [byStatus] = await db.execute(
      `SELECT status, COUNT(*) AS cnt FROM tender_acceptances WHERE tenant_id = ? AND deleted_at IS NULL GROUP BY status`,
      [tenantId]);
    const [totals] = await db.execute(`SELECT COUNT(*) AS cnt FROM tender_acceptances WHERE tenant_id = ? AND deleted_at IS NULL`, [tenantId]);
    return {
      by_status: byStatus,
      total: { count: Number(totals[0]?.cnt || 0) },
    };
  }
}

module.exports = TenderingAcceptanceService;
