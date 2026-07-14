const express = require('express');
const router = express.Router();
const controller = require('../controllers/tendering.controller');
const { authenticate } = require('../../../middleware/auth');
const { requireTenantId } = require('../../../middleware/tenant-filter');
const { requireModuleAccess } = require('../../../middleware/module-permission');
const { fileSecurity } = require('../../../middleware/fileSecurity');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// 招标采购模块权限守卫：authenticate + requireTenantId + requireModuleAccess
// 公开接口（/public/*）不应用此守卫，仅内部接口使用
const moduleGuard = [authenticate, requireTenantId, requireModuleAccess('tendering-management')];

// 供应商主数据为通用基础数据（资产登记等也需引用），不强制要求招标模块权限
const supplierGuard = [authenticate, requireTenantId];

// 招标附件上传目录
const tenderUploadDir = path.join(__dirname, '../../../../uploads/tendering');
fs.mkdirSync(tenderUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tenderUploadDir),
  filename: (req, file, cb) => {
    const safeName = String(file.originalname || 'file').replace(/[^\w.-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});
// 限制单文件最大 50MB，避免公开上传接口被滥用
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// 资质文件上传目录
const qualificationUploadDir = path.join(__dirname, '../../../../uploads/tendering/qualifications');
fs.mkdirSync(qualificationUploadDir, { recursive: true });

const qualificationStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, qualificationUploadDir),
  filename: (req, file, cb) => {
    const safeName = String(file.originalname || 'file').replace(/[^\w.-]/g, '_');
    cb(null, `qual_${Date.now()}-${safeName}`);
  },
});
// 公开资质上传限制单文件 20MB
const qualificationUpload = multer({
  storage: qualificationStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ==================== 字典（无需鉴权，方便前端初始化） ====================
router.get('/dict', controller.getDict);

// ==================== 公开接口：供应商扫码上传资质（免登录） ====================
// 通过二维码 token 校验供应商身份
router.get('/public/supplier/:token', controller.getSupplierByToken);
router.post(
  '/public/supplier/:token/qualifications',
  qualificationUpload.single('file'),
  fileSecurity(),
  controller.uploadQualificationByToken,
);

// ==================== 公开接口：项目维度的分享二维码（免登录） ====================
// 任何扫码者（任意供应商）通过 token 访问该招标项目：
//   - GET  /public/tender/:token             获取项目详情
//   - GET  /public/tender/:token/files       列出可下载的招标文件
//   - POST /public/tender/:token/qualifications  上传资质
//   - POST /public/tender/:token/bids        提交投标（支持附件）
router.get('/public/tender/:token', controller.publicGetTender);
router.get('/public/tender/:token/files', controller.publicListFiles);
router.get('/public/tender/:token/files/:fileId', controller.publicDownloadFile);
router.post(
  '/public/tender/:token/qualifications',
  qualificationUpload.single('file'),
  fileSecurity(),
  controller.publicUploadQualification,
);
router.post(
  '/public/tender/:token/bids',
  qualificationUpload.array('files', 5),
  fileSecurity(),
  controller.publicSubmitBid,
);

// ==================== 以下接口需登录鉴权 ====================

// 招标项目
router.get('/projects', ...moduleGuard, controller.listTenders);
router.get('/projects/:id', ...moduleGuard, controller.getTender);
router.post('/projects', ...moduleGuard, controller.createTender);
router.put('/projects/:id', ...moduleGuard, controller.updateTender);
router.put('/projects/:id/status', ...moduleGuard, controller.changeTenderStatus);
router.delete('/projects/:id', ...moduleGuard, controller.deleteTender);

// 招标文件制作
router.get('/projects/:id/sections', ...moduleGuard, controller.listSections);
router.post('/projects/:id/sections', ...moduleGuard, controller.upsertSection);
router.put('/projects/:id/sections/:sectionCode', ...moduleGuard, controller.upsertSection);
router.delete('/projects/:id/sections/:sectionCode', ...moduleGuard, controller.deleteSection);

// 招标附件
router.get('/projects/:id/files', ...moduleGuard, controller.listTenderFiles);
router.post(
  '/projects/:id/files',
  ...moduleGuard,
  upload.single('file'),
  fileSecurity(),
  controller.uploadTenderFile,
);
router.delete('/files/:fileId', ...moduleGuard, controller.deleteTenderFile);

// 供应商管理（主数据，通用基础数据，登录即可访问）
router.get('/suppliers', ...supplierGuard, controller.listSuppliers);
router.get('/suppliers/select-list', ...supplierGuard, controller.getSupplierSelectList);
router.get('/suppliers/categories', ...supplierGuard, controller.getSupplierCategories);
router.get('/suppliers/:id', ...supplierGuard, controller.getSupplier);
router.post('/suppliers', ...supplierGuard, controller.createSupplier);
router.put('/suppliers/:id', ...supplierGuard, controller.updateSupplier);
router.put('/suppliers/:id/status', ...supplierGuard, controller.setSupplierStatus);
router.delete('/suppliers/:id', ...supplierGuard, controller.deleteSupplier);

// 生成/刷新供应商扫码上传资质的二维码 token（招标专属）
router.post('/suppliers/:id/qr-token', ...moduleGuard, controller.generateSupplierToken);

// 供应商资质查看与审核（招标专属）
router.get('/suppliers/:id/qualifications', ...moduleGuard, controller.listQualifications);
router.put('/qualifications/:qualificationId/review', ...moduleGuard, controller.reviewQualification);

// 招标邀请（生成邀请二维码）
router.get('/projects/:id/invitations', ...moduleGuard, controller.listInvitations);
router.post('/projects/:id/invitations', ...moduleGuard, controller.inviteSupplier);

// 投标记录
router.get('/projects/:id/bids', ...moduleGuard, controller.listBids);
router.post('/projects/:id/bids', ...moduleGuard, controller.submitBid);
router.get('/bids/:bidId', ...moduleGuard, controller.getBid);
router.post('/bids/:bidId/withdraw', ...moduleGuard, controller.withdrawBid);
router.post('/projects/:id/award', ...moduleGuard, controller.awardBid);

// 评标
router.get('/projects/:id/evaluations', ...moduleGuard, controller.listEvaluations);
router.post('/projects/:id/evaluations', ...moduleGuard, controller.submitEvaluation);
router.get('/projects/:id/evaluations/summary', ...moduleGuard, controller.summarizeEvaluations);

// 统计概览
router.get('/statistics', ...moduleGuard, controller.getStatistics);

// 招标项目分享 token（项目级二维码）
router.post('/projects/:id/share-tokens', ...moduleGuard, controller.generateShareToken);
router.get('/projects/:id/share-tokens', ...moduleGuard, controller.listShareTokens);
router.delete('/share-tokens/:tokenId', ...moduleGuard, controller.revokeShareToken);

// ==================== 合同管理 ====================
// 招标采购闭环：定标(awarded) → 合同签订(contract_signing) → 完成(completed)
// 合同状态机：draft → pending_review → approved/rejected → signed → executing → archived/terminated
router.get('/contracts', ...moduleGuard, controller.listContracts);
router.get('/contracts/statistics', ...moduleGuard, controller.getContractStatistics);
router.get('/contracts/:id', ...moduleGuard, controller.getContract);
router.post('/contracts', ...moduleGuard, controller.createContract);
router.put('/contracts/:id', ...moduleGuard, controller.updateContract);
router.put('/contracts/:id/status', ...moduleGuard, controller.changeContractStatus);
router.delete('/contracts/:id', ...moduleGuard, controller.deleteContract);
router.post(
  '/contracts/:id/files',
  ...moduleGuard,
  upload.single('file'),
  fileSecurity(),
  controller.uploadContractFile,
);
router.delete('/contracts/files/:fileId', ...moduleGuard, controller.deleteContractFile);

// 按招标项目获取合同列表
router.get('/projects/:id/contracts', ...moduleGuard, controller.listContractsByTender);

// ==================== 健康检查 ====================
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Tendering Management Module is healthy', timestamp: new Date().toISOString() });
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Tendering Management API',
    endpoints: {
      health: '/api/tendering/health',
      projects: '/api/tendering/projects',
      suppliers: '/api/tendering/suppliers',
      contracts: '/api/tendering/contracts',
      procurement_requests: '/api/tendering/procurement-requests',
      public_upload: '/api/tendering/public/supplier/:token/qualifications',
    },
  });
});

