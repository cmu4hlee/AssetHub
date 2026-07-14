// 数据库配置示例文件
// ⚠️ 警告：此文件仅作为示例，不要在生产环境中使用硬编码的凭据！
//
// 推荐做法：
// 1. 使用 .env 文件配置数据库连接（推荐）
// 2. 使用环境变量
// 3. 使用密钥管理服务（生产环境）

const mysql = require('mysql2/promise');
require('dotenv').config();

// 优先使用环境变量，如果没有则使用示例值（仅用于开发测试）
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost', // 示例：请替换为实际数据库主机
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root', // 示例：请替换为实际数据库用户
  password: process.env.DB_PASSWORD || '', // ⚠️ 必须通过环境变量设置密码
  database: process.env.DB_NAME || 'zcgl', // 示例：请替换为实际数据库名
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// 检查是否设置了密码
if (!process.env.DB_PASSWORD) {
  console.warn('⚠️  警告：未设置 DB_PASSWORD 环境变量，数据库连接可能失败');
  console.warn('   请创建 .env 文件并设置数据库配置');
}

module.exports = pool;
