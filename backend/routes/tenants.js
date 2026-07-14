const express = require('express');
const router = express.Router();
const db = require('../config/database');
const {
  authenticate,
  requireSuperAdmin,
  requireSystemAdmin,
  requireRoleScope,
} = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');

// ============================================
// 租户（企业）管理相关接口
// ============================================

// 获取租户列表（超级管理员和系统管理员）
router.get('/', authenticate, requireSystemAdmin, requireRoleScope('tenants.read'), async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, status } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 租户级系统管理员只能查看自己所属企业
    if (req.user.role === 'system_admin') {
      whereClause += ' AND id = ?';
      params.push(req.user.tenant_id);
    }

    if (keyword) {
      whereClause += ' AND (tenant_name LIKE ? OR tenant_code LIKE ? OR contact_person LIKE ?)';
      const keywordParam = `%${keyword}%`;
      params.push(keywordParam, keywordParam, keywordParam);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM tenants ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const [rows] = await db.execute(
      `SELECT * FROM tenants ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取租户列表失败:', error);
    res.status(500).json({ success: false, message: '获取租户列表失败', error: error.message });
  }
});

// 获取单个租户详情
router.get('/:id(\\d+)', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 超级管理员可查看任意租户，其他用户仅可查看自己的租户
    let whereClause = 'WHERE id = ?';
    const params = [id];

    if (req.user.role !== 'super_admin') {
      whereClause += ' AND id = ?';
      params.push(req.user.tenant_id);
    }

    const [tenants] = await db.execute(`SELECT * FROM tenants ${whereClause}`, params);

    if (tenants.length === 0) {
      return res.status(404).json({ success: false, message: '租户不存在' });
    }

    // 获取租户统计信息
    const [userCount] = await db.execute(
      'SELECT COUNT(*) as count FROM user_tenant_roles WHERE tenant_id = ? AND status = ?',
      [id, 'active'],
    );
    const [assetCount] = await db.execute(
      'SELECT COUNT(*) as count FROM assets WHERE tenant_id = ?',
      [id],
    );

    res.json({
      success: true,
      data: {
        ...tenants[0],
        statistics: {
          user_count: userCount[0].count,
          asset_count: assetCount[0].count,
        },
      },
    });
  } catch (error) {
    console.error('获取租户详情失败:', error);
    res.status(500).json({ success: false, message: '获取租户详情失败', error: error.message });
  }
});

// 创建租户（仅超级管理员）
router.post('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const {
      tenant_code,
      tenant_name,
      contact_person,
      contact_phone,
      contact_email,
      address,
      license_no,
      max_users,
      max_assets,
      subscription_type,
      subscription_start_date,
      subscription_end_date,
      remark,
    } = req.body;

    if (!tenant_code || !tenant_name) {
      return res.status(400).json({ success: false, message: '租户编码和企业名称不能为空' });
    }

    // 检查租户编码是否已存在
    const [existing] = await db.execute('SELECT id FROM tenants WHERE tenant_code = ?', [
      tenant_code,
    ]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: '租户编码已存在' });
    }

    const [result] = await db.execute(
      `INSERT INTO tenants (
        tenant_code, tenant_name, contact_person, contact_phone, contact_email,
        address, license_no, max_users, max_assets, subscription_type,
        subscription_start_date, subscription_end_date, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenant_code,
        tenant_name,
        contact_person || null,
        contact_phone || null,
        contact_email || null,
        address || null,
        license_no || null,
        max_users || 100,
        max_assets || 10000,
        subscription_type || 'free',
        subscription_start_date || null,
        subscription_end_date || null,
        remark || null,
      ],
    );

    res.json({
      success: true,
      message: '租户创建成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error('创建租户失败:', error);
    res.status(500).json({ success: false, message: '创建租户失败', error: error.message });
  }
});

