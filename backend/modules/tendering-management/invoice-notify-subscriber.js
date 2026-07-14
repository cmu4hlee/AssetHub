// ============================================================
// 发票通知订阅器
// 监听：tender:invoice:created → 通知财务「发票待核验」
//       tender:invoice:verified → 通知申请人「核验通过」
//       tender:invoice:paid     → 通知申请人 + 财务「发票已收款，应收到账」
//       tender:invoice:archived → 通知申请人「资产入账完成」
// 实现层：依托 EventBus。若项目另带 NotificationService，优先调用；
//        否则走 logger 与 console.error 落地点。
// ============================================================

let initialized = false;

const DEFAULT_FINANCE_ROLES = ['finance', 'system_admin', 'super_admin'];
const DEFAULT_APPLICANT_FIELD = 'created_by';

function emitInternalNotify(channel, payload) {
  try {
    const { publishAsync } = require('../../../core/EventBus');
    publishAsync('notification:send', { channel, ...payload })
      .catch(e => null);
  } catch (_) {}
}

function deriveActorIds(invoice) {
  if (!invoice) return [];
  if (Array.isArray(invoice.notify_user_ids)) return invoice.notify_user_ids;
  if (invoice.created_by) return [invoice.created_by];
  return [];
}

async function tryLogToSystemNotice(ctx) {
  // 业务系统公告表（如存在）优先；否则仅 logger
  try {
    const db = require('../../../config/database');
    // 尝试插入系统公告（容错：表/字段不存在时跳过）
    await db.execute(
      `INSERT INTO system_notices (tenant_id, type, level, title, content, target_user_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        ctx.tenantId || 1,
        ctx.type,
        ctx.level || 'info',
        ctx.title,
        ctx.content,
        ctx.targetUserId || null,
        JSON.stringify(ctx.payload || {}),
      ],
    );
    return true;
  } catch (_) {
    return false;
  }
}

async function handleInvoiceEvent(name, ctx, builder) {
  if (!ctx) return;
  const payload = builder(ctx);
  if (!payload) return;
  // 1) 写系统公告（若存在）
  await tryLogToSystemNotice(payload).catch(() => null);
  // 2) 走核心事件总线让前端或通知服务订阅
  emitInternalNotify(`invoice:${name}`, payload);
  // 3) 后端日志（兜底）
  const logger = require('../../../config/logger');
  logger.info(`[invoice-notify] ${name} ${payload.title} (invoice.id=${ctx.id}, tenantId=${ctx.tenantId})`);
}

function bind() {
  if (initialized) return;
  initialized = true;
  let getEventBus;
  try {
    ({ getEventBus } = require('../../../core/EventBus'));
  } catch (_) { return; }
  const bus = getEventBus();

  // created → 通知财务「发票待核验」
  bus.subscribe('tender:invoice:created', async (ctx) => {
    // 仅当是由 submit 流程触发的二次事件（draft → pending）才通知财务
    if (!ctx || ctx.to !== 'pending') return;
    const inv = ctx.invoice || {};
    await handleInvoiceEvent('created', ctx, c => ({
      type: 'INVOICE_PENDING_VERIFY',
      title: `发票待核验：${c.invoice_code || ''}`,
      content: `一张 ${(c.invoice_kind || '').toUpperCase()} 发票（金额 ¥${Number(c.amount || 0).toLocaleString()}）已被提交，等待财务核验。`,
      targetUserId: null,
      payload: { invoice_id: c.id, invoice_code: c.invoice_code, from: c.from, to: c.to },
      tenantId: c.tenantId,
    }));
  });

  bus.subscribe('tender:invoice:verified', async (ctx) => {
    if (!ctx) return;
    const inv = ctx.invoice || {};
    await handleInvoiceEvent('verified', ctx, c => ({
      type: 'INVOICE_VERIFIED',
      title: `发票核验通过：${c.invoice_code || ''}`,
      content: `您的发票已通过核验（金额 ¥${Number(c.amount || 0).toLocaleString()}），下一步可进行认证抵扣。`,
      targetUserId: c.created_by || null,
      payload: { invoice_id: c.id },
      tenantId: c.tenantId,
    }));
  });

  bus.subscribe('tender:invoice:claimed', async (ctx) => {
    if (!ctx) return;
    const inv = ctx.invoice || {};
    // 通知申请人 + 财务：税额抵扣成功
    await handleInvoiceEvent('claimed', ctx, c => ({
      type: 'INVOICE_CLAIMED',
      title: `发票已认证抵扣：${c.invoice_code || ''}`,
      content: `发票已完成认证抵扣，抵扣税额：¥${Number(c.tax_amount || 0).toLocaleString()}。`,
      targetUserId: c.created_by || null,
      payload: { invoice_id: c.id, tax_amount: c.tax_amount },
      tenantId: c.tenantId,
    }));
  });

  bus.subscribe('tender:invoice:paid', async (ctx) => {
    if (!ctx) return;
    const inv = ctx.invoice || {};
    // 应收到账通知
    await handleInvoiceEvent('paid', ctx, c => ({
      type: 'INVOICE_PAID',
      title: `发票已收款：${c.invoice_code || ''}`,
      content: `应收账已确认（¥${Number(c.amount || 0).toLocaleString()}），请确认收款与计划入账。`,
      targetUserId: c.created_by || null,
      payload: { invoice_id: c.id, milestone_id: c.milestone_id, contract_id: c.contract_id },
      tenantId: c.tenantId,
    }));
  });

  bus.subscribe('tender:invoice:archived', async (ctx) => {
    if (!ctx) return;
    const inv = ctx.invoice || {};
    await handleInvoiceEvent('archived', ctx, c => ({
      type: 'INVOICE_ARCHIVED',
      title: `资产入账完成：${c.invoice_code || ''}`,
      content: `基于此发票已完成资产入账（capitalized_at 已写入 assets 表）。`,
      targetUserId: c.created_by || null,
      payload: { invoice_id: c.id, asset_id: c.asset_id },
      tenantId: c.tenantId,
    }));
  });

  bus.subscribe('tender:invoice:cancelled', async (ctx) => {
    if (!ctx) return;
    await handleInvoiceEvent('cancelled', ctx, c => ({
      type: 'INVOICE_CANCELLED',
      title: `发票已取消：${c.invoice_code || ''}`,
      content: `发票状态已变更为 cancelled（作废/红冲）。`,
      targetUserId: c.created_by || null,
      payload: { invoice_id: c.id },
      tenantId: c.tenantId,
    }));
  });
}

module.exports = { bind };
