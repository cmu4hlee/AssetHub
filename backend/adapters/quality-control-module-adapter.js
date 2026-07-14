/**
 * 质量控制模块接口适配器
 *
 * 将现有质量控制服务适配为标准接口，实现模块独立性。
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { safeExecuteWithRetry, createModuleError } = require('../middleware/module-error-handler');
const moduleRegistry = require('../config/module-registry');

class QualityControlModuleAdapter {
  constructor() {
    this.name = 'quality-control';
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
      warningDays: 30,
      autoRemind: true,
      maxPageSize: 2000,
      defaultPageSize: 20,
      ...config,
    };
    this.initialized = true;
    logger.info('质量控制模块初始化完成');
  }

  /**
   * 根据ID查找质控记录
   *
   * @param {number} id - 记录ID
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Object|null>}
   */
  async findById(id, tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM quality_control_records WHERE id = ? AND tenant_id = ? AND is_deleted = 0',
      [id, tenantId],
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 查询质控记录列表
   *
   * @param {Object} filters - 过滤条件
   * @param {number} tenantId - 租户ID
   * @param {Object} pagination - 分页参数
   * @returns {Promise<{data: Array, total: number}>}
   */
  async findAll(filters, tenantId, pagination = {}) {
    const { page = 1, pageSize = this.config.defaultPageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE tenant_id = ? AND is_deleted = 0';
    const params = [tenantId];

    if (filters.status) {
      whereClause += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.result) {
      whereClause += ' AND result = ?';
      params.push(filters.result);
    }
    if (filters.qcType) {
      whereClause += ' AND qc_type = ?';
      params.push(filters.qcType);
    }
    if (filters.assetCode) {
      whereClause += ' AND asset_code LIKE ?';
      params.push(`%${filters.assetCode}%`);
    }
    if (filters.startDate) {
      whereClause += ' AND qc_date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClause += ' AND qc_date <= ?';
      params.push(filters.endDate);
    }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM quality_control_records ${whereClause}`,
      params,
    );

    const [rows] = await db.execute(
      `SELECT * FROM quality_control_records ${whereClause} ORDER BY qc_date DESC LIMIT ? OFFSET ?`,
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
   * 创建质控记录
   *
   * @param {Object} data - 质控数据
   * @param {number} tenantId - 租户ID
   * @param {string} createdBy - 创建人
   * @returns {Promise<Object>}
   */
  async create(data, tenantId, createdBy) {
    const { record_no, asset_code, asset_name, qc_type, qc_date, qc_item, qc_method } = data;

    // 自动生成下次质控日期
    let nextQcDate = data.next_qc_date;
    if (!nextQcDate && data.qc_cycle) {
      nextQcDate = new Date(qc_date);
      nextQcDate.setMonth(nextQcDate.getMonth() + data.qc_cycle);
    }

    const [result] = await db.execute(
      `INSERT INTO quality_control_records 
       (tenant_id, record_no, asset_code, asset_name, qc_type, qc_date, next_qc_date, 
        qc_item, qc_method, qc_standard, qc_person, department, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        tenantId, record_no, asset_code, asset_name, qc_type, qc_date, nextQcDate,
        qc_item, qc_method, data.qc_standard, data.qc_person, data.department, createdBy,
      ],
    );

    const record = await this.findById(result.insertId, tenantId);

    // 触发事件
    moduleRegistry.emitEvent('quality-control', 'created', {
      id: result.insertId,
      recordNo: record_no,
      assetCode: asset_code,
      tenantId,
      createdBy,
    });

    return record;
  }

  /**
   * 更新质控记录
   *
   * @param {number} id - 记录ID
   * @param {Object} data - 更新数据
   * @param {number} tenantId - 租户ID
   * @param {string} updatedBy - 更新人
   * @returns {Promise<Object>}
   */
  async update(id, data, tenantId, updatedBy) {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw createModuleError('NOT_FOUND', `质控记录 ${id} 不存在`);
    }

    const updates = [];
    const values = [];
    const allowedFields = [
      'qc_type', 'qc_date', 'next_qc_date', 'qc_item', 'qc_method',
      'qc_standard', 'qc_value', 'standard_value', 'deviation', 'tolerance',
      'result', 'qc_person', 'department', 'status', 'remark',
      'reviewer', 'review_date', 'qc_cycle', 'warning_days', 'is_auto_remind',
    ];

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = NOW()');
    updates.push('updated_by = ?');
    values.push(updatedBy);
    values.push(id);
    values.push(tenantId);

    await db.execute(
      `UPDATE quality_control_records SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values,
    );

    const record = await this.findById(id, tenantId);

    // 触发事件
    moduleRegistry.emitEvent('quality-control', 'updated', {
      id,
      tenantId,
      updatedBy,
      changes: data,
    });

    return record;
  }

  /**
   * 删除质控记录（软删除）
   *
   * @param {number} id - 记录ID
   * @param {number} tenantId - 租户ID
   * @returns {Promise<boolean>}
   */
  async delete(id, tenantId) {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw createModuleError('NOT_FOUND', `质控记录 ${id} 不存在`);
    }

    await db.execute(
      'UPDATE quality_control_records SET is_deleted = 1 WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    // 触发事件
    moduleRegistry.emitEvent('quality-control', 'deleted', {
      id,
      tenantId,
      recordNo: existing.record_no,
    });

    return true;
  }

  /**
   * 统计质控记录数量
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
    if (filters.result) {
      whereClause += ' AND result = ?';
      params.push(filters.result);
    }

    const [result] = await db.execute(
      `SELECT COUNT(*) as total FROM quality_control_records ${whereClause}`,
      params,
    );

    return result[0].total;
  }

  /**
   * 获取统计信息
   *
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Object>}
   */
  async getStatistics(tenantId) {
    const [result] = await db.execute(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = '已完成' THEN 1 END) as completed,
        COUNT(CASE WHEN status = '待检' THEN 1 END) as pending,
        COUNT(CASE WHEN result = '合格' THEN 1 END) as passed,
        COUNT(CASE WHEN result = '不合格' THEN 1 END) as failed,
        COUNT(CASE WHEN next_qc_date <= DATE_ADD(NOW(), INTERVAL ? DAY) AND next_qc_date >= NOW() THEN 1 END) as upcoming,
        COUNT(CASE WHEN next_qc_date < NOW() AND status != '已完成' THEN 1 END) as overdue
       FROM quality_control_records
       WHERE tenant_id = ? AND is_deleted = 0`,
      [this.config.warningDays, tenantId],
    );

    return result[0];
  }

  /**
   * 模块启动
   */
  async start() {
    logger.info('质量控制模块已启动');
  }

  /**
   * 模块停止
   */
  async stop() {
    logger.info('质量控制模块已停止');
  }

  /**
   * 模块销毁
   */
  async destroy() {
    this.initialized = false;
    logger.info('质量控制模块已销毁');
  }
}

module.exports = QualityControlModuleAdapter;
