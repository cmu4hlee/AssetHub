/**
 * 模块初始化管理器
 * 负责模块的注册、初始化和生命周期管理
 */

const { getContainer, register, registerFactory } = require('../core/ServiceContainer');
const { getEventBus, subscribe, publish, SYSTEM_EVENTS } = require('../core/EventBus');
const logger = require('../config/logger');

class ModuleManager {
  constructor() {
    this.modules = new Map();
    this.initialized = false;
  }

  /**
   * 注册模块
   * @param {string} moduleId - 模块ID
   * @param {Object} moduleConfig - 模块配置
   */
  registerModule(moduleId, moduleConfig) {
    this.modules.set(moduleId, {
      config: moduleConfig,
      status: 'registered',
      services: [],
      eventHandlers: []
    });
    logger.info(`Module registered: ${moduleId}`);
  }

  /**
   * 初始化所有已注册的模块
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('Modules already initialized');
      return;
    }

    const container = getContainer();
    const eventBus = getEventBus();

    logger.info('Starting module initialization...');

    for (const [moduleId, module] of this.modules) {
      try {
        await this.initializeModule(moduleId, module, container, eventBus);
      } catch (error) {
        logger.error(`Failed to initialize module ${moduleId}:`, error);
      }
    }

    this.initialized = true;
    logger.info('All modules initialized successfully');
  }

  /**
   * 初始化单个模块
   */
  async initializeModule(moduleId, module, container, eventBus) {
    const { config } = module;

    logger.info(`Initializing module: ${moduleId}`);

    // 注册模块服务
    if (config.services) {
      for (const service of config.services) {
        const servicePath = `${moduleId}.${service.name}`;
        try {
          const ServiceClass = require(`../${service.path}`);
          container.register(servicePath, new ServiceClass());
          module.services.push(servicePath);
          logger.debug(`Service registered: ${servicePath}`);
        } catch (error) {
          logger.error(`Failed to register service ${servicePath}:`, error);
        }
      }
    }

    // 订阅模块事件
    if (config.eventHandlers) {
      for (const handler of config.eventHandlers) {
        try {
          const unsubscribe = subscribe(handler.event, handler.callback);
          module.eventHandlers.push({ event: handler.event, unsubscribe });
          logger.debug(`Event handler registered: ${handler.event}`);
        } catch (error) {
          logger.error(`Failed to register event handler for ${handler.event}:`, error);
        }
      }
    }

    module.status = 'initialized';
    logger.info(`Module initialized: ${moduleId}`);

    // 发布模块初始化完成事件
    publish(SYSTEM_EVENTS.MODULE_ENABLED, { moduleId });
  }

  /**
   * 获取模块配置
   */
  getModule(moduleId) {
    return this.modules.get(moduleId);
  }

  /**
   * 获取所有已注册的模块
   */
  getAllModules() {
    return Array.from(this.modules.entries()).map(([id, module]) => ({
      id,
      name: module.config.name,
      status: module.status,
      services: module.services
    }));
  }

  /**
   * 销毁模块
   */
  async destroy() {
    const eventBus = getEventBus();

    for (const [moduleId, module] of this.modules) {
      try {
        // 取消事件订阅
        for (const handler of module.eventHandlers) {
          handler.unsubscribe();
        }

        // 清理解散
        if (module.config.onDestroy) {
          await module.config.onDestroy();
        }

        module.status = 'destroyed';
        logger.info(`Module destroyed: ${moduleId}`);

        // 发布模块销毁事件
        publish(SYSTEM_EVENTS.MODULE_DISABLED, { moduleId });
      } catch (error) {
        logger.error(`Failed to destroy module ${moduleId}:`, error);
      }
    }

    this.modules.clear();
    this.initialized = false;
  }
}

// 全局模块管理器实例
const moduleManager = new ModuleManager();

/**
 * 获取模块管理器
 */
function getModuleManager() {
  return moduleManager;
}

/**
 * 注册模块（快捷方法）
 */
function registerModule(moduleId, moduleConfig) {
  moduleManager.registerModule(moduleId, moduleConfig);
}

/**
 * 初始化所有模块（快捷方法）
 */
async function initializeModules() {
  await moduleManager.initialize();
}

module.exports = {
  ModuleManager,
  moduleManager,
  getModuleManager,
  registerModule,
  initializeModules
};
