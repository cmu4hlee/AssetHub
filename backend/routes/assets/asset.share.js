/**
 * 资产分享路由模块
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate, authorize } = require('../../middleware/auth');

// 资产分享权限集合
const ASSET_SHARE_WRITE_ROLES = ['asset.edit_all', 'asset.edit_own_department', 'asset.add'];
const { getTenantId } = require('../../middleware/tenant-filter');
const crypto = require('crypto');
const logger = require('../../config/logger');

/**
 * 根据 assetCode 或数字 id 查找资产，返回数字 id
 */
async function resolveAssetId(idOrCode, tenantId) {
  if (!idOrCode) return null;
  const raw = String(idOrCode).trim();
  if (!raw) return null;

  // 先按 asset_code 查
  let [rows] = await db.execute(
    'SELECT id FROM assets WHERE asset_code = ? AND tenant_id = ? AND is_deleted = 0 LIMIT 1',
    [raw, tenantId],
  );
  if (rows.length > 0) return rows[0];

  // 再按数字 id 查
  if (/^\d+$/.test(raw)) {
    [rows] = await db.execute(
      'SELECT id FROM assets WHERE id = ? AND tenant_id = ? AND is_deleted = 0 LIMIT 1',
      [Number.parseInt(raw, 10), tenantId],
    );
    if (rows.length > 0) return rows[0];
  }
  return null;
}

/**
 * 创建分享链接
 * POST /api/assets/:id/share
 */
router.post('/:id/share', authenticate, authorize(ASSET_SHARE_WRITE_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const userId = req.user?.id || null;

    const asset = await resolveAssetId(id, tenantId);
    if (!asset) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const {
      supplier_name = '',
      supplier_contact = '',
      expires_at,
      max_uploads = 5,
    } = req.body;

    // 过期时间：优先使用前端传入的 expires_at，否则默认7天后
    let expiresAt;
    if (expires_at) {
      expiresAt = new Date(expires_at);
      if (isNaN(expiresAt.getTime())) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
      }
    } else {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const frontendUrl = process.env.FRONTEND_URL || '';
    const shareUrl = `${frontendUrl}/share/${token}`;

    const [result] = await db.execute(
      `INSERT INTO asset_shares
       (tenant_id, asset_id, share_token, share_url, expires_at,
        max_uploads, current_uploads, created_by, is_active,
        supplier_name, supplier_contact)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1, ?, ?)`,
      [tenantId, asset.id, token, shareUrl, expiresAt, max_uploads, userId, supplier_name, supplier_contact],
    );

    res.json({
      success: true,
      message: '分享链接创建成功',
      data: {
        id: result.insertId,
        share_url: shareUrl,
        token,
        expires_at: expiresAt,
        max_uploads,
        supplier_name,
        supplier_contact,
      },
    });
  } catch (error) {
    logger.error('Create share failed:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '创建分享链接失败', error: error.message });
  }
});

/**
 * 获取资产的分享列表
 * GET /api/assets/:id/shares
 */
router.get('/:id/shares', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    const asset = await resolveAssetId(id, tenantId);
    if (!asset) {
      return res.json({ success: true, data: [] });
    }

    const [shares] = await db.execute(
      `SELECT
        s.id, s.asset_id, s.share_token, s.share_url,
        s.expires_at, s.max_uploads, s.current_uploads,
        s.created_by, s.created_at, s.is_active,
        s.supplier_name, s.supplier_contact,
        CASE WHEN s.expires_at > NOW() AND s.is_active = 1 THEN 'active' ELSE 'expired' END as status
       FROM asset_shares s
       WHERE s.asset_id = ? AND s.tenant_id = ?
       ORDER BY s.created_at DESC`,
      [asset.id, tenantId],
    );

    // 兼容前端字段名
    const data = shares.map(s => ({
      ...s,
      upload_count: s.current_uploads || 0,
    }));

    res.json({ success: true, data });
  } catch (error) {
    logger.error('Get shares failed:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '获取分享列表失败', error: error.message });
  }
});

/**
 * 删除分享链接
 * DELETE /api/assets/shares/:share_id
 */
router.delete('/shares/:share_id', authenticate, authorize(ASSET_SHARE_WRITE_ROLES), async (req, res) => {
  try {
    const { share_id } = req.params;
    const tenantId = getTenantId(req);

    const [rows] = await db.execute(
      'SELECT id FROM asset_shares WHERE id = ? AND tenant_id = ?',
      [share_id, tenantId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '分享链接不存在' });
    }

    await db.execute(
      'UPDATE asset_shares SET is_active = 0 WHERE id = ? AND tenant_id = ?',
      [share_id, tenantId],
    );

    res.json({ success: true, message: '分享链接已删除' });
  } catch (error) {
    logger.error('Delete share failed:', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '删除分享链接失败', error: error.message });
  }
});

module.exports = router;
