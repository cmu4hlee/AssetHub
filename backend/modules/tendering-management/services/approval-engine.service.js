// ============================================================
// 统一审批引擎 ApprovalEngine
// 4 类对象:tender_projects / tender_contracts / tender_invoices / tender_payments / tender_acceptances
// 9 个审批门:
//   - tender: published / awarded / contract_signing
//   - contract: archive
//   - invoice: pay / archive
//   - payment: pay(继续付款中→完成付款)
//   - acceptance: accept
// 设计要点:
//   1) 流程模板 (approval_flows) + 节点 (approval_nodes) 配置式
//   2) 每次状态流转前调用 engine.requestApproval()：
//      - 若未配置流程/无审批门 → 直接放行 (status 直接更新)，回退到原行为
//      - 若有审批门 → 创建 approval_record + 待办，写目标新状态为 preview=true,
//        真实更新放在所有节点 approved 后由 commit() 提交
//   3) approve(node) / reject(record) 在 node 层推进；engine 决定是否进入下一节点或终态
//   4) 事件总线 publishAsync('approval:*')
//   5) seed() 在模块启动时确保内置 5 个模板存在
// ============================================================

const BaseService = require('../../../core/BaseService');
const db = require('../../../config/database');
const { AppError } = require('../../../utils/error-handler');
const logger = require('../../../config/logger');

const ENTITY_TYPES = [
  'tender_projects', 'tender_contracts', 'tender_invoices',
  'tender_payments', 'tender_acceptances',
];

