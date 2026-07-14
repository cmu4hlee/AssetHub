/**
 * 模块接口契约管理器
 * 运行时强制检查模块接口契约，确保模块间调用的安全性
 */

const logger = require('../config/logger');

// 模块接口契约定义
const MODULE_CONTRACTS = {
  'asset-management': {
    exports: [
      { name: 'getAssetById', params: ['id', 'tenantId'], returns: 'Asset' },
      { name: 'getAssetsByIds', params: ['ids', 'tenantId'], returns: 'Asset[]' },
      { name: 'updateAssetStatus', params: ['id', 'status', 'tenantId'], returns: 'boolean' },
      { name: 'getAssetStatistics', params: ['tenantId'], returns: 'Statistics' },
    ],
    events: ['asset:created', 'asset:updated', 'asset:deleted', 'asset:status-changed'],
  },
  'user-management': {
    exports: [
      { name: 'getUserById', params: ['id'], returns: 'User' },
      { name: 'getUsersByDepartment', params: ['departmentId', 'tenantId'], returns: 'User[]' },
      { name: 'getUserPermissions', params: ['userId'], returns: 'Permission[]' },
    ],
    events: ['user:login', 'user:logout'],
  },
  'maintenance-management': {
    exports: [
      { name: 'getMaintenanceByAssetId', params: ['assetId', 'tenantId'], returns: 'Maintenance[]' },
      { name: 'createMaintenance', params: ['data', 'tenantId'], returns: 'Maintenance' },
      { name: 'getMaintenanceStatistics', params: ['tenantId'], returns: 'Statistics' },
    ],
    events: ['maintenance:created', 'maintenance:completed', 'maintenance:approved'],
  },
  'inventory-management': {
    exports: [
      { name: 'getInventoryById', params: ['id', 'tenantId'], returns: 'Inventory' },
      { name: 'createInventory', params: ['data', 'tenantId'], returns: 'Inventory' },
    ],
    events: ['inventory:started', 'inventory:completed', 'inventory:discrepancy'],
  },
  'iot-management': {
    exports: [
      { name: 'getDeviceById', params: ['id', 'tenantId'], returns: 'IoTDevice' },
      { name: 'getDevicesByAssetId', params: ['assetId', 'tenantId'], returns: 'IoTDevice[]' },
      { name: 'getDeviceReadings', params: ['deviceId', 'startTime', 'endTime'], returns: 'Reading[]' },
    ],
    events: ['iot:device-online', 'iot:device-offline', 'iot:alert-triggered'],
  },
  'compliance-management': {
    exports: [
      { name: 'getComplianceById', params: ['id', 'tenantId'], returns: 'Compliance' },
      { name: 'getComplianceStatistics', params: ['tenantId'], returns: 'Statistics' },
    ],
    events: [],
  },
  'quality-control': {
    exports: [
      { name: 'getQualityControlById', params: ['id', 'tenantId'], returns: 'QualityControl' },
      { name: 'getQualityStatistics', params: ['tenantId'], returns: 'Statistics' },
    ],
    events: ['quality:control-created', 'quality:control-completed'],
  },
};

class ModuleContractManager {
  constructor() {
    this.contracts = new Map();
    this.implementations = new Map();
    this._loadDefaultContracts();
  }

  _loadDefaultContracts() {
    for (const [moduleId, contract] of Object.entries(MODULE_CONTRACTS)) {
      this.registerContract(moduleId, contract);
    }
  }

  /**
   * 注册模块接口契约
   * @param {string} moduleId - 模块ID
   * @param {Object} contract - 契约定义
   */
  registerContract(moduleId, contract) {
    this.contracts.set(moduleId, {
      exports: contract.exports || [],
      events: contract.events || [],
      registeredAt: new Date().toISOString(),
    });
    logger.info(`[ModuleContract] 模块接口契约已注册: ${moduleId}`);
  }

