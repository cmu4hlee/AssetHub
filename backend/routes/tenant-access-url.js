const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireSystemAdmin } = require('../middleware/auth');
const feishuNotify = require('../services/feishu-notification.service');

/**
 * 校验 URL 是否合法（绝对 URL，不允许 localhost）
 */
function validateAccessUrl(rawUrl) {
  const url = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!url) {
    return { valid: false, message: '域名不能为空' };
  }
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { valid: false, message: '只支持 http:// 或 https:// 协议' };
    }
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '0.0.0.0') {
      return { valid: false, message: '不允许使用本机地址（localhost / 127.0.0.1）' };
    }
    if (!u.hostname.includes('.')) {
      return { valid: false, message: '域名格式不正确（必须包含点号）' };
    }
    return { valid: true, normalized: `${u.protocol}//${u.host}` };
  } catch (e) {
    return { valid: false, message: 'URL 格式不正确' };
  }
}

/**
 * 获取租户的访问域名配置
 * GET /api/tenant-access-url/:tenantId
 */
router.get('/:tenantId', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '租户ID无效' });
    }

    // 权限：系统管理员只能查看自己的租户，超级管理员可以查看全部
    if (req.user.role !== 'super_admin' && req.user.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, message: '无权访问该租户' });
    }

    const [rows] = await db.execute(
      `SELECT id, config_key, config, enabled, updated_at, updated_by
       FROM tenant_configs
       WHERE tenant_id = ? AND config_key IN ('access_url', 'frontend_url')`,
      [tenantId],
    );

    const result = rows.map(r => {
      let parsed = {};
      try {
        parsed = typeof r.config === 'string' ? JSON.parse(r.config) : r.config;
      } catch (_e) { /* ignore */ }
      return {
        id: r.id,
        key: r.config_key,
        url: parsed.url || parsed.value || '',
        enabled: !!r.enabled,
        updated_at: r.updated_at,
        updated_by: r.updated_by,
      };
    });

    // 同时返回全局默认值（用于对比）
    const globalDefault = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    return res.json({
      success: true,
      data: {
        tenantAccessUrls: result,
        globalDefault: globalDefault,
        effectiveUrl: globalDefault, // 前端默认显示
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: '查询失败', error: e.message });
  }
});

/**
 * 保存/更新租户的访问域名
 * PUT /api/tenant-access-url/:tenantId
 * body: { url: 'https://assethub.example.com', key: 'access_url' }
 */
router.put('/:tenantId', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '租户ID无效' });
    }

    if (req.user.role !== 'super_admin' && req.user.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, message: '无权访问该租户' });
    }

    const { url, key = 'access_url' } = req.body || {};
    if (!['access_url', 'frontend_url'].includes(key)) {
      return res.status(400).json({ success: false, message: 'key 必须是 access_url 或 frontend_url' });
    }

    const validation = validateAccessUrl(url);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const configValue = JSON.stringify({ url: validation.normalized });

    // 存在则更新，不存在则插入
    const [existing] = await db.execute(
      `SELECT id FROM tenant_configs WHERE tenant_id = ? AND config_key = ?`,
      [tenantId, key],
    );

    if (existing.length > 0) {
      await db.execute(
        `UPDATE tenant_configs SET config = ?, enabled = 1, updated_by = ?, updated_at = NOW()
         WHERE tenant_id = ? AND config_key = ?`,
        [configValue, req.user.id, tenantId, key],
      );
    } else {
      await db.execute(
        `INSERT INTO tenant_configs (tenant_id, config_key, config, enabled, updated_by)
         VALUES (?, ?, ?, 1, ?)`,
        [tenantId, key, configValue, req.user.id],
      );
    }

    // 清除缓存，让下次发卡片重新读取
    if (feishuNotify.clearTenantUrlCache) {
      feishuNotify.clearTenantUrlCache(tenantId);
    }

    return res.json({
      success: true,
      message: '访问域名已保存',
      data: { url: validation.normalized, key },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: '保存失败', error: e.message });
  }
});

/**
 * 删除租户的访问域名配置（恢复使用全局默认）
 * DELETE /api/tenant-access-url/:tenantId
 * body: { key: 'access_url' }
 */
router.delete('/:tenantId', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '租户ID无效' });
    }
    if (req.user.role !== 'super_admin' && req.user.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, message: '无权访问该租户' });
    }
    const { key = 'access_url' } = req.body || {};

    await db.execute(
      `DELETE FROM tenant_configs WHERE tenant_id = ? AND config_key = ?`,
      [tenantId, key],
    );

    if (feishuNotify.clearTenantUrlCache) {
      feishuNotify.clearTenantUrlCache(tenantId);
    }

    return res.json({ success: true, message: '已删除租户域名配置，将使用全局默认' });
  } catch (e) {
    return res.status(500).json({ success: false, message: '删除失败', error: e.message });
  }
});

/**
 * 调试接口：模拟不同请求头下的 buildPageUrl 解析结果
 * GET /api/tenant-access-url/_debug?tenantId=999&path=/scrapping
 */
router.get('/_debug/build-url', authenticate, async (req, res) => {
  try {
    const tenantId = parseInt(req.query.tenantId, 10) || null;
    const path = String(req.query.path || '/scrapping');

    const reqInfo = {
      protocol: req.protocol,
      host: req.get('host'),
      xForwardedHost: req.get('x-forwarded-host'),
      xForwardedProto: req.get('x-forwarded-proto'),
      xRealHost: req.get('x-real-host'),
    };

    const url = await feishuNotify.buildPageUrl(path, tenantId, req);

    return res.json({
      success: true,
      data: {
        request: reqInfo,
        tenantId,
        path,
        resultUrl: url,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;