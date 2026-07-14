/**
 * 模块注册中心
 *
 * 管理所有业务模块的注册、初始化和依赖关系。
 * 确保模块间通过事件进行松耦合通信，而不是直接依赖。
 */

const EventEmitter = require('events');
const logger = require('../config/logger');

class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.eventBus = new EventEmitter();
    this.initialized = false;
  }

  /**
   * 注册模块
   *
   * @param {string} name - 模块名称
   * @param {Object} module - 模块实例
   * @param {Object} options - 注册选项
   */
  register(name, module, options = {}) {
    if (this.modules.has(name)) {
      logger.warn(`模块 ${name} 已注册，将被覆盖`);
    }

    this.modules.set(name, {
      instance: module,
      config: options.config || {},
      dependencies: options.dependencies || [],
      enabled: options.enabled !== false,
      initialized: false,
    });

    logger.info(`模块已注册: ${name}`);
  }

  /**
   * 获取模块实例
   *
   * @param {string} name - 模块名称
   * @returns {Object|null} 模块实例
   */
  get(name) {
    const entry = this.modules.get(name);
    return entry?.enabled ? entry.instance : null;
  }

  /**
   * 检查模块是否已注册
   *
   * @param {string} name - 模块名称
   * @returns {boolean}
   */
  has(name) {
    const entry = this.modules.get(name);
    return entry?.enabled === true;
  }

  /**
   * 获取所有已注册的模块名称
   *
   * @returns {string[]}
   */
  getModuleNames() {
    return Array.from(this.modules.entries())
      .filter(([, entry]) => entry.enabled)
      .map(([name]) => name);
  }

  /**
   * 验证模块依赖关系
   *
   * @returns {Object} 验证结果
   */
  validateDependencies() {
    const errors = [];
    for (const [name, entry] of this.modules) {
      if (!entry.enabled) continue;

      for (const dep of entry.dependencies) {
        if (!this.has(dep)) {
          errors.push({
            module: name,
            missingDependency: dep,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 初始化所有模块
   *
   * @returns {Promise<void>}
   */
  async initializeAll() {
    if (this.initialized) {
      logger.warn('模块注册表已初始化');
      return;
    }

    const validation = this.validateDependencies();
    if (!validation.valid) {
      throw new Error(`模块依赖验证失败: ${JSON.stringify(validation.errors)}`);
    }

    // 按依赖顺序初始化
    const order = this.topologicalSort();

    for (const name of order) {
      const entry = this.modules.get(name);
      if (!entry.enabled || entry.initialized) continue;

      try {
        const module = entry.instance;
        if (module.initialize) {
          await module.initialize(entry.config);
        }
        entry.initialized = true;
        logger.info(`模块初始化成功: ${name}`);
      } catch (error) {
        logger.error(`模块初始化失败: ${name}`, error);
        throw error;
      }
    }

    this.initialized = true;
    logger.info('所有模块初始化完成');
  }

  /**
   * 停止所有模块
   *
   * @returns {Promise<void>}
   */
  async stopAll() {
    if (!this.initialized) {
      return;
    }

    // 按依赖逆序停止
    const order = this.topologicalSort().reverse();

    for (const name of order) {
      const entry = this.modules.get(name);
      if (!entry.initialized) continue;

      try {
        const module = entry.instance;
        if (module.stop) {
          await module.stop();
        }
        entry.initialized = false;
        logger.info(`模块已停止: ${name}`);
      } catch (error) {
        logger.error(`模块停止失败: ${name}`, error);
      }
    }

    this.initialized = false;
    logger.info('所有模块已停止');
  }

  /**
   * 触发模块事件
   *
   * @param {string} moduleName - 模块名称
   * @param {string} eventName - 事件名称
   * @param {Object} payload - 事件数据
   */
  emitEvent(moduleName, eventName, payload) {
    const fullEventName = `${moduleName}:${eventName}`;
    this.eventBus.emit(fullEventName, payload);
    this.eventBus.emit('*', { module: moduleName, event: eventName, payload });
  }

  /**
   * 监听模块事件
   *
   * @param {string} moduleName - 模块名称
   * @param {string} eventName - 事件名称
   * @param {Function} handler - 事件处理函数
   */
  onEvent(moduleName, eventName, handler) {
    const fullEventName = `${moduleName}:${eventName}`;
    this.eventBus.on(fullEventName, handler);
  }

  /**
   * 移除事件监听
   *
   * @param {string} moduleName - 模块名称
   * @param {string} eventName - 事件名称
   * @param {Function} handler - 事件处理函数
   */
  offEvent(moduleName, eventName, handler) {
    const fullEventName = `${moduleName}:${eventName}`;
    this.eventBus.off(fullEventName, handler);
  }

  /**
   * 拓扑排序（确定模块初始化顺序）
   *
   * @returns {string[]} 模块名称列表
   */
  topologicalSort() {
    const visited = new Set();
    const result = [];

    const visit = (name) => {
      if (visited.has(name)) return;
      visited.add(name);

      const entry = this.modules.get(name);
      if (!entry) return;

      for (const dep of entry.dependencies) {
        visit(dep);
      }

      result.push(name);
    };

    for (const [name] of this.modules) {
      visit(name);
    }

    return result;
  }

  /**
   * 获取模块状态
   *
   * @returns {Object} 模块状态信息
   */
  getStatus() {
    const status = {};
    for (const [name, entry] of this.modules) {
      status[name] = {
        enabled: entry.enabled,
        initialized: entry.initialized,
        dependencies: entry.dependencies,
      };
    }
    return status;
  }
}

// 创建全局单例
const moduleRegistry = new ModuleRegistry();

module.exports = moduleRegistry;
