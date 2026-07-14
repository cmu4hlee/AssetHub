const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');
const agentMeshService = require('../services/agent-mesh-service');
const predictiveMaintenanceService = require('../services/predictive-maintenance-service');
const riskScoringEngineService = require('../services/risk-scoring-engine-service');
const assetHealthIndexService = require('../services/asset-health-index-service');
const microserviceTransitionService = require('../services/microservice-transition-service');

const router = express.Router();

const resolveTenantId = req => {
  const tenantId = getTenantId(req);
  const parsed = Number.parseInt(String(tenantId ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseAssetCodes = input => {
  if (Array.isArray(input)) {
    return Array.from(
      new Set(
        input
          .flatMap(item => String(item || '').split(/[\s,，;\n]+/))
          .map(item => item.trim())
          .filter(Boolean),
      ),
    ).slice(0, 200);
  }

  return Array.from(
    new Set(
      String(input || '')
        .split(/[\s,，;\n]+/)
        .map(item => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 200);
};

/**
 * 获取 Agent Mesh 拓扑
 * @route GET /api/agent-mesh/topology
 */
router.get('/topology', authenticate, (req, res) => {
  res.json({
    success: true,
    data: agentMeshService.getTopology(),
  });
});

/**
 * 初始化 Agent Mesh 会话
 * @route POST /api/agent-mesh/init
 */
router.post('/init', authenticate, (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '请先选择租户空间',
      });
    }
    const result = agentMeshService.initConversation({
      tenantId,
      userId: req.user?.id || null,
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * 发送消息，由协调代理触发多代理协同
 * @route POST /api/agent-mesh/message
 */
router.post('/message', authenticate, async (req, res) => {
  try {
    const {
      conversationId,
      message,
      context,
      history,
    } = req.body || {};

    if (!String(message || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'message 不能为空',
      });
    }

    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '请先选择租户空间',
      });
    }
    const result = await agentMeshService.sendMessage({
      conversationId,
      message,
      tenantId,
      userId: req.user?.id || null,
      context: context || {},
      history: Array.isArray(history) ? history : [],
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * 预测性维护（IoT时序 + 维修历史）
 * @route POST /api/agent-mesh/intelligence/predictive-maintenance
 */
router.post('/intelligence/predictive-maintenance', authenticate, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '请先选择租户空间',
      });
    }

    const {
      asset_codes,
      limit,
      lookback_days,
    } = req.body || {};

    const result = await predictiveMaintenanceService.predict({
      tenantId,
      assetCodes: asset_codes,
      limit,
      lookbackDays: lookback_days,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * 风险动态预警（统一评分引擎 + 降噪）
 * @route POST /api/agent-mesh/intelligence/risk-score
 */
router.post('/intelligence/risk-score', authenticate, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '请先选择租户空间',
      });
    }

    const {
      asset_codes,
      limit,
      weights,
      smoothing,
      dedupe_delta,
      cooldown_hours,
      market_signals,
      persist = true,
    } = req.body || {};

    const result = await riskScoringEngineService.score({
      tenantId,
      assetCodes: asset_codes,
      limit,
      weights,
      smoothing,
      dedupeDelta: dedupe_delta,
      cooldownHours: cooldown_hours,
      externalMarketSignals: market_signals,
      persist,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * 风险趋势（基于风险快照）
 * @route GET /api/agent-mesh/intelligence/risk-trend
 */
router.get('/intelligence/risk-trend', authenticate, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '请先选择租户空间',
      });
    }

    const assetCodes = parseAssetCodes(
      req.query.asset_codes || req.query.asset_code || req.query['asset_codes[]'] || [],
    );
    const { days } = req.query || {};

    const result = await riskScoringEngineService.getRiskTrend({
      tenantId,
      assetCodes,
      days,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * 资产健康度评分（组合级健康指数）
 * @route POST /api/agent-mesh/intelligence/health-index
 */
router.post('/intelligence/health-index', authenticate, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '请先选择租户空间',
      });
    }

    const {
      asset_codes,
      limit,
      weights,
      strategic_departments,
      strategic_assets,
      persist = true,
    } = req.body || {};

    const result = await assetHealthIndexService.computeHealthIndex({
      tenantId,
      assetCodes: asset_codes,
      limit,
      weights,
      strategicDepartments: strategic_departments,
      strategicAssetCodes: strategic_assets,
      persist,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * 健康指数趋势（组合级快照）
 * @route GET /api/agent-mesh/intelligence/health-trend
 */
router.get('/intelligence/health-trend', authenticate, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '请先选择租户空间',
      });
    }

    const assetCodes = parseAssetCodes(
      req.query.asset_codes || req.query.asset_code || req.query['asset_codes[]'] || [],
    );
    const { days } = req.query || {};

    const result = await assetHealthIndexService.getHealthTrend({
      tenantId,
      assetCodes,
      days,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * 微服务拆分路线
 * @route GET /api/agent-mesh/microservice/roadmap
 */
router.get('/microservice/roadmap', authenticate, (req, res) => {
  res.json({
    success: true,
    data: microserviceTransitionService.getRoadmap(),
  });
});

/**
 * 事件契约清单
 * @route GET /api/agent-mesh/microservice/events
 */
router.get('/microservice/events', authenticate, (req, res) => {
  res.json({
    success: true,
    data: microserviceTransitionService.getEventContracts(),
  });
});

module.exports = router;
