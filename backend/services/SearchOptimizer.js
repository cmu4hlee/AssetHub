/**
 * 搜索优化服务
 * 提供高性能的搜索查询优化
 */

const { db } = require('../config/database');

class SearchOptimizer {
  /**
   * 构建优化后的搜索条件
   * 使用前缀匹配+应用层过滤替代前导通配符
   *
   * @param {string} keyword - 搜索关键词
   * @param {string[]} fields - 要搜索的字段
   * @param {Object} options - 配置选项
   * @returns {Object} { sql, params, postFilter }
   */
  static buildOptimizedSearch(keyword, fields, options = {}) {
    if (!keyword || keyword.trim() === '') {
      return { sql: '', params: [], postFilter: null };
    }

    const { maxResults = 1000, enableFulltext = false } = options;
    const trimmedKeyword = keyword.trim();

    // 如果关键词很短，使用前缀匹配
    if (trimmedKeyword.length < 3) {
      return this.buildPrefixSearch(trimmedKeyword, fields);
    }

    // 检查是否有全文索引
    if (enableFulltext) {
      return this.buildFulltextSearch(trimmedKeyword, fields);
    }

    // 默认：前缀匹配+应用层过滤
    return this.buildPrefixSearch(trimmedKeyword, fields);
  }

  /**
   * 前缀匹配搜索（可利用索引）
   */
  static buildPrefixSearch(keyword, fields) {
    const prefixPattern = `${keyword}%`;
    const conditions = fields.map(field => `${field} LIKE ?`).join(' OR ');

    return {
      sql: `(${conditions})`,
      params: fields.map(() => prefixPattern),
      postFilter: (item) => {
        // 应用层进行包含检查
        const lowerKeyword = keyword.toLowerCase();
        return fields.some(field => {
          const value = item[field] || '';
          return value.toLowerCase().includes(lowerKeyword);
        });
      },
    };
  }

  /**
   * 全文搜索（需要全文索引支持）
   */
  static buildFulltextSearch(keyword, fields) {
    // 简单的分词处理
    const words = keyword.split(/\s+/).filter(w => w.length > 0);

    if (words.length === 0) {
      return { sql: '', params: [], postFilter: null };
    }

    // 构建 MATCH AGAINST 语句
    const matchFields = fields.join(', ');
    const searchTerm = words.map(w => `+${w}*`).join(' ');

    return {
      sql: `MATCH (${matchFields}) AGAINST (? IN BOOLEAN MODE)`,
      params: [searchTerm],
      postFilter: null, // 全文搜索足够精确，不需要应用层过滤
    };
  }

  /**
   * 构建分页查询
   * 先使用前缀匹配查询更多数据，然后在应用层过滤
   */
  static async executeOptimizedQuery(baseQuery, params, searchOptions, pagination) {
    const { page = 1, pageSize = 20 } = pagination;
    const { postFilter } = searchOptions;

    // 如果不需要应用层过滤，直接返回标准分页查询
    if (!postFilter) {
      const offset = (page - 1) * pageSize;
      const sql = `${baseQuery} LIMIT ${pageSize} OFFSET ${offset}`;
      return await db.execute(sql, params);
    }

    // 需要应用层过滤：查询更多数据以确保返回足够的结果
    const fetchSize = pageSize * 3; // 预取3倍数据
    const sql = `${baseQuery} LIMIT ${fetchSize}`;
    const [rows] = await db.execute(sql, params);

    // 应用层过滤
    const filteredRows = rows.filter(postFilter);

    // 手动分页
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedRows = filteredRows.slice(start, end);

    return [paginatedRows, filteredRows.length];
  }

  /**
   * 创建全文索引（迁移脚本使用）
   */
  static async createFulltextIndex(tableName, fields) {
    const indexName = `idx_${tableName}_fulltext`;
    const fieldList = fields.join(', ');

    try {
      await db.execute(`
        ALTER TABLE ${tableName} 
        ADD FULLTEXT INDEX ${indexName} (${fieldList})
      `);
      console.log(`✅ 全文索引 ${indexName} 创建成功`);
    } catch (error) {
      console.error(`❌ 全文索引创建失败: ${error.message}`);
    }
  }
}

module.exports = SearchOptimizer;
