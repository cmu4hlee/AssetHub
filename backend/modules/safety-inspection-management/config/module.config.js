/**
 * 安全检测管理模块配置
 * 独立于合规主模块，便于按租户单独启停。
 */

module.exports = {
  id: 'safety-inspection-management',
  name: '安全检测管理',
  version: '1.0.0',
  description: '医疗设备电气、辐射、机械等安全检测记录与整改跟踪模块',
  category: '质量与安全',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  created_at: '2026-03-04T00:00:00Z',
  updated_at: '2026-03-04T00:00:00Z',

  dependencies: [
    { module_id: 'asset-management', dependency_type: 'required', min_version: '1.0.0' },
    { module_id: 'user-management', dependency_type: 'required', min_version: '1.0.0' }
  ],

  features: {
    inspection_records: {
      enabled: true,
      name: '检测记录',
      description: '安全检测记录维护',
      configurable: true,
      default_enabled: true
    },
    expiration_alerts: {
      enabled: true,
      name: '到期提醒',
      description: '检测到期提醒能力',
      configurable: true,
      default_enabled: true
    },
    rectification_tracking: {
      enabled: true,
      name: '整改追踪',
      description: '不合格项目整改闭环',
      configurable: true,
      default_enabled: true
    }
  },

  frontend_config: {
    menu_keys: ['/safety-inspection'],
    menu_routes: [
      {
        key: '/safety-inspection',
        icon: 'SafetyOutlined',
        label: '安全检测',
        path: '/safety-inspection',
        component: 'SafetyInspectionManagement',
        permissions: ['safety_inspection:read']
      }
    ],
    components: [
      { name: 'SafetyInspectionManagement', path: 'pages/compliance/SafetyInspection', export: 'default' }
    ],
    permissions: [
      'safety_inspection:read',
      'safety_inspection:create',
      'safety_inspection:update',
      'safety_inspection:delete'
    ]
  },

  backend_config: {
    api_prefix: '/api/safety-inspection',
    routes_path: 'routes',
    controllers_path: 'controllers',
    services_path: 'services',
    database_tables: ['safety_inspections', 'safety_inspection_issues'],
    services: [{ name: 'SafetyInspectionService', path: 'services/safety-inspection.service' }],
    controllers: [{ name: 'SafetyInspectionController', path: 'controllers/safety-inspection.controller' }]
  },

  config_schema: [
    {
      key: 'inspection_records_enabled',
      name: '启用检测记录',
      type: 'boolean',
      default: true,
      description: '是否启用安全检测记录管理'
    },
    {
      key: 'rectification_tracking_enabled',
      name: '启用整改追踪',
      type: 'boolean',
      default: true,
      description: '是否启用不合格项整改追踪'
    },
    {
      key: 'default_expiring_days',
      name: '到期提醒天数',
      type: 'number',
      default: 30,
      min: 1,
      max: 365,
      description: '检测到期前提醒天数'
    }
  ],

  default_config: {
    inspection_records_enabled: true,
    rectification_tracking_enabled: true,
    default_expiring_days: 30
  },

  interfaces: [
    {
      name: 'ISafetyInspectionService',
      type: 'service',
      methods: [
        { name: 'createInspection', input: { payload: 'InspectionPayload' }, output: 'InspectionRecord' },
        { name: 'listExpiringInspections', input: { days: 'number' }, output: 'InspectionRecord[]' }
      ]
    }
  ]
};
