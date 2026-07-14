const db = require('../../../config/database');
const logger = require('../../../config/logger');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { publishAsync } = require('../../../core/EventBus');

// 招标类型与方式常量
const TENDER_TYPES = ['asset_purchase', 'parts', 'maintenance_service'];
const TENDER_METHODS = ['public', 'invite', 'competitive'];
// 采购与招标统一闭环（合并采购管理后扩展为 10 态）：
// applying（采购申请） → draft（立项） → published（发布） → bidding（投标） → evaluating（评标）
// → awarded（定标） → contract_signing（合同签订） → accepting（合同验收） → completed（完成）
// cancelled 任何中间态可触发；completed/cancelled 为终态
// 简易采购（tender_category='simple'）走 applying → completed 快速通过；详见 applyCategoryTransitionWhitelist
const TENDER_STATUSES = [
  'applying', 'draft', 'published', 'bidding', 'evaluating', 'awarded',
  'contract_signing', 'accepting', 'completed', 'cancelled',
];
const SUPPLIER_STATUSES = ['pending', 'qualified', 'rejected', 'blacklisted'];
// 供应商类别（多选，逗号分隔存储）
const SUPPLIER_CATEGORIES = ['repair', 'parts', 'asset', 'consumable'];

// 合同状态：draft → pending_review → approved/rejected → signed → executing → archived/terminated
const CONTRACT_STATUSES = ['draft', 'pending_review', 'approved', 'rejected', 'signed', 'executing', 'archived', 'terminated'];
const CONTRACT_TYPES = ['purchase', 'lease', 'service'];

