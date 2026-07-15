/**
 * 用户通知偏好服务
 *
 * 提供：
 *   1. 用户通知偏好的 CRUD
 *   2. 评估函数 shouldDeliver(prefs, urgency, now) → boolean
 *   3. 批量过滤 allowedUserIds（飞书 + 站内共用）
 *
 * 偏好粒度 = (user_id, event_code)：
 *   - event_code = NULL 表示全局偏好（所有事件共用）
 *   - event_code = 'xxx' 表示单事件偏好（覆盖全局）
 *
 * 合并优先级：单事件偏好 > 全局偏好 > 默认（不限时段、不限紧急度）
 *
 * 缓存：
 *   - 1 分钟内存缓存（key = `${userId}:${eventCode}`），减少高频事件触发的 DB 查询
 *   - CRUD 操作后通过 clearCache() 失效
 */
const db = require('../config/database');
const logger = require('../config/logger');

const CACHE_TTL = 60 * 1000; // 1 分钟
const _prefsCache = new Map();

/* ===================== 元数据 ===================== */

const URGENCY_LEVELS = [
  { code: 'low',    name: '一般', order: 0, color: 'default' },
  { code: 'medium', name: '重要', order: 1, color: 'orange' },
  { code: 'high',   name: '紧急', order: 2, color: 'red' },
];

const URGENCY_ORDER = URGENCY_LEVELS.reduce((m, u) => { m[u.code] = u.order; return m; }, {});

const DND_DAY_OPTIONS = [
  { value: '1', label: '周一' },
  { value: '2', label: '周二' },
  { value: '3', label: '周三' },
  { value: '4', label: '周四' },
  { value: '5', label: '周五' },
  { value: '6', label: '周六' },
  { value: '7', label: '周日' },
];

/* ===================== 缓存 ===================== */

function cacheKey(userId, eventCode) {
  return `${userId || 0}:${eventCode || '*'}`;
}

async function getCachedPreferences(userId, eventCode) {
  const key = cacheKey(userId, eventCode);
  const cached = _prefsCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.prefs;
  }
  const prefs = await getMergedPreferences(userId, eventCode);
  _prefsCache.set(key, { prefs, ts: Date.now() });
  return prefs;
}

function clearCache(userId, eventCode) {
  if (userId) {
    if (eventCode) {
      _prefsCache.delete(cacheKey(userId, eventCode));
    } else {
      // 清该用户所有缓存（全部 eventCode）
      for (const k of _prefsCache.keys()) {
        if (k.startsWith(`${userId}:`)) _prefsCache.delete(k);
      }
    }
  } else {
    _prefsCache.clear();
  }
}

/* ===================== 评估函数 ===================== */

/**
 * 单条偏好评估
 * @param {Object} prefs - 单条偏好对象
 * @param {string} urgency - 事件紧急度 (low/medium/high)
 * @param {Date} [now] - 当前时间（测试用）
 * @returns {boolean} - true = 应该推送, false = 应该静默
 */
function shouldDeliverByPrefs(prefs, urgency, now) {
  if (!prefs) return true; // 无偏好 = 不限
  if (prefs.enabled === false || prefs.enabled === 0) return false;

  // 紧急度阈值过滤
  const eventOrder = URGENCY_ORDER[urgency] ?? 0;
  const thresholdOrder = URGENCY_ORDER[prefs.urgency_threshold] ?? 0;
  if (eventOrder < thresholdOrder) return false;

  // 勿扰时段过滤
  if (prefs.dndEnabled && prefs.dndStartTime && prefs.dndEndTime) {
    const nowTime = now || new Date();
    const day = nowTime.getDay() === 0 ? 7 : nowTime.getDay(); // 周日 0 → 7
    const dndDays = (prefs.dndDays || '1,2,3,4,5,6,7').split(',').map(s => s.trim());
    if (dndDays.includes(String(day))) {
      // 解析时间到分钟数
      const nowMin = nowTime.getHours() * 60 + nowTime.getMinutes();
      const [sh, sm] = prefs.dndStartTime.split(':').map(Number);
      const [eh, em] = prefs.dndEndTime.split(':').map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      const inDnd = start <= end
        ? (nowMin >= start && nowMin < end)
        : (nowMin >= start || nowMin < end); // 跨午夜
      if (inDnd) {
        const overrideOrder = URGENCY_ORDER[prefs.dndOverrideUrgency] ?? 2;
        if (eventOrder < overrideOrder) return false; // 紧急度不够，突破失败
      }
    }
  }

  return true;
}

/**
 * 批量过滤用户列表
 * @param {number[]} userIds
 * @param {string} eventCode
 * @param {string} urgency
 * @param {Date} [now]
 * @returns {Promise<{allowed: number[], filtered: Array<{userId: number, reason: string}>}>}
 */
