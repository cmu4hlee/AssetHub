const db = require('../config/database');
const { getModuleMenuDefinitions } = require('../services/module-menu.service');

async function syncTenantModuleMenus(options = {}) {
  const { forceResync = false } = options; // 是否强制重新同步

  try {
    const [enabledConfigs] = await db.execute(
      'SELECT tenant_id, module_id FROM tenant_module_configs WHERE enabled = 1',
    );

    if (!enabledConfigs || enabledConfigs.length === 0) {
      console.log('未找到已启用模块配置，跳过同步。');
      return;
    }

    let syncedCount = 0;
    let skippedCount = 0;

    for (const config of enabledConfigs) {
      const { tenant_id, module_id } = config;

      // 获取模块的菜单定义
      const menuDefinitions = await getModuleMenuDefinitions(module_id);
      if (!menuDefinitions || menuDefinitions.length === 0) {
        console.log(`模块 ${module_id} 无菜单定义，跳过 tenant ${tenant_id}`);
        continue;
      }

      // 检查现有记录数量
      const [existingCount] = await db.execute(
        'SELECT COUNT(*) as cnt FROM tenant_module_menus WHERE tenant_id = ? AND module_id = ?',
        [tenant_id, module_id],
      );
      const existingMenuCount = existingCount[0]?.cnt || 0;

      // 如果不是强制同步，且现有菜单数量与服务定义一致，则跳过
      if (!forceResync && existingMenuCount > 0 && existingMenuCount >= menuDefinitions.length) {
        console.log(`租户 ${tenant_id} 模块 ${module_id} 已有 ${existingMenuCount}/${menuDefinitions.length} 菜单，跳过`);
        skippedCount++;
        continue;
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // 如果启用强制同步，先删除现有记录
        if (forceResync && existingMenuCount > 0) {
          await connection.execute(
            'DELETE FROM tenant_module_menus WHERE tenant_id = ? AND module_id = ?',
            [tenant_id, module_id],
          );
          console.log(`强制重新同步: 已删除租户 ${tenant_id} 模块 ${module_id} 的 ${existingMenuCount} 条菜单记录`);
        }

        // 插入/更新菜单记录
        for (const menu of menuDefinitions) {
          await connection.execute(
            `INSERT INTO tenant_module_menus (tenant_id, module_id, menu_key, is_enabled, created_at, updated_at)
             VALUES (?, ?, ?, 1, NOW(), NOW())
             ON DUPLICATE KEY UPDATE is_enabled = 1, updated_at = NOW()`,
            [tenant_id, module_id, menu.menu_key],
          );
        }
        await connection.commit();
        console.log(`已同步租户 ${tenant_id} 的模块 ${module_id}: ${menuDefinitions.length} 个菜单`);
        syncedCount++;
      } catch (error) {
        await connection.rollback();
        console.warn(`同步租户 ${tenant_id} 模块 ${module_id} 失败:`, error.message);
      } finally {
        connection.release();
      }
    }

    console.log(`\n同步完成: 同步了 ${syncedCount} 个模块, 跳过了 ${skippedCount} 个模块`);
  } catch (error) {
    console.error('同步租户模块菜单失败:', error);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  syncTenantModuleMenus();
}

module.exports = syncTenantModuleMenus;
