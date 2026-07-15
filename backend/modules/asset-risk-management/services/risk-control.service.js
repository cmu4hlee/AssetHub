/**
 * 风险控制服务
 */
const db = require('../../../config/database');
const logger = require('../../../config/logger');

class RiskControlService {
  /**
   * 获取风险控制措施列表
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 控制措施列表和分页信息
   */
  async getRiskControls(params) {
    const { page = 1, pageSize = 20, keyword, riskLevel, status, tenantId } = params;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE rcm.tenant_id = ?';
    const queryParams = [tenantId];

    if (keyword) {
      whereClause += ' AND (rcm.control_name LIKE ? OR rcm.description LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (riskLevel) {
      whereClause += ' AND rcm.risk_level = ?';
      queryParams.push(riskLevel);
    }

    if (status) {
      whereClause += ' AND rcm.status = ?';
      queryParams.push(status);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM risk_control_measures rcm ${whereClause}`,
      queryParams,
    );
    const { total } = countRows[0];

    const [rows] = await db.execute(
      `SELECT rcm.*, a.asset_name, a.asset_code
       FROM risk_control_measures rcm
       LEFT JOIN assets a ON rcm.asset_code = a.asset_code AND a.tenant_id = rcm.tenant_id AND a.is_deleted = 0
       ${whereClause}
       ORDER BY rcm.created_at DESC
       LIMIT ? OFFSET ?`,
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
   * 获取风险控制措施详情
   * @param {number} id - 控制措施ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 控制措施详情
   */
  async getRiskControlById(id, tenantId) {
    const [rows] = await db.execute(
      `SELECT rcm.*, a.asset_name, a.asset_code
       FROM risk_control_measures rcm
       LEFT JOIN assets a ON rcm.asset_code = a.asset_code AND a.tenant_id = rcm.tenant_id AND a.is_deleted = 0
       WHERE rcm.id = ? AND rcm.tenant_id = ?`,
      [id, tenantId],
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 创建风险控制措施
   * @param {Object} controlData - 控制措施数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createRiskControl(controlData, tenantId) {
    const { asset_code, control_name, risk_level, description, implementation_date, deadline, responsible_person, status } = controlData;

    if (!asset_code || !control_name) {
      throw new Error('资产编码和控制措施名称不能为空');
    }

    const [result] = await db.execute(
      `INSERT INTO risk_control_measures
       (tenant_id, asset_code, control_name, risk_level, description, implementation_date, deadline, responsible_person, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        asset_code,
        control_name,
        risk_level || 'medium',
        description || null,
        implementation_date || null,
        deadline || null,
        responsible_person || null,
        status || 'pending',
      ],
    );

    return { id: result.insertId };
  }

  /**
   * 更新风险控制措施
   * @param {number} id - 控制措施ID
   * @param {Object} controlData - 控制措施数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 更新结果
   */
  async updateRiskControl(id, controlData, tenantId) {
    const { control_name, risk_level, description, implementation_date, deadline, responsible_person, status } = controlData;

    const updateFields = [];
    const updateValues = [];

    if (control_name !== undefined) {
      updateFields.push('control_name = ?');
      updateValues.push(control_name);
    }
    if (risk_level !== undefined) {
      updateFields.push('risk_level = ?');
      updateValues.push(risk_level);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (implementation_date !== undefined) {
      updateFields.push('implementation_date = ?');
      updateValues.push(implementation_date);
    }
    if (deadline !== undefined) {
      updateFields.push('deadline = ?');
      updateValues.push(deadline);
    }
    if (responsible_person !== undefined) {
      updateFields.push('responsible_person = ?');
      updateValues.push(responsible_person);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id, tenantId);

    const [result] = await db.execute(
      `UPDATE risk_control_measures SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      updateValues,
    );

    return result.affectedRows > 0;
  }

  /**
   * 删除风险控制措施
   * @param {number} id - 控制措施ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteRiskControl(id, tenantId) {
    const [result] = await db.execute('DELETE FROM risk_control_measures WHERE id = ? AND tenant_id = ?', [
      id,
      tenantId,
    ]);
    return result.affectedRows > 0;
  }

  /**
   * 获取高风险资产列表
   * @param {Object} params - 查询参数
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 高风险资产列表
   */
  async getHighRiskAssets(params, tenantId) {
    const { threshold = 70 } = params;

    const [rows] = await db.execute(
      `SELECT arl.*, a.asset_name, a.asset_code, a.asset_status
       FROM asset_risk_levels arl
       LEFT JOIN assets a ON arl.asset_code = a.asset_code AND a.tenant_id = arl.tenant_id AND a.is_deleted = 0
       WHERE arl.tenant_id = ? AND arl.risk_level IN ('high', 'critical')
       ORDER BY
         CASE arl.risk_level
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           ELSE 4
         END`,
      [tenantId],
    );

    return rows;
  }
}

module.exports = new RiskControlService();
