/**
 * 模块级健康检查工具
 *
 * 提供真实的健康检查能力，不仅返回 200，还检测：
 * - 数据库连接可达性
 * - 模块依赖的表是否存在
 * - 模块断路器状态
 * - 模块连接池配额状态
 */

const db = require('../config/database');
const { getCurrentModuleId } = require('./module-context');

/**
 * 执行模块健康检查
 * @param {Object} options - 检查选项
 * @param {string[]} [options.tables] - 模块依赖的表名列表（用于验证表存在性）
 * @param {boolean} [options.checkDb=true] - 是否检查 DB 连接
 * @returns {Promise<Object>} 健康检查结果
 */
const checkModuleHealth = async (options = {}) => {
  const { tables = [], checkDb = true } = options;
  const checks = {};
  let overallHealthy = true;

  // 1. 数据库连接检查
  if (checkDb) {
    try {
      const startTime = Date.now();
      await db.execute('SELECT 1 as ok', []);
      const latency = Date.now() - startTime;
      checks.database = {
        status: 'healthy',
        latency: `${latency}ms`,
      };
    } catch (error) {
      overallHealthy = false;
      checks.database = {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  // 2. 表存在性检查
  if (tables.length > 0) {
    checks.tables = {};
    for (const table of tables) {
      try {
        await db.execute(`SELECT 1 FROM \`${table}\` LIMIT 1`, []);
        checks.tables[table] = 'exists';
      } catch (error) {
        overallHealthy = false;
        checks.tables[table] = `error: ${error.message}`;
      }
    }
  }

  // 3. 连接池统计（含模块级配额、断路器状态）
  try {
    const poolStats = db.getPoolStats();
    checks.connectionPool = {
      master: {
        active: poolStats.master.activeConnections,
        idle: poolStats.master.idleConnections,
        limit: poolStats.master.connectionLimit,
        pending: poolStats.master.pendingConnections,
      },
      moduleStats: poolStats.modules || {},
    };
  } catch (error) {
    checks.connectionPool = { status: 'unknown', error: error.message };
  }

  return {
    status: overallHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
  };
};

/**
 * Express 中间件：模块健康检查端点
 * @param {Object} options - 检查选项（同 checkModuleHealth）
 * @returns {Function} Express 路由处理器
 */
const moduleHealthHandler = (options = {}) => async (req, res) => {
  try {
    const result = await checkModuleHealth(options);
    res.status(result.status === 'healthy' ? 200 : 503).json({
      success: result.status === 'healthy',
      data: result,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

module.exports = {
  checkModuleHealth,
  moduleHealthHandler,
};
