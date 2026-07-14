const db = require('../../../config/database');
const logger = require('../../../config/logger');

const TABLE_CACHE_TTL_MS = 30 * 1000;
const tableMetaCache = new Map();
const SAFETY_STATUS_VALUES = new Set(['normal', 'expiring', 'expired', 'stopped']);
const USE_STATUS_VALUES = new Set(['in_use', 'out_of_service', 'scrapped', 'suspended', 'transferred']);
const SPECIAL_EQUIPMENT_ASSET_JOIN =
  'LEFT JOIN assets a ON se.asset_id = a.id AND a.tenant_id = se.tenant_id';

function normalizeSafetyStatus(value) {
  if (!value) return null;
  if (SAFETY_STATUS_VALUES.has(value)) return value;
  if (value === 'maintenance') return 'stopped';
  return null;
}

function normalizeUseStatus(value) {
  if (!value) return null;
  if (USE_STATUS_VALUES.has(value)) return value;
  if (value === 'scrapped') return 'scrapped';
  return 'in_use';
}

function normalizeInspectionResultForStorage(value) {
  if (!value) return null;
  if (value === 'pass') return 'qualified';
  if (value === 'fail') return 'unqualified';
  return value;
}

class SpecialEquipmentService {
  /**
   * 获取表元数据（带缓存）
   * @param {string} tableName - 表名
   * @param {Object} executor - 数据库执行器
   * @returns {Promise<Object>} 表元数据
   */
  async getTableMeta(tableName, executor = db) {
    const cached = tableMetaCache.get(tableName);
    if (cached && Date.now() - cached.fetchedAt < TABLE_CACHE_TTL_MS) {
      return cached;
    }

    const [tables] = await executor.execute(
      `SELECT TABLE_NAME
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName],
    );

    if (tables.length === 0) {
      const meta = { exists: false, columns: new Set(), fetchedAt: Date.now() };
      tableMetaCache.set(tableName, meta);
      return meta;
    }

    const [columns] = await executor.execute(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName],
    );

    const meta = {
      exists: true,
      columns: new Set(columns.map(c => c.COLUMN_NAME)),
      fetchedAt: Date.now(),
    };

    tableMetaCache.set(tableName, meta);
    return meta;
  }

  /**
   * 检查资产是否存在
   * @param {number} assetId - 资产ID
   * @param {string} tenantId - 租户ID
   * @param {Object} executor - 数据库执行器
   * @returns {Promise<boolean>} 是否存在
   */
  async hasTenantAsset(assetId, tenantId, executor = db) {
    if (!assetId) {
      return false;
    }
    const [rows] = await executor.execute(
      'SELECT id FROM assets WHERE id = ? AND tenant_id = ? LIMIT 1',
      [assetId, tenantId],
    );
    return rows.length > 0;
  }

  /**
   * 检查特种设备是否存在
   * @param {number} equipmentId - 设备ID
   * @param {string} tenantId - 租户ID
   * @param {Object} executor - 数据库执行器
   * @returns {Promise<boolean>} 是否存在
   */
  async hasTenantEquipment(equipmentId, tenantId, executor = db) {
    if (!equipmentId) {
      return false;
    }
    const [rows] = await executor.execute(
      'SELECT id FROM special_equipment WHERE id = ? AND tenant_id = ? LIMIT 1',
      [equipmentId, tenantId],
    );
    return rows.length > 0;
  }

  /**
   * 获取特种设备列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页大小
   * @param {string} params.status - 状态
   * @param {string} params.safety_status - 安全状态
   * @param {string} params.keyword - 关键词
   * @param {string} params.tenantId - 租户ID
   * @returns {Promise<Object>} 设备列表和分页信息
   */
  async getEquipments(params) {
    const { page = 1, pageSize = 20, status, safety_status, keyword, tenantId } = params;

    let sql = `
      SELECT se.*, a.asset_name, a.asset_code
      FROM special_equipment se
      ${SPECIAL_EQUIPMENT_ASSET_JOIN}
      WHERE se.tenant_id = ?
    `;
    const paramsArray = [tenantId];

    if (status) {
      sql += ' AND se.status = ?';
      paramsArray.push(status);
    }
    if (safety_status) {
      sql += ' AND se.safety_status = ?';
      paramsArray.push(safety_status);
    }
    if (keyword) {
      sql += ' AND (se.equipment_name LIKE ? OR se.equipment_code LIKE ?)';
      paramsArray.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY se.next_inspection_date ASC';

    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    paramsArray.push(parseInt(pageSize), offset);

    const [equipment] = await db.execute(sql, paramsArray);

    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM special_equipment WHERE tenant_id = ?';
    const countParams = [tenantId];
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    const [countResult] = await db.execute(countSql, countParams);

    return {
      data: equipment,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / pageSize),
      },
    };
  }

  /**
   * 获取特种设备详情
   * @param {number} id - 设备ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 设备详情
   */
  async getEquipmentById(id, tenantId) {
    const [rows] = await db.execute(
      `SELECT se.*, a.asset_name, a.asset_code
       FROM special_equipment se
       ${SPECIAL_EQUIPMENT_ASSET_JOIN}
       WHERE se.id = ? AND se.tenant_id = ?`,
      [id, tenantId],
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0];
  }

  /**
   * 创建设备
   * @param {Object} equipmentData - 设备数据
   * @param {string} tenantId - 租户ID
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createEquipment(equipmentData, tenantId, userId) {
    const equipmentMeta = await this.getTableMeta('special_equipment');
    const { columns } = equipmentMeta;

    if (!equipmentMeta.exists) {
      throw new Error('special_equipment 表不存在');
    }

    if (!(await this.hasTenantAsset(equipmentData.asset_id, tenantId))) {
      throw new Error('资产不存在');
    }

    const fields = [];
    const values = [];
    const addField = (column, value) => {
      if (!columns.has(column)) return;
      fields.push(column);
      values.push(value === undefined ? null : value);
    };

    addField('equipment_code', equipmentData.equipment_code);
    addField('equipment_name', equipmentData.equipment_name);
    addField('equipment_type', equipmentData.equipment_type);
    addField('asset_id', equipmentData.asset_id);

    if (columns.has('registration_code')) {
      addField('registration_code', equipmentData.registration_code || equipmentData.registration_no);
    } else if (columns.has('registration_no')) {
      addField('registration_no', equipmentData.registration_no || equipmentData.registration_code);
    }

    if (columns.has('install_location')) {
      addField('install_location', equipmentData.install_location || equipmentData.location);
    } else if (columns.has('location')) {
      addField('location', equipmentData.location || equipmentData.install_location);
    }

    addField('next_inspection_date', equipmentData.next_inspection_date || equipmentData.next_date);

    if (columns.has('safety_status')) {
      const safetyStatus = normalizeSafetyStatus(equipmentData.safety_status) || normalizeSafetyStatus(equipmentData.status) || 'normal';
      addField('safety_status', safetyStatus);
    }

    if (columns.has('status')) {
      const useStatus = normalizeUseStatus(equipmentData.use_status) || normalizeUseStatus(equipmentData.status) || 'in_use';
      addField('status', useStatus);
    } else if (columns.has('use_status')) {
      const useStatus = normalizeUseStatus(equipmentData.use_status) || normalizeUseStatus(equipmentData.status) || 'in_use';
      addField('use_status', useStatus);
    }

    if (columns.has('remarks')) {
      addField('remarks', equipmentData.remarks || equipmentData.remark);
    } else if (columns.has('remark')) {
      addField('remark', equipmentData.remark || equipmentData.remarks);
    }

    addField('tenant_id', tenantId);
    addField('created_by', userId);

    if (fields.length === 0) {
      throw new Error('无可写入字段');
    }

    const [result] = await db.execute(
      `INSERT INTO special_equipment (${fields.join(', ')})
       VALUES (${fields.map(() => '?').join(', ')})`,
      values,
    );

    return { id: result.insertId };
  }

  /**
   * 更新设备
   * @param {number} id - 设备ID
   * @param {Object} updates - 更新数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 更新结果
   */
  async updateEquipment(id, updates, tenantId) {
    const equipmentMeta = await this.getTableMeta('special_equipment');
    const { columns } = equipmentMeta;

    if (!equipmentMeta.exists) {
      throw new Error('special_equipment 表不存在');
    }

    if (updates.asset_id !== undefined && !(await this.hasTenantAsset(updates.asset_id, tenantId))) {
      throw new Error('资产不存在');
    }

    const keyMap = new Map([
      ['registration_code', columns.has('registration_code') ? 'registration_code' : 'registration_no'],
      ['registration_no', columns.has('registration_no') ? 'registration_no' : 'registration_code'],
      ['install_location', columns.has('install_location') ? 'install_location' : 'location'],
      ['location', columns.has('location') ? 'location' : 'install_location'],
      ['status', columns.has('status') ? 'status' : 'use_status'],
      ['use_status', columns.has('use_status') ? 'use_status' : 'status'],
      ['remarks', columns.has('remarks') ? 'remarks' : 'remark'],
      ['remark', columns.has('remark') ? 'remark' : 'remarks'],
      ['next_date', columns.has('next_date') ? 'next_date' : 'next_inspection_date'],
      ['next_inspection_date', columns.has('next_inspection_date') ? 'next_inspection_date' : 'next_date'],
    ]);

    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'id' || key === 'tenant_id') return;

      if (key === 'status') {
        const maybeSafetyStatus = normalizeSafetyStatus(value);
        if (maybeSafetyStatus && columns.has('safety_status')) {
          fields.push('safety_status = ?');
          values.push(maybeSafetyStatus);
          return;
        }

        const maybeUseStatus = normalizeUseStatus(value);
        const useStatusColumn = columns.has('status') ? 'status' : (columns.has('use_status') ? 'use_status' : null);
        if (maybeUseStatus && useStatusColumn) {
          fields.push(`${useStatusColumn} = ?`);
          values.push(maybeUseStatus);
        }
        return;
      }

      if (key === 'safety_status') {
        const maybeSafetyStatus = normalizeSafetyStatus(value);
        if (maybeSafetyStatus && columns.has('safety_status')) {
          fields.push('safety_status = ?');
          values.push(maybeSafetyStatus);
        }
        return;
      }

      if (key === 'use_status') {
        const maybeUseStatus = normalizeUseStatus(value);
        const useStatusColumn = columns.has('use_status') ? 'use_status' : (columns.has('status') ? 'status' : null);
        if (maybeUseStatus && useStatusColumn) {
          fields.push(`${useStatusColumn} = ?`);
          values.push(maybeUseStatus);
        }
        return;
      }

      const targetColumn = keyMap.get(key) || key;
      if (!columns.has(targetColumn)) return;
      fields.push(`${targetColumn} = ?`);
      values.push(value);
    });

    if (columns.has('updated_at')) {
      fields.push('updated_at = NOW()');
    }

    if (fields.length === 0) {
      throw new Error('没有可更新字段');
    }

    let sql = `UPDATE special_equipment SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);
    if (columns.has('tenant_id')) {
      sql += ' AND tenant_id = ?';
      values.push(tenantId);
    }

    const [result] = await db.execute(sql, values);
    return result.affectedRows > 0;
  }

