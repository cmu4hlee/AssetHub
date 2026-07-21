const mysql = require('mysql2');
const mysqlPromise = require('mysql2/promise');
const { database: databaseConfig } = require('./app.config');
const { getCurrentModuleId } = require('../core/module-context');
const { validateSQLAccess } = require('../core/data-access-guard');
const { CircuitBreaker } = require('../utils/circuit-breaker');
const isTestEnv = process.env.NODE_ENV === 'test';
const DB_DEBUG_LOG_ENABLED = process.env.DB_DEBUG_LOG_ENABLED === 'true';
const dbDebugLog = (...args) => {
  if (DB_DEBUG_LOG_ENABLED) {
    console.log(...args);
  }
};

// ============================================
// 模块级连接配额隔离
// 通过 AsyncLocalStorage 自动获取当前模块ID，
// 限制单个模块最多同时占用的连接数，防止一个模块耗尽全局连接池
// ============================================

// 每模块默认连接上限（可通过环境变量覆盖：MODULE_DB_POOL_LIMIT_<MODULE_ID>=N）
const DEFAULT_MODULE_POOL_LIMIT = parseInt(process.env.DEFAULT_MODULE_DB_POOL_LIMIT, 10) || 5;

// 模块活跃连接计数
const moduleActiveConnections = new Map(); // moduleId -> active count
// 模块连接累计统计
const moduleStats = new Map(); // moduleId -> { total, rejected, maxObserved }

// 获取模块连接上限
const getModulePoolLimit = (moduleId) => {
  if (!moduleId) return Infinity; // 非模块上下文（legacy 路由/共享基础设施）不限
  const envKey = `MODULE_DB_POOL_LIMIT_${moduleId.toUpperCase().replace(/-/g, '_')}`;
  const envVal = process.env[envKey];
  if (envVal) return parseInt(envVal, 10);
  return DEFAULT_MODULE_POOL_LIMIT;
};

// 获取或创建模块统计
const getModuleStats = (moduleId) => {
  if (!moduleStats.has(moduleId)) {
    moduleStats.set(moduleId, { total: 0, rejected: 0, maxObserved: 0 });
  }
  return moduleStats.get(moduleId);
};

// 尝试获取模块连接配额
const acquireModuleConnection = (moduleId) => {
  if (!moduleId) return true; // 无模块上下文，放行
  const current = moduleActiveConnections.get(moduleId) || 0;
  const limit = getModulePoolLimit(moduleId);
  if (current >= limit) {
    const stats = getModuleStats(moduleId);
    stats.rejected++;
    return false;
  }
  moduleActiveConnections.set(moduleId, current + 1);
  const stats = getModuleStats(moduleId);
  stats.total++;
  if (current + 1 > stats.maxObserved) stats.maxObserved = current + 1;
  return true;
};

// 释放模块连接配额
const releaseModuleConnection = (moduleId) => {
  if (!moduleId) return;
  const current = moduleActiveConnections.get(moduleId) || 0;
  if (current > 0) {
    moduleActiveConnections.set(moduleId, current - 1);
  }
};

// 跨模块表访问审计（仅警告，不阻断，避免破坏现有 JOIN）
const auditSQLAccess = (moduleId, sql) => {
  if (!moduleId || !sql) return;
  const validation = validateSQLAccess(moduleId, sql);
  if (!validation.allowed && validation.violations.length > 0) {
    console.warn(
      `[DataAccessGuard][AUDIT] 模块 ${moduleId} 跨模块访问表: ${validation.violations.join(', ')} | SQL: ${String(sql).slice(0, 120)}...`
    );
  }
};

// ============================================
// 模块级断路器
// 每个模块独立的断路器，某模块连续失败时仅熔断该模块，不影响其他模块
// ============================================
const moduleCircuitBreakers = new Map(); // moduleId -> CircuitBreaker

