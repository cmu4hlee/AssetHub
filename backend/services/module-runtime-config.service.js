const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const CACHE_TTL_MS = 60 * 1000;
const runtimeCache = new Map();
let moduleDefaultCache = null;

const toSafeObject = value => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
};

const normalizeTenantId = tenantId => {
  const parsed = Number.parseInt(String(tenantId || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const loadModuleDefaultsFromDisk = () => {
  if (moduleDefaultCache) {
    return moduleDefaultCache;
  }

  const modulesRoot = path.resolve(__dirname, '../modules');
  const defaults = new Map();

  if (!fs.existsSync(modulesRoot)) {
    moduleDefaultCache = defaults;
    return defaults;
  }

  const moduleDirs = fs
    .readdirSync(modulesRoot, { withFileTypes: true })
    .filter(item => item.isDirectory())
    .map(item => item.name);

  for (const moduleDir of moduleDirs) {
    const configPath = path.join(modulesRoot, moduleDir, 'config', 'module.config.js');
    if (!fs.existsSync(configPath)) continue;

    try {
      delete require.cache[require.resolve(configPath)];
      const moduleConfig = require(configPath);
      const moduleId = String(moduleConfig?.id || '').trim();
      if (!moduleId) continue;
      defaults.set(moduleId, toSafeObject(moduleConfig.default_config));
    } catch (error) {
      // Ignore broken module config files. Runtime will fallback to env values.
    }
  }

  moduleDefaultCache = defaults;
  return defaults;
};

const getCachedResult = cacheKey => {
  const cached = runtimeCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    runtimeCache.delete(cacheKey);
    return null;
  }
  return cached.value;
};

const setCachedResult = (cacheKey, value) => {
  runtimeCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  if (runtimeCache.size > 500) {
    const firstKey = runtimeCache.keys().next().value;
    if (firstKey) runtimeCache.delete(firstKey);
  }
};

const queryConfigFromDb = async ({ tenantId, moduleId }) => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!moduleId) {
    return null;
  }

  if (normalizedTenantId > 0) {
    const [rows] = await db.execute(
      `SELECT
         sm.default_config AS module_default_config,
         tmc.config AS tenant_config,
         tmc.enabled AS tenant_enabled
       FROM system_modules sm
       LEFT JOIN tenant_module_configs tmc
         ON tmc.module_id = sm.id AND tmc.tenant_id = ?
       WHERE sm.id = ?
       LIMIT 1`,
      [normalizedTenantId, moduleId],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  const [rows] = await db.execute(
    `SELECT
       sm.default_config AS module_default_config,
       NULL AS tenant_config,
       NULL AS tenant_enabled
     FROM system_modules sm
     WHERE sm.id = ?
     LIMIT 1`,
    [moduleId],
  );
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
};

async function getModuleRuntimeConfig({ tenantId, moduleId }) {
  const safeModuleId = String(moduleId || '').trim();
  const safeTenantId = normalizeTenantId(tenantId);
  const cacheKey = `${safeTenantId}:${safeModuleId}`;

  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  let dbRecord = null;
  try {
    dbRecord = await queryConfigFromDb({ tenantId: safeTenantId, moduleId: safeModuleId });
  } catch (error) {
    dbRecord = null;
  }

  const moduleDefaultsFromDisk = loadModuleDefaultsFromDisk().get(safeModuleId) || {};
  const moduleDefaultConfig = toSafeObject(dbRecord?.module_default_config);
  const tenantConfig = toSafeObject(dbRecord?.tenant_config);

  const mergedConfig = {
    ...moduleDefaultsFromDisk,
    ...moduleDefaultConfig,
    ...tenantConfig,
  };

  const enabled =
    dbRecord?.tenant_enabled == null ? true : Number.parseInt(String(dbRecord.tenant_enabled), 10) === 1;

  const result = {
    moduleId: safeModuleId,
    tenantId: safeTenantId,
    enabled,
    config: mergedConfig,
  };

  setCachedResult(cacheKey, result);
  return result;
}

function clearModuleRuntimeConfigCache(moduleId) {
  if (!moduleId) {
    runtimeCache.clear();
    moduleDefaultCache = null;
    return;
  }
  const safeModuleId = String(moduleId).trim();
  for (const key of runtimeCache.keys()) {
    if (key.endsWith(`:${safeModuleId}`)) {
      runtimeCache.delete(key);
    }
  }
}

module.exports = {
  getModuleRuntimeConfig,
  clearModuleRuntimeConfigCache,
};
