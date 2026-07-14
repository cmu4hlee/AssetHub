/**
 * 性能监控中间件
 * 记录请求耗时、慢查询等
 */

const logger = require('../config/logger');

// 慢请求阈值（毫秒）
const SLOW_REQUEST_THRESHOLD = 1000;

// 请求统计
const stats = {
  totalRequests: 0,
  slowRequests: 0,
  errorRequests: 0,
  totalDuration: 0,
  endpoints: new Map(),
};

/**
 * 性能监控中间件
 */
function performanceMonitor(req, res, next) {
  const start = Date.now();
  const endpoint = `${req.method} ${req.route ? req.route.path : req.path}`;

  // 记录原始 end 方法
  const originalEnd = res.end;

  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;
    const {statusCode} = res;

    // 更新统计
    stats.totalRequests++;
    stats.totalDuration += duration;

    if (statusCode >= 400) {
      stats.errorRequests++;
    }

    // 端点统计
    if (!stats.endpoints.has(endpoint)) {
      stats.endpoints.set(endpoint, {
        count: 0,
        totalDuration: 0,
        slowCount: 0,
        errorCount: 0,
      });
    }

    const endpointStats = stats.endpoints.get(endpoint);
    endpointStats.count++;
    endpointStats.totalDuration += duration;

    if (duration > SLOW_REQUEST_THRESHOLD) {
      stats.slowRequests++;
      endpointStats.slowCount++;

      logger.warn(`[Performance] 慢请求: ${endpoint} - ${duration}ms`);
    }

    if (statusCode >= 400) {
      endpointStats.errorCount++;
    }

    // 记录响应时间头部
    res.setHeader('X-Response-Time', `${duration}ms`);

    // 调用原始 end 方法
    originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * 获取性能统计
 */
function getPerformanceStats() {
  const avgDuration = stats.totalRequests > 0
    ? Math.round(stats.totalDuration / stats.totalRequests)
    : 0;

  const endpoints = {};
  stats.endpoints.forEach((value, key) => {
    endpoints[key] = {
      ...value,
      avgDuration: Math.round(value.totalDuration / value.count),
    };
  });

  return {
    totalRequests: stats.totalRequests,
    slowRequests: stats.slowRequests,
    errorRequests: stats.errorRequests,
    avgDuration,
    slowRate: stats.totalRequests > 0
      ? `${((stats.slowRequests / stats.totalRequests) * 100).toFixed(2)  }%`
      : '0%',
    errorRate: stats.totalRequests > 0
      ? `${((stats.errorRequests / stats.totalRequests) * 100).toFixed(2)  }%`
      : '0%',
    endpoints,
  };
}

/**
 * 重置统计
 */
function resetStats() {
  stats.totalRequests = 0;
  stats.slowRequests = 0;
  stats.errorRequests = 0;
  stats.totalDuration = 0;
  stats.endpoints.clear();
}

module.exports = {
  performanceMonitor,
  getPerformanceStats,
  resetStats,
  SLOW_REQUEST_THRESHOLD,
};
