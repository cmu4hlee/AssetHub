import { useState, useEffect } from 'react';
import { useIsMobile, useCan } from '../hooks';
import { Table, Button, Space, Input, Select, message, Popconfirm, Tag, Empty, Tabs } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { userAPI, rolesPermissionsAPI } from '../utils/api';

const { Option } = Select;
const { Search } = Input;

const UserList = () => {
  const canDelete = useCan('user', 'delete');
  const canEdit = useCan('user', 'edit');
  const [data, setData] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingRequestsLoading, setPendingRequestsLoading] = useState(false);
  const isMobile = useIsMobile();
  const [roles, setRoles] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState({
    keyword: '',
    role: '',
    status: '',
  });

  const navigate = useNavigate();

  useEffect(() => {
    loadRoles();
    loadData();
  }, [pagination.current, pagination.pageSize, filters]);

  // 加载待审核的加入企业请求
  const loadPendingRequests = async () => {
    try {
      setPendingRequestsLoading(true);
      const result = await userAPI.getPendingRoleRequests();
      if (result.success) {
        setPendingRequests(result.data);
      }
    } catch (error) {
      message.error('加载待审核请求失败');
    } finally {
      setPendingRequestsLoading(false);
    }
  };

  // 审核加入企业请求
  const handleApproveRequest = async (id, approved) => {
    try {
      const result = await userAPI.approveRoleRequest(id, { approved });
      if (result.success) {
        message.success(approved ? '批准成功' : '拒绝成功');
        loadPendingRequests();
      }
    } catch (error) {
      message.error(error.response?.data?.message || '审核失败');
    }
  };

  const loadRoles = async () => {
    try {
      // 优先使用 rolesPermissionsAPI，如果失败则使用 userAPI（兼容旧系统）
      let result = await rolesPermissionsAPI.getRoles();
      if (result.success && result.data && result.data.length > 0) {
        setRoles(result.data);
      } else {
        // 回退到 userAPI
        result = await userAPI.getRoles();
        if (result.success) {
          // 转换为统一格式
          const formattedRoles = result.data.map(role => ({
            role: role.value || role.role_code || role.role,
            label: role.label || role.role_name || role.value || role.role_code || role.role,
          }));
          setRoles(formattedRoles);
        }
      }
    } catch (error) {
      console.error('加载角色列表失败:', error);
      // 如果 rolesPermissionsAPI 失败，尝试使用 userAPI
      try {
        const result = await userAPI.getRoles();
        if (result.success) {
          const formattedRoles = result.data.map(role => ({
            role: role.value || role.role_code || role.role,
            label: role.label || role.role_name || role.value || role.role_code || role.role,
          }));
          setRoles(formattedRoles);
        }
      } catch (fallbackError) {
        console.error('回退加载角色列表也失败:', fallbackError);
      }
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await userAPI.getUsers({
        page: pagination.current,
        pageSize: pagination.pageSize,
        keyword: filters.keyword || undefined,
        role: filters.role || undefined,
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
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async id => {
    try {
      const result = await userAPI.deleteUser(id);
      if (result.success) {
        message.success('删除成功');
        loadData();
      }
    } catch (error) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  const getRoleTag = role => {
    // 从角色列表中查找角色名称
    const roleObj = roles.find(r => (r.role || r.role_code || r.value) === role);
    const roleLabel = roleObj?.label || roleObj?.role_name || role;

    // 根据角色类型设置颜色
    const roleColorMap = {
      super_admin: 'magenta',
      system_admin: 'red',
      asset_admin: 'blue',
      department_admin: 'green',
      metrology_admin: 'cyan',
      quality_admin: 'purple',
      maintenance_admin: 'orange',
      maintenance_engineer: 'gold',
      acceptance_admin: 'geekblue',
      transfer_admin: 'volcano',
      inventory_admin: 'lime',
      user: 'default',
    };
    const color = roleColorMap[role] || 'default';

    return <Tag color={color}>{roleLabel}</Tag>;
  };

  const getStatusTag = status => {
    return status === 'active' ? <Tag color="success">启用</Tag> : <Tag color="error">禁用</Tag>;
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '真实姓名',
      dataIndex: 'real_name',
      key: 'real_name',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: role => getRoleTag(role),
    },
    {
      title: '管理科室',
      dataIndex: 'managed_departments',
      key: 'managed_departments',
      render: departments => {
        if (!departments || departments.length === 0) {
          return <span style={{ color: '#999' }}>无</span>;
        }
        return <Tag>{departments.length} 个科室</Tag>;
      },
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      render: phone => phone || <span style={{ color: '#999' }}>未设置</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => getStatusTag(status),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: time => (time ? new Date(time).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/users/edit/${record.id}`)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
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

  // 待审核请求的表格列
  const pendingRequestColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '真实姓名',
      dataIndex: 'real_name',
      key: 'real_name',
    },
    {
      title: '申请角色',
      dataIndex: 'role',
      key: 'role',
      render: role => getRoleTag(role),
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      render: phone => phone || <span style={{ color: '#999' }}>未设置</span>,
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: time => (time ? new Date(time).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => handleApproveRequest(record.id, true)}
          >
            批准
          </Button>
          <Button
            danger
            icon={<CloseOutlined />}
            onClick={() => handleApproveRequest(record.id, false)}
          >
            拒绝
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ fontSize: isMobile ? '18px' : '24px', marginBottom: 16 }}>用户管理</h2>

      <Tabs
        onChange={activeKey => {
          if (activeKey === 'pending') {
            loadPendingRequests();
          }
        }}
        items={[
          {
            key: 'users',
            label: '用户列表',
            children: (
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
                  <span></span>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/users/new')}
                    block={isMobile}
                    size={isMobile ? 'small' : 'middle'}
                  >
                    新建用户
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
                    placeholder="搜索用户名/姓名/手机号"
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
                    placeholder="角色"
                    style={{ width: isMobile ? '100%' : 150 }}
                    allowClear
                    value={filters.role || undefined}
                    onChange={value => {
                      setFilters({ ...filters, role: value || '' });
                      setPagination({ ...pagination, current: 1 });
                    }}
                    size={isMobile ? 'small' : 'middle'}
                  >
                    {roles.map(roleItem => {
                      const roleCode = roleItem.role || roleItem.role_code || roleItem.value;
                      const roleLabel = roleItem.label || roleItem.role_name || roleCode;
                      return (
                        <Option key={roleCode} value={roleCode}>
                          {roleLabel}
                        </Option>
                      );
                    })}
                  </Select>
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
                    <Option value="inactive">禁用</Option>
                  </Select>
                </div>

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
                        <div key={record.id} className="mobile-card-item">
                          <div className="mobile-card-header">
                            <span className="mobile-card-title">
                              {record.real_name || record.username}
                            </span>
                            {getStatusTag(record.status)}
                          </div>
                          <div className="mobile-card-body">
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">用户名</span>
                              <span className="mobile-card-value">{record.username || '-'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">角色</span>
                              <span className="mobile-card-value">{getRoleTag(record.role)}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">管理科室</span>
                              <span className="mobile-card-value">
                                {record.managed_departments && record.managed_departments.length > 0
                                  ? `${record.managed_departments.length} 个科室`
                                  : '无'}
                              </span>
                            </div>

                            <div className="mobile-card-field">
                              <span className="mobile-card-label">手机号</span>
                              <span className="mobile-card-value">{record.phone || '未设置'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">创建时间</span>
                              <span className="mobile-card-value">
                                {record.created_at
                                  ? new Date(record.created_at).toLocaleString()
                                  : '-'}
                              </span>
                            </div>
                          </div>
                          <div className="mobile-card-actions">
                            <Button
                              type="primary"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => navigate(`/users/edit/${record.id}`)}
                              block
                            >
                              编辑
                            </Button>
                            <Popconfirm
                              title="确定要删除这个用户吗？"
                              onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
                              okText="确定"
                              cancelText="取消"
                            >
                              <Button
                                type="primary"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                block
                              >
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
                            第 {pagination.current} /{' '}
                            {Math.ceil(pagination.total / pagination.pageSize)} 页
                          </span>
                          <Button
                            disabled={
                              pagination.current >=
                              Math.ceil(pagination.total / pagination.pageSize)
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
              </div>
            ),
          },
          {
            key: 'pending',
            label: '待审核加入请求',
            children: (
              <div>
                {/* 桌面端表格 */}
                <div className="hide-on-mobile">
                  <Table
                    columns={pendingRequestColumns}
                    dataSource={pendingRequests}
                    rowKey="id"
                    loading={pendingRequestsLoading}
                    pagination={false}
                  />
                </div>

                {/* 移动端卡片列表 */}
                <div className="mobile-table-cards show-on-mobile">
                  {pendingRequestsLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
                  ) : Array.isArray(pendingRequests) && pendingRequests.length > 0 ? (
                    <>
                      {pendingRequests.map(record => (
                        <div key={record.id} className="mobile-card-item">
                          <div className="mobile-card-header">
                            <span className="mobile-card-title">
                              {record.real_name || record.username}
                            </span>
                            <Tag color="warning">待审核</Tag>
                          </div>
                          <div className="mobile-card-body">
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">用户名</span>
                              <span className="mobile-card-value">{record.username || '-'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">角色</span>
                              <span className="mobile-card-value">{getRoleTag(record.role)}</span>
                            </div>

                            <div className="mobile-card-field">
                              <span className="mobile-card-label">手机号</span>
                              <span className="mobile-card-value">{record.phone || '未设置'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">申请时间</span>
                              <span className="mobile-card-value">
                                {record.created_at
                                  ? new Date(record.created_at).toLocaleString()
                                  : '-'}
                              </span>
                            </div>
                          </div>
                          <div className="mobile-card-actions">
                            <Button
                              type="primary"
                              size="small"
                              icon={<CheckOutlined />}
                              onClick={() => handleApproveRequest(record.id, true)}
                              block
                            >
                              批准
                            </Button>
                            <Button
                              type="primary"
                              danger
                              size="small"
                              icon={<CloseOutlined />}
                              onClick={() => handleApproveRequest(record.id, false)}
                              block
                            >
                              拒绝
                            </Button>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <Empty description="暂无待审核请求" />
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default UserList;
