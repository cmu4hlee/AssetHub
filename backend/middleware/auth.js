const jwt = require('jsonwebtoken');
const db = require('../config/database');
const appConfig = require('../config/app.config');
const jwtConfig = appConfig.jwt;
const authorizationConfig = appConfig.authorization || {};
const AUTH_TRACE_LOG_ENABLED = process.env.AUTH_TRACE_LOG_ENABLED === 'true';
const authTraceLog = (...args) => {
  if (AUTH_TRACE_LOG_ENABLED) {
    console.log(...args);
  }
};

// ==================== 权限缓存机制 ====================
// 使用 Redis 缓存替代内存缓存，支持多实例部署和主动失效
let cacheService;
try {
  const redisModule = require('../services/redis');
  cacheService = redisModule.cacheService;
} catch (error) {
  console.warn('Redis 服务加载失败，权限缓存将使用内存回退:', error.message);
}

// 内存缓存回退（当 Redis 不可用时）
const memoryPermissionCache = new Map();
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 缓存有效期：5分钟
const MAX_MEMORY_CACHE_SIZE = 1000; // 最大缓存条目数

/**
 * 获取缓存的权限
 * @param {string} role - 角色代码
 * @param {number|null} tenantId - 租户ID
 * @param {number|null} userId - 用户ID
 * @returns {Set|null} 权限集合或null
 */
const getCachedPermissions = async (role, tenantId, userId) => {
  const cacheKey = `permissions:${role}:${tenantId || 'global'}:${userId || 'anon'}`;

  // 优先使用 Redis 缓存
  if (cacheService) {
    try {
      const cached = await cacheService.get(cacheKey, tenantId);
      if (cached) {
        authTraceLog(`[权限缓存] Redis 命中: ${cacheKey}, 权限数: ${cached.length}`);
        return new Set(cached);
      }
    } catch (error) {
      console.warn('Redis 缓存读取失败，使用内存缓存:', error.message);
    }
  }

  // 使用内存缓存回退
  const memoryCached = memoryPermissionCache.get(cacheKey);
  if (!memoryCached) return null;

  // 检查缓存是否过期
  if (Date.now() - memoryCached.timestamp > MEMORY_CACHE_TTL) {
    memoryPermissionCache.delete(cacheKey);
    return null;
  }

  authTraceLog(`[权限缓存] 内存命中: ${cacheKey}, 权限数: ${memoryCached.permissions.size}`);
  return memoryCached.permissions;
};

/**
 * 设置权限缓存
 * @param {string} role - 角色代码
 * @param {number|null} tenantId - 租户ID
 * @param {string[]} permissions - 权限数组
 * @param {number|null} userId - 用户ID
 */
