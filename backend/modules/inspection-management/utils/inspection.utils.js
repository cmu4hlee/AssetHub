/**
 * 巡检模块工具方法
 * 编号生成、跨租户校验、序列号等
 */
const db = require('../../../config/database');
const logger = require('../../../config/logger');

/**
 * 用事务+行锁生成全局唯一编号,避免 Math.random 撞号
 * 格式:PREFIX-YYYYMMDD-XXXXX
 */
async function generateSequenceCode(tenantId, seqKey, prefix) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const year = new Date().getFullYear();
    // 行锁：FOR UPDATE
    await conn.execute(
      `INSERT INTO inspection_sequences (tenant_id, seq_key, seq_year, current_value)
       VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE tenant_id = tenant_id`,
      [tenantId, seqKey, year],
    );
    const [rows] = await conn.execute(
      `SELECT current_value FROM inspection_sequences
       WHERE tenant_id = ? AND seq_key = ? AND seq_year = ?
       FOR UPDATE`,
      [tenantId, seqKey, year],
    );
    const next = (rows[0]?.current_value || 0) + 1;
    await conn.execute(
      `UPDATE inspection_sequences
       SET current_value = ?
       WHERE tenant_id = ? AND seq_key = ? AND seq_year = ?`,
      [next, tenantId, seqKey, year],
    );
    await conn.commit();

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return `${prefix}-${dateStr}-${String(next).padStart(5, '0')}`;
  } catch (error) {
    await conn.rollback();
    logger.error('生成巡检编号失败', { error: error.message, tenantId, seqKey });
    // 退化方案：时间戳+随机
    const ts = Date.now().toString(36).toUpperCase();
    return `${prefix}-${ts}`;
  } finally {
    conn.release();
  }
}

/**
 * 校验资产是否属于当前租户
 */
async function assertTenantAsset(assetId, tenantId) {
  if (!assetId) return true;
  const [rows] = await db.execute(
    'SELECT id FROM assets WHERE id = ? AND tenant_id = ? LIMIT 1',
    [assetId, tenantId],
  );
  return rows.length > 0;
}

/**
 * 校验巡检任务是否属于当前租户
 */
async function assertTenantTask(taskId, tenantId) {
  if (!taskId) return true;
  const [rows] = await db.execute(
    'SELECT id FROM inspection_tasks WHERE id = ? AND tenant_id = ? LIMIT 1',
    [taskId, tenantId],
  );
  return rows.length > 0;
}

/**
 * 校验模板是否属于当前租户
 */
async function assertTenantTemplate(templateId, tenantId) {
  if (!templateId) return true;
  const [rows] = await db.execute(
    'SELECT id FROM inspection_templates WHERE id = ? AND tenant_id = ? LIMIT 1',
    [templateId, tenantId],
  );
  return rows.length > 0;
}

/**
 * 写问题操作历史
 */
async function logIssueHistory(conn, params) {
  await conn.execute(
    `INSERT INTO inspection_issue_histories
      (tenant_id, issue_id, action, operator_id, operator_name, from_status, to_status, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.tenantId,
      params.issueId,
      params.action,
      params.operatorId || null,
      params.operatorName || null,
      params.fromStatus || null,
      params.toStatus || null,
      params.remark || null,
    ],
  );
}

/**
 * 创建巡检通知
 */
async function createNotification(params) {
  try {
    await db.execute(
      `INSERT INTO inspection_notifications
        (tenant_id, notify_type, ref_id, ref_code, recipient_id, recipient_name, title, content)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.tenantId,
        params.notifyType,
        params.refId,
        params.refCode || null,
        params.recipientId,
        params.recipientName || null,
        params.title,
        params.content || null,
      ],
    );
  } catch (error) {
    logger.error('创建巡检通知失败', { error: error.message });
  }
}

module.exports = {
  generateSequenceCode,
  assertTenantAsset,
  assertTenantTask,
  assertTenantTemplate,
  logIssueHistory,
  createNotification,
};
