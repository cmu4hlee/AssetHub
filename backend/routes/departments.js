const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { logAudit } = require('../middleware/auditLogger');
const { getTenantId } = require('../middleware/tenant-filter');
const DepartmentService = require('../services/department.service');
const { getDatabase } = require('../core/DatabaseInterface');
const { getEventBus } = require('../core/EventBus');
const db = require('../config/database');

const departmentService = new DepartmentService({
  db: getDatabase(),
  eventBus: getEventBus(),
});

// 公开的科室搜索端点（无需认证，用于注册页等公开场景）
// GET /api/departments/search?tenant_code=1234&keyword=内科
router.get('/search', async (req, res) => {
  try {
    const tenantCode = String(req.query.tenant_code || '').trim();
    const keyword = String(req.query.keyword || '').trim().substring(0, 100);

    if (!/^\d{3,4}$/.test(tenantCode)) {
      return res.status(400).json({ success: false, message: '请输入3-4位数字企业编码' });
    }

    // 解析企业编码 → 租户ID
    const [tenants] = await db.execute(
      'SELECT id, tenant_name FROM tenants WHERE tenant_code = ? AND status = ?',
      [tenantCode, 'active'],
    );
    if (tenants.length === 0) {
      return res.status(404).json({ success: false, message: '企业编码不存在或已停用' });
    }
    const tenantId = tenants[0].id;

    // 关键字搜索科室
    let whereClause = 'WHERE tenant_id = ?';
    const params = [tenantId];
    if (keyword) {
      whereClause += ' AND (department_code LIKE ? OR department_name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const [departments] = await db.execute(
      `SELECT department_code, department_name, level, parent_code
       FROM departments
       ${whereClause}
       ORDER BY level, department_name
       LIMIT 50`,
      params,
    );

    res.json({
      success: true,
      data: departments,
      tenantName: tenants[0].tenant_name,
    });
  } catch (error) {
    console.error('公开科室搜索失败:', error);
    res.status(500).json({ success: false, message: '搜索科室失败' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { keyword, page, pageSize } = req.query;
    const result = await departmentService.listDepartments(tenantId, { keyword, page, pageSize });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('获取部门列表失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '获取部门列表失败',
    });
  }
});

router.get('/tree', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '租户ID不能为空' });
    }
    const data = await departmentService.getDepartmentTree(tenantId);
    if (data.length === 0) {
      return res.status(404).json({ success: false, message: '部门不存在' });
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取部门树形结构失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '获取部门树形结构失败',
    });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { department_name, parent_code } = req.body;
    const data = await departmentService.createDepartment(tenantId, { department_name, parent_code });

    await logAudit(req, {
      action_type: 'create',
      module: 'departments',
      resource_type: 'department',
      resource_id: data.id,
      resource_name: department_name,
      action_description: `创建部门：${department_name}`,
      new_value: data,
      response_status: 200,
    });

    res.json({ success: true, message: '部门创建成功', data });
  } catch (error) {
    console.error('创建部门失败:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: '部门名称已存在' });
    }
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '创建部门失败',
    });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const { department_name, parent_code } = req.body;
    const existingDept = await departmentService.getDepartmentById(id, tenantId);
    const data = await departmentService.updateDepartment(id, tenantId, { department_name, parent_code });

    await logAudit(req, {
      action_type: 'update',
      module: 'departments',
      resource_type: 'department',
      resource_id: id,
      resource_name: department_name,
      action_description: `更新部门：${department_name}`,
      new_value: data,
      old_value: existingDept,
      response_status: 200,
    });

    res.json({ success: true, message: '部门更新成功' });
  } catch (error) {
    console.error('更新部门失败:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: '部门名称已存在' });
    }
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '更新部门失败',
    });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const existingDept = await departmentService.getDepartmentById(id, tenantId);
    const data = await departmentService.deleteDepartment(id, tenantId);

    await logAudit(req, {
      action_type: 'delete',
      module: 'departments',
      resource_type: 'department',
      resource_id: id,
      resource_name: data.department_name,
      action_description: `删除部门：${data.department_name}`,
      old_value: existingDept,
      response_status: 200,
    });

    res.json({ success: true, message: '部门删除成功' });
  } catch (error) {
    console.error('删除部门失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '删除部门失败',
    });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const data = await departmentService.getDepartmentById(id, tenantId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取部门详情失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '获取部门详情失败',
    });
  }
});

module.exports = router;
