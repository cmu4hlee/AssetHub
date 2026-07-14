/**
 * 多租户角色权限覆盖 — 建表 + 克隆脚本
 *
 * 模型：per-tenant 覆盖标准角色（按 tenant_id + role_code）。
 *   tenant_role_menus(tenant_id, role, menu_key, is_visible)        覆盖 role_menu_permissions
 *   tenant_role_data_scopes(tenant_id, role, data_scope, ...)       覆盖 role_data_scopes
 *   tenant_role_permissions(tenant_id, role, permission_key)        覆盖 role_permissions
 *
 * 解析时优先读租户表；租户表无该 (tenant,role) 记录则回退全局表（向后兼容）。
 * 幂等：可重复执行。
 *
 * 用法：node scripts/migrate-tenant-role-overrides.js
 */
const db = require('../config/database');

const DDL = [
  `CREATE TABLE IF NOT EXISTS tenant_role_menus (
     id            BIGINT PRIMARY KEY AUTO_INCREMENT,
     tenant_id     INT NOT NULL,
     role          VARCHAR(64) NOT NULL,
     menu_key      VARCHAR(128) NOT NULL,
     is_visible    TINYINT DEFAULT 0,
     created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
     updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     UNIQUE KEY uk_tenant_role_menu (tenant_id, role, menu_key),
     KEY idx_tenant_role (tenant_id, role)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS tenant_role_data_scopes (
     id            BIGINT PRIMARY KEY AUTO_INCREMENT,
     tenant_id     INT NOT NULL,
     role          VARCHAR(64) NOT NULL,
     data_scope    ENUM('all','department','self','custom') NOT NULL DEFAULT 'department',
     custom_department_codes JSON,
     created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
     updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     UNIQUE KEY uk_tenant_role_scope (tenant_id, role),
     KEY idx_tenant_role (tenant_id, role)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS tenant_role_permissions (
     id            BIGINT PRIMARY KEY AUTO_INCREMENT,
     tenant_id     INT NOT NULL,
     role          VARCHAR(64) NOT NULL,
     permission_key VARCHAR(128) NOT NULL,
     created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY uk_tenant_role_perm (tenant_id, role, permission_key),
     KEY idx_tenant_role (tenant_id, role)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function tableExists(name) {
  const [r] = await db.execute(
    `SELECT COUNT(*) c FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?`,
    [name]
  );
  return r[0].c > 0;
}

async function main() {
  console.log('== 1. 建表 ==');
  for (const sql of DDL) {
    await db.execute(sql);
    const name = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
    console.log('  ✓', name);
  }

  // 租户列表
  const [tenants] = await db.execute("SELECT id FROM tenants WHERE status='active'");
  console.log('\n== 2. 活跃租户数:', tenants.length, '==');

  // 标准角色（从 roles 表取；回退硬编码 12 个）
  let roles;
  try {
    const [rr] = await db.execute("SELECT role_code FROM roles WHERE is_active=1");
    roles = rr.map(r => r.role_code);
  } catch (e) {
    roles = ['super_admin','system_admin','asset_admin','department_admin','metrology_admin','quality_admin','maintenance_admin','maintenance_engineer','acceptance_admin','transfer_admin','inventory_admin','user'];
  }
  console.log('  标准角色数:', roles.length);

  // 3. 克隆菜单权限 role_menu_permissions → tenant_role_menus
  console.log('\n== 3. 克隆 role_menu_permissions → tenant_role_menus ==');
  let menuInserted = 0;
  const [globalMenus] = await db.execute('SELECT role, menu_key, is_visible FROM role_menu_permissions');
  for (const t of tenants) {
    for (const gm of globalMenus) {
      try {
        await db.execute(
          `INSERT IGNORE INTO tenant_role_menus (tenant_id, role, menu_key, is_visible) VALUES (?,?,?,?)`,
          [t.id, gm.role, gm.menu_key, gm.is_visible]
        );
        menuInserted++;
      } catch (e) { /* ignore dup */ }
    }
  }
  console.log('  插入/忽略菜单行:', menuInserted, '(租户×全局菜单行)');

  // 4. 克隆 role_data_scopes → tenant_role_data_scopes
  console.log('\n== 4. 克隆 role_data_scopes → tenant_role_data_scopes ==');
  let scopeInserted = 0;
  if (await tableExists('role_data_scopes')) {
    const [gs] = await db.execute('SELECT role, tenant_id, data_scope, custom_department_codes FROM role_data_scopes');
    for (const g of gs) {
      const tid = g.tenant_id || tenants[0]?.id;
      if (!tid) continue;
      try {
        await db.execute(
          `INSERT IGNORE INTO tenant_role_data_scopes (tenant_id, role, data_scope, custom_department_codes) VALUES (?,?,?,?)`,
          [tid, g.role, g.data_scope, g.custom_department_codes]
        );
        scopeInserted++;
      } catch (e) { /* ignore */ }
    }
  }
  console.log('  插入/忽略数据范围行:', scopeInserted);

  // 5. 克隆 role_permissions → tenant_role_permissions（若表存在）
  console.log('\n== 5. 克隆 role_permissions → tenant_role_permissions ==');
  let permInserted = 0;
  if (await tableExists('role_permissions')) {
    const [gp] = await db.execute('SELECT role, permission FROM role_permissions');
    for (const t of tenants) {
      for (const g of gp) {
        try {
          await db.execute(
            `INSERT IGNORE INTO tenant_role_permissions (tenant_id, role, permission_key) VALUES (?,?,?)`,
            [t.id, g.role, g.permission]
          );
          permInserted++;
        } catch (e) { /* ignore */ }
      }
    }
    console.log('  插入/忽略操作权限行:', permInserted);
  } else {
    console.log('  role_permissions 表不存在，跳过（authorize 将回退默认权限）');
  }

  // 6. 汇总
  const [[mc]] = await db.execute('SELECT COUNT(*) c FROM tenant_role_menus');
  const [[sc]] = await db.execute('SELECT COUNT(*) c FROM tenant_role_data_scopes');
  const [[pc]] = await db.execute('SELECT COUNT(*) c FROM tenant_role_permissions');
  console.log('\n== 完成 ==');
  console.log('  tenant_role_menus 行数:', mc.c);
  console.log('  tenant_role_data_scopes 行数:', sc.c);
  console.log('  tenant_role_permissions 行数:', pc.c);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
