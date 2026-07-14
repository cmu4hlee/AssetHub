/**
 * 预防性维护调度器
 *
 * - 每日 08:00 到期提醒：扫描 next_maintenance_date 在未来 N 天内的计划（N 取自 maintenance_reminder_configs.reminder_days，
 *   缺省 3 天），调 reminders.service.sendReminder 写表 + emit 飞书通知事件
 * - 每日 02:00 逾期标记：把已过 next_maintenance_date 且未关闭的计划写入 maintenance_plan_overdue（如果存在），
 *   并在响应中记录逾期数
 * - 每日 01:00 自动派发：对到 next_maineance_date 的计划（auto_generate_workorder=1）调
 *   plans.service.createWorkOrderForPlan 生成工单；已存在未关闭工单的跳过
 *
 * 启动方式：在 server.js onServerStart 中调 start()
 * 关闭开关：环境变量 PM_SCHEDULER_DISABLED=true
 */
const cron = require('node-cron');
const db = require('../../config/database');
const logger = require('../../config/logger');
const plansService = require('./plans.service');
const remindersService = require('./reminders.service');

class PreventiveMaintenanceScheduler {
  constructor() {
    this.tasks = [];
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;

    // 每日 01:00 - 自动派发工单
    this.tasks.push(
      cron.schedule('0 1 * * *', async () => {
        try {
          const r = await this.runPlanDispatch();
          logger.info('[pm-scheduler] 自动派发完成', r);
        } catch (e) {
          logger.error('[pm-scheduler] 自动派发失败', { error: e.message });
        }
      }),
    );

    // 每日 02:00 - 标记逾期计划
    this.tasks.push(
      cron.schedule('0 2 * * *', async () => {
        try {
          const r = await this.runOverdueMark();
          logger.info('[pm-scheduler] 逾期标记完成', r);
        } catch (e) {
          logger.error('[pm-scheduler] 逾期标记失败', { error: e.message });
        }
      }),
    );

    // 每日 08:00 - 扫描即将到期的计划，发送提醒（飞书通知）
    this.tasks.push(
      cron.schedule('0 8 * * *', async () => {
        try {
          const r = await this.runReminderScan();
          logger.info('[pm-scheduler] 到期提醒完成', r);
        } catch (e) {
          logger.error('[pm-scheduler] 到期提醒失败', { error: e.message });
        }
      }),
    );

    logger.info('[pm-scheduler] 调度器已启动，3 个定时任务已注册');
  }

  stop() {
    this.tasks.forEach(t => t.stop && t.stop());
    this.tasks = [];
    this.running = false;
  }

  /**
   * 自动派发：扫描到期且开启 auto_generate_workorder 的计划，自动生成工单
   * 已存在未关闭工单的跳过
   */
  async runPlanDispatch() {
    const today = new Date().toISOString().split('T')[0];

    // 1. 找出所有到期且开启 auto_generate_workorder 的计划
    // 同时检查 work_orders / maintenance_workorders 表中是否已有未关闭工单
    const [candidates] = await db.execute(
      `SELECT pmp.id, pmp.tenant_id, pmp.plan_name, pmp.asset_code, pmp.asset_name,
              pmp.responsible_person, pmp.maintenance_content, pmp.auto_generate_workorder
       FROM preventive_maintenance_plans pmp
       WHERE pmp.status = '启用'
         AND pmp.next_maintenance_date <= ?
         AND pmp.auto_generate_workorder = 1`,
      [today],
    );

    if (candidates.length === 0) {
      return { total: 0, success: 0, skipped: 0, failed: 0 };
    }

    // 2. 检测工单表
    const [tables] = await db.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('work_orders', 'maintenance_workorders')
       ORDER BY TABLE_NAME LIMIT 1`,
    );
    if (tables.length === 0) {
      logger.warn('[pm-scheduler] runPlanDispatch: 未找到工单表');
      return { total: candidates.length, success: 0, skipped: 0, failed: candidates.length };
    }
    const workOrderTable = tables[0].TABLE_NAME;

    let success = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    for (const plan of candidates) {
      try {
        // 查是否已存在未关闭工单
        const [existing] = await db.execute(
          `SELECT id FROM ${workOrderTable}
           WHERE maintenance_plan_id = ? AND tenant_id = ?
             AND status NOT IN ('completed', 'closed', 'cancelled') LIMIT 1`,
          [plan.id, plan.tenant_id],
        );
        if (existing.length > 0) {
          skipped++;
          continue;
        }

        const r = await plansService.createWorkOrderForPlan(plan, {
          tenantId: plan.tenant_id,
          maintenanceDateStr: today,
          createdBy: 'system_scheduler',
          planId: plan.id,
        });

        if (r.success) {
          success++;
        } else {
          failed++;
          errors.push({ planId: plan.id, error: r.error });
        }
      } catch (e) {
        failed++;
        errors.push({ planId: plan.id, error: e.message });
        logger.error(`[pm-scheduler] 派发 plan=${plan.id} 失败:`, e.message);
      }
    }

    return { total: candidates.length, success, skipped, failed, errors };
  }

  /**
   * 标记逾期：把 next_maintenance_date < today 的计划记录到日志（不修改 plan 状态，
   * 避免破坏 enabled 状态；前端列表通过 next_maintenance_date 与 today 比较显示"已过期"标签）
   *
   * 如果存在 maintenance_plan_overdue 表则写入，否则只输出统计
   */
  async runOverdueMark() {
    const today = new Date().toISOString().split('T')[0];

    const [overduePlans] = await db.execute(
      `SELECT pmp.id, pmp.tenant_id, pmp.plan_name, pmp.asset_code, pmp.asset_name,
              pmp.next_maintenance_date
       FROM preventive_maintenance_plans pmp
       WHERE pmp.status = '启用'
         AND pmp.next_maintenance_date < ?`,
      [today],
    );

    if (overduePlans.length === 0) {
      return { overdue: 0, logged: 0 };
    }

    // 检查是否有逾期日志表
    const [logTable] = await db.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'maintenance_plan_overdue_log' LIMIT 1`,
    );

