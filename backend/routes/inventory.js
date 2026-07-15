const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, authorize } = require('../middleware/auth');

// 盘点模块权限集合
const INV_GET_ROLES = ['inventory.view', 'asset.view_all', 'asset.view_own_department'];
const INV_WRITE_ROLES = ['inventory.create', 'inventory.edit', 'asset.edit_all', 'asset.edit_own_department'];
const INV_DELETE_ROLES = ['inventory.delete', 'asset.delete_all', 'asset.delete_own_department'];
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');

let inventoryColumnsCache = null;
async function getInventoryColumns(connection) {
  if (inventoryColumnsCache) return inventoryColumnsCache;
  const [rows] = await connection.execute(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    ['inventory_records'],
  );
  inventoryColumnsCache = rows.map(row => row.COLUMN_NAME);
  return inventoryColumnsCache;
}

function logInventoryError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: getTenantId(req) || null,
    ...context,
  });
}

const INVENTORY_DETAIL_ASSET_JOIN =
  'LEFT JOIN assets a ON id.asset_code = a.asset_code AND a.tenant_id = id.tenant_id AND a.is_deleted = 0';

function buildManagedDepartmentInventoryScope(departmentIdsToFilter) {
  const placeholders = departmentIdsToFilter.map(() => '?').join(',');
  return {
    clause: ` AND EXISTS (
      SELECT 1 FROM inventory_details id
      INNER JOIN assets a ON id.asset_code = a.asset_code AND a.tenant_id = ir.tenant_id AND a.is_deleted = 0
      WHERE id.inventory_id = ir.id AND (
        a.department IN (
          SELECT department_name FROM departments WHERE tenant_id = ir.tenant_id AND department_code IN (${placeholders})
        ) OR a.department_new IN (${placeholders})
      )
    )`,
    params: [...departmentIdsToFilter, ...departmentIdsToFilter],
  };
}

// 获取所有盘点记录
router.get('/', authenticate, authorize(INV_GET_ROLES), async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'ir');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (status) {
      whereClause += ' AND ir.status = ?';
      params.push(status);
    }

    // 资产管理员只能查看自己管理科室的盘点记录
    if (
      req.user.role === 'asset_admin' &&
      req.user.managed_departments &&
      req.user.managed_departments.length > 0 &&
      !req.user.managed_departments.includes('*')
    ) {
      const managedDepartmentScope = buildManagedDepartmentInventoryScope(req.user.managed_departments);
      whereClause += managedDepartmentScope.clause;
      params.push(...managedDepartmentScope.params);
    }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM inventory_records ir ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const [rows] = await db.execute(
      `SELECT ir.* FROM inventory_records ir
       ${whereClause}
       ORDER BY ir.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logInventoryError('获取盘点记录失败', error, req, {
      page: Number(req.query?.page) || 1,
      pageSize: Number(req.query?.pageSize) || 20,
      status: req.query?.status || null,
    });
    res.status(500).json({ success: false, message: '获取盘点记录失败', error: error.message });
  }
});

// 盘点统计汇总
router.get('/statistics', authenticate, authorize(INV_GET_ROLES), async (req, res) => {
  try {
    const tenantFilter = addTenantFilter(req, 'ir');
    const whereClause = tenantFilter.whereClause
      ? `WHERE 1=1 ${tenantFilter.whereClause}`
      : '';
    const params = [...tenantFilter.params];

    const [rows] = await db.execute(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN ir.status = '进行中' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN ir.status = '已完成' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN ir.status = '已取消' THEN 1 ELSE 0 END) as cancelled
       FROM inventory_records ir
       ${whereClause}`,
      params,
    );

    res.json({ success: true, data: rows[0] || {} });
  } catch (error) {
    logInventoryError('获取盘点统计失败', error, req);
    res.status(500).json({ success: false, message: '获取盘点统计失败', error: error.message });
  }
});

