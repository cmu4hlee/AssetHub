const express = require('express');
const router = express.Router();
const EnhancedPermissionService = require('../services/enhanced-permission.service');
const { authenticate, requireSystemAdmin, requireRoleScope } = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');
const db = require('../config/database');

const permissionService = new EnhancedPermissionService();

// 获取数据权限范围定义
router.get('/data-scopes/definitions', authenticate, async (req, res) => {
  try {
    const definitions = permissionService.getDataScopeDefinitions();
    res.json({
      success: true,
      data: definitions,
    });
  } catch (error) {
    console.error('获取数据权限范围定义失败:', error);
    res.status(500).json({ success: false, message: '获取数据权限范围定义失败' });
  }
});

// 获取角色数据权限范围
router.get('/roles/:role/data-scope', authenticate, requireRoleScope('permissions.read'), async (req, res) => {
  try {
    const { role } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无效的租户ID' });
    }

    const dataScope = await permissionService.getRoleDataScope(role, tenantId);
    res.json({
      success: true,
      data: dataScope,
    });
  } catch (error) {
    console.error('获取角色数据权限范围失败:', error);
    res.status(500).json({ success: false, message: '获取角色数据权限范围失败' });
  }
});

// 设置角色数据权限范围
router.put('/roles/:role/data-scope', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { role } = req.params;
    const { data_scope, custom_departments } = req.body;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无效的租户ID' });
    }

    if (!data_scope) {
      return res.status(400).json({ success: false, message: '请提供数据权限范围' });
    }

    const result = await permissionService.setRoleDataScope(role, tenantId, data_scope, custom_departments || []);
    res.json({
      success: true,
      message: '角色数据权限范围设置成功',
      data: result,
    });
  } catch (error) {
    console.error('设置角色数据权限范围失败:', error);
    res.status(500).json({ success: false, message: error.message || '设置角色数据权限范围失败' });
  }
});

// 获取用户数据权限范围
router.get('/users/:userId/data-scope', authenticate, requireRoleScope('permissions.read'), async (req, res) => {
  try {
    const { userId } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无效的租户ID' });
    }

    const dataScope = await permissionService.getUserDataScope(parseInt(userId), tenantId);
    res.json({
      success: true,
      data: dataScope,
    });
  } catch (error) {
    console.error('获取用户数据权限范围失败:', error);
    res.status(500).json({ success: false, message: '获取用户数据权限范围失败' });
  }
});

// 设置用户数据权限范围
router.put('/users/:userId/data-scope', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { data_scope, custom_departments } = req.body;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无效的租户ID' });
    }

    if (!data_scope) {
      return res.status(400).json({ success: false, message: '请提供数据权限范围' });
    }

    const result = await permissionService.setUserDataScope(parseInt(userId), tenantId, data_scope, custom_departments || []);
    res.json({
      success: true,
      message: '用户数据权限范围设置成功',
      data: result,
    });
  } catch (error) {
    console.error('设置用户数据权限范围失败:', error);
    res.status(500).json({ success: false, message: error.message || '设置用户数据权限范围失败' });
  }
});

// 获取用户权限列表
router.get('/users/:userId/permissions', authenticate, requireRoleScope('permissions.read'), async (req, res) => {
  try {
    const { userId } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无效的租户ID' });
    }

    const permissions = await permissionService.getUserPermissions(parseInt(userId), tenantId);
    res.json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    console.error('获取用户权限列表失败:', error);
    res.status(500).json({ success: false, message: '获取用户权限列表失败' });
  }
});

// 添加用户权限
router.post('/users/:userId/permissions', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { permission } = req.body;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无效的租户ID' });
    }

    if (!permission) {
      return res.status(400).json({ success: false, message: '请提供权限代码' });
    }

    const result = await permissionService.addUserPermission(parseInt(userId), tenantId, permission);
    res.json({
      success: true,
      message: '用户权限添加成功',
      data: result,
    });
  } catch (error) {
    console.error('添加用户权限失败:', error);
    res.status(500).json({ success: false, message: error.message || '添加用户权限失败' });
  }
});

// 移除用户权限
router.delete('/users/:userId/permissions/:permission', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { userId, permission } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无效的租户ID' });
    }

    const result = await permissionService.removeUserPermission(parseInt(userId), tenantId, permission);
    res.json({
      success: true,
      message: '用户权限移除成功',
      data: result,
    });
  } catch (error) {
    console.error('移除用户权限失败:', error);
    res.status(500).json({ success: false, message: '移除用户权限失败' });
  }
});

// 拒绝用户权限
router.post('/users/:userId/permissions/deny', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { permission } = req.body;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无效的租户ID' });
    }

    if (!permission) {
      return res.status(400).json({ success: false, message: '请提供权限代码' });
    }

    const result = await permissionService.denyUserPermission(parseInt(userId), tenantId, permission);
    res.json({
      success: true,
      message: '用户权限已拒绝',
      data: result,
    });
  } catch (error) {
    console.error('拒绝用户权限失败:', error);
    res.status(500).json({ success: false, message: '拒绝用户权限失败' });
  }
});

// 获取用户菜单权限
router.get('/users/:userId/menu-permissions', authenticate, requireRoleScope('permissions.read'), async (req, res) => {
  try {
    const { userId } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无效的租户ID' });
    }

    const permissions = await permissionService.getUserMenuPermissions(parseInt(userId), tenantId);
    res.json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    console.error('获取用户菜单权限失败:', error);
    res.status(500).json({ success: false, message: '获取用户菜单权限失败' });
  }
});

// 设置用户菜单权限
router.post('/users/:userId/menu-permissions', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { menu_key, is_visible } = req.body;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无效的租户ID' });
    }

    if (!menu_key) {
      return res.status(400).json({ success: false, message: '请提供菜单键' });
    }

    const result = await permissionService.setUserMenuPermission(parseInt(userId), tenantId, menu_key, is_visible !== false);
    res.json({
      success: true,
      message: '用户菜单权限设置成功',
      data: result,
    });
  } catch (error) {
    console.error('设置用户菜单权限失败:', error);
    res.status(500).json({ success: false, message: '设置用户菜单权限失败' });
  }
});

// 获取审计日志
router.get('/audit-logs', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { page = 1, pageSize = 20, user_id, action, start_date, end_date } = req.query;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无效的租户ID' });
    }

    const result = await permissionService.getAuditLogs(tenantId, {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      userId: user_id,
      action,
      startDate: start_date,
      endDate: end_date,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('获取审计日志失败:', error);
    res.status(500).json({ success: false, message: '获取审计日志失败' });
  }
});

module.exports = router;
