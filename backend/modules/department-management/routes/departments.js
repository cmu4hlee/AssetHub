const express = require('express');
const router = express.Router();
const { authenticate } = require('../../../middleware/auth');
const departmentController = require('../controllers/department.controller');
const db = require('../../../config/database');

// 公开的科室搜索端点（无需认证，用于注册页等公开场景）
// GET /api/departments/search?tenant_code=1962&keyword=内科
router.get('/search', async (req, res) => {
  try {
    const tenantCode = String(req.query.tenant_code || '').trim();
    const keyword = String(req.query.keyword || '').trim().substring(0, 100);

    if (!/^\d{3,4}$/.test(tenantCode)) {
      return res.status(400).json({ success: false, message: '请输入3-4位数字企业编码' });
    }

    const [tenants] = await db.execute(
      'SELECT id, tenant_name FROM tenants WHERE tenant_code = ? AND status = ?',
      [tenantCode, 'active'],
    );
    if (tenants.length === 0) {
      return res.status(404).json({ success: false, message: '企业编码不存在或已停用' });
    }
    const tenantId = tenants[0].id;

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

router.get('/', authenticate, (req, res) => departmentController.getDepartments(req, res));
router.get('/tree', authenticate, (req, res) => departmentController.getDepartmentTree(req, res));
router.get('/:id', authenticate, (req, res) => departmentController.getDepartmentById(req, res));
router.post('/', authenticate, (req, res) => departmentController.createDepartment(req, res));
router.put('/:id', authenticate, (req, res) => departmentController.updateDepartment(req, res));
router.delete('/:id', authenticate, (req, res) => departmentController.deleteDepartment(req, res));

module.exports = router;
