const path = require('path');
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

const uniqueStrings = values => Array.from(new Set(normalizeToArray(values)));

const sortMenus = menus => {
  return menus.sort((a, b) => {
    const orderA = typeof a.order_index === 'number' ? a.order_index : 0;
    const orderB = typeof b.order_index === 'number' ? b.order_index : 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return String(a.menu_key || '').localeCompare(String(b.menu_key || ''));
  });
};

const normalizeRouteEntries = value => {
  const items = Array.isArray(value) ? value : normalizeToArray(value);
  return items
    .map((item, index) => {
      if (!item) {
        return null;
      }
      if (typeof item === 'string') {
        const trimmed = item.trim();
        return trimmed
          ? {
              key: trimmed,
              path: trimmed,
              order_index: index + 1,
            }
          : null;
      }

      const key = item.key || item.menu_key || item.path;
      const routePath = item.path || item.key || item.menu_key;
      if (!key && !routePath) {
        return null;
      }

      return {
        ...item,
        key: key || routePath,
        path: routePath || key,
        parent: item.parent || item.parent_key || null,
        order_index: typeof item.order_index === 'number' ? item.order_index : index + 1,
      };
    })
    .filter(Boolean);
};

const isDynamicRoute = key => String(key || '').includes(':');

const getSegmentRoot = key => {
  const normalized = String(key || '').trim();
  if (!normalized.startsWith('/')) {
    return null;
  }
  const [, firstSegment] = normalized.split('/');
  return firstSegment ? `/${firstSegment}` : null;
};

const isRootCandidate = key => {
  const normalized = String(key || '').trim();
  if (!normalized.startsWith('/')) {
    return false;
  }
  const segmentRoot = getSegmentRoot(normalized);
  return normalized === segmentRoot || normalized === `${segmentRoot}/dashboard`;
};

const inferRouteParents = routeEntries => {
  const rootBySegment = new Map();

  routeEntries.forEach(route => {
    const key = route.key || route.path;
    const segmentRoot = getSegmentRoot(key);
    if (!segmentRoot || !isRootCandidate(key)) {
      return;
    }

    const roots = rootBySegment.get(segmentRoot) || [];
    roots.push(key);
    rootBySegment.set(segmentRoot, Array.from(new Set(roots)));
  });

  return routeEntries.map(route => {
    if (route.parent) {
      return route;
    }

    const key = route.key || route.path;
    const segmentRoot = getSegmentRoot(key);
    const roots = segmentRoot ? rootBySegment.get(segmentRoot) || [] : [];

    if (roots.length !== 1 || roots[0] === key) {
      return route;
    }

    return {
      ...route,
      parent: roots[0],
    };
  });
};

const mergeUniqueMenus = (...menuGroups) => {
  const menuMap = new Map();
  menuGroups.flat().forEach(menu => {
    if (!menu?.menu_key) {
      return;
    }
    if (!menuMap.has(menu.menu_key)) {
      menuMap.set(menu.menu_key, menu);
      return;
    }

    const existing = menuMap.get(menu.menu_key);
    menuMap.set(menu.menu_key, {
      ...existing,
      ...menu,
      icon: existing.icon || menu.icon,
      menu_label: existing.menu_label || menu.menu_label,
      parent_key: existing.parent_key || menu.parent_key || null,
      order_index:
        typeof existing.order_index === 'number' ? existing.order_index : menu.order_index,
    });
  });

  return sortMenus(Array.from(menuMap.values()));
};

async function safeExecute(query, params) {
  try {
    return await db.execute(query, params);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return [[], []];
    }
    throw error;
  }
}

async function getMenuKeysFromMapping(moduleId) {
  const [rows] = await safeExecute(
    'SELECT menu_key FROM system_module_menus WHERE module_id = ? AND is_enabled = 1',
    [moduleId],
  );
  return Array.isArray(rows) ? rows.map(row => row.menu_key).filter(Boolean) : [];
}

