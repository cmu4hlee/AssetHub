const mysql = require('../config/database');

async function updateTenantModuleConfigsTable() {
  try {
    console.log('开始修改企业空间模块配置表...');

    // 先添加last_updated_by字段
    await mysql.execute(`
      ALTER TABLE tenant_module_configs
        ADD COLUMN last_updated_by VARCHAR(36) DEFAULT NULL,
        ADD INDEX idx_enabled (enabled);
    `);
    console.log('✅ 添加字段和索引成功');

    console.log('🎉 表修改完成');
  } catch (error) {
    console.error('❌ 修改表失败:', error);
  } finally {
    process.exit();
  }
}

updateTenantModuleConfigsTable();
