const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const logger = require('../../config/logger');
const { authenticate, authorize } = require('../../middleware/auth');
const eventBus = require('../../core/EventBus').getEventBus();

// 维修申请模块权限集合
const RQ_GET_ROLES = ['maintenance.view', 'asset.view_all', 'asset.view_own_department'];
const RQ_WRITE_ROLES = ['maintenance.add', 'maintenance.edit', 'asset.edit_all', 'asset.edit_own_department'];
const RQ_APPROVE_ROLES = ['maintenance.approve', 'maintenance.edit', 'asset.edit_all'];
const RQ_DELETE_ROLES = ['maintenance.delete', 'maintenance.edit', 'asset.delete_all', 'asset.delete_own_department'];
const { requireTenantId } = require('../../middleware/tenant-filter');
const { fileSecurity } = require('../../middleware/fileSecurity');
const requestsService = require('../../services/maintenance/requests.service');

const router = express.Router();

const requestAttachmentStorage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadPath = path.join(__dirname, '../../uploads/maintenance-request-attachments');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename(req, file, cb) {
    const { id } = req.params;
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const fileName = `req-${id}-${timestamp}-${random}${ext}`;
    cb(null, fileName);
  },
});

const requestAttachmentFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}。只支持图片和常见文档格式。`), false);
  }
};

const requestAttachmentUpload = multer({
  storage: requestAttachmentStorage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: requestAttachmentFileFilter,
});

const parseRequestAttachmentFileName = (req, res, next) => {
  req.parsedFileName = null;
  if (req.body && req.body.originalFileName) {
    try {
      req.parsedFileName = decodeURIComponent(req.body.originalFileName);
    } catch (error) {
      console.warn('[维修申请附件] 请求体文件名解码失败:', error);
    }
  }
  const contentDisposition = req.headers['content-disposition'];
  if (contentDisposition && !req.parsedFileName) {
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;,\s]+)/i);
    if (utf8Match && utf8Match[1]) {
      try {
        req.parsedFileName = decodeURIComponent(utf8Match[1]);
      } catch (error) {
        // ignore
      }
    }
  }
  next();
};

const handleRequestAttachmentMulterError = (err, req, res, next) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: '文件大小超过限制（最大50MB）' });
    }
    if (err.message && err.message.includes('不支持的文件类型')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(400).json({ success: false, message: `文件上传失败: ${err.message}` });
  }
  next();
};

function logMaintenanceRequestsRouteError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: req?.user?.tenant_id || null,
    userId: req?.user?.id || null,
    username: req?.user?.username || null,
    userRole: req?.user?.role || null,
    ...context,
  });
}

function sendResult(res, result) {
  if (result.statusCode && result.statusCode !== 200) {
    return res.status(result.statusCode).json(result.body);
  }

  if (result.body) {
    return res.json(result.body);
  }

  return res.json(result);
}

/**
 * 判断 service 返回值是否表示成功
 */
function isServiceSuccess(result) {
  if (!result) return false;
  if (result.statusCode !== undefined) return result.statusCode === 200;
  return true;
}

/**
 * 安全地向 EventBus 发布维修事件（fail-soft）
 */
function emitMaintenanceEvent(eventName, payload) {
  try {
    // debug 级日志：事件发布在生产常态下不需要刷屏
    logger.debug(`[maintenance-event] emit ${eventName}`, {
      requestId: payload?.requestId,
      requestNo: payload?.requestNo,
    });
    eventBus.emit(eventName, payload || {});
  } catch (err) {
    logger.warn(`emit ${eventName} failed`, { error: err.message });
  }
}

router.get('/requests', authenticate, authorize(RQ_GET_ROLES), async (req, res) => {
  try {
    const result = await requestsService.getRequests(req.query, req);
    res.json(result);
  } catch (error) {
    logMaintenanceRequestsRouteError('获取故障维修申请列表失败', error, req);
    res.status(500).json({ success: false, message: '获取故障维修申请列表失败', error: error.message });
  }
});

router.get('/requests/:id', authenticate, authorize(RQ_GET_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    if (id && id.includes('attachments')) {
      return res.status(404).json({ success: false, message: '路由匹配错误，请检查路由顺序' });
    }
    const result = await requestsService.getRequest(id, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceRequestsRouteError('获取故障维修申请详情失败', error, req, {
      requestId: req.params?.id || null,
    });
    res.status(500).json({ success: false, message: '获取故障维修申请详情失败', error: error.message });
  }
});

router.post('/requests', authenticate, requireTenantId, authorize(RQ_WRITE_ROLES), async (req, res) => {
  try {
    const result = await requestsService.createRequest(req.body, req);
    sendResult(res, result);
    // 出站事件：飞书出站通知等下游订阅者会收到
    if (isServiceSuccess(result)) {
      const data = result.body?.data || {};
      emitMaintenanceEvent('maintenance.request.created', {
        tenantId: req.user?.tenant_id,
        requestId: data.id,
        requestNo: data.request_no,
        actorUserId: req.user?.id,
        source: 'requests.router.createRequest',
      });
    }
  } catch (error) {
    logMaintenanceRequestsRouteError('创建故障维修申请失败', error, req, {
      assetCode: req.body?.asset_code || null,
    });
    res.status(500).json({ success: false, message: '创建故障维修申请失败', error: error.message });
  }
});

router.post('/requests/:id/approve', authenticate, authorize(RQ_APPROVE_ROLES), async (req, res) => {
  try {
    const result = await requestsService.approveRequest(req.params.id, req.body, req);
    sendResult(res, result);
    // 出站事件
    if (isServiceSuccess(result)) {
      emitMaintenanceEvent('maintenance.request.approved', {
        tenantId: req.user?.tenant_id,
        requestId: req.params.id,
        approved: req.body?.approved,
        actorUserId: req.user?.id,
        approverName: req.user?.real_name || req.user?.username,
        source: 'requests.router.approveRequest',
      });
    }
  } catch (error) {
    logMaintenanceRequestsRouteError('审批故障维修申请失败', error, req, {
      requestId: req.params?.id || null,
    });
    res.status(500).json({ success: false, message: '审批故障维修申请失败', error: error.message });
  }
});

router.post('/requests/:id/start', authenticate, authorize(RQ_WRITE_ROLES), async (req, res) => {
  try {
    const result = await requestsService.startRequest(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceRequestsRouteError('开始维修失败', error, req, {
      requestId: req.params?.id || null,
    });
    res.status(500).json({ success: false, message: '开始维修失败', error: error.message });
  }
});

router.post('/requests/:id/complete', authenticate, authorize(RQ_WRITE_ROLES), async (req, res) => {
  try {
    const result = await requestsService.completeRequest(req.params.id, req.body, req);
    sendResult(res, result);
    // 出站事件
    if (isServiceSuccess(result)) {
      emitMaintenanceEvent('maintenance.request.completed', {
        tenantId: req.user?.tenant_id,
        requestId: req.params.id,
        actorUserId: req.user?.id,
        repairPersonName: req.body?.repair_person || req.body?.maintenance_person,
        source: 'requests.router.completeRequest',
      });
    }
  } catch (error) {
    logMaintenanceRequestsRouteError('完成维修失败', error, req, {
      requestId: req.params?.id || null,
    });
    res.status(500).json({ success: false, message: '完成维修失败', error: error.message });
  }
});

router.put('/requests/:id', authenticate, authorize(RQ_WRITE_ROLES), async (req, res) => {
  try {
    const result = await requestsService.updateRequest(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceRequestsRouteError('更新故障维修申请失败', error, req, {
      requestId: req.params?.id || null,
    });
    res.status(500).json({ success: false, message: '更新故障维修申请失败', error: error.message });
  }
});

router.post('/requests/:id/cancel', authenticate, authorize(RQ_DELETE_ROLES), async (req, res) => {
  try {
    const result = await requestsService.cancelRequest(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceRequestsRouteError('取消故障维修申请失败', error, req, {
      requestId: req.params?.id || null,
    });
    res.status(500).json({ success: false, message: '取消故障维修申请失败', error: error.message });
  }
});

router.get('/requests/:id/attachments', authenticate, authorize(RQ_GET_ROLES), async (req, res) => {
  try {
    const result = await requestsService.getRequestAttachments(req.params.id, req);
    res.json(result);
  } catch (error) {
    console.error('获取维修申请附件列表失败:', error);
    res.status(500).json({ success: false, message: '获取维修申请附件列表失败', error: error.message });
  }
});

router.post(
  '/requests/:id/attachments',
  authenticate,
  requireTenantId,
  parseRequestAttachmentFileName,
  requestAttachmentUpload.single('file'),
  fileSecurity(),
  handleRequestAttachmentMulterError,
  async (req, res) => {
    try {
      const result = await requestsService.uploadRequestAttachment(req.params.id, req);
      sendResult(res, result);
    } catch (error) {
      console.error('[维修申请附件] 上传失败:', error);
      if (error.message && error.message.includes('不支持的文件类型')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: '文件大小超过限制（最大50MB）' });
      }
      res.status(500).json({ success: false, message: '上传维修申请附件失败', error: error.message });
    }
  }
);

router.get('/requests/:requestId/attachments/:attachmentId', authenticate, authorize(RQ_GET_ROLES), async (req, res) => {
  try {
    const result = await requestsService.getRequestAttachment(
      req.params.requestId,
      req.params.attachmentId,
      req,
    );
    if (result.statusCode && result.statusCode !== 200) {
      return res.status(result.statusCode).json(result.body);
    }
    const { attachment } = result.data;
    if (attachment.file_type && attachment.file_type.startsWith('image/')) {
      res.setHeader('Content-Type', attachment.file_type);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
    const absolutePath = path.join(__dirname, '../..', attachment.file_path);
    res.sendFile(path.resolve(absolutePath));
  } catch (error) {
    console.error('获取维修申请附件失败:', error);
    res.status(500).json({ success: false, message: '获取维修申请附件失败', error: error.message });
  }
});

router.get('/requests/:requestId/attachments/:attachmentId/download', authenticate, authorize(RQ_GET_ROLES), async (req, res) => {
  try {
    const result = await requestsService.getRequestAttachment(
      req.params.requestId,
      req.params.attachmentId,
      req,
    );
    if (result.statusCode && result.statusCode !== 200) {
      return res.status(result.statusCode).json(result.body);
    }
    const { attachment } = result.data;
    const fileName = attachment.file_name;
    const asciiFileName = Buffer.from(fileName, 'utf8').toString('latin1');
    const encodedFileName = encodeURIComponent(fileName);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`
    );
    const absolutePath = path.join(__dirname, '../..', attachment.file_path);
    res.download(absolutePath, fileName);
  } catch (error) {
    console.error('下载维修申请附件失败:', error);
    res.status(500).json({ success: false, message: '下载维修申请附件失败', error: error.message });
  }
});

router.delete('/requests/:requestId/attachments/:attachmentId', authenticate, authorize(RQ_WRITE_ROLES), async (req, res) => {
  try {
    const result = await requestsService.deleteRequestAttachment(
      req.params.requestId,
      req.params.attachmentId,
      req
    );
    sendResult(res, result);
  } catch (error) {
    console.error('删除维修申请附件失败:', error);
    res.status(500).json({ success: false, message: '删除维修申请附件失败', error: error.message });
  }
});

router.delete('/requests/:id', authenticate, authorize(RQ_DELETE_ROLES), async (req, res) => {
  try {
    const result = await requestsService.deleteRequest(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceRequestsRouteError('删除故障维修申请失败', error, req, {
      requestId: req.params?.id || null,
    });
    res.status(500).json({ success: false, message: '删除故障维修申请失败', error: error.message });
  }
});

module.exports = router;
