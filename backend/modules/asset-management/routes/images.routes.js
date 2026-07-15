const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../../../config/database');
const { authenticate } = require('../../../middleware/auth');
const { addTenantFilter, getTenantId } = require('../../../middleware/tenant-filter');
const { fileSecurity } = require('../../../middleware/fileSecurity');
const logger = require('../../../config/logger');

const router = express.Router();

const ASSET_IMAGE_ASSET_JOIN =
  'INNER JOIN assets a ON ai.asset_code = a.asset_code AND ai.tenant_id = a.tenant_id AND a.is_deleted = 0';

const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${suffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只支持图片格式（JPG、PNG、GIF、WEBP、BMP等）'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

const handleMulterError = (err, _req, res, next) => {
  if (!err) return next();
  logger.error('[Multer错误]', { message: err.message, code: err.code });
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: '文件大小超过限制（最大10MB）' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ success: false, message: '文件数量超过限制（最多10个）' });
  }
  if (err.message && err.message.includes('只支持图片格式')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  return res.status(400).json({ success: false, message: `文件上传失败: ${err.message}` });
};

const resolveAssetIdOrCode = async (idOrCode, tenantId) => {
  if (!idOrCode) return null;
  const raw = String(idOrCode).trim();
  if (!raw) return null;

  let [rows] = await db.execute(
    `SELECT id, asset_code FROM assets WHERE asset_code = ? AND tenant_id = ? AND is_deleted = 0 LIMIT 1`,
    [raw, tenantId],
  );
  if (rows.length > 0) return rows[0];

  if (/^\d+$/.test(raw)) {
    [rows] = await db.execute(
      `SELECT id, asset_code FROM assets WHERE id = ? AND tenant_id = ? AND is_deleted = 0 LIMIT 1`,
      [Number.parseInt(raw, 10), tenantId],
    );
    if (rows.length > 0) return rows[0];
  }
  return null;
};

// GET /:assetCode/images
router.get('/:assetCode/images', authenticate, async (req, res) => {
  try {
    const { assetCode } = req.params;
    const tenantId = getTenantId(req);
    const asset = await resolveAssetIdOrCode(assetCode, tenantId);
    if (!asset) {
      return res.json({ success: true, data: [], message: '资产不存在或无权限访问' });
    }

    const [images] = await db.execute(
      `SELECT ai.* FROM asset_images ai
       WHERE ai.asset_code = ? AND ai.tenant_id = ?
       ORDER BY ai.id DESC`,
      [asset.asset_code, tenantId],
    );

    res.json({ success: true, data: images, message: '获取资产图片成功' });
  } catch (error) {
    logger.error('获取资产图片失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取资产图片失败', error: error.message });
  }
});

// POST /:assetCode/images
router.post(
  '/:assetCode/images',
  authenticate,
  upload.array('images'),
  fileSecurity(),
  handleMulterError,
  async (req, res) => {
    try {
      const { assetCode } = req.params;
      const tenantId = getTenantId(req);
      const asset = await resolveAssetIdOrCode(assetCode, tenantId);
      if (!asset) {
        return res.status(404).json({ success: false, message: `资产不存在：${assetCode}` });
      }

      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).json({ success: false, message: '请选择要上传的图片' });
      }

      let descriptions = [];
      if (req.body.descriptions) {
        descriptions = Array.isArray(req.body.descriptions)
          ? req.body.descriptions
          : [req.body.descriptions];
      }

      const imagesData = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const description = descriptions[i] || '';
        const fileUrl = `/uploads/${file.filename}`;

        const [result] = await db.execute(
          'INSERT INTO asset_images (tenant_id, asset_code, file_id, temp_file_url, description) VALUES (?, ?, ?, ?, ?)',
          [tenantId, asset.asset_code, file.filename, fileUrl, description],
        );

        imagesData.push({
          id: result.insertId,
          asset_code: asset.asset_code,
          file_id: file.filename,
          temp_file_url: fileUrl,
          description,
          created_at: new Date(),
        });
      }

      res.json({ success: true, data: imagesData, message: '图片上传成功' });
    } catch (error) {
      logger.error('上传资产图片失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '图片上传失败', error: error.message });
    }
  },
);

