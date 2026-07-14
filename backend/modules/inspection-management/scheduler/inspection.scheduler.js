/**
 * 巡检模块定时任务
 * 启动时调用 start() 即可
 * - 每日 02:00 标记逾期任务
 * - 每日 08:00 发到期提醒(默认提前 3 天)
 * - 每日 02:30 整改超期提醒
 * - 每日 01:00 按计划自动派发任务
 */
const cron = require('node-cron');
const ext = require('../services/inspection-extended.service');
const logger = require('../../../config/logger');

class InspectionScheduler {
  constructor() {
    this.tasks = [];
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;

    // 每日 02:00 标记逾期
    this.tasks.push(cron.schedule('0 2 * * *', async () => {
      try {
        const r = await ext.runOverdueMark();
        logger.info('[inspection] 逾期标记完成', r);
      } catch (e) {
        logger.error('[inspection] 逾期标记失败', { error: e.message });
      }
    }));

    // 每日 08:00 到期提醒
    this.tasks.push(cron.schedule('0 8 * * *', async () => {
      try {
        const r = await ext.runExpiringAlerts(3);
        logger.info('[inspection] 到期提醒完成', r);
      } catch (e) {
        logger.error('[inspection] 到期提醒失败', { error: e.message });
      }
    }));

    // 每日 02:30 整改超期
    this.tasks.push(cron.schedule('30 2 * * *', async () => {
      try {
        const r = await ext.runIssueOverdueAlerts();
        logger.info('[inspection] 整改超期提醒完成', r);
      } catch (e) {
        logger.error('[inspection] 整改超期提醒失败', { error: e.message });
      }
    }));

    // 每日 01:00 计划派发
    this.tasks.push(cron.schedule('0 1 * * *', async () => {
      try {
        const r = await ext.runPlanDispatch();
        logger.info('[inspection] 计划派发完成', { total: r.total, success: r.results.filter(x => !x.error).length });
      } catch (e) {
        logger.error('[inspection] 计划派发失败', { error: e.message });
      }
    }));

    logger.info('[inspection] 调度器已启动,4 个定时任务已注册');
  }

  stop() {
    this.tasks.forEach(t => t.stop && t.stop());
    this.tasks = [];
    this.running = false;
  }
}

module.exports = new InspectionScheduler();
