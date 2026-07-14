/**
 * 资产查询路由模块
 * 包含资产列表查询、详情查询、重复检查、变更日志等
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate } = require('../../middleware/auth');
const { addTenantFilter, getTenantId, requireTenantId } = require('../../middleware/tenant-filter');
const { logAudit } = require('../../middleware/auditLogger');
const { cacheService } = require('../../services/cache/CacheService');
const logger = require('../../config/logger');
const workflowService = require('../../services/asset-workflow.service');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = Number.parseInt(process.env.ASSET_LIST_DEFAULT_PAGE_SIZE || '20', 10);
const MAX_PAGE_SIZE = Number.parseInt(process.env.ASSET_LIST_MAX_PAGE_SIZE || '2000', 10);
const ASSET_RESPONSIBLE_USER_JOIN =
  'LEFT JOIN users u ON a.responsible_person = u.id AND u.tenant_id = a.tenant_id';
const ASSET_SPECIAL_EQUIPMENT_JOIN =
  'LEFT JOIN special_equipment se ON se.asset_id = a.id AND se.tenant_id = a.tenant_id';

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const buildLatestLocationMap = async (assetCodes, tenantId) => {
  if (!Array.isArray(assetCodes) || assetCodes.length === 0 || !tenantId) {
    return new Map();
  }

  const placeholders = assetCodes.map(() => '?').join(',');
  const [locationRows] = await db.execute(
    `SELECT
       h.asset_code,
       h.address AS location,
       h.latitude,
       h.longitude,
       h.record_time AS recorded_at,
       h.update_source AS recorded_by_name
     FROM asset_location_history h
     INNER JOIN (
       SELECT asset_code, MAX(record_time) AS latest_record_time
       FROM asset_location_history
       WHERE tenant_id = ? AND asset_code IN (${placeholders})
       GROUP BY asset_code
     ) latest
       ON latest.asset_code = h.asset_code
      AND latest.latest_record_time = h.record_time
     WHERE h.tenant_id = ?
     ORDER BY h.asset_code ASC`,
    [tenantId, ...assetCodes, tenantId],
  );

  return locationRows.reduce((map, location) => {
    if (!map.has(location.asset_code)) {
      map.set(location.asset_code, location);
    }
    return map;
  }, new Map());
};

/**
 * @swagger
 * /api/assets:
 *   get:
 *     summary: 获取资产列表
 *     tags: [Assets]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: department_id
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 成功获取资产列表
 */
