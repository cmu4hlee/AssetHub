/**
 * 特种设备管理 — 拆分为一级菜单 (迁移)
 *
 * 日期: 2026-07-15
 *
 * 改动:
 * 1. menu_definitions: 新增 /special-equipment-parent 一级节点(放在 /compliance-parent 之前,order 14)
 * 2. menu_definitions: /special-equipment 重新挂到 /special-equipment-parent 下(order 15)
 * 3. tenant_module_menus: 给所有启用了 special-equipment-management 模块、但缺 /special-equipment
 *    菜单记录的租户补齐
 * 4. 清理脏数据: 删除 tenant_module_menus 中 /special-equipment 键名但 module_id
 *    不是 special-equipment-management 的旧记录
 *
 * 影响范围:
 * - 前端: ModuleSelector / dashboardDesktopConfig / roleUtils 已有独立展示
 * - 后端: ALL_MENUS(backend/routes/menus.js) 同步调整
 * - 代码与数据库一致:ALL_MENUS 顺序与 menu_definitions.order_index 对齐
 */

const db = require('../config/database');

async function migrate() {
  console.log('开始执行: 特种设备管理 一级菜单拆分...');

  try {
    await db.transaction(async (conn) => {
      // 1. 插入 /special-equipment-parent 一级节点(若已存在则跳过)
      await conn.execute(
        `INSERT IGNORE INTO menu_definitions
           (menu_key, menu_label, parent_key, icon, order_index, is_active)
         VALUES
           ('/special-equipment-parent', '特种设备管理', NULL, 'AlertOutlined', 14, 1)`
      );
      console.log('✓ menu_definitions: /special-equipment-parent 已存在或插入成功');

      // 2. /special-equipment 重新挂到 /special-equipment-parent 下,order_index 改为 15
      const [u] = await conn.execute(
        `UPDATE menu_definitions
            SET parent_key  = '/special-equipment-parent',
                order_index = 15,
                is_active   = 1
          WHERE menu_key = '/special-equipment'
            AND (parent_key <> '/special-equipment-parent' OR order_index <> 15 OR is_active <> 1)`
      );
      console.log(`✓ menu_definitions: /special-equipment 已重新挂到 /special-equipment-parent (影响 ${u.affectedRows} 行)`);

      // 3. 清理脏数据: /special-equipment 键名 + 非 special-equipment-management 模块
      const [dirty] = await conn.execute(
        `SELECT id FROM tenant_module_menus
          WHERE menu_key = '/special-equipment'
            AND module_id <> 'special-equipment-management'`
      );
      if (dirty.length > 0) {
        await conn.execute(
          `DELETE FROM tenant_module_menus
            WHERE menu_key = '/special-equipment'
              AND module_id <> 'special-equipment-management'`
        );
        console.log(`✓ 清理脏数据: 删除 ${dirty.length} 条非 special-equipment-management 模块的旧记录`);
      } else {
        console.log('✓ 无脏数据需清理');
      }

      // 4. 给启用了模块的租户补全 /special-equipment 菜单记录
      //    仅对当前缺记录的租户生效,避免破坏已有数据
      const [r] = await conn.execute(
        `INSERT IGNORE INTO tenant_module_menus (tenant_id, module_id, menu_key, is_enabled)
         SELECT tmc.tenant_id, 'special-equipment-management', '/special-equipment', 1
           FROM tenant_module_configs tmc
           LEFT JOIN tenant_module_menus tmm
             ON tmm.tenant_id = tmc.tenant_id
            AND tmm.menu_key  = '/special-equipment'
          WHERE tmc.module_id = 'special-equipment-management'
            AND tmc.enabled   = 1
            AND tmm.id IS NULL`
      );
      console.log(`✓ tenant_module_menus: 给 ${r.affectedRows} 个租户补齐 /special-equipment 记录`);
    });

    console.log('✅ 特种设备管理 一级菜单拆分 migration 执行完成');
  } catch (err) {
    console.error('❌ migration 执行失败,已回滚:', err.message);
    throw err;
  }
}

// 允许直接 node 执行
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { name: 'special_equipment_top_level_menu', migrate };
