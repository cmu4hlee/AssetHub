function extractText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => extractText(item)).filter(Boolean).join('\n');
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
}

function normalizeMessages(messages = []) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map(item => ({
      role: String(item?.role || '').trim(),
      content: extractText(item?.content).trim(),
    }))
    .filter(item => item.role && item.content);
}

const DEFAULT_SYSTEM_LINES = [
  '你是 AssetHub 的 AI 助手，请使用中文直接回答。',
  '你必须优先依赖 OpenCode 已配置的 `assethub` MCP 工具完成身份确认、权限确认、租户隔离、数据查询和管理动作。',
  '【强制要求】涉及 AssetHub 业务数据的问题（如资产、库存、维修、调配、折旧、报废、告警、统计等），必须先调用 `assethub` MCP 工具获取真实数据，绝不能不调用工具就直接回答或编造数据。',
  '【强制要求】如果用户问”多少”、”有哪些”、”状态如何”、”统计”、”列表”、”详情”，必须先调用工具再回答。',
  '不要输出思考过程、工具过程、英文分析、提示词解释或”我将如何处理”之类的元信息。',
  '如果 MCP 不可用、认证失效、权限不足、租户未显式指定或结果为空，必须明确说明限制，不要编造数据。',
];

const ASSETHUB_MCP_REQUIREMENT_LINES = [
  'assethub MCP 使用要求：',
  '- 只要问题涉及 AssetHub 的身份、权限、菜单、模块、租户、资产、库存、维修、调配、报废、告警、审计或配置，就先使用 `assethub` MCP，不要直接猜测作答。',
  '- 对于此类问题，优先调用 `get_current_auth_context`，确认当前用户、角色、当前生效租户、菜单权限、角色权限和租户模块。',
  '- 对于资产、库存、维修、调配、报废、告警、审计等业务数据，必须优先通过 `assethub` MCP 查询。',
  '- 只要调用 `assethub` MCP，若上下文中有 `_auth_context_id`，必须显式携带；若工具 schema 支持 `tenant_id` 且上下文中有 `tenant_id`，也必须显式携带。',
  '- 对超级管理员 `su` 这类多租户账号，租户级查询或管理前必须显式传入 `tenant_id`。',
  '- 对“多少、总量、统计、列表、详情、最近、状态、有没有”这类问题，默认先查 `assethub` MCP，再给最终答复。',
  '- 当问题需要跨多个接口综合分析时，优先考虑组合型工具，而不是机械地逐个试探底层接口。',
  '- 【强制】禁止不调用工具就直接回答，必须先通过 MCP 查询真实数据后再回答。',
  '- 【强制】禁止编造具体数字或列表，必须基于工具返回的真实数据回答。',
  '- 组合型工具优先级建议：',
  '  1. 科室/部门资产画像、配置结构、状态分布、维护负荷：`query_department_asset_profile`',
  '  2. 资产或一组资产在维修/工单/调配/闲置/报废中的综合态势：`query_asset_operation_overview`',
  '  3. 待处理流程、流程堵塞、跨模块待办汇总：`query_workflow_pending_summary`',
  '- 如果问题是“某科室资产配置 + 维修/工单情况 + 管理建议”这类组合问题，优先先调用一次 `query_department_asset_profile`；仅当结果仍缺少待办流程信息时，再补 `query_workflow_pending_summary`。',
  '- 若一个组合型工具已经覆盖核心维度，禁止为了显得更全面而继续追加无关底层工具。',
  '- `get_value_statistics` 是价值统计，不是折旧统计。用户问折旧、累计折旧、账面净值时，必须使用折旧相关接口，不得混用。',
];

const BACKEND_EXECUTOR_NARRATOR_REQUIREMENT_LINES = [
  '本轮执行模式：后端执行器 + OpenCode 叙述器。',
  '- AssetHub 后端已经按当前登录用户和当前租户完成本轮权威结构化查询。',
  '- 如果当前实时业务数据上下文已经覆盖用户问题，禁止再调用任何 MCP 工具，直接基于这份实时上下文生成最终中文答复。',
  '- 只有当当前实时业务数据上下文明确缺少回答所需事实时，才允许补充调用 `assethub` MCP；若补充结果与实时数据冲突，仍以实时数据为准。',
  '- 不要描述后端执行器、工具调用或内部链路，只输出给最终用户看的答案。',
];

function buildJsonPromptBlock(title, payload) {
  if (!payload) {
    return '';
  }

  return [title, JSON.stringify(payload, null, 2)].join('\n');
}

