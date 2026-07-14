/**
 * 依赖注入使用示例
 * 展示如何通过服务容器重构模块间调用
 */

// ============================================
// 示例1: 直接依赖（不推荐 - 紧耦合）
// ============================================

// 不推荐：直接导入其他模块的服务
const qualityCommonService = require('../../quality-common/services/quality-common.service');

async function createQualityControlOld(assetCode, data) {
  // 紧耦合：如果 quality-common 模块不存在，会报错
  await qualityCommonService.logQualityEvent({
    type: 'quality_control',
    assetCode,
    data
  });

  return { success: true };
}


// ============================================
// 示例2: 使用服务容器（推荐 - 松耦合）
// ============================================

const { resolve, register } = require('../../core/ServiceContainer');

// 步骤1: 在模块初始化时注册服务
register('quality-common.service', require('../../quality-common/services/quality-common.service'));

async function createQualityControlNew(assetCode, data) {
  // 松耦合：通过服务容器获取服务
  const qualityCommonService = resolve('quality-common.service');

  await qualityCommonService.logQualityEvent({
    type: 'quality_control',
    assetCode,
    data
  });

  return { success: true };
}


// ============================================
// 示例3: 使用事件总线（推荐 - 最松耦合）
// ============================================

const { publish, subscribe, SYSTEM_EVENTS } = require('../../core/EventBus');

async function createQualityControlEvent(assetCode, data) {
  // 发布事件，无需知道谁会处理
  await publish(SYSTEM_EVENTS.QUALITY_CONTROL_CREATED, {
    assetCode,
    data,
    timestamp: new Date()
  });

  return { success: true };
}

// 在另一个模块中订阅事件
subscribe(SYSTEM_EVENTS.QUALITY_CONTROL_CREATED, async (event) => {
  // 处理质量控制创建事件
  const qualityCommonService = resolve('quality-common.service');
  await qualityCommonService.logQualityEvent({
    type: 'quality_control',
    assetCode: event.assetCode,
    data: event.data
  });
});


// ============================================
// 示例4: 使用共享服务接口（推荐 - 访问共享表）
// ============================================

const { assetSharedService, departmentSharedService } = require('../../services/shared');

async function createMaintenanceRequest(assetCode, data) {
  // 通过共享服务访问共享表，无需直接访问数据库
  const asset = await assetSharedService.getAssetByCode(assetCode, data.tenantId);

  if (!asset) {
    throw new Error('Asset not found');
  }

  // 验证部门
  const department = await departmentSharedService.getDepartmentByCode(
    data.departmentCode,
    data.tenantId
  );

  if (!department) {
    throw new Error('Department not found');
  }

  // 创建维修申请...
  return { success: true };
}


// ============================================
// 示例5: 模块配置优化
// ============================================

// 优化前的配置（直接依赖）
const oldConfig = {
  dependencies: [
    { module_id: 'quality-common', dependency_type: 'required' },
    { module_id: 'user-management', dependency_type: 'required' }
  ]
};

// 优化后的配置（通过接口依赖）
const newConfig = {
  dependencies: [
    { module_id: 'quality-common', dependency_type: 'required' }
  ],
  // 通过接口声明依赖，而非直接依赖
  interfaces: [
    { name: 'IUserProvider', type: 'provided', source: 'quality-common' },
    { name: 'IAssetProvider', type: 'provided', source: 'asset-management' }
  ]
};


// ============================================
// 最佳实践总结
// ============================================

/**
 * 1. 优先使用事件总线
 *    - 最松耦合
 *    - 支持异步处理
 *    - 便于扩展
 *
 * 2. 其次使用服务容器
 *    - 松耦合
 *    - 支持依赖注入
 *    - 便于测试
 *
 * 3. 再次使用共享服务接口
 *    - 封装共享表访问
 *    - 统一数据访问层
 *    - 便于审计
 *
 * 4. 避免直接依赖
 *    - 不要直接 require 其他模块的服务
 *    - 使用服务容器或事件总线
 */
