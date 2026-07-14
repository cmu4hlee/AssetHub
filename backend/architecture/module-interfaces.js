/**
 * 模块化架构规范定义
 *
 * 本文件定义了 AssetHub 系统的模块化架构标准，
 * 确保每个模块能够独立运行、维护和扩展。
 */

// ============================================
// 1. 标准模块接口定义
// ============================================

/**
 * 标准服务接口
 *
 * 每个业务服务模块应实现以下接口：
 *
 * @interface
 * @property {Function} findById - 根据ID查找记录
 * @property {Function} findAll - 查询记录列表（支持分页和过滤）
 * @property {Function} create - 创建新记录
 * @property {Function} update - 更新现有记录
 * @property {Function} delete - 删除记录（软删除）
 * @property {Function} count - 统计记录数量
 */
const StandardServiceInterface = {
  /**
   * @param {number} id - 记录ID
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Object|null>} 记录对象或null
   */
  async findById(id, tenantId) {},

  /**
   * @param {Object} filters - 过滤条件
   * @param {number} tenantId - 租户ID
   * @param {Object} pagination - 分页参数 {page, pageSize}
   * @returns {Promise<{data: Array, total: number}>}
   */
  async findAll(filters, tenantId, pagination) {},

  /**
   * @param {Object} data - 记录数据
   * @param {number} tenantId - 租户ID
   * @param {string} createdBy - 创建人
   * @returns {Promise<Object>} 创建的记录
   */
  async create(data, tenantId, createdBy) {},

  /**
   * @param {number} id - 记录ID
   * @param {Object} data - 更新数据
   * @param {number} tenantId - 租户ID
   * @param {string} updatedBy - 更新人
   * @returns {Promise<Object>} 更新后的记录
   */
  async update(id, data, tenantId, updatedBy) {},

  /**
   * @param {number} id - 记录ID
   * @param {number} tenantId - 租户ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async delete(id, tenantId) {},

  /**
   * @param {Object} filters - 过滤条件
   * @param {number} tenantId - 租户ID
   * @returns {Promise<number>} 记录数量
   */
  async count(filters, tenantId) {},
};

// ============================================
// 2. 模块配置接口定义
// ============================================

/**
 * 标准模块配置接口
 *
 * 每个模块应提供以下配置项：
 *
 * @interface
 * @property {string} name - 模块名称
 * @property {string} version - 模块版本
 * @property {boolean} enabled - 是否启用
 * @property {Object} defaults - 默认配置
 * @property {Array<string>} dependencies - 依赖的其他模块
 * @property {Object} validation - 配置验证规则
 */
const ModuleConfigInterface = {
  name: '',
  version: '1.0.0',
  enabled: true,
  defaults: {},
  dependencies: [],
  validation: {},
};

// ============================================
// 3. 事件接口定义
// ============================================

/**
 * 标准模块事件接口
 *
 * 模块间通过事件进行松耦合通信：
 *
 * @interface
 * @property {string} MODULE_NAME - 模块名称前缀
 * @property {Function} emit - 触发事件
 * @property {Function} on - 监听事件
 * @property {Function} off - 移除监听
 */
const ModuleEventInterface = {
  MODULE_NAME: 'module',

  /**
   * 触发模块事件
   * @param {string} eventName - 事件名称（不含前缀）
   * @param {Object} payload - 事件数据
   */
  emit(eventName, payload) {},

  /**
   * 监听模块事件
   * @param {string} eventName - 事件名称（不含前缀）
   * @param {Function} handler - 事件处理函数
   */
  on(eventName, handler) {},

  /**
   * 移除事件监听
   * @param {string} eventName - 事件名称（不含前缀）
   * @param {Function} handler - 事件处理函数
   */
  off(eventName, handler) {},
};

// ============================================
// 4. 错误处理接口定义
// ============================================

/**
 * 标准模块错误类型
 */
const ModuleError = {
  /** 参数错误 */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** 记录不存在 */
  NOT_FOUND: 'NOT_FOUND',
  /** 权限不足 */
  FORBIDDEN: 'FORBIDDEN',
  /** 业务规则冲突 */
  CONFLICT: 'CONFLICT',
  /** 外部依赖失败 */
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
  /** 系统内部错误 */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

/**
 * 标准模块异常类
 */
class ModuleException extends Error {
  /**
   * @param {string} code - 错误代码
   * @param {string} message - 错误消息
   * @param {Object} details - 详细信息
   * @param {Error} cause - 原始异常
   */
  constructor(code, message, details = {}, cause = null) {
    super(message);
    this.name = 'ModuleException';
    this.code = code;
    this.details = details;
    this.cause = cause;
    this.timestamp = new Date().toISOString();
  }

  /** 转换为API响应格式 */
  toResponse() {
    return {
      success: false,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

// ============================================
// 5. 模块生命周期接口
// ============================================

/**
 * 模块生命周期钩子
 *
 * @interface
 * @property {Function} initialize - 模块初始化
 * @property {Function} validate - 配置验证
 * @property {Function} start - 模块启动
 * @property {Function} stop - 模块停止
 * @property {Function} destroy - 模块销毁
 */
const ModuleLifecycleInterface = {
  /**
   * 初始化模块（加载配置、建立连接等）
   * @param {Object} config - 模块配置
   * @returns {Promise<void>}
   */
  async initialize(config) {},

  /**
   * 验证模块配置是否有效
   * @param {Object} config - 模块配置
   * @returns {Promise<boolean>} 是否有效
   */
  async validate(config) {},

  /**
   * 启动模块（开始处理请求、启动定时任务等）
   * @returns {Promise<void>}
   */
  async start() {},

  /**
   * 停止模块（停止处理请求、清理资源等）
   * @returns {Promise<void>}
   */
  async stop() {},

  /**
   * 销毁模块（释放所有资源）
   * @returns {Promise<void>}
   */
  async destroy() {},
};

// ============================================
// 6. 数据访问接口定义
// ============================================

/**
 * 标准数据访问接口（Repository模式）
 *
 * @interface
 * @property {Function} findById - 根据ID查询
 * @property {Function} findWhere - 条件查询
 * @property {Function} insert - 插入记录
 * @property {Function} updateById - 根据ID更新
 * @property {Function} deleteById - 根据ID删除
 * @property {Function} transaction - 执行事务
 */
const RepositoryInterface = {
  /**
   * @param {number} id - 记录ID
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Object|null>}
   */
  async findById(id, tenantId) {},

  /**
   * @param {Object} where - 查询条件
   * @param {number} tenantId - 租户ID
   * @param {Object} options - 查询选项 {orderBy, limit, offset}
   * @returns {Promise<Array>}
   */
  async findWhere(where, tenantId, options = {}) {},

  /**
   * @param {Object} data - 记录数据
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Object>}
   */
  async insert(data, tenantId) {},

  /**
   * @param {number} id - 记录ID
   * @param {Object} data - 更新数据
   * @param {number} tenantId - 租户ID
   * @returns {Promise<boolean>}
   */
  async updateById(id, data, tenantId) {},

  /**
   * @param {number} id - 记录ID
   * @param {number} tenantId - 租户ID
   * @returns {Promise<boolean>}
   */
  async deleteById(id, tenantId) {},

  /**
   * @param {Function} callback - 事务回调
   * @returns {Promise<any>}
   */
  async transaction(callback) {},
};

// ============================================
// 7. 导出
// ============================================

module.exports = {
  StandardServiceInterface,
  ModuleConfigInterface,
  ModuleEventInterface,
  ModuleLifecycleInterface,
  RepositoryInterface,
  ModuleError,
  ModuleException,
};
