/**
 * 站内消息 REST 路由
 * 提供消息列表、未读数、已读标记、删除等接口
 * 用于前端页面刷新后拉取历史消息
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, requireSystemAdmin } = require('../middleware/auth');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * 开发测试端点：手动触发一个站内通知事件
 * POST /api/in-app-notifications/_test-publish
 * body: { eventCode, payload }
 * 仅在 NODE_ENV !== 'production' 时启用
 */
router.post('/_test-publish', authenticate, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: '生产环境禁用此端点' });
  }
  try {
    const { eventCode = 'maintenance_request:created', payload = {} } = req.body || {};
    const fullPayload = {
      tenantId: req.user?.tenant_id || 2,
      applicantId: req.user?.id,
      request_person_id: req.user?.id,
      request_person: req.user?.username || 'test',
      ...payload,
    };
    const { publish } = require('../core/EventBus');
    publish(eventCode, fullPayload);
    res.json({ success: true, data: { eventCode, payload: fullPayload }, message: '事件已发布' });
  } catch (e) {
    logger.error('[InAppNotifAPI] 测试发布失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * 当前用户消息列表
 * GET /api/in-app-notifications?isRead=&category=&keyword=&page=&pageSize=
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    const tenantId = req.user?.tenant_id || 0;
    const { isRead, category, keyword, page = 1, pageSize = DEFAULT_PAGE_SIZE } = req.query;

    const conditions = ['user_id = ?', '(tenant_id = ? OR tenant_id = 0)'];
    const params = [userId, tenantId];

    if (isRead === 'true' || isRead === '1') {
      conditions.push('is_read = 1');
    } else if (isRead === 'false' || isRead === '0') {
      conditions.push('is_read = 0');
    }
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (keyword) {
      conditions.push('(title LIKE ? OR content LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    // 排除过期
    conditions.push('(expires_at IS NULL OR expires_at > NOW())');

    const where = conditions.join(' AND ');
    const limit = Math.min(parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

    const [[countRows]] = await db.execute(
      `SELECT COUNT(*) AS total FROM in_app_notifications WHERE ${where}`,
      params,
    );

    const [rows] = await db.execute(
      `SELECT id, tenant_id, user_id, event_code, category, title, content,
              urgency, action_url, action_text, is_read, read_at, created_at, expires_at
       FROM in_app_notifications
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    res.json({
      success: true,
      data: {
        list: rows.map(r => ({
          ...r,
          is_read: !!r.is_read,
        })),
        pagination: {
          total: countRows.total || 0,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
          pages: Math.ceil((countRows.total || 0) / limit),
        },
      },
    });
  } catch (e) {
    logger.error('[InAppNotifAPI] 列表查询失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * 未读消息数量
 * GET /api/in-app-notifications/unread-count
 * 可选 ?category=xxx 按分类统计
 */
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    const tenantId = req.user?.tenant_id || 0;
    const { category } = req.query;

    const conditions = ['user_id = ?', 'is_read = 0', '(tenant_id = ? OR tenant_id = 0)',
      '(expires_at IS NULL OR expires_at > NOW())'];
    const params = [userId, tenantId];
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    const where = conditions.join(' AND ');

    const [[rows]] = await db.execute(
      `SELECT COUNT(*) AS total FROM in_app_notifications WHERE ${where}`,
      params,
    );

    res.json({ success: true, data: { unread: rows.total || 0 } });
  } catch (e) {
    logger.error('[InAppNotifAPI] 未读数查询失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * 标记单条已读
 * POST /api/in-app-notifications/:id/read
 */
router.post('/:id/read', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ success: false, message: '无效的 id' });
    }
    const [result] = await db.execute(
      `UPDATE in_app_notifications
       SET is_read = 1, read_at = NOW()
       WHERE id = ? AND user_id = ? AND is_read = 0`,
      [id, userId],
    );
    res.json({ success: true, data: { affected: result.affectedRows } });
  } catch (e) {
    logger.error('[InAppNotifAPI] 标记已读失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * 批量标记已读
 * POST /api/in-app-notifications/batch-read
 * body: { ids: [1,2,3] } 或 {} (全标已读)
 */
router.post('/batch-read', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    const { ids } = req.body || {};
    let result;
    if (Array.isArray(ids) && ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      // 防止 SQL 注入：仅保留数字
      const safeIds = ids.map(n => parseInt(n, 10)).filter(Number.isFinite);
      if (!safeIds.length) {
        return res.status(400).json({ success: false, message: 'ids 为空或无效' });
      }
      [result] = await db.execute(
        `UPDATE in_app_notifications
         SET is_read = 1, read_at = NOW()
         WHERE user_id = ? AND is_read = 0 AND id IN (${safeIds.map(() => '?').join(',')})`,
        [userId, ...safeIds],
      );
    } else {
      [result] = await db.execute(
        `UPDATE in_app_notifications
         SET is_read = 1, read_at = NOW()
         WHERE user_id = ? AND is_read = 0`,
        [userId],
      );
    }
    res.json({ success: true, data: { affected: result.affectedRows } });
  } catch (e) {
    logger.error('[InAppNotifAPI] 批量标记已读失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * 全部标记已读
 * POST /api/in-app-notifications/read-all
 */
router.post('/read-all', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    const tenantId = req.user?.tenant_id || 0;
    const { category } = req.body || {};

    const conditions = ['user_id = ?', 'is_read = 0', '(tenant_id = ? OR tenant_id = 0)'];
    const params = [userId, tenantId];
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    const where = conditions.join(' AND ');

    const [result] = await db.execute(
      `UPDATE in_app_notifications
       SET is_read = 1, read_at = NOW()
       WHERE ${where}`,
      params,
    );
    res.json({ success: true, data: { affected: result.affectedRows } });
  } catch (e) {
    logger.error('[InAppNotifAPI] 全部标记已读失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * 删除单条
 * DELETE /api/in-app-notifications/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ success: false, message: '无效的 id' });
    }
    const [result] = await db.execute(
      `DELETE FROM in_app_notifications WHERE id = ? AND user_id = ?`,
      [id, userId],
    );
    res.json({ success: true, data: { affected: result.affectedRows } });
  } catch (e) {
    logger.error('[InAppNotifAPI] 删除失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * 批量删除
 * DELETE /api/in-app-notifications/batch
 * body: { ids: [1,2,3] }
 */
router.delete('/batch', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ success: false, message: 'ids 必填' });
    }
    const safeIds = ids.map(n => parseInt(n, 10)).filter(Number.isFinite);
    if (!safeIds.length) {
      return res.status(400).json({ success: false, message: 'ids 为空或无效' });
    }
    const [result] = await db.execute(
      `DELETE FROM in_app_notifications WHERE user_id = ? AND id IN (${safeIds.map(() => '?').join(',')})`,
      [userId, ...safeIds],
    );
    res.json({ success: true, data: { affected: result.affectedRows } });
  } catch (e) {
    logger.error('[InAppNotifAPI] 批量删除失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * 清空已读
 * POST /api/in-app-notifications/clear-read
 */
router.post('/clear-read', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    const [result] = await db.execute(
      `DELETE FROM in_app_notifications WHERE user_id = ? AND is_read = 1`,
      [userId],
    );
    res.json({ success: true, data: { affected: result.affectedRows } });
  } catch (e) {
    logger.error('[InAppNotifAPI] 清空已读失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/* ===================== 运维端点（仅系统管理员） ===================== */

/**
 * 站内消息统计 + 调度器配置
 * GET /api/in-app-notifications/admin/stats
 */
router.get('/admin/stats', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const scheduler = require('../services/in-app-notification.scheduler');
    const stats = await scheduler.getStats();
    res.json({ success: true, data: stats });
  } catch (e) {
    logger.error('[InAppNotifAPI] 获取统计失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * 手动触发清理
 * POST /api/in-app-notifications/admin/cleanup
 * body: { mode: 'expired' | 'old_read' | 'all' }  默认 'all'
 */
router.post('/admin/cleanup', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const scheduler = require('../services/in-app-notification.scheduler');
    const mode = (req.body?.mode || 'all').toLowerCase();

    let result;
    if (mode === 'expired') {
      result = await scheduler.cleanExpired();
      result = { expired: result.deleted, rounds: { expired: result.rounds } };
    } else if (mode === 'old_read') {
      result = await scheduler.cleanOldRead();
      result = { oldRead: result.deleted, rounds: { oldRead: result.rounds } };
    } else {
      result = await scheduler.runOnce();
    }

    logger.info(
      `[InAppNotifAPI] 管理员 ${req.user.username} (id=${req.user.id}) 手动清理站内消息: mode=${mode}, result=${JSON.stringify(result)}`,
    );
    res.json({ success: true, data: result, message: '清理完成' });
  } catch (e) {
    logger.error('[InAppNotifAPI] 手动清理失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
