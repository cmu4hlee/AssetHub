module.exports = {
  id: 'quality-common',
  name: '平台公共能力',
  version: '1.0.0',
  description:
    '提供权限管理、数据字典、日志记录等平台级基础能力，为业务模块提供统一支撑。',
  category: '系统基础',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',

  dependencies: [
    {
      module_id: 'user-management',
      dependency_type: 'required',
      min_version: '1.0.0',
      max_version: null,
    },
  ],

  compatibility: [],

  // 权限/数据字典/日志查看页面暂未实现，已移除菜单与组件引用，避免 404；后续可在此补充 menu_routes/components
  frontend_config: {
    menu_routes: [],
    components: [],
    permissions: ['admin', 'quality_manager', 'operator'],
  },

  backend_config: {
    api_endpoints: [
      { method: 'GET', path: '/api/quality/common/permissions', handler: 'getPermissions', permissions: ['admin'] },
      { method: 'POST', path: '/api/quality/common/permissions', handler: 'createPermission', permissions: ['admin'] },
      { method: 'PUT', path: '/api/quality/common/permissions/:id', handler: 'updatePermission', permissions: ['admin'] },
      { method: 'DELETE', path: '/api/quality/common/permissions/:id', handler: 'deletePermission', permissions: ['admin'] },
      { method: 'GET', path: '/api/quality/common/dictionary', handler: 'getDictionary', permissions: ['admin', 'quality_manager'] },
      { method: 'GET', path: '/api/quality/common/dictionary/:type', handler: 'getDictionaryByType', permissions: ['admin', 'quality_manager', 'operator'] },
      { method: 'POST', path: '/api/quality/common/dictionary', handler: 'createDictionaryItem', permissions: ['admin', 'quality_manager'] },
      { method: 'PUT', path: '/api/quality/common/dictionary/:id', handler: 'updateDictionaryItem', permissions: ['admin', 'quality_manager'] },
      { method: 'DELETE', path: '/api/quality/common/dictionary/:id', handler: 'deleteDictionaryItem', permissions: ['admin', 'quality_manager'] },
      { method: 'GET', path: '/api/quality/common/logs', handler: 'getLogs', permissions: ['admin'] },
      { method: 'POST', path: '/api/quality/common/logs', handler: 'createLog', permissions: [] },
    ],
    database_tables: ['quality_permissions', 'quality_dictionary_items', 'quality_logs'],
    services: [
      { name: 'QualityCommonService', path: 'services/quality-common.service' },
    ],
    permissions: ['admin', 'quality_manager', 'operator'],
  },

  config_schema: [
    {
      key: 'logLevel',
      name: '日志级别',
      type: 'string',
      required: false,
      default: 'info',
      description: '系统日志级别',
      validation: {
        enum: ['debug', 'info', 'warn', 'error'],
      },
    },
    {
      key: 'logRetentionDays',
      name: '日志保留天数',
      type: 'number',
      required: false,
      default: 30,
      description: '系统日志保留天数',
      validation: {
        min: 1,
        max: 365,
      },
    },
  ],
  default_config: {
    logLevel: 'info',
    logRetentionDays: 30,
  },

  interfaces: [
    {
      name: 'IPermissionService',
      type: 'service',
      methods: [
        {
          name: 'getPermissions',
          input: {},
          output: 'Array<Permission>',
          description: '获取所有权限',
        },
        {
          name: 'createPermission',
          input: { permission: 'Permission' },
          output: 'Permission',
          description: '创建新权限',
        },
        {
          name: 'updatePermission',
          input: { id: 'string', permission: 'Permission' },
          output: 'Permission',
          description: '更新权限',
        },
        {
          name: 'deletePermission',
          input: { id: 'string' },
          output: 'boolean',
          description: '删除权限',
        },
      ],
    },
    {
      name: 'IDictionaryService',
      type: 'service',
      methods: [
        {
          name: 'getDictionary',
          input: {},
          output: 'Array<DictionaryItem>',
          description: '获取所有数据字典',
        },
        {
          name: 'getDictionaryByType',
          input: { type: 'string' },
          output: 'Array<DictionaryItem>',
          description: '根据类型获取数据字典',
        },
        {
          name: 'createDictionaryItem',
          input: { item: 'DictionaryItem' },
          output: 'DictionaryItem',
          description: '创建字典项',
        },
        {
          name: 'updateDictionaryItem',
          input: { id: 'string', item: 'DictionaryItem' },
          output: 'DictionaryItem',
          description: '更新字典项',
        },
        {
          name: 'deleteDictionaryItem',
          input: { id: 'string' },
          output: 'boolean',
          description: '删除字典项',
        },
      ],
    },
    {
      name: 'ILogService',
      type: 'service',
      methods: [
        {
          name: 'getLogs',
          input: { filters: 'object' },
          output: 'Array<Log>',
          description: '获取系统日志',
        },
        {
          name: 'createLog',
          input: { log: 'Log' },
          output: 'Log',
          description: '创建系统日志',
        },
      ],
    },
  ],
};
