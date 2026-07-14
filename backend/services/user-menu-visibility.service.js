const DEFAULT_ROLE_MENU_FALLBACK = ['/dashboard', '/assets', '/inventory', '/transfer', '/idle'];

const DEPRECIATION_MENU_KEYS = [
  '/depreciation-parent',
  '/depreciation',
  '/depreciation/metrology-costs',
  '/depreciation/quality-costs',
  '/depreciation/other-costs',
  '/asset-depreciation',
];

const AI_ASSISTANT_MENU_KEYS = [
  '/ai-assistant-parent',
  '/ai-assistant',
  '/ai-maintenance',
];

const LEGACY_HIDDEN_MENU_KEYS = new Set([
  '/ai-question-records',
  '/technical-documents/ai',
  '/asset-query',
  '/ai-assistant/ct-maintenance',
  '/ai-tools-parent',
]);

const ADMIN_MANAGEMENT_MENU_KEYS = [
  '/modules',
  '/system-parent',
  '/users',
  '/departments',
  '/roles-permissions',
  '/audit-logs',
  '/backup',
  '/database-connection',
  '/system/token-management',
  '/api-docs',
  '/api-documentation',
];

// 核心模块：即使租户配置缺失，也应默认可用
const CORE_MODULE_IDS = [
  'user-management',
  'asset-management',
  'department-management',
  'permission-management',
  'asset-ai-assistant',
  'iot-management',
  'module-management',
];

const uniqueMenuKeys = menuKeys =>
  Array.from(
    new Set(
      (Array.isArray(menuKeys) ? menuKeys : []).filter(
        key => Boolean(key) && !LEGACY_HIDDEN_MENU_KEYS.has(key),
      ),
    ),
  );

const resolveMenuRole = ({ userRole, isSuperAdmin, tenantId }) =>
  isSuperAdmin && tenantId ? 'system_admin' : userRole;

const shouldKeepAdminManagementMenus = ({ userRole, menuRole, isSuperAdmin }) =>
  isSuperAdmin || userRole === 'system_admin' || menuRole === 'system_admin';

async function ensureMenuDefinitionsReady({ db, createMenuPermissionsTables, logger }) {
  try {
    await db.execute('SELECT 1 FROM menu_definitions LIMIT 1');
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      throw error;
    }
    if (typeof createMenuPermissionsTables !== 'function') {
      throw error;
    }
    logger?.log?.('[菜单权限] 检测到表不存在，开始自动创建...');
    await createMenuPermissionsTables();
    logger?.log?.('[菜单权限] 表创建成功');
  }
}

async function fetchRoleMenus({ db, role, logger }) {
  try {
    const [rows] = await db.execute(
      `SELECT menu_key
       FROM role_menu_permissions
       WHERE role = ? AND is_visible = 1`,
      [role],
    );
    return uniqueMenuKeys((rows || []).map(row => row?.menu_key));
  } catch (error) {
    logger?.warn?.('获取角色菜单失败，返回默认菜单:', error.message);
    return [...DEFAULT_ROLE_MENU_FALLBACK];
  }
}

const applyCompatibilityMenus = menuKeys => {
  let merged = uniqueMenuKeys(menuKeys);

  if (merged.includes('/assets-parent') || merged.includes('/assets')) {
    merged = uniqueMenuKeys([...merged, ...DEPRECIATION_MENU_KEYS]);
  }

  if (
    merged.includes('/ai-assistant-parent') ||
    merged.includes('/ai-assistant')
  ) {
    merged = uniqueMenuKeys([...merged, ...AI_ASSISTANT_MENU_KEYS]);
  }

  return merged;
};

const applyRoleSpecificVisibility = ({ menuKeys, menuRole }) => {
  if (menuRole !== 'system_admin') {
    return uniqueMenuKeys(menuKeys);
  }
  return uniqueMenuKeys(menuKeys).filter(menuKey => menuKey !== '/tenants');
};

