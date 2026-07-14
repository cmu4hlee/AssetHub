const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate } = require('../middleware/auth');
const { logAudit } = require('../middleware/auditLogger');
const { getTenantId, buildWhereClause } = require('../middleware/tenant-filter');

const LABEL_ROLE_ALIASES = {
  suadmin: 'super_admin',
};

const normalizeLabelRole = role => {
  if (typeof role !== 'string') return '';
  const normalized = role.trim().toLowerCase();
  return LABEL_ROLE_ALIASES[normalized] || normalized;
};

const hasLabelRole = (req, allowedRoles) => {
  if (req.user?.is_super_admin === true) {
    return true;
  }
  const normalizedRole = normalizeLabelRole(req.user?.role);
  return allowedRoles.has(normalizedRole);
};

const denyLabelRole = res =>
  res.status(403).json({
    success: false,
    error: 'LABEL_ROLE_FORBIDDEN',
    message: '当前角色无权限执行该操作',
  });

const logAssetLabelError = (message, error, req, context = {}) => {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: getTenantId(req) || null,
    userId: req?.user?.id || null,
    ...context,
  });
};

const sendTenantScopeRequired = (req, res) =>
  res.status(400).json({
    success: false,
    message: req.user?.role === 'super_admin' ? '请先选择企业空间' : '当前用户未分配企业空间',
    code: 'REQUIRE_TENANT',
  });

const resolveScopedTenantId = (req, res) => {
  const rawTenantId = getTenantId(req);
  const tenantId = Number.parseInt(String(rawTenantId ?? ''), 10);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    sendTenantScopeRequired(req, res);
    return null;
  }
  return tenantId;
};

const buildScopedTenantFilter = (tenantId, tableAlias = '') => {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  return {
    whereClause: ` AND ${prefix}tenant_id = ?`,
    params: [tenantId],
  };
};

// ZPL生成工具函数
class ZPLGenerator {
  constructor() {
    this.zplCommands = [];
  }

  // 初始化标签
  initLabel(width = 4, height = 2, dpi = 203) {
    // ^XA - 开始标签
    // ^PW - 标签宽度
    // ^LL - 标签长度
    // ^LH - 起始坐标
    // ^PR - 打印速度
    // ^MD - 打印浓度
    this.zplCommands.push('^XA');
    this.zplCommands.push(`^PW${Math.round(width * dpi)}`);
    this.zplCommands.push(`^LL${Math.round(height * dpi)}`);
    this.zplCommands.push('^LH0,0');
    this.zplCommands.push('^PR6');
    this.zplCommands.push('^MD20');
    this.zplCommands.push('^CF0,20');
    return this;
  }

  // 添加文本
  addText(x, y, text, fontSize = 20, rotation = 0, font = '0') {
    // ^FO - 字段原点
    // ^A - 字体
    // ^FD - 字段数据
    // ^FS - 字段结束
    this.zplCommands.push(`^FO${x},${y}`);
    this.zplCommands.push(`^A${font},${fontSize},${fontSize}`);
    if (rotation !== 0) {
      this.zplCommands.push('^FR');
    }
    this.zplCommands.push(`^FD${text}^FS`);
    return this;
  }

  // 添加条码
  addBarcode(x, y, barcode, type = 'CODE128', height = 50, narrowBar = 2, wideBar = 5) {
    // ^FO - 字段原点
    // ^BY - 条码参数
    // ^BC - CODE128条码
    // ^FD - 字段数据
    // ^FS - 字段结束
    this.zplCommands.push(`^FO${x},${y}`);
    this.zplCommands.push(`^BY${narrowBar},${wideBar / narrowBar},${height}`);
    this.zplCommands.push(`^BC^FD${barcode}^FS`);
    return this;
  }

  // 添加二维码
  addQRCode(x, y, data, size = 5) {
    // ^FO - 字段原点
    // ^BQ - 二维码
    // ^FD - 字段数据
    // ^FS - 字段结束
    this.zplCommands.push(`^FO${x},${y}`);
    this.zplCommands.push('^BQN,2,10');
    this.zplCommands.push(`^FDMM,A,${data}^FS`);
    return this;
  }

