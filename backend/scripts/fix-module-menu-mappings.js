/**
 * 修复模块菜单映射脚本
 * 1. 清理 system_module_menus 表
 * 2. 为缺少 menu_keys/menu_prefixes 的模块添加正确配置
 * 3. 重新同步到 tenant_module_menus
 *
 * 注意：只配置在 menu_definitions 中实际存在的菜单
 */

const db = require('../config/database');

// 基于 menu_definitions 表中实际存在的菜单
const MODULE_MENU_MAPPINGS = {
  // 用户管理模块
  'user-management': {
    menu_keys: ['/users', '/roles-permissions', '/audit-logs'],
    menu_prefixes: ['/users', '/roles-permissions'],
  },
  // 部门管理模块
  'department-management': {
    menu_keys: ['/departments'],
    menu_prefixes: ['/departments'],
  },
  // 资产管理模块
  'asset-management': {
    menu_keys: ['/assets', '/assets/add', '/assets/import', '/inventory', '/inventory/self', '/idle', '/temp-assets', '/asset-labels/templates', '/asset-labels/print', '/depreciation', '/asset-depreciation'],
    menu_prefixes: ['/assets', '/inventory', '/idle', '/temp-assets', '/asset-labels', '/depreciation'],
  },
  // 维修维护模块
  'maintenance-management': {
    menu_keys: ['/maintenance/logs', '/maintenance/plans', '/maintenance/templates', '/maintenance/requests', '/maintenance/efficiency', '/maintenance/reminders', '/maintenance/usage-triggers', '/maintenance/asset-usage', '/maintenance/workorders', '/maintenance/costs'],
    menu_prefixes: ['/maintenance'],
  },
  // 计量管理模块
  'quality-control': {
    menu_keys: ['/quality-control/metrology', '/quality-control/metrology/upload', '/quality-control/qc', '/quality-control/statistics'],
    menu_prefixes: ['/quality-control'],
  },
  // 物联网管理模块
  'iot-management': {
    menu_keys: ['/asset-location', '/beacon-location', '/iot-devices', '/asset-monitoring', '/environment-monitoring'],
    menu_prefixes: ['/asset-location', '/beacon-location', '/iot-devices', '/asset-monitoring', '/environment-monitoring', '/iot'],
  },
  // 折旧管理模块
  'depreciation-management': {
    menu_keys: ['/depreciation', '/asset-depreciation', '/depreciation-parent', '/depreciation/metrology-costs', '/depreciation/quality-costs', '/depreciation/other-costs'],
    menu_prefixes: ['/depreciation'],
  },
  // 采购管理模块
  'procurement-management': {
    menu_keys: ['/procurement/approval', '/procurement/contracts', '/procurement/tender-docs', '/procurement/execution', '/procurement/acceptance'],
    menu_prefixes: ['/procurement'],
  },
  // 盘点管理模块
  'inventory-management': {
    menu_keys: ['/inventory', '/inventory/self', '/inventory-parent'],
    menu_prefixes: ['/inventory'],
  },
  // 标签管理模块
  'label-management': {
    menu_keys: ['/asset-labels/templates', '/asset-labels/print'],
    menu_prefixes: ['/asset-labels'],
  },
  // AI助手模块
  'asset-ai-assistant': {
    menu_keys: ['/ai-assistant', '/ai-assistant/ct-maintenance', '/ai-assistant-parent', '/ai-maintenance', '/ai-question-records', '/ai-tools-parent', '/asset-ai-analysis', '/asset-query'],
    menu_prefixes: ['/ai-assistant', '/ai-maintenance', '/ai-tools', '/asset-ai'],
  },
  // 质控管理模块
  'quality-assurance-management': {
    menu_keys: ['/quality-control/qc', '/quality-control/statistics', '/quality-assurance-parent'],
    menu_prefixes: ['/quality-control', '/quality-assurance'],
  },
  // 不良事件模块
  'adverse-event': {
    menu_keys: ['/adverse-reaction', '/adverse-event-parent'],
    menu_prefixes: ['/adverse-reaction', '/adverse-event'],
  },
  // 预防性维护模块
  'preventive-maintenance-management': {
    menu_keys: ['/maintenance/plans', '/maintenance/templates', '/maintenance-parent'],
    menu_prefixes: ['/maintenance/plans', '/maintenance/templates', '/maintenance'],
  },
  // CT维护助手模块
  'ct-maintenance-assistant-management': {
    menu_keys: ['/ai-assistant/ct-maintenance'],
    menu_prefixes: ['/ai-assistant/ct-maintenance'],
  },
  // 验收管理模块
  'acceptance-management': {
    menu_keys: ['/acceptance', '/acceptance/create', '/acceptance-application', '/acceptance-applications', '/asset-acceptance', '/asset-acceptance-parent'],
    menu_prefixes: ['/acceptance', '/acceptance-application', '/asset-acceptance'],
  },
  // 技术资料模块
  'technical-documents-management': {
    menu_keys: ['/technical-documents', '/technical-documents/upload', '/technical-documents/review', '/technical-documents-parent', '/technical-documents/ai'],
    menu_prefixes: ['/technical-documents'],
  },
  // 系统管理模块 (模块管理)
  'module-management': {
    menu_keys: ['/modules'],
    menu_prefixes: ['/modules'],
  },
  // 以下模块不承载独立侧边栏菜单，保持为空
  'quality-common': {
    menu_keys: [],
    menu_prefixes: [],
  },
  'asset-risk-management': {
    menu_keys: ['/risk/dashboard', '/risk/assessment', '/risk/classification', '/risk/control'],
    menu_prefixes: ['/risk'],
  },
  'asset-usage-management': {
    menu_keys: [],
    menu_prefixes: [],
  },
  'compliance-management': {
    menu_keys: [
      '/compliance',
      '/compliance/maintenance-level',
      '/maintenance/plans',
      '/maintenance/templates',
      '/maintenance/reminders',
      '/maintenance/efficiency',
    ],
    menu_prefixes: [
      '/compliance',
      '/maintenance/plans',
      '/maintenance/templates',
      '/maintenance/reminders',
      '/maintenance/efficiency',
    ],
  },
  'safety-inspection-management': {
    menu_keys: ['/safety-inspection'],
    menu_prefixes: ['/safety-inspection'],
  },
  'special-equipment-management': {
    menu_keys: ['/special-equipment'],
    menu_prefixes: ['/special-equipment'],
  },
  'staff-qualification': {
    menu_keys: ['/staff/dashboard', '/staff/qualifications', '/staff/training', '/staff/assessments'],
    menu_prefixes: ['/staff'],
  },
  'uptime-management': {
    menu_keys: ['/uptime/dashboard', '/uptime/overview', '/uptime/operation-logs', '/uptime/statistics'],
    menu_prefixes: ['/uptime'],
  },
  'iot-asset-monitoring-management': {
    menu_keys: ['/asset-monitoring'],
    menu_prefixes: ['/asset-monitoring'],
  },
  'iot-environment-monitoring-management': {
    menu_keys: ['/environment-monitoring'],
    menu_prefixes: ['/environment-monitoring'],
  },
  'iot-geo-location-management': {
    menu_keys: ['/asset-location'],
    menu_prefixes: ['/asset-location'],
  },
  'iot-zone-location-management': {
    menu_keys: ['/beacon-location'],
    menu_prefixes: ['/beacon-location'],
  },
};

