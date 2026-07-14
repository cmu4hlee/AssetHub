/**
 * OpenCode Service
 * Normalizes AssetHub chat-completions style payloads onto the local OpenCode HTTP gateway.
 */

const opencodeServerManager = require('./opencode-server-manager');
const aiLiveDataContextService = require('./ai-live-data-context.service');
const aiRuntimeAuthStore = require('./ai-runtime-auth-store');
const {
  buildOpenCodeAssetHubPrompt,
  buildOpenCodeAssetHubPlannerPrompt,
} = require('./opencode-assethub-prompt-template');

const DEFAULT_MODEL = 'opencode';
const OPENCODE_ENABLED = process.env.OPENCODE_SERVER_ENABLED !== 'false';
const ASSETHUB_MCP_REQUIREMENTS = [
  'assethub MCP 使用要求：',
  '- 只要问题涉及 AssetHub 的身份、权限、菜单、模块、租户、资产、库存、维修、调配、报废、告警、审计或配置，就先使用 OpenCode 已配置的 `assethub` MCP 工具，不要直接凭提示词中的上下文作答。',
  '- 对于这类问题，优先先调用 `get_current_auth_context`，先确认当前用户、当前角色、当前生效租户、菜单权限、角色权限和租户模块，再决定后续工具调用。',
  '- 涉及 AssetHub 业务数据查询、统计、详情、列表、流程状态、审批状态时，必须优先调用 OpenCode 已配置的 `assethub` MCP 工具。',
  '- 调用 `assethub` MCP 工具时，如果工具参数中存在 `_auth_context_id`，必须显式传入当前工具运行时上下文中的 `_auth_context_id`；不要自行编造、猜测或改写。',
  '- 调用 `assethub` MCP 工具时，如果当前工具运行时上下文已经提供了 `tenant_id`，且工具参数 schema 中存在 `tenant_id`，必须原样传入；如果当前工具运行时上下文未提供 `tenant_id`，不要臆造租户，可先调用 `get_current_auth_context` 或明确说明需要租户上下文。',
  '- 如果工具参数中存在 `_auth_username`、`_auth_password` 或 `_auth_token`，这些字段仅可使用受信任代理已提供的值，禁止向终端用户索要、猜测、编造或回显。',
  '- 先查 MCP，再回答；禁止凭空猜测数据库内容，禁止编造数量、金额、状态、明细、趋势。',
  '- 如果问题与资产系统无关，可直接正常回答；如果与资产系统有关但 `assethub` MCP 不可用、无权限、无结果或结果不完整，必须明确说明限制。',
  '- 优先使用与用户问题最匹配的 `assethub` MCP 能力，例如：',
  '  0. 当前登录身份/权限/租户上下文：`get_current_auth_context`',
  '  1. 资产数量/总览/统计：`get_asset_statistics`、`get_dashboard_overview`、`get_department_statistics`、`get_value_statistics`',
  '  2. 资产列表/检索/详情：`list_assets`、`list_all_assets`、`get_asset`',
  '  3. 库存查询：`list_inventory`',
  '  4. 调配/闲置：`list_transfers`、`transfer_asset`、`list_idle_assets`',
  '  5. 维修/工单/预测性维护：`list_maintenance_logs`、`list_maintenance_workorders`、`get_predictive_maintenance`',
  '  6. 报废/采购：`list_scrappings`、`list_procurements`',
  '  7. 部门/用户/角色/租户：`list_departments`、`list_users`、`list_roles`、`list_tenants`',
  '  8. 审计/告警：`list_audit_logs`、`list_alerts`、`get_environment_alerts`',
  '- `get_value_statistics` 代表资产价值统计，不等于折旧统计；当用户询问折旧、累计折旧、账面净值、折旧率时，不能把价值统计结果当作折旧数据。',
  '- 当用户请求“查一下/统计一下/列出/看看详情/有没有/多少/最近/状态”这类系统内数据时，默认应先考虑 `assethub` MCP。',
].join('\n');

const LEAKED_META_LINE_PATTERNS = [
  /^The user\b/i,
  /^The MCP returned\b/i,
  /^用户(问|说|表示|提到|要求|想知道|在问|提问|只要求)/,
  /^用户询问/,
  /^这是一个关于/,
  /^这(是|类).*(概念性|说明类)问题/,
  /^根据系统(提示|约束|消息)/,
  /^根据返回的数据/,
  /^根据对话历史/,
  /^回顾对话历史/,
  /^让我直接回答/,
  /^我需要说明/,
  /^我应该直接/,
  /^按照要求/,
  /^获取到了/,
  /^让我总结/,
  /^我需要用中文/,
  /^我需要直接回答/,
  /^当前 Web 登录态实时数据上下文/,
  /^实时数据 JSON[:：]?$/,
  /^当前工具运行时上下文[:：]?$/,
  /^工具上下文 JSON[:：]?$/,
  /^"toolRuntimeContext"/,
  /^"_auth_context_id"/,
];

const USERNAME_QUERY_RE =
  /(我的?(用户名|账号|登录名).*(什么|是啥|是多少)|用户名.*(什么|是啥|是多少)|你知道我的用户名吗)/;
const USERNAME_PASSED_QUERY_RE =
  /(我把用户名传递给你了吗|有没有把.*用户名.*传给你|是否.*传递.*用户名)/;
const GREETING_QUERY_RE =
  /^(你好|您好|hi|hello|嗨|哈喽|早上好|上午好|中午好|下午好|晚上好|在吗|在么|有人吗)[！!,.，。？?\s~]*$/i;
const THANKS_QUERY_RE = /^(谢谢|感谢|多谢|谢了|thx|thanks)[！!,.，。？?\s~]*$/i;
const MCP_CREDENTIAL_QUERY_RE =
  /((mcp|assethub).*(账号|用户名|密码|凭证|token|密钥|认证|authorization|bearer)|((账号|用户名|密码|凭证|token|密钥|认证|authorization|bearer).*(mcp|assethub))|((调用|查询|使用).*(mcp|assethub).*(账号|密码|凭证|认证)))/i;
const ROLE_QUERY_RE =
  /((我的|当前)(角色|身份|权限).*(什么|是啥|是什么)|我是什么角色|我现在是什么身份)/;
const TENANT_QUERY_RE =
  /((当前|我的|我现在).*(租户|企业|企业空间|空间).*(什么|是啥|是什么|哪个|哪家)|我当前在哪个租户|我现在在哪个企业)/;
const MANAGED_DEPARTMENT_QUERY_RE =
  /((我|当前登录用户).*(管理|负责|有权限管理).*(科室|部门)|(我负责的|我管理的)(科室|部门)|管理科室|负责科室)/;
const MODULE_QUERY_RE = /(启用模块|模块.*(启用|开启|打开|可用)|当前.*模块)/;
const NUMBERS_ONLY_RE =
  /(只(回答|返回|给|要).*(数字|数值)|仅(回答|返回).*(数字|数值)|数字结果|不要解释|别解释|只要结果)/;
const LIST_ONLY_RE = /(只返回|仅返回|只要|仅要|不要解释|别解释)/;
const LIST_QUERY_RE = /(列表|列出|明细|详情|前\d+|top\s*\d+|最近|记录|日志|清单|有哪些|哪些)/i;
const COUNT_QUERY_RE = /(多少|总数|总量|数量|几(个|项|位)?)/;
const MENU_QUERY_RE = /(菜单|导航|功能入口|页面入口|可见功能|访问入口).*(有哪些|可见|能看到|可以看到|权限|访问|显示|入口|列表|清单)/;
const AUDIT_LOG_QUERY_RE = /(审计日志|操作日志).*(列表|明细|详情|最近|前\d+|统计|分布|概况|概览|汇总|分析|记录)/;
const MAINTENANCE_LOG_QUERY_RE = /(维修日志|维护日志|维修记录|维护记录|维修历史|维护历史|保养日志|保养记录)/;
const WORKORDER_QUERY_RE = /(维修工单|维护工单|工单)/;
const ANALYSIS_REQUEST_RE =
  /(建议|评价|解读|原因|趋势|预测|方案|策略|优化|诊断|总结|归纳|判断|推荐|对比|比较|是否合理|怎么做|如何做|帮我分析|分析一下|做个分析|进行分析|请分析|分析原因|详细分析|配置分析|情况分析|统计分析)/;
const ANALYSIS_FOLLOW_UP_ONLY_RE = /^(分析|继续分析|详细分析|配置分析|情况分析|统计分析)$/;
const DEPRECIATION_QUERY_RE = /(折旧|累计折旧|账面净值|账面价值|折旧率|残值|净值)/;
const DEPRECIATION_LIST_QUERY_RE = /(列表|列出|明细|详情|前\d+|top\s*\d+)/i;
const ASSET_OVERVIEW_QUERY_RE =
  /(资产|设备|器械|仪器).*(统计|总览|概览|概况|数量|多少|总数|总量|在用|闲置|维修|报废|价值|金额|汇总)/;
const PLANNED_EXECUTION_TRIGGER_RE =
  /(为什么|原因|建议|方案|策略|风险|异常|瓶颈|优化|诊断|对比|比较|是否合理|是否应该|怎么|如何|优先|适合|综合|整体|流程|链路|影响|根因|趋势|画像|评估)/;
const PLANNED_EXECUTION_CONNECTOR_RE = /(结合|综合|同时|并且|以及|并|协同|联动)/;
const DOMAIN_SIGNAL_DEFINITIONS = [
  { key: 'asset', pattern: /(资产|设备|器械|仪器|台账)/ },
  { key: 'maintenance', pattern: /(维修|维护|工单|保养)/ },
  { key: 'transfer', pattern: /(调配|调拨|转移)/ },
  { key: 'idle', pattern: /闲置/ },
  { key: 'scrapping', pattern: /报废/ },
  { key: 'inventory', pattern: /(盘点|库存)/ },
  { key: 'procurement', pattern: /采购/ },
  { key: 'quality', pattern: /(质检|验收)/ },
  { key: 'audit', pattern: /(审计|日志|权限|角色|菜单|模块)/ },
];
const OVERVIEW_METRIC_DEFINITIONS = [
  {
    key: 'totalCount',
    label: '资产总数',
    patterns: [/资产总数/, /资产总量/, /总量/, /总数/, /总计/],
  },
  {
    key: 'inUseCount',
    label: '在用',
    patterns: [/在用/],
  },
  {
    key: 'idleCount',
    label: '闲置',
    patterns: [/闲置/],
  },
  {
    key: 'repairCount',
    label: '维修',
    patterns: [/维修/, /修理/],
  },
  {
    key: 'scrapCount',
    label: '报废',
    patterns: [/报废/],
  },
  {
    key: 'transferCount',
    label: '调配中',
    patterns: [/调配中/, /调拨中/, /转移中/],
  },
  {
    key: 'totalValue',
    label: '总价值',
    patterns: [/总价值/, /总金额/, /金额/, /价值/],
  },
];

function formatAuditTimestamp(value) {
  const sourceText = String(value || '').trim();
  if (!sourceText) {
    return '';
  }

  const normalized = sourceText.replace('T', ' ').replace(/\.\d{3}Z$/, '').replace(/Z$/, '');
  return normalized.length >= 19 ? normalized.slice(0, 19) : normalized;
}

function formatAuditDate(value) {
  const sourceText = String(value || '').trim();
  if (!sourceText) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(sourceText)) {
    return sourceText;
  }

  const normalized = formatAuditTimestamp(sourceText);
  return normalized.length >= 10 ? normalized.slice(0, 10) : normalized;
}

