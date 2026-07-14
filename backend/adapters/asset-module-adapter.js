/**
 * 资产模块接口适配器
 *
 * 将现有资产服务适配为标准接口，实现模块独立性。
 */

const db = require('../config/database');
const logger = require('../config/logger');
const cacheService = require('../services/cache.service');
const { safeExecuteWithRetry, createModuleError } = require('../middleware/module-error-handler');
const moduleRegistry = require('../config/module-registry');

class AssetModuleAdapter {
  constructor() {
    this.name = 'asset';
    this.version = '1.0.0';
    this.config = null;
    this.initialized = false;
  }

  /**
   * 模块初始化
   *
   * @param {Object} config - 模块配置
   */
  async initialize(config = {}) {
    this.config = {
      cacheEnabled: true,
      cacheTTL: 300,
      maxPageSize: 2000,
      defaultPageSize: 20,
      ...config,
    };
    this.initialized = true;
    logger.info('资产模块初始化完成');
  }

  /**
   * 根据ID查找资产
   *
   * @param {number} id - 资产ID
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Object|null>}
   */
  async findById(id, tenantId) {
    const cacheKey = `asset:${tenantId}:${id}`;
    const cached = await safeExecuteWithRetry(
      () => cacheService.get(cacheKey),
      1,
      1000,
      null,
    );
    if (cached) return cached;

    const [rows] = await db.execute(
      'SELECT * FROM assets WHERE id = ? AND tenant_id = ? AND is_deleted = 0',
      [id, tenantId],
    );

    if (rows.length === 0) return null;

    await safeExecuteWithRetry(
      () => cacheService.set(cacheKey, rows[0], this.config.cacheTTL),
      1,
      1000,
      null,
    );

    return rows[0];
  }

  /**
   * 查询资产列表
   *
   * @param {Object} filters - 过滤条件
   * @param {number} tenantId - 租户ID
   * @param {Object} pagination - 分页参数
   * @returns {Promise<{data: Array, total: number}>}
   */
  async findAll(filters, tenantId, pagination = {}) {
    const { page = 1, pageSize = this.config.defaultPageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE a.tenant_id = ? AND a.is_deleted = 0';
    const params = [tenantId];

    if (filters.status) {
      whereClause += ' AND a.status = ?';
      params.push(filters.status);
    }
    if (filters.department) {
      whereClause += ' AND a.department_new = ?';
      params.push(filters.department);
    }
    if (filters.categoryId) {
      whereClause += ' AND a.category_id = ?';
      params.push(filters.categoryId);
    }
    if (filters.keyword) {
      whereClause += ' AND (a.asset_code LIKE ? OR a.name LIKE ?)';
      params.push(`%${filters.keyword}%`, `%${filters.keyword}%`);
    }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM assets a ${whereClause}`,
      params,
    );

    const [rows] = await db.execute(
      `SELECT a.* FROM assets a ${whereClause} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    return {
      data: rows,
      total: countResult[0].total,
      page,
      pageSize,
    };
  }

  /**
   * 创建资产
   *
   * @param {Object} data - 资产数据
   * @param {number} tenantId - 租户ID
   * @param {string} createdBy - 创建人
   * @returns {Promise<Object>}
   */
  async create(data, tenantId, createdBy) {
    const { asset_code, name, category_id, purchase_price, status, department_new } = data;

    const [result] = await db.execute(
      `INSERT INTO assets (tenant_id, asset_code, name, category_id, purchase_price, status, department_new, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [tenantId, asset_code, name, category_id, purchase_price, status || '闲置', department_new, createdBy],
    );

    const asset = await this.findById(result.insertId, tenantId);

    // 触发事件
    moduleRegistry.emitEvent('asset', 'created', {
      id: result.insertId,
      assetCode: asset_code,
      tenantId,
      createdBy,
    });

    return asset;
  }

  /**
   * 更新资产
   *
   * @param {number} id - 资产ID
   * @param {Object} data - 更新数据
   * @param {number} tenantId - 租户ID
   * @param {string} updatedBy - 更新人
   * @returns {Promise<Object>}
   */
  async update(id, data, tenantId, updatedBy) {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw createModuleError('NOT_FOUND', `资产 ${id} 不存在`);
    }

    const updates = [];
    const values = [];
    const allowedFields = ['name', 'status', 'department_new', 'location', 'category_id', 'purchase_price', 'current_value'];

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    updates.push('updated_at = NOW()');
    updates.push('updated_by = ?');
    values.push(updatedBy);
    values.push(id);
    values.push(tenantId);

    await db.execute(
      `UPDATE assets SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values,
    );

    // 清除缓存
    await safeExecuteWithRetry(
      () => cacheService.deleteByPattern(`asset:${tenantId}:${id}`),
      1,
      1000,
      null,
    );

    const asset = await this.findById(id, tenantId);

    // 触发事件
    moduleRegistry.emitEvent('asset', 'updated', {
      id,
      tenantId,
      updatedBy,
      changes: data,
    });

    return asset;
  }

  /**
   * 删除资产（软删除）
   *
   * @param {number} id - 资产ID
   * @param {number} tenantId - 租户ID
   * @returns {Promise<boolean>}
   */
  async delete(id, tenantId) {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw createModuleError('NOT_FOUND', `资产 ${id} 不存在`);
    }

    if (existing.status === '在用') {
      throw createModuleError('CONFLICT', '在用资产不能删除');
    }

    await db.execute(
      'UPDATE assets SET is_deleted = 1, deleted_at = NOW() WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    // 清除缓存
    await safeExecuteWithRetry(
      () => cacheService.deleteByPattern(`asset:${tenantId}:${id}`),
      1,
      1000,
      null,
    );

    // 触发事件
    moduleRegistry.emitEvent('asset', 'deleted', {
      id,
      tenantId,
      assetCode: existing.asset_code,
    });

    return true;
  }

  /**
   * 统计资产数量
   *
   * @param {Object} filters - 过滤条件
   * @param {number} tenantId - 租户ID
   * @returns {Promise<number>}
   */
  async count(filters, tenantId) {
    let whereClause = 'WHERE tenant_id = ? AND is_deleted = 0';
    const params = [tenantId];

    if (filters.status) {
      whereClause += ' AND status = ?';
      params.push(filters.status);
    }

    const [result] = await db.execute(
      `SELECT COUNT(*) as total FROM assets ${whereClause}`,
      params,
    );

    return result[0].total;
  }

  /**
   * 模块启动
   */
  async start() {
    logger.info('资产模块已启动');
  }

  /**
   * 模块停止
   */
  async stop() {
    logger.info('资产模块已停止');
  }

  /**
   * 模块销毁
   */
  async destroy() {
    this.initialized = false;
    logger.info('资产模块已销毁');
  }
}

module.exports = AssetModuleAdapter;
