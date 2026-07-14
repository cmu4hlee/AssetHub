const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { logAudit } = require('../middleware/auditLogger');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const iconv = require('iconv-lite');
const { fileSecurity } = require('../middleware/fileSecurity');
const { FileValidator } = require('../utils/file-validator');

const sanitizeUploadFileName = value =>
  String(value || '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .split('')
    .map(char => (char.charCodeAt(0) < 32 ? '_' : char))
    .join('');

// 设置文件存储
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/technical-documents');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename(req, file, cb) {
    // 生成文件名：时间戳-随机数-原始文件名
    // 使用更安全的唯一标识符：时间戳 + 随机数 + UUID片段
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const uuidFragment = crypto.randomBytes(4).toString('hex'); // 8位十六进制字符串

    // 优先使用预解析的文件名（从请求体或请求头提取，已正确处理编码）
    let originalFileName = null;
    if (req.parsedFileName) {
      originalFileName = req.parsedFileName;
      console.log(`[multer filename] ✅ 使用预解析的文件名: ${originalFileName}`);
    } else {
      // 使用 multer 解析的文件名，需要修复编码
      originalFileName = file.originalname;
      console.log(`[multer filename] ⚠️ 使用 multer 解析的文件名: ${originalFileName}`);

      // 检测乱码：如果文件名不包含中文，但包含乱码字符，尝试修复编码
      const hasChinese = /[\u4e00-\u9fa5]/.test(originalFileName);
      const hasReplacementChar = originalFileName.includes('\uFFFD');
      // 检测常见的 UTF-8 被误解释为 Latin1 的乱码字符
      const hasLatin1Mojibake = /[çåéè£æé«º¾´¨]/i.test(originalFileName);

      if (!hasChinese && (hasReplacementChar || hasLatin1Mojibake)) {
        console.log('[multer filename] 检测到文件名可能乱码，开始修复...');
        console.log(`[multer filename] 原始文件名: ${originalFileName}`);
        console.log(
          `[multer filename] 原始文件名 (latin1 hex): ${Buffer.from(originalFileName, 'latin1').toString('hex')}`,
        );

        try {
          // 将乱码字符串视为 Latin1 字节，然后用 UTF-8 解码
          const latin1Buffer = Buffer.from(originalFileName, 'latin1');
          const utf8Decoded = latin1Buffer.toString('utf8');
          console.log(`[multer filename] UTF-8 解码结果: ${utf8Decoded}`);

          // 检查解码结果是否包含有效的中文字符
          if (/[\u4e00-\u9fa5]/.test(utf8Decoded)) {
            originalFileName = utf8Decoded;
            console.log(`[multer filename] ✅ UTF-8 解码成功: ${originalFileName}`);
          } else {
            // 尝试 Windows 中文编码
            const encodings = ['gbk', 'gb2312', 'gb18030'];
            for (const encoding of encodings) {
              try {
                const decoded = iconv.decode(latin1Buffer, encoding);
                console.log(`[multer filename] ${encoding} 解码结果: ${decoded}`);
                if (/[\u4e00-\u9fa5]/.test(decoded)) {
                  originalFileName = decoded;
                  console.log(
                    `[multer filename] ✅ 使用 ${encoding} 编码成功: ${originalFileName}`,
                  );
                  break;
                }
              } catch (e) {
                // 继续尝试下一个编码
              }
            }
          }
        } catch (e) {
          console.warn('[multer filename] 编码修复失败:', e);
        }
      }
    }

    const ext = path.extname(originalFileName);
    let baseName = path.basename(originalFileName, ext);

    // 移除特殊字符，但保留中文、字母、数字、下划线、连字符
    baseName = sanitizeUploadFileName(baseName);

    // 限制文件名长度（避免文件名过长）
    if (baseName.length > 100) {
      baseName = baseName.substring(0, 100);
    }

    // 生成文件名：时间戳-随机数-UUID片段-原始文件名
    // 这样可以最大程度避免重复，即使时间戳和随机数相同，UUID片段也不同
    const fileName = `${timestamp}-${random}-${uuidFragment}-${baseName}${ext}`;

    // 检查文件是否已存在（虽然概率极低，但为了安全起见）
    const uploadPath = path.join(__dirname, '../uploads/technical-documents');
    let finalFileName = fileName;
    let counter = 1;

    while (fs.existsSync(path.join(uploadPath, finalFileName))) {
      console.log(`[multer filename] ⚠️ 文件名已存在: ${finalFileName}，尝试添加序号`);
      const nameWithoutExt = path.basename(fileName, ext);
      finalFileName = `${nameWithoutExt}_${counter}${ext}`;
      counter++;

      // 防止无限循环（理论上不应该发生）
      if (counter > 1000) {
        console.error('[multer filename] ❌ 文件名冲突过多，使用纯UUID');
        finalFileName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
        break;
      }
    }

    console.log(`[multer filename] 最终存储的文件名: ${finalFileName}`);
    cb(null, finalFileName);
  },
});

