/**
 * 特种设备管理路由
 * 符合《医学装备整体运维管理服务规范》要求
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate } = require('../../middleware/auth');
const { addTenantFilter, getTenantId } = require('../../middleware/tenant-filter');
const logger = require('../../config/logger');

const COMPLIANCE_SPECIAL_EQUIPMENT_ASSET_JOIN =
  'LEFT JOIN assets a ON se.asset_id = a.id AND a.tenant_id = se.tenant_id';
const COMPLIANCE_SPECIAL_EQUIPMENT_INSPECTION_JOIN =
  'LEFT JOIN special_equipment se ON sei.equipment_id = se.id AND se.tenant_id = sei.tenant_id';
const COMPLIANCE_SPECIAL_EQUIPMENT_INSPECTION_ASSET_JOIN =
  'LEFT JOIN assets a ON se.asset_id = a.id AND a.tenant_id = se.tenant_id';

async function hasTenantAsset(assetId, tenantId, executor = db) {
  if (!assetId) {
    return false;
  }
  const [rows] = await executor.execute(
    'SELECT id FROM assets WHERE id = ? AND tenant_id = ? LIMIT 1',
    [assetId, tenantId],
  );
  return rows.length > 0;
}

async function hasTenantEquipment(equipmentId, tenantId, executor = db) {
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
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { equipment_type, use_status, inspection_status, page = 1, pageSize = 20 } = req.query;
    const tenantId = getTenantId(req);

    let sql = `
      SELECT 
        se.*,
        a.asset_code,
        a.asset_name,
        a.department,
        a.location,
        DATEDIFF(se.next_inspection_date, CURDATE()) as days_until_inspection
      FROM special_equipment se
      ${COMPLIANCE_SPECIAL_EQUIPMENT_ASSET_JOIN}
      WHERE se.tenant_id = ?
    `;
    const params = [tenantId];

    if (equipment_type) {
      sql += ' AND se.equipment_type = ?';
      params.push(equipment_type);
    }
    if (use_status) {
      sql += ' AND se.status = ?';
      params.push(use_status);
    }

    sql += ' ORDER BY se.next_inspection_date ASC';

    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), parseInt(offset));

    const [equipment] = await db.execute(sql, params);

    res.json({
      success: true,
      data: equipment.map(e => ({
        ...e,
        safety_valve_info: e.safety_valve_info ? JSON.parse(e.safety_valve_info) : null,
        pressure_gauge_info: e.pressure_gauge_info ? JSON.parse(e.pressure_gauge_info) : null,
      })),
    });
  } catch (error) {
    logger.error('获取特种设备列表失败:', error);
    res.status(500).json({ success: false, message: '获取特种设备列表失败' });
  }
});

/**
 * 添加特种设备
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const {
      asset_id,
      equipment_type,
      equipment_category,
      registration_no,
      registration_date,
      registrant,
      manufacturer_license_no,
      product_serial_no,
      manufacturing_date,
      first_inspection_date,
      inspection_cycle_months,
      next_inspection_date,
      safety_manager,
      operator_certificate_no,
      remarks,
    } = req.body;

    if (!(await hasTenantAsset(asset_id, tenantId))) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const [result] = await db.execute(
      `INSERT INTO special_equipment (
        tenant_id, asset_id, equipment_type, equipment_category,
        registration_no, registration_date, registrant,
        manufacturer_license_no, product_serial_no, manufacturing_date,
        first_inspection_date, inspection_cycle_months, next_inspection_date,
        safety_manager, operator_certificate_no, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, asset_id, equipment_type, equipment_category,
        registration_no, registration_date, registrant,
        manufacturer_license_no, product_serial_no, manufacturing_date,
        first_inspection_date, inspection_cycle_months, next_inspection_date,
        safety_manager, operator_certificate_no, remarks, req.user.id,
      ],
    );

    res.json({
      success: true,
      message: '特种设备添加成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    logger.error('添加特种设备失败:', error);
    res.status(500).json({ success: false, message: '添加特种设备失败' });
  }
});

/**
 * 更新特种设备信息
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const updates = req.body;

    const allowedFields = [
      'equipment_category', 'registration_no', 'registration_date', 'registrant',
      'manufacturer_license_no', 'product_serial_no', 'manufacturing_date',
      'inspection_cycle_months', 'next_inspection_date', 'status',
      'safety_manager', 'operator_certificate_no', 'remarks',
    ];

    const fields = [];
    const values = [];

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }

    values.push(id, tenantId);

    await db.execute(
      `UPDATE special_equipment SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values,
    );

    res.json({ success: true, message: '特种设备信息更新成功' });
  } catch (error) {
    logger.error('更新特种设备失败:', error);
    res.status(500).json({ success: false, message: '更新特种设备失败' });
  }
});

/**
 * 获取特种设备检验记录
 */