// ============================================================
// 采购申请（前置于招标流程，由 simple/agreement tender_category 承载）
// ============================================================
router.get('/procurement-requests', ...moduleGuard, controller.listProcurementRequests);
router.post('/procurement-requests', ...moduleGuard, controller.createProcurementRequest);
router.get('/procurement-requests/:id', ...moduleGuard, controller.getProcurementRequest);
router.put('/procurement-requests/:id', ...moduleGuard, controller.updateProcurementRequest);
router.post('/procurement-requests/:id/submit', ...moduleGuard, controller.submitProcurementRequest);
router.put('/procurement-requests/:id/approve', ...moduleGuard, controller.approveProcurementRequest);
router.delete('/procurement-requests/:id', ...moduleGuard, controller.deleteProcurementRequest);

// ============================================================
// 发票管理（tender_invoices，8 态闭环）
// ============================================================
router.get('/invoices', ...moduleGuard, controller.listInvoices);
router.post('/invoices', ...moduleGuard, controller.createInvoice);
router.get('/invoices/statistics', ...moduleGuard, controller.getInvoiceStatistics);
router.get('/invoices/:id', ...moduleGuard, controller.getInvoice);
router.put('/invoices/:id', ...moduleGuard, controller.updateInvoice);
router.post('/invoices/:id/submit', ...moduleGuard, controller.submitInvoice);
router.post('/invoices/:id/verify', ...moduleGuard, controller.verifyInvoice);
router.post('/invoices/:id/verify-fail', ...moduleGuard, controller.failVerifyInvoice);
router.post('/invoices/:id/retry', ...moduleGuard, controller.retryInvoice);
router.post('/invoices/:id/claim', ...moduleGuard, controller.claimInvoice);
router.post('/invoices/:id/pay', ...moduleGuard, controller.payInvoice);
router.post('/invoices/:id/archive', ...moduleGuard, controller.archiveInvoice);
router.post('/invoices/:id/cancel', ...moduleGuard, controller.cancelInvoice);
router.delete('/invoices/:id', ...moduleGuard, controller.deleteInvoice);
router.post('/invoices/:id/milestone', ...moduleGuard, controller.generateMilestoneFromInvoice);
router.post(
  '/invoices/:id/files',
  ...moduleGuard,
  upload.single('file'),
  fileSecurity(),
  controller.uploadInvoiceFile,
);
router.delete('/invoices/files/:fileId', ...moduleGuard, controller.deleteInvoiceFile);

