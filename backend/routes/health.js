/**
 * 健康检查和监控路由
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: 基础健康检查
 *     description: 检查服务健康状态
 *     tags: [系统监控]
 *     responses:
 *       200:
 *         description: 服务正常
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: integer
 *                 version:
 *                   type: string
 *                 checks:
 *                   type: object
 *       503:
 *         description: 服务异常
 */

/**
 * @swagger
 * /api/health/detailed:
 *   get:
 *     summary: 详细健康状态
 *     description: 获取详细的健康状态信息
 *     tags: [系统监控]
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: integer
 *                 components:
 *                   type: object
 *                 circuitBreakers:
 *                   type: object
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/health/ready:
 *   get:
 *     summary: 就绪检查
 *     description: Kubernetes等编排系统使用的就绪探针
 *     tags: [系统监控]
 *     responses:
 *       200:
 *         description: 服务就绪
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 ready:
 *                   type: boolean
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: 服务未就绪
 */

/**
 * @swagger
 * /api/health/alive:
 *   get:
 *     summary: 存活检查
 *     description: Kubernetes等编排系统使用的存活探针
 *     tags: [系统监控]
 *     responses:
 *       200:
 *         description: 服务存活
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 alive:
 *                   type: boolean
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */

/**
 * @swagger
 * /api/health/metrics:
 *   get:
 *     summary: 获取监控指标
 *     description: Prometheus格式的监控指标
 *     tags: [系统监控]
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: |
 *                 # HELP nodejs_heap_size_total_bytes Total heap size
 *                 # TYPE nodejs_heap_size_total_bytes gauge
 *                 nodejs_heap_size_total_bytes 10000000
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/health/circuit-breakers:
 *   get:
 *     summary: 获取断路器状态
 *     tags: [系统监控]
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/health/circuit-breakers/{name}/reset:
 *   post:
 *     summary: 重置断路器
 *     tags: [系统监控]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: 断路器名称
 *     responses:
 *       200:
 *         description: 重置成功
 */

const express = require('express');
const router = express.Router();
const os = require('os');
const db = require('../config/database');
const { monitor: memoryMonitor } = require('../utils/memory-monitor');
const { manager: circuitBreakerManager } = require('../utils/circuit-breaker');
const logger = require('../config/logger');
// 主缓存（ioredis）连接与命中统计，用于健康检查与指标暴露
const { redis, cacheService } = require('../services/redis');

// 启动时间
const startTime = Date.now();

/**
 * 基础健康检查
 */
router.get('/health', async (req, res) => {
  try {
    // 检查数据库连接
    const dbHealthy = await checkDatabase();

    const status = {
      success: true,
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: dbHealthy ? 'ok' : 'error',
        memory: checkMemory(),
        redis: getRedisStatus(),
      },
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(status);
  } catch (error) {
    logger.error('[Health] 健康检查失败:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
    });
  }
});

/**
 * 详细健康状态
 */