  /**
   * 删除设备
   * @param {number} id - 设备ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteEquipment(id, tenantId) {
    const [result] = await db.execute(
      'DELETE FROM special_equipment WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    return result.affectedRows > 0;
  }

  /**
   * 获取检验记录列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页大小
   * @param {number} params.equipment_id - 设备ID
   * @param {string} params.inspection_type - 检验类型
   * @param {string} params.tenantId - 租户ID
   * @returns {Promise<Object>} 检验记录列表和分页信息
   */
  async getInspections(params) {
    const { page = 1, pageSize = 20, equipment_id, inspection_type, tenantId } = params;

    const inspectionsMeta = await this.getTableMeta('special_equipment_inspections');
    if (!inspectionsMeta.exists) {
      return {
        data: [],
        pagination: {
          page: Math.max(1, parseInt(page, 10) || 1),
          pageSize: Math.max(1, parseInt(pageSize, 10) || 20),
          total: 0,
          totalPages: 0,
        },
      };
    }

    const equipmentMeta = await this.getTableMeta('special_equipment');
    const hasEquipmentId = inspectionsMeta.columns.has('equipment_id');
    const hasTenantId = inspectionsMeta.columns.has('tenant_id');
    const hasInspectionType = inspectionsMeta.columns.has('inspection_type');
    const hasInspectionDate = inspectionsMeta.columns.has('inspection_date');
    const hasNextDate = inspectionsMeta.columns.has('next_inspection_date')
      ? 'next_inspection_date'
      : (inspectionsMeta.columns.has('next_date') ? 'next_date' : null);
    const inspectionOrgColumn = inspectionsMeta.columns.has('inspection_org')
      ? 'inspection_org'
      : (inspectionsMeta.columns.has('inspection_agency') ? 'inspection_agency' : null);
    const remarksColumn = inspectionsMeta.columns.has('remarks')
      ? 'remarks'
      : (inspectionsMeta.columns.has('remark') ? 'remark' : null);
    const inspectionCodeColumn = inspectionsMeta.columns.has('inspection_code') ? 'inspection_code' : null;
    const inspectionResultExpr = inspectionsMeta.columns.has('inspection_result')
      ? `CASE
           WHEN sei.inspection_result = 'qualified' THEN 'pass'
           WHEN sei.inspection_result = 'unqualified' THEN 'fail'
           ELSE sei.inspection_result
         END`
      : 'NULL';

    const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
    const normalizedPageSize = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));

    let sql = `
      SELECT
        sei.id,
        ${inspectionCodeColumn ? `sei.${inspectionCodeColumn}` : "CONCAT('INS-', sei.id)"} AS inspection_code,
        ${hasEquipmentId ? 'sei.equipment_id' : 'NULL AS equipment_id'},
        ${hasInspectionType ? 'sei.inspection_type' : 'NULL AS inspection_type'},
        ${hasInspectionDate ? 'sei.inspection_date' : 'NULL AS inspection_date'},
        ${inspectionResultExpr} AS inspection_result,
        ${inspectionsMeta.columns.has('inspector') ? 'sei.inspector' : 'NULL AS inspector'},
        ${inspectionsMeta.columns.has('inspector') ? 'sei.inspector' : 'NULL'} AS inspector_name,
        ${inspectionOrgColumn ? `sei.${inspectionOrgColumn}` : 'NULL'} AS inspection_org,
        ${hasNextDate ? `sei.${hasNextDate}` : 'NULL'} AS next_date,
        ${remarksColumn ? `sei.${remarksColumn}` : 'NULL'} AS remarks,
        ${hasEquipmentId && equipmentMeta.exists ? 'se.equipment_name' : 'NULL'} AS equipment_name,
        ${hasEquipmentId && equipmentMeta.exists ? 'se.equipment_code' : 'NULL'} AS equipment_code
      FROM special_equipment_inspections sei
      ${hasEquipmentId && equipmentMeta.exists
        ? 'LEFT JOIN special_equipment se ON sei.equipment_id = se.id AND se.tenant_id = sei.tenant_id'
        : ''}
      WHERE 1 = 1
    `;
    const queryParams = [];

    if (hasTenantId) {
      sql += ' AND sei.tenant_id = ?';
      queryParams.push(tenantId);
    }

    if (equipment_id && hasEquipmentId) {
      sql += ' AND sei.equipment_id = ?';
      queryParams.push(equipment_id);
    }

    if (inspection_type && hasInspectionType) {
      sql += ' AND sei.inspection_type = ?';
      queryParams.push(inspection_type);
    }

    sql += ` ORDER BY ${hasInspectionDate ? 'sei.inspection_date' : 'sei.id'} DESC`;
    sql += ' LIMIT ? OFFSET ?';
    queryParams.push(normalizedPageSize, (normalizedPage - 1) * normalizedPageSize);

    const [inspections] = await db.execute(sql, queryParams);

    let total = inspections.length;
    if (hasTenantId || (equipment_id && hasEquipmentId) || (inspection_type && hasInspectionType)) {
      let countSql = 'SELECT COUNT(*) AS total FROM special_equipment_inspections sei WHERE 1 = 1';
      const countParams = [];

      if (hasTenantId) {
        countSql += ' AND sei.tenant_id = ?';
        countParams.push(tenantId);
      }
      if (equipment_id && hasEquipmentId) {
        countSql += ' AND sei.equipment_id = ?';
        countParams.push(equipment_id);
      }
      if (inspection_type && hasInspectionType) {
        countSql += ' AND sei.inspection_type = ?';
        countParams.push(inspection_type);
      }

      const [countRows] = await db.execute(countSql, countParams);
      total = countRows[0]?.total || 0;
    }

    return {
      data: inspections,
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total,
        totalPages: Math.ceil(total / normalizedPageSize),
      },
    };
  }

  /**
   * 创建检验记录
   * @param {Object} inspectionData - 检验记录数据
   * @param {string} tenantId - 租户ID
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createInspection(inspectionData, tenantId, userId) {
    const inspectionsMeta = await this.getTableMeta('special_equipment_inspections');
    if (!inspectionsMeta.exists) {
      throw new Error('检验记录功能未初始化，请先创建 special_equipment_inspections 表');
    }

    if (!(await this.hasTenantEquipment(inspectionData.equipment_id, tenantId))) {
      throw new Error('特种设备不存在');
    }

    const fields = [];
    const values = [];
    const { columns } = inspectionsMeta;

    if (columns.has('tenant_id')) {
      fields.push('tenant_id');
      values.push(tenantId);
    }
    if (columns.has('equipment_id')) {
      fields.push('equipment_id');
      values.push(inspectionData.equipment_id || null);
    }
    if (columns.has('inspection_code')) {
      fields.push('inspection_code');
      values.push(inspectionData.inspection_code || `INS${Date.now()}`);
    }
    if (columns.has('inspection_type')) {
      fields.push('inspection_type');
      values.push(inspectionData.inspection_type || 'regular');
    }
    if (columns.has('inspection_date')) {
      fields.push('inspection_date');
      values.push(inspectionData.inspection_date || null);
    }
    if (columns.has('inspection_result')) {
      fields.push('inspection_result');
      values.push(normalizeInspectionResultForStorage(inspectionData.inspection_result));
    }
    if (columns.has('inspection_org')) {
      fields.push('inspection_org');
      values.push(inspectionData.inspection_org || inspectionData.inspection_agency || null);
    } else if (columns.has('inspection_agency')) {
      fields.push('inspection_agency');
      values.push(inspectionData.inspection_agency || inspectionData.inspection_org || null);
    }
    if (columns.has('inspector')) {
      fields.push('inspector');
      values.push(inspectionData.inspector || inspectionData.inspector_name || null);
    }
    if (columns.has('next_date')) {
      fields.push('next_date');
      values.push(inspectionData.next_date || inspectionData.next_inspection_date || null);
    } else if (columns.has('next_inspection_date')) {
      fields.push('next_inspection_date');
      values.push(inspectionData.next_inspection_date || inspectionData.next_date || null);
    }
    if (columns.has('remarks')) {
      fields.push('remarks');
      values.push(inspectionData.remarks || inspectionData.remark || null);
    } else if (columns.has('remark')) {
      fields.push('remark');
      values.push(inspectionData.remark || inspectionData.remarks || null);
    }
    if (columns.has('created_by')) {
      fields.push('created_by');
      values.push(userId);
    }

    if (fields.length === 0) {
      throw new Error('检验记录表字段不可用');
    }

    const [result] = await db.execute(
      `INSERT INTO special_equipment_inspections (${fields.join(', ')})
       VALUES (${fields.map(() => '?').join(', ')})`,
      values,
    );

    // 更新设备的下次检验日期
    if (inspectionData.equipment_id) {
      const equipmentMeta = await this.getTableMeta('special_equipment');
      if (equipmentMeta.exists && equipmentMeta.columns.has('next_inspection_date')) {
        const nextDate = inspectionData.next_inspection_date || inspectionData.next_date;
        if (nextDate) {
          let updateSql = 'UPDATE special_equipment SET next_inspection_date = ? WHERE id = ?';
          const updateParams = [nextDate, inspectionData.equipment_id];
          if (equipmentMeta.columns.has('tenant_id')) {
            updateSql += ' AND tenant_id = ?';
            updateParams.push(tenantId);
          }
          await db.execute(updateSql, updateParams);
        }
      }
    }

    return { id: result.insertId };
  }

  /**
   * 更新检验记录
   * @param {number} id - 检验记录ID
   * @param {Object} updates - 更新数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 更新结果
   */
  async updateInspection(id, updates, tenantId) {
    const inspectionsMeta = await this.getTableMeta('special_equipment_inspections');
    if (!inspectionsMeta.exists) {
      throw new Error('检验记录功能未初始化，请先创建 special_equipment_inspections 表');
    }

    const { columns } = inspectionsMeta;
    const map = new Map([
      ['equipment_id', 'equipment_id'],
      ['inspection_type', 'inspection_type'],
      ['inspection_date', 'inspection_date'],
      ['inspection_result', 'inspection_result'],
      ['inspector', 'inspector'],
      ['inspector_name', 'inspector'],
      ['inspection_org', columns.has('inspection_org') ? 'inspection_org' : 'inspection_agency'],
      ['inspection_agency', columns.has('inspection_agency') ? 'inspection_agency' : 'inspection_org'],
      ['next_date', columns.has('next_date') ? 'next_date' : 'next_inspection_date'],
      ['next_inspection_date', columns.has('next_inspection_date') ? 'next_inspection_date' : 'next_date'],
      ['remarks', columns.has('remarks') ? 'remarks' : 'remark'],
      ['remark', columns.has('remark') ? 'remark' : 'remarks'],
    ]);

    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
      const targetColumn = map.get(key);
      if (targetColumn && columns.has(targetColumn)) {
        fields.push(`${targetColumn} = ?`);
        values.push(targetColumn === 'inspection_result' ? normalizeInspectionResultForStorage(value) : value);
      }
    }

    if (columns.has('updated_at')) {
      fields.push('updated_at = NOW()');
    }

    if (fields.length === 0) {
      throw new Error('没有可更新的字段');
    }

    let sql = `UPDATE special_equipment_inspections SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);
    if (columns.has('tenant_id')) {
      sql += ' AND tenant_id = ?';
      values.push(tenantId);
    }

    const [result] = await db.execute(sql, values);
    return result.affectedRows > 0;
  }

  /**
   * 删除检验记录
   * @param {number} id - 检验记录ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteInspection(id, tenantId) {
    const inspectionsMeta = await this.getTableMeta('special_equipment_inspections');
    if (!inspectionsMeta.exists) {
      throw new Error('检验记录功能未初始化，请先创建 special_equipment_inspections 表');
    }

    let sql = 'DELETE FROM special_equipment_inspections WHERE id = ?';
    const params = [id];
    if (inspectionsMeta.columns.has('tenant_id')) {
      sql += ' AND tenant_id = ?';
      params.push(tenantId);
    }

    const [result] = await db.execute(sql, params);
    return result.affectedRows > 0;
  }

  /**
   * 获取即将到期检验的设备
   * @param {number} days - 提前天数
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 设备列表
   */
  async getExpiringInspections(days = 90, tenantId) {
    const equipmentMeta = await this.getTableMeta('special_equipment');

    if (!equipmentMeta.exists || !equipmentMeta.columns.has('next_inspection_date')) {
      return [];
    }

    let sql = `
      SELECT se.*
      FROM special_equipment se
      WHERE se.next_inspection_date IS NOT NULL
        AND se.next_inspection_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
    `;
    const params = [Math.max(1, parseInt(days, 10) || 90)];

    if (equipmentMeta.columns.has('tenant_id')) {
      sql += ' AND se.tenant_id = ?';
      params.push(tenantId);
    }

    sql += ' ORDER BY se.next_inspection_date ASC';
    const [rows] = await db.execute(sql, params);

    return rows;
  }

  /**
   * 获取特种设备统计
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 统计数据
   */
  async getStatistics(tenantId) {
    const equipmentMeta = await this.getTableMeta('special_equipment');

    if (!equipmentMeta.exists) {
      return {
        type_statistics: [],
        inspection_status: { normal_count: 0, expiring_count: 0, expired_count: 0 },
        expiring_count: 0,
      };
    }

    const tenantFilter = equipmentMeta.columns.has('tenant_id') ? 'WHERE tenant_id = ?' : '';
    const tenantParams = equipmentMeta.columns.has('tenant_id') ? [tenantId] : [];

    let typeStats = [];
    if (equipmentMeta.columns.has('equipment_type')) {
      const [rows] = await db.execute(
        `SELECT equipment_type, COUNT(*) AS total_count
         FROM special_equipment
         ${tenantFilter}
         GROUP BY equipment_type`,
        tenantParams,
      );
      typeStats = rows;
    }

    let inspectionStatus = { normal_count: 0, expiring_count: 0, expired_count: 0 };
    if (equipmentMeta.columns.has('next_inspection_date')) {
      const [rows] = await db.execute(
        `SELECT
           SUM(CASE WHEN next_inspection_date > DATE_ADD(CURDATE(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS normal_count,
           SUM(CASE WHEN next_inspection_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS expiring_count,
           SUM(CASE WHEN next_inspection_date < CURDATE() THEN 1 ELSE 0 END) AS expired_count
         FROM special_equipment
         ${tenantFilter}`,
        tenantParams,
      );
      inspectionStatus = {
        normal_count: rows[0]?.normal_count || 0,
        expiring_count: rows[0]?.expiring_count || 0,
        expired_count: rows[0]?.expired_count || 0,
      };
    }

    return {
      type_statistics: typeStats,
      inspection_status: inspectionStatus,
      expiring_count: inspectionStatus.expiring_count,
    };
  }
}

module.exports = new SpecialEquipmentService();
