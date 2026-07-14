const express = require('express');
const router = express.Router();
const TenantModuleConfigService = require('../services/tenant-module-config.service');
const { authenticate, requireSystemAdmin } = require('../middleware/auth');
const { canAccessTenant, normalizeTenantId } = require('../middleware/tenant-filter');

// 初始化服务
const tenantModuleConfigService = new TenantModuleConfigService();

// 应用中间件
router.use(authenticate); // 首先进行认证

const requireSuperAdminOnly = (req, res, next) => {
  if (req.user?.role === 'super_admin') {
    return next();
  }

  return res.status(403).json({ error: '只有超级管理员可以访问企业空间列表' });
};

const requireTenantScopedSystemAdmin = forbiddenMessage => {
  return (req, res, next) => {
    const requestedTenantId = normalizeTenantId(req.params.tenantId);
    if (!requestedTenantId) {
      return res.status(400).json({ error: '无效的企业空间ID' });
    }

    if (!canAccessTenant(req, requestedTenantId)) {
      return res.status(403).json({ error: forbiddenMessage });
    }

    req.requestedTenantId = requestedTenantId;
    next();
  };
};

const resolveConfigLogScope = (req, res, next) => {
  const hasTenantFilter =
    req.query.tenantId !== undefined && req.query.tenantId !== null && req.query.tenantId !== '';
  const requestedTenantId = hasTenantFilter ? normalizeTenantId(req.query.tenantId) : null;

  if (hasTenantFilter && !requestedTenantId) {
    return res.status(400).json({ error: '无效的企业空间ID' });
  }

  if (req.user?.role === 'super_admin') {
    req.effectiveTenantId = requestedTenantId;
    return next();
  }

  const currentTenantId = normalizeTenantId(req.user?.tenant_id);
  if (!currentTenantId) {
    return res.status(400).json({ error: '当前用户未分配企业空间' });
  }

  if (requestedTenantId && requestedTenantId !== currentTenantId) {
    return res.status(403).json({ error: '无权限查看其他企业空间的配置变更日志' });
  }

  req.effectiveTenantId = currentTenantId;
  next();
};

/**
 * @swagger
 * tags:
 *   name: TenantModuleConfig
 *   description: 企业空间模块配置管理
 */

/**
 * @swagger
 * /api/tenant-module-config/tenants:
 *   get:
 *     summary: 获取企业空间列表
 *     tags: [TenantModuleConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 按企业名称或ID搜索
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 每页数量
 *     responses:
 *       200:
 *         description: 成功获取企业空间列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 records:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       code:
 *                         type: string
 *                       status:
 *                         type: string
 */
