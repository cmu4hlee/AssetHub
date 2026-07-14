import { api } from '../client';

// 招标采购模块 API
export const tenderingAPI = {
  // 字典
  getDict: () => api.get('/tendering/dict'),

  // 招标项目
  listProjects: params => api.get('/tendering/projects', { params }),
  getProject: id => api.get(`/tendering/projects/${id}`),
  createProject: data => api.post('/tendering/projects', data),
  updateProject: (id, data) => api.put(`/tendering/projects/${id}`, data),
  changeProjectStatus: (id, status) => api.put(`/tendering/projects/${id}/status`, { status }),
  deleteProject: id => api.delete(`/tendering/projects/${id}`),

  // 采购申请（前置于招标流程）
  listProcurementRequests: params => api.get('/tendering/procurement-requests', { params }),
  getProcurementRequest: id => api.get(`/tendering/procurement-requests/${id}`),
  createProcurementRequest: data => api.post('/tendering/procurement-requests', data),
  updateProcurementRequest: (id, data) => api.put(`/tendering/procurement-requests/${id}`, data),
  submitProcurementRequest: id => api.post(`/tendering/procurement-requests/${id}/submit`),
  approveProcurementRequest: (id, action = 'approve', comment) =>
    api.put(`/tendering/procurement-requests/${id}/approve`, { action, comment }),
  deleteProcurementRequest: id => api.delete(`/tendering/procurement-requests/${id}`),

  // 招标文件制作（章节）
  listSections: tenderId => api.get(`/tendering/projects/${tenderId}/sections`),
  upsertSection: (tenderId, data) => api.post(`/tendering/projects/${tenderId}/sections`, data),
  updateSection: (tenderId, sectionCode, data) =>
    api.put(`/tendering/projects/${tenderId}/sections/${sectionCode}`, data),
  deleteSection: (tenderId, sectionCode) =>
    api.delete(`/tendering/projects/${tenderId}/sections/${sectionCode}`),

  // 招标附件
  listTenderFiles: tenderId => api.get(`/tendering/projects/${tenderId}/files`),
  uploadTenderFile: (tenderId, file, fileType) => {
    const formData = new FormData();
    formData.append('file', file);
    if (fileType) formData.append('file_type', fileType);
    return api.post(`/tendering/projects/${tenderId}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteTenderFile: fileId => api.delete(`/tendering/files/${fileId}`),

  // 供应商管理
  listSuppliers: params => api.get('/tendering/suppliers', { params }),
  getSupplier: id => api.get(`/tendering/suppliers/${id}`),
  createSupplier: data => api.post('/tendering/suppliers', data),
  updateSupplier: (id, data) => api.put(`/tendering/suppliers/${id}`, data),
  setSupplierStatus: (id, status) => api.put(`/tendering/suppliers/${id}/status`, { status }),
  deleteSupplier: id => api.delete(`/tendering/suppliers/${id}`),
  // 轻量下拉列表（资产登记等场景引用供应商名称）
  getSupplierSelectList: params => api.get('/tendering/suppliers/select-list', { params }),
  // 获取已使用的供应商类别列表（用于筛选下拉）
  getSupplierCategories: () => api.get('/tendering/suppliers/categories'),

  // 生成供应商扫码上传资质的二维码 token
  generateSupplierToken: (id, validDays = 30) =>
    api.post(`/tendering/suppliers/${id}/qr-token`, { valid_days: validDays }),

  // 供应商资质查看与审核
  listQualifications: supplierId => api.get(`/tendering/suppliers/${supplierId}/qualifications`),
  reviewQualification: (qualificationId, reviewStatus, reviewComment) =>
    api.put(`/tendering/qualifications/${qualificationId}/review`, {
      review_status: reviewStatus,
      review_comment: reviewComment,
    }),

  // 招标邀请
  listInvitations: tenderId => api.get(`/tendering/projects/${tenderId}/invitations`),
  inviteSupplier: (tenderId, supplierId, validDays = 30) =>
    api.post(`/tendering/projects/${tenderId}/invitations`, {
      supplier_id: supplierId,
      valid_days: validDays,
    }),

  // 投标记录
  listBids: (tenderId, params) => api.get(`/tendering/projects/${tenderId}/bids`, { params }),
  getBid: bidId => api.get(`/tendering/bids/${bidId}`),
  submitBid: (tenderId, data) => api.post(`/tendering/projects/${tenderId}/bids`, data),
  withdrawBid: bidId => api.post(`/tendering/bids/${bidId}/withdraw`),
  awardBid: (tenderId, bidId) => api.post(`/tendering/projects/${tenderId}/award`, { bid_id: bidId }),

  // 评标
  listEvaluations: (tenderId, params) => api.get(`/tendering/projects/${tenderId}/evaluations`, { params }),
  submitEvaluation: (tenderId, data) => api.post(`/tendering/projects/${tenderId}/evaluations`, data),
  summarizeEvaluations: tenderId => api.get(`/tendering/projects/${tenderId}/evaluations/summary`),

  // 统计概览
  getStatistics: () => api.get('/tendering/statistics'),

  // 发票管理（8 态闭环）
  listInvoices: params => api.get('/tendering/invoices', { params }),
  getInvoiceStatistics: () => api.get('/tendering/invoices/statistics'),
  getInvoice: id => api.get(`/tendering/invoices/${id}`),
  createInvoice: data => api.post('/tendering/invoices', data),
  updateInvoice: (id, data) => api.put(`/tendering/invoices/${id}`, data),
  submitInvoice: id => api.post(`/tendering/invoices/${id}/submit`),
  verifyInvoice: id => api.post(`/tendering/invoices/${id}/verify`),
  failVerifyInvoice: (id, error) => api.post(`/tendering/invoices/${id}/verify-fail`, { error }),
  retryInvoice: id => api.post(`/tendering/invoices/${id}/retry`),
  claimInvoice: id => api.post(`/tendering/invoices/${id}/claim`),
  payInvoice: id => api.post(`/tendering/invoices/${id}/pay`),
  archiveInvoice: id => api.post(`/tendering/invoices/${id}/archive`),
  cancelInvoice: id => api.post(`/tendering/invoices/${id}/cancel`),
  deleteInvoice: id => api.delete(`/tendering/invoices/${id}`),
  generateMilestone: (id, remark) => api.post(`/tendering/invoices/${id}/milestone`, remark ? { remark } : {}),
  createInvoiceFromAsset: (assetId, data = {}) => api.post(`/tendering/assets/${assetId}/invoice`, data),
  uploadInvoiceFile: (id, file, fileType) => {
    const form = new FormData();
    form.append('file', file);
    if (fileType) form.append('file_type', fileType);
    return api.post(`/tendering/invoices/${id}/files`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteInvoiceFile: fileId => api.delete(`/tendering/invoices/files/${fileId}`),

  // 付款管理（5 态闭环）
  listPayments: params => api.get('/tendering/payments', { params }),
  getPaymentStatistics: () => api.get('/tendering/payments/statistics'),
  getPayment: id => api.get(`/tendering/payments/${id}`),
  createPayment: data => api.post('/tendering/payments', data),
  updatePayment: (id, data) => api.put(`/tendering/payments/${id}`, data),
  submitPayment: id => api.post(`/tendering/payments/${id}/submit`),
  payPayment: id => api.post(`/tendering/payments/${id}/pay`),
  completePayment: id => api.post(`/tendering/payments/${id}/complete`),
  failPayment: (id, reason) => api.post(`/tendering/payments/${id}/fail`, { failure_reason: reason }),
  reSubmitPayment: id => api.post(`/tendering/payments/${id}/re-submit`),
  cancelPayment: id => api.post(`/tendering/payments/${id}/cancel`),
  deletePayment: id => api.delete(`/tendering/payments/${id}`),

  // 验收管理（4 态闭环）
  listAcceptances: params => api.get('/tendering/acceptances', { params }),
  getAcceptanceStatistics: () => api.get('/tendering/acceptances/statistics'),
  getAcceptance: id => api.get(`/tendering/acceptances/${id}`),
  createAcceptance: data => api.post('/tendering/acceptances', data),
  updateAcceptance: (id, data) => api.put(`/tendering/acceptances/${id}`, data),
  acceptAcceptance: (id, data = {}) => api.post(`/tendering/acceptances/${id}/accept`, data),
  rejectAcceptance: (id, reason) => api.post(`/tendering/acceptances/${id}/reject`, { reason }),
  reprocessAcceptance: id => api.post(`/tendering/acceptances/${id}/reprocess`),
  closeAcceptance: id => api.post(`/tendering/acceptances/${id}/close`),
  deleteAcceptance: id => api.delete(`/tendering/acceptances/${id}`),

  // 审计日志
  listAuditLogs: params => api.get('/tendering/audits', { params }),

  // 综合统计
  getEnhancedStatistics: () => api.get('/tendering/statistics/enhanced'),

  // 审批引擎
  listApprovalFlows: params => api.get('/tendering/approvals/flows', { params }),
  listMyApprovalTodos: params => api.get('/tendering/approvals/todos', { params }),
  listMyInitiatedApprovals: params => api.get('/tendering/approvals/initiated', { params }),
  listPendingApprovalsForRole: params => api.get('/tendering/approvals/pending', { params }),
  approveRequest: (recordId, opinion) => api.post(`/tendering/approvals/${recordId}/approve`, { opinion }),
  rejectRequest: (recordId, opinion) => api.post(`/tendering/approvals/${recordId}/reject`, { opinion }),
  cancelApproval: recordId => api.post(`/tendering/approvals/${recordId}/cancel`),

  // AI 辅助审批（MiniMax-M2.7）
  aiHealth: () => api.get('/tendering/approvals/ai/health'),
  aiAssist: data => api.post('/tendering/approvals/ai/assist', data),
  aiAssistStreamUrl: '/tendering/approvals/ai/assist/stream',

  // ==================== 合同管理 ====================
  // 招标采购闭环：定标(awarded) → 合同签订(contract_signing) → 完成(completed)
  // 合同状态机：draft → pending_review → approved/rejected → signed → executing → archived/terminated
  listContracts: params => api.get('/tendering/contracts', { params }),
  getContractStatistics: () => api.get('/tendering/contracts/statistics'),
  getContract: id => api.get(`/tendering/contracts/${id}`),
  createContract: data => api.post('/tendering/contracts', data),
  updateContract: (id, data) => api.put(`/tendering/contracts/${id}`, data),
  changeContractStatus: (id, status, reviewComment) =>
    api.put(`/tendering/contracts/${id}/status`, { status, review_comment: reviewComment }),
  deleteContract: id => api.delete(`/tendering/contracts/${id}`),
  uploadContractFile: (id, file, fileType) => {
    const formData = new FormData();
    formData.append('file', file);
    if (fileType) formData.append('file_type', fileType);
    return api.post(`/tendering/contracts/${id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteContractFile: fileId => api.delete(`/tendering/contracts/files/${fileId}`),
  listContractsByTender: tenderId => api.get(`/tendering/projects/${tenderId}/contracts`),

  // 招标项目分享 token（项目级二维码，公开扫码）
  generateShareToken: (tenderId, data = {}) => api.post(`/tendering/projects/${tenderId}/share-tokens`, data),
  listShareTokens: tenderId => api.get(`/tendering/projects/${tenderId}/share-tokens`),
  revokeShareToken: tokenId => api.delete(`/tendering/share-tokens/${tokenId}`),

  // 公开接口：扫码者调用（无需登录）
  publicGetTender: token => api.get(`/tendering/public/tender/${token}`),
  publicListFiles: token => api.get(`/tendering/public/tender/${token}/files`),
  publicUploadQualification: (token, formData) =>
    api.post(`/tendering/public/tender/${token}/qualifications`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  publicSubmitBid: (token, formData) =>
    api.post(`/tendering/public/tender/${token}/bids`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// 公开接口（供应商扫码上传资质，免登录）——直接使用 axios，不携带鉴权
import axios from 'axios';
const publicApi = axios.create({ baseURL: '/api' });

export const tenderingPublicAPI = {
  getSupplierByToken: token => publicApi.get(`/tendering/public/supplier/${token}`),
  uploadQualification: (token, file, data) => {
    const formData = new FormData();
    formData.append('file', file);
    if (data) {
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null) formData.append(key, data[key]);
      });
    }
    return publicApi.post(`/tendering/public/supplier/${token}/qualifications`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  // 项目级公开二维码
  getTender: token => publicApi.get(`/tendering/public/tender/${token}`),
  listFiles: token => publicApi.get(`/tendering/public/tender/${token}/files`),
  uploadQualificationByProject: (token, file, data) => {
    const formData = new FormData();
    formData.append('file', file);
    if (data) {
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null) formData.append(key, data[key]);
      });
    }
    return publicApi.post(`/tendering/public/tender/${token}/qualifications`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  submitBid: (token, data, files = []) => {
    const formData = new FormData();
    if (data) {
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null) formData.append(key, data[key]);
      });
    }
    files.forEach(f => formData.append('files', f));
    return publicApi.post(`/tendering/public/tender/${token}/bids`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default tenderingAPI;
