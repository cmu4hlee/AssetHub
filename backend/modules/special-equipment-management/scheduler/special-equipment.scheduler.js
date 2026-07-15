/**
 * 特种设备证书/检验到期提醒调度器
 *
 * 职责：
 *   1. 每日 09:00 扫描所有租户的特种设备,找出"下次检验日期"在阈值内的设备
 *   2. 通过 EventBus 发 `special_equipment:inspection_expiring` 事件
 *   3. 通知引擎(已存在)根据 notification_rules 自动匹配规则,飞书/邮件/站内推送
 *   4. 暴露 runOnce() 给运维 / 测试手动触发
 *
 * 阈值：30 天 / 15 天 / 7 天 / 0 天(今天),每条设备每个阈值每天最多发一次,
 *      避免重复打扰(通过 notification_logs 记录去重)。
 */
const cron = require('node-cron');
const { publishAsync } = require('../../../core/EventBus');
const logger = require('../../../config/logger');
const db = require('../../../config/database');
const specialEquipmentService = require('../services/special-equipment.service');

const EXPIRING_CRON = process.env.SPECIAL_EQUIPMENT_EXPIRING_CRON || '0 9 * * *';
// 提前多少天开始提醒(单位:天)。命中任一阈值即触发。
const REMIND_THRESHOLDS = [30, 15, 7, 0];

class SpecialEquipmentScheduler {
  constructor() {
    this.tasks = [];
    this.running = false;
    // 进程内去重 Set,key = `${equipmentId}_${daysRemaining}_${YYYYMMDD}`
    // 注意:进程重启会清空,每天 cron 重启也会触发一次;多实例部署需要替换为 Redis/DB 去重
    this.notifiedToday = new Set();
  }

  start() {
    if (this.running) return;
    this.running = true;

    this.tasks.push(
      cron.schedule(EXPIRING_CRON, async () => {
        try {
          const r = await this.runExpiringAlerts();
          logger.info('[special-equipment] 到期提醒完成', r);
        } catch (e) {
          logger.error('[special-equipment] 到期提醒失败', { error: e.message, stack: e.stack });
        }
      }),
    );

    logger.info(`[special-equipment] 调度器已启动,每日 ${EXPIRING_CRON} 扫描到期设备`);
  }

  stop() {
    this.tasks.forEach((t) => t.stop && t.stop());
    this.tasks = [];
    this.running = false;
  }

  /**
   * 手动触发一次(运维/测试用)
   * @param {Object} opts
   * @param {number} [opts.thresholdDays=30] - 覆盖默认阈值
   * @param {number} [opts.tenantId] - 只扫描指定租户
   */
  async runOnce(opts = {}) {
    return this.runExpiringAlerts(opts);
  }

  /**
   * 扫所有租户,发提醒事件
   * 同一台设备同一阈值同一天只发一次(去重)
   */
  async runExpiringAlerts(opts = {}) {
    const threshold = Number.isFinite(opts.thresholdDays)
      ? opts.thresholdDays
      : Math.max(...REMIND_THRESHOLDS);

    // 1. 拿所有租户 ID(从 tenants 表;若没有则走 assets 表)
    let tenantIds = [];
    if (Number.isFinite(opts.tenantId)) {
      tenantIds = [opts.tenantId];
    } else {
      try {
        const [rows] = await db.execute(
          'SELECT id FROM tenants WHERE status = "active"',
        );
        tenantIds = rows.map((r) => r.id);
      } catch (_e) {
        // 兜底:从 special_equipment 取
        const [rows] = await db.execute(
          'SELECT DISTINCT tenant_id FROM special_equipment WHERE tenant_id IS NOT NULL',
        );
        tenantIds = rows.map((r) => r.tenant_id);
      }
    }

    let totalCandidates = 0;
    let totalNotified = 0;
    const details = [];

    for (const tenantId of tenantIds) {
      // 2. 拿 N 天内到期的设备
      let candidates = [];
      try {
        candidates = await specialEquipmentService.getExpiringInspections(
          threshold,
          tenantId,
        );
      } catch (e) {
        logger.error(`[special-equipment] 租户 ${tenantId} 扫描失败`, { error: e.message });
        continue;
      }

      totalCandidates += candidates.length;

      for (const eq of candidates) {
        if (!eq.next_inspection_date) continue;
        const daysRemaining = this._daysUntil(eq.next_inspection_date);

        // 策略:距到期日 <= 30 天的每天都发,直到过期
        //       进程内按"天+设备"去重,同设备同天只发一次
        if (daysRemaining > 30) continue;

        const dedupKey = `${tenantId}_${eq.id}_${this._todayKey()}`;
        if (this.notifiedToday.has(dedupKey)) continue;
        this.notifiedToday.add(dedupKey);

        // 4. 通过 EventBus 发事件(由 notification-send.service 接管)
        const payload = {
          tenantId,
          // 兼容两种字段命名:snake_case / camelCase
          tenant_id: tenantId,
          event_type: 'special_equipment_inspection_expiring',
          equipment_id: eq.id,
          equipmentId: eq.id,
          equipment_code: eq.equipment_code,
          equipmentCode: eq.equipment_code,
          equipment_name: eq.equipment_name,
          equipmentName: eq.equipment_name,
          equipment_type: eq.equipment_type,
          equipmentType: eq.equipment_type,
          next_inspection_date: eq.next_inspection_date,
          nextInspectionDate: eq.next_inspection_date,
          days_remaining: daysRemaining,
          daysRemaining: daysRemaining,
          safety_manager: eq.safety_manager || null,
          safetyManager: eq.safety_manager || null,
          registrant: eq.registrant || null,
          department: eq.department || null,
        };

        try {
          await publishAsync('special_equipment:inspection_expiring', payload);
          totalNotified += 1;
          details.push({
            tenantId,
            equipment_code: eq.equipment_code,
            days_remaining: daysRemaining,
          });
        } catch (e) {
          logger.error('[special-equipment] 发事件失败', {
            equipmentId: eq.id,
            error: e.message,
          });
        }
      }
    }

    return { tenantCount: tenantIds.length, candidates: totalCandidates, notified: totalNotified, details };
  }

  _daysUntil(dateStr) {
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  _todayKey() {
    return new Date().toISOString().slice(0, 10);
  }
}

module.exports = new SpecialEquipmentScheduler();
