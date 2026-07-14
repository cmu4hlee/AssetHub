const express = require('express');
const axios = require('axios');

const aiRuntimeAuthStore = require('../services/ai-runtime-auth-store');
const {
  buildOpenCodeAssetHubPrompt,
  normalizeMessages,
  extractText,
} = require('../services/opencode-assethub-prompt-template');

const DEFAULT_OPENCODE_BASE_URL = process.env.OPENCODE_BASE_URL || 'http://127.0.0.1:4096';
const DEFAULT_OPENCODE_MODEL = process.env.OPENCODE_MODEL || 'opencode';
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

function buildBasicAuthHeader() {
  const username = String(process.env.OPENCODE_SERVER_USERNAME || 'opencode').trim();
  const password = String(process.env.OPENCODE_SERVER_PASSWORD || '').trim();

  if (!password) {
    return '';
  }

  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

function createOpenCodeHttpClient() {
  const basicAuth = buildBasicAuthHeader();

  return axios.create({
    baseURL: DEFAULT_OPENCODE_BASE_URL,
    timeout: DEFAULT_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      ...(basicAuth ? { Authorization: basicAuth } : {}),
    },
  });
}

function extractAssistantContent(payload) {
  if (Array.isArray(payload?.parts)) {
    const textParts = payload.parts
      .filter(part => part?.type === 'text')
      .map(part => String(part.text || '').trim())
      .filter(Boolean);

    if (textParts.length > 0) {
      return textParts.join('\n').trim();
    }
  }

  const candidates = [
    payload?.parts,
    payload?.data?.parts,
    payload?.choices?.[0]?.message?.content,
    payload?.message?.content,
    payload?.reply,
    payload?.result,
  ];

  for (const candidate of candidates) {
    const text = extractText(candidate).trim();
    if (text) {
      return text;
    }
  }

  return '';
}

function buildCurrentSessionHint(req, tenantId) {
  const user = req.user || {};

  return {
    userId: user.id || user.userId || null,
    username: user.username || null,
    realName: user.real_name || user.realName || null,
    role: user.role || null,
    tenantId: tenantId || user.tenant_id || null,
    tenantName: user.tenant_name || null,
    departmentCode: user.department_code || null,
  };
}

function buildRuntimeToolContext(authRegistration, tenantId) {
  if (!authRegistration?.id) {
    return null;
  }

  return {
    toolRuntimeContext: {
      assethub: {
        _auth_context_id: authRegistration.id,
        ...(tenantId ? { tenant_id: tenantId } : {}),
      },
    },
  };
}

async function createOpenCodeSession(client, title) {
  const response = await client.post('/session', {
    title: title || 'AssetHub OpenCode Session',
  });

  return response.data;
}

async function sendOpenCodeMessage(client, sessionId, prompt) {
  const response = await client.post(`/session/${encodeURIComponent(sessionId)}/message`, {
    parts: [{ type: 'text', text: prompt }],
  });

  return response.data;
}

function createSuccessResponse(payload, content) {
  return {
    id: `chatcmpl_opencode_example_${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: String(payload.model || DEFAULT_OPENCODE_MODEL).trim() || DEFAULT_OPENCODE_MODEL,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: 'stop',
      },
    ],
    provider: 'opencode-example',
  };
}

function createOpencodeAssetHubExampleRouter() {
  const router = express.Router();
  const opencodeClient = createOpenCodeHttpClient();

  router.post('/chat/completions', async (req, res) => {
    const authHeader = req.header('Authorization') || '';
    const tenantIdHeader = Number.parseInt(String(req.header('X-Tenant-ID') || ''), 10);
    const tenantIdBody = Number.parseInt(String(req.body?.tenant_id || ''), 10);
    const tenantId = Number.isInteger(tenantIdHeader) && tenantIdHeader > 0
      ? tenantIdHeader
      : Number.isInteger(tenantIdBody) && tenantIdBody > 0
        ? tenantIdBody
        : null;

    const payload = req.body || {};
    const messages = normalizeMessages(payload.messages);
    if (messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'messages 不能为空',
      });
    }

    let authRegistration = null;
    try {
      authRegistration = await aiRuntimeAuthStore.registerAuthContext({
        authHeader,
        tenantId,
        userId: req.user?.id || req.user?.userId || null,
        username: req.user?.username || null,
        role: req.user?.role || null,
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: `运行时认证上下文注册失败: ${error.message}`,
      });
    }

    const prompt = buildOpenCodeAssetHubPrompt({
      messages,
      currentSessionHint: buildCurrentSessionHint(req, tenantId),
      runtimeToolContext: buildRuntimeToolContext(authRegistration, tenantId),
      extraRules: [
        '如果当前用户是超级管理员，且请求涉及租户级数据，必须显式依赖 `tenant_id`，不得使用共享默认租户。',
      ],
    });

    try {
      const session = await createOpenCodeSession(
        opencodeClient,
        payload.session_title || `AssetHub AI ${tenantId || 'global'}`,
      );
      const reply = await sendOpenCodeMessage(opencodeClient, session.id, prompt);
      const content = extractAssistantContent(reply);

      if (!content) {
        return res.status(502).json({
          success: false,
          message: 'OpenCode 未返回有效内容',
          detail: reply,
        });
      }

      return res.json(createSuccessResponse(payload, content));
    } catch (error) {
      return res.status(502).json({
        success: false,
        message: error.message || 'OpenCode 请求失败',
        detail: error.response?.data || null,
      });
    }
  });

  return router;
}

module.exports = {
  createOpencodeAssetHubExampleRouter,
};
