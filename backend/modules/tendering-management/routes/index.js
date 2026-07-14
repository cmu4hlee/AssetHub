const express = require('express');
const router = express.Router();
const tenderingRouter = require('./tendering.routes');

// 挂载招标采购模块路由
router.use('/', tenderingRouter);

// 注册发票 → 通知订阅器（财务通知 / 应收到账 / 资产入账完成）
try {
  const notifySub = require('../invoice-notify-subscriber');
  notifySub.bind();
} catch (e) {
  // 失败不阻塞启动
}

// 注册审计日志订阅器（付款/验收/发票 → tender_audit_logs）
try {
  const audit = require('../services/tender-audit-log.service');
  if (typeof audit.bind === 'function') audit.bind();
} catch (e) {
  // 失败不阻塞启动
}

// 启动时为审批引擎内置 6 个流程模板（如未迁移过则静默跳过）
try {
  const { autoSeed } = require('../services/approval-engine.service');
  autoSeed();
} catch (e) {
  // 启动失败不阻塞
}

// 注册付款单 → 里程碑/发票联动（paid 时同步）
try {
  const { getEventBus } = require('../../../core/EventBus');
  const bus = getEventBus();
  const db = require('../../../config/database');
  bus.subscribe('tender:payment:paid', async (ctx) => {
    if (!ctx || !ctx.id) return;
    try {
      const [rows] = await db.execute(
        `SELECT milestone_id, invoice_id, contract_id, tenant_id FROM tender_payments WHERE id = ? LIMIT 1`,
        [ctx.id],
      );
      if (rows.length === 0) return;
      const r = rows[0];
      if (r.milestone_id) {
        await db.execute(
          `UPDATE tender_payment_milestones SET status='paid', paid_at=NOW() WHERE id = ? AND tenant_id = ?`,
          [r.milestone_id, r.tenant_id],
        );
      }
    } catch (_) {}
  });
  bus.subscribe('tender:acceptance:asset-entry', async (ctx) => {
    // 验收 accepted 后，触发资产入库占位事件（占位：实际由 assets 模块监听）
    // 这里仅写一条空实现，把 acceptanceId/contractId 传递给 assets 模块
  });
} catch (e) {
  // EventBus 缺失也允许启动
}

module.exports = router;