router.get('/health/detailed', async (req, res) => {
  try {
    const [dbStatus, memoryStats, systemInfo, cacheStatus] = await Promise.all([
      getDatabaseStatus(),
      memoryMonitor.getStats(),
      getSystemInfo(),
      getCacheStatus(),
    ]);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      status: determineOverallStatus(dbStatus, memoryStats),
      components: {
        database: dbStatus,
        memory: memoryStats,
        system: systemInfo,
        cache: cacheStatus,
      },
      circuitBreakers: circuitBreakerManager.getAllStates(),
    });
  } catch (error) {
    logger.error('[Health] 详细健康检查失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 就绪检查（用于 Kubernetes 等编排系统）
 */
router.get('/ready', async (req, res) => {
  try {
    const dbHealthy = await checkDatabase();

    if (dbHealthy) {
      res.json({
        success: true,
        ready: true,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        success: false,
        ready: false,
        reason: 'Database connection failed',
      });
    }
  } catch (error) {
    res.status(503).json({
      success: false,
      ready: false,
      reason: error.message,
    });
  }
});

/**
 * 存活检查
 */
router.get('/alive', (req, res) => {
  res.json({
    success: true,
    alive: true,
    timestamp: new Date().toISOString(),
  });
});

/**
 * 依赖检查（深度的外部依赖健康度, 用于 K8s readinessProbe / 第三方监控）
 * 详查: DB ping (主从) + Redis + 连接池 + 内存 + 进程 event loop lag
 * 任何 critical 依赖失败 → 503, 全部 ok → 200
 */
router.get('/health/dependencies', async (req, res) => {
  const checks = {};
  let criticalFailed = false;

  // 1. 数据库主库 ping (用 2s 超时, 不阻塞)
  try {
    const start = Date.now();
    await Promise.race([
      db.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ping_timeout')), 2000)),
    ]);
    checks.database = {
      status: 'ok',
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    checks.database = { status: 'error', error: err.message };
    criticalFailed = true;
  }

  // 2. 连接池状态
  try {
    const stats = db.getPoolStats ? db.getPoolStats() : {};
    checks.pool = {
      status: 'ok',
      master: stats.master || null,
      slave: stats.slave || null,
    };
  } catch (err) {
    checks.pool = { status: 'error', error: err.message };
  }

  // 3. Redis (可选, 不可用不算 critical)
  try {
    if (redis && redis.status === 'ready') {
      const start = Date.now();
      await Promise.race([
        redis.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('redis_timeout')), 1000)),
      ]);
      checks.redis = { status: 'ok', latencyMs: Date.now() - start };
    } else {
      checks.redis = { status: 'disabled', note: 'Redis 未启用或未连接' };
    }
  } catch (err) {
    checks.redis = { status: 'error', error: err.message };
  }

  // 4. 进程内存 (warn if > 80% 阈值)
  try {
    const usage = process.memoryUsage();
    const rssLimit = parseInt(process.env.MAX_MEMORY_MB || '512', 10) * 1024 * 1024;
    const rssMB = Number((usage.rss / 1024 / 1024).toFixed(1));
    const heapMB = Number((usage.heapUsed / 1024 / 1024).toFixed(1));
    const ratio = usage.rss / rssLimit;
    checks.memory = {
      status: ratio > 0.95 ? 'critical' : ratio > 0.8 ? 'warning' : 'ok',
      rssMB,
      heapUsedMB: heapMB,
      rssLimitMB: Number((rssLimit / 1024 / 1024).toFixed(1)),
      ratioPct: Number((ratio * 100).toFixed(1)),
    };
  } catch (err) {
    checks.memory = { status: 'error', error: err.message };
  }

  // 5. Event loop lag (1 sample)
  try {
    const lag = await new Promise(resolve => {
      const start = Date.now();
      setImmediate(() => resolve(Date.now() - start));
    });
    checks.eventLoop = {
      status: lag > 500 ? 'critical' : lag > 200 ? 'warning' : 'ok',
      lagMs: lag,
    };
  } catch (err) {
    checks.eventLoop = { status: 'error', error: err.message };
  }

  // 6. uptime + 版本
  checks.system = {
    status: 'ok',
    uptimeSec: Math.floor(process.uptime()),
    nodeVersion: process.version,
    pid: process.pid,
    platform: os.platform(),
  };

  const response = {
    success: !criticalFailed,
    status: criticalFailed ? 'unhealthy' : 'healthy',
    timestamp: new Date().toISOString(),
    checks,
  };
  res.status(criticalFailed ? 503 : 200).json(response);
});

/**
 * 指标监控（Prometheus 格式）
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await generateMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('[Health] 生成指标失败:', error);
    res.status(500).send('# Error generating metrics');
  }
});

/**
 * 断路器状态
 */
router.get('/circuit-breakers', (req, res) => {
  res.json({
    success: true,
    circuitBreakers: circuitBreakerManager.getAllStates(),
  });
});

/**
 * 重置断路器
 */
router.post('/circuit-breakers/:name/reset', (req, res) => {
  const { name } = req.params;
  circuitBreakerManager.reset(name);
  res.json({
    success: true,
    message: `Circuit breaker ${name} has been reset`,
  });
});

// ==================== 辅助函数 ====================

async function checkDatabase() {
  try {
    await db.ping();
    return true;
  } catch (error) {
    logger.warn('[Health] 数据库健康检查失败:', error.message);
    return false;
  }
}

