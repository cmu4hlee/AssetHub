/**
 * Dashboard - 维护统计组件
 */
import React from 'react';
import { Card, Button } from 'antd';
import { ToolOutlined } from '@ant-design/icons';

const DashboardMaintenanceStats = ({ maintenanceStats, onNavigate }) => {
  if (!maintenanceStats) {
    return (
      <Card extra={<Button type="primary" onClick={() => onNavigate('/maintenance/workorders')}>
        查看全部
      </Button>}>
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          暂无维护数据
        </div>
      </Card>
    );
  }

  const total = maintenanceStats.total_count || maintenanceStats.total || 0;
  const totalCost = maintenanceStats.total_cost || maintenanceStats.totalCost || 0;
  const faultRepair = maintenanceStats.fault_repair_count || maintenanceStats.faultRepair || 0;
  const preventive = maintenanceStats.preventive_count || maintenanceStats.preventive || 0;
  const routine = maintenanceStats.routine_count || maintenanceStats.routine || 0;
  const completed = maintenanceStats.completed_count || maintenanceStats.completed || 0;
  const inProgress = maintenanceStats.in_progress_count || maintenanceStats.inProgress || 0;
  const pending = total - completed - inProgress;

  return (
    <Card extra={<Button type="primary" onClick={() => onNavigate('/maintenance/workorders')}>
      查看全部
    </Button>}>
      <div className="maint-stat-grid">
        <div className="maint-stat-item">
          <div className="maint-stat-value">{total}</div>
          <div className="maint-stat-label">总维护数</div>
        </div>
        <div className="maint-stat-item">
          <div className="maint-stat-value" style={{ color: 'var(--warning-color, #faad14)' }}>
            {pending}
          </div>
          <div className="maint-stat-label">待处理</div>
        </div>
        <div className="maint-stat-item">
          <div className="maint-stat-value" style={{ color: 'var(--primary-color, #1890ff)' }}>
            {inProgress}
          </div>
          <div className="maint-stat-label">处理中</div>
        </div>
        <div className="maint-stat-item">
          <div className="maint-stat-value" style={{ color: 'var(--success-color, #52c41a)' }}>
            {completed}
          </div>
          <div className="maint-stat-label">已完成</div>
        </div>
      </div>

      <div className="maint-stat-grid">
        <div className="maint-stat-item">
          <div className="maint-stat-value">{faultRepair}</div>
          <div className="maint-stat-label">故障维修</div>
        </div>
        <div className="maint-stat-item">
          <div className="maint-stat-value">{preventive}</div>
          <div className="maint-stat-label">预防性维护</div>
        </div>
        <div className="maint-stat-item">
          <div className="maint-stat-value">{routine}</div>
          <div className="maint-stat-label">日常维护</div>
        </div>
        <div className="maint-stat-item">
          <div className="maint-stat-value">
            {totalCost?.toLocaleString() || '0'}
          </div>
          <div className="maint-stat-label">总费用(元)</div>
        </div>
      </div>
    </Card>
  );
};

export default DashboardMaintenanceStats;