const getModuleCircuitBreaker = (moduleId) => {
  if (!moduleId) return null;
  if (!moduleCircuitBreakers.has(moduleId)) {
    moduleCircuitBreakers.set(moduleId, new CircuitBreaker(`db:${moduleId}`, {
      failureThreshold: 10,      // 连续失败 10 次触发熔断
      successThreshold: 3,       // 半开状态连续成功 3 次恢复
      timeout: 30000,            // 熔断 30 秒
      requestTimeout: 30000,     // 单次请求超时 30 秒
      // 仅真正的故障（DB 连接错误、超时、协议错误）才计入熔断
      isFailure: isCircuitBreakerFailure,
    }));
  }
  return moduleCircuitBreakers.get(moduleId);
};

// 判断错误是否应计入断路器失败（排除业务校验错误）
const isCircuitBreakerFailure = (error) => {
  if (!error) return false;
  // 排除模块连接配额超限（这是限流，不是故障）
  if (error.code === 'MODULE_POOL_EXHAUSTED') return false;
  // 排除常见业务校验错误 + 幂等迁移错误（表/列/索引已存在时正常，不应触发熔断）
  const nonFailureCodes = [
    'ER_DUP_ENTRY',         // 1062  唯一键冲突
    'ER_ROW_IS_REFERENCED', // 1451  外键引用阻止删除
    'ER_DATA_TOO_LONG',     // 1406  字段值超长
    'ER_DUP_FIELDNAME',     // 1060  ALTER TABLE ADD COLUMN：列已存在
    'ER_DUP_KEYNAME',       // 1061  CREATE INDEX：索引已存在
    'ER_CANT_DROP_FIELD_OR_KEY', // 1091 ALTER TABLE DROP：列/索引不存在
  ];
  if (nonFailureCodes.includes(error.code)) return false;
  // 排除 4xx 业务错误
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) return false;
  return true;
};

// ============================================// 数据库连接池配置（增强稳定性）// ============================================

// 查询超时配置（30秒）
const DEFAULT_QUERY_TIMEOUT = 30000;

// 创建主库连接池（回调风格）
dbDebugLog('创建主库连接池:', {
  host: databaseConfig.master.host,
  port: databaseConfig.master.port,
  user: databaseConfig.master.user,
  password: databaseConfig.master.password ? '***' : '空',
  database: databaseConfig.master.database,
});

const masterPool = mysql.createPool({
  host: databaseConfig.master.host,
  port: databaseConfig.master.port,
  user: databaseConfig.master.user,
  password: databaseConfig.master.password,
  database: databaseConfig.master.database,
  waitForConnections: true,
  connectionLimit: databaseConfig.master.connectionLimit,
  queueLimit: databaseConfig.master.queueLimit,
  connectTimeout: databaseConfig.master.connectTimeout,
  enableKeepAlive: databaseConfig.master.enableKeepAlive,
  keepAliveInitialDelay: databaseConfig.master.keepAliveInitialDelay,
  idleTimeout: databaseConfig.master.idleTimeout,
  maxIdle: databaseConfig.master.maxIdle,
  charset: databaseConfig.master.charset,
  timezone: databaseConfig.master.timezone,
});

// 创建从库连接池（回调风格）
const slavePool = mysql.createPool({
  host: databaseConfig.slave.host,
  port: databaseConfig.slave.port,
  user: databaseConfig.slave.user,
  password: databaseConfig.slave.password,
  database: databaseConfig.slave.database,
  waitForConnections: true,
  connectionLimit: databaseConfig.slave.connectionLimit,
  queueLimit: databaseConfig.slave.queueLimit,
  connectTimeout: databaseConfig.slave.connectTimeout,
  enableKeepAlive: databaseConfig.slave.enableKeepAlive,
  keepAliveInitialDelay: databaseConfig.slave.keepAliveInitialDelay,
  idleTimeout: databaseConfig.slave.idleTimeout,
  maxIdle: databaseConfig.slave.maxIdle,
  charset: databaseConfig.slave.charset,
  timezone: databaseConfig.slave.timezone,
});

