const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { requireTenantId } = require('../../middleware/tenant-filter');
const plansService = require('../../services/maintenance/plans.service');

const router = express.Router();

const MN_GET = ['maintenance.view', 'asset.view_all', 'asset.view_own_department'];
const MN_WRITE = ['maintenance.add', 'maintenance.edit', 'asset.edit_all', 'asset.edit_own_department'];
const MN_DEL = ['maintenance.delete', 'maintenance.edit', 'asset.delete_all', 'asset.delete_own_department'];

function sendResult(res, result) {
  if (result.statusCode && result.statusCode !== 200) {
    return res.status(result.statusCode).json(result.body);
  }

  if (result.body) {
    return res.json(result.body);
  }

  return res.json(result);
}

router.get('/plans', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await plansService.getPlans(req.query, req);
    res.json(result);
  } catch (error) {
    console.error('获取预防性维护计划列表失败:', error);
    res.status(500).json({ success: false, message: '获取预防性维护计划列表失败', error: error.message });
  }
});

// 预览批量创建会匹配到的资产（不实际插入）
// 注意：必须放在 /plans/:id 之前，否则会被参数路由吞掉
// GET /api/maintenance/plans/preview-assets?category_ids=1,2,3&department_codes=DEP001,DEP002
router.get('/plans/preview-assets', authenticate, async (req, res) => {
  try {
    const parseList = v => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string' && v.trim()) {
        return v.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [];
    };
    const body = {
      category_ids: parseList(req.query.category_ids),
      department_codes: parseList(req.query.department_codes),
    };
    const result = await plansService.previewBatchAssets(body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('预览批量资产失败:', error);
    res.status(500).json({ success: false, message: '预览失败', error: error.message });
  }
});

router.get('/plans/:id', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await plansService.getPlan(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取预防性维护计划详情失败:', error);
    res.status(500).json({ success: false, message: '获取预防性维护计划详情失败', error: error.message });
  }
});

router.post('/plans', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await plansService.createPlan(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('创建预防性维护计划失败:', error);
    res.status(500).json({ success: false, message: '创建预防性维护计划失败', error: error.message });
  }
});

// 批量创建预防性维护计划
// 支持 4 种入参：
//   { plans: [{ asset_code, plan_name, ... }, ...] }                     —— 多计划模式
//   { asset_codes: ['A001', ...], template: { plan_name, ... } }          —— 粘贴模板模式
//   { category_ids: [1,2,3], template: {...} }                            —— 按资产种类多选
//   { department_codes: ['DEP001', ...], template: {...} }                —— 按部门多选
//   { category_ids: [...], department_codes: [...], template: {...} }     —— 组合筛选
router.post('/plans/batch', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await plansService.createPlansBatch(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('批量创建预防性维护计划失败:', error);
    res.status(500).json({
      success: false,
      message: '批量创建预防性维护计划失败',
      error: error.message,
    });
  }
});
router.put('/plans/:id', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await plansService.updatePlan(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('更新预防性维护计划失败:', error);
    res.status(500).json({ success: false, message: '更新预防性维护计划失败', error: error.message });
  }
});

router.post('/plans/:id/complete', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await plansService.completePlan(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('完成预防性维护计划失败:', error);
    res.status(500).json({
      success: false,
      message: '完成预防性维护计划失败',
      error: error.message,
      details:
        process.env.NODE_ENV === 'development'
          ? {
              code: error.code,
              sqlState: error.sqlState,
              sqlMessage: error.sqlMessage,
            }
          : undefined,
    });
  }
});

// 触发维护计划（使用量触发场景）
router.post('/plans/:id/trigger', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await plansService.triggerPlan(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('触发预防性维护计划失败:', error);
    res.status(500).json({
      success: false,
      message: '触发预防性维护计划失败',
      error: error.message,
    });
  }
});

router.delete('/plans/:id', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await plansService.deletePlan(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('删除预防性维护计划失败:', error);
    res.status(500).json({ success: false, message: '删除预防性维护计划失败', error: error.message });
  }
});

router.get('/plans/:id/history', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await plansService.getPlanHistory(req.params.id, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取维护计划历史记录失败:', error);
    res.status(500).json({ success: false, message: '获取维护计划历史记录失败', error: error.message });
  }
});

module.exports = router;
