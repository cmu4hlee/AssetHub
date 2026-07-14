/**
 * @swagger
 * /api/depreciation:
 *   get:
 *     summary: 获取折旧列表
 *     description: 分页获取资产折旧数据
 *     tags: [折旧管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页数量
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *           enum: [straight_line, declining_balance, units_of_production]
 *         description: 折旧方法
 *       - in: query
 *         name: as_of_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 截止日期
 *       - in: query
 *         name: residual_rate
 *         schema:
 *           type: number
 *         description: 残值率
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 资产状态
 *       - in: query
 *         name: exclude_statuses
 *         schema:
 *           type: string
 *         description: 排除的状态（逗号分隔）
 *       - in: query
 *         name: include_disposed
 *         schema:
 *           type: boolean
 *         description: 包含已处置资产
 *       - in: query
 *         name: asset_type
 *         schema:
 *           type: string
 *         description: 资产类型
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *         description: 资产类别ID
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: 部门
 *       - in: query
 *         name: department_id
 *         schema:
 *           type: integer
 *         description: 部门ID
 *       - in: query
 *         name: purchase_date_start
 *         schema:
 *           type: string
 *           format: date
 *         description: 购置日期开始
 *       - in: query
 *         name: purchase_date_end
 *         schema:
 *           type: string
 *           format: date
 *         description: 购置日期结束
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 搜索关键词
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/depreciation/{id}:
 *   get:
 *     summary: 获取资产折旧详情
 *     description: 获取单个资产的折旧详情
 *     tags: [折旧管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 资产ID
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *           enum: [straight_line, declining_balance, units_of_production]
 *         description: 折旧方法
 *       - in: query
 *         name: as_of_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 截止日期
 *       - in: query
 *         name: residual_rate
 *         schema:
 *           type: number
 *         description: 残值率
 *     responses:
 *       200:
 *         description: 成功
 *       400:
 *         description: 无效的资产ID
 *       404:
 *         description: 资产不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/depreciation/summary/by-department:
 *   get:
 *     summary: 按部门汇总折旧数据
 *     tags: [折旧管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *         description: 折旧方法
 *       - in: query
 *         name: as_of_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 截止日期
 *       - in: query
 *         name: residual_rate
 *         schema:
 *           type: number
 *         description: 残值率
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/depreciation/summary/by-type:
 *   get:
 *     summary: 按类型汇总折旧数据
 *     tags: [折旧管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *         description: 折旧方法
 *       - in: query
 *         name: as_of_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 截止日期
 *       - in: query
 *         name: residual_rate
 *         schema:
 *           type: number
 *         description: 残值率
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/depreciation/summary/by-month:
 *   get:
 *     summary: 按月份查看折旧趋势
 *     tags: [折旧管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 12
 *         description: 月份数
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *         description: 折旧方法
 *       - in: query
 *         name: as_of_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 截止日期
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/depreciation/calculate:
 *   post:
 *     summary: 计算折旧
 *     description: 批量计算资产折旧
 *     tags: [折旧管理]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assets
 *             properties:
 *               assets:
 *                 type: array
 *                 items:
 *                   type: object
 *               method:
 *                 type: string
 *                 enum: [straight_line, declining_balance, units_of_production]
 *               as_of_date:
 *                 type: string
 *                 format: date
 *               residual_rate:
 *                 type: number
 *     responses:
 *       200:
 *         description: 成功
 *       400:
 *         description: 参数错误
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/depreciation/export:
 *   get:
 *     summary: 导出折旧数据
 *     tags: [折旧管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *           default: csv
 *         description: 导出格式
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *         description: 折旧方法
 *       - in: query
 *         name: as_of_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 截止日期
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/depreciation/methods:
 *   get:
 *     summary: 获取折旧方法列表
 *     tags: [折旧管理]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate } = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');
const {
  METHOD,
  METHOD_LABELS,
  METHOD_DETAILS,
  normalizeMethod,
  normalizeAsOfDate,
  calculateDepreciation,
  calculateBatchDepreciation,
  summarizeDepreciation,
  summarizeByGroup,
  buildMonthlyTrend,
  toCsv,
  buildExportRows,
  formatDate,
} = require('../services/depreciation.service');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;
const DEFAULT_EXCLUDED_STATUSES = ['报废', 'scrapped', 'deleted'];
const ASSET_COLUMNS_CACHE_TTL_MS = 5 * 60 * 1000;
let assetColumnsCache = {
  fetchedAt: 0,
  columns: null,
};

function logDepreciationError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: getTenantId(req) || null,
    userId: req?.user?.id || null,
    username: req?.user?.username || null,
    userRole: req?.user?.role || null,
    ...context,
  });
}

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

function parseList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== 'string') {
    return [];
  }
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseId(value) {
  const id = parseInt(value, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  return id;
}

function tenantFilterToCondition(whereClause) {
  if (!whereClause) {
    return null;
  }
  return whereClause.replace(/^\s*AND\s+/i, '');
}

async function getAssetColumnsSet() {
  const now = Date.now();
  if (assetColumnsCache.columns && now - assetColumnsCache.fetchedAt < ASSET_COLUMNS_CACHE_TTL_MS) {
    return assetColumnsCache.columns;
  }

  const [rows] = await db.execute('SHOW COLUMNS FROM assets');
  const columns = new Set((rows || []).map(row => String(row.Field)));
  assetColumnsCache = {
    fetchedAt: now,
    columns,
  };
  return columns;
}

function hasColumn(columns, columnName) {
  return columns instanceof Set && columns.has(columnName);
}

function safeColumnExpr(columns, alias, columnName, fallbackExpr = 'NULL') {
  return hasColumn(columns, columnName) ? `${alias}.${columnName}` : fallbackExpr;
}

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

function buildWhereClause(req, assetColumns, alias = 'a') {
  const whereParts = ['1=1'];
  const params = [];

  const tenantFilter = addTenantFilter(req, alias);
  const tenantCondition = tenantFilterToCondition(tenantFilter.whereClause);
  if (tenantCondition) {
    whereParts.push(tenantCondition);
    params.push(...tenantFilter.params);
  }

  const query = req.query || {};

  const includeDisposed = parseBoolean(query.include_disposed);
  const excludedStatuses = parseList(query.exclude_statuses);
  const effectiveExcludedStatuses =
    includeDisposed && excludedStatuses.length === 0 ? [] : excludedStatuses.length > 0 ? excludedStatuses : DEFAULT_EXCLUDED_STATUSES;

  if (effectiveExcludedStatuses.length > 0 && hasColumn(assetColumns, 'status')) {
    whereParts.push(`${alias}.status NOT IN (${effectiveExcludedStatuses.map(() => '?').join(', ')})`);
    params.push(...effectiveExcludedStatuses);
  }

  const statusFilter = parseList(query.status);
  if (statusFilter.length > 0 && hasColumn(assetColumns, 'status')) {
    whereParts.push(`${alias}.status IN (${statusFilter.map(() => '?').join(', ')})`);
    params.push(...statusFilter);
  }

  if (query.asset_type && hasColumn(assetColumns, 'asset_type')) {
    whereParts.push(`${alias}.asset_type = ?`);
    params.push(String(query.asset_type).trim());
  }

  const categoryId = parseId(query.category_id);
  if (categoryId && hasColumn(assetColumns, 'category_id')) {
    whereParts.push(`${alias}.category_id = ?`);
    params.push(categoryId);
  }

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

  if (query.purchase_date_start && hasColumn(assetColumns, 'purchase_date')) {
    whereParts.push(`${alias}.purchase_date >= ?`);
    params.push(String(query.purchase_date_start).trim());
  }

  if (query.purchase_date_end && hasColumn(assetColumns, 'purchase_date')) {
    whereParts.push(`${alias}.purchase_date <= ?`);
    params.push(String(query.purchase_date_end).trim());
  }

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

function buildCalcOptions(queryOrBody = {}) {
  return {
    method: normalizeMethod(queryOrBody.method),
    asOfDate: normalizeAsOfDate(queryOrBody.as_of_date || queryOrBody.asOfDate),
    residualRate: queryOrBody.residual_rate || queryOrBody.residualRate,
  };
}

function handleTenantError(res, error) {
  if (error?.message === 'MISSING_TENANT_ID' || error?.message === 'INVALID_TENANT_ID') {
    return res.status(400).json({
      success: false,
      message: '当前租户信息无效，请重新进入企业空间后重试',
      error: error.message,
    });
  }
  return null;
}

async function listHandler(req, res) {
  try {
    const calcOptions = buildCalcOptions(req.query);
    const { rows, total, page, pageSize } = await queryAssets(req, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });

    const assetsWithDepreciation = calculateBatchDepreciation(rows, calcOptions);
    let summarySourceAssets = assetsWithDepreciation;

    // 统计卡片需要反映当前筛选条件下的全量资产，而不是当前页数据。
    if (total > assetsWithDepreciation.length) {
      const { rows: summaryRows } = await queryAssets(req, {
        noPagination: true,
        skipCount: true,
      });
      summarySourceAssets = calculateBatchDepreciation(summaryRows, calcOptions);
    }

    const summary = summarizeDepreciation(summarySourceAssets);
    summary.totalAssets = total;

    res.json({
      success: true,
      data: {
        assets: assetsWithDepreciation,
        summary,
        method: calcOptions.method,
        methodLabel: METHOD_LABELS[calcOptions.method],
        asOfDate: formatDate(calcOptions.asOfDate),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
        },
      },
    });
  } catch (error) {
    if (handleTenantError(res, error)) {
      return;
    }
    logDepreciationError('获取折旧数据失败', error, req, {
      page: req.query?.page || null,
      pageSize: req.query?.pageSize || null,
    });
    res.status(500).json({ success: false, message: '获取折旧数据失败', error: error.message });
  }
}

async function detailHandler(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: '无效的资产ID' });
    }

    const asset = await queryAssetById(req, id);
    if (!asset) {
      return res.status(404).json({ success: false, message: '资产不存在或无权限访问' });
    }

    const calcOptions = buildCalcOptions(req.query);
    const depreciation = calculateDepreciation(asset, calcOptions);

    res.json({
      success: true,
      data: {
        asset,
        depreciation,
        method: calcOptions.method,
        methodLabel: METHOD_LABELS[calcOptions.method],
        asOfDate: formatDate(calcOptions.asOfDate),
      },
    });
  } catch (error) {
    if (handleTenantError(res, error)) {
      return;
    }
    logDepreciationError('获取资产折旧详情失败', error, req, {
      assetId: req.params?.id || null,
    });
    res.status(500).json({ success: false, message: '获取资产折旧详情失败', error: error.message });
  }
}

async function summaryByDepartmentHandler(req, res) {
  try {
    const calcOptions = buildCalcOptions(req.query);
    const { rows } = await queryAssets(req, { noPagination: true, skipCount: true });
    const assetsWithDepreciation = calculateBatchDepreciation(rows, calcOptions);

    const summaries = summarizeByGroup(
      assetsWithDepreciation,
      item => item.department_display || item.department || item.department_new || '未分配部门',
      'departmentName',
    );

    res.json({
      success: true,
      data: {
        summaries,
        method: calcOptions.method,
        methodLabel: METHOD_LABELS[calcOptions.method],
        asOfDate: formatDate(calcOptions.asOfDate),
      },
    });
  } catch (error) {
    if (handleTenantError(res, error)) {
      return;
    }
    logDepreciationError('获取部门折旧汇总失败', error, req);
    res.status(500).json({ success: false, message: '获取部门折旧汇总失败', error: error.message });
  }
}

async function summaryByTypeHandler(req, res) {
  try {
    const calcOptions = buildCalcOptions(req.query);
    const { rows } = await queryAssets(req, { noPagination: true, skipCount: true });
    const assetsWithDepreciation = calculateBatchDepreciation(rows, calcOptions);

    const summaries = summarizeByGroup(
      assetsWithDepreciation,
      item => item.asset_type || '未分类',
      'assetType',
    );

    res.json({
      success: true,
      data: {
        summaries,
        method: calcOptions.method,
        methodLabel: METHOD_LABELS[calcOptions.method],
        asOfDate: formatDate(calcOptions.asOfDate),
      },
    });
  } catch (error) {
    if (handleTenantError(res, error)) {
      return;
    }
    logDepreciationError('获取类型折旧汇总失败', error, req);
    res.status(500).json({ success: false, message: '获取类型折旧汇总失败', error: error.message });
  }
}

async function summaryByMonthHandler(req, res) {
  try {
    const calcOptions = buildCalcOptions(req.query);
    const months = sanitizePageSize(req.query.months, 12);
    const { rows } = await queryAssets(req, { noPagination: true, skipCount: true });

    const trend = buildMonthlyTrend(rows, {
      ...calcOptions,
      months,
    });

    res.json({
      success: true,
      data: {
        months,
        trend,
        method: calcOptions.method,
        methodLabel: METHOD_LABELS[calcOptions.method],
        asOfDate: formatDate(calcOptions.asOfDate),
      },
    });
  } catch (error) {
    if (handleTenantError(res, error)) {
      return;
    }
    logDepreciationError('获取月度折旧趋势失败', error, req, {
      months: req.query?.months || null,
    });
    res.status(500).json({ success: false, message: '获取月度折旧趋势失败', error: error.message });
  }
}

async function calculateHandler(req, res) {
  try {
    const { assets } = req.body || {};
    if (!Array.isArray(assets)) {
      return res.status(400).json({ success: false, message: '请提供有效的资产列表' });
    }

    const calcOptions = buildCalcOptions(req.body || {});
    const assetsWithDepreciation = calculateBatchDepreciation(assets, calcOptions);
    const summary = summarizeDepreciation(assetsWithDepreciation);

    res.json({
      success: true,
      data: {
        assets: assetsWithDepreciation,
        summary,
        method: calcOptions.method,
        methodLabel: METHOD_LABELS[calcOptions.method],
        asOfDate: formatDate(calcOptions.asOfDate),
      },
    });
  } catch (error) {
    logDepreciationError('计算折旧失败', error, req, {
      assetsCount: Array.isArray(req.body?.assets) ? req.body.assets.length : null,
    });
    res.status(500).json({ success: false, message: '计算折旧失败', error: error.message });
  }
}

async function exportHandler(req, res) {
  try {
    const format = String(req.query.format || 'csv').toLowerCase();
    const calcOptions = buildCalcOptions(req.query);
    const { rows } = await queryAssets(req, { noPagination: true, skipCount: true });
    const assetsWithDepreciation = calculateBatchDepreciation(rows, calcOptions);

    const exportRows = buildExportRows(assetsWithDepreciation);

    if (format === 'json') {
      return res.json({
        success: true,
        data: exportRows,
      });
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

    const csvContent = toCsv(exportRows, columns);

    res.json({
      success: true,
      data: csvContent,
      meta: {
        filename: `depreciation_report_${formatDate(calcOptions.asOfDate)}.csv`,
        total: exportRows.length,
      },
    });
  } catch (error) {
    if (handleTenantError(res, error)) {
      return;
    }
    logDepreciationError('导出折旧数据失败', error, req, {
      format: req.query?.format || 'csv',
    });
    res.status(500).json({ success: false, message: '导出折旧数据失败', error: error.message });
  }
}

function methodsHandler(req, res) {
  const methods = Object.values(METHOD).map(method => ({
    code: method,
    label: METHOD_LABELS[method],
    ...METHOD_DETAILS[method],
  }));

  res.json({
    success: true,
    data: methods,
  });
}

// 主路径
router.get('/', authenticate, listHandler);
router.get('/summary/by-department', authenticate, summaryByDepartmentHandler);
router.get('/summary/by-type', authenticate, summaryByTypeHandler);
router.get('/summary/by-month', authenticate, summaryByMonthHandler);
router.post('/calculate', authenticate, calculateHandler);
router.get('/export', authenticate, exportHandler);
router.get('/methods', authenticate, methodsHandler);

// 兼容历史路径 /depreciation/*
router.get('/depreciation', authenticate, listHandler);
router.get('/depreciation/summary/by-department', authenticate, summaryByDepartmentHandler);
router.get('/depreciation/summary/by-type', authenticate, summaryByTypeHandler);
router.get('/depreciation/summary/by-month', authenticate, summaryByMonthHandler);
router.post('/depreciation/calculate', authenticate, calculateHandler);
router.get('/depreciation/export', authenticate, exportHandler);
router.get('/depreciation/methods', authenticate, methodsHandler);
router.get('/depreciation/:id(\\d+)', authenticate, detailHandler);
router.get('/:id(\\d+)', authenticate, detailHandler);

module.exports = router;
