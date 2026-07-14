const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, authorize } = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');

function logAuditRouteError(message, error, req, context = {}) {
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

/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     tags:
 *       - 操作日志（审计）
 *     summary: 获取操作日志列表
 *     description: 获取操作日志列表，支持分页、筛选和搜索。只有系统管理员可以查看所有日志，其他角色只能查看自己的操作日志。
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
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: 用户ID筛选
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         description: 用户名筛选
 *       - in: query
 *         name: action_type
 *         schema:
 *           type: string
 *           enum: [create, update, delete, login, logout, view, export, import, approve, reject, link, unlink]
 *         description: 操作类型筛选
 *       - in: query
 *         name: module
 *         schema:
 *           type: string
 *         description: 模块筛选（assets, users, technical-documents等）
 *       - in: query
 *         name: resource_type
 *         schema:
 *           type: string
 *         description: 资源类型筛选
 *       - in: query
 *         name: resource_id
 *         schema:
 *           type: integer
 *         description: 资源ID筛选
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 开始日期（YYYY-MM-DD）
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 结束日期（YYYY-MM-DD）
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 关键词搜索（操作描述、资源名称）
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           user_id:
 *                             type: integer
 *                           username:
 *                             type: string
 *                           real_name:
 *                             type: string
 *                           role:
 *                             type: string
 *                           action_type:
 *                             type: string
 *                           module:
 *                             type: string
 *                           resource_type:
 *                             type: string
 *                           resource_id:
 *                             type: integer
 *                           resource_name:
 *                             type: string
 *                           action_description:
 *                             type: string
 *                           ip_address:
 *                             type: string
 *                           request_method:
 *                             type: string
 *                           request_path:
 *                             type: string
 *                           response_status:
 *                             type: integer
 *                           execution_time:
 *                             type: integer
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationResponse'
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// 获取操作日志列表
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      user_id,
      username,
      action_type,
      module,
      resource_type,
      resource_id,
      start_date,
      end_date,
      keyword,
    } = req.query;

    const offset = (page - 1) * pageSize;

    // 构建查询条件
    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤（系统管理员可以查看所有企业的日志，普通用户只能查看自己企业的日志）
    const tenantFilter = addTenantFilter(req, 'al');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    // 权限控制：超级管理员和系统管理员（租户级）可以查看所有日志，普通用户只能查看自己的操作日志
    if (req.user.role !== 'super_admin' && req.user.role !== 'system_admin') {
      whereClause += ' AND al.user_id = ?';
      params.push(req.user.id);
    }

    // 用户ID筛选
    if (user_id) {
      whereClause += ' AND user_id = ?';
      params.push(parseInt(user_id));
    }

    // 用户名筛选
    if (username) {
      whereClause += ' AND username LIKE ?';
      params.push(`%${username}%`);
    }

    // 操作类型筛选
    if (action_type) {
      whereClause += ' AND action_type = ?';
      params.push(action_type);
    }

    // 模块筛选
    if (module) {
      whereClause += ' AND module = ?';
      params.push(module);
    }

    // 资源类型筛选
    if (resource_type) {
      whereClause += ' AND resource_type = ?';
      params.push(resource_type);
    }

    // 资源ID筛选
    if (resource_id) {
      whereClause += ' AND resource_id = ?';
      params.push(parseInt(resource_id));
    }

    // 日期范围筛选
    if (start_date) {
      whereClause += ' AND DATE(created_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND DATE(created_at) <= ?';
      params.push(end_date);
    }

    // 关键词搜索
    if (keyword) {
      whereClause += ' AND (action_description LIKE ? OR resource_name LIKE ?)';
      const keywordParam = `%${keyword}%`;
      params.push(keywordParam, keywordParam);
    }

    // 获取总数
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
      params,
    );
    const { total } = countRows[0];

    // 获取数据
    const [rows] = await db.execute(
      `SELECT 
        al.id, al.user_id, al.username, al.real_name, al.role,
        al.action_type, al.module, al.resource_type, al.resource_id, al.resource_name,
        al.action_description, al.ip_address, al.user_agent, al.request_method, al.request_path,
        al.response_status, al.error_message, al.execution_time, al.created_at
       FROM audit_logs al 
       ${whereClause}
       ORDER BY al.created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    // 解析 JSON 字段
    const logs = rows.map(row => ({
      ...row,
      user_agent: row.user_agent
        ? row.user_agent.length > 100
          ? `${row.user_agent.substring(0, 100)}...`
          : row.user_agent
        : null,
    }));

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logAuditRouteError('获取操作日志失败', error, req, {
      page: req.query?.page || 1,
      pageSize: req.query?.pageSize || 20,
    });
    res.status(500).json({ success: false, message: '获取操作日志失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/audit-logs/{id}:
 *   get:
 *     tags:
 *       - 操作日志（审计）
 *     summary: 获取操作日志详情
 *     description: 获取单条操作日志的详细信息，包括请求参数、修改前后的值等
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 日志ID
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         user_id:
 *                           type: integer
 *                         username:
 *                           type: string
 *                         real_name:
 *                           type: string
 *                         role:
 *                           type: string
 *                         action_type:
 *                           type: string
 *                         module:
 *                           type: string
 *                         resource_type:
 *                           type: string
 *                         resource_id:
 *                           type: integer
 *                         resource_name:
 *                           type: string
 *                         action_description:
 *                           type: string
 *                         old_value:
 *                           type: object
 *                           description: 修改前的值（JSON对象）
 *                         new_value:
 *                           type: object
 *                           description: 修改后的值（JSON对象）
 *                         ip_address:
 *                           type: string
 *                         user_agent:
 *                           type: string
 *                         request_method:
 *                           type: string
 *                         request_path:
 *                           type: string
 *                         request_params:
 *                           type: object
 *                           description: 请求参数（JSON对象）
 *                         response_status:
 *                           type: integer
 *                         error_message:
 *                           type: string
 *                         execution_time:
 *                           type: integer
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *       404:
 *         description: 日志不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// 获取操作日志详情
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === 'stats') {
      return next();
    }

    // 添加租户过滤验证
    const tenantFilter = addTenantFilter(req, 'al');
    const [rows] = await db.execute(
      `SELECT al.* FROM audit_logs al WHERE al.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '操作日志不存在' });
    }

    const log = rows[0];

    // 权限检查：超级管理员和系统管理员（租户级）可以查看所有日志，普通用户只能查看自己的操作日志
    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'system_admin';
    if (!isAdmin && log.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: '无权查看此操作日志' });
    }

    // 系统管理员（租户级）只能查看自己租户的日志
    if (req.user.role === 'system_admin' && log.tenant_id && log.tenant_id !== req.user.tenant_id) {
      return res.status(403).json({ success: false, message: '无权查看其他租户的操作日志' });
    }

    // 解析 JSON 字段
    let oldValue = null;
    let newValue = null;
    let requestParams = null;

    try {
      if (log.old_value) {
        oldValue = JSON.parse(log.old_value);
      }
      if (log.new_value) {
        newValue = JSON.parse(log.new_value);
      }
      if (log.request_params) {
        requestParams = JSON.parse(log.request_params);
      }
    } catch (e) {
      logAuditRouteError('解析JSON字段失败', e, req, {
        auditLogId: id,
      });
    }

    res.json({
      success: true,
      data: {
        ...log,
        old_value: oldValue,
        new_value: newValue,
        request_params: requestParams,
      },
    });
  } catch (error) {
    logAuditRouteError('获取操作日志详情失败', error, req, {
      auditLogId: req.params?.id || null,
    });
    res.status(500).json({ success: false, message: '获取操作日志详情失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/audit-logs/stats:
 *   get:
 *     tags:
 *       - 操作日志（审计）
 *     summary: 获取操作日志统计
 *     description: 获取操作日志的统计信息，包括操作类型分布、模块分布、用户操作统计等
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 开始日期（YYYY-MM-DD）
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 结束日期（YYYY-MM-DD）
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         action_type_stats:
 *                           type: array
 *                           description: 操作类型统计
 *                         module_stats:
 *                           type: array
 *                           description: 模块统计
 *                         user_stats:
 *                           type: array
 *                           description: 用户操作统计
 *                         daily_stats:
 *                           type: array
 *                           description: 每日操作统计
 */
// 获取操作日志统计
router.get('/stats', authenticate, async (req, res) => {
  try {
    // 权限检查：超级管理员和系统管理员（租户级）可以查看统计
    if (req.user.role !== 'super_admin' && req.user.role !== 'system_admin') {
      return res
        .status(403)
        .json({ success: false, message: '权限不足，只有系统管理员可以查看统计' });
    }

    const { start_date, end_date } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (start_date) {
      whereClause += ' AND DATE(created_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND DATE(created_at) <= ?';
      params.push(end_date);
    }

    // 添加租户过滤：系统管理员（租户级）只能查看自己租户的统计
    const tenantFilter = addTenantFilter(req, 'al');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    // 操作类型统计
    const [actionTypeStats] = await db.execute(
      `SELECT al.action_type, COUNT(*) as count 
       FROM audit_logs al
       ${whereClause}
       GROUP BY al.action_type 
       ORDER BY count DESC`,
      params,
    );

    // 模块统计
    const [moduleStats] = await db.execute(
      `SELECT al.module, COUNT(*) as count 
       FROM audit_logs al
       ${whereClause}
       GROUP BY al.module 
       ORDER BY count DESC`,
      params,
    );

    // 用户操作统计（前10名）
    const [userStats] = await db.execute(
      `SELECT al.username, al.real_name, COUNT(*) as count 
       FROM audit_logs al
       ${whereClause}
       GROUP BY user_id, username, real_name 
       ORDER BY count DESC 
       LIMIT 10`,
      params,
    );

    // 每日操作统计（最近30天）
    const [dailyStats] = await db.execute(
      `SELECT DATE(al.created_at) as date, COUNT(*) as count 
       FROM audit_logs al
       ${whereClause} AND al.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(al.created_at) 
       ORDER BY date DESC`,
      params,
    );

    res.json({
      success: true,
      data: {
        action_type_stats: actionTypeStats,
        module_stats: moduleStats,
        user_stats: userStats,
        daily_stats: dailyStats,
      },
    });
  } catch (error) {
    logAuditRouteError('获取操作日志统计失败', error, req, {
      startDate: req.query?.start_date || null,
      endDate: req.query?.end_date || null,
    });
    res.status(500).json({ success: false, message: '获取操作日志统计失败', error: error.message });
  }
});

module.exports = router;
