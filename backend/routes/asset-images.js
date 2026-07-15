const express = require('express');
const router = express.Router();
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');
const { fileSecurity } = require('../middleware/fileSecurity');

const ASSET_IMAGE_ASSET_JOIN =
  'INNER JOIN assets a ON ai.asset_code = a.asset_code AND ai.tenant_id = a.tenant_id AND a.is_deleted = 0';

// 设置文件存储
const storage = multer.diskStorage({
  destination(req, file, cb) {
    // 确保uploads目录存在
    const uploadPath = path.join(__dirname, '../uploads');
    if (!require('fs').existsSync(uploadPath)) {
      require('fs').mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename(req, file, cb) {
    // 生成唯一文件名
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// 文件类型过滤
const fileFilter = (req, file, cb) => {
  // 只允许图片类型
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只支持图片格式（JPG、PNG、GIF、WEBP、BMP等）'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10, // 最多10个文件
  },
});

// 处理 multer 错误
const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error('[Multer错误]', err);
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
  }
  next();
};

// 获取指定资产的所有图片
router.get('/assets/:assetId/images', authenticate, async (req, res) => {
  try {
    const { assetId } = req.params;
    console.log('[获取资产图片] 收到请求，assetId:', assetId);

    // 查询资产信息，支持id和asset.code两种方式，并添加租户过滤
    const tenantFilter = addTenantFilter(req, '');

    // 先尝试通过asset_code查找
    let [assets] = await db.execute(
      `SELECT id, asset_code FROM assets WHERE asset_code = ? ${tenantFilter.whereClause}`,
      [assetId, ...tenantFilter.params],
    );

    // 如果通过asset_code找不到，尝试通过id查找
    if (assets.length === 0) {
      [assets] = await db.execute(
        `SELECT id, asset_code FROM assets WHERE id = ? ${tenantFilter.whereClause}`,
        [assetId, ...tenantFilter.params],
      );
    }

    console.log('[获取资产图片] 查询到的资产:', assets);

    if (assets.length === 0) {
      // 资产不存在或无权限访问，返回空数据
      console.log('[获取资产图片] 未找到资产或无权限访问，assetId:', assetId);
      return res.json({ success: false, message: '未找到资产图片', data: [] });
    }

    const asset = assets[0];
    console.log('[获取资产图片] 选中的资产:', asset);

    const tenantId = getTenantId(req);
    console.log('[获取资产图片] 当前租户ID:', tenantId);

    // 查询资产图片，支持多种关联方式，并添加租户过滤
    // 1. asset_images.asset_code = asset.asset_code
    // 2. asset_images.asset_code = asset.id (转换为字符串)
    // 3. asset_images.asset_code = 直接传入的assetId
    // 添加租户过滤，确保只能访问当前租户的图片
    const [images] = await db.execute(
      `SELECT ai.* FROM asset_images ai
       WHERE (ai.asset_code = ? OR ai.asset_code = ? OR ai.asset_code = CAST(? AS CHAR))
       AND ai.tenant_id = ?`,
      [asset.asset_code, assetId, asset.id, tenantId],
    );

    console.log('[获取资产图片] 查询到的图片:', images);
    console.log('[获取资产图片] SQL参数:', [asset.asset_code, assetId, asset.id, tenantId]);

    // 如果没有找到图片，返回空数组和适当的提示
    if (images.length === 0) {
      console.log('[获取资产图片] 未找到该资产的图片');
      return res.json({
        success: true,
        data: [],
        message: '未找到资产图片',
      });
    }

    res.json({
      success: true,
      data: images,
      message: '获取资产图片成功',
    });
  } catch (err) {
    console.error('获取资产图片失败:', err);
    res.status(500).json({
      success: false,
      message: '获取资产图片失败',
      error: err.message,
    });
  }
});

// 获取所有资产图片（分页）
router.get('/asset-images', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, assetId } = req.query;
    const offset = (page - 1) * limit;

    // 添加租户过滤（通过资产关联）
    const tenantFilter = addTenantFilter(req, 'a');
    let query = `SELECT ai.* FROM asset_images ai
                 ${ASSET_IMAGE_ASSET_JOIN}
                 WHERE 1=1 ${tenantFilter.whereClause}`;
    let countQuery = `SELECT COUNT(*) as count FROM asset_images ai
                      ${ASSET_IMAGE_ASSET_JOIN}
                      WHERE 1=1 ${tenantFilter.whereClause}`;
    const params = [...tenantFilter.params];

    if (assetId) {
      query += ' AND ai.asset_code = ?';
      countQuery += ' AND ai.asset_code = ?';
      params.push(assetId);
    }

    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [images] = await db.execute(query, params);
    const countParams = assetId ? [...tenantFilter.params, assetId] : [...tenantFilter.params];
    const [countResult] = await db.execute(countQuery, countParams);

    res.json({
      success: true,
      data: {
        images,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].count,
          totalPages: Math.ceil(countResult[0].count / limit),
        },
      },
      message: '获取资产图片成功',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: '获取资产图片失败',
      error: err.message,
    });
  }
});

