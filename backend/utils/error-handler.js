/**
 * 通用错误类，用于标准化错误处理
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    this.details = details;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * 返回JSON表示
   */
  toJSON() {
    return {
      message: this.message,
      errorCode: this.errorCode,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * 参数验证工具类
 */
class ValidationUtil {
  /**
   * 验证必填字段
   * @param {Object} obj 需要验证的对象
   * @param {Array} requiredFields 必填字段列表
   * @throws {AppError} 如果有必填字段缺失
   */
  static validateRequiredFields(obj, requiredFields) {
    const missingFields = [];
    for (const field of requiredFields) {
      if (
        !Object.prototype.hasOwnProperty.call(obj, field) ||
        obj[field] === undefined ||
        obj[field] === null ||
        obj[field] === ''
      ) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      throw new AppError(
        `缺少必填字段: ${missingFields.join(', ')}`,
        400,
        'MISSING_REQUIRED_FIELDS',
        { missingFields },
      );
    }
  }

  /**
   * 验证数据类型
   * @param {any} value 值
   * @param {string} expectedType 期望类型
   * @param {string} fieldName 字段名
   * @throws {AppError} 如果类型不匹配
   */
  static validateType(value, expectedType, fieldName) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== expectedType) {
      throw new AppError(
        `${fieldName} 类型错误，期望 ${expectedType}，实际 ${actualType}`,
        400,
        'INVALID_TYPE',
        { fieldName, expectedType, actualType },
      );
    }
  }

  /**
   * 验证日期格式
   * @param {string} dateString 日期字符串
   * @param {string} fieldName 字段名
   * @returns {Date} 解析后的日期对象
   * @throws {AppError} 如果日期格式不正确
   */
  static validateDate(dateString, fieldName) {
    if (!dateString) return null;

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new AppError(`${fieldName} 日期格式不正确: ${dateString}`, 400, 'INVALID_DATE_FORMAT');
    }
    return date;
  }

  /**
   * 验证日期范围
   * @param {string} startDate 开始日期
   * @param {string} endDate 结束日期
   * @param {string} startFieldName 开始日期字段名
   * @param {string} endFieldName 结束日期字段名
   * @throws {AppError} 如果日期范围无效
   */
  static validateDateRange(startDate, endDate, startFieldName = 'startDate', endFieldName = 'endDate') {
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new AppError(
        `${startFieldName} 不能晚于 ${endFieldName}`,
        400,
        'INVALID_DATE_RANGE',
      );
    }
  }

  /**
   * 验证数值范围
   * @param {number} value 数值
   * @param {number} min 最小值
   * @param {number} max 最大值
   * @param {string} fieldName 字段名
   * @throws {AppError} 如果超出范围
   */
  static validateRange(value, min, max, fieldName) {
    if (value !== null && value !== undefined) {
      if (value < min || value > max) {
        throw new AppError(
          `${fieldName} 必须在 ${min} 和 ${max} 之间`,
          400,
          'VALUE_OUT_OF_RANGE',
          { fieldName, min, max, actual: value },
        );
      }
    }
  }

  /**
   * 验证字符串长度
   * @param {string} value 字符串
   * @param {number} minLen 最小长度
   * @param {number} maxLen 最大长度
   * @param {string} fieldName 字段名
   * @throws {AppError} 如果长度不符合要求
   */
  static validateLength(value, minLen, maxLen, fieldName) {
    if (value === undefined || value === null || value === '') return;

    const len = String(value).length;
    if (len < minLen || len > maxLen) {
      throw new AppError(
        `${fieldName} 长度必须在 ${minLen} 和 ${maxLen} 之间`,
        400,
        'INVALID_LENGTH',
        { fieldName, minLen, maxLen, actual: len },
      );
    }
  }

  /**
   * 验证枚举值
   * @param {any} value 值
   * @param {Array} allowedValues 允许的值列表
   * @param {string} fieldName 字段名
   * @throws {AppError} 如果值不在允许列表中
   */
  static validateEnum(value, allowedValues, fieldName) {
    if (value === undefined || value === null) return;

    if (!allowedValues.includes(value)) {
      throw new AppError(
        `${fieldName} 必须是 [${allowedValues.join(', ')}] 之一`,
        400,
        'INVALID_ENUM',
        { fieldName, allowedValues, actual: value },
      );
    }
  }

  /**
   * 验证手机号格式
   * @param {string} phone 手机号
   * @param {string} fieldName 字段名
   * @throws {AppError} 如果格式不正确
   */
  static validatePhone(phone, fieldName = '手机号') {
    if (!phone) return;

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      throw new AppError(
        `${fieldName} 格式不正确，应为11位手机号`,
        400,
        'INVALID_PHONE',
        { fieldName, actual: phone },
      );
    }
  }

  /**
   * 验证邮箱格式
   * @param {string} email 邮箱
   * @param {string} fieldName 字段名
   * @throws {AppError} 如果格式不正确
   */
  static validateEmail(email, fieldName = '邮箱') {
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError(
        `${fieldName} 格式不正确`,
        400,
        'INVALID_EMAIL',
        { fieldName, actual: email },
      );
    }
  }

  /**
   * 验证URL格式
   * @param {string} url URL
   * @param {string} fieldName 字段名
   * @throws {AppError} 如果格式不正确
   */
  static validateUrl(url, fieldName = 'URL') {
    if (!url) return;

    try {
      new URL(url);
    } catch {
      throw new AppError(
        `${fieldName} 格式不正确`,
        400,
        'INVALID_URL',
        { fieldName, actual: url },
      );
    }
  }

  /**
   * 验证ID格式（正整数）
   * @param {any} id ID值
   * @param {string} fieldName 字段名
   * @throws {AppError} 如果格式不正确
   */
  static validateId(id, fieldName = 'ID') {
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId <= 0) {
      throw new AppError(
        `${fieldName} 必须是正整数`,
        400,
        'INVALID_ID',
        { fieldName, actual: id },
      );
    }
    return numId;
  }

  /**
   * 批量验证对象字段
   * @param {Object} obj 要验证的对象
   * @param {Object} rules 验证规则
   * @throws {AppError} 如果有任何验证失败
   *
   * @example
   * ValidationUtil.validateObject(data, {
   *   name: { required: true, type: 'string', minLength: 2, maxLength: 50 },
   *   age: { type: 'number', min: 0, max: 150 },
   *   email: { type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
   *   status: { type: 'string', enum: ['active', 'inactive'] }
   * });
   */
  static validateObject(obj, rules) {
    const errors = [];

    for (const [field, fieldRules] of Object.entries(rules)) {
      const value = obj[field];

      // 必填检查
      if (fieldRules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} 不能为空`);
        continue;
      }

      // 类型检查
      if (value !== undefined && value !== null && value !== '' && fieldRules.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== fieldRules.type) {
          errors.push(`${field} 类型错误，期望 ${fieldRules.type}`);
        }
      }

      // 长度检查
      if (fieldRules.minLength !== undefined || fieldRules.maxLength !== undefined) {
        const len = String(value).length;
        if (fieldRules.minLength !== undefined && len < fieldRules.minLength) {
          errors.push(`${field} 长度不能少于 ${fieldRules.minLength}`);
        }
        if (fieldRules.maxLength !== undefined && len > fieldRules.maxLength) {
          errors.push(`${field} 长度不能超过 ${fieldRules.maxLength}`);
        }
      }

      // 范围检查
      if (fieldRules.min !== undefined || fieldRules.max !== undefined) {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          if (fieldRules.min !== undefined && numValue < fieldRules.min) {
            errors.push(`${field} 不能小于 ${fieldRules.min}`);
          }
          if (fieldRules.max !== undefined && numValue > fieldRules.max) {
            errors.push(`${field} 不能大于 ${fieldRules.max}`);
          }
        }
      }

      // 枚举检查
      if (fieldRules.enum && !fieldRules.enum.includes(value)) {
        errors.push(`${field} 必须是 [${fieldRules.enum.join(', ')}] 之一`);
      }

      // 正则检查
      if (fieldRules.pattern && typeof value === 'string' && !fieldRules.pattern.test(value)) {
        errors.push(`${field} 格式不正确`);
      }
    }

    if (errors.length > 0) {
      throw new AppError(
        errors.join('; '),
        400,
        'VALIDATION_ERROR',
        { errors, fields: Object.keys(rules) },
      );
    }
  }
}

/**
 * 事务管理工具类
 */
class TransactionManager {
  /**
   * 执行事务
   * @param {Function} callback 事务回调函数
   * @param {Object} options 事务选项
   * @returns {Promise<any>} 事务执行结果
   */
  static async executeTransaction(callback, options = {}) {
    try {
      // 从数据库配置获取事务支持
      const result = await require('../config/database').transaction(async connection => {
        try {
          const transactionResult = await callback(connection);
          return transactionResult;
        } catch (error) {
          // 如果出现错误，在这里记录日志
          console.error('事务执行过程中发生错误:', error);
          throw error;
        }
      }, options);

      return result;
    } catch (error) {
      // 事务回滚后处理错误
      console.error('事务执行失败:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`事务执行失败: ${error.message}`, 500, 'TRANSACTION_FAILED');
    }
  }
}

/**
 * 数据访问工具类
 */
class DataAccessUtil {
  /**
   * 验证ORDER BY列名是否在白名单中
   * @param {string} orderBy 排序字符串 (如 "created_at DESC" 或 "name ASC")
   * @throws {AppError} 如果列名不在白名单中
   */
  static validateOrderByColumn(orderBy) {
    if (!orderBy) return;

    // 使用正则验证：允许 字母数字下划线点 + 可选 ASC/DESC，支持逗号分隔多列
    const ORDER_BY_REGEX = /^[a-zA-Z0-9_.]+(\s+(ASC|DESC))?(,\s*[a-zA-Z0-9_.]+(\s+(ASC|DESC))?)*$/i;
    
    if (!ORDER_BY_REGEX.test(orderBy.trim())) {
      throw new AppError(
        `无效的排序参数: ${orderBy}`,
        400,
        'INVALID_ORDER_COLUMN',
        { providedOrderBy: orderBy },
      );
    }
  }

  /**
   * 验证SQL表名是否合法（仅允许字母数字下划线）
   */
  static validateTableName(tableName) {
    if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new AppError(
        `无效的表名: ${tableName}`,
        400,
        'INVALID_TABLE_NAME',
        { providedTableName: tableName },
      );
    }
  }

  /**
   * 验证并清理SQL标识符（表名、列名）
   * @param {string} identifier 标识符
   * @throws {AppError} 如果标识符无效
   */
  static validateIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') {
      throw new AppError('标识符无效', 400, 'INVALID_IDENTIFIER');
    }

    // 只允许字母、数字、下划线
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new AppError(`无效的标识符: ${identifier}`, 400, 'INVALID_IDENTIFIER');
    }

    return identifier;
  }

  /**
   * 执行查询并处理结果
   * @param {string} sql SQL语句
   * @param {Array} params 参数
   * @param {Object} options 选项
   * @returns {Promise<any>} 查询结果
   */
  static async executeQuery(sql, params = [], options = {}) {
    try {
      const [result] = await require('../config/database').execute(sql, params);

      if (options.returnFirst && Array.isArray(result) && result.length > 0) {
        return result[0];
      }

      return result;
    } catch (error) {
      console.error('数据库查询失败:', error);
      throw new AppError(`数据库查询失败: ${error.message}`, 500, 'DATABASE_QUERY_FAILED');
    }
  }

  /**
   * 分页查询
   * @param {string} tableName 表名
   * @param {Object} conditions 条件
   * @param {Object} pagination 分页参数
   * @param {string} orderBy 排序
   * @param {string} selectFields 选择字段
   * @returns {Promise<Object>} 分页结果
   */
  static async paginate(
    tableName,
    conditions = {},
    pagination = {},
    orderBy = '',
    selectFields = '*',
  ) {
    const { page = 1, pageSize = 10, ...otherConditions } = pagination;
    const offset = (page - 1) * pageSize;

    // 构建WHERE子句
    let whereClause = '';
    const params = [];

    if (Object.keys(otherConditions).length > 0) {
      const conditionsArray = [];
      for (const [key, value] of Object.entries(otherConditions)) {
        if (value !== undefined && value !== null) {
          if (!/^[a-zA-Z0-9_.]+$/.test(key)) {
            throw new AppError(`无效的字段名: ${key}`, 400, 'INVALID_FIELD_NAME');
          }
          conditionsArray.push(`${key} = ?`);
          params.push(value);
        }
      }
      if (conditionsArray.length > 0) {
        whereClause = `WHERE ${conditionsArray.join(' AND ')}`;
      }
    }

    // 获取总数
    this.validateTableName(tableName);
    const [totalResult] = await this.executeQuery(
      `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`,
      params,
    );

    // 验证ORDER BY列名
    this.validateOrderByColumn(orderBy);

    // 获取分页数据
    const orderClause = orderBy ? `ORDER BY ${orderBy}` : 'ORDER BY id DESC';
    // 验证 selectFields（防止注入）
    if (selectFields !== '*' && !/^[a-zA-Z0-9_.*,\s]+$/.test(selectFields)) {
      throw new AppError('无效的字段选择', 400, 'INVALID_SELECT_FIELDS');
    }
    const [data] = await this.executeQuery(
      `SELECT ${selectFields} FROM ${tableName} ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    return {
      data,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / pageSize),
      },
    };
  }

  /**
   * 批量插入
   * @param {string} tableName 表名
   * @param {Array} records 记录数组
   * @param {number} batchSize 批次大小
   * @returns {Promise<Object>} 插入结果
   */
  static async batchInsert(tableName, records, batchSize = 100) {
    if (!records || records.length === 0) {
      return { inserted: 0, batches: 0 };
    }

    const columns = Object.keys(records[0]);
    const placeholders = columns.map(() => '?').join(',');
    const sql = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;

    let totalInserted = 0;
    let batches = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      batches++;

      try {
        for (const record of batch) {
          const values = columns.map(col => record[col]);
          await this.executeQuery(sql, values);
        }
        totalInserted += batch.length;
      } catch (error) {
        console.error(`批量插入第 ${batches} 批失败:`, error);
        throw error;
      }
    }

    return { inserted: totalInserted, batches };
  }
}

module.exports = {
  AppError,
  ValidationUtil,
  TransactionManager,
  DataAccessUtil,
};
