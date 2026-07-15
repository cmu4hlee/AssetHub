/**
 * 风险评估路由
 * 符合 ISO 14971:2019《医疗器械风险管理》标准
 */

const express = require('express');
const router = express.Router();
const db = require('../../../config/database');
const logger = require('../../../config/logger');
const { authenticate } = require('../../../middleware/auth');

const VALID_RISK_LEVELS = ['critical', 'high', 'medium', 'low'];
const tableExistsCache = new Map();

async function tableExists(tableName) {
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
}

async function resolveAssessmentTable() {
  if (await tableExists('risk_assessment_records')) {
    return 'risk_assessment_records';
  }
  if (await tableExists('asset_risk_levels')) {
    return 'asset_risk_levels';
  }
  return 'risk_assessments';
}

const normalizeRiskLevel = level => {
  if (!level) return 'low';
  const normalized = String(level).toLowerCase().trim();
  if (VALID_RISK_LEVELS.includes(normalized)) {
    return normalized;
  }
  return 'low';
};

const parseJsonField = value => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

// 输入验证函数
function validateRiskAssessmentInput(data, isUpdate = false) {
  const errors = [];

  // 支持 asset_id 或 asset_code
  if (!isUpdate && !data.asset_id && !data.asset_code) {
    errors.push('资产ID或资产编码不能为空');
  }

  if (data.risk_score !== undefined) {
    const score = parseFloat(data.risk_score);
    if (isNaN(score) || score < 0 || score > 100) {
      errors.push('风险评分必须在0-100之间');
    }
  }

  if (data.risk_level !== undefined) {
    const normalized = normalizeRiskLevel(data.risk_level);
    if (normalized === 'low' && data.risk_level !== 'low' && data.risk_level !== null) {
      // 可能是无效值被normalize了
      if (!VALID_RISK_LEVELS.includes(String(data.risk_level).toLowerCase())) {
        errors.push(`风险等级无效，必须是[${VALID_RISK_LEVELS.join(', ')}]之一`);
      }
    }
  }

  if (data.assessment_date && isNaN(Date.parse(data.assessment_date))) {
    errors.push('评估日期格式不正确');
  }

  if (data.next_assessment_date && isNaN(Date.parse(data.next_assessment_date))) {
    errors.push('下次评估日期格式不正确');
  }

  return errors;
}

// 解析资产标识：支持 asset_id 或 asset_code
async function resolveAssetIdentifier(assetIdOrCode, tenantId) {
  if (assetIdOrCode) {
    // 如果是数字，假设是 asset_id
    const idNum = parseInt(assetIdOrCode, 10);
    if (!isNaN(idNum)) {
      return { asset_id: idNum, asset_code: null };
    }
    // 否则作为 asset_code 处理
    return { asset_id: null, asset_code: assetIdOrCode };
  }
  return { asset_id: null, asset_code: null };
}

// 获取资产信息（根据 asset_id 或 asset_code）
async function getAssetInfo(assetId, assetCode, tenantId) {
  let sql, params;
  if (assetId) {
    [sql, params] = [
      'SELECT id, asset_code, asset_name FROM assets WHERE id = ? AND tenant_id = ? LIMIT 1',
      [assetId, tenantId],
    ];
  } else if (assetCode) {
    [sql, params] = [
      'SELECT id, asset_code, asset_name FROM assets WHERE asset_code = ? AND tenant_id = ? LIMIT 1',
      [assetCode, tenantId],
    ];
  } else {
    return null;
  }
  const [rows] = await db.execute(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function logRiskError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: req?.user?.tenant_id || null,
    userId: req?.user?.id || null,
    ...context,
  });
}

