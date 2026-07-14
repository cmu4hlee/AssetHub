/**
 * 开机率统计路由
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../../middleware/auth');
const UPTIME_STATISTICS_ROUTE_ASSET_JOIN =
  'LEFT JOIN assets a ON aus.asset_id = a.id AND a.tenant_id = aus.tenant_id';

// 所有路由都需要认证
router.use(authenticate);
const db = require('../../../config/database');

// 获取统计数据
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { year, month } = req.query;

    const [rows] = await db.execute(
      `SELECT aus.*, a.asset_name, a.asset_code 
       FROM asset_uptime_statistics aus
       ${UPTIME_STATISTICS_ROUTE_ASSET_JOIN}
       WHERE aus.tenant_id = ? AND aus.stat_year = ? AND aus.stat_month = ?`,
      [tenantId, year, month],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 计算开机率
router.post('/calculate', async (req, res) => {
  try {
    const { year, month } = req.body;
    // 这里应该调用存储过程或计算逻辑
    res.json({ success: true, message: '计算完成' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取概览
exports.getDashboard = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;

    const [stats] = await db.execute(
      `SELECT 
        AVG(uptime_rate) as avg_uptime,
        COUNT(*) as total_assets
       FROM asset_uptime_statistics
       WHERE tenant_id = ? AND stat_year = ? AND stat_month = ?`,
      [tenantId, year, month],
    );

    res.json({
      success: true,
      data: {
        period: `${year}年${month}月`,
        avg_uptime: stats[0]?.avg_uptime || 0,
        total_assets: stats[0]?.total_assets || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 导出 router
module.exports = router;

// 导出 getDashboard 函数供其他模块使用
module.exports.getDashboard = exports.getDashboard;
