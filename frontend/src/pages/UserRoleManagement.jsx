import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Row,
  Col,
  Transfer,
  Spin,
  Alert,
  Badge,
  Tabs,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  TeamOutlined,
  SettingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { userAPI, rolesPermissionsAPI, departmentsAPI } from '../utils/api';
import { getApiErrorMessage } from '../api/client';
import auth from '../utils/auth';

const { Option } = Select;
const { TextArea } = Input;

const UserRoleManagement = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState({
    keyword: '',
    role: '',
    department: '',
  });

  // 用户角色分配模态框
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [roleLoading, setRoleLoading] = useState(false);

  // 批量分配角色模态框
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [batchRole, setBatchRole] = useState(null);

  useEffect(() => {
    loadRoles();
    loadDepartments();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [pagination.current, pagination.pageSize]);

  // 加载用户列表
  const loadUsers = async () => {
    try {
      setLoading(true);
      const result = await userAPI.getUsers({
        page: pagination.current,
        pageSize: pagination.pageSize,
        keyword: filters.keyword || undefined,
        role: filters.role || undefined,
      });
      if (result.success) {
        setUsers(result.data || []);
        setPagination(prev => ({
          ...prev,
          total: result.pagination?.total || 0,
        }));
      }
    } catch (error) {
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 筛选处理
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    loadUsers();
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value || '' }));
  };

  // 加载角色列表
  const loadRoles = async () => {
    try {
      const result = await rolesPermissionsAPI.getRoles();
      if (result.success) {
        const processedRoles = result.data.map(role => ({
          value: role.role || role.role_code || role.value,
          label: role.label || role.role_name || role.value || role.role_code || role.role,
        }));
        setRoles(processedRoles);
        setAvailableRoles(processedRoles);
      }
    } catch (error) {
      console.error('加载角色列表失败:', error);
    }
  };

  // 加载部门列表
  const loadDepartments = async () => {
    try {
      const result = await departmentsAPI.getDepartments({ pageSize: 1000 });
      if (result.success) {
        setDepartments(result.data || []);
      }
    } catch (error) {
      console.error('加载部门列表失败:', error);
    }
  };

  // 打开用户角色分配模态框
  const handleAssignRole = async user => {
    setSelectedUser(user);
    setRoleModalVisible(true);
    await loadUserRoles(user.id);
  };

  // 加载用户的角色
  const loadUserRoles = async userId => {
    try {
      setRoleLoading(true);
      const result = await userAPI.getUserRoles(userId);
      if (result.success) {
        const roles = result.data || [];
        // 取当前租户下的角色（单角色 per tenant）
        const currentTenantId = auth.getEffectiveTenantId();
        const currentRole = roles.find(r => r.tenant_id === currentTenantId);
        setUserRoles(currentRole ? [currentRole.role] : []);
      }
    } catch (error) {
      message.error('加载用户角色失败');
    } finally {
      setRoleLoading(false);
    }
  };

  // 保存用户角色
  const handleSaveUserRoles = async () => {
    if (!selectedUser) return;
    try {
      const tenantId = auth.getEffectiveTenantId();
      if (!tenantId) {
        message.error('无法获取当前企业信息');
        return;
      }
      const role = userRoles[0]; // 单角色
      if (!role) {
        message.warning('请选择角色');
        return;
      }
      await userAPI.updateUserRole(selectedUser.id, { tenant_id: tenantId, role });
      message.success('角色分配成功');
      setRoleModalVisible(false);
      loadUsers();
    } catch (error) {
      message.error(getApiErrorMessage(error, '角色分配失败'));
    }
  };

  // 批量分配角色
  const handleBatchAssignRole = () => {
    if (selectedUserIds.length === 0) {
      message.warning('请先选择用户');
      return;
    }
    setBatchModalVisible(true);
  };

  // 执行批量分配
  const handleConfirmBatchAssign = async () => {
    if (!batchRole) {
      message.warning('请选择要分配的角色');
      return;
    }
    const tenantId = auth.getEffectiveTenantId();
    if (!tenantId) {
      message.error('无法获取当前企业信息');
      return;
    }
    try {
      const result = await userAPI.batchAssignRoles({
        user_ids: selectedUserIds,
        tenant_id: tenantId,
        role: batchRole,
      });
      if (result.success) {
        message.success(`批量分配完成：成功 ${result.data?.success_count || selectedUserIds.length} 个`);
        setBatchModalVisible(false);
        setSelectedUserIds([]);
        setBatchRole(null);
        loadUsers();
      }
    } catch (error) {
      message.error(getApiErrorMessage(error, '批量分配失败'));
    }
  };

  // 删除用户
  const handleDelete = async id => {
    try {
      const result = await userAPI.deleteUser(id);
      if (result.success) {
        message.success('删除成功');
        loadUsers();
      }
    } catch (error) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  // 获取角色标签
  const getRoleTag = role => {
    const roleObj = roles.find(r => (r.value || r.role || r.role_code) === role);
    const roleLabel = roleObj?.label || role;

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

  // 获取状态标签
  const getStatusTag = status => {
    return status === 'active' ? (
      <Tag color="success">启用</Tag>
    ) : (
      <Tag color="error">禁用</Tag>
    );
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
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
      render: role => (role ? getRoleTag(role) : <Tag>未分配</Tag>),
    },
    {
      title: '部门',
      dataIndex: 'department_code',
      key: 'department_code',
      render: (code, record) => {
        const dept = departments.find(d => d.department_code === code);
        return dept?.department_name || code || '-';
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
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<TeamOutlined />}
            onClick={() => handleAssignRole(record)}
          >
            分配角色
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => window.location.href = `/users/edit/${record.id}`}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 行选择配置
  const rowSelection = {
    selectedRowKeys: selectedUserIds,
    onChange: setSelectedUserIds,
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
      <Card
        title={
          <Space>
            <UserOutlined />
            <span>用户与角色管理</span>
            <Tag color="blue">{pagination.total} 人</Tag>
          </Space>
        }
        extra={
          <Space>
            {selectedUserIds.length > 0 && (
              <Button type="primary" onClick={handleBatchAssignRole}>
                批量分配角色 ({selectedUserIds.length})
              </Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={loadUsers}>
              刷新
            </Button>
          </Space>
        }
      >
        {/* 筛选条件 */}
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input.Search
              placeholder="搜索用户名/姓名/手机号"
              style={{ width: 250 }}
              allowClear
              value={filters.keyword}
              onChange={e => handleFilterChange('keyword', e.target.value)}
              onSearch={handleSearch}
            />
            <Select
              placeholder="筛选角色"
              style={{ width: 150 }}
              allowClear
              value={filters.role || undefined}
              onChange={value => {
                handleFilterChange('role', value);
                handleSearch();
              }}
            >
              {roles.map(role => (
                <Option key={role.value} value={role.value}>
                  {role.label}
                </Option>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => (window.location.href = '/users/new')}
            >
              新建用户
            </Button>
          </Space>
        </div>

        {/* 用户列表 */}
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: total => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            },
          }}
        />
      </Card>

      {/* 角色分配模态框 */}
      <Modal
        title={
          <Space>
            <TeamOutlined />
            <span>分配角色 - {selectedUser?.real_name || selectedUser?.username}</span>
          </Space>
        }
        open={roleModalVisible}
        onCancel={() => setRoleModalVisible(false)}
        onOk={handleSaveUserRoles}
        width={500}
        okText="保存"
        cancelText="取消"
        confirmLoading={roleLoading}
      >
        <Spin spinning={roleLoading}>
          <Alert title="角色分配说明"
            description="每个用户在当前企业下拥有一个角色。切换角色将覆盖之前的角色分配。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form layout="vertical">
            <Form.Item label="选择角色">
              <Select
                placeholder="请选择角色"
                value={userRoles[0] || undefined}
                onChange={value => setUserRoles(value ? [value] : [])}
                style={{ width: '100%' }}
              >
                {availableRoles.map(role => (
                  <Option key={role.value} value={role.value}>
                    {role.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        </Spin>
      </Modal>

      {/* 批量分配角色模态框 */}
      <Modal
        title="批量分配角色"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onOk={handleConfirmBatchAssign}
        okText="确认分配"
        cancelText="取消"
      >
        <Alert title={`已选择 ${selectedUserIds.length} 个用户`}
          description="批量分配角色将覆盖这些用户当前的角色，请谨慎操作。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form layout="vertical">
          <Form.Item label="选择角色" required>
            <Select
              placeholder="请选择要分配的角色"
              value={batchRole}
              onChange={setBatchRole}
              style={{ width: '100%' }}
            >
              {availableRoles.map(role => (
                <Option key={role.value} value={role.value}>
                  {role.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserRoleManagement;
