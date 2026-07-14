/**
 * 模块加载器
 * 支持动态加载和管理独立模块
 */

const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

class ModuleLoader {
  constructor() {
    this.modules = new Map();
    this.modulesPath = path.join(__dirname, '../modules');
  }

  /**
   * 扫描并加载所有模块
   */
  async loadAllModules() {
    logger.info('开始扫描模块...');

    if (!fs.existsSync(this.modulesPath)) {
      logger.warn('模块目录不存在:', this.modulesPath);
      return [];
    }

    const moduleDirs = fs.readdirSync(this.modulesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    logger.info(`发现 ${moduleDirs.length} 个模块目录`);

    // 第一轮：收集所有模块配置
    const moduleConfigs = new Map();
    for (const moduleName of moduleDirs) {
      const configPath = path.join(this.modulesPath, moduleName, 'config/module.config.js');
      if (fs.existsSync(configPath)) {
        try {
          delete require.cache[require.resolve(configPath)];
          const config = require(configPath);
          if (this.validateModuleConfig(config)) {
            moduleConfigs.set(config.id, { name: moduleName, config });
          }
        } catch (error) {
          logger.error(`读取模块 ${moduleName} 配置失败:`, error.message);
        }
      }
    }

    // 第二轮：按依赖顺序加载模块
    const loadedIds = new Set();
    const loadedModules = [];
    let hasProgress = true;

    while (hasProgress && loadedModules.length < moduleConfigs.size) {
      hasProgress = false;

      for (const [moduleId, { name, config }] of moduleConfigs) {
        if (loadedIds.has(moduleId)) continue;

        // 检查依赖是否满足
        let depsSatisfied = true;
        if (config.dependencies) {
          for (const dep of config.dependencies) {
            if (dep.dependency_type === 'required' && !loadedIds.has(dep.module_id)) {
              depsSatisfied = false;
              break;
            }
          }
        }

        if (depsSatisfied) {
          try {
            const moduleInfo = await this.loadModuleInstance(name, config);
            if (moduleInfo) {
              loadedModules.push(moduleInfo);
              loadedIds.add(moduleId);
              hasProgress = true;
            }
          } catch (error) {
            logger.error(`加载模块 ${name} 失败:`, error.message);
          }
        }
      }
    }

    // 记录未加载的模块
    for (const [moduleId, { name }] of moduleConfigs) {
      if (!loadedIds.has(moduleId)) {
        const {config} = moduleConfigs.get(moduleId);
        const missingDeps = (config.dependencies || [])
          .filter(d => d.dependency_type === 'required' && !loadedIds.has(d.module_id))
          .map(d => d.module_id);
        logger.warn(`模块 ${name} 无法加载，缺少依赖: ${missingDeps.join(', ')}`);
      }
    }

    logger.info(`成功加载 ${loadedModules.length}/${moduleConfigs.size} 个模块`);
    return loadedModules;
  }

  /**
   * 加载模块实例（内部使用）
   */
  async loadModuleInstance(moduleName, config) {
    const moduleInfo = {
      id: config.id,
      name: config.name,
      version: config.version,
      path: path.join(this.modulesPath, moduleName),
      config,
      router: null,
      enabled: true,
      loadedAt: new Date(),
    };

    // 加载路由
    const routesPath = path.join(this.modulesPath, moduleName, config.backend_config?.routes_path || 'routes', 'index.js');
    if (fs.existsSync(routesPath)) {
      try {
        delete require.cache[require.resolve(routesPath)];
        moduleInfo.router = require(routesPath);
      } catch (error) {
        logger.error(`模块 ${moduleName} 路由加载失败:`, error.message);
      }
    }

    this.modules.set(config.id, moduleInfo);
    logger.info(`✅ 模块 ${config.name} (${moduleName}) 加载成功`);

    return moduleInfo;
  }

  /**
   * 加载单个模块（外部调用）
   */
  async loadModule(moduleName) {
    const configPath = path.join(this.modulesPath, moduleName, 'config/module.config.js');

    if (!fs.existsSync(configPath)) {
      logger.warn(`模块 ${moduleName} 缺少配置文件，跳过`);
      return null;
    }

    // 清除缓存，支持热更新
    delete require.cache[require.resolve(configPath)];
    const config = require(configPath);

    // 验证模块配置
    if (!this.validateModuleConfig(config)) {
      logger.error(`模块 ${moduleName} 配置验证失败`);
      return null;
    }

    return await this.loadModuleInstance(moduleName, config);
  }

  /**
   * 验证模块配置
   */
  validateModuleConfig(config) {
    const requiredFields = ['id', 'name', 'version', 'backend_config'];
    for (const field of requiredFields) {
      if (!config[field]) {
        logger.error(`模块配置缺少必需字段: ${field}`);
        return false;
      }
    }
    return true;
  }

  /**
   * 获取模块信息
   */
  getModule(moduleId) {
    return this.modules.get(moduleId);
  }

  /**
   * 获取所有模块
   */
  getAllModules() {
    return Array.from(this.modules.values());
  }

  /**
   * 获取启用的模块
   */
  getEnabledModules() {
    return Array.from(this.modules.values()).filter(m => m.enabled);
  }

  /**
   * 启用/禁用模块
   */
  setModuleEnabled(moduleId, enabled) {
    const module = this.modules.get(moduleId);
    if (module) {
      module.enabled = enabled;
      logger.info(`模块 ${module.name} 已${enabled ? '启用' : '禁用'}`);
      return true;
    }
    return false;
  }

  /**
   * 获取模块功能状态
   */
  getModuleFeatures(moduleId) {
    const module = this.modules.get(moduleId);
    if (!module) return null;

    const features = module.config.features || {};
    return Object.entries(features).map(([key, feature]) => ({
      id: key,
      name: feature.name,
      enabled: feature.enabled,
      description: feature.description,
    }));
  }

  /**
   * 注册路由到Express应用
   */
  registerRoutes(app) {
    const enabledModules = this.getEnabledModules();

    for (const module of enabledModules) {
      const autoRegister = module.config?.backend_config?.auto_register !== false;
      if (!autoRegister) {
        logger.info(`模块 ${module.name} 已配置为手动挂载，跳过自动注册`);
        continue;
      }

      if (module.router && module.config.backend_config?.api_prefix) {
        const prefix = module.config.backend_config.api_prefix;
        app.use(prefix, module.router);
        logger.info(`模块 ${module.name} 路由已注册: ${prefix}`);
      }
    }

    // 注册模块管理API
    this.registerModuleManagementRoutes(app);
  }

  /**
   * 注册模块管理路由
   */
  registerModuleManagementRoutes(app) {
    const express = require('express');
    const router = express.Router();

    // 获取所有模块状态
    router.get('/modules', (req, res) => {
      const modules = this.getAllModules().map(m => ({
        id: m.id,
        name: m.name,
        version: m.version,
        enabled: m.enabled,
        features: this.getModuleFeatures(m.id) || [],
      }));
      res.json({ success: true, data: modules });
    });

    // 获取模块详情
    router.get('/modules/:id', (req, res) => {
      const module = this.getModule(req.params.id);
      if (!module) {
        return res.status(404).json({ success: false, message: '模块不存在' });
      }
      res.json({
        success: true,
        data: {
          id: module.id,
          name: module.name,
          version: module.version,
          description: module.config.description,
          enabled: module.enabled,
          features: this.getModuleFeatures(module.id) || [],
          config_schema: module.config.config_schema,
          default_config: module.config.default_config,
        },
      });
    });

    app.use('/api/system', router);
    logger.info('模块管理API已注册: /api/system/modules');
  }
}

// 单例模式
let instance = null;
module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new ModuleLoader();
    }
    return instance;
  },
  ModuleLoader,
};
