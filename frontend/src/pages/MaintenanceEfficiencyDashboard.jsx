import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  DatePicker,
  Statistic,
  message,
  Spin,
  Empty,
  Table,
  Button,
  Alert,
  Tag,
} from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  ClockCircleOutlined,
  UserOutlined,
  BarChartOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  CalendarOutlined,
  DollarOutlined,
  DownloadOutlined,
  PieChartOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { maintenanceAPI } from '../utils/api';
import { printMaintenanceEfficiencyReport } from '../utils/printReport';
import useIsMobile from '../hooks/useIsMobile';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

// 预设日期范围快捷选项
const rangePresets = [
  {
    label: '本月',
    value: [dayjs().startOf('month'), dayjs().endOf('month')],
  },
  {
    label: '近3月',
    value: [dayjs().subtract(3, 'month').startOf('month'), dayjs().endOf('month')],
  },
  {
    label: '近6月',
    value: [dayjs().subtract(6, 'month').startOf('month'), dayjs().endOf('month')],
  },
  {
    label: '今年',
    value: [dayjs().startOf('year'), dayjs().endOf('year')],
  },
];

// 安全取值工具函数
const safeNum = (val, fallback = 0) => (val != null && !isNaN(Number(val)) ? Number(val) : fallback);
const safeArr = (val, fallback = []) => (Array.isArray(val) ? val : fallback);
const safeStr = (val, fallback = '-') => (val != null && val !== '' ? String(val) : fallback);

// 单个 API 安全调用，处理 404/500 等
const safeApiCall = async (apiFn, params) => {
  try {
    const result = await apiFn(params);
    if (result && result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, data: null, error: result?.message || '请求失败' };
  } catch (error) {
    const status = error?.response?.status;
    if (status === 404) {
      return { success: false, data: null, error: '接口未找到' };
    }
    if (status >= 500) {
      return { success: false, data: null, error: '服务器错误' };
    }
    return { success: false, data: null, error: error?.message || '请求异常' };
  }
};

// 完成率颜色
const getCompletionColor = rate => {
  const r = safeNum(rate);
  if (r >= 90) return '#52c41a';
  if (r >= 70) return '#faad14';
  return '#ff4d4f';
};

// 维护类型对应的 Tag 颜色
const getMaintenanceTypeColor = type => {
  const map = {
    '故障维修': 'red',
    '预防性维护': 'green',
    '日常维护': 'blue',
    '定期保养': 'purple',
  };
  return map[type] || 'default';
};

