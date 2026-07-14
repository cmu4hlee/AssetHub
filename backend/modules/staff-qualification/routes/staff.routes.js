const express = require('express');
const router = express.Router();
const db = require('../../../config/database');
const { authenticate } = require('../../../middleware/auth');

const tableExistsCache = new Map();
const columnExistsCache = new Map();

const tableExists = async tableName => {
  if (tableExistsCache.has(tableName)) {
    return tableExistsCache.get(tableName);
  }
  const [rows] = await db.execute(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1',
    [tableName],
  );
  const exists = rows.length > 0;
  tableExistsCache.set(tableName, exists);
  return exists;
};

const columnExists = async (tableName, columnName) => {
  const cacheKey = `${tableName}.${columnName}`;
  if (columnExistsCache.has(cacheKey)) {
    return columnExistsCache.get(cacheKey);
  }
  const [rows] = await db.execute(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1',
    [tableName, columnName],
  );
  const exists = rows.length > 0;
  columnExistsCache.set(cacheKey, exists);
  return exists;
};

const resolveCertificateColumn = async () => {
  if (await columnExists('staff_qualifications', 'certificate_no')) {
    return 'certificate_no';
  }
  return 'certificate_number';
};

const resolveAttachmentColumn = async () => {
  if (await columnExists('staff_qualifications', 'attachments')) {
    return 'attachments';
  }
  return 'attachment_url';
};

const hasQualificationLevel = async () => {
  return columnExists('staff_qualifications', 'qualification_level');
};

const hasProfessionalField = async () => {
  return columnExists('staff_qualifications', 'professional_field');
};

const hasQualificationCode = async () => {
  return columnExists('staff_qualifications', 'qualification_code');
};

const hasScope = async () => {
  return columnExists('staff_qualifications', 'scope');
};

const hasRemarks = async () => {
  return columnExists('staff_qualifications', 'remarks');
};

async function isValidUser(userId, tenantId, isSuperAdmin, executor = db) {
  if (!userId) return false;
  if (isSuperAdmin) return true;
  const [superRows] = await executor.execute(
    'SELECT id FROM super_users WHERE id = ? LIMIT 1',
    [userId],
  );
  if (superRows.length > 0) return true;
  if (tenantId) {
    const [rows] = await executor.execute(
      'SELECT id FROM users WHERE id = ? AND tenant_id = ? LIMIT 1',
      [userId, tenantId],
    );
    if (rows.length > 0) return true;
  }
  // 无 tenant_id 时不做无过滤查询，避免跨租户用户存在性探测
  return false;
}

async function resolveEffectiveTenantId(req) {
  const userTenantId = req.user.tenant_id;
  const isSuperAdmin = req.user.role === 'super_admin';
  if (userTenantId) return userTenantId;
  if (!isSuperAdmin) return userTenantId;
  try {
    const [tenantRows] = await db.execute(
      'SELECT tenant_id FROM user_tenant_roles WHERE user_id = ? AND is_default = 1 LIMIT 1',
      [req.user.id],
    );
    if (tenantRows.length > 0) return tenantRows[0].tenant_id;
    const [firstTenant] = await db.execute(
      'SELECT tenant_id FROM user_tenant_roles WHERE user_id = ? LIMIT 1',
      [req.user.id],
    );
    if (firstTenant.length > 0) return firstTenant[0].tenant_id;
  } catch (_e) { /* ignore */ }
  return null;
}

