const { AppError } = require('../utils/error-handler');
const logger = require('../config/logger');

class BaseService {
  constructor(options = {}) {
    this._name = options.name || this.constructor.name;
    this._db = options.db || null;
    this._cacheService = options.cacheService || null;
    this._eventBus = options.eventBus || null;
    this._initialized = false;
  }

  get name() {
    return this._name;
  }

  get isInitialized() {
    return this._initialized;
  }

  async initialize() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;
    logger.info(`[Service] ${this._name} 初始化完成`);
  }

  async dispose() {
    this._initialized = false;
    logger.info(`[Service] ${this._name} 已释放`);
  }

  async query(sql, params, options = {}) {
    if (!this._db) {
      throw new AppError(`Service "${this._name}" 数据库接口未注入`, 500, 'DB_NOT_INJECTED');
    }
    return this._db.query(sql, params, options);
  }

  async execute(sql, params, options = {}) {
    if (!this._db) {
      throw new AppError(`Service "${this._name}" 数据库接口未注入`, 500, 'DB_NOT_INJECTED');
    }
    return this._db.execute(sql, params, options);
  }

  async transaction(callback, options = {}) {
    if (!this._db) {
      throw new AppError(`Service "${this._name}" 数据库接口未注入`, 500, 'DB_NOT_INJECTED');
    }
    return this._db.transaction(callback, options);
  }

  async findOne(sql, params) {
    if (!this._db) {
      throw new AppError(`Service "${this._name}" 数据库接口未注入`, 500, 'DB_NOT_INJECTED');
    }
    return this._db.findOne(sql, params);
  }

  async findMany(sql, params) {
    if (!this._db) {
      throw new AppError(`Service "${this._name}" 数据库接口未注入`, 500, 'DB_NOT_INJECTED');
    }
    return this._db.findMany(sql, params);
  }

  async paginate(sql, params, options = {}) {
    if (!this._db) {
      throw new AppError(`Service "${this._name}" 数据库接口未注入`, 500, 'DB_NOT_INJECTED');
    }
    return this._db.paginate(sql, params, options);
  }

  async cacheGet(key) {
    if (!this._cacheService) return null;
    try {
      return await this._cacheService.get(key);
    } catch (error) {
      logger.warn(`[Service] ${this._name} 缓存读取失败: ${error.message}`);
      return null;
    }
  }

  async cacheSet(key, value, ttl = 3600) {
    if (!this._cacheService) return false;
    try {
      return await this._cacheService.set(key, value, ttl);
    } catch (error) {
      logger.warn(`[Service] ${this._name} 缓存写入失败: ${error.message}`);
      return false;
    }
  }

  async cacheDelete(key) {
    if (!this._cacheService) return false;
    try {
      return await this._cacheService.delete(key);
    } catch (error) {
      logger.warn(`[Service] ${this._name} 缓存删除失败: ${error.message}`);
      return false;
    }
  }

  emitEvent(eventName, payload, metadata = {}) {
    if (!this._eventBus) {
      logger.warn(`[Service] ${this._name} 事件总线未注入，无法发送事件: ${eventName}`);
      return;
    }
    this._eventBus.emit(this._name, eventName, payload, metadata);
  }

  onEvent(sourceModule, eventName, handler) {
    if (!this._eventBus) {
      logger.warn(`[Service] ${this._name} 事件总线未注入，无法监听事件: ${eventName}`);
      return () => {};
    }
    return this._eventBus.on(sourceModule, eventName, handler);
  }
}

module.exports = BaseService;
