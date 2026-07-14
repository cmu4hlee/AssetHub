/**
 * 为缺少 tenant_id 的表添加字段和索引
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { database: databaseConfig } = require('../config/app.config');

async function addMissingTenantId() {
  let connection;
  try {
    console.log('开始为缺少 tenant_id 的表添加字段和索引...\n');

    connection = await mysql.createConnection({
      host: databaseConfig.host,
      port: databaseConfig.port,
      user: databaseConfig.user,
      password: databaseConfig.password,
      database: databaseConfig.database,
      connectTimeout: 10000,
    });

    console.log('✓ 数据库连接成功\n');

    // 获取默认租户ID（中国医科大学附属第四医院）
    const [tenants] = await connection.execute('SELECT id FROM tenants WHERE tenant_code = ?', [
      '001',
    ]);
    const defaultTenantId = tenants.length > 0 ? tenants[0].id : null;

    if (!defaultTenantId) {
      console.error('❌ 未找到默认租户（编码：001），请先创建');
      return false;
    }

    console.log(`✓ 找到默认租户 ID: ${defaultTenantId}\n`);

    // 需要添加 tenant_id 的表列表
    const tables = [
      'asset_transfer_requests',
      'acceptance_application_files',
      'asset_images',
      'iot_devices',
      'audit_logs',
    ];

    for (const tableName of tables) {
      try {
        // 检查表是否存在
        const [tables] = await connection.execute(
          `SELECT TABLE_NAME FROM information_schema.TABLES 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
          [databaseConfig.database, tableName],
        );

        if (tables.length === 0) {
          console.log(`⚠️  ${tableName}: 表不存在，跳过`);
          continue;
        }

        // 检查是否已有 tenant_id 字段
        const [columns] = await connection.execute(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'tenant_id'`,
          [databaseConfig.database, tableName],
        );

        if (columns.length > 0) {
          console.log(`  - ${tableName}: tenant_id 字段已存在`);
          continue;
        }

        // 添加 tenant_id 字段
        await connection.execute(`
          ALTER TABLE ${tableName} 
          ADD COLUMN tenant_id INT COMMENT '租户ID' AFTER id,
          ADD INDEX idx_tenant_id (tenant_id)
        `);
        console.log(`  ✓ ${tableName}: 已添加 tenant_id 字段和索引`);

        // 为现有数据分配默认租户
        await connection.execute(`UPDATE ${tableName} SET tenant_id = ? WHERE tenant_id IS NULL`, [
          defaultTenantId,
        ]);
        console.log(`  ✓ ${tableName}: 已为现有数据分配默认租户`);

        // 对于有外键关系的表，添加外键约束
        try {
          await connection.execute(`
            ALTER TABLE ${tableName} 
            ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
          `);
          console.log(`  ✓ ${tableName}: 已添加外键约束`);
        } catch (fkError) {
          if (fkError.code === 'ER_DUP_FKEY') {
            console.log(`  - ${tableName}: 外键约束已存在`);
          } else {
            console.warn(`  ⚠️  ${tableName}: 添加外键约束失败 - ${fkError.message}`);
          }
        }
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`  - ${tableName}: tenant_id 字段已存在`);
        } else {
          console.error(`  ✗ ${tableName}: 添加失败 - ${error.message}`);
        }
      }
    }

    await connection.end();
    console.log('\n✅ 所有表的 tenant_id 字段添加完成！');
    return true;
  } catch (error) {
    console.error('\n❌ 执行失败:');
    console.error('错误代码:', error.code);
    console.error('错误消息:', error.message);
    if (connection) {
      try {
        await connection.end();
      } catch (e) {
        // 忽略关闭错误
      }
    }
    return false;
  }
}

// 运行添加
addMissingTenantId()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
  });
