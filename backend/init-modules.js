/**
 * 模块注册初始化脚本
 *
 * 在应用启动时注册所有业务模块，建立模块间的松耦合通信机制。
 */

const moduleRegistry = require('./config/module-registry');
const moduleConfigManager = require('./config/module-config-manager');
const logger = require('./config/logger');

// 导入模块适配器
const AssetModuleAdapter = require('./adapters/asset-module-adapter');
const QualityControlModuleAdapter = require('./adapters/quality-control-module-adapter');

/**
 * 初始化所有模块
 */
async function initializeModules() {
  logger.info('开始初始化模块注册中心...');

  try {
    // ============================================
    // 1. 注册模块配置
    // ============================================
    moduleConfigManager.register('asset', {
      cacheEnabled: true,
      cacheTTL: 300,
      maxPageSize: 2000,
      defaultPageSize: 20,
    }, {
      cacheEnabled: { required: false, type: 'boolean' },
      cacheTTL: { required: false, type: 'number', validate: v => v > 0 },
      maxPageSize: { required: false, type: 'number', validate: v => v > 0 },
      defaultPageSize: { required: false, type: 'number', validate: v => v > 0 },
    });

    moduleConfigManager.register('quality-control', {
      warningDays: 30,
      autoRemind: true,
      maxPageSize: 2000,
      defaultPageSize: 20,
    }, {
      warningDays: { required: false, type: 'number', validate: v => v > 0 },
      autoRemind: { required: false, type: 'boolean' },
    });

    // 加载配置
    await moduleConfigManager.load('asset');
    await moduleConfigManager.load('quality-control');

    logger.info('模块配置加载完成');

    // ============================================
    // 2. 注册核心模块
    // ============================================

    // 资产模块
    const assetModule = new AssetModuleAdapter();
    moduleRegistry.register('asset', assetModule, {
      config: moduleConfigManager.get('asset'),
      dependencies: [],
      enabled: true,
    });

    // 质量控制模块
    const qcModule = new QualityControlModuleAdapter();
    moduleRegistry.register('quality-control', qcModule, {
      config: moduleConfigManager.get('quality-control'),
      dependencies: ['asset'],
      enabled: true,
    });

    logger.info('核心模块注册完成');

    // ============================================
    // 3. 设置模块间事件监听
    // ============================================
    setupInterModuleEvents();

    // ============================================
    // 4. 初始化所有模块
    // ============================================
    await moduleRegistry.initializeAll();

    logger.info('模块注册中心初始化完成');
    logger.info(`已注册模块: ${moduleRegistry.getModuleNames().join(', ')}`);

    return true;
  } catch (error) {
    logger.error('模块注册中心初始化失败:', error);
    throw error;
  }
}

/**
 * 设置模块间事件通信
 */
function setupInterModuleEvents() {
  // 当资产状态变更为"维修"时，通知质量控制模块
  moduleRegistry.onEvent('asset', 'updated', (payload) => {
    if (payload.changes?.status === '维修') {
      logger.info(`资产 ${payload.id} 状态变更为维修，触发质量控制检查`);
      // 可以在这里自动创建质控记录
      moduleRegistry.emitEvent('quality-control', 'inspection-required', {
        assetId: payload.id,
        reason: '资产状态变更为维修',
        tenantId: payload.tenantId,
      });
    }
  });

  // 当资产被删除时，通知相关模块
  moduleRegistry.onEvent('asset', 'deleted', (payload) => {
    logger.info(`资产 ${payload.id} 已删除，清理相关数据`);
    moduleRegistry.emitEvent('quality-control', 'asset-deleted', payload);
  });

  // 当质控记录创建时，更新资产信息
  moduleRegistry.onEvent('quality-control', 'created', (payload) => {
    logger.info(`质控记录 ${payload.recordNo} 已创建`);
    moduleRegistry.emitEvent('asset', 'quality-record-created', payload);
  });

  // 当质控结果不合格时，通知资产模块
  moduleRegistry.onEvent('quality-control', 'updated', (payload) => {
    if (payload.changes?.result === '不合格') {
      logger.info(`质控记录 ${payload.id} 结果为不合格，标记资产`);
      moduleRegistry.emitEvent('asset', 'quality-failed', {
        assetCode: payload.changes.asset_code,
        qcRecordId: payload.id,
        tenantId: payload.tenantId,
      });
    }
  });

  logger.info('模块间事件通信设置完成');
}

/**
 * 获取模块状态信息（用于健康检查）
 */
function getModuleStatus() {
  return {
    modules: moduleRegistry.getStatus(),
    config: moduleConfigManager.getStatus(),
  };
}

module.exports = {
  initializeModules,
  getModuleStatus,
  moduleRegistry,
  moduleConfigManager,
};
