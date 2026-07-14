const mysql = require('mysql2/promise');
const { getDatabaseConfig } = require('./db-config-helper');

// 使用统一的数据库配置助手
const dbConfig = getDatabaseConfig();

async function addInvoiceToFileType() {
  let connection;
  try {
    console.log('开始更新文件类型，添加"发票"选项...');
    console.log('数据库配置:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
    });

    // 创建数据库连接
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
    });

    console.log('✅ 数据库连接成功');

    // 修改文件类型ENUM，添加"发票"
    await connection.execute(`
      ALTER TABLE asset_acceptance_files 
      MODIFY COLUMN file_type ENUM('安装图片', '正常运行图片', '安装报告单', '采购合同', '发票') NOT NULL COMMENT '文件类型'
    `);

    console.log('✓ 文件类型已更新，已添加"发票"选项');

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('更新失败:', error);
    console.error('错误详情:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
    });
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

addInvoiceToFileType();
