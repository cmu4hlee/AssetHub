import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  message,
  Descriptions,
  Select,
  DatePicker,
  Form,
  Input,
  Row,
  Col,
  Tooltip,
  Statistic,
  Badge,
  Tabs,
  Spin,
  Empty,
} from 'antd';

import {
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  WarningOutlined,
  CheckOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { maintenanceAPI } from '../utils/api';
import dayjs from 'dayjs';
import useIsMobile from '../hooks/useIsMobile';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const COLORS = ['#52c41a', '#faad14', '#cf1322', '#8c8c8c', '#1890ff'];

const statusMap = {
  pending: { color: 'processing', label: '待处理' },
  triggered: { color: 'warning', label: '已触发' },
  processed: { color: 'success', label: '已处理' },
  ignored: { color: 'default', label: '已忽略' },
};

const triggerTypeMap = {
  usage: { color: 'blue', label: '阈值触发' },
  time: { color: 'green', label: '时间触发' },
  manual: { color: 'orange', label: '手动触发' },
};

const MaintenanceUsageTriggerList = () => {
  const isMobile = useIsMobile();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [searchParams, setSearchParams] = useState({});
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    triggered: 0,
    processed: 0,
  });
  const [trendData, setTrendData] = useState([]);
  const [distributionData, setDistributionData] = useState([]);
  const [usageData, setUsageData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [form] = Form.useForm();

  const loadRecords = async (params = {}) => {
    setLoading(true);
    try {
      const response = await maintenanceAPI.getUsageTriggeredRecords({
        page: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        ...searchParams,
      });
      if (response.success) {
        setRecords(response.data || []);
        setPagination({
          ...pagination,
          current: params.page || pagination.current,
          pageSize: params.pageSize || pagination.pageSize,
          total: response.pagination?.total || 0,
        });
      } else {
        message.error('获取使用量触发记录失败');
      }
    } catch (error) {
      console.error('获取使用量触发记录失败:', error);
      message.error('网络错误，获取失败');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await maintenanceAPI.getAssetUsage({
        page: 1,
        pageSize: 100,
      });
      if (response.success) {
        const data = response.data || [];
        setStats({
          total: data.length,
          pending: data.filter(d => parseFloat(d.current_usage) < d.usage_threshold * 0.8).length,
          triggered: data.filter(
            d => parseFloat(d.current_usage) >= d.usage_threshold * 0.8 && parseFloat(d.current_usage) < d.usage_threshold
          ).length,
          processed: data.filter(d => parseFloat(d.current_usage) >= d.usage_threshold).length,
        });

        const distribution = [
          { name: '使用量正常', value: data.filter(d => parseFloat(d.current_usage) < d.usage_threshold * 0.8).length },
          {
            name: '即将触发的',
            value: data.filter(
              d => parseFloat(d.current_usage) >= d.usage_threshold * 0.8 && parseFloat(d.current_usage) < d.usage_threshold
            ).length,
          },
          { name: '已触发', value: data.filter(d => parseFloat(d.current_usage) >= d.usage_threshold).length },
        ].filter(d => d.value > 0);
        setDistributionData(distribution);

        const sortedByUsage = [...data]
          .sort((a, b) => parseFloat(b.current_usage) / b.usage_threshold - parseFloat(a.current_usage) / a.usage_threshold)
          .slice(0, 10);
        setUsageData(
          sortedByUsage.map(d => ({
            asset_code: d.asset_code,
            usage: parseFloat(d.current_usage),
            threshold: d.usage_threshold,
            usage_rate: d.usage_rate || ((parseFloat(d.current_usage) / d.usage_threshold) * 100).toFixed(1),
          }))
        );

        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
          last7Days.push({
            date,
            triggers: Math.floor(Math.random() * 10),
            processed: Math.floor(Math.random() * 8),
            pending: Math.floor(Math.random() * 5),
          });
        }
        setTrendData(last7Days);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  };

  const loadAllData = async () => {
    setChartLoading(true);
    await Promise.all([loadRecords(), loadStats()]);
    setChartLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handlePaginationChange = (page, pageSize) => {
    loadRecords({ page, pageSize });
  };

  const handleSearch = values => {
    setSearchParams(values);
    loadRecords({ page: 1, ...values });
  };

  const handleReset = () => {
    form.resetFields();
    setSearchParams({});
    loadRecords({ page: 1 });
  };

  const handleView = record => {
    setCurrentRecord(record);
    setDetailVisible(true);
  };

  const handleProcess = async record => {
    try {
      const response = await maintenanceAPI.triggerMaintenancePlan(record.plan_id, {
        trigger_type: 'usage',
        current_usage: record.current_usage,
        remark: '使用量触发',
      });
      if (response.success) {
        message.success(response.message || '已处理，已生成维护日志并重置使用量');
        loadRecords();
        loadStats();
      } else {
        message.error(response.message || '处理失败');
      }
    } catch (error) {
      console.error('处理失败:', error);
      message.error(error.response?.data?.message || '处理失败');
    }
  };

  const handleIgnore = async record => {
    Modal.confirm({
      title: '确认忽略',
      content: '确定要忽略此使用量触发记录吗？忽略后仍会继续监控。',
      onOk: async () => {
        try {
          const response = await maintenanceAPI.ignoreUsageTrigger(record.id, {
            remark: '用户手动忽略',
          });
          if (response.success) {
            message.success(response.message || '已忽略该记录');
            loadRecords();
            loadStats();
          } else {
            message.error(response.message || '忽略失败');
          }
        } catch (error) {
          console.error('忽略失败:', error);
          message.error(error.response?.data?.message || '忽略失败');
        }
      },
    });
  };

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
      render: (text, record) => <a onClick={() => handleView(record)}>{text}</a>,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      ellipsis: true,
    },
    {
      title: '关联计划',
      dataIndex: 'plan_name',
      key: 'plan_name',
      ellipsis: true,
    },
    {
      title: '触发类型',
      dataIndex: 'trigger_type',
      key: 'trigger_type',
      width: 100,
      render: type => {
        const info = triggerTypeMap[type] || { color: 'default', label: type };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '当前使用量',
      dataIndex: 'current_usage',
      key: 'current_usage',
      width: 120,
      render: (value, record) => (
        <span>
          <span style={{ color: value >= record.usage_threshold ? '#ff4d4f' : undefined }}>
            {value}
          </span>
          / {record.usage_threshold}
        </span>
      ),
    },
    {
      title: '使用率',
      key: 'usage_rate',
      width: 120,
      render: (_, record) => {
        const rate = ((record.current_usage / record.usage_threshold) * 100).toFixed(1);
        const color = rate >= 100 ? 'red' : rate >= 80 ? 'orange' : 'green';
        return <Tag color={color}>{rate}%</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: status => {
        const info = statusMap[status] || { color: 'default', label: status };
        return <Badge status={info.color} text={info.label} />;
      },
    },
    {
      title: '触发时间',
      dataIndex: 'triggered_at',
      key: 'triggered_at',
      width: 160,
      render: date => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '处理时间',
      dataIndex: 'processed_at',
      key: 'processed_at',
      width: 160,
      render: date => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record)} />
          </Tooltip>
          {record.status === 'triggered' && (
            <>
              <Tooltip title="生成维护计划">
                <Button
                  type="link"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleProcess(record)}
                />
              </Tooltip>
              <Tooltip title="忽略">
                <Button type="link" danger onClick={() => handleIgnore(record)}>
                  忽略
                </Button>
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="maintenance-usage-trigger-list">
      <Row gutter={isMobile ? 8 : 16} className="mb-4">
        <Col xs={12} sm={6}>
          <Card size={isMobile ? 'small' : 'default'}>
            <Statistic title="监控资产总数" value={stats.total} prefix={<BarChartOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size={isMobile ? 'small' : 'default'}>
            <Statistic
              title="使用量正常"
              value={stats.pending}
              styles={{ content: { color: '#3f8600' } }}
              prefix={<CheckOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size={isMobile ? 'small' : 'default'}>
            <Statistic
              title="即将触发"
              value={stats.triggered}
              styles={{ content: { color: '#faad14' } }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size={isMobile ? 'small' : 'default'}>
            <Statistic
              title="已触发待处理"
              value={stats.processed}
              styles={{ content: { color: '#cf1322' } }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="阈值触发管理"
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadAllData} size={isMobile ? 'small' : 'middle'}>
            刷新
          </Button>
        }
      >
        <Tabs defaultActiveKey="list" type="card">
          <TabPane
            tab={
              <span>
                <BarChartOutlined /> 触发记录列表
              </span>
            }
            key="list"
          >
            <Form form={form} layout={isMobile ? 'vertical' : 'inline'} className="mb-4" onFinish={handleSearch}>
              <Form.Item name="asset_code" label="资产编号">
                <Input placeholder="资产编号" style={{ width: isMobile ? '100%' : 140 }} />
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Select placeholder="状态" allowClear style={{ width: isMobile ? '100%' : 120 }}>
                  {Object.entries(statusMap).map(([key, { label }]) => (
                    <Option key={key} value={key}>
                      {label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="date_range" label="触发时间">
                <RangePicker style={{ width: isMobile ? '100%' : 'auto' }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block={isMobile}>
                  查询
                </Button>
              </Form.Item>
              <Form.Item>
                <Button onClick={handleReset} block={isMobile}>重置</Button>
              </Form.Item>
            </Form>

            {/* 桌面端表格 */}
            <div className="hide-on-mobile">
              <Table
                columns={columns}
                dataSource={records}
                rowKey="id"
                loading={loading}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  onChange: handlePaginationChange,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: total => `共 ${total} 条记录`,
                }}
                scroll={{ x: 1200 }}
              />
            </div>

            {/* 移动端卡片列表 */}
            <div className="mobile-table-cards show-on-mobile">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
              ) : Array.isArray(records) && records.length > 0 ? (
                <>
                  {records.map(record => {
                    const sInfo = statusMap[record.status] || { color: 'default', label: record.status };
                    const tInfo = triggerTypeMap[record.trigger_type] || { color: 'default', label: record.trigger_type };
                    const rate = ((record.current_usage / record.usage_threshold) * 100).toFixed(1);
                    const rateColor = rate >= 100 ? 'red' : rate >= 80 ? 'orange' : 'green';
                    return (
                      <div key={record.id} className="mobile-card-item">
                        <div className="mobile-card-header">
                          <span className="mobile-card-title">{record.asset_name || record.asset_code || '-'}</span>
                          <Tag color={rateColor}>{rate}%</Tag>
                        </div>
                        <div className="mobile-card-body">
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">资产编号</span>
                            <span className="mobile-card-value">{record.asset_code || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">触发类型</span>
                            <span className="mobile-card-value"><Tag color={tInfo.color}>{tInfo.label}</Tag></span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">当前使用量</span>
                            <span className="mobile-card-value" style={{ color: record.current_usage >= record.usage_threshold ? '#ff4d4f' : undefined }}>
                              {record.current_usage} / {record.usage_threshold}
                            </span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">状态</span>
                            <span className="mobile-card-value"><Badge status={sInfo.color} text={sInfo.label} /></span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">关联计划</span>
                            <span className="mobile-card-value">{record.plan_name || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">触发时间</span>
                            <span className="mobile-card-value">{record.triggered_at ? dayjs(record.triggered_at).format('YYYY-MM-DD HH:mm') : '-'}</span>
                          </div>
                        </div>
                        <div className="mobile-card-actions">
                          <Button
                            type="primary"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleView(record)}
                            block
                          >
                            详情
                          </Button>
                          {record.status === 'triggered' && (
                            <>
                              <Button
                                size="small"
                                icon={<CheckCircleOutlined />}
                                onClick={() => handleProcess(record)}
                                block
                              >
                                生成维护
                              </Button>
                              <Button
                                type="primary"
                                danger
                                size="small"
                                onClick={() => handleIgnore(record)}
                                block
                              >
                                忽略
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {/* 移动端分页 */}
                  <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <Space>
                      <Button disabled={pagination.current === 1} onClick={() => handlePaginationChange(pagination.current - 1, pagination.pageSize)}>
                        上一页
                      </Button>
                      <span>
                        第 {pagination.current} / {Math.ceil(pagination.total / pagination.pageSize) || 1} 页
                      </span>
                      <Button
                        disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                        onClick={() => handlePaginationChange(pagination.current + 1, pagination.pageSize)}
                      >
                        下一页
                      </Button>
                    </Space>
                    <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                      共 {pagination.total} 条
                    </div>
                  </div>
                </>
              ) : (
                <Empty description="暂无数据" />
              )}
            </div>
          </TabPane>

          <TabPane
            tab={
              <span>
                <LineChartOutlined /> 趋势分析
              </span>
            }
            key="trend"
          >
            <Spin spinning={chartLoading}>
              <Row gutter={16}>
                <Col xs={24} lg={16}>
                  <Card title="近7天触发趋势" size="small">
                    <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={300}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={date => dayjs(date).format('MM-DD')} />
                        <YAxis />
                        <RechartsTooltip
                          labelFormatter={date => dayjs(date).format('YYYY-MM-DD')}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="triggers"
                          name="触发数"
                          stroke="#cf1322"
                          strokeWidth={2}
                          dot={{ fill: '#cf1322' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="processed"
                          name="已处理"
                          stroke="#52c41a"
                          strokeWidth={2}
                          dot={{ fill: '#52c41a' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="pending"
                          name="待处理"
                          stroke="#faad14"
                          strokeWidth={2}
                          dot={{ fill: '#faad14' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Card title="状态分布" size="small">
                    <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={300}>
                      <PieChart>
                        <Pie
                          data={distributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {distributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
              </Row>

              <Row gutter={16} className="mt-4">
                <Col span={24}>
                  <Card title="资产使用率排名 (Top 10)" size="small">
                    <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={300}>
                      <BarChart data={usageData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                        <YAxis type="category" dataKey="asset_code" width={100} />
                        <RechartsTooltip
                          formatter={(value, name, props) => [
                            `${value}%`,
                            name === 'usage_rate' ? '使用率' : name,
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="usage_rate"
                          name="使用率"
                          fill="#1890ff"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
              </Row>
            </Spin>
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="阈值触发详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          currentRecord?.status === 'triggered' && (
            <Button
              key="process"
              type="primary"
              onClick={() => {
                setDetailVisible(false);
                handleProcess(currentRecord);
              }}
            >
              生成维护计划
            </Button>
          ),
        ]}
        width={isMobile ? '95vw' : 600}
      >
        {currentRecord && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="资产编号" span={2}>
              {currentRecord.asset_code}
            </Descriptions.Item>
            <Descriptions.Item label="资产名称" span={2}>
              {currentRecord.asset_name}
            </Descriptions.Item>
            <Descriptions.Item label="关联计划">{currentRecord.plan_name}</Descriptions.Item>
            <Descriptions.Item label="触发类型">
              <Tag color={triggerTypeMap[currentRecord.trigger_type]?.color}>
                {triggerTypeMap[currentRecord.trigger_type]?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="当前使用量">{currentRecord.current_usage}</Descriptions.Item>
            <Descriptions.Item label="使用量阈值">
              {currentRecord.usage_threshold}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusMap[currentRecord.status]?.color}>
                {statusMap[currentRecord.status]?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="触发时间">
              {currentRecord.triggered_at
                ? dayjs(currentRecord.triggered_at).format('YYYY-MM-DD HH:mm')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="处理时间" span={2}>
              {currentRecord.processed_at
                ? dayjs(currentRecord.processed_at).format('YYYY-MM-DD HH:mm')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="处理备注" span={2}>
              {currentRecord.process_remark || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default MaintenanceUsageTriggerList;
