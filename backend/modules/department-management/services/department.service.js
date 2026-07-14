const BaseService = require('../../../core/BaseService');
const { AppError } = require('../../../utils/error-handler');

class DepartmentService extends BaseService {
  constructor(options = {}) {
    super({ name: 'DepartmentService', ...options });
  }

  async listDepartments(tenantId, { keyword, page = 1, pageSize = 20, status } = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    let whereClause = 'WHERE tenant_id = ?';
    const params = [tenantId];

    if (keyword) {
      whereClause += ' AND (department_name LIKE ? OR department_code LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    // 如果传入了 status 参数，添加状态筛选（需要有 status 字段才生效）
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const countSql = `SELECT COUNT(*) as total FROM departments ${whereClause}`;
    const countResult = await this.findOne(countSql, params);
    const {total} = countResult;

    const dataSql = `SELECT id, department_code, department_name, parent_code, level, status, created_at, updated_at
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

    const nextCode = await this._generateDepartmentCode(tenantId, parent_code);
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

    // 检查循环引用：不能将自己设为自己的父部门
    if (parent_code === existingDept.department_code) {
      throw new AppError('不能将自己设为自己的父部门', 400, 'CIRCULAR_REFERENCE');
    }

    // 检查是否会形成循环引用：如果将 parent_code 设置为某个子部门，会形成循环
    if (parent_code) {
      const isDescendant = await this._isDescendant(tenantId, parent_code, existingDept.department_code);
      if (isDescendant) {
        throw new AppError('不能将子部门设为自己的父部门，会形成循环引用', 400, 'CIRCULAR_REFERENCE');
      }
    }

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

    const assetCount = await this._countAssets(tenantId, existingDept.department_code);
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

  async _generateDepartmentCode(tenantId, parentCode = null) {
    // 获取当前租户下所有部门编码，找出最大序号
    const result = await this.findOne(
      "SELECT MAX(department_code) as maxCode FROM departments WHERE tenant_id = ? AND department_code LIKE 'DEP%'",
      [tenantId],
    );

    let nextNum = 1;
    if (result && result.maxCode) {
      // 提取现有最大序号
      const match = result.maxCode.match(/^DEP(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }

    // 支持超过999的情况，使用6位序号
    const code = `DEP${nextNum.toString().padStart(6, '0')}`;
    return code;
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

  // 检查 potentialDescendant 是否是 ancestor 的后代（子孙部门）
  async _isDescendant(tenantId, ancestorCode, potentialDescendantCode) {
    if (!ancestorCode || !potentialDescendantCode) return false;
    if (ancestorCode === potentialDescendantCode) return true;

    // 递归向上查找祖先，看是否能找到 ancestorCode
    let currentCode = potentialDescendantCode;
    const visited = new Set();

    while (currentCode) {
      if (visited.has(currentCode)) break; // 防止循环
      visited.add(currentCode);

      const parent = await this.findOne(
        'SELECT parent_code FROM departments WHERE tenant_id = ? AND department_code = ?',
        [tenantId, currentCode],
      );

      if (!parent || !parent.parent_code) break;

      if (parent.parent_code === ancestorCode) {
        return true;
      }

      currentCode = parent.parent_code;
    }

    return false;
  }

  async _countAssets(tenantId, departmentCode) {
    // 资产表使用 department_new 字段存储部门编码
    const result = await this.findOne(
      'SELECT COUNT(*) as count FROM assets WHERE department_new = ? AND tenant_id = ?',
      [departmentCode, tenantId],
    );
    return result ? result.count : 0;
  }
}

module.exports = DepartmentService;
