/**
 * 标准数据库连接模板
 * 所有数据库脚本都应使用此模板进行连接配置
 *
 * 配置说明：
 * - 从.env文件读取数据库配置
 * - 支持远程数据库连接
 * - 使用连接池管理连接
 * - 包含错误处理和日志记录
 */

// 加载环境变量（必须在最开始加载）
require('dotenv').config();

// 导入数据库连接配置
const { database: databaseConfig } = require('./config/app.config');

// 导入mysql2
const mysql = require('mysql2/promise');

/**
 * 创建数据库连接池
 * 使用app.config.js中的配置，该配置会自动从.env文件读取环境变量
 */
const createConnectionPool = () => {
  return mysql.createPool({
    host: databaseConfig.host,
    port: databaseConfig.port,
    user: databaseConfig.user,
    password: databaseConfig.password,
    database: databaseConfig.database,
    waitForConnections: true,
    connectionLimit: databaseConfig.connectionLimit,
    queueLimit: databaseConfig.queueLimit,
    connectTimeout: databaseConfig.connectTimeout,
    enableKeepAlive: databaseConfig.enableKeepAlive,
    keepAliveInitialDelay: databaseConfig.keepAliveInitialDelay,
    idleTimeout: databaseConfig.idleTimeout,
    maxIdle: databaseConfig.maxIdle,
    charset: databaseConfig.charset,
    timezone: databaseConfig.timezone,
  });
};

// 导出标准数据库连接池
const pool = createConnectionPool();

// 导出数据库配置（用于日志和调试）
exports.dbConfig = databaseConfig;
exports.pool = pool;

/**
 * 示例：使用标准连接执行查询
 * @param {string} sql - SQL查询语句
 * @param {Array} params - 查询参数
 * @returns {Promise<Object>} 查询结果
 */
exports.executeQuery = async (sql, params = []) => {
  try {
    console.log(`执行SQL查询: ${sql}`);
    console.log(`查询参数: ${JSON.stringify(params)}`);
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('数据库查询失败:', error.message);
    console.error('错误堆栈:', error.stack);
    throw error;
  }
};

/**
 * 示例：关闭连接池
 */
exports.closePool = async () => {
  await pool.end();
  console.log('数据库连接池已关闭');
};

// 示例用法
if (require.main === module) {
  // 只有当直接运行此脚本时才执行测试
  (async () => {
    try {
      console.log('开始测试数据库连接...');
      console.log('使用的数据库配置:');
      console.log(`  主机: ${databaseConfig.host}`);
      console.log(`  端口: ${databaseConfig.port}`);
      console.log(`  用户名: ${databaseConfig.user}`);
      console.log(`  数据库名: ${databaseConfig.database}`);

      // 测试连接
      const result = await exports.executeQuery('SELECT 1 as test_result');
      console.log('✅ 数据库连接成功，测试结果:', result);

      // 关闭连接池
      await exports.closePool();
    } catch (error) {
      console.error('❌ 测试失败:', error.message);
      process.exit(1);
    }
  })();
}
