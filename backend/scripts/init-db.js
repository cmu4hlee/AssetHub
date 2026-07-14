const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 从环境变量读取数据库配置，如果没有则使用默认值（仅用于开发环境）
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};

// 检查必要的配置
if (!config.password) {
  console.error('❌ 错误：数据库密码未设置！');
  console.error('请设置环境变量 DB_PASSWORD 或创建 .env 文件');
  console.error('示例：DB_PASSWORD=your_password');
  process.exit(1);
}

async function initDatabase() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(config);
    console.log('数据库连接成功');

    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '../config/init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('正在执行数据库初始化脚本...');

    // 执行 SQL 语句
    await connection.query(sql);

    console.log('数据库初始化完成！');
    console.log('已创建以下表：');
    console.log('- asset_categories (资产分类表)');
    console.log('- assets (资产主表)');
    console.log('- inventory_records (盘点记录表)');
    console.log('- inventory_details (盘点明细表)');
    console.log('- transfer_records (资产调配表)');
    console.log('- idle_assets (闲置资产发布表)');
  } catch (error) {
    console.error('数据库初始化失败:', error.message);
    if (error.code === 'ER_DBACCESS_DENIED_ERROR') {
      console.error('错误：无法访问数据库，请检查用户名和密码');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('错误：无法连接到数据库服务器，请检查：');
      console.error('1. 数据库服务器地址是否正确');
      console.error('2. 端口是否正确（3306）');
      console.error('3. 防火墙是否允许连接');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('错误：访问被拒绝，请检查用户名和密码');
    } else {
      console.error('详细错误信息:', error);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

initDatabase();
