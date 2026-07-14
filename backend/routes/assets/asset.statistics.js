/**
 * 资产统计路由模块
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate } = require('../../middleware/auth');
const { addTenantFilter, getTenantId } = require('../../middleware/tenant-filter');
const { cacheService } = require('../../services/cache/CacheService');
const logger = require('../../config/logger');

const ASSET_DEPARTMENT_JOIN = `
  (
    a.department_new = CONVERT(d.department_code USING utf8mb4) COLLATE utf8mb4_0900_ai_ci
    OR a.department_new = CONVERT(d.department_name USING utf8mb4) COLLATE utf8mb4_0900_ai_ci
  )
  AND d.tenant_id = a.tenant_id
`;

/**
 * 获取资产概览统计
 */
router.get('/overview', authenticate, async (req, res) => {
  try {
    let tenantId = getTenantId(req);
    if (!tenantId && req.user.role === 'super_admin') {
      tenantId = req.query.tenant_id
        ? parseInt(req.query.tenant_id, 10)
        : req.headers['x-tenant-id']
          ? parseInt(req.headers['x-tenant-id'], 10)
          : null;
    }
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '租户ID缺失' });
    }

    const cacheKey = `overview:${tenantId}:${new Date().toISOString().slice(0, 10)}`;
    const cached = await cacheService.get('asset:stats', cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // 并行执行多个统计查询
    const [
      [totalResult],
      [statusResult],
      [departmentResult],
      [categoryResult],
      [valueResult],
      [monthlyResult],
    ] = await Promise.all([
      // 总资产数
      db.execute('SELECT COUNT(*) as count FROM assets WHERE tenant_id = ? AND is_deleted = 0', [
        tenantId,
      ]),
      // 按状态统计
      db.execute(
        `SELECT status, COUNT(*) as count, SUM(current_value) as total_value
         FROM assets
         WHERE tenant_id = ? AND is_deleted = 0
         GROUP BY status`,
        [tenantId],
      ),
      // 按部门统计
      db.execute(
        `SELECT COALESCE(d.department_name, a.department_new) as department, COUNT(*) as count, SUM(a.purchase_price) as total_value
         FROM assets a
         LEFT JOIN departments d ON ${ASSET_DEPARTMENT_JOIN}
         WHERE a.tenant_id = ? AND a.is_deleted = 0
         GROUP BY COALESCE(d.department_name, a.department_new)
         ORDER BY count DESC
         LIMIT 10`,
        [tenantId],
      ),
      // 按分类统计
      db.execute(
        `SELECT c.name as category, COUNT(*) as count
         FROM assets a
         LEFT JOIN asset_categories c ON a.category_id = c.id
         WHERE a.tenant_id = ? AND a.is_deleted = 0
         GROUP BY a.category_id
         ORDER BY count DESC
         LIMIT 10`,
        [tenantId],
      ),
      // 资产价值统计
      db.execute(
        `SELECT
          SUM(purchase_price) as total_purchase_value,
          SUM(current_value) as total_current_value,
          AVG(purchase_price) as avg_purchase_price,
          COUNT(CASE WHEN current_value < purchase_price * 0.2 THEN 1 END) as low_value_assets
         FROM assets
         WHERE tenant_id = ? AND is_deleted = 0`,
        [tenantId],
      ),
      // 月度新增趋势
      db.execute(
        `SELECT
          DATE_FORMAT(created_at, '%Y-%m') as month,
          COUNT(*) as count,
          SUM(purchase_price) as total_value
         FROM assets
         WHERE tenant_id = ? AND is_deleted = 0
         AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
         GROUP BY month
         ORDER BY month ASC`,
        [tenantId],
      ),
    ]);

    // 处理状态分布为前端期望的格式
    const statusMap = {};
    let inUseCount = 0;
    let idleCount = 0;
    let repairCount = 0;
    let scrapCount = 0;
    let transferCount = 0;

    statusResult.forEach(item => {
      statusMap[item.status] = item.count;
      if (item.status === '在用') inUseCount = item.count;
      else if (item.status === '闲置') idleCount = item.count;
      else if (item.status === '维修') repairCount = item.count;
      else if (item.status === '报废') scrapCount = item.count;
      else if (item.status === '调配中') transferCount = item.count;
    });

    const totalCount = totalResult[0].count;
    // 显示资产原值（购置价格）而非现值
    const totalValue = valueResult[0].total_purchase_value || 0;

    // 计算部门数量（去重）
    const uniqueDepartments = new Set(departmentResult.map(d => d.department).filter(Boolean));
    const departmentsCount = uniqueDepartments.size;

    const result = {
      success: true,
      data: {
        // 前端期望的 overview 格式
        overview: {
          total_count: totalCount,
          total_value: totalValue,
          in_use_count: inUseCount,
          idle_count: idleCount,
          repair_count: repairCount,
          scrap_count: scrapCount,
          transfer_count: transferCount,
        },
        // 保留原有数据结构供其他用途
        total_assets: totalCount,
        by_status: statusResult,
        by_department: departmentResult,
        by_category: categoryResult,
        // 前端兼容字段
        departmentsCount,
        byType: categoryResult, // 前端用 byType 显示资产类别
        value_summary: valueResult[0],
        monthly_trend: monthlyResult,
      },
    };

    // 缓存30分钟
    await cacheService.set('asset:stats', cacheKey, result, { ttl: 1800 });

    res.json(result);
  } catch (error) {
    logger.error('Get overview statistics failed:', error);
    res.status(500).json({ success: false, message: '获取统计概览失败' });
  }
});

