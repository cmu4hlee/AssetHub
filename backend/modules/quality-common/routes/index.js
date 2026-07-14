const express = require('express');
const router = express.Router();
const qualityCommonController = require('../controllers/quality-common.controller');
const { authenticate } = require('../../../middleware/auth');

// ==================== 权限管理 ====================

// 获取所有权限
router.get('/permissions', authenticate, qualityCommonController.getPermissions);

// 创建新权限
router.post('/permissions', authenticate, qualityCommonController.createPermission);

// 更新权限
router.put('/permissions/:id', authenticate, qualityCommonController.updatePermission);

// 删除权限
router.delete('/permissions/:id', authenticate, qualityCommonController.deletePermission);

// ==================== 数据字典管理 ====================

// 获取所有数据字典
router.get('/dictionary', authenticate, qualityCommonController.getDictionary);

// 根据类型获取数据字典
router.get('/dictionary/:type', authenticate, qualityCommonController.getDictionaryByType);

// 创建字典项
router.post('/dictionary', authenticate, qualityCommonController.createDictionaryItem);

// 更新字典项
router.put('/dictionary/:id', authenticate, qualityCommonController.updateDictionaryItem);

// 删除字典项
router.delete('/dictionary/:id', authenticate, qualityCommonController.deleteDictionaryItem);

// ==================== 日志管理 ====================

// 获取系统日志
router.get('/logs', authenticate, qualityCommonController.getLogs);

// 创建系统日志
router.post('/logs', authenticate, qualityCommonController.createLog);

// ==================== 健康检查 ====================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Quality Common Module is healthy',
    timestamp: new Date().toISOString(),
  });
});

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Quality Common API',
    endpoints: {
      health: '/api/quality/common/health',
      permissions: '/api/quality/common/permissions',
      dictionary: '/api/quality/common/dictionary',
      logs: '/api/quality/common/logs',
    },
  });
});

module.exports = router;
