const axios = require('axios');
const fs = require('fs');
const db = require('../config/database');
const logger = require('../config/logger');
const { cacheService } = require('./redis');

// 缓存配置
const CACHE_TTL = 3600; // 缓存1小时
const DB_STRUCTURE_CACHE_KEY = 'db_structure';
const AI_ANALYSIS_CACHE_PREFIX = 'ai_analysis';

// 阿里百炼配置
const { DASHSCOPE_API_KEY } = process.env;
const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL || 'qwen-turbo';
const { DASHSCOPE_APP_ID } = process.env;

// 本地 Ollama 配置
const OLLAMA_API_URL = (process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434').replace(
  /\/+$/,
  '',
);
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3-vl:8b';
const OLLAMA_TIMEOUT = Number.parseInt(process.env.OLLAMA_TIMEOUT || '300000', 10);
const DEFAULT_ANALYSIS_PROVIDER = (process.env.ASSET_AI_PROVIDER || 'ollama').trim().toLowerCase();
const DEFAULT_SQL_RESULT_LIMIT = Number.parseInt(process.env.ASSET_AI_SQL_LIMIT || '200', 10);
const MAX_RESULT_ANALYSIS_ROWS = Number.parseInt(process.env.ASSET_AI_ANALYSIS_ROWS || '50', 10);
const DIRECT_ANSWER_PREFIX = 'NO_SQL:';
const TENANT_AWARE_SQL_TABLES = ['assets', 'departments', 'asset_categories', 'asset_change_logs'];
const SQL_ALIAS_STOP_WORDS = new Set([
  'where',
  'left',
  'right',
  'inner',
  'outer',
  'join',
  'on',
  'group',
  'order',
  'limit',
  'having',
  'offset',
  'union',
]);

// LM Studio配置（兼容保留）
const LM_STUDIO_API_URL = process.env.LM_STUDIO_API_URL || 'http://127.0.0.1:1234';
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'qwen/qwen3-vl-8b';

// DeepSeek配置
const {DEEPSEEK_API_KEY} = process.env;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com';

// Anthropic配置
const {ANTHROPIC_API_KEY} = process.env;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229';
const ANTHROPIC_API_URL = process.env.ANTHROPIC_API_URL || 'https://api.minimaxi.com/anthropic';

// SQLBot Open API 对话接口配置
const SQLBOT_OPEN_API_BASE_URL = (
  process.env.SQLBOT_OPEN_API_BASE_URL ||
  process.env.SQLBOT_BASE_URL ||
  'http://127.0.0.1:8000'
).replace(/\/+$/, '');
const SQLBOT_OPEN_API_PREFIX = process.env.SQLBOT_OPEN_API_PREFIX || '/api/v1/open';
const SQLBOT_OPEN_API_KEY = process.env.SQLBOT_OPEN_API_KEY || process.env.OPEN_API_KEY || '';
const SQLBOT_OPEN_TOKEN = process.env.SQLBOT_OPEN_TOKEN || '';
const SQLBOT_OPEN_API_USERNAME =
  process.env.SQLBOT_OPEN_API_USERNAME || process.env.OPEN_API_USERNAME || '';
const SQLBOT_OPEN_API_PASSWORD =
  process.env.SQLBOT_OPEN_API_PASSWORD || process.env.OPEN_API_PASSWORD || '';
const SQLBOT_OPEN_DEFAULT_DATASOURCE_ID =
  process.env.SQLBOT_OPEN_DEFAULT_DATASOURCE_ID || process.env.SQLBOT_DATASOURCE_ID || '';
const SQLBOT_OPEN_API_TIMEOUT = Number.parseInt(process.env.SQLBOT_OPEN_API_TIMEOUT || '120000', 10);
const SQLBOT_MCP_API_PREFIX = process.env.SQLBOT_MCP_API_PREFIX || '/api/v1/mcp';

let cachedOpenDatasourceId = null;
let cachedMcpSession = null;

// 环境变量验证
function validateEnvironmentVariables() {
  const providerRequirements = {
    ollama: [
      { name: 'OLLAMA_API_URL', description: 'Ollama API地址', value: OLLAMA_API_URL },
      { name: 'OLLAMA_MODEL', description: 'Ollama模型名称', value: OLLAMA_MODEL },
    ],
    'sqlbot-open-api': [
      {
        name: 'SQLBOT_OPEN_API_BASE_URL',
        description: 'SQLBot Open API地址',
        value: SQLBOT_OPEN_API_BASE_URL,
      },
    ],
    'lm-studio': [
      { name: 'LM_STUDIO_API_URL', description: 'LM Studio API地址', value: LM_STUDIO_API_URL },
      { name: 'LM_STUDIO_MODEL', description: 'LM Studio模型名称', value: LM_STUDIO_MODEL },
    ],
  };

  const requiredEnvVars = providerRequirements[DEFAULT_ANALYSIS_PROVIDER] || [];

  for (const envVar of requiredEnvVars) {
    if (!envVar.value) {
      structuredLog('warn', `环境变量${envVar.name}未设置，将使用默认值`, {
        variable: envVar.name,
        description: envVar.description,
      });
    }
  }
}

// 调用环境变量验证
validateEnvironmentVariables();

// 最大重试次数
const MAX_RETRIES = 2;
// 重试间隔（毫秒）
const RETRY_DELAY = 1000;

// 结构化日志记录函数（保留以兼容现有代码）
function structuredLog(level, message, data = {}) {
  const logData = {
    service: 'asset-ai-analysis',
    ...data,
  };

  switch (level) {
    case 'info':
      logger.info(message, logData);
      break;
    case 'warn':
      logger.warn(message, logData);
      break;
    case 'error':
      logger.error(message, logData);
      break;
    default:
      logger.info(message, logData);
  }
}

/**
 * 带重试机制的API调用函数
 * @param {Function} fn - 要执行的API调用函数
 * @param {number} maxRetries - 最大重试次数
 * @param {number} delay - 重试间隔（毫秒）
 * @returns {Promise<any>} API调用结果
 */
async function withRetry(fn, maxRetries = MAX_RETRIES, delay = RETRY_DELAY) {
  let retries = 0;

  while (retries <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      // 只有网络错误才重试，服务端错误不重试
      if (
        error.code &&
        (error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNABORTED' ||
          error.code === 'ENOTFOUND')
      ) {
        retries++;
        if (retries > maxRetries) {
          throw error;
        }
        structuredLog('warn', '网络错误，将重试', {
          error: error.message,
          errorCode: error.code,
          retryCount: retries,
          maxRetries,
          delay,
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        // 指数退避策略
        delay *= 2;
      } else {
        // 非网络错误，直接抛出
        throw error;
      }
    }
  }
}

function normalizePositiveInt(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function requireTenantIdForAnalysis(tenantId) {
  const normalizedTenantId = normalizePositiveInt(tenantId);
  if (!normalizedTenantId) {
    throw new Error('当前用户未分配企业空间');
  }
  return normalizedTenantId;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeAnalysisProvider(modelService) {
  const normalized = String(modelService || '').trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_ANALYSIS_PROVIDER;
  }

  if (
    normalized === 'ollama' ||
    normalized === 'local-ollama' ||
    normalized === 'qwen3-vl:8b' ||
    normalized === 'qwen3-vl-8b'
  ) {
    return 'ollama';
  }

  if (normalized === 'sqlbot' || normalized === 'sqlbot-open-api' || normalized === 'open-api') {
    return 'sqlbot-open-api';
  }

  if (normalized === 'lm-studio' || normalized === 'lmstudio') {
    return 'lm-studio';
  }

  return DEFAULT_ANALYSIS_PROVIDER;
}

function buildOllamaSourceLabel() {
  return `ollama:${OLLAMA_MODEL}`;
}

function trimDirectAnswerPrefix(content) {
  return String(content || '')
    .replace(/^NO_SQL:\s*/i, '')
    .trim();
}

function stripTrailingSemicolon(sql) {
  return String(sql || '').trim().replace(/;\s*$/, '');
}

function ensureSqlHasLimit(sql, limit = DEFAULT_SQL_RESULT_LIMIT) {
  if (!sql || limit <= 0) {
    return sql;
  }

  if (/\blimit\s+\d+/i.test(sql)) {
    return sql;
  }

  return `${stripTrailingSemicolon(sql)} LIMIT ${limit};`;
}

function getTenantScopedSqlRefs(sql) {
  const refs = [];
  const refPattern = /\b(?:from|join)\s+([a-z_][\w]*)(?:\s+(?:as\s+)?([a-z_][\w]*))?/gi;
  let match;

  while ((match = refPattern.exec(sql)) !== null) {
    const tableName = String(match[1] || '').toLowerCase();
    if (!TENANT_AWARE_SQL_TABLES.includes(tableName)) {
      continue;
    }

    const rawAlias = String(match[2] || '').toLowerCase();
    const alias = rawAlias && !SQL_ALIAS_STOP_WORDS.has(rawAlias) ? rawAlias : tableName;

    refs.push({
      table: tableName,
      alias,
    });
  }

  return refs;
}

function hasTenantScopeForRef(sql, ref, tenantId) {
  const aliasPattern = escapeRegExp(ref.alias);
  const tablePattern = escapeRegExp(ref.table);

  const directEqPattern = new RegExp(
    `\\b(?:${aliasPattern}|${tablePattern})\\.tenant_id\\s*=\\s*${tenantId}\\b`,
    'i',
  );
  const inPattern = new RegExp(
    `\\b(?:${aliasPattern}|${tablePattern})\\.tenant_id\\s+IN\\s*\\(\\s*(?:0\\s*,\\s*${tenantId}|${tenantId}\\s*,\\s*0|${tenantId})\\s*\\)`,
    'i',
  );

  return directEqPattern.test(sql) || inPattern.test(sql);
}

function assertTenantScopedSql(sql, tenantId) {
  const refs = getTenantScopedSqlRefs(sql);
  if (!refs.length) {
    return;
  }

  const normalizedTenantId = normalizePositiveInt(tenantId);
  if (!normalizedTenantId) {
    throw new Error(
      `AI生成的SQL缺少租户隔离条件: ${refs.map(ref => ref.alias).join(', ')}`,
    );
  }

  const missingRefs = refs.filter(ref => !hasTenantScopeForRef(sql, ref, normalizedTenantId));
  if (missingRefs.length > 0) {
    throw new Error(
      `AI生成的SQL缺少租户隔离条件: ${missingRefs.map(ref => ref.alias).join(', ')}`,
    );
  }
}

function buildOllamaSqlMessages(prompt, tenantId, dbInfo) {
  const tenantInstruction = tenantId
    ? `当前租户ID为 ${tenantId}。任何涉及租户数据的 SQL 都必须对每个相关表显式添加 tenant_id = ${tenantId} 条件。`
    : '当前请求未提供租户ID，只能生成只读 SQL 或直接回答。';

  return [
    {
      role: 'system',
      content: [
        '你是 AssetHub 的本地 SQL 分析助手。',
        '如果用户问题需要查询数据库，只输出一条只读 MySQL SELECT 语句。',
        `如果用户提供的资产 JSON 已经足够回答，或者无需查询数据库，请直接输出以 "${DIRECT_ANSWER_PREFIX}" 开头的中文回答。`,
        '禁止输出 INSERT、UPDATE、DELETE、DROP、ALTER、CREATE、UNION、多语句或任何解释说明。',
        `若用户未指定更小的返回条数，默认附加 LIMIT ${DEFAULT_SQL_RESULT_LIMIT}。`,
        tenantInstruction,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        '## 数据库结构信息（仅核心表定义）',
        dbInfo?.dbStructure || '未提供数据库结构信息',
        '',
        dbInfo?.constraints || '',
        '',
        '## 当前分析要求',
        '- 所有 SQL 必须只读。',
        '- 若生成 SQL，只返回 SQL 文本本身，不要使用 Markdown 代码块。',
        '- 若直接回答，请使用 NO_SQL 前缀。',
        '',
        '## 用户问题',
        prompt,
      ].join('\n'),
    },
  ];
}

function buildOllamaResultAnalysisMessages(prompt, sqlExecution) {
  const resultRows = Array.isArray(sqlExecution?.results)
    ? sqlExecution.results.slice(0, MAX_RESULT_ANALYSIS_ROWS)
    : [];

  return [
    {
      role: 'system',
      content: [
        '你是 AssetHub 的本地数据分析助手。',
        '请基于给定 SQL 和查询结果，用中文输出简洁、结构化、可执行的分析结论。',
        '只能依据提供的数据作答，不要编造数据库中不存在的内容。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        '## 用户问题',
        prompt,
        '',
        '## 执行SQL',
        sqlExecution?.sql || '无',
        '',
        '## 查询结果统计',
        `- 执行成功: ${sqlExecution?.success ? '是' : '否'}`,
        `- 返回行数: ${sqlExecution?.resultCount || 0}`,
        '',
        '## 查询结果样本(JSON)',
        JSON.stringify(resultRows, null, 2),
        '',
        '请按以下结构回答：',
        '1. 直接结论',
        '2. 关键数据',
        '3. 管理建议',
        '如果没有查询到数据，请明确说明。',
      ].join('\n'),
    },
  ];
}

async function callOllamaChat(messages, options = {}) {
  const { temperature = 0.2, maxTokens = 2000 } = options;

  try {
    const response = await withRetry(() =>
      axios.post(
        `${OLLAMA_API_URL}/api/chat`,
        {
          model: OLLAMA_MODEL,
          messages,
          stream: false,
          options: {
            temperature,
            num_predict: maxTokens,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: OLLAMA_TIMEOUT,
        },
      ),
    );

    const content = response.data?.message?.content;
    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }

    structuredLog('error', 'Ollama响应格式不正确', {
      responseData: response.data,
    });
    throw new Error('Ollama响应格式不正确');
  } catch (error) {
    structuredLog('error', '调用Ollama失败', {
      error: error.message,
      responseData: error.response?.data,
      status: error.response?.status,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
    });
    throw new Error(`Ollama调用失败: ${error.message}`);
  }
}

function getSqlBotOpenApiUrl(pathname = '') {
  const prefix = SQLBOT_OPEN_API_PREFIX.startsWith('/')
    ? SQLBOT_OPEN_API_PREFIX
    : `/${SQLBOT_OPEN_API_PREFIX}`;
  return `${SQLBOT_OPEN_API_BASE_URL}${prefix}${pathname}`;
}

function getSqlBotMcpApiUrl(pathname = '') {
  const prefix = SQLBOT_MCP_API_PREFIX.startsWith('/')
    ? SQLBOT_MCP_API_PREFIX
    : `/${SQLBOT_MCP_API_PREFIX}`;
  return `${SQLBOT_OPEN_API_BASE_URL}${prefix}${pathname}`;
}

function normalizeBearerHeader(token) {
  if (!token || typeof token !== 'string') {
    return '';
  }
  const trimmed = token.trim();
  if (!trimmed) {
    return '';
  }
  return /^bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

function extractRawToken(token) {
  if (!token || typeof token !== 'string') {
    return '';
  }
  return token.replace(/^bearer\s+/i, '').trim();
}

function isOpenApiUnavailableError(error) {
  const status = error?.response?.status;
  if (status === 404 || status === 405) {
    return true;
  }
  if (status === 401 || status === 403) {
    const responseData = error?.response?.data;
    const detail =
      (typeof responseData === 'string' ? responseData : '') ||
      responseData?.detail ||
      responseData?.message ||
      '';
    if (
      detail.includes('Miss Token[X-SQLBOT-TOKEN]') ||
      detail.includes('Token schema error') ||
      detail.includes('Authentication invalid')
    ) {
      return true;
    }
  }
  return false;
}

function buildSqlBotOpenApiHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (SQLBOT_OPEN_API_KEY) {
    headers['X-SQLBOT-OPEN-KEY'] = SQLBOT_OPEN_API_KEY;
  }
  if (SQLBOT_OPEN_TOKEN) {
    headers['X-SQLBOT-TOKEN'] = normalizeBearerHeader(SQLBOT_OPEN_TOKEN);
  }
  return headers;
}

function buildSqlBotAuthPayload() {
  const payload = {};
  if (SQLBOT_OPEN_API_USERNAME && SQLBOT_OPEN_API_PASSWORD) {
    payload.username = SQLBOT_OPEN_API_USERNAME;
    payload.password = SQLBOT_OPEN_API_PASSWORD;
  }
  return payload;
}

function extractOpenAnswerText(answer) {
  if (typeof answer === 'string') {
    return answer;
  }
  if (!answer || typeof answer !== 'object') {
    return '';
  }

  const candidates = [answer.message, answer.content, answer.text, answer.answer];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  try {
    return JSON.stringify(answer, null, 2);
  } catch (error) {
    return String(answer);
  }
}

function normalizeOpenSqlExecution(answer, sql) {
  if (!answer || typeof answer !== 'object') {
    return null;
  }

  let {data} = answer;
  if (data === null || data === undefined || data === '') {
    return null;
  }

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) {
      return null;
    }
    try {
      data = JSON.parse(trimmed);
    } catch (error) {
      return {
        success: true,
        sql: sql || null,
        results: [],
        resultCount: 0,
        raw: data,
      };
    }
  }

  if (Array.isArray(data)) {
    return {
      success: true,
      sql: sql || null,
      results: data,
      resultCount: data.length,
    };
  }

  if (data && typeof data === 'object' && Array.isArray(data.results)) {
    return {
      success: data.success !== false,
      sql: sql || null,
      results: data.results,
      resultCount: data.results.length,
      error: data.error || null,
    };
  }

  return {
    success: true,
    sql: sql || null,
    results: [],
    resultCount: 0,
    raw: data,
  };
}

