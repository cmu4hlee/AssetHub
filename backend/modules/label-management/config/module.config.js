module.exports = {
  id: 'label-management',
  name: '标签管理',
  version: '1.0.0',
  description: '独立的资产标签管理模块，负责标签模板与标签打印。',
  category: '资产生命周期',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  created_at: '2026-02-21T00:00:00Z',
  updated_at: '2026-02-21T00:00:00Z',

  dependencies: [
    {
      module_id: 'asset-management',
      dependency_type: 'required',
      min_version: '1.0.0',
      max_version: '2.0.0',
    },
  ],

  compatibility: [],

  frontend_config: {
    menu_keys: ['/label-management-parent', '/asset-labels/templates', '/asset-labels/print'],
    menu_prefixes: ['/asset-labels'],
    menu_routes: [
      {
        key: '/asset-labels/templates',
        icon: 'PrinterOutlined',
        label: '标签模板管理',
        path: '/asset-labels/templates',
        component: 'AssetLabelTemplateList',
        permissions: ['asset:label:read'],
      },
      {
        key: '/asset-labels/print',
        icon: 'PrinterOutlined',
        label: '标签打印',
        path: '/asset-labels/print',
        component: 'AssetLabelPrint',
        permissions: ['asset:label:print'],
      },
    ],
    components: [
      {
        name: 'AssetLabelTemplateList',
        path: 'pages/AssetLabelTemplateList',
        export: 'default',
      },
      {
        name: 'AssetLabelPrint',
        path: 'pages/AssetLabelPrint',
        export: 'default',
      },
    ],
    permissions: ['asset:label:read', 'asset:label:create', 'asset:label:print'],
  },

  backend_config: {
    api_endpoints: [
      {
        method: 'GET',
        path: '/api/asset-labels/templates',
        handler: 'getTemplates',
        permissions: ['asset:label:read'],
      },
      {
        method: 'GET',
        path: '/api/asset-labels/templates/:id',
        handler: 'getTemplateById',
        permissions: ['asset:label:read'],
      },
      {
        method: 'POST',
        path: '/api/asset-labels/templates',
        handler: 'createTemplate',
        permissions: ['asset:label:create'],
      },
      {
        method: 'PUT',
        path: '/api/asset-labels/templates/:id',
        handler: 'updateTemplate',
        permissions: ['asset:label:update'],
      },
      {
        method: 'DELETE',
        path: '/api/asset-labels/templates/:id',
        handler: 'deleteTemplate',
        permissions: ['asset:label:delete'],
      },
      {
        method: 'GET',
        path: '/api/asset-labels/generate-zpl/:templateId/:assetCode',
        handler: 'generateZPL',
        permissions: ['asset:label:read'],
      },
      {
        method: 'POST',
        path: '/api/asset-labels/generate-zpl-batch',
        handler: 'generateZPLBatch',
        permissions: ['asset:label:read'],
      },
      {
        method: 'POST',
        path: '/api/asset-labels/print',
        handler: 'printLabel',
        permissions: ['asset:label:print'],
      },
      {
        method: 'POST',
        path: '/api/asset-labels/printer/test-connection',
        handler: 'testPrinterConnection',
        permissions: ['asset:label:print'],
      },
      {
        method: 'GET',
        path: '/api/asset-labels/print-queue',
        handler: 'getPrintQueue',
        permissions: ['asset:label:read'],
      },
      {
        method: 'PUT',
        path: '/api/asset-labels/print-queue/:id/status',
        handler: 'updatePrintQueueStatus',
        permissions: ['asset:label:manage'],
      },
      {
        method: 'GET',
        path: '/api/asset-labels/health',
        handler: 'getModuleHealth',
        permissions: [],
      },
    ],
    database_tables: [
      'asset_label_templates',
      'asset_label_print_queue',
    ],
    services: [
      {
        name: 'LabelService',
        path: 'services/label.service',
      },
    ],
    controllers: [
      {
        name: 'LabelController',
        path: 'controllers/label.controller',
      },
    ],
    permissions: [
      'asset:label:read',
      'asset:label:create',
      'asset:label:update',
      'asset:label:delete',
      'asset:label:print',
      'asset:label:manage',
    ],
  },

  config_schema: [
    {
      key: 'enable_template_management',
      name: '启用模板管理',
      type: 'boolean',
      required: false,
      default: true,
      group: '基础设置',
      description: '是否允许维护标签模板。',
    },
    {
      key: 'default_label_size',
      name: '默认标签尺寸',
      type: 'select',
      required: false,
      default: '70x40',
      group: '基础设置',
      description: '新建模板和打印时默认尺寸。',
      options: [
        { label: '50x30 mm', value: '50x30' },
        { label: '70x40 mm', value: '70x40' },
        { label: '100x60 mm', value: '100x60' },
      ],
    },
    {
      key: 'print_dpi',
      name: '打印精度(DPI)',
      type: 'select',
      required: false,
      default: 203,
      group: '数据与性能',
      description: '标签打印精度。',
      options: [
        { label: '203 DPI', value: 203 },
        { label: '300 DPI', value: 300 },
      ],
    },
    {
      key: 'auto_generate_qrcode',
      name: '自动生成二维码',
      type: 'boolean',
      required: false,
      default: true,
      group: '流程设置',
      description: '打印标签时自动生成二维码内容。',
    },
    {
      key: 'max_print_quantity',
      name: '单次最大打印数量',
      type: 'number',
      required: false,
      default: 200,
      group: '数据与性能',
      description: '单次打印最大数量限制。',
      validation: {
        min: 1,
        max: 2000,
      },
    },
    {
      key: 'printer_connection_timeout',
      name: '打印机连接超时(秒)',
      type: 'number',
      required: false,
      default: 10,
      group: '高级设置',
      description: '连接打印机超时阈值。',
      validation: {
        min: 3,
        max: 60,
      },
    },
  ],
  default_config: {
    enable_template_management: true,
    default_label_size: '70x40',
    print_dpi: 203,
    auto_generate_qrcode: true,
    max_print_quantity: 200,
    printer_connection_timeout: 10,
  },

  interfaces: [
    {
      path: '/api/asset-labels/templates',
      method: 'GET',
      description: '获取标签模板列表',
    },
    {
      path: '/api/asset-labels/templates',
      method: 'POST',
      description: '创建标签模板',
    },
    {
      path: '/api/asset-labels/print',
      method: 'POST',
      description: '执行标签打印',
    },
  ],
};
