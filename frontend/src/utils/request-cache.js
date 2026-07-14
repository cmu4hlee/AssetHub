/**
 * API 请求缓存工具
 * 提供请求去重、响应缓存、失效策略等功能
 */

import { api } from '../api/client';

class RequestCache {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 默认缓存5分钟
  }

  /**
   * 生成缓存键
   */
  generateKey(method, url, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    return `${method}:${url}?${sortedParams}`;
  }

  /**
   * 获取缓存数据
   */
  getCached(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // 检查是否过期
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * 设置缓存数据
   */
  set(key, data, ttl = this.defaultTTL) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
  }

  /**
   * 删除缓存
   */
  deleteCached(key) {
    this.cache.delete(key);
  }

  /**
   * 清除所有缓存
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 清除匹配的缓存
   */
  clearMatching(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 带缓存的请求
   */
  async request(method, url, options = {}) {
    const { 
      cache = false, 
      cacheTTL = this.defaultTTL,
      cacheKey: customCacheKey,
      ...requestOptions 
    } = options;

    const cacheKey = customCacheKey || this.generateKey(method, url, requestOptions.params);

    // 如果启用缓存，先检查缓存
    if (cache) {
      const cached = this.getCached(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 检查是否有正在进行的相同请求（请求去重）
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    // 发起请求
    const requestPromise = api.request({
      method,
      url,
      ...requestOptions,
    }).then(response => {
      // 缓存响应
      if (cache && response) {
        this.set(cacheKey, response, cacheTTL);
      }
      // 移除待处理请求
      this.pendingRequests.delete(cacheKey);
      return response;
    }).catch(error => {
      // 移除待处理请求
      this.pendingRequests.delete(cacheKey);
      throw error;
    });

    // 记录待处理请求
    this.pendingRequests.set(cacheKey, requestPromise);

    return requestPromise;
  }

  /**
   * GET 请求（带缓存）
   */
  async get(url, options = {}) {
    return this.request('get', url, options);
  }

  /**
   * POST 请求（默认不缓存）
   */
  async post(url, options = {}) {
    return this.request('post', url, { ...options, cache: false });
  }

  /**
   * PUT 请求（清除相关缓存）
   */
  async put(url, options = {}) {
    // 清除相关缓存
    this.clearMatching(url);
    return this.request('put', url, { ...options, cache: false });
  }

  /**
   * DELETE 请求（清除相关缓存）
   */
  async delete(url, options = {}) {
    // 清除相关缓存
    this.clearMatching(url);
    return this.request('delete', url, { ...options, cache: false });
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    let valid = 0;
    let expired = 0;

    for (const [, item] of this.cache.entries()) {
      if (Date.now() > item.expiry) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired,
      pendingRequests: this.pendingRequests.size,
    };
  }

  /**
   * 清理过期缓存
   */
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// 创建全局实例
const requestCache = new RequestCache();

// 定期清理过期缓存（每5分钟）
const cacheCleanupInterval = setInterval(() => {
  requestCache.cleanup();
}, 5 * 60 * 1000);

// 提供清理函数，用于应用卸载时调用
export const cleanupRequestCache = () => {
  clearInterval(cacheCleanupInterval);
  requestCache.clear();
};

export default requestCache;

// 缓存配置常量
export const CACHE_CONFIG = {
  // 长时间缓存（1小时）
  LONG_TERM: 60 * 60 * 1000,
  
  // 中等时间缓存（15分钟）
  MEDIUM_TERM: 15 * 60 * 1000,
  
  // 短时间缓存（5分钟）
  SHORT_TERM: 5 * 60 * 1000,
  
  // 实时数据（不缓存）
  REAL_TIME: 0,
};

// 常用 API 缓存配置
export const API_CACHE_STRATEGIES = {
  // 用户列表 - 短时间缓存
  'GET:/api/users': { cache: true, ttl: CACHE_CONFIG.SHORT_TERM },
  
  // 资产分类 - 长时间缓存
  'GET:/api/assets/categories': { cache: true, ttl: CACHE_CONFIG.LONG_TERM },
  
  // 部门列表 - 中等时间缓存
  'GET:/api/departments': { cache: true, ttl: CACHE_CONFIG.MEDIUM_TERM },
  
  // 系统配置 - 长时间缓存
  'GET:/api/system-config': { cache: true, ttl: CACHE_CONFIG.LONG_TERM },
  
  // 模块配置 - 长时间缓存
  'GET:/api/module-configs': { cache: true, ttl: CACHE_CONFIG.LONG_TERM },
  
  // 仪表盘统计 - 短时间缓存
  'GET:/api/dashboard': { cache: true, ttl: CACHE_CONFIG.SHORT_TERM },
  
  // 资产详情 - 中等时间缓存
  'GET:/api/assets/*': { cache: true, ttl: CACHE_CONFIG.MEDIUM_TERM },
};
