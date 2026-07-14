const express = require('express');
const db = require('../../../config/database');
const { authenticate } = require('../../../middleware/auth');
const { getTenantId } = require('../../../middleware/tenant-filter');
const logger = require('../../../config/logger');

const router = express.Router();

const resolveAssetCode = async (idOrCode, tenantId) => {
  if (!idOrCode) return null;
  const raw = String(idOrCode).trim();
  if (!raw) return null;

  const [byCode] = await db.execute(
    `SELECT asset_code FROM assets WHERE asset_code = ? AND tenant_id = ? AND is_deleted = 0 LIMIT 1`,
    [raw, tenantId],
  );
  if (byCode.length > 0) return byCode[0].asset_code;

  if (/^\d+$/.test(raw)) {
    const [byId] = await db.execute(
      `SELECT asset_code FROM assets WHERE id = ? AND tenant_id = ? AND is_deleted = 0 LIMIT 1`,
      [Number.parseInt(raw, 10), tenantId],
    );
    if (byId.length > 0) return byId[0].asset_code;
  }
  return null;
};

// GET /:assetCode/change-logs
router.get('/:assetCode/change-logs', authenticate, async (req, res) => {
  try {
    const { assetCode } = req.params;
    const tenantId = getTenantId(req);
    const realCode = await resolveAssetCode(assetCode, tenantId);
    if (!realCode) {
      return res.json({ success: true, data: [] });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const [rows] = await db.execute(
      `SELECT id, asset_code, field_name, old_value, new_value, changed_by, changed_at, tenant_id
       FROM asset_change_logs
       WHERE asset_code = ? AND tenant_id = ?
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [realCode, tenantId, pageSize, offset],
    );
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM asset_change_logs WHERE asset_code = ? AND tenant_id = ?`,
      [realCode, tenantId],
    );

    res.json({
      success: true,
      data: rows,
      total: countRows[0]?.total || 0,
      page,
      pageSize,
    });
  } catch (error) {
    logger.error('获取资产变更日志失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取变更日志失败', error: error.message });
  }
});

module.exports = router;
