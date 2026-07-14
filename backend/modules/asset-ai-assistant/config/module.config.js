module.exports = {
  id: 'asset-ai-assistant',
  name: '资产AI助手',
  version: '1.0.0',
  description: '统一的资产AI入口模块，为资产AI能力提供统一入口。',
  category: '资产生命周期',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  created_at: '2026-02-23T00:00:00Z',
  updated_at: '2026-02-23T00:00:00Z',

  dependencies: [
    {
      module_id: 'asset-management',
      dependency_type: 'required',
      min_version: '1.0.0',
      max_version: null,
    },
    {
      module_id: 'user-management',
      dependency_type: 'required',
      min_version: '1.0.0',
      max_version: null,
    },
  ],

  compatibility: [],

  frontend_config: {
    menu_keys: ['/ai-assistant-parent'],
    menu_prefixes: [],
    menu_routes: [],
    components: [],
    permissions: ['ai:assistant:use'],
  },

  backend_config: {
    api_endpoints: [
      { method: 'GET', path: '/api/ai-assistant/config', handler: 'getAssistantConfig', permissions: ['ai:assistant:use'] },
      { method: 'PUT', path: '/api/ai-assistant/config', handler: 'updateAssistantConfig', permissions: ['ai:assistant:use'] },
      { method: 'POST', path: '/api/ai-assistant/sessions', handler: 'createSession', permissions: ['ai:assistant:use'] },
      { method: 'GET', path: '/api/ai-assistant/sessions/:sessionId/history', handler: 'getSessionHistory', permissions: ['ai:assistant:use'] },
      { method: 'DELETE', path: '/api/ai-assistant/sessions/:sessionId', handler: 'closeSession', permissions: ['ai:assistant:use'] },
      { method: 'POST', path: '/api/ai-assistant/message', handler: 'sendMessage', permissions: ['ai:assistant:use'] },
      { method: 'GET', path: '/api/ai-assistant/status', handler: 'getAssistantStatus', permissions: ['ai:assistant:use'] },
    ],
    database_tables: [],
    services: [
      { name: 'AssetAIAssistantService', path: 'services/asset-ai-assistant.service' },
    ],
    permissions: ['ai:assistant:use'],
  },

  config_schema: [
    {
      key: 'base_url',
      name: '助手地址',
      type: 'string',
      required: true,
      default: 'http://192.168.1.80:8000/',
      group: '基础设置',
      description: '资产AI助手服务地址。',
      validation: {
        pattern: '^https?://.+',
        message: '请输入有效的 http/https 地址',
      },
    },
    {
      key: 'open_mode',
      name: '打开方式',
      type: 'select',
      required: false,
      default: 'modal',
      group: '基础设置',
      description: '资产AI助手打开方式。',
      options: [
        { label: '弹窗嵌入', value: 'modal' },
        { label: '新窗口打开', value: 'window' },
      ],
    },
    {
      key: 'enabled_modes',
      name: '启用模式',
      type: 'multi_select',
      required: false,
      default: ['assistant'],
      group: '流程设置',
      description: '启用的AI助手功能模式。',
      options: [
        { label: '通用助手', value: 'assistant' },
        { label: '文档助手', value: 'documents' },
        { label: '维修助手', value: 'maintenance' },
        { label: '智能搜索', value: 'search' },
      ],
    },
    {
      key: 'default_mode',
      name: '默认模式',
      type: 'select',
      required: false,
      default: 'assistant',
      group: '流程设置',
      description: '默认进入的助手模式。',
      options: [
        { label: '通用助手', value: 'assistant' },
      ],
    },
    {
      key: 'session_timeout_minutes',
      name: '会话超时(分钟)',
      type: 'number',
      required: false,
      default: 30,
      group: '数据与性能',
      description: '助手会话超时设置。',
      validation: {
        min: 5,
        max: 240,
      },
    },
  ],

  default_config: {
    base_url: 'http://192.168.1.80:8000/',
    open_mode: 'modal',
    enabled_modes: ['assistant'],
    default_mode: 'assistant',
    session_timeout_minutes: 30,
  },

  interfaces: [
    {
      name: 'AssetAIAssistantWeb',
      type: 'WEB',
      description: '资产AI助手统一入口',
    },
  ],
};