const setCachedPermissions = async (role, tenantId, permissions, userId) => {
  const cacheKey = `permissions:${role}:${tenantId || 'global'}:${userId || 'anon'}`;

  // 优先使用 Redis 缓存（5分钟过期）
  if (cacheService) {
    try {
      await cacheService.set(cacheKey, permissions, 300, tenantId, {
        tags: ['permissions', `role:${role}`]
      });
      authTraceLog(`[权限缓存] Redis 设置: ${cacheKey}, 权限数: ${permissions.length}`);
      return;
    } catch (error) {
      console.warn('Redis 缓存写入失败，使用内存缓存:', error.message);
    }
  }

  // 使用内存缓存回退
  if (memoryPermissionCache.size >= MAX_MEMORY_CACHE_SIZE) {
    const entries = Array.from(memoryPermissionCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const deleteCount = Math.floor(entries.length * 0.5);
    for (let i = 0; i < deleteCount; i++) {
      memoryPermissionCache.delete(entries[i][0]);
    }
    authTraceLog(`[权限缓存] 内存清理完成，删除 ${deleteCount} 条旧缓存`);
  }

  memoryPermissionCache.set(cacheKey, {
    permissions: new Set(permissions),
    timestamp: Date.now(),
  });
  authTraceLog(`[权限缓存] 内存设置: ${cacheKey}, 权限数: ${permissions.length}`);
};

/**
 * 清除权限缓存
 * @param {string} role - 角色代码（可选，不提供则清除所有）
 * @param {number|null} tenantId - 租户ID（可选）
 */
const clearPermissionCache = async (role, tenantId) => {
  if (role) {
    const cacheKey = `permissions:${role}:${tenantId || 'global'}`;
    
    // 清除 Redis 缓存
    if (cacheService) {
      try {
        await cacheService.deleteByTags([`role:${role}`], tenantId);
        authTraceLog(`[权限缓存] Redis 清除角色: ${role}`);
      } catch (error) {
        console.warn('Redis 缓存清除失败:', error.message);
      }
    }
    
    // 清除内存缓存
    for (const key of memoryPermissionCache.keys()) {
      if (key.startsWith(cacheKey)) {
        memoryPermissionCache.delete(key);
      }
    }
    authTraceLog(`[权限缓存] 内存清除角色: ${role}`);
  } else {
    // 清除所有缓存
    if (cacheService) {
      try {
        await cacheService.flushAll(tenantId);
        authTraceLog('[权限缓存] Redis 清除所有缓存');
      } catch (error) {
        console.warn('Redis 缓存清除失败:', error.message);
      }
    }
    memoryPermissionCache.clear();
    authTraceLog('[权限缓存] 内存清除所有缓存');
  }
};

// 数据库查询辅助函数（带重试机制）
async function executeQuery(query, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await db.execute(query, params);
      return result;
    } catch (error) {
      // 如果是连接丢失错误，尝试重试
      if (
        (error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ECONNREFUSED') &&
        i < retries - 1
      ) {
        authTraceLog(`数据库连接丢失，正在重试 (${i + 1}/${retries})...`);
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      // 其他错误或已达到最大重试次数，抛出错误
      throw error;
    }
  }
}

const MODULE_ROUTE_PREFIXES = [
  {
    moduleId: 'asset-management',
    prefixes: [
      '/api/assets',
      '/api/inventory',
      '/api/transfer',
      '/api/idle',
      '/api/scrapping',
      '/api/temp-assets',
      '/api/asset-images',
      '/api/asset-labels',
      '/api/dashboard-configs',
      '/api/cloud-sync',
      '/api/barcode-scan',
      '/api/asset-share',
    ],
  },
  {
    moduleId: 'department-management',
    prefixes: ['/api/departments'],
  },
  {
    moduleId: 'user-management',
    prefixes: ['/api/users'],
  },
  {
    moduleId: 'maintenance-management',
    prefixes: ['/api/maintenance'],
  },
  {
    moduleId: 'preventive-maintenance-management',
    prefixes: ['/api/preventive-maintenance'],
  },
  {
    moduleId: 'depreciation-management',
    prefixes: ['/api/depreciation', '/api/asset-depreciation'],
  },
  {
    moduleId: 'quality-control',
    prefixes: ['/api/quality-control'],
  },
  {
    moduleId: 'quality-assurance-management',
    prefixes: ['/api/quality-assurance'],
  },
  {
    moduleId: 'procurement-management',
    prefixes: ['/api/procurement'],
  },
  {
    moduleId: 'acceptance-management',
    prefixes: ['/api/acceptance'],
  },
  {
    moduleId: 'adverse-event',
    prefixes: ['/api/adverse-reaction', '/api/adverse-events'],
  },
  {
    moduleId: 'iot-management',
    prefixes: ['/api/iot', '/api/iot-devices', '/api/asset-location', '/api/location-codes'],
  },
  {
    moduleId: 'iot-geo-location-management',
    prefixes: ['/api/iot/geo-location'],
  },
  {
    moduleId: 'iot-zone-location-management',
    prefixes: ['/api/iot/zone-location'],
  },
  {
    moduleId: 'iot-asset-monitoring-management',
    prefixes: ['/api/iot/asset-monitoring'],
  },
  {
    moduleId: 'iot-environment-monitoring-management',
    prefixes: ['/api/iot/environment-monitoring'],
  },
  {
    moduleId: 'compliance-management',
    prefixes: ['/api/compliance'],
  },
  {
    moduleId: 'safety-inspection-management',
    prefixes: ['/api/safety-inspection'],
  },
  {
    moduleId: 'special-equipment-management',
    prefixes: ['/api/special-equipment'],
  },
  {
    moduleId: 'staff-qualification',
    prefixes: ['/api/staff'],
  },
  {
    moduleId: 'uptime-management',
    prefixes: ['/api/uptime'],
  },
  {
    moduleId: 'technical-documents',
    prefixes: ['/api/technical-documents'],
  },
  {
    moduleId: 'label-management',
    prefixes: ['/api/asset-labels'],
  },
  {
    moduleId: 'sms-verification',
    prefixes: ['/api/sms-verification'],
  },
  {
    moduleId: 'asset-risk-management',
    prefixes: ['/api/risk'],
  },
  {
    moduleId: 'asset-usage-management',
    prefixes: ['/api/asset-usage'],
  },
  {
    moduleId: 'asset-ai-assistant',
    prefixes: ['/api/asset-ai-assistant'],
  },
  {
    moduleId: 'ct-maintenance-assistant-management',
    prefixes: ['/api/ct-maintenance-assistant'],
  },
  {
    moduleId: 'dingtalk-binding',
    prefixes: ['/api/dingtalk'],
  },
  {
    moduleId: 'wechat-binding',
    prefixes: ['/api/wechat'],
  },
  {
    moduleId: 'feishu-binding',
    prefixes: ['/api/feishu'],
  },
  {
    moduleId: 'system',
    prefixes: [
      '/api/health',
      '/api/backup',
      '/api/roles-permissions',
      '/api/enhanced-permissions',
      '/api/system-config',
      '/api/tenants',
      '/api/tenant-association',
      '/api/tenant-module-config',
      '/api/modules',
      '/api/module-configs',
      '/api/workflow',
      '/api/audit-logs',
      '/api/audit-logs-enhanced',
      '/api/page-views',
      '/api/analysis',
      '/api/dashboard',
      '/api/dashboard-configs',
      '/api/desktop-preferences',
      '/api/i18n',
      '/api/api-documentation',
      '/api/agent-mesh',
    ],
  },
  {
    moduleId: 'ai-services',
    prefixes: [
      '/api/ai',
      '/api/ai-assistant',
      '/api/asset-ai-analysis',
      '/api/maintenance-ai',
      '/api/technical-documents-enhanced',
      '/api/technical-documents-ai',
      '/api/chat',
    ],
  },
  {
    moduleId: 'integration',
    prefixes: [
      '/api/location-alerts',
      '/api/intelligent-alerts',
      '/api/materials',
      '/api/cloud-sync',
    ],
  },
];

const resolveModuleByRequest = req => {
  const fullPath = `${req.baseUrl || ''}${req.path || ''}`;

  for (const group of MODULE_ROUTE_PREFIXES) {
    for (const prefix of group.prefixes) {
      if (fullPath === prefix || fullPath.startsWith(`${prefix}/`)) {
        return group.moduleId;
      }
    }
  }

  return null;
};

const MODULE_ACCESS_FALLBACKS = {
  'depreciation-management': ['asset-management'],
};

const canAccessModule = (enabledModules, moduleId) => {
  const modules = Array.isArray(enabledModules) ? enabledModules : [];
  if (modules.includes(moduleId)) {
    return true;
  }

  const fallbacks = MODULE_ACCESS_FALLBACKS[moduleId] || [];
  return fallbacks.some(fallbackId => modules.includes(fallbackId));
};

// 生成JWT令牌
const generateToken = user => {
  const jwtSecret = jwtConfig.secret;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not set in config');
  }
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      // 使用用户在当前企业的角色，而不是从user表获取的角色
      role: user.role,
      departmentCode: user.department_code,
    },
    jwtSecret,
    { expiresIn: jwtConfig.expiresIn },
  );
};

