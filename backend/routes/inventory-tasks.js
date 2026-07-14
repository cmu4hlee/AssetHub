/**
 * @swagger
 * /api/inventory-tasks:
 *   get:
 *     summary: 获取盘点任务列表
 *     description: 分页获取盘点任务
 *     tags: [盘点任务]
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
 *         name: assignee
 *         schema:
 *           type: string
 *         description: 负责人用户名
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [待分配, 已分配, 进行中, 已完成, 已取消]
 *         description: 任务状态
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 *   post:
 *     summary: 创建盘点任务
 *     description: 创建新的盘点任务
 *     tags: [盘点任务]
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
 *               - task_name
 *               - assignee
 *               - assignee_name
 *             properties:
 *               inventory_id:
 *                 type: integer
 *                 description: 盘点记录ID
 *               task_name:
 *                 type: string
 *                 description: 任务名称
 *               assignee:
 *                 type: string
 *                 description: 负责人用户名
 *               assignee_name:
 *                 type: string
 *                 description: 负责人姓名
 *               department_code:
 *                 type: string
 *                 description: 部门代码
 *               location:
 *                 type: string
 *                 description: 盘点位置
 *               estimated_count:
 *                 type: integer
 *                 description: 预估盘点数量
 *     responses:
 *       201:
 *         description: 创建成功
 *       400:
 *         description: 参数错误
 *       404:
 *         description: 盘点记录不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-tasks/{id}:
 *   get:
 *     summary: 获取盘点任务详情
 *     tags: [盘点任务]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点任务ID
 *     responses:
 *       200:
 *         description: 成功
 *       404:
 *         description: 盘点任务不存在
 *       500:
 *         description: 服务器错误
 *   put:
 *     summary: 更新盘点任务
 *     tags: [盘点任务]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点任务ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               task_name:
 *                 type: string
 *               assignee:
 *                 type: string
 *               assignee_name:
 *                 type: string
 *               department_code:
 *                 type: string
 *               location:
 *                 type: string
 *               estimated_count:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 盘点任务不存在
 *       500:
 *         description: 服务器错误
 *   delete:
 *     summary: 删除盘点任务
 *     tags: [盘点任务]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点任务ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       404:
 *         description: 盘点任务不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-tasks/{id}/assign:
 *   put:
 *     summary: 分配盘点任务
 *     description: 将待分配状态的任务分配给负责人
 *     tags: [盘点任务]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点任务ID
 *     responses:
 *       200:
 *         description: 分配成功
 *       400:
 *         description: 只有待分配状态的任务才能分配
 *       404:
 *         description: 盘点任务不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-tasks/{id}/start:
 *   put:
 *     summary: 开始盘点任务
 *     description: 任务负责人开始执行盘点任务
 *     tags: [盘点任务]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点任务ID
 *     responses:
 *       200:
 *         description: 开始成功
 *       403:
 *         description: 只有任务负责人才能开始任务
 *       400:
 *         description: 只有已分配状态的任务才能开始
 *       404:
 *         description: 盘点任务不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-tasks/{id}/complete:
 *   put:
 *     summary: 完成盘点任务
 *     description: 任务负责人完成盘点任务
 *     tags: [盘点任务]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点任务ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               actual_count:
 *                 type: integer
 *                 description: 实际盘点数量
 *     responses:
 *       200:
 *         description: 完成成功
 *       403:
 *         description: 只有任务负责人才能完成任务
 *       400:
 *         description: 只有进行中状态的任务才能完成
 *       404:
 *         description: 盘点任务不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-tasks/{id}/cancel:
 *   put:
 *     summary: 取消盘点任务
 *     tags: [盘点任务]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 盘点任务ID
 *     responses:
 *       200:
 *         description: 取消成功
 *       400:
 *         description: 已完成或已取消的任务不能再取消
 *       404:
 *         description: 盘点任务不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/inventory-tasks/my/tasks:
 *   get:
 *     summary: 获取我的任务
 *     description: 获取当前用户负责的盘点任务
 *     tags: [盘点任务]
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
 *           enum: [待分配, 已分配, 进行中, 已完成, 已取消]
 *         description: 任务状态
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, authorize } = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');
const { publishAsync } = require('../core/EventBus');

function logInventoryTaskError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: getTenantId(req) || null,
    ...context,
  });
}

// 获取所有盘点任务
router.get('/', authenticate, authorize('view_all_inventory'), async (req, res) => {
  try {
    const { page = 1, pageSize = 20, inventory_id, assignee, status } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'it');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (inventory_id) {
      whereClause += ' AND it.inventory_id = ?';
      params.push(inventory_id);
    }

    if (assignee) {
      whereClause += ' AND it.assignee = ?';
      params.push(assignee);
    }

    if (status) {
      whereClause += ' AND it.status = ?';
      params.push(status);
    }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM inventory_tasks it ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const [rows] = await db.execute(
      `SELECT it.*, ir.inventory_no, ir.inventory_type
       FROM inventory_tasks it
       LEFT JOIN inventory_records ir ON it.inventory_id = ir.id
       ${whereClause}
       ORDER BY it.created_at DESC
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
    logInventoryTaskError('获取盘点任务失败', error, req, {
      page: Number(req.query?.page) || 1,
      pageSize: Number(req.query?.pageSize) || 20,
      inventoryId: req.query?.inventory_id || null,
      assignee: req.query?.assignee || null,
      status: req.query?.status || null,
    });
    res.status(500).json({ success: false, message: '获取盘点任务失败', error: error.message });
  }
});

// 获取单个盘点任务详情
router.get('/:id', authenticate, authorize('view_all_inventory'), async (req, res) => {
  try {
    const { id } = req.params;

    // 添加租户过滤验证
    const tenantFilter = addTenantFilter(req, 'it');
    const [task] = await db.execute(
      `SELECT it.*, ir.inventory_no, ir.inventory_type
       FROM inventory_tasks it
       LEFT JOIN inventory_records ir ON it.inventory_id = ir.id
       WHERE it.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (task.length === 0) {
      return res.status(404).json({ success: false, message: '盘点任务不存在' });
    }

    res.json({
      success: true,
      data: task[0],
    });
  } catch (error) {
    logInventoryTaskError('获取盘点任务详情失败', error, req, {
      taskId: req.params.id,
    });
    res.status(500).json({ success: false, message: '获取盘点任务详情失败', error: error.message });
  }
});

// 创建盘点任务
router.post('/', authenticate, authorize('edit_all_inventory'), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
      inventory_id,
      task_name,
      assignee,
      assignee_name,
      department_code,
      location,
      estimated_count,
    } = req.body;

    // 验证必填字段
    if (!inventory_id) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '盘点ID不能为空' });
    }

    if (!task_name) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '任务名称不能为空' });
    }

    if (!assignee) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '负责人不能为空' });
    }

    if (!assignee_name) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '负责人姓名不能为空' });
    }

    // 检查盘点记录是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ir');
    const [inventory] = await connection.execute(
      `SELECT id FROM inventory_records ir WHERE ir.id = ? ${tenantFilter.whereClause}`,
      [inventory_id, ...tenantFilter.params],
    );

    if (inventory.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    // 获取租户ID
    const tenantId = getTenantId(req);

    const [result] = await connection.execute(
      `INSERT INTO inventory_tasks (
        tenant_id, inventory_id, task_name, assignee, assignee_name, 
        department_code, location, estimated_count, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '待分配', ?)`,
      [
        tenantId, inventory_id, task_name, assignee, assignee_name,
        department_code, location, estimated_count || 0, req.user.username,
      ],
    );

    await connection.commit();
    connection.release();

    // 补发盘点任务创建事件（飞书通知订阅）
    try {
      const [userRows] = await db.execute(
        'SELECT id FROM users WHERE username = ? LIMIT 1',
        [assignee],
      );
      const assigneeId = userRows[0]?.id;
      publishAsync('inventory_task:created', {
        id: result.insertId,
        task_name,
        assignee,
        assignee_name,
        inventory_id,
        toUserIds: assigneeId ? [assigneeId] : [],
        tenantId,
      }).catch(() => {});
    } catch (_) {}

    res.json({
      success: true,
      message: '盘点任务创建成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryTaskError('创建盘点任务失败', error, req, {
      inventoryId: req.body?.inventory_id || null,
      taskName: req.body?.task_name || null,
      assignee: req.body?.assignee || null,
    });
    res.status(500).json({ success: false, message: '创建盘点任务失败', error: error.message });
  }
});

// 分配盘点任务
router.put('/:id/assign', authenticate, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // 检查任务是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'it');
    const [existing] = await connection.execute(
      `SELECT id, status FROM inventory_tasks it WHERE it.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点任务不存在' });
    }

    if (existing[0].status !== '待分配') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '只有待分配状态的任务才能分配' });
    }

    await connection.execute(
      `UPDATE inventory_tasks it SET
       it.status = '已分配',
       it.start_time = NOW(),
       it.updated_at = NOW()
       WHERE it.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [id, ...tenantFilter.params],
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '盘点任务已分配',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryTaskError('分配盘点任务失败', error, req, {
      taskId: req.params.id,
    });
    res.status(500).json({ success: false, message: '分配盘点任务失败', error: error.message });
  }
});

// 开始盘点任务
router.put('/:id/start', authenticate, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // 检查任务是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'it');
    const [existing] = await connection.execute(
      `SELECT id, status, assignee FROM inventory_tasks it WHERE it.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点任务不存在' });
    }

    // 检查是否是任务负责人
    if (existing[0].assignee !== req.user.username) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({ success: false, message: '只有任务负责人才能开始任务' });
    }

    if (existing[0].status !== '已分配') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '只有已分配状态的任务才能开始' });
    }

    await connection.execute(
      `UPDATE inventory_tasks it SET
       it.status = '进行中',
       it.updated_at = NOW()
       WHERE it.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [id, ...tenantFilter.params],
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '盘点任务已开始',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryTaskError('开始盘点任务失败', error, req, {
      taskId: req.params.id,
    });
    res.status(500).json({ success: false, message: '开始盘点任务失败', error: error.message });
  }
});

// 完成盘点任务
router.put('/:id/complete', authenticate, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { actual_count } = req.body;

    // 检查任务是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'it');
    const [existing] = await connection.execute(
      `SELECT id, status, assignee FROM inventory_tasks it WHERE it.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点任务不存在' });
    }

    // 检查是否是任务负责人
    if (existing[0].assignee !== req.user.username) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({ success: false, message: '只有任务负责人才能完成任务' });
    }

    if (existing[0].status !== '进行中') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '只有进行中状态的任务才能完成' });
    }

    await connection.execute(
      `UPDATE inventory_tasks it SET
       it.status = '已完成',
       it.actual_count = ?,
       it.end_time = NOW(),
       it.updated_at = NOW()
       WHERE it.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [actual_count || 0, id, ...tenantFilter.params],
    );

    await connection.commit();
    connection.release();

    // 补发盘点任务完成事件
    try {
      const [userRows] = await db.execute(
        'SELECT id FROM users WHERE username = ? LIMIT 1',
        [existing[0].assignee],
      );
      publishAsync('inventory_task:completed', {
        id: Number(id),
        task_name: existing[0].task_name || '',
        assignee: existing[0].assignee,
        actual_count,
        toUserIds: userRows[0]?.id ? [userRows[0].id] : [],
        tenantId: getTenantId(req),
      }).catch(() => {});
    } catch (_) {}

    res.json({
      success: true,
      message: '盘点任务已完成',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryTaskError('完成盘点任务失败', error, req, {
      taskId: req.params.id,
      actualCount: req.body?.actual_count ?? null,
    });
    res.status(500).json({ success: false, message: '完成盘点任务失败', error: error.message });
  }
});

// 取消盘点任务
router.put('/:id/cancel', authenticate, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // 检查任务是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'it');
    const [existing] = await connection.execute(
      `SELECT id, status, assignee, task_name FROM inventory_tasks it WHERE it.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点任务不存在' });
    }

    if (existing[0].status === '已完成' || existing[0].status === '已取消') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '已完成或已取消的任务不能再取消' });
    }

    await connection.execute(
      `UPDATE inventory_tasks it SET
       it.status = '已取消',
       it.updated_at = NOW()
       WHERE it.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [id, ...tenantFilter.params],
    );

    await connection.commit();
    connection.release();

    // 补发盘点任务取消事件
    try {
      const [userRows] = await db.execute(
        'SELECT id FROM users WHERE username = ? LIMIT 1',
        [existing[0].assignee],
      );
      publishAsync('inventory_task:cancelled', {
        id: Number(id),
        task_name: existing[0].task_name || '',
        assignee: existing[0].assignee,
        toUserIds: userRows[0]?.id ? [userRows[0].id] : [],
        tenantId: getTenantId(req),
      }).catch(() => {});
    } catch (_) {}

    res.json({
      success: true,
      message: '盘点任务已取消',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryTaskError('取消盘点任务失败', error, req, {
      taskId: req.params.id,
    });
    res.status(500).json({ success: false, message: '取消盘点任务失败', error: error.message });
  }
});

// 更新盘点任务
router.put('/:id', authenticate, authorize('edit_all_inventory'), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      task_name,
      assignee,
      assignee_name,
      department_code,
      location,
      estimated_count,
    } = req.body;

    // 检查任务是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'it');
    const [existing] = await connection.execute(
      `SELECT id FROM inventory_tasks it WHERE it.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点任务不存在' });
    }

    await connection.execute(
      `UPDATE inventory_tasks it SET
       it.task_name = ?,
       it.assignee = ?,
       it.assignee_name = ?,
       it.department_code = ?,
       it.location = ?,
       it.estimated_count = ?,
       it.updated_at = NOW()
       WHERE it.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [
        task_name, assignee, assignee_name, department_code, location,
        estimated_count || 0, id, ...tenantFilter.params,
      ],
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '盘点任务更新成功',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryTaskError('更新盘点任务失败', error, req, {
      taskId: req.params.id,
      taskName: req.body?.task_name || null,
      assignee: req.body?.assignee || null,
    });
    res.status(500).json({ success: false, message: '更新盘点任务失败', error: error.message });
  }
});

// 删除盘点任务
router.delete('/:id', authenticate, authorize('edit_all_inventory'), async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // 检查任务是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'it');
    const [existing] = await connection.execute(
      `SELECT id FROM inventory_tasks it WHERE it.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点任务不存在' });
    }

    const [result] = await connection.execute(
      `DELETE it FROM inventory_tasks it WHERE it.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '盘点任务不存在' });
    }

    await connection.commit();
    connection.release();

    res.json({ success: true, message: '盘点任务删除成功' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    logInventoryTaskError('删除盘点任务失败', error, req, {
      taskId: req.params.id,
    });
    res.status(500).json({ success: false, message: '删除盘点任务失败', error: error.message });
  }
});

// 获取我的任务
router.get('/my/tasks', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE it.assignee = ?';
    const params = [req.user.username];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'it');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (status) {
      whereClause += ' AND it.status = ?';
      params.push(status);
    }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM inventory_tasks it ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const [rows] = await db.execute(
      `SELECT it.*, ir.inventory_no, ir.inventory_type
       FROM inventory_tasks it
       LEFT JOIN inventory_records ir ON it.inventory_id = ir.id
       ${whereClause}
       ORDER BY it.created_at DESC
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
    logInventoryTaskError('获取我的任务失败', error, req, {
      page: Number(req.query?.page) || 1,
      pageSize: Number(req.query?.pageSize) || 20,
      status: req.query?.status || null,
    });
    res.status(500).json({ success: false, message: '获取我的任务失败', error: error.message });
  }
});

module.exports = router;
