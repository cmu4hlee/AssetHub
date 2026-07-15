const BaseService = require('../core/BaseService');
const { AppError } = require('../utils/error-handler');
const db = require('../config/database');

const VALID_INVENTORY_TYPES = ['全面盘点', '抽查盘点', '专项盘点'];
const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];

function validateInventoryInput(data, isUpdate = false) {
  const errors = [];

  if (data.inventory_no !== undefined) {
    if (typeof data.inventory_no !== 'string' || data.inventory_no.length === 0) {
      errors.push('盘点单号不能为空');
    } else if (data.inventory_no.length > 50) {
      errors.push('盘点单号不能超过50个字符');
    }
  }

  if (data.inventory_date !== undefined && data.inventory_date) {
    if (typeof data.inventory_date !== 'string' && !Date.parse(data.inventory_date)) {
      errors.push('盘点日期格式不正确');
    }
  }

  if (data.inventory_type !== undefined) {
    if (!VALID_INVENTORY_TYPES.includes(data.inventory_type)) {
      errors.push(`盘点类型必须是[${VALID_INVENTORY_TYPES.join(', ')}]之一`);
    }
  }

  if (data.inventory_person !== undefined) {
    if (typeof data.inventory_person !== 'string' || data.inventory_person.length === 0) {
      errors.push('盘点人不能为空');
    } else if (data.inventory_person.length > 100) {
      errors.push('盘点人姓名不能超过100个字符');
    }
  }

  if (data.remark !== undefined && data.remark && data.remark.length > 500) {
    errors.push('备注不能超过500个字符');
  }

  if (data.self_check_scope !== undefined) {
    const validScopes = ['mine', 'department', 'all'];
    if (!validScopes.includes(data.self_check_scope)) {
      errors.push(`自助盘点范围必须是[${validScopes.join(', ')}]之一`);
    }
  }

  return errors;
}

class InventoryService extends BaseService {
  constructor(options = {}) {
    super({ name: 'InventoryService', ...options });
    this._columnsCache = null;
  }

  async getInventoryColumns() {
    if (this._columnsCache) return this._columnsCache;
    const rows = await this.findMany(
      'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      ['inventory_records'],
    );
    this._columnsCache = rows.map(row => row.COLUMN_NAME);
    return this._columnsCache;
  }

