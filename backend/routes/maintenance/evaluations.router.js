const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { requireTenantId } = require('../../middleware/tenant-filter');
const evaluationsService = require('../../services/maintenance/evaluations.service');

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

router.get('/evaluations', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await evaluationsService.getEvaluations(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取维护效果评估列表失败:', error);
    res.status(500).json({ success: false, message: '获取维护效果评估列表失败', error: error.message });
  }
});

router.post('/evaluations', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await evaluationsService.createEvaluation(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('创建维护效果评估失败:', error);
    res.status(500).json({ success: false, message: '创建维护效果评估失败', error: error.message });
  }
});

router.put('/evaluations/:id', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await evaluationsService.updateEvaluation(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('更新维护效果评估失败:', error);
    res.status(500).json({ success: false, message: '更新维护效果评估失败', error: error.message });
  }
});

module.exports = router;
