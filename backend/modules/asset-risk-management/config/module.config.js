/**
 * 设备风险管理模块配置
 * 符合《医学装备整体运维管理服务规范》风险评估要求
 */

module.exports = {
  id: 'asset-risk-management',
  name: '风险管理',
  version: '1.0.0',
  description: '独立的医疗设备风险评估、风险分级、风险控制与预警管理模块',
  category: '质量与安全',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  created_at: '2026-03-02T00:00:00Z',
  updated_at: '2026-03-02T00:00:00Z',

  dependencies: [
    { module_id: 'asset-management', dependency_type: 'required', min_version: '1.0.0' }
  ],

  /**
   * 风险等级标准 - 符合 ISO 14971:2019《医疗器械风险管理》
   * 4级分类:
   * - critical (灾难性): 可能导致死亡或严重伤害
   * - high (高风险): 可能导致严重伤害
   * - medium (中风险): 可能导致轻微伤害
   * - low (低风险): 伤害后果可忽略
   */
  risk_levels: {
    critical: {
      label: '灾难性风险',
      color: 'purple',
      severity: 4,
      description: '可能导致死亡或不可逆的严重伤害，需要立即处理'
    },
    high: {
      label: '高风险',
      color: 'red',
      severity: 3,
      description: '可能导致严重但可逆的伤害，需要重点关注'
    },
    medium: {
      label: '中风险',
      color: 'orange',
      severity: 2,
      description: '可能导致轻微伤害，需要适当监控'
    },
    low: {
      label: '低风险',
      color: 'green',
      severity: 1,
      description: '伤害后果可忽略或无伤害，维持正常管理'
    }
  },

  features: {
    risk_assessment: {
      enabled: true,
      name: '风险评估',
      description: '设备风险评估与评分',
      configurable: true,
      default_enabled: true
    },
    risk_classification: {
      enabled: true,
      name: '风险分级',
      description: '设备风险等级分类管理',
      configurable: true,
      default_enabled: true
    },
    risk_control: {
      enabled: true,
      name: '风险控制',
      description: '风险控制措施制定与跟踪',
      configurable: true,
      default_enabled: true
    },
    risk_monitoring: {
      enabled: true,
      name: '风险监控',
      description: '风险指标监控与预警',
      configurable: true,
      default_enabled: true
    }
  },

  frontend_config: {
    menu_keys: ['/risk/dashboard', '/risk/assessment', '/risk/classification', '/risk/control'],
    menu_routes: [
      {
        key: '/risk/dashboard',
        icon: 'WarningOutlined',
        label: '风险管理',
        path: '/risk/dashboard',
        component: 'RiskDashboard',
        permissions: ['risk:read']
      },
      {
        key: '/risk/assessment',
        icon: 'SafetyOutlined',
        label: '风险评估',
        path: '/risk/assessment',
        component: 'RiskAssessment',
        permissions: ['risk:assessment:read'],
        feature: 'risk_assessment'
      },
      {
        key: '/risk/classification',
        icon: 'ApartmentOutlined',
        label: '风险分级',
        path: '/risk/classification',
        component: 'RiskClassification',
        permissions: ['risk:classification:read'],
        feature: 'risk_classification'
      },
      {
        key: '/risk/control',
        icon: 'ControlOutlined',
        label: '风险控制',
        path: '/risk/control',
        component: 'RiskControl',
        permissions: ['risk:control:read'],
        feature: 'risk_control'
      }
    ],
    components: [
      { name: 'RiskDashboard', path: 'pages/risk/Dashboard', export: 'default' },
      { name: 'RiskAssessment', path: 'pages/risk/RiskAssessment', export: 'default' },
      { name: 'RiskClassification', path: 'pages/risk/RiskClassification', export: 'default' },
      { name: 'RiskControl', path: 'pages/risk/RiskControl', export: 'default' }
    ],
    permissions: [
      'risk:read',
      'risk:assessment:read',
      'risk:assessment:create',
      'risk:assessment:update',
      'risk:classification:read',
      'risk:classification:update',
      'risk:control:read',
      'risk:control:create',
      'risk:control:update'
    ]
  },

  backend_config: {
    api_prefix: '/api/risk',
    routes_path: 'routes',
    database_tables: ['asset_risk_levels', 'risk_control_measures', 'risk_assessment_records'],
    services: [
      { name: 'RiskAssessmentService', path: 'services/risk-assessment.service' },
      { name: 'RiskControlService', path: 'services/risk-control.service' },
    ],
    api_endpoints: [
      { method: 'GET', path: '/api/risk/assessments', handler: 'getRiskAssessments', permissions: ['risk:assessment:read'] },
      { method: 'GET', path: '/api/risk/assessments/:id', handler: 'getRiskAssessmentById', permissions: ['risk:assessment:read'] },
      { method: 'POST', path: '/api/risk/assessments', handler: 'createRiskAssessment', permissions: ['risk:assessment:create'] },
      { method: 'PUT', path: '/api/risk/assessments/:id', handler: 'updateRiskAssessment', permissions: ['risk:assessment:update'] },
      { method: 'DELETE', path: '/api/risk/assessments/:id', handler: 'deleteRiskAssessment', permissions: ['risk:assessment:delete'] },
      { method: 'GET', path: '/api/risk/controls', handler: 'getRiskControls', permissions: ['risk:control:read'] },
      { method: 'GET', path: '/api/risk/controls/:id', handler: 'getRiskControlById', permissions: ['risk:control:read'] },
      { method: 'POST', path: '/api/risk/controls', handler: 'createRiskControl', permissions: ['risk:control:create'] },
      { method: 'PUT', path: '/api/risk/controls/:id', handler: 'updateRiskControl', permissions: ['risk:control:update'] },
      { method: 'DELETE', path: '/api/risk/controls/:id', handler: 'deleteRiskControl', permissions: ['risk:control:delete'] },
      { method: 'GET', path: '/api/risk/controls/high-risk/assets', handler: 'getHighRiskAssets', permissions: ['risk:read'] },
    ],
    permissions: [
      'risk:read',
      'risk:assessment:read',
      'risk:assessment:create',
      'risk:assessment:update',
      'risk:assessment:delete',
      'risk:classification:read',
      'risk:classification:update',
      'risk:control:read',
      'risk:control:create',
      'risk:control:update',
      'risk:control:delete',
    ],
  },

  config_schema: [
    {
      key: 'risk_assessment_enabled',
      name: '启用风险评估',
      type: 'boolean',
      default: true
    },
    {
      key: 'auto_risk_classification',
      name: '自动风险分级',
      type: 'boolean',
      default: true,
      description: '根据评估分数自动确定风险等级'
    },
    {
      key: 'critical_risk_threshold',
      name: '灾难性风险阈值',
      type: 'number',
      default: 90,
      min: 0,
      max: 100,
      description: '风险评分高于此值为灾难性风险（ISO 14971最高级别）'
    },
    {
      key: 'high_risk_threshold',
      name: '高风险阈值',
      type: 'number',
      default: 70,
      min: 0,
      max: 100,
      description: '风险评分高于此值为高风险'
    },
    {
      key: 'medium_risk_threshold',
      name: '中风险阈值',
      type: 'number',
      default: 40,
      min: 0,
      max: 100,
      description: '风险评分高于此值为中风险'
    },
    {
      key: 'risk_assessment_cycle_months',
      name: '风险评估周期(月)',
      type: 'number',
      default: 12,
      min: 1,
      max: 36,
      description: '高风险设备建议每6个月评估一次'
    },
    {
      key: 'critical_risk_alert_enabled',
      name: '灾难性风险预警',
      type: 'boolean',
      default: true,
      description: '启用灾难性风险设备实时预警'
    },
    {
      key: 'high_risk_alert_enabled',
      name: '高风险设备预警',
      type: 'boolean',
      default: true
    },
    {
      key: 'risk_assessment_items',
      name: '风险评估项目',
      type: 'multi_select',
      options: [
        { label: '设备重要性', value: 'importance' },
        { label: '使用频率', value: 'usage_frequency' },
        { label: '故障历史', value: 'failure_history' },
        { label: '使用年限', value: 'age' },
        { label: '维修成本', value: 'maintenance_cost' },
        { label: '安全风险', value: 'safety_risk' }
      ],
      default: ['importance', 'usage_frequency', 'failure_history', 'age', 'safety_risk']
    }
  ],

  default_config: {
    risk_assessment_enabled: true,
    auto_risk_classification: true,
    high_risk_threshold: 80,
    medium_risk_threshold: 50,
    risk_assessment_cycle_months: 12,
    high_risk_alert_enabled: true,
    critical_risk_alert_enabled: true,
    critical_risk_threshold: 90,
    risk_assessment_items: ['importance', 'usage_frequency', 'failure_history', 'age', 'safety_risk']
  },

  migrations: [
    {
      version: '1.0.0',
      script: 'migrations/001_create_risk_tables.sql',
      description: '创建设备风险管理相关表'
    }
  ],

  interfaces: [
    {
      name: 'IRiskAssessmentService',
      type: 'service',
      methods: [
        { name: 'assessAssetRisk', input: { assetId: 'number', assessmentData: 'AssessmentData' }, output: 'RiskAssessmentResult' },
        { name: 'getAssetRiskLevel', input: { assetId: 'number' }, output: 'RiskLevel' },
        { name: 'getHighRiskAssets', input: { threshold: 'number' }, output: 'Asset[]' }
      ]
    }
  ]
};
