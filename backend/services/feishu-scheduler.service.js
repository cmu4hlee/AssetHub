/**
 * 飞书定时通知调度服务
 *
 * 功能：
 *   1. 智能预警定时扫描：每小时扫描一次高紧急度预警（保养到期/资质到期/检验到期/安全检测到期/开机率异常），推送飞书卡片
 *   2. 定时报表推送：每日早上 9 点推送资产/工单/盘点/预警汇总报表
 *
 * 机制：基于 setInterval，无需额外依赖
 * 去重：预警推送通过内存 Set 记录当日已推送的 alertId，避免重复
 */
const db = require('../config/database');
const logger = require('../config/logger');
const { buildCard, sendCardToOpenIds, resolveOpenIds } = require('./feishu-notification.service');
const intelligentAlertService = require('./intelligent-alert-service');
const tenantConfig = require('./tenant-config.service');

// 全局开关
const SCHEDULER_ENABLED = process.env.FEISHU_SCHEDULER_ENABLED !== 'false';
// 预警扫描间隔（默认 1 小时）
const ALERT_SCAN_INTERVAL = parseInt(process.env.FEISHU_ALERT_SCAN_INTERVAL || '3600000', 10);
// 报表推送时间：每天 9:00（用 setInterval + 首次延迟计算）
const REPORT_HOUR = 9;

// 当日已推送预警 ID 集合（去重）
const pushedAlertIds = new Set();
// 上次清理日期
let lastCleanupDate = new Date().toDateString();

/**
 * 清理过期的去重记录（每天清理一次）
 */
function cleanupPushedAlertsIfNeeded() {
  const today = new Date().toDateString();
  if (today !== lastCleanupDate) {
    pushedAlertIds.clear();
    lastCleanupDate = today;
  }
}

/**
 * 获取租户列表
 * @returns {Promise<Array<{id:number, tenant_name:string}>>}
 */
async function getTenants() {
  try {
    const [rows] = await db.execute('SELECT id, tenant_name FROM tenants WHERE status = "active" ORDER BY id');
    return rows.length ? rows : [{ id: tenantConfig.DEFAULT_TENANT_ID, tenant_name: '默认租户' }];
  } catch (e) {
    // tenants 表可能不存在，兜底用默认租户
    return [{ id: tenantConfig.DEFAULT_TENANT_ID, tenant_name: '默认租户' }];
  }
}

/**
 * 获取租户下所有管理员用户（用于接收报表）
 * @param {number} tenantId
 * @returns {Promise<number[]>} 用户 ID 数组
 */
async function getAdminUserIds(tenantId) {
  try {
    const [rows] = await db.execute(
      `SELECT DISTINCT u.id FROM users u
       INNER JOIN user_tenant_roles utr ON u.id = utr.user_id
       WHERE utr.tenant_id = ? AND utr.role IN ('admin', 'system_admin', 'asset_admin')
         AND u.status = 'active'`,
      [tenantId],
    );
    return rows.map(r => r.id);
  } catch (e) {
    logger.warn('[FeishuScheduler] 查询管理员失败:', e.message);
    return [];
  }
}

/* ===================== 智能预警定时扫描 ===================== */

/**
 * 扫描单个租户的高紧急度预警并推送飞书通知
 */
