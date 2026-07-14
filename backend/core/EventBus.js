/**
 * 事件总线 - 模块间松耦合通信
 * 用于解耦模块间的直接依赖
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
    this.onceListeners = new Map();
    this.eventQueue = [];
    this.isProcessing = false;
    // 收集事件处理失败的信息
    this.handlerErrors = [];
    this.maxErrorHistory = 50;
    // 拦截器列表
    this.interceptors = new Map();
    // 死信队列
    this.deadLetterQueue = [];
    this.maxDLQSize = 100;
  }

  /**
   * 添加事件拦截器
   * @param {string} event - 事件名称
   * @param {Function} interceptor - 拦截器函数，返回false则阻止事件传播
   */
  addInterceptor(event, interceptor) {
    if (!this.interceptors.has(event)) {
      this.interceptors.set(event, []);
    }
    this.interceptors.get(event).push(interceptor);
  }

  /**
   * 移除事件拦截器
   * @param {string} event - 事件名称
   * @param {Function} interceptor - 拦截器函数
   */
  removeInterceptor(event, interceptor) {
    if (this.interceptors.has(event)) {
      const list = this.interceptors.get(event);
      const index = list.indexOf(interceptor);
      if (index !== -1) {
        list.splice(index, 1);
      }
    }
  }

  /**
   * 检查拦截器
   * @param {string} event - 事件名称
   * @param {any} data - 事件数据
   * @returns {boolean} - 是否允许事件传播
   */
  _checkInterceptors(event, data) {
    if (!this.interceptors.has(event)) return true;
    for (const interceptor of this.interceptors.get(event)) {
      try {
        if (interceptor(data) === false) {
          return false;
        }
      } catch (error) {
        console.error(`Interceptor error [${event}]:`, error);
      }
    }
    return true;
  }

  /**
   * 添加到死信队列
   * @param {string} event - 事件名称
   * @param {any} data - 事件数据
   * @param {Error} error - 错误对象
   */
  _addToDeadLetterQueue(event, data, error) {
    this.deadLetterQueue.push({
      event,
      data,
      error: error.message || String(error),
      timestamp: new Date().toISOString(),
    });
    if (this.deadLetterQueue.length > this.maxDLQSize) {
      this.deadLetterQueue.shift();
    }
  }

  /**
   * 获取死信队列
   * @returns {Array}
   */
  getDeadLetterQueue() {
    return [...this.deadLetterQueue];
  }

  /**
   * 订阅通配符事件（接收所有事件）
   * @param {Function} handler - 处理函数
   * @returns {Function} 取消订阅函数
   */
  onAny(handler) {
    return this.on('*', handler);
  }

  /**
   * 记录处理错误
   */
  _recordHandlerError(event, handler, error) {
    const errorInfo = {
      event,
      handlerName: handler.name || 'anonymous',
      error: error.message || String(error),
      timestamp: new Date().toISOString(),
    };
    this.handlerErrors.push(errorInfo);
    // 保持错误历史在限制内
    if (this.handlerErrors.length > this.maxErrorHistory) {
      this.handlerErrors.shift();
    }
  }

  /**
   * 获取最近的事件处理错误
   */
  getHandlerErrors() {
    return [...this.handlerErrors];
  }

  /**
   * 清除错误历史
   */
  clearHandlerErrors() {
    this.handlerErrors = [];
  }

  /**
   * 订阅事件
   * 支持两种调用方式：
   *   on(event, handler)           - 标准方式
   *   on(module, event, handler)   - 兼容旧测试的三参数方式
   * @param {string} event - 事件名称（或模块名）
   * @param {string|Function} handlerOrEvent - 处理函数或事件名
   * @param {Function} [handler] - 处理函数（三参数方式）
   * @returns {Function} 取消订阅函数
   */
  on(event, handlerOrEvent, handler) {
    // 兼容三参数调用：on(module, event, handler)
    let actualEvent = event;
    let actualHandler = handlerOrEvent;
    if (typeof handlerOrEvent === 'string' && typeof handler === 'function') {
      actualEvent = handlerOrEvent;
      actualHandler = handler;
    }

    if (!this.listeners.has(actualEvent)) {
      this.listeners.set(actualEvent, new Set());
    }
    this.listeners.get(actualEvent).add(actualHandler);

    return () => this.off(actualEvent, actualHandler);
  }

  /**
   * 订阅一次性事件
   * 支持两种调用方式：
   *   once(event, handler)           - 标准方式
   *   once(module, event, handler)   - 兼容旧测试的三参数方式
   * @param {string} event - 事件名称（或模块名）
   * @param {string|Function} handlerOrEvent - 处理函数或事件名
   * @param {Function} [handler] - 处理函数（三参数方式）
   */
  once(event, handlerOrEvent, handler) {
    // 兼容三参数调用：once(module, event, handler)
    let actualEvent = event;
    let actualHandler = handlerOrEvent;
    if (typeof handlerOrEvent === 'string' && typeof handler === 'function') {
      actualEvent = handlerOrEvent;
      actualHandler = handler;
    }

    if (!this.onceListeners.has(actualEvent)) {
      this.onceListeners.set(actualEvent, new Set());
    }
    this.onceListeners.get(actualEvent).add(actualHandler);
  }

  /**
   * 取消订阅
   * @param {string} event - 事件名称
   * @param {Function} handler - 处理函数
   */
  off(event, handler) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(handler);
    }
    if (this.onceListeners.has(event)) {
      this.onceListeners.get(event).delete(handler);
    }
  }

  /**
   * 触发事件（同步）
   * 支持两种调用方式：
   *   emit(event, data)           - 标准方式
   *   emit(module, event, data)   - 兼容旧测试的三参数方式
   * @param {string} event - 事件名称（或模块名）
   * @param {any} dataOrEvent - 事件数据或事件名
   * @param {any} [data] - 事件数据（三参数方式）
   * @returns {any}
   */
  /**
   * 发布事件（publish 别名，兼容旧接口：getEventBus().publish(event, data)）
   * @param {string} event - 事件名称
   * @param {any} data - 事件数据
   * @returns {any}
   */
  publish(event, data) {
    return this.emit(event, data);
  }

  emit(event, dataOrEvent, data, metadata) {
    let actualEvent = event;
    let actualData = dataOrEvent;
    let actualMetadata = null;
    if (arguments.length >= 3) {
      actualEvent = dataOrEvent;
      actualData = data;
    }
    if (arguments.length >= 4) {
      actualMetadata = metadata;
    }

    // 检查拦截器
    if (!this._checkInterceptors(actualEvent, actualData)) {
      return false;
    }

    const results = [];
    const errors = [];

    // 触发通配符监听器
    if (this.listeners.has('*')) {
      for (const handler of this.listeners.get('*')) {
        try {
          handler({ event: actualEvent, data: actualData });
        } catch (error) {
          console.error(`Wildcard handler error [${actualEvent}]:`, error);
        }
      }
    }

    if (this.listeners.has(actualEvent)) {
      for (const handler of this.listeners.get(actualEvent)) {
        try {
          // 第 4 个参数 metadata（如 req）合并到 payload._meta，handler 可读 _meta.req
          const enrichedData = actualMetadata
            ? { ...actualData, _meta: actualMetadata }
            : actualData;
          results.push(handler(enrichedData));
        } catch (error) {
          this._recordHandlerError(actualEvent, handler, error);
          this._addToDeadLetterQueue(actualEvent, actualData, error);
          console.error(`Event handler error [${actualEvent}]:`, error);
          errors.push(error);
        }
      }
    }

    if (this.onceListeners.has(actualEvent)) {
      for (const handler of this.onceListeners.get(actualEvent)) {
        try {
          results.push(handler(actualData));
        } catch (error) {
          this._recordHandlerError(actualEvent, handler, error);
          this._addToDeadLetterQueue(actualEvent, actualData, error);
          console.error(`Once event handler error [${actualEvent}]:`, error);
          errors.push(error);
        }
      }
      this.onceListeners.delete(actualEvent);
    }

    // 如果有任何错误，抛出聚合错误
    if (errors.length > 0) {
      const aggregateError = new Error(`Event [${actualEvent}] had ${errors.length} handler error(s)`);
      aggregateError.errors = errors;
      aggregateError.event = actualEvent;
      results.push({ __error__: aggregateError });
    }

    return results;
  }

  /**
   * 触发事件（异步）
   * @param {string} event - 事件名称
   * @param {any} data - 事件数据
   */
  async emitAsync(event, data) {
    // 检查拦截器
    if (!this._checkInterceptors(event, data)) {
      return false;
    }

    const results = [];
    const errors = [];

    // 触发通配符监听器
    if (this.listeners.has('*')) {
      for (const handler of this.listeners.get('*')) {
        try {
          await Promise.resolve(handler({ event, data }));
        } catch (error) {
          console.error(`Wildcard async handler error [${event}]:`, error);
        }
      }
    }

    if (this.listeners.has(event)) {
      for (const handler of this.listeners.get(event)) {
        try {
          results.push(await Promise.resolve(handler(data)));
        } catch (error) {
          this._recordHandlerError(event, handler, error);
          this._addToDeadLetterQueue(event, data, error);
          console.error(`Async event handler error [${event}]:`, error);
          errors.push(error);
        }
      }
    }

    if (this.onceListeners.has(event)) {
      for (const handler of this.onceListeners.get(event)) {
        try {
          results.push(await Promise.resolve(handler(data)));
        } catch (error) {
          this._recordHandlerError(event, handler, error);
          this._addToDeadLetterQueue(event, data, error);
          console.error(`Once async event handler error [${event}]:`, error);
          errors.push(error);
        }
      }
      this.onceListeners.delete(event);
    }

    // 如果有任何错误，抛出聚合错误
    if (errors.length > 0) {
      const aggregateError = new Error(`Event [${event}] had ${errors.length} handler error(s)`);
      aggregateError.errors = errors;
      aggregateError.event = event;
      results.push({ __error__: aggregateError });
    }

    return results;
  }

  /**
   * 清除所有监听器
   * @param {string} event - 事件名称（可选）
   */
  clear(event) {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  /**
   * 获取事件监听器数量
   * @param {string} event - 事件名称
   * @returns {number}
   */
  listenerCount(event) {
    const normalCount = this.listeners.has(event) ? this.listeners.get(event).size : 0;
    const onceCount = this.onceListeners.has(event) ? this.onceListeners.get(event).size : 0;
    return normalCount + onceCount;
  }

  /**
   * 获取所有已订阅的事件
   * @returns {string[]}
   */
  eventNames() {
    return Array.from(new Set([
      ...Array.from(this.listeners.keys()),
      ...Array.from(this.onceListeners.keys())
    ]));
  }
}

