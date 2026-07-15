/**
 * 接收人策略 REST 路由
 *
 * 提供：
 *   - GET    /api/recipient-strategies/meta                 - 元数据（策略类型、所有可用事件）
 *   - GET    /api/recipient-strategies                     - 列表（分页 + 按 eventCode 过滤）
 *   - GET    /api/recipient-strategies/event/:eventCode    - 查某事件的所有策略
 *   - POST   /api/recipient-strategies                     - 新增
 *   - PUT    /api/recipient-strategies/:id                 - 修改
 *   - DELETE /api/recipient-strategies/:id                 - 删除
 *   - POST   /api/recipient-strategies/batch-delete        - 批量删除
 *   - POST   /api/recipient-strategies/preview             - 预览解析结果（不落库）
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, requireSystemAdmin } = require('../middleware/auth');
const strategyService = require('../services/recipient-strategy.service');

/* ===================== 元数据 ===================== */

router.get('/meta', authenticate, async (req, res) => {
  try {
    // 查所有已支持的事件编码（去重）
    const [rows] = await db.execute(
      `SELECT DISTINCT event_code FROM recipient_strategies ORDER BY event_code`,
    );
    const configuredEvents = rows.map(r => r.event_code);

    // 已知事件分类（与 in-app-notification.service.js 中的 category 对应）
    const knownEvents = [
      // 维修
      { eventCode: 'maintenance:approved', category: 'maintenance', title: '维修工单审批通过' },
      { eventCode: 'maintenance_request:created', category: 'maintenance', title: '维修申请创建' },
      { eventCode: 'maintenance_request:approved', category: 'maintenance', title: '维修申请批准' },
      { eventCode: 'maintenance_request:rejected', category: 'maintenance', title: '维修申请拒绝' },
      { eventCode: 'maintenance_request:started', category: 'maintenance', title: '维修开始' },
      { eventCode: 'maintenance_request:completed', category: 'maintenance', title: '维修完成' },
      { eventCode: 'maintenance_request:cancelled', category: 'maintenance', title: '维修取消' },
      { eventCode: 'workorder:assigned', category: 'maintenance', title: '工单派发' },
      { eventCode: 'workorder:completed', category: 'maintenance', title: '工单完成' },
      // 资产
      { eventCode: 'scrapping:created', category: 'scrapping', title: '报废申请' },
      { eventCode: 'scrapping:approved', category: 'scrapping', title: '报废通过' },
      { eventCode: 'scrapping:rejected', category: 'scrapping', title: '报废驳回' },
      { eventCode: 'scrapping:completed', category: 'scrapping', title: '报废完成' },
      { eventCode: 'transfer:created', category: 'transfer', title: '调配申请' },
      { eventCode: 'transfer:approved', category: 'transfer', title: '调配通过' },
      { eventCode: 'transfer:rejected', category: 'transfer', title: '调配驳回' },
      { eventCode: 'transfer:completed', category: 'transfer', title: '调配完成' },
      { eventCode: 'asset_workflow:transition', category: 'asset', title: '资产状态变更' },
      { eventCode: 'asset_usage:checkout', category: 'asset_usage', title: '资产领用' },
      { eventCode: 'asset_usage:return', category: 'asset_usage', title: '资产归还' },
      // 盘点
      { eventCode: 'inventory:created', category: 'inventory', title: '盘点创建' },
      { eventCode: 'inventory:completed', category: 'inventory', title: '盘点完成' },
      { eventCode: 'inventory_task:created', category: 'inventory', title: '盘点任务分配' },
      { eventCode: 'inventory_task:completed', category: 'inventory', title: '盘点任务完成' },
      { eventCode: 'inventory_task:cancelled', category: 'inventory', title: '盘点任务取消' },
      // 招标
      { eventCode: 'tender:created', category: 'tendering', title: '招标项目创建' },
      { eventCode: 'tender:published', category: 'tendering', title: '招标发布' },
      { eventCode: 'tender:awarded', category: 'tendering', title: '招标定标' },
      { eventCode: 'tender:completed', category: 'tendering', title: '招标完成' },
      { eventCode: 'tender:cancelled', category: 'tendering', title: '招标取消' },
      { eventCode: 'bid:submitted', category: 'tendering', title: '收到新投标' },
      { eventCode: 'bid:awarded', category: 'tendering', title: '中标结果' },
      { eventCode: 'qualification:reviewed', category: 'tendering', title: '资质审核' },
      { eventCode: 'tender:invitation-sent', category: 'tendering', title: '招标邀请' },
      // 财务
      { eventCode: 'tender:invoice:created', category: 'finance', title: '发票待审核' },
      { eventCode: 'tender:invoice:verified', category: 'finance', title: '发票审核通过' },
      { eventCode: 'tender:invoice:claimed', category: 'finance', title: '发票认领' },
      { eventCode: 'tender:invoice:paid', category: 'finance', title: '发票付款' },
      { eventCode: 'tender:invoice:archived', category: 'finance', title: '发票归档' },
      { eventCode: 'tender:invoice:cancelled', category: 'finance', title: '发票取消' },
      { eventCode: 'tender:payment:created', category: 'finance', title: '付款单创建' },
      { eventCode: 'tender:payment:submitted', category: 'finance', title: '付款单提交' },
      { eventCode: 'tender:payment:paid', category: 'finance', title: '付款成功' },
      { eventCode: 'tender:payment:failed', category: 'finance', title: '付款失败' },
      { eventCode: 'tender:payment:cancelled', category: 'finance', title: '付款取消' },
      // 验收
      { eventCode: 'acceptance:reminder', category: 'acceptance', title: '验收提醒' },
      // 预防性维护
      { eventCode: 'maintenance_plan:reminder', category: 'maintenance', title: '预防性维护提醒' },
      // 用户
      { eventCode: 'notification:role_request', category: 'user', title: '新用户加入企业' },
    ];

    res.json({
      success: true,
      data: {
        strategyTypes: strategyService.STRATEGY_TYPES,
        knownEvents,
        configuredEvents,
      },
    });
  } catch (e) {
    logger.error('[RecipientStrategyAPI] meta 失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/* ===================== CRUD ===================== */

router.get('/', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const { eventCode, page, pageSize } = req.query;
    const result = await strategyService.listStrategies({
      tenantId,
      eventCode,
      page,
      pageSize,
    });
    res.json({ success: true, data: result });
  } catch (e) {
    logger.error('[RecipientStrategyAPI] 列表查询失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/event/:eventCode', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const { eventCode } = req.params;
    const list = await strategyService.listStrategiesForEvent(tenantId, eventCode);
    res.json({ success: true, data: list });
  } catch (e) {
    logger.error('[RecipientStrategyAPI] 查事件策略失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const userId = req.user?.id;
    const item = await strategyService.createStrategy(
      { ...req.body, tenant_id: tenantId },
      userId,
    );
    res.json({ success: true, data: item, message: '策略创建成功' });
  } catch (e) {
    logger.error('[RecipientStrategyAPI] 创建失败:', e.message);
    res.status(400).json({ success: false, message: e.message });
  }
});

router.put('/:id', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const item = await strategyService.updateStrategy(req.params.id, tenantId, req.body);
    if (!item) return res.status(404).json({ success: false, message: '策略不存在' });
    res.json({ success: true, data: item, message: '策略更新成功' });
  } catch (e) {
    logger.error('[RecipientStrategyAPI] 更新失败:', e.message);
    res.status(400).json({ success: false, message: e.message });
  }
});

router.delete('/:id', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const ok = await strategyService.deleteStrategy(req.params.id, tenantId);
    if (!ok) return res.status(404).json({ success: false, message: '策略不存在' });
    res.json({ success: true, message: '策略删除成功' });
  } catch (e) {
    logger.error('[RecipientStrategyAPI] 删除失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/batch-delete', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const { ids } = req.body || {};
    const count = await strategyService.batchDelete(ids, tenantId);
    res.json({ success: true, data: { deleted: count }, message: `已删除 ${count} 条` });
  } catch (e) {
    logger.error('[RecipientStrategyAPI] 批量删除失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * 预览：给定事件 + payload，解析出接收人
 * 不落库，只返回解析结果
 * body: { eventCode, payload }
 */
router.post('/preview', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    const { eventCode, payload = {} } = req.body || {};
    if (!eventCode) {
      return res.status(400).json({ success: false, message: 'eventCode 必填' });
    }
    const strategies = await strategyService.getCachedStrategies(tenantId, eventCode);
    const userIds = await strategyService.resolveRecipientsFromStrategies(
      strategies,
      payload,
      tenantId,
    );
    res.json({
      success: true,
      data: {
        eventCode,
        tenantId,
        strategyCount: strategies.length,
        strategies,
        userIds,
        count: userIds.length,
      },
    });
  } catch (e) {
    logger.error('[RecipientStrategyAPI] 预览失败:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
