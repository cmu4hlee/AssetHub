/**
 * 站内消息定时清理调度器
 *
 * 职责：
 *   1. 每日凌晨 03:00 清理已过 expires_at 的消息（保留期默认 30 天）
 *   2. 每周日凌晨 04:00 清理 90 天前已读的消息（兜底，防止 expires_at 字段被改大）
 *   3. 暴露 runOnce() 给运维 / 测试手动触发
 *   4. 暴露 getStats() 给监控页 / 健康检查
 *
 * 设计原则：
 *   - 复用 cron 库（项目其他调度器一致使用 node-cron）
 *   - 用 DELETE ... LIMIT 控制单次删除行数，避免大事务
 *   - 跨租户（不指定 tenant_id），因为这是平台级清理
 *   - 清理结果通过 logger 输出，便于监控
 */
const cron = require('node-cron');
const logger = require('../config/logger');
const db = require('../config/database');

// 每日清理过期消息：默认凌晨 03:00（可通过环境变量覆盖）
const EXPIRED_CRON = process.env.IN_APP_NOTIFICATION_EXPIRED_CRON || '0 3 * * *';
// 每周日 04:00 清理 90 天前已读
const OLD_READ_CRON = process.env.IN_APP_NOTIFICATION_OLD_READ_CRON || '0 4 * * 0';
// 兜底阈值：清理 N 天前已读消息（默认 90 天）
const OLD_READ_DAYS = parseInt(process.env.IN_APP_NOTIFICATION_OLD_READ_DAYS || '90', 10);
// 单次删除最多行数（防止大事务）
const BATCH_SIZE = parseInt(process.env.IN_APP_NOTIFICATION_CLEANUP_BATCH || '5000', 10);

class InAppNotificationScheduler {
  constructor() {
    this.tasks = [];
    this.running = false;
  }

  /**
   * 启动调度器
   */
  start() {
    if (this.running) return;
    this.running = true;

    // 1. 每日清理 expires_at < NOW() 的消息
    this.tasks.push(cron.schedule(EXPIRED_CRON, async () => {
      try {
        const result = await this.cleanExpired();
        logger.info(
          `[InAppNotifScheduler] 每日清理完成: 删除 ${result.deleted} 条过期消息`,
        );
      } catch (e) {
        logger.error('[InAppNotifScheduler] 每日清理失败:', e.message);
      }
    }));

    // 2. 每周日清理 N 天前已读
    this.tasks.push(cron.schedule(OLD_READ_CRON, async () => {
      try {
        const result = await this.cleanOldRead();
        logger.info(
          `[InAppNotifScheduler] 每周清理完成: 删除 ${result.deleted} 条 ${OLD_READ_DAYS} 天前已读消息`,
        );
      } catch (e) {
        logger.error('[InAppNotifScheduler] 每周清理失败:', e.message);
      }
    }));

    logger.info(
      `[InAppNotifScheduler] 调度器已启动: ` +
      `每日 ${EXPIRED_CRON} 清理过期消息, ` +
      `每周日 ${OLD_READ_CRON} 清理 ${OLD_READ_DAYS} 天前已读消息`,
    );
  }

  /**
   * 清理已过 expires_at 的消息
   * 分批删除，避免大事务
   * @returns {Promise<{deleted: number, rounds: number}>}
   */
  async cleanExpired() {
    let totalDeleted = 0;
    let rounds = 0;
    // 循环删除直到没有过期消息（防止一次 BATCH_SIZE 不够）
    // 加 rounds 上限避免极端情况下死循环
    const MAX_ROUNDS = 100;
    while (rounds < MAX_ROUNDS) {
      const [result] = await db.execute(
        `DELETE FROM in_app_notifications
         WHERE expires_at IS NOT NULL AND expires_at < NOW()
         LIMIT ?`,
        [BATCH_SIZE],
      );
      const affected = result.affectedRows || 0;
      totalDeleted += affected;
      rounds++;
      if (affected < BATCH_SIZE) break; // 一次没删满说明已清完
    }
    return { deleted: totalDeleted, rounds };
  }

  /**
   * 清理 N 天前的已读消息（兜底清理）
   * 防止 expires_at 被改大、或者根本没设置 expires_at
   * @returns {Promise<{deleted: number, rounds: number}>}
   */
  async cleanOldRead() {
    let totalDeleted = 0;
    let rounds = 0;
    const MAX_ROUNDS = 100;
    while (rounds < MAX_ROUNDS) {
      const [result] = await db.execute(
        `DELETE FROM in_app_notifications
         WHERE is_read = 1
           AND read_at IS NOT NULL
           AND read_at < DATE_SUB(NOW(), INTERVAL ? DAY)
         LIMIT ?`,
        [OLD_READ_DAYS, BATCH_SIZE],
      );
      const affected = result.affectedRows || 0;
      totalDeleted += affected;
      rounds++;
      if (affected < BATCH_SIZE) break;
    }
    return { deleted: totalDeleted, rounds };
  }

  /**
   * 手动触发一次清理（运维 / 测试入口）
   * 同时执行两种清理
   * @returns {Promise<{expired: number, oldRead: number}>}
   */
  async runOnce() {
    const [expired, oldRead] = await Promise.all([
      this.cleanExpired(),
      this.cleanOldRead(),
    ]);
    return {
      expired: expired.deleted,
      oldRead: oldRead.deleted,
      rounds: { expired: expired.rounds, oldRead: oldRead.rounds },
    };
  }

  /**
   * 获取表统计信息（监控用）
   * @returns {Promise<object>}
   */
  async getStats() {
    const [totalRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM in_app_notifications`,
    );
    const [unreadRows] = await db.execute(
      `SELECT COUNT(*) AS unread FROM in_app_notifications WHERE is_read = 0`,
    );
    const [expiredRows] = await db.execute(
      `SELECT COUNT(*) AS expired FROM in_app_notifications
       WHERE expires_at IS NOT NULL AND expires_at < NOW()`,
    );
    const [oldReadRows] = await db.execute(
      `SELECT COUNT(*) AS old_read FROM in_app_notifications
       WHERE is_read = 1 AND read_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [OLD_READ_DAYS],
    );
    return {
      total: totalRows[0]?.total || 0,
      unread: unreadRows[0]?.unread || 0,
      expired: expiredRows[0]?.expired || 0,
      oldReadEligible: oldReadRows[0]?.old_read || 0,
      config: {
        expiredCron: EXPIRED_CRON,
        oldReadCron: OLD_READ_CRON,
        oldReadDays: OLD_READ_DAYS,
        batchSize: BATCH_SIZE,
      },
    };
  }

  /**
   * 停止调度器（用于优雅关闭）
   */
  stop() {
    this.tasks.forEach(t => t.stop && t.stop());
    this.tasks = [];
    this.running = false;
    logger.info('[InAppNotifScheduler] 调度器已停止');
  }
}

// 单例
module.exports = new InAppNotificationScheduler();