async function filterUsersByPreferences(userIds, eventCode, urgency, now) {
  if (!userIds || !userIds.length) return { allowed: [], filtered: [] };
  const allowed = [];
  const filtered = [];
  // 并行查询各用户的偏好
  const checks = await Promise.all(
    userIds.map(async uid => {
      const prefs = await getCachedPreferences(uid, eventCode);
      const ok = shouldDeliverByPrefs(prefs, urgency, now);
      return { userId: uid, prefs, ok };
    }),
  );
  for (const { userId, prefs, ok } of checks) {
    if (ok) {
      allowed.push(Number(userId));
    } else {
      filtered.push({ userId: Number(userId), reason: getSilentReason(prefs, urgency, now) });
    }
  }
  return { allowed, filtered };
}

function getSilentReason(prefs, urgency, now) {
  if (!prefs) return 'no_prefs';
  if (prefs.enabled === false || prefs.enabled === 0) return 'disabled';
  if (URGENCY_ORDER[urgency] < (URGENCY_ORDER[prefs.urgencyThreshold] ?? 0)) {
    return 'urgency_below_threshold';
  }
  if (prefs.dndEnabled) {
    const nowTime = now || new Date();
    const day = nowTime.getDay() === 0 ? 7 : nowTime.getDay();
    const dndDays = (prefs.dndDays || '1,2,3,4,5,6,7').split(',').map(s => s.trim());
    if (dndDays.includes(String(day))) {
      const nowMin = nowTime.getHours() * 60 + nowTime.getMinutes();
      const [sh, sm] = prefs.dndStartTime.split(':').map(Number);
      const [eh, em] = prefs.dndEndTime.split(':').map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      const inDnd = start <= end
        ? (nowMin >= start && nowMin < end)
        : (nowMin >= start || nowMin < end);
      if (inDnd) {
        const overrideOrder = URGENCY_ORDER[prefs.dndOverrideUrgency] ?? 2;
        if (URGENCY_ORDER[urgency] < overrideOrder) return 'dnd_active';
      }
    }
  }
  return 'unknown';
}

/* ===================== CRUD ===================== */

function parseRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    eventCode: row.event_code,
    enabled: !!row.enabled,
    urgencyThreshold: row.urgency_threshold || 'low',
    dndEnabled: !!row.dnd_enabled,
    dndStartTime: row.dnd_start_time,
    dndEndTime: row.dnd_end_time,
    dndDays: row.dnd_days || '1,2,3,4,5,6,7',
    dndOverrideUrgency: row.dnd_override_urgency || 'high',
    desktopEnabled: !!row.desktop_enabled,
    toastEnabled: !!row.toast_enabled,
    remark: row.remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 获取用户的合并偏好（全局 + 单事件）
 * 单事件覆盖全局
 */
async function getMergedPreferences(userId, eventCode) {
  if (!userId) return null;
  const conditions = ['user_id = ?'];
  const params = [userId];
  if (eventCode) {
    conditions.push('(event_code IS NULL OR event_code = ?)');
    params.push(eventCode);
  } else {
    conditions.push('event_code IS NULL');
  }
  const [rows] = await db.execute(
    `SELECT * FROM notification_preferences
     WHERE ${conditions.join(' AND ')}
     ORDER BY event_code IS NULL ASC, id DESC LIMIT 1`,
    params,
  );
  if (!rows.length) return null;
  // 单事件偏好存在则用单事件，否则用全局
  if (eventCode) {
    const specific = rows.find(r => r.event_code === eventCode);
    if (specific) return parseRow(specific);
    const global = rows.find(r => r.event_code === null);
    return global ? parseRow(global) : null;
  }
  return parseRow(rows[0]);
}