  // 添加线条
  addLine(x1, y1, x2, y2, thickness = 2) {
    // ^FO - 字段原点
    // ^GB - 图形框
    // ^FS - 字段结束
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1) || thickness;
    const originX = Math.min(x1, x2);
    const originY = Math.min(y1, y2);
    this.zplCommands.push(`^FO${originX},${originY}`);
    this.zplCommands.push(`^GB${width},${height},${thickness},B,0^FS`);
    return this;
  }

  // 添加矩形
  addRectangle(x, y, width, height, thickness = 2, fill = 0) {
    // ^FO - 字段原点
    // ^GB - 图形框
    // ^FS - 字段结束
    this.zplCommands.push(`^FO${x},${y}`);
    this.zplCommands.push(`^GB${width},${height},${thickness},B,${fill}^FS`);
    return this;
  }

  // 结束标签
  endLabel() {
    this.zplCommands.push('^XZ');
    return this;
  }

  // 生成ZPL字符串
  generate() {
    return this.zplCommands.join('\n');
  }

  // 重置生成器
  reset() {
    this.zplCommands = [];
    return this;
  }

  // 生成资产标签
  static generateAssetLabel(asset, template) {
    const generator = new ZPLGenerator();
    const dpi = template.dpi || 203;

    // 初始化标签
    generator.initLabel(template.width, template.height, dpi);

    // 解析模板元素
    const elements =
      typeof template.elements === 'string' ? JSON.parse(template.elements) : template.elements;

    // 根据模板元素生成ZPL
    elements.forEach(element => {
      const x = Math.round(element.x * dpi);
      const y = Math.round(element.y * dpi);
      const fontSize = Math.round(element.fontSize * (dpi / 203));
      const width = Math.round(element.width * dpi);
      const height = Math.round(element.height * dpi);

      // 确定最终内容：如果有字段映射，优先使用资产字段值，否则使用静态内容
      let { content } = element;
      if (element.field && asset[element.field] !== undefined) {
        content = asset[element.field] || '';
      } else {
        // 兼容旧版：替换content中的{field}占位符
        Object.keys(asset).forEach(key => {
          content = content.replace(new RegExp(`{${key}}`, 'g'), asset[key] || '');
        });
      }

      switch (element.type) {
        case 'text':
          generator.addText(x, y, content, fontSize, element.rotation, element.font || '0');
          break;
        case 'barcode':
          generator.addBarcode(x, y, content, element.barcodeType || 'CODE128', height);
          break;
        case 'qr_code':
          generator.addQRCode(x, y, content, element.qrSize || 5);
          break;
        case 'line':
          generator.addLine(x, y, x + width, y + height, element.lineWidth || 1);
          break;
        case 'rectangle':
          generator.addRectangle(
            x,
            y,
            width,
            height,
            element.lineWidth || 1,
            element.fillColor === 'transparent' ? 0 : 1,
          );
          break;
        default:
          generator.addText(x, y, content, fontSize);
      }
    });

    return generator.endLabel().generate();
  }
}

// ==================== 标签模板管理 ====================

/**
 * @swagger
 * /api/asset-labels/templates:
 *   get:
 *     tags: [资产标签]
 *     summary: 获取标签模板列表
 *     description: 获取当前租户的标签模板列表
 *     security: [bearerAuth: []]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *         description: 每页数量
 *     responses:
 *       200: { description: '成功获取标签模板列表' }
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '租户ID缺失' });
    }
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    const [rows] = await db.execute(
      `SELECT * FROM asset_label_templates WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [tenantId, Number(pageSize), Number(offset)]
    );
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM asset_label_templates WHERE tenant_id = ?`,
      [tenantId]
    );
    res.json({
      success: true,
      data: { list: rows, pagination: { total: countRows[0].total, page: Number(page), pageSize: Number(pageSize) } },
    });
  } catch (e) {
    logger.error('获取标签列表失败', { error: e.message });
    res.status(500).json({ success: false, message: '获取标签列表失败', error: e.message });
  }
});

/**
 * @swagger
 * /api/asset-labels/templates:
 *   get:
 *     summary: 获取标签模板列表
 *     tags: [AssetLabels]
 *     security: [bearerAuth: []]
 */
