/**
 * 知识库 - 知识库/文档/分块/设置/问答记录 的数据访问与业务逻辑
 */

const BaseService = require('../../../core/BaseService');
const { AppError } = require('../../../utils/error-handler');
const parser = require('./knowledge-base-parser.service');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

class KnowledgeBaseService extends BaseService {
  constructor(options = {}) {
    super({ name: 'KnowledgeBaseService', ...options });
  }

  // ============================================
  // 知识库
  // ============================================

  async listKnowledgeBases(tenantId, { page = 1, pageSize = 20, keyword, status } = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const params = [tenantId];
    let where = 'WHERE tenant_id = ?';
    if (status) { where += ' AND status = ?'; params.push(status); }
    if (keyword) {
      where += ' AND (kb_name LIKE ? OR description LIKE ? OR kb_code LIKE ?)';
      const k = `%${keyword}%`;
      params.push(k, k, k);
    }
    const totalRow = await this.findOne(`SELECT COUNT(*) AS total FROM knowledge_bases ${where}`, params);
    const list = await this.findMany(
      `SELECT * FROM knowledge_bases ${where} ORDER BY sort_order DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    return {
      data: list,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: totalRow?.total || 0,
        totalPages: Math.ceil((totalRow?.total || 0) / parseInt(pageSize)),
      },
    };
  }

  async getKnowledgeBase(tenantId, id) {
    const kb = await this.findOne(
      'SELECT * FROM knowledge_bases WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!kb) throw new AppError('知识库不存在', 404, 'KB_NOT_FOUND');
    return kb;
  }

  async createKnowledgeBase(tenantId, payload, user = {}) {
    const { kb_code, kb_name, description, scope, icon, sort_order } = payload;
    if (!kb_code || !kb_name) {
      throw new AppError('知识库编码和名称不能为空', 400, 'MISSING_FIELD');
    }
    const exist = await this.findOne(
      'SELECT id FROM knowledge_bases WHERE tenant_id = ? AND kb_code = ?',
      [tenantId, kb_code]
    );
    if (exist) throw new AppError('知识库编码已存在', 409, 'KB_CODE_DUPLICATE');
    const [result] = await this.execute(
      `INSERT INTO knowledge_bases
        (tenant_id, kb_code, kb_name, description, scope, icon, sort_order, status, created_by, created_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        tenantId, kb_code, kb_name,
        description || null,
        scope || 'general',
        icon || 'book',
        sort_order || 0,
        user.username || user.real_name || null,
        user.id || null,
      ]
    );
    return { id: result.insertId, kb_code, kb_name };
  }