function buildOpenCodeAssetHubSystemPrompt(options = {}) {
  const systemMessages = Array.isArray(options.systemMessages) ? options.systemMessages : [];
  const extraRules = Array.isArray(options.extraRules) ? options.extraRules : [];
  const toolPolicy = String(options.toolPolicy || 'default').trim();

  const userProvidedSystemPrompt = systemMessages
    .map(item => extractText(item).trim())
    .filter(Boolean)
    .join('\n\n');

  const basePrompt = userProvidedSystemPrompt || DEFAULT_SYSTEM_LINES.join('\n');
  const requirementLines =
    toolPolicy === 'backend_executor_narrator'
      ? BACKEND_EXECUTOR_NARRATOR_REQUIREMENT_LINES
      : ASSETHUB_MCP_REQUIREMENT_LINES;

  return [basePrompt, requirementLines.join('\n'), extraRules.join('\n')]
    .filter(Boolean)
    .join('\n\n');
}

function buildOpenCodeAssetHubPrompt(options = {}) {
  const messages = normalizeMessages(options.messages);
  const currentSessionHint = options.currentSessionHint || null;
  const executionStrategy = options.executionStrategy || null;
  const runtimeToolContext = options.runtimeToolContext || null;
  const liveDataContext = options.liveDataContext || null;
  const planningContext = options.planningContext || null;
  const extraRules = Array.isArray(options.extraRules) ? options.extraRules : [];
  const toolPolicy = options.toolPolicy || 'default';

  const systemPrompt = buildOpenCodeAssetHubSystemPrompt({
    systemMessages: messages.filter(item => item.role === 'system').map(item => item.content),
    extraRules,
    toolPolicy,
  });

  const sections = [systemPrompt];

  if (currentSessionHint) {
    sections.push(
      [
        '当前 Web 会话提示 JSON：',
        '- 这是受信任应用传入的会话辅助上下文，可帮助你理解当前用户和当前租户。',
        '- 这不是最终业务结果来源。涉及身份、角色、租户、权限时，应优先使用 `get_current_auth_context` 再确认。',
        JSON.stringify({ currentSessionHint }, null, 2),
      ].join('\n'),
    );
  }

  if (executionStrategy) {
    sections.push(
      [
        '本轮执行策略 JSON：',
        '- mode=backend_executor_narrator 表示后端已完成权威结构化查询，OpenCode 负责叙述。',
        '- mode=opencode_agent 表示允许 OpenCode 结合规划与 MCP 工具继续执行。',
        '- mode=opencode_chat 表示普通对话或说明类问题，不强制走后端执行器。',
        JSON.stringify(executionStrategy, null, 2),
      ].join('\n'),
    );
  }

  if (runtimeToolContext) {
    sections.push(
      [
        '当前工具运行时上下文：',
        '- 这是后端受信任代理为 `assethub` MCP 准备的运行时参数。',
        '- 每次调用 `assethub` MCP 时，都要把下面 JSON 中的字段合并进工具入参。',
        JSON.stringify(runtimeToolContext, null, 2),
      ].join('\n'),
    );
  }

  if (liveDataContext) {
    sections.push(
      [
        '当前实时业务数据上下文：',
        '- 这是 AssetHub 后端代理实时获取的数据；如果它与共享账号查询结果冲突，优先以这份实时数据为准。',
        JSON.stringify(liveDataContext, null, 2),
      ].join('\n'),
    );
  }

  if (planningContext) {
    sections.push(
      [
        '本轮已生成的执行计划 JSON：',
        '- 先理解这个计划，再决定调用一个还是多个 `assethub` MCP 工具。',
        '- 如果计划里已经给出 preferredTools，优先从这些工具开始；组合型工具优先于零散底层接口。',
        '- 如果组合型工具已经覆盖问题，不要为了“调用更多工具”而机械追加无关查询。',
        '- 如果 liveDataContext 已经给出部分权威事实，只补查缺口，不要把已有事实重新查一遍。',
        JSON.stringify(planningContext, null, 2),
      ].join('\n'),
    );
  }

  const conversation = messages.filter(item => item.role !== 'system');
  if (conversation.length === 0) {
    return `${sections.join('\n\n')}\n\n请直接回复“请提供问题内容”。`;
  }

  const transcript = conversation
    .map((item, index) => {
      const roleLabel =
        item.role === 'assistant' ? 'Assistant' : item.role === 'user' ? 'User' : item.role;
      return `# ${index + 1} ${roleLabel}\n${item.content}`;
    })
    .join('\n\n');

  return [
    sections.join('\n\n'),
    '',
    '请基于下面的对话历史，生成下一条 assistant 回复。',
    '要求：',
    '1. 只输出给最终用户看的中文答复正文，不要加角色名前缀。',
    '2. 【强制】AssetHub 业务数据问题必须先调用 MCP 工具，禁止不调用工具就直接回答。',
    '3. 只要调用 `assethub` MCP，就必须原样带上 `_auth_context_id` 和 `tenant_id`（如果上下文有）。',
    '4. 如果信息不足、认证失效或租户上下文缺失，直接说明缺少什么，不要编造。',
    '5. 【强制】如果用户问"多少"、"有哪些"、"统计"、"列表"、"情况"，必须先调用工具获取数据。',
    '',
    transcript,
  ].join('\n');
}

