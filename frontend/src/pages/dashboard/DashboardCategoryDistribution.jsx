/**
 * Dashboard - 资产类别分布组件
 * 使用 recharts 饼图 + 进度条列表展示各类别资产数量占比
 */
import React, { useMemo } from 'react';
import { Card } from 'antd';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts';

const COLORS = [
  '#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa8c16', '#2f54eb', '#a0d911',
];

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0];
  return (
    <div style={{
      background: 'rgba(31, 59, 100, 0.95)',
      color: '#fff',
      padding: '6px 10px',
      borderRadius: 6,
      fontSize: 12,
    }}>
      <div style={{ fontWeight: 600 }}>{data.name}</div>
      <div>{data.value} 台（{data.payload.percent}%）</div>
    </div>
  );
};

const renderLabel = ({ name, percent }) => {
  if (!percent || percent < 5) return '';
  return `${percent}%`;
};

const DashboardCategoryDistribution = ({ categories, loading }) => {
  const { total, pieData, listData } = useMemo(() => {
    const total = categories?.reduce((sum, c) => sum + (c.count || c.cnt || 0), 0) || 0;
    const raw = (categories || []).map((item, index) => {
      const count = item.count || item.cnt || 0;
      const name = item.category || item.name || '未分类';
      const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
      const color = COLORS[index % COLORS.length];
      return { name, count, percent, color };
    });
    return {
      total,
      pieData: raw.slice(0, 8),
      listData: raw.slice(0, 8),
    };
  }, [categories]);

  const maxCount = useMemo(() => {
    if (!listData.length) return 0;
    return Math.max(...listData.map(d => d.count));
  }, [listData]);

  if (loading) {
    return (
      <Card className="category-panel" loading={true}>
        <div style={{ height: 320 }} />
      </Card>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <Card className="category-panel">
        <div className="chart-panel-header">
          <span className="chart-panel-icon">📊</span>
          <h3 className="chart-panel-title">类别分布</h3>
        </div>
        <div className="chart-empty">暂无类别数据</div>
      </Card>
    );
  }

  return (
    <Card className="category-panel">
      <div className="chart-panel-header">
        <span className="chart-panel-icon">📊</span>
        <h3 className="chart-panel-title">资产类别分布</h3>
        <span className="chart-panel-total">{total} 台设备</span>
      </div>

      <div className="category-chart-row">
        <div className="category-pie-wrap" style={{ width: '100%', height: 300, minWidth: 0, minHeight: 300 }}>
          <ResponsiveContainer width="100%" height={300} debounce={50} minWidth={0} minHeight={300}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
                label={renderLabel}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="category-pie-center">
            <div className="category-pie-total">{total}</div>
            <div className="category-pie-label">总设备</div>
          </div>
        </div>

        <div className="category-list">
          {listData.map((item, index) => {
            const barWidth = maxCount > 0 ? ((item.count / maxCount) * 100) : 0;
            return (
              <div key={`${item.name}-${index}`} className="category-item">
                <div className="category-item-header">
                  <div className="category-item-info">
                    <div
                      className="category-dot"
                      style={{ background: item.color }}
                    />
                    <span className="category-name">{item.name}</span>
                  </div>
                  <div className="category-item-stats">
                    <span className="category-count">{item.count}</span>
                    <span className="category-percent">{item.percent}%</span>
                  </div>
                </div>
                <div className="category-bar-bg">
                  <div
                    className="category-bar-fill"
                    style={{
                      width: `${barWidth}%`,
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export default DashboardCategoryDistribution;
