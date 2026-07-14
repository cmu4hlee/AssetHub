/**
 * 人员资质管理路由
 * 符合《医学装备整体运维管理服务规范》要求
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate } = require('../../middleware/auth');
const { addTenantFilter, getTenantId } = require('../../middleware/tenant-filter');
const logger = require('../../config/logger');
const STAFF_QUALIFICATION_USER_JOIN =
  'LEFT JOIN users u ON sq.user_id = u.id AND u.tenant_id = sq.tenant_id';
const STAFF_TRAINING_USER_JOIN =
  'LEFT JOIN users u ON str.user_id = u.id AND u.tenant_id = str.tenant_id';

async function hasTenantUser(userId, tenantId, executor = db) {
  if (!userId) {
    return false;
  }
  const [rows] = await executor.execute(
    'SELECT id FROM users WHERE id = ? AND tenant_id = ? LIMIT 1',
    [userId, tenantId],
  );
  return rows.length > 0;
}

/**
 * 人员资质管理API信息
 */
router.get('/', authenticate, (req, res) => {
  res.json({
    success: true,
    message: '人员资质管理API',
    endpoints: {
      qualifications: '/api/compliance/staff/qualifications',
      'training-records': '/api/compliance/staff/training-records',
    },
  });
});

/**
 * 获取人员资质列表
 */
router.get('/qualifications', authenticate, async (req, res) => {
  try {
    const { user_id, qualification_type, status, page = 1, pageSize = 20 } = req.query;
    const tenantId = getTenantId(req);

    let sql = `
      SELECT 
        sq.*,
        u.username,
        u.real_name,
        u.department_code,
        DATEDIFF(sq.expiry_date, CURDATE()) as days_until_expiry
      FROM staff_qualifications sq
      ${STAFF_QUALIFICATION_USER_JOIN}
      WHERE sq.tenant_id = ?
    `;
    const params = [tenantId];

    if (user_id) {
      sql += ' AND sq.user_id = ?';
      params.push(user_id);
    }
    if (qualification_type) {
      sql += ' AND sq.qualification_type = ?';
      params.push(qualification_type);
    }
    if (status) {
      sql += ' AND sq.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY sq.expiry_date ASC';

    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), parseInt(offset));

    const [qualifications] = await db.execute(sql, params);

    res.json({
      success: true,
      data: qualifications.map(q => ({
        ...q,
        attachments: q.attachments ? JSON.parse(q.attachments) : null,
      })),
    });
  } catch (error) {
    logger.error('获取人员资质列表失败:', error);
    res.status(500).json({ success: false, message: '获取人员资质列表失败' });
  }
});

/**
 * 添加人员资质
 */
