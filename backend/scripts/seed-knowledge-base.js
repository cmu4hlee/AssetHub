/**
 * 知识库模块 - 注册菜单 / 权限 / 模块启用 / 角色授权
 *
 * 幂等：可重复运行,所有 INSERT 走 ON DUPLICATE KEY UPDATE
 * 用法：node scripts/seed-knowledge-base.js
 *
 * 数据落点:
 *   menu_definitions         3 个菜单(父菜单 + 2 个子菜单)
 *   permission_definitions   6 个权限点
 *   system_module_menus      模块↔菜单 关联
 *   tenant_module_configs    给所有活跃租户启用该模块
 *   tenant_role_permissions  给 system_admin / super_admin / asset_admin 分配权限
 *   role_menu_permissions    system_admin 全部可见,其他默认不可见
 */

const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '../.env');
const parentEnvPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else if (fs.existsSync(parentEnvPath)) {
  require('dotenv').config({ path: parentEnvPath });
} else {
  require('dotenv').config();
}

const db = require('../config/database');

const MODULE_ID = 'knowledge-base-management';
const KB_PERMISSIONS = [
  { code: 'knowledge_base:view',    category: 'knowledge_base',         name: '查看知识库',   description: '查看知识库列表 / 文档 / 详情' },
  { code: 'knowledge_base:create',  category: 'knowledge_base',         name: '新建知识库',   description: '创建知识库' },
  { code: 'knowledge_base:edit',    category: 'knowledge_base',         name: '编辑知识库',   description: '编辑知识库 / 文档元数据' },
  { code: 'knowledge_base:delete',  category: 'knowledge_base',         name: '删除知识库',   description: '归档知识库 / 删除文档' },
  { code: 'knowledge_base:upload',  category: 'knowledge_base',         name: '上传文档',     description: '上传 / 重新解析文档' },
  { code: 'knowledge_base:ask',     category: 'knowledge_base',         name: 'AI 智能问答',  description: '使用 AI 智能问答功能' },
];

const KB_MENUS = [
  // 父菜单
  { menu_key: '/knowledge-base-parent', menu_label: '知识库', parent_key: null, icon: 'BookOutlined', order_index: 13 },
  // 子菜单
  { menu_key: '/knowledge-base',        menu_label: '知识库管理', parent_key: '/knowledge-base-parent', icon: null, order_index: 1 },
  { menu_key: '/knowledge-base/qa',     menu_label: '智能问答',   parent_key: '/knowledge-base-parent', icon: null, order_index: 2 },
];

const KB_MODULE_MENUS = [
  { menu_key: '/knowledge-base-parent' },
  { menu_key: '/knowledge-base' },
  { menu_key: '/knowledge-base/qa' },
];

// 给这些角色授权(覆盖 super_admin/system_admin/asset_admin)
const KB_ROLES = ['super_admin', 'system_admin', 'asset_admin'];

