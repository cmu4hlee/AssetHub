/**
 * 多级缓存服务
 * L1: 本地内存缓存 (Node.js 进程内)
 * L2: Redis 分布式缓存
 * L3: 数据库查询缓存
 *
 * @version 1.0.0
 * @author AssetHub Team
 */

const NodeCache = require('node-cache');
const Redis = require('ioredis');
const crypto = require('crypto');
const { logger } = require('../../config/logger');

// 缓存配置
const CACHE_CONFIG = {
  l1: {
    enabled: true,
    maxSize: 1000,
    ttl: 60, // 1分钟
    checkperiod: 30,
    useClones: false,
  },
  l2: {
    enabled: true,
    ttl: 300, // 5分钟
    prefix: 'assethub:cache:',
    retryStrategy: (times) => Math.min(times * 50, 2000),
  },
  l3: {
    enabled: false, // 默认禁用，需要时开启
    ttl: 1800, // 30分钟
  },
};

class CacheService {
  constructor() {
    this.l1Cache = null;
    this.l2Cache = null;
    this.stats = {
      l1: { hits: 0, misses: 0 },
      l2: { hits: 0, misses: 0 },
      db: { hits: 0 },
    };
    this.initialized = false;
  }

  /**
   * 初始化缓存服务
   */
  async initialize() {
    if (this.initialized) return;

    // 初始化 L1 本地缓存
    if (CACHE_CONFIG.l1.enabled) {
      this.l1Cache = new NodeCache({
        stdTTL: CACHE_CONFIG.l1.ttl,
        checkperiod: CACHE_CONFIG.l1.checkperiod,
        useClones: CACHE_CONFIG.l1.useClones,
        maxKeys: CACHE_CONFIG.l1.maxSize,
      });

      this.l1Cache.on('expired', (key, value) => {
        logger.debug(`L1 cache expired: ${key}`);
      });

      this.l1Cache.on('flush', () => {
        logger.info('L1 cache flushed');
      });

      logger.info('L1 cache initialized');
    }

    // 初始化 L2 Redis 缓存
    if (CACHE_CONFIG.l2.enabled) {
      try {
        this.l2Cache = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD,
          db: process.env.REDIS_CACHE_DB || 1,
          retryStrategy: CACHE_CONFIG.l2.retryStrategy,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
        });

        this.l2Cache.on('connect', () => {
          logger.info('L2 Redis cache connected');
        });

        this.l2Cache.on('error', (err) => {
          logger.error('L2 Redis cache error:', err.message);
        });

        await this.l2Cache.connect().catch(() => {
          logger.warn('L2 Redis cache connection failed, will retry on demand');
        });

        logger.info('L2 cache initialized');
      } catch (error) {
        logger.error('L2 cache initialization failed:', error.message);
        this.l2Cache = null;
      }
    }

    this.initialized = true;
    logger.info('Cache service initialized successfully');
  }

  /**
   * 生成缓存键
   */
  generateKey(namespace, key) {
    const keyString = typeof key === 'string' ? key : JSON.stringify(key);
    const hash = crypto.createHash('md5').update(keyString).digest('hex');
    return `${CACHE_CONFIG.l2.prefix}${namespace}:${hash}`;
  }

  /**
   * 获取缓存
   */
  async get(namespace, key, options = {}) {
    const cacheKey = this.generateKey(namespace, key);
    const { skipL1 = false, skipL2 = false } = options;

    // L1 缓存查询
    if (!skipL1 && this.l1Cache) {
      const l1Value = this.l1Cache.get(cacheKey);
      if (l1Value !== undefined) {
        this.stats.l1.hits++;
        logger.debug(`L1 cache hit: ${cacheKey}`);
        return this.deserialize(l1Value);
      }
      this.stats.l1.misses++;
    }

    // L2 缓存查询
    if (!skipL2 && this.l2Cache) {
      try {
        const l2Value = await this.l2Cache.get(cacheKey);
        if (l2Value) {
          this.stats.l2.hits++;
          logger.debug(`L2 cache hit: ${cacheKey}`);

          // 回填 L1 缓存
          if (!skipL1 && this.l1Cache) {
            this.l1Cache.set(cacheKey, l2Value);
          }

          return this.deserialize(l2Value);
        }
        this.stats.l2.misses++;
      } catch (error) {
        logger.warn('L2 cache get failed:', error.message);
      }
    }

    return null;
  }

  /**
   * 设置缓存
   */
  async set(namespace, key, value, options = {}) {
    const cacheKey = this.generateKey(namespace, key);
    const {
      ttl = CACHE_CONFIG.l2.ttl,
      skipL1 = false,
      skipL2 = false,
      tags = [],
    } = options;

    const serializedValue = this.serialize(value);

    // L1 缓存设置
    if (!skipL1 && this.l1Cache) {
      const l1Ttl = Math.min(ttl, CACHE_CONFIG.l1.ttl);
      this.l1Cache.set(cacheKey, serializedValue, l1Ttl);
    }

    // L2 缓存设置
    if (!skipL2 && this.l2Cache) {
      try {
        await this.l2Cache.setex(cacheKey, ttl, serializedValue);

        // 设置标签索引
        if (tags.length > 0) {
          for (const tag of tags) {
            await this.l2Cache.sadd(`${CACHE_CONFIG.l2.prefix}tag:${tag}`, cacheKey);
          }
        }
      } catch (error) {
        logger.warn('L2 cache set failed:', error.message);
      }
    }

    return value;
  }

  /**
   * 删除缓存
   */
  async delete(namespace, key) {
    const cacheKey = this.generateKey(namespace, key);

    // 删除 L1 缓存
    if (this.l1Cache) {
      this.l1Cache.del(cacheKey);
    }

    // 删除 L2 缓存
    if (this.l2Cache) {
      try {
        await this.l2Cache.del(cacheKey);
      } catch (error) {
        logger.warn('L2 cache delete failed:', error.message);
      }
    }
  }

  /**
   * 按标签删除缓存
   */
  async deleteByTag(tag) {
    if (!this.l2Cache) return;

    try {
      const tagKey = `${CACHE_CONFIG.l2.prefix}tag:${tag}`;
      const keys = await this.l2Cache.smembers(tagKey);

      if (keys.length > 0) {
        // 删除 L1 缓存
        if (this.l1Cache) {
          this.l1Cache.del(keys);
        }

        // 删除 L2 缓存
        await this.l2Cache.del(...keys);
        await this.l2Cache.del(tagKey);

        logger.info(`Cache cleared by tag: ${tag}, ${keys.length} keys removed`);
      }
    } catch (error) {
      logger.error('Delete by tag failed:', error.message);
    }
  }

  /**
   * 清空缓存
   */
  async clear() {
    // 清空 L1 缓存
    if (this.l1Cache) {
      this.l1Cache.flushAll();
    }

    // 清空 L2 缓存
    if (this.l2Cache) {
      try {
        await this.l2Cache.flushdb();
      } catch (error) {
        logger.error('L2 cache clear failed:', error.message);
      }
    }

    logger.info('All cache cleared');
  }

  /**
   * 获取或设置缓存（缓存模式）
   */
  async remember(namespace, key, factory, options = {}) {
    const cached = await this.get(namespace, key, options);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    if (value !== null && value !== undefined) {
      await this.set(namespace, key, value, options);
    }
    return value;
  }

  /**
   * 序列化
   */
  serialize(value) {
    return JSON.stringify({
      v: value,
      t: Date.now(),
    });
  }

  /**
   * 反序列化
   */
  deserialize(value) {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed.v;
    } catch {
      return value;
    }
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    const l1Stats = this.l1Cache ? this.l1Cache.getStats() : {};

    return {
      l1: {
        hits: this.stats.l1.hits,
        misses: this.stats.l1.misses,
        keys: this.l1Cache ? this.l1Cache.keys().length : 0,
        ...l1Stats,
      },
      l2: {
        hits: this.stats.l2.hits,
        misses: this.stats.l2.misses,
      },
      hitRate: this.calculateHitRate(),
    };
  }

  /**
   * 计算命中率
   */
  calculateHitRate() {
    const totalHits = this.stats.l1.hits + this.stats.l2.hits;
    const totalMisses = this.stats.l1.misses + this.stats.l2.misses;
    const total = totalHits + totalMisses;
    return total > 0 ? `${(totalHits / total * 100).toFixed(2)  }%` : 'N/A';
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    const status = {
      l1: this.l1Cache ? 'healthy' : 'disabled',
      l2: 'unknown',
    };

    if (this.l2Cache) {
      try {
        await this.l2Cache.ping();
        status.l2 = 'healthy';
      } catch {
        status.l2 = 'unhealthy';
      }
    } else {
      status.l2 = 'disabled';
    }

    return status;
  }

  /**
   * 关闭缓存服务
   */
  async close() {
    if (this.l1Cache) {
      this.l1Cache.close();
    }
    if (this.l2Cache) {
      await this.l2Cache.quit();
    }
    this.initialized = false;
    logger.info('Cache service closed');
  }
}

// 单例实例
const cacheService = new CacheService();

module.exports = { cacheService, CacheService };