// 文件过滤器：允许所有常见文档类型
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // 图片类型
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    // 文档类型
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown',
    // 压缩文件
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    // 其他
    'application/octet-stream',
  ];

  // 也检查文件扩展名作为备用
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = [
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.txt',
    '.md',
    '.zip',
    '.rar',
    '.7z',
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
  ];

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}。只支持常见文档和图片格式。`), false);
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

const buildManagedDepartmentDocumentScope = (req, documentAlias = 'td') => {
  if (
    req.user.role !== 'asset_admin' ||
    !Array.isArray(req.user.managed_departments) ||
    req.user.managed_departments.length === 0 ||
    req.user.managed_departments.includes('*')
  ) {
    return { clause: '', params: [] };
  }

  const tenantId = getTenantId(req);
  if (!tenantId) {
    return { clause: ' AND 1 = 0', params: [] };
  }

  const departmentIdsToFilter = req.user.managed_departments;
  const placeholders = departmentIdsToFilter.map(() => '?').join(',');

  return {
    clause: ` AND EXISTS (
      SELECT 1 FROM technical_document_asset_relations tdar
      INNER JOIN assets a ON tdar.asset_code = a.asset_code AND a.tenant_id = ?
      WHERE tdar.document_id = ${documentAlias}.id AND (
        a.department IN (
          SELECT department_name FROM departments WHERE tenant_id = ? AND department_code IN (${placeholders})
        ) OR a.department_new IN (${placeholders})
      )
    )`,
    params: [tenantId, tenantId, ...departmentIdsToFilter, ...departmentIdsToFilter],
  };
};

const fetchScopedAssetDocuments = async (assetIdOrCode, tenantId) => {
  const isNumeric = /^\d+$/.test(assetIdOrCode);
  const assetCondition = isNumeric ? '(a.id = ? OR a.asset_code = ?)' : 'a.asset_code = ?';
  const assetParams = isNumeric ? [parseInt(assetIdOrCode, 10), assetIdOrCode] : [assetIdOrCode];

  const [rows] = await db.execute(
    `SELECT td.*,
      '直接关联' as link_type
     FROM assets a
     JOIN technical_document_asset_relations tdar ON a.asset_code = tdar.asset_code
     JOIN technical_documents td ON td.id = tdar.document_id AND td.tenant_id = a.tenant_id
     WHERE td.status != ?
       AND a.tenant_id = ?
       AND ${assetCondition}
     GROUP BY td.id
     ORDER BY td.upload_date DESC`,
    ['deleted', tenantId, ...assetParams],
  );

  const [assets] = await db.execute(
    `SELECT id, asset_code, asset_name, brand, model
     FROM assets a
     WHERE ${assetCondition} AND a.tenant_id = ?
     LIMIT 1`,
    [...assetParams, tenantId],
  );

  return {
    rows,
    asset: assets[0] || null,
  };
};

const normalizeAssetCodes = values => {
  if (!Array.isArray(values)) {
    return null;
  }

  const normalized = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    if (!normalized.includes(trimmed)) {
      normalized.push(trimmed);
    }
  }

  return normalized;
};

const parseAssetCodesInput = rawValue => {
  if (rawValue === undefined) {
    return { provided: false, values: [] };
  }

  if (rawValue == null) {
    return { provided: true, values: [] };
  }

  if (Array.isArray(rawValue)) {
    return { provided: true, values: rawValue };
  }

  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) {
        return { provided: true, invalid: true };
      }
      return { provided: true, values: parsed };
    } catch (error) {
      return { provided: true, invalid: true };
    }
  }

  return { provided: true, invalid: true };
};

const parsePositiveInteger = value => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    return parsed > 0 ? parsed : null;
  }

  return null;
};

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.httpStatus = status;
  return error;
};

const cleanupUploadedFile = file => {
  if (!file || !file.path) {
    return;
  }

  try {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch (error) {
    console.warn('[上传处理] 清理临时文件失败:', error.message);
  }
};

const cleanupStoredDocumentFile = relativeFilePath => {
  if (!relativeFilePath) {
    return;
  }

  const absolutePath = path.join(__dirname, '..', relativeFilePath);
  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    console.warn('[技术资料删除] 清理文件失败:', error.message);
  }
};

// 文件名解析中间件（处理中文文件名，在 multer 处理之前）
// 注意：对于 multipart/form-data，req.body 在 multer 处理之前是空的
// 所以我们需要使用 busboy 或 multer 的字段处理，或者从请求头中提取
const parseFileNameFromRequest = (req, res, next) => {
  req.parsedFileName = null;

  // 方法1: 从请求体的 originalFileName 字段获取（前端发送的备用字段）
  // 注意：对于 multipart/form-data，这可能在 multer 处理之后才可用
  if (req.body && req.body.originalFileName) {
    try {
      const decoded = decodeURIComponent(req.body.originalFileName);
      req.parsedFileName = decoded;
      console.log(`[文件名解析] ✅ 从请求体获取文件名: ${req.parsedFileName}`);
    } catch (e) {
      console.warn('[文件名解析] 请求体文件名解码失败:', e);
    }
  }

  // 方法2: 从 Content-Disposition 头中提取（在 multer 处理之前）
  const contentDisposition = req.headers['content-disposition'];
  if (contentDisposition && !req.parsedFileName) {
    console.log(`[文件名解析] Content-Disposition: ${contentDisposition}`);

    // 优先尝试 RFC 5987 格式：filename*=UTF-8''encoded
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;,\s]+)/i);
    if (utf8Match && utf8Match[1]) {
      try {
        const decoded = decodeURIComponent(utf8Match[1]);
        req.parsedFileName = decoded;
        console.log(
          `[文件名解析] ✅ 从 Content-Disposition (RFC 5987) 提取: ${req.parsedFileName}`,
        );
      } catch (e) {
        console.warn('[文件名解析] RFC 5987 解码失败:', e);
      }
    }

    // 如果没有找到，尝试 RFC 2231 格式：filename*=charset'lang'encoded
    if (!req.parsedFileName) {
      const rfc2231Match = contentDisposition.match(/filename\*=([^']+)'[^']*'([^;,\s]+)/i);
      if (rfc2231Match && rfc2231Match[2]) {
        try {
          const charset = rfc2231Match[1].toLowerCase();
          const encoded = rfc2231Match[2];
          const decoded = decodeURIComponent(encoded);
          req.parsedFileName = decoded;
          console.log(
            `[文件名解析] ✅ 从 Content-Disposition (RFC 2231, ${charset}) 提取: ${req.parsedFileName}`,
          );
        } catch (e) {
          console.warn('[文件名解析] RFC 2231 解码失败:', e);
        }
      }
    }
  }

  next();
};

// 处理 multer 错误
const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error('[Multer错误]', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: '文件大小超过限制（最大10MB）' });
    }
    return res.status(400).json({ success: false, message: err.message || '文件上传失败' });
  }
  next();
};

// ==================== 技术资料管理 ====================

/**
 * @swagger
 * /api/technical-documents:
 *   get:
 *     tags:
 *       - 技术资料管理
 *     summary: 获取技术资料列表
 *     description: 获取技术资料列表，支持分页、关键词搜索、分类筛选等
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
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 关键词搜索（标题、描述、文件名）
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: 分类筛选
 *       - in: query
 *         name: asset_type
 *         schema:
 *           type: string
 *         description: 资产类型筛选
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         description: 品牌筛选
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, archived, deleted]
 *           default: active
 *         description: 状态筛选
 *       - in: query
 *         name: review_status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: 审核状态筛选（不指定时，active 状态默认只显示 approved）
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
 *                         $ref: '#/components/schemas/TechnicalDocument'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationResponse'
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// 获取技术资料列表
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      category,
      asset_type,
      brand,
      asset_code,
      status = 'active',
    } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE td.status = ?';
    const params = [status];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'td');
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    /**
     * 审核状态筛选逻辑
     *
     * 业务规则：
     * 1. 如果明确指定了 review_status 参数，按指定状态筛选
     * 2. 如果查询活跃状态（status='active'）且未指定审核状态：
     *    - 默认只显示审核通过的资料（review_status='approved'）
     *    - 这样可以避免在列表中显示待审核或已拒绝的资料
     * 3. 在资产详情页，会显示所有状态的资料（包括待审核），但待审核的资料不能下载
     *
     * 审核状态说明：
     * - pending：待审核（新上传的资料）
     * - approved：已通过（可以关联和使用）
     * - rejected：已拒绝（不能关联和使用）
     */
    const { review_status } = req.query;
    if (review_status) {
      // 明确指定审核状态，按指定状态筛选
      whereClause += ' AND td.review_status = ?';
      params.push(review_status);
    } else if (status === 'active') {
      // 如果查询活跃状态且未指定审核状态，只显示审核通过的资料
      // 这样可以避免在列表中显示待审核或已拒绝的资料
      whereClause += ' AND td.review_status = ?';
      params.push('approved');
    }

    if (keyword) {
      whereClause += ' AND (td.title LIKE ? OR td.description LIKE ? OR td.file_name LIKE ?)';
      const keywordParam = `%${keyword}%`;
      params.push(keywordParam, keywordParam, keywordParam);
    }

    if (category) {
      whereClause += ' AND td.category = ?';
      params.push(category);
    }

    if (asset_type) {
      whereClause += ' AND td.asset_type = ?';
      params.push(asset_type);
    }

    if (brand) {
      whereClause += ' AND td.brand = ?';
      params.push(brand);
    }

    // 按资产编码筛选（包括直接关联和通过品牌型号匹配）
    if (asset_code) {
      // 先获取资产信息（需要验证资产属于同一租户）
      const assetTenantFilter = addTenantFilter(req, 'a');
      // 检查asset_code是否为数字
      const isNumeric = /^\d+$/.test(asset_code);

      // 根据类型构建查询条件
      let assetQuery;
      let assetParams;

      if (isNumeric) {
        // 如果是数字，尝试通过id或asset_code查找
        assetQuery = `SELECT a.id, a.asset_code, a.asset_name, a.brand, a.model FROM assets a WHERE (a.id = ? OR a.asset_code = ?) ${assetTenantFilter.whereClause}`;
        assetParams = [parseInt(asset_code), asset_code, ...assetTenantFilter.params];
      } else {
        // 如果是字符串，只尝试通过asset_code查找
        assetQuery = `SELECT a.id, a.asset_code, a.asset_name, a.brand, a.model FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`;
        assetParams = [asset_code, ...assetTenantFilter.params];
      }

      const [assets] = await db.execute(assetQuery, assetParams);

      if (assets.length > 0) {
        const asset = assets[0];
        // 查找直接关联该资产的资料
        // 使用中间表技术资料与资产的多对多关联关系
        whereClause +=
          ' AND td.id IN (SELECT document_id FROM technical_document_asset_relations WHERE asset_code = ? AND tenant_id = ?)';
        params.push(asset.asset_code, tenantId);
      }
    }

    // 资产管理员只能查看自己管理科室的资产相关的技术资料
    const managedDepartmentScope = buildManagedDepartmentDocumentScope(req);
    whereClause += managedDepartmentScope.clause;
    params.push(...managedDepartmentScope.params);

    // 获取总数
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM technical_documents td ${whereClause}`,
      params,
    );
    const { total } = countRows[0];

    // 获取数据（不关联资产信息，关联信息从中间表获取）
    const [rows] = await db.execute(
      `SELECT td.*
       FROM technical_documents td
       ${whereClause}
       ORDER BY td.upload_date DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    // 构建文件访问URL
    const documents = rows.map(doc => ({
      ...doc,
      file_url: `${req.protocol}://${req.get('host')}/api/technical-documents/${doc.id}/file`,
    }));

    res.json({
      success: true,
      data: documents,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取技术资料列表失败:', error);
    res.status(500).json({ success: false, message: '获取技术资料列表失败', error: error.message });
  }
});

