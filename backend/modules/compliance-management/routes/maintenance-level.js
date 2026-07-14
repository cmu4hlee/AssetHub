/**
 * 分级保养管理路由
 * 符合《医学装备整体运维管理服务规范》要求
 */

const express = require('express');
const router = express.Router();
const db = require('../../../config/database');
const { authenticate } = require('../../../middleware/auth');
const logger = require('../../../config/logger');
const MAINTENANCE_TEMPLATE_USER_JOIN =
  'LEFT JOIN users u ON mlt.created_by = u.id AND u.tenant_id = mlt.tenant_id';
const MAINTENANCE_PLAN_ASSET_JOIN =
  'LEFT JOIN assets a ON mlp.asset_id = a.id AND a.tenant_id = mlp.tenant_id';
const MAINTENANCE_PLAN_TEMPLATE_JOIN =
  'LEFT JOIN maintenance_level_templates mlt ON mlp.template_id = mlt.id AND mlt.tenant_id = mlp.tenant_id';

const TABLE_SCHEMA_CACHE_MS = 30 * 1000;
const tableSchemaCache = new Map();

function getEnumValues(columnType = '') {
  const matched = columnType.match(/^enum\((.*)\)$/i);
  if (!matched) return [];

  return matched[1]
    .split(',')
    .map(v => v.trim().replace(/^'(.*)'$/, '$1'))
    .filter(Boolean);
}

async function getTableSchema(tableName, connection = db) {
  const cached = tableSchemaCache.get(tableName);
  if (cached && Date.now() - cached.fetchedAt < TABLE_SCHEMA_CACHE_MS) {
    return cached;
  }

  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME, COLUMN_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );

  const schema = {
    columns: new Set(rows.map(row => row.COLUMN_NAME)),
    types: rows.reduce((acc, row) => {
      acc[row.COLUMN_NAME] = row.COLUMN_TYPE || '';
      return acc;
    }, {}),
    fetchedAt: Date.now(),
  };

  tableSchemaCache.set(tableName, schema);
  return schema;
}

/**
 * 获取分级保养模板列表
 */
router.get('/templates', authenticate, async (req, res) => {
  try {
    const { maintenance_level, asset_category, status, page = 1, pageSize = 20 } = req.query;
    const tenantId = req.user.tenant_id;

    let sql = `
      SELECT 
        mlt.*,
        u.username as created_by_name
      FROM maintenance_level_templates mlt
      ${MAINTENANCE_TEMPLATE_USER_JOIN}
      WHERE mlt.tenant_id = ?
    `;
    const params = [tenantId];

    if (maintenance_level) {
      sql += ' AND mlt.maintenance_level = ?';
      params.push(maintenance_level);
    }
    if (asset_category) {
      sql += ' AND mlt.asset_category = ?';
      params.push(asset_category);
    }
    if (status) {
      sql += ' AND mlt.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY mlt.maintenance_level, mlt.created_at DESC';

    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), parseInt(offset));

    const [templates] = await db.execute(sql, params);

    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM maintenance_level_templates WHERE tenant_id = ?';
    const countParams = [tenantId];
    if (maintenance_level) {
      countSql += ' AND maintenance_level = ?';
      countParams.push(maintenance_level);
    }
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    const [countResult] = await db.execute(countSql, countParams);

    res.json({
      success: true,
      data: templates.map(t => ({
        ...t,
        maintenance_items: typeof t.maintenance_items === 'string' ? JSON.parse(t.maintenance_items) : t.maintenance_items,
      })),
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total,
      },
    });
  } catch (error) {
    logger.error('获取保养模板列表失败:', error);
    res.status(500).json({ success: false, message: '获取保养模板列表失败' });
  }
});

/**
 * 创建分级保养模板
 */
router.post('/templates', authenticate, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const tenantId = req.user.tenant_id;
    const {
      template_code,
      template_name,
      maintenance_level,
      asset_category,
      asset_type,
      risk_level,
      cycle_days,
      cycle_type,
      maintenance_items,
      required_tools,
      required_materials,
      estimated_hours,
      standards,
      safety_requirements,
    } = req.body;

    // 检查编码是否重复
    const [existing] = await connection.execute(
      'SELECT id FROM maintenance_level_templates WHERE tenant_id = ? AND template_code = ?',
      [tenantId, template_code],
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '模板编码已存在' });
    }

    const [result] = await connection.execute(
      `INSERT INTO maintenance_level_templates (
        tenant_id, template_code, template_name, maintenance_level,
        asset_category, asset_type, risk_level, cycle_days, cycle_type,
        maintenance_items, required_tools, required_materials, estimated_hours,
        standards, safety_requirements, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, template_code, template_name, maintenance_level,
        asset_category, asset_type, risk_level, cycle_days, cycle_type,
        JSON.stringify(maintenance_items), required_tools, required_materials, estimated_hours,
        standards, safety_requirements, req.user.id,
      ],
    );

    await connection.commit();

    res.json({
      success: true,
      message: '保养模板创建成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    await connection.rollback();
    logger.error('创建保养模板失败:', error);
    res.status(500).json({ success: false, message: '创建保养模板失败' });
  } finally {
    connection.release();
  }
});

/**
 * 生成分级保养计划
 */
router.post('/plans/generate', authenticate, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const tenantId = req.user.tenant_id;
    const { asset_ids, start_date, months = 3 } = req.body;

    const planSchema = await getTableSchema('maintenance_level_plans', connection);
    const statusEnumValues = getEnumValues(planSchema.types.status);
    const defaultPlanStatus = statusEnumValues.includes('pending')
      ? 'pending'
      : (statusEnumValues.includes('planned') ? 'planned' : statusEnumValues[0]);
    const riskSchema = await getTableSchema('asset_risk_levels', connection);
    const hasRiskTable =
      riskSchema.columns.size > 0 &&
      riskSchema.columns.has('asset_id') &&
      riskSchema.columns.has('risk_level');

    const generatedPlans = [];

    for (const assetId of asset_ids) {
      // 获取资产信息和风险等级
      const [assets] = hasRiskTable
        ? await connection.execute(
            `SELECT a.*, arl.risk_level
             FROM assets a
             LEFT JOIN asset_risk_levels arl ON a.id = arl.asset_id AND arl.tenant_id = ?
             WHERE a.id = ? AND a.tenant_id = ?`,
            [tenantId, assetId, tenantId],
          )
        : await connection.execute(
            `SELECT a.*, NULL AS risk_level
             FROM assets a
             WHERE a.id = ? AND a.tenant_id = ?`,
            [assetId, tenantId],
          );

      if (assets.length === 0) continue;

      const asset = assets[0];
      const riskLevel = asset.risk_level || 'medium';

      // 获取适用的保养模板
      const [templates] = await connection.execute(
        `SELECT * FROM maintenance_level_templates
         WHERE tenant_id = ? AND status = 'active'
         AND (risk_level IS NULL OR risk_level = ? OR risk_level = '')
         ORDER BY maintenance_level`,
        [tenantId, riskLevel],
      );

      // 生成未来几个月的保养计划
      const startDate = new Date(start_date);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + months);

      for (const template of templates) {
        const currentDate = new Date(startDate);

        while (currentDate < endDate) {
          const planDate = new Date(currentDate);
          const dueDate = new Date(planDate);
          dueDate.setDate(dueDate.getDate() + 3);

          const planNo = `MLP${Date.now()}${Math.floor(Math.random() * 1000)}`;

          const insertFields = ['tenant_id', 'asset_id', 'maintenance_level', 'plan_date'];
          const insertValues = [
            tenantId,
            assetId,
            template.maintenance_level,
            planDate.toISOString().split('T')[0],
          ];

          if (planSchema.columns.has('plan_no')) {
            insertFields.push('plan_no');
            insertValues.push(planNo);
          } else if (planSchema.columns.has('plan_code')) {
            insertFields.push('plan_code');
            insertValues.push(planNo);
          }

          if (planSchema.columns.has('template_id')) {
            insertFields.push('template_id');
            insertValues.push(template.id);
          }

          if (planSchema.columns.has('due_date')) {
            insertFields.push('due_date');
            insertValues.push(dueDate.toISOString().split('T')[0]);
          }

          if (planSchema.columns.has('status') && defaultPlanStatus) {
            insertFields.push('status');
            insertValues.push(defaultPlanStatus);
          }

          if (planSchema.columns.has('created_by')) {
            insertFields.push('created_by');
            insertValues.push(req.user.id);
          }

          const [result] = await connection.execute(
            `INSERT INTO maintenance_level_plans (${insertFields.join(', ')})
             VALUES (${insertFields.map(() => '?').join(', ')})`,
            insertValues,
          );

          generatedPlans.push({
            id: result.insertId,
            plan_no: planNo,
            asset_id: assetId,
            asset_name: asset.asset_name,
            maintenance_level: template.maintenance_level,
            plan_date: planDate.toISOString().split('T')[0],
          });

          // 计算下一个计划日期
          const cycleType = template.cycle_type || 'day';
          const cycleDays = Math.max(1, Number(template.cycle_days) || 30);

          switch (cycleType) {
            case 'day':
              currentDate.setDate(currentDate.getDate() + cycleDays);
              break;
            case 'week':
              currentDate.setDate(currentDate.getDate() + cycleDays);
              break;
            case 'month':
              currentDate.setMonth(currentDate.getMonth() + 1);
              break;
            case 'quarter':
              currentDate.setMonth(currentDate.getMonth() + 3);
              break;
            case 'year':
              currentDate.setFullYear(currentDate.getFullYear() + 1);
              break;
            default:
              currentDate.setDate(currentDate.getDate() + cycleDays);
              break;
          }
        }
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: `成功生成 ${generatedPlans.length} 条保养计划`,
      data: generatedPlans,
    });
  } catch (error) {
    await connection.rollback();
    logger.error('生成保养计划失败:', error);
    res.status(500).json({ success: false, message: '生成保养计划失败' });
  } finally {
    connection.release();
  }
});

module.exports = router;

/**
 * 获取单个保养模板
 */
router.get('/templates/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenant_id;

    const [templates] = await db.execute(
      'SELECT * FROM maintenance_level_templates WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (templates.length === 0) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }

    const template = templates[0];
    template.maintenance_items = typeof template.maintenance_items === 'string'
      ? JSON.parse(template.maintenance_items)
      : template.maintenance_items;

    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('获取保养模板失败:', error);
    res.status(500).json({ success: false, message: '获取保养模板失败' });
  }
});

/**
 * 更新保养模板
 */
router.put('/templates/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenant_id;
    const updates = req.body;

    // 构建更新SQL
    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'tenant_id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(key === 'maintenance_items' ? JSON.stringify(updates[key]) : updates[key]);
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }

    values.push(id, tenantId);

    await db.execute(
      `UPDATE maintenance_level_templates SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values,
    );

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    logger.error('更新保养模板失败:', error);
    res.status(500).json({ success: false, message: '更新保养模板失败' });
  }
});

/**
 * 删除保养模板
 */
router.delete('/templates/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenant_id;

    await db.execute(
      'DELETE FROM maintenance_level_templates WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    logger.error('删除保养模板失败:', error);
    res.status(500).json({ success: false, message: '删除保养模板失败' });
  }
});

/**
 * 获取保养计划列表
 */
router.get('/plans', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, asset_id } = req.query;
    const tenantId = req.user.tenant_id;

    const planSchema = await getTableSchema('maintenance_level_plans');
    const statusEnumValues = getEnumValues(planSchema.types.status);
    const pendingStatusValue = statusEnumValues.includes('pending')
      ? 'pending'
      : (statusEnumValues.includes('planned') ? 'planned' : 'pending');

    const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
    const normalizedPageSize = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));

    const selectPlanNo = planSchema.columns.has('plan_no')
      ? 'mlp.plan_no'
      : (planSchema.columns.has('plan_code') ? 'mlp.plan_code AS plan_no' : "CONCAT('MLP-', mlp.id) AS plan_no");
    const selectPlanCode = planSchema.columns.has('plan_code')
      ? 'mlp.plan_code'
      : (planSchema.columns.has('plan_no') ? 'mlp.plan_no' : "CONCAT('MLP-', mlp.id)");
    const selectPlanDate = planSchema.columns.has('plan_date') ? 'mlp.plan_date' : 'NULL';
    const selectActualDate = planSchema.columns.has('actual_date') ? 'mlp.actual_date' : 'NULL';
    const selectStatus = planSchema.columns.has('status')
      ? 'CASE WHEN mlp.status = \'planned\' THEN \'pending\' ELSE mlp.status END AS status'
      : "'pending' AS status";
    const selectAssignee = planSchema.columns.has('executor_name')
      ? 'mlp.executor_name AS assigned_to_name'
      : (planSchema.columns.has('executor_id') ? 'CAST(mlp.executor_id AS CHAR) AS assigned_to_name' : 'NULL AS assigned_to_name');
    const orderColumn = planSchema.columns.has('plan_date') ? 'mlp.plan_date' : 'mlp.id';
    const hasTemplateRef = planSchema.columns.has('template_id');

    let sql = `
      SELECT
        mlp.id,
        ${selectPlanNo},
        ${selectPlanCode} AS plan_code,
        mlp.asset_id,
        mlp.maintenance_level,
        ${selectPlanDate} AS plan_date,
        ${selectPlanDate} AS planned_date,
        ${selectActualDate} AS actual_date,
        ${selectStatus},
        ${selectAssignee},
        a.asset_name,
        a.asset_code,
        ${hasTemplateRef ? 'mlt.template_name' : 'NULL AS template_name'}
      FROM maintenance_level_plans mlp
      ${MAINTENANCE_PLAN_ASSET_JOIN}
      ${hasTemplateRef ? MAINTENANCE_PLAN_TEMPLATE_JOIN : ''}
      WHERE 1 = 1
    `;
    const params = [];

    if (planSchema.columns.has('tenant_id')) {
      sql += ' AND mlp.tenant_id = ?';
      params.push(tenantId);
    }

    if (status && planSchema.columns.has('status')) {
      const normalizedStatus = status === 'pending' ? pendingStatusValue : status;
      sql += ' AND mlp.status = ?';
      params.push(normalizedStatus);
    }

    if (asset_id && planSchema.columns.has('asset_id')) {
      sql += ' AND mlp.asset_id = ?';
      params.push(asset_id);
    }

    sql += ` ORDER BY ${orderColumn} DESC`;
    sql += ' LIMIT ? OFFSET ?';
    params.push(normalizedPageSize, (normalizedPage - 1) * normalizedPageSize);

    const [plans] = await db.execute(sql, params);

    res.json({ success: true, data: plans });
  } catch (error) {
    logger.error('获取保养计划列表失败:', error);
    res.status(500).json({ success: false, message: '获取保养计划列表失败' });
  }
});

/**
 * 仪表板统计数据
 */
router.get('/dashboard-stats', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    // 保养统计
    const [maintenanceStats] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM maintenance_level_plans
      WHERE tenant_id = ?
    `, [tenantId]);

    // 特种设备统计
    const [equipmentStats] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN safety_status = 'normal' THEN 1 ELSE 0 END) as normal,
        SUM(CASE WHEN safety_status = 'expiring' THEN 1 ELSE 0 END) as expiring,
        SUM(CASE WHEN safety_status = 'expired' THEN 1 ELSE 0 END) as expired
      FROM special_equipment
      WHERE tenant_id = ? AND status = 'in_use'
    `, [tenantId]);

    // 安全检测统计
    const [inspectionStats] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN inspection_result = 'pass' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN inspection_result = 'fail' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN inspection_result = 'conditional' THEN 1 ELSE 0 END) as pending
      FROM safety_inspections
      WHERE tenant_id = ?
    `, [tenantId]);

    res.json({
      success: true,
      data: {
        maintenance: maintenanceStats[0],
        specialEquipment: equipmentStats[0],
        safetyInspection: inspectionStats[0],
      },
    });
  } catch (error) {
    logger.error('获取仪表板统计数据失败:', error);
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
});
