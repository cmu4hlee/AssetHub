import React, { useState, useEffect } from 'react';
import {
  Table, Button, Select, Space, Popconfirm, message, Tag,
  Card, Statistic, Row, Col, Typography, Modal, Input, DatePicker,
  Tooltip, Checkbox,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ReloadOutlined, GiftOutlined,
  EyeOutlined, CheckCircleOutlined, StopOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useCan, useIsMobile } from '../hooks';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { idleAPI } from '../utils/api';

const { Option } = Select;
const { Text } = Typography;
const { confirm } = Modal;

const IdleAssetList = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [statusFilter, setStatusFilter] = useState('');
  const isMobile = useIsMobile();
  const canDelete = useCan('idle', 'delete');
  const [statistics, setStatistics] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignData, setAssignData] = useState(null); // { type: 'single'|'batch', records }

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        status: statusFilter || undefined,
      };
      const result = await idleAPI.getIdleAssets(params);
      if (result.success) {
        setData(result.data || []);
        setPagination(prev => ({
          ...prev,
          total: result.pagination?.total || 0,
        }));
      }
    } catch (error) {
      message.error('加载闲置资产列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const result = await idleAPI.getIdleStatistics();
      if (result.success && result.data) {
        setStatistics(result.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize, statusFilter]);

  useEffect(() => {
    loadStatistics();
  }, []);

  const handleDelete = async id => {
    try {
      const result = await idleAPI.deleteIdleAsset(id);
      if (result.success) {
        message.success('删除成功');
        loadData();
        loadStatistics();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleAssign = record => {
    setAssignData({ type: 'single', records: [record] });
    setAssignModalVisible(true);
  };

  const handleBatchAssign = () => {
    const selectedRecords = data.filter(r => selectedRowKeys.includes(r.id) && r.status === '发布中');
    if (selectedRecords.length === 0) {
      message.warning('请选择状态为"发布中"的闲置资产');
      return;
    }
    setAssignData({ type: 'batch', records: selectedRecords });
    setAssignModalVisible(true);
  };

  const handleBatchCancel = () => {
    const selectedRecords = data.filter(r => selectedRowKeys.includes(r.id) && r.status === '发布中');
    if (selectedRecords.length === 0) {
      message.warning('请选择状态为"发布中"的闲置资产');
      return;
    }

    confirm({
      title: `确定取消选中的 ${selectedRecords.length} 条闲置资产发布？`,
      icon: <ExclamationCircleOutlined />,
      content: '取消后，这些资产将不再出现在发布列表中。',
      okText: '确定取消',
      cancelText: '返回',
      onOk: async () => {
        try {
          setBatchActionLoading(true);
          const result = await idleAPI.batchCancelIdleAssets({ ids: selectedRecords.map(r => r.id) });
          if (result.success) {
            message.success(result.message);
            setSelectedRowKeys([]);
            loadData();
            loadStatistics();
          }
        } catch (error) {
          message.error(error.response?.data?.message || '批量取消失败');
        } finally {
          setBatchActionLoading(false);
        }
      },
    });
  };

  const handleBatchDelete = () => {
    confirm({
      title: `确定删除选中的 ${selectedRowKeys.length} 条闲置资产记录？`,
      icon: <ExclamationCircleOutlined />,
      content: '已分配的记录不能被删除。此操作不可恢复。',
      okText: '确定删除',
      okType: 'danger',
      cancelText: '返回',
      onOk: async () => {
        try {
          setBatchActionLoading(true);
          const result = await idleAPI.batchDeleteIdleAssets({ ids: selectedRowKeys });
          if (result.success) {
            message.success(result.message);
            setSelectedRowKeys([]);
            loadData();
            loadStatistics();
          }
        } catch (error) {
          message.error(error.response?.data?.message || '批量删除失败');
        } finally {
          setBatchActionLoading(false);
        }
      },
    });
  };

  const handleAssignSubmit = async values => {
    try {
      setBatchActionLoading(true);
      const { allocated_to, allocated_date } = values;
      const dateStr = allocated_date ? allocated_date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

      if (assignData.type === 'single') {
        const record = assignData.records[0];
        const result = await idleAPI.allocateIdleAsset(record.id, { allocated_to, allocated_date: dateStr });
        if (result.success) {
          message.success('分配成功');
        }
      } else {
        const ids = assignData.records.map(r => r.id);
        const result = await idleAPI.batchAllocateIdleAssets({ ids, allocated_to, allocated_date: dateStr });
        if (result.success) {
          message.success(result.message);
        }
      }

      setAssignModalVisible(false);
      setAssignData(null);
      setSelectedRowKeys([]);
      loadData();
      loadStatistics();
    } catch (error) {
      message.error(error.response?.data?.message || '分配失败');
    } finally {
      setBatchActionLoading(false);
    }
  };

  const getStatusTag = status => {
    const statusMap = {
      发布中: { color: 'processing', text: '发布中' },
      已分配: { color: 'success', text: '已分配' },
      已取消: { color: 'default', text: '已取消' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getIdleDaysTag = days => {
    if (days === null || days === undefined) return '-';
    if (days >= 30) return <Tag color="red">{days}天</Tag>;
    if (days >= 7) return <Tag color="orange">{days}天</Tag>;
    return <Tag color="blue">{days}天</Tag>;
  };

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
      render: (text, record) => (
        <a onClick={() => navigate(`/idle/${record.id}`)}>{text || '-'}</a>
      ),
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '资产类型',
      dataIndex: 'asset_type',
      key: 'asset_type',
      width: 100,
      render: v => v || '-',
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      render: v => v || '-',
    },
    {
      title: '品牌/型号',
      key: 'brand_model',
      width: 140,
      render: (_, record) => [record.brand, record.model].filter(Boolean).join(' / ') || '-',
    },
    {
      title: '当前价值',
      dataIndex: 'current_value',
      key: 'current_value',
      width: 110,
      render: value => (value ? `¥${Number(value).toLocaleString()}` : '-'),
    },
    {
      title: '闲置天数',
      dataIndex: 'idle_days',
      key: 'idle_days',
      width: 100,
      sorter: (a, b) => (a.idle_days || 0) - (b.idle_days || 0),
      render: days => getIdleDaysTag(days),
    },
    {
      title: '发布日期',
      dataIndex: 'publish_date',
      key: 'publish_date',
      width: 110,
    },
    {
      title: '发布人',
      dataIndex: 'publish_person',
      key: 'publish_person',
      width: 90,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: status => getStatusTag(status),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="link" size="small" icon={<EyeOutlined />}
              onClick={() => navigate(`/idle/${record.id}`)} />
          </Tooltip>
          {record.status === '发布中' && (
            <>
              <Tooltip title="分配">
                <Button type="link" size="small" icon={<CheckCircleOutlined />}
                  style={{ color: '#52c41a' }} onClick={() => handleAssign(record)} />
              </Tooltip>
              <Popconfirm
                title="取消发布？"
                onConfirm={async () => {
                  try {
                    await idleAPI.cancelIdleAsset(record.id);
                    message.success('已取消');
                    loadData();
                    loadStatistics();
                  } catch (e) {
                    message.error('取消失败');
                  }
                }}
                okText="确定"
                cancelText="返回"
              >
                <Tooltip title="取消发布">
                  <Button type="link" size="small" icon={<StopOutlined />} danger />
                </Tooltip>
              </Popconfirm>
            </>
          )}
          <Popconfirm
            title="确定删除？"
            onConfirm={() => handleDelete(record.id)}
            disabled={!canDelete}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />}
                disabled={!canDelete || record.status === '已分配'} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: keys => setSelectedRowKeys(keys),
    getCheckboxProps: record => ({
      disabled: record.status === '已分配',
    }),
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold m-0">闲置资产发布</h1>
          <Text type="secondary">管理闲置资产发布，支持跨部门调配</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { loadData(); loadStatistics(); }} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/idle/new')}>
            发布闲置资产
          </Button>
        </Space>
      </div>

      {/* 统计信息 */}
      <Card className="mb-4">
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Statistic
              title="发布中"
              value={statistics?.active || data.filter(d => d.status === '发布中').length}
              prefix={<GiftOutlined />}
              styles={{ content: { color: '#1677ff' } }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="已分配"
              value={statistics?.allocated || data.filter(d => d.status === '已分配').length}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="已取消"
              value={statistics?.cancelled || data.filter(d => d.status === '已取消').length}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="超30天闲置"
              value={statistics?.long_idle_count || 0}
              styles={{ content: statistics?.long_idle_count > 0 ? { color: '#ff4d4f' } : {} }}
              suffix={statistics?.avg_idle_days ? `/ 平均${statistics.avg_idle_days}天` : ''}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        {/* 筛选和操作栏 */}
        <Row justify="space-between" className="mb-4">
          <Col>
            <Space>
              <Select
                placeholder="筛选状态"
                style={{ width: 150 }}
                allowClear
                value={statusFilter || undefined}
                onChange={value => {
                  setStatusFilter(value || '');
                  setPagination(prev => ({ ...prev, current: 1 }));
                  setSelectedRowKeys([]);
                }}
              >
                <Option value="发布中">发布中</Option>
                <Option value="已分配">已分配</Option>
                <Option value="已取消">已取消</Option>
              </Select>

              {selectedRowKeys.length > 0 && (
                <>
                  <Text type="secondary">已选 {selectedRowKeys.length} 项</Text>
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    onClick={handleBatchAssign}
                    loading={batchActionLoading}
                  >
                    批量分配
                  </Button>
                  <Button
                    size="small"
                    icon={<StopOutlined />}
                    onClick={handleBatchCancel}
                    loading={batchActionLoading}
                  >
                    批量取消
                  </Button>
                  <Popconfirm
                    title={`确定删除选中的 ${selectedRowKeys.length} 条记录？`}
                    onConfirm={handleBatchDelete}
                    okText="确定"
                    okType="danger"
                    cancelText="返回"
                  >
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      loading={batchActionLoading}
                    >
                      批量删除
                    </Button>
                  </Popconfirm>
                </>
              )}
            </Space>
          </Col>
        </Row>

        {/* 桌面端表格 */}
        <div className="hide-on-mobile">
          <Table
            rowSelection={rowSelection}
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: total => `共 ${total} 条`,
              onChange: (page, pageSize) => {
                setPagination(prev => ({ ...prev, current: page, pageSize }));
              },
            }}
            scroll={{ x: 1500 }}
            size="middle"
          />
        </div>

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {data.map(record => (
            <div key={record.id} className="mobile-card-item">
              <div className="mobile-card-header">
                <Space>
                  <Checkbox
                    checked={selectedRowKeys.includes(record.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedRowKeys(prev => [...prev, record.id]);
                      } else {
                        setSelectedRowKeys(prev => prev.filter(k => k !== record.id));
                      }
                    }}
                    disabled={record.status === '已分配'}
                  />
                  <span className="mobile-card-title">{record.asset_code || '-'}</span>
                  {getStatusTag(record.status)}
                  {record.idle_days !== undefined && record.idle_days !== null && (
                    <Text type="secondary" style={{ fontSize: 12 }}>{record.idle_days}天</Text>
                  )}
                </Space>
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-field">
                  <span className="mobile-card-label">资产名称</span>
                  <span className="mobile-card-value">{record.asset_name || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">部门</span>
                  <span className="mobile-card-value">{record.department || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">资产类型</span>
                  <span className="mobile-card-value">{record.asset_type || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">品牌/型号</span>
                  <span className="mobile-card-value">{record.brand && record.model ? `${record.brand} / ${record.model}` : (record.brand || record.model || '-')}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">当前价值</span>
                  <span className="mobile-card-value">{record.current_value ? `¥${Number(record.current_value).toLocaleString()}` : '-'}</span>
                </div>
              </div>
              <div className="mobile-card-actions">
                <Button type="primary" size="small" icon={<EyeOutlined />}
                  onClick={() => navigate(`/idle/${record.id}`)} block>
                  详情
                </Button>
                {record.status === '发布中' && (
                  <Button size="small" icon={<CheckCircleOutlined />}
                    onClick={() => handleAssign(record)} block>
                    分配
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 分配弹窗 */}
      <Modal
        title={assignData?.type === 'single' ? '分配闲置资产' : `批量分配闲置资产 (${assignData?.records?.length || 0}条)`}
        open={assignModalVisible}
        onCancel={() => { setAssignModalVisible(false); setAssignData(null); }}
        footer={null}
        destroyOnHidden
      >
        <FormComponent
          onSubmit={handleAssignSubmit}
          loading={batchActionLoading}
          records={assignData?.records}
          onCancel={() => { setAssignModalVisible(false); setAssignData(null); }}
        />
      </Modal>
    </div>
  );
};

// 分配表单（内部组件）
const FormComponent = ({ onSubmit, loading, records, onCancel }) => {
  const [allocatedTo, setAllocatedTo] = useState('');
  const [allocatedDate, setAllocatedDate] = useState(dayjs());

  const handleSubmit = () => {
    if (!allocatedTo.trim()) {
      message.error('请输入分配对象');
      return;
    }
    onSubmit({ allocated_to: allocatedTo.trim(), allocated_date: allocatedDate });
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ marginBottom: 16 }}>
        <Text strong>分配对象：</Text>
        <Input
          placeholder="请输入接收部门或人员"
          value={allocatedTo}
          onChange={e => setAllocatedTo(e.target.value)}
          style={{ marginTop: 8 }}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Text strong>分配日期：</Text>
        <DatePicker
          value={allocatedDate}
          onChange={d => setAllocatedDate(d)}
          style={{ marginTop: 8, width: '100%' }}
        />
      </div>
      {records && records.length > 0 && (
        <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f5f5f5', borderRadius: 6 }}>
          <Text type="secondary">
            待分配资产：{records.slice(0, 3).map(r => r.asset_code).join(', ')}
            {records.length > 3 && ` 等${records.length}项`}
          </Text>
        </div>
      )}
      <div style={{ textAlign: 'right' }}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            确认分配
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default IdleAssetList;
