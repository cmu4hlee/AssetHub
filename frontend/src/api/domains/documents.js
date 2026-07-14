import { api } from '../client';

export const technicalDocumentsAPI = {
  getTechnicalDocuments: params => api.get('/technical-documents', { params }),
  getTechnicalDocument: id => api.get(`/technical-documents/${id}`),
  getCategories: () => api.get('/technical-documents/categories'),
  uploadTechnicalDocument: formData =>
    api.post('/technical-documents', formData, {    }),
  updateTechnicalDocument: (id, data) => api.put(`/technical-documents/${id}`, data),
  deleteTechnicalDocument: id => api.delete(`/technical-documents/${id}`),
  downloadTechnicalDocument: id => api.get(`/technical-documents/${id}/file`, { responseType: 'blob' }),
  createShareLink: (id, data) => api.post(`/technical-documents/${id}/share`, data),
  getShareLinks: id => api.get(`/technical-documents/${id}/shares`),
  deleteShareLink: shareId => api.delete(`/technical-documents/shares/${shareId}`),
  verifyShareToken: token => api.get(`/technical-documents/upload/${token}`),
  externalUpload: (token, formData) =>
    api.post(`/technical-documents/upload/${token}`, formData, {    }),
  getAssetTechnicalDocuments: assetCode => api.get(`/technical-documents/assets/${assetCode}`),
  linkDocumentToAsset: (assetCode, documentId) =>
    api.post(`/technical-documents/assets/${assetCode}/link/${documentId}`),
  unlinkDocumentFromAsset: (assetCode, documentId) =>
    api.delete(`/technical-documents/assets/${assetCode}/link/${documentId}`),
  createAssetShareLink: (assetCode, data) => api.post(`/assets/${assetCode}/share`, data),
  getAssetShareLinks: assetCode => api.get(`/assets/${assetCode}/shares`),
  deleteAssetShareLink: shareId => api.delete(`/assets/shares/${shareId}`),
  verifyAssetShareToken: token => api.get(`/assets/share/${token}`),
  uploadTechnicalDocumentViaAssetShare: (token, formData) =>
    api.post(`/assets/share/${token}/upload`, formData, {    }),
  reviewTechnicalDocument: (id, data) => api.post(`/technical-documents/${id}/review`, data),
  getPendingTechnicalDocuments: params => api.get('/technical-documents/pending', { params }),
  aiSearch: data => api.post('/technical-documents/ai/search', data),
  getDocumentSummary: id => api.post('/technical-documents/ai/summary', { document_id: id }),
  extractInfo: id => api.post('/technical-documents/ai/extract', { document_id: id }),
  askQuestion: data => api.post('/technical-documents/ai/ask', data),
  getRecommendations: id => api.post('/technical-documents/ai/recommend', { document_id: id }),
  compareDocuments: documentIds =>
    api.post('/technical-documents/ai/compare', { document_ids: documentIds }),
  getUserFavorites: () => api.get('/technical-documents/enhanced/my/favorites'),
  addFavorite: id => api.post(`/technical-documents/enhanced/documents/${id}/favorite`),
  removeFavorite: id => api.delete(`/technical-documents/enhanced/documents/${id}/favorite`),
  getUserHistory: () => api.get('/technical-documents/enhanced/my/history'),
};

export const technicalDocumentsAI = {
  search: data => api.post('/technical-documents/ai/search', data),
  getDocumentSummary: id => api.post('/technical-documents/ai/summary', { document_id: id }),
  extractInfo: id => api.post('/technical-documents/ai/extract', { document_id: id }),
  askQuestion: data => api.post('/technical-documents/ai/ask', data),
  getRecommendations: data => api.post('/technical-documents/ai/recommend', data),
  compareDocuments: documentIds =>
    api.post('/technical-documents/ai/compare', { document_ids: documentIds }),
  suggestTags: data => api.post('/technical-documents/ai/suggest-tags', data),
  suggestCategory: data => api.post('/technical-documents/ai/suggest-category', data),
  processOCR: data => api.post('/technical-documents/ai/ocr', data),
  batchOCR: documentIds => api.post('/technical-documents/ai/batch/ocr', { document_ids: documentIds }),
  batchSummary: (documentIds, maxLength) =>
    api.post('/technical-documents/ai/batch/summary', {
      document_ids: documentIds,
      max_length: maxLength,
    }),
  getConversations: () => api.get('/technical-documents/ai/conversations'),
  getConversationDetail: id => api.get(`/technical-documents/ai/conversations/${id}`),
  deleteConversation: id => api.delete(`/technical-documents/ai/conversations/${id}`),
};

export const auditLogsAPI = {
  getAuditLogs: params => api.get('/audit-logs', { params }),
  getAuditLog: id => api.get(`/audit-logs/${id}`),
  getAuditLogStats: params => api.get('/audit-logs/stats', { params }),
};

export const backupAPI = {
  createBackup: data => api.post('/backup', data),
  getBackups: () => api.get('/backup'),
  restoreBackup: (id, data) => api.post(`/backup/${id}/restore`, data),
  deleteBackup: id => api.delete(`/backup/${id}`),
  downloadBackup: id =>
    api.get(`/backup/${id}/download`, {
      responseType: 'blob',
      timeout: 300000,
    }),
};
