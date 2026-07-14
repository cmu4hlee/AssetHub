/**
 * 通用报表打印工具
 * 通过打开新窗口并调用浏览器打印功能实现报表打印
 */

/**
 * 转义 HTML 特殊字符，防止 XSS
 * @param {*} value
 * @returns {string}
 */
const escapeHtml = value => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * 格式化日期时间
 * @param {string|Date|null} date
 * @param {boolean} withTime 是否包含时间
 * @returns {string}
 */
const formatDate = (date, withTime = true) => {
  if (!date) return '-';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (!withTime) return dateStr;
  return `${dateStr} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/**
 * 生成报表基础 HTML 模板
 * @param {Object} options
 * @param {string} options.title 报表标题
 * @param {string} options.subtitle 报表副标题
 * @param {string} options.bodyHtml 报表主体 HTML 内容
 * @param {Object} [options.meta] 报表元信息 { 生成时间, 生成人, 统计范围... }
 * @returns {string} 完整的 HTML 文档字符串
 */
const buildReportHtml = ({ title, subtitle = '', bodyHtml, meta = {} }) => {
  const generatedAt = meta.generatedAt || formatDate(new Date());
  const generatedBy = meta.generatedBy || '-';
  const period = meta.period || '-';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
      color: #1f1f1f;
      margin: 0;
      padding: 24px 32px;
      font-size: 12px;
      line-height: 1.6;
    }
    .report-header {
      text-align: center;
      border-bottom: 2px solid #1890ff;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .report-header h1 {
      font-size: 22px;
      margin: 0 0 6px;
      color: #1890ff;
    }
    .report-header .subtitle {
      font-size: 13px;
      color: #666;
      margin: 0;
    }
    .report-meta {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      background: #fafafa;
      border: 1px solid #f0f0f0;
      padding: 10px 16px;
      border-radius: 4px;
      margin-bottom: 20px;
      font-size: 11px;
    }
    .report-meta-item { color: #666; }
    .report-meta-item strong { color: #1f1f1f; }
    .report-section { margin-bottom: 24px; page-break-inside: avoid; }
    .report-section h2 {
      font-size: 15px;
      color: #1f1f1f;
      border-left: 4px solid #1890ff;
      padding-left: 8px;
      margin: 0 0 12px;
    }
    table.report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    table.report-table th,
    table.report-table td {
      border: 1px solid #d9d9d9;
      padding: 6px 8px;
      text-align: left;
      word-break: break-all;
    }
    table.report-table th {
      background: #f5f5f5;
      font-weight: 600;
      color: #1f1f1f;
      white-space: nowrap;
    }
    table.report-table tbody tr:nth-child(even) { background: #fafafa; }
    table.report-table tbody tr:hover { background: #e6f7ff; }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .stat-card {
      border: 1px solid #f0f0f0;
      border-radius: 4px;
      padding: 12px;
      text-align: center;
    }
    .stat-card .stat-value {
      font-size: 20px;
      font-weight: 600;
      color: #1890ff;
      margin-bottom: 4px;
    }
    .stat-card .stat-label {
      font-size: 11px;
      color: #999;
    }
    .stat-card.warning .stat-value { color: #faad14; }
    .stat-card.success .stat-value { color: #52c41a; }
    .stat-card.danger .stat-value { color: #f5222d; }
    .report-footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #f0f0f0;
      text-align: center;
      color: #999;
      font-size: 10px;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .tag {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 10px;
      background: #f0f0f0;
      color: #666;
    }
    .tag.green { background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; }
    .tag.blue { background: #e6f7ff; color: #1890ff; border: 1px solid #91d5ff; }
    .tag.orange { background: #fff7e6; color: #fa8c16; border: 1px solid #ffd591; }
    .tag.red { background: #fff1f0; color: #f5222d; border: 1px solid #ffa39e; }
    .tag.gray { background: #fafafa; color: #999; border: 1px solid #d9d9d9; }
    .empty-data {
      text-align: center;
      padding: 40px 0;
      color: #999;
    }
    @media print {
      body { padding: 12px; }
      .report-section { page-break-inside: avoid; }
      table.report-table { page-break-inside: auto; }
      table.report-table tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
  </div>
  <div class="report-meta">
    <div class="report-meta-item">统计范围：<strong>${escapeHtml(period)}</strong></div>
    <div class="report-meta-item">生成人：<strong>${escapeHtml(generatedBy)}</strong></div>
    <div class="report-meta-item">生成时间：<strong>${escapeHtml(generatedAt)}</strong></div>
  </div>
  ${bodyHtml}
  <div class="report-footer">
    本报表由资产管理系统自动生成 · 第 ${new Date().getTime()} 号
  </div>
</body>
</html>`;
};

/**
 * 渲染统计卡片网格
 * @param {Array<{label:string, value:string|number, tone?:string}>} cards
 * @returns {string}
 */
const renderStatGrid = cards => {
  if (!cards || cards.length === 0) return '';
  const items = cards
    .map(c => {
      const tone = c.tone ? ` ${c.tone}` : '';
      return `<div class="stat-card${tone}">
        <div class="stat-value">${escapeHtml(c.value)}</div>
        <div class="stat-label">${escapeHtml(c.label)}</div>
      </div>`;
    })
    .join('');
  return `<div class="stat-grid">${items}</div>`;
};

/**
 * 渲染数据表格
 * @param {Array<string>} headers 表头
 * @param {Array<Array<*>>} rows 数据行
 * @returns {string}
 */
