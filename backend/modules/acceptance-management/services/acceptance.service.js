/**
 * 验收管理 - 服务层
 *
 * 参照 tendering-management 的分层实践，将验收小组、验收提醒等新增业务的
 * 数据访问与业务规则从 controller 中抽离，便于复用（controller / scheduler 共用）
 * 与单元测试。
 *
 * 说明：
 *  - 面向 controller 的方法接收显式参数（tenantId / tenantFilter / 业务字段），
 *    不直接依赖 req/res，由 controller 负责 HTTP 语义。
 *  - 面向 scheduler 的扫描方法跨租户执行，返回需要推送飞书的 payload 列表。
 */
const db = require('../../../config/database');
const { publish } = require('../../../core/EventBus');

const logger = {
  error: (message, error) => console.error(`[acceptance-service] ${message}:`, error),
  info: message => console.log(`[acceptance-service] ${message}`),
  warn: (message, data) => console.warn(`[acceptance-service] ${message}`, data || ''),
};

const TEAM_ROLES = ['组长', '成员', '观察员'];
const REMINDER_TYPES = ['到期提醒', '超期预警', '审批待办', '整改通知'];
const REMINDER_STATUSES = ['待发送', '已发送', '已读', '已忽略'];

// ============================================
// 验收小组（acceptance_teams）
// ============================================

/**
 * 校验验收记录是否存在且属于当前租户
 * @param {number} recordId
 * @param {{whereClause:string, params:Array}} tenantFilter
 * @returns {Promise<object|null>}
 */
