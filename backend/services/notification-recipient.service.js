/**
 * 通知接收人解析服务
 * 根据规则中的 recipient 配置，解析出最终的用户ID列表及 open_id
 */
const db = require('../config/database');
const logger = require('../config/logger');
const { ROLES } = require('../config/roles.config');

/**
 * 标准化部门值（支持编码或名称）
 */
async function normalizeDepartments(values, tenantId) {
  if (!values || !values.length) return [];
  const inputs = values.map(v => String(v).trim()).filter(Boolean);
  if (!inputs.length) return [];

  const placeholders = inputs.map(() => '?').join(',');
  const [rows] = await db.execute(
    `SELECT DISTINCT name, code FROM departments
     WHERE tenant_id = ? AND (code IN (${placeholders}) OR name IN (${placeholders}))`,
    [tenantId, ...inputs, ...inputs],
  );
  const names = rows.map(r => r.name);
  const codes = rows.map(r => r.code);
  return [...new Set([...names, ...codes])];
}

/**
 * 根据角色查询用户ID
 */
async function getUserIdsByRole(role, tenantId) {
  if (!role || !tenantId) return [];
  const [rows] = await db.execute(
    `SELECT DISTINCT u.id FROM users u
     INNER JOIN user_tenant_roles utr ON u.id = utr.user_id
     WHERE utr.tenant_id = ? AND utr.role = ? AND u.status = 'active'`,
    [tenantId, role],
  );
  return rows.map(r => r.id);
}

/**
 * 根据部门查询用户ID
 */
async function getUserIdsByDepartment(departmentValue, tenantId) {
  if (!departmentValue || !tenantId) return [];
  const [rows] = await db.execute(
    `SELECT DISTINCT u.id FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.tenant_id = ? AND u.status = 'active'
       AND (u.department = ? OR u.department_new = ? OR d.name = ? OR d.code = ?)`,
    [tenantId, departmentValue, departmentValue, departmentValue, departmentValue],
  );
  return rows.map(r => r.id);
}

/**
 * 从 payload 中解析流程节点相关的用户ID
 */
function resolveNodeRecipients(recipientValue, payload) {
  const values = Array.isArray(recipientValue) ? recipientValue : [recipientValue];
  const userIds = new Set();
  for (const code of values) {
    const key = String(code).trim();
    if (!key) continue;

    // 直接映射到 payload 字段
    const directKeys = ['applicantId', 'approverId', 'assigneeId', 'createdBy', 'operatorId',
      'request_person_id', 'repair_person_id', 'user_id', 'target_user_id', 'reviewedBy'];
    const keyMap = {
      applicant: 'applicantId',
      approver: 'approverId',
      assignee: 'assigneeId',
      creator: 'createdBy',
      operator: 'operatorId',
      request_person: 'request_person_id',
      repair_person: 'repair_person_id',
      user: 'user_id',
      target_user: 'target_user_id',
      reviewed_by: 'reviewedBy',
    };

    const payloadKey = keyMap[key] || key;
    const v = payload[payloadKey];
    if (v != null) {
      if (Array.isArray(v)) {
        v.forEach(id => id && userIds.add(Number(id)));
      } else {
        userIds.add(Number(v));
      }
    }
  }
  return [...userIds].filter(Boolean);
}

/**
 * 解析规则中的 recipients 为最终用户ID数组
 */
async function resolveRuleRecipients(recipients, payload, tenantId) {
  const userIds = new Set();
  if (!recipients || !recipients.length) return [];

  for (const rec of recipients) {
    const type = rec.recipient_type;
    const value = rec.recipient_value;
    const values = Array.isArray(value) ? value : value ? [value] : [];

    try {
      switch (type) {
        case 'role':
          for (const role of values) {
            const ids = await getUserIdsByRole(role, tenantId);
            ids.forEach(id => userIds.add(id));
          }
          break;
        case 'department':
          for (const dept of values) {
            const ids = await getUserIdsByDepartment(dept, tenantId);
            ids.forEach(id => userIds.add(id));
          }
          break;
        case 'user':
          for (const id of values) {
            if (id) userIds.add(Number(id));
          }
          break;
        case 'node':
          {
            const ids = resolveNodeRecipients(values, payload);
            ids.forEach(id => userIds.add(id));
          }
          break;
        default:
          logger.warn(`[NotificationRecipient] 未知接收人类型: ${type}`);
      }
    } catch (e) {
      logger.warn(`[NotificationRecipient] 解析接收人失败 type=${type}:`, e.message);
    }
  }

  return [...userIds].filter(Boolean);
}

/**
 * 查询用户手机号（用于飞书反查）
 */
async function getUserPhones(userIds) {
  if (!userIds.length) return [];
  const placeholders = userIds.map(() => '?').join(',');
  const [rows] = await db.execute(
    `SELECT id, phone FROM users WHERE id IN (${placeholders}) AND phone IS NOT NULL AND phone <> ''`,
    userIds,
  );
  return rows.map(r => ({ userId: r.id, phone: r.phone }));
}

module.exports = {
  resolveRuleRecipients,
  resolveNodeRecipients,
  getUserIdsByRole,
  getUserIdsByDepartment,
  normalizeDepartments,
  getUserPhones,
};
