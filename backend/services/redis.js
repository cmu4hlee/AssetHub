const Redis = require('ioredis');
const {
  env: { isProduction },
  log: logConfig,
} = require('../config/app.config');

// Redis配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || '',
  db: parseInt(process.env.REDIS_DB) || 0,
  // 连接超时设置
  connectTimeout: 3000,
  // 重试策略
  retryStrategy(times) {
    // 快速重试，减少等待时间
    const delay = Math.min(times * 100, 1000);
    return delay;
  },
  // 最大重试次数 - 减少到1次，避免长时间等待
  maxRetriesPerRequest: 1,
  // 启用自动重连
  enableAutoPipelining: true,
  // 不自动连接，手动处理连接
  lazyConnect: true,
  // 禁用离线队列，避免内存泄漏
  enableOfflineQueue: false,
};

// 创建Redis客户端
let redis;
try {
  redis = new Redis(redisConfig);
  console.log('✅ Redis客户端已创建');
} catch (error) {
  console.error('❌ 创建Redis客户端失败:', error.message);
  redis = null;
}

// 如果Redis客户端创建成功，添加事件监听
if (redis) {
  // 添加标志位，避免重复输出相同的错误日志
  let redisErrorLogged = false;
  let redisConnectionRefusedLogged = false;

  // Redis连接事件监听
  redis.on('connect', () => {
    console.log('✅ Redis连接成功');
    // 连接成功后重置标志位
    redisErrorLogged = false;
    redisConnectionRefusedLogged = false;
  });

  redis.on('error', err => {
    // 只在第一次出现错误时输出日志
    if (!redisErrorLogged) {
      console.warn('⚠️ Redis连接错误:', err.message);
      redisErrorLogged = true;
    }

    // 只在第一次出现连接拒绝错误时输出降级提示
    if (err.code === 'ECONNREFUSED' && !redisConnectionRefusedLogged) {
      console.warn('ℹ️ Redis服务未运行，系统将降级为数据库模式');
      redisConnectionRefusedLogged = true;
    }
  });

  redis.on('end', () => {
    console.log('🔄 Redis连接已关闭');
    // 连接关闭后重置标志位，允许下次错误输出
    redisErrorLogged = false;
    redisConnectionRefusedLogged = false;
  });

  // 手动尝试连接
  redis.connect().catch(err => {
    console.warn('ℹ️ Redis初始连接失败，将使用数据库模式:', err.message);
  });
} else {
  console.warn('ℹ️ Redis客户端未创建，系统将使用数据库模式');
}

// 辅助函数：添加租户ID前缀
const addTenantPrefix = (key, tenantId = 0) => {
  // 如果key已经包含租户前缀，直接返回
  if (key.startsWith('tenant:')) {
    return key;
  }
  // 超级管理员（tenantId为null或undefined）使用特殊前缀
  if (tenantId === null || tenantId === undefined) {
    return `tenant:super:${key}`;
  }
  return `tenant:${tenantId}:${key}`;
};

// 辅助函数：按租户获取所有缓存键
const getKeysByTenant = async (tenantId = 0) => {
  if (!redis) {
    return [];
  }
  try {
    const prefix = addTenantPrefix('*', tenantId);
    return await redis.keys(prefix);
  } catch (error) {
    console.error('❌ 获取租户缓存键失败:', error.message);
    return [];
  }
};

// 辅助函数：获取缓存依赖键
const getDependencyKey = (key, tenantId = 0) => {
  return addTenantPrefix(`dependency:${key}`, tenantId);
};

// 辅助函数：添加缓存依赖关系
const addDependency = async (key, dependentKey, tenantId = 0) => {
  if (!redis) {
    return false;
  }
  try {
    const depKey = getDependencyKey(key, tenantId);
    await redis.sadd(depKey, dependentKey);
    return true;
  } catch (error) {
    console.error('❌ 添加缓存依赖失败:', error.message);
    return false;
  }
};

// 辅助函数：获取缓存依赖关系
const getDependencies = async (key, tenantId = 0) => {
  if (!redis) {
    return [];
  }
  try {
    const depKey = getDependencyKey(key, tenantId);
    return await redis.smembers(depKey);
  } catch (error) {
    console.error('❌ 获取缓存依赖失败:', error.message);
    return [];
  }
};

// 辅助函数：删除缓存依赖关系
const removeDependency = async (key, dependentKey, tenantId = 0) => {
  if (!redis) {
    return false;
  }
  try {
    const depKey = getDependencyKey(key, tenantId);
    await redis.srem(depKey, dependentKey);
    return true;
  } catch (error) {
    console.error('❌ 删除缓存依赖失败:', error.message);
    return false;
  }
};

