const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../../middleware/auth');
const userController = require('../controllers/user.controller');

// 公开路由
router.post('/login', (req, res) => userController.login(req, res));
router.post('/register', (req, res) => userController.register(req, res));

// 需要认证的路由
router.post('/refresh-token', authenticate, (req, res) => userController.refreshToken(req, res));
router.post('/join-enterprise', authenticate, (req, res) => userController.joinEnterprise(req, res));
router.get('/profile', authenticate, (req, res) => userController.getProfile(req, res));

// 用户管理路由
router.get('/', authenticate, (req, res) => userController.getUsers(req, res));
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
router.get('/:id', authenticate, (req, res) => userController.getUserById(req, res));
router.post('/', authenticate, authorize('manage_users'), (req, res) => userController.createUser(req, res));
router.put('/:id', authenticate, (req, res) => userController.updateUser(req, res));
router.delete('/:id', authenticate, (req, res) => userController.deleteUser(req, res));
router.put('/:id/change-password', authenticate, (req, res) => userController.changePassword(req, res));

// 用户多租户角色管理
router.get('/:id/roles', authenticate, authorize(['system_admin']), (req, res) => userController.getUserRoles(req, res));
router.post('/:id/roles', authenticate, authorize(['system_admin']), (req, res) => userController.updateUserRole(req, res));
router.delete('/:id/roles/:tenantId', authenticate, authorize(['system_admin']), (req, res) => userController.deleteUserRole(req, res));

module.exports = router;
