const DEFAULT_MENU_HINTS = {
  'asset-management': { menu_prefixes: ['/assets', '/transfer'], menu_keys: ['/idle'] },
  'asset-ai-assistant': {
    menu_keys: ['/ai-assistant-parent'],
    menu_prefixes: [],
  },
  'inventory-management': { menu_prefixes: ['/inventory'] },
  'procurement-management': { menu_prefixes: ['/procurement', '/acceptance'] },
  'label-management': { menu_prefixes: ['/asset-labels'] },
  'iot-management': {
    menu_prefixes: [
      '/iot',
      '/asset-location',
      '/beacon-location',
      '/asset-monitoring',
      '/environment-monitoring',
    ],
  },
  'user-management': { menu_keys: ['/users'] },
  'permission-management': { menu_keys: ['/roles-permissions'] },
  'module-management': { menu_keys: ['/modules'] },
};

const parseJSONField = field => {
  if (!field) return null;
  try {
    return typeof field === 'string' ? JSON.parse(field) : field;
  } catch (error) {
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

const extractMenuKeysFromRoutes = routes => {
  if (!Array.isArray(routes)) return [];
  const keys = [];
  for (const route of routes) {
    if (!route || typeof route !== 'object') continue;
    if (typeof route.key === 'string' && route.key.trim()) keys.push(route.key.trim());
    if (typeof route.path === 'string' && route.path.trim()) keys.push(route.path.trim());
  }
  return keys;
};

const resolveMenuHints = (frontendConfig, moduleId) => {
  const safeConfig =
    frontendConfig && typeof frontendConfig === 'object' && !Array.isArray(frontendConfig)
      ? frontendConfig
      : {};
  const fallback = DEFAULT_MENU_HINTS[moduleId] || {};

  const explicitMenuKeys = normalizeToArray(safeConfig.menu_keys || safeConfig.menuKeys)
    .concat(extractMenuKeysFromRoutes(safeConfig.menu_routes))
    .concat(extractMenuKeysFromRoutes(safeConfig.menuRoutes));
  const explicitMenuPrefixes = normalizeToArray(safeConfig.menu_prefixes || safeConfig.menuPrefixes);

  return {
    menuKeys: explicitMenuKeys.length > 0 ? explicitMenuKeys : normalizeToArray(fallback.menu_keys),
    menuPrefixes:
      explicitMenuPrefixes.length > 0
        ? explicitMenuPrefixes
        : normalizeToArray(fallback.menu_prefixes),
  };
};

module.exports = {
  DEFAULT_MENU_HINTS,
  parseJSONField,
  normalizeToArray,
  extractMenuKeysFromRoutes,
  resolveMenuHints,
};
