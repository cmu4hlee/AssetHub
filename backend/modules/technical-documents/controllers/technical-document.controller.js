const { getDatabase } = require('../../../core/DatabaseInterface');
const { getEventBus } = require('../../../core/EventBus');
const technicalDocumentService = require('../services/technical-document.service');
const path = require('path');
const fs = require('fs');
const { logAudit } = require('../../../middleware/auditLogger');

const db = getDatabase();
const eventBus = getEventBus();

const sanitizeUploadFileName = value =>
  String(value || '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .split('')
    .map(char => (char.charCodeAt(0) < 32 ? '_' : char))
    .join('');

async function executeQuery(query, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await db.execute(query, params);
      return result;
    } catch (error) {
      if ((error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ECONNREFUSED') && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}

class TechnicalDocumentController {
  constructor() {
    this.db = db;
    this.eventBus = eventBus;
    this.documentService = new technicalDocumentService({ db, eventBus });
  }

  async getDocuments(req, res) {
    try {
      const { page = 1, pageSize = 20, keyword, category, asset_type, brand, status = 'active', review_status } = req.query;
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      let whereClause = 'WHERE td.status = ? AND td.tenant_id = ?';
      const params = [status, tenantId];

      if (review_status) {
        whereClause += ' AND td.review_status = ?';
        params.push(review_status);
      } else if (status === 'active') {
        whereClause += ' AND td.review_status = ?';
        params.push('approved');
      }

      if (keyword) {
        whereClause += ' AND (td.title LIKE ? OR td.description LIKE ? OR td.file_name LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
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

      const [countResult] = await executeQuery(
        `SELECT COUNT(*) as total FROM technical_documents td ${whereClause}`,
        params,
      );
      const total = countResult?.total || 0;

      const [documents] = await executeQuery(
        `SELECT td.* FROM technical_documents td ${whereClause} ORDER BY td.upload_date DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(pageSize), offset],
      );

      res.json({
        success: true,
        data: documents || [],
        pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total, totalPages: Math.ceil(total / parseInt(pageSize)) },
      });
    } catch (error) {
      console.error('获取技术资料列表失败:', error);
      res.status(500).json({ success: false, message: '获取技术资料列表失败', error: error.message });
    }
  }

  async getCategories(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const [categories] = await executeQuery(
        'SELECT DISTINCT category FROM technical_documents WHERE tenant_id = ? AND status = \'active\' AND category IS NOT NULL ORDER BY category',
        [tenantId],
      );

      res.json({ success: true, data: categories?.map(c => c.category) || [] });
    } catch (error) {
      console.error('获取分类失败:', error);
      res.status(500).json({ success: false, message: '获取分类失败', error: error.message });
    }
  }

  async getDocumentById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id;

      const [documents] = await executeQuery(
        'SELECT * FROM technical_documents WHERE id = ? AND tenant_id = ?',
        [id, tenantId],
      );

      if (!documents || documents.length === 0) {
        return res.status(404).json({ success: false, message: '技术资料不存在' });
      }

      res.json({ success: true, data: documents[0] });
    } catch (error) {
      console.error('获取技术资料详情失败:', error);
      res.status(500).json({ success: false, message: '获取技术资料详情失败', error: error.message });
    }
  }

  async createDocument(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      const { title, description, category, asset_type, brand, model, version, language, is_public, asset_code } = req.body;

      if (!title) {
        if (req.file) {
          try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
        }
        return res.status(400).json({ success: false, message: '资料标题不能为空' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: '请选择要上传的文件' });
      }

      const documentData = {
        title,
        description,
        category,
        asset_type,
        brand,
        model,
        version,
        language: language || 'zh-CN',
        is_public: is_public !== undefined ? (is_public ? 1 : 0) : 0,
        asset_code,
        file_name: req.file.originalname,
        file_path: req.file.path,
        file_size: req.file.size,
      };

      const result = await this.documentService.createDocument(tenantId, documentData);

      // 处理资产关联
      if (asset_code && result.id) {
        try {
          await executeQuery(
            `INSERT INTO technical_document_asset_relations (document_id, asset_code, tenant_id, linked_at)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE linked_at = NOW()`,
            [result.id, asset_code, tenantId],
          );
        } catch (linkErr) {
          console.error('资产关联失败:', linkErr);
        }
      }

      res.json({ success: true, message: '上传成功', data: result });
    } catch (error) {
      // 上传失败时清理已保存的文件
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
      }
      console.error('创建技术资料失败:', error);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async updateDocument(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id;
      const result = await this.documentService.updateDocument(id, tenantId, req.body);
      res.json({ success: true, message: '技术资料更新成功', data: result });
    } catch (error) {
      console.error('更新技术资料失败:', error);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async deleteDocument(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id;

      const [existing] = await executeQuery('SELECT * FROM technical_documents WHERE id = ? AND tenant_id = ?', [id, tenantId]);
      if (!existing || existing.length === 0) {
        return res.status(404).json({ success: false, message: '技术资料不存在' });
      }

      await executeQuery('UPDATE technical_documents SET status = ? WHERE id = ? AND tenant_id = ?', ['deleted', id, tenantId]);

      await logAudit(req, {
        action_type: 'delete',
        module: 'technical_documents',
        resource_type: 'technical_document',
        resource_id: id,
        resource_name: existing[0].title,
        old_value: existing[0],
        response_status: 200,
      });

      res.json({ success: true, message: '技术资料删除成功' });
    } catch (error) {
      console.error('删除技术资料失败:', error);
      res.status(500).json({ success: false, message: '删除技术资料失败', error: error.message });
    }
  }

  async downloadDocument(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id;

      const [documents] = await executeQuery('SELECT * FROM technical_documents WHERE id = ? AND tenant_id = ?', [id, tenantId]);
      if (!documents || documents.length === 0) {
        return res.status(404).json({ success: false, message: '技术资料不存在' });
      }

      const doc = documents[0];
      const filePath = doc.file_path;

      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: '文件不存在' });
      }

      res.download(filePath, doc.file_name);
    } catch (error) {
      console.error('下载技术资料失败:', error);
      res.status(500).json({ success: false, message: '下载技术资料失败', error: error.message });
    }
  }

  async getAssetDocuments(req, res) {
    try {
      const { assetIdOrCode } = req.params;
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const isNumeric = /^\d+$/.test(assetIdOrCode);
      const assetCondition = isNumeric ? '(a.id = ? OR a.asset_code = ?)' : 'a.asset_code = ?';
      const assetParams = isNumeric ? [parseInt(assetIdOrCode, 10), assetIdOrCode] : [assetIdOrCode];

      const [rows] = await executeQuery(
        `SELECT td.*, '直接关联' as link_type
         FROM assets a
         JOIN technical_document_asset_relations tdar ON a.asset_code = tdar.asset_code
         JOIN technical_documents td ON td.id = tdar.document_id AND td.tenant_id = a.tenant_id
         WHERE td.status != ? AND a.tenant_id = ? AND ${assetCondition}
         GROUP BY td.id
         ORDER BY td.upload_date DESC`,
        ['deleted', tenantId, ...assetParams],
      );

      res.json({ success: true, data: rows || [] });
    } catch (error) {
      console.error('获取资产关联资料失败:', error);
      res.status(500).json({ success: false, message: '获取资产关联资料失败', error: error.message });
    }
  }

  async linkDocumentToAsset(req, res) {
    try {
      const { assetIdOrCode, documentId } = req.params;
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      await this.documentService.linkDocumentToAsset(parseInt(documentId), assetIdOrCode, tenantId);
      res.json({ success: true, message: '资料关联成功' });
    } catch (error) {
      console.error('关联资料失败:', error);
      res.status(500).json({ success: false, message: '关联资料失败', error: error.message });
    }
  }

  async unlinkDocumentFromAsset(req, res) {
    try {
      const { assetIdOrCode, documentId } = req.params;
      const tenantId = req.user?.tenant_id;

      await this.documentService.unlinkDocumentFromAsset(parseInt(documentId), assetIdOrCode, tenantId);
      res.json({ success: true, message: '解除关联成功' });
    } catch (error) {
      console.error('解除关联失败:', error);
      res.status(500).json({ success: false, message: '解除关联失败', error: error.message });
    }
  }

  async reviewDocument(req, res) {
    try {
      const { id } = req.params;
      const { approved, review_comment } = req.body;
      const tenantId = req.user?.tenant_id;

      const result = await this.documentService.reviewDocument(id, tenantId, { approved, review_comment });

      await logAudit(req, {
        action_type: 'review',
        module: 'technical_documents',
        resource_type: 'technical_document',
        resource_id: id,
        action_description: `审核技术资料：${approved ? '通过' : '拒绝'}`,
        new_value: { approved, review_comment },
        response_status: 200,
      });

      res.json({ success: true, message: approved ? '审核通过' : '审核拒绝', data: result });
    } catch (error) {
      console.error('审核技术资料失败:', error);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  async getPendingDocuments(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const [documents] = await executeQuery(
        `SELECT td.*, u.username as uploader_name
         FROM technical_documents td
         LEFT JOIN users u ON td.uploaded_by = u.id
         WHERE td.tenant_id = ? AND td.status = 'active' AND td.review_status = 'pending'
         ORDER BY td.upload_date DESC`,
        [tenantId],
      );

      res.json({ success: true, data: documents || [] });
    } catch (error) {
      console.error('获取待审核资料失败:', error);
      res.status(500).json({ success: false, message: '获取待审核资料失败', error: error.message });
    }
  }

  async createShare(req, res) {
    try {
      const { id } = req.params;
      const { expires_in_days, max_downloads } = req.body;
      const tenantId = req.user?.tenant_id;

      const shareToken = require('crypto').randomBytes(32).toString('hex');
      const expiresAt = expires_in_days ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000) : null;

      await executeQuery(
        `INSERT INTO technical_document_shares (document_id, share_token, expires_at, max_downloads, created_by, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, shareToken, expiresAt, max_downloads || null, req.user.id, tenantId],
      );

      res.json({ success: true, message: '分享链接创建成功', data: { share_token: shareToken } });
    } catch (error) {
      console.error('创建分享链接失败:', error);
      res.status(500).json({ success: false, message: '创建分享链接失败', error: error.message });
    }
  }

  async getShares(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id;

      const [shares] = await executeQuery(
        'SELECT * FROM technical_document_shares WHERE document_id = ? AND tenant_id = ? ORDER BY created_at DESC',
        [id, tenantId],
      );

      res.json({ success: true, data: shares || [] });
    } catch (error) {
      console.error('获取分享链接失败:', error);
      res.status(500).json({ success: false, message: '获取分享链接失败', error: error.message });
    }
  }

  async deleteShare(req, res) {
    try {
      const { shareId } = req.params;
      await executeQuery('DELETE FROM technical_document_shares WHERE id = ?', [shareId]);
      res.json({ success: true, message: '分享链接已删除' });
    } catch (error) {
      console.error('删除分享链接失败:', error);
      res.status(500).json({ success: false, message: '删除分享链接失败', error: error.message });
    }
  }

  async verifyUploadToken(req, res) {
    try {
      const { token } = req.params;
      const [tokens] = await executeQuery(
        'SELECT * FROM technical_document_upload_tokens WHERE token = ? AND expires_at > NOW()',
        [token],
      );

      if (!tokens || tokens.length === 0) {
        return res.status(404).json({ success: false, message: '上传令牌无效或已过期' });
      }

      res.json({ success: true, data: { valid: true, tenant_id: tokens[0].tenant_id } });
    } catch (error) {
      console.error('验证上传令牌失败:', error);
      res.status(500).json({ success: false, message: '验证上传令牌失败', error: error.message });
    }
  }

  async externalUpload(req, res) {
    try {
      const { token } = req.params;
      res.json({ success: true, message: '外部上传接口' });
    } catch (error) {
      console.error('外部上传失败:', error);
      res.status(500).json({ success: false, message: '外部上传失败', error: error.message });
    }
  }
}

module.exports = new TechnicalDocumentController();
