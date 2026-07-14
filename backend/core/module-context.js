/**
 * 模块上下文（基于 AsyncLocalStorage）
 *
 * 在请求中间件层设置 moduleId，通过 AsyncLocalStorage 自动传播到
 * service / controller / database 等下层调用，无需逐层透传 req 对象。
 *
 * 用途：
 * 1. 数据库层按模块统计活跃连接、执行连接配额隔离
 * 2. 数据访问守卫按模块审计跨模块表访问
 * 3. 日志按模块打标签
 */

const { AsyncLocalStorage } = require('async_hooks');

const moduleLocalStorage = new AsyncLocalStorage();

/**
 * 在模块上下文中执行回调
 * @param {string} moduleId - 模块ID
 * @param {Function} callback - 回调函数
 * @param {*} [args] - 透传给回调的参数
 * @returns {*} 回调返回值
 */
function runInModuleContext(moduleId, callback, ...args) {
  return moduleLocalStorage.run({ moduleId, startTime: Date.now() }, callback, ...args);
}

/**
 * 获取当前模块ID（从 AsyncLocalStorage 读取）
 * @returns {string|null}
 */
function getCurrentModuleId() {
  const store = moduleLocalStorage.getStore();
  return store?.moduleId || null;
}

/**
 * 获取当前模块上下文信息
 * @returns {Object|null}
 */
function getModuleContext() {
  return moduleLocalStorage.getStore() || null;
}

module.exports = {
  moduleLocalStorage,
  runInModuleContext,
  getCurrentModuleId,
  getModuleContext,
};
