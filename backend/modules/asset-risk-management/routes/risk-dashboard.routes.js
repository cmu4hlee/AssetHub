/**
 * 风险仪表盘路由
 * 符合 ISO 14971:2019《医疗器械风险管理》标准要求
 * 提供全面的风险态势感知和预警功能
 */

const express = require('express');
const router = express.Router();
const db = require('../../../config/database');
const logger = require('../../../config/logger');
const { authenticate } = require('../../../middleware/auth');

const tableExistsCache = new Map();

async function tableExists(tableName) {
  if (tableExistsCache.has(tableName)) {
    return tableExistsCache.get(tableName);
  }

  const [rows] = await db.execute(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?
     LIMIT 1`,
    [tableName],
  );
  const exists = rows.length > 0;
  tableExistsCache.set(tableName, exists);
  return exists;
}

function logRiskError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: req?.user?.tenant_id || null,
    userId: req?.user?.id || null,
    ...context,
  });
}

// 获取风险仪表盘概览
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = (await tableExists('asset_risk_levels'))
      ? 'asset_risk_levels'
      : 'risk_assessments';

    // 1. 风险等级统计
    const [riskStats] = await db.execute(
      `SELECT risk_level, COUNT(*) as count
       FROM ${tableName}
       WHERE tenant_id = ? AND status != 'archived'
       GROUP BY risk_level`,
      [tenantId],
    );

    // 2. 待处理风险（需要立即关注的）
    const [pendingRisks] = await db.execute(
      `SELECT COUNT(*) as count FROM ${tableName}
       WHERE tenant_id = ? AND risk_level IN ('critical', 'high') AND status = 'active'`,
      [tenantId],
    );

    // 3. 本月新增评估数
    const [thisMonthStats] = await db.execute(
      `SELECT COUNT(*) as count FROM ${tableName}
       WHERE tenant_id = ? AND assessment_date >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [tenantId],
    );

    // 4. 即将到期的评估（30天内）
    const [upcomingReviews] = await db.execute(
      `SELECT COUNT(*) as count FROM ${tableName}
       WHERE tenant_id = ? AND next_assessment_date IS NOT NULL
         AND next_assessment_date <= DATE_ADD(NOW(), INTERVAL 30 DAY)
         AND next_assessment_date >= CURDATE()`,
      [tenantId],
    );

    // 5. 已过期的评估
    const [overdueReviews] = await db.execute(
      `SELECT COUNT(*) as count FROM ${tableName}
       WHERE tenant_id = ? AND next_assessment_date < CURDATE()
         AND status = 'active'`,
      [tenantId],
    );

    // 6. 按科室分布的风险统计
    let departmentRiskStats = [];
    try {
      const [deptStats] = await db.execute(
        `SELECT a.department as department_name, ra.risk_level, COUNT(*) as count
         FROM ${tableName} ra
         LEFT JOIN assets a ON ra.asset_id = a.id AND ra.tenant_id = a.tenant_id
         WHERE ra.tenant_id = ? AND ra.status != 'archived'
         GROUP BY a.department, ra.risk_level
         ORDER BY count DESC
         LIMIT 20`,
        [tenantId],
      );
      departmentRiskStats = deptStats;
    } catch (e) {
      // 如果失败（可能是表结构问题），返回空数组
      departmentRiskStats = [];
    }

    // 7. 按资产类型分布的风险统计
    let typeRiskStats = [];
    try {
      const [typeStats] = await db.execute(
        `SELECT a.asset_type, ra.risk_level, COUNT(*) as count
         FROM ${tableName} ra
         LEFT JOIN assets a ON ra.asset_id = a.id AND ra.tenant_id = a.tenant_id
         WHERE ra.tenant_id = ? AND ra.status != 'archived'
         GROUP BY a.asset_type, ra.risk_level
         ORDER BY count DESC
         LIMIT 20`,
        [tenantId],
      );
      typeRiskStats = typeStats;
    } catch (e) {
      typeRiskStats = [];
    }

    // 8. 最近的评估记录
    const [recentAssessments] = await db.execute(
      `SELECT ra.id, ra.asset_id, ra.risk_level, ra.risk_score,
              ra.assessment_date, ra.next_assessment_date, ra.status,
              a.asset_code, a.asset_name
       FROM ${tableName} ra
       LEFT JOIN assets a ON ra.asset_id = a.id AND ra.tenant_id = a.tenant_id
       WHERE ra.tenant_id = ?
       ORDER BY ra.assessment_date DESC
       LIMIT 10`,
      [tenantId],
    );

    // 9. 高风险资产列表（需要重点关注的）
    const [highRiskAssets] = await db.execute(
      `SELECT ra.id, ra.asset_id, ra.risk_level, ra.risk_score,
              ra.assessment_date, ra.next_assessment_date,
              a.asset_code, a.asset_name, a.asset_type, a.department
       FROM ${tableName} ra
       LEFT JOIN assets a ON ra.asset_id = a.id AND ra.tenant_id = a.tenant_id
       WHERE ra.tenant_id = ? AND ra.risk_level IN ('critical', 'high')
         AND ra.status = 'active'
       ORDER BY
         CASE ra.risk_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 END,
         ra.risk_score DESC
       LIMIT 10`,
      [tenantId],
    );

    // 计算统计数据
    const statsMap = {};
    let totalCount = 0;
    riskStats.forEach(row => {
      statsMap[row.risk_level || 'unknown'] = row.count;
      totalCount += row.count;
    });

    res.json({
      success: true,
      data: {
        overview: {
          total: totalCount,
          critical: statsMap['critical'] || 0,
          high: statsMap['high'] || 0,
          medium: statsMap['medium'] || 0,
          low: statsMap['low'] || 0,
          unknown: statsMap['unknown'] || 0,
        },
        pending_risks: pendingRisks[0]?.count || 0,
        this_month_assessments: thisMonthStats[0]?.count || 0,
        upcoming_reviews: upcomingReviews[0]?.count || 0,
        overdue_reviews: overdueReviews[0]?.count || 0,
        department_risk_stats: departmentRiskStats,
        type_risk_stats: typeRiskStats,
        recent_assessments: recentAssessments,
        high_risk_assets: highRiskAssets,
      },
    });
  } catch (error) {
    logRiskError('获取风险仪表盘失败', error, req);
    res.status(500).json({ success: false, message: '获取风险仪表盘失败' });
  }
});

