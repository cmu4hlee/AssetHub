/**
 * 进程看门狗 — 主动定期监控进程健康
 *
 * 解决的问题：
 * - 内存泄漏难发现：只靠 process.memoryUsage() 一次性检查容易遗漏
 * - Event loop 阻塞难量化：用 setTimeout drift 测量主线程繁忙程度
 * - Heap 接近上限前没预警
 *
 * 用法（在 server.js 启动后调用）：
 *   const startWatchdog = require('./utils/process-watchdog');
 *   startWatchdog({ intervalMs: 60000, heapWarnMB: 400 });
 *
 * 行为：
 * - 定期（默认 60s）打日志: RSS / heapUsed / heapTotal / event loop lag (ms)
 * - heap 超过 heapWarnMB 阈值 → 警告日志 + pino.warn（不重启）
 * - 启动时打一次 baseline
 * - 进程退出时自动清理
 */

const logger = require('../config/logger');

let watchdogTimer = null;
let eventLoopCheckInterval = null;

function bytesToMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

function measureEventLoopLag() {
  return new Promise(resolve => {
    const start = Date.now();
    setImmediate(() => {
      const lag = Date.now() - start;
      resolve(lag);
    });
  });
}

/**
 * 同步打一次快照
 */
function snapshot() {
  const usage = process.memoryUsage();
  return {
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptimeSec: Math.floor(process.uptime()),
    rssMB: Number(bytesToMB(usage.rss)),
    heapUsedMB: Number(bytesToMB(usage.heapUsed)),
    heapTotalMB: Number(bytesToMB(usage.heapTotal)),
    externalMB: Number(bytesToMB(usage.external)),
    arrayBuffersMB: Number(bytesToMB(usage.arrayBuffers)),
  };
}

/**
 * @param {Object} opts
 * @param {number} opts.intervalMs - 检查间隔（默认 60s）
 * @param {number} opts.heapWarnMB - heap 警告阈值（默认 400MB）
 * @param {number} opts.rssWarnMB - RSS 警告阈值（默认 480MB）
 * @param {number} opts.eventLoopLagWarnMs - event loop 阻塞警告阈值（默认 200ms）
 * @param {boolean} opts.logAlways - 是否每次都打日志（默认 false，仅异常时打）
 * @returns {Function} stop - 停止看门狗
 */
function startWatchdog(opts = {}) {
  const intervalMs = opts.intervalMs || 60000;
  const heapWarnMB = opts.heapWarnMB || 400;
  const rssWarnMB = opts.rssWarnMB || 480;
  const eventLoopLagWarnMs = opts.eventLoopLagWarnMs || 200;
  const logAlways = opts.logAlways || false;

  if (watchdogTimer) {
    logger.warn('[Watchdog] 已经在运行, 跳过重复启动');
    return stop;
  }

  // 启动时 baseline
  const baseline = snapshot();
  logger.info(`[Watchdog] 启动进程监控, baseline: RSS=${baseline.rssMB}MB heap=${baseline.heapUsedMB}/${baseline.heapTotalMB}MB uptime=${baseline.uptimeSec}s`);

  watchdogTimer = setInterval(async () => {
    try {
      const snap = snapshot();
      const lag = await measureEventLoopLag();
      snap.eventLoopLagMs = lag;

      const overHeap = snap.heapUsedMB > heapWarnMB;
      const overRss = snap.rssMB > rssWarnMB;
      const lagHigh = lag > eventLoopLagWarnMs;
      const critical = overHeap || overRss;

      if (logAlways || critical || lagHigh) {
        const level = critical ? 'error' : 'warn';
        logger[level](`[Watchdog] 进程健康 ${critical ? '告警' : '提醒'}: ` +
          `RSS=${snap.rssMB}MB heap=${snap.heapUsedMB}/${snap.heapTotalMB}MB ` +
          `eventLoopLag=${lag}ms uptime=${snap.uptimeSec}s pid=${snap.pid}`);
      } else if (process.env.WATCHDOG_DEBUG === 'true') {
        logger.debug(`[Watchdog] 进程健康: RSS=${snap.rssMB}MB heap=${snap.heapUsedMB}MB eventLoopLag=${lag}ms`);
      }
    } catch (err) {
      logger.error('[Watchdog] 监控异常:', err.message);
    }
  }, intervalMs);

  // 进程退出清理
  const cleanup = () => {
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
  };
  process.once('SIGTERM', cleanup);
  process.once('SIGINT', cleanup);
  process.once('exit', cleanup);

  return stop;
}

function stop() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
    logger.info('[Watchdog] 已停止');
  }
}

module.exports = {
  startWatchdog,
  stop,
  snapshot,
};
