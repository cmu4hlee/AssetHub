/**
 * @swagger
 * /api/maintenance/ai/init:
 *   post:
 *     summary: 初始化AI维修对话
 *     tags: [维修AI]
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
 *                 description: 对话类型
 *               userId:
 *                 type: string
 *                 description: 用户ID
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/maintenance/ai/pending:
 *   get:
 *     summary: 获取AI待处理请求
 *     tags: [维修AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/maintenance/ai/message:
 *   post:
 *     summary: 发送AI维修对话消息
 *     tags: [维修AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conversationId
 *               - message
 *             properties:
 *               conversationId:
 *                 type: string
 *                 description: 对话ID
 *               message:
 *                 type: string
 *                 description: 消息内容
 *               context:
 *                 type: object
 *                 description: 对话上下文
 *               history:
 *                 type: array
 *                 description: 对话历史
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
 * /api/maintenance/ai/submit-request:
 *   post:
 *     summary: 提交故障维修申请
 *     tags: [维修AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               asset_code:
 *                 type: string
 *                 description: 资产编号
 *               fault_description:
 *                 type: string
 *                 description: 故障描述
 *               fault_level:
 *                 type: string
 *                 description: 故障等级
 *               request_department:
 *                 type: string
 *                 description: 报修部门
 *               expected_repair_date:
 *                 type: string
 *                 format: date
 *                 description: 期望维修日期
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
 * /api/maintenance/ai/feedback:
 *   post:
 *     summary: 提交学习反馈
 *     tags: [维修AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phrase:
 *                 type: string
 *                 description: 用户原话摘要
 *               intent:
 *                 type: string
 *                 description: 意图类型
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
 * /api/maintenance/ai/audio:
 *   post:
 *     summary: 处理音频文件
 *     tags: [维修AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *                 description: 音频文件
 *               conversationId:
 *                 type: string
 *                 description: 对话ID
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
 * /api/maintenance/ai/analysis:
 *   get:
 *     summary: 获取维修分析
 *     tags: [维修AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: 分析类型
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 开始日期
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 结束日期
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: 部门
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/maintenance/ai/test:
 *   post:
 *     summary: 测试AI维修功能
 *     tags: [维修AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: 测试消息
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
 * /api/maintenance/ai/debug-asset:
 *   get:
 *     summary: 调试：按资产编号查询资产
 *     tags: [维修AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: 资产编号
 *     responses:
 *       200:
 *         description: 成功
 *       400:
 *         description: 参数错误
 *       500:
 *         description: 服务器错误
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../middleware/auditLogger');
const { getTenantId, requireTenantId } = require('../middleware/tenant-filter');
const { fileSecurity } = require('../middleware/fileSecurity');
const maintenanceAIService = require('../services/maintenance-ai-service');
const requestsService = require('../services/maintenance/requests.service');

function logMaintenanceAiRouteError(message, error, req, context = {}) {
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

// 设置文件存储
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/audio');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename(req, file, cb) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const fileName = `audio-${timestamp}-${random}${ext}`;
    cb(null, fileName);
  },
});

// 文件过滤器：只允许音频文件
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'audio/wav',
    'audio/mp3',
    'audio/ogg',
    'audio/m4a',
    'audio/webm',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}。只支持音频文件。`), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter,
});

function sendServiceResult(res, result) {
  if (result && result.statusCode && result.statusCode !== 200) {
    return res.status(result.statusCode).json(result.body);
  }

  if (result && result.body) {
    return res.json(result.body);
  }

  return res.json(result);
}

function buildSubmitRequestAuditPayload(req, resultBody = {}) {
  const body = req.body || {};
  const faultDescription = String(body.fault_description || '').trim();

  return {
    submit_channel: 'maintenance_ai',
    source: String(body.source || 'maintenance_ai').trim() || 'maintenance_ai',
    intent: String(body.intent || 'repair_request').trim() || 'repair_request',
    conversation_id: body.conversationId || body.conversation_id || null,
    asset_code: body.asset_code || null,
    fault_level: body.fault_level || null,
    request_department: body.request_department || null,
    expected_repair_date: body.expected_repair_date || null,
    fault_description_preview: faultDescription ? faultDescription.slice(0, 120) : null,
    request_id: resultBody?.data?.id || null,
    request_no: resultBody?.data?.request_no || null,
  };
}

// ============================================// AI维修日志管理相关接口
// ============================================

/**
 * 初始化对话
 * @route POST /maintenance/ai/init
 * @group 维修AI - 维修日志AI管理
 * @param {object} body.body - 初始化参数
 * @param {string} body.type - 对话类型
 * @param {string} body.userId - 用户ID
 * @returns {object} 200 - 初始化结果
 * @returns {object} 500 - 服务器错误
 */
