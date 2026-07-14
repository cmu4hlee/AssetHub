module.exports = {
  id: 'department-management',
  name: '部门管理',
  version: '1.0.0',
  description: '提供部门管理功能，包括部门创建、编辑、删除、层级管理等。',
  category: '系统基础',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',

  dependencies: [],

  compatibility: [],

  frontend_config: {
    menu_routes: [
      {
        key: '/departments',
        icon: 'ApartmentOutlined',
        label: '部门管理',
        path: '/departments',
        component: 'DepartmentList',
        permissions: ['department:read'],
      },
      {
        key: '/departments/new',
        icon: 'PlusOutlined',
        label: '新增部门',
        path: '/departments/new',
        component: 'DepartmentForm',
        permissions: ['department:create'],
        parent: '/departments',
      },
    ],
    components: [
      {
        name: 'DepartmentList',
        path: 'pages/DepartmentList',
        export: 'default',
      },
      {
        name: 'DepartmentForm',
        path: 'pages/DepartmentForm',
        export: 'default',
      },
      {
        name: 'DepartmentDetail',
        path: 'pages/DepartmentDetail',
        export: 'default',
      },
    ],
    permissions: ['department:read', 'department:create', 'department:update', 'department:delete'],
  },

  backend_config: {
    api_endpoints: [
      { method: 'GET', path: '/api/departments', handler: 'getDepartments', permissions: ['department:read'] },
      { method: 'GET', path: '/api/departments/tree', handler: 'getDepartmentTree', permissions: ['department:read'] },
      { method: 'GET', path: '/api/departments/:id', handler: 'getDepartmentById', permissions: ['department:read'] },
      { method: 'POST', path: '/api/departments', handler: 'createDepartment', permissions: ['department:create'] },
      { method: 'PUT', path: '/api/departments/:id', handler: 'updateDepartment', permissions: ['department:update'] },
      { method: 'DELETE', path: '/api/departments/:id', handler: 'deleteDepartment', permissions: ['department:delete'] },
    ],
    database_tables: ['departments'],
    services: [
      { name: 'DepartmentService', path: 'services/department.service' },
    ],
    controllers: [
      { name: 'DepartmentController', path: 'controllers/department.controller' },
    ],
    permissions: ['department:read', 'department:create', 'department:update', 'department:delete'],
  },

  config_schema: [
    {
      key: 'enable_department_hierarchy',
      name: '启用部门层级',
      type: 'boolean',
      required: false,
      default: true,
      description: '是否启用部门层级管理',
    },
    {
      key: 'max_department_level',
      name: '最大部门层级',
      type: 'number',
      required: false,
      default: 5,
      description: '部门的最大层级数',
      validation: {
        min: 1,
        max: 10,
      },
    },
    {
      key: 'max_departments_per_page',
      name: '每页最大部门数',
      type: 'number',
      required: false,
      default: 50,
      description: '部门列表每页显示的最大数量',
      validation: {
        min: 10,
        max: 200,
      },
    },
  ],
  default_config: {
    enable_department_hierarchy: true,
    max_department_level: 5,
    max_departments_per_page: 50,
  },

  interfaces: [
    {
      name: 'IDepartmentService',
      type: 'service',
      methods: [
        {
          name: 'getDepartmentById',
          input: { id: 'number' },
          output: 'Department',
          description: '根据ID获取部门',
        },
        {
          name: 'getDepartmentTree',
          input: {},
          output: 'DepartmentTree[]',
          description: '获取部门树',
        },
        {
          name: 'createDepartment',
          input: { data: 'DepartmentData' },
          output: 'Department',
          description: '创建部门',
        },
        {
          name: 'updateDepartment',
          input: { id: 'number', data: 'DepartmentData' },
          output: 'Department',
          description: '更新部门',
        },
        {
          name: 'deleteDepartment',
          input: { id: 'number' },
          output: 'boolean',
          description: '删除部门',
        },
      ],
    },
  ],
};
