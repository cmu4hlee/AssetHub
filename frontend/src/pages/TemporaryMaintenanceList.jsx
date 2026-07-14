import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../hooks';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  message,
  Popconfirm,
  Row,
  Col,
  Statistic,
  DatePicker,
  Tooltip,
  Typography,
} from 'antd';

import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { maintenanceAPI } from '../api/domains/maintenance';
import useIsMobile from '../hooks/useIsMobile';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const STATUS_CONFIG = {
  已完成: { color: 'success', icon: <CheckCircleOutlined /> },
  进行中: { color: 'processing', icon: <ClockCircleOutlined /> },
  已取消: { color: 'default', icon: <ClockCircleOutlined /> },
};

const TemporaryMaintenanceList = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const canDelete = useCan('maintenance', 'delete');
  const canEdit = useCan('maintenance', 'edit');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState([]);
  const [statistics, setStatistics] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        maintenance_type: '临时保养',
        keyword: searchKeyword || undefined,
        status: statusFilter || undefined,
        start_date: dateRange?.[0]?.format('YYYY-MM-DD') || undefined,
        end_date: dateRange?.[1]?.format('YYYY-MM-DD') || undefined,
      };
      const response = await maintenanceAPI.getMaintenanceLogs(params);
      if (response.success) {
        setData(response.data || []);
        setTotal(response.pagination?.total || 0);
      }
    } catch (error) {
      message.error('加载临时保养列表失败');
      console.error('加载临时保养列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination, searchKeyword, statusFilter, dateRange]);

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await maintenanceAPI.getMaintenanceStatistics({ maintenance_type: '临时保养' });
      if (response.success) {
        setStatistics(response.data || {});
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  const handleDelete = async id => {
    try {
      const response = await maintenanceAPI.deleteMaintenanceLog(id);
      if (response.success) {
        message.success('删除成功');
        fetchData();
        fetchStatistics();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
      fixed: 'left',
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '保养日期',
      dataIndex: 'maintenance_date',
      key: 'maintenance_date',
      width: 120,
      render: v => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '保养人',
      dataIndex: 'maintenance_person',
      key: 'maintenance_person',
      width: 100,
    },
    {
      title: '保养内容',
      dataIndex: 'maintenance_content',
      key: 'maintenance_content',
      ellipsis: true,
    },
    {
      title: '保养费用',
      dataIndex: 'maintenance_cost',
      key: 'maintenance_cost',
      width: 120,
      render: v => (v != null ? `¥${Number(v).toLocaleString()}` : '-'),
    },
    {
      title: '耗时(分)',
      dataIndex: 'maintenance_duration',
      key: 'maintenance_duration',
      width: 90,
      render: v => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: status => {
        const cfg = STATUS_CONFIG[status] || { color: 'default' };
        return <Tag color={cfg.color} icon={cfg.icon}>{status}</Tag>;
      },
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      render: v => v || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/maintenance/temporary/edit/${record.id}`)}>
            查看
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/maintenance/temporary/edit/${record.id}`)}>
            编辑
          </Button>
          <Popconfirm title="确认删除该临时保养记录？" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <ToolOutlined />
            临时保养管理
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchData(); fetchStatistics(); }} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/maintenance/temporary/new')}>
              新建临时保养
            </Button>
          </Space>
        }
      >
        {/* 统计卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="临时保养总数" value={statistics.total_count || 0} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="已完成" value={statistics.completed_count || 0} styles={{ content: { color: '#52c41a' } }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="进行中" value={statistics.in_progress_count || 0} styles={{ content: { color: '#1677ff' } }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="保养费用"
                value={statistics.total_cost || 0}
                prefix="¥"
                styles={{ content: { color: '#fa8c16' } }}
              />
            </Card>
          </Col>
        </Row>

        {/* 搜索筛选 */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <Input
            placeholder="搜索资产编号/名称/保养人"
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            onPressEnter={() => { setPagination({ ...pagination, page: 1 }); }}
            style={{ width: 260 }}
            prefix={<SearchOutlined />}
            allowClear
          />
          <Select
            placeholder="状态筛选"
            value={statusFilter || undefined}
            onChange={v => setStatusFilter(v || '')}
            style={{ width: 120 }}
            allowClear
            options={[
              { value: '进行中', label: '进行中' },
              { value: '已完成', label: '已完成' },
              { value: '已取消', label: '已取消' },
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={dates => setDateRange(dates || [])}
            placeholder={['开始日期', '结束日期']}
          />
          <Button type="primary" onClick={() => { setPagination({ ...pagination, page: 1 }); }}>
            查询
          </Button>
        </div>

        {/* PC 端表格 */}
        <div className="hide-on-mobile">
          <Table
            rowKey="id"
            loading={loading}
            dataSource={data}
            columns={columns}
            scroll={{ x: 1300 }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.pageSize,
              total,
              showSizeChanger: true,
              showTotal: t => `共 ${t} 条`,
              onChange: (page, pageSize) => setPagination({ page, pageSize }),
            }}
          />
        </div>

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {data.length === 0 ? (
            !loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无临时保养记录</div> : null
          ) : (
            data.map(record => {
              const cfg = STATUS_CONFIG[record.status] || { color: 'default' };
              return (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{record.asset_name || record.asset_code || `#${record.id}`}</span>
                    <span className="mobile-card-badge">
                      <Tag color={cfg.color} icon={cfg.icon}>{record.status}</Tag>
                    </span>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">资产编号</span>
                      <span className="mobile-card-value">{record.asset_code || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">保养日期</span>
                      <span className="mobile-card-value">{record.maintenance_date ? dayjs(record.maintenance_date).format('YYYY-MM-DD') : '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">保养人</span>
                      <span className="mobile-card-value">{record.maintenance_person || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">部门</span>
                      <span className="mobile-card-value">{record.department || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">保养费用</span>
                      <span className="mobile-card-value" style={{ color: '#fa8c16', fontWeight: 600 }}>
                        {record.maintenance_cost != null ? `¥${Number(record.maintenance_cost).toLocaleString()}` : '-'}
                      </span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">耗时</span>
                      <span className="mobile-card-value">{record.maintenance_duration ? `${record.maintenance_duration}分钟` : '-'}</span>
                    </div>
                    {record.maintenance_content && (
                      <div className="mobile-card-field mobile-card-field--full">
                        <span className="mobile-card-label">保养内容</span>
                        <span className="mobile-card-value">{record.maintenance_content}</span>
                      </div>
                    )}
                  </div>
                  <div className="mobile-card-actions">
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={<EyeOutlined />}
                      onClick={() => navigate(`/maintenance/temporary/edit/${record.id}`)}
                    >
                      查看
                    </Button>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => navigate(`/maintenance/temporary/edit/${record.id}`)}
                    >
                      编辑
                    </Button>
                    <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
                      <Button size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
};

export default TemporaryMaintenanceList;
