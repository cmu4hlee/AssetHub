/**
 * 一次性应用「基于实际工作岗位」的角色菜单权限配置。
 * 与 routes/role-menu-map.js 共用同一套领域驱动逻辑，覆盖 menu_definitions 全量菜单。
 *
 * 作用：
 *   1) 确保角色（含 maintenance_engineer）存在于 roles 表；
 *   2) 按领域驱动逻辑刷新 role_menu_permissions（is_visible 0/1）；
 *   3) 按各角色 dataScope 刷新 role_data_scopes（按租户）；
 *   4) 回写 role-menu-permissions.json 为 DB 忠实快照，避免漂移。
 *
 * 说明：routes/roles-permissions.js 的 createMenuPermissionsTables() 在每次
 * GET /user/menus 时也会用同一套逻辑重新 seed，因此本脚本主要用于
 * 「立即生效」与「初次补齐 maintenance_engineer / 全量菜单覆盖」。
 */
const db = require('../config/database');
const fs = require('fs');
const { buildRoleMenuPermissions } = require('../routes/role-menu-map');

const CONFIG_PATH = '/Volumes/移动硬盘（500）/AssetHub/role-menu-permissions.json';
const prev = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const roleMeta = {};
for (const [code, def] of Object.entries(prev.roles || {})) {
  roleMeta[code] = { title: def.title, note: def.note, dataScope: def.dataScope };
}

async function main() {
  const map = buildRoleMenuPermissions();
  const roleCodes = Object.keys(map);

  // 1. 确保角色存在
  const [existingRows] = await db.execute('SELECT role_code FROM roles');
  const existing = new Set(existingRows.map((r) => r.role_code));
  const insertRoleSQL = `
    INSERT INTO roles (role_code, role_name, description, is_system_role, is_active)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      role_name = VALUES(role_name),
      description = VALUES(description),
      updated_at = CURRENT_TIMESTAMP
  `;
  for (const code of roleCodes) {
    if (existing.has(code)) continue;
    const m = roleMeta[code] || { title: code, note: '', dataScope: 'own' };
    await db.execute(insertRoleSQL, [code, m.title, m.note, 1, 1]);
  }
  console.log(`✅ 已确保 ${roleCodes.length} 个角色存在于 roles 表（含 maintenance_engineer）`);

  // 2. 刷新 role_menu_permissions（领域驱动，覆盖全量菜单）
  const [menus] = await db.execute('SELECT menu_key FROM menu_definitions ORDER BY menu_key');
  const menuKeys = menus.map((m) => m.menu_key);
  if (menuKeys.length === 0) throw new Error('menu_definitions 为空，请先初始化菜单定义');
  const upsertMenuSQL = `
    INSERT INTO role_menu_permissions (role, menu_key, is_visible)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible)
  `;
  const result = {
    meta: {
      ...(prev.meta || {}),
      generatedAt: new Date().toISOString(),
      source: 'routes/role-menu-map.js (领域驱动)',
      rolesCount: roleCodes.length,
    },
    roles: {},
  };
  for (const code of roleCodes) {
    const fn = map[code];
    const visibleList = [];
    for (const mk of menuKeys) {
      const v = fn(mk) ? 1 : 0;
      await db.execute(upsertMenuSQL, [code, mk, v]);
      if (v) visibleList.push(mk);
    }
    const m = roleMeta[code] || { title: code, note: '', dataScope: 'own' };
    result.roles[code] = { title: m.title, dataScope: m.dataScope, note: m.note, menus: visibleList };
  }
  console.log(`✅ 已刷新 role_menu_permissions（${menuKeys.length} 个菜单 × ${roleCodes.length} 个角色）`);

  // 3. 刷新 role_data_scopes（按租户）
  try {
    const [tenants] = await db.execute('SELECT id FROM tenants');
    const upsertScopeSQL = `
      INSERT INTO role_data_scopes (role, tenant_id, data_scope, custom_department_codes)
      VALUES (?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE data_scope = ?
    `;
    let n = 0;
    for (const t of tenants) {
      for (const code of roleCodes) {
        const ds = (roleMeta[code] && roleMeta[code].dataScope) || 'own';
        await db.execute(upsertScopeSQL, [code, t.id, ds, ds]);
        n += 1;
      }
    }
    console.log(`✅ 已刷新 role_data_scopes（${tenants.length} 租户 × ${roleCodes.length} 角色 = ${n} 行）`);
  } catch (e) {
    console.warn('⚠️  跳过 role_data_scopes 刷新（表可能不存在或结构不同）：', e.message);
  }

  // 4. 回写 JSON 为 DB 忠实快照（避免与 DB 漂移）
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`✅ 已回写 ${CONFIG_PATH}（忠实快照）`);
  console.log('\n🎉 角色菜单权限已按方案落地（领域驱动，覆盖 menu_definitions 全量菜单）。');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ 应用失败:', e);
    process.exit(1);
  });
