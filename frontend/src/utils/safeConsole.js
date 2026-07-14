/**
 * API 响应处理工具
 * 提供统一的错误处理和用户提示
 */

import { message } from 'antd';
import { logger } from './productionLogger';

class APIResponseHandler {
  constructor() {
    this.errorCount = new Map();
    this.maxErrorsPerEndpoint = 5;
    this.errorTimeWindow = 60000; // 1分钟内
  }

  /**
   * 检查是否应该显示错误提示
   */
  shouldShowError(endpoint) {
    const now = Date.now();
    const endpointErrors = this.errorCount.get(endpoint) || [];
    
    // 清理过期记录
    const recentErrors = endpointErrors.filter(
      time => now - time < this.errorTimeWindow
    );
    
    this.errorCount.set(endpoint, recentErrors);
    
    // 如果1分钟内错误次数超过阈值，不再显示提示
    if (recentErrors.length >= this.maxErrorsPerEndpoint) {
      return false;
    }
    
    // 记录错误
    recentErrors.push(now);
    return true;
  }

  /**
   * 处理成功响应
   */
  handleSuccess(result, options = {}) {
    const {
      showMessage = true,
      successMessage = '操作成功',
      silentEndpoints = [],
    } = options;

    if (result.success && showMessage && result.message) {
      message.success(result.message);
    }

    logger.info('API请求成功', {
      url: result.url,
      success: result.success,
    });

    return result;
  }

  /**
   * 处理错误响应
   */
  handleError(error, options = {}) {
    const {
      endpoint = 'unknown',
      showMessage = true,
      customMessage = null,
      silentEndpoints = [],
      fallbackMessage = '操作失败，请稍后重试',
    } = options;

    // 检查是否应该显示错误
    const shouldShow = this.shouldShowError(endpoint);

    // 记录错误
    logger.error('API请求错误', {
      endpoint,
      error: error.message || error,
      status: error.response?.status,
      data: error.response?.data,
    });

    // 显示用户提示
    if (showMessage && shouldShow) {
      let displayMessage = customMessage || 
        error.response?.data?.message || 
        error.message || 
        fallbackMessage;

      // 根据错误类型选择提示方式
      if (error.response?.status === 401) {
        message.error('登录已过期，请重新登录');
      } else if (error.response?.status === 403) {
        message.error('没有权限执行此操作');
      } else if (error.response?.status === 404) {
        message.error('请求的资源不存在');
      } else if (error.response?.status >= 500) {
        message.error('服务器错误，请联系管理员');
      } else {
        message.error(displayMessage);
      }
    }

    // 返回标准化的错误对象
    return {
      success: false,
      error: error.message || 'Unknown error',
      code: error.response?.data?.code || error.code || 'UNKNOWN_ERROR',
      status: error.response?.status,
      data: error.response?.data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 处理网络错误
   */
  handleNetworkError(error, options = {}) {
    const { showMessage = true } = options;

    logger.error('网络错误', {
      error: error.message || error,
      type: 'NETWORK_ERROR',
    });

    if (showMessage) {
      if (!navigator.onLine) {
        message.error('网络连接已断开，请检查网络');
      } else {
        message.error('网络请求失败，请稍后重试');
      }
    }

    return {
      success: false,
      error: error.message || 'Network error',
      code: 'NETWORK_ERROR',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 处理超时错误
   */
  handleTimeoutError(options = {}) {
    const { showMessage = true } = options;

    logger.warn('请求超时');

    if (showMessage) {
      message.warning('请求超时，请稍后重试');
    }

    return {
      success: false,
      error: 'Request timeout',
      code: 'TIMEOUT_ERROR',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 重试处理
   */
  async withRetry(fn, options = {}) {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      onRetry = null,
      shouldRetry = (error) => {
        // 默认只重试网络错误和服务器错误
        return !error.response || error.response.status >= 500;
      },
    } = options;

    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (i < maxRetries - 1 && shouldRetry(error)) {
          logger.info(`重试请求 (${i + 1}/${maxRetries})`);
          
          if (onRetry) {
            onRetry(error, i + 1);
          }
          
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 带缓存的请求
   */
  async withCache(key, fn, options = {}) {
    const { cacheTime = 60000, cache = new Map() } = options;
    
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      logger.debug('使用缓存数据', { key });
      return cached.data;
    }
    
    const data = await fn();
    cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    
    return data;
  }

  /**
   * 批量请求处理
   */
  async handleBatch(requests, options = {}) {
    const { stopOnError = false, showProgress = false } = options;
    const results = [];
    
    for (let i = 0; i < requests.length; i++) {
      try {
        const result = await requests[i].fn();
        results.push({ success: true, data: result, index: i });
        
        if (showProgress) {
          message.loading(`处理中... ${i + 1}/${requests.length}`);
        }
      } catch (error) {
        const errorResult = this.handleError(error, {
          showMessage: false,
          ...requests[i].options,
        });
        results.push({ success: false, error: errorResult, index: i });
        
        if (stopOnError) {
          break;
        }
      }
    }
    
    return {
      results,
      successCount: results.filter(r => r.success).length,
      errorCount: results.filter(r => !r.success).length,
      allSuccess: results.every(r => r.success),
    };
  }

  /**
   * 获取错误统计
   */
  getErrorStats() {
    const stats = {};
    
    for (const [endpoint, errors] of this.errorCount.entries()) {
      const recentErrors = errors.filter(
        time => Date.now() - time < this.errorTimeWindow
      );
      
      if (recentErrors.length > 0) {
        stats[endpoint] = {
          count: recentErrors.length,
          lastError: recentErrors[recentErrors.length - 1],
        };
      }
    }
    
    return stats;
  }

  /**
   * 重置错误计数
   */
  resetErrors(endpoint = null) {
    if (endpoint) {
      this.errorCount.delete(endpoint);
    } else {
      this.errorCount.clear();
    }
  }
}

// 创建全局单例
const responseHandler = new APIResponseHandler();

export const apiHandler = responseHandler;

export default responseHandler;

// 使用示例
/**
 * // 简单使用
 * try {
 *   const result = await api.get('/assets');
 *   apiHandler.handleSuccess(result);
 * } catch (error) {
 *   apiHandler.handleError(error, { endpoint: '/assets' });
 * }
 *
 * // 带重试
 * try {
 *   const result = await apiHandler.withRetry(
 *     () => api.post('/assets', data),
 *     { maxRetries: 3, retryDelay: 1000 }
 *   );
 * } catch (error) {
 *   apiHandler.handleError(error);
 * }
 *
 * // 批量处理
 * const batchResult = await apiHandler.handleBatch([
 *   { fn: () => api.post('/asset1', data1) },
 *   { fn: () => api.post('/asset2', data2) },
 * ]);
 *
 * console.log(`成功: ${batchResult.successCount}, 失败: ${batchResult.errorCount}`);
 */
