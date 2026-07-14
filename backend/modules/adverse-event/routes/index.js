const express = require('express');
const router = express.Router();
const adverseEventsRouter = require('./adverse-events');

// 挂载不良事件路由
router.use('/adverse-events', adverseEventsRouter);

// 健康检查路由
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Adverse Event Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Adverse Event Management API',
    endpoints: {
      health: '/api/adverse-event/health',
      'adverse-events': '/api/adverse-event/adverse-events',
    },
  });
});

module.exports = router;
