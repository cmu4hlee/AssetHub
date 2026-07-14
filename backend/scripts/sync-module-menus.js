const db = require('../config/database');

const parseJSONField = field => {
  if (!field) return null;
  try {
    return typeof field === 'string' ? JSON.parse(field) : field;
  } catch (e) {
    console.error('解析JSON字段失败:', e);
    return null;
  }
};

const normalizeToArray = value => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => (typeof item === 'string' ? item.trim() : item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
};

const DEFAULT_MENU_HINTS = {
  'asset-management': { menu_prefixes: ['/assets'] },
  'user-management': { menu_keys: ['/users'] },
  'permission-management': { menu_keys: ['/roles-permissions'] },
  'module-management': { menu_keys: ['/modules'] },
  dashboard: { menu_keys: ['/dashboard'] },
};

async function ensureSystemModuleMenusTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_module_menus (
      id INT AUTO_INCREMENT PRIMARY KEY,
      module_id VARCHAR(50) NOT NULL COMMENT '模块ID',
      menu_key VARCHAR(100) NOT NULL COMMENT '菜单键',
      is_enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT NULL,
      UNIQUE KEY uk_module_menu (module_id, menu_key),
      INDEX idx_module_id (module_id),
      INDEX idx_menu_key (menu_key),
      FOREIGN KEY (module_id) REFERENCES system_modules(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_key) REFERENCES menu_definitions(menu_key) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统模块菜单映射表'
  `);
}

async function getMenuKeysByPrefixes(prefixes) {
  const safePrefixes = normalizeToArray(prefixes);
  if (safePrefixes.length === 0) {
    return [];
  }

  const conditions = safePrefixes.map(() => '(menu_key LIKE ? OR parent_key LIKE ?)').join(' OR ');
  const params = [];
  safePrefixes.forEach(prefix => {
    const like = `${prefix}%`;
    params.push(like, like);
  });

  const [rows] = await db.execute(
    `SELECT menu_key FROM menu_definitions WHERE is_active = 1 AND (${conditions})`,
    params,
  );
  return Array.isArray(rows) ? rows.map(row => row.menu_key).filter(Boolean) : [];
}

async function resolveMenuKeys(menuKeys, menuPrefixes) {
  const keys = new Set(normalizeToArray(menuKeys));
  if (menuPrefixes && menuPrefixes.length > 0) {
    const prefixKeys = await getMenuKeysByPrefixes(menuPrefixes);
    prefixKeys.forEach(key => keys.add(key));
  }
  return Array.from(keys);
}

async function filterExistingMenuKeys(keys) {
  const uniqueKeys = normalizeToArray(keys);
  if (uniqueKeys.length === 0) {
    return [];
  }
  const [rows] = await db.execute(
    'SELECT menu_key FROM menu_definitions WHERE menu_key IN (?)',
    [uniqueKeys],
  );
  return Array.isArray(rows) ? rows.map(row => row.menu_key).filter(Boolean) : [];
}

async function syncModuleMenus() {
  try {
    await ensureSystemModuleMenusTable();

    const [modules] = await db.execute('SELECT id, frontend_config FROM system_modules');
    if (!modules || modules.length === 0) {
      console.log('未找到系统模块数据，跳过同步。');
      return;
    }

    for (const module of modules) {
      const frontendConfig = parseJSONField(module.frontend_config) || {};
      const fallback = DEFAULT_MENU_HINTS[module.id] || {};

      const menuKeys = normalizeToArray(frontendConfig.menu_keys || frontendConfig.menuKeys);
      const menuPrefixes = normalizeToArray(
        frontendConfig.menu_prefixes || frontendConfig.menuPrefixes,
      );
      const finalMenuKeys = menuKeys.length > 0 ? menuKeys : normalizeToArray(fallback.menu_keys);
      const finalMenuPrefixes =
        menuPrefixes.length > 0 ? menuPrefixes : normalizeToArray(fallback.menu_prefixes);

      const resolvedKeys = await resolveMenuKeys(finalMenuKeys, finalMenuPrefixes);
      const existingKeys = await filterExistingMenuKeys(resolvedKeys);

      if (existingKeys.length === 0) {
        if (resolvedKeys.length > 0) {
          console.log(`模块 ${module.id} 的菜单提示未匹配到 menu_definitions，跳过。`);
        } else {
          console.log(`模块 ${module.id} 未提供菜单提示，跳过。`);
        }
        continue;
      }

      for (const menuKey of existingKeys) {
        await db.execute(
          `INSERT INTO system_module_menus (module_id, menu_key, is_enabled, updated_at)
           VALUES (?, ?, 1, NOW())
           ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), updated_at = VALUES(updated_at)`,
          [module.id, menuKey],
        );
      }

      console.log(`模块 ${module.id} 同步 ${existingKeys.length} 条菜单映射`);
    }
  } catch (error) {
    console.error('同步模块菜单失败:', error);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  syncModuleMenus();
}

module.exports = syncModuleMenus;
