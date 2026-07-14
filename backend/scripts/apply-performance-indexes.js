/**
 * 性能优化索引脚本
 * 自动应用数据库索引优化
 * 使用方法: node scripts/apply-performance-indexes.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'zcgl',
  multipleStatements: true,
};

async function checkAndCreateIndex(connection, tableName, indexName, createSQL) {
  try {
    const [existingIndexes] = await connection.execute(
      `SHOW INDEX FROM ${tableName} WHERE Key_name = ?`,
      [indexName]
    );

    if (existingIndexes.length > 0) {
      return { skipped: true, reason: '索引已存在' };
    }

    await connection.execute(createSQL);
    return { success: true };
  } catch (error) {
    if (error.code === 'ER_DUP_KEYNAME') {
      return { skipped: true, reason: '索引已存在' };
    }
    throw error;
  }
}

async function applyIndexes() {
  let connection;

  try {
    console.log('🔍 连接数据库...');
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   Database: ${config.database}`);

    connection = await mysql.createConnection(config);
    console.log('✅ 数据库连接成功\n');

    const sqlFile = path.join(__dirname, 'performance-optimization-indexes.sql');
    let sql = fs.readFileSync(sqlFile, 'utf8');

    const lines = sql.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('--');
    });
    sql = lines.join('\n');

    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📊 准备执行 ${statements.length} 条索引语句\n`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const statement of statements) {
      if (!statement || statement.trim().length === 0) continue;

      const match = statement.match(/CREATE\s+INDEX\s+(\w+)\s+ON\s+(\w+)/i);
      if (!match) {
        console.log(`⚠️  跳过无效语句: ${statement.substring(0, 50)}...`);
        continue;
      }

      const indexName = match[1];
      const tableName = match[2];

      console.log(`📝 创建索引: ${tableName}.${indexName}`);

      try {
        const result = await checkAndCreateIndex(connection, tableName, indexName, statement);
        
        if (result.skipped) {
          console.log(`⏭️  跳过: ${result.reason}\n`);
          skippedCount++;
        } else if (result.success) {
          console.log(`✅ 成功创建\n`);
          successCount++;
        }
      } catch (error) {
        console.log(`❌ 失败: ${error.message}\n`);
        errorCount++;
        errors.push({ statement, error: error.message });
      }
    }

    console.log('\n========================================');
    console.log('📈 索引优化执行完成');
    console.log('========================================');
    console.log(`✅ 成功创建: ${successCount} 个`);
    console.log(`⏭️  已跳过: ${skippedCount} 个`);
    console.log(`❌ 失败: ${errorCount} 个`);

    if (errors.length > 0) {
      console.log('\n❌ 失败的语句:');
      errors.slice(0, 5).forEach((e, i) => {
        console.log(`\n${i + 1}. ${e.statement}`);
        console.log(`   错误: ${e.error}`);
      });
    }

    console.log('\n💡 建议: 定期执行 ANALYZE TABLE 以更新统计信息');
    console.log('   示例: ANALYZE TABLE assets, maintenance_logs;');

  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

if (require.main === module) {
  applyIndexes().catch(console.error);
}

module.exports = { applyIndexes };
