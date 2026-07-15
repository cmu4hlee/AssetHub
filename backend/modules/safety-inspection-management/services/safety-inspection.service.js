/**
 * 安全检测服务(对齐 inspection 能力)
 * 检测记录 CRUD + 整改问题跟踪 + 复核 + 到期提醒 + 统计
 */
const db = require('../../../config/database');
const logger = require('../../../config/logger');

const SAFETY_INSPECTION_ASSET_JOIN =
  'LEFT JOIN assets a ON si.asset_id = a.id AND a.tenant_id = si.tenant_id AND a.is_deleted = 0';

class SafetyInspectionService {
  // ============ 资产租户校验 ============
  async hasTenantAsset(assetId, tenantId) {
    if (!assetId) return false;
    const [rows] = await db.execute(
      'SELECT id FROM assets WHERE id = ? AND tenant_id = ? LIMIT 1',
      [assetId, tenantId],
    );
    return rows.length > 0;
  }

  // ============ 编号自增序列 ============
  async nextSequenceCode(tenantId, seqKey, prefix) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const year = new Date().getFullYear();
      await conn.execute(
        `INSERT INTO inspection_sequences (tenant_id, seq_key, seq_year, current_value)
         VALUES (?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE tenant_id = tenant_id`,
        [tenantId, seqKey, year],
      );
      const [rows] = await conn.execute(
        `SELECT current_value FROM inspection_sequences
         WHERE tenant_id = ? AND seq_key = ? AND seq_year = ? FOR UPDATE`,
        [tenantId, seqKey, year],
      );
      const next = (rows[0]?.current_value || 0) + 1;
      await conn.execute(
        `UPDATE inspection_sequences SET current_value = ? WHERE tenant_id = ? AND seq_key = ? AND seq_year = ?`,
        [next, tenantId, seqKey, year],
      );
      await conn.commit();
      const d = new Date();
      const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      return `${prefix}-${dateStr}-${String(next).padStart(5, '0')}`;
    } catch (e) {
      await conn.rollback();
      const ts = Date.now().toString(36).toUpperCase();
      return `${prefix}-${ts}`;
    } finally {
      conn.release();
    }
  }

  // ============ 检测记录 CRUD ============
  async getInspections(params) {
    const { tenantId, page = 1, pageSize = 20, inspection_type, status, keyword, start_date, end_date } = params;
    let sql = `
      SELECT si.*, a.asset_name, a.asset_code
      FROM safety_inspections si
      ${SAFETY_INSPECTION_ASSET_JOIN}
      WHERE si.tenant_id = ?
    `;
    const args = [tenantId];
    if (inspection_type) { sql += ' AND si.inspection_type = ?'; args.push(inspection_type); }
    if (status) { sql += ' AND si.status = ?'; args.push(status); }
    if (keyword) { sql += ' AND (si.inspection_name LIKE ? OR si.inspection_code LIKE ?)'; args.push(`%${keyword}%`, `%${keyword}%`); }
    if (start_date) { sql += ' AND si.inspection_date >= ?'; args.push(start_date); }
    if (end_date) { sql += ' AND si.inspection_date <= ?'; args.push(end_date); }
    sql += ' ORDER BY si.inspection_date DESC';
    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    args.push(parseInt(pageSize), parseInt(offset));

    const [inspections] = await db.execute(sql, args);
    let countSql = 'SELECT COUNT(*) as total FROM safety_inspections WHERE tenant_id = ?';
    const cArgs = [tenantId];
    if (inspection_type) { countSql += ' AND inspection_type = ?'; cArgs.push(inspection_type); }
    if (status) { countSql += ' AND status = ?'; cArgs.push(status); }
    const [countResult] = await db.execute(countSql, cArgs);
    return { data: inspections, pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total: countResult[0].total } };
  }

  async getInspectionById(id, tenantId) {
    const [rows] = await db.execute(
      `SELECT si.*, a.asset_name, a.asset_code
       FROM safety_inspections si
       ${SAFETY_INSPECTION_ASSET_JOIN}
       WHERE si.id = ? AND si.tenant_id = ?`,
      [id, tenantId],
    );
    if (rows.length === 0) return null;
    const inspection = rows[0];
    const [issues] = await db.execute(
      'SELECT * FROM safety_inspection_issues WHERE inspection_id = ? AND tenant_id = ? ORDER BY created_at ASC',
      [id, tenantId],
    );
    return { ...inspection, issues };
  }

  async createInspection(data, tenantId, userId) {
    if (data.asset_id && !(await this.hasTenantAsset(data.asset_id, tenantId))) {
      throw new Error('关联资产不存在或不属于当前租户');
    }
    const code = data.inspection_code || (await this.nextSequenceCode(tenantId, 'safety_inspection', 'SAFE'));
    const [result] = await db.execute(
      `INSERT INTO safety_inspections
        (inspection_code, inspection_name, asset_id, inspection_type, inspection_date,
         inspection_org, inspector, inspection_result, next_inspection_date,
         status, summary, attachments, signature_inspector, tenant_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code, data.inspection_name, data.asset_id, data.inspection_type || 'electrical',
        data.inspection_date, data.inspection_org || null, data.inspector || null,
        data.inspection_result || 'pass', data.next_inspection_date || null,
        data.status || 'completed', data.summary || null,
        data.attachments ? JSON.stringify(data.attachments) : null,
        data.signature_inspector || null,
        tenantId, userId,
      ],
    );

    // 异常时自动生成问题
    if (data.inspection_result === 'fail' || data.inspection_result === 'conditional') {
      const issueCode = await this.nextSequenceCode(tenantId, 'safety_issue', 'SISS');
      await db.execute(
        `INSERT INTO safety_inspection_issues
          (tenant_id, issue_code, inspection_id, asset_id, asset_name,
           problem_title, problem_desc, risk_level, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
        [
          tenantId, issueCode, result.insertId, data.asset_id,
          (await this._getAssetName(data.asset_id, tenantId)),
          `检测不合格:${data.inspection_name}`,
          data.summary || `检测结果:${data.inspection_result}`,
          data.risk_level || 'medium', userId,
        ],
      );
    }
    return { id: result.insertId, inspection_code: code };
  }

  async _getAssetName(assetId, tenantId) {
    if (!assetId) return null;
    const [rows] = await db.execute(
      'SELECT asset_name FROM assets WHERE id = ? AND tenant_id = ?',
      [assetId, tenantId],
    );
    return rows[0]?.asset_name || null;
  }

  async updateInspection(id, updates, tenantId) {
    if (updates.asset_id !== undefined && !(await this.hasTenantAsset(updates.asset_id, tenantId))) {
      throw new Error('关联资产不存在或不属于当前租户');
    }
    const fields = [];
    const values = [];
    const allowed = [
      'inspection_name', 'asset_id', 'inspection_type', 'inspection_date',
      'inspection_org', 'inspector', 'inspection_result', 'next_inspection_date',
      'status', 'reviewer_id', 'reviewer_name', 'reviewed_remark',
      'rectification_status', 'rectification_deadline', 'rectification_result',
      'rectification_assignee_id', 'rectification_assignee_name',
      'summary', 'attachments', 'signature_inspector', 'signature_reviewer',
    ];
    allowed.forEach(key => {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === 'attachments' && typeof updates[key] !== 'string'
          ? JSON.stringify(updates[key]) : updates[key]);
      }
    });
    // 复核时自动写 reviewed_at
    if (updates.status === 'reviewed' && !fields.find(f => f.startsWith('reviewed_at'))) {
      fields.push('reviewed_at = NOW()');
    }
    if (fields.length === 0) return false;
    values.push(id, tenantId);
    const [result] = await db.execute(
      `UPDATE safety_inspections SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values,
    );
    return result.affectedRows > 0;
  }

  async deleteInspection(id, tenantId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM safety_inspection_issues WHERE inspection_id = ?', [id]);
      const [r] = await conn.execute(
        'DELETE FROM safety_inspections WHERE id = ? AND tenant_id = ?', [id, tenantId],
      );
      await conn.commit();
      return r.affectedRows > 0;
    } catch (e) { await conn.rollback(); throw e; }
    finally { conn.release(); }
  }

  // ============ 复核 ============
  async reviewInspection(id, payload, tenantId, userInfo) {
    return this.updateInspection(id, {
      status: payload.decision === 'approve' ? 'reviewed' : 'submitted',
      reviewer_id: userInfo.id,
      reviewer_name: userInfo.real_name || userInfo.username,
      reviewed_remark: payload.remark,
    }, tenantId);
  }

  // ============ 整改问题 ============
  async getIssues(params) {
    const { tenantId, page = 1, pageSize = 20, status, risk_level, inspection_id, keyword } = params;
    let sql = `
      SELECT i.*, si.inspection_name, si.inspection_code, a.asset_code
      FROM safety_inspection_issues i
      LEFT JOIN safety_inspections si ON i.inspection_id = si.id AND si.tenant_id = i.tenant_id
      LEFT JOIN assets a ON i.asset_id = a.id AND a.tenant_id = i.tenant_id AND a.is_deleted = 0
      WHERE i.tenant_id = ?
    `;
    const args = [tenantId];
    if (status) { sql += ' AND i.status = ?'; args.push(status); }
    if (risk_level) { sql += ' AND i.risk_level = ?'; args.push(risk_level); }
    if (inspection_id) { sql += ' AND i.inspection_id = ?'; args.push(inspection_id); }
    if (keyword) { sql += ' AND (i.issue_code LIKE ? OR i.problem_title LIKE ?)'; args.push(`%${keyword}%`, `%${keyword}%`); }
    sql += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    args.push(parseInt(pageSize), (page - 1) * pageSize);
    const [rows] = await db.execute(sql, args);
    const [cnt] = await db.execute(
      'SELECT COUNT(*) AS total FROM safety_inspection_issues WHERE tenant_id = ?', [tenantId],
    );
    return { data: rows, pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total: cnt[0].total } };
  }

  async getIssueById(id, tenantId) {
    const [rows] = await db.execute(
      `SELECT i.*, si.inspection_name, si.inspection_code
       FROM safety_inspection_issues i
       LEFT JOIN safety_inspections si ON i.inspection_id = si.id AND si.tenant_id = i.tenant_id
       WHERE i.id = ? AND i.tenant_id = ?`,
      [id, tenantId],
    );
    return rows[0] || null;
  }

  async updateIssue(id, updates, tenantId) {
    const fields = [];
    const values = [];
    [
      'problem_title', 'problem_desc', 'risk_level',
      'rectification_measures', 'rectification_assignee_id', 'rectification_assignee_name',
      'rectification_deadline', 'status', 'rectification_result', 'rectification_date',
      'verifier_id', 'verifier_name', 'verify_remark',
    ].forEach(k => {
      if (updates[k] !== undefined) { fields.push(`${k} = ?`); values.push(updates[k]); }
    });
    if (updates.status === 'verified' && !fields.find(f => f.startsWith('verified_at'))) {
      fields.push('verified_at = NOW()');
    }
    if (fields.length === 0) return false;
    values.push(id, tenantId);
    const [r] = await db.execute(
      `UPDATE safety_inspection_issues SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values,
    );
    return r.affectedRows > 0;
  }

  // ============ 到期检测 ============
  async listExpiringInspections(params) {
    const { tenantId, days = 30 } = params;
    const [rows] = await db.execute(
      `SELECT si.*, a.asset_name, a.asset_code
       FROM safety_inspections si
       ${SAFETY_INSPECTION_ASSET_JOIN}
       WHERE si.tenant_id = ?
         AND si.next_inspection_date IS NOT NULL
         AND si.next_inspection_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
         AND si.next_inspection_date >= CURDATE()
       ORDER BY si.next_inspection_date ASC`,
      [tenantId, days],
    );
    return rows;
  }

  // ============ 统计 ============
  async getStatistics(tenantId, params = {}) {
    const { start_date, end_date } = params;
    const dateFilter = start_date && end_date ? 'AND inspection_date BETWEEN ? AND ?' : '';
    const dateArgs = start_date && end_date ? [start_date, end_date] : [];

    const [inspectionStats] = await db.execute(
      `SELECT
         COUNT(*) AS total_inspections,
         SUM(CASE WHEN inspection_result = 'pass' THEN 1 ELSE 0 END) AS pass_count,
         SUM(CASE WHEN inspection_result = 'fail' THEN 1 ELSE 0 END) AS fail_count,
         SUM(CASE WHEN inspection_result = 'conditional' THEN 1 ELSE 0 END) AS conditional_count
       FROM safety_inspections WHERE tenant_id = ? ${dateFilter}`,
      dateArgs.length > 0 ? [tenantId, ...dateArgs] : [tenantId],
    );

    const [issueStats] = await db.execute(
      `SELECT
         COUNT(*) AS total_issues,
         SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_issues,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_issues,
         SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_issues,
         SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) AS verified_issues,
         SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) AS high_risk
       FROM safety_inspection_issues WHERE tenant_id = ?`,
      [tenantId],
    );

    const [byType] = await db.execute(
      `SELECT inspection_type, COUNT(*) AS count
       FROM safety_inspections WHERE tenant_id = ? ${dateFilter}
       GROUP BY inspection_type`,
      dateArgs.length > 0 ? [tenantId, ...dateArgs] : [tenantId],
    );

    const [trend] = await db.execute(
      `SELECT DATE(inspection_date) AS date, COUNT(*) AS count
       FROM safety_inspections
       WHERE tenant_id = ? AND inspection_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(inspection_date) ORDER BY date ASC`,
      [tenantId],
    );

    return {
      inspections: inspectionStats[0],
      issues: issueStats[0],
      by_type: byType,
      trend,
    };
  }
}

module.exports = new SafetyInspectionService();
