/**
 * 数据库配置辅助模块
 * 用于脚本文件中统一加载数据库配置
 * 优先从环境变量读取，如果没有则提示错误
 */

require('dotenv').config();

const mysql = require('mysql2/promise');

/**
 * 获取数据库配置
 * @returns {Object} 数据库配置对象
 */
function getDatabaseConfig() {
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
    console.error('\n提示：可以复制 .env.example 为 .env 并填入实际配置');
    process.exit(1);
  }

  return config;
}

/**
 * 创建数据库连接
 * @returns {Promise<Connection>} 数据库连接
 */
async function createConnection() {
  const config = getDatabaseConfig();
  return await mysql.createConnection(config);
}

/**
 * 创建数据库连接池
 * @returns {Pool} 数据库连接池
 */
function createPool() {
  const config = getDatabaseConfig();
  return mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 0,
  });
}

module.exports = {
  getDatabaseConfig,
  createConnection,
  createPool,
};
