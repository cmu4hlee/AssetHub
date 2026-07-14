/**
 * @swagger
 * /api/cloud-sync/webhook/{sourceId}:
 *   post:
 *     summary: 接收云同步Webhook事件
 *     description: 接收来自外部系统的资产/设备同步事件
 *     tags: [云同步]
 *     parameters:
 *       - in: path
 *         name: sourceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 同步源ID
 *       - in: header
 *         name: X-Webhook-Token
 *         schema:
 *           type: string
 *         description: Webhook认证令牌
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event_type:
 *                 type: string
 *                 description: 事件类型
 *               payload:
 *                 type: object
 *                 description: 事件数据
 *               asset:
 *                 type: object
 *                 description: 资产数据
 *               device:
 *                 type: object
 *                 description: 设备数据
 *     responses:
 *       200:
 *         description: 处理成功
 *       401:
 *         description: Token无效
 *       404:
 *         description: 同步源不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/cloud-sync/sources:
 *   get:
 *     summary: 获取同步源列表
 *     tags: [云同步]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 *   post:
 *     summary: 创建同步源
 *     tags: [云同步]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - source_type
 *             properties:
 *               name:
 *                 type: string
 *                 description: 同步源名称
 *               source_type:
 *                 type: string
 *                 description: 同步源类型
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *               secret_token:
 *                 type: string
 *                 description: 密钥令牌
 *               config_json:
 *                 type: object
 *                 description: 配置JSON
 *     responses:
 *       200:
 *         description: 创建成功
 *       400:
 *         description: 参数错误
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/cloud-sync/sources/{id}:
 *   put:
 *     summary: 更新同步源
 *     tags: [云同步]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 同步源ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               source_type:
 *                 type: string
 *               status:
 *                 type: string
 *               secret_token:
 *                 type: string
 *               config_json:
 *                 type: object
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 同步源不存在
 *       500:
 *         description: 服务器错误
 *   delete:
 *     summary: 删除同步源
 *     tags: [云同步]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 同步源ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/cloud-sync/events:
 *   get:
 *     summary: 获取同步事件列表
 *     tags: [云同步]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页数量
 *       - in: query
 *         name: source_id
 *         schema:
 *           type: integer
 *         description: 同步源ID
 *     responses:
 *       200:
 *         description: 成功
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/cloud-sync/events/stream:
 *   get:
 *     summary: 订阅同步事件流
 *     description: SSE流式获取实时同步事件
 *     tags: [云同步]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: since_id
 *         schema:
 *           type: integer
 *         description: 从指定ID之后开始
 *     responses:
 *       200:
 *         description: 成功
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireSystemAdmin } = require('../middleware/auth');
const { addTenantFilter, getTenantId, requireTenantId } = require('../middleware/tenant-filter');

const tableColumnCache = new Map();

async function getTableColumns(connection, tableName) {
  if (tableColumnCache.has(tableName)) {
    return tableColumnCache.get(tableName);
  }
  const [rows] = await connection.execute(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [tableName],
  );
  const columns = rows.map(row => row.COLUMN_NAME);
  tableColumnCache.set(tableName, columns);
  return columns;
}

async function getDefaultCategoryId(connection, tenantId) {
  const [rows] = await connection.execute(
    'SELECT id FROM asset_categories WHERE tenant_id = ? ORDER BY id ASC LIMIT 1',
    [tenantId],
  );
  if (rows.length > 0) return rows[0].id;

  const code = `DEFAULT-${tenantId}-${Date.now()}`;
  const [result] = await connection.execute(
    `INSERT INTO asset_categories (tenant_id, name, code, parent_id, description)
     VALUES (?, '默认分类', ?, 0, '云同步自动创建')`,
    [tenantId, code],
  );
  return result.insertId;
}

async function upsertAsset(connection, tenantId, assetPayload) {
  if (!assetPayload || !assetPayload.asset_code) {
    throw new Error('ASSET_CODE_REQUIRED');
  }

  const columns = await getTableColumns(connection, 'assets');
  const [existing] = await connection.execute(
    'SELECT id FROM assets WHERE asset_code = ? AND tenant_id = ? LIMIT 1',
    [assetPayload.asset_code, tenantId],
  );

  const updates = [];
  const values = [];
  const insertFields = [];
  const insertValues = [];

  const addField = (field, value, forInsert = true, forUpdate = true) => {
    if (!columns.includes(field) || value === undefined) return;
    if (forInsert) {
      insertFields.push(field);
      insertValues.push(value);
    }
    if (forUpdate) {
      updates.push(`${field} = ?`);
      values.push(value);
    }
  };

  addField('tenant_id', tenantId, true, false);
  addField('asset_code', assetPayload.asset_code, true, false);
  addField('code', assetPayload.code || assetPayload.asset_code);
  addField('asset_name', assetPayload.asset_name || assetPayload.asset_code);
  addField('brand', assetPayload.brand);
  addField('model', assetPayload.model);
  addField('specification', assetPayload.specification);
  addField('status', assetPayload.status);
  addField('department', assetPayload.department);
  addField('department_new', assetPayload.department_new);
  addField('location', assetPayload.location);
  addField('responsible_person', assetPayload.responsible_person);
  addField('remark', assetPayload.remark);
  addField('updated_by', assetPayload.updated_by || 'cloud_sync', false, true);

  if (columns.includes('asset_type')) {
    const assetType = assetPayload.asset_type || '普通设备';
    addField('asset_type', assetType, true, existing.length === 0);
  }

  if (columns.includes('category_id')) {
    const categoryId = assetPayload.category_id || (await getDefaultCategoryId(connection, tenantId));
    addField('category_id', categoryId, true, existing.length === 0);
  }

  if (existing.length === 0) {
    if (!columns.includes('created_by')) {
      // no-op
    } else {
      insertFields.push('created_by');
      insertValues.push(assetPayload.created_by || 'cloud_sync');
    }

    const placeholders = insertFields.map(() => '?').join(', ');
    await connection.execute(
      `INSERT INTO assets (${insertFields.join(', ')}) VALUES (${placeholders})`,
      insertValues,
    );
    return { action: 'inserted' };
  }

  if (updates.length > 0) {
    values.push(existing[0].id, tenantId);
    await connection.execute(
      `UPDATE assets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values,
    );
  }
  return { action: 'updated' };
}

async function upsertDevice(connection, tenantId, devicePayload) {
  if (!devicePayload || !devicePayload.device_id) {
    throw new Error('DEVICE_ID_REQUIRED');
  }
  const columns = await getTableColumns(connection, 'iot_devices');
  const [existing] = await connection.execute(
    'SELECT id FROM iot_devices WHERE device_id = ? AND tenant_id = ? LIMIT 1',
    [devicePayload.device_id, tenantId],
  );

  const updates = [];
  const values = [];
  const insertFields = [];
  const insertValues = [];

  const addField = (field, value, forInsert = true, forUpdate = true) => {
    if (!columns.includes(field) || value === undefined) return;
    if (forInsert) {
      insertFields.push(field);
      insertValues.push(value);
    }
    if (forUpdate) {
      updates.push(`${field} = ?`);
      values.push(value);
    }
  };

  addField('tenant_id', tenantId, true, false);
  addField('device_id', devicePayload.device_id, true, false);
  addField('device_name', devicePayload.device_name || devicePayload.device_id);
  addField('device_type', devicePayload.device_type);
  addField('manufacturer', devicePayload.manufacturer);
  addField('model', devicePayload.model);
  addField('serial_number', devicePayload.serial_number);
  addField('mac_address', devicePayload.mac_address);
  addField('firmware_version', devicePayload.firmware_version);
  addField('status', devicePayload.status);
  addField('remark', devicePayload.remark);

  if (existing.length === 0) {
    const placeholders = insertFields.map(() => '?').join(', ');
    await connection.execute(
      `INSERT INTO iot_devices (${insertFields.join(', ')}) VALUES (${placeholders})`,
      insertValues,
    );
    return { action: 'inserted' };
  }

  if (updates.length > 0) {
    values.push(existing[0].id, tenantId);
    await connection.execute(
      `UPDATE iot_devices SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values,
    );
  }
  return { action: 'updated' };
}

async function processEvent(connection, tenantId, eventType, payload) {
  const results = [];
  const assetPayload =
    payload?.asset || (eventType && eventType.startsWith('asset.') ? payload : null);
  const devicePayload =
    payload?.device || (eventType && eventType.startsWith('iot.') ? payload : null);

  if (assetPayload) {
    results.push(await upsertAsset(connection, tenantId, assetPayload));
  }
  if (devicePayload) {
    results.push(await upsertDevice(connection, tenantId, devicePayload));
  }

  return results;
}

// Webhook 接收（不需要登录，使用 token 验证）
router.post('/webhook/:sourceId', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { sourceId } = req.params;
    const [sources] = await connection.execute(
      'SELECT * FROM cloud_sync_sources WHERE id = ? AND status = "active" AND tenant_id IS NOT NULL',
      [sourceId],
    );
    if (sources.length === 0) {
      return res.status(404).json({ success: false, message: '同步源不存在或已禁用' });
    }

    const source = sources[0];
    if (!source.tenant_id) {
      return res.status(400).json({ success: false, message: '同步源未关联租户' });
    }

    const token = req.header('X-Webhook-Token') || req.query.token || '';
    if (source.secret_token && source.secret_token !== token) {
      return res.status(401).json({ success: false, message: 'Webhook token 无效' });
    }

    const body = req.body || {};
    const eventType = body.event_type || body.type || 'unknown';
    const payload = body.payload || body.data || body;

    const [eventResult] = await connection.execute(
      `INSERT INTO cloud_sync_events (tenant_id, source_id, event_type, event_payload, status, created_at)
       VALUES (?, ?, ?, ?, 'received', NOW())`,
      [source.tenant_id, source.id, eventType, JSON.stringify(payload)],
    );

    let processingError = null;
    try {
      await processEvent(connection, source.tenant_id, eventType, payload);
      await connection.execute(
        'UPDATE cloud_sync_events SET status = "processed", processed_at = NOW() WHERE id = ?',
        [eventResult.insertId],
      );
    } catch (error) {
      processingError = error;
      await connection.execute(
        'UPDATE cloud_sync_events SET status = "failed", processed_at = NOW(), error_message = ? WHERE id = ?',
        [error.message, eventResult.insertId],
      );
    }

    res.json({
      success: true,
      data: { event_id: eventResult.insertId, status: processingError ? 'failed' : 'processed' },
      error: processingError ? processingError.message : null,
    });
  } catch (error) {
    console.error('Webhook处理失败:', error);
    res.status(500).json({ success: false, message: 'Webhook处理失败', error: error.message });
  } finally {
    connection.release();
  }
});

router.use(authenticate);

router.get('/sources', requireSystemAdmin, async (req, res) => {
  try {
    const tenantFilter = addTenantFilter(req, 'cs');
    const [rows] = await db.execute(
      `SELECT cs.* FROM cloud_sync_sources cs WHERE 1=1 ${tenantFilter.whereClause} ORDER BY cs.id DESC`,
      tenantFilter.params,
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取同步源失败:', error);
    res.status(500).json({ success: false, message: '获取同步源失败', error: error.message });
  }
});

router.post('/sources', requireSystemAdmin, requireTenantId, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { name, source_type, status = 'active', secret_token, config_json } = req.body;

    if (!name || !source_type) {
      return res.status(400).json({ success: false, message: '名称和类型不能为空' });
    }

    const payload = config_json ? (typeof config_json === 'string' ? config_json : JSON.stringify(config_json)) : null;
    const [result] = await db.execute(
      `INSERT INTO cloud_sync_sources (tenant_id, name, source_type, status, secret_token, config_json, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [tenantId, name, source_type, status, secret_token || null, payload, req.user?.username || null],
    );
    res.json({ success: true, message: '同步源已创建', data: { id: result.insertId } });
  } catch (error) {
    console.error('创建同步源失败:', error);
    res.status(500).json({ success: false, message: '创建同步源失败', error: error.message });
  }
});

router.put('/sources/:id', requireSystemAdmin, requireTenantId, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const { name, source_type, status, secret_token, config_json } = req.body;

    const [existing] = await db.execute(
      'SELECT id FROM cloud_sync_sources WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '同步源不存在' });
    }

    const updateFields = [];
    const updateValues = [];
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (source_type !== undefined) {
      updateFields.push('source_type = ?');
      updateValues.push(source_type);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (secret_token !== undefined) {
      updateFields.push('secret_token = ?');
      updateValues.push(secret_token);
    }
    if (config_json !== undefined) {
      updateFields.push('config_json = ?');
      updateValues.push(typeof config_json === 'string' ? config_json : JSON.stringify(config_json));
    }

    if (updateFields.length > 0) {
      updateValues.push(id, tenantId);
      await db.execute(
        `UPDATE cloud_sync_sources SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
        updateValues,
      );
    }

    res.json({ success: true, message: '同步源已更新' });
  } catch (error) {
    console.error('更新同步源失败:', error);
    res.status(500).json({ success: false, message: '更新同步源失败', error: error.message });
  }
});

router.delete('/sources/:id', requireSystemAdmin, requireTenantId, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    await db.execute('DELETE FROM cloud_sync_sources WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    res.json({ success: true, message: '同步源已删除' });
  } catch (error) {
    console.error('删除同步源失败:', error);
    res.status(500).json({ success: false, message: '删除同步源失败', error: error.message });
  }
});

router.get('/events', requireSystemAdmin, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, source_id } = req.query;
    const offset = (page - 1) * pageSize;
    const tenantFilter = addTenantFilter(req, 'ce');
    let whereClause = `WHERE 1=1 ${tenantFilter.whereClause}`;
    const params = [...tenantFilter.params];

    if (source_id) {
      whereClause += ' AND ce.source_id = ?';
      params.push(source_id);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM cloud_sync_events ce ${whereClause}`,
      params,
    );
    const total = countRows[0]?.total || 0;

    const [rows] = await db.execute(
      `SELECT ce.* FROM cloud_sync_events ce ${whereClause} ORDER BY ce.id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取同步事件失败:', error);
    res.status(500).json({ success: false, message: '获取同步事件失败', error: error.message });
  }
});

router.get('/events/stream', requireSystemAdmin, requireTenantId, async (req, res) => {
  const tenantId = getTenantId(req);
  let lastId = Number(req.query.since_id) || 0;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const interval = setInterval(async () => {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM cloud_sync_events WHERE tenant_id = ? AND id > ? ORDER BY id ASC LIMIT 100',
        [tenantId, lastId],
      );
      rows.forEach(row => {
        lastId = row.id;
        res.write(`event: cloud-sync\ndata: ${JSON.stringify(row)}\n\n`);
      });
    } catch (error) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
    }
  }, 3000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

module.exports = router;
