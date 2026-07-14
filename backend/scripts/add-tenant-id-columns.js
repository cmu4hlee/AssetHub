const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 从环境变量读取数据库配置
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'zcgl',
  multipleStatements: true,
};

// 检查必要的配置
if (!config.password) {
  console.error('❌ 错误：数据库密码未设置！');
  console.error('请设置环境变量 DB_PASSWORD 或创建 .env 文件');
  console.error('示例：DB_PASSWORD=your_password');
  process.exit(1);
}

// 需要添加tenant_id列的表
const tables = [
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
  'departments',
  'iot_devices',
  'location_codes',
  'maintenance_logs',
  'preventive_maintenance_plans',
  'quality_control',
  'technical_document_shares',
  'technical_documents',
  'users',
  'database_backups',
];

async function addTenantIdColumns() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(config);
    console.log('数据库连接成功');

    // 先检查tenants表是否存在
    const [tenantTableCheck] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tenants'",
      [config.database],
    );

    if (tenantTableCheck.length === 0) {
      console.error('❌ 错误：tenants表不存在！');
      console.error('请先创建tenants表');
      process.exit(1);
    }

    // 为每个表添加tenant_id列
    for (const table of tables) {
      try {
        // 检查表是否存在
        const [tableCheck] = await connection.execute(
          'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
          [config.database, table],
        );

        if (tableCheck.length === 0) {
          console.log(`ℹ️  表 ${table} 不存在，跳过`);
          continue;
        }

        // 检查tenant_id列是否已存在
        const [columnCheck] = await connection.execute(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'tenant_id'",
          [config.database, table],
        );

        if (columnCheck.length > 0) {
          console.log(`✅ 表 ${table} 已存在tenant_id列，跳过`);
          continue;
        }

        // 添加tenant_id列（MySQL不支持IF NOT EXISTS，所以直接添加）
        console.log(`正在为表 ${table} 添加tenant_id列...`);
        await connection.execute(
          `ALTER TABLE ${table} 
           ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
           ADD INDEX idx_tenant_id (tenant_id)`,
        );
        console.log(`✅ 表 ${table} 添加tenant_id列成功`);
      } catch (error) {
        console.error(`❌ 为表 ${table} 添加tenant_id列失败:`, error.message);
        // 继续处理其他表
        continue;
      }
    }

    console.log('\n🎉 所有表的tenant_id列添加完成！');
    console.log('接下来可以运行run-tenant-fix.js脚本进行租户隔离修复');
  } catch (error) {
    console.error('添加tenant_id列失败:', error.message);
    console.error('详细错误信息:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

addTenantIdColumns();