// 获取技术资料分类列表
router.get('/categories', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '租户ID不能为空' });
    }

    const [rows] = await db.execute(
      `SELECT td.category, COUNT(*) as count
       FROM technical_documents td
       WHERE td.tenant_id = ? AND td.category IS NOT NULL AND td.category != '' AND td.status != 'deleted'
       GROUP BY td.category
       ORDER BY td.category`,
      [tenantId],
    );

    res.json({
      success: true,
      data: rows,
      message: '获取技术资料分类成功',
    });
  } catch (error) {
    console.error('获取技术资料分类失败:', error);
    res
      .status(500)
      .json({ success: false, message: '获取技术资料分类失败', error: error.message });
  }
});

// 获取单个技术资料详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'td');
    let whereClause = `WHERE td.id = ? ${tenantFilter.whereClause}`;
    const params = [id, ...tenantFilter.params];

    // 资产管理员只能查看自己管理科室的资产相关的技术资料
    const managedDepartmentScope = buildManagedDepartmentDocumentScope(req);
    whereClause += managedDepartmentScope.clause;
    params.push(...managedDepartmentScope.params);

    const [rows] = await db.execute(
      `SELECT td.*
       FROM technical_documents td
       ${whereClause}`,
      params,
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '技术资料不存在' });
    }

    const doc = rows[0];

    // 不再使用 asset_ids 字段，已迁移到中间表 technical_document_asset_relations
    // 如果需要获取关联的资产列表，应该查询中间表

    // 增加查看次数（验证租户）
    await db.execute(
      `UPDATE technical_documents td SET td.view_count = td.view_count + 1 WHERE td.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    res.json({
      success: true,
      data: {
        ...doc,
        file_url: `${req.protocol}://${req.get('host')}/api/technical-documents/${id}/file`,
      },
    });
  } catch (error) {
    console.error('获取技术资料详情失败:', error);
    res.status(500).json({ success: false, message: '获取技术资料详情失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/technical-documents:
 *   post:
 *     tags:
 *       - 技术资料管理
 *     summary: 上传技术资料
 *     description: 上传技术资料文件，支持单个资产关联或多个资产关联。新上传的资料默认状态为 pending（待审核）
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - title
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: 技术资料文件
 *               title:
 *                 type: string
 *                 example: CT设备操作手册
 *                 description: 资料标题（必填）
 *               description:
 *                 type: string
 *                 description: 资料描述
 *               category:
 *                 type: string
 *                 enum: [使用手册, 维修手册, 技术规范, 操作指南, 其他]
 *                 description: 资料分类
 *               asset_type:
 *                 type: string
 *                 description: 资产类型
 *               brand:
 *                 type: string
 *                 description: 品牌
 *               model:
 *                 type: string
 *                 description: 型号
 *               version:
 *                 type: string
 *                 description: 版本号
 *               language:
 *                 type: string
 *                 default: zh-CN
 *                 description: 语言
 *               asset_code:
 *                 type: string
 *                 description: 单个资产编码（关联单个资产）
 *               asset_codes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 多个资产编码数组（关联多个资产）
 *               is_public:
 *                 type: boolean
 *                 default: false
 *                 description: 是否公开
 *     responses:
 *       200:
 *         description: 上传成功
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
 *                         title:
 *                           type: string
 *                         file_name:
 *                           type: string
 *                         file_path:
 *                           type: string
 *                         file_url:
 *                           type: string
 *       400:
 *         description: 请求参数错误（如文件为空、标题为空等）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// 上传技术资料
router.post(
  '/',
  authenticate,
  parseFileNameFromRequest,
  upload.single('file'),
  handleMulterError,
  fileSecurity(),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '请选择要上传的文件' });
      }

      const {
        title,
        description,
        category,
        asset_type,
        brand,
        model,
        version,
        language = 'zh-CN',
        is_public = 0,
      } = req.body;

      if (!title) {
        cleanupUploadedFile(req.file);
        return res.status(400).json({ success: false, message: '资料标题不能为空' });
      }

      // 获取租户ID
      const tenantId = getTenantId(req);
      if (!tenantId) {
        cleanupUploadedFile(req.file);
        return res.status(400).json({ success: false, message: '无法确定租户信息' });
      }

      // 处理关联的资产编码列表（支持单个和多个资产关联）
      let assetCodesArray = [];

      // 处理单个资产关联
      if (req.body.asset_code) {
        assetCodesArray.push(req.body.asset_code);
      }

      // 处理多资产关联（用于相同型号资产共享）
      // 支持 FormData 中的 asset_codes[] 格式
      if (req.body['asset_codes[]']) {
        const formDataAssetCodes = Array.isArray(req.body['asset_codes[]'])
          ? req.body['asset_codes[]']
          : [req.body['asset_codes[]']];
        assetCodesArray.push(...formDataAssetCodes);
      }

      const parsedBodyAssetCodes = parseAssetCodesInput(req.body.asset_codes);
      if (parsedBodyAssetCodes.invalid) {
        cleanupUploadedFile(req.file);
        return res.status(400).json({ success: false, message: 'asset_codes 格式无效' });
      }
      if (parsedBodyAssetCodes.provided) {
        assetCodesArray.push(...parsedBodyAssetCodes.values);
      }

      assetCodesArray = normalizeAssetCodes(assetCodesArray);
      if (!assetCodesArray) {
        cleanupUploadedFile(req.file);
        return res.status(400).json({ success: false, message: 'asset_codes 格式无效' });
      }

      // 验证资产编码是否存在且属于当前租户
      const validAssets = [];
      if (assetCodesArray.length > 0) {
        const placeholders = assetCodesArray.map(() => '?').join(',');
        const [assets] = await db.execute(
          `SELECT id, asset_code FROM assets WHERE asset_code IN (${placeholders}) AND tenant_id = ?`,
          [...assetCodesArray, tenantId],
        );
        validAssets.push(...assets);

        if (validAssets.length !== assetCodesArray.length) {
          const validCodeSet = new Set(validAssets.map(asset => asset.asset_code));
          const invalidCodes = assetCodesArray.filter(code => !validCodeSet.has(code));
          cleanupUploadedFile(req.file);
          return res.status(400).json({
            success: false,
            message: `以下资产不存在或不属于当前租户: ${invalidCodes.join(', ')}`,
          });
        }
      }

      /**
       * 处理文件名编码问题
       *
       * 问题背景：
       * 不同浏览器和操作系统上传文件时，文件名编码可能不一致：
       * - 现代浏览器通常使用 UTF-8
       * - 旧版浏览器或某些系统可能使用 Latin1、GBK 等编码
       * - 当 UTF-8 编码的中文文件名被错误解析为 Latin1 时，会出现乱码
       *
       * 处理策略：
       * 1. 优先使用中间件解析后的文件名（parseFileNameFromRequest）
       * 2. 检测乱码特征（不包含中文但包含乱码字符）
       * 3. 尝试多种编码方式修复：
       *    - 先尝试 UTF-8 解码（将 Latin1 字节视为 UTF-8）
       *    - 再尝试 Windows 中文编码（GBK、GB2312、GB18030）
       * 4. 验证修复结果（检查是否包含中文字符）
       * 5. 清理文件名中的特殊字符（保留中文）
       */
      let fileName = req.parsedFileName || req.file.originalname;

      console.log('[上传处理] 开始处理文件名:');
      console.log(`  - req.parsedFileName: ${req.parsedFileName}`);
      console.log(`  - req.file.originalname: ${req.file.originalname}`);
      console.log(`  - req.file.filename (存储的文件名): ${req.file.filename}`);
      console.log(`  - 当前 fileName: ${fileName}`);

      // 检测乱码：如果文件名不包含中文，但包含乱码字符，尝试修复编码
      const hasChinese = /[\u4e00-\u9fa5]/.test(fileName);
      const hasReplacementChar = fileName.includes('\uFFFD');
      const hasLatin1Mojibake = /[çåéè£æé«º¾´¨]/i.test(fileName);

      if (!hasChinese && (hasReplacementChar || hasLatin1Mojibake)) {
        console.log('[上传处理] 检测到文件名可能乱码，开始修复...');
        console.log(
          `[上传处理] 原始文件名 (latin1 hex): ${Buffer.from(fileName, 'latin1').toString('hex')}`,
        );

        try {
          // 将乱码字符串视为 Latin1 字节，然后用 UTF-8 解码
          // 原理：UTF-8 编码的中文被错误解析为 Latin1 时，可以通过这种方式恢复
          const latin1Buffer = Buffer.from(fileName, 'latin1');
          const utf8Decoded = latin1Buffer.toString('utf8');
          console.log(`[上传处理] UTF-8 解码结果: ${utf8Decoded}`);

          // 检查解码结果是否包含有效的中文字符
          if (/[\u4e00-\u9fa5]/.test(utf8Decoded)) {
            fileName = utf8Decoded;
            console.log(`[上传处理] ✅ UTF-8 解码成功: ${fileName}`);
          } else {
            // 尝试 Windows 中文编码（GBK、GB2312、GB18030）
            // 这些编码在 Windows 系统中常用，特别是旧版系统
            const encodings = ['gbk', 'gb2312', 'gb18030'];
            for (const encoding of encodings) {
              try {
                const decoded = iconv.decode(latin1Buffer, encoding);
                console.log(`[上传处理] ${encoding} 解码结果: ${decoded}`);
                if (/[\u4e00-\u9fa5]/.test(decoded)) {
                  fileName = decoded;
                  console.log(`[上传处理] ✅ 使用 ${encoding} 编码成功: ${fileName}`);
                  break;
                }
              } catch (e) {
                // 继续尝试下一个编码
              }
            }
          }
        } catch (e) {
          console.error('[上传处理] 编码修复失败:', e);
        }
      }

      // 确保文件名安全（移除特殊字符，但保留中文）
      // 移除 Windows/Linux 文件系统不允许的字符：< > : " / \ | ? * 和控制字符
      fileName = sanitizeUploadFileName(fileName);

      console.log(`[上传处理] 最终使用的文件名: ${fileName}`);

      const uploadedBy = req.user.real_name || req.user.username || '系统管理员';
      const filePath = `/uploads/technical-documents/${req.file.filename}`;

      // 租户ID已在函数开始处获取，无需重复获取

      // 准备插入参数（不再使用asset_id、asset.code、asset_name、asset_ids字段）
      const insertParams = [
        tenantId,
        title,
        description || null,
        fileName,
        filePath,
        req.file.mimetype,
        req.file.size,
        category || null,
        asset_type || null,
        brand || null,
        model || null,
        version || null,
        language,
        uploadedBy,
        is_public ? 1 : 0,
      ];

      console.log('准备插入技术资料，参数数量:', insertParams.length);
      console.log(
        '参数值:',
        insertParams
          .map(
            (p, i) =>
              `${i + 1}. ${typeof p === 'string' && p.length > 50 ? `${p.substring(0, 50)}...` : p}`,
          )
          .join(', '),
      );

      const result = await db.transaction(async connection => {
        const [insertResult] = await connection.execute(
          `INSERT INTO technical_documents (
          tenant_id, title, description, file_name, file_path, file_type, file_size,
          category, asset_type, brand, model, version, language,
          upload_source, uploaded_by, is_public, status,
          upload_date,
          review_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '内部上传', ?, ?, 'active', NOW(), 'pending')`,
          insertParams,
        );

        if (validAssets.length > 0) {
          const documentId = insertResult.insertId;

          for (const asset of validAssets) {
            await connection.execute(
              `INSERT INTO technical_document_asset_relations (document_id, asset_id, asset_code, tenant_id)
               VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE created_at = NOW()`,
              [documentId, asset.id, asset.asset_code, tenantId],
            );
          }

          console.log(`✅ 已关联 ${validAssets.length} 个资产到技术资料 ${documentId}`);
        }

        return insertResult;
      });

      // 记录上传技术资料日志
      await logAudit(req, {
        action_type: 'create',
        module: 'technical-documents',
        resource_type: 'document',
        resource_id: result.insertId,
        resource_name: title,
        action_description: `上传技术资料：${title}`,
        new_value: { title, file_name: fileName, category, brand, model, review_status: 'pending' },
        response_status: 200,
      });

      res.json({
        success: true,
        message: '技术资料上传成功',
        data: {
          id: result.insertId,
          title,
          file_name: fileName,
          file_path: filePath,
          file_url: `${req.protocol}://${req.get('host')}${filePath}`,
        },
      });
    } catch (error) {
      cleanupUploadedFile(req.file);
      console.error('上传技术资料失败:', error);
      console.error('错误堆栈:', error.stack);
      console.error('请求体:', JSON.stringify(req.body, null, 2));
      console.error(
        '文件信息:',
        req.file
          ? {
              originalname: req.file.originalname,
              mimetype: req.file.mimetype,
              size: req.file.size,
              filename: req.file.filename,
            }
          : '无文件',
      );
      res.status(500).json({
        success: false,
        message: '上传技术资料失败',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  },
);

// 更新技术资料信息
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    console.log(`[更新技术资料] 开始处理请求，ID: ${id}`);
    console.log('[更新技术资料] 请求体:', JSON.stringify(req.body, null, 2));

    const {
      title,
      description,
      category,
      asset_type,
      brand,
      model,
      version,
      language,
      is_public,
      status,
      asset_codes,
    } = req.body;

    const updateFields = [];
    const updateValues = [];

    // 辅助函数：处理可选字段（空字符串转为NULL）
    const addField = (fieldName, value) => {
      if (value !== undefined && value !== null) {
        if (value === '' || (typeof value === 'string' && value.trim() === '')) {
          updateFields.push(`${fieldName} = NULL`);
        } else {
          updateFields.push(`${fieldName} = ?`);
          updateValues.push(value);
        }
      }
    };

    if (title !== undefined) {
      if (!title || (typeof title === 'string' && title.trim() === '')) {
        return res.status(400).json({ success: false, message: '资料名称不能为空' });
      }
      updateFields.push('title = ?');
      updateValues.push(title);
    }

    addField('description', description);
    addField('category', category);
    addField('asset_type', asset_type);
    addField('brand', brand);
    addField('model', model);
    addField('version', version);
    addField('language', language);

    if (is_public !== undefined) {
      updateFields.push('is_public = ?');
      updateValues.push(is_public ? 1 : 0);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    // 处理多资产关联更新
    let validAssets = [];
    if (asset_codes !== undefined) {
      const parsedAssetCodes = parseAssetCodesInput(asset_codes);
      if (parsedAssetCodes.invalid) {
        return res.status(400).json({ success: false, message: 'asset_codes 格式无效' });
      }

      const assetCodesFiltered = normalizeAssetCodes(parsedAssetCodes.values);
      if (!assetCodesFiltered) {
        return res.status(400).json({ success: false, message: 'asset_codes 格式无效' });
      }

      if (assetCodesFiltered.length > 0) {
        // 验证资产编码是否存在且属于当前租户
        const tenantFilter = addTenantFilter(req, '');
        const placeholders = assetCodesFiltered.map(() => '?').join(',');
        const [assets] = await db.execute(
          `SELECT id, asset_code FROM assets WHERE asset_code IN (${placeholders}) ${tenantFilter.whereClause}`,
          [...assetCodesFiltered, ...tenantFilter.params],
        );
        validAssets = assets;

        if (validAssets.length !== assetCodesFiltered.length) {
          const validCodeSet = new Set(validAssets.map(asset => asset.asset_code));
          const invalidCodes = assetCodesFiltered.filter(code => !validCodeSet.has(code));
          return res.status(400).json({
            success: false,
            message: `以下资产不存在或不属于当前租户: ${invalidCodes.join(', ')}`,
          });
        }
      }
    }

    if (updateFields.length === 0) {
      console.log('[更新技术资料] ⚠️ 没有要更新的字段');
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    console.log(`[更新技术资料] 更新字段: ${updateFields.join(', ')}`);
    console.log(`[更新技术资料] 参数数量: ${updateValues.length}, 参数值:`, updateValues);

    // 检查文档是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'td');
    const [existingDocs] = await db.execute(
      `SELECT td.id FROM technical_documents td WHERE td.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existingDocs.length === 0) {
      console.log(`[更新技术资料] ❌ 文档不存在: ${id}`);
      return res.status(404).json({ success: false, message: '技术资料不存在' });
    }

    await db.transaction(async connection => {
      const [updateResult] = await connection.execute(
        `UPDATE technical_documents td SET ${updateFields.join(', ')} WHERE td.id = ? ${tenantFilter.whereClause}`,
        [...updateValues, id, ...tenantFilter.params],
      );

      if (!updateResult || updateResult.affectedRows === 0) {
        throw createHttpError(404, '技术资料不存在');
      }

      if (asset_codes !== undefined) {
        await connection.execute('DELETE FROM technical_document_asset_relations WHERE document_id = ? AND tenant_id = ?', [
          id, tenantId,
        ]);

        if (validAssets.length > 0) {
          for (const asset of validAssets) {
            await connection.execute(
              `INSERT INTO technical_document_asset_relations (document_id, asset_id, asset_code, tenant_id)
                 VALUES (?, ?, ?, ?)`,
              [id, asset.id, asset.asset_code, tenantId],
            );
          }
          console.log(`✅ 已更新 ${validAssets.length} 个资产关联到技术资料 ${id}`);
        }
      }
    });

    console.log('[更新技术资料] ✅ 更新成功');
    res.json({ success: true, message: '技术资料更新成功' });
  } catch (error) {
    if (error.httpStatus) {
      return res.status(error.httpStatus).json({ success: false, message: error.message });
    }
    console.error('[更新技术资料] ❌ 处理失败:', error);
    console.error('[更新技术资料] 错误消息:', error.message);
    console.error('[更新技术资料] 错误堆栈:', error.stack);
    console.error('[更新技术资料] 错误类型:', error.constructor.name);
    console.error('[更新技术资料] 请求体内容:', JSON.stringify(req.body, null, 2));
    console.error('[更新技术资料] 关键字段:', {
      title: req.body?.title,
      asset_id: req.body?.asset_id,
      asset_ids: req.body?.asset_ids,
    });
    if (error.code) {
      console.error('[更新技术资料] 错误代码:', error.code);
    }
    if (error.sqlState) {
      console.error('[更新技术资料] SQL状态:', error.sqlState);
    }
    if (error.sqlMessage) {
      console.error('[更新技术资料] SQL消息:', error.sqlMessage);
    }
    res.status(500).json({
      success: false,
      message: '更新技术资料失败',
      error: error.message,
      code: error.code,
      sqlState: error.sqlState,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// 删除技术资料
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // 权限检查：超级管理员和系统管理员（租户级）可以删除技术资料
    if (req.user.role !== 'super_admin' && req.user.role !== 'system_admin') {
      return res.status(403).json({
        success: false,
        message: '权限不足，只有系统管理员可以删除技术资料',
      });
    }

    const { id } = req.params;

    // 验证租户并获取文件信息
    const tenantFilter = addTenantFilter(req, 'td');
    const [rows] = await db.execute(
      `SELECT td.title, td.file_name, td.file_path
       FROM technical_documents td
       WHERE td.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '技术资料不存在' });
    }

    const docInfo = rows[0];

    // 删除数据库记录
    const [deleteResult] = await db.execute(
      `DELETE td FROM technical_documents td WHERE td.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (!deleteResult || deleteResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '技术资料不存在' });
    }

    cleanupStoredDocumentFile(docInfo.file_path);

    // 记录删除日志
    if (docInfo) {
      await logAudit(req, {
        action_type: 'delete',
        module: 'technical-documents',
        resource_type: 'document',
        resource_id: parseInt(id),
        resource_name: docInfo.title,
        action_description: `删除技术资料：${docInfo.title}`,
        old_value: docInfo,
        response_status: 200,
      });
    }

    res.json({ success: true, message: '技术资料删除成功' });
  } catch (error) {
    console.error('删除技术资料失败:', error);
    res.status(500).json({ success: false, message: '删除技术资料失败', error: error.message });
  }
});

// 下载技术资料
router.get('/:id/file', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

    // 验证文档是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'td');
    let whereClause = `WHERE td.id = ? ${tenantFilter.whereClause}`;
    const params = [id, ...tenantFilter.params];

    // 资产管理员只能下载自己管理科室的资产相关的技术资料
    const managedDepartmentScope = buildManagedDepartmentDocumentScope(req);
    whereClause += managedDepartmentScope.clause;
    params.push(...managedDepartmentScope.params);

    const [rows] = await db.execute(
      `SELECT td.* FROM technical_documents td ${whereClause}`,
      params,
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '技术资料不存在' });
    }

    const doc = rows[0];
    const filePath = path.join(__dirname, '..', doc.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    // 增加下载次数
    await db.execute(
      `UPDATE technical_documents td SET td.download_count = td.download_count + 1 WHERE td.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    // 记录下载日志
    const downloadedBy = req.user ? req.user.real_name || req.user.username : '匿名用户';
    const downloadIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || '';

    await db.execute(
      `INSERT INTO technical_document_downloads (document_id, downloaded_by, download_ip, user_agent, tenant_id)
       VALUES (?, ?, ?, ?, ?)`,
      [id, downloadedBy, downloadIp, userAgent, tenantId],
    );

    // 设置下载响应头
    const fileName = doc.file_name;
    const asciiFileName = Buffer.from(fileName, 'utf8')
      .toString('ascii')
      .replace(/[^\x20-\x7E]/g, '_');
    const encodedFileName = encodeURIComponent(fileName);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`,
    );
    res.setHeader('Content-Type', doc.file_type || 'application/octet-stream');

    // 获取文件大小，用于设置 Content-Length
    const stats = fs.statSync(filePath);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Accept-Ranges', 'bytes');

    // 使用 sendFile，Express 会自动处理范围请求（Range requests）
    // 对于范围请求，Express 会自动返回 206 状态码
    res.sendFile(path.resolve(filePath), {
      acceptRanges: true, // 启用范围请求支持
    });
  } catch (error) {
    console.error('下载技术资料失败:', error);
    res.status(500).json({ success: false, message: '下载技术资料失败', error: error.message });
  }
});

// ==================== 资产关联技术资料 ====================

/**
 * @swagger
 * /api/technical-documents/assets/{assetId}:
 *   get:
 *     tags:
 *       - 技术资料管理
 *     summary: 获取资产的技术资料列表
 *     description: |
 *       获取指定资产关联的技术资料列表
 *
 *       关联方式包括：
 *       1. 直接关联：technical_documents.asset_id = 资产ID
 *       2. 多资产关联：technical_documents.asset_ids JSON数组包含资产ID
 *       3. 品牌型号匹配：technical_documents.brand = 资产.brand AND technical_documents.model = 资产.model
 *
 *       注意：现在会显示所有状态的资料（包括待审核），但待审核的资料不能下载
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assetId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 资产ID
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
 *                         allOf:
 *                           - $ref: '#/components/schemas/TechnicalDocument'
 *                           - type: object
 *                             properties:
 *                               link_type:
 *                                 type: string
 *                                 enum: [直接关联, 多资产关联, 品牌型号匹配, 其他]
 *                                 description: 关联方式
 *                               linked_asset.code:
 *                                 type: string
 *                                 description: 关联的资产编号
 *                               linked_asset_name:
 *                                 type: string
 *                                 description: 关联的资产名称
 *       400:
 *         description: 无效的资产ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 资产不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// 获取资产的技术资料列表
router.get('/assets/:assetIdOrCode', authenticate, async (req, res) => {
  try {
    const { assetIdOrCode } = req.params;
    console.log('[获取资产技术资料] ========== 开始处理请求 ==========');
    console.log(`[获取资产技术资料] 资产标识: ${assetIdOrCode}, 类型: ${typeof assetIdOrCode}`);
    console.log('[获取资产技术资料] 请求头:', req.headers);
    console.log('[获取资产技术资料] 用户信息:', req.user);
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无法确定租户信息' });
    }

    let rows;
    let asset;
    try {
      ({ rows, asset } = await fetchScopedAssetDocuments(assetIdOrCode, tenantId));
      console.log(`[获取资产技术资料] ✅ SQL查询成功，返回 ${rows.length} 条记录`);

      console.log('[获取资产技术资料] 资产信息:', asset);
    } catch (sqlError) {
      console.error('[获取资产技术资料] ❌ SQL查询失败:');
      console.error('[获取资产技术资料] 错误消息:', sqlError.message);
      console.error('[获取资产技术资料] 错误代码:', sqlError.code);
      console.error('[获取资产技术资料] SQL状态:', sqlError.sqlState);
      console.error('[获取资产技术资料] 错误堆栈:', sqlError.stack);
      return res.status(500).json({
        success: false,
        message: '查询技术资料失败',
        error: sqlError.message,
        code: sqlError.code,
        sqlState: sqlError.sqlState,
      });
    }

    if (!asset) {
      console.log(`[获取资产技术资料] 资产不存在: ${assetIdOrCode}`);
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    // 构建响应数据
    const documents = rows.map(doc => ({
      ...doc,
      file_url: `${req.protocol}://${req.get('host')}/api/technical-documents/${doc.id}/file`,
    }));

    console.log(
      `[获取资产技术资料] 资产ID: ${asset.id}, 资产编码: ${asset.asset_code}, 品牌: ${asset.brand || '无'}, 型号: ${asset.model || '无'}`,
    );
    console.log(`[获取资产技术资料] SQL 查询返回 ${rows.length} 条记录`);
    console.log(`[获取资产技术资料] 解析后得到 ${documents.length} 条技术资料`);

    if (documents.length > 0) {
      console.log(
        '[获取资产技术资料] 技术资料详情:',
        documents.map(d => ({
          id: d.id,
          title: d.title,
          link_type: d.link_type,
          asset_id: d.asset_id,
          asset_code: d.asset_code,
          brand: d.brand,
          model: d.model,
          status: d.status,
        })),
      );
    } else {
      console.log('[获取资产技术资料] ⚠️ 未找到技术资料');
      console.log('[获取资产技术资料] 查询条件：');
      console.log(`  - 直接关联: asset_code = ${asset.asset_code}`);
      console.log(
        `  - 品牌型号匹配: brand = '${asset.brand || ''}', model = '${asset.model || ''}'`,
      );
      console.log("  - 状态: status != 'deleted'");
    }

    res.json({
      success: true,
      data: {
        asset: {
          id: asset.id,
          asset_code: asset.asset_code,
          asset_name: asset.asset_name,
          brand: asset.brand,
          model: asset.model,
        },
        documents,
      },
    });
  } catch (error) {
    console.error('[获取资产技术资料] ❌ 处理请求时发生错误:', error);
    console.error('[获取资产技术资料] 错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      message: '获取资产技术资料失败',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// 为资产关联已有技术资料（用于相同型号资产共享）
router.post('/assets/:assetIdOrCode/link/:documentId', authenticate, async (req, res) => {
  try {
    const { assetIdOrCode, documentId } = req.params;

    // 获取当前租户ID
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无法确定租户信息' });
    }

    // 检查资产是否存在且属于当前租户（同时支持ID和code）
    const [assets] = await db.execute(
      'SELECT id, asset_code, asset_name FROM assets WHERE (id = ? OR asset_code = ?) AND tenant_id = ?',
      [assetIdOrCode, assetIdOrCode, tenantId],
    );

    // 检查技术资料是否存在且属于当前租户
    const [docs] = await db.execute(
      'SELECT id, tenant_id FROM technical_documents WHERE id = ? AND tenant_id = ?',
      [documentId, tenantId],
    );

    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在或不属于当前租户' });
    }
    if (docs.length === 0) {
      return res.status(404).json({ success: false, message: '技术资料不存在或不属于当前租户' });
    }

    const asset = assets[0];
    const doc = docs[0];
    const assetIdInt = parseInt(asset.id);

    // 使用中间表存储关联关系（支持多资产关联，同时存储asset_id和asset_code）
    // 这里确保 asset_id 存储的是 assets.id，asset_code 存储业务编码
    await db.execute(
      `INSERT INTO technical_document_asset_relations (document_id, asset_id, asset_code, tenant_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE created_at = NOW()`,
      [documentId, assetIdInt, asset.asset_code, tenantId],
    );

    console.log(
      `[关联技术资料] 资产ID: ${asset.id}, 资产编码: ${asset.asset_code}, 文档ID: ${documentId}`,
    );

    res.json({
      success: true,
      message: '技术资料关联成功',
      data: {
        asset_id: assetIdInt,
        asset_code: asset.asset_code,
        document_id: parseInt(documentId),
      },
    });
  } catch (error) {
    console.error('关联技术资料失败:', error);
    res.status(500).json({ success: false, message: '关联技术资料失败', error: error.message });
  }
});

