const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { authenticate, authorize } = require('../../middleware/auth');

// 维修日志模块权限集合
const LG_GET_ROLES = ['maintenance.view', 'asset.view_all', 'asset.view_own_department'];
const LG_WRITE_ROLES = ['maintenance.add', 'maintenance.edit', 'asset.edit_all', 'asset.edit_own_department'];
const LG_DELETE_ROLES = ['maintenance.delete', 'maintenance.edit', 'asset.delete_all', 'asset.delete_own_department'];
const { requireTenantId } = require('../../middleware/tenant-filter');
const { fileSecurity } = require('../../middleware/fileSecurity');
const logsService = require('../../services/maintenance/logs.service');

const router = express.Router();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadPath = path.join(__dirname, '../../uploads/maintenance-attachments');
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
    const fileName = `log-${id}-${timestamp}-${random}${ext}`;
    cb(null, fileName);
  },
});

const fileFilter = (req, file, cb) => {
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

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 10,
  },
  fileFilter,
});

const parseFileNameFromRequest = (req, res, next) => {
  req.parsedFileName = null;

  if (req.body && req.body.originalFileName) {
    try {
      req.parsedFileName = decodeURIComponent(req.body.originalFileName);
    } catch (error) {
      console.warn('[文件名解析] 请求体文件名解码失败:', error);
    }
  }

  const contentDisposition = req.headers['content-disposition'];
  if (contentDisposition && !req.parsedFileName) {
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;,\s]+)/i);
    if (utf8Match && utf8Match[1]) {
      try {
        req.parsedFileName = decodeURIComponent(utf8Match[1]);
      } catch (error) {
        console.warn('[文件名解析] RFC 5987 解码失败:', error);
      }
    }

    if (!req.parsedFileName) {
      const rfc2231Match = contentDisposition.match(/filename\*=([^']+)'[^']*'([^;,\s]+)/i);
      if (rfc2231Match && rfc2231Match[2]) {
        try {
          req.parsedFileName = decodeURIComponent(rfc2231Match[2]);
        } catch (error) {
          console.warn('[文件名解析] RFC 2231 解码失败:', error);
        }
      }
    }
  }

  next();
};

const handleMulterError = (err, req, res, next) => {
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

function sendResult(res, result) {
  if (result.statusCode && result.statusCode !== 200) {
    return res.status(result.statusCode).json(result.body);
  }

  if (result.body) {
    return res.json(result.body);
  }

  return res.json(result);
}

router.get('/logs', authenticate, authorize(LG_GET_ROLES), async (req, res) => {
  try {
    const result = await logsService.getLogs(req.query, req);
    res.json(result);
  } catch (error) {
    console.error('获取维护日志列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取维护日志列表失败',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

router.post('/logs', authenticate, requireTenantId, authorize(LG_WRITE_ROLES), async (req, res) => {
  try {
    const result = await logsService.createLog(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('创建维护日志失败:', error);
    res.status(500).json({ success: false, message: '创建维护日志失败', error: error.message });
  }
});

router.put('/logs/:id', authenticate, authorize(LG_WRITE_ROLES), async (req, res) => {
  try {
    const result = await logsService.updateLog(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('更新维护日志失败:', error);
    res.status(500).json({ success: false, message: '更新维护日志失败', error: error.message });
  }
});

router.delete('/logs/:id', authenticate, authorize(LG_DELETE_ROLES), async (req, res) => {
  try {
    const result = await logsService.deleteLog(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('删除维护日志失败:', error);
    res.status(500).json({ success: false, message: '删除维护日志失败', error: error.message });
  }
});

router.get('/logs/:id/attachments', authenticate, authorize(LG_GET_ROLES), async (req, res) => {
  try {
    const result = await logsService.getAttachments(req.params.id, req);
    res.json(result);
  } catch (error) {
    console.error('获取附件列表失败:', error);
    res.status(500).json({ success: false, message: '获取附件列表失败', error: error.message });
  }
});

router.post(
  '/logs/:id/attachments',
  authenticate,
  parseFileNameFromRequest,
  upload.single('file'),
  fileSecurity(),
  handleMulterError,
  async (req, res) => {
    try {
      const result = await logsService.uploadAttachment(req.params.id, req);
      sendResult(res, result);
    } catch (error) {
      console.error('[附件上传] 上传失败:', error);
      if (error.message && error.message.includes('不支持的文件类型')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: '文件大小超过限制（最大50MB）' });
      }
      res.status(500).json({ success: false, message: '上传附件失败', error: error.message });
    }
  },
);

router.get('/logs/:logId/attachments/:attachmentId', authenticate, authorize(LG_GET_ROLES), async (req, res) => {
  try {
    const result = await logsService.getAttachment(req.params.logId, req.params.attachmentId, req);
    if (result.statusCode && result.statusCode !== 200) {
      return res.status(result.statusCode).json(result.body);
    }

    const { attachment, filePath } = result.data;
    if (attachment.file_type && attachment.file_type.startsWith('image/')) {
      res.setHeader('Content-Type', attachment.file_type);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }

    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('获取附件失败:', error);
    res.status(500).json({ success: false, message: '获取附件失败', error: error.message });
  }
});

router.get('/logs/:logId/attachments/:attachmentId/download', authenticate, authorize(LG_GET_ROLES), async (req, res) => {
  try {
    const result = await logsService.getAttachment(req.params.logId, req.params.attachmentId, req);
    if (result.statusCode && result.statusCode !== 200) {
      return res.status(result.statusCode).json(result.body);
    }

    const { attachment, filePath } = result.data;
    const fileName = attachment.file_name;
    const asciiFileName = Buffer.from(fileName, 'utf8').toString('latin1');
    const encodedFileName = encodeURIComponent(fileName);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`,
    );
    res.download(filePath, fileName);
  } catch (error) {
    console.error('下载附件失败:', error);
    res.status(500).json({ success: false, message: '下载附件失败', error: error.message });
  }
});

router.delete('/logs/:logId/attachments/:attachmentId', authenticate, authorize(LG_WRITE_ROLES), async (req, res) => {
  try {
    const result = await logsService.deleteAttachment(req.params.logId, req.params.attachmentId, req);
    sendResult(res, result);
  } catch (error) {
    console.error('删除附件失败:', error);
    res.status(500).json({ success: false, message: '删除附件失败', error: error.message });
  }
});

router.get('/logs/:id', authenticate, authorize(LG_GET_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    if (id && id.includes('attachments')) {
      return res.status(404).json({ success: false, message: '路由匹配错误，请检查路由顺序' });
    }

    const result = await logsService.getLogById(id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取维护日志详情失败:', error);
    res.status(500).json({ success: false, message: '获取维护日志详情失败', error: error.message });
  }
});

router.get('/statistics', authenticate, authorize(LG_GET_ROLES), async (req, res) => {
  try {
    const result = await logsService.getStatistics(req.query, req);
    res.json(result);
  } catch (error) {
    console.error('获取维护统计失败:', error);
    res.status(500).json({ success: false, message: '获取维护统计失败', error: error.message });
  }
});

module.exports = router;