// 获取风险评估列表
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, risk_level } = req.query;
    const tenantId = req.user.tenant_id;
    const tableName = await resolveAssessmentTable();

    // 动态列名映射（兼容不同的表结构）
    const riskFactorCol = tableName === 'risk_assessment_records' ? 'assessment_items' : 'risk_factors';
    const assessorCol = tableName === 'risk_assessment_records' ? 'assessor' : 'assessor_id';

    let sql = `
      SELECT
        t.*,
        a.asset_code,
        a.asset_name,
        u.real_name as assessor_name
      FROM ${tableName} t
      LEFT JOIN assets a ON t.asset_id = a.id AND t.tenant_id = a.tenant_id AND a.is_deleted = 0
      LEFT JOIN users u ON t.assessor_id = u.id AND t.tenant_id = u.tenant_id AND a.is_deleted = 0
      WHERE t.tenant_id = ?
    `;
    const params = [tenantId];

    if (risk_level) {
      sql += ' AND t.risk_level = ?';
      params.push(risk_level);
    }

    sql += ' ORDER BY t.assessment_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10));

    const [rows] = await db.execute(sql, params);

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM ${tableName} WHERE tenant_id = ?`,
      [tenantId],
    );

    res.json({
      success: true,
      data: rows.map(item => ({
        ...item,
        risk_level: normalizeRiskLevel(item.risk_level),
        assessment_items: parseJsonField(item[riskFactorCol]),
        assessment_code: `RA-${String(item.id).padStart(6, '0')}`,
        assessor_name: item.assessor_name || item[assessorCol] || null,
        remarks: item.remarks || item.mitigation_measures || null,
      })),
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

// 创建风险评估
router.post('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const {
      asset_id,
      asset_code,
      risk_level,
      risk_score,
      assessment_date,
      next_assessment_date,
      assessment_items,
      risk_factors,
      remarks,
      mitigation_measures,
      status,
    } = req.body;

    // 输入验证
    const validationErrors = validateRiskAssessmentInput(req.body, false);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: validationErrors.join('; '),
        errors: validationErrors,
      });
    }

    // 解析资产标识
    const { asset_id: resolvedAssetId, asset_code: resolvedAssetCode } = await resolveAssetIdentifier(asset_id || asset_code, tenantId);

    // 如果有 asset_code 但没有 asset_id，查询对应的 asset_id
    let finalAssetId = resolvedAssetId;
    if (!finalAssetId && resolvedAssetCode) {
      const assetInfo = await getAssetInfo(null, resolvedAssetCode, tenantId);
      finalAssetId = assetInfo?.id || null;
    }

    const tableName = await resolveAssessmentTable();
    const factors = assessment_items || risk_factors || null;
    const mitigation = remarks || mitigation_measures || null;

    const [result] = await db.execute(
      `INSERT INTO ${tableName} (
         tenant_id, asset_id, asset_code, risk_level, risk_score, assessment_date, next_assessment_date,
         assessor_id, risk_factors, mitigation_measures, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        tenantId,
        finalAssetId,
        resolvedAssetCode || asset_code || null,
        normalizeRiskLevel(risk_level),
        risk_score || 0,
        assessment_date || new Date().toISOString().slice(0, 10),
        next_assessment_date || null,
        req.user.id || null,
        factors ? JSON.stringify(factors) : null,
        mitigation,
        status || 'active',
      ],
    );

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    logRiskError('创建风险评估失败', error, req);
    res.status(500).json({ success: false, message: '创建风险评估失败' });
  }
});

// 更新风险评估
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenant_id;
    const tableName = await resolveAssessmentTable();
    const {
      asset_id,
      risk_level,
      risk_score,
      assessment_date,
      next_assessment_date,
      assessment_items,
      risk_factors,
      remarks,
      mitigation_measures,
      status,
    } = req.body;

    const fields = [];
    const values = [];

    if (asset_id !== undefined) {
      fields.push('asset_id = ?');
      values.push(asset_id || null);
    }
    if (risk_level !== undefined) {
      fields.push('risk_level = ?');
      values.push(normalizeRiskLevel(risk_level));
    }
    if (risk_score !== undefined) {
      fields.push('risk_score = ?');
      values.push(risk_score || 0);
    }
    if (assessment_date !== undefined) {
      fields.push('assessment_date = ?');
      values.push(assessment_date || null);
    }
    if (next_assessment_date !== undefined) {
      fields.push('next_assessment_date = ?');
      values.push(next_assessment_date || null);
    }
    if (assessment_items !== undefined || risk_factors !== undefined) {
      const factors = assessment_items || risk_factors || null;
      fields.push('risk_factors = ?');
      values.push(factors ? JSON.stringify(factors) : null);
    }
    if (remarks !== undefined || mitigation_measures !== undefined) {
      fields.push('mitigation_measures = ?');
      values.push(remarks || mitigation_measures || null);
    }
    if (status !== undefined) {
      fields.push('status = ?');
      values.push(status || 'active');
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: '没有可更新的字段' });
    }

    fields.push('updated_at = NOW()');
    values.push(id, tenantId);

    const [result] = await db.execute(
      `UPDATE ${tableName} SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
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

// 删除风险评估
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenant_id;
    const tableName = await resolveAssessmentTable();

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
