/**
 * 用户通知偏好 REST 路由
 *
 * 提供：
 *   - GET    /api/notification-preferences/me              - 我的所有偏好
 *   - GET    /api/notification-preferences/me/effective    - 我的合并偏好（用于前端展示）
 *   - GET    /api/notification-preferences/meta            - 元数据（紧急度档位、星期选项等）
 *   - POST   /api/notification-preferences                - 新建/更新偏好（upsert by user_id+event_code）
 *   - DELETE /api/notification-preferences/:id            - 删除（恢复默认）
 *   - GET    /api/notification-preferences/user/:userId   - 查某用户（仅管理员/自己）
 *   - POST   /api/notification-preferences/preview         - 预览：在指定时间和紧急度下评估是否推送
 */
const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { authenticate, requireSystemAdmin } = require('../middleware/auth');
const prefService = require('../services/notification-preference.service');

/* ===================== 元数据 ===================== */

router.get('/meta', authenticate, async (req, res) => {
  res.json({
    success: true,
    data: {
      urgencyLevels: prefService.URGENCY_LEVELS,
      dndDayOptions: prefService.DND_DAY_OPTIONS,
      defaults: prefService.getDefaultPreferences(),
    },
  });
});

/* ===================== 我的偏好 ===================== */

router.get('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenant_id || 0;
    if (!userId) return res.status(401).json({ success: false, message: '未登录' });
    const result = await prefService.listPreferences({ userId, tenantId, pageSize: 100 });
    res.json({ success: true, data: result });
  } catch (e) {
    logger.error('[NotifPrefAPI] 我的偏好查询失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * 我的合并偏好（单事件 → 覆盖全局 → 默认）
 * GET /api/notification-preferences/me/effective?eventCode=xxx
 */
router.get('/me/effective', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: '未登录' });
    const { eventCode } = req.query;
    const prefs = await prefService.getCachedPreferences(userId, eventCode || null);
    const effective = prefs || prefService.getDefaultPreferences();
    res.json({ success: true, data: { userId, eventCode: eventCode || null, preferences: effective } });
  } catch (e) {
    logger.error('[NotifPrefAPI] 合并偏好查询失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/* ===================== 新建/更新偏好 ===================== */

/**
 * upsert 偏好
 * body 必填：user_id, event_code (null=全局), enabled, urgency_threshold, ...
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const body = { ...req.body };
    // 自己的偏好只能改自己的（除非是管理员）
    if (!body.user_id) body.user_id = req.user.id;
    if (Number(body.user_id) !== Number(req.user.id) && !req.user.role?.includes('admin')) {
      return res.status(403).json({ success: false, message: '无权限修改其他用户的偏好' });
    }
    body.tenant_id = body.tenant_id || req.user.tenant_id || 0;
    const item = await prefService.upsertPreference(body);
    res.json({ success: true, data: item, message: '偏好已保存' });
  } catch (e) {
    logger.error('[NotifPrefAPI] 保存失败:', e.message);
    res.status(400).json({ success: false, message: e.message });
  }
});

/* ===================== 删除 ===================== */

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role?.includes('admin');
    const ok = await prefService.deletePreference(req.params.id, isAdmin ? null : userId);
    if (!ok) return res.status(404).json({ success: false, message: '偏好不存在或无权限' });
    res.json({ success: true, message: '已删除（恢复默认行为）' });
  } catch (e) {
    logger.error('[NotifPrefAPI] 删除失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/* ===================== 管理员查任意用户 ===================== */

router.get('/user/:userId', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const result = await prefService.listPreferences({
      userId: parseInt(req.params.userId, 10),
      tenantId,
      pageSize: 100,
    });
    res.json({ success: true, data: result });
  } catch (e) {
    logger.error('[NotifPrefAPI] 查用户偏好失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/* ===================== 预览（在指定时间+紧急度下是否推送） ===================== */

router.post('/preview', authenticate, async (req, res) => {
  try {
    const { userId, eventCode, urgency, now } = req.body || {};
    const targetUserId = userId || req.user.id;
    if (!urgency) return res.status(400).json({ success: false, message: 'urgency 必填' });
    const nowDate = now ? new Date(now) : new Date();
    const prefs = await prefService.getCachedPreferences(targetUserId, eventCode || null);
    const effective = prefs || prefService.getDefaultPreferences();
    const willDeliver = prefService.shouldDeliverByPrefs(effective, urgency, nowDate);
    const reason = willDeliver ? null : prefService.getSilentReason(effective, urgency, nowDate);
    res.json({
      success: true,
      data: {
        willDeliver,
        reason,
        preferences: effective,
        now: nowDate.toISOString(),
      },
    });
  } catch (e) {
    logger.error('[NotifPrefAPI] 预览失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
