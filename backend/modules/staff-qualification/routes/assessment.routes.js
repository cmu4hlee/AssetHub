/**
 * 考核管理路由
 */

const express = require('express');
const router = express.Router();
const db = require('../../../config/database');
const { authenticate } = require('../../../middleware/auth');

const tableExistsCache = new Map();

const tableExists = async tableName => {
  if (tableExistsCache.has(tableName)) {
    return tableExistsCache.get(tableName);
  }
  const [rows] = await db.execute(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?
     LIMIT 1`,
    [tableName],
  );
  const exists = rows.length > 0;
  tableExistsCache.set(tableName, exists);
  return exists;
};

const resolveAssessmentTable = async () => {
  if (await tableExists('assessment_records')) {
    return 'assessment_records';
  }
  return 'staff_assessment_records';
};

const toDbResult = (score, result) => {
  const normalized = String(result || '').toLowerCase();
  if (normalized === 'excellent') {
    return 'excellent';
  }
  if (['good', 'qualified', 'pass'].includes(normalized)) {
    return 'pass';
  }
  if (['unqualified', 'fail'].includes(normalized)) {
    return 'fail';
  }

  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return 'pass';
  }
  if (numericScore >= 90) {
    return 'excellent';
  }
  if (numericScore >= 60) {
    return 'pass';
  }
  return 'fail';
};

const toUiResult = (score, dbResult) => {
  const normalized = String(dbResult || '').toLowerCase();
  if (['excellent', 'good', 'qualified', 'unqualified'].includes(normalized)) {
    return normalized;
  }
  if (normalized === 'pass') {
    return Number(score) >= 80 ? 'good' : 'qualified';
  }
  if (normalized === 'fail') {
    return 'unqualified';
  }
  if (Number(score) >= 90) {
    return 'excellent';
  }
  if (Number(score) >= 80) {
    return 'good';
  }
  if (Number(score) >= 60) {
    return 'qualified';
  }
  return 'unqualified';
};

// 获取考核记录
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveAssessmentTable();
    const { page = 1, pageSize = 20, assessment_type } = req.query;

    let sql = `
      SELECT
        ar.*,
        u.username,
        u.real_name
      FROM ${tableName} ar
      LEFT JOIN users u ON ar.user_id = u.id
      WHERE ar.tenant_id = ?
    `;
    const params = [tenantId];

    if (assessment_type) {
      sql += ' AND ar.assessment_type = ?';
      params.push(assessment_type);
    }

    sql += ' ORDER BY ar.id DESC LIMIT ? OFFSET ?';
    params.push(
      parseInt(pageSize, 10),
      (parseInt(page, 10) - 1) * parseInt(pageSize, 10),
    );

    const [rows] = await db.execute(sql, params);

    res.json({
      success: true,
      data: rows.map(item => ({
        ...item,
        assessment_code:
          item.assessment_code ||
          `AS-${String(item.id).padStart(6, '0')}`,
        staff_name: item.staff_name || item.real_name || item.username || '',
        examiner_name:
          item.examiner_name ||
          item.evaluator_name ||
          item.evaluator ||
          '',
        result: toUiResult(item.score, item.result),
        status: item.status || 'completed',
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建考核记录
router.post('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveAssessmentTable();
    const {
      staff_id,
      assessment_name,
      assessment_type,
      assessment_date,
      score,
      result,
      examiner_id,
      feedback,
      status,
    } = req.body;

    if (!staff_id && !req.body.user_id) {
      return res.status(400).json({ success: false, message: 'staff_id 不能为空' });
    }

    const normalizedStaffId = staff_id || req.body.user_id;
    const normalizedResult = toDbResult(score, result);

    if (tableName === 'assessment_records') {
      const [insertResult] = await db.execute(
        `INSERT INTO assessment_records (
           tenant_id, user_id, assessment_name, assessment_type, assessment_date,
           score, result, evaluator_id, comments, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          tenantId,
          normalizedStaffId,
          assessment_name || '能力考核',
          assessment_type || null,
          assessment_date || new Date().toISOString().slice(0, 10),
          score || 0,
          normalizedResult,
          examiner_id || null,
          feedback || null,
        ],
      );

      return res.status(201).json({ success: true, data: { id: insertResult.insertId } });
    }

    const [insertResult] = await db.execute(
      `INSERT INTO staff_assessment_records (
         tenant_id, user_id, assessment_name, assessment_type, assessment_date,
         score, result, examiner_id, feedback, status, created_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        tenantId,
        normalizedStaffId,
        assessment_name || '能力考核',
        assessment_type || null,
        assessment_date || new Date().toISOString().slice(0, 10),
        score || 0,
        normalizedResult,
        examiner_id || null,
        feedback || null,
        status || 'completed',
        req.user.id || null,
      ],
    );

    return res.status(201).json({ success: true, data: { id: insertResult.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 更新考核记录
router.put('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveAssessmentTable();
    const { id } = req.params;
    const {
      staff_id,
      assessment_name,
      assessment_type,
      assessment_date,
      score,
      result,
      examiner_id,
      feedback,
      status,
    } = req.body;

    const normalizedResult = toDbResult(score, result);

    if (tableName === 'assessment_records') {
      const updates = [];
      const values = [];

      if (staff_id !== undefined || req.body.user_id !== undefined) {
        updates.push('user_id = ?');
        values.push(staff_id || req.body.user_id || null);
      }
      if (assessment_name !== undefined) {
        updates.push('assessment_name = ?');
        values.push(assessment_name || null);
      }
      if (assessment_type !== undefined) {
        updates.push('assessment_type = ?');
        values.push(assessment_type || null);
      }
      if (assessment_date !== undefined) {
        updates.push('assessment_date = ?');
        values.push(assessment_date || null);
      }
      if (score !== undefined) {
        updates.push('score = ?');
        values.push(score || 0);
      }
      if (result !== undefined || score !== undefined) {
        updates.push('result = ?');
        values.push(normalizedResult);
      }
      if (examiner_id !== undefined) {
        updates.push('evaluator_id = ?');
        values.push(examiner_id || null);
      }
      if (feedback !== undefined) {
        updates.push('comments = ?');
        values.push(feedback || null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, message: '没有可更新的字段' });
      }

      updates.push('updated_at = NOW()');
      values.push(id, tenantId);
      const [updateResult] = await db.execute(
        `UPDATE assessment_records
         SET ${updates.join(', ')}
         WHERE id = ? AND tenant_id = ?`,
        values,
      );

      if (updateResult.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '记录不存在' });
      }
      return res.json({ success: true, message: '更新成功' });
    }

    const updates = [];
    const values = [];

    if (staff_id !== undefined || req.body.user_id !== undefined) {
      updates.push('user_id = ?');
      values.push(staff_id || req.body.user_id || null);
    }
    if (assessment_name !== undefined) {
      updates.push('assessment_name = ?');
      values.push(assessment_name || null);
    }
    if (assessment_type !== undefined) {
      updates.push('assessment_type = ?');
      values.push(assessment_type || null);
    }
    if (assessment_date !== undefined) {
      updates.push('assessment_date = ?');
      values.push(assessment_date || null);
    }
    if (score !== undefined) {
      updates.push('score = ?');
      values.push(score || 0);
    }
    if (result !== undefined || score !== undefined) {
      updates.push('result = ?');
      values.push(normalizedResult);
    }
    if (examiner_id !== undefined) {
      updates.push('examiner_id = ?');
      values.push(examiner_id || null);
    }
    if (feedback !== undefined) {
      updates.push('feedback = ?');
      values.push(feedback || null);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status || 'completed');
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有可更新的字段' });
    }

    updates.push('updated_at = NOW()');
    values.push(id, tenantId);
    const [updateResult] = await db.execute(
      `UPDATE staff_assessment_records
       SET ${updates.join(', ')}
       WHERE id = ? AND tenant_id = ?`,
      values,
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    return res.json({ success: true, message: '更新成功' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 删除考核记录
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveAssessmentTable();
    const { id } = req.params;

    const [deleteResult] = await db.execute(
      `DELETE FROM ${tableName} WHERE id = ? AND tenant_id = ?`,
      [id, tenantId],
    );

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    return res.json({ success: true, message: '删除成功' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
