/**
 * Dashboard - 预警面板组件
 * 展示关键预警信息：保修到期、低价值资产、待处理维护、待审批调配
 */
import React from 'react';
import { Card } from 'antd';
import {
  WarningOutlined,
  DollarOutlined,
  ToolOutlined,
  SwapOutlined,
} from '@ant-design/icons';

const DashboardAlerts = ({ alerts, loading }) => {
  const alertItems = [
    {
      key: 'warranty',
      title: '保修即将到期',
      value: alerts?.warranty_expiring || 0,
      icon: <WarningOutlined />,
      color: '#faad14',
      bgColor: 'rgba(250, 173, 20, 0.1)',
      borderColor: 'rgba(250, 173, 20, 0.3)',
      desc: '30天内保修到期',
      link: '/assets?filter=warranty_expiring',
    },
    {
      key: 'low_value',
      title: '低价值资产',
      value: alerts?.low_value_assets || 0,
      icon: <DollarOutlined />,
      color: '#f5222d',
      bgColor: 'rgba(245, 34, 45, 0.1)',
      borderColor: 'rgba(245, 34, 45, 0.3)',
      desc: '残值低于原值10%',
      link: '/assets?filter=low_value',
    },
    {
      key: 'pending_maintenance',
      title: '进行中维护',
      value: alerts?.pending_maintenance || 0,
      icon: <ToolOutlined />,
      color: '#1890ff',
      bgColor: 'rgba(24, 144, 255, 0.1)',
      borderColor: 'rgba(24, 144, 255, 0.3)',
      desc: '正在进行的维修任务',
      link: '/maintenance',
    },
    {
      key: 'pending_transfers',
      title: '待审批调配',
      value: alerts?.pending_transfers || 0,
      icon: <SwapOutlined />,
      color: '#722ed1',
      bgColor: 'rgba(114, 46, 209, 0.1)',
      borderColor: 'rgba(114, 46, 209, 0.3)',
      desc: '等待审批的调配申请',
      link: '/transfer',
    },
  ];

  const hasAlerts = alertItems.some(item => item.value > 0);

  if (loading) {
    return (
      <Card className="alert-panel" loading={true}>
        <div style={{ height: 120 }} />
      </Card>
    );
  }

  return (
    <Card className="alert-panel">
      <div className="alert-panel-header">
        <div className="alert-panel-title-row">
          <span className="alert-panel-icon">🔔</span>
          <h3 className="alert-panel-title">关键预警</h3>
          {hasAlerts && (
            <span className="alert-panel-badge">
              {alertItems.reduce((sum, item) => sum + item.value, 0)} 项待处理
            </span>
          )}
        </div>
        <p className="alert-panel-subtitle">需要关注和处理的关键事项</p>
      </div>

      <div className="alert-grid">
        {alertItems.map(item => (
          <div
            key={item.key}
            className={`alert-item ${item.value > 0 ? 'alert-active' : ''}`}
            style={{
              borderColor: item.value > 0 ? item.borderColor : undefined,
              background: item.value > 0 ? `linear-gradient(135deg, ${item.bgColor}, #fff)` : undefined,
            }}
          >
            <div
              className="alert-item-icon"
              style={{ color: item.color, background: item.bgColor }}
            >
              {item.icon}
            </div>
            <div className="alert-item-content">
              <div className="alert-item-value">{item.value}</div>
              <div className="alert-item-title">{item.title}</div>
              <div className="alert-item-desc">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default DashboardAlerts;