router.get('/tenants', requireSuperAdminOnly, async (req, res) => {
  try {
    const { search, page = 1, pageSize = 10 } = req.query;
    const result = await tenantModuleConfigService.getTenants({
      search,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/tenant-module-config/tenants/{tenantId}/modules:
 *   get:
 *     summary: 获取指定企业空间的模块配置
 *     tags: [TenantModuleConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: 企业空间ID
 *     responses:
 *       200:
 *         description: 成功获取模块配置
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   module_id:
 *                     type: string
 *                   module_name:
 *                     type: string
 *                   version:
 *                     type: string
 *                   category:
 *                     type: string
 *                   type:
 *                     type: string
 *                   enabled:
 *                     type: boolean
 *                   config:
 *                     type: object
 */
router.get(
  '/tenants/:tenantId/modules',
  requireSystemAdmin,
  requireTenantScopedSystemAdmin('无权限访问此企业空间的模块配置'),
  async (req, res) => {
    try {
      const modules = await tenantModuleConfigService.getTenantModules(req.requestedTenantId);
      res.json(modules);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * @swagger
 * /api/tenant-module-config/tenants/{tenantId}/modules:
 *   put:
 *     summary: 更新企业空间的模块配置
 *     tags: [TenantModuleConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: 企业空间ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 module_id:
 *                   type: string
 *                 enabled:
 *                   type: boolean
 *                 config:
 *                   type: object
 *     responses:
 *       200:
 *         description: 成功更新模块配置
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.put(
  '/tenants/:tenantId/modules',
  requireSystemAdmin,
  requireTenantScopedSystemAdmin('无权限更新此企业空间的模块配置'),
  async (req, res) => {
    try {
      console.log('请求体:', req.body);
      const moduleConfigs = req.body;
      console.log('moduleConfigs:', moduleConfigs);
      console.log('moduleConfigs 类型:', typeof moduleConfigs);
      console.log('moduleConfigs 是否为数组:', Array.isArray(moduleConfigs));

      if (!moduleConfigs || !Array.isArray(moduleConfigs)) {
        return res.status(400).json({ error: '请求体必须是一个数组' });
      }

      await tenantModuleConfigService.updateTenantModules(
        req.requestedTenantId,
        moduleConfigs,
        req.user.id,
        req.user.username,
      );

      res.json({ success: true, message: '模块配置更新成功' });
    } catch (error) {
      console.error('更新模块配置失败:', error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * @swagger
 * /api/tenant-module-config/logs:
 *   get:
 *     summary: 获取配置变更日志
 *     tags: [TenantModuleConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         description: 企业空间ID
 *       - in: query
 *         name: moduleId
 *         schema:
 *           type: string
 *         description: 模块ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 开始日期
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 结束日期
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 每页数量
 *     responses:
 *       200:
 *         description: 成功获取配置变更日志
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 records:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       tenant_id:
 *                         type: string
 *                       tenant_name:
 *                         type: string
 *                       module_id:
 *                         type: string
 *                       module_name:
 *                         type: string
 *                       action:
 *                         type: string
 *                       old_value:
 *                         type: object
 *                       new_value:
 *                         type: object
 *                       operator_id:
 *                         type: string
 *                       operator_name:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 */
router.get('/logs', requireSystemAdmin, resolveConfigLogScope, async (req, res) => {
  try {
    const { moduleId, startDate, endDate, page = 1, pageSize = 10 } = req.query;

    const result = await tenantModuleConfigService.getConfigLogs({
      tenantId: req.effectiveTenantId,
      moduleId,
      startDate,
      endDate,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/tenant-module-config/modules:
 *   get:
 *     summary: 获取所有可用模块
 *     tags: [TenantModuleConfig]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功获取可用模块
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   version:
 *                     type: string
 *                   category:
 *                     type: string
 *                   type:
 *                     type: string
 *                   description:
 *                     type: string
 */
router.get('/modules', async (req, res) => {
  try {
    const modules = await tenantModuleConfigService.getAllModules();
    res.json(modules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/tenant-module-config/modules/{moduleId}/menus:
 *   get:
 *     summary: 获取指定模块的菜单列表
 *     tags: [TenantModuleConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 模块ID
 *     responses:
 *       200:
 *         description: 成功获取模块菜单列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   menu_key:
 *                     type: string
 *                   menu_label:
 *                     type: string
 *                   parent_key:
 *                     type: string
 *                   icon:
 *                     type: string
 *                   order_index:
 *                     type: integer
 */
router.get('/modules/:moduleId/menus', async (req, res) => {
  try {
    const { moduleId } = req.params;
    const menus = await tenantModuleConfigService.getModuleMenus(moduleId);
    res.json(menus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/tenant-module-config/tenants/{tenantId}/modules/{moduleId}/menus:
 *   get:
 *     summary: 获取指定企业空间的模块菜单配置
 *     tags: [TenantModuleConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: 企业空间ID
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 模块ID
 *     responses:
 *       200:
 *         description: 成功获取模块菜单配置
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   menu_key:
 *                     type: string
 *                   menu_label:
 *                     type: string
 *                   parent_key:
 *                     type: string
 *                   icon:
 *                     type: string
 *                   order_index:
 *                     type: integer
 *                   is_enabled:
 *                     type: boolean
 */
router.get(
  '/tenants/:tenantId/modules/:moduleId/menus',
  requireSystemAdmin,
  requireTenantScopedSystemAdmin('无权限访问此企业空间的模块菜单配置'),
  async (req, res) => {
    try {
      const { moduleId } = req.params;

      const menus = await tenantModuleConfigService.getTenantModuleMenus(
        req.requestedTenantId,
        moduleId,
      );
      res.json(menus);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * @swagger
 * /api/tenant-module-config/tenants/{tenantId}/modules/{moduleId}/menus:
 *   put:
 *     summary: 更新指定企业空间的模块菜单配置
 *     tags: [TenantModuleConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: 企业空间ID
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 模块ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 menu_key:
 *                   type: string
 *                 is_enabled:
 *                   type: boolean
 *     responses:
 *       200:
 *         description: 成功更新模块菜单配置
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.put(
  '/tenants/:tenantId/modules/:moduleId/menus',
  requireSystemAdmin,
  requireTenantScopedSystemAdmin('无权限更新此企业空间的模块菜单配置'),
  async (req, res) => {
    try {
      const { moduleId } = req.params;
      const menuConfigs = req.body;
      const userId = req.user.id;
      const userName = req.user.username;

      await tenantModuleConfigService.updateTenantModuleMenus(
        req.requestedTenantId,
        moduleId,
        menuConfigs,
        userId,
        userName,
      );

      res.json({ success: true, message: '模块菜单配置更新成功' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * @swagger
 * /api/tenant-module-config/modules/{moduleId}/dependencies:
 *   get:
 *     summary: 获取指定模块的依赖关系
 *     tags: [TenantModuleConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 模块ID
 *     responses:
 *       200:
 *         description: 成功获取模块依赖关系
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   dependency_id:
 *                     type: string
 *                   dependency_type:
 *                     type: string
 */
router.get('/modules/:moduleId/dependencies', async (req, res) => {
  try {
    const { moduleId } = req.params;
    const dependencies = await tenantModuleConfigService.getModuleDependencies(moduleId);
    res.json(dependencies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/tenant-module-config/modules/{moduleId}/check-dependencies:
 *   post:
 *     summary: 检查模块依赖关系
 *     tags: [TenantModuleConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 模块ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [enable, disable]
 *                 description: 操作类型
 *     responses:
 *       200:
 *         description: 成功检查模块依赖关系
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/modules/:moduleId/check-dependencies', async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { action } = req.body;

    if (!action || !['enable', 'disable'].includes(action)) {
      return res.status(400).json({ error: 'action参数必须是enable或disable' });
    }

    const result = await tenantModuleConfigService.checkModuleDependencies(moduleId, action);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
