const db = require('../config/database');

async function migrate() {
  console.log('开始创建增强权限系统表...');

  try {
    // 1. 创建角色数据范围表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS role_data_scopes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        role VARCHAR(50) NOT NULL COMMENT '角色代码',
        tenant_id INT NOT NULL COMMENT '租户ID',
        data_scope VARCHAR(20) NOT NULL DEFAULT 'own' COMMENT '数据范围: all/department/own/custom',
        custom_department_codes TEXT NULL COMMENT '自定义科室代码列表，逗号分隔',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        UNIQUE KEY uk_role_tenant (role, tenant_id),
        INDEX idx_tenant_id (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色数据范围配置表'
    `);
    console.log('✓ 创建 role_data_scopes 表成功');

    // 2. 创建用户数据范围表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_data_scopes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '用户ID',
        tenant_id INT NOT NULL COMMENT '租户ID',
        data_scope VARCHAR(20) NOT NULL DEFAULT 'own' COMMENT '数据范围: all/department/own/custom',
        custom_department_codes TEXT NULL COMMENT '自定义科室代码列表，逗号分隔',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        UNIQUE KEY uk_user_tenant (user_id, tenant_id),
        INDEX idx_tenant_id (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户数据范围配置表'
    `);
    console.log('✓ 创建 user_data_scopes 表成功');

    // 3. 创建用户权限表（用于覆盖角色权限）
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '用户ID',
        tenant_id INT NOT NULL COMMENT '租户ID',
        permission VARCHAR(100) NOT NULL COMMENT '权限代码',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_permission (user_id, tenant_id, permission),
        INDEX idx_user_id (user_id),
        INDEX idx_tenant_id (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户权限表'
    `);
    console.log('✓ 创建 user_permissions 表成功');

    // 4. 创建用户权限拒绝表（用于排除某些权限）
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_permission_denies (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '用户ID',
        tenant_id INT NOT NULL COMMENT '租户ID',
        permission VARCHAR(100) NOT NULL COMMENT '被拒绝的权限代码',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_deny (user_id, tenant_id, permission),
        INDEX idx_user_id (user_id),
        INDEX idx_tenant_id (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户权限拒绝表'
    `);
    console.log('✓ 创建 user_permission_denies 表成功');

    // 5. 创建用户菜单权限表（用于覆盖角色菜单权限）
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_menu_permissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '用户ID',
        tenant_id INT NOT NULL COMMENT '租户ID',
        menu_key VARCHAR(100) NOT NULL COMMENT '菜单键',
        is_visible TINYINT(1) DEFAULT 1 COMMENT '是否可见',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_menu (user_id, tenant_id, menu_key),
        INDEX idx_user_id (user_id),
        INDEX idx_tenant_id (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户菜单权限表'
    `);
    console.log('✓ 创建 user_menu_permissions 表成功');

    // 6. 创建角色层级表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS role_hierarchy (
        id INT PRIMARY KEY AUTO_INCREMENT,
        role VARCHAR(50) NOT NULL COMMENT '子角色代码',
        parent_role VARCHAR(50) NOT NULL COMMENT '父角色代码',
        inherit_permissions TINYINT(1) DEFAULT 1 COMMENT '是否继承权限',
        inherit_menus TINYINT(1) DEFAULT 1 COMMENT '是否继承菜单',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_role_parent (role, parent_role),
        INDEX idx_parent_role (parent_role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色层级表'
    `);
    console.log('✓ 创建 role_hierarchy 表成功');

    // 7. 创建时间访问控制表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS time_access_controls (
        id INT PRIMARY KEY AUTO_INCREMENT,
        role VARCHAR(50) NOT NULL COMMENT '角色代码',
        tenant_id INT NOT NULL COMMENT '租户ID',
        allowed_hours VARCHAR(100) NOT NULL COMMENT '允许访问的小时，格式: 9-18',
        allowed_days VARCHAR(100) NOT NULL COMMENT '允许访问的星期，格式: 1,2,3,4,5',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        UNIQUE KEY uk_role_tenant_time (role, tenant_id),
        INDEX idx_tenant_id (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='时间访问控制表'
    `);
    console.log('✓ 创建 time_access_controls 表成功');

    // 8. 创建权限变更日志表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS permission_audit_logs (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '操作用户ID',
        tenant_id INT NOT NULL COMMENT '租户ID',
        action VARCHAR(50) NOT NULL COMMENT '操作类型: grant/deny/revoke/change_scope',
        target_type VARCHAR(20) NOT NULL COMMENT '目标类型: role/user',
        target_id VARCHAR(100) NOT NULL COMMENT '目标ID',
        permission VARCHAR(100) NULL COMMENT '权限代码',
        old_value TEXT NULL COMMENT '旧值',
        new_value TEXT NULL COMMENT '新值',
        ip_address VARCHAR(45) NULL COMMENT 'IP地址',
        user_agent TEXT NULL COMMENT 'User Agent',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_target (target_type, target_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限变更审计日志表'
    `);
    console.log('✓ 创建 permission_audit_logs 表成功');

    // 9. 创建资源权限定义表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS resource_permissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        resource_type VARCHAR(50) NOT NULL COMMENT '资源类型: asset/device/maintenance等',
        resource_action VARCHAR(50) NOT NULL COMMENT '资源操作: create/read/update/delete/approve',
        permission_code VARCHAR(100) NOT NULL COMMENT '权限代码',
        permission_name VARCHAR(200) NOT NULL COMMENT '权限名称',
        description VARCHAR(500) NULL COMMENT '描述',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_resource_action (resource_type, resource_action),
        INDEX idx_resource_type (resource_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资源权限定义表'
    `);
    console.log('✓ 创建 resource_permissions 表成功');

    // 10. 创建数据过滤规则表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS data_filter_rules (
        id INT PRIMARY KEY AUTO_INCREMENT,
        role VARCHAR(50) NOT NULL COMMENT '角色代码',
        tenant_id INT NOT NULL COMMENT '租户ID',
        resource_type VARCHAR(50) NOT NULL COMMENT '资源类型',
        filter_field VARCHAR(100) NOT NULL COMMENT '过滤字段',
        filter_operator VARCHAR(20) NOT NULL COMMENT '过滤操作符: eq/in/like',
        filter_value TEXT NOT NULL COMMENT '过滤值',
        priority INT DEFAULT 0 COMMENT '优先级',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        UNIQUE KEY uk_role_resource_field (role, tenant_id, resource_type, filter_field),
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_resource_type (resource_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据过滤规则表'
    `);
    console.log('✓ 创建 data_filter_rules 表成功');

    // 插入默认角色数据范围配置
    const defaultRoleScopes = [
      ['super_admin', 0, 'all', null],
      ['system_admin', 0, 'all', null],
      ['asset_admin', 0, 'department', null],
      ['department_admin', 0, 'department', null],
      ['user', 0, 'own', null],
    ];

    for (const [role, tenantId, dataScope, customDepts] of defaultRoleScopes) {
      try {
        await db.execute(
          `INSERT INTO role_data_scopes (role, tenant_id, data_scope, custom_department_codes)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE data_scope = ?`,
          [role, tenantId, dataScope, customDepts, dataScope],
        );
      } catch (e) {
        console.log(`  角色 ${role} 数据范围已存在或插入失败`);
      }
    }
    console.log('✓ 插入默认角色数据范围配置成功');

    // 插入默认资源权限定义
    const defaultResourcePermissions = [
      ['asset', 'create', 'create_asset', '创建资产', '允许创建新资产'],
      ['asset', 'read', 'view_asset', '查看资产', '允许查看资产详情'],
      ['asset', 'update', 'edit_asset', '编辑资产', '允许编辑资产信息'],
      ['asset', 'delete', 'delete_asset', '删除资产', '允许删除资产'],
      ['asset', 'approve', 'approve_asset', '审批资产', '允许审批资产相关申请'],
      ['device', 'create', 'create_device', '创建设备', '允许创建设备'],
      ['device', 'read', 'view_device', '查看设备', '允许查看设备详情'],
      ['device', 'update', 'edit_device', '编辑设备', '允许编辑设备信息'],
      ['device', 'delete', 'delete_device', '删除设备', '允许删除设备'],
      ['maintenance', 'create', 'create_maintenance', '创建维修', '允许创建维修工单'],
      ['maintenance', 'read', 'view_maintenance', '查看维修', '允许查看维修记录'],
      ['maintenance', 'update', 'edit_maintenance', '编辑维修', '允许编辑维修工单'],
      ['maintenance', 'approve', 'approve_maintenance', '审批维修', '允许审批维修工单'],
    ];

    for (const [resource, action, code, name, desc] of defaultResourcePermissions) {
      try {
        await db.execute(
          `INSERT INTO resource_permissions (resource_type, resource_action, permission_code, permission_name, description)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE permission_name = ?`,
          [resource, action, code, name, desc, name],
        );
      } catch (e) {
        console.log(`  资源权限 ${code} 已存在或插入失败`);
      }
    }
    console.log('✓ 插入默认资源权限定义成功');

    console.log('\n✅ 增强权限系统表创建完成！');
    console.log('\n新表列表:');
    console.log('  - role_data_scopes: 角色数据范围配置');
    console.log('  - user_data_scopes: 用户数据范围配置');
    console.log('  - user_permissions: 用户权限表');
    console.log('  - user_permission_denies: 用户权限拒绝表');
    console.log('  - user_menu_permissions: 用户菜单权限表');
    console.log('  - role_hierarchy: 角色层级表');
    console.log('  - time_access_controls: 时间访问控制表');
    console.log('  - permission_audit_logs: 权限变更审计日志表');
    console.log('  - resource_permissions: 资源权限定义表');
    console.log('  - data_filter_rules: 数据过滤规则表');

  } catch (error) {
    console.error('创建增强权限系统表失败:', error);
    throw error;
  }
}

// 运行迁移
migrate()
  .then(() => {
    console.log('\n迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移失败:', error);
    process.exit(1);
  });
