/**
 * POCT 临床科室日常质控管理 Service
 *
 * 涵盖 7 张表的核心业务:
 *  - poct_subjects              监测科目字典
 *  - poct_department_subjects   科室启用科目
 *  - poct_shifts                班次定义
 *  - poct_schedules             排班
 *  - poct_records               质控记录
 *  - poct_signatures            手写签名
 *  - poct_reminders             提醒规则
 */
const db = require('../../../config/database');
const logger = require('../../../config/logger');

class PoctService {
  // ============================================================
  // 工具方法
  // ============================================================

  generateRecordNo() {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `POCT-${yy}${mm}${dd}-${rand}`;
  }

  /**
   * 质控结果自动判定
   * 规则:实测值与靶值偏差超过 tolerance 阈值时为 fail,接近阈值时为 warn
   */
  evaluateResult(measured, target, tolerance) {
    if (measured == null || target == null || tolerance == null) {
      return { result: 'pass', deviation: null };
    }
    const m = parseFloat(measured);
    const t = parseFloat(target);
    if (Number.isNaN(m) || Number.isNaN(t) || t === 0) {
      return { result: 'pass', deviation: null };
    }
    const dev = ((m - t) / t) * 100;
    // tolerance 形如 "±10%" / "±5mmHg" / "±0.05"
    const match = /±?\s*(\d+(?:\.\d+)?)\s*%?/.exec(tolerance);
    if (!match) return { result: 'pass', deviation: dev.toFixed(2) + '%' };
    const limit = parseFloat(match[1]);
    const isPercent = tolerance.includes('%');
    const ratio = isPercent ? Math.abs(dev) : Math.abs(m - t);
    if (ratio > limit) return { result: 'fail', deviation: dev.toFixed(2) + (isPercent ? '%' : '') };
    if (ratio > limit * 0.8) return { result: 'warn', deviation: dev.toFixed(2) + (isPercent ? '%' : '') };
    return { result: 'pass', deviation: dev.toFixed(2) + (isPercent ? '%' : '') };
  }

  getTenantId(req) {
    return req.user?.tenant_id || req.headers['x-tenant-id'] || 1;
  }

  // ============================================================
  // 1. 监测科目 subjects
  // ============================================================

