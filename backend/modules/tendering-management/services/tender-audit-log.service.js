// ============================================================
// 采购与招标 — 通用审计日志 TenderingAuditLogService
// 用于打通任意 tender_* 表的状态变更记录。
// 统一在 EventBus 上订阅子模块的 *:created / *:updated / *:status-changed 事件写入。
// ============================================================

const BaseService = require('../../../core/BaseService');
const db = require('../../../config/database');
const { AppError } = require('../../../utils/error-handler');

class TenderingAuditLogService extends BaseService {
  constructor(options = {}) {
    super({ name: 'TenderingAuditLogService', ...options });
  }

  async _existsTable() {
    const [rows] = await db.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tender_audit_logs'`);
    return rows.length > 0;
  }

  async writeLog({ tenantId, entityType, entityId, action, fromStatus, toStatus, payload, operator }) {
    if (!(await this._existsTable())) return false;
    try {
      await db.execute(
        `INSERT INTO tender_audit_logs (
          tenant_id, entity_type, entity_id, action, from_status, to_status, payload,
          operator_id, operator_name, occurred_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          tenantId || 1, entityType, entityId, action,
          fromStatus || null, toStatus || null,
          payload ? JSON.stringify(payload) : null,
          operator?.id || null, operator?.name || (operator?.real_name || null),
        ],
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  async listLogs(tenantId, params) {
    if (!(await this._existsTable())) return { data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
    const { page = 1, pageSize = 20, entity_type, entity_id, operator_id, action, occurred_from, occurred_to } = params;
    const where = ['tenant_id = ?'];
    const qp = [tenantId];
    if (entity_type) { where.push('entity_type = ?'); qp.push(entity_type); }
    if (entity_id) { where.push('entity_id = ?'); qp.push(parseInt(entity_id, 10)); }
    if (operator_id) { where.push('operator_id = ?'); qp.push(parseInt(operator_id, 10)); }
    if (action) { where.push('action = ?'); qp.push(action); }
    if (occurred_from) { where.push('occurred_at >= ?'); qp.push(occurred_from); }
    if (occurred_to) { where.push('occurred_at <= ?'); qp.push(occurred_to); }
    const whereSQL = `WHERE ${where.join(' AND ')}`;
    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const [cr] = await db.execute(`SELECT COUNT(*) AS total FROM tender_audit_logs ${whereSQL}`, qp);
    const total = Number(cr[0]?.total || 0);
    const [rows] = await db.execute(
      `SELECT id, entity_type, entity_id, action, from_status, to_status, payload,
              operator_id, operator_name, occurred_at
       FROM tender_audit_logs ${whereSQL}
       ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...qp, parseInt(pageSize, 10), offset],
    );
    return { data: rows, pagination: { page: parseInt(page, 10), pageSize: parseInt(pageSize, 10), total, totalPages: Math.ceil(total / parseInt(pageSize, 10)) || 0 } };
  }
}

// 自动注册为事件总线订阅器（把所有"状态流转"事件持久化）
let initialized = false;
function bind() {
  if (initialized) return;
  initialized = true;
  let getEventBus;
  try { ({ getEventBus } = require('../../../core/EventBus')); }
  catch (_) { return; }
  const bus = getEventBus();
  const svc = new TenderingAuditLogService();

  const map = [
    { event: 'tender:payment:paid', entity: 'tender_payments', action: 'status_change', to: 'paid' },
    { event: 'tender:payment:failed', entity: 'tender_payments', action: 'status_change', to: 'failed' },
    { event: 'tender:payment:submitted', entity: 'tender_payments', action: 'status_change', to: 'submitted' },
    { event: 'tender:payment:created', entity: 'tender_payments', action: 'create' },
    { event: 'tender:acceptance:accepted', entity: 'tender_acceptances', action: 'status_change', to: 'accepted' },
    { event: 'tender:acceptance:rejected', entity: 'tender_acceptances', action: 'status_change', to: 'rejected' },
    { event: 'tender:acceptance:closed', entity: 'tender_acceptances', action: 'status_change', to: 'closed' },
    { event: 'tender:acceptance:created', entity: 'tender_acceptances', action: 'create' },
    { event: 'tender:invoice:paid', entity: 'tender_invoices', action: 'status_change', to: 'paid' },
    { event: 'tender:invoice:archived', entity: 'tender_invoices', action: 'status_change', to: 'archived' },
  ];
  for (const cfg of map) {
    bus.subscribe(cfg.event, async (ctx) => {
      if (!ctx || !ctx.id) return;
      await svc.writeLog({
        tenantId: ctx.tenantId || (ctx.payment && ctx.payment.tenant_id) || (ctx.acceptance && ctx.acceptance.tenant_id) || (ctx.invoice && ctx.invoice.tenant_id),
        entityType: cfg.entity,
        entityId: cfg.entity === 'tender_invoices' ? ctx.id : ctx.id,
        action: cfg.action,
        fromStatus: ctx.from,
        toStatus: cfg.to || (ctx.to || null),
        payload: ctx,
        operator: ctx.userId ? { id: ctx.userId } : null,
      });
    });
  }
}

module.exports = TenderingAuditLogService;
module.exports.bind = bind;