async function main() {
  console.log('========================================');
  console.log('  知识库模块 Seed 脚本');
  console.log('========================================\n');

  try {
    // 1. 权限定义
    console.log('▶ 插入 permission_definitions ...');
    for (const p of KB_PERMISSIONS) {
      await db.execute(
        `INSERT INTO permission_definitions (permission, category, name, description)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           category = VALUES(category),
           name = VALUES(name),
           description = VALUES(description)`,
        [p.code, p.category, p.name, p.description]
      );
      console.log(`  ✓ ${p.code}  ${p.name}`);
    }

    // 1b. 先在 system_modules 注册模块(满足 tenant_module_configs 的 FK)
    console.log('\n▶ 注册 system_modules ...');
    const moduleConfig = require('../modules/knowledge-base/config/module.config.js');
    await db.execute(
      `INSERT INTO system_modules
        (id, name, version, description, category, type, status, author,
         dependencies, compatibility, frontend_config, backend_config,
         config_schema, default_config, interfaces)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         version = VALUES(version),
         description = VALUES(description),
         category = VALUES(category),
         type = VALUES(type),
         status = VALUES(status),
         author = VALUES(author),
         dependencies = VALUES(dependencies),
         compatibility = VALUES(compatibility),
         frontend_config = VALUES(frontend_config),
         backend_config = VALUES(backend_config),
         config_schema = VALUES(config_schema),
         default_config = VALUES(default_config),
         interfaces = VALUES(interfaces),
         updated_at = CURRENT_TIMESTAMP`,
      [
        moduleConfig.id,
        moduleConfig.name,
        moduleConfig.version || '1.0.0',
        moduleConfig.description || null,
        moduleConfig.category || 'AI 智能',
        moduleConfig.type || 'business',
        'active',
        moduleConfig.author || 'System',
        JSON.stringify(moduleConfig.dependencies || []),
        JSON.stringify(moduleConfig.compatibility || []),
        JSON.stringify(moduleConfig.frontend_config || {}),
        JSON.stringify(moduleConfig.backend_config || {}),
        JSON.stringify(moduleConfig.config_schema || []),
        JSON.stringify(moduleConfig.default_config || {}),
        JSON.stringify(moduleConfig.interfaces || []),
      ]
    );
    console.log(`  ✓ ${moduleConfig.id} 已注册到 system_modules`);

    // 2. 菜单定义
    console.log('\n▶ 插入 menu_definitions ...');
    for (const m of KB_MENUS) {
      await db.execute(
        `INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
         VALUES (?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           menu_label = VALUES(menu_label),
           parent_key = VALUES(parent_key),
           icon = VALUES(icon),
           order_index = VALUES(order_index),
           updated_at = CURRENT_TIMESTAMP`,
        [m.menu_key, m.menu_label, m.parent_key, m.icon, m.order_index]
      );
      console.log(`  ✓ ${m.menu_key}  ${m.menu_label}`);
    }

    // 3. system_module_menus: 模块与菜单的绑定
    console.log('\n▶ 关联 system_module_menus ...');
    for (const sm of KB_MODULE_MENUS) {
      await db.execute(
        `INSERT INTO system_module_menus (module_id, menu_key, is_enabled)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE
           is_enabled = VALUES(is_enabled),
           updated_at = CURRENT_TIMESTAMP`,
        [MODULE_ID, sm.menu_key]
      );
      console.log(`  ✓ ${MODULE_ID} -> ${sm.menu_key}`);
    }

    // 4. tenant_module_configs: 给所有活跃租户启用
    console.log('\n▶ 启用 tenant_module_configs (所有活跃租户) ...');
    const [tenants] = await db.execute("SELECT id, tenant_name FROM tenants WHERE status = 'active'");
    if (tenants.length === 0) {
      console.log('  ⚠ 未找到活跃租户,跳过');
    }
    for (const t of tenants) {
      await db.execute(
        `INSERT INTO tenant_module_configs (tenant_id, module_id, enabled, enabled_at, version)
         VALUES (?, ?, 1, CURRENT_TIMESTAMP, '1.0.0')
         ON DUPLICATE KEY UPDATE
           enabled = 1,
           enabled_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP`,
        [t.id, MODULE_ID]
      );
      console.log(`  ✓ tenant=${t.id} (${t.tenant_name}) 启用 ${MODULE_ID}`);
    }

    // 5. tenant_role_permissions: 给 admin 类角色授权
    console.log('\n▶ 分配 tenant_role_permissions ...');
    let roleAssignCount = 0;
    for (const t of tenants) {
      for (const role of KB_ROLES) {
        for (const p of KB_PERMISSIONS) {
          await db.execute(
            `INSERT IGNORE INTO tenant_role_permissions (tenant_id, role, permission_key)
             VALUES (?, ?, ?)`,
            [t.id, role, p.code]
          );
          roleAssignCount++;
        }
      }
    }
    console.log(`  ✓ 共 ${roleAssignCount} 条角色-权限关联 (${tenants.length} 租户 × ${KB_ROLES.length} 角色 × ${KB_PERMISSIONS.length} 权限)`);

    // 6. role_menu_permissions: system_admin 全部可见,其他默认不可见
    console.log('\n▶ 设置 role_menu_permissions (system_admin 可见) ...');
    const [roles] = await db.execute('SELECT role_code FROM roles');
    for (const r of roles) {
      const roleCode = r.role_code;
      const isVisible = (roleCode === 'system_admin' || roleCode === 'super_admin') ? 1 : 0;
      for (const m of KB_MENUS) {
        await db.execute(
          `INSERT INTO role_menu_permissions (role, menu_key, is_visible)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible)`,
          [roleCode, m.menu_key, isVisible]
        );
      }
    }
    console.log(`  ✓ ${roles.length} 个角色的菜单可见性已设置`);

    // 7. 同步到 tenant_module_menus (一些旧版路由会读这张表)
    console.log('\n▶ 同步 tenant_module_menus ...');
    for (const t of tenants) {
      for (const sm of KB_MODULE_MENUS) {
        await db.execute(
          `INSERT INTO tenant_module_menus (tenant_id, module_id, menu_key, is_enabled, updated_at)
           VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE
             is_enabled = 1,
             updated_at = CURRENT_TIMESTAMP`,
          [t.id, MODULE_ID, sm.menu_key]
        );
      }
    }
    console.log(`  ✓ 完成`);

    console.log('\n========================================');
    console.log('  ✅ 知识库模块 Seed 完成');
    console.log('========================================');
    console.log('\n提示:');
    console.log('  1. 重启后端使 menu 缓存刷新');
    console.log('  2. 重新登录让前端菜单加载新条目');
    console.log('  3. 访问 /knowledge-base 进入管理页');
    console.log('  4. 访问 /knowledge-base/qa 进入问答页\n');

    process.exit(0);
  } catch (e) {
    console.error('❌ Seed 失败:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
