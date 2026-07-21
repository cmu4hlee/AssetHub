/**
 * 请求超时中间件
 *
 * 防止单个慢请求拖死整个进程：
 * - 设置 HTTP socket 超时（默认 30s，可通过 REQUEST_TIMEOUT_MS 环境变量调整）
 * - 设置响应头 X-Timeout-Warning 提前 5s 警告
 * - 超时后自动返回 504 Gateway Timeout，释放 socket 给其他请求
 * - 跳过白名单（/api/health, /api/health/ready, /api/health/alive, /api/health/metrics）— K8s 探针不能超时
 *
 * 用法: app.use(requestTimeout()) 在所有路由前挂载
 */

const DEFAULT_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10);
const WARN_BEFORE_TIMEOUT_MS = 5000;
const SKIP_PATHS = ['/api/health', '/api/health/ready', '/api/health/alive', '/api/health/metrics'];

function shouldSkip(path) {
  return SKIP_PATHS.some(p => path === p || path.startsWith(p + '/'));
}

/**
 * @param {Object} opts
 * @param {number} opts.timeoutMs - 超时（默认 30s）
 * @param {boolean} opts.warnBeforeTimeout - 提前 5s 警告头（默认 true）
 * @param {(req, res, next) => void} opts.onTimeout - 回调（用于打点/限流）
 */
function requestTimeout(opts = {}) {
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const warnBefore = opts.warnBeforeTimeout !== false;
  const onTimeout = opts.onTimeout;

  return (req, res, next) => {
    if (shouldSkip(req.path)) {
      return next();
    }

    const start = Date.now();
    let timedOut = false;

    // 提前 5s 设警告头
    const warnTimer = warnBefore
      ? setTimeout(() => {
          if (!res.headersSent) {
            res.setHeader('X-Timeout-Warning', `${WARN_BEFORE_TIMEOUT_MS}ms`);
          }
        }, Math.max(timeoutMs - WARN_BEFORE_TIMEOUT_MS, 0))
      : null;

    // 主超时
    const timer = setTimeout(() => {
      timedOut = true;
      const elapsed = Date.now() - start;
      // 清理警告定时器
      if (warnTimer) clearTimeout(warnTimer);

      // 仅在还没响应时返回 504
      if (!res.headersSent) {
        try {
          res.setHeader('X-Timeout-Ms', String(timeoutMs));
          res.setHeader('X-Elapsed-Ms', String(elapsed));
        } catch (e) {
          // headers setHeader 失败时说明 socket 已关闭
        }
        res.status(504).json({
          success: false,
          message: '请求处理超时',
          code: 'REQUEST_TIMEOUT',
          timeoutMs,
          elapsedMs: elapsed,
          path: req.path,
        });
      }

      // 强制销毁 socket（防止 Node.js 继续等下游）
      if (req.socket && !req.socket.destroyed) {
        req.socket.destroy();
      }

      if (typeof onTimeout === 'function') {
        try { onTimeout(req, elapsed); } catch (e) { /* swallow */ }
      }
    }, timeoutMs);

    // 响应完成时清理定时器
    const clear = () => {
      if (warnTimer) clearTimeout(warnTimer);
      clearTimeout(timer);
    };
    res.once('finish', clear);
    res.once('close', clear);

    // 标记已开始计时，方便调试
    req._timeoutStartedAt = start;
    req._timeoutMs = timeoutMs;

    next();
  };
}

module.exports = requestTimeout;
