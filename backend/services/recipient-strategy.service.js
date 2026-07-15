/**
 * 通知接收人策略服务
 *
 * 职责：
 *   1. 管理 recipient_strategies 表的 CRUD
 *   2. 解析 payload → 接收人 userId 列表
 *   3. 提供默认策略元数据（给前端 UI 用）
 *
 * 策略类型 (strategy_type):
 *   - user            : 指定用户（strategy_value = [user_id, ...]）
 *   - role            : 角色全员（strategy_value = 'maintenance_admin'）
 *   - applicant       : 发起人/申请人（payload.applicantId 或 request_person_id）
 *   - approver        : 审批人（payload.approverId）
 *   - assignee        : 被指派人（payload.assigneeId）
 *   - requester       : 报修人/申请人（payload.request_person_id，同 applicant）
 *   - operator        : 操作人（payload.operatorId）
 *   - tenant_admin    : 租户管理员（super_admin / system_admin / admin）
 *   - engineer        : 维修工程师（maintenance_admin / maintenance_engineer）
 *   - department      : 部门成员（strategy_value = 'DEP000100'）
 *
 * 多策略合并：
 *   - 一个事件可配置多条策略（多条记录）
 *   - 解析时按 priority DESC 顺序执行
 *   - 所有策略结果 union 后去重
 *   - 没有任何匹配 → fallback 到系统默认逻辑（in-app-notification.service 自带）
 *
 * 缓存：
 *   - 5 分钟内存缓存（key = `${tenantId}:${eventCode}`），避免每次事件都查表
 *   - CRUD 操作后通过 clearCache() 失效
 */
const db = require('../config/database');
const logger = require('../config/logger');

const CACHE_TTL = 5 * 60 * 1000;
const _strategyCache = new Map(); // key -> { strategies, ts }

/* ===================== 元数据 ===================== */

const STRATEGY_TYPES = [
  { code: 'user',         name: '指定用户',   needValue: true,  multi: true,
    description: '直接指定一个或多个用户的 userId 列表' },
  { code: 'role',         name: '角色全员',   needValue: true,  multi: false,
    description: '拥有指定角色的所有用户，如 maintenance_admin' },
  { code: 'applicant',    name: '发起人',     needValue: false, multi: false,
    description: '从事件 payload 中取 applicantId' },
  { code: 'approver',     name: '审批人',     needValue: false, multi: false,
    description: '从事件 payload 中取 approverId' },
  { code: 'assignee',     name: '被指派人',   needValue: false, multi: false,
    description: '从事件 payload 中取 assigneeId' },
  { code: 'requester',    name: '报修人',     needValue: false, multi: false,
    description: '从事件 payload 中取 request_person_id' },
  { code: 'operator',     name: '操作人',     needValue: false, multi: false,
    description: '从事件 payload 中取 operatorId' },
  { code: 'tenant_admin', name: '租户管理员', needValue: false, multi: false,
    description: '查 super_admin / system_admin / admin 角色' },
  { code: 'engineer',     name: '维修工程师', needValue: false, multi: false,
    description: '查 maintenance_admin / maintenance_engineer 角色' },
  { code: 'department',   name: '部门成员',   needValue: true,  multi: true,
    description: '指定部门（department_code）的所有成员' },
];

const STRATEGY_TYPE_MAP = STRATEGY_TYPES.reduce((m, s) => { m[s.code] = s; return m; }, {});

/* ===================== 缓存 ===================== */

function cacheKey(tenantId, eventCode) {
  return `${tenantId || 0}:${eventCode}`;
}

async function getCachedStrategies(tenantId, eventCode) {
  const key = cacheKey(tenantId, eventCode);
  const cached = _strategyCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.strategies;
  }
  const strategies = await listStrategiesForEvent(tenantId, eventCode);
  _strategyCache.set(key, { strategies, ts: Date.now() });
  return strategies;
}

function clearCache(tenantId, eventCode) {
  if (eventCode) {
    _strategyCache.delete(cacheKey(tenantId, eventCode));
  } else {
    _strategyCache.clear();
  }
}

/* ===================== CRUD ===================== */

async function listStrategiesForEvent(tenantId, eventCode) {
  if (!eventCode) return [];
  const [rows] = await db.execute(
    `SELECT id, tenant_id, event_code, strategy_type, strategy_value, priority, enabled, remark
     FROM recipient_strategies
     WHERE event_code = ? AND tenant_id IN (?, 0) AND enabled = 1
     ORDER BY priority DESC, id ASC`,
    [eventCode, tenantId || 0],
  );
  return rows.map(parseRow);
}

function parseRow(row) {
  let value = null;
  if (row.strategy_value) {
    try { value = JSON.parse(row.strategy_value); }
    catch (_e) { value = row.strategy_value; }
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    eventCode: row.event_code,
    strategyType: row.strategy_type,
    strategyValue: value,
    priority: row.priority || 0,
    enabled: !!row.enabled,
    remark: row.remark,
  };
}

