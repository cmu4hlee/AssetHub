/**
 * 折旧管理服务 - 业务逻辑层
 * 从全局 services/depreciation.service.js 迁移，保持原有逻辑
 */
const db = require('../../../config/database');
const logger = require('../../../config/logger');
const depreciationService = require('../../../services/depreciation.service');

// 缓存配置
const ASSET_COLUMNS_CACHE_TTL_MS = 5 * 60 * 1000;
let assetColumnsCache = {
  fetchedAt: 0,
  columns: null,
};

// 分页配置
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;
const DEFAULT_EXCLUDED_STATUSES = ['报废', 'scrapped', 'deleted'];

/**
 * 获取资产表列信息（带缓存）
 */
async function getAssetColumnsSet() {
  const now = Date.now();
  if (assetColumnsCache.columns && now - assetColumnsCache.fetchedAt < ASSET_COLUMNS_CACHE_TTL_MS) {
    return assetColumnsCache.columns;
  }

  try {
    const [rows] = await db.execute('SHOW COLUMNS FROM assets');
    const columns = new Set((rows || []).map(row => String(row.Field)));
    assetColumnsCache = {
      fetchedAt: now,
      columns,
    };
    return columns;
  } catch (error) {
    logger.error('获取资产表结构失败', { error: error.message });
    return new Set();
  }
}

/**
 * 检查列是否存在
 */
function hasColumn(columns, columnName) {
  return columns instanceof Set && columns.has(columnName);
}

/**
 * 安全列表达式
 */
function safeColumnExpr(columns, alias, columnName, fallbackExpr = 'NULL') {
  return hasColumn(columns, columnName) ? `${alias}.${columnName}` : fallbackExpr;
}

/**
 * 构建资产查询列SQL
 */
function createColumnsSql(assetColumns, alias = 'a') {
  const departmentExpr = safeColumnExpr(assetColumns, alias, 'department');
  const departmentNewExpr = safeColumnExpr(assetColumns, alias, 'department_new');
  const departmentDisplayExpr = hasColumn(assetColumns, 'department') && hasColumn(assetColumns, 'department_new')
    ? `COALESCE(NULLIF(${departmentExpr}, ''), NULLIF(${departmentNewExpr}, ''), '未分配')`
    : hasColumn(assetColumns, 'department')
      ? `COALESCE(NULLIF(${departmentExpr}, ''), '未分配')`
      : hasColumn(assetColumns, 'department_new')
        ? `COALESCE(NULLIF(${departmentNewExpr}, ''), '未分配')`
        : '\'未分配\'';

  const columns = [
    `${safeColumnExpr(assetColumns, alias, 'id')} AS id`,
    `${safeColumnExpr(assetColumns, alias, 'asset_code')} AS asset_code`,
    `${safeColumnExpr(assetColumns, alias, 'asset_name')} AS asset_name`,
    `${safeColumnExpr(assetColumns, alias, 'asset_type')} AS asset_type`,
    `${safeColumnExpr(assetColumns, alias, 'category_id')} AS category_id`,
    `${safeColumnExpr(assetColumns, alias, 'brand')} AS brand`,
    `${safeColumnExpr(assetColumns, alias, 'model')} AS model`,
    `${departmentExpr} AS department`,
    `${departmentNewExpr} AS department_new`,
    `${safeColumnExpr(assetColumns, alias, 'asset_department_code')} AS asset_department_code`,
    `${departmentDisplayExpr} AS department_display`,
    `${safeColumnExpr(assetColumns, alias, 'purchase_date')} AS purchase_date`,
    `${safeColumnExpr(assetColumns, alias, 'purchase_price')} AS purchase_price`,
    `${safeColumnExpr(assetColumns, alias, 'current_value')} AS current_value`,
    `${safeColumnExpr(assetColumns, alias, 'depreciation_method')} AS depreciation_method`,
    `${safeColumnExpr(assetColumns, alias, 'depreciation_years')} AS depreciation_years`,
    `${safeColumnExpr(assetColumns, alias, 'status')} AS status`,
    `${safeColumnExpr(assetColumns, alias, 'created_at')} AS created_at`,
    `${safeColumnExpr(assetColumns, alias, 'updated_at')} AS updated_at`,
  ];

  return `
    SELECT
      ${columns.join(',\n      ')}
  `;
}

/**
 * 解析布尔值
 */
function parseBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value == null) {
    return false;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

/**
 * 解析分页参数
 */
function sanitizePage(value, fallback = 1) {
  const page = parseInt(value, 10);
  if (!Number.isFinite(page) || page <= 0) {
    return fallback;
  }
  return page;
}

function sanitizePageSize(value, fallback = DEFAULT_PAGE_SIZE) {
  const pageSize = parseInt(value, 10);
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    return fallback;
  }
  return Math.min(pageSize, MAX_PAGE_SIZE);
}