router.get('/', authenticate, async (req, res) => {
  try {
    let tenantId = getTenantId(req);
    // 超级管理员如果未选择租户，允许通过 query 参数或 header 指定
    if (!tenantId && req.user.role === 'super_admin') {
      tenantId = req.query.tenant_id
        ? parseInt(req.query.tenant_id, 10)
        : req.headers['x-tenant-id']
          ? parseInt(req.headers['x-tenant-id'], 10)
          : null;
    }
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '租户ID缺失' });
    }

    // 兼容分页参数别名，避免 pageNum/current 传入时页码失效
    const pageRaw = req.query.page ?? req.query.pageNum ?? req.query.current;
    const pageSizeRaw =
      req.query.pageSize ?? req.query.size ?? req.query.limit ?? req.query.perPage;

    let {
      search = '',
      status,
      department_id,
      department = '',
      category_id,
      location,
      sortField = 'created_at',
      sortOrder = 'desc',
    } = req.query;

    // 参数验证和清理
    const pageNum = parsePositiveInt(pageRaw, DEFAULT_PAGE);
    const requestedPageSize = parsePositiveInt(pageSizeRaw, DEFAULT_PAGE_SIZE);
    const safeMaxPageSize =
      Number.isInteger(MAX_PAGE_SIZE) && MAX_PAGE_SIZE > 0 ? MAX_PAGE_SIZE : 2000;
    const pageSizeNum = clamp(requestedPageSize, 1, safeMaxPageSize);

    search = String(search || '')
      .trim()
      .substring(0, 100); // 限制搜索长度
    department = String(department || '')
      .trim()
      .substring(0, 100);
    sortField = [
      'created_at',
      'updated_at',
      'purchase_date',
      'asset_name',
      'purchase_price',
      'current_value',
    ].includes(sortField)
      ? sortField
      : 'created_at';
    sortOrder = ['asc', 'desc'].includes(String(sortOrder).toLowerCase())
      ? sortOrder.toLowerCase()
      : 'desc';

    // 构建缓存键
    const cacheKey = {
      tenantId,
      page: pageNum,
      pageSize: pageSizeNum,
      search,
      status,
      department_id,
      department,
      category_id,
      location,
      sortField,
      sortOrder,
    };

    // 使用缓存
    const cached = await cacheService.get('asset:list', cacheKey);
    if (cached && !req.query.noCache) {
      logger.debug('Asset list served from cache');
      return res.json(cached);
    }

    // 构建查询条件
    const conditions = ['a.tenant_id = ?', 'a.is_deleted = 0'];
    const params = [tenantId];

    if (status) {
      conditions.push('a.status = ?');
      params.push(status);
    }

    if (department_id) {
      conditions.push('a.department_new = ?');
      params.push(department_id);
    }

    if (department) {
      const departmentLike = `%${department}%`;
      conditions.push(`(
        a.department LIKE ?
        OR a.department_new LIKE ?
        OR a.department_new IN (
          SELECT department_code
          FROM departments
          WHERE tenant_id = ?
            AND department_name LIKE ?
        )
        OR a.department IN (
          SELECT department_name
          FROM departments
          WHERE tenant_id = ?
            AND department_name LIKE ?
        )
      )`);
      params.push(
        departmentLike,
        departmentLike,
        tenantId,
        departmentLike,
        tenantId,
        departmentLike,
      );
    }

    if (category_id) {
      conditions.push('a.category_id = ?');
      params.push(category_id);
    }

    if (location) {
      // 优化：使用前缀匹配替代前导通配符
      conditions.push('a.location LIKE ?');
      params.push(`${location}%`);
    }

    if (search) {
      // 优化：使用前缀匹配替代前导通配符，提高查询性能
      // 资产编码使用前缀匹配（用户通常从前几位开始搜索）
      conditions.push('(a.asset_code LIKE ? OR a.asset_name LIKE ? OR a.brand LIKE ?)');
      params.push(`${search}%`, `%${search}%`, `${search}%`);
    }

    const whereClause = conditions.join(' AND ');
    const orderClause = `a.${sortField} ${sortOrder.toUpperCase()}`;

    // 执行分页查询
    const offset = (pageNum - 1) * pageSizeNum;

    const queryStart = Date.now();

    // 查询总数
    const countSql = `SELECT COUNT(*) as total FROM assets a WHERE ${whereClause}`;

    // 查询数据
    const listSql = `
      SELECT
        a.*,
        c.name as category_name,
        d.department_name,
        u.username as responsible_person_name,
        se.id as special_equipment_id,
        se.equipment_type,
        se.registration_code
      FROM assets a
      LEFT JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN departments d ON a.department_new = d.department_code AND a.tenant_id = d.tenant_id
      ${ASSET_RESPONSIBLE_USER_JOIN}
      ${ASSET_SPECIAL_EQUIPMENT_JOIN}
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `;
    const [[countRows], [rows]] = await Promise.all([
      db.execute(countSql, params),
      db.execute(listSql, [...params, pageSizeNum, offset]),
    ]);
    const total = Number.parseInt(countRows?.[0]?.total, 10) || 0;

    const assetCodes = Array.from(
      new Set(rows.map(row => row.asset_code).filter(code => Boolean(code))),
    );
    const latestLocationMap = await buildLatestLocationMap(assetCodes, tenantId);

    const listWithLocation = rows.map(row => ({
      ...row,
      latest_location: latestLocationMap.get(row.asset_code) || null,
    }));

    const result = {
      data: listWithLocation,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        hasMore: rows.length === pageSizeNum,
      },
    };

    const response = {
      success: true,
      data: {
        list: result.data,
        pagination: result.pagination,
      },
      meta: {
        duration: Date.now() - queryStart,
        cached: false,
        requestedPageSize,
        maxPageSize: safeMaxPageSize,
      },
    };

    // 缓存结果（5分钟）
    await cacheService.set('asset:list', cacheKey, response, { ttl: 300 });

    res.json(response);
  } catch (error) {
    logger.error('Get asset list failed:', error);
    res.status(500).json({ success: false, message: '获取资产列表失败', error: error.message });
  }
});
/**
 * @swagger
 * /api/assets/all:
 *   get:
 *     summary: 全量查询资产列表（不分页）
 *     description: 返回所有符合条件的资产数据，用于数据导出等场景
 *     tags: [Assets]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: 搜索关键词（资产编码、名称、品牌）
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: 资产状态
 *       - in: query
 *         name: department_id
 *         schema: { type: integer }
 *         description: 部门ID
 *       - in: query
 *         name: category_id
 *         schema: { type: integer }
 *         description: 资产类别ID
 *       - in: query
 *         name: location
 *         schema: { type: string }
 *         description: 存放位置
 *       - in: query
 *         name: sortField
 *         schema: { type: string, default: created_at }
 *         description: 排序字段
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, default: desc }
 *         description: 排序方向（asc/desc）
 *       - in: query
 *         name: batchSize
 *         schema: { type: integer, default: 5000 }
 *         description: 每批次查询数量
 *     responses:
 *       200:
 *         description: 成功获取全量资产列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                 meta:
 *                   type: object
 */
