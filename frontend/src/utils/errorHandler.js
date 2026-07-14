/**
 * 统一错误处理工具
 * 提供一致的错误处理模式和上下文信息
 */

import { message } from 'antd';
import { logger } from './productionLogger';

export class AppError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

class ErrorHandler {
  constructor() {
    this.errorHandlers = new Map();
  }

  /**
   * 注册自定义错误处理器
   */
  registerHandler(code, handler) {
    this.errorHandlers.set(code, handler);
  }

  /**
   * 处理错误
   */
  handle(error, options = {}) {
    const {
      showMessage = true,
      context = '',
      fallbackMessage = '操作失败，请稍后重试',
    } = options;

    const errorInfo = this.extractErrorInfo(error);

    // 记录错误
    logger.error(`[${context}] ${errorInfo.message}`, {
      code: errorInfo.code,
      details: errorInfo.details,
      stack: error?.stack,
    });

    // 调用自定义处理器
    const customHandler = this.errorHandlers.get(errorInfo.code);
    if (customHandler) {
      customHandler(errorInfo, options);
      return errorInfo;
    }

    // 显示错误消息
    if (showMessage) {
      this.showErrorMessage(errorInfo, fallbackMessage);
    }

    return errorInfo;
  }

  /**
   * 提取错误信息
   */
  extractErrorInfo(error) {
    if (error instanceof AppError) {
      return {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: error.timestamp,
      };
    }

    if (error.response) {
      return {
        code: this.getErrorCodeFromStatus(error.response.status),
        message: error.response.data?.message || error.message || '请求失败',
        details: error.response.data,
        status: error.response.status,
      };
    }

    if (!navigator.onLine) {
      return {
        code: ErrorCodes.NETWORK_ERROR,
        message: '网络连接已断开',
        details: {},
      };
    }

    return {
      code: ErrorCodes.UNKNOWN_ERROR,
      message: error.message || '未知错误',
      details: {},
    };
  }

  /**
   * 根据 HTTP 状态码获取错误代码
   */
  getErrorCodeFromStatus(status) {
    switch (status) {
      case 401:
        return ErrorCodes.AUTH_ERROR;
      case 403:
        return ErrorCodes.PERMISSION_ERROR;
      case 404:
        return ErrorCodes.NOT_FOUND;
      case 422:
        return ErrorCodes.VALIDATION_ERROR;
      case 500:
      case 502:
      case 503:
        return ErrorCodes.SERVER_ERROR;
      default:
        return ErrorCodes.UNKNOWN_ERROR;
    }
  }

  /**
   * 显示错误消息
   */
  showErrorMessage(errorInfo, fallbackMessage) {
    const { code, message } = errorInfo;

    switch (code) {
      case ErrorCodes.AUTH_ERROR:
        message.error('登录已过期，请重新登录');
        break;
      case ErrorCodes.PERMISSION_ERROR:
        message.error('没有权限执行此操作');
        break;
      case ErrorCodes.NETWORK_ERROR:
        message.error('网络连接已断开，请检查网络');
        break;
      case ErrorCodes.NOT_FOUND:
        message.error('请求的资源不存在');
        break;
      case ErrorCodes.SERVER_ERROR:
        message.error('服务器错误，请联系管理员');
        break;
      case ErrorCodes.VALIDATION_ERROR:
        message.error(message || fallbackMessage);
        break;
      default:
        message.error(message || fallbackMessage);
    }
  }

  /**
   * 包装异步函数，统一处理错误
   */
  async wrapAsync(fn, options = {}) {
    try {
      const result = await fn();
      return { success: true, data: result };
    } catch (error) {
      const errorInfo = this.handle(error, options);
      return { success: false, error: errorInfo };
    }
  }

  /**
   * 创建业务错误
   */
  createError(code, message, details = {}) {
    return new AppError(code, message, details);
  }
}

// 创建全局单例
const errorHandler = new ErrorHandler();

export const appErrorHandler = errorHandler;

export default errorHandler;
