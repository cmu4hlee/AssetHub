const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireSystemAdmin } = require('../middleware/auth');
const { addTenantFilter, getTenantId, requireTenantId } = require('../middleware/tenant-filter');
const { buildDashboardData } = require('../services/dashboard-config.service');
const statsd = require('../utils/statsd');

router.use(authenticate);

const defaultDashboardConfig = {
  layout: 'grid',
  widgets: [
    { id: 'assets_total', type: 'stat', title: '资产总数', source: 'assets.count' },
    { id: 'assets_status', type: 'pie', title: '资产状态', source: 'assets.by_status' },
    { id: 'inventory_stats', type: 'stat', title: '盘点进行中', source: 'inventory.stats', metric: 'in_progress' },
    { id: 'transfer_pending', type: 'stat', title: '调配待审批', source: 'transfer.stats', metric: 'pending' },
    { id: 'idle_count', type: 'stat', title: '闲置资产', source: 'idle.count' },
  ],
};

async function ensureActiveDashboard(tenantId, createdBy) {
  const [rows] = await db.execute(
    'SELECT * FROM dashboard_configs WHERE tenant_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1',
    [tenantId],
  );
  if (rows.length > 0) return rows[0];

  const [result] = await db.execute(
    `INSERT INTO dashboard_configs (tenant_id, name, description, config_json, is_active, created_by, created_at)
     VALUES (?, ?, ?, ?, 1, ?, NOW())`,
    [
      tenantId,
      '默认仪表盘',
      '系统默认仪表盘',
      JSON.stringify(defaultDashboardConfig),
      createdBy || 'system',
    ],
  );

  const [createdRows] = await db.execute('SELECT * FROM dashboard_configs WHERE id = ?', [
    result.insertId,
  ]);
  return createdRows[0];
}

router.get('/', authenticate, async (req, res) => {
  try {
    const tenantFilter = addTenantFilter(req, 'dc');
    const [rows] = await db.execute(
      `SELECT dc.* FROM dashboard_configs dc WHERE 1=1 ${tenantFilter.whereClause} ORDER BY dc.is_active DESC, dc.id DESC`,
      tenantFilter.params,
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取仪表盘配置失败:', error);
    res.status(500).json({ success: false, message: '获取仪表盘配置失败', error: error.message });
  }
});

router.get('/active', requireTenantId, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const active = await ensureActiveDashboard(tenantId, req.user?.username);
    res.json({ success: true, data: active });
  } catch (error) {
    console.error('获取激活仪表盘失败:', error);
    res.status(500).json({ success: false, message: '获取激活仪表盘失败', error: error.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = addTenantFilter(req, 'dc');
    const [rows] = await db.execute(
      `SELECT dc.* FROM dashboard_configs dc WHERE dc.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '仪表盘配置不存在' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('获取仪表盘配置失败:', error);
    res.status(500).json({ success: false, message: '获取仪表盘配置失败', error: error.message });
  }
});

router.post('/', requireSystemAdmin, requireTenantId, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { name, description, config_json, is_active } = req.body;

    if (!name || !config_json) {
      return res.status(400).json({ success: false, message: '名称和配置不能为空' });
    }

    if (is_active) {
      await db.execute('UPDATE dashboard_configs SET is_active = 0 WHERE tenant_id = ?', [
        tenantId,
      ]);
    }

    const payload = typeof config_json === 'string' ? config_json : JSON.stringify(config_json);
    const [result] = await db.execute(
      `INSERT INTO dashboard_configs (tenant_id, name, description, config_json, is_active, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        tenantId,
        name,
        description || null,
        payload,
        is_active ? 1 : 0,
        req.user?.username || null,
      ],
    );

    res.json({ success: true, message: '仪表盘配置已创建', data: { id: result.insertId } });
  } catch (error) {
    console.error('创建仪表盘配置失败:', error);
    res.status(500).json({ success: false, message: '创建仪表盘配置失败', error: error.message });
  }
});

router.put('/:id', requireSystemAdmin, requireTenantId, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const { name, description, config_json, is_active } = req.body;

    const [existing] = await db.execute(
      'SELECT id FROM dashboard_configs WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '仪表盘配置不存在' });
    }

    if (is_active) {
      await db.execute('UPDATE dashboard_configs SET is_active = 0 WHERE tenant_id = ?', [
        tenantId,
      ]);
    }

    const updateFields = [];
    const updateValues = [];
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (config_json !== undefined) {
      updateFields.push('config_json = ?');
      updateValues.push(typeof config_json === 'string' ? config_json : JSON.stringify(config_json));
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active ? 1 : 0);
    }

    if (updateFields.length > 0) {
      updateValues.push(id, tenantId);
      await db.execute(
        `UPDATE dashboard_configs SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
        updateValues,
      );
    }

    res.json({ success: true, message: '仪表盘配置已更新' });
  } catch (error) {
    console.error('更新仪表盘配置失败:', error);
    res.status(500).json({ success: false, message: '更新仪表盘配置失败', error: error.message });
  }
});

router.delete('/:id', requireSystemAdmin, requireTenantId, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    await db.execute('DELETE FROM dashboard_configs WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    res.json({ success: true, message: '仪表盘配置已删除' });
  } catch (error) {
    console.error('删除仪表盘配置失败:', error);
    res.status(500).json({ success: false, message: '删除仪表盘配置失败', error: error.message });
  }
});

router.get('/:id/data', requireTenantId, async (req, res) => {
  const start = Date.now();
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    const [rows] = await db.execute(
      'SELECT * FROM dashboard_configs WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '仪表盘配置不存在' });
    }

    const configRow = rows[0];
    let config = {};
    try {
      config = configRow.config_json ? JSON.parse(configRow.config_json) : {};
    } catch (error) {
      console.warn('仪表盘配置解析失败:', error.message);
    }

    const data = await buildDashboardData(config, tenantId);
    statsd.timing('dashboard.data.fetch', Date.now() - start);

    res.json({ success: true, data });
  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    res.status(500).json({ success: false, message: '获取仪表盘数据失败', error: error.message });
  }
});

module.exports = router;
