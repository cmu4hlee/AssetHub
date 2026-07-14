const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔧 开始执行数据库迁移...\n');

  const connection = await mysql.createConnection({
    host: '101.37.236.101',
    port: 3306,
    user: 'root',
    password: 'QWEasd123',
    database: 'asset_management_v2',
    multipleStatements: true,
  });

  try {
    // 读取SQL文件
    const sqlFile = path.join(__dirname, '../scripts/create-maintenance-workorders-table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📄 执行SQL脚本...\n');

    // 执行SQL
    await connection.query(sql);

    console.log('✅ 数据库迁移成功！\n');

    // 验证表是否创建成功
    const [tables] = await connection.execute("SHOW TABLES LIKE 'maintenance_workorders'");
    if (tables.length > 0) {
      console.log('✅ maintenance_workorders 表已创建');
    } else {
      console.log('❌ maintenance_workorders 表创建失败');
    }

    const [materialsTables] = await connection.execute(
      "SHOW TABLES LIKE 'maintenance_workorder_materials'",
    );
    if (materialsTables.length > 0) {
      console.log('✅ maintenance_workorder_materials 表已创建');
    } else {
      console.log('❌ maintenance_workorder_materials 表创建失败');
    }

    // 显示表结构
    console.log('\n📋 maintenance_workorders 表结构：');
    const [columns] = await connection.execute('DESCRIBE maintenance_workorders');
    columns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''}`);
    });
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
