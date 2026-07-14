import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, message, Card, Space, Tag, Tabs } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { userAPI, assetAPI, rolesPermissionsAPI, tenantAPI } from '../utils/api';
import { useCan, useCurrentUser } from '../hooks';

const { Option } = Select;
const { TextArea } = Input;

const UserForm = () => {
  const canDelete = useCan('user', 'delete');
  const canEdit = useCan('user', 'edit');
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [departmentLoading, setDepartmentLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [userTenantRoles, setUserTenantRoles] = useState([]);
  const [activeTabKey, setActiveTabKey] = useState('userInfo');
  const [newRoleTenantId, setNewRoleTenantId] = useState(null);
  const [newRoleValue, setNewRoleValue] = useState(null);
  const { user: currentUser } = useCurrentUser();
  const isEdit = !!id;

  useEffect(() => {
    loadDepartments();
    loadRoles();
    loadTenants();
    if (isEdit) {
      loadUser();
      loadUserTenantRoles();
    } else {
      // 新建用户时，清空表单并设置默认值
      form.resetFields();
      form.setFieldsValue({
        status: 'active',
        role: undefined, // 不预设角色，由管理员主动选择
        managed_departments: [],
      });
    }
  }, [id, form]);

  // 加载租户列表
  const loadTenants = async () => {
    try {
      const result = await tenantAPI.getTenants();
      if (result.success) {
        setTenants(result.data || []);
      }
    } catch (error) {
      console.error('加载租户列表失败:', error);
      message.error('加载租户列表失败');
    }
  };

  // 加载用户在各租户中的角色
  const loadUserTenantRoles = async () => {
    try {
      // 调用API获取用户在各租户中的角色
      const result = await userAPI.getUser(id);
      if (result.success && result.data && result.data.user_roles) {
        setUserTenantRoles(result.data.user_roles);
      } else {
        // 如果没有user_roles字段，尝试直接获取用户角色列表
        const rolesResult = await userAPI.getUserRoles(id);
        if (rolesResult.success) {
          setUserTenantRoles(rolesResult.data);
        } else {
          setUserTenantRoles([]);
        }
      }
    } catch (error) {
      console.error('加载用户租户角色失败:', error);
      message.error('加载用户租户角色失败');
      setUserTenantRoles([]);
    }
  };

  const loadDepartments = async (keyword = '') => {
    try {
      setDepartmentLoading(true);
      const result = await assetAPI.getDepartments(keyword.trim());
      if (result.success) {
        setDepartments(result.data);
      }
    } catch (error) {
      console.error('加载部门列表失败:', error);
    } finally {
      setDepartmentLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      // 优先使用 rolesPermissionsAPI，如果失败则使用 userAPI（兼容旧系统）
      let result = await rolesPermissionsAPI.getRoles();
      if (result.success && result.data && result.data.length > 0) {
        // 转换为兼容格式 { value, label }
        const formattedRoles = result.data.map(role => ({
          value: role.role || role.role_code,
          label: role.label || role.role_name || role.role || role.role_code,
        }));
        setRoles(formattedRoles);
      } else {
        // 回退到 userAPI
        result = await userAPI.getRoles();
        if (result.success) {
          setRoles(result.data);
        }
      }
    } catch (error) {
      console.error('加载角色列表失败:', error);
      // 如果 rolesPermissionsAPI 失败，尝试使用 userAPI
      try {
        const result = await userAPI.getRoles();
        if (result.success) {
          setRoles(result.data);
        }
      } catch (fallbackError) {
        console.error('回退加载角色列表也失败:', fallbackError);
      }
    }
  };

  const loadUser = async () => {
    try {
      setLoading(true);
      console.log(`Debug: 调用userAPI.getUser(${id})`);
      const result = await userAPI.getUser(id);
      console.log(`Debug: getUser返回结果:`, result);
      if (result.success) {
        // 先重置表单，再设置值
        form.resetFields();
        // nullish 兜底：后端 email/phone 为 null（JS null）时，Form.Item 收到 null 在某些版本下会渲染为 "null" 字符串。
        // 统一把 null/undefined 转成空字符串，让输入框正常显示为空。
        const safe = value => (value == null ? '' : value);
        form.setFieldsValue({
          ...result.data,
          email: safe(result.data.email),
          phone: safe(result.data.phone),
          real_name: safe(result.data.real_name),
          department_code: safe(result.data.department_code),
          password: undefined, // 不显示密码
          managed_departments: result.data.managed_departments || [], // 确保管理科室是数组
        });
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
      message.error('加载用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async values => {
    try {
      setLoading(true);

      if (isEdit) {
        const updateData = {
          real_name: values.real_name,
          role: values.role,
          managed_departments: values.managed_departments || [],
          email: values.email || null,
          phone: values.phone || null,
          status: values.status,
          updated_by: currentUser?.real_name || currentUser?.username || '',
        };

        // 如果修改了密码，添加密码字段
        if (values.password && values.password.trim() !== '') {
          updateData.password = values.password;
        }

        const result = await userAPI.updateUser(id, updateData);
        if (result.success) {
          message.success('更新成功');
          navigate('/users');
        }
      } else {
        // 创建用户
        const result = await userAPI.createUser(values);
        if (result.success) {
          message.success('创建成功');
          navigate('/users');
        }
      }
    } catch (error) {
      console.error('提交失败:', error);
      const errorMessage =
        error.response?.data?.message || error.message || (isEdit ? '更新失败' : '创建失败');
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 处理角色分配更新
  const handleRoleAssignment = async (tenantId, role) => {
    try {
      setLoading(true);
      // 调用API更新用户角色
      const result = await userAPI.updateUserRole(id, {
        tenant_id: tenantId,
        role,
        is_default: false,
      });

      if (result.success) {
        message.success(
          `已为用户分配${tenants.find(t => t.id === tenantId)?.tenant_name}的${role}角色`
        );
        // 更新本地状态
        setUserTenantRoles(prev => {
          const existingIndex = prev.findIndex(item => item.tenant_id === tenantId);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              role,
            };
            return updated;
          } else {
            return [
              ...prev,
              {
                tenant_id: tenantId,
                tenant_name: tenants.find(t => t.id === tenantId)?.tenant_name || `租户${tenantId}`,
                role,
                status: 'active',
              },
            ];
          }
        });
      } else {
        message.error(result.message || '角色分配失败');
      }
    } catch (error) {
      console.error('角色分配失败:', error);
      message.error(error.response?.data?.message || '角色分配失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理新增角色分配
  const handleAddRoleAssignment = async () => {
    try {
      const tenantId = newRoleTenantId;
      const role = newRoleValue;

      if (!tenantId || !role) {
        message.error('请选择空间和角色');
        return;
      }

      setLoading(true);
      // 调用API添加用户角色
      const result = await userAPI.updateUserRole(id, {
        tenant_id: tenantId,
        role,
        is_default: false,
      });

      if (result.success) {
        message.success(
          `已为用户添加${tenants.find(t => t.id === tenantId)?.tenant_name}的${role}角色`
        );
        // 刷新用户角色列表
        loadUserTenantRoles();
        // 清空选择
        setNewRoleTenantId(null);
        setNewRoleValue(null);
      } else {
        message.error(result.message || '添加角色失败');
      }
    } catch (error) {
      console.error('添加角色失败:', error);
      message.error(error.response?.data?.message || '添加角色失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理删除角色分配
  const handleDeleteRoleAssignment = async tenantId => {
    try {
      setLoading(true);
      // 调用API删除用户角色
      const result = await userAPI.deleteUserRole(id, tenantId);

      if (result.success) {
        message.success(`已删除用户在该空间的角色`);
        // 刷新用户角色列表
        loadUserTenantRoles();
      } else {
        message.error(result.message || '删除角色失败');
      }
    } catch (error) {
      console.error('删除角色失败:', error);
      message.error(error.response?.data?.message || '删除角色失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button onClick={() => navigate('/users')}>返回列表</Button>
      </div>
      <Card title={isEdit ? '编辑用户' : '新建用户'}>
        <Tabs
          activeKey={activeTabKey}
          onChange={setActiveTabKey}
          items={[
            {
              key: 'userInfo',
              label: '基本信息',
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSubmit}
                  style={{ maxWidth: 800 }}
                  initialValues={{
                    status: 'active', // 默认状态为启用
                    role: undefined, // 不预设角色，由管理员主动选择
                  }}
                >
                  <Form.Item
                    name="username"
                    label="用户名"
                    rules={[
                      { required: true, message: '请输入用户名' },
                      { min: 3, message: '用户名至少3个字符' },
                      { max: 20, message: '用户名最多20个字符' },
                    ]}
                  >
                    <Input placeholder="请输入用户名" disabled={isEdit} />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label={isEdit ? '新密码（留空则不修改）' : '密码'}
                    rules={
                      isEdit
                        ? []
                        : [
                            { required: true, message: '请输入密码' },
                            { min: 6, message: '密码至少6个字符' },
                          ]
                    }
                  >
                    <Input.Password placeholder={isEdit ? '留空则不修改密码' : '请输入密码'} />
                  </Form.Item>

                  <Form.Item
                    name="real_name"
                    label="真实姓名"
                    rules={[{ required: true, message: '请输入真实姓名' }]}
                  >
                    <Input placeholder="请输入真实姓名" />
                  </Form.Item>

                  <Form.Item
                    name="role"
                    label="默认角色"
                    rules={[{ required: true, message: '请选择默认角色' }]}
                  >
                    <Select placeholder="请选择默认角色">
                      {roles.map(role => (
                        <Option key={role.value} value={role.value}>
                          {role.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="managed_departments"
                    label="管理科室"
                    extra="可以选择多个科室，用于管理这些科室的资产"
                  >
                    <Select
                      mode="multiple"
                      placeholder="请选择管理科室"
                      showSearch
                      filterOption={(input, option) =>
                        (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      onSearch={value => loadDepartments(value)}
                      loading={departmentLoading}
                      allowClear
                      notFoundContent={departmentLoading ? '加载中...' : '暂无数据'}
                    >
                      {departments.map(dept => (
                        <Option key={dept.department_code} value={dept.department_code}>
                          {dept.department_name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="email"
                    label="邮箱"
                    rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
                  >
                    <Input placeholder="请输入邮箱（可选）" />
                  </Form.Item>

                  <Form.Item
                    name="phone"
                    label="手机号"
                    rules={[{ pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' }]}
                  >
                    <Input placeholder="请输入手机号（可选）" />
                  </Form.Item>

                  <Form.Item
                    name="status"
                    label="状态"
                    rules={[{ required: true, message: '请选择状态' }]}
                  >
                    <Select placeholder="请选择状态">
                      <Option value="active">启用</Option>
                      <Option value="inactive">禁用</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit" loading={loading}>
                        {isEdit ? '更新' : '创建'}
                      </Button>
                      <Button onClick={() => navigate('/users')}>取消</Button>
                    </Space>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'roleManagement',
              label: '角色管理',
              children: (
                <div style={{ maxWidth: 800 }}>
                  <h4 style={{ marginBottom: 16 }}>多空间角色分配</h4>
                  <p style={{ marginBottom: 16, color: '#666', fontSize: 14 }}>
                    为用户在不同空间（租户）中分配不同的角色，用户在不同空间中将拥有对应角色的权限。
                  </p>

                  {/* 租户角色分配列表 */}
                  <Card title="已分配角色" style={{ marginBottom: 20 }}>
                    {userTenantRoles.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>
                              空间名称
                            </th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>
                              分配角色
                            </th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>
                              状态
                            </th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>
                              修改角色
                            </th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>
                              删除
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {userTenantRoles.map((item, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '12px' }}>{item.tenant_name}</td>
                              <td style={{ padding: '12px' }}>
                                <Tag
                                  color={
                                    item.role === 'system_admin'
                                      ? 'red'
                                      : item.role === 'asset_admin'
                                        ? 'blue'
                                        : 'green'
                                  }
                                >
                                  {roles.find(r => r.value === item.role)?.label || item.role}
                                </Tag>
                              </td>
                              <td style={{ padding: '12px' }}>
                                <Tag color={item.status === 'active' ? 'green' : 'red'}>
                                  {item.status === 'active' ? '已启用' : '已禁用'}
                                </Tag>
                              </td>
                              <td style={{ padding: '12px' }}>
                                <Select
                                  value={item.role}
                                  onChange={role => handleRoleAssignment(item.tenant_id, role)}
                                  style={{ width: 150 }}
                                >
                                  {roles.map(role => (
                                    <Option key={role.value} value={role.value}>
                                      {role.label}
                                    </Option>
                                  ))}
                                </Select>
                              </td>
                              <td style={{ padding: '12px' }}>
                                <Button
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() => handleDeleteRoleAssignment(item.tenant_id)}
                                  loading={loading}
                                >
                                  删除
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                        暂无角色分配
                      </div>
                    )}
                  </Card>

                  {/* 新增角色分配 */}
                  <Card title="新增角色分配">
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                          选择空间
                        </label>
                        <Select
                          placeholder="请选择要分配角色的空间"
                          style={{ width: '100%', marginBottom: 16 }}
                          allowClear
                          value={newRoleTenantId}
                          onChange={setNewRoleTenantId}
                        >
                          {tenants.map(tenant => (
                            <Option key={tenant.id} value={tenant.id}>
                              {tenant.tenant_name} ({tenant.tenant_code})
                            </Option>
                          ))}
                        </Select>
                      </div>

                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                          选择角色
                        </label>
                        <Select
                          placeholder="请选择角色"
                          style={{ width: '100%', marginBottom: 16 }}
                          allowClear
                          value={newRoleValue}
                          onChange={setNewRoleValue}
                        >
                          {roles.map(role => (
                            <Option key={role.value} value={role.value}>
                              {role.label}
                            </Option>
                          ))}
                        </Select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <Button type="primary" onClick={handleAddRoleAssignment} loading={loading}>
                          分配角色
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default UserForm;
