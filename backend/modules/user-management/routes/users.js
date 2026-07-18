const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../../middleware/auth');
const { validateBody, validateQuery, validateParams } = require('../../../middleware/zod-validator');
const { LoginSchema, RegisterSchema, ChangePasswordSchema, ListUsersQuerySchema, IdParamSchema } = require('../../../schemas/user.schemas');
const userController = require('../controllers/user.controller');
const db = require('../../../config/database');

// 公开路由
router.post('/login', validateBody(LoginSchema), (req, res) => userController.login(req, res));
router.post('/register', validateBody(RegisterSchema), (req, res) => userController.register(req, res));
router.post('/register', (req, res) => userController.register(req, res));

// 需要认证的路由
router.post('/refresh-token', authenticate, (req, res) => userController.refreshToken(req, res));
router.post('/join-enterprise', authenticate, (req, res) => userController.joinEnterprise(req, res));
router.get('/profile', authenticate, (req, res) => userController.getProfile(req, res));

// 用户管理路由
router.get('/', authenticate, authorize('manage_users'), (req, res) => userController.getUsers(req, res));
router.get('/roles', authenticate, (req, res) => userController.getRoles(req, res));
router.get('/role-requests/pending', authenticate, authorize(['system_admin']), (req, res) => userController.getPendingRoleRequests(req, res));
router.put('/role-requests/:id/approve', authenticate, authorize(['system_admin']), (req, res) => userController.approveRoleRequest(req, res));
router.get('/pending', authenticate, authorize(['system_admin']), (req, res) => userController.getPendingUsers(req, res));
router.get('/unconfigured', authenticate, authorize(['system_admin', 'asset_admin', 'department_admin']), (req, res) => userController.getUnconfiguredUsers(req, res));
router.get('/role-stats', authenticate, authorize(['system_admin', 'asset_admin', 'department_admin']), (req, res) => userController.getUserRoleStats(req, res));
router.post('/batch-assign-role', authenticate, authorize(['system_admin']), (req, res) => userController.batchAssignRole(req, res));
router.put('/:id/approve', authenticate, authorize(['system_admin']), (req, res) => userController.approveUser(req, res));
router.get('/by-username/:username', authenticate, async (req, res) => {
  try {
    const { username } = req.params;
    const db = require('../../../config/database');
    // 非超级管理员只能查询本租户用户
    const tenantCondition = req.user.role !== 'super_admin' ? ' AND u.tenant_id = ?' : '';
    const params = req.user.role !== 'super_admin' ? [username, req.user.tenant_id] : [username];
    const [result] = await db.execute(
      `SELECT u.id, u.username, u.real_name, u.department_code, u.email, u.phone, u.status, u.created_at, u.tenant_id
       FROM users u
       WHERE u.username = ?${tenantCondition}
       LIMIT 1`,
      params,
    );
    if (result.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    res.json({ success: true, data: result[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: '查询失败', error: error.message });
  }
});
/**
 * 用户搜索（轻量）：用于资产调配、值班、协作等"选人"控件
 * GET /api/users/search?keyword=&limit=
 */
const USER_SEARCH_TRIGGER_ROLES = ['transfer.apply', 'transfer.view', 'manage_users', 'system_admin', 'super_admin'];

router.get('/search', authenticate, async (req, res) => {
  try {
    const role = req.user && req.user.role;
    if (role && !USER_SEARCH_TRIGGER_ROLES.includes(role)) {
      const userPerms = (req.user && req.user.permissions) || [];
      const allow = ['transfer.apply', 'transfer.view', 'transfer.approve', 'manage_users', 'asset.view_all'];
      if (!userPerms.some((p) => allow.includes(p))) {
        return res.status(403).json({ success: false, message: '无权搜索用户' });
      }
    }

    const keyword = (req.query.keyword || '').toString().trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const { getTenantId } = require('../../../middleware/tenant-filter');
    const tenantId = getTenantId(req);

    const where = ["u.status = 'active'"];
    const params = [];
    if (tenantId) {
      where.push('u.id IN (SELECT user_id FROM user_tenant_roles WHERE tenant_id = ? AND status = ?)');
      params.push(tenantId, 'active');
    }
    if (keyword) {
      where.push('(u.real_name LIKE ? OR u.username LIKE ?)');
      const like = `%${keyword}%`;
      params.push(like, like);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const [rows] = await db.execute(
      `SELECT u.id, u.real_name, u.username, u.department_code, u.email, u.phone
         FROM users u
         ${whereSql}
         ORDER BY u.real_name ASC, u.username ASC
         LIMIT ${limit}`,
      params,
    );

    if (rows.length > 0 && tenantId) {
      const codes = [...new Set(rows.map((r) => r.department_code).filter(Boolean))];
      if (codes.length > 0) {
        const placeholders = codes.map(() => '?').join(',');
        const [depts] = await db.execute(
          `SELECT department_code, department_name FROM departments WHERE tenant_id = ? AND department_code IN (${placeholders})`,
          [tenantId, ...codes],
        );
        const map = new Map(depts.map((d) => [d.department_code, d.department_name]));
        rows.forEach((r) => {
          if (r.department_code) r.department_name = map.get(r.department_code) || r.department_code;
        });
      }
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('用户搜索失败:', error);
    res.status(500).json({ success: false, message: '用户搜索失败', error: error.message });
  }
});

router.get('/:id', authenticate, authorize('manage_users'), (req, res) => userController.getUserById(req, res));
router.post('/', authenticate, authorize('manage_users'), (req, res) => userController.createUser(req, res));
router.put('/:id', authenticate, authorize('manage_users'), (req, res) => userController.updateUser(req, res));
router.delete('/:id', authenticate, authorize('manage_users'), (req, res) => userController.deleteUser(req, res));
router.put('/:id/change-password', authenticate, authorize('manage_users'), validateParams(IdParamSchema), validateBody(ChangePasswordSchema), (req, res) => userController.changePassword(req, res));
router.post('/:id/reset-password', authenticate, authorize('manage_users'), (req, res) => userController.resetPassword(req, res));
router.post('/batch-status', authenticate, authorize('manage_users'), (req, res) => userController.batchUpdateStatus(req, res));

// 用户多租户角色管理
router.get('/:id/roles', authenticate, authorize(['system_admin']), (req, res) => userController.getUserRoles(req, res));
router.post('/:id/roles', authenticate, authorize(['system_admin']), (req, res) => userController.updateUserRole(req, res));
router.delete('/:id/roles/:tenantId', authenticate, authorize(['system_admin']), (req, res) => userController.deleteUserRole(req, res));

module.exports = router;
