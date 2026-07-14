/**
 * Dashboard - 部门统计组件
 * 展示各部门资产数量和总价值
 */
import React from 'react';
import { Card } from 'antd';
import { BankOutlined } from '@ant-design/icons';

const formatValue = (value) => {
  if (!value) return '0元';
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  return `${value}元`;
};

const DashboardDepartmentStats = ({ departments, loading }) => {
  if (loading) {
    return (
      <Card className="department-panel" loading={true}>
        <div style={{ height: 240 }} />
      </Card>
    );
  }

  if (!departments || departments.length === 0) {
    return (
      <Card className="department-panel">
        <div className="chart-panel-header">
          <BankOutlined className="chart-panel-icon" />
          <h3 className="chart-panel-title">部门统计</h3>
        </div>
        <div className="chart-empty">暂无部门数据</div>
      </Card>
    );
  }

  const maxCount = Math.max(...departments.map(d => d.asset_count || 0));

  return (
    <Card className="department-panel">
      <div className="chart-panel-header">
        <span className="chart-panel-icon">🏢</span>
        <h3 className="chart-panel-title">部门资产统计</h3>
        <span className="chart-panel-total">{departments.length} 个部门</span>
      </div>

      <div className="department-list">
        {departments.slice(0, 10).map((dept, index) => {
          const count = dept.asset_count || 0;
          const value = dept.total_purchase_value || 0;
          const barWidth = maxCount > 0 ? ((count / maxCount) * 100) : 0;

          return (
            <div key={dept.department_id || index} className="department-item">
              <div className="department-item-header">
                <div className="department-rank">{index + 1}</div>
                <div className="department-info">
                  <div className="department-name">{dept.department_name || '未分配'}</div>
                  <div className="department-value">资产价值 {formatValue(value)}</div>
                </div>
                <div className="department-count">{count} 台</div>
              </div>
              <div className="department-bar-bg">
                <div
                  className="department-bar-fill"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default DashboardDepartmentStats;
