const rateLimit = require('express-rate-limit');

const safeIpKeyGenerator = req => rateLimit.ipKeyGenerator(req.ip || req.ipAddress || '');
const API_LIMIT_WINDOW_MS = Number.parseInt(process.env.API_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10);
const API_LIMIT_MAX = Number.parseInt(process.env.API_LIMIT_MAX || '5000', 10);

const rateLimitHandler = (req, res, next, options) => {
  const statusCode = Number.isInteger(options?.statusCode) ? options.statusCode : 429;
  const payload = options?.message || {
    success: false,
    message: '请求过于频繁，请稍后再试',
    code: 'RATE_LIMIT_EXCEEDED',
  };
  return res.status(statusCode).json(payload);
};

// 通用API请求限流
const apiLimiter = rateLimit({
  windowMs: API_LIMIT_WINDOW_MS,
  max: API_LIMIT_MAX,
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: safeIpKeyGenerator,
  handler: rateLimitHandler,
  // 跳过健康检查接口
  skip: (req) => req.path === '/health' || req.path === '/health/dependencies' || req.path === '/ready' || req.path === '/alive',
});

// 登录接口更严格的限流
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分钟
  max: 50, // 每个IP在5分钟内最多50次登录尝试
  message: {
    success: false,
    message: '登录尝试过于频繁，请5分钟后再试',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: safeIpKeyGenerator,
  handler: rateLimitHandler,
});

// 注册接口限流
const registerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10分钟
  max: 5, // 每个IP在10分钟内最多5次注册尝试
  message: {
    success: false,
    message: '注册尝试过于频繁，请10分钟后再试',
    code: 'REGISTER_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: safeIpKeyGenerator,
  handler: rateLimitHandler,
});

// 密码重置接口限流
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 3, // 每个IP在15分钟内最多3次密码重置尝试
  message: {
    success: false,
    message: '密码重置尝试过于频繁，请15分钟后再试',
    code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: safeIpKeyGenerator,
  handler: rateLimitHandler,
});

// ============================================
// 模块级限流
// 每个模块独立的限流配额，单个模块被刷爆不会耗尽全局配额
// ============================================

const MODULE_LIMIT_WINDOW_MS = Number.parseInt(process.env.MODULE_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10);
const MODULE_LIMIT_MAX_DEFAULT = Number.parseInt(process.env.MODULE_RATE_LIMIT_MAX || '1000', 10);

// 模块级限流器缓存：moduleId -> rateLimit 实例
const moduleLimiters = new Map();

/**
 * 创建或获取模块级限流器
 * 每个模块拥有独立的限流配额（默认 1000 req/15min），
 * 可通过环境变量 MODULE_RATE_LIMIT_MAX_<MODULE_ID> 覆盖
 * @param {string} moduleId - 模块ID
 * @returns {import('express-rate-limit').RateLimitRequestHandler}
 */
const createModuleRateLimiter = (moduleId) => {
  if (!moduleId) return null;
  if (moduleLimiters.has(moduleId)) {
    return moduleLimiters.get(moduleId);
  }

  // 读取模块专属配额：MODULE_RATE_LIMIT_MAX_<MODULE_ID>=N
  const envKey = `MODULE_RATE_LIMIT_MAX_${moduleId.toUpperCase().replace(/-/g, '_')}`;
  const moduleMax = Number.parseInt(process.env[envKey], 10) || MODULE_LIMIT_MAX_DEFAULT;

  const limiter = rateLimit({
    windowMs: MODULE_LIMIT_WINDOW_MS,
    max: moduleMax,
    message: {
      success: false,
      message: `模块 ${moduleId} 请求过于频繁，请稍后再试`,
      code: 'MODULE_RATE_LIMIT_EXCEEDED',
      moduleId,
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: safeIpKeyGenerator,
    handler: rateLimitHandler,
    skip: (req) => req.path === '/health' || req.path.endsWith('/health'),
  });

  moduleLimiters.set(moduleId, limiter);
  return limiter;
};

/**
 * 获取所有模块限流器状态（用于健康检查/监控）
 */
const getModuleLimiterStats = () => {
  const stats = {};
  for (const [modId, limiter] of moduleLimiters.entries()) {
    const envKey = `MODULE_RATE_LIMIT_MAX_${modId.toUpperCase().replace(/-/g, '_')}`;
    stats[modId] = {
      max: Number.parseInt(process.env[envKey], 10) || MODULE_LIMIT_MAX_DEFAULT,
      windowMs: MODULE_LIMIT_WINDOW_MS,
    };
  }
  return stats;
};

module.exports = {
  apiLimiter,
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  createModuleRateLimiter,
  getModuleLimiterStats,
};
