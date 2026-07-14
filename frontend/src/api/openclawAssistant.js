import { api } from './client';
import auth from '../utils/auth';

const normalizeChatCompletionsPath = value => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '/ai/chat/completions';
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  if (normalized === '/chat/completions' || normalized.startsWith('/chat/completions?')) {
    return `/ai${normalized}`;
  }

  return normalized;
};

const normalizeAiModel = value => {
  const raw = String(value || '').trim();
  if (!raw) {
    return 'openclaw';
  }

  if (raw.toLowerCase() === 'opencode') {
    return 'openclaw';
  }

  return raw;
};

export const AI_CHAT_COMPLETIONS_PATH = normalizeChatCompletionsPath(
  import.meta.env.VITE_AI_CHAT_COMPLETIONS_PATH || '/ai/chat/completions',
);
export const AI_DEFAULT_MODEL = normalizeAiModel(import.meta.env.VITE_AI_MODEL || 'openclaw');
export const AI_ASSET_EXPORT_SCHEME = 'assetHost://assets-export';
export const AI_ASSISTANT_SKILL = 'assetHost';
export const AI_ASSISTANT_SKILL_FALLBACK = 'assetHost';
const DEFAULT_CHAT_COMPLETIONS_PATH = '/ai/chat/completions';

const isLikelyHtmlDocument = value => {
  if (typeof value !== 'string') {
    return false;
  }

  const sample = value.slice(0, 2048).toLowerCase();
  return sample.includes('<!doctype html') || (sample.includes('<html') && sample.includes('</html>'));
};

const extractText = value => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    return value
      .map(item => extractText(item))
      .filter(Boolean)
      .join('\n');
  }

  if (typeof value === 'object') {
    if (Array.isArray(value.choices)) {
      return (
        extractText(value.choices[0]?.message?.content) ||
        extractText(value.choices[0]?.message?.text) ||
        extractText(value.choices[0]?.text)
      );
    }

    if (value.message) {
      return extractText(value.message.content) || extractText(value.message.text) || extractText(value.message);
    }

    if (Array.isArray(value.parts)) {
      return extractText(value.parts);
    }

    return (
      extractText(value.content) ||
      extractText(value.text) ||
      extractText(value.reply) ||
      extractText(value.answer) ||
      extractText(value.result)
    );
  }

  return '';
};

export const createOpenClawAssetHubSystemMessage = () => ({
  role: 'system',
  content: [
    '你是 AssetHost 的 AI 助手，请使用中文直接回答。',
    'AssetHost 相关问题必须优先使用 `assetHost` 技能。',
    '身份、角色、菜单、权限、租户问题，优先调用 `assetHost` 技能。',
    '资产、库存、维修、调配、报废、告警、审计、配置问题，必须优先使用 assetHost 技能。',
    '对超级管理员账号，涉及租户级数据时必须显式依赖当前请求头里的 `X-Tenant-ID` 对应租户，不得猜测默认租户。',
    '如果认证失效、租户缺失、权限不足或结果为空，明确说明限制，不要编造。',
    '不要输出思考过程、工具调用过程或英文解释。',
  ].join('\n'),
});

export const createConversationId = (prefix = 'ai-session') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const buildOpenClawAssetHubMetadata = (extra = {}) => {
  const tenantId = auth.getEffectiveTenantId();

  return {
    assistant_skill: AI_ASSISTANT_SKILL,
    assistant_skill_fallback: AI_ASSISTANT_SKILL_FALLBACK,
    tenant_id: tenantId || undefined,
    ...extra,
  };
};

export const sendOpenClawAssistantMessage = async ({
  messages,
  sessionId,
  model = AI_DEFAULT_MODEL,
  metadata = {},
  signal,
  additionalHeaders = {},
}) => {
  const openclawCredentials = auth.getOpenClawCredentials();
  const loginUsername =
    String(openclawCredentials?.username || auth.getUser()?.username || '').trim() || undefined;
  const loginPassword = String(openclawCredentials?.password || '').trim() || undefined;
  const payload = {
    model,
    stream: false,
    session_id: sessionId || createConversationId(),
    messages,
    metadata: buildOpenClawAssetHubMetadata(metadata),
    openclaw_username: loginUsername,
    openclaw_password: loginPassword,
    openclaw_auth:
      loginUsername || loginPassword
        ? {
            username: loginUsername,
            password: loginPassword,
            source: 'web_login_session',
          }
        : undefined,
  };

  const candidatePaths = [AI_CHAT_COMPLETIONS_PATH];
  if (AI_CHAT_COMPLETIONS_PATH !== DEFAULT_CHAT_COMPLETIONS_PATH) {
    candidatePaths.push(DEFAULT_CHAT_COMPLETIONS_PATH);
  }

  let lastHtmlPath = '';
  for (const requestPath of candidatePaths) {
    const response = await api.post(requestPath, payload, {
      signal,
      headers: additionalHeaders,
    });
    const responseData = response?.data ?? response;
    const content = extractText(responseData).trim();

    // 防止把前端 index.html 当成 AI 响应显示在聊天窗口
    if (isLikelyHtmlDocument(responseData) || isLikelyHtmlDocument(content)) {
      lastHtmlPath = requestPath;
      continue;
    }

    return {
      content,
      raw: responseData,
      headers: response?.headers || {},
      sessionId: payload.session_id,
    };
  }

  throw new Error(
    `AI接口返回了HTML页面（可能命中了前端路由兜底）。请检查接口路径配置，当前尝试路径：${lastHtmlPath || AI_CHAT_COMPLETIONS_PATH}`,
  );
};

export const isAssistantAssetExportHref = href => {
  const normalizedHref = String(href || '').trim();
  return (
    normalizedHref.startsWith(AI_ASSET_EXPORT_SCHEME) ||
    normalizedHref.startsWith('/api/assets/export') ||
    normalizedHref.startsWith('/assets/export')
  );
};

const normalizeAssistantAssetExportPath = href => {
  const normalizedHref = String(href || '').trim();
  if (!normalizedHref) {
    return '';
  }

  if (normalizedHref.startsWith(AI_ASSET_EXPORT_SCHEME)) {
    const parsed = new URL(normalizedHref);
    return `/assets/export${parsed.search || ''}`;
  }

  if (normalizedHref.startsWith('/api/assets/export')) {
    return normalizedHref.replace(/^\/api/, '');
  }

  if (normalizedHref.startsWith('/assets/export')) {
    return normalizedHref;
  }

  return '';
};

const extractDownloadFilename = (headers = {}, fallbackName = 'assets_export.xlsx') => {
  const contentDisposition =
    headers?.['content-disposition'] || headers?.['Content-Disposition'] || '';
  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1]);
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return fallbackName;
};

export const downloadAssistantAssetExport = async href => {
  const requestPath = normalizeAssistantAssetExportPath(href);
  if (!requestPath) {
    throw new Error('无效的导出链接');
  }

  const response = await api.get(requestPath, {
    responseType: 'blob',
  });
  const parsed = new URL(requestPath, window.location.origin);
  const format = String(parsed.searchParams.get('format') || 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx';
  const defaultFilename = `assets_export.${format}`;
  const blob = response?.data instanceof Blob ? response.data : new Blob([response?.data]);
  const filename = extractDownloadFilename(response?.headers || {}, defaultFilename);
  const downloadUrl = window.URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    window.URL.revokeObjectURL(downloadUrl);
  }

  return {
    filename,
    requestPath,
  };
};
