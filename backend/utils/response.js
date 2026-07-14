/**
 * 统一 API 响应格式工具
 * 确保所有 API 响应格式一致
 */

/**
 * 成功响应
 * @param {Object} res - Express res 对象
 * @param {Object} data - 响应数据
 * @param {Object} meta - 元信息（分页等）
 */
const success = (res, data = null, meta = null) => {
  const response = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  if (meta) {
    response.meta = meta;
  }

  return res.json(response);
};

/**
 * 成功响应（带分页）
 * @param {Object} res - Express res 对象
 * @param {Array} list - 数据列表
 * @param {Object} pagination - 分页信息 { page, pageSize, total }
 */
const successWithPagination = (res, list, pagination) => {
  return success(res, list, {
    pagination: {
      page: pagination.page || pagination.current || 1,
      pageSize: pagination.pageSize || pagination.page_size || 10,
      total: pagination.total || 0,
      totalPages: Math.ceil((pagination.total || 0) / (pagination.pageSize || pagination.page_size || 10)),
    },
  });
};

/**
 * 成功响应（简单消息）
 * @param {Object} res - Express res 对象
 * @param {string} message - 成功消息
 * @param {Object} data - 附加数据
 */
const successMessage = (res, message, data = null) => {
  return success(res, {
    message,
    ...(data && { ...data }),
  });
};

/**
 * 错误响应
 * @param {Object} res - Express res 对象
 * @param {number} statusCode - HTTP 状态码
 * @param {string} message - 错误消息
 * @param {string} code - 错误代码
 * @param {Object} errors - 详细错误信息
 */
const error = (res, statusCode, message, code = null, errors = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (code) {
    response.code = code;
  }

  if (errors) {
    response.errors = errors;
  }

  if (process.env.NODE_ENV !== 'production') {
    // 开发环境下添加请求ID（如果存在）
  }

  return res.status(statusCode).json(response);
};

/**
 * 常用错误响应快捷方法
 */
const notFound = (res, message = '资源不存在') => {
  return error(res, 404, message, 'NOT_FOUND');
};

const unauthorized = (res, message = '未授权') => {
  return error(res, 401, message, 'UNAUTHORIZED');
};

const forbidden = (res, message = '禁止访问') => {
  return error(res, 403, message, 'FORBIDDEN');
};

const badRequest = (res, message = '请求参数错误', errors = null) => {
  return error(res, 400, message, 'BAD_REQUEST', errors);
};

const serverError = (res, message = '服务器内部错误') => {
  return error(res, 500, message, 'SERVER_ERROR');
};

const conflict = (res, message = '资源冲突') => {
  return error(res, 409, message, 'CONFLICT');
};

module.exports = {
  success,
  successWithPagination,
  successMessage,
  error,
  notFound,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  conflict,
};
