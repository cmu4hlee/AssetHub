const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');

// 维修工单模块权限集合
const WO_GET_ROLES = ['maintenance.view', 'asset.view_all', 'asset.view_own_department'];
const WO_WRITE_ROLES = ['maintenance.add', 'maintenance.edit', 'asset.edit_all', 'asset.edit_own_department'];
const WO_DELETE_ROLES = ['maintenance.delete', 'maintenance.edit', 'asset.delete_all', 'asset.delete_own_department'];
const { requireTenantId } = require('../../middleware/tenant-filter');
const workordersService = require('../../services/maintenance/workorders.service');

const router = express.Router();

function handleError(res, error, fallbackMessage) {
  console.error(`${fallbackMessage  }:`, error);

  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
    error: error.message,
  });
}

router.get('/workorders', authenticate, authorize(WO_GET_ROLES), async (req, res) => {
  try {
    const result = await workordersService.getWorkOrders(req.query, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '获取工单列表失败');
  }
});

router.get('/workorders/dispatch-panel', authenticate, authorize(WO_GET_ROLES), async (req, res) => {
  try {
    const result = await workordersService.getDispatchPanel(req.query, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '获取调度中心面板失败');
  }
});

router.get('/workorders/statistics', authenticate, authorize(WO_GET_ROLES), async (req, res) => {
  try {
    const result = await workordersService.getWorkOrderStatistics(req.query, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '获取工单统计失败');
  }
});

router.get('/workorders/engineers', authenticate, authorize(WO_GET_ROLES), async (req, res) => {
  try {
    const result = await workordersService.getEngineers(req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '获取工程师列表失败');
  }
});

router.get('/workorders/:id/history', authenticate, authorize(WO_GET_ROLES), async (req, res) => {
  try {
    const result = await workordersService.getWorkOrderHistory(req.params.id, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '获取工单历史失败');
  }
});

router.get('/workorders/:id', authenticate, authorize(WO_GET_ROLES), async (req, res) => {
  try {
    const result = await workordersService.getWorkOrder(req.params.id, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '获取工单详情失败');
  }
});

router.post('/workorders', authenticate, requireTenantId, authorize(WO_WRITE_ROLES), async (req, res) => {
  try {
    const result = await workordersService.createWorkOrder(req.body, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '创建工单失败');
  }
});

router.put('/workorders/:id', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await workordersService.updateWorkOrder(req.params.id, req.body, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '更新工单失败');
  }
});

router.post('/workorders/:id/materials', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await workordersService.addWorkOrderMaterials(req.params.id, req.body.materials, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '添加工单物料消耗失败');
  }
});

router.delete('/workorders/:id', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await workordersService.deleteWorkOrder(req.params.id, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '删除工单失败');
  }
});

router.get('/legacy/workorders', authenticate, authorize(WO_GET_ROLES), async (req, res) => {
  try {
    const result = await workordersService.getLegacyWorkOrders(req.query, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '获取维护工单列表失败');
  }
});

router.get('/legacy/workorders/:id', authenticate, authorize(WO_GET_ROLES), async (req, res) => {
  try {
    const result = await workordersService.getLegacyWorkOrder(req.params.id, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '获取维护工单详情失败');
  }
});

router.post('/legacy/workorders', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await workordersService.createLegacyWorkOrder(req.body, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '创建维护工单失败');
  }
});

router.put('/legacy/workorders/:id', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await workordersService.updateLegacyWorkOrder(req.params.id, req.body, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '更新维护工单失败');
  }
});

router.delete('/legacy/workorders/:id', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await workordersService.deleteLegacyWorkOrder(req.params.id, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '删除维护工单失败');
  }
});

router.post('/workorders/:id/assign', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await workordersService.assignWorkOrder(req.params.id, req.body, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '分配工单失败');
  }
});

router.post('/workorders/:id/start', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await workordersService.startWorkOrder(req.params.id, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '开始工单失败');
  }
});

router.post('/workorders/:id/complete', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await workordersService.completeWorkOrder(req.params.id, req.body, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '完成工单失败');
  }
});

router.post('/workorders/:id/evaluate', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await workordersService.evaluateWorkOrder(req.params.id, req.body, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '评价工单失败');
  }
});

router.post('/workorders/:id/close', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await workordersService.closeWorkOrder(req.params.id, req.body.remark, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '关闭工单失败');
  }
});

router.post('/workorders/:id/cancel', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await workordersService.cancelWorkOrder(req.params.id, req.body.cancel_reason, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '取消工单失败');
  }
});

module.exports = router;
