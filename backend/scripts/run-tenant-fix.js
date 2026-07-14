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

async function runTenantFix() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(config);
    console.log('数据库连接成功');

    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'fix-tenant-isolation.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('正在执行租户隔离修复脚本...');
    console.log('1. 将所有表的tenant_id字段从NULL改为NOT NULL');
    console.log('2. 为所有表添加外键约束');
    console.log('3. 确保数据完整性');

    // 执行 SQL 语句
    await connection.query(sql);

    console.log('🎉 租户隔离修复完成！');
    console.log('✅ 所有表的tenant_id字段已设置为NOT NULL');
    console.log('✅ 所有表已添加外键约束');
    console.log('✅ 数据完整性已确保');
    console.log('✅ 租户隔离已生效');
  } catch (error) {
    console.error('租户隔离修复失败:', error.message);
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

runTenantFix();
