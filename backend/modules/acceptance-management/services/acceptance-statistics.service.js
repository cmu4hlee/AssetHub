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

/**
 * HTML 转义（防 XSS）
 */
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * 把验收报告渲染为 HTML（用于 puppeteer 渲染 PDF）
 */
function renderReportHtml({ record, checklist, files, team, summary, generatedBy }) {
  const groupedChecklist = {};
  for (const c of checklist) {
    if (!groupedChecklist[c.category]) groupedChecklist[c.category] = [];
    groupedChecklist[c.category].push(c);
  }

  const checklistHtml = Object.keys(groupedChecklist).sort().map(category => {
    const items = groupedChecklist[category].map(c => {
      const status = c.is_passed === 1 ? '<span style="color:#389e0d">通过</span>'
        : c.is_passed === 0 ? '<span style="color:#cf1322">不通过</span>'
        : '<span style="color:#999">未检查</span>';
      return `<tr>
        <td>${esc(c.item_name)}</td>
        <td>${esc(c.item_description || '')}</td>
        <td>${status}</td>
        <td>${esc(c.remark || '')}</td>
        <td>${esc(c.checked_by || '')}</td>
      </tr>`;
    }).join('');
    return `<tr style="background:#fafafa"><td colspan="5" style="font-weight:bold">${esc(category)}</td></tr>${items}`;
  }).join('');

  const teamHtml = team.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#999">无</td></tr>'
    : team.map(t => `<tr>
        <td>${esc(t.member_name)}</td>
        <td>${esc(t.role || '')}</td>
        <td>${esc(t.department || '')}</td>
        <td>${t.assigned_at ? esc(t.assigned_at.toString().substring(0, 10)) : ''}</td>
      </tr>`).join('');

  const filesHtml = files.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:#999">无</td></tr>'
    : files.map(f => `<tr>
        <td>${esc(f.file_type)}</td>
        <td>${esc(f.file_name)}</td>
        <td>${esc(f.uploaded_by || '')}</td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>验收报告</title>
<style>
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; padding: 20px; color: #333; font-size: 12px; }
  h1 { text-align: center; font-size: 20px; margin: 0 0 8px; }
  .meta { text-align: center; color: #999; margin-bottom: 24px; font-size: 12px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 14px; font-weight: bold; border-bottom: 2px solid #1890ff; padding-bottom: 4px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d9d9d9; padding: 6px 10px; text-align: left; }
  th { background: #f5f5f5; font-weight: bold; }
  .summary-grid { display: flex; gap: 16px; margin-bottom: 16px; }
  .summary-card { flex: 1; border: 1px solid #d9d9d9; padding: 12px; text-align: center; border-radius: 4px; }
  .summary-card .num { font-size: 22px; font-weight: bold; color: #1890ff; }
  .summary-card .label { color: #999; font-size: 12px; margin-top: 4px; }
  .info { display: grid; grid-template-columns: 120px 1fr 120px 1fr; gap: 6px 16px; }
  .info-label { color: #999; }
  .footer { margin-top: 30px; text-align: right; color: #999; font-size: 11px; }
</style></head>
<body>
  <h1>资产验收报告</h1>
  <div class="meta">报告编号：${esc(record.id)} | 生成时间：${esc(new Date().toLocaleString('zh-CN'))}</div>

  <div class="section">
    <div class="section-title">基本信息</div>
    <div class="info">
      <div class="info-label">资产编号：</div><div>${esc(record.asset_code || '')}</div>
      <div class="info-label">资产名称：</div><div>${esc(record.asset_name || '')}</div>
      <div class="info-label">供应商：</div><div>${esc(record.supplier || '')}</div>
      <div class="info-label">验收日期：</div><div>${esc(record.acceptance_date || '')}</div>
      <div class="info-label">使用科室：</div><div>${esc(record.department || '')}</div>
      <div class="info-label">职能部门：</div><div>${esc(record.functional_department || '')}</div>
      <div class="info-label">验收人：</div><div>${esc(record.acceptance_person || '')}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">验收汇总</div>
    <div class="summary-grid">
      <div class="summary-card"><div class="num">${summary.total}</div><div class="label">检查项总数</div></div>
      <div class="summary-card"><div class="num" style="color:#389e0d">${summary.passed}</div><div class="label">通过</div></div>
      <div class="summary-card"><div class="num" style="color:#cf1322">${summary.failed}</div><div class="label">不通过</div></div>
      <div class="summary-card"><div class="num">${summary.unchecked}</div><div class="label">未检查</div></div>
      <div class="summary-card"><div class="num" style="color:#1890ff">${summary.passRate}%</div><div class="label">合格率</div></div>
    </div>
    <div style="margin-top:8px"><strong>当前状态：</strong>${esc(record.status || '')}</div>
    ${record.report_summary ? `<div style="margin-top:8px"><strong>报告摘要：</strong>${esc(record.report_summary)}</div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">验收小组成员</div>
    <table><thead><tr><th>姓名</th><th>角色</th><th>科室</th><th>分配日期</th></tr></thead><tbody>${teamHtml}</tbody></table>
  </div>

  <div class="section">
    <div class="section-title">检查清单</div>
    <table><thead><tr><th style="width:25%">项目</th><th>说明</th><th style="width:10%">结果</th><th>备注</th><th style="width:10%">检查人</th></tr></thead>
    <tbody>${checklistHtml || '<tr><td colspan="5" style="text-align:center;color:#999">暂无检查项</td></tr>'}</tbody></table>
  </div>

  <div class="section">
    <div class="section-title">附件资料</div>
    <table><thead><tr><th style="width:20%">类型</th><th>文件名</th><th>上传人</th></tr></thead><tbody>${filesHtml}</tbody></table>
  </div>

  <div class="footer">由 ${esc(generatedBy || '系统')} 导出 · AssetHub</div>
</body></html>`;
}

/**
 * 用 puppeteer 把 HTML 渲染为 PDF（Buffer）
 */
async function renderPdfFromHtml(html) {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });
  } finally {
    await browser.close();
  }
}

/**
 * 生成验收报告 PDF：先查数据 → 渲染 HTML → 渲染 PDF
 * @returns {Promise<Buffer>}
 */
async function generateReportPdf({ id, tenantFilter, user }) {
  const data = await getReport({ id, tenantFilter });
  if (!data) {
    const err = new Error('验收记录不存在');
    err.statusCode = 404;
    throw err;
  }
  const html = renderReportHtml({
    record: data.record,
    checklist: data.checklist,
    files: data.files,
    team: data.team,
    summary: data.summary,
    generatedBy: user?.real_name || user?.username,
  });
  return await renderPdfFromHtml(html);
}

module.exports = {
  getStatisticsOverview,
  getStatisticsTrend,
  getReport,
  generateReport,
  generateReportPdf,
};
