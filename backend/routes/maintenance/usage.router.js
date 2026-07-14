const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { requireTenantId } = require('../../middleware/tenant-filter');
const usageService = require('../../services/maintenance/usage.service');

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

router.post('/usage/update', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await usageService.updateUsage(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('更新使用量失败:', error);
    res.status(500).json({ success: false, message: '更新使用量失败', error: error.message });
  }
});

router.get('/usage/history', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await usageService.getUsageHistory(req.query);
    sendResult(res, result);
  } catch (error) {
    console.error('获取使用量历史失败:', error);
    res.status(500).json({ success: false, message: '获取使用量历史失败', error: error.message });
  }
});

router.get('/usage/statistics', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await usageService.getUsageStatistics(req.query);
    sendResult(res, result);
  } catch (error) {
    console.error('获取使用量统计失败:', error);
    res.status(500).json({ success: false, message: '获取使用量统计失败', error: error.message });
  }
});

router.get('/usage/check-thresholds', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await usageService.checkUsageThresholds(req);
    sendResult(res, result);
  } catch (error) {
    console.error('检查使用量阈值失败:', error);
    res.status(500).json({ success: false, message: '检查使用量阈值失败', error: error.message });
  }
});

router.get('/usage-records', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await usageService.getUsageRecordsLegacy(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取资产使用量记录列表失败:', error);
    res.status(500).json({ success: false, message: '获取资产使用量记录列表失败', error: error.message });
  }
});

router.post('/usage-records', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await usageService.createUsageRecordLegacy(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('创建资产使用量记录失败:', error);
    res.status(500).json({ success: false, message: '创建资产使用量记录失败', error: error.message });
  }
});

router.get('/usage-triggered', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await usageService.getUsageTriggeredLegacy(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取使用量触发的维护计划列表失败:', error);
    res.status(500).json({ success: false, message: '获取使用量触发的维护计划列表失败', error: error.message });
  }
});

router.post('/usage-triggered/:id/process', authenticate, authorize(MN_WRITE), async (req, res) => {
  try {
    const result = await usageService.processUsageTriggeredLegacy(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('处理使用量触发记录失败:', error);
    res.status(500).json({ success: false, message: '处理使用量触发记录失败', error: error.message });
  }
});

router.post('/usage-triggered/check', authenticate, authorize(MN_WRITE), async (req, res) => {
  try {
    const result = await usageService.checkUsageTriggeredLegacy(req);
    sendResult(res, result);
  } catch (error) {
    console.error('检查使用量触发的维护计划失败:', error);
    res.status(500).json({ success: false, message: '检查使用量触发的维护计划失败', error: error.message });
  }
});

router.get('/usage/asset-usage', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await usageService.getAssetUsage(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取资产使用量失败:', error);
    res.status(500).json({ success: false, message: '获取资产使用量失败', error: error.message });
  }
});

router.get('/usage/records', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await usageService.getUsageRecords(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取使用量记录失败:', error);
    res.status(500).json({ success: false, message: '获取使用量记录失败', error: error.message });
  }
});

router.post('/usage/records', authenticate, requireTenantId, async (req, res) => {
  try {
    const result = await usageService.createUsageRecord(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('记录使用量失败:', error);
    res.status(500).json({ success: false, message: '记录使用量失败', error: error.message });
  }
});

router.get('/usage/triggered', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await usageService.getTriggeredRecords(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取触发记录失败:', error);
    res.status(500).json({ success: false, message: '获取触发记录失败', error: error.message });
  }
});

// 忽略使用量触发记录
router.post('/usage/triggered/:id/ignore', authenticate, authorize(MN_WRITE), async (req, res) => {
  try {
    const result = await usageService.ignoreTriggeredRecord(req.params.id, req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('忽略使用量触发记录失败:', error);
    res.status(500).json({ success: false, message: '忽略使用量触发记录失败', error: error.message });
  }
});

module.exports = router;