  async listSubjects(params) {
    const { keyword, category, status, includeBuiltin = 'true', tenantId, page = 1, pageSize = 50 } = params;
    // 预置(builtin)科目跨租户共享:includeBuiltin 时显示本租户 + 预置科目
    const where = [];
    const args = [];
    if (includeBuiltin === 'true') {
      where.push('(tenant_id = ? OR is_builtin = 1)');
      args.push(tenantId);
    } else {
      where.push('tenant_id = ?');
      args.push(tenantId);
    }
    if (keyword) {
      where.push('(subject_code LIKE ? OR subject_name LIKE ?)');
      args.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (category) { where.push('category = ?'); args.push(category); }
    if (status)   { where.push('status = ?');    args.push(status); }
    const offset = (page - 1) * pageSize;
    const [rows] = await db.execute(
      `SELECT * FROM poct_subjects WHERE ${where.join(' AND ')} ORDER BY is_builtin DESC, category, subject_code LIMIT ? OFFSET ?`,
      [...args, parseInt(pageSize), offset],
    );
    const [cnt] = await db.execute(
      `SELECT COUNT(*) AS total FROM poct_subjects WHERE ${where.join(' AND ')}`,
      args,
    );
    return { data: rows, total: cnt[0].total };
  }

  async createSubject(data, tenantId) {
    const {
      subject_code, subject_name, category, unit, reference_range,
      target_value, tolerance, description, status = 'active',
    } = data;
    if (!subject_code || !subject_name) {
      throw new Error('科目编码和名称不能为空');
    }
    try {
      const [r] = await db.execute(
        `INSERT INTO poct_subjects
           (subject_code, subject_name, category, unit, reference_range, target_value, tolerance, description,
            is_builtin, created_by_dept_id, tenant_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [subject_code, subject_name, category, unit, reference_range, target_value, tolerance, description,
         data.created_by_dept_id || null, tenantId, status],
      );
      return { id: r.insertId };
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') throw new Error('科目编码已存在');
      throw e;
    }
  }

  async updateSubject(id, data, tenantId) {
    const fields = [];
    const args = [];
    const allow = ['subject_name', 'category', 'unit', 'reference_range', 'target_value', 'tolerance', 'description', 'status'];
    for (const k of allow) {
      if (data[k] !== undefined) { fields.push(`${k} = ?`); args.push(data[k]); }
    }
    if (fields.length === 0) throw new Error('没有要更新的字段');
    args.push(id, tenantId);
    const [r] = await db.execute(
      `UPDATE poct_subjects SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ? AND is_builtin = 0`,
      args,
    );
    if (r.affectedRows === 0) throw new Error('科目不存在或不允许编辑系统预置项');
    return true;
  }

  async deleteSubject(id, tenantId) {
    const [r] = await db.execute(
      `DELETE FROM poct_subjects WHERE id = ? AND tenant_id = ? AND is_builtin = 0`,
      [id, tenantId],
    );
    if (r.affectedRows === 0) throw new Error('科目不存在或不允许删除系统预置项');
    return true;
  }

  // ============================================================
  // 2. 科室启用科目
  // ============================================================

  async listDepartmentSubjects(departmentId, tenantId) {
    const [rows] = await db.execute(
      `SELECT pds.*, ps.subject_code, ps.subject_name, ps.category, ps.unit, ps.target_value, ps.tolerance
       FROM poct_department_subjects pds
       JOIN poct_subjects ps ON pds.subject_id = ps.id
       WHERE pds.department_id = ? AND pds.tenant_id = ?
       ORDER BY pds.sort_order, ps.subject_code`,
      [departmentId, tenantId],
    );
    return rows;
  }

  async upsertDepartmentSubject(data, tenantId) {
    const { department_id, subject_id, enabled_shifts, is_required = 1, sort_order = 0 } = data;
    if (!department_id || !subject_id) throw new Error('科室ID和科目ID必填');
    const shiftsJson = enabled_shifts ? JSON.stringify(enabled_shifts) : null;
    await db.execute(
      `INSERT INTO poct_department_subjects
         (department_id, subject_id, enabled_shifts, is_required, sort_order, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         enabled_shifts = VALUES(enabled_shifts),
         is_required = VALUES(is_required),
         sort_order = VALUES(sort_order)`,
      [department_id, subject_id, shiftsJson, is_required, sort_order, tenantId],
    );
    return { department_id, subject_id };
  }

  async removeDepartmentSubject(departmentId, subjectId, tenantId) {
    const [r] = await db.execute(
      `DELETE FROM poct_department_subjects WHERE department_id = ? AND subject_id = ? AND tenant_id = ?`,
      [departmentId, subjectId, tenantId],
    );
    return r.affectedRows > 0;
  }

  // ============================================================
  // 3. 班次 shifts
  // ============================================================

  async listShifts(tenantId) {
    // 预置(builtin)班次跨租户共享
    const [rows] = await db.execute(
      `SELECT * FROM poct_shifts WHERE (tenant_id = ? OR is_builtin = 1) AND status = 'active' ORDER BY sort_order, start_time`,
      [tenantId],
    );
    return rows;
  }

  async createShift(data, tenantId) {
    const { shift_code, shift_name, start_time, end_time, default_reminder_offset_minutes = 30, color, sort_order = 0 } = data;
    if (!shift_code || !shift_name || !start_time || !end_time) throw new Error('班次编码、名称、起止时间必填');
    const [r] = await db.execute(
      `INSERT INTO poct_shifts
         (shift_code, shift_name, start_time, end_time, default_reminder_offset_minutes, color, sort_order, is_builtin, tenant_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'active')`,
      [shift_code, shift_name, start_time, end_time, default_reminder_offset_minutes, color, sort_order, tenantId],
    );
    return { id: r.insertId };
  }

  async updateShift(id, data, tenantId) {
    const fields = [];
    const args = [];
    const allow = ['shift_name', 'start_time', 'end_time', 'default_reminder_offset_minutes', 'color', 'sort_order', 'status'];
    for (const k of allow) {
      if (data[k] !== undefined) { fields.push(`${k} = ?`); args.push(data[k]); }
    }
    if (fields.length === 0) throw new Error('没有要更新的字段');
    args.push(id, tenantId);
    const [r] = await db.execute(
      `UPDATE poct_shifts SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      args,
    );
    return r.affectedRows > 0;
  }

  async deleteShift(id, tenantId) {
    const [r] = await db.execute(
      `DELETE FROM poct_shifts WHERE id = ? AND tenant_id = ? AND is_builtin = 0`,
      [id, tenantId],
    );
    if (r.affectedRows === 0) throw new Error('班次不存在或不允许删除系统预置');
    return true;
  }

  // ============================================================
  // 4. 排班 schedules
  // ============================================================

  async listSchedules(params, tenantId) {
    const { start_date, end_date, department_id, operator_id, status } = params;
    const where = ['s.tenant_id = ?'];
    const args = [tenantId];
    if (start_date) { where.push('s.schedule_date >= ?'); args.push(start_date); }
    if (end_date)   { where.push('s.schedule_date <= ?'); args.push(end_date); }
    if (department_id) { where.push('s.department_id = ?'); args.push(department_id); }
    if (operator_id) { where.push('s.operator_id = ?'); args.push(operator_id); }
    if (status) { where.push('s.status = ?'); args.push(status); }
    const [rows] = await db.execute(
      `SELECT s.*, sh.shift_name, sh.start_time, sh.end_time, sh.color,
              sub.subject_name, sub.subject_code, sub.target_value, sub.tolerance,
              u.real_name AS operator_name
       FROM poct_schedules s
       JOIN poct_shifts sh ON s.shift_id = sh.id
       JOIN poct_subjects sub ON s.subject_id = sub.id
       LEFT JOIN users u ON s.operator_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY s.schedule_date DESC, sh.sort_order, sub.subject_code`,
      args,
    );
    return rows;
  }

  async upsertSchedule(data, tenantId) {
    const { id, schedule_date, shift_id, department_id, subject_id, operator_id, backup_operator_id } = data;
    if (!schedule_date || !shift_id || !department_id || !subject_id || !operator_id) {
      throw new Error('日期、班次、科室、科目、操作人必填');
    }
    if (id) {
      const [r] = await db.execute(
        `UPDATE poct_schedules SET schedule_date=?, shift_id=?, department_id=?, subject_id=?, operator_id=?, backup_operator_id=?
         WHERE id=? AND tenant_id=?`,
        [schedule_date, shift_id, department_id, subject_id, operator_id, backup_operator_id || null, id, tenantId],
      );
      return { id, updated: r.affectedRows };
    }
    const [r] = await db.execute(
      `INSERT INTO poct_schedules
         (schedule_date, shift_id, department_id, subject_id, operator_id, backup_operator_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE operator_id=VALUES(operator_id), backup_operator_id=VALUES(backup_operator_id)`,
      [schedule_date, shift_id, department_id, subject_id, operator_id, backup_operator_id || null, tenantId],
    );
    return { id: r.insertId || id };
  }

  async deleteSchedule(id, tenantId) {
    const [r] = await db.execute(
      `DELETE FROM poct_schedules WHERE id = ? AND tenant_id = ?`,
      [id, tenantId],
    );
    return r.affectedRows > 0;
  }

  // ============================================================
  // 5. 质控记录 records (核心)
  // ============================================================

  async listRecords(params, tenantId) {
    const { page = 1, pageSize = 20, start_date, end_date, department_id, shift_id, subject_id, operator_id, result, keyword } = params;
    const where = ['r.tenant_id = ?'];
    const args = [tenantId];
    if (start_date) { where.push('r.record_date >= ?'); args.push(start_date); }
    if (end_date)   { where.push('r.record_date <= ?'); args.push(end_date); }
    if (department_id) { where.push('r.department_id = ?'); args.push(department_id); }
    if (shift_id)   { where.push('r.shift_id = ?');   args.push(shift_id); }
    if (subject_id) { where.push('r.subject_id = ?'); args.push(subject_id); }
    if (operator_id){ where.push('r.operator_id = ?');args.push(operator_id); }
    if (result)     { where.push('r.result = ?');     args.push(result); }
    if (keyword)    { where.push('(r.record_no LIKE ? OR r.remarks LIKE ?)'); args.push(`%${keyword}%`, `%${keyword}%`); }

    const offset = (page - 1) * pageSize;
    const [rows] = await db.execute(
      `SELECT r.*, sh.shift_name, sh.color AS shift_color,
              sub.subject_name, sub.subject_code, sub.unit,
              u.real_name AS operator_name,
              d.department_name
       FROM poct_records r
       JOIN poct_shifts sh ON r.shift_id = sh.id
       JOIN poct_subjects sub ON r.subject_id = sub.id
       LEFT JOIN users u ON r.operator_id = u.id
       LEFT JOIN departments d ON r.department_id = d.id
       WHERE ${where.join(' AND ')}
       ORDER BY r.record_date DESC, r.record_time DESC
       LIMIT ? OFFSET ?`,
      [...args, parseInt(pageSize), offset],
    );
    const [cnt] = await db.execute(
      `SELECT COUNT(*) AS total FROM poct_records r WHERE ${where.join(' AND ')}`,
      args,
    );
    return { data: rows, total: cnt[0].total, page: parseInt(page), pageSize: parseInt(pageSize) };
  }

  async getRecordDetail(id, tenantId) {
    const [rows] = await db.execute(
      `SELECT r.*, sh.shift_name, sh.color AS shift_color,
              sub.subject_name, sub.subject_code, sub.unit, sub.target_value AS subject_target, sub.tolerance AS subject_tolerance,
              u.real_name AS operator_name,
              d.department_name,
              sig.signature_data, sig.sign_ip, sig.sign_device, sig.signed_at
       FROM poct_records r
       JOIN poct_shifts sh ON r.shift_id = sh.id
       JOIN poct_subjects sub ON r.subject_id = sub.id
       LEFT JOIN users u ON r.operator_id = u.id
       LEFT JOIN departments d ON r.department_id = d.id
       LEFT JOIN poct_signatures sig ON r.signature_id = sig.id
       WHERE r.id = ? AND r.tenant_id = ?`,
      [id, tenantId],
    );
    return rows[0] || null;
  }

  /**
   * 创建质控记录(可附带签名)
   * 入参: schedule_id?, shift_id, department_id, subject_id, record_date, measured_value,
   *       instrument?, reagent_lot?, temperature?, humidity?, remarks?, signature_data?
   */
  async createRecord(data, tenantId) {
    const {
      schedule_id, shift_id, department_id, subject_id, record_date,
      measured_value, instrument, reagent_lot, temperature, humidity, remarks,
      signature_data, sign_ip, sign_device,
      operator_id, // 从 JWT 注入
    } = data;

    if (!shift_id || !department_id || !subject_id || !record_date) {
      throw new Error('班次、科室、科目、日期必填');
    }
    if (!operator_id) throw new Error('操作人不能为空');

    // 拉取科目录入的靶值/容差
    const [subjRows] = await db.execute(
      `SELECT target_value, tolerance FROM poct_subjects WHERE id = ? AND tenant_id = ?`,
      [subject_id, tenantId],
    );
    if (subjRows.length === 0) throw new Error('科目不存在');
    const target = subjRows[0].target_value;
    const tolerance = subjRows[0].tolerance;

    const { result, deviation } = this.evaluateResult(measured_value, target, tolerance);

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 1) 插入签名(如有)
      let signatureId = null;
      if (signature_data) {
        const [sigR] = await conn.execute(
          `INSERT INTO poct_signatures (record_id, operator_id, signature_data, sign_ip, sign_device, signed_at, tenant_id)
           VALUES (0, ?, ?, ?, ?, NOW(), ?)`,
          [operator_id, signature_data, sign_ip || null, sign_device || null, tenantId],
        );
        signatureId = sigR.insertId;
      }

      // 2) 插入记录
      const [recR] = await conn.execute(
        `INSERT INTO poct_records
           (record_no, schedule_id, shift_id, department_id, subject_id, operator_id,
            record_date, record_time, measured_value, target_value, result, deviation,
            instrument, reagent_lot, temperature, humidity, remarks, signature_id, signed_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          this.generateRecordNo(), schedule_id || null, shift_id, department_id, subject_id, operator_id,
          record_date, measured_value || null, target, result, deviation,
          instrument || null, reagent_lot || null, temperature || null, humidity || null, remarks || null,
          signatureId, tenantId,
        ],
      );
      const recordId = recR.insertId;

      // 回写签名 record_id
      if (signatureId) {
        await conn.execute(`UPDATE poct_signatures SET record_id = ? WHERE id = ?`, [recordId, signatureId]);
      }

      // 更新排班状态为 completed
      if (schedule_id) {
        await conn.execute(
          `UPDATE poct_schedules SET status = 'completed', completed_at = NOW() WHERE id = ? AND tenant_id = ?`,
          [schedule_id, tenantId],
        );
      }

      await conn.commit();
      return { id: recordId, result, deviation, signature_id: signatureId };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async updateRecord(id, data, tenantId) {
    const fields = [];
    const args = [];
    const allow = ['measured_value', 'instrument', 'reagent_lot', 'temperature', 'humidity', 'remarks'];
    for (const k of allow) {
      if (data[k] !== undefined) { fields.push(`${k} = ?`); args.push(data[k]); }
    }
    if (fields.length === 0) throw new Error('没有要更新的字段');

    // 重新判定结果
    if (data.measured_value !== undefined) {
      const [subjRows] = await db.execute(
        `SELECT target_value, tolerance FROM poct_subjects sub
         JOIN poct_records r ON r.subject_id = sub.id
         WHERE r.id = ? AND r.tenant_id = ?`,
        [id, tenantId],
      );
      if (subjRows.length > 0) {
        const { result, deviation } = this.evaluateResult(data.measured_value, subjRows[0].target_value, subjRows[0].tolerance);
        fields.push('result = ?', 'deviation = ?');
        args.push(result, deviation);
      }
    }
    args.push(id, tenantId);
    const [r] = await db.execute(
      `UPDATE poct_records SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      args,
    );
    return r.affectedRows > 0;
  }

  async deleteRecord(id, tenantId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(`DELETE FROM poct_signatures WHERE record_id = ? AND tenant_id = ?`, [id, tenantId]);
      const [r] = await conn.execute(`DELETE FROM poct_records WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
      await conn.commit();
      return r.affectedRows > 0;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  /**
   * 移动端/PC 端 - 当班待办
   * 入参: department_id, shift_id, date
   * 返回: 排班中未完成的项目 + 已完成项目
   */
  async getShiftTasks({ department_id, shift_id, date, operator_id, tenantId }) {
    // 1) 排班 + 是否已录入
    const [rows] = await db.execute(
      `SELECT s.id AS schedule_id, s.shift_id, s.subject_id, s.operator_id, s.status AS schedule_status,
              sub.subject_code, sub.subject_name, sub.unit, sub.target_value, sub.tolerance, sub.reference_range,
              sh.shift_name, sh.start_time, sh.end_time, sh.color,
              u.real_name AS operator_name,
              r.id AS record_id, r.measured_value, r.result, r.record_time, r.signature_id
       FROM poct_schedules s
       JOIN poct_subjects sub ON s.subject_id = sub.id
       JOIN poct_shifts sh ON s.shift_id = sh.id
       LEFT JOIN users u ON s.operator_id = u.id
       LEFT JOIN poct_records r
         ON r.schedule_id = s.id AND r.record_date = s.schedule_date
       WHERE s.tenant_id = ?
         AND s.department_id = ?
         AND s.shift_id = ?
         AND s.schedule_date = ?
         ${operator_id ? 'AND s.operator_id = ?' : ''}
       ORDER BY sub.subject_code`,
      operator_id ? [tenantId, department_id, shift_id, date, operator_id] : [tenantId, department_id, shift_id, date],
    );
    return rows;
  }

  /**
   * 统计 - 合格率 / 班次分布
   */
  async getStatistics({ start_date, end_date, department_id, tenantId }) {
    const where = ['r.tenant_id = ?'];
    const args = [tenantId];
    if (start_date) { where.push('r.record_date >= ?'); args.push(start_date); }
    if (end_date)   { where.push('r.record_date <= ?'); args.push(end_date); }
    if (department_id) { where.push('r.department_id = ?'); args.push(department_id); }

    const [summary] = await db.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN r.result = 'pass' THEN 1 ELSE 0 END) AS pass,
         SUM(CASE WHEN r.result = 'warn' THEN 1 ELSE 0 END) AS warn,
         SUM(CASE WHEN r.result = 'fail' THEN 1 ELSE 0 END) AS fail
       FROM poct_records r WHERE ${where.join(' AND ')}`,
      args,
    );

    const [byShift] = await db.execute(
      `SELECT sh.shift_name, sh.color,
              COUNT(*) AS total,
              SUM(CASE WHEN r.result = 'pass' THEN 1 ELSE 0 END) AS pass
       FROM poct_records r
       JOIN poct_shifts sh ON r.shift_id = sh.id
       WHERE ${where.join(' AND ')}
       GROUP BY sh.id, sh.shift_name, sh.color
       ORDER BY sh.sort_order`,
      args,
    );

    const [byDate] = await db.execute(
      `SELECT r.record_date,
              COUNT(*) AS total,
              SUM(CASE WHEN r.result = 'pass' THEN 1 ELSE 0 END) AS pass
       FROM poct_records r
       WHERE ${where.join(' AND ')}
       GROUP BY r.record_date
       ORDER BY r.record_date DESC
       LIMIT 30`,
      args,
    );

    return {
      summary: summary[0],
      byShift,
      byDate,
      passRate: summary[0].total > 0
        ? ((summary[0].pass / summary[0].total) * 100).toFixed(2) + '%'
        : '100%',
    };
  }

  // ============================================================
  // 6. 签名 signatures
  // ============================================================

  async addSignature({ record_id, operator_id, signature_data, sign_ip, sign_device, tenantId }) {
    if (!record_id || !signature_data) throw new Error('记录ID和签名数据必填');
    const [r] = await db.execute(
      `INSERT INTO poct_signatures (record_id, operator_id, signature_data, sign_ip, sign_device, signed_at, tenant_id)
       VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
      [record_id, operator_id, signature_data, sign_ip || null, sign_device || null, tenantId],
    );
    await db.execute(
      `UPDATE poct_records SET signature_id = ?, signed_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [r.insertId, record_id, tenantId],
    );
    return { id: r.insertId };
  }

  // ============================================================
  // 7. 提醒规则 reminders
  // ============================================================

  async listReminders(tenantId) {
    const [rows] = await db.execute(
      `SELECT r.*, sh.shift_name, d.department_name
       FROM poct_reminders r
       LEFT JOIN poct_shifts sh ON r.shift_id = sh.id
       LEFT JOIN departments d ON r.department_id = d.id
       WHERE r.tenant_id = ?
       ORDER BY r.id DESC`,
      [tenantId],
    );
    return rows;
  }

  async upsertReminder(data, tenantId) {
    const { id, name, shift_id, department_id, offset_minutes = 30, channels, recipient_type = 'operator', recipient_ids, role_code, is_active = 1 } = data;
    if (!name || !channels) throw new Error('规则名称和通道必填');
    const channelsJson = typeof channels === 'string' ? channels : JSON.stringify(channels);
    const recipientsJson = recipient_ids ? (typeof recipient_ids === 'string' ? recipient_ids : JSON.stringify(recipient_ids)) : null;

    if (id) {
      const [r] = await db.execute(
        `UPDATE poct_reminders SET name=?, shift_id=?, department_id=?, offset_minutes=?, channels=?,
            recipient_type=?, recipient_ids=?, role_code=?, is_active=?
         WHERE id=? AND tenant_id=?`,
        [name, shift_id || null, department_id || null, offset_minutes, channelsJson, recipient_type, recipientsJson, role_code || null, is_active, id, tenantId],
      );
      return { id, updated: r.affectedRows };
    }
    const [r] = await db.execute(
      `INSERT INTO poct_reminders
         (name, shift_id, department_id, offset_minutes, channels, recipient_type, recipient_ids, role_code, is_active, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, shift_id || null, department_id || null, offset_minutes, channelsJson, recipient_type, recipientsJson, role_code || null, is_active, tenantId],
    );
    return { id: r.insertId };
  }

  async deleteReminder(id, tenantId) {
    const [r] = await db.execute(
      `DELETE FROM poct_reminders WHERE id = ? AND tenant_id = ?`,
      [id, tenantId],
    );
    return r.affectedRows > 0;
  }

  // ============================================================
  // 报表导出(限制 5000 条,避免大表 OOM)
  // ============================================================
  async exportRecords(params, tenantId) {
    const { start_date, end_date, department_id, shift_id, subject_id, result } = params;
    const where = ['r.tenant_id = ?'];
    const args = [tenantId];
    if (start_date)    { where.push('r.record_date >= ?'); args.push(start_date); }
    if (end_date)      { where.push('r.record_date <= ?'); args.push(end_date); }
    if (department_id) { where.push('r.department_id = ?'); args.push(department_id); }
    if (shift_id)      { where.push('r.shift_id = ?');      args.push(shift_id); }
    if (subject_id)    { where.push('r.subject_id = ?');    args.push(subject_id); }
    if (result)        { where.push('r.result = ?');        args.push(result); }

    const [rows] = await db.execute(
      `SELECT r.record_no          AS '记录编号',
              r.record_date        AS '日期',
              sh.shift_name        AS '班次',
              d.department_name    AS '科室',
              sub.subject_code     AS '科目编码',
              sub.subject_name     AS '科目',
              r.measured_value     AS '实测值',
              sub.unit             AS '单位',
              r.target_value       AS '靶值',
              r.deviation          AS '偏差',
              CASE r.result
                WHEN 'pass' THEN '合格'
                WHEN 'warn' THEN '预警'
                WHEN 'fail' THEN '不合格'
              END                  AS '结果',
              r.instrument         AS '设备',
              r.reagent_lot        AS '试剂批号',
              r.temperature        AS '温度',
              r.humidity           AS '湿度',
              u.real_name          AS '操作人',
              r.record_time        AS '录入时间',
              r.signed_at          AS '签名时间',
              r.remarks            AS '备注'
       FROM poct_records r
       JOIN poct_shifts sh ON r.shift_id = sh.id
       JOIN poct_subjects sub ON r.subject_id = sub.id
       LEFT JOIN users u ON r.operator_id = u.id
       LEFT JOIN departments d ON r.department_id = d.id
       WHERE ${where.join(' AND ')}
       ORDER BY r.record_date DESC, r.record_time DESC
       LIMIT 5000`,
      args,
    );
    return rows;
  }
}

module.exports = new PoctService();
