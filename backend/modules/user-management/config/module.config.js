module.exports = {
  id: 'user-management',
  name: '用户管理',
  version: '1.0.0',
  description: '提供用户管理功能，包括用户创建、编辑、删除、角色分配等。',
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
        key: '/users',
        icon: 'UserOutlined',
        label: '用户管理',
        path: '/users',
        component: 'UserList',
        permissions: ['user:read'],
      },
      {
        key: '/users/new',
        icon: 'PlusOutlined',
        label: '新增用户',
        path: '/users/new',
        component: 'UserForm',
        permissions: ['user:create'],
        parent: '/users',
      },
    ],
    components: [
      {
        name: 'UserList',
        path: 'pages/UserList',
        export: 'default',
      },
      {
        name: 'UserForm',
        path: 'pages/UserForm',
        export: 'default',
      },
    ],
    permissions: ['user:read', 'user:create', 'user:update', 'user:delete'],
  },

  backend_config: {
    api_endpoints: [
      { method: 'POST', path: '/api/users/login', handler: 'login', permissions: [] },
      { method: 'POST', path: '/api/users/register', handler: 'register', permissions: [] },
      { method: 'POST', path: '/api/users/refresh-token', handler: 'refreshToken', permissions: ['auth'] },
      { method: 'POST', path: '/api/users/join-enterprise', handler: 'joinEnterprise', permissions: ['auth'] },
      { method: 'GET', path: '/api/users/profile', handler: 'getProfile', permissions: ['auth'] },
      { method: 'GET', path: '/api/users', handler: 'getUsers', permissions: ['user:read'] },
      { method: 'GET', path: '/api/users/roles', handler: 'getRoles', permissions: ['user:read'] },
      { method: 'GET', path: '/api/users/role-requests/pending', handler: 'getPendingRoleRequests', permissions: ['system_admin'] },
      { method: 'PUT', path: '/api/users/role-requests/:id/approve', handler: 'approveRoleRequest', permissions: ['system_admin'] },
      { method: 'GET', path: '/api/users/pending', handler: 'getPendingUsers', permissions: ['system_admin'] },
      { method: 'PUT', path: '/api/users/:id/approve', handler: 'approveUser', permissions: ['system_admin'] },
      { method: 'GET', path: '/api/users/:id', handler: 'getUserById', permissions: ['user:read'] },
      { method: 'POST', path: '/api/users', handler: 'createUser', permissions: ['user:create'] },
      { method: 'PUT', path: '/api/users/:id', handler: 'updateUser', permissions: ['user:update'] },
      { method: 'DELETE', path: '/api/users/:id', handler: 'deleteUser', permissions: ['user:delete'] },
      { method: 'PUT', path: '/api/users/:id/change-password', handler: 'changePassword', permissions: ['auth'] },
    ],
    database_tables: ['users', 'user_roles', 'user_tenant_roles', 'super_users'],
    services: [
      { name: 'UserService', path: 'services/user.service' },
    ],
    controllers: [
      { name: 'UserController', path: 'controllers/user.controller' },
    ],
    permissions: ['user:read', 'user:create', 'user:update', 'user:delete'],
  },

  config_schema: [
    {
      key: 'enable_user_registration',
      name: '启用用户注册',
      type: 'boolean',
      required: false,
      default: false,
      description: '是否允许用户自行注册',
    },
    {
      key: 'enable_email_verification',
      name: '启用邮箱验证',
      type: 'boolean',
      required: false,
      default: true,
      description: '是否启用邮箱验证',
    },
    {
      key: 'password_min_length',
      name: '密码最小长度',
      type: 'number',
      required: false,
      default: 8,
      description: '用户密码的最小长度',
      validation: {
        min: 6,
        max: 20,
      },
    },
    {
      key: 'max_users_per_page',
      name: '每页最大用户数',
      type: 'number',
      required: false,
      default: 50,
      description: '用户列表每页显示的最大数量',
      validation: {
        min: 10,
        max: 200,
      },
    },
  ],
  default_config: {
    enable_user_registration: false,
    enable_email_verification: true,
    password_min_length: 8,
    max_users_per_page: 50,
  },

  interfaces: [
    {
      name: 'IUserService',
      type: 'service',
      methods: [
        {
          name: 'getUserById',
          input: { id: 'number' },
          output: 'User',
          description: '根据ID获取用户',
        },
        {
          name: 'getUserByUsername',
          input: { username: 'string' },
          output: 'User',
          description: '根据用户名获取用户',
        },
        {
          name: 'createUser',
          input: { data: 'UserData' },
          output: 'User',
          description: '创建用户',
        },
        {
          name: 'updateUser',
          input: { id: 'number', data: 'UserData' },
          output: 'User',
          description: '更新用户',
        },
        {
          name: 'deleteUser',
          input: { id: 'number' },
          output: 'boolean',
          description: '删除用户',
        },
      ],
    },
  ],
};
