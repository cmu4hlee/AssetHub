/**
 * Dashboard - 维护效率组件
 * 展示维护任务的关键效率指标
 */
import React from 'react';
import { Card } from 'antd';
import { ToolOutlined } from '@ant-design/icons';

const formatTime = (hours) => {
  if (!hours || hours <= 0) return '-';
  if (hours < 24) {
    return `${hours.toFixed(1)} 小时`;
  }
  return `${(hours / 24).toFixed(1)} 天`;
};

const DashboardMaintenanceEfficiency = ({ efficiency, loading }) => {
  if (loading) {
    return (
      <Card className="efficiency-panel" loading={true}>
        <div style={{ height: 160 }} />
      </Card>
    );
  }

  const data = efficiency || {};
  const metrics = [
    {
      key: 'total',
      label: '总维护任务',
      value: data.total_count || data.total || 0,
      icon: '📋',
    },
    {
      key: 'completed',
      label: '已完成',
      value: data.completed_count || data.completed || 0,
      icon: '✅',
    },
    {
      key: 'avgResponseTime',
      label: '平均响应时间',
      value: formatTime(data.avg_response_time),
      icon: '⏱️',
    },
    {
      key: 'avgRepairTime',
      label: '平均修复时间',
      value: formatTime(data.avg_repair_time),
      icon: '🔧',
    },
  ];

  return (
    <Card className="efficiency-panel">
      <div className="efficiency-header">
        <span className="efficiency-icon">🔧</span>
        <h3 className="efficiency-title">维护效率</h3>
      </div>

      <div className="efficiency-grid">
        {metrics.map(item => (
          <div key={item.key} className="efficiency-item">
            <div className="efficiency-item-icon">{item.icon}</div>
            <div className="efficiency-item-content">
              <div className="efficiency-item-value">{item.value}</div>
              <div className="efficiency-item-label">{item.label}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default DashboardMaintenanceEfficiency;
