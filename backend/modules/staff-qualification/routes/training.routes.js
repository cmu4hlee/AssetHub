/**
 * 培训管理路由
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

const resolveTrainingTable = async () => {
  if (await tableExists('staff_training_records')) {
    return 'staff_training_records';
  }
  return 'training_records';
};

// 获取培训记录
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveTrainingTable();
    const { page = 1, pageSize = 20, training_type, status } = req.query;

    let sql = `
      SELECT
        tr.*,
        u.username,
        u.real_name
      FROM ${tableName} tr
      LEFT JOIN users u ON tr.user_id = u.id
      WHERE tr.tenant_id = ?
    `;
    const params = [tenantId];

    if (training_type) {
      sql += ' AND tr.training_type = ?';
      params.push(training_type);
    }
    if (status) {
      sql += ' AND tr.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY tr.id DESC LIMIT ? OFFSET ?';
    params.push(
      parseInt(pageSize, 10),
      (parseInt(page, 10) - 1) * parseInt(pageSize, 10),
    );

    const [rows] = await db.execute(sql, params);

    res.json({
      success: true,
      data: rows.map(item => ({
        ...item,
        training_code: item.training_code || `TR-${String(item.id).padStart(6, '0')}`,
        duration:
          item.duration ??
          item.duration_hours ??
          item.training_duration ??
          0,
        start_date: item.start_date || item.training_date || null,
        end_date: item.end_date || item.training_date || null,
        target_audience: item.target_audience || item.real_name || item.username || '',
        instructor: item.instructor || item.trainer || '',
        content: item.content || item.training_content || '',
        location: item.location || item.training_location || '',
        status: item.status || 'planned',
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建培训记录
router.post('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveTrainingTable();
    const {
      training_code,
      training_name,
      training_type,
      target_audience,
      duration,
      start_date,
      end_date,
      instructor,
      trainer,
      content,
      training_content,
      location,
      status,
      remarks,
      user_id,
    } = req.body;

    if (!training_name) {
      return res.status(400).json({ success: false, message: 'training_name 不能为空' });
    }

    const normalizedUserId = user_id || req.user.id || null;
    const normalizedTrainer = trainer || instructor || null;
    const normalizedContent = training_content || content || null;

    if (tableName === 'staff_training_records') {
      const [result] = await db.execute(
        `INSERT INTO staff_training_records (
           tenant_id, user_id, training_type, training_name, training_content,
           training_method, training_date, training_duration, training_location,
           trainer, remarks, status, created_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          tenantId,
          normalizedUserId,
          training_type || null,
          training_name,
          normalizedContent,
          'offline',
          start_date || new Date().toISOString().slice(0, 10),
          duration || 0,
          location || null,
          normalizedTrainer,
          remarks || null,
          status || 'planned',
          req.user.id || null,
        ],
      );
      return res.status(201).json({ success: true, data: { id: result.insertId } });
    }

    if (!normalizedUserId) {
      return res.status(400).json({ success: false, message: 'user_id 不能为空' });
    }

    const [result] = await db.execute(
      `INSERT INTO training_records (
         tenant_id, user_id, training_name, training_type, training_date,
         duration_hours, trainer, training_provider, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        tenantId,
        normalizedUserId,
        training_name,
        training_type || null,
        start_date || new Date().toISOString().slice(0, 10),
        duration || 0,
        normalizedTrainer,
        target_audience || null,
      ],
    );
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 更新培训记录
router.put('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveTrainingTable();
    const { id } = req.params;
    const {
      training_name,
      training_type,
      duration,
      start_date,
      end_date,
      instructor,
      trainer,
      content,
      training_content,
      location,
      status,
      remarks,
      user_id,
      target_audience,
    } = req.body;

    const normalizedTrainer = trainer || instructor;
    const normalizedContent = training_content || content;

    if (tableName === 'staff_training_records') {
      const updates = [];
      const values = [];

      if (user_id !== undefined) {
        updates.push('user_id = ?');
        values.push(user_id || null);
      }
      if (training_type !== undefined) {
        updates.push('training_type = ?');
        values.push(training_type || null);
      }
      if (training_name !== undefined) {
        updates.push('training_name = ?');
        values.push(training_name || null);
      }
      if (normalizedContent !== undefined) {
        updates.push('training_content = ?');
        values.push(normalizedContent || null);
      }
      if (start_date !== undefined) {
        updates.push('training_date = ?');
        values.push(start_date || null);
      }
      if (duration !== undefined) {
        updates.push('training_duration = ?');
        values.push(duration || 0);
      }
      if (location !== undefined) {
        updates.push('training_location = ?');
        values.push(location || null);
      }
      if (normalizedTrainer !== undefined) {
        updates.push('trainer = ?');
        values.push(normalizedTrainer || null);
      }
      if (remarks !== undefined) {
        updates.push('remarks = ?');
        values.push(remarks || null);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        values.push(status || 'planned');
      }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, message: '没有可更新的字段' });
      }

      updates.push('updated_at = NOW()');
      values.push(id, tenantId);
      const [result] = await db.execute(
        `UPDATE staff_training_records
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

    if (user_id !== undefined) {
      updates.push('user_id = ?');
      values.push(user_id || req.user.id || null);
    }
    if (training_name !== undefined) {
      updates.push('training_name = ?');
      values.push(training_name || null);
    }
    if (training_type !== undefined) {
      updates.push('training_type = ?');
      values.push(training_type || null);
    }
    if (start_date !== undefined) {
      updates.push('training_date = ?');
      values.push(start_date || null);
    }
    if (duration !== undefined) {
      updates.push('duration_hours = ?');
      values.push(duration || 0);
    }
    if (normalizedTrainer !== undefined) {
      updates.push('trainer = ?');
      values.push(normalizedTrainer || null);
    }
    if (target_audience !== undefined) {
      updates.push('training_provider = ?');
      values.push(target_audience || null);
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: '无可更新字段，已跳过' });
    }

    updates.push('updated_at = NOW()');
    values.push(id, tenantId);
    const [result] = await db.execute(
      `UPDATE training_records
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

// 删除培训记录
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveTrainingTable();
    const { id } = req.params;

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
