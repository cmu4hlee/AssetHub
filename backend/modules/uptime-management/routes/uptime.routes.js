/**
 * 开机率管理路由
 */

const express = require('express');
const router = express.Router();
const uptimeController = require('../controllers/uptime.controller');
const { authenticate } = require('../../../middleware/auth');

// ========== 开机率统计路由 ==========

// 获取开机率统计列表
router.get('/', authenticate, uptimeController.getStatisticsList);

// 创建开机率统计
router.post('/', authenticate, uptimeController.createStatistic);

// 更新开机率统计
router.put('/:id', authenticate, uptimeController.updateStatistic);

// 删除开机率统计
router.delete('/:id', authenticate, uptimeController.deleteStatistic);

// 根据运行日志计算月度开机率
router.post('/calculate', authenticate, uptimeController.calculateFromLogs);

// 获取仪表盘数据
router.get('/dashboard', authenticate, uptimeController.getDashboard);

// 获取开机率概览
router.get('/overview', authenticate, uptimeController.getOverview);

module.exports = router;
