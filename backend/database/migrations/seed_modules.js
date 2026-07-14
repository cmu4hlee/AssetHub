const fs = require('fs');
const path = require('path');
const db = require('../../config/database');

async function seedModules() {
  try {
    console.log('开始初始化模块数据...');

    const defaultModules = [
      {
        id: 'asset-management',
        name: '资产管理',
        version: '1.0.0',
        description: '企业资产管理核心模块，支持固定资产、无形资产等全生命周期管理',
        category: '核心业务',
        type: 'core',
        status: 'stable',
        author: 'System',
        dependencies: null,
        compatibility: null,
        frontend_config: JSON.stringify({
          routes: ['/assets', '/assets/add', '/assets/edit', '/assets/detail'],
          components: ['AssetList', 'AssetForm', 'AssetDetail'],
          permissions: ['asset:view', 'asset:add', 'asset:edit', 'asset:delete'],
          menu_prefixes: [
            '/assets',
            '/inventory',
            '/dashboard-configs',
            '/cloud-sync',
          ],
        }),
        backend_config: JSON.stringify({
          routes: ['/api/assets', '/api/assets/*'],
          services: ['assetService', 'assetCategoryService'],
          permissions: ['asset:view', 'asset:add', 'asset:edit', 'asset:delete'],
        }),
        config_schema: null,
        default_config: null,
        interfaces: JSON.stringify([
          {
            path: '/api/assets/list',
            method: 'GET',
            description: '获取资产列表',
          },
          {
            path: '/api/assets/add',
            method: 'POST',
            description: '添加资产',
          },
          {
            path: '/api/assets/edit/:id',
            method: 'PUT',
            description: '编辑资产',
          },
          {
            path: '/api/assets/delete/:id',
            method: 'DELETE',
            description: '删除资产',
          },
        ]),
      },
      {
        id: 'user-management',
        name: '用户管理',
        version: '1.0.0',
        description: '用户账户和个人信息管理模块',
        category: '系统管理',
        type: 'core',
        status: 'stable',
        author: 'System',
        dependencies: null,
        compatibility: null,
        frontend_config: JSON.stringify({
          routes: ['/users', '/users/add', '/users/edit', '/users/detail'],
          components: ['UserList', 'UserForm', 'UserDetail'],
          permissions: ['user:view', 'user:add', 'user:edit', 'user:delete'],
          menu_keys: ['/users'],
        }),
        backend_config: JSON.stringify({
          routes: ['/api/users', '/api/users/*'],
          services: ['userService', 'authService'],
          permissions: ['user:view', 'user:add', 'user:edit', 'user:delete'],
        }),
        config_schema: null,
        default_config: null,
        interfaces: JSON.stringify([
          {
            path: '/api/users/list',
            method: 'GET',
            description: '获取用户列表',
          },
          {
            path: '/api/users/add',
            method: 'POST',
            description: '添加用户',
          },
          {
            path: '/api/users/edit/:id',
            method: 'PUT',
            description: '编辑用户',
          },
          {
            path: '/api/users/delete/:id',
            method: 'DELETE',
            description: '删除用户',
          },
        ]),
      },
      {
        id: 'permission-management',
        name: '权限管理',
        version: '1.0.0',
        description: '角色和权限管理模块',
        category: '系统管理',
        type: 'core',
        status: 'stable',
        author: 'System',
        dependencies: JSON.stringify([
          {
            module_id: 'user-management',
            min_version: '1.0.0',
          },
        ]),
        compatibility: null,
        frontend_config: JSON.stringify({
          routes: ['/permissions', '/roles', '/roles/add', '/roles/edit'],
          components: ['PermissionList', 'RoleList', 'RoleForm'],
          permissions: [
            'permission:view',
            'permission:edit',
            'role:add',
            'role:edit',
            'role:delete',
          ],
          menu_keys: ['/roles-permissions'],
        }),
        backend_config: JSON.stringify({
          routes: ['/api/permissions', '/api/roles', '/api/roles/*'],
          services: ['permissionService', 'roleService'],
          permissions: [
            'permission:view',
            'permission:edit',
            'role:add',
            'role:edit',
            'role:delete',
          ],
        }),
        config_schema: null,
        default_config: null,
        interfaces: JSON.stringify([
          {
            path: '/api/roles/list',
            method: 'GET',
            description: '获取角色列表',
          },
          {
            path: '/api/roles/add',
            method: 'POST',
            description: '添加角色',
          },
          {
            path: '/api/roles/edit/:id',
            method: 'PUT',
            description: '编辑角色',
          },
          {
            path: '/api/roles/delete/:id',
            method: 'DELETE',
            description: '删除角色',
          },
          {
            path: '/api/permissions/list',
            method: 'GET',
            description: '获取权限列表',
          },
        ]),
      },
      {
        id: 'module-management',
        name: '模块管理',
        version: '1.0.0',
        description: '系统模块管理和配置模块',
        category: '系统管理',
        type: 'core',
        status: 'stable',
        author: 'System',
        dependencies: null,
        compatibility: null,
        frontend_config: JSON.stringify({
          routes: ['/modules', '/modules/register', '/modules/detail', '/modules/config'],
          components: ['ModuleList', 'ModuleForm', 'ModuleDetail', 'ModuleConfig'],
          permissions: [
            'module:view',
            'module:register',
            'module:edit',
            'module:delete',
            'module:config',
          ],
          menu_keys: ['/modules'],
        }),
        backend_config: JSON.stringify({
          routes: ['/api/modules', '/api/modules/*'],
          services: ['moduleService'],
          permissions: [
            'module:view',
            'module:register',
            'module:edit',
            'module:delete',
            'module:config',
          ],
        }),
        config_schema: null,
        default_config: null,
        interfaces: JSON.stringify([
          {
            path: '/api/modules/list',
            method: 'GET',
            description: '获取模块列表',
          },
          {
            path: '/api/modules/register',
            method: 'POST',
            description: '注册新模块',
          },
          {
            path: '/api/modules/:id',
            method: 'GET',
            description: '获取模块详情',
          },
          {
            path: '/api/modules/:id',
            method: 'PUT',
            description: '编辑模块',
          },
          {
            path: '/api/modules/:id',
            method: 'DELETE',
            description: '删除模块',
          },
        ]),
      },
      {
        id: 'dashboard',
        name: '仪表盘',
        version: '1.0.0',
        description: '系统概览和数据统计仪表盘',
        category: '系统管理',
        type: 'core',
        status: 'stable',
        author: 'System',
        dependencies: JSON.stringify([
          {
            module_id: 'asset-management',
            min_version: '1.0.0',
          },
        ]),
        compatibility: null,
        frontend_config: JSON.stringify({
          routes: ['/dashboard'],
          components: ['Dashboard', 'AssetStats', 'UserStats'],
          permissions: ['dashboard:view'],
          menu_keys: ['/dashboard'],
        }),
        backend_config: JSON.stringify({
          routes: ['/api/dashboard/*'],
          services: ['dashboardService'],
          permissions: ['dashboard:view'],
        }),
        config_schema: null,
        default_config: null,
        interfaces: JSON.stringify([
          {
            path: '/api/dashboard/stats',
            method: 'GET',
            description: '获取仪表盘统计数据',
          },
          {
            path: '/api/dashboard/asset-stats',
            method: 'GET',
            description: '获取资产统计数据',
          },
          {
            path: '/api/dashboard/user-stats',
            method: 'GET',
            description: '获取用户统计数据',
          },
        ]),
      },
    ];

    for (const module of defaultModules) {
      try {
        // 检查模块是否已存在
        const [existingModules] = await db.execute('SELECT id FROM system_modules WHERE id = ?', [
          module.id,
        ]);

        if (existingModules.length > 0) {
          console.log(`⚠️  模块 ${module.name} (${module.id}) 已存在，跳过...`);
          continue;
        }

        await db.execute(
          `INSERT INTO system_modules (
            id, name, version, description, category, type, status, author,
            dependencies, compatibility, frontend_config, backend_config,
            config_schema, default_config, interfaces
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            module.id,
            module.name,
            module.version,
            module.description,
            module.category,
            module.type,
            module.status,
            module.author,
            module.dependencies,
            module.compatibility,
            module.frontend_config,
            module.backend_config,
            module.config_schema,
            module.default_config,
            module.interfaces,
          ],
        );

        console.log(`✅ 成功添加模块: ${module.name} (${module.id})`);
      } catch (error) {
        console.error(`❌ 添加模块 ${module.name} 失败:`, error.message);
      }
    }

    console.log('✅ 模块数据初始化完成！');
  } catch (error) {
    console.error('❌ 初始化模块数据失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  }
}

seedModules();