function parsePositiveInt(v, fallback) {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

async function emit(eventName, payload) {
  try {
    const { getEventBus } = require('../../../core/EventBus');
    getEventBus().publish(eventName, payload);
  } catch (e) { logger.warn(`[ApprovalEngine] 事件 ${eventName} 失败: ${e.message}`); }
}

// 评估 condition_json:返回 boolean
function evalCondition(conditionJson, context) {
  if (!conditionJson) return true;
  try {
    const rules = typeof conditionJson === 'string' ? JSON.parse(conditionJson) : conditionJson;
    if (!rules || typeof rules !== 'object') return true;
    for (const key of Object.keys(rules)) {
      const op = rules[key];
      if (typeof op === 'object' && op !== null) {
        const value = context[key];
        if (op.$gt != null && !(Number(value) > Number(op.$gt))) return false;
        if (op.$gte != null && !(Number(value) >= Number(op.$gte))) return false;
        if (op.$lt != null && !(Number(value) < Number(op.$lt))) return false;
        if (op.$lte != null && !(Number(value) <= Number(op.$lte))) return false;
        if (op.$eq != null && value !== op.$eq) return false;
        if (op.$ne != null && value === op.$ne) return false;
      } else if (value !== op) {
        return false;
      }
    }
    return true;
  } catch (_) {
    return true; // 容错：解析失败 → 通过
  }
}

// 内置流程模板(在 seed() 兜底)
const DEFAULT_FLOWS = [
  {
    flow_code: 'TENDER_PUBLISH_FLOW', flow_name: '招标发布审批',
    entity_type: 'tender_projects', trigger_action: 'publish',
    condition: { budget_amount: { $gte: 50000 } },
    nodes: [
      { seq: 1, name: '部门负责人审批', approver_type: 'role', approver_role: 'department_admin', required: true,
        condition: { budget_amount: { $gte: 50000 } } },
      { seq: 2, name: '资产主管审批',   approver_type: 'role', approver_role: 'system_admin',   required: true, condition: null },
      { seq: 3, name: '总经理审批',     approver_type: 'role', approver_role: 'super_admin',    required: true,
        condition: { budget_amount: { $gte: 200000 } } },
    ],
  },
  {
    flow_code: 'TENDER_AWARD_FLOW', flow_name: '中标定标审批',
    entity_type: 'tender_projects', trigger_action: 'award', condition: null,
    nodes: [
      { seq: 1, name: '资产主管审批', approver_type: 'role', approver_role: 'system_admin', required: true, condition: null },
      { seq: 2, name: '财务主管审批', approver_type: 'role', approver_role: 'finance',      required: true,
        condition: { budget_amount: { $gte: 100000 } } },
    ],
  },
  {
    flow_code: 'TENDER_CONTRACT_SIGN_FLOW', flow_name: '合同签订审批',
    entity_type: 'tender_contracts', trigger_action: 'archive', condition: null,
    nodes: [
      { seq: 1, name: '资产主管审批', approver_type: 'role', approver_role: 'system_admin', required: true, condition: null },
      { seq: 2, name: '法务审核',     approver_type: 'role', approver_role: 'legal',        required: true,
        condition: { amount: { $gte: 50000 } } },
    ],
  },
  {
    flow_code: 'INVOICE_PAY_FLOW', flow_name: '发票付款审批',
    entity_type: 'tender_invoices', trigger_action: 'pay',
    condition: { amount: { $gte: 10000 } },
    nodes: [
      { seq: 1, name: '财务核验',   approver_type: 'role', approver_role: 'finance', required: true, condition: null },
      { seq: 2, name: '财务总监审批', approver_type: 'role', approver_role: 'finance_director', required: true,
        condition: { amount: { $gte: 50000 } } },
    ],
  },
  {
    flow_code: 'PAYMENT_SUBMIT_FLOW', flow_name: '付款单提交审批',
    entity_type: 'tender_payments', trigger_action: 'pay',
    condition: { amount: { $gte: 10000 } },
    nodes: [
      { seq: 1, name: '资产主管审批', approver_type: 'role', approver_role: 'system_admin', required: true, condition: null },
      { seq: 2, name: '财务审核',     approver_type: 'role', approver_role: 'finance',     required: true,
        condition: { amount: { $gte: 10000 } } },
    ],
  },
  {
    flow_code: 'ACCEPTANCE_FLOW', flow_name: '验收通过审批',
    entity_type: 'tender_acceptances', trigger_action: 'accept',
    condition: { accepted_quantity: { $gte: 5 } },
    nodes: [
      { seq: 1, name: '资产主管确认', approver_type: 'role', approver_role: 'system_admin', required: true, condition: null },
    ],
  },
];

class ApprovalEngine extends BaseService {
  constructor(options = {}) { super({ name: 'ApprovalEngine', ...options }); }

  async _exists(name) {
    const [rows] = await db.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [name]);
    return rows.length > 0;
  }

  // ============ Seed: 5 个内置流程模板 ============
  async seed() {
    if (!(await this._exists('approval_flows'))) {
      logger.warn('[ApprovalEngine] approval_flows 表不存在，跳过 seed');
      return false;
    }
    for (const flow of DEFAULT_FLOWS) {
      // upsert flow
      let flowId;
      const [exist] = await db.execute(
        `SELECT id FROM approval_flows WHERE tenant_id = 1 AND flow_code = ? LIMIT 1`,
        [flow.flow_code]);
      if (exist.length === 0) {
        const [r] = await db.execute(
          `INSERT INTO approval_flows (tenant_id, entity_type, flow_code, flow_name, trigger_action, condition_json, enabled)
           VALUES (1, ?, ?, ?, ?, ?, TRUE)`,
          [flow.entity_type, flow.flow_code, flow.flow_name, flow.trigger_action,
            flow.condition ? JSON.stringify(flow.condition) : null],
        );
        flowId = r.insertId;
      } else {
        flowId = exist[0].id;
        await db.execute(
          `UPDATE approval_flows SET entity_type = ?, trigger_action = ?, condition_json = ?, flow_name = ?
           WHERE id = ?`, [flow.entity_type, flow.trigger_action,
            flow.condition ? JSON.stringify(flow.condition) : null, flow.flow_name, flowId]);
        // 清空旧 nodes 重新插入
        await db.execute(`DELETE FROM approval_nodes WHERE flow_id = ?`, [flowId]);
      }
      // 插 nodes
      for (const n of flow.nodes) {
        await db.execute(
          `INSERT INTO approval_nodes (flow_id, seq, node_name, approver_type, approver_role, required, condition_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [flowId, n.seq, n.name, n.approver_type, n.approver_role || null,
            n.required !== false,
            n.condition ? JSON.stringify(n.condition) : null],
        );
      }
    }
    return true;
  }

  // ============ 列出流程模板（用于前端配置 UI） ============
  async listFlows(tenantId, { entity_type, trigger_action } = {}) {
    if (!(await this._exists('approval_flows'))) return [];
    const where = ['tenant_id = ?'];
    const qp = [tenantId];
    if (entity_type) { where.push('entity_type = ?'); qp.push(entity_type); }
    if (trigger_action) { where.push('trigger_action = ?'); qp.push(trigger_action); }
    const [flows] = await db.execute(
      `SELECT * FROM approval_flows WHERE ${where.join(' AND ')} AND enabled = TRUE ORDER BY priority ASC, id ASC`,
      qp,
    );
    for (const f of flows) {
      const [nodes] = await db.execute(
        `SELECT * FROM approval_nodes WHERE flow_id = ? ORDER BY seq ASC`, [f.id]);
      f.nodes = nodes;
    }
    return flows;
  }

  // ============ 查找匹配的流程 ============
  async findMatchedFlow(tenantId, entity_type, trigger_action, context) {
    const flows = await this.listFlows(tenantId, { entity_type, trigger_action });
    // 优先完全匹配的 flow,否则取第一个无 condition 的
    let fallback = null;
    for (const f of flows) {
      const pass = evalCondition(f.condition_json, context);
      if (!pass) continue;
      if (!fallback) fallback = f;
      // 取第一个节点条件也通过
      const nodes = (f.nodes || []).filter(n => n.required && evalCondition(n.condition_json, context));
      if (nodes.length > 0) return { flow: f, nodes };
    }
    return fallback ? { flow: fallback, nodes: fallback.nodes || [] } : null;
  }

  // ============ 提交审批（用户行为触发） ============
  // 返回 { approved: true/false, record: ..., todo: ..., newStatus: 'pending_approval' }
  async requestApproval({
    tenantId, entity_type, entity_id, trigger_action, context, initiator, new_status, payload,
  }) {
    if (!(await this._exists('approval_records'))) {
      return { approved: true, noEngine: true };  // 引擎不可用 → 放行
    }
    const matched = await this.findMatchedFlow(tenantId, entity_type, trigger_action, context);
    if (!matched || matched.nodes.length === 0) {
      return { approved: true, noEngine: true };  // 无匹配流程 → 放行
    }

    // 1) 先创建审批记录（先拿 recordId,后续 ai 异步填充）
    const [r] = await db.execute(
      `INSERT INTO approval_records (
        tenant_id, flow_id, entity_type, entity_id, trigger_action,
        current_node_seq, status, total_nodes,
        initiator_id, initiator_name, snapshot_json, remark
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [
        tenantId, matched.flow.id, entity_type, entity_id, trigger_action,
        matched.nodes[0].seq, matched.nodes.length,
        initiator?.id || null, initiator?.real_name || initiator?.username || null,
        context ? JSON.stringify(context) : null,
        payload?.remark || null,
      ],
    );

    // 进入首个节点
    await this._advanceToNode(r.insertId, matched.nodes, 0, context);

    await emit('approval:created', {
      id: r.insertId, entity_type, entity_id, trigger_action,
      tenantId, initiator, total_nodes: matched.nodes.length,
    });

    // 2) 异步 AI 辅助（失败/不可用不阻塞）：单独 promise，不 await
    this._asyncAISuggest({ tenantId, entity_type, entity_id, recordId: r.insertId, context })
      .catch(e => logger.warn(`[ApprovalEngine] AI 建议异步生成失败: ${e.message}`));

    return {
      approved: false,
      record_id: r.insertId,
      flow: matched.flow,
      total_nodes: matched.nodes.length,
      new_status_hint: new_status,
    };
  }

  // ============ 查询是否存在已批准 record ============
  // 用于状态流转前的"放行检查"：同一 entity+trigger_action 若已 approved,
  // 后续调用应跳过审批门,直接落地状态,避免每次重调都开新审批单。
  async hasApprovedRecord({ tenantId, entity_type, entity_id, trigger_action }) {
    if (!(await this._exists('approval_records'))) return false;
    if (!entity_type || !entity_id || !trigger_action) return false;
    const [rows] = await db.execute(
      `SELECT id, finished_at FROM approval_records
        WHERE tenant_id = ? AND entity_type = ? AND entity_id = ?
          AND trigger_action = ? AND status = 'approved'
        ORDER BY finished_at DESC LIMIT 1`,
      [tenantId, entity_type, entity_id, trigger_action],
    );
    return rows.length > 0;
  }

  async _asyncAISuggest({ tenantId, entity_type, entity_id, recordId, context }) {
    try {
      const AIAssistant = require('./ai-approval-assistant.service');
      const ai = new AIAssistant();
      const suggestion = await ai.suggest({
        tenantId, entityType: entity_type, entityId: entity_id, context,
      });
      // 把 AI 建议附在 approval_records.remark 顶部
      const header = `AI_SUGGESTION:${JSON.stringify({
        decision: suggestion.decision,
        opinion: suggestion.opinion,
        risks: suggestion.risks,
        model: suggestion.model,
        reason: suggestion.reason,
      })}\n`;
      await db.execute(
        `UPDATE approval_records
         SET remark = CONCAT(?, IFNULL(remark, ''))
         WHERE id = ? AND tenant_id = ? AND (remark IS NULL OR remark NOT LIKE 'AI_SUGGESTION:%')`,
        [header, recordId, tenantId],
      );
    } catch (e) {
      logger.warn(`[ApprovalEngine] _asyncAISuggest 失败: ${e.message}`);
    }
  }

  async _advanceToNode(recordId, nodes, index, context) {
    if (index >= nodes.length) return null;
    const node = nodes[index];
    // 节点条件复评
    if (!evalCondition(node.condition_json, context)) {
      return this._advanceToNode(recordId, nodes, index + 1, context);
    }
    if (!node.required) {
      await db.execute(
        `INSERT INTO approval_node_records (record_id, node_id, node_seq, decision, opinion, acted_at)
         VALUES (?, ?, ?, 'skipped', '节点条件未命中自动跳过', NOW())`,
        [recordId, node.id, node.seq],
      );
      return this._advanceToNode(recordId, nodes, index + 1, context);
    }
    // 创建待办
    const approverUserId = node.approver_user_id;
    if (approverUserId) {
      await db.execute(
        `INSERT INTO approval_todos (tenant_id, record_id, node_id, approver_id, due_at)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
        [
          1, recordId, node.id, approverUserId,
          node.timeout_hours || 72,
        ],
      );
    }
    // role 类型的待办:前端 / 我的审批 列表按 role 过滤(查询时按上下文拼接)
    await emit('approval:node_advanced', {
      record_id: recordId,
      node_id: node.id,
      node_seq: node.seq,
      approver_role: node.approver_role,
      approver_user_id: approverUserId,
    });
    return node;
  }

  // ============ 同意/拒绝 ============
  async approve(recordId, tenantId, approver, opinion) {
    return this._decide(recordId, tenantId, approver, 'approved', opinion);
  }
  async reject(recordId, tenantId, approver, opinion) {
    return this._decide(recordId, tenantId, approver, 'rejected', opinion);
  }

  async _decide(recordId, tenantId, approver, decision, opinion) {
    if (!['approved', 'rejected'].includes(decision)) throw new AppError('decision 非法', 400, 'INVALID_DECISION');
    const [rows] = await db.execute(
      `SELECT * FROM approval_records WHERE id = ? AND tenant_id = ? LIMIT 1`, [recordId, tenantId]);
    if (rows.length === 0) throw new AppError('审批实例不存在', 404, 'APPROVAL_NOT_FOUND');
    const rec = rows[0];
    if (rec.status !== 'pending') throw new AppError(`当前状态 ${rec.status}，不可重复决策`, 400, 'INVALID_STATUS');

    const [nodes] = await db.execute(
      `SELECT n.* FROM approval_nodes n WHERE n.flow_id = ? ORDER BY n.seq ASC`,
      [rec.flow_id]);
    if (nodes.length === 0) throw new AppError('流程节点不存在', 500, 'FLOW_NO_NODES');

    const currentNode = nodes.find(n => n.seq === rec.current_node_seq);
    if (!currentNode) throw new AppError('当前节点不存在', 500, 'CURRENT_NODE_MISSING');

    // 写节点决策
    await db.execute(
      `INSERT INTO approval_node_records (record_id, node_id, node_seq, approver_id, approver_name, decision, opinion, acted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [recordId, currentNode.id, currentNode.seq,
        approver?.id || null, approver?.real_name || approver?.username || null,
        decision, opinion || null],
    );

    // 关闭对应待办
    await db.execute(
      `UPDATE approval_todos SET status = 'done', done_at = NOW()
       WHERE record_id = ? AND node_id = ? AND status = 'pending'`,
      [recordId, currentNode.id],
    );

    if (decision === 'rejected') {
      await db.execute(
        `UPDATE approval_records SET status = 'rejected', finished_at = NOW() WHERE id = ?`,
        [recordId],
      );
      await emit('approval:rejected', { id: recordId, approver, opinion, tenantId });
      return { record_id: recordId, decision: 'rejected', final: true };
    }

    // 通过：推进到下一节点
    const nextIdx = nodes.findIndex(n => n.seq === currentNode.seq) + 1;
    let snapshot = {}; try { snapshot = JSON.parse(rec.snapshot_json || '{}'); } catch (_) {}
    if (nextIdx >= nodes.length) {
      // 全部通过
      await db.execute(
        `UPDATE approval_records SET status = 'approved', finished_at = NOW(),
          current_node_seq = total_nodes WHERE id = ?`, [recordId]);
      await emit('approval:approved', { id: recordId, tenantId, approver, opinion });
      return { record_id: recordId, decision: 'approved', final: true };
    }
    await db.execute(
      `UPDATE approval_records SET current_node_seq = ? WHERE id = ?`,
      [nodes[nextIdx].seq, recordId]);
    await this._advanceToNode(recordId, nodes, nextIdx, snapshot);
    await emit('approval:node_advanced', { id: recordId, next_seq: nodes[nextIdx].seq });
    return { record_id: recordId, decision: 'approved', final: false, next_seq: nodes[nextIdx].seq };
  }

  // ============ 列表：我的审批 / 我发起的 ============
  async listMyTodos(tenantId, approverId, { status = 'pending' } = {}) {
    if (!(await this._exists('approval_todos'))) return [];
    const [rows] = await db.execute(
      `SELECT t.*, r.entity_type, r.entity_id, r.trigger_action, r.snapshot_json, r.initiator_name
       FROM approval_todos t
       INNER JOIN approval_records r ON r.id = t.record_id
       WHERE t.tenant_id = ? AND t.approver_id = ? AND t.status = ?
       ORDER BY t.assigned_at DESC`,
      [tenantId, approverId, status],
    );
    return rows;
  }

  async listMyInitiated(tenantId, initiatorId, { status } = {}) {
    if (!(await this._exists('approval_records'))) return [];
    const where = ['tenant_id = ?', 'initiator_id = ?'];
    const qp = [tenantId, initiatorId];
    if (status) { where.push('status = ?'); qp.push(status); }
    const [rows] = await db.execute(
      `SELECT * FROM approval_records WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 200`, qp);
    return rows;
  }

  async listPendingForRole(tenantId, role, { entity_type, limit = 50 } = {}) {
    if (!(await this._exists('approval_todos'))) return [];
    const where = ['r.tenant_id = ?', 'r.status = ?'];
    const qp = [tenantId, 'pending'];
    if (entity_type) { where.push('r.entity_type = ?'); qp.push(entity_type); }
    const [rows] = await db.execute(
      `SELECT r.id AS record_id, r.entity_type, r.entity_id, r.trigger_action,
              n.id AS node_id, n.seq AS node_seq, n.node_name,
              r.initiator_name, r.snapshot_json, r.created_at
       FROM approval_records r
       INNER JOIN approval_nodes n ON n.flow_id = r.flow_id
       WHERE ${where.join(' AND ')}
         AND n.seq = r.current_node_seq
         AND (n.approver_role = ? OR n.approver_user_id IS NOT NULL)
       ORDER BY r.created_at ASC
       LIMIT ?`,
      [...qp, role, limit],
    );
    return rows;
  }

  // ============ 取消审批 ============
  async cancel(recordId, tenantId, user) {
    await db.execute(
      `UPDATE approval_records SET status = 'cancelled', finished_at = NOW() WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
      [recordId, tenantId]);
    await db.execute(
      `UPDATE approval_todos SET status = 'cancelled' WHERE record_id = ? AND status = 'pending'`,
      [recordId]);
    await emit('approval:cancelled', { id: recordId, tenantId, user });
    return { id: recordId };
  }
}

// 启动钩子：模块 routes/index.js 调用 seed()
async function autoSeed() {
  try {
    const engine = new ApprovalEngine();
    await engine.seed();
  } catch (e) {
    logger.warn(`[ApprovalEngine] seed 失败: ${e.message}`);
  }
}

module.exports = ApprovalEngine;
module.exports.autoSeed = autoSeed;