async function fixModuleMenuMappings() {
  console.log('=== 开始修复模块菜单映射 ===\n');

  try {
    // Step 1: 清空 system_module_menus 表
    console.log('Step 1: 清空 system_module_menus 表...');
    await db.execute('DELETE FROM system_module_menus');
    console.log('  ✓ 已清空 system_module_menus 表\n');

    // Step 2: 更新各模块的 frontend_config
    console.log('Step 2: 更新模块的 frontend_config...');
    for (const [moduleId, config] of Object.entries(MODULE_MENU_MAPPINGS)) {
      const frontendConfig = {
        menu_keys: config.menu_keys,
        menu_prefixes: config.menu_prefixes,
        menu_routes: [],  // 保留为空，让模块使用 menu_keys/menu_prefixes
      };

      const [result] = await db.execute(
        'UPDATE system_modules SET frontend_config = ? WHERE id = ?',
        [JSON.stringify(frontendConfig), moduleId],
      );

      if (result.affectedRows > 0) {
        console.log(`  ✓ ${moduleId}: 添加了 ${config.menu_keys.length} 个 menu_keys, ${config.menu_prefixes.length} 个 menu_prefixes`);
      } else {
        console.log(`  ✗ ${moduleId}: 未找到或未更新`);
      }
    }
    console.log('');

    // Step 3: 重新同步到 tenant_module_menus
    console.log('Step 3: 重新同步到 tenant_module_menus...');
    const { getModuleMenuDefinitions } = require('../services/module-menu.service');

    const [enabledConfigs] = await db.execute(
      'SELECT tenant_id, module_id FROM tenant_module_configs WHERE enabled = 1',
    );

    let syncedCount = 0;
    for (const config of enabledConfigs) {
      const { tenant_id, module_id } = config;
      const menuDefinitions = await getModuleMenuDefinitions(module_id);

      if (!menuDefinitions || menuDefinitions.length === 0) {
        continue;
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // 先删除现有记录
        await connection.execute(
          'DELETE FROM tenant_module_menus WHERE tenant_id = ? AND module_id = ?',
          [tenant_id, module_id],
        );

        // 插入新记录
        for (const menu of menuDefinitions) {
          await connection.execute(
            `INSERT INTO tenant_module_menus (tenant_id, module_id, menu_key, is_enabled, created_at, updated_at)
             VALUES (?, ?, ?, 1, NOW(), NOW())`,
            [tenant_id, module_id, menu.menu_key],
          );
        }

        await connection.commit();
        syncedCount++;
      } catch (error) {
        await connection.rollback();
        console.warn(`  ! 同步失败 tenant ${tenant_id} module ${module_id}: ${error.message}`);
      } finally {
        connection.release();
      }
    }
    console.log(`  ✓ 成功同步 ${syncedCount} 个模块\n`);

    console.log('=== 修复完成 ===');
  } catch (error) {
    console.error('修复失败:', error);
    throw error;
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  fixModuleMenuMappings();
}

module.exports = fixModuleMenuMappings;
