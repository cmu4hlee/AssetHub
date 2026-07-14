/**
 * 飞书绑定模块 - 路由聚合入口
 */
const express = require('express');
const router = express.Router();
const bindingRouter = require('./binding');
const eventController = require('../controllers/event.controller');
const { diagnostic } = require('../controllers/diagnostic.controller');

// 注册维修事件 → 飞书出站通知监听器（fail-soft，启动失败不阻塞路由）
try {
  const maintenanceEventsListener = require('../listeners/maintenance-events.listener');
  maintenanceEventsListener.register();
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('[feishu-binding] failed to register maintenance-events listener:', e.message);
}

// 挂载绑定路由
router.use('/binding', bindingRouter);

// 飞书事件 webhook（无需认证，飞书服务器直接推送）
router.post('/event', eventController.handleEventWebhook);

// 配置诊断接口（用于排查"为啥机器人没反应"）
router.get('/diagnostic', diagnostic);

// 健康检查路由
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Feishu Binding Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Feishu Binding API',
    endpoints: {
      health: '/api/feishu/health',
      binding: '/api/feishu/binding',
      event: '/api/feishu/event',
      diagnostic: '/api/feishu/diagnostic',
    },
  });
});

module.exports = router;
