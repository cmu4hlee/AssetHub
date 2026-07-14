const MENU_ROUTE_ACCESS_RULES = [
  {
    accessKeys: ['/tenants'],
    prefixes: ['/tenants'],
  },
  {
    accessKeys: ['/users'],
    prefixes: ['/users'],
  },
  {
    accessKeys: ['/departments'],
    prefixes: ['/departments'],
  },
  {
    accessKeys: ['/roles-permissions'],
    prefixes: ['/roles-permissions'],
  },
  {
    accessKeys: ['/user-roles'],
    prefixes: ['/user-roles'],
  },
  {
    accessKeys: ['/data-scope'],
    prefixes: ['/data-scope'],
  },
  {
    accessKeys: ['/tenant-management'],
    prefixes: ['/tenant-management'],
  },
  {
    accessKeys: ['/audit-logs'],
    prefixes: ['/audit-logs', '/audit-management'],
  },
  {
    accessKeys: ['/backup'],
    prefixes: ['/backup'],
  },
  {
    accessKeys: ['/database-connection'],
    prefixes: ['/database-connection'],
  },
  {
    accessKeys: ['/system/token-management'],
    prefixes: ['/system/token-management'],
  },
  {
    accessKeys: ['/api-docs'],
    prefixes: ['/api-docs'],
  },
  {
    accessKeys: ['/api-documentation'],
    prefixes: ['/api-documentation'],
  },
  {
    accessKeys: ['/ai-assistant', '/asset-ai-analysis', '/ai-maintenance', '/ai-question-records'],
    prefixes: [
      '/ai-assistant',
      '/ai-assistant-hub',
      '/asset-ai-analysis',
      '/ai-maintenance',
      '/ai-question-records',
    ],
  },
  {
    accessKeys: ['/technical-documents/review'],
    prefixes: ['/technical-documents/review'],
  },
  {
    accessKeys: ['/technical-documents/upload', '/technical-documents/batch-upload'],
    prefixes: ['/technical-documents/upload', '/technical-documents/batch-upload'],
  },
  {
    accessKeys: ['/technical-documents'],
    prefixes: [
      '/technical-documents',
      '/documents/contracts',
      '/documents/technical',
      '/documents/others',
    ],
  },
];

export const normalizeRoutePath = pathname =>
  String(pathname || '/')
    .split('?')[0]
    .split('#')[0] || '/';

const matchesPrefix = (pathname, prefix) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const resolveMenuAccessKeys = pathname => {
  const normalizedPath = normalizeRoutePath(pathname);
  const rule = MENU_ROUTE_ACCESS_RULES.find(candidate =>
    candidate.prefixes.some(prefix => matchesPrefix(normalizedPath, prefix))
  );

  return Array.isArray(rule?.accessKeys) ? rule.accessKeys : [];
};

export const canAccessMenuRoute = ({ pathname, visibleMenuKeys, menuPermissionLoaded }) => {
  const keys = Array.isArray(visibleMenuKeys) ? visibleMenuKeys : [];
  if (!menuPermissionLoaded && keys.length === 0) {
    return true;
  }

  const accessKeys = resolveMenuAccessKeys(pathname);
  if (accessKeys.length === 0) {
    return true;
  }

  return accessKeys.some(key => keys.includes(key));
};
