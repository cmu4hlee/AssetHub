/**
 * 特种设备管理模块配置
 * 独立于合规主模块，便于按租户单独启停。
 */

module.exports = {
  id: 'special-equipment-management',
  name: '特种设备管理',
  version: '1.0.0',
  description: '特种设备台账、检验记录、到期提醒与统计分析模块',
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
    equipment_registry: {
      enabled: true,
      name: '设备台账',
      description: '特种设备档案与状态管理',
      configurable: true,
      default_enabled: true
    },
    inspection_records: {
      enabled: true,
      name: '检验记录',
      description: '检验记录维护与追溯',
      configurable: true,
      default_enabled: true
    },
    inspection_alerts: {
      enabled: true,
      name: '到期提醒',
      description: '特种设备检验到期提醒',
      configurable: true,
      default_enabled: true
    }
  },

  frontend_config: {
    menu_keys: ['/special-equipment'],
    menu_routes: [
      {
        key: '/special-equipment',
        icon: 'AlertOutlined',
        label: '特种设备',
        path: '/special-equipment',
        component: 'SpecialEquipmentManagement',
        permissions: ['special_equipment:read']
      }
    ],
    components: [
      { name: 'SpecialEquipmentManagement', path: 'pages/compliance/SpecialEquipment', export: 'default' }
    ],
    permissions: [
      'special_equipment:read',
      'special_equipment:create',
      'special_equipment:update',
      'special_equipment:delete',
      'special_equipment:inspection:read',
      'special_equipment:inspection:create',
      'special_equipment:inspection:update',
      'special_equipment:inspection:delete'
    ]
  },

  backend_config: {
    api_prefix: '/api/special-equipment',
    routes_path: 'routes',
    controllers_path: 'controllers',
    services_path: 'services',
    database_tables: ['special_equipment', 'special_equipment_inspections'],
    services: [
      { name: 'SpecialEquipmentService', path: 'services/special-equipment.service' }
    ],
    controllers: [
      { name: 'SpecialEquipmentController', path: 'controllers/special-equipment.controller' }
    ]
  },

  config_schema: [
    {
      key: 'equipment_registry_enabled',
      name: '启用设备台账',
      type: 'boolean',
      default: true,
      description: '是否启用特种设备台账管理'
    },
    {
      key: 'inspection_records_enabled',
      name: '启用检验记录',
      type: 'boolean',
      default: true,
      description: '是否启用检验记录管理'
    },
    {
      key: 'default_inspection_reminder_days',
      name: '检验提醒提前天数',
      type: 'number',
      default: 90,
      min: 1,
      max: 365,
      description: '检验到期前提醒天数'
    }
  ],

  default_config: {
    equipment_registry_enabled: true,
    inspection_records_enabled: true,
    default_inspection_reminder_days: 90
  },

  interfaces: [
    {
      name: 'ISpecialEquipmentService',
      type: 'service',
      methods: [
        { name: 'getExpiringInspections', input: { days: 'number' }, output: 'SpecialEquipment[]' },
        {
          name: 'addInspectionRecord',
          input: { equipmentId: 'number', inspectionData: 'InspectionData' },
          output: 'InspectionRecord'
        }
      ]
    }
  ]
};
