/**
 * 质控管理服务
 */
const db = require('../../../config/database');
const logger = require('../../../config/logger');

class QualityAssuranceService {

  generateRecordNo() {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `QC-${yy}${mm}${dd}-${rand}`;
  }

  /**
   * 获取质控记录列表
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 质控记录列表和分页信息
   */
  async getQualityControlList(params) {
    const { page = 1, pageSize = 20, keyword, assetCode, status, startDate, endDate, tenantId } = params;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE tenant_id = ?';
    const queryParams = [tenantId];

    if (keyword) {
      whereClause += ' AND (qc_item LIKE ? OR qc_method LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (assetCode) {
      whereClause += ' AND asset_code = ?';
      queryParams.push(assetCode);
    }

    if (status) {
      whereClause += ' AND status = ?';
      queryParams.push(status);
    }

    if (startDate) {
      whereClause += ' AND qc_date >= ?';
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND qc_date <= ?';
      queryParams.push(endDate);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM quality_control_records ${whereClause}`,
      queryParams,
    );
    const { total } = countRows[0];

    const [rows] = await db.execute(
      `SELECT * FROM quality_control_records ${whereClause} ORDER BY qc_date DESC LIMIT ? OFFSET ?`,
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
   * 获取质控记录详情
   * @param {number} id - 记录ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 质控记录详情
   */
  async getQualityControlById(id, tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM quality_control_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 创建质控记录
   * @param {Object} qcData - 质控数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createQualityControl(qcData, tenantId) {
    const { asset_code, title, qc_type, qc_date, result: qcResult, qc_method, operator, remark } = qcData;
    const qcItem = title;

    if (!asset_code || !title || !qc_type) {
      throw new Error('资产编码、标题和检查类型不能为空');
    }

    const [result] = await db.execute(
      `INSERT INTO quality_control_records (tenant_id, record_no, asset_code, qc_item, qc_type, qc_date, result, qc_method, operator, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        this.generateRecordNo(),
        asset_code,
        qcItem || null,
        qc_type,
        qc_date || new Date(),
        qcResult || '待检',
        qc_method || null,
        operator || null,
        remark || null,
      ],
    );

    return { id: result.insertId };
  }

  /**
   * 更新质控记录
   * @param {number} id - 记录ID
   * @param {Object} qcData - 质控数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 更新结果
   */
  async updateQualityControl(id, qcData, tenantId) {
    const { title, qc_type, qc_date, result, qc_method, operator, remark } = qcData;

    const updateFields = [];
    const updateValues = [];

    if (title !== undefined) {
      updateFields.push('qc_item = ?');
      updateValues.push(title);
    }
    if (qc_type !== undefined) {
      updateFields.push('qc_type = ?');
      updateValues.push(qc_type);
    }
    if (qc_date !== undefined) {
      updateFields.push('qc_date = ?');
      updateValues.push(qc_date);
    }
    if (result !== undefined) {
      updateFields.push('result = ?');
      updateValues.push(result);
    }
    if (qc_method !== undefined) {
      updateFields.push('qc_method = ?');
      updateValues.push(qc_method);
    }
    if (operator !== undefined) {
      updateFields.push('operator = ?');
      updateValues.push(operator);
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

    const [updateResult] = await db.execute(
      `UPDATE quality_control_records SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      updateValues,
    );

    return updateResult.affectedRows > 0;
  }

  /**
   * 删除质控记录
   * @param {number} id - 记录ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteQualityControl(id, tenantId) {
    const [result] = await db.execute(
      'DELETE FROM quality_control_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    return result.affectedRows > 0;
  }

  /**
   * 获取即将到期的质控记录
   * @param {Object} params - 查询参数
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 即将到期的质控记录
   */
  async getExpiringQualityControl(params, tenantId) {
    const { days = 30 } = params;

    const [rows] = await db.execute(
      `SELECT * FROM quality_control_records
       WHERE tenant_id = ? AND next_qc_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       AND status != 'completed'
       ORDER BY next_qc_date ASC`,
      [tenantId, days],
    );

    return rows;
  }

  /**
   * 获取质控统计数据
   * @param {Object} params - 统计参数
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 统计数据
   */
  async getQualityControlStatistics(params, tenantId) {
    const { startDate, endDate } = params;

    let whereClause = 'WHERE tenant_id = ?';
    const queryParams = [tenantId];

    if (startDate) {
      whereClause += ' AND qc_date >= ?';
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND qc_date <= ?';
      queryParams.push(endDate);
    }

    const [rows] = await db.execute(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN result = '合格' THEN 1 ELSE 0 END) as pass,
        SUM(CASE WHEN result = '不合格' THEN 1 ELSE 0 END) as fail,
        SUM(CASE WHEN result = '待检' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN result = '整改中' THEN 1 ELSE 0 END) as warning
       FROM quality_control_records ${whereClause}`,
      queryParams,
    );

    return rows[0];
  }

  /**
   * 获取资产的质控历史
   * @param {string} assetCode - 资产编码
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 质控历史
   */
  async getAssetQualityHistory(assetCode, tenantId) {
    const [rows] = await db.execute(
      `SELECT * FROM quality_control_records
       WHERE asset_code = ? AND tenant_id = ?
       ORDER BY qc_date DESC`,
      [assetCode, tenantId],
    );
    return rows;
  }

  /**
   * 分析质量趋势
   * @param {Object} params - 分析参数
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 趋势分析结果
   */
  async analyzeQualityTrend(params, tenantId) {
    const { startDate, endDate, interval = 'month' } = params;

    let dateFormat;
    switch (interval) {
      case 'week':
        dateFormat = '%Y-%u';
        break;
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      default:
        dateFormat = '%Y-%m';
    }

    let whereClause = 'WHERE tenant_id = ?';
    const queryParams = [tenantId];

    if (startDate) {
      whereClause += ' AND qc_date >= ?';
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND qc_date <= ?';
      queryParams.push(endDate);
    }

    const [rows] = await db.execute(
      `SELECT
        DATE_FORMAT(qc_date, '${dateFormat}') as period,
        COUNT(*) as total,
        SUM(CASE WHEN result = '合格' THEN 1 ELSE 0 END) as pass,
        SUM(CASE WHEN result = '不合格' THEN 1 ELSE 0 END) as fail
       FROM quality_control_records
       ${whereClause}
       GROUP BY DATE_FORMAT(qc_date, '${dateFormat}')
       ORDER BY period`,
      queryParams,
    );

    return rows;
  }

  /**
   * 分析缺陷分布
   * @param {Object} params - 分析参数
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 缺陷分布
   */
  async analyzeDefectDistribution(params, tenantId) {
    const { startDate, endDate } = params;

    let whereClause = 'WHERE tenant_id = ? AND result = ?';
    const queryParams = [tenantId, 'fail'];

    if (startDate) {
      whereClause += ' AND qc_date >= ?';
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND qc_date <= ?';
      queryParams.push(endDate);
    }

    const [rows] = await db.execute(
      `SELECT
        qc_type,
        COUNT(*) as count
       FROM quality_control_records
       ${whereClause}
       GROUP BY qc_type
       ORDER BY count DESC`,
      queryParams,
    );

    return rows;
  }
}

module.exports = new QualityAssuranceService();