// 更新租户信息
router.put(
  '/:id(\\d+)',
  authenticate,
  requireSystemAdmin,
  requireRoleScope('tenants.update'),
  async (req, res) => {
  try {
    const { id } = req.params;

    // 超级管理员可以更新所有租户，普通用户只能更新自己的租户
    let whereClause = 'WHERE id = ?';
    const params = [id];

    if (req.user.role !== 'super_admin') {
      whereClause += ' AND id = ?';
      params.push(req.user.tenant_id);
    }

    const [existing] = await db.execute(`SELECT id FROM tenants ${whereClause}`, params);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '租户不存在' });
    }

    const {
      tenant_name,
      contact_person,
      contact_phone,
      contact_email,
      address,
      license_no,
      max_users,
      max_assets,
      subscription_type,
      subscription_start_date,
      subscription_end_date,
      status,
      remark,
    } = req.body;

    await db.execute(
      `UPDATE tenants SET
        tenant_name = COALESCE(?, tenant_name),
        contact_person = ?,
        contact_phone = ?,
        contact_email = ?,
        address = ?,
        license_no = ?,
        max_users = COALESCE(?, max_users),
        max_assets = COALESCE(?, max_assets),
        subscription_type = COALESCE(?, subscription_type),
        subscription_start_date = ?,
        subscription_end_date = ?,
        status = COALESCE(?, status),
        remark = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        tenant_name,
        contact_person || null,
        contact_phone || null,
        contact_email || null,
        address || null,
        license_no || null,
        max_users,
        max_assets,
        subscription_type,
        subscription_start_date || null,
        subscription_end_date || null,
        status,
        remark || null,
        id,
      ],
    );

    res.json({
      success: true,
      message: '租户信息更新成功',
    });
  } catch (error) {
    console.error('更新租户失败:', error);
    res.status(500).json({ success: false, message: '更新租户失败', error: error.message });
  }
  },
);

// 删除租户（仅超级管理员，软删除）
router.delete('/:id(\\d+)', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否有用户关联
    const [users] = await db.execute(
      'SELECT COUNT(*) as count FROM user_tenant_roles WHERE tenant_id = ?',
      [id],
    );
    if (users[0].count > 0) {
      return res.status(400).json({ success: false, message: '该租户下还有用户，无法删除' });
    }

    // 软删除：将状态改为 inactive
    await db.execute('UPDATE tenants SET status = ?, updated_at = NOW() WHERE id = ?', [
      'inactive',
      id,
    ]);

    res.json({
      success: true,
      message: '租户已停用',
    });
  } catch (error) {
    console.error('删除租户失败:', error);
    res.status(500).json({ success: false, message: '删除租户失败', error: error.message });
  }
});

// 验证企业编码（登录流程第一步）
router.post('/verify', async (req, res) => {
  try {
    const { tenant_code } = req.body;

    if (!tenant_code) {
      return res.status(400).json({
        success: false,
        message: '请输入企业编码',
      });
    }

    // 验证企业编码
    const [tenants] = await db.execute(
      `SELECT id, tenant_name, status, subscription_end_date 
       FROM tenants 
       WHERE tenant_code = ?`,
      [tenant_code],
    );

    if (tenants.length === 0) {
      return res.status(404).json({
        success: false,
        message: '企业编码不存在，请检查输入',
      });
    }

    const tenant = tenants[0];

    // 检查企业状态
    if (tenant.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: '该企业已被停用，请联系管理员',
      });
    }

    // 检查企业订阅是否过期
    if (tenant.subscription_end_date && new Date(tenant.subscription_end_date) < new Date()) {
      return res.status(403).json({
        success: false,
        message: '该企业订阅已过期，请联系管理员续费',
      });
    }

    // 验证成功
    res.json({
      success: true,
      data: {
        tenant_id: tenant.id,
        tenant_name: tenant.tenant_name,
        tenant_code,
        status: tenant.status,
      },
    });
  } catch (error) {
    console.error('验证企业编码失败:', error);
    res.status(500).json({
      success: false,
      message: '验证企业编码时发生错误，请稍后重试',
    });
  }
});

// 获取当前用户的租户信息
router.get('/current/info', authenticate, async (req, res) => {
  try {
    if (!req.user.tenant_id) {
      return res.status(404).json({ success: false, message: '用户未关联租户' });
    }

    const [tenants] = await db.execute('SELECT * FROM tenants WHERE id = ?', [req.user.tenant_id]);

    if (tenants.length === 0) {
      return res.status(404).json({ success: false, message: '租户不存在' });
    }

    res.json({
      success: true,
      data: tenants[0],
    });
  } catch (error) {
    console.error('获取租户信息失败:', error);
    res.status(500).json({ success: false, message: '获取租户信息失败', error: error.message });
  }
});

module.exports = router;
