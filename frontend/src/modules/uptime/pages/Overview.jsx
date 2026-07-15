/**
 * 开机率概览分析页面
 */

import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Progress, Spin,
  Select, Button, Alert, Empty, Badge, Descriptions
} from 'antd';
import {
  DashboardOutlined, LineChartOutlined, PieChartOutlined,
  ClockCircleOutlined, WarningOutlined, TeamOutlined, DatabaseOutlined
} from '@ant-design/icons';
import { uptimeAPI } from '../../../utils/api';
import useIsMobile from '../../../hooks/useIsMobile';

const { Option } = Select;

const UptimeOverview = () => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    overall: { avg_rate: 0, total_assets: 0 },
    byDepartment: [],
    byCategory: [],
    trend: [],
    lowUptimeAssets: []
  });
  const [timeRange, setTimeRange] = useState('month');

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await uptimeAPI.getDashboard();
      if (response?.success && response.data) {
        setData(response.data);
      }
    } catch (error) {
      console.warn('加载数据失败:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getUptimeColor = (rate) => {
    if (rate >= 99) return '#52c41a';
    if (rate >= 95) return '#1890ff';
    if (rate >= 90) return '#faad14';
    return '#f5222d';
  };

  const getUptimeStatus = (rate) => {
    if (rate >= 99) return { text: '优秀', color: 'success' };
    if (rate >= 95) return { text: '良好', color: 'processing' };
    if (rate >= 90) return { text: '警告', color: 'warning' };
    return { text: '危险', color: 'error' };
  };

  const deptColumns = [
    { title: '科室', dataIndex: 'department', key: 'department' },
    {
      title: '设备数量',
      dataIndex: 'asset_count',
      key: 'asset_count',
      render: (v) => <Tag icon={<DatabaseOutlined />}>{v}台</Tag>
    },
    {
      title: '平均开机率',
      dataIndex: 'rate',
      key: 'rate',
      render: (v) => (
        <Progress
          percent={parseFloat(v).toFixed(1)}
          size="small"
          strokeColor={getUptimeColor(v)}
          style={{ width: 150 }}
        />
      ),
      sorter: (a, b) => a.rate - b.rate
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        const status = getUptimeStatus(record.rate);
        return <Badge status={status.color} text={status.text} />;
      }
    }
  ];

  const lowUptimeColumns = [
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code' },
    { title: '资产名称', dataIndex: 'asset_name', key: 'asset_name' },
    { title: '所属科室', dataIndex: 'department', key: 'department' },
    {
      title: '开机率',
      dataIndex: 'uptime_rate',
      key: 'uptime_rate',
      render: (v) => (
        <Progress
          percent={parseFloat(v).toFixed(1)}
          size="small"
          status="exception"
          style={{ width: 100 }}
        />
      )
    },
    {
      title: '停机原因',
      dataIndex: 'downtime_reason',
      key: 'downtime_reason',
      render: (v) => v || <span style={{ color: '#999' }}>未记录</span>
    }
  ];

  const avgRate = parseFloat(data.overall?.avg_rate || 0);
  const status = getUptimeStatus(avgRate);

  return (
    <div style={{ padding: 24 }}>
      <Spin spinning={loading}>
        {/* 头部统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="整体开机率"
                value={avgRate.toFixed(1)}
                suffix="%"
                styles={{ content: { color: getUptimeColor(avgRate), fontSize: 36 } }}
                prefix={<DashboardOutlined />}
              />
              <div style={{ marginTop: 8 }}>
                <Badge status={status.color} text={status.text} />
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="统计设备数"
                value={data.overall?.total_assets || 0}
                suffix="台"
                prefix={<DatabaseOutlined />}
              />
              <div style={{ marginTop: 8, color: '#8c8c8c' }}>
                覆盖所有重点设备
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="本月运行时长"
                value={data.overall?.total_running_hours || 0}
                suffix="小时"
                prefix={<ClockCircleOutlined />}
              />
              <div style={{ marginTop: 8, color: '#8c8c8c' }}>
                累计运行时间
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="低开机率设备"
                value={data.lowUptimeAssets?.length || 0}
                suffix="台"
                styles={{ content: { color: '#f5222d' } }}
                prefix={<WarningOutlined />}
              />
              <div style={{ marginTop: 8, color: '#8c8c8c' }}>
                需重点关注
              </div>
            </Card>
          </Col>
        </Row>

        {/* 警告提示 */}
        {data.lowUptimeAssets?.length > 0 && (
          <Alert title={`警告：有 ${data.lowUptimeAssets.length} 台设备开机率低于90%，建议立即检查维护！`}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            action={
              <Button size="small" type="primary">
                查看详情
              </Button>
            }
          />
        )}

        {/* 主体内容区域 */}
        <Row gutter={16}>
          {/* 左侧 - 科室开机率排名 */}
          <Col xs={24} lg={12}>
            <Card
              title={<span><TeamOutlined /> 科室开机率排名</span>}
              extra={
                <Select value={timeRange} onChange={setTimeRange} style={{ width: 120 }}>
                  <Option value="week">本周</Option>
                  <Option value="month">本月</Option>
                  <Option value="quarter">本季度</Option>
                  <Option value="year">本年度</Option>
                </Select>
              }
            >
              <div className="hide-on-mobile">
                <Table
                  columns={deptColumns}
                  dataSource={data.byDepartment}
                  rowKey="department"
                  pagination={false}
                  size="small"
                />
              </div>
              <div className="mobile-table-cards show-on-mobile">
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                ) : Array.isArray(data.byDepartment) && data.byDepartment.length > 0 ? (
                  data.byDepartment.map(record => {
                    const deptStatus = getUptimeStatus(record.rate);
                    return (
                      <div key={record.department} className="mobile-card-item">
                        <div className="mobile-card-header">
                          <span className="mobile-card-title">{record.department}</span>
                          <Tag color={deptStatus.color}>{deptStatus.text}</Tag>
                        </div>
                        <div className="mobile-card-body">
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">设备数量</span>
                            <span className="mobile-card-value">{record.asset_count}台</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">平均开机率</span>
                            <span className="mobile-card-value">
                              <Progress
                                percent={parseFloat(record.rate).toFixed(1)}
                                size="small"
                                strokeColor={getUptimeColor(record.rate)}
                              />
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

          {/* 右侧 - 开机率趋势 */}
          <Col xs={24} lg={12}>
            <Card title={<span><LineChartOutlined /> 开机率趋势 (近12个月)</span>}>
              <div style={{ padding: '20px 0' }}>
                {data.trend?.length > 0 ? (
                  <div>
                    {data.trend.map((item, index) => (
                      <div key={index} style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
                        <span style={{ width: 80, color: '#8c8c8c' }}>{item.period}</span>
                        <Progress
                          percent={parseFloat(item.rate).toFixed(1)}
                          size="small"
                          strokeColor={getUptimeColor(item.rate)}
                          style={{ flex: 1, marginRight: 16 }}
                        />
                        <span style={{ width: 60, textAlign: 'right', fontWeight: 'bold' }}>
                          {parseFloat(item.rate).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description="暂无趋势数据" />
                )}
              </div>
            </Card>
          </Col>
        </Row>

        {/* 低开机率设备 */}
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <Card title={<span><WarningOutlined /> 低开机率设备 (需要关注)</span>}>
              {data.lowUptimeAssets?.length > 0 ? (
                <>
                  <div className="hide-on-mobile">
                    <Table
                      columns={lowUptimeColumns}
                      dataSource={data.lowUptimeAssets}
                      rowKey="asset_id"
                      pagination={{ pageSize: 5 }}
                      size="small"
                    />
                  </div>
                  <div className="mobile-table-cards show-on-mobile">
                    {data.lowUptimeAssets.map(record => (
                      <div key={record.asset_code || record.asset_id} className="mobile-card-item">
                        <div className="mobile-card-header">
                          <span className="mobile-card-title">{record.asset_name}</span>
                          <Tag color="error">{parseFloat(record.uptime_rate).toFixed(1)}%</Tag>
                        </div>
                        <div className="mobile-card-body">
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">资产编号</span>
                            <span className="mobile-card-value">{record.asset_code}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">所属科室</span>
                            <span className="mobile-card-value">{record.department}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">开机率</span>
                            <span className="mobile-card-value">
                              <Progress
                                percent={parseFloat(record.uptime_rate).toFixed(1)}
                                size="small"
                                status="exception"
                              />
                            </span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">停机原因</span>
                            <span className="mobile-card-value">{record.downtime_reason || <span style={{ color: '#999' }}>未记录</span>}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Empty description="暂无低开机率设备" />
              )}
            </Card>
          </Col>
        </Row>

        {/* 分类统计 */}
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <Card title={<span><PieChartOutlined /> 设备分类开机率</span>}>
              <Row gutter={16}>
                {data.byCategory?.map((cat, index) => (
                  <Col xs={12} sm={6} key={index}>
                    <Card size="small" style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, color: '#8c8c8c', marginBottom: 8 }}>{cat.category}</div>
                      <Progress
                        type="dashboard"
                        percent={parseFloat(cat.rate).toFixed(1)}
                        size={80}
                        strokeColor={getUptimeColor(cat.rate)}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Tag>{cat.asset_count}台设备</Tag>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        </Row>

        {/* 底部说明 */}
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <Card title="开机率标准说明">
              <Descriptions bordered column={isMobile ? 1 : 4} size="small">
                <Descriptions.Item label="优秀">
                  <Tag color="success">≥99%</Tag>
                  <span style={{ marginLeft: 8, color: '#8c8c8c' }}>生命支持类设备标准</span>
                </Descriptions.Item>
                <Descriptions.Item label="良好">
                  <Tag color="processing">≥95%</Tag>
                  <span style={{ marginLeft: 8, color: '#8c8c8c' }}>大型设备标准</span>
                </Descriptions.Item>
                <Descriptions.Item label="警告">
                  <Tag color="warning">≥90%</Tag>
                  <span style={{ marginLeft: 8, color: '#8c8c8c' }}>需关注</span>
                </Descriptions.Item>
                <Descriptions.Item label="危险">
                  <Tag color="error">&lt;90%</Tag>
                  <span style={{ marginLeft: 8, color: '#8c8c8c' }}>需立即处理</span>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default UptimeOverview;