// 获取自助盘点窗口
router.get('/self/windows', authenticate, authorize(INV_GET_ROLES), async (req, res) => {
  try {
    const tenantFilter = addTenantFilter(req, 'ir');
    const now = new Date();
    const [rows] = await db.execute(
      `SELECT ir.* FROM inventory_records ir
       WHERE ir.self_check_enabled = 1
         AND ir.status = '进行中'
         AND (ir.self_check_start IS NULL OR ir.self_check_start <= ?)
         AND (ir.self_check_end IS NULL OR ir.self_check_end >= ?)
         ${tenantFilter.whereClause}
       ORDER BY ir.self_check_start DESC, ir.id DESC`,
      [now, now, ...tenantFilter.params],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    logInventoryError('获取自助盘点窗口失败', error, req);
    res.status(500).json({ success: false, message: '获取自助盘点窗口失败', error: error.message });
  }
});

// 获取我的盘点资产
router.get('/self/assets', authenticate, authorize(INV_GET_ROLES), async (req, res) => {
  try {
    const { inventory_id } = req.query;
    if (!inventory_id) {
      return res.status(400).json({ success: false, message: '缺少盘点ID' });
    }

    const tenantFilter = addTenantFilter(req, 'ir');
    const [inventories] = await db.execute(
      `SELECT ir.* FROM inventory_records ir WHERE ir.id = ? ${tenantFilter.whereClause}`,
      [inventory_id, ...tenantFilter.params],
    );
    if (inventories.length === 0) {
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    const inventory = inventories[0];
    if (!inventory.self_check_enabled) {
      return res.status(400).json({ success: false, message: '该盘点未启用自助盘点' });
    }

    const now = new Date();
    if (inventory.self_check_start && new Date(inventory.self_check_start) > now) {
      return res.status(400).json({ success: false, message: '自助盘点尚未开始' });
    }
    if (inventory.self_check_end && new Date(inventory.self_check_end) < now) {
      return res.status(400).json({ success: false, message: '自助盘点已结束' });
    }

    const assetTenantFilter = addTenantFilter(req, 'a');
    let whereClause = `WHERE 1=1 ${assetTenantFilter.whereClause}`;
    const params = [...assetTenantFilter.params];

    const userName = req.user?.username;
    const realName = req.user?.real_name;

    if (inventory.self_check_scope === 'all') {
      // no extra filter
    } else if (inventory.self_check_scope === 'department' && req.user?.department_code) {
      whereClause += ` AND (
        a.department IN (
          SELECT department_name FROM departments WHERE tenant_id = ? AND department_code = ?
        ) OR a.department_new = ?
      )`;
      params.push(getTenantId(req), req.user.department_code, req.user.department_code);
    } else {
      whereClause += ' AND (a.responsible_person = ? OR a.responsible_person = ?)';
      params.push(realName || userName, userName);
    }

    const [rows] = await db.execute(
      `SELECT a.*, id.actual_location, id.actual_status, id.discrepancy_type, id.discrepancy_desc,
              id.checked_by, id.checked_by_name, id.checked_at, id.check_method
       FROM assets a
       LEFT JOIN inventory_details id
         ON id.inventory_id = ? AND id.asset_code = a.asset_code
       ${whereClause}
       ORDER BY a.asset_code ASC`,
      [inventory_id, ...params],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    logInventoryError('获取我的盘点资产失败', error, req, {
      inventoryId: req.query?.inventory_id || null,
    });
    res.status(500).json({ success: false, message: '获取我的盘点资产失败', error: error.message });
  }
});

// 自助盘点确认
router.post('/self/confirm', authenticate, authorize(INV_WRITE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
      inventory_id,
      asset_code,
      actual_location,
      actual_status,
      discrepancy_type,
      discrepancy_desc,
    } = req.body;

    if (!inventory_id || !asset_code) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '缺少盘点ID或资产编码' });
    }

    const tenantFilter = addTenantFilter(req, 'ir');
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const [inventories] = await connection.execute(
      `SELECT ir.* FROM inventory_records ir WHERE ir.id = ? ${tenantFilter.whereClause}`,
      [inventory_id, ...tenantFilter.params],
    );
    if (inventories.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    const inventory = inventories[0];
    if (!inventory.self_check_enabled) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '该盘点未启用自助盘点' });
    }

    const now = new Date();
    if (inventory.self_check_start && new Date(inventory.self_check_start) > now) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '自助盘点尚未开始' });
    }
    if (inventory.self_check_end && new Date(inventory.self_check_end) < now) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '自助盘点已结束' });
    }

    const assetTenantFilter = addTenantFilter(req, 'a');
    const [assets] = await connection.execute(
      `SELECT a.asset_code, a.location, a.status FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
      [asset_code, ...assetTenantFilter.params],
    );
    if (assets.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const asset = assets[0];
    const expectedLocation = asset.location || null;
    const expectedStatus = asset.status || null;
    const actualLocationValue = actual_location ?? expectedLocation;
    const actualStatusValue = actual_status ?? expectedStatus;

    let resolvedDiscrepancy = discrepancy_type;
    if (!resolvedDiscrepancy) {
      if (actualLocationValue !== expectedLocation) {
        resolvedDiscrepancy = '位置不符';
      } else if (actualStatusValue !== expectedStatus) {
        resolvedDiscrepancy = '状态不符';
      } else {
        resolvedDiscrepancy = '正常';
      }
    }

    const [existing] = await connection.execute(
      'SELECT id FROM inventory_details WHERE inventory_id = ? AND asset_code = ? AND tenant_id = ?',
      [inventory_id, asset_code, tenantId],
    );

    const checkedBy = req.user?.username || null;
    const checkedByName = req.user?.real_name || req.user?.username || null;

    if (existing.length > 0) {
      await connection.execute(
        `UPDATE inventory_details SET
          actual_location = ?,
          actual_status = ?,
          discrepancy_type = ?,
          discrepancy_desc = ?,
          checked_by = ?,
          checked_by_name = ?,
          checked_at = NOW(),
          check_method = 'self'
         WHERE id = ?`,
        [
          actualLocationValue,
          actualStatusValue,
          resolvedDiscrepancy,
          discrepancy_desc || null,
          checkedBy,
          checkedByName,
          existing[0].id,
        ],
      );
    } else {
      await connection.execute(
        `INSERT INTO inventory_details (
          inventory_id, asset_code, expected_location, actual_location,
          expected_status, actual_status, discrepancy_type, discrepancy_desc,
          checked_by, checked_by_name, checked_at, check_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'self')`,
        [
          inventory_id,
          asset_code,
          expectedLocation,
          actualLocationValue,
          expectedStatus,
          actualStatusValue,
          resolvedDiscrepancy,
          discrepancy_desc || null,
          checkedBy,
          checkedByName,
        ],
      );
    }

    await connection.commit();
    res.json({ success: true, message: '盘点已提交' });
  } catch (error) {
    await connection.rollback();
    logInventoryError('自助盘点失败', error, req, {
      inventoryId: req.body?.inventory_id || null,
      assetCode: req.body?.asset_code || null,
    });
    res.status(500).json({ success: false, message: '自助盘点失败', error: error.message });
  } finally {
    connection.release();
  }
});

// 获取单个盘点记录详情（包含明细）
router.get('/:id', authenticate, authorize(INV_GET_ROLES), async (req, res) => {
  try {
    const { id } = req.params;

    // 添加租户过滤验证
    const tenantFilter = addTenantFilter(req, 'ir');
    let whereClause = `WHERE ir.id = ? ${tenantFilter.whereClause}`;
    const params = [id, ...tenantFilter.params];

    // 资产管理员只能查看自己管理科室的盘点记录
    if (
      req.user.role === 'asset_admin' &&
      req.user.managed_departments &&
      req.user.managed_departments.length > 0 &&
      !req.user.managed_departments.includes('*')
    ) {
      const managedDepartmentScope = buildManagedDepartmentInventoryScope(req.user.managed_departments);
      whereClause += managedDepartmentScope.clause;
      params.push(...managedDepartmentScope.params);
    }

    const [record] = await db.execute(
      `SELECT ir.* FROM inventory_records ir ${whereClause}`,
      params,
    );

    if (record.length === 0) {
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    // 查询明细时，通过盘点记录关联确保租户隔离
    const [details] = await db.execute(
      `SELECT id.*, a.asset_code, a.asset_name, a.brand, a.model
       FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       ${INVENTORY_DETAIL_ASSET_JOIN}
       WHERE id.inventory_id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    res.json({
      success: true,
      data: {
        ...record[0],
        details,
      },
    });
  } catch (error) {
    logInventoryError('获取盘点详情失败', error, req, {
      inventoryId: req.params.id,
    });
    res.status(500).json({ success: false, message: '获取盘点详情失败', error: error.message });
  }
});

