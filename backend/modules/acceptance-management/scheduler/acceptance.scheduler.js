/**
 * 验收模块定时任务
 * 启动时调用 start() 即可
 * - 每日 08:00 扫描验收申请到期/超期、待审批、验收记录到期并生成提醒（跨租户）
 * 生成的提醒会落库并发布 acceptance:reminder 事件，由飞书通知服务订阅推送。
 */
const cron = require('node-cron');
const logger = require('../../../config/logger');
const acceptanceService = require('../services/acceptance.service');

// 提前提醒天数（与巡检模块保持一致，默认 3 天）
const LEAD_DAYS = parseInt(process.env.ACCEPTANCE_REMINDER_LEAD_DAYS || '3', 10);

class AcceptanceScheduler {
  constructor() {
    this.tasks = [];
    this.running = false;
  }

  /**
   * 注册并启动所有定时任务
   */
  start() {
    if (this.running) return;
    this.running = true;

    // 每日 08:00 扫描验收相关到期 / 超期 / 待审批提醒
    this.tasks.push(cron.schedule('0 8 * * *', async () => {
      try {
        const summary = await acceptanceService.runReminderScan(LEAD_DAYS);
        logger.info('[acceptance] 验收提醒扫描完成', summary);
      } catch (e) {
        logger.error('[acceptance] 验收提醒扫描失败', { error: e.message });
      }
    }));

    logger.info(`[acceptance] 调度器已启动，每日 08:00 扫描验收提醒（提前 ${LEAD_DAYS} 天）`);
  }

  /**
   * 手动触发一次扫描（供运维 / 测试调用）
   * @param {number} [leadDays]
   * @returns {Promise<object>}
   */
  async runOnce(leadDays = LEAD_DAYS) {
    return acceptanceService.runReminderScan(leadDays);
  }

  stop() {
    this.tasks.forEach(t => t.stop && t.stop());
    this.tasks = [];
    this.running = false;
    logger.info('[acceptance] 调度器已停止');
  }
}

module.exports = new AcceptanceScheduler();
