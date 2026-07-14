const db = require('./config/database');

async function optimizePermissions() {
  try {
    console.log('开始优化权限管理系统...');

    // 1. 为权限相关表添加索引
    console.log('\n=== 添加数据库索引 ===');
    await addIndexes();

    // 2. 检查当前索引状态
    console.log('\n=== 检查索引状态 ===');
    await checkIndexes();

    // 3. 优化缓存机制
    console.log('\n=== 优化缓存机制 ===');
    console.log('建议实现Redis缓存，缓存以下数据:');
    console.log('- 用户权限信息 (TTL: 1小时)');
    console.log('- 菜单配置信息 (TTL: 24小时)');
    console.log('- 租户模块配置 (TTL: 6小时)');

    // 4. 优化数据库查询
    console.log('\n=== 优化数据库查询 ===');
    console.log('建议优化以下查询:');
    console.log('1. 用户菜单权限查询: 添加复合索引');
    console.log('2. 租户模块配置查询: 添加租户ID索引');
    console.log('3. 角色权限查询: 添加角色代码索引');

    console.log('\n=== 优化完成 ===');
    console.log('权限管理系统优化建议已生成');
  } catch (error) {
    console.error('优化权限管理系统失败:', error);
  } finally {
    // 关闭数据库连接
    await db.end();
  }
}

async function addIndexes() {
  try {
    // 为 tenant_module_configs 表添加索引
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_tenant_enabled ON tenant_module_configs(tenant_id, enabled)',
    );
    console.log('✓ 为 tenant_module_configs 表添加了 idx_tenant_enabled 索引');

    // 为 tenant_module_menus 表添加索引
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_tenant_module_enabled ON tenant_module_menus(tenant_id, module_id, is_enabled)',
    );
    console.log('✓ 为 tenant_module_menus 表添加了 idx_tenant_module_enabled 索引');

    // 为 role_menu_permissions 表添加索引
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_role_visible ON role_menu_permissions(role, is_visible)',
    );
    console.log('✓ 为 role_menu_permissions 表添加了 idx_role_visible 索引');

    // 为 menu_definitions 表添加索引
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_parent_active ON menu_definitions(parent_key, is_active)',
    );
    console.log('✓ 为 menu_definitions 表添加了 idx_parent_active 索引');
  } catch (error) {
    console.error('添加索引失败:', error);
  }
}

async function checkIndexes() {
  try {
    // 检查 tenant_module_configs 表索引
    const [configIndexes] = await db.execute('SHOW INDEX FROM tenant_module_configs');
    console.log('\ntenant_module_configs 表索引:');
    configIndexes.forEach(index => {
      console.log(`  - ${index.Key_name} (${index.Column_name})`);
    });

    // 检查 tenant_module_menus 表索引
    const [menuIndexes] = await db.execute('SHOW INDEX FROM tenant_module_menus');
    console.log('\ntenant_module_menus 表索引:');
    menuIndexes.forEach(index => {
      console.log(`  - ${index.Key_name} (${index.Column_name})`);
    });

    // 检查 role_menu_permissions 表索引
    const [roleIndexes] = await db.execute('SHOW INDEX FROM role_menu_permissions');
    console.log('\nrole_menu_permissions 表索引:');
    roleIndexes.forEach(index => {
      console.log(`  - ${index.Key_name} (${index.Column_name})`);
    });

    // 检查 menu_definitions 表索引
    const [defIndexes] = await db.execute('SHOW INDEX FROM menu_definitions');
    console.log('\nmenu_definitions 表索引:');
    defIndexes.forEach(index => {
      console.log(`  - ${index.Key_name} (${index.Column_name})`);
    });
  } catch (error) {
    console.error('检查索引失败:', error);
  }
}

optimizePermissions();
