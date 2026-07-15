/**
 * 安全检测管理路由（电气安全、辐射安全等）
 * 符合《医学装备整体运维管理服务规范》要求
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate } = require('../../middleware/auth');
const { getTenantId } = require('../../middleware/tenant-filter');
const logger = require('../../config/logger');

const COMPLIANCE_SAFETY_INSPECTION_ASSET_JOIN =
  'LEFT JOIN assets a ON si.asset_id = a.id AND a.tenant_id = si.tenant_id AND a.is_deleted = 0';

async function hasTenantAsset(assetId, tenantId) {
  if (!assetId) {
    return false;
  }
  const [rows] = await db.execute(
    'SELECT id FROM assets WHERE id = ? AND tenant_id = ? LIMIT 1',
    [assetId, tenantId],
  );
  return rows.length > 0;
}

/**
 * 获取安全检测记录列表
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { inspection_type, inspection_result, risk_level, page = 1, pageSize = 20 } = req.query;
    const tenantId = getTenantId(req);

    let sql = `
      SELECT 
        si.*,
        a.asset_code,
        a.asset_name,
        COALESCE(a.department_new, a.department) as department,
        ac.name as asset_type,
        DATEDIFF(si.next_inspection_date, CURDATE()) as days_until_next
      FROM safety_inspections si
      ${COMPLIANCE_SAFETY_INSPECTION_ASSET_JOIN}
      LEFT JOIN asset_categories ac ON a.category_id = ac.id
      WHERE si.tenant_id = ?
    `;
    const params = [tenantId];

    if (inspection_type) {
      sql += ' AND si.inspection_type = ?';
      params.push(inspection_type);
    }
    if (inspection_result) {
      sql += ' AND si.inspection_result = ?';
      params.push(inspection_result);
    }
    if (risk_level) {
      sql += ' AND si.risk_level = ?';
      params.push(risk_level);
    }

    sql += ' ORDER BY si.inspection_date DESC';

    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), parseInt(offset));

    const [inspections] = await db.execute(sql, params);

    res.json({
      success: true,
      data: inspections.map(i => ({
        ...i,
        inspection_items: i.inspection_items ? JSON.parse(i.inspection_items) : null,
        inspection_data: i.inspection_data ? JSON.parse(i.inspection_data) : null,
      })),
    });
  } catch (error) {
    logger.error('获取安全检测记录失败:', error);
    res.status(500).json({ success: false, message: '获取安全检测记录失败' });
  }
});

/**
 * 添加安全检测记录
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const {
      asset_id,
      inspection_type,
      inspection_category,
      inspection_name,
      inspection_standard,
      standard_code,
      inspection_date,
      inspection_cycle_months,
      next_inspection_date,
      inspection_agency,
      inspector,
      inspection_result,
      inspection_items,
      inspection_data,
      issues_found,
      risk_level,
      rectification_required,
      rectification_measures,
      rectification_deadline,
      certificate_no,
      certificate_image,
      report_file,
      remarks,
    } = req.body;

    if (!(await hasTenantAsset(asset_id, tenantId))) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const [result] = await db.execute(
      `INSERT INTO safety_inspections (
        tenant_id, asset_id, inspection_type, inspection_category, inspection_name,
        inspection_standard, standard_code, inspection_date, inspection_cycle_months,
        next_inspection_date, inspection_agency, inspector, inspection_result,
        inspection_items, inspection_data, issues_found, risk_level,
        rectification_required, rectification_measures, rectification_deadline,
        certificate_no, certificate_image, report_file, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, asset_id, inspection_type, inspection_category, inspection_name,
        inspection_standard, standard_code, inspection_date, inspection_cycle_months,
        next_inspection_date, inspection_agency, inspector, inspection_result,
        JSON.stringify(inspection_items), JSON.stringify(inspection_data), issues_found, risk_level,
        rectification_required, rectification_measures, rectification_deadline,
        certificate_no, certificate_image, report_file, remarks, req.user.id,
      ],
    );

    res.json({
      success: true,
      message: '安全检测记录添加成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    logger.error('添加安全检测记录失败:', error);
    res.status(500).json({ success: false, message: '添加安全检测记录失败' });
  }
});

/**
 * 更新整改信息
 */