router.get('/inspections', authenticate, async (req, res) => {
  try {
    const { equipment_id, inspection_type, page = 1, pageSize = 20 } = req.query;
    const tenantId = getTenantId(req);

    let sql = `
      SELECT 
        sei.*,
        se.equipment_type,
        a.asset_code,
        a.asset_name
      FROM special_equipment_inspections sei
      ${COMPLIANCE_SPECIAL_EQUIPMENT_INSPECTION_JOIN}
      ${COMPLIANCE_SPECIAL_EQUIPMENT_INSPECTION_ASSET_JOIN}
      WHERE sei.tenant_id = ?
    `;
    const params = [tenantId];

    if (equipment_id) {
      sql += ' AND sei.equipment_id = ?';
      params.push(equipment_id);
    }
    if (inspection_type) {
      sql += ' AND sei.inspection_type = ?';
      params.push(inspection_type);
    }

    sql += ' ORDER BY sei.inspection_date DESC';

    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), parseInt(offset));

    const [inspections] = await db.execute(sql, params);

    res.json({
      success: true,
      data: inspections.map(i => ({
        ...i,
        inspection_items: i.inspection_items ? JSON.parse(i.inspection_items) : null,
      })),
    });
  } catch (error) {
    logger.error('获取检验记录失败:', error);
    res.status(500).json({ success: false, message: '获取检验记录失败' });
  }
});

/**
 * 添加检验记录
 */
router.post('/inspections', authenticate, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const tenantId = getTenantId(req);
    const {
      equipment_id,
      inspection_type,
      inspection_date,
      inspection_agency,
      inspector,
      inspection_items,
      inspection_content,
      inspection_result,
      issues_found,
      rectification_measures,
      rectification_deadline,
      certificate_no,
      certificate_image,
      next_inspection_date,
      remarks,
    } = req.body;

    if (!(await hasTenantEquipment(equipment_id, tenantId, connection))) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '特种设备不存在' });
    }

    // 添加检验记录
    const [result] = await connection.execute(
      `INSERT INTO special_equipment_inspections (
        tenant_id, equipment_id, inspection_type, inspection_date,
        inspection_agency, inspector, inspection_items, inspection_content,
        inspection_result, issues_found, rectification_measures, rectification_deadline,
        certificate_no, certificate_image, next_inspection_date, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, equipment_id, inspection_type, inspection_date,
        inspection_agency, inspector, JSON.stringify(inspection_items), inspection_content,
        inspection_result, issues_found, rectification_measures, rectification_deadline,
        certificate_no, certificate_image, next_inspection_date, remarks, req.user.id,
      ],
    );

    // 更新特种设备的检验信息
    await connection.execute(
      `UPDATE special_equipment 
       SET last_inspection_date = ?,
           next_inspection_date = ?,
           inspection_result = ?,
           inspection_certificate_no = ?
       WHERE id = ? AND tenant_id = ?`,
      [inspection_date, next_inspection_date, inspection_result, certificate_no, equipment_id, tenantId],
    );

    await connection.commit();

    res.json({
      success: true,
      message: '检验记录添加成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    await connection.rollback();
    logger.error('添加检验记录失败:', error);
    res.status(500).json({ success: false, message: '添加检验记录失败' });
  } finally {
    connection.release();
  }
});

/**
 * 获取即将到期的检验
 */
router.get('/expiring-inspections', authenticate, async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const tenantId = getTenantId(req);

    const [equipment] = await db.execute(
      `SELECT 
        se.*,
        a.asset_code,
        a.asset_name,
        a.department,
        DATEDIFF(se.next_inspection_date, CURDATE()) as days_until_inspection
      FROM special_equipment se
      ${COMPLIANCE_SPECIAL_EQUIPMENT_ASSET_JOIN}
      WHERE se.tenant_id = ? AND se.status = 'in_use'
      AND se.next_inspection_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY se.next_inspection_date ASC`,
      [tenantId, parseInt(days)],
    );

    res.json({ success: true, data: equipment });
  } catch (error) {
    logger.error('获取到期检验失败:', error);
    res.status(500).json({ success: false, message: '获取到期检验失败' });
  }
});

/**
 * 获取特种设备统计
 */
router.get('/statistics/overview', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    // 按类型统计
    const [typeStats] = await db.execute(
      `SELECT 
        equipment_type,
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'in_use' THEN 1 ELSE 0 END) as in_use_count
      FROM special_equipment
      WHERE tenant_id = ?
      GROUP BY equipment_type`,
      [tenantId],
    );

    // 检验状态统计
    const [inspectionStats] = await db.execute(
      `SELECT 
        SUM(CASE WHEN next_inspection_date > CURDATE() THEN 1 ELSE 0 END) as normal_count,
        SUM(CASE WHEN next_inspection_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) AND next_inspection_date > CURDATE() THEN 1 ELSE 0 END) as expiring_count,
        SUM(CASE WHEN next_inspection_date <= CURDATE() THEN 1 ELSE 0 END) as expired_count
      FROM special_equipment
      WHERE tenant_id = ? AND status = 'in_use'`,
      [tenantId],
    );

    // 即将到期的数量
    const [expiringCount] = await db.execute(
      `SELECT COUNT(*) as count
      FROM special_equipment
      WHERE tenant_id = ? AND status = 'in_use'
      AND next_inspection_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)`,
      [tenantId],
    );

    res.json({
      success: true,
      data: {
        type_statistics: typeStats,
        inspection_status: inspectionStats[0],
        expiring_count: expiringCount[0].count,
      },
    });
  } catch (error) {
    logger.error('获取特种设备统计失败:', error);
    res.status(500).json({ success: false, message: '获取特种设备统计失败' });
  }
});

module.exports = router;