function loadLocalModuleConfig(moduleId) {
  try {
    const configPath = path.join(__dirname, '..', 'modules', moduleId, 'config', 'module.config.js');
    // 使用本地模块配置兜底，避免 DB frontend_config 过期导致菜单缺失。
    // eslint-disable-next-line global-require
    return require(configPath);
  } catch (_error) {
    return null;
  }
}

async function getFrontendConfigFromDatabase(moduleId) {
  const [rows] = await safeExecute('SELECT frontend_config, name FROM system_modules WHERE id = ?', [
    moduleId,
  ]);
  if (!rows || rows.length === 0) {
    return { frontendConfig: null, moduleName: null };
  }

  return {
    frontendConfig: parseJSONField(rows[0].frontend_config) || null,
    moduleName: rows[0].name || null,
  };
}

async function getModuleFrontendContext(moduleId) {
  const localConfig = loadLocalModuleConfig(moduleId);
  if (localConfig?.frontend_config) {
    return {
      frontendConfig: localConfig.frontend_config,
      moduleName: localConfig.name || null,
      source: 'local',
    };
  }

  const { frontendConfig, moduleName } = await getFrontendConfigFromDatabase(moduleId);
  return {
    frontendConfig: frontendConfig || {},
    moduleName,
    source: frontendConfig ? 'database' : 'none',
  };
}

async function getMenuHintsFromFrontendConfig(moduleId) {
  const { frontendConfig, moduleName, source } = await getModuleFrontendContext(moduleId);
  const safeConfig = frontendConfig || {};

  const menuKeys = uniqueStrings(safeConfig.menu_keys || safeConfig.menuKeys);
  const menuPrefixes = uniqueStrings(safeConfig.menu_prefixes || safeConfig.menuPrefixes);
  const routeEntries = inferRouteParents(
    normalizeRouteEntries(
      safeConfig.menu_routes || safeConfig.menuRoutes || safeConfig.routes || [],
    ),
  );

  return {
    menuKeys,
    menuPrefixes,
    routeEntries,
    moduleName,
    source,
  };
}

async function getMenuKeysByPrefixes(prefixes) {
  const safePrefixes = uniqueStrings(prefixes);
  if (safePrefixes.length === 0) {
    return [];
  }

  const conditions = safePrefixes.map(() => '(menu_key LIKE ? OR parent_key LIKE ?)').join(' OR ');
  const params = [];
  safePrefixes.forEach(prefix => {
    const like = `${prefix}%`;
    params.push(like, like);
  });

  const [rows] = await safeExecute(
    `SELECT menu_key FROM menu_definitions WHERE is_active = 1 AND (${conditions})`,
    params,
  );
  return Array.isArray(rows) ? rows.map(row => row.menu_key).filter(Boolean) : [];
}

async function getMenusByKeysWithParents(menuKeys) {
  const uniqueKeys = uniqueStrings(menuKeys);
  if (uniqueKeys.length === 0) {
    return [];
  }

  const menuMap = new Map();
  let pending = uniqueKeys;

  while (pending.length > 0) {
    const placeholders = pending.map(() => '?').join(',');
    const [rows] = await safeExecute(
      `SELECT menu_key, menu_label, parent_key, icon, order_index
       FROM menu_definitions
       WHERE is_active = 1 AND menu_key IN (${placeholders})`,
      pending,
    );

    const nextParents = [];
    for (const row of rows) {
      if (!menuMap.has(row.menu_key)) {
        menuMap.set(row.menu_key, row);
      }
      if (row.parent_key && !menuMap.has(row.parent_key)) {
        nextParents.push(row.parent_key);
      }
    }

    pending = Array.from(new Set(nextParents));
  }

  return sortMenus(Array.from(menuMap.values()));
}

