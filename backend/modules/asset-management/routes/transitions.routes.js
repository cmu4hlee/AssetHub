const express = require('express');
const db = require('../../../config/database');
const { authenticate } = require('../../../middleware/auth');
const { getTenantId } = require('../../../middleware/tenant-filter');
const logger = require('../../../config/logger');

const router = express.Router();

const resolveAssetId = async (idOrCode, tenantId) => {
  if (!idOrCode) return null;
  const raw = String(idOrCode).trim();
  if (!raw) return null;

  const [byCode] = await db.execute(
    `SELECT id, asset_code, status FROM assets WHERE asset_code = ? AND tenant_id = ? AND is_deleted = 0 LIMIT 1`,
    [raw, tenantId],
  );
  if (byCode.length > 0) return byCode[0];

  if (/^\d+$/.test(raw)) {
    const [byId] = await db.execute(
      `SELECT id, asset_code, status FROM assets WHERE id = ? AND tenant_id = ? AND is_deleted = 0 LIMIT 1`,
      [Number.parseInt(raw, 10), tenantId],
    );
    if (byId.length > 0) return byId[0];
  }
  return null;
};

const fetchTransitions = async (currentStatus, tenantId) => {
  if (!currentStatus) return [];
  // 优先查询当前租户的 transitions，回退到全局默认（tenant_id IS NULL）
  const [rows] = await db.execute(
    `SELECT id, name, from_state, to_state, require_reason
     FROM asset_workflow_transitions
     WHERE (tenant_id = ? OR tenant_id IS NULL) AND from_state = ? AND is_active = 1
     ORDER BY sort_order ASC, id ASC`,
    [tenantId, currentStatus],
  );
  return rows;
};

// GET /:assetCode/transitions
router.get('/:assetCode/transitions', authenticate, async (req, res) => {
  try {
    const { assetCode } = req.params;
    const tenantId = getTenantId(req);
    const asset = await resolveAssetId(assetCode, tenantId);
    if (!asset) {
      return res.json({ success: true, data: [] });
    }

    const transitions = await fetchTransitions(asset.status, tenantId);
    res.json({ success: true, data: transitions });
  } catch (error) {
    logger.error('获取状态迁移列表失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取状态迁移列表失败', error: error.message });
  }
});

module.exports = router;
