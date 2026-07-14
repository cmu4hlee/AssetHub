const BaseService = require('../../../core/BaseService');
const { AppError } = require('../../../utils/error-handler');

class TechnicalDocumentService extends BaseService {
  constructor(options = {}) {
    super({ name: 'TechnicalDocumentService', ...options });
  }

  async getDocuments(tenantId, { page = 1, pageSize = 20, keyword, category, asset_type, brand, status = 'active' } = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    let whereClause = 'WHERE td.status = ? AND td.tenant_id = ?';
    const params = [status, tenantId];

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

    const countResult = await this.findOne(
      `SELECT COUNT(*) as total FROM technical_documents td ${whereClause}`,
      params,
    );
    const {total} = countResult;

    const documents = await this.findMany(
      `SELECT td.* FROM technical_documents td ${whereClause} ORDER BY td.upload_date DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    return {
      data: documents,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize)),
      },
    };
  }

  async getDocumentById(id, tenantId) {
    const doc = await this.findOne(
      'SELECT * FROM technical_documents WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (!doc) {
      throw new AppError('技术资料不存在', 404, 'DOCUMENT_NOT_FOUND');
    }
    return doc;
  }

  async createDocument(tenantId, documentData) {
    const {
      title, description, category, asset_type, brand, model, version, language, is_public,
      file_name, file_path, file_size, review_status = 'pending', status = 'active',
    } = documentData;

    if (!title) {
      throw new AppError('资料标题不能为空', 400, 'MISSING_TITLE');
    }

    const [result] = await this.execute(
      `INSERT INTO technical_documents
        (tenant_id, title, description, category, asset_type, brand, model, version, language, is_public,
         file_name, file_path, file_size, review_status, upload_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [tenantId, title, description || null, category || null, asset_type || null, brand || null,
       model || null, version || null, language || 'zh-CN', is_public || 0,
       file_name || null, file_path || null, file_size || null, review_status, status],
    );

    this.emitEvent('document:created', { id: result.insertId, title, tenantId });
    return { id: result.insertId, title, file_name, file_path };
  }

  async updateDocument(id, tenantId, documentData) {
    const existingDoc = await this.getDocumentById(id, tenantId);
    const fields = [];
    const values = [];
    const allowedFields = ['title', 'description', 'category', 'asset_type', 'brand'];

    for (const field of allowedFields) {
      if (documentData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(documentData[field]);
      }
    }

    if (fields.length === 0) {
      throw new AppError('没有需要更新的字段', 400, 'NO_FIELDS_TO_UPDATE');
    }

    values.push(id, tenantId);
    const [result] = await this.execute(
      `UPDATE technical_documents SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      throw new AppError('技术资料更新失败', 500, 'UPDATE_FAILED');
    }

    this.emitEvent('document:updated', { id, tenantId, old_value: existingDoc });
    return { id };
  }

  async deleteDocument(id, tenantId) {
    const existingDoc = await this.getDocumentById(id, tenantId);
    const [result] = await this.execute(
      'UPDATE technical_documents SET status = ? WHERE id = ? AND tenant_id = ?',
      ['deleted', id, tenantId],
    );

    if (result.affectedRows === 0) {
      throw new AppError('技术资料删除失败', 500, 'DELETE_FAILED');
    }

    this.emitEvent('document:deleted', { id, title: existingDoc.title, tenantId });
    return { id };
  }

  async reviewDocument(id, tenantId, { approved, review_comment }) {
    const existingDoc = await this.getDocumentById(id, tenantId);
    const reviewStatus = approved ? 'approved' : 'rejected';

    await this.execute(
      'UPDATE technical_documents SET review_status = ?, review_comment = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [reviewStatus, review_comment || null, id, tenantId],
    );

    this.emitEvent('document:reviewed', { id, reviewStatus, approved, tenantId });
    return { id, reviewStatus };
  }

  async linkDocumentToAsset(documentId, assetCode, tenantId) {
    const [result] = await this.execute(
      `INSERT INTO technical_document_asset_relations (document_id, asset_code, tenant_id, linked_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE linked_at = NOW()`,
      [documentId, assetCode, tenantId],
    );

    this.emitEvent('document:linked', { documentId, assetCode, tenantId });
    return { success: true };
  }

  async unlinkDocumentFromAsset(documentId, assetCode, tenantId) {
    const [result] = await this.execute(
      'DELETE FROM technical_document_asset_relations WHERE document_id = ? AND asset_code = ? AND tenant_id = ?',
      [documentId, assetCode, tenantId],
    );

    this.emitEvent('document:unlinked', { documentId, assetCode, tenantId });
    return { success: true };
  }

  async getCategories(tenantId) {
    const categories = await this.findMany(
      'SELECT DISTINCT category FROM technical_documents WHERE tenant_id = ? AND status = \'active\' AND category IS NOT NULL ORDER BY category',
      [tenantId],
    );
    return categories.map(c => c.category);
  }
}

module.exports = TechnicalDocumentService;
