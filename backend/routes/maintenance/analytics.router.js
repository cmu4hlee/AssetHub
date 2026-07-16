const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const analyticsService = require('../../services/maintenance/analytics.service');

const router = express.Router();

const MN_GET = ['maintenance.view', 'asset.view_all', 'asset.view_own_department'];
const MN_WRITE = ['maintenance.add', 'maintenance.edit', 'asset.edit_all', 'asset.edit_own_department'];
const MN_DEL = ['maintenance.delete', 'maintenance.edit', 'asset.delete_all', 'asset.delete_own_department'];

function sendResult(res, result) {
  if (result && result.statusCode && result.statusCode !== 200) {
    return res.status(result.statusCode).json(result.body);
  }

  if (result && result.body) {
    return res.json(result.body);
  }

  return res.json(result);
}

router.get('/efficiency/overview', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await analyticsService.getEfficiencyOverview(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取维护效率分析失败:', error);
    res.status(500).json({ success: false, message: '获取维护效率分析失败', error: error.message });
  }
});

router.get('/efficiency/response-time', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await analyticsService.getEfficiencyResponseTime(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取维护响应时间分析失败:', error);
    res.status(500).json({ success: false, message: '获取维护响应时间分析失败', error: error.message });
  }
});

router.get('/efficiency/technician', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await analyticsService.getEfficiencyTechnician(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取技术人员维护效率分析失败:', error);
    res.status(500).json({ success: false, message: '获取技术人员维护效率分析失败', error: error.message });
  }
});

router.get('/efficiency/asset-frequency', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await analyticsService.getEfficiencyAssetFrequency(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取资产维护频率分析失败:', error);
    res.status(500).json({ success: false, message: '获取资产维护频率分析失败', error: error.message });
  }
});

router.get('/analysis/asset-history', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await analyticsService.getAssetHistoryAnalysis(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取资产维护历史分析失败:', error);
    res.status(500).json({ success: false, message: '获取资产维护历史分析失败', error: error.message });
  }
});

router.get('/analysis/effectiveness-stats', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await analyticsService.getEffectivenessStats(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取维护效果统计失败:', error);
    res.status(500).json({ success: false, message: '获取维护效果统计失败', error: error.message });
  }
});

router.get('/analysis/cost-trend', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await analyticsService.getCostTrendAnalysis(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取维护成本趋势失败:', error);
    res.status(500).json({ success: false, message: '获取维护成本趋势失败', error: error.message });
  }
});

router.get('/analysis/cost-analysis', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await analyticsService.getCostAnalysis(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取维护成本分析失败:', error);
    res.status(500).json({ success: false, message: '获取维护成本分析失败', error: error.message });
  }
});

router.get('/analysis/technician-performance', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await analyticsService.getTechnicianPerformance(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取维护人员绩效失败:', error);
    res.status(500).json({ success: false, message: '获取维护人员绩效失败', error: error.message });
  }
});

router.get('/analysis/type-distribution', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await analyticsService.getTypeDistribution(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取维护类型分布失败:', error);
    res.status(500).json({ success: false, message: '获取维护类型分布失败', error: error.message });
  }
});

router.get('/analysis/frequency', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await analyticsService.getFrequencyAnalysis(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取资产维护频率分析失败:', error);
    res.status(500).json({ success: false, message: '获取资产维护频率分析失败', error: error.message });
  }
});

// 工单状态与优先级分布（用于效率仪表盘，替换模拟数据）
router.get('/analysis/workorder-distribution', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await analyticsService.getWorkOrderDistribution(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取工单分布失败:', error);
    res.status(500).json({ success: false, message: '获取工单分布失败', error: error.message });
  }
});

// 维修维护综合仪表盘概览（聚合 综合维修 + 预防性维护）
router.get('/dashboard/overview', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await analyticsService.getDashboardOverview(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取维修维护仪表盘概览失败:', error);
    res.status(500).json({ success: false, message: '获取维修维护仪表盘概览失败', error: error.message });
  }
});

router.get('/asset-types/secondary', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await analyticsService.getSecondaryAssetTypes(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取二级资产类型失败:', error);
    res.status(500).json({ success: false, message: '获取二级资产类型失败', error: error.message });
  }
});

module.exports = router;
