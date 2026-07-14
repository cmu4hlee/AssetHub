/**
 * 质量通用服务
 * 提供权限管理、数据字典、日志记录等平台级基础能力
 */
const db = require('../../../config/database');
const logger = require('../../../config/logger');

class QualityCommonService {
  // ==================== 权限管理 ====================

  /**
   * 获取所有权限
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 权限列表
   */
  async getPermissions(tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM quality_permissions WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId],
    );
    return rows;
  }

  /**
   * 创建新权限
   * @param {Object} permission - 权限数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createPermission(permission, tenantId) {
    const { name, code, description, category } = permission;

    if (!name || !code) {
      throw new Error('权限名称和编码不能为空');
    }

    // 检查编码是否已存在
    const [existing] = await db.execute(
      'SELECT id FROM quality_permissions WHERE code = ? AND tenant_id = ?',
      [code, tenantId],
    );

    if (existing.length > 0) {
      throw new Error('权限编码已存在');
    }

    const [result] = await db.execute(
      `INSERT INTO quality_permissions (tenant_id, name, code, description, category)
       VALUES (?, ?, ?, ?, ?)`,
      [tenantId, name, code, description || null, category || null],
    );

    return { id: result.insertId };
  }

  /**
   * 更新权限
   * @param {number} id - 权限ID
   * @param {Object} permission - 权限数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 更新结果
   */
  async updatePermission(id, permission, tenantId) {
    const { name, description, category } = permission;

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (category !== undefined) {
      updateFields.push('category = ?');
      updateValues.push(category);
    }

    if (updateFields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id, tenantId);

    const [result] = await db.execute(
      `UPDATE quality_permissions SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      updateValues,
    );

    return result.affectedRows > 0;
  }

  /**
   * 删除权限
   * @param {number} id - 权限ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deletePermission(id, tenantId) {
    const [result] = await db.execute(
      'DELETE FROM quality_permissions WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    return result.affectedRows > 0;
  }

  // ==================== 数据字典管理 ====================

  /**
   * 获取所有数据字典
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 数据字典列表
   */
  async getDictionary(tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM quality_dictionary_items WHERE tenant_id = ? ORDER BY type, sort_order',
      [tenantId],
    );
    return rows;
  }

  /**
   * 根据类型获取数据字典
   * @param {string} type - 字典类型
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 字典项列表
   */
  async getDictionaryByType(type, tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM quality_dictionary_items WHERE type = ? AND tenant_id = ? ORDER BY sort_order',
      [type, tenantId],
    );
    return rows;
  }

  /**
   * 创建字典项
   * @param {Object} item - 字典项数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createDictionaryItem(item, tenantId) {
    const { type, code, label, value, sort_order, remark } = item;

    if (!type || !code || !label) {
      throw new Error('字典类型、编码和标签不能为空');
    }

    // 检查编码是否已存在
    const [existing] = await db.execute(
      'SELECT id FROM quality_dictionary_items WHERE type = ? AND code = ? AND tenant_id = ?',
      [type, code, tenantId],
    );

    if (existing.length > 0) {
      throw new Error('字典项编码已存在');
    }

    const [result] = await db.execute(
      `INSERT INTO quality_dictionary_items (tenant_id, type, code, label, value, sort_order, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, type, code, label, value || null, sort_order || 0, remark || null],
    );

    return { id: result.insertId };
  }

  /**
   * 更新字典项
   * @param {number} id - 字典项ID
   * @param {Object} item - 字典项数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 更新结果
   */
  async updateDictionaryItem(id, item, tenantId) {
    const { label, value, sort_order, remark } = item;

    const updateFields = [];
    const updateValues = [];

    if (label !== undefined) {
      updateFields.push('label = ?');
      updateValues.push(label);
    }
    if (value !== undefined) {
      updateFields.push('value = ?');
      updateValues.push(value);
    }
    if (sort_order !== undefined) {
      updateFields.push('sort_order = ?');
      updateValues.push(sort_order);
    }
    if (remark !== undefined) {
      updateFields.push('remark = ?');
      updateValues.push(remark);
    }

    if (updateFields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id, tenantId);

    const [result] = await db.execute(
      `UPDATE quality_dictionary_items SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      updateValues,
    );

    return result.affectedRows > 0;
  }

  /**
   * 删除字典项
   * @param {number} id - 字典项ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteDictionaryItem(id, tenantId) {
    const [result] = await db.execute(
      'DELETE FROM quality_dictionary_items WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    return result.affectedRows > 0;
  }

  // ==================== 日志管理 ====================

  /**
   * 获取系统日志
   * @param {Object} params - 查询参数
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 日志列表和分页信息
   */
  async getLogs(params, tenantId) {
    const { page = 1, pageSize = 20, level, module, startDate, endDate } = params;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE tenant_id = ?';
    const queryParams = [tenantId];

    if (level) {
      whereClause += ' AND level = ?';
      queryParams.push(level);
    }

    if (module) {
      whereClause += ' AND module = ?';
      queryParams.push(module);
    }

    if (startDate) {
      whereClause += ' AND created_at >= ?';
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND created_at <= ?';
      queryParams.push(endDate);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM quality_logs ${whereClause}`,
      queryParams,
    );
    const { total } = countRows[0];

    const [rows] = await db.execute(
      `SELECT * FROM quality_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(pageSize), offset],
    );

    return {
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 创建系统日志
   * @param {Object} logData - 日志数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createLog(logData, tenantId) {
    const { level, module, message, operator, extra_data } = logData;

    if (!message) {
      throw new Error('日志内容不能为空');
    }

    const [result] = await db.execute(
      `INSERT INTO quality_logs (tenant_id, level, module, message, operator, extra_data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        level || 'info',
        module || 'system',
        message,
        operator || null,
        extra_data ? JSON.stringify(extra_data) : null,
      ],
    );

    return { id: result.insertId };
  }
}

module.exports = new QualityCommonService();