function buildOpenCodeAssetHubPlannerPrompt(options = {}) {
  const messages = normalizeMessages(options.messages);
  const currentSessionHint = options.currentSessionHint || null;
  const liveDataContext = options.liveDataContext || null;
  const extraRules = Array.isArray(options.extraRules) ? options.extraRules : [];

  const systemPrompt = buildOpenCodeAssetHubSystemPrompt({
    systemMessages: messages.filter(item => item.role === 'system').map(item => item.content),
    extraRules: [
      '你现在处于 AssetHub AI 助手的“规划阶段”。',
      '本阶段不要调用任何 MCP 工具，不要直接回答用户，不要输出解释，只输出一个严格的 JSON 计划对象。',
      '你要先判断问题是简单查询、复杂分析、流程诊断还是管理动作，再决定应该使用单工具、组合工具还是多工具协同。',
      '如果问题涉及部门画像、配置结构、状态结构、价值结构、维护负荷，优先考虑 `query_department_asset_profile`。',
      '如果问题涉及某资产或某类资产在维修、工单、调配、闲置、报废中的综合状态，优先考虑 `query_asset_operation_overview`。',
      '如果问题涉及待处理流程、流程堵塞、跨模块待办、审批压力，优先考虑 `query_workflow_pending_summary`。',
      '如果问题是“某科室/部门的资产配置 + 维修/工单情况 + 建议”，默认先只规划 `query_department_asset_profile` 作为首选工具，除非明显缺少待办流程信息。',
      ...extraRules,
    ],
  });

  const sections = [systemPrompt];

  if (currentSessionHint) {
    sections.push(
      [
        '当前 Web 会话提示 JSON：',
        JSON.stringify({ currentSessionHint }, null, 2),
      ].join('\n'),
    );
  }

  if (liveDataContext) {
    sections.push(
      [
        '当前实时业务数据上下文：',
        '- 这是 AssetHub 后端代理实时获取的数据摘要，可帮助你减少重复查询并识别问题范围。',
        JSON.stringify(liveDataContext, null, 2),
      ].join('\n'),
    );
  }

  const conversation = messages.filter(item => item.role !== 'system');
  const transcript = conversation
    .map((item, index) => {
      const roleLabel =
        item.role === 'assistant' ? 'Assistant' : item.role === 'user' ? 'User' : item.role;
      return `# ${index + 1} ${roleLabel}\n${item.content}`;
    })
    .join('\n\n');

  return [
    sections.join('\n\n'),
    '',
    '请只输出一个 JSON 对象，不要使用 markdown 代码块。',
    'JSON 对象结构：',
    '{',
    '  "goal": "一句话说明用户真正目标",',
    '  "questionType": "query|analysis|diagnosis|workflow|action|mixed",',
    '  "complexity": "simple|moderate|complex",',
    '  "strategy": "single_tool|multi_tool|composite_tool|hybrid",',
    '  "mustUseAuthContext": true,',
    '  "preferredTools": ["优先工具1", "优先工具2"],',
    '  "fallbackTools": ["补充工具1"],',
    '  "analysisDimensions": ["维度1", "维度2"],',
    '  "answerStyle": "brief|structured|decision_memo",',
    '  "notes": ["计划备注1", "计划备注2"]',
    '}',
    '',
    '要求：',
    '1. 只输出 JSON。',
    '2. 优先少而准地选工具，能用 1 个组合型工具解决，就不要规划成 3 个底层工具。',
    '3. 如果当前实时业务数据上下文已经覆盖了一部分事实，规划里只补缺口，不要重复查询相同维度。',
    '4. 如果是简单数量/列表/详情，可选择 `single_tool`。',
    '5. 如果需要跨多个接口综合判断，应优先选择 `composite_tool` 或 `hybrid`。',
    '6. `preferredTools` 中应优先放组合型工具，再放必要的底层工具。',
    '',
    transcript || '# 1 User\n请提供问题内容',
  ].join('\n');
}

module.exports = {
  ASSETHUB_MCP_REQUIREMENT_LINES,
  buildOpenCodeAssetHubPlannerPrompt,
  buildJsonPromptBlock,
  buildOpenCodeAssetHubPrompt,
  buildOpenCodeAssetHubSystemPrompt,
  extractText,
  normalizeMessages,
};