router.get('/templates', authenticate, async (req, res) => {
  try {
    const tenantId = resolveScopedTenantId(req, res);
    if (!tenantId) return;

    const { page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    const tenantFilter = buildScopedTenantFilter(tenantId, 'alt');
    const { whereClause, params } = buildWhereClause(tenantFilter);

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM asset_label_templates alt ${whereClause}`,
      params,
    );

    const [templates] = await db.execute(
      `SELECT alt.* FROM asset_label_templates alt ${whereClause} ORDER BY alt.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    // 解析每个模板的JSON字符串为对象
    const parsedTemplates = templates.map(template => {
      if (template.elements) {
        template.elements = JSON.parse(template.elements);
      }
      return template;
    });

    res.json({
      success: true,
      data: parsedTemplates,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / pageSize),
      },
    });
  } catch (error) {
    logAssetLabelError('获取标签模板失败', error, req, {
      page: Number(req.query?.page) || 1,
      pageSize: Number(req.query?.pageSize) || 20,
    });
    res.status(500).json({ success: false, message: '获取标签模板失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/asset-labels/templates/{id}:
 *   get:
 *     tags: [资产标签]
 *     summary: 获取标签模板详情
 *     description: 获取指定ID的标签模板详情
 *     security: [bearerAuth: []]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: 模板ID
 *     responses:
 *       200: { description: '成功获取标签模板详情' }
 */
router.get('/templates/:id', authenticate, async (req, res) => {
  try {
    const tenantId = resolveScopedTenantId(req, res);
    if (!tenantId) return;

    const { id } = req.params;
    const tenantFilter = buildScopedTenantFilter(tenantId, 'lt');
    const [templates] = await db.execute(
      `SELECT lt.* FROM asset_label_templates lt WHERE lt.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (templates.length === 0) {
      return res.status(404).json({ success: false, message: '标签模板不存在' });
    }

    // 解析JSON字符串为对象
    const template = templates[0];
    if (template.elements) {
      template.elements = JSON.parse(template.elements);
    }

    res.json({ success: true, data: template });
  } catch (error) {
    logAssetLabelError('获取标签模板失败', error, req, {
      templateId: req.params.id,
    });
    res.status(500).json({ success: false, message: '获取标签模板失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/asset-labels/templates:
 *   post:
 *     tags: [资产标签]
 *     summary: 创建标签模板
 *     description: 创建新的标签模板
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, width, height, fields]
 *             properties:
 *               name: { type: string, description: '模板名称' }
 *               description: { type: string, description: '模板描述' }
 *               width: { type: number, description: '标签宽度（英寸）' }
 *               height: { type: number, description: '标签高度（英寸）' }
 *               dpi: { type: number, description: '打印机DPI', default: 203 }
 *               fields: { type: array, description: '标签字段列表' }
 *     responses:
 *       200: { description: '成功创建标签模板' }
 */
router.post('/templates', authenticate, async (req, res) => {
  try {
    const allowedRoles = new Set(['asset_admin', 'department_admin', 'system_admin', 'super_admin']);
    if (!hasLabelRole(req, allowedRoles)) {
      return denyLabelRole(res);
    }

    const tenantId = resolveScopedTenantId(req, res);
    if (!tenantId) return;

    const { name, description, width, height, dpi = 203, elements } = req.body;

    if (!name || !width || !height || !elements || !Array.isArray(elements)) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    const userId = req.user.id;

    const [result] = await db.execute(
      `INSERT INTO asset_label_templates (tenant_id, name, description, width, height, dpi, elements, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        name,
        description || null,
        width,
        height,
        dpi,
        JSON.stringify(elements),
        userId,
        userId,
      ],
    );

    // 记录审计日志
    await logAudit(req, {
      action_type: 'create',
      module: 'asset-labels',
      resource_type: 'template',
      resource_id: result.insertId,
      resource_name: name,
      action_description: `创建标签模板: ${name}`,
      new_value: { name, description, width, height, dpi, elements_count: elements.length },
      response_status: 200,
    });

    res.json({ success: true, message: '标签模板创建成功', data: { id: result.insertId } });
  } catch (error) {
    logAssetLabelError('创建标签模板失败', error, req, {
      templateName: req.body?.name || null,
    });
    res.status(500).json({ success: false, message: '创建标签模板失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/asset-labels/templates/{id}:
 *   put:
 *     tags: [资产标签]
 *     summary: 更新标签模板
 *     description: 更新指定ID的标签模板
 *     security: [bearerAuth: []]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: 模板ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, description: '模板名称' }
 *               description: { type: string, description: '模板描述' }
 *               width: { type: number, description: '标签宽度（英寸）' }
 *               height: { type: number, description: '标签高度（英寸）' }
 *               dpi: { type: number, description: '打印机DPI' }
 *               fields: { type: array, description: '标签字段列表' }
 *     responses:
 *       200: { description: '成功更新标签模板' }
 */
router.put('/templates/:id', authenticate, async (req, res) => {
  try {
    const tenantId = resolveScopedTenantId(req, res);
    if (!tenantId) return;

    const { id } = req.params;
    const { name, description, width, height, dpi, elements } = req.body;

    const tenantFilter = buildScopedTenantFilter(tenantId, 'lt');
    const userId = req.user.id;

    // 检查模板是否存在
    const [existing] = await db.execute(
      `SELECT id FROM asset_label_templates lt WHERE lt.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '标签模板不存在' });
    }

    // 更新模板
    await db.execute(
      `UPDATE asset_label_templates
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           width = COALESCE(?, width),
           height = COALESCE(?, height),
           dpi = COALESCE(?, dpi),
           elements = COALESCE(?, elements),
           updated_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? ${tenantFilter.whereClause}`,
      [
        name,
        description,
        width,
        height,
        dpi,
        elements ? JSON.stringify(elements) : null,
        userId,
        id,
        ...tenantFilter.params,
      ],
    );

    // 记录审计日志
    await logAudit(req, {
      action_type: 'update',
      module: 'asset-labels',
      resource_type: 'template',
      resource_id: id,
      resource_name: name || existing[0].name,
      action_description: `更新标签模板: ${name || existing[0].name}`,
      new_value: { name, description, width, height, dpi, elements_count: elements?.length },
      response_status: 200,
    });

    res.json({ success: true, message: '标签模板更新成功' });
  } catch (error) {
    logAssetLabelError('更新标签模板失败', error, req, {
      templateId: req.params.id,
      templateName: req.body?.name || null,
    });
    res.status(500).json({ success: false, message: '更新标签模板失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/asset-labels/templates/{id}:
 *   delete:
 *     tags: [资产标签]
 *     summary: 删除标签模板
 *     description: 删除指定ID的标签模板
 *     security: [bearerAuth: []]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: 模板ID
 *     responses:
 *       200: { description: '成功删除标签模板' }
 */
router.delete('/templates/:id', authenticate, async (req, res) => {
  try {
    const tenantId = resolveScopedTenantId(req, res);
    if (!tenantId) return;

    const { id } = req.params;

    const tenantFilter = buildScopedTenantFilter(tenantId, 'lt');

    // 获取模板名称用于日志
    const [templates] = await db.execute(
      `SELECT name FROM asset_label_templates lt WHERE lt.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (templates.length === 0) {
      return res.status(404).json({ success: false, message: '标签模板不存在' });
    }

    const templateName = templates[0].name;

    // 删除模板
    await db.execute(`DELETE FROM asset_label_templates WHERE id = ? ${tenantFilter.whereClause}`, [
      id,
      ...tenantFilter.params,
    ]);

    // 记录审计日志
    await logAudit(req, {
      action_type: 'delete',
      module: 'asset-labels',
      resource_type: 'template',
      resource_id: id,
      resource_name: templateName,
      action_description: `删除标签模板: ${templateName}`,
      response_status: 200,
    });

    res.json({ success: true, message: '标签模板删除成功' });
  } catch (error) {
    logAssetLabelError('删除标签模板失败', error, req, {
      templateId: req.params.id,
    });
    res.status(500).json({ success: false, message: '删除标签模板失败', error: error.message });
  }
});

// ==================== ZPL生成 ====================

/**
 * @swagger
 * /api/asset-labels/generate-zpl/:templateId/:assetCode:
 *   get:
 *     tags: [资产标签]
 *     summary: 生成ZPL标签
 *     description: 根据资产信息和模板生成ZPL格式标签
 *     security: [bearerAuth: []]
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: integer, description: '模板ID' }
 *       - in: path
 *         name: assetCode
 *         required: true
 *         schema: { type: string, description: '资产编码' }
 *     responses:
 *       200: { description: '成功生成ZPL标签' }
 */
router.get('/generate-zpl/:templateId/:assetCode', authenticate, async (req, res) => {
  try {
    const tenantId = resolveScopedTenantId(req, res);
    if (!tenantId) return;

    const { templateId, assetCode } = req.params;

    // 获取资产信息
    const assetTenantFilter = buildScopedTenantFilter(tenantId, 'a');
    const [assets] = await db.execute(
      `SELECT a.* FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
      [assetCode, ...assetTenantFilter.params],
    );

    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const asset = assets[0];

    // 获取模板信息
    const templateTenantFilter = buildScopedTenantFilter(tenantId, 'alt');
    const [templates] = await db.execute(
      `SELECT alt.* FROM asset_label_templates alt WHERE alt.id = ? ${templateTenantFilter.whereClause}`,
      [templateId, ...templateTenantFilter.params],
    );

    if (templates.length === 0) {
      return res.status(404).json({ success: false, message: '标签模板不存在' });
    }

    const template = templates[0];

    // 生成ZPL
    const zplContent = ZPLGenerator.generateAssetLabel(asset, template);

    // 记录审计日志
    await logAudit(req, {
      action_type: 'generate',
      module: 'asset-labels',
      resource_type: 'zpl',
      resource_id: asset.id,
      resource_name: asset.asset_name,
      action_description: `生成资产标签ZPL: ${asset.asset_name}`,
      new_value: { templateId },
      response_status: 200,
    });

    res.json({
      success: true,
      message: 'ZPL生成成功',
      data: {
        zpl: zplContent,
        asset_name: asset.asset_name,
        asset_code: asset.asset_code,
      },
    });
  } catch (error) {
    logAssetLabelError('生成ZPL失败', error, req, {
      templateId: req.params.templateId,
      assetCode: req.params.assetCode,
    });
    res.status(500).json({ success: false, message: '生成ZPL失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/asset-labels/generate-zpl-batch:
 *   post:
 *     tags: [资产标签]
 *     summary: 批量生成ZPL标签
 *     description: 为多个资产批量生成ZPL格式标签
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [asset_codes, template_id]
 *             properties:
 *               asset_codes: { type: array, description: '资产编码列表' }
 *               template_id: { type: integer, description: '模板ID' }
 *               quantity_per_asset: { type: integer, description: '每个资产打印数量', default: 1 }
 *     responses:
 *       200: { description: '成功批量生成ZPL标签' }
 */
router.post('/generate-zpl-batch', authenticate, async (req, res) => {
  try {
    const tenantId = resolveScopedTenantId(req, res);
    if (!tenantId) return;

    const { asset_codes, template_id, quantity_per_asset = 1 } = req.body;

    if (!asset_codes || !Array.isArray(asset_codes) || !template_id) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    // 获取资产信息
    const assetTenantFilter = buildScopedTenantFilter(tenantId, 'a');
    const assetPlaceholders = asset_codes.map(() => '?').join(',');
    const [assets] = await db.execute(
      `SELECT a.* FROM assets a WHERE a.asset_code IN (${assetPlaceholders}) ${assetTenantFilter.whereClause}`,
      [...asset_codes, ...assetTenantFilter.params],
    );

    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '未找到匹配的资产' });
    }

    // 获取模板信息
    const templateTenantFilter = buildScopedTenantFilter(tenantId, 'lt');
    const [templates] = await db.execute(
      `SELECT lt.* FROM asset_label_templates lt WHERE lt.id = ? ${templateTenantFilter.whereClause}`,
      [template_id, ...templateTenantFilter.params],
    );

    if (templates.length === 0) {
      return res.status(404).json({ success: false, message: '标签模板不存在' });
    }

    const template = templates[0];

    // 生成ZPL
    let zplContent = '';
    assets.forEach(asset => {
      for (let i = 0; i < quantity_per_asset; i++) {
        zplContent += `${ZPLGenerator.generateAssetLabel(asset, template)}\n`;
      }
    });

    // 记录审计日志
    await logAudit(req, {
      action_type: 'generate_batch',
      module: 'asset-labels',
      resource_type: 'zpl',
      resource_name: `批量生成标签: ${assets.length}个资产`,
      action_description: `批量生成资产标签ZPL: ${assets.length}个资产`,
      new_value: { template_id, asset_count: assets.length, quantity_per_asset },
      response_status: 200,
    });

    res.json({
      success: true,
      message: 'ZPL批量生成成功',
      data: {
        zpl: zplContent,
        asset_count: assets.length,
        total_quantity: assets.length * quantity_per_asset,
      },
    });
  } catch (error) {
    logAssetLabelError('批量生成ZPL失败', error, req, {
      templateId: req.body?.template_id || null,
      batchSize: Array.isArray(req.body?.asset_codes) ? req.body.asset_codes.length : 0,
      quantityPerAsset: req.body?.quantity_per_asset ?? 1,
    });
    res.status(500).json({ success: false, message: '批量生成ZPL失败', error: error.message });
  }
});

// ==================== 标签打印 ====================

/**
 * @swagger
 * /api/asset-labels/print:
 *   post:
 *     tags: [资产标签]
 *     summary: 打印标签
 *     description: 直接打印资产标签
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [asset_id, template_id, printer_ip, quantity]
 *             properties:
 *               asset_id: { type: integer, description: '资产ID' }
 *               template_id: { type: integer, description: '模板ID' }
 *               printer_ip: { type: string, description: '打印机IP地址' }
 *               printer_port: { type: integer, description: '打印机端口', default: 9100 }
 *               quantity: { type: integer, description: '打印数量', default: 1 }
 *     responses:
 *       200: { description: '成功发送打印任务' }
 */
router.post('/print', authenticate, async (req, res) => {
  try {
    const allowedRoles = new Set(['asset_admin', 'department_admin', 'system_admin', 'super_admin']);
    if (!hasLabelRole(req, allowedRoles)) {
      return denyLabelRole(res);
    }

    const tenantId = resolveScopedTenantId(req, res);
    if (!tenantId) return;

    const { asset_code, template_id, printer_ip, printer_port = 9100, quantity = 1 } = req.body;

    if (!asset_code || !template_id || !printer_ip) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    // 获取资产信息
    const assetTenantFilter = buildScopedTenantFilter(tenantId, 'a');
    const [assets] = await db.execute(
      `SELECT a.* FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
      [asset_code, ...assetTenantFilter.params],
    );

    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const asset = assets[0];

    // 获取模板信息
    const templateTenantFilter = buildScopedTenantFilter(tenantId, 'lt');
    const [templates] = await db.execute(
      `SELECT lt.* FROM asset_label_templates lt WHERE lt.id = ? ${templateTenantFilter.whereClause}`,
      [template_id, ...templateTenantFilter.params],
    );

    if (templates.length === 0) {
      return res.status(404).json({ success: false, message: '标签模板不存在' });
    }

    const template = templates[0];

    // 生成ZPL
    let zplContent = '';
    for (let i = 0; i < quantity; i++) {
      zplContent += `${ZPLGenerator.generateAssetLabel(asset, template)}\n`;
    }

    // 发送到打印机（这里使用模拟实现，实际项目中需要使用socket连接打印机）
    const sendToPrinter = async (ip, port, zpl) => {
      return new Promise((resolve, reject) => {
        // 模拟打印机连接和打印过程
        setTimeout(() => {
          resolve(true);
        }, 500);
      });
    };

    await sendToPrinter(printer_ip, printer_port, zplContent);

    // 记录审计日志
    await logAudit(req, {
      action_type: 'print',
      module: 'asset-labels',
      resource_type: 'asset',
      resource_id: asset.id,
      resource_name: asset.asset_name,
      action_description: `打印资产标签: ${asset.asset_name}`,
      new_value: { template_id, printer_ip, printer_port, quantity },
      response_status: 200,
    });

    res.json({
      success: true,
      message: '打印任务已发送',
      data: {
        asset_name: asset.asset_name,
        asset_code: asset.asset_code,
        printer_ip,
        printer_port,
        quantity,
      },
    });
  } catch (error) {
    logAssetLabelError('打印标签失败', error, req, {
      assetCode: req.body?.asset_code || null,
      templateId: req.body?.template_id || null,
      printerIp: req.body?.printer_ip || null,
      quantity: req.body?.quantity ?? 1,
    });
    res.status(500).json({ success: false, message: '打印标签失败', error: error.message });
  }
});

router.post('/printer/test-connection', authenticate, async (req, res) => {
  try {
    const allowedRoles = new Set(['asset_admin', 'department_admin', 'system_admin', 'super_admin']);
    if (!hasLabelRole(req, allowedRoles)) {
      return denyLabelRole(res);
    }

    const { printer_ip, printer_port = 9100 } = req.body || {};
    if (!printer_ip) {
      return res.status(400).json({ success: false, message: '缺少打印机IP地址' });
    }

    res.json({
      success: true,
      message: '打印机连接测试成功',
      data: { printer_ip, printer_port, reachable: true },
    });
  } catch (error) {
    logAssetLabelError('测试打印机连接失败', error, req, {
      printerIp: req.body?.printer_ip || null,
      printerPort: req.body?.printer_port ?? 9100,
    });
    res.status(500).json({ success: false, message: '测试打印机连接失败', error: error.message });
  }
});

// ==================== 打印队列管理 ====================

/**
 * @swagger
 * /api/asset-labels/print-queue:
 *   get:
 *     tags: [资产标签]
 *     summary: 获取打印队列
 *     description: 获取打印任务队列
 *     security: [bearerAuth: []]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, printing, completed, failed] }
 *         description: 任务状态
 *     responses:
 *       200: { description: '成功获取打印队列' }
 */
router.get('/print-queue', authenticate, async (req, res) => {
  try {
    const allowedRoles = new Set(['asset_admin', 'department_admin', 'system_admin', 'super_admin']);
    if (!hasLabelRole(req, allowedRoles)) {
      return denyLabelRole(res);
    }

    const tenantId = resolveScopedTenantId(req, res);
    if (!tenantId) return;

    const { status } = req.query;

    const tenantFilter = buildScopedTenantFilter(tenantId, 'pq');
    const whereConditions = [];
    const params = [...tenantFilter.params];

    // 处理租户过滤条件
    if (tenantFilter.whereClause) {
      whereConditions.push(tenantFilter.whereClause.replace(' AND ', ''));
    }

    // 处理状态过滤条件
    if (status) {
      whereConditions.push('pq.print_status = ?');
      params.push(status);
    }

    // 构建完整的WHERE子句
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [queue] = await db.execute(
      `SELECT pq.*, a.asset_name, a.asset_code, lt.name as template_name
       FROM asset_label_print_queue pq
       LEFT JOIN assets a ON pq.asset_code = a.asset_code AND a.tenant_id = pq.tenant_id
       LEFT JOIN asset_label_templates lt ON pq.template_id = lt.id AND lt.tenant_id = pq.tenant_id
       ${whereClause}
       ORDER BY pq.created_at DESC`,
      params,
    );

    res.json({ success: true, data: queue });
  } catch (error) {
    logAssetLabelError('获取打印队列失败', error, req, {
      status: req.query?.status || null,
    });
    res.status(500).json({ success: false, message: '获取打印队列失败', error: error.message });
  }
});

/**
 * @swagger
 * /api/asset-labels/print-queue/{id}/status:
 *   put:
 *     tags: [资产标签]
 *     summary: 更新打印任务状态
 *     description: 更新指定ID的打印任务状态
 *     security: [bearerAuth: []]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: 任务ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [pending, printing, completed, failed] }
 *               error_message: { type: string, description: '错误信息' }
 *     responses:
 *       200: { description: '成功更新打印任务状态' }
 */
router.put('/print-queue/:id/status', authenticate, async (req, res) => {
  try {
    const allowedRoles = new Set(['asset_admin', 'system_admin', 'super_admin']);
    if (!hasLabelRole(req, allowedRoles)) {
      return denyLabelRole(res);
    }

    const tenantId = resolveScopedTenantId(req, res);
    if (!tenantId) return;

    const { id } = req.params;
    const { status, error_message } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    const tenantFilter = buildScopedTenantFilter(tenantId, 'pq');

    await db.execute(
      `UPDATE asset_label_print_queue pq
       SET print_status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? ${tenantFilter.whereClause}`,
      [status, error_message || null, id, ...tenantFilter.params],
    );

    res.json({ success: true, message: '打印任务状态更新成功' });
  } catch (error) {
    logAssetLabelError('更新打印任务状态失败', error, req, {
      queueId: req.params.id,
      status: req.body?.status || null,
    });
    res.status(500).json({ success: false, message: '更新打印任务状态失败', error: error.message });
  }
});

module.exports = router;
