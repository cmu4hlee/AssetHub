/**
 * 智能预警路由
 * 提供预警概览、预警列表、预警设置等接口
 */

/**
 * @swagger
 * /api/intelligent-alerts/overview:
 *   get:
 *     summary: 获取预警概览统计
 *     description: 获取各类预警的统计数据
 *     tags: [智能预警]
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
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/intelligent-alerts:
 *   get:
 *     summary: 获取预警列表
 *     description: 分页获取预警列表
 *     tags: [智能预警]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: 预警类型
 *       - in: query
 *         name: urgency
 *         schema:
 *           type: string
 *         description: 紧急程度
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *         description: 仅未读
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 状态
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
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/intelligent-alerts/{alertId}/read:
 *   post:
 *     summary: 标记单条预警已读
 *     tags: [智能预警]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: 预警ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 description: 预警类型
 *     responses:
 *       200:
 *         description: 成功
 *       400:
 *         description: 失败
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/intelligent-alerts/{alertId}/handle:
 *   post:
 *     summary: 标记单条预警已处理
 *     tags: [智能预警]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: 预警ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               handlerNotes:
 *                 type: string
 *                 description: 处理备注
 *     responses:
 *       200:
 *         description: 成功
 *       400:
 *         description: 失败
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/intelligent-alerts/{alertId}/unhandle:
 *   post:
 *     summary: 撤销单条预警已处理状态
 *     tags: [智能预警]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: 预警ID
 *     responses:
 *       200:
 *         description: 成功
 *       400:
 *         description: 失败
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/intelligent-alerts/read-all:
 *   post:
 *     summary: 批量标记预警已读
 *     tags: [智能预警]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               urgency:
 *                 type: string
 *               unreadOnly:
 *                 type: boolean
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: 成功
 *       400:
 *         description: 失败
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/intelligent-alerts/handle-all:
 *   post:
 *     summary: 批量标记预警已处理
 *     tags: [智能预警]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               urgency:
 *                 type: string
 *               unreadOnly:
 *                 type: boolean
 *               status:
 *                 type: string
 *               handlerNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: 成功
 *       400:
 *         description: 失败
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/intelligent-alerts/maintenance:
 *   get:
 *     summary: 保养到期预警
 *     tags: [智能预警]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: 提前天数
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/intelligent-alerts/qualifications:
 *   get:
 *     summary: 资质到期预警
 *     tags: [智能预警]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 90
 *         description: 提前天数
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/intelligent-alerts/inspections:
 *   get:
 *     summary: 特种设备检验到期预警
 *     tags: [智能预警]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 90
 *         description: 提前天数
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/intelligent-alerts/safety:
 *   get:
 *     summary: 安全检测到期预警
 *     tags: [智能预警]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: 提前天数
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/intelligent-alerts/uptime:
 *   get:
 *     summary: 开机率异常预警
 *     tags: [智能预警]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: integer
 *           default: 95
 *         description: 阈值百分比
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/intelligent-alerts/settings:
 *   get:
 *     summary: 获取用户预警设置
 *     tags: [智能预警]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 *   post:
 *     summary: 保存用户预警设置
 *     tags: [智能预警]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');
const alertService = require('../services/intelligent-alert-service');

const router = express.Router();

const parseBooleanParam = value => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(normalized);
};

/**
 * 获取预警概览统计
 * GET /api/intelligent-alerts/overview
 */
router.get('/overview', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const result = await alertService.getAlertOverview(tenantId);
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('获取预警概览失败:', error);
    res.status(500).json({
      success: false,
      message: '获取预警概览失败',
      error: error.message,
    });
  }
});

/**
 * 获取预警列表
 * GET /api/intelligent-alerts
 * Query: type, urgency, unreadOnly, status, page, pageSize
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user.id;
    const { type, urgency, unreadOnly, status, page, pageSize } = req.query;

    const result = await alertService.getAllAlerts(tenantId, {
      type,
      urgency,
      unreadOnly: parseBooleanParam(unreadOnly),
      status,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      userId,
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('获取预警列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取预警列表失败',
      error: error.message,
    });
  }
});

/**
 * 标记单条预警已读
 * POST /api/intelligent-alerts/:alertId/read
 */
router.post('/:alertId/read', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user.id;
    const { alertId } = req.params;
    const { type } = req.body || {};

    const result = await alertService.markAlertAsRead(tenantId, userId, {
      alertId,
      type,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('标记预警已读失败:', error);
    return res.status(500).json({
      success: false,
      message: '标记预警已读失败',
      error: error.message,
    });
  }
});

