/**
 * 风险控制路由
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

const resolveRiskControlTable = async () => {
  if (await tableExists('risk_control_measures')) {
    return 'risk_control_measures';
  }
  return 'risk_controls';
};

const normalizeStatus = status => {
  if (['planned', 'pending'].includes(status)) {
    return 'pending';
  }
  if (status === 'in_progress') {
    return 'in_progress';
  }
  if (status === 'completed') {
    return 'completed';
  }
  return 'pending';
};

const normalizeRiskLevel = riskLevel => {
  if (['high', 'medium', 'low'].includes(riskLevel)) {
    return riskLevel;
  }
  return 'medium';
};

const toNullableInt = value => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const resolveAssessmentId = async (assessmentId, tenantId) => {
  const explicit = toNullableInt(assessmentId);
  if (explicit) {
    return explicit;
  }
  const [rows] = await db.execute(
    `SELECT id
     FROM risk_assessments
     WHERE tenant_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [tenantId],
  );
  // risk_controls.assessment_id 为 NOT NULL，但部分环境并未建立外键约束。
  // 无可用评估记录时回退到 0，保证风险控制页面可独立录入。
  return rows[0]?.id || 0;
};

// 获取风险控制列表
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveRiskControlTable();
    const { page = 1, pageSize = 20, status } = req.query;

    if (tableName === 'risk_control_measures') {
      let sql = `
        SELECT *
        FROM risk_control_measures
        WHERE tenant_id = ?
      `;
      const params = [tenantId];

      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }

      sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
      params.push(
        parseInt(pageSize, 10),
        (parseInt(page, 10) - 1) * parseInt(pageSize, 10),
      );

      const [rows] = await db.execute(sql, params);
      return res.json({ success: true, data: rows });
    }

    let sql = `
      SELECT
        rc.*,
        CONCAT('RC-', LPAD(rc.id, 6, '0')) AS control_code,
        COALESCE(rc.control_measure, '') AS control_name,
        'mitigation' AS control_type,
        'medium' AS risk_level,
        COALESCE(rc.control_measure, '') AS control_description,
        NULL AS planned_start_date,
        rc.due_date AS planned_end_date,
        NULL AS actual_start_date,
        rc.completion_date AS actual_end_date,
        CAST(rc.responsible_person_id AS CHAR) AS responsible_person,
        CASE
          WHEN rc.status = 'pending' THEN 'planned'
          ELSE rc.status
        END AS status,
        CASE
          WHEN rc.status = 'completed' THEN 100
          WHEN rc.status = 'in_progress' THEN 50
          ELSE 0
        END AS progress,
        NULL AS remarks
      FROM risk_controls rc
      WHERE rc.tenant_id = ?
    `;
    const params = [tenantId];

    if (status) {
      const normalized = normalizeStatus(status);
      sql += ' AND rc.status = ?';
      params.push(normalized);
    }

    sql += ' ORDER BY rc.id DESC LIMIT ? OFFSET ?';
    params.push(
      parseInt(pageSize, 10),
      (parseInt(page, 10) - 1) * parseInt(pageSize, 10),
    );

    const [rows] = await db.execute(sql, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 创建风险控制
router.post('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveRiskControlTable();
    const {
      control_code,
      control_name,
      control_type,
      risk_level,
      control_description,
      planned_end_date,
      actual_end_date,
      responsible_person,
      status,
      progress,
      remarks,
      assessment_id,
    } = req.body;

    if (tableName === 'risk_control_measures') {
      const [result] = await db.execute(
        `INSERT INTO risk_control_measures (
           tenant_id, control_code, control_name, control_type, risk_level,
           control_description, planned_end_date, actual_end_date,
           responsible_person, status, progress, remarks, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          tenantId,
          control_code,
          control_name,
          control_type,
          normalizeRiskLevel(risk_level),
          control_description,
          planned_end_date || null,
          actual_end_date || null,
          responsible_person || null,
          status || 'planned',
          progress || 0,
          remarks || null,
        ],
      );

      return res.status(201).json({ success: true, data: { id: result.insertId } });
    }

    const normalizedAssessmentId = await resolveAssessmentId(assessment_id, tenantId);
    const [result] = await db.execute(
      `INSERT INTO risk_controls (
         tenant_id, assessment_id, control_measure, responsible_person_id,
         due_date, completion_date, status, updated_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        tenantId,
        normalizedAssessmentId,
        control_description || control_name || '',
        toNullableInt(responsible_person),
        planned_end_date || null,
        actual_end_date || null,
        normalizeStatus(status),
      ],
    );

    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 更新风险控制
router.put('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const tableName = await resolveRiskControlTable();
    const {
      control_code,
      control_name,
      control_type,
      risk_level,
      control_description,
      planned_end_date,
      actual_end_date,
      responsible_person,
      status,
      progress,
      remarks,
      assessment_id,
    } = req.body;

    if (tableName === 'risk_control_measures') {
      const updates = [];
      const values = [];

      if (control_code !== undefined) {
        updates.push('control_code = ?');
        values.push(control_code);
      }
      if (control_name !== undefined) {
        updates.push('control_name = ?');
        values.push(control_name);
      }
      if (control_type !== undefined) {
        updates.push('control_type = ?');
        values.push(control_type);
      }
      if (risk_level !== undefined) {
        updates.push('risk_level = ?');
        values.push(normalizeRiskLevel(risk_level));
      }
      if (control_description !== undefined) {
        updates.push('control_description = ?');
        values.push(control_description);
      }
      if (planned_end_date !== undefined) {
        updates.push('planned_end_date = ?');
        values.push(planned_end_date);
      }
      if (actual_end_date !== undefined) {
        updates.push('actual_end_date = ?');
        values.push(actual_end_date);
      }
      if (responsible_person !== undefined) {
        updates.push('responsible_person = ?');
        values.push(responsible_person);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        values.push(status);
      }
      if (progress !== undefined) {
        updates.push('progress = ?');
        values.push(progress);
      }
      if (remarks !== undefined) {
        updates.push('remarks = ?');
        values.push(remarks);
      }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, message: '没有可更新的字段' });
      }

      updates.push('updated_at = NOW()');
      values.push(id, tenantId);
      const [result] = await db.execute(
        `UPDATE risk_control_measures
         SET ${updates.join(', ')}
         WHERE id = ? AND tenant_id = ?`,
        values,
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '记录不存在' });
      }
      return res.json({ success: true, message: '更新成功' });
    }

    const updates = [];
    const values = [];

    if (assessment_id !== undefined) {
      updates.push('assessment_id = ?');
      values.push(assessment_id);
    }
    if (control_description !== undefined || control_name !== undefined) {
      updates.push('control_measure = ?');
      values.push(control_description || control_name);
    }
    if (responsible_person !== undefined) {
      updates.push('responsible_person_id = ?');
      values.push(toNullableInt(responsible_person));
    }
    if (planned_end_date !== undefined) {
      updates.push('due_date = ?');
      values.push(planned_end_date);
    }
    if (actual_end_date !== undefined) {
      updates.push('completion_date = ?');
      values.push(actual_end_date);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(normalizeStatus(status));
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有可更新的字段' });
    }

    updates.push('updated_at = NOW()');
    values.push(id, tenantId);
    const [result] = await db.execute(
      `UPDATE risk_controls
       SET ${updates.join(', ')}
       WHERE id = ? AND tenant_id = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    return res.json({ success: true, message: '更新成功' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 删除风险控制
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const tableName = await resolveRiskControlTable();

    const [result] = await db.execute(
      `DELETE FROM ${tableName} WHERE id = ? AND tenant_id = ?`,
      [id, tenantId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    return res.json({ success: true, message: '删除成功' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
