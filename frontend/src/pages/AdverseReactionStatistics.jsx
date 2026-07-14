import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  Button,
  Table,
  Tag,
  message,
  Spin,
  Empty,
} from 'antd';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { ReloadOutlined, ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adverseReactionAPI } from '../utils/api';
import { printAdverseReactionReport } from '../utils/printReport';
import dayjs from 'dayjs';
import useIsMobile from '../hooks/useIsMobile';

const { RangePicker } = DatePicker;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const AdverseReactionStatistics = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);
  const [statistics, setStatistics] = useState({
    total: {},
    byType: [],
    bySeverity: [],
    byLevel: [],
    monthly: [],
  });
  const [departmentStats, setDepartmentStats] = useState([]);
  const [assetStats, setAssetStats] = useState([]);
  const [efficiencyStats, setEfficiencyStats] = useState({});

  const loadStatistics = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        start_date: dateRange[0]?.format('YYYY-MM-DD'),
        end_date: dateRange[1]?.format('YYYY-MM-DD'),
      };

      const [overview, byDept, byAsset, efficiency] = await Promise.all([
        adverseReactionAPI.getStatistics(params),
        adverseReactionAPI.getStatisticsByDepartment(params),
        adverseReactionAPI.getStatisticsByAsset({ ...params, limit: 10 }),
        adverseReactionAPI.getHandleEfficiency(params),
      ]);

      if (overview.success) {
        setStatistics(overview.data);
      }
      if (byDept.success) {
        setDepartmentStats(byDept.data);
      }
      if (byAsset.success) {
        setAssetStats(byAsset.data);
      }
      if (efficiency.success) {
        setEfficiencyStats(efficiency.data);
      }
    } catch (_error) {
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  const handlePrintReport = () => {
    printAdverseReactionReport(statistics, efficiencyStats, departmentStats, assetStats);
  };

  const departmentColumns = [
    { title: '科室', dataIndex: 'department', key: 'department' },
    { title: '事件总数', dataIndex: 'count', key: 'count' },
    {
      title: '严重事件',
      dataIndex: 'serious_count',
      key: 'serious_count',
      render: (text, record) => (
        <Tag color={record.serious_count > 0 ? 'red' : 'default'}>
          {text || 0}
        </Tag>
      ),
    },
    { title: '待处理', dataIndex: 'pending_count', key: 'pending_count' },
    { title: '已处理', dataIndex: 'handled_count', key: 'handled_count' },
  ];

  const assetColumns = [
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code' },
    { title: '资产名称', dataIndex: 'asset_name', key: 'asset_name' },
    { title: '事件次数', dataIndex: 'count', key: 'count' },
    {
      title: '严重事件',
      dataIndex: 'serious_count',
      key: 'serious_count',
      render: (text) => (
        <Tag color={text > 0 ? 'red' : 'default'}>{text || 0}</Tag>
      ),
    },
    {
      title: '最近发生',
      dataIndex: 'last_occurrence',
      key: 'last_occurrence',
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div
          style={{
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/adverse-reaction')}>
              返回列表
            </Button>
            <h2 style={{ margin: 0 }}>不良事件统计报表</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
              style={{ width: 300 }}
            />
            <Button icon={<ReloadOutlined />} onClick={loadStatistics}>
              刷新
            </Button>
          </div>
        </div>

        <Spin spinning={loading}>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button icon={<PrinterOutlined />} onClick={handlePrintReport}>
              打印报表
            </Button>
          </div>
          {/* 总体统计 */}
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col xs={24} sm={12} md={4}>
              <Card>
                <Statistic
                  title="事件总数"
                  value={statistics.total?.total_count || 0}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Card>
                <Statistic
                  title="严重事件"
                  value={statistics.total?.serious_count || 0}
                  styles={{ content: { color: '#cf1322' } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Card>
                <Statistic
                  title="待处理"
                  value={statistics.total?.pending_count || 0}
                  styles={{ content: { color: '#faad14' } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Card>
                <Statistic
                  title="处理中"
                  value={statistics.total?.processing_count || 0}
                  styles={{ content: { color: '#1890ff' } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Card>
                <Statistic
                  title="已处理"
                  value={statistics.total?.handled_count || 0}
                  styles={{ content: { color: '#52c41a' } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Card>
                <Statistic
                  title="已关闭"
                  value={statistics.total?.closed_count || 0}
                />
              </Card>
            </Col>
          </Row>

          {/* 处理时效 */}
          {efficiencyStats && (
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col xs={24} md={6}>
                <Card title="处理时效分析">
                  <Statistic
                    title="平均处理时长"
                    value={Math.round(efficiencyStats.avg_handle_hours || 0)}
                    suffix="小时"
                  />
                  <Statistic
                    title="已处理总数"
                    value={efficiencyStats.total_handled || 0}
                    style={{ marginTop: '16px' }}
                  />
                  <Statistic
                    title="超时处理数"
                    value={efficiencyStats.overdue_count || 0}
                    styles={{ content: { color: '#cf1322' } }}
                    style={{ marginTop: '16px' }}
                  />
                </Card>
              </Col>
              <Col xs={24} md={18}>
                <Card title="按类型统计">
                  <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={300}>
                    <BarChart data={statistics.byType}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="report_type" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name="事件数量" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          )}

          {/* 图表区域 */}
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col xs={24} md={12}>
              <Card title="按严重程度分布">
                <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={300}>
                  <PieChart>
                    <Pie
                      data={statistics.bySeverity}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="severity"
                    >
                      {statistics.bySeverity.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="按事件等级分布">
                <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={300}>
                  <PieChart>
                    <Pie
                      data={statistics.byLevel}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="event_level"
                    >
                      {statistics.byLevel.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {/* 月度趋势 */}
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col xs={24}>
              <Card title="月度趋势">
                <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={300}>
                  <LineChart data={[...statistics.monthly].reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="事件数量"
                      stroke="#8884d8"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {/* 表格区域 */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Card title="科室统计 TOP 10">
                <div className="hide-on-mobile">
                  <Table
                    dataSource={departmentStats.slice(0, 10)}
                    columns={departmentColumns}
                    rowKey="department"
                    pagination={false}
                    size="small"
                  />
                </div>
                <div className="mobile-table-cards show-on-mobile">
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                  ) : Array.isArray(departmentStats) && departmentStats.length > 0 ? (
                    departmentStats.slice(0, 10).map((record, index) => (
                      <div key={record.department || index} className="mobile-card-item">
                        <div className="mobile-card-header">
                          <span className="mobile-card-title">{record.department || '-'}</span>
                          <Tag color={record.serious_count > 0 ? 'red' : 'default'}>
                            严重 {record.serious_count || 0}
                          </Tag>
                        </div>
                        <div className="mobile-card-body">
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">事件总数</span>
                            <span className="mobile-card-value" style={{ fontWeight: 600 }}>{record.count || 0}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">严重事件</span>
                            <span className="mobile-card-value">
                              <Tag color={record.serious_count > 0 ? 'red' : 'default'}>
                                {record.serious_count || 0}
                              </Tag>
                            </span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">待处理</span>
                            <span className="mobile-card-value">{record.pending_count || 0}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">已处理</span>
                            <span className="mobile-card-value">{record.handled_count || 0}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty description="暂无数据" />
                  )}
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="问题资产 TOP 10">
                <div className="hide-on-mobile">
                  <Table
                    dataSource={assetStats}
                    columns={assetColumns}
                    rowKey="asset_id"
                    pagination={false}
                    size="small"
                  />
                </div>
                <div className="mobile-table-cards show-on-mobile">
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                  ) : Array.isArray(assetStats) && assetStats.length > 0 ? (
                    assetStats.map((record, index) => (
                      <div key={record.asset_id || record.asset_code || index} className="mobile-card-item">
                        <div className="mobile-card-header">
                          <span className="mobile-card-title">{record.asset_name || record.asset_code || '-'}</span>
                          <Tag color={record.serious_count > 0 ? 'red' : 'default'}>
                            严重 {record.serious_count || 0}
                          </Tag>
                        </div>
                        <div className="mobile-card-body">
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">资产编号</span>
                            <span className="mobile-card-value">{record.asset_code || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">事件次数</span>
                            <span className="mobile-card-value" style={{ fontWeight: 600 }}>{record.count || 0}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">严重事件</span>
                            <span className="mobile-card-value">
                              <Tag color={record.serious_count > 0 ? 'red' : 'default'}>
                                {record.serious_count || 0}
                              </Tag>
                            </span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">最近发生</span>
                            <span className="mobile-card-value">
                              {record.last_occurrence ? dayjs(record.last_occurrence).format('YYYY-MM-DD') : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty description="暂无数据" />
                  )}
                </div>
              </Card>
            </Col>
          </Row>
        </Spin>
      </Card>
    </div>
  );
};

export default AdverseReactionStatistics;
