/**
 * Dashboard - 月度趋势组件
 * 使用 recharts 展示最近12个月资产新增数量与价值趋势
 */
import React, { useMemo } from 'react';
import { Card } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const formatValue = (value) => {
  if (!value) return '0';
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}亿`;
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  return value;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: 'rgba(31, 59, 100, 0.95)',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: 8,
      fontSize: 12,
      lineHeight: 1.6,
      boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((entry, idx) => (
        <div key={idx}>
          <span style={{ color: entry.color, marginRight: 6 }}>●</span>
          {entry.name}：{entry.name.includes('价值') ? `${formatValue(entry.value)}元` : `${entry.value} 台`}
        </div>
      ))}
    </div>
  );
};

const DashboardMonthlyTrend = ({ monthlyData, loading }) => {
  const chartData = useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return [];
    return monthlyData.map(item => ({
      month: item.month || '',
      label: (item.month || '').slice(2),
      count: item.count || 0,
      value: item.total_value || 0,
    }));
  }, [monthlyData]);

  const totals = useMemo(() => {
    if (!chartData.length) return { count: 0, value: 0 };
    return chartData.reduce((acc, item) => ({
      count: acc.count + item.count,
      value: acc.value + item.value,
    }), { count: 0, value: 0 });
  }, [chartData]);

  if (loading) {
    return (
      <Card className="trend-panel" loading={true}>
        <div style={{ height: 280 }} />
      </Card>
    );
  }

  if (!chartData.length) {
    return (
      <Card className="trend-panel">
        <div className="chart-panel-header">
          <LineChartOutlined className="chart-panel-icon" />
          <h3 className="chart-panel-title">月度趋势</h3>
        </div>
        <div className="chart-empty">暂无趋势数据</div>
      </Card>
    );
  }

  return (
    <Card className="trend-panel">
      <div className="chart-panel-header">
        <span className="chart-panel-icon">📈</span>
        <h3 className="chart-panel-title">月度新增趋势</h3>
        <div className="chart-panel-summary">
          新增 <strong>{totals.count}</strong> 台，价值 <strong>{formatValue(totals.value)}元</strong>
        </div>
      </div>

      <div className="trend-chart" style={{ height: 300, width: '100%', minWidth: 0, minHeight: 300 }}>
        <ResponsiveContainer width="100%" height={300} debounce={50} minWidth={0} minHeight={300}>
          <ComposedChart data={chartData} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(22, 119, 255, 0.08)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: 'rgba(148, 163, 184, 0.3)' }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(value) => <span style={{ color: '#475569' }}>{value}</span>}
            />
            <Bar
              yAxisId="left"
              name="新增数量"
              dataKey="count"
              fill="url(#trendBarGradient)"
              radius={[6, 6, 0, 0]}
              barSize={24}
            />
            <Line
              yAxisId="right"
              name="新增价值(元)"
              type="monotone"
              dataKey="value"
              stroke="#f6b12d"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#f6b12d', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#f6b12d', stroke: '#fff', strokeWidth: 2 }}
            />
            <defs>
              <linearGradient id="trendBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5b9bff" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#1677ff" stopOpacity={0.7} />
              </linearGradient>
            </defs>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default DashboardMonthlyTrend;