// 认证中间件
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      // 安全修复：禁止未认证访问
      return res.status(401).json({
        success: false,
        message: '需要有效的认证令牌',
        error: 'UNAUTHORIZED',
        code: 1001,
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '需要有效的认证令牌',
        error: 'UNAUTHORIZED',
        code: 1001,
      });
    }
    const jwtSecret = jwtConfig.secret;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not set in config');
    }
    const decoded = jwt.verify(token, jwtSecret);

    // 检查用户是否是超级管理员
    let user = null;
    let isSuperAdmin = false;

    // 改进的认证逻辑：根据token中的username判断用户类型
    // 1. 先根据username查询超级用户表
    let superUsers = [];
    try {
      [superUsers] = await executeQuery(
        'SELECT id, username, real_name, status FROM super_users WHERE username = ? AND status = ?',
        [decoded.username, 'active'],
      );
    } catch (error) {
      console.error('查询超级用户失败:', error);
      // 安全修复：数据库错误时拒绝访问，不返回默认管理员
      return res.status(503).json({
        success: false,
        message: '服务暂时不可用，请稍后重试',
        error: 'SERVICE_UNAVAILABLE',
        code: 1002,
      });
    }

    if (superUsers.length > 0) {
      // 是超级管理员
      isSuperAdmin = true;
      user = superUsers[0];
      user.role = 'super_admin';
      user.department_code = null;
      user.is_super_admin = true;
    } else {
      // 是普通用户
      let users = [];
      try {
        [users] = await executeQuery(
          'SELECT id, username, real_name, department_code, status FROM users WHERE username = ? AND status = ?',
          [decoded.username, 'active'],
        );
      } catch (error) {
        console.error('查询普通用户失败:', error);
        // 安全修复：数据库错误时拒绝访问
        return res.status(503).json({
          success: false,
          message: '服务暂时不可用，请稍后重试',
          error: 'SERVICE_UNAVAILABLE',
          code: 1003,
        });
      }

      if (users.length === 0) {
        return res.status(401).json({ success: false, message: '用户不存在或已禁用' });
      }

      user = users[0];
    }

    // 动态租户ID（用于企业空间切换）
    const dynamicTenantId = req.header('X-Tenant-ID');

    // 验证租户ID格式
    const validateTenantId = tenantId => {
      const id = parseInt(tenantId);
      return !isNaN(id) && id > 0 && id < 1000000; // 限制租户ID范围
    };

    let effectiveTenantId = null;
    let effectiveTenantName = null;
    let effectiveRole = user.role || 'user';
    let managedDepartments = [];

    // 超级管理员特殊处理
    if (isSuperAdmin) {
      authTraceLog(`超级管理员 ${user.username} 登录，拥有全部权限`);
      effectiveRole = 'super_admin';

      // 严格验证超级管理员的动态租户ID
      if (dynamicTenantId) {
        if (!validateTenantId(dynamicTenantId)) {
          return res.status(400).json({
            success: false,
            message: '无效的租户ID格式',
            error: 'INVALID_TENANT_ID',
            code: 1004,
          });
        }
        effectiveTenantId = parseInt(dynamicTenantId);
        try {
          // 验证租户存在
          const [tenants] = await executeQuery(
            'SELECT tenant_name FROM tenants WHERE id = ? AND status = ? LIMIT 1',
            [effectiveTenantId, 'active'],
          );
          effectiveTenantName = tenants[0]?.tenant_name || null;

          // 验证超级管理员是否有权访问该租户（检查 super_admin_tenants 表）
          const [tableExists] = await executeQuery(
            `SELECT COUNT(*) as cnt FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = 'super_admin_tenants'`,
          );
          const tableExistsFlag = tableExists[0]?.cnt > 0;

          // 只有当 super_admin_tenants 表存在时才验证权限
          if (tableExistsFlag) {
            const [accessibleTenants] = await executeQuery(
              `SELECT tenant_id FROM super_admin_tenants WHERE admin_user_id = ?`,
              [user.id],
            );
            const accessibleTenantIds = accessibleTenants.map(t => t.tenant_id);

            // 如果配置了权限列表且当前租户不在列表中，拒绝访问
            if (accessibleTenantIds.length > 0 && !accessibleTenantIds.includes(effectiveTenantId)) {
              return res.status(403).json({
                success: false,
                message: '无权访问该企业空间',
                error: 'TENANT_ACCESS_DENIED',
                code: 1007,
              });
            }
          }
          // 如果表不存在，允许访问（向后兼容）
        } catch (tenantError) {
          console.error('获取超级管理员动态租户名称失败:', tenantError);
        }
        authTraceLog(`超级管理员动态租户ID已设置: ${effectiveTenantId}，用户: ${user.username}`);
      }

      // 超级管理员拥有所有科室的权限
      managedDepartments = ['*'];
      authTraceLog(`超级管理员 ${user.username} 拥有所有科室权限`);
    } else {
      // 普通用户/系统管理员处理：允许切换到有权限的租户空间
      try {
        let tenantRoleRecord = null;

        if (dynamicTenantId) {
          if (!validateTenantId(dynamicTenantId)) {
            return res.status(400).json({
              success: false,
              message: '无效的租户ID格式',
              error: 'INVALID_TENANT_ID',
              code: 1004,
            });
          }

          const requestedTenantId = parseInt(dynamicTenantId);
          const [tenantRoles] = await executeQuery(
            `SELECT ur.tenant_id, ur.role, t.tenant_name
             FROM user_tenant_roles ur
             LEFT JOIN tenants t ON t.id = ur.tenant_id
             WHERE ur.user_id = ? AND ur.tenant_id = ? AND ur.status = ?
             LIMIT 1`,
            [user.id, requestedTenantId, 'active'],
          );

          if (tenantRoles.length === 0) {
            return res.status(403).json({
              success: false,
              message: '无权访问该企业空间',
              error: 'TENANT_SWITCH_NOT_ALLOWED',
              code: 1005,
            });
          }

          tenantRoleRecord = tenantRoles[0];
          authTraceLog(
            `用户 ${user.username} 切换到租户 ${requestedTenantId}，角色: ${tenantRoleRecord.role}`,
          );
        } else {
          const [defaultTenantRoles] = await executeQuery(
            `SELECT ur.tenant_id, ur.role, t.tenant_name
             FROM user_tenant_roles ur
             LEFT JOIN tenants t ON t.id = ur.tenant_id
             WHERE ur.user_id = ? AND ur.status = ?
             ORDER BY ur.is_default DESC, ur.id ASC
             LIMIT 1`,
            [user.id, 'active'],
          );

          if (defaultTenantRoles.length === 0) {
            return res.status(403).json({
              success: false,
              message: '当前用户未分配可用企业空间',
              error: 'MISSING_ACTIVE_TENANT',
              code: 1006,
            });
          }

          tenantRoleRecord = defaultTenantRoles[0];
          authTraceLog(
            `使用用户默认租户ID: ${tenantRoleRecord.tenant_id}，用户: ${user.username}, 角色: ${tenantRoleRecord.role}`,
          );
        }

        effectiveTenantId = tenantRoleRecord.tenant_id;
        effectiveTenantName = tenantRoleRecord.tenant_name || null;
        effectiveRole = tenantRoleRecord.role || 'user';

        // 从user_managed_departments表获取用户管理的科室
        try {
          const [managedDepartmentsResult] = await executeQuery(
            'SELECT department_code FROM user_managed_departments WHERE user_id = ? AND tenant_id = ?',
            [user.id, effectiveTenantId],
          );

          if (managedDepartmentsResult.length > 0) {
            managedDepartments = managedDepartmentsResult.map(dept => dept.department_code);
          }

          // 如果没有设置管理科室，系统管理员拥有租户内所有科室
          if (managedDepartments.length === 0 && effectiveRole === 'system_admin') {
            const [allDepartments] = await executeQuery(
              'SELECT department_code FROM departments WHERE tenant_id = ?',
              [effectiveTenantId],
            );
            managedDepartments = allDepartments.map(dept => dept.department_code);
          }
        } catch (e) {
          console.error('获取管理科室失败:', e);
          if (effectiveRole === 'system_admin') {
            try {
              const [allDepartments] = await executeQuery(
                'SELECT department_code FROM departments WHERE tenant_id = ?',
                [effectiveTenantId],
              );
              managedDepartments = allDepartments.map(dept => dept.department_code);
            } catch (innerErr) {
              console.error('获取所有科室失败:', innerErr);
            }
          }
        }
      } catch (error) {
        console.error('获取租户角色失败:', error);
        return res.status(503).json({
          success: false,
          message: '服务暂时不可用，请稍后重试',
          error: 'SERVICE_UNAVAILABLE',
          code: 1007,
        });
      }
    }

    // 确保req.user始终包含最新的租户ID、角色和管理科室，支持动态切换
    req.user = {
      ...user,
      managed_departments: managedDepartments,
      // 使用有效的租户ID和角色，支持动态切换
      tenant_id: effectiveTenantId,
      tenant_name: effectiveTenantName,
      role: effectiveRole,
      is_super_admin: isSuperAdmin,
      has_all_departments: isSuperAdmin, // 超级管理员拥有所有科室权限
    };

    // 加载租户的模块配置信息（如果不是超级管理员且有租户ID）
    if (!isSuperAdmin && effectiveTenantId) {
      try {
        // 获取租户启用的模块
        const [enabledModules] = await executeQuery(
          'SELECT module_id FROM tenant_module_configs WHERE tenant_id = ? AND enabled = ?',
          [effectiveTenantId, 1],
        );

        const moduleIds = enabledModules.map(m => m.module_id);
        req.user.enabled_modules = moduleIds;

        // 如果有启用的模块，获取对应的菜单权限
        if (moduleIds.length > 0) {
          const placeholders = moduleIds.map(() => '?').join(',');
          const [moduleMenus] = await executeQuery(
            `SELECT module_id, menu_key FROM tenant_module_menus WHERE tenant_id = ? AND is_enabled = ? AND module_id IN (${placeholders})`,
            [effectiveTenantId, 1, ...moduleIds],
          );

          // 构建模块菜单映射
          const moduleMenuMap = new Map();
          moduleMenus.forEach(item => {
            if (!moduleMenuMap.has(item.module_id)) {
              moduleMenuMap.set(item.module_id, []);
            }
            moduleMenuMap.get(item.module_id).push(item.menu_key);
          });

          req.user.module_menu_permissions = moduleMenuMap;
        }
      } catch (error) {
        console.error('加载租户模块配置失败:', error);
        // 加载失败时设置默认值
        req.user.enabled_modules = [];
        req.user.module_menu_permissions = new Map();
      }
    } else {
      // 超级管理员或无租户ID时，设置默认值
      req.user.enabled_modules = [];
      req.user.module_menu_permissions = new Map();
    }

    // 超级管理员和系统管理员都跳过模块检查
    const isSystemAdmin = effectiveRole === 'system_admin';
    if (!isSuperAdmin && !isSystemAdmin) {
      const moduleId = resolveModuleByRequest(req);
      if (moduleId) {
        const enabledModules = Array.isArray(req.user.enabled_modules) ? req.user.enabled_modules : [];
        if (!canAccessModule(enabledModules, moduleId)) {
          return res.status(403).json({
            success: false,
            message: `模块 ${moduleId} 未启用，当前请求已拒绝`,
            error: 'MODULE_DISABLED',
            module_id: moduleId,
          });
        }
      }
    }

    next();
  } catch (error) {
    // 区分JWT验证错误和数据库错误
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: '无效的认证令牌' });
    }
    // 数据库错误或其他错误，返回500
    console.error('认证中间件错误:', error);
    return res.status(500).json({ success: false, message: '认证服务异常，请稍后重试' });
  }
};

