import React, { useState, useEffect } from 'react';
import { Table, Button, message, Select, Space, Card, Popconfirm, Tag, Empty, Row, Col, Statistic } from 'antd';
import { useIsMobile, useCan } from '../hooks';
import { useNavigate } from 'react-router-dom';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  QrcodeOutlined,
} from '@ant-design/icons';
import { inventoryAPI } from '../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;

const InventoryList = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const canDelete = useCan('inventory', 'delete');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [statistics, setStatistics] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // 获取盘点记录列表
  const loadData = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        status: statusFilter || undefined,
      };
      const result = await inventoryAPI.getInventories(params);
      if (result.success) {
        setData(result.data || []);
        setPagination(prev => ({
          ...prev,
          total: result.pagination?.total || 0,
        }));
      }
    } catch (error) {
      message.error('加载盘点记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadStatistics();
  }, [pagination.current, pagination.pageSize, statusFilter]);

  // 获取盘点统计
  const loadStatistics = async () => {
    try {
      setStatsLoading(true);
      const result = await inventoryAPI.getInventoriesStatistics();
      if (result.success) {
        setStatistics(result.data);
      }
    } catch (error) {
      console.error('加载盘点统计失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // 处理分页变化
  const handleTableChange = (page, pageSize) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize: pageSize || prev.pageSize,
    }));
  };

  // 创建新盘点记录
  const handleCreate = () => {
    navigate('/inventory/new');
  };

  // 查看盘点详情
  const handleView = id => {
    navigate(`/inventory/${id}`);
  };

  // 编辑盘点记录
  const handleEdit = id => {
    navigate(`/inventory/${id}/edit`);
  };

  // 删除盘点记录
  const handleDelete = async id => {
    try {
      const result = await inventoryAPI.deleteInventory(id);
      if (result.success) {
        message.success('删除成功');
        loadData();
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 获取状态标签
  const getStatusTag = status => {
    switch (status) {
      case '进行中':
        return (
          <Tag icon={<ClockCircleOutlined />} color="processing">
            进行中
          </Tag>
        );
      case '已完成':
        return (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已完成
          </Tag>
        );
      case '已取消':
        return (
          <Tag icon={<CloseCircleOutlined />} color="error">
            已取消
          </Tag>
        );
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // 列配置
  const columns = [
    {
      title: '盘点单号',
      dataIndex: 'inventory_no',
      key: 'inventory_no',
      width: 180,
      ellipsis: true,
    },
    {
      title: '盘点日期',
      dataIndex: 'inventory_date',
      key: 'inventory_date',
      width: 120,
      render: date => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '盘点类型',
      dataIndex: 'inventory_type',
      key: 'inventory_type',
      width: 120,
    },
    {
      title: '盘点人',
      dataIndex: 'inventory_person',
      key: 'inventory_person',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: status => getStatusTag(status),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: date => (date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record.id)}>
            详情
          </Button>
          {record.status === '进行中' && (
            <Button
              type="link"
              icon={<QrcodeOutlined />}
              onClick={() => navigate(`/inventory/${record.id}/scan`)}
            >
              扫码
            </Button>
          )}
          {record.status === '进行中' && (
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record.id)}>
              编辑
            </Button>
          )}
          <Popconfirm
            title="确定要删除这条盘点记录吗？删除后将无法恢复。"
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
    <div>
      <div
        style={{
          marginBottom: isMobile ? 12 : 16,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? 8 : 0,
        }}
      >
        <h2 style={{ fontSize: isMobile ? '18px' : '24px', margin: 0 }}>资产盘点</h2>
        <Space orientation={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }}>
          <Button
            onClick={() => navigate('/inventory/self')}
            block={isMobile}
            size={isMobile ? 'small' : 'middle'}
          >
            我的资产盘点
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            block={isMobile}
            size={isMobile ? 'small' : 'middle'}
          >
            新建盘点
          </Button>
        </Space>
      </div>
      <div style={{ marginBottom: isMobile ? 12 : 16 }}>
        <Select
          placeholder="筛选状态"
          style={{ width: isMobile ? '100%' : 150 }}
          allowClear
          value={statusFilter || undefined}
          onChange={value => {
            setStatusFilter(value || '');
            setPagination({ ...pagination, current: 1 });
          }}
          size={isMobile ? 'small' : 'middle'}
        >
          <Option value="进行中">进行中</Option>
          <Option value="已完成">已完成</Option>
          <Option value="已取消">已取消</Option>
        </Select>
      </div>
      {statistics && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card loading={statsLoading} size="small">
              <Statistic title="盘点总数" value={statistics.total || 0} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card loading={statsLoading} size="small">
              <Statistic
                title="进行中"
                value={statistics.in_progress || 0}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card loading={statsLoading} size="small">
              <Statistic
                title="已完成"
                value={statistics.completed || 0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card loading={statsLoading} size="small">
              <Statistic
                title="已取消"
                value={statistics.cancelled || 0}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
      )}
      <Card>
        {/* 桌面端表格 */}
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: total => `共 ${total} 条`,
              onChange: handleTableChange,
              onShowSizeChange: handleTableChange,
            }}
            scroll={{ x: 1400 }}
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
                    <span className="mobile-card-title">{record.inventory_no || '-'}</span>
                    {getStatusTag(record.status)}
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">盘点日期</span>
                      <span className="mobile-card-value">
                        {record.inventory_date
                          ? dayjs(record.inventory_date).format('YYYY-MM-DD')
                          : '-'}
                      </span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">盘点类型</span>
                      <span className="mobile-card-value">{record.inventory_type || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">盘点人</span>
                      <span className="mobile-card-value">{record.inventory_person || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">创建时间</span>
                      <span className="mobile-card-value">
                        {record.created_at
                          ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm')
                          : '-'}
                      </span>
                    </div>
                    {record.remark && (
                      <div className="mobile-card-field" style={{ gridColumn: '1 / -1' }}>
                        <span className="mobile-card-label">备注</span>
                        <span className="mobile-card-value">{record.remark}</span>
                      </div>
                    )}
                  </div>
                  <div className="mobile-card-actions">
                    <Button
                      type="primary"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handleView(record.id)}
                      block
                    >
                      详情
                    </Button>
                    {record.status === '进行中' && (
                      <Button
                        size="small"
                        icon={<QrcodeOutlined />}
                        onClick={() => navigate(`/inventory/${record.id}/scan`)}
                        block
                      >
                        扫码
                      </Button>
                    )}
                    {record.status === '进行中' && (
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record.id)}
                        block
                      >
                        编辑
                      </Button>
                    )}
                    <Popconfirm
                      title="确定要删除这条盘点记录吗？删除后将无法恢复。"
                      onConfirm={() => handleDelete(record.id)}
              disabled={!canDelete}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="primary" danger size="small" icon={<DeleteOutlined />} block disabled={!canDelete}>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              ))}
              {/* 移动端分页 */}
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Space>
                  <Button
                    disabled={pagination.current === 1}
                    onClick={() =>
                      setPagination({ ...pagination, current: pagination.current - 1 })
                    }
                  >
                    上一页
                  </Button>
                  <span>
                    第 {pagination.current} / {Math.ceil(pagination.total / pagination.pageSize)} 页
                  </span>
                  <Button
                    disabled={
                      pagination.current >= Math.ceil(pagination.total / pagination.pageSize)
                    }
                    onClick={() =>
                      setPagination({ ...pagination, current: pagination.current + 1 })
                    }
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
      </Card>
    </div>
  );
};

export default InventoryList;
