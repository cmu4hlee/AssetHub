/**
 * @swagger
 * /api/location-alerts:
 *   get:
 *     summary: 获取位置告警列表
 *     description: 分页获取位置告警记录
 *     tags: [位置告警]
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
 *         name: is_handled
 *         schema:
 *           type: boolean
 *         description: 是否已处理
 *       - in: query
 *         name: alert_type
 *         schema:
 *           type: string
 *         description: 告警类型
 *       - in: query
 *         name: alert_level
 *         schema:
 *           type: string
 *         description: 告警级别
 *       - in: query
 *         name: asset_code
 *         schema:
 *           type: string
 *         description: 资产编号
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/location-alerts/stats:
 *   get:
 *     summary: 获取位置告警统计
 *     tags: [位置告警]
 *     security:
 *       - bearerAuth: []
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
 *                     pending:
 *                       type: integer
 *                     by_level:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           alert_level:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     by_type:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           alert_type:
 *                             type: string
 *                           count:
 *                             type: integer
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/location-alerts/{id}/handle:
 *   put:
 *     summary: 处理位置告警
 *     tags: [位置告警]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 告警ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               handle_result:
 *                 type: string
 *                 description: 处理结果
 *               remark:
 *                 type: string
 *                 description: 备注
 *     responses:
 *       200:
 *         description: 成功
 *       404:
 *         description: 告警记录不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/location-alerts/{id}:
 *   delete:
 *     summary: 删除位置告警
 *     tags: [位置告警]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 告警ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       404:
 *         description: 告警记录不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/location-alerts/batch/handle:
 *   post:
 *     summary: 批量处理位置告警
 *     tags: [位置告警]
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
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: 告警ID列表
 *               handle_result:
 *                 type: string
 *                 description: 处理结果
 *     responses:
 *       200:
 *         description: 成功
 *       400:
 *         description: 参数错误
 *       404:
 *         description: 告警记录不存在
 *       500:
 *         description: 服务器错误
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate } = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');
const LOCATION_ALERT_ASSET_JOIN =
  'LEFT JOIN assets a ON la.asset_code = a.asset_code AND a.tenant_id = la.tenant_id';

const logLocationAlertError = (message, error, context = {}) => {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    ...context,
  });
};

router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, is_handled, alert_type, alert_level, asset_code } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    const tenantFilter = addTenantFilter(req, 'la');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (is_handled !== undefined) {
      whereClause += ' AND la.is_handled = ?';
      params.push(is_handled === 'true' || is_handled === '1' ? 1 : 0);
    }

    if (alert_type) {
      whereClause += ' AND la.alert_type = ?';
      params.push(alert_type);
    }

    if (alert_level) {
      whereClause += ' AND la.alert_level = ?';
      params.push(alert_level);
    }

    if (asset_code) {
      whereClause += ' AND la.asset_code = ?';
      params.push(asset_code);
    }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM location_alerts la ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const [rows] = await db.execute(
      `SELECT la.*, a.asset_code, a.asset_name
       FROM location_alerts la
       ${LOCATION_ALERT_ASSET_JOIN}
       ${whereClause}
       ORDER BY la.trigger_time DESC
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
    logLocationAlertError('获取告警列表失败', error, {
      tenantId: getTenantId(req) || null,
      page: Number(req.query?.page) || 1,
      pageSize: Number(req.query?.pageSize) || 20,
      is_handled: req.query?.is_handled ?? null,
      alert_type: req.query?.alert_type ?? null,
      alert_level: req.query?.alert_level ?? null,
      asset_code: req.query?.asset_code ?? null,
    });
    res.status(500).json({ success: false, message: '获取告警列表失败', error: error.message });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    const statsQuery = tenantId
      ? 'SELECT COUNT(*) as total FROM location_alerts WHERE tenant_id = ?'
      : 'SELECT COUNT(*) as total FROM location_alerts';
    const statsParams = tenantId ? [tenantId] : [];

    const [totalResult] = await db.execute(statsQuery, statsParams);

    const pendingQuery = tenantId
      ? 'SELECT COUNT(*) as total FROM location_alerts WHERE tenant_id = ? AND is_handled = 0'
      : 'SELECT COUNT(*) as total FROM location_alerts WHERE is_handled = 0';
    const [pendingResult] = await db.execute(pendingQuery, statsParams);

    const byLevelQuery = tenantId
      ? 'SELECT alert_level, COUNT(*) as count FROM location_alerts WHERE tenant_id = ? AND is_handled = 0 GROUP BY alert_level'
      : 'SELECT alert_level, COUNT(*) as count FROM location_alerts WHERE is_handled = 0 GROUP BY alert_level';
    const [byLevelResult] = await db.execute(byLevelQuery, statsParams);

    const byTypeQuery = tenantId
      ? 'SELECT alert_type, COUNT(*) as count FROM location_alerts WHERE tenant_id = ? AND is_handled = 0 GROUP BY alert_type'
      : 'SELECT alert_type, COUNT(*) as count FROM location_alerts WHERE is_handled = 0 GROUP BY alert_type';
    const [byTypeResult] = await db.execute(byTypeQuery, statsParams);

    res.json({
      success: true,
      data: {
        total: totalResult[0].total,
        pending: pendingResult[0].total,
        by_level: byLevelResult,
        by_type: byTypeResult,
      },
    });
  } catch (error) {
    logLocationAlertError('获取告警统计失败', error, {
      tenantId: getTenantId(req) || null,
    });
    res.status(500).json({ success: false, message: '获取告警统计失败', error: error.message });
  }
});

router.put('/:id/handle', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { handle_result, remark } = req.body;

    const tenantFilter = addTenantFilter(req, 'la');
    const [existing] = await db.execute(
      `SELECT id FROM location_alerts la WHERE la.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '告警记录不存在' });
    }

    const handlePerson = req.user.real_name || req.user.username || '系统管理员';

    await db.execute(
      `UPDATE location_alerts SET
        is_handled = 1,
        handle_time = NOW(),
        handle_person = ?,
        handle_result = ?,
        remark = ?,
        updated_at = NOW()
       WHERE id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [handlePerson, handle_result, remark, id, ...tenantFilter.params],
    );

    res.json({ success: true, message: '告警处理成功' });
  } catch (error) {
    logLocationAlertError('处理告警失败', error, {
      tenantId: getTenantId(req) || null,
      alertId: req.params.id,
    });
    res.status(500).json({ success: false, message: '处理告警失败', error: error.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const tenantFilter = addTenantFilter(req, 'la');
    const [existing] = await db.execute(
      `SELECT id FROM location_alerts la WHERE la.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '告警记录不存在' });
    }

    await db.execute(
      `DELETE la FROM location_alerts la WHERE la.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [id, ...tenantFilter.params],
    );

    res.json({ success: true, message: '告警记录删除成功' });
  } catch (error) {
    logLocationAlertError('删除告警失败', error, {
      tenantId: getTenantId(req) || null,
      alertId: req.params.id,
    });
    res.status(500).json({ success: false, message: '删除告警失败', error: error.message });
  }
});

router.post('/batch/handle', authenticate, async (req, res) => {
  try {
    const { ids, handle_result } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要处理的告警' });
    }

    const handlePerson = req.user.real_name || req.user.username || '系统管理员';
    const placeholders = ids.map(() => '?').join(',');
    const tenantFilter = addTenantFilter(req);

    const [accessibleAlerts] = await db.execute(
      `SELECT id
       FROM location_alerts
       WHERE id IN (${placeholders})${tenantFilter.whereClause}`,
      [...ids, ...tenantFilter.params],
    );

    if (accessibleAlerts.length === 0) {
      return res.status(404).json({ success: false, message: '告警记录不存在' });
    }

    const scopedIds = accessibleAlerts.map(item => item.id);
    const scopedPlaceholders = scopedIds.map(() => '?').join(',');

    await db.execute(
      `UPDATE location_alerts SET
        is_handled = 1,
        handle_time = NOW(),
        handle_person = ?,
        handle_result = ?,
        updated_at = NOW()
       WHERE id IN (${scopedPlaceholders})${tenantFilter.whereClause}`,
      [handlePerson, handle_result, ...scopedIds, ...tenantFilter.params],
    );

    res.json({ success: true, message: `成功处理 ${scopedIds.length} 条告警记录` });
  } catch (error) {
    logLocationAlertError('批量处理告警失败', error, {
      tenantId: getTenantId(req) || null,
      batchSize: Array.isArray(req.body?.ids) ? req.body.ids.length : 0,
    });
    res.status(500).json({ success: false, message: '批量处理告警失败', error: error.message });
  }
});

module.exports = router;