// 创建盘点记录
router.post('/', authenticate, authorize(INV_WRITE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
      inventory_no,
      inventory_date,
      inventory_type,
      inventory_person,
      remark,
      self_check_enabled,
      self_check_start,
      self_check_end,
      self_check_scope,
    } = req.body;

    // 验证必填字段
    if (!inventory_no) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '盘点单号不能为空' });
    }

    if (!inventory_date) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '盘点日期不能为空' });
    }

    if (!inventory_type) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '盘点类型不能为空' });
    }

    if (!inventory_person) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '盘点人不能为空' });
    }

    // 验证盘点类型是否有效
    const validTypes = ['全面盘点', '抽查盘点', '专项盘点'];
    if (!validTypes.includes(inventory_type)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: `盘点类型无效，必须是以下之一：${validTypes.join('、')}`,
      });
    }

    // 检查盘点单号是否已存在（在同一租户内）
    const tenantFilter = addTenantFilter(req, 'ir');
    const [existing] = await connection.execute(
      `SELECT id FROM inventory_records ir WHERE ir.inventory_no = ? ${tenantFilter.whereClause}`,
      [inventory_no, ...tenantFilter.params],
    );

    if (existing.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '盘点单号已存在' });
    }

    // 获取租户ID
    const tenantId = getTenantId(req);

    const columns = await getInventoryColumns(connection);
    const extraColumns = [];
    const extraValues = [];
    if (columns.includes('self_check_enabled')) {
      extraColumns.push('self_check_enabled');
      extraValues.push(self_check_enabled ? 1 : 0);
    }
    if (columns.includes('self_check_start')) {
      extraColumns.push('self_check_start');
      extraValues.push(self_check_start || null);
    }
    if (columns.includes('self_check_end')) {
      extraColumns.push('self_check_end');
      extraValues.push(self_check_end || null);
    }
    if (columns.includes('self_check_scope')) {
      extraColumns.push('self_check_scope');
      extraValues.push(self_check_scope || 'mine');
    }

    const baseColumns = [
      'tenant_id',
      'inventory_no',
      'inventory_date',
      'inventory_type',
      'inventory_person',
      'remark',
    ];
    const insertColumns = baseColumns.concat(extraColumns);
    const placeholders = insertColumns.map(() => '?').join(', ');

    const [result] = await connection.execute(
      `INSERT INTO inventory_records (${insertColumns.join(', ')}) VALUES (${placeholders})`,
      [
        tenantId,
        inventory_no,
        inventory_date,
        inventory_type,
        inventory_person,
        remark || null,
        ...extraValues,
      ],
    );

    await connection.commit();
    connection.release();
    res.json({
      success: true,
      message: '盘点记录创建成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryError('创建盘点记录失败', error, req, {
      inventoryNo: req.body?.inventory_no || null,
      inventoryDate: req.body?.inventory_date || null,
      inventoryType: req.body?.inventory_type || null,
      sqlState: error?.sqlState || undefined,
      sqlMessage: error?.sqlMessage || undefined,
    });
    res.status(500).json({
      success: false,
      message: '创建盘点记录失败',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && {
        details: {
          code: error.code,
          sqlState: error.sqlState,
          sqlMessage: error.sqlMessage,
        },
      }),
    });
  }
});

