module.exports = {
  id: 'ct-maintenance-assistant-management',
  name: 'CT维护助手模块',
  version: '1.0.0',
  description: '资产AI助手下的CT维护专用助手模块',
  category: '资产生命周期',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  created_at: '2026-02-23T00:00:00Z',
  updated_at: '2026-02-23T00:00:00Z',

  dependencies: [
    {
      module_id: 'asset-ai-assistant',
      dependency_type: 'required',
      min_version: '1.0.0',
      max_version: null,
    },
  ],

  compatibility: [],

  frontend_config: {
    menu_keys: ['/ai-assistant-parent', '/ai-assistant/ct-maintenance'],
    menu_prefixes: ['/ai-assistant/ct-maintenance'],
    menu_routes: [
      {
        key: '/ai-assistant/ct-maintenance',
        icon: 'ToolOutlined',
        label: 'CT维护助手',
        path: '/ai-assistant/ct-maintenance',
        component: 'CTMaintenanceAssistant',
        permissions: ['ai:assistant:ct:use'],
      },
    ],
    components: [
      {
        name: 'CTMaintenanceAssistant',
        path: 'pages/CTMaintenanceAssistant',
        export: 'default',
      },
    ],
    permissions: ['ai:assistant:ct:use'],
  },

  backend_config: {
    api_endpoints: [
      { method: 'GET', path: '/api/ct-maintenance/config', handler: 'getAssistantConfig', permissions: ['ai:assistant:ct:use'] },
      { method: 'PUT', path: '/api/ct-maintenance/config', handler: 'updateAssistantConfig', permissions: ['ai:assistant:ct:use'] },
      { method: 'POST', path: '/api/ct-maintenance/knowledge/query', handler: 'knowledgeQuery', permissions: ['ai:assistant:ct:use'] },
      { method: 'POST', path: '/api/ct-maintenance/maintenance/advice', handler: 'maintenanceAdvice', permissions: ['ai:assistant:ct:use'] },
      { method: 'POST', path: '/api/ct-maintenance/troubleshooting', handler: 'troubleshootingGuide', permissions: ['ai:assistant:ct:use'] },
      { method: 'POST', path: '/api/ct-maintenance/checklist', handler: 'getInspectionChecklist', permissions: ['ai:assistant:ct:use'] },
      { method: 'GET', path: '/api/ct-maintenance/status', handler: 'getAssistantStatus', permissions: ['ai:assistant:ct:use'] },
    ],
    database_tables: [],
    services: [
      { name: 'CTMaintenanceAssistantService', path: 'services/ct-maintenance-assistant.service' },
    ],
    permissions: ['ai:assistant:ct:use'],
  },

  config_schema: [
    {
      key: 'enabled_tools',
      name: '启用工具',
      type: 'multi_select',
      required: false,
      default: ['knowledge', 'maintenance'],
      group: '基础设置',
      description: 'CT维护助手可用工具。',
      options: [
        { label: '知识问答', value: 'knowledge' },
        { label: '维修建议', value: 'maintenance' },
        { label: '排障指导', value: 'troubleshooting' },
        { label: '巡检清单', value: 'checklist' },
      ],
    },
    {
      key: 'response_style',
      name: '回复风格',
      type: 'select',
      required: false,
      default: 'concise',
      group: '流程设置',
      description: '助手回复内容风格。',
      options: [
        { label: '简洁', value: 'concise' },
        { label: '详细', value: 'detailed' },
      ],
    },
    {
      key: 'max_context_messages',
      name: '上下文消息上限',
      type: 'number',
      required: false,
      default: 20,
      group: '数据与性能',
      description: '上下文记忆消息条数上限。',
      validation: {
        min: 5,
        max: 100,
      },
    },
    {
      key: 'auto_suggest_checklist',
      name: '自动推荐巡检清单',
      type: 'boolean',
      required: false,
      default: true,
      group: '流程设置',
      description: '根据问题自动推荐巡检步骤。',
    },
    {
      key: 'enable_case_memory',
      name: '启用案例记忆',
      type: 'boolean',
      required: false,
      default: true,
      group: '高级设置',
      description: '保存常见故障处理案例用于后续建议。',
    },
  ],

  default_config: {
    enabled_tools: ['knowledge', 'maintenance'],
    max_context_messages: 20,
    response_style: 'concise',
    auto_suggest_checklist: true,
    enable_case_memory: true,
  },

  interfaces: [
    {
      name: 'CTMaintenanceAssistantWeb',
      type: 'WEB',
      description: 'CT维护助手页面入口',
    },
  ],
};