function formatSqlBotOpenApiError(error) {
  const status = error.response?.status;
  const responseData = error.response?.data;
  const detail =
    responseData?.message ||
    responseData?.error ||
    (typeof responseData === 'string' ? responseData : '');

  if (status === 401) {
    return `SQLBot 鉴权失败(401)，请检查 SQLBOT_OPEN_API_KEY/OPEN_API_KEY 或 SQLBOT_OPEN_TOKEN 配置${detail ? `: ${detail}` : ''}`;
  }
  if (status === 400) {
    return `SQLBot 请求参数错误(400)${detail ? `: ${detail}` : ''}`;
  }
  if (status === 404) {
    return `SQLBot 会话或资源不存在(404)${detail ? `: ${detail}` : ''}`;
  }
  if (detail) {
    return `${error.message}: ${detail}`;
  }
  return error.message || 'SQLBot 调用失败';
}

function parseMcpDataEnvelope(responseData) {
  if (responseData && typeof responseData === 'object' && responseData.code === 0) {
    return responseData.data;
  }
  return responseData;
}

async function createMcpSession() {
  if (!SQLBOT_OPEN_API_USERNAME || !SQLBOT_OPEN_API_PASSWORD) {
    throw new Error('缺少 SQLBot 账号密码，无法建立 MCP 会话');
  }

  const response = await withRetry(() =>
    axios.post(
      getSqlBotMcpApiUrl('/mcp_start'),
      {
        username: SQLBOT_OPEN_API_USERNAME,
        password: SQLBOT_OPEN_API_PASSWORD,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: SQLBOT_OPEN_API_TIMEOUT,
      },
    ),
  );

  const mcpData = parseMcpDataEnvelope(response.data) || {};
  const accessToken = extractRawToken(mcpData.access_token);
  const chatId = normalizePositiveInt(mcpData.chat_id);
  if (!accessToken || !chatId) {
    throw new Error('MCP 会话创建成功但未返回有效 token/chat_id');
  }

  cachedMcpSession = {
    accessToken,
    chatId,
  };
  return cachedMcpSession;
}

async function ensureMcpSession() {
  if (cachedMcpSession?.accessToken && cachedMcpSession?.chatId) {
    return cachedMcpSession;
  }
  return createMcpSession();
}

async function fetchMcpDatasources() {
  const session = await ensureMcpSession();
  const response = await withRetry(() =>
    axios.post(
      `${getSqlBotMcpApiUrl('/mcp_ds_list')}?token=${encodeURIComponent(session.accessToken)}`,
      null,
      {
        timeout: SQLBOT_OPEN_API_TIMEOUT,
      },
    ),
  );

  const payload = parseMcpDataEnvelope(response.data);
  return Array.isArray(payload) ? payload : [];
}

async function askViaMcp(question, options = {}) {
  const prompt = typeof question === 'string' ? question.trim() : '';
  if (!prompt) {
    throw new Error('问题不能为空');
  }

  let session = await ensureMcpSession();
  let targetChatId = normalizePositiveInt(options.chatId) || session.chatId;
  const targetDatasourceId = normalizePositiveInt(options.datasourceId);
  if (!targetChatId) {
    session = await createMcpSession();
    targetChatId = session.chatId;
  }

  const payload = {
    token: session.accessToken,
    chat_id: targetChatId,
    question: prompt,
    stream: false,
  };
  if (targetDatasourceId) {
    payload.datasource_id = targetDatasourceId;
  }

  try {
    const response = await withRetry(() =>
      axios.post(getSqlBotMcpApiUrl('/mcp_question'), payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: SQLBOT_OPEN_API_TIMEOUT,
      }),
    );
    const answer = parseMcpDataEnvelope(response.data) || {};
    cachedMcpSession = {
      ...session,
      chatId: targetChatId,
    };
    return {
      answer,
      chatId: targetChatId,
      datasourceId: targetDatasourceId || normalizePositiveInt(options.datasourceId) || null,
    };
  } catch (error) {
    if (error?.response?.status === 403 || error?.response?.status === 401) {
      session = await createMcpSession();
      const retryPayload = {
        ...payload,
        token: session.accessToken,
        chat_id: normalizePositiveInt(options.chatId) || session.chatId,
      };
      const retryResponse = await withRetry(() =>
        axios.post(getSqlBotMcpApiUrl('/mcp_question'), retryPayload, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: SQLBOT_OPEN_API_TIMEOUT,
        }),
      );
      const answer = parseMcpDataEnvelope(retryResponse.data) || {};
      cachedMcpSession = {
        ...session,
        chatId: retryPayload.chat_id,
      };
      return {
        answer,
        chatId: retryPayload.chat_id,
        datasourceId: targetDatasourceId || normalizePositiveInt(options.datasourceId) || null,
      };
    }
    throw error;
  }
}

async function fetchOpenDatasources() {
  try {
    const headers = buildSqlBotOpenApiHeaders();
    const body = buildSqlBotAuthPayload();

    const response = await withRetry(() =>
      axios.post(getSqlBotOpenApiUrl('/datasources'), body, {
        headers,
        timeout: SQLBOT_OPEN_API_TIMEOUT,
      }),
    );

    const datasources = Array.isArray(response.data?.datasources) ? response.data.datasources : [];
    return datasources;
  } catch (error) {
    if (isOpenApiUnavailableError(error)) {
      structuredLog('warn', 'SQLBot Open API数据源接口不可用，回退到MCP接口', {
        status: error.response?.status,
      });
      return fetchMcpDatasources();
    }
    throw error;
  }
}

async function resolveOpenDatasourceId(preferredDatasourceId) {
  const directDatasourceId = normalizePositiveInt(preferredDatasourceId);
  if (directDatasourceId) {
    return directDatasourceId;
  }

  const envDatasourceId = normalizePositiveInt(SQLBOT_OPEN_DEFAULT_DATASOURCE_ID);
  if (envDatasourceId) {
    return envDatasourceId;
  }

  if (cachedOpenDatasourceId) {
    return cachedOpenDatasourceId;
  }

  const datasources = await fetchOpenDatasources();
  if (!datasources.length) {
    throw new Error('未获取到可用数据源，请检查 SQLBot 账号权限');
  }

  const firstDatasourceId = normalizePositiveInt(datasources[0]?.id);
  if (!firstDatasourceId) {
    throw new Error('SQLBot 返回了无效的数据源ID');
  }

  cachedOpenDatasourceId = firstDatasourceId;
  return firstDatasourceId;
}

