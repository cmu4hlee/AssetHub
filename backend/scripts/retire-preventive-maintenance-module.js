const db = require('../config/database');
const { getModuleMenuDefinitions } = require('../services/module-menu.service');

const RETIRED_MODULE_ID = 'preventive-maintenance-management';
const TARGET_MODULE_ID = 'compliance-management';
const MIGRATION_OPERATOR = 'system_migration/retire_preventive_maintenance';

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return {
    apply: args.has('--apply'),
    dryRun: args.has('--dry-run') || !args.has('--apply'),
  };
};

const toJSONString = payload => {
  try {
    return JSON.stringify(payload);
  } catch (error) {
    return '{}';
  }
};

async function loadTargetModuleInfo() {
  const [rows] = await db.execute(
    'SELECT id, version, default_config FROM system_modules WHERE id = ? LIMIT 1',
    [TARGET_MODULE_ID],
  );
  if (!rows || rows.length === 0) {
    throw new Error(`目标模块不存在: ${TARGET_MODULE_ID}`);
  }
  return rows[0];
}

async function loadRetiredEnabledTenants() {
  const [rows] = await db.execute(
    `SELECT tenant_id, module_id, enabled, version, config
     FROM tenant_module_configs
     WHERE module_id = ? AND enabled = 1
     ORDER BY tenant_id ASC`,
    [RETIRED_MODULE_ID],
  );
  return Array.isArray(rows) ? rows : [];
}

async function migrateTenant({
  tenantId,
  targetVersion,
  targetDefaultConfig,
  targetMenus,
  dryRun,
}) {
  if (dryRun) {
    console.log(`[DRY-RUN] tenant ${tenantId}:`);
    console.log(
      `  - 将启用 ${TARGET_MODULE_ID}（若尚未启用），并同步 ${targetMenus.length} 条菜单`,
    );
    console.log(`  - 将禁用 ${RETIRED_MODULE_ID}，并写入 module_operation_logs`);
    return { migrated: false, changedRows: 0, targetEnabled: false, oldDisabled: false };
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [targetRows] = await connection.execute(
      `SELECT enabled, config, version
       FROM tenant_module_configs
       WHERE tenant_id = ? AND module_id = ?
       LIMIT 1`,
      [tenantId, TARGET_MODULE_ID],
    );
    const targetCurrent = targetRows[0] || null;
    const targetWasEnabled = Number(targetCurrent?.enabled || 0) === 1;

    await connection.execute(
      `INSERT INTO tenant_module_configs (tenant_id, module_id, enabled, config, version, enabled_at, disabled_at, updated_at)
       VALUES (?, ?, 1, ?, ?, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         enabled = 1,
         config = COALESCE(config, VALUES(config)),
         version = COALESCE(version, VALUES(version)),
         enabled_at = IF(enabled = 0, CURRENT_TIMESTAMP, enabled_at),
         disabled_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [tenantId, TARGET_MODULE_ID, targetDefaultConfig, targetVersion],
    );

    for (const menu of targetMenus) {
      await connection.execute(
        `INSERT INTO tenant_module_menus (tenant_id, module_id, menu_key, is_enabled, updated_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), updated_at = VALUES(updated_at)`,
        [tenantId, TARGET_MODULE_ID, menu.menu_key],
      );
    }

    const [disableResult] = await connection.execute(
      `UPDATE tenant_module_configs
         SET enabled = 0, disabled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND module_id = ? AND enabled = 1`,
      [tenantId, RETIRED_MODULE_ID],
    );
    const disabledOldModule = Number(disableResult?.affectedRows || 0) > 0;

    const [disableMenusResult] = await connection.execute(
      `UPDATE tenant_module_menus
         SET is_enabled = 0, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND module_id = ?`,
      [tenantId, RETIRED_MODULE_ID],
    );

    await connection.execute(
      `INSERT INTO module_operation_logs (module_id, tenant_id, operation, operator, operation_data, result)
       VALUES (?, ?, ?, ?, ?, 'success')`,
      [
        RETIRED_MODULE_ID,
        tenantId,
        'retire_disable',
        MIGRATION_OPERATOR,
        toJSONString({
          reason: 'merged_into_compliance_management',
          target_module_id: TARGET_MODULE_ID,
          target_was_enabled: targetWasEnabled,
          target_enabled_now: true,
          old_disabled_now: disabledOldModule,
          disabled_old_menu_rows: Number(disableMenusResult?.affectedRows || 0),
        }),
      ],
    );

    await connection.commit();
    return {
      migrated: true,
      changedRows:
        Number(disableResult?.affectedRows || 0) + Number(disableMenusResult?.affectedRows || 0),
      targetEnabled: true,
      oldDisabled: disabledOldModule,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function retirePreventiveMaintenanceModule({ dryRun }) {
  const targetModule = await loadTargetModuleInfo();
  const targetMenus = await getModuleMenuDefinitions(TARGET_MODULE_ID);
  const targetDefaultConfig = targetModule.default_config || '{}';
  const targetVersion = targetModule.version || '1.0.0';

  const retiredEnabledConfigs = await loadRetiredEnabledTenants();
  if (retiredEnabledConfigs.length === 0) {
    console.log(`未发现启用中的 ${RETIRED_MODULE_ID}，无需迁移。`);
    return;
  }

  console.log(
    `${dryRun ? '[DRY-RUN]' : '[APPLY]'} 发现 ${retiredEnabledConfigs.length} 个租户启用了 ${RETIRED_MODULE_ID}`,
  );
  console.log(`目标模块: ${TARGET_MODULE_ID}，将同步 ${targetMenus.length} 条菜单`);

  let migratedCount = 0;
  let totalChangedRows = 0;

  for (const config of retiredEnabledConfigs) {
    const tenantId = config.tenant_id;
    try {
      const result = await migrateTenant({
        tenantId,
        targetVersion,
        targetDefaultConfig,
        targetMenus,
        dryRun,
      });
      if (result.migrated) {
        migratedCount += 1;
        totalChangedRows += result.changedRows;
        console.log(
          `[OK] tenant ${tenantId}: old_disabled=${result.oldDisabled}, target_enabled=${result.targetEnabled}`,
        );
      }
    } catch (error) {
      console.error(`[FAIL] tenant ${tenantId}: ${error.message}`);
      if (!dryRun) {
        throw error;
      }
    }
  }

  console.log('----------------------------------------');
  if (dryRun) {
    console.log(`DRY-RUN 完成，预计迁移租户数: ${retiredEnabledConfigs.length}`);
  } else {
    console.log(`迁移完成，处理租户数: ${migratedCount}`);
    console.log(`累计变更行数(禁用模块+菜单): ${totalChangedRows}`);
  }
}

async function main() {
  const { apply, dryRun } = parseArgs();
  if (!apply) {
    console.log('未传入 --apply，默认执行 DRY-RUN（只预览，不落库）。');
  }
  try {
    await retirePreventiveMaintenanceModule({ dryRun });
  } catch (error) {
    console.error('迁移失败:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end().catch(() => {});
  }
}

if (require.main === module) {
  main().finally(() => {
    process.exit(process.exitCode || 0);
  });
}

module.exports = retirePreventiveMaintenanceModule;
