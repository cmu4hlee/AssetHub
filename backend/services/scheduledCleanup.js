/**
 * 定期清理服务
 * 清理过期的 token、缓存、会话等数据
 */

const db = require('../config/database');
const logger = require('../config/logger');

/**
 * 清理配置
 */
const CLEANUP_CONFIG = {
  // 审计日志保留天数
  AUDIT_LOG_RETENTION_DAYS: 90,
  // 临时文件保留天数
  TEMP_FILE_RETENTION_DAYS: 7,
  // 登录会话保留天数
  SESSION_RETENTION_DAYS: 7,
  // 失败登录尝试记录保留天数
  FAILED_LOGIN_RETENTION_DAYS: 30,
  // 执行间隔（毫秒）
  INTERVAL: 24 * 60 * 60 * 1000, // 24小时
};

/**
 * 清理审计日志
 */
async function cleanupAuditLogs() {
  try {
    const retentionDays = CLEANUP_CONFIG.AUDIT_LOG_RETENTION_DAYS;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await db.execute(
      'DELETE FROM audit_logs WHERE created_at < ?',
      [cutoffDate],
    );

    const deletedCount = result.affectedRows || 0;
    if (deletedCount > 0) {
      logger.info(`清理了 ${deletedCount} 条过期的审计日志`);
    }
    return deletedCount;
  } catch (error) {
    logger.error('清理审计日志失败:', { error: error.message });
    return 0;
  }
}

/**
 * 清理临时文件记录
 */
async function cleanupTempFiles() {
  try {
    const retentionDays = CLEANUP_CONFIG.TEMP_FILE_RETENTION_DAYS;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // 查找过期的临时文件
    const expiredFiles = await db.execute(
      'SELECT id, file_path FROM temp_files WHERE expires_at < ? AND status = \'expired\'',
      [cutoffDate],
    );

    const files = Array.isArray(expiredFiles) ? expiredFiles : expiredFiles[0] || [];

    // 删除文件记录（实际文件应由文件服务或 cron job 删除）
    if (files.length > 0) {
      const fileIds = files.map(f => f.id);
      await db.execute(
        `DELETE FROM temp_files WHERE id IN (${fileIds.map(() => '?').join(',')})`,
        fileIds,
      );
      logger.info(`清理了 ${files.length} 条过期的临时文件记录`);
    }
    return files.length;
  } catch (error) {
    // 表可能不存在，忽略错误
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return 0;
    }
    logger.error('清理临时文件记录失败:', { error: error.message });
    return 0;
  }
}

/**
 * 清理超时的用户会话
 */
async function cleanupUserSessions() {
  try {
    const retentionDays = CLEANUP_CONFIG.SESSION_RETENTION_DAYS;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await db.execute(
      'DELETE FROM user_sessions WHERE last_activity < ?',
      [cutoffDate],
    );

    const deletedCount = result.affectedRows || 0;
    if (deletedCount > 0) {
      logger.info(`清理了 ${deletedCount} 个过期的用户会话`);
    }
    return deletedCount;
  } catch (error) {
    // 表可能不存在，忽略错误
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return 0;
    }
    logger.error('清理用户会话失败:', { error: error.message });
    return 0;
  }
}

/**
 * 清理失败的登录尝试记录
 */
async function cleanupFailedLoginAttempts() {
  try {
    const retentionDays = CLEANUP_CONFIG.FAILED_LOGIN_RETENTION_DAYS;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await db.execute(
      'DELETE FROM failed_login_attempts WHERE created_at < ?',
      [cutoffDate],
    );

    const deletedCount = result.affectedRows || 0;
    if (deletedCount > 0) {
      logger.info(`清理了 ${deletedCount} 条失败的登录尝试记录`);
    }
    return deletedCount;
  } catch (error) {
    // 表可能不存在，忽略错误
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return 0;
    }
    logger.error('清理失败登录尝试记录失败:', { error: error.message });
    return 0;
  }
}

/**
 * 清理未使用的资源锁定
 */
async function cleanupResourceLocks() {
  try {
    // 清理超过1小时的资源锁定
    const result = await db.execute(
      'DELETE FROM resource_locks WHERE expires_at < NOW() AND status = \'locked\'',
    );

    const deletedCount = result.affectedRows || 0;
    if (deletedCount > 0) {
      logger.info(`清理了 ${deletedCount} 个过期的资源锁定`);
    }
    return deletedCount;
  } catch (error) {
    // 表可能不存在，忽略错误
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return 0;
    }
    logger.error('清理资源锁定失败:', { error: error.message });
    return 0;
  }
}

/**
 * 清理过期的缓存键（基于数据库表）
 */
async function cleanupExpiredCache() {
  try {
    // 清理超过7天的缓存条目
    const result = await db.execute(
      'DELETE FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at < NOW()',
    );

    const deletedCount = result.affectedRows || 0;
    if (deletedCount > 0) {
      logger.info(`清理了 ${deletedCount} 个过期的缓存条目`);
    }
    return deletedCount;
  } catch (error) {
    // 表可能不存在，忽略错误
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return 0;
    }
    logger.error('清理过期缓存失败:', { error: error.message });
    return 0;
  }
}

/**
 * 执行所有清理任务
 */
async function runCleanup() {
  logger.info('开始执行定期清理任务...');

  const startTime = Date.now();

  const results = {
    auditLogs: await cleanupAuditLogs(),
    tempFiles: await cleanupTempFiles(),
    userSessions: await cleanupUserSessions(),
    failedLoginAttempts: await cleanupFailedLoginAttempts(),
    resourceLocks: await cleanupResourceLocks(),
    expiredCache: await cleanupExpiredCache(),
  };

  const duration = Date.now() - startTime;
  const totalDeleted = Object.values(results).reduce((sum, count) => sum + count, 0);

  logger.info(`定期清理任务完成，共清理 ${totalDeleted} 条记录，耗时 ${duration}ms`);

  return results;
}

/**
 * 启动定期清理服务
 */
let cleanupInterval = null;

function startCleanupService() {
  if (cleanupInterval) {
    logger.warn('清理服务已启动，跳过');
    return;
  }

  logger.info(`启动定期清理服务，间隔 ${CLEANUP_CONFIG.INTERVAL / 1000 / 60 / 60} 小时`);

  // 立即执行一次
  runCleanup().catch(err => {
    logger.error('立即清理失败:', { error: err.message });
  });

  // 设置定期执行
  cleanupInterval = setInterval(() => {
    runCleanup().catch(err => {
      logger.error('定期清理失败:', { error: err.message });
    });
  }, CLEANUP_CONFIG.INTERVAL);
}

/**
 * 停止定期清理服务
 */
function stopCleanupService() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('定期清理服务已停止');
  }
}

module.exports = {
  runCleanup,
  startCleanupService,
  stopCleanupService,
  CLEANUP_CONFIG,
};