/**
 * 取消资产与技术资料的关联
 *
 * 业务逻辑说明：
 * 1. 从 asset_ids JSON 数组中移除指定的资产ID
 * 2. 如果被移除的资产是主关联资产（asset_id），需要处理主关联的更新：
 *    - 如果 asset_ids 中还有其他资产，将第一个资产提升为主关联
 *    - 如果 asset_ids 为空，清空主关联字段
 * 3. 这样设计的好处：
 *    - 保持数据一致性：主关联资产应该始终在 asset_ids 中
 *    - 自动维护主关联：当主关联被移除时，自动选择新的主关联
 *    - 支持完全取消关联：当所有关联都被移除时，清空所有关联字段
 */
router.delete('/assets/:assetIdOrCode/link/:documentId', authenticate, async (req, res) => {
  try {
    const { assetIdOrCode, documentId } = req.params;

    console.log(`[取消关联技术资料] 开始处理，资产标识: ${assetIdOrCode}, 文档ID: ${documentId}`);

    // 获取当前租户ID
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无法确定租户信息' });
    }

    // 检查资产是否存在且属于当前租户（同时支持ID和asset_code）
    const [assets] = await db.execute(
      'SELECT id, asset_code, asset_name FROM assets WHERE (id = ? OR asset_code = ?) AND tenant_id = ?',
      [assetIdOrCode, assetIdOrCode, tenantId],
    );

    // 检查技术资料是否存在且属于当前租户
    const [docs] = await db.execute(
      'SELECT id, tenant_id FROM technical_documents WHERE id = ? AND tenant_id = ?',
      [documentId, tenantId],
    );

    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在或不属于当前租户' });
    }
    if (docs.length === 0) {
      console.log(`[取消关联技术资料] 技术资料不存在或不属于当前租户: ${documentId}`);
      return res.status(404).json({ success: false, message: '技术资料不存在或不属于当前租户' });
    }

    const asset = assets[0];
    const assetIdInt = asset.id;

    console.log(
      `[取消关联技术资料] 当前关联信息: 文档ID: ${documentId}, 资产ID: ${asset.id}, 资产编码: ${asset.asset_code}`,
    );

    /**
     * 从中间表中删除关联关系
     */
    const [deleteResult] = await db.execute(
      'DELETE FROM technical_document_asset_relations WHERE document_id = ? AND (asset_id = ? OR asset_code = ?) AND tenant_id = ?',
      [documentId, assetIdInt, asset.asset_code, tenantId],
    );

    console.log(`[取消关联技术资料] 从中间表删除关联关系，影响行数: ${deleteResult.affectedRows}`);

    console.log('[取消关联技术资料] ✅ 更新成功，无需更新主关联字段');

    // 验证更新结果
    const [updatedRelations] = await db.execute(
      'SELECT asset_id, asset_code FROM technical_document_asset_relations WHERE document_id = ? AND tenant_id = ?',
      [documentId, tenantId],
    );
    if (updatedRelations.length > 0) {
      console.log('[取消关联技术资料] ✅ 更新后的数据:', {
        document_id: documentId,
        remaining_relations: updatedRelations.length,
        relations: updatedRelations,
      });
    } else {
      console.log('[取消关联技术资料] ✅ 更新后的数据:', {
        document_id: documentId,
        remaining_relations: 0,
      });
    }

    res.json({
      success: true,
      message: '取消关联成功',
    });
  } catch (error) {
    console.error('[取消关联技术资料] ❌ 处理失败:', error);
    console.error('[取消关联技术资料] 错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      message: '取消关联失败',
      error: error.message,
    });
  }
});