router.post('/init', authenticate, async (req, res) => {
  try {
    const { type, userId } = req.body;
    const tenantId = getTenantId(req);

    const result = await maintenanceAIService.initConversation({ type, userId, tenantId });

    if (result.success) {
      res.json({
        success: true,
        conversationId: result.conversationId,
        message: result.message,
        ...(result.pendingRequests && { pendingRequests: result.pendingRequests }),
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    logMaintenanceAiRouteError('初始化对话失败', error, req, {
      type: req.body?.type || null,
      userId: req.body?.userId || null,
    });
    res.status(500).json({
      success: false,
      message: `初始化对话失败: ${error.message}`,
    });
  }
});

/**
 * 获取当前租户待办（报修 + 调配），供审批后刷新
 * @route GET /maintenance/ai/pending
 */
router.get('/pending', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const result = await maintenanceAIService.getPendingRequests(tenantId);
    if (result.success) {
      res.json({ success: true, pendingRequests: result.pendingRequests });
    } else {
      res.json({ success: true, pendingRequests: { repairs: [], transfers: [] } });
    }
  } catch (error) {
    logMaintenanceAiRouteError('获取待办失败', error, req);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 发送消息
 * @route POST /maintenance/ai/message
 * @group 维修AI - 维修日志AI管理
 * @param {object} body.body - 发送消息参数
 * @param {string} body.conversationId - 对话ID
 * @param {string} body.message - 消息内容
 * @param {object} body.context - 对话上下文
 * @param {array} body.history - 对话历史
 * @returns {object} 200 - 发送结果
 * @returns {object} 500 - 服务器错误
 */
router.post('/message', authenticate, async (req, res) => {
  try {
    const { conversationId, message, context, history } = req.body;

    if (!conversationId || !message) {
      return res.status(400).json({
        success: false,
        message: '对话ID和消息不能为空',
      });
    }

    const tenantId = getTenantId(req);
    const isSuperAdmin = req.user && req.user.role === 'super_admin';
    const result = await maintenanceAIService.sendMessage({
      conversationId,
      message,
      context,
      history,
      tenantId,
      isSuperAdmin,
      role: req.user?.role || 'user',
      managedDepartments: req.user?.managed_departments || [],
      approverName: req.user?.real_name || req.user?.username || '用户',
      username: req.user?.username || '',
      realName: req.user?.real_name || '',
      tenantName: req.user?.tenant_name || '',
      departmentCode: req.user?.department_code || '',
      enabledModules: req.user?.enabled_modules || [],
      authHeader: req.header('Authorization') || '',
    });

    if (result.success) {
      res.json({
        success: true,
        response: result.response,
        intent: result.intent,
        maintenanceForm: result.maintenanceForm,
        context: result.context,
        promptMessage: result.promptMessage,
        validationResult: result.validationResult,
        assetLookup: result.assetLookup,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    logMaintenanceAiRouteError('发送消息失败', error, req, {
      conversationId: req.body?.conversationId || null,
    });
    res.status(500).json({
      success: false,
      message: `发送消息失败: ${error.message}`,
    });
  }
});

router.post(
  '/submit-request',
  authenticate,
  requireTenantId,
  authorize('maintenance:request:create'),
  async (req, res) => {
    const startedAt = Date.now();
    const tenantId = getTenantId(req);

    try {
      const result = await requestsService.createRequest(req.body || {}, req);
      const responseBody = result?.body || result || {};
      const responseStatus = result?.statusCode && result.statusCode !== 200 ? result.statusCode : 200;

      await logAudit(
        req,
        {
          action_type: 'create',
          module: 'maintenance_ai',
          resource_type: 'maintenance_request',
          resource_id: responseBody?.data?.id || null,
          resource_name: responseBody?.data?.request_no || null,
          action_description: 'AI/skill 提交故障维修申请',
          new_value: buildSubmitRequestAuditPayload(req, responseBody),
          response_status: responseStatus,
          error_message: responseStatus >= 400 ? responseBody?.message || null : null,
          execution_time: Date.now() - startedAt,
        },
        { tenantId },
      );

      return sendServiceResult(res, result);
    } catch (error) {
      await logAudit(
        req,
        {
          action_type: 'create',
          module: 'maintenance_ai',
          resource_type: 'maintenance_request',
          resource_name: req.body?.asset_code || null,
          action_description: 'AI/skill 提交故障维修申请',
          new_value: buildSubmitRequestAuditPayload(req),
          response_status: 500,
          error_message: error.message,
          execution_time: Date.now() - startedAt,
        },
        { tenantId },
      );

      logMaintenanceAiRouteError('AI/skill 提交故障维修申请失败', error, req, {
        assetCode: req.body?.asset_code || null,
      });
      return res.status(500).json({
        success: false,
        message: '提交故障维修申请失败',
        error: error.message,
      });
    }
  },
);

/**
 * 提交学习反馈（可选）：成功提交表单后前端可调用，记录「用户表述→意图」供后续对话注入、系统进化
 * @body phrase - 用户原话摘要，intent - 意图（如 transfer, repair_request）
 */
router.post('/feedback', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { phrase, intent } = req.body || {};
    if (!tenantId || !intent) {
      return res.status(400).json({ success: false, message: '缺少 tenant 或 intent' });
    }
    await maintenanceAIService.submitLearningFeedback(tenantId, phrase || '', intent);
    res.json({ success: true, message: '反馈已记录' });
  } catch (err) {
    logMaintenanceAiRouteError('提交学习反馈失败', err, req, {
      intent: req.body?.intent || null,
    });
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * 处理音频
 * @route POST /maintenance/ai/audio
 * @group 维修AI - 维修日志AI管理
 * @param {file} audio.formData - 音频文件
 * @param {string} conversationId.formData - 对话ID
 * @returns {object} 200 - 处理结果
 * @returns {object} 500 - 服务器错误
 */
router.post('/audio', authenticate, upload.single('audio'), fileSecurity(), async (req, res) => {
  try {
    const { conversationId } = req.body;
    const audioFile = req.file;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: '对话ID不能为空',
      });
    }

    if (!audioFile) {
      return res.status(400).json({
        success: false,
        message: '音频文件不能为空',
      });
    }

    const result = await maintenanceAIService.processAudio({
      conversationId,
      audio: audioFile,
    });

    if (result.success) {
      res.json({
        success: true,
        transcript: result.transcript,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    logMaintenanceAiRouteError('处理音频失败', error, req, {
      conversationId: req.body?.conversationId || null,
      hasAudioFile: !!req.file,
    });
    res.status(500).json({
      success: false,
      message: `处理音频失败: ${error.message}`,
    });
  }
});

/**
 * 获取维修分析
 * @route GET /maintenance/ai/analysis
 * @group 维修AI - 维修日志AI管理
 * @param {string} type.query - 分析类型
 * @param {string} startDate.query - 开始日期
 * @param {string} endDate.query - 结束日期
 * @param {string} department.query - 部门
 * @returns {object} 200 - 分析结果
 * @returns {object} 500 - 服务器错误
 */
router.get('/analysis', authenticate, async (req, res) => {
  try {
    const { type, startDate, endDate, department } = req.query;

    const result = await maintenanceAIService.getMaintenanceAnalysis({
      type,
      startDate,
      endDate,
      department,
    });

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    logMaintenanceAiRouteError('获取维修分析失败', error, req, {
      type: req.query?.type || null,
      startDate: req.query?.startDate || null,
      endDate: req.query?.endDate || null,
      department: req.query?.department || null,
    });
    res.status(500).json({
      success: false,
      message: `获取维修分析失败: ${error.message}`,
    });
  }
});

/**
 * 测试AI维修日志功能
 * @route POST /maintenance/ai/test
 * @group 维修AI - 维修日志AI管理
 * @param {string} message.query - 测试消息
 * @returns {object} 200 - 测试结果
 * @returns {object} 500 - 服务器错误
 */
router.post('/test', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    const tenantId = getTenantId(req);
    const isSuperAdmin = req.user && req.user.role === 'super_admin';

    if (!message) {
      return res.status(400).json({
        success: false,
        message: '测试消息不能为空',
      });
    }

    // 初始化对话
    const initResult = await maintenanceAIService.initConversation({
      type: 'maintenance',
      userId: req.user?.id || null,
      tenantId,
    });

    if (!initResult.success) {
      return res.status(500).json({
        success: false,
        message: initResult.message,
      });
    }

    // 发送测试消息
    const messageResult = await maintenanceAIService.sendMessage({
      conversationId: initResult.conversationId,
      message,
      tenantId,
      isSuperAdmin,
      role: req.user?.role || 'user',
      managedDepartments: req.user?.managed_departments || [],
      approverName: req.user?.real_name || req.user?.username || '用户',
      username: req.user?.username || '',
      realName: req.user?.real_name || '',
      tenantName: req.user?.tenant_name || '',
      departmentCode: req.user?.department_code || '',
      enabledModules: req.user?.enabled_modules || [],
      authHeader: req.header('Authorization') || '',
    });

    if (messageResult.success) {
      res.json({
        success: true,
        conversationId: initResult.conversationId,
        response: messageResult.response,
        maintenanceForm: messageResult.maintenanceForm,
        context: messageResult.context,
      });
    } else {
      res.status(500).json({
        success: false,
        message: messageResult.message,
      });
    }
  } catch (error) {
    logMaintenanceAiRouteError('测试AI维修日志功能失败', error, req);
    res.status(500).json({
      success: false,
      message: `测试AI维修日志功能失败: ${error.message}`,
    });
  }
});

/**
 * 调试：按资产编号查库，用于排查「没查到」原因（需登录）
 * GET /maintenance/ai/debug-asset?code=000006003
 */
router.get('/debug-asset', authenticate, async (req, res) => {
  try {
    const {code} = req.query;
    if (!code || !String(code).trim()) {
      return res.status(400).json({ success: false, message: '请提供 code 参数，例如 ?code=000006003' });
    }
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '请先选择企业空间' });
    }
    const asset = await maintenanceAIService.getAssetByCode(tenantId, code);
    if (asset) {
      return res.json({ success: true, found: true, asset });
    }
    return res.json({ success: true, found: false, message: '未查到该资产编号', triedCode: String(code).trim() });
  } catch (error) {
    logMaintenanceAiRouteError('debug-asset 失败', error, req, {
      code: req.query?.code || null,
    });
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
