import React from 'react';

const TimeSeriesLineChart = ({ points = [], height = 220, color = '#1677ff', unit = '' }) => {
  if (!Array.isArray(points) || points.length === 0) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>暂无时序数据</div>;
  }

  const width = 760;
  const pad = 36;
  const values = points.map(item => Number(item.value)).filter(v => Number.isFinite(v));
  if (values.length === 0) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>当前指标暂无数值</div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const polylinePoints = points
    .map((item, idx) => {
      const x = pad + (idx * (width - pad * 2)) / Math.max(points.length - 1, 1);
      const y = height - pad - ((Number(item.value) - min) / span) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const last = points[points.length - 1];

  return (
    <div>
      <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>
        最小值: {min.toFixed(2)}{unit}  最大值: {max.toFixed(2)}{unit}  最新值: {Number(last.value).toFixed(2)}{unit}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8 }}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#d9d9d9" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#d9d9d9" />
        <polyline points={polylinePoints} fill="none" stroke={color} strokeWidth="2.5" />
      </svg>
    </div>
  );
};

export default TimeSeriesLineChart;
