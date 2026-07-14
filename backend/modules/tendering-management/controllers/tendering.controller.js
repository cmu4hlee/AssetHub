const tenderingService = require('../services/tendering.service');
const ProcurementRequestService = require('../services/procurement-request.service');
const procurementRequestService = new ProcurementRequestService();
const TenderingInvoiceService = require('../services/tender-invoice.service');
const invoiceService = new TenderingInvoiceService();
const TenderingPaymentService = require('../services/tender-payment.service');
const paymentService = new TenderingPaymentService();
const TenderingAcceptanceService = require('../services/tender-acceptance.service');
const acceptanceService = new TenderingAcceptanceService();
const TenderingAuditLogService = require('../services/tender-audit-log.service');
const auditLogService = new TenderingAuditLogService();
const ApprovalEngine = require('../services/approval-engine.service');
const approvalEngine = new ApprovalEngine();
const AIApprovalAssistant = require('../services/ai-approval-assistant.service');
const aiAssistant = new AIApprovalAssistant();
const { getTenantId } = require('../../../middleware/tenant-filter');
const logger = require('../../../config/logger');

function handle(res, promise, actionLabel) {
  return promise
    .then(data => res.json({ success: true, message: `${actionLabel}成功`, data }))
    .catch(error => {
      logger.error(`${actionLabel}失败:`, error);
      const status = /不存在|无效|不能|已存在|仅|必须|过期|撤销|开放|缺失|拒绝|过于频繁|截止|状态|权限/.test(error.message) ? 400 : 500;
      res.status(status).json({ success: false, message: error.message || `${actionLabel}失败` });
    });
}

class TenderingController {
  // ==================== 招标项目 ====================

  async listTenders(req, res) {
    const tenantId = getTenantId(req);
    const result = await tenderingService.listTenders({
      page: req.query.page,
      pageSize: req.query.pageSize,
      keyword: req.query.keyword,
      tender_type: req.query.tender_type,
      status: req.query.status,
      tenantId,
    });
    return res.json({ success: true, message: '获取招标项目列表成功', data: result.data, pagination: result.pagination });
  }

  async getTender(req, res) {
    return handle(res, tenderingService.getTenderById(req.params.id, getTenantId(req)).then(d => {
      if (!d) throw new Error('招标项目不存在');
      return d;
    }), '获取招标项目');
  }

  async createTender(req, res) {
    return handle(res, tenderingService.createTender(req.body, getTenantId(req), req.user?.id), '创建招标项目');
  }

  async updateTender(req, res) {
    return handle(res, tenderingService.updateTender(req.params.id, req.body, getTenantId(req)), '更新招标项目');
  }

  async changeTenderStatus(req, res) {
    return handle(res, tenderingService.changeTenderStatusWithApproval(
      req.params.id, req.body.status, getTenantId(req), req.user,
    ), '更新招标状态');
  }

  async deleteTender(req, res) {
    return handle(res, tenderingService.deleteTender(req.params.id, getTenantId(req)), '删除招标项目');
  }

  // ==================== 招标文件制作 ====================

  async listSections(req, res) {
    return handle(res, tenderingService.listSections(req.params.id, getTenantId(req)), '获取招标文件章节');
  }

  async upsertSection(req, res) {
    return handle(res, tenderingService.upsertSection(req.params.id, req.body, getTenantId(req), req.user?.id), '保存招标文件章节');
  }

  async deleteSection(req, res) {
    return handle(res, tenderingService.deleteSection(req.params.id, req.params.sectionCode, getTenantId(req)), '删除招标文件章节');
  }

  async uploadTenderFile(req, res) {
    if (!req.file) return res.status(400).json({ success: false, message: '请上传招标附件' });
    return handle(res, tenderingService.uploadTenderFile(req.params.id, req.file, req.body, getTenantId(req), req.user?.id), '上传招标附件');
  }

  async listTenderFiles(req, res) {
    return handle(res, tenderingService.listTenderFiles(req.params.id, getTenantId(req)), '获取招标附件');
  }

  // ==================== 供应商管理 ====================

  async listSuppliers(req, res) {
    const tenantId = getTenantId(req);
    const result = await tenderingService.listSuppliers({
      page: req.query.page,
      pageSize: req.query.pageSize,
      keyword: req.query.keyword,
      status: req.query.status,
      category: req.query.category,
      tenantId,
    });
    return res.json({ success: true, message: '获取供应商列表成功', data: result.data, pagination: result.pagination });
  }

  // 轻量下拉列表（资产登记等场景引用供应商名称）
  async getSupplierSelectList(req, res) {
    const tenantId = getTenantId(req);
    const data = await tenderingService.getSupplierSelectList({
      keyword: req.query.keyword,
      status: req.query.status,
      tenantId,
    });
    return res.json({ success: true, data });
  }

  // 获取已使用的供应商类别列表（用于筛选下拉）
  async getSupplierCategories(req, res) {
    const tenantId = getTenantId(req);
    const data = await tenderingService.getSupplierCategories(tenantId);
    return res.json({ success: true, data });
  }

  async getSupplier(req, res) {
    return handle(res, tenderingService.getSupplierById(req.params.id, getTenantId(req)).then(d => {
      if (!d) throw new Error('供应商不存在');
      return d;
    }), '获取供应商');
  }

  async createSupplier(req, res) {
    return handle(res, tenderingService.createSupplier(req.body, getTenantId(req)), '创建供应商');
  }

  async updateSupplier(req, res) {
    return handle(res, tenderingService.updateSupplier(req.params.id, req.body, getTenantId(req)), '更新供应商');
  }

  async setSupplierStatus(req, res) {
    return handle(res, tenderingService.setSupplierStatus(req.params.id, req.body.status, getTenantId(req)), '更新供应商状态');
  }

  async deleteSupplier(req, res) {
    return handle(res, tenderingService.deleteSupplier(req.params.id, getTenantId(req)), '删除供应商');
  }

  // 生成/刷新供应商扫码上传资质的二维码 token
  async generateSupplierToken(req, res) {
    const validDays = Number(req.body.valid_days) || 30;
    return handle(res, tenderingService.generateSupplierToken(req.params.id, getTenantId(req), validDays), '生成供应商二维码');
  }

  // 查看某供应商的资质材料
  async listQualifications(req, res) {
    return handle(res, tenderingService.listQualifications(req.params.id, getTenantId(req)), '获取供应商资质');
  }

  // 审核资质
  async reviewQualification(req, res) {
    return handle(res, tenderingService.reviewQualification(
      req.params.qualificationId,
      req.body.review_status,
      req.body.review_comment,
      getTenantId(req),
      req.user?.id,
    ), '审核资质');
  }

  // ==================== 公开接口：供应商扫码上传资质（免登录） ====================

  async getSupplierByToken(req, res) {
    const token = String(req.params.token || req.query.token || '').trim();
    return handle(res, tenderingService.getSupplierByToken(token).then(d => {
      if (!d) throw new Error('二维码无效');
      return d;
    }), '校验供应商二维码');
  }

  async uploadQualificationByToken(req, res) {
    if (!req.file) return res.status(400).json({ success: false, message: '请上传资质文件' });
    return handle(res, tenderingService.uploadQualificationByToken(req.params.token, req.file, req.body), '上传供应商资质');
  }

  // ==================== 招标邀请 ====================

  async inviteSupplier(req, res) {
    const validDays = Number(req.body.valid_days) || 30;
    return handle(res, tenderingService.inviteSupplier(req.params.id, req.body.supplier_id, getTenantId(req), validDays), '邀请供应商');
  }

  async listInvitations(req, res) {
    return handle(res, tenderingService.listInvitations(req.params.id, getTenantId(req)), '获取招标邀请列表');
  }

  // ==================== 投标/评标 ====================

  async listBids(req, res) {
    return handle(res, tenderingService.listBids(req.params.id, getTenantId(req), {
      keyword: req.query.keyword,
      status: req.query.status,
    }), '获取投标记录');
  }

  async getBid(req, res) {
    return handle(res, tenderingService.getBidById(req.params.bidId, getTenantId(req)).then(d => {
      if (!d) throw new Error('投标记录不存在');
      return d;
    }), '获取投标详情');
  }

  async submitBid(req, res) {
    return handle(res, tenderingService.submitBid(req.params.id, req.body, getTenantId(req)), '提交投标');
  }

  async withdrawBid(req, res) {
    return handle(res, tenderingService.withdrawBid(req.params.bidId, getTenantId(req)), '撤销投标');
  }

  async awardBid(req, res) {
    const bidId = Number(req.body.bid_id || req.params.bidId || 0);
    return handle(res, tenderingService.awardBid(req.params.id, bidId, getTenantId(req)), '定标中标');
  }

  async listEvaluations(req, res) {
    return handle(res, tenderingService.listEvaluations(req.params.id, getTenantId(req), {
      bidId: req.query.bid_id,
    }), '获取评标记录');
  }

  async submitEvaluation(req, res) {
    return handle(res, tenderingService.submitEvaluation(req.params.id, req.body, getTenantId(req), req.user?.id), '提交评标');
  }

  async summarizeEvaluations(req, res) {
    return handle(res, tenderingService.summarizeEvaluations(req.params.id, getTenantId(req)), '汇总评标结果');
  }

  // ==================== 统计概览 ====================

  async getStatistics(req, res) {
    return handle(res, tenderingService.getStatistics(getTenantId(req)), '获取招标采购统计');
  }

  // ==================== 附件删除 ====================

  async deleteTenderFile(req, res) {
    return handle(res, tenderingService.deleteTenderFile(req.params.fileId, getTenantId(req)), '删除招标附件');
  }

  // ==================== 招标项目分享 Token（公开扫码） ====================

  async generateShareToken(req, res) {
    return handle(res, tenderingService.generateShareToken(
      req.params.id,
      getTenantId(req),
      {
        validDays: req.body.valid_days,
        permissions: req.body.permissions,
        createdBy: req.user?.id,
      },
    ), '生成分享二维码');
  }

  async listShareTokens(req, res) {
    return handle(res, tenderingService.listShareTokens(req.params.id, getTenantId(req)), '获取分享 token 列表');
  }

  async revokeShareToken(req, res) {
    return handle(res, tenderingService.revokeShareToken(req.params.tokenId, getTenantId(req)), '撤销分享 token');
  }

  // 公开接口：扫码获取项目详情（无需登录）
  async publicGetTender(req, res) {
    const meta = {
      ip: (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '').split(',')[0].trim(),
      userAgent: req.headers['user-agent'],
    };
    return handle(res, tenderingService.getPublicTenderByToken(req.params.token, meta), '扫码获取招标详情');
  }

  // 公开接口：列出招标文件附件
  async publicListFiles(req, res) {
    const meta = {
      ip: (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '').split(',')[0].trim(),
      userAgent: req.headers['user-agent'],
    };
    return handle(res, tenderingService.listPublicTenderFiles(req.params.token, meta), '扫码获取附件列表');
  }

  // 公开接口：下载单个招标文件
  async publicDownloadFile(req, res) {
    const meta = {
      ip: (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '').split(',')[0].trim(),
      userAgent: req.headers['user-agent'],
    };
    try {
      const file = await tenderingService.downloadPublicFile(req.params.token, req.params.fileId, meta);
      const fs = require('fs');
      const path = require('path');
      if (!fs.existsSync(file.file_path)) {
        return res.status(404).json({ success: false, message: '文件不存在于磁盘' });
      }
      const downloadName = encodeURIComponent(file.original_name || file.file_name || 'download');
      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      const stream = fs.createReadStream(file.file_path);
      stream.pipe(res);
    } catch (error) {
      logger.error('扫码下载文件失败:', error);
      const status = /不存在|无效|权限/.test(error.message) ? 400 : 500;
      res.status(status).json({ success: false, message: error.message || '下载失败' });
    }
  }

  // 公开接口：上传资质
  async publicUploadQualification(req, res) {
    const meta = {
      ip: (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '').split(',')[0].trim(),
      userAgent: req.headers['user-agent'],
    };
    return handle(res, tenderingService.uploadPublicQualification(req.params.token, req.file, req.body, meta), '扫码上传资质');
  }

  // 公开接口：提交投标
  async publicSubmitBid(req, res) {
    const meta = {
      ip: (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '').split(',')[0].trim(),
      userAgent: req.headers['user-agent'],
    };
    const files = req.files || [];
    return handle(res, tenderingService.submitPublicBid(req.params.token, req.body, files, meta), '扫码提交投标');
  }

  // ==================== 字典 ====================

  async getDict(req, res) {
    return res.json({
      success: true,
      data: {
        TENDER_TYPES: tenderingService.TENDER_TYPES,
        TENDER_METHODS: tenderingService.TENDER_METHODS,
        TENDER_STATUSES: tenderingService.TENDER_STATUSES,
        SUPPLIER_STATUSES: tenderingService.SUPPLIER_STATUSES,
        QUALIFICATION_TYPES: tenderingService.QUALIFICATION_TYPES,
        DEFAULT_TENDER_SECTIONS: tenderingService.DEFAULT_TENDER_SECTIONS,
        CONTRACT_STATUSES: tenderingService.CONTRACT_STATUSES,
        CONTRACT_TYPES: tenderingService.CONTRACT_TYPES,
      },
    });
  }

  // ==================== 合同管理 ====================

  async listContracts(req, res) {
    const tenantId = getTenantId(req);
    const result = await tenderingService.listContracts({
      page: req.query.page,
      pageSize: req.query.pageSize,
      keyword: req.query.keyword,
      tenderId: req.query.tender_id,
      supplierId: req.query.supplier_id,
      status: req.query.status,
      tenantId,
    });
    return res.json({ success: true, message: '获取合同列表成功', data: result.data, pagination: result.pagination });
  }

  async getContract(req, res) {
    return handle(res, tenderingService.getContractById(req.params.id, getTenantId(req)).then(d => {
      if (!d) throw new Error('合同不存在');
      return d;
    }), '获取合同');
  }

  async createContract(req, res) {
    return handle(res, tenderingService.createContract(req.body, getTenantId(req), req.user?.id), '创建合同');
  }

  async updateContract(req, res) {
    return handle(res, tenderingService.updateContract(req.params.id, req.body, getTenantId(req)), '更新合同');
  }

  // 合同状态流转：通用入口
  // 请求体：{ status, review_comment? }
  // 审批(approved/rejected)时 review_comment 为审批意见
  async changeContractStatus(req, res) {
    return handle(res, tenderingService.changeContractStatus(
      req.params.id,
      req.body.status,
      getTenantId(req),
      req.user?.id,
      { review_comment: req.body.review_comment },
    ), '更新合同状态');
  }

  async deleteContract(req, res) {
    return handle(res, tenderingService.deleteContract(req.params.id, getTenantId(req)), '删除合同');
  }

  async uploadContractFile(req, res) {
    if (!req.file) return res.status(400).json({ success: false, message: '请上传合同附件' });
    return handle(res, tenderingService.uploadContractFile(req.params.id, req.file, req.body, getTenantId(req), req.user?.id), '上传合同附件');
  }

  async deleteContractFile(req, res) {
    return handle(res, tenderingService.deleteContractFile(req.params.fileId, getTenantId(req)), '删除合同附件');
  }

  // 按招标项目获取合同列表
  async listContractsByTender(req, res) {
    return handle(res, tenderingService.listContractsByTender(req.params.id, getTenantId(req)), '获取招标合同列表');
  }

  async getContractStatistics(req, res) {
    return handle(res, tenderingService.getContractStatistics(getTenantId(req)), '获取合同统计');
  }

  // ==================== 采购申请（统一闭环前置阶段） ====================
  // 全部走 tender_projects 表，tender_category IN ('simple','agreement')

  async listProcurementRequests(req, res) {
    return handle(res, procurementRequestService.listProcurementRequests(getTenantId(req), {
      page: req.query.page,
      pageSize: req.query.pageSize,
      status: req.query.status,
      category: req.query.category || req.query.tender_category,
      keyword: req.query.keyword,
      department: req.query.department,
    }), '获取采购申请列表');
  }

  async getProcurementRequest(req, res) {
    return handle(res, procurementRequestService.getProcurementRequestById(req.params.id, getTenantId(req)), '获取采购申请');
  }

  async createProcurementRequest(req, res) {
    return handle(res, procurementRequestService.createProcurementRequest(getTenantId(req), req.body, req.user), '创建采购申请');
  }

  async updateProcurementRequest(req, res) {
    return handle(res, procurementRequestService.updateProcurementRequest(req.params.id, getTenantId(req), req.body), '更新采购申请');
  }

  async submitProcurementRequest(req, res) {
    return handle(res, procurementRequestService.submitProcurementRequest(req.params.id, getTenantId(req), req.user), '提交采购申请');
  }

  async approveProcurementRequest(req, res) {
    const action = String(req.body.action || '').trim().toLowerCase();
    return handle(res, procurementRequestService.approveProcurementRequest(
      req.params.id,
      getTenantId(req),
      req.user,
      req.body.comment || req.body.opinion,
      action === 'reject' || req.body.approved === false ? 'reject' : 'approve',
    ), '审批采购申请');
  }

  async deleteProcurementRequest(req, res) {
    return handle(res, procurementRequestService.deleteProcurementRequest(req.params.id, getTenantId(req)), '删除采购申请');
  }

  // ==================== 发票管理（tender_invoices） ====================
  async listInvoices(req, res) {
    return handle(res, invoiceService.listInvoices(getTenantId(req), {
      page: req.query.page,
      pageSize: req.query.pageSize,
      status: req.query.status,
      contract_id: req.query.contract_id,
      supplier_id: req.query.supplier_id,
      asset_id: req.query.asset_id,
      kind: req.query.kind,
      issue_from: req.query.issue_from,
      issue_to: req.query.issue_to,
      keyword: req.query.keyword,
    }), '获取发票列表');
  }

  async getInvoice(req, res) {
    return handle(res, invoiceService.getInvoiceById(req.params.id, getTenantId(req)), '获取发票详情');
  }

  async createInvoice(req, res) {
    return handle(res, invoiceService.createInvoice(getTenantId(req), req.body, req.user), '创建发票');
  }

  async updateInvoice(req, res) {
    return handle(res, invoiceService.updateInvoice(req.params.id, getTenantId(req), req.body), '更新发票');
  }

  async submitInvoice(req, res) {
    return handle(res, invoiceService.submitInvoice(req.params.id, getTenantId(req), req.user), '提交发票');
  }

  async verifyInvoice(req, res) {
    return handle(res, invoiceService.verifyInvoice(req.params.id, getTenantId(req), req.user), '核验发票');
  }

  async failVerifyInvoice(req, res) {
    return handle(res, invoiceService.failVerifyInvoice(req.params.id, getTenantId(req), req.user, req.body.error), '核验失败');
  }

  async retryInvoice(req, res) {
    return handle(res, invoiceService.retryInvoice(req.params.id, getTenantId(req), req.user), '重新提交发票');
  }

  async claimInvoice(req, res) {
    return handle(res, invoiceService.claimInvoice(req.params.id, getTenantId(req), req.user), '认证抵扣');
  }

  async payInvoice(req, res) {
    return handle(res, invoiceService.payInvoice(req.params.id, getTenantId(req), req.user), '支付发票');
  }

  async archiveInvoice(req, res) {
    return handle(res, invoiceService.archiveInvoice(req.params.id, getTenantId(req), req.user), '归档发票');
  }

  async cancelInvoice(req, res) {
    return handle(res, invoiceService.cancelInvoice(req.params.id, getTenantId(req), req.user), '取消发票');
  }

  async deleteInvoice(req, res) {
    return handle(res, invoiceService.deleteInvoice(req.params.id, getTenantId(req)), '删除发票');
  }

  async getInvoiceStatistics(req, res) {
    return handle(res, invoiceService.getInvoiceStatistics(getTenantId(req)), '获取发票统计');
  }

  async uploadInvoiceFile(req, res) {
    if (!req.file) return res.status(400).json({ success: false, message: '请上传发票附件' });
    return handle(res, invoiceService.uploadInvoiceFile(req.params.id, getTenantId(req), req.user, req.file, req.body || {}), '上传发票附件');
  }

  async deleteInvoiceFile(req, res) {
    return handle(res, invoiceService.deleteInvoiceFile(req.params.fileId, getTenantId(req)), '删除发票附件');
  }

  async createInvoiceFromAsset(req, res) {
    return handle(res, invoiceService.createInvoiceFromAsset(
      req.params.assetId, getTenantId(req), req.user, req.body || {},
    ), '资产入账发票生成');
  }

  // 由发票生成里程碑：用于在采购员完成发票登记后自动建立对应付款里程碑
  async generateMilestoneFromInvoice(req, res) {
    return handle(res, invoiceService.generateMilestoneFromInvoice(
      req.params.id, getTenantId(req), req.user, { remark: req.body && req.body.remark },
    ), '由发票生成付款里程碑');
  }

  // 发票图片 OCR 识别
  async ocrInvoice(req, res) {
    if (!req.file) return res.status(400).json({ success: false, message: '请上传发票图片' });
    return handle(res, invoiceService.ocrInvoiceImage(req.file), '发票OCR识别');
  }

  // ==================== 付款管理 ====================
  async listPayments(req, res) {
    return handle(res, paymentService.listPayments(getTenantId(req), {
      page: req.query.page, pageSize: req.query.pageSize,
      status: req.query.status, contract_id: req.query.contract_id,
      milestone_id: req.query.milestone_id, invoice_id: req.query.invoice_id,
      supplier_id: req.query.supplier_id,
      pay_from: req.query.pay_from, pay_to: req.query.pay_to,
      keyword: req.query.keyword,
    }), '获取付款单列表');
  }
  async getPayment(req, res) { return handle(res, paymentService.getPaymentById(req.params.id, getTenantId(req)), '付款单详情'); }
  async createPayment(req, res) { return handle(res, paymentService.createPayment(getTenantId(req), req.body, req.user), '创建付款单'); }
  async updatePayment(req, res) { return handle(res, paymentService.updatePayment(req.params.id, getTenantId(req), req.body), '更新付款单'); }
  async submitPayment(req, res) { return handle(res, paymentService.submitPayment(req.params.id, getTenantId(req), req.user), '提交付款单'); }
  async payPayment(req, res) { return handle(res, paymentService.payPayment(req.params.id, getTenantId(req), req.user), '进入付款中'); }
  async completePayment(req, res) { return handle(res, paymentService.completePayment(req.params.id, getTenantId(req), req.user), '完成付款'); }
  async failPayment(req, res) { return handle(res, paymentService.failPayment(req.params.id, getTenantId(req), req.user, req.body && (req.body.failure_reason || req.body.reason)), '付款失败'); }
  async reSubmitPayment(req, res) { return handle(res, paymentService.reSubmitPayment(req.params.id, getTenantId(req), req.user), '重新提交付款'); }
  async cancelPayment(req, res) { return handle(res, paymentService.cancelPayment(req.params.id, getTenantId(req), req.user), '取消付款'); }
  async deletePayment(req, res) { return handle(res, paymentService.deletePayment(req.params.id, getTenantId(req)), '删除付款单'); }
  async getPaymentStatistics(req, res) { return handle(res, paymentService.getPaymentStatistics(getTenantId(req)), '付款统计'); }

  // ==================== 验收管理 ====================
  async listAcceptances(req, res) {
    return handle(res, acceptanceService.list(getTenantId(req), {
      page: req.query.page, pageSize: req.query.pageSize,
      status: req.query.status, contract_id: req.query.contract_id,
      tender_id: req.query.tender_id, asset_id: req.query.asset_id,
      invoice_id: req.query.invoice_id,
      keyword: req.query.keyword,
    }), '验收单列表');
  }
  async getAcceptance(req, res) { return handle(res, acceptanceService.getById(req.params.id, getTenantId(req)), '验收单详情'); }
  async createAcceptance(req, res) { return handle(res, acceptanceService.create(getTenantId(req), req.body, req.user), '创建验收单'); }
  async updateAcceptance(req, res) { return handle(res, acceptanceService.update(req.params.id, getTenantId(req), req.body), '更新验收单'); }
  async acceptAcceptance(req, res) {
    return handle(res, acceptanceService.accept(req.params.id, getTenantId(req), req.user, {
      accepted_quantity: req.body && req.body.accepted_quantity,
      rejected_quantity: req.body && req.body.rejected_quantity,
      inspection_note: req.body && (req.body.inspection_note || req.body.remark),
    }), '通过验收');
  }
  async rejectAcceptance(req, res) {
    return handle(res, acceptanceService.reject(req.params.id, getTenantId(req), req.user, req.body && req.body.reason), '驳回验收');
  }
  async reprocessAcceptance(req, res) { return handle(res, acceptanceService.reprocess(req.params.id, getTenantId(req), req.user), '重新提交验收'); }
  async closeAcceptance(req, res) { return handle(res, acceptanceService.close(req.params.id, getTenantId(req), req.user), '关闭验收'); }
  async deleteAcceptance(req, res) { return handle(res, acceptanceService.delete(req.params.id, getTenantId(req)), '删除验收单'); }
  async getAcceptanceStatistics(req, res) { return handle(res, acceptanceService.getStatistics(getTenantId(req)), '验收统计'); }

  // ==================== 审计日志 ====================
  async listAuditLogs(req, res) {
    return handle(res, auditLogService.listLogs(getTenantId(req), {
      page: req.query.page, pageSize: req.query.pageSize,
      entity_type: req.query.entity_type, entity_id: req.query.entity_id,
      operator_id: req.query.operator_id, action: req.query.action,
      occurred_from: req.query.occurred_from, occurred_to: req.query.occurred_to,
    }), '审计日志列表');
  }

  // ==================== 统计报表增强（按月/部门/类型） ====================
  async getEnhancedStatistics(req, res) {
    return handle(res, tenderingService.getEnhancedStatistics(getTenantId(req)), '综合统计');
  }

  // ==================== 审批引擎（Approval Engine） ====================
  async listApprovalFlows(req, res) {
    return handle(res, approvalEngine.listFlows(getTenantId(req), {
      entity_type: req.query.entity_type, trigger_action: req.query.trigger_action,
    }), '审批流程模板');
  }
  async listMyApprovalTodos(req, res) {
    return handle(res, approvalEngine.listMyTodos(getTenantId(req), req.user?.id, {
      status: req.query.status,
    }), '我的审批待办');
  }
  async listMyInitiatedApprovals(req, res) {
    return handle(res, approvalEngine.listMyInitiated(getTenantId(req), req.user?.id, {
      status: req.query.status,
    }), '我发起的审批');
  }
  async listPendingApprovalsForRole(req, res) {
    return handle(res, approvalEngine.listPendingForRole(getTenantId(req), req.query.role || req.user?.role, {
      entity_type: req.query.entity_type, limit: parseInt(req.query.limit || '50', 10),
    }), '角色级待审批');
  }
  async approveRequest(req, res) {
    return handle(res, approvalEngine.approve(req.params.recordId, getTenantId(req), req.user, req.body && req.body.opinion), '审批通过');
  }
  async rejectRequest(req, res) {
    return handle(res, approvalEngine.reject(req.params.recordId, getTenantId(req), req.user, req.body && req.body.opinion), '审批驳回');
  }
  async cancelApproval(req, res) {
    return handle(res, approvalEngine.cancel(req.params.recordId, getTenantId(req), req.user), '取消审批');
  }

  // ==================== AI 辅助审批（MiniMax） ====================
  // 健康自检：返回 { configured, mode, model, endpoint, live?, reason? }
  // 严格禁止返回任何 key/secret/header 字段
  async aiHealth(req, res) {
    try {
      const mode = aiAssistant.client.getAuthMode();
      const endpoint = aiAssistant.client._endpointUrl();
      const model = aiAssistant.client.model;
      const configured = aiAssistant.client.isConfigured();

      let live = null;
      let reason = null;
      let latency_ms = null;

      if (!configured) {
        return res.json({
          success: true,
          data: {
            configured: false,
            mode: 'none',
            model,
            endpoint,
            live: false,
            reason: '未配置 MINIMAX_API_KEY / MINIMAX_ACCESS_TOKEN（请在 backend/.env 设置）',
          },
        });
      }

      // 真实 ping：1 token max，不留痕
      const t0 = Date.now();
      try {
        await aiAssistant.client.health();
        live = true;
        latency_ms = Date.now() - t0;
      } catch (e) {
        live = false;
        // 截断错误内容（防止日志里包含 token / cookie）
        reason = String(e.message || 'ping 失败').slice(0, 160).replace(/sk-[a-zA-Z0-9_\-]+/g, '<redacted>');
      }

      return res.json({
        success: true,
        data: { configured: true, mode, model, endpoint, live, reason, latency_ms },
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  async aiAssist(req, res) {
    return handle(res, aiAssistant.suggest({
      tenantId: getTenantId(req),
      entityType: req.body.entity_type || req.query.entity_type,
      entityId: req.body.entity_id || req.query.entity_id,
      context: req.body.context || {},
      approverHint: req.body.approver_hint,
    }), 'AI 辅助审批');
  }

  // SSE 流式输出
  async aiAssistStream(req, res) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const entityType = req.body.entity_type || req.query.entity_type;
    const entityId = req.body.entity_id || req.query.entity_id;
    const context = req.body.context || {};
    const approverHint = req.body.approver_hint;

    function sendEvent(payload) {
      try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch (_) {}
    }

    try {
      for await (const chunk of aiAssistant.streamSuggest({
        tenantId: getTenantId(req), entityType, entityId, context, approverHint,
      })) {
        sendEvent(chunk);
        if (chunk.type === 'done' || chunk.type === 'error') break;
      }
    } catch (e) {
      sendEvent({ type: 'error', message: e.message });
    } finally {
      try { res.end(); } catch (_) {}
    }
  }
}

module.exports = new TenderingController();
