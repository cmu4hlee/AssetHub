import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Select,
  Tag,
  Modal,
  Form,
  Input,
  Checkbox,
  Switch,
  Row,
  Col,
  Typography,
  Alert,
  Tabs,
  Drawer,
  Timeline,
  DatePicker,
  InputNumber,
  message,
  Spin,
  Popconfirm,
} from 'antd';

import {
  SettingOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  AuditOutlined,
  SaveOutlined,
  DeleteOutlined,
  PlusOutlined,
  HistoryOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { rolesPermissionsAPI, enhancedPermissionsAPI } from '../utils/api';
import useIsMobile from '../hooks/useIsMobile';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const EnhancedPermissionManagement = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState({
    role_permissions: [],
    user_permissions: [],
    denied_permissions: [],
    menu_permissions: []
  });
  const [userDataScope, setUserDataScope] = useState(null);
  const [dataScopeDefinitions, setDataScopeDefinitions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('permissions');
  const [userDrawerVisible, setUserDrawerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDataScopeDefinitions();
  }, []);

  const loadDataScopeDefinitions = async () => {
    try {
      const result = await enhancedPermissionsAPI.getDataScopeDefinitions();
      if (result.success) {
        setDataScopeDefinitions(result.data.scopes);
      }
    } catch (error) {
      console.error('加载数据范围定义失败:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const result = await rolesPermissionsAPI.getUsers();
      if (result.success) {
        setUsers(result.data);
      }
    } catch (error) {
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUserPermissions = async (userId) => {
    try {
      setLoading(true);
      const result = await enhancedPermissionsAPI.getUserPermissions(userId);
      if (result.success) {
        setUserPermissions(result.data);
      }
    } catch (error) {
      message.error('加载用户权限失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUserDataScope = async (userId) => {
    try {
      const result = await enhancedPermissionsAPI.getUserDataScope(userId);
      if (result.success) {
        setUserDataScope(result.data);
      }
    } catch (error) {
      console.error('加载用户数据范围失败:', error);
    }
  };

  const loadAuditLogs = async (userId = null) => {
    try {
      setAuditLoading(true);
      const params = {
        page: 1,
        pageSize: 20,
        target_type: userId ? 'user' : null,
        target_id: userId || null
      };
      const result = await enhancedPermissionsAPI.getAuditLogs(params);
      if (result.success) {
        setAuditLogs(result.data.logs);
      }
    } catch (error) {
      message.error('加载审计日志失败');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleUserSelect = async (userId) => {
    const user = users.find(u => u.id === userId);
    setSelectedUser(user);
    await Promise.all([
      loadUserPermissions(userId),
      loadUserDataScope(userId),
      loadAuditLogs(userId)
    ]);
    setUserDrawerVisible(true);
  };

  const handleDataScopeChange = async (userId, dataScope, customDepartments) => {
    try {
      setSaving(true);
      const result = await enhancedPermissionsAPI.setUserDataScope(userId, {
        data_scope: dataScope,
        custom_department_codes: customDepartments
      });
      if (result.success) {
        message.success('数据范围设置成功');
        loadUserDataScope(userId);
      } else {
        message.error(result.message || '设置失败');
      }
    } catch (error) {
      message.error('设置数据范围失败');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPermission = async (userId, permission) => {
    try {
      const result = await enhancedPermissionsAPI.addUserPermission(userId, permission);
      if (result.success) {
        message.success('权限添加成功');
        loadUserPermissions(userId);
      } else {
        message.error(result.message || '添加失败');
      }
    } catch (error) {
      message.error('添加权限失败');
    }
  };

  const handleRemovePermission = async (userId, permission) => {
    try {
      const result = await enhancedPermissionsAPI.removeUserPermission(userId, permission);
      if (result.success) {
        message.success('权限移除成功');
        loadUserPermissions(userId);
      } else {
        message.error(result.message || '移除失败');
      }
    } catch (error) {
      message.error('移除权限失败');
    }
  };

  const handleDenyPermission = async (userId, permission) => {
    try {
      const result = await enhancedPermissionsAPI.denyUserPermission(userId, permission);
      if (result.success) {
        message.success('权限已拒绝');
        loadUserPermissions(userId);
      } else {
        message.error(result.message || '操作失败');
      }
    } catch (error) {
      message.error('拒绝权限失败');
    }
  };

  const handleRemoveDeny = async (userId, permission) => {
    try {
      const result = await enhancedPermissionsAPI.removeUserPermissionDeny(userId, permission);
      if (result.success) {
        message.success('权限拒绝已移除');
        loadUserPermissions(userId);
      } else {
        message.error(result.message || '操作失败');
      }
    } catch (error) {
      message.error('移除权限拒绝失败');
    }
  };

  const permissionColumns = [
    {
      title: '权限代码',
      dataIndex: 'permission',
      key: 'permission',
      render: (text) => <code>{text}</code>
    },
    {
      title: '来源',
      key: 'source',
      render: (_, record) => {
        if (userPermissions.denied_permissions.includes(record.permission)) {
          return <Tag color="red">已拒绝</Tag>;
        }
        if (userPermissions.user_permissions.includes(record.permission)) {
          return <Tag color="green">用户额外</Tag>;
        }
        return <Tag color="blue">角色继承</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          {!userPermissions.denied_permissions.includes(record.permission) && (
            <Button
              type="link"
              danger
              size="small"
              onClick={() => handleDenyPermission(selectedUser?.id, record.permission)}
            >
              拒绝
            </Button>
          )}
          {userPermissions.denied_permissions.includes(record.permission) && (
            <Button
              type="link"
              size="small"
              onClick={() => handleRemoveDeny(selectedUser?.id, record.permission)}
            >
              取消拒绝
            </Button>
          )}
          <Popconfirm
            title="确认移除"
            description="从用户权限中移除此权限？"
            onConfirm={() => handleRemovePermission(selectedUser?.id, record.permission)}
          >
            <Button type="link" danger size="small">移除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24, backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
      <Card
        title={
          <Space>
            <SafetyCertificateOutlined />
            <span>增强权限管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadUsers}>
              刷新
            </Button>
          </Space>
        }
        style={{ borderRadius: 8 }}
      >
        <Alert title="权限管理说明"
          description="此页面用于管理用户的增强权限，包括数据范围、额外权限、权限拒绝等。超级管理员和系统管理员可以管理所有用户的权限。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <div className="hide-on-mobile">
          <Table
            dataSource={users}
            columns={[
              {
                title: '用户ID',
                dataIndex: 'id',
                key: 'id',
                width: 80
              },
              {
                title: '用户名',
                dataIndex: 'username',
                key: 'username'
              },
              {
                title: '姓名',
                dataIndex: 'real_name',
                key: 'real_name'
              },
              {
                title: '角色',
                dataIndex: 'role',
                key: 'role',
                render: (role) => {
                  const roleNames = {
                    'super_admin': '超级管理员',
                    'system_admin': '系统管理员',
                    'asset_admin': '资产管理员',
                    'department_admin': '科室管理员',
                    'user': '普通用户'
                  };
                  return <Tag>{roleNames[role] || role}</Tag>;
                }
              },
              {
                title: '操作',
                key: 'action',
                render: (_, record) => (
                  <Button type="primary" size="small" onClick={() => handleUserSelect(record.id)}>
                    管理权限
                  </Button>
                )
              }
            ]}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {users.length === 0 ? (
            !loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无用户</div> : null
          ) : (
            users.map(record => {
              const roleNames = {
                'super_admin': '超级管理员',
                'system_admin': '系统管理员',
                'asset_admin': '资产管理员',
                'department_admin': '科室管理员',
                'user': '普通用户'
              };
              return (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{record.real_name || record.username}</span>
                    <span className="mobile-card-badge">
                      <Tag>{roleNames[record.role] || record.role || '-'}</Tag>
                    </span>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">用户ID</span>
                      <span className="mobile-card-value">{record.id}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">用户名</span>
                      <span className="mobile-card-value">{record.username || '-'}</span>
                    </div>
                  </div>
                  <div className="mobile-card-actions">
                    <Button size="small" type="primary" onClick={() => handleUserSelect(record.id)}>
                      管理权限
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Drawer
        title={
          <Space>
            <UserOutlined />
            <span>用户权限管理 - {selectedUser?.real_name || selectedUser?.username}</span>
          </Space>
        }
        placement="right"
        styles={{ wrapper: { width: 720 } }}
        open={userDrawerVisible}
        onClose={() => setUserDrawerVisible(false)}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'permissions',
              label: '权限管理',
              children: (
                <div>
                  <Card title="当前权限" size="small" style={{ marginBottom: 16 }}>
                    <Space wrap>
                      <Tag color="blue">
                        角色权限: {userPermissions.role_permissions?.length || 0} 项
                      </Tag>
                      <Tag color="green">
                        用户额外: {userPermissions.user_permissions?.length || 0} 项
                      </Tag>
                      <Tag color="red">
                        已拒绝: {userPermissions.denied_permissions?.length || 0} 项
                      </Tag>
                    </Space>
                  </Card>

                  <div className="hide-on-mobile">
                    <Table
                      dataSource={[
                        ...(userPermissions.role_permissions || []),
                        ...(userPermissions.user_permissions || [])
                      ].map(p => ({ permission: p }))}
                      columns={permissionColumns}
                      rowKey="permission"
                      size="small"
                      pagination={false}
                    />
                  </div>
                  <div className="mobile-table-cards show-on-mobile">
                    {[
                      ...(userPermissions.role_permissions || []),
                      ...(userPermissions.user_permissions || [])
                    ].map((p, idx) => {
                      let sourceTag = <Tag color="blue">角色权限</Tag>;
                      if (userPermissions.denied_permissions?.includes(p)) sourceTag = <Tag color="red">已拒绝</Tag>;
                      else if (userPermissions.user_permissions?.includes(p)) sourceTag = <Tag color="green">用户额外</Tag>;
                      return (
                        <div key={`${p}-${idx}`} className="mobile-card-item">
                          <div className="mobile-card-body">
                            <div className="mobile-card-field mobile-card-field--full">
                              <span className="mobile-card-label">权限代码</span>
                              <span className="mobile-card-value"><code>{p}</code></span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">来源</span>
                              <span className="mobile-card-value">{sourceTag}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            },
            {
              key: 'datascope',
              label: '数据范围',
              children: (
                <div>
                  <Card title="数据访问范围" size="small">
                    <Form layout="vertical">
                      <Form.Item label="数据范围类型">
                        <Select
                          value={userDataScope?.data_scope}
                          onChange={(value) => handleDataScopeChange(
                            selectedUser?.id,
                            value,
                            userDataScope?.custom_department_codes
                          )}
                          style={{ width: 200 }}
                        >
                          {dataScopeDefinitions.map(scope => (
                            <Option key={scope.key} value={scope.key}>
                              {scope.label}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item label="说明">
                        <Paragraph type="secondary">
                          {dataScopeDefinitions.find(
                            s => s.key === userDataScope?.data_scope
                          )?.description || '选择数据范围类型'}
                        </Paragraph>
                      </Form.Item>
                    </Form>
                  </Card>
                </div>
              )
            },
            {
              key: 'audit',
              label: (
                <span>
                  <AuditOutlined />
                  审计日志
                </span>
              ),
              children: (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => loadAuditLogs(selectedUser?.id)}
                    >
                      刷新日志
                    </Button>
                  </div>
                  <Timeline
                    items={auditLogs.map(log => ({
                      color: log.action === 'grant' ? 'green' :
                             log.action === 'deny' ? 'red' :
                             log.action === 'revoke' ? 'orange' : 'blue',
                      children: (
                        <div>
                          <Text strong>
                            {log.action === 'grant' && '授予权限'}
                            {log.action === 'deny' && '拒绝权限'}
                            {log.action === 'revoke' && '移除权限'}
                            {log.action === 'change_scope' && '修改数据范围'}
                          </Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {log.permission || log.target_type}
                          </Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(log.created_at).toLocaleString()}
                          </Text>
                        </div>
                      )
                    }))}
                  />
                  {auditLogs.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                      暂无审计日志
                    </div>
                  )}
                </div>
              )
            }
          ]}
        />
      </Drawer>
    </div>
  );
};

export default EnhancedPermissionManagement;
