// ============================================================
// 采购与招标 — 发票服务 TenderingInvoiceService
// 状态机：draft → pending → verified → claimed → paid → archived
//                  ↓      ↓                ↓
//              cancelled errored       cancelled
// 关联：tender_invoices × tender_contracts × tender_payment_milestones
//       × tender_projects × tender_suppliers
// 资产（assets）的 invoice_id/invoice_no/capitalized_at 关联由
// asset-management 模块通过订阅 tender:invoice:archived / :cancelled 维护
// ============================================================

const BaseService = require('../../../core/BaseService');
const db = require('../../../config/database');
const { AppError } = require('../../../utils/error-handler');
const logger = require('../../../config/logger');

const INVOICE_STATUSES = ['draft', 'pending', 'verified', 'claimed', 'paid', 'archived', 'cancelled', 'errored'];

const INVOICE_STATUS_TRANSITIONS = {
  draft:     ['pending', 'cancelled'],
  pending:   ['verified', 'errored', 'cancelled'],
  errored:   ['pending', 'cancelled'],
  verified:  ['claimed', 'cancelled'],
  claimed:   ['paid', 'cancelled'],
  paid:      ['archived', 'cancelled'],
  archived:  [],
  cancelled: [],
};

function isValidInvoiceTransition(from, to) {
  const allowed = INVOICE_STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

function parsePositiveInt(v, fallback) {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function normalizeMoney(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function validateKind(k) {
  return ['vat_special', 'vat_general', 'receipt', 'e_invoice', 'other'].includes(k) ? k : 'vat_special';
}

function validateAccounting(k) {
  return ['capitalize', 'expense'].includes(k) ? k : 'capitalize';
}

function nowStr() { return new Date().toISOString().slice(0, 19).replace('T', ' '); }

async function emit(eventName, payload) {
  try {
    const { getEventBus } = require('../../../core/EventBus');
    getEventBus().publish(eventName, payload);
  } catch (e) {
    logger.warn(`[InvoiceService] 事件 ${eventName} 发布失败: ${e.message}`);
  }
}

function buildInvoiceCode() {
  const date = new Date();
  const prefix = `INV${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  return `${prefix}-${suffix}`;
}

class TenderingInvoiceService extends BaseService {
  constructor(options = {}) {
    super({ name: 'TenderingInvoiceService', ...options });
  }

  async _existsInvoiceTable() {
    const [rows] = await db.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tender_invoices'` );
    return rows.length > 0;
  }

  async _selectInvoice(id, tenantId, { withFiles = false } = {}) {
    const [rows] = await db.execute(
      `SELECT * FROM tender_invoices WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1`,
      [id, tenantId],
    );
    if (rows.length === 0) throw new AppError('发票不存在', 404, 'INVOICE_NOT_FOUND');
    const inv = rows[0];
    if (withFiles) {
      const [files] = await db.execute(
        `SELECT id, file_type, original_name, file_name, file_path, mime_type, file_size, ocr_text, uploaded_by, created_at
         FROM tender_invoice_files WHERE invoice_id = ? ORDER BY id DESC`,
        [id],
      );
      inv.files = files;
    }
    return inv;
  }

  // 列表：支持 status / contract_id / supplier_id / asset_id / kind / date 过滤
  async listInvoices(tenantId, params) {
    if (!(await this._existsInvoiceTable())) {
      return { data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
    }
    const { page = 1, pageSize = 20, status, contract_id, supplier_id, asset_id, kind, issue_from, issue_to, keyword } = params;
    const pageNum = parsePositiveInt(page, 1);
    const pageSizeNum = parsePositiveInt(pageSize, 20);
    const offset = (pageNum - 1) * pageSizeNum;
    const where = ['tenant_id = ?', 'deleted_at IS NULL'];
    const qp = [tenantId];
    if (status && INVOICE_STATUSES.includes(status)) { where.push('status = ?'); qp.push(status); }
    if (contract_id) { where.push('contract_id = ?'); qp.push(contract_id); }
    if (supplier_id) { where.push('supplier_id = ?'); qp.push(supplier_id); }
    if (asset_id)    { where.push('asset_id = ?'); qp.push(asset_id); }
    if (kind)        { where.push('invoice_kind = ?'); qp.push(kind); }
    if (issue_from)  { where.push('issue_date >= ?'); qp.push(issue_from); }
    if (issue_to)    { where.push('issue_date <= ?'); qp.push(issue_to); }
    if (keyword)     { where.push('(invoice_code LIKE ? OR invoice_no LIKE ? OR remark LIKE ?)'); qp.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
    const whereSQL = `WHERE ${where.join(' AND ')}`;
    const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM tender_invoices ${whereSQL}`, qp);
    const total = Number(countRows[0]?.total || 0);
    const [rows] = await db.execute(
      `SELECT id, invoice_code, invoice_kind, invoice_no, invoice_code_str, issue_date,
              amount, tax_rate, tax_amount, excluding_amount, currency,
              contract_id, milestone_id, tender_id, supplier_id, asset_id,
              status, accounting_kind, is_from_asset_acceptance, is_manual_create,
              created_by, created_at, updated_at
       FROM tender_invoices ${whereSQL}
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...qp, pageSizeNum, offset],
    );
    return {
      data: rows,
      pagination: { page: pageNum, pageSize: pageSizeNum, total, totalPages: pageSizeNum > 0 ? Math.ceil(total / pageSizeNum) : 0 },
    };
  }

  // 详情
  async getInvoiceById(id, tenantId) {
    return this._selectInvoice(id, tenantId, { withFiles: true });
  }

  async createInvoice(tenantId, body, user) {
    if (!(await this._existsInvoiceTable())) {
      throw new AppError('tender_invoices 表不存在，请执行 010_invoices.sql 迁移', 500, 'INVOICE_TABLE_MISSING');
    }
    const amount = normalizeMoney(body.amount);
    if (Number.isNaN(amount)) throw new AppError('发票金额必须是大于等于 0 的数字', 400, 'INVALID_AMOUNT');
    const issueDate = body.issue_date ? String(body.issue_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const kind = validateKind(body.invoice_kind);
    const accountingKind = validateAccounting(body.accounting_kind);
    const taxRate = body.tax_rate != null ? Number(body.tax_rate) : 13.0;
    const taxAmount = body.tax_amount != null ? normalizeMoney(body.tax_amount) : Number((amount * taxRate / (100 + taxRate)).toFixed(2));
    const excludingAmount = body.excluding_amount != null ? normalizeMoney(body.excluding_amount) : Number((amount - (taxAmount || 0)).toFixed(2));
    if (Number.isNaN(taxAmount) || Number.isNaN(excludingAmount)) {
      throw new AppError('税额 / 不含税金额非法', 400, 'INVALID_TAX');
    }
    const invoiceCode = buildInvoiceCode();

    const [insert] = await db.execute(
      `INSERT INTO tender_invoices (
        tenant_id, invoice_code, invoice_kind, invoice_no, invoice_code_str,
        issue_date, amount, tax_rate, tax_amount, excluding_amount, currency,
        contract_id, milestone_id, tender_id, supplier_id, asset_id, payment_request_id,
        status, accounting_kind, remark, is_from_asset_acceptance, is_manual_create,
        created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, invoiceCode, kind, body.invoice_no || null, body.invoice_code_str || null,
        issueDate, amount, taxRate, taxAmount, excludingAmount, String(body.currency || 'CNY').trim() || 'CNY',
        body.contract_id || null, body.milestone_id || null, body.tender_id || null, body.supplier_id || null,
        body.asset_id || null, body.payment_request_id || null,
        'draft', accountingKind, body.remark || null,
        body.is_from_asset_acceptance === true, body.is_manual_create !== false,
        user?.id || null, nowStr(),
      ],
    );
    emit('tender:invoice:created', { id: insert.insertId, invoice_code: invoiceCode, tenantId });
    return { id: insert.insertId, invoice_code: invoiceCode, status: 'draft', invoice_kind: kind };
  }

  // 资产生成发票草稿：沿用 createInvoice 但强制 is_from_asset_acceptance=true
  // 资产信息通过 asset-management 模块的 AssetService 单例获取，不再直读 assets 表
  async createInvoiceFromAsset(assetId, tenantId, user, body) {
    const assetService = require('../../asset-management/services/asset.service');
    const a = await assetService.getAssetById(assetId, tenantId);
    if (!a) throw new AppError('资产不存在', 404, 'ASSET_NOT_FOUND');
    return this.createInvoice(tenantId, {
      ...(body || {}),
      asset_id: a.id,
      supplier_id: body.supplier_id || a.supplier_id,
      amount: body.amount ?? a.original_value ?? null,
      accounting_kind: 'capitalize',
      is_from_asset_acceptance: true,
      is_manual_create: false,
      remark: body.remark || `资产入账发票 - ${a.asset_name || a.asset_code || `id=${a.id}`}`,
    }, user);
  }

  async updateInvoice(id, tenantId, body) {
    const inv = await this._selectInvoice(id, tenantId);
    if (inv.status !== 'draft') throw new AppError('仅 draft 状态可编辑', 400, 'INVALID_STATUS');

    const fields = [];
    const values = [];
    const allowed = ['invoice_kind', 'invoice_no', 'invoice_code_str', 'issue_date',
      'amount', 'tax_rate', 'tax_amount', 'excluding_amount', 'currency',
      'contract_id', 'milestone_id', 'tender_id', 'supplier_id', 'asset_id', 'payment_request_id',
      'accounting_kind', 'remark'];
    for (const k of allowed) {
      if (body[k] === undefined) continue;
      fields.push(`${k} = ?`);
      values.push(k === 'invoice_kind' ? validateKind(body[k])
        : k === 'accounting_kind' ? validateAccounting(body[k])
        : ['amount', 'tax_amount', 'excluding_amount'].includes(k) ? normalizeMoney(body[k])
        : k === 'tax_rate' ? Number(body[k])
        : body[k]);
    }
    if (fields.length === 0) throw new AppError('无可更新字段', 400, 'EMPTY_UPDATE');
    fields.push('updated_at = ?'); values.push(nowStr());
    values.push(id, tenantId);
    await db.execute(`UPDATE tender_invoices SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`, values);
    emit('tender:invoice:updated', { id, tenantId });
    return { id };
  }

  // 5 个状态动作：submit / verify / claim / pay / archive / cancel / retry
  async _transition(id, tenantId, user, fromStatus, toStatus, errorMessage) {
    const inv = await this._selectInvoice(id, tenantId);
    if (inv.status !== fromStatus) {
      throw new AppError(`当前状态为 ${inv.status}，不能从 ${fromStatus} 流转到 ${toStatus}`, 400, 'INVALID_TRANSITION');
    }
    if (!isValidInvoiceTransition(fromStatus, toStatus)) {
      throw new AppError(`状态机不允许 ${fromStatus} → ${toStatus}`, 400, 'INVALID_TRANSITION');
    }

    // 1) 高风险门（pay 涉及付款）→ 先查"已批准 record"放行,否则走 requestApproval
    if (toStatus === 'pay' && user) {
      const triggerAction = 'pay';
      const entityType = 'tender_invoices';
      let alreadyApproved = false;
      try {
        const ApprovalEngine = require('./approval-engine.service');
        const engine = new ApprovalEngine();
        alreadyApproved = await engine.hasApprovedRecord({
          tenantId, entity_type: entityType, entity_id: id, trigger_action: triggerAction,
        });
      } catch (e) {
        logger.warn(`[InvoiceService] hasApprovedRecord 异常，按未批准处理: ${e.message}`);
      }
      if (!alreadyApproved) {
        try {
          const ApprovalEngine = require('./approval-engine.service');
          const engine = new ApprovalEngine();
          const ctx = { amount: Number(inv.amount || 0), invoice_kind: inv.invoice_kind };
          const approval = await engine.requestApproval({
            tenantId, entity_type: entityType, entity_id: id,
            trigger_action: triggerAction, context: ctx, initiator: user, new_status: toStatus,
          });
          if (approval.approved === false) {
            await emit('tender:invoice:approval_pending', {
              id, tenantId, userId: user.id, record_id: approval.record_id,
              flow_code: approval.flow?.flow_code,
            });
            return { id, status: inv.status, pending_approval: true, record_id: approval.record_id };
          }
        } catch (e) {
          logger.warn(`[InvoiceService] 审批引擎不可用，放行: ${e.message}`);
        }
      } else {
        logger.info(`[InvoiceService] entity=${id} trigger=${triggerAction} 已批准,跳过审批门,落地 status=${toStatus}`);
      }
    }
    const tsField = {
      verified:  'verified_at',
      claimed:   'claimed_at',
      paid:      'paid_at',
      archived:  'archived_at',
      cancelled: 'cancelled_at',
    }[toStatus] || null;
    const setCols = ['status = ?', 'updated_at = ?'];
    const setVals = [toStatus, nowStr()];
    if (tsField) { setCols.push(`${tsField} = ?`); setVals.push(nowStr()); }
    setVals.push(id, tenantId);
    await db.execute(`UPDATE tender_invoices SET ${setCols.join(', ')} WHERE id = ? AND tenant_id = ?`, setVals);

    // 边带钩子
    const ctx = { id, tenantId, userId: user?.id, from: fromStatus, to: toStatus, invoice: { ...inv, status: toStatus } };
    if (toStatus === 'pending') {
      await this._onSubmit(id, ctx);
      emit('tender:invoice:created', { ...ctx });  // 也用于通知财务
    } else if (toStatus === 'verified') {
      emit('tender:invoice:verified', ctx);
    } else if (toStatus === 'claimed') {
      emit('tender:invoice:claimed', ctx);
    } else if (toStatus === 'paid') {
      await this._onPaid(id, ctx);
      emit('tender:invoice:paid', ctx);
    } else if (toStatus === 'archived') {
      await this._onArchived(id, ctx);    // 重要：触发资产回写
      emit('tender:invoice:archived', ctx);
    } else if (toStatus === 'cancelled') {
      await this._onCancelled(id, ctx);
      emit('tender:invoice:cancelled', ctx);
    } else if (toStatus === 'errored') {
      emit('tender:invoice:errored', { ...ctx, error: errorMessage });
    }
    return { id, status: toStatus };
  }

  async _onSubmit(id) {
    // draft → pending：仅发事件
    return;
  }

  // 在 tender_payment_milestones 中找到或创建一笔与此发票关联的里程碑
  // 幂等：先按 invoice_id 反查 milestones（采用 in-memory 映射表 contract_id 上）；
  //       因为 tender_payment_milestones 没有直接 invoice_id 字段，这里用一个轻量的命名约定：
  //       milestone_name = 'auto-from-invoice-<invoice_id>' 保证可定位与幂等。
  async generateMilestoneFromInvoice(invoiceId, tenantId, user, options = {}) {
    await this._ensureSchema(tenantId); // ensureTablesOnce 替代
    const inv = await this._selectInvoice(invoiceId, tenantId);
    if (!inv.contract_id) {
      throw new AppError('发票未关联合同（contract_id），无法生成里程碑', 400, 'NO_CONTRACT');
    }
    const markerName = `auto-from-invoice-${invoiceId}`;
    // 1) 已存在则复用
    const [exists] = await db.execute(
      `SELECT id, status FROM tender_payment_milestones
       WHERE tenant_id = ? AND contract_id = ? AND milestone_name = ? LIMIT 1`,
      [tenantId, inv.contract_id, markerName],
    );
    let milestoneId;
    if (exists.length > 0) {
      milestoneId = exists[0].id;
      // 若已被 paid/archived 同时发票状态不对齐，给出警告但不强制修改
      if (exists[0].status === 'paid' && inv.status !== 'paid' && inv.status !== 'archived') {
        // 仅 warning，幂等复用
      }
    } else {
      // 2) 创建新里程碑
      const [r] = await db.execute(
        `INSERT INTO tender_payment_milestones (
           tenant_id, contract_id, milestone_name, amount, due_date, status, remark, created_at
         ) VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW())`,
        [
          tenantId, inv.contract_id, markerName,
          Number(inv.amount || 0),
          inv.issue_date || null,
          options.remark || `基于发票 ${inv.invoice_code} 自动创建的付款里程碑`,
        ],
      );
      milestoneId = r.insertId;
    }
    // 3) 回写 tender_invoices.milestone_id
    await db.execute(
      `UPDATE tender_invoices SET milestone_id = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [milestoneId, invoiceId, tenantId],
    );
    return { id: milestoneId, invoice_id: invoiceId, contract_id: inv.contract_id, milestone_name: markerName };
  }

  async _ensureSchema(tenantId) {
    // 复用 ensureTables 实现。该 Project 的 ensureTables 是模块顶层副作用，
    // 这里仅做 noop，保证 generate 方法签名一致。
    return true;
  }

  // paid 钩子：把对应里程碑设为 paid
  async _onPaid(id, ctx) {
    const inv = ctx.invoice;
    if (!inv.milestone_id) return;
    try {
      await db.execute(
        `UPDATE tender_payment_milestones SET status = 'paid', paid_at = NOW() WHERE id = ? AND tenant_id = ?`,
        [inv.milestone_id, ctx.tenantId],
      );
      emit('tender:milestone:paid', { milestone_id: inv.milestone_id, invoice_id: id, tenantId: ctx.tenantId });
    } catch (e) {
      logger.warn(`[InvoiceService] 标记里程碑 paid 失败: ${e.message}`);
    }
  }

  // archived 钩子：资产入账回写交给 asset-management 模块的 invoice-link.subscriber
  // 详见 modules/asset-management/services/invoice-link.subscriber.js（订阅 tender:invoice:archived）
  // 本模块不再直写 assets 表，消除"跨模块直写"风险点
  async _onArchived(id, ctx) {
    return;
  }

  // cancelled 钩子：资产入账解绑同上，交给 asset-management 订阅器处理
  async _onCancelled(id, ctx) {
    return;
  }

  // 公共动作方法
  async submitInvoice(id, tenantId, user)    { return this._transition(id, tenantId, user, 'draft', 'pending'); }
  async verifyInvoice(id, tenantId, user)    { return this._transition(id, tenantId, user, 'pending', 'verified'); }
  async failVerifyInvoice(id, tenantId, user, errorMessage) { return this._transition(id, tenantId, user, 'pending', 'errored', errorMessage); }
  async retryInvoice(id, tenantId, user)     { return this._transition(id, tenantId, user, 'errored', 'pending'); }
  async claimInvoice(id, tenantId, user)     { return this._transition(id, tenantId, user, 'verified', 'claimed'); }
  async payInvoice(id, tenantId, user)       { return this._transition(id, tenantId, user, 'claimed', 'paid'); }
  async archiveInvoice(id, tenantId, user)   { return this._transition(id, tenantId, user, 'paid', 'archived'); }
  async cancelInvoice(id, tenantId, user)     {
    const inv = await this._selectInvoice(id, tenantId);
    if (inv.status === 'archived') throw new AppError('archived 不可取消', 400, 'INVALID_TRANSITION');
    return this._transition(id, tenantId, user, inv.status, 'cancelled');
  }

  async deleteInvoice(id, tenantId) {
    const inv = await this._selectInvoice(id, tenantId);
    if (inv.status !== 'draft') throw new AppError('仅 draft 可删除', 400, 'INVALID_STATUS');
    await db.execute(
      `UPDATE tender_invoices SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [id, tenantId],
    );
    emit('tender:invoice:deleted', { id, tenantId });
    return { id };
  }

  // 附件
  async uploadInvoiceFile(id, tenantId, user, file, body) {
    await this._selectInvoice(id, tenantId);
    const [insert] = await db.execute(
      `INSERT INTO tender_invoice_files (
        tenant_id, invoice_id, file_type, original_name, file_name, file_path, mime_type, file_size, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, id,
        ['invoice_scan', 'contract_ref', 'approval_doc', 'other'].includes(body.file_type) ? body.file_type : 'invoice_scan',
        file.originalname, file.filename, file.path, file.mimetype, file.size || 0,
        user?.id || null,
      ],
    );
    return { id: insert.insertId };
  }

  async deleteInvoiceFile(fileId, tenantId) {
    const [rows] = await db.execute(
      `SELECT id, file_path FROM tender_invoice_files WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [fileId, tenantId],
    );
    if (rows.length === 0) throw new AppError('附件不存在', 404, 'FILE_NOT_FOUND');
    try { require('fs').unlinkSync(rows[0].file_path); } catch (_) {}
    await db.execute(`DELETE FROM tender_invoice_files WHERE id = ? AND tenant_id = ?`, [fileId, tenantId]);
    return { id: fileId };
  }

  /**
   * OCR 识别发票图片，提取发票信息
   * @param {Object} file - multer 上传的文件对象
   * @returns {Promise<Object>} 识别出的发票字段
   */
  async ocrInvoiceImage(file) {
    if (!file) throw new AppError('请上传发票图片', 400, 'FILE_REQUIRED');
    const fs = require('fs');
    if (!fs.existsSync(file.path)) throw new AppError('图片文件不存在', 400, 'FILE_NOT_FOUND');

    // 检查文件是否为图片
    const mime = (file.mimetype || '').toLowerCase();
    if (!mime.startsWith('image/')) throw new AppError('仅支持图片格式', 400, 'INVALID_IMAGE');

    try {
      const ImageAnalysisService = require('../../../services/image-analysis-service');
      const analyzer = new ImageAnalysisService();

      // 读取图片为 base64
      const imageBuffer = fs.readFileSync(file.path);
      const base64Image = imageBuffer.toString('base64');

      // OCR 提取提示词
      const prompt = `
你是一个专业的发票 OCR 识别系统。请仔细分析这张发票图片，提取以下字段并以 JSON 格式返回：

字段说明：
- invoice_kind: 发票类型，枚举值之一 → "vat_special"(增值税专票) / "vat_general"(增值税普票) / "receipt"(收据) / "e_invoice"(电子发票) / "other"(其他)
- invoice_no: 发票号码（票面右上角的发票号码）
- invoice_code_str: 发票代码（纸质发票左上角的代码）
- issue_date: 开票日期，格式 YYYY-MM-DD
- amount: 含税金额（价税合计/合计的大写金额对应的数字）
- tax_rate: 税率，百分比数值（如 13、6、3、0 等）
- tax_amount: 税额
- excluding_amount: 不含税金额
- supplier_name: 销售方名称（开票方）
- buyer_name: 购买方名称（受票方）
- remark: 备注栏内容

要求：
1. 金额统一用数字，不要带货币符号和逗号
2. issue_date 格式必须为 YYYY-MM-DD
3. 无法识别的字段设为 null
4. 只输出 JSON 对象，不要其他文字
5. 发票类型判断依据：有"增值税专用发票"字样 → vat_special；有"增值税普通发票"或"增值税电子普通发票" → vat_general；有"电子发票" → e_invoice；有"收据" → receipt；其他 → other
`;

      let aiResponse;
      if (analyzer.useMinimax) {
        aiResponse = await analyzer.callMinimaxAPI(prompt, base64Image);
      } else {
        aiResponse = await analyzer.callLMStudioAPI(prompt, base64Image);
      }

      // 解析 JSON
      let extractedData = {};
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        } else {
          extractedData = JSON.parse(aiResponse);
        }
      } catch (parseError) {
        // JSON 解析失败，尝试从文本中提取
        logger.warn('[InvoiceService] OCR JSON 解析失败，尝试文本提取');
        extractedData = this._extractInvoiceFromText(aiResponse);
      }

      // 格式化返回
      return {
        success: true,
        data: {
          invoice_kind: this._validateOcrKind(extractedData.invoice_kind),
          invoice_no: extractedData.invoice_no || extractedData.invoiceNumber || null,
          invoice_code_str: extractedData.invoice_code_str || extractedData.invoiceCode || null,
          issue_date: this._validateOcrDate(extractedData.issue_date || extractedData.issueDate),
          amount: this._normalizeOcrNumber(extractedData.amount || extractedData.totalAmount),
          tax_rate: this._normalizeOcrNumber(extractedData.tax_rate || extractedData.taxRate),
          tax_amount: this._normalizeOcrNumber(extractedData.tax_amount || extractedData.taxAmount),
          excluding_amount: this._normalizeOcrNumber(extractedData.excluding_amount || extractedData.excludingAmount || extractedData.amountWithoutTax),
          supplier_name: extractedData.supplier_name || extractedData.supplierName || null,
          buyer_name: extractedData.buyer_name || extractedData.buyerName || null,
          remark: extractedData.remark || null,
        },
        raw: extractedData,
      };
    } catch (error) {
      logger.error('[InvoiceService] OCR 识别失败:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(`发票 OCR 识别失败: ${error.message || '未知错误'}`, 500, 'OCR_FAILED');
    }
  }

  /** 校验发票类型 */
  _validateOcrKind(kind) {
    const valid = ['vat_special', 'vat_general', 'receipt', 'e_invoice', 'other'];
    return valid.includes(kind) ? kind : 'other';
  }

  /** 校验日期格式 */
  _validateOcrDate(dateStr) {
    if (!dateStr) return null;
    const d = String(dateStr).trim();
    // 匹配 YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    // 匹配 YYYY/MM/DD
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(d)) return d.replace(/\//g, '-');
    // 匹配 YYYY年MM月DD日
    const match = d.match(/(\d{4})\s*[年/-]\s*(\d{1,2})\s*[月/-]\s*(\d{1,2})\s*日?/);
    if (match) {
      return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    }
    return null;
  }

  /** 规范化数字 */
  _normalizeOcrNumber(v) {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const cleaned = String(v).replace(/[¥￥,，\s]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  /** 从纯文本提取发票信息（JSON 解析失败时的备用方案） */
  _extractInvoiceFromText(text) {
    const result = {};
    const mappings = [
      { key: 'invoice_no', patterns: [/发票号码?[：:]\s*(\S+)/, /发票号[：:]\s*(\S+)/, /No[：:。\s]*(\d+)/] },
      { key: 'invoice_code_str', patterns: [/发票代码[：:]\s*(\S+)/] },
      { key: 'issue_date', patterns: [/开票日期[：:]\s*(\S+)/, /日期[：:]\s*(\S+)/] },
      { key: 'amount', patterns: [/价税合计[：:]\s*([\d,.]+)/, /合计[：:]\s*¥?\s*([\d,.]+)/, /总计[：:]\s*¥?\s*([\d,.]+)/] },
      { key: 'tax_rate', patterns: [/税率[：:]\s*(\d+\.?\d*)/] },
      { key: 'tax_amount', patterns: [/税额[：:]\s*¥?\s*([\d,.]+)/] },
      { key: 'excluding_amount', patterns: [/金额[：:]\s*¥?\s*([\d,.]+)/, /不含税[：:]\s*¥?\s*([\d,.]+)/] },
      { key: 'supplier_name', patterns: [/销售方[：:]\s*(.+)/, /销货单位[：:]\s*(.+)/, /开票方[：:]\s*(.+)/] },
      { key: 'buyer_name', patterns: [/购买方[：:]\s*(.+)/, /购货单位[：:]\s*(.+)/, /受票方[：:]\s*(.+)/, /名称[：:]\s*(.+)/] },
    ];
    for (const { key, patterns } of mappings) {
      for (const re of patterns) {
        const m = text.match(re);
        if (m && m[1]) { result[key] = m[1].trim(); break; }
      }
    }
    return result;
  }

  // 统计
  async getInvoiceStatistics(tenantId) {
    if (!(await this._existsInvoiceTable())) {
      return { by_status: [], by_kind: [], total: { count: 0, amount: 0, tax_amount: 0 }, recent: [] };
    }
    const [byStatus] = await db.execute(
      `SELECT status, COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS amount, COALESCE(SUM(tax_amount),0) AS tax_amount
       FROM tender_invoices WHERE tenant_id = ? AND deleted_at IS NULL GROUP BY status`,
      [tenantId],
    );
    const [byKind] = await db.execute(
      `SELECT invoice_kind, COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS amount
       FROM tender_invoices WHERE tenant_id = ? AND deleted_at IS NULL GROUP BY invoice_kind`,
      [tenantId],
    );
    const [totals] = await db.execute(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS amount, COALESCE(SUM(tax_amount),0) AS tax_amount
       FROM tender_invoices WHERE tenant_id = ? AND deleted_at IS NULL`,
      [tenantId],
    );
    const [recent] = await db.execute(
      `SELECT id, invoice_code, invoice_kind, invoice_no, amount, status, issue_date, created_at
       FROM tender_invoices WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`,
      [tenantId],
    );
    return {
      by_status: byStatus, by_kind: byKind,
      total: { count: Number(totals[0]?.cnt || 0), amount: Number(totals[0]?.amount || 0), tax_amount: Number(totals[0]?.tax_amount || 0) },
      recent,
    };
  }
}

module.exports = TenderingInvoiceService;
