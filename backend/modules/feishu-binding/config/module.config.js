module.exports = {
  id: 'feishu-binding',
  name: '飞书绑定',
  version: '1.0.0',
  description: '飞书平台用户绑定、SSO登录和消息推送集成',
  category: '第三方集成',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',

  dependencies: [],

  compatibility: [],

  frontend_config: {
    menu_keys: [],
    menu_prefixes: [],
    menu_routes: [],
    components: [
      {
        name: 'FeishuBinding',
        path: 'pages/FeishuBinding',
        export: 'default',
      },
    ],
    permissions: [
      'feishu:binding:read',
      'feishu:binding:create',
      'feishu:binding:delete',
      'feishu:message:send',
      'feishu:user:read',
    ],
  },

  backend_config: {
    api_endpoints: [
      {
        method: 'GET',
        path: '/api/feishu/binding/status',
        handler: 'getBindingStatus',
        permissions: ['feishu:binding:read'],
      },
      {
        method: 'GET',
        path: '/api/feishu/binding/auth-url',
        handler: 'getAuthUrl',
        permissions: ['feishu:binding:read'],
      },
      {
        method: 'GET',
        path: '/api/feishu/binding/callback',
        handler: 'handleCallback',
        permissions: [],
      },
      {
        method: 'POST',
        path: '/api/feishu/binding/bind',
        handler: 'bindUser',
        permissions: ['feishu:binding:create'],
      },
      {
        method: 'POST',
        path: '/api/feishu/binding/unbind',
        handler: 'unbindUser',
        permissions: ['feishu:binding:delete'],
      },
      {
        method: 'GET',
        path: '/api/feishu/binding/user-info',
        handler: 'getUserInfo',
        permissions: ['feishu:user:read'],
      },
      {
        method: 'POST',
        path: '/api/feishu/binding/send-message',
        handler: 'sendMessage',
        permissions: ['feishu:message:send'],
      },
      {
        method: 'GET',
        path: '/api/feishu/binding/list',
        handler: 'getBindingList',
        permissions: ['feishu:binding:read'],
      },
      {
        method: 'GET',
        path: '/api/feishu/health',
        handler: 'getModuleHealth',
        permissions: [],
      },
    ],
    database_tables: ['feishu_binding'],
    services: [
      {
        name: 'BindingService',
        path: 'services/binding.service',
      },
    ],
    permissions: [
      'feishu:binding:read',
      'feishu:binding:create',
      'feishu:binding:delete',
      'feishu:message:send',
      'feishu:user:read',
    ],
  },

  config_schema: [
    {
      key: 'app_id',
      name: '飞书应用ID',
      type: 'string',
      required: true,
      default: '',
      description: '飞书应用的AppID',
    },
    {
      key: 'app_secret',
      name: '飞书应用Secret',
      type: 'string',
      required: true,
      default: '',
      description: '飞书应用的AppSecret',
    },
    {
      key: 'callback_url',
      name: '回调URL',
      type: 'string',
      required: false,
      default: '',
      description: '飞书OAuth回调URL',
    },
  ],
  default_config: {
    app_id: '',
    app_secret: '',
    callback_url: '',
  },

  interfaces: [],
};