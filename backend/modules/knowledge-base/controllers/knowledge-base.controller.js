/**
 * 知识库模块 - Controller
 */

const { getDatabase } = require('../../../core/DatabaseInterface');
const { getEventBus } = require('../../../core/EventBus');
const KnowledgeBaseService = require('../services/knowledge-base.service');
const KnowledgeBaseAIService = require('../services/knowledge-base-ai.service');

const db = getDatabase();
const eventBus = getEventBus();
const baseService = new KnowledgeBaseService({ db, eventBus });
const aiService = new KnowledgeBaseAIService({ db, eventBus });

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, status, message, code) =>
  res.status(status).json({ success: false, message, code });

class KnowledgeBaseController {
  // ---------- 知识库 ----------

  async listKnowledgeBases(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await baseService.listKnowledgeBases(tenantId, req.query);
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (e) {
      console.error('listKnowledgeBases:', e);
      fail(res, e.statusCode || 500, e.message);
    }
  }

  async createKnowledgeBase(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await baseService.createKnowledgeBase(tenantId, req.body, req.user || {});
      ok(res, result);
    } catch (e) {
      console.error('createKnowledgeBase:', e);
      fail(res, e.statusCode || 500, e.message, e.code);
    }
  }

  async getKnowledgeBase(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await baseService.getKnowledgeBase(tenantId, req.params.id);
      ok(res, result);
    } catch (e) {
      console.error('getKnowledgeBase:', e);
      fail(res, e.statusCode || 500, e.message, e.code);
    }
  }

  async updateKnowledgeBase(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await baseService.updateKnowledgeBase(tenantId, req.params.id, req.body);
      ok(res, result);
    } catch (e) {
      console.error('updateKnowledgeBase:', e);
      fail(res, e.statusCode || 500, e.message, e.code);
    }
  }

  async deleteKnowledgeBase(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await baseService.deleteKnowledgeBase(tenantId, req.params.id);
      ok(res, result);
    } catch (e) {
      console.error('deleteKnowledgeBase:', e);
      fail(res, e.statusCode || 500, e.message, e.code);
    }
  }

  // ---------- 文档 ----------

  async listDocuments(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await baseService.listDocuments(tenantId, req.query);
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (e) {
      console.error('listDocuments:', e);
      fail(res, e.statusCode || 500, e.message);
    }
  }

  async getDocument(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await baseService.getDocument(tenantId, req.params.id);
      ok(res, result);
    } catch (e) {
      console.error('getDocument:', e);
      fail(res, e.statusCode || 500, e.message, e.code);
    }
  }

  async uploadDocument(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      if (!req.file) return fail(res, 400, '请选择要上传的文件', 'NO_FILE');

      const fileHash = req.body.file_hash || null;
      const title = req.body.title || req.file.originalname.replace(/\.[^.]+$/, '');
      const description = req.body.description || null;
      const kbId = parseInt(req.body.kb_id, 10);
      if (!kbId) return fail(res, 400, '请选择知识库', 'MISSING_KB');

      const result = await baseService.createDocumentRecord(tenantId, {
        kb_id: kbId,
        title,
        description,
        file_name: req.file.originalname,
        file_path: req.file.path,
        file_size: req.file.size,
        file_ext: (req.file.originalname.match(/\.[^.]+$/) || [''])[0].toLowerCase(),
        mime_type: req.file.mimetype,
        file_hash: fileHash,
        uploaded_by: req.user?.real_name || req.user?.username,
        uploaded_by_id: req.user?.id,
      });

      // 同步解析(用户能看到状态;失败时文档保留,可手动重试)
      try {
        await baseService.parseDocument(tenantId, result.id);
      } catch (parseErr) {
        console.warn('parseDocument error:', parseErr.message);
        // 解析失败不影响上传,前端会显示"解析失败,可重试"
      }

      const fullDoc = await baseService.getDocument(tenantId, result.id);
      ok(res, fullDoc);
    } catch (e) {
      console.error('uploadDocument:', e);
      if (req.file?.path) {
        try { require('fs').unlinkSync(req.file.path); } catch (e2) { /* ignore */ }
      }
      fail(res, e.statusCode || 500, e.message, e.code);
    }
  }

  async updateDocument(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await baseService.updateDocument(tenantId, req.params.id, req.body);
      ok(res, result);
    } catch (e) {
      console.error('updateDocument:', e);
      fail(res, e.statusCode || 500, e.message, e.code);
    }
  }

  async deleteDocument(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await baseService.deleteDocument(tenantId, req.params.id);
      ok(res, result);
    } catch (e) {
      console.error('deleteDocument:', e);
      fail(res, e.statusCode || 500, e.message, e.code);
    }
  }

  async reparseDocument(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await baseService.parseDocument(tenantId, req.params.id);
      ok(res, result);
    } catch (e) {
      console.error('reparseDocument:', e);
      fail(res, e.statusCode || 500, e.message, e.code);
    }
  }

  async downloadDocument(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const doc = await baseService.getDocument(tenantId, req.params.id);
      if (!doc.file_path || !require('fs').existsSync(doc.file_path)) {
        return fail(res, 404, '文件不存在', 'FILE_NOT_FOUND');
      }
      res.download(doc.file_path, doc.file_name);
    } catch (e) {
      console.error('downloadDocument:', e);
      fail(res, e.statusCode || 500, e.message, e.code);
    }
  }

  // ---------- 检索 / 问答 ----------

  async search(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await baseService.search(tenantId, req.body || {});
      ok(res, result);
    } catch (e) {
      console.error('search:', e);
      fail(res, e.statusCode || 500, e.message, e.code);
    }
  }

  async ask(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await aiService.ask(
        { tenantId, user: req.user || {} },
        req.body || {}
      );
      ok(res, result);
    } catch (e) {
      console.error('ask:', e);
      fail(res, e.statusCode || 500, e.message, e.code);
    }
  }

  // 流式问答 — 通过 SSE 返回,前端用 fetch+ReadableStream 接收
  async askStream(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const send = (event, data) => {
        try {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (_) { /* ignore */ }
      };

      let result;
      try {
        result = await aiService.askStream(
          { tenantId, user: req.user || {} },
          req.body || {},
          (delta) => send('delta', { text: delta })
        );
        send('done', { ok: true, citations: result.citations, latency_ms: result.latency_ms, provider: result.provider, model: result.model });
      } catch (aiErr) {
        send('error', { message: aiErr.message, code: aiErr.code || 'AI_FAILED' });
      }
      res.end();
    } catch (e) {
      console.error('askStream:', e);
      try {
        if (!res.headersSent) {
          res.status(e.statusCode || 500).json({ success: false, message: e.message, code: e.code });
        } else {
          res.write(`event: error\ndata: ${JSON.stringify({ message: e.message, code: e.code })}\n\n`);
          res.end();
        }
      } catch (_) { /* ignore */ }
    }
  }

  // ---------- 问答记录 ----------

  async listQaRecords(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await baseService.listQaRecords(tenantId, req.query);
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (e) {
      console.error('listQaRecords:', e);
      fail(res, e.statusCode || 500, e.message);
    }
  }

  // ---------- 设置 ----------

  async getSettings(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await baseService.getSettings(tenantId);
      ok(res, result);
    } catch (e) {
      console.error('getSettings:', e);
      fail(res, e.statusCode || 500, e.message);
    }
  }

  async updateSettings(req, res) {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) return fail(res, 400, '缺少租户ID', 'MISSING_TENANT');
      const result = await baseService.updateSettings(tenantId, req.body || {}, req.user?.id);
      ok(res, result);
    } catch (e) {
      console.error('updateSettings:', e);
      fail(res, e.statusCode || 500, e.message, e.code);
    }
  }
}

module.exports = new KnowledgeBaseController();
