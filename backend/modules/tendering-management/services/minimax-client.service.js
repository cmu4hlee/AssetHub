// ============================================================
// MiniMax-M2.7 LLM 客户端（Anthropic 协议兼容）
// 用于采购与招标模块的 AI 辅助能力
//   - 非流式 generate({messages, system}, opts)
//   - 流式 SSE streamGenerate({messages, system}, opts)
//   - 健康检查 health()
//   - 两种认证: API Key (x-api-key) 或 OAuth Bearer Token
//
// 配置（环境变量，**不要**把 key 写进代码或提交仓库）：
//   MINIMAX_BASE_URL      默认 https://api.minimaxi.com/anthropic
//   MINIMAX_MESSAGES_PATH 默认 messages（API 名 anthropic-messages）
//   MINIMAX_MODEL         默认 MiniMax-M2.7
//   MINIMAX_API_KEY       API Key 直连模式
//   MINIMAX_ACCESS_TOKEN  OAuth Bearer Token 模式（与 API_KEY 二选一）
//   MINIMAX_TIMEOUT_MS    默认 25000
//
// OAuth：需要交互式终端，无法在脚本中自动完成。请在终端里手动：
//   cd /Users/mac/Desktop/OpenClaw
//   pnpm openclaw models auth login --provider minimax-portal --set-default
// 完成后拿到 access_token，写到 MINIMAX_ACCESS_TOKEN 环境变量即可。
// ============================================================

const BaseService = require('../../../core/BaseService');
const logger = require('../../../config/logger');

const DEFAULT_BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic';
const DEFAULT_MESSAGES_PATH = process.env.MINIMAX_MESSAGES_PATH || 'messages';
const DEFAULT_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
const DEFAULT_API_KEY = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY || '';
const DEFAULT_ACCESS_TOKEN = process.env.MINIMAX_ACCESS_TOKEN || '';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.MINIMAX_TIMEOUT_MS || '25000', 10);

function safeJsonParse(input) {
  if (!input) return null;
  try { return JSON.parse(input); } catch (_) { return null; }
}

class MiniMaxClient extends BaseService {
  constructor(options = {}) {
    super({ name: 'MiniMaxClient', ...options });
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.messagesPath = options.messagesPath || DEFAULT_MESSAGES_PATH;
    this.model = options.model || DEFAULT_MODEL;
    this.apiKey = options.apiKey || DEFAULT_API_KEY;
    this.accessToken = options.accessToken || DEFAULT_ACCESS_TOKEN;
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  isConfigured() {
    return Boolean(this.apiKey || this.accessToken);
  }

  getAuthMode() {
    if (this.accessToken) return 'oauth';
    if (this.apiKey) return 'api_key';
    return 'none';
  }

  // 动态切换认证：OAuth 完成后 setAuth({ accessToken }) 即可
  setAuth({ apiKey, accessToken } = {}) {
    if (typeof accessToken === 'string' && accessToken.length > 0) {
      this.accessToken = accessToken;
      this.apiKey = '';
    } else if (typeof apiKey === 'string' && apiKey.length > 0) {
      this.apiKey = apiKey;
      this.accessToken = '';
    }
  }

  _buildHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    } else if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }
    return headers;
  }

  _endpointUrl() {
    const base = this.baseUrl.endsWith('/v1') ? this.baseUrl : `${this.baseUrl}/v1`;
    return `${base}/${this.messagesPath}`.replace(/([^:]\/)\/+/g, '$1');
  }

  async health() {
    if (!this.isConfigured()) return { ok: false, reason: 'API_KEY / ACCESS_TOKEN 未配置' };
    try {
      const res = await this.generate({ messages: [{ role: 'user', content: 'hi' }] }, { max_tokens: 4 });
      return { ok: true, sample: res.text, mode: this.getAuthMode() };
    } catch (e) {
      return { ok: false, reason: e.message, mode: this.getAuthMode() };
    }
  }

  async generate({ messages = [], system } = {}, opts = {}) {
    if (!this.isConfigured()) {
      throw new Error('MiniMax API_KEY / ACCESS_TOKEN 未配置');
    }
    const body = {
      model: this.model,
      max_tokens: opts.max_tokens || 800,
      temperature: opts.temperature ?? 0.2,
      messages,
    };
    if (system) body.system = system;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this._endpointUrl(), {
        method: 'POST',
        headers: this._buildHeaders(),
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`MiniMax HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const json = safeJsonParse(text);
      return { text: extractText(json), raw: json, mode: this.getAuthMode() };
    } finally {
      clearTimeout(t);
    }
  }

  async *streamGenerate({ messages = [], system } = {}, opts = {}) {
    if (!this.isConfigured()) {
      throw new Error('MiniMax API_KEY / ACCESS_TOKEN 未配置');
    }
    const body = {
      model: this.model,
      max_tokens: opts.max_tokens || 800,
      temperature: opts.temperature ?? 0.2,
      messages,
      stream: true,
    };
    if (system) body.system = system;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this._endpointUrl(), {
        method: 'POST',
        headers: { ...this._buildHeaders(), Accept: 'text/event-stream' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => '');
        throw new Error(`MiniMax HTTP ${res.status}: ${err.slice(0, 200)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nlIdx;
        while ((nlIdx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, nlIdx);
          buf = buf.slice(nlIdx + 2);
          for (const line of chunk.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') continue;
            const json = safeJsonParse(payload);
            if (!json) continue;
            const delta = extractDelta(json);
            if (delta) yield delta;
          }
        }
      }
    } finally {
      clearTimeout(t);
    }
  }
}

function extractText(json) {
  if (!json || !Array.isArray(json.content)) return '';
  return json.content.filter(b => b.type === 'text').map(b => b.text || '').join('');
}

function extractDelta(json) {
  if (!json || !json.type) return null;
  if (json.type === 'content_block_delta' && json.delta && json.delta.type === 'text_delta') {
    return json.delta.text;
  }
  return null;
}

module.exports = MiniMaxClient;
