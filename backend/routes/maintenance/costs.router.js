const express = require('express');
const logger = require('../../config/logger');
const { authenticate, authorize } = require('../../middleware/auth');
const { requireTenantId } = require('../../middleware/tenant-filter');
const costsService = require('../../services/maintenance/costs.service');

const router = express.Router();

const MN_GET = ['maintenance.view', 'asset.view_all', 'asset.view_own_department'];
const MN_WRITE = ['maintenance.add', 'maintenance.edit', 'asset.edit_all', 'asset.edit_own_department'];
const MN_DEL = ['maintenance.delete', 'maintenance.edit', 'asset.delete_all', 'asset.delete_own_department'];

function logMaintenanceCostsRouteError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: req?.user?.tenant_id || null,
    userId: req?.user?.id || null,
    username: req?.user?.username || null,
    userRole: req?.user?.role || null,
    ...context,
  });
}

function sendResult(res, result) {
  if (result && result.statusCode && result.statusCode !== 200) {
    return res.status(result.statusCode).json(result.body);
  }

  if (result && result.body) {
    return res.json(result.body);
  }

  return res.json(result);
}

router.get('/costs/trend', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await costsService.getCostTrend(req.query, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceCostsRouteError('获取成本趋势失败', error, req);
    res.status(500).json({ success: false, message: '获取成本趋势失败', error: error.message });
  }
});

router.get('/costs/department', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await costsService.getCostDepartment(req.query, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceCostsRouteError('获取部门成本分布失败', error, req);
    res.status(500).json({ success: false, message: '获取部门成本分布失败', error: error.message });
  }
});

router.get('/costs/asset-type', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await costsService.getCostAssetType(req.query, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceCostsRouteError('获取资产类别成本分布失败', error, req);
    res.status(500).json({ success: false, message: '获取资产类别成本分布失败', error: error.message });
  }
});

router.get('/costs/maintenance-type', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await costsService.getCostMaintenanceType(req.query, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceCostsRouteError('获取维护类型成本分布失败', error, req);
    res.status(500).json({ success: false, message: '获取维护类型成本分布失败', error: error.message });
  }
});

router.get('/costs/high-cost-assets', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await costsService.getHighCostAssets(req.query, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceCostsRouteError('获取高成本资产失败', error, req);
    res.status(500).json({ success: false, message: '获取高成本资产失败', error: error.message });
  }
});

router.get('/costs', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await costsService.getCosts(req.query, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceCostsRouteError('获取维护成本列表失败', error, req);
    res.status(500).json({ success: false, message: '获取维护成本列表失败', error: error.message });
  }
});

router.post('/costs', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await costsService.createCost(req.body, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceCostsRouteError('创建维护成本记录失败', error, req);
    res.status(500).json({ success: false, message: '创建维护成本记录失败', error: error.message });
  }
});

router.put('/costs/:id', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await costsService.updateCost(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceCostsRouteError('更新维护成本记录失败', error, req, {
      costId: req.params?.id || null,
    });
    res.status(500).json({ success: false, message: '更新维护成本记录失败', error: error.message });
  }
});

router.delete('/costs/:id', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await costsService.deleteCost(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceCostsRouteError('删除维护成本记录失败', error, req, {
      costId: req.params?.id || null,
    });
    res.status(500).json({ success: false, message: '删除维护成本记录失败', error: error.message });
  }
});

router.get('/costs/analysis', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await costsService.getCostAnalysis(req.query, req);
    sendResult(res, result);
  } catch (error) {
    logMaintenanceCostsRouteError('获取维护成本分析失败', error, req);
    res.status(500).json({ success: false, message: '获取维护成本分析失败', error: error.message });
  }
});

module.exports = router;
