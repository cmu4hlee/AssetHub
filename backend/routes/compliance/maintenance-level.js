/**
 * 分级保养管理路由
 * 符合《医学装备整体运维管理服务规范》要求
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate } = require('../../middleware/auth');
const { addTenantFilter, getTenantId } = require('../../middleware/tenant-filter');
const logger = require('../../config/logger');
const MAINTENANCE_TEMPLATE_USER_JOIN =
  'LEFT JOIN users u ON mlt.created_by = u.id AND u.tenant_id = mlt.tenant_id';

/**
 * 获取分级保养模板列表
 */
router.get('/templates', authenticate, async (req, res) => {
  try {
    const { maintenance_level, asset_category, status, page = 1, pageSize = 20 } = req.query;
    const tenantId = getTenantId(req);

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

    const tenantId = getTenantId(req);
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
 * 获取分级保养计划列表
 */
router.get('/plans', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const tenantId = getTenantId(req);

    // 首先检查表结构
    const [schemaRows] = await db.execute('SHOW COLUMNS FROM maintenance_level_plans');
    const columns = new Set(schemaRows.map(r => r.Field));

    // 动态选择字段
    const selectId = 'mlp.id';
    const selectPlanNo = columns.has('plan_no') ? 'mlp.plan_no' : (columns.has('plan_code') ? 'mlp.plan_code' : 'NULL AS plan_no');
    const selectPlanCode = columns.has('plan_code') ? 'mlp.plan_code' : (columns.has('plan_no') ? 'mlp.plan_no' : 'NULL AS plan_code');
    const selectAssetId = columns.has('asset_id') ? 'mlp.asset_id' : 'NULL AS asset_id';
    const selectLevel = columns.has('maintenance_level') ? 'mlp.maintenance_level' : 'NULL AS maintenance_level';
    const selectPlanDate = columns.has('plan_date') ? 'mlp.plan_date' : 'NULL AS plan_date';
    const selectActualDate = columns.has('actual_date') ? 'mlp.actual_date' : 'NULL AS actual_date';
    const selectStatus = columns.has('status') ? 'mlp.status' : "'pending' AS status";
    const selectExecutor = columns.has('executor_name') ? 'mlp.executor_name AS assigned_to_name' : (columns.has('executor_id') ? 'CAST(mlp.executor_id AS CHAR) AS assigned_to_name' : 'NULL AS assigned_to_name');
    const hasAssetJoin = columns.has('asset_id');

    let sql = `
      SELECT
        ${selectId},
        ${selectPlanNo},
        ${selectPlanCode},
        ${selectAssetId},
        ${selectLevel},
        ${selectPlanDate} AS planned_date,
        ${selectActualDate},
        ${selectStatus},
        ${selectExecutor},
        ${hasAssetJoin ? 'a.asset_name, a.asset_code' : 'NULL AS asset_name, NULL AS asset_code'}
      FROM maintenance_level_plans mlp
      ${hasAssetJoin ? 'LEFT JOIN assets a ON mlp.asset_id = a.id AND a.tenant_id = mlp.tenant_id' : ''}
      WHERE mlp.tenant_id = ?
    `;
    const params = [tenantId];

    if (status && columns.has('status')) {
      sql += ' AND mlp.status = ?';
      params.push(status);
    }

    const orderCol = columns.has('plan_date') ? 'mlp.plan_date' : 'mlp.id';
    sql += ` ORDER BY ${orderCol} DESC`;

    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const [plans] = await db.execute(sql, params);

    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM maintenance_level_plans WHERE tenant_id = ?';
    const countParams = [tenantId];
    if (status && columns.has('status')) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    const [countResult] = await db.execute(countSql, countParams);

    res.json({
      success: true,
      data: plans,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total,
      },
    });
  } catch (error) {
    logger.error('获取保养计划列表失败:', error);
    res.status(500).json({ success: false, message: '获取保养计划列表失败' });
  }
});

/**
 * 生成分级保养计划
 */
router.post('/plans/generate', authenticate, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const tenantId = getTenantId(req);
    const { asset_ids, start_date, months = 3 } = req.body;

    const generatedPlans = [];

    for (const assetId of asset_ids) {
      // 获取资产信息和风险等级
      const [assets] = await connection.execute(
        `SELECT a.*, arl.risk_level 
         FROM assets a
         LEFT JOIN asset_risk_levels arl ON a.id = arl.asset_id AND arl.tenant_id = ?
         WHERE a.id = ? AND a.tenant_id = ?`,
        [tenantId, assetId, tenantId],
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

          const [result] = await connection.execute(
            `INSERT INTO maintenance_level_plans (
              tenant_id, plan_no, asset_id, template_id, maintenance_level,
              plan_date, due_date, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
              tenantId, planNo, assetId, template.id, template.maintenance_level,
              planDate.toISOString().split('T')[0],
              dueDate.toISOString().split('T')[0],
            ],
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
          switch (template.cycle_type) {
            case 'day':
              currentDate.setDate(currentDate.getDate() + template.cycle_days);
              break;
            case 'week':
              currentDate.setDate(currentDate.getDate() + template.cycle_days);
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