const renderTable = (headers, rows) => {
  if (!rows || rows.length === 0) {
    return '<div class="empty-data">暂无数据</div>';
  }
  const headHtml = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const bodyHtml = rows
    .map(
      row =>
        `<tr>${row.map(cell => `<td>${cell == null ? '' : cell}</td>`).join('')}</tr>`
    )
    .join('');
  return `<table class="report-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
};

/**
 * 打开新窗口并打印报表
 * @param {Object} options 报表配置
 * @param {string} options.title 报表标题
 * @param {string} [options.subtitle] 副标题
 * @param {string} options.bodyHtml 报表主体 HTML
 * @param {Object} [options.meta] 元信息
 */
export const printReport = options => {
  const html = buildReportHtml(options);
  const win = window.open('', '_blank', 'width=1024,height=768');
  if (!win) {
    // 弹窗被拦截，回退到当前窗口打印
    const printContainer = document.createElement('div');
    printContainer.style.position = 'fixed';
    printContainer.style.right = '0';
    printContainer.style.bottom = '0';
    printContainer.style.width = '0';
    printContainer.style.height = '0';
    printContainer.style.overflow = 'hidden';
    const iframe = document.createElement('iframe');
    printContainer.appendChild(iframe);
    document.body.appendChild(printContainer);
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(printContainer), 1000);
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  // 等待样式加载后再打印
  setTimeout(() => {
    win.print();
  }, 300);
};

/**
 * 打印统计报表
 * @param {Object} stats 资产统计数据
 * @param {Object} maintenanceStats 维护统计数据
 * @param {Object} [options] 额外配置 { period, generatedBy }
 */
export const printStatisticsReport = (stats, maintenanceStats, options = {}) => {
  const overview = stats?.overview || {};
  const totalCount = overview.total_count || stats?.total_assets || stats?.total || 0;
  const totalValue = overview.total_value || stats?.total_value || 0;

  const formatCurrency = value => {
    if (value >= 100000000) return `${(value / 100000000).toFixed(2)} 亿元`;
    if (value >= 10000) return `${(value / 10000).toFixed(2)} 万元`;
    return `${Number(value || 0).toLocaleString()} 元`;
  };

  // 概览统计卡片
  const overviewCards = [
    { label: '资产总数', value: totalCount, tone: 'success' },
    { label: '在用资产', value: overview.in_use_count || 0 },
    { label: '闲置资产', value: overview.idle_count || 0 },
    { label: '维修中', value: overview.repair_count || 0, tone: 'warning' },
    { label: '调配中', value: overview.transfer_count || 0 },
    { label: '已报废', value: overview.scrap_count || 0, tone: 'danger' },
    { label: '资产总值', value: formatCurrency(totalValue) },
    { label: '保修期内', value: overview.warranty_count || 0 },
  ];

  // 维护统计卡片
  const maintCards = maintenanceStats
    ? [
        {
          label: '维护总数',
          value: maintenanceStats.total_count || maintenanceStats.total || 0,
        },
        {
          label: '故障维修',
          value:
            maintenanceStats.fault_repair_count || maintenanceStats.faultRepair || 0,
          tone: 'danger',
        },
        {
          label: '预防性维护',
          value: maintenanceStats.preventive_count || maintenanceStats.preventive || 0,
        },
        {
          label: '日常维护',
          value: maintenanceStats.routine_count || maintenanceStats.routine || 0,
        },
        {
          label: '已完成',
          value: maintenanceStats.completed_count || maintenanceStats.completed || 0,
          tone: 'success',
        },
        {
          label: '处理中',
          value: maintenanceStats.in_progress_count || maintenanceStats.inProgress || 0,
          tone: 'warning',
        },
        {
          label: '总费用',
          value: `${Number(
            maintenanceStats.total_cost || maintenanceStats.totalCost || 0
          ).toLocaleString()} 元`,
        },
        {
          label: '平均耗时',
          value: `${maintenanceStats.avg_duration || 0} 小时`,
        },
      ]
    : [];

  // 分类分布
  const categoryRows = (stats?.by_category || []).map(item => [
    escapeHtml(item.category_name || item.name || '-'),
    escapeHtml(item.count || item.total || 0),
    escapeHtml(item.total_value ? formatCurrency(item.total_value) : '-'),
  ]);

  // 部门分布
  const departmentRows = (stats?.by_department || []).map(item => [
    escapeHtml(item.department_name || item.name || '-'),
    escapeHtml(item.count || item.total || 0),
    escapeHtml(item.total_value ? formatCurrency(item.total_value) : '-'),
  ]);

  const bodyHtml = `
    <div class="report-section">
      <h2>资产概览</h2>
      ${renderStatGrid(overviewCards)}
    </div>
    ${
      maintenanceStats
        ? `<div class="report-section">
      <h2>维护概览</h2>
      ${renderStatGrid(maintCards)}
    </div>`
        : ''
    }
    ${
      categoryRows.length > 0
        ? `<div class="report-section">
      <h2>资产分类分布</h2>
      ${renderTable(['分类名称', '数量', '总值'], categoryRows)}
    </div>`
        : ''
    }
    ${
      departmentRows.length > 0
        ? `<div class="report-section">
      <h2>部门资产分布</h2>
      ${renderTable(['部门名称', '数量', '总值'], departmentRows)}
    </div>`
        : ''
    }
  `;

  printReport({
    title: '资产统计数据报表',
    subtitle: '资产运营总览与维护统计',
    bodyHtml,
    meta: {
      period: options.period || '全部数据',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/**
 * 打印维修维护日志报表
 * @param {Array} logs 维护日志列表
 * @param {Object} [statistics] 维护统计
 * @param {Object} [options] 额外配置 { period, generatedBy }
 */
export const printMaintenanceReport = (logs, statistics, options = {}) => {
  const maintTypeMap = {
    fault_repair: '故障维修',
    preventive: '预防性维护',
    routine: '日常维护',
    other: '其他',
  };
  const statusMap = {
    pending: '<span class="tag orange">待处理</span>',
    in_progress: '<span class="tag blue">处理中</span>',
    completed: '<span class="tag green">已完成</span>',
    cancelled: '<span class="tag gray">已取消</span>',
  };

  // 统计卡片
  const cards = statistics
    ? [
        { label: '维护总数', value: statistics.total_count || statistics.total || 0 },
        {
          label: '已完成',
          value: statistics.completed_count || statistics.completed || 0,
          tone: 'success',
        },
        {
          label: '处理中',
          value: statistics.in_progress_count || statistics.inProgress || 0,
          tone: 'warning',
        },
        {
          label: '总费用',
          value: `${Number(
            statistics.total_cost || statistics.totalCost || 0
          ).toLocaleString()} 元`,
        },
      ]
    : [];

  // 明细表格
  const rows = (logs || []).map(log => [
    escapeHtml(log.log_no || log.id || '-'),
    escapeHtml(log.asset_code || '-'),
    escapeHtml(log.asset_name || '-'),
    escapeHtml(maintTypeMap[log.maintenance_type] || log.maintenance_type || '-'),
    statusMap[log.status] || escapeHtml(log.status || '-'),
    escapeHtml(log.maintainer || log.assigned_to || '-'),
    escapeHtml(log.maintenance_date ? formatDate(log.maintenance_date, false) : '-'),
    escapeHtml(log.cost != null ? `¥${Number(log.cost).toFixed(2)}` : '-'),
    escapeHtml(log.description || '-'),
  ]);

  const bodyHtml = `
    ${statistics ? `<div class="report-section"><h2>维护统计</h2>${renderStatGrid(cards)}</div>` : ''}
    <div class="report-section">
      <h2>维护日志明细</h2>
      ${renderTable(
        ['日志编号', '资产编号', '资产名称', '维护类型', '状态', '维护人', '维护日期', '费用', '描述'],
        rows
      )}
    </div>
  `;

  printReport({
    title: '维修维护报表',
    subtitle: '维护日志明细与统计',
    bodyHtml,
    meta: {
      period: options.period || '全部数据',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/**
 * 打印工单报表
 * @param {Array} workOrders 工单列表
 * @param {Object} [dispatchPanel] 调度面板数据
 * @param {Object} [options] 额外配置 { period, generatedBy }
 */
export const printWorkOrderReport = (workOrders, dispatchPanel, options = {}) => {
  const priorityMap = {
    1: '<span class="tag red">紧急</span>',
    2: '<span class="tag orange">高</span>',
    3: '<span class="tag blue">中</span>',
    4: '<span class="tag gray">低</span>',
    urgent: '<span class="tag red">紧急</span>',
    high: '<span class="tag orange">高</span>',
    normal: '<span class="tag blue">中</span>',
    low: '<span class="tag gray">低</span>',
  };
  const statusMap = {
    pending: '<span class="tag orange">待分配</span>',
    assigned: '<span class="tag blue">已分配</span>',
    in_progress: '<span class="tag blue">进行中</span>',
    pending_review: '<span class="tag orange">待审核</span>',
    completed: '<span class="tag green">已完成</span>',
    closed: '<span class="tag gray">已关闭</span>',
    cancelled: '<span class="tag red">已取消</span>',
  };
  const sourceTypeMap = {
    request: '维修申请',
    plan: '预防性维护',
    preventive: '预防性维护',
    manual: '手动创建',
    fault: '故障报修',
    other: '其他',
  };

  // 概览卡片
  const overview = dispatchPanel?.overview || {};
  const cards = [
    { label: '工单总数', value: overview.total_count || workOrders.length || 0 },
    { label: '待分配', value: overview.pending_count || 0, tone: 'warning' },
    { label: '进行中', value: overview.in_progress_count || 0, tone: 'warning' },
    { label: '已完成', value: overview.completed_count || 0, tone: 'success' },
  ];

  // 明细表格
  const rows = (workOrders || []).map(order => {
    const totalCost =
      (order.labor_cost || 0) +
      (order.material_cost || 0) +
      (order.outsourcing_cost || 0) +
      (order.other_cost || 0);
    const planTime = `${order.planned_start_date ? formatDate(order.planned_start_date, false) : '-'} ~ ${
      order.planned_end_date ? formatDate(order.planned_end_date, false) : '-'
    }`;
    return [
      escapeHtml(order.work_order_no || '-'),
      escapeHtml(order.title || '-'),
      escapeHtml(order.asset_code || '-'),
      escapeHtml(sourceTypeMap[order.source_type] || order.source_type || '-'),
      priorityMap[order.priority] || escapeHtml(order.priority || '-'),
      statusMap[order.status] || escapeHtml(order.status || '-'),
      escapeHtml(order.assigned_to || '-'),
      escapeHtml(planTime),
      escapeHtml(totalCost > 0 ? `¥${totalCost.toFixed(2)}` : '-'),
      escapeHtml(order.created_at ? formatDate(order.created_at) : '-'),
    ];
  });

  // 工程师工作量
  const technicianRows = (dispatchPanel?.technicians || []).map(item => [
    escapeHtml(item.engineer_name || '-'),
    escapeHtml(item.total_count || 0),
    escapeHtml(item.pending_count || 0),
    escapeHtml(item.in_progress_count || 0),
    escapeHtml(item.completed_count || 0),
  ]);

  const bodyHtml = `
    <div class="report-section">
      <h2>工单概览</h2>
      ${renderStatGrid(cards)}
    </div>
    ${
      technicianRows.length > 0
        ? `<div class="report-section">
      <h2>工程师工作量</h2>
      ${renderTable(['工程师', '总计', '待分配', '进行中', '已完成'], technicianRows)}
    </div>`
        : ''
    }
    <div class="report-section">
      <h2>工单明细</h2>
      ${renderTable(
        ['工单编号', '标题', '资产编号', '来源', '优先级', '状态', '负责人', '计划时间', '成本', '创建时间'],
        rows
      )}
    </div>
  `;

  printReport({
    title: '维护工单报表',
    subtitle: '工单明细与调度统计',
    bodyHtml,
    meta: {
      period: options.period || '全部数据',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/**
 * 打印单个工单详情报表
 * @param {Object} order 工单详情数据
 * @param {Object} [options] 额外配置 { period, generatedBy }
 */
export const printWorkOrderDetailReport = (order, options = {}) => {
  if (!order) return;

  const priorityLabelMap = {
    1: '紧急',
    2: '高',
    3: '中',
    4: '低',
    urgent: '紧急',
    high: '高',
    normal: '中',
    low: '低',
  };
  const statusLabelMap = {
    pending: '待分配',
    assigned: '已分配',
    in_progress: '进行中',
    pending_review: '待审核',
    completed: '已完成',
    closed: '已关闭',
    cancelled: '已取消',
  };
  const sourceTypeLabelMap = {
    request: '维修申请',
    plan: '预防性维护',
    preventive: '预防性维护',
    manual: '手动创建',
    fault: '故障报修',
    other: '其他',
  };

  const labor = Number(order.labor_cost || 0);
  const material = Number(order.material_cost || 0);
  const outsourcing = Number(order.outsourcing_cost || 0);
  const other = Number(order.other_cost || 0);
  const totalCost = labor + material + outsourcing + other;

  // 基本信息
  const basicInfoRows = [
    ['工单编号', escapeHtml(order.work_order_no || '-')],
    ['关联资产', escapeHtml(order.asset_code || '-')],
    ['标题', escapeHtml(order.title || '-')],
    ['描述', escapeHtml(order.description || '-')],
    ['优先级', escapeHtml(priorityLabelMap[order.priority] || order.priority || '-')],
    ['状态', escapeHtml(statusLabelMap[order.status] || order.status || '-')],
    ['负责人', escapeHtml(order.assigned_to || '-')],
  ];

  // 来源信息
  const sourceInfoRows = [
    [
      '来源类型',
      escapeHtml(sourceTypeLabelMap[order.source_type] || order.source_type || '-'),
    ],
    ['来源ID', escapeHtml(order.source_id || '-')],
  ];

  // 时间线
  const timelineKeys = [
    { key: 'created_at', label: '创建时间' },
    { key: 'assigned_at', label: '分配时间' },
    { key: 'started_at', label: '开始时间' },
    { key: 'completed_at', label: '完成时间' },
    { key: 'closed_at', label: '关闭时间' },
  ];
  const timelineRows = timelineKeys
    .filter(item => order[item.key])
    .map(item => [
      escapeHtml(item.label),
      escapeHtml(formatDate(order[item.key])),
    ]);

  // 费用明细
  const costRows = [
    ['人工费', escapeHtml(`¥${labor.toFixed(2)}`)],
    ['材料费', escapeHtml(`¥${material.toFixed(2)}`)],
    ['外包费', escapeHtml(`¥${outsourcing.toFixed(2)}`)],
    ['其他费用', escapeHtml(`¥${other.toFixed(2)}`)],
    [
      '总成本',
      `<strong style="color:#f5222d;font-size:13px;">¥${totalCost.toFixed(2)}</strong>`,
    ],
  ];

  const bodyHtml = `
    <div class="report-section">
      <h2>基本信息</h2>
      ${renderTable(['项目', '内容'], basicInfoRows)}
    </div>
    <div class="report-section">
      <h2>来源信息</h2>
      ${renderTable(['项目', '内容'], sourceInfoRows)}
    </div>
    ${
      timelineRows.length > 0
        ? `<div class="report-section">
      <h2>工单时间线</h2>
      ${renderTable(['节点', '时间'], timelineRows)}
    </div>`
        : ''
    }
    <div class="report-section">
      <h2>费用明细</h2>
      ${renderTable(['费用项', '金额'], costRows)}
    </div>
  `;

  printReport({
    title: '维护工单详情报表',
    subtitle: `工单编号: ${order.work_order_no || '-'}`,
    bodyHtml,
    meta: {
      period: options.period || '单工单详情',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/* ==================== 资产相关报表 ==================== */

/**
 * 打印资产列表报表
 * @param {Array} assets 资产列表
 * @param {Object} [options] { period, generatedBy }
 */
export const printAssetListReport = (assets, options = {}) => {
  const statusMap = {
    in_use: '<span class="tag green">在用</span>',
    idle: '<span class="tag gray">闲置</span>',
    repair: '<span class="tag orange">维修中</span>',
    transfer: '<span class="tag blue">调配中</span>',
    scrap: '<span class="tag red">已报废</span>',
    scrapped: '<span class="tag red">已报废</span>',
  };
  const rows = (assets || []).map(a => [
    escapeHtml(a.asset_code || '-'),
    escapeHtml(a.asset_name || '-'),
    escapeHtml(a.category_name || a.asset_type || '-'),
    escapeHtml(a.brand || '-'),
    escapeHtml(a.model || '-'),
    escapeHtml(a.serial_number || '-'),
    escapeHtml(a.department || a.department_name || '-'),
    escapeHtml(a.responsible_person || '-'),
    escapeHtml(a.storage_location || a.location || '-'),
    statusMap[a.status] || escapeHtml(a.status || '-'),
    escapeHtml(a.purchase_price != null ? `¥${Number(a.purchase_price).toLocaleString()}` : '-'),
  ]);

  const bodyHtml = `
    <div class="report-section">
      <h2>资产清单</h2>
      ${renderTable(
        ['资产编号', '资产名称', '分类', '品牌', '型号', '序列号', '部门', '责任人', '存放位置', '状态', '购置价格'],
        rows
      )}
    </div>
  `;

  printReport({
    title: '资产清单报表',
    subtitle: `共 ${rows.length} 条资产记录`,
    bodyHtml,
    meta: {
      period: options.period || '全部数据',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/**
 * 打印单个资产详情报表
 * @param {Object} asset 资产详情数据
 * @param {Object} [options] { generatedBy }
 */
export const printAssetDetailReport = (asset, options = {}) => {
  if (!asset) return;

  const statusMap = {
    in_use: '在用',
    idle: '闲置',
    repair: '维修中',
    transfer: '调配中',
    scrap: '已报废',
    scrapped: '已报废',
  };

  const formatCurrency = value =>
    value != null ? `¥${Number(value).toLocaleString()}` : '-';

  const basicRows = [
    ['资产编号', escapeHtml(asset.asset_code || '-')],
    ['资产名称', escapeHtml(asset.asset_name || '-')],
    ['资产类型', escapeHtml(asset.asset_type || '-')],
    ['资产状态', escapeHtml(statusMap[asset.status] || asset.status || '-')],
    ['分类', escapeHtml(asset.category_name || '-')],
    ['品牌', escapeHtml(asset.brand || '-')],
    ['型号', escapeHtml(asset.model || '-')],
    ['序列号', escapeHtml(asset.serial_number || '-')],
    ['管理部门', escapeHtml(asset.department_name || asset.department || '-')],
    ['责任人', escapeHtml(asset.responsible_person || '-')],
    ['使用人', escapeHtml(asset.user_name || '-')],
    ['购置日期', escapeHtml(asset.purchase_date ? formatDate(asset.purchase_date, false) : '-')],
    ['使用期限(月)', escapeHtml(asset.service_life_months || '-')],
    ['购置价格', escapeHtml(formatCurrency(asset.purchase_price))],
    ['当前净值', escapeHtml(formatCurrency(asset.current_value))],
    ['供应商', escapeHtml(asset.supplier || '-')],
    ['保修期至', escapeHtml(asset.warranty_expiry_date ? formatDate(asset.warranty_expiry_date, false) : '-')],
    ['备注', escapeHtml(asset.remark || '-')],
    ['创建时间', escapeHtml(asset.created_at ? formatDate(asset.created_at) : '-')],
    ['更新时间', escapeHtml(asset.updated_at ? formatDate(asset.updated_at) : '-')],
  ];

  const bodyHtml = `
    <div class="report-section">
      <h2>资产基本信息</h2>
      ${renderTable(['项目', '内容'], basicRows)}
    </div>
  `;

  printReport({
    title: '资产详情报表',
    subtitle: `${asset.asset_name || ''} (${asset.asset_code || '-'})`,
    bodyHtml,
    meta: {
      period: '单资产详情',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/**
 * 打印资产折旧报表
 * @param {Object} depreciationData 折旧数据 { assets, summary }
 * @param {Array} summaryByDept 部门汇总
 * @param {Array} summaryByType 类型汇总
 * @param {Array} summaryByMonth 月度趋势
 * @param {Object} [options] { period, generatedBy }
 */
export const printDepreciationReport = (
  depreciationData,
  summaryByDept,
  summaryByType,
  summaryByMonth,
  options = {}
) => {
  const summary = depreciationData?.summary || {};
  const assets = depreciationData?.assets || [];

  const formatCurrency = value =>
    value != null ? `¥${Number(value).toLocaleString()}` : '-';

  const cards = [
    { label: '资产总数', value: summary.totalAssets || assets.length || 0 },
    {
      label: '购置总额',
      value: formatCurrency(summary.totalPurchasePrice || summary.total_purchase_price),
    },
    {
      label: '累计折旧',
      value: formatCurrency(summary.totalAccumulatedDepreciation || summary.total_accumulated_depreciation),
    },
    {
      label: '账面净值',
      value: formatCurrency(summary.totalBookValue || summary.total_book_value),
    },
  ];

  const assetRows = assets.map(a => {
    const dep = a.depreciation || {};
    return [
      escapeHtml(a.asset_code || '-'),
      escapeHtml(a.asset_name || '-'),
      escapeHtml(a.asset_type || '-'),
      escapeHtml(a.department || '-'),
      escapeHtml(formatCurrency(dep.purchasePrice ?? a.purchase_price)),
      escapeHtml(formatCurrency(dep.accumulatedDepreciation)),
      escapeHtml(formatCurrency(dep.currentBookValue)),
      escapeHtml(dep.depreciationRate != null ? `${(dep.depreciationRate * 100).toFixed(1)}%` : '-'),
      escapeHtml(dep.monthsUsed ?? '-'),
      escapeHtml(dep.remainingMonths ?? '-'),
    ];
  });

  const deptRows = (summaryByDept || []).map(d => [
    escapeHtml(d.departmentName || d.department_name || '-'),
    escapeHtml(d.assetCount ?? d.asset_count ?? '-'),
    escapeHtml(formatCurrency(d.totalPurchasePrice ?? d.total_purchase_price)),
    escapeHtml(formatCurrency(d.totalAccumulatedDepreciation ?? d.total_accumulated_depreciation)),
    escapeHtml(formatCurrency(d.totalBookValue ?? d.total_book_value)),
    escapeHtml(d.depreciationRate != null ? `${(d.depreciationRate * 100).toFixed(1)}%` : '-'),
  ]);

  const typeRows = (summaryByType || []).map(t => [
    escapeHtml(t.assetType || t.asset_type || '-'),
    escapeHtml(t.assetCount ?? t.asset_count ?? '-'),
    escapeHtml(formatCurrency(t.totalPurchasePrice ?? t.total_purchase_price)),
    escapeHtml(formatCurrency(t.totalAccumulatedDepreciation ?? t.total_accumulated_depreciation)),
    escapeHtml(formatCurrency(t.totalBookValue ?? t.total_book_value)),
    escapeHtml(t.depreciationRate != null ? `${(t.depreciationRate * 100).toFixed(1)}%` : '-'),
  ]);

  const monthRows = (summaryByMonth || []).map(m => [
    escapeHtml(m.month || '-'),
    escapeHtml(formatCurrency(m.totalAccumulatedDepreciation ?? m.total_accumulated_depreciation)),
    escapeHtml(formatCurrency(m.totalBookValue ?? m.total_book_value)),
    escapeHtml(m.averageDepreciationRate != null ? `${(m.averageDepreciationRate * 100).toFixed(1)}%` : '-'),
  ]);

  const bodyHtml = `
    <div class="report-section">
      <h2>折旧概览</h2>
      ${renderStatGrid(cards)}
    </div>
    <div class="report-section">
      <h2>资产折旧明细</h2>
      ${renderTable(
        ['资产编号', '资产名称', '类型', '部门', '购置金额', '累计折旧', '账面净值', '折旧率', '已用月数', '剩余月数'],
        assetRows
      )}
    </div>
    ${deptRows.length > 0 ? `<div class="report-section"><h2>部门汇总</h2>${renderTable(['部门', '数量', '购置金额', '累计折旧', '账面净值', '折旧率'], deptRows)}</div>` : ''}
    ${typeRows.length > 0 ? `<div class="report-section"><h2>类型汇总</h2>${renderTable(['类型', '数量', '购置金额', '累计折旧', '账面净值', '折旧率'], typeRows)}</div>` : ''}
    ${monthRows.length > 0 ? `<div class="report-section"><h2>月度趋势</h2>${renderTable(['月份', '累计折旧', '账面净值', '折旧率'], monthRows)}</div>` : ''}
  `;

  printReport({
    title: '资产折旧报表',
    subtitle: '折旧明细与汇总分析',
    bodyHtml,
    meta: {
      period: options.period || '全部数据',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/* ==================== 盘点报表 ==================== */

/**
 * 打印盘点详情报表
 * @param {Object} inventory 盘点主单信息
 * @param {Array} details 盘点明细
 * @param {Object} statistics 统计信息
 * @param {Object} [options] { generatedBy }
 */
export const printInventoryReport = (inventory, details, statistics, options = {}) => {
  if (!inventory) return;

  const statusMap = {
    pending: '待盘点',
    in_progress: '盘点中',
    completed: '已完成',
    cancelled: '已取消',
  };
  const discrepancyMap = {
    none: '<span class="tag green">无差异</span>',
    missing: '<span class="tag red">盘亏</span>',
    extra: '<span class="tag blue">盘盈</span>',
    location_mismatch: '<span class="tag orange">位置不符</span>',
    status_mismatch: '<span class="tag orange">状态不符</span>',
  };

  const infoRows = [
    ['盘点单号', escapeHtml(inventory.inventory_no || '-')],
    ['盘点日期', escapeHtml(inventory.inventory_date ? formatDate(inventory.inventory_date, false) : '-')],
    ['盘点类型', escapeHtml(inventory.inventory_type || '-')],
    ['盘点人', escapeHtml(inventory.inventory_person || '-')],
    ['状态', escapeHtml(statusMap[inventory.status] || inventory.status || '-')],
    ['创建时间', escapeHtml(inventory.created_at ? formatDate(inventory.created_at) : '-')],
    ['备注', escapeHtml(inventory.remark || '-')],
  ];

  const statCards = statistics
    ? [
        { label: '总数量', value: statistics.total || 0 },
        { label: '正常', value: statistics.normalCount || 0, tone: 'success' },
        { label: '异常', value: statistics.abnormalCount || 0, tone: 'danger' },
        {
          label: '正常率',
          value: statistics.total
            ? `${(((statistics.normalCount || 0) / statistics.total) * 100).toFixed(1)}%`
            : '-',
        },
      ]
    : [];

  const detailRows = (details || []).map(d => [
    escapeHtml(d.asset_code || '-'),
    escapeHtml(d.asset_name || '-'),
    escapeHtml(d.expected_location || '-'),
    escapeHtml(d.actual_location || '-'),
    escapeHtml(d.expected_status || '-'),
    escapeHtml(d.actual_status || '-'),
    discrepancyMap[d.discrepancy_type] || escapeHtml(d.discrepancy_type || '-'),
    escapeHtml(d.discrepancy_desc || '-'),
  ]);

  const bodyHtml = `
    <div class="report-section">
      <h2>盘点信息</h2>
      ${renderTable(['项目', '内容'], infoRows)}
    </div>
    ${statistics ? `<div class="report-section"><h2>统计信息</h2>${renderStatGrid(statCards)}</div>` : ''}
    <div class="report-section">
      <h2>盘点明细</h2>
      ${renderTable(
        ['资产编号', '资产名称', '预期位置', '实际位置', '预期状态', '实际状态', '差异类型', '差异说明'],
        detailRows
      )}
    </div>
  `;

  printReport({
    title: '资产盘点报表',
    subtitle: `盘点单号: ${inventory.inventory_no || '-'}`,
    bodyHtml,
    meta: {
      period: '单次盘点',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/* ==================== 报废报表 ==================== */

/**
 * 打印报废申请报表
 * @param {Array} scraps 报废申请列表
 * @param {Object} [options] { period, generatedBy }
 */
export const printScrappingReport = (scraps, options = {}) => {
  const statusMap = {
    pending: '<span class="tag orange">待处理</span>',
    reviewing: '<span class="tag blue">鉴定中</span>',
    approved: '<span class="tag green">已批准</span>',
    rejected: '<span class="tag red">已拒绝</span>',
    processing: '<span class="tag blue">处理中</span>',
    completed: '<span class="tag gray">已完成</span>',
    cancelled: '<span class="tag gray">已取消</span>',
  };

  const rows = (scraps || []).map(s => [
    escapeHtml(s.asset_code || '-'),
    escapeHtml(s.asset_name || '-'),
    escapeHtml(s.asset_model || s.model || '-'),
    escapeHtml(s.applicant || '-'),
    escapeHtml(s.apply_date ? formatDate(s.apply_date, false) : '-'),
    escapeHtml(s.scrapping_reason || '-'),
    statusMap[s.current_status || s.status] || escapeHtml(s.current_status || s.status || '-'),
  ]);

  const bodyHtml = `
    <div class="report-section">
      <h2>报废申请明细</h2>
      ${renderTable(
        ['资产编号', '资产名称', '型号', '申请人', '申请日期', '报废原因', '状态'],
        rows
      )}
    </div>
  `;

  printReport({
    title: '资产报废报表',
    subtitle: `共 ${rows.length} 条报废申请`,
    bodyHtml,
    meta: {
      period: options.period || '全部数据',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/* ==================== 调配报表 ==================== */

/**
 * 打印调配记录报表
 * @param {Array} transfers 调配记录列表
 * @param {Object} [options] { period, generatedBy }
 */
export const printTransferReport = (transfers, options = {}) => {
  const statusMap = {
    pending: '<span class="tag orange">待审批</span>',
    approved: '<span class="tag green">已批准</span>',
    rejected: '<span class="tag red">已拒绝</span>',
    completed: '<span class="tag green">已完成</span>',
    cancelled: '<span class="tag gray">已取消</span>',
  };

  const rows = (transfers || []).map(t => [
    escapeHtml(t.transfer_no || '-'),
    escapeHtml(t.asset_code || '-'),
    escapeHtml(t.asset_name || '-'),
    escapeHtml(t.from_department || '-'),
    escapeHtml(t.to_department || '-'),
    escapeHtml(t.applicant || '-'),
    escapeHtml(t.transfer_date ? formatDate(t.transfer_date, false) : '-'),
    statusMap[t.status] || escapeHtml(t.status || '-'),
  ]);

  const bodyHtml = `
    <div class="report-section">
      <h2>调配记录明细</h2>
      ${renderTable(
        ['调配单号', '资产编号', '资产名称', '调出部门', '调入部门', '申请人', '调配日期', '状态'],
        rows
      )}
    </div>
  `;

  printReport({
    title: '资产调配报表',
    subtitle: `共 ${rows.length} 条调配记录`,
    bodyHtml,
    meta: {
      period: options.period || '全部数据',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/* ==================== 维修申请报表 ==================== */

/**
 * 打印维修申请报表
 * @param {Array} requests 维修申请列表
 * @param {Object} [options] { period, generatedBy }
 */
export const printMaintenanceRequestReport = (requests, options = {}) => {
  const statusMap = {
    pending: '<span class="tag orange">待处理</span>',
    pending_approval: '<span class="tag orange">待审批</span>',
    approved: '<span class="tag blue">已批准</span>',
    in_progress: '<span class="tag blue">维修中</span>',
    completed: '<span class="tag green">已完成</span>',
    rejected: '<span class="tag red">已拒绝</span>',
    cancelled: '<span class="tag gray">已取消</span>',
  };
  const faultLevelMap = {
    low: '<span class="tag gray">低</span>',
    medium: '<span class="tag blue">中</span>',
    high: '<span class="tag orange">高</span>',
    critical: '<span class="tag red">紧急</span>',
  };

  const rows = (requests || []).map(r => [
    escapeHtml(r.request_no || '-'),
    escapeHtml(r.asset_code || '-'),
    escapeHtml(r.asset_name || '-'),
    escapeHtml(r.fault_description || '-'),
    faultLevelMap[r.fault_level] || escapeHtml(r.fault_level || '-'),
    escapeHtml(r.request_person || '-'),
    escapeHtml(r.request_date ? formatDate(r.request_date, false) : '-'),
    statusMap[r.status] || escapeHtml(r.status || '-'),
  ]);

  const bodyHtml = `
    <div class="report-section">
      <h2>维修申请明细</h2>
      ${renderTable(
        ['申请单号', '资产编号', '资产名称', '故障描述', '故障等级', '申请人', '申请日期', '状态'],
        rows
      )}
    </div>
  `;

  printReport({
    title: '维修申请报表',
    subtitle: `共 ${rows.length} 条维修申请`,
    bodyHtml,
    meta: {
      period: options.period || '全部数据',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/* ==================== 维护成本报表 ==================== */

/**
 * 打印维护成本报表
 * @param {Array} costs 成本记录列表
 * @param {Object} summaryStats 统计 { totalCost, laborCost, materialCost, externalCost, otherCost }
 * @param {Object} [options] { period, generatedBy }
 */
export const printMaintenanceCostReport = (costs, summaryStats, options = {}) => {
  const costTypeMap = {
    labor: '人工费',
    material: '材料费',
    external: '外包费',
    other: '其他',
  };
  const formatCurrency = value =>
    value != null ? `¥${Number(value).toLocaleString()}` : '-';

  const cards = summaryStats
    ? [
        { label: '总成本', value: formatCurrency(summaryStats.totalCost), tone: 'danger' },
        { label: '人工费', value: formatCurrency(summaryStats.laborCost) },
        { label: '材料费', value: formatCurrency(summaryStats.materialCost) },
        { label: '外包费', value: formatCurrency(summaryStats.externalCost) },
        { label: '其他', value: formatCurrency(summaryStats.otherCost) },
      ]
    : [];

  const rows = (costs || []).map(c => [
    escapeHtml(c.asset_code || '-'),
    escapeHtml(c.asset_name || '-'),
    escapeHtml(costTypeMap[c.cost_type] || c.cost_type || '-'),
    escapeHtml(c.amount != null ? `¥${Number(c.amount).toLocaleString()}` : '-'),
    escapeHtml(c.cost_date ? formatDate(c.cost_date, false) : '-'),
    escapeHtml(c.department || '-'),
    escapeHtml(c.location || '-'),
    escapeHtml(c.description || '-'),
  ]);

  const bodyHtml = `
    ${summaryStats ? `<div class="report-section"><h2>成本概览</h2>${renderStatGrid(cards)}</div>` : ''}
    <div class="report-section">
      <h2>成本明细</h2>
      ${renderTable(
        ['资产编号', '资产名称', '成本类型', '金额', '日期', '部门', '位置', '描述'],
        rows
      )}
    </div>
  `;

  printReport({
    title: '维护成本报表',
    subtitle: '成本统计与明细',
    bodyHtml,
    meta: {
      period: options.period || '全部数据',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/* ==================== 预防性维护详情报表 ==================== */

/**
 * 打印预防性维护详情报表
 * @param {Object} detail 维护计划详情
 * @param {Array} history 维护历史
 * @param {Object} [templateInfo] 关联模板
 * @param {Object} [options] { generatedBy }
 */
export const printPreventiveMaintenanceDetailReport = (
  detail,
  history,
  templateInfo,
  options = {}
) => {
  if (!detail) return;

  const statusMap = {
    active: '启用',
    inactive: '停用',
    paused: '暂停',
    completed: '已完成',
  };
  const triggerTypeMap = {
    time: '按时间',
    usage: '按使用量',
    manual: '手动',
  };
  const maintTypeMap = {
    preventive: '预防性维护',
    routine: '日常维护',
    fault_repair: '故障维修',
  };

  const basicRows = [
    ['计划名称', escapeHtml(detail.plan_name || '-')],
    ['状态', escapeHtml(statusMap[detail.status] || detail.status || '-')],
    ['资产编号', escapeHtml(detail.asset_code || '-')],
    ['资产名称', escapeHtml(detail.asset_name || '-')],
    ['维护类型', escapeHtml(maintTypeMap[detail.maintenance_type] || detail.maintenance_type || '-')],
    ['触发类型', escapeHtml(triggerTypeMap[detail.trigger_type] || detail.trigger_type || '-')],
    ['维护周期', escapeHtml(detail.cycle_value && detail.cycle_type ? `${detail.cycle_value} ${detail.cycle_type}` : '-')],
    ['自动生成工单', escapeHtml(detail.auto_generate_workorder ? '是' : '否')],
    ['下次维护日期', escapeHtml(detail.next_maintenance_date ? formatDate(detail.next_maintenance_date, false) : '-')],
    ['上次维护日期', escapeHtml(detail.last_maintenance_date ? formatDate(detail.last_maintenance_date, false) : '-')],
    ['责任人', escapeHtml(detail.responsible_person || '-')],
    ['预计工时', escapeHtml(detail.estimated_hours ? `${detail.estimated_hours} 小时` : '-')],
    ['维护内容', escapeHtml(detail.maintenance_content || '-')],
    ['备注', escapeHtml(detail.remark || '-')],
  ];

  const templateRows = templateInfo
    ? [
        ['模板名称', escapeHtml(templateInfo.template_name || '-')],
        ['资产类型', escapeHtml(templateInfo.asset_type || '-')],
        ['品牌', escapeHtml(templateInfo.brand || '-')],
        ['型号', escapeHtml(templateInfo.model || '-')],
      ]
    : [];

  const historyRows = (history || []).map(h => [
    escapeHtml(h.maintenance_date ? formatDate(h.maintenance_date, false) : '-'),
    escapeHtml(h.maintenance_person || '-'),
    escapeHtml(h.actual_hours ? `${h.actual_hours} 小时` : '-'),
    escapeHtml(h.maintenance_result || '-'),
    escapeHtml(h.maintenance_cost != null ? `¥${Number(h.maintenance_cost).toLocaleString()}` : '-'),
    escapeHtml(h.remark || '-'),
  ]);

  const bodyHtml = `
    <div class="report-section">
      <h2>基本信息</h2>
      ${renderTable(['项目', '内容'], basicRows)}
    </div>
    ${templateRows.length > 0 ? `<div class="report-section"><h2>关联模板</h2>${renderTable(['项目', '内容'], templateRows)}</div>` : ''}
    <div class="report-section">
      <h2>维护历史</h2>
      ${renderTable(['维护日期', '维护人员', '实际工时', '维护结果', '维护费用', '备注'], historyRows)}
    </div>
  `;

  printReport({
    title: '预防性维护详情报表',
    subtitle: detail.plan_name || '-',
    bodyHtml,
    meta: {
      period: '单计划详情',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/* ==================== 维护日志详情报表 ==================== */

/**
 * 打印维护日志详情报表
 * @param {Object} log 维护日志详情
 * @param {Object} [options] { generatedBy }
 */
export const printMaintenanceLogDetailReport = (log, options = {}) => {
  if (!log) return;

  const statusMap = {
    pending: '待处理',
    in_progress: '处理中',
    completed: '已完成',
    cancelled: '已取消',
  };
  const maintTypeMap = {
    fault_repair: '故障维修',
    preventive: '预防性维护',
    routine: '日常维护',
    other: '其他',
  };
  const sourceTypeMap = {
    request: '维修申请',
    workorder: '工单',
    manual: '手动创建',
    plan: '维护计划',
  };

  const basicRows = [
    ['资产编号', escapeHtml(log.asset_code || '-')],
    ['资产名称', escapeHtml(log.asset_name || '-')],
    ['所属部门', escapeHtml(log.department || '-')],
    ['资产位置', escapeHtml(log.location || '-')],
    ['维护类型', escapeHtml(maintTypeMap[log.maintenance_type] || log.maintenance_type || '-')],
    ['维护日期', escapeHtml(log.maintenance_date ? formatDate(log.maintenance_date, false) : '-')],
    ['维护人员', escapeHtml(log.maintenance_person || '-')],
    ['状态', escapeHtml(statusMap[log.status] || log.status || '-')],
    ['维护内容', escapeHtml(log.maintenance_content || '-')],
  ];

  const sourceRows = [
    ['来源类型', escapeHtml(sourceTypeMap[log.source_type] || log.source_type || '-')],
    ['来源编号', escapeHtml(log.source_no || log.source_id || '-')],
    ['来源描述', escapeHtml(log.source_description || '-')],
  ];

  const costRows = [
    ['人工费用', escapeHtml(log.labor_cost != null ? `¥${Number(log.labor_cost).toFixed(2)}` : '-')],
    ['材料费用', escapeHtml(log.material_cost != null ? `¥${Number(log.material_cost).toFixed(2)}` : '-')],
    ['其他费用', escapeHtml(log.other_cost != null ? `¥${Number(log.other_cost).toFixed(2)}` : '-')],
    [
      '维护费用合计',
      `<strong style="color:#f5222d;">¥${(
        Number(log.labor_cost || 0) +
        Number(log.material_cost || 0) +
        Number(log.other_cost || 0)
      ).toFixed(2)}</strong>`,
    ],
    ['更换部件', escapeHtml(log.parts_replaced || '-')],
    ['供应商', escapeHtml(log.supplier_name || '-')],
  ];

  const detailRows = [
    ['维护时长', escapeHtml(log.maintenance_duration ? `${log.maintenance_duration} 小时` : '-')],
    ['维护地点', escapeHtml(log.maintenance_location || '-')],
    ['维护方式', escapeHtml(log.maintenance_method || '-')],
    ['保修信息', escapeHtml(log.warranty_info || '-')],
    ['下次维护日期', escapeHtml(log.next_maintenance_date ? formatDate(log.next_maintenance_date, false) : '-')],
    ['备注', escapeHtml(log.remark || '-')],
  ];

  const qcRows = [
    ['质检结果', escapeHtml(log.quality_check || '-')],
    ['质检人员', escapeHtml(log.quality_check_person || '-')],
    ['质检日期', escapeHtml(log.quality_check_date ? formatDate(log.quality_check_date, false) : '-')],
    ['质检评分', escapeHtml(log.quality_score ?? '-')],
    ['质检备注', escapeHtml(log.quality_remark || '-')],
  ];

  const bodyHtml = `
    <div class="report-section">
      <h2>基本信息</h2>
      ${renderTable(['项目', '内容'], basicRows)}
    </div>
    <div class="report-section">
      <h2>来源信息</h2>
      ${renderTable(['项目', '内容'], sourceRows)}
    </div>
    <div class="report-section">
      <h2>费用明细</h2>
      ${renderTable(['费用项', '金额'], costRows)}
    </div>
    <div class="report-section">
      <h2>详细信息</h2>
      ${renderTable(['项目', '内容'], detailRows)}
    </div>
    <div class="report-section">
      <h2>质量检查</h2>
      ${renderTable(['项目', '内容'], qcRows)}
    </div>
  `;

  printReport({
    title: '维护日志详情报表',
    subtitle: `${log.asset_name || ''} (${log.asset_code || '-'})`,
    bodyHtml,
    meta: {
      period: '单次维护',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/* ==================== 验收报表 ==================== */

/**
 * 打印验收详情报表
 * @param {Object} record 验收记录
 * @param {Array} checklist 检查清单
 * @param {Object} stats 统计 { passed, failed, unchecked, total }
 * @param {Object} [options] { generatedBy }
 */
export const printAcceptanceDetailReport = (record, checklist, stats, options = {}) => {
  if (!record) return;

  const statusMap = {
    pending: '待验收',
    in_progress: '验收中',
    passed: '合格',
    failed: '不合格',
    completed: '已完成',
  };

  const infoRows = [
    ['资产编号', escapeHtml(record.asset_code || '-')],
    ['资产名称', escapeHtml(record.asset_name || '-')],
    ['供应商', escapeHtml(record.supplier || '-')],
    ['验收日期', escapeHtml(record.acceptance_date ? formatDate(record.acceptance_date, false) : '-')],
    ['验收人', escapeHtml(record.acceptance_person || '-')],
    ['状态', escapeHtml(statusMap[record.status] || record.status || '-')],
    ['使用科室', escapeHtml(record.department || '-')],
    ['职能部门', escapeHtml(record.functional_department || '-')],
    ['创建人', escapeHtml(record.created_by || '-')],
    ['创建时间', escapeHtml(record.created_at ? formatDate(record.created_at) : '-')],
    ['备注', escapeHtml(record.remark || '-')],
  ];

  const statCards = stats
    ? [
        { label: '检查总数', value: stats.total || 0 },
        { label: '通过', value: stats.passed || 0, tone: 'success' },
        { label: '不通过', value: stats.failed || 0, tone: 'danger' },
        { label: '未检查', value: stats.unchecked || 0, tone: 'warning' },
      ]
    : [];

  const checklistRows = (checklist || []).map(c => [
    escapeHtml(c.category || '-'),
    escapeHtml(c.item_name || '-'),
    escapeHtml(c.item_description || '-'),
    c.is_passed === true
      ? '<span class="tag green">通过</span>'
      : c.is_passed === false
      ? '<span class="tag red">不通过</span>'
      : '<span class="tag gray">未检查</span>',
    escapeHtml(c.checked_by || '-'),
    escapeHtml(c.checked_at ? formatDate(c.checked_at, false) : '-'),
    escapeHtml(c.remark || '-'),
  ]);

  const bodyHtml = `
    <div class="report-section">
      <h2>基本信息</h2>
      ${renderTable(['项目', '内容'], infoRows)}
    </div>
    ${stats ? `<div class="report-section"><h2>验收统计</h2>${renderStatGrid(statCards)}</div>` : ''}
    <div class="report-section">
      <h2>检查清单</h2>
      ${renderTable(
        ['分类', '项目名', '描述', '结果', '检查人', '检查时间', '备注'],
        checklistRows
      )}
    </div>
  `;

  printReport({
    title: '设备验收报表',
    subtitle: `${record.asset_name || ''} (${record.asset_code || '-'})`,
    bodyHtml,
    meta: {
      period: '单次验收',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/**
 * 打印验收报告（含检查清单 / 小组成员 / 相关文件）
 * 数据来源于 GET /acceptance-management/reports/:id
 * @param {Object} reportData { record, checklist, files, team, summary }
 * @param {Object} [options] { generatedBy }
 */
export const printAcceptanceReport = (reportData, options = {}) => {
  const { record, checklist = [], files = [], team = [], summary } = reportData || {};
  if (!record) return;

  const statusMap = {
    待验收: '待验收',
    验收中: '验收中',
    已验收: '已验收',
    验收不合格: '验收不合格',
  };

  const infoRows = [
    ['资产编号', escapeHtml(record.asset_code || '-')],
    ['资产名称', escapeHtml(record.asset_name || '-')],
    ['供应商', escapeHtml(record.supplier || '-')],
    ['验收日期', escapeHtml(record.acceptance_date ? formatDate(record.acceptance_date, false) : '-')],
    ['验收人', escapeHtml(record.acceptance_person || '-')],
    ['状态', escapeHtml(statusMap[record.status] || record.status || '-')],
    ['使用科室', escapeHtml(record.department || '-')],
    ['职能部门', escapeHtml(record.functional_department || '-')],
    ['创建人', escapeHtml(record.created_by || '-')],
    ['创建时间', escapeHtml(record.created_at ? formatDate(record.created_at) : '-')],
    ['备注', escapeHtml(record.remark || '-')],
  ];

  const statCards = summary
    ? [
        { label: '检查项总数', value: summary.total || 0 },
        { label: '通过', value: summary.passed || 0, tone: 'success' },
        { label: '不通过', value: summary.failed || 0, tone: 'danger' },
        { label: '未检查', value: summary.unchecked || 0, tone: 'warning' },
        {
          label: '合格率',
          value: summary.passRate ? `${summary.passRate}%` : '-',
          tone: 'success',
        },
      ]
    : [];

  const checklistRows = checklist.map(c => [
    escapeHtml(c.category || '-'),
    escapeHtml(c.item_name || '-'),
    escapeHtml(c.item_description || '-'),
    c.is_passed === 1
      ? '<span class="tag green">通过</span>'
      : c.is_passed === 0
      ? '<span class="tag red">不通过</span>'
      : '<span class="tag gray">未检查</span>',
    escapeHtml(c.checked_by || '-'),
    escapeHtml(c.checked_at ? formatDate(c.checked_at, false) : '-'),
    escapeHtml(c.remark || '-'),
  ]);

  const teamRows = team.map(m => [
    escapeHtml(m.member_name || '-'),
    escapeHtml(m.role || '-'),
    escapeHtml(m.department || '-'),
    escapeHtml(m.assigned_at ? formatDate(m.assigned_at, false) : '-'),
  ]);

  const fileRows = files.map(f => [
    escapeHtml(f.file_name || '-'),
    escapeHtml(f.file_type || '-'),
    escapeHtml(f.file_size ? `${(f.file_size / 1024).toFixed(1)} KB` : '-'),
    escapeHtml(f.uploaded_at ? formatDate(f.uploaded_at, false) : '-'),
  ]);

  const bodyHtml = `
    <div class="report-section">
      <h2>基本信息</h2>
      ${renderTable(['项目', '内容'], infoRows)}
    </div>
    ${summary ? `<div class="report-section"><h2>验收统计</h2>${renderStatGrid(statCards)}</div>` : ''}
    <div class="report-section">
      <h2>检查清单</h2>
      ${renderTable(['分类', '项目名', '描述', '结果', '检查人', '检查时间', '备注'], checklistRows)}
    </div>
    ${teamRows.length > 0 ? `<div class="report-section"><h2>验收小组</h2>${renderTable(['姓名', '角色', '所属科室', '加入时间'], teamRows)}</div>` : ''}
    ${fileRows.length > 0 ? `<div class="report-section"><h2>相关文件</h2>${renderTable(['文件名', '类型', '大小', '上传时间'], fileRows)}</div>` : ''}
  `;

  printReport({
    title: '设备验收报告',
    subtitle: `${record.asset_name || ''} (${record.asset_code || '-'})`,
    bodyHtml,
    meta: {
      period: '单次验收',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/**
 * 打印验收统计报表
 * @param {Object} overview 概览统计
 * @param {Array} statusDistribution 状态分布
 * @param {Array} departmentDistribution 部门分布
 * @param {Array} trend 验收趋势
 * @param {Object} [options] { period, generatedBy }
 */
export const printAcceptanceStatisticsReport = (
  overview,
  statusDistribution,
  departmentDistribution,
  trend,
  options = {}
) => {
  const cards = [
    { label: '验收记录总数', value: overview?.totalRecords || overview?.total_records || 0 },
    { label: '验收申请总数', value: overview?.totalApplications || overview?.total_applications || 0 },
    {
      label: '合格率',
      value: overview?.passRate || overview?.pass_rate
        ? `${Number(overview.passRate || overview.pass_rate).toFixed(1)}%`
        : '-',
      tone: 'success',
    },
    { label: '模板数量', value: overview?.templateCount || overview?.template_count || 0 },
  ];

  const statusRows = (statusDistribution || []).map(s => [
    escapeHtml(s.status || '-'),
    escapeHtml(s.count || 0),
  ]);
  const deptRows = (departmentDistribution || []).map(d => [
    escapeHtml(d.department || '-'),
    escapeHtml(d.count || 0),
    escapeHtml(d.percent != null ? `${d.percent}%` : '-'),
  ]);
  const trendRows = (trend || []).map(t => [
    escapeHtml(t.month || '-'),
    escapeHtml(t.total || 0),
    escapeHtml(t.passed || 0),
    escapeHtml(t.failed || 0),
    escapeHtml(t.passRate != null ? `${t.passRate}%` : '-'),
  ]);

  const bodyHtml = `
    <div class="report-section">
      <h2>验收概览</h2>
      ${renderStatGrid(cards)}
    </div>
    ${statusRows.length > 0 ? `<div class="report-section"><h2>状态分布</h2>${renderTable(['状态', '数量'], statusRows)}</div>` : ''}
    ${deptRows.length > 0 ? `<div class="report-section"><h2>部门分布 TOP 10</h2>${renderTable(['科室', '数量', '占比'], deptRows)}</div>` : ''}
    ${trendRows.length > 0 ? `<div class="report-section"><h2>验收趋势</h2>${renderTable(['月份', '总数', '合格', '不合格', '合格率'], trendRows)}</div>` : ''}
  `;

  printReport({
    title: '验收统计报表',
    subtitle: '验收数据分析',
    bodyHtml,
    meta: {
      period: options.period || '全部数据',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/* ==================== 不良事件报表 ==================== */

/**
 * 打印不良事件统计报表
 * @param {Object} statistics 总体统计
 * @param {Object} efficiencyStats 处理时效
 * @param {Array} departmentStats 科室统计
 * @param {Array} assetStats 资产统计
 * @param {Object} [options] { period, generatedBy }
 */
export const printAdverseReactionReport = (
  statistics,
  efficiencyStats,
  departmentStats,
  assetStats,
  options = {}
) => {
  const cards = statistics
    ? [
        { label: '事件总数', value: statistics.total_count || 0 },
        { label: '严重事件', value: statistics.serious_count || 0, tone: 'danger' },
        { label: '待处理', value: statistics.pending_count || 0, tone: 'warning' },
        { label: '已处理', value: statistics.handled_count || 0, tone: 'success' },
      ]
    : [];

  const efficiencyRows = efficiencyStats
    ? [
        ['已处理总数', escapeHtml(efficiencyStats.total_handled || 0)],
        ['平均处理时长', escapeHtml(efficiencyStats.avg_handle_hours != null ? `${efficiencyStats.avg_handle_hours} 小时` : '-')],
        ['超时处理数', escapeHtml(efficiencyStats.overdue_count || 0)],
      ]
    : [];

  const deptRows = (departmentStats || []).map(d => [
    escapeHtml(d.department || '-'),
    escapeHtml(d.count || 0),
    escapeHtml(d.serious_count || 0),
    escapeHtml(d.pending_count || 0),
    escapeHtml(d.handled_count || 0),
  ]);

  const assetRows = (assetStats || []).map(a => [
    escapeHtml(a.asset_code || '-'),
    escapeHtml(a.asset_name || '-'),
    escapeHtml(a.count || 0),
    escapeHtml(a.serious_count || 0),
    escapeHtml(a.last_occurrence ? formatDate(a.last_occurrence, false) : '-'),
  ]);

  const bodyHtml = `
    ${statistics ? `<div class="report-section"><h2>总体统计</h2>${renderStatGrid(cards)}</div>` : ''}
    ${efficiencyRows.length > 0 ? `<div class="report-section"><h2>处理时效分析</h2>${renderTable(['项目', '数值'], efficiencyRows)}</div>` : ''}
    ${deptRows.length > 0 ? `<div class="report-section"><h2>科室统计 TOP 10</h2>${renderTable(['科室', '事件总数', '严重事件', '待处理', '已处理'], deptRows)}</div>` : ''}
    ${assetRows.length > 0 ? `<div class="report-section"><h2>问题资产 TOP 10</h2>${renderTable(['资产编号', '资产名称', '事件次数', '严重事件', '最近发生'], assetRows)}</div>` : ''}
  `;

  printReport({
    title: '不良事件统计报表',
    subtitle: '医疗不良事件分析',
    bodyHtml,
    meta: {
      period: options.period || '全部数据',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/* ==================== 质控报表 ==================== */

/**
 * 打印质控记录报表
 * @param {Array} records 质控记录列表
 * @param {Object} [options] { period, generatedBy }
 */
export const printQualityControlReport = (records, options = {}) => {
  const resultMap = {
    pass: '<span class="tag green">合格</span>',
    fail: '<span class="tag red">不合格</span>',
    pending: '<span class="tag orange">待检测</span>',
  };
  const statusMap = {
    draft: '<span class="tag gray">草稿</span>',
    submitted: '<span class="tag blue">已提交</span>',
    reviewed: '<span class="tag green">已审核</span>',
    archived: '<span class="tag gray">已归档</span>',
  };

  const rows = (records || []).map(r => [
    escapeHtml(r.record_no || '-'),
    escapeHtml(r.asset_code || '-'),
    escapeHtml(r.asset_name || '-'),
    escapeHtml(r.qc_type || '-'),
    escapeHtml(r.qc_date ? formatDate(r.qc_date, false) : '-'),
    escapeHtml(r.qc_item || '-'),
    resultMap[r.result] || escapeHtml(r.result || '-'),
    statusMap[r.status] || escapeHtml(r.status || '-'),
  ]);

  const bodyHtml = `
    <div class="report-section">
      <h2>质控记录明细</h2>
      ${renderTable(
        ['质控单号', '资产编号', '资产名称', '质控类型', '质控日期', '质控项目', '结果', '状态'],
        rows
      )}
    </div>
  `;

  printReport({
    title: '质控记录报表',
    subtitle: `共 ${rows.length} 条质控记录`,
    bodyHtml,
    meta: {
      period: options.period || '全部数据',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

/* ==================== 维护效率报表 ==================== */

/**
 * 打印维护效率仪表盘报表
 * @param {Object} overviewData 概览数据
 * @param {Object} costAnalysisData 成本分析
 * @param {Array} costTrendData 成本分布
 * @param {Array} technicianData 技术人员效率
 * @param {Array} assetFrequencyData 资产维护频率
 * @param {Object} [options] { period, generatedBy }
 */
export const printMaintenanceEfficiencyReport = (
  overviewData,
  costAnalysisData,
  costTrendData,
  technicianData,
  assetFrequencyData,
  options = {}
) => {
  const formatCurrency = value =>
    value != null ? `¥${Number(value).toLocaleString()}` : '-';

  const cards = overviewData
    ? [
        { label: '工单总数', value: overviewData.total_maintenance || 0 },
        {
          label: '平均完成时间',
          value: overviewData.avg_maintenance_time
            ? `${overviewData.avg_maintenance_time} 小时`
            : '-',
        },
        {
          label: '完成率',
          value: overviewData.completion_rate
            ? `${overviewData.completion_rate}%`
            : '-',
          tone: 'success',
        },
        { label: '逾期工单', value: overviewData.overdue_count || 0, tone: 'danger' },
        {
          label: '总维护费用',
          value: formatCurrency(overviewData.total_cost),
          tone: 'warning',
        },
        {
          label: '平均响应时间',
          value: overviewData.avg_response_time
            ? `${overviewData.avg_response_time} 小时`
            : '-',
        },
      ]
    : [];

  const costCards = costAnalysisData
    ? [
        { label: '总成本', value: formatCurrency(costAnalysisData.total_cost), tone: 'danger' },
        { label: '平均成本', value: formatCurrency(costAnalysisData.avg_cost) },
      ]
    : [];

  const costRows = (costTrendData || []).map(c => [
    escapeHtml(c.maintenance_type || '-'),
    escapeHtml(c.count || 0),
    escapeHtml(formatCurrency(c.total_cost)),
    escapeHtml(formatCurrency(c.avg_cost)),
  ]);

  const techRows = (technicianData || []).map(t => [
    escapeHtml(t.technician || '-'),
    escapeHtml(t.maintenance_count || 0),
    escapeHtml(t.completed_count || 0),
    escapeHtml(t.completion_rate != null ? `${t.completion_rate}%` : '-'),
    escapeHtml(t.avg_maintenance_time != null ? `${t.avg_maintenance_time} 小时` : '-'),
    escapeHtml(formatCurrency(t.total_cost)),
  ]);

  const assetRows = (assetFrequencyData || []).map(a => [
    escapeHtml(a.asset_name || '-'),
    escapeHtml(a.asset_code || '-'),
    escapeHtml(a.maintenance_count || 0),
    escapeHtml(a.avg_maintenance_time != null ? `${a.avg_maintenance_time} 小时` : '-'),
    escapeHtml(formatCurrency(a.total_cost)),
  ]);

  const bodyHtml = `
    ${overviewData ? `<div class="report-section"><h2>维护概览</h2>${renderStatGrid(cards)}</div>` : ''}
    ${costAnalysisData ? `<div class="report-section"><h2>成本分析</h2>${renderStatGrid(costCards)}</div>` : ''}
    ${costRows.length > 0 ? `<div class="report-section"><h2>成本分布（按维护类型）</h2>${renderTable(['维护类型', '次数', '总成本', '平均成本'], costRows)}</div>` : ''}
    ${techRows.length > 0 ? `<div class="report-section"><h2>技术人员效率排名</h2>${renderTable(['技术人员', '维护次数', '完成次数', '完成率', '平均时间', '总成本'], techRows)}</div>` : ''}
    ${assetRows.length > 0 ? `<div class="report-section"><h2>资产维护频率 Top 10</h2>${renderTable(['资产名称', '资产编号', '维护次数', '平均时间', '总成本'], assetRows)}</div>` : ''}
  `;

  printReport({
    title: '维护效率分析报表',
    subtitle: '维护效率与成本分析',
    bodyHtml,
    meta: {
      period: options.period || '全部数据',
      generatedBy: options.generatedBy || '系统',
    },
  });
};

export default {
  printReport,
  printStatisticsReport,
  printMaintenanceReport,
  printWorkOrderReport,
  printWorkOrderDetailReport,
  printAssetListReport,
  printAssetDetailReport,
  printDepreciationReport,
  printInventoryReport,
  printScrappingReport,
  printTransferReport,
  printMaintenanceRequestReport,
  printMaintenanceCostReport,
  printPreventiveMaintenanceDetailReport,
  printMaintenanceLogDetailReport,
  printAcceptanceDetailReport,
  printAcceptanceReport,
  printAcceptanceStatisticsReport,
  printAdverseReactionReport,
  printQualityControlReport,
  printMaintenanceEfficiencyReport,
};
