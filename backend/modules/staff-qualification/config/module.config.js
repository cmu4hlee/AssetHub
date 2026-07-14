/**
 * 人员资质管理模块配置
 * 符合《医学装备整体运维管理服务规范》人员资质要求
 */

module.exports = {
  id: 'staff-qualification',
  name: '人员资质管理',
  version: '1.0.0',
  description: '医学装备管理人员资质、培训记录、考核管理模块',
  category: '人力资源',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  created_at: '2026-03-02T00:00:00Z',
  updated_at: '2026-03-02T00:00:00Z',

  dependencies: [
    { module_id: 'user-management', dependency_type: 'required', min_version: '1.0.0' }
  ],

  features: {
    qualification_management: {
      enabled: true,
      name: '资质管理',
      description: '人员专业资质、技能证书管理',
      configurable: true,
      default_enabled: true
    },
    training_management: {
      enabled: true,
      name: '培训管理',
      description: '培训计划、培训记录管理',
      configurable: true,
      default_enabled: true
    },
    qualification_reminder: {
      enabled: true,
      name: '资质到期提醒',
      description: '资质到期前自动提醒',
      configurable: true,
      default_enabled: true
    },
    competency_assessment: {
      enabled: true,
      name: '能力考核',
      description: '人员技能考核与评估',
      configurable: true,
      default_enabled: true
    }
  },

  frontend_config: {
    menu_keys: ['/staff/qualifications', '/staff/training', '/staff/assessment'],
    menu_routes: [
      {
        key: '/staff',
        icon: 'TeamOutlined',
        label: '人员管理',
        path: '/staff',
        component: 'StaffDashboard',
        permissions: ['staff:read']
      },
      {
        key: '/staff/qualifications',
        icon: 'IdcardOutlined',
        label: '资质管理',
        path: '/staff/qualifications',
        component: 'QualificationManagement',
        permissions: ['staff:qualification:read'],
        feature: 'qualification_management'
      },
      {
        key: '/staff/training',
        icon: 'BookOutlined',
        label: '培训管理',
        path: '/staff/training',
        component: 'TrainingManagement',
        permissions: ['staff:training:read'],
        feature: 'training_management'
      },
      {
        key: '/staff/assessment',
        icon: 'FileDoneOutlined',
        label: '考核管理',
        path: '/staff/assessment',
        component: 'CompetencyAssessment',
        permissions: ['staff:assessment:read'],
        feature: 'competency_assessment'
      }
    ],
    components: [
      { name: 'StaffDashboard', path: 'pages/staff/Dashboard', export: 'default' },
      { name: 'QualificationManagement', path: 'pages/staff/Qualifications', export: 'default' },
      { name: 'TrainingManagement', path: 'pages/staff/Training', export: 'default' },
      { name: 'CompetencyAssessment', path: 'pages/staff/Assessment', export: 'default' }
    ],
    permissions: [
      'staff:read',
      'staff:qualification:read',
      'staff:qualification:create',
      'staff:qualification:update',
      'staff:qualification:delete',
      'staff:training:read',
      'staff:training:create',
      'staff:training:update',
      'staff:assessment:read',
      'staff:assessment:create'
    ]
  },

  backend_config: {
    api_prefix: '/api/staff',
    routes_path: 'routes',
    database_tables: ['staff_qualifications', 'staff_training_records'],
    controllers: [
      { name: 'StaffQualificationController', path: 'controllers/staff-qualification.controller.js' }
    ],
    services: [
      { name: 'StaffQualificationService', path: 'services/staff-qualification.service.js' }
    ]
  },

  config_schema: [
    {
      key: 'qualification_management_enabled',
      name: '启用资质管理',
      type: 'boolean',
      default: true
    },
    {
      key: 'training_management_enabled',
      name: '启用培训管理',
      type: 'boolean',
      default: true
    },
    {
      key: 'qualification_reminder_days',
      name: '资质到期提醒天数',
      type: 'number',
      default: 90,
      min: 7,
      max: 365
    },
    {
      key: 'training_reminder_days',
      name: '培训到期提醒天数',
      type: 'number',
      default: 30,
      min: 7,
      max: 365
    },
    {
      key: 'mandatory_training_enabled',
      name: '强制培训要求',
      type: 'boolean',
      default: true,
      description: '是否要求特定岗位必须完成培训'
    },
    {
      key: 'qualification_types',
      name: '资质类型',
      type: 'multi_select',
      options: [
        { label: '专业资质', value: 'professional' },
        { label: '技能证书', value: 'skill' },
        { label: '安全培训', value: 'safety' },
        { label: '特种作业', value: 'special' }
      ],
      default: ['professional', 'skill', 'safety', 'special']
    }
  ],

  default_config: {
    qualification_management_enabled: true,
    training_management_enabled: true,
    qualification_reminder_days: 90,
    training_reminder_days: 30,
    mandatory_training_enabled: true,
    qualification_types: ['professional', 'skill', 'safety', 'special']
  },

  migrations: [
    {
      version: '1.0.0',
      script: 'migrations/001_create_staff_tables.sql',
      description: '创建人员资质管理相关表'
    }
  ],

  interfaces: [
    {
      name: 'IQualificationService',
      type: 'service',
      methods: [
        { name: 'getExpiringQualifications', input: { days: 'number' }, output: 'Qualification[]' },
        { name: 'validateQualification', input: { userId: 'number', qualificationType: 'string' }, output: 'boolean' }
      ]
    }
  ]
};
