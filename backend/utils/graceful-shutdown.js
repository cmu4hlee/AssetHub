/**
 * 优雅关闭服务
 * 确保所有请求处理完成后再关闭，避免数据丢失
 */

const logger = require('../config/logger');
const db = require('../config/database');

class GracefulShutdown {
  constructor(server, options = {}) {
    this.server = server;
    this.options = {
      timeout: options.timeout || 30000,        // 关闭超时时间
      checkInterval: options.checkInterval || 1000, // 检查间隔
      ...options,
    };

    this.isShuttingDown = false;
    this.initialized = false;
    this.connections = new Set();
    this.shutdownCallbacks = [];
  }

  /**
   * 初始化优雅关闭监听
   */
  init() {
    if (this.initialized) {
      return;
    }

    // 监听连接
    this.server.on('connection', (conn) => {
      this.connections.add(conn);

      conn.on('close', () => {
        this.connections.delete(conn);
      });
    });

    // 监听关闭信号
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));

    // Windows 上的关闭信号
    if (process.platform === 'win32') {
      process.on('message', (msg) => {
        if (msg === 'shutdown') {
          this.shutdown('shutdown');
        }
      });
    }

    this.initialized = true;
    logger.info('[GracefulShutdown] 优雅关闭机制已初始化');
  }

  /**
   * 注册关闭回调
   */
  onShutdown(callback) {
    this.shutdownCallbacks.push(callback);
  }

  /**
   * 执行关闭
   */
  async shutdown(signal) {
    if (this.isShuttingDown) {
      logger.warn('[GracefulShutdown] 关闭已在进行中...');
      return;
    }

    this.isShuttingDown = true;
    logger.info(`[GracefulShutdown] 收到 ${signal} 信号，开始优雅关闭...`);

    const startTime = Date.now();

    try {
      // 1. 停止接收新连接
      logger.info('[GracefulShutdown] 停止接收新连接...');
      this.server.close(() => {
        logger.info('[GracefulShutdown] HTTP服务器已关闭');
      });

      // 2. 等待现有请求完成
      await this.waitForConnections();

      // 3. 执行注册的关闭回调
      logger.info('[GracefulShutdown] 执行关闭回调...');
      for (const callback of this.shutdownCallbacks) {
        try {
          await Promise.race([
            callback(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Shutdown callback timeout')), 5000),
            ),
          ]);
        } catch (error) {
          logger.error('[GracefulShutdown] 关闭回调执行失败:', error);
        }
      }

      // 4. 关闭数据库连接池
      logger.info('[GracefulShutdown] 关闭数据库连接池...');
      try {
        await Promise.race([
          db.end(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database close timeout')), 10000),
          ),
        ]);
        logger.info('[GracefulShutdown] 数据库连接池已关闭');
      } catch (error) {
        logger.error('[GracefulShutdown] 关闭数据库连接池失败:', error);
      }

      const duration = Date.now() - startTime;
      logger.info(`[GracefulShutdown] 优雅关闭完成，耗时 ${duration}ms`);

      // 正常退出
      process.exit(0);
    } catch (error) {
      logger.error('[GracefulShutdown] 优雅关闭失败:', error);
      process.exit(1);
    }
  }

  /**
   * 等待所有连接关闭
   */
  async waitForConnections() {
    const startTime = Date.now();

    while (this.connections.size > 0) {
      const elapsed = Date.now() - startTime;
      const remaining = this.options.timeout - elapsed;

      if (remaining <= 0) {
        logger.warn(`[GracefulShutdown] 超时，强制关闭 ${this.connections.size} 个连接`);
        this.forceCloseConnections();
        break;
      }

      logger.info(`[GracefulShutdown] 等待 ${this.connections.size} 个连接关闭，剩余 ${remaining}ms...`);
      await this.sleep(this.options.checkInterval);
    }
  }

  /**
   * 强制关闭所有连接
   */
  forceCloseConnections() {
    for (const conn of this.connections) {
      try {
        conn.destroy();
      } catch (error) {
        // 忽略错误
      }
    }
    this.connections.clear();
  }

  /**
   * 延迟函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 创建优雅关闭管理器
 */
function createGracefulShutdown(server, options) {
  return new GracefulShutdown(server, options);
}

module.exports = {
  GracefulShutdown,
  createGracefulShutdown,
};
