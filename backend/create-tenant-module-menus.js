const mysql = require('mysql2/promise');

// 远程数据库配置
const config = {
  host: '101.37.236.101',
  port: 3306,
  user: 'root',
  password: 'Cmu19801008',
  database: 'zcgl',
};

async function createTenantModuleMenusTable() {
  let connection;

  try {
    // 连接到远程数据库
    connection = await mysql.createConnection(config);
    console.log('✅ 成功连接到远程数据库');

    // 创建 tenant_module_menus 表
    console.log('\n📝 创建 tenant_module_menus 表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tenant_module_menus (
        id INT(11) NOT NULL AUTO_INCREMENT,
        tenant_id INT(11) NOT NULL,
        module_id VARCHAR(50) NOT NULL,
        menu_key VARCHAR(100) NOT NULL,
        is_enabled TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY unique_tenant_module_menu (tenant_id, module_id, menu_key),
        KEY idx_tenant_id (tenant_id),
        KEY idx_module_id (module_id),
        KEY idx_menu_key (menu_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户模块菜单关联表'
    `);
    console.log('✅ 成功创建 tenant_module_menus 表');

    // 查看创建的表结构
    console.log('\n🔍 查看 tenant_module_menus 表结构:');
    const [tableStructure] = await connection.execute(`
      DESCRIBE tenant_module_menus
    `);
    tableStructure.forEach(field => {
      console.log(
        `  ${field.Field}: ${field.Type} ${field.Null} ${field.Key} ${field.Default} ${field.Extra}`,
      );
    });
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

// 执行创建
createTenantModuleMenusTable();