async function getDatabaseStatus() {
  try {
    const start = Date.now();
    await db.ping();
    const latency = Date.now() - start;

    const stats = db.getPoolStats ? db.getPoolStats() : {};

    return {
      status: 'ok',
      latency: `${latency}ms`,
      pools: stats,
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
    };
  }
}

function checkMemory() {
  const usage = process.memoryUsage();
  const rssLimit = parseInt(process.env.MAX_MEMORY_MB || '512', 10) * 1024 * 1024;
  const rssRatio = usage.rss / rssLimit;

  if (rssRatio > 0.95) return 'critical';
  if (rssRatio > 0.8) return 'warning';
  return 'ok';
}

// Redis 连接状态（用于 /health 的 checks.redis）
function getRedisStatus() {
  if (!redis) return 'disabled';
  if (redis.status === 'ready') return 'ok';
  if (redis.status === 'connect' || redis.status === 'connecting') return 'connecting';
  return 'unhealthy';
}

// 缓存层详细状态（用于 /health/detailed 的 components.cache）
async function getCacheStatus() {
  try {
    const health = await cacheService.healthCheck();
    const stats = cacheService.getStats();
    return { ...health, stats };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

function getSystemInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    cpus: os.cpus().length,
    totalMemory: formatBytes(os.totalmem()),
    freeMemory: formatBytes(os.freemem()),
    loadavg: os.loadavg(),
  };
}

function determineOverallStatus(dbStatus, memoryStats) {
  if (dbStatus.status !== 'ok') return 'unhealthy';

  const rssMB = parseFloat(memoryStats.current.rss);
  const rssLimitMB = parseInt(process.env.MAX_MEMORY_MB || '512', 10);
  const rssRatio = rssMB / rssLimitMB * 100;
  if (rssRatio > 95) return 'degraded';

  return 'healthy';
}

async function generateMetrics() {
  const usage = process.memoryUsage();
  const stats = db.getPoolStats ? db.getPoolStats() : {};

  let metrics = '';

  // 内存指标
  metrics += '# HELP nodejs_heap_size_total_bytes Total heap size\n';
  metrics += '# TYPE nodejs_heap_size_total_bytes gauge\n';
  metrics += `nodejs_heap_size_total_bytes ${usage.heapTotal}\n`;

  metrics += '# HELP nodejs_heap_size_used_bytes Used heap size\n';
  metrics += '# TYPE nodejs_heap_size_used_bytes gauge\n';
  metrics += `nodejs_heap_size_used_bytes ${usage.heapUsed}\n`;

  // 数据库连接池指标
  if (stats.master) {
    metrics += '# HELP db_master_active_connections Active database connections\n';
    metrics += '# TYPE db_master_active_connections gauge\n';
    metrics += `db_master_active_connections ${stats.master.activeConnections || 0}\n`;

    metrics += '# HELP db_master_pending_connections Pending database connections\n';
    metrics += '# TYPE db_master_pending_connections gauge\n';
    metrics += `db_master_pending_connections ${stats.master.pendingConnections || 0}\n`;
  }

  // 运行时间
  metrics += '# HELP app_uptime_seconds Application uptime\n';
  metrics += '# TYPE app_uptime_seconds gauge\n';
  metrics += `app_uptime_seconds ${Math.floor((Date.now() - startTime) / 1000)}\n`;

  // 缓存命中/未命中/写入/删除指标
  const cacheStats = cacheService.getStats();
  metrics += '# HELP assethub_cache_hits_total Cache hit count\n';
  metrics += '# TYPE assethub_cache_hits_total counter\n';
  metrics += `assethub_cache_hits_total ${cacheStats.hits}\n`;
  metrics += '# HELP assethub_cache_misses_total Cache miss count\n';
  metrics += '# TYPE assethub_cache_misses_total counter\n';
  metrics += `assethub_cache_misses_total ${cacheStats.misses}\n`;
  metrics += '# HELP assethub_cache_sets_total Cache set count\n';
  metrics += '# TYPE assethub_cache_sets_total counter\n';
  metrics += `assethub_cache_sets_total ${cacheStats.sets}\n`;
  metrics += '# HELP assethub_cache_deletes_total Cache delete count\n';
  metrics += '# TYPE assethub_cache_deletes_total counter\n';
  metrics += `assethub_cache_deletes_total ${cacheStats.deletes}\n`;

  return metrics;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
}

module.exports = router;
