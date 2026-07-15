import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  message,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Row,
  Col,
  Statistic,
  Tooltip,
  Badge,
  Select,
  Tabs,
  Spin,
  Progress,
  Alert,
  Drawer,
  AutoComplete,
  Divider,
  Typography,
  Empty,
} from 'antd';

import {
  ReloadOutlined,
  PlusOutlined,
  HistoryOutlined,
  DashboardOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  LineChartOutlined,
  FormOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  MinusCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { maintenanceAPI, assetAPI } from '../utils/api';
import dayjs from 'dayjs';
import useIsMobile from '../hooks/useIsMobile';

const { Option } = Select;
const { Text, Title } = Typography;

const COLORS = {
  normal: '#52c41a',
  warning: '#faad14',
  critical: '#ff4d4f',
};

const UNIT_OPTIONS = [
  { value: '小时', label: '小时' },
  { value: '次', label: '次' },
  { value: '公里', label: '公里' },
  { value: '小时运行', label: '小时运行' },
];

const MaintenanceAssetUsage = () => {
  const isMobile = useIsMobile();
  const [assetUsageData, setAssetUsageData] = useState([]);
  const [usageRecords, setUsageRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [batchFormOpen, setBatchFormOpen] = useState(false);
  const [recordForm] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [recordPagination, setRecordPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [stats, setStats] = useState({
    total: 0,
    normal: 0,
    warning: 0,
    critical: 0,
  });
  const [searchText, setSearchText] = useState('');
  const [assetSearchOptions, setAssetSearchOptions] = useState([]);
  const [assetSearchFetching, setAssetSearchFetching] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [relatedPlans, setRelatedPlans] = useState([]);
  const [relatedPlansLoading, setRelatedPlansLoading] = useState(false);

  const loadAssetUsage = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const response = await maintenanceAPI.getAssetUsage({
        page,
        pageSize,
      });
      if (response.success) {
        const data = response.data || [];
        setAssetUsageData(data);
        setPagination({
          current: page,
          pageSize,
          total: response.pagination?.total || 0,
        });

        setStats({
          total: data.length,
          normal: data.filter(d => parseFloat(d.usage_rate) < 80).length,
          warning: data.filter(
            d => parseFloat(d.usage_rate) >= 80 && parseFloat(d.usage_rate) < 100
          ).length,
          critical: data.filter(d => parseFloat(d.usage_rate) >= 100).length,
        });
      } else {
        message.error('获取资产使用量失败');
      }
    } catch (error) {
      console.error('获取资产使用量失败:', error);
      message.error('网络错误，获取失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUsageRecords = async (page = 1, pageSize = 20) => {
    setRecordLoading(true);
    try {
      const response = await maintenanceAPI.getUsageRecords({
        page,
        pageSize,
      });
      if (response.success) {
        setUsageRecords(response.data || []);
        setRecordPagination({
          current: page,
          pageSize,
          total: response.pagination?.total || 0,
        });
      } else {
        message.error('获取使用量记录失败');
      }
    } catch (error) {
      console.error('获取使用量记录失败:', error);
      message.error('网络错误，获取失败');
    } finally {
      setRecordLoading(false);
    }
  };

  useEffect(() => {
    loadAssetUsage();
    loadUsageRecords();
  }, []);

  const handlePaginationChange = (page, pageSize) => {
    loadAssetUsage(page, pageSize);
  };

  const handleRecordPaginationChange = (page, pageSize) => {
    loadUsageRecords(page, pageSize);
  };

  const handleRecordUsage = async values => {
    setRecordLoading(true);
    try {
      const data = {
        ...values,
        usage_date: values.usage_date?.format('YYYY-MM-DD HH:mm:ss'),
      };
      const response = await maintenanceAPI.recordAssetUsage(data);
      if (response.success) {
        message.success('使用量记录成功');
        setFormOpen(false);
        recordForm.resetFields();
        loadAssetUsage();
        loadUsageRecords();
      } else {
        message.error(response.message || '记录失败');
      }
    } catch (error) {
      console.error('记录使用量失败:', error);
      message.error('网络错误，记录失败');
    } finally {
      setRecordLoading(false);
    }
  };

  const handleBatchRecordUsage = async values => {
    setRecordLoading(true);
    try {
      const records = (values.records || []).map(item => ({
        ...item,
        usage_date: item.usage_date?.format('YYYY-MM-DD HH:mm:ss'),
      }));
      let successCount = 0;
      let failCount = 0;
      for (const record of records) {
        try {
          const response = await maintenanceAPI.recordAssetUsage(record);
          if (response.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }
      if (successCount > 0) {
        message.success(`成功记录 ${successCount} 条${failCount > 0 ? `，失败 ${failCount} 条` : ''}`);
        setBatchFormOpen(false);
        batchForm.resetFields();
        loadAssetUsage();
        loadUsageRecords();
      } else {
        message.error('批量记录全部失败');
      }
    } catch (error) {
      console.error('批量记录使用量失败:', error);
      message.error('网络错误，记录失败');
    } finally {
      setRecordLoading(false);
    }
  };

  const handleAssetSearch = useCallback(async value => {
    if (!value || value.length < 1) {
      setAssetSearchOptions([]);
      return;
    }
    setAssetSearchFetching(true);
    try {
      const response = await assetAPI.getAssetsNoCache({ search: value, pageSize: 20 });
      if (response.success) {
        const list = response.data || [];
        setAssetSearchOptions(
          list.map(a => ({
            value: a.asset_code,
            label: (
              <Space>
                <Text strong>{a.asset_code}</Text>
                <Text type="secondary">{a.asset_name}</Text>
              </Space>
            ),
          }))
        );
      }
    } catch {
      setAssetSearchOptions([]);
    } finally {
      setAssetSearchFetching(false);
    }
  }, []);

  const handleRowClick = async record => {
    setSelectedAsset(record);
    setDrawerOpen(true);
    setRelatedPlansLoading(true);
    try {
      const resp = await maintenanceAPI.getMaintenancePlans({
        asset_code: record.asset_code,
        pageSize: 10,
      });
      if (resp.success) {
        setRelatedPlans(resp.data || []);
      } else {
        setRelatedPlans([]);
      }
    } catch {
      setRelatedPlans([]);
    } finally {
      setRelatedPlansLoading(false);
    }
  };

  const getUsageStatus = usageRate => {
    const rate = parseFloat(usageRate);
    if (rate >= 100) return { color: 'critical', label: '已超限', tagColor: 'red' };
    if (rate >= 80) return { color: 'warning', label: '即将触发', tagColor: 'orange' };
    return { color: 'normal', label: '使用量正常', tagColor: 'green' };
  };

  const getProgressStatus = usageRate => {
    const rate = parseFloat(usageRate);
    if (rate >= 100) return 'exception';
    if (rate >= 80) return 'active';
    return 'normal';
  };

  const filteredAssetUsage = searchText
    ? assetUsageData.filter(
        d =>
          (d.asset_code || '').toLowerCase().includes(searchText.toLowerCase()) ||
          (d.asset_name || '').toLowerCase().includes(searchText.toLowerCase())
      )
    : assetUsageData;

  const usageColumns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      ellipsis: true,
    },
    {
      title: '当前使用量',
      dataIndex: 'current_usage',
      key: 'current_usage',
      width: 120,
    },
    {
      title: '阈值',
      dataIndex: 'usage_threshold',
      key: 'usage_threshold',
      width: 100,
    },
    {
      title: '使用率',
      dataIndex: 'usage_rate',
      key: 'usage_rate',
      width: 180,
      sorter: (a, b) => parseFloat(a.usage_rate) - parseFloat(b.usage_rate),
      render: (value, record) => {
        const rate = parseFloat(value) || 0;
        return (
          <Space orientation="vertical" size={0} style={{ width: '100%' }}>
            <Progress
              percent={Math.min(rate, 100)}
              status={getProgressStatus(value)}
              strokeColor={
                rate >= 100
                  ? COLORS.critical
                  : rate >= 80
                    ? COLORS.warning
                    : COLORS.normal
              }
              size="small"
              format={() => `${value}%`}
            />
          </Space>
        );
      },
    },
    {
      title: '最近记录时间',
      dataIndex: 'last_usage_date',
      key: 'last_usage_date',
      width: 160,
      render: date => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const status = getUsageStatus(record.usage_rate);
        return (
          <Badge
            status={
              status.color === 'critical'
                ? 'error'
                : status.color === 'warning'
                  ? 'warning'
                  : 'success'
            }
            text={status.label}
          />
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="记录使用量">
            <Button
              type="link"
              icon={<PlusOutlined />}
              onClick={e => {
                e.stopPropagation();
                recordForm.setFieldsValue({ asset_code: record.asset_code });
                setFormOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="资产详情">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={e => {
                e.stopPropagation();
                handleRowClick(record);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const recordColumns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      ellipsis: true,
    },
    {
      title: '使用量',
      dataIndex: 'usage_value',
      key: 'usage_value',
      width: 100,
    },
    {
      title: '使用类型',
      dataIndex: 'usage_type',
      key: 'usage_type',
      width: 100,
      render: type => {
        const typeMap = {
          daily: { label: '日常', color: 'blue' },
          maintenance: { label: '维护', color: 'green' },
          calibration: { label: '校准', color: 'purple' },
          other: { label: '其他', color: 'default' },
        };
        const info = typeMap[type] || { label: type, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '记录时间',
      dataIndex: 'usage_date',
      key: 'usage_date',
      width: 160,
      render: date => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '记录人',
      dataIndex: 'recorded_by',
      key: 'recorded_by',
      width: 100,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
  ];

  const rankingData = [...assetUsageData]
    .sort((a, b) => parseFloat(b.usage_rate) - parseFloat(a.usage_rate))
    .slice(0, 10);

  const rankingColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_, __, index) => (
        <Badge
          count={index + 1}
          style={
            index < 3
              ? { backgroundColor: index === 0 ? '#ff4d4f' : index === 1 ? '#faad14' : '#52c41a' }
              : { backgroundColor: '#d9d9d9' }}
        />
      ),
    },
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      ellipsis: true,
    },
    {
      title: '使用率',
      dataIndex: 'usage_rate',
      key: 'usage_rate',
      width: 200,
      render: (value, record) => {
        const rate = parseFloat(value) || 0;
        return (
          <Progress
            percent={Math.min(rate, 100)}
            status={getProgressStatus(value)}
            strokeColor={
              rate >= 100 ? COLORS.critical : rate >= 80 ? COLORS.warning : COLORS.normal
            }
            size="small"
            format={() => `${value}%`}
          />
        );
      },
    },
    {
      title: '当前/阈值',
      key: 'usage_detail',
      width: 140,
      render: (_, record) => (
        <Text>
          {record.current_usage} / {record.usage_threshold}
        </Text>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const status = getUsageStatus(record.usage_rate);
        return <Tag color={status.tagColor}>{status.label}</Tag>;
      },
    },
  ];

  const assetUsageRecords = selectedAsset
    ? usageRecords.filter(r => r.asset_code === selectedAsset.asset_code)
    : [];

  const planColumns = [
    {
      title: '计划名称',
      dataIndex: 'plan_name',
      key: 'plan_name',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: status => {
        const statusMap = {
          pending: { label: '待执行', color: 'default' },
          in_progress: { label: '执行中', color: 'processing' },
          completed: { label: '已完成', color: 'success' },
          cancelled: { label: '已取消', color: 'error' },
        };
        const info = statusMap[status] || { label: status, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '下次执行',
      dataIndex: 'next_execution_date',
      key: 'next_execution_date',
      width: 140,
      render: date => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
  ];

  return (
    <div className="maintenance-asset-usage">
      <Row gutter={16} className="mb-4">
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="监控资产总数" value={stats.total} prefix={<DashboardOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="使用量正常"
              value={stats.normal}
              styles={{ content: { color: COLORS.normal } }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="即将触发"
              value={stats.warning}
              styles={{ content: { color: COLORS.warning } }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="已超限"
              value={stats.critical}
              styles={{ content: { color: COLORS.critical } }}
              prefix={<SyncOutlined spin={false} />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="资产使用量管理"
        extra={
          <Space orientation={isMobile ? 'vertical' : 'horizontal'}>
            <Button
              icon={<ReloadOutlined />}
              block={isMobile}
              onClick={() => {
                loadAssetUsage();
                loadUsageRecords();
              }}
            >
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} block={isMobile} onClick={() => setFormOpen(true)}>
              记录使用量
            </Button>
            <Button icon={<FormOutlined />} block={isMobile} onClick={() => setBatchFormOpen(true)}>
              批量记录
            </Button>
          </Space>
        }
      >
        <Tabs defaultActiveKey="list" type="card" items={[
          {
            key: 'list',
            label: (
              <span>
                <DashboardOutlined /> 使用量列表
              </span>
            ),
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Input
                    placeholder="搜索资产编号或名称"
                    prefix={<SearchOutlined />}
                    allowClear
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    style={{ width: isMobile ? '100%' : 300 }}
                  />
                </div>
                <div className="hide-on-mobile">
                  <Table
                    columns={usageColumns}
                    dataSource={filteredAssetUsage}
                    rowKey="plan_id"
                    loading={loading}
                    onRow={record => ({
                      onClick: () => handleRowClick(record),
                      style: { cursor: 'pointer' },
                    })}
                    pagination={{
                      current: pagination.current,
                      pageSize: pagination.pageSize,
                      total: searchText ? filteredAssetUsage.length : pagination.total,
                      onChange: searchText ? undefined : handlePaginationChange,
                      showSizeChanger: true,
                      showTotal: total => `共 ${total} 条记录`,
                    }}
                    scroll={{ x: 1100 }}
                  />
                </div>
                <div className="mobile-table-cards show-on-mobile">
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                  ) : Array.isArray(filteredAssetUsage) && filteredAssetUsage.length > 0 ? (
                    filteredAssetUsage.map(record => {
                      const status = getUsageStatus(record.usage_rate);
                      return (
                        <div key={record.plan_id || record.asset_code} className="mobile-card-item">
                          <div className="mobile-card-header">
                            <span className="mobile-card-title">{record.asset_name || record.asset_code || '-'}</span>
                            <Tag color={status.tagColor}>{status.label}</Tag>
                          </div>
                          <div className="mobile-card-body">
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">资产编号</span>
                              <span className="mobile-card-value">{record.asset_code || '-'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">当前使用量</span>
                              <span className="mobile-card-value">{record.current_usage ?? '-'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">阈值</span>
                              <span className="mobile-card-value">{record.usage_threshold ?? '-'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">使用率</span>
                              <span className="mobile-card-value">{record.usage_rate ?? '-'}%</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">最近记录时间</span>
                              <span className="mobile-card-value">
                                {record.last_usage_date ? dayjs(record.last_usage_date).format('YYYY-MM-DD HH:mm') : '-'}
                              </span>
                            </div>
                          </div>
                          <div className="mobile-card-actions">
                            <Button
                              type="primary"
                              size="small"
                              icon={<PlusOutlined />}
                              onClick={() => {
                                recordForm.setFieldsValue({ asset_code: record.asset_code });
                                setFormOpen(true);
                              }}
                            >
                              记录使用量
                            </Button>
                            <Button
                              size="small"
                              icon={<EyeOutlined />}
                              onClick={() => handleRowClick(record)}
                            >
                              资产详情
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <Empty description="暂无数据" />
                  )}
                </div>
              </>
            ),
          },
          {
            key: 'chart',
            label: (
              <span>
                <LineChartOutlined /> 使用率排名
              </span>
            ),
            children: (
              <Row gutter={16}>
                <Col xs={24} lg={16}>
                  <Card title="资产使用率排名 (Top 10)" size="small">
                    <div className="hide-on-mobile">
                      <Table
                        columns={rankingColumns}
                        dataSource={rankingData}
                        rowKey="plan_id"
                        pagination={false}
                        size="small"
                      />
                    </div>
                    <div className="mobile-table-cards show-on-mobile">
                      {Array.isArray(rankingData) && rankingData.length > 0 ? (
                        rankingData.map((record, index) => {
                          const status = getUsageStatus(record.usage_rate);
                          return (
                            <div key={record.plan_id || record.asset_code} className="mobile-card-item">
                              <div className="mobile-card-header">
                                <span className="mobile-card-title">
                                  <Badge
                                    count={index + 1}
                                    style={
                                      index < 3
                                        ? { backgroundColor: index === 0 ? '#ff4d4f' : index === 1 ? '#faad14' : '#52c41a' }
                                        : { backgroundColor: '#d9d9d9' }}
                                  />
                                  <span style={{ marginLeft: 8 }}>{record.asset_name || record.asset_code || '-'}</span>
                                </span>
                                <Tag color={status.tagColor}>{status.label}</Tag>
                              </div>
                              <div className="mobile-card-body">
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">资产编号</span>
                                  <span className="mobile-card-value">{record.asset_code || '-'}</span>
                                </div>
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">使用率</span>
                                  <span className="mobile-card-value">{record.usage_rate ?? '-'}%</span>
                                </div>
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">当前/阈值</span>
                                  <span className="mobile-card-value">{record.current_usage ?? '-'} / {record.usage_threshold ?? '-'}</span>
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
                <Col xs={24} lg={8}>
                  <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                    <Alert title="使用量正常"
                      description="使用率 &lt; 80%"
                      type="success"
                      showIcon
                      icon={<CheckCircleOutlined />}
                    />
                    <Alert title="即将触发"
                      description="80% ≤ 使用率 &lt; 100%"
                      type="warning"
                      showIcon
                      icon={<WarningOutlined />}
                    />
                    <Alert title="已超限"
                      description="使用率 ≥ 100%"
                      type="error"
                      showIcon
                      icon={<SyncOutlined />}
                    />
                  </Space>
                  <Card title="使用率分布" size="small" style={{ marginTop: 16 }}>
                    <Row gutter={8}>
                      <Col xs={8}>
                        <Card
                          size="small"
                          style={{
                            background: '#f6ffed',
                            borderColor: '#b7eb8f',
                            textAlign: 'center',
                          }}
                        >
                          <Statistic
                            title="正常"
                            value={stats.normal}
                            styles={{ content: { color: COLORS.normal, fontSize: 24 } }}
                          />
                        </Card>
                      </Col>
                      <Col xs={8}>
                        <Card
                          size="small"
                          style={{
                            background: '#fffbe6',
                            borderColor: '#ffe58f',
                            textAlign: 'center',
                          }}
                        >
                          <Statistic
                            title="即将触发"
                            value={stats.warning}
                            styles={{ content: { color: COLORS.warning, fontSize: 24 } }}
                          />
                        </Card>
                      </Col>
                      <Col xs={8}>
                        <Card
                          size="small"
                          style={{
                            background: '#fff2f0',
                            borderColor: '#ffccc7',
                            textAlign: 'center',
                          }}
                        >
                          <Statistic
                            title="已超限"
                            value={stats.critical}
                            styles={{ content: { color: COLORS.critical, fontSize: 24 } }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'history',
            label: (
              <span>
                <HistoryOutlined /> 记录历史
              </span>
            ),
            children: (
              <>
                <div className="hide-on-mobile">
                  <Table
                    columns={recordColumns}
                    dataSource={usageRecords}
                    rowKey="id"
                    loading={recordLoading}
                    pagination={{
                      current: recordPagination.current,
                      pageSize: recordPagination.pageSize,
                      total: recordPagination.total,
                      onChange: handleRecordPaginationChange,
                      showSizeChanger: true,
                      showTotal: total => `共 ${total} 条记录`,
                    }}
                    scroll={{ x: 900 }}
                  />
                </div>
                <div className="mobile-table-cards show-on-mobile">
                  {recordLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                  ) : Array.isArray(usageRecords) && usageRecords.length > 0 ? (
                    usageRecords.map(record => {
                      const typeMap = {
                        daily: { label: '日常', color: 'blue' },
                        maintenance: { label: '维护', color: 'green' },
                        calibration: { label: '校准', color: 'purple' },
                        other: { label: '其他', color: 'default' },
                      };
                      const typeInfo = typeMap[record.usage_type] || { label: record.usage_type, color: 'default' };
                      return (
                        <div key={record.id} className="mobile-card-item">
                          <div className="mobile-card-header">
                            <span className="mobile-card-title">{record.asset_name || record.asset_code || '-'}</span>
                            <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
                          </div>
                          <div className="mobile-card-body">
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">资产编号</span>
                              <span className="mobile-card-value">{record.asset_code || '-'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">使用量</span>
                              <span className="mobile-card-value">{record.usage_value ?? '-'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">记录时间</span>
                              <span className="mobile-card-value">
                                {record.usage_date ? dayjs(record.usage_date).format('YYYY-MM-DD HH:mm') : '-'}
                              </span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">记录人</span>
                              <span className="mobile-card-value">{record.recorded_by || '-'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">备注</span>
                              <span className="mobile-card-value">{record.remark || '-'}</span>
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
            ),
          },
        ]} />
      </Card>

      {/* 单条记录 Modal */}
      <Modal
        title="记录资产使用量"
        open={formOpen}
        onCancel={() => {
          setFormOpen(false);
          recordForm.resetFields();
        }}
        footer={null}
        styles={{ wrapper: { width: 500 } }}
      >
        <Form form={recordForm} layout="vertical" onFinish={handleRecordUsage}>
          <Form.Item
            name="asset_code"
            label="资产编号"
            rules={[{ required: true, message: '请选择资产编号' }]}
          >
            <AutoComplete
              options={assetSearchOptions}
              onSearch={handleAssetSearch}
              placeholder="输入资产编号搜索"
              notFoundContent={assetSearchFetching ? '搜索中...' : '无匹配结果'}
            />
          </Form.Item>
          <Form.Item
            name="usage_value"
            label="使用量"
            rules={[{ required: true, message: '请输入使用量' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入使用量数值" />
          </Form.Item>
          <Form.Item name="unit" label="单位" initialValue="小时">
            <Select placeholder="选择单位">
              {UNIT_OPTIONS.map(u => (
                <Option key={u.value} value={u.value}>
                  {u.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="usage_type" label="使用类型" initialValue="daily">
            <Select placeholder="选择使用类型">
              <Option value="daily">日常使用</Option>
              <Option value="maintenance">维护使用</Option>
              <Option value="calibration">校准使用</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="usage_date" label="记录时间" initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} showTime format="YYYY-MM-DD HH:mm:ss" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
          <Form.Item className="mb-0" style={{ textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setFormOpen(false);
                  recordForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={recordLoading}>
                记录
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量记录 Modal */}
      <Modal
        title="批量记录使用量"
        open={batchFormOpen}
        onCancel={() => {
          setBatchFormOpen(false);
          batchForm.resetFields();
        }}
        footer={null}
        styles={{ wrapper: { width: 800 } }}
      >
        <Form form={batchForm} layout="vertical" onFinish={handleBatchRecordUsage}>
          <Form.List name="records" initialValue={[{}]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card
                    key={key}
                    size="small"
                    style={{ marginBottom: 12 }}
                    title={`记录 #${name + 1}`}
                    extra={
                      fields.length > 1 ? (
                        <Button
                          type="link"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(name)}
                        >
                          删除
                        </Button>
                      ) : null
                    }
                  >
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'asset_code']}
                          label="资产编号"
                          rules={[{ required: true, message: '请选择资产编号' }]}
                        >
                          <AutoComplete
                            options={assetSearchOptions}
                            onSearch={handleAssetSearch}
                            placeholder="输入资产编号搜索"
                            notFoundContent={assetSearchFetching ? '搜索中...' : '无匹配结果'}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'usage_value']}
                          label="使用量"
                          rules={[{ required: true, message: '请输入使用量' }]}
                        >
                          <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入使用量数值" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} sm={8}>
                        <Form.Item
                          {...restField}
                          name={[name, 'unit']}
                          label="单位"
                          initialValue="小时"
                        >
                          <Select placeholder="选择单位">
                            {UNIT_OPTIONS.map(u => (
                              <Option key={u.value} value={u.value}>
                                {u.label}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item
                          {...restField}
                          name={[name, 'usage_type']}
                          label="使用类型"
                          initialValue="daily"
                        >
                          <Select placeholder="选择使用类型">
                            <Option value="daily">日常使用</Option>
                            <Option value="maintenance">维护使用</Option>
                            <Option value="calibration">校准使用</Option>
                            <Option value="other">其他</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item
                          {...restField}
                          name={[name, 'usage_date']}
                          label="记录时间"
                          initialValue={dayjs()}
                        >
                          <DatePicker style={{ width: '100%' }} showTime format="YYYY-MM-DD HH:mm:ss" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item
                      {...restField}
                      name={[name, 'remark']}
                      label="备注"
                    >
                      <Input placeholder="备注信息（可选）" />
                    </Form.Item>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add()}
                  block
                  icon={<PlusOutlined />}
                >
                  添加一条记录
                </Button>
              </>
            )}
          </Form.List>
          <Divider />
          <Form.Item className="mb-0" style={{ textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setBatchFormOpen(false);
                  batchForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={recordLoading}>
                批量记录
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 资产详情 Drawer */}
      <Drawer
        title={
          selectedAsset
            ? `资产详情 - ${selectedAsset.asset_code}`
            : '资产详情'
        }
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedAsset(null);
          setRelatedPlans([]);
        }}
        styles={{ wrapper: { width: 700 } }}
      >
        {selectedAsset && (
          <>
            <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 12]}>
                <Col xs={24} sm={12}>
                  <Text type="secondary">资产编号</Text>
                  <div><Text strong>{selectedAsset.asset_code || '-'}</Text></div>
                </Col>
                <Col xs={24} sm={12}>
                  <Text type="secondary">资产名称</Text>
                  <div><Text strong>{selectedAsset.asset_name || '-'}</Text></div>
                </Col>
                <Col xs={24} sm={12}>
                  <Text type="secondary">当前使用量</Text>
                  <div><Text strong>{selectedAsset.current_usage ?? '-'}</Text></div>
                </Col>
                <Col xs={24} sm={12}>
                  <Text type="secondary">使用阈值</Text>
                  <div><Text strong>{selectedAsset.usage_threshold ?? '-'}</Text></div>
                </Col>
                <Col xs={24}>
                  <Text type="secondary">使用率</Text>
                  <div>
                    <Progress
                      percent={Math.min(parseFloat(selectedAsset.usage_rate) || 0, 100)}
                      status={getProgressStatus(selectedAsset.usage_rate)}
                      strokeColor={
                        parseFloat(selectedAsset.usage_rate) >= 100
                          ? COLORS.critical
                          : parseFloat(selectedAsset.usage_rate) >= 80
                            ? COLORS.warning
                            : COLORS.normal
                      }
                      style={{ maxWidth: 400 }}
                    />
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <Text type="secondary">状态</Text>
                  <div>
                    <Tag color={getUsageStatus(selectedAsset.usage_rate).tagColor}>
                      {getUsageStatus(selectedAsset.usage_rate).label}
                    </Tag>
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <Text type="secondary">最近记录时间</Text>
                  <div>
                    <Text strong>
                      {selectedAsset.last_usage_date
                        ? dayjs(selectedAsset.last_usage_date).format('YYYY-MM-DD HH:mm')
                        : '-'}
                    </Text>
                  </div>
                </Col>
              </Row>
            </Card>

            <Card
              title="使用记录"
              size="small"
              style={{ marginBottom: 16 }}
              extra={
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    recordForm.setFieldsValue({ asset_code: selectedAsset.asset_code });
                    setFormOpen(true);
                  }}
                >
                  记录使用量
                </Button>
              }
            >
              {assetUsageRecords.length > 0 ? (
                <>
                  <div className="hide-on-mobile">
                    <Table
                      columns={[
                        {
                          title: '使用量',
                          dataIndex: 'usage_value',
                          key: 'usage_value',
                          width: 80,
                        },
                        {
                          title: '类型',
                          dataIndex: 'usage_type',
                          key: 'usage_type',
                          width: 80,
                          render: type => {
                            const typeMap = {
                              daily: { label: '日常', color: 'blue' },
                              maintenance: { label: '维护', color: 'green' },
                              calibration: { label: '校准', color: 'purple' },
                              other: { label: '其他', color: 'default' },
                            };
                            const info = typeMap[type] || { label: type, color: 'default' };
                            return <Tag color={info.color}>{info.label}</Tag>;
                          },
                        },
                        {
                          title: '时间',
                          dataIndex: 'usage_date',
                          key: 'usage_date',
                          width: 120,
                          render: date => (date ? dayjs(date).format('MM-DD HH:mm') : '-'),
                        },
                        {
                          title: '备注',
                          dataIndex: 'remark',
                          key: 'remark',
                          ellipsis: true,
                        },
                      ]}
                      dataSource={assetUsageRecords}
                      rowKey="id"
                      pagination={{ pageSize: 5, size: 'small' }}
                      size="small"
                    />
                  </div>
                  <div className="mobile-table-cards show-on-mobile">
                    {assetUsageRecords.map(record => {
                      const typeMap = {
                        daily: { label: '日常', color: 'blue' },
                        maintenance: { label: '维护', color: 'green' },
                        calibration: { label: '校准', color: 'purple' },
                        other: { label: '其他', color: 'default' },
                      };
                      const typeInfo = typeMap[record.usage_type] || { label: record.usage_type, color: 'default' };
                      return (
                        <div key={record.id} className="mobile-card-item">
                          <div className="mobile-card-header">
                            <span className="mobile-card-title">使用量: {record.usage_value ?? '-'}</span>
                            <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
                          </div>
                          <div className="mobile-card-body">
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">时间</span>
                              <span className="mobile-card-value">
                                {record.usage_date ? dayjs(record.usage_date).format('YYYY-MM-DD HH:mm') : '-'}
                              </span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">备注</span>
                              <span className="mobile-card-value">{record.remark || '-'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <Text type="secondary">暂无使用记录</Text>
              )}
            </Card>

            <Card title="关联维保计划" size="small">
              <Spin spinning={relatedPlansLoading}>
                {relatedPlans.length > 0 ? (
                  <>
                    <div className="hide-on-mobile">
                      <Table
                        columns={planColumns}
                        dataSource={relatedPlans}
                        rowKey="id"
                        pagination={false}
                        size="small"
                      />
                    </div>
                    <div className="mobile-table-cards show-on-mobile">
                      {relatedPlans.map(record => {
                        const statusMap = {
                          pending: { label: '待执行', color: 'default' },
                          in_progress: { label: '执行中', color: 'processing' },
                          completed: { label: '已完成', color: 'success' },
                          cancelled: { label: '已取消', color: 'error' },
                        };
                        const statusInfo = statusMap[record.status] || { label: record.status, color: 'default' };
                        return (
                          <div key={record.plan_id || record.id} className="mobile-card-item">
                            <div className="mobile-card-header">
                              <span className="mobile-card-title">{record.plan_name || '-'}</span>
                              <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                            </div>
                            <div className="mobile-card-body">
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">下次执行</span>
                                <span className="mobile-card-value">
                                  {record.next_execution_date ? dayjs(record.next_execution_date).format('YYYY-MM-DD') : '-'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <Text type="secondary">暂无关联维保计划</Text>
                )}
              </Spin>
            </Card>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default MaintenanceAssetUsage;
