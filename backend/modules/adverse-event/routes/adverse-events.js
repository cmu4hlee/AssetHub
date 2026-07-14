const express = require('express');
const router = express.Router();
const adverseEventController = require('../controllers/adverse-event.controller');
const { authenticate } = require('../../../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const iconv = require('iconv-lite');
const { fileSecurity } = require('../../../middleware/fileSecurity');
const db = require('../../../config/database');

const sanitizeUploadFileName = value =>
  String(value || '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .split('')
    .map(char => (char.charCodeAt(0) < 32 ? '_' : char))
    .join('');

// 设置文件存储
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadPath = path.join(__dirname, '../../../uploads/adverse-reaction');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename(req, file, cb) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const uuidFragment = crypto.randomBytes(4).toString('hex');

    let originalFileName = null;
    if (req.parsedFileName) {
      originalFileName = req.parsedFileName;
    } else {
      originalFileName = file.originalname;

      const hasChinese = /[\u4e00-\u9fa5]/.test(originalFileName);
      const hasReplacementChar = originalFileName.includes('') || originalFileName.includes('?');
      const hasLatin1Mojibake = /[çåéè£æé«º¾´¨]/i.test(originalFileName);

      if (!hasChinese && (hasReplacementChar || hasLatin1Mojibake)) {
        try {
          const latin1Buffer = Buffer.from(originalFileName, 'latin1');
          const utf8Decoded = latin1Buffer.toString('utf8');
          if (/[\u4e00-\u9fa5]/.test(utf8Decoded)) {
            originalFileName = utf8Decoded;
          } else {
            const encodings = ['gbk', 'gb2312', 'gb18030'];
            for (const encoding of encodings) {
              try {
                const decoded = iconv.decode(latin1Buffer, encoding);
                if (/[\u4e00-\u9fa5]/.test(decoded)) {
                  originalFileName = decoded;
                  break;
                }
              } catch (e) {
                // 继续尝试下一个编码
              }
            }
          }
        } catch (e) {
          // 忽略编码错误
        }
      }
    }

    const ext = path.extname(originalFileName);
    let baseName = path.basename(originalFileName, ext);
    baseName = sanitizeUploadFileName(baseName);
    if (baseName.length > 100) {
      baseName = baseName.substring(0, 100);
    }

    const fileName = `ar-${timestamp}-${random}-${uuidFragment}-${baseName}${ext}`;
    const uploadPath = path.join(__dirname, '../../../uploads/adverse-reaction');
    let finalFileName = fileName;
    let counter = 1;

    while (fs.existsSync(path.join(uploadPath, finalFileName))) {
      const nameWithoutExt = path.basename(fileName, ext);
      finalFileName = `${nameWithoutExt}_${counter}${ext}`;
      counter++;
      if (counter > 1000) {
        finalFileName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
        break;
      }
    }

    cb(null, finalFileName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10,
  },
});