function extractText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    return value.map(item => extractText(item)).filter(Boolean).join('\n');
  }

  if (typeof value === 'object') {
    if (Array.isArray(value.choices)) {
      return extractText(value.choices[0]?.message?.content) || extractText(value.choices[0]?.text);
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
}

function buildSystemPrompt(messages = []) {
  const systemMessages = messages
    .filter(item => item.role === 'system')
    .map(item => extractText(item.content).trim())
    .filter(Boolean);

  const basePrompt =
    systemMessages.length === 0
      ? [
          '你是 AssetHub 的 AI 助手。请使用中文直接回答，并严格遵守对话中的安全与权限约束。',
          '只输出给最终用户的答复，不要输出你的思考过程、分析过程、工具调用过程或英文解释。',
          '涉及 AssetHub 业务数据查询时，必须通过 OpenCode 已配置的 `assethub` MCP 工具执行查询。',
          '不得绕过 `assethub` MCP 假设数据库内容，不得编造资产、库存、维修、调配、报废、部门、用户、租户或审计相关数据。',
          '如果 `assethub` MCP 不可用、无权限、无结果或结果不完整，必须明确说明限制。',
        ].join('\n')
      : systemMessages.join('\n\n');

  return `${basePrompt}\n\n${ASSETHUB_MCP_REQUIREMENTS}`;
}

function buildLiveDataPromptBlock(liveDataContext) {
  if (!liveDataContext) {
    return '';
  }

  return [
    '当前 Web 登录态实时数据上下文：',
    '- 下面的 JSON 由 AssetHub 后端代理按“当前登录用户 + 当前租户”实时查询生成。',
    '- 这份实时数据优先级高于 OpenCode 内置共享 MCP 账号返回的数据；如果两者冲突，必须以这份实时数据为准。',
    '- 如果这份实时数据已经覆盖用户问题，必须直接依据它回答，不要再用共享 MCP 账号改写其中的数字、状态或明细。',
    '- 只有当这份实时数据未覆盖用户问题时，才可以继续使用 `assethub` MCP 补充查询；若补充结果冲突，仍以实时数据为准。',
    '- 如果 JSON 中有 `warnings` 或 `restrictions`，必须如实说明限制，不要改用共享 MCP 账号补出租户敏感数据。',
    '实时数据 JSON:',
    JSON.stringify(liveDataContext, null, 2),
  ].join('\n');
}

function buildRequestContextPromptBlock(runtimeContext = {}) {
  const requestContext = {
    userId: runtimeContext.userId || null,
    username: runtimeContext.username || null,
    role: runtimeContext.role || null,
    tenantId: runtimeContext.tenantId || null,
    tenantName: runtimeContext.tenantName || null,
  };

  return [
    '当前 Web 会话辅助上下文：',
    '- 以下 JSON 只用于帮助你理解当前 Web 会话，并为 `assethub` MCP 工具补齐参数；它不是最终业务答案来源。',
    '- 当问题涉及用户名、角色、租户、权限、菜单、模块或任何 AssetHub 数据时，必须优先调用 `get_current_auth_context`，并以 MCP 返回结果为准。',
    '- 如果下面 JSON 中有 tenantId，且后续工具 schema 支持 `tenant_id`，可原样传入；如果没有 tenantId，不要臆造租户。',
    '当前会话提示 JSON:',
    JSON.stringify({ currentSessionHint: requestContext }, null, 2),
  ].join('\n');
}

function buildToolRuntimeContextPromptBlock(runtimeToolContext = null) {
  if (!runtimeToolContext) {
    return '';
  }

  return [
    '当前工具运行时上下文：',
    '- 以下上下文由 AssetHub 后端受信任代理生成，供 `assethub` MCP 工具调用时使用。',
    '- 这是工具调用参数上下文，不是给终端用户展示的内容；不要在最终回复中回显。',
    '- 这是强制参数：每一次调用 `assethub` MCP 工具时，都必须把下面 JSON 中的 `_auth_context_id` 合并到工具 arguments 中。',
    '- 如果下面 JSON 同时提供了 `tenant_id`，且工具 schema 支持 `tenant_id`，也必须原样传入；如果没有 `tenant_id`，先用 `get_current_auth_context` 确认当前租户上下文，不要自行猜测。',
    '- 调用格式示例：`{"_auth_context_id": "ctx_xxx", "tenant_id": 3, ...其余业务参数}` 或 `{"_auth_context_id": "ctx_xxx", ...其余业务参数}`。',
    '工具上下文 JSON:',
    JSON.stringify(runtimeToolContext, null, 2),
  ].join('\n');
}

function sanitizeAssistantReply(value) {
  let text = extractText(value).trim();
  if (!text) {
    return '';
  }

  text = text.replace(/```json[\s\S]*?"assetOverview"[\s\S]*?```/gi, '').trim();
  text = text.replace(/```json[\s\S]*?"requestContext"[\s\S]*?```/gi, '').trim();
  text = text.replace(/```json[\s\S]*?"currentUserContext"[\s\S]*?```/gi, '').trim();
  text = text.replace(/```json[\s\S]*?"toolRuntimeContext"[\s\S]*?```/gi, '').trim();

  const sanitizedLines = text
    .split('\n')
    .filter(line => !LEAKED_META_LINE_PATTERNS.some(pattern => pattern.test(line.trim())));

  let sanitizedText = sanitizedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const lines = sanitizedText.split('\n');
  const firstChineseLineIndex = lines.findIndex(line => /[\u4e00-\u9fa5]/.test(line));

  if (
    firstChineseLineIndex > 0 &&
    lines.slice(0, firstChineseLineIndex).every(line => !/[\u4e00-\u9fa5]/.test(line))
  ) {
    sanitizedText = lines.slice(firstChineseLineIndex).join('\n').trim();
  }

  const normalizedLines = sanitizedText.split('\n');
  const firstLine = normalizedLines[0] || '';
  const firstChineseCharIndex = firstLine.search(/[\u4e00-\u9fa5]/);
  const leadingSegment =
    firstChineseCharIndex > 0 ? firstLine.slice(0, firstChineseCharIndex) : '';
  if (
    firstChineseCharIndex > 0 &&
    /[A-Za-z]{3,}/.test(leadingSegment) &&
    !/[\u4e00-\u9fa5]/.test(leadingSegment)
  ) {
    normalizedLines[0] = firstLine.slice(firstChineseCharIndex);
    sanitizedText = normalizedLines.join('\n').trim();
  }

  const answerAnchorMatch = sanitizedText.match(
    /(根据当前|基于当前|当前租户|根据以上|基于以上|以下两条|以下建议|以下是|针对当前)/,
  );
  if (answerAnchorMatch && Number.isInteger(answerAnchorMatch.index) && answerAnchorMatch.index > 0) {
    const prefix = sanitizedText.slice(0, answerAnchorMatch.index);
    if (/[A-Za-z]{3,}/.test(prefix)) {
      sanitizedText = sanitizedText.slice(answerAnchorMatch.index).trim();
    }
  }

  return sanitizedText;
}

function extractJsonObjectText(value) {
  const sourceText = extractText(value).trim();
  if (!sourceText) {
    return '';
  }

  const fencedMatch = sourceText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || sourceText;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return '';
  }

  return candidate.slice(firstBrace, lastBrace + 1).trim();
}

function parsePlanningReply(value) {
  const jsonText = extractJsonObjectText(value);
  if (!jsonText) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const normalizeStringArray = input =>
      Array.isArray(input)
        ? input
            .map(item => String(item || '').trim())
            .filter(Boolean)
        : [];

    return {
      goal: String(parsed.goal || '').trim() || null,
      questionType: String(parsed.questionType || '').trim() || 'query',
      complexity: String(parsed.complexity || '').trim() || 'moderate',
      strategy: String(parsed.strategy || '').trim() || 'single_tool',
      mustUseAuthContext: parsed.mustUseAuthContext !== false,
      preferredTools: normalizeStringArray(parsed.preferredTools),
      fallbackTools: normalizeStringArray(parsed.fallbackTools),
      analysisDimensions: normalizeStringArray(parsed.analysisDimensions),
      answerStyle: String(parsed.answerStyle || '').trim() || 'structured',
      notes: normalizeStringArray(parsed.notes),
    };
  } catch (error) {
    return null;
  }
}

function getLatestUserMessage(messages = []) {
  const conversation = Array.isArray(messages) ? messages : [];

  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const item = conversation[index];
    if (item?.role !== 'user') {
      continue;
    }

    const content = extractText(item?.content).trim();
    if (content) {
      return content;
    }
  }

  return '';
}

function countDomainSignals(text = '') {
  const sourceText = String(text || '');
  return DOMAIN_SIGNAL_DEFINITIONS.filter(item => item.pattern.test(sourceText)).length;
}

function shouldUsePlannedExecution(messages = [], liveDataContext = null) {
  const latestUserMessage = getLatestUserMessage(messages);
  if (!latestUserMessage) {
    return false;
  }

  if (
    GREETING_QUERY_RE.test(latestUserMessage) ||
    THANKS_QUERY_RE.test(latestUserMessage) ||
    USERNAME_QUERY_RE.test(latestUserMessage) ||
    USERNAME_PASSED_QUERY_RE.test(latestUserMessage) ||
    ROLE_QUERY_RE.test(latestUserMessage) ||
    TENANT_QUERY_RE.test(latestUserMessage) ||
    MCP_CREDENTIAL_QUERY_RE.test(latestUserMessage)
  ) {
    return false;
  }

  if (
    ASSET_OVERVIEW_QUERY_RE.test(latestUserMessage) &&
    (COUNT_QUERY_RE.test(latestUserMessage) || NUMBERS_ONLY_RE.test(latestUserMessage))
  ) {
    return false;
  }

  if (PLANNED_EXECUTION_TRIGGER_RE.test(latestUserMessage)) {
    return true;
  }

  const domainSignalCount = countDomainSignals(latestUserMessage);
  if (domainSignalCount >= 3) {
    return true;
  }

  if (domainSignalCount >= 1 && PLANNED_EXECUTION_CONNECTOR_RE.test(latestUserMessage)) {
    return true;
  }

  if (liveDataContext?.intent?.wantsAnalysis === true) {
    return domainSignalCount >= 2;
  }

  return false;
}

function buildDeterministicPlanningContext(messages = [], liveDataContext = null) {
  const latestUserMessage = getLatestUserMessage(messages);
  const intent = liveDataContext?.intent || null;
  if (!latestUserMessage || !intent || intent.wantsAnalysis !== true) {
    return null;
  }

  const domainSignalCount = countDomainSignals(latestUserMessage);
  if (domainSignalCount >= 3) {
    return null;
  }

  if (intent.domain === 'asset' && intent.departmentKeyword) {
    if (/(维修|维护|工单|保养)/.test(latestUserMessage)) {
      return {
        goal: `结合${intent.departmentKeyword}资产配置与维修工单情况给出管理建议`,
        questionType: 'analysis',
        complexity: 'moderate',
        strategy: 'composite_tool',
        mustUseAuthContext: true,
        preferredTools: ['query_department_asset_profile'],
        fallbackTools: ['query_workflow_pending_summary'],
        analysisDimensions: ['资产配置', '状态结构', '维护负荷', '工单摘要'],
        answerStyle: 'decision_memo',
        notes: [
          '先调用部门画像复合工具，优先复用单个组合工具覆盖配置与维修维度',
          '仅当需要额外待办流程信息时，再补 query_workflow_pending_summary',
        ],
      };
    }

    return {
      goal: `分析${intent.departmentKeyword}的资产配置和管理情况`,
      questionType: 'analysis',
      complexity: 'moderate',
      strategy: 'composite_tool',
      mustUseAuthContext: true,
      preferredTools: ['query_department_asset_profile'],
      fallbackTools: [],
      analysisDimensions: ['资产规模', '状态结构', '分类结构', '数据缺口'],
      answerStyle: 'structured',
      notes: ['优先使用单个部门画像复合工具完成科室分析'],
    };
  }

  if (intent.domain === 'asset' && intent.searchKeyword && /(维修|维护|工单|保养)/.test(latestUserMessage)) {
    return {
      goal: `分析${intent.searchKeyword}相关资产的运营与维修情况`,
      questionType: 'analysis',
      complexity: 'moderate',
      strategy: 'composite_tool',
      mustUseAuthContext: true,
      preferredTools: ['query_asset_operation_overview'],
      fallbackTools: [],
      analysisDimensions: ['资产集合', '维修状态', '工单情况'],
      answerStyle: 'structured',
      notes: ['优先使用资产运营概览复合工具，不要拆成多个底层接口'],
    };
  }

  return null;
}

function shouldSkipFullLiveDataContext(planningContext = null, liveDataContext = null) {
  if (!planningContext || !liveDataContext?.intent?.wantsAnalysis) {
    return false;
  }

  if (planningContext.strategy !== 'composite_tool') {
    return false;
  }

  const preferredTools = Array.isArray(planningContext.preferredTools)
    ? planningContext.preferredTools
    : [];
  const primaryTool = preferredTools[0] || '';

  if (!['query_department_asset_profile', 'query_asset_operation_overview'].includes(primaryTool)) {
    return false;
  }

  return Boolean(
    liveDataContext.intent.departmentKeyword ||
      liveDataContext.intent.searchKeyword ||
      liveDataContext.intent.status,
  );
}

