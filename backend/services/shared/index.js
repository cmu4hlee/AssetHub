/**
 * 共享服务接口层
 * 封装对共享表（assets、users、departments）的访问
 * 实现模块间的松耦合
 */

const db = require('../config/database');

/**
 * 资产共享服务
 */
class AssetSharedService {
  /**
   * 根据资产编码获取资产信息
   * @param {string} assetCode - 资产编码
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Object|null>}
   */
  async getAssetByCode(assetCode, tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM assets WHERE asset_code = ? AND tenant_id = ? AND is_deleted = 0',
      [assetCode, tenantId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 根据资产ID获取资产信息
   * @param {number} assetId - 资产ID
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Object|null>}
   */
  async getAssetById(assetId, tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM assets WHERE id = ? AND tenant_id = ? AND is_deleted = 0',
      [assetId, tenantId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 获取资产的当前状态
   * @param {string} assetCode - 资产编码
   * @param {number} tenantId - 租户ID
   * @returns {Promise<string|null>}
   */
  async getAssetStatus(assetCode, tenantId) {
    const asset = await this.getAssetByCode(assetCode, tenantId);
    return asset ? asset.status : null;
  }

  /**
   * 更新资产状态
   * @param {string} assetCode - 资产编码
   * @param {string} status - 新状态
   * @param {number} tenantId - 租户ID
   * @param {Object} connection - 数据库连接（可选，用于事务）
   * @returns {Promise<boolean>}
   */
  async updateAssetStatus(assetCode, status, tenantId, connection = null) {
    const conn = connection || db;
    const [result] = await conn.execute(
      'UPDATE assets SET status = ?, updated_at = NOW() WHERE asset_code = ? AND tenant_id = ? AND is_deleted = 0',
      [status, assetCode, tenantId]
    );
    return result.affectedRows > 0;
  }

  /**
   * 验证资产是否存在
   * @param {string} assetCode - 资产编码
   * @param {number} tenantId - 租户ID
   * @returns {Promise<boolean>}
   */
  async assetExists(assetCode, tenantId) {
    const [rows] = await db.execute(
      'SELECT 1 FROM assets WHERE asset_code = ? AND tenant_id = ? AND is_deleted = 0 LIMIT 1',
      [assetCode, tenantId]
    );
    return rows.length > 0;
  }

  /**
   * 获取资产的基本信息（轻量级）
   * @param {string} assetCode - 资产编码
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Object|null>}
   */
  async getAssetBasicInfo(assetCode, tenantId) {
    const [rows] = await db.execute(
      `SELECT asset_code, asset_name, status, department, department_new, location, 
              responsible_person, brand, model
       FROM assets 
       WHERE asset_code = ? AND tenant_id = ? AND is_deleted = 0`,
      [assetCode, tenantId]
    );
    return rows.length > 0 ? rows[0] : null;
  }
}

/**
 * 用户共享服务
 */
class UserSharedService {
  /**
   * 根据用户ID获取用户信息
   * @param {number} userId - 用户ID
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Object|null>}
   */
  async getUserById(userId, tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE id = ? AND tenant_id = ?',
      [userId, tenantId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 根据用户名获取用户信息
   * @param {string} username - 用户名
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Object|null>}
   */
  async getUserByUsername(username, tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE username = ? AND tenant_id = ?',
      [username, tenantId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 获取用户列表
   * @param {number} tenantId - 租户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>}
   */
  async getUsers(tenantId, options = {}) {
    const { role, department, page = 1, pageSize = 50 } = options;
    const offset = (page - 1) * pageSize;

    let whereClause = 'tenant_id = ?';
    const params = [tenantId];

    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }

    if (department) {
      whereClause += ' AND department = ?';
      params.push(department);
    }

    const [rows] = await db.execute(
      `SELECT id, username, real_name, role, department, email, phone, created_at
       FROM users
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return rows;
  }

  /**
   * 验证用户是否存在
   * @param {number} userId - 用户ID
   * @param {number} tenantId - 租户ID
   * @returns {Promise<boolean>}
   */
  async userExists(userId, tenantId) {
    const [rows] = await db.execute(
      'SELECT 1 FROM users WHERE id = ? AND tenant_id = ? LIMIT 1',
      [userId, tenantId]
    );
    return rows.length > 0;
  }
}

/**
 * 部门共享服务
 */
class DepartmentSharedService {
  /**
   * 根据部门ID获取部门信息
   * @param {number} departmentId - 部门ID
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Object|null>}
   */
  async getDepartmentById(departmentId, tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM departments WHERE id = ? AND tenant_id = ?',
      [departmentId, tenantId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 根据部门编码获取部门信息
   * @param {string} departmentCode - 部门编码
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Object|null>}
   */
  async getDepartmentByCode(departmentCode, tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM departments WHERE department_code = ? AND tenant_id = ?',
      [departmentCode, tenantId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 根据部门名称获取部门信息
   * @param {string} departmentName - 部门名称
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Object|null>}
   */
  async getDepartmentByName(departmentName, tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM departments WHERE department_name = ? AND tenant_id = ?',
      [departmentName, tenantId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 获取部门列表
   * @param {number} tenantId - 租户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>}
   */
  async getDepartments(tenantId, options = {}) {
    const { parentId, page = 1, pageSize = 50 } = options;
    const offset = (page - 1) * pageSize;

    let whereClause = 'tenant_id = ?';
    const params = [tenantId];

    if (parentId !== undefined) {
      whereClause += ' AND parent_id = ?';
      params.push(parentId);
    }

    const [rows] = await db.execute(
      `SELECT id, department_code, department_name, parent_id, manager, created_at
       FROM departments
       WHERE ${whereClause}
       ORDER BY department_code ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return rows;
  }

  /**
   * 获取部门树结构
   * @param {number} tenantId - 租户ID
   * @returns {Promise<Array>}
   */
  async getDepartmentTree(tenantId) {
    const [rows] = await db.execute(
      `SELECT id, department_code, department_name, parent_id
       FROM departments
       WHERE tenant_id = ?
       ORDER BY department_code ASC`,
      [tenantId]
    );

    const buildTree = (parentId = 0) => {
      return rows
        .filter(row => row.parent_id === parentId)
        .map(row => ({
          ...row,
          children: buildTree(row.id)
        }));
    };

    return buildTree();
  }
}

// 导出服务实例
const assetSharedService = new AssetSharedService();
const userSharedService = new UserSharedService();
const departmentSharedService = new DepartmentSharedService();

module.exports = {
  AssetSharedService,
  UserSharedService,
  DepartmentSharedService,
  assetSharedService,
  userSharedService,
  departmentSharedService
};
