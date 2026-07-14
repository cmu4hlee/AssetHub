/**
 * 数据库迁移脚本：为 departments 表添加 status 字段
 * 执行方式：node migrate-add-department-status.js
 */

const mysql = require('mysql2/promise');
const { database } = require('./config/app.config');

async function migrate() {
  console.log('开始执行数据库迁移：添加 departments.status 字段...');

  const dbConfig = database.master;
  
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
  });

  try {
    // 检查字段是否已存在
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'departments' AND COLUMN_NAME = 'status'`,
      [dbConfig.database]
    );

    if (columns.length > 0) {
      console.log('✅ status 字段已存在，跳过迁移');
      return;
    }

    // 添加 status 字段
    await connection.query(
      `ALTER TABLE departments 
       ADD COLUMN status VARCHAR(20) DEFAULT 'active' COMMENT '部门状态：active-启用，inactive-停用' 
       AFTER level`
    );

    console.log('✅ 成功添加 status 字段到 departments 表');

    // 为现有数据设置默认值
    const [result] = await connection.query(
      `UPDATE departments SET status = 'active' WHERE status IS NULL`
    );

    console.log(`✅ 更新 ${result.affectedRows} 条记录的 status 字段为 'active'`);

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

migrate()
  .then(() => {
    console.log('✅ 迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  });
