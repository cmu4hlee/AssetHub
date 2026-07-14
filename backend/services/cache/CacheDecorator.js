/**
 * 缓存装饰器
 * 用于简化业务代码中的缓存操作
 */

const { cacheService } = require('./CacheService');
const { logger } = require('../../config/logger');

/**
 * 缓存装饰器
 * @param {Object} options - 配置选项
 * @param {string} options.namespace - 命名空间
 * @param {number} options.ttl - 缓存时间（秒）
 * @param {Function} options.keyGenerator - 缓存键生成函数
 * @param {Function} options.condition - 是否缓存的条件函数
 * @param {string[]} options.tags - 缓存标签
 */
function Cacheable(options = {}) {
  const {
    namespace = 'default',
    ttl = 300,
    keyGenerator = (...args) => JSON.stringify(args),
    condition = () => true,
    tags = [],
  } = options;

  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      // 检查是否满足缓存条件
      if (!condition(...args)) {
        return await originalMethod.apply(this, args);
      }

      // 生成缓存键
      const cacheKey = keyGenerator(...args);

      try {
        // 尝试从缓存获取
        const cached = await cacheService.get(namespace, cacheKey);
        if (cached !== null) {
          logger.debug(`Cache hit: ${namespace}:${cacheKey}`);
          return cached;
        }

        // 执行原方法
        const result = await originalMethod.apply(this, args);

        // 缓存结果
        if (result !== null && result !== undefined) {
          await cacheService.set(namespace, cacheKey, result, { ttl, tags });
        }

        return result;
      } catch (error) {
        logger.error('Cache operation failed:', error.message);
        // 缓存失败时直接返回原方法结果
        return await originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * 缓存清除装饰器
 * @param {Object} options - 配置选项
 * @param {string} options.namespace - 命名空间
 * @param {Function} options.keyGenerator - 缓存键生成函数
 * @param {string[]} options.tags - 要清除的标签
 */
function CacheEvict(options = {}) {
  const {
    namespace = 'default',
    keyGenerator = null,
    tags = [],
  } = options;

  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      // 执行原方法
      const result = await originalMethod.apply(this, args);

      try {
        // 清除特定键的缓存
        if (keyGenerator) {
          const cacheKey = keyGenerator(...args);
          await cacheService.delete(namespace, cacheKey);
        }

        // 清除标签相关的缓存
        for (const tag of tags) {
          await cacheService.deleteByTag(tag);
        }
      } catch (error) {
        logger.error('Cache evict failed:', error.message);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * 资产相关缓存快捷装饰器
 */
const AssetCache = {
  /**
   * 资产详情缓存
   */
  detail: () => Cacheable({
    namespace: 'asset:detail',
    ttl: 600,
    keyGenerator: (assetId) => `asset:${assetId}`,
    tags: ['asset'],
  }),

  /**
   * 资产列表缓存
   */
  list: () => Cacheable({
    namespace: 'asset:list',
    ttl: 300,
    keyGenerator: (query) => `list:${JSON.stringify(query)}`,
    condition: (query) => !query.noCache,
    tags: ['asset:list'],
  }),

  /**
   * 资产统计缓存
   */
  stats: () => Cacheable({
    namespace: 'asset:stats',
    ttl: 1800,
    keyGenerator: (tenantId, type) => `stats:${tenantId}:${type}`,
    tags: ['asset:stats'],
  }),

  /**
   * 清除资产缓存
   */
  evict: () => CacheEvict({
    namespace: 'asset:detail',
    tags: ['asset', 'asset:list', 'asset:stats'],
  }),
};

/**
 * 用户相关缓存快捷装饰器
 */
const UserCache = {
  /**
   * 用户信息缓存
   */
  profile: () => Cacheable({
    namespace: 'user:profile',
    ttl: 1800,
    keyGenerator: (userId) => `user:${userId}`,
    tags: ['user'],
  }),

  /**
   * 用户权限缓存
   */
  permissions: () => Cacheable({
    namespace: 'user:permissions',
    ttl: 3600,
    keyGenerator: (userId, tenantId) => `permissions:${userId}:${tenantId}`,
    tags: ['user:permissions'],
  }),

  /**
   * 清除用户缓存
   */
  evict: () => CacheEvict({
    namespace: 'user:profile',
    tags: ['user', 'user:permissions'],
  }),
};

/**
 * 部门相关缓存快捷装饰器
 */
const DepartmentCache = {
  /**
   * 部门树缓存
   */
  tree: () => Cacheable({
    namespace: 'dept:tree',
    ttl: 3600,
    keyGenerator: (tenantId) => `tree:${tenantId}`,
    tags: ['dept'],
  }),

  /**
   * 清除部门缓存
   */
  evict: () => CacheEvict({
    tags: ['dept'],
  }),
};

module.exports = {
  Cacheable,
  CacheEvict,
  AssetCache,
  UserCache,
  DepartmentCache,
};
