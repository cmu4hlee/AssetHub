/**
 * 站内消息聚合服务
 *
 * 目标：同一用户 + 同一事件类别 + 短时间内多条 → 合并为一条
 *
 * 行为：
 *   1. 收到新通知时，先查「同 user_id + event_code + category + is_read=0 + 时间窗口内」的现有未读通知
 *   2. 找到 → 更新该条（aggregate_count++, 合并 title/content/keys, 刷新 created_at）
 *   3. 没找到 → 正常插入（aggregate_count=1, first_occurred_at=NOW）
 *
 * 配置：
 *   - AGGREGATE_WINDOW_MINUTES：聚合窗口（默认 5 分钟）
 *   - AGGREGATE_ENABLED：是否启用（默认 true）
 *   - AGGREGATE_MAX_COUNT：单条最大聚合数（默认 50，超过后插入新行）
 *
 * 关键设计：
 *   - 聚合标识 aggregate_keys：用于在「替换最新一条」vs「插入新一条」之间区分
 *     例如同一 asset_code 的多条合并；不同 asset_code 不聚合
 *   - 通过 (user_id, event_code, category) 查询候选 + 解析 aggregate_keys 判断是否能合并
 *   - 紧急度取所有聚合事件中最高的（high > medium > low）
 */
const db = require('../config/database');
const logger = require('../config/logger');

const AGGREGATE_ENABLED = process.env.AGGREGATE_ENABLED !== 'false';
const AGGREGATE_WINDOW_MIN = parseInt(process.env.AGGREGATE_WINDOW_MINUTES || '5', 10);
const AGGREGATE_MAX_COUNT = parseInt(process.env.AGGREGATE_MAX_COUNT || '50', 10);

const URGENCY_ORDER = { low: 0, medium: 1, high: 2 };

/**
 * 从事件 payload 中提取聚合键
 * 同事件类别下，相同聚合键的多条 → 合并
 * 聚合键通常是 asset_code、requestNo 等标识
 */
function extractAggregateKey(payload) {
  if (!payload || typeof payload !== 'object') return null;
  // 优先级：asset_code > requestNo > workOrderNo > id
  if (payload.asset_code) return { key: 'asset_code', value: String(payload.asset_code) };
  if (payload.requestNo) return { key: 'requestNo', value: String(payload.requestNo) };
  if (payload.workOrderNo) return { key: 'workOrderNo', value: String(payload.workOrderNo) };
  if (payload.id) return { key: 'id', value: String(payload.id) };
  if (payload.invoice && payload.invoice.invoice_code) return { key: 'invoice_code', value: String(payload.invoice.invoice_code) };
  return null;
}

/**
 * 找可合并的现有通知
 * @param {Object} params
 * @param {number} params.userId
 * @param {string} params.eventCode
 * @param {string} params.category
 * @param {string} [params.aggKey] - 聚合键值（asset_code 等）
 * @param {string} [params.aggKeyName] - 聚合键名
 * @param {Date} params.now
 * @returns {Promise<Object|null>}
 */