router.get('/all', authenticate, async (req, res) => {
  try {
    let tenantId = getTenantId(req);
    if (!tenantId && req.user.role === 'super_admin') {
      tenantId = req.query.tenant_id
        ? parseInt(req.query.tenant_id, 10)
        : req.headers['x-tenant-id']
          ? parseInt(req.headers['x-tenant-id'], 10)
          : null;
    }
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '租户ID缺失' });
    }

    const {
      search = '',
      status,
      department_id,
      department = '',
      category_id,
      location,
      sortField = 'created_at',
      sortOrder = 'desc',
      batchSize = 5000,
    } = req.query;

    const safeDepartment = String(department || '')
      .trim()
      .substring(0, 100);
    const safeBatchSize = Math.min(Math.max(parseInt(batchSize, 10) || 5000, 1000), 20000);

    // 构建查询条件
    const conditions = ['a.tenant_id = ?', 'a.is_deleted = 0'];
    const params = [tenantId];

    if (status) {
      conditions.push('a.status = ?');
      params.push(status);
    }

    if (department_id) {
      conditions.push('a.department_new = ?');
      params.push(department_id);
    }

    if (safeDepartment) {
      const departmentLike = `%${safeDepartment}%`;
      conditions.push(`(
        a.department LIKE ?
        OR a.department_new LIKE ?
        OR a.department_new IN (
          SELECT department_code
          FROM departments
          WHERE tenant_id = ?
            AND department_name LIKE ?
        )
        OR a.department IN (
          SELECT department_name
          FROM departments
          WHERE tenant_id = ?
            AND department_name LIKE ?
        )
      )`);
      params.push(
        departmentLike,
        departmentLike,
        tenantId,
        departmentLike,
        tenantId,
        departmentLike,
      );
    }

    if (category_id) {
      conditions.push('a.category_id = ?');
      params.push(category_id);
    }

    if (location) {
      conditions.push('a.location LIKE ?');
      params.push(`${location}%`);
    }

    if (search) {
      conditions.push('(a.asset_code LIKE ? OR a.asset_name LIKE ? OR a.brand LIKE ?)');
      params.push(`${search}%`, `%${search}%`, `${search}%`);
    }

    const whereClause = conditions.join(' AND ');
    const safeSortField = [
      'created_at',
      'updated_at',
      'purchase_date',
      'asset_name',
      'purchase_price',
      'current_value',
    ].includes(sortField)
      ? sortField
      : 'created_at';
    const safeSortOrder = ['asc', 'desc'].includes(String(sortOrder).toLowerCase())
      ? sortOrder.toLowerCase()
      : 'desc';
    const orderClause = `a.${safeSortField} ${safeSortOrder.toUpperCase()}`;

    // 先获取总数
    const countSql = `SELECT COUNT(*) as total FROM assets a WHERE ${whereClause}`;
    const [[countResult]] = await db.execute(countSql, params);
    const total = Number.parseInt(countResult?.total, 10) || 0;

    if (total === 0) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        meta: {
          duration: 0,
          batchSize: safeBatchSize,
        },
      });
    }

    // 分批查询所有数据
    const allData = [];
    let offset = 0;

    const listSql = `
      SELECT
        a.*,
        c.name as category_name,
        d.department_name,
        u.username as responsible_person_name,
        se.id as special_equipment_id,
        se.equipment_type,
        se.registration_code
      FROM assets a
      LEFT JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN departments d ON a.department_new = d.department_code AND a.tenant_id = d.tenant_id
      ${ASSET_RESPONSIBLE_USER_JOIN}
      ${ASSET_SPECIAL_EQUIPMENT_JOIN}
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `;

    while (offset < total) {
      const [rows] = await db.execute(listSql, [...params, safeBatchSize, offset]);
      if (rows.length === 0) break;
      allData.push(...rows);
      offset += safeBatchSize;

      // 防止无限循环
      if (rows.length < safeBatchSize) break;
    }

    // 获取位置历史信息
    const assetCodes = Array.from(
      new Set(allData.map(row => row.asset_code).filter(code => Boolean(code))),
    );

    const latestLocationMap = await buildLatestLocationMap(assetCodes, tenantId);

    const listWithLocation = allData.map(row => ({
      ...row,
      latest_location: latestLocationMap.get(row.asset_code) || null,
    }));

    const duration = Date.now() - (req._startTime || Date.now());

    res.json({
      success: true,
      data: listWithLocation,
      total,
      meta: {
        duration,
        batchSize: safeBatchSize,
        fetchedCount: allData.length,
      },
    });
  } catch (error) {
    logger.error('Get all assets failed:', error);
    res.status(500).json({ success: false, message: '获取全量资产列表失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/assets/duplicate-check:
 *   get:
 *     summary: 检查资产编码是否重复
 *     tags: [Assets]
 *     parameters:
 *       - in: query
 *         name: asset_code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 检查结果
 */
router.get('/duplicate-check', authenticate, requireTenantId, async (req, res) => {
  try {
    const { asset_code, exclude_id } = req.query;
    const tenantId = getTenantId(req);

    if (!asset_code) {
      return res.status(400).json({ success: false, message: '资产编码不能为空' });
    }

    let sql = 'SELECT id FROM assets WHERE asset_code = ? AND tenant_id = ?';
    const params = [asset_code, tenantId];

    if (exclude_id) {
      sql += ' AND id != ?';
      params.push(exclude_id);
    }

    const [rows] = await db.execute(sql, params);

    res.json({
      success: true,
      data: {
        exists: rows.length > 0,
        duplicate_id: rows.length > 0 ? rows[0].id : null,
      },
    });
  } catch (error) {
    logger.error('Duplicate check failed:', error);
    res.status(500).json({ success: false, message: '检查失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/assets/departments/list:
 *   get:
 *     summary: 获取部门列表（用于资产筛选）
 *     tags: [Assets]
 */
router.get('/departments/list', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const keyword = String(req.query.keyword || '').trim().substring(0, 100);

    const cacheKey = `dept:list:${tenantId}:${keyword}`;
    const cached = await cacheService.get('dept:list', cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const params = [tenantId];
    let keywordClause = '';
    if (keyword) {
      keywordClause = ' AND (department_code LIKE ? OR department_name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const [departments] = await db.execute(
      `SELECT
         id,
         department_code,
         department_name,
         department_name as name,
         parent_code,
         parent_code as parent_id,
         department_code as code,
         level
       FROM departments
       WHERE tenant_id = ?${keywordClause}
       ORDER BY level, department_name`,
      params,
    );

    const departmentMap = new Map(departments.map(item => [item.department_code, item]));
    const roots = [];

    departments.forEach(item => {
      item.children = [];
    });

    departments.forEach(item => {
      const parent = item.parent_code ? departmentMap.get(item.parent_code) : null;
      if (parent) {
        parent.children.push(item);
      } else {
        roots.push(item);
      }
    });

    const pruneEmptyChildren = items =>
      items.map(item => {
        if (item.children.length === 0) {
          const { children, ...rest } = item;
          return rest;
        }
        return {
          ...item,
          children: pruneEmptyChildren(item.children),
        };
      });

    const result = {
      success: true,
      data: keyword ? departments : pruneEmptyChildren(roots),
    };

    await cacheService.set('dept:list', cacheKey, result, { ttl: 3600 });

    res.json(result);
  } catch (error) {
    logger.error('Get departments list failed:', error);
    res.status(500).json({ success: false, message: '获取部门列表失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/assets/{id}:
 *   get:
 *     summary: 获取资产详情
 *     tags: [Assets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 成功获取资产详情
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    let tenantId = getTenantId(req);
    if (!tenantId && req.user.role === 'super_admin') {
      tenantId = req.query.tenant_id
        ? parseInt(req.query.tenant_id, 10)
        : req.headers['x-tenant-id']
          ? parseInt(req.headers['x-tenant-id'], 10)
          : null;
    }

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '租户ID缺失' });
    }

    // 尝试从缓存获取
    const cacheKey = `asset:${tenantId}:${id}`;
    const cached = await cacheService.get('asset:detail', cacheKey);
    if (cached && !req.query.noCache) {
      logger.debug(`Asset ${id} served from cache`);
      return res.json(cached);
    }

    // 判断ID类型：数字ID或资产编号
    // 数字ID通常是较小的整数（< 100万），而asset_code虽然可能全数字但数值很大
    const isNumeric = /^\d+$/.test(id);
    const numericValue = isNumeric ? parseInt(id) : 0;
    // 如果数字小于100万认为是ID，否则认为是asset_code
    const isId = isNumeric && numericValue < 1000000 && numericValue > 0;

    // 查询资产详情
    let query;
    let queryParams;

    if (isId) {
      // 数字ID查询
      query = `SELECT
        a.*,
        c.name as category_name,
        c.parent_id as category_parent_id,
        d.department_name,
        d.parent_code as department_parent_code,
        u.username as responsible_person_name,
        u.email as responsible_person_email,
        u.phone as responsible_person_phone,
        se.id as special_equipment_id,
        se.equipment_type,
        se.registration_code
       FROM assets a
       LEFT JOIN asset_categories c ON a.category_id = c.id
       LEFT JOIN departments d ON a.department_new = d.department_code AND a.tenant_id = d.tenant_id
       ${ASSET_RESPONSIBLE_USER_JOIN}
       ${ASSET_SPECIAL_EQUIPMENT_JOIN}
       WHERE a.id = ? AND a.tenant_id = ?`;
      queryParams = [numericValue, tenantId];
    } else {
      // 资产编号查询（支持字符串asset_code）
      query = `SELECT
        a.*,
        c.name as category_name,
        c.parent_id as category_parent_id,
        d.department_name,
        d.parent_code as department_parent_code,
        u.username as responsible_person_name,
        u.email as responsible_person_email,
        u.phone as responsible_person_phone,
        se.id as special_equipment_id,
        se.equipment_type,
        se.registration_code
       FROM assets a
       LEFT JOIN asset_categories c ON a.category_id = c.id
       LEFT JOIN departments d ON a.department_new = d.department_code AND a.tenant_id = d.tenant_id
       ${ASSET_RESPONSIBLE_USER_JOIN}
       ${ASSET_SPECIAL_EQUIPMENT_JOIN}
       WHERE a.asset_code = ? AND a.tenant_id = ?`;
      queryParams = [id, tenantId];
    }

    const [assets] = await db.execute(query, queryParams);

    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const asset = assets[0];

    // 并行获取关联数据，补查链路必须继续受 tenant_id 约束
    const assetCode = asset.asset_code;
    const [[maintenanceCount], [qualityCount], [locationHistory], [documents]] = await Promise.all([
      db.execute(
        `SELECT COUNT(*) as count, MAX(created_at) as last_date
         FROM maintenance_logs
         WHERE asset_code = ? AND tenant_id = ?`,
        [assetCode, tenantId],
      ),
      db.execute(
        `SELECT COUNT(*) as count, MAX(qc_date) as last_date
         FROM quality_control_records
         WHERE asset_code = ? AND tenant_id = ?`,
        [assetCode, tenantId],
      ),
      db.execute(
        `SELECT address as location, latitude, longitude, record_time as recorded_at, update_source as recorded_by_name
         FROM asset_location_history
         WHERE asset_code = ? AND tenant_id = ?
         ORDER BY record_time DESC
         LIMIT 10`,
        [assetCode, tenantId],
      ),
      db.execute(
        `SELECT id, file_name, file_type, file_size, upload_date as uploaded_at, description
         FROM technical_documents
          WHERE asset_type = ? AND status = 'active' AND tenant_id = ?
          ORDER BY upload_date DESC`,
        [asset.asset_type || asset.asset_name, tenantId],
      ),
    ]);

    const result = {
      success: true,
      data: {
        ...asset,
        maintenance_stats: maintenanceCount[0],
        quality_stats: qualityCount[0],
        location_history: locationHistory,
        documents,
      },
    };

    // 缓存结果（10分钟）
    await cacheService.set('asset:detail', cacheKey, result, { ttl: 600 });

    res.json(result);
  } catch (error) {
    logger.error('Get asset detail failed:', error);
    res.status(500).json({ success: false, message: '获取资产详情失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/assets/{id}/change-logs:
 *   get:
 *     summary: 获取资产变更日志
 *     tags: [Assets]
 */
router.get('/:id/change-logs', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    // 判断ID类型：数字ID或资产编号
    // 数字ID通常是较小的整数（< 100万），而asset_code虽然可能全数字但很长
    const isNumeric = /^\d+$/.test(id);
    const numericValue = isNumeric ? parseInt(id) : 0;
    const isId = isNumeric && numericValue < 1000000 && numericValue > 0;
    let asset;

    if (isId) {
      const [assetRows] = await db.execute(
        'SELECT * FROM assets WHERE id = ? AND tenant_id = ? AND is_deleted = 0',
        [numericValue, tenantId],
      );
      if (assetRows.length === 0) {
        return res.status(404).json({ success: false, message: '资产不存在' });
      }
      asset = assetRows[0];
    } else {
      const [assetRows] = await db.execute(
        'SELECT * FROM assets WHERE asset_code = ? AND tenant_id = ?',
        [id, tenantId],
      );
      if (assetRows.length === 0) {
        return res.status(404).json({ success: false, message: '资产不存在' });
      }
      asset = assetRows[0];
    }

    // 权限检查：非系统管理员只能查看自己管理科室的资产变更日志
    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'system_admin';
    if (!isAdmin) {
      if (!req.user.managed_departments || req.user.managed_departments.length === 0) {
        return res.status(403).json({ success: false, message: '用户未分配管理科室' });
      }

      const assetDepartment = asset.department_new || asset.department;

      let [deptRows] = await db.execute(
        'SELECT department_code FROM departments WHERE department_code = ? AND tenant_id = ?',
        [assetDepartment, tenantId],
      );

      if (deptRows.length === 0) {
        [deptRows] = await db.execute(
          'SELECT department_code FROM departments WHERE department_name = ? AND tenant_id = ?',
          [assetDepartment, tenantId],
        );
      }

      if (deptRows.length > 0) {
        const assetDepartmentCode = deptRows[0].department_code;
        if (!req.user.managed_departments.includes(assetDepartmentCode)) {
          return res
            .status(403)
            .json({ success: false, message: '只能查看自己管理科室的资产变更日志' });
        }
      } else {
        return res.status(403).json({ success: false, message: '资产科室信息无效' });
      }
    }

    const [rows] = await db.execute(
      'SELECT * FROM asset_change_logs WHERE asset_code = ? AND tenant_id = ? ORDER BY changed_at DESC',
      [asset.asset_code, tenantId],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Get change logs failed:', error);
    res.status(500).json({ success: false, message: '获取修改日志失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/assets/{id}/transitions:
 *   get:
 *     summary: 获取资产可执行的状态迁移
 *     tags: [Assets]
 */
router.get('/:id/transitions', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    // 判断ID类型：数字ID或资产编号
    // 数字ID通常是较小的整数（< 100万），而asset_code虽然可能全数字但很长
    const isNumeric = /^\d+$/.test(id);
    const numericValue = isNumeric ? parseInt(id) : 0;
    const isId = isNumeric && numericValue < 1000000 && numericValue > 0;
    let query;
    let params;

    if (isId) {
      query =
        'SELECT id, asset_code, status, tenant_id FROM assets WHERE id = ? AND tenant_id = ? AND is_deleted = 0';
      params = [numericValue, tenantId];
    } else {
      query =
        'SELECT id, asset_code, status, tenant_id FROM assets WHERE asset_code = ? AND tenant_id = ?';
      params = [id, tenantId];
    }

    const [assets] = await db.execute(query, params);
    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const asset = assets[0];
    const workflowId = await workflowService.getDefaultWorkflowId(tenantId);
    if (!workflowId) {
      return res.json({ success: true, data: [] });
    }

    const transitions = await workflowService.getAllowedTransitions(asset.status, workflowId);
    res.json({ success: true, data: transitions });
  } catch (error) {
    logger.error('Get transitions failed:', error);
    res
      .status(500)
      .json({ success: false, message: '获取资产可执行迁移失败', error: error.message });
  }
});

module.exports = router;
