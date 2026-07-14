const mysql = require('mysql2/promise');
const { getDatabaseConfig } = require('./db-config-helper');

// 使用统一的数据库配置助手
const config = {
  ...getDatabaseConfig(),
  multipleStatements: true,
};

async function addCodeFields() {
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
       AND COLUMN_NAME IN ('code', 'code2', 'code3')`,
    );

    const existingFields = columns.map(c => c.COLUMN_NAME);
    console.log('已存在的字段:', existingFields);

    if (existingFields.length === 3) {
      console.log('字段已存在，无需添加');
      return;
    }

    // 添加缺失的字段
    if (!existingFields.includes('code')) {
      console.log('添加code字段...');
      await connection.execute(
        "ALTER TABLE assets ADD COLUMN code VARCHAR(100) COMMENT '原始编码code' AFTER asset.code",
      );
    }

    if (!existingFields.includes('code2')) {
      console.log('添加code2字段...');
      await connection.execute(
        "ALTER TABLE assets ADD COLUMN code2 VARCHAR(100) COMMENT '原始编码code2' AFTER code",
      );
    }

    if (!existingFields.includes('code3')) {
      console.log('添加code3字段...');
      await connection.execute(
        "ALTER TABLE assets ADD COLUMN code3 VARCHAR(100) COMMENT '原始编码code3' AFTER code2",
      );
    }

    // 添加索引
    try {
      await connection.execute('CREATE INDEX idx_code ON assets.code)');
      console.log('已创建code索引');
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') {
        throw e;
      }
      console.log('code索引已存在');
    }

    try {
      await connection.execute('CREATE INDEX idx_code2 ON assets.code2)');
      console.log('已创建code2索引');
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') {
        throw e;
      }
      console.log('code2索引已存在');
    }

    try {
      await connection.execute('CREATE INDEX idx_code3 ON assets.code3)');
      console.log('已创建code3索引');
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') {
        throw e;
      }
      console.log('code3索引已存在');
    }

    console.log('\n字段添加完成！');
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

addCodeFields();
