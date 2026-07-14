const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate } = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');

function logTempAssetError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: getTenantId(req) || null,
    ...context,
  });
}

// 获取临时资产列表
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, source, keyword } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 't');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    // 添加状态过滤
    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }

    // 添加来源过滤
    if (source) {
      whereClause += ' AND t.source = ?';
      params.push(source);
    }

    // 添加关键词搜索
    if (keyword) {
      whereClause +=
        ' AND (t.asset_name LIKE ? OR t.asset_type LIKE ? OR t.brand LIKE ? OR t.model LIKE ? OR t.specification LIKE ?)';
      const searchKeyword = `%${keyword}%`;
      params.push(searchKeyword, searchKeyword, searchKeyword, searchKeyword, searchKeyword);
    }

    // 资产管理员只能查看自己管理科室的临时资产
    if (
      req.user.role === 'asset_admin' &&
      req.user.managed_departments &&
      req.user.managed_departments.length > 0 &&
      !req.user.managed_departments.includes('*')
    ) {
      const departmentIdsToFilter = req.user.managed_departments;
      whereClause += ` AND (t.department IN (${departmentIdsToFilter.map(() => '?').join(',')}))`;
      params.push(...departmentIdsToFilter);
    }

    // 获取总数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM temp_assets t ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    // 获取数据
    const [rows] = await db.execute(
      `SELECT t.*
       FROM temp_assets t
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logTempAssetError('获取临时资产列表失败', error, req, {
      page: Number(req.query?.page) || 1,
      pageSize: Number(req.query?.pageSize) || 20,
      status: req.query?.status || null,
      source: req.query?.source || null,
      keyword: req.query?.keyword || null,
    });
    res.status(500).json({ success: false, message: '获取临时资产列表失败', error: error.message });
  }
});

// 获取单个临时资产详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 添加租户过滤验证
    const tenantFilter = addTenantFilter(req, 't');
    let whereClause = `WHERE t.id = ? ${tenantFilter.whereClause}`;
    const params = [id, ...tenantFilter.params];

    // 资产管理员只能查看自己管理科室的临时资产
    if (
      req.user.role === 'asset_admin' &&
      req.user.managed_departments &&
      req.user.managed_departments.length > 0 &&
      !req.user.managed_departments.includes('*')
    ) {
      const departmentIdsToFilter = req.user.managed_departments;
      whereClause += ` AND (t.department IN (${departmentIdsToFilter.map(() => '?').join(',')}))`;
      params.push(...departmentIdsToFilter);
    }

    const [rows] = await db.execute(
      `SELECT t.*
       FROM temp_assets t
       ${whereClause}`,
      params,
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '临时资产不存在' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logTempAssetError('获取临时资产详情失败', error, req, {
      id: req.params.id,
    });
    res.status(500).json({ success: false, message: '获取临时资产详情失败', error: error.message });
  }
});

// 创建临时资产
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      asset_name,
      asset_type,
      brand,
      model,
      specification,
      location,
      department,
      status,
      source,
      remark,
    } = req.body;

    if (!asset_name) {
      return res.status(400).json({ success: false, message: '资产名称不能为空' });
    }

    const tenantId = getTenantId(req);
    const [result] = await db.execute(
      `INSERT INTO temp_assets (
        tenant_id, asset_name, asset_type, brand, model, specification,
        location, department, status, source, created_by, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        asset_name,
        asset_type || null,
        brand || null,
        model || null,
        specification || null,
        location || null,
        department || null,
        status || '闲置',
        source || '临时',
        req.user.username,
        remark || null,
      ],
    );

    res.json({
      success: true,
      message: '临时资产创建成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    logTempAssetError('创建临时资产失败', error, req, {
      assetName: req.body?.asset_name || null,
      source: req.body?.source || null,
    });
    res.status(500).json({ success: false, message: '创建临时资产失败', error: error.message });
  }
});

// 更新临时资产
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      asset_name,
      asset_type,
      brand,
      model,
      specification,
      location,
      department,
      status,
      source,
      remark,
    } = req.body;

    // 验证临时资产是否存在且属于当前租户
    const tenantFilter = addTenantFilter(req, 't');
    let whereClause = `WHERE t.id = ? ${tenantFilter.whereClause}`;
    const params = [id, ...tenantFilter.params];

    // 资产管理员只能更新自己管理科室的临时资产
    if (
      req.user.role === 'asset_admin' &&
      req.user.managed_departments &&
      req.user.managed_departments.length > 0 &&
      !req.user.managed_departments.includes('*')
    ) {
      const departmentIdsToFilter = req.user.managed_departments;
      whereClause += ` AND (t.department IN (${departmentIdsToFilter.map(() => '?').join(',')}))`;
      params.push(...departmentIdsToFilter);
    }

    const [existing] = await db.execute(`SELECT id FROM temp_assets t ${whereClause}`, params);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '临时资产不存在' });
    }

    // 构建更新SQL
    const updateFields = [];
    const updateValues = [];

    if (asset_name !== undefined)
      (updateFields.push('asset_name = ?'), updateValues.push(asset_name));
    if (asset_type !== undefined)
      (updateFields.push('asset_type = ?'), updateValues.push(asset_type));
    if (brand !== undefined) (updateFields.push('brand = ?'), updateValues.push(brand));
    if (model !== undefined) (updateFields.push('model = ?'), updateValues.push(model));
    if (specification !== undefined)
      (updateFields.push('specification = ?'), updateValues.push(specification));
    if (location !== undefined) (updateFields.push('location = ?'), updateValues.push(location));
    if (department !== undefined)
      (updateFields.push('department = ?'), updateValues.push(department));
    if (status !== undefined) (updateFields.push('status = ?'), updateValues.push(status));
    if (source !== undefined) (updateFields.push('source = ?'), updateValues.push(source));
    if (remark !== undefined) (updateFields.push('remark = ?'), updateValues.push(remark));

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id, ...tenantFilter.params);

    if (updateFields.length > 1) {
      await db.execute(
        `UPDATE temp_assets t SET ${updateFields.join(', ')} WHERE t.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
        updateValues,
      );
    }

    res.json({ success: true, message: '临时资产更新成功' });
  } catch (error) {
    logTempAssetError('更新临时资产失败', error, req, {
      id: req.params.id,
      assetName: req.body?.asset_name || null,
      status: req.body?.status || null,
    });
    res.status(500).json({ success: false, message: '更新临时资产失败', error: error.message });
  }
});

// 删除临时资产
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 验证临时资产是否存在且属于当前租户
    const tenantFilter = addTenantFilter(req, 't');
    let whereClause = `WHERE t.id = ? ${tenantFilter.whereClause}`;
    const params = [id, ...tenantFilter.params];

    // 资产管理员只能删除自己管理科室的临时资产
    if (
      req.user.role === 'asset_admin' &&
      req.user.managed_departments &&
      req.user.managed_departments.length > 0 &&
      !req.user.managed_departments.includes('*')
    ) {
      const departmentIdsToFilter = req.user.managed_departments;
      whereClause += ` AND (t.department IN (${departmentIdsToFilter.map(() => '?').join(',')}))`;
      params.push(...departmentIdsToFilter);
    }

    const [existing] = await db.execute(`SELECT id FROM temp_assets t ${whereClause}`, params);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '临时资产不存在' });
    }

    // 检查是否有关联的闲置资产发布记录
    const tenantId = getTenantId(req);
    const [idleAssets] = await db.execute(
      'SELECT id FROM idle_assets WHERE asset_id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (idleAssets.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: '该临时资产已发布为闲置资产，无法删除' });
    }

    // 删除临时资产
    const [result] = await db.execute(`DELETE t FROM temp_assets t ${whereClause}`, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '临时资产不存在' });
    }

    res.json({ success: true, message: '临时资产删除成功' });
  } catch (error) {
    logTempAssetError('删除临时资产失败', error, req, {
      id: req.params.id,
    });
    res.status(500).json({ success: false, message: '删除临时资产失败', error: error.message });
  }
});

module.exports = router;
