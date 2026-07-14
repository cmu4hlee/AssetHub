const { getDatabase } = require('../../../core/DatabaseInterface');
const { getEventBus } = require('../../../core/EventBus');
const departmentService = require('../services/department.service');
const { logAudit } = require('../../../middleware/auditLogger');

const db = getDatabase();
const eventBus = getEventBus();

class DepartmentController {
  constructor() {
    this.db = db;
    this.eventBus = eventBus;
    this.departmentService = new departmentService({ db, eventBus });
  }

  async getDepartments(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const { keyword, page, pageSize } = req.query;

      if (!tenantId) {
        return res.status(400).json({ success: false, message: '租户ID不能为空' });
      }

      const result = await this.departmentService.listDepartments(tenantId, { keyword, page, pageSize });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('获取部门列表失败:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || '获取部门列表失败',
      });
    }
  }

  async getDepartmentTree(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '租户ID不能为空' });
      }
      const data = await this.departmentService.getDepartmentTree(tenantId);
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
  }

  async getDepartmentById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const data = await this.departmentService.getDepartmentById(id, tenantId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('获取部门详情失败:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || '获取部门详情失败',
      });
    }
  }

  async createDepartment(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const { department_name, parent_code } = req.body;
      const data = await this.departmentService.createDepartment(tenantId, { department_name, parent_code });

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
  }

  async updateDepartment(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const { department_name, parent_code } = req.body;
      const existingDept = await this.departmentService.getDepartmentById(id, tenantId);
      const data = await this.departmentService.updateDepartment(id, tenantId, { department_name, parent_code });

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
  }

  async deleteDepartment(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const existingDept = await this.departmentService.getDepartmentById(id, tenantId);
      const data = await this.departmentService.deleteDepartment(id, tenantId);

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
  }
}

module.exports = new DepartmentController();