const hasRoleScopeAccess = (role, scope) => {
  const matrix = authorizationConfig.roleAccessMatrix || {};
  const rolePolicy = matrix[role];
  if (!rolePolicy) return false;
  if (rolePolicy.allowAll) return true;

  const allowedScopes = Array.isArray(rolePolicy.allowedScopes) ? rolePolicy.allowedScopes : [];
  return allowedScopes.includes('*') || allowedScopes.includes(scope);
};

const requireRoleScope = scope => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '需要先登录' });
    }

    if (hasRoleScopeAccess(req.user.role, scope)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: '当前角色无权执行此操作',
      error: 'ROLE_SCOPE_FORBIDDEN',
      scope,
    });
  };
};

// 角色权限检查中间件
// 支持两种调用形式：
//   authorize('manage_users')                 - 单个权限
//   authorize(['system_admin', 'user.manage_role'])  - 多个权限（任一匹配即可）
const authorize = permission => {
  const requestedPermissions = Array.isArray(permission) ? permission : [permission];
  return async (req, res, next) => {
    try {
      // 首先检查是否已认证
      if (!req.user) {
        return res.status(401).json({ success: false, message: '需要先登录' });
      }

      // 只有超级管理员拥有所有权限
      if (req.user.role === 'super_admin') {
        return next();
      }

      // 系统管理员（租户级）拥有租户内的所有权限
      if (req.user.role === 'system_admin') {
        authTraceLog(`系统管理员 ${req.user.username} 在租户 ${req.user.tenant_id} 内拥有所有权限`);
        return next();
      }

      // 权限映射：系统权限 -> 角色权限
      // 使用与 extend-permissions-system.js 一致的点号命名格式
      const permissionMap = {
        // 资产相关权限
        'asset.view_all': ['asset.view_all', 'asset.view_own_department'],
        'asset.edit_all': ['asset.edit_all', 'asset.edit_own_department'],
        'asset.view_own_department': ['asset.view_own_department'],
        'asset.edit_own_department': ['asset.edit_own_department'],
        'asset.add': ['asset.add'],
        'asset.delete_all': ['asset.delete_all', 'asset.delete_own_department'],
        'asset.delete_own_department': ['asset.delete_own_department'],
        'asset.import': ['asset.import'],
        'asset.export': ['asset.export'],

        // 图片相关权限
        'image.upload': ['image.upload'],
        'image.delete': ['image.delete'],
        'image.view': ['image.view'],

        // 技术资料相关权限
        'document.upload': ['document.upload'],
        'document.download': ['document.download'],
        'document.delete': ['document.delete'],
        'document.link': ['document.link'],
        'document.unlink': ['document.unlink'],
        'document.review': ['document.review'],
        'document.share_link': ['document.share_link'],

        // 维修相关权限
        'maintenance.view': ['maintenance.view'],
        'maintenance.add': ['maintenance.add'],
        'maintenance.edit': ['maintenance.edit'],
        'maintenance.delete': ['maintenance.delete'],

        // 质量控制相关权限
        'quality_control.view_all': ['quality_control.view_all', 'quality_control.view_own_department'],
        'quality_control.edit_all': ['quality_control.edit_all', 'quality_control.edit_own_department'],
        'quality_control.view_own_department': ['quality_control.view_own_department'],
        'quality_control.edit_own_department': ['quality_control.edit_own_department'],
        'quality_control.approve': ['quality_control.approve', 'quality_control.edit_all'],

        // 计量管理相关权限
        'metrology.view': ['metrology.view', 'asset.view_own_department'],
        'metrology.edit': ['metrology.edit', 'asset.edit_own_department'],
        'metrology.approve': ['metrology.approve', 'metrology.edit'],

        // 不良事件相关权限
        'adverse_reaction.view': ['adverse_reaction.view', 'asset.view_own_department'],
        'adverse_reaction.edit': ['adverse_reaction.edit', 'asset.edit_own_department'],
        'adverse_reaction.approve': ['adverse_reaction.approve', 'adverse_reaction.edit', 'maintenance.approve'],

        // 用户管理相关权限
        'user.view': ['user.view'],
        'user.add': ['user.add'],
        'user.edit': ['user.edit'],
        'user.delete': ['user.delete'],
        'user.manage_role': ['user.manage_role'],

        // 角色和权限管理
        'role.view': ['role.view'],
        'role.add': ['role.add'],
        'role.edit': ['role.edit'],
        'role.delete': ['role.delete'],
        'role.manage_permissions': ['role.manage_permissions'],

        // 科室管理权限
        'department.view': ['department.view'],
        'department.add': ['department.add'],
        'department.edit': ['department.edit'],
        'department.delete': ['department.delete'],

        // 统计信息权限
        'statistics.view': ['statistics.view'],
        'statistics.export': ['statistics.export'],

        // 系统操作权限
        'system.backup': ['system.backup'],
        'system.restore': ['system.restore'],
        'system.config': ['system.config'],
        'system.audit_log': ['system.audit_log'],

        // 调配相关权限
        'transfer.view': ['transfer.view'],
        'transfer.apply': ['transfer.apply'],
        'transfer.approve': ['transfer.approve'],
        'transfer.complete': ['transfer.complete'],

        // 盘点相关权限
        'inventory.view': ['inventory.view'],
        'inventory.create': ['inventory.create'],
        'inventory.edit': ['inventory.edit'],
        'inventory.delete': ['inventory.delete'],
        'inventory.complete': ['inventory.complete', 'inventory.edit'],

        // 用户管理权限（补充缺失映射）
        'manage_users': ['manage_users', 'user.manage_role', 'user.view'],

        // 维修审批权限（补充缺失映射）
        'maintenance.approve': ['maintenance.approve', 'maintenance.edit'],

        // 报废相关权限
        'scrapping.view': ['scrapping.view'],
        'scrapping.apply': ['scrapping.apply'],
        'scrapping.approve': ['scrapping.approve'],

        // 验收相关权限
        'acceptance.view': ['acceptance.view'],
        'acceptance.add': ['acceptance.add'],
        'acceptance.edit': ['acceptance.edit'],
        'acceptance.approve': ['acceptance.approve'],

        // 折旧相关权限
        'depreciation.view': ['depreciation.view'],
        'depreciation.calculate': ['depreciation.calculate'],

        // 采购相关权限
        'procurement.view': ['procurement.view'],
        'procurement.add': ['procurement.add'],
        'procurement.edit': ['procurement.edit'],
        'procurement.approve': ['procurement.approve'],

        // IoT相关权限
        'iot.device.view': ['iot.device.view'],
        'iot.device.manage': ['iot.device.manage'],
        'iot.monitoring.view': ['iot.monitoring.view'],

        // 标签管理权限
        'label.view': ['label.view'],
        'label.manage': ['label.manage'],

        // 云同步权限
        'cloud_sync.manage': ['cloud_sync.manage'],
      };

      // 角色代码（用于 authorize(['system_admin']) 这类"按角色限制"的入参）
      // 命中后会被直接当作 role 检查项，与 permissionSet 一起短路
      const ROLE_CODES = new Set([
        'super_admin', 'system_admin', 'asset_admin', 'department_admin',
        'metrology_admin', 'quality_admin', 'maintenance_admin', 'maintenance_engineer',
        'acceptance_admin', 'transfer_admin', 'inventory_admin', 'user',
      ]);

      // 确定需要检查的权限列表
      // 支持单权限字符串和权限数组两种入参
      // 入参可以是权限码 (e.g. 'manage_users') 或角色代码 (e.g. 'system_admin')
      const permissionsToCheck = requestedPermissions.flatMap(p => {
        if (permissionMap[p]) return permissionMap[p];
        if (ROLE_CODES.has(p)) return [p];
        return [p];
      });

      // 检查用户角色是否拥有任一所需权限
      let userPermissions = [];
      let permissionSet = null;

      try {
        // 1. 先尝试从缓存获取权限
        // 注意：getCachedPermissions 是 async 函数，必须 await，否则拿到的是 Promise（永远为真），
        // 会导致下方 if (!permissionSet) 分支被跳过，最终 permissionSet.has(...) 抛错 -> 500 权限检查失败
        permissionSet = await getCachedPermissions(req.user.role, req.user.tenant_id, req.user.id);

        if (!permissionSet) {
          // 缓存未命中，从数据库获取
          let tenantPermsApplied = false;
          // 多租户：优先读 tenant_role_permissions（per-tenant 覆盖）
          if (req.user.tenant_id) {
            try {
              const [tp] = await executeQuery(
                'SELECT permission_key FROM tenant_role_permissions WHERE tenant_id = ? AND role = ?',
                [req.user.tenant_id, req.user.role],
              );
              if (tp && tp.length > 0) {
                userPermissions = tp.map(p => p.permission_key);
                tenantPermsApplied = true;
              }
            } catch (e) { /* tenant_role_permissions 表不存在等：忽略，回退 */ }
          }
          if (!tenantPermsApplied) {
          // 检查role_permissions表是否存在
          const [tables] = await executeQuery(
            'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
            ['role_permissions'],
          );

          if (tables.length > 0) {
            const [columns] = await executeQuery(
              'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
              ['role_permissions', 'tenant_id'],
            );

            let permissionQuery, permissionParams;
            if (columns.length > 0 && req.user.tenant_id) {
              permissionQuery = 'SELECT permission FROM role_permissions WHERE role = ? AND (tenant_id = ? OR tenant_id IS NULL)';
              permissionParams = [req.user.role, req.user.tenant_id];
            } else {
              permissionQuery = 'SELECT permission FROM role_permissions WHERE role = ?';
              permissionParams = [req.user.role];
            }

            const [permissions] = await executeQuery(permissionQuery, permissionParams);
            userPermissions = permissions.map(p => p.permission);
          } else {
            // 如果role_permissions表不存在，使用默认权限
            // 根据用户角色分配默认权限（使用与extend-permissions-system.js一致的命名格式）
            switch (req.user.role) {
              case 'asset_admin':
                userPermissions = [
                  'asset.view_own_department',
                  'asset.edit_own_department',
                  'asset.add',
                  'asset.delete_own_department',
                  'asset.export',
                  'image.upload',
                  'image.delete',
                  'image.view',
                  'document.upload',
                  'document.download',
                  'document.link',
                  'document.unlink',
                  'document.review',
                  'maintenance.view',
                  'maintenance.add',
                  'maintenance.edit',
                  'statistics.view',
                  'transfer.view',
                  'transfer.apply',
                  'inventory.view',
                  'inventory.create',
                  // 质量管理：业务上资产管理员需要查看资产质量历史 + 录入质控记录
                  'quality_control.view_own_department',
                  'quality_control.edit_own_department',
                  'metrology.view',
                ];
                break;
              case 'department_admin':
                userPermissions = [
                  'asset.view_own_department',
                  'image.view',
                  'document.download',
                  'maintenance.view',
                  'statistics.view',
                ];
                break;
              case 'metrology_admin':
                userPermissions = [
                  'asset.view_own_department',
                  'quality_control.view_own_department',
                  'statistics.view',
                ];
                break;
              case 'quality_admin':
                userPermissions = [
                  'asset.view_own_department',
                  'quality_control.view_all',
                  'quality_control.edit_all',
                  'statistics.view',
                ];
                break;
              case 'maintenance_admin':
                userPermissions = [
                  'asset.view_own_department',
                  'maintenance.view',
                  'maintenance.add',
                  'maintenance.edit',
                  'maintenance.delete',
                  'statistics.view',
                ];
                break;
              case 'maintenance_engineer':
                userPermissions = [
                  'asset.view_own_department',
                  'maintenance.view',
                  'maintenance.add',
                  'maintenance.edit',
                  'statistics.view',
                  'iot.device.view',
                ];
                break;
              case 'acceptance_admin':
                userPermissions = [
                  'asset.view_own_department',
                  'asset.add',
                  'asset.edit_own_department',
                  'statistics.view',
                  'image.view',
                  'document.upload',
                  'document.download',
                ];
                break;
              case 'transfer_admin':
                userPermissions = [
                  'asset.view_own_department',
                  'transfer.view',
                  'transfer.apply',
                  'transfer.approve',
                  'transfer.complete',
                  'statistics.view',
                  'image.view',
                ];
                break;
              case 'inventory_admin':
                userPermissions = [
                  'asset.view_own_department',
                  'inventory.view',
                  'inventory.create',
                  'inventory.edit',
                  'inventory.delete',
                  'statistics.view',
                  'image.view',
                ];
                break;
              case 'system_admin':
                // system_admin 在上方已直接返回，这里作为备用
                userPermissions = ['*'];
                break;
              case 'super_admin':
                // super_admin 在上方已直接返回，这里作为备用
                userPermissions = ['*'];
                break;
              default:
                userPermissions = [];
            }
          }
          } // end if (!tenantPermsApplied)

          // 设置缓存
          setCachedPermissions(req.user.role, req.user.tenant_id, userPermissions, req.user.id);
          permissionSet = new Set(userPermissions);
        }
      } catch (error) {
        console.error('获取用户权限失败:', error);
        // 发生错误时，使用默认权限（安全降级）
        userPermissions = [];
        permissionSet = new Set();
      }

      // 使用 Set 进行 O(1) 复杂度的权限检查
      // 同时支持按权限码匹配和按角色代码直接短路
      const hasPermission = permissionsToCheck.some(
        p => p === req.user.role || permissionSet.has(p),
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: '权限不足',
          required: Array.isArray(permission) ? permission.join(' | ') : permission,
          role: req.user.role,
        });
      }

      next();
    } catch (error) {
      console.error('权限检查失败:', error);
      return res.status(500).json({ success: false, message: '权限检查失败' });
    }
  };
};

