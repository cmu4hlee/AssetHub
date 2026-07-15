/**
 * 知识库 AI 问答服务
 *
 * 核心流程(前置 RAG 模式):
 * 1. 根据用户问题,在知识库做关键词检索
 * 2. 把检索到的 topK chunks 拼到 system prompt(标号 + 来源)
 * 3. 调用 OpenClaw 网关生成答案
 * 4. 保存问答记录
 *
 * OpenClaw 调用复用项目已有的 gatewayAIService,
 * 与现有 AI 助手共用认证/上下文/技能注入机制
 */

const BaseService = require('../../../core/BaseService');
const { AppError } = require('../../../utils/error-handler');
const gatewayAIService = require('../../../services/gateway-ai-service');
const aiRuntimeAuthStore = require('../../../services/ai-runtime-auth-store');
const knowledgeBaseService = require('./knowledge-base.service');
const parser = require('./knowledge-base-parser.service');

const DEFAULT_SYSTEM_PROMPT = `你是 AssetHub 知识库的 AI 助手。请严格基于下方"参考资料"回答用户问题。

回答要求:
1. 优先使用参考资料中的信息作答,不要编造资料中未出现的内容。
2. 在正文中用 [1]、[2] 等角标标注引用编号,与文末"参考资料"列表对应。
3. 如果参考资料与问题无关或不足,直接说明"未在知识库中找到相关资料",不要瞎猜。
4. 回答使用中文,简洁清晰,使用 Markdown 排版。`;

class KnowledgeBaseAIService extends BaseService {
  constructor(options = {}) {
    super({ name: 'KnowledgeBaseAIService', ...options });
    this.kbService = new knowledgeBaseService(options);
  }

  /**
   * 智能问答
   * @param {object} ctx - { tenantId, user }
   * @param {object} params - { question, kb_id?, session_id?, top_k?, model? }
   */
  async ask(ctx, params = {}) {
    const { tenantId, user } = ctx;
    const { question, kb_id, session_id, top_k, model, min_score } = params;
    if (!question || !String(question).trim()) {
      throw new AppError('问题不能为空', 400, 'EMPTY_QUESTION');
    }

    const startedAt = Date.now();
    const settings = await this.kbService.getSettings(tenantId);
    if (settings.ai_enabled === 0 || settings.ai_enabled === false) {
      throw new AppError('知识库 AI 问答未启用', 403, 'AI_DISABLED');
    }

    // 1. 检索
    const { results: chunks } = await this.kbService.search(tenantId, {
      question,
      kb_id,
      top_k: top_k || settings.top_k,
      min_score: min_score != null ? min_score : settings.min_score,
    });

    // 2. 拼装 prompt
    const contextBlock = this.buildContextBlock(chunks, settings);
    const systemPrompt = `${settings.system_prompt || DEFAULT_SYSTEM_PROMPT}\n\n${contextBlock}`;

    // 3. 构造消息
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ];

    // 4. 调 OpenClaw
    const aiModel = model || settings.ai_model || 'openclaw';
    const payload = {
      model: aiModel,
      stream: false,
      session_id: session_id || null,
      messages,
      metadata: {
        tenant_id: tenantId,
        user_id: user?.id,
        username: user?.username,
        real_name: user?.real_name,
        role: user?.role,
        source: 'knowledge_base',
        kb_id: kb_id || null,
      },
    };

    let answer = '';
    let provider = 'openclaw';
    let usedModel = aiModel;
    let errorMessage = null;
    let status = 'success';

    try {
      const result = await gatewayAIService.createChatCompletion(payload, 1, 0);
      if (!result || !result.success) {
        status = 'failed';
        errorMessage = result?.error || 'AI 服务未返回有效结果';
      } else {
        const data = result.data || {};
        provider = data.provider || provider;
        usedModel = data.model || aiModel;
        answer = extractAssistantText(data);
      }
    } catch (err) {
      status = 'failed';
      errorMessage = err.message || 'AI 服务调用异常';
    }