async function scanAndPushAlertsForTenant(tenantId) {
  const checks = [
    { name: '保养到期', fn: () => intelligentAlertService.checkMaintenanceDue(tenantId) },
    { name: '资质到期', fn: () => intelligentAlertService.checkQualificationExpire(tenantId) },
    { name: '检验到期', fn: () => intelligentAlertService.checkInspectionDue(tenantId) },
    { name: '安全检测到期', fn: () => intelligentAlertService.checkSafetyExpire(tenantId) },
    { name: '开机率异常', fn: () => intelligentAlertService.checkUptimeLow(tenantId) },
  ];

  const highAlerts = [];
  for (const check of checks) {
    try {
      const alerts = await check.fn();
      const highOnes = (alerts || []).filter(a => a.urgency === 'high');
      highAlerts.push(...highOnes);
    } catch (e) {
      logger.warn(`[FeishuScheduler] 租户${tenantId} ${check.name}预警检查失败:`, e.message);
    }
  }

  if (highAlerts.length === 0) return 0;

  // 去重：跳过当日已推送的
  const newAlerts = highAlerts.filter(a => !pushedAlertIds.has(a.id));
  if (newAlerts.length === 0) return 0;

  // 查管理员作为接收人
  const adminIds = await getAdminUserIds(tenantId);
  const openIds = await resolveOpenIds({ toUserIds: adminIds });
  if (openIds.length === 0) {
    logger.info(`[FeishuScheduler] 租户${tenantId} 无可推送的管理员飞书账号，跳过`);
    return 0;
  }

  // 按预警类型分组，每种类型发一张卡片
  const urgencyColor = { high: 'red', medium: 'orange', low: 'blue' };
  let pushed = 0;
  for (const alert of newAlerts) {
    const card = buildCard({
      title: `⚠️ 高紧急度预警：${alert.title}`,
      color: urgencyColor[alert.urgency] || 'red',
      fields: [
        { label: '预警类型', value: alert.type || '-' },
        { label: '紧急程度', value: alert.urgency || 'high' },
      ],
      content: alert.content || '',
      actionUrl: alert.actionUrl || '',
      actionText: '查看详情',
    });
    try {
      await sendCardToOpenIds(openIds, card, tenantId);
      pushedAlertIds.add(alert.id);
      pushed++;
    } catch (e) {
      logger.error(`[FeishuScheduler] 推送预警 ${alert.id} 失败:`, e.message);
    }
  }

  logger.info(`[FeishuScheduler] 租户${tenantId} 推送 ${pushed} 条高紧急度预警`);
  return pushed;
}

/**
 * 扫描所有租户的预警
 */
async function scanAllAlerts() {
  cleanupPushedAlertsIfNeeded();
  logger.info('[FeishuScheduler] 开始扫描智能预警...');
  try {
    const tenants = await getTenants();
    for (const tenant of tenants) {
      await scanAndPushAlertsForTenant(tenant.id);
    }
  } catch (e) {
    logger.error('[FeishuScheduler] 预警扫描失败:', e.message);
  }
}

/* ===================== 定时报表推送 ===================== */

/**
 * 获取资产统计
 */
async function getAssetStats(tenantId) {
  try {
    const [rows] = await db.execute(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = '在用' THEN 1 ELSE 0 END) as in_use,
        SUM(CASE WHEN status = '闲置' THEN 1 ELSE 0 END) as idle,
        SUM(CASE WHEN status = '维修' THEN 1 ELSE 0 END) as maintenance,
        SUM(CASE WHEN status = '报废' THEN 1 ELSE 0 END) as scrapped
       FROM assets WHERE tenant_id = ?`,
      [tenantId],
    );
    return rows[0] || {};
  } catch (e) {
    return {};
  }
}

/**
 * 获取工单统计
 */
async function getWorkOrderStats(tenantId) {
  try {
    const [rows] = await db.execute(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM work_orders WHERE tenant_id = ?`,
      [tenantId],
    );
    return rows[0] || {};
  } catch (e) {
    // work_orders 表可能不存在，尝试旧表
    try {
      const [rows] = await db.execute(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
         FROM maintenance_workorders WHERE tenant_id = ?`,
        [tenantId],
      );
      return rows[0] || {};
    } catch (_) {
      return {};
    }
  }
}

/**
 * 获取盘点任务统计
 */
async function getInventoryTaskStats(tenantId) {
  try {
    const [rows] = await db.execute(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = '待分配' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = '进行中' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) as completed
       FROM inventory_tasks WHERE tenant_id = ?`,
      [tenantId],
    );
    return rows[0] || {};
  } catch (e) {
    return {};
  }
}

/**
 * 获取预警概览
 */
async function getAlertSummary(tenantId) {
  try {
    const result = await intelligentAlertService.getAlertOverview(tenantId);
    if (result && result.success && result.data) {
      return result.data;
    }
  } catch (e) {}
  return null;
}

/**
 * 生成并发送每日报表
 */