function shouldPreferBackendCompositeDirectAnswer(liveDataContext = null) {
  const intent = liveDataContext?.intent || null;
  if (!intent || intent.domain !== 'asset' || intent.wantsAnalysis !== true) {
    return false;
  }

  if (!intent.departmentKeyword) {
    return false;
  }

  return /(维修|维护|工单|保养)/.test(String(intent.latestUserMessage || ''));
}

function formatMetricValue(key, value, numbersOnly = false) {
  if (value === null || value === undefined) {
    return '';
  }

  if (key === 'totalValue') {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return String(value);
    }

    if (numbersOnly) {
      return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(2);
    }

    return `¥${numericValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return String(value);
}

function formatCurrencyValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value ? String(value) : '';
  }

  return `¥${numericValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercentValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value ? String(value) : '';
  }

  return `${numericValue.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function formatWorkOrderStatusLabel(value) {
  const normalized = String(value || '').trim();
  const labelMap = {
    pending: '待分配',
    assigned: '待处理',
    in_progress: '进行中',
    pending_acceptance: '待验收',
    completed: '已完成',
    closed: '已关闭',
    cancelled: '已取消',
  };

  return labelMap[normalized] || normalized;
}

function formatWorkOrderPriorityLabel(value) {
  const normalized = String(value || '').trim();
  const labelMap = {
    urgent: '紧急',
    high: '高',
    medium: '中',
    low: '低',
  };

  return labelMap[normalized] || normalized;
}

function formatScrappingStatusLabel(value) {
  const normalized = String(value || '').trim();
  const labelMap = {
    pending: '待审批',
    appraising: '鉴定中',
    approved: '已批准',
    rejected: '已驳回',
    disposing: '处置中',
    completed: '已完成',
  };

  return labelMap[normalized] || normalized;
}

function formatProcurementStatusLabel(value) {
  const normalized = String(value || '').trim();
  const labelMap = {
    draft: '草稿',
    pending: '待审批',
    approved: '已批准',
    rejected: '已驳回',
    executing: '执行中',
    completed: '已完成',
  };

  return labelMap[normalized] || normalized;
}

function collectRequestedOverviewMetrics(text) {
  const sourceText = String(text || '');
  const matches = OVERVIEW_METRIC_DEFINITIONS.map(definition => {
    const index = definition.patterns.reduce((minIndex, pattern) => {
      const currentIndex = sourceText.search(pattern);
      if (currentIndex === -1) {
        return minIndex;
      }
      return Math.min(minIndex, currentIndex);
    }, Number.POSITIVE_INFINITY);

    return {
      ...definition,
      index,
    };
  }).filter(item => Number.isFinite(item.index));

  if (matches.length > 0) {
    return matches.sort((left, right) => left.index - right.index);
  }

  if (!ASSET_OVERVIEW_QUERY_RE.test(sourceText)) {
    return [];
  }

  return OVERVIEW_METRIC_DEFINITIONS.slice(0, 5);
}

function shouldUseDirectLiveDataAnswer(text = '') {
  const sourceText = String(text || '').trim();
  return !ANALYSIS_REQUEST_RE.test(sourceText) && !ANALYSIS_FOLLOW_UP_ONLY_RE.test(sourceText);
}

function shouldReturnCountOnly(text = '') {
  const sourceText = String(text || '');
  return (
    COUNT_QUERY_RE.test(sourceText) &&
    !/(列出|列表|明细|详情|清单|前\d+|top\s*\d+|最近|有哪些|只返回|仅返回)/i.test(sourceText)
  );
}

function appendWarnings(answer, warnings = []) {
  const warningText = Array.isArray(warnings) ? warnings.filter(Boolean).join('\n') : '';
  if (!answer) {
    return warningText || null;
  }

  if (!warningText) {
    return answer;
  }

  return `${answer}\n${warningText}`;
}

function buildOverviewDirectAnswer(latestUserMessage, overview) {
  if (!overview) {
    return null;
  }

  const requestedMetrics = collectRequestedOverviewMetrics(latestUserMessage).filter(
    metric => overview[metric.key] !== null && overview[metric.key] !== undefined,
  );

  if (requestedMetrics.length === 0) {
    return null;
  }

  const numbersOnly = NUMBERS_ONLY_RE.test(latestUserMessage);
  if (numbersOnly) {
    return requestedMetrics
      .map(metric => formatMetricValue(metric.key, overview[metric.key], true))
      .join('、');
  }

  if (requestedMetrics.length === 1) {
    const metric = requestedMetrics[0];
    return `当前租户${metric.label}为 ${formatMetricValue(metric.key, overview[metric.key])}。`;
  }

  const summary = requestedMetrics
    .map(metric => `${metric.label}：${formatMetricValue(metric.key, overview[metric.key])}`)
    .join('，');
  return `当前租户${summary}。`;
}

function buildAssetListDirectAnswer(assetList = {}) {
  const items = Array.isArray(assetList.items) ? assetList.items : [];
  const total = Number.isFinite(Number(assetList.total)) ? Number(assetList.total) : items.length;
  const returnedCount = Number.isFinite(Number(assetList.returnedCount))
    ? Number(assetList.returnedCount)
    : items.length;
  const page = Number.isFinite(Number(assetList.page)) ? Number(assetList.page) : 1;
  const pageSize = Number.isFinite(Number(assetList.pageSize))
    ? Number(assetList.pageSize)
    : Math.max(returnedCount, 1);
  const totalPages = Number.isFinite(Number(assetList.totalPages))
    ? Number(assetList.totalPages)
    : Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
  const displayStart = Number.isFinite(Number(assetList.displayStart))
    ? Number(assetList.displayStart)
    : returnedCount > 0
    ? (page - 1) * pageSize + 1
    : 0;
  const displayEnd = Number.isFinite(Number(assetList.displayEnd))
    ? Number(assetList.displayEnd)
    : returnedCount > 0
    ? displayStart + returnedCount - 1
    : 0;
  const fullDataset = assetList.fullDataset === true;
  const filters = assetList.filters || {};
  const sortField = assetList.sortField || null;
  const sortOrder = assetList.sortOrder || null;
  const filterLabels = [];

  if (filters.search) {
    filterLabels.push(`关键词“${filters.search}”`);
  }

  if (filters.department) {
    filterLabels.push(`部门为${filters.department}`);
  }

  if (filters.status) {
    filterLabels.push(`状态为${filters.status}`);
  }

  const scopeLabel = filterLabels.length > 0 ? `符合${filterLabels.join('、')}的资产` : '资产';

  if (total <= 0 || items.length === 0) {
    return `当前租户下未找到${scopeLabel === '资产' ? '' : scopeLabel}。`;
  }

  const modeLabel = fullDataset
    ? '按全量查询结果分页展示'
    : filterLabels.length > 0
    ? '按筛选结果分页展示'
    : '按当前分页结果展示';
  const sortLabelMap = {
    current_value: '当前价值',
    purchase_price: '购置价格',
    asset_name: '资产名称',
    purchase_date: '购置日期',
    updated_at: '更新时间',
    created_at: '创建时间',
  };
  const sortDirectionLabel =
    sortOrder === 'asc' ? '从低到高' : sortOrder === 'desc' ? '从高到低' : '';
  const sortLabel =
    sortField && sortLabelMap[sortField] && sortDirectionLabel
      ? `，按${sortLabelMap[sortField]}${sortDirectionLabel}排序`
      : '';
  const pageLabel =
    displayStart > 0 && displayEnd >= displayStart
      ? `第 ${page} 页（第 ${displayStart}-${displayEnd} 项，共 ${total} 项，每页 ${pageSize} 项）`
      : `第 ${page} 页（共 ${total} 项，每页 ${pageSize} 项）`;
  const header = `当前租户下${scopeLabel}共 ${total} 项，${modeLabel}，${pageLabel}${sortLabel}：`;

  const lines = items.map((item, index) => {
    const absoluteIndex = displayStart > 0 ? displayStart + index : index + 1;
    const identity = [item.assetCode, item.assetName || '未命名资产'].filter(Boolean).join(' ');
    const attributes = [
      item.status ? `状态：${item.status}` : '',
      item.departmentName ? `部门：${item.departmentName}` : '',
      item.location ? `位置：${item.location}` : '',
      sortField === 'current_value' && item.currentValue !== null && item.currentValue !== undefined
        ? `当前价值：${formatCurrencyValue(item.currentValue)}`
        : '',
      sortField === 'purchase_price' && item.purchasePrice !== null && item.purchasePrice !== undefined
        ? `购置价：${formatCurrencyValue(item.purchasePrice)}`
        : '',
    ].filter(Boolean);
    const suffix = attributes.length > 0 ? `，${attributes.join('，')}` : '';
    return `${absoluteIndex}. ${identity}${suffix}。`;
  });

  let footer = '如需下载当前结果，请回复“导出当前筛选结果”或“导出CSV”。';
  if (totalPages > 1 && page <= 1) {
    footer =
      '如需继续查看，可回复“下一页”或“第2页”；如需下载，可回复“导出当前筛选结果”或“导出CSV”。';
  } else if (totalPages > page) {
    footer =
      `如需翻页，可回复“上一页”“下一页”或“第${Math.min(page + 1, totalPages)}页”；如需下载，可回复“导出当前筛选结果”或“导出CSV”。`;
  } else if (totalPages > 1) {
    footer =
      '已到最后一页；如需回看，可回复“上一页”或“第1页”；如需下载，可回复“导出当前筛选结果”或“导出CSV”。';
  }

  return [header, lines.join('\n'), footer].filter(Boolean).join('\n');
}

function buildAssetFilterScopeLabel(filters = {}) {
  const filterLabels = [];

  if (filters.search) {
    filterLabels.push(`关键词“${filters.search}”`);
  }

  if (filters.department) {
    filterLabels.push(`部门为${filters.department}`);
  }

  if (filters.status) {
    filterLabels.push(`状态为${filters.status}`);
  }

  return filterLabels.length > 0
    ? `当前租户下符合${filterLabels.join('、')}的全部资产`
    : '当前租户下全部资产';
}

function buildAssetExportDirectAnswer(assetExport = {}) {
  const format = String(assetExport.format || 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx';
  const formatLabel = format === 'csv' ? 'CSV' : 'Excel';
  const alternateFormat =
    String(assetExport.alternateFormat || '').toLowerCase() === 'csv' ? 'csv' : 'xlsx';
  const alternateFormatLabel = alternateFormat === 'csv' ? 'CSV' : 'Excel';
  const scopeLabel = buildAssetFilterScopeLabel(assetExport.filters || {});
  const total = Number.isFinite(Number(assetExport.total)) ? Number(assetExport.total) : null;
  const downloadUrl = String(assetExport.downloadUrl || '').trim();
  const alternateDownloadUrl = String(assetExport.alternateDownloadUrl || '').trim();
  const sortField = assetExport.sortField || null;
  const sortOrder = assetExport.sortOrder || null;
  const exportSortLabelMap = {
    current_value: '当前价值',
    purchase_price: '购置价格',
    asset_name: '资产名称',
    purchase_date: '购置日期',
    updated_at: '更新时间',
    created_at: '创建时间',
  };
  const exportSortDirectionLabel =
    sortOrder === 'asc' ? '从低到高' : sortOrder === 'desc' ? '从高到低' : '';
  const exportSortLine =
    sortField && exportSortLabelMap[sortField] && exportSortDirectionLabel
      ? `导出会保留当前排序：按${exportSortLabelMap[sortField]}${exportSortDirectionLabel}。`
      : null;

  if (!downloadUrl) {
    return null;
  }

  return [
    `已按当前筛选条件准备${formatLabel}导出。`,
    `${scopeLabel}会按完整结果导出，不仅限当前页。`,
    exportSortLine,
    total ? `预计导出 ${total} 项。` : null,
    `[下载当前筛选结果（${formatLabel}）](${downloadUrl})`,
    alternateDownloadUrl && alternateDownloadUrl !== downloadUrl
      ? `如需${alternateFormatLabel}格式，也可以直接下载：[下载当前筛选结果（${alternateFormatLabel}）](${alternateDownloadUrl})`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildRoleListDirectAnswer(latestUserMessage, roleList = {}) {
  const items = Array.isArray(roleList.items) ? roleList.items : [];
  const total = Number.isFinite(Number(roleList.total)) ? Number(roleList.total) : items.length;
  const returnedCount = Number.isFinite(Number(roleList.returnedCount))
    ? Number(roleList.returnedCount)
    : items.length;

  if (total <= 0 || items.length === 0) {
    return '当前登录上下文下未找到可见角色。';
  }

  if (shouldReturnCountOnly(latestUserMessage)) {
    return `当前登录上下文下可见角色总数为 ${total}。`;
  }

  const lines = items.map((item, index) => {
    const roleName = item.roleName || item.roleCode || '未命名角色';
    const roleCode = item.roleCode ? `role_code: ${item.roleCode}` : '';
    return `${index + 1}. ${roleName}${roleCode ? `（${roleCode}）` : ''}。`;
  });

  if (LIST_ONLY_RE.test(String(latestUserMessage || ''))) {
    return lines.join('\n');
  }

  const header =
    total > returnedCount
      ? `当前登录上下文下可见角色共 ${total} 项，当前返回前 ${returnedCount} 项：`
      : `当前登录上下文下可见角色共 ${total} 项：`;
  return `${header}\n${lines.join('\n')}`;
}

function buildDepartmentListDirectAnswer(latestUserMessage, departmentList = {}) {
  const items = Array.isArray(departmentList.items) ? departmentList.items : [];
  const total = Number.isFinite(Number(departmentList.total))
    ? Number(departmentList.total)
    : items.length;
  const returnedCount = Number.isFinite(Number(departmentList.returnedCount))
    ? Number(departmentList.returnedCount)
    : items.length;
  const filters = departmentList.filters || {};
  const keywordLabel = filters.keyword ? `符合关键词“${filters.keyword}”的部门` : '部门';

  if (total <= 0 || items.length === 0) {
    return `当前租户下未找到${keywordLabel === '部门' ? '部门数据' : keywordLabel}。`;
  }

  if (shouldReturnCountOnly(latestUserMessage)) {
    return `当前租户${keywordLabel === '部门' ? '部门总数' : `${keywordLabel}总数`}为 ${total}。`;
  }

  const lines = items.map((item, index) => {
    const name = item.departmentName || item.departmentCode || '未命名部门';
    const attrs = [
      item.departmentCode ? `department_code: ${item.departmentCode}` : '',
      item.level !== null && item.level !== undefined ? `层级：${item.level}` : '',
    ].filter(Boolean);
    return `${index + 1}. ${name}${attrs.length > 0 ? `（${attrs.join('，')}）` : ''}。`;
  });

  if (LIST_ONLY_RE.test(String(latestUserMessage || ''))) {
    return lines.join('\n');
  }

  const header =
    total > returnedCount
      ? `当前租户下${keywordLabel}共 ${total} 项，当前返回前 ${returnedCount} 项：`
      : `当前租户下${keywordLabel}共 ${total} 项：`;
  return `${header}\n${lines.join('\n')}`;
}

function buildMaintenanceLogListDirectAnswer(latestUserMessage, maintenanceLogList = {}) {
  const items = Array.isArray(maintenanceLogList.items) ? maintenanceLogList.items : [];
  const total = Number.isFinite(Number(maintenanceLogList.total))
    ? Number(maintenanceLogList.total)
    : items.length;
  const returnedCount = Number.isFinite(Number(maintenanceLogList.returnedCount))
    ? Number(maintenanceLogList.returnedCount)
    : items.length;
  const filters = maintenanceLogList.filters || {};
  const filterLabels = [];

  if (filters.assetCode) {
    filterLabels.push(`资产编号为${filters.assetCode}`);
  }
  if (filters.keyword) {
    filterLabels.push(`关键词“${filters.keyword}”`);
  }
  if (filters.status) {
    filterLabels.push(`状态为${filters.status}`);
  }
  if (filters.maintenanceType) {
    filterLabels.push(`类型为${filters.maintenanceType}`);
  }

  const scopeLabel =
    filterLabels.length > 0 ? `符合${filterLabels.join('、')}的维修日志` : '维修日志';

  if (total <= 0 || items.length === 0) {
    return `当前租户下未找到${scopeLabel === '维修日志' ? '维修日志' : scopeLabel}。`;
  }

  if (shouldReturnCountOnly(latestUserMessage)) {
    return `当前租户下${scopeLabel}共 ${total} 项。`;
  }

  const lines = items.map((item, index) => {
    const title = [item.assetCode, item.assetName || '未命名资产'].filter(Boolean).join(' ');
    const attributes = [
      item.maintenanceType ? `类型：${item.maintenanceType}` : '',
      item.status ? `状态：${item.status}` : '',
      item.department ? `部门：${item.department}` : '',
      item.maintenanceDate ? `日期：${item.maintenanceDate}` : '',
    ].filter(Boolean);
    return `${index + 1}. ${title}${attributes.length > 0 ? `，${attributes.join('，')}` : ''}。`;
  });

  if (LIST_ONLY_RE.test(String(latestUserMessage || ''))) {
    return lines.join('\n');
  }

  const header =
    total > returnedCount
      ? `当前租户下${scopeLabel}共 ${total} 项，当前返回前 ${returnedCount} 项：`
      : `当前租户下${scopeLabel}共 ${total} 项：`;
  return `${header}\n${lines.join('\n')}`;
}

function buildWorkOrderListDirectAnswer(latestUserMessage, workOrderList = {}) {
  const items = Array.isArray(workOrderList.items) ? workOrderList.items : [];
  const total = Number.isFinite(Number(workOrderList.total))
    ? Number(workOrderList.total)
    : items.length;
  const returnedCount = Number.isFinite(Number(workOrderList.returnedCount))
    ? Number(workOrderList.returnedCount)
    : items.length;
  const filters = workOrderList.filters || {};
  const filterLabels = [];

  if (filters.assetCode) {
    filterLabels.push(`资产编号为${filters.assetCode}`);
  }
  if (filters.keyword) {
    filterLabels.push(`关键词“${filters.keyword}”`);
  }
  if (filters.status) {
    filterLabels.push(`状态为${formatWorkOrderStatusLabel(filters.status)}`);
  }
  if (filters.priority) {
    filterLabels.push(`优先级为${formatWorkOrderPriorityLabel(filters.priority)}`);
  }

  const scopeLabel =
    filterLabels.length > 0 ? `符合${filterLabels.join('、')}的维护工单` : '维护工单';

  if (total <= 0 || items.length === 0) {
    return `当前租户下未找到${scopeLabel === '维护工单' ? '维护工单' : scopeLabel}。`;
  }

  if (shouldReturnCountOnly(latestUserMessage)) {
    return `当前租户下${scopeLabel}共 ${total} 项。`;
  }

  const lines = items.map((item, index) => {
    const identity = [item.workOrderNo, item.title || item.assetName || '未命名工单']
      .filter(Boolean)
      .join(' ');
    const attributes = [
      item.status ? `状态：${formatWorkOrderStatusLabel(item.status)}` : '',
      item.priority ? `优先级：${formatWorkOrderPriorityLabel(item.priority)}` : '',
      item.assetCode ? `资产编号：${item.assetCode}` : '',
      item.createdAt ? `创建时间：${String(item.createdAt).replace('T', ' ').replace(/\.\d{3}Z$/, '').replace(/Z$/, '').slice(0, 19)}` : '',
    ].filter(Boolean);
    return `${index + 1}. ${identity}${attributes.length > 0 ? `，${attributes.join('，')}` : ''}。`;
  });

  if (LIST_ONLY_RE.test(String(latestUserMessage || ''))) {
    return lines.join('\n');
  }

  const header =
    total > returnedCount
      ? `当前租户下${scopeLabel}共 ${total} 项，当前返回前 ${returnedCount} 项：`
      : `当前租户下${scopeLabel}共 ${total} 项：`;
  return `${header}\n${lines.join('\n')}`;
}

function buildInventoryListDirectAnswer(latestUserMessage, inventoryList = {}) {
  const items = Array.isArray(inventoryList.items) ? inventoryList.items : [];
  const total = Number.isFinite(Number(inventoryList.total))
    ? Number(inventoryList.total)
    : items.length;
  const returnedCount = Number.isFinite(Number(inventoryList.returnedCount))
    ? Number(inventoryList.returnedCount)
    : items.length;
  const filters = inventoryList.filters || {};
  const fullDataset = inventoryList.fullDataset === true;
  const filterLabels = [];

  if (filters.keyword) {
    filterLabels.push(`关键词“${filters.keyword}”`);
  }
  if (filters.status) {
    filterLabels.push(`状态为${filters.status}`);
  }

  const scopeLabel =
    filterLabels.length > 0 ? `符合${filterLabels.join('、')}的盘点记录` : '盘点记录';

  if (total <= 0 || items.length === 0) {
    return `当前租户下未找到${scopeLabel === '盘点记录' ? '盘点记录' : scopeLabel}。`;
  }

  if (shouldReturnCountOnly(latestUserMessage)) {
    return `当前租户下${scopeLabel}共 ${total} 项。`;
  }

  const lines = items.map((item, index) => {
    const title = item.inventoryNo || `盘点记录${index + 1}`;
    const attributes = [
      item.status ? `状态：${item.status}` : '',
      item.inventoryType ? `类型：${item.inventoryType}` : '',
      item.inventoryDate ? `盘点日期：${item.inventoryDate}` : '',
      item.inventoryPerson ? `盘点人：${item.inventoryPerson}` : '',
    ].filter(Boolean);
    return `${index + 1}. ${title}${attributes.length > 0 ? `，${attributes.join('，')}` : ''}。`;
  });

  if (LIST_ONLY_RE.test(String(latestUserMessage || ''))) {
    return lines.join('\n');
  }

  const header =
    fullDataset && total > returnedCount
      ? `当前租户下${scopeLabel}共 ${total} 项，以下按全量查询结果列出前 ${returnedCount} 项：`
      : total > returnedCount
      ? `当前租户下${scopeLabel}共 ${total} 项，当前返回前 ${returnedCount} 项：`
      : `当前租户下${scopeLabel}共 ${total} 项：`;
  return `${header}\n${lines.join('\n')}`;
}

function buildTransferListDirectAnswer(latestUserMessage, transferList = {}) {
  const items = Array.isArray(transferList.items) ? transferList.items : [];
  const total = Number.isFinite(Number(transferList.total))
    ? Number(transferList.total)
    : items.length;
  const returnedCount = Number.isFinite(Number(transferList.returnedCount))
    ? Number(transferList.returnedCount)
    : items.length;
  const filters = transferList.filters || {};
  const fullDataset = transferList.fullDataset === true;
  const filterLabels = [];

  if (filters.keyword) {
    filterLabels.push(`关键词“${filters.keyword}”`);
  }
  if (filters.assetCode) {
    filterLabels.push(`资产编号为${filters.assetCode}`);
  }
  if (filters.department) {
    filterLabels.push(`涉及部门${filters.department}`);
  }
  if (filters.status) {
    filterLabels.push(`状态为${filters.status}`);
  }

  const scopeLabel =
    filterLabels.length > 0 ? `符合${filterLabels.join('、')}的调配记录` : '调配记录';

  if (total <= 0 || items.length === 0) {
    return `当前租户下未找到${scopeLabel === '调配记录' ? '调配记录' : scopeLabel}。`;
  }

  if (shouldReturnCountOnly(latestUserMessage)) {
    return `当前租户下${scopeLabel}共 ${total} 项。`;
  }

  const lines = items.map((item, index) => {
    const title = [item.transferNo, item.assetCode, item.assetName].filter(Boolean).join(' ');
    const attributes = [
      item.status ? `状态：${item.status}` : '',
      item.fromDepartment ? `调出：${item.fromDepartment}` : '',
      item.toDepartment ? `调入：${item.toDepartment}` : '',
      item.applicant ? `申请人：${item.applicant}` : '',
      item.transferDate ? `日期：${item.transferDate}` : '',
    ].filter(Boolean);
    return `${index + 1}. ${title || `调配记录${index + 1}`}${attributes.length > 0 ? `，${attributes.join('，')}` : ''}。`;
  });

  if (LIST_ONLY_RE.test(String(latestUserMessage || ''))) {
    return lines.join('\n');
  }

  const header =
    fullDataset && total > returnedCount
      ? `当前租户下${scopeLabel}共 ${total} 项，以下按全量查询结果列出前 ${returnedCount} 项：`
      : total > returnedCount
      ? `当前租户下${scopeLabel}共 ${total} 项，当前返回前 ${returnedCount} 项：`
      : `当前租户下${scopeLabel}共 ${total} 项：`;
  return `${header}\n${lines.join('\n')}`;
}

function buildProcurementListDirectAnswer(latestUserMessage, procurementList = {}) {
  const items = Array.isArray(procurementList.items) ? procurementList.items : [];
  const total = Number.isFinite(Number(procurementList.total))
    ? Number(procurementList.total)
    : items.length;
  const returnedCount = Number.isFinite(Number(procurementList.returnedCount))
    ? Number(procurementList.returnedCount)
    : items.length;
  const filters = procurementList.filters || {};
  const fullDataset = procurementList.fullDataset === true;
  const filterLabels = [];

  if (filters.keyword) {
    filterLabels.push(`关键词“${filters.keyword}”`);
  }
  if (filters.department) {
    filterLabels.push(`部门为${filters.department}`);
  }
  if (filters.status) {
    filterLabels.push(`状态为${formatProcurementStatusLabel(filters.status)}`);
  }

  const scopeLabel =
    filterLabels.length > 0 ? `符合${filterLabels.join('、')}的采购申请` : '采购申请';

  if (total <= 0 || items.length === 0) {
    return `当前租户下未找到${scopeLabel === '采购申请' ? '采购申请' : scopeLabel}。`;
  }

  if (COUNT_QUERY_RE.test(String(latestUserMessage || '')) && !LIST_QUERY_RE.test(String(latestUserMessage || ''))) {
    return `当前租户下${scopeLabel}共 ${total} 项。`;
  }

  const lines = items.map((item, index) => {
    const title = [item.requestCode, item.title].filter(Boolean).join(' ');
    const attributes = [
      item.department ? `部门：${item.department}` : '',
      item.status ? `状态：${formatProcurementStatusLabel(item.status)}` : '',
      item.budgetAmount !== null && item.budgetAmount !== undefined
        ? `金额：${formatCurrencyValue(item.budgetAmount)}`
        : '',
      item.requesterName ? `申请人：${item.requesterName}` : '',
      item.requestDate ? `申请日期：${item.requestDate}` : '',
    ].filter(Boolean);
    return `${index + 1}. ${title || `采购申请${index + 1}`}${attributes.length > 0 ? `，${attributes.join('，')}` : ''}。`;
  });

  if (LIST_ONLY_RE.test(String(latestUserMessage || ''))) {
    return lines.join('\n');
  }

  const header =
    fullDataset && total > returnedCount
      ? `当前租户下${scopeLabel}共 ${total} 项，以下按全量查询结果列出前 ${returnedCount} 项：`
      : total > returnedCount
      ? `当前租户下${scopeLabel}共 ${total} 项，当前返回前 ${returnedCount} 项：`
      : `当前租户下${scopeLabel}共 ${total} 项：`;
  return `${header}\n${lines.join('\n')}`;
}

function buildIdleAssetListDirectAnswer(latestUserMessage, idleAssetList = {}) {
  const items = Array.isArray(idleAssetList.items) ? idleAssetList.items : [];
  const total = Number.isFinite(Number(idleAssetList.total))
    ? Number(idleAssetList.total)
    : items.length;
  const returnedCount = Number.isFinite(Number(idleAssetList.returnedCount))
    ? Number(idleAssetList.returnedCount)
    : items.length;
  const filters = idleAssetList.filters || {};
  const fullDataset = idleAssetList.fullDataset === true;
  const filterLabels = [];

  if (filters.keyword) {
    filterLabels.push(`关键词“${filters.keyword}”`);
  }
  if (filters.assetCode) {
    filterLabels.push(`资产编号为${filters.assetCode}`);
  }
  if (filters.department) {
    filterLabels.push(`部门为${filters.department}`);
  }
  if (filters.status) {
    filterLabels.push(`发布状态为${filters.status}`);
  }

  const scopeLabel =
    filterLabels.length > 0 ? `符合${filterLabels.join('、')}的闲置资产发布记录` : '闲置资产发布记录';

  if (total <= 0 || items.length === 0) {
    return `当前租户下未找到${scopeLabel === '闲置资产发布记录' ? '闲置资产发布记录' : scopeLabel}。`;
  }

  if (shouldReturnCountOnly(latestUserMessage)) {
    return `当前租户下${scopeLabel}共 ${total} 项。`;
  }

  const lines = items.map((item, index) => {
    const title = [item.assetCode, item.assetName].filter(Boolean).join(' ');
    const attributes = [
      item.publishStatus ? `发布状态：${item.publishStatus}` : '',
      item.assetStatus ? `资产状态：${item.assetStatus}` : '',
      item.department ? `部门：${item.department}` : '',
      item.location ? `位置：${item.location}` : '',
    ].filter(Boolean);
    return `${index + 1}. ${title || `闲置资产${index + 1}`}${attributes.length > 0 ? `，${attributes.join('，')}` : ''}。`;
  });

  if (LIST_ONLY_RE.test(String(latestUserMessage || ''))) {
    return lines.join('\n');
  }

  const header =
    fullDataset && total > returnedCount
      ? `当前租户下${scopeLabel}共 ${total} 项，以下按全量查询结果列出前 ${returnedCount} 项：`
      : total > returnedCount
      ? `当前租户下${scopeLabel}共 ${total} 项，当前返回前 ${returnedCount} 项：`
      : `当前租户下${scopeLabel}共 ${total} 项：`;
  return `${header}\n${lines.join('\n')}`;
}

function buildScrappingListDirectAnswer(latestUserMessage, scrappingList = {}) {
  const items = Array.isArray(scrappingList.items) ? scrappingList.items : [];
  const total = Number.isFinite(Number(scrappingList.total))
    ? Number(scrappingList.total)
    : items.length;
  const returnedCount = Number.isFinite(Number(scrappingList.returnedCount))
    ? Number(scrappingList.returnedCount)
    : items.length;
  const filters = scrappingList.filters || {};
  const fullDataset = scrappingList.fullDataset === true;
  const filterLabels = [];

  if (filters.keyword) {
    filterLabels.push(`关键词“${filters.keyword}”`);
  }
  if (filters.assetCode) {
    filterLabels.push(`资产编号为${filters.assetCode}`);
  }
  if (filters.department) {
    filterLabels.push(`部门为${filters.department}`);
  }
  if (filters.status) {
    filterLabels.push(`状态为${formatScrappingStatusLabel(filters.status)}`);
  }

  const scopeLabel =
    filterLabels.length > 0 ? `符合${filterLabels.join('、')}的报废记录` : '报废记录';

  if (total <= 0 || items.length === 0) {
    return `当前租户下未找到${scopeLabel === '报废记录' ? '报废记录' : scopeLabel}。`;
  }

  if (COUNT_QUERY_RE.test(String(latestUserMessage || '')) && !LIST_QUERY_RE.test(String(latestUserMessage || ''))) {
    return `当前租户下${scopeLabel}共 ${total} 项。`;
  }

  const lines = items.map((item, index) => {
    const title = [item.assetCode, item.assetName].filter(Boolean).join(' ');
    const attributes = [
      item.currentStatus ? `状态：${formatScrappingStatusLabel(item.currentStatus)}` : '',
      item.department ? `部门：${item.department}` : '',
      item.applicant ? `申请人：${item.applicant}` : '',
      item.applyDate ? `申请日期：${item.applyDate}` : '',
      item.estimatedValue !== null && item.estimatedValue !== undefined
        ? `预估残值：${formatCurrencyValue(item.estimatedValue)}`
        : '',
    ].filter(Boolean);
    return `${index + 1}. ${title || `报废记录${index + 1}`}${attributes.length > 0 ? `，${attributes.join('，')}` : ''}。`;
  });

  if (LIST_ONLY_RE.test(String(latestUserMessage || ''))) {
    return lines.join('\n');
  }

  const header =
    fullDataset && total > returnedCount
      ? `当前租户下${scopeLabel}共 ${total} 项，以下按全量查询结果列出前 ${returnedCount} 项：`
      : total > returnedCount
      ? `当前租户下${scopeLabel}共 ${total} 项，当前返回前 ${returnedCount} 项：`
      : `当前租户下${scopeLabel}共 ${total} 项：`;
  return `${header}\n${lines.join('\n')}`;
}

function buildUserListDirectAnswer(latestUserMessage, userList = {}) {
  const items = Array.isArray(userList.items) ? userList.items : [];
  const total = Number.isFinite(Number(userList.total)) ? Number(userList.total) : items.length;
  const returnedCount = Number.isFinite(Number(userList.returnedCount))
    ? Number(userList.returnedCount)
    : items.length;
  const filters = userList.filters || {};
  const keywordLabel = filters.keyword ? `符合关键词“${filters.keyword}”的用户` : '用户';

  if (total <= 0 || items.length === 0) {
    return `当前租户下未找到${keywordLabel === '用户' ? '用户数据' : keywordLabel}。`;
  }

  if (shouldReturnCountOnly(latestUserMessage)) {
    return `当前租户${keywordLabel === '用户' ? '用户总数' : `${keywordLabel}总数`}为 ${total}。`;
  }

  const lines = items.map((item, index) => {
    const title = item.username || item.realName || `用户${index + 1}`;
    const attrs = [
      item.realName && item.realName !== item.username ? `姓名：${item.realName}` : '',
      item.role ? `角色：${item.role}` : '',
      item.status ? `状态：${item.status}` : '',
      item.departmentCode ? `部门编码：${item.departmentCode}` : '',
    ].filter(Boolean);
    return `${index + 1}. ${title}${attrs.length > 0 ? `，${attrs.join('，')}` : ''}。`;
  });

  if (LIST_ONLY_RE.test(String(latestUserMessage || ''))) {
    return lines.join('\n');
  }

  const header =
    total > returnedCount
      ? `当前租户下${keywordLabel}共 ${total} 项，当前返回前 ${returnedCount} 项：`
      : `当前租户下${keywordLabel}共 ${total} 项：`;
  return `${header}\n${lines.join('\n')}`;
}

function buildManagedDepartmentDirectAnswer(managedDepartmentList = {}) {
  const items = Array.isArray(managedDepartmentList.items) ? managedDepartmentList.items : [];
  if (items.length === 0) {
    return '当前登录用户未分配管理科室。';
  }

  const lines = items.map((item, index) => {
    const name = item.departmentName || item.departmentCode || `科室${index + 1}`;
    const code = item.departmentCode ? `department_code: ${item.departmentCode}` : '';
    return `${index + 1}. ${name}${code ? `（${code}）` : ''}。`;
  });

  return `当前登录用户可管理的科室共 ${items.length} 项：\n${lines.join('\n')}`;
}

function buildMenuVisibilityDirectAnswer(menuVisibility = {}) {
  const items = Array.isArray(menuVisibility.items) ? menuVisibility.items : [];
  const total = Number(menuVisibility.total) || items.length;
  const returnedCount = Number(menuVisibility.returnedCount) || items.length;

  if (total <= 0 || items.length === 0) {
    return '当前登录用户暂无可见菜单。';
  }

  const grouped = [];
  const groupMap = new Map();

  items.forEach(item => {
    const groupKey = item.topGroupKey || item.parentKey || item.menuKey || 'ungrouped';
    const groupLabel = item.topGroupLabel || item.parentLabel || item.menuLabel || groupKey;

    if (!groupMap.has(groupKey)) {
      const entry = { groupKey, groupLabel, items: [] };
      groupMap.set(groupKey, entry);
      grouped.push(entry);
    }

    groupMap.get(groupKey).items.push(item);
  });

  const lines = grouped.map((group, index) => {
    const sortedItems = [...group.items].sort((left, right) => {
      const leftIsRoot = left.menuKey && left.menuKey === group.groupKey ? 1 : 0;
      const rightIsRoot = right.menuKey && right.menuKey === group.groupKey ? 1 : 0;
      return rightIsRoot - leftIsRoot;
    });

    const itemText = sortedItems.map(item => {
      const isRootEntry = item.menuKey && item.menuKey === group.groupKey;
      if (isRootEntry && group.items.length > 1) {
        return `入口（${item.menuKey}）`;
      }

      const label = item.menuLabel || item.menuKey || '未命名菜单';
      return `${label}${item.menuKey ? `（${item.menuKey}）` : ''}`;
    });

    return `${index + 1}. ${group.groupLabel}（${group.items.length} 项）：${itemText.join('、')}。`;
  });

  const header =
    total > returnedCount
      ? `当前登录用户可见菜单共 ${total} 项，按一级菜单分组显示当前返回前 ${returnedCount} 项：`
      : `当前登录用户可见菜单共 ${total} 项，按一级菜单分组如下：`;
  return `${header}\n${lines.join('\n')}`;
}

function buildEnabledModulesDirectAnswer(enabledModules = {}) {
  const items = Array.isArray(enabledModules.items) ? enabledModules.items : [];
  if (items.length === 0) {
    return '当前租户未启用任何业务模块。';
  }

  const grouped = [];
  const groupMap = new Map();

  items.forEach(item => {
    const category = item.category || '未分类';
    if (!groupMap.has(category)) {
      const entry = { category, items: [] };
      groupMap.set(category, entry);
      grouped.push(entry);
    }

    groupMap.get(category).items.push(item);
  });

  const lines = grouped.map((group, index) => {
    const modules = group.items.map(item => {
      const moduleName = item.moduleName || item.moduleId || '未命名模块';
      if (item.moduleName && item.moduleId && item.moduleName !== item.moduleId) {
        return `${item.moduleName}（${item.moduleId}）`;
      }

      return moduleName;
    });

    return `${index + 1}. ${group.category}（${group.items.length} 项）：${modules.join('、')}。`;
  });

  return `当前租户已启用模块共 ${items.length} 项，按分类如下：\n${lines.join('\n')}`;
}

function buildAuditLogListDirectAnswer(auditLogList = {}) {
  const items = Array.isArray(auditLogList.items) ? auditLogList.items : [];
  const total = Number(auditLogList.total) || items.length;
  const returnedCount = Number(auditLogList.returnedCount) || items.length;
  const filters = auditLogList.filters || {};
  const filterParts = [];

  if (filters.module) {
    filterParts.push(`模块=${filters.moduleLabel || filters.module}`);
  }
  if (filters.actionType) {
    filterParts.push(`操作类型=${filters.actionLabel || filters.actionType}`);
  }
  if (filters.keyword) {
    filterParts.push(`关键词“${filters.keyword}”`);
  }

  const scopeLabel = filterParts.length > 0 ? `符合${filterParts.join('、')}的审计日志` : '审计日志';

  if (total <= 0 || items.length === 0) {
    return `当前租户下未找到${scopeLabel}。`;
  }

  const lines = items.map((item, index) => {
    const actor = item.realName || item.username || '未知用户';
    const actionLabel = item.actionLabel || item.actionType || '未知操作';
    const moduleLabel = item.moduleLabel || item.module || '';
    const formattedTime = formatAuditTimestamp(item.createdAt);
    const summary = [
      formattedTime ? `时间：${formattedTime}` : '',
      actionLabel ? `操作：${actionLabel}` : '',
      moduleLabel ? `模块：${moduleLabel}` : '',
      item.actionDescription ? `说明：${item.actionDescription}` : '',
    ].filter(Boolean);
    return `${index + 1}. ${actor}${summary.length > 0 ? `，${summary.join('，')}` : ''}。`;
  });

  const header =
    total > returnedCount
      ? `当前租户下${scopeLabel}共 ${total} 项，当前返回前 ${returnedCount} 项：`
      : `当前租户下${scopeLabel}共 ${total} 项：`;
  return `${header}\n${lines.join('\n')}`;
}

function buildAuditLogStatsDirectAnswer(auditLogStats = {}) {
  const actionTypeStats = Array.isArray(auditLogStats.actionTypeStats)
    ? auditLogStats.actionTypeStats.slice(0, 5)
    : [];
  const moduleStats = Array.isArray(auditLogStats.moduleStats) ? auditLogStats.moduleStats.slice(0, 5) : [];
  const userStats = Array.isArray(auditLogStats.userStats) ? auditLogStats.userStats.slice(0, 5) : [];
  const dailyStats = Array.isArray(auditLogStats.dailyStats) ? auditLogStats.dailyStats.slice(-5) : [];

  const lines = [];
  if (actionTypeStats.length > 0) {
    lines.push(
      `操作类型分布：${actionTypeStats
        .map(item => `${item.label || item.name} ${item.count} 次`)
        .join('，')}。`,
    );
  }
  if (moduleStats.length > 0) {
    lines.push(
      `模块分布：${moduleStats.map(item => `${item.label || item.name} ${item.count} 次`).join('，')}。`,
    );
  }
  if (userStats.length > 0) {
    lines.push(
      `操作用户前列：${userStats
        .map(item => `${item.realName || item.username || item.name} ${item.count} 次`)
        .join('，')}。`,
    );
  }
  if (dailyStats.length > 0) {
    lines.push(
      `最近日趋势：${dailyStats
        .map(item => `${formatAuditDate(item.date)} ${item.count} 次`)
        .join('，')}。`,
    );
  }

  return lines.length > 0 ? lines.join('\n') : '当前租户下暂无可用的审计日志统计数据。';
}

function buildAssetDetailDirectAnswer(assetDetail = {}) {
  const title = [assetDetail.assetCode ? `资产 ${assetDetail.assetCode}` : '', assetDetail.assetName ? `（${assetDetail.assetName}）` : '']
    .filter(Boolean)
    .join('');
  const summaryParts = [
    assetDetail.status ? `状态：${assetDetail.status}` : '',
    assetDetail.categoryName ? `分类：${assetDetail.categoryName}` : '',
    assetDetail.departmentName ? `部门：${assetDetail.departmentName}` : '',
    assetDetail.location ? `位置：${assetDetail.location}` : '',
    assetDetail.brand ? `品牌：${assetDetail.brand}` : '',
    assetDetail.model ? `型号：${assetDetail.model}` : '',
    assetDetail.specification ? `规格：${assetDetail.specification}` : '',
    assetDetail.responsiblePersonName ? `负责人：${assetDetail.responsiblePersonName}` : '',
    assetDetail.purchaseDate ? `采购日期：${assetDetail.purchaseDate}` : '',
    assetDetail.purchasePrice !== null && assetDetail.purchasePrice !== undefined
      ? `采购价格：${formatCurrencyValue(assetDetail.purchasePrice)}`
      : '',
    assetDetail.currentValue !== null && assetDetail.currentValue !== undefined
      ? `当前价值：${formatCurrencyValue(assetDetail.currentValue)}`
      : '',
  ].filter(Boolean);

  if (!title && summaryParts.length === 0) {
    return null;
  }

  if (summaryParts.length === 0) {
    return `${title}。`;
  }

  return `${title || '该资产'}，${summaryParts.join('，')}。`;
}

function buildAssetAnalysisDirectAnswer(assetAnalysis = {}) {
  const total = Number(assetAnalysis.total) || 0;
  const filters = assetAnalysis.filters || {};
  const scopeParts = [];
  if (filters.department) {
    scopeParts.push(`部门为${filters.department}`);
  }
  if (filters.search) {
    scopeParts.push(`关键词“${filters.search}”`);
  }
  if (filters.status) {
    scopeParts.push(`状态为${filters.status}`);
  }
  const scopeLabel = scopeParts.length > 0 ? `符合${scopeParts.join('、')}的资产` : '资产';

  if (total <= 0) {
    return `当前租户下未找到${scopeLabel}，因此无法继续做详细分析。`;
  }

  const statusSummary = Array.isArray(assetAnalysis.byStatus)
    ? assetAnalysis.byStatus
        .slice(0, 5)
        .map(item => `${item.status} ${item.count} 项`)
        .join('，')
    : '';
  const categorySummary = Array.isArray(assetAnalysis.topCategories)
    ? assetAnalysis.topCategories
        .slice(0, 5)
        .map(item => `${item.category} ${item.count} 项`)
        .join('，')
    : '';
  const locationSummary = Array.isArray(assetAnalysis.topLocations)
    ? assetAnalysis.topLocations
        .slice(0, 5)
        .map(item => `${item.location} ${item.count} 项`)
        .join('，')
    : '';

  const lines = [
    `当前租户下${scopeLabel}共 ${total} 项，总价值约 ${formatCurrencyValue(assetAnalysis.totalValue)}。`,
  ];

  if (statusSummary) {
    lines.push(`状态分布：${statusSummary}。`);
  }

  if (categorySummary) {
    lines.push(`主要分类：${categorySummary}。`);
  }

  if (locationSummary) {
    lines.push(`主要位置：${locationSummary}。`);
  }

  if (assetAnalysis.missingDepartmentCount > 0) {
    lines.push(`其中有 ${assetAnalysis.missingDepartmentCount} 项资产缺少部门信息。`);
  }

  if (assetAnalysis.missingResponsibleCount > 0) {
    lines.push(`其中有 ${assetAnalysis.missingResponsibleCount} 项资产缺少责任人信息。`);
  }

  lines.push('如需继续看具体资产清单、单台详情或维修记录，可继续指定范围。');
  return lines.join('\n');
}

function getNamedCount(items = [], key, expectedValue) {
  const matched = Array.isArray(items)
    ? items.find(item => String(item?.[key] || '').trim() === String(expectedValue || '').trim())
    : null;
  return Number(matched?.count) || 0;
}

function buildDepartmentOperationalAnalysisDirectAnswer(analysis = {}) {
  const filters = analysis.filters || {};
  const department = filters.department || '该科室';
  const assetSummary = analysis.assetSummary || {};
  const maintenanceSummary = analysis.maintenanceSummary || {};
  const workOrderSummary = analysis.workOrderSummary || {};
  const totalAssets = Number(assetSummary.total) || 0;

  if (totalAssets <= 0) {
    return `当前租户下未找到${department}相关资产，因此无法结合运维情况给出管理建议。`;
  }

  const inUseCount = getNamedCount(assetSummary.statusDistribution, 'status', '在用');
  const inUseRate = totalAssets > 0 ? ((inUseCount / totalAssets) * 100).toFixed(1) : '0.0';
  const pendingWorkOrders = Number(workOrderSummary.pendingCount) || 0;
  const urgentWorkOrders = Number(workOrderSummary.urgentCount) || 0;
  const matchedMaintenanceCount = Number(maintenanceSummary.matchedRecords) || 0;
  const faultRepairCount = Number(maintenanceSummary.faultRepairCount) || 0;
  const missingResponsibleCount = Number(assetSummary.missingResponsibleCount) || 0;
  const missingLocationCount = Number(assetSummary.missingLocationCount) || 0;

  const lines = [
    `${department}资产运维分析如下：`,
    `1. 资产概况：共 ${totalAssets} 件，当前净值约 ${formatCurrencyValue(assetSummary.totalCurrentValue)}，在用 ${inUseCount} 件，在用率约 ${inUseRate}%。`,
  ];

  if (missingLocationCount > 0 || missingResponsibleCount > 0) {
    lines.push(
      `2. 数据完整性：缺少位置 ${missingLocationCount} 件，缺少责任人 ${missingResponsibleCount} 件，台账治理仍需优先补齐。`,
    );
  } else {
    lines.push('2. 数据完整性：位置和责任人字段整体较完整，基础台账质量较好。');
  }

  if (matchedMaintenanceCount > 0 || pendingWorkOrders > 0) {
    const maintenanceParts = [];
    if (matchedMaintenanceCount > 0) {
      maintenanceParts.push(`维修记录 ${matchedMaintenanceCount} 条`);
    }
    if (faultRepairCount > 0) {
      maintenanceParts.push(`其中故障类维修 ${faultRepairCount} 条`);
    }
    if (pendingWorkOrders > 0) {
      maintenanceParts.push(`待处理工单 ${pendingWorkOrders} 条`);
    }
    if (urgentWorkOrders > 0) {
      maintenanceParts.push(`紧急工单 ${urgentWorkOrders} 条`);
    }
    lines.push(`3. 运维压力：${maintenanceParts.join('，')}。`);
  } else {
    lines.push('3. 运维压力：当前未发现明显的维修或工单积压。');
  }

  const suggestions = [];
  if (urgentWorkOrders > 0) {
    suggestions.push(`优先处理 ${urgentWorkOrders} 条紧急工单，避免影响科室连续运行`);
  }
  if (missingResponsibleCount > 0) {
    suggestions.push(`尽快补齐 ${missingResponsibleCount} 件资产的责任人信息，落实到人`);
  }
  if (missingLocationCount > 0) {
    suggestions.push(`补齐 ${missingLocationCount} 件资产的位置编码，减少找机和盘点成本`);
  }
  if (matchedMaintenanceCount > 0 && faultRepairCount / Math.max(matchedMaintenanceCount, 1) >= 0.6) {
    suggestions.push('对故障频发设备建立预防性维护计划，降低被动维修占比');
  }

  if (suggestions.length === 0) {
    suggestions.push('保持现有巡检和工单闭环，重点关注高价值设备的预防性保养');
  }

  lines.push(`4. 管理建议：${suggestions.map((item, index) => `${index + 1}) ${item}`).join('；')}。`);
  return lines.join('\n');
}

function buildDepreciationOverviewDirectAnswer(latestUserMessage, depreciationOverview = {}) {
  const totalAssets = Number(depreciationOverview.totalAssets) || 0;
  const filters = depreciationOverview.filters || {};
  const scopeParts = [];

  if (filters.department) {
    scopeParts.push(`部门为${filters.department}`);
  }

  if (filters.keyword) {
    scopeParts.push(`关键词“${filters.keyword}”`);
  }

  if (filters.status) {
    scopeParts.push(`状态为${filters.status}`);
  }

  const scopeLabel = scopeParts.length > 0 ? `符合${scopeParts.join('、')}的资产` : '资产';

  if (totalAssets <= 0) {
    return `当前租户下未找到${scopeLabel}的折旧数据。`;
  }

  const lines = [
    `当前租户下${scopeLabel}共 ${totalAssets} 项，原值合计 ${formatCurrencyValue(depreciationOverview.totalPurchasePrice)}，累计折旧 ${formatCurrencyValue(depreciationOverview.totalAccumulatedDepreciation)}，当前账面净值 ${formatCurrencyValue(depreciationOverview.totalBookValue)}，平均折旧率 ${formatPercentValue(depreciationOverview.averageDepreciationRate)}。`,
  ];

  if (depreciationOverview.asOfDate) {
    lines.push(`统计截止日期：${depreciationOverview.asOfDate}。`);
  }

  if (depreciationOverview.methodLabel) {
    lines.push(`当前计算方法：${depreciationOverview.methodLabel}。`);
  }

  if (
    DEPRECIATION_LIST_QUERY_RE.test(String(latestUserMessage || '')) &&
    Array.isArray(depreciationOverview.items) &&
    depreciationOverview.items.length > 0
  ) {
    const itemLines = depreciationOverview.items.slice(0, 5).map((item, index) => {
      const identity = [item.assetCode, item.assetName || '未命名资产'].filter(Boolean).join(' ');
      const attributes = [
        item.departmentName ? `部门：${item.departmentName}` : '',
        item.accumulatedDepreciation !== null && item.accumulatedDepreciation !== undefined
          ? `累计折旧：${formatCurrencyValue(item.accumulatedDepreciation)}`
          : '',
        item.currentBookValue !== null && item.currentBookValue !== undefined
          ? `账面净值：${formatCurrencyValue(item.currentBookValue)}`
          : '',
        item.depreciationRate !== null && item.depreciationRate !== undefined
          ? `折旧率：${formatPercentValue(item.depreciationRate)}`
          : '',
      ].filter(Boolean);
      return `${index + 1}. ${identity}${attributes.length > 0 ? `，${attributes.join('，')}` : ''}。`;
    });
    lines.push(`当前返回前 ${Math.min(depreciationOverview.items.length, 5)} 项：`);
    lines.push(itemLines.join('\n'));
  }

  return lines.join('\n');
}

function buildDepreciationGroupDirectAnswer(depreciationGroup = {}) {
  const groupBy = depreciationGroup.groupBy || 'overview';
  const items = Array.isArray(depreciationGroup.items) ? depreciationGroup.items : [];

  if (items.length === 0) {
    if (groupBy === 'department') {
      return '当前租户下暂无可用的部门折旧汇总数据。';
    }

    if (groupBy === 'type') {
      return '当前租户下暂无可用的分类折旧汇总数据。';
    }

    if (groupBy === 'month') {
      return '当前租户下暂无可用的月度折旧趋势数据。';
    }

    return null;
  }

  const prefixLines = [];
  if (groupBy === 'department') {
    prefixLines.push(`当前租户按部门折旧汇总如下（前 ${Math.min(items.length, 5)} 项）：`);
    prefixLines.push(
      items
        .slice(0, 5)
        .map(
          (item, index) =>
            `${index + 1}. ${item.name}：资产 ${item.assetCount} 项，原值 ${formatCurrencyValue(item.totalPurchasePrice)}，累计折旧 ${formatCurrencyValue(item.totalAccumulatedDepreciation)}，账面净值 ${formatCurrencyValue(item.totalBookValue)}，折旧率 ${formatPercentValue(item.depreciationRate)}。`,
        )
        .join('\n'),
    );
  } else if (groupBy === 'type') {
    prefixLines.push(`当前租户按分类折旧汇总如下（前 ${Math.min(items.length, 5)} 项）：`);
    prefixLines.push(
      items
        .slice(0, 5)
        .map(
          (item, index) =>
            `${index + 1}. ${item.name}：资产 ${item.assetCount} 项，原值 ${formatCurrencyValue(item.totalPurchasePrice)}，累计折旧 ${formatCurrencyValue(item.totalAccumulatedDepreciation)}，账面净值 ${formatCurrencyValue(item.totalBookValue)}，折旧率 ${formatPercentValue(item.depreciationRate)}。`,
        )
        .join('\n'),
    );
  } else if (groupBy === 'month') {
    prefixLines.push(`当前租户月度折旧趋势如下（最近 ${Math.min(items.length, 6)} 个时间点）：`);
    prefixLines.push(
      items
        .slice(-6)
        .map(
          item =>
            `${item.month}：累计折旧 ${formatCurrencyValue(item.totalAccumulatedDepreciation)}，账面净值 ${formatCurrencyValue(item.totalBookValue)}，平均折旧率 ${formatPercentValue(item.averageDepreciationRate)}。`,
        )
        .join('\n'),
    );
  }

  if (depreciationGroup.asOfDate) {
    prefixLines.push(`统计截止日期：${depreciationGroup.asOfDate}。`);
  }

  if (depreciationGroup.methodLabel) {
    prefixLines.push(`当前计算方法：${depreciationGroup.methodLabel}。`);
  }

  return prefixLines.filter(Boolean).join('\n');
}

function buildLiveDataDirectAnswer(latestUserMessage, liveDataContext) {
  if (!liveDataContext?.authoritative) {
    return null;
  }

  const warnings = Array.isArray(liveDataContext.warnings) ? liveDataContext.warnings : [];
  const overview = liveDataContext?.data?.assetOverview || null;
  const assetList = liveDataContext?.data?.assetList || null;
  const assetDetail = liveDataContext?.data?.assetDetail || null;
  const assetAnalysis = liveDataContext?.data?.assetAnalysis || null;
  const assetExport = liveDataContext?.data?.assetExport || null;
  const departmentOperationalAnalysis = liveDataContext?.data?.departmentOperationalAnalysis || null;
  const depreciationOverview = liveDataContext?.data?.depreciationOverview || null;
  const depreciationGroup = liveDataContext?.data?.depreciationGroup || null;
  const roleList = liveDataContext?.data?.roleList || null;
  const departmentList = liveDataContext?.data?.departmentList || null;
  const userList = liveDataContext?.data?.userList || null;
  const managedDepartmentList = liveDataContext?.data?.managedDepartmentList || null;
  const menuVisibility = liveDataContext?.data?.menuVisibility || null;
  const enabledModules = liveDataContext?.data?.enabledModules || null;
  const auditLogList = liveDataContext?.data?.auditLogList || null;
  const auditLogStats = liveDataContext?.data?.auditLogStats || null;
  const maintenanceLogList = liveDataContext?.data?.maintenanceLogList || null;
  const workOrderList = liveDataContext?.data?.workOrderList || null;
  const inventoryList = liveDataContext?.data?.inventoryList || null;
  const transferList = liveDataContext?.data?.transferList || null;
  const procurementList = liveDataContext?.data?.procurementList || null;
  const idleAssetList = liveDataContext?.data?.idleAssetList || null;
  const scrappingList = liveDataContext?.data?.scrappingList || null;
  const hasStructuredData = Boolean(
    overview ||
      assetList ||
      assetDetail ||
      assetAnalysis ||
      assetExport ||
      departmentOperationalAnalysis ||
      depreciationOverview ||
      depreciationGroup ||
      roleList ||
      departmentList ||
      userList ||
      managedDepartmentList ||
      menuVisibility ||
      enabledModules ||
      auditLogList ||
      auditLogStats ||
      maintenanceLogList ||
      workOrderList ||
      inventoryList ||
      transferList ||
      procurementList ||
      idleAssetList ||
      scrappingList,
  );

  if (depreciationGroup) {
    return appendWarnings(buildDepreciationGroupDirectAnswer(depreciationGroup), warnings);
  }

  if (
    departmentOperationalAnalysis &&
    ANALYSIS_REQUEST_RE.test(String(latestUserMessage || '')) &&
    /(维修|维护|工单|保养)/.test(String(latestUserMessage || ''))
  ) {
    return appendWarnings(
      buildDepartmentOperationalAnalysisDirectAnswer(departmentOperationalAnalysis),
      warnings,
    );
  }

  if (depreciationOverview) {
    return appendWarnings(
      buildDepreciationOverviewDirectAnswer(latestUserMessage, depreciationOverview),
      warnings,
    );
  }

  if (roleList) {
    return appendWarnings(buildRoleListDirectAnswer(latestUserMessage, roleList), warnings);
  }

  if (departmentList) {
    return appendWarnings(
      buildDepartmentListDirectAnswer(latestUserMessage, departmentList),
      warnings,
    );
  }

  if (userList) {
    return appendWarnings(buildUserListDirectAnswer(latestUserMessage, userList), warnings);
  }

  if (managedDepartmentList) {
    return appendWarnings(buildManagedDepartmentDirectAnswer(managedDepartmentList), warnings);
  }

  if (menuVisibility) {
    return appendWarnings(buildMenuVisibilityDirectAnswer(menuVisibility), warnings);
  }

  if (enabledModules) {
    return appendWarnings(buildEnabledModulesDirectAnswer(enabledModules), warnings);
  }

  if (auditLogList) {
    return appendWarnings(buildAuditLogListDirectAnswer(auditLogList), warnings);
  }

  if (auditLogStats) {
    return appendWarnings(buildAuditLogStatsDirectAnswer(auditLogStats), warnings);
  }

  if (maintenanceLogList && MAINTENANCE_LOG_QUERY_RE.test(String(latestUserMessage || ''))) {
    return appendWarnings(
      buildMaintenanceLogListDirectAnswer(latestUserMessage, maintenanceLogList),
      warnings,
    );
  }

  if (workOrderList && WORKORDER_QUERY_RE.test(String(latestUserMessage || ''))) {
    return appendWarnings(
      buildWorkOrderListDirectAnswer(latestUserMessage, workOrderList),
      warnings,
    );
  }

  if (inventoryList) {
    return appendWarnings(
      buildInventoryListDirectAnswer(latestUserMessage, inventoryList),
      warnings,
    );
  }

  if (transferList) {
    return appendWarnings(buildTransferListDirectAnswer(latestUserMessage, transferList), warnings);
  }

  if (procurementList) {
    return appendWarnings(
      buildProcurementListDirectAnswer(latestUserMessage, procurementList),
      warnings,
    );
  }

  if (idleAssetList) {
    return appendWarnings(
      buildIdleAssetListDirectAnswer(latestUserMessage, idleAssetList),
      warnings,
    );
  }

  if (scrappingList) {
    return appendWarnings(
      buildScrappingListDirectAnswer(latestUserMessage, scrappingList),
      warnings,
    );
  }

  if (shouldUseDirectLiveDataAnswer(latestUserMessage)) {
    if (assetExport) {
      return appendWarnings(buildAssetExportDirectAnswer(assetExport), warnings);
    }

    if (assetDetail) {
      return appendWarnings(buildAssetDetailDirectAnswer(assetDetail), warnings);
    }

    if (assetList) {
      return appendWarnings(buildAssetListDirectAnswer(assetList), warnings);
    }

    const overviewAnswer = buildOverviewDirectAnswer(latestUserMessage, overview);
    if (overviewAnswer) {
      return appendWarnings(overviewAnswer, warnings);
    }
  }

  if (
    assetAnalysis &&
    (ANALYSIS_REQUEST_RE.test(String(latestUserMessage || '')) ||
      ANALYSIS_FOLLOW_UP_ONLY_RE.test(String(latestUserMessage || '').trim()))
  ) {
    return appendWarnings(buildAssetAnalysisDirectAnswer(assetAnalysis), warnings);
  }

  if (!hasStructuredData && warnings.length > 0) {
    return warnings.join('\n');
  }

  return null;
}

function buildLiveDataWarningOnlyAnswer(liveDataContext = null) {
  if (!liveDataContext?.authoritative) {
    return null;
  }

  const warnings = Array.isArray(liveDataContext.warnings) ? liveDataContext.warnings.filter(Boolean) : [];
  if (warnings.length === 0) {
    return null;
  }

  const data = liveDataContext?.data || {};
  const hasStructuredData = Object.values(data).some(Boolean);
  if (hasStructuredData) {
    return null;
  }

  return warnings.join('\n');
}

function buildDirectAnswer(messages = [], runtimeContext = {}, liveDataContext = null, options = {}) {
  const latestUserMessage = getLatestUserMessage(messages);
  if (!latestUserMessage) {
    return null;
  }

  const includeLiveData = options.includeLiveData !== false;
  const directSections = [];
  const username = runtimeContext.username || null;
  const role = runtimeContext.role || null;
  const tenantName = runtimeContext.tenantName || null;
  const tenantId = runtimeContext.tenantId || null;

  if (GREETING_QUERY_RE.test(latestUserMessage)) {
    return '你好，我在。请直接告诉我想查询的资产、统计或系统问题。';
  }

  if (THANKS_QUERY_RE.test(latestUserMessage)) {
    return '不客气。如果您要查资产、统计或当前登录信息，直接告诉我即可。';
  }

  if (MCP_CREDENTIAL_QUERY_RE.test(latestUserMessage)) {
    return `租户敏感查询优先由 AssetHub 后端代理按当前登录身份与当前租户执行，无需您额外提供账号密码；共享 \`assethub\` MCP 仅作为补充能力，也不会要求您在对话里输入明文密码。${username ? `当前用户名：${username}。` : ''}${tenantId ? `当前租户ID：${tenantId}。` : ''}${role ? `当前角色：${role}。` : ''}`;
  }

  if (USERNAME_PASSED_QUERY_RE.test(latestUserMessage)) {
    return username
      ? `是的，本次请求已传递您的用户名，当前用户名是 ${username}。`
      : '没有，本次请求里未提供您的用户名。';
  }

  if (USERNAME_QUERY_RE.test(latestUserMessage)) {
    directSections.push(
      username ? `您的用户名是 ${username}。` : '当前请求里未提供您的用户名。',
    );
  }

  if (ROLE_QUERY_RE.test(latestUserMessage)) {
    directSections.push(role ? `您当前的角色是 ${role}。` : '当前请求里未提供您的角色信息。');
  }

  if (TENANT_QUERY_RE.test(latestUserMessage)) {
    if (tenantName) {
      directSections.push(`您当前所在的租户是 ${tenantName}。`);
    } else if (tenantId) {
      directSections.push(`您当前所在的租户ID是 ${tenantId}。`);
    } else {
      directSections.push('当前请求里未提供您的租户信息。');
    }
  }

  const liveDataAnswer = includeLiveData
    ? buildLiveDataDirectAnswer(latestUserMessage, liveDataContext)
    : null;
  if (liveDataAnswer) {
    directSections.push(liveDataAnswer);
  }

  return directSections.length > 0 ? directSections.join('\n') : null;
}