router.post('/qualifications', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const {
      user_id,
      qualification_type,
      qualification_name,
      qualification_level,
      certificate_no,
      issuing_authority,
      issue_date,
      expiry_date,
      professional_field,
      applicable_equipment,
      certificate_image,
      attachments,
      remarks,
    } = req.body;

    if (!(await hasTenantUser(user_id, tenantId))) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const [result] = await db.execute(
      `INSERT INTO staff_qualifications (
        tenant_id, user_id, qualification_type, qualification_name, qualification_level,
        certificate_no, issuing_authority, issue_date, expiry_date,
        professional_field, applicable_equipment, certificate_image, attachments, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, user_id, qualification_type, qualification_name, qualification_level,
        certificate_no, issuing_authority, issue_date, expiry_date,
        professional_field, applicable_equipment, certificate_image,
        JSON.stringify(attachments), remarks, req.user.id,
      ],
    );

    res.json({
      success: true,
      message: '资质添加成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    logger.error('添加人员资质失败:', error);
    res.status(500).json({ success: false, message: '添加人员资质失败' });
  }
});

/**
 * 获取即将到期的资质
 */
router.get('/qualifications/expiring', authenticate, async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const tenantId = getTenantId(req);

    const [qualifications] = await db.execute(
      `SELECT 
        sq.*,
        u.username,
        u.real_name,
        DATEDIFF(sq.expiry_date, CURDATE()) as days_until_expiry
      FROM staff_qualifications sq
      ${STAFF_QUALIFICATION_USER_JOIN}
      WHERE sq.tenant_id = ? AND sq.status = 'active'
      AND sq.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY sq.expiry_date ASC`,
      [tenantId, parseInt(days)],
    );

    res.json({ success: true, data: qualifications });
  } catch (error) {
    logger.error('获取到期资质失败:', error);
    res.status(500).json({ success: false, message: '获取到期资质失败' });
  }
});

/**
 * 获取培训记录列表
 */
router.get('/training-records', authenticate, async (req, res) => {
  try {
    const { user_id, training_type, start_date, end_date, page = 1, pageSize = 20 } = req.query;
    const tenantId = getTenantId(req);

    let sql = `
      SELECT 
        str.*,
        u.username,
        u.real_name
      FROM staff_training_records str
      ${STAFF_TRAINING_USER_JOIN}
      WHERE str.tenant_id = ?
    `;
    const params = [tenantId];

    if (user_id) {
      sql += ' AND str.user_id = ?';
      params.push(user_id);
    }
    if (training_type) {
      sql += ' AND str.training_type = ?';
      params.push(training_type);
    }
    if (start_date) {
      sql += ' AND str.training_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND str.training_date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY str.training_date DESC';

    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), parseInt(offset));

    const [records] = await db.execute(sql, params);

    res.json({
      success: true,
      data: records.map(r => ({
        ...r,
        attachments: r.attachments ? JSON.parse(r.attachments) : null,
      })),
    });
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        success: true,
        data: [],
        module_uninitialized: true,
      });
    }
    logger.error('获取培训记录失败:', error);
    res.status(500).json({ success: false, message: '获取培训记录失败' });
  }
});

/**
 * 添加培训记录
 */
router.post('/training-records', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const {
      user_id,
      training_type,
      training_name,
      training_content,
      training_method,
      training_date,
      training_duration,
      training_location,
      trainer,
      assessment_required,
      assessment_score,
      assessment_result,
      certificate_no,
      related_equipment,
      attachments,
      remarks,
    } = req.body;

    if (!(await hasTenantUser(user_id, tenantId))) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const [result] = await db.execute(
      `INSERT INTO staff_training_records (
        tenant_id, user_id, training_type, training_name, training_content, training_method,
        training_date, training_duration, training_location, trainer,
        assessment_required, assessment_score, assessment_result, certificate_no,
        related_equipment, attachments, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, user_id, training_type, training_name, training_content, training_method,
        training_date, training_duration, training_location, trainer,
        assessment_required, assessment_score, assessment_result, certificate_no,
        related_equipment, JSON.stringify(attachments), remarks, req.user.id,
      ],
    );

    res.json({
      success: true,
      message: '培训记录添加成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    logger.error('添加培训记录失败:', error);
    res.status(500).json({ success: false, message: '添加培训记录失败' });
  }
});

/**
 * 获取人员资质统计
 */
router.get('/statistics', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    // 资质类型统计
    const [typeStats] = await db.execute(
      `SELECT 
        qualification_type,
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) AND status = 'active' THEN 1 ELSE 0 END) as expiring_count
      FROM staff_qualifications
      WHERE tenant_id = ?
      GROUP BY qualification_type`,
      [tenantId],
    );

    // 培训统计
    let trainingStats = [];
    try {
      const [rows] = await db.execute(
        `SELECT 
          training_type,
          COUNT(*) as total_count,
          SUM(training_duration) as total_hours
        FROM staff_training_records
        WHERE tenant_id = ? AND training_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
        GROUP BY training_type`,
        [tenantId],
      );
      trainingStats = rows;
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE') {
        throw error;
      }
    }

    // 即将到期的资质数量
    const [expiringCount] = await db.execute(
      `SELECT COUNT(*) as count
      FROM staff_qualifications
      WHERE tenant_id = ? AND status = 'active'
      AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)`,
      [tenantId],
    );

    // 已过期资质数量
    const [expiredCount] = await db.execute(
      `SELECT COUNT(*) as count
      FROM staff_qualifications
      WHERE tenant_id = ? AND status = 'expired'`,
      [tenantId],
    );

    res.json({
      success: true,
      data: {
        qualification_type_stats: typeStats,
        training_stats: trainingStats,
        expiring_count: expiringCount[0].count,
        expired_count: expiredCount[0].count,
      },
    });
  } catch (error) {
    logger.error('获取资质统计失败:', error);
    res.status(500).json({ success: false, message: '获取资质统计失败' });
  }
});

module.exports = router;
