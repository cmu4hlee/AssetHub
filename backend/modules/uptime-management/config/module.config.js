/**
 * 开机率管理模块配置
 * 符合《医学装备整体运维管理服务规范》开机率统计要求
 */

module.exports = {
  id: 'uptime-management',
  name: '开机率管理',
  version: '1.0.0',
  description: '医疗设备开机率统计与分析模块，支持生命支持类、大型设备、常规设备分类统计',
  category: '分析与统计',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  created_at: '2026-03-02T00:00:00Z',
  updated_at: '2026-03-02T00:00:00Z',

  dependencies: [
    { module_id: 'asset-management', dependency_type: 'required', min_version: '1.0.0' },
    { module_id: 'maintenance-management', dependency_type: 'optional', min_version: '1.0.0' }
  ],

  features: {
    operation_log: {
      enabled: true,
      name: '运行记录管理',
      description: '设备每日运行时间记录',
      configurable: true,
      default_enabled: true
    },
    uptime_statistics: {
      enabled: true,
      name: '开机率统计',
      description: '按月统计设备开机率',
      configurable: true,
      default_enabled: true
    },
    uptime_analysis: {
      enabled: true,
      name: '开机率分析',
      description: '开机率趋势分析与预警',
      configurable: true,
      default_enabled: true
    },
    downtime_analysis: {
      enabled: true,
      name: '停机分析',
      description: '停机原因分类与分析',
      configurable: true,
      default_enabled: true
    }
  },

  frontend_config: {
    menu_keys: ['/uptime/dashboard', '/uptime/operation-logs', '/uptime/statistics'],
    menu_routes: [
      {
        key: '/uptime',
        icon: 'PieChartOutlined',
        label: '开机率管理',
        path: '/uptime',
        component: 'UptimeDashboard',
        permissions: ['uptime:read']
      },
      {
        key: '/uptime/dashboard',
        icon: 'DashboardOutlined',
        label: '开机率概览',
        path: '/uptime/dashboard',
        component: 'UptimeOverview',
        permissions: ['uptime:read']
      },
      {
        key: '/uptime/operation-logs',
        icon: 'EditOutlined',
        label: '运行记录',
        path: '/uptime/operation-logs',
        component: 'OperationLogManagement',
        permissions: ['uptime:log:read'],
        feature: 'operation_log'
      },
      {
        key: '/uptime/statistics',
        icon: 'BarChartOutlined',
        label: '统计分析',
        path: '/uptime/statistics',
        component: 'UptimeStatistics',
        permissions: ['uptime:statistics:read'],
        feature: 'uptime_statistics'
      }
    ],
    components: [
      { name: 'UptimeDashboard', path: 'pages/uptime/Dashboard', export: 'default' },
      { name: 'UptimeOverview', path: 'pages/uptime/Overview', export: 'default' },
      { name: 'OperationLogManagement', path: 'pages/uptime/OperationLogs', export: 'default' },
      { name: 'UptimeStatistics', path: 'pages/uptime/Statistics', export: 'default' }
    ],
    permissions: [
      'uptime:read',
      'uptime:log:read',
      'uptime:log:create',
      'uptime:log:update',
      'uptime:statistics:read',
      'uptime:statistics:export'
    ]
  },

  backend_config: {
    api_prefix: '/api/uptime',
    routes_path: 'routes',
    controllers_path: 'controllers',
    services_path: 'services',
    database_tables: ['uptime_statistics', 'asset_operation_logs', 'operation_logs'],
    controllers: [
      { name: 'UptimeController', path: 'controllers/uptime.controller' }
    ],
    services: [
      { name: 'UptimeService', path: 'services/uptime.service' }
    ]
  },

  config_schema: [
    {
      key: 'operation_log_enabled',
      name: '启用运行记录',
      type: 'boolean',
      default: true
    },
    {
      key: 'auto_calculation_enabled',
      name: '自动计算开机率',
      type: 'boolean',
      default: true,
      description: '每月自动计算上月开机率'
    },
    {
      key: 'life_support_uptime_threshold',
      name: '生命支持类设备开机率阈值(%)',
      type: 'number',
      default: 99,
      min: 90,
      max: 100
    },
    {
      key: 'large_equipment_uptime_threshold',
      name: '大型设备开机率阈值(%)',
      type: 'number',
      default: 95,
      min: 80,
      max: 100
    },
    {
      key: 'regular_equipment_uptime_threshold',
      name: '常规设备开机率阈值(%)',
      type: 'number',
      default: 95,
      min: 80,
      max: 100
    },
    {
      key: 'low_uptime_warning_enabled',
      name: '低开机率预警',
      type: 'boolean',
      default: true
    },
    {
      key: 'data_collection_method',
      name: '数据采集方式',
      type: 'select',
      options: [
        { label: '手工录入', value: 'manual' },
        { label: 'IoT自动采集', value: 'iot' },
        { label: '混合模式', value: 'hybrid' }
      ],
      default: 'manual'
    }
  ],

  default_config: {
    operation_log_enabled: true,
    auto_calculation_enabled: true,
    life_support_uptime_threshold: 99,
    large_equipment_uptime_threshold: 95,
    regular_equipment_uptime_threshold: 95,
    low_uptime_warning_enabled: true,
    data_collection_method: 'manual'
  },

  migrations: [
    {
      version: '1.0.0',
      script: 'migrations/001_create_uptime_tables.sql',
      description: '创建开机率管理相关表'
    }
  ],

  interfaces: [
    {
      name: 'IUptimeCalculationService',
      type: 'service',
      methods: [
        { name: 'calculateMonthlyUptime', input: { year: 'number', month: 'number' }, output: 'UptimeResult[]' },
        { name: 'getUptimeOverview', input: { year: 'number', month: 'number' }, output: 'UptimeOverview' },
        { name: 'batchImportOperationLogs', input: { logs: 'OperationLog[]' }, output: 'ImportResult' }
      ]
    }
  ]
};
