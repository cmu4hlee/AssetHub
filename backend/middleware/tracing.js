/**
 * 请求链路追踪中间件 (traceId)
 *
 * 功能:
 * 1. 读 X-Trace-Id 头, 或生成新 traceId (uuid v4)
 * 2. 把 traceId 注入 req (req.traceId) 和 res (X-Trace-Id 响应头)
 * 3. 用 logger.child({ traceId, requestId, userId, tenantId }) 绑定, 整个请求链日志都有 traceId
 *
 * 用法:
 *   const { traceMiddleware, withTrace } = require('./middleware/tracing');
 *   app.use(traceMiddleware);  // 全局
 *   router.get('/foo', (req, res) => {
 *     req.log.info('处理 foo');  // 自动带 traceId
 *   });
 */

const { randomUUID } = require('crypto');
const logger = require('../config/logger');

const TRACE_HEADER = 'x-trace-id';
const REQUEST_HEADER = 'x-request-id';
const TRACE_ID_REGEX = /^[a-zA-Z0-9_-]{8,128}$/;

function generateTraceId() {
  return randomUUID().replace(/-/g, '').slice(0, 24);
}

function traceMiddleware() {
  return (req, res, next) => {
    // 优先读客户端传的头, 否则生成
    const incoming = req.headers[TRACE_HEADER] || req.headers[REQUEST_HEADER];
    const traceId = (typeof incoming === 'string' && TRACE_ID_REGEX.test(incoming))
      ? incoming
      : generateTraceId();
    const requestId = generateTraceId();

    // 注入 req
    req.traceId = traceId;
    req.requestId = requestId;

    // 注入 res 头 (浏览器能看到, 排查用)
    res.setHeader('X-Trace-Id', traceId);
    res.setHeader('X-Request-Id', requestId);

    // 绑定 userId/tenantId (auth 中间件后才设)
    const userId = req.user?.id;
    const tenantId = req.user?.tenant_id;

    // 创建 child logger, 所有日志自动带 traceId
    req.log = logger.child({
      traceId,
      requestId,
      ...(userId && { userId }),
      ...(tenantId && { tenantId }),
    });

    // 响应结束时记录 request 完成
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      req.log.request(req, duration);
    });

    next();
  };
}

/**
 * 在某个 handler 中用 req.log 替代 logger, 自动带 traceId
 * 例: req.log.info('处理完成')
 */
function withTrace(req) {
  return req.log || logger;
}

module.exports = {
  traceMiddleware,
  withTrace,
  generateTraceId,
  TRACE_HEADER,
  REQUEST_HEADER,
};
