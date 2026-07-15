/**
 * 资产变更路由模块
 * 包含创建、更新、删除资产等操作
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate, authorize } = require('../../middleware/auth');

// 资产变更权限集合（与前端 useCan('asset', ...) 对齐）
const ASSET_WRITE_ROLES = ['asset.add', 'asset.edit_all', 'asset.edit_own_department'];
const ASSET_DELETE_ROLES = ['asset.delete_all', 'asset.delete_own_department'];
const { addTenantFilter, getTenantId, requireTenantId } = require('../../middleware/tenant-filter');
const { logAudit } = require('../../middleware/auditLogger');
const { cacheService } = require('../../services/cache/CacheService');
const workflowService = require('../../services/asset-workflow.service');
const logger = require('../../config/logger');
const { ASSET_STATUS_LIST, normalizeStatus } = require('../../config/asset-status.constants');
const {
  AssetCreateValidationError,
  normalizeAssetCreatePayload,
} = require('../../utils/asset-create-validation');

/**
 * 验证资产数据
 */
function validateAssetData(data) {
  const errors = [];

  if (!data.asset_code || data.asset_code.trim() === '') {
    errors.push('资产编码不能为空');
  }

  if (!data.asset_name || data.asset_name.trim() === '') {
    errors.push('资产名称不能为空');
  }

  if (!data.category_id) {
    errors.push('资产分类不能为空');
  }

  if (data.purchase_price !== undefined && data.purchase_price < 0) {
    errors.push('购置价格不能为负数');
  }

  if (data.depreciation_years !== undefined && data.depreciation_years < 0) {
    errors.push('折旧年限不能为负数');
  }

  return errors;
}

/**
 * 记录资产变更日志
 */