const MaintenanceEfficiencyDashboard = () => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(null);
  const [overviewData, setOverviewData] = useState(null);
  const [responseTimeData, setResponseTimeData] = useState([]);
  const [technicianData, setTechnicianData] = useState([]);
  const [assetFrequencyData, setAssetFrequencyData] = useState([]);
  const [costAnalysisData, setCostAnalysisData] = useState(null);
  const [costTrendData, setCostTrendData] = useState([]);
  const [typeDistributionData, setTypeDistributionData] = useState([]);

  // 各区块加载与错误状态
  const [sectionErrors, setSectionErrors] = useState({});
  const [sectionLoading, setSectionLoading] = useState({});

  // 更新区块错误
  const setSectionError = (section, error) => {
    setSectionErrors(prev => ({ ...prev, [section]: error }));
  };
  const setSectionLoadingState = (section, isLoading) => {
    setSectionLoading(prev => ({ ...prev, [section]: isLoading }));
  };

  // 加载概览数据
  const loadOverview = async params => {
    setSectionLoadingState('overview', true);
    setSectionError('overview', null);
    try {
      const result = await safeApiCall(maintenanceAPI.getEfficiencyOverview, params);
      if (result.success) {
        setOverviewData(result.data);
      } else {
        setSectionError('overview', result.error);
        setOverviewData(null);
      }
    } catch (e) {
      setSectionError('overview', '加载概览数据异常');
      setOverviewData(null);
    } finally {
      setSectionLoadingState('overview', false);
    }
  };

  // 加载响应时间数据
  const loadResponseTime = async params => {
    setSectionLoadingState('responseTime', true);
    setSectionError('responseTime', null);
    try {
      const result = await safeApiCall(maintenanceAPI.getEfficiencyResponseTime, params);
      if (result.success) {
        setResponseTimeData(safeArr(result.data));
      } else {
        setSectionError('responseTime', result.error);
        setResponseTimeData([]);
      }
    } catch (e) {
      setSectionError('responseTime', '加载响应时间数据异常');
      setResponseTimeData([]);
    } finally {
      setSectionLoadingState('responseTime', false);
    }
  };

  // 加载技术人员效率数据
  const loadTechnician = async params => {
    setSectionLoadingState('technician', true);
    setSectionError('technician', null);
    try {
      const result = await safeApiCall(maintenanceAPI.getEfficiencyTechnician, {
        ...params,
        limit: 10,
      });
      if (result.success) {
        setTechnicianData(safeArr(result.data));
      } else {
        setSectionError('technician', result.error);
        setTechnicianData([]);
      }
    } catch (e) {
      setSectionError('technician', '加载技术人员数据异常');
      setTechnicianData([]);
    } finally {
      setSectionLoadingState('technician', false);
    }
  };

  // 加载资产维护频率数据
  const loadAssetFrequency = async params => {
    setSectionLoadingState('assetFrequency', true);
    setSectionError('assetFrequency', null);
    try {
      const result = await safeApiCall(maintenanceAPI.getEfficiencyAssetFrequency, {
        ...params,
        limit: 10,
      });
      if (result.success) {
        setAssetFrequencyData(safeArr(result.data));
      } else {
        setSectionError('assetFrequency', result.error);
        setAssetFrequencyData([]);
      }
    } catch (e) {
      setSectionError('assetFrequency', '加载资产频率数据异常');
      setAssetFrequencyData([]);
    } finally {
      setSectionLoadingState('assetFrequency', false);
    }
  };

  // 加载成本分析数据
  const loadCostAnalysis = async params => {
    setSectionLoadingState('costAnalysis', true);
    setSectionError('costAnalysis', null);
    try {
      const result = await safeApiCall(maintenanceAPI.getCostAnalysis, params);
      if (result.success) {
        setCostAnalysisData(result.data);
      } else {
        setSectionError('costAnalysis', result.error);
        setCostAnalysisData(null);
      }
    } catch (e) {
      setSectionError('costAnalysis', '加载成本分析数据异常');
      setCostAnalysisData(null);
    } finally {
      setSectionLoadingState('costAnalysis', false);
    }
  };

  // 加载成本趋势分析数据
  const loadCostTrend = async params => {
    setSectionLoadingState('costTrend', true);
    setSectionError('costTrend', null);
    try {
      const result = await safeApiCall(maintenanceAPI.getCostTrendAnalysis, params);
      if (result.success) {
        setCostTrendData(safeArr(result.data));
      } else {
        setSectionError('costTrend', result.error);
        setCostTrendData([]);
      }
    } catch (e) {
      setSectionError('costTrend', '加载成本趋势数据异常');
      setCostTrendData([]);
    } finally {
      setSectionLoadingState('costTrend', false);
    }
  };

  // 加载维护类型分布数据
  const loadTypeDistribution = async params => {
    setSectionLoadingState('typeDistribution', true);
    setSectionError('typeDistribution', null);
    try {
      const result = await safeApiCall(maintenanceAPI.getTypeDistribution, params);
      if (result.success) {
        setTypeDistributionData(safeArr(result.data));
      } else {
        setSectionError('typeDistribution', result.error);
        setTypeDistributionData([]);
      }
    } catch (e) {
      setSectionError('typeDistribution', '加载类型分布数据异常');
      setTypeDistributionData([]);
    } finally {
      setSectionLoadingState('typeDistribution', false);
    }
  };

  // 加载全部数据
  const loadData = useCallback(async () => {
    setLoading(true);
    const params = {
      start_date: dateRange?.[0]?.format('YYYY-MM-DD') || '',
      end_date: dateRange?.[1]?.format('YYYY-MM-DD') || '',
    };

    await Promise.allSettled([
      loadOverview(params),
      loadResponseTime(params),
      loadTechnician(params),
      loadAssetFrequency(params),
      loadCostAnalysis(params),
      loadCostTrend(params),
      loadTypeDistribution(params),
    ]);

    setLoading(false);
  }, [dateRange]);

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 日期范围变化
  const handleDateRangeChange = dates => {
    setDateRange(dates);
  };

  // 刷新
  const handleRefresh = () => {
    loadData();
  };

  const handlePrintReport = () => {
    printMaintenanceEfficiencyReport(
      overviewData,
      costAnalysisData,
      costTrendData,
      technicianData,
      assetFrequencyData
    );
  };

  // ======== 导出报告 ========
  const handleExportReport = () => {
    const BOM = '\uFEFF';
    const lines = [];

    // 标题
    lines.push('维护效率分析报告');
    lines.push(`导出时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`);
    if (dateRange?.[0] && dateRange?.[1]) {
      lines.push(`统计范围: ${dateRange[0].format('YYYY-MM-DD')} ~ ${dateRange[1].format('YYYY-MM-DD')}`);
    }
    lines.push('');

    // 概览数据
    lines.push('=== 概览统计 ===');
    lines.push(`工单总数,${totalWorkOrders}`);
    lines.push(`平均完成时间(小时),${avgCompletionTime.toFixed(1)}`);
    lines.push(`完成率(%),${completionRate.toFixed(1)}`);
    lines.push(`逾期工单,${overdueCount}`);
    lines.push(`总维护费用,¥${totalMaintenanceCost.toLocaleString()}`);
    lines.push(`平均响应时间(小时),${avgResponseTime.toFixed(1)}`);
    lines.push('');

    // 技术人员效率
    lines.push('=== 技术人员效率排名 ===');
    lines.push('排名,技术人员,维护次数,完成次数,完成率(%),平均时间(小时),总成本');
    safeArr(technicianData).forEach((item, idx) => {
      lines.push([
        idx + 1,
        safeStr(item.technician),
        safeNum(item.maintenance_count),
        safeNum(item.completed_count),
        safeNum(item.completion_rate, 0).toFixed(1),
        safeNum(item.avg_maintenance_time, 0).toFixed(1),
        `¥${safeNum(item.total_cost, 0).toLocaleString()}`,
      ].join(','));
    });
    lines.push('');

    // 资产维护频率
    lines.push('=== 资产维护频率（Top 10）===');
    lines.push('排名,资产名称,资产编码,维护次数,平均维护时间(小时),总成本');
    safeArr(assetFrequencyData).forEach((item, idx) => {
      lines.push([
        idx + 1,
        safeStr(item.asset_name),
        safeStr(item.asset_code),
        safeNum(item.maintenance_count),
        safeNum(item.avg_maintenance_time, 0).toFixed(1),
        `¥${safeNum(item.total_cost, 0).toLocaleString()}`,
      ].join(','));
    });
    lines.push('');

    // 成本分析
    lines.push('=== 成本分析 ===');
    lines.push(`总成本,¥${costTotal.toLocaleString()}`);
    lines.push(`平均单次维护成本,¥${costAvg.toLocaleString()}`);
    lines.push(`成本趋势,${costTrendDirection > 0 ? '上升' : costTrendDirection < 0 ? '下降' : '持平'}`);
    lines.push('');

    // 成本分布
    const costDistribution = safeArr(costTrendData);
    if (costDistribution.length > 0) {
      lines.push('=== 成本分布（按维护类型）===');
      lines.push('维护类型,次数,总成本,平均成本');
      costDistribution.forEach(item => {
        lines.push([
          safeStr(item.maintenance_type),
          safeNum(item.count),
          `¥${safeNum(item.total_cost, 0).toLocaleString()}`,
          `¥${safeNum(item.avg_cost, 0).toLocaleString()}`,
        ].join(','));
      });
      lines.push('');
    }

    // 高成本资产
    const assetDistribution = safeArr(costAnalysisData?.assetDistribution);
    if (assetDistribution.length > 0) {
      lines.push('=== 高成本资产 ===');
      lines.push('资产名称,资产编码,维护次数,总成本');
      assetDistribution.forEach(item => {
        lines.push([
          safeStr(item.asset_name),
          safeStr(item.asset_code),
          safeNum(item.maintenance_count),
          `¥${safeNum(item.total_cost, 0).toLocaleString()}`,
        ].join(','));
      });
      lines.push('');
    }

    // 维护类型分布
    const typeDistribution = safeArr(typeDistributionData);
    if (typeDistribution.length > 0) {
      lines.push('=== 维护类型分布 ===');
      lines.push('维护类型,次数,占比(%)');
      typeDistribution.forEach(item => {
        lines.push([
          safeStr(item.maintenance_type),
          safeNum(item.count),
          safeNum(item.percentage, 0).toFixed(1),
        ].join(','));
      });
    }

    const csvContent = BOM + lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `维护效率分析报告_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    message.success('报告导出成功');
  };

  // ======== 概览指标 ========
  const overview = overviewData?.overview || {};
  const totalWorkOrders = safeNum(overview.total_maintenance);
  const avgCompletionTime = safeNum(overview.avg_maintenance_time, 0);
  const completionRate = safeNum(overview.completion_rate, 0);
  const overdueCount = safeNum(overview.overdue_count);
  const workOrderTrend = safeNum(overview.work_order_trend, 0);
  const totalMaintenanceCost = safeNum(overview.total_cost);
  const avgResponseTime = safeNum(overview.avg_response_time, 0);

  // ======== 成本分析指标 ========
  const costSummary = costAnalysisData?.summary || costAnalysisData?.overview || {};
  const costTotal = safeNum(costSummary.total_cost);
  const costAvg = safeNum(costSummary.avg_cost);
  const costTrendDirection = safeNum(costSummary.cost_trend, 0);

  // ======== 响应时间分布表格列 ========
  const responseTimeColumns = [
    {
      title: '日期',
      dataIndex: 'maintenance_date',
      key: 'maintenance_date',
      render: val => safeStr(val),
    },
    {
      title: '平均响应时间(小时)',
      dataIndex: 'avg_response_hours',
      key: 'avg_response_hours',
      render: val => safeNum(val, 0).toFixed(1),
      sorter: (a, b) => safeNum(a.avg_response_hours) - safeNum(b.avg_response_hours),
    },
    {
      title: '维护次数',
      dataIndex: 'maintenance_count',
      key: 'maintenance_count',
      render: val => safeNum(val),
      sorter: (a, b) => safeNum(a.maintenance_count) - safeNum(b.maintenance_count),
    },
    {
      title: '响应评级',
      dataIndex: 'avg_response_hours',
      key: 'response_level',
      render: val => {
        const hours = safeNum(val, 999);
        if (hours <= 2) return <Tag color="green">快速</Tag>;
        if (hours <= 8) return <Tag color="blue">正常</Tag>;
        if (hours <= 24) return <Tag color="orange">较慢</Tag>;
        return <Tag color="red">缓慢</Tag>;
      },
    },
  ];

  // ======== 技术人员效率排名表格列 ========
  const technicianColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_, __, idx) => {
        if (idx === 0) return <Tag color="gold">1</Tag>;
        if (idx === 1) return <Tag color="#c0c0c0">2</Tag>;
        if (idx === 2) return <Tag color="#cd7f32">3</Tag>;
        return idx + 1;
      },
    },
    {
      title: '技术人员',
      dataIndex: 'technician',
      key: 'technician',
      render: val => safeStr(val),
    },
    {
      title: '维护次数',
      dataIndex: 'maintenance_count',
      key: 'maintenance_count',
      render: val => safeNum(val),
      sorter: (a, b) => safeNum(a.maintenance_count) - safeNum(b.maintenance_count),
      defaultSortOrder: 'descend',
    },
    {
      title: '完成次数',
      dataIndex: 'completed_count',
      key: 'completed_count',
      render: val => safeNum(val),
    },
    {
      title: '完成率',
      dataIndex: 'completion_rate',
      key: 'completion_rate',
      render: val => {
        const rate = safeNum(val, 0);
        return <span style={{ color: getCompletionColor(rate) }}>{rate.toFixed(1)}%</span>;
      },
      sorter: (a, b) => safeNum(a.completion_rate) - safeNum(b.completion_rate),
    },
    {
      title: '平均时间(小时)',
      dataIndex: 'avg_maintenance_time',
      key: 'avg_maintenance_time',
      render: val => safeNum(val, 0).toFixed(1),
      sorter: (a, b) => safeNum(a.avg_maintenance_time) - safeNum(b.avg_maintenance_time),
    },
    {
      title: '总成本',
      dataIndex: 'total_cost',
      key: 'total_cost',
      render: val => `¥${safeNum(val, 0).toLocaleString()}`,
      sorter: (a, b) => safeNum(a.total_cost) - safeNum(b.total_cost),
    },
  ];

  // ======== 资产维护频率表格列 ========
  const assetFrequencyColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_, __, idx) => idx + 1,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      render: val => safeStr(val),
    },
    {
      title: '资产编码',
      dataIndex: 'asset_code',
      key: 'asset_code',
      render: val => safeStr(val),
    },
    {
      title: '维护次数',
      dataIndex: 'maintenance_count',
      key: 'maintenance_count',
      render: val => safeNum(val),
      sorter: (a, b) => safeNum(a.maintenance_count) - safeNum(b.maintenance_count),
      defaultSortOrder: 'descend',
    },
    {
      title: '平均维护时间(小时)',
      dataIndex: 'avg_maintenance_time',
      key: 'avg_maintenance_time',
      render: val => safeNum(val, 0).toFixed(1),
      sorter: (a, b) => safeNum(a.avg_maintenance_time) - safeNum(b.avg_maintenance_time),
    },
    {
      title: '总成本',
      dataIndex: 'total_cost',
      key: 'total_cost',
      render: val => `¥${safeNum(val, 0).toLocaleString()}`,
    },
    {
      title: '频率评级',
      key: 'frequency_level',
      render: (_, record) => {
        const count = safeNum(record.maintenance_count);
        if (count >= 10) return <Tag color="red">高频</Tag>;
        if (count >= 5) return <Tag color="orange">中频</Tag>;
        return <Tag color="green">低频</Tag>;
      },
    },
  ];

  // ======== 成本分布表格列（按维护类型）========
  const costDistributionColumns = [
    {
      title: '维护类型',
      dataIndex: 'maintenance_type',
      key: 'maintenance_type',
      render: val => <Tag color={getMaintenanceTypeColor(val)}>{safeStr(val)}</Tag>,
    },
    {
      title: '次数',
      dataIndex: 'count',
      key: 'count',
      render: val => safeNum(val),
      sorter: (a, b) => safeNum(a.count) - safeNum(b.count),
    },
    {
      title: '总成本',
      dataIndex: 'total_cost',
      key: 'total_cost',
      render: val => `¥${safeNum(val, 0).toLocaleString()}`,
      sorter: (a, b) => safeNum(a.total_cost) - safeNum(b.total_cost),
    },
    {
      title: '平均成本',
      dataIndex: 'avg_cost',
      key: 'avg_cost',
      render: val => `¥${safeNum(val, 0).toLocaleString()}`,
      sorter: (a, b) => safeNum(a.avg_cost) - safeNum(b.avg_cost),
    },
  ];

  // ======== 高成本资产表格列 ========
  const highCostAssetColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_, __, idx) => idx + 1,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      render: val => safeStr(val),
    },
    {
      title: '资产编码',
      dataIndex: 'asset_code',
      key: 'asset_code',
      render: val => safeStr(val),
    },
    {
      title: '维护次数',
      dataIndex: 'maintenance_count',
      key: 'maintenance_count',
      render: val => safeNum(val),
    },
    {
      title: '总成本',
      dataIndex: 'total_cost',
      key: 'total_cost',
      render: val => `¥${safeNum(val, 0).toLocaleString()}`,
      sorter: (a, b) => safeNum(a.total_cost) - safeNum(b.total_cost),
      defaultSortOrder: 'descend',
    },
    {
      title: '成本评级',
      key: 'cost_level',
      render: (_, record) => {
        const cost = safeNum(record.total_cost);
        if (cost >= 50000) return <Tag color="red">极高</Tag>;
        if (cost >= 20000) return <Tag color="orange">较高</Tag>;
        if (cost >= 5000) return <Tag color="blue">中等</Tag>;
        return <Tag color="green">较低</Tag>;
      },
    },
  ];

  // ======== 维护类型分布表格列 ========
  const typeDistributionColumns = [
    {
      title: '维护类型',
      dataIndex: 'maintenance_type',
      key: 'maintenance_type',
      render: val => <Tag color={getMaintenanceTypeColor(val)}>{safeStr(val)}</Tag>,
    },
    {
      title: '次数',
      dataIndex: 'count',
      key: 'count',
      render: val => safeNum(val),
      sorter: (a, b) => safeNum(a.count) - safeNum(b.count),
      defaultSortOrder: 'descend',
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: val => `${safeNum(val, 0).toFixed(1)}%`,
      sorter: (a, b) => safeNum(a.percentage) - safeNum(b.percentage),
    },
  ];

  // 渲染区块错误提示
  const renderSectionError = section => {
    const err = sectionErrors[section];
    if (!err) return null;
    return (
      <Alert
        message={err}
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        closable
        onClose={() => setSectionError(section, null)}
      />
    );
  };

  // 渲染区块加载状态
  const renderSectionLoading = (section, content) => {
    if (sectionLoading[section]) {
      return (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      );
    }
    return content;
  };

  return (
    <div className="maintenance-efficiency-dashboard" style={{ padding: 24 }}>
      {/* 页头：标题 + 日期筛选 + 刷新 + 导出 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ margin: 0 }}>维护效率分析仪表盘</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <RangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            placeholder={['开始日期', '结束日期']}
            presets={rangePresets}
            allowClear
            style={{ minWidth: 280 }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            刷新
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportReport}
            disabled={loading}
          >
            导出报告
          </Button>
        </div>
      </div>

      {/* 全局加载遮罩 */}
      <Spin spinning={loading}  description="加载数据中...">
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button icon={<PrinterOutlined />} onClick={handlePrintReport}>
            打印报表
          </Button>
        </div>
        {/* ======== 6个概览统计卡片 ======== */}
        {renderSectionLoading('overview',
          renderSectionError('overview') || (
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Card hoverable>
                  <Statistic
                    title="本月工单总数"
                    value={totalWorkOrders}
                    prefix={<BarChartOutlined />}
                    suffix="次"
                    styles={{ content: { color: '#1890ff' } }}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                    {workOrderTrend > 0 ? (
                      <span style={{ color: '#52c41a' }}>
                        <ArrowUpOutlined /> 较上期 +{workOrderTrend}
                      </span>
                    ) : workOrderTrend < 0 ? (
                      <span style={{ color: '#ff4d4f' }}>
                        <ArrowDownOutlined /> 较上期 {workOrderTrend}
                      </span>
                    ) : (
                      <span>与上期持平</span>
                    )}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Card hoverable>
                  <Statistic
                    title="平均完成时间"
                    value={avgCompletionTime}
                    precision={1}
                    prefix={<ClockCircleOutlined />}
                    suffix="小时"
                    styles={{ content: { color: '#722ed1' } }}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                    工单从创建到完成的平均耗时
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Card hoverable>
                  <Statistic
                    title="完成率"
                    value={completionRate}
                    precision={1}
                    prefix={<CheckCircleOutlined />}
                    suffix="%"
                    styles={{ content: { color: getCompletionColor(completionRate) } }}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                    {completionRate >= 90 ? '表现优秀' : completionRate >= 70 ? '尚有提升空间' : '需要重点关注'}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Card hoverable>
                  <Statistic
                    title="逾期工单"
                    value={overdueCount}
                    prefix={<ExclamationCircleOutlined />}
                    suffix="个"
                    styles={{ content: { color: overdueCount > 0 ? '#ff4d4f' : '#52c41a' } }}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                    {overdueCount > 0 ? '存在逾期工单，请及时处理' : '无逾期工单'}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Card hoverable>
                  <Statistic
                    title="总维护费用"
                    value={totalMaintenanceCost}
                    prefix={<DollarOutlined />}
                    suffix="元"
                    styles={{ content: { color: '#fa8c16' } }}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                    统计期间内的维护总成本
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Card hoverable>
                  <Statistic
                    title="平均响应时间"
                    value={avgResponseTime}
                    precision={1}
                    prefix={<ClockCircleOutlined />}
                    suffix="小时"
                    styles={{ content: { color: '#13c2c2' } }}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                    {avgResponseTime <= 2 ? '响应迅速' : avgResponseTime <= 8 ? '响应正常' : '响应偏慢，需改进'}
                  </div>
                </Card>
              </Col>
            </Row>
          )
        )}

        {/* ======== 成本分析 ======== */}
        <Card
          title={
            <span>
              <DollarOutlined style={{ marginRight: 8 }} />
              成本分析
            </span>
          }
          style={{ marginBottom: 24 }}
        >
          {renderSectionLoading(
            'costAnalysis',
            renderSectionError('costAnalysis') || (
              <>
                {/* 成本摘要卡片 */}
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col xs={24} sm={8}>
                    <Card>
                      <Statistic
                        title="总成本"
                        value={costTotal}
                        prefix={<DollarOutlined />}
                        suffix="元"
                        styles={{ content: { color: '#fa8c16' } }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card>
                      <Statistic
                        title="平均单次维护成本"
                        value={costAvg}
                        prefix={<DollarOutlined />}
                        suffix="元"
                        styles={{ content: { color: '#1890ff' } }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card>
                      <Statistic
                        title="成本趋势"
                        value={costTrendDirection > 0 ? '上升' : costTrendDirection < 0 ? '下降' : '持平'}
                        prefix={costTrendDirection > 0 ? <ArrowUpOutlined /> : costTrendDirection < 0 ? <ArrowDownOutlined /> : null}
                        styles={{ content: { color: costTrendDirection > 0 ? '#ff4d4f' : costTrendDirection < 0 ? '#52c41a' : '#999' } }}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* 成本分布表（按维护类型） */}
                {safeArr(costTrendData).length > 0 && (
                  <>
                    <h4 style={{ marginBottom: 16 }}>成本分布（按维护类型）</h4>
                    <div className="hide-on-mobile">
                      <Table
                        dataSource={safeArr(costTrendData)}
                        columns={costDistributionColumns}
                        rowKey="id"
                        pagination={false}
                        size="middle"
                        style={{ marginBottom: 24 }}
                      />
                    </div>
                    <div className="mobile-table-cards show-on-mobile" style={{ marginBottom: 24 }}>
                      {sectionLoading.costAnalysis ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                      ) : Array.isArray(costTrendData) && costTrendData.length > 0 ? (
                        costTrendData.map(record => (
                          <div key={record.maintenance_type} className="mobile-card-item">
                            <div className="mobile-card-header">
                              <span className="mobile-card-title">{safeStr(record.maintenance_type)}</span>
                              <Tag color={getMaintenanceTypeColor(record.maintenance_type)}>{safeStr(record.maintenance_type)}</Tag>
                            </div>
                            <div className="mobile-card-body">
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">次数</span>
                                <span className="mobile-card-value">{safeNum(record.count)}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">总成本</span>
                                <span className="mobile-card-value">¥{safeNum(record.total_cost, 0).toLocaleString()}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">平均成本</span>
                                <span className="mobile-card-value">¥{safeNum(record.avg_cost, 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <Empty description="暂无数据" />
                      )}
                    </div>
                  </>
                )}

                {/* 高成本资产表 */}
                {safeArr(costAnalysisData?.assetDistribution).length > 0 && (
                  <>
                    <h4 style={{ marginBottom: 16 }}>高成本资产</h4>
                    <div className="hide-on-mobile">
                      <Table
                        dataSource={safeArr(costAnalysisData?.assetDistribution)}
                        columns={highCostAssetColumns}
                        rowKey="id"
                        pagination={{ pageSize: 5, showSizeChanger: true, showTotal: total => `共 ${total} 条` }}
                        size="middle"
                      />
                    </div>
                    <div className="mobile-table-cards show-on-mobile">
                      {sectionLoading.costAnalysis ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                      ) : Array.isArray(costAnalysisData?.assetDistribution) && costAnalysisData.assetDistribution.length > 0 ? (
                        costAnalysisData.assetDistribution.map((record, idx) => {
                          const cost = safeNum(record.total_cost);
                          let costLevelTag;
                          if (cost >= 50000) costLevelTag = <Tag color="red">极高</Tag>;
                          else if (cost >= 20000) costLevelTag = <Tag color="orange">较高</Tag>;
                          else if (cost >= 5000) costLevelTag = <Tag color="blue">中等</Tag>;
                          else costLevelTag = <Tag color="green">较低</Tag>;
                          return (
                            <div key={record.asset_code || record.asset_name || idx} className="mobile-card-item">
                              <div className="mobile-card-header">
                                <span className="mobile-card-title">{safeStr(record.asset_name)}</span>
                                {costLevelTag}
                              </div>
                              <div className="mobile-card-body">
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">排名</span>
                                  <span className="mobile-card-value">{idx + 1}</span>
                                </div>
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">资产编码</span>
                                  <span className="mobile-card-value">{safeStr(record.asset_code)}</span>
                                </div>
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">维护次数</span>
                                  <span className="mobile-card-value">{safeNum(record.maintenance_count)}</span>
                                </div>
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">总成本</span>
                                  <span className="mobile-card-value">¥{safeNum(record.total_cost, 0).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <Empty description="暂无数据" />
                      )}
                    </div>
                  </>
                )}

                {safeArr(costTrendData).length === 0 && safeArr(costAnalysisData?.assetDistribution).length === 0 && !sectionErrors.costAnalysis && (
                  <Empty description="暂无成本分析数据" />
                )}
              </>
            )
          )}
        </Card>

        {/* ======== 维护类型分布 ======== */}
        <Card
          title={
            <span>
              <PieChartOutlined style={{ marginRight: 8 }} />
              维护类型分布
            </span>
          }
          style={{ marginBottom: 24 }}
        >
          {renderSectionLoading(
            'typeDistribution',
            renderSectionError('typeDistribution') ||
              (safeArr(typeDistributionData).length > 0 ? (
                <>
                  <div className="hide-on-mobile">
                    <Table
                      dataSource={safeArr(typeDistributionData)}
                      columns={typeDistributionColumns}
                      rowKey="id"
                      pagination={false}
                      size="middle"
                    />
                  </div>
                  <div className="mobile-table-cards show-on-mobile">
                    {sectionLoading.typeDistribution ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                    ) : Array.isArray(typeDistributionData) && typeDistributionData.length > 0 ? (
                      typeDistributionData.map(record => (
                        <div key={record.maintenance_type} className="mobile-card-item">
                          <div className="mobile-card-header">
                            <span className="mobile-card-title">{safeStr(record.maintenance_type)}</span>
                            <Tag color={getMaintenanceTypeColor(record.maintenance_type)}>{safeStr(record.maintenance_type)}</Tag>
                          </div>
                          <div className="mobile-card-body">
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">次数</span>
                              <span className="mobile-card-value">{safeNum(record.count)}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">占比</span>
                              <span className="mobile-card-value">{safeNum(record.percentage, 0).toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <Empty description="暂无数据" />
                    )}
                  </div>
                </>
              ) : (
                !sectionErrors.typeDistribution && <Empty description="暂无维护类型分布数据" />
              ))
          )}
        </Card>

        {/* ======== 响应时间分布 ======== */}
        <Card
          title={
            <span>
              <ClockCircleOutlined style={{ marginRight: 8 }} />
              响应时间分布
            </span>
          }
          style={{ marginBottom: 24 }}
        >
          {renderSectionLoading(
            'responseTime',
            renderSectionError('responseTime') ||
              (safeArr(responseTimeData).length > 0 ? (
                <>
                  <div className="hide-on-mobile">
                    <Table
                      dataSource={safeArr(responseTimeData)}
                      columns={responseTimeColumns}
                      rowKey="id"
                      pagination={{ pageSize: 10, showSizeChanger: true, showTotal: total => `共 ${total} 条` }}
                      size="middle"
                    />
                  </div>
                  <div className="mobile-table-cards show-on-mobile">
                    {sectionLoading.responseTime ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                    ) : Array.isArray(responseTimeData) && responseTimeData.length > 0 ? (
                      responseTimeData.map(record => {
                        const hours = safeNum(record.avg_response_hours, 999);
                        let responseLevelTag;
                        if (hours <= 2) responseLevelTag = <Tag color="green">快速</Tag>;
                        else if (hours <= 8) responseLevelTag = <Tag color="blue">正常</Tag>;
                        else if (hours <= 24) responseLevelTag = <Tag color="orange">较慢</Tag>;
                        else responseLevelTag = <Tag color="red">缓慢</Tag>;
                        return (
                          <div key={record.maintenance_date} className="mobile-card-item">
                            <div className="mobile-card-header">
                              <span className="mobile-card-title">{safeStr(record.maintenance_date)}</span>
                              {responseLevelTag}
                            </div>
                            <div className="mobile-card-body">
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">平均响应时间(小时)</span>
                                <span className="mobile-card-value">{safeNum(record.avg_response_hours, 0).toFixed(1)}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">维护次数</span>
                                <span className="mobile-card-value">{safeNum(record.maintenance_count)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <Empty description="暂无数据" />
                    )}
                  </div>
                </>
              ) : (
                !sectionErrors.responseTime && <Empty description="暂无响应时间数据" />
              ))
          )}
        </Card>

        {/* ======== 技术人员效率排名 ======== */}
        <Card
          title={
            <span>
              <TrophyOutlined style={{ marginRight: 8 }} />
              技术人员效率排名
            </span>
          }
          style={{ marginBottom: 24 }}
        >
          {renderSectionLoading(
            'technician',
            renderSectionError('technician') ||
              (safeArr(technicianData).length > 0 ? (
                <>
                  <div className="hide-on-mobile">
                    <Table
                      dataSource={safeArr(technicianData)}
                      columns={technicianColumns}
                      rowKey="id"
                      pagination={{ pageSize: 10, showSizeChanger: true, showTotal: total => `共 ${total} 条` }}
                      size="middle"
                    />
                  </div>
                  <div className="mobile-table-cards show-on-mobile">
                    {sectionLoading.technician ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                    ) : Array.isArray(technicianData) && technicianData.length > 0 ? (
                      technicianData.map((record, idx) => {
                        let rankTag;
                        if (idx === 0) rankTag = <Tag color="gold">1</Tag>;
                        else if (idx === 1) rankTag = <Tag color="#c0c0c0">2</Tag>;
                        else if (idx === 2) rankTag = <Tag color="#cd7f32">3</Tag>;
                        else rankTag = <Tag>{idx + 1}</Tag>;
                        const completionRate = safeNum(record.completion_rate, 0);
                        return (
                          <div key={record.technician || idx} className="mobile-card-item">
                            <div className="mobile-card-header">
                              <span className="mobile-card-title">{safeStr(record.technician)}</span>
                              {rankTag}
                            </div>
                            <div className="mobile-card-body">
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">维护次数</span>
                                <span className="mobile-card-value">{safeNum(record.maintenance_count)}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">完成次数</span>
                                <span className="mobile-card-value">{safeNum(record.completed_count)}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">完成率</span>
                                <span className="mobile-card-value" style={{ color: getCompletionColor(completionRate) }}>{completionRate.toFixed(1)}%</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">平均时间(小时)</span>
                                <span className="mobile-card-value">{safeNum(record.avg_maintenance_time, 0).toFixed(1)}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">总成本</span>
                                <span className="mobile-card-value">¥{safeNum(record.total_cost, 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <Empty description="暂无数据" />
                    )}
                  </div>
                </>
              ) : (
                !sectionErrors.technician && <Empty description="暂无技术人员数据" />
              ))
          )}
        </Card>

        {/* ======== 资产维护频率 Top 10 ======== */}
        <Card
          title={
            <span>
              <BarChartOutlined style={{ marginRight: 8 }} />
              资产维护频率（Top 10）
            </span>
          }
          style={{ marginBottom: 24 }}
        >
          {renderSectionLoading(
            'assetFrequency',
            renderSectionError('assetFrequency') ||
              (safeArr(assetFrequencyData).length > 0 ? (
                <>
                  <div className="hide-on-mobile">
                    <Table
                      dataSource={safeArr(assetFrequencyData)}
                      columns={assetFrequencyColumns}
                      rowKey="id"
                      pagination={{ pageSize: 10, showSizeChanger: true, showTotal: total => `共 ${total} 条` }}
                      size="middle"
                    />
                  </div>
                  <div className="mobile-table-cards show-on-mobile">
                    {sectionLoading.assetFrequency ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                    ) : Array.isArray(assetFrequencyData) && assetFrequencyData.length > 0 ? (
                      assetFrequencyData.map((record, idx) => {
                        const count = safeNum(record.maintenance_count);
                        let frequencyTag;
                        if (count >= 10) frequencyTag = <Tag color="red">高频</Tag>;
                        else if (count >= 5) frequencyTag = <Tag color="orange">中频</Tag>;
                        else frequencyTag = <Tag color="green">低频</Tag>;
                        return (
                          <div key={record.asset_code || record.asset_name || idx} className="mobile-card-item">
                            <div className="mobile-card-header">
                              <span className="mobile-card-title">{safeStr(record.asset_name)}</span>
                              {frequencyTag}
                            </div>
                            <div className="mobile-card-body">
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">排名</span>
                                <span className="mobile-card-value">{idx + 1}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">资产编码</span>
                                <span className="mobile-card-value">{safeStr(record.asset_code)}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">维护次数</span>
                                <span className="mobile-card-value">{safeNum(record.maintenance_count)}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">平均维护时间(小时)</span>
                                <span className="mobile-card-value">{safeNum(record.avg_maintenance_time, 0).toFixed(1)}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">总成本</span>
                                <span className="mobile-card-value">¥{safeNum(record.total_cost, 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <Empty description="暂无数据" />
                    )}
                  </div>
                </>
              ) : (
                !sectionErrors.assetFrequency && <Empty description="暂无资产维护频率数据" />
              ))
          )}
        </Card>
      </Spin>
    </div>
  );
};

export default MaintenanceEfficiencyDashboard;
