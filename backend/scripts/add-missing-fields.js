const mysql = require('mysql2/promise');
const { getDatabaseConfig } = require('./db-config-helper');

// 使用统一的数据库配置助手
const config = {
  ...getDatabaseConfig(),
  multipleStatements: true,
};

async function addMissingFields() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(config);
    console.log('数据库连接成功');

    // 检查字段是否已存在
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'zcgl' 
       AND TABLE_NAME = 'assets' 
       AND COLUMN_NAME IN ('unit', 'data_id', 'original_created_at')`,
    );

    const existingFields = columns.map(c => c.COLUMN_NAME);
    console.log('已存在的字段:', existingFields);

    // 添加unit字段（单位）
    if (!existingFields.includes('unit')) {
      console.log('添加unit字段（单位）...');
      await connection.execute(
        "ALTER TABLE assets ADD COLUMN unit VARCHAR(200) COMMENT '单位' AFTER department",
      );
      console.log('✓ unit字段已添加');
    } else {
      console.log('✓ unit字段已存在');
    }

    // 添加data_id字段（数据标识）
    if (!existingFields.includes('data_id')) {
      console.log('添加data_id字段（数据标识）...');
      await connection.execute(
        "ALTER TABLE assets ADD COLUMN data_id VARCHAR(100) COMMENT '数据标识' AFTER supplier",
      );
      console.log('✓ data_id字段已添加');
    } else {
      console.log('✓ data_id字段已存在');
    }

    // 添加original_created_at字段（原始创建时间）
    if (!existingFields.includes('original_created_at')) {
      console.log('添加original_created_at字段（原始创建时间）...');
      await connection.execute(
        "ALTER TABLE assets ADD COLUMN original_created_at DATETIME COMMENT '原始创建时间' AFTER data_id",
      );
      console.log('✓ original_created_at字段已添加');
    } else {
      console.log('✓ original_created_at字段已存在');
    }

    console.log('\n所有字段添加完成！');
  } catch (error) {
    console.error('操作失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

addMissingFields();
