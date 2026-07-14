/**
 * 请求超时控制中间件
 */

const logger = require('../config/logger');

/**
 * 请求超时中间件
 * @param {number} timeout - 超时时间（毫秒）
 */
function requestTimeout(timeout = 30000) {
  return (req, res, next) => {
    // 设置超时计时器
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn(`[Timeout] 请求超时: ${req.method} ${req.path}`);
        res.status(408).json({
          success: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: '请求处理超时，请稍后重试',
            statusCode: 408,
          },
        });
      }
    }, timeout);

    // 保存原始结束方法
    const originalEnd = res.end;

    // 重写 end 方法以清除超时计时器
    res.end = function(...args) {
      clearTimeout(timeoutId);
      return originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * 不同路由的超时配置
 */
const timeoutConfigs = {
  // 默认超时
  default: 30000,

  // 上传接口需要更长的超时
  upload: 5 * 60 * 1000, // 5分钟

  // AI 接口可能需要较长时间
  ai: 10 * 60 * 1000, // 10分钟

  // 导出接口
  export: 2 * 60 * 1000, // 2分钟

  // 健康检查应该很快
  health: 5000, // 5秒
};

/**
 * 智能超时中间件
 * 根据路由自动选择超时时间
 */
function smartTimeout() {
  return (req, res, next) => {
    let timeout = timeoutConfigs.default;
    const path = req.path.toLowerCase();

    // 根据路径匹配超时配置
    if (path.includes('/upload')) {
      timeout = timeoutConfigs.upload;
    } else if (path.includes('/ai/') || path.includes('/maintenance/ai')) {
      timeout = timeoutConfigs.ai;
    } else if (path.includes('/export')) {
      timeout = timeoutConfigs.export;
    } else if (path.startsWith('/api/health')) {
      timeout = timeoutConfigs.health;
    }

    // 应用超时
    requestTimeout(timeout)(req, res, next);
  };
}

module.exports = {
  requestTimeout,
  smartTimeout,
  timeoutConfigs,
};
