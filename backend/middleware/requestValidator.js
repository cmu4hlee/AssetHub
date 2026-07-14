/**
 * 请求验证中间件
 * 验证请求参数、防止恶意输入
 */

const { ValidationError } = require('./errorHandler');

/**
 * 验证请求体大小
 */
function validateBodySize(maxSize = 50 * 1024 * 1024) {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'], 10);

    if (contentLength > maxSize) {
      return next(new ValidationError(`请求体过大，最大允许 ${maxSize / 1024 / 1024}MB`));
    }

    next();
  };
}

/**
 * 验证请求参数
 * @param {Object} schema - 验证规则
 */
function validateParams(schema) {
  return (req, res, next) => {
    const errors = [];
    const params = { ...req.params, ...req.query, ...req.body };

    for (const [field, rules] of Object.entries(schema)) {
      const value = params[field];

      // 必填验证
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${field} 是必填项` });
        continue;
      }

      if (value === undefined || value === null) continue;

      // 类型验证
      if (rules.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rules.type) {
          errors.push({ field, message: `${field} 必须是 ${rules.type} 类型` });
          continue;
        }
      }

      // 长度验证
      if (rules.minLength !== undefined && String(value).length < rules.minLength) {
        errors.push({ field, message: `${field} 最少 ${rules.minLength} 个字符` });
      }

      if (rules.maxLength !== undefined && String(value).length > rules.maxLength) {
        errors.push({ field, message: `${field} 最多 ${rules.maxLength} 个字符` });
      }

      // 范围验证
      if (rules.min !== undefined && Number(value) < rules.min) {
        errors.push({ field, message: `${field} 最小值为 ${rules.min}` });
      }

      if (rules.max !== undefined && Number(value) > rules.max) {
        errors.push({ field, message: `${field} 最大值为 ${rules.max}` });
      }

      // 正则验证
      if (rules.pattern && !rules.pattern.test(String(value))) {
        errors.push({ field, message: rules.message || `${field} 格式不正确` });
      }

      // 枚举验证
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({ field, message: `${field} 必须是以下值之一: ${rules.enum.join(', ')}` });
      }

      // 自定义验证
      if (rules.validator && typeof rules.validator === 'function') {
        const result = rules.validator(value);
        if (result !== true) {
          errors.push({ field, message: result || `${field} 验证失败` });
        }
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError('参数验证失败', errors));
    }

    next();
  };
}

/**
 * 防止 SQL 注入
 */
function sanitizeInput(req, res, next) {
  const sqlPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|SCRIPT)\b)|(--)|(\/\*)|(\*\/)/i;

  function checkValue(value, path) {
    if (typeof value === 'string') {
      if (sqlPattern.test(value)) {
        throw new ValidationError(`检测到潜在的安全风险: ${path}`);
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, val] of Object.entries(value)) {
        checkValue(val, `${path}.${key}`);
      }
    }
  }

  try {
    checkValue(req.body, 'body');
    checkValue(req.query, 'query');
    checkValue(req.params, 'params');
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 防止 XSS 攻击
 */
function xssProtection(req, res, next) {
  const xssPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;

  function sanitizeValue(value) {
    if (typeof value === 'string') {
      return value.replace(xssPattern, '');
    } else if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    } else if (typeof value === 'object' && value !== null) {
      const sanitized = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    return value;
  }

  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);

  next();
}

module.exports = {
  validateBodySize,
  validateParams,
  sanitizeInput,
  xssProtection,
};