    // AI 失败时 fallback 到纯检索模式：返回检索到的文档片段
    if (status === 'failed' && chunks.length > 0) {
      const fallback = chunks.map((c, i) => `**[${i + 1}] ${c.doc_title || c.file_name || '文档'}**\n> ${String(c.content || '').slice(0, 200)}`).join('\n\n');
      answer = `⚠️ AI 服务暂时不可用 (${errorMessage})\n\n以下是在知识库中检索到的相关片段：\n\n${fallback}`;
      status = 'fallback';
    }

    const latency = Date.now() - startedAt;
    const citations = chunks.map((c, i) => ({
      index: i + 1,
      doc_id: c.doc_id,
      doc_title: c.doc_title,
      chunk_id: c.id,
      chunk_index: c.chunk_index,
      score: Number((c.score || 0).toFixed(4)),
      snippet: String(c.content || '').slice(0, 200),
    }));

    // 5. 落库(失败也存,方便排查)
    const retrievedSnippets = chunks.map(c => ({
      chunk_id: c.id,
      doc_id: c.doc_id,
      doc_title: c.doc_title,
      score: c.score,
      snippet: String(c.content || '').slice(0, 300),
    }));

    try {
      await this.kbService.saveQaRecord({
        tenantId,
        kb_id: kb_id || null,
        session_id: session_id || null,
        user_id: user?.id,
        user_name: user?.real_name || user?.username,
        question,
        answer,
        retrieved_chunks: retrievedSnippets,
        citations,
        provider,
        model: usedModel,
        latency_ms: latency,
        status,
        error_message: errorMessage,
      });
    } catch (e) {
      this._db && console.warn('保存问答记录失败:', e.message);
    }

