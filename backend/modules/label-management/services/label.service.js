const db = require('../../../config/database');
const logger = require('../../../config/logger');

const buildTenantScopedClause = (tenantId, alias = '') => {
  if (!tenantId) {
    return { clause: '', params: [] };
  }

  const prefix = alias ? `${alias}.` : '';
  return {
    clause: ` AND ${prefix}tenant_id = ?`,
    params: [tenantId],
  };
};

// ZPL生成工具类
class ZPLGenerator {
  constructor() {
    this.zplCommands = [];
  }

  initLabel(width = 4, height = 2, dpi = 203) {
    this.zplCommands.push('^XA');
    this.zplCommands.push(`^PW${Math.round(width * dpi)}`);
    this.zplCommands.push(`^LL${Math.round(height * dpi)}`);
    this.zplCommands.push('^LH0,0');
    this.zplCommands.push('^PR6');
    this.zplCommands.push('^MD20');
    this.zplCommands.push('^CF0,20');
    return this;
  }

  addText(x, y, text, fontSize = 20, rotation = 0, font = '0') {
    this.zplCommands.push(`^FO${x},${y}`);
    this.zplCommands.push(`^A${font},${fontSize},${fontSize}`);
    if (rotation !== 0) {
      this.zplCommands.push('^FR');
    }
    this.zplCommands.push(`^FD${text}^FS`);
    return this;
  }

  addBarcode(x, y, barcode, type = 'CODE128', height = 50, narrowBar = 2, wideBar = 5) {
    this.zplCommands.push(`^FO${x},${y}`);
    this.zplCommands.push(`^BY${narrowBar},${wideBar / narrowBar},${height}`);
    this.zplCommands.push(`^BC^FD${barcode}^FS`);
    return this;
  }

  addQRCode(x, y, data, size = 5) {
    this.zplCommands.push(`^FO${x},${y}`);
    this.zplCommands.push('^BQN,2,10');
    this.zplCommands.push(`^FDMM,A,${data}^FS`);
    return this;
  }

