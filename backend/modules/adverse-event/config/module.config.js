module.exports = {
  id: 'adverse-event',
  name: '不良事件',
  version: '1.0.0',
  description:
    '提供完整的不良事件功能，包括事件上报、分类分级、处理流程跟踪、根本原因分析及预防措施管理等。',
  category: '质量与安全',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  created_at: '2026-01-29T00:00:00Z',
  updated_at: '2026-01-29T00:00:00Z',

  dependencies: [
    {
      module_id: 'quality-common',
      dependency_type: 'required',
      min_version: '1.0.0',
      max_version: '2.0.0',
    },
    {
      module_id: 'asset-management',
      dependency_type: 'required',
      min_version: '1.0.0',
      max_version: '2.0.0',
    },
    {
      module_id: 'user-management',
      dependency_type: 'required',
      min_version: '1.0.0',
      max_version: '2.0.0',
    },
  ],

  compatibility: {
    min_node_version: '14.0.0',
    max_node_version: '24.0.0',
    supported_databases: ['mysql'],
    browser_compatibility: {
      chrome: '>=80',
      firefox: '>=75',
      safari: '>=13',
      edge: '>=80',
    },
  },

  frontend_config: {
    menu_keys: ['/adverse-event-parent', '/adverse-reaction'],
    menu_prefixes: ['/adverse-reaction', '/adverse-events'],
    routes: [
      {
        key: '/adverse-reaction',
        icon: 'AlertOutlined',
        label: '不良事件',
        path: '/adverse-reaction',
        component: 'AdverseReactionList',
        permissions: ['adverse-event:read'],
        parent: '/adverse-event-parent',
        order: 1,
      },
      {
        key: '/adverse-reaction/new',
        icon: 'PlusOutlined',
        label: '新增不良事件',
        path: '/adverse-reaction/new',
        component: 'AdverseReactionForm',
        permissions: ['adverse-event:create'],
        parent: '/adverse-reaction',
        order: 2,
      },
      {
        key: '/adverse-reaction/edit/:id',
        icon: 'EditOutlined',
        label: '编辑不良事件',
        path: '/adverse-reaction/edit/:id',
        component: 'AdverseReactionForm',
        permissions: ['adverse-event:update'],
        parent: '/adverse-reaction',
        order: 3,
      },
      {
        key: '/adverse-reaction/:id',
        icon: 'EyeOutlined',
        label: '不良事件详情',
        path: '/adverse-reaction/:id',
        component: 'AdverseReactionDetail',
        permissions: ['adverse-event:read'],
        parent: '/adverse-reaction',
        order: 4,
      },
    ],
    // 仅保留已实现页面；工作流列表/分析看板/预防措施/根因分析表单待实现后再加入 components
    components: [
      {
        name: 'AdverseReactionList',
        path: 'pages/AdverseReactionList',
        export: 'default',
      },
      {
        name: 'AdverseReactionForm',
        path: 'pages/AdverseReactionForm',
        export: 'default',
      },
      {
        name: 'AdverseReactionDetail',
        path: 'pages/AdverseReactionDetail',
        export: 'default',
      },
    ],
    permissions: [
      'adverse-event:read',
      'adverse-event:create',
      'adverse-event:update',
      'adverse-event:delete',
      'adverse-event:workflow:read',
      'adverse-event:workflow:update',
      'adverse-event:analysis:read',
      'adverse-event:preventive:read',
      'adverse-event:preventive:create',
    ],
  },

  backend_config: {
    api_endpoints: [
      {
        method: 'GET',
        path: '/api/adverse-reaction',
        handler: 'getAdverseReactionList',
        permissions: ['adverse-event:read'],
      },
      {
        method: 'GET',
        path: '/api/adverse-reaction/:id',
        handler: 'getAdverseReactionById',
        permissions: ['adverse-event:read'],
      },
      {
        method: 'POST',
        path: '/api/adverse-reaction',
        handler: 'createAdverseReaction',
        permissions: ['adverse-event:create'],
      },
      {
        method: 'PUT',
        path: '/api/adverse-reaction/:id',
        handler: 'updateAdverseReaction',
        permissions: ['adverse-event:update'],
      },
      {
        method: 'DELETE',
        path: '/api/adverse-reaction/:id',
        handler: 'deleteAdverseReaction',
        permissions: ['adverse-event:delete'],
      },
      {
        method: 'POST',
        path: '/api/adverse-reaction/:id/attachments',
        handler: 'uploadAttachment',
        permissions: ['adverse-event:update'],
      },
      {
        method: 'DELETE',
        path: '/api/adverse-reaction/attachments/:id',
        handler: 'deleteAttachment',
        permissions: ['adverse-event:update'],
      },
      {
        method: 'POST',
        path: '/api/adverse-reaction/:id/approve',
        handler: 'approveAdverseReaction',
        permissions: ['adverse-event:workflow:update'],
      },
      {
        method: 'POST',
        path: '/api/adverse-reaction/:id/close',
        handler: 'closeAdverseReaction',
        permissions: ['adverse-event:update'],
      },
      {
        method: 'GET',
        path: '/api/adverse-reaction/:id/workflow',
        handler: 'getWorkflow',
        permissions: ['adverse-event:workflow:read'],
      },
      {
        method: 'GET',
        path: '/api/adverse-reaction/statistics/overview',
        handler: 'getAdverseReactionStatistics',
        permissions: ['adverse-event:analysis:read'],
      },
      {
        method: 'GET',
        path: '/api/adverse-reaction/statistics/by-department',
        handler: 'getStatisticsByDepartment',
        permissions: ['adverse-event:analysis:read'],
      },
      {
        method: 'GET',
        path: '/api/adverse-reaction/statistics/by-asset',
        handler: 'getStatisticsByAsset',
        permissions: ['adverse-event:analysis:read'],
      },
      {
        method: 'GET',
        path: '/api/adverse-reaction/statistics/handle-efficiency',
        handler: 'getHandleEfficiency',
        permissions: ['adverse-event:analysis:read'],
      },
      {
        method: 'GET',
        path: '/api/adverse-reaction/alerts/overdue',
        handler: 'getOverdueAlerts',
        permissions: ['adverse-event:analysis:read'],
      },
    ],
    database_tables: [
      'adverse_reaction_records',
      'adverse_reaction_attachments',
      'adverse_reaction_workflow',
      'root_cause_analyses',
      'preventive_measures',
    ],
    services: [
      {
        name: 'AdverseEventService',
        path: 'services/adverse-event.service',
      },
      {
        name: 'WorkflowService',
        path: 'services/workflow.service',
      },
      {
        name: 'AnalysisService',
        path: 'services/analysis.service',
      },
    ],
    permissions: [
      'adverse-event:read',
      'adverse-event:create',
      'adverse-event:update',
      'adverse-event:delete',
      'adverse-event:workflow:read',
      'adverse-event:workflow:update',
      'adverse-event:analysis:read',
      'adverse-event:preventive:read',
      'adverse-event:preventive:create',
    ],
  },

  config_schema: [
    {
      key: 'enable_adverse_event',
      name: '启用不良事件',
      type: 'boolean',
      required: false,
      default: true,
      description: '是否启用不良事件功能',
    },
    {
      key: 'event_reporting_channels',
      name: '事件上报渠道',
      type: 'multi_select',
      required: false,
      default: ['system', 'email', 'phone'],
      description: '支持的事件上报渠道',
      options: [
        { label: '系统内上报', value: 'system' },
        { label: '邮件上报', value: 'email' },
        { label: '电话上报', value: 'phone' },
        { label: '移动端上报', value: 'mobile' },
      ],
    },
    {
      key: 'severity_levels',
      name: '严重程度级别定义',
      type: 'text',
      required: false,
      default: JSON.stringify([
        { level: 1, name: '轻微', description: '影响较小，无需特殊处理' },
        { level: 2, name: '一般', description: '需要关注，影响正常使用' },
        { level: 3, name: '严重', description: '影响较大，需要紧急处理' },
        { level: 4, name: '特别严重', description: '影响重大，可能导致安全事故' },
      ]),
      description: '不良事件严重程度的级别定义',
    },
    {
      key: 'workflow_timeout_days',
      name: '工作流超时天数',
      type: 'number',
      required: false,
      default: 7,
      description: '工作流处理的超时天数',
      validation: {
        min: 1,
        max: 30,
      },
    },
    {
      key: 'analysis_retention_period',
      name: '分析记录保留期限',
      type: 'number',
      required: false,
      default: 730,
      description: '不良事件分析记录的保留期限（天）',
      validation: {
        min: 365,
        max: 3650,
      },
    },
    {
      key: 'enable_auto_escalation',
      name: '启用自动升级',
      type: 'boolean',
      required: false,
      default: true,
      description: '是否启用工作流自动升级功能',
    },
    {
      key: 'escalation_threshold_hours',
      name: '升级阈值（小时）',
      type: 'number',
      required: false,
      default: 24,
      description: '工作流升级的时间阈值（小时）',
      validation: {
        min: 1,
        max: 168,
      },
    },
    {
      key: 'max_records_per_page',
      name: '每页最大记录数',
      type: 'number',
      required: false,
      default: 50,
      description: '列表页面每页显示的最大记录数',
      validation: {
        min: 10,
        max: 200,
      },
    },
  ],

  default_config: {
    enable_adverse_event: true,
    event_reporting_channels: ['system', 'email', 'phone'],
    severity_levels: JSON.stringify([
      { level: 1, name: '轻微', description: '影响较小，无需特殊处理' },
      { level: 2, name: '一般', description: '需要关注，影响正常使用' },
      { level: 3, name: '严重', description: '影响较大，需要紧急处理' },
      { level: 4, name: '特别严重', description: '影响重大，可能导致安全事故' },
    ]),
    workflow_timeout_days: 7,
    analysis_retention_period: 730,
    enable_auto_escalation: true,
    escalation_threshold_hours: 24,
    max_records_per_page: 50,
  },

  interfaces: [
    {
      name: 'IAdverseEventService',
      type: 'service',
      methods: [
        {
          name: 'getAdverseEventById',
          input: {
            id: 'number',
          },
          output: 'AdverseEvent',
          description: '根据ID获取不良事件',
        },
        {
          name: 'createAdverseEvent',
          input: {
            data: 'AdverseEventData',
          },
          output: 'AdverseEvent',
          description: '创建不良事件',
        },
        {
          name: 'updateAdverseEvent',
          input: {
            id: 'number',
            data: 'AdverseEventData',
          },
          output: 'AdverseEvent',
          description: '更新不良事件',
        },
        {
          name: 'deleteAdverseEvent',
          input: {
            id: 'number',
          },
          output: 'boolean',
          description: '删除不良事件',
        },
        {
          name: 'getAdverseEventStatistics',
          input: {},
          output: 'AdverseEventStatistics',
          description: '获取不良事件统计',
        },
      ],
    },
    {
      name: 'IWorkflowService',
      type: 'service',
      methods: [
        {
          name: 'startWorkflow',
          input: {
            eventId: 'number',
            data: 'WorkflowData',
          },
          output: 'Workflow',
          description: '启动工作流',
        },
        {
          name: 'updateWorkflowStatus',
          input: {
            workflowId: 'number',
            status: 'string',
          },
          output: 'Workflow',
          description: '更新工作流状态',
        },
        {
          name: 'getWorkflowHistory',
          input: {
            eventId: 'number',
          },
          output: 'WorkflowHistory[]',
          description: '获取工作流历史',
        },
        {
          name: 'getPendingWorkflows',
          input: {},
          output: 'Workflow[]',
          description: '获取待处理工作流',
        },
      ],
    },
    {
      name: 'IAnalysisService',
      type: 'service',
      methods: [
        {
          name: 'analyzeRootCause',
          input: {
            eventId: 'number',
            data: 'RootCauseAnalysisData',
          },
          output: 'RootCauseAnalysis',
          description: '分析根本原因',
        },
        {
          name: 'generatePreventiveMeasures',
          input: {
            eventId: 'number',
            data: 'PreventiveMeasuresData',
          },
          output: 'PreventiveMeasures',
          description: '生成预防措施',
        },
        {
          name: 'analyzeEventTrends',
          input: {
            params: 'AnalysisParams',
          },
          output: 'EventTrendData',
          description: '分析事件趋势',
        },
        {
          name: 'generateRiskAssessment',
          input: {
            eventId: 'number',
          },
          output: 'RiskAssessment',
          description: '生成风险评估',
        },
      ],
    },
  ],

  deployment: {
    resources: {
      min_memory: '256MB',
      max_memory: '1GB',
      min_cpu: '0.5',
      max_cpu: '2',
    },
    scaling: {
      enabled: false,
      min_instances: 1,
      max_instances: 1,
    },
    health_check: {
      enabled: true,
      endpoint: '/api/adverse-reaction/health',
      interval: 30,
      timeout: 10,
      retries: 3,
    },
  },

  monitoring: {
    metrics: {
      enabled: true,
      endpoint: '/api/adverse-reaction/metrics',
      interval: 60,
    },
    logging: {
      level: 'info',
      format: 'json',
      retention: 7,
    },
    alerts: {
      enabled: true,
      thresholds: {
        error_rate: 0.01,
        response_time: 1000,
        queue_size: 100,
      },
    },
  },
};