// 更新盘点记录
router.put('/:id', authenticate, authorize(INV_WRITE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      inventory_no,
      inventory_date,
      inventory_type,
      inventory_person,
      remark,
      self_check_enabled,
      self_check_start,
      self_check_end,
      self_check_scope,
    } = req.body;

    // 验证必填字段
    if (!inventory_no) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '盘点单号不能为空' });
    }

    if (!inventory_date) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '盘点日期不能为空' });
    }

    if (!inventory_type) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '盘点类型不能为空' });
    }

    if (!inventory_person) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '盘点人不能为空' });
    }

    // 验证盘点类型是否有效
    const validTypes = ['全面盘点', '抽查盘点', '专项盘点'];
    if (!validTypes.includes(inventory_type)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: `盘点类型无效，必须是以下之一：${validTypes.join('、')}`,
      });
    }

    // 检查盘点记录是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ir');
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    let whereClause = `WHERE ir.id = ? ${tenantFilter.whereClause}`;
    const params = [id, ...tenantFilter.params];

    // 资产管理员只能更新自己管理科室的盘点记录
    if (
      req.user.role === 'asset_admin' &&
      req.user.managed_departments &&
      req.user.managed_departments.length > 0 &&
      !req.user.managed_departments.includes('*')
    ) {
      const managedDepartmentScope = buildManagedDepartmentInventoryScope(req.user.managed_departments);
      whereClause += managedDepartmentScope.clause;
      params.push(...managedDepartmentScope.params);
    }

    const [existing] = await connection.execute(
      `SELECT id FROM inventory_records ir ${whereClause}`,
      params,
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    // 检查盘点单号是否已被其他记录使用（在同一租户内）
    const [sameNo] = await connection.execute(
      `SELECT id FROM inventory_records ir WHERE ir.inventory_no = ? AND ir.id != ? ${tenantFilter.whereClause}`,
      [inventory_no, id, ...tenantFilter.params],
    );

    if (sameNo.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '盘点单号已被其他记录使用' });
    }

    const columns = await getInventoryColumns(connection);
    const updateFields = [
      'inventory_no = ?',
      'inventory_date = ?',
      'inventory_type = ?',
      'inventory_person = ?',
      'remark = ?',
    ];
    const updateValues = [
      inventory_no,
      inventory_date,
      inventory_type,
      inventory_person,
      remark,
    ];

    if (columns.includes('self_check_enabled') && self_check_enabled !== undefined) {
      updateFields.push('self_check_enabled = ?');
      updateValues.push(self_check_enabled ? 1 : 0);
    }
    if (columns.includes('self_check_start') && self_check_start !== undefined) {
      updateFields.push('self_check_start = ?');
      updateValues.push(self_check_start || null);
    }
    if (columns.includes('self_check_end') && self_check_end !== undefined) {
      updateFields.push('self_check_end = ?');
      updateValues.push(self_check_end || null);
    }
    if (columns.includes('self_check_scope') && self_check_scope !== undefined) {
      updateFields.push('self_check_scope = ?');
      updateValues.push(self_check_scope || 'mine');
    }

    updateValues.push(id, tenantId);
    await connection.execute(
      `UPDATE inventory_records SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      updateValues,
    );

    await connection.commit();
    connection.release();
    res.json({
      success: true,
      message: '盘点记录更新成功',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryError('更新盘点记录失败', error, req, {
      inventoryId: req.params.id,
      inventoryNo: req.body?.inventory_no || null,
    });
    res.status(500).json({ success: false, message: '更新盘点记录失败', error: error.message });
  }
});

// 添加盘点明细
router.post('/:id/details', authenticate, authorize(INV_WRITE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      asset_code,
      expected_location,
      actual_location,
      expected_status,
      actual_status,
      discrepancy_type,
      discrepancy_desc,
    } = req.body;

    // 检查盘点记录是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ir');
    const [inventory] = await connection.execute(
      `SELECT id FROM inventory_records ir WHERE ir.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (inventory.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    // 检查资产是否存在（需要验证资产属于同一租户）
    if (asset_code) {
      const assetTenantFilter = addTenantFilter(req, 'a');
      const [assets] = await connection.execute(
        `SELECT asset_code FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
        [asset_code, ...assetTenantFilter.params],
      );
      if (assets.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: '资产不存在' });
      }
    }

    const [result] = await connection.execute(
      `INSERT INTO inventory_details (
        inventory_id, asset_code, expected_location, actual_location,
        expected_status, actual_status, discrepancy_type, discrepancy_desc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        asset_code,
        expected_location,
        actual_location,
        expected_status,
        actual_status,
        discrepancy_type,
        discrepancy_desc,
      ],
    );

    await connection.commit();
    connection.release();
    res.json({
      success: true,
      message: '盘点明细添加成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryError('添加盘点明细失败', error, req, {
      inventoryId: req.params.id,
      assetCode: req.body?.asset_code || null,
    });
    res.status(500).json({ success: false, message: '添加盘点明细失败', error: error.message });
  }
});

