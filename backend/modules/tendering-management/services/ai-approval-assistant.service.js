// ============================================================
// AI 辅助审批助手 AIApprovalAssistant
// 输入：审批实例 + 业务对象(tender_projects/tender_contracts/tender_invoices/tender_payments/tender_acceptances) + 历史审计
// 输出：审批建议 + 风险点 + 推荐结论 + 关联参考
// 严格遵守 human-in-loop：仅生成"建议"，不直接 approve/reject。
// 容错：模型不可用 → 返回降级意见，不阻塞审批
// ============================================================

const BaseService = require('../../../core/BaseService');
const db = require('../../../config/database');
const { AppError } = require('../../../utils/error-handler');
const logger = require('../../../config/logger');
const MiniMaxClient = require('./minimax-client.service');

async function emit(eventName, payload) {
  try {
    const { getEventBus } = require('../../../core/EventBus');
    getEventBus().publish(eventName, payload);
  } catch (e) { logger.warn(`[AIAssistant] 事件 ${eventName} 失败: ${e.message}`); }
}

// 模板按 entity_type 分组（system prompt）
const SYSTEM_PROMPTS = {
  tender_projects: `你是一名严谨的政府采购与招标合规审查专家，擅长对招标项目进行合规与风险审查。
输出要求：
1) 总体结论（建议通过 / 建议驳回 / 建议补充材料）
2) 风险点（最多 5 条，每条标注等级：高/中/低 + 简述）
3) 关注点（与采购预算、供应商资质、时间合规相关的可疑点）
4) 审批参考意见（不超过 200 字）
使用 JSON 输出，schema = { decision: "approve|reject|need_more", risks: [{level,desc}], notes: string, opinion: string }`,
  tender_contracts: `你是一名合同合规审查专家，对合同签订进行审查：
1) 合同金额、付款条款、违约责任、知识产权条款是否完备
2) 风险点（高/中/低 + 简述）
3) 审批参考意见（不超过 200 字）
JSON 输出同 schema { decision, risks, notes, opinion }`,
  tender_invoices: `你是财务合规与税务审查专家，对发票进行审查：
1) 票面信息一致性、税率、税额
2) 与合同/里程碑匹配度
3) 风险点（高/中/低 + 简述）
4) 审批参考意见（不超过 200 字）
JSON 输出同 schema { decision, risks, notes, opinion }`,
  tender_payments: `你是资金合规专家，对付款单进行审查：
1) 金额、收款人、付款方式合规性
2) 与合同/发票/里程碑一致性
3) 风险点（高/中/低 + 简述）
4) 审批参考意见（不超过 200 字）
JSON 输出同 schema { decision, risks, notes, opinion }`,
  tender_acceptances: `你是资产验收审查专家，对验收单进行审查：
1) 数量/质量/规格是否匹配采购需求
2) 验收意见完备性
3) 风险点（高/中/低 + 简述）
4) 审批参考意见（不超过 200 字）
JSON 输出同 schema { decision, risks, notes, opinion }`,
};
const FALLBACK_SYSTEM = '你是一名严谨的合规审查助手，请输出 JSON { decision, risks, notes, opinion }。';

class AIApprovalAssistant extends BaseService {
  constructor(options = {}) {
    super({ name: 'AIApprovalAssistant', ...options });
    this.client = options.client || new MiniMaxClient();
  }

  // 取业务对象概要（防止 prompt 过长）
  async _loadEntity(entityType, entityId) {
    try {
      if (entityType === 'tender_projects') {
        const [r] = await db.execute(
          `SELECT id, tender_code, title, status, tender_category, budget_amount, requestor_name, request_department, created_at
           FROM tender_projects WHERE id = ? LIMIT 1`, [entityId]);
        return r[0] || {};
      }
      if (entityType === 'tender_contracts') {
        const [r] = await db.execute(
          `SELECT id, contract_code, contract_name, contract_amount, contract_status, signed_at, supplier_id
           FROM tender_contracts WHERE id = ? LIMIT 1`, [entityId]);
        return r[0] || {};
      }
      if (entityType === 'tender_invoices') {
        const [r] = await db.execute(
          `SELECT id, invoice_code, invoice_kind, amount, tax_amount, tax_rate, status, contract_id, milestone_id
           FROM tender_invoices WHERE id = ? LIMIT 1`, [entityId]);
        return r[0] || {};
      }
      if (entityType === 'tender_payments') {
        const [r] = await db.execute(
          `SELECT id, payment_code, amount, pay_method, status, contract_id, milestone_id, invoice_id
           FROM tender_payments WHERE id = ? LIMIT 1`, [entityId]);
        return r[0] || {};
      }
      if (entityType === 'tender_acceptances') {
        const [r] = await db.execute(
          `SELECT id, acceptance_code, status, contract_id, accepted_quantity, rejected_quantity, inspection_note
           FROM tender_acceptances WHERE id = ? LIMIT 1`, [entityId]);
        return r[0] || {};
      }
    } catch (_) {}
    return {};
  }

  async _loadAuditTrail(entityType, entityId, limit = 20) {
    try {
      const [r] = await db.execute(
        `SELECT action, from_status, to_status, operator_name, occurred_at
         FROM tender_audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY occurred_at DESC LIMIT ?`,
        [entityType, entityId, limit]);
      return r;
    } catch (_) { return []; }
  }

  _extractJson(text) {
    if (!text) return null;
    // 容忍模型返回带 markdown fence 的情况
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch (_) { return null; }
  }

