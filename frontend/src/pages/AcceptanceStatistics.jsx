import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Progress,
  DatePicker,
  Button,
  Space,
  Spin,
  message,
  Typography,
  Empty,
} from 'antd';

import {
  ReloadOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  AuditOutlined,
  ProfileOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../utils/api';
import { printAcceptanceStatisticsReport } from '../utils/printReport';
import useIsMobile from '../hooks/useIsMobile';

const { RangePicker } = DatePicker;
const { Title } = Typography;

const statusColorMap = {
  草稿: 'default',
  待审批: 'orange',
  审批中: 'blue',
  已批准: 'green',
  已拒绝: 'red',
  已撤回: 'default',
  已完成: 'cyan',
  待验收: 'blue',
  验收中: 'orange',
  已验收: 'green',
  验收不合格: 'red',
};

const AcceptanceStatistics = () => {
  const isMobile = useIsMobile();
  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange && dateRange.length === 2) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      const [overviewResp, trendResp] = await Promise.all([
        api.get('/acceptance-management/statistics/overview', { params }),
        api.get('/acceptance-management/statistics/trend', { params: { months: 12, ...params } }),
      ]);
      if (overviewResp.success) {
        setOverview(overviewResp.data || {});
      } else {
        message.error(overviewResp.message || '获取统计概览失败');
      }
      if (trendResp.success) {
        const list = Array.isArray(trendResp.data) ? trendResp.data : trendResp.data?.data || [];
        setTrend(list);
      } else {
        message.error(trendResp.message || '获取趋势数据失败');
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 后端 /acceptance-management/statistics/overview 返回结构为嵌套：
  // { records:{ total, statusDistribution, departmentDistribution }, applications:{ total, statusDistribution }, passRate, templateCount }
  const statusDistribution = overview?.records?.statusDistribution || overview?.statusDistribution || [];
  const departmentDistribution = overview?.records?.departmentDistribution || overview?.departmentDistribution || [];
  const passRate = overview?.passRate ?? overview?.pass_rate;
  const totalRecords = overview?.records?.total ?? overview?.totalRecords ?? overview?.total_records ?? 0;
  const totalApplications = overview?.applications?.total ?? overview?.totalApplications ?? overview?.total_applications ?? 0;
  const templateCount = overview?.templateCount ?? overview?.template_count ?? 0;

  const handlePrintReport = () => {
    printAcceptanceStatisticsReport(overview, statusDistribution, departmentDistribution, trend);
  };

  const statusColumns = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: text => <Tag color={statusColorMap[text] || 'default'}>{text || '-'}</Tag>,
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      render: val => <span style={{ fontWeight: 600 }}>{val || 0}</span>,
    },
  ];

  const deptColumns = [
    {
      title: '科室',
      dataIndex: 'department',
      key: 'department',
      render: text => text || '-',
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      width: 80,
    },
    {
      title: '占比',
      key: 'percent',
      width: 220,
      render: (_, record) => {
        const total = departmentDistribution.reduce((sum, item) => sum + (item.count || 0), 0) || 1;
        const percent = Math.round(((record.count || 0) / total) * 100);
        return <Progress percent={percent} size="small" />;
      },
    },
  ];

  const trendColumns = [
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      width: 120,
      render: text => text || '-',
    },
    {
      title: '总数',
      dataIndex: 'total',
      key: 'total',
      width: 100,
      render: val => <span style={{ fontWeight: 600 }}>{val || 0}</span>,
    },
    {
      title: '合格',
      dataIndex: 'passed',
      key: 'passed',
      width: 100,
      render: val => <Tag color="green">{val || 0}</Tag>,
    },
    {
      title: '不合格',
      dataIndex: 'failed',
      key: 'failed',
      width: 100,
      render: val => val ? <Tag color="red">{val}</Tag> : <Tag color="default">0</Tag>,
    },
    {
      title: '合格率',
      key: 'passRate',
      width: 200,
      render: (_, record) => {
        const total = record.total || 0;
        const passed = record.passed || 0;
        const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
        return <Progress percent={rate} size="small" status={rate >= 80 ? 'success' : 'exception'} />;
      },
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Spin spinning={loading}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2} style={{ margin: 0 }}>验收统计仪表盘</Title>
          <Space>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder={['开始日期', '结束日期']}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          </Space>
        </div>

        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button icon={<PrinterOutlined />} onClick={handlePrintReport}>
            打印报表
          </Button>
        </div>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="验收记录总数"
                value={totalRecords}
                prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="验收申请总数"
                value={totalApplications}
                prefix={<AuditOutlined style={{ color: '#722ed1' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="合格率"
                value={passRate != null ? Number((passRate * 100).toFixed(1)) : 0}
                suffix="%"
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="模板数量"
                value={templateCount}
                prefix={<ProfileOutlined style={{ color: '#fa8c16' }} />}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Card title="验收状态分布" size="small">
              <div className="hide-on-mobile">
                <Table
                  dataSource={statusDistribution}
                  columns={statusColumns}
                  rowKey="status"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '暂无数据' }}
                />
              </div>
              <div className="mobile-table-cards show-on-mobile">
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                ) : Array.isArray(statusDistribution) && statusDistribution.length > 0 ? (
                  statusDistribution.map((record, index) => {
                    const total = statusDistribution.reduce((sum, item) => sum + (item.count || 0), 0) || 1;
                    const percent = Math.round(((record.count || 0) / total) * 100);
                    return (
                      <div key={record.status || index} className="mobile-card-item">
                        <div className="mobile-card-header">
                          <span className="mobile-card-title">{record.status || '-'}</span>
                          <Tag color={statusColorMap[record.status] || 'default'}>{record.status || '-'}</Tag>
                        </div>
                        <div className="mobile-card-body">
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">数量</span>
                            <span className="mobile-card-value" style={{ fontWeight: 600 }}>{record.count || 0}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">占比</span>
                            <span className="mobile-card-value">{percent}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <Empty description="暂无数据" />
                )}
              </div>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="部门分布 TOP 10" size="small">
              <div className="hide-on-mobile">
                <Table
                  dataSource={departmentDistribution.slice(0, 10)}
                  columns={deptColumns}
                  rowKey="department"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '暂无数据' }}
                />
              </div>
              <div className="mobile-table-cards show-on-mobile">
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                ) : Array.isArray(departmentDistribution) && departmentDistribution.length > 0 ? (
                  departmentDistribution.slice(0, 10).map((record, index) => {
                    const total = departmentDistribution.reduce((sum, item) => sum + (item.count || 0), 0) || 1;
                    const percent = Math.round(((record.count || 0) / total) * 100);
                    return (
                      <div key={record.department || index} className="mobile-card-item">
                        <div className="mobile-card-header">
                          <span className="mobile-card-title">{record.department || '-'}</span>
                          <Tag color="blue">数量 {record.count || 0}</Tag>
                        </div>
                        <div className="mobile-card-body">
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">数量</span>
                            <span className="mobile-card-value">{record.count || 0}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">占比</span>
                            <span className="mobile-card-value">
                              <Progress percent={percent} size="small" />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <Empty description="暂无数据" />
                )}
              </div>
            </Card>
          </Col>
        </Row>

        <Card title="验收趋势（近 12 个月）" size="small">
          <div className="hide-on-mobile">
            <Table
              dataSource={trend}
              columns={trendColumns}
              rowKey="month"
              pagination={false}
              size="small"
              locale={{ emptyText: '暂无数据' }}
            />
          </div>
          <div className="mobile-table-cards show-on-mobile">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
            ) : Array.isArray(trend) && trend.length > 0 ? (
              trend.map((record, index) => {
                const total = record.total || 0;
                const passed = record.passed || 0;
                const failed = record.failed || 0;
                const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
                return (
                  <div key={record.month || index} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{record.month || '-'}</span>
                      <Tag color={rate >= 80 ? 'green' : 'red'}>合格率 {rate}%</Tag>
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">总数</span>
                        <span className="mobile-card-value" style={{ fontWeight: 600 }}>{total}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">合格</span>
                        <span className="mobile-card-value"><Tag color="green">{passed}</Tag></span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">不合格</span>
                        <span className="mobile-card-value">{failed ? <Tag color="red">{failed}</Tag> : <Tag color="default">0</Tag>}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">合格率</span>
                        <span className="mobile-card-value">
                          <Progress percent={rate} size="small" status={rate >= 80 ? 'success' : 'exception'} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <Empty description="暂无数据" />
            )}
          </div>
        </Card>
      </Spin>
    </div>
  );
};

export default AcceptanceStatistics;
