/**
 * 员工资质服务
 * 处理员工资质相关业务逻辑
 */

const db = require('../../../config/database');
const { redis } = require('../../../services/redis');
const logger = require('../../../config/logger');

const CACHE_TTL = 300; // 缓存过期时间（秒）

// 错误类型定义
const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
};

/**
 * 构建租户过滤条件
 * @param {string} tenantId - 租户ID
 * @param {string} alias - 表别名
 * @returns {Object} 包含clause和params的对象
 */
const buildTenantScopedClause = (tenantId, alias = '') => {
  if (!tenantId) {
    return { clause: '', params: [] };
  }

  const prefix = alias ? `${alias}.` : '';
  return {
    clause: ` AND ${prefix}tenant_id = ?`,
    params: [tenantId],
  };
};

class StaffQualificationService {
  /**
   * 获取资质列表
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 资质列表和分页信息
   */
  async getQualifications(params) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      qualification_type,
      status,
      tenantId,
    } = params;

    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

    let whereClause = 'WHERE sq.tenant_id = ?';
    const queryParams = [tenantId];

    if (keyword) {
      whereClause +=
        ' AND (sq.qualification_name LIKE ? OR sq.certificate_no LIKE ? OR u.real_name LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (qualification_type) {
      whereClause += ' AND sq.qualification_type = ?';
      queryParams.push(qualification_type);
    }

    if (status) {
      whereClause += ' AND sq.status = ?';
      queryParams.push(status);
    }

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total
      FROM staff_qualifications sq
      LEFT JOIN users u ON sq.user_id = u.id
      ${whereClause}
    `;
    const [countRows] = await db.execute(countSql, queryParams);
    const { total } = countRows[0];

    // 获取数据
    const dataSql = `
      SELECT
        sq.*,
        u.username AS staff_username,
        u.real_name AS staff_real_name,
        DATEDIFF(sq.expiry_date, CURDATE()) AS days_until_expiry
      FROM staff_qualifications sq
      LEFT JOIN users u ON sq.user_id = u.id
      ${whereClause}
      ORDER BY sq.expiry_date ASC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await db.execute(dataSql, [
      ...queryParams,
      parseInt(pageSize, 10),
      offset,
    ]);

    return {
      data: rows.map(this._formatQualification),
      pagination: {
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize, 10)),
      },
    };
  }

  /**
   * 获取即将到期的资质
   * @param {number} days - 天数阈值
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 即将到期的资质列表
   */
  async getExpiringQualifications(days = 90, tenantId) {
    const sql = `
      SELECT
        sq.*,
        u.username AS staff_username,
        u.real_name AS staff_real_name,
        DATEDIFF(sq.expiry_date, CURDATE()) AS days_until_expiry
      FROM staff_qualifications sq
      LEFT JOIN users u ON sq.user_id = u.id
      WHERE sq.tenant_id = ?
        AND sq.expiry_date IS NOT NULL
        AND sq.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
        AND sq.status = 'active'
      ORDER BY sq.expiry_date ASC
    `;

    const [rows] = await db.execute(sql, [tenantId, days]);
    return rows.map(this._formatQualification);
  }

  /**
   * 获取资质详情
   * @param {number} id - 资质ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object|null>} 资质详情
   */
  async getQualificationById(id, tenantId) {
    const sql = `
      SELECT
        sq.*,
        u.username AS staff_username,
        u.real_name AS staff_real_name,
        DATEDIFF(sq.expiry_date, CURDATE()) AS days_until_expiry
      FROM staff_qualifications sq
      LEFT JOIN users u ON sq.user_id = u.id
      WHERE sq.id = ? AND sq.tenant_id = ?
    `;

    const [rows] = await db.execute(sql, [id, tenantId]);

    if (rows.length === 0) {
      return null;
    }

    return this._formatQualification(rows[0]);
  }

  /**
   * 创建资质
   * @param {Object} qualificationData - 资质数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createQualification(qualificationData, tenantId) {
    const {
      user_id,
      qualification_type,
      qualification_name,
      qualification_level,
      certificate_no,
      issuing_authority,
      issue_date,
      expiry_date,
      professional_field,
      applicable_equipment,
      certificate_image,
      attachments,
      remarks,
      status = 'active',
    } = qualificationData;

    // 检查用户是否存在
    const [users] = await db.execute(
      'SELECT id FROM users WHERE id = ? AND tenant_id = ?',
      [user_id, tenantId],
    );

    if (users.length === 0) {
      throw new Error('用户不存在或不属于当前租户');
    }

    const [result] = await db.execute(
      `INSERT INTO staff_qualifications (
        tenant_id, user_id, qualification_type, qualification_name, qualification_level,
        certificate_no, issuing_authority, issue_date, expiry_date,
        professional_field, applicable_equipment, certificate_image, attachments, remarks, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        user_id,
        qualification_type,
        qualification_name,
        qualification_level || null,
        certificate_no || null,
        issuing_authority || null,
        issue_date,
        expiry_date || null,
        professional_field || null,
        applicable_equipment || null,
        certificate_image || null,
        JSON.stringify(attachments || null),
        remarks || null,
        status,
      ],
    );

    return {
      id: result.insertId,
      qualification_code: `QL-${String(result.insertId).padStart(6, '0')}`,
    };
  }

  /**
   * 更新资质
   * @param {number} id - 资质ID
   * @param {Object} qualificationData - 更新的资质数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 更新结果
   */
  async updateQualification(id, qualificationData, tenantId) {
    const updateFields = [];
    const updateValues = [];

    const allowedFields = [
      'user_id',
      'qualification_type',
      'qualification_name',
      'qualification_level',
      'certificate_no',
      'issuing_authority',
      'issue_date',
      'expiry_date',
      'professional_field',
      'applicable_equipment',
      'certificate_image',
      'attachments',
      'remarks',
      'status',
    ];

    for (const field of allowedFields) {
      if (qualificationData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        if (field === 'attachments') {
          updateValues.push(JSON.stringify(qualificationData[field]));
        } else {
          updateValues.push(qualificationData[field]);
        }
      }
    }

    if (updateFields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id, tenantId);

    const [result] = await db.execute(
      `UPDATE staff_qualifications SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      updateValues,
    );

    return result.affectedRows > 0;
  }

  /**
   * 删除资质
   * @param {number} id - 资质ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteQualification(id, tenantId) {
    const [result] = await db.execute(
      'DELETE FROM staff_qualifications WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    return result.affectedRows > 0;
  }

  /**
   * 获取培训记录列表
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 培训记录列表和分页信息
   */
  async getTrainingRecords(params) {
    const {
      page = 1,
      pageSize = 20,
      user_id,
      training_type,
      start_date,
      end_date,
      tenantId,
    } = params;

    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

    let whereClause = 'WHERE str.tenant_id = ?';
    const queryParams = [tenantId];

    if (user_id) {
      whereClause += ' AND str.user_id = ?';
      queryParams.push(user_id);
    }

    if (training_type) {
      whereClause += ' AND str.training_type = ?';
      queryParams.push(training_type);
    }

    if (start_date) {
      whereClause += ' AND str.training_date >= ?';
      queryParams.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND str.training_date <= ?';
      queryParams.push(end_date);
    }

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total
      FROM staff_training_records str
      LEFT JOIN users u ON str.user_id = u.id
      ${whereClause}
    `;
    const [countRows] = await db.execute(countSql, queryParams);
    const { total } = countRows[0];

    // 获取数据
    const dataSql = `
      SELECT
        str.*,
        u.username AS staff_username,
        u.real_name AS staff_real_name
      FROM staff_training_records str
      LEFT JOIN users u ON str.user_id = u.id
      ${whereClause}
      ORDER BY str.training_date DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await db.execute(dataSql, [
      ...queryParams,
      parseInt(pageSize, 10),
      offset,
    ]);

    return {
      data: rows.map(this._formatTrainingRecord),
      pagination: {
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize, 10)),
      },
    };
  }

  /**
   * 创建培训记录
   * @param {Object} trainingData - 培训数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createTrainingRecord(trainingData, tenantId) {
    const {
      user_id,
      training_type,
      training_name,
      training_content,
      training_method,
      training_date,
      training_duration,
      training_location,
      trainer,
      assessment_required,
      assessment_score,
      assessment_result,
      certificate_no,
      related_equipment,
      attachments,
      remarks,
    } = trainingData;

    const [result] = await db.execute(
      `INSERT INTO staff_training_records (
        tenant_id, user_id, training_type, training_name, training_content, training_method,
        training_date, training_duration, training_location, trainer,
        assessment_required, assessment_score, assessment_result, certificate_no,
        related_equipment, attachments, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        user_id,
        training_type || null,
        training_name,
        training_content || null,
        training_method || 'offline',
        training_date || new Date().toISOString().slice(0, 10),
        training_duration || 0,
        training_location || null,
        trainer || null,
        assessment_required || false,
        assessment_score || null,
        assessment_result || null,
        certificate_no || null,
        related_equipment || null,
        JSON.stringify(attachments || null),
        remarks || null,
        user_id,
      ],
    );

    return {
      id: result.insertId,
      training_code: `TR-${String(result.insertId).padStart(6, '0')}`,
    };
  }

  /**
   * 获取考核记录列表
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 考核记录列表和分页信息
   */
  async getAssessments(params) {
    const { page = 1, pageSize = 20, assessment_type, tenantId } = params;

    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

    let whereClause = 'WHERE ar.tenant_id = ?';
    const queryParams = [tenantId];

    if (assessment_type) {
      whereClause += ' AND ar.assessment_type = ?';
      queryParams.push(assessment_type);
    }

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total
      FROM staff_assessment_records ar
      LEFT JOIN users u ON ar.user_id = u.id
      ${whereClause}
    `;
    const [countRows] = await db.execute(countSql, queryParams);
    const { total } = countRows[0];

    // 获取数据
    const dataSql = `
      SELECT
        ar.*,
        u.username AS staff_username,
        u.real_name AS staff_real_name
      FROM staff_assessment_records ar
      LEFT JOIN users u ON ar.user_id = u.id
      ${whereClause}
      ORDER BY ar.assessment_date DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await db.execute(dataSql, [
      ...queryParams,
      parseInt(pageSize, 10),
      offset,
    ]);

    return {
      data: rows.map(this._formatAssessment),
      pagination: {
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize, 10)),
      },
    };
  }

  /**
   * 创建考核记录
   * @param {Object} assessmentData - 考核数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createAssessment(assessmentData, tenantId) {
    const {
      user_id,
      assessment_name,
      assessment_type,
      assessment_date,
      score,
      result,
      examiner_id,
      feedback,
    } = assessmentData;

    // 计算考核结果
    const normalizedResult = this._normalizeResult(score, result);

    const [result_record] = await db.execute(
      `INSERT INTO staff_assessment_records (
        tenant_id, user_id, assessment_name, assessment_type, assessment_date,
        score, result, examiner_id, feedback, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        user_id,
        assessment_name || '能力考核',
        assessment_type || null,
        assessment_date || new Date().toISOString().slice(0, 10),
        score || 0,
        normalizedResult,
        examiner_id || null,
        feedback || null,
        'completed',
      ],
    );

    return {
      id: result_record.insertId,
      assessment_code: `AS-${String(result_record.insertId).padStart(6, '0')}`,
    };
  }

  /**
   * 获取资质统计
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 统计信息
   */
  async getStatistics(tenantId) {
    // 资质类型统计
    const [qualificationTypeStats] = await db.execute(
      `SELECT
        qualification_type,
        COUNT(*) AS total_count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count,
        SUM(
          CASE
            WHEN expiry_date IS NOT NULL
              AND DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND 90
            THEN 1
            ELSE 0
          END
        ) AS expiring_count,
        SUM(
          CASE
            WHEN expiry_date IS NOT NULL
              AND DATEDIFF(expiry_date, CURDATE()) < 0
            THEN 1
            ELSE 0
          END
        ) AS expired_count
      FROM staff_qualifications
      WHERE tenant_id = ?
      GROUP BY qualification_type
      ORDER BY total_count DESC`,
      [tenantId],
    );

    // 培训统计
    const [trainingStats] = await db.execute(
      `SELECT
        training_type,
        COUNT(*) AS total_count,
        SUM(COALESCE(training_duration, 0)) AS total_hours
      FROM staff_training_records
      WHERE tenant_id = ?
      GROUP BY training_type
      ORDER BY total_count DESC`,
      [tenantId],
    );

    // 即将到期的资质数量
    const [[expirySummary]] = await db.execute(
      `SELECT
        SUM(
          CASE
            WHEN expiry_date IS NOT NULL
              AND DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND 90
            THEN 1
            ELSE 0
          END
        ) AS expiring_count,
        SUM(
          CASE
            WHEN expiry_date IS NOT NULL
              AND DATEDIFF(expiry_date, CURDATE()) < 0
            THEN 1
            ELSE 0
          END
        ) AS expired_count,
        COUNT(*) AS total_count
      FROM staff_qualifications
      WHERE tenant_id = ?`,
      [tenantId],
    );

    return {
      qualification_type_stats: qualificationTypeStats,
      training_stats: trainingStats,
      expiring_count: expirySummary?.expiring_count || 0,
      expired_count: expirySummary?.expired_count || 0,
      total_count: expirySummary?.total_count || 0,
    };
  }

  /**
   * 推导资质状态
   * @private
   */
  _deriveQualificationStatus(row) {
    if (row.status === 'expired' || row.status === 'expiring') {
      return row.status;
    }

    const daysUntilExpiry = row.days_until_expiry;
    if (Number.isFinite(daysUntilExpiry)) {
      if (daysUntilExpiry < 0) {
        return 'expired';
      }
      if (daysUntilExpiry <= 90) {
        return 'expiring';
      }
    }

    if (row.expiry_date) {
      const days = Math.ceil(
        (new Date(row.expiry_date) - new Date()) / (1000 * 60 * 60 * 24),
      );
      if (days < 0) {
        return 'expired';
      }
      if (days <= 90) {
        return 'expiring';
      }
    }

    return row.status || 'active';
  }

  /**
   * 格式化资质记录
   * @private
   */
  _formatQualification = (row) => {
    let attachments = row.attachments;
    if (typeof attachments === 'string') {
      try {
        attachments = JSON.parse(attachments);
      } catch {
        attachments = null;
      }
    }

    return {
      ...row,
      attachments,
      staff_id: row.user_id,
      staff_name: row.staff_real_name || row.staff_username || '',
      qualification_code:
        row.qualification_code || `QL-${String(row.id).padStart(6, '0')}`,
      status: this._deriveQualificationStatus(row),
    };
  };

  /**
   * 格式化培训记录
   * @private
   */
  _formatTrainingRecord(row) {
    let {attachments} = row;
    if (typeof attachments === 'string') {
      try {
        attachments = JSON.parse(attachments);
      } catch {
        attachments = null;
      }
    }

    return {
      ...row,
      attachments,
      training_code:
        row.training_code || `TR-${String(row.id).padStart(6, '0')}`,
      duration:
        row.duration ||
        row.duration_hours ||
        row.training_duration ||
        0,
      instructor: row.instructor || row.trainer || '',
    };
  }

  /**
   * 格式化考核记录
   * @private
   */
  _formatAssessment(row) {
    return {
      ...row,
      assessment_code:
        row.assessment_code || `AS-${String(row.id).padStart(6, '0')}`,
      staff_name: row.staff_real_name || row.staff_username || '',
      examiner_name: row.examiner_name || row.evaluator_name || '',
      result: this._normalizeResult(row.score, row.result),
    };
  }

  /**
   * 规范化考核结果
   * @private
   */
  _normalizeResult(score, result) {
    const normalized = String(result || '').toLowerCase();
    if (['excellent', 'good', 'qualified', 'unqualified'].includes(normalized)) {
      return normalized;
    }

    const numericScore = Number(score);
    if (!Number.isFinite(numericScore)) {
      return 'pass';
    }

    if (numericScore >= 90) {
      return 'excellent';
    }
    if (numericScore >= 80) {
      return 'good';
    }
    if (numericScore >= 60) {
      return 'qualified';
    }
    return 'unqualified';
  }
}

module.exports = new StaffQualificationService();
