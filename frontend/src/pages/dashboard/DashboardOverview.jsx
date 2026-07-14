/**
 * Dashboard - 概览面板组件
 * 展示资产核心指标：总数、价值、状态分布、部门/分类数等
 */
import React, { useMemo } from 'react';
import { Card, Tooltip } from 'antd';
import {
  DatabaseOutlined,
  DollarCircleOutlined,
  AppstoreOutlined,
  BankOutlined,
  InfoCircleOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';

const formatPanelValue = (value, precision = 0) => {
  if (value == null) return '-';
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
};

const formatCurrency = (value) => {
  if (value == null) return { value: '-', unit: '', precision: 0 };
  if (value >= 100000000) {
    return { value: (value / 100000000).toFixed(2), unit: '亿元', precision: 2 };
  }
  if (value >= 10000) {
    return { value: (value / 10000).toFixed(2), unit: '万元', precision: 2 };
  }
  return { value: value.toLocaleString(), unit: '元', precision: 0 };
};

const DashboardOverview = ({ stats, loading }) => {
  const overview = stats?.overview || {};
  const valueSummary = stats?.value_summary || {};
  const departmentsCount = stats?.departmentsCount || stats?.by_department?.length || 0;
  const categoriesCount = stats?.by_category?.length || 0;

  const totalCount = overview.total_count || stats?.total_assets || stats?.total || 0;
  const totalValue = overview.total_value || stats?.total_value || valueSummary.total_purchase_value || 0;
  const currentValue = valueSummary.total_current_value || 0;
  const avgPurchasePrice = valueSummary.avg_purchase_price || 0;
  const totalDepreciated = Math.max(0, (valueSummary.total_purchase_value || 0) - (valueSummary.total_current_value || 0));
  const depreciationRate = totalValue > 0 ? ((totalDepreciated / totalValue) * 100).toFixed(1) : 0;

  const totalValueDisplay = useMemo(() => formatCurrency(totalValue), [totalValue]);
  const currentValueDisplay = useMemo(() => formatCurrency(currentValue), [currentValue]);
  const depreciatedDisplay = useMemo(() => formatCurrency(totalDepreciated), [totalDepreciated]);

  const overviewMiniStats = useMemo(() => {
    return [
      {
        key: 'inUse',
        label: '在用资产',
        value: overview.in_use_count || stats?.inUse || 0,
        tone: 'tone-success',
        icon: '📊',
      },
      {
        key: 'idle',
        label: '闲置资产',
        value: overview.idle_count || stats?.idle || 0,
        tone: 'tone-info',
        icon: '📦',
      },
      {
        key: 'maintenance',
        label: '维修中',
        value: overview.repair_count || stats?.maintenance || 0,
        tone: 'tone-warning',
        icon: '🔧',
      },
      {
        key: 'transfer',
        label: '调配中',
        value: overview.transfer_count || stats?.transfer || 0,
        tone: 'tone-aux',
        icon: '🚚',
      },
      {
        key: 'scrapped',
        label: '已报废',
        value: overview.scrap_count || stats?.scrapped || 0,
        tone: 'tone-danger',
        icon: '🗑️',
      },
    ];
  }, [stats]);

  // 额外指标卡片
  const extraMetrics = useMemo(() => {
    const inUseCount = overview.in_use_count || 0;
    const utilizationRate = totalCount > 0 ? ((inUseCount / totalCount) * 100).toFixed(1) : 0;
    return [
      {
        key: 'utilization',
        label: '资产利用率',
        value: `${utilizationRate}%`,
        icon: <RiseOutlined />,
        color: '#52c41a',
        desc: '在用 / 总数',
      },
      {
        key: 'currentValue',
        label: '资产现值',
        value: formatPanelValue(currentValueDisplay.value, currentValueDisplay.precision),
        unit: currentValueDisplay.unit,
        icon: <DollarCircleOutlined />,
        color: '#1677ff',
        desc: '当前账面价值',
      },
      {
        key: 'depreciation',
        label: '累计折旧',
        value: formatPanelValue(depreciatedDisplay.value, depreciatedDisplay.precision),
        unit: depreciatedDisplay.unit,
        icon: <FallOutlined />,
        color: '#faad14',
        desc: `折旧率 ${depreciationRate}%`,
      },
      {
        key: 'avgPrice',
        label: '平均原值',
        value: formatPanelValue(avgPurchasePrice, 0),
        unit: '元',
        icon: <AppstoreOutlined />,
        color: '#722ed1',
        desc: '购置均价',
      },
      {
        key: 'departments',
        label: '涉及部门',
        value: departmentsCount,
        icon: <BankOutlined />,
        color: '#13c2c2',
        desc: '资产分布部门数',
      },
      {
        key: 'categories',
        label: '资产分类',
        value: categoriesCount,
        icon: <AppstoreOutlined />,
        color: '#eb2f96',
        desc: '资产分类数',
      },
    ];
  }, [stats, totalCount, departmentsCount, categoriesCount, currentValueDisplay, depreciatedDisplay, avgPurchasePrice, depreciationRate]);

  return (
    <Card loading={loading} className="overview-panel" styles={{ body: { padding: 0 } }}>
      <div className="overview-panel-shell">
        <div className="overview-main">
          <div className="overview-eyebrow">资产运营总览</div>
          <h2 className="overview-title">核心资产态势</h2>
          <p className="overview-subtitle">实时汇总资产规模与价值，帮助快速掌握运行健康度</p>

          <div className="overview-primary-metrics">
            <div className="overview-primary-item">
              <div className="overview-primary-icon">
                <DatabaseOutlined />
              </div>
              <div className="overview-primary-content">
                <div className="overview-primary-label">资产总数</div>
                <div className="overview-primary-value">{formatPanelValue(totalCount)}</div>
                <div className="overview-primary-unit">台设备</div>
              </div>
            </div>

            <div className="overview-primary-item value">
              <div className="overview-primary-icon">
                <DollarCircleOutlined />
              </div>
              <div className="overview-primary-content">
                <div className="overview-primary-label">资产原值总额</div>
                <div className="overview-primary-value">
                  {formatPanelValue(totalValueDisplay.value, totalValueDisplay.precision)}
                </div>
                <div className="overview-primary-unit">{totalValueDisplay.unit}</div>
              </div>
            </div>
          </div>

          {/* 额外指标卡片 */}
          <div className="overview-extra-grid">
            {extraMetrics.map(item => (
              <div key={item.key} className="overview-extra-item">
                <div className="overview-extra-icon" style={{ color: item.color, background: `${item.color}1a` }}>
                  {item.icon}
                </div>
                <div className="overview-extra-content">
                  <div className="overview-extra-value">
                    {item.value}
                    {item.unit && <span className="overview-extra-unit">{item.unit}</span>}
                  </div>
                  <div className="overview-extra-label">
                    {item.label}
                    <Tooltip title={item.desc}>
                      <InfoCircleOutlined style={{ marginLeft: 4, fontSize: 11, color: '#94a3b8' }} />
                    </Tooltip>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="overview-mini-grid">
          {overviewMiniStats.map(item => (
            <div key={item.key} className="overview-mini-item">
              <div className={`overview-mini-icon ${item.tone}`}>{item.icon}</div>
              <div className="overview-mini-content">
                <div className="overview-mini-value">{formatPanelValue(item.value)}</div>
                <div className="overview-mini-label">{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default DashboardOverview;