// 资产管理员只能操作自己科室的资产
const restrictToOwnDepartment = async (req, res, next) => {
  try {
    // 超级管理员和系统管理员（租户级）可以操作所有科室
    // 超级管理员拥有所有科室权限，通过['*']标识
    if (
      req.user.is_super_admin ||
      req.user.managed_departments.includes('*') ||
      req.user.role === 'system_admin'
    ) {
      return next();
    }

    // 检查用户是否有管理科室
    if (!req.user.managed_departments || req.user.managed_departments.length === 0) {
      return res.status(403).json({ success: false, message: '用户未分配管理科室' });
    }

    // 对于资产相关操作，确保只能访问自己管理科室的资产
    if (req.params.id) {
      // 合并查询：获取资产详情并直接获取对应的科室编码，减少数据库查询次数
      const [assets] = await executeQuery(
        `SELECT a.id, a.department, a.department_new, a.tenant_id, COALESCE(d.department_code, 0) as department_code
         FROM assets a
         LEFT JOIN departments d ON (a.department_new = d.department_name OR a.department = d.department_name) AND d.tenant_id = a.tenant_id
         WHERE a.id = ? AND a.tenant_id = ?`,
        [req.params.id, req.user.tenant_id],
      );

      if (assets.length === 0) {
        return res.status(404).json({ success: false, message: '资产不存在' });
      }

      const asset = assets[0];
      const assetDepartmentCode = asset.department_code;

      // 检查资产科室是否在用户的管理科室列表中
      if (req.user.managed_departments.includes(assetDepartmentCode)) {
        next();
      } else {
        res.status(403).json({ success: false, message: '只能操作自己管理科室的资产' });
      }
    } else {
      // 对于列表请求，已经在路由中处理了过滤逻辑
      // 这里不需要额外处理，直接通过
      next();
    }
  } catch (error) {
    console.error('权限检查失败:', error);
    res.status(500).json({ success: false, message: '权限检查失败' });
  }
};

// 要求系统管理员权限的中间件（租户级系统管理员）
const requireSystemAdmin = (req, res, next) => {
  // 首先需要认证
  if (!req.user) {
    return res.status(401).json({ success: false, message: '需要先登录' });
  }

  // 检查是否为系统管理员（租户级）或超级管理员
  if (req.user.role !== 'system_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: '只有系统管理员可以执行此操作' });
  }

  next();
};

// 要求超级管理员权限的中间件（仅超级管理员）
const requireSuperAdmin = (req, res, next) => {
  // 首先需要认证
  if (!req.user) {
    return res.status(401).json({ success: false, message: '需要先登录' });
  }

  // 检查是否为超级管理员
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: '只有超级管理员可以执行此操作' });
  }

  next();
};

module.exports = {
  generateToken,
  authenticate,
  authorize,
  restrictToOwnDepartment,
  requireSystemAdmin,
  requireSuperAdmin,
  requireRoleScope,
  clearPermissionCache, // 导出缓存清理函数，供权限管理接口调用
};