  async listInventoryRecords(tenantId, { page = 1, pageSize = 20, status } = {}, userContext = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    let whereClause = 'WHERE ir.tenant_id = ?';
    const params = [tenantId];

    if (status) {
      whereClause += ' AND ir.status = ?';
      params.push(status);
    }

    if (userContext.role === 'asset_admin' && userContext.managed_departments && userContext.managed_departments.length > 0 && !userContext.managed_departments.includes('*')) {
      const scope = this._buildManagedDepartmentScope(userContext.managed_departments);
      whereClause += scope.clause;
      params.push(...scope.params);
    }

    const countSql = `SELECT COUNT(*) as total FROM inventory_records ir ${whereClause}`;
    const countResult = await this.findOne(countSql, params);
    const {total} = countResult;

    const dataSql = `SELECT ir.* FROM inventory_records ir ${whereClause} ORDER BY ir.created_at DESC LIMIT ? OFFSET ?`;
    const records = await this.findMany(dataSql, [...params, parseInt(pageSize), offset]);

    return {
      data: records,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize)),
      },
    };
  }

  async getInventoryById(id, tenantId) {
    const record = await this.findOne(
      'SELECT * FROM inventory_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (!record) {
      throw new AppError('盘点记录不存在', 404, 'INVENTORY_NOT_FOUND');
    }
    return record;
  }

  async createInventory(tenantId, data) {
    const validationErrors = validateInventoryInput(data);
    if (validationErrors.length > 0) {
      throw new AppError(validationErrors.join('; '), 400, 'VALIDATION_ERROR');
    }

    const { name, type } = data;
    if (!name) {
      throw new AppError('盘点名称不能为空', 400, 'MISSING_NAME');
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute(
        `INSERT INTO inventory_records (name, type, status, description, start_date, end_date, tenant_id, created_at)
         VALUES (?, ?, 'pending', ?, ?, ?, ?, NOW())`,
        [
          name,
          type ?? 'full',
          data.description ?? null,
          data.start_date ?? null,
          data.end_date ?? null,
          tenantId,
        ],
      );

      await connection.commit();
      this.emitEvent('inventory:created', { id: result.insertId, tenantId });
      return { id: result.insertId, name, status: 'pending' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async startInventory(id, tenantId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 使用 SELECT ... FOR UPDATE 锁定行，避免竞态条件
      const [records] = await connection.execute(
        'SELECT * FROM inventory_records WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [id, tenantId],
      );

      if (records.length === 0) {
        await connection.rollback();
        throw new AppError('盘点记录不存在', 404, 'INVENTORY_NOT_FOUND');
      }

      const record = records[0];
      if (record.status !== 'pending') {
        await connection.rollback();
        throw new AppError('只能启动待盘点状态的记录', 400, 'INVALID_STATUS');
      }

      // UPDATE 时再次检查状态，确保并发安全
      const [result] = await connection.execute(
        'UPDATE inventory_records SET status = \'in_progress\', started_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ? AND status = \'pending\'',
        [id, tenantId],
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        throw new AppError('盘点启动失败', 500, 'UPDATE_FAILED');
      }

      await connection.commit();
      this.emitEvent('inventory:started', { id, tenantId });
      return { id, status: 'in_progress' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async completeInventory(id, tenantId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 使用 SELECT ... FOR UPDATE 锁定行，避免竞态条件
      const [records] = await connection.execute(
        'SELECT * FROM inventory_records WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [id, tenantId],
      );

      if (records.length === 0) {
        await connection.rollback();
        throw new AppError('盘点记录不存在', 404, 'INVENTORY_NOT_FOUND');
      }

      const record = records[0];
      if (record.status !== 'in_progress') {
        await connection.rollback();
        throw new AppError('只能完成进行中的盘点', 400, 'INVALID_STATUS');
      }

      const [result] = await connection.execute(
        'UPDATE inventory_records SET status = \'completed\', completed_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ? AND status = \'in_progress\'',
        [id, tenantId],
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        throw new AppError('盘点完成失败', 500, 'UPDATE_FAILED');
      }

      await connection.commit();
      this.emitEvent('inventory:completed', { id, tenantId });
      return { id, status: 'completed' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async deleteInventory(id, tenantId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 使用 SELECT ... FOR UPDATE 锁定行，避免竞态条件
      const [records] = await connection.execute(
        'SELECT * FROM inventory_records WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [id, tenantId],
      );

      if (records.length === 0) {
        await connection.rollback();
        throw new AppError('盘点记录不存在', 404, 'INVENTORY_NOT_FOUND');
      }

      const record = records[0];
      if (record.status === 'in_progress') {
        await connection.rollback();
        throw new AppError('不能删除进行中的盘点', 400, 'INVALID_STATUS');
      }

      const [result] = await connection.execute(
        'DELETE FROM inventory_records WHERE id = ? AND tenant_id = ?',
        [id, tenantId],
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        throw new AppError('盘点删除失败', 500, 'DELETE_FAILED');
      }

      await connection.commit();
      this.emitEvent('inventory:deleted', { id, tenantId });
      return { id };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  _buildManagedDepartmentScope(departmentIdsToFilter) {
    const placeholders = departmentIdsToFilter.map(() => '?').join(',');
    return {
      clause: ` AND EXISTS (
        SELECT 1 FROM inventory_details idetail
        INNER JOIN assets a ON idetail.asset_code = a.asset_code AND a.tenant_id = ir.tenant_id AND a.is_deleted = 0
        WHERE idetail.inventory_id = ir.id AND (
          a.department IN (
            SELECT department_name FROM departments WHERE tenant_id = ir.tenant_id AND department_code IN (${placeholders})
          ) OR a.department_new IN (${placeholders})
        )
      )`,
      params: [...departmentIdsToFilter, ...departmentIdsToFilter],
    };
  }
}

module.exports = InventoryService;
