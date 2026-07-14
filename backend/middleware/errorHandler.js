const appConfig = require('../config/app.config');

const ERROR_CODES = appConfig.ERROR_CODES || {
  UNAUTHORIZED: 1001,
  FORBIDDEN: 1003,
  NOT_FOUND: 1004,
  VALIDATION_ERROR: 2001,
  INTERNAL_ERROR: 5000,
};

const HTTP_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  INTERNAL_ERROR: 500,
};

const errorLogger = (err, req) => {
  const errorInfo = {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    userId: req.user?.id,
    ip: req.ip,
  };
  console.error('错误详情:', errorInfo);
};

const buildErrorResponse = (statusCode, message, error, code, req) => ({
  success: false,
  message,
  error: process.env.NODE_ENV !== 'production' ? error : undefined,
  code,
  timestamp: new Date().toISOString(),
  requestId: req?.id || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
});

/**
 * 异步路由处理函数的包装器
 * 自动捕获async函数中的错误并传递给errorHandler
 *
 * @param {Function} fn - 异步路由处理函数
 * @returns {Function} 包装后的函数
 *
 * @example
 * router.get('/users', asyncHandler(async (req, res, next) => {
 *   const users = await User.findAll();
 *   res.json(users);
 * }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const errorHandler = (err, req, res, next) => {
  errorLogger(err, req);

  if (err.name === 'ValidationError') {
    return res.status(HTTP_STATUS.VALIDATION_ERROR).json(
      buildErrorResponse(HTTP_STATUS.VALIDATION_ERROR, '数据验证失败', err.message, ERROR_CODES.VALIDATION_ERROR, req),
    );
  }

  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError' || err.name === 'TokenError') {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      buildErrorResponse(HTTP_STATUS.UNAUTHORIZED, '认证失败', err.message, ERROR_CODES.UNAUTHORIZED, req),
    );
  }

  if (err.name === 'CastError' || err.name === 'InvalidIdError') {
    return res.status(HTTP_STATUS.VALIDATION_ERROR).json(
      buildErrorResponse(HTTP_STATUS.VALIDATION_ERROR, '无效的参数', err.message, ERROR_CODES.VALIDATION_ERROR, req),
    );
  }

  if (err.code === 'ER_DUP_ENTRY' || err.code === 'ER_DUP_KEY') {
    return res.status(409).json(
      buildErrorResponse(409, '数据已存在', err.message, 2002, req),
    );
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(HTTP_STATUS.VALIDATION_ERROR).json(
      buildErrorResponse(HTTP_STATUS.VALIDATION_ERROR, '关联数据不存在', err.message, 2003, req),
    );
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      buildErrorResponse(HTTP_STATUS.INTERNAL_ERROR, '服务暂时不可用', '数据库连接失败', 5001, req),
    );
  }

  // MySQL 查询超时错误
  if (err.code === 'PROTOCOL_SEQUENCE_TIMEOUT' || err.code === 'ETIMEDOUT') {
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      buildErrorResponse(HTTP_STATUS.INTERNAL_ERROR, '查询超时', '数据库查询执行时间过长', 5002, req),
    );
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(HTTP_STATUS.VALIDATION_ERROR).json(
      buildErrorResponse(HTTP_STATUS.VALIDATION_ERROR, '请求格式错误', 'JSON解析失败', 2004, req),
    );
  }

  const statusCode = err.statusCode || err.status || HTTP_STATUS.INTERNAL_ERROR;
  res.status(statusCode).json(
    buildErrorResponse(statusCode, err.message || '服务器内部错误', err.stack, ERROR_CODES.INTERNAL_ERROR, req),
  );
};

const notFoundHandler = (req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json(
    buildErrorResponse(HTTP_STATUS.NOT_FOUND, '接口不存在', `Cannot ${req.method} ${req.path}`, ERROR_CODES.NOT_FOUND, req),
  );
};

module.exports = { errorHandler, notFoundHandler, asyncHandler, ERROR_CODES, HTTP_STATUS };
