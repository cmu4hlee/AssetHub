/**
 * 系统配置服务
 * 用于从 system_configs 表读取/管理系统配置（敏感凭证等）
 * 提供统一的配置读写接口，支持多级 fallback：数据库 -> 环境变量 -> 默认值
 */

const db = require('../config/database');

const CONFIG_KEYS = {
  ALIYUN_ACCESS_KEY_ID: 'aliyun.access_key_id',
  ALIYUN_ACCESS_KEY_SECRET: 'aliyun.access_key_secret',
  ALIYUN_SMS_SIGN_NAME: 'aliyun.sms_sign_name',
  ALIYUN_SMS_TEMPLATE_CODE: 'aliyun.sms_template_code',
};

// 环境变量映射（fallback 用）
const ENV_MAP = {
  [CONFIG_KEYS.ALIYUN_ACCESS_KEY_ID]: 'ALIYUN_ACCESS_KEY_ID',
  [CONFIG_KEYS.ALIYUN_ACCESS_KEY_SECRET]: 'ALIYUN_ACCESS_KEY_SECRET',
  [CONFIG_KEYS.ALIYUN_SMS_SIGN_NAME]: 'ALIYUN_SMS_SIGN_NAME',
  [CONFIG_KEYS.ALIYUN_SMS_TEMPLATE_CODE]: 'ALIYUN_SMS_TEMPLATE_CODE',
};

// 内存缓存（启动后首次加载后缓存，减少数据库查询）
let configCache = {};
let cacheInitialized = false;

/**
 * 加载所有系统配置到内存缓存
 */
async function loadAllConfigs() {
  try {
    const [rows] = await db.execute(
      'SELECT config_key, config_value FROM system_configs WHERE tenant_id = 0'
    );
    configCache = {};
    for (const row of rows) {
      configCache[row.config_key] = row.config_value;
    }
    cacheInitialized = true;
    return configCache;
  } catch (error) {
    console.warn('[SystemConfig] 加载配置失败:', error.message);
    return {};
  }
}

/**
 * 获取单个配置值
 * fallback 链：数据库缓存 -> 环境变量 -> 默认值
 * @param {string} configKey - 配置键（如 'aliyun.access_key_id'）
 * @param {*} defaultValue - 默认值
 * @returns {Promise<string|null>}
 */
async function getConfig(configKey, defaultValue = null) {
  // 优先从缓存读取
  if (cacheInitialized && configCache[configKey] !== undefined) {
    return configCache[configKey] || defaultValue;
  }

  // 缓存未初始化，尝试从数据库读取
  try {
    const [rows] = await db.execute(
      'SELECT config_value FROM system_configs WHERE tenant_id = 0 AND config_key = ?',
      [configKey]
    );
    if (rows.length > 0) {
      // 回填缓存
      configCache[configKey] = rows[0].config_value;
      return rows[0].config_value || defaultValue;
    }
  } catch (error) {
    console.warn(`[SystemConfig] 读取配置 ${configKey} 失败:`, error.message);
  }

  // fallback 到环境变量
  const envKey = ENV_MAP[configKey];
  if (envKey && process.env[envKey]) {
    return process.env[envKey];
  }

  return defaultValue;
}

/**
 * 设置/更新配置值
 * @param {string} configKey
 * @param {string} configValue
 * @param {object} options - { description, isEncrypted, tenantId, updatedBy }
 */
async function setConfig(configKey, configValue, options = {}) {
  const {
    description = '',
    isEncrypted = 1,
    tenantId = 0,
    updatedBy = 'system',
  } = options;

  try {
    const [existing] = await db.execute(
      'SELECT id FROM system_configs WHERE tenant_id = ? AND config_key = ?',
      [tenantId, configKey]
    );

    if (existing.length > 0) {
      await db.execute(
        'UPDATE system_configs SET config_value = ?, description = ?, is_encrypted = ?, updated_by = ? WHERE id = ?',
        [configValue, description, isEncrypted, updatedBy, existing[0].id]
      );
    } else {
      await db.execute(
        'INSERT INTO system_configs (tenant_id, config_key, config_value, description, is_encrypted, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
        [tenantId, configKey, configValue, description, isEncrypted, updatedBy]
      );
    }

    // 更新缓存
    configCache[configKey] = configValue;
    return true;
  } catch (error) {
    console.error(`[SystemConfig] 设置配置 ${configKey} 失败:`, error.message);
    throw error;
  }
}

/**
 * 获取所有配置（用于管理界面）
 */
async function getAllConfigs(tenantId = 0) {
  const [rows] = await db.execute(
    'SELECT config_key, config_value, description, is_encrypted, updated_at, updated_by FROM system_configs WHERE tenant_id = ? ORDER BY config_key',
    [tenantId]
  );
  return rows;
}

/**
 * 删除配置
 */
async function deleteConfig(configKey, tenantId = 0) {
  await db.execute(
    'DELETE FROM system_configs WHERE tenant_id = ? AND config_key = ?',
    [tenantId, configKey]
  );
  delete configCache[configKey];
}

/**
 * 获取 SMS 完整配置对象
 * 合并数据库配置与环境变量，返回完整的 SMS 配置
 */
async function getSmsConfig() {
  // 确保缓存已加载
  if (!cacheInitialized) {
    await loadAllConfigs();
  }

  return {
    accessKeyId: await getConfig(CONFIG_KEYS.ALIYUN_ACCESS_KEY_ID, ''),
    accessKeySecret: await getConfig(CONFIG_KEYS.ALIYUN_ACCESS_KEY_SECRET, ''),
    signName: await getConfig(CONFIG_KEYS.ALIYUN_SMS_SIGN_NAME, ''),
    templateCode: await getConfig(CONFIG_KEYS.ALIYUN_SMS_TEMPLATE_CODE, ''),
  };
}

module.exports = {
  CONFIG_KEYS,
  getConfig,
  setConfig,
  getAllConfigs,
  deleteConfig,
  loadAllConfigs,
  getSmsConfig,
};