// 招标状态转换矩阵（普通招标 tender_category='tender'）：
// applying → draft（采购申请审批通过→立项）/ cancelled
// draft → published（发布）/ cancelled
// published → bidding（开始投标）/ cancelled
// bidding → evaluating（开始评标）/ published（撤回投标）/ cancelled
// evaluating → awarded（定标）/ bidding（撤回评标）/ cancelled
// awarded → contract_signing（进入合同签订流程）/ cancelled（取消中标，需重新定标）
// contract_signing → accepting（合同签订后进入验收）/ cancelled
// accepting → completed（验收通过，采购与招标闭环）/ cancelled
// completed → 终态，不可流转
// cancelled → 终态，不可复活
const TENDER_STATUS_TRANSITIONS = {
  applying: ['draft', 'completed', 'cancelled'],
  draft: ['published', 'applying', 'cancelled'],
  published: ['bidding', 'cancelled'],
  bidding: ['evaluating', 'published', 'cancelled'],
  evaluating: ['awarded', 'bidding', 'cancelled'],
  awarded: ['contract_signing', 'cancelled'],
  contract_signing: ['accepting', 'cancelled'],
  accepting: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// 流程分类白名单：
// - tender（招标）：走完整 7 段闭环（applying→completed）
// - simple（简易采购）：申请(applying)审批通过 → 直接 completed（一步到位），无需招标
// - agreement（协议采购）：申请(applying)通过 → 直接 awarded → contract_signing → accepting → completed
//                  跳过 draft/published/bidding/evaluating
const CATEGORY_TRANSITION_WHITELIST = {
  simple: {
    applying: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  },
  agreement: {
    applying: ['awarded', 'cancelled'],
    awarded: ['contract_signing', 'cancelled'],
    contract_signing: ['accepting', 'cancelled'],
    accepting: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  },
};

// 合同状态转换矩阵
// draft → pending_review（提交审批）
// pending_review → approved（审批通过）/ rejected（审批驳回）
// rejected → draft（重新起草）/ pending_review（再次提交）
// approved → signed（签订）
// signed → executing（开始履行）
// executing → archived（归档）/ terminated（终止）
// archived → 终态
// terminated → 终态
const CONTRACT_STATUS_TRANSITIONS = {
  draft: ['pending_review'],
  pending_review: ['approved', 'rejected'],
  rejected: ['draft', 'pending_review'],
  approved: ['signed'],
  signed: ['executing'],
  executing: ['archived', 'terminated'],
  archived: [],
  terminated: [],
};

function isValidContractStatusTransition(fromStatus, toStatus) {
  const allowed = CONTRACT_STATUS_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

function isValidStatusTransition(fromStatus, toStatus, category = 'tender') {
  // 简易采购/协议采购走自己专属白名单（仅允许合法状态）
  if (category !== 'tender' && CATEGORY_TRANSITION_WHITELIST[category]) {
    const allowed = CATEGORY_TRANSITION_WHITELIST[category][fromStatus] || [];
    return allowed.includes(toStatus);
  }
  // 普通招标走主矩阵
  const allowed = TENDER_STATUS_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

// 邮箱格式校验正则（供应商联系邮箱，用于邮件通知）
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/**
 * 校验供应商联系邮箱：必填且格式合法
 * @param {*} raw - 原始邮箱值
 * @throws {Error} 邮箱为空或格式不合法时抛错
 */
function validateSupplierEmail(raw) {
  const email = String(raw || '').trim();
  if (!email) throw new Error('请填写联系邮箱，以便接收中标/资质/邀请等邮件通知');
  if (!EMAIL_REGEX.test(email)) throw new Error('联系邮箱格式不合法');
  return email;
}

// 招标文件默认章节模板
const DEFAULT_TENDER_SECTIONS = [
  { section_code: 'cover', section_title: '招标公告', required: true },
  { section_code: 'notice', section_title: '投标人须知', required: true },
  { section_code: 'scope', section_title: '采购需求与技术规格', required: true },
  { section_code: 'qualification', section_title: '投标人资格要求', required: true },
  { section_code: 'evaluation', section_title: '评标办法', required: true },
  { section_code: 'commercial', section_title: '商务条款', required: false },
  { section_code: 'contract', section_title: '合同主要条款', required: false },
  { section_code: 'submission', section_title: '投标文件格式与递交', required: false },
];

// 分享 token 默认权限
const SHARE_TOKEN_DEFAULT_PERMISSIONS = ['view', 'download', 'qualify', 'bid'];
const SHARE_TOKEN_VALID_DAYS = 30;
// 频控：单 IP 每分钟 60 次；单 token 提交类操作每分钟 10 次
const SHARE_IP_LIMIT_PER_MIN = 60;
const SHARE_WRITE_LIMIT_PER_MIN = 10;

// 资质类型字典
const QUALIFICATION_TYPES = {
  business_license: '营业执照',
  tax_cert: '税务登记证',
  qualification: '行业资质证书',
  authorization: '授权代理证书',
  financial: '财务报表',
  other: '其他材料',
};

// token 过期天数
const TOKEN_VALID_DAYS = 30;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeMoney(value) {
  if (value === undefined || value === null || value === '') return 0;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : Number.NaN;
}

function normalizeDate(value) {
  const source = String(value || '').trim();
  if (!source) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) return source;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function normalizeDateTime(value) {
  const source = String(value || '').trim();
  if (!source) return null;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function buildTenderCode() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ZB${datePart}${Date.now().toString().slice(-6)}${randomPart}`;
}

// 生成合同编号：HT{YYYYMMDD}{时间戳后6位}{4位随机数}
function buildContractCode() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `HT${datePart}${Date.now().toString().slice(-6)}${randomPart}`;
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

// 自动建表与升级：模块启动时执行迁移 SQL
async function ensureTables() {
  try {
    const migrationsDir = path.join(__dirname, '../migrations');
    if (!fs.existsSync(migrationsDir)) return;

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sqlPath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');
      // 移除 -- 注释行后再按 ; 拆分执行
      const cleaned = sqlContent
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n');
      const statements = cleaned
        .split(';')
        .map(s => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        try {
          await db.execute(stmt);
        } catch (innerErr) {
          // 升级脚本可能因为旧约束不存在而失败，单条失败不影响整体
          logger.warn(`[${file}] 语句执行失败(可忽略): ${innerErr.message}`);
        }
      }
    }
    logger.info('招标采购模块表结构已就绪');
  } catch (error) {
    logger.warn('招标采购模块建表/校验跳过:', error.message);
  }
}

// 单次保证
let tableEnsurePromise = null;
function ensureTablesOnce() {
  if (!tableEnsurePromise) {
    tableEnsurePromise = ensureTables().catch(err => {
      tableEnsurePromise = null;
      throw err;
    });
  }
  return tableEnsurePromise;
}

class TenderingService {
  // ==================== 招标项目 ====================

  async listTenders(params) {
    await ensureTablesOnce();
    const { page = 1, pageSize = 20, keyword, tender_type, tender_category, status, tenantId } = params;
    const pageNum = parsePositiveInt(page, 1);
    const pageSizeNum = parsePositiveInt(pageSize, 20);
    const offset = (pageNum - 1) * pageSizeNum;

    const where = ['tenant_id = ?', 'deleted_at IS NULL'];
    const queryParams = [tenantId];
    if (status && TENDER_STATUSES.includes(status)) {
      where.push('status = ?');
      queryParams.push(status);
    }
    if (tender_type && TENDER_TYPES.includes(tender_type)) {
      where.push('tender_type = ?');
      queryParams.push(tender_type);
    }
    if (tender_category && ['tender', 'simple', 'agreement'].includes(tender_category)) {
      where.push('tender_category = ?');
      queryParams.push(tender_category);
    }
    if (keyword) {
      where.push('(tender_code LIKE ? OR title LIKE ? OR asset_name LIKE ?)');
      queryParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM tender_projects ${whereClause}`,
      queryParams,
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.execute(
      `SELECT * FROM tender_projects ${whereClause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...queryParams, pageSizeNum, offset],
    );

    return {
      data: rows,
      pagination: { page: pageNum, pageSize: pageSizeNum, total, totalPages: pageSizeNum > 0 ? Math.ceil(total / pageSizeNum) : 0 },
    };
  }

  async getTenderById(id, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      'SELECT * FROM tender_projects WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1',
      [id, tenantId],
    );
    if (rows.length === 0) return null;
    return rows[0];
  }

  async createTender(data, tenantId, userId) {
    await ensureTablesOnce();
    const title = String(data.title || '').trim();
    if (!title) throw new Error('招标项目名称不能为空');

    const tenderType = TENDER_TYPES.includes(data.tender_type) ? data.tender_type : 'asset_purchase';
    const tenderMethod = TENDER_METHODS.includes(data.tender_method) ? data.tender_method : 'public';
    const tenderCategory = ['tender', 'simple', 'agreement'].includes(data.tender_category)
      ? data.tender_category
      : 'tender';
    // 默认入站状态：tender 默认 draft；simple/agreement 默认 applying（采购申请前置阶段）
    const initialStatus = tenderCategory === 'tender' ? 'draft' : 'applying';
    const budgetAmount = normalizeMoney(data.budget_amount);
    if (Number.isNaN(budgetAmount)) throw new Error('预算金额必须是大于等于 0 的数字');

    const tenderCode = buildTenderCode();
    const now = new Date();

    // 事务：tender_projects INSERT + 默认章节批量 INSERT 必须同时成功
    await db.execute('START TRANSACTION');
    let result;
    try {
      [result] = await db.execute(
        `INSERT INTO tender_projects (
          tenant_id, tender_code, title, tender_type, tender_category, description, procurement_request_id,
          asset_code, asset_name, department, budget_amount, currency, tender_method,
          publish_date, deadline, open_bid_date, contact_person, contact_phone, status, remark,
          requestor_id, requestor_name, request_department, request_budget, expected_delivery_date, asset_specification,
          created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId, tenderCode, title, tenderType, tenderCategory, data.description || null, data.procurement_request_id || null,
          data.asset_code || null, data.asset_name || null, data.department || null, budgetAmount,
          String(data.currency || 'CNY').trim() || 'CNY', tenderMethod,
          normalizeDate(data.publish_date), normalizeDateTime(data.deadline), normalizeDateTime(data.open_bid_date),
          data.contact_person || null, data.contact_phone || null, initialStatus, data.remark || null,
          data.requestor_id || null, data.requestor_name || null,
          data.request_department || null, normalizeMoney(data.request_budget),
          normalizeDate(data.expected_delivery_date), data.asset_specification || null,
          userId, now,
        ],
      );

      // 仅招标类自动初始化默认招标文件章节；简易/协议采购不需章节
      if (tenderCategory === 'tender') {
        await this.initDefaultSections(result.insertId, tenantId, userId);
      }

      await db.execute('COMMIT');
    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }

    // 招标项目创建事件（异步，不阻塞）
    publishAsync('tender:created', {
      id: result.insertId,
      tender_code: tenderCode,
      title,
      tenderType,
      tenderMethod,
      tenderCategory,
      initialStatus,
      budgetAmount,
      createdBy: userId,
      tenantId,
    }).catch(e => logger.warn('发布 tender:created 事件失败:', e.message));

    return { id: result.insertId, tender_code: tenderCode, title, status: initialStatus };
  }

  // 内部辅助：发出招标状态流转事件（异步，不阻塞）
  _emitTenderStatusEvent(existing, status, tenantId) {
    const eventName = `tender:${status}`;
    publishAsync(eventName, {
      id: Number(existing.id),
      tender_code: existing.tender_code,
      title: existing.title,
      fromStatus: existing.status,
      toStatus: status,
      tenderType: existing.tender_type,
      department: existing.department,
      createdBy: existing.created_by,
      tenantId,
    }).catch(e => logger.warn(`发布 ${eventName} 事件失败:`, e.message));
  }

  async updateTender(id, data, tenantId) {
    await ensureTablesOnce();
    const existing = await this.getTenderById(id, tenantId);
    if (!existing) throw new Error('招标项目不存在');
    if (existing.status !== 'draft') {
      // 允许修改部分字段但限制关键变更
      if (data.tender_type && data.tender_type !== existing.tender_type) {
        throw new Error('已发布的招标项目不能修改招标类型');
      }
    }

    const budgetAmount = data.budget_amount !== undefined ? normalizeMoney(data.budget_amount) : existing.budget_amount;
    if (Number.isNaN(budgetAmount)) throw new Error('预算金额必须是大于等于 0 的数字');

    const tenderMethod = TENDER_METHODS.includes(data.tender_method) ? data.tender_method : existing.tender_method;

    await db.execute(
      `UPDATE tender_projects SET
        title = ?, description = ?, asset_code = ?, asset_name = ?, department = ?,
        budget_amount = ?, currency = ?, tender_method = ?,
        publish_date = ?, deadline = ?, open_bid_date = ?,
        contact_person = ?, contact_phone = ?, remark = ?, updated_at = NOW()
      WHERE id = ? AND tenant_id = ?`,
      [
        data.title !== undefined ? String(data.title).trim() : existing.title,
        data.description !== undefined ? data.description : existing.description,
        data.asset_code !== undefined ? data.asset_code : existing.asset_code,
        data.asset_name !== undefined ? data.asset_name : existing.asset_name,
        data.department !== undefined ? data.department : existing.department,
        budgetAmount,
        data.currency || existing.currency,
        tenderMethod,
        data.publish_date !== undefined ? normalizeDate(data.publish_date) : existing.publish_date,
        data.deadline !== undefined ? normalizeDateTime(data.deadline) : existing.deadline,
        data.open_bid_date !== undefined ? normalizeDateTime(data.open_bid_date) : existing.open_bid_date,
        data.contact_person !== undefined ? data.contact_person : existing.contact_person,
        data.contact_phone !== undefined ? data.contact_phone : existing.contact_phone,
        data.remark !== undefined ? data.remark : existing.remark,
        id, tenantId,
      ],
    );

    return { id: Number(id) };
  }

  async changeTenderStatus(id, status, tenantId) {
    return this.changeTenderStatusWithApproval(id, status, tenantId, null);
  }

  /**
   * 带审批门的状态流转：如果是高风险动作（publish/award/contract_signing），
   * 先调用 ApprovalEngine.requestApproval，若需审批则返回 { pending_approval: true, record_id }，
   * 不直接修改状态；审批通过后调用者再次调用本方法（status 一致）即可落地。
   *
   * 落地闭环修复：每次进入审批门之前先查 hasApprovedRecord(entity, trigger_action)，
   * 若已批准则跳过审批门,直接 update status,避免每次重调都开新审批单导致状态永远不落地。
   * 同一 trigger_action 视为同一道审批门,一次通过后该 entity 的对应门视为永久放行。
   * （如需"重置审批门"请走单独的 resetApproval API,目前未实现）
   */
  async changeTenderStatusWithApproval(id, status, tenantId, user) {
    await ensureTablesOnce();
    if (!TENDER_STATUSES.includes(status)) throw new Error('招标状态无效');
    const existing = await this.getTenderById(id, tenantId);
    if (!existing) throw new Error('招标项目不存在');
    const category = existing.tender_category || 'tender';
    if (!isValidStatusTransition(existing.status, status, category)) {
      throw new Error(`不允许从状态 "${existing.status}" 流转到 "${status}"（流程分类:${category}）`);
    }

    // 1) 高风险门 → 先查"已批准 record"放行,否则走 requestApproval
    const guardedTriggers = { published: 'publish', awarded: 'award', contract_signing: 'archive' };
    const triggerAction = guardedTriggers[status];
    if (triggerAction && user) {
      let alreadyApproved = false;
      try {
        const ApprovalEngine = require('./approval-engine.service');
        const engine = new ApprovalEngine();
        alreadyApproved = await engine.hasApprovedRecord({
          tenantId, entity_type: 'tender_projects', entity_id: id,
          trigger_action: triggerAction,
        });
      } catch (e) {
        // 引擎表不存在 / 查询异常 → 视为未批准,继续走 requestApproval
        logger.warn(`[tendering] hasApprovedRecord 查询异常，按未批准处理: ${e.message}`);
      }

      if (!alreadyApproved) {
        try {
          const ApprovalEngine = require('./approval-engine.service');
          const engine = new ApprovalEngine();
          const ctx = { budget_amount: Number(existing.budget_amount || 0) };
          const approval = await engine.requestApproval({
            tenantId, entity_type: 'tender_projects', entity_id: id,
            trigger_action: triggerAction, context: ctx, initiator: user,
            new_status: status,
          });
          if (approval.approved === false) {
            // 把状态置为 'pending_approval' 占位(若启用), 此处用 publishAsync 通知前端
            publishAsync('tender:approval:pending', {
              id, status, record_id: approval.record_id, flow_code: approval.flow?.flow_code,
              tenantId, userId: user.id,
            });
            return { id: Number(id), status: existing.status, pending_approval: true, record_id: approval.record_id };
          }
        } catch (e) {
          // 引擎不可用 / 抛错 → 静默放行（容错）
          logger.warn('[tendering] 审批引擎不可用，放行状态流转: ' + e.message);
        }
      } else {
        logger.info(
          `[tendering] 检测到 entity=${id} trigger_action=${triggerAction} 已批准,跳过审批门,直接落地 status=${status}`,
        );
      }
    }

    // 2) 直接落地状态
    await db.execute(
      'UPDATE tender_projects SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [status, id, tenantId],
    );
    this._emitTenderStatusEvent(existing, status, tenantId);
    return { id: Number(id), status };
  }

  async deleteTender(id, tenantId) {
    await ensureTablesOnce();
    const existing = await this.getTenderById(id, tenantId);
    if (!existing) throw new Error('招标项目不存在');
    if (existing.status !== 'draft' && existing.status !== 'cancelled') {
      throw new Error('仅草稿或已取消状态的招标项目可删除');
    }
    // 软删除：保留审计数据，避免子表（tender_bids/evaluations/invitations）出现孤儿引用
    await db.execute(
      'UPDATE tender_projects SET deleted_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    return true;
  }

  // ==================== 招标文件制作 ====================

  async initDefaultSections(tenderId, tenantId, userId) {
    const values = DEFAULT_TENDER_SECTIONS.map((s, idx) => [
      tenantId, tenderId, s.section_code, s.section_title, '', idx, s.required ? 1 : 0, userId || null,
    ]);
    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const flat = values.flat();
    await db.execute(
      `INSERT INTO tender_documents (tenant_id, tender_id, section_code, section_title, section_content, section_order, required, updated_by)
       VALUES ${placeholders}`,
      flat,
    );
  }

  async listSections(tenderId, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      'SELECT * FROM tender_documents WHERE tender_id = ? AND tenant_id = ? ORDER BY section_order ASC, id ASC',
      [tenderId, tenantId],
    );
    return rows;
  }

  async upsertSection(tenderId, sectionData, tenantId, userId) {
    await ensureTablesOnce();
    // 校验招标项目归属
    const tender = await this.getTenderById(tenderId, tenantId);
    if (!tender) throw new Error('招标项目不存在');

    const sectionCode = String(sectionData.section_code || '').trim();
    const sectionTitle = String(sectionData.section_title || '').trim();
    if (!sectionCode || !sectionTitle) throw new Error('章节编码与标题不能为空');

    const [existing] = await db.execute(
      'SELECT id FROM tender_documents WHERE tender_id = ? AND section_code = ? LIMIT 1',
      [tenderId, sectionCode],
    );

    if (existing.length > 0) {
      await db.execute(
        `UPDATE tender_documents SET section_title = ?, section_content = ?, section_order = ?, required = ?, updated_by = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          sectionTitle,
          sectionData.section_content || '',
          Number(sectionData.section_order) || 0,
          sectionData.required ? 1 : 0,
          userId || null,
          existing[0].id,
        ],
      );
      return { id: existing[0].id, updated: true };
    }

    const [result] = await db.execute(
      `INSERT INTO tender_documents (tenant_id, tender_id, section_code, section_title, section_content, section_order, required, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, tenderId, sectionCode, sectionTitle,
        sectionData.section_content || '',
        Number(sectionData.section_order) || 0,
        sectionData.required ? 1 : 0,
        userId || null,
      ],
    );
    return { id: result.insertId, created: true };
  }

  async deleteSection(tenderId, sectionCode, tenantId) {
    await ensureTablesOnce();
    const [result] = await db.execute(
      'DELETE FROM tender_documents WHERE tender_id = ? AND section_code = ? AND tenant_id = ?',
      [tenderId, sectionCode, tenantId],
    );
    return result.affectedRows > 0;
  }

  // 上传招标附件
  async uploadTenderFile(tenderId, file, fileData, tenantId, userId) {
    await ensureTablesOnce();
    const tender = await this.getTenderById(tenderId, tenantId);
    if (!tender) throw new Error('招标项目不存在');
    const fileType = String(fileData.file_type || 'attachment').trim() || 'attachment';
    const [result] = await db.execute(
      `INSERT INTO tender_files (tenant_id, tender_id, file_type, original_name, file_name, file_path, mime_type, file_size, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        tenantId, tenderId, fileType,
        file.originalname || null, file.filename || null, file.path || null,
        file.mimetype || null, file.size || 0, userId || null,
      ],
    );
    return { id: result.insertId, tender_id: Number(tenderId), file_type: fileType };
  }

  async listTenderFiles(tenderId, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      'SELECT * FROM tender_files WHERE tender_id = ? AND tenant_id = ? ORDER BY created_at DESC',
      [tenderId, tenantId],
    );
    return rows;
  }

  // 删除招标附件
  async deleteTenderFile(fileId, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      'SELECT id, file_path FROM tender_files WHERE id = ? AND tenant_id = ? LIMIT 1',
      [fileId, tenantId],
    );
    if (rows.length === 0) throw new Error('附件不存在');
    const file = rows[0];
    await db.execute('DELETE FROM tender_files WHERE id = ? AND tenant_id = ?', [fileId, tenantId]);

    // 尝试删除磁盘文件（失败不影响数据结果）
    if (file.file_path) {
      try {
        if (fs.existsSync(file.file_path)) {
          fs.unlinkSync(file.file_path);
        }
      } catch (e) {
        logger.warn('删除招标附件磁盘文件失败:', e.message);
      }
    }

    return { id: Number(fileId) };
  }

  // ==================== 供应商管理 ====================

  async listSuppliers(params) {
    await ensureTablesOnce();
    const { page = 1, pageSize = 20, keyword, status, category, tenantId } = params;
    const pageNum = parsePositiveInt(page, 1);
    const pageSizeNum = parsePositiveInt(pageSize, 20);
    const offset = (pageNum - 1) * pageSizeNum;

    const where = ['tenant_id = ?', 'deleted_at IS NULL'];
    const queryParams = [tenantId];
    if (status && SUPPLIER_STATUSES.includes(status)) {
      where.push('status = ?');
      queryParams.push(status);
    }
    if (category && SUPPLIER_CATEGORIES.includes(category)) {
      where.push('FIND_IN_SET(?, categories)');
      queryParams.push(category);
    }
    if (keyword) {
      where.push('(supplier_name LIKE ? OR unified_code LIKE ? OR contact_person LIKE ?)');
      queryParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM tender_suppliers ${whereClause}`,
      queryParams,
    );
    const total = Number(countRows[0]?.total || 0);
    const [rows] = await db.execute(
      `SELECT * FROM tender_suppliers ${whereClause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...queryParams, pageSizeNum, offset],
    );

    return {
      data: rows,
      pagination: { page: pageNum, pageSize: pageSizeNum, total, totalPages: pageSizeNum > 0 ? Math.ceil(total / pageSizeNum) : 0 },
    };
  }

  async getSupplierById(id, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      'SELECT * FROM tender_suppliers WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1',
      [id, tenantId],
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // 轻量下拉列表，供资产登记等全局场景引用供应商名称
  async getSupplierSelectList({ keyword, status, tenantId }) {
    await ensureTablesOnce();
    const where = ['tenant_id = ?', 'deleted_at IS NULL'];
    const params = [tenantId];
    if (status && SUPPLIER_STATUSES.includes(status)) {
      where.push('status = ?');
      params.push(status);
    } else {
      // 默认排除被拒绝/黑名单的供应商
      where.push("status NOT IN ('rejected', 'blacklisted')");
    }
    if (keyword) {
      where.push('(supplier_name LIKE ? OR unified_code LIKE ? OR contact_person LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    const [rows] = await db.execute(
      `SELECT id, supplier_name, unified_code, contact_person, contact_phone
       FROM tender_suppliers
       WHERE ${where.join(' AND ')}
       ORDER BY supplier_name
       LIMIT 100`,
      params,
    );
    return rows;
  }

  // 获取当前租户已使用的供应商类别列表（用于筛选下拉）
  async getSupplierCategories(tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      `SELECT DISTINCT categories FROM tender_suppliers
       WHERE tenant_id = ? AND deleted_at IS NULL AND categories IS NOT NULL AND categories != ''`,
      [tenantId],
    );
    const set = new Set();
    rows.forEach(r => {
      String(r.categories || '').split(',').forEach(c => {
        const v = c.trim();
        if (v && SUPPLIER_CATEGORIES.includes(v)) set.add(v);
      });
    });
    return Array.from(set);
  }

  // 规范化类别数组：过滤非法值，返回逗号分隔字符串
  normalizeCategories(raw) {
    let arr = Array.isArray(raw)
      ? raw
      : (typeof raw === 'string' ? raw.split(',') : []);
    arr = arr.map(x => String(x).trim()).filter(x => SUPPLIER_CATEGORIES.includes(x));
    return arr.length > 0 ? arr.join(',') : null;
  }

  async createSupplier(data, tenantId) {
    await ensureTablesOnce();
    const supplierName = String(data.supplier_name || '').trim();
    if (!supplierName) throw new Error('供应商名称不能为空');

    // 联系邮箱必填且校验格式（用于邮件通知）
    const contactEmail = validateSupplierEmail(data.contact_email);

    // 唯一性校验
    const [dup] = await db.execute(
      'SELECT id FROM tender_suppliers WHERE tenant_id = ? AND supplier_name = ? LIMIT 1',
      [tenantId, supplierName],
    );
    if (dup.length > 0) throw new Error('供应商名称已存在');

    const categories = this.normalizeCategories(data.categories);

    const [result] = await db.execute(
      `INSERT INTO tender_suppliers (
        tenant_id, supplier_name, unified_code, contact_person, contact_phone,
        contact_email, address, bank_account, categories, status, remark, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        tenantId, supplierName, data.unified_code || null, data.contact_person || null,
        data.contact_phone || null, contactEmail, data.address || null,
        data.bank_account || null, categories, 'pending', data.remark || null,
      ],
    );
    return { id: result.insertId, supplier_name: supplierName };
  }

  async updateSupplier(id, data, tenantId) {
    await ensureTablesOnce();
    const existing = await this.getSupplierById(id, tenantId);
    if (!existing) throw new Error('供应商不存在');

    const categories = data.categories !== undefined
      ? this.normalizeCategories(data.categories)
      : existing.categories;

    // 若显式传入邮箱则必填且校验格式（禁止清空邮箱，保证邮件通知可达）
    let contactEmail = data.contact_email !== undefined ? data.contact_email : existing.contact_email;
    if (data.contact_email !== undefined) {
      contactEmail = validateSupplierEmail(data.contact_email);
    }

    await db.execute(
      `UPDATE tender_suppliers SET
        supplier_name = ?, unified_code = ?, contact_person = ?, contact_phone = ?,
        contact_email = ?, address = ?, bank_account = ?, categories = ?, remark = ?, updated_at = NOW()
      WHERE id = ? AND tenant_id = ?`,
      [
        data.supplier_name !== undefined ? String(data.supplier_name).trim() : existing.supplier_name,
        data.unified_code !== undefined ? data.unified_code : existing.unified_code,
        data.contact_person !== undefined ? data.contact_person : existing.contact_person,
        data.contact_phone !== undefined ? data.contact_phone : existing.contact_phone,
        contactEmail,
        data.address !== undefined ? data.address : existing.address,
        data.bank_account !== undefined ? data.bank_account : existing.bank_account,
        categories,
        data.remark !== undefined ? data.remark : existing.remark,
        id, tenantId,
      ],
    );
    return { id: Number(id) };
  }

  async setSupplierStatus(id, status, tenantId) {
    await ensureTablesOnce();
    if (!SUPPLIER_STATUSES.includes(status)) throw new Error('供应商状态无效');
    const existing = await this.getSupplierById(id, tenantId);
    if (!existing) throw new Error('供应商不存在');
    await db.execute(
      'UPDATE tender_suppliers SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [status, id, tenantId],
    );
    return { id: Number(id), status };
  }

  async deleteSupplier(id, tenantId) {
    await ensureTablesOnce();
    const existing = await this.getSupplierById(id, tenantId);
    if (!existing) throw new Error('供应商不存在');
    // 软删除：保留审计数据，避免子表（tender_bids/evaluations/qualifications）出现孤儿引用
    await db.execute(
      'UPDATE tender_suppliers SET deleted_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    return true;
  }

  // 生成/刷新供应商的扫码上传资质 token
  async generateSupplierToken(id, tenantId, validDays = TOKEN_VALID_DAYS) {
    await ensureTablesOnce();
    const existing = await this.getSupplierById(id, tenantId);
    if (!existing) throw new Error('供应商不存在');
    const token = generateToken();
    const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);
    await db.execute(
      'UPDATE tender_suppliers SET register_token = ?, token_expires_at = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [token, expiresAt, id, tenantId],
    );
    return { token, expires_at: expiresAt, supplier_id: Number(id) };
  }

  // ==================== 供应商资质（公开接口，token 校验） ====================

  // 通过 token 解析供应商信息（公开访问，无需登录）
  async getSupplierByToken(token) {
    await ensureTablesOnce();
    if (!token) return null;
    const [rows] = await db.execute(
      'SELECT id, tenant_id, supplier_name, unified_code, contact_person, contact_phone, register_token, token_expires_at, status FROM tender_suppliers WHERE register_token = ? LIMIT 1',
      [token],
    );
    if (rows.length === 0) return null;
    const supplier = rows[0];
    // token 过期校验
    if (supplier.token_expires_at && new Date(supplier.token_expires_at) < new Date()) {
      return { expired: true, supplier_name: supplier.supplier_name };
    }
    return { expired: false, ...supplier };
  }

  // 供应商扫码上传资质文件
  async uploadQualificationByToken(token, file, fileData) {
    await ensureTablesOnce();
    const supplier = await this.getSupplierByToken(token);
    if (!supplier) throw new Error('二维码无效或供应商不存在');
    if (supplier.expired) throw new Error('二维码已过期，请联系招标方重新生成');

    const qualificationType = String(fileData.qualification_type || 'other').trim();
    if (!QUALIFICATION_TYPES[qualificationType]) {
      throw new Error('资质类型无效');
    }

    const [result] = await db.execute(
      `INSERT INTO tender_supplier_qualifications (
        tenant_id, supplier_id, qualification_type, qualification_name,
        original_name, file_name, file_path, mime_type, file_size,
        valid_until, upload_source, review_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'qr_scan', 'pending', NOW())`,
      [
        supplier.tenant_id, supplier.id, qualificationType,
        fileData.qualification_name || QUALIFICATION_TYPES[qualificationType],
        file.originalname || null, file.filename || null, file.path || null,
        file.mimetype || null, file.size || 0,
        normalizeDate(fileData.valid_until) || null,
      ],
    );

    return {
      id: result.insertId,
      supplier_id: supplier.id,
      supplier_name: supplier.supplier_name,
      qualification_type: qualificationType,
    };
  }

  // 招标方查看某供应商的资质列表
  async listQualifications(supplierId, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      'SELECT * FROM tender_supplier_qualifications WHERE supplier_id = ? AND tenant_id = ? ORDER BY created_at DESC',
      [supplierId, tenantId],
    );
    return rows;
  }

  // 审核资质
  async reviewQualification(qualificationId, reviewStatus, reviewComment, tenantId, userId) {
    await ensureTablesOnce();
    if (!['pending', 'approved', 'rejected'].includes(reviewStatus)) {
      throw new Error('审核状态无效');
    }
    const [existing] = await db.execute(
      'SELECT id, supplier_id FROM tender_supplier_qualifications WHERE id = ? AND tenant_id = ? LIMIT 1',
      [qualificationId, tenantId],
    );
    if (existing.length === 0) throw new Error('资质材料不存在');

    await db.execute(
      `UPDATE tender_supplier_qualifications
       SET review_status = ?, review_comment = ?, reviewed_by = ?, reviewed_at = NOW(), reviewed = 1, updated_at = NOW()
       WHERE id = ?`,
      [reviewStatus, reviewComment || null, userId || null, qualificationId],
    );

    // 若所有资质均通过，则供应商状态置为 qualified
    if (reviewStatus === 'approved') {
      const supplierId = existing[0].supplier_id;
      const [pending] = await db.execute(
        "SELECT COUNT(*) AS cnt FROM tender_supplier_qualifications WHERE supplier_id = ? AND tenant_id = ? AND review_status = 'pending'",
        [supplierId, tenantId],
      );
      if (Number(pending[0].cnt) === 0) {
        await db.execute(
          "UPDATE tender_suppliers SET status = 'qualified', updated_at = NOW() WHERE id = ? AND tenant_id = ?",
          [supplierId, tenantId],
        );
      }
    }

    // 资质审核结果事件（通知供应商）
    publishAsync('qualification:reviewed', {
      qualificationId: Number(qualificationId),
      supplierId: existing[0].supplier_id,
      reviewStatus,
      reviewComment,
      reviewedBy: userId,
      tenantId,
    }).catch(e => logger.warn('发布 qualification:reviewed 事件失败:', e.message));

    return { id: Number(qualificationId), review_status: reviewStatus };
  }

  // ==================== 招标邀请 / 二维码 ====================

  async inviteSupplier(tenderId, supplierId, tenantId, validDays = TOKEN_VALID_DAYS) {
    await ensureTablesOnce();
    const tender = await this.getTenderById(tenderId, tenantId);
    if (!tender) throw new Error('招标项目不存在');
    const supplier = await this.getSupplierById(supplierId, tenantId);
    if (!supplier) throw new Error('供应商不存在');

    const inviteToken = generateToken();
    const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);

    // upsert 邀请记录
    const [existing] = await db.execute(
      'SELECT id FROM tender_invitations WHERE tender_id = ? AND supplier_id = ? LIMIT 1',
      [tenderId, supplierId],
    );
    if (existing.length > 0) {
      await db.execute(
        'UPDATE tender_invitations SET invite_token = ?, invited_at = NOW(), expires_at = ?, status = ? WHERE id = ?',
        [inviteToken, expiresAt, 'pending', existing[0].id],
      );
      this._emitInvitationEvent(tenderId, supplierId, tender, supplier, tenantId);
      return { invitation_id: existing[0].id, invite_token: inviteToken, expires_at: expiresAt };
    }

    const [result] = await db.execute(
      `INSERT INTO tender_invitations (tenant_id, tender_id, supplier_id, invite_token, invited_at, expires_at, status)
       VALUES (?, ?, ?, ?, NOW(), ?, 'pending')`,
      [tenantId, tenderId, supplierId, inviteToken, expiresAt],
    );
    this._emitInvitationEvent(tenderId, supplierId, tender, supplier, tenantId);
    return { invitation_id: result.insertId, invite_token: inviteToken, expires_at: expiresAt };
  }

  // 内部辅助：发出招标邀请事件
  _emitInvitationEvent(tenderId, supplierId, tender, supplier, tenantId) {
    publishAsync('tender:invitation-sent', {
      tenderId: Number(tenderId),
      tender_code: tender.tender_code,
      tender_title: tender.title,
      supplierId,
      supplierName: supplier.supplier_name,
      contactPerson: supplier.contact_person,
      contactPhone: supplier.contact_phone,
      tenantId,
    }).catch(e => logger.warn('发布 tender:invitation-sent 事件失败:', e.message));
  }

  async listInvitations(tenderId, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      `SELECT i.*, s.supplier_name, s.unified_code, s.contact_person, s.contact_phone
       FROM tender_invitations i
       LEFT JOIN tender_suppliers s ON s.id = i.supplier_id
       WHERE i.tender_id = ? AND i.tenant_id = ?
       ORDER BY i.invited_at DESC`,
      [tenderId, tenantId],
    );
    return rows;
  }

  // ==================== 投标 ====================

  async listBids(tenderId, tenantId, options = {}) {
    await ensureTablesOnce();
    const { keyword, status, page = 1, pageSize = 50 } = options;
    const pageNum = parsePositiveInt(page, 1);
    const pageSizeNum = parsePositiveInt(pageSize, 50);
    const offset = (pageNum - 1) * pageSizeNum;

    const where = ['b.tenant_id = ?', 'b.tender_id = ?'];
    const params = [tenantId, tenderId];
    if (status && ['draft', 'submitted', 'withdrawn', 'won', 'lost'].includes(status)) {
      where.push('b.status = ?');
      params.push(status);
    }
    if (keyword) {
      where.push('(s.supplier_name LIKE ? OR b.bid_desc LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const whereClause = `WHERE ${where.join(' AND ')}`;

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM tender_bids b ${whereClause}`,
      params,
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.execute(
      `SELECT b.*, s.supplier_name, s.unified_code, s.contact_person, s.contact_phone
       FROM tender_bids b
       LEFT JOIN tender_suppliers s ON s.id = b.supplier_id
       ${whereClause}
       ORDER BY b.submitted_at DESC, b.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSizeNum, offset],
    );
    return {
      data: rows,
      pagination: { page: pageNum, pageSize: pageSizeNum, total, totalPages: pageSizeNum > 0 ? Math.ceil(total / pageSizeNum) : 0 },
    };
  }

  // 投标详情（含附件与评标）
  async getBidById(bidId, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      `SELECT b.*, s.supplier_name, s.unified_code, s.contact_person, s.contact_phone, s.contact_email
       FROM tender_bids b
       LEFT JOIN tender_suppliers s ON s.id = b.supplier_id
       WHERE b.id = ? AND b.tenant_id = ? LIMIT 1`,
      [bidId, tenantId],
    );
    if (rows.length === 0) return null;
    const bid = rows[0];
    // 关联评标记录
    const [evalRows] = await db.execute(
      'SELECT * FROM tender_evaluations WHERE bid_id = ? AND tenant_id = ? ORDER BY evaluated_at DESC, id DESC',
      [bidId, tenantId],
    );
    bid.evaluations = evalRows;
    // 投标附件
    const [fileRows] = await db.execute(
      'SELECT * FROM tender_files WHERE tender_id = ? AND tenant_id = ? AND file_type = ? ORDER BY created_at DESC',
      [bid.tender_id, tenantId, `bid_${bidId}`],
    );
    bid.attachments = fileRows;
    return bid;
  }

  // 供应商提交投标（公开接口 / 邀请方代录均支持）
  async submitBid(tenderId, data, tenantId) {
    await ensureTablesOnce();
    const tender = await this.getTenderById(tenderId, tenantId);
    if (!tender) throw new Error('招标项目不存在');
    if (!['published', 'bidding'].includes(tender.status)) {
      throw new Error('仅发布中或投标中的招标可接受投标');
    }

    const supplierId = parsePositiveInt(data.supplier_id, 0);
    if (!supplierId) throw new Error('供应商ID无效');

    // 校验供应商归属
    const supplier = await this.getSupplierById(supplierId, tenantId);
    if (!supplier) throw new Error('供应商不存在');
    // 黑名单供应商禁止投标
    if (supplier.status === 'blacklisted') {
      throw new Error('该供应商已被列入黑名单，禁止投标');
    }
    if (supplier.status === 'rejected') {
      throw new Error('该供应商资质已被驳回，禁止投标');
    }

    // 邀请招标：校验供应商是否被邀请
    if (tender.tender_method === 'invite') {
      const [invitations] = await db.execute(
        `SELECT id FROM tender_invitations
         WHERE tender_id = ? AND supplier_id = ? AND tenant_id = ?
         LIMIT 1`,
        [tenderId, supplierId, tenantId],
      );
      if (invitations.length === 0) {
        throw new Error('该供应商未被邀请，无法参与邀请招标');
      }
    }

    // 截止时间校验
    if (tender.deadline && new Date(tender.deadline) < new Date()) {
      throw new Error('投标截止时间已过期，无法提交');
    }

    // 报价校验
    const bidAmount = data.bid_amount !== undefined ? Number(data.bid_amount) : null;
    if (bidAmount !== null && (!Number.isFinite(bidAmount) || bidAmount < 0)) {
      throw new Error('投标报价必须是大于等于 0 的数字');
    }

    // upsert
    const [existing] = await db.execute(
      'SELECT id, status FROM tender_bids WHERE tender_id = ? AND supplier_id = ? AND tenant_id = ? LIMIT 1',
      [tenderId, supplierId, tenantId],
    );

    if (existing.length > 0) {
      const current = existing[0];
      if (current.status === 'won') {
        throw new Error('已中标的投标不能修改');
      }
      await db.execute(
        `UPDATE tender_bids SET
          bid_amount = ?, bid_currency = ?, bid_desc = ?, bid_files = ?,
          status = ?, submitted_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [
          bidAmount,
          String(data.bid_currency || tender.currency || 'CNY').trim() || 'CNY',
          data.bid_desc || null,
          data.bid_files ? JSON.stringify(data.bid_files) : null,
          data.draft_only ? 'draft' : 'submitted',
          current.id,
        ],
      );
      const updatedStatus = data.draft_only ? 'draft' : 'submitted';
      if (updatedStatus === 'submitted') {
        publishAsync('bid:submitted', {
          bidId: current.id,
          tenderId: Number(tenderId),
          tender_code: tender.tender_code,
          tender_title: tender.title,
          supplierId,
          supplierName: supplier.supplier_name,
          bidAmount,
          tenantId,
        }).catch(e => logger.warn('发布 bid:submitted 事件失败:', e.message));
      }
      return { id: current.id, updated: true, status: updatedStatus };
    }

    const [result] = await db.execute(
      `INSERT INTO tender_bids (
        tenant_id, tender_id, supplier_id, bid_amount, bid_currency, bid_desc, bid_files, status, submitted_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        tenantId,
        tenderId,
        supplierId,
        bidAmount,
        String(data.bid_currency || tender.currency || 'CNY').trim() || 'CNY',
        data.bid_desc || null,
        data.bid_files ? JSON.stringify(data.bid_files) : null,
        data.draft_only ? 'draft' : 'submitted',
      ],
    );
    const createdStatus = data.draft_only ? 'draft' : 'submitted';
    if (createdStatus === 'submitted') {
      publishAsync('bid:submitted', {
        bidId: result.insertId,
        tenderId: Number(tenderId),
        tender_code: tender.tender_code,
        tender_title: tender.title,
        supplierId,
        supplierName: supplier.supplier_name,
        bidAmount,
        tenantId,
      }).catch(e => logger.warn('发布 bid:submitted 事件失败:', e.message));
    }
    return { id: result.insertId, created: true, status: createdStatus };
  }

  // 撤销投标
  async withdrawBid(bidId, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      'SELECT id, status, tender_id FROM tender_bids WHERE id = ? AND tenant_id = ? LIMIT 1',
      [bidId, tenantId],
    );
    if (rows.length === 0) throw new Error('投标记录不存在');
    const bid = rows[0];
    if (bid.status === 'won') throw new Error('已中标的投标不能撤销');
    if (bid.status === 'withdrawn') return { id: bidId, status: 'withdrawn' };

    await db.execute(
      'UPDATE tender_bids SET status = ?, updated_at = NOW() WHERE id = ?',
      ['withdrawn', bidId],
    );
    return { id: Number(bidId), status: 'withdrawn' };
  }

  // 中标定标：将某投标标记为中标，其他同招标未中标的标记为 lost
  async awardBid(tenderId, bidId, tenantId) {
    await ensureTablesOnce();
    const tender = await this.getTenderById(tenderId, tenantId);
    if (!tender) throw new Error('招标项目不存在');
    // 仅评标中（evaluating）状态允许定标，避免跳过评标环节
    if (tender.status !== 'evaluating') {
      throw new Error('仅评标中状态的招标可定标');
    }

    const [rows] = await db.execute(
      'SELECT id, supplier_id, status FROM tender_bids WHERE id = ? AND tender_id = ? AND tenant_id = ? LIMIT 1',
      [bidId, tenderId, tenantId],
    );
    if (rows.length === 0) throw new Error('投标记录不存在');
    if (rows[0].status === 'withdrawn') throw new Error('已撤销的投标不能中标');
    if (rows[0].status === 'won') throw new Error('该投标已中标，无需重复定标');

    // 事务：标记中标 + 其他已提交/已中标的投标标记为 lost
    await db.execute('START TRANSACTION');
    try {
      // 将同招标其他已中标(won)/已提交(submitted)的投标置为 lost
      // draft 状态不参与（未正式提交，保留草稿不影响其后续投标其他项目）
      await db.execute(
        `UPDATE tender_bids SET status = 'lost', updated_at = NOW()
         WHERE tender_id = ? AND tenant_id = ? AND id <> ?
           AND status IN ('won', 'submitted')`,
        [tenderId, tenantId, bidId],
      );
      await db.execute(
        `UPDATE tender_bids SET status = 'won', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
        [bidId, tenantId],
      );
      // 招标状态推进到 awarded
      await db.execute(
        'UPDATE tender_projects SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
        ['awarded', tenderId, tenantId],
      );
      await db.execute('COMMIT');
    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }

    // 中标定标事件（通知中标供应商 + 招标方）
    publishAsync('bid:awarded', {
      bidId: Number(bidId),
      tenderId: Number(tenderId),
      tender_code: tender.tender_code,
      tender_title: tender.title,
      supplierId: rows[0].supplier_id,
      tenantId,
    }).catch(e => logger.warn('发布 bid:awarded 事件失败:', e.message));

    return { id: Number(bidId), tender_id: Number(tenderId), status: 'won' };
  }

  // ==================== 评标 ====================

  async listEvaluations(tenderId, tenantId, options = {}) {
    await ensureTablesOnce();
    const { bidId } = options;
    const where = ['e.tenant_id = ?', 'e.tender_id = ?'];
    const params = [tenantId, tenderId];
    if (bidId) {
      where.push('e.bid_id = ?');
      params.push(bidId);
    }
    const whereClause = `WHERE ${where.join(' AND ')}`;
    const [rows] = await db.execute(
      `SELECT e.*, s.supplier_name, evaluator.real_name AS evaluator_name, evaluator.username AS evaluator_username
       FROM tender_evaluations e
       LEFT JOIN tender_suppliers s ON s.id = e.supplier_id
       LEFT JOIN users evaluator ON evaluator.id = e.evaluator_id
       ${whereClause}
       ORDER BY e.recommended DESC, e.score DESC`,
      params,
    );
    return rows;
  }

  async submitEvaluation(tenderId, data, tenantId, userId) {
    await ensureTablesOnce();
    const supplierId = parsePositiveInt(data.supplier_id, 0);
    if (!supplierId) throw new Error('供应商ID无效');

    // 校验招标项目归属
    const tender = await this.getTenderById(tenderId, tenantId);
    if (!tender) throw new Error('招标项目不存在');
    // 仅评标中（或投标中转评标）状态允许提交评标，避免已定标/已完成后再次评标
    if (!['bidding', 'evaluating'].includes(tender.status)) {
      throw new Error('当前招标状态不允许评标');
    }

    // 若指定了 bidId 则需要校验归属
    let bidId = data.bid_id !== undefined ? parsePositiveInt(data.bid_id, 0) : null;
    if (bidId) {
      const [bidRows] = await db.execute(
        'SELECT id FROM tender_bids WHERE id = ? AND tender_id = ? AND tenant_id = ? LIMIT 1',
        [bidId, tenderId, tenantId],
      );
      if (bidRows.length === 0) throw new Error('关联的投标记录不存在');
    }

    const score = data.score !== undefined ? Number(data.score) : null;
    const priceScore = data.price_score !== undefined ? Number(data.price_score) : null;
    const techScore = data.tech_score !== undefined ? Number(data.tech_score) : null;
    const recommended = data.recommended ? 1 : 0;

    // 分数范围校验
    const validateScore = (val, name) => {
      if (val === null || val === undefined) return;
      if (!Number.isFinite(val) || val < 0 || val > 100) {
        throw new Error(`${name}必须在 0-100 之间`);
      }
    };
    validateScore(score, '总分');
    validateScore(priceScore, '价格分');
    validateScore(techScore, '技术分');

    // upsert：同一 (tender, supplier, evaluator) 仅一条
    const [existing] = await db.execute(
      `SELECT id FROM tender_evaluations
       WHERE tender_id = ? AND supplier_id = ? AND tenant_id = ? AND evaluator_id = ? LIMIT 1`,
      [tenderId, supplierId, tenantId, userId || 0],
    );

    if (existing.length > 0) {
      await db.execute(
        `UPDATE tender_evaluations SET
          bid_id = ?, score = ?, price_score = ?, tech_score = ?,
          evaluation_comment = ?, recommended = ?,
          evaluator_id = ?, evaluated_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [
          bidId || null,
          score,
          priceScore,
          techScore,
          data.evaluation_comment || null,
          recommended,
          userId || null,
          existing[0].id,
        ],
      );
      return { id: existing[0].id, updated: true };
    }

    try {
      const [result] = await db.execute(
        `INSERT INTO tender_evaluations (
          tenant_id, tender_id, supplier_id, bid_id, score, price_score, tech_score,
          evaluation_comment, recommended, evaluator_id, evaluated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          tenantId,
          tenderId,
          supplierId,
          bidId || null,
          score,
          priceScore,
          techScore,
          data.evaluation_comment || null,
          recommended,
          userId || null,
        ],
      );
      return { id: result.insertId, created: true };
    } catch (insertErr) {
      // 并发场景下：两位评标人/同一评标人多次提交，可能同时通过 existing 检查，
      // DB 唯一约束 uk_tender_supplier_evaluator 拒绝第二条 INSERT。
      // 此处降级为 UPDATE 已有记录，保证幂等。
      if (insertErr && (insertErr.code === 'ER_DUP_ENTRY' || insertErr.errno === 1062)) {
        logger.warn(`submitEvaluation 并发冲突，已降级为 UPDATE 已存在记录: ${insertErr.message}`);
        const [dup] = await db.execute(
          `SELECT id FROM tender_evaluations
           WHERE tender_id = ? AND supplier_id = ? AND tenant_id = ? AND evaluator_id = ? LIMIT 1`,
          [tenderId, supplierId, tenantId, userId || 0],
        );
        if (dup.length > 0) {
          await db.execute(
            `UPDATE tender_evaluations SET
              bid_id = ?, score = ?, price_score = ?, tech_score = ?,
              evaluation_comment = ?, recommended = ?,
              evaluator_id = ?, evaluated_at = NOW(), updated_at = NOW()
             WHERE id = ?`,
            [
              bidId || null,
              score,
              priceScore,
              techScore,
              data.evaluation_comment || null,
              recommended,
              userId || null,
              dup[0].id,
            ],
          );
          return { id: dup[0].id, updated: true, deduplicated: true };
        }
        throw new Error('评标记录并发冲突，请稍后重试');
      }
      throw insertErr;
    }
  }

  // 综合评分：按 supplier 分组统计平均分
  async summarizeEvaluations(tenderId, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      `SELECT
         e.supplier_id,
         s.supplier_name,
         COUNT(*) AS evaluator_count,
         ROUND(AVG(e.score), 2) AS avg_score,
         ROUND(AVG(e.price_score), 2) AS avg_price_score,
         ROUND(AVG(e.tech_score), 2) AS avg_tech_score,
         SUM(CASE WHEN e.recommended = 1 THEN 1 ELSE 0 END) AS recommend_count
       FROM tender_evaluations e
       LEFT JOIN tender_suppliers s ON s.id = e.supplier_id
       WHERE e.tender_id = ? AND e.tenant_id = ?
       GROUP BY e.supplier_id, s.supplier_name
       ORDER BY avg_score DESC`,
      [tenderId, tenantId],
    );
    return rows;
  }

  // ==================== 统计概览 ====================

  async getStatistics(tenantId) {
    await ensureTablesOnce();
    // 招标状态分布
    const [statusRows] = await db.execute(
      `SELECT status, COUNT(*) AS cnt FROM tender_projects
       WHERE tenant_id = ? GROUP BY status`,
      [tenantId],
    );
    const statusDistribution = {};
    statusRows.forEach(r => { statusDistribution[r.status] = Number(r.cnt); });

    // 招标类型分布
    const [typeRows] = await db.execute(
      `SELECT tender_type, COUNT(*) AS cnt FROM tender_projects
       WHERE tenant_id = ? GROUP BY tender_type`,
      [tenantId],
    );
    const typeDistribution = {};
    typeRows.forEach(r => { typeDistribution[r.tender_type] = Number(r.cnt); });

    // 供应商状态分布
    const [supplierRows] = await db.execute(
      `SELECT status, COUNT(*) AS cnt FROM tender_suppliers
       WHERE tenant_id = ? GROUP BY status`,
      [tenantId],
    );
    const supplierDistribution = {};
    supplierRows.forEach(r => { supplierDistribution[r.status] = Number(r.cnt); });

    // 关键指标
    const [[totals]] = await db.execute(
      `SELECT
         (SELECT COUNT(*) FROM tender_projects WHERE tenant_id = ?) AS total_tenders,
         (SELECT COUNT(*) FROM tender_suppliers WHERE tenant_id = ?) AS total_suppliers,
         (SELECT COUNT(*) FROM tender_bids WHERE tenant_id = ? AND status = 'submitted') AS active_bids,
         (SELECT COUNT(*) FROM tender_bids WHERE tenant_id = ? AND status = 'won') AS won_bids,
         (SELECT IFNULL(SUM(bid_amount), 0) FROM tender_bids WHERE tenant_id = ? AND status = 'won') AS won_amount,
         (SELECT IFNULL(SUM(budget_amount), 0) FROM tender_projects WHERE tenant_id = ? AND status = 'awarded') AS awarded_budget,
         (SELECT COUNT(*) FROM tender_supplier_qualifications WHERE tenant_id = ? AND review_status = 'pending') AS pending_qualifications`,
      [tenantId, tenantId, tenantId, tenantId, tenantId, tenantId, tenantId],
    );

    // 最近 30 天招标数量
    const [[trendRow]] = await db.execute(
      `SELECT COUNT(*) AS cnt FROM tender_projects
       WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [tenantId],
    );

    // 最近 5 个招标
    const [recentTenders] = await db.execute(
      `SELECT id, tender_code, title, status, budget_amount, created_at
       FROM tender_projects WHERE tenant_id = ?
       ORDER BY created_at DESC LIMIT 5`,
      [tenantId],
    );

    // 即将截止的招标
    const [upcomingDeadlines] = await db.execute(
      `SELECT id, tender_code, title, status, deadline
       FROM tender_projects
       WHERE tenant_id = ? AND status IN ('published', 'bidding') AND deadline IS NOT NULL AND deadline >= NOW()
       ORDER BY deadline ASC LIMIT 5`,
      [tenantId],
    );

    return {
      totals: {
        total_tenders: Number(totals.total_tenders || 0),
        total_suppliers: Number(totals.total_suppliers || 0),
        active_bids: Number(totals.active_bids || 0),
        won_bids: Number(totals.won_bids || 0),
        won_amount: Number(totals.won_amount || 0),
        awarded_budget: Number(totals.awarded_budget || 0),
        pending_qualifications: Number(totals.pending_qualifications || 0),
        recent_30d_tenders: Number(trendRow.cnt || 0),
      },
      status_distribution: statusDistribution,
      type_distribution: typeDistribution,
      supplier_distribution: supplierDistribution,
      recent_tenders: recentTenders,
      upcoming_deadlines: upcomingDeadlines,
    };
  }

  // ==================== 招标项目分享 Token（公开扫码） ====================

  // 生成/刷新项目分享 token
  async generateShareToken(tenderId, tenantId, options = {}) {
    await ensureTablesOnce();
    const tender = await this.getTenderById(tenderId, tenantId);
    if (!tender) throw new Error('招标项目不存在');

    const validDays = parsePositiveInt(options.validDays, SHARE_TOKEN_VALID_DAYS);
    const permissions = Array.isArray(options.permissions) && options.permissions.length > 0
      ? options.permissions
      : SHARE_TOKEN_DEFAULT_PERMISSIONS;
    const allowed = ['view', 'download', 'qualify', 'bid'];
    const filtered = permissions.filter(p => allowed.includes(p));
    if (filtered.length === 0) throw new Error('权限不能为空');

    // 撤销同项目下所有现存的 token
    await db.execute(
      'UPDATE tender_share_tokens SET revoked = 1, updated_at = NOW() WHERE tender_id = ? AND tenant_id = ? AND revoked = 0',
      [tenderId, tenantId],
    );

    const token = crypto.randomBytes(24).toString('hex'); // 48 chars
    const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);

    const [result] = await db.execute(
      `INSERT INTO tender_share_tokens (tenant_id, tender_id, token, permissions, expires_at, revoked, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, NOW())`,
      [tenantId, tenderId, token, JSON.stringify(filtered), expiresAt, options.createdBy || null],
    );

    return {
      id: result.insertId,
      tender_id: Number(tenderId),
      token,
      permissions: filtered,
      expires_at: expiresAt.toISOString(),
      valid_days: validDays,
      revoked: false,
    };
  }

  // 列出项目的所有 token
  async listShareTokens(tenderId, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      `SELECT id, tender_id, token, permissions, expires_at, revoked, created_at
       FROM tender_share_tokens WHERE tender_id = ? AND tenant_id = ?
       ORDER BY created_at DESC`,
      [tenderId, tenantId],
    );
    return rows.map(r => ({
      ...r,
      permissions: r.permissions ? (typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions) : [],
    }));
  }

  // 撤销项目分享 token
  async revokeShareToken(tokenId, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      'SELECT id FROM tender_share_tokens WHERE id = ? AND tenant_id = ? LIMIT 1',
      [tokenId, tenantId],
    );
    if (rows.length === 0) throw new Error('分享 token 不存在');
    await db.execute(
      'UPDATE tender_share_tokens SET revoked = 1, updated_at = NOW() WHERE id = ?',
      [tokenId],
    );
    return { id: Number(tokenId), revoked: true };
  }

  // 校验 token 并返回 token + 项目 + 权限
  async verifyShareToken(token, meta = {}) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      'SELECT * FROM tender_share_tokens WHERE token = ? LIMIT 1',
      [token],
    );
    if (rows.length === 0) {
      await this.logShareVisit(null, null, null, meta, 'verify', 0);
      throw new Error('二维码无效或已失效');
    }
    const rec = rows[0];
    if (rec.revoked) {
      await this.logShareVisit(rec.id, rec.tender_id, rec.tenant_id, meta, 'verify', 0);
      throw new Error('二维码已被撤销');
    }
    if (rec.expires_at && new Date(rec.expires_at) < new Date()) {
      await this.logShareVisit(rec.id, rec.tender_id, rec.tenant_id, meta, 'verify', 0);
      throw new Error('二维码已过期');
    }
    // 校验招标项目状态
    const tender = await this.getTenderById(rec.tender_id, rec.tenant_id);
    if (!tender) throw new Error('招标项目不存在');

    const permissions = rec.permissions
      ? (typeof rec.permissions === 'string' ? JSON.parse(rec.permissions) : rec.permissions)
      : [];

    await this.logShareVisit(rec.id, rec.tender_id, rec.tenant_id, meta, 'verify', 200);

    return { tokenRecord: rec, tender, permissions };
  }

  async logShareVisit(tokenId, tenderId, tenantId, meta = {}, action = '', statusCode = 200) {
    try {
      await db.execute(
        `INSERT INTO tender_share_visits (tenant_id, token_id, tender_id, ip, user_agent, action, status_code, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          tenantId || 0,
          tokenId || null,
          tenderId || null,
          (meta.ip || '').slice(0, 64),
          (meta.userAgent || '').slice(0, 500),
          (action || '').slice(0, 50),
          Number(statusCode || 0),
        ],
      );
    } catch (err) {
      logger.warn('记录分享访问日志失败:', err.message);
    }
  }

  // 频控检查：返回 true 表示超限
  async checkShareRateLimit(tokenId, ip, write = false) {
    await ensureTablesOnce();
    const limit = write ? SHARE_WRITE_LIMIT_PER_MIN : SHARE_IP_LIMIT_PER_MIN;
    const where = write ? 'token_id = ?' : 'ip = ?';
    const param = write ? tokenId : ip;
    const [rows] = await db.execute(
      `SELECT COUNT(*) AS cnt FROM tender_share_visits
       WHERE ${where} AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
      [param],
    );
    return Number(rows[0]?.cnt || 0) >= limit;
  }

  // 公开接口：扫码获取招标项目详情（脱敏）
  async getPublicTenderByToken(token, meta = {}) {
    const { tender, permissions, tokenRecord } = await this.verifyShareToken(token, meta);
    if (!permissions.includes('view')) throw new Error('该二维码未开放查看权限');

    // 读频控：防止恶意扫码扫描接口
    if (await this.checkShareRateLimit(tokenRecord.id, meta.ip, false)) {
      throw new Error('操作过于频繁，请稍后再试');
    }

    // 联系人电话脱敏：仅保留后 4 位，前 3 位中间用 ****
    const maskPhone = phone => {
      if (!phone) return null;
      const s = String(phone);
      if (s.length <= 4) return s;
      if (s.length <= 7) return `****${s.slice(-4)}`;
      return `${s.slice(0, 3)}****${s.slice(-4)}`;
    };

    await this.logShareVisit(tokenRecord.id, tender.id, tender.tenant_id, meta, 'view_tender', 200);

    return {
      tender: {
        id: tender.id,
        tender_code: tender.tender_code,
        title: tender.title,
        tender_type: tender.tender_type,
        tender_method: tender.tender_method,
        status: tender.status,
        budget_amount: tender.budget_amount,
        currency: tender.currency,
        publish_date: tender.publish_date,
        deadline: tender.deadline,
        open_bid_date: tender.open_bid_date,
        // 个人信息脱敏：联系人仅保留姓，电话中间打码
        contact_person: tender.contact_person ? String(tender.contact_person).slice(0, 1) + '**' : null,
        contact_phone: maskPhone(tender.contact_phone),
        description: tender.description,
        asset_code: tender.asset_code,
        asset_name: tender.asset_name,
      },
      permissions,
    };
  }

  // 公开接口：列出可下载的招标文件附件
  async listPublicTenderFiles(token, meta = {}) {
    const { tender, permissions, tokenRecord } = await this.verifyShareToken(token, meta);
    if (!permissions.includes('download') && !permissions.includes('view')) {
      throw new Error('该二维码未开放文件下载权限');
    }
    // 仅返回招标方上传的附件，排除投标方附件（file_type 以 'bid_' 开头）以防泄露
    const [rows] = await db.execute(
      `SELECT id, original_name, file_name, mime_type, file_size, created_at, file_type
       FROM tender_files
       WHERE tender_id = ? AND tenant_id = ?
         AND (file_type IS NULL OR file_type NOT LIKE 'bid\\_%')
       ORDER BY created_at DESC`,
      [tender.id, tender.tenant_id],
    );
    await this.logShareVisit(tokenRecord.id, tender.id, tender.tenant_id, meta, 'list_files', 200);
    return rows;
  }

  // 公开接口：下载单个招标文件
  async downloadPublicFile(token, fileId, meta = {}) {
    const { tender, permissions, tokenRecord } = await this.verifyShareToken(token, meta);
    if (!permissions.includes('download')) {
      throw new Error('该二维码未开放文件下载权限');
    }
    // 排除投标方附件（file_type 以 'bid_' 开头），仅允许下载招标方上传的文件
    const [rows] = await db.execute(
      `SELECT id, original_name, file_name, file_path, mime_type
       FROM tender_files
       WHERE id = ? AND tender_id = ? AND tenant_id = ?
         AND (file_type IS NULL OR file_type NOT LIKE 'bid\\_%')
       LIMIT 1`,
      [fileId, tender.id, tender.tenant_id],
    );
    if (rows.length === 0) throw new Error('文件不存在');
    const file = rows[0];
    // 下载接口应用频控
    if (await this.checkShareRateLimit(tokenRecord.id, meta.ip, false)) {
      throw new Error('操作过于频繁，请稍后再试');
    }
    await this.logShareVisit(tokenRecord.id, tender.id, tender.tenant_id, meta, 'download_file', 200);
    return file;
  }

  // 公开接口：扫码上传资质（无需登录）
  // 若已存在同名供应商（按 unified_code 或 supplier_name）则复用，否则自动创建 public_apply 来源的供应商记录
  async uploadPublicQualification(token, file, data, meta = {}) {
    const { tender, permissions, tokenRecord } = await this.verifyShareToken(token, meta);
    if (!permissions.includes('qualify')) {
      throw new Error('该二维码未开放资质上传权限');
    }
    if (tender.status === 'cancelled' || tender.status === 'draft' || tender.status === 'completed') {
      throw new Error('当前招标状态不允许上传资质');
    }
    if (await this.checkShareRateLimit(tokenRecord.id, meta.ip, true)) {
      throw new Error('操作过于频繁，请稍后再试');
    }
    if (!file) throw new Error('请上传文件');

    // 解析供应商信息
    const supplierName = (data.supplier_name || '').trim();
    const unifiedCode = (data.unified_code || '').trim();
    const qualificationType = (data.qualification_type || 'other').trim();
    const qualificationName = (data.qualification_name || '').trim();
    if (!supplierName) throw new Error('请填写供应商名称');
    if (!qualificationName) throw new Error('请填写资质名称');

    // 联系邮箱必填（扫码登记建档时收集，用于后续邮件通知）
    const contactEmail = validateSupplierEmail(data.contact_email);

    // 查找或创建供应商
    const supplier = await this.upsertPublicSupplier(tender.tenant_id, {
      supplier_name: supplierName,
      unified_code: unifiedCode,
      contact_person: data.contact_person,
      contact_phone: data.contact_phone,
      contact_email: contactEmail,
    });

    // 黑名单供应商禁止上传资质（已驳回的供应商允许重新上传以恢复审核）
    if (supplier.status === 'blacklisted') {
      throw new Error('该供应商已被列入黑名单，禁止上传资质');
    }

    // 写入资质记录
    const [result] = await db.execute(
      `INSERT INTO tender_supplier_qualifications (
        tenant_id, supplier_id, qualification_type, qualification_name,
        original_name, file_name, file_path, mime_type, file_size,
        valid_until, upload_source, review_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'public_portal', 'pending', NOW())`,
      [
        tender.tenant_id,
        supplier.id,
        qualificationType,
        qualificationName,
        file.originalname,
        file.filename,
        file.path,
        file.mimetype,
        file.size,
        data.valid_until || null,
      ],
    );

    await this.logShareVisit(tokenRecord.id, tender.id, tender.tenant_id, meta, 'upload_qualify', 200);

    return {
      id: result.insertId,
      supplier_id: supplier.id,
      supplier_name: supplier.supplier_name,
      qualification_name: qualificationName,
    };
  }

  // 查找/创建公开扫码的供应商
  async upsertPublicSupplier(tenantId, info) {
    const { supplier_name, unified_code } = info;
    let existing = [];
    if (unified_code) {
      const [r1] = await db.execute(
        'SELECT * FROM tender_suppliers WHERE tenant_id = ? AND unified_code = ? LIMIT 1',
        [tenantId, unified_code],
      );
      existing = r1;
    }
    if (existing.length === 0) {
      const [r2] = await db.execute(
        'SELECT * FROM tender_suppliers WHERE tenant_id = ? AND supplier_name = ? LIMIT 1',
        [tenantId, supplier_name],
      );
      existing = r2;
    }

    if (existing.length > 0) {
      const s = existing[0];
      // 补充联系方式（如缺失）
      const updates = [];
      const params = [];
      if (!s.contact_person && info.contact_person) { updates.push('contact_person = ?'); params.push(info.contact_person); }
      if (!s.contact_phone && info.contact_phone) { updates.push('contact_phone = ?'); params.push(info.contact_phone); }
      if (!s.contact_email && info.contact_email) { updates.push('contact_email = ?'); params.push(info.contact_email); }
      if (!s.unified_code && unified_code) { updates.push('unified_code = ?'); params.push(unified_code); }
      if (updates.length > 0) {
        params.push(s.id, tenantId);
        await db.execute(
          `UPDATE tender_suppliers SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
          params,
        );
      }
      return { ...s, ...info };
    }

    // 创建新的 supplier
    let insertResult;
    try {
      const [result] = await db.execute(
        `INSERT INTO tender_suppliers (
          tenant_id, supplier_name, unified_code, contact_person, contact_phone, contact_email,
          status, source, remark, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 'public_apply', '通过招标项目二维码扫码登记', NOW())`,
        [
          tenantId,
          supplier_name,
          unified_code || null,
          info.contact_person || null,
          info.contact_phone || null,
          info.contact_email || null,
        ],
      );
      insertResult = result;
    } catch (insertErr) {
      // 并发场景下：两个请求同时通过 existing.length === 0 检查，
      // DB 唯一约束 uk_tenant_supplier (tenant_id, supplier_name) 会拒绝第二个。
      // 此处降级为重新查询并返回已存在的供应商，避免向调用方抛 500。
      if (insertErr && (insertErr.code === 'ER_DUP_ENTRY' || insertErr.errno === 1062)) {
        logger.warn(`upsertPublicSupplier 并发冲突，已降级为查询已存在记录: ${insertErr.message}`);
        const [retry] = await db.execute(
          'SELECT * FROM tender_suppliers WHERE tenant_id = ? AND (supplier_name = ? OR unified_code = ?) LIMIT 1',
          [tenantId, supplier_name, unified_code || supplier_name],
        );
        if (retry.length > 0) {
          return { ...retry[0], ...info };
        }
        throw new Error('供应商并发登记冲突，请稍后重试');
      }
      throw insertErr;
    }
    return {
      id: insertResult.insertId,
      tenant_id: tenantId,
      supplier_name,
      unified_code: unified_code || null,
      contact_person: info.contact_person || null,
      contact_phone: info.contact_phone || null,
      contact_email: info.contact_email || null,
      status: 'pending',
      source: 'public_apply',
    };
  }

  // 公开接口：扫码提交投标
  async submitPublicBid(token, data, files, meta = {}) {
    const { tender, permissions, tokenRecord } = await this.verifyShareToken(token, meta);
    if (!permissions.includes('bid')) {
      throw new Error('该二维码未开放投标提交权限');
    }
    if (!['published', 'bidding'].includes(tender.status)) {
      throw new Error('当前招标状态不允许投标');
    }
    if (tender.deadline && new Date(tender.deadline) < new Date()) {
      throw new Error('投标截止时间已过期，无法提交');
    }
    if (await this.checkShareRateLimit(tokenRecord.id, meta.ip, true)) {
      throw new Error('操作过于频繁，请稍后再试');
    }

    // 校验供应商信息
    const supplierName = (data.supplier_name || '').trim();
    const unifiedCode = (data.unified_code || '').trim();
    if (!supplierName) throw new Error('请填写供应商名称');
    if (!data.contact_person) throw new Error('请填写联系人');
    if (!data.contact_phone) throw new Error('请填写联系电话');

    // 联系邮箱必填（扫码投标建档时收集，用于后续邮件通知）
    const contactEmail = validateSupplierEmail(data.contact_email);

    const supplier = await this.upsertPublicSupplier(tender.tenant_id, {
      supplier_name: supplierName,
      unified_code: unifiedCode,
      contact_person: data.contact_person,
      contact_phone: data.contact_phone,
      contact_email: contactEmail,
    });

    // 黑名单/已驳回供应商禁止投标（与已登录 submitBid 保持一致）
    if (supplier.status === 'blacklisted') {
      throw new Error('该供应商已被列入黑名单，禁止投标');
    }
    if (supplier.status === 'rejected') {
      throw new Error('该供应商资质已被驳回，禁止投标');
    }

    const bidAmount = data.bid_amount !== undefined && data.bid_amount !== '' ? Number(data.bid_amount) : null;
    if (bidAmount !== null && (!Number.isFinite(bidAmount) || bidAmount < 0)) {
      throw new Error('投标金额无效');
    }

    // 投标附件
    const bidFiles = Array.isArray(files) && files.length > 0
      ? files.map(f => ({ name: f.originalname, file: f.filename, path: f.path, size: f.size, mime: f.mimetype }))
      : [];

    // 事务：tender_bids upsert + tender_share_bids INSERT + tender_share_visits INSERT 必须同时成功
    await db.execute('START TRANSACTION');
    let bidId;
    try {
      // upsert tender_bids
      const [existing] = await db.execute(
        'SELECT id, status FROM tender_bids WHERE tender_id = ? AND supplier_id = ? AND tenant_id = ? LIMIT 1',
        [tender.id, supplier.id, tender.tenant_id],
      );

      if (existing.length > 0) {
        const current = existing[0];
        if (current.status === 'won') throw new Error('已中标的投标不能修改');
        await db.execute(
          `UPDATE tender_bids SET bid_amount = ?, bid_currency = ?, bid_desc = ?, bid_files = ?,
            status = 'submitted', submitted_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [
            bidAmount,
            data.bid_currency || tender.currency || 'CNY',
            data.bid_desc || null,
            JSON.stringify(bidFiles),
            current.id,
          ],
        );
        bidId = current.id;
      } else {
        const [result] = await db.execute(
          `INSERT INTO tender_bids (
            tenant_id, tender_id, supplier_id, bid_amount, bid_currency, bid_desc, bid_files,
            status, submitted_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', NOW(), NOW())`,
          [
            tender.tenant_id,
            tender.id,
            supplier.id,
            bidAmount,
            data.bid_currency || tender.currency || 'CNY',
            data.bid_desc || null,
            JSON.stringify(bidFiles),
          ],
        );
        bidId = result.insertId;
      }

      // 记录 share 投标轨迹
      await db.execute(
        `INSERT INTO tender_share_bids (
          tenant_id, token_id, tender_id, bid_id, supplier_name,
          contact_person, contact_phone, contact_email, unified_code, ip, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          tender.tenant_id,
          tokenRecord.id,
          tender.id,
          bidId,
          supplierName,
          data.contact_person,
          data.contact_phone,
          data.contact_email || null,
          unifiedCode || null,
          (meta.ip || '').slice(0, 64),
        ],
      );

      await db.execute('COMMIT');
    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }

    // 轨迹日志（非关键，单独写入，失败不影响投标结果）
    try {
      await this.logShareVisit(tokenRecord.id, tender.id, tender.tenant_id, meta, 'submit_bid', 200);
    } catch (logErr) {
      logger.warn(`submitPublicBid logShareVisit 失败（忽略）: ${logErr.message}`);
    }

    return {
      id: bidId,
      supplier_id: supplier.id,
      supplier_name: supplier.supplier_name,
      status: 'submitted',
    };
  }

  // ==================== 合同管理 ====================

  // 合同列表（支持按招标项目/供应商/状态筛选）
  async listContracts(params) {
    await ensureTablesOnce();
    const { page = 1, pageSize = 20, keyword, tenderId, supplierId, status, tenantId } = params;
    const pageNum = parsePositiveInt(page, 1);
    const pageSizeNum = parsePositiveInt(pageSize, 20);
    const offset = (pageNum - 1) * pageSizeNum;

    const where = ['c.tenant_id = ?', 'c.deleted_at IS NULL'];
    const queryParams = [tenantId];
    if (status && CONTRACT_STATUSES.includes(status)) {
      where.push('c.status = ?');
      queryParams.push(status);
    }
    if (tenderId) {
      where.push('c.tender_id = ?');
      queryParams.push(Number(tenderId));
    }
    if (supplierId) {
      where.push('c.supplier_id = ?');
      queryParams.push(Number(supplierId));
    }
    if (keyword) {
      where.push('(c.contract_code LIKE ? OR c.contract_name LIKE ?)');
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM tender_contracts c ${whereClause}`,
      queryParams,
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.execute(
      `SELECT c.*, s.supplier_name, s.unified_code, s.contact_person AS supplier_contact,
              t.title AS tender_title, t.tender_code
       FROM tender_contracts c
       LEFT JOIN tender_suppliers s ON s.id = c.supplier_id
       LEFT JOIN tender_projects t ON t.id = c.tender_id
       ${whereClause}
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, pageSizeNum, offset],
    );

    return {
      data: rows,
      pagination: { page: pageNum, pageSize: pageSizeNum, total, totalPages: pageSizeNum > 0 ? Math.ceil(total / pageSizeNum) : 0 },
    };
  }

  async getContractById(id, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      `SELECT c.*, s.supplier_name, s.unified_code, s.contact_person AS supplier_contact, s.contact_phone AS supplier_phone,
              t.title AS tender_title, t.tender_code, t.tender_type
       FROM tender_contracts c
       LEFT JOIN tender_suppliers s ON s.id = c.supplier_id
       LEFT JOIN tender_projects t ON t.id = c.tender_id
       WHERE c.id = ? AND c.tenant_id = ? AND c.deleted_at IS NULL LIMIT 1`,
      [id, tenantId],
    );
    if (rows.length === 0) return null;
    const contract = rows[0];
    // 关联附件
    const [fileRows] = await db.execute(
      'SELECT id, file_type, original_name, file_name, mime_type, file_size, created_at FROM tender_contract_files WHERE contract_id = ? AND tenant_id = ? ORDER BY created_at DESC',
      [id, tenantId],
    );
    contract.files = fileRows;
    return contract;
  }

  // 创建合同：仅招标状态为 awarded/contract_signing 时允许
  // 创建后自动将招标状态推进到 contract_signing
  async createContract(data, tenantId, userId) {
    await ensureTablesOnce();
    const tenderId = parsePositiveInt(data.tender_id, 0);
    if (!tenderId) throw new Error('请指定关联的招标项目');

    const tender = await this.getTenderById(tenderId, tenantId);
    if (!tender) throw new Error('招标项目不存在');
    // 仅已定标(awarded)或合同签订中(contract_signing)的招标项目允许创建合同
    if (!['awarded', 'contract_signing'].includes(tender.status)) {
      throw new Error('仅已定标的招标项目可创建合同');
    }

    const supplierId = parsePositiveInt(data.supplier_id, 0);
    if (!supplierId) throw new Error('请指定供应商');
    const supplier = await this.getSupplierById(supplierId, tenantId);
    if (!supplier) throw new Error('供应商不存在');

    const contractName = String(data.contract_name || '').trim();
    if (!contractName) throw new Error('合同名称不能为空');

    const contractAmount = normalizeMoney(data.contract_amount);
    if (Number.isNaN(contractAmount)) throw new Error('合同金额必须是大于等于 0 的数字');

    const contractType = CONTRACT_TYPES.includes(data.contract_type) ? data.contract_type : 'purchase';

    // 唯一性校验：同一招标项目同一供应商仅一份合同
    const [dup] = await db.execute(
      'SELECT id FROM tender_contracts WHERE tender_id = ? AND supplier_id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1',
      [tenderId, supplierId, tenantId],
    );
    if (dup.length > 0) throw new Error('该招标项目与该供应商已存在合同记录');

    const contractCode = buildContractCode();
    const now = new Date();

    // 事务：创建合同 + 推进招标状态到 contract_signing
    await db.execute('START TRANSACTION');
    let result;
    try {
      [result] = await db.execute(
        `INSERT INTO tender_contracts (
          tenant_id, contract_code, contract_name, tender_id, bid_id, supplier_id,
          contract_amount, currency, contract_type, sign_date, start_date, end_date,
          department, contact_person, contact_phone, payment_terms, description, remark,
          status, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
        [
          tenantId, contractCode, contractName, tenderId, data.bid_id || null, supplierId,
          contractAmount, String(data.currency || 'CNY').trim() || 'CNY', contractType,
          normalizeDate(data.sign_date), normalizeDate(data.start_date), normalizeDate(data.end_date),
          data.department || tender.department || null,
          data.contact_person || tender.contact_person || null,
          data.contact_phone || tender.contact_phone || null,
          data.payment_terms || null, data.description || null, data.remark || null,
          userId, now,
        ],
      );

      // 推进招标状态：awarded → contract_signing
      if (tender.status === 'awarded') {
        await db.execute(
          'UPDATE tender_projects SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
          ['contract_signing', tenderId, tenantId],
        );
        this._emitTenderStatusEvent(tender, 'contract_signing', tenantId);
      }

      await db.execute('COMMIT');
    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }

    // 合同创建事件
    publishAsync('contract:created', {
      id: result.insertId,
      contract_code: contractCode,
      contract_name: contractName,
      tenderId: Number(tenderId),
      tender_code: tender.tender_code,
      supplierId,
      supplierName: supplier.supplier_name,
      createdBy: userId,
      tenantId,
    }).catch(e => logger.warn('发布 contract:created 事件失败:', e.message));

    return { id: result.insertId, contract_code: contractCode, status: 'draft' };
  }

  async updateContract(id, data, tenantId) {
    await ensureTablesOnce();
    const existing = await this.getContractById(id, tenantId);
    if (!existing) throw new Error('合同不存在');
    // 仅 draft/rejected 状态可修改正文
    if (!['draft', 'rejected'].includes(existing.status)) {
      throw new Error('当前合同状态不允许修改，仅起草中/审批驳回的合同可修改');
    }

    const contractAmount = data.contract_amount !== undefined ? normalizeMoney(data.contract_amount) : existing.contract_amount;
    if (Number.isNaN(contractAmount)) throw new Error('合同金额必须是大于等于 0 的数字');

    const contractType = data.contract_type !== undefined
      ? (CONTRACT_TYPES.includes(data.contract_type) ? data.contract_type : existing.contract_type)
      : existing.contract_type;

    await db.execute(
      `UPDATE tender_contracts SET
        contract_name = ?, contract_amount = ?, currency = ?, contract_type = ?,
        sign_date = ?, start_date = ?, end_date = ?,
        department = ?, contact_person = ?, contact_phone = ?,
        payment_terms = ?, description = ?, remark = ?, updated_at = NOW()
      WHERE id = ? AND tenant_id = ?`,
      [
        data.contract_name !== undefined ? String(data.contract_name).trim() : existing.contract_name,
        contractAmount,
        data.currency !== undefined ? String(data.currency).trim() || 'CNY' : existing.currency,
        contractType,
        data.sign_date !== undefined ? normalizeDate(data.sign_date) : existing.sign_date,
        data.start_date !== undefined ? normalizeDate(data.start_date) : existing.start_date,
        data.end_date !== undefined ? normalizeDate(data.end_date) : existing.end_date,
        data.department !== undefined ? data.department : existing.department,
        data.contact_person !== undefined ? data.contact_person : existing.contact_person,
        data.contact_phone !== undefined ? data.contact_phone : existing.contact_phone,
        data.payment_terms !== undefined ? data.payment_terms : existing.payment_terms,
        data.description !== undefined ? data.description : existing.description,
        data.remark !== undefined ? data.remark : existing.remark,
        id, tenantId,
      ],
    );

    return { id: Number(id) };
  }

  // 合同状态流转：通用入口，按目标状态分发
  async changeContractStatus(id, status, tenantId, userId, options = {}) {
    await ensureTablesOnce();
    if (!CONTRACT_STATUSES.includes(status)) throw new Error('合同状态无效');
    const existing = await this.getContractById(id, tenantId);
    if (!existing) throw new Error('合同不存在');

    if (!isValidContractStatusTransition(existing.status, status)) {
      throw new Error(`不允许从状态 "${existing.status}" 流转到 "${status}"`);
    }

    const now = new Date();
    const updateFields = ['status = ?', 'updated_at = NOW()'];
    const updateValues = [status];

    if (status === 'approved' || status === 'rejected') {
      // 审批动作：记录审批人/审批意见/审批时间
      updateFields.push('reviewer_id = ?', 'review_comment = ?', 'reviewed_at = ?');
      updateValues.push(userId || null, options.review_comment || null, now);
    } else if (status === 'signed') {
      // 签订动作：记录签订人/签订时间
      updateFields.push('signer_id = ?', 'signed_at = ?');
      updateValues.push(userId || null, now);
    } else if (status === 'archived') {
      // 归档动作：记录归档人/归档时间
      updateFields.push('archived_by = ?', 'archived_at = ?');
      updateValues.push(userId || null, now);
    }

    // 事务：合同状态流转 + 招标状态推进（合同归档时招标推进到 completed）
    await db.execute('START TRANSACTION');
    try {
      await db.execute(
        `UPDATE tender_contracts SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
        [...updateValues, id, tenantId],
      );

      // 合同归档 → 招标项目进入 completed（闭环完成）
      if (status === 'archived') {
        const [tender] = await db.execute(
          'SELECT id, tender_code, title, status FROM tender_projects WHERE id = ? AND tenant_id = ? LIMIT 1',
          [existing.tender_id, tenantId],
        );
        if (tender.length > 0 && tender[0].status === 'contract_signing') {
          await db.execute(
            'UPDATE tender_projects SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
            ['completed', existing.tender_id, tenantId],
          );
          this._emitTenderStatusEvent(tender[0], 'completed', tenantId);
        }
      }

      await db.execute('COMMIT');
    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }

    // 合同状态流转事件
    publishAsync(`contract:${status}`, {
      id: Number(id),
      contract_code: existing.contract_code,
      contract_name: existing.contract_name,
      fromStatus: existing.status,
      toStatus: status,
      tenderId: Number(existing.tender_id),
      supplierId: existing.supplier_id,
      userId,
      tenantId,
    }).catch(e => logger.warn(`发布 contract:${status} 事件失败:`, e.message));

    return { id: Number(id), status };
  }

  // 上传合同附件
  async uploadContractFile(contractId, file, fileData, tenantId, userId) {
    await ensureTablesOnce();
    const existing = await this.getContractById(contractId, tenantId);
    if (!existing) throw new Error('合同不存在');
    const fileType = String(fileData.file_type || 'contract').trim() || 'contract';
    const [result] = await db.execute(
      `INSERT INTO tender_contract_files (tenant_id, contract_id, file_type, original_name, file_name, file_path, mime_type, file_size, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        tenantId, contractId, fileType,
        file.originalname || null, file.filename || null, file.path || null,
        file.mimetype || null, file.size || 0, userId || null,
      ],
    );
    return { id: result.insertId, contract_id: Number(contractId), file_type: fileType };
  }

  // 删除合同附件
  async deleteContractFile(fileId, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      'SELECT id, file_path FROM tender_contract_files WHERE id = ? AND tenant_id = ? LIMIT 1',
      [fileId, tenantId],
    );
    if (rows.length === 0) throw new Error('附件不存在');
    const file = rows[0];
    await db.execute('DELETE FROM tender_contract_files WHERE id = ? AND tenant_id = ?', [fileId, tenantId]);
    if (file.file_path) {
      try {
        if (fs.existsSync(file.file_path)) {
          fs.unlinkSync(file.file_path);
        }
      } catch (e) {
        logger.warn('删除合同附件磁盘文件失败:', e.message);
      }
    }
    return { id: Number(fileId) };
  }

  // 软删除合同（仅 draft/terminated 状态可删除）
  async deleteContract(id, tenantId) {
    await ensureTablesOnce();
    const existing = await this.getContractById(id, tenantId);
    if (!existing) throw new Error('合同不存在');
    if (!['draft', 'terminated'].includes(existing.status)) {
      throw new Error('仅起草中或已终止的合同可删除');
    }
    await db.execute(
      'UPDATE tender_contracts SET deleted_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    return true;
  }

  // 按招标项目获取合同列表
  async listContractsByTender(tenderId, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      `SELECT c.*, s.supplier_name, s.unified_code, s.contact_person AS supplier_contact
       FROM tender_contracts c
       LEFT JOIN tender_suppliers s ON s.id = c.supplier_id
       WHERE c.tender_id = ? AND c.tenant_id = ? AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC, c.id DESC`,
      [tenderId, tenantId],
    );
    return rows;
  }

  // 合同统计
  async getContractStatistics(tenantId) {
    await ensureTablesOnce();
    const [statusRows] = await db.execute(
      `SELECT status, COUNT(*) AS cnt, IFNULL(SUM(contract_amount), 0) AS total_amount
       FROM tender_contracts WHERE tenant_id = ? AND deleted_at IS NULL GROUP BY status`,
      [tenantId],
    );
    const statusDistribution = {};
    statusRows.forEach(r => {
      statusDistribution[r.status] = { count: Number(r.cnt), amount: Number(r.total_amount) };
    });

    const [[totals]] = await db.execute(
      `SELECT
         (SELECT COUNT(*) FROM tender_contracts WHERE tenant_id = ? AND deleted_at IS NULL) AS total_contracts,
         (SELECT IFNULL(SUM(contract_amount), 0) FROM tender_contracts WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'signed') AS signed_amount,
         (SELECT IFNULL(SUM(contract_amount), 0) FROM tender_contracts WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'archived') AS archived_amount,
         (SELECT COUNT(*) FROM tender_contracts WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'executing') AS executing_count`,
      [tenantId, tenantId, tenantId, tenantId],
    );

    return {
      totals: {
        total_contracts: Number(totals.total_contracts || 0),
        signed_amount: Number(totals.signed_amount || 0),
        archived_amount: Number(totals.archived_amount || 0),
        executing_count: Number(totals.executing_count || 0),
      },
      status_distribution: statusDistribution,
    };
  }

  // ==================== 付款里程碑（tender_payment_milestones） ====================
  // 配合 010_invoices 一起工作：发票 paid 时自动调用 markPaid
  // 这里对 milestone 表做 CRUD + 标记 paid，事件由调用方或订阅器发出。

  async listPaymentMilestones(tenantId, { contract_id, status } = {}) {
    await ensureTablesOnce();
    const where = ['tenant_id = ?'];
    const qp = [tenantId];
    if (contract_id) { where.push('contract_id = ?'); qp.push(contract_id); }
    if (status) { where.push('status = ?'); qp.push(status); }
    const [rows] = await db.execute(
      `SELECT * FROM tender_payment_milestones WHERE ${where.join(' AND ')} ORDER BY due_date ASC, id ASC`,
      qp,
    );
    return rows;
  }

  async createPaymentMilestone(tenantId, body, user) {
    await ensureTablesOnce();
    if (!body.contract_id) throw new Error('contract_id 必填');
    if (!body.milestone_name) throw new Error('milestone_name 必填');
    const amount = body.amount != null ? normalizeMoney(body.amount) : 0;
    if (Number.isNaN(amount)) throw new Error('里程碑金额非法');
    const [r] = await db.execute(
      `INSERT INTO tender_payment_milestones (tenant_id, contract_id, milestone_name, amount, due_date, status, remark, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW())`,
      [tenantId, body.contract_id, String(body.milestone_name).trim(), amount,
        normalizeDate(body.due_date), body.remark || null],
    );
    return { id: r.insertId };
  }

  async updatePaymentMilestone(id, tenantId, body) {
    await ensureTablesOnce();
    const [rows] = await db.execute(`SELECT * FROM tender_payment_milestones WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
    if (rows.length === 0) throw new Error('里程碑不存在');
    const fields = []; const values = [];
    ['milestone_name', 'amount', 'due_date', 'status', 'remark'].forEach(k => {
      if (body[k] === undefined) return;
      fields.push(`${k} = ?`);
      values.push(k === 'amount' ? normalizeMoney(body[k]) : k === 'due_date' ? normalizeDate(body[k]) : body[k]);
    });
    if (fields.length === 0) return { id };
    values.push(id, tenantId);
    await db.execute(`UPDATE tender_payment_milestones SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`, values);
    return { id };
  }

  // 标记 paid（外部可调用，如合同支付完成）
  async markPaymentMilestonePaid(id, tenantId, user) {
    await ensureTablesOnce();
    const [rows] = await db.execute(
      `SELECT * FROM tender_payment_milestones WHERE id = ? AND tenant_id = ?`,
      [id, tenantId],
    );
    if (rows.length === 0) throw new Error('里程碑不存在');
    if (rows[0].status === 'paid') return { id, status: 'paid' };
    if (rows[0].status !== 'pending' && rows[0].status !== 'overdue') {
      throw new Error(`里程碑状态 ${rows[0].status} 不允许标记 paid`);
    }
    await db.execute(
      `UPDATE tender_payment_milestones SET status = 'paid', paid_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [id, tenantId],
    );
    publishAsync('tender:milestone:paid', {
      milestone_id: id, contract_id: rows[0].contract_id, tenantId, userId: user?.id,
    }).catch(e => logger.warn('发布 tender:milestone:paid 事件失败:', e.message));
    return { id, status: 'paid' };
  }

  async deletePaymentMilestone(id, tenantId) {
    await ensureTablesOnce();
    const [rows] = await db.execute(`SELECT * FROM tender_payment_milestones WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
    if (rows.length === 0) return { id };
    if (rows[0].status === 'paid') throw new Error('已付款里程碑不能删除');
    await db.execute(`DELETE FROM tender_payment_milestones WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
    return { id };
  }

  // ==================== 综合统计（按月 / 部门 / 类型） ====================
  async getEnhancedStatistics(tenantId) {
    await ensureTablesOnce();
    // 按月汇总招标/合同/发票金额（过去 12 个月）
    const [byMonth] = await db.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
              COUNT(*) AS tender_count, COALESCE(SUM(budget_amount),0) AS tender_amount
       FROM tender_projects
       WHERE tenant_id = ? AND deleted_at IS NULL AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month DESC`,
      [tenantId],
    );
    const [byDepartment] = await db.execute(
      `SELECT IFNULL(NULLIF(department,''),'(未填)') AS department,
              COUNT(*) AS cnt, COALESCE(SUM(budget_amount),0) AS amount
       FROM tender_projects
       WHERE tenant_id = ? AND deleted_at IS NULL AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY department ORDER BY amount DESC LIMIT 20`,
      [tenantId],
    );
    const [byCategory] = await db.execute(
      `SELECT IFNULL(tender_category,'tender') AS tender_category,
              COUNT(*) AS cnt, COALESCE(SUM(budget_amount),0) AS amount
       FROM tender_projects
       WHERE tenant_id = ? AND deleted_at IS NULL
       GROUP BY tender_category`,
      [tenantId],
    );
    return { by_month: byMonth, by_department: byDepartment, by_category: byCategory };
  }
}

module.exports = new TenderingService();
module.exports.QUALIFICATION_TYPES = QUALIFICATION_TYPES;
module.exports.DEFAULT_TENDER_SECTIONS = DEFAULT_TENDER_SECTIONS;
module.exports.TENDER_TYPES = TENDER_TYPES;
module.exports.TENDER_METHODS = TENDER_METHODS;
module.exports.TENDER_STATUSES = TENDER_STATUSES;
module.exports.SUPPLIER_STATUSES = SUPPLIER_STATUSES;
module.exports.SUPPLIER_CATEGORIES = SUPPLIER_CATEGORIES;
module.exports.CONTRACT_STATUSES = CONTRACT_STATUSES;
module.exports.CONTRACT_TYPES = CONTRACT_TYPES;