// 获取风险趋势数据（月度）
router.get('/trends', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { months = 6 } = req.query;
    const tableName = (await tableExists('asset_risk_levels'))
      ? 'asset_risk_levels'
      : 'risk_assessments';

    const [trends] = await db.execute(
      `SELECT
         DATE_FORMAT(assessment_date, '%Y-%m') as month,
         risk_level,
         COUNT(*) as count
       FROM ${tableName}
       WHERE tenant_id = ?
         AND assessment_date >= DATE_SUB(NOW(), INTERVAL ? MONTH)
       GROUP BY DATE_FORMAT(assessment_date, '%Y-%m'), risk_level
       ORDER BY month ASC`,
      [tenantId, parseInt(months, 10)],
    );

    res.json({
      success: true,
      data: {
        trends,
        period_months: parseInt(months, 10),
      },
    });
  } catch (error) {
    logRiskError('获取风险趋势失败', error, req);
    res.status(500).json({ success: false, message: '获取风险趋势失败' });
  }
});

// 获取风险等级分布（饼图数据）
router.get('/distribution', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const tableName = (await tableExists('asset_risk_levels'))
      ? 'asset_risk_levels'
      : 'risk_assessments';

    const [distribution] = await db.execute(
      `SELECT
         risk_level,
         COUNT(*) as count,
         ROUND(COUNT(*) * 100.0 / NULLIF(
           (SELECT COUNT(*) FROM ${tableName} WHERE tenant_id = ? AND status != 'archived'), 0
         ), 1) as percentage
       FROM ${tableName}
       WHERE tenant_id = ? AND status != 'archived'
       GROUP BY risk_level
       ORDER BY
         CASE risk_level
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           ELSE 5
         END`,
      [tenantId, tenantId],
    );

    res.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    logRiskError('获取风险分布失败', error, req);
    res.status(500).json({ success: false, message: '获取风险分布失败' });
  }
});

// 获取需要复评的资产列表
router.get('/due-reviews', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { status = 'overdue' } = req.query;
    const tableName = (await tableExists('asset_risk_levels'))
      ? 'asset_risk_levels'
      : 'risk_assessments';

    let dateCondition;
    if (status === 'overdue') {
      dateCondition = 'next_assessment_date < CURDATE()';
    } else if (status === 'upcoming') {
      dateCondition = 'next_assessment_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)';
    } else {
      dateCondition = 'next_assessment_date IS NOT NULL';
    }

    const [reviews] = await db.execute(
      `SELECT ra.id, ra.asset_id, ra.risk_level, ra.risk_score,
              ra.assessment_date, ra.next_assessment_date,
              a.asset_code, a.asset_name, a.asset_type,
              DATEDIFF(ra.next_assessment_date, CURDATE()) as days_until_due
       FROM ${tableName} ra
       LEFT JOIN assets a ON ra.asset_id = a.id AND ra.tenant_id = a.tenant_id
       WHERE ra.tenant_id = ? AND ${dateCondition}
       ORDER BY
         CASE WHEN DATEDIFF(ra.next_assessment_date, CURDATE()) < 0 THEN 0 ELSE 1 END,
         DATEDIFF(ra.next_assessment_date, CURDATE()) ASC
       LIMIT 50`,
      [tenantId],
    );

    res.json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    logRiskError('获取复评列表失败', error, req);
    res.status(500).json({ success: false, message: '获取复评列表失败' });
  }
});

module.exports = router;
