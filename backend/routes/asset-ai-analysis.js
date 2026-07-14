const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');

// 导入AI分析服务
const {
  getDimensions,
  getOpenDatasources,
  analyzeAsset,
  analyzeAssets,
  customAnalysis,
  getAnalysisHistory,
  getAnalysisReport,
  getQuestionRecords,
} = require('../services/asset-ai-analysis');

/**
 * 获取分析维度列表
 * GET /api/asset-ai-analysis/dimensions
 */
router.get('/dimensions', authenticate, async (req, res) => {
  try {
    const dimensions = await getDimensions();
    res.json({ success: true, data: dimensions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取SQLBot可用数据源
 * GET /api/asset-ai-analysis/datasources
 */
router.get('/datasources', authenticate, async (req, res) => {
  try {
    const result = await getOpenDatasources();

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 分析单个资产
 * POST /api/asset-ai-analysis/analyze-asset/:assetCode
 */
router.post('/analyze-asset/:assetCode', authenticate, async (req, res) => {
  try {
    const { assetCode } = req.params;
    const userId = req.user?.id || 1; // 从认证中间件获取用户ID，默认1
    const tenantId = getTenantId(req); // 获取租户ID
    const result = await analyzeAsset(assetCode, req.body, userId, tenantId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 批量分析资产
 * POST /api/asset-ai-analysis/analyze-assets
 */
router.post('/analyze-assets', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id || 1; // 从认证中间件获取用户ID，默认1
    const tenantId = getTenantId(req); // 获取租户ID
    const result = await analyzeAssets(req.body, userId, tenantId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 自定义AI分析
 * POST /api/asset-ai-analysis/custom-analysis
 */
router.post('/custom-analysis', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id || 1; // 从认证中间件获取用户ID，默认1
    const tenantId = getTenantId(req); // 获取租户ID
    const result = await customAnalysis(req.body, userId, tenantId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取分析历史
 * GET /api/asset-ai-analysis/analysis-history
 */
router.get('/analysis-history', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id || 1; // 从认证中间件获取用户ID，默认1
    const params = { ...req.query, userId };
    const result = await getAnalysisHistory(params, req);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取单个分析报告详情
 * GET /api/asset-ai-analysis/reports/:id
 */
router.get('/reports/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getAnalysisReport(parseInt(id), req);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取AI问答记录列表
 * GET /api/asset-ai-analysis/question-records
 */
router.get('/question-records', authenticate, async (req, res) => {
  try {
    const result = await getQuestionRecords(req);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
