const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');
const db = require('../config/database');

const USER_DESKTOP_PREFS_TABLE = 'user_desktop_preferences';

async function ensureTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${USER_DESKTOP_PREFS_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      tenant_id INT NOT NULL,
      hidden_modules JSON DEFAULT NULL,
      icon_layout JSON DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_tenant (user_id, tenant_id),
      INDEX idx_user_id (user_id),
      INDEX idx_tenant_id (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户桌面显示偏好'
  `);
}

ensureTable().catch(err => console.error('创建桌面偏好表失败:', err.message));

router.get('/preferences', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user.id;

    if (!tenantId) {
      return res.json({ success: true, data: { hidden_modules: [], icon_layout: {} } });
    }

    const [rows] = await db.execute(
      `SELECT hidden_modules, icon_layout FROM ${USER_DESKTOP_PREFS_TABLE} WHERE user_id = ? AND tenant_id = ?`,
      [userId, tenantId],
    );

    if (rows.length === 0) {
      return res.json({ success: true, data: { hidden_modules: [], icon_layout: {} } });
    }

    const row = rows[0];
    let hiddenModules = [];
    let iconLayout = {};

    try {
      hiddenModules = row.hidden_modules ? JSON.parse(row.hidden_modules) : [];
    } catch { hiddenModules = []; }

    try {
      iconLayout = row.icon_layout ? JSON.parse(row.icon_layout) : {};
    } catch { iconLayout = {}; }

    res.json({ success: true, data: { hidden_modules: hiddenModules, icon_layout: iconLayout } });
  } catch (error) {
    console.error('获取桌面偏好失败:', error);
    res.status(500).json({ success: false, message: '获取桌面偏好失败' });
  }
});

router.put('/preferences', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user.id;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '租户ID不能为空' });
    }

    const { hidden_modules, icon_layout } = req.body;

    const hiddenModulesJson = Array.isArray(hidden_modules) ? JSON.stringify(hidden_modules) : null;
    const iconLayoutJson = icon_layout ? JSON.stringify(icon_layout) : null;

    await db.execute(
      `INSERT INTO ${USER_DESKTOP_PREFS_TABLE} (user_id, tenant_id, hidden_modules, icon_layout)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         hidden_modules = VALUES(hidden_modules),
         icon_layout = VALUES(icon_layout),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, tenantId, hiddenModulesJson, iconLayoutJson],
    );

    res.json({ success: true, message: '桌面偏好已保存' });
  } catch (error) {
    console.error('保存桌面偏好失败:', error);
    res.status(500).json({ success: false, message: '保存桌面偏好失败' });
  }
});

router.patch('/preferences/hide', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user.id;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '租户ID不能为空' });
    }

    const { module_key } = req.body;
    if (!module_key) {
      return res.status(400).json({ success: false, message: 'module_key不能为空' });
    }

    const [rows] = await db.execute(
      `SELECT hidden_modules FROM ${USER_DESKTOP_PREFS_TABLE} WHERE user_id = ? AND tenant_id = ?`,
      [userId, tenantId],
    );

    let hiddenModules = [];
    if (rows.length > 0 && rows[0].hidden_modules) {
      try { hiddenModules = JSON.parse(rows[0].hidden_modules); } catch { hiddenModules = []; }
    }

    if (!hiddenModules.includes(module_key)) {
      hiddenModules.push(module_key);
    }

    const hiddenModulesJson = JSON.stringify(hiddenModules);

    await db.execute(
      `INSERT INTO ${USER_DESKTOP_PREFS_TABLE} (user_id, tenant_id, hidden_modules, icon_layout)
       VALUES (?, ?, ?, NULL)
       ON DUPLICATE KEY UPDATE
         hidden_modules = VALUES(hidden_modules),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, tenantId, hiddenModulesJson],
    );

    res.json({ success: true, message: '模块图标已隐藏', data: { hidden_modules: hiddenModules } });
  } catch (error) {
    console.error('隐藏模块图标失败:', error);
    res.status(500).json({ success: false, message: '隐藏模块图标失败' });
  }
});

router.patch('/preferences/show', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user.id;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '租户ID不能为空' });
    }

    const { module_key } = req.body;
    if (!module_key) {
      return res.status(400).json({ success: false, message: 'module_key不能为空' });
    }

    const [rows] = await db.execute(
      `SELECT hidden_modules FROM ${USER_DESKTOP_PREFS_TABLE} WHERE user_id = ? AND tenant_id = ?`,
      [userId, tenantId],
    );

    let hiddenModules = [];
    if (rows.length > 0 && rows[0].hidden_modules) {
      try { hiddenModules = JSON.parse(rows[0].hidden_modules); } catch { hiddenModules = []; }
    }

    hiddenModules = hiddenModules.filter(m => m !== module_key);

    const hiddenModulesJson = JSON.stringify(hiddenModules);

    await db.execute(
      `INSERT INTO ${USER_DESKTOP_PREFS_TABLE} (user_id, tenant_id, hidden_modules, icon_layout)
       VALUES (?, ?, ?, NULL)
       ON DUPLICATE KEY UPDATE
         hidden_modules = VALUES(hidden_modules),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, tenantId, hiddenModulesJson],
    );

    res.json({ success: true, message: '模块图标已显示', data: { hidden_modules: hiddenModules } });
  } catch (error) {
    console.error('显示模块图标失败:', error);
    res.status(500).json({ success: false, message: '显示模块图标失败' });
  }
});

router.put('/preferences/layout', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user.id;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: '租户ID不能为空' });
    }

    const { icon_layout } = req.body;
    if (!icon_layout) {
      return res.status(400).json({ success: false, message: 'icon_layout不能为空' });
    }

    const iconLayoutJson = JSON.stringify(icon_layout);

    await db.execute(
      `INSERT INTO ${USER_DESKTOP_PREFS_TABLE} (user_id, tenant_id, hidden_modules, icon_layout)
       VALUES (?, ?, NULL, ?)
       ON DUPLICATE KEY UPDATE
         icon_layout = VALUES(icon_layout),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, tenantId, iconLayoutJson],
    );

    res.json({ success: true, message: '图标布局已保存' });
  } catch (error) {
    console.error('保存图标布局失败:', error);
    res.status(500).json({ success: false, message: '保存图标布局失败' });
  }
});

module.exports = router;
