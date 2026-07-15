/**
 * 风险评估服务
 */
const db = require('../../../config/database');
const logger = require('../../../config/logger');

class RiskAssessmentService {
  /**
   * 获取风险评估列表
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 风险评估列表和分页信息
   */
  async getRiskAssessments(params) {
    const { page = 1, pageSize = 20, keyword, riskLevel, assetCode, tenantId } = params;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE rar.tenant_id = ?';
    const queryParams = [tenantId];

    if (keyword) {
      whereClause += ' AND (a.asset_name LIKE ? OR a.asset_code LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (riskLevel) {
      whereClause += ' AND rar.risk_level = ?';
      queryParams.push(riskLevel);
    }

    if (assetCode) {
      whereClause += ' AND rar.asset_code = ?';
      queryParams.push(assetCode);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM risk_assessment_records rar ${whereClause}`,
      queryParams,
    );
    const { total } = countRows[0];

    const [rows] = await db.execute(
      `SELECT rar.*, a.asset_name, a.asset_code
       FROM risk_assessment_records rar
       LEFT JOIN assets a ON rar.asset_code = a.asset_code AND a.tenant_id = rar.tenant_id AND a.is_deleted = 0
       ${whereClause}
       ORDER BY rar.assessed_at DESC
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
   * 获取风险评估详情
   * @param {number} id - 评估ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 风险评估详情
   */
  async getRiskAssessmentById(id, tenantId) {
    const [rows] = await db.execute(
      `SELECT rar.*, a.asset_name, a.asset_code
       FROM risk_assessment_records rar
       LEFT JOIN assets a ON rar.asset_code = a.asset_code AND a.tenant_id = rar.tenant_id AND a.is_deleted = 0
       WHERE rar.id = ? AND rar.tenant_id = ?`,
      [id, tenantId],
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 创建风险评估
   * @param {Object} assessmentData - 评估数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createRiskAssessment(assessmentData, tenantId) {
    const { asset_code, score, risk_level, assessment_items, remarks, assessor } = assessmentData;

    if (!asset_code || score === undefined) {
      throw new Error('资产编码和评分不能为空');
    }

    const [result] = await db.execute(
      `INSERT INTO risk_assessment_records
       (tenant_id, asset_code, score, risk_level, assessment_items, remarks, assessor)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        asset_code,
        score,
        risk_level || this.calculateRiskLevel(score),
        assessment_items ? JSON.stringify(assessment_items) : null,
        remarks || null,
        assessor || null,
      ],
    );

    // 更新资产风险等级
    await this.updateAssetRiskLevel(asset_code, risk_level || this.calculateRiskLevel(score), tenantId);

    return { id: result.insertId };
  }

  /**
   * 更新风险评估
   * @param {number} id - 评估ID
   * @param {Object} assessmentData - 评估数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 更新结果
   */
  async updateRiskAssessment(id, assessmentData, tenantId) {
    const { score, risk_level, assessment_items, remarks, assessor } = assessmentData;

    const updateFields = [];
    const updateValues = [];

    if (score !== undefined) {
      updateFields.push('score = ?');
      updateValues.push(score);
    }
    if (risk_level !== undefined) {
      updateFields.push('risk_level = ?');
      updateValues.push(risk_level);
    }
    if (assessment_items !== undefined) {
      updateFields.push('assessment_items = ?');
      updateValues.push(JSON.stringify(assessment_items));
    }
    if (remarks !== undefined) {
      updateFields.push('remarks = ?');
      updateValues.push(remarks);
    }
    if (assessor !== undefined) {
      updateFields.push('assessor = ?');
      updateValues.push(assessor);
    }

    if (updateFields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id, tenantId);

    const [result] = await db.execute(
      `UPDATE risk_assessment_records SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      updateValues,
    );

    // 如果更新了评分，重新计算风险等级
    if (score !== undefined) {
      const assessment = await this.getRiskAssessmentById(id, tenantId);
      if (assessment) {
        await this.updateAssetRiskLevel(
          assessment.asset_code,
          risk_level || this.calculateRiskLevel(score),
          tenantId,
        );
      }
    }

    return result.affectedRows > 0;
  }

  /**
   * 计算风险等级
   * @param {number} score - 评分
   * @returns {string} 风险等级
   */
  calculateRiskLevel(score) {
    if (score >= 90) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * 更新资产风险等级
   * @param {string} assetCode - 资产编码
   * @param {string} riskLevel - 风险等级
   * @param {string} tenantId - 租户ID
   */
  async updateAssetRiskLevel(assetCode, riskLevel, tenantId) {
    await db.execute(
      `INSERT INTO asset_risk_levels (tenant_id, asset_code, risk_level, updated_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE risk_level = ?, updated_at = NOW()`,
      [tenantId, assetCode, riskLevel, riskLevel],
    );
  }

  /**
   * 删除风险评估
   * @param {number} id - 评估ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteRiskAssessment(id, tenantId) {
    const [result] = await db.execute('DELETE FROM risk_assessment_records WHERE id = ? AND tenant_id = ?', [
      id,
      tenantId,
    ]);
    return result.affectedRows > 0;
  }
}

module.exports = new RiskAssessmentService();
