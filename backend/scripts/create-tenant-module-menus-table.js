const mysql = require('../config/database');

async function createTenantModuleMenusTable() {
  try {
    console.log('开始创建企业空间模块菜单配置表...');

    // 创建企业空间模块菜单配置表
    await mysql.execute(`
      CREATE TABLE IF NOT EXISTS tenant_module_menus (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        module_id VARCHAR(36) NOT NULL,
        menu_key VARCHAR(100) NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        UNIQUE KEY uk_tenant_module_menu (tenant_id, module_id, menu_key),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
        FOREIGN KEY (menu_key) REFERENCES menu_definitions(menu_key) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ 企业空间模块菜单配置表创建成功');

    console.log('🎉 表创建完成');
  } catch (error) {
    console.error('❌ 创建表失败:', error);
  } finally {
    process.exit();
  }
}

createTenantModuleMenusTable();