async function askViaSqlBotOpenAPI(question, options = {}) {
  const prompt = typeof question === 'string' ? question.trim() : '';
  if (!prompt) {
    throw new Error('问题不能为空');
  }

  const { chatId, datasourceId } = options || {};
  const normalizedChatId = normalizePositiveInt(chatId);
  const normalizedDatasourceId = await resolveOpenDatasourceId(datasourceId);

  const body = {
    ...buildSqlBotAuthPayload(),
    question: prompt,
    stream: false,
    datasource_id: normalizedDatasourceId,
  };

  if (normalizedChatId) {
    body.chat_id = normalizedChatId;
  }

  try {
    const response = await withRetry(() =>
      axios.post(getSqlBotOpenApiUrl('/ask'), body, {
        headers: buildSqlBotOpenApiHeaders(),
        timeout: SQLBOT_OPEN_API_TIMEOUT,
      }),
    );

    const chatIdFromBody = normalizePositiveInt(response.data?.chat_id);
    const chatIdFromHeader = normalizePositiveInt(response.headers?.['x-sqlbot-chat-id']);
    const resolvedChatId = chatIdFromBody || chatIdFromHeader || normalizedChatId || null;
    const answer = response.data?.answer || {};

    if (answer && typeof answer === 'object' && answer.success === false) {
      throw new Error(answer.message || 'SQLBot 对话接口执行失败');
    }

    return {
      answer,
      chatId: resolvedChatId,
      datasourceId: normalizedDatasourceId,
    };
  } catch (error) {
    if (isOpenApiUnavailableError(error)) {
      structuredLog('warn', 'SQLBot Open API问答接口不可用，回退到MCP接口', {
        status: error.response?.status,
      });
      return askViaMcp(prompt, {
        chatId: normalizedChatId,
        datasourceId: normalizedDatasourceId,
      });
    }
    throw error;
  }
}

async function getOpenDatasources() {
  const provider = normalizeAnalysisProvider();

  if (provider !== 'sqlbot-open-api') {
    return {
      success: true,
      data: [
        {
          id: 'local-asset-db',
          name: '当前租户资产库',
          type: 'ollama',
          type_name: `Ollama / ${OLLAMA_MODEL}`,
        },
      ],
    };
  }

  try {
    const datasources = await fetchOpenDatasources();
    return {
      success: true,
      data: datasources,
    };
  } catch (error) {
    const formattedError = formatSqlBotOpenApiError(error);
    structuredLog('error', '获取SQLBot数据源失败', {
      error: formattedError,
      status: error.response?.status,
      response: error.response?.data,
    });
    return {
      success: false,
      message: `获取数据源失败: ${formattedError}`,
    };
  }
}

/**
 * 调用百炼API进行AI分析
 * @param {string} prompt - 提示词
 * @returns {Promise<string>} AI响应内容
 */
async function callDashScopeAPI(prompt) {
  try {
    // 检查环境变量
    if (!DASHSCOPE_API_KEY || !DASHSCOPE_APP_ID) {
      structuredLog('error', '百炼API环境变量未设置', {
        DASHSCOPE_API_KEY: !!DASHSCOPE_API_KEY,
        DASHSCOPE_APP_ID: !!DASHSCOPE_APP_ID,
      });
      throw new Error('百炼API环境变量未设置');
    }

    // 尝试从多个可能的位置读取数据库结构文件
    const possiblePaths = [
      './docs/zcgl-database-structure.md',
      '../docs/zcgl-database-structure.md',
      '../../docs/zcgl-database-structure.md',
      './zcgl-database-structure.md',
    ];

    let dbStructureContent;
    let foundPath = null;

    try {
      // 尝试读取文件
      for (const path of possiblePaths) {
        try {
          dbStructureContent = fs.readFileSync(path, 'utf8');
          foundPath = path;
          structuredLog('info', '成功读取数据库结构文件', { filePath: path });
          break;
        } catch (e) {
          // 文件不存在，继续尝试下一个路径
          continue;
        }
      }

      // 如果所有路径都失败，使用默认结构
      if (!foundPath) {
        throw new Error('所有数据库结构文件路径都不存在');
      }
    } catch (error) {
      structuredLog('warn', '数据库结构文件不存在，使用默认结构描述', { error: error.message });
      // 使用默认的数据库结构描述
      dbStructureContent = `# 资产管理系统数据库结构

## 核心表结构

### 资产主表（assets）
- id: 资产ID，主键
- asset_code: 资产编号
- asset_name: 资产名称
- brand: 品牌
- model: 型号
- specification: 规格
- department: 所属科室
- department_new: 新所属科室
- status: 资产状态
- purchase_date: 购买日期
- purchase_price: 购买价格

### 科室表（departments）
- id: 科室ID，主键
- department_code: 科室编码
- department_name: 科室名称
- tenant_id: 租户ID

### 资产分类表（asset_categories）
- id: 分类ID，主键
- category_code: 分类编码
- category_name: 分类名称

### 资产变更日志表（asset_change_logs）
- id: 日志ID，主键
- asset_id: 资产ID
- change_type: 变更类型
- change_content: 变更内容
- created_at: 创建时间`;
    }

    // 只保留与资产分析相关的核心表结构
    const coreTables = [
      '资产主表（assets）',
      '科室表（departments）',
      '资产分类表（asset_categories）',
      '资产变更日志表（asset_change_logs）',
    ];

    // 解析并过滤数据库结构，只保留核心表
    const lines = dbStructureContent.split('\n');
    const filteredLines = [];
    let includeLine = false;

    for (const line of lines) {
      // 检查是否是表定义行
      const tableMatch = line.match(/^表\d+：(.*?)$/);
      if (tableMatch) {
        const tableName = tableMatch[1];
        includeLine = coreTables.some(coreTable => tableName.includes(coreTable));
      }

      // 如果包含当前行或者是标题行，添加到过滤后的内容中
      if (includeLine || line.startsWith('#') || line.startsWith('数据库名：')) {
        filteredLines.push(line);
      }

      // 如果是表定义行且不包含，则添加一个分隔符
      if (tableMatch && !includeLine) {
        // 跳过该表的所有内容
        continue;
      }
    }

    // 重新构建过滤后的数据库结构内容
    dbStructureContent = filteredLines.join('\n');

    structuredLog('info', '从MD文件读取并过滤数据库结构用于百炼API', {
      filePath: foundPath || '默认结构',
      originalContentLength: filteredLines.length,
      filteredContentLength: dbStructureContent.length,
    });

    // 构建完整提示词，包含数据库结构和约束条件
    const fullPrompt = `
## 数据库结构信息
${dbStructureContent}

### 指令约束
0.不可以生成增加、删除和更新的数据库语句
1. 严格根据上述数据库结构生成SQL，禁止使用未定义的表/字段/关联关系；
2. 生成的SQL为标准[MySQL]语法，适配对应数据库版本，无需额外注释；
3. 处理时间/数值字段时保留原字段类型，无需类型转换，条件判断使用精准运算符；
4. 若用户需求涉及多表关联，必须使用显式JOIN（INNER JOIN/LEFT JOIN），禁止隐式连接；
5. 若用户需求模糊（如未指定时间范围），仅生成基础SQL框架，不随意补充条件；
6. 直接输出SQL语句，无其他多余文字（如“以下是生成的SQL”）；
7. 当需要查询科室资产时，科室的匹配使用LIKE而不使用=。

### 示例查询
1.查询某资产明细，以病理科为例：SELECT a.*
 FROM assets a
 INNER JOIN departments d ON a.department = d.department_name
 WHERE d.department_name LIKE '%病理科%';

2.查询资产总明细，以显微镜为例：SELECT
 a.asset_name,
 a.asset_code,
 a.brand,
 a.model,
 a.department,
 a.use_department,
 a.location,
 a.status,
 a.purchase_date,
 a.purchase_price,
 a.current_value,
 a.depreciation_method,
 a.depreciation_years,
 a.warranty_period,
 a.warranty_end_date,
 a.created_at
 FROM assets a
 WHERE a.asset_name LIKE '%显微镜%'

## 用户问题
${prompt}
`;

    // 使用兼容OpenAI格式调用百炼API
    const requestData = {
      model: DASHSCOPE_MODEL || 'qwen-turbo',
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
      max_tokens: 2000, // 减少max_tokens，避免请求过大
      temperature: 0.7, // 添加温度参数
      top_p: 0.9, // 添加top_p参数，提高生成质量
    };

    // 设置请求头
    const headers = {
      Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
      'X-DashScope-AppId': DASHSCOPE_APP_ID,
    };

    structuredLog('info', '调用百炼API请求详情', {
      url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      model: requestData.model,
      maxTokens: requestData.max_tokens,
      promptLength: fullPrompt.length,
    });

    // 调用兼容OpenAI格式的API端点，添加30秒超时和重试机制
    const response = await withRetry(() =>
      axios.post(
        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        requestData,
        { headers, timeout: 300000 },
      ),
    );

    // 解析响应
    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content;
    } else {
      structuredLog('error', '百炼API响应格式不正确', {
        responseData: response.data,
      });
      throw new Error('百炼API响应格式不正确');
    }
  } catch (error) {
    structuredLog('error', '调用百炼API失败', {
      error: error.message,
      errorStack: error.stack,
      responseData: error.response?.data,
      status: error.response?.status,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
    });
    // 包装错误，添加更多上下文信息
    const wrappedError = new Error(`百炼API调用失败: ${error.message}`);
    wrappedError.originalError = error;
    wrappedError.statusCode = error.response?.status || 500;
    throw wrappedError;
  }
}

/**
 * 调用DeepSeek API进行AI分析
 * @param {string} prompt - 提示词
 * @returns {Promise<string>} AI响应内容
 */