// 更新盘点状态
router.put('/:id/status', authenticate, authorize(INV_WRITE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { status } = req.body;
    const tenantId = getTenantId(req);

    // 检查盘点记录是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ir');
    let whereClause = `WHERE ir.id = ? ${tenantFilter.whereClause}`;
    const params = [id, ...tenantFilter.params];

    // 资产管理员只能更新自己管理科室的盘点记录
    if (
      req.user.role === 'asset_admin' &&
      req.user.managed_departments &&
      req.user.managed_departments.length > 0 &&
      !req.user.managed_departments.includes('*')
    ) {
      const managedDepartmentScope = buildManagedDepartmentInventoryScope(req.user.managed_departments);
      whereClause += managedDepartmentScope.clause;
      params.push(...managedDepartmentScope.params);
    }

    const [inventory] = await connection.execute(
      `SELECT ir.* FROM inventory_records ir ${whereClause}`,
      params,
    );

    if (inventory.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    const currentStatus = inventory[0].status;
    const validTransitions = {
      pending: ['in_progress', 'completed', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
      // 数据库存储的中文状态值
      '进行中': ['已完成', '已取消'],
      '已完成': [],
      '已取消': [],
    };
    if (!validTransitions[currentStatus]?.includes(status)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: `不允许的状态转换: 从 ${currentStatus} 到 ${status}`,
      });
    }

    // 如果状态变为 completed，需要检查所有盘点明细中的资产状态
    if (status === 'completed') {
      // 获取所有盘点明细中的资产编号
      const [details] = await connection.execute(
        'SELECT DISTINCT asset_code FROM inventory_details WHERE inventory_id = ? AND tenant_id = ?',
        [id, tenantId],
      );

      // 检查每个资产的状态，确保没有资产正在调配或维修中
      for (const detail of details) {
        if (detail.asset_code) {
          const [assets] = await connection.execute(
            'SELECT * FROM assets WHERE asset_code = ? AND tenant_id = ? FOR UPDATE',
            [detail.asset_code, tenantId],
          );

          if (assets.length > 0) {
            const assetStatus = assets[0].status;
            // 如果资产正在调配或维修中，不允许完成盘点
            if (assetStatus === '调配中' || assetStatus === '维修中' || assetStatus === '维修') {
              await connection.rollback();
              connection.release();
              return res.status(400).json({
                success: false,
                message: `资产 ${assets[0].asset_code || '未知编号'} (${assets[0].asset_name || '未知名称'}) 当前状态为"${assetStatus}"，正在调配或维修中，无法完成盘点`,
              });
            }
          }
        }
      }
    }

    const [result] = await connection.execute(
      `UPDATE inventory_records ir SET ir.status = ? WHERE ir.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [status, id, ...tenantFilter.params],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    await connection.commit();
    connection.release();
    res.json({ success: true, message: '盘点状态更新成功' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryError('更新盘点状态失败', error, req, {
      inventoryId: req.params.id,
      status: req.body?.status || null,
    });
    res.status(500).json({ success: false, message: '更新盘点状态失败', error: error.message });
  }
});

// 删除盘点记录
router.delete('/:id', authenticate, authorize(INV_DELETE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // 检查盘点记录是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ir');
    let whereClause = `WHERE ir.id = ? ${tenantFilter.whereClause}`;
    const params = [id, ...tenantFilter.params];

    // 资产管理员只能删除自己管理科室的盘点记录
    if (
      req.user.role === 'asset_admin' &&
      req.user.managed_departments &&
      req.user.managed_departments.length > 0 &&
      !req.user.managed_departments.includes('*')
    ) {
      const managedDepartmentScope = buildManagedDepartmentInventoryScope(req.user.managed_departments);
      whereClause += managedDepartmentScope.clause;
      params.push(...managedDepartmentScope.params);
    }

    const [inventory] = await connection.execute(
      `SELECT id FROM inventory_records ir ${whereClause}`,
      params,
    );
    if (inventory.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    // 先删除关联的明细（通过盘点记录关联确保租户隔离）
    await connection.execute(
      `DELETE id FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       WHERE id.inventory_id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    const [result] = await connection.execute(
      `DELETE ir FROM inventory_records ir WHERE ir.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    await connection.commit();
    connection.release();
    res.json({ success: true, message: '盘点记录删除成功' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryError('删除盘点记录失败', error, req, {
      inventoryId: req.params.id,
    });
    res.status(500).json({ success: false, message: '删除盘点记录失败', error: error.message });
  }
});

// 更新盘点明细
router.put('/:id/details/:detailId', authenticate, authorize(INV_WRITE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id, detailId } = req.params;
    const {
      expected_location,
      actual_location,
      expected_status,
      actual_status,
      discrepancy_type,
      discrepancy_desc,
    } = req.body;

    // 检查明细是否属于该盘点记录并验证租户
    const tenantFilter = addTenantFilter(req, 'ir');
    const [existing] = await connection.execute(
      `SELECT id.id FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       WHERE id.id = ? AND id.inventory_id = ? ${tenantFilter.whereClause}`,
      [detailId, id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点明细不存在' });
    }

    const [result] = await connection.execute(
      `UPDATE inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       SET id.expected_location = ?, id.actual_location = ?,
           id.expected_status = ?, id.actual_status = ?,
           id.discrepancy_type = ?, id.discrepancy_desc = ?
       WHERE id.id = ? AND id.inventory_id = ? ${tenantFilter.whereClause}`,
      [
        expected_location,
        actual_location,
        expected_status,
        actual_status,
        discrepancy_type,
        discrepancy_desc,
        detailId,
        id,
        ...tenantFilter.params,
      ],
    );

    await connection.commit();
    connection.release();
    res.json({
      success: true,
      message: '盘点明细更新成功',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryError('更新盘点明细失败', error, req, {
      inventoryId: req.params.id,
      detailId: req.params.detailId,
    });
    res.status(500).json({ success: false, message: '更新盘点明细失败', error: error.message });
  }
});

// 删除盘点明细
router.delete('/:id/details/:detailId', authenticate, authorize(INV_WRITE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id, detailId } = req.params;

    // 检查明细是否属于该盘点记录并验证租户
    const tenantFilter = addTenantFilter(req, 'ir');
    const [existing] = await connection.execute(
      `SELECT id.id FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       WHERE id.id = ? AND id.inventory_id = ? ${tenantFilter.whereClause}`,
      [detailId, id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点明细不存在' });
    }

    const [result] = await connection.execute(
      `DELETE id FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       WHERE id.id = ? AND id.inventory_id = ? ${tenantFilter.whereClause}`,
      [detailId, id, ...tenantFilter.params],
    );

    await connection.commit();
    connection.release();
    res.json({ success: true, message: '盘点明细删除成功' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryError('删除盘点明细失败', error, req, {
      inventoryId: req.params.id,
      detailId: req.params.detailId,
    });
    res.status(500).json({ success: false, message: '删除盘点明细失败', error: error.message });
  }
});

// 批量添加盘点明细
router.post('/:id/details/batch', authenticate, authorize(INV_WRITE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { details } = req.body; // details 是一个数组

    if (!Array.isArray(details) || details.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '明细数据不能为空' });
    }

    // 检查盘点记录是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ir');
    const [inventory] = await connection.execute(
      `SELECT id FROM inventory_records ir WHERE ir.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (inventory.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    // 检查所有资产是否存在（需要验证资产属于同一租户）
    const assetCodes = details.map(d => d.asset_code).filter(code => code);
    if (assetCodes.length > 0) {
      const placeholders = assetCodes.map(() => '?').join(',');
      const assetTenantFilter = addTenantFilter(req, 'a');
      const [assets] = await connection.execute(
        `SELECT a.asset_code FROM assets a WHERE a.asset_code IN (${placeholders}) ${assetTenantFilter.whereClause}`,
        [...assetCodes, ...assetTenantFilter.params],
      );
      const existingAssetCodes = assets.map(a => a.asset_code);
      const missingAssetCodes = assetCodes.filter(code => !existingAssetCodes.includes(code));
      if (missingAssetCodes.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: `以下资产不存在: ${missingAssetCodes.join(', ')}`,
        });
      }
    }

    const insertPromises = details.map(detail => {
      const {
        asset_code,
        expected_location,
        actual_location,
        expected_status,
        actual_status,
        discrepancy_type,
        discrepancy_desc,
      } = detail;

      return connection.execute(
        `INSERT INTO inventory_details (
          inventory_id, asset_code, expected_location, actual_location,
          expected_status, actual_status, discrepancy_type, discrepancy_desc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          asset_code,
          expected_location,
          actual_location,
          expected_status,
          actual_status,
          discrepancy_type,
          discrepancy_desc,
        ],
      );
    });

    await Promise.all(insertPromises);
    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: `成功添加 ${details.length} 条盘点明细`,
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryError('批量添加盘点明细失败', error, req, {
      inventoryId: req.params.id,
      batchSize: Array.isArray(req.body?.details) ? req.body.details.length : 0,
    });
    res.status(500).json({ success: false, message: '批量添加盘点明细失败', error: error.message });
  }
});

// 获取盘点统计信息
router.get('/:id/statistics', authenticate, authorize(INV_GET_ROLES), async (req, res) => {
  try {
    const { id } = req.params;

    // 验证盘点记录是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ir');
    const [inventory] = await db.execute(
      `SELECT id FROM inventory_records ir WHERE ir.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (inventory.length === 0) {
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    // 获取总数量（通过盘点记录关联确保租户隔离）
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total
       FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       WHERE id.inventory_id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    const { total } = totalResult[0];

    // 按差异类型统计
    const [typeStats] = await db.execute(
      `SELECT id.discrepancy_type, COUNT(*) as count
       FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       WHERE id.inventory_id = ? ${tenantFilter.whereClause}
       GROUP BY id.discrepancy_type`,
      [id, ...tenantFilter.params],
    );

    // 统计正常和异常数量
    const [normalResult] = await db.execute(
      `SELECT COUNT(*) as count
       FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       WHERE id.inventory_id = ? AND id.discrepancy_type = ? ${tenantFilter.whereClause}`,
      [id, '正常', ...tenantFilter.params],
    );
    const normalCount = normalResult[0].count;
    const abnormalCount = total - normalCount;

    res.json({
      success: true,
      data: {
        total,
        normalCount,
        abnormalCount,
        typeStats: typeStats.reduce((acc, item) => {
          acc[item.discrepancy_type] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    logInventoryError('获取盘点统计失败', error, req, {
      inventoryId: req.params.id,
    });
    res.status(500).json({ success: false, message: '获取盘点统计失败', error: error.message });
  }
});

// 扫描资产（移动端扫码盘点）
router.post('/:id/scan', authenticate, authorize(INV_WRITE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { asset_code, scan_time, scan_type = 'qr_code', location, status, photo } = req.body;
    const tenantId = getTenantId(req);

    if (!asset_code) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '资产编号不能为空' });
    }

    // 验证盘点记录存在且属于当前租户
    const [inventoryCheck] = await connection.execute(
      'SELECT * FROM inventory_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (inventoryCheck.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    const inventory = inventoryCheck[0];
    if (inventory.status !== '进行中') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '该盘点记录不是进行中状态' });
    }

    // 查找盘点明细中的资产
    const [details] = await connection.execute(
      `SELECT id.*, a.asset_name, a.department as expected_department,
              a.department_new as actual_department, a.status as asset_status
       FROM inventory_details id
       LEFT JOIN assets a ON id.asset_code = a.asset_code AND a.tenant_id = ? AND a.is_deleted = 0
       WHERE id.inventory_id = ? AND id.asset_code = ?`,
      [tenantId, id, asset_code],
    );

    if (details.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: '该资产不在当前盘点清单中',
        asset_code,
      });
    }

    const detail = details[0];

    // 如果已经盘点过，检查是否需要更新
    if (detail.actual_status) {
      await connection.rollback();
      connection.release();
      return res.json({
        success: true,
        message: '资产已盘点过',
        data: {
          ...detail,
          is_repeated: true,
          previous_scan_time: detail.scan_time,
        },
      });
    }

    // 计算差异类型
    let discrepancy_type = '正常';
    let discrepancy_desc = '';

    if (detail.expected_location !== location) {
      discrepancy_type = '位置异常';
      discrepancy_desc = `期望位置: ${detail.expected_location}, 实际位置: ${location}`;
    }

    if (detail.expected_status !== status && status) {
      discrepancy_type = discrepancy_type === '正常' ? '状态异常' : '位置状态异常';
      discrepancy_desc = discrepancy_desc
        ? `${discrepancy_desc}; 期望状态: ${detail.expected_status}, 实际状态: ${status}`
        : `期望状态: ${detail.expected_status}, 实际状态: ${status}`;
    }

    // 更新盘点明细
    await connection.execute(
      `UPDATE inventory_details SET
        actual_location = ?,
        actual_status = ?,
        discrepancy_type = ?,
        discrepancy_desc = ?,
        scan_time = ?,
        scan_type = ?,
        scan_by = ?,
        photo_url = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        location || detail.expected_location,
        status || detail.asset_status,
        discrepancy_type,
        discrepancy_desc || null,
        scan_time || new Date(),
        scan_type,
        req.user.username,
        photo || null,
        detail.id,
      ],
    );

    // 记录扫描历史（包含 tenant_id）
    await connection.execute(
      `INSERT INTO inventory_scan_logs
       (tenant_id, inventory_id, asset_code, scan_time, scan_type, scan_by, location, status, result)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, id, asset_code, scan_time || new Date(), scan_type, req.user.username, location, status, discrepancy_type],
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '盘点扫描成功',
      data: {
        ...detail,
        actual_location: location || detail.expected_location,
        actual_status: status || detail.asset_status,
        discrepancy_type,
        discrepancy_desc,
        scan_time: scan_time || new Date(),
      },
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryError('扫描资产失败', error, req, {
      inventoryId: req.params.id,
      assetCode: req.body?.asset_code || null,
      scanType: req.body?.scan_type || null,
    });
    res.status(500).json({ success: false, message: '扫描处理失败', error: error.message });
  }
});

// 获取扫描历史
router.get('/:id/scan-logs', authenticate, authorize(INV_GET_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, pageSize = 50 } = req.query;
    const offset = (page - 1) * pageSize;
    const tenantId = getTenantId(req);

    // 验证盘点记录存在且属于当前租户
    const [inventoryCheck] = await db.execute(
      'SELECT * FROM inventory_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (inventoryCheck.length === 0) {
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    const [logs] = await db.execute(
      `SELECT * FROM inventory_scan_logs
       WHERE inventory_id = ? AND tenant_id = ?
       ORDER BY scan_time DESC
       LIMIT ? OFFSET ?`,
      [id, tenantId, parseInt(pageSize), offset],
    );

    const [countResult] = await db.execute(
      'SELECT COUNT(*) as total FROM inventory_scan_logs WHERE inventory_id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total,
      },
    });
  } catch (error) {
    logInventoryError('获取扫描历史失败', error, req, {
      inventoryId: req.params.id,
      page: Number(req.query?.page) || 1,
      pageSize: Number(req.query?.pageSize) || 50,
    });
    res.status(500).json({ success: false, message: '获取扫描历史失败', error: error.message });
  }
});