async function applyTenantModuleFiltering({
  db,
  menuKeys,
  tenantId,
  userRole,
  menuRole,
  isSuperAdmin,
  logger,
}) {
  if (!tenantId) {
    return uniqueMenuKeys(menuKeys);
  }

  try {
    const [enabledModules] = await db.execute(
      'SELECT module_id FROM tenant_module_configs WHERE tenant_id = ? AND enabled = ?',
      [tenantId, 1],
    );
    const moduleIds = new Set((enabledModules || []).map(item => item?.module_id).filter(Boolean));
    CORE_MODULE_IDS.forEach(id => moduleIds.add(id));
    const moduleIdList = Array.from(moduleIds);

    if (moduleIdList.length === 0) {
      return [];
    }

    // 若模块启用但角色菜单未声明，提前补齐与模块相关的关键菜单键，避免漏显
    let mergedMenuKeys = uniqueMenuKeys(menuKeys);
    if (shouldKeepAdminManagementMenus({ userRole, menuRole, isSuperAdmin })) {
      mergedMenuKeys = uniqueMenuKeys([...mergedMenuKeys, ...ADMIN_MANAGEMENT_MENU_KEYS]);
    }
    if (moduleIdList.includes('asset-ai-assistant')) {
      mergedMenuKeys = uniqueMenuKeys([
        ...mergedMenuKeys,
        ...AI_ASSISTANT_MENU_KEYS,
      ]);
    }


    const placeholders = moduleIdList.map(() => '?').join(',');
    const [moduleMenus] = await db.execute(
      `SELECT menu_key
       FROM tenant_module_menus
       WHERE tenant_id = ? AND module_id IN (${placeholders}) AND is_enabled = ?`,
      [tenantId, ...moduleIdList, 1],
    );
    const allowedMenuKeys = new Set((moduleMenus || []).map(item => item?.menu_key).filter(Boolean));

    if (
      moduleIdList.includes('depreciation-management') ||
      moduleIdList.includes('asset-management') ||
      moduleIdList.includes('maintenance-management')
    ) {
      DEPRECIATION_MENU_KEYS.forEach(menuKey => allowedMenuKeys.add(menuKey));
    }

    if (moduleIdList.includes('asset-ai-assistant')) {
      AI_ASSISTANT_MENU_KEYS.forEach(menuKey => allowedMenuKeys.add(menuKey));
    }
    if (shouldKeepAdminManagementMenus({ userRole, menuRole, isSuperAdmin })) {
      ADMIN_MANAGEMENT_MENU_KEYS.forEach(menuKey => allowedMenuKeys.add(menuKey));
    }

    return uniqueMenuKeys(mergedMenuKeys).filter(menuKey => allowedMenuKeys.has(menuKey));
  } catch (error) {
    logger?.warn?.('获取租户模块配置失败，使用角色菜单:', error.message);
    return uniqueMenuKeys(menuKeys);
  }
}

async function getUserVisibleMenus({ db, user, createMenuPermissionsTables, logger = console }) {
  const userRole = user?.role;
  const tenantId = user?.tenant_id;
  const isSuperAdmin = user?.is_super_admin === true || userRole === 'super_admin';
  const menuRole = resolveMenuRole({ userRole, isSuperAdmin, tenantId });

  await ensureMenuDefinitionsReady({ db, createMenuPermissionsTables, logger });

  let menuKeys = await fetchRoleMenus({ db, role: menuRole, logger });
  menuKeys = applyCompatibilityMenus(menuKeys);
  menuKeys = applyRoleSpecificVisibility({ menuKeys, menuRole });
  menuKeys = await applyTenantModuleFiltering({
    db,
    menuKeys,
    tenantId,
    userRole,
    menuRole,
    isSuperAdmin,
    logger,
  });

  return uniqueMenuKeys(menuKeys);
}

module.exports = {
  getUserVisibleMenus,
  resolveMenuRole,
  applyCompatibilityMenus,
};
