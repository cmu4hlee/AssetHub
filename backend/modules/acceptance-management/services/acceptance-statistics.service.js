/**
 * 验收统计 + 报告 - 服务层
 *
 * 涵盖：概览统计、趋势统计、报告查询、报告生成（写回 report_summary）。
 */
const db = require('../../../config/database');
const { getTenantId } = require('../../../middleware/tenant-filter');

/**
 * 概览统计：验收记录/申请的总数、状态分布、合格率、模板数
 */
async function getStatisticsOverview({ tenantFilter, startDate, endDate }) {
  // 验收记录按 acceptance_date 过滤
  let dateClause = '';
  const dateParams = [];
  if (startDate && endDate) {
    dateClause = ' AND acceptance_date >= ? AND acceptance_date <= ?';
    dateParams.push(startDate, endDate);
  }
  const recordParams = [...tenantFilter.params, ...dateParams];

  const [totalResult] = await db.execute(
    `SELECT COUNT(*) as total FROM asset_acceptance_records WHERE 1=1${tenantFilter.whereClause}${dateClause}`,
    recordParams,
  );
  const [statusResult] = await db.execute(
    `SELECT status, COUNT(*) as count FROM asset_acceptance_records WHERE 1=1${tenantFilter.whereClause}${dateClause} GROUP BY status`,
    recordParams,
  );
  const [deptResult] = await db.execute(
    `SELECT department, COUNT(*) as count FROM asset_acceptance_records WHERE 1=1${tenantFilter.whereClause}${dateClause} GROUP BY department ORDER BY count DESC LIMIT 10`,
    recordParams,
  );

  // 验收申请按 created_at 过滤
  let appDateClause = '';
  const appDateParams = [];
  if (startDate && endDate) {
    appDateClause = ' AND created_at >= ? AND created_at <= ?';
    appDateParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
  }
  const appParams = [...tenantFilter.params, ...appDateParams];

  const [appTotal] = await db.execute(
    `SELECT COUNT(*) as total FROM acceptance_applications WHERE is_deleted = 0${tenantFilter.whereClause}${appDateClause}`,
    appParams,
  );
  const [appStatus] = await db.execute(
    `SELECT status, COUNT(*) as count FROM acceptance_applications WHERE is_deleted = 0${tenantFilter.whereClause}${appDateClause} GROUP BY status`,
    appParams,
  );

  // 合格率 = 已验收 / (已验收 + 不合格)
  const passed = statusResult.find(s => s.status === '已验收')?.count || 0;
  const failed = statusResult.find(s => s.status === '验收不合格')?.count || 0;
  const completed = passed + failed;
  const passRate = completed > 0 ? ((passed / completed) * 100).toFixed(1) : '0.0';

  const tenantId = tenantFilter.params[0]; // 简化：第一个参数必为 tenant_id
  const [templateCount] = await db.execute(
    `SELECT COUNT(*) as total FROM asset_acceptance_templates WHERE (tenant_id = ? OR tenant_id IS NULL) AND is_deleted = 0`,
    [tenantId],
  );

  return {
    records: {
      total: totalResult[0].total,
      statusDistribution: statusResult,
      departmentDistribution: deptResult,
    },
    applications: {
      total: appTotal[0].total,
      statusDistribution: appStatus,
    },
    passRate: parseFloat(passRate),
    templateCount: templateCount[0].total,
  };
}

/**
 * 趋势统计：按月聚合验收数量、通过/失败
 * @param months  默认近 12 月；如提供 startDate/endDate 则精确区间
 */
async function getStatisticsTrend({ tenantFilter, months = 12, startDate, endDate }) {
  let dateCondition;
  let trendParams;
  if (startDate && endDate) {
    dateCondition = 'AND acceptance_date >= ? AND acceptance_date <= ?';
    trendParams = [...tenantFilter.params, startDate, endDate];
  } else {
    dateCondition = 'AND acceptance_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)';
    trendParams = [...tenantFilter.params, parseInt(months, 10) || 12];
  }

  const [trend] = await db.execute(
    `SELECT DATE_FORMAT(acceptance_date, '%Y-%m') as month,
            COUNT(*) as total,
            SUM(CASE WHEN status = '已验收' THEN 1 ELSE 0 END) as passed,
            SUM(CASE WHEN status = '验收不合格' THEN 1 ELSE 0 END) as failed
     FROM asset_acceptance_records
     WHERE 1=1${tenantFilter.whereClause}
       ${dateCondition}
     GROUP BY DATE_FORMAT(acceptance_date, '%Y-%m')
     ORDER BY month ASC`,
    trendParams,
  );
  return trend;
}

/**
 * 获取验收报告（详情 + checklist + files + team + 统计）
 */
async function getReport({ id, tenantFilter }) {
  const [records] = await db.execute(
    `SELECT * FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );
  if (records.length === 0) return null;
  const record = records[0];

  const [checklist] = await db.execute(
    `SELECT * FROM asset_acceptance_checklist WHERE acceptance_id = ? AND is_deleted = 0 ORDER BY category, sort_order, id`,
    [id],
  );
  const [files] = await db.execute(
    `SELECT * FROM asset_acceptance_files WHERE acceptance_id = ? AND is_deleted = 0`,
    [id],
  );
  const [team] = await db.execute(
    `SELECT * FROM acceptance_teams WHERE acceptance_record_id = ? AND is_deleted = 0`,
    [id],
  );

  // 计算 summary
  const total = checklist.length;
  const passed = checklist.filter(c => c.is_passed === 1).length;
  const failed = checklist.filter(c => c.is_passed === 0).length;
  const unchecked = checklist.filter(c => c.is_passed === null).length;

  const byCategory = {};
  for (const c of checklist) {
    if (!byCategory[c.category]) byCategory[c.category] = { total: 0, passed: 0, failed: 0, unchecked: 0 };
    byCategory[c.category].total++;
    if (c.is_passed === 1) byCategory[c.category].passed++;
    else if (c.is_passed === 0) byCategory[c.category].failed++;
    else byCategory[c.category].unchecked++;
  }

  return {
    record,
    checklist,
    files,
    team,
    summary: {
      total, passed, failed, unchecked,
      passRate: total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0',
      byCategory,
    },
  };
}

/**
 * 生成/更新验收报告：计算汇总文本，写回 report_summary 等字段
 */
async function generateReport({ id, tenantFilter, user }) {
  const [records] = await db.execute(
    `SELECT id FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );
  if (records.length === 0) {
    const err = new Error('验收记录不存在');
    err.statusCode = 404;
    throw err;
  }

  const [checklist] = await db.execute(
    `SELECT * FROM asset_acceptance_checklist WHERE acceptance_id = ? AND is_deleted = 0`,
    [id],
  );
  const total = checklist.length;
  const passed = checklist.filter(c => c.is_passed === 1).length;
  const failed = checklist.filter(c => c.is_passed === 0).length;
  const unchecked = checklist.filter(c => c.is_passed === null).length;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

  const reportSummary = `验收报告：共${total}项检查，通过${passed}项，不通过${failed}项，未检查${unchecked}项，合格率${passRate}%。`;

  await db.execute(
    `UPDATE asset_acceptance_records SET report_summary = ?, report_generated_at = NOW(), report_generated_by = ? WHERE id = ?`,
    [reportSummary, user.real_name || user.username, id],
  );

  return { report_summary: reportSummary, pass_rate: parseFloat(passRate) };
}

module.exports = {
  getStatisticsOverview,
  getStatisticsTrend,
  getReport,
  generateReport,
};
