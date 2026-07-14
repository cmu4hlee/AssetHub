/**
 * 模块错误处理中间件
 *
 * 提供统一的错误处理机制，确保模块异常不会影响整体系统稳定性。
 *
 * 特性：
 * 1. 捕获并格式化所有模块异常
 * 2. 记录详细的错误日志
 * 3. 防止错误堆栈泄露
 * 4. 支持自定义错误恢复策略
 */

const logger = require('../config/logger');

/**
 * 标准错误响应格式
 */
const ErrorResponse = {
  success: false,
  code: 'UNKNOWN_ERROR',
  message: '系统内部错误',
  details: null,
  timestamp: new Date().toISOString(),
};

/**
 * HTTP状态码映射
 */
const HTTP_STATUS_MAP = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  DEPENDENCY_ERROR: 503,
  INTERNAL_ERROR: 500,
  UNAUTHORIZED: 401,
};

/**
 * 模块错误处理中间件
 *
 * @param {Error} err - 错误对象
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 * @param {import('express').NextFunction} next - 下一个中间件
 */
function moduleErrorHandler(err, req, res, next) {
  // 记录错误日志
  if (err.code) {
    logger.error(`模块异常 [${err.code}]: ${err.message}`, {
      module: req.baseUrl || 'unknown',
      path: req.path,
      method: req.method,
      details: err.details,
      cause: err.cause?.message,
    });
  } else {
    logger.error('未捕获异常:', {
      error: err.message,
      stack: err.stack,
      module: req.baseUrl || 'unknown',
      path: req.path,
      method: req.method,
    });
  }

  // 确定错误代码和状态码
  const code = err.code || 'INTERNAL_ERROR';
  const statusCode = HTTP_STATUS_MAP[code] || 500;

  // 构建响应（生产环境隐藏详细信息）
  const response = {
    success: false,
    code,
    message: err.message || '系统内部错误',
    timestamp: new Date().toISOString(),
  };

  // 开发环境包含详细信息
  if (process.env.NODE_ENV !== 'production') {
    response.details = err.details || null;
    response.stack = err.stack;
  }

  // 返回响应
  res.status(statusCode).json(response);
}

/**
 * 异步路由包装器
 *
 * 自动捕获异步路由中的异常并传递给错误处理中间件
 *
 * @param {Function} fn - 异步路由处理函数
 * @returns {Function} Express中间件
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 模块隔离中间件
 *
 * 确保单个模块的异常不会导致整个应用崩溃
 *
 * @param {string} moduleName - 模块名称
 * @returns {Function} Express中间件
 */
function moduleIsolationMiddleware(moduleName) {
  return (err, req, res, next) => {
    try {
      // 添加模块标识到错误对象
      if (err) {
        err.module = moduleName;
      }
      next(err);
    } catch (isolationError) {
      // 隔离层本身出错时，返回最小化响应
      logger.error(`模块隔离层异常 [${moduleName}]:`, isolationError);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          code: 'ISOLATION_ERROR',
          message: '模块隔离失败',
          timestamp: new Date().toISOString(),
        });
      }
    }
  };
}

/**
 * 创建模块异常
 *
 * @param {string} code - 错误代码
 * @param {string} message - 错误消息
 * @param {Object} details - 详细信息
 * @param {Error} cause - 原始异常
 * @returns {Error} 模块异常对象
 */
function createModuleError(code, message, details = {}, cause = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  error.cause = cause;
  error.timestamp = new Date().toISOString();
  error.isModuleError = true;
  return error;
}

/**
 * 安全执行函数
 *
 * 执行可能失败的函数，失败时返回默认值
 *
 * @param {Function} fn - 执行函数
 * @param {any} defaultValue - 默认值
 * @param {string} errorMessage - 错误消息
 * @returns {Promise<any>}
 */
async function safeExecute(fn, defaultValue = null, errorMessage = '操作失败') {
  try {
    return await fn();
  } catch (error) {
    logger.warn('安全执行失败:', {
      error: error.message,
      defaultUsed: defaultValue !== null,
    });
    return defaultValue;
  }
}

/**
 * 带重试的安全执行
 *
 * @param {Function} fn - 执行函数
 * @param {number} maxRetries - 最大重试次数
 * @param {number} delay - 重试间隔（毫秒）
 * @param {any} defaultValue - 默认值
 * @returns {Promise<any>}
 */
async function safeExecuteWithRetry(fn, maxRetries = 3, delay = 1000, defaultValue = null) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        logger.warn(`执行失败，第 ${attempt} 次重试:`, {
          error: error.message,
          attempt,
          maxRetries,
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  logger.error('执行失败，已达到最大重试次数:', {
    error: lastError?.message,
    attempts: maxRetries,
  });
  return defaultValue;
}

module.exports = {
  moduleErrorHandler,
  asyncHandler,
  moduleIsolationMiddleware,
  createModuleError,
  safeExecute,
  safeExecuteWithRetry,
  HTTP_STATUS_MAP,
  ErrorResponse,
};