function createSuccessResponse(payload = {}, content, provider = 'opencode') {
  return {
    success: true,
    data: {
      id: `chatcmpl_opencode_${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: String(payload.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
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
      provider,
    },
  };
}

function buildOpenCodePrompt(
  messages = [],
  liveDataContext = null,
  runtimeContext = {},
  runtimeToolContext = null,
  planningContext = null,
) {
  const minimalSessionHint =
    runtimeContext?.userId || runtimeContext?.tenantId
      ? {
          userId: runtimeContext?.userId || null,
          tenantId: runtimeContext?.tenantId || null,
        }
      : null;

  return buildOpenCodeAssetHubPrompt({
    messages,
    currentSessionHint: minimalSessionHint,
    runtimeToolContext,
    liveDataContext,
    planningContext,
    extraRules: [
      '对于“我的用户名是什么”“我是什么角色”“我当前在哪个租户”这类身份上下文问题，不要直接根据前端上下文猜测，必须优先调用 `get_current_auth_context`。',
      '前端传入的会话提示仅用于帮助你构造工具参数，不可替代 `get_current_auth_context` 的权威结果。',
      '如果问题明显需要综合分析、诊断、比较或跨模块判断，先按计划选择组合型工具，再补充必要的底层工具。',
      '回答复杂问题时，优先按“结论 -> 关键依据 -> 建议/下一步”的结构组织，不要只罗列接口返回。',
    ],
  });
}

function buildPlanningPrompt(messages = [], liveDataContext = null, runtimeContext = {}) {
  const minimalSessionHint =
    runtimeContext?.userId || runtimeContext?.tenantId
      ? {
          userId: runtimeContext?.userId || null,
          tenantId: runtimeContext?.tenantId || null,
        }
      : null;

  return buildOpenCodeAssetHubPlannerPrompt({
    messages,
    currentSessionHint: minimalSessionHint,
    liveDataContext,
  });
}

const opencodeService = {
  isAvailable() {
    return OPENCODE_ENABLED;
  },

  sanitizeMessages(messages) {
    if (!Array.isArray(messages)) {
      return [];
    }

    return messages
      .map(item => ({
        role: String(item?.role || '').trim(),
        content: extractText(item?.content).trim(),
      }))
      .filter(item => item.role && item.content);
  },

  normalizeReply(payload) {
    return extractText(payload).trim();
  },

  async createChatCompletion(payload = {}, tenantId = null, userId = null, authContext = null) {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'OpenCode server is not enabled (OPENCODE_SERVER_ENABLED=false)',
      };
    }

    const messages = this.sanitizeMessages(payload.messages);
    if (messages.length === 0) {
      return {
        success: false,
        error: 'messages不能为空',
      };
    }

    const runtimeContext = {
      tenantId: authContext?.tenantId ?? tenantId ?? null,
      userId: authContext?.userId ?? userId ?? null,
      username: authContext ? authContext.username || null : payload.user || payload.metadata?.username || null,
      realName: authContext
        ? authContext.realName || null
        : payload.metadata?.real_name || null,
      role: authContext ? authContext.role || null : payload.metadata?.role || null,
      tenantName: authContext ? authContext.tenantName || null : payload.metadata?.tenant_name || null,
      authHeader: authContext?.authHeader || null,
      departmentCode: authContext?.departmentCode || null,
      managedDepartments: Array.isArray(authContext?.managedDepartments)
        ? authContext.managedDepartments
        : [],
      enabledModules: Array.isArray(authContext?.enabledModules) ? authContext.enabledModules : [],
      isSuperAdmin: authContext?.isSuperAdmin === true,
    };

    let runtimeToolContext = null;
    try {
      const authRegistration = await aiRuntimeAuthStore.registerAuthContext(runtimeContext);
      if (authRegistration?.id) {
        const assethubContext = {
          _auth_context_id: authRegistration.id,
        };
        const effectiveTenantId =
          authRegistration.tenantId || runtimeContext.tenantId || payload.metadata?.tenant_id || null;
        if (effectiveTenantId) {
          assethubContext.tenant_id = effectiveTenantId;
        }
        runtimeToolContext = {
          toolRuntimeContext: {
            assethub: assethubContext,
          },
        };
      }
    } catch (error) {
      console.warn('[OpenCodeService] register runtime auth context failed:', error.message);
    }

    let planningPreviewContext = null;
    try {
      planningPreviewContext = await aiLiveDataContextService.buildLightContext({
        messages,
        authContext: runtimeContext,
      });
    } catch (error) {
      console.warn('[OpenCodeService] build light live data context failed:', error.message);
      planningPreviewContext = null;
    }

    let planningContext = null;
    const preferPlannedExecution = shouldUsePlannedExecution(messages, planningPreviewContext);
    if (preferPlannedExecution) {
      planningContext = buildDeterministicPlanningContext(messages, planningPreviewContext);
    }

    let liveDataContext = null;
    const preferBackendCompositeDirectAnswer = shouldPreferBackendCompositeDirectAnswer(
      planningPreviewContext,
    );
    const skipFullLiveDataContext = shouldSkipFullLiveDataContext(
      planningContext,
      planningPreviewContext,
    ) && !preferBackendCompositeDirectAnswer;
    if (skipFullLiveDataContext) {
      liveDataContext = planningPreviewContext;
    } else {
      try {
        liveDataContext = await aiLiveDataContextService.buildContext({
          messages,
          authContext: runtimeContext,
        });
      } catch (error) {
        console.warn('[OpenCodeService] build live data context failed:', error.message);
        liveDataContext = planningPreviewContext;
      }
    }

    if (preferPlannedExecution) {
      if (!planningContext) {
        try {
          const planningPrompt = buildPlanningPrompt(messages, liveDataContext, runtimeContext);
          const planningReply = await opencodeServerManager.sendEphemeralMessage(
            planningPrompt,
            runtimeContext.tenantId || '0',
            runtimeContext.userId || 'anonymous',
          );
          planningContext = parsePlanningReply(planningReply);
        } catch (error) {
          console.warn('[OpenCodeService] planner stage failed:', error.message);
          planningContext = null;
        }
      }
    }

    const prompt = buildOpenCodePrompt(
      messages,
      liveDataContext,
      runtimeContext,
      runtimeToolContext,
      planningContext,
    );

    try {
      const reply = await opencodeServerManager.sendEphemeralMessage(
        prompt,
        runtimeContext.tenantId || '0',
        runtimeContext.userId || 'anonymous',
      );
      const sanitizedReply = sanitizeAssistantReply(reply);

      if (!sanitizedReply) {
        const fallbackReply = '我在。请再发一次，或直接告诉我想查询的资产、统计或当前登录信息。';
        return createSuccessResponse(payload, fallbackReply, 'opencode-fallback');
      }

      return createSuccessResponse(
        payload,
        sanitizedReply,
        planningContext ? 'opencode-planned' : 'opencode',
      );
    } catch (error) {
      if (error?.code === 'OPENCODE_EMPTY_MESSAGE') {
        const fallbackReply = '我在。请再发一次，或直接告诉我想查询的资产、统计或当前登录信息。';
        return createSuccessResponse(payload, fallbackReply, 'opencode-fallback');
      }

      console.error('[OpenCodeService] createChatCompletion error:', error);
      return {
        success: false,
        error: error.message || 'OpenCode API call failed',
        detail: {
          code: error?.code || null,
        },
      };
    }
  },

  createStreamingChatCompletion(payload = {}, tenantId = null, userId = null, authContext = null) {
    const chunks = [];
    let error = null;
    let finished = false;

    return {
      async start() {
        try {
          const result = await opencodeService.createChatCompletion(
            payload,
            tenantId,
            userId,
            authContext,
          );
          if (!result.success) {
            throw new Error(result.error || 'OpenCode API call failed');
          }

          const content = opencodeService.normalizeReply(result.data);
          if (content) {
            chunks.push(content);
          }
          finished = true;
        } catch (err) {
          error = err;
          finished = true;
        }
      },

      getChunks() {
        return chunks;
      },

      getFullContent() {
        return chunks.join('');
      },

      isFinished() {
        return finished;
      },

      getError() {
        return error;
      },
    };
  },

  async chatWithAI(message, tenantId = null, userId = null) {
    const result = await this.createChatCompletion(
      {
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: message }],
      },
      tenantId,
      userId,
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      reply: this.normalizeReply(result.data),
      runId: result.data?.id || null,
    };
  },

  getConfig() {
    return {
      enabled: this.isAvailable(),
      provider: 'opencode',
      port: parseInt(process.env.OPENCODE_SERVER_PORT, 10) || 4096,
      host: process.env.OPENCODE_SERVER_HOST || '127.0.0.1',
      protocol: process.env.OPENCODE_SERVER_PROTOCOL || 'http',
      autostart: process.env.OPENCODE_SERVER_AUTOSTART !== 'false',
      sessionTTLHours: parseInt(process.env.OPENCODE_SESSION_TTL_HOURS, 10) || 24,
    };
  },

  async createSession(tenantId, userId, frontendSessionId = null) {
    await opencodeServerManager.ensureServerRunning();
    return opencodeServerManager.createSession(frontendSessionId, tenantId, userId);
  },

  async deleteSession(sessionId) {
    return opencodeServerManager.deleteSession(sessionId);
  },

  async getSessionMessages(sessionId) {
    return opencodeServerManager.getSessionMessages(sessionId);
  },

  async shutdown() {
    return opencodeServerManager.shutdown();
  },
};

module.exports = opencodeService;
