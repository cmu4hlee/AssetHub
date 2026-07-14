/**
 * @swagger
 * /api/inventory-plans:
 *   get:
 *     summary: 获取盘点计划列表
 *     description: 分页获取所有盘点计划
 *     tags: [盘点计划]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, completed, cancelled]
 *         description: 计划状态
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
 *                       plan_no:
 *                         type: string
 *                       plan_name:
 *                         type: string
 *                       start_date:
 *                         type: string
 *                         format: date
 *                       end_date:
 *                         type: string
 *                         format: date
 *                       status:
 *                         type: string
 *                       remark:
 *                         type: string
 *                       created_by:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       500:
 *         description: 服务器错误
 *   post:
 *     summary: 创建盘点计划
 *     description: 创建新的盘点计划
 *     tags: [盘点计划]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plan_no
 *               - plan_name
 *             properties:
 *               plan_no:
 *                 type: string
 *                 description: 计划编号
 *               plan_name:
 *                 type: string
 *                 description: 计划名称
 *               start_date:
 *                 type: string
 *                 format: date
 *                 description: 开始日期
 *               end_date:
 *                 type: string
 *                 format: date
 *                 description: 结束日期
 *               status:
 *                 type: string
 *                 enum: [draft, active, completed, cancelled]
 *                 default: draft
 *                 description: 计划状态
 *               remark:
 *                 type: string
 *                 description: 备注
 *     responses:
 *       201:
 *         description: 创建成功
 *       400:
 *         description: 参数错误
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-plans/{id}:
 *   get:
 *     summary: 获取盘点计划详情
 *     tags: [盘点计划]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点计划ID
 *     responses:
 *       200:
 *         description: 成功
 *       404:
 *         description: 盘点计划不存在
 *       500:
 *         description: 服务器错误
 *   put:
 *     summary: 更新盘点计划
 *     tags: [盘点计划]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点计划ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plan_no
 *               - plan_name
 *             properties:
 *               plan_no:
 *                 type: string
 *               plan_name:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [draft, active, completed, cancelled]
 *               remark:
 *                 type: string
 *     responses:
 *       200:
 *         description: 更新成功
 *       400:
 *         description: 参数错误
 *       404:
 *         description: 盘点计划不存在
 *       500:
 *         description: 服务器错误
 *   delete:
 *     summary: 删除盘点计划
 *     tags: [盘点计划]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点计划ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       404:
 *         description: 盘点计划不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-plans/{id}/activate:
 *   put:
 *     summary: 激活盘点计划
 *     description: 将盘点计划状态改为激活
 *     tags: [盘点计划]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点计划ID
 *     responses:
 *       200:
 *         description: 激活成功
 *       400:
 *         description: 已经是激活状态
 *       404:
 *         description: 盘点计划不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-plans/{id}/complete:
 *   put:
 *     summary: 完成盘点计划
 *     description: 将盘点计划状态改为已完成
 *     tags: [盘点计划]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点计划ID
 *     responses:
 *       200:
 *         description: 完成成功
 *       400:
 *         description: 只有激活状态的计划才能完成
 *       404:
 *         description: 盘点计划不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-plans/{id}/cancel:
 *   put:
 *     summary: 取消盘点计划
 *     description: 将盘点计划状态改为已取消
 *     tags: [盘点计划]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点计划ID
 *     responses:
 *       200:
 *         description: 取消成功
 *       400:
 *         description: 已完成或已取消的计划不能再取消
 *       404:
 *         description: 盘点计划不存在
 *       500:
 *         description: 服务器错误
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');
const { cacheManager } = require('../services/cache-manager');
const logger = require('../config/logger');

const logInventoryPlanError = (message, error, context = {}) => {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    ...context,
  });
};

// 获取所有盘点计划
router.get('/', authenticate, authorize('view_all_inventory'), async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'ip');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (status) {
      whereClause += ' AND ip.status = ?';
      params.push(status);
    }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM inventory_plans ip ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const [rows] = await db.execute(
      `SELECT ip.* FROM inventory_plans ip
       ${whereClause}
       ORDER BY ip.created_at DESC
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
    logInventoryPlanError('获取盘点计划失败', error, {
      tenantId: req.user?.tenant_id,
      page: req.query?.page,
      pageSize: req.query?.pageSize,
      status: req.query?.status,
    });
    res.status(500).json({ success: false, message: '获取盘点计划失败', error: error.message });
  }
});

// 获取单个盘点计划详情
router.get('/:id', authenticate, authorize('view_all_inventory'), async (req, res) => {
  try {
    const { id } = req.params;

    // 添加租户过滤验证
    const tenantFilter = addTenantFilter(req, 'ip');
    const [plan] = await db.execute(
      `SELECT ip.* FROM inventory_plans ip WHERE ip.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (plan.length === 0) {
      return res.status(404).json({ success: false, message: '盘点计划不存在' });
    }

    res.json({
      success: true,
      data: plan[0],
    });
  } catch (error) {
    logInventoryPlanError('获取盘点计划详情失败', error, {
      tenantId: req.user?.tenant_id,
      planId: req.params?.id,
    });
    res.status(500).json({ success: false, message: '获取盘点计划详情失败', error: error.message });
  }
});

// 创建盘点计划
router.post('/', authenticate, authorize('edit_all_inventory'), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
      plan_no,
      plan_name,
      start_date,
      end_date,
      status = 'draft',
      remark,
    } = req.body;

    // 验证必填字段
    if (!plan_no) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '计划编号不能为空' });
    }

    if (!plan_name) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '计划名称不能为空' });
    }

    // 检查计划编号是否已存在（在同一租户内）
    const tenantFilter = addTenantFilter(req, 'ip');
    const [existing] = await connection.execute(
      `SELECT id FROM inventory_plans ip WHERE ip.plan_no = ? ${tenantFilter.whereClause}`,
      [plan_no, ...tenantFilter.params],
    );

    if (existing.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '计划编号已存在' });
    }

    // 获取租户ID
    const tenantId = getTenantId(req);

    const [result] = await connection.execute(
      `INSERT INTO inventory_plans (tenant_id, plan_no, plan_name, start_date, end_date, status, remark, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, plan_no, plan_name, start_date, end_date, status, remark || null, req.user.username],
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '盘点计划创建成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryPlanError('创建盘点计划失败', error, {
      tenantId: req.user?.tenant_id,
      planNo: req.body?.plan_no,
      planName: req.body?.plan_name,
    });
    res.status(500).json({ success: false, message: '创建盘点计划失败', error: error.message });
  }
});

// 更新盘点计划
router.put('/:id', authenticate, authorize('edit_all_inventory'), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      plan_no,
      plan_name,
      start_date,
      end_date,
      status,
      remark,
    } = req.body;

    // 验证必填字段
    if (!plan_no) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '计划编号不能为空' });
    }

    if (!plan_name) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '计划名称不能为空' });
    }

    // 检查盘点计划是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ip');
    const [existing] = await connection.execute(
      `SELECT id FROM inventory_plans ip WHERE ip.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点计划不存在' });
    }

    // 检查计划编号是否已被其他记录使用（在同一租户内）
    const [sameNo] = await connection.execute(
      `SELECT id FROM inventory_plans ip WHERE ip.plan_no = ? AND ip.id != ? ${tenantFilter.whereClause}`,
      [plan_no, id, ...tenantFilter.params],
    );

    if (sameNo.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '计划编号已被其他记录使用' });
    }

    await connection.execute(
      `UPDATE inventory_plans ip SET
       ip.plan_no = ?,
       ip.plan_name = ?,
       ip.start_date = ?,
       ip.end_date = ?,
       ip.status = ?,
       ip.remark = ?,
       ip.updated_at = NOW()
       WHERE ip.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [plan_no, plan_name, start_date, end_date, status, remark, id, ...tenantFilter.params],
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '盘点计划更新成功',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryPlanError('更新盘点计划失败', error, {
      tenantId: req.user?.tenant_id,
      planId: req.params?.id,
      planNo: req.body?.plan_no,
      planName: req.body?.plan_name,
    });
    res.status(500).json({ success: false, message: '更新盘点计划失败', error: error.message });
  }
});

// 删除盘点计划
router.delete('/:id', authenticate, authorize('edit_all_inventory'), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // 检查盘点计划是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ip');
    const [existing] = await connection.execute(
      `SELECT id FROM inventory_plans ip WHERE ip.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点计划不存在' });
    }

    const [result] = await connection.execute(
      `DELETE ip FROM inventory_plans ip WHERE ip.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点计划不存在' });
    }

    await connection.commit();
    connection.release();

    res.json({ success: true, message: '盘点计划删除成功' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryPlanError('删除盘点计划失败', error, {
      tenantId: req.user?.tenant_id,
      planId: req.params?.id,
    });
    res.status(500).json({ success: false, message: '删除盘点计划失败', error: error.message });
  }
});

// 激活盘点计划
router.put('/:id/activate', authenticate, authorize('edit_all_inventory'), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // 检查盘点计划是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ip');
    const [existing] = await connection.execute(
      `SELECT id, status FROM inventory_plans ip WHERE ip.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点计划不存在' });
    }

    if (existing[0].status === 'active') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '盘点计划已经是激活状态' });
    }

    await connection.execute(
      `UPDATE inventory_plans ip SET
       ip.status = 'active',
       ip.updated_at = NOW()
       WHERE ip.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [id, ...tenantFilter.params],
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '盘点计划已激活',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryPlanError('激活盘点计划失败', error, {
      tenantId: req.user?.tenant_id,
      planId: req.params?.id,
    });
    res.status(500).json({ success: false, message: '激活盘点计划失败', error: error.message });
  }
});

// 完成盘点计划
router.put('/:id/complete', authenticate, authorize('edit_all_inventory'), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // 检查盘点计划是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ip');
    const [existing] = await connection.execute(
      `SELECT id, status FROM inventory_plans ip WHERE ip.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点计划不存在' });
    }

    if (existing[0].status !== 'active') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '只有激活状态的计划才能完成' });
    }

    await connection.execute(
      `UPDATE inventory_plans ip SET
       ip.status = 'completed',
       ip.updated_at = NOW()
       WHERE ip.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [id, ...tenantFilter.params],
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '盘点计划已完成',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryPlanError('完成盘点计划失败', error, {
      tenantId: req.user?.tenant_id,
      planId: req.params?.id,
    });
    res.status(500).json({ success: false, message: '完成盘点计划失败', error: error.message });
  }
});

// 取消盘点计划
router.put('/:id/cancel', authenticate, authorize('edit_all_inventory'), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // 检查盘点计划是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ip');
    const [existing] = await connection.execute(
      `SELECT id, status FROM inventory_plans ip WHERE ip.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点计划不存在' });
    }

    if (existing[0].status === 'completed' || existing[0].status === 'cancelled') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '已完成或已取消的计划不能再取消' });
    }

    await connection.execute(
      `UPDATE inventory_plans ip SET
       ip.status = 'cancelled',
       ip.updated_at = NOW()
       WHERE ip.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [id, ...tenantFilter.params],
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '盘点计划已取消',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryPlanError('取消盘点计划失败', error, {
      tenantId: req.user?.tenant_id,
      planId: req.params?.id,
    });
    res.status(500).json({ success: false, message: '取消盘点计划失败', error: error.message });
  }
});

module.exports = router;