// ==================== 审核管理 ====================

/**
 * 审核技术资料（通过/拒绝）
 *
 * 审核流程说明：
 * 1. 新上传的技术资料默认状态为 pending（待审核）
 * 2. 只有系统管理员和资产管理员可以审核
 * 3. 审核结果：
 *    - approved：审核通过，资料可以被关联和使用
 *    - rejected：审核拒绝，资料不能被关联和使用
 * 4. 审核通过后，资料会显示在资产详情页，但待审核的资料不能下载
 * 5. 只有审核通过的资料才能被关联到资产
 *
 * 权限控制：
 * - system_admin：系统管理员，可以审核所有资料
 * - asset_admin：资产管理员，可以审核所有资料
 * - 其他角色：不能审核
 */
router.post('/:id/review', authenticate, async (req, res) => {
  try {
    // 权限检查：超级管理员、系统管理员（租户级）和资产管理员可以审核
    if (
      req.user.role !== 'super_admin' &&
      req.user.role !== 'system_admin' &&
      req.user.role !== 'asset_admin'
    ) {
      return res.status(403).json({
        success: false,
        message: '权限不足，只有系统管理员和资产管理员可以审核技术资料',
      });
    }

    const { id } = req.params;
    const { review_status, review_comment } = req.body;

    // 验证审核状态（只允许 approved 或 rejected，不允许 pending）
    if (!review_status || !['approved', 'rejected'].includes(review_status)) {
      return res.status(400).json({
        success: false,
        message: '审核状态无效，必须是 approved 或 rejected',
      });
    }

    // 检查资料是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'td');
    const [docs] = await db.execute(
      `SELECT td.id, td.review_status, td.title FROM technical_documents td WHERE td.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (docs.length === 0) {
      return res.status(404).json({ success: false, message: '技术资料不存在' });
    }

    const docTitle = docs[0].title || '未知';
    const reviewedBy = req.user.real_name || req.user.username || '系统管理员';

    // 更新审核状态
    await db.execute(
      `UPDATE technical_documents td
       SET td.review_status = ?,
           td.reviewed_by = ?,
           td.reviewed_at = NOW(),
           td.review_comment = ?
       WHERE td.id = ? ${tenantFilter.whereClause}`,
      [review_status, reviewedBy, review_comment || null, id, ...tenantFilter.params],
    );

    // 记录审核日志
    await logAudit(req, {
      action_type: review_status === 'approved' ? 'approve' : 'reject',
      module: 'technical-documents',
      resource_type: 'document',
      resource_id: parseInt(id),
      resource_name: docTitle,
      action_description: `审核技术资料：${docTitle} - ${review_status === 'approved' ? '通过' : '拒绝'}`,
      old_value: { review_status: 'pending' },
      new_value: { review_status, reviewed_by: reviewedBy, review_comment },
      response_status: 200,
    });

    res.json({
      success: true,
      message: review_status === 'approved' ? '审核通过' : '审核已拒绝',
      data: {
        id: parseInt(id),
        review_status,
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        review_comment: review_comment || null,
      },
    });
  } catch (error) {
    console.error('审核技术资料失败:', error);
    res.status(500).json({
      success: false,
      message: '审核技术资料失败',
      error: error.message,
    });
  }
});

// 获取待审核的技术资料列表
router.get('/pending', authenticate, async (req, res) => {
  try {
    // 权限检查：超级管理员、系统管理员（租户级）和资产管理员可以查看待审核列表
    if (
      req.user.role !== 'super_admin' &&
      req.user.role !== 'system_admin' &&
      req.user.role !== 'asset_admin'
    ) {
      return res.status(403).json({
        success: false,
        message: '权限不足，只有系统管理员和资产管理员可以查看待审核列表',
      });
    }

    const { page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'td');

    // 获取总数
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM technical_documents td
       WHERE td.review_status = 'pending' AND td.status != 'deleted' ${tenantFilter.whereClause}`,
      tenantFilter.params,
    );
    const { total } = countRows[0];

    // 获取数据
    const [rows] = await db.execute(
      `SELECT td.*
       FROM technical_documents td
       WHERE td.review_status = 'pending' AND td.status != 'deleted' ${tenantFilter.whereClause}
       ORDER BY td.upload_date ASC
       LIMIT ? OFFSET ?`,
      [...tenantFilter.params, parseInt(pageSize), offset],
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
    console.error('获取待审核技术资料列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取待审核技术资料列表失败',
      error: error.message,
    });
  }
});

