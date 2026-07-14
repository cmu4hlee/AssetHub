const { randomUUID } = require('crypto');
const db = require('../config/database');
const gatewayAIService = require('./gateway-ai-service');

const AGENT_IDS = {
  ASSET_LEDGER: 'asset_ledger',
  MAINTENANCE: 'maintenance',
  QUALITY_COMPLIANCE: 'quality_compliance',
  IOT: 'iot',
  COST_DEPRECIATION: 'cost_depreciation',
  COORDINATOR: 'coordinator',
};

const AGENT_DEFINITIONS = {
  [AGENT_IDS.ASSET_LEDGER]: {
    id: AGENT_IDS.ASSET_LEDGER,
    name: '资产台账代理',
    role: '负责资产主数据、台账状态、资产检索与生命周期节点识别',
    keywords: ['资产', '台账', '入库', '调拨', '报废', 'asset'],
  },
  [AGENT_IDS.MAINTENANCE]: {
    id: AGENT_IDS.MAINTENANCE,
    name: '维保代理',
    role: '负责报修、工单、维保成本和维护执行状态分析',
    keywords: ['维保', '维修', '保养', '工单', '报修', 'maintenance'],
  },
  [AGENT_IDS.QUALITY_COMPLIANCE]: {
    id: AGENT_IDS.QUALITY_COMPLIANCE,
    name: '质控合规代理',
    role: '负责验收、计量、不良事件与合规执行情况检查',
    keywords: ['质控', '合规', '验收', '计量', '不良', 'compliance', 'quality'],
  },
  [AGENT_IDS.IOT]: {
    id: AGENT_IDS.IOT,
    name: 'IoT代理',
    role: '负责设备在线状态、定位告警和物联网运行健康检查',
    keywords: ['iot', '物联', '传感器', '定位', '告警', '在线'],
  },
  [AGENT_IDS.COST_DEPRECIATION]: {
    id: AGENT_IDS.COST_DEPRECIATION,
    name: '成本折旧代理',
    role: '负责维修成本、资产折旧和财务口径汇总分析',
    keywords: ['成本', '折旧', '财务', '预算', '净值', 'depreciation'],
  },
  [AGENT_IDS.COORDINATOR]: {
    id: AGENT_IDS.COORDINATOR,
    name: '协调代理',
    role: '负责意图路由、多代理协同编排与统一结论生成',
    keywords: ['协调', '协同', '汇总', '联动', 'mesh', 'agent'],
  },
};

const MESH_EDGES = [
  { from: AGENT_IDS.COORDINATOR, to: AGENT_IDS.ASSET_LEDGER, type: 'dispatch' },
  { from: AGENT_IDS.COORDINATOR, to: AGENT_IDS.MAINTENANCE, type: 'dispatch' },
  { from: AGENT_IDS.COORDINATOR, to: AGENT_IDS.QUALITY_COMPLIANCE, type: 'dispatch' },
  { from: AGENT_IDS.COORDINATOR, to: AGENT_IDS.IOT, type: 'dispatch' },
  { from: AGENT_IDS.COORDINATOR, to: AGENT_IDS.COST_DEPRECIATION, type: 'dispatch' },
  { from: AGENT_IDS.ASSET_LEDGER, to: AGENT_IDS.COORDINATOR, type: 'feedback' },
  { from: AGENT_IDS.MAINTENANCE, to: AGENT_IDS.COORDINATOR, type: 'feedback' },
  { from: AGENT_IDS.QUALITY_COMPLIANCE, to: AGENT_IDS.COORDINATOR, type: 'feedback' },
  { from: AGENT_IDS.IOT, to: AGENT_IDS.COORDINATOR, type: 'feedback' },
  { from: AGENT_IDS.COST_DEPRECIATION, to: AGENT_IDS.COORDINATOR, type: 'feedback' },
];

const conversations = new Map();

