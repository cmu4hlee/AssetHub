/**
 * 请求上下文（基于 AsyncLocalStorage）
 *
 * 用途：
 *   在 HTTP 请求生命周期内共享 req 对象，使异步代码（包括事件回调、
 *   定时任务）能够获取到触发它们的原始请求上下文（特别是 req.protocol、
 *   req.headers['host']、X-Forwarded-* 头），用于推断外网可访问的 URL。
 *
 * 用法：
 *   // server.js 入口
 *   const requestContext = require('./middleware/requestContext');
 *   app.use(requestContext.middleware());
 *
 *   // 任意地方
 *   const req = requestContext.getRequest();
 *   console.log(req?.protocol, req?.get('host'));
 *
 *   // 测试/特殊场景：手动注入 req
 *   await requestContext.runWith(req, async () => { ... });
 */
const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

function middleware() {
  return (req, res, next) => {
    asyncLocalStorage.run({ req, startTime: Date.now() }, () => {
      // 把 req 挂到 req 对象本身，方便显式访问
      req.requestContext = {
        getRequest: () => asyncLocalStorage.getStore()?.req,
      };
      next();
    });
  };
}

function getRequest() {
  return asyncLocalStorage.getStore()?.req || null;
}

function getHeaders() {
  const req = getRequest();
  return req ? req.headers : null;
}

function getProtocol() {
  const req = getRequest();
  if (!req) return null;
  // 优先 X-Forwarded-Proto
  const fwd = req.get?.('x-forwarded-proto');
  if (fwd) return fwd.split(',')[0].trim();
  return req.protocol;
}

function getHost() {
  const req = getRequest();
  if (!req) return null;
  // 优先 X-Forwarded-Host
  const fwdHost = req.get?.('x-forwarded-host');
  if (fwdHost) return fwdHost.split(',')[0].trim();
  return req.get?.('host') || req.headers?.host || null;
}

/**
 * 在指定 req 上下文中执行回调（用于测试或非 HTTP 入口）
 * @param {object} req Express req 对象
 * @param {Function} callback 异步回调
 */
async function runWith(req, callback) {
  return asyncLocalStorage.run({ req, startTime: Date.now() }, callback);
}

module.exports = {
  middleware,
  getRequest,
  getHeaders,
  getProtocol,
  getHost,
  runWith,
  // 内部使用：测试时直接访问 AsyncLocalStorage 实例
  _asyncLocalStorage: asyncLocalStorage,
};