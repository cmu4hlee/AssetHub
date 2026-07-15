const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { addTenantFilter, getTenantId, requireTenantId } = require('../middleware/tenant-filter');
const { TransactionManager } = require('../utils/error-handler');
const { logAudit } = require('../middleware/auditLogger');

// 闲置资产状态
const IDLE_STATUS = {
  PUBLISHING: '发布中',
  ALLOCATED: '已分配',
  CANCELLED: '已取消',
};

// 验证发布输入数据
function validatePublishInput(data) {
  const errors = [];

  if (data.asset_code !== undefined && data.asset_code !== null) {
    if (typeof data.asset_code !== 'string' || data.asset_code.length > 50) {
      errors.push('资产编号格式不正确（最长50字符）');
    }
  }

  if (data.asset_name !== undefined && data.asset_name !== null) {
    if (typeof data.asset_name !== 'string' || data.asset_name.length > 100) {
      errors.push('资产名称格式不正确（最长100字符）');
    }
  }

  if (data.publish_person !== undefined && data.publish_person !== null) {
    if (typeof data.publish_person !== 'string' || data.publish_person.length > 50) {
      errors.push('发布人格式不正确（最长50字符）');
    }
  }

  if (data.contact_phone !== undefined && data.contact_phone !== null) {
    if (typeof data.contact_phone !== 'string') {
      errors.push('联系电话格式不正确');
    } else if (data.contact_phone.length > 20) {
      errors.push('联系电话格式不正确（最长20字符）');
    }
  }

  if (data.expected_use !== undefined && data.expected_use !== null) {
    if (typeof data.expected_use !== 'string' || data.expected_use.length > 500) {
      errors.push('用途格式不正确（最长500字符）');
    }
  }

  return { valid: errors.length === 0, errors };
}

const IDLE_ASSET_ASSET_JOIN = 'LEFT JOIN assets a ON ia.asset_id = a.id AND a.tenant_id = ia.tenant_id AND a.is_deleted = 0';
const IDLE_ASSET_TEMP_JOIN =
  'LEFT JOIN temp_assets t ON ia.asset_id = t.id AND t.tenant_id = ia.tenant_id';

async function fetchManagedDepartmentNames(departmentCodes, tenantId) {
  if (!Array.isArray(departmentCodes) || departmentCodes.length === 0) {
    return [];
  }

  const placeholders = departmentCodes.map(() => '?').join(',');
  const [rows] = await db.execute(
    `SELECT department_name FROM departments WHERE tenant_id = ? AND department_code IN (${placeholders})`,
    [tenantId, ...departmentCodes],
  );
  return rows.map(row => row.department_name);
}

// 获取所有闲置资产发布记录
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'ia');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    // 根据用户的管理科室过滤资产
    // 系统管理员可以看到所有闲置资产
    if (req.user.role !== 'system_admin' && req.user.role !== 'super_admin') {
      if (
        req.user.managed_departments &&
        Array.isArray(req.user.managed_departments) &&
        req.user.managed_departments.length > 0
      ) {
        const placeholders = req.user.managed_departments.map(() => '?').join(',');
        whereClause += ` AND (
          EXISTS (
            SELECT 1 FROM assets a
            WHERE a.id = ia.asset_id
            AND a.tenant_id = ia.tenant_id
            AND (a.department IN (
              SELECT department_name FROM departments WHERE tenant_id = ia.tenant_id AND department_code IN (${placeholders})
            ) OR a.department_new IN (${placeholders})
            )
          ) OR EXISTS (
            SELECT 1 FROM temp_assets t
            WHERE t.id = ia.asset_id
            AND t.tenant_id = ia.tenant_id
            AND t.department IN (
              SELECT department_name FROM departments WHERE tenant_id = ia.tenant_id AND department_code IN (${placeholders})
            )
          )
        )`;
        params.push(
          ...req.user.managed_departments,
          ...req.user.managed_departments,
          ...req.user.managed_departments,
        );
      } else {
        // 非系统管理员但没有管理科室，返回空结果
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            total: 0,
            totalPages: 0,
          },
        });
      }
    }

    if (status) {
      whereClause += ' AND ia.status = ?';
      params.push(status);
    }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM idle_assets ia
       ${IDLE_ASSET_ASSET_JOIN}
       ${IDLE_ASSET_TEMP_JOIN}
       ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const [rows] = await db.execute(
      `SELECT ia.*,
              COALESCE(a.asset_code, CONCAT('TEMP_', t.id)) as asset_code,
              COALESCE(a.asset_name, t.asset_name) as asset_name,
              COALESCE(a.asset_type, t.asset_type) as asset_type,
              COALESCE(a.brand, t.brand) as brand,
              COALESCE(a.model, t.model) as model,
              COALESCE(a.specification, t.specification) as specification,
              a.purchase_date,
              a.purchase_price,
              a.current_value,
              COALESCE(a.location, t.location) as location,
              COALESCE(a.department, t.department) as department,
              COALESCE(a.status, t.status) as asset_status,
              COALESCE(t.source, 'existing') as asset_source,
              DATEDIFF(CURDATE(), ia.publish_date) as idle_days
       FROM idle_assets ia
       ${IDLE_ASSET_ASSET_JOIN}
       ${IDLE_ASSET_TEMP_JOIN}
       ${whereClause}
       ORDER BY ia.created_at DESC
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
    console.error('获取闲置资产列表失败:', error);
    res.status(500).json({ success: false, message: '获取闲置资产列表失败', error: error.message });
  }
});

// 闲置资产统计汇总
router.get('/statistics', authenticate, async (req, res) => {
  try {
    const tenantFilter = addTenantFilter(req, 'ia');
    const whereClause = tenantFilter.whereClause
      ? `WHERE 1=1 ${tenantFilter.whereClause}`
      : '';
    const params = [...tenantFilter.params];

    const [rows] = await db.execute(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN ia.status = '发布中' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN ia.status = '已分配' THEN 1 ELSE 0 END) as allocated,
        SUM(CASE WHEN ia.status = '已取消' THEN 1 ELSE 0 END) as cancelled,
        ROUND(AVG(CASE WHEN ia.status = '发布中' THEN DATEDIFF(CURDATE(), ia.publish_date) ELSE NULL END), 0) as avg_idle_days,
        MAX(CASE WHEN ia.status = '发布中' THEN DATEDIFF(CURDATE(), ia.publish_date) ELSE 0 END) as max_idle_days,
        SUM(CASE WHEN ia.status = '发布中' AND DATEDIFF(CURDATE(), ia.publish_date) >= 30 THEN 1 ELSE 0 END) as long_idle_count
       FROM idle_assets ia
       ${whereClause}`,
      params,
    );

    res.json({ success: true, data: rows[0] || {} });
  } catch (error) {
    console.error('获取闲置资产统计失败:', error);
    res
      .status(500)
      .json({ success: false, message: '获取闲置资产统计失败', error: error.message });
  }
});

// 获取单个闲置资产详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 添加租户过滤验证
    const tenantFilter = addTenantFilter(req, 'ia');
    const [rows] = await db.execute(
      `SELECT ia.*,
              COALESCE(a.asset_code, CONCAT('TEMP_', t.id)) as asset_code,
              COALESCE(a.asset_name, t.asset_name) as asset_name,
              COALESCE(a.brand, t.brand) as brand,
              COALESCE(a.model, t.model) as model,
              COALESCE(a.specification, t.specification) as specification,
              a.purchase_date,
              a.purchase_price,
              a.current_value,
              COALESCE(a.location, t.location) as location,
              COALESCE(a.department, t.department) as department,
              COALESCE(a.status, t.status) as asset_status,
              COALESCE(t.source, 'existing') as asset_source,
              a.department_new,
              t.department as temp_department
       FROM idle_assets ia
       ${IDLE_ASSET_ASSET_JOIN}
       ${IDLE_ASSET_TEMP_JOIN}
       WHERE ia.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '闲置资产记录不存在' });
    }

    const idleAsset = rows[0];

    // 权限检查：非系统管理员只能查看自己管理科室的闲置资产
    if (req.user.role !== 'system_admin' && req.user.role !== 'super_admin') {
      if (
        req.user.managed_departments &&
        Array.isArray(req.user.managed_departments) &&
        req.user.managed_departments.length > 0
      ) {
        const managedDeptNames = await fetchManagedDepartmentNames(
          req.user.managed_departments,
          getTenantId(req),
        );
        const managedDeptCodes = req.user.managed_departments;

        // 检查闲置资产的科室是否在用户管理的科室列表中
        let hasPermission = false;

        // 检查是否是现有资产
        if (idleAsset.asset_source === 'existing') {
          // 检查现有资产的科室
          if (
            managedDeptNames.includes(idleAsset.department) ||
            managedDeptCodes.includes(idleAsset.department_new)
          ) {
            hasPermission = true;
          }
        } else {
          // 检查临时资产的科室
          if (managedDeptNames.includes(idleAsset.temp_department)) {
            hasPermission = true;
          }
        }

        if (!hasPermission) {
          return res
            .status(403)
            .json({ success: false, message: '权限不足，只能查看自己管理科室的闲置资产' });
        }
      } else {
        return res.status(403).json({ success: false, message: '权限不足，用户未分配管理科室' });
      }
    }

    res.json({ success: true, data: idleAsset });
  } catch (error) {
    console.error('获取闲置资产详情失败:', error);
    res.status(500).json({ success: false, message: '获取闲置资产详情失败', error: error.message });
  }
});

// 发布闲置资产
router.post('/', authenticate, requireTenantId, async (req, res) => {
  try {
    const {
      asset_code,
      asset_name,
      asset_type,
      brand,
      model,
      specification,
      location,
      department,
      publish_date,
      publish_person,
      expected_use,
      contact_person,
      contact_phone,
      remark,
    } = req.body;

    // 必填校验：发布人必填；必须提供资产编号（现有资产）或资产名称（临时资产）之一
    const publishPerson = publish_person != null && String(publish_person).trim() !== '' ? String(publish_person).trim() : null;
    if (!publishPerson) {
      return res.status(400).json({ success: false, message: '发布人不能为空' });
    }
    const hasAssetCode = asset_code != null && String(asset_code).trim() !== '';
    const hasAssetName = asset_name != null && String(asset_name).trim() !== '';
    if (!hasAssetCode && !hasAssetName) {
      return res.status(400).json({ success: false, message: '请提供资产编号（发布现有资产）或资产名称（发布临时闲置资产）' });
    }

    // 验证输入数据
    const validation = validatePublishInput({
      asset_code,
      asset_name,
      publish_person,
      contact_phone,
      expected_use,
    });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.errors.join('; ') });
    }

    // 将undefined转换为null，避免SQL语法错误
    const processedData = {
      asset_code: hasAssetCode ? String(asset_code).trim() : null,
      asset_name: hasAssetName ? String(asset_name).trim() : null,
      asset_type: asset_type || null,
      brand: brand || null,
      model: model || null,
      specification: specification || null,
      location: location || null,
      department: department || null,
      publish_date: publish_date || null,
      publish_person: publishPerson,
      expected_use: expected_use || null,
      contact_person: contact_person || null,
      contact_phone: contact_phone || null,
      remark: remark || null,
    };

    const tenantId = getTenantId(req);

    // 权限检查：非系统管理员只能发布自己管理科室的闲置资产
    if (req.user.role !== 'system_admin' && req.user.role !== 'super_admin') {
      if (
        req.user.managed_departments &&
        Array.isArray(req.user.managed_departments) &&
        req.user.managed_departments.length > 0
      ) {
        const managedDeptNames = await fetchManagedDepartmentNames(
          req.user.managed_departments,
          tenantId,
        );
        const managedDeptCodes = req.user.managed_departments;

        // 检查是发布现有资产还是创建临时资产
        if (processedData.asset_code) {
          // 发布现有资产
          // 检查资产是否存在且属于用户管理的科室
          const assetTenantFilter = addTenantFilter(req, 'a');
          const assetQuery = `SELECT a.id, a.department, a.department_new FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`;
          const assetQueryParams = [processedData.asset_code, ...assetTenantFilter.params];

          const [asset] = await db.execute(assetQuery, assetQueryParams);

          if (asset.length === 0) {
            return res.status(404).json({ success: false, message: '资产不存在' });
          }

          const assetData = asset[0];

          // 检查资产的科室是否在用户管理的科室列表中
          if (
            !managedDeptNames.includes(assetData.department) &&
            !managedDeptCodes.includes(assetData.department_new)
          ) {
            return res
              .status(403)
              .json({ success: false, message: '权限不足，只能发布自己管理科室的闲置资产' });
          }
        } else if (processedData.asset_name) {
          // 创建临时资产
          // 检查临时资产的科室是否在用户管理的科室列表中
          if (!managedDeptNames.includes(processedData.department)) {
            return res
              .status(403)
              .json({ success: false, message: '权限不足，只能创建自己管理科室的临时资产' });
          }
        }
      } else {
        return res.status(403).json({ success: false, message: '权限不足，用户未分配管理科室' });
      }
    }
    let finalAssetId;
    let assetIdForInsert = null;

    // 检查是否是创建临时资产
    if (processedData.asset_name && !processedData.asset_code) {
      // 创建临时资产
      const [tempAssetResult] = await db.execute(
        `INSERT INTO temp_assets (
          tenant_id, asset_name, asset_type, brand, model, specification,
          location, department, status, source, created_by, remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          processedData.asset_name,
          processedData.asset_type,
          processedData.brand,
          processedData.model,
          processedData.specification,
          processedData.location,
          processedData.department,
          '闲置',
          '临时',
          req.user.username,
          processedData.remark,
        ],
      );

      finalAssetId = tempAssetResult.insertId;
      console.log(`创建临时资产成功: ${finalAssetId} - ${processedData.asset_name}`);
    } else {
      // 检查现有资产是否存在（需要验证资产属于同一租户）
      const assetTenantFilter = addTenantFilter(req, 'a');
      const assetQuery = `SELECT a.id, a.asset_code, a.status FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`;
      const assetQueryParams = [processedData.asset_code, ...assetTenantFilter.params];

      const [asset] = await db.execute(assetQuery, assetQueryParams);

      if (asset.length === 0) {
        return res.status(404).json({ success: false, message: '资产不存在' });
      }

      finalAssetId = asset[0].asset_code;
      assetIdForInsert = asset[0].id;
    }

    // 发布日期：缺省时用当天
    const publishDateStr = processedData.publish_date
      ? (typeof processedData.publish_date === 'string' ? processedData.publish_date : String(processedData.publish_date)).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    // 检查 idle_assets 表结构，兼容仅有 asset_id 或 有 tenant_id+asset_code 两种 schema
    const [cols] = await db.execute(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'idle_assets'",
    );
    const columnNames = (cols || []).map(c => c.COLUMN_NAME);
    const colTenantId = columnNames.includes('tenant_id');
    const colAssetCode = columnNames.includes('asset_code');
    const colAssetId = columnNames.includes('asset_id');

    let result;
    if (colTenantId && colAssetCode) {
      const [existing] = await db.execute(
        'SELECT id FROM idle_assets WHERE asset_code = ? AND status = ? AND tenant_id = ?',
        [finalAssetId, '发布中', tenantId],
      ).catch(() => [[]]);
      if (existing.length > 0) {
        console.log(`资产 ${finalAssetId} 已有发布中的记录，允许继续发布`);
      }
      if (colAssetId) {
        [result] = await db.execute(
          `INSERT INTO idle_assets (
            tenant_id, asset_code, asset_id, publish_date, publish_person,
            expected_use, contact_person, contact_phone, remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tenantId,
            finalAssetId,
            assetIdForInsert,
            publishDateStr,
            processedData.publish_person,
            processedData.expected_use,
            processedData.contact_person,
            processedData.contact_phone,
            processedData.remark,
          ],
        );
      } else {
        [result] = await db.execute(
          `INSERT INTO idle_assets (
            tenant_id, asset_code, publish_date, publish_person,
            expected_use, contact_person, contact_phone, remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tenantId,
            finalAssetId,
            publishDateStr,
            processedData.publish_person,
            processedData.expected_use,
            processedData.contact_person,
            processedData.contact_phone,
            processedData.remark,
          ],
        );
      }
    } else if (colAssetId && assetIdForInsert != null) {
      [result] = await db.execute(
        `INSERT INTO idle_assets (
          asset_id, publish_date, publish_person,
          expected_use, contact_person, contact_phone, remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          assetIdForInsert,
          publishDateStr,
          processedData.publish_person,
          processedData.expected_use,
          processedData.contact_person,
          processedData.contact_phone,
          processedData.remark,
        ],
      );
    } else {
      return res.status(500).json({
        success: false,
        message: 'idle_assets 表缺少 tenant_id/asset_code 或 asset_id，无法插入。请执行迁移为表添加 tenant_id、asset_code 字段。',
      });
    }

    res.json({
      success: true,
      message: processedData.asset_name ? '临时资产创建并发布成功' : '闲置资产发布成功',
      data: {
        id: result.insertId,
        asset_code: finalAssetId,
        is_temp: !!processedData.asset_name,
      },
    });

    // 记录审计日志
    logAudit(req, {
      action_type: 'CREATE',
      module: 'idle-asset',
      resource_type: 'idle_asset',
      resource_id: String(result.insertId),
      resource_name: processedData.asset_name || finalAssetId,
      action_description: `发布闲置资产: ${finalAssetId}${processedData.asset_name ? `(${processedData.asset_name})` : ''}`,
      new_value: { asset_code: finalAssetId, publish_person: publishPerson, is_temp: !!processedData.asset_name },
    }).catch(err => console.error('[审计日志] 记录闲置资产发布失败:', err));
  } catch (error) {
    console.error('发布闲置资产失败:', error);
    const msg = error.code === 'ER_NO_DEFAULT_FOR_FIELD' ? '缺少必填字段，请检查发布人、发布日期' : (error.message || '发布闲置资产失败');
    res.status(500).json({ success: false, message: msg, error: error.message });
  }
});

// ===================== 批量操作 =====================

// 批量分配闲置资产
router.put('/batch/allocate', authenticate, async (req, res) => {
  try {
    const { ids, allocated_to, allocated_date } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要分配的闲置资产' });
    }
    if (!allocated_to) {
      return res.status(400).json({ success: false, message: '分配对象不能为空' });
    }

    const tenantFilter = addTenantFilter(req, 'ia');
    const placeholders = ids.map(() => '?').join(',');
    const statusDate = allocated_date || new Date().toISOString().slice(0, 10);

    // 验证所有记录都存在且为发布中
    const [existing] = await db.execute(
      `SELECT id, asset_code, status FROM idle_assets ia WHERE ia.id IN (${placeholders}) ${tenantFilter.whereClause}`,
      [...ids, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '未找到匹配的闲置资产记录' });
    }

    const invalidRecords = existing.filter(r => r.status !== '发布中');
    if (invalidRecords.length > 0) {
      return res.status(400).json({
        success: false,
        message: `以下记录状态不是发布中，无法分配: ${invalidRecords.map(r => r.asset_code).join(', ')}`,
      });
    }

    // 使用事务批量更新
    await TransactionManager.executeTransaction(async connection => {
      const updatePlaceholders = ids.map(() => '?').join(',');
      await connection.execute(
        `UPDATE idle_assets ia SET ia.status = ?, ia.allocated_to = ?, ia.allocated_date = ?
         WHERE ia.id IN (${updatePlaceholders}) ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
        [IDLE_STATUS.ALLOCATED, allocated_to, statusDate, ...ids, ...tenantFilter.params],
      );

      // 批量更新资产状态为在用
      const assetCodes = existing.filter(r => r.asset_code && !r.asset_code.startsWith('TEMP_')).map(r => r.asset_code);
      if (assetCodes.length > 0) {
        const codePlaceholders = assetCodes.map(() => '?').join(',');
        const assetTenantFilter = addTenantFilter(req, 'a');
        await connection.execute(
          `UPDATE assets a SET a.status = ? WHERE a.asset_code IN (${codePlaceholders}) ${assetTenantFilter.whereClause}`,
          ['在用', ...assetCodes, ...assetTenantFilter.params],
        );
      }
    });

    res.json({
      success: true,
      message: `成功分配 ${existing.length} 条闲置资产`,
      data: { count: existing.length },
    });

    // 记录审计日志
    logAudit(req, {
      action_type: 'BATCH_UPDATE',
      module: 'idle-asset',
      resource_type: 'idle_asset',
      resource_id: ids.join(','),
      action_description: `批量分配闲置资产 ${existing.length} 条 → ${allocated_to}`,
      new_value: { count: existing.length, allocated_to, allocated_date: statusDate },
    }).catch(err => console.error('[审计日志] 记录批量分配失败:', err));
  } catch (error) {
    console.error('批量分配闲置资产失败:', error);
    res.status(500).json({ success: false, message: '批量分配闲置资产失败', error: error.message });
  }
});

// 批量取消发布
router.put('/batch/cancel', authenticate, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要取消发布的闲置资产' });
    }

    const tenantFilter = addTenantFilter(req, 'ia');
    const placeholders = ids.map(() => '?').join(',');

    // 验证所有记录都存在且为发布中
    const [existing] = await db.execute(
      `SELECT id, status FROM idle_assets ia WHERE ia.id IN (${placeholders}) ${tenantFilter.whereClause}`,
      [...ids, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '未找到匹配的闲置资产记录' });
    }

    const invalidRecords = existing.filter(r => r.status !== '发布中');
    if (invalidRecords.length > 0) {
      return res.status(400).json({
        success: false,
        message: `有 ${invalidRecords.length} 条记录状态不是发布中，无法取消`,
      });
    }

    await db.execute(
      `UPDATE idle_assets ia SET ia.status = ?
       WHERE ia.id IN (${placeholders}) ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      ['已取消', ...ids, ...tenantFilter.params],
    );

    res.json({
      success: true,
      message: `成功取消 ${existing.length} 条闲置资产发布`,
      data: { count: existing.length },
    });

    // 记录审计日志
    logAudit(req, {
      action_type: 'BATCH_UPDATE',
      module: 'idle-asset',
      resource_type: 'idle_asset',
      resource_id: ids.join(','),
      action_description: `批量取消闲置资产发布 ${existing.length} 条`,
      new_value: { count: existing.length, status: '已取消' },
    }).catch(err => console.error('[审计日志] 记录批量取消失败:', err));
  } catch (error) {
    console.error('批量取消发布失败:', error);
    res.status(500).json({ success: false, message: '批量取消发布失败', error: error.message });
  }
});

// 批量删除闲置资产记录
router.delete('/batch', authenticate, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要删除的闲置资产' });
    }

    const tenantFilter = addTenantFilter(req, 'ia');
    const placeholders = ids.map(() => '?').join(',');

    // 验证记录存在
    const [existing] = await db.execute(
      `SELECT id, status FROM idle_assets ia WHERE ia.id IN (${placeholders}) ${tenantFilter.whereClause}`,
      [...ids, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '未找到匹配的闲置资产记录' });
    }

    // 只允许删除非"已分配"的记录
    const allocatedRecords = existing.filter(r => r.status === '已分配');
    if (allocatedRecords.length > 0) {
      return res.status(400).json({
        success: false,
        message: `有 ${allocatedRecords.length} 条已分配的记录不能删除`,
      });
    }

    const [result] = await db.execute(
      `DELETE ia FROM idle_assets ia WHERE ia.id IN (${placeholders}) ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [...ids, ...tenantFilter.params],
    );

    res.json({
      success: true,
      message: `成功删除 ${result.affectedRows} 条闲置资产记录`,
      data: { count: result.affectedRows },
    });

    // 记录审计日志
    logAudit(req, {
      action_type: 'BATCH_DELETE',
      module: 'idle-asset',
      resource_type: 'idle_asset',
      resource_id: ids.join(','),
      action_description: `批量删除闲置资产记录 ${result.affectedRows} 条`,
      new_value: { count: result.affectedRows },
    }).catch(err => console.error('[审计日志] 记录批量删除失败:', err));
  } catch (error) {
    console.error('批量删除闲置资产记录失败:', error);
    res.status(500).json({ success: false, message: '批量删除闲置资产记录失败', error: error.message });
  }
});

// 分配闲置资产
router.put('/:id/allocate', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { allocated_to, allocated_date } = req.body;

    // 验证记录是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ia');
    const [existing] = await db.execute(
      `SELECT id, asset_code, status FROM idle_assets ia WHERE ia.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '闲置资产记录不存在' });
    }

    if (existing[0].status !== '发布中') {
      return res.status(400).json({ success: false, message: '该资产已分配或已取消' });
    }

    // 使用事务更新闲置资产状态和资产状态
    await TransactionManager.executeTransaction(async connection => {
      // 更新闲置资产状态
      await connection.execute(
        `UPDATE idle_assets ia SET ia.status = ?, ia.allocated_to = ?, ia.allocated_date = ? WHERE ia.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
        [IDLE_STATUS.ALLOCATED, allocated_to, allocated_date, id, ...tenantFilter.params],
      );

      // 更新资产状态为在用（添加租户过滤）
      const assetTenantFilter = addTenantFilter(req, 'a');
      await connection.execute(
        `UPDATE assets a SET a.status = ? WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
        ['在用', existing[0].asset_code, ...assetTenantFilter.params],
      );
    });

    res.json({ success: true, message: '闲置资产分配成功' });

    // 记录审计日志
    logAudit(req, {
      action_type: 'UPDATE',
      module: 'idle-asset',
      resource_type: 'idle_asset',
      resource_id: String(id),
      resource_name: existing[0].asset_code,
      action_description: `分配闲置资产: ${existing[0].asset_code} → ${allocated_to}`,
      old_value: { status: '发布中' },
      new_value: { status: '已分配', allocated_to, allocated_date },
    }).catch(err => console.error('[审计日志] 记录闲置资产分配失败:', err));
  } catch (error) {
    console.error('分配闲置资产失败:', error);
    res.status(500).json({ success: false, message: '分配闲置资产失败', error: error.message });
  }
});

// 取消发布
router.put('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 验证记录是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ia');
    const [existing] = await db.execute(
      `SELECT id, status FROM idle_assets ia WHERE ia.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '闲置资产记录不存在' });
    }

    if (existing[0].status !== '发布中') {
      return res.status(400).json({ success: false, message: '只能取消发布中的记录' });
    }

    await db.execute(
      `UPDATE idle_assets ia SET ia.status = ? WHERE ia.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      ['已取消', id, ...tenantFilter.params],
    );

    res.json({ success: true, message: '发布已取消' });

    // 记录审计日志
    logAudit(req, {
      action_type: 'UPDATE',
      module: 'idle-asset',
      resource_type: 'idle_asset',
      resource_id: String(id),
      action_description: `取消闲置资产发布: #${id}`,
      old_value: { status: '发布中' },
      new_value: { status: '已取消' },
    }).catch(err => console.error('[审计日志] 记录闲置资产取消失败:', err));
  } catch (error) {
    console.error('取消发布失败:', error);
    res.status(500).json({ success: false, message: '取消发布失败', error: error.message });
  }
});

// 删除闲置资产发布记录
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 验证记录是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ia');
    const [existing] = await db.execute(
      `SELECT id FROM idle_assets ia WHERE ia.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '闲置资产记录不存在' });
    }

    const [result] = await db.execute(
      `DELETE ia FROM idle_assets ia WHERE ia.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [id, ...tenantFilter.params],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '闲置资产记录不存在' });
    }

    res.json({ success: true, message: '闲置资产记录删除成功' });

    // 记录审计日志
    logAudit(req, {
      action_type: 'DELETE',
      module: 'idle-asset',
      resource_type: 'idle_asset',
      resource_id: String(id),
      action_description: `删除闲置资产发布记录: #${id}`,
    }).catch(err => console.error('[审计日志] 记录闲置资产删除失败:', err));
  } catch (error) {
    console.error('删除闲置资产记录失败:', error);
    res.status(500).json({ success: false, message: '删除闲置资产记录失败', error: error.message });
  }
});

module.exports = router;
