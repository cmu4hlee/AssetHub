// 加载环境变量（优先从backend目录加载，如果不存在则从上级目录加载）
const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '../.env');
const parentEnvPath = path.join(__dirname, '../../.env');

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else if (fs.existsSync(parentEnvPath)) {
  require('dotenv').config({ path: parentEnvPath });
} else {
  require('dotenv').config(); // 尝试从默认位置加载
}

const db = require('../config/database');

async function addTenantIdToAILogs() {
  try {
    console.log('开始为 asset_ai_analysis_logs 表添加 tenant_id 字段...');

    // 检查表是否存在
    const [tables] = await db.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_ai_analysis_logs'",
    );

    if (tables.length === 0) {
      console.log('❌ asset_ai_analysis_logs 表不存在，请先创建该表');
      process.exit(1);
    }

    // 检查字段是否已存在
    const [columns] = await db.execute("SHOW COLUMNS FROM asset_ai_analysis_logs LIKE 'tenant_id'");

    if (columns.length > 0) {
      console.log('✅ tenant_id 字段已存在');
    } else {
      // 添加 tenant_id 字段
      await db.execute(`
        ALTER TABLE asset_ai_analysis_logs
        ADD COLUMN tenant_id INT COMMENT '租户ID'
      `);
      console.log('✅ tenant_id 字段添加成功');
    }

    // 检查索引是否已存在
    const [indexes] = await db.execute(
      "SHOW INDEX FROM asset_ai_analysis_logs WHERE Key_name = 'idx_tenant_id'",
    );

    if (indexes.length > 0) {
      console.log('✅ idx_tenant_id 索引已存在');
    } else {
      // 添加索引
      await db.execute(`
        CREATE INDEX idx_tenant_id ON asset_ai_analysis_logs(tenant_id)
      `);
      console.log('✅ idx_tenant_id 索引添加成功');
    }

    // 为现有记录设置默认租户ID（根据user_id关联的租户）
    // 先检查users表是否有tenant_id字段
    const [userColumns] = await db.execute("SHOW COLUMNS FROM users LIKE 'tenant_id'");
    let updateResult = { affectedRows: 0 };
    if (userColumns.length > 0) {
      [updateResult] = await db.execute(`
        UPDATE asset_ai_analysis_logs aal
        INNER JOIN users u ON aal.user_id = u.id
        SET aal.tenant_id = u.tenant_id
        WHERE aal.tenant_id IS NULL AND u.tenant_id IS NOT NULL
      `);
      console.log(`✅ 已为 ${updateResult.affectedRows} 条记录设置租户ID`);
    } else {
      console.log('⚠️  users表没有tenant_id字段，跳过更新现有记录');
    }

    console.log('✅ 所有操作完成！');
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    throw error;
  } finally {
    process.exit(0);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  addTenantIdToAILogs();
}

module.exports = addTenantIdToAILogs;