async function listPreferences({ userId, tenantId, eventCode, page = 1, pageSize = 50 } = {}) {
  const conditions = ['1=1'];
  const params = [];
  if (userId !== undefined) {
    conditions.push('user_id = ?');
    params.push(userId);
  }
  if (tenantId !== undefined) {
    conditions.push('tenant_id = ?');
    params.push(tenantId || 0);
  }
  if (eventCode !== undefined) {
    if (eventCode === null || eventCode === '') {
      conditions.push('event_code IS NULL');
    } else {
      conditions.push('event_code = ?');
      params.push(eventCode);
    }
  }
  const where = conditions.join(' AND ');
  const limit = parseInt(pageSize, 10) || 50;
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;
  const [[countRows]] = await db.execute(
    `SELECT COUNT(*) AS total FROM notification_preferences WHERE ${where}`,
    params,
  );
  const [rows] = await db.execute(
    `SELECT * FROM notification_preferences WHERE ${where}
     ORDER BY user_id, event_code IS NULL DESC, id ASC
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

async function getPreferenceById(id) {
  const [rows] = await db.execute(
    `SELECT * FROM notification_preferences WHERE id = ?`,
    [id],
  );
  return rows.length ? parseRow(rows[0]) : null;
}

async function upsertPreference(data) {
  const {
    user_id, tenant_id = 0, event_code = null,
    enabled = 1, urgency_threshold = 'low',
    dnd_enabled = 0, dnd_start_time = null, dnd_end_time = null, dnd_days = '1,2,3,4,5,6,7',
    dnd_override_urgency = 'high',
    desktop_enabled = 1, toast_enabled = 1,
    remark = null,
  } = data;
  if (!user_id) throw new Error('user_id 必填');
  if (!URGENCY_ORDER.hasOwnProperty(urgency_threshold)) throw new Error('urgency_threshold 必须是 low/medium/high');
  if (!URGENCY_ORDER.hasOwnProperty(dnd_override_urgency)) throw new Error('dnd_override_urgency 必须是 low/medium/high');
  if (dnd_enabled && (!dnd_start_time || !dnd_end_time)) {
    throw new Error('启用勿扰时必须设置开始和结束时间');
  }
  const eventKey = event_code || null;

  // upsert：用 UNIQUE KEY (user_id, event_code) 判断
  const [existing] = await db.execute(
    `SELECT id FROM notification_preferences WHERE user_id = ? AND ${eventKey ? 'event_code = ?' : 'event_code IS NULL'}`,
    eventKey ? [user_id, eventKey] : [user_id],
  );
  if (existing.length) {
    const id = existing[0].id;
    await db.execute(
      `UPDATE notification_preferences SET
       enabled = ?, urgency_threshold = ?, dnd_enabled = ?, dnd_start_time = ?, dnd_end_time = ?,
       dnd_days = ?, dnd_override_urgency = ?, desktop_enabled = ?, toast_enabled = ?, remark = ?,
       updated_at = NOW()
       WHERE id = ?`,
      [enabled ? 1 : 0, urgency_threshold, dnd_enabled ? 1 : 0, dnd_start_time, dnd_end_time,
       dnd_days, dnd_override_urgency, desktop_enabled ? 1 : 0, toast_enabled ? 1 : 0, remark, id],
    );
    clearCache(user_id, event_code);
    return getPreferenceById(id);
  }
  const [r] = await db.execute(
    `INSERT INTO notification_preferences
     (user_id, tenant_id, event_code, enabled, urgency_threshold, dnd_enabled, dnd_start_time, dnd_end_time,
      dnd_days, dnd_override_urgency, desktop_enabled, toast_enabled, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user_id, tenant_id || 0, eventKey, enabled ? 1 : 0, urgency_threshold,
     dnd_enabled ? 1 : 0, dnd_start_time, dnd_end_time, dnd_days, dnd_override_urgency,
     desktop_enabled ? 1 : 0, toast_enabled ? 1 : 0, remark],
  );
  clearCache(user_id, event_code);
  return getPreferenceById(r.insertId);
}

async function deletePreference(id, userId) {
  const existing = await getPreferenceById(id);
  if (!existing) return false;
  if (userId && existing.userId !== Number(userId)) return false;
  await db.execute(`DELETE FROM notification_preferences WHERE id = ?`, [id]);
  clearCache(existing.userId, existing.eventCode);
  return true;
}

/**
 * 获取默认偏好（所有字段都给一个合理的默认值）
 * 任何 user 即使没配过偏好，也用这个默认值评估
 */
function getDefaultPreferences() {
  return {
    enabled: true,
    urgencyThreshold: 'low',
    dndEnabled: false,
    dndStartTime: null,
    dndEndTime: null,
    dndDays: '1,2,3,4,5,6,7',
    dndOverrideUrgency: 'high',
    desktopEnabled: true,
    toastEnabled: true,
  };
}

/**
 * 包装评估：内部自动获取偏好（无则用默认）
 */
async function shouldDeliver(userId, eventCode, urgency, now) {
  if (!userId) return true;
  const prefs = await getCachedPreferences(userId, eventCode);
  const effective = prefs || getDefaultPreferences();
  return shouldDeliverByPrefs(effective, urgency, now);
}

module.exports = {
  // 元数据
  URGENCY_LEVELS,
  URGENCY_ORDER,
  DND_DAY_OPTIONS,
  // CRUD
  listPreferences,
  getPreferenceById,
  getMergedPreferences,
  upsertPreference,
  deletePreference,
  // 评估
  shouldDeliver,
  shouldDeliverByPrefs,
  filterUsersByPreferences,
  getDefaultPreferences,
  getSilentReason,
  // 缓存
  clearCache,
  getCachedPreferences,
};
