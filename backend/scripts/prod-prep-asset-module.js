#!/usr/bin/env node
/**
 * 生产前检查/修复脚本：
 * 1) 同步 system_module_menus（基于模块前端配置提示）
 * 2) 为所有租户启用核心模块并补齐菜单映射
 *
 * 安全性：
 * - 仅 INSERT ... ON DUPLICATE/UPDATE 现有记录，不删除任何数据。
 */

const db = require('../config/database');
const syncModuleMenus = require('./sync-module-menus');
const { getModuleMenuDefinitions } = require('../services/module-menu.service');

const CORE_MODULE_IDS = [
  'user-management',
  'asset-management',
  'department-management',
  'permission-management',
  'asset-ai-assistant',
  'iot-management',
  'module-management',
];

async function fetchTenants() {
  const [rows] = await db.execute('SELECT id, tenant_name FROM tenants');
  return rows || [];
}

async function ensureCoreModulesForTenant(tenant) {
  for (const moduleId of CORE_MODULE_IDS) {
    const [sysModules] = await db.execute(
      'SELECT id, version, default_config FROM system_modules WHERE id = ?',
      [moduleId],
    );
    if (sysModules.length === 0) continue;
    const module = sysModules[0];
    const moduleConfig =
      module.default_config && String(module.default_config).trim()
        ? module.default_config
        : '{}';

    await db.execute(
      `INSERT INTO tenant_module_configs (tenant_id, module_id, enabled, config, version, enabled_at, updated_at)
       VALUES (?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         enabled = 1,
         config = COALESCE(config, VALUES(config)),
         version = VALUES(version),
         enabled_at = COALESCE(enabled_at, CURRENT_TIMESTAMP),
         disabled_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [tenant.id, module.id, moduleConfig, module.version],
    );

    const menus = await getModuleMenuDefinitions(module.id);
    for (const menu of menus) {
      await db.execute(
        `INSERT INTO tenant_module_menus (tenant_id, module_id, menu_key, is_enabled, updated_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), updated_at = VALUES(updated_at)`,
        [tenant.id, module.id, menu.menu_key],
      );
    }
  }
}

async function run() {
  try {
    console.log('### 步骤1：同步 system_module_menus');
    await syncModuleMenus();

    console.log('### 步骤2：为所有租户启用核心模块并补齐菜单');
    const tenants = await fetchTenants();
    for (const tenant of tenants) {
      console.log(`  → 租户 ${tenant.id} (${tenant.tenant_name || '未命名'})`);
      await ensureCoreModulesForTenant(tenant);
    }

    console.log('完成：核心模块与菜单映射已校正。');
  } catch (err) {
    console.error('执行失败:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  run();
}

module.exports = run;
