import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  message,
  Row,
  Col,
  Divider,
  Alert,
  Tabs,
  Transfer,
  Input,
} from 'antd';
import {
  SettingOutlined,
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { rolesPermissionsAPI, departmentsAPI, enhancedPermissionsAPI } from '../utils/api';

const { Option } = Select;

const DataScopeManagement = () => {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleDataScope, setRoleDataScope] = useState('department');
  const [customDepartments, setCustomDepartments] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // 数据权限范围选项
  const dataScopeOptions = [
    { value: 'all', label: '全部数据', desc: '可以查看和操作所有租户的数据' },
    { value: 'department', label: '本部门数据', desc: '只能查看和操作所属部门的数据' },
    { value: 'custom', label: '自定义部门', desc: '只能查看和操作指定部门的数据' },
    { value: 'own', label: '仅本人数据', desc: '只能查看和操作自己创建/负责的数据' },
  ];

  useEffect(() => {
    loadRoles();
    loadDepartments();
  }, []);

  // 加载角色列表
  const loadRoles = async () => {
    try {
      setLoading(true);
      const result = await rolesPermissionsAPI.getRoles();
      if (result.success) {
        const processedRoles = result.data.map(role => ({
          ...role,
          roleCode: role.role || role.role_code || role.value,
          roleLabel: role.label || role.role_name || role.value || role.role_code || role.role,
        }));
        setRoles(processedRoles);
        if (processedRoles.length > 0) {
          setSelectedRole(processedRoles[0].roleCode);
          await loadRoleDataScope(processedRoles[0].roleCode);
        }
      }
    } catch (error) {
      message.error('加载角色列表失败');
    } finally {
      setLoading(false);
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

  // 加载角色数据权限范围
  const loadRoleDataScope = async role => {
    try {
      setLoading(true);
      const result = await enhancedPermissionsAPI.getRoleDataScope(role);
      if (result.success) {
        setRoleDataScope(result.data?.data_scope || 'department');
        setCustomDepartments(result.data?.custom_departments || []);
      }
      setHasChanges(false);
    } catch (error) {
      // 如果没有配置，使用默认值
      setRoleDataScope('department');
      setCustomDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  // 选择角色
  const handleRoleChange = async role => {
    if (hasChanges) {
      Modal.confirm({
        title: '有未保存的更改',
        content: '切换角色将丢失当前未保存的更改，是否继续？',
        onOk: async () => {
          setSelectedRole(role);
          await loadRoleDataScope(role);
        },
      });
    } else {
      setSelectedRole(role);
      await loadRoleDataScope(role);
    }
  };

  // 数据权限范围变更
  const handleDataScopeChange = value => {
    setRoleDataScope(value);
    setHasChanges(true);
    if (value !== 'custom') {
      setCustomDepartments([]);
    }
  };

  // 自定义部门变更
  const handleCustomDeptsChange = values => {
    setCustomDepartments(values);
    setHasChanges(true);
  };

  // 保存数据权限配置
  const handleSave = async () => {
    if (!selectedRole) return;
    try {
      setSaving(true);
      const result = await enhancedPermissionsAPI.setRoleDataScope(selectedRole, {
        data_scope: roleDataScope,
        custom_departments: customDepartments,
      });
      if (result.success) {
        message.success('数据权限配置保存成功');
        setHasChanges(false);
      }
    } catch (error) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 重置更改
  const handleReset = () => {
    Modal.confirm({
      title: '确认重置',
      content: '确定要放弃所有未保存的更改吗？',
      onOk: () => {
        loadRoleDataScope(selectedRole);
      },
    });
  };

  // 获取当前选择角色的标签
  const getCurrentRoleLabel = () => {
    const role = roles.find(r => r.roleCode === selectedRole);
    return role?.roleLabel || selectedRole;
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>数据权限范围管理</span>
            {hasChanges && (
              <Tag color="orange" icon={<CloseCircleOutlined />}>
                有未保存的更改
              </Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => loadRoleDataScope(selectedRole)}>
              重置
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={!hasChanges}
            >
              保存配置
            </Button>
          </Space>
        }
      >
        <Row gutter={24}>
          {/* 左侧：角色列表 */}
          <Col xs={24} md={8}>
            <Card title="角色列表" size="small">
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {roles.map(role => (
                  <div
                    key={role.roleCode}
                    onClick={() => handleRoleChange(role.roleCode)}
                    style={{
                      padding: '12px',
                      marginBottom: 8,
                      borderRadius: 6,
                      border: selectedRole === role.roleCode ? '2px solid #1890ff' : '1px solid #d9d9d9',
                      backgroundColor: selectedRole === role.roleCode ? '#e6f7ff' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}
                  >
                    <Space>
                      {selectedRole === role.roleCode && <CheckCircleOutlined style={{ color: '#1890ff' }} />}
                      <span style={{ fontWeight: selectedRole === role.roleCode ? 600 : 400 }}>
                        {role.roleLabel}
                      </span>
                      {role.is_system_role === 1 && <Tag color="red" size="small">系统</Tag>}
                    </Space>
                  </div>
                ))}
              </div>
            </Card>
          </Col>

          {/* 右侧：数据权限配置 */}
          <Col xs={24} md={16}>
            {selectedRole ? (
              <Card
                title={
                  <Space>
                    <span>数据权限配置</span>
                    <Tag color="blue">{getCurrentRoleLabel()}</Tag>
                  </Space>
                }
              >
                <Alert title="数据权限说明"
                  description="数据权限范围决定了角色能够访问和操作的数据范围。配置后，符合权限条件的数据才会对用户可见。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 24 }}
                />

                <Form layout="vertical">
                  <Form.Item label="数据权限范围" required>
                    <Select
                      value={roleDataScope}
                      onChange={handleDataScopeChange}
                      style={{ width: '100%' }}
                    >
                      {dataScopeOptions.map(option => (
                        <Option key={option.value} value={option.value}>
                          <div>
                            <div style={{ fontWeight: 500 }}>{option.label}</div>
                            <div style={{ fontSize: 12, color: '#999' }}>{option.desc}</div>
                          </div>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>

                  {roleDataScope === 'custom' && (
                    <Form.Item label="自定义部门权限">
                      <Select
                        mode="multiple"
                        placeholder="请选择允许访问的部门"
                        value={customDepartments}
                        onChange={handleCustomDeptsChange}
                        style={{ width: '100%' }}
                      >
                        {departments.map(dept => (
                          <Option key={dept.department_code} value={dept.department_code}>
                            {dept.department_name}
                          </Option>
                        ))}
                      </Select>
                      <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                        已选择 {customDepartments.length} 个部门
                      </div>
                    </Form.Item>
                  )}

                  <Divider />

                  <Alert title="当前配置预览"
                    description={
                      <div>
                        <p>
                          <strong>权限范围：</strong>
                          {dataScopeOptions.find(o => o.value === roleDataScope)?.label}
                        </p>
                        {roleDataScope === 'custom' && customDepartments.length > 0 && (
                          <p>
                            <strong>可访问部门：</strong>
                            {customDepartments
                              .map(code => departments.find(d => d.department_code === code)?.department_name)
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    }
                    type="success"
                    showIcon
                  />
                </Form>
              </Card>
            ) : (
              <Card>
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                  请选择一个角色进行配置
                </div>
              </Card>
            )}
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default DataScopeManagement;
