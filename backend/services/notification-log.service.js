/**
 * 通知发送记录服务
 * 记录每次通知发送的明细，支持查询与追踪
 */
const db = require('../config/database');
const logger = require('../config/logger');

const DEFAULT_PAGE_SIZE = 20;

function safeJsonParse(value, defaultValue = null) {
  if (value == null) return defaultValue;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return defaultValue;
  }
}

function safeJsonStringify(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (e) {
    return null;
  }
}

/**
 * 添加发送记录
 */
async function addLog({
  tenantId,
  ruleId,
  eventCode,
  recipients,
  channel,
  title,
  content,
  status,
  error,
  sentCount = 0,
  totalCount = 0,
}) {
  try {
    await db.execute(
      `INSERT INTO notification_logs
       (tenant_id, rule_id, event_code, recipients, channel, title, content, status, error, sent_count, total_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        tenantId || 0,
        ruleId || null,
        eventCode || null,
        safeJsonStringify(recipients),
        channel,
        title || '',
        content || '',
        status,
        error || null,
        sentCount,
        totalCount,
      ],
    );
  } catch (e) {
    logger.error('[NotificationLog] 写入通知日志失败:', e.message);
  }
}

/**
 * 查询发送记录
 */
async function listLogs({
  tenantId,
  ruleId,
  eventCode,
  channel,
  status,
  keyword,
  startDate,
  endDate,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
} = {}) {
  const conditions = ['l.tenant_id = ?'];
  const params = [tenantId || 0];

  if (ruleId) {
    conditions.push('l.rule_id = ?');
    params.push(ruleId);
  }
  if (eventCode) {
    conditions.push('l.event_code = ?');
    params.push(eventCode);
  }
  if (channel) {
    conditions.push('l.channel = ?');
    params.push(channel);
  }
  if (status) {
    conditions.push('l.status = ?');
    params.push(status);
  }
  if (keyword) {
    conditions.push('(l.title LIKE ? OR l.event_code LIKE ? OR l.error LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (startDate) {
    conditions.push('l.created_at >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('l.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(endDate);
  }

  const where = conditions.join(' AND ');
  const limit = parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE;
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const [[countRows]] = await db.execute(
    `SELECT COUNT(*) AS total FROM notification_logs l WHERE ${where}`,
    params,
  );

  const [rows] = await db.execute(
    `SELECT l.*, r.rule_name, r.process_type
     FROM notification_logs l
     LEFT JOIN notification_rules r ON l.rule_id = r.id
     WHERE ${where}
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    list: rows.map(r => ({
      ...r,
      recipients: safeJsonParse(r.recipients, []),
    })),
    pagination: {
      total: countRows.total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      pages: Math.ceil(countRows.total / limit),
    },
  };
}

/**
 * 统计概览
 */
async function getStats(tenantId, days = 7) {
  const [[totalRows]] = await db.execute(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
     FROM notification_logs
     WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [tenantId || 0, days],
  );

  const [channelRows] = await db.execute(
    `SELECT channel, COUNT(*) AS count
     FROM notification_logs
     WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY channel`,
    [tenantId || 0, days],
  );

  const [eventRows] = await db.execute(
    `SELECT event_code, COUNT(*) AS count
     FROM notification_logs
     WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY event_code
     ORDER BY count DESC
     LIMIT 10`,
    [tenantId || 0, days],
  );

  return {
    total: totalRows.total || 0,
    successCount: totalRows.success_count || 0,
    failedCount: totalRows.failed_count || 0,
    channels: channelRows,
    topEvents: eventRows,
  };
}

module.exports = {
  addLog,
  listLogs,
  getStats,
};
