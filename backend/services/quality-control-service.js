const db = require('../config/database');
const {
  AppError,
  ValidationUtil,
  TransactionManager,
  DataAccessUtil,
} = require('../utils/error-handler');

/**
 * 质量控制服务
 * 符合《医疗器械监督管理条例》及《医疗器械使用质量监督管理办法》
 */
class QualityControlService {
  /**
   * 质控类型 - 符合医疗器械质量管理规范
   */
  static QC_TYPES = {
    ROUTINE: '日常质控',      // 日常质量控制
    PERIODIC: '定期质控',      // 定期质量控制
    SPECIAL: '专项质控',       // 专项质量控制（如计量检定）
    ACCEPTANCE: '验收质控',      // 验收质量控制
    OTHER: '其他',               // 其他
  };

  static VALID_QC_TYPES = Object.values(this.QC_TYPES);

  /**
   * 质控结果
   */
  static QC_RESULTS = {
    QUALIFIED: '合格',
    UNQUALIFIED: '不合格',
    PENDING: '待检',
    REMEDIATION: '整改中',  // 整改中（不合格需整改）
  };

  static VALID_RESULTS = Object.values(this.QC_RESULTS);

  /**
   * 质控状态
   */
  static QC_STATUS = {
    PENDING: '待检',
    IN_PROGRESS: '进行中',
    COMPLETED: '已完成',
    CANCELLED: '已取消',
    REMEDIATION: '整改中',
  };

  static VALID_STATUSES = Object.values(this.QC_STATUS);