// 定义系统事件
const SYSTEM_EVENTS = {
  // 资产相关事件
  ASSET_CREATED: 'asset:created',
  ASSET_UPDATED: 'asset:updated',
  ASSET_DELETED: 'asset:deleted',
  ASSET_STATUS_CHANGED: 'asset:status-changed',
  ASSET_TRANSFERRED: 'asset:transferred',

  // 维修相关事件
  MAINTENANCE_CREATED: 'maintenance:created',
  MAINTENANCE_COMPLETED: 'maintenance:completed',
  MAINTENANCE_APPROVED: 'maintenance:approved',
  MAINTENANCE_REQUEST_APPROVED: 'maintenance_request:approved',
  MAINTENANCE_REQUEST_REJECTED: 'maintenance_request:rejected',

  // 预防性维护相关事件
  MAINTENANCE_PLAN_REMINDER: 'maintenance_plan:reminder',

  // 盘点相关事件
  INVENTORY_STARTED: 'inventory:started',
  INVENTORY_COMPLETED: 'inventory:completed',
  INVENTORY_DISCREPANCY: 'inventory:discrepancy',

  // 质量相关事件
  QUALITY_CONTROL_CREATED: 'quality:control-created',
  QUALITY_CONTROL_COMPLETED: 'quality:control-completed',
  METROLOGY_EXPIRING: 'quality:metrology-expiring',

  // IoT相关事件
  IOT_DEVICE_ONLINE: 'iot:device-online',
  IOT_DEVICE_OFFLINE: 'iot:device-offline',
  IOT_ALERT_TRIGGERED: 'iot:alert-triggered',

  // 用户相关事件
  USER_LOGIN: 'user:login',
  USER_LOGOUT: 'user:logout',

  // 模块事件
  MODULE_ENABLED: 'module:enabled',
  MODULE_DISABLED: 'module:disabled',
};