async function recordChangeLog(connection, assetCode, tenantId, userId, action, changes) {
  for (const [fieldName, change] of Object.entries(changes)) {
    const { old: oldValue, new: newValue } = change;
    if (oldValue === undefined && newValue === undefined) continue;
    await connection.execute(
      `INSERT INTO asset_change_logs 
       (asset_code, tenant_id, changed_by, field_name, old_value, new_value, changed_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [assetCode, tenantId, userId, fieldName, String(oldValue ?? ''), String(newValue ?? '')],
    );
  }
}

/**
 * @swagger
 * /api/assets:
 *   post:
 *     summary: 创建资产
 *     tags: [Assets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssetCreateRequest'
 *     responses:
 *       201:
 *         description: 资产创建成功
 */
router.post('/', authenticate, requireTenantId, authorize(ASSET_WRITE_ROLES), async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const tenantId = getTenantId(req);
    const userId = req.user.id;
    const rawData = req.body;

    let data;
    try {
      data = normalizeAssetCreatePayload(rawData);
    } catch (validationError) {
      if (validationError instanceof AssetCreateValidationError) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: '数据验证失败',
          errors: [validationError.message],
        });
      }
      throw validationError;
    }

    if (data.department_new) {
      const [deptRows] = await connection.execute(
        'SELECT department_code FROM departments WHERE department_code = ? AND tenant_id = ? LIMIT 1',
        [data.department_new, tenantId],
      );
      if (deptRows.length === 0) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: '所选使用部门不存在或不属于当前租户',
        });
      }
    }

    if (data.status !== undefined && data.status !== null && !ASSET_STATUS_LIST.includes(data.status)) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: '无效的资产状态',
        errors: [`状态值必须是: ${ASSET_STATUS_LIST.join(', ')}`],
      });
    }

    if (data.category_secondary_id) {
      const [subCategoryRows] = await connection.execute(
        'SELECT parent_id FROM asset_categories WHERE id = ? AND tenant_id = ? LIMIT 1',
        [data.category_secondary_id, tenantId],
      );
      if (subCategoryRows.length === 0) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: '所选二级分类不存在',
        });
      }
      if (subCategoryRows[0].parent_id !== data.category_id) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: '二级分类不属于所选一级分类',
        });
      }
    }

    // 检查资产编码是否重复
    const [existing] = await connection.execute(
      'SELECT id FROM assets WHERE asset_code = ? AND tenant_id = ?',
      [data.asset_code, tenantId],
    );

    if (existing.length > 0) {
      connection.release();
      return res.status(409).json({ success: false, message: '资产编码已存在' });
    }

    // 构建插入字段
    const fields = [
      'tenant_id', 'asset_code', 'asset_name', 'category_id',
      'brand', 'model', 'specification', 'serial_number',
      'purchase_date', 'purchase_price', 'current_value',
      'depreciation_method', 'depreciation_years',
      'location', 'department_new', 'responsible_person',
      'status', 'supplier', 'warranty_period', 'warranty_end_date',
      'remark', 'created_by',
    ];

    const values = [
      tenantId,
      data.asset_code,
      data.asset_name,
      data.category_id,
      data.brand || null,
      data.model || null,
      data.specification || null,
      data.serial_number || null,
      data.purchase_date || null,
      data.purchase_price || 0,
      data.current_value || data.purchase_price || 0,
      data.depreciation_method || '平均年限法',
      data.depreciation_years || 5,
      data.location || null,
      data.department_new || null,
      data.responsible_person || null,
      data.status || '在用',
      data.supplier || null,
      data.warranty_period || null,
      data.warranty_end_date || null,
      data.remark || null,
      userId,
    ];

    const placeholders = fields.map(() => '?').join(',');
    const [result] = await connection.execute(
      `INSERT INTO assets (${fields.join(',')}) VALUES (${placeholders})`,
      values,
    );

    const assetId = result.insertId;

    // 记录变更日志
    await recordChangeLog(connection, data.asset_code, tenantId, userId, 'CREATE', {
      ...data,
      created_at: new Date().toISOString(),
    });

    // 触发工作流 (wrapped in try/catch - workflow functions not yet implemented)
    try {
      if (workflowService.triggerAssetCreate) {
        await workflowService.triggerAssetCreate(tenantId, assetId, data);
      }
    } catch (err) {
      logger.warn('Workflow triggerAssetCreate failed (non-critical):', err.message);
    }

    await connection.commit();

    // 清除相关缓存
    await cacheService.deleteByTag('asset:list');

    // 记录审计日志
    await logAudit(req, 'ASSET_CREATE', 'asset', assetId, { asset_code: data.asset_code });

    logger.info(`Asset created: ${assetId} (${data.asset_code}) by user ${userId}`);

    res.status(201).json({
      success: true,
      message: '资产创建成功',
      data: { id: assetId, asset_code: data.asset_code },
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Create asset failed:', error);
    res.status(500).json({ success: false, message: '创建资产失败', error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * @swagger
 * /api/assets/{id}:
 *   put:
 *     summary: 更新资产
 *     tags: [Assets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssetCreateRequest'
 */
router.put('/:id', authenticate, authorize(ASSET_WRITE_ROLES), async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const tenantId = getTenantId(req);
    const userId = req.user.id;
    const data = req.body;

    // 验证资产是否存在
    const [existing] = await connection.execute(
      'SELECT * FROM assets WHERE id = ? AND tenant_id = ? AND is_deleted = 0',
      [id, tenantId],
    );

    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const oldAsset = existing[0];

    // 如果修改了资产编码，检查是否重复
    if (data.asset_code && data.asset_code !== oldAsset.asset_code) {
      const [duplicate] = await connection.execute(
        'SELECT id FROM assets WHERE asset_code = ? AND tenant_id = ? AND id != ?',
        [data.asset_code, tenantId, id],
      );

      if (duplicate.length > 0) {
        connection.release();
        return res.status(409).json({ success: false, message: '资产编码已存在' });
      }
    }

    // 验证状态值是否为有效的 ENUM 值
    if (data.status !== undefined && !ASSET_STATUS_LIST.includes(data.status)) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: '无效的资产状态',
        errors: [`状态值必须是: ${ASSET_STATUS_LIST.join(', ')}`],
      });
    }

    // 验证更新的字段值
    const validationErrors = [];
    if (data.asset_code !== undefined && (!data.asset_code || data.asset_code.trim() === '')) {
      validationErrors.push('资产编码不能为空');
    }
    if (data.asset_name !== undefined && (!data.asset_name || data.asset_name.trim() === '')) {
      validationErrors.push('资产名称不能为空');
    }
    if (data.purchase_price !== undefined && data.purchase_price < 0) {
      validationErrors.push('购置价格不能为负数');
    }
    if (data.depreciation_years !== undefined && data.depreciation_years < 0) {
      validationErrors.push('折旧年限不能为负数');
    }
    if (validationErrors.length > 0) {
      connection.release();
      return res.status(400).json({ success: false, message: '数据验证失败', errors: validationErrors });
    }

    // 构建更新字段
    const updates = [];
    const values = [];

    const fields = [
      'asset_code', 'asset_name', 'category_id', 'brand', 'model',
      'specification', 'serial_number', 'purchase_date', 'purchase_price',
      'current_value', 'depreciation_method', 'depreciation_years',
      'location', 'department_new', 'responsible_person', 'status',
      'supplier', 'warranty_period', 'warranty_end_date', 'remark',
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (updates.length === 0) {
      connection.release();
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }

    updates.push('updated_at = NOW()');
    updates.push('updated_by = ?');
    values.push(userId);
    values.push(id);
    values.push(tenantId);

    await connection.execute(
      `UPDATE assets SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ? AND is_deleted = 0`,
      values,
    );

    // 记录变更日志
    const changes = {};
    for (const field of fields) {
      if (data[field] !== undefined && data[field] !== oldAsset[field]) {
        changes[field] = { old: oldAsset[field], new: data[field] };
      }
    }

    if (Object.keys(changes).length > 0) {
      await recordChangeLog(connection, oldAsset.asset_code, tenantId, userId, 'UPDATE', changes);
    }

    // 触发工作流 (wrapped in try/catch - workflow functions not yet implemented)
    try {
      if (workflowService.triggerAssetUpdate) {
        await workflowService.triggerAssetUpdate(tenantId, id, oldAsset, data);
      }
    } catch (err) {
      logger.warn('Workflow triggerAssetUpdate failed (non-critical):', err.message);
    }

    await connection.commit();

    // 清除相关缓存
    await cacheService.delete('asset:detail', `asset:${tenantId}:${id}`);
    await cacheService.deleteByTag('asset:list');

    await logAudit(req, 'ASSET_UPDATE', 'asset', id, { asset_code: data.asset_code || oldAsset.asset_code, changes: Object.keys(changes) });

    logger.info(`Asset updated: ${id} by user ${userId}`);

    res.json({
      success: true,
      message: '资产更新成功',
      data: { id },
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Update asset failed:', error);
    res.status(500).json({ success: false, message: '更新资产失败', error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * @swagger
 * /api/assets/{id}:
 *   delete:
 *     summary: 删除资产
 *     tags: [Assets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 */
router.delete('/:id', authenticate, authorize(ASSET_DELETE_ROLES), async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const tenantId = getTenantId(req);
    const userId = req.user.id;

    // 验证资产是否存在
    const [existing] = await connection.execute(
      'SELECT asset_code, status FROM assets WHERE id = ? AND tenant_id = ? AND is_deleted = 0',
      [id, tenantId],
    );

    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const asset = existing[0];

    // 检查资产状态
    if (asset.status === '在用') {
      connection.release();
      return res.status(400).json({ success: false, message: '在用状态的资产不能删除，请先进行报废或调拨' });
    }

    // 检查是否存在关联数据
    const [maintenance] = await connection.execute(
      'SELECT COUNT(*) as count FROM maintenance_logs WHERE asset_id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    // 统一使用软删除
    await connection.execute(
      'UPDATE assets SET is_deleted = 1, deleted_at = NOW(), deleted_by = ? WHERE id = ? AND tenant_id = ?',
      [userId, id, tenantId],
    );

    await recordChangeLog(connection, asset.asset_code, tenantId, userId, 'SOFT_DELETE', {
      status: { old: asset.status, new: '已删除' },
      maintenance_count: { old: maintenance[0].count, new: null },
    });

    await connection.commit();

    // 清除相关缓存
    await cacheService.delete('asset:detail', `asset:${tenantId}:${id}`);
    await cacheService.deleteByTag('asset:list');

    await logAudit(req, 'ASSET_DELETE', 'asset', id, { asset_code: asset.asset_code });

    logger.info(`Asset deleted: ${id} (${asset.asset_code}) by user ${userId}`);

    res.json({
      success: true,
      message: '资产删除成功',
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Delete asset failed:', error);
    res.status(500).json({ success: false, message: '删除资产失败', error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
