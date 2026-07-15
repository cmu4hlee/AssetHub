/**
 * 资产分析路由模块
 * 提供资产数据分析和报表相关接口
 */

/**
 * @swagger
 * /api/analysis:
 *   get:
 *     summary: 获取资产综合分析数据
 *     description: 获取资产分类、部门、状态、价值、年龄等综合分析
 *     tags: [资产分析]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     by_category:
 *                       type: array
 *                     by_department:
 *                       type: array
 *                     by_status:
 *                       type: array
 *                     value_summary:
 *                       type: object
 *                     age_distribution:
 *                       type: object
 *                     monthly_trend:
 *                       type: array
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/analysis/value-distribution:
 *   get:
 *     summary: 获取资产价值分布分析
 *     tags: [资产分析]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       value_range:
 *                         type: string
 *                       count:
 *                         type: integer
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/analysis/depreciation:
 *   get:
 *     summary: 获取资产折旧分析
 *     tags: [资产分析]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       depreciation_method:
 *                         type: string
 *                       count:
 *                         type: integer
 *                       total_original_value:
 *                         type: number
 *                       total_current_value:
 *                         type: number
 *                       total_depreciated:
 *                         type: number
 *                       avg_years:
 *                         type: number
 *       500:
 *         description: 服务器错误
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');
const { cacheService } = require('../services/cache/CacheService');
const logger = require('../config/logger');

/**
 * 获取资产综合分析数据
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const cacheKey = `analysis:overview:${tenantId}`;

    const cached = await cacheService.get('analysis', cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // 并行获取各种分析数据
    const [
      [categoryStats],
      [departmentStats],
      [statusStats],
      [valueStats],
      [ageStats],
      [trendStats],
    ] = await Promise.all([
      // 按分类统计
      db.execute(
        `SELECT c.name as category, COUNT(*) as count,
                SUM(a.purchase_price) as total_value,
                AVG(a.current_value) as avg_value
         FROM assets a
         LEFT JOIN asset_categories c ON a.category_id = c.id
         WHERE a.tenant_id = ? AND a.is_deleted = 0
         GROUP BY a.category_id
         ORDER BY count DESC
         LIMIT 10`,
        [tenantId],
      ),
      // 按部门统计
      db.execute(
        `SELECT COALESCE(a.department_new, a.department) as department,
                COUNT(*) as count, SUM(a.purchase_price) as total_value
         FROM assets a
         WHERE a.tenant_id = ? AND a.is_deleted = 0
         GROUP BY COALESCE(a.department_new, a.department)
         ORDER BY count DESC
         LIMIT 10`,
        [tenantId],
      ),
      // 按状态统计
      db.execute(
        `SELECT status, COUNT(*) as count, 
                SUM(purchase_price) as total_value
         FROM assets 
         WHERE tenant_id = ?
         GROUP BY status`,
        [tenantId],
      ),
      // 价值分析
      db.execute(
        `SELECT 
          SUM(purchase_price) as total_purchase_value,
          SUM(current_value) as total_current_value,
          AVG(purchase_price) as avg_purchase_price,
          MAX(purchase_price) as max_purchase_price,
          MIN(purchase_price) as min_purchase_price
         FROM assets 
         WHERE tenant_id = ?`,
        [tenantId],
      ),
      // 资产年龄分析
      db.execute(
        `SELECT 
          SUM(CASE WHEN depreciation_months <= 12 THEN 1 ELSE 0 END) as new_assets,
          SUM(CASE WHEN depreciation_months > 12 AND depreciation_months <= 36 THEN 1 ELSE 0 END) as mid_assets,
          SUM(CASE WHEN depreciation_months > 36 AND depreciation_months <= 60 THEN 1 ELSE 0 END) as old_assets,
          SUM(CASE WHEN depreciation_months > 60 THEN 1 ELSE 0 END) as very_old_assets
         FROM assets 
         WHERE tenant_id = ?`,
        [tenantId],
      ),
      // 月度趋势（最近12个月）
      db.execute(
        `SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as month,
          COUNT(*) as count,
          SUM(purchase_price) as total_value
         FROM assets 
         WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
         GROUP BY month
         ORDER BY month ASC`,
        [tenantId],
      ),
    ]);

    const result = {
      success: true,
      data: {
        by_category: categoryStats,
        by_department: departmentStats,
        by_status: statusStats,
        value_summary: valueStats[0] || {},
        age_distribution: ageStats[0] || {},
        monthly_trend: trendStats,
      },
    };

    await cacheService.set('analysis', cacheKey, result, { ttl: 1800 });
    res.json(result);
  } catch (error) {
    logger.error('Get analysis data failed:', error);
    res.status(500).json({
      success: false,
      message: '获取分析数据失败',
      error: error.message,
    });
  }
});

/**
 * 获取资产价值分布分析
 */
router.get('/value-distribution', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    const [distribution] = await db.execute(
      `SELECT 
        CASE 
          WHEN purchase_price < 1000 THEN '0-1000'
          WHEN purchase_price >= 1000 AND purchase_price < 5000 THEN '1000-5000'
          WHEN purchase_price >= 5000 AND purchase_price < 10000 THEN '5000-10000'
          WHEN purchase_price >= 10000 AND purchase_price < 50000 THEN '10000-50000'
          ELSE '50000+'
        END as value_range,
        COUNT(*) as count
       FROM assets 
       WHERE tenant_id = ?
       GROUP BY value_range
       ORDER BY MIN(purchase_price)`,
      [tenantId],
    );

    res.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    logger.error('Get value distribution failed:', error);
    res.status(500).json({
      success: false,
      message: '获取价值分布失败',
      error: error.message,
    });
  }
});

/**
 * 获取资产折旧分析
 */
router.get('/depreciation', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    const [depreciationStats] = await db.execute(
      `SELECT 
        depreciation_method,
        COUNT(*) as count,
        SUM(purchase_price) as total_original_value,
        SUM(current_value) as total_current_value,
        SUM(purchase_price - current_value) as total_depreciated,
        AVG(depreciation_years) as avg_years
       FROM assets 
       WHERE tenant_id = ? AND current_value < purchase_price
       GROUP BY depreciation_method`,
      [tenantId],
    );

    res.json({
      success: true,
      data: depreciationStats,
    });
  } catch (error) {
    logger.error('Get depreciation analysis failed:', error);
    res.status(500).json({
      success: false,
      message: '获取折旧分析失败',
      error: error.message,
    });
  }
});

module.exports = router;