async function listStrategies({ tenantId, eventCode, page = 1, pageSize = 50 } = {}) {
  const conditions = ['1=1'];
  const params = [];
  if (tenantId !== undefined) {
    conditions.push('tenant_id = ?');
    params.push(tenantId || 0);
  }
  if (eventCode) {
    conditions.push('event_code = ?');
    params.push(eventCode);
  }
  const where = conditions.join(' AND ');
  const limit = parseInt(pageSize, 10) || 50;
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const [[countRows]] = await db.execute(
    `SELECT COUNT(*) AS total FROM recipient_strategies WHERE ${where}`,
    params,
  );
  const [rows] = await db.execute(
    `SELECT * FROM recipient_strategies WHERE ${where}
     ORDER BY event_code, priority DESC, id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return {
    list: rows.map(parseRow),
    pagination: {
      total: countRows.total || 0,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      pages: Math.ceil((countRows.total || 0) / limit),
    },
  };
}

async function getStrategyById(id, tenantId) {
  const [rows] = await db.execute(
    `SELECT * FROM recipient_strategies WHERE id = ? AND tenant_id = ?`,
    [id, tenantId || 0],
  );
  return rows.length ? parseRow(rows[0]) : null;
}

async function createStrategy(data, createdBy) {
  const { tenant_id = 0, event_code, strategy_type, strategy_value = null, priority = 0, enabled = 1, remark = null } = data;
  if (!event_code || !strategy_type) {
    throw new Error('event_code 和 strategy_type 必填');
  }
  if (!STRATEGY_TYPE_MAP[strategy_type]) {
    throw new Error(`不支持的策略类型: ${strategy_type}`);
  }
  const meta = STRATEGY_TYPE_MAP[strategy_type];
  if (meta.needValue && (strategy_value === null || strategy_value === undefined)) {
    throw new Error(`策略类型 ${strategy_type} 需要 strategy_value`);
  }
  const [r] = await db.execute(
    `INSERT INTO recipient_strategies
     (tenant_id, event_code, strategy_type, strategy_value, priority, enabled, remark, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenant_id || 0,
      event_code,
      strategy_type,
      typeof strategy_value === 'string' ? strategy_value : JSON.stringify(strategy_value),
      priority,
      enabled ? 1 : 0,
      remark,
      createdBy || null,
    ],
  );
  clearCache(tenant_id, event_code);
  return getStrategyById(r.insertId, tenant_id);
}