// 创建主库连接池（Promise 风格）
const masterPromisePool = mysqlPromise.createPool({
  host: databaseConfig.master.host,
  port: databaseConfig.master.port,
  user: databaseConfig.master.user,
  password: databaseConfig.master.password,
  database: databaseConfig.master.database,
  waitForConnections: true,
  connectionLimit: databaseConfig.master.connectionLimit,
  queueLimit: databaseConfig.master.queueLimit,
  connectTimeout: databaseConfig.master.connectTimeout,
  enableKeepAlive: databaseConfig.master.enableKeepAlive,
  keepAliveInitialDelay: databaseConfig.master.keepAliveInitialDelay,
  idleTimeout: databaseConfig.master.idleTimeout,
  maxIdle: databaseConfig.master.maxIdle,
  charset: databaseConfig.master.charset,
  timezone: databaseConfig.master.timezone,
});

// 创建从库连接池（Promise 风格）
const slavePromisePool = mysqlPromise.createPool({
  host: databaseConfig.slave.host,
  port: databaseConfig.slave.port,
  user: databaseConfig.slave.user,
  password: databaseConfig.slave.password,
  database: databaseConfig.slave.database,
  waitForConnections: true,
  connectionLimit: databaseConfig.slave.connectionLimit,
  queueLimit: databaseConfig.slave.queueLimit,
  connectTimeout: databaseConfig.slave.connectTimeout,
  enableKeepAlive: databaseConfig.slave.enableKeepAlive,
  keepAliveInitialDelay: databaseConfig.slave.keepAliveInitialDelay,
  idleTimeout: databaseConfig.slave.idleTimeout,
  maxIdle: databaseConfig.slave.maxIdle,
  charset: databaseConfig.slave.charset,
  timezone: databaseConfig.slave.timezone,
});

// ============================================
// 数据库连接池事件监听
// ============================================
masterPool.on('connection', connection => {
  dbDebugLog('✅ 主数据库新连接已建立');
});

masterPool.on('error', err => {
  console.error('❌ 主数据库连接池错误:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    dbDebugLog('🔄 主数据库连接丢失，连接池将自动重连');
  } else if (err.code === 'ECONNREFUSED') {
    console.error('❌ 主数据库连接被拒绝，请检查：');
    console.error('   1. 数据库服务是否运行');
    console.error('   2. 数据库地址和端口是否正确');
    console.error('   3. 防火墙是否允许连接');
  } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('❌ 主数据库访问被拒绝，请检查用户名和密码');
  }
});

slavePool.on('connection', connection => {
  dbDebugLog('✅ 从数据库新连接已建立');
});

slavePool.on('error', err => {
  console.error('❌ 从数据库连接池错误:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    dbDebugLog('🔄 从数据库连接丢失，连接池将自动重连');
  } else if (err.code === 'ECONNREFUSED') {
    console.error('❌ 从数据库连接被拒绝，将使用主库替代');
  }
});

// ============================================
// SQL类型分析和路由
// ============================================
function shouldUseMaster(sql) {
  const normalizedSql = sql.trim().toUpperCase();

  // 如果读写分离未启用，始终使用主库
  if (!databaseConfig.readWriteSplit.enabled) {
    return true;
  }

  // 如果读操作不使用从库，始终使用主库
  if (!databaseConfig.readWriteSplit.useSlaveForReads) {
    return true;
  }

  // 检查是否包含强制使用主库的关键字
  for (const keyword of databaseConfig.readWriteSplit.forceMasterKeywords) {
    if (normalizedSql.startsWith(keyword)) {
      return true;
    }
  }

  // 默认：读操作使用从库，写操作使用主库
  return false;
}

// ============================================
// 测试数据库连接（带重试机制）
// ============================================
let masterConnectionAttempts = 0;
let slaveConnectionAttempts = 0;
const maxAttempts = 3;