function buildSyntheticMenus(moduleId, menuKeys, routeEntries, existingKeys, moduleName) {
  const explicitKeySet = new Set(uniqueStrings(menuKeys));

  let selectedRoutes = [];
  if (explicitKeySet.size > 0) {
    selectedRoutes = routeEntries.filter(route => explicitKeySet.has(route.key || route.path));
  } else {
    selectedRoutes = routeEntries.filter(route => {
      const key = route.key || route.path;
      return key && !route.parent && !isDynamicRoute(key);
    });
  }

  const selectedKeys = new Set(selectedRoutes.map(route => route.key || route.path));
  routeEntries.forEach(route => {
    const parentKey = route.parent;
    const key = route.key || route.path;
    if (!key || !parentKey) {
      return;
    }
    if (selectedKeys.has(parentKey)) {
      selectedRoutes.push(route);
      selectedKeys.add(key);
    }
  });

  const syntheticMenus = inferRouteParents(selectedRoutes)
    .filter(route => {
      const key = route.key || route.path;
      if (!key || existingKeys.has(key) || isDynamicRoute(key)) {
        return false;
      }
      return explicitKeySet.size > 0 || Boolean(route.label || route.menu_label);
    })
    .map((route, index) => {
      const key = route.key || route.path;
      const inferredRoot = isRootCandidate(key);
      const fallbackLabel =
        route.label ||
        route.menu_label ||
        (inferredRoot ? moduleName || moduleId : key.replace(/^\//, ''));

      return {
        menu_key: key,
        menu_label: fallbackLabel,
        parent_key: route.parent || null,
        icon: route.icon || null,
        order_index: typeof route.order_index === 'number' ? route.order_index : index + 1,
      };
    });

  return mergeUniqueMenus(syntheticMenus);
}

function filterMenuDefinitionsByTenantConfig(menuDefinitions, tenantMenuConfigs = []) {
  if (!Array.isArray(menuDefinitions) || menuDefinitions.length === 0) {
    return [];
  }

  if (!Array.isArray(tenantMenuConfigs) || tenantMenuConfigs.length === 0) {
    return menuDefinitions;
  }

  const menuMap = new Map(menuDefinitions.map(menu => [menu.menu_key, menu]));
  const enabledKeys = new Set(
    tenantMenuConfigs.filter(row => Number(row?.is_enabled) === 1).map(row => row.menu_key),
  );

  if (enabledKeys.size === 0) {
    return [];
  }

  let changed = true;
  while (changed) {
    changed = false;
    Array.from(enabledKeys).forEach(menuKey => {
      const parentKey = menuMap.get(menuKey)?.parent_key;
      if (parentKey && menuMap.has(parentKey) && !enabledKeys.has(parentKey)) {
        enabledKeys.add(parentKey);
        changed = true;
      }
    });
  }

  return menuDefinitions.filter(menu => enabledKeys.has(menu.menu_key));
}

async function getModuleMenuDefinitions(moduleId) {
  const mappedKeys = await getMenuKeysFromMapping(moduleId);
  const { menuKeys, menuPrefixes, routeEntries, moduleName } =
    await getMenuHintsFromFrontendConfig(moduleId);

  const hintedKeySet = new Set([...mappedKeys, ...menuKeys]);
  if (hintedKeySet.size === 0) {
    routeEntries
      .filter(route => route.key && !route.parent && !isDynamicRoute(route.key))
      .forEach(route => hintedKeySet.add(route.key));
  }

  if (menuPrefixes.length > 0) {
    const prefixKeys = await getMenuKeysByPrefixes(menuPrefixes);
    prefixKeys.forEach(key => hintedKeySet.add(key));
  }

  const dbMenus = await getMenusByKeysWithParents(Array.from(hintedKeySet));
  const existingKeys = new Set(dbMenus.map(menu => menu.menu_key));
  const syntheticMenus = buildSyntheticMenus(
    moduleId,
    menuKeys,
    routeEntries,
    existingKeys,
    moduleName,
  );

  return mergeUniqueMenus(dbMenus, syntheticMenus);
}

module.exports = {
  filterMenuDefinitionsByTenantConfig,
  getModuleMenuDefinitions,
  getMenuHintsFromFrontendConfig,
};
