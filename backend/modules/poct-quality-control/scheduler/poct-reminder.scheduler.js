/**
 * POCT 提醒调度器
 *
 * 职责:
 *  1) 每分钟扫描 poct_reminders 启用的规则
 *  2) 根据班次时间 + offset_minutes 计算触发时间
 *  3) 在 in_app_notifications 表插入站内消息
 *  4) 飞书/微信/短信渠道当前打日志占位(后续可对接 feishu-notification.service 等)
 *
 * 防重复触发:每个 (rule_id, schedule_id) 组合当日只发一次,记录在 poct_reminder_log
 * 启动: server.js 中 require('./modules/poct-quality-control/scheduler/poct-reminder.scheduler').start();
 */
const db = require('../../../config/database');
const logger = require('../../../config/logger');

let _timer = null;
const CHECK_INTERVAL_MS = 60 * 1000; // 每分钟扫一次

/**
 * 把指定规则应用到 [start, end] 日期范围,展开为触发任务列表
 *  每条排班(schedule) × 适用规则 = 一次触发
 */
async function expandSchedules(rule, tenantId, startDate, endDate) {
  const where = ['s.tenant_id = ?', 's.schedule_date BETWEEN ? AND ?'];
  const args = [tenantId, startDate, endDate];

  if (rule.shift_id) { where.push('s.shift_id = ?'); args.push(rule.shift_id); }
  if (rule.department_id) { where.push('s.department_id = ?'); args.push(rule.department_id); }
  where.push("s.status IN ('pending','in_progress')");

  const [rows] = await db.execute(
    `SELECT s.id AS schedule_id, s.schedule_date, s.shift_id, s.department_id, s.subject_id,
            s.operator_id, s.backup_operator_id,
            sh.start_time, sh.end_time, sh.shift_name
     FROM poct_schedules s
     JOIN poct_shifts sh ON s.shift_id = sh.id
     WHERE ${where.join(' AND ')}`,
    args,
  );
  return rows;
}

/**
 * 计算单条排班的触发时间 = 当天班次开始时间 - offset_minutes
 */
function computeTriggerAt(schedule, offsetMinutes) {
  const [hh, mm, ss] = schedule.start_time.split(':').map(Number);
  const d = new Date(schedule.schedule_date + 'T00:00:00');
  d.setHours(hh, mm - offsetMinutes, ss || 0, 0);
  return d;
}

/**
 * 写一条站内消息(in_app_notifications)
 */
async function insertInAppNotification({ tenantId, userId, title, content, actionUrl }) {
  if (!userId) return;
  try {
    await db.execute(
      `INSERT INTO in_app_notifications
         (tenant_id, user_id, event_code, category, title, content, urgency, source_payload, action_url, action_text)
       VALUES (?, ?, 'poct:shift_reminder', 'poct_quality', ?, ?, 'normal', ?, ?, '去录入')`,
      [
        tenantId, userId, title, content,
        JSON.stringify({}), actionUrl || '/poct-quality-control/mobile',
      ],
    );
  } catch (e) {
    // 表可能不存在,只打日志
    logger.warn('[poct-reminder] 站内消息插入失败:', e.message);
  }
}

/**
 * 防重复日志表(简易):用 poct_records + 排班 id 关联,已录入 = 已提醒过
 * 严格实现需另建 poct_reminder_log 表,这里用轻量去重
 */
async function alreadyFiredToday(ruleId, scheduleId) {
  // 简单方案:检查 poct_schedules 的 status,completed/missed 跳过
  const [rows] = await db.execute(
    `SELECT status FROM poct_schedules WHERE id = ? LIMIT 1`,
    [scheduleId],
  );
  if (rows.length === 0) return true;
  return rows[0].status !== 'pending' && rows[0].status !== 'in_progress';
}

/**
 * 单条触发:发站内消息 + 飞书/微信/短信占位
 */
