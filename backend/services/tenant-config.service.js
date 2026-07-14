/**
 * 租户级配置服务
 * 支持按企业空间隔离飞书/SMTP 等配置，回退到全局 .env 环境变量
 *
 * 配置键（config_key）：
 *   - 'feishu'  飞书应用配置（app_id, app_secret, redirect_uri, host, notification_enabled, scheduler_enabled, alert_scan_interval）
 *   - 'email'   SMTP 邮件配置（host, port, secure, user, pass, from）
 */
const db = require('../config/database');
const logger = require('../config/logger');

const DEFAULT_TENANT_ID = 2; // 中国医科大学附属第四医院

// 内存缓存：tenant_id + config_key → { config, fetchedAt }
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 60 秒

let ensureTablePromise = null;

/**
 * 建表（幂等）
 */
async function ensureTable() {
  if (ensureTablePromise) return ensureTablePromise;
  ensureTablePromise = (async () => {
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS tenant_configs (
          id INT NOT NULL AUTO_INCREMENT,
          tenant_id INT NOT NULL COMMENT '租户ID',
          config_key VARCHAR(50) NOT NULL COMMENT '配置键 feishu/email',
          config TEXT NULL COMMENT 'JSON 配置内容',
          enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          updated_by INT NULL COMMENT '最后修改人用户ID',
          PRIMARY KEY (id),
          UNIQUE KEY uk_tenant_config_key (tenant_id, config_key),
          INDEX idx_tenant_config_key (config_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户级配置（飞书/邮件等）';
      `);
      logger.info('[TenantConfig] tenant_configs 表已就绪');
    } catch (e) {
      logger.error('[TenantConfig] 建表失败:', e.message);
    }
  })();
  return ensureTablePromise;
}

/**
 * 从环境变量读取默认飞书配置（用于回退/初始化默认租户）
 */
function getDefaultFeishuConfig() {
  return {
    app_id: process.env.FEISHU_APP_ID || '',
    app_secret: process.env.FEISHU_APP_SECRET || '',
    redirect_uri: process.env.FEISHU_REDIRECT_URI || '',
    host: process.env.FEISHU_HOST || 'https://open.feishu.cn',
    notification_enabled: process.env.FEISHU_NOTIFICATION_ENABLED !== 'false',
    scheduler_enabled: process.env.FEISHU_SCHEDULER_ENABLED !== 'false',
    alert_scan_interval: parseInt(process.env.FEISHU_ALERT_SCAN_INTERVAL || '3600000', 10),
  };
}

/**
 * 从环境变量读取默认邮件配置（用于回退/初始化默认租户）
 */
function getDefaultEmailConfig() {
  return {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 465,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
  };
}

/**
 * 获取租户配置（带缓存，回退全局 env）
 * @param {number} tenantId - 租户ID，为空则用默认租户
 * @param {string} configKey - 'feishu' | 'email'
 * @returns {Promise<Object|null>} 配置对象，未配置则回退 env 默认值
 */
async function getTenantConfig(tenantId, configKey) {
  await ensureTable();
  const tid = tenantId || DEFAULT_TENANT_ID;
  const cacheKey = `${tid}:${configKey}`;

  // 命中缓存
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.config;
  }

  try {
    const [rows] = await db.execute(
      'SELECT config, enabled FROM tenant_configs WHERE tenant_id = ? AND config_key = ? LIMIT 1',
      [tid, configKey],
    );
    let config = null;
    if (rows.length > 0 && rows[0].enabled === 1) {
      config = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config;
    }
    // 回退到 env 默认值
    if (!config) {
      config = configKey === 'feishu' ? getDefaultFeishuConfig() : getDefaultEmailConfig();
    }
    cache.set(cacheKey, { config, fetchedAt: Date.now() });
    return config;
  } catch (e) {
    logger.warn(`[TenantConfig] 读取租户 ${tid} 的 ${configKey} 配置失败，回退 env:`, e.message);
    return configKey === 'feishu' ? getDefaultFeishuConfig() : getDefaultEmailConfig();
  }
}

/**
 * 获取飞书配置（便捷方法）
 */
async function getFeishuConfig(tenantId) {
  return getTenantConfig(tenantId, 'feishu');
}

/**
 * 获取邮件配置（便捷方法）
 */
async function getEmailConfig(tenantId) {
  return getTenantConfig(tenantId, 'email');
}

/**
 * 写入/更新租户配置
 * @param {number} tenantId - 租户ID
 * @param {string} configKey - 'feishu' | 'email'
 * @param {Object} config - 配置对象
 * @param {number} [updatedBy] - 修改人用户ID
 */
async function upsertTenantConfig(tenantId, configKey, config, updatedBy) {
  await ensureTable();
  const configJson = JSON.stringify(config);
  await db.execute(
    `INSERT INTO tenant_configs (tenant_id, config_key, config, enabled, updated_by)
     VALUES (?, ?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE config = VALUES(config), enabled = 1, updated_by = VALUES(updated_by), updated_at = NOW()`,
    [tenantId, configKey, configJson, updatedBy || null],
  );
  // 清缓存
  cache.delete(`${tenantId}:${configKey}`);
  logger.info(`[TenantConfig] 租户 ${tenantId} 的 ${configKey} 配置已更新`);
}

/**
 * 获取租户配置原始记录（含 enabled 状态，用于管理端读取；敏感字段掩码）
 * @param {number} tenantId
 * @param {string} configKey
 * @returns {Promise<{config: Object, enabled: boolean, exists: boolean}>}
 */
async function getTenantConfigRaw(tenantId, configKey) {
  await ensureTable();
  try {
    const [rows] = await db.execute(
      'SELECT config, enabled FROM tenant_configs WHERE tenant_id = ? AND config_key = ? LIMIT 1',
      [tenantId, configKey],
    );
    if (rows.length === 0) {
      // 未配置，返回 env 默认值
      const envDefault = configKey === 'feishu' ? getDefaultFeishuConfig() : getDefaultEmailConfig();
      return { config: envDefault, enabled: true, exists: false };
    }
    const config = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config;
    return { config, enabled: rows[0].enabled === 1, exists: true };
  } catch (e) {
    const envDefault = configKey === 'feishu' ? getDefaultFeishuConfig() : getDefaultEmailConfig();
    return { config: envDefault, enabled: true, exists: false };
  }
}

/**
 * 清除缓存（配置更新后调用）
 */
function clearCache(tenantId, configKey) {
  if (tenantId && configKey) {
    cache.delete(`${tenantId}:${configKey}`);
  } else {
    cache.clear();
  }
}

/**
 * 初始化默认租户配置：把当前 .env 中的飞书/SMTP 配置写入 tenant_id=2
 * 幂等：仅在租户尚无该配置键时插入
 */
async function seedDefaultTenantConfig() {
  await ensureTable();
  try {
    // 飞书
    const [feishuExists] = await db.execute(
      'SELECT id FROM tenant_configs WHERE tenant_id = ? AND config_key = ? LIMIT 1',
      [DEFAULT_TENANT_ID, 'feishu'],
    );
    if (feishuExists.length === 0) {
      const feishuCfg = getDefaultFeishuConfig();
      if (feishuCfg.app_id && feishuCfg.app_secret) {
        await db.execute(
          `INSERT INTO tenant_configs (tenant_id, config_key, config, enabled, updated_by)
           VALUES (?, 'feishu', ?, 1, NULL)`,
          [DEFAULT_TENANT_ID, JSON.stringify(feishuCfg)],
        );
        logger.info(`[TenantConfig] 已为租户 ${DEFAULT_TENANT_ID} 初始化默认飞书配置`);
      }
    }

    // 邮件
    const [emailExists] = await db.execute(
      'SELECT id FROM tenant_configs WHERE tenant_id = ? AND config_key = ? LIMIT 1',
      [DEFAULT_TENANT_ID, 'email'],
    );
    if (emailExists.length === 0) {
      const emailCfg = getDefaultEmailConfig();
      if (emailCfg.host && emailCfg.user) {
        await db.execute(
          `INSERT INTO tenant_configs (tenant_id, config_key, config, enabled, updated_by)
           VALUES (?, 'email', ?, 1, NULL)`,
          [DEFAULT_TENANT_ID, JSON.stringify(emailCfg)],
        );
        logger.info(`[TenantConfig] 已为租户 ${DEFAULT_TENANT_ID} 初始化默认邮件配置`);
      }
    }
  } catch (e) {
    logger.warn('[TenantConfig] 初始化默认租户配置失败（可忽略）:', e.message);
  }
}

module.exports = {
  ensureTable,
  getTenantConfig,
  getFeishuConfig,
  getEmailConfig,
  upsertTenantConfig,
  getTenantConfigRaw,
  clearCache,
  seedDefaultTenantConfig,
  DEFAULT_TENANT_ID,
  getDefaultFeishuConfig,
  getDefaultEmailConfig,
};
