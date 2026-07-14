const mysql = require('../config/database');

async function createTables() {
  try {
    console.log('开始创建企业空间模块配置相关表...');

    // 创建企业空间模块配置表
    await mysql.execute(`
      CREATE TABLE IF NOT EXISTS tenant_module_configs (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        module_id VARCHAR(36) NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        config TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        UNIQUE KEY uk_tenant_module (tenant_id, module_id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ 企业空间模块配置表创建成功');

    // 创建企业空间模块配置变更日志表
    await mysql.execute(`
      CREATE TABLE IF NOT EXISTS tenant_module_config_logs (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        tenant_name VARCHAR(255) NOT NULL,
        module_id VARCHAR(36) NOT NULL,
        module_name VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        old_value TEXT DEFAULT NULL,
        new_value TEXT NOT NULL,
        operator_id VARCHAR(36) NOT NULL,
        operator_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_module_id (module_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ 企业空间模块配置变更日志表创建成功');

    console.log('🎉 所有表创建完成');
  } catch (error) {
    console.error('❌ 创建表失败:', error);
  } finally {
    process.exit();
  }
}

createTables();