const normalizeTenantId = tenantId => {
  const parsed = Number.parseInt(String(tenantId ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeMessage = message => String(message || '').trim().toLowerCase();

const includesKeyword = (normalizedMessage, keywords = []) =>
  keywords.some(keyword => normalizedMessage.includes(String(keyword).toLowerCase()));

const selectAgents = message => {
  const normalizedMessage = normalizeMessage(message);
  const selected = [AGENT_IDS.COORDINATOR];

  Object.values(AGENT_DEFINITIONS).forEach(agent => {
    if (agent.id === AGENT_IDS.COORDINATOR) {
      return;
    }
    if (includesKeyword(normalizedMessage, agent.keywords)) {
      selected.push(agent.id);
    }
  });

  if (selected.length === 1) {
    selected.push(AGENT_IDS.ASSET_LEDGER);
  }

  return [...new Set(selected)];
};

const extractAssetCode = message => {
  const text = String(message || '');
  const directCode = text.match(/\b[A-Za-z0-9-]{4,24}\b/);
  return directCode ? directCode[0] : '';
};

const safeRows = async (sql, params = []) => {
  try {
    const [rows] = await db.execute(sql, params);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    // 某些租户可能尚未初始化全部模块表，降级为空结果以保障 mesh 可用性。
    if (['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_PARSE_ERROR'].includes(error.code)) {
      return [];
    }
    throw error;
  }
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const buildTenantCondition = tenantId => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) {
    return {
      condition: '',
      params: [],
    };
  }
  return {
    condition: ' AND tenant_id = ?',
    params: [normalizedTenantId],
  };
};

const getAssetLedgerSnapshot = async ({ tenantId, message }) => {
  const tenantFilter = buildTenantCondition(tenantId);
  const [overview] = await safeRows(
    `SELECT
       COUNT(*) AS total_assets,
       SUM(CASE WHEN status IN ('闲置', 'idle') THEN 1 ELSE 0 END) AS idle_assets,
       SUM(CASE WHEN status IN ('在用', 'active', '使用中') THEN 1 ELSE 0 END) AS active_assets
     FROM assets
     WHERE 1=1 ${tenantFilter.condition}`,
    tenantFilter.params,
  );

  const assetCode = extractAssetCode(message);
  let asset = null;
  if (assetCode) {
    const rows = await safeRows(
      `SELECT id, asset_code, asset_name, department_new AS department, status, location, purchase_date
       FROM assets
       WHERE (asset_code = ? OR id = ?)${tenantFilter.condition}
       ORDER BY updated_at DESC
       LIMIT 1`,
      [assetCode, assetCode, ...tenantFilter.params],
    );
    asset = rows[0] || null;
  }

  return {
    metrics: {
      total_assets: toNumber(overview?.total_assets),
      idle_assets: toNumber(overview?.idle_assets),
      active_assets: toNumber(overview?.active_assets),
    },
    focus_asset: asset,
  };
};

const getMaintenanceSnapshot = async ({ tenantId }) => {
  const tenantFilter = buildTenantCondition(tenantId);
  const [pendingRequest] = await safeRows(
    `SELECT COUNT(*) AS pending_requests
     FROM maintenance_requests
     WHERE status IN ('pending', 'pending_review', 'approved')${tenantFilter.condition}`,
    tenantFilter.params,
  );
  const [openWorkorder] = await safeRows(
    `SELECT COUNT(*) AS open_workorders
     FROM maintenance_workorders
     WHERE status NOT IN ('completed', 'cancelled', 'closed')${tenantFilter.condition}`,
    tenantFilter.params,
  );
  const [monthCost] = await safeRows(
    `SELECT ROUND(COALESCE(SUM(COALESCE(maintenance_cost, 0)), 0), 2) AS month_maintenance_cost
     FROM maintenance_logs
     WHERE DATE_FORMAT(COALESCE(maintenance_date, created_at), '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
       ${tenantFilter.condition}`,
    tenantFilter.params,
  );

  return {
    metrics: {
      pending_requests: toNumber(pendingRequest?.pending_requests),
      open_workorders: toNumber(openWorkorder?.open_workorders),
      month_maintenance_cost: toNumber(monthCost?.month_maintenance_cost),
    },
  };
};

const getQualityComplianceSnapshot = async ({ tenantId }) => {
  const tenantFilter = buildTenantCondition(tenantId);
  const [acceptance] = await safeRows(
    `SELECT COUNT(*) AS acceptance_records
     FROM asset_acceptance_records
     WHERE 1=1${tenantFilter.condition}`,
    tenantFilter.params,
  );
  const [metrology] = await safeRows(
    `SELECT COUNT(*) AS metrology_records
     FROM metrology_records
     WHERE 1=1${tenantFilter.condition}`,
    tenantFilter.params,
  );
  const [adverse] = await safeRows(
    `SELECT COUNT(*) AS adverse_records
     FROM adverse_reaction_records
     WHERE 1=1${tenantFilter.condition}`,
    tenantFilter.params,
  );

  return {
    metrics: {
      acceptance_records: toNumber(acceptance?.acceptance_records),
      metrology_records: toNumber(metrology?.metrology_records),
      adverse_records: toNumber(adverse?.adverse_records),
    },
  };
};

const getIoTSnapshot = async ({ tenantId }) => {
  const tenantFilter = buildTenantCondition(tenantId);
  const [deviceTotal] = await safeRows(
    `SELECT COUNT(*) AS total_devices
     FROM iot_devices
     WHERE 1=1${tenantFilter.condition}`,
    tenantFilter.params,
  );
  const [online] = await safeRows(
    `SELECT COUNT(*) AS online_devices
     FROM iot_devices
     WHERE status IN ('在线', 'online')${tenantFilter.condition}`,
    tenantFilter.params,
  );
  const [alertTotal] = await safeRows(
    `SELECT COUNT(*) AS pending_alerts
     FROM location_alerts
     WHERE is_handled = 0${tenantFilter.condition}`,
    tenantFilter.params,
  );

  return {
    metrics: {
      total_devices: toNumber(deviceTotal?.total_devices),
      online_devices: toNumber(online?.online_devices),
      pending_alerts: toNumber(alertTotal?.pending_alerts),
    },
  };
};

const getCostDepreciationSnapshot = async ({ tenantId }) => {
  const tenantFilter = buildTenantCondition(tenantId);
  const [depreciable] = await safeRows(
    `SELECT COUNT(*) AS depreciable_assets
     FROM assets
     WHERE COALESCE(depreciation_years, 0) > 0${tenantFilter.condition}`,
    tenantFilter.params,
  );
  const [purchase] = await safeRows(
    `SELECT ROUND(COALESCE(SUM(COALESCE(purchase_price, 0)), 0), 2) AS purchase_total
     FROM assets
     WHERE 1=1${tenantFilter.condition}`,
    tenantFilter.params,
  );
  const [maintenanceCost] = await safeRows(
    `SELECT ROUND(COALESCE(SUM(COALESCE(maintenance_cost, 0)), 0), 2) AS maintenance_cost_total
     FROM maintenance_logs
     WHERE 1=1${tenantFilter.condition}`,
    tenantFilter.params,
  );

  return {
    metrics: {
      depreciable_assets: toNumber(depreciable?.depreciable_assets),
      purchase_total: toNumber(purchase?.purchase_total),
      maintenance_cost_total: toNumber(maintenanceCost?.maintenance_cost_total),
    },
  };
};

const agentHandlers = {
  [AGENT_IDS.ASSET_LEDGER]: getAssetLedgerSnapshot,
  [AGENT_IDS.MAINTENANCE]: getMaintenanceSnapshot,
  [AGENT_IDS.QUALITY_COMPLIANCE]: getQualityComplianceSnapshot,
  [AGENT_IDS.IOT]: getIoTSnapshot,
  [AGENT_IDS.COST_DEPRECIATION]: getCostDepreciationSnapshot,
};

const buildCoordinatorOutput = agentOutputs => {
  const maintenanceMetrics = agentOutputs[AGENT_IDS.MAINTENANCE]?.metrics || {};
  const qualityMetrics = agentOutputs[AGENT_IDS.QUALITY_COMPLIANCE]?.metrics || {};
  const iotMetrics = agentOutputs[AGENT_IDS.IOT]?.metrics || {};
  const costMetrics = agentOutputs[AGENT_IDS.COST_DEPRECIATION]?.metrics || {};

  const highlights = [];
  const nextActions = [];

  if (toNumber(maintenanceMetrics.pending_requests) > 0) {
    highlights.push(`存在 ${maintenanceMetrics.pending_requests} 条待处理报修请求`);
    nextActions.push('优先清理待处理报修，并同步评估高价值资产可用性');
  }

  if (toNumber(iotMetrics.pending_alerts) > 0) {
    highlights.push(`IoT 有 ${iotMetrics.pending_alerts} 条未处理定位告警`);
    nextActions.push('将告警资产与维保工单联动，减少资产离线时长');
  }

  if (toNumber(qualityMetrics.metrology_records) > 0) {
    highlights.push(`计量记录总量 ${qualityMetrics.metrology_records} 条`);
  }

  if (toNumber(costMetrics.maintenance_cost_total) > 0) {
    highlights.push(`累计维修成本 ${costMetrics.maintenance_cost_total} 元`);
  }

  if (highlights.length === 0) {
    highlights.push('当前未识别到显著风险项，建议继续常规巡检');
  }

  return {
    metrics: {
      participating_agents: Object.keys(agentOutputs).length,
    },
    highlights,
    next_actions: nextActions,
  };
};

const createFallbackResponse = ({ selectedAgents, agentOutputs, coordinatorOutput }) => {
  const lines = [];
  const selectedNames = selectedAgents
    .map(agentId => AGENT_DEFINITIONS[agentId]?.name)
    .filter(Boolean)
    .join('、');

  lines.push(`已启动 Agent Mesh 协同：${selectedNames}`);

  selectedAgents.forEach(agentId => {
    if (agentId === AGENT_IDS.COORDINATOR) {
      return;
    }
    const agentDef = AGENT_DEFINITIONS[agentId];
    const metrics = agentOutputs[agentId]?.metrics || {};
    const metricText = Object.entries(metrics)
      .map(([key, value]) => `${key}=${value}`)
      .join('，');

    lines.push(`${agentDef.name}：${metricText || '无可用指标'}`);
  });

  if (coordinatorOutput?.highlights?.length > 0) {
    lines.push(`协调结论：${coordinatorOutput.highlights.join('；')}`);
  }
  if (coordinatorOutput?.next_actions?.length > 0) {
    lines.push(`建议动作：${coordinatorOutput.next_actions.join('；')}`);
  }

  return lines.join('\n');
};

const callCoordinatorLLM = async ({ message, selectedAgents, agentOutputs, coordinatorOutput, history = [] }) => {
  const gatewayConfig = gatewayAIService.getConfig();
  if (!gatewayConfig?.enabled) {
    return null;
  }

  const payload = {
    user_message: message,
    selected_agents: selectedAgents.map(agentId => ({
      id: agentId,
      name: AGENT_DEFINITIONS[agentId]?.name || agentId,
      role: AGENT_DEFINITIONS[agentId]?.role || '',
    })),
    agent_outputs: agentOutputs,
    coordinator_output: coordinatorOutput,
    recent_history: history.slice(-6),
  };

  const prompt = `你是资产管理系统的协调代理。请基于以下多代理结果给出“统一结论 + 可执行建议”。
要求：
1) 用中文，200字以内；
2) 优先描述风险和优先级；
3) 必须引用至少2个代理结果；
4) 如果数据不足，明确说明缺口而非臆测。

输入数据：
${JSON.stringify(payload, null, 2)}`;

  const result = await gatewayAIService.chatWithAI(prompt, 40, 1500);
  if (!result.success || !result.reply) {
    return null;
  }

  return String(result.reply).trim();
};

const getTopology = () => ({
  version: '1.0.0',
  name: 'AssetHub Agent Mesh',
  nodes: Object.values(AGENT_DEFINITIONS),
  edges: MESH_EDGES,
});

const initConversation = ({ tenantId, userId } = {}) => {
  const conversationId = randomUUID();
  const now = new Date().toISOString();
  conversations.set(conversationId, {
    id: conversationId,
    tenantId: normalizeTenantId(tenantId),
    userId: userId || null,
    createdAt: now,
    updatedAt: now,
    history: [],
  });

  return {
    success: true,
    conversationId,
    topology: getTopology(),
    message:
      'Agent Mesh 已就绪：资产台账代理、维保代理、质控合规代理、IoT代理、成本折旧代理、协调代理。',
  };
};

const sendMessage = async ({ conversationId, message, tenantId, userId, context = {}, history = [] } = {}) => {
  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) {
    return { success: false, message: '消息不能为空' };
  }

  let conversation = conversations.get(conversationId);
  if (!conversation) {
    const initResult = initConversation({ tenantId, userId });
    conversation = conversations.get(initResult.conversationId);
  }

  const resolvedTenantId = normalizeTenantId(tenantId) || conversation.tenantId || null;
  if (!resolvedTenantId) {
    return { success: false, message: '当前用户未分配企业空间' };
  }

  const selectedAgents = selectAgents(normalizedMessage);

  const requestedAgents = selectedAgents.filter(agentId => agentId !== AGENT_IDS.COORDINATOR);
  const outputEntries = await Promise.all(
    requestedAgents.map(async agentId => {
      const handler = agentHandlers[agentId];
      if (!handler) {
        return [agentId, { metrics: {}, message: 'handler_not_configured' }];
      }
      const result = await handler({ tenantId: resolvedTenantId, message: normalizedMessage, context });
      return [agentId, result];
    }),
  );
  const agentOutputs = Object.fromEntries(outputEntries);
  const coordinatorOutput = buildCoordinatorOutput(agentOutputs);

  let response = await callCoordinatorLLM({
    message: normalizedMessage,
    selectedAgents,
    agentOutputs,
    coordinatorOutput,
    history: history.length > 0 ? history : conversation.history,
  });
  if (!response) {
    response = createFallbackResponse({ selectedAgents, agentOutputs, coordinatorOutput });
  }

  const now = new Date().toISOString();
  conversation.history.push(
    { role: 'user', content: normalizedMessage, timestamp: now },
    { role: 'assistant', content: response, timestamp: now },
  );
  conversation.updatedAt = now;

  return {
    success: true,
    conversationId: conversation.id,
    response,
    selectedAgents,
    agentOutputs,
    coordinatorOutput,
    topology: getTopology(),
  };
};

module.exports = {
  initConversation,
  sendMessage,
  getTopology,
  internals: {
    AGENT_IDS,
    AGENT_DEFINITIONS,
    selectAgents,
    buildCoordinatorOutput,
    createFallbackResponse,
  },
};