async function callDeepSeekAPI(prompt) {
  try {
    // 检查API密钥
    if (!DEEPSEEK_API_KEY) {
      structuredLog('error', 'DeepSeek API密钥未设置');
      throw new Error('DeepSeek API密钥未设置');
    }

    // 尝试从多个可能的位置读取数据库结构文件
    const possiblePaths = [
      './docs/zcgl-database-structure.md',
      '../docs/zcgl-database-structure.md',
      '../../docs/zcgl-database-structure.md',
      './zcgl-database-structure.md',
    ];

    let dbStructureContent;
    let foundPath = null;

    try {
      // 尝试读取文件
      for (const path of possiblePaths) {
        try {
          dbStructureContent = fs.readFileSync(path, 'utf8');
          foundPath = path;
          structuredLog('info', '成功读取数据库结构文件', { filePath: path });
          break;
        } catch (e) {
          // 文件不存在，继续尝试下一个路径
          continue;
        }
      }

      // 如果所有路径都失败，使用默认结构
      if (!foundPath) {
        throw new Error('所有数据库结构文件路径都不存在');
      }
    } catch (error) {
      structuredLog('warn', '数据库结构文件不存在，使用默认结构描述', { error: error.message });
      // 使用默认的数据库结构描述
      dbStructureContent = `# 资产管理系统数据库结构

## 核心表结构

### 资产主表（assets）
- id: 资产ID，主键
- asset_code: 资产编号
- asset_name: 资产名称
- brand: 品牌
- model: 型号
- specification: 规格
- department: 所属科室
- department_new: 新所属科室
- status: 资产状态
- purchase_date: 购买日期
- purchase_price: 购买价格

### 科室表（departments）
- id: 科室ID，主键
- department_code: 科室编码
- department_name: 科室名称
- tenant_id: 租户ID

### 资产分类表（asset_categories）
- id: 分类ID，主键
- category_code: 分类编码
- category_name: 分类名称

### 资产变更日志表（asset_change_logs）
- id: 日志ID，主键
- asset_id: 资产ID
- change_type: 变更类型
- change_content: 变更内容
- created_at: 创建时间`;
    }

    // 只保留与资产分析相关的核心表结构
    const coreTables = [
      '资产主表（assets）',
      '科室表（departments）',
      '资产分类表（asset_categories）',
      '资产变更日志表（asset_change_logs）',
    ];

    // 解析并过滤数据库结构，只保留核心表
    const lines = dbStructureContent.split('\n');
    const filteredLines = [];
    let includeLine = false;

    for (const line of lines) {
      // 检查是否是表定义行
      const tableMatch = line.match(/^表\d+：(.*?)$/);
      if (tableMatch) {
        const tableName = tableMatch[1];
        includeLine = coreTables.some(coreTable => tableName.includes(coreTable));
      }

      // 如果包含当前行或者是标题行，添加到过滤后的内容中
      if (includeLine || line.startsWith('#') || line.startsWith('数据库名：')) {
        filteredLines.push(line);
      }

      // 如果是表定义行且不包含，则跳过该表的所有内容
      if (tableMatch && !includeLine) {
        continue;
      }
    }

    // 重新构建过滤后的数据库结构内容
    dbStructureContent = filteredLines.join('\n');

    structuredLog('info', '从MD文件读取并过滤数据库结构用于DeepSeek API', {
      filePath: foundPath || '默认结构',
      originalContentLength: filteredLines.length,
      filteredContentLength: dbStructureContent.length,
    });

    // 构建完整提示词，包含数据库结构和约束条件（与百炼相同格式）
    const fullPrompt = `
## 数据库结构信息
${dbStructureContent}

### 指令约束
0.不可以生成增加、删除和更新的数据库语句
1. 严格根据上述数据库结构生成SQL，禁止使用未定义的表/字段/关联关系；
2. 生成的SQL为标准[MySQL]语法，适配对应数据库版本，无需额外注释；
3. 处理时间/数值字段时保留原字段类型，无需类型转换，条件判断使用精准运算符；
4. 若用户需求涉及多表关联，必须使用显式JOIN（INNER JOIN/LEFT JOIN），禁止隐式连接；
5. 若用户需求模糊（如未指定时间范围），仅生成基础SQL框架，不随意补充条件；
6. 直接输出SQL语句，无其他多余文字（如“以下是生成的SQL”）；
7. 当需要查询科室资产时，科室的匹配使用LIKE而不使用=。

### 示例查询
1.查询某资产明细，以病理科为例：SELECT a.*
 FROM assets a
 INNER JOIN departments d ON a.department = d.department_name
 WHERE d.department_name LIKE '%病理科%';

2.查询资产总明细，以显微镜为例：SELECT
a.asset_name,
 a.asset_code,
 a.brand,
 a.model,
 a.department,
 a.use_department,
 a.location,
 a.status,
 a.purchase_date,
 a.purchase_price,
 a.current_value,
 a.depreciation_method,
 a.depreciation_years,
 a.warranty_period,
 a.warranty_end_date,
 a.created_at
 FROM assets a
 WHERE a.asset_name LIKE '%显微镜%'

## 用户问题
${prompt}
`;

    // 使用兼容OpenAI格式调用DeepSeek API
    const requestData = {
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
      top_p: 0.9,
    };

    // 设置请求头
    const headers = {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    };

    structuredLog('info', '调用DeepSeek API请求详情', {
      url: `${DEEPSEEK_API_URL}/v1/chat/completions`,
      model: requestData.model,
      maxTokens: requestData.max_tokens,
      promptLength: fullPrompt.length,
    });

    // 调用兼容OpenAI格式的API端点，添加30秒超时和重试机制
    const response = await withRetry(() =>
      axios.post(`${DEEPSEEK_API_URL}/v1/chat/completions`, requestData, {
        headers,
        timeout: 300000,
      }),
    );

    // 解析响应
    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content;
    } else {
      structuredLog('error', 'DeepSeek API响应格式不正确', {
        responseData: response.data,
      });
      throw new Error('DeepSeek API响应格式不正确');
    }
  } catch (error) {
    structuredLog('error', '调用DeepSeek API失败', {
      error: error.message,
      errorStack: error.stack,
      responseData: error.response?.data,
      status: error.response?.status,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
    });
    // 包装错误，添加更多上下文信息
    const wrappedError = new Error(`DeepSeek API调用失败: ${error.message}`);
    wrappedError.originalError = error;
    wrappedError.statusCode = error.response?.status || 500;
    throw wrappedError;
  }
}

/**
 * 调用Anthropic API进行AI分析
 * @param {string} prompt - 提示词
 * @returns {Promise<string>} AI响应内容
 */
