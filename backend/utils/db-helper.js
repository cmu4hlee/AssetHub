/**
 * 数据库查询助手
 * 封装常用查询模式，添加断路器保护
 */

const db = require('../config/database');
const { manager: circuitBreakerManager } = require('./circuit-breaker');
const logger = require('../config/logger');

// 排序字段白名单正则：允许 字母数字下划线点 + 可选 ASC/DESC
const ORDER_BY_REGEX = /^[a-zA-Z0-9_.]+(\s+(ASC|DESC))?$/i;

function validateOrderBy(orderBy) {
  if (!orderBy) return null;
  // 支持多列排序（逗号分隔）
  const parts = orderBy.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || !ORDER_BY_REGEX.test(trimmed)) {
      console.warn(`[DB] 无效的排序参数已忽略: ${trimmed}`);
      return null;
    }
  }
  return orderBy;
}

// 获取或创建数据库断路器
const dbCircuitBreaker = circuitBreakerManager.get('database', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,
  requestTimeout: 10000,
});

/**
 * 执行查询（带断路器保护）
 */
async function query(sql, params, options = {}) {
  const { useMaster = false, timeout = 10000 } = options;

  return dbCircuitBreaker.execute(async () => {
    const start = Date.now();
    try {
      const result = await db.query(sql, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        logger.warn(`[DB] 慢查询: ${sql.slice(0, 100)}... - ${duration}ms`);
      }

      return result;
    } catch (error) {
      logger.error(`[DB] 查询失败: ${sql.slice(0, 100)}...`, error.message);
      throw error;
    }
  });
}

/**
 * 执行更新（带断路器保护）
 */
async function execute(sql, params, options = {}) {
  const { timeout = 10000 } = options;

  return dbCircuitBreaker.execute(async () => {
    const start = Date.now();
    try {
      const result = await db.execute(sql, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        logger.warn(`[DB] 慢更新: ${sql.slice(0, 100)}... - ${duration}ms`);
      }

      return result;
    } catch (error) {
      logger.error(`[DB] 执行失败: ${sql.slice(0, 100)}...`, error.message);
      throw error;
    }
  });
}

/**
 * 事务执行（带断路器保护）
 */
async function transaction(callback, options = {}) {
  return dbCircuitBreaker.execute(async () => {
    const start = Date.now();
    try {
      const result = await db.transaction(callback, options);
      const duration = Date.now() - start;

      if (duration > 3000) {
        logger.warn(`[DB] 慢事务: ${duration}ms`);
      }

      return result;
    } catch (error) {
      logger.error('[DB] 事务失败:', error.message);
      throw error;
    }
  });
}

/**
 * 批量插入
 */
async function batchInsert(table, columns, values, options = {}) {
  const { batchSize = 1000 } = options;

  if (values.length === 0) return { affectedRows: 0 };

  const results = [];

  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    const placeholders = batch.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;

    const flatValues = batch.flat();
    const result = await execute(sql, flatValues);
    results.push(result);
  }

  return {
    affectedRows: results.reduce((sum, r) => sum + (r.affectedRows || 0), 0),
  };
}

/**
 * 分页查询
 */
async function paginate(sql, params, options = {}) {
  const {
    page = 1,
    pageSize = 20,
    orderBy = null,
    countSql = null,
  } = options;

  const offset = (page - 1) * pageSize;

  // 构建分页 SQL
  let paginatedSql = sql;
  const safeOrderBy = validateOrderBy(orderBy);
  if (safeOrderBy) {
    paginatedSql += ` ORDER BY ${safeOrderBy}`;
  }
  paginatedSql += ' LIMIT ? OFFSET ?';

  const [rows] = await query(paginatedSql, [...params, pageSize, offset]);

  // 获取总数
  let total = 0;
  if (countSql) {
    const [countResult] = await query(countSql, params);
    total = countResult?.total || countResult?.count || 0;
  }

  return {
    list: rows,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total: parseInt(total),
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * 缓存查询结果
 */
async function cachedQuery(cacheKey, sql, params, options = {}) {
  const { ttl = 300, cacheService = null } = options;

  // 尝试从缓存获取
  if (cacheService) {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  // 执行查询
  const result = await query(sql, params);

  // 写入缓存
  if (cacheService) {
    await cacheService.set(cacheKey, JSON.stringify(result), ttl);
  }

  return result;
}

/**
 * 清除缓存
 */
async function clearCache(cacheKey, cacheService) {
  if (cacheService) {
    await cacheService.delete(cacheKey);
  }
}

module.exports = {
  query,
  execute,
  transaction,
  batchInsert,
  paginate,
  cachedQuery,
  clearCache,
  circuitBreaker: dbCircuitBreaker,
};
