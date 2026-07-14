/**
 * 内存监控和预警
 * 防止内存泄漏导致服务崩溃
 */

const logger = require('../config/logger');
const EventEmitter = require('events');

class MemoryMonitor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.warningThreshold = options.warningThreshold || 0.7;  // 70% 警告
    this.criticalThreshold = options.criticalThreshold || 0.85; // 85% 危险
    this.emergencyThreshold = options.emergencyThreshold || 0.95; // 95% 紧急

    this.checkInterval = options.checkInterval || 30000; // 30秒检查一次
    this.gcInterval = options.gcInterval || 5 * 60 * 1000; // 5分钟尝试GC

    this.intervalId = null;
    this.gcIntervalId = null;
    this.stats = [];
    this.maxStatsLength = 100;

    this.lastWarningTime = 0;
    this.warningCooldown = 5 * 60 * 1000; // 5分钟冷却

    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('[MemoryMonitor] 内存监控已启动');

    // 定期检查内存
    this.intervalId = setInterval(() => this._checkMemory(), this.checkInterval);

    // 定期尝试GC（如果可用）
    if (global.gc) {
      this.gcIntervalId = setInterval(() => this._tryGC(), this.gcInterval);
    }

    // 初始检查
    this._checkMemory();
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.gcIntervalId) {
      clearInterval(this.gcIntervalId);
      this.gcIntervalId = null;
    }
    logger.info('[MemoryMonitor] 内存监控已停止');
  }

  _checkMemory() {
    const usage = process.memoryUsage();
    const {heapTotal} = usage;
    const {heapUsed} = usage;
    const external = usage.external || 0;
    const {rss} = usage;

    // 计算堆内存使用率
    const heapUsageRatio = heapUsed / heapTotal;

    // 记录统计
    const stat = {
      timestamp: Date.now(),
      rss: this._formatBytes(rss),
      heapTotal: this._formatBytes(heapTotal),
      heapUsed: this._formatBytes(heapUsed),
      external: this._formatBytes(external),
      heapUsageRatio: `${(heapUsageRatio * 100).toFixed(2)  }%`,
    };

    this.stats.push(stat);
    if (this.stats.length > this.maxStatsLength) {
      this.stats.shift();
    }

    // 检查阈值
    const now = Date.now();

    if (heapUsageRatio > this.emergencyThreshold) {
      logger.error('[MemoryMonitor] 🚨 内存使用率达到紧急阈值:', stat);
      this.emit('emergency', { usage, ratio: heapUsageRatio });
      this._emergencyCleanup();
    } else if (heapUsageRatio > this.criticalThreshold) {
      if (now - this.lastWarningTime > this.warningCooldown) {
        logger.warn('[MemoryMonitor] ⚠️  内存使用率达到危险阈值:', stat);
        this.lastWarningTime = now;
      }
      this.emit('critical', { usage, ratio: heapUsageRatio });
      this._tryGC();
    } else if (heapUsageRatio > this.warningThreshold) {
      if (now - this.lastWarningTime > this.warningCooldown) {
        logger.warn('[MemoryMonitor] ⚡ 内存使用率达到警告阈值:', stat);
        this.lastWarningTime = now;
      }
      this.emit('warning', { usage, ratio: heapUsageRatio });
    }
  }

  _tryGC() {
    if (global.gc) {
      const before = process.memoryUsage().heapUsed;
      global.gc();
      const after = process.memoryUsage().heapUsed;
      const freed = before - after;

      if (freed > 10 * 1024 * 1024) { // 释放超过10MB才记录
        logger.info(`[MemoryMonitor] GC执行完成，释放内存: ${this._formatBytes(freed)}`);
      }
    }
  }

  _emergencyCleanup() {
    logger.error('[MemoryMonitor] 执行紧急内存清理...');

    // 触发GC
    if (global.gc) {
      global.gc();
      global.gc(); // 强制两次GC
    }

    // 发出内存压力事件，其他组件可以监听并释放缓存
    this.emit('memoryPressure');

    // 如果内存仍然很高，考虑重启进程（由PM2等进程管理器处理）
    const afterGC = process.memoryUsage();
    if (afterGC.heapUsed / afterGC.heapTotal > this.emergencyThreshold) {
      logger.error('[MemoryMonitor] 内存清理后仍然过高，建议重启服务');
      this.emit('restartRequired');
    }
  }

  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  }

  getStats() {
    const usage = process.memoryUsage();
    return {
      current: {
        rss: this._formatBytes(usage.rss),
        heapTotal: this._formatBytes(usage.heapTotal),
        heapUsed: this._formatBytes(usage.heapUsed),
        external: this._formatBytes(usage.external || 0),
        heapUsageRatio: `${((usage.heapUsed / usage.heapTotal) * 100).toFixed(2)  }%`,
      },
      history: this.stats,
      thresholds: {
        warning: `${this.warningThreshold * 100  }%`,
        critical: `${this.criticalThreshold * 100  }%`,
        emergency: `${this.emergencyThreshold * 100  }%`,
      },
    };
  }
}

// 单例实例
const monitor = new MemoryMonitor();

module.exports = {
  MemoryMonitor,
  monitor,
};