async function findAcceptanceRecord(recordId, tenantFilter) {
  const [rows] = await db.execute(
    `SELECT * FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
    [recordId, ...tenantFilter.params],
  );
  return rows[0] || null;
}

/**
 * 获取指定验收记录的小组成员
 */
async function listTeamMembers(recordId, tenantFilter) {
  const [rows] = await db.execute(
    `SELECT * FROM acceptance_teams WHERE acceptance_record_id = ?${tenantFilter.whereClause} AND is_deleted = 0 ORDER BY FIELD(role,'组长','成员','观察员'), id ASC`,
    [recordId, ...tenantFilter.params],
  );
  return rows;
}

/**
 * 校验小组成员输入
 */
function validateTeamMemberInput(data) {
  const errors = [];
  if (!data.member_name || typeof data.member_name !== 'string' || data.member_name.length > 50) {
    errors.push('成员姓名格式不正确（必填，最长50字符）');
  }
  if (data.role && !TEAM_ROLES.includes(data.role)) {
    errors.push(`角色必须是[${TEAM_ROLES.join(', ')}]之一`);
  }
  if (data.department && (typeof data.department !== 'string' || data.department.length > 100)) {
    errors.push('所属科室格式不正确（最长100字符）');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * 新增小组成员
 */
async function addTeamMember(tenantId, recordId, data) {
  const [result] = await db.execute(
    `INSERT INTO acceptance_teams (tenant_id, acceptance_record_id, user_id, member_name, role, department, assigned_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [tenantId, recordId, data.user_id || null, data.member_name, data.role || '成员', data.department || null],
  );
  return { id: result.insertId };
}

/**
 * 更新小组成员（仅限本租户 + 指定记录下的成员）
 */
async function updateTeamMember(memberId, recordId, tenantFilter, data) {
  const [result] = await db.execute(
    `UPDATE acceptance_teams SET member_name = ?, role = ?, department = ?, user_id = ?
     WHERE id = ? AND acceptance_record_id = ?${tenantFilter.whereClause}`,
    [data.member_name, data.role || '成员', data.department || null, data.user_id || null,
      memberId, recordId, ...tenantFilter.params],
  );
  return result.affectedRows > 0;
}

/**
 * 删除小组成员（软删除）
 */
async function deleteTeamMember(memberId, recordId, tenantFilter, deletedBy = null) {
  const [result] = await db.execute(
    `UPDATE acceptance_teams SET is_deleted = 1, deleted_at = NOW(), deleted_by = ?
     WHERE id = ? AND acceptance_record_id = ?${tenantFilter.whereClause} AND is_deleted = 0`,
    [deletedBy, memberId, recordId, ...tenantFilter.params],
  );
  return result.affectedRows > 0;
}

// ============================================
// 验收提醒（acceptance_reminders）
// ============================================

/**
 * 校验提醒输入
 */
function validateReminderInput(data) {
  const errors = [];
  if (!data.title || typeof data.title !== 'string' || data.title.length > 200) {
    errors.push('提醒标题格式不正确（必填，最长200字符）');
  }
  if (!data.reminder_type || !REMINDER_TYPES.includes(data.reminder_type)) {
    errors.push(`提醒类型必须是[${REMINDER_TYPES.join(', ')}]之一`);
  }
  if (!data.remind_date) {
    errors.push('提醒日期为必填项');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * 手动创建提醒
 */
async function createReminder(tenantId, data) {
  const [result] = await db.execute(
    `INSERT INTO acceptance_reminders
       (tenant_id, acceptance_record_id, application_id, reminder_type, title, content, remind_date, status, target_user_id, target_department, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      tenantId,
      data.acceptance_record_id || null,
      data.application_id || null,
      data.reminder_type,
      data.title,
      data.content || null,
      data.remind_date,
      '已发送',
      data.target_user_id || null,
      data.target_department || null,
    ],
  );
  const id = result.insertId;

  // 计算相对今天的天数（用于飞书卡片染色：超期红 / ≤3天橙 / 其余蓝）
  let daysUntil = null;
  if (data.remind_date) {
    const d = new Date(data.remind_date);
    if (!isNaN(d.getTime())) {
      const startOfDay = t => { t.setHours(0, 0, 0, 0); return t; };
      daysUntil = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
    }
  }

  // 手动创建的提醒也推送飞书通知（消除「手动提醒不通知」缺口）
  publishReminderEvent({
    reminder_id: id,
    tenantId,
    reminder_type: data.reminder_type,
    title: data.title,
    content: data.content,
    remind_date: data.remind_date,
    asset_code: data.asset_code || null,
    asset_name: data.asset_name || null,
    application_code: data.application_code || null,
    link_path: data.link_path || '/acceptance/reminders',
    target_user_id: data.target_user_id || null,
    target_name: data.target_name || null,
    target_department: data.target_department || null,
    days_until: daysUntil,
  });

  return { id };
}

/**
 * 更新提醒状态（已读 / 已忽略 / 已发送）
 */
async function updateReminderStatus(reminderId, tenantFilter, status) {
  if (!REMINDER_STATUSES.includes(status)) {
    return { ok: false, reason: 'INVALID_STATUS' };
  }
  const setSentAt = status === '已发送' ? ', sent_at = NOW()' : '';
  const [result] = await db.execute(
    `UPDATE acceptance_reminders SET status = ?${setSentAt} WHERE id = ?${tenantFilter.whereClause}`,
    [status, reminderId, ...tenantFilter.params],
  );
  return { ok: result.affectedRows > 0 };
}

/**
 * 删除提醒（软删除）
 */
async function deleteReminder(reminderId, tenantFilter, deletedBy = null) {
  const [result] = await db.execute(
    `UPDATE acceptance_reminders SET is_deleted = 1, deleted_at = NOW(), deleted_by = ?
     WHERE id = ?${tenantFilter.whereClause} AND is_deleted = 0`,
    [deletedBy, reminderId, ...tenantFilter.params],
  );
  return result.affectedRows > 0;
}

/**
 * 提醒列表（分页 + 状态/类型过滤）
 */
async function listReminders({ tenantFilter, page = 1, pageSize = 20, status, reminder_type }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSizeNum = Math.min(200, parseInt(pageSize, 10) || 20);
  const offset = (pageNum - 1) * pageSizeNum;

  let filterClause = '';
  const filterParams = [];
  if (status) { filterClause += ' AND status = ?'; filterParams.push(status); }
  if (reminder_type) { filterClause += ' AND reminder_type = ?'; filterParams.push(reminder_type); }

  const baseWhere = `WHERE 1=1${tenantFilter.whereClause} AND is_deleted = 0${filterClause}`;
  const [records] = await db.execute(
    `SELECT * FROM acceptance_reminders ${baseWhere} ORDER BY remind_date DESC, created_at DESC LIMIT ? OFFSET ?`,
    [...tenantFilter.params, ...filterParams, pageSizeNum, offset],
  );
  const [totalResult] = await db.execute(
    `SELECT COUNT(*) AS total FROM acceptance_reminders ${baseWhere}`,
    [...tenantFilter.params, ...filterParams],
  );
  const total = totalResult[0]?.total || 0;
  return {
    records,
    pagination: {
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(total / pageSizeNum),
    },
  };
}

/**
 * 提醒统计（按状态、按类型）
 */
async function getReminderStats(tenantFilter) {
  const [byStatus] = await db.execute(
    `SELECT status, COUNT(*) AS count FROM acceptance_reminders WHERE 1=1${tenantFilter.whereClause} AND is_deleted = 0 GROUP BY status`,
    [...tenantFilter.params],
  );
  const [byType] = await db.execute(
    `SELECT reminder_type, COUNT(*) AS count FROM acceptance_reminders WHERE 1=1${tenantFilter.whereClause} AND is_deleted = 0 GROUP BY reminder_type`,
    [...tenantFilter.params],
  );
  const [pending] = await db.execute(
    `SELECT COUNT(*) AS count FROM acceptance_reminders WHERE status IN ('待发送','已发送')${tenantFilter.whereClause} AND is_deleted = 0`,
    [...tenantFilter.params],
  );
  return {
    byStatus,
    byType,
    unresolved: pending[0]?.count || 0,
  };
}

// ============================================
// 定时扫描（scheduler 调用，跨租户）
// ============================================

/**
 * 去重：当天是否已存在同类型、同关联对象的提醒
 */
async function reminderExistsToday({ tenantId, reminderType, recordId = null, applicationId = null }) {
  const conds = ['tenant_id = ?', 'reminder_type = ?', 'DATE(created_at) = CURDATE()'];
  const args = [tenantId, reminderType];
  if (applicationId != null) {
    conds.push('application_id = ?');
    args.push(applicationId);
  } else if (recordId != null) {
    conds.push('acceptance_record_id = ?');
    args.push(recordId);
  }
  const [rows] = await db.execute(
    `SELECT id FROM acceptance_reminders WHERE ${conds.join(' AND ')} AND is_deleted = 0 LIMIT 1`,
    args,
  );
  return rows.length > 0;
}

/**
 * 发布验收提醒飞书通知事件（手动创建 / 定时扫描共用）
 * @param {object} reminder 含 reminder_id / tenantId / reminder_type / title / content / remind_date / ...
 */
function publishReminderEvent(reminder) {
  try {
    publish('acceptance:reminder', {
      reminder_id: reminder.reminder_id,
      tenantId: reminder.tenantId,
      reminder_type: reminder.reminder_type,
      title: reminder.title,
      content: reminder.content || '',
      remind_date: reminder.remind_date || null,
      asset_code: reminder.asset_code || null,
      asset_name: reminder.asset_name || null,
      application_code: reminder.application_code || null,
      link_path: reminder.link_path || '/acceptance/reminders',
      target_user_id: reminder.target_user_id || null,
      target_name: reminder.target_name || null,
      target_department: reminder.target_department || null,
      days_until: reminder.days_until != null ? reminder.days_until : null,
    });
  } catch (e) {
    logger.warn('发布验收提醒飞书事件失败', e.message);
  }
}

/**
 * 落库一条提醒并发布飞书事件
 */
async function persistAndNotify(reminder) {
  const [result] = await db.execute(
    `INSERT INTO acceptance_reminders
       (tenant_id, acceptance_record_id, application_id, reminder_type, title, content, remind_date, status, target_user_id, target_department, created_at, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, CURDATE(), '已发送', ?, ?, NOW(), NOW())`,
    [
      reminder.tenantId,
      reminder.acceptance_record_id || null,
      reminder.application_id || null,
      reminder.reminder_type,
      reminder.title,
      reminder.content || null,
      reminder.target_user_id || null,
      reminder.target_department || null,
    ],
  );

  // 发布飞书通知事件（由 feishu-notification.service 订阅处理，手动创建 / 定时扫描共用）
  publishReminderEvent({ ...reminder, reminder_id: result.insertId });
  return result.insertId;
}

/**
 * 扫描：验收申请「到期提醒」+「超期预警」
 * 依据 acceptance_applications.planned_acceptance_date 与状态（待审批/审批中/已批准）
 * @param {number} leadDays 提前提醒天数
 */
async function scanApplicationReminders(leadDays = 3) {
  const [apps] = await db.execute(
    `SELECT id, tenant_id, application_code, title, asset_code, asset_name, planned_acceptance_date,
            applicant_id, applicant_name, department, status,
            DATEDIFF(planned_acceptance_date, CURDATE()) AS days_until
     FROM acceptance_applications
     WHERE is_deleted = 0
       AND status IN ('待审批','审批中','已批准')
       AND planned_acceptance_date IS NOT NULL
       AND planned_acceptance_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
    [leadDays],
  );

  let created = 0;
  for (const app of apps) {
    const daysUntil = app.days_until;
    const isOverdue = daysUntil < 0;
    const reminderType = isOverdue ? '超期预警' : '到期提醒';
    if (await reminderExistsToday({ tenantId: app.tenant_id, reminderType, applicationId: app.id })) {
      continue;
    }
    const dateStr = app.planned_acceptance_date ? String(app.planned_acceptance_date).split('T')[0] : '-';
    const title = isOverdue
      ? `验收申请 ${app.application_code || app.title} 已超期`
      : `验收申请 ${app.application_code || app.title} 即将到期`;
    const content = isOverdue
      ? `申请「${app.title}」计划验收日期为 ${dateStr}，已超期 ${Math.abs(daysUntil)} 天，请尽快安排验收。`
      : `申请「${app.title}」计划于 ${dateStr} 验收，还有 ${daysUntil} 天到期，请提前准备。`;
    await persistAndNotify({
      tenantId: app.tenant_id,
      application_id: app.id,
      application_code: app.application_code,
      asset_code: app.asset_code,
      asset_name: app.asset_name,
      reminder_type: reminderType,
      title,
      content,
      remind_date: dateStr,
      target_user_id: app.applicant_id || null,
      target_name: app.applicant_name || null,
      target_department: app.department || null,
      days_until: daysUntil,
      link_path: '/acceptance/applications',
    });
    created += 1;
  }
  return { candidates: apps.length, created };
}

/**
 * 扫描：待审批申请「审批待办」提醒
 */
async function scanPendingApprovalReminders() {
  const [apps] = await db.execute(
    `SELECT id, tenant_id, application_code, title, asset_code, asset_name, department, priority
     FROM acceptance_applications
     WHERE is_deleted = 0 AND status = '待审批'`,
  );
  let created = 0;
  for (const app of apps) {
    if (await reminderExistsToday({ tenantId: app.tenant_id, reminderType: '审批待办', applicationId: app.id })) {
      continue;
    }
    await persistAndNotify({
      tenantId: app.tenant_id,
      application_id: app.id,
      application_code: app.application_code,
      asset_code: app.asset_code,
      asset_name: app.asset_name,
      reminder_type: '审批待办',
      title: `验收申请 ${app.application_code || app.title} 待审批`,
      content: `申请「${app.title}」${app.priority ? `（优先级：${app.priority}）` : ''}正在等待审批，请及时处理。`,
      remind_date: null,
      target_department: app.department || null,
      link_path: '/acceptance/applications',
    });
    created += 1;
  }
  return { candidates: apps.length, created };
}

/**
 * 扫描：验收记录到期/超期（依据 acceptance_date + 状态 待验收/验收中）
 */
async function scanRecordReminders(leadDays = 3) {
  const [records] = await db.execute(
    `SELECT id, tenant_id, asset_code, asset_name, acceptance_date, acceptance_person, department, status,
            DATEDIFF(acceptance_date, CURDATE()) AS days_until
     FROM asset_acceptance_records
     WHERE status IN ('待验收','验收中')
       AND acceptance_date IS NOT NULL
       AND acceptance_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
    [leadDays],
  );
  let created = 0;
  for (const rec of records) {
    const daysUntil = rec.days_until;
    const isOverdue = daysUntil < 0;
    const reminderType = isOverdue ? '超期预警' : '到期提醒';
    if (await reminderExistsToday({ tenantId: rec.tenant_id, reminderType, recordId: rec.id })) {
      continue;
    }
    const dateStr = rec.acceptance_date ? String(rec.acceptance_date).split('T')[0] : '-';
    const title = isOverdue
      ? `验收单 ${rec.asset_code || rec.asset_name} 验收超期`
      : `验收单 ${rec.asset_code || rec.asset_name} 即将到期`;
    const content = isOverdue
      ? `资产「${rec.asset_name || rec.asset_code}」验收日期 ${dateStr} 已超期 ${Math.abs(daysUntil)} 天，当前状态「${rec.status}」，请尽快完成验收。`
      : `资产「${rec.asset_name || rec.asset_code}」验收日期为 ${dateStr}，还有 ${daysUntil} 天，当前状态「${rec.status}」。`;
    await persistAndNotify({
      tenantId: rec.tenant_id,
      acceptance_record_id: rec.id,
      asset_code: rec.asset_code,
      asset_name: rec.asset_name,
      reminder_type: reminderType,
      title,
      content,
      remind_date: dateStr,
      target_name: rec.acceptance_person || null,
      target_department: rec.department || null,
      days_until: daysUntil,
      link_path: `/acceptance/${rec.id}`,
    });
    created += 1;
  }
  return { candidates: records.length, created };
}

/**
 * 完整扫描（scheduler 每日调用）
 */
async function runReminderScan(leadDays = 3) {
  const appResult = await scanApplicationReminders(leadDays);
  const recResult = await scanRecordReminders(leadDays);
  const approvalResult = await scanPendingApprovalReminders();
  const summary = {
    application: appResult,
    record: recResult,
    approval: approvalResult,
    totalCreated: appResult.created + recResult.created + approvalResult.created,
  };
  logger.info(`验收提醒扫描完成：新建 ${summary.totalCreated} 条`);
  return summary;
}

module.exports = {
  TEAM_ROLES,
  REMINDER_TYPES,
  REMINDER_STATUSES,
  // 记录
  findAcceptanceRecord,
  // 小组
  listTeamMembers,
  validateTeamMemberInput,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
  // 提醒
  validateReminderInput,
  listReminders,
  createReminder,
  updateReminderStatus,
  deleteReminder,
  getReminderStats,
  // 扫描
  scanApplicationReminders,
  scanPendingApprovalReminders,
  scanRecordReminders,
  runReminderScan,
};
