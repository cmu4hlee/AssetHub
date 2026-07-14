/**
 * 服务容器 - 依赖注入实现
 * 用于模块间的松耦合服务调用
 * 支持模块级子容器隔离
 */

const logger = require('../config/logger');

class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
    this.instances = new Map();
    this.parent = null;
    this.moduleName = null;
    this.childContainers = new Map();
  }

  /**
   * 注册服务（单例模式）
   * @param {string} name - 服务名称
   * @param {any} service - 服务实例或类
   * @param {Object} options - 可选配置
   * @param {boolean} options.singleton - 是否单例（默认true）
   */
  register(name, service, options = {}) {
    if (typeof service === 'function') {
      this.factories.set(name, service);
      // 标记为单例，首次解析时缓存（默认单例）
      if (options.singleton !== false) {
        this._singletonFactories = this._singletonFactories || new Set();
        this._singletonFactories.add(name);
      }
    } else {
      this.services.set(name, service);
      this.instances.set(name, service);
    }
  }

  /**
   * 注册服务实例（直接注册对象实例）
   * @param {string} name - 服务名称
   * @param {any} instance - 服务实例
   */
  registerInstance(name, instance) {
    this.services.set(name, instance);
    this.instances.set(name, instance);
  }

  /**
   * 注册服务工厂（每次解析都创建新实例）
   * @param {string} name - 服务名称
   * @param {Function} factory - 工厂函数
   */
  registerFactory(name, factory) {
    this.factories.set(name, factory);
  }

  /**
   * 解析服务
   * 子容器优先查找自己的服务，找不到时递归查找父容器
   * @param {string} name - 服务名称
   * @returns {any} 服务实例
   */
  resolve(name) {
    // 检测循环依赖
    if (!this._resolving) this._resolving = new Set();
    if (this._resolving.has(name)) {
      throw new Error('Circular dependency detected');
    }

    this._resolving.add(name);
    try {
      // 1. 先查找当前容器
      if (this.services.has(name)) {
        return this.services.get(name);
      }

      if (this.factories.has(name)) {
        const factory = this.factories.get(name);
        const instance = factory(this);
        // 单例工厂：缓存实例
        if (this._singletonFactories && this._singletonFactories.has(name)) {
          this.services.set(name, instance);
          this.instances.set(name, instance);
        }
        return instance;
      }

      // 2. 递归查找父容器
      if (this.parent) {
        return this.parent.resolve(name);
      }

      throw new Error(`Service '${name}' is not registered`);
    } finally {
      this._resolving.delete(name);
    }
  }

  /**
   * 获取服务实例（单例模式）
   * @param {string} name - 服务名称
   * @returns {any} 服务实例
   */
  get(name) {
    return this.resolve(name);
  }

  /**
   * 检查服务是否存在（含父容器）
   * @param {string} name - 服务名称
   * @returns {boolean}
   */
  has(name) {
    if (this.services.has(name) || this.factories.has(name)) {
      return true;
    }
    if (this.parent) {
      return this.parent.has(name);
    }
    return false;
  }

  /**
   * 清除服务实例
   * @param {string} name - 服务名称
   */
  clear(name) {
    if (name) {
      this.services.delete(name);
      this.instances.delete(name);
      this.factories.delete(name);
    } else {
      this.services.clear();
      this.instances.clear();
      this.factories.clear();
    }
  }

  /**
   * 获取所有已注册的服务名称（含父容器）
   * @returns {string[]}
   */
  getRegisteredServices() {
    const local = new Set([
      ...Array.from(this.services.keys()),
      ...Array.from(this.factories.keys())
    ]);

    if (this.parent) {
      const parent = this.parent.getRegisteredServices();
      parent.forEach(s => local.add(s));
    }

    return Array.from(local);
  }

  /**
   * 创建模块级别的服务容器
   * 子容器继承父容器服务，但自己的服务修改不影响父容器
   * @param {string} moduleName - 模块名称
   * @returns {ServiceContainer}
   */
  createChildContainer(moduleName) {
    if (this.childContainers.has(moduleName)) {
      logger.warn(`子容器已存在: ${moduleName}，返回现有实例`);
      return this.childContainers.get(moduleName);
    }

    const child = new ServiceContainer();
    child.parent = this;
    child.moduleName = moduleName;
    this.childContainers.set(moduleName, child);

    logger.info(`模块服务容器已创建: ${moduleName}`);
    return child;
  }

  /**
   * 获取模块子容器
   * @param {string} moduleName - 模块名称
   * @returns {ServiceContainer|null}
   */
  getChildContainer(moduleName) {
    return this.childContainers.get(moduleName) || null;
  }

  /**
   * 销毁模块子容器
   * @param {string} moduleName - 模块名称
   */
  destroyChildContainer(moduleName) {
    const child = this.childContainers.get(moduleName);
    if (child) {
      child.clear();
      this.childContainers.delete(moduleName);
      logger.info(`模块服务容器已销毁: ${moduleName}`);
    }
  }

  /**
   * 获取所有子容器名称
   * @returns {string[]}
   */
  getChildContainerNames() {
    return Array.from(this.childContainers.keys());
  }

  /**
   * 列出所有已注册的服务
   * @returns {Object} { factories: string[], instances: string[] }
   */
  listServices() {
    return {
      factories: Array.from(this.factories.keys()),
      instances: Array.from(this.instances.keys()),
    };
  }

  /**
   * 销毁所有服务（调用dispose方法）
   */
  async disposeAll() {
    for (const [name, instance] of this.instances) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          await instance.dispose();
        } catch (error) {
          logger.error(`销毁服务 ${name} 失败:`, error.message);
        }
      }
    }
    this.clear();
  }
}

// 全局服务容器实例
const globalContainer = new ServiceContainer();

/**
 * 获取全局服务容器
 * @returns {ServiceContainer}
 */
function getContainer() {
  return globalContainer;
}

/**
 * 解析服务（快捷方法）
 * @param {string} name - 服务名称
 * @returns {any}
 */
function resolve(name) {
  return globalContainer.resolve(name);
}

/**
 * 注册服务（快捷方法）
 * @param {string} name - 服务名称
 * @param {any} service - 服务实例或类
 */
function register(name, service) {
  globalContainer.register(name, service);
}

/**
 * 注册服务工厂（快捷方法）
 * @param {string} name - 服务名称
 * @param {Function} factory - 工厂函数
 */
function registerFactory(name, factory) {
  globalContainer.registerFactory(name, factory);
}

/**
 * 获取全局服务容器实例（兼容旧接口）
 * @returns {ServiceContainer}
 */
function getInstance() {
  return globalContainer;
}

/**
 * 重置全局服务容器实例（兼容旧接口）
 */
function resetInstance() {
  globalContainer.clear();
}

module.exports = {
  ServiceContainer,
  globalContainer,
  getContainer,
  getInstance,
  resetInstance,
  resolve,
  register,
  registerFactory
};
