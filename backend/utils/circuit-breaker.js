/**
 * 断路器模式实现
 * 防止服务雪崩，提高系统稳定性
 */

const logger = require('../config/logger');

const State = {
  CLOSED: 'CLOSED',     // 正常状态
  OPEN: 'OPEN',         // 断开状态
  HALF_OPEN: 'HALF_OPEN', // 半开状态
};

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;      // 失败阈值
    this.successThreshold = options.successThreshold || 3;      // 成功阈值（半开状态）
    this.timeout = options.timeout || 60000;                    // 断开持续时间
    this.requestTimeout = options.requestTimeout || 10000;      // 请求超时时间
    // 自定义失败判定函数：返回 true 才计入断路器失败统计
    this.isFailure = options.isFailure || (() => true);

    this.state = State.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = Date.now();

    // 统计信息
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      stateChanges: [],
    };

    logger.info(`[CircuitBreaker] ${name} 初始化完成，状态: ${this.state}`);
  }

  async execute(fn, ...args) {
    this.stats.totalRequests++;

    if (this.state === State.OPEN) {
      if (Date.now() < this.nextAttempt) {
        this.stats.rejectedRequests++;
        logger.warn(`[CircuitBreaker] ${this.name} 断路器开启，请求被拒绝`);
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
      // 进入半开状态
      this.state = State.HALF_OPEN;
      this.successCount = 0;
      this._recordStateChange(State.HALF_OPEN);
      logger.info(`[CircuitBreaker] ${this.name} 进入半开状态`);
    }

    try {
      // 使用 Promise.race 实现超时控制
      const result = await Promise.race([
        fn(...args),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Request timeout after ${this.requestTimeout}ms`));
          }, this.requestTimeout);
        }),
      ]);

      this._onSuccess();
      this.stats.successfulRequests++;
      return result;
    } catch (error) {
      // 仅当 isFailure 判定为真时才计入断路器失败统计
      if (this.isFailure(error)) {
        this._onFailure();
        this.stats.failedRequests++;
      }
      throw error;
    }
  }

  _onSuccess() {
    this.failureCount = 0;

    if (this.state === State.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.successThreshold) {
        this.state = State.CLOSED;
        this._recordStateChange(State.CLOSED);
        logger.info(`[CircuitBreaker] ${this.name} 恢复关闭状态`);
      }
    }
  }

  _onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === State.HALF_OPEN) {
      // 半开状态下失败，立即打开
      this.state = State.OPEN;
      this.nextAttempt = Date.now() + this.timeout;
      this._recordStateChange(State.OPEN);
      logger.error(`[CircuitBreaker] ${this.name} 半开状态失败，断路器打开`);
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = State.OPEN;
      this.nextAttempt = Date.now() + this.timeout;
      this._recordStateChange(State.OPEN);
      logger.error(`[CircuitBreaker] ${this.name} 失败次数达到阈值，断路器打开`);
    }
  }

  _recordStateChange(newState) {
    this.stats.stateChanges.push({
      from: this.state,
      to: newState,
      timestamp: new Date().toISOString(),
    });
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      stats: this.stats,
    };
  }

  reset() {
    this.state = State.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this._recordStateChange(State.CLOSED);
    logger.info(`[CircuitBreaker] ${this.name} 手动重置`);
  }
}

// 全局断路器管理器
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }

  get(name, options) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options));
    }
    return this.breakers.get(name);
  }

  getAllStates() {
    const states = {};
    this.breakers.forEach((breaker, name) => {
      states[name] = breaker.getState();
    });
    return states;
  }

  reset(name) {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
    }
  }

  resetAll() {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

const manager = new CircuitBreakerManager();

module.exports = {
  CircuitBreaker,
  CircuitBreakerManager,
  manager,
  State,
};
