const MODULE_REGISTRY = {
  assets: {
    id: 'assets',
    name: '资产管理',
    icon: 'BoxOutlined',
    routePrefix: '/assets',
    enabled: true,
    requiredModules: [],
  },
  inventory: {
    id: 'inventory',
    name: '盘点管理',
    icon: 'AuditOutlined',
    routePrefix: '/inventory',
    enabled: true,
    requiredModules: ['assets'],
  },
  transfer: {
    id: 'transfer',
    name: '资产调配',
    icon: 'SwapOutlined',
    routePrefix: '/transfer',
    enabled: true,
    requiredModules: ['assets'],
  },
  idle: {
    id: 'idle',
    name: '闲置资产',
    icon: 'PauseCircleOutlined',
    routePrefix: '/idle',
    enabled: true,
    requiredModules: ['assets'],
  },
  maintenance: {
    id: 'maintenance',
    name: '维修维护',
    icon: 'ToolOutlined',
    routePrefix: '/maintenance',
    enabled: true,
    requiredModules: ['assets'],
  },
  quality: {
    id: 'quality',
    name: '质量控制',
    icon: 'SafetyCertificateOutlined',
    routePrefix: '/quality-control',
    enabled: true,
    requiredModules: ['assets'],
  },
  documents: {
    id: 'documents',
    name: '技术资料',
    icon: 'FileTextOutlined',
    routePrefix: '/technical-documents',
    enabled: true,
    requiredModules: [],
  },
  iot: {
    id: 'iot',
    name: '物联网管理',
    icon: 'WifiOutlined',
    routePrefix: '/iot',
    enabled: true,
    requiredModules: ['assets'],
  },
  ai: {
    id: 'ai',
    name: 'AI助手',
    icon: 'RobotOutlined',
    routePrefix: '/ai-assistant',
    enabled: true,
    requiredModules: [],
  },
  compliance: {
    id: 'compliance',
    name: '合规管理',
    icon: 'CheckCircleOutlined',
    routePrefix: '/compliance',
    enabled: true,
    requiredModules: [],
  },
  risk: {
    id: 'risk',
    name: '风险管理',
    icon: 'WarningOutlined',
    routePrefix: '/risk',
    enabled: true,
    requiredModules: [],
  },
  staff: {
    id: 'staff',
    name: '人员资质',
    icon: 'TeamOutlined',
    routePrefix: '/staff',
    enabled: true,
    requiredModules: [],
  },
  uptime: {
    id: 'uptime',
    name: '开机率管理',
    icon: 'DashboardOutlined',
    routePrefix: '/uptime',
    enabled: true,
    requiredModules: ['assets'],
  },
  users: {
    id: 'users',
    name: '用户管理',
    icon: 'UserOutlined',
    routePrefix: '/users',
    enabled: true,
    requiredModules: [],
  },
  dashboard: {
    id: 'dashboard',
    name: '仪表盘',
    icon: 'DashboardOutlined',
    routePrefix: '/dashboard',
    enabled: true,
    requiredModules: [],
  },
  system: {
    id: 'system',
    name: '系统管理',
    icon: 'SettingOutlined',
    routePrefix: '/system',
    enabled: true,
    requiredModules: [],
  },
  tendering: {
    id: 'tendering',
    name: '采购与招标',
    icon: 'AuditOutlined',
    routePrefix: '/tendering',
    enabled: true,
    requiredModules: [],
  },
};

function getModuleConfig(moduleId) {
  return MODULE_REGISTRY[moduleId] || null;
}

function isModuleEnabled(moduleId) {
  const config = MODULE_REGISTRY[moduleId];
  return config?.enabled ?? false;
}

function getModuleDependencies(moduleId) {
  const config = MODULE_REGISTRY[moduleId];
  return config?.requiredModules || [];
}

function areDependenciesMet(moduleId, enabledModules) {
  const deps = getModuleDependencies(moduleId);
  return deps.every(dep => enabledModules.includes(dep));
}

function getEnabledModules() {
  return Object.values(MODULE_REGISTRY).filter(m => m.enabled);
}

function getModuleByPath(pathname) {
  for (const module of Object.values(MODULE_REGISTRY)) {
    if (pathname.startsWith(module.routePrefix)) {
      return module;
    }
  }
  return null;
}

export {
  MODULE_REGISTRY,
  getModuleConfig,
  isModuleEnabled,
  getModuleDependencies,
  areDependenciesMet,
  getEnabledModules,
  getModuleByPath,
};

export default MODULE_REGISTRY;