async function updateStrategy(id, tenantId, data) {
  const existing = await getStrategyById(id, tenantId);
  if (!existing) return null;

  const fields = [];
  const params = [];
  const allowed = ['strategy_type', 'strategy_value', 'priority', 'enabled', 'remark'];
  for (const k of allowed) {
    if (data[k] !== undefined) {
      fields.push(`${k} = ?`);
      if (k === 'strategy_value' && typeof data[k] !== 'string') {
        params.push(JSON.stringify(data[k]));
      } else {
        params.push(data[k]);
      }
    }
  }
  if (!fields.length) return existing;

  fields.push('updated_at = NOW()');
  params.push(id, tenantId || 0);
  await db.execute(
    `UPDATE recipient_strategies SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
    params,
  );
  clearCache(tenantId, existing.eventCode);
  return getStrategyById(id, tenantId);
}

async function deleteStrategy(id, tenantId) {
  const existing = await getStrategyById(id, tenantId);
  if (!existing) return false;
  await db.execute(
    `DELETE FROM recipient_strategies WHERE id = ? AND tenant_id = ?`,
    [id, tenantId || 0],
  );
  clearCache(tenantId, existing.eventCode);
  return true;
}

async function batchDelete(ids, tenantId) {
  if (!Array.isArray(ids) || !ids.length) return 0;
  const safeIds = ids.map(n => parseInt(n, 10)).filter(Number.isFinite);
  if (!safeIds.length) return 0;
  // 先查 eventCode 用于失效缓存
  const placeholders = safeIds.map(() => '?').join(',');
  const [rows] = await db.execute(
    `SELECT DISTINCT event_code FROM recipient_strategies WHERE id IN (${placeholders}) AND tenant_id = ?`,
    [...safeIds, tenantId || 0],
  );
  const [r] = await db.execute(
    `DELETE FROM recipient_strategies WHERE id IN (${placeholders}) AND tenant_id = ?`,
    [...safeIds, tenantId || 0],
  );
  for (const row of rows) clearCache(tenantId, row.event_code);
  return r.affectedRows || 0;
}

/* ===================== 接收人解析 ===================== */

/**
 * 根据策略列表 + payload 解析出 userId 列表
 * @param {Array} strategies - 策略列表（已按 priority DESC 排序）
 * @param {Object} payload - 事件 payload
 * @param {number} tenantId - 租户ID
 * @returns {Promise<number[]>} - 去重后的 userId 数组
 */
async function resolveRecipientsFromStrategies(strategies, payload, tenantId) {
  if (!strategies || !strategies.length) return [];
  const userIdSet = new Set();
  for (const s of strategies) {
    const ids = await resolveSingleStrategy(s, payload, tenantId);
    ids.forEach(id => userIdSet.add(Number(id)));
  }
  return [...userIdSet].filter(Boolean);
}

async function resolveSingleStrategy(strategy, payload, tenantId) {
  const { strategyType, strategyValue } = strategy;
  switch (strategyType) {
    case 'user': {
      if (!strategyValue) return [];
      const arr = Array.isArray(strategyValue) ? strategyValue : [strategyValue];
      return arr.map(n => Number(n)).filter(Boolean);
    }
    case 'role': {
      if (!strategyValue || !tenantId) return [];
      return queryUsersByRole(tenantId, strategyValue);
    }
    case 'applicant': {
      const v = payload?.applicantId || payload?.createdBy;
      return v ? [Number(v)] : [];
    }
    case 'approver': {
      const v = payload?.approverId;
      return v ? [Number(v)] : [];
    }
    case 'assignee': {
      const v = payload?.assigneeId;
      return v ? [Number(v)] : [];
    }
    case 'requester': {
      const v = payload?.request_person_id || payload?.requesterId;
      return v ? [Number(v)] : [];
    }
    case 'operator': {
      const v = payload?.operatorId || payload?.completedBy;
      return v ? [Number(v)] : [];
    }
    case 'tenant_admin': {
      if (!tenantId) return [];
      return queryUsersByRoles(tenantId, ['super_admin', 'system_admin', 'admin']);
    }
    case 'engineer': {
      if (!tenantId) return [];
      return queryUsersByRoles(tenantId, ['maintenance_admin', 'maintenance_engineer']);
    }
    case 'department': {
      if (!strategyValue || !tenantId) return [];
      const arr = Array.isArray(strategyValue) ? strategyValue : [strategyValue];
      return queryUsersByDepartments(tenantId, arr);
    }
    default:
      logger.warn(`[RecipientStrategy] 未知策略类型: ${strategyType}`);
      return [];
  }
}

async function queryUsersByRole(tenantId, role) {
  try {
    const [rows] = await db.execute(
      `SELECT DISTINCT u.id FROM users u
       INNER JOIN user_tenant_roles utr ON u.id = utr.user_id
       WHERE utr.tenant_id = ? AND utr.role = ? AND u.status = 'active'`,
      [tenantId, role],
    );
    return rows.map(r => Number(r.id));
  } catch (e) {
    logger.error(`[RecipientStrategy] 按角色 ${role} 查询失败:`, e.message);
    return [];
  }
}

async function queryUsersByRoles(tenantId, roles) {
  try {
    const placeholders = roles.map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT DISTINCT u.id FROM users u
       INNER JOIN user_tenant_roles utr ON u.id = utr.user_id
       WHERE utr.tenant_id = ? AND utr.role IN (${placeholders}) AND u.status = 'active'`,
      [tenantId, ...roles],
    );
    return rows.map(r => Number(r.id));
  } catch (e) {
    logger.error(`[RecipientStrategy] 按角色 [${roles.join(',')}] 查询失败:`, e.message);
    return [];
  }
}

async function queryUsersByDepartments(tenantId, departmentCodes) {
  if (!departmentCodes.length) return [];
  try {
    const placeholders = departmentCodes.map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT DISTINCT u.id FROM users u
       INNER JOIN user_departments ud ON u.id = ud.user_id
       WHERE u.tenant_id = ? AND ud.department_code IN (${placeholders}) AND u.status = 'active'`,
      [tenantId, ...departmentCodes],
    );
    return rows.map(r => Number(r.id));
  } catch (e) {
    logger.error(`[RecipientStrategy] 按部门查询失败:`, e.message);
    return [];
  }
}

/**
 * 主入口：解析事件接收人
 *   1. 查 recipient_strategies 缓存
 *   2. 有策略 → 解析出 userId 列表
 *   3. 没策略 → 返回 null（让调用方走默认逻辑）
 *
 * @returns {Promise<number[]|null>} - userId 列表，null 表示无配置
 */
async function resolveRecipients(tenantId, eventCode, payload) {
  if (!eventCode) return null;
  const strategies = await getCachedStrategies(tenantId, eventCode);
  if (!strategies.length) return null;
  return resolveRecipientsFromStrategies(strategies, payload, tenantId);
}

module.exports = {
  // 元数据
  STRATEGY_TYPES,
  STRATEGY_TYPE_MAP,
  // CRUD
  listStrategies,
  getStrategyById,
  createStrategy,
  updateStrategy,
  deleteStrategy,
  batchDelete,
  // 解析
  resolveRecipients,
  resolveRecipientsFromStrategies,
  // 缓存
  clearCache,
  getCachedStrategies,
};