    // fallback 或完整成功都返回答案（不再 throw，让前端能展示检索结果）
    return {
      answer,
      provider,
      model: usedModel,
      latency_ms: latency,
      citations,
      retrieved_chunks: retrievedSnippets,
    };
  }

  buildContextBlock(chunks, settings = {}) {
    if (!chunks || chunks.length === 0) {
      return '参考资料:\n(无 — 知识库中未检索到与问题相关的内容)';
    }
    const maxChars = settings.max_context_chars || 6000;
    const list = [];
    let used = 0;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const body = String(c.content || '').trim();
      const tag = `[${i + 1}] ${c.doc_title || c.file_name || '文档'} (chunk #${c.chunk_index ?? '-'})`;
      const line = `${tag}\n${body}`;
      if (used + line.length > maxChars && list.length > 0) {
        list.push(`...(后续分块因长度限制已省略)`);
        break;
      }
      list.push(line);
      used += line.length + 2;
    }
    return `参考资料:\n${list.join('\n\n')}`;
  }

  /**
   * 流式问答 — 调 OpenClaw 网关流式接口,边收边通过 onChunk 回调
   * @param {object} ctx - { tenantId, user }
   * @param {object} params - { question, kb_id?, session_id?, top_k?, model? }
   * @param {function(string): void} onChunk - 每收到一个文本片段触发(text)
   * @returns {Promise<{answer, provider, model, latency_ms, citations, retrieved_chunks}>}
   */
  async askStream(ctx, params = {}, onChunk = () => {}) {
    const { tenantId, user } = ctx;
    const { question, kb_id, session_id, top_k, model, min_score } = params;
    if (!question || !String(question).trim()) {
      throw new AppError('问题不能为空', 400, 'EMPTY_QUESTION');
    }

    const startedAt = Date.now();
    const settings = await this.kbService.getSettings(tenantId);
    if (settings.ai_enabled === 0 || settings.ai_enabled === false) {
      throw new AppError('知识库 AI 问答未启用', 403, 'AI_DISABLED');
    }

    // 1. 检索
    const { results: chunks } = await this.kbService.search(tenantId, {
      question,
      kb_id,
      top_k: top_k || settings.top_k,
      min_score: min_score != null ? min_score : settings.min_score,
    });

    // 2. 拼装 prompt
    const contextBlock = this.buildContextBlock(chunks, settings);
    const systemPrompt = `${settings.system_prompt || DEFAULT_SYSTEM_PROMPT}\n\n${contextBlock}`;

    // 3. 构造消息
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ];

    const aiModel = model || settings.ai_model || 'openclaw';
    const payload = {
      model: aiModel,
      stream: true,
      session_id: session_id || null,
      messages,
      metadata: {
        tenant_id: tenantId,
        user_id: user?.id,
        username: user?.username,
        real_name: user?.real_name,
        role: user?.role,
        source: 'knowledge_base_stream',
        kb_id: kb_id || null,
      },
    };

    let answer = '';
    let provider = 'openclaw';
    let usedModel = aiModel;
    let errorMessage = null;
    let status = 'success';

    try {
      const result = await gatewayAIService.createStreamingChatCompletion(payload);
      if (!result || !result.success) {
        status = 'failed';
        errorMessage = result?.error || 'AI 流式服务未返回有效结果';
        throw new AppError(errorMessage, 502, 'AI_STREAM_FAILED');
      }

      provider = result.provider || provider;
      usedModel = result.model || aiModel;
      const stream = result.stream; // axios stream

      // 按行解析 OpenAI 兼容 SSE 格式: data: {...}\n\n  /  data: [DONE]
      answer = await new Promise((resolve, reject) => {
        let buffer = '';
        let full = '';
        stream.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          let idx;
          while ((idx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const obj = JSON.parse(payload);
              const delta = obj.choices?.[0]?.delta?.content
                || obj.choices?.[0]?.message?.content
                || obj.choices?.[0]?.text
                || '';
              if (delta) {
                full += delta;
                try { onChunk(delta); } catch (_) { /* ignore callback errors */ }
              }
            } catch (e) {
              // 忽略非 JSON 行(如 keep-alive 注释)
            }
          }
        });
        stream.on('end', () => resolve(full));
        stream.on('error', (err) => reject(err));
      });
    } catch (err) {
      status = 'failed';
      errorMessage = err.message || 'AI 流式服务调用异常';
    }

    const latency = Date.now() - startedAt;
    const citations = chunks.map((c, i) => ({
      index: i + 1,
      doc_id: c.doc_id,
      doc_title: c.doc_title,
      chunk_id: c.id,
      chunk_index: c.chunk_index,
      score: Number((c.score || 0).toFixed(4)),
      snippet: String(c.content || '').slice(0, 200),
    }));
    const retrievedSnippets = chunks.map(c => ({
      chunk_id: c.id,
      doc_id: c.doc_id,
      doc_title: c.doc_title,
      score: c.score,
      snippet: String(c.content || '').slice(0, 300),
    }));

    try {
      await this.kbService.saveQaRecord({
        tenantId, kb_id: kb_id || null, session_id: session_id || null,
        user_id: user?.id, user_name: user?.real_name || user?.username,
        question, answer,
        retrieved_chunks: retrievedSnippets, citations,
        provider, model: usedModel, latency_ms: latency,
        status, error_message: errorMessage,
      });
    } catch (e) {
      console.warn('保存问答记录失败:', e.message);
    }

    if (status === 'failed') {
      throw new AppError(errorMessage || 'AI 流式问答失败', 502, 'AI_FAILED');
    }

    return {
      answer,
      provider,
      model: usedModel,
      latency_ms: latency,
      citations,
      retrieved_chunks: retrievedSnippets,
    };
  }
}

function extractAssistantText(data) {
  if (!data) return '';
  const choices = data.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const msg = choices[0]?.message;
    if (msg) {
      return msg.content || msg.reasoning_content || msg.text || '';
    }
    if (choices[0]?.text) return choices[0].text;
  }
  if (typeof data === 'string') return data;
  return data.content || data.text || data.reply || data.answer || data.result || '';
}

module.exports = KnowledgeBaseAIService;
