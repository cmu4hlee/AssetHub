/**
 * 模块配置管理器
 *
 * 提供模块独立的配置管理能力，支持：
 * 1. 默认配置
 * 2. 环境变量覆盖
 * 3. 自定义配置文件覆盖
 * 4. 配置验证
 * 5. 热更新
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');

class ModuleConfigManager {
  constructor() {
    this.configs = new Map();
    this.watchers = new Map();
    this.configDir = path.join(__dirname, '../../config/modules');
  }

  /**
   * 注册模块配置
   *
   * @param {string} moduleName - 模块名称
   * @param {Object} defaultConfig - 默认配置
   * @param {Object} validationSchema - 验证规则
   */
  register(moduleName, defaultConfig = {}, validationSchema = {}) {
    this.configs.set(moduleName, {
      defaults: defaultConfig,
      validation: validationSchema,
      current: null,
      watchers: [],
    });
  }

  /**
   * 获取模块配置
   *
   * @param {string} moduleName - 模块名称
   * @param {string} key - 配置键（点号分隔的路径）
   * @param {any} defaultValue - 默认值
   * @returns {any} 配置值
   */
  get(moduleName, key = null, defaultValue = null) {
    const config = this.configs.get(moduleName);
    if (!config || !config.current) {
      return defaultValue;
    }

    if (!key) {
      return config.current;
    }

    const keys = key.split('.');
    let value = config.current;
    for (const k of keys) {
      if (value === null || value === undefined) {
        return defaultValue;
      }
      value = value[k];
    }

    return value !== undefined ? value : defaultValue;
  }

  /**
   * 更新模块配置
   *
   * @param {string} moduleName - 模块名称
   * @param {Object} updates - 更新内容
   * @returns {boolean} 是否更新成功
   */
  set(moduleName, updates) {
    const config = this.configs.get(moduleName);
    if (!config) {
      logger.warn(`模块 ${moduleName} 未注册配置`);
      return false;
    }

    // 合并配置
    config.current = this.deepMerge(config.current, updates);

    // 验证配置
    if (!this.validate(moduleName)) {
      logger.error(`模块 ${moduleName} 配置验证失败`);
      return false;
    }

    // 通知监听器
    this.notifyWatchers(moduleName, config.current);

    logger.info(`模块配置已更新: ${moduleName}`);
    return true;
  }

  /**
   * 加载模块配置
   *
   * 加载顺序：默认配置 < 环境变量 < 配置文件
   *
   * @param {string} moduleName - 模块名称
   * @returns {Promise<Object>} 加载后的配置
   */
  async load(moduleName) {
    const config = this.configs.get(moduleName);
    if (!config) {
      throw new Error(`模块 ${moduleName} 未注册配置`);
    }

    // 1. 从默认配置开始
    let merged = this.deepClone(config.defaults);

    // 2. 环境变量覆盖
    merged = this.applyEnvironmentOverrides(moduleName, merged);

    // 3. 配置文件覆盖
    merged = await this.applyConfigFileOverrides(moduleName, merged);

    // 4. 验证配置
    if (!this.validateConfig(merged, config.validation)) {
      throw new Error(`模块 ${moduleName} 配置验证失败`);
    }

    config.current = merged;
    logger.info(`模块配置已加载: ${moduleName}`);
    return merged;
  }

  /**
   * 重新加载所有模块配置
   *
   * @returns {Promise<void>}
   */
  async reloadAll() {
    for (const moduleName of this.configs.keys()) {
      try {
        await this.load(moduleName);
      } catch (error) {
        logger.error(`重新加载模块配置失败: ${moduleName}`, error);
      }
    }
  }

  /**
   * 监听配置变化
   *
   * @param {string} moduleName - 模块名称
   * @param {Function} callback - 回调函数
   */
  watch(moduleName, callback) {
    const config = this.configs.get(moduleName);
    if (!config) {
      logger.warn(`模块 ${moduleName} 未注册配置`);
      return;
    }
    config.watchers.push(callback);
  }

  /**
   * 获取配置状态
   *
   * @returns {Object}
   */
  getStatus() {
    const status = {};
    for (const [name, config] of this.configs) {
      status[name] = {
        loaded: config.current !== null,
        hasValidation: Object.keys(config.validation).length > 0,
        watchers: config.watchers.length,
      };
    }
    return status;
  }

  /**
   * 验证模块配置
   *
   * @param {string} moduleName - 模块名称
   * @returns {boolean}
   */
  validate(moduleName) {
    const config = this.configs.get(moduleName);
    if (!config || !config.current) {
      return false;
    }
    return this.validateConfig(config.current, config.validation);
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 应用环境变量覆盖
   */
  applyEnvironmentOverrides(moduleName, config) {
    const prefix = `MODULE_${moduleName.toUpperCase()}_`;

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key.substring(prefix.length)
          .toLowerCase()
          .replace(/_/g, '.');

        this.setNestedValue(config, configKey, this.parseEnvValue(value));
      }
    }

    return config;
  }

  /**
   * 应用配置文件覆盖
   */
  async applyConfigFileOverrides(moduleName, config) {
    const configFile = path.join(this.configDir, `${moduleName}.json`);

    try {
      const content = await fs.readFile(configFile, 'utf8');
      const fileConfig = JSON.parse(content);
      return this.deepMerge(config, fileConfig);
    } catch (error) {
      // 配置文件不存在或解析失败，忽略
      if (error.code !== 'ENOENT') {
        logger.warn(`读取模块配置文件失败: ${configFile}`, error);
      }
      return config;
    }
  }

  /**
   * 验证配置对象
   */
  validateConfig(config, schema) {
    for (const [key, rule] of Object.entries(schema)) {
      const value = this.getNestedValue(config, key);

      if (rule.required && (value === undefined || value === null)) {
        logger.error(`配置项 ${key} 是必需的`);
        return false;
      }

      if (value !== undefined && rule.type && typeof value !== rule.type) {
        logger.error(`配置项 ${key} 类型错误，期望 ${rule.type}，实际 ${typeof value}`);
        return false;
      }

      if (value !== undefined && rule.validate && !rule.validate(value)) {
        logger.error(`配置项 ${key} 验证失败`);
        return false;
      }
    }

    return true;
  }

  /**
   * 通知监听器
   */
  notifyWatchers(moduleName, config) {
    const moduleConfig = this.configs.get(moduleName);
    if (!moduleConfig) return;

    for (const watcher of moduleConfig.watchers) {
      try {
        watcher(config);
      } catch (error) {
        logger.error(`配置监听器执行失败: ${moduleName}`, error);
      }
    }
  }

  /**
   * 深度合并对象
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.deepMerge(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 深度克隆对象
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, this.deepClone(v)]),
    );
  }

  /**
   * 获取嵌套值
   */
  getNestedValue(obj, keyPath) {
    const keys = keyPath.split('.');
    let value = obj;
    for (const key of keys) {
      if (value === null || value === undefined) return undefined;
      value = value[key];
    }
    return value;
  }

  /**
   * 设置嵌套值
   */
  setNestedValue(obj, keyPath, value) {
    const keys = keyPath.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  /**
   * 解析环境变量值
   */
  parseEnvValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;

    const num = Number(value);
    if (!isNaN(num) && value !== '') return num;

    return value;
  }
}

// 创建全局单例
const moduleConfigManager = new ModuleConfigManager();

module.exports = moduleConfigManager;