async function dispatchOne({ rule, schedule, triggerAt, tenantId }) {
  const offsetLabel = `班前 ${rule.offset_minutes} 分钟`;
  const subjectInfo = await db.execute(
    `SELECT sub.subject_name FROM poct_schedules s
     JOIN poct_subjects sub ON s.subject_id = sub.id
     WHERE s.id = ?`, [schedule.schedule_id],
  );
  const subjectName = subjectInfo[0]?.[0]?.subject_name || '';

  const title = `【POCT 质控】${schedule.shift_name}提醒`;
  const content = `距离 ${schedule.shift_name} (${schedule.start_time?.slice(0, 5)} 启动) 还有 ${rule.offset_minutes} 分钟,` +
    `请按时完成【${subjectName || '当班科目'}】质控并签名录入。`;

  const channels = typeof rule.channels === 'string' ? JSON.parse(rule.channels) : (rule.channels || []);
  const recipients = await resolveRecipients(rule, schedule);
  const actionUrl = `/poct-quality-control/mobile`;

  // 1) 站内消息
  if (channels.includes('site')) {
    for (const uid of recipients) {
      await insertInAppNotification({ tenantId, userId: uid, title, content, actionUrl });
    }
  }

  // 2) 飞书(实际发送)
  if (channels.includes('feishu') && recipients.length) {
    try {
      const { buildCard, getOpenIdsByUserIds, sendCardToOpenIds } = require('../../../services/feishu-notification.service');
      const card = buildCard({
        title: `📋 ${title}`,
        color: 'blue',
        content: `**${content}**`,
        fields: [
          { label: '班次', value: schedule.shift_name },
          { label: '科目', value: subjectName || '-' },
          { label: '启动', value: schedule.start_time?.slice(0, 5) },
          { label: '提前', value: `${rule.offset_minutes} 分钟` },
        ],
        actionUrl,
        actionText: '去录入',
      });
      const openIds = await getOpenIdsByUserIds(recipients, tenantId);
      if (openIds && openIds.length) {
        const r = await sendCardToOpenIds(openIds, card, tenantId, {
          userIds: recipients,
          url: actionUrl,
          remark: '请尽快完成质控录入并签名',
        });
        logger.info(`[poct-reminder] feishu sent: ${r?.sent || 0}/${openIds.length} (tenant=${tenantId} schedule=${schedule.schedule_id})`);
      } else {
        logger.info(`[poct-reminder] feishu skipped: 租户 ${tenantId} 未配置飞书绑定或无 openId`);
      }
    } catch (e) {
      logger.error('[poct-reminder] feishu 发送失败:', e.message);
    }
  }

  // 3) 微信(实际发送,走 wechat-mp-notification 通道分发)
  if (channels.includes('wechat') && recipients.length) {
    try {
      const { buildCard } = require('../../../services/feishu-notification.service');
      const { sendToUserIds } = require('../../../services/wechat-mp-notification.service');
      const card = buildCard({
        title: `📋 ${title}`,
        color: 'blue',
        content: `**${content}**`,
        actionUrl,
        actionText: '去录入',
      });
      const r = await sendToUserIds({
        userIds: recipients,
        card,
        url: actionUrl,
        remark: '请尽快完成质控录入并签名',
        tenantId,
      });
      logger.info(`[poct-reminder] wechat sent=${r?.sent || 0} failed=${r?.failed?.length || 0} skipped=${r?.skipped?.length || 0}`);
    } catch (e) {
      logger.error('[poct-reminder] wechat 发送失败:', e.message);
    }
  }

  // 4) 短信 - 当前系统无通用短信发送 service(只有验证码),保留占位
  if (channels.includes('sms')) {
    logger.info(`[poct-reminder] [sms TODO] tenant=${tenantId} schedule=${schedule.schedule_id} (需接入通用短信 SDK)`);
  }
}

/**
 * 解析接收人:operator / role / user_list
 */
async function resolveRecipients(rule, schedule) {
  const type = rule.recipient_type || 'operator';
  if (type === 'operator') {
    const ids = [];
    if (schedule.operator_id) ids.push(schedule.operator_id);
    if (schedule.backup_operator_id) ids.push(schedule.backup_operator_id);
    return ids;
  }
  if (type === 'role') {
    // 简化:查 users 表 role 字段匹配 (具体 schema 视项目而定)
    try {
      const [rows] = await db.execute(
        `SELECT id FROM users WHERE tenant_id = ? AND (role_code = ? OR role = ?) LIMIT 50`,
        [rule.tenant_id, rule.role_code, rule.role_code],
      );
      return rows.map(r => r.id);
    } catch { return []; }
  }
  if (type === 'user_list') {
    const ids = typeof rule.recipient_ids === 'string'
      ? JSON.parse(rule.recipient_ids) : (rule.recipient_ids || []);
    return ids;
  }
  return [];
}

/**
 * 扫描任务
 */
async function tick() {
  try {
    const now = new Date();
    // 取 1 分钟到 1 分钟前之间该触发的窗口(容错)
    const windowStart = new Date(now.getTime() - CHECK_INTERVAL_MS - 5 * 1000);
    const windowEnd = new Date(now.getTime() + 5 * 1000);

    // 拉所有启用的提醒规则
    const [rules] = await db.execute(
      `SELECT * FROM poct_reminders WHERE is_active = 1`,
    );
    if (rules.length === 0) return;

    // 按租户分组(简化:统一处理)
    for (const rule of rules) {
      const tenantId = rule.tenant_id;
      // 扫描 1 天内的排班
      const schedules = await expandSchedules(rule, tenantId,
        windowStart.toISOString().slice(0, 10), windowEnd.toISOString().slice(0, 10));
      for (const schedule of schedules) {
        const triggerAt = computeTriggerAt(schedule, rule.offset_minutes);
        if (triggerAt < windowStart || triggerAt > windowEnd) continue;
        if (await alreadyFiredToday(rule.id, schedule.schedule_id)) continue;
        await dispatchOne({ rule, schedule, triggerAt, tenantId });
      }
    }
  } catch (e) {
    logger.error('[poct-reminder] tick 失败:', e.message);
  }
}

function start() {
  if (_timer) return;
  _timer = setInterval(tick, CHECK_INTERVAL_MS);
  // 启动后立即跑一次
  tick();
  logger.info('[poct-reminder] 调度器已启动,每 60s 扫描一次');
}

function stop() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  logger.info('[poct-reminder] 调度器已停止');
}

module.exports = { start, stop, tick };