// 文件名解析中间件
const parseFileNameFromRequest = (req, res, next) => {
  req.parsedFileName = null;

  if (req.body && req.body.originalFileName) {
    try {
      const decoded = decodeURIComponent(req.body.originalFileName);
      req.parsedFileName = decoded;
    } catch (e) {
      // 忽略解码错误
    }
  }

  const contentDisposition = req.headers['content-disposition'];
  if (contentDisposition && !req.parsedFileName) {
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;,\s]+)/i);
    if (utf8Match) {
      try {
        const decoded = decodeURIComponent(utf8Match[1]);
        req.parsedFileName = decoded;
      } catch (e) {
        // 忽略解码错误
      }
    }

    if (!req.parsedFileName) {
      const rfc2231Match = contentDisposition.match(/filename\*=([^']+)'[^']*'([^;,\s]+)/i);
      if (rfc2231Match) {
        try {
          const charset = rfc2231Match[1].toLowerCase();
          const encoded = rfc2231Match[2];
          const decoded = decodeURIComponent(encoded);
          req.parsedFileName = decoded;
        } catch (e) {
          // 忽略解码错误
        }
      }
    }
  }

  next();
};

// ==================== 不良事件管理 ====================

// 获取不良事件记录列表
router.get('/', authenticate, adverseEventController.getAdverseEvents);

// ==================== 统计和提醒（必须放在 /:id 之前） ====================

// 获取统计数据（必须在 /:id 路由之前定义）
router.get('/statistics/overview', authenticate, adverseEventController.getStatistics);

// 按科室统计
router.get('/statistics/by-department', authenticate, adverseEventController.getStatisticsByDepartment);

// 按资产统计 TOP N
router.get('/statistics/by-asset', authenticate, adverseEventController.getStatisticsByAsset);

// 处理效率统计
router.get('/statistics/handle-efficiency', authenticate, adverseEventController.getHandleEfficiency);

// 获取超时提醒列表（必须在 /:id 路由之前定义）
router.get('/alerts/overdue', authenticate, adverseEventController.getOverdueAlerts);

// ==================== 单个记录操作 ====================

// 获取单个不良事件记录详情
router.get('/:id', authenticate, adverseEventController.getAdverseEventById);

// 创建设备
router.post('/', authenticate, adverseEventController.createAdverseEvent);

// 更新设备
router.put('/:id', authenticate, adverseEventController.updateAdverseEvent);

// 删除设备
router.delete('/:id', authenticate, adverseEventController.deleteAdverseEvent);

// ==================== 审批和工作流 ====================

// 审批不良事件
router.post('/:id/approve', authenticate, adverseEventController.approveAdverseEvent);

// 关闭不良事件
router.post('/:id/close', authenticate, adverseEventController.closeAdverseEvent);

// 获取工作流记录
router.get('/:id/workflow', authenticate, adverseEventController.getWorkflow);

// ==================== 附件管理 ====================

// 上传不良事件附件
router.post(
  '/:id/attachments',
  authenticate,
  parseFileNameFromRequest,
  upload.array('files', 10),
  fileSecurity(),
  async (req, res) => {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '缺少租户ID' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要上传的文件' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 检查记录是否存在
      const [existing] = await connection.execute(
        'SELECT id FROM adverse_reaction_records WHERE id = ? AND tenant_id = ?',
        [id, tenantId],
      );

      if (existing.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: '不良事件记录不存在' });
      }

      const attachments = [];
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        let fileName = null;
        if (req.body && req.body.originalFileName) {
          try {
            const originalFileNameValue = Array.isArray(req.body.originalFileName)
              ? req.body.originalFileName[i]
              : req.body.originalFileName;
            if (originalFileNameValue) {
              fileName = decodeURIComponent(originalFileNameValue);
            }
          } catch (e) {
            // 忽略解码错误
          }
        }

        if (!fileName) {
          fileName = req.parsedFileName || file.originalname;
        }

        // 确保文件名安全
        fileName = sanitizeUploadFileName(fileName);

        const [result] = await connection.execute(
          `INSERT INTO adverse_reaction_attachments (tenant_id, record_id, file_name, file_path, file_size, file_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            tenantId,
            id,
            fileName,
            `/uploads/adverse-reaction/${file.filename}`,
            file.size,
            file.mimetype,
          ],
        );
        attachments.push({
          id: result.insertId,
          file_name: fileName,
          file_path: `/uploads/adverse-reaction/${file.filename}`,
          file_size: file.size,
          file_type: file.mimetype,
        });
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: `成功上传 ${attachments.length} 个文件`,
        data: attachments,
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      res.status(500).json({ success: false, message: '上传失败', error: error.message });
    }
  },
);

// 删除不良事件附件
router.delete('/attachments/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

  if (!tenantId) {
    return res.status(400).json({ success: false, message: '缺少租户ID' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 获取附件信息
    const [attachments] = await connection.execute(
      'SELECT * FROM adverse_reaction_attachments WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (attachments.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '附件不存在' });
    }

    const attachment = attachments[0];

    // 删除文件
    const filePath = path.join(
      __dirname,
      '../../..',
      attachment.file_path.replace('/uploads/', 'uploads/'),
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 删除数据库记录
    await connection.execute('DELETE FROM adverse_reaction_attachments WHERE id = ? AND tenant_id = ?', [
      id,
      tenantId,
    ]);

    await connection.commit();
    connection.release();

    res.json({ success: true, message: '附件删除成功' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    res.status(500).json({ success: false, message: '删除附件失败', error: error.message });
  }
});

module.exports = router;