// 完成盘点
router.post('/:id/complete', authenticate, authorize(INV_WRITE_ROLES), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const tenantId = getTenantId(req);

    // 验证盘点记录
    const [inventoryCheck] = await connection.execute(
      'SELECT * FROM inventory_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (inventoryCheck.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    const inventory = inventoryCheck[0];
    if (inventory.status !== '进行中') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '该盘点记录不是进行中状态' });
    }

    // 检查是否还有未盘点的资产
    const [pendingCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM inventory_details WHERE inventory_id = ? AND actual_status IS NULL AND tenant_id = ?',
      [id, tenantId],
    );

    if (pendingCount[0].count > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: `还有 ${pendingCount[0].count} 个资产未盘点，是否继续完成？`,
        pending_count: pendingCount[0].count,
        force_complete: true,
      });
    }

    // 更新盘点状态为已完成
    await connection.execute(
      'UPDATE inventory_records SET status = ?, completed_at = NOW(), completed_by = ? WHERE id = ? AND tenant_id = ?',
      ['已完成', req.user.username, id, tenantId],
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '盘点已完成',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryError('完成盘点失败', error, req, {
      inventoryId: req.params.id,
    });
    res.status(500).json({ success: false, message: '完成盘点失败', error: error.message });
  }
});

module.exports = router;
