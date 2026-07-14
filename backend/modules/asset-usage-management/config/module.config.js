module.exports = {
  id: 'asset-usage-management',
  name: '资产使用管理',
  version: '1.0.0',
  description: '资产使用管理模块，支持资产借出、归还和使用统计',
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
    menu_keys: ['/asset/usage', '/asset/usage/statistics'],
    menu_prefixes: ['/asset/usage', '/asset/usage/statistics'],
    menu_routes: [
      {
        key: '/asset/usage',
        icon: 'SwapOutlined',
        label: '资产使用',
        path: '/asset/usage',
        component: 'AssetUsageList',
        permissions: ['asset:usage:read'],
      },
      {
        key: '/asset/usage/statistics',
        icon: 'BarChartOutlined',
        label: '使用统计',
        path: '/asset/usage/statistics',
        component: 'AssetUsageStatistics',
        permissions: ['asset:usage:read'],
        parent: '/asset/usage',
      },
    ],
    components: [
      { name: 'AssetUsageList', path: 'pages/AssetUsageList', export: 'default' },
      { name: 'AssetUsageStatistics', path: 'pages/AssetUsageStatistics', export: 'default' },
    ],
    permissions: [
      'asset:usage:read',
      'asset:usage:create',
      'asset:usage:update',
      'asset:usage:delete',
    ],
  },

  backend_config: {
    api_endpoints: [
      { method: 'GET', path: '/api/asset-usage/records', handler: 'getUsageRecords', permissions: ['asset:usage:read'] },
      { method: 'GET', path: '/api/asset-usage/records/:id', handler: 'getUsageRecordById', permissions: ['asset:usage:read'] },
      { method: 'POST', path: '/api/asset-usage/checkout', handler: 'checkoutAsset', permissions: ['asset:usage:create'] },
      { method: 'POST', path: '/api/asset-usage/return/:id', handler: 'returnAsset', permissions: ['asset:usage:update'] },
      { method: 'GET', path: '/api/asset-usage/asset/:assetCode/status', handler: 'getAssetUsageStatus', permissions: ['asset:usage:read'] },
      { method: 'GET', path: '/api/asset-usage/statistics', handler: 'getUsageStatistics', permissions: ['asset:usage:read'] },
      { method: 'GET', path: '/api/asset-usage/user/:userId/records', handler: 'getUserUsageRecords', permissions: ['asset:usage:read'] },
    ],
    database_tables: ['asset_usage_records'],
    services: [
      { name: 'AssetUsageService', path: 'services/asset-usage.service' },
    ],
    permissions: [
      'asset:usage:read',
      'asset:usage:create',
      'asset:usage:update',
      'asset:usage:delete',
    ],
  },

  config_schema: [
    {
      key: 'enable_usage_tracking',
      name: '启用使用追踪',
      type: 'boolean',
      required: false,
      default: true,
      description: '是否启用资产使用追踪功能',
    },
    {
      key: 'default_checkout_days',
      name: '默认借出天数',
      type: 'number',
      required: false,
      default: 30,
      description: '默认的资产借出天数',
      validation: { min: 1, max: 365 },
    },
    {
      key: 'enable_auto_reminder',
      name: '启用自动提醒',
      type: 'boolean',
      required: false,
      default: true,
      description: '资产到期归还自动提醒',
    },
  ],

  default_config: {
    enable_usage_tracking: true,
    default_checkout_days: 30,
    enable_auto_reminder: true,
  },

  interfaces: [
    {
      name: 'IAssetUsageService',
      type: 'service',
      methods: [
        { name: 'checkoutAsset', input: { usageData: 'UsageData' }, output: 'UsageRecord' },
        { name: 'returnAsset', input: { id: 'number', returnData: 'ReturnData' }, output: 'boolean' },
      ],
    },
  ],
};