/**
 * 标记单条预警已处理
 * POST /api/intelligent-alerts/:alertId/handle
 */
router.post('/:alertId/handle', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user.id;
    const { alertId } = req.params;
    const { type, handlerNotes } = req.body || {};

    const result = await alertService.markAlertAsHandled(tenantId, userId, {
      alertId,
      type,
      handlerNotes,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('标记预警已处理失败:', error);
    return res.status(500).json({
      success: false,
      message: '标记预警已处理失败',
      error: error.message,
    });
  }
});

/**
 * 撤销单条预警已处理状态
 * POST /api/intelligent-alerts/:alertId/unhandle
 */
router.post('/:alertId/unhandle', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user.id;
    const { alertId } = req.params;

    const result = await alertService.markAlertAsUnhandled(tenantId, userId, {
      alertId,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('撤销预警处理状态失败:', error);
    return res.status(500).json({
      success: false,
      message: '撤销预警处理状态失败',
      error: error.message,
    });
  }
});

/**
 * 批量标记预警已读
 * POST /api/intelligent-alerts/read-all
 * Body: { type, urgency, unreadOnly, status }
 */
router.post('/read-all', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user.id;
    const { type, urgency, unreadOnly, status } = req.body || {};

    const result = await alertService.markAllAlertsAsRead(tenantId, userId, {
      type,
      urgency,
      unreadOnly: parseBooleanParam(unreadOnly),
      status,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('批量标记预警已读失败:', error);
    return res.status(500).json({
      success: false,
      message: '批量标记预警已读失败',
      error: error.message,
    });
  }
});

/**
 * 批量标记预警已处理
 * POST /api/intelligent-alerts/handle-all
 * Body: { type, urgency, unreadOnly, status, handlerNotes }
 */
router.post('/handle-all', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user.id;
    const { type, urgency, unreadOnly, status, handlerNotes } = req.body || {};

    const result = await alertService.markAllAlertsAsHandled(tenantId, userId, {
      type,
      urgency,
      unreadOnly: parseBooleanParam(unreadOnly),
      status,
      handlerNotes,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('批量标记预警已处理失败:', error);
    return res.status(500).json({
      success: false,
      message: '批量标记预警已处理失败',
      error: error.message,
    });
  }
});

/**
 * 获取各类预警的详细列表
 */

// 保养到期预警
router.get('/maintenance', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { days } = req.query;
    const alerts = await alertService.checkMaintenanceDue(tenantId, parseInt(days) || 7);
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('获取保养预警失败:', error);
    res.status(500).json({ success: false, message: '获取保养预警失败' });
  }
});

// 资质到期预警
router.get('/qualifications', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { days } = req.query;
    const alerts = await alertService.checkQualificationExpire(tenantId, parseInt(days) || 90);
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('获取资质预警失败:', error);
    res.status(500).json({ success: false, message: '获取资质预警失败' });
  }
});

// 特种设备检验到期预警
router.get('/inspections', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { days } = req.query;
    const alerts = await alertService.checkInspectionDue(tenantId, parseInt(days) || 90);
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('获取检验预警失败:', error);
    res.status(500).json({ success: false, message: '获取检验预警失败' });
  }
});

// 安全检测到期预警
router.get('/safety', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { days } = req.query;
    const alerts = await alertService.checkSafetyExpire(tenantId, parseInt(days) || 30);
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('获取安全检测预警失败:', error);
    res.status(500).json({ success: false, message: '获取安全检测预警失败' });
  }
});

// 开机率异常预警
router.get('/uptime', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { threshold } = req.query;
    const alerts = await alertService.checkUptimeLow(tenantId, parseInt(threshold) || 95);
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('获取开机率预警失败:', error);
    res.status(500).json({ success: false, message: '获取开机率预警失败' });
  }
});

/**
 * 获取用户预警设置
 * GET /api/intelligent-alerts/settings
 */
router.get('/settings', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user.id;
    const result = await alertService.getAlertSettings(tenantId, userId);
    res.json(result);
  } catch (error) {
    console.error('获取预警设置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取预警设置失败',
      error: error.message,
    });
  }
});

/**
 * 保存用户预警设置
 * POST /api/intelligent-alerts/settings
 */
router.post('/settings', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user.id;
    const settings = req.body;

    const result = await alertService.saveAlertSettings(tenantId, userId, settings);
    res.json(result);
  } catch (error) {
    console.error('保存预警设置失败:', error);
    res.status(500).json({
      success: false,
      message: '保存预警设置失败',
      error: error.message,
    });
  }
});

module.exports = router;
