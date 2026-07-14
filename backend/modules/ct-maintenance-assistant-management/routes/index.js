const express = require('express');
const router = express.Router();
const ctMaintenanceAssistantController = require('../controllers/ct-maintenance-assistant.controller');
const { authenticate } = require('../../../middleware/auth');

// ==================== CT维护助手配置 ====================

// 获取CT维护助手配置
router.get('/config', authenticate, ctMaintenanceAssistantController.getAssistantConfig);

// 更新CT维护助手配置
router.put('/config', authenticate, ctMaintenanceAssistantController.updateAssistantConfig);

// ==================== CT维护功能 ====================

// 知识问答
router.post('/knowledge/query', authenticate, ctMaintenanceAssistantController.knowledgeQuery);

// 维修建议
router.post('/maintenance/advice', authenticate, ctMaintenanceAssistantController.maintenanceAdvice);

// 排障指导
router.post('/troubleshooting', authenticate, ctMaintenanceAssistantController.troubleshootingGuide);

// 巡检清单
router.post('/checklist', authenticate, ctMaintenanceAssistantController.getInspectionChecklist);

// ==================== 状态查询 ====================

// 获取助手状态
router.get('/status', authenticate, ctMaintenanceAssistantController.getAssistantStatus);

// ==================== 健康检查 ====================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'CT Maintenance Assistant Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'CT Maintenance Assistant API',
    endpoints: {
      health: '/api/ct-maintenance/health',
      config: '/api/ct-maintenance/config',
      'knowledge/query': '/api/ct-maintenance/knowledge/query',
      'maintenance/advice': '/api/ct-maintenance/maintenance/advice',
      troubleshooting: '/api/ct-maintenance/troubleshooting',
      checklist: '/api/ct-maintenance/checklist',
      status: '/api/ct-maintenance/status',
    },
  });
});

module.exports = router;