// 资产侧入账发票生成入口（资产id → 草稿发票）
router.post('/assets/:assetId/invoice', ...moduleGuard, controller.createInvoiceFromAsset);

// 发票图片 OCR 识别（拍照录入：上传发票图片，返回识别字段）
router.post(
  '/invoices/ocr',
  ...moduleGuard,
  upload.single('file'),
  fileSecurity(),
  controller.ocrInvoice,
);

// ============================================================
// 付款管理（tender_payments，5 态闭环）
// ============================================================
router.get('/payments', ...moduleGuard, controller.listPayments);
router.post('/payments', ...moduleGuard, controller.createPayment);
router.get('/payments/statistics', ...moduleGuard, controller.getPaymentStatistics);
router.get('/payments/:id', ...moduleGuard, controller.getPayment);
router.put('/payments/:id', ...moduleGuard, controller.updatePayment);
router.post('/payments/:id/submit', ...moduleGuard, controller.submitPayment);
router.post('/payments/:id/pay', ...moduleGuard, controller.payPayment);
router.post('/payments/:id/complete', ...moduleGuard, controller.completePayment);
router.post('/payments/:id/fail', ...moduleGuard, controller.failPayment);
router.post('/payments/:id/re-submit', ...moduleGuard, controller.reSubmitPayment);
router.post('/payments/:id/cancel', ...moduleGuard, controller.cancelPayment);
router.delete('/payments/:id', ...moduleGuard, controller.deletePayment);

// ============================================================
// 验收管理（tender_acceptances，4 态闭环）
// ============================================================
router.get('/acceptances', ...moduleGuard, controller.listAcceptances);
router.post('/acceptances', ...moduleGuard, controller.createAcceptance);
router.get('/acceptances/statistics', ...moduleGuard, controller.getAcceptanceStatistics);
router.get('/acceptances/:id', ...moduleGuard, controller.getAcceptance);
router.put('/acceptances/:id', ...moduleGuard, controller.updateAcceptance);
router.post('/acceptances/:id/accept', ...moduleGuard, controller.acceptAcceptance);
router.post('/acceptances/:id/reject', ...moduleGuard, controller.rejectAcceptance);
router.post('/acceptances/:id/reprocess', ...moduleGuard, controller.reprocessAcceptance);
router.post('/acceptances/:id/close', ...moduleGuard, controller.closeAcceptance);
router.delete('/acceptances/:id', ...moduleGuard, controller.deleteAcceptance);

// ============================================================
// 审计日志（tender_audit_logs）
// ============================================================
router.get('/audits', ...moduleGuard, controller.listAuditLogs);

// ============================================================
// 综合统计（按月 / 按部门 / 按类型）
// ============================================================
router.get('/statistics/enhanced', ...moduleGuard, controller.getEnhancedStatistics);

// ============================================================
// 审批引擎（Approval Engine）
// ============================================================
router.get('/approvals/flows', ...moduleGuard, controller.listApprovalFlows);
router.get('/approvals/todos', ...moduleGuard, controller.listMyApprovalTodos);
router.get('/approvals/initiated', ...moduleGuard, controller.listMyInitiatedApprovals);
router.get('/approvals/pending', ...moduleGuard, controller.listPendingApprovalsForRole);
router.post('/approvals/:recordId/approve', ...moduleGuard, controller.approveRequest);
router.post('/approvals/:recordId/reject', ...moduleGuard, controller.rejectRequest);
router.post('/approvals/:recordId/cancel', ...moduleGuard, controller.cancelApproval);

// ============================================================
// AI 辅助审批（MiniMax-M2.7）
// 防御：controller.aiHealth/aiAssist/aiAssistStream 在 AI 客户端不可用或加载失败时可能为 undefined。
// 缺失时返回 503 + 友好提示，避免 Express 抛 "Route.post() requires a callback function" 导致模块加载崩溃。
// ============================================================
const aiDisabled = (req, res) => res.status(503).json({ success: false, message: 'AI 辅助审批暂未启用' });
router.get('/approvals/ai/health', ...moduleGuard, controller.aiHealth || aiDisabled);
router.post('/approvals/ai/assist', ...moduleGuard, controller.aiAssist || aiDisabled);
router.post('/approvals/ai/assist/stream', ...moduleGuard, controller.aiAssistStream || aiDisabled);

module.exports = router;
