/**
 * 通知配置与发送记录路由
 */
const express = require('express');
const router = express.Router();
const { authenticate, requireSystemAdmin } = require('../middleware/auth');
const configService = require('../services/notification-config.service');
const sendService = require('../services/notification-send.service');
const logService = require('../services/notification-log.service');
const logger = require('../config/logger');

/**
 * 获取元数据（流程类型、事件、接收人类型等）
 */
router.get('/metadata', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    res.json({ success: true, data: configService.getMetadata() });
  } catch (error) {
    logger.error('[NotificationRoutes] 获取元数据失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ===================== 通知模板 ===================== */

router.get('/templates', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { channel, keyword, page, pageSize } = req.query;
    const tenantId = req.user?.tenant_id || 0;
    const result = await configService.listTemplates({
      tenantId,
      channel,
      keyword,
      page,
      pageSize,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[NotificationRoutes] 查询模板失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/templates/:id', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const item = await configService.getTemplateById(req.params.id, tenantId);
    if (!item) return res.status(404).json({ success: false, message: '模板不存在' });
    res.json({ success: true, data: item });
  } catch (error) {
    logger.error('[NotificationRoutes] 获取模板失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/templates', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const item = await configService.createTemplate({ ...req.body, tenant_id: tenantId });
    res.json({ success: true, data: item, message: '模板创建成功' });
  } catch (error) {
    logger.error('[NotificationRoutes] 创建模板失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/templates/:id', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const item = await configService.updateTemplate(req.params.id, tenantId, req.body);
    if (!item) return res.status(404).json({ success: false, message: '模板不存在' });
    res.json({ success: true, data: item, message: '模板更新成功' });
  } catch (error) {
    logger.error('[NotificationRoutes] 更新模板失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/templates/:id', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    await configService.deleteTemplate(req.params.id, tenantId);
    res.json({ success: true, message: '模板删除成功' });
  } catch (error) {
    logger.error('[NotificationRoutes] 删除模板失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ===================== 通知规则 ===================== */

router.get('/rules', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { processType, eventCode, nodeCode, enabled, keyword, page, pageSize } = req.query;
    const tenantId = req.user?.tenant_id || 0;
    const result = await configService.listRules({
      tenantId,
      processType,
      eventCode,
      nodeCode,
      enabled: enabled !== undefined ? enabled === 'true' || enabled === '1' : undefined,
      keyword,
      page,
      pageSize,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[NotificationRoutes] 查询规则失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/rules/:id', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const item = await configService.getRuleById(req.params.id, tenantId);
    if (!item) return res.status(404).json({ success: false, message: '规则不存在' });
    res.json({ success: true, data: item });
  } catch (error) {
    logger.error('[NotificationRoutes] 获取规则失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/rules', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const item = await configService.createRule({ ...req.body, tenant_id: tenantId });
    res.json({ success: true, data: item, message: '规则创建成功' });
  } catch (error) {
    logger.error('[NotificationRoutes] 创建规则失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/rules/:id', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const item = await configService.updateRule(req.params.id, tenantId, req.body);
    if (!item) return res.status(404).json({ success: false, message: '规则不存在' });
    res.json({ success: true, data: item, message: '规则更新成功' });
  } catch (error) {
    logger.error('[NotificationRoutes] 更新规则失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/rules/:id', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    await configService.deleteRule(req.params.id, tenantId);
    res.json({ success: true, message: '规则删除成功' });
  } catch (error) {
    logger.error('[NotificationRoutes] 删除规则失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ===================== 发送测试 ===================== */

router.post('/rules/:id/test', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const result = await sendService.sendTestNotification({
      tenantId,
      ruleId: req.params.id,
      payload: req.body.payload || {},
    });
    res.json({ success: true, data: result, message: '测试发送已执行' });
  } catch (error) {
    logger.error('[NotificationRoutes] 测试发送失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ===================== 发送记录 ===================== */

router.get('/logs', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { ruleId, eventCode, channel, status, keyword, startDate, endDate, page, pageSize } = req.query;
    const tenantId = req.user?.tenant_id || 0;
    const result = await logService.listLogs({
      tenantId,
      ruleId,
      eventCode,
      channel,
      status,
      keyword,
      startDate,
      endDate,
      page,
      pageSize,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[NotificationRoutes] 查询发送记录失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/logs/stats', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { days } = req.query;
    const tenantId = req.user?.tenant_id || 0;
    const result = await logService.getStats(tenantId, days ? parseInt(days, 10) : 7);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[NotificationRoutes] 查询发送统计失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
