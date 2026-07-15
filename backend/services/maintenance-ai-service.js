const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const gatewayAIService = require('./gateway-ai-service');
const {
  extractFieldsFromAIResponse,
  validateFormData,
  generateFieldPrompt,
  REQUIRED_BY_INTENT,
  FIELD_LABELS,
} = require('./ai-helper-service');

const OPENCLAW_SKILL_NAME = 'assethub';
const OPENCLAW_SKILL_FALLBACK = 'assetclaw';

const maintenanceAIService = {
  conversations: new Map(),
  assetCache: new Map(),

  async initConversation({ type = 'maintenance', userId, tenantId }) {
    try {
      const conversationId = uuidv4();

      const conversationsDir = path.join(__dirname, '../conversations');
      if (!fs.existsSync(conversationsDir)) {
        fs.mkdirSync(conversationsDir, { recursive: true });
      }

      this.conversations.set(conversationId, {
        id: conversationId,
        type,
        userId,
        tenantId,
        createdAt: new Date().toISOString(),
        messages: [],
        context: {},
        status: 'active',
      });

      const pendingRequests = await this.getPendingRequests(tenantId);
      const systemPrompt = this.getSystemPrompt(type);

      const welcomeMessage =
        '您好！我是资产助手，可办理：维修日志、资产调配、资产报修、闲置发布、报废申请、盘点查询与发起盘点；也可查资产、待办、报修历史、维护计划、维修统计；质量管理可查验收记录、技术资料、不良事件、计量记录（支持按资产查）；还可查当前企业、部门与资产。说「帮助」或「质量管理」可看全部能力。请直接说需求或资产编号。';

      const hasPending =
        (pendingRequests.repairs?.length || 0) > 0 || (pendingRequests.transfers?.length || 0) > 0;
      let extraInfo = '';
      if (hasPending) {
        const parts = [];
        if (pendingRequests.repairs?.length > 0)
          parts.push(`${pendingRequests.repairs.length} 条待办报修`);
        if (pendingRequests.transfers?.length > 0)
          parts.push(`${pendingRequests.transfers.length} 条待审批调配`);
        extraInfo = `\n\n您当前有 ${parts.join('、')}。可说「待办」查看详情；系统管理员可说「通过第一条」或「通过调配 5」直接审批调配。`;
      } else {
        extraInfo = '\n\n请直接说需求或资产编号。';
      }

      this.conversations.get(conversationId).messages.push({
        role: 'assistant',
        content: welcomeMessage + extraInfo,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        conversationId,
        message: welcomeMessage + extraInfo,
        pendingRequests: hasPending ? pendingRequests : null,
      };
    } catch (error) {
      console.error('初始化对话失败:', error);
      return { success: false, message: `初始化对话失败: ${error.message}` };
    }
  },

  async sendMessage({
    conversationId,
    message,
    context = {},
    history = [],
    tenantId,
    isSuperAdmin = false,
    role = 'user',
    managedDepartments = [],
    approverName = '用户',
    username = '',
    realName = '',
    tenantName = '',
    departmentCode = '',
    enabledModules = [],
    authHeader = '',
  }) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return { success: false, message: '对话不存在或已过期' };
    }

    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    conversation.messages.push(userMessage);

    try {
      const shortHistory = history.slice(-10);
      const aiInput = this.buildAIInput(
        message,
        shortHistory,
        context,
        tenantId,
        isSuperAdmin,
        role,
        managedDepartments,
        approverName,
      );

      const result = await gatewayAIService.createChatCompletion({
        model: 'openclaw',
        session_id: conversationId,
        conversation_id: conversationId,
        user: username || undefined,
        messages: [{ role: 'user', content: aiInput }],
        auth_context: {
          auth_header: authHeader || undefined,
          tenant_id: tenantId || undefined,
          username: username || undefined,
          real_name: realName || approverName || undefined,
          role: role || undefined,
          tenant_name: tenantName || undefined,
          department_code: departmentCode || undefined,
          managed_departments: Array.isArray(managedDepartments) ? managedDepartments : [],
          enabled_modules: Array.isArray(enabledModules) ? enabledModules : [],
          is_super_admin: isSuperAdmin === true ? true : undefined,
        },
        metadata: {
          assistant_skill: OPENCLAW_SKILL_NAME,
          assistant_skill_fallback: OPENCLAW_SKILL_FALLBACK,
          tenant_id: tenantId || undefined,
          username: username || undefined,
          real_name: realName || approverName || undefined,
          role: role || undefined,
          tenant_name: tenantName || undefined,
          department_code: departmentCode || undefined,
          managed_departments: Array.isArray(managedDepartments) ? managedDepartments : [],
          enabled_modules: Array.isArray(enabledModules) ? enabledModules : [],
          is_super_admin: isSuperAdmin === true ? true : undefined,
          client_session_id: conversationId,
        },
      });

      if (!result.success) {
        throw new Error(result.error || 'AI服务调用失败');
      }

      const aiResponse = gatewayAIService.normalizeReply(result.data);
      const assistantMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString(),
      };
      conversation.messages.push(assistantMessage);

      const extractedFields = extractFieldsFromAIResponse(aiResponse);
      const newContext = this.mergeContext(context, extractedFields);
      const intent = this.detectIntent(message, aiResponse, context);
      const currentForm = this.buildFormData(intent, newContext, extractedFields);

      const validationResult = validateFormData(currentForm, intent);
      let promptMessage = '';
      if (!validationResult.isValid && validationResult.missingFields.length > 0) {
        promptMessage = generateFieldPrompt(validationResult.missingFields);
      }

      let assetLookup = null;
      if (intent === 'asset_query' && !extractedFields.asset_code) {
        const keyword = this.extractAssetKeyword(message);
        if (keyword) {
          assetLookup = { keyword, intent: 'asset_query' };
          newContext.assetSearchResults = { keyword, list: [] };
        }
      }

      return {
        success: true,
        response: aiResponse,
        intent,
        maintenanceForm: currentForm,
        context: newContext,
        promptMessage,
        validationResult,
        assetLookup,
      };
    } catch (error) {
      console.error('AI处理失败:', error);
      conversation.messages.push({
        role: 'assistant',
        content: `抱歉，处理您的请求时出现错误：${error.message}。请稍后重试或换个方式描述需求。`,
        timestamp: new Date().toISOString(),
      });
      return { success: false, message: error.message };
    }
  },

  async getPendingRequests(tenantId) {
    try {
      const db = require('../config/database');
      const [repairs] = await db.execute(
        `SELECT id, request_no, asset_code, fault_description, status, request_date, request_department, contact_phone
         FROM maintenance_requests
         WHERE tenant_id = ? AND status IN ('待审批', '已批准', '维修中')
         ORDER BY created_at DESC LIMIT 20`,
        [tenantId],
      );

      let transfers;
      if (isNaN(parseInt(tenantId))) {
        transfers = [];
      } else {
        [transfers] = await db.execute(
          `SELECT t.id, t.asset_code, a.asset_name, t.current_department, t.target_department, t.reason, t.status, t.status_cn, t.transfer_date, t.applicant, t.created_at
           FROM asset_transfers t
           LEFT JOIN assets a ON t.asset_code = a.asset_code AND a.tenant_id = t.tenant_id AND a.is_deleted = 0
           WHERE t.tenant_id = ? AND t.status = 'pending'
           ORDER BY t.created_at DESC LIMIT 20`,
          [tenantId],
        );
      }

      return { repairs: repairs || [], transfers: transfers || [] };
    } catch (error) {
      console.error('获取待办请求失败:', error);
      return { repairs: [], transfers: [] };
    }
  },

  getSystemPrompt(type) {
    return `你是资产维修管理助手，你的职责是帮助用户完成资产维修相关的各类任务。

## 核心能力

### 1. 办理业务（需收集必填项后确认提交）
- **维修日志**：资产编号、维护类型、维护日期、维护人员、维护内容（必填）。可选填成本、时长、地点、部件、状态、备注、下次维护日期。
- **资产调配**：资产编号、调入部门、调配原因（必填）。
- **资产报修**：资产编号、故障描述（必填）。可选填故障级别、报修部门、联系电话、期望修复日期、备注。
- **闲置发布**：资产编号、发布人（必填）。可选填发布日期、备注。
- **报废申请**：资产编号、资产名称、申请人、报废原因（必填）。可选填预估残值、备注。

### 2. 查询信息（直接回复或引导用户操作）
- **查资产**：根据编号或关键词查资产信息。
- **待办/待审批**：查看待处理的报修单和调配单。
- **报修历史**：根据资产编号查报修历史。
- **维护计划**：查看资产维护计划。
- **维修统计**：查看维修统计数据。
- **验收记录**：查验收信息。
- **技术资料**：查技术资料。
- **不良事件**：查不良事件。
- **计量到期**：查计量到期提醒。
- **当前企业**：查当前企业信息。
- **部门资产**：查各部门资产分布。

### 3. 响应规则
- **首次问候**：简短介绍能力，提示可直接说需求或资产编号。
- **用户提问**：简短、友好地回答；不在能力范围内的建议看帮助。
- **识别到业务意图**：先友好确认意图，然后逐个询问必填项（不要一次问完所有），每收到一个回复就更新所填内容，填满后提示用户确认提交。
- **缺少必填项时**：根据上下文判断用户可能的值，友好地只问最关键的必填项。
- **必填项已填满**：在回复中列出所有已收集的信息，提示用户确认提交。
- **用户确认提交**：调用提交接口后反馈结果。
- **用户说「帮助」或「质量管理」**：列出能力说明或质量管理可查询的信息。

## 沟通风格
- 简短、口语化，避免冗长的系统提示。
- 用词专业但不晦涩。
- 保持友好、乐于助人的态度。
- 适当使用Emoji增加亲和力。
- 每次回复控制在合理长度，必要时可分段或使用列表。

## 重要提醒
- **不要重复**用户已提供的信息。
- **不要假设**用户需要某项功能，除非用户明确表示。
- **始终引导**用户回到资产维修相关的业务上来。
- **用户输入资产编号时**，优先查该资产信息，查到后提示用户可以继续做什么（如报修、查验收、查维修历史等）。
- **查资产时**，如果用户是资产管理员，只返回其管理科室的资产；如果是系统管理员，只返回其企业的资产；如果是超级管理员，返回全部资产。
- **处理调配审批时**，如果是系统管理员，可执行审批操作；其他用户只能查看待办列表并提示系统管理员审批。
- **查验收/不良事件/计量到期时**，支持按资产编号查询；如果用户只说「查验收」，则列出所有验收记录；如果用户提供资产编号，则列出该资产的验收记录。
- **查部门资产时**，按部门分组统计资产数量。`;
  },

  buildAIInput(
    userMessage,
    history,
    context,
    tenantId,
    isSuperAdmin,
    role,
    managedDepartments,
    approverName,
  ) {
    const contextInfo = `
## 当前上下文信息
- 用户角色: ${role}
${isSuperAdmin ? '- 用户是系统管理员，可执行审批操作' : ''}
${managedDepartments?.length > 0 ? `- 用户管理科室: ${managedDepartments.join(', ')}` : ''}
- 租户ID: ${tenantId || '未提供'}
${context?.currentIntent ? `- 当前业务类型: ${context.currentIntent}` : ''}
${context?.currentForm ? `- 已收集信息: ${JSON.stringify(context.currentForm)}` : ''}
${context?.pendingRequests ? `- 待办数量: 报修${context.pendingRequests.repairs?.length || 0}条, 调配${context.pendingRequests.transfers?.length || 0}条` : ''}
${context?.assetDetails ? `- 当前查看资产: ${context.assetDetails.asset_code || context.assetDetails.ASSET_CODE || '未知'}` : ''}`;

    const historyInfo =
      history.length > 0
        ? `
## 对话历史
${history.map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`).join('\n')}`
        : '';

    const lastAssistantMsg = history.filter(m => m.role === 'assistant').pop();
    let pendingQuestion = '';
    if (lastAssistantMsg?.content) {
      const missMatch = lastAssistantMsg.content.match(/还需要[:：]\s*([^\n]+)/);
      if (missMatch) {
        pendingQuestion = `\n## 待回答问题\n助手之前问用户还需要提供: ${missMatch[1]}\n请根据用户最新回复判断是否补充了这些信息。`;
      }
    }

    return `用户最新输入: ${userMessage}${contextInfo}${historyInfo}${pendingQuestion}

请分析用户意图，提取信息，并给出恰当的回复。

如果用户正在填写表单（维修日志/报修/调配/闲置/报废/盘点）：
- 提取用户回复中的表单字段
- 如果缺少必填项，只问最关键的必填项
- 如果必填项已填满，列出已收集信息并提示确认提交

如果用户想查询信息：
- 明确查询内容
- 如果需要更多条件，友好地询问

如果是系统管理员处理调配审批：
- 如果用户说「通过」或「同意」，确认调配信息后执行审批
- 如果用户说「拒绝」或「不同意」，询问拒绝原因后执行拒绝操作

请直接返回回复内容，不需要JSON。`;
  },

  detectIntent(userMessage, aiResponse, context) {
    const normalizedMsg = userMessage.toLowerCase();
    const intentPatterns = {
      maintenance_log: [
        '维修日志',
        '登记维修',
        '记录维修',
        '维护日志',
        '保养日志',
        '我要登记',
        '写日志',
        '登记保养',
      ],
      transfer: ['调配', '调部门', '转移', '调动', '资产调配', '我要调配', '部门调动'],
      repair_request: [
        '报修',
        '坏了',
        '故障',
        '维修申请',
        '我要报修',
        '需要维修',
        '坏了要修',
        '不制冷',
        '有故障',
      ],
      idle_publish: ['闲置', '发布闲置', '闲置资产', '对外发布', '我要发布闲置', '放到闲置库'],
      scrapping: ['报废', '申请报废', '资产报废', '我要报废', '不能用了'],
      asset_query: [
        '查资产',
        '查看资产',
        '搜索资产',
        '搜资产',
        '资产信息',
        '资产编号',
        '看资产',
        '找资产',
      ],
      pending_requests: ['待办', '待审批', '待处理', '有啥要批', '有待审批吗', '有什么要批'],
      inventory_query: ['盘点查询', '查盘点', '盘点记录', '历史盘点'],
      inventory_create: ['发起盘点', '创建盘点', '新建盘点', '开始盘点', '盘点什么'],
      repair_history: [
        '报修历史',
        '维修历史',
        '保养历史',
        '历史维修',
        '这台设备的维修记录',
        '这个资产的维修记录',
      ],
      maintenance_plan_query: ['维护计划', '保养计划', '维护到期', '计划维护', '定期保养'],
      maintenance_stats: ['维修统计', '保养统计', '维修分析', '统计维修', '维修情况'],
      acceptance_query: ['验收记录', '验收历史', '查验收', '历史验收'],
      technical_doc_query: ['技术资料', '文档', '说明书', '技术文档', '查资料'],
      adverse_event_query: ['不良事件', '不良反映', '事件记录', '查不良'],
      metrology_query: ['计量到期', '计量记录', '查计量', '计量检定'],
      org_query: ['当前企业', '企业信息', '租户信息', '公司信息'],
      department_query: ['部门资产', '各部门资产', '部门分布', '资产分布'],
      help: ['帮助', '你会做什么', '你有什么功能', '能力说明', '你能做什么'],
      quality_management: ['质量管理', '质量模块', '质管功能', '质量管理模块'],
    };

    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      if (patterns.some(p => normalizedMsg.includes(p.toLowerCase()))) {
        return intent;
      }
    }

    const singleAssetCodeMatch = userMessage.match(/^[A-Za-z0-9-]{3,20}$/);
    if (singleAssetCodeMatch && !context?.currentIntent) {
      return 'asset_query';
    }

    return context?.currentIntent || 'asset_query';
  },

  mergeContext(existingContext, newFields) {
    if (!existingContext) existingContext = {};
    if (!newFields || Object.keys(newFields).length === 0) return existingContext;

    const currentForm = existingContext.currentForm || {};
    const mergedForm = { ...currentForm, ...newFields };

    Object.keys(newFields).forEach(key => {
      const value = newFields[key];
      if (value !== undefined && value !== null && value !== '') {
        existingContext[key] = value;
      }
    });

    existingContext.currentForm = mergedForm;

    return existingContext;
  },

  buildFormData(intent, context, extractedFields) {
    const baseForm = context?.currentForm || {};

    switch (intent) {
      case 'maintenance_log':
        return {
          ...baseForm,
          asset_code: extractedFields.asset_code,
          maintenance_type: extractedFields.maintenance_type || '故障维修',
          maintenance_date: extractedFields.maintenance_date,
          maintenance_person: extractedFields.maintenance_person,
          maintenance_content: extractedFields.maintenance_content,
          maintenance_cost: extractedFields.maintenance_cost,
          maintenance_duration: extractedFields.maintenance_duration,
          maintenance_location: extractedFields.maintenance_location,
          parts_replaced: extractedFields.parts_replaced,
          status: extractedFields.status || '已完成',
          remark: extractedFields.remark,
          next_maintenance_date: extractedFields.next_maintenance_date,
        };

      case 'transfer':
        return {
          ...baseForm,
          asset_code: extractedFields.asset_code,
          from_department: extractedFields.from_department,
          to_department: extractedFields.to_department,
          transfer_date: extractedFields.transfer_date,
          reason: extractedFields.reason || extractedFields.transfer_reason,
        };

      case 'repair_request':
        return {
          ...baseForm,
          asset_code: extractedFields.asset_code,
          fault_description: extractedFields.fault_description,
          fault_level: extractedFields.fault_level,
          request_department: extractedFields.request_department,
          contact_phone: extractedFields.contact_phone,
          expected_repair_date: extractedFields.expected_repair_date,
          remark: extractedFields.remark,
        };

      case 'idle_publish':
        return {
          ...baseForm,
          asset_code: extractedFields.asset_code,
          publish_person: extractedFields.publish_person,
          publish_date: extractedFields.publish_date,
          remark: extractedFields.remark,
        };

      case 'scrapping':
        return {
          ...baseForm,
          asset_code: extractedFields.asset_code,
          asset_name: extractedFields.asset_name,
          applicant: extractedFields.applicant,
          scrapping_reason: extractedFields.scrapping_reason,
          estimated_value: extractedFields.estimated_value,
          remark: extractedFields.remark,
        };

      case 'inventory_create':
        return {
          ...baseForm,
          inventory_no: extractedFields.inventory_no,
          inventory_date: extractedFields.inventory_date,
          inventory_type: extractedFields.inventory_type,
          inventory_person: extractedFields.inventory_person,
          remark: extractedFields.remark,
        };

      default:
        return baseForm;
    }
  },

  async getAssetByCode(tenantId, assetCode) {
    const cacheKey = `${tenantId || 'global'}_${assetCode}`;
    if (this.assetCache.has(cacheKey)) {
      return this.assetCache.get(cacheKey);
    }

    try {
      const db = require('../config/database');
      let query, params;

      if (tenantId && !isNaN(parseInt(tenantId))) {
        query = `SELECT id, asset_code, asset_name, brand, model, specification, location, department_new as department, unit, responsible_person, status, purchase_date
                 FROM assets
                 WHERE (asset_code = ? OR id = ?) AND tenant_id = ?
                 LIMIT 1`;
        params = [assetCode, assetCode, tenantId];
      } else {
        return null;
      }

      const [rows] = await db.execute(query, params);
      const asset = rows?.[0] || null;
      if (asset) {
        this.assetCache.set(cacheKey, asset);
        setTimeout(() => this.assetCache.delete(cacheKey), 60000);
      }
      return asset;
    } catch (error) {
      console.error('查询资产失败:', error);
      return null;
    }
  },

  async getMaintenanceHistory(tenantId, assetCode) {
    try {
      const db = require('../config/database');
      const query = `SELECT id, request_no, fault_description, status, request_date
                     FROM maintenance_requests
                     WHERE asset_code = ? AND tenant_id = ?
                     ORDER BY created_at DESC LIMIT 20`;
      const [rows] = await db.execute(query, [assetCode, tenantId]);
      return rows || [];
    } catch (error) {
      console.error('查询维修历史失败:', error);
      return [];
    }
  },

  extractAssetKeyword(message) {
    const patterns = [
      /查[询看找]+([A-Za-z0-9-]+)/,
      /搜索?([A-Za-z0-9-]+)/,
      /资产([A-Za-z0-9-]+)/,
      /([A-Za-z0-9-]{4,})/,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  },

  async submitLearningFeedback(tenantId, phrase, intent) {
    try {
      const db = require('../config/database');
      const query = `INSERT INTO ai_conversation_feedback (tenant_id, user_phrase, detected_intent, created_at)
                     VALUES (?, ?, ?, NOW())
                     ON DUPLICATE KEY UPDATE detected_intent = VALUES(detected_intent), created_at = NOW()`;
      await db.execute(query, [tenantId, phrase.substring(0, 500), intent]);
    } catch (error) {
      console.error('保存学习反馈失败:', error);
    }
  },

  async processAudio({ conversationId, audio }) {
    return { success: false, message: '语音处理功能暂时不可用' };
  },

  async getMaintenanceAnalysis({ type, startDate, endDate, department }) {
    try {
      const db = require('../config/database');
      const overview = { total_requests: 0, completed_requests: 0, total_logs: 0, total_cost: 0 };
      const byType = [];

      return { success: true, data: { overview, byType } };
    } catch (error) {
      console.error('获取维修分析失败:', error);
      return { success: false, message: error.message };
    }
  },
};

module.exports = maintenanceAIService;