/**
 * 按部门统计
 */
router.get('/by-department', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    const [stats] = await db.execute(
      `SELECT
        d.id as department_id,
        d.department_name,
        COUNT(*) as asset_count,
        SUM(a.purchase_price) as total_purchase_value,
        SUM(a.current_value) as total_current_value,
        COUNT(CASE WHEN a.status = '在用' THEN 1 END) as active_count,
        COUNT(CASE WHEN a.status = '闲置' THEN 1 END) as idle_count,
        COUNT(CASE WHEN a.status = '维修' THEN 1 END) as maintenance_count,
        COUNT(CASE WHEN a.status = '报废' THEN 1 END) as scrapped_count
       FROM assets a
       LEFT JOIN departments d ON ${ASSET_DEPARTMENT_JOIN}
       WHERE a.tenant_id = ? AND a.is_deleted = 0
       GROUP BY a.department_new
       ORDER BY asset_count DESC`,
      [tenantId],
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Get department statistics failed:', error);
    res.status(500).json({ success: false, message: '获取部门统计失败' });
  }
});

/**
 * 资产折旧统计
 */
router.get('/depreciation', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    const [stats] = await db.execute(
      `SELECT
        depreciation_method,
        COUNT(*) as count,
        SUM(purchase_price) as total_original_value,
        SUM(current_value) as total_current_value,
        AVG(depreciation_years) as avg_years
       FROM assets
       WHERE tenant_id = ? AND is_deleted = 0
       GROUP BY depreciation_method`,
      [tenantId],
    );

    // 计算已折旧金额
    const [depreciated] = await db.execute(
      `SELECT SUM(purchase_price - current_value) as total_depreciated
       FROM assets
       WHERE tenant_id = ? AND is_deleted = 0 AND current_value < purchase_price`,
      [tenantId],
    );

    res.json({
      success: true,
      data: {
        by_method: stats,
        total_depreciated: depreciated[0].total_depreciated || 0,
      },
    });
  } catch (error) {
    logger.error('Get depreciation statistics failed:', error);
    res.status(500).json({ success: false, message: '获取折旧统计失败' });
  }
});

router.get('/expiring-warranties', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { days = 30 } = req.query;
    const [rows] = await db.execute(
      `SELECT 
        asset_code, 
        asset_name, 
        warranty_end_date as warranty_expiry_date,
        supplier,
        responsible_person
       FROM assets
       WHERE tenant_id = ? AND is_deleted = 0
         AND warranty_end_date IS NOT NULL
         AND warranty_end_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
         AND warranty_end_date >= CURDATE()
       ORDER BY warranty_end_date ASC`,
      [tenantId, parseInt(days, 10)],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('获取即将过期保修失败:', error);
    res.status(500).json({ success: false, message: '获取即将过期保修失败' });
  }
});

module.exports = router;
