/**
 * 合规性管理模块配置
 * 符合《医学装备整体运维管理服务规范》要求
 */

module.exports = {
  // 模块基本信息
  id: 'compliance-management',
  name: '合规性管理',
  version: '1.0.0',
  description:
    '医学装备整体运维管理服务规范中的合规核心模块，统一承载分级保养与预防性维护策略、模板与计划治理',
  category: '质量与合规',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  created_at: '2026-03-02T00:00:00Z',
  updated_at: '2026-03-02T00:00:00Z',

  // 依赖模块
  dependencies: [
    { module_id: 'asset-management', dependency_type: 'required', min_version: '1.0.0' },
    { module_id: 'user-management', dependency_type: 'required', min_version: '1.0.0' }
  ],

  // 功能开关配置
  features: {
    // 分级保养功能
    maintenance_level: {
      enabled: true,
      name: '分级保养管理',
      description: '日常/一级/二级/三级保养体系',
      configurable: true,
      default_enabled: true
    },
    // 预防性维护功能（已并入合规域）
    preventive_maintenance: {
      enabled: true,
      name: '预防性维护管理',
      description: '维护计划、模板、提醒与效率分析',
      configurable: true,
      default_enabled: true
    }
  },

  // 前端配置
  frontend_config: {
    menu_keys: [
      '/compliance',
      '/compliance/maintenance-level',
      '/maintenance/plans',
      '/maintenance/templates',
      '/maintenance/reminders',
      '/maintenance/efficiency'
    ],
    menu_prefixes: [
      '/compliance',
      '/maintenance/plans',
      '/maintenance/templates',
      '/maintenance/reminders',
      '/maintenance/efficiency'
    ],
    menu_routes: [
      {
        key: '/compliance',
        icon: 'SafetyCertificateOutlined',
        label: '合规性管理',
        path: '/compliance',
        component: 'ComplianceDashboard',
        permissions: ['compliance:read']
      },
      {
        key: '/compliance/maintenance-level',
        icon: 'ToolOutlined',
        label: '分级保养',
        path: '/compliance/maintenance-level',
        component: 'MaintenanceLevelManagement',
        permissions: ['compliance:maintenance:read'],
        feature: 'maintenance_level'
      },
      {
        key: '/maintenance/plans',
        icon: 'CalendarOutlined',
        label: '预防性维护',
        path: '/maintenance/plans',
        component: 'PreventiveMaintenanceList',
        permissions: ['maintenance:plan:read'],
        feature: 'preventive_maintenance'
      },
      {
        key: '/maintenance/templates',
        icon: 'FileTextOutlined',
        label: '维护计划模板',
        path: '/maintenance/templates',
        component: 'MaintenanceTemplateList',
        permissions: ['maintenance:template:read'],
        parent: '/maintenance/plans',
        feature: 'preventive_maintenance'
      },
      {
        key: '/maintenance/reminders',
        icon: 'BellOutlined',
        label: '维护提醒管理',
        path: '/maintenance/reminders',
        component: 'MaintenanceReminderList',
        permissions: ['maintenance:reminder:read'],
        parent: '/maintenance/plans',
        feature: 'preventive_maintenance'
      },
      {
        key: '/maintenance/efficiency',
        icon: 'LineChartOutlined',
        label: '维护效率分析',
        path: '/maintenance/efficiency',
        component: 'MaintenanceEfficiencyDashboard',
        permissions: ['maintenance:efficiency:read'],
        parent: '/maintenance/plans',
        feature: 'preventive_maintenance'
      }
    ],
    components: [
      { name: 'ComplianceDashboard', path: 'pages/compliance/Dashboard', export: 'default' },
      {
        name: 'MaintenanceLevelManagement',
        path: 'pages/compliance/MaintenanceLevel',
        export: 'default'
      },
      { name: 'PreventiveMaintenanceList', path: 'pages/PreventiveMaintenanceList', export: 'default' },
      { name: 'MaintenanceTemplateList', path: 'pages/MaintenanceTemplateList', export: 'default' },
      { name: 'MaintenanceReminderList', path: 'pages/MaintenanceReminderList', export: 'default' },
      {
        name: 'MaintenanceEfficiencyDashboard',
        path: 'pages/MaintenanceEfficiencyDashboard',
        export: 'default'
      }
    ],
    permissions: [
      'compliance:read',
      'compliance:maintenance:read',
      'compliance:maintenance:create',
      'compliance:maintenance:update',
      'compliance:maintenance:delete',
      'maintenance:plan:read',
      'maintenance:plan:create',
      'maintenance:plan:update',
      'maintenance:plan:delete',
      'maintenance:template:read',
      'maintenance:template:create',
      'maintenance:template:update',
      'maintenance:template:delete',
      'maintenance:reminder:read',
      'maintenance:reminder:create',
      'maintenance:reminder:update',
      'maintenance:reminder:delete',
      'maintenance:efficiency:read'
    ]
  },

  // 后端配置
  backend_config: {
    api_prefix: '/api/compliance',
    routes_path: 'routes',
    controllers_path: 'controllers',
    services_path: 'services',
    database_tables: [
      'maintenance_level_templates',
      'maintenance_level_plans'
    ],
    routes: [
      { name: 'ComplianceRouter', path: 'routes/index' },
      { name: 'ComplianceRoutes', path: 'routes/compliance' }
    ],
    services: [
      { name: 'ComplianceService', path: 'services/compliance.service' }
    ],
    controllers: [
      { name: 'ComplianceController', path: 'controllers/compliance.controller' }
    ]
  },

  // 配置项定义
  config_schema: [
    {
      key: 'maintenance_level_enabled',
      name: '启用分级保养',
      type: 'boolean',
      default: true,
      description: '是否启用分级保养功能'
    },
    {
      key: 'enable_auto_plan_generation',
      name: '自动生成保养计划',
      type: 'boolean',
      default: true,
      description: '是否根据模板自动生成保养计划'
    },
    {
      key: 'enable_preventive_maintenance',
      name: '启用预防性维护',
      type: 'boolean',
      default: true,
      description: '是否启用预防性维护功能'
    },
    {
      key: 'default_cycle_days',
      name: '默认维护周期(天)',
      type: 'number',
      default: 30,
      description: '未指定计划周期时采用的默认值'
    },
    {
      key: 'enable_auto_reminders',
      name: '启用自动提醒',
      type: 'boolean',
      default: true,
      description: '是否启用预防性维护自动提醒'
    },
    {
      key: 'reminder_advance_days',
      name: '提醒提前天数',
      type: 'number',
      default: 3,
      description: '预防性维护计划到期前多少天发送提醒'
    },
    {
      key: 'enable_efficiency_analysis',
      name: '启用效率分析',
      type: 'boolean',
      default: true,
      description: '是否启用预防性维护效率分析功能'
    }
  ],

  default_config: {
    maintenance_level_enabled: true,
    enable_auto_plan_generation: true,
    enable_preventive_maintenance: true,
    default_cycle_days: 30,
    enable_auto_reminders: true,
    reminder_advance_days: 3,
    enable_efficiency_analysis: true
  },

  // 数据迁移
  migrations: [
    {
      version: '1.0.0',
      script: 'migrations/001_create_compliance_tables.sql',
      description: '创建合规性管理相关表'
    }
  ],

  // 接口定义
  interfaces: [
    {
      name: 'IMaintenanceLevelService',
      type: 'service',
      methods: [
        { name: 'generateMaintenancePlans', input: { assetIds: 'number[]', months: 'number' }, output: 'MaintenancePlan[]' },
        { name: 'getMaintenanceStatistics', input: { startDate: 'string', endDate: 'string' }, output: 'MaintenanceStatistics' }
      ]
    }
  ]
};