// 辅助函数：级联删除缓存及其依赖
const cascadeDelete = async (key, tenantId = 0) => {
  if (!redis) {
    return false;
  }
  try {
    // 获取所有依赖该缓存的键
    const dependencies = await getDependencies(key, tenantId);

    // 删除所有依赖的缓存
    for (const depKey of dependencies) {
      await redis.del(depKey);
      // 递归删除依赖的依赖
      await cascadeDelete(depKey, tenantId);
    }

    // 删除当前缓存
    await redis.del(addTenantPrefix(key, tenantId));

    // 删除依赖关系
    await redis.del(getDependencyKey(key, tenantId));

    return true;
  } catch (error) {
    console.error('❌ 级联删除缓存失败:', error.message);
    return false;
  }
};

// 基本缓存操作
class CacheService {
  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} expire - 过期时间（秒）
   * @param {number|null} tenantId - 租户ID，用于缓存隔离
   * @param {Object} options - 可选配置
   * @param {Array<string>} options.dependencies - 依赖的其他缓存键，当这些键失效时，当前缓存自动失效
   * @param {Array<string>} options.tags - 缓存标签，用于批量失效
   * @returns {Promise<boolean>} - 是否设置成功
   */
  async set(key, value, expire = 3600, tenantId = 0, options = {}) {
    if (!redis) {
      console.warn('⚠️ Redis不可用，跳过设置缓存');
      return false;
    }
    try {
      const tenantKey = addTenantPrefix(key, tenantId);
      const serializedValue = JSON.stringify(value);
      await redis.set(tenantKey, serializedValue, 'EX', expire);

      // 处理缓存依赖关系
      if (options.dependencies && options.dependencies.length > 0) {
        for (const depKey of options.dependencies) {
          await addDependency(depKey, tenantKey, tenantId);
        }
      }

      // 处理缓存标签
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          const tagKey = addTenantPrefix(`tag:${tag}`, tenantId);
          await redis.sadd(tagKey, tenantKey);
        }
      }

      return true;
    } catch (error) {
      console.error('❌ 设置缓存失败:', error.message);
      return false;
    }
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @param {number|null} tenantId - 租户ID，用于缓存隔离
   * @returns {Promise<any>} - 缓存值
   */
  async get(key, tenantId = 0) {
    if (!redis) {
      console.warn('⚠️ Redis不可用，跳过获取缓存');
      return null;
    }
    try {
      const tenantKey = addTenantPrefix(key, tenantId);
      const value = await redis.get(tenantKey);
      if (value === null) {
        // 在生产环境中，使用warn级别确保日志显示
        if (isProduction) {
          console.warn(`🗄️  缓存未命中: ${tenantKey} - 从数据库获取`);
        } else {
          console.log(`🗄️  缓存未命中: ${tenantKey} - 从数据库获取`);
        }
        return null;
      }
      // 在生产环境中，使用warn级别确保日志显示
      if (isProduction) {
        console.warn(`✅ 数据来源: Redis - 键: ${tenantKey}`);
      } else {
        console.log(`✅ 数据来源: Redis - 键: ${tenantKey}`);
      }
      return JSON.parse(value);
    } catch (error) {
      console.error('❌ 获取缓存失败:', error.message);
      return null;
    }
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   * @param {number|null} tenantId - 租户ID，用于缓存隔离
   * @param {boolean} cascade - 是否级联删除依赖该缓存的其他缓存
   * @returns {Promise<boolean>} - 是否删除成功
   */
  async delete(key, tenantId = 0, cascade = true) {
    if (!redis) {
      console.warn('⚠️ Redis不可用，跳过删除缓存');
      return false;
    }
    try {
      if (cascade) {
        // 级联删除依赖该缓存的所有缓存
        await cascadeDelete(key, tenantId);
      } else {
        // 只删除当前缓存
        const tenantKey = addTenantPrefix(key, tenantId);
        await redis.del(tenantKey);
      }
      return true;
    } catch (error) {
      console.error('❌ 删除缓存失败:', error.message);
      return false;
    }
  }

  /**
   * 按标签批量删除缓存
   * @param {string|Array<string>} tags - 标签或标签数组
   * @param {number|null} tenantId - 租户ID，用于缓存隔离
   * @returns {Promise<boolean>} - 是否删除成功
   */
  async deleteByTags(tags, tenantId = 0) {
    if (!redis) {
      return false;
    }
    try {
      tags = Array.isArray(tags) ? tags : [tags];
      const keysToDelete = new Set();

      // 获取所有标签对应的缓存键
      for (const tag of tags) {
        const tagKey = addTenantPrefix(`tag:${tag}`, tenantId);
        const tagKeys = await redis.smembers(tagKey);
        tagKeys.forEach(key => keysToDelete.add(key));
      }

      // 删除所有缓存
      if (keysToDelete.size > 0) {
        await redis.del(...keysToDelete);
        console.log(`✅ 已按标签删除 ${keysToDelete.size} 个缓存项`);
      }

      return true;
    } catch (error) {
      console.error('❌ 按标签删除缓存失败:', error.message);
      return false;
    }
  }

  /**
   * 清除所有缓存
   * @param {number|null} tenantId - 租户ID，用于缓存隔离。如果为null，清除所有缓存
   * @returns {Promise<boolean>} - 是否清除成功
   */
  async flushAll(tenantId = null) {
    if (!redis) {
      console.warn('⚠️ Redis不可用，跳过清除缓存');
      return false;
    }
    try {
      if (tenantId === null) {
        // 清除所有缓存
        await redis.flushdb();
        console.log('✅ 已清除所有缓存');
      } else {
        // 只清除指定租户的缓存
        const keys = await getKeysByTenant(tenantId);
        if (keys.length > 0) {
          await redis.del(...keys);
          console.log(`✅ 已清除租户 ${tenantId} 的 ${keys.length} 个缓存项`);
        }
      }
      return true;
    } catch (error) {
      console.error('❌ 清除缓存失败:', error.message);
      return false;
    }
  }

  /**
   * 设置哈希缓存
   * @param {string} key - 哈希表键
   * @param {string} field - 哈希字段
   * @param {any} value - 哈希值
   * @param {number|null} tenantId - 租户ID，用于缓存隔离
   * @returns {Promise<boolean>} - 是否设置成功
   */
  async hset(key, field, value, tenantId = 0) {
    if (!redis) {
      console.warn('⚠️ Redis不可用，跳过设置哈希缓存');
      return false;
    }
    try {
      const tenantKey = addTenantPrefix(key, tenantId);
      const serializedValue = JSON.stringify(value);
      await redis.hset(tenantKey, field, serializedValue);
      return true;
    } catch (error) {
      console.error('❌ 设置哈希缓存失败:', error.message);
      return false;
    }
  }

  /**
   * 获取哈希缓存
   * @param {string} key - 哈希表键
   * @param {string} field - 哈希字段
   * @param {number|null} tenantId - 租户ID，用于缓存隔离
   * @returns {Promise<any>} - 哈希值
   */
  async hget(key, field, tenantId = 0) {
    if (!redis) {
      console.warn('⚠️ Redis不可用，跳过获取哈希缓存');
      return null;
    }
    try {
      const tenantKey = addTenantPrefix(key, tenantId);
      const value = await redis.hget(tenantKey, field);
      if (value === null) {
        return null;
      }
      return JSON.parse(value);
    } catch (error) {
      console.error('❌ 获取哈希缓存失败:', error.message);
      return null;
    }
  }

  /**
   * 删除哈希缓存字段
   * @param {string} key - 哈希表键
   * @param {string} field - 哈希字段
   * @param {number|null} tenantId - 租户ID，用于缓存隔离
   * @returns {Promise<boolean>} - 是否删除成功
   */
  async hdel(key, field, tenantId = 0) {
    if (!redis) {
      console.warn('⚠️ Redis不可用，跳过删除哈希缓存');
      return false;
    }
    try {
      const tenantKey = addTenantPrefix(key, tenantId);
      await redis.hdel(tenantKey, field);
      return true;
    } catch (error) {
      console.error('❌ 删除哈希缓存失败:', error.message);
      return false;
    }
  }

  /**
   * 获取租户的所有缓存键
   * @param {number|null} tenantId - 租户ID
   * @returns {Promise<Array>} - 缓存键列表
   */
  async getTenantKeys(tenantId = 0) {
    return getKeysByTenant(tenantId);
  }

  /**
   * 添加缓存依赖关系
   * @param {string} key - 主缓存键
   * @param {string} dependentKey - 依赖的缓存键
   * @param {number|null} tenantId - 租户ID，用于缓存隔离
   * @returns {Promise<boolean>} - 是否添加成功
   */
  async addDependency(key, dependentKey, tenantId = 0) {
    return addDependency(key, dependentKey, tenantId);
  }

  /**
   * 获取缓存依赖关系
   * @param {string} key - 主缓存键
   * @param {number|null} tenantId - 租户ID，用于缓存隔离
   * @returns {Promise<Array>} - 依赖的缓存键列表
   */
  async getDependencies(key, tenantId = 0) {
    return getDependencies(key, tenantId);
  }

  /**
   * 移除缓存依赖关系
   * @param {string} key - 主缓存键
   * @param {string} dependentKey - 依赖的缓存键
   * @param {number|null} tenantId - 租户ID，用于缓存隔离
   * @returns {Promise<boolean>} - 是否移除成功
   */
  async removeDependency(key, dependentKey, tenantId = 0) {
    return removeDependency(key, dependentKey, tenantId);
  }

  /**
   * 缓存预热：预先加载常用缓存
   * @param {Array<Object>} cacheItems - 缓存项数组，每个项包含key、value、expire等属性
   * @param {number|null} tenantId - 租户ID，用于缓存隔离
   * @returns {Promise<{success: number, failed: number}>} - 预热结果统计
   */
  async warmup(cacheItems, tenantId = 0) {
    if (!redis || !cacheItems || cacheItems.length === 0) {
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    for (const item of cacheItems) {
      try {
        await this.set(item.key, item.value, item.expire || 3600, tenantId, {
          dependencies: item.dependencies,
          tags: item.tags,
        });
        success++;
      } catch (error) {
        console.error(`❌ 缓存预热失败 - ${item.key}:`, error.message);
        failed++;
      }
    }

    console.log(`📊 缓存预热完成：成功 ${success} 项，失败 ${failed} 项`);
    return { success, failed };
  }

  /**
   * 刷新缓存：强制重新加载指定缓存项
   * @param {string|Array<string>} keys - 要刷新的缓存键
   * @param {number|null} tenantId - 租户ID，用于缓存隔离
   * @param {Function} loader - 数据加载函数，用于重新生成缓存值
   * @returns {Promise<{success: number, failed: number}>} - 刷新结果统计
   */
  async refresh(keys, tenantId = 0, loader) {
    if (!redis || !keys || !loader) {
      return { success: 0, failed: 0 };
    }

    keys = Array.isArray(keys) ? keys : [keys];
    let success = 0;
    let failed = 0;

    for (const key of keys) {
      try {
        // 调用数据加载函数获取最新数据
        const value = await loader(key);
        if (value !== undefined && value !== null) {
          // 重新设置缓存
          await this.set(key, value, 3600, tenantId);
          success++;
        }
      } catch (error) {
        console.error(`❌ 缓存刷新失败 - ${key}:`, error.message);
        failed++;
      }
    }

    console.log(`📊 缓存刷新完成：成功 ${success} 项，失败 ${failed} 项`);
    return { success, failed };
  }

  /**
   * 缓存装饰器
   * @param {string} keyPrefix - 缓存键前缀
   * @param {number} expire - 过期时间（秒）
   * @param {Object} options - 可选配置
   * @param {Function} options.getKey - 自定义缓存键生成函数
   * @param {Function} options.getTenantId - 从this或args中获取tenantId的函数
   * @param {Array<string>} options.invalidateKeys - 当数据更新时需要失效的其他缓存键
   * @returns {Function} - 装饰器函数
   */
  cache(keyPrefix, expire = 3600, options = {}) {
    return function (target, propertyKey, descriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args) {
        // 获取tenantId
        let tenantId = 0;
        try {
          if (options.getTenantId) {
            // 使用自定义函数获取tenantId
            tenantId = options.getTenantId.call(this, ...args);
          } else if (this.user && this.user.tenant_id) {
            // 从当前上下文的user对象获取tenantId
            tenantId = this.user.tenant_id;
          } else if (args[0] && args[0].user && args[0].user.tenant_id) {
            // 从第一个参数（通常是req对象）获取tenantId
            tenantId = args[0].user.tenant_id;
          }
        } catch (error) {
          console.warn('⚠️ 获取tenantId失败，使用默认值0:', error.message);
        }

        // 生成缓存键
        let cacheKey;
        if (options.getKey) {
          // 使用自定义函数生成缓存键
          cacheKey = options.getKey.call(this, ...args);
        } else {
          // 默认生成方式：前缀 + 参数哈希
          const argsHash = require('crypto')
            .createHash('md5')
            .update(JSON.stringify(args))
            .digest('hex');
          cacheKey = `${keyPrefix}:${argsHash}`;
        }

        // 尝试从缓存获取
        const cachedValue = await this.cacheService.get(cacheKey, tenantId);
        if (cachedValue !== null) {
          return cachedValue;
        }

        // 调用原始方法
        // 在生产环境中，使用warn级别确保日志显示
        if (isProduction) {
          console.warn(`📊 数据来源: 数据库 - 操作: ${keyPrefix}`);
        } else {
          console.log(`📊 数据来源: 数据库 - 操作: ${keyPrefix}`);
        }
        const result = await originalMethod.apply(this, args);

        // 缓存结果
        await this.cacheService.set(cacheKey, result, expire, tenantId);
        // 在生产环境中，使用warn级别确保日志显示
        if (isProduction) {
          console.warn(`📝 数据已缓存: ${addTenantPrefix(cacheKey, tenantId)}`);
        } else {
          console.log(`📝 数据已缓存: ${addTenantPrefix(cacheKey, tenantId)}`);
        }

        return result;
      };

      return descriptor;
    };
  }
}

// 导出Redis客户端和缓存服务
module.exports = {
  redis,
  cacheService: new CacheService(),
  CacheService,
};
