/**
 * 缓存服务
 * 统一缓存管理，支持多级缓存策略
 */

const redisService = require('./redis.service');
const logger = require('../config/logger');

class CacheService {
  constructor() {
    this.strategies = {
      // 模块配置 - 长期缓存
      'module:config': { ttl: 3600, prefix: 'module' },

      // 开机率统计 - 短期缓存
      'uptime:statistics': { ttl: 300, prefix: 'uptime' },
      'uptime:overview': { ttl: 300, prefix: 'uptime' },

      // 保养模板 - 中期缓存
      'maintenance:templates': { ttl: 1800, prefix: 'maintenance' },
      'maintenance:plans': { ttl: 600, prefix: 'maintenance' },

      // 特种设备 - 短期缓存
      'equipment:special': { ttl: 600, prefix: 'equipment' },

      // 人员资质 - 中期缓存
      'staff:qualifications': { ttl: 1800, prefix: 'staff' },
      'staff:training': { ttl: 1800, prefix: 'staff' },

      // 资产信息 - 中期缓存
      'asset:detail': { ttl: 1800, prefix: 'asset' },
      'asset:list': { ttl: 600, prefix: 'asset' },

      // 仪表盘数据 - 短期缓存
      'dashboard:data': { ttl: 300, prefix: 'dashboard' },
    };
  }

  /**
   * 获取缓存
   */
  async get(key, type = 'default') {
    try {
      const strategy = this.strategies[type] || { ttl: 600, prefix: 'default' };
      const cacheKey = `${strategy.prefix}:${key}`;

      const value = await redisService.getCache(cacheKey);
      console.error('CACHE_GET: key=', cacheKey, 'value type=', typeof value, 'value=', value);
      if (value) {
        logger.debug(`Cache HIT: ${cacheKey}`);
        return typeof value === 'string' ? JSON.parse(value) : value;
      }
      logger.debug(`Cache MISS: ${cacheKey}`);
      return null;
    } catch (error) {
      console.error('CACHE_GET_ERROR:', error);
      logger.error('缓存获取失败:', error);
      return null;
    }
  }

  /**
   * 设置缓存
   */
  async set(key, value, type = 'default', customTtl = null) {
    try {
      const strategy = this.strategies[type] || { ttl: 600, prefix: 'default' };
      const cacheKey = `${strategy.prefix}:${key}`;
      const ttl = customTtl || strategy.ttl;

      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await redisService.setCache(cacheKey, serialized, ttl);
      logger.debug(`Cache SET: ${cacheKey} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      logger.error('缓存设置失败:', error);
      return false;
    }
  }

  /**
   * 删除缓存
   */
  async delete(key, type = 'default') {
    try {
      const strategy = this.strategies[type] || { prefix: 'default' };
      const cacheKey = `${strategy.prefix}:${key}`;

      await redisService.deleteCache(cacheKey);
      logger.debug(`Cache DELETE: ${cacheKey}`);
      return true;
    } catch (error) {
      logger.error('缓存删除失败:', error);
      return false;
    }
  }

  /**
   * 批量删除缓存
   */
  async deletePattern(pattern) {
    try {
      await redisService.clearCacheByPattern(pattern);
      logger.debug(`Cache DELETE PATTERN: ${pattern}`);
      return true;
    } catch (error) {
      logger.error('缓存批量删除失败:', error);
      return false;
    }
  }

  /**
   * 缓存装饰器 - 自动缓存方法结果
   */
  cacheable(type = 'default', keyGenerator = null) {
    return (target, propertyKey, descriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function(...args) {
        const cacheKey = keyGenerator
          ? keyGenerator(...args)
          : `${propertyKey}:${JSON.stringify(args)}`;

        // 尝试从缓存获取
        const cached = await cacheService.get(cacheKey, type);
        if (cached !== null) {
          return cached;
        }

        // 执行原方法
        const result = await originalMethod.apply(this, args);

        // 缓存结果
        await cacheService.set(cacheKey, result, type);

        return result;
      };

      return descriptor;
    };
  }

  /**
   * 缓存清除装饰器
   */
  cacheEvict(type = 'default', keyGenerator = null) {
    return (target, propertyKey, descriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function(...args) {
        const result = await originalMethod.apply(this, args);

        const cacheKey = keyGenerator
          ? keyGenerator(...args)
          : `${propertyKey}:${JSON.stringify(args)}`;

        await cacheService.delete(cacheKey, type);

        return result;
      };

      return descriptor;
    };
  }

  /**
   * 获取缓存统计
   */
  async getStats() {
    try {
      const info = await redisService.getConnectionInfo();
      return {
        connected: true,
        info,
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
      };
    }
  }

  /**
   * 预热缓存
   */
  async warmUp(tenantId) {
    logger.info(`开始缓存预热: tenant=${tenantId}`);

    try {
      // 预热模块配置
      const modules = await this.loadModulesConfig(tenantId);
      await this.set(`modules:${tenantId}`, modules, 'module:config');

      // 预热保养模板
      const templates = await this.loadMaintenanceTemplates(tenantId);
      await this.set(`templates:${tenantId}`, templates, 'maintenance:templates');

      logger.info('缓存预热完成');
      return true;
    } catch (error) {
      logger.error('缓存预热失败:', error);
      return false;
    }
  }

  async loadModulesConfig(tenantId) {
    const db = require('../config/database');
    const [rows] = await db.execute(
      'SELECT module_id, config, enabled FROM tenant_module_configs WHERE tenant_id = ?',
      [tenantId],
    );
    return rows;
  }

  async loadMaintenanceTemplates(tenantId) {
    const db = require('../config/database');
    const [rows] = await db.execute(
      'SELECT * FROM maintenance_level_templates WHERE tenant_id = ? AND status = ?',
      [tenantId, 'active'],
    );
    return rows;
  }
}

// 单例
const cacheService = new CacheService();
module.exports = cacheService;
