const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { requireTenantId } = require('../../middleware/tenant-filter');
const templatesService = require('../../services/maintenance/templates.service');

const router = express.Router();

const MN_GET = ['maintenance.view', 'asset.view_all', 'asset.view_own_department'];
const MN_WRITE = ['maintenance.add', 'maintenance.edit', 'asset.edit_all', 'asset.edit_own_department'];
const MN_DEL = ['maintenance.delete', 'maintenance.edit', 'asset.delete_all', 'asset.delete_own_department'];

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

router.get('/legacy/templates', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await templatesService.getLegacyTemplates(req.query, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '获取维护计划模板列表失败');
  }
});

router.post('/templates', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await templatesService.createTemplate(req.body, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '创建维护计划模板失败');
  }
});

router.put('/templates/:id', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await templatesService.updateTemplate(req.params.id, req.body, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '更新维护计划模板失败');
  }
});

router.delete('/templates/:id', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await templatesService.deleteTemplate(req.params.id, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '删除维护计划模板失败');
  }
});

router.get('/templates/recommend', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await templatesService.recommendTemplates(req.query, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '推荐API失败');
  }
});

router.get('/templates', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await templatesService.getTemplates(req.query, req);
    res.json(result);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.message.includes("doesn't exist")) {
      return res.json({
        success: true,
        data: [],
      });
    }

    handleError(res, error, '获取维护计划模板列表失败');
  }
});

router.get('/templates/recommend-by-asset', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await templatesService.recommendByAsset(req.query.asset_code, req);
    res.json(result);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.message.includes("doesn't exist")) {
      return res.json({
        success: true,
        data: [],
      });
    }

    handleError(res, error, '获取推荐模板失败');
  }
});

router.get('/templates/:id', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await templatesService.getLegacyTemplate(req.params.id, req);
    res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    handleError(res, error, '获取维护计划模板详情失败');
  }
});

router.get('/legacy/templates/:id', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await templatesService.getLegacyTemplate(req.params.id, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '获取维护计划模板详情失败');
  }
});

router.post('/legacy/templates', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await templatesService.createLegacyTemplate(req.body, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '创建维护计划模板失败');
  }
});

router.put('/legacy/templates/:id', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await templatesService.updateLegacyTemplate(req.params.id, req.body, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '更新维护计划模板失败');
  }
});

router.delete('/legacy/templates/:id', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await templatesService.deleteLegacyTemplate(req.params.id, req);
    res.json(result);
  } catch (error) {
    handleError(res, error, '删除维护计划模板失败');
  }
});

module.exports = router;
