/**
 * 知识库 API 客户端
 */

import { api } from '../client';
import auth from '../../utils/auth';

export const knowledgeBaseAPI = {
  // 知识库
  listKnowledgeBases: params => api.get('/knowledge-base/knowledge-bases', { params }),
  createKnowledgeBase: data => api.post('/knowledge-base/knowledge-bases', data),
  getKnowledgeBase: id => api.get(`/knowledge-base/knowledge-bases/${id}`),
  updateKnowledgeBase: (id, data) => api.put(`/knowledge-base/knowledge-bases/${id}`, data),
  deleteKnowledgeBase: id => api.delete(`/knowledge-base/knowledge-bases/${id}`),

  // 文档
  listDocuments: params => api.get('/knowledge-base/documents', { params }),
  getDocument: id => api.get(`/knowledge-base/documents/${id}`),
  uploadDocument: formData => api.post('/knowledge-base/documents/upload', formData, {}),
  updateDocument: (id, data) => api.put(`/knowledge-base/documents/${id}`, data),
  deleteDocument: id => api.delete(`/knowledge-base/documents/${id}`),
  reparseDocument: id => api.post(`/knowledge-base/documents/${id}/reparse`),
  downloadDocument: id =>
    api.get(`/knowledge-base/documents/${id}/download`, { responseType: 'blob' }),

  // 检索 / 问答
  search: data => api.post('/knowledge-base/search', data),
  ask: data => api.post('/knowledge-base/ask', data),
  // 流式问答 — 返回 { body: ReadableStream, headers } 让调用方自己读 SSE
  askStream: async (data) => {
    const token = auth.getToken();
    const enterprise = auth.getSelectedEnterprise();
    const tenantId = enterprise?.id || auth.getUser()?.tenant_id || null;
    const resp = await fetch('/api/knowledge-base/ask-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { 'X-Tenant-ID': String(tenantId) } : {}),
      },
      body: JSON.stringify(data || {}),
    });
    if (!resp.ok) {
      // 尝试解析错误
      let msg = `HTTP ${resp.status}`;
      try {
        const err = await resp.json();
        msg = err.message || msg;
      } catch (_) { /* ignore */ }
      throw new Error(msg);
    }
    return { body: resp.body, status: resp.status };
  },

  // 问答记录
  listQaRecords: params => api.get('/knowledge-base/qa-records', { params }),

  // 设置
  getSettings: () => api.get('/knowledge-base/settings'),
  updateSettings: data => api.put('/knowledge-base/settings', data),
};
