/**
 * POCT 临床科室日常质控管理 — 菜单注册
 *
 * 1) menu_definitions: 新增 /poct-quality-control 子菜单,挂到 /quality-control-parent(order 4)
 * 2) tenant_module_menus: 给启用了 poct-quality-control 模块的租户补齐菜单记录
 *
 * 注:模块 ID = poct-quality-control,与 routes/menus.js 中的 ALL_MENUS 已同步
 *
 * 执行: cd backend && node migrations/20260717_poct_menu.js
 */

const db = require('../config/database');
const logger = require('../config/logger');

async function ensureMenuDefinition(conn) {
  const [exists] = await conn.query(
    `SELECT id FROM menu_definitions WHERE menu_key = '/poct-quality-control'`,
  );
  if (exists.length > 0) {
    logger.info('  - /poct-quality-control 已存在,跳过');
    return false;
  }
  // 找到 quality-control-parent 的 order_index
  const [parent] = await conn.query(
    `SELECT order_index FROM menu_definitions WHERE menu_key = '/quality-control-parent' LIMIT 1`,
  );
  const parentOrder = parent[0]?.order_index || 7;
  await conn.query(
    `INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
     VALUES ('/poct-quality-control', 'POCT 质控管理', '/quality-control-parent', 'ExperimentOutlined', ?, 1)`,
    [parentOrder],
  );
  logger.info('  - menu_definitions: /poct-quality-control 已插入');
  return true;
}

async function ensureTenantModuleMenus(conn) {
  // 给启用了 poct-quality-control 模块的租户补全菜单记录
  const [r] = await conn.query(
    `INSERT IGNORE INTO tenant_module_menus (tenant_id, module_id, menu_key, is_enabled)
     SELECT tmc.tenant_id, 'poct-quality-control', '/poct-quality-control', 1
       FROM tenant_module_configs tmc
       LEFT JOIN tenant_module_menus tmm
         ON tmm.tenant_id = tmc.tenant_id
        AND tmm.menu_key  = '/poct-quality-control'
      WHERE tmc.module_id = 'poct-quality-control'
        AND tmc.enabled   = 1
        AND tmm.id IS NULL`,
  );
  logger.info(`  - tenant_module_menus: 给 ${r.affectedRows} 个租户补齐 /poct-quality-control`);
  return r.affectedRows;
}

async function main() {
  const conn = await db.getConnection();
  try {
    logger.info('[poct-menu] 开始执行菜单注册...');
    await ensureMenuDefinition(conn);
    await ensureTenantModuleMenus(conn);
    logger.info('[poct-menu] 完成');
  } catch (e) {
    logger.error('[poct-menu] 失败:', e);
    throw e;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  main()
    .then(() => { console.log('\n✅ POCT 菜单注册完成'); process.exit(0); })
    .catch(e => { console.error('\n❌ POCT 菜单注册失败:', e); process.exit(1); });
}

module.exports = { main };