async function callAnthropicAPI(prompt) {
  try {
    // 检查API密钥
    if (!ANTHROPIC_API_KEY) {
      structuredLog('error', 'Anthropic API密钥未设置');
      throw new Error('Anthropic API密钥未设置');
    }

    // 尝试从多个可能的位置读取数据库结构文件
    const possiblePaths = [
      './docs/zcgl-database-structure.md',
      '../docs/zcgl-database-structure.md',
      '../../docs/zcgl-database-structure.md',
      './zcgl-database-structure.md',
    ];

    let dbStructureContent;
    let foundPath = null;

    try {
      // 尝试读取文件
      for (const path of possiblePaths) {
        try {
          dbStructureContent = fs.readFileSync(path, 'utf8');
          foundPath = path;
          structuredLog('info', '成功读取数据库结构文件', { filePath: path });
          break;
        } catch (e) {
          // 文件不存在，继续尝试下一个路径
          continue;
        }
      }

      // 如果所有路径都失败，使用默认结构
      if (!foundPath) {
        throw new Error('所有数据库结构文件路径都不存在');
      }
    } catch (error) {
      structuredLog('warn', '数据库结构文件不存在，使用默认结构描述', { error: error.message });
      // 使用默认的数据库结构描述
      dbStructureContent = `# 资产管理系统数据库结构

## 核心表结构

### 资产主表（assets）
- id: 资产ID，主键
- asset_code: 资产编号
- asset_name: 资产名称
- brand: 品牌
- model: 型号
- specification: 规格
- department: 所属科室
- department_new: 新所属科室
- status: 资产状态
- purchase_date: 购买日期
- purchase_price: 购买价格

### 科室表（departments）
- id: 科室ID，主键
- department_code: 科室编码
- department_name: 科室名称
- tenant_id: 租户ID

### 资产分类表（asset_categories）
- id: 分类ID，主键
- category_code: 分类编码
- category_name: 分类名称

### 资产变更日志表（asset_change_logs）
- id: 日志ID，主键
- asset_id: 资产ID
- change_type: 变更类型
- change_content: 变更内容
- created_at: 创建时间`;
    }

    // 只保留与资产分析相关的核心表结构
    const coreTables = [
      '资产主表（assets）',
      '科室表（departments）',
      '资产分类表（asset_categories）',
      '资产变更日志表（asset_change_logs）',
    ];

    // 解析并过滤数据库结构，只保留核心表
    const lines = dbStructureContent.split('\n');
    const filteredLines = [];
    let includeLine = false;

    for (const line of lines) {
      // 检查是否是表定义行
      const tableMatch = line.match(/^表\d+：(.*?)$/);
      if (tableMatch) {
        const tableName = tableMatch[1];
        includeLine = coreTables.some(coreTable => tableName.includes(coreTable));
      }

      // 如果包含当前行或者是标题行，添加到过滤后的内容中
      if (includeLine || line.startsWith('#') || line.startsWith('数据库名：')) {
        filteredLines.push(line);
      }

      // 如果是表定义行且不包含，则跳过该表的所有内容
      if (tableMatch && !includeLine) {
        continue;
      }
    }

    // 重新构建过滤后的数据库结构内容
    dbStructureContent = filteredLines.join('\n');

    structuredLog('info', '从MD文件读取并过滤数据库结构用于Anthropic API', {
      filePath: foundPath || '默认结构',
      originalContentLength: filteredLines.length,
      filteredContentLength: dbStructureContent.length,
    });

    // 构建完整提示词，包含数据库结构和约束条件
    const fullPrompt = `
## 数据库结构信息
${dbStructureContent}

### 指令约束
0.不可以生成增加、删除和更新的数据库语句
1. 严格根据上述数据库结构生成SQL，禁止使用未定义的表/字段/关联关系；
2. 生成的SQL为标准[MySQL]语法，适配对应数据库版本，无需额外注释；
3. 处理时间/数值字段时保留原字段类型，无需类型转换，条件判断使用精准运算符；
4. 若用户需求涉及多表关联，必须使用显式JOIN（INNER JOIN/LEFT JOIN），禁止隐式连接；
5. 若用户需求模糊（如未指定时间范围），仅生成基础SQL框架，不随意补充条件；
6. 直接输出SQL语句，无其他多余文字（如"以下是生成的SQL"）；
7. 当需要查询科室资产时，科室的匹配使用LIKE而不使用=。

### 示例查询
1.查询某资产明细，以病理科为例：SELECT a.*
 FROM assets a
 INNER JOIN departments d ON a.department = d.department_name
 WHERE d.department_name LIKE '%病理科%';

2.查询资产总明细，以显微镜为例：SELECT
a.asset_name,
 a.asset_code,
 a.brand,
 a.model,
 a.department,
 a.use_department,
 a.location,
 a.status,
 a.purchase_date,
 a.purchase_price,
 a.current_value,
 a.depreciation_method,
 a.depreciation_years,
 a.warranty_period,
 a.warranty_end_date,
 a.created_at
 FROM assets a
 WHERE a.asset_name LIKE '%显微镜%'

## 用户问题
${prompt}
`;

    // 使用Anthropic API格式调用
    const requestData = {
      model: ANTHROPIC_MODEL,
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    };

    // 设置请求头
    const headers = {
      Authorization: `Bearer ${ANTHROPIC_API_KEY}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };

    structuredLog('info', '调用Anthropic API请求详情', {
      url: `${ANTHROPIC_API_URL}/v1/messages`,
      model: requestData.model,
      maxTokens: requestData.max_tokens,
      promptLength: fullPrompt.length,
    });

    // 调用Anthropic API端点，添加30秒超时和重试机制
    const response = await withRetry(() =>
      axios.post(`${ANTHROPIC_API_URL}/v1/messages`, requestData, {
        headers,
        timeout: 300000,
      }),
    );

    // 解析响应
    structuredLog('info', 'Anthropic API响应', {
      responseData: response.data,
      status: response.status,
      statusText: response.statusText,
    });

    if (
      response.data &&
      response.data.content &&
      Array.isArray(response.data.content) &&
      response.data.content.length > 0
    ) {
      // 找到text类型的内容
      const textContent = response.data.content.find(item => item.type === 'text');
      if (textContent && textContent.text) {
        return textContent.text;
      } else {
        structuredLog('error', 'Anthropic API响应中没有找到text类型的内容', {
          contentTypes: response.data.content.map(item => item.type),
        });
        throw new Error('Anthropic API响应中没有找到text类型的内容');
      }
    } else if (response.data && response.data.message) {
      // 可能是错误响应
      structuredLog('error', 'Anthropic API返回错误', {
        error: response.data.message,
        responseData: response.data,
      });
      throw new Error(`Anthropic API错误: ${response.data.message}`);
    } else {
      structuredLog('error', 'Anthropic API响应格式不正确', {
        responseData: response.data,
        status: response.status,
      });
      throw new Error('Anthropic API响应格式不正确');
    }
  } catch (error) {
    structuredLog('error', '调用Anthropic API失败', {
      error: error.message,
      errorStack: error.stack,
      responseData: error.response?.data,
      status: error.response?.status,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
    });
    // 包装错误，添加更多上下文信息
    const wrappedError = new Error(`Anthropic API调用失败: ${error.message}`);
    wrappedError.originalError = error;
    wrappedError.statusCode = error.response?.status || 500;
    throw wrappedError;
  }
}

/**
 * 获取数据库结构和约束条件 - 从MD文件读取完整的数据库结构描述
 * @returns {string} 格式化的数据库结构和约束条件
 */
async function getDatabaseStructureAndConstraints() {
  try {
    // 尝试从缓存获取
    const cachedStructure = await cacheService.get(DB_STRUCTURE_CACHE_KEY);
    if (cachedStructure) {
      structuredLog('info', '从缓存获取数据库结构', {
        cached: true,
      });
      return cachedStructure;
    }

    // 尝试从多个可能的位置读取数据库结构文件
    const possiblePaths = [
      './docs/zcgl-database-structure.md',
      '../docs/zcgl-database-structure.md',
      '../../docs/zcgl-database-structure.md',
      './zcgl-database-structure.md',
    ];

    let dbStructureContent;
    let foundPath = null;

    try {
      // 尝试读取文件
      for (const path of possiblePaths) {
        try {
          dbStructureContent = fs.readFileSync(path, 'utf8');
          foundPath = path;
          structuredLog('info', '成功读取数据库结构文件', { filePath: path });
          break;
        } catch (e) {
          // 文件不存在，继续尝试下一个路径
          continue;
        }
      }

      // 如果所有路径都失败，使用默认结构
      if (!foundPath) {
        throw new Error('所有数据库结构文件路径都不存在');
      }
    } catch (error) {
      structuredLog('warn', '数据库结构文件不存在，使用默认结构描述', { error: error.message });
      // 使用默认的数据库结构描述
      dbStructureContent = `# 资产管理系统数据库结构

## 核心表结构

### 资产主表（assets）
- id: 资产ID，主键
- asset_code: 资产编号
- asset_name: 资产名称
- brand: 品牌
- model: 型号
- specification: 规格
- department: 所属科室
- department_new: 新所属科室
- status: 资产状态
- purchase_date: 购买日期
- purchase_price: 购买价格

### 科室表（departments）
- id: 科室ID，主键
- department_code: 科室编码
- department_name: 科室名称
- tenant_id: 租户ID

### 资产分类表（asset_categories）
- id: 分类ID，主键
- category_code: 分类编码
- category_name: 分类名称

### 资产变更日志表（asset_change_logs）
- id: 日志ID，主键
- asset_id: 资产ID
- change_type: 变更类型
- change_content: 变更内容
- created_at: 创建时间`;
    }

    // 只保留与资产分析相关的核心表结构
    const coreTables = [
      '资产主表（assets）',
      '科室表（departments）',
      '资产分类表（asset_categories）',
      '资产变更日志表（asset_change_logs）',
    ];

    // 解析并过滤数据库结构，只保留核心表
    const lines = dbStructureContent.split('\n');
    const filteredLines = [];
    let includeLine = false;

    for (const line of lines) {
      // 检查是否是表定义行
      const tableMatch = line.match(/^表\d+：(.*?)$/);
      if (tableMatch) {
        const tableName = tableMatch[1];
        includeLine = coreTables.some(coreTable => tableName.includes(coreTable));
      }

      // 如果包含当前行或者是标题行，添加到过滤后的内容中
      if (includeLine || line.startsWith('#') || line.startsWith('数据库名：')) {
        filteredLines.push(line);
      }

      // 如果是表定义行且不包含，则跳过该表的所有内容
      if (tableMatch && !includeLine) {
        continue;
      }
    }

    // 重新构建过滤后的数据库结构内容
    dbStructureContent = filteredLines.join('\n');

    structuredLog('info', '从MD文件读取并过滤数据库结构', {
      filePath: foundPath || '默认结构',
      originalLineCount: lines.length,
      filteredLineCount: filteredLines.length,
      filteredContentLength: dbStructureContent.length,
    });

    // 构建约束条件
    const constraints = `
## 指令约束
0.不可以生成增加、删除和更新的数据库语句
1. 严格根据上述数据库结构生成SQL，禁止使用未定义的表/字段/关联关系；
2. 生成的SQL为标准[MySQL]语法，适配对应数据库版本，无需额外注释；
3. 处理时间/数值字段时保留原字段类型，无需类型转换，条件判断使用精准运算符；
4. 若用户需求涉及多表关联，必须使用显式JOIN（INNER JOIN/LEFT JOIN），禁止隐式连接；
5. 若用户需求模糊（如未指定时间范围），仅生成基础SQL框架，不随意补充条件；
6. 直接输出SQL语句，无其他多余文字（如"以下是生成的SQL"）；
7. 当需要查询科室资产时，科室的匹配使用LIKE而不使用=。

### 示例查询
1.查询某资产明细，以病理科为例：SELECT a.*
 FROM assets a
 INNER JOIN departments d ON a.department = d.department_name
 WHERE d.department_name LIKE '%病理科%';

2.查询资产总明细，以显微镜为例：SELECT
a.asset_name,
 a.asset_code,
 a.brand,
 a.model,
 a.department,
 a.use_department,
 a.location,
 a.status,
 a.purchase_date,
 a.purchase_price,
 a.current_value,
 a.depreciation_method,
 a.depreciation_years,
 a.warranty_period,
 a.warranty_end_date,
 a.created_at
 FROM assets a
 WHERE a.asset_name LIKE '%显微镜%'
    `.trim();

    const result = {
      dbStructure: dbStructureContent,
      constraints,
    };

    // 缓存结果
    await cacheService.set(DB_STRUCTURE_CACHE_KEY, result, CACHE_TTL);
    structuredLog('info', '数据库结构已缓存', {
      ttl: CACHE_TTL,
    });

    return result;
  } catch (error) {
    structuredLog('error', '获取数据库结构和约束条件失败', {
      error: error.message,
      stack: error.stack,
    });
    return null;
  }
}

/**
 * 调用LM Studio API进行AI分析，支持发送数据库结构和约束条件
 * @param {string} prompt - 提示词
 * @param {boolean} includeDbStructure - 是否包含数据库结构和约束条件
 * @returns {Promise<string>} AI响应内容
 */
async function callLMStudioAPI(prompt, includeDbStructure = false) {
  try {
    let fullPrompt = prompt;

    // 如果需要包含数据库结构和约束条件
    if (includeDbStructure) {
      const dbInfo = await getDatabaseStructureAndConstraints();
      if (dbInfo) {
        fullPrompt = `
## 数据库结构信息（仅核心表定义）
${dbInfo.dbStructure}

${dbInfo.constraints}

## 用户问题
${prompt}
        `.trim();
        structuredLog('info', '为LM Studio API构建完整提示词', {
          originalPromptLength: prompt.length,
          fullPromptLength: fullPrompt.length,
          includeDbStructure: true,
        });
      } else {
        structuredLog('warn', '无法获取数据库结构和约束条件，将使用原始提示词', {
          originalPromptLength: prompt.length,
        });
      }
    }

    // 使用OpenAI兼容格式调用LM Studio API
    const requestData = {
      model: LM_STUDIO_MODEL,
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
      max_tokens: 4000,
      temperature: 0.7,
    };

    // 设置请求头
    const headers = {
      'Content-Type': 'application/json',
    };

    // 调用LM Studio API端点，添加30秒超时和重试机制
    const response = await withRetry(() =>
      axios.post(`${LM_STUDIO_API_URL}/v1/chat/completions`, requestData, {
        headers,
        timeout: 300000,
      }),
    );

    // 解析响应
    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content;
    } else {
      structuredLog('error', 'LM Studio API响应格式不正确', {
        responseData: response.data,
      });
      throw new Error('LM Studio API响应格式不正确');
    }
  } catch (error) {
    structuredLog('error', '调用LM Studio API失败', {
      error: error.message,
      errorStack: error.stack,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
    });
    // 包装错误，添加更多上下文信息
    const wrappedError = new Error(`LM Studio API调用失败: ${error.message}`);
    wrappedError.originalError = error;
    wrappedError.statusCode = error.response?.status || 500;
    throw wrappedError;
  }
}

/**
 * 从AI响应中提取SQL语句
 * @param {string} aiResponse - AI响应内容
 * @returns {string|null} 提取到的SQL语句，失败返回null
 */
function extractSQLFromAIResponse(aiResponse) {
  try {
    // 输入验证
    if (!aiResponse || typeof aiResponse !== 'string') {
      structuredLog('warn', '无效的AI响应输入', {
        inputType: typeof aiResponse,
        inputLength: aiResponse ? aiResponse.length : 0,
      });
      return null;
    }

    // 使用正则表达式提取SQL语句
    // 匹配常见的SQL语句模式，支持多行
    const sqlPatterns = [
      // 匹配以SELECT开头的SQL语句
      /(?<!\w)(SELECT)\s+[\s\S]*?(?=;|$)/gi,
      // 匹配被```sql或```包裹的SQL语句
      /```(?:sql)?\s*((?:SELECT|SELECT).*?)\s*```/g,
    ];

    let extractedSQL = null;

    // 尝试不同的正则表达式模式
    for (const pattern of sqlPatterns) {
      const matches = aiResponse.match(pattern);
      if (matches && matches.length > 0) {
        extractedSQL = matches[0];
        break;
      }
    }

    if (!extractedSQL) {
      structuredLog('info', '未从AI响应中提取到SQL语句', {
        responseLength: aiResponse.length,
      });
      return null;
    }

    // 清理SQL语句，移除多余的格式标记
    let cleanedSQL = extractedSQL;

    // 移除```sql和```标记
    cleanedSQL = cleanedSQL.replace(/```(?:sql)?\s*|\s*```/g, '');

    // 移除行首行尾的空白字符
    cleanedSQL = cleanedSQL.trim();

    // 确保只提取第一个SQL语句，避免多语句执行问题
    // 找到第一个分号的位置
    const firstSemicolonIndex = cleanedSQL.indexOf(';');
    if (firstSemicolonIndex !== -1) {
      // 只保留第一个语句
      cleanedSQL = cleanedSQL.substring(0, firstSemicolonIndex + 1);
      structuredLog('info', '检测到多个SQL语句，只保留第一个语句', {
        originalLength: cleanedSQL.length,
      });
    } else {
      // 确保SQL语句以分号结尾
      cleanedSQL += ';';
    }

    // 进一步清理，确保只包含单个SELECT语句（禁止修改操作）
    const sqlLower = cleanedSQL.toLowerCase();
    if (!sqlLower.startsWith('select')) {
      structuredLog('warn', '检测到非SELECT语句，将被忽略', {
        sql: cleanedSQL.slice(0, 50) + (cleanedSQL.length > 50 ? '...' : ''),
      });
      return null;
    }

    // 安全检查：确保SQL语句中不包含危险操作
    const dangerousPatterns = [
      /DROP\s+TABLE/i,
      /DROP\s+DATABASE/i,
      /TRUNCATE\s+TABLE/i,
      /DELETE\s+FROM/i,
      /UPDATE\s+.*SET/i,
      /INSERT\s+INTO/i,
      /ALTER\s+TABLE/i,
      /CREATE\s+TABLE/i,
      /EXEC\s+/i,
      /CALL\s+/i,
      /xp_/i,
      /sp_/i,
      /;\s*--/i,
      /;\s*#/i,
      /OR\s+1=1/i,
      /UNION\s+SELECT/i,
      /BENCHMARK\s*\(/i,
      /SLEEP\s*\(/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(cleanedSQL)) {
        structuredLog('warn', '检测到危险SQL操作，将被忽略', {
          pattern: pattern.source,
          sql: cleanedSQL.slice(0, 50) + (cleanedSQL.length > 50 ? '...' : ''),
        });
        return null;
      }
    }

    structuredLog('info', '成功从AI响应中提取并清理SQL语句', {
      originalLength: extractedSQL.length,
      cleanedLength: cleanedSQL.length,
      cleanedSQL: cleanedSQL.slice(0, 100) + (cleanedSQL.length > 100 ? '...' : ''),
    });

    return cleanedSQL;
  } catch (error) {
    structuredLog('error', '从AI响应中提取SQL语句失败', {
      error: error.message,
      stack: error.stack,
    });
    return null;
  }
}

/**
 * 执行SQL查询并返回结果
 * @param {string} sql - 要执行的SQL语句
 * @returns {Promise<Object>} 包含执行结果的对象
 */
async function executeSQLQuery(sql) {
  try {
    structuredLog('info', '准备执行SQL查询', {
      sql: sql.slice(0, 100) + (sql.length > 100 ? '...' : ''),
    });

    // 执行SQL查询
    const [results] = await db.execute(sql);

    structuredLog('info', 'SQL查询执行成功', {
      sql: sql.slice(0, 100) + (sql.length > 100 ? '...' : ''),
      resultCount: Array.isArray(results) ? results.length : 1,
    });

    return {
      success: true,
      sql,
      results,
      resultCount: Array.isArray(results) ? results.length : 1,
    };
  } catch (error) {
    structuredLog('error', 'SQL查询执行失败', {
      sql: sql.slice(0, 100) + (sql.length > 100 ? '...' : ''),
      error: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      sql,
      error: error.message,
      results: null,
    };
  }
}

/**
 * 通过 SQLBot Open API 对话接口进行问答
 */
async function callSqlBotAnalysisAPI(prompt, options = {}) {
  const startTime = Date.now();
  const { chatId = null, datasourceId = null } = options || {};
  const tenantId = normalizePositiveInt(options?.tenantId);

  structuredLog('info', '开始调用SQLBot对话接口', {
    promptLength: prompt.length,
    chatId: chatId || null,
    datasourceId: datasourceId || null,
    apiBaseUrl: SQLBOT_OPEN_API_BASE_URL,
    apiPrefix: SQLBOT_OPEN_API_PREFIX,
  });

  try {
    const openApiResult = await askViaSqlBotOpenAPI(prompt, {
      chatId,
      datasourceId,
    });

    const answer = openApiResult.answer || {};
    const aiResponse = extractOpenAnswerText(answer);
    const sqlFromAnswer = typeof answer.sql === 'string' ? answer.sql.trim() : '';
    const extractedSQL = sqlFromAnswer || extractSQLFromAIResponse(aiResponse);
    const sqlExecution = normalizeOpenSqlExecution(answer, extractedSQL);

    const result = {
      aiResponse,
      sql: extractedSQL || null,
      sqlExecution,
      resultAnalysis: aiResponse,
      aiSource: 'sqlbot-open-api',
      resultAnalysisSource: 'sqlbot-open-api',
      chatId: openApiResult.chatId,
      datasourceId: openApiResult.datasourceId,
      rawAnswer: answer,
      recordId: answer.record_id || null,
      chart: answer.chart || null,
    };
    if (result.sql) {
      assertTenantScopedSql(result.sql, tenantId);
    }

    structuredLog('info', 'SQLBot对话接口调用成功', {
      duration: Date.now() - startTime,
      chatId: result.chatId,
      datasourceId: result.datasourceId,
      hasSQL: !!result.sql,
      hasExecution: !!result.sqlExecution,
    });

    return result;
  } catch (error) {
    const formattedError = formatSqlBotOpenApiError(error);
    structuredLog('error', 'SQLBot对话接口调用失败', {
      duration: Date.now() - startTime,
      error: formattedError,
      status: error.response?.status,
      response: error.response?.data,
    });
    throw new Error(`AI分析失败: ${formattedError}`);
  }
}

async function callOllamaAnalysisAPI(prompt, options = {}) {
  const startTime = Date.now();
  const tenantId = normalizePositiveInt(options?.tenantId);
  const dbInfo = await getDatabaseStructureAndConstraints();
  const sourceLabel = buildOllamaSourceLabel();

  structuredLog('info', '开始调用本地Ollama分析', {
    promptLength: prompt.length,
    tenantId,
    model: OLLAMA_MODEL,
    apiUrl: OLLAMA_API_URL,
  });

  const sqlDraft = await callOllamaChat(buildOllamaSqlMessages(prompt, tenantId, dbInfo), {
    temperature: 0.1,
    maxTokens: 1600,
  });

  const extractedSQL = extractSQLFromAIResponse(sqlDraft);
  if (!extractedSQL) {
    const directAnswer = trimDirectAnswerPrefix(sqlDraft) || sqlDraft;

    structuredLog('info', '本地Ollama直接返回分析，无需执行SQL', {
      duration: Date.now() - startTime,
      tenantId,
    });

    return {
      aiResponse: directAnswer,
      sql: null,
      sqlExecution: null,
      resultAnalysis: directAnswer,
      aiSource: sourceLabel,
      resultAnalysisSource: sourceLabel,
      chatId: null,
      datasourceId: null,
      rawAnswer: {
        content: sqlDraft,
      },
      recordId: null,
      chart: null,
    };
  }

  const normalizedSQL = ensureSqlHasLimit(extractedSQL, DEFAULT_SQL_RESULT_LIMIT);
  assertTenantScopedSql(normalizedSQL, tenantId);

  const sqlExecution = await executeSQLQuery(normalizedSQL);
  if (!sqlExecution.success) {
    const executionFailureSummary = `已生成SQL，但执行失败：${sqlExecution.error || '未知错误'}`;
    return {
      aiResponse: executionFailureSummary,
      sql: normalizedSQL,
      sqlExecution,
      resultAnalysis: executionFailureSummary,
      aiSource: sourceLabel,
      resultAnalysisSource: sourceLabel,
      chatId: null,
      datasourceId: null,
      rawAnswer: {
        sqlDraft,
      },
      recordId: null,
      chart: null,
    };
  }

  let resultAnalysis;
  try {
    resultAnalysis = await callOllamaChat(buildOllamaResultAnalysisMessages(prompt, sqlExecution), {
      temperature: 0.2,
      maxTokens: 1800,
    });
  } catch (error) {
    structuredLog('warn', '本地Ollama结果分析失败，回退到默认摘要', {
      error: error.message,
      tenantId,
    });
    resultAnalysis =
      sqlExecution.resultCount > 0
        ? `查询完成，共返回 ${sqlExecution.resultCount} 条记录。请结合上方 SQL 结果进一步查看明细。`
        : '查询完成，但未检索到符合条件的数据。';
  }

  structuredLog('info', '本地Ollama分析完成', {
    duration: Date.now() - startTime,
    tenantId,
    hasSQL: true,
    resultCount: sqlExecution.resultCount || 0,
  });

  return {
    aiResponse: resultAnalysis,
    sql: normalizedSQL,
    sqlExecution,
    resultAnalysis,
    aiSource: sourceLabel,
    resultAnalysisSource: sourceLabel,
    chatId: null,
    datasourceId: null,
    rawAnswer: {
      sqlDraft,
      resultAnalysis,
    },
    recordId: null,
    chart: null,
  };
}

/**
 * AI分析统一入口
 * @param {string} prompt - 提问内容
 * @param {string} modelService - 模型服务名称
 * @param {object} options - 对话参数
 * @returns {Promise<Object>} 包含AI响应和问答上下文的对象
 */
async function callAIAnalysisAPI(prompt, modelService = DEFAULT_ANALYSIS_PROVIDER, options = {}) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('提示词不能为空且必须是字符串');
  }

  const provider = normalizeAnalysisProvider(modelService);
  const scopedOptions = {
    ...(options || {}),
    tenantId: normalizePositiveInt(options?.tenantId),
  };
  structuredLog('info', '开始调用AI分析入口', {
    provider,
    promptLength: prompt.length,
    tenantId: scopedOptions.tenantId,
  });

  if (provider === 'sqlbot-open-api') {
    return callSqlBotAnalysisAPI(prompt, scopedOptions);
  }

  return callOllamaAnalysisAPI(prompt, scopedOptions);
}

/**
 * 获取分析维度列表
 * @returns {Promise<Array>} 分析维度列表
 */
async function getDimensions() {
  return [
    {
      key: 'overview',
      label: '资产概览',
      description: '提供资产的基本信息和关键指标概述',
    },
    {
      key: 'value',
      label: '价值评估',
      description: '分析资产的当前价值和潜在价值变化',
    },
    {
      key: 'utilization',
      label: '使用效率',
      description: '评估资产的使用频率和效率',
    },
    {
      key: 'maintenance',
      label: '维护分析',
      description: '分析资产的维护历史和维护需求',
    },
    {
      key: 'lifecycle',
      label: '生命周期分析',
      description: '评估资产的剩余使用寿命和更换建议',
    },
    {
      key: 'risk',
      label: '风险评估',
      description: '识别资产可能面临的风险和隐患',
    },
    {
      key: 'optimization',
      label: '优化建议',
      description: '提供资产管理优化建议',
    },
    {
      key: 'custom',
      label: '自定义分析',
      description: '根据用户输入的提示词进行个性化分析',
    },
  ];
}

/**
 * 分析单个资产
 * @param {number} assetId - 资产ID
 * @param {Object} data - 分析参数
 * @param {number} userId - 用户ID
 * @param {number|null} tenantId - 租户ID
 * @returns {Promise<Object>} 分析结果
 */
async function analyzeAsset(assetId, data, userId, tenantId = null) {
  try {
    // 参数验证
    if (!assetId) {
      throw new Error('无效的资产标识');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('分析参数不能为空且必须是对象');
    }
    if (!data.dimension) {
      throw new Error('分析维度不能为空');
    }
    if (
      data.dimension === 'custom' &&
      (!data.customPrompt || typeof data.customPrompt !== 'string')
    ) {
      throw new Error('自定义分析时，customPrompt不能为空且必须是字符串');
    }
    if (userId && (typeof userId !== 'number' || isNaN(userId) || userId <= 0)) {
      throw new Error('无效的用户ID');
    }
    const scopedTenantId = requireTenantIdForAnalysis(tenantId);

    // 检查assetId是否为数字，决定使用id还是asset_code查询
    const isNumeric = /^\d+$/.test(assetId);
    const queryField = isNumeric ? 'id' : 'asset_code';
    const queryValue = isNumeric ? parseInt(assetId, 10) : assetId;

    // 获取资产信息
    let assetSql = `SELECT * FROM assets WHERE ${queryField} = ?`;
    const assetParams = [queryValue];
    assetSql += ' AND tenant_id = ?';
    assetParams.push(scopedTenantId);
    assetSql += ' LIMIT 1';

    const [asset] = await db.execute(assetSql, assetParams);
    if (!asset || asset.length === 0) {
      throw new Error('资产不存在');
    }

    const assetInfo = asset[0];
    const { dimension, customPrompt, modelService } = data;
    let prompt;

    // 构建不同维度的提示词
    switch (dimension) {
      case 'overview':
        prompt = `请为以下资产提供一个简洁的概览：\n${JSON.stringify(assetInfo, null, 2)}`;
        break;
      case 'value':
        prompt = `请分析以下资产的价值情况，包括当前价值、潜在价值变化等：\n${JSON.stringify(assetInfo, null, 2)}`;
        break;
      case 'utilization':
        prompt = `请评估以下资产的使用效率和频率：\n${JSON.stringify(assetInfo, null, 2)}`;
        break;
      case 'maintenance':
        prompt = `请分析以下资产的维护历史和维护需求：\n${JSON.stringify(assetInfo, null, 2)}`;
        break;
      case 'lifecycle':
        prompt = `请评估以下资产的生命周期，包括剩余使用寿命和更换建议：\n${JSON.stringify(assetInfo, null, 2)}`;
        break;
      case 'risk':
        prompt = `请识别以下资产可能面临的风险和隐患：\n${JSON.stringify(assetInfo, null, 2)}`;
        break;
      case 'optimization':
        prompt = `请为以下资产提供管理优化建议：\n${JSON.stringify(assetInfo, null, 2)}`;
        break;
      case 'custom':
        prompt = `请基于以下资产信息和用户提示进行分析：\n资产信息：\n${JSON.stringify(assetInfo, null, 2)}\n\n用户提示：${customPrompt}`;
        break;
      default:
        prompt = `请分析以下资产：\n${JSON.stringify(assetInfo, null, 2)}`;
    }

    // 调用AI API，支持选择模型服务
    const aiResult = await callAIAnalysisAPI(prompt, modelService, {
      datasourceId: data.datasourceId || data.datasource_id,
      tenantId: scopedTenantId,
    });

    // 保存分析日志（保存完整的AI分析结果）
    await saveAnalysisLog(assetInfo.id || null, dimension, prompt, aiResult, userId, scopedTenantId);

    // 返回包含AI响应、SQL执行结果和结果分析的完整分析结果
    return {
      success: true,
      data: {
        analysis: aiResult.aiResponse,
        sql: aiResult.sql,
        sqlExecution: aiResult.sqlExecution,
        resultAnalysis: aiResult.resultAnalysis,
        aiSource: aiResult.aiSource,
        resultAnalysisSource: aiResult.resultAnalysisSource,
      },
    };
  } catch (error) {
    console.error('分析单个资产失败:', error.message);
    return { success: false, message: error.message };
  }
}

/**
 * 批量分析资产
 * @param {Object} data - 分析参数
 * @param {number} userId - 用户ID
 * @returns {Promise<Object>} 分析结果
 */
async function analyzeAssets(data, userId, tenantId = null) {
  try {
    // 参数验证
    if (!data || typeof data !== 'object') {
      throw new Error('分析参数不能为空且必须是对象');
    }
    if (!data.assetIds || !Array.isArray(data.assetIds) || data.assetIds.length === 0) {
      throw new Error('资产ID列表不能为空且必须是数组');
    }
    if (!data.dimension) {
      throw new Error('分析维度不能为空');
    }
    if (
      data.dimension === 'custom' &&
      (!data.customPrompt || typeof data.customPrompt !== 'string')
    ) {
      throw new Error('自定义分析时，customPrompt不能为空且必须是字符串');
    }
    if (userId && (typeof userId !== 'number' || isNaN(userId) || userId <= 0)) {
      throw new Error('无效的用户ID');
    }
    const scopedTenantId = requireTenantIdForAnalysis(tenantId);

    const { assetIds, dimension, customPrompt } = data;

    // 获取资产信息
    const placeholders = assetIds.map(() => '?').join(',');

    // 检查assetIds中的值是否全为数字，决定使用id还是asset_code查询
    const areAllNumeric = assetIds.every(id => /^\d+$/.test(id));
    const queryField = areAllNumeric ? 'id' : 'asset_code';
    const queryValues = areAllNumeric ? assetIds.map(id => parseInt(id, 10)) : assetIds;
    let assetSql = `SELECT * FROM assets WHERE ${queryField} IN (${placeholders})`;
    const assetParams = [...queryValues];
    assetSql += ' AND tenant_id = ?';
    assetParams.push(scopedTenantId);

    const [assets] = await db.execute(assetSql, assetParams);

    if (!assets || assets.length === 0) {
      throw new Error('没有找到对应资产');
    }

    let prompt;

    // 构建不同维度的提示词
    switch (dimension) {
      case 'overview':
        prompt = `请为以下${assets.length}个资产提供一个综合概览，包括它们的共同特点和差异：\n${JSON.stringify(assets, null, 2)}`;
        break;
      case 'value':
        prompt = `请分析以下${assets.length}个资产的价值情况，包括整体价值趋势和各资产价值对比：\n${JSON.stringify(assets, null, 2)}`;
        break;
      case 'utilization':
        prompt = `请评估以下${assets.length}个资产的整体使用效率情况：\n${JSON.stringify(assets, null, 2)}`;
        break;
      case 'maintenance':
        prompt = `请分析以下${assets.length}个资产的维护需求和建议：\n${JSON.stringify(assets, null, 2)}`;
        break;
      case 'lifecycle':
        prompt = `请评估以下${assets.length}个资产的生命周期情况：\n${JSON.stringify(assets, null, 2)}`;
        break;
      case 'risk':
        prompt = `请识别以下${assets.length}个资产可能面临的共同风险和隐患：\n${JSON.stringify(assets, null, 2)}`;
        break;
      case 'optimization':
        prompt = `请为以下${assets.length}个资产提供综合管理优化建议：\n${JSON.stringify(assets, null, 2)}`;
        break;
      case 'custom':
        prompt = `请基于以下${assets.length}个资产信息和用户提示进行分析：\n资产信息：\n${JSON.stringify(assets, null, 2)}\n\n用户提示：${customPrompt}`;
        break;
      default:
        prompt = `请分析以下${assets.length}个资产：\n${JSON.stringify(assets, null, 2)}`;
    }

    // 调用AI API，支持选择模型服务
    const aiResult = await callAIAnalysisAPI(prompt, data.modelService, {
      datasourceId: data.datasourceId || data.datasource_id,
      tenantId: scopedTenantId,
    });

    // 保存分析日志（保存完整AI分析结果）
    // 批量分析时，使用第一个资产ID关联日志
    // 如果没有资产ID（自定义分析），则保存为null
    await saveAnalysisLog(assets[0]?.id || null, dimension, prompt, aiResult, userId, scopedTenantId);

    // 返回包含AI响应、SQL执行结果、结果分析和AI来源的完整分析结果
    return {
      success: true,
      data: {
        analysis: aiResult.aiResponse,
        sql: aiResult.sql,
        sqlExecution: aiResult.sqlExecution,
        resultAnalysis: aiResult.resultAnalysis,
        aiSource: aiResult.aiSource,
        resultAnalysisSource: aiResult.resultAnalysisSource,
      },
    };
  } catch (error) {
    console.error('批量分析资产失败:', error.message);
    return { success: false, message: error.message };
  }
}

/**
 * 自定义AI分析
 * @param {Object} data - 分析参数
 * @param {number} userId - 用户ID
 * @param {number|null} tenantId - 租户ID
 * @returns {Promise<Object>} 分析结果
 */
async function customAnalysis(data, userId, tenantId = null) {
  try {
    // 参数验证
    if (!data || typeof data !== 'object') {
      throw new Error('分析参数不能为空且必须是对象');
    }
    if (!data.prompt || typeof data.prompt !== 'string') {
      throw new Error('提示词不能为空且必须是字符串');
    }
    if (data.prompt.trim() === '') {
      throw new Error('提示词不能为空字符串');
    }
    if (userId && (typeof userId !== 'number' || isNaN(userId) || userId <= 0)) {
      throw new Error('无效的用户ID');
    }
    const scopedTenantId = requireTenantIdForAnalysis(tenantId);

    const { prompt, assetIds, modelService, datasourceId, datasource_id } = data;
    let finalPrompt = prompt;
    let linkedAssetId = null;

    // 如果提供了assetIds，获取对应的资产信息并添加到提示词中
    if (assetIds && Array.isArray(assetIds) && assetIds.length > 0) {
      // 从数据库获取资产信息
      try {
        // 检查assetIds中的值是否全为数字，决定使用id还是asset_code查询
        const areAllNumeric = assetIds.every(id => /^\d+$/.test(id));
        const queryField = areAllNumeric ? 'id' : 'asset_code';
        const queryValues = areAllNumeric ? assetIds.map(id => parseInt(id, 10)) : assetIds;

        const placeholders = assetIds.map(() => '?').join(',');
        let assetQuery = `SELECT * FROM assets WHERE ${queryField} IN (${placeholders})`;
        const assetParams = [...queryValues];
        assetQuery += ' AND tenant_id = ?';
        assetParams.push(scopedTenantId);

        const [assets] = await db.execute(assetQuery, assetParams);

        if (assets && assets.length > 0) {
          linkedAssetId = assets[0]?.id || null;
          finalPrompt = `请基于以下${assets.length}个资产信息和用户提示进行分析：\n资产信息：\n${JSON.stringify(assets, null, 2)}\n\n用户提示：${prompt}`;
        }
      } catch (error) {
        console.error('获取资产信息失败:', error.message);
        // 数据库连接失败时，忽略资产信息，直接使用用户提示
      }
    }

    // 调用AI API，支持选择模型服务
    const aiResult = await callAIAnalysisAPI(finalPrompt, modelService, {
      datasourceId: datasourceId || datasource_id,
      tenantId: scopedTenantId,
    });

    // 保存分析日志（保存完整AI分析结果）
    await saveAnalysisLog(linkedAssetId, 'custom', finalPrompt, aiResult, userId, scopedTenantId);

    // 返回包含AI响应、SQL执行结果、结果分析和AI来源的完整分析结果
    return {
      success: true,
      data: {
        analysis: aiResult.aiResponse,
        message: aiResult.aiResponse,
        answer: aiResult.rawAnswer,
        sql: aiResult.sql,
        sqlExecution: aiResult.sqlExecution,
        resultAnalysis: aiResult.resultAnalysis,
        aiSource: aiResult.aiSource,
        resultAnalysisSource: aiResult.resultAnalysisSource,
        chatId: aiResult.chatId,
        datasourceId: aiResult.datasourceId,
        recordId: aiResult.recordId,
        chart: aiResult.chart,
      },
    };
  } catch (error) {
    console.error('自定义AI分析失败:', error.message);
    return { success: false, message: error.message };
  }
}

/**
 * 获取分析历史
 * @param {Object} params - 查询参数
 * @param {Object} req - Express请求对象，用于获取租户信息
 * @returns {Promise<Object>} 分析历史列表
 */
async function getAnalysisHistory(params, req = null) {
  try {
    // 确保分页参数是数字类型
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 10;
    const { dimension } = params;
    const assetId = params.assetId ? parseInt(params.assetId) : null;
    const userId = params.userId ? parseInt(params.userId) : null;

    // 构建查询条件
    const conditions = [];
    const values = [];

    if (dimension) {
      conditions.push('aal.dimension = ?');
      values.push(dimension);
    }

    if (assetId) {
      conditions.push('aal.asset_id = ?');
      values.push(assetId);
    }

    if (userId) {
      conditions.push('aal.user_id = ?');
      values.push(userId);
    }

    // 检查表是否有tenant_id字段，如果有则添加租户过滤
    const [columns] = await db.execute("SHOW COLUMNS FROM asset_ai_analysis_logs LIKE 'tenant_id'");
    const hasTenantId = columns.length > 0;

    if (hasTenantId && req) {
      const { addTenantFilter } = require('../middleware/tenant-filter');
      const tenantFilter = addTenantFilter(req, 'aal');

      if (tenantFilter.whereClause) {
        conditions.push(tenantFilter.whereClause.replace(' AND ', ''));
        values.push(...tenantFilter.params);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 查询总记录数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM asset_ai_analysis_logs aal ${whereClause}`,
      values,
    );
    const { total } = countResult[0];

    // 计算分页
    const offset = (page - 1) * pageSize;

    // 查询分析历史
    const [logs] = await db.execute(
      `SELECT * FROM asset_ai_analysis_logs aal ${whereClause} ORDER BY aal.created_at DESC LIMIT ? OFFSET ?`,
      [...values, pageSize, offset],
    );

    return { success: true, data: { logs, total, page, pageSize } };
  } catch (error) {
    console.error('获取分析历史失败:', error.message);
    return { success: false, message: error.message };
  }
}

