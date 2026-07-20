/**
 * 资产状态监控平台 Dashboard
 * 面向大屏幕（1920x1080+）的全屏数据展示页面
 * 自动刷新、暗色科技感设计
 *
 * 注意：recharts ResponsiveContainer 必须使用固定像素高度
 * 不能用百分比高度，否则在 flex 布局初始渲染时会崩溃
 */
import React, { useState, useEffect, useCallback, useMemo, useRef, Component } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ComposedChart,
  Line,
} from 'recharts';
import { assetAPI, sparePartsAPI, monitoringMaintenanceAPI, metrologyAPI } from '../utils/api';
import './AssetStatusDashboard.css';

/* ============ 错误边界 ============ */
class DashboardErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('大屏 Dashboard 错误:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="asset-dashboard-loading" style={{ flexDirection: 'column', gap: 16 }}>
          <div style={{ color: '#f87171', fontSize: 20 }}>⚠️ 页面加载异常</div>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>请刷新重试，或检查控制台错误日志</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '8px 24px', borderRadius: 8,
              background: '#3884ff', color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: 14,
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ============ 工具函数 ============ */

/** 格式化金额（自动亿/万/元） */
const formatCurrency = (val) => {
  const n = Number(val) || 0;
  if (n >= 100000000) return { value: (n / 100000000).toFixed(2), unit: '亿元' };
  if (n >= 10000) return { value: (n / 10000).toFixed(2), unit: '万元' };
  return { value: n.toLocaleString(), unit: '元' };
};

/** 格式化短金额（用于图表轴标签） */
const formatShortCurrency = (val) => {
  const n = Number(val) || 0;
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`;
  return n.toLocaleString();
};

/* ============ 颜色常量 ============ */

const STATUS_COLORS = {
  '在用': '#4ade80',
  '闲置': '#facc15',
  '维修': '#fb923c',
  '报废': '#f87171',
  '调配中': '#60a5fa',
};

const CATEGORY_COLORS = [
  '#3884ff', '#22c55e', '#facc15', '#f97316', '#a855f7',
  '#06b6d4', '#ec4899', '#14b8a6', '#8b5cf6', '#f43f5e',
];

/* ============ 主组件 ============ */

const AssetStatusDashboard = () => {
  /* ---------- 状态 ---------- */
  const [data, setData] = useState(null);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [spareParts, setSpareParts] = useState(null);
  const [maintenanceReminders, setMaintenanceReminders] = useState([]);
  const [engineerStats, setEngineerStats] = useState([]);
  const [metrologyExpiring, setMetrologyExpiring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());
  const [todayAdded, setTodayAdded] = useState(0);
  const refreshTimer = useRef(null);
  const mounted = useRef(true);

  /* ---------- 数据加载 ---------- */
  const loadData = useCallback(async () => {
    try {
      const [
        statsRes, deptRes, dashRes, warrantyRes,
        spareRes, reminderRes, engineerRes, metrologyRes,
      ] = await Promise.allSettled([
        assetAPI.getStatistics({}),
        assetAPI.getDepartmentStatistics({}),
        assetAPI.getDashboardData(),
        assetAPI.getExpiringWarranties({ days: 90 }),
        sparePartsAPI.getStatistics({}),
        monitoringMaintenanceAPI.getReminders({ status: '未处理', pageSize: 20 }),
        monitoringMaintenanceAPI.getEngineerStats({ limit: 8 }),
        metrologyAPI.getExpiring({ days: 30 }),
      ]);

      if (!mounted.current) return;

      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        setData(statsRes.value.data);
      }
      if (deptRes.status === 'fulfilled' && deptRes.value?.success) {
        setDepartmentStats(deptRes.value.data || []);
      }
      if (dashRes.status === 'fulfilled' && dashRes.value?.success) {
        setTodayAdded(
          dashRes.value.data?.realtime?.today_added ||
          dashRes.value.data?.overview?.today_added ||
          0
        );
      }
      if (warrantyRes.status === 'fulfilled' && warrantyRes.value?.success) {
        setWarranties(warrantyRes.value.data || []);
      }
      if (spareRes.status === 'fulfilled' && spareRes.value?.success) {
        setSpareParts(spareRes.value.data || null);
      }
      if (reminderRes.status === 'fulfilled' && reminderRes.value?.success) {
        setMaintenanceReminders(reminderRes.value.data || []);
      }
      if (engineerRes.status === 'fulfilled' && engineerRes.value?.success) {
        setEngineerStats(engineerRes.value.data || []);
      }
      if (metrologyRes.status === 'fulfilled' && metrologyRes.value?.success) {
        setMetrologyExpiring(metrologyRes.value.data || []);
      }
    } catch (err) {
      console.error('加载大屏数据失败:', err);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  /* ---------- 时钟 ---------- */
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* ---------- 自动刷新 ---------- */
  useEffect(() => {
    mounted.current = true;
    loadData();
    refreshTimer.current = setInterval(loadData, 60 * 1000);
    return () => {
      mounted.current = false;
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [loadData]);

  /* ---------- 衍生数据 ---------- */
  const overview = data?.overview || {};
  const totalAssets = overview.total_count || 0;
  const totalValue = overview.total_value || data?.value_summary?.total_purchase_value || 0;
  const inUse = overview.in_use_count || 0;
  const idle = overview.idle_count || 0;
  const repair = overview.repair_count || 0;
  const scrap = overview.scrap_count || 0;
  const transfer = overview.transfer_count || 0;

  const totalValueFormatted = useMemo(() => formatCurrency(totalValue), [totalValue]);

  /* 生命支持设备完好率 */
  const lifeSupportGoodRate = overview.life_support_good_rate;
  const lifeSupportTotal = overview.life_support_total || 0;

  /* 备件统计 */
  const sparePartsQuantity = spareParts?.total_quantity || 0;
  const sparePartsValue = spareParts?.total_value || 0;
  const sparePartsLowStock = spareParts?.low_stock_count || 0;

  /* 工程师工作统计（按维修人分组） */
  const engineerChartData = useMemo(() => {
    return (engineerStats || []).slice(0, 8).map(e => ({
      name: e.technician || '未知',
      total: Number(e.maintenance_count) || 0,
      completed: Number(e.completed_count) || 0,
      rate: Number(e.completion_rate) || 0,
    }));
  }, [engineerStats]);

  /* 状态分布饼图数据 */
  const statusPieData = useMemo(() => {
    if (!data || (!data?.by_status && !inUse && !idle && !repair && !scrap && !transfer)) {
      return [];
    }
    const raw = data?.by_status || [];
    if (raw.length > 0) {
      const total = raw.reduce((s, r) => s + Number(r.count || r.cnt || 0), 0) || 1;
      return raw.map(r => ({
        name: r.status,
        value: Number(r.count || r.cnt || 0),
        percent: ((Number(r.count || r.cnt || 0)) / total),
        fill: STATUS_COLORS[r.status] || '#64748b',
      }));
    }
    const items = [
      { name: '在用', value: inUse, fill: STATUS_COLORS['在用'] },
      { name: '闲置', value: idle, fill: STATUS_COLORS['闲置'] },
      { name: '维修', value: repair, fill: STATUS_COLORS['维修'] },
      { name: '报废', value: scrap, fill: STATUS_COLORS['报废'] },
      { name: '调配中', value: transfer, fill: STATUS_COLORS['调配中'] },
    ];
    const total = items.reduce((s, i) => s + i.value, 0) || 1;
    return items.map(i => ({ ...i, percent: i.value / total }));
  }, [data, inUse, idle, repair, scrap, transfer]);

  /* 分类数据 */
  const categoryData = useMemo(() => {
    const raw = data?.by_category || data?.byType || [];
    return raw.slice(0, 10).map((r, i) => ({
      name: r.category || r.name || `分类${i + 1}`,
      value: Number(r.count || r.cnt || 0),
      fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
  }, [data]);

  /* 月度趋势 */
  const monthlyTrend = useMemo(() => {
    const raw = data?.monthly_trend || [];
    return raw.map(r => ({
      month: (r.month || '').slice(5),
      label: (r.month || '').slice(5),
      count: Number(r.count || 0),
      value: Number(r.total_value || 0),
    }));
  }, [data]);

  /* 部门数据（取前8） */
  const topDepartments = useMemo(() => {
    if (!departmentStats?.length) return [];
    const sorted = [...departmentStats]
      .sort((a, b) => (Number(b.asset_count) || 0) - (Number(a.asset_count) || 0));
    const maxCount = Math.max(...sorted.map(d => Number(d.asset_count) || 0), 1);
    return sorted.slice(0, 8).map(d => ({
      name: d.department_name || d.department || '未知部门',
      count: Number(d.asset_count) || 0,
      value: Number(d.total_purchase_value) || 0,
      pct: ((Number(d.asset_count) || 0) / maxCount) * 100,
    }));
  }, [departmentStats]);

  /* ---------- 格式化函数 ---------- */
  const formatTimeStr = (d) =>
    d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const formatDateStr = (d) =>
    d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' });

  const closeDashboard = () => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    window.location.href = '/dashboard';
  };

  /* ---------- 渲染 ---------- */

  if (loading && !data) {
    return (
      <div className="asset-dashboard-loading">
        <div className="asset-dashboard-loading-spinner" />
        <div style={{ marginTop: 16, color: '#94a3b8', fontSize: 14 }}>正在加载资产数据...</div>
      </div>
    );
  }

  return (
    <DashboardErrorBoundary>
      <div className="asset-dashboard-container">
        {/* 关闭按钮 */}
        <button className="asset-dashboard-close" onClick={closeDashboard} title="退出全屏">
          ✕
        </button>

        {/* ========== Header ========== */}
        <header className="asset-dashboard-header">
          <div className="asset-dashboard-logo-area">
            <div className="asset-dashboard-logo-icon">◆</div>
            <div>
              <span className="asset-dashboard-title">资产状态监控平台</span>
              <span className="asset-dashboard-title-sub">ASSET DASHBOARD</span>
            </div>
          </div>

          <div className="asset-dashboard-header-right">
            <div className="asset-dashboard-header-status">
              <span className="asset-dashboard-status-dot" />
              <span>系统运行中</span>
            </div>
            <div className="asset-dashboard-clock">
              <div className="asset-dashboard-clock-time">{formatTimeStr(time)}</div>
              <div className="asset-dashboard-clock-date">{formatDateStr(time)}</div>
            </div>
          </div>
        </header>

        {/* ========== Body ========== */}
        <div className="asset-dashboard-body">
          {/* --- KPI 指标行 --- */}
          <div className="asset-dashboard-kpi-row">
            <div className="asset-dashboard-kpi-card">
              <div className="asset-dashboard-kpi-label">📦 资产总数</div>
              <div className="asset-dashboard-kpi-value">{totalAssets.toLocaleString()}</div>
              <div className="asset-dashboard-kpi-sub">台 / 件设备</div>
            </div>
            <div className="asset-dashboard-kpi-card">
              <div className="asset-dashboard-kpi-label">✅ 在用资产</div>
              <div className="asset-dashboard-kpi-value">{inUse.toLocaleString()}</div>
              <div className="asset-dashboard-kpi-sub">
                占比 {totalAssets > 0 ? ((inUse / totalAssets) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="asset-dashboard-kpi-card">
              <div className="asset-dashboard-kpi-label">📦 闲置资产</div>
              <div className="asset-dashboard-kpi-value">{idle.toLocaleString()}</div>
              <div className="asset-dashboard-kpi-sub">
                占比 {totalAssets > 0 ? ((idle / totalAssets) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="asset-dashboard-kpi-card">
              <div className="asset-dashboard-kpi-label">🔧 维修中</div>
              <div className="asset-dashboard-kpi-value">{repair.toLocaleString()}</div>
              <div className="asset-dashboard-kpi-sub">
                占比 {totalAssets > 0 ? ((repair / totalAssets) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="asset-dashboard-kpi-card">
              <div className="asset-dashboard-kpi-label">🗑️ 已报废</div>
              <div className="asset-dashboard-kpi-value">{scrap.toLocaleString()}</div>
              <div className="asset-dashboard-kpi-sub">
                占比 {totalAssets > 0 ? ((scrap / totalAssets) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="asset-dashboard-kpi-card">
              <div className="asset-dashboard-kpi-label">💰 资产原值总额</div>
              <div className="asset-dashboard-kpi-value">{totalValueFormatted.value}</div>
              <div className="asset-dashboard-kpi-sub">{totalValueFormatted.unit}</div>
            </div>
            <div className="asset-dashboard-kpi-card">
              <div className="asset-dashboard-kpi-label">🧰 备件数量</div>
              <div className="asset-dashboard-kpi-value">{sparePartsQuantity.toLocaleString()}</div>
              <div className="asset-dashboard-kpi-sub">
                低库存 {sparePartsLowStock.toLocaleString()} 种
              </div>
            </div>
            <div className="asset-dashboard-kpi-card">
              <div className="asset-dashboard-kpi-label">❤️ 生命支持完好率</div>
              <div className="asset-dashboard-kpi-value">
                {lifeSupportGoodRate != null ? `${lifeSupportGoodRate}%` : '—'}
              </div>
              <div className="asset-dashboard-kpi-sub">
                共 {lifeSupportTotal.toLocaleString()} 台
              </div>
            </div>
          </div>

          {/* --- 图表行 --- */}
          <div className="asset-dashboard-charts-row">
            {/* 状态分布 - 饼图 */}
            <div className="asset-dashboard-chart-card">
              <div className="asset-dashboard-chart-header">
                <div className="asset-dashboard-chart-title">
                  <span className="asset-dashboard-chart-title-icon blue">◉</span>
                  资产状态分布
                </div>
              </div>
              <div className="asset-dashboard-chart-body" style={{ height: 220 }}>
                {statusPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220} debounce={100}>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%" cy="50%"
                        innerRadius={50} outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {statusPieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} stroke="rgba(6,14,26,0.6)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [`${value} 台`, name]}
                        contentStyle={{
                          background: 'rgba(10,20,40,0.92)',
                          border: '1px solid rgba(56,132,255,0.3)',
                          borderRadius: 8, fontSize: 12,
                        }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle" iconSize={8}
                        wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="dashboard-empty">暂无数据</div>
                )}
              </div>
            </div>

            {/* 月度新增趋势 */}
            <div className="asset-dashboard-chart-card">
              <div className="asset-dashboard-chart-header">
                <div className="asset-dashboard-chart-title">
                  <span className="asset-dashboard-chart-title-icon green">◉</span>
                  月度新增趋势
                </div>
              </div>
              <div className="asset-dashboard-chart-body" style={{ height: 220 }}>
                {monthlyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220} debounce={100}>
                    <ComposedChart data={monthlyTrend} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3884ff" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#3884ff" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,132,255,0.08)" />
                      <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis
                        yAxisId="left"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        axisLine={false} tickLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        yAxisId="right" orientation="right"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        axisLine={false} tickLine={false}
                        tickFormatter={formatShortCurrency}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(10,20,40,0.92)',
                          border: '1px solid rgba(56,132,255,0.3)',
                          borderRadius: 8, fontSize: 12,
                        }}
                        labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
                      />
                      <Legend
                        verticalAlign="top" iconType="rect" iconSize={10}
                        wrapperStyle={{ fontSize: 11, paddingBottom: 4 }}
                      />
                      <Bar yAxisId="left" name="新增数量" dataKey="count" fill="url(#barGrad)" radius={[4, 4, 0, 0]} barSize={18} />
                      <Line
                        yAxisId="right" name="新增价值" type="monotone" dataKey="value"
                        stroke="#facc15" strokeWidth={2}
                        dot={{ r: 3, fill: '#facc15' }}
                        activeDot={{ r: 5, fill: '#facc15', strokeWidth: 2 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="dashboard-empty">暂无趋势数据</div>
                )}
              </div>
            </div>

            {/* 资产分类排行 */}
            <div className="asset-dashboard-chart-card">
              <div className="asset-dashboard-chart-header">
                <div className="asset-dashboard-chart-title">
                  <span className="asset-dashboard-chart-title-icon purple">◉</span>
                  资产分类排行
                </div>
              </div>
              <div className="asset-dashboard-chart-body" style={{ height: 220 }}>
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220} debounce={100}>
                    <BarChart
                      data={categoryData}
                      layout="vertical"
                      margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,132,255,0.08)" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        axisLine={false} tickLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category" dataKey="name"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={false} tickLine={false}
                        width={70}
                      />
                      <Tooltip
                        formatter={(val) => [`${val} 台`, '数量']}
                        contentStyle={{
                          background: 'rgba(10,20,40,0.92)',
                          border: '1px solid rgba(56,132,255,0.3)',
                          borderRadius: 8, fontSize: 12,
                        }}
                        labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                        {categoryData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="dashboard-empty">暂无分类数据</div>
                )}
              </div>
            </div>
          </div>

          {/* --- 底部行 1：分布与概览 --- */}
          <div className="asset-dashboard-bottom-row">
            {/* 部门资产统计 */}
            <div className="asset-dashboard-bottom-card">
              <div className="asset-dashboard-bottom-header">
                <div className="asset-dashboard-bottom-title">
                  <span className="chart-icon" style={{ color: '#22d3ee' }}>◉</span>
                  部门资产排行
                </div>
              </div>
              <div className="asset-dashboard-bottom-body">
                <div className="dept-list-scroll">
                  {topDepartments.length > 0 ? topDepartments.map((d, i) => (
                    <div className="dept-item" key={i}>
                      <span className="dept-item-name" title={d.name}>{d.name}</span>
                      <div className="dept-item-bar-wrap">
                        <div
                          className="dept-item-bar"
                          style={{
                            width: `${d.pct}%`,
                            background: `linear-gradient(90deg, ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}, ${CATEGORY_COLORS[(i + 2) % CATEGORY_COLORS.length]})`,
                          }}
                        />
                      </div>
                      <span className="dept-item-count">{d.count.toLocaleString()}</span>
                      <span className="dept-item-value">
                        {d.value >= 10000 ? `${(d.value / 10000).toFixed(1)}万` : d.value.toLocaleString()}
                      </span>
                    </div>
                  )) : (
                    <div className="dashboard-empty">暂无部门数据</div>
                  )}
                </div>
              </div>
            </div>

            {/* 工程师工作统计 */}
            <div className="asset-dashboard-bottom-card">
              <div className="asset-dashboard-bottom-header">
                <div className="asset-dashboard-bottom-title">
                  <span className="chart-icon" style={{ color: '#a855f7' }}>◉</span>
                  工程师工作统计
                </div>
                <div className="asset-dashboard-bottom-sub">近 {engineerChartData.length} 名维修人</div>
              </div>
              <div className="asset-dashboard-bottom-body">
                {engineerChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={120} debounce={100}>
                    <BarChart
                      data={engineerChartData}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,132,255,0.08)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                      <Tooltip
                        formatter={(val, name) => [val, name === 'total' ? '维修数' : '完成数']}
                        contentStyle={{ background: 'rgba(10,20,40,0.92)', border: '1px solid rgba(56,132,255,0.3)', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
                      />
                      <Bar dataKey="total" name="维修数" fill="#fb923c" radius={[0, 4, 4, 0]} barSize={10} />
                      <Bar dataKey="completed" name="完成数" fill="#4ade80" radius={[0, 4, 4, 0]} barSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="dashboard-empty">暂无维修记录</div>
                )}
              </div>
            </div>

            {/* 维护工单统计 */}
            <div className="asset-dashboard-bottom-card">
              <div className="asset-dashboard-bottom-header">
                <div className="asset-dashboard-bottom-title">
                  <span className="chart-icon" style={{ color: '#fb923c' }}>◉</span>
                  维护工单概览
                </div>
              </div>
              <div className="asset-dashboard-bottom-body">
                <div className="maint-grid">
                  <div className="maint-stat-item">
                    <div className="maint-stat-value">{repair.toLocaleString()}</div>
                    <div className="maint-stat-label">待维修</div>
                  </div>
                  <div className="maint-stat-item">
                    <div className="maint-stat-value">{todayAdded.toLocaleString()}</div>
                    <div className="maint-stat-label">今日新增</div>
                  </div>
                  <div className="maint-stat-item">
                    <div className="maint-stat-value">{inUse.toLocaleString()}</div>
                    <div className="maint-stat-label">在用资产</div>
                  </div>
                  <div className="maint-stat-item">
                    <div className="maint-stat-value">
                      {totalAssets > 0 ? `${((repair / totalAssets) * 100).toFixed(1)}%` : '0%'}
                    </div>
                    <div className="maint-stat-label">故障率</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* --- 底部行 2：提醒事项 --- */}
          <div className="asset-dashboard-bottom-row">
            {/* 维修提醒 */}
            <div className="asset-dashboard-bottom-card">
              <div className="asset-dashboard-bottom-header">
                <div className="asset-dashboard-bottom-title">
                  <span className="chart-icon" style={{ color: '#fb923c' }}>◉</span>
                  维修提醒
                </div>
                <div className="asset-dashboard-bottom-sub">
                  {maintenanceReminders.length > 0 ? `未处理 ${maintenanceReminders.length}` : '全部已处理'}
                </div>
              </div>
              <div className="asset-dashboard-bottom-body">
                {maintenanceReminders.length > 0 ? (
                  <div className="warranty-list-scroll">
                    {maintenanceReminders.slice(0, 6).map((r, i) => {
                      const endDate = r.next_maintenance_date || r.reminder_date;
                      const daysLeft = endDate
                        ? Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))
                        : 99;
                      const badgeClass = daysLeft <= 0 ? 'urgent' : daysLeft <= 7 ? 'warning' : 'normal';
                      return (
                        <div className="warranty-item" key={i}>
                          <span className="warranty-item-name" title={r.asset_name}>
                            {r.asset_code || ''} {r.asset_name || ''}
                          </span>
                          <span className="warranty-item-date">{endDate || '—'}</span>
                          <span className={`warranty-day-badge ${badgeClass}`}>
                            {daysLeft > 0 ? `${daysLeft}天` : '已逾期'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="warranty-empty">暂无维修提醒 ✓</div>
                )}
              </div>
            </div>

            {/* 检测提醒（计量/校准到期） */}
            <div className="asset-dashboard-bottom-card">
              <div className="asset-dashboard-bottom-header">
                <div className="asset-dashboard-bottom-title">
                  <span className="chart-icon" style={{ color: '#3884ff' }}>◉</span>
                  检测提醒
                </div>
                <div className="asset-dashboard-bottom-sub">
                  {metrologyExpiring.length > 0 ? `${metrologyExpiring.length} 项待检` : '无待检'}
                </div>
              </div>
              <div className="asset-dashboard-bottom-body">
                {metrologyExpiring.length > 0 ? (
                  <div className="warranty-list-scroll">
                    {metrologyExpiring.slice(0, 6).map((m, i) => {
                      const endDate = m.next_metrology_date;
                      const daysLeft = endDate
                        ? Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))
                        : 99;
                      const badgeClass = daysLeft <= 0 ? 'urgent' : daysLeft <= 7 ? 'warning' : 'normal';
                      return (
                        <div className="warranty-item" key={i}>
                          <span className="warranty-item-name" title={m.asset_name}>
                            {m.asset_code || ''} {m.asset_name || ''}
                          </span>
                          <span className="warranty-item-date">{endDate || '—'}</span>
                          <span className={`warranty-day-badge ${badgeClass}`}>
                            {daysLeft > 0 ? `${daysLeft}天` : '已逾期'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="warranty-empty">暂无检测提醒 ✓</div>
                )}
              </div>
            </div>

            {/* 保修到期提醒 */}
            <div className="asset-dashboard-bottom-card">
              <div className="asset-dashboard-bottom-header">
                <div className="asset-dashboard-bottom-title">
                  <span className="chart-icon" style={{ color: '#4ade80' }}>◉</span>
                  保修到期提醒
                </div>
              </div>
              <div className="asset-dashboard-bottom-body">
                {warranties.length > 0 ? (
                  <div className="warranty-list-scroll">
                    {warranties.slice(0, 6).map((w, i) => {
                      const endDate = w.warranty_end_date || w.warranty_expiry_date;
                      const daysLeft = endDate
                        ? Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))
                        : 99;
                      const badgeClass = daysLeft <= 7 ? 'urgent' : daysLeft <= 30 ? 'warning' : 'normal';
                      return (
                        <div className="warranty-item" key={i}>
                          <span className="warranty-item-name" title={w.asset_name}>
                            {w.asset_code || ''} {w.asset_name || ''}
                          </span>
                          <span className="warranty-item-date">{endDate || '—'}</span>
                          <span className={`warranty-day-badge ${badgeClass}`}>
                            {daysLeft > 0 ? `${daysLeft}天` : '已过期'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="warranty-empty">暂无到期提醒 ✓</div>
                )}
              </div>
            </div>
          </div>

          {/* --- Footer --- */}
          <div className="asset-dashboard-footer">
            <span className="asset-dashboard-footer-line" />
            <span className="asset-dashboard-footer-text">AssetHub · 资产管理系统</span>
            <span className="asset-dashboard-footer-line" />
          </div>
        </div>
      </div>
    </DashboardErrorBoundary>
  );
};

export default AssetStatusDashboard;