    if (logTable.length === 0) {
      logger.info(`[pm-scheduler] 共有 ${overduePlans.length} 个逾期计划（无日志表，仅统计）`);
      return { overdue: overduePlans.length, logged: 0 };
    }

    let logged = 0;
    for (const p of overduePlans) {
      try {
        await db.execute(
          `INSERT INTO maintenance_plan_overdue_log
             (tenant_id, plan_id, asset_code, asset_name, plan_name, due_date, detected_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [p.tenant_id, p.id, p.asset_code, p.asset_name, p.plan_name, p.next_maintenance_date],
        );
        logged++;
      } catch (e) {
        logger.error(`[pm-scheduler] 写逾期日志 plan=${p.id} 失败:`, e.message);
      }
    }

    return { overdue: overduePlans.length, logged };
  }

  /**
   * 到期提醒：扫描 next_maintenance_date 在未来 N 天内的计划，逐条调 sendReminder
   * N 取自 maintenance_reminder_configs.reminder_days（缺省 3 天）
   * 已存在"未处理"提醒的当天计划跳过（避免重复推送）
   */
  async runReminderScan() {
    // 默认 3 天提前量
    const DEFAULT_ADVANCE_DAYS = 3;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 1. 找所有租户的提醒配置，决定每个租户的提前量
    const [configRows] = await db.execute(
      `SELECT tenant_id, plan_id, reminder_days, recipient
       FROM maintenance_reminder_configs`,
    );
    // key: `${tenant_id}|${plan_id}` -> { reminder_days, recipient }
    const configMap = new Map();
    const tenantDefaultDays = new Map();
    for (const row of configRows || []) {
      if (row.plan_id) {
        configMap.set(`${row.tenant_id}|${row.plan_id}`, {
          reminder_days: row.reminder_days || DEFAULT_ADVANCE_DAYS,
          recipient: row.recipient || null,
        });
      } else {
        // 租户级默认（plan_id 为空）
        tenantDefaultDays.set(row.tenant_id, row.reminder_days || DEFAULT_ADVANCE_DAYS);
      }
    }

    // 2. 找出状态=启用 且 next_maintenance_date >= today 的计划（最大提前 DEFAULT_ADVANCE_DAYS + 7 天窗口）
    const maxAdvanceDays = Math.max(
      DEFAULT_ADVANCE_DAYS,
      ...Array.from(configMap.values()).map(c => c.reminder_days),
      ...Array.from(tenantDefaultDays.values()),
    );
    const upperDate = new Date(today);
    upperDate.setDate(upperDate.getDate() + maxAdvanceDays + 1);
    const upperDateStr = upperDate.toISOString().split('T')[0];

    const [plans] = await db.execute(
      `SELECT pmp.id, pmp.tenant_id, pmp.plan_name, pmp.asset_code, pmp.asset_name,
              pmp.next_maintenance_date, pmp.responsible_person
       FROM preventive_maintenance_plans pmp
       WHERE pmp.status = '启用'
         AND pmp.next_maintenance_date >= ?
         AND pmp.next_maintenance_date <= ?`,
      [todayStr, upperDateStr],
    );

    if (plans.length === 0) {
      return { candidates: 0, sent: 0, skipped: 0, failed: 0 };
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    for (const plan of plans) {
      try {
        // 决定该计划的提前量
        const cfg = configMap.get(`${plan.tenant_id}|${plan.id}`);
        const advanceDays = cfg?.reminder_days || tenantDefaultDays.get(plan.tenant_id) || DEFAULT_ADVANCE_DAYS;
        const recipient = cfg?.recipient || plan.responsible_person;

        // 计算 days_until，与 advanceDays 比较
        const next = new Date(plan.next_maintenance_date);
        const daysUntil = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // 只在 days_until <= advanceDays 时推送（避免过早提醒）
        if (daysUntil > advanceDays) {
          skipped++;
          continue;
        }

        // 同一天已有"未处理"提醒则跳过（避免重复推送）
        const [existing] = await db.execute(
          `SELECT id FROM maintenance_reminders
           WHERE plan_id = ? AND reminder_date = ? AND tenant_id = ? AND status = '未处理' LIMIT 1`,
          [plan.id, todayStr, plan.tenant_id],
        );
        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // 构造伪 req 以让 sendReminder 能用 publish 事件
        const fakeReq = {
          user: { tenant_id: plan.tenant_id, role: 'system_admin', real_name: 'scheduler' },
          headers: { 'x-tenant-id': plan.tenant_id },
        };

        const result = await remindersService.sendReminder(
          {
            plan_id: plan.id,
            recipient,
          },
          fakeReq,
        );

        if (result && result.success) {
          sent++;
        } else {
          failed++;
          errors.push({ planId: plan.id, error: result?.message || 'unknown' });
        }
      } catch (e) {
        failed++;
        errors.push({ planId: plan.id, error: e.message });
        logger.error(`[pm-scheduler] 提醒 plan=${plan.id} 失败:`, e.message);
      }
    }

    return { candidates: plans.length, sent, skipped, failed, errors };
  }
}

module.exports = new PreventiveMaintenanceScheduler();