  // 入口：生成审批建议（非流式）
  async suggest({ tenantId, entityType, entityId, context, approverHint }) {
    if (!SYSTEM_PROMPTS[entityType]) {
      throw new AppError(`暂不支持 ${entityType} 的 AI 辅助`, 400, 'UNSUPPORTED_ENTITY');
    }
    const entity = await this._loadEntity(entityType, entityId);
    const audit = await this._loadAuditTrail(entityType, entityId, 20);
    const messages = [{
      role: 'user',
      content: [
        `业务对象 ${entityType}#${entityId}:`,
        JSON.stringify(entity, null, 0),
        '',
        '上下文(由调用方提供):',
        JSON.stringify(context || {}, null, 0),
        '',
        '最近审计历史(可参考):',
        JSON.stringify(audit.slice(0, 5), null, 0),
        approverHint ? `\n审批人提示: ${approverHint}` : '',
      ].filter(Boolean).join('\n'),
    }];

    if (!this.client.isConfigured()) {
      const fallback = this._fallbackSuggest(entityType, entity, context);
      await emit('approval:ai_suggested', {
        tenantId, entityType, entityId, fallback: true, suggestion: fallback,
      });
      return { ...fallback, model: 'fallback', reason: 'API_KEY 未配置' };
    }
    try {
      const system = SYSTEM_PROMPTS[entityType] || FALLBACK_SYSTEM;
      const res = await this.client.generate({ messages, system }, { max_tokens: 800, temperature: 0.2 });
      const parsed = this._extractJson(res.text) || this._fallbackSuggest(entityType, entity, context);
      await emit('approval:ai_suggested', {
        tenantId, entityType, entityId, fallback: false, suggestion: parsed,
      });
      return { ...parsed, model: this.client.model, raw_text: res.text };
    } catch (e) {
      logger.warn(`[AIAssistant] 生成失败: ${e.message}`);
      const fallback = this._fallbackSuggest(entityType, entity, context);
      return { ...fallback, model: 'fallback', reason: e.message };
    }
  }

  // 流式接口：与 controller 配合输出 SSE
  async *streamSuggest({ tenantId, entityType, entityId, context, approverHint }) {
    if (!SYSTEM_PROMPTS[entityType]) {
      throw new AppError(`暂不支持 ${entityType} 的 AI 辅助`, 400, 'UNSUPPORTED_ENTITY');
    }
    if (!this.client.isConfigured()) {
      const fallback = this._fallbackSuggest(entityType, {}, context);
      // 单 chunk 推送
      yield { type: 'delta', text: JSON.stringify(fallback) };
      yield { type: 'done', fallback: true, reason: 'API_KEY 未配置' };
      return;
    }
    const entity = await this._loadEntity(entityType, entityId);
    const audit = await this._loadAuditTrail(entityType, entityId, 20);
    const messages = [{
      role: 'user',
      content: [
        `业务对象 ${entityType}#${entityId}:`,
        JSON.stringify(entity, null, 0),
        '',
        '上下文(由调用方提供):',
        JSON.stringify(context || {}, null, 0),
        '',
        '最近审计历史(可参考):',
        JSON.stringify(audit.slice(0, 5), null, 0),
        approverHint ? `\n审批人提示: ${approverHint}` : '',
      ].filter(Boolean).join('\n'),
    }];
    const system = SYSTEM_PROMPTS[entityType] || FALLBACK_SYSTEM;
    let fullText = '';
    try {
      for await (const delta of this.client.streamGenerate({ messages, system }, { max_tokens: 800, temperature: 0.2 })) {
        fullText += delta;
        yield { type: 'delta', text: delta };
      }
      const parsed = this._extractJson(fullText);
      yield { type: 'done', full_text: fullText, parsed };
      await emit('approval:ai_suggested', {
        tenantId, entityType, entityId, fallback: false, suggestion: parsed,
      });
    } catch (e) {
      logger.warn(`[AIAssistant] 流式生成失败: ${e.message}`);
      const fallback = this._fallbackSuggest(entityType, entity, context);
      yield { type: 'error', message: e.message, fallback };
    }
  }

  // 降级：当 API 不可用 → 基于规则的占位建议
  _fallbackSuggest(entityType, entity, context) {
    const notes = [];
    const risks = [];
    if (entity && Number(entity.budget_amount || entity.amount || entity.contract_amount || 0) > 100000) {
      risks.push({ level: '中', desc: '金额超过 ¥100,000，建议财务+主管双签' });
    }
    if (entityType === 'tender_invoices') {
      const taxRate = Number(entity.tax_rate || 0);
      if (taxRate && taxRate !== 13 && taxRate !== 6 && taxRate !== 3 && taxRate !== 9) {
        risks.push({ level: '中', desc: `非主流税率 ${taxRate}%，请人工复核` });
      }
    }
    if (entityType === 'tender_payments' && entity && entity.pay_method === 'cash' && Number(entity.amount || 0) > 5000) {
      risks.push({ level: '高', desc: '现金付款超过 ¥5000，建议改为银行转账' });
    }
    if (entityType === 'tender_acceptances' && Number(entity && entity.rejected_quantity || 0) > 0) {
      risks.push({ level: '中', desc: `存在不合格数 ${entity.rejected_quantity}，请人工确认` });
    }
    let decision = 'need_more';
    if (risks.some(r => r.level === '高')) decision = 'reject';
    else if (risks.length === 0) decision = 'approve';
    return {
      decision,
      risks,
      notes,
      opinion: 'MiniMax 暂不可用，已返回基于规则的占位建议，请人工复核。',
    };
  }
}

module.exports = AIApprovalAssistant;