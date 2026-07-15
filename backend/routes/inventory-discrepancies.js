/**
 * @swagger
 * /api/inventory-discrepancies:
 *   get:
 *     summary: 获取盘点差异列表
 *     description: 分页获取盘点差异记录
 *     tags: [盘点差异]
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
 *         name: inventory_id
 *         schema:
 *           type: integer
 *         description: 盘点记录ID
 *       - in: query
 *         name: asset_code
 *         schema:
 *           type: string
 *         description: 资产编号
 *       - in: query
 *         name: handling_status
 *         schema:
 *           type: string
 *           enum: [待处理, 已处理, 已忽略]
 *         description: 处理状态
 *     responses:
 *       200:
 *         description: 成功
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
 *                     properties:
 *                       id:
 *                         type: integer
 *                       inventory_id:
 *                         type: integer
 *                       asset_code:
 *                         type: string
 *                       discrepancy_type:
 *                         type: string
 *                       discrepancy_desc:
 *                         type: string
 *                       handling_status:
 *                         type: string
 *                       handling_method:
 *                         type: string
 *                       inventory_no:
 *                         type: string
 *                       asset_name:
 *                         type: string
 *                       brand:
 *                         type: string
 *                       model:
 *                         type: string
 *                 pagination:
 *                   type: object
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-discrepancies/{id}:
 *   get:
 *     summary: 获取盘点差异详情
 *     tags: [盘点差异]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点差异ID
 *     responses:
 *       200:
 *         description: 成功
 *       404:
 *         description: 盘点差异不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-discrepancies/{id}/handle:
 *   put:
 *     summary: 处理盘点差异
 *     description: 处理单个盘点差异记录
 *     tags: [盘点差异]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点差异ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - handling_status
 *               - handling_method
 *             properties:
 *               handling_status:
 *                 type: string
 *                 enum: [待处理, 已处理, 已忽略]
 *                 description: 处理状态
 *               handling_method:
 *                 type: string
 *                 description: 处理方式
 *               handling_notes:
 *                 type: string
 *                 description: 处理备注
 *     responses:
 *       200:
 *         description: 处理成功
 *       400:
 *         description: 该差异已经处理过
 *       404:
 *         description: 盘点差异不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-discrepancies/batch-handle:
 *   post:
 *     summary: 批量处理盘点差异
 *     tags: [盘点差异]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *               - handling_status
 *               - handling_method
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: 盘点差异ID列表
 *               handling_status:
 *                 type: string
 *                 enum: [待处理, 已处理, 已忽略]
 *               handling_method:
 *                 type: string
 *               handling_notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: 处理成功
 *       400:
 *         description: 参数错误
 *       404:
 *         description: 部分盘点差异不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-discrepancies/{inventory_id}/statistics:
 *   get:
 *     summary: 获取盘点差异统计
 *     tags: [盘点差异]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inventory_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点记录ID
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     statusStats:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                     typeStats:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-discrepancies/generate-from-details:
 *   post:
 *     summary: 自动生成盘点差异记录
 *     description: 根据盘点明细自动生成差异记录
 *     tags: [盘点差异]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inventory_id
 *             properties:
 *               inventory_id:
 *                 type: integer
 *                 description: 盘点记录ID
 *     responses:
 *       200:
 *         description: 生成成功
 *       400:
 *         description: 盘点ID不能为空
 *       404:
 *         description: 盘点记录不存在
 *       500:
 *         description: 服务器错误
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, authorize } = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');

const INVENTORY_DISCREPANCY_RECORD_JOIN =
  'LEFT JOIN inventory_records ir ON id.inventory_id = ir.id AND ir.tenant_id = id.tenant_id';
const INVENTORY_DISCREPANCY_ASSET_JOIN =
  'LEFT JOIN assets a ON id.asset_code COLLATE utf8mb4_unicode_ci = a.asset_code COLLATE utf8mb4_unicode_ci AND a.tenant_id = id.tenant_id AND a.is_deleted = 0';

const logInventoryDiscrepancyError = (message, error, context = {}) => {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    ...context,
  });
};

// 获取所有盘点差异
router.get('/', authenticate, authorize('view_all_inventory'), async (req, res) => {
  try {
    const { page = 1, pageSize = 20, inventory_id, asset_code, handling_status } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'id');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (inventory_id) {
      whereClause += ' AND id.inventory_id = ?';
      params.push(inventory_id);
    }

    if (asset_code) {
      whereClause += ' AND id.asset_code = ?';
      params.push(asset_code);
    }

    if (handling_status) {
      whereClause += ' AND id.handling_status = ?';
      params.push(handling_status);
    }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM inventory_discrepancies id ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const [rows] = await db.execute(
      `SELECT id.*, ir.inventory_no, a.asset_name, a.brand, a.model
       FROM inventory_discrepancies id
       ${INVENTORY_DISCREPANCY_RECORD_JOIN}
       ${INVENTORY_DISCREPANCY_ASSET_JOIN}
       ${whereClause}
       ORDER BY id.created_at DESC
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
    logInventoryDiscrepancyError('获取盘点差异失败', error, {
      tenantId: getTenantId(req) || null,
      page: Number(req.query?.page) || 1,
      pageSize: Number(req.query?.pageSize) || 20,
      inventoryId: req.query?.inventory_id || null,
      assetCode: req.query?.asset_code || null,
      handlingStatus: req.query?.handling_status || null,
    });
    res.status(500).json({ success: false, message: '获取盘点差异失败', error: error.message });
  }
});

// 获取单个盘点差异详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 添加租户过滤验证
    const tenantFilter = addTenantFilter(req, 'id');
    const [discrepancy] = await db.execute(
      `SELECT id.*, ir.inventory_no, a.asset_name, a.brand, a.model
       FROM inventory_discrepancies id
       ${INVENTORY_DISCREPANCY_RECORD_JOIN}
       ${INVENTORY_DISCREPANCY_ASSET_JOIN}
       WHERE id.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (discrepancy.length === 0) {
      return res.status(404).json({ success: false, message: '盘点差异不存在' });
    }

    res.json({
      success: true,
      data: discrepancy[0],
    });
  } catch (error) {
    logInventoryDiscrepancyError('获取盘点差异详情失败', error, {
      tenantId: getTenantId(req) || null,
      discrepancyId: req.params.id,
    });
    res.status(500).json({ success: false, message: '获取盘点差异详情失败', error: error.message });
  }
});

// 处理盘点差异
router.put('/:id/handle', authenticate, authorize('edit_all_inventory'), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      handling_status,
      handling_method,
      handling_notes,
    } = req.body;

    // 检查差异是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'id');
    const [existing] = await connection.execute(
      `SELECT id, handling_status FROM inventory_discrepancies id WHERE id.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点差异不存在' });
    }

    if (existing[0].handling_status === '已处理' || existing[0].handling_status === '已忽略') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '该差异已经处理过' });
    }

    await connection.execute(
      `UPDATE inventory_discrepancies id SET
       id.handling_status = ?,
       id.handling_method = ?,
       id.handler = ?,
       id.handler_name = ?,
       id.handling_date = NOW(),
       id.handling_notes = ?,
       id.updated_at = NOW()
       WHERE id.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [
        handling_status,
        handling_method,
        req.user.username,
        req.user.real_name || req.user.username,
        handling_notes,
        id,
        ...tenantFilter.params,
      ],
    );

    // 如果处理状态为已处理，更新资产信息
    if (handling_status === '已处理') {
      const [discrepancy] = await connection.execute(
        `SELECT id.asset_code, id.actual_location, id.actual_status
         FROM inventory_discrepancies id
         WHERE id.id = ? ${tenantFilter.whereClause}`,
        [id, ...tenantFilter.params],
      );

      if (discrepancy.length > 0) {
        const { asset_code, actual_location, actual_status } = discrepancy[0];

        // 更新资产的位置和状态
        await connection.execute(
          `UPDATE assets SET
           location = ?,
           status = ?
           WHERE asset_code = ? AND tenant_id = ?`,
          [actual_location, actual_status, asset_code, getTenantId(req)],
        );
      }
    }

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '盘点差异处理成功',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryDiscrepancyError('处理盘点差异失败', error, {
      tenantId: getTenantId(req) || null,
      discrepancyId: req.params.id,
      handlingStatus: req.body?.handling_status || null,
      handlingMethod: req.body?.handling_method || null,
    });
    res.status(500).json({ success: false, message: '处理盘点差异失败', error: error.message });
  }
});

// 批量处理盘点差异
router.post('/batch-handle', authenticate, authorize('edit_all_inventory'), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { ids, handling_status, handling_method, handling_notes } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '请选择要处理的差异' });
    }

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'id');
    const placeholders = ids.map(() => '?').join(',');
    const params = [...ids, ...tenantFilter.params];

    // 检查所有差异是否存在并属于当前租户
    const [existing] = await connection.execute(
      `SELECT id FROM inventory_discrepancies id WHERE id.id IN (${placeholders}) ${tenantFilter.whereClause}`,
      params,
    );

    if (existing.length !== ids.length) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '部分盘点差异不存在' });
    }

    // 批量更新差异状态
    await connection.execute(
      `UPDATE inventory_discrepancies id SET
       id.handling_status = ?,
       id.handling_method = ?,
       id.handler = ?,
       id.handler_name = ?,
       id.handling_date = NOW(),
       id.handling_notes = ?,
       id.updated_at = NOW()
       WHERE id.id IN (${placeholders}) ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [
        handling_status,
        handling_method,
        req.user.username,
        req.user.real_name || req.user.username,
        handling_notes,
        ...ids,
        ...tenantFilter.params,
      ],
    );

    // 如果处理状态为已处理，更新资产信息
    if (handling_status === '已处理') {
      const [discrepancies] = await connection.execute(
        `SELECT id.asset_code, id.actual_location, id.actual_status
         FROM inventory_discrepancies id
         WHERE id.id IN (${placeholders}) ${tenantFilter.whereClause}`,
        [...ids, ...tenantFilter.params],
      );

      for (const discrepancy of discrepancies) {
        const { asset_code, actual_location, actual_status } = discrepancy;

        // 更新资产的位置和状态
        await connection.execute(
          `UPDATE assets SET
           location = ?,
           status = ?
           WHERE asset_code = ? AND tenant_id = ?`,
          [actual_location, actual_status, asset_code, getTenantId(req)],
        );
      }
    }

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: `成功处理 ${ids.length} 条盘点差异`,
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryDiscrepancyError('批量处理盘点差异失败', error, {
      tenantId: getTenantId(req) || null,
      handlingStatus: req.body?.handling_status || null,
      handlingMethod: req.body?.handling_method || null,
      batchSize: Array.isArray(req.body?.ids) ? req.body.ids.length : 0,
    });
    res.status(500).json({ success: false, message: '批量处理盘点差异失败', error: error.message });
  }
});

// 获取盘点差异统计
router.get('/:inventory_id/statistics', authenticate, async (req, res) => {
  try {
    const { inventory_id } = req.params;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'id');
    const whereClause = `WHERE id.inventory_id = ? ${tenantFilter.whereClause}`;
    const params = [inventory_id, ...tenantFilter.params];

    // 获取总差异数
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total FROM inventory_discrepancies id ${whereClause}`,
      params,
    );
    const { total } = totalResult[0];

    // 按处理状态统计
    const [statusStats] = await db.execute(
      `SELECT id.handling_status, COUNT(*) as count
       FROM inventory_discrepancies id
       ${whereClause}
       GROUP BY id.handling_status`,
      params,
    );

    // 按差异类型统计
    const [typeStats] = await db.execute(
      `SELECT id.discrepancy_type, COUNT(*) as count
       FROM inventory_discrepancies id
       ${whereClause}
       GROUP BY id.discrepancy_type`,
      params,
    );

    res.json({
      success: true,
      data: {
        total,
        statusStats: statusStats.reduce((acc, item) => {
          acc[item.handling_status] = item.count;
          return acc;
        }, {}),
        typeStats: typeStats.reduce((acc, item) => {
          acc[item.discrepancy_type] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    logInventoryDiscrepancyError('获取盘点差异统计失败', error, {
      tenantId: getTenantId(req) || null,
      inventoryId: req.params.inventory_id,
    });
    res.status(500).json({ success: false, message: '获取盘点差异统计失败', error: error.message });
  }
});

// 自动生成盘点差异记录
router.post('/generate-from-details', authenticate, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { inventory_id } = req.body;

    if (!inventory_id) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '盘点ID不能为空' });
    }

    // 检查盘点记录是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ir');
    const [inventory] = await connection.execute(
      `SELECT id, tenant_id FROM inventory_records ir WHERE ir.id = ? ${tenantFilter.whereClause}`,
      [inventory_id, ...tenantFilter.params],
    );

    if (inventory.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    const { tenant_id } = inventory[0];

    // 获取盘点明细中的差异
    const detailTenantFilter = addTenantFilter(req, 'id');
    const [details] = await connection.execute(
      `SELECT id.id, id.asset_code, id.expected_location, id.actual_location, id.expected_status, id.actual_status, id.discrepancy_type, id.discrepancy_desc
       FROM inventory_details id
       WHERE id.inventory_id = ? AND id.discrepancy_type != '正常' ${detailTenantFilter.whereClause}`,
      [inventory_id, ...detailTenantFilter.params],
    );

    let createdCount = 0;
    for (const detail of details) {
      // 检查是否已经存在差异记录
      const [existing] = await connection.execute(
        'SELECT id FROM inventory_discrepancies WHERE detail_id = ? AND tenant_id = ?',
        [detail.id, tenant_id],
      );

      if (existing.length === 0) {
        // 创建差异记录
        await connection.execute(
          `INSERT INTO inventory_discrepancies (
            tenant_id, inventory_id, detail_id, asset_code, discrepancy_type, description,
            expected_location, actual_location, expected_status, actual_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tenant_id,
            inventory_id,
            detail.id,
            detail.asset_code,
            detail.discrepancy_type,
            detail.discrepancy_desc || `${detail.discrepancy_type}`,
            detail.expected_location,
            detail.actual_location,
            detail.expected_status,
            detail.actual_status,
          ],
        );
        createdCount++;
      }
    }

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: `成功生成 ${createdCount} 条盘点差异记录`,
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryDiscrepancyError('生成盘点差异记录失败', error, {
      tenantId: getTenantId(req) || null,
      inventoryId: req.body?.inventory_id || null,
    });
    res.status(500).json({ success: false, message: '生成盘点差异记录失败', error: error.message });
  }
});

module.exports = router;
