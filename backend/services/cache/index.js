/**
 * 缓存服务模块入口
 */

const { cacheService } = require('./CacheService');
const { Cacheable, CacheEvict, AssetCache, UserCache, DepartmentCache } = require('./CacheDecorator');

module.exports = {
  cacheService,
  Cacheable,
  CacheEvict,
  AssetCache,
  UserCache,
  DepartmentCache,
};
