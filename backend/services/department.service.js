const BaseService = require('../core/BaseService');
const { AppError } = require('../utils/error-handler');

class DepartmentService extends BaseService {
  constructor(options = {}) {
    super({ name: 'DepartmentService', ...options });
  }

  async listDepartments(tenantId, { keyword, page = 1, pageSize = 20 } = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    let whereClause = 'WHERE tenant_id = ?';
    const params = [tenantId];

    if (keyword) {
      whereClause += ' AND (department_name LIKE ? OR department_code LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const countSql = `SELECT COUNT(*) as total FROM departments ${whereClause}`;
    const countResult = await this.findOne(countSql, params);
    const {total} = countResult;

    const dataSql = `SELECT id, department_code, department_name, parent_code, level, created_at, updated_at 
       FROM departments 
       ${whereClause} 
       ORDER BY department_code 
       LIMIT ? OFFSET ?`;
    const departments = await this.findMany(dataSql, [...params, parseInt(pageSize), offset]);

    return {
      data: departments,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize)),
      },
    };
  }

  async getDepartmentTree(tenantId) {
    const departments = await this.findMany(
      `SELECT id, department_code, department_name, parent_code, level
       FROM departments
       WHERE tenant_id = ?
       ORDER BY department_code`,
      [tenantId],
    );

    if (departments.length === 0) {
      return [];
    }

    const nodeMap = new Map();
    departments.forEach(dept => {
      nodeMap.set(dept.department_code, {
        ...dept,
        key: dept.department_code,
        title: dept.department_name,
        children: [],
      });
    });

    const roots = [];
    departments.forEach(dept => {
      const node = nodeMap.get(dept.department_code);
      if (dept.parent_code && nodeMap.has(dept.parent_code)) {
        nodeMap.get(dept.parent_code).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  async getDepartmentById(id, tenantId) {
    const dept = await this.findOne(
      'SELECT * FROM departments WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (!dept) {
      throw new AppError('部门不存在', 404, 'DEPARTMENT_NOT_FOUND');
    }
    return dept;
  }

  async createDepartment(tenantId, { department_name, parent_code }) {
    if (!department_name) {
      throw new AppError('部门名称不能为空', 400, 'MISSING_DEPARTMENT_NAME');
    }

    const nextCode = await this._generateDepartmentCode(tenantId);
    const level = await this._determineLevel(tenantId, parent_code);

    const [result] = await this.execute(
      `INSERT INTO departments (tenant_id, department_code, department_name, parent_code, level) 
       VALUES (?, ?, ?, ?, ?)`,
      [tenantId, nextCode, department_name, parent_code || null, level],
    );

    this.emitEvent('department:created', {
      id: result.insertId,
      department_code: nextCode,
      department_name,
      tenantId,
    });

    return {
      id: result.insertId,
      department_code: nextCode,
      department_name,
      parent_code,
      level,
    };
  }

  async updateDepartment(id, tenantId, { department_name, parent_code }) {
    if (!department_name) {
      throw new AppError('部门名称不能为空', 400, 'MISSING_DEPARTMENT_NAME');
    }

    const existingDept = await this.getDepartmentById(id, tenantId);
    const level = await this._determineLevel(tenantId, parent_code);

    const [result] = await this.execute(
      `UPDATE departments SET department_name = ?, parent_code = ?, level = ?, updated_at = NOW() 
       WHERE id = ? AND tenant_id = ?`,
      [department_name, parent_code || null, level, id, tenantId],
    );

    if (result.affectedRows === 0) {
      throw new AppError('部门不存在', 404, 'DEPARTMENT_NOT_FOUND');
    }

    this.emitEvent('department:updated', {
      id,
      department_name,
      tenantId,
      old_value: existingDept,
    });

    return { id, department_name, parent_code, level };
  }

  async deleteDepartment(id, tenantId) {
    const existingDept = await this.getDepartmentById(id, tenantId);

    const childCount = await this._countChildren(tenantId, existingDept.department_code);
    if (childCount > 0) {
      throw new AppError('该部门下有子部门，无法删除', 400, 'HAS_CHILD_DEPARTMENTS');
    }

    const assetCount = await this._countAssets(tenantId, existingDept.department_name);
    if (assetCount > 0) {
      throw new AppError('该部门下有资产，无法删除', 400, 'HAS_ASSETS');
    }

    const [result] = await this.execute(
      'DELETE FROM departments WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (result.affectedRows === 0) {
      throw new AppError('部门不存在', 404, 'DEPARTMENT_NOT_FOUND');
    }

    this.emitEvent('department:deleted', {
      id,
      department_name: existingDept.department_name,
      tenantId,
    });

    return { id, department_name: existingDept.department_name };
  }

  async _generateDepartmentCode(tenantId) {
    const result = await this.findOne(
      "SELECT MAX(department_code) as maxCode FROM departments WHERE tenant_id = ? AND department_code LIKE 'DEP%'",
      [tenantId],
    );

    if (!result || !result.maxCode) {
      return 'DEP001';
    }

    const num = parseInt(result.maxCode.replace('DEP', '')) + 1;
    return `DEP${num.toString().padStart(3, '0')}`;
  }

  async _determineLevel(tenantId, parent_code) {
    if (!parent_code) return 2;

    const parent = await this.findOne(
      'SELECT level FROM departments WHERE tenant_id = ? AND department_code = ?',
      [tenantId, parent_code],
    );

    return parent ? parent.level + 1 : 2;
  }

  async _countChildren(tenantId, department_code) {
    const result = await this.findOne(
      'SELECT COUNT(*) as count FROM departments WHERE tenant_id = ? AND parent_code = ?',
      [tenantId, department_code],
    );
    return result ? result.count : 0;
  }

  async _countAssets(tenantId, department_name) {
    const result = await this.findOne(
      'SELECT COUNT(*) as count FROM assets WHERE department = ? AND tenant_id = ?',
      [department_name, tenantId],
    );
    return result ? result.count : 0;
  }
}

module.exports = DepartmentService;