/**
 * 保存分析日志
 * @param {number|null} assetId - 资产ID
 * @param {string} dimension - 分析维度
 * @param {string} prompt - 提示词
 * @param {object} aiResult - 完整的AI分析结果对象
 * @param {number} userId - 用户ID
 * @param {number|null} tenantId - 租户ID
 * @param {string} aiSource - AI来源
 * @returns {Promise<void>}
 */
async function saveAnalysisLog(assetId, dimension, prompt, fullAiResult, userId, tenantId = null) {
  try {
    // 参数验证
    if (!fullAiResult || typeof fullAiResult !== 'object') {
      console.error('保存分析日志失败: 无效的AI结果对象');
      return;
    }

    if (!prompt || typeof prompt !== 'string') {
      console.error('保存分析日志失败: 无效的提示词');
      return;
    }

    // 确保aiResponse至少是字符串类型，特别处理字符数组和对象类型
    let aiResponse;
    if (typeof fullAiResult.aiResponse === 'string') {
      aiResponse = fullAiResult.aiResponse;
    } else if (Array.isArray(fullAiResult.aiResponse)) {
      // 如果是字符数组，拼接成字符串
      aiResponse = fullAiResult.aiResponse.join('');
    } else if (typeof fullAiResult.aiResponse === 'object' && fullAiResult.aiResponse !== null) {
      // 如果是对象，尝试提取字符串内容
      if (fullAiResult.aiResponse.content && typeof fullAiResult.aiResponse.content === 'string') {
        aiResponse = fullAiResult.aiResponse.content;
      } else if (fullAiResult.aiResponse.text && typeof fullAiResult.aiResponse.text === 'string') {
        aiResponse = fullAiResult.aiResponse.text;
      } else {
        // 否则尝试JSON序列化
        try {
          aiResponse = JSON.stringify(fullAiResult.aiResponse);
        } catch (error) {
          aiResponse = String(fullAiResult.aiResponse || '');
        }
      }
    } else {
      aiResponse = String(fullAiResult.aiResponse || '');
    }

    // 处理SQL和执行结果
    const sql = typeof fullAiResult.sql === 'string' ? fullAiResult.sql : null;
    const sqlExecutionJson = null; // 不再保存SQL执行结果，避免字段长度不足问题

    // 不再序列化sqlExecution，直接设置为null
    // if (fullAiResult.sqlExecution) {
    //   try {
    //     sqlExecutionJson = JSON.stringify(fullAiResult.sqlExecution);
    //   } catch (jsonError) {
    //     console.error('保存分析日志失败: SQL执行结果JSON序列化失败:', jsonError.message);
    //     sqlExecutionJson = JSON.stringify({ error: 'SQL执行结果序列化失败' });
    //   }
    // }

    // 处理结果分析，确保正确保存第二次AI分析结果
    let resultAnalysis;
    if (typeof fullAiResult.resultAnalysis === 'string') {
      resultAnalysis = fullAiResult.resultAnalysis;
    } else if (Array.isArray(fullAiResult.resultAnalysis)) {
      // 如果是字符数组，拼接成字符串
      resultAnalysis = fullAiResult.resultAnalysis.join('');
    } else if (
      typeof fullAiResult.resultAnalysis === 'object' &&
      fullAiResult.resultAnalysis !== null
    ) {
      // 如果是对象，尝试提取字符串内容
      if (
        fullAiResult.resultAnalysis.content &&
        typeof fullAiResult.resultAnalysis.content === 'string'
      ) {
        resultAnalysis = fullAiResult.resultAnalysis.content;
      } else if (
        fullAiResult.resultAnalysis.text &&
        typeof fullAiResult.resultAnalysis.text === 'string'
      ) {
        resultAnalysis = fullAiResult.resultAnalysis.text;
      } else {
        // 否则尝试JSON序列化
        try {
          resultAnalysis = JSON.stringify(fullAiResult.resultAnalysis);
        } catch (error) {
          console.error('保存分析日志失败: 结果分析JSON序列化失败:', error.message);
          resultAnalysis = null;
        }
      }
    } else {
      // 当没有结果分析时，使用AI的初始响应作为分析报告
      resultAnalysis = aiResponse;
    }
    const aiSource = typeof fullAiResult.aiSource === 'string' ? fullAiResult.aiSource : null;
    const resultAnalysisSource =
      typeof fullAiResult.resultAnalysisSource === 'string'
        ? fullAiResult.resultAnalysisSource
        : null;

    // 保存完整的AI分析结果，包括原始响应、SQL、执行结果和分析
    // 检查表是否有tenant_id字段
    console.log('开始保存分析日志...');
    console.log('参数:', {
      assetId,
      dimension,
      prompt: `${prompt.substring(0, 50)}...`,
      hasFullAiResult: !!fullAiResult,
      hasAiResponse: !!fullAiResult.aiResponse,
      hasResultAnalysis: !!fullAiResult.resultAnalysis,
      userId,
      tenantId,
    });

    const [columns] = await db.execute("SHOW COLUMNS FROM asset_ai_analysis_logs LIKE 'tenant_id'");
    const hasTenantId = columns.length > 0;
    console.log('检查表结构:', { hasTenantId });

    if (hasTenantId) {
      console.log('使用带tenant_id的插入语句');
      await db.execute(
        'INSERT INTO asset_ai_analysis_logs (asset_id, dimension, prompt, response, `sql`, sql_execution, result_analysis, ai_source, result_analysis_source, user_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          assetId && typeof assetId === 'number' ? assetId : null,
          dimension && typeof dimension === 'string' ? dimension : 'custom',
          prompt.trim(),
          aiResponse,
          sql,
          sqlExecutionJson,
          resultAnalysis,
          aiSource,
          resultAnalysisSource,
          userId && typeof userId === 'number' ? userId : null,
          tenantId && typeof tenantId === 'number' ? tenantId : null,
        ],
      );
    } else {
      console.log('使用不带tenant_id的插入语句');
      await db.execute(
        'INSERT INTO asset_ai_analysis_logs (asset_id, dimension, prompt, response, `sql`, sql_execution, result_analysis, ai_source, result_analysis_source, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          assetId && typeof assetId === 'number' ? assetId : null,
          dimension && typeof dimension === 'string' ? dimension : 'custom',
          prompt.trim(),
          aiResponse,
          sql,
          sqlExecutionJson,
          resultAnalysis,
          aiSource,
          resultAnalysisSource,
          userId && typeof userId === 'number' ? userId : null,
        ],
      );
    }

    console.log('✅ 分析日志保存成功');
  } catch (error) {
    console.error('保存分析日志失败:', error.message, {
      errorStack: error.stack,
      assetId,
      dimension,
    });
    // 保存日志失败不影响分析结果返回
  }
}

