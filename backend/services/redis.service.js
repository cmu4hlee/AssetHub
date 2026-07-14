const { createClient } = require('redis');
const { database: databaseConfig, redis: redisConfig } = require('../config/app.config');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isMemoryCache = false;
    this.memoryCache = {};
    this.memoryCacheAccessOrder = []; // LRU跟踪：最近访问的key在最后
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.MAX_MEMORY_CACHE_SIZE = 1000; // 内存缓存最大条目数
    this.cleanupInterval = null;
  }

  // LRU缓存淘汰：当缓存满时移除最久未访问的条目
  _evictIfNeeded() {
    const currentSize = Object.keys(this.memoryCache).length;
    while (this.memoryCacheAccessOrder.length > 0 && currentSize >= this.MAX_MEMORY_CACHE_SIZE) {
      const oldestKey = this.memoryCacheAccessOrder.shift();
      if (this.memoryCache[oldestKey]) {
        delete this.memoryCache[oldestKey];
      }
    }
  }

  // 更新访问顺序（LRU）
  _updateAccessOrder(cacheKey) {
    const index = this.memoryCacheAccessOrder.indexOf(cacheKey);
    if (index > -1) {
      this.memoryCacheAccessOrder.splice(index, 1);
    }
    this.memoryCacheAccessOrder.push(cacheKey);
  }

  // 清理过期缓存条目
  _cleanupExpiredCache() {
    const now = Date.now();
    const keysToDelete = [];
    for (const [key, item] of Object.entries(this.memoryCache)) {
      if (item.expire && now > item.expire) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => {
      delete this.memoryCache[key];
      const index = this.memoryCacheAccessOrder.indexOf(key);
      if (index > -1) {
        this.memoryCacheAccessOrder.splice(index, 1);
      }
    });
    if (keysToDelete.length > 0) {
      console.log(`🧹 内存缓存清理: 移除 ${keysToDelete.length} 个过期条目`);
    }
  }

  // 启动定期清理任务
  _startCleanupTask() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    // 每5分钟清理一次过期缓存
    this.cleanupInterval = setInterval(() => {
      if (this.isMemoryCache) {
        this._cleanupExpiredCache();
      }
    }, 5 * 60 * 1000);
  }

  get status() {
    if (this.isConnected) {
      return 'ready';
    }
    if (this.isMemoryCache) {
      return 'memory';
    }
    if (!redisConfig.enabled) {
      return 'disabled';
    }
    if (this.client) {
      return 'connecting';
    }

    return 'closed';
  }

  // 初始化Redis连接
  async init() {
    if (!redisConfig.enabled) {
      console.warn('⚠️  Redis缓存未启用');
      this.client = null;
      this.isConnected = false;
      this.isMemoryCache = true;
      this.memoryCache = {};
      this.memoryCacheAccessOrder = [];
      this._startCleanupTask();
      return;
    }

    try {
      console.log('🔗 正在连接Redis...');
      console.log('Redis配置:', {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db,
        password: redisConfig.password ? '***' : '无',
      });

      // 创建Redis客户端
      this.client = createClient({
        url: `redis://${redisConfig.host}:${redisConfig.port}`,
        password: redisConfig.password,
        database: redisConfig.db,
        socket: {
          connectTimeout: redisConfig.connectTimeout,
        },
        retryStrategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.error('❌ Redis连接被拒绝，请检查Redis服务是否运行');
          }
          if (options.totalRetryTime > 1000 * 60 * 60) {
            console.error('❌ Redis重试时间超过1小时，停止重试');
            return new Error('Redis连接超时');
          }
          if (options.attempt > this.maxReconnectAttempts) {
            console.warn('⚠️ Redis连接失败，已达到最大重试次数');
            return new Error('Redis连接失败');
          }
          return Math.min(options.attempt * 100, 3000);
        },
      });

      // 监听连接事件
      this.client.on('error', (err) => {
        console.error('❌ Redis连接错误:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis连接成功');
        this.isConnected = true;
        this.isMemoryCache = false;
        this.reconnectAttempts = 0;
      });

      this.client.on('end', () => {
        console.log('🔚 Redis连接已关闭');
        this.isConnected = false;
      });

      // 尝试连接
      try {
        await this.client.connect();
        this.isConnected = true;
        this.isMemoryCache = false;
        console.log('✅ Redis服务初始化完成');
      } catch (error) {
        console.error('❌ Redis连接失败:', error.message);
        this.isConnected = false;
        // 初始化内存缓存
        this.memoryCache = {};
        this.memoryCacheAccessOrder = [];
        this.isMemoryCache = true;
        this._startCleanupTask();
        console.warn('⚠️ 未连接到Redis，将使用内存缓存作为降级方案');
      }
    } catch (error) {
      console.error('❌ Redis初始化失败:', error.message);
      console.warn('⚠️ 将使用内存缓存作为降级方案');
      // 初始化内存缓存
      this.memoryCache = {};
      this.memoryCacheAccessOrder = [];
      this.isMemoryCache = true;
      this._startCleanupTask();
      // 不抛出错误，允许系统在Redis不可用时继续运行
    }
  }

  // 生成缓存键
  generateKey(key) {
    return `${redisConfig.keyPrefix || ''}${key}`;
  }

  // 设置缓存
  async setCache(key, value, expire = redisConfig.defaultExpire) {
    if (this.isMemoryCache) {
      // 使用内存缓存
      try {
        const cacheKey = this.generateKey(key);
        // LRU淘汰检查
        if (!this.memoryCache[cacheKey]) {
          this._evictIfNeeded();
        }
        this.memoryCache[cacheKey] = {
          value: typeof value === 'string' ? value : JSON.stringify(value),
          expire: expire ? Date.now() + (expire * 1000) : null,
        };
        this._updateAccessOrder(cacheKey);
        return true;
      } catch (error) {
        console.error('⚠️ 设置内存缓存失败:', error.message);
        return false;
      }
    }

    if (!redisConfig.enabled || !this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(key);
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

      if (expire) {
        await this.client.set(cacheKey, stringValue, 'EX', expire);
      } else {
        await this.client.set(cacheKey, stringValue);
      }

      return true;
    } catch (error) {
      console.error('⚠️ 设置缓存失败:', error.message);
      return false;
    }
  }

  // 获取缓存
  async getCache(key) {
    if (this.isMemoryCache) {
      // 使用内存缓存
      try {
        const cacheKey = this.generateKey(key);
        const cachedItem = this.memoryCache[cacheKey];

        if (cachedItem) {
          // 检查是否过期
          if (cachedItem.expire && Date.now() > cachedItem.expire) {
            delete this.memoryCache[cacheKey];
            const index = this.memoryCacheAccessOrder.indexOf(cacheKey);
            if (index > -1) this.memoryCacheAccessOrder.splice(index, 1);
            return null;
          }

          // 更新LRU访问顺序
          this._updateAccessOrder(cacheKey);

          try {
            return JSON.parse(cachedItem.value);
          } catch {
            return cachedItem.value;
          }
        }

        return null;
      } catch (error) {
        console.error('⚠️ 获取内存缓存失败:', error.message);
        return null;
      }
    }

    if (!redisConfig.enabled || !this.isConnected) {
      return null;
    }

    try {
      const cacheKey = this.generateKey(key);
      const value = await this.client.get(cacheKey);

      if (value) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }

      return null;
    } catch (error) {
      console.error('⚠️ 获取缓存失败:', error.message);
      return null;
    }
  }

  // 删除缓存
  async deleteCache(key) {
    if (this.isMemoryCache) {
      // 使用内存缓存
      try {
        const cacheKey = this.generateKey(key);
        delete this.memoryCache[cacheKey];
        const index = this.memoryCacheAccessOrder.indexOf(cacheKey);
        if (index > -1) this.memoryCacheAccessOrder.splice(index, 1);
        return true;
      } catch (error) {
        console.error('⚠️ 删除内存缓存失败:', error.message);
        return false;
      }
    }

    if (!redisConfig.enabled || !this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(key);
      await this.client.del(cacheKey);
      return true;
    } catch (error) {
      console.error('⚠️ 删除缓存失败:', error.message);
      return false;
    }
  }

  // 检查缓存是否存在
  async hasCache(key) {
    if (this.isMemoryCache) {
      // 使用内存缓存
      try {
        const cacheKey = this.generateKey(key);
        const cachedItem = this.memoryCache[cacheKey];

        if (cachedItem) {
          // 检查是否过期
          if (cachedItem.expire && Date.now() > cachedItem.expire) {
            delete this.memoryCache[cacheKey];
            const index = this.memoryCacheAccessOrder.indexOf(cacheKey);
            if (index > -1) this.memoryCacheAccessOrder.splice(index, 1);
            return false;
          }
          // 更新LRU访问顺序
          this._updateAccessOrder(cacheKey);
          return true;
        }

        return false;
      } catch (error) {
        console.error('⚠️ 检查内存缓存失败:', error.message);
        return false;
      }
    }

    if (!redisConfig.enabled || !this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(key);
      const result = await this.client.exists(cacheKey);
      return result > 0;
    } catch (error) {
      console.error('⚠️ 检查缓存失败:', error.message);
      return false;
    }
  }

  // 设置哈希缓存
  async setHashCache(key, field, value, expire = redisConfig.defaultExpire) {
    if (this.isMemoryCache) {
      // 使用内存缓存
      try {
        const cacheKey = this.generateKey(key);
        if (!this.memoryCache[cacheKey]) {
          // LRU淘汰检查
          this._evictIfNeeded();
          this.memoryCache[cacheKey] = {
            value: {},
            expire: expire ? Date.now() + (expire * 1000) : null,
          };
        }
        this.memoryCache[cacheKey].value[field] = typeof value === 'string' ? value : JSON.stringify(value);
        this._updateAccessOrder(cacheKey);
        return true;
      } catch (error) {
        console.error('⚠️ 设置内存哈希缓存失败:', error.message);
        return false;
      }
    }

    if (!redisConfig.enabled || !this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(key);
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

      await this.client.hSet(cacheKey, field, stringValue);

      if (expire) {
        await this.client.expire(cacheKey, expire);
      }

      return true;
    } catch (error) {
      console.error('⚠️ 设置哈希缓存失败:', error.message);
      return false;
    }
  }

  // 获取哈希缓存
  async getHashCache(key, field) {
    if (this.isMemoryCache) {
      // 使用内存缓存
      try {
        const cacheKey = this.generateKey(key);
        const cachedItem = this.memoryCache[cacheKey];

        if (cachedItem) {
          // 检查是否过期
          if (cachedItem.expire && Date.now() > cachedItem.expire) {
            delete this.memoryCache[cacheKey];
            return null;
          }

          const value = cachedItem.value[field];
          if (value) {
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          }
        }

        return null;
      } catch (error) {
        console.error('⚠️ 获取内存哈希缓存失败:', error.message);
        return null;
      }
    }

    if (!redisConfig.enabled || !this.isConnected) {
      return null;
    }

    try {
      const cacheKey = this.generateKey(key);
      const value = await this.client.hGet(cacheKey, field);

      if (value) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }

      return null;
    } catch (error) {
      console.error('⚠️ 获取哈希缓存失败:', error.message);
      return null;
    }
  }

  // 获取所有哈希字段
  async getAllHashCache(key) {
    if (this.isMemoryCache) {
      // 使用内存缓存
      try {
        const cacheKey = this.generateKey(key);
        const cachedItem = this.memoryCache[cacheKey];

        if (cachedItem) {
          // 检查是否过期
          if (cachedItem.expire && Date.now() > cachedItem.expire) {
            delete this.memoryCache[cacheKey];
            return null;
          }

          const values = { ...cachedItem.value };
          Object.keys(values).forEach(field => {
            try {
              values[field] = JSON.parse(values[field]);
            } catch {
              // 保持原值
            }
          });
          return values;
        }

        return null;
      } catch (error) {
        console.error('⚠️ 获取内存哈希缓存失败:', error.message);
        return null;
      }
    }

    if (!redisConfig.enabled || !this.isConnected) {
      return null;
    }

    try {
      const cacheKey = this.generateKey(key);
      const values = await this.client.hGetAll(cacheKey);

      if (values) {
        Object.keys(values).forEach(field => {
          try {
            values[field] = JSON.parse(values[field]);
          } catch {
            // 保持原值
          }
        });
      }

      return values;
    } catch (error) {
      console.error('⚠️ 获取所有哈希缓存失败:', error.message);
      return null;
    }
  }

  // 删除哈希字段
  async deleteHashCache(key, field) {
    if (this.isMemoryCache) {
      // 使用内存缓存
      try {
        const cacheKey = this.generateKey(key);
        const cachedItem = this.memoryCache[cacheKey];
        if (cachedItem) {
          delete cachedItem.value[field];
        }
        return true;
      } catch (error) {
        console.error('⚠️ 删除内存哈希缓存失败:', error.message);
        return false;
      }
    }

    if (!redisConfig.enabled || !this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(key);
      await this.client.hDel(cacheKey, field);
      return true;
    } catch (error) {
      console.error('⚠️ 删除哈希缓存失败:', error.message);
      return false;
    }
  }

  // 清除匹配模式的缓存
  async clearCacheByPattern(pattern) {
    if (this.isMemoryCache) {
      // 使用内存缓存
      try {
        const cachePattern = this.generateKey(pattern);
        const patternRegex = new RegExp(cachePattern.replace(/\*/g, '.*'));

        Object.keys(this.memoryCache).forEach(key => {
          if (patternRegex.test(key)) {
            delete this.memoryCache[key];
          }
        });

        return true;
      } catch (error) {
        console.error('⚠️ 清除内存缓存失败:', error.message);
        return false;
      }
    }

    if (!redisConfig.enabled || !this.isConnected) {
      return false;
    }

    try {
      const cachePattern = this.generateKey(pattern);
      const keys = await this.client.keys(cachePattern);

      if (keys.length > 0) {
        await this.client.del(keys);
      }

      return true;
    } catch (error) {
      console.error('⚠️ 清除缓存失败:', error.message);
      return false;
    }
  }

  // 关闭Redis连接
  async close() {
    if (this.client) {
      try {
        await this.client.quit();
        console.log('✅ Redis连接已关闭');
      } catch (error) {
        console.error('❌ 关闭Redis连接失败:', error.message);
      }
    }
  }

  // 获取Redis连接状态
  getStatus() {
    return {
      enabled: redisConfig.enabled || this.isMemoryCache,
      connected: this.isConnected,
      mode: this.isConnected ? 'redis' : this.isMemoryCache ? 'memory' : 'disabled',
      config: {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db,
        keyPrefix: redisConfig.keyPrefix || '',
      },
    };
  }
}

// 导出单例
const redisService = new RedisService();
module.exports = redisService;
