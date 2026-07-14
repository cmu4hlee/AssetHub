import { useState, useEffect } from 'react';
import { useIsMobile, useCan } from '../hooks';
import { Table, Button, Space, Input, Select, message, Popconfirm, Tag, Empty, Card } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tenantAPI } from '../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { Search } = Input;

const TenantList = () => {
  const canDelete = useCan('tenant', 'delete');
  const canEdit = useCan('tenant', 'edit');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState({
    keyword: '',
    status: '',
  });

  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await tenantAPI.getTenants({
        page: pagination.current,
        pageSize: pagination.pageSize,
        keyword: filters.keyword || undefined,
        status: filters.status || undefined,
      });
      if (result.success) {
        setData(result.data);
        setPagination({
          ...pagination,
          total: result.pagination.total,
        });
      }
    } catch (error) {
      message.error(error.response?.data?.message || '加载企业列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async id => {
    try {
      const result = await tenantAPI.deleteTenant(id);
      if (result.success) {
        message.success('企业已停用');
        loadData();
      }
    } catch (error) {
      message.error(error.response?.data?.message || '停用失败');
    }
  };

  const getStatusTag = status => {
    return status === 'active' ? <Tag color="success">启用</Tag> : <Tag color="error">停用</Tag>;
  };

  const getSubscriptionTypeTag = type => {
    const typeMap = {
      free: { text: '免费版', color: 'default' },
      basic: { text: '基础版', color: 'blue' },
      premium: { text: '高级版', color: 'purple' },
      enterprise: { text: '企业版', color: 'gold' },
    };
    const config = typeMap[type] || { text: type, color: 'default' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '企业编码',
      dataIndex: 'tenant_code',
      key: 'tenant_code',
      width: 120,
    },
    {
      title: '企业名称',
      dataIndex: 'tenant_name',
      key: 'tenant_name',
    },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      key: 'contact_person',
      render: person => person || <span style={{ color: '#999' }}>未设置</span>,
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      key: 'contact_phone',
      render: phone => phone || <span style={{ color: '#999' }}>未设置</span>,
    },
    {
      title: '订阅类型',
      dataIndex: 'subscription_type',
      key: 'subscription_type',
      render: type => getSubscriptionTypeTag(type),
    },
    {
      title: '最大用户数',
      dataIndex: 'max_users',
      key: 'max_users',
      width: 100,
      render: count => count || '-',
    },
    {
      title: '最大资产数',
      dataIndex: 'max_assets',
      key: 'max_assets',
      width: 100,
      render: count => count || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: status => getStatusTag(status),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: time => (time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/tenants/${record.id}`)}
          >
            详情
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/tenants/edit/${record.id}`)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要停用这个企业吗？停用后该企业下的用户将无法登录。"
            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              停用
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
        <h2 style={{ fontSize: isMobile ? '18px' : '24px', margin: 0 }}>企业管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/tenants/new')}
          block={isMobile}
          size={isMobile ? 'small' : 'middle'}
        >
          新建企业
        </Button>
      </div>
      <div
        style={{
          marginBottom: isMobile ? 12 : 16,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 8 : 12,
        }}
      >
        <Search
          placeholder="搜索企业编码/名称/联系人"
          style={{ width: isMobile ? '100%' : 300 }}
          allowClear
          value={filters.keyword}
          onChange={e => setFilters({ ...filters, keyword: e.target.value })}
          onSearch={() => {
            setPagination({ ...pagination, current: 1 });
            loadData();
          }}
          enterButton={<SearchOutlined />}
          size={isMobile ? 'small' : 'middle'}
        />
        <Select
          placeholder="状态"
          style={{ width: isMobile ? '100%' : 120 }}
          allowClear
          value={filters.status || undefined}
          onChange={value => {
            setFilters({ ...filters, status: value || '' });
            setPagination({ ...pagination, current: 1 });
          }}
          size={isMobile ? 'small' : 'middle'}
        >
          <Option value="active">启用</Option>
          <Option value="inactive">停用</Option>
        </Select>
      </div>

      {/* 桌面端表格 */}
      <div className="hide-on-mobile">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: total => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            },
          }}
        />
      </div>

      {/* 移动端卡片列表 */}
      <div className="mobile-table-cards show-on-mobile">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
        ) : Array.isArray(data) && data.length > 0 ? (
          <>
            {data.map(record => (
              <Card key={record.id} style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 8 }}>
                    {record.tenant_name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {getStatusTag(record.status)}
                    {getSubscriptionTypeTag(record.subscription_type)}
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ color: '#8c8c8c', fontSize: '12px' }}>企业编码</div>
                  <div>{record.tenant_code}</div>
                </div>
                {record.contact_person && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ color: '#8c8c8c', fontSize: '12px' }}>联系人</div>
                    <div>{record.contact_person}</div>
                  </div>
                )}
                {record.contact_phone && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ color: '#8c8c8c', fontSize: '12px' }}>联系电话</div>
                    <div>{record.contact_phone}</div>
                  </div>
                )}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ color: '#8c8c8c', fontSize: '12px' }}>最大用户数</div>
                  <div>{record.max_users || '-'}</div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ color: '#8c8c8c', fontSize: '12px' }}>最大资产数</div>
                  <div>{record.max_assets || '-'}</div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: '#8c8c8c', fontSize: '12px' }}>创建时间</div>
                  <div style={{ fontSize: '12px' }}>
                    {record.created_at
                      ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')
                      : '-'}
                  </div>
                </div>
                <Space orientation="vertical" style={{ width: '100%' }} size="small">
                  <Button
                    type="primary"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => navigate(`/tenants/${record.id}`)}
                    block
                  >
                    详情
                  </Button>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => navigate(`/tenants/edit/${record.id}`)}
                    block
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确定要停用这个企业吗？"
                    onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button type="primary" danger size="small" icon={<DeleteOutlined />} block disabled={!canDelete}>
                      停用
                    </Button>
                  </Popconfirm>
                </Space>
              </Card>
            ))}
            {/* 移动端分页 */}
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <Space>
                <Button
                  disabled={pagination.current === 1}
                  onClick={() => setPagination({ ...pagination, current: pagination.current - 1 })}
                >
                  上一页
                </Button>
                <span>
                  第 {pagination.current} / {Math.ceil(pagination.total / pagination.pageSize)} 页
                </span>
                <Button
                  disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                  onClick={() => setPagination({ ...pagination, current: pagination.current + 1 })}
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
    </div>
  );
};

export default TenantList;
