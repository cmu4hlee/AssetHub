const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const {
  AppError,
  ValidationUtil,
  TransactionManager,
  DataAccessUtil,
} = require('../utils/error-handler');
const { getTenantId, addTenantFilter } = require('../middleware/tenant-filter');

class MetrologyService {
  /**
   * 生成唯一的计量单号 - 使用数据库序列保证唯一性
   * @returns {Promise<string>} 计量单号
   */
  static async generateRecordNo(tenantId = 0) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}${month}${day}`;

    // 使用数据库序列生成序号，避免内存计数器在服务器重启后重复
    try {
      const [result] = await db.execute(
        `INSERT INTO metrology_record_sequence (date_key, tenant_id, sequence_value) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE sequence_value = sequence_value + 1`,
        [dateKey, tenantId],
      );

      let sequence;
      if (result.insertId) {
        sequence = 1;
      } else {
        const [rows] = await db.execute(
          'SELECT sequence_value FROM metrology_record_sequence WHERE date_key = ? AND tenant_id = ?',
          [dateKey, tenantId],
        );
        sequence = rows[0]?.sequence_value || 1;
      }

      const sequenceStr = sequence.toString().padStart(4, '0');
      const timestamp = Date.now().toString().slice(-4);
      const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');

      return `MT${dateKey}${sequenceStr}${timestamp}${random}`;
    } catch (error) {
      // 如果序列表不存在，使用备用方案（基于时间戳+随机数）
      console.warn('计量序列表不存在，使用备用编号生成方案:', error.message);
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `MT${dateKey}${timestamp}${random}`;
    }
  }

  /**
   * 计量类型 - 符合《中华人民共和国计量法》及其实施细则
   * - 强制检定: 用于贸易结算、安全防护、医疗卫生、环境监测等方面的计量器具
   * - 非强制检定: 其他计量器具
   * - 校准: 确定计量器具示值误差并进行校正
   * - 测试: 对计量器具进行功能性能测试
   * - 期间核查: 为保持计量器具校准状态的可信度而进行的核查
   */
  static METROLOGY_TYPES = {
    COMPULSORY: '强制检定',      // 强制检定（计量法第九条）
    NON_COMPULSORY: '非强制检定', // 非强制检定
    CALIBRATION: '校准',          // 校准
    TESTING: '测试',              // 测试
    INTERIM_CHECK: '期间核查',    // 期间核查
    OTHER: '其他',                 // 其他
  };

  static VALID_METROLOGY_TYPES = Object.values(this.METROLOGY_TYPES);

  /**
   * 计量结果 - 符合计量检定规程
   */
  static METROLOGY_RESULTS = {
    QUALIFIED: '合格',
    UNQUALIFIED: '不合格',
    LIMITED: '限用',    // 限用（可降级使用）
    PENDING: '待检',
  };

  static VALID_RESULTS = Object.values(this.METROLOGY_RESULTS);

  /**
   * 计量状态
   */
  static METROLOGY_STATUS = {
    PENDING: '待检',
    IN_PROGRESS: '进行中',
    COMPLETED: '已完成',
    CANCELLED: '已取消',
  };

  static VALID_STATUSES = Object.values(this.METROLOGY_STATUS);

  static validateMetrologyInput(data) {
    const errors = [];

    if (data.asset_code != null) {
      if (typeof data.asset_code !== 'string' || data.asset_code.length > 50) {
        errors.push('资产编号格式不正确（最长50字符）');
      }
    }

    if (data.metrology_type != null) {
      // 兼容旧数据 + AI 提取的常见变体
      const typeMapping = {
        // 旧称
        '首次检定': this.METROLOGY_TYPES.NON_COMPULSORY,
        '周期检定': this.METROLOGY_TYPES.COMPULSORY,
        '期间核查': this.METROLOGY_TYPES.INTERIM_CHECK,
        // AI 常见变体
        '检定': this.METROLOGY_TYPES.COMPULSORY,
        '校准': this.METROLOGY_TYPES.CALIBRATION,
        '测试': this.METROLOGY_TYPES.TESTING,
        '检测': this.METROLOGY_TYPES.TESTING,
        '其他': this.METROLOGY_TYPES.OTHER,
        '其它': this.METROLOGY_TYPES.OTHER,
      };
      let normalizedType = data.metrology_type;
      if (typeMapping[normalizedType]) {
        normalizedType = typeMapping[normalizedType];
      }

      if (!this.VALID_METROLOGY_TYPES.includes(normalizedType)) {
        errors.push(`计量类型必须是[${this.VALID_METROLOGY_TYPES.join(', ')}]之一`);
      }
    }

    if (data.result != null) {
      // AI 提取的常见变体 → 标准化
      const resultMapping = {
        '合格': this.METROLOGY_RESULTS.QUALIFIED,
        '通过': this.METROLOGY_RESULTS.QUALIFIED,
        '符合': this.METROLOGY_RESULTS.QUALIFIED,
        'pass': this.METROLOGY_RESULTS.QUALIFIED,
        'passed': this.METROLOGY_RESULTS.QUALIFIED,
        '合格/通过': this.METROLOGY_RESULTS.QUALIFIED,
        '不合格': this.METROLOGY_RESULTS.UNQUALIFIED,
        '不通过': this.METROLOGY_RESULTS.UNQUALIFIED,
        '不符合': this.METROLOGY_RESULTS.UNQUALIFIED,
        'fail': this.METROLOGY_RESULTS.UNQUALIFIED,
        'failed': this.METROLOGY_RESULTS.UNQUALIFIED,
        '限用': this.METROLOGY_RESULTS.LIMITED,
        '降级': this.METROLOGY_RESULTS.LIMITED,
        '待检': this.METROLOGY_RESULTS.PENDING,
        '待定': this.METROLOGY_RESULTS.PENDING,
        '待确认': this.METROLOGY_RESULTS.PENDING,
      };
      let normalizedResult = data.result;
      if (resultMapping[normalizedResult]) {
        normalizedResult = resultMapping[normalizedResult];
      }

      if (!this.VALID_RESULTS.includes(normalizedResult)) {
        errors.push(`计量结果必须是[${this.VALID_RESULTS.join(', ')}]之一`);
      }
    }

    if (data.status != null) {
      if (!this.VALID_STATUSES.includes(data.status)) {
        errors.push(`状态必须是[${this.VALID_STATUSES.join(', ')}]之一`);
      }
    }

    if (data.cost != null) {
      const cost = parseFloat(data.cost);
      if (isNaN(cost) || cost < 0 || cost > 999999.99) {
        errors.push('计量费用必须在0-999999.99之间');
      }
    }

    if (data.accuracy_level != null && data.accuracy_level.length > 50) {
      errors.push('准确度等级不能超过50个字符');
    }

    if (data.measurement_range != null && data.measurement_range.length > 100) {
      errors.push('测量范围不能超过100个字符');
    }

    if (data.metrology_agency != null && data.metrology_agency.length > 200) {
      errors.push('计量机构不能超过200个字符');
    }

    if (data.certificate_no != null && data.certificate_no.length > 100) {
      errors.push('证书编号不能超过100个字符');
    }

    if (data.metrology_cycle != null) {
      const cycle = parseInt(data.metrology_cycle);
      if (isNaN(cycle) || cycle < 0 || cycle > 120) {
        errors.push('计量周期必须在0-120个月之间');
      }
    }

    if (data.warning_days != null) {
      const days = parseInt(data.warning_days);
      if (isNaN(days) || days < 0 || days > 365) {
        errors.push('预警天数必须在0-365之间');
      }
    }

    return errors;
  }

  /**
   * 归一化计量记录的枚举字段（计量类型 / 结果 / 状态），返回规范化后的值。
   * 与 createMetrologyRecord 中的映射保持一致，作为批量导入与单条创建的单一来源。
   * @param {Object} data 原始记录数据
   * @returns {{ normalized: Object, errors: string[] }} 归一化后的数据与错误列表
   */
  static normalizeMetrologyEnums(data = {}) {
    const normalized = { ...data };
    const errors = [];

    // 计量类型映射（兼容旧称与 AI 提取变体）
    const typeMapping = {
      '首次检定': this.METROLOGY_TYPES.NON_COMPULSORY,
      '周期检定': this.METROLOGY_TYPES.COMPULSORY,
      '期间核查': this.METROLOGY_TYPES.INTERIM_CHECK,
      '检定': this.METROLOGY_TYPES.COMPULSORY,
      '校准': this.METROLOGY_TYPES.CALIBRATION,
      '测试': this.METROLOGY_TYPES.TESTING,
      '检测': this.METROLOGY_TYPES.TESTING,
      '其他': this.METROLOGY_TYPES.OTHER,
      '其它': this.METROLOGY_TYPES.OTHER,
    };
    if (data.metrology_type != null && data.metrology_type !== '') {
      normalized.metrology_type = typeMapping[data.metrology_type] || data.metrology_type;
      if (!this.VALID_METROLOGY_TYPES.includes(normalized.metrology_type)) {
        errors.push(`计量类型必须是[${this.VALID_METROLOGY_TYPES.join(', ')}]之一`);
      }
    }

    // 计量结果映射
    const resultMapping = {
      '合格': this.METROLOGY_RESULTS.QUALIFIED,
      '通过': this.METROLOGY_RESULTS.QUALIFIED,
      '符合': this.METROLOGY_RESULTS.QUALIFIED,
      'pass': this.METROLOGY_RESULTS.QUALIFIED,
      'passed': this.METROLOGY_RESULTS.QUALIFIED,
      '合格/通过': this.METROLOGY_RESULTS.QUALIFIED,
      '不合格': this.METROLOGY_RESULTS.UNQUALIFIED,
      '不通过': this.METROLOGY_RESULTS.UNQUALIFIED,
      '不符合': this.METROLOGY_RESULTS.UNQUALIFIED,
      'fail': this.METROLOGY_RESULTS.UNQUALIFIED,
      'failed': this.METROLOGY_RESULTS.UNQUALIFIED,
      '限用': this.METROLOGY_RESULTS.LIMITED,
      '降级': this.METROLOGY_RESULTS.LIMITED,
      '待检': this.METROLOGY_RESULTS.PENDING,
      '待定': this.METROLOGY_RESULTS.PENDING,
      '待确认': this.METROLOGY_RESULTS.PENDING,
    };
    if (data.result != null && data.result !== '') {
      normalized.result = resultMapping[data.result] || data.result;
      if (!this.VALID_RESULTS.includes(normalized.result)) {
        errors.push(`计量结果必须是[${this.VALID_RESULTS.join(', ')}]之一`);
      }
    }

    // 状态映射（仅校验，不做变体归一化）
    if (data.status != null && data.status !== '') {
      if (!this.VALID_STATUSES.includes(data.status)) {
        errors.push(`状态必须是[${this.VALID_STATUSES.join(', ')}]之一`);
      }
    }

    return { normalized, errors };
  }

  static buildLatestAssetJoin(recordAlias = 'm') {
    return `
       LEFT JOIN (
         SELECT tenant_id, asset_code, MAX(id) AS latest_asset_id
         FROM assets
         GROUP BY tenant_id, asset_code
       ) latest_asset
         ON latest_asset.tenant_id = ${recordAlias}.tenant_id
        AND latest_asset.asset_code = ${recordAlias}.asset_code
       LEFT JOIN assets a
         ON a.id = latest_asset.latest_asset_id
        AND a.tenant_id = latest_asset.tenant_id AND a.is_deleted = 0`;
  }

  /**
   * 获取计量记录列表
   * @param {Object} params 查询参数
   * @param {Object} tenantFilter 租户过滤条件
   * @returns {Promise<Object>} 分页数据
   */
  static async getMetrologyRecords(params, tenantFilter) {
    const { page = 1, pageSize = 10, keyword, metrology_type, result, status, start_date, end_date } = params;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    // 添加租户过滤
    whereClause += tenantFilter.whereClause;
    queryParams.push(...tenantFilter.params);

    // 添加关键词搜索
    if (keyword) {
      whereClause += ' AND (m.record_no LIKE ? OR m.asset_code LIKE ? OR m.asset_name LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      queryParams.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (metrology_type) {
      whereClause += ' AND m.metrology_type = ?';
      queryParams.push(metrology_type);
    }

    // 添加结果筛选
    if (result) {
      whereClause += ' AND m.result = ?';
      queryParams.push(result);
    }

    // 添加状态筛选
    if (status) {
      whereClause += ' AND m.status = ?';
      queryParams.push(status);
    }

    if (start_date) {
      whereClause += ' AND m.metrology_date >= ?';
      queryParams.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND m.metrology_date <= ?';
      queryParams.push(end_date);
    }

    // 获取总数
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total FROM metrology_records m ${whereClause}`,
      queryParams,
    );

    // 获取分页数据
    const [rows] = await db.execute(
      `SELECT m.*, a.department, a.department_new
       FROM metrology_records m
       ${this.buildLatestAssetJoin('m')}
       ${whereClause}
       ORDER BY m.metrology_date DESC, m.created_at DESC
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
   * 获取计量统计分析
   * @param {Object} params 查询参数
   * @param {Object} tenantFilter 租户过滤条件
   * @returns {Promise<Object>} 统计数据
   */
  static async getMetrologyStatistics(params, tenantFilter) {
    const { start_date, end_date } = params;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    // 添加租户过滤
    whereClause += tenantFilter.whereClause;
    queryParams.push(...tenantFilter.params);

    if (start_date) {
      whereClause += ' AND m.metrology_date >= ?';
      queryParams.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND m.metrology_date <= ?';
      queryParams.push(end_date);
    }

    // 总数统计
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total, SUM(cost) as total_cost FROM metrology_records m ${whereClause}`,
      queryParams,
    );

    // 按类型统计
    const [typeResult] = await db.execute(
      `SELECT metrology_type, COUNT(*) as count FROM metrology_records m ${whereClause} GROUP BY metrology_type`,
      queryParams,
    );

    // 按结果统计
    const [resultResult] = await db.execute(
      `SELECT result, COUNT(*) as count FROM metrology_records m ${whereClause} GROUP BY result`,
      queryParams,
    );

    // 按状态统计
    const [statusResult] = await db.execute(
      `SELECT status, COUNT(*) as count FROM metrology_records m ${whereClause} GROUP BY status`,
      queryParams,
    );

    // 按月份统计（新增）
    const [monthlyResult] = await db.execute(
      `SELECT DATE_FORMAT(metrology_date, '%Y-%m') as month, COUNT(*) as count
       FROM metrology_records m ${whereClause}
       GROUP BY DATE_FORMAT(metrology_date, '%Y-%m')
       ORDER BY month`,
      queryParams,
    );

    // 按部门统计（新增）
    const [deptResult] = await db.execute(
      `SELECT a.department, COUNT(*) as count
       FROM metrology_records m
       ${this.buildLatestAssetJoin('m')}
       ${whereClause}
       GROUP BY a.department
       HAVING a.department IS NOT NULL`,
      queryParams,
    );

    // 成功率统计（新增）
    const [successRateResult] = await db.execute(
      `SELECT
         SUM(CASE WHEN result = '合格' THEN 1 ELSE 0 END) as passed,
         SUM(CASE WHEN result = '不合格' THEN 1 ELSE 0 END) as failed,
         COUNT(*) as total
       FROM metrology_records m ${whereClause}`,
      queryParams,
    );

    return {
      total: totalResult[0].total || 0,
      totalCost: parseFloat(totalResult[0].total_cost || 0),
      successRate:
        successRateResult[0].total > 0
          ? Math.round((successRateResult[0].passed / successRateResult[0].total) * 100)
          : 0,
      byType: typeResult.reduce((acc, row) => {
        acc[row.metrology_type] = row.count;
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
   * 获取高级计量统计分析
   * @param {Object} params 查询参数
   * @param {Object} tenantFilter 租户过滤条件
   * @returns {Promise<Object>} 高级统计数据
   */
  static async getAdvancedMetrologyStatistics(params, tenantFilter) {
    const { start_date, end_date } = params;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    // 添加租户过滤
    whereClause += tenantFilter.whereClause;
    queryParams.push(...tenantFilter.params);

    if (start_date) {
      whereClause += ' AND m.metrology_date >= ?';
      queryParams.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND m.metrology_date <= ?';
      queryParams.push(end_date);
    }

    // 获取所有统计信息
    const [totalResult] = await db.execute(
      `SELECT
        COUNT(*) as total,
        SUM(cost) as total_cost,
        AVG(cost) as avg_cost,
        MIN(cost) as min_cost,
        MAX(cost) as max_cost
       FROM metrology_records m ${whereClause}`,
      queryParams,
    );

    // 按机构统计
    const [agencyResult] = await db.execute(
      `SELECT
         metrology_agency,
         COUNT(*) as count,
         AVG(cost) as avg_cost,
         SUM(cost) as total_cost
       FROM metrology_records m ${whereClause}
       GROUP BY metrology_agency
       ORDER BY count DESC`,
      queryParams,
    );

    // 趋势分析
    const [trendResult] = await db.execute(
      `SELECT
         DATE_FORMAT(metrology_date, '%Y-%m') as month,
         COUNT(*) as count,
         SUM(cost) as total_cost,
         AVG(cost) as avg_cost
       FROM metrology_records m ${whereClause}
       GROUP BY DATE_FORMAT(metrology_date, '%Y-%m')
       ORDER BY month`,
      queryParams,
    );

    // 按精度等级统计
    const [accuracyResult] = await db.execute(
      `SELECT
         accuracy_level,
         COUNT(*) as count,
         SUM(CASE WHEN result = '合格' THEN 1 ELSE 0 END) as passed,
         SUM(CASE WHEN result = '不合格' THEN 1 ELSE 0 END) as failed
       FROM metrology_records m ${whereClause}
       GROUP BY accuracy_level
       HAVING accuracy_level IS NOT NULL`,
      queryParams,
    );

    return {
      summary: {
        total: totalResult[0].total || 0,
        totalCost: parseFloat(totalResult[0].total_cost || 0) || 0,
        avgCost: parseFloat(totalResult[0].avg_cost || 0) || 0,
        minCost: parseFloat(totalResult[0].min_cost || 0) || 0,
        maxCost: parseFloat(totalResult[0].max_cost || 0) || 0,
      },
      byAgency: agencyResult.map(row => ({
        agency: row.metrology_agency,
        count: row.count,
        avgCost: parseFloat(row.avg_cost || 0) || 0,
        totalCost: parseFloat(row.total_cost || 0) || 0,
      })),
      trends: trendResult.map(row => ({
        month: row.month,
        count: row.count,
        totalCost: parseFloat(row.total_cost || 0) || 0,
        avgCost: parseFloat(row.avg_cost || 0) || 0,
      })),
      byAccuracyLevel: accuracyResult.map(row => ({
        accuracyLevel: row.accuracy_level,
        count: row.count,
        passed: row.passed,
        failed: row.failed,
        passRate: row.count > 0 ? Math.round((row.passed / row.count) * 100) : 0,
      })),
    };
  }

  /**
   * 获取即将到期计量记录
   * @param {Object} params 查询参数
   * @param {Object} tenantFilter 租户过滤条件
   * @returns {Promise<Array>} 即将到期记录
   */
  static async getExpiringMetrologyRecords(params, tenantFilter) {
    const { days = 30 } = params;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    // 添加租户过滤
    whereClause += tenantFilter.whereClause;
    queryParams.push(...tenantFilter.params);

    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + parseInt(days));

    const [rows] = await db.execute(
      `SELECT m.*, a.department, a.department_new
       FROM metrology_records m
       ${this.buildLatestAssetJoin('m')}
       ${whereClause}
       AND m.next_metrology_date IS NOT NULL
       AND m.next_metrology_date <= ?
       AND m.status != '已取消'
       ORDER BY m.next_metrology_date ASC`,
      [...queryParams, warningDate.toISOString().split('T')[0]],
    );

    return rows;
  }

  /**
   * 获取计量记录详情
   * @param {string} id 记录ID
   * @param {Object} tenantFilter 租户过滤条件
   * @returns {Promise<Object|null>} 记录详情
   */
  static async getMetrologyRecordById(id, tenantFilter) {
    const [records] = await db.execute(
      `SELECT m.*, a.department, a.department_new
       FROM metrology_records m
       ${this.buildLatestAssetJoin('m')}
       WHERE m.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (records.length === 0) {
      return null;
    }

    const record = records[0];

    // 加载附件列表（通过 INNER JOIN 走主表 tenant_id，确保租户隔离）
    const [attachments] = await db.execute(
      `SELECT ma.id, ma.file_name, ma.file_path, ma.file_size, ma.file_type, ma.upload_time
       FROM metrology_attachments ma
       INNER JOIN metrology_records m ON m.id = ma.metrology_id
       WHERE ma.metrology_id = ? ${tenantFilter.whereClause}
       ORDER BY ma.upload_time DESC`,
      [id, ...tenantFilter.params],
    );
    record.attachments = attachments;

    return record;
  }

  /**
   * 创建计量记录
   * @param {Object} data 记录数据
   * @param {string} tenantId 租户ID
   * @param {string} createdBy 创建人
   * @returns {Promise<Object>} 创建结果
   */
  static async createMetrologyRecord(data, tenantId, createdBy) {
    const errors = this.validateMetrologyInput(data);
    if (errors.length > 0) {
      throw new AppError(errors.join('; '), 400, 'VALIDATION_ERROR');
    }

    const {
      asset_code,
      asset_name: dataAssetName,
      customer_name,
      specification,
      serial_number,
      technical_document,
      conformance_standard,
      metrology_type,
      metrology_date,
      next_metrology_date,
      metrology_agency,
      certificate_no: dataCertificateNo,
      certificate_number,
      result = '待检',
      accuracy_level,
      measurement_range,
      cost = 0,
      operator,
      remark,
      status = '待检',
      metrology_cycle = 12,
      warning_days = 30,
    } = data;

    // 验证必填字段（资产编号可以为空，用于后续关联）
    ValidationUtil.validateRequiredFields({ metrology_type, metrology_date }, [
      'metrology_type',
      'metrology_date',
    ]);

    // 验证资产是否存在（仅当提供了资产编号时）
    let assetResult = [];
    if (asset_code) {
      assetResult = await DataAccessUtil.executeQuery(
        'SELECT id, asset_name FROM assets WHERE asset_code = ? AND tenant_id = ? LIMIT 1',
        [asset_code, tenantId],
      );

      if (!assetResult || assetResult.length === 0) {
        throw new AppError('资产不存在', 400, 'ASSET_NOT_FOUND');
      }
    }

    // 生成唯一的计量单号
    const record_no = await this.generateRecordNo(tenantId);

    // 开始事务
    const creationResult = await TransactionManager.executeTransaction(async connection => {
      // 兜底: 显式把所有未定义字段转 null
      const safe = v => v === undefined ? null : v;
      const rawParams = [
          tenantId,
          record_no,
          asset_code,
          dataAssetName || (assetResult.length > 0 ? assetResult[0].asset_name : '未知资产'),
          customer_name,
          specification,
          serial_number,
          technical_document,
          conformance_standard,
          metrology_type,
          metrology_date,
          next_metrology_date,
          metrology_agency,
          dataCertificateNo || certificate_number,
          result,
          accuracy_level,
          measurement_range,
          cost,
          operator,
          remark,
          status,
          metrology_cycle,
          warning_days,
          createdBy,
        ];
      const params = rawParams.map(v => v === undefined ? null : v);
      const [insertResult] = await connection.execute(
        `INSERT INTO metrology_records (
          tenant_id, record_no, asset_code, asset_name, customer_name, specification, serial_number, technical_document, conformance_standard, metrology_type,
          metrology_date, next_metrology_date, metrology_agency,
          certificate_no, result, accuracy_level, measurement_range,
          cost, operator, remark, status, metrology_cycle, warning_days,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
   * 更新计量记录
   * @param {string} id 记录ID
   * @param {Object} data 更新数据
   * @param {string} tenantId 租户ID
   * @param {string} updatedBy 更新人
   * @returns {Promise<Object>} 更新结果
   */
  static async updateMetrologyRecord(id, data, tenantId, updatedBy) {
    const {
      asset_code,
      metrology_type,
      metrology_date,
      next_metrology_date,
      metrology_agency,
      certificate_no,
      result,
      accuracy_level,
      measurement_range,
      cost,
      operator,
      remark,
      status,
      metrology_cycle,
      warning_days,
    } = data;

    // 验证记录是否存在且属于当前租户
    const [existingRecord] = await db.execute(
      'SELECT id FROM metrology_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (!existingRecord || existingRecord.length === 0) {
      throw new AppError('计量记录不存在或无权限操作', 404, 'RECORD_NOT_FOUND');
    }

    // 构建更新语句
    const updateFields = [];
    const updateParams = [];

    if (asset_code !== undefined) {
      updateFields.push('asset_code = ?');
      updateParams.push(asset_code);
    }
    if (metrology_type !== undefined) {
      updateFields.push('metrology_type = ?');
      updateParams.push(metrology_type);
    }
    if (metrology_date !== undefined) {
      updateFields.push('metrology_date = ?');
      updateParams.push(metrology_date);
    }
    if (next_metrology_date !== undefined) {
      updateFields.push('next_metrology_date = ?');
      updateParams.push(next_metrology_date);
    }
    if (metrology_agency !== undefined) {
      updateFields.push('metrology_agency = ?');
      updateParams.push(metrology_agency);
    }
    if (certificate_no !== undefined) {
      updateFields.push('certificate_no = ?');
      updateParams.push(certificate_no);
    }
    if (result !== undefined) {
      updateFields.push('result = ?');
      updateParams.push(result);
    }
    if (accuracy_level !== undefined) {
      updateFields.push('accuracy_level = ?');
      updateParams.push(accuracy_level);
    }
    if (measurement_range !== undefined) {
      updateFields.push('measurement_range = ?');
      updateParams.push(measurement_range);
    }
    if (cost !== undefined) {
      updateFields.push('cost = ?');
      updateParams.push(cost);
    }
    if (operator !== undefined) {
      updateFields.push('operator = ?');
      updateParams.push(operator);
    }
    if (remark !== undefined) {
      updateFields.push('remark = ?');
      updateParams.push(remark);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateParams.push(status);
    }
    if (metrology_cycle !== undefined) {
      updateFields.push('metrology_cycle = ?');
      updateParams.push(metrology_cycle);
    }
    if (warning_days !== undefined) {
      updateFields.push('warning_days = ?');
      updateParams.push(warning_days);
    }

    updateFields.push('updated_at = NOW()');

    if (updateFields.length === 0) {
      throw new AppError('没有需要更新的字段', 400, 'NO_FIELDS_TO_UPDATE');
    }

    const [updateResult] = await db.execute(
      `UPDATE metrology_records SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      [...updateParams, id, tenantId],
    );

    return { id, affectedRows: updateResult.affectedRows };
  }

  /**
   * 删除计量记录
   * @param {string} id 记录ID
   * @param {string} tenantId 租户ID
   * @param {string} deletedBy 删除人
   * @returns {Promise<Object>} 删除结果
   */
  static async deleteMetrologyRecord(id, tenantId, deletedBy) {
    // 验证记录是否存在且属于当前租户
    const [existingRecord] = await db.execute(
      'SELECT id FROM metrology_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (!existingRecord || existingRecord.length === 0) {
      throw new AppError('计量记录不存在或无权限操作', 404, 'RECORD_NOT_FOUND');
    }

    // 执行删除操作
    const [deleteResult] = await db.execute(
      'DELETE FROM metrology_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    return { id, affectedRows: deleteResult.affectedRows };
  }

  // ============================================
  // 附件管理
  // ============================================

  /**
   * 解析附件磁盘路径
   * 数据库里存的是 /uploads/xxx 形式，转为后端 uploads 目录的绝对路径
   */
  static resolveAttachmentPath(filePath) {
    if (!filePath) return null;
    // filePath 形如 /uploads/metrology-attachments/xxx.jpg
    // 后端目录: backend/, uploads 在 backend/uploads/
    const tail = filePath.replace(/^[/\\]+uploads[/\\]?/, '');
    return path.join(__dirname, '..', 'uploads', tail);
  }

  /**
   * 构建附件直链 URL
   */
  static buildAttachmentUrl(req, metrologyId, attachmentId) {
    return `${req.protocol}://${req.get('host')}/api/quality-control/metrology/${metrologyId}/attachments/${attachmentId}`;
  }

  /**
   * 获取计量记录附件列表
   */
  static async getMetrologyAttachments(metrologyId, req) {
    const tenantFilter = addTenantFilter(req, 'm');
    // 通过 INNER JOIN 校验主记录存在 + 租户归属
    const [records] = await db.execute(
      `SELECT m.id
       FROM metrology_records m
       WHERE m.id = ? ${tenantFilter.whereClause}`,
      [metrologyId, ...tenantFilter.params],
    );
    if (records.length === 0) {
      return { statusCode: 404, body: { success: false, message: '计量记录不存在或无权限' } };
    }

    const [rows] = await db.execute(
      `SELECT ma.id, ma.file_name, ma.file_path, ma.file_size, ma.file_type, ma.upload_time
       FROM metrology_attachments ma
       INNER JOIN metrology_records m ON m.id = ma.metrology_id
       WHERE ma.metrology_id = ? ${tenantFilter.whereClause}
       ORDER BY ma.upload_time DESC`,
      [metrologyId, ...tenantFilter.params],
    );

    const data = rows.map(att => ({
      ...att,
      file_url: this.buildAttachmentUrl(req, metrologyId, att.id),
    }));

    return { statusCode: 200, body: { success: true, data } };
  }

  /**
   * 上传计量记录附件（支持多文件）
   * req.files: multer array 解析后的文件数组
   * req.parsedFileNames: 数组（按顺序）与 req.files 对应，来源于前端 originalFileName 表单字段
   */
  static async uploadMetrologyAttachments(metrologyId, req) {
    const tenantFilter = addTenantFilter(req, 'm');
    const [records] = await db.execute(
      `SELECT m.id
       FROM metrology_records m
       WHERE m.id = ? ${tenantFilter.whereClause}`,
      [metrologyId, ...tenantFilter.params],
    );
    if (records.length === 0) {
      return { statusCode: 404, body: { success: false, message: '计量记录不存在或无权限' } };
    }

    if (!req.files || req.files.length === 0) {
      return { statusCode: 400, body: { success: false, message: '请选择要上传的文件' } };
    }

    const tenantId = getTenantId(req);
    const uploadedBy = req.user.real_name || req.user.username || '系统';
    const parsedNames = Array.isArray(req.parsedFileNames) ? req.parsedFileNames : [];
    const inserted = [];

    for (let i = 0; i < req.files.length; i += 1) {
      const file = req.files[i];
      const fileName = parsedNames[i] || file.originalname;
      const filePath = `/uploads/metrology-attachments/${file.filename}`;
      const fileUrl = `${req.protocol}://${req.get('host')}${filePath}`;

      // eslint-disable-next-line no-await-in-loop
      const [result] = await db.execute(
        `INSERT INTO metrology_attachments
          (tenant_id, metrology_id, file_name, file_path, file_size, file_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tenantId, metrologyId, fileName, filePath, file.size, file.mimetype],
      );

      inserted.push({
        id: result.insertId,
        file_name: fileName,
        file_path: filePath,
        file_url: fileUrl,
        file_type: file.mimetype,
        file_size: file.size,
      });
    }

    return {
      statusCode: 200,
      body: { success: true, message: `成功上传 ${inserted.length} 个文件`, data: inserted },
    };
  }

  /**
   * 删除计量记录附件
   */
  static async deleteMetrologyAttachment(attachmentId, req) {
    const tenantFilter = addTenantFilter(req, 'm');
    const [attachments] = await db.execute(
      `SELECT ma.id, ma.file_path
       FROM metrology_attachments ma
       INNER JOIN metrology_records m ON m.id = ma.metrology_id
       WHERE ma.id = ? ${tenantFilter.whereClause}`,
      [attachmentId, ...tenantFilter.params],
    );

    if (attachments.length === 0) {
      return { statusCode: 404, body: { success: false, message: '附件不存在或无权限' } };
    }

    await db.execute('DELETE FROM metrology_attachments WHERE id = ?', [attachmentId]);

    // 删物理文件（失败不影响主流程，但要记录）
    const filePath = this.resolveAttachmentPath(attachments[0].file_path);
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('[计量附件] 删除物理文件失败:', filePath, err.message);
      }
    }

    return { statusCode: 200, body: { success: true, message: '附件删除成功' } };
  }

  /**
   * 获取单个附件（用于下载/预览）
   */
  static async getMetrologyAttachment(metrologyId, attachmentId, req) {
    const tenantFilter = addTenantFilter(req, 'm');
    const [attachments] = await db.execute(
      `SELECT ma.id, ma.file_name, ma.file_path, ma.file_type, ma.file_size
       FROM metrology_attachments ma
       INNER JOIN metrology_records m ON m.id = ma.metrology_id
       WHERE ma.id = ? AND ma.metrology_id = ? ${tenantFilter.whereClause}`,
      [attachmentId, metrologyId, ...tenantFilter.params],
    );

    if (attachments.length === 0) {
      return { statusCode: 404, body: { success: false, message: '附件不存在或无权限' } };
    }

    const attachment = attachments[0];
    const filePath = this.resolveAttachmentPath(attachment.file_path);
    if (!filePath || !fs.existsSync(filePath)) {
      return { statusCode: 404, body: { success: false, message: '物理文件不存在' } };
    }

    return { statusCode: 200, data: { attachment, filePath } };
  }
}

module.exports = MetrologyService;