  /**
   * 生成唯一的质控单号 - 使用数据库序列保证唯一性
   * @returns {Promise<string>} 质控单号
   */
  static async generateRecordNo(tenantId = 0) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}${month}${day}`;

    // 使用数据库序列生成序号，避免内存计数器在服务器重启后重复
    const [result] = await db.execute(
      `INSERT INTO qc_record_sequence (date_key, tenant_id, sequence_value) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE sequence_value = sequence_value + 1`,
      [dateKey, tenantId],
    );

    let sequence;
    if (result.insertId) {
      // 新插入的记录
      sequence = 1;
    } else {
      // 获取当前序列值
      const [rows] = await db.execute(
        'SELECT sequence_value FROM qc_record_sequence WHERE date_key = ? AND tenant_id = ?',
        [dateKey, tenantId],
      );
      sequence = rows[0]?.sequence_value || 1;
    }

    const sequenceStr = sequence.toString().padStart(4, '0');
    // 使用时间戳后4位+随机数作为后缀，进一步减少碰撞概率
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');

    return `QC${dateKey}${sequenceStr}${timestamp}${random}`;
  }

  static validateQualityControlInput(data) {
    const errors = [];

    if (data.asset_code !== undefined) {
      if (typeof data.asset_code !== 'string' || data.asset_code.length > 50) {
        errors.push('资产编号格式不正确（最长50字符）');
      }
    }

    if (data.qc_type !== undefined) {
      if (!this.VALID_QC_TYPES.includes(data.qc_type)) {
        errors.push(`质控类型必须是[${this.VALID_QC_TYPES.join(', ')}]之一`);
      }
    }

    if (data.result !== undefined) {
      if (!this.VALID_RESULTS.includes(data.result)) {
        errors.push(`质控结果必须是[${this.VALID_RESULTS.join(', ')}]之一`);
      }
    }

    if (data.status !== undefined) {
      if (!this.VALID_STATUSES.includes(data.status)) {
        errors.push(`状态必须是[${this.VALID_STATUSES.join(', ')}]之一`);
      }
    }

    if (data.qc_item !== undefined && data.qc_item.length > 200) {
      errors.push('质控项目不能超过200个字符');
    }

    if (data.qc_method !== undefined && data.qc_method.length > 200) {
      errors.push('质控方法不能超过200个字符');
    }

    if (data.qc_standard !== undefined && data.qc_standard.length > 200) {
      errors.push('质控标准不能超过200个字符');
    }

    if (data.qc_value !== undefined && data.qc_value.length > 100) {
      errors.push('质控数值不能超过100个字符');
    }

    if (data.standard_value !== undefined && data.standard_value.length > 100) {
      errors.push('标准值不能超过100个字符');
    }

    if (data.deviation !== undefined && data.deviation.length > 100) {
      errors.push('偏差不能超过100个字符');
    }

    if (data.qc_cycle !== undefined) {
      const cycle = parseInt(data.qc_cycle);
      if (isNaN(cycle) || cycle < 0 || cycle > 120) {
        errors.push('质控周期必须在0-120个月之间');
      }
    }

    if (data.warning_days !== undefined) {
      const days = parseInt(data.warning_days);
      if (isNaN(days) || days < 0 || days > 365) {
        errors.push('预警天数必须在0-365之间');
      }
    }

    return errors;
  }

  /**
   * 获取质量控制记录列表
   * @param {Object} params 查询参数
   * @param {Object} tenantFilter 租户过滤条件
   * @returns {Promise<Object>} 分页数据
   */
  static async getQualityControlRecords(params, tenantFilter) {
    const { page = 1, pageSize = 10, keyword, qc_type, result, status, start_date, end_date } = params;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    // 添加租户过滤
    whereClause += tenantFilter.whereClause;
    queryParams.push(...tenantFilter.params);

    // 添加关键词搜索
    if (keyword) {
      whereClause += ' AND (q.record_no LIKE ? OR q.asset_code LIKE ? OR q.asset_name LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      queryParams.push(likeKeyword, likeKeyword, likeKeyword);
    }

    // 添加质控类型筛选
    if (qc_type) {
      whereClause += ' AND q.qc_type = ?';
      queryParams.push(qc_type);
    }

    // 添加结果筛选
    if (result) {
      whereClause += ' AND q.result = ?';
      queryParams.push(result);
    }

    // 添加状态筛选
    if (status) {
      whereClause += ' AND q.status = ?';
      queryParams.push(status);
    }

    // 添加日期范围筛选
    if (start_date) {
      whereClause += ' AND q.qc_date >= ?';
      queryParams.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND q.qc_date <= ?';
      queryParams.push(end_date);
    }

    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total FROM quality_control_records q ${whereClause}`,
      queryParams,
    );

    const [rows] = await db.execute(
      `SELECT q.*, a.department, a.department_new
       FROM quality_control_records q
       LEFT JOIN assets a ON q.asset_code = a.asset_code AND a.tenant_id = q.tenant_id
       ${whereClause}
       ORDER BY q.qc_date DESC, q.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(pageSize), offset],
    );

    return {
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: totalResult[0].total,
        totalPages: Math.ceil(totalResult[0].total / pageSize),
      },
    };
  }

  /**
   * 获取质量控制记录详情
   * @param {string} id 记录ID
   * @param {Object} tenantFilter 租户过滤条件
   * @returns {Promise<Object|null>} 记录详情
   */
  static async getQualityControlRecordById(id, tenantFilter) {
    const [records] = await db.execute(
      `SELECT q.*, a.department, a.department_new
       FROM quality_control_records q
       LEFT JOIN assets a ON q.asset_code = a.asset_code AND a.tenant_id = q.tenant_id
       WHERE q.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    return records.length > 0 ? records[0] : null;
  }

  /**
   * 创建质量控制记录
   * @param {Object} data 记录数据
   * @param {string} tenantId 租户ID
   * @param {string} createdBy 创建人
   * @returns {Promise<Object>} 创建结果
   */
  static async createQualityControlRecord(data, tenantId, createdBy) {
    const errors = this.validateQualityControlInput(data);
    if (errors.length > 0) {
      throw new AppError(errors.join('; '), 400, 'VALIDATION_ERROR');
    }

    const {
      asset_code,
      qc_type,
      qc_date,
      qc_item,
      standard_value,
      actual_value,
      tolerance,
      result,
      qc_method,
      qc_person,
      department,
      remark,
      status = '待处理',
      next_qc_date,
      qc_cycle,
      warning_days = 30,
    } = data;

    // 生成唯一的质控单号
    const record_no = await this.generateRecordNo(tenantId);

    // 验证必填字段
    ValidationUtil.validateRequiredFields({ asset_code, qc_type, qc_date, qc_item, result }, [
      'asset_code',
      'qc_type',
      'qc_date',
      'qc_item',
      'result',
    ]);

    // 验证资产是否存在
    const assetResult = await DataAccessUtil.executeQuery(
      'SELECT id, asset_name FROM assets WHERE asset_code = ? AND tenant_id = ? LIMIT 1',
      [asset_code, tenantId],
    );

    if (!assetResult || assetResult.length === 0) {
      throw new AppError('资产不存在', 400, 'ASSET_NOT_FOUND');
    }

    // 开始事务
    const creationResult = await TransactionManager.executeTransaction(async connection => {
      const params = [
          tenantId,
          record_no,
          asset_code,
          assetResult[0].asset_name,
          qc_type,
          qc_date,
          qc_item,
          standard_value ?? null,
          actual_value ?? null,
          tolerance ?? null,
          result,
          qc_method ?? null,
          qc_person ?? null,
          department ?? null,
          remark ?? null,
          status,
          next_qc_date ?? null,
          qc_cycle ?? null,
          warning_days,
          createdBy ?? null,
        ];
      const [insertResult] = await connection.execute(
        `INSERT INTO quality_control_records (
          tenant_id, record_no, asset_code, asset_name, qc_type, qc_date,
          qc_item, standard_value, actual_value, tolerance,
          result, qc_method, qc_person, department, remark, status,
          next_qc_date, qc_cycle, warning_days,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params,
      );

      return {
        id: insertResult.insertId,
        record_no,
      };
    });

    return creationResult;
  }

  /**
   * 更新质量控制记录
   * @param {string} id 记录ID
   * @param {Object} data 更新数据
   * @param {Object} tenantFilter 租户过滤条件
   * @param {string} updatedBy 更新人
   * @returns {Promise<Object>} 更新结果
   */
  static async updateQualityControlRecord(id, data, tenantFilter, updatedBy) {
    const updateFields = [];
    const updateParams = [];

    Object.keys(data).forEach(key => {
      if (
        [
          'asset_code',
          'qc_type',
          'qc_date',
          'qc_item',
          'standard_value',
          'actual_value',
          'tolerance',
          'result',
          'qc_method',
          'qc_person',
          'department',
          'remark',
          'status',
        ].includes(key)
      ) {
        updateFields.push(`${key} = ?`);
        updateParams.push(data[key]);
      }
    });

    if (updateFields.length === 0) {
      throw new AppError('没有有效的更新字段', 400, 'NO_VALID_FIELDS');
    }

    // 添加更新时间
    updateFields.push('updated_at = NOW()');

    // 添加租户过滤条件
    const whereClause = `WHERE id = ? ${tenantFilter.whereClause}`;
    const allParams = [...updateParams, id, ...tenantFilter.params];

    // 验证记录是否存在且属于当前租户
    const [existingRecord] = await db.execute(
      `SELECT id, tenant_id FROM quality_control_records q WHERE id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (!existingRecord || existingRecord.length === 0) {
      throw new AppError('质量控制记录不存在或无权限操作', 404, 'RECORD_NOT_FOUND');
    }

    // 验证资产是否存在（仅当提供了资产编号时）
    if (data.asset_code) {
      const assetResult = await DataAccessUtil.executeQuery(
        'SELECT id, asset_name FROM assets WHERE asset_code = ? AND tenant_id = ? LIMIT 1',
        [data.asset_code, existingRecord[0].tenant_id],
      );

      if (!assetResult || assetResult.length === 0) {
        throw new AppError('资产不存在', 400, 'ASSET_NOT_FOUND');
      }

      // 更新资产名称
      updateFields.push('asset_name = ?');
      updateParams.push(assetResult[0].asset_name);
    }

    const [result] = await db.execute(
      `UPDATE quality_control_records q SET ${updateFields.join(', ')} ${whereClause}`,
      allParams,
    );

    return { id, affectedRows: result.affectedRows };
  }

  /**
   * 删除质量控制记录
   * @param {string} id 记录ID
   * @param {Object} tenantFilter 租户过滤条件
   * @returns {Promise<Object>} 删除结果
   */
  static async deleteQualityControlRecord(id, tenantFilter) {
    // 验证记录是否存在且属于当前租户
    const [existingRecord] = await db.execute(
      `SELECT id FROM quality_control_records q WHERE id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (!existingRecord || existingRecord.length === 0) {
      throw new AppError('质量控制记录不存在或无权限操作', 404, 'RECORD_NOT_FOUND');
    }

    const [result] = await db.execute(
      `DELETE FROM quality_control_records q WHERE id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    return { id, affectedRows: result.affectedRows };
  }

  /**
   * 获取质量控制统计
   * @param {Object} params 查询参数
   * @param {Object} tenantFilter 租户过滤条件
   * @returns {Promise<Object>} 统计数据
   */
  static async getQualityControlStatistics(params, tenantFilter) {
    const { start_date, end_date } = params || {};

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    // 添加租户过滤
    whereClause += tenantFilter.whereClause;
    queryParams.push(...tenantFilter.params);

    if (start_date) {
      whereClause += ' AND q.qc_date >= ?';
      queryParams.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND q.qc_date <= ?';
      queryParams.push(end_date);
    }

    // 总数统计
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total FROM quality_control_records q ${whereClause}`,
      queryParams,
    );

    // 按类型统计
    const [typeResult] = await db.execute(
      `SELECT qc_type, COUNT(*) as count FROM quality_control_records q ${whereClause} GROUP BY qc_type`,
      queryParams,
    );

    // 按结果统计
    const [resultResult] = await db.execute(
      `SELECT result, COUNT(*) as count FROM quality_control_records q ${whereClause} GROUP BY result`,
      queryParams,
    );

    // 按状态统计
    const [statusResult] = await db.execute(
      `SELECT status, COUNT(*) as count FROM quality_control_records q ${whereClause} GROUP BY status`,
      queryParams,
    );

    // 按月份统计（新增）
    const [monthlyResult] = await db.execute(
      `SELECT DATE_FORMAT(qc_date, '%Y-%m') as month, COUNT(*) as count
       FROM quality_control_records q ${whereClause}
       GROUP BY DATE_FORMAT(qc_date, '%Y-%m')
       ORDER BY month`,
      queryParams,
    );

    // 按部门统计（新增）
    const [deptResult] = await db.execute(
      `SELECT department, COUNT(*) as count
       FROM quality_control_records q ${whereClause}
       GROUP BY department
       HAVING department IS NOT NULL`,
      queryParams,
    );

    // 成功率统计（新增）
    const [successRateResult] = await db.execute(
      `SELECT
         SUM(CASE WHEN result = '合格' THEN 1 ELSE 0 END) as passed,
         SUM(CASE WHEN result = '不合格' THEN 1 ELSE 0 END) as failed,
         COUNT(*) as total
       FROM quality_control_records q ${whereClause}`,
      queryParams,
    );

    return {
      total: totalResult[0].total || 0,
      successRate:
        successRateResult[0].total > 0
          ? Math.round((successRateResult[0].passed / successRateResult[0].total) * 100)
          : 0,
      byType: typeResult.reduce((acc, row) => {
        acc[row.qc_type] = row.count;
        return acc;
      }, {}),
      byResult: resultResult.reduce((acc, row) => {
        acc[row.result] = row.count;
        return acc;
      }, {}),
      byStatus: statusResult.reduce((acc, row) => {
        acc[row.status] = row.count;
        return acc;
      }, {}),
      byMonth: monthlyResult.reduce((acc, row) => {
        acc[row.month] = row.count;
        return acc;
      }, {}),
      byDepartment: deptResult.reduce((acc, row) => {
        acc[row.department] = row.count;
        return acc;
      }, {}),
    };
  }

  /**
   * 获取高级质量控制统计分析
   * @param {Object} params 查询参数
   * @param {Object} tenantFilter 租户过滤条件
   * @returns {Promise<Object>} 高级统计数据
   */
  static async getAdvancedQualityControlStatistics(params, tenantFilter) {
    const { start_date, end_date } = params || {};

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    // 添加租户过滤
    whereClause += tenantFilter.whereClause;
    queryParams.push(...tenantFilter.params);

    if (start_date) {
      whereClause += ' AND q.qc_date >= ?';
      queryParams.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND q.qc_date <= ?';
      queryParams.push(end_date);
    }

    // 获取所有统计信息
    const [totalResult] = await db.execute(
      `SELECT
        COUNT(*) as total
       FROM quality_control_records q ${whereClause}`,
      queryParams,
    );

    // 按质检人员统计
    const [personResult] = await db.execute(
      `SELECT
         qc_person,
         COUNT(*) as count,
         SUM(CASE WHEN result = '合格' THEN 1 ELSE 0 END) as passed,
         SUM(CASE WHEN result = '不合格' THEN 1 ELSE 0 END) as failed
       FROM quality_control_records q ${whereClause}
       GROUP BY qc_person
       ORDER BY count DESC`,
      queryParams,
    );

    // 趋势分析
    const [trendResult] = await db.execute(
      `SELECT
         DATE_FORMAT(qc_date, '%Y-%m') as month,
         COUNT(*) as count,
         SUM(CASE WHEN result = '合格' THEN 1 ELSE 0 END) as passed,
         SUM(CASE WHEN result = '不合格' THEN 1 ELSE 0 END) as failed
       FROM quality_control_records q ${whereClause}
       GROUP BY DATE_FORMAT(qc_date, '%Y-%m')
       ORDER BY month`,
      queryParams,
    );

    // 按质检项目统计
    const [itemResult] = await db.execute(
      `SELECT
         qc_item,
         COUNT(*) as count,
         SUM(CASE WHEN result = '合格' THEN 1 ELSE 0 END) as passed,
         SUM(CASE WHEN result = '不合格' THEN 1 ELSE 0 END) as failed
       FROM quality_control_records q ${whereClause}
       GROUP BY qc_item
       HAVING qc_item IS NOT NULL
       ORDER BY count DESC`,
      queryParams,
    );

    // 不合格品分析
    const [defectResult] = await db.execute(
      `SELECT
         qc_item,
         COUNT(*) as defect_count
       FROM quality_control_records q
       ${whereClause} AND result = '不合格'
       GROUP BY qc_item
       ORDER BY defect_count DESC`,
      queryParams,
    );

    return {
      summary: {
        total: totalResult[0].total || 0,
        passRate:
          totalResult[0].total > 0
            ? Math.round(
                ((totalResult[0].total - defectResult.reduce((sum, r) => sum + r.defect_count, 0)) /
                  totalResult[0].total) *
                  100,
              )
            : 100,
      },
      byPerson: personResult.map(row => ({
        person: row.qc_person,
        count: row.count,
        passed: row.passed,
        failed: row.failed,
        passRate: row.count > 0 ? Math.round((row.passed / row.count) * 100) : 0,
      })),
      trends: trendResult.map(row => ({
        month: row.month,
        count: row.count,
        passed: row.passed,
        failed: row.failed,
        passRate: row.count > 0 ? Math.round((row.passed / row.count) * 100) : 0,
      })),
      byItem: itemResult.map(row => ({
        item: row.qc_item,
        count: row.count,
        passed: row.passed,
        failed: row.failed,
        passRate: row.count > 0 ? Math.round((row.passed / row.count) * 100) : 0,
      })),
      defects: defectResult.map(row => ({
        item: row.qc_item,
        count: row.defect_count,
      })),
    };
  }

  /**
   * 获取即将到期质控记录
   * @param {Object} params 查询参数
   * @param {Object} tenantFilter 租户过滤条件
   * @returns {Promise<Array>} 即将到期记录
   */
  static async getExpiringQualityControlRecords(params, tenantFilter) {
    const { days = 30 } = params;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    // 添加租户过滤
    whereClause += tenantFilter.whereClause;
    queryParams.push(...tenantFilter.params);

    // 示例查询：查找下次质检日期在未来几天内的记录
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + parseInt(days));

    const [rows] = await db.execute(
      `SELECT q.*, a.department, a.department_new
       FROM quality_control_records q
       LEFT JOIN assets a ON q.asset_code = a.asset_code AND a.tenant_id = q.tenant_id
       ${whereClause}
       AND q.next_qc_date IS NOT NULL
       AND q.next_qc_date <= ?
       AND q.status != '已完成'
       ORDER BY q.next_qc_date ASC`,
      [...queryParams, warningDate.toISOString().split('T')[0]],
    );

    return rows;
  }

  /**
   * 获取资产质量管理历史
   * @param {string} assetCode 资产编号
   * @param {Object} tenantFilter 租户过滤条件
   * @returns {Promise<Array>} 质量管理历史
   */
  static async getAssetQualityHistory(assetCode, tenantFilter) {
    // 获取计量记录
    const [metrologyRecords] = await db.execute(
      `SELECT m.*, 'metrology' as type FROM metrology_records m
       WHERE m.asset_code = ? ${tenantFilter.whereClause}`,
      [assetCode, ...tenantFilter.params],
    );

    // 获取质量控制记录
    const [qcRecords] = await db.execute(
      `SELECT q.*, 'quality_control' as type FROM quality_control_records q
       WHERE q.asset_code = ? ${tenantFilter.whereClause.replace('m.', 'q.')}`,
      [assetCode, ...tenantFilter.params],
    );

    const history = [...metrologyRecords, ...qcRecords].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );

    return history;
  }
}

module.exports = QualityControlService;
