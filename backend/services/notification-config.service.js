/**
 * 通知配置服务
 * 管理通知模板、通知规则、通知接收人配置
 */
const db = require('../config/database');
const logger = require('../config/logger');

const DEFAULT_PAGE_SIZE = 20;

/**
 * 解析 JSON 字段，失败返回默认值
 */
function safeJsonParse(value, defaultValue = null) {
  if (value == null) return defaultValue;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return defaultValue;
  }
}

/**
 * 序列化 JSON 字段
 */
function safeJsonStringify(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (e) {
    return null;
  }
}

/* ===================== 通知模板 ===================== */

async function listTemplates({ tenantId, channel, keyword, page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const conditions = ['tenant_id = ?'];
  const params = [tenantId || 0];

  if (channel) {
    conditions.push('channel = ?');
    params.push(channel);
  }
  if (keyword) {
    conditions.push('(code LIKE ? OR name LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const where = conditions.join(' AND ');
  const limit = parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE;
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const [[countRows]] = await db.execute(
    `SELECT COUNT(*) AS total FROM notification_templates WHERE ${where}`,
    params,
  );

  const [rows] = await db.execute(
    `SELECT id, tenant_id, code, name, channel, title_template, content_template, variables_json, enabled, created_at, updated_at
     FROM notification_templates
     WHERE ${where}
     ORDER BY updated_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    list: rows.map(r => ({
      ...r,
      variables_json: safeJsonParse(r.variables_json, []),
    })),
    pagination: {
      total: countRows.total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      pages: Math.ceil(countRows.total / limit),
    },
  };
}

async function getTemplateById(id, tenantId) {
  const [rows] = await db.execute(
    `SELECT id, tenant_id, code, name, channel, title_template, content_template, variables_json, enabled, created_at, updated_at
     FROM notification_templates
     WHERE id = ? AND tenant_id = ?`,
    [id, tenantId || 0],
  );
  if (!rows.length) return null;
  return {
    ...rows[0],
    variables_json: safeJsonParse(rows[0].variables_json, []),
  };
}

async function getTemplateByCode(code, tenantId) {
  const [rows] = await db.execute(
    `SELECT id, tenant_id, code, name, channel, title_template, content_template, variables_json, enabled, created_at, updated_at
     FROM notification_templates
     WHERE code = ? AND tenant_id = ? AND enabled = 1`,
    [code, tenantId || 0],
  );
  if (!rows.length) return null;
  return {
    ...rows[0],
    variables_json: safeJsonParse(rows[0].variables_json, []),
  };
}

async function createTemplate(data) {
  const { tenant_id = 0, code, name, channel = 'feishu', title_template, content_template, variables_json, enabled = 1 } = data;
  const [result] = await db.execute(
    `INSERT INTO notification_templates
     (tenant_id, code, name, channel, title_template, content_template, variables_json, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [tenant_id, code, name, channel, title_template || null, content_template || null, safeJsonStringify(variables_json), enabled ? 1 : 0],
  );
  return getTemplateById(result.insertId, tenant_id);
}

async function updateTemplate(id, tenantId, data) {
  const allowed = ['code', 'name', 'channel', 'title_template', 'content_template', 'variables_json', 'enabled'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(key === 'variables_json' ? safeJsonStringify(data[key]) : data[key]);
    }
  }
  if (!sets.length) return null;
  sets.push('updated_at = NOW()');
  params.push(id, tenantId || 0);
  await db.execute(
    `UPDATE notification_templates SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
    params,
  );
  return getTemplateById(id, tenantId);
}

async function deleteTemplate(id, tenantId) {
  await db.execute(
    'DELETE FROM notification_templates WHERE id = ? AND tenant_id = ?',
    [id, tenantId || 0],
  );
  return true;
}

/* ===================== 通知规则 ===================== */

async function listRules({ tenantId, processType, eventCode, nodeCode, enabled, keyword, page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const conditions = ['r.tenant_id = ?'];
  const params = [tenantId || 0];

  if (processType) {
    conditions.push('r.process_type = ?');
    params.push(processType);
  }
  if (eventCode) {
    conditions.push('r.event_code = ?');
    params.push(eventCode);
  }
  if (nodeCode) {
    conditions.push('r.node_code = ?');
    params.push(nodeCode);
  }
  if (enabled !== undefined && enabled !== null && enabled !== '') {
    conditions.push('r.enabled = ?');
    params.push(enabled ? 1 : 0);
  }
  if (keyword) {
    conditions.push('(r.rule_name LIKE ? OR r.event_code LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const where = conditions.join(' AND ');
  const limit = parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE;
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const [[countRows]] = await db.execute(
    `SELECT COUNT(*) AS total FROM notification_rules r WHERE ${where}`,
    params,
  );

  const [rows] = await db.execute(
    `SELECT r.*, t.code AS template_code, t.name AS template_name, t.channel
     FROM notification_rules r
     LEFT JOIN notification_templates t ON r.template_id = t.id
     WHERE ${where}
     ORDER BY r.priority DESC, r.updated_at DESC, r.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const ruleIds = rows.map(r => r.id);
  let recipients = [];
  if (ruleIds.length) {
    const placeholders = ruleIds.map(() => '?').join(',');
    const [recRows] = await db.execute(
      `SELECT id, rule_id, recipient_type, recipient_value
       FROM notification_recipients
       WHERE rule_id IN (${placeholders})`,
      ruleIds,
    );
    recipients = recRows;
  }

  const recipientsByRule = new Map();
  for (const rec of recipients) {
    if (!recipientsByRule.has(rec.rule_id)) recipientsByRule.set(rec.rule_id, []);
    recipientsByRule.get(rec.rule_id).push({
      id: rec.id,
      recipient_type: rec.recipient_type,
      recipient_value: safeJsonParse(rec.recipient_value, rec.recipient_value),
    });
  }

  return {
    list: rows.map(r => ({
      ...r,
      trigger_condition: safeJsonParse(r.trigger_condition, null),
      recipients: recipientsByRule.get(r.id) || [],
    })),
    pagination: {
      total: countRows.total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      pages: Math.ceil(countRows.total / limit),
    },
  };
}

async function getRuleById(id, tenantId) {
  const [rows] = await db.execute(
    `SELECT r.*, t.code AS template_code, t.name AS template_name, t.channel
     FROM notification_rules r
     LEFT JOIN notification_templates t ON r.template_id = t.id
     WHERE r.id = ? AND r.tenant_id = ?`,
    [id, tenantId || 0],
  );
  if (!rows.length) return null;

  const [recRows] = await db.execute(
    'SELECT id, rule_id, recipient_type, recipient_value FROM notification_recipients WHERE rule_id = ?',
    [id],
  );

  return {
    ...rows[0],
    trigger_condition: safeJsonParse(rows[0].trigger_condition, null),
    recipients: recRows.map(r => ({
      ...r,
      recipient_value: safeJsonParse(r.recipient_value, r.recipient_value),
    })),
  };
}

async function createRule(data) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      tenant_id = 0,
      process_type,
      event_code,
      rule_name,
      node_code = null,
      template_id,
      trigger_condition = null,
      enabled = 1,
      priority = 0,
      recipients = [],
    } = data;

    const [result] = await conn.execute(
      `INSERT INTO notification_rules
       (tenant_id, process_type, event_code, rule_name, node_code, template_id, trigger_condition, enabled, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [tenant_id, process_type, event_code, rule_name, node_code, template_id, safeJsonStringify(trigger_condition), enabled ? 1 : 0, priority],
    );

    const ruleId = result.insertId;
    if (recipients.length) {
      for (const rec of recipients) {
        await conn.execute(
          `INSERT INTO notification_recipients
           (rule_id, recipient_type, recipient_value, created_at)
           VALUES (?, ?, ?, NOW())`,
          [ruleId, rec.recipient_type, safeJsonStringify(rec.recipient_value)],
        );
      }
    }

    await conn.commit();
    return getRuleById(ruleId, tenant_id);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function updateRule(id, tenantId, data) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const allowed = ['process_type', 'event_code', 'rule_name', 'node_code', 'template_id', 'trigger_condition', 'enabled', 'priority'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(key === 'trigger_condition' ? safeJsonStringify(data[key]) : data[key]);
      }
    }
    if (sets.length) {
      sets.push('updated_at = NOW()');
      params.push(id, tenantId || 0);
      await conn.execute(
        `UPDATE notification_rules SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
        params,
      );
    }

    if (Array.isArray(data.recipients)) {
      await conn.execute('DELETE FROM notification_recipients WHERE rule_id = ?', [id]);
      for (const rec of data.recipients) {
        await conn.execute(
          `INSERT INTO notification_recipients
           (rule_id, recipient_type, recipient_value, created_at)
           VALUES (?, ?, ?, NOW())`,
          [id, rec.recipient_type, safeJsonStringify(rec.recipient_value)],
        );
      }
    }

    await conn.commit();
    return getRuleById(id, tenantId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function deleteRule(id, tenantId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM notification_recipients WHERE rule_id = ?', [id]);
    await conn.execute('DELETE FROM notification_rules WHERE id = ? AND tenant_id = ?', [id, tenantId || 0]);
    await conn.commit();
    return true;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/* ===================== 接收人配置 CRUD ===================== */

async function listRecipients(ruleId, tenantId) {
  const [rows] = await db.execute(
    `SELECT nr.* FROM notification_recipients nr
     INNER JOIN notification_rules r ON nr.rule_id = r.id
     WHERE nr.rule_id = ? AND r.tenant_id = ?`,
    [ruleId, tenantId || 0],
  );
  return rows.map(r => ({
    ...r,
    recipient_value: safeJsonParse(r.recipient_value, r.recipient_value),
  }));
}

async function addRecipient(ruleId, tenantId, data) {
  const [result] = await db.execute(
    `INSERT INTO notification_recipients (rule_id, recipient_type, recipient_value, created_at)
     SELECT ?, ?, ?, NOW() FROM notification_rules r WHERE r.id = ? AND r.tenant_id = ?
     LIMIT 1`,
    [ruleId, data.recipient_type, safeJsonStringify(data.recipient_value), ruleId, tenantId || 0],
  );
  if (result.affectedRows === 0) throw new Error('规则不存在或无权限');
  return result.insertId;
}

async function deleteRecipient(id, tenantId) {
  await db.execute(
    `DELETE nr FROM notification_recipients nr
     INNER JOIN notification_rules r ON nr.rule_id = r.id
     WHERE nr.id = ? AND r.tenant_id = ?`,
    [id, tenantId || 0],
  );
  return true;
}

/* ===================== 元数据 ===================== */

const PROCESS_TYPES = [
  { code: 'maintenance', name: '维修维护' },
  { code: 'approval', name: '审批流程' },
  { code: 'scrapping', name: '资产报废' },
  { code: 'transfer', name: '资产调配' },
  { code: 'inventory', name: '资产盘点' },
  { code: 'tender', name: '招标采购' },
  { code: 'acceptance', name: '验收管理' },
  { code: 'quality', name: '质量管理' },
  { code: 'asset', name: '资产状态' },
  { code: 'user', name: '用户管理' },
  { code: 'finance', name: '财务管理' },
];

const EVENTS_BY_PROCESS = {
  maintenance: [
    'maintenance_request:created', 'maintenance_request:approved', 'maintenance_request:rejected',
    'maintenance_request:started', 'maintenance_request:completed', 'maintenance_request:cancelled',
    'workorder:assigned', 'workorder:completed', 'maintenance:approved',
  ],
  approval: [
    'approval:created', 'approval:approved', 'approval:rejected', 'approval:completed',
  ],
  scrapping: [
    'scrapping:created', 'scrapping:approved', 'scrapping:rejected', 'scrapping:completed',
  ],
  transfer: [
    'transfer:created', 'transfer:approved', 'transfer:rejected', 'transfer:completed',
  ],
  inventory: [
    'inventory:created', 'inventory:started', 'inventory:completed', 'inventory_task:created',
    'inventory_task:completed', 'inventory_task:cancelled',
  ],
  tender: [
    'tender:created', 'tender:published', 'tender:awarded', 'tender:completed', 'tender:cancelled',
    'bid:submitted', 'bid:awarded', 'qualification:reviewed', 'tender:invitation-sent',
    'tender:invoice:created', 'tender:invoice:verified', 'tender:payment:created', 'tender:payment:submitted',
    'tender:payment:paid', 'tender:payment:failed', 'tender:payment:approval_pending',
  ],
  acceptance: ['acceptance:reminder'],
  quality: ['quality:metrology-expiring'],
  asset: ['asset_workflow:transition'],
  user: ['notification:role_request'],
  finance: ['tender:invoice:paid', 'tender:invoice:archived', 'tender:invoice:cancelled'],
};

const RECIPIENT_TYPES = [
  { code: 'role', name: '按角色' },
  { code: 'department', name: '按部门' },
  { code: 'user', name: '按用户' },
  { code: 'node', name: '按流程节点' },
];

const NODE_RECIPIENT_OPTIONS = [
  { code: 'applicant', name: '申请人' },
  { code: 'approver', name: '审批人' },
  { code: 'assignee', name: '被指派人' },
  { code: 'creator', name: '创建人' },
  { code: 'request_person', name: '报修人' },
  { code: 'repair_person', name: '维修工程师' },
  { code: 'operator', name: '操作人' },
  { code: 'responsible_person', name: '负责人' },
];

function getMetadata() {
  return {
    process_types: PROCESS_TYPES,
    events_by_process: EVENTS_BY_PROCESS,
    recipient_types: RECIPIENT_TYPES,
    node_recipient_options: NODE_RECIPIENT_OPTIONS,
    channels: [
      { code: 'feishu', name: '飞书' },
      { code: 'email', name: '邮件' },
      { code: 'socket', name: '站内消息' },
    ],
  };
}

module.exports = {
  listTemplates,
  getTemplateById,
  getTemplateByCode,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  listRecipients,
  addRecipient,
  deleteRecipient,
  getMetadata,
  safeJsonParse,
  safeJsonStringify,
};