  async updateKnowledgeBase(tenantId, id, payload) {
    const existing = await this.getKnowledgeBase(tenantId, id);
    const allowed = ['kb_name', 'description', 'scope', 'icon', 'sort_order', 'status'];
    const fields = [];
    const values = [];
    for (const f of allowed) {
      if (payload[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(payload[f]);
      }
    }
    if (fields.length === 0) throw new AppError('没有需要更新的字段', 400, 'NO_FIELDS');
    values.push(id, tenantId);
    await this.execute(
      `UPDATE knowledge_bases SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values
    );
    return { id, ...existing, ...payload };
  }

  async deleteKnowledgeBase(tenantId, id) {
    const existing = await this.getKnowledgeBase(tenantId, id);
    // 软删除:先标记 archived,文档一并标记
    await this.execute(
      `UPDATE knowledge_bases SET status = 'archived', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    // 物理删除分块(避免脏数据);文档保留
    await this.execute(
      'DELETE FROM knowledge_chunks WHERE kb_id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    this.emitEvent('kb:archived', { id, name: existing.kb_name, tenantId });
    return { id };
  }

  // ============================================
  // 文档
  // ============================================

  async listDocuments(tenantId, { page = 1, pageSize = 20, kb_id, keyword, status = 'active', parse_status } = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const params = [tenantId];
    let where = 'WHERE d.tenant_id = ? AND d.status = ?';
    params.push(status);
    if (kb_id) { where += ' AND d.kb_id = ?'; params.push(kb_id); }
    if (parse_status) { where += ' AND d.parse_status = ?'; params.push(parse_status); }
    if (keyword) {
      where += ' AND (d.title LIKE ? OR d.file_name LIKE ? OR d.description LIKE ?)';
      const k = `%${keyword}%`;
      params.push(k, k, k);
    }
    const totalRow = await this.findOne(
      `SELECT COUNT(*) AS total FROM knowledge_documents d ${where}`,
      params
    );
    const list = await this.findMany(
      `SELECT d.*, kb.kb_name FROM knowledge_documents d
       LEFT JOIN knowledge_bases kb ON kb.id = d.kb_id
       ${where}
       ORDER BY d.uploaded_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    return {
      data: list,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: totalRow?.total || 0,
        totalPages: Math.ceil((totalRow?.total || 0) / parseInt(pageSize)),
      },
    };
  }

  async getDocument(tenantId, id) {
    const doc = await this.findOne(
      `SELECT d.*, kb.kb_name FROM knowledge_documents d
       LEFT JOIN knowledge_bases kb ON kb.id = d.kb_id
       WHERE d.id = ? AND d.tenant_id = ?`,
      [id, tenantId]
    );
    if (!doc) throw new AppError('文档不存在', 404, 'DOC_NOT_FOUND');
    return doc;
  }

  async createDocumentRecord(tenantId, payload) {
    const {
      kb_id, title, description, file_name, file_path, file_size,
      file_ext, mime_type, file_hash, uploaded_by, uploaded_by_id,
    } = payload;
    if (!kb_id || !title || !file_name || !file_path) {
      throw new AppError('文档元数据不完整', 400, 'MISSING_FIELD');
    }
    // 验证知识库存在
    await this.getKnowledgeBase(tenantId, kb_id);

    const [result] = await this.execute(
      `INSERT INTO knowledge_documents
        (tenant_id, kb_id, title, description, file_name, file_path, file_size, file_ext, mime_type, file_hash, parse_status, uploaded_by, uploaded_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [tenantId, kb_id, title, description || null, file_name, file_path, file_size || 0,
        file_ext || null, mime_type || null, file_hash || null, uploaded_by || null, uploaded_by_id || null]
    );
    return { id: result.insertId, title, file_name };
  }

  async updateDocument(tenantId, id, payload) {
    const existing = await this.getDocument(tenantId, id);
    const allowed = ['title', 'description', 'kb_id', 'parse_status', 'parse_error', 'parse_failure'];
    const fields = [];
    const values = [];
    for (const f of allowed) {
      if (payload[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(payload[f]);
      }
    }
    if (fields.length === 0) throw new AppError('没有需要更新的字段', 400, 'NO_FIELDS');
    values.push(id, tenantId);
    await this.execute(
      `UPDATE knowledge_documents SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values
    );
    return { id, ...existing, ...payload };
  }

  async deleteDocument(tenantId, id) {
    const existing = await this.getDocument(tenantId, id);
    // 软删除文档 + 物理删除分块 + 删物理文件
    await this.execute(
      `UPDATE knowledge_documents SET status = 'deleted' WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    await this.execute(
      'DELETE FROM knowledge_chunks WHERE doc_id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (existing.file_path) {
      try { await fsp.unlink(existing.file_path); } catch (e) { /* ignore */ }
    }
    await this.updateKbStats(tenantId, existing.kb_id);
    this.emitEvent('kb:document:deleted', { id, title: existing.title, tenantId });
    return { id };
  }

  // ============================================
  // 解析流程
  // ============================================

  async parseDocument(tenantId, docId) {
    const doc = await this.getDocument(tenantId, docId);
    if (!doc.file_path || !fs.existsSync(doc.file_path)) {
      await this.updateDocument(tenantId, docId, {
        parse_status: 'failed',
        parse_error: '文件不存在',
      });
      throw new AppError('文件不存在', 404, 'FILE_NOT_EXISTS');
    }

    const settings = await this.getSettings(tenantId);

    await this.updateDocument(tenantId, docId, { parse_status: 'parsing', parse_error: null });

    let text = '';
    try {
      text = await parser.extractText(doc.file_path, doc.file_ext);
    } catch (err) {
      await this.updateDocument(tenantId, docId, {
        parse_status: 'failed',
        parse_error: err.message,
      });
      throw err;
    }

    if (!text || text.length < 10) {
      await this.updateDocument(tenantId, docId, {
        parse_status: 'failed',
        parse_error: '文档内容为空或无法识别',
      });
      throw new AppError('文档内容为空或无法识别', 400, 'EMPTY_CONTENT');
    }

    const chunks = parser.splitIntoChunks(text, {
      chunkSize: settings.chunk_size,
      chunkOverlap: settings.chunk_overlap,
    });

    // 替换原分块
    await this.execute('DELETE FROM knowledge_chunks WHERE doc_id = ? AND tenant_id = ?', [docId, tenantId]);
    for (const chunk of chunks) {
      await this.execute(
        `INSERT INTO knowledge_chunks (tenant_id, doc_id, kb_id, chunk_index, content, content_length, keywords, tokens_estimate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, docId, doc.kb_id, chunk.chunk_index, chunk.content, chunk.content_length,
          JSON.stringify(chunk.keywords), chunk.tokens_estimate]
      );
    }

    await this.execute(
      `UPDATE knowledge_documents SET parse_status = 'ready', parse_error = NULL, parsed_at = NOW(),
        char_count = ?, chunk_count = ? WHERE id = ? AND tenant_id = ?`,
      [text.length, chunks.length, docId, tenantId]
    );
    await this.updateKbStats(tenantId, doc.kb_id);

    this.emitEvent('kb:document:parsed', { id: docId, kb_id: doc.kb_id, chunks: chunks.length, tenantId });
    return { id: docId, char_count: text.length, chunk_count: chunks.length };
  }

  async updateKbStats(tenantId, kbId) {
    if (!kbId) return;
    try {
      const docRow = await this.findOne(
        'SELECT COUNT(*) AS c FROM knowledge_documents WHERE tenant_id = ? AND kb_id = ? AND status = \'active\'',
        [tenantId, kbId]
      );
      const chunkRow = await this.findOne(
        'SELECT COUNT(*) AS c FROM knowledge_chunks WHERE tenant_id = ? AND kb_id = ?',
        [tenantId, kbId]
      );
      await this.execute(
        'UPDATE knowledge_bases SET doc_count = ?, chunk_count = ? WHERE id = ? AND tenant_id = ?',
        [docRow?.c || 0, chunkRow?.c || 0, kbId, tenantId]
      );
    } catch (e) {
      console.warn('[KbStats] updateKbStats 失败:', e.message);
    }
  }

  // ============================================
  // 检索
  // ============================================

  async search(tenantId, { question, kb_id, top_k, min_score }) {
    if (!question || !String(question).trim()) {
      throw new AppError('问题不能为空', 400, 'EMPTY_QUESTION');
    }
    const settings = await this.getSettings(tenantId);
    const params = [tenantId];
    let where = 'WHERE c.tenant_id = ?';
    if (kb_id) { where += ' AND c.kb_id = ?'; params.push(kb_id); }
    const rows = await this.findMany(
      `SELECT c.id, c.doc_id, c.kb_id, c.chunk_index, c.content, c.keywords,
              d.title AS doc_title, d.file_name, kb.kb_name
       FROM knowledge_chunks c
       LEFT JOIN knowledge_documents d ON d.id = c.doc_id
       LEFT JOIN knowledge_bases kb ON kb.id = c.kb_id
       ${where} LIMIT 5000`,
      params
    );
    const enriched = rows.map(r => ({
      ...r,
      keywords: safeJsonArray(r.keywords),
    }));
    const results = parser.searchChunks(enriched, question, {
      topK: top_k || settings.top_k,
      minScore: min_score != null ? min_score : settings.min_score,
    });
    return {
      results,
      total: results.length,
    };
  }

  // ============================================
  // 问答记录
  // ============================================

  async saveQaRecord(record) {
    const {
      tenantId, kb_id, session_id, user_id, user_name, question, answer,
      retrieved_chunks, citations, provider, model, latency_ms, status, error_message,
    } = record;
    const [result] = await this.execute(
      `INSERT INTO knowledge_qa_records
        (tenant_id, kb_id, session_id, user_id, user_name, question, answer,
         retrieved_chunks, citations, provider, model, latency_ms, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, kb_id || null, session_id || null, user_id || null, user_name || null,
        question, answer || null,
        retrieved_chunks ? JSON.stringify(retrieved_chunks) : null,
        citations ? JSON.stringify(citations) : null,
        provider || null, model || null, latency_ms || 0,
        status || 'success', error_message || null,
      ]
    );
    return { id: result.insertId };
  }

  async listQaRecords(tenantId, { page = 1, pageSize = 20, kb_id, user_id, session_id, keyword } = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const params = [tenantId];
    let where = 'WHERE tenant_id = ?';
    if (kb_id) { where += ' AND kb_id = ?'; params.push(kb_id); }
    if (user_id) { where += ' AND user_id = ?'; params.push(user_id); }
    if (session_id) { where += ' AND session_id = ?'; params.push(session_id); }
    if (keyword) {
      where += ' AND (question LIKE ? OR answer LIKE ?)';
      const k = `%${keyword}%`;
      params.push(k, k);
    }
    const totalRow = await this.findOne(
      `SELECT COUNT(*) AS total FROM knowledge_qa_records ${where}`,
      params
    );
    const list = await this.findMany(
      `SELECT id, kb_id, session_id, user_id, user_name, question, answer,
              citations, provider, model, latency_ms, status, error_message, created_at
       FROM knowledge_qa_records ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    return {
      data: list.map(r => ({
        ...r,
        citations: safeJsonArray(r.citations),
      })),
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: totalRow?.total || 0,
        totalPages: Math.ceil((totalRow?.total || 0) / parseInt(pageSize)),
      },
    };
  }

  // ============================================
  // 设置
  // ============================================

  async getSettings(tenantId) {
    let row = await this.findOne(
      'SELECT * FROM knowledge_settings WHERE tenant_id = ?',
      [tenantId]
    );
    if (!row) {
      await this.execute(
        'INSERT INTO knowledge_settings (tenant_id) VALUES (?)',
        [tenantId]
      );
      row = await this.findOne(
        'SELECT * FROM knowledge_settings WHERE tenant_id = ?',
        [tenantId]
      );
    }
    return row;
  }

  async updateSettings(tenantId, payload, userId) {
    const allowed = ['chunk_size', 'chunk_overlap', 'top_k', 'min_score', 'ai_enabled', 'ai_provider', 'ai_model', 'system_prompt', 'max_context_chars'];
    const fields = [];
    const values = [];
    for (const f of allowed) {
      if (payload[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(payload[f]);
      }
    }
    if (fields.length === 0) throw new AppError('没有需要更新的字段', 400, 'NO_FIELDS');
    values.push(tenantId);
    await this.execute(
      `UPDATE knowledge_settings SET ${fields.join(', ')}, updated_at = NOW(), updated_by = ? WHERE tenant_id = ?`,
      [userId || null, ...values]
    );
    return this.getSettings(tenantId);
  }
}

function safeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

module.exports = KnowledgeBaseService;