  addLine(x1, y1, x2, y2, thickness = 2) {
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1) || thickness;
    const originX = Math.min(x1, x2);
    const originY = Math.min(y1, y2);
    this.zplCommands.push(`^FO${originX},${originY}`);
    this.zplCommands.push(`^GB${width},${height},${thickness},B,0^FS`);
    return this;
  }

  addRectangle(x, y, width, height, thickness = 2, fill = 0) {
    this.zplCommands.push(`^FO${x},${y}`);
    this.zplCommands.push(`^GB${width},${height},${thickness},B,${fill}^FS`);
    return this;
  }

  endLabel() {
    this.zplCommands.push('^XZ');
    return this;
  }

  generate() {
    return this.zplCommands.join('\n');
  }

  reset() {
    this.zplCommands = [];
    return this;
  }

  static generateAssetLabel(asset, template) {
    const generator = new ZPLGenerator();
    const dpi = template.dpi || 203;

    generator.initLabel(template.width, template.height, dpi);

    const elements =
      typeof template.elements === 'string' ? JSON.parse(template.elements) : template.elements;

    elements.forEach(element => {
      const x = Math.round(element.x * dpi);
      const y = Math.round(element.y * dpi);
      const fontSize = Math.round(element.fontSize * (dpi / 203));
      const width = Math.round(element.width * dpi);
      const height = Math.round(element.height * dpi);

      let { content } = element;
      if (element.field && asset[element.field] !== undefined) {
        content = asset[element.field] || '';
      } else {
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

class LabelService {
  /**
   * 获取标签模板列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页大小
   * @param {string} params.tenantId - 租户ID
   * @returns {Promise<Object>} 模板列表和分页信息
   */
  async getTemplates(params) {
    const { page = 1, pageSize = 20, tenantId } = params;
    const offset = (page - 1) * pageSize;

    const tenantFilter = buildTenantScopedClause(tenantId, 'alt');

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM asset_label_templates alt ${tenantFilter.clause}`,
      tenantFilter.params,
    );

    const [templates] = await db.execute(
      `SELECT alt.* FROM asset_label_templates alt ${tenantFilter.clause} ORDER BY alt.created_at DESC LIMIT ? OFFSET ?`,
      [...tenantFilter.params, pageSize, offset],
    );

    const parsedTemplates = templates.map(template => {
      if (template.elements) {
        template.elements = typeof template.elements === 'string'
          ? JSON.parse(template.elements)
          : template.elements;
      }
      return template;
    });

    return {
      data: parsedTemplates,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / pageSize),
      },
    };
  }

  /**
   * 获取标签模板详情
   * @param {number} id - 模板ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 模板详情
   */
  async getTemplateById(id, tenantId) {
    const tenantFilter = buildTenantScopedClause(tenantId, 'lt');
    const [templates] = await db.execute(
      `SELECT lt.* FROM asset_label_templates lt WHERE lt.id = ? ${tenantFilter.clause}`,
      [id, ...tenantFilter.params],
    );

    if (templates.length === 0) {
      return null;
    }

    const template = templates[0];
    if (template.elements) {
      template.elements = typeof template.elements === 'string'
        ? JSON.parse(template.elements)
        : template.elements;
    }

    return template;
  }

  /**
   * 创建标签模板
   * @param {Object} templateData - 模板数据
   * @param {string} tenantId - 租户ID
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createTemplate(templateData, tenantId, userId) {
    const { name, description, width, height, dpi = 203, elements } = templateData;

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

    return { id: result.insertId };
  }

  /**
   * 更新标签模板
   * @param {number} id - 模板ID
   * @param {Object} templateData - 模板数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 更新结果
   */
  async updateTemplate(id, templateData, tenantId) {
    const { name, description, width, height, dpi, elements } = templateData;
    const tenantFilter = buildTenantScopedClause(tenantId, 'lt');

    // 检查模板是否存在
    const [existing] = await db.execute(
      `SELECT id FROM asset_label_templates lt WHERE lt.id = ? ${tenantFilter.clause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      return false;
    }

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (width !== undefined) {
      updateFields.push('width = ?');
      updateValues.push(width);
    }
    if (height !== undefined) {
      updateFields.push('height = ?');
      updateValues.push(height);
    }
    if (dpi !== undefined) {
      updateFields.push('dpi = ?');
      updateValues.push(dpi);
    }
    if (elements !== undefined) {
      updateFields.push('elements = ?');
      updateValues.push(JSON.stringify(elements));
    }

    if (updateFields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id, ...tenantFilter.params);

    const [result] = await db.execute(
      `UPDATE asset_label_templates SET ${updateFields.join(', ')} WHERE id = ? ${tenantFilter.clause}`,
      updateValues,
    );

    return result.affectedRows > 0;
  }

  /**
   * 删除标签模板
   * @param {number} id - 模板ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteTemplate(id, tenantId) {
    const tenantFilter = buildTenantScopedClause(tenantId, 'lt');

    const [templates] = await db.execute(
      `SELECT name FROM asset_label_templates lt WHERE lt.id = ? ${tenantFilter.clause}`,
      [id, ...tenantFilter.params],
    );

    if (templates.length === 0) {
      return false;
    }

    const [result] = await db.execute(
      `DELETE FROM asset_label_templates WHERE id = ? ${tenantFilter.clause}`,
      [id, ...tenantFilter.params],
    );

    return result.affectedRows > 0;
  }

  /**
   * 生成ZPL标签
   * @param {number} templateId - 模板ID
   * @param {string} assetCode - 资产编码
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} ZPL内容
   */
  async generateZPL(templateId, assetCode, tenantId) {
    // 获取资产信息
    const assetTenantFilter = buildTenantScopedClause(tenantId, 'a');
    const [assets] = await db.execute(
      `SELECT a.* FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.clause}`,
      [assetCode, ...assetTenantFilter.params],
    );

    if (assets.length === 0) {
      throw new Error('资产不存在');
    }

    const asset = assets[0];

    // 获取模板信息
    const templateTenantFilter = buildTenantScopedClause(tenantId, 'alt');
    const [templates] = await db.execute(
      `SELECT alt.* FROM asset_label_templates alt WHERE alt.id = ? ${templateTenantFilter.clause}`,
      [templateId, ...templateTenantFilter.params],
    );

    if (templates.length === 0) {
      throw new Error('标签模板不存在');
    }

    const template = templates[0];
    const zplContent = ZPLGenerator.generateAssetLabel(asset, template);

    return {
      zpl: zplContent,
      asset_name: asset.asset_name,
      asset_code: asset.asset_code,
    };
  }

  /**
   * 批量生成ZPL标签
   * @param {Object} params - 参数
   * @param {Array} params.assetCodes - 资产编码列表
   * @param {number} params.templateId - 模板ID
   * @param {number} params.quantityPerAsset - 每个资产打印数量
   * @param {string} params.tenantId - 租户ID
   * @returns {Promise<Object>} ZPL内容
   */
  async generateZPLBatch(params) {
    const { assetCodes, templateId, quantityPerAsset = 1, tenantId } = params;

    // 获取资产信息
    const assetTenantFilter = buildTenantScopedClause(tenantId, 'a');
    const assetPlaceholders = assetCodes.map(() => '?').join(',');
    const [assets] = await db.execute(
      `SELECT a.* FROM assets a WHERE a.asset_code IN (${assetPlaceholders}) ${assetTenantFilter.clause}`,
      [...assetCodes, ...assetTenantFilter.params],
    );

    if (assets.length === 0) {
      throw new Error('未找到匹配的资产');
    }

    // 获取模板信息
    const templateTenantFilter = buildTenantScopedClause(tenantId, 'lt');
    const [templates] = await db.execute(
      `SELECT lt.* FROM asset_label_templates lt WHERE lt.id = ? ${templateTenantFilter.clause}`,
      [templateId, ...templateTenantFilter.params],
    );

    if (templates.length === 0) {
      throw new Error('标签模板不存在');
    }

    const template = templates[0];

    // 生成ZPL
    let zplContent = '';
    assets.forEach(asset => {
      for (let i = 0; i < quantityPerAsset; i++) {
        zplContent += `${ZPLGenerator.generateAssetLabel(asset, template)}\n`;
      }
    });

    return {
      zpl: zplContent,
      asset_count: assets.length,
      total_quantity: assets.length * quantityPerAsset,
    };
  }

  /**
   * 打印标签
   * @param {Object} params - 打印参数
   * @returns {Promise<Object>} 打印结果
   */
  async printLabel(params) {
    const { assetCode, templateId, printerIp, printerPort, quantity, tenantId } = params;

    // 获取资产信息
    const assetTenantFilter = buildTenantScopedClause(tenantId, 'a');
    const [assets] = await db.execute(
      `SELECT a.* FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.clause}`,
      [assetCode, ...assetTenantFilter.params],
    );

    if (assets.length === 0) {
      throw new Error('资产不存在');
    }

    const asset = assets[0];

    // 获取模板信息
    const templateTenantFilter = buildTenantScopedClause(tenantId, 'lt');
    const [templates] = await db.execute(
      `SELECT lt.* FROM asset_label_templates lt WHERE lt.id = ? ${templateTenantFilter.clause}`,
      [templateId, ...templateTenantFilter.params],
    );

    if (templates.length === 0) {
      throw new Error('标签模板不存在');
    }

    const template = templates[0];

    // 生成ZPL
    let zplContent = '';
    for (let i = 0; i < quantity; i++) {
      zplContent += `${ZPLGenerator.generateAssetLabel(asset, template)}\n`;
    }

    // 发送到打印机（模拟实现）
    await this.sendToPrinter(printerIp, printerPort, zplContent);

    return {
      asset_name: asset.asset_name,
      asset_code: asset.asset_code,
      printer_ip: printerIp,
      printer_port: printerPort,
      quantity,
    };
  }

  /**
   * 发送ZPL到打印机
   * @param {string} ip - 打印机IP
   * @param {number} port - 打印机端口
   * @param {string} zpl - ZPL内容
   * @returns {Promise<boolean>}
   */
  async sendToPrinter(ip, port, zpl) {
    return new Promise((resolve, reject) => {
      // 模拟打印机连接和打印过程
      setTimeout(() => {
        logger.info('打印任务已发送到打印机', { ip, port, zplLength: zpl.length });
        resolve(true);
      }, 500);
    });
  }

  /**
   * 测试打印机连接
   * @param {string} printerIp - 打印机IP
   * @param {number} printerPort - 打印机端口
   * @returns {Promise<Object>} 测试结果
   */
  async testPrinterConnection(printerIp, printerPort) {
    return {
      printer_ip: printerIp,
      printer_port: printerPort,
      reachable: true,
    };
  }

  /**
   * 获取打印队列
   * @param {string} status - 状态过滤
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 打印队列
   */
  async getPrintQueue(status, tenantId) {
    const tenantFilter = buildTenantScopedClause(tenantId, 'pq');
    const whereConditions = [];
    const params = [...tenantFilter.params];

    if (tenantFilter.clause) {
      whereConditions.push(tenantFilter.clause.replace(' AND ', ''));
    }

    if (status) {
      whereConditions.push('pq.print_status = ?');
      params.push(status);
    }

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

    return queue;
  }

  /**
   * 更新打印任务状态
   * @param {number} id - 任务ID
   * @param {string} status - 状态
   * @param {string} errorMessage - 错误信息
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 更新结果
   */
  async updatePrintQueueStatus(id, status, errorMessage, tenantId) {
    const tenantFilter = buildTenantScopedClause(tenantId, 'pq');

    const [result] = await db.execute(
      `UPDATE asset_label_print_queue pq
       SET print_status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? ${tenantFilter.clause}`,
      [status, errorMessage || null, id, ...tenantFilter.params],
    );

    return result.affectedRows > 0;
  }
}

module.exports = new LabelService();