  /**
   * 注册模块接口实现
   * @param {string} moduleId - 模块ID
   * @param {string} methodName - 方法名
   * @param {Function} implementation - 实现函数
   */
  registerImplementation(moduleId, methodName, implementation) {
    if (!this.implementations.has(moduleId)) {
      this.implementations.set(moduleId, new Map());
    }

    const contract = this.contracts.get(moduleId);
    if (contract) {
      const exportDef = contract.exports.find(e => e.name === methodName);
      if (!exportDef) {
        logger.warn(`[ModuleContract] 模块 ${moduleId} 注册了未在契约中声明的方法: ${methodName}`);
      }
    }

    this.implementations.get(moduleId).set(methodName, implementation);
    logger.debug(`[ModuleContract] 模块 ${moduleId} 方法 ${methodName} 已注册实现`);
  }

  /**
   * 调用模块接口方法
   * @param {string} moduleId - 模块ID
   * @param {string} methodName - 方法名
   * @param {Array} args - 参数列表
   * @returns {any}
   */
  async call(moduleId, methodName, ...args) {
    // 1. 检查契约是否存在
    const contract = this.contracts.get(moduleId);
    if (!contract) {
      throw new Error(`MODULE_CONTRACT_NOT_FOUND: 模块 ${moduleId} 没有注册接口契约`);
    }

    // 2. 检查方法是否在契约中声明
    const exportDef = contract.exports.find(e => e.name === methodName);
    if (!exportDef) {
      throw new Error(`METHOD_NOT_IN_CONTRACT: 方法 ${methodName} 不在模块 ${moduleId} 的接口契约中`);
    }

    // 3. 检查实现是否存在
    const moduleImpls = this.implementations.get(moduleId);
    if (!moduleImpls || !moduleImpls.has(methodName)) {
      throw new Error(`METHOD_NOT_IMPLEMENTED: 方法 ${methodName} 在模块 ${moduleId} 中没有实现`);
    }

    // 4. 参数数量检查
    if (args.length < exportDef.params.length) {
      logger.warn(`[ModuleContract] 调用 ${moduleId}.${methodName} 参数不足，期望 ${exportDef.params.length} 个，实际 ${args.length} 个`);
    }

    // 5. 执行调用
    const implementation = moduleImpls.get(methodName);
    try {
      const result = await implementation(...args);
      return result;
    } catch (error) {
      logger.error(`[ModuleContract] 调用 ${moduleId}.${methodName} 失败:`, error.message);
      throw error;
    }
  }

  /**
   * 检查模块是否实现了所有契约声明的方法
   * @param {string} moduleId - 模块ID
   * @returns {Object} { valid: boolean, missing: Array<string> }
   */
  validateImplementation(moduleId) {
    const contract = this.contracts.get(moduleId);
    if (!contract) {
      return { valid: false, missing: [], error: 'CONTRACT_NOT_FOUND' };
    }

    const moduleImpls = this.implementations.get(moduleId);
    if (!moduleImpls) {
      return { valid: false, missing: contract.exports.map(e => e.name), error: 'NO_IMPLEMENTATION' };
    }

    const missing = contract.exports
      .filter(e => !moduleImpls.has(e.name))
      .map(e => e.name);

    return {
      valid: missing.length === 0,
      missing,
      error: missing.length > 0 ? 'METHODS_MISSING' : null,
    };
  }

  /**
   * 获取模块的契约定义
   * @param {string} moduleId - 模块ID
   * @returns {Object|null}
   */
  getContract(moduleId) {
    return this.contracts.get(moduleId) || null;
  }

  /**
   * 获取所有已注册契约的模块列表
   * @returns {Array<string>}
   */
  getRegisteredModules() {
    return Array.from(this.contracts.keys());
  }

  /**
   * 生成模块契约验证报告
   * @returns {Object}
   */
  generateValidationReport() {
    const report = {
      total: this.contracts.size,
      valid: 0,
      invalid: 0,
      modules: [],
    };

    for (const moduleId of this.contracts.keys()) {
      const validation = this.validateImplementation(moduleId);
      report.modules.push({
        moduleId,
        ...validation,
      });

      if (validation.valid) {
        report.valid++;
      } else {
        report.invalid++;
      }
    }

    return report;
  }
}

const contractManager = new ModuleContractManager();

module.exports = {
  ModuleContractManager,
  contractManager,
  MODULE_CONTRACTS,
};
