/**
 * 数据库查询优化器
 * 提供查询优化、分页优化、批量操作等功能
 */

const db = require('../config/database');
const logger = require('../config/logger');

class QueryOptimizer {
  static ALLOWED_ORDER_COLUMNS = ['id', 'created_at', 'updated_at', 'name', 'status', 'sort_order', 'priority'];

  static VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  static ALLOWED_TABLES = [
    'assets', 'users', 'departments', 'categories', 'locations',
    'asset_transfers', 'asset_maintenance', 'asset_scrap', 'asset_inventory',
    'suppliers', 'contracts', 'metrology_records', 'quality_inspections',
    'notifications', 'operation_logs', 'tenants', 'roles', 'permissions',
    'asset_acceptance', 'asset_allocation',
  ];

  static _validateIdentifier(name, label = 'identifier') {
    if (!QueryOptimizer.VALID_IDENTIFIER.test(name)) {
      throw new Error(`Invalid ${label}: ${name}`);
    }
    return name;
  }

  static _validateTableName(table) {
    const t = String(table).trim();
    if (!QueryOptimizer.VALID_IDENTIFIER.test(t)) {
      throw new Error(`Invalid table name: ${table}`);
    }
    if (QueryOptimizer.ALLOWED_TABLES.length > 0 && !QueryOptimizer.ALLOWED_TABLES.includes(t)) {
      throw new Error(`Table not allowed: ${t}. Permitted: ${QueryOptimizer.ALLOWED_TABLES.join(', ')}`);
    }
    return t;
  }

  static _validateColumnList(columns) {
    if (columns === '*') return columns;
    const parts = columns.split(',').map(c => c.trim());
    for (const p of parts) {
      const segs = p.split('.');
      for (const s of segs) {
        if (s !== '*' && !QueryOptimizer.VALID_IDENTIFIER.test(s)) {
          throw new Error(`Invalid column name: ${s}`);
        }
      }
    }
    return columns;
  }

  constructor() {
    this.slowQueryThreshold = 100;
    this.queryStats = new Map();
  }