// PUT /images/:imageId
router.put('/images/:imageId', authenticate, async (req, res) => {
  try {
    const { imageId } = req.params;
    const { description } = req.body;
    const tenantId = getTenantId(req);

    const [result] = await db.execute(
      'UPDATE asset_images SET description = ? WHERE id = ? AND tenant_id = ?',
      [description ?? '', imageId, tenantId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '图片不存在' });
    }

    res.json({ success: true, message: '图片描述更新成功' });
  } catch (error) {
    logger.error('更新图片描述失败', { error: error.message });
    res.status(500).json({ success: false, message: '更新图片描述失败', error: error.message });
  }
});

// GET /images/:imageId/view - 后端统一代理查看图片
router.get('/images/:imageId/view', authenticate, async (req, res) => {
  try {
    const { imageId } = req.params;
    const tenantId = getTenantId(req);

    const [images] = await db.execute(
      'SELECT * FROM asset_images WHERE id = ? AND tenant_id = ?',
      [imageId, tenantId],
    );

    if (images.length === 0) {
      return res.status(404).json({ success: false, message: '图片不存在' });
    }

    const image = images[0];
    const imagePath = image.temp_file_url || image.file_id || '';

    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
    };

    const sendLocalFile = localPath => {
      if (!fs.existsSync(localPath)) {
        return res.status(404).json({ success: false, message: '图片文件不存在' });
      }
      const ext = path.extname(localPath).toLowerCase();
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return fs.createReadStream(localPath).pipe(res);
    };

    // 本地 /uploads/ 路径
    if (imagePath.startsWith('/uploads/')) {
      return sendLocalFile(path.join(uploadDir, path.basename(imagePath)));
    }

    // 已可直接访问的 HTTP(S) 链接
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return res.redirect(imagePath);
    }

    // cloud:// 等私有协议：尝试按对象路径在本地查找缓存
    if (imagePath.includes('://')) {
      const protocolEnd = imagePath.indexOf('/', imagePath.indexOf('://') + 3);
      const objectPath = protocolEnd > 0 ? imagePath.slice(protocolEnd + 1) : '';
      if (objectPath) {
        const cachedPath = path.join(uploadDir, objectPath);
        if (fs.existsSync(cachedPath)) {
          return sendLocalFile(cachedPath);
        }
      }
      return res.status(404).json({ success: false, message: '该图片暂不支持 Web 端预览' });
    }

    return res.status(404).json({ success: false, message: '图片地址无效' });
  } catch (error) {
    logger.error('查看图片失败', { error: error.message });
    res.status(500).json({ success: false, message: '查看图片失败', error: error.message });
  }
});

// DELETE /images/:imageId
router.delete('/images/:imageId', authenticate, async (req, res) => {
  try {
    const { imageId } = req.params;
    const tenantId = getTenantId(req);

    const [images] = await db.execute(
      'SELECT file_id FROM asset_images WHERE id = ? AND tenant_id = ?',
      [imageId, tenantId],
    );
    if (images.length === 0) {
      return res.status(404).json({ success: false, message: '图片不存在' });
    }

    await db.execute('DELETE FROM asset_images WHERE id = ? AND tenant_id = ?', [imageId, tenantId]);

    // 异步尝试删除磁盘文件，不影响主流程
    if (images[0].file_id) {
      try {
        const filePath = path.join(uploadDir, images[0].file_id);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (fileErr) {
        logger.warn('删除图片文件失败', { fileErr: fileErr.message });
      }
    }

    res.json({ success: true, message: '图片删除成功' });
  } catch (error) {
    logger.error('删除图片失败', { error: error.message });
    res.status(500).json({ success: false, message: '删除图片失败', error: error.message });
  }
});

module.exports = router;