const deriveQualificationStatus = row => {
  if (row.status === 'expired' || row.status === 'expiring') {
    return row.status;
  }
  const daysUntilExpiry =
    row.days_until_expiry !== undefined && row.days_until_expiry !== null
      ? Number(row.days_until_expiry)
      : null;
  if (Number.isFinite(daysUntilExpiry)) {
    if (daysUntilExpiry < 0) {
      return 'expired';
    }
    if (daysUntilExpiry <= 90) {
      return 'expiring';
    }
  }
  if (row.expiry_date) {
    const days = Math.ceil((new Date(row.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'expired';
    if (days <= 90) return 'expiring';
  }
  return row.status || 'active';
};

const formatQualification = row => {
  let {attachments} = row;
  if (typeof attachments === 'string') {
    try {
      attachments = JSON.parse(attachments);
    } catch {
      attachments = null;
    }
  }
  return {
    ...row,
    attachments,
    staff_id: row.user_id,
    staff_name: row.staff_name || row.staff_real_name || row.staff_username || '',
    staff_code: row.staff_code || `STAFF-${String(row.user_id || row.id).padStart(6, '0')}`,
    qualification_code:
      row.qualification_code || `QL-${String(row.id).padStart(6, '0')}`,
    qualification_type: row.qualification_type || 'other',
    qualification_name: row.qualification_name || '',
    certificate_no: row.certificate_no || row.certificate_number || null,
    issue_date: row.issue_date || null,
    expiry_date: row.expiry_date || null,
    issuing_authority: row.issuing_authority || null,
    scope: row.scope || null,
    remarks: row.remarks || null,
    status: deriveQualificationStatus(row),
  };
};

function buildTenantWhere(isSuperAdmin, tenantId, tableAlias = 'sq') {
  if (isSuperAdmin) {
    return { sql: '', params: [] };
  }
  if (tenantId) {
    return { sql: ` AND ${tableAlias}.tenant_id = ?`, params: [tenantId] };
  }
  return { sql: '', params: [] };
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, position, qualification_type, status } = req.query;
    const tenantId = req.user.tenant_id;
    const isSuperAdmin = req.user.role === 'super_admin';

    let sql = `
      SELECT
        sq.*,
        u.username AS staff_username,
        u.real_name AS staff_real_name
      FROM staff_qualifications sq
      LEFT JOIN users u ON u.id = sq.user_id
      WHERE 1=1
    `;
    const params = [];

    const tw = buildTenantWhere(isSuperAdmin, tenantId);
    sql += tw.sql;
    params.push(...tw.params);

    if (qualification_type) {
      sql += ' AND sq.qualification_type = ?';
      params.push(qualification_type);
    } else if (position) {
      sql += ' AND sq.qualification_type = ?';
      params.push(position);
    }

    if (status) {
      sql += ' AND sq.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY sq.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10));

    const [rows] = await db.execute(sql, params);

    let countSql = 'SELECT COUNT(*) as total FROM staff_qualifications WHERE 1=1';
    const countParams = [];
    const ctw = buildTenantWhere(isSuperAdmin, tenantId, 'staff_qualifications');
    countSql += ctw.sql.replace(/staff_qualifications\./g, '');
    countParams.push(...ctw.params);
    if (qualification_type) {
      countSql += ' AND qualification_type = ?';
      countParams.push(qualification_type);
    } else if (position) {
      countSql += ' AND qualification_type = ?';
      countParams.push(position);
    }
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    const [countResult] = await db.execute(countSql, countParams);

    res.json({
      success: true,
      data: rows.map(formatQualification),
      pagination: {
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        total: countResult[0].total,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/expiring', authenticate, async (req, res) => {
  try {
    const { days = 90, page = 1, pageSize = 20 } = req.query;
    const tenantId = req.user.tenant_id;
    const isSuperAdmin = req.user.role === 'super_admin';
    const thresholdDays = Number.parseInt(days, 10);

    let sql = `
      SELECT
        sq.*,
        u.username AS staff_username,
        u.real_name AS staff_real_name,
        DATEDIFF(sq.expiry_date, CURDATE()) AS days_until_expiry
      FROM staff_qualifications sq
      LEFT JOIN users u ON u.id = sq.user_id
      WHERE sq.expiry_date IS NOT NULL
        AND DATEDIFF(sq.expiry_date, CURDATE()) <= ?
    `;
    const params = [Number.isFinite(thresholdDays) ? thresholdDays : 90];

    const tw = buildTenantWhere(isSuperAdmin, tenantId);
    sql += tw.sql;
    params.push(...tw.params);

    sql += ' ORDER BY sq.expiry_date ASC LIMIT ? OFFSET ?';
    params.push(
      Number.parseInt(pageSize, 10),
      (Number.parseInt(page, 10) - 1) * Number.parseInt(pageSize, 10),
    );

    const [rows] = await db.execute(sql, params);

    res.json({
      success: true,
      data: rows.map(formatQualification),
      pagination: {
        page: Number.parseInt(page, 10),
        pageSize: Number.parseInt(pageSize, 10),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin';
    const tenantId = await resolveEffectiveTenantId(req);

    const {
      staff_id,
      user_id,
      qualification_type,
      qualification_name,
      qualification_level,
      certificate_no,
      certificate_number,
      issue_date,
      expiry_date,
      issuing_authority,
      professional_field,
      applicable_equipment,
      certificate_image,
      attachments,
      qualification_code,
      scope,
      remarks,
      status,
    } = req.body;

    const normalizedUserId = staff_id || user_id;
    if (!normalizedUserId) {
      return res.status(400).json({ success: false, message: 'staff_id 不能为空' });
    }
    if (!qualification_type || !qualification_name || !issue_date) {
      return res.status(400).json({
        success: false,
        message: 'qualification_type、qualification_name、issue_date 不能为空',
      });
    }
    if (!(await isValidUser(normalizedUserId, tenantId, isSuperAdmin))) {
      return res.status(404).json({ success: false, message: '用户不存在或不属于当前租户' });
    }

    const certColumn = await resolveCertificateColumn();
    const attachColumn = await resolveAttachmentColumn();
    const hasQL = await hasQualificationLevel();
    const hasPF = await hasProfessionalField();
    const hasQC = await hasQualificationCode();
    const hasSC = await hasScope();
    const hasRM = await hasRemarks();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const fields = ['tenant_id', 'user_id', 'qualification_type', 'qualification_name', certColumn, 'issue_date', 'expiry_date', 'issuing_authority', 'status', 'created_at', 'updated_at'];
    const values = [tenantId || 0, normalizedUserId, qualification_type, qualification_name, certificate_no || certificate_number || null, issue_date, expiry_date || null, issuing_authority || null, status || 'active', now, now];

    if (hasQL) {
      fields.push('qualification_level');
      values.push(qualification_level || null);
    }
    if (hasPF) {
      fields.push('professional_field', 'applicable_equipment', 'certificate_image', attachColumn);
      values.push(professional_field || null, applicable_equipment || null, certificate_image || null, JSON.stringify(attachments || null));
    }
    if (hasQC) {
      fields.push('qualification_code');
      values.push(qualification_code || `QL-${String(Date.now()).slice(-6)}`);
    }
    if (hasSC) {
      fields.push('scope');
      values.push(scope || null);
    }
    if (hasRM) {
      fields.push('remarks');
      values.push(remarks || null);
    }

    const [result] = await db.execute(
      `INSERT INTO staff_qualifications (${fields.join(', ')}) VALUES (${values.map(() => '?').join(', ')})`,
      values,
    );

    res.json({
      success: true,
      data: {
        id: result.insertId,
        qualification_code: qualification_code || `QL-${String(result.insertId).padStart(6, '0')}`,
        scope: scope || null,
        remarks: remarks || null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenant_id;
    const isSuperAdmin = req.user.role === 'super_admin';
    const {
      staff_id,
      user_id,
      qualification_type,
      qualification_name,
      qualification_level,
      certificate_no,
      certificate_number,
      issue_date,
      expiry_date,
      issuing_authority,
      professional_field,
      applicable_equipment,
      qualification_code,
      scope,
      remarks,
      status,
    } = req.body;

    const fields = [];
    const values = [];

    if (staff_id !== undefined || user_id !== undefined) {
      fields.push('user_id = ?');
      values.push(staff_id || user_id || null);
    }
    if (qualification_type !== undefined) {
      fields.push('qualification_type = ?');
      values.push(qualification_type || null);
    }
    if (qualification_name !== undefined) {
      fields.push('qualification_name = ?');
      values.push(qualification_name || null);
    }
    if (certificate_no !== undefined || certificate_number !== undefined) {
      const certColumn = await resolveCertificateColumn();
      fields.push(`${certColumn} = ?`);
      values.push(certificate_no || certificate_number || null);
    }
    if (issue_date !== undefined) {
      fields.push('issue_date = ?');
      values.push(issue_date || null);
    }
    if (expiry_date !== undefined) {
      fields.push('expiry_date = ?');
      values.push(expiry_date || null);
    }
    if (issuing_authority !== undefined) {
      fields.push('issuing_authority = ?');
      values.push(issuing_authority || null);
    }
    if (status !== undefined) {
      fields.push('status = ?');
      values.push(status || 'active');
    }
    if (qualification_level !== undefined) {
      const hasQL = await hasQualificationLevel();
      if (hasQL) {
        fields.push('qualification_level = ?');
        values.push(qualification_level || null);
      }
    }
    if (professional_field !== undefined) {
      const hasPF = await hasProfessionalField();
      if (hasPF) {
        fields.push('professional_field = ?', 'applicable_equipment = ?');
        values.push(professional_field || null, applicable_equipment || null);
      }
    }
    if (qualification_code !== undefined) {
      const hasQC = await hasQualificationCode();
      if (hasQC) {
        fields.push('qualification_code = ?');
        values.push(qualification_code || null);
      }
    }
    if (scope !== undefined) {
      const hasSC = await hasScope();
      if (hasSC) {
        fields.push('scope = ?');
        values.push(scope || null);
      }
    }
    if (remarks !== undefined) {
      const hasRM = await hasRemarks();
      if (hasRM) {
        fields.push('remarks = ?');
        values.push(remarks || null);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: '没有可更新的字段' });
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    let sql = `UPDATE staff_qualifications SET ${fields.join(', ')} WHERE id = ?`;
    if (!isSuperAdmin && tenantId) {
      sql += ' AND tenant_id = ?';
      values.push(tenantId);
    }

    const [result] = await db.execute(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenant_id;
    const isSuperAdmin = req.user.role === 'super_admin';

    let sql = 'DELETE FROM staff_qualifications WHERE id = ?';
    const params = [id];
    if (!isSuperAdmin && tenantId) {
      sql += ' AND tenant_id = ?';
      params.push(tenantId);
    }

    const [result] = await db.execute(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
