import { useState, useEffect, useCallback, useMemo } from 'react';
import { Typography, DatePicker, message, Spin, Card, Button } from 'antd';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  ReloadOutlined,
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import { qualityControlAPI } from '../../utils/api';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const StatisticsPage = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [metrologyStats, setMetrologyStats] = useState(null);
  const [qualityControlStats, setQualityControlStats] = useState(null);
  const [activeTab, setActiveTab] = useState('metrology');
  const useSimulatedData = false;

  const simulatedMetrologyData = useMemo(
    () => ({
      total: 128,
      totalCost: 35600,
      successRate: 96.8,
      avgCost: 278.13,
      qualifiedCount: 124,
      unqualifiedCount: 4,
      pendingCount: 0,
      byType: {
        强制检定: 45,
        周期检定: 58,
        校准: 25,
      },
      byResult: {
        合格: 124,
        不合格: 4,
      },
      byMonth: {
        '2024-01': 8,
        '2024-02': 12,
        '2024-03': 15,
        '2024-04': 18,
        '2024-05': 22,
        '2024-06': 18,
        '2024-07': 12,
        '2024-08': 10,
        '2024-09': 8,
        '2024-10': 5,
      },
      byDepartment: {
        放射科: 35,
        检验科: 28,
        心内科: 22,
        手术室: 18,
        超声科: 15,
        急诊科: 10,
      },
      byStatus: {
        已完成: 98,
        进行中: 18,
        待检: 12,
      },
    }),
    []
  );

  const simulatedQualityControlData = useMemo(
    () => ({
      total: 256,
      successRate: 94.5,
      avgPassRate: 96.2,
      qualifiedCount: 242,
      unqualifiedCount: 14,
      pendingCount: 0,
      byType: {
        日常巡检: 120,
        定期检测: 86,
        专项检查: 50,
      },
      byResult: {
        合格: 242,
        不合格: 14,
      },
      byMonth: {
        '2024-01': 18,
        '2024-02': 22,
        '2024-03': 28,
        '2024-04': 25,
        '2024-05': 30,
        '2024-06': 26,
        '2024-07': 22,
        '2024-08': 20,
        '2024-09': 18,
        '2024-10': 15,
      },
      byDepartment: {
        检验科: 68,
        放射科: 52,
        药剂科: 45,
        心内科: 38,
        手术室: 32,
        急诊科: 21,
      },
      byStatus: {
        已通过: 220,
        进行中: 22,
        未通过: 14,
      },
    }),
    []
  );

  const pieColors = ['#722ed1', '#13c2c2', '#fa8c16', '#52c41a', '#1890ff', '#eb2f96'];

  const loadStatistics = useCallback(async () => {
    setLoading(true);
    try {
      if (useSimulatedData) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setMetrologyStats(simulatedMetrologyData);
        setQualityControlStats(simulatedQualityControlData);
        return;
      }

      const startDate = dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined;
      const endDate = dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined;

      const metrologyResponse = await qualityControlAPI.getMetrologyStatistics({
        start_date: startDate,
        end_date: endDate,
      });

      if (metrologyResponse.success) {
        const data = metrologyResponse.data;
        // avgCost 后端未直接返回，由 totalCost / total 推算
        if (data.total > 0 && data.avgCost === undefined) {
          data.avgCost = Math.round((data.totalCost || 0) / data.total * 100) / 100;
        }
        setMetrologyStats(data);
      } else {
        message.error('获取计量统计数据失败');
      }

      const qualityControlResponse = await qualityControlAPI.getQualityControlStatistics({
        start_date: startDate,
        end_date: endDate,
      });

      if (qualityControlResponse.success) {
        setQualityControlStats(qualityControlResponse.data);
      } else {
        message.error('获取质量控制统计数据失败');
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
      message.error('获取统计数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [dateRange, useSimulatedData, simulatedMetrologyData, simulatedQualityControlData]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  const handleDateRangeChange = dates => {
    setDateRange(dates);
  };

  const handleSearch = () => {
    loadStatistics();
  };

  const renderStatCard = (title, value, color, suffix = '') => (
    <Card
      className="hover:shadow-lg transition-all duration-300 border-0 shadow-md"
      style={{ borderRadius: '12px' }}
    >
      <div className="text-center">
        <Text className="text-gray-500 text-sm block">{title}</Text>
        <div className="text-3xl font-bold mt-2" style={{ color }}>
          {value}
          {suffix}
        </div>
      </div>
    </Card>
  );

  const renderPieChart = (data, title, colors) => {
    const chartData = Object.entries(data || {}).map(([name, count]) => ({
      name,
      count,
    }));

    return (
      <Card
        className="hover:shadow-lg transition-all duration-300 border-0 shadow-md"
        style={{ borderRadius: '12px' }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#722ed115' }}
          >
            <PieChartOutlined style={{ fontSize: '20px', color: '#722ed1' }} />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 m-0">{title}</h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="count"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={value => [`${value} 次`, '数量']}
                contentStyle={{
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    );
  };

  const renderBarChart = (data, title, color) => {
    const chartData = Object.entries(data || {})
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return (
      <Card
        className="hover:shadow-lg transition-all duration-300 border-0 shadow-md"
        style={{ borderRadius: '12px' }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <BarChartOutlined style={{ fontSize: '20px', color }} />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 m-0">{title}</h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                horizontal={true}
                vertical={false}
              />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                dataKey="name"
                type="category"
                width={80}
                tick={{ fontSize: 12 }}
                interval={0}
              />
              <Tooltip
                formatter={value => [`${value} 次`, '数量']}
                contentStyle={{
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Bar dataKey="count" fill={color} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    );
  };

  const renderLineChart = (data, title, color) => {
    const chartData = Object.entries(data || {})
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return (
      <Card
        className="hover:shadow-lg transition-all duration-300 border-0 shadow-md"
        style={{ borderRadius: '12px' }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <LineChartOutlined style={{ fontSize: '20px', color }} />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 m-0">{title}</h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={value => [`${value} 次`, '数量']}
                contentStyle={{
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={color}
                strokeWidth={3}
                fill={`url(#gradient-${title})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    );
  };

  const renderMetrologyCharts = () => {
    if (!metrologyStats) return <Spin className="py-20" />;

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {renderStatCard('总计量次数', metrologyStats.total || 0, '#722ed1')}
          {renderStatCard('总费用', metrologyStats.totalCost || 0, '#52c41a', '元')}
          {renderStatCard('合格率', metrologyStats.successRate || 0, '#1890ff', '%')}
          {renderStatCard('平均费用', metrologyStats.avgCost || 0, '#fa8c16', '元')}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {renderPieChart(metrologyStats.byType, '计量类型分布', pieColors)}
          {renderPieChart(metrologyStats.byResult, '计量结果分布', ['#52c41a', '#ff4d4f'])}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {renderLineChart(metrologyStats.byMonth, '月度计量趋势', '#722ed1')}
          {renderBarChart(metrologyStats.byDepartment, '部门计量分布', '#722ed1')}
        </div>

        {renderPieChart(metrologyStats.byStatus, '计量状态分布', ['#52c41a', '#1890ff', '#faad14'])}
      </div>
    );
  };

  const renderQualityControlCharts = () => {
    if (!qualityControlStats) return <Spin className="py-20" />;

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {renderStatCard('总质检次数', qualityControlStats.total || 0, '#fa8c16')}
          {renderStatCard('合格率', qualityControlStats.successRate || 0, '#52c41a', '%')}
          {renderStatCard('合格数', qualityControlStats.qualifiedCount || 0, '#13c2c2')}
          {renderStatCard('不合格数', qualityControlStats.unqualifiedCount || 0, '#ff4d4f')}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {renderPieChart(qualityControlStats.byType, '质检类型分布', pieColors)}
          {renderPieChart(qualityControlStats.byResult, '质检结果分布', ['#52c41a', '#ff4d4f'])}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {renderLineChart(qualityControlStats.byMonth, '月度质检趋势', '#fa8c16')}
          {renderBarChart(qualityControlStats.byDepartment, '部门质检分布', '#fa8c16')}
        </div>

        {renderPieChart(qualityControlStats.byStatus, '质检状态分布', [
          '#52c41a',
          '#1890ff',
          '#ff4d4f',
        ])}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-3 sm:px-4 lg:px-6">
      <Card
        className="max-w-7xl mx-auto shadow-lg overflow-hidden"
        style={{ borderRadius: '16px' }}
      >
        <div
          className="p-4 sm:p-6 md:p-8"
          style={{
            background: 'linear-gradient(135deg, #722ed1 0%, #531dab 50%, #391085 100%)',
            borderRadius: '16px 16px 0 0',
          }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
            <div>
              <Title level={4} sm={3} className="text-white mb-1" style={{ color: '#fff' }}>
                质量管理统计分析
              </Title>
              <Text className="text-purple-100 text-sm sm:text-base">
                全方位分析质量管理数据，为决策提供数据支持
              </Text>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full md:w-auto">
              <RangePicker
                value={dateRange}
                onChange={handleDateRangeChange}
                className="bg-white bg-opacity-20 border-white text-white w-full sm:w-auto"
                style={{ borderRadius: '8px' }}
                size="small"
              />
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={handleSearch}
                loading={loading}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '8px',
                }}
                size="small"
              >
                刷新数据
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-6 sm:mb-8">
            <div
              className="flex gap-2 p-2 bg-gray-100 rounded-xl flex-wrap"
              style={{ width: 'fit-content' }}
            >
              <Button
                type={activeTab === 'metrology' ? 'primary' : 'default'}
                onClick={() => setActiveTab('metrology')}
                icon={<BarChartOutlined />}
                style={{
                  borderRadius: '8px',
                  padding: '6px 16px sm:6px sm:24px',
                  height: 'auto',
                  fontSize: '14px sm:15px',
                }}
                size="small"
              >
                计量统计
              </Button>
              <Button
                type={activeTab === 'qualityControl' ? 'primary' : 'default'}
                onClick={() => setActiveTab('qualityControl')}
                icon={<LineChartOutlined />}
                style={{
                  borderRadius: '8px',
                  padding: '6px 16px sm:6px sm:24px',
                  height: 'auto',
                  fontSize: '14px sm:15px',
                }}
                size="small"
              >
                质量控制统计
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Spin size="large" />
              <div className="mt-4 text-gray-500">正在加载统计数据...</div>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {activeTab === 'metrology' ? renderMetrologyCharts() : renderQualityControlCharts()}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default StatisticsPage;