/**
 * 解析列表值
 */
function parseList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== 'string') {
    return [];
  }
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * 解析ID
 */
function parseId(value) {
  const id = parseInt(value, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  return id;
}

/**
 * 转换租户过滤条件
 */
function tenantFilterToCondition(whereClause) {
  if (!whereClause) {
    return null;
  }
  return whereClause.replace(/^\s*AND\s+/i, '');
}

/**
 * 构建WHERE子句
 */
function buildWhereClause(req, assetColumns, alias = 'a') {
  const whereParts = ['1=1'];
  const params = [];

  // 添加租户过滤
  const { addTenantFilter } = require('../../../middleware/tenant-filter');
  const tenantFilter = addTenantFilter(req, alias);
  const tenantCondition = tenantFilterToCondition(tenantFilter.whereClause);
  if (tenantCondition) {
    whereParts.push(tenantCondition);
    params.push(...tenantFilter.params);
  }

  const query = req.query || {};

  // 处理排除状态
  const includeDisposed = parseBoolean(query.include_disposed);
  const excludedStatuses = parseList(query.exclude_statuses);
  const effectiveExcludedStatuses =
    includeDisposed && excludedStatuses.length === 0 ? [] : excludedStatuses.length > 0 ? excludedStatuses : DEFAULT_EXCLUDED_STATUSES;

  if (effectiveExcludedStatuses.length > 0 && hasColumn(assetColumns, 'status')) {
    whereParts.push(`${alias}.status NOT IN (${effectiveExcludedStatuses.map(() => '?').join(', ')})`);
    params.push(...effectiveExcludedStatuses);
  }

  // 状态过滤
  const statusFilter = parseList(query.status);
  if (statusFilter.length > 0 && hasColumn(assetColumns, 'status')) {
    whereParts.push(`${alias}.status IN (${statusFilter.map(() => '?').join(', ')})`);
    params.push(...statusFilter);
  }

  // 资产类型
  if (query.asset_type && hasColumn(assetColumns, 'asset_type')) {
    whereParts.push(`${alias}.asset_type = ?`);
    params.push(String(query.asset_type).trim());
  }

  // 类别ID
  const categoryId = parseId(query.category_id);
  if (categoryId && hasColumn(assetColumns, 'category_id')) {
    whereParts.push(`${alias}.category_id = ?`);
    params.push(categoryId);
  }

  // 部门
  if (query.department) {
    const departmentClauses = [];
    const department = String(query.department).trim();
    if (hasColumn(assetColumns, 'department')) {
      departmentClauses.push(`${alias}.department = ?`);
      params.push(department);
    }
    if (hasColumn(assetColumns, 'department_new')) {
      departmentClauses.push(`${alias}.department_new = ?`);
      params.push(department);
    }
    if (departmentClauses.length > 0) {
      whereParts.push(`(${departmentClauses.join(' OR ')})`);
    }
  }

  // 部门ID
  const departmentId = parseId(query.department_id);
  if (departmentId) {
    const departmentMappingClauses = [];
    if (hasColumn(assetColumns, 'department')) {
      departmentMappingClauses.push(`d.department_name = ${alias}.department`);
      departmentMappingClauses.push(`d.department_code = ${alias}.department`);
    }
    if (hasColumn(assetColumns, 'department_new')) {
      departmentMappingClauses.push(`d.department_name = ${alias}.department_new`);
      departmentMappingClauses.push(`d.department_code = ${alias}.department_new`);
    }
    if (hasColumn(assetColumns, 'asset_department_code')) {
      departmentMappingClauses.push(`d.department_code = ${alias}.asset_department_code`);
    }

    if (departmentMappingClauses.length > 0) {
      whereParts.push(`
        EXISTS (
          SELECT 1
          FROM departments d
          WHERE d.id = ?
            AND (
              ${departmentMappingClauses.join('\n            OR ')}
            )
        )
      `);
      params.push(departmentId);
    }
  }

  // 购置日期范围
  if (query.purchase_date_start && hasColumn(assetColumns, 'purchase_date')) {
    whereParts.push(`${alias}.purchase_date >= ?`);
    params.push(String(query.purchase_date_start).trim());
  }

  if (query.purchase_date_end && hasColumn(assetColumns, 'purchase_date')) {
    whereParts.push(`${alias}.purchase_date <= ?`);
    params.push(String(query.purchase_date_end).trim());
  }

  // 关键词搜索
  if (query.keyword) {
    const keyword = `%${String(query.keyword).trim()}%`;
    const keywordClauses = [];
    if (hasColumn(assetColumns, 'asset_code')) keywordClauses.push(`${alias}.asset_code LIKE ?`);
    if (hasColumn(assetColumns, 'asset_name')) keywordClauses.push(`${alias}.asset_name LIKE ?`);
    if (hasColumn(assetColumns, 'brand')) keywordClauses.push(`${alias}.brand LIKE ?`);
    if (hasColumn(assetColumns, 'model')) keywordClauses.push(`${alias}.model LIKE ?`);

    if (keywordClauses.length > 0) {
      whereParts.push(`(
        ${keywordClauses.join('\n        OR ')}
      )`);
      params.push(...keywordClauses.map(() => keyword));
    }
  }

  return {
    whereSql: `WHERE ${whereParts.join(' AND ')}`,
    params,
  };
}

/**
 * 查询资产列表
 */
async function queryAssets(req, options = {}) {
  const assetColumns = await getAssetColumnsSet();
  const { whereSql, params } = buildWhereClause(req, assetColumns, 'a');
  const baseFrom = 'FROM assets a';

  let total = null;
  if (!options.skipCount) {
    const [countRows] = await db.execute(`SELECT COUNT(*) AS total ${baseFrom} ${whereSql}`, params);
    total = countRows?.[0]?.total || 0;
  }

  const orderSql = hasColumn(assetColumns, 'purchase_date')
    ? 'ORDER BY a.purchase_date DESC, a.id DESC'
    : 'ORDER BY a.id DESC';

  let dataSql = `${createColumnsSql(assetColumns)} ${baseFrom} ${whereSql} ${orderSql}`;
  const dataParams = [...params];

  if (!options.noPagination) {
    const page = sanitizePage(options.page || req.query.page, 1);
    const pageSize = sanitizePageSize(options.pageSize || req.query.pageSize, DEFAULT_PAGE_SIZE);
    const offset = (page - 1) * pageSize;

    dataSql += ' LIMIT ? OFFSET ?';
    dataParams.push(pageSize, offset);

    const [rows] = await db.execute(dataSql, dataParams);
    return {
      rows,
      total,
      page,
      pageSize,
    };
  }

  const [rows] = await db.execute(dataSql, dataParams);
  return {
    rows,
    total,
  };
}

/**
 * 根据ID查询单个资产
 */
async function queryAssetById(req, id) {
  const assetColumns = await getAssetColumnsSet();
  if (!hasColumn(assetColumns, 'id')) {
    return null;
  }
  const { whereSql, params } = buildWhereClause(req, assetColumns, 'a');

  const sql = `
    ${createColumnsSql(assetColumns)}
    FROM assets a
    ${whereSql}
      AND a.id = ?
    LIMIT 1
  `;

  const [rows] = await db.execute(sql, [...params, id]);
  return rows?.[0] || null;
}

/**
 * 构建计算选项
 */
function buildCalcOptions(queryOrBody = {}) {
  return {
    method: depreciationService.normalizeMethod(queryOrBody.method),
    asOfDate: depreciationService.normalizeAsOfDate(queryOrBody.as_of_date || queryOrBody.asOfDate),
    residualRate: queryOrBody.residual_rate || queryOrBody.residualRate,
  };
}

class DepreciationManagementService {
  /**
   * 获取折旧列表
   */
  async getDepreciationList(req) {
    const calcOptions = buildCalcOptions(req.query);
    const { rows, total, page, pageSize } = await queryAssets(req, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });

    const assetsWithDepreciation = depreciationService.calculateBatchDepreciation(rows, calcOptions);
    let summarySourceAssets = assetsWithDepreciation;

    // 统计卡片需要反映当前筛选条件下的全量资产
    if (total > assetsWithDepreciation.length) {
      const { rows: summaryRows } = await queryAssets(req, {
        noPagination: true,
        skipCount: true,
      });
      summarySourceAssets = depreciationService.calculateBatchDepreciation(summaryRows, calcOptions);
    }

    const summary = depreciationService.summarizeDepreciation(summarySourceAssets);
    summary.totalAssets = total;

    return {
      assets: assetsWithDepreciation,
      summary,
      method: calcOptions.method,
      methodLabel: depreciationService.METHOD_LABELS[calcOptions.method],
      asOfDate: depreciationService.formatDate(calcOptions.asOfDate),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
      },
    };
  }

  /**
   * 获取折旧详情
   */
  async getDepreciationDetail(req, id) {
    const asset = await queryAssetById(req, id);
    if (!asset) {
      return null;
    }

    const calcOptions = buildCalcOptions(req.query);
    const depreciation = depreciationService.calculateDepreciation(asset, calcOptions);

    return {
      asset,
      depreciation,
      method: calcOptions.method,
      methodLabel: depreciationService.METHOD_LABELS[calcOptions.method],
      asOfDate: depreciationService.formatDate(calcOptions.asOfDate),
    };
  }

  /**
   * 按部门汇总
   */
  async getSummaryByDepartment(req) {
    const calcOptions = buildCalcOptions(req.query);
    const { rows } = await queryAssets(req, { noPagination: true, skipCount: true });
    const assetsWithDepreciation = depreciationService.calculateBatchDepreciation(rows, calcOptions);

    const summaries = depreciationService.summarizeByGroup(
      assetsWithDepreciation,
      item => item.department_display || item.department || item.department_new || '未分配部门',
      'departmentName',
    );

    return {
      summaries,
      method: calcOptions.method,
      methodLabel: depreciationService.METHOD_LABELS[calcOptions.method],
      asOfDate: depreciationService.formatDate(calcOptions.asOfDate),
    };
  }

  /**
   * 按类型汇总
   */
  async getSummaryByType(req) {
    const calcOptions = buildCalcOptions(req.query);
    const { rows } = await queryAssets(req, { noPagination: true, skipCount: true });
    const assetsWithDepreciation = depreciationService.calculateBatchDepreciation(rows, calcOptions);

    const summaries = depreciationService.summarizeByGroup(
      assetsWithDepreciation,
      item => item.asset_type || '未分类',
      'assetType',
    );

    return {
      summaries,
      method: calcOptions.method,
      methodLabel: depreciationService.METHOD_LABELS[calcOptions.method],
      asOfDate: depreciationService.formatDate(calcOptions.asOfDate),
    };
  }

  /**
   * 按月份趋势
   */
  async getSummaryByMonth(req) {
    const calcOptions = buildCalcOptions(req.query);
    const months = sanitizePageSize(req.query.months, 12);
    const { rows } = await queryAssets(req, { noPagination: true, skipCount: true });

    const trend = depreciationService.buildMonthlyTrend(rows, {
      ...calcOptions,
      months,
    });

    return {
      months,
      trend,
      method: calcOptions.method,
      methodLabel: depreciationService.METHOD_LABELS[calcOptions.method],
      asOfDate: depreciationService.formatDate(calcOptions.asOfDate),
    };
  }

  /**
   * 计算折旧
   */
  async calculateDepreciation(req) {
    const { assets } = req.body || {};
    if (!Array.isArray(assets)) {
      throw new Error('请提供有效的资产列表');
    }

    const calcOptions = buildCalcOptions(req.body || {});
    const assetsWithDepreciation = depreciationService.calculateBatchDepreciation(assets, calcOptions);
    const summary = depreciationService.summarizeDepreciation(assetsWithDepreciation);

    return {
      assets: assetsWithDepreciation,
      summary,
      method: calcOptions.method,
      methodLabel: depreciationService.METHOD_LABELS[calcOptions.method],
      asOfDate: depreciationService.formatDate(calcOptions.asOfDate),
    };
  }

  /**
   * 导出折旧数据
   */
  async exportDepreciation(req) {
    const format = String(req.query.format || 'csv').toLowerCase();
    const calcOptions = buildCalcOptions(req.query);
    const { rows } = await queryAssets(req, { noPagination: true, skipCount: true });
    const assetsWithDepreciation = depreciationService.calculateBatchDepreciation(rows, calcOptions);

    const exportRows = depreciationService.buildExportRows(assetsWithDepreciation);

    if (format === 'json') {
      return {
        data: exportRows,
        meta: {
          total: exportRows.length,
        },
      };
    }

    const columns = [
      { key: 'assetCode', label: '资产编号' },
      { key: 'assetName', label: '资产名称' },
      { key: 'assetType', label: '资产类型' },
      { key: 'department', label: '部门' },
      { key: 'purchaseDate', label: '购置日期' },
      { key: 'purchasePrice', label: '购置金额' },
      { key: 'residualValue', label: '残值' },
      { key: 'accumulatedDepreciation', label: '累计折旧' },
      { key: 'currentBookValue', label: '账面净值' },
      { key: 'depreciationRate', label: '折旧率' },
      { key: 'monthsUsed', label: '已使用月数' },
      { key: 'remainingMonths', label: '剩余月数' },
      { key: 'methodLabel', label: '计算方法' },
    ];

    const csvContent = depreciationService.toCsv(exportRows, columns);

    return {
      data: csvContent,
      meta: {
        filename: `depreciation_report_${depreciationService.formatDate(calcOptions.asOfDate)}.csv`,
        total: exportRows.length,
      },
    };
  }

  /**
   * 获取折旧方法列表
   */
  getDepreciationMethods() {
    return Object.values(depreciationService.METHOD).map(method => ({
      code: method,
      label: depreciationService.METHOD_LABELS[method],
      ...depreciationService.METHOD_DETAILS[method],
    }));
  }
}

module.exports = new DepreciationManagementService();
