/**
 * 工作流路由模块
 * 提供资产状态工作流相关接口
 */

/**
 * @swagger
 * /api/workflow:
 *   get:
 *     summary: 工作流API信息
 *     tags: [工作流]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API信息
 */

/**
 * @swagger
 * /api/workflow/default:
 *   get:
 *     summary: 获取默认工作流ID
 *     tags: [工作流]
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
 *                     workflow_id:
 *                       type: integer
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/workflow/states:
 *   get:
 *     summary: 获取工作流状态列表
 *     tags: [工作流]
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       state_code:
 *                         type: string
 *                       state_name:
 *                         type: string
 *                       color:
 *                         type: string
 *                       sort_order:
 *                         type: integer
 *                       is_terminal:
 *                         type: boolean
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/workflow/transitions:
 *   get:
 *     summary: 获取工作流迁移规则
 *     tags: [工作流]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from_state
 *         schema:
 *           type: string
 *         description: 来源状态
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
 *                       transition_name:
 *                         type: string
 *                       from_state:
 *                         type: string
 *                       from_state_name:
 *                         type: string
 *                       to_state:
 *                         type: string
 *                       to_state_name:
 *                         type: string
 *                       require_reason:
 *                         type: boolean
 *                       is_active:
 *                         type: boolean
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/workflow/transition/{assetId}:
 *   post:
 *     summary: 执行状态迁移
 *     description: 对资产执行工作流状态迁移
 *     tags: [工作流]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assetId
 *         required: true
 *         schema:
 *           type: string
 *         description: 资产ID或编号
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transition_id
 *             properties:
 *               transition_id:
 *                 type: integer
 *                 description: 迁移规则ID
 *               reason:
 *                 type: string
 *                 description: 迁移原因
 *               metadata:
 *                 type: object
 *                 description: 附加元数据
 *     responses:
 *       200:
 *         description: 迁移成功
 *       400:
 *         description: 参数错误或状态不支持迁移
 *       404:
 *         description: 资产或迁移规则不存在
 *       500:
 *         description: 服务器错误
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');
const workflowService = require('../services/asset-workflow.service');
const logger = require('../config/logger');

router.get('/', authenticate, async (req, res) => {
  res.json({
    success: true,
    message: '工作流API',
    endpoints: {
      default: '/api/workflow/default',
      states: '/api/workflow/states',
      transitions: '/api/workflow/transitions',
    },
  });
});

/**
 * 获取默认工作流ID
 */
router.get('/default', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const workflowId = await workflowService.getDefaultWorkflowId(tenantId);

    res.json({
      success: true,
      data: { workflow_id: workflowId },
    });
  } catch (error) {
    logger.error('Get default workflow failed:', error);
    res.status(500).json({
      success: false,
      message: '获取默认工作流失败',
      error: error.message,
    });
  }
});

/**
 * 获取工作流状态列表
 */
router.get('/states', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const workflowId = await workflowService.getDefaultWorkflowId(tenantId);

    if (!workflowId) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const states = await workflowService.getWorkflowStates(workflowId, tenantId);
    const normalizedStates = states.map(state => ({
      id: state.id,
      state_code: state.state_key,
      state_name: state.state_label,
      color: state.color,
      sort_order: state.sort_order,
      is_terminal: Boolean(state.is_terminal),
    }));

    res.json({
      success: true,
      data: normalizedStates,
    });
  } catch (error) {
    logger.error('Get workflow states failed:', error);
    res.status(500).json({
      success: false,
      message: '获取工作流状态失败',
      error: error.message,
    });
  }
});

/**
 * 获取工作流迁移规则
 */
router.get('/transitions', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { from_state } = req.query;

    const workflowId = await workflowService.getDefaultWorkflowId(tenantId);

    if (!workflowId) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const [states, allTransitions] = await Promise.all([
      workflowService.getWorkflowStates(workflowId, tenantId),
      workflowService.getWorkflowTransitions(workflowId, tenantId),
    ]);

    const stateLabelMap = new Map(
      states.map(state => [state.state_key, state.state_label]),
    );

    const transitions = allTransitions
      .filter(transition => (!from_state || transition.from_state === from_state))
      .map(transition => ({
        id: transition.id,
        transition_name: transition.name,
        from_state: transition.from_state,
        from_state_name: stateLabelMap.get(transition.from_state) || transition.from_state,
        to_state: transition.to_state,
        to_state_name: stateLabelMap.get(transition.to_state) || transition.to_state,
        require_reason: Boolean(transition.require_reason),
        is_active: Boolean(transition.is_active),
      }));

    res.json({
      success: true,
      data: transitions,
    });
  } catch (error) {
    logger.error('Get workflow transitions failed:', error);
    res.status(500).json({
      success: false,
      message: '获取工作流迁移失败',
      error: error.message,
    });
  }
});

/**
 * 执行状态迁移
 */
router.post('/transition/:assetId', authenticate, async (req, res) => {
  try {
    const { assetId } = req.params;
    const { transition_id, reason, metadata } = req.body;
    const tenantId = getTenantId(req);

    if (!transition_id) {
      return res.status(400).json({
        success: false,
        message: '缺少迁移ID',
      });
    }

    const workflowId = await workflowService.getDefaultWorkflowId(tenantId);

    if (!workflowId) {
      return res.status(400).json({
        success: false,
        message: '未配置工作流',
      });
    }

    // 执行迁移
    const result = await workflowService.applyTransition({
      assetIdOrCode: assetId,
      transitionId: transition_id,
      reason,
      metadata,
      tenantId,
      user: {
        id: req.user.id,
        username: req.user.real_name || req.user.username,
      },
      tenantFilter: {
        whereClause: 'AND tenant_id = ?',
        params: [tenantId],
      },
    });

    res.json({
      success: true,
      data: result,
      message: '状态迁移成功',
    });
  } catch (error) {
    const messageMap = {
      ASSET_NOT_FOUND: '资产不存在',
      TRANSITION_NOT_FOUND: '迁移规则不存在',
      INVALID_TRANSITION_STATE: '当前状态不支持该迁移',
      REASON_REQUIRED: '该迁移必须填写原因',
      ASSET_ID_REQUIRED: '缺少资产ID',
      TRANSITION_ID_REQUIRED: '缺少迁移ID',
      INSUFFICIENT_PERMISSIONS: '权限不足',
      WORKFLOW_INACTIVE: '工作流未启用',
      ASSET_LOCKED: '资产已锁定',
    };
    const statusMap = {
      ASSET_NOT_FOUND: 404,
      TRANSITION_NOT_FOUND: 404,
      INVALID_TRANSITION_STATE: 400,
      REASON_REQUIRED: 400,
      ASSET_ID_REQUIRED: 400,
      TRANSITION_ID_REQUIRED: 400,
      INSUFFICIENT_PERMISSIONS: 403,
      WORKFLOW_INACTIVE: 400,
      ASSET_LOCKED: 423,
    };
    const mappedMessage = messageMap[error.message];
    const statusCode = statusMap[error.message] || 500;

    logger.error('Apply workflow transition failed:', error);
    res.status(statusCode).json({
      success: false,
      message: mappedMessage || '执行状态迁移失败',
      error: error.message,
    });
  }
});

module.exports = router;