async function sendDailyReport(tenantId) {
  logger.info(`[FeishuScheduler] 生成租户${tenantId}每日报表...`);

  const [assetStats, woStats, invStats, alertSummary] = await Promise.all([
    getAssetStats(tenantId),
    getWorkOrderStats(tenantId),
    getInventoryTaskStats(tenantId),
    getAlertSummary(tenantId),
  ]);

  const fields = [];
  if (assetStats.total != null) {
    fields.push({ label: '资产总数', value: String(assetStats.total || 0) });
    fields.push({ label: '在用/闲置/维修', value: `${assetStats.in_use || 0}/${assetStats.idle || 0}/${assetStats.maintenance || 0}` });
  }
  if (woStats.total != null) {
    fields.push({ label: '工单总数', value: String(woStats.total || 0) });
    fields.push({ label: '待处理/已完成', value: `${woStats.pending || 0}/${woStats.completed || 0}` });
  }
  if (invStats.total != null) {
    fields.push({ label: '盘点任务', value: String(invStats.total || 0) });
    fields.push({ label: '进行中/已完成', value: `${invStats.in_progress || 0}/${invStats.completed || 0}` });
  }
  if (alertSummary && alertSummary.total != null) {
    fields.push({ label: '活跃预警', value: String(alertSummary.total || 0) });
    fields.push({ label: '高紧急度', value: String(
      (alertSummary.maintenance?.urgent || 0) +
      (alertSummary.qualification?.urgent || 0) +
      (alertSummary.inspection?.urgent || 0) +
      (alertSummary.safety?.urgent || 0) +
      (alertSummary.uptime?.urgent || 0)
    ) });
  }

  if (fields.length === 0) {
    logger.info(`[FeishuScheduler] 租户${tenantId} 无报表数据，跳过`);
    return;
  }

  const card = buildCard({
    title: `📊 每日运营报表 - ${new Date().toLocaleDateString('zh-CN')}`,
    color: 'blue',
    fields,
    content: `本报表由系统自动生成，汇总截至 ${new Date().toLocaleString('zh-CN')} 的运营数据。`,
  });

  // 发送给管理员
  const adminIds = await getAdminUserIds(tenantId);
  const openIds = await resolveOpenIds({ toUserIds: adminIds });
  if (openIds.length === 0) {
    logger.info(`[FeishuScheduler] 租户${tenantId} 无管理员飞书账号，跳过报表推送`);
    return;
  }

  await sendCardToOpenIds(openIds, card, tenantId);
  logger.info(`[FeishuScheduler] 租户${tenantId} 每日报表已推送到 ${openIds.length} 位管理员`);
}

/**
 * 推送所有租户的每日报表
 */
async function sendAllDailyReports() {
  logger.info('[FeishuScheduler] 开始推送每日报表...');
  try {
    const tenants = await getTenants();
    for (const tenant of tenants) {
      await sendDailyReport(tenant.id);
    }
  } catch (e) {
    logger.error('[FeishuScheduler] 每日报表推送失败:', e.message);
  }
}

/* ===================== 调度器管理 ===================== */

let alertTimer = null;
let reportTimer = null;

/**
 * 计算到下次报表推送时间的延迟（毫秒）
 * 默认每天 9:00 推送
 */
function getReportDelay() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(REPORT_HOUR, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next - now;
}

/**
 * 启动定时调度
 */
function startScheduler() {
  if (!SCHEDULER_ENABLED) {
    logger.info('[FeishuScheduler] 定时调度已通过环境变量关闭');
    return;
  }

  // 1. 智能预警扫描：启动后 30 秒首次执行，之后按间隔循环
  setTimeout(() => {
    scanAllAlerts().catch(e => logger.error('[FeishuScheduler] 首次预警扫描失败:', e.message));
    alertTimer = setInterval(() => {
      scanAllAlerts().catch(e => logger.error('[FeishuScheduler] 预警扫描失败:', e.message));
    }, ALERT_SCAN_INTERVAL);
  }, 30000);

  // 2. 每日报表：计算到下次 9:00 的延迟，之后每 24 小时循环
  const firstDelay = getReportDelay();
  setTimeout(() => {
    sendAllDailyReports().catch(e => logger.error('[FeishuScheduler] 首次报表推送失败:', e.message));
    reportTimer = setInterval(() => {
      sendAllDailyReports().catch(e => logger.error('[FeishuScheduler] 报表推送失败:', e.message));
    }, 24 * 60 * 60 * 1000);
  }, firstDelay);

  logger.info(`[FeishuScheduler] 定时调度已启动：预警扫描间隔 ${ALERT_SCAN_INTERVAL / 1000}秒，报表推送每日 ${REPORT_HOUR}:00`);
}

/**
 * 停止定时调度
 */
function stopScheduler() {
  if (alertTimer) { clearInterval(alertTimer); alertTimer = null; }
  if (reportTimer) { clearInterval(reportTimer); reportTimer = null; }
  logger.info('[FeishuScheduler] 定时调度已停止');
}

module.exports = {
  startScheduler,
  stopScheduler,
  scanAllAlerts,
  sendAllDailyReports,
  scanAndPushAlertsForTenant,
  sendDailyReport,
};