// 全局事件总线实例
const globalEventBus = new EventBus();

/**
 * 获取全局事件总线
 * @returns {EventBus}
 */
function getEventBus() {
  return globalEventBus;
}

/**
 * 发布事件（快捷方法）
 * @param {string} event - 事件名称
 * @param {any} data - 事件数据
 */
function publish(event, data) {
  return globalEventBus.emit(event, data);
}

/**
 * 发布异步事件（快捷方法）
 * @param {string} event - 事件名称
 * @param {any} data - 事件数据
 */
async function publishAsync(event, data) {
  return globalEventBus.emitAsync(event, data);
}

/**
 * 订阅事件（快捷方法）
 * @param {string} event - 事件名称
 * @param {Function} handler - 处理函数
 * @returns {Function} 取消订阅函数
 */
function subscribe(event, handler) {
  return globalEventBus.on(event, handler);
}

/**
 * 订阅一次性事件（快捷方法）
 * @param {string} event - 事件名称
 * @param {Function} handler - 处理函数
 */
function subscribeOnce(event, handler) {
  globalEventBus.once(event, handler);
}

/**
 * 模块事件订阅管理器
 * 为每个模块维护独立的事件订阅列表，模块卸载时自动清理
 */
class ModuleEventManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.moduleSubscriptions = new Map();
  }

  /**
   * 为模块订阅事件
   * @param {string} moduleId - 模块ID
   * @param {string} event - 事件名称
   * @param {Function} handler - 处理函数
   * @returns {Function} 取消订阅函数
   */
  subscribe(moduleId, event, handler) {
    if (!this.moduleSubscriptions.has(moduleId)) {
      this.moduleSubscriptions.set(moduleId, []);
    }

    const unsubscribe = this.eventBus.on(event, handler);
    this.moduleSubscriptions.get(moduleId).push({ event, unsubscribe });

    return () => {
      this.unsubscribe(moduleId, event, unsubscribe);
    };
  }

  /**
   * 取消模块的某个事件订阅
   * @param {string} moduleId - 模块ID
   * @param {string} event - 事件名称
   * @param {Function} unsubscribe - 取消订阅函数
   */
  unsubscribe(moduleId, event, unsubscribe) {
    const subs = this.moduleSubscriptions.get(moduleId);
    if (subs) {
      const index = subs.findIndex(s => s.event === event && s.unsubscribe === unsubscribe);
      if (index !== -1) {
        subs[index].unsubscribe();
        subs.splice(index, 1);
      }
    }
  }

  /**
   * 清理模块的所有事件订阅
   * @param {string} moduleId - 模块ID
   */
  clearModule(moduleId) {
    const subs = this.moduleSubscriptions.get(moduleId);
    if (subs) {
      subs.forEach(({ unsubscribe }) => unsubscribe());
      this.moduleSubscriptions.delete(moduleId);
    }
  }

  /**
   * 获取模块的订阅数量
   * @param {string} moduleId - 模块ID
   * @returns {number}
   */
  getSubscriptionCount(moduleId) {
    const subs = this.moduleSubscriptions.get(moduleId);
    return subs ? subs.length : 0;
  }
}

// 全局模块事件管理器
const moduleEventManager = new ModuleEventManager(globalEventBus);

/**
 * 获取全局事件总线实例（兼容旧接口）
 * @returns {EventBus}
 */
function getInstance() {
  return globalEventBus;
}

module.exports = {
  EventBus,
  globalEventBus,
  getEventBus,
  getInstance,
  publish,
  publishAsync,
  subscribe,
  subscribeOnce,
  SYSTEM_EVENTS,
  ModuleEventManager,
  moduleEventManager,
};