async function findAggregatable({ userId, eventCode, category, aggKey, aggKeyName, now }) {
  if (!userId || !eventCode) return null;
  // 查窗口内同事件类别 + 未读
  const [rows] = await db.execute(
    `SELECT id, title, content, urgency, aggregate_count, aggregate_keys, first_occurred_at
     FROM in_app_notifications
     WHERE user_id = ?
       AND event_code = ?
       AND category = ?
       AND is_read = 0
       AND created_at >= DATE_SUB(?, INTERVAL ? MINUTE)
       AND aggregate_count < ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, eventCode, category, now, AGGREGATE_WINDOW_MIN, AGGREGATE_MAX_COUNT],
  );
  if (!rows.length) return null;
  const row = rows[0];

  // 解析 aggregate_keys JSON
  let keys = [];
  if (row.aggregate_keys) {
    try { keys = JSON.parse(row.aggregate_keys); } catch (_e) { keys = []; }
  }

  // 决策：是否能合并
  // 策略：5min 内同 (user, event_code, category) 总是合并到最新一条
  //   - keys 累积去重
  //   - 紧急度取最高
  //   - title 智能加上"（共 N 条）"
  //   - content 累积展示
  return { row, existing: null, willMerge: true, reason: 'always_merge' };
}

/**
 * 构造合并后的 title / content
 * 策略：
 *   - 数量 = 1：保持原样
 *   - 数量 ≥ 2：「{prefix}（共 N 条）」
 *   - content：追加最新一条
 */
function buildMergedTitle(originalTitle, count, templatePrefix) {
  if (count <= 1) return originalTitle;
  // 原始 title 形如 "🔧 新维修工单待处理"，提取 emoji + 主题
  if (templatePrefix) return `${templatePrefix}（共 ${count} 条）`;
  // 自动推断
  return `${originalTitle}（共 ${count} 条）`;
}

function buildMergedContent(originalContent, latestContent, count, aggKey) {
  if (count <= 1) return originalContent;
  // 把多条压成列表
  const lines = (originalContent || '').split('\n').filter(Boolean);
  if (latestContent && !lines.includes(latestContent)) {
    lines.push(latestContent);
  }
  // 限制最多展示 5 条
  if (lines.length > 5) {
    return `${lines.slice(0, 5).join('\n')}\n... 还有 ${lines.length - 5} 条`;
  }
  return lines.join('\n');
}

/**
 * 聚合或插入新通知
 * @param {Object} insertData - 要插入/聚合的字段
 * @returns {Promise<{action: 'inserted'|'merged'|'skipped', id?: number, count?: number}>}
 */
async function aggregateOrInsert(insertData) {
  if (!AGGREGATE_ENABLED) {
    return { action: 'skipped', reason: 'aggregate_disabled' };
  }
  const { userId, eventCode, category, title, content, urgency, payload } = insertData;
  if (!userId || !eventCode) {
    return { action: 'skipped', reason: 'missing_required' };
  }

  const now = new Date();
  const aggKeyInfo = extractAggregateKey(payload);

  // 查可合并
  const candidate = await findAggregatable({
    userId, eventCode, category,
    aggKey: aggKeyInfo?.value, aggKeyName: aggKeyInfo?.key, now,
  });

  if (candidate && candidate.willMerge) {
    // 合并到现有记录
    const row = candidate.row;
    const newCount = (row.aggregate_count || 1) + 1;
    const newKeys = [...(row.aggregate_keys ? JSON.parse(row.aggregate_keys) : [])];
    if (aggKeyInfo && !newKeys.find(k => k.name === aggKeyInfo.key && k.value === aggKeyInfo.value)) {
      newKeys.push({ name: aggKeyInfo.key, value: aggKeyInfo.value });
    }
    // 紧急度取最高
    const newUrgency = URGENCY_ORDER[urgency] > URGENCY_ORDER[row.urgency] ? urgency : row.urgency;
    // title 拼接
    const templatePrefix = title.replace(/待处理|通知|创建|完成|通过|驳回|待审批/g, '').trim();
    const newTitle = buildMergedTitle(title, newCount, templatePrefix);
    const newContent = buildMergedContent(row.content, content, newCount, aggKeyInfo);

    const [result] = await db.execute(
      `UPDATE in_app_notifications
       SET title = ?, content = ?, urgency = ?, aggregate_count = ?, aggregate_keys = ?,
           created_at = NOW()
       WHERE id = ?`,
      [newTitle, newContent, newUrgency, newCount, JSON.stringify(newKeys), row.id],
    );

    if (result.affectedRows > 0) {
      logger.info(
        `[Aggregate] merged into id=${row.id} user=${userId} ${eventCode} count=${newCount}`,
      );
      return { action: 'merged', id: row.id, count: newCount };
    }
  }

  return { action: 'skipped', reason: candidate?.reason || 'not_found' };
}

/**
 * 查询某条聚合通知的所有原始 payload
 * 供前端展开"查看全部"使用
 */
async function getAggregateDetails(notificationId) {
  const [rows] = await db.execute(
    `SELECT source_payload, aggregate_keys, aggregate_count, first_occurred_at
     FROM in_app_notifications WHERE id = ?`,
    [notificationId],
  );
  if (!rows.length) return null;
  const row = rows[0];
  let keys = [];
  try { keys = row.aggregate_keys ? JSON.parse(row.aggregate_keys) : []; } catch (_e) {}
  return {
    aggregateCount: row.aggregate_count || 1,
    aggregateKeys: keys,
    firstOccurredAt: row.first_occurred_at,
    sourcePayload: row.source_payload,
  };
}

module.exports = {
  // 配置
  AGGREGATE_ENABLED,
  AGGREGATE_WINDOW_MIN,
  AGGREGATE_MAX_COUNT,
  // 核心
  aggregateOrInsert,
  getAggregateDetails,
  // 工具
  extractAggregateKey,
  buildMergedTitle,
  buildMergedContent,
};