// ==================== 分享链接管理 ====================

// 创建分享链接（用于外部上传）
router.post('/:id/share', authenticate, async (req, res) => {
  try {
    // 权限检查：超级管理员、系统管理员（租户级）和资产管理员可以创建分享链接
    if (
      req.user.role !== 'super_admin' &&
      req.user.role !== 'system_admin' &&
      req.user.role !== 'asset_admin'
    ) {
      return res.status(403).json({
        success: false,
        message: '权限不足，只有系统管理员和资产管理员可以创建分享链接',
      });
    }

    const { id } = req.params;
    const { expires_days = 7, max_uploads = 1, remark, supplier_name, supplier_contact } = req.body;
    const normalizedExpiresDays = parsePositiveInteger(expires_days);
    const normalizedMaxUploads = parsePositiveInteger(max_uploads);

    if (!normalizedExpiresDays) {
      return res.status(400).json({ success: false, message: 'expires_days 必须是正整数' });
    }

    if (!normalizedMaxUploads) {
      return res.status(400).json({ success: false, message: 'max_uploads 必须是正整数' });
    }

    // 检查资料是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'td');
    const managedDepartmentScope = buildManagedDepartmentDocumentScope(req, 'td');
    const [docs] = await db.execute(
      `SELECT td.id, td.tenant_id FROM technical_documents td WHERE td.id = ? ${tenantFilter.whereClause}${managedDepartmentScope.clause}`,
      [id, ...tenantFilter.params, ...managedDepartmentScope.params],
    );

    if (docs.length === 0) {
      return res.status(404).json({ success: false, message: '技术资料不存在' });
    }

    // 获取租户ID（从文档或用户）
    const tenantId = docs[0].tenant_id || getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无法确定租户信息' });
    }

    // 生成分享令牌
    const shareToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + normalizedExpiresDays);

    const shareUrl = `${req.protocol}://${req.get('host')}/technical-documents/upload/${shareToken}`;
    const createdBy = req.user.real_name || req.user.username || '系统管理员';

    await db.execute(
      `INSERT INTO technical_document_shares (
        tenant_id, document_id, share_token, share_url, expires_at, max_uploads, created_by, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        id,
        shareToken,
        shareUrl,
        expiresAt,
        normalizedMaxUploads,
        createdBy,
        remark ||
          (supplier_name
            ? `供应商：${supplier_name}${supplier_contact ? `，联系方式：${supplier_contact}` : ''}`
            : null),
      ],
    );

    res.json({
      success: true,
      message: '分享链接创建成功',
      data: {
        share_token: shareToken,
        share_url: shareUrl,
        expires_at: expiresAt,
        max_uploads: normalizedMaxUploads,
      },
    });
  } catch (error) {
    console.error('创建分享链接失败:', error);
    res.status(500).json({ success: false, message: '创建分享链接失败', error: error.message });
  }
});

// 获取分享链接列表
router.get('/:id/shares', authenticate, async (req, res) => {
  try {
    // 权限检查：只有系统管理员和资产管理员可以查看分享链接列表
    if (
      req.user.role !== 'super_admin' &&
      req.user.role !== 'system_admin' &&
      req.user.role !== 'asset_admin'
    ) {
      return res.status(403).json({
        success: false,
        message: '权限不足，只有系统管理员和资产管理员可以查看分享链接',
      });
    }

    const { id } = req.params;

    // 验证文档是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'td');
    const managedDepartmentScope = buildManagedDepartmentDocumentScope(req, 'td');
    const [docs] = await db.execute(
      `SELECT td.id FROM technical_documents td WHERE td.id = ? ${tenantFilter.whereClause}${managedDepartmentScope.clause}`,
      [id, ...tenantFilter.params, ...managedDepartmentScope.params],
    );

    if (docs.length === 0) {
      return res.status(404).json({ success: false, message: '技术资料不存在' });
    }

    // 获取分享链接列表（通过文档的tenant_id过滤）
    const shareTenantFilter = addTenantFilter(req, 'tds');
    const [rows] = await db.execute(
      `SELECT tds.* FROM technical_document_shares tds
       WHERE tds.document_id = ? AND tds.is_active = 1 ${shareTenantFilter.whereClause}
       ORDER BY tds.created_at DESC`,
      [id, ...shareTenantFilter.params],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取分享链接列表失败:', error);
    res.status(500).json({ success: false, message: '获取分享链接失败', error: error.message });
  }
});

// 删除分享链接
router.delete('/shares/:shareId', authenticate, async (req, res) => {
  try {
    // 权限检查：只有系统管理员和资产管理员可以删除分享链接
    if (
      req.user.role !== 'super_admin' &&
      req.user.role !== 'system_admin' &&
      req.user.role !== 'asset_admin'
    ) {
      return res.status(403).json({
        success: false,
        message: '权限不足，只有系统管理员和资产管理员可以删除分享链接',
      });
    }

    const { shareId } = req.params;

    // 验证分享链接是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'tds');
    const managedDepartmentScope = buildManagedDepartmentDocumentScope(req, 'td');
    const [existing] = await db.execute(
      `SELECT tds.id
       FROM technical_document_shares tds
       INNER JOIN technical_documents td ON td.id = tds.document_id
       WHERE tds.id = ? ${tenantFilter.whereClause}${managedDepartmentScope.clause}`,
      [shareId, ...tenantFilter.params, ...managedDepartmentScope.params],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '分享链接不存在' });
    }

    const [updateResult] = await db.execute(
      `UPDATE technical_document_shares tds SET tds.is_active = 0 WHERE tds.id = ? ${tenantFilter.whereClause}`,
      [shareId, ...tenantFilter.params],
    );

    if (!updateResult || updateResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '分享链接不存在' });
    }

    res.json({ success: true, message: '分享链接已删除' });
  } catch (error) {
    console.error('删除分享链接失败:', error);
    res.status(500).json({ success: false, message: '删除分享链接失败', error: error.message });
  }
});

// ==================== 外部上传接口（无需认证） ====================

// 验证分享令牌并获取上传权限
router.get('/upload/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const [shares] = await db.execute(
      `SELECT tds.*, td.title, td.id as document_id
       FROM technical_document_shares tds
       LEFT JOIN technical_documents td ON tds.document_id = td.id
       WHERE tds.share_token = ? AND tds.is_active = 1 AND td.status = 'active'`,
      [token],
    );

    if (shares.length === 0) {
      return res.status(404).json({ success: false, message: '分享链接无效或已过期' });
    }

    const share = shares[0];

    // 检查是否过期
    if (new Date(share.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: '分享链接已过期' });
    }

    // 检查上传次数
    if (share.current_uploads >= share.max_uploads) {
      return res.status(400).json({ success: false, message: '已达到最大上传次数' });
    }

    // 记录访问日志（记录IP地址）
    const accessIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    console.log(
      `[分享链接访问] Token: ${token.substring(0, 8)}..., IP: ${accessIp}, 时间: ${new Date().toISOString()}`,
    );

    res.json({
      success: true,
      data: {
        document_id: share.document_id,
        document_title: share.title,
        max_uploads: share.max_uploads,
        current_uploads: share.current_uploads,
        expires_at: share.expires_at,
      },
    });
  } catch (error) {
    console.error('验证分享令牌失败:', error);
    res.status(500).json({ success: false, message: '验证分享令牌失败', error: error.message });
  }
});

// 外部上传文件（通过分享令牌）
router.post(
  '/upload/:token',
  parseFileNameFromRequest,
  upload.single('file'),
  handleMulterError,
  fileSecurity(),
  async (req, res) => {
    try {
      const { token } = req.params;

      if (!req.file) {
        return res.status(400).json({ success: false, message: '请选择要上传的文件' });
      }

      // 验证上传的文件
      const validation = FileValidator.validate(req.file);
      if (!validation.valid) {
        cleanupUploadedFile(req.file);
        return res.status(400).json({ success: false, message: validation.message });
      }

      // 验证分享令牌（通过分享链接的tenant_id验证租户）
      const [shares] = await db.execute(
        `SELECT tds.*, td.title, td.id as document_id, tds.tenant_id, td.tenant_id as doc_tenant_id
       FROM technical_document_shares tds
       LEFT JOIN technical_documents td ON tds.document_id = td.id
       WHERE tds.share_token = ? AND tds.is_active = 1 AND td.status = 'active'`,
        [token],
      );

      if (shares.length === 0) {
        cleanupUploadedFile(req.file);
        return res.status(404).json({ success: false, message: '分享链接无效或已过期' });
      }

      const share = shares[0];

      // 检查是否过期
      if (new Date(share.expires_at) < new Date()) {
        cleanupUploadedFile(req.file);
        return res.status(400).json({ success: false, message: '分享链接已过期' });
      }

      // 检查上传次数
      if (share.current_uploads >= share.max_uploads) {
        cleanupUploadedFile(req.file);
        return res.status(400).json({ success: false, message: '已达到最大上传次数' });
      }

      // 处理文件名（优先使用解析后的文件名）
      let fileName = req.parsedFileName || req.file.originalname;

      // 如果文件名包含中文，确保编码正确
      if (fileName && /[\u4e00-\u9fa5]/.test(fileName)) {
        // 如果文件名已经是正确的 UTF-8，直接使用
        if (!fileName.includes('\uFFFD')) {
          // 文件名正常，无需处理
        } else {
          // 文件名有乱码，尝试修复
          console.log('检测到文件名乱码，尝试修复:', fileName);
          try {
            // 如果是从 req.file.originalname 获取的，可能是 latin1 编码
            if (!req.parsedFileName && req.file.originalname) {
              // 尝试从 latin1 转换为 utf8
              const buffer = Buffer.from(req.file.originalname, 'latin1');
              fileName = iconv.decode(buffer, 'utf8');
              console.log('修复后的文件名:', fileName);
            }
          } catch (e) {
            console.warn('文件名编码修复失败，使用原始文件名:', e);
          }
        }
      }

      // 确保文件名安全（移除特殊字符，但保留中文）
      fileName = sanitizeUploadFileName(fileName);

      console.log('最终使用的文件名:', fileName);
      const { title, description, uploader_name, uploader_company } = req.body;

      const uploadedBy = uploader_name || uploader_company || '外部用户';
      const filePath = `/uploads/technical-documents/${req.file.filename}`;

      // 获取租户ID（优先使用分享链接的tenant_id，否则使用文档的tenant_id）
      const tenantId = share.tenant_id || share.doc_tenant_id;
      if (!tenantId) {
        cleanupUploadedFile(req.file);
        return res.status(400).json({ success: false, message: '无法确定租户信息' });
      }

      const uploadTitle = title || `来自 ${uploadedBy} 的补充资料`;
      const uploadDescription =
        description ||
        `通过分享链接上传，上传人：${uploadedBy}${uploader_company ? `，公司：${uploader_company}` : ''}`;

      const uploadResult = await db.transaction(async connection => {
        const [lockedShares] = await connection.execute(
          `SELECT tds.*, td.title, td.id as document_id, tds.tenant_id, td.tenant_id as doc_tenant_id
           FROM technical_document_shares tds
           LEFT JOIN technical_documents td ON tds.document_id = td.id
           WHERE tds.share_token = ? AND tds.is_active = 1 AND td.status = 'active'
           FOR UPDATE`,
          [token],
        );

        if (lockedShares.length === 0) {
          throw createHttpError(404, '分享链接无效或已过期');
        }

        const lockedShare = lockedShares[0];
        if (new Date(lockedShare.expires_at) < new Date()) {
          throw createHttpError(400, '分享链接已过期');
        }

        if (lockedShare.current_uploads >= lockedShare.max_uploads) {
          throw createHttpError(400, '已达到最大上传次数');
        }

        const [result] = await connection.execute(
          `INSERT INTO technical_documents (
            tenant_id, title, description, file_name, file_path, file_type, file_size,
            upload_source, upload_token, uploaded_by, status, upload_date, review_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, '外部上传', ?, ?, 'active', NOW(), 'pending')`,
          [
            tenantId,
            uploadTitle,
            uploadDescription,
            fileName,
            filePath,
            req.file.mimetype,
            req.file.size,
            token,
            uploadedBy,
          ],
        );

        const [updateResult] = await connection.execute(
          `UPDATE technical_document_shares
           SET current_uploads = current_uploads + 1
           WHERE id = ? AND is_active = 1 AND current_uploads < max_uploads`,
          [lockedShare.id],
        );

        if (!updateResult || updateResult.affectedRows === 0) {
          throw createHttpError(400, '已达到最大上传次数');
        }

        return result;
      });

      res.json({
        success: true,
        message: '文件上传成功',
        data: {
          id: uploadResult.insertId,
          file_name: fileName,
          file_path: filePath,
        },
      });
    } catch (error) {
      cleanupUploadedFile(req.file);
      if (error.httpStatus) {
        return res.status(error.httpStatus).json({ success: false, message: error.message });
      }
      console.error('外部上传文件失败:', error);
      res.status(500).json({ success: false, message: '文件上传失败', error: error.message });
    }
  },
);

module.exports = router;
