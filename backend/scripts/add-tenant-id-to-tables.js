// 为需要的表添加tenant_id字段的脚本
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// 加载配置文件
const configPath = path.join(__dirname, '../config/app.config.js');
const config = require(configPath);

// 数据库配置
const dbConfig = config.database;

// 创建数据库连接
const connection = mysql.createConnection({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  charset: dbConfig.charset,
  timezone: dbConfig.timezone,
});

// 要检查的表列表
const tablesToCheck = [
  'acceptance_application_signatures',
  'adverse_reaction_attachments',
  'asset_acceptance_files',
  'asset_acceptance_records',
  'asset_categories',
  'asset_change_logs',
  'asset_device_mapping',
  'asset_images',
  'asset_location_history',
  'asset_locations',
  'asset_shares',
  'asset_transfer_requests',
  'assets',
  'audit_logs',
  'common_asset_stats',
];

async function main() {
  try {
    console.log('🔍 开始检查需要添加tenant_id字段的表...');

    const conn = await connection;

    for (const tableName of tablesToCheck) {
      console.log(`\n📋 检查表: ${tableName}`);

      // 检查表是否存在tenant_id字段
      const [columns] = await conn.execute(`SHOW COLUMNS FROM ${tableName} LIKE 'tenant_id'`);

      if (columns.length > 0) {
        console.log(`✅ 表 ${tableName} 已包含tenant_id字段`);
        continue;
      }

      // 检查表是否存在
      const [tables] = await conn.execute(`SHOW TABLES LIKE '${tableName}'`);

      if (tables.length === 0) {
        console.log(`❌ 表 ${tableName} 不存在`);
        continue;
      }

      // 添加tenant_id字段
      try {
        await conn.execute(
          `ALTER TABLE ${tableName} 
           ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
           ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id)`,
        );

        console.log(`✅ 表 ${tableName} 已成功添加tenant_id字段和索引`);
      } catch (error) {
        console.error(`❌ 为表 ${tableName} 添加tenant_id字段失败:`, error.message);
      }
    }

    console.log('\n🎉 所有表检查和更新完成！');
  } catch (error) {
    console.error('❌ 脚本执行失败:', error);
  } finally {
    const conn = await connection;
    await conn.end();
  }
}

// 执行脚本
main();
