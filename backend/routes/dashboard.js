/**
 * 仪表盘路由模块
 * 提供首页仪表盘统计数据
 */

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: 获取仪表盘统计数据
 *     description: 获取仪表盘所需的各类统计数据
 *     tags: [仪表盘]
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
 *                     overview:
 *                       type: object
 *                       properties:
 *                         total_assets:
 *                           type: integer
 *                         total_value:
 *                           type: number
 *                         active_count:
 *                           type: integer
 *                         idle_count:
 *                           type: integer
 *                         maintenance_count:
 *                           type: integer
 *                         scrapped_count:
 *                           type: integer
 *                         transfer_count:
 *                           type: integer
 *                     alerts:
 *                       type: object
 *                       properties:
 *                         warranty_expiring:
 *                           type: integer
 *                         low_value_assets:
 *                           type: integer
 *                         pending_maintenance:
 *                           type: integer
 *                         pending_transfers:
 *                           type: integer
 *                     recent_assets:
 *                       type: array
 *                     status_distribution:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/dashboard/realtime:
 *   get:
 *     summary: 获取实时统计数据
 *     description: 获取实时统计数据用于刷新
 *     tags: [仪表盘]
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
 *                     total_assets:
 *                       type: integer
 *                     today_added:
 *                       type: integer
 *                     timestamp:
 *                       type: string
 *                       format: date-time
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
 * 获取仪表盘统计数据
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const cacheKey = `dashboard:${tenantId}`;

    const cached = await cacheService.get('dashboard', cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // 并行获取各种统计数据
    const [
      [totalResult],
      [statusResult],
      [recentResult],
      [alertResult],
      [maintenanceResult],
      [transferResult],
    ] = await Promise.all([
      // 资产总数
      db.execute(
        'SELECT COUNT(*) as total, SUM(current_value) as total_value FROM assets WHERE tenant_id = ?',
        [tenantId],
      ),
      // 各状态资产数
      db.execute(
        `SELECT status, COUNT(*) as count
         FROM assets
         WHERE tenant_id = ?
         GROUP BY status`,
        [tenantId],
      ),
      // 最近新增资产
      db.execute(
        `SELECT id, asset_code, asset_name, purchase_price, created_at
         FROM assets
         WHERE tenant_id = ?
         ORDER BY created_at DESC
         LIMIT 5`,
        [tenantId],
      ),
      // 预警数据（保修即将到期、低价值等）
      db.execute(
        `SELECT
          COUNT(CASE WHEN warranty_end_date IS NOT NULL AND warranty_end_date <= DATE_ADD(NOW(), INTERVAL 30 DAY) AND warranty_end_date >= NOW() THEN 1 END) as warranty_expiring,
          COUNT(CASE WHEN current_value < purchase_price * 0.1 THEN 1 END) as low_value
         FROM assets
         WHERE tenant_id = ?`,
        [tenantId],
      ),
      // 待维修数量
      db.execute(
        `SELECT COUNT(*) as count
         FROM maintenance_logs
         WHERE tenant_id = ? AND status = '进行中'`,
        [tenantId],
      ),
      // 待审批调配数量
      db.execute(
        `SELECT COUNT(*) as count
         FROM asset_transfer_requests
         WHERE tenant_id = ? AND status = 'pending'`,
        [tenantId],
      ),
    ]);

    // 统计状态分布
    const statusMap = {};
    statusResult.forEach(item => {
      statusMap[item.status] = item.count;
    });

    const result = {
      success: true,
      data: {
        overview: {
          total_assets: totalResult[0]?.total || 0,
          total_value: totalResult[0]?.total_value || 0,
          active_count: statusMap['在用'] || 0,
          idle_count: statusMap['闲置'] || 0,
          maintenance_count: statusMap['维修'] || 0,
          scrapped_count: statusMap['报废'] || 0,
          transfer_count: statusMap['调配中'] || 0,
        },
        alerts: {
          warranty_expiring: alertResult[0]?.warranty_expiring || 0,
          low_value_assets: alertResult[0]?.low_value || 0,
          pending_maintenance: maintenanceResult[0]?.count || 0,
          pending_transfers: transferResult[0]?.count || 0,
        },
        recent_assets: recentResult,
        status_distribution: statusMap,
      },
    };

    await cacheService.set('dashboard', cacheKey, result, { ttl: 300 }); // 5分钟缓存
    res.json(result);
  } catch (error) {
    logger.error('Get dashboard data failed:', error);
    res.status(500).json({
      success: false,
      message: '获取仪表盘数据失败',
      error: error.message,
    });
  }
});

/**
 * 获取实时统计数据（用于刷新）
 */
router.get('/realtime', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    const [[totalResult], [todayResult]] = await Promise.all([
      db.execute(
        'SELECT COUNT(*) as total FROM assets WHERE tenant_id = ?',
        [tenantId],
      ),
      db.execute(
        `SELECT COUNT(*) as count
         FROM assets
         WHERE tenant_id = ? AND DATE(created_at) = CURDATE()`,
        [tenantId],
      ),
    ]);

    res.json({
      success: true,
      data: {
        total_assets: totalResult[0]?.total || 0,
        today_added: todayResult[0]?.count || 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Get realtime dashboard data failed:', error);
    res.status(500).json({
      success: false,
      message: '获取实时数据失败',
      error: error.message,
    });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    const [overviewRows] = await db.execute(
      `SELECT
         COUNT(*) AS total_assets,
         ROUND(SUM(purchase_price), 2) AS total_purchase_value,
         ROUND(SUM(current_value), 2) AS total_current_value
       FROM assets
       WHERE tenant_id = ? AND is_deleted = 0`,
      [tenantId],
    );

    const [statusRows] = await db.execute(
      `SELECT status, COUNT(*) AS cnt
       FROM assets
       WHERE tenant_id = ? AND is_deleted = 0
       GROUP BY status`,
      [tenantId],
    );

    const [categoryRows] = await db.execute(
      `SELECT c.name AS category, COUNT(*) AS cnt
       FROM assets a LEFT JOIN asset_categories c ON a.category_id = c.id
       WHERE a.tenant_id = ? AND a.is_deleted = 0
       GROUP BY c.name
       ORDER BY cnt DESC
       LIMIT 10`,
      [tenantId],
    );

    const statusMap = {};
    for (const r of statusRows) statusMap[r.status] = r.cnt;

    res.json({
      success: true,
      data: {
        overview: overviewRows[0],
        by_status: statusMap,
        by_category: categoryRows,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Get dashboard stats failed:', error);
    res.status(500).json({
      success: false,
      message: '获取仪表盘统计失败',
      error: error.message,
    });
  }
});

module.exports = router;
