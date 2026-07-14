/**
 * API 请求合并工具
 * 将多个相似的请求合并为一个批量请求，减少服务器压力
 */

import { api } from '../api/client';

class RequestBatcher {
  constructor(options = {}) {
    this.batchWindow = options.batchWindow || 50; // 合并窗口期（毫秒）
    this.maxBatchSize = options.maxBatchSize || 50; // 最大批量大小
    this.batches = new Map(); // 待处理的批次
    this.timeouts = new Map(); // 批次超时
  }

  /**
   * 生成批次键
   */
  generateBatchKey(method, url) {
    return `${method}:${url}`;
  }

  /**
   * 添加到批次
   */
  addToBatch(method, url, data, resolve, reject) {
    const key = this.generateBatchKey(method, url);
    
    if (!this.batches.has(key)) {
      this.batches.set(key, {
        method,
        url,
        items: [],
        promises: [],
      });
    }

    const batch = this.batches.get(key);
    batch.items.push(data);
    batch.promises.push({ resolve, reject });

    // 如果达到最大批次大小，立即执行
    if (batch.items.length >= this.maxBatchSize) {
      this.executeBatch(key);
    } else {
      // 否则设置延迟执行
      this.scheduleBatch(key);
    }
  }

  /**
   * 设置批次执行计划
   */
  scheduleBatch(key) {
    // 清除现有的超时
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
    }

    // 设置新的超时
    const timeout = setTimeout(() => {
      this.executeBatch(key);
    }, this.batchWindow);

    this.timeouts.set(key, timeout);
  }

  /**
   * 执行批次请求
   */
  async executeBatch(key) {
    const batch = this.batches.get(key);
    if (!batch || batch.items.length === 0) return;

    // 从待处理中移除
    this.batches.delete(key);
    this.timeouts.delete(key);

    try {
      // 发送批量请求
      const response = await api.post(batch.url, {
        batch: true,
        items: batch.items,
      });

      // 分发响应到各个 Promise
      if (response && response.results) {
        batch.promises.forEach((promise, index) => {
          const result = response.results[index];
          if (result && result.success !== false) {
            promise.resolve(result);
          } else {
            promise.reject(new Error(result?.message || 'Batch request failed'));
          }
        });
      } else {
        // 如果没有单独的结果，全部使用同一响应
        batch.promises.forEach(promise => {
          promise.resolve(response);
        });
      }
    } catch (error) {
      // 所有 Promise 都失败
      batch.promises.forEach(promise => {
        promise.reject(error);
      });
    }
  }

  /**
   * 批量请求方法
   */
  async batchRequest(method, url, data) {
    return new Promise((resolve, reject) => {
      this.addToBatch(method, url, data, resolve, reject);
    });
  }

  /**
   * 清除所有待处理的批次
   */
  clear() {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.batches.clear();
    this.timeouts.clear();
  }
}

// 创建全局实例
const requestBatcher = new RequestBatcher();

export default requestBatcher;

/**
 * 自动批量请求 Hook
 * 用于 React 组件中自动合并请求
 */
export const useBatchedRequest = () => {
  const batchRequest = async (url, data) => {
    return requestBatcher.batchRequest('POST', url, data);
  };

  return { batchRequest };
};

/**
 * 批量操作工具
 * 用于批量更新、删除等操作
 */
export class BatchOperation {
  constructor(options = {}) {
    this.items = [];
    this.batchSize = options.batchSize || 100;
    this.onProgress = options.onProgress || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});
  }

  /**
   * 添加操作项
   */
  add(item) {
    this.items.push(item);
  }

  /**
   * 执行批量操作
   */
  async execute(asyncFn) {
    const results = [];
    const errors = [];
    const total = this.items.length;

    for (let i = 0; i < total; i += this.batchSize) {
      const batch = this.items.slice(i, i + this.batchSize);
      
      try {
        const batchResults = await Promise.all(
          batch.map(item => asyncFn(item).catch(error => ({ error, item })))
        );

        batchResults.forEach((result, index) => {
          if (result && result.error) {
            errors.push({ item: batch[index], error: result.error });
          } else {
            results.push(result);
          }
        });

        this.onProgress({
          completed: Math.min(i + this.batchSize, total),
          total,
          percentage: Math.round((Math.min(i + this.batchSize, total) / total) * 100),
        });
      } catch (error) {
        this.onError(error);
        errors.push(...batch.map(item => ({ item, error })));
      }
    }

    this.onComplete({ results, errors });
    return { results, errors };
  }
}

/**
 * 使用示例：
 * 
 * // 1. 请求缓存
 * import requestCache, { CACHE_CONFIG } from '@/utils/request-cache';
 * 
 * // 带缓存的 GET 请求
 * const users = await requestCache.get('/api/users', {
 *   cache: true,
 *   cacheTTL: CACHE_CONFIG.MEDIUM_TERM
 * });
 * 
 * // 2. 批量请求
 * import requestBatcher from '@/utils/request-batcher';
 * 
 * const result = await requestBatcher.batchRequest('POST', '/api/assets/batch-update', {
 *   id: assetId,
 *   data: updateData
 * });
 * 
 * // 3. 批量操作
 * import { BatchOperation } from '@/utils/request-batcher';
 * 
 * const batch = new BatchOperation({
 *   batchSize: 50,
 *   onProgress: ({ percentage }) => console.log(`${percentage}% 完成`),
 * });
 * 
 * assets.forEach(asset => batch.add(asset));
 * const { results, errors } = await batch.execute(async (asset) => {
 *   return api.put(`/api/assets/${asset.id}`, asset);
 * });
 */