async function testMasterConnection() {
  try {
    const connection = await masterPromisePool.getConnection();
    await connection.ping();
    connection.release();
    dbDebugLog('✅ 主数据库连接成功');
    masterConnectionAttempts = 0; // 重置重试计数
    return true;
  } catch (err) {
    masterConnectionAttempts++;
    console.error(
      `❌ 主数据库连接失败 (尝试 ${masterConnectionAttempts}/${maxAttempts}):`,
      err.message,
    );

    if (masterConnectionAttempts < maxAttempts) {
      dbDebugLog(`🔄 ${3000} 毫秒后重试...`);
      setTimeout(testMasterConnection, 3000);
    } else {
      console.error('❌ 主数据库连接失败，已达到最大重试次数');
      console.error('⚠️  服务器将继续运行，但数据库操作可能失败');
    }
    return false;
  }
}

async function testSlaveConnection() {
  try {
    const connection = await slavePromisePool.getConnection();
    await connection.ping();
    connection.release();
    dbDebugLog('✅ 从数据库连接成功');
    slaveConnectionAttempts = 0; // 重置重试计数
    return true;
  } catch (err) {
    slaveConnectionAttempts++;
    console.error(
      `❌ 从数据库连接失败 (尝试 ${slaveConnectionAttempts}/${maxAttempts}):`,
      err.message,
    );

    if (slaveConnectionAttempts < maxAttempts) {
      dbDebugLog(`🔄 ${3000} 毫秒后重试...`);
      setTimeout(testSlaveConnection, 3000);
    } else {
      console.warn('⚠️  从数据库连接失败，已达到最大重试次数，将使用主库替代');
    }
    return false;
  }
}

// 初始连接测试
// 用 setImmediate 延后到当前同步启动块（上万个模块 require + 几百个路由 app.use 注册）
// 执行完毕、事件循环空闲之后再发起首次 DB 连接，避免启动期长同步阻塞挡住首个 TCP 握手
// 回调，导致 mysql2 误报 connect ETIMEDOUT（并触发无意义的重试 / 半残告警）。
if (!isTestEnv) {
  setImmediate(() => {
    Promise.all([testMasterConnection(), testSlaveConnection()]).then(results => {
      dbDebugLog(
        '📊 数据库连接测试完成，主库:',
        results[0] ? '✅' : '❌',
        '从库:',
        results[1] ? '✅' : '❌',
      );
    });
  });
}

// ============================================
// 定期健康检查（每5分钟检查一次数据库连接）
// ============================================
if (!isTestEnv) {
  setInterval(
    async () => {
      // 主库健康检查
      try {
        const connection = await masterPromisePool.getConnection();
        await connection.ping();
        connection.release();
      } catch (err) {
        console.error('⚠️  主数据库健康检查失败:', err.message);
        // 尝试重新连接主库
        testMasterConnection();
      }

      // 从库健康检查
      try {
        const connection = await slavePromisePool.getConnection();
        await connection.ping();
        connection.release();
      } catch (err) {
        console.error('⚠️  从数据库健康检查失败:', err.message);
        // 尝试重新连接从库
        testSlaveConnection();
      }
    },
    5 * 60 * 1000,
  ); // 5分钟
}

