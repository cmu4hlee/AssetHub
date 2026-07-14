/**
 * Dashboard 页面 - 主容器组件
 *
 * 职责:
 * - 协调各个子模块的布局
 * - 通过 useDashboardData hook 获取数据
 * - 处理页面级导航
 *
 * 数据获取逻辑已提取到 hooks/useDashboardData.js
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, Button, message, Tooltip } from 'antd';
import { PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useIsMobile, useDashboardData } from '../hooks';
import { printStatisticsReport } from '../utils/printReport';
import auth from '../utils/auth';
import './Dashboard.css';
import DashboardOverview from './dashboard/DashboardOverview';
import DashboardAlerts from './dashboard/DashboardAlerts';
import DashboardCategoryDistribution from './dashboard/DashboardCategoryDistribution';
import DashboardDepartmentStats from './dashboard/DashboardDepartmentStats';
import DashboardMonthlyTrend from './dashboard/DashboardMonthlyTrend';
import DashboardMaintenanceEfficiency from './dashboard/DashboardMaintenanceEfficiency';
import DashboardWarrantyReminders from './dashboard/DashboardWarrantyReminders';
import DashboardMaintenanceStats from './dashboard/DashboardMaintenanceStats';
import DashboardQuickActions from './dashboard/DashboardQuickActions';
import DashboardRecentAssets from './dashboard/DashboardRecentAssets';

const Dashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    stats,
    alerts,
    categories,
    departments,
    monthlyTrend,
    expiringWarranties,
    maintenanceStats,
    recentAssets,
    realtime,
    statsLoading,
    maintenanceStatsLoading,
    refresh,
  } = useDashboardData();

  const [userName, setUserName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const user = auth.getUser() || await auth.getUserAsync();
      setUserName(user?.name || user?.username || user?.displayName || '');
    };
    loadUser();
  }, []);

  const handleNavigate = useCallback((path) => {
    navigate(path);
  }, [navigate]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
      message.success('数据已刷新');
    } catch {
      message.error('刷新失败，请稍后重试');
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const handlePrintReport = useCallback(() => {
    if (!stats && !maintenanceStats) {
      message.warning('暂无数据可打印');
      return;
    }
    printStatisticsReport(stats, maintenanceStats, { period: '全部数据' });
  }, [stats, maintenanceStats]);

  const todayStr = dayjs().format('YYYY年MM月DD日');
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][dayjs().day()];

  const tabItems = [
    {
      key: 'warranty',
      label: (
        <span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4 }}>
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-8h2v8z"/>
          </svg>
          {!isMobile && '保修提醒'}
        </span>
      ),
      children: (
        <DashboardWarrantyReminders
          expiringWarranties={expiringWarranties}
          onNavigate={handleNavigate}
        />
      ),
    },
    {
      key: 'maintenance',
      label: (
        <span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4 }}>
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5.5-1.6-7.4s-5.1-2.4-7.4 1.6l-2.6 2.6c-2.3 2.3-2.3 6.1 0 8.5l5.5 5.5c.5.5 1.1.8 1.7.8s1.2-.3 1.7-.8l2.6-2.6c2.3-2.3 2.3-6.1 0-8.5l-1.1 1.1 1.4 1.4 1.1-1.1c1.1 1.1 1.1 2.8 0 3.9z"/>
          </svg>
          {!isMobile && '维护统计'}
        </span>
      ),
      children: (
        <DashboardMaintenanceStats
          maintenanceStats={maintenanceStats}
          loading={maintenanceStatsLoading}
          onNavigate={handleNavigate}
        />
      ),
    },
  ];

  return (
    <div className="dashboard" style={{ padding: isMobile ? 8 : 16 }}>
      {/* Hero 头部 */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-main">
          <h2 className="dashboard-hero-title">
            {userName ? `${userName}，欢迎回来` : '资产管理仪表盘'}
          </h2>
          <p className="dashboard-hero-sub">
            {todayStr} 星期{weekDay}
            {realtime?.today_added != null && (
              <> · 今日新增 <strong style={{ color: '#fff' }}>{realtime.today_added}</strong> 项资产</>
            )}
          </p>
          <span className="dashboard-hero-badge">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
            数据实时同步
          </span>
        </div>
        <div className="dashboard-hero-actions">
          <Tooltip title="刷新数据">
            <Button
              icon={<ReloadOutlined spin={refreshing} />}
              onClick={handleRefresh}
              loading={refreshing}
            >
              {!isMobile && '刷新'}
            </Button>
          </Tooltip>
          <Button
            icon={<PrinterOutlined />}
            onClick={handlePrintReport}
            disabled={!stats && !maintenanceStats}
          >
            {!isMobile && '打印报表'}
          </Button>
        </div>
      </div>

      {/* 快捷入口（置顶 — 用户登录后第一眼最常用） */}
      <DashboardQuickActions onNavigate={handleNavigate} />

      {/* 概览面板 */}
      <DashboardOverview
        stats={stats}
        loading={statsLoading}
      />

      {/* 预警面板 */}
      <DashboardAlerts
        alerts={alerts}
        loading={statsLoading}
      />

      {/* 类别分布 + 部门统计 双列 */}
      <div className="dashboard-grid">
        <DashboardCategoryDistribution
          categories={categories}
          loading={statsLoading}
        />
        <DashboardDepartmentStats
          departments={departments}
          loading={statsLoading}
        />
      </div>

      {/* 月度趋势 */}
      <DashboardMonthlyTrend
        monthlyData={monthlyTrend}
        loading={statsLoading}
      />

      {/* 维护效率 */}
      <DashboardMaintenanceEfficiency
        efficiency={maintenanceStats}
        loading={maintenanceStatsLoading}
      />

      {/* 最近新增资产 */}
      <DashboardRecentAssets
        recentAssets={recentAssets}
        loading={statsLoading}
        onNavigate={handleNavigate}
      />

      {/* 保修提醒 + 维护统计 标签页 */}
      <div style={{ marginTop: 16 }}>
        <Tabs
          defaultActiveKey="warranty"
          size={isMobile ? 'small' : 'middle'}
          className="dashboard-tabs"
          items={tabItems}
        />
      </div>

      {/* 底部信息 */}
      <div className="dashboard-footer">
        <span>AssetHub 资产管理系统</span>
        <span className="dashboard-footer-dot" />
        <span>数据更新于 {dayjs().format('HH:mm:ss')}</span>
      </div>
    </div>
  );
};

export default Dashboard;
