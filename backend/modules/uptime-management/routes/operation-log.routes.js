/**
 * 运行记录路由
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

const resolveOperationLogTable = async () => {
  if (await tableExists('operation_logs')) {
    return 'operation_logs';
  }
  return 'asset_operation_logs';
};

const OPERATION_LOG_ASSET_JOIN =
  'LEFT JOIN assets a ON a.id = ol.asset_id AND a.tenant_id = ol.tenant_id';
const ASSET_OPERATION_LOG_ASSET_JOIN =
  'LEFT JOIN assets a ON a.id = aol.asset_id AND a.tenant_id = aol.tenant_id';

const toDbOperationType = value => {
  if (!value) {
    return 'maintenance';
  }
  if (value === 'startup') {
    return 'start';
  }
  if (value === 'shutdown') {
    return 'stop';
  }
  if (value === 'repair' || value === 'inspection') {
    return 'maintenance';
  }
  if (['start', 'stop', 'maintenance', 'fault'].includes(value)) {
    return value;
  }
  return 'maintenance';
};

const toUiOperationType = value => {
  if (value === 'start') {
    return 'startup';
  }
  if (value === 'stop') {
    return 'shutdown';
  }
  return value;
};

const statusFromOperationType = type => {
  if (type === 'startup' || type === 'start') {
    return 'running';
  }
  if (type === 'shutdown' || type === 'stop') {
    return 'stopped';
  }
  if (type === 'fault') {
    return 'fault';
  }
  if (['maintenance', 'repair', 'inspection'].includes(type)) {
    return 'maintenance';
  }
  return 'running';
};

const buildTimestamp = (dateStr, timeStr) => {
  if (dateStr && timeStr) {
    return `${dateStr} ${timeStr}`;
  }
  if (dateStr) {
    return `${dateStr} 00:00:00`;
  }
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
};

const normalizeOperationPayload = (payload = {}) => {
  const plannedHours = Number(
    payload.planned_operating_hours ?? payload.total_hours ?? 24,
  );
  const actualHours = Number(
    payload.actual_operating_hours ??
      payload.running_hours ??
      (payload.status === 'running' ? plannedHours : 0),
  );
  const safePlannedHours = Number.isFinite(plannedHours) ? plannedHours : 24;
  const safeActualHours = Number.isFinite(actualHours) ? actualHours : 0;

  return {
    assetId: payload.asset_id,
    normalizedOperationType: toDbOperationType(
      payload.operation_type ||
        (payload.status === 'running'
          ? 'startup'
          : payload.status === 'stopped'
            ? 'shutdown'
            : payload.status === 'fault'
              ? 'fault'
              : 'maintenance'),
    ),
    operationDate: payload.operation_date || new Date().toISOString().slice(0, 10),
    operationTimestamp: buildTimestamp(payload.operation_date, payload.operation_time),
    operatorId: payload.operator_id,
    remarks:
      payload.remarks ||
      payload.notes ||
      payload.downtime_reason ||
      payload.status ||
      null,
    plannedHours: safePlannedHours,
    actualHours: safeActualHours,
    downtimeHours:
      payload.downtime_hours !== undefined && payload.downtime_hours !== null
        ? Number(payload.downtime_hours)
        : Math.max(safePlannedHours - safeActualHours, 0),
    downtimeReason: payload.downtime_reason || payload.remarks || null,
    downtimeType: payload.downtime_type || payload.operation_type || 'maintenance',
    dataSource: payload.data_source || 'manual',
    startTime: payload.start_time || null,
    endTime: payload.end_time || null,
    durationMinutes:
      payload.duration_minutes !== undefined && payload.duration_minutes !== null
        ? Number(payload.duration_minutes)
        : null,
  };
};

const insertOperationLog = async (executor, tableName, tenantId, payload, user) => {
  const normalized = normalizeOperationPayload(payload);

  if (!normalized.assetId) {
    throw new Error('asset_id 不能为空');
  }

  if (tableName === 'operation_logs') {
    const [result] = await executor.execute(
      `INSERT INTO operation_logs (
         tenant_id, asset_id, operation_type, operation_time, operator_id,
         start_time, end_time, duration_minutes, notes, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        tenantId,
        normalized.assetId,
        normalized.normalizedOperationType,
        normalized.operationTimestamp,
        normalized.operatorId || user.id || null,
        normalized.startTime,
        normalized.endTime,
        Number.isFinite(normalized.durationMinutes) ? normalized.durationMinutes : null,
        normalized.remarks,
      ],
    );
    return result.insertId;
  }

  const [result] = await executor.execute(
    `INSERT INTO asset_operation_logs (
       tenant_id, asset_id, operation_date, planned_operating_hours, actual_operating_hours,
       downtime_hours, downtime_reason, downtime_type, data_source,
       recorded_by, recorded_by_name, remarks, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      tenantId,
      normalized.assetId,
      normalized.operationDate,
      normalized.plannedHours,
      normalized.actualHours,
      Number.isFinite(normalized.downtimeHours) ? normalized.downtimeHours : 0,
      normalized.downtimeReason,
      normalized.downtimeType,
      normalized.dataSource,
      user.id || null,
      user.username || null,
      normalized.remarks,
    ],
  );
  return result.insertId;
};

// 获取运行日志列表
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveOperationLogTable();
    const { page = 1, pageSize = 20, operation_type } = req.query;

    if (tableName === 'operation_logs') {
      let sql = `
        SELECT
          ol.*,
          a.asset_name,
          a.asset_code,
          u.real_name AS operator_name,
          u.username AS operator_username
        FROM operation_logs ol
        ${OPERATION_LOG_ASSET_JOIN}
        LEFT JOIN users u ON u.id = ol.operator_id
        WHERE ol.tenant_id = ?
      `;
      const params = [tenantId];

      if (operation_type) {
        sql += ' AND ol.operation_type = ?';
        params.push(toDbOperationType(operation_type));
      }

      sql += ' ORDER BY ol.operation_time DESC LIMIT ? OFFSET ?';
      params.push(
        parseInt(pageSize, 10),
        (parseInt(page, 10) - 1) * parseInt(pageSize, 10),
      );

      const [rows] = await db.execute(sql, params);

      return res.json({
        success: true,
        data: rows.map(item => ({
          ...item,
          log_code: item.log_code || `LOG-${String(item.id).padStart(6, '0')}`,
          operation_type: toUiOperationType(item.operation_type),
          operation_date: item.operation_date || String(item.operation_time).slice(0, 10),
          operation_time: item.operation_time
            ? String(item.operation_time).slice(11, 19)
            : null,
          remarks: item.remarks || item.notes || null,
          status: item.status || statusFromOperationType(item.operation_type),
          operator_name: item.operator_name || item.operator_username || null,
        })),
      });
    }

    let sql = `
      SELECT
        aol.*,
        a.asset_name,
        a.asset_code
      FROM asset_operation_logs aol
      ${ASSET_OPERATION_LOG_ASSET_JOIN}
      WHERE aol.tenant_id = ?
    `;
    const params = [tenantId];

    sql += ' ORDER BY aol.operation_date DESC LIMIT ? OFFSET ?';
    params.push(
      parseInt(pageSize, 10),
      (parseInt(page, 10) - 1) * parseInt(pageSize, 10),
    );

    const [rows] = await db.execute(sql, params);
    return res.json({
      success: true,
      data: rows.map(item => ({
        ...item,
        log_code: `LOG-${String(item.id).padStart(6, '0')}`,
        operation_type: item.downtime_type || 'inspection',
        operation_date: item.operation_date,
        operation_time: '00:00:00',
        status:
          item.actual_operating_hours > 0
            ? 'running'
            : item.downtime_type === 'fault'
              ? 'fault'
              : 'stopped',
        operator_name: item.recorded_by_name || null,
        remarks: item.remarks || item.downtime_reason || null,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 创建运行日志
router.post('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveOperationLogTable();
    if (Array.isArray(req.body.logs)) {
      if (req.body.logs.length === 0) {
        return res.status(400).json({ success: false, message: 'logs 不能为空数组' });
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const ids = [];
        for (const log of req.body.logs) {
          // eslint-disable-next-line no-await-in-loop
          const insertedId = await insertOperationLog(
            connection,
            tableName,
            tenantId,
            log,
            req.user,
          );
          ids.push(insertedId);
        }
        await connection.commit();

        return res.status(201).json({
          success: true,
          message: `成功创建 ${ids.length} 条运行日志`,
          data: { ids, count: ids.length },
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }

    const insertedId = await insertOperationLog(db, tableName, tenantId, req.body, req.user);
    return res.status(201).json({ success: true, data: { id: insertedId } });
  } catch (error) {
    const statusCode = error.message === 'asset_id 不能为空' ? 400 : 500;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
});

// 更新运行日志
router.put('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveOperationLogTable();
    const { id } = req.params;
    const {
      asset_id,
      operation_type,
      operation_date,
      operation_time,
      operator_id,
      remarks,
      status,
    } = req.body;

    if (tableName === 'operation_logs') {
      const updates = [];
      const values = [];

      if (asset_id !== undefined) {
        updates.push('asset_id = ?');
        values.push(asset_id);
      }
      if (operation_type !== undefined || status !== undefined) {
        updates.push('operation_type = ?');
        values.push(
          toDbOperationType(
            operation_type ||
              (status === 'running'
                ? 'startup'
                : status === 'stopped'
                  ? 'shutdown'
                  : status === 'fault'
                    ? 'fault'
                    : 'maintenance'),
          ),
        );
      }
      if (operation_date !== undefined || operation_time !== undefined) {
        updates.push('operation_time = ?');
        values.push(buildTimestamp(operation_date, operation_time));
      }
      if (operator_id !== undefined) {
        updates.push('operator_id = ?');
        values.push(operator_id || req.user.id || null);
      }
      if (remarks !== undefined || status !== undefined) {
        updates.push('notes = ?');
        values.push(remarks || status || null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, message: '没有可更新的字段' });
      }

      updates.push('updated_at = NOW()');
      values.push(id, tenantId);
      const [result] = await db.execute(
        `UPDATE operation_logs
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

    if (asset_id !== undefined) {
      updates.push('asset_id = ?');
      values.push(asset_id);
    }
    if (operation_date !== undefined) {
      updates.push('operation_date = ?');
      values.push(operation_date || null);
    }
    if (operation_type !== undefined) {
      updates.push('downtime_type = ?');
      values.push(operation_type || null);
    }
    if (remarks !== undefined || status !== undefined) {
      updates.push('remarks = ?');
      values.push(remarks || status || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有可更新的字段' });
    }

    updates.push('updated_at = NOW()');
    values.push(id, tenantId);
    const [result] = await db.execute(
      `UPDATE asset_operation_logs
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

// 删除运行日志
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveOperationLogTable();
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
