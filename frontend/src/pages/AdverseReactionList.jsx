import React, { useState, useEffect } from 'react';
import { useIsMobile, useCan } from '../hooks';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Popconfirm,
  message,
  Card,
  Tag,
  DatePicker,
  Badge,
  Modal,
  Tooltip,
} from 'antd';

import {
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  BarChartOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adverseReactionAPI } from '../utils/api';
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

const AdverseReactionList = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState({
    report_type: '',
    severity: '',
    event_level: '',
    status: '',
    reporter: '',
    keyword: '',
    start_date: '',
    end_date: '',
  });
  const isMobile = useIsMobile();
  const canDelete = useCan('adverse', 'delete');
  const canEdit = useCan('adverse', 'edit');

  // 批量删除
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      };
      const result = await adverseReactionAPI.getRecords(params);
      if (result.success) {
        setData(Array.isArray(result.data) ? result.data : []);
        setPagination(prev => ({
          ...prev,
          total: result.pagination?.total || 0,
        }));
      }
    } catch (error) {
      message.error('加载不良事件记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async id => {
    try {
      const result = await adverseReactionAPI.deleteRecord(id);
      if (result.success) {
        message.success('删除成功');
        loadData();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的记录');
      return;
    }
    Modal.confirm({
      title: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？`,
      content: '此操作不可恢复',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          setBatchDeleteLoading(true);
          let successCount = 0;
          for (const id of selectedRowKeys) {
            try {
              const result = await adverseReactionAPI.deleteRecord(id);
              if (result.success) successCount++;
            } catch (e) {
              console.error(`删除记录 ${id} 失败:`, e);
            }
          }
          message.success(`成功删除 ${successCount} 条记录`);
          setSelectedRowKeys([]);
          loadData();
        } catch (error) {
          message.error('批量删除失败');
        } finally {
          setBatchDeleteLoading(false);
        }
      },
    });
  };

  const handleExport = () => {
    const token = localStorage.getItem('token');
    const url = adverseReactionAPI.getExportUrl(filters);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = token ? `${url}&token=${token}` : url;
    document.body.appendChild(iframe);
    setTimeout(() => document.body.removeChild(iframe), 10000);
    message.success('正在导出 Excel，请稍候...');
  };

  const getSeverityColor = severity => {
    const colorMap = {
      轻微: 'green',
      一般: 'blue',
      严重: 'orange',
      重大: 'red',
    };
    return colorMap[severity] || 'default';
  };

  const getStatusColor = status => {
    const colorMap = {
      待处理: 'default',
      处理中: 'processing',
      已处理: 'success',
      已关闭: 'success',
      已归档: 'default',
    };
    return colorMap[status] || 'default';
  };

  const getEventLevelColor = level => {
    const colorMap = { 'I级': 'red', 'II级': 'orange', 'III级': 'gold', 'IV级': 'green' };
    return colorMap[level] || 'default';
  };

  const columns = [
    {
      title: '报告编号',
      dataIndex: 'report_no',
      key: 'report_no',
      width: 150,
      render: (text, record) => (
        <Space>
          {text}
          {record.is_overdue === 1 && (
            <Tooltip title="已超时">
              <Tag color="red" style={{ lineHeight: '16px', fontSize: 11 }}>超时</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 150,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '报告类型',
      dataIndex: 'report_type',
      key: 'report_type',
      width: 120,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: severity => <Tag color={getSeverityColor(severity)}>{severity}</Tag>,
    },
    {
      title: '事件等级',
      dataIndex: 'event_level',
      key: 'event_level',
      width: 90,
      render: level =>
        level ? <Tag color={getEventLevelColor(level)}>{level}</Tag> : '-',
    },
    {
      title: '发生时间',
      dataIndex: 'occurrence_date',
      key: 'occurrence_date',
      width: 180,
      render: date => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '上报人',
      dataIndex: 'reporter',
      key: 'reporter',
      width: 100,
    },
    {
      title: '科室',
      dataIndex: 'department',
      key: 'department',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: status => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/adverse-reaction/${record.id}`)}>
            详情
          </Button>
          <Button type="link" onClick={() => navigate(`/adverse-reaction/edit/${record.id}`)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.id)}
            disabled={!canDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? '12px' : '24px' }}>
      <Card>
        <div
          style={{
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <h2 style={{ margin: 0 }}>不良事件管理</h2>
          <Space wrap>
            <Button
              icon={<BarChartOutlined />}
              onClick={() => navigate('/adverse-reaction/statistics')}
            >
              统计报表
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出 Excel
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/adverse-reaction/new')}
            >
              新建上报
            </Button>
          </Space>
        </div>

        <Card size="small" style={{ marginBottom: '16px' }}>
          <Space wrap>
            <Search
              placeholder="搜索报告编号/资产编号/名称/描述"
              style={{ width: isMobile ? '100%' : 300 }}
              allowClear
              value={filters.keyword}
              onChange={e => setFilters({ ...filters, keyword: e.target.value })}
              onSearch={loadData}
              enterButton
            />
            <Select
              placeholder="报告类型"
              style={{ width: isMobile ? '100%' : 150 }}
              allowClear
              value={filters.report_type || undefined}
              onChange={value => {
                setFilters({ ...filters, report_type: value || '' });
                setPagination({ ...pagination, current: 1 });
              }}
            >
              <Option value="设备故障">设备故障</Option>
              <Option value="安全事故">安全事故</Option>
              <Option value="质量事故">质量事故</Option>
              <Option value="使用异常">使用异常</Option>
              <Option value="其他">其他</Option>
            </Select>
            <Select
              placeholder="严重程度"
              style={{ width: isMobile ? '100%' : 120 }}
              allowClear
              value={filters.severity || undefined}
              onChange={value => {
                setFilters({ ...filters, severity: value || '' });
                setPagination({ ...pagination, current: 1 });
              }}
            >
              <Option value="轻微">轻微</Option>
              <Option value="一般">一般</Option>
              <Option value="严重">严重</Option>
              <Option value="重大">重大</Option>
            </Select>
            <Select
              placeholder="事件等级"
              style={{ width: isMobile ? '100%' : 120 }}
              allowClear
              value={filters.event_level || undefined}
              onChange={value => {
                setFilters({ ...filters, event_level: value || '' });
                setPagination({ ...pagination, current: 1 });
              }}
            >
              <Option value="I级">I级（特别严重）</Option>
              <Option value="II级">II级（严重）</Option>
              <Option value="III级">III级（较重）</Option>
              <Option value="IV级">IV级（一般）</Option>
            </Select>
            <Select
              placeholder="处理状态"
              style={{ width: isMobile ? '100%' : 120 }}
              allowClear
              value={filters.status || undefined}
              onChange={value => {
                setFilters({ ...filters, status: value || '' });
                setPagination({ ...pagination, current: 1 });
              }}
            >
              <Option value="待处理">待处理</Option>
              <Option value="处理中">处理中</Option>
              <Option value="已处理">已处理</Option>
              <Option value="已关闭">已关闭</Option>
              <Option value="已归档">已归档</Option>
            </Select>
            <RangePicker
              showTime
              style={{ width: isMobile ? '100%' : 360 }}
              onChange={dates => {
                if (dates && dates.length === 2) {
                  setFilters({
                    ...filters,
                    start_date: dates[0].format('YYYY-MM-DD HH:mm:ss'),
                    end_date: dates[1].format('YYYY-MM-DD HH:mm:ss'),
                  });
                } else {
                  setFilters({
                    ...filters,
                    start_date: '',
                    end_date: '',
                  });
                }
                setPagination({ ...pagination, current: 1 });
              }}
            />
          </Space>
        </Card>

        {/* 批量操作栏 */}
        {selectedRowKeys.length > 0 && (
          <div
            style={{
              marginBottom: 12,
              padding: '8px 16px',
              background: '#e6f7ff',
              borderRadius: 4,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              已选择 <strong>{selectedRowKeys.length}</strong> 条记录
            </span>
            <Space>
              <Popconfirm
                title={`确定要删除选中的 ${selectedRowKeys.length} 条记录吗？`}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button danger loading={batchDeleteLoading}>
                  批量删除
                </Button>
              </Popconfirm>
              <Button onClick={() => setSelectedRowKeys([])}>取消选择</Button>
            </Space>
          </div>
        )}

        {/* 桌面端表格 */}
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            rowSelection={
              canDelete
                ? {
                    selectedRowKeys,
                    onChange: keys => setSelectedRowKeys(keys),
                  }
                : undefined
            }
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: total => `共 ${total} 条`,
              onChange: (page, pageSize) => {
                setPagination({ ...pagination, current: page, pageSize });
              },
            }}
            scroll={{ x: 1800 }}
          />
        </div>

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
          ) : Array.isArray(data) && data.length > 0 ? (
            <>
              {data.map(record => (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <Space>
                      <span className="mobile-card-title">{record.report_no || '-'}</span>
                      {record.is_overdue === 1 && <Tag color="red" style={{ lineHeight: '16px', fontSize: 11 }}>超时</Tag>}
                    </Space>
                    <Tag color={getStatusColor(record.status)}>{record.status || '-'}</Tag>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">资产名称</span>
                      <span className="mobile-card-value">{record.asset_name || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">报告类型</span>
                      <span className="mobile-card-value">{record.report_type || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">严重程度</span>
                      <Tag color={getSeverityColor(record.severity)}>{record.severity || '-'}</Tag>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">事件等级</span>
                      {record.event_level ? (
                        <Tag color={getEventLevelColor(record.event_level)}>{record.event_level}</Tag>
                      ) : '-'}
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">发生时间</span>
                      <span className="mobile-card-value">
                        {record.occurrence_date
                          ? dayjs(record.occurrence_date).format('YYYY-MM-DD HH:mm')
                          : '-'}
                      </span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">上报人</span>
                      <span className="mobile-card-value">{record.reporter || '-'}</span>
                    </div>
                  </div>
                  <div className="mobile-card-footer">
                    <Space>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => navigate(`/adverse-reaction/${record.id}`)}
                      >
                        详情
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => navigate(`/adverse-reaction/edit/${record.id}`)}
                      >
                        编辑
                      </Button>
                      <Popconfirm
                        title="确定要删除这条记录吗？"
                        onConfirm={() => handleDelete(record.id)}
                        disabled={!canDelete}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button
                          type="link"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          disabled={!canDelete}
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>暂无数据</div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AdverseReactionList;