// 上传资产图片（需要认证）
router.post(
  '/assets/:assetId/images',
  authenticate,
  upload.array('images'),
  fileSecurity(),
  handleMulterError,
  async (req, res) => {
    try {
      const { assetId } = req.params;
      console.log('[上传图片] 收到请求，资产ID:', assetId);
      console.log('[上传图片] 文件数量:', req.files?.length || 0);
      console.log('[上传图片] 请求体:', req.body);

      let imageSaveId = assetId;
      const tenantFilter = addTenantFilter(req, '');

      // 先根据assetId查找资产，获取其asset_code字段
      const [assets] = await db.execute(
        `SELECT asset_code, id FROM assets WHERE asset_code = ? ${tenantFilter.whereClause}`,
        [assetId, ...tenantFilter.params],
      );
      if (assets.length === 0) {
        // 如果通过 asset_code 找不到，尝试通过 id 查找
        const [assetsById] = await db.execute(
          `SELECT asset_code, id FROM assets WHERE id = ? ${tenantFilter.whereClause}`,
          [assetId, ...tenantFilter.params],
        );
        if (assetsById.length > 0) {
          imageSaveId = assetsById[0].asset_code || assetsById[0].id;
        } else {
          return res.status(404).json({
            success: false,
            message: `资产不存在：${assetId}`,
          });
        }
      } else {
        imageSaveId = assets[0].asset_code || assets[0].id;
      }

      const { files } = req;
      // 处理 descriptions，可能是数组或单个值
      let descriptions = [];
      if (req.body.descriptions) {
        descriptions = Array.isArray(req.body.descriptions)
          ? req.body.descriptions
          : [req.body.descriptions];
      }

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请选择要上传的图片',
        });
      }

      // 将图片信息保存到数据库
      const imagesData = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const description = descriptions[i] || '';
        // 生成访问URL - 使用相对路径，前端可以通过代理访问
        const fileUrl = `/uploads/${file.filename}`;

        const tenantId = getTenantId(req);
        const [result] = await db.execute(
          'INSERT INTO asset_images (tenant_id, asset_code, file_id, temp_file_url, description) VALUES (?, ?, ?, ?, ?)',
          [tenantId, imageSaveId, file.filename, fileUrl, description],
        );

        imagesData.push({
          id: result.insertId,
          asset_code: imageSaveId,
          file_id: file.filename,
          temp_file_url: fileUrl,
          description,
          created_at: new Date(),
        });
      }

      res.json({
        success: true,
        data: imagesData,
        message: '图片上传成功',
      });
    } catch (err) {
      console.error('[上传图片] 服务器错误:', err);
      console.error('[上传图片] 错误堆栈:', err.stack);
      res.status(500).json({
        success: false,
        message: '图片上传失败',
        error: err.message,
      });
    }
  },
);

// 更新图片描述
router.put('/assets/images/:imageId', authenticate, async (req, res) => {
  try {
    const { imageId } = req.params;
    const { description } = req.body;
    console.log('[更新图片描述] 收到请求，图片ID:', imageId);

    // 描述可以为空字符串，不需要验证

    // 获取当前租户ID
    const tenantId = getTenantId(req);

    // 更新数据库记录，添加租户过滤
    const [result] = await db.execute(
      'UPDATE asset_images SET description = ? WHERE id = ? AND tenant_id = ?',
      [description, imageId, tenantId],
    );
    console.log('[更新图片描述] 更新结果:', result);

    if (result.affectedRows === 0) {
      console.log('[更新图片描述] 图片不存在或无权限访问');
      return res.status(404).json({
        success: false,
        message: '图片不存在',
      });
    }

    res.json({
      success: true,
      message: '图片描述更新成功',
    });
  } catch (err) {
    console.error('[更新图片描述] 失败:', err);
    res.status(500).json({
      success: false,
      message: '更新图片描述失败',
      error: err.message,
    });
  }
});

// 删除资产图片
router.delete('/assets/images/:imageId', authenticate, async (req, res) => {
  try {
    const { imageId } = req.params;
    console.log('[删除图片] 收到请求，图片ID:', imageId);

    // 获取图片信息，只需要验证图片存在且属于当前租户，不需要关联assets表
    const tenantId = getTenantId(req);
    const [images] = await db.execute(
      'SELECT ai.* FROM asset_images ai WHERE ai.id = ? AND ai.tenant_id = ?',
      [imageId, tenantId],
    );

    console.log('[删除图片] 查询到的图片:', images);

    if (images.length === 0) {
      console.log('[删除图片] 图片不存在或无权限访问');
      return res.status(404).json({
        success: false,
        message: '图片不存在',
      });
    }

    // 删除数据库记录
    await db.execute('DELETE FROM asset_images WHERE id = ? AND tenant_id = ?', [
      imageId,
      tenantId,
    ]);
    console.log('[删除图片] 数据库记录已删除');

    // 删除本地文件
    const fs = require('fs');
    const filePath = path.join(__dirname, '../uploads', images[0].file_id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('[删除图片] 本地文件已删除:', filePath);
    } else {
      console.log('[删除图片] 本地文件不存在，跳过删除:', filePath);
    }

    res.json({
      success: true,
      message: '图片删除成功',
    });
  } catch (err) {
    console.error('[删除图片] 失败:', err);
    res.status(500).json({
      success: false,
      message: '图片删除失败',
      error: err.message,
    });
  }
});

module.exports = router;