router.put('/:id/rectification', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const {
      rectification_completed_date,
      rectification_result,
    } = req.body;

    await db.execute(
      `UPDATE safety_inspections 
       SET rectification_completed_date = ?,
           rectification_result = ?
       WHERE id = ? AND tenant_id = ?`,
      [rectification_completed_date, rectification_result, id, tenantId],
    );

    res.json({ success: true, message: '整改信息更新成功' });
  } catch (error) {
    logger.error('更新整改信息失败:', error);
    res.status(500).json({ success: false, message: '更新整改信息失败' });
  }
});

/**
 * 获取即将到期的检测
 */
router.get('/expiring', authenticate, async (req, res) => {
  try {
    const { days = 90, inspection_type } = req.query;
    const tenantId = getTenantId(req);

    let sql = `
      SELECT 
        si.*,
        a.asset_code,
        a.asset_name,
        a.department,
        DATEDIFF(si.next_inspection_date, CURDATE()) as days_until_next
      FROM safety_inspections si
      ${COMPLIANCE_SAFETY_INSPECTION_ASSET_JOIN}
      WHERE si.tenant_id = ?
      AND si.next_inspection_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      AND si.next_inspection_date > CURDATE()
    `;
    const params = [tenantId, parseInt(days)];

    if (inspection_type) {
      sql += ' AND si.inspection_type = ?';
      params.push(inspection_type);
    }

    sql += ' ORDER BY si.next_inspection_date ASC';

    const [inspections] = await db.execute(sql, params);

    res.json({ success: true, data: inspections });
  } catch (error) {
    logger.error('获取到期检测失败:', error);
    res.status(500).json({ success: false, message: '获取到期检测失败' });
  }
});

/**
 * 获取安全检测统计
 */
router.get('/statistics/overview', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    // 按类型统计
    const [typeStats] = await db.execute(
      `SELECT 
        inspection_type,
        COUNT(*) as total_count,
        SUM(CASE WHEN inspection_result = 'qualified' THEN 1 ELSE 0 END) as qualified_count,
        SUM(CASE WHEN inspection_result = 'unqualified' THEN 1 ELSE 0 END) as unqualified_count
      FROM safety_inspections
      WHERE tenant_id = ?
      GROUP BY inspection_type`,
      [tenantId],
    );

    // 风险等级统计
    const [riskStats] = await db.execute(
      `SELECT 
        risk_level,
        COUNT(*) as count
      FROM safety_inspections
      WHERE tenant_id = ? AND risk_level IS NOT NULL
      GROUP BY risk_level`,
      [tenantId],
    );

    // 即将到期的数量
    const [expiringCount] = await db.execute(
      `SELECT COUNT(*) as count
      FROM safety_inspections
      WHERE tenant_id = ?
      AND next_inspection_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
      AND next_inspection_date > CURDATE()`,
      [tenantId],
    );

    // 需要整改的数量
    const [rectificationCount] = await db.execute(
      `SELECT COUNT(*) as count
      FROM safety_inspections
      WHERE tenant_id = ? AND rectification_required = TRUE
      AND rectification_completed_date IS NULL`,
      [tenantId],
    );

    res.json({
      success: true,
      data: {
        type_statistics: typeStats,
        risk_statistics: riskStats,
        expiring_count: expiringCount[0].count,
        pending_rectification_count: rectificationCount[0].count,
      },
    });
  } catch (error) {
    logger.error('获取安全检测统计失败:', error);
    res.status(500).json({ success: false, message: '获取安全检测统计失败' });
  }
});

module.exports = router;
