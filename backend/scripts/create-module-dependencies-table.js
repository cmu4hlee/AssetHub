const mysql = require('../config/database');

async function createModuleDependenciesTable() {
  try {
    console.log('开始创建模块依赖关系表...');

    // 创建模块依赖关系表
    await mysql.execute(`
      CREATE TABLE IF NOT EXISTS module_dependencies (
        id VARCHAR(36) PRIMARY KEY,
        module_id VARCHAR(36) NOT NULL,
        dependency_id VARCHAR(36) NOT NULL,
        dependency_type ENUM('required', 'optional') NOT NULL DEFAULT 'required',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_module_dependency (module_id, dependency_id),
        FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
        FOREIGN KEY (dependency_id) REFERENCES modules(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ 模块依赖关系表创建成功');

    console.log('🎉 表创建完成');
  } catch (error) {
    console.error('❌ 创建表失败:', error);
  } finally {
    process.exit();
  }
}

createModuleDependenciesTable();
