const logger = require('../config/logger');

// 生产环境日志级别控制
const isDev = process.env.NODE_ENV !== 'production';
const shouldLog = isDev;

// 日志工具函数
function debugLog(prefix, ...args) {
  if (shouldLog) {
    console.log(`[${prefix}]`, ...args);
  }
}

function warnLog(prefix, ...args) {
  if (shouldLog) {
    console.warn(`[${prefix}]`, ...args);
  }
}

function errorLog(prefix, ...args) {
  logger.error(`[${prefix}]`, ...args);
}

// 简单内存缓存（性能优化）
class SimpleCache {
  constructor(maxSize = 100, ttl = 30000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.time < this.ttl) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  set(key, data) {
    // 限制缓存大小
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, time: Date.now() });
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// 部门元数据解析
async function resolveDepartmentMeta(executor, tenantId, departmentValue) {
  if (departmentValue === undefined || departmentValue === null) {
    return null;
  }

  const normalizedValue = String(departmentValue).trim();
  if (!normalizedValue) {
    return null;
  }

  let [rows] = await executor.execute(
    'SELECT department_code, department_name FROM departments WHERE department_code = ? AND tenant_id = ? LIMIT 1',
    [normalizedValue, tenantId],
  );

  if (rows.length === 0) {
    [rows] = await executor.execute(
      'SELECT department_code, department_name FROM departments WHERE department_name = ? AND tenant_id = ? LIMIT 1',
      [normalizedValue, tenantId],
    );
  }

  if (rows.length === 0) {
    return null;
  }

  return {
    department_code: rows[0].department_code,
    department_name: rows[0].department_name,
  };
}

// 生成查询哈希
function generateQueryHash(query) {
  if (!query) return 'empty';
  const sortedQuery = Object.keys(query)
    .sort()
    .map(key => `${key}:${query[key]}`)
    .join('|');
  return require('crypto').createHash('md5').update(sortedQuery).digest('hex');
}

// 解析正整数
function parsePositiveInt(value, defaultValue = 1, options = {}) {
  const parsed = parseInt(value, 10);
  const min = options.min || 1;
  const max = options.max || Number.MAX_SAFE_INTEGER;

  if (isNaN(parsed) || parsed < min) {
    return defaultValue;
  }

  if (parsed > max) {
    return max;
  }

  return parsed;
}

module.exports = {
  debugLog,
  warnLog,
  errorLog,
  SimpleCache,
  resolveDepartmentMeta,
  generateQueryHash,
  parsePositiveInt,
};
