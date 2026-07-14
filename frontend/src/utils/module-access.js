export const MODULE_PATH_RULES = [
  {
    moduleId: 'asset-management',
    prefixes: ['/assets', '/transfer', '/idle', '/temp-assets', '/technical-documents/batch-upload'],
  },
  {
    moduleId: 'inventory-management',
    prefixes: ['/inventory'],
  },
  {
    moduleId: 'procurement-management',
    prefixes: ['/procurement', '/acceptance'],
  },
  {
    moduleId: 'tendering-management',
    prefixes: ['/tendering'],
  },
  {
    moduleId: 'label-management',
    prefixes: ['/asset-labels'],
  },
  {
    moduleId: 'department-management',
    prefixes: ['/departments'],
  },
  {
    moduleId: 'maintenance-management',
    prefixes: ['/maintenance'],
  },
  {
    moduleId: 'compliance-management',
    prefixes: ['/compliance', '/alert-center'],
  },
  {
    moduleId: 'special-equipment-management',
    prefixes: ['/special-equipment'],
  },
  {
    moduleId: 'safety-inspection-management',
    prefixes: ['/safety-inspection'],
  },
  {
    moduleId: 'asset-risk-management',
    prefixes: ['/risk'],
  },
  {
    moduleId: 'staff-qualification',
    prefixes: ['/staff'],
  },
  {
    moduleId: 'uptime-management',
    prefixes: ['/uptime'],
  },
  {
    moduleId: 'quality-assurance-management',
    prefixes: ['/quality-control/qc', '/quality-control/statistics', '/quality-control/management'],
  },
  {
    moduleId: 'quality-control',
    prefixes: ['/quality-control/metrology'],
  },
  {
    moduleId: 'adverse-event',
    prefixes: ['/adverse-reaction', '/adverse-events'],
  },
  {
    moduleId: 'asset-ai-assistant',
    prefixes: [
      '/ai-assistant',
      '/ai-assistant/agent-mesh',
      '/ai-assistant/ct-maintenance',
      '/ai-maintenance',
      '/ai-question-records',
    ],
  },
  {
    moduleId: 'message-integration',
    prefixes: ['/integration'],
  },
  {
    moduleId: 'iot-management',
    prefixes: ['/iot-devices', '/iot/devices'],
  },
  {
    moduleId: 'iot-geo-location-management',
    prefixes: ['/asset-location'],
  },
  {
    moduleId: 'iot-zone-location-management',
    prefixes: ['/beacon-location'],
  },
  {
    moduleId: 'iot-asset-monitoring-management',
    prefixes: ['/asset-monitoring'],
  },
  {
    moduleId: 'iot-environment-monitoring-management',
    prefixes: ['/environment-monitoring'],
  },
  {
    moduleId: 'iot-patient-volume-management',
    prefixes: ['/patient-volume'],
  },
];

export const MODULE_ACCESS_FALLBACKS = {
  'special-equipment-management': ['compliance-management'],
  'safety-inspection-management': ['compliance-management'],
  'asset-risk-management': ['compliance-management'],
  'staff-qualification': ['compliance-management'],
  'uptime-management': ['compliance-management'],
  'iot-geo-location-management': ['iot-management'],
  'iot-zone-location-management': ['iot-management'],
  'iot-asset-monitoring-management': ['iot-management'],
  'iot-environment-monitoring-management': ['iot-management'],
  'iot-patient-volume-management': ['iot-management'],
  // 兼容历史模块ID：CT维护助手已并入资产AI助手
  'asset-ai-assistant': ['ct-maintenance-assistant-management', 'maintenance-management'],
};

export const resolveModuleByPath = pathname => {
  for (const rule of MODULE_PATH_RULES) {
    for (const prefix of rule.prefixes) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        return rule.moduleId;
      }
    }
  }
  return null;
};

export const hasModuleAccess = (requiredModuleId, enabledModules) => {
  if (!requiredModuleId) {
    return true;
  }

  const normalizedModules = Array.isArray(enabledModules) ? enabledModules : [];
  if (normalizedModules.includes(requiredModuleId)) {
    return true;
  }

  const fallbacks = MODULE_ACCESS_FALLBACKS[requiredModuleId] || [];
  return fallbacks.some(moduleId => normalizedModules.includes(moduleId));
};