/**
 * 获取AI问答记录列表
 * @param {Object} req - Express请求对象，用于获取租户信息
 * @returns {Promise<Object>} 问答记录列表
 */
async function getQuestionRecords(req) {
  try {
    // 检查表是否有tenant_id字段
    const [columns] = await db.execute("SHOW COLUMNS FROM asset_ai_analysis_logs LIKE 'tenant_id'");
    const hasTenantId = columns.length > 0;

    // 构建查询条件
    let whereClause = '';
    const params = [];

    // 如果表有tenant_id字段，添加租户过滤
    if (hasTenantId) {
      const { addTenantFilter } = require('../middleware/tenant-filter');
      const tenantFilter = addTenantFilter(req, 'aal');

      if (tenantFilter.whereClause) {
        whereClause = `WHERE ${tenantFilter.whereClause.replace(' AND ', '')}`;
        params.push(...tenantFilter.params);
      }
    }

    // 查询AI问答记录，按创建时间倒序排列
    const [records] = await db.execute(
      `SELECT * FROM asset_ai_analysis_logs aal ${whereClause} ORDER BY aal.created_at DESC`,
      params,
    );

    // 处理记录，将JSON字符串转换为对象，并映射字段名
    const processedRecords = records.map(record => {
      // 安全解析sql_execution字段
      let sqlExecution = false;
      let sqlResults = null;

      try {
        if (record.sql_execution) {
          sqlExecution = JSON.parse(record.sql_execution);
          // 如果sqlExecution是对象且有results字段，提取出来作为sqlResults
          if (sqlExecution && typeof sqlExecution === 'object' && sqlExecution.results) {
            sqlResults = sqlExecution.results;
          }
        }
      } catch (error) {
        structuredLog('warn', '解析sql_execution字段失败', {
          error: error.message,
          recordId: record.id,
        });
        sqlExecution = false;
      }

      // 处理结果分析字段
      let resultAnalysis = null;
      try {
        if (record.result_analysis) {
          // 尝试解析为JSON
          try {
            resultAnalysis = JSON.parse(record.result_analysis);
            // 如果解析后仍然是字符串，直接使用
            if (typeof resultAnalysis === 'string') {
              // 保持不变
            } else if (resultAnalysis && typeof resultAnalysis === 'object') {
              // 如果是对象，尝试提取文本内容
              if (resultAnalysis.content && typeof resultAnalysis.content === 'string') {
                resultAnalysis = resultAnalysis.content;
              } else if (resultAnalysis.text && typeof resultAnalysis.text === 'string') {
                resultAnalysis = resultAnalysis.text;
              } else if (resultAnalysis.analysis && typeof resultAnalysis.analysis === 'string') {
                resultAnalysis = resultAnalysis.analysis;
              } else {
                // 否则转换为字符串
                resultAnalysis = JSON.stringify(resultAnalysis);
              }
            }
          } catch (parseError) {
            // 如果不是JSON，直接作为文本使用
            resultAnalysis = record.result_analysis;
          }
        }
      } catch (error) {
        structuredLog('warn', '解析result_analysis字段失败', {
          error: error.message,
          recordId: record.id,
        });
        resultAnalysis = record.result_analysis || null;
      }

      return {
        id: record.id,
        question: record.prompt,
        answer: record.response,
        sql: record.sql,
        result_analysis: resultAnalysis,
        ai_source: record.ai_source,
        analysis_time: record.created_at,
        sql_execution: !!record.sql, // 是否生成了SQL
        sql_results: sqlResults, // SQL执行结果
        created_at: record.created_at, // 保留原始创建时间
        updated_at: record.updated_at, // 保留原始更新时间
        user_id: record.user_id, // 执行分析的用户ID
        asset_id: record.asset_id, // 关联的资产ID
        dimension: record.dimension, // 分析维度
        // 兼容前端字段名
        resultAnalysis,
        sqlExecution: !!record.sql,
        analysisResult: resultAnalysis,
      };
    });

    return { success: true, data: processedRecords };
  } catch (error) {
    console.error('获取问答记录失败:', error);
    return { success: false, message: '获取问答记录失败' };
  }
}