  /**
   * Validate ORDER BY column against whitelist
   * @param {string} column - Column name to validate
   * @param {string} direction - ASC or DESC
   */
  _validateOrderColumn(column, direction = 'ASC') {
    const normalizedColumn = column.replace(/[^a-zA-Z0-9_]/g, '');
    if (!QueryOptimizer.ALLOWED_ORDER_COLUMNS.includes(normalizedColumn)) {
      throw new Error(`Invalid order column: ${column}. Allowed: ${QueryOptimizer.ALLOWED_ORDER_COLUMNS.join(', ')}`);
    }
    return `${normalizedColumn} ${direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
  }

  /**
   * Validate and sanitize full ORDER BY clause (handles "column DESC, column2 ASC" format)
   * @param {string} orderBy - Full ORDER BY string
   */
  _validateOrderByString(orderBy) {
    // Match patterns like "name DESC", "created_at ASC", "name DESC, status ASC"
    const orderByRegex = /^([a-zA-Z0-9_]+)\s+(ASC|DESC)$/i;
    const parts = orderBy.split(',').map(p => p.trim());

    const validatedParts = parts.map(part => {
      // Handle just column name (default to ASC)
      if (!part.includes(' ')) {
        const normalizedColumn = part.replace(/[^a-zA-Z0-9_]/g, '');
        if (!QueryOptimizer.ALLOWED_ORDER_COLUMNS.includes(normalizedColumn)) {
          throw new Error(`Invalid order column: ${part}. Allowed: ${QueryOptimizer.ALLOWED_ORDER_COLUMNS.join(', ')}`);
        }
        return `${normalizedColumn} ASC`;
      }

      // Handle "column direction" format
      const match = part.match(orderByRegex);
      if (!match) {
        throw new Error(`Invalid ORDER BY syntax: ${part}`);
      }
      const [, column, direction] = match;
      return this._validateOrderColumn(column, direction);
    });

    return validatedParts.join(', ');
  }

  /**
   * 优化的分页查询
   * @param {string} table - 表名
   * @param {Object} options - 查询选项
   */
  async paginatedQuery(table, options = {}) {
    const {
      columns = '*',
      where = '',
      params = [],
      orderBy = 'id DESC',
      page = 1,
      pageSize = 20,
      useCursor = false,
      cursorField = 'id',
      cursorValue = null,
    } = options;

    const safeTable = QueryOptimizer._validateTableName(table);
    const safeColumns = QueryOptimizer._validateColumnList(columns);
    const safeCursorField = QueryOptimizer._validateIdentifier(cursorField, 'cursorField');

    const limit = Math.min(pageSize, 1000);

    let sql, countSql;
    let queryParams = [...params];

    if (useCursor && cursorValue) {
      // 游标分页（大数据量优化）
      const direction = options.cursorDirection || 'next';
      const operator = direction === 'next' ? '>' : '<';

      const whereClause = where
        ? `${where} AND ${safeCursorField} ${operator} ?`
        : `${safeCursorField} ${operator} ?`;

      const validatedOrderBy = this._validateOrderColumn(safeCursorField, direction);
      sql = `SELECT ${safeColumns} FROM ${safeTable} WHERE ${whereClause} ORDER BY ${validatedOrderBy} LIMIT ?`;
      queryParams = [...params, cursorValue, limit];

      // 游标分页不计算总数，提高性能
      countSql = null;
    } else {
      // 传统分页
      const offset = (page - 1) * limit;
      const whereClause = where ? `WHERE ${where}` : '';

      const validatedOrderBy = this._validateOrderByString(orderBy);
      sql = `SELECT ${safeColumns} FROM ${safeTable} ${whereClause} ORDER BY ${validatedOrderBy} LIMIT ? OFFSET ?`;
      queryParams = [...params, limit, offset];

      countSql = `SELECT COUNT(*) as total FROM ${safeTable} ${whereClause}`;
    }

    const startTime = Date.now();

    try {
      // 并行执行查询和计数
      const [dataResult, countResult] = await Promise.all([
        db.execute(sql, queryParams),
        countSql ? db.execute(countSql, params) : Promise.resolve([{ total: null }]),
      ]);

      const duration = Date.now() - startTime;

      // 记录慢查询
      if (duration > this.slowQueryThreshold) {
        logger.warn(`Slow query detected: ${sql} took ${duration}ms`);
        this.recordSlowQuery(sql, duration);
      }

      const rows = dataResult[0];
      const total = countResult[0]?.[0]?.total;

      return {
        data: rows,
        pagination: {
          page: parseInt(page),
          pageSize: limit,
          total: total !== null ? parseInt(total) : null,
          hasMore: rows.length === limit,
          nextCursor: useCursor && rows.length > 0 ? rows[rows.length - 1][cursorField] : null,
        },
        duration,
      };
    } catch (error) {
      logger.error('Paginated query failed:', error?.message || error);
      throw error;
    }
  }

  /**
   * 批量插入优化
   * @param {string} table - 表名
   * @param {Array} records - 记录数组
   * @param {number} batchSize - 批次大小
   */
  async batchInsert(table, records, batchSize = 1000) {
    if (!records || records.length === 0) return { inserted: 0 };

    const safeTable = QueryOptimizer._validateTableName(table);
    const columns = Object.keys(records[0]);
    columns.forEach(c => QueryOptimizer._validateIdentifier(c, 'column'));
    const placeholders = columns.map(() => '?').join(',');
    const sql = `INSERT INTO ${safeTable} (${columns.join(',')}) VALUES (${placeholders})`;

    let totalInserted = 0;
    const batches = this.chunkArray(records, batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        await db.transaction(async (connection) => {
          for (const record of batch) {
            const values = columns.map(col => record[col]);
            await connection.execute(sql, values);
          }
        });

        totalInserted += batch.length;
        logger.debug(`Batch ${i + 1}/${batches.length} inserted: ${batch.length} records`);
      } catch (error) {
        logger.error(`Batch ${i + 1} insert failed:`, error.message);
        throw error;
      }
    }

    return { inserted: totalInserted };
  }

  /**
   * 批量更新优化
   * @param {string} table - 表名
   * @param {Array} records - 记录数组
   * @param {string} keyField - 主键字段
   */
  async batchUpdate(table, records, keyField = 'id') {
    if (!records || records.length === 0) return { updated: 0 };

    const safeTable = QueryOptimizer._validateTableName(table);
    const safeKeyField = QueryOptimizer._validateIdentifier(keyField, 'keyField');

    const results = [];

    await db.transaction(async (connection) => {
      for (const record of records) {
        const keyValue = record[keyField];
        const updateFields = Object.keys(record).filter(k => k !== keyField);
        updateFields.forEach(f => QueryOptimizer._validateIdentifier(f, 'updateField'));

        if (updateFields.length === 0) continue;

        const setClause = updateFields.map(f => `${f} = ?`).join(', ');
        const sql = `UPDATE ${safeTable} SET ${setClause} WHERE ${safeKeyField} = ?`;
        const values = [...updateFields.map(f => record[f]), keyValue];

        const [result] = await connection.execute(sql, values);
        results.push(result);
      }
    });

    return { updated: results.reduce((sum, r) => sum + r.affectedRows, 0) };
  }

  /**
   * 智能搜索查询
   * @param {string} table - 表名
   * @param {string} searchTerm - 搜索词
   * @param {Array} fields - 搜索字段
   * @param {Object} options - 其他选项
   */
  async searchQuery(table, searchTerm, fields, options = {}) {
    if (!searchTerm || !fields || fields.length === 0) {
      return this.paginatedQuery(table, options);
    }

    const {
      mode = 'OR', // OR 或 AND
      wildcard = true,
      minLength = 2,
    } = options;

    if (searchTerm.length < minLength) {
      return { data: [], pagination: { page: 1, pageSize: 20, total: 0 } };
    }

    // 分词处理
    const terms = searchTerm.split(/\s+/).filter(t => t.length >= minLength);

    if (terms.length === 0) {
      return { data: [], pagination: { page: 1, pageSize: 20, total: 0 } };
    }

    const conditions = [];
    const params = [];

    fields.forEach(f => QueryOptimizer._validateIdentifier(f, 'searchField'));

    for (const term of terms) {
      const fieldConditions = fields.map(field => {
        params.push(wildcard ? `%${term}%` : term);
        return `${field} LIKE ?`;
      });

      conditions.push(`(${fieldConditions.join(' OR ')})`);
    }

    const whereClause = conditions.join(` ${mode} `);

    // 添加全文搜索分数排序（如果有全文索引）
    const orderBy = options.orderBy || 'id DESC';

    return this.paginatedQuery(table, {
      ...options,
      where: whereClause,
      params,
      orderBy,
    });
  }

  /**
   * 统计查询优化
   * @param {string} table - 表名
   * @param {Object} aggregations - 聚合配置
   */
  async optimizedStats(table, aggregations) {
    const {
      where = '',
      params = [],
      groupBy = null,
      dimensions = [],
      metrics = {},
    } = aggregations;

    const safeTable = QueryOptimizer._validateTableName(table);

    const selectParts = [];

    for (const dim of dimensions) {
      QueryOptimizer._validateIdentifier(dim, 'dimension');
      selectParts.push(dim);
    }

    const ALLOWED_AGG = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];
    for (const [alias, config] of Object.entries(metrics)) {
      QueryOptimizer._validateIdentifier(alias, 'metricAlias');
      const { field, type = 'COUNT' } = config;
      if (!ALLOWED_AGG.includes(type.toUpperCase())) {
        throw new Error(`Unsupported aggregation type: ${type}`);
      }
      QueryOptimizer._validateIdentifier(field, 'metricField');
      selectParts.push(`${type.toUpperCase()}(${field}) as ${alias}`);
    }

    let sql = `SELECT ${selectParts.join(', ')} FROM ${safeTable}`;

    if (where) {
      sql += ` WHERE ${where}`;
    }

    if (groupBy) {
      QueryOptimizer._validateIdentifier(groupBy, 'groupBy');
      sql += ` GROUP BY ${groupBy}`;
    }

    const startTime = Date.now();
    const [rows] = await db.execute(sql, params);

    return {
      data: rows,
      duration: Date.now() - startTime,
    };
  }

  /**
   * 数组分块
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 记录慢查询
   */
  recordSlowQuery(sql, duration) {
    const key = sql.substring(0, 100);
    const existing = this.queryStats.get(key) || { count: 0, totalDuration: 0 };

    existing.count++;
    existing.totalDuration += duration;
    existing.avgDuration = existing.totalDuration / existing.count;
    existing.lastOccurred = new Date();

    this.queryStats.set(key, existing);
  }

  /**
   * 获取慢查询统计
   */
  getSlowQueryStats() {
    return Array.from(this.queryStats.entries())
      .map(([sql, stats]) => ({ sql, ...stats }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 20);
  }

  /**
   *  explain 查询分析
   */
  async explainQuery(sql, params = []) {
    try {
      const [rows] = await db.execute(`EXPLAIN ${sql}`, params);
      return rows;
    } catch (error) {
      logger.error('Explain query failed:', error.message);
      return null;
    }
  }
}

// 单例实例
const queryOptimizer = new QueryOptimizer();

module.exports = { QueryOptimizer, queryOptimizer };