// ============================================
// 读写分离代理 - 保持原有API兼容
// ============================================
const dbProxy = {
  execute: async (sql, values, options) => {
    const isDebug = process.env.DEBUG_SQL === '1';
    const shouldFallbackToQuery = error =>
      typeof error?.message === 'string' &&
      (error.message.includes("Cannot read properties of undefined (reading 'length')") ||
        error.message.includes('ER_WRONG_ARGUMENTS') ||
        error.message.includes('Malformed communication packet') ||
        error.code === 'ER_MALFORMED_PACKET');

    // 模块级连接配额隔离 + 跨模块表访问审计 + 模块级断路器
    const moduleId = getCurrentModuleId();
    // 有界重试：模块池瞬时耗尽时，短暂让出事件循环等待其它请求释放连接，
    // 避免正常并发（如一次写操作叠加守卫审计/出站事件）被直接 503。超时后仍未获连接才真正失败。
    if (moduleId) {
      let acquired = false;
      const maxWaitMs = parseInt(process.env.MODULE_POOL_WAIT_MS, 10) || 1500;
      const stepMs = 25;
      for (let waited = 0; waited <= maxWaitMs; waited += stepMs) {
        if (acquireModuleConnection(moduleId)) { acquired = true; break; }
        await new Promise((r) => setTimeout(r, stepMs));
      }
      if (!acquired) {
        const limit = getModulePoolLimit(moduleId);
        const err = new Error(`MODULE_POOL_EXHAUSTED: 模块 ${moduleId} 已达到连接配额上限 ${limit}，请稍后重试`);
        err.code = 'MODULE_POOL_EXHAUSTED';
        err.statusCode = 503;
        throw err;
      }
    }
    auditSQLAccess(moduleId, sql);

    // 事务控制命令：mysql2 的 prepared statement 协议不支持（START TRANSACTION / COMMIT / ROLLBACK / SET），
    // 走 query() 路径绕过 prepared statement
    const isTransactionCommand = /^\s*(START\s+TRANSACTION|COMMIT|ROLLBACK|SET\s+(?:autocommit|TRANSACTION|@@|sql_mode)|SAVEPOINT|RELEASE\s+SAVEPOINT)\b/i.test(sql);

    // 模块级断路器：某模块连续失败时仅熔断该模块
    const breaker = getModuleCircuitBreaker(moduleId);
    // 慢 SQL 监控阈值（可通过 SLOW_QUERY_MS 环境变量调整, 默认 1000ms）
    const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_MS || '1000', 10);
    // 慢 SQL 计时: 在外层 try/catch 都能访问
    const sqlStart = Date.now();
    let slowQueryLogged = false;
    const executeSQL = async () => {
      if (isDebug) {
        console.debug(`📊 SQL: ${sql.slice(0, 80)}...`);
      }
      let processedValues = values;
      if (Array.isArray(values)) {
        processedValues = values.map(v =>
          typeof v === 'number' && Number.isInteger(v) ? String(v) : v,
        );
      }
      try {
        if (isTransactionCommand) {
          return processedValues !== undefined
            ? await masterPromisePool.query(sql, processedValues)
            : await masterPromisePool.query(sql);
        }
        const result =
          processedValues !== undefined
            ? await masterPromisePool.execute(sql, processedValues)
            : await masterPromisePool.execute(sql);
        return result;
      } catch (error) {
        if (!shouldFallbackToQuery(error)) {
          throw error;
        }
        console.warn('⚠️  SQL执行异常，已降级为query:', error.message);
        try {
          const queryValues = Array.isArray(values) ? values : (values !== undefined ? [values] : undefined);
          if (options && typeof options === 'object') {
            return await masterPromisePool.query({ sql, values: queryValues, ...options });
          }
          return queryValues !== undefined
            ? await masterPromisePool.query(sql, queryValues)
            : await masterPromisePool.query(sql);
        } catch (fallbackError) {
          console.error('⚠️  SQL降级query失败:', fallbackError.message);
          throw error;
        }
      }
    };

    try {
      // 通过断路器执行（仅模块级断路器；无模块上下文时直接执行）
      let result;
      if (breaker) {
        result = await breaker.execute(executeSQL);
      } else {
        result = await executeSQL();
      }
      // 慢 SQL 检测: 超阈值自动 warn (不阻塞正常返回)
      const sqlMs = Date.now() - sqlStart;
      if (sqlMs > SLOW_QUERY_MS) {
        slowQueryLogged = true;
        const sqlPreview = sql.replace(/\s+/g, ' ').slice(0, 200);
        console.warn(
          `⚠️ [SlowQuery] ${sqlMs}ms > ${SLOW_QUERY_MS}ms | module=${moduleId || 'core'} | ` +
          `sql=${sqlPreview}${sql.length > 200 ? '...' : ''}`,
        );
      }
      return result;
    } catch (error) {
      const sqlMs = Date.now() - sqlStart;
      // 慢 SQL 失败的也 log (失败可能是慢 SQL 引起的)
      if (sqlMs > SLOW_QUERY_MS && !slowQueryLogged) {
        const sqlPreview = sql.replace(/\s+/g, ' ').slice(0, 200);
        console.warn(
          `⚠️ [SlowQuery+Error] ${sqlMs}ms > ${SLOW_QUERY_MS}ms (failed) | module=${moduleId || 'core'} | ` +
          `sql=${sqlPreview}${sql.length > 200 ? '...' : ''} | err=${error.message}`,
        );
      }
      // 断路器开启时的拒绝错误直接抛出
      if (error.message && error.message.includes('Circuit breaker is OPEN')) {
        const cbErr = new Error(`MODULE_CIRCUIT_OPEN: 模块 ${moduleId} 断路器已熔断，请稍后重试`);
        cbErr.code = 'MODULE_CIRCUIT_OPEN';
        cbErr.statusCode = 503;
        throw cbErr;
      }
      console.error('⚠️  SQL执行失败:', error.message);
      if (isDebug) {
        console.error('⚠️  SQL语句:', sql);
        console.error('⚠️  SQL参数:', values);
      }
      throw error;
    } finally {
      releaseModuleConnection(moduleId);
    }
  },

  // 获取连接（根据SQL类型自动路由到主库或从库）
  getConnection: async options => {
    try {
      const connection = await masterPromisePool.getConnection(options);
      return connection;
    } catch (error) {
      console.error('获取数据库连接失败:', error.message);
      // 抛出错误，让调用方处理
      throw error;
    }
  },

  // 获取指定类型的连接
  getMasterConnection: async options => {
    try {
      const connection = await masterPromisePool.getConnection(options);
      return connection;
    } catch (error) {
      console.error('获取主库连接失败:', error.message);
      // 抛出错误，让调用方处理
      throw error;
    }
  },

  getSlaveConnection: async options => {
    try {
      const connection = await slavePromisePool.getConnection(options);
      return connection;
    } catch (error) {
      console.error('获取从库连接失败:', error.message);
      // 抛出错误，让调用方处理
      throw error;
    }
  },

  // 事务支持（始终使用主库）
  transaction: async (callback, options) => {
    try {
      const connection = await masterPromisePool.getConnection(options);
      dbDebugLog('获取事务连接成功:', connection);
      try {
        await connection.beginTransaction(options);
        const result = await callback(connection);
        await connection.commit(options);
        dbDebugLog('事务提交成功');
        return result;
      } catch (error) {
        await connection.rollback(options);
        console.error('事务回滚:', error.message);
        throw error;
      } finally {
        connection.release();
        dbDebugLog('事务连接已释放');
      }
    } catch (error) {
      console.error('获取事务连接失败:', error.message);
      // 抛出错误，让调用方处理
      throw error;
    }
  },

  // 其他方法代理到主库
  query: async (sql, values, options) => {
    return await dbProxy.execute(sql, values, options);
  },

  ping: async () => {
    const connection = await masterPromisePool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  },

  end: async options => {
    await Promise.all([masterPool.end(options), slavePool.end(options)]);
  },

  getPoolStats: () => {
    const moduleStatsExport = {};
    for (const [modId, active] of moduleActiveConnections.entries()) {
      const stats = moduleStats.get(modId) || { total: 0, rejected: 0, maxObserved: 0 };
      const breaker = moduleCircuitBreakers.get(modId);
      moduleStatsExport[modId] = {
        activeConnections: active,
        limit: getModulePoolLimit(modId),
        totalRequests: stats.total,
        rejectedRequests: stats.rejected,
        maxObserved: stats.maxObserved,
        circuitBreaker: breaker ? breaker.getState() : null,
      };
    }
    return {
      master: {
        pendingConnections: masterPool.pendingConnections,
        connectionLimit: masterPool.connectionLimit,
        activeConnections: masterPool.activeConnections,
        idleConnections: masterPool.idleConnections,
      },
      slave: {
        pendingConnections: slavePool.pendingConnections,
        connectionLimit: slavePool.connectionLimit,
        activeConnections: slavePool.activeConnections,
        idleConnections: slavePool.idleConnections,
      },
      modules: moduleStatsExport,
    };
  },
};

// 导出代理对象，保持原有API兼容
module.exports = dbProxy;