/**
 * 获取单个分析报告详情
 * @param {number} id - 报告ID
 * @param {Object} req - Express请求对象，用于获取租户信息
 * @returns {Promise<Object>} 报告详情
 */
async function getAnalysisReport(id, req = null) {
  try {
    // 检查表是否有tenant_id字段
    const [columns] = await db.execute("SHOW COLUMNS FROM asset_ai_analysis_logs LIKE 'tenant_id'");
    const hasTenantId = columns.length > 0;

    let whereClause = 'WHERE aal.id = ?';
    const params = [id];

    // 如果表有tenant_id字段且提供了req对象，添加租户过滤
    if (hasTenantId && req) {
      const { addTenantFilter } = require('../middleware/tenant-filter');
      const tenantFilter = addTenantFilter(req, 'aal');

      if (tenantFilter.whereClause) {
        whereClause += tenantFilter.whereClause;
        params.push(...tenantFilter.params);
      }
    }

    // 查询报告详情
    const [reports] = await db.execute(
      `SELECT * FROM asset_ai_analysis_logs aal ${whereClause}`,
      params,
    );

    if (reports.length === 0) {
      return { success: false, message: '报告不存在' };
    }

    const report = reports[0];

    // 解析JSON格式的字段
    try {
      // 解析sql_execution字段（JSON格式存储）
      if (report.sql_execution) {
        report.sql_execution = JSON.parse(report.sql_execution);
      }
    } catch (error) {
      console.error('解析报告SQL执行结果失败:', error.message);
      report.sql_execution = null;
    }

    // 响应字段保持原始字符串格式，不尝试JSON解析
    // 因为它存储的是AI的自然语言响应，不是JSON格式

    return { success: true, data: report };
  } catch (error) {
    console.error('获取报告详情失败:', error.message);
    return { success: false, message: error.message };
  }
}

// 导出所有函数
module.exports = {
  getDimensions,
  getOpenDatasources,
  analyzeAsset,
  analyzeAssets,
  customAnalysis,
  getAnalysisHistory,
  getAnalysisReport, // 新增：获取单个报告详情
  getQuestionRecords, // 新增：获取AI问答记录列表
  callAIAnalysisAPI, // 方便测试
  callDashScopeAPI, // 添加导出，方便测试百炼AI功能
  callDeepSeekAPI, // 添加导出，方便测试DeepSeek AI功能
};
