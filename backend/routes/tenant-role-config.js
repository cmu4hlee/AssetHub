/**
 * 租户管理员角色权限配置（需求④）
 *
 * 端点（均需 authenticate + requireSystemAdmin）：
 *   GET  /api/tenant-role-config/roles                      列出标准角色
 *   GET  /api/tenant-role-config/roles/:role/menus           查角色菜单可见性（本租户）
 *   PUT  /api/tenant-role-config/roles/:role/menus           批量设置角色菜单可见性
 *   GET  /api/tenant-role-config/roles/:role/data-scope      查角色数据范围
 *   PUT  /api/tenant-role-config/roles/:role/data-scope      设置角色数据范围
 *   GET  /api/tenant-role-config/roles/:role/permissions     查角色操作权限
 *   PUT  /api/tenant-role-config/roles/:role/permissions     设置角色操作权限
 *
 * 隔离：所有操作以 req.user.tenant_id 为准（super_admin 可用 ?tenant_id= 指定）。
 * 解析层（/user/menus、enhanced-permissions、authorize）优先读这些租户表，空则回退全局。
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireSystemAdmin, clearPermissionCache } = require('../middleware/auth');

// 解析当前操作租户：super_admin 可用 ?tenant_id=，否则用自身 tenant_id
function resolveTenant(req, res) {
  if (req.user.role === 'super_admin' && req.query.tenant_id) {
    const t = parseInt(req.query.tenant_id);
    if (Number.isInteger(t) && t > 0) return t;
  }
  if (!req.user.tenant_id) {
    res.status(400).json({ success: false, message: '当前会话无租户上下文' });
    return null;
  }
  return req.user.tenant_id;
}

const VALID_ROLES = new Set([
  'super_admin', 'system_admin', 'asset_admin', 'department_admin', 'metrology_admin',
  'quality_admin', 'maintenance_admin', 'maintenance_engineer', 'acceptance_admin',
  'transfer_admin', 'inventory_admin', 'user',
]);

function validateRole(req, res, role) {
  if (!VALID_ROLES.has(role)) {
    res.status(400).json({ success: false, message: '无效的角色代码' });
    return false;
  }
  // super_admin 角色配置仅 super_admin 可改
  if (role === 'super_admin' && req.user.role !== 'super_admin') {
    res.status(403).json({ success: false, message: '无权配置超级管理员角色' });
    return false;
  }
  return true;
}

// 列出标准角色
router.get('/roles', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT role_code, role_name, description, is_system_role, is_active FROM roles ORDER BY id"
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: '查询角色失败', error: e.message });
  }
});

// 查角色菜单可见性（本租户）
router.get('/roles/:role/menus', authenticate, requireSystemAdmin, async (req, res) => {
  const tenantId = resolveTenant(req, res);
  if (!tenantId) return;
  if (!validateRole(req, res, req.params.role)) return;
  try {
    const [rows] = await db.execute(
      'SELECT menu_key, is_visible FROM tenant_role_menus WHERE tenant_id=? AND role=?',
      [tenantId, req.params.role]
    );
    res.json({ success: true, data: rows, tenant_id: tenantId });
  } catch (e) {
    res.status(500).json({ success: false, message: '查询菜单失败', error: e.message });
  }
});

// 批量设置角色菜单可见性
// Body: { menus: [{ menu_key, is_visible }, ...] }
router.put('/roles/:role/menus', authenticate, requireSystemAdmin, async (req, res) => {
  const tenantId = resolveTenant(req, res);
  if (!tenantId) return;
  if (!validateRole(req, res, req.params.role)) return;
  const role = req.params.role;
  const menus = Array.isArray(req.body?.menus) ? req.body.menus : null;
  if (!menus) return res.status(400).json({ success: false, message: '需要 menus 数组' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const m of menus) {
      if (!m || !m.menu_key) continue;
      await conn.execute(
        `INSERT INTO tenant_role_menus (tenant_id, role, menu_key, is_visible)
         VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE is_visible=VALUES(is_visible), updated_at=NOW()`,
        [tenantId, role, m.menu_key, m.is_visible ? 1 : 0]
      );
    }
    await conn.commit();
    // 失效该角色在该租户的权限缓存
    await clearPermissionCache(role, tenantId);
    res.json({ success: true, message: '菜单权限已更新', tenant_id: tenantId, count: menus.length });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, message: '更新菜单失败', error: e.message });
  } finally {
    conn.release();
  }
});

// 查角色数据范围
router.get('/roles/:role/data-scope', authenticate, requireSystemAdmin, async (req, res) => {
  const tenantId = resolveTenant(req, res);
  if (!tenantId) return;
  if (!validateRole(req, res, req.params.role)) return;
  try {
    const [rows] = await db.execute(
      'SELECT data_scope, custom_department_codes FROM tenant_role_data_scopes WHERE tenant_id=? AND role=?',
      [tenantId, req.params.role]
    );
    res.json({ success: true, data: rows[0] || { data_scope: 'department', custom_department_codes: null }, tenant_id: tenantId });
  } catch (e) {
    res.status(500).json({ success: false, message: '查询数据范围失败', error: e.message });
  }
});

// 设置角色数据范围
// Body: { data_scope: 'all'|'department'|'self'|'custom', custom_department_codes?: [...] }
router.put('/roles/:role/data-scope', authenticate, requireSystemAdmin, async (req, res) => {
  const tenantId = resolveTenant(req, res);
  if (!tenantId) return;
  if (!validateRole(req, res, req.params.role)) return;
  const role = req.params.role;
  const { data_scope, custom_department_codes } = req.body || {};
  if (!['all', 'department', 'self', 'custom'].includes(data_scope)) {
    return res.status(400).json({ success: false, message: '无效的 data_scope' });
  }
  try {
    await db.execute(
      `INSERT INTO tenant_role_data_scopes (tenant_id, role, data_scope, custom_department_codes)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE data_scope=VALUES(data_scope), custom_department_codes=VALUES(custom_department_codes), updated_at=NOW()`,
      [tenantId, role, data_scope, custom_department_codes ? JSON.stringify(custom_department_codes) : null]
    );
    await clearPermissionCache(role, tenantId);
    res.json({ success: true, message: '数据范围已更新', tenant_id: tenantId });
  } catch (e) {
    res.status(500).json({ success: false, message: '更新数据范围失败', error: e.message });
  }
});

// 查角色操作权限
router.get('/roles/:role/permissions', authenticate, requireSystemAdmin, async (req, res) => {
  const tenantId = resolveTenant(req, res);
  if (!tenantId) return;
  if (!validateRole(req, res, req.params.role)) return;
  try {
    const [rows] = await db.execute(
      'SELECT permission_key FROM tenant_role_permissions WHERE tenant_id=? AND role=?',
      [tenantId, req.params.role]
    );
    res.json({ success: true, data: rows.map(r => r.permission_key), tenant_id: tenantId });
  } catch (e) {
    res.status(500).json({ success: false, message: '查询操作权限失败', error: e.message });
  }
});

// 设置角色操作权限（整体替换）
// Body: { permissions: ['asset.add', ...] }
router.put('/roles/:role/permissions', authenticate, requireSystemAdmin, async (req, res) => {
  const tenantId = resolveTenant(req, res);
  if (!tenantId) return;
  if (!validateRole(req, res, req.params.role)) return;
  const role = req.params.role;
  const perms = Array.isArray(req.body?.permissions) ? req.body.permissions : null;
  if (!perms) return res.status(400).json({ success: false, message: '需要 permissions 数组' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM tenant_role_permissions WHERE tenant_id=? AND role=?', [tenantId, role]);
    for (const p of perms) {
      if (!p || typeof p !== 'string') continue;
      await conn.execute(
        'INSERT IGNORE INTO tenant_role_permissions (tenant_id, role, permission_key) VALUES (?,?,?)',
        [tenantId, role, p]
      );
    }
    await conn.commit();
    await clearPermissionCache(role, tenantId);
    res.json({ success: true, message: '操作权限已更新', tenant_id: tenantId, count: perms.length });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, message: '更新操作权限失败', error: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
