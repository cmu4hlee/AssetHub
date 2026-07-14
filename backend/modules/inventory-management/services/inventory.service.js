const BaseService = require('../../../core/BaseService');
const { AppError } = require('../../../utils/error-handler');
const db = require('../../../config/database');
const logger = require('../../../config/logger');

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

  async getStatistics(tenantId) {
    const rows = await this.findMany(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = '进行中' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = '已取消' THEN 1 ELSE 0 END) as cancelled
       FROM inventory_records
       WHERE tenant_id = ?`,
      [tenantId],
    );
    return rows[0] || {};
  }

  async getInventoryById(id, tenantId) {
    const record = await this.findOne(
      'SELECT * FROM inventory_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (!record) {
      throw new AppError('盘点记录不存在', 404, 'INVENTORY_NOT_FOUND');
    }

    const details = await this.findMany(
      `SELECT id.*, a.asset_code, a.asset_name, a.brand, a.model
       FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       LEFT JOIN assets a ON id.asset_code = a.asset_code AND a.tenant_id = id.tenant_id
       WHERE id.inventory_id = ? AND id.tenant_id = ?`,
      [id, tenantId],
    );

    return { ...record, details };
  }

  async createInventory(tenantId, data) {
    const validationErrors = validateInventoryInput(data);
    if (validationErrors.length > 0) {
      throw new AppError(validationErrors.join('; '), 400, 'VALIDATION_ERROR');
    }

    const { inventory_no, inventory_date, inventory_type, inventory_person, remark, self_check_enabled, self_check_start, self_check_end, self_check_scope } = data;

    if (!inventory_no) {
      throw new AppError('盘点单号不能为空', 400, 'VALIDATION_ERROR');
    }
    if (!inventory_date) {
      throw new AppError('盘点日期不能为空', 400, 'VALIDATION_ERROR');
    }
    if (!inventory_type) {
      throw new AppError('盘点类型不能为空', 400, 'VALIDATION_ERROR');
    }
    if (!inventory_person) {
      throw new AppError('盘点人不能为空', 400, 'VALIDATION_ERROR');
    }

    // 检查盘点单号是否已存在
    const existing = await this.findOne(
      'SELECT id FROM inventory_records WHERE inventory_no = ? AND tenant_id = ?',
      [inventory_no, tenantId],
    );
    if (existing) {
      throw new AppError('盘点单号已存在', 400, 'DUPLICATE_ERROR');
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const columns = await getDynamicColumns(connection, ['inventory_records']);
      const extraColumns = [];
      const extraValues = [];

      if (columns.includes('self_check_enabled')) {
        extraColumns.push('self_check_enabled');
        extraValues.push(self_check_enabled ? 1 : 0);
      }
      if (columns.includes('self_check_start')) {
        extraColumns.push('self_check_start');
        extraValues.push(self_check_start || null);
      }
      if (columns.includes('self_check_end')) {
        extraColumns.push('self_check_end');
        extraValues.push(self_check_end || null);
      }
      if (columns.includes('self_check_scope')) {
        extraColumns.push('self_check_scope');
        extraValues.push(self_check_scope || 'mine');
      }

      const baseColumns = ['tenant_id', 'inventory_no', 'inventory_date', 'inventory_type', 'inventory_person', 'remark'];
      const insertColumns = baseColumns.concat(extraColumns);
      const placeholders = insertColumns.map(() => '?').join(', ');

      const [result] = await connection.execute(
        `INSERT INTO inventory_records (${insertColumns.join(', ')}) VALUES (${placeholders})`,
        [tenantId, inventory_no, inventory_date, inventory_type, inventory_person, remark || null, ...extraValues],
      );

      await connection.commit();
      this.emitEvent('inventory:created', { id: result.insertId, tenantId });
      return { id: result.insertId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateInventory(id, tenantId, data) {
    const validationErrors = validateInventoryInput(data, true);
    if (validationErrors.length > 0) {
      throw new AppError(validationErrors.join('; '), 400, 'VALIDATION_ERROR');
    }

    const existing = await this.getInventoryById(id, tenantId);

    const { inventory_no, inventory_date, inventory_type, inventory_person, remark, self_check_enabled, self_check_start, self_check_end, self_check_scope } = data;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const columns = await getDynamicColumns(connection, ['inventory_records']);
      const updateFields = ['inventory_no = ?', 'inventory_date = ?', 'inventory_type = ?', 'inventory_person = ?', 'remark = ?'];
      const updateValues = [inventory_no, inventory_date, inventory_type, inventory_person, remark];

      if (columns.includes('self_check_enabled') && self_check_enabled !== undefined) {
        updateFields.push('self_check_enabled = ?');
        updateValues.push(self_check_enabled ? 1 : 0);
      }
      if (columns.includes('self_check_start') && self_check_start !== undefined) {
        updateFields.push('self_check_start = ?');
        updateValues.push(self_check_start || null);
      }
      if (columns.includes('self_check_end') && self_check_end !== undefined) {
        updateFields.push('self_check_end = ?');
        updateValues.push(self_check_end || null);
      }
      if (columns.includes('self_check_scope') && self_check_scope !== undefined) {
        updateFields.push('self_check_scope = ?');
        updateValues.push(self_check_scope || 'mine');
      }

      updateValues.push(id, tenantId);

      const [result] = await connection.execute(
        `UPDATE inventory_records SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
        updateValues,
      );

      await connection.commit();
      this.emitEvent('inventory:updated', { id, tenantId });
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async deleteInventory(id, tenantId) {
    const record = await this.getInventoryById(id, tenantId);
    if (record.status === 'in_progress' || record.status === '进行中') {
      throw new AppError('不能删除进行中的盘点', 400, 'INVALID_STATUS');
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        `DELETE id FROM inventory_details id
         INNER JOIN inventory_records ir ON id.inventory_id = ir.id
         WHERE id.inventory_id = ? AND id.tenant_id = ?`,
        [id, tenantId],
      );

      const [result] = await connection.execute(
        'DELETE FROM inventory_records WHERE id = ? AND tenant_id = ?',
        [id, tenantId],
      );

      await connection.commit();
      this.emitEvent('inventory:deleted', { id, tenantId });
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateStatus(id, status, tenantId) {
    const record = await this.getInventoryById(id, tenantId);
    const currentStatus = record.status;
    const validTransitions = {
      pending: ['in_progress', 'completed', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    // 支持中文状态
    const statusMap = { '进行中': 'in_progress', '已完成': 'completed', '已取消': 'cancelled', '待盘点': 'pending' };
    const normalizedStatus = statusMap[status] || status;
    const normalizedCurrent = statusMap[currentStatus] || currentStatus;

    if (!validTransitions[normalizedCurrent]?.includes(normalizedStatus)) {
      throw new AppError(`不允许的状态转换: 从 ${currentStatus} 到 ${status}`, 400, 'INVALID_STATUS');
    }

    // 如果状态变为"已完成"，检查所有盘点明细中的资产状态
    if (normalizedStatus === 'completed') {
      const details = await this.findMany(
        'SELECT DISTINCT asset_code FROM inventory_details WHERE inventory_id = ? AND tenant_id = ?',
        [id, tenantId],
      );

      for (const detail of details) {
        if (detail.asset_code) {
          const assets = await this.findMany(
            'SELECT * FROM assets WHERE asset_code = ? AND tenant_id = ? FOR UPDATE',
            [detail.asset_code, tenantId],
          );

          if (assets.length > 0) {
            const assetStatus = assets[0].status;
            if (assetStatus === '调配中' || assetStatus === '维修中' || assetStatus === '维修') {
              throw new AppError(
                `资产 ${assets[0].asset_code || '未知编号'} (${assets[0].asset_name || '未知名称'}) 当前状态为"${assetStatus}"，正在调配或维修中，无法完成盘点`,
                400,
                'INVALID_STATUS',
              );
            }
          }
        }
      }
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute(
        'UPDATE inventory_records SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
        [status, id, tenantId],
      );

      await connection.commit();
      this.emitEvent('inventory:status_changed', { id, status, tenantId });
      return { id, status };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async startInventory(id, tenantId) {
    const record = await this.getInventoryById(id, tenantId);
    if (record.status !== 'pending' && record.status !== '待盘点') {
      throw new AppError('只能启动待盘点状态的记录', 400, 'INVALID_STATUS');
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute(
        'UPDATE inventory_records SET status = \'in_progress\', started_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?',
        [id, tenantId],
      );

      if (result.affectedRows === 0) {
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
    const record = await this.getInventoryById(id, tenantId);
    if (record.status !== 'in_progress' && record.status !== '进行中') {
      throw new AppError('只能完成进行中的盘点', 400, 'INVALID_STATUS');
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute(
        'UPDATE inventory_records SET status = \'completed\', completed_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?',
        [id, tenantId],
      );

      if (result.affectedRows === 0) {
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

  async getInventoryStatistics(id, tenantId) {
    const totalResult = await this.findOne(
      `SELECT COUNT(*) as total
       FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       WHERE id.inventory_id = ? AND id.tenant_id = ?`,
      [id, tenantId],
    );
    const {total} = totalResult;

    const typeStats = await this.findMany(
      `SELECT id.discrepancy_type, COUNT(*) as count
       FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       WHERE id.inventory_id = ? AND id.tenant_id = ?
       GROUP BY id.discrepancy_type`,
      [id, tenantId],
    );

    const normalResult = await this.findOne(
      `SELECT COUNT(*) as count
       FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       WHERE id.inventory_id = ? AND id.discrepancy_type = ? AND id.tenant_id = ?`,
      [id, '正常', tenantId],
    );
    const normalCount = normalResult ? normalResult.count : 0;
    const abnormalCount = total - normalCount;

    return {
      total,
      normalCount,
      abnormalCount,
      typeStats: typeStats.reduce((acc, item) => {
        acc[item.discrepancy_type] = item.count;
        return acc;
      }, {}),
    };
  }

  async scanAsset(id, tenantId, { asset_code, scan_time, scan_type, location, status, photo, username }) {
    if (!asset_code) {
      throw new AppError('资产编号不能为空', 400, 'VALIDATION_ERROR');
    }

    const inventory = await this.findOne(
      'SELECT * FROM inventory_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (!inventory) {
      throw new AppError('盘点记录不存在', 404, 'INVENTORY_NOT_FOUND');
    }

    if (inventory.status !== '进行中' && inventory.status !== 'in_progress') {
      throw new AppError('该盘点记录不是进行中状态', 400, 'INVALID_STATUS');
    }

    const details = await this.findMany(
      `SELECT id.*, a.asset_name, a.department as expected_department,
              a.department_new as actual_department, a.status as asset_status
       FROM inventory_details id
       LEFT JOIN assets a ON id.asset_code = a.asset_code AND a.tenant_id = ?
       WHERE id.inventory_id = ? AND id.asset_code = ?`,
      [tenantId, id, asset_code],
    );

    if (details.length === 0) {
      throw new AppError('该资产不在当前盘点清单中', 404, 'ASSET_NOT_FOUND');
    }

    const detail = details[0];

    if (detail.actual_status) {
      return {
        ...detail,
        is_repeated: true,
        previous_scan_time: detail.scan_time,
      };
    }

    let discrepancy_type = '正常';
    let discrepancy_desc = '';

    if (detail.expected_location !== location) {
      discrepancy_type = '位置异常';
      discrepancy_desc = `期望位置: ${detail.expected_location}, 实际位置: ${location}`;
    }

    if (detail.expected_status !== status && status) {
      discrepancy_type = discrepancy_type === '正常' ? '状态异常' : '位置状态异常';
      discrepancy_desc = discrepancy_desc
        ? `${discrepancy_desc}; 期望状态: ${detail.expected_status}, 实际状态: ${status}`
        : `期望状态: ${detail.expected_status}, 实际状态: ${status}`;
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        `UPDATE inventory_details SET
          actual_location = ?,
          actual_status = ?,
          discrepancy_type = ?,
          discrepancy_desc = ?,
          scan_time = ?,
          scan_type = ?,
          scan_by = ?,
          photo_url = ?,
          updated_at = NOW()
         WHERE id = ?`,
        [
          location || detail.expected_location,
          status || detail.asset_status,
          discrepancy_type,
          discrepancy_desc || null,
          scan_time || new Date(),
          scan_type || 'qr_code',
          username,
          photo || null,
          detail.id,
        ],
      );

      await connection.execute(
        `INSERT INTO inventory_scan_logs
         (tenant_id, inventory_id, asset_code, scan_time, scan_type, scan_by, location, status, result)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, id, asset_code, scan_time || new Date(), scan_type || 'qr_code', username, location, status, discrepancy_type],
      );

      await connection.commit();

      return {
        ...detail,
        actual_location: location || detail.expected_location,
        actual_status: status || detail.asset_status,
        discrepancy_type,
        discrepancy_desc,
        scan_time: scan_time || new Date(),
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getScanLogs(id, tenantId, { page = 1, pageSize = 50 } = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const logs = await this.findMany(
      `SELECT * FROM inventory_scan_logs
       WHERE inventory_id = ? AND tenant_id = ?
       ORDER BY scan_time DESC
       LIMIT ? OFFSET ?`,
      [id, tenantId, parseInt(pageSize), offset],
    );

    const countResult = await this.findOne(
      'SELECT COUNT(*) as total FROM inventory_scan_logs WHERE inventory_id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    return {
      data: logs,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult.total,
      },
    };
  }

  async addDetail(inventoryId, tenantId, data) {
    const { asset_code, expected_location, actual_location, expected_status, actual_status, discrepancy_type, discrepancy_desc } = data;

    const inventory = await this.findOne(
      'SELECT id FROM inventory_records WHERE id = ? AND tenant_id = ?',
      [inventoryId, tenantId],
    );
    if (!inventory) {
      throw new AppError('盘点记录不存在', 404, 'INVENTORY_NOT_FOUND');
    }

    if (asset_code) {
      const asset = await this.findOne(
        'SELECT asset_code FROM assets WHERE asset_code = ? AND tenant_id = ?',
        [asset_code, tenantId],
      );
      if (!asset) {
        throw new AppError('资产不存在', 404, 'ASSET_NOT_FOUND');
      }
    }

    const [result] = await db.execute(
      `INSERT INTO inventory_details (
        inventory_id, asset_code, expected_location, actual_location,
        expected_status, actual_status, discrepancy_type, discrepancy_desc, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [inventoryId, asset_code, expected_location, actual_location, expected_status, actual_status, discrepancy_type, discrepancy_desc, tenantId],
    );

    return { id: result.insertId };
  }

  async batchAddDetails(inventoryId, tenantId, details) {
    if (!Array.isArray(details) || details.length === 0) {
      throw new AppError('明细数据不能为空', 400, 'VALIDATION_ERROR');
    }

    const inventory = await this.findOne(
      'SELECT id FROM inventory_records WHERE id = ? AND tenant_id = ?',
      [inventoryId, tenantId],
    );
    if (!inventory) {
      throw new AppError('盘点记录不存在', 404, 'INVENTORY_NOT_FOUND');
    }

    const assetIds = details.map(d => d.asset_code).filter(id => id);
    if (assetIds.length > 0) {
      const existingAssets = await this.findMany(
        `SELECT asset_code FROM assets WHERE asset_code IN (${assetIds.map(() => '?').join(',')}) AND tenant_id = ?`,
        [...assetIds, tenantId],
      );
      const existingAssetIds = existingAssets.map(a => a.asset_code);
      const missingAssetIds = assetIds.filter(id => !existingAssetIds.includes(id));
      if (missingAssetIds.length > 0) {
        throw new AppError(`以下资产不存在: ${missingAssetIds.join(', ')}`, 404, 'ASSET_NOT_FOUND');
      }
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      for (const detail of details) {
        const { asset_code, expected_location, actual_location, expected_status, actual_status, discrepancy_type, discrepancy_desc } = detail;
        await connection.execute(
          `INSERT INTO inventory_details (
            inventory_id, asset_code, expected_location, actual_location,
            expected_status, actual_status, discrepancy_type, discrepancy_desc, tenant_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [inventoryId, asset_code, expected_location, actual_location, expected_status, actual_status, discrepancy_type, discrepancy_desc, tenantId],
        );
      }

      await connection.commit();
      return details.length;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateDetail(inventoryId, detailId, tenantId, data) {
    const { expected_location, actual_location, expected_status, actual_status, discrepancy_type, discrepancy_desc } = data;

    const existing = await this.findOne(
      `SELECT id.id FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       WHERE id.id = ? AND id.inventory_id = ? AND id.tenant_id = ?`,
      [detailId, inventoryId, tenantId],
    );

    if (!existing) {
      throw new AppError('盘点明细不存在', 404, 'NOT_FOUND');
    }

    const [result] = await db.execute(
      `UPDATE inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       SET id.expected_location = ?, id.actual_location = ?,
           id.expected_status = ?, id.actual_status = ?,
           id.discrepancy_type = ?, id.discrepancy_desc = ?
       WHERE id.id = ? AND id.inventory_id = ? AND id.tenant_id = ?`,
      [expected_location, actual_location, expected_status, actual_status, discrepancy_type, discrepancy_desc, detailId, inventoryId, tenantId],
    );

    return result.affectedRows > 0;
  }

  async deleteDetail(inventoryId, detailId, tenantId) {
    const existing = await this.findOne(
      `SELECT id.id FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       WHERE id.id = ? AND id.inventory_id = ? AND id.tenant_id = ?`,
      [detailId, inventoryId, tenantId],
    );

    if (!existing) {
      throw new AppError('盘点明细不存在', 404, 'NOT_FOUND');
    }

    const [result] = await db.execute(
      `DELETE id FROM inventory_details id
       INNER JOIN inventory_records ir ON id.inventory_id = ir.id
       WHERE id.id = ? AND id.inventory_id = ? AND id.tenant_id = ?`,
      [detailId, inventoryId, tenantId],
    );

    return result.affectedRows > 0;
  }

  async getSelfCheckWindows(tenantId) {
    const now = new Date();
    return await this.findMany(
      `SELECT ir.* FROM inventory_records ir
       WHERE ir.self_check_enabled = 1
         AND (ir.status = 'in_progress' OR ir.status = '进行中')
         AND (ir.self_check_start IS NULL OR ir.self_check_start <= ?)
         AND (ir.self_check_end IS NULL OR ir.self_check_end >= ?)
         AND ir.tenant_id = ?
       ORDER BY ir.self_check_start DESC, ir.id DESC`,
      [now, now, tenantId],
    );
  }

  async getMyAssets(inventoryId, tenantId, userContext) {
    const { username, real_name, department_code } = userContext;

    if (!inventoryId) {
      throw new AppError('缺少盘点ID', 400, 'VALIDATION_ERROR');
    }

    const inventory = await this.findOne(
      'SELECT * FROM inventory_records WHERE id = ? AND tenant_id = ?',
      [inventoryId, tenantId],
    );

    if (!inventory) {
      throw new AppError('盘点记录不存在', 404, 'INVENTORY_NOT_FOUND');
    }

    if (!inventory.self_check_enabled) {
      throw new AppError('该盘点未启用自助盘点', 400, 'INVALID_STATUS');
    }

    const now = new Date();
    if (inventory.self_check_start && new Date(inventory.self_check_start) > now) {
      throw new AppError('自助盘点尚未开始', 400, 'INVALID_STATUS');
    }
    if (inventory.self_check_end && new Date(inventory.self_check_end) < now) {
      throw new AppError('自助盘点已结束', 400, 'INVALID_STATUS');
    }

    let whereClause = 'WHERE a.tenant_id = ?';
    const params = [tenantId];

    if (inventory.self_check_scope === 'all') {
      // no extra filter
    } else if (inventory.self_check_scope === 'department' && department_code) {
      whereClause += ` AND (
        a.department IN (
          SELECT department_name FROM departments WHERE tenant_id = ? AND department_code = ?
        ) OR a.department_new = ?
      )`;
      params.push(tenantId, department_code, department_code);
    } else {
      whereClause += ' AND (a.responsible_person = ? OR a.responsible_person = ?)';
      params.push(real_name || username, username);
    }

    return await this.findMany(
      `SELECT a.*, id.actual_location, id.actual_status, id.discrepancy_type, id.discrepancy_desc,
              id.checked_by, id.checked_by_name, id.checked_at, id.check_method
       FROM assets a
       LEFT JOIN inventory_details id
         ON id.inventory_id = ? AND id.asset_code = a.asset_code
       ${whereClause}
       ORDER BY a.asset_code ASC`,
      [inventoryId, ...params],
    );
  }

  async confirmSelfCheck(tenantId, data, userContext) {
    const { inventory_id, asset_code, actual_location, actual_status, discrepancy_type, discrepancy_desc } = data;

    if (!inventory_id || !asset_code) {
      throw new AppError('缺少盘点ID或资产编码', 400, 'VALIDATION_ERROR');
    }

    const inventory = await this.findOne(
      'SELECT * FROM inventory_records WHERE id = ? AND tenant_id = ?',
      [inventory_id, tenantId],
    );

    if (!inventory) {
      throw new AppError('盘点记录不存在', 404, 'INVENTORY_NOT_FOUND');
    }

    if (!inventory.self_check_enabled) {
      throw new AppError('该盘点未启用自助盘点', 400, 'INVALID_STATUS');
    }

    const now = new Date();
    if (inventory.self_check_start && new Date(inventory.self_check_start) > now) {
      throw new AppError('自助盘点尚未开始', 400, 'INVALID_STATUS');
    }
    if (inventory.self_check_end && new Date(inventory.self_check_end) < now) {
      throw new AppError('自助盘点已结束', 400, 'INVALID_STATUS');
    }

    const asset = await this.findOne(
      'SELECT asset_code, location, status FROM assets WHERE asset_code = ? AND tenant_id = ?',
      [asset_code, tenantId],
    );

    if (!asset) {
      throw new AppError('资产不存在', 404, 'ASSET_NOT_FOUND');
    }

    const expectedLocation = asset.location || null;
    const expectedStatus = asset.status || null;
    const actualLocationValue = actual_location ?? expectedLocation;
    const actualStatusValue = actual_status ?? expectedStatus;

    let resolvedDiscrepancy = discrepancy_type;
    if (!resolvedDiscrepancy) {
      if (actualLocationValue !== expectedLocation) {
        resolvedDiscrepancy = '位置不符';
      } else if (actualStatusValue !== expectedStatus) {
        resolvedDiscrepancy = '状态不符';
      } else {
        resolvedDiscrepancy = '正常';
      }
    }

    const checkedBy = userContext.username || null;
    const checkedByName = userContext.real_name || userContext.username || null;

    const existing = await this.findOne(
      'SELECT id FROM inventory_details WHERE inventory_id = ? AND asset_code = ? AND tenant_id = ?',
      [inventory_id, asset_code, tenantId],
    );

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      if (existing) {
        await connection.execute(
          `UPDATE inventory_details SET
            actual_location = ?,
            actual_status = ?,
            discrepancy_type = ?,
            discrepancy_desc = ?,
            checked_by = ?,
            checked_by_name = ?,
            checked_at = NOW(),
            check_method = 'self'
           WHERE id = ?`,
          [actualLocationValue, actualStatusValue, resolvedDiscrepancy, discrepancy_desc || null, checkedBy, checkedByName, existing.id],
        );
      } else {
        await connection.execute(
          `INSERT INTO inventory_details (
            inventory_id, asset_code, expected_location, actual_location,
            expected_status, actual_status, discrepancy_type, discrepancy_desc,
            checked_by, checked_by_name, checked_at, check_method, tenant_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'self', ?)`,
          [inventory_id, asset_code, expectedLocation, actualLocationValue, expectedStatus, actualStatusValue, resolvedDiscrepancy, discrepancy_desc || null, checkedBy, checkedByName, tenantId],
        );
      }

      await connection.commit();
      return { success: true };
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
        INNER JOIN assets a ON idetail.asset_code = a.asset_code AND a.tenant_id = ir.tenant_id
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

// Helper function to get dynamic columns
async function getDynamicColumns(connection, tables) {
  const columnsMap = {};
  for (const table of tables) {
    const [rows] = await connection.execute(
      'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [table],
    );
    columnsMap[table] = rows.map(row => row.COLUMN_NAME);
  }
  return columnsMap;
}

module.exports = new InventoryService();
