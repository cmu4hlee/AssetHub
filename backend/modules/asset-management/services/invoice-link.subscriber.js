// ============================================================
// 资产 ↔ 发票 事件订阅器
// 字段真主：assets 表上的 invoice_id / invoice_no / capitalized_at
// 由 asset-management 模块负责维护，tendering-management 不再直写。
//
// 监听事件：
//   tender:invoice:archived  → 回写 assets.invoice_id / invoice_no / capitalized_at / original_value
//   tender:invoice:cancelled → 解绑资产上的 invoice 关联
//
// 注册方式：与 tendering 侧 invoice-asset-subscriber 对齐，
//          在 routes/assets.js 顶部 require 一次本文件并调 bind()。
// ============================================================

let initialized = false;

function bind() {
  if (initialized) return;
  initialized = true;
  let getEventBus;
  try {
    ({ getEventBus } = require('../../../core/EventBus'));
  } catch (e) {
    return;
  }
  const db = require('../../../config/database');
  const logger = require('../../../config/logger');
  const bus = getEventBus();

  bus.on('tender:invoice:archived', async (ctx) => {
    if (!ctx?.invoice?.asset_id) return;
    try {
      await db.execute(
        `UPDATE assets
         SET invoice_id = ?, invoice_no = ?, capitalized_at = NOW(),
             original_value = COALESCE(original_value, ?)
         WHERE id = ? AND tenant_id = ?`,
        [
          ctx.id,
          ctx.invoice.invoice_no || null,
          Number(ctx.invoice.amount) || 0,
          ctx.invoice.asset_id,
          ctx.tenantId,
        ],
      );
    } catch (e) {
      logger.warn('[invoice-link-subscriber] archived 回写失败: ' + e.message);
    }
  });

  bus.on('tender:invoice:cancelled', async (ctx) => {
    if (!ctx?.invoice?.asset_id) return;
    try {
      await db.execute(
        `UPDATE assets SET invoice_id = NULL, invoice_no = NULL, capitalized_at = NULL
         WHERE id = ? AND tenant_id = ? AND invoice_id = ?`,
        [ctx.invoice.asset_id, ctx.tenantId, ctx.id],
      );
    } catch (e) {
      logger.warn('[invoice-link-subscriber] cancelled 解绑失败: ' + e.message);
    }
  });
}

module.exports = { bind };
