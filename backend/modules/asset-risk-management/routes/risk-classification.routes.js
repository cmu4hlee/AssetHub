/**
 * 风险分级路由
 */

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

const columnExists = async (tableName, columnName) => {
  const cacheKey = `${tableName}.${columnName}`;
  if (columnExistsCache.has(cacheKey)) {
    return columnExistsCache.get(cacheKey);
  }

  const [rows] = await db.execute(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
     LIMIT 1`,
    [tableName, columnName],
  );
  const exists = rows.length > 0;
  columnExistsCache.set(cacheKey, exists);
  return exists;
};

const resolveRiskLevelTable = async () => {
  if (await tableExists('asset_risk_levels')) {
    return 'asset_risk_levels';
  }
  return 'risk_assessments';
};

const resolveAssetDepartmentSelect = async () => {
  if (await columnExists('assets', 'department_id')) {
    return 'CAST(a.department_id AS CHAR) AS department';
  }
  if (await columnExists('assets', 'department')) {
    return 'a.department AS department';
  }
  if (await columnExists('assets', 'department_new')) {
    return 'a.department_new AS department';
  }
  if (await columnExists('assets', 'use_department')) {
    return 'a.use_department AS department';
  }
  return 'NULL AS department';
};

const normalizeRiskLevel = level => {
  if (['critical', 'high', 'medium', 'low'].includes(level)) {
    return level;
  }
  return 'low';
};

const parseJsonField = value => {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

const buildRiskAssetJoin = alias =>
  `LEFT JOIN assets a ON a.id = ${alias}.asset_id AND a.tenant_id = ${alias}.tenant_id`;

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

// 获取风险分级列表
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveRiskLevelTable();
    const departmentSelect = await resolveAssetDepartmentSelect();
    const { page = 1, pageSize = 20, risk_level, keyword } = req.query;

    const isLegacy = tableName === 'asset_risk_levels';
    const alias = isLegacy ? 'arl' : 'ra';

    // 动态列名
    const riskFactorCol = isLegacy ? 'assessment_items' : 'risk_factors';
    const remarksCol = isLegacy ? 'remarks' : 'mitigation_measures';

    let sql = `
      SELECT
        ${alias}.*,
        a.asset_code,
        a.asset_name,
        ${departmentSelect}
      FROM ${tableName} ${alias}
      ${buildRiskAssetJoin(alias)}
      WHERE ${alias}.tenant_id = ?
    `;
    const params = [tenantId];

    if (risk_level) {
      sql += ` AND ${alias}.risk_level = ?`;
      params.push(risk_level);
    }

    if (keyword) {
      sql += ' AND (a.asset_code LIKE ? OR a.asset_name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ` ORDER BY ${alias}.assessment_date DESC, ${alias}.id DESC LIMIT ? OFFSET ?`;
    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    params.push(parseInt(pageSize, 10), offset);

    const [rows] = await db.execute(sql, params);

    let countSql = `
      SELECT COUNT(*) AS total
      FROM ${tableName} ${alias}
      ${buildRiskAssetJoin(alias)}
      WHERE ${alias}.tenant_id = ?
    `;
    const countParams = [tenantId];
    if (risk_level) {
      countSql += ` AND ${alias}.risk_level = ?`;
      countParams.push(risk_level);
    }
    if (keyword) {
      countSql += ' AND (a.asset_code LIKE ? OR a.asset_name LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    const [countRows] = await db.execute(countSql, countParams);

    res.json({
      success: true,
      data: rows.map(item => ({
        ...item,
        risk_level: normalizeRiskLevel(item.risk_level),
        assessment_items: parseJsonField(item[riskFactorCol]),
        classification_basis: item.classification_basis || item[remarksCol] || null,
        remarks: item[remarksCol] || null,
      })),
      pagination: {
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        total: countRows[0]?.total || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取风险分级统计
router.get('/stats', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveRiskLevelTable();
    const [rows] = await db.execute(
      `SELECT risk_level, COUNT(*) as count
       FROM ${tableName}
       WHERE tenant_id = ?
       GROUP BY risk_level`,
      [tenantId],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建风险分级
router.post('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = await resolveRiskLevelTable();
    const {
      asset_id,
      asset_code,
      risk_level,
      risk_score,
      assessment_date,
      next_assessment_date,
      assessment_items,
      classification_basis,
      remarks,
    } = req.body;

    const items =
      assessment_items ||
      (classification_basis
        ? { classification_basis: String(classification_basis) }
        : null);

    // 支持 asset_id 或 asset_code
    let finalAssetId = asset_id;
    if (!finalAssetId && asset_code) {
      const [rows] = await db.execute(
        'SELECT id FROM assets WHERE asset_code = ? AND tenant_id = ? LIMIT 1',
        [asset_code, tenantId],
      );
      finalAssetId = rows[0]?.id || null;
    }

    if (!(await hasTenantAsset(finalAssetId, tenantId))) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    if (tableName === 'asset_risk_levels') {
      const [result] = await db.execute(
        `INSERT INTO asset_risk_levels (
           tenant_id, asset_id, risk_level, risk_score, assessment_items,
           assessment_date, next_assessment_date, assessor_id, remarks, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          tenantId,
          finalAssetId,
          normalizeRiskLevel(risk_level),
          risk_score || 0,
          items ? JSON.stringify(items) : null,
          assessment_date || new Date().toISOString().slice(0, 10),
          next_assessment_date || null,
          req.user.id || null,
          remarks || classification_basis || null,
        ],
      );

      return res.status(201).json({ success: true, data: { id: result.insertId } });
    }

    const [result] = await db.execute(
      `INSERT INTO risk_assessments (
         tenant_id, asset_id, risk_level, risk_score, assessment_date, next_assessment_date,
         assessor_id, risk_factors, mitigation_measures, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        tenantId,
        finalAssetId,
        normalizeRiskLevel(risk_level),
        risk_score || 0,
        assessment_date || new Date().toISOString().slice(0, 10),
        next_assessment_date || null,
        req.user.id || null,
        items ? JSON.stringify(items) : null,
        remarks || classification_basis || null,
        'active',
      ],
    );

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新风险分级
router.put('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const tableName = await resolveRiskLevelTable();
    const {
      asset_id,
      risk_level,
      risk_score,
      assessment_date,
      next_assessment_date,
      assessment_items,
      classification_basis,
      remarks,
    } = req.body;

    const updates = [];
    const values = [];

    const nextItems =
      assessment_items ||
      (classification_basis
        ? { classification_basis: String(classification_basis) }
        : null);

    if (asset_id !== undefined && !(await hasTenantAsset(asset_id, tenantId))) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    if (tableName === 'asset_risk_levels') {
      if (asset_id !== undefined) {
        updates.push('asset_id = ?');
        values.push(asset_id);
      }
      if (risk_level !== undefined) {
        updates.push('risk_level = ?');
        values.push(normalizeRiskLevel(risk_level));
      }
      if (risk_score !== undefined) {
        updates.push('risk_score = ?');
        values.push(risk_score);
      }
      if (assessment_date !== undefined) {
        updates.push('assessment_date = ?');
        values.push(assessment_date);
      }
      if (next_assessment_date !== undefined) {
        updates.push('next_assessment_date = ?');
        values.push(next_assessment_date);
      }
      if (assessment_items !== undefined || classification_basis !== undefined) {
        updates.push('assessment_items = ?');
        values.push(nextItems ? JSON.stringify(nextItems) : null);
      }
      if (remarks !== undefined || classification_basis !== undefined) {
        updates.push('remarks = ?');
        values.push(remarks || classification_basis || null);
      }
    } else {
      if (asset_id !== undefined) {
        updates.push('asset_id = ?');
        values.push(asset_id);
      }
      if (risk_level !== undefined) {
        updates.push('risk_level = ?');
        values.push(normalizeRiskLevel(risk_level));
      }
      if (risk_score !== undefined) {
        updates.push('risk_score = ?');
        values.push(risk_score);
      }
      if (assessment_date !== undefined) {
        updates.push('assessment_date = ?');
        values.push(assessment_date);
      }
      if (next_assessment_date !== undefined) {
        updates.push('next_assessment_date = ?');
        values.push(next_assessment_date);
      }
      if (assessment_items !== undefined || classification_basis !== undefined) {
        updates.push('risk_factors = ?');
        values.push(nextItems ? JSON.stringify(nextItems) : null);
      }
      if (remarks !== undefined || classification_basis !== undefined) {
        updates.push('mitigation_measures = ?');
        values.push(remarks || classification_basis || null);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有可更新的字段' });
    }

    updates.push('updated_at = NOW()');
    values.push(id, tenantId);

    const [result] = await db.execute(
      `UPDATE ${tableName}
       SET ${updates.join(', ')}
       WHERE id = ? AND tenant_id = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除风险分级
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;
    const tableName = await resolveRiskLevelTable();

    const [result] = await db.execute(
      `DELETE FROM ${tableName} WHERE id = ? AND tenant_id = ?`,
      [id, tenantId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
