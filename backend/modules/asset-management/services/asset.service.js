const db = require('../../../config/database');
const logger = require('../../../config/logger');
const { cacheService } = require('../../../services/cache/CacheService');
const {
  AssetCreateValidationError,
  normalizeAssetCreatePayload,
} = require('../../../utils/asset-create-validation');
const { ASSET_STATUS_LIST } = require('../../../config/asset-status.constants');

const CACHE_TTL = 300; // 5 minutes

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class AssetService {
  /**
   * 获取资产列表
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 资产列表和分页信息
   */
  async getAssets(params) {
    const {
      page = 1,
      pageSize = 20,
      search,
      status,
      department_id,
      category_id,
      tenantId,
    } = params;

    const offset = (page - 1) * pageSize;
    const cacheKey = `assets:${tenantId}:${page}:${pageSize}:${search || ''}:${status || ''}:${department_id || ''}:${category_id || ''}`;

    // Try cache first
    try {
      const cached = await cacheService.get('asset:list', cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      logger.warn('Cache read failed: ' + error.message);
    }

    let whereClause = 'WHERE a.tenant_id = ? AND a.is_deleted = 0';
    const queryParams = [tenantId];

    if (search) {
      whereClause += ' AND (a.asset_code LIKE ? OR a.asset_name LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClause += ' AND a.status = ?';
      queryParams.push(status);
    }

    if (department_id) {
      whereClause += ' AND a.department_new = ?';
      queryParams.push(department_id);
    }

    if (category_id) {
      whereClause += ' AND a.category_id = ?';
      queryParams.push(category_id);
    }

    // Get total count
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM assets a ${whereClause}`,
      queryParams,
    );
    const { total } = countRows[0];

    // Get data
    // 关联 asset_categories + departments（特种设备等模块的下拉搜索依赖部门名称展示）
    const [rows] = await db.execute(
      `SELECT a.*,
              c.name AS category_name, c.code AS category_code,
              d.department_name AS department_name
       FROM assets a
       LEFT JOIN asset_categories c ON a.category_id = c.id AND c.tenant_id = a.tenant_id
       LEFT JOIN departments d ON a.department_new = d.department_code AND d.tenant_id = a.tenant_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(pageSize), offset],
    );

    const result = {
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };

    // Cache result（带 tag 便于按标签失效）
    try {
      await cacheService.set('asset:list', cacheKey, result, {
        ttl: CACHE_TTL,
        tags: ['asset:list'],
      });
    } catch (error) {
      logger.warn('Cache write failed', { error: error.message });
    }

    return result;
  }

  /**
   * 获取资产详情
   * @param {number} id - 资产ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object|null>} 资产详情
   */
  async getAssetById(id, tenantId) {
    const [rows] = await db.execute(
      `SELECT a.*, c.name AS category_name, c.code AS category_code
       FROM assets a
       LEFT JOIN asset_categories c ON a.category_id = c.id AND c.tenant_id = a.tenant_id
       WHERE a.id = ? AND a.tenant_id = ? AND a.is_deleted = 0`,
      [id, tenantId],
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0];
  }

  /**
   * 根据资产编码获取资产
   * @param {string} assetCode - 资产编码
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object|null>} 资产详情
   */
  async getAssetByCode(assetCode, tenantId) {
    const [rows] = await db.execute(
      `SELECT a.*, c.name AS category_name, c.code AS category_code
       FROM assets a
       LEFT JOIN asset_categories c ON a.category_id = c.id AND c.tenant_id = a.tenant_id
       WHERE a.asset_code = ? AND a.tenant_id = ? AND a.is_deleted = 0`,
      [assetCode, tenantId],
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0];
  }

  /**
   * 创建资产
   * @param {Object} assetData - 资产数据
   * @param {string} tenantId - 租户ID
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createAsset(assetData, tenantId, userId) {
    // 1. 字段格式与一致性校验（复用旧版 normalizeAssetCreatePayload）
    let data;
    try {
      data = normalizeAssetCreatePayload(assetData);
    } catch (validationError) {
      if (validationError instanceof AssetCreateValidationError) {
        throw new Error(validationError.message);
      }
      throw validationError;
    }

    const {
      asset_code,
      asset_name,
      category_id,
      category_secondary_id,
      brand,
      model,
      specification,
      serial_number,
      purchase_date,
      purchase_price,
      current_value,
      depreciation_method,
      depreciation_years,
      location,
      department_new,
      responsible_person,
      status,
      supplier,
      warranty_period,
      warranty_end_date,
      remark,
      data_id,
      asset_type,
      code,
      code2,
      code3,
      original_created_at,
    } = data;

    // 2. 状态值范围校验
    if (status && !ASSET_STATUS_LIST.includes(status)) {
      throw new Error(`无效的资产状态，必须是: ${ASSET_STATUS_LIST.join(', ')}`);
    }

    // Use transaction to prevent race condition on duplicate check
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 3. 部门存在性校验
      if (department_new) {
        const [deptRows] = await connection.execute(
          'SELECT department_code FROM departments WHERE department_code = ? AND tenant_id = ? LIMIT 1',
          [department_new, tenantId],
        );
        if (deptRows.length === 0) {
          await connection.rollback();
          throw new Error('所选使用部门不存在或不属于当前租户');
        }
      }

      // 4. 二级分类存在性与归属校验
      if (category_secondary_id) {
        const [subCatRows] = await connection.execute(
          'SELECT parent_id FROM asset_categories WHERE id = ? AND tenant_id = ? LIMIT 1',
          [category_secondary_id, tenantId],
        );
        if (subCatRows.length === 0) {
          await connection.rollback();
          throw new Error('所选二级分类不存在');
        }
        if (subCatRows[0].parent_id !== Number(category_id)) {
          await connection.rollback();
          throw new Error('二级分类不属于所选一级分类');
        }
      }

      // 5. 唯一性检查（带行锁，过滤软删记录）
      const [existing] = await connection.execute(
        'SELECT id FROM assets WHERE asset_code = ? AND tenant_id = ? AND is_deleted = 0 FOR UPDATE',
        [asset_code, tenantId],
      );

      if (existing.length > 0) {
        await connection.rollback();
        throw new Error('资产编码已存在');
      }

      const [result] = await connection.execute(
        `INSERT INTO assets (
          tenant_id, asset_code, asset_name, category_id, category_secondary_id,
          brand, model, specification, serial_number,
          purchase_date, purchase_price, current_value,
          depreciation_method, depreciation_years,
          location, department_new, responsible_person,
          status, supplier, warranty_period, warranty_end_date,
          remark, created_by,
          data_id, asset_type, code, code2, code3, original_created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          asset_code,
          asset_name,
          category_id,
          category_secondary_id,
          brand || null,
          model || null,
          specification || null,
          serial_number || null,
          purchase_date || null,
          purchase_price || 0,
          current_value || purchase_price || 0,
          depreciation_method || '平均年限法',
          depreciation_years || 5,
          location || null,
          department_new || null,
          responsible_person || null,
          status || '在用',
          supplier || null,
          warranty_period || null,
          warranty_end_date || null,
          remark || null,
          userId,
          data_id || null,
          asset_type || null,
          code || null,
          code2 || null,
          code3 || null,
          original_created_at || null,
        ],
      );

      await connection.commit();

      // Clear cache
      await cacheService.deleteByTag('asset:list');

      return { id: result.insertId, asset_code };
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rbErr) {
        logger.warn('Rollback failed', { error: rbErr.message });
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 解析资产标识：返回 { column, value }，支持数字 id 与 asset_code
   */
  resolveAssetIdentifier(idOrCode) {
    if (idOrCode === null || idOrCode === undefined) {
      return null;
    }
    const raw = String(idOrCode).trim();
    if (!raw) return null;
    if (/^\d+$/.test(raw) && raw.length <= 12) {
      return { column: 'id', value: Number.parseInt(raw, 10) };
    }
    return { column: 'asset_code', value: raw };
  }

  /**
   * 更新资产
   * @param {string|number} idOrCode - 资产ID 或 asset_code
   * @param {Object} assetData - 资产数据
   * @param {string} tenantId - 租户ID
   * @param {number} userId - 用户ID
   * @returns {Promise<{ updated: boolean, asset_code: string }>} 更新结果
   */
  async updateAsset(idOrCode, assetData, tenantId, userId) {
    const identifier = this.resolveAssetIdentifier(idOrCode);
    if (!identifier) {
      throw new Error('资产标识不能为空');
    }

    const allowedFields = [
      'asset_name', 'category_id', 'category_secondary_id', 'brand', 'model', 'specification',
      'serial_number', 'purchase_date', 'purchase_price', 'current_value',
      'depreciation_method', 'depreciation_years', 'location',
      'department_new', 'responsible_person', 'status', 'supplier',
      'warranty_period', 'warranty_end_date', 'remark',
      'data_id', 'asset_type', 'code', 'code2', 'code3', 'original_created_at',
    ];

    const updateFields = [];
    const updateValues = [];
    const changedFields = [];

    for (const field of allowedFields) {
      if (assetData[field] !== undefined) {
        updateFields.push(`\`${field}\` = ?`);
        updateValues.push(assetData[field]);
        changedFields.push(field);
      }
    }

    if (updateFields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    // 字段级校验（只校验本次传入的字段）
    this._validateUpdateFields(assetData);

    // 先读取原值用于变更日志（字段名来自白名单 allowedFields，无注入风险；加反引号避免命中保留字）
    const [oldRows] = await db.execute(
      `SELECT ${changedFields.map(f => `\`${f}\``).join(', ')}, asset_code, purchase_price AS old_purchase_price, current_value AS old_current_value, purchase_date AS old_purchase_date, warranty_end_date AS old_warranty_end_date
       FROM assets
       WHERE ${identifier.column} = ? AND tenant_id = ? AND is_deleted = 0`,
      [identifier.value, tenantId],
    );
    if (oldRows.length === 0) {
      throw new Error('资产不存在');
    }
    const oldAsset = oldRows[0];
    const resolvedAssetCode = oldAsset.asset_code;

    // 一致性校验：current_value vs purchase_price（合并旧值与新值）
    const effectivePurchasePrice = assetData.purchase_price !== undefined
      ? Number(assetData.purchase_price)
      : Number(oldAsset.old_purchase_price);
    const effectiveCurrentValue = assetData.current_value !== undefined
      ? Number(assetData.current_value)
      : Number(oldAsset.old_current_value);
    if (
      effectivePurchasePrice !== null &&
      effectiveCurrentValue !== null &&
      Number.isFinite(effectivePurchasePrice) &&
      Number.isFinite(effectiveCurrentValue) &&
      effectiveCurrentValue > effectivePurchasePrice
    ) {
      throw new Error('当前价值不能大于购置价格');
    }

    // 一致性校验：warranty_end_date vs purchase_date（合并旧值与新值）
    const effectivePurchaseDate = assetData.purchase_date !== undefined
      ? assetData.purchase_date
      : oldAsset.old_purchase_date;
    const effectiveWarrantyEndDate = assetData.warranty_end_date !== undefined
      ? assetData.warranty_end_date
      : oldAsset.old_warranty_end_date;
    if (effectivePurchaseDate && effectiveWarrantyEndDate) {
      const purchaseTime = new Date(`${effectivePurchaseDate}T00:00:00.000Z`).getTime();
      const warrantyTime = new Date(`${effectiveWarrantyEndDate}T00:00:00.000Z`).getTime();
      if (Number.isFinite(purchaseTime) && Number.isFinite(warrantyTime) && warrantyTime < purchaseTime) {
        throw new Error('保修到期日不能早于购置日期');
      }
    }

    // 状态值范围校验
    if (assetData.status !== undefined && assetData.status !== null && !ASSET_STATUS_LIST.includes(assetData.status)) {
      throw new Error(`无效的资产状态，必须是: ${ASSET_STATUS_LIST.join(', ')}`);
    }

    // 部门存在性校验
    if (assetData.department_new !== undefined && assetData.department_new !== null && assetData.department_new !== '') {
      const [deptRows] = await db.execute(
        'SELECT department_code FROM departments WHERE department_code = ? AND tenant_id = ? LIMIT 1',
        [assetData.department_new, tenantId],
      );
      if (deptRows.length === 0) {
        throw new Error('所选使用部门不存在或不属于当前租户');
      }
    }

    // 二级分类存在性与归属校验
    if (assetData.category_secondary_id !== undefined && assetData.category_secondary_id !== null) {
      const effectiveCategoryId = assetData.category_id !== undefined
        ? Number(assetData.category_id)
        : Number(oldAsset.category_id);
      const [subCatRows] = await db.execute(
        'SELECT parent_id FROM asset_categories WHERE id = ? AND tenant_id = ? LIMIT 1',
        [assetData.category_secondary_id, tenantId],
      );
      if (subCatRows.length === 0) {
        throw new Error('所选二级分类不存在');
      }
      if (subCatRows[0].parent_id !== effectiveCategoryId) {
        throw new Error('二级分类不属于所选一级分类');
      }
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(identifier.value, tenantId);

    const [result] = await db.execute(
      `UPDATE assets SET ${updateFields.join(', ')}
       WHERE ${identifier.column} = ? AND tenant_id = ? AND is_deleted = 0`,
      updateValues,
    );

    if (result.affectedRows === 0) {
      throw new Error('资产不存在');
    }

    // 记录字段级变更日志
    try {
      const changedAt = new Date();
      for (const field of changedFields) {
        const oldValue = oldAsset[field];
        const newValue = assetData[field];
        if (String(oldValue ?? '') === String(newValue ?? '')) continue;
        await db.execute(
          `INSERT INTO asset_change_logs
           (asset_code, tenant_id, changed_by, field_name, old_value, new_value, changed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            resolvedAssetCode,
            tenantId,
            userId || null,
            field,
            oldValue === null || oldValue === undefined ? '' : String(oldValue),
            newValue === null || newValue === undefined ? '' : String(newValue),
            changedAt,
          ],
        );
      }
    } catch (logError) {
      logger.warn('资产变更日志记录失败', { error: logError.message });
    }

    // Clear cache
    await cacheService.deleteByTag('asset:list');

    return { updated: true, asset_code: resolvedAssetCode };
  }

  /**
   * 校验更新时的字段格式（只校验传入的字段）
   * @param {Object} assetData - 更新数据
   */
  _validateUpdateFields(assetData) {
    // 日期格式校验
    if (assetData.purchase_date !== undefined && assetData.purchase_date !== null && assetData.purchase_date !== '') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(assetData.purchase_date)) {
        throw new Error('购置日期格式无效');
      }
    }
    if (assetData.warranty_end_date !== undefined && assetData.warranty_end_date !== null && assetData.warranty_end_date !== '') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(assetData.warranty_end_date)) {
        throw new Error('保修到期日格式无效');
      }
    }
    if (assetData.original_created_at !== undefined && assetData.original_created_at !== null && assetData.original_created_at !== '') {
      const v = String(assetData.original_created_at);
      if (!/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}:\d{2})?$/.test(v)) {
        throw new Error('原始创建时间格式无效');
      }
    }

    // 非负数校验
    const nonNegativeFields = ['purchase_price', 'current_value', 'depreciation_years', 'warranty_period'];
    for (const field of nonNegativeFields) {
      if (assetData[field] !== undefined && assetData[field] !== null && assetData[field] !== '') {
        const num = Number(assetData[field]);
        if (!Number.isFinite(num) || num < 0) {
          throw new Error(`${field} 必须是大于等于0的数字`);
        }
      }
    }

    // 整数校验
    const integerFields = ['depreciation_years', 'warranty_period'];
    for (const field of integerFields) {
      if (assetData[field] !== undefined && assetData[field] !== null && assetData[field] !== '') {
        const num = Number(assetData[field]);
        if (!Number.isInteger(num)) {
          throw new Error(`${field} 必须是整数`);
        }
      }
    }

    // 必填字段非空校验（更新时如果传了必填字段，不能为空）
    if (assetData.asset_name !== undefined && (!assetData.asset_name || String(assetData.asset_name).trim() === '')) {
      throw new Error('资产名称不能为空');
    }
    if (assetData.category_id !== undefined && (!assetData.category_id || Number(assetData.category_id) <= 0)) {
      throw new Error('资产分类不能为空');
    }
  }

  /**
   * 删除资产（软删除）
   * @param {string|number} idOrCode - 资产ID 或 asset_code
   * @param {string} tenantId - 租户ID
   * @param {number} userId - 操作用户ID
   * @param {Object} [options] - 可选项
   * @param {boolean} [options.force=false] - 强制删除（跳过反向引用校验）
   * @returns {Promise<{ deleted: boolean, asset_code: string }>}
   */
  async deleteAsset(idOrCode, tenantId, userId, options = {}) {
    const identifier = this.resolveAssetIdentifier(idOrCode);
    if (!identifier) {
      throw new Error('资产标识不能为空');
    }

    // 1) 先查出资产 code（如果入参是 id），并校验存在
    let resolvedAssetCode = null;
    let resolvedAssetId = null;
    {
      const whereCol = identifier.column;
      const whereVal = identifier.value;
      const [rows] = await db.execute(
        `SELECT id, asset_code FROM assets WHERE ${whereCol} = ? AND tenant_id = ? AND is_deleted = 0`,
        [whereVal, tenantId],
      );
      if (rows.length === 0) {
        throw new Error('资产不存在');
      }
      resolvedAssetId = rows[0].id;
      resolvedAssetCode = rows[0].asset_code;
    }

    // 2) 反向引用校验：存在未结/未到期的关联数据则阻止删除
    if (!options.force) {
      const blockers = await this._checkAssetReferences(resolvedAssetId, resolvedAssetCode, tenantId);
      if (blockers.length > 0) {
        const err = new Error(`资产存在未结关联，禁止删除：${blockers.join('；')}`);
        err.code = 'ASSET_HAS_ACTIVE_REFERENCES';
        err.blockers = blockers;
        err.statusCode = 409;
        throw err;
      }
    }

    // 3) 软删除
    const [result] = await db.execute(
      `UPDATE assets
       SET is_deleted = 1, deleted_at = NOW(), deleted_by = ?
       WHERE id = ? AND tenant_id = ? AND is_deleted = 0`,
      [userId || null, resolvedAssetId, tenantId],
    );

    if (result.affectedRows === 0) {
      // 极端情况：被并发删除了
      throw new Error('资产已被其他操作删除');
    }

    // Clear cache
    await cacheService.deleteByTag('asset:list');

    return { deleted: true, asset_code: resolvedAssetCode };
  }

  /**
   * 检查资产是否存在未结/未到期的关联数据
   * @param {number} assetId
   * @param {string} assetCode
   * @param {string|number} tenantId
   * @returns {Promise<string[]>} 阻塞原因列表（空数组表示可删除）
   */
  async _checkAssetReferences(assetId, assetCode, tenantId) {
    // COLLATE workaround：不同表字符集/排序规则不一致，统一用 utf8mb4_0900_ai_ci 比较
    const idCondition = (col) =>
      `(CAST(${col} AS CHAR) COLLATE utf8mb4_0900_ai_ci = ? COLLATE utf8mb4_0900_ai_ci OR ${col} = ?)`;
    const idParams = [String(assetId), assetCode];

    const checks = [
      // 维修申请：待审批 / 已批准 / 维修中
      {
        sql: `SELECT COUNT(*) AS cnt FROM maintenance_requests
              WHERE tenant_id = ? AND ${idCondition('asset_code')}
                AND status IN ('待审批','已批准','维修中')`,
        params: [tenantId, ...idParams],
        reason: '存在未结维修申请',
      },
      // 工单：pending / assigned / in_progress / pending_acceptance
      {
        sql: `SELECT COUNT(*) AS cnt FROM work_orders
              WHERE tenant_id = ? AND ${idCondition('asset_code')}
                AND status IN ('pending','assigned','in_progress','pending_acceptance')`,
        params: [tenantId, ...idParams],
        reason: '存在未完工单',
      },
      // 保修：当前在生效期（end_date >= 今天）
      {
        sql: `SELECT COUNT(*) AS cnt FROM warranty_info
              WHERE tenant_id = ? AND ${idCondition('asset_code')}
                AND end_date >= CURDATE() AND warranty_status IN ('在保','即将到期')`,
        params: [tenantId, ...idParams],
        reason: '存在生效中的保修',
      },
      // 盘点：进行中
      {
        sql: `SELECT COUNT(*) AS cnt FROM inventory_details idetail
              JOIN inventory_records ir ON idetail.inventory_id = ir.id AND ir.tenant_id = idetail.tenant_id
              WHERE idetail.tenant_id = ? AND ${idCondition('idetail.asset_code')}
                AND ir.status = '进行中'`,
        params: [tenantId, ...idParams],
        reason: '存在进行中的盘点',
      },
      // 巡检任务：待处理 / 进行中
      {
        sql: `SELECT COUNT(*) AS cnt FROM inspection_tasks
              WHERE tenant_id = ? AND ${idCondition('asset_id')}
                AND status IN ('pending','in_progress')`,
        params: [tenantId, ...idParams],
        reason: '存在未完巡检任务',
      },
      // 闲置资产发布：发布中
      {
        sql: `SELECT COUNT(*) AS cnt FROM idle_assets
              WHERE tenant_id = ? AND ${idCondition('asset_id')}
                AND status = '发布中'`,
        params: [tenantId, ...idParams],
        reason: '存在发布中的闲置资产',
      },
      // 位置告警：未处理（is_handled = 0）
      {
        sql: `SELECT COUNT(*) AS cnt FROM location_alerts
              WHERE tenant_id = ? AND ${idCondition('asset_id')}
                AND is_handled = 0`,
        params: [tenantId, ...idParams],
        reason: '存在未处理的位置告警',
      },
      // 风险评估：未完结（高/极高风险且未处置）
      {
        sql: `SELECT COUNT(*) AS cnt FROM risk_assessments
              WHERE tenant_id = ? AND ${idCondition('asset_id')}
                AND risk_level IN ('high','critical') AND status != 'closed'`,
        params: [tenantId, ...idParams],
        reason: '存在未关闭的高风险评估',
      },
    ];

    const results = await Promise.all(
      checks.map(async (c) => {
        const [rows] = await db.execute(c.sql, c.params);
        return { reason: c.reason, cnt: rows[0]?.cnt || 0 };
      }),
    );

    return results.filter((r) => r.cnt > 0).map((r) => `${r.reason}（${r.cnt}）`);
  }

  /**
   * 获取资产分类列表
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 分类列表
   */
  async getCategories(tenantId) {
    const cacheKey = `asset-categories:${tenantId}`;

    try {
      const cached = await cacheService.get('asset-categories', cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      logger.warn('Cache read failed: ' + error.message);
    }

    const [rows] = await db.execute(
      `SELECT id, name, parent_id, code, description, is_public, created_at, tenant_id
       FROM asset_categories
       WHERE tenant_id = ? OR is_public = 1
       ORDER BY name`,
      [tenantId],
    );

    try {
      await cacheService.set('asset-categories', cacheKey, rows, {
        ttl: CACHE_TTL,
        tags: ['asset:categories'],
      });
    } catch (error) {
      logger.warn('Cache write failed', { error: error.message });
    }

    return rows;
  }

  /**
   * 获取资产位置列表
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 位置列表
   */
  async getLocations(tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM asset_locations WHERE tenant_id = ? AND is_active = 1',
      [tenantId],
    );
    return rows;
  }
}

module.exports = new AssetService();
