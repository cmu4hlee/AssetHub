const redisService = require('./redis.service');
const { generateQueryHash } = require('../utils/common');

class CacheManager {
  // 资产查询缓存
  async getAssetListCache(tenantId, query) {
    const cacheKey = `asset:list:${tenantId}:${generateQueryHash(query)}`;
    return await redisService.getCache(cacheKey);
  }

  async setAssetListCache(tenantId, query, data, expire = 300) { // 5分钟过期
    const cacheKey = `asset:list:${tenantId}:${generateQueryHash(query)}`;
    return await redisService.setCache(cacheKey, data, expire);
  }

  async deleteAssetListCache(tenantId) {
    return await redisService.clearCacheByPattern(`asset:list:${tenantId}:*`);
  }

  async getAssetDetailCache(assetId) {
    const cacheKey = `asset:detail:${assetId}`;
    return await redisService.getCache(cacheKey);
  }

  async setAssetDetailCache(assetId, data, expire = 600) { // 10分钟过期
    const cacheKey = `asset:detail:${assetId}`;
    return await redisService.setCache(cacheKey, data, expire);
  }

  async deleteAssetDetailCache(assetId) {
    const cacheKey = `asset:detail:${assetId}`;
    return await redisService.deleteCache(cacheKey);
  }

  // 用户权限缓存
  async getUserPermissionsCache(userId) {
    const cacheKey = `user:permissions:${userId}`;
    return await redisService.getCache(cacheKey);
  }

  async setUserPermissionsCache(userId, permissions, expire = 3600) { // 1小时过期
    const cacheKey = `user:permissions:${userId}`;
    return await redisService.setCache(cacheKey, permissions, expire);
  }

  async deleteUserPermissionsCache(userId) {
    const cacheKey = `user:permissions:${userId}`;
    return await redisService.deleteCache(cacheKey);
  }

  // 审批流程状态缓存
  async getApprovalStatusCache(approvalId) {
    const cacheKey = `approval:status:${approvalId}`;
    return await redisService.getCache(cacheKey);
  }

  async setApprovalStatusCache(approvalId, status, expire = 1800) { // 30分钟过期
    const cacheKey = `approval:status:${approvalId}`;
    return await redisService.setCache(cacheKey, status, expire);
  }

  async deleteApprovalStatusCache(approvalId) {
    const cacheKey = `approval:status:${approvalId}`;
    return await redisService.deleteCache(cacheKey);
  }

  // 统计数据缓存
  async getStatisticsCache(tenantId, type) {
    const cacheKey = `statistics:${tenantId}:${type}`;
    return await redisService.getCache(cacheKey);
  }

  async setStatisticsCache(tenantId, type, data, expire = 3600) { // 1小时过期
    const cacheKey = `statistics:${tenantId}:${type}`;
    return await redisService.setCache(cacheKey, data, expire);
  }

  async deleteStatisticsCache(tenantId) {
    return await redisService.clearCacheByPattern(`statistics:${tenantId}:*`);
  }

  // 搜索结果缓存
  async getSearchResultsCache(tenantId, searchQuery) {
    const cacheKey = `search:results:${tenantId}:${generateQueryHash(searchQuery)}`;
    return await redisService.getCache(cacheKey);
  }

  async setSearchResultsCache(tenantId, searchQuery, results, expire = 300) { // 5分钟过期
    const cacheKey = `search:results:${tenantId}:${generateQueryHash(searchQuery)}`;
    return await redisService.setCache(cacheKey, results, expire);
  }

  async deleteSearchResultsCache(tenantId) {
    return await redisService.clearCacheByPattern(`search:results:${tenantId}:*`);
  }



  // 通用缓存方法
  async getCache(key) {
    return await redisService.getCache(key);
  }

  async setCache(key, value, expire = 3600) {
    return await redisService.setCache(key, value, expire);
  }

  async deleteCache(key) {
    return await redisService.deleteCache(key);
  }

  async clearCacheByPattern(pattern) {
    return await redisService.clearCacheByPattern(pattern);
  }
}

// 导出单例
const cacheManager = new CacheManager();
module.exports = cacheManager;
