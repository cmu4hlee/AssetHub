const express = require('express');
const router = express.Router();
const assetAIAssistantController = require('../controllers/asset-ai-assistant.controller');
const { authenticate } = require('../../../middleware/auth');

// ==================== AI助手配置 ====================

// 获取AI助手配置
router.get('/config', authenticate, assetAIAssistantController.getAssistantConfig);

// 更新AI助手配置
router.put('/config', authenticate, assetAIAssistantController.updateAssistantConfig);

// ==================== 会话管理 ====================

// 创建会话
router.post('/sessions', authenticate, assetAIAssistantController.createSession);

// 获取会话历史
router.get('/sessions/:sessionId/history', authenticate, assetAIAssistantController.getSessionHistory);

// 关闭会话
router.delete('/sessions/:sessionId', authenticate, assetAIAssistantController.closeSession);

// ==================== 消息交互 ====================

// 发送消息
router.post('/message', authenticate, assetAIAssistantController.sendMessage);

// ==================== 状态查询 ====================

// 获取助手状态
router.get('/status', authenticate, assetAIAssistantController.getAssistantStatus);

// ==================== 健康检查 ====================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Asset AI Assistant Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Asset AI Assistant API',
    endpoints: {
      health: '/api/ai-assistant/health',
      config: '/api/ai-assistant/config',
      sessions: '/api/ai-assistant/sessions',
      message: '/api/ai-assistant/message',
      status: '/api/ai-assistant/status',
    },
  });
});

module.exports = router;
