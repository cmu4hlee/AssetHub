import React, { useState, useEffect } from 'react';
import { useIsMobile, useCan } from '../hooks';
import {
  Card,
  Table,
  Button,
  Checkbox,
  Space,
  message,
  Spin,
  Tabs,
  Divider,
  Row,
  Col,
  Typography,
  Alert,
  Modal,
  Tag,
  Form,
  Input,
  Popconfirm,
} from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { rolesPermissionsAPI } from '../utils/api';
import { getApiErrorMessage } from '../api/client';

const { Title, Text } = Typography;
const { TextArea } = Input;

const RolePermissionManagement = () => {
  const canDelete = useCan('role', 'delete');
  const canEdit = useCan('role', 'edit');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]);
  const [permissionDefinitions, setPermissionDefinitions] = useState({});
  const [rolePermissions, setRolePermissions] = useState({}); // { role: [permissions] }
  const [selectedRole, setSelectedRole] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPermissions, setOriginalPermissions] = useState({});
  const [createRoleModalVisible, setCreateRoleModalVisible] = useState(false);
  const [createRoleForm] = Form.useForm();
  const [selectedPermissionsForNewRole, setSelectedPermissionsForNewRole] = useState([]);
  const isMobile = useIsMobile();

  // 菜单权限相关状态
  const [menuDefinitions, setMenuDefinitions] = useState([]);
  const [roleMenuPermissions, setRoleMenuPermissions] = useState({}); // { role: { menu_key: is_visible } }
  const [originalMenuPermissions, setOriginalMenuPermissions] = useState({});
  const [hasMenuChanges, setHasMenuChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('permissions'); // 'permissions' 或 'menus'

  // 监听窗口大小变化

  useEffect(() => {
    loadData();
  }, []);

  // 加载所有数据
  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadRoles(), loadPermissionDefinitions(), loadMenuDefinitions()]);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载菜单定义
  const loadMenuDefinitions = async () => {
    try {
      const result = await rolesPermissionsAPI.getMenuDefinitions();
      if (result.success) {
        setMenuDefinitions(result.data);
      }
    } catch (error) {
      console.error('加载菜单定义失败:', error);
    }
  };

  // 加载指定角色的菜单权限
  const loadRoleMenuPermissions = async role => {
    try {
      setLoading(true);
      const result = await rolesPermissionsAPI.getRoleMenus(role);
      if (result.success) {
        setRoleMenuPermissions(prev => ({
          ...prev,
          [role]: result.data,
        }));
        setOriginalMenuPermissions(prev => ({
          ...prev,
          [role]: { ...result.data },
        }));
        setHasMenuChanges(false);
      }
    } catch (error) {
      message.error('加载角色菜单权限失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取角色标签（辅助函数，不依赖状态）
  const getRoleLabelStatic = (role, roleData = null) => {
    if (roleData && roleData.label) {
      return roleData.label;
    }
    if (roleData && roleData.role_name) {
      return roleData.role_name;
    }
    const roleMap = {
      system_admin: '系统管理员',
      asset_admin: '资产管理员',
      department_admin: '科室管理员',
    };
    return roleMap[role] || role;
  };

  // 加载角色列表
  const loadRoles = async () => {
    try {
      const result = await rolesPermissionsAPI.getRoles();
      if (result.success) {
        console.log('[角色列表] 原始数据:', JSON.stringify(result.data, null, 2));
        // 确保每个角色都有 label 和 role 字段
        const processedRoles = result.data.map(roleItem => {
          // 获取角色代码（优先使用 role，然后是 role_code，最后是 value）
          const roleCode = roleItem.role || roleItem.role_code || roleItem.value || '';

          // 获取角色名称（优先使用 label，然后是 role_name，最后使用默认映射）
          const roleLabel =
            roleItem.label || roleItem.role_name || getRoleLabelStatic(roleCode, roleItem);

          // 构建处理后的角色对象
          const processed = {
            ...roleItem,
            role: roleCode, // 统一使用 role 字段
            role_code: roleCode, // 兼容字段
            label: roleLabel, // 统一使用 label 字段作为显示名称
            role_name: roleItem.role_name || roleLabel, // 兼容字段
          };

          console.log('[角色列表] 处理单个角色:', {
            原始: roleItem,
            处理后: processed,
            roleCode,
            roleLabel,
            'processed.label': processed.label,
            'processed.role_name': processed.role_name,
          });

          return processed;
        });
        console.log('[角色列表] 最终处理后的角色数据:', JSON.stringify(processedRoles, null, 2));
        setRoles(processedRoles);
        if (processedRoles.length > 0 && !selectedRole) {
          const firstRoleCode =
            processedRoles[0].role || processedRoles[0].role_code || processedRoles[0].value;
          setSelectedRole(firstRoleCode);
          await loadRolePermissions(firstRoleCode);
          await loadRoleMenuPermissions(firstRoleCode);
        }
      }
    } catch (error) {
      console.error('[角色列表] 加载失败:', error);
      message.error('加载角色列表失败');
    }
  };

  // 加载权限定义
  const loadPermissionDefinitions = async () => {
    try {
      const result = await rolesPermissionsAPI.getPermissionDefinitions();
      if (result.success) {
        setPermissionDefinitions(result.data);
      }
    } catch (error) {
      message.error('加载权限定义失败');
    }
  };

  // 加载指定角色的权限
  const loadRolePermissions = async role => {
    try {
      setLoading(true);
      const result = await rolesPermissionsAPI.getRolePermissions(role);
      if (result.success) {
        const permissions = result.data.map(p => p.permission);
        setRolePermissions(prev => ({
          ...prev,
          [role]: permissions,
        }));
        setOriginalPermissions(prev => ({
          ...prev,
          [role]: [...permissions],
        }));
        setHasChanges(false);
      }
    } catch (error) {
      message.error('加载角色权限失败');
    } finally {
      setLoading(false);
    }
  };

  // 切换角色
  const handleRoleChange = async role => {
    if (hasChanges || hasMenuChanges) {
      Modal.confirm({
        title: '有未保存的更改',
        content: '切换角色将丢失当前未保存的更改，是否继续？',
        onOk: async () => {
          setSelectedRole(role);
          if (!rolePermissions[role]) {
            await loadRolePermissions(role);
          }
          if (!roleMenuPermissions[role]) {
            await loadRoleMenuPermissions(role);
          }
          setHasChanges(false);
          setHasMenuChanges(false);
        },
        onCancel: () => {},
      });
    } else {
      setSelectedRole(role);
      if (!rolePermissions[role]) {
        await loadRolePermissions(role);
      }
      if (!roleMenuPermissions[role]) {
        await loadRoleMenuPermissions(role);
      }
    }
  };

  // 切换权限
  const handlePermissionToggle = (permission, checked) => {
    if (!selectedRole) return;

    const currentPermissions = rolePermissions[selectedRole] || [];
    let newPermissions;

    if (checked) {
      newPermissions = [...currentPermissions, permission];
    } else {
      newPermissions = currentPermissions.filter(p => p !== permission);
    }

    setRolePermissions(prev => ({
      ...prev,
      [selectedRole]: newPermissions,
    }));

    // 检查是否有更改
    const original = originalPermissions[selectedRole] || [];
    const hasChanged =
      JSON.stringify([...original].sort()) !== JSON.stringify([...newPermissions].sort());
    setHasChanges(hasChanged);
  };

  // 全选/取消全选某个分类的权限
  const handleCategoryToggle = (category, checked) => {
    if (!selectedRole) return;

    const categoryPermissions = permissionDefinitions[category] || [];
    const currentPermissions = rolePermissions[selectedRole] || [];
    let newPermissions;

    if (checked) {
      // 添加该分类的所有权限
      const categoryPerms = categoryPermissions.map(p => p.permission);
      newPermissions = [...new Set([...currentPermissions, ...categoryPerms])];
    } else {
      // 移除该分类的所有权限
      const categoryPerms = categoryPermissions.map(p => p.permission);
      newPermissions = currentPermissions.filter(p => !categoryPerms.includes(p));
    }

    setRolePermissions(prev => ({
      ...prev,
      [selectedRole]: newPermissions,
    }));

    // 检查是否有更改
    const original = originalPermissions[selectedRole] || [];
    const hasChanged =
      JSON.stringify([...original].sort()) !== JSON.stringify([...newPermissions].sort());
    setHasChanges(hasChanged);
  };

  // 保存权限
  const handleSave = async () => {
    if (!selectedRole) return;

    try {
      setSaving(true);
      const permissions = rolePermissions[selectedRole] || [];
      const result = await rolesPermissionsAPI.updateRolePermissions(selectedRole, permissions);

      if (result.success) {
        message.success('权限保存成功');
        setOriginalPermissions(prev => ({
          ...prev,
          [selectedRole]: [...permissions],
        }));
        setHasChanges(false);
      } else {
        message.error(result.message || '保存失败');
      }
    } catch (error) {
      // 500 错误已由 axios 拦截器显示全局消息，这里只补充角色上下文
      const status = error?.response?.status;
      const backendMsg = error?.response?.data?.message;
      if (status && status >= 500) {
        console.error('[角色权限保存] 服务器错误:', { role: selectedRole, status, backendMsg, error });
      } else {
        message.error(`保存权限失败: ${getApiErrorMessage(error, '未知错误')}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // 切换菜单可见性
  const handleMenuToggle = (menuKey, checked) => {
    if (!selectedRole) return;

    const currentMenus = roleMenuPermissions[selectedRole] || {};
    const newMenus = {
      ...currentMenus,
      [menuKey]: checked,
    };

    setRoleMenuPermissions(prev => ({
      ...prev,
      [selectedRole]: newMenus,
    }));

    // 检查是否有更改
    const original = originalMenuPermissions[selectedRole] || {};
    const hasChanged = JSON.stringify(original) !== JSON.stringify(newMenus);
    setHasMenuChanges(hasChanged);
  };

  // 全选/取消全选某个父菜单的所有子菜单
  const handleParentMenuToggle = (parentMenu, checked) => {
    if (!selectedRole) return;

    const currentMenus = roleMenuPermissions[selectedRole] || {};
    const newMenus = { ...currentMenus };

    // 找到所有子菜单
    const findChildren = menu => {
      const children = [];
      if (menu.children && menu.children.length > 0) {
        menu.children.forEach(child => {
          children.push(child.menu_key);
          if (child.children && child.children.length > 0) {
            children.push(...findChildren(child).map(c => c));
          }
        });
      }
      return children;
    };

    const parentMenuObj = menuDefinitions.find(m => m.menu_key === parentMenu);
    if (parentMenuObj) {
      const children = findChildren(parentMenuObj);
      children.forEach(childKey => {
        newMenus[childKey] = checked;
      });
      // 也设置父菜单本身
      newMenus[parentMenu] = checked;
    }

    setRoleMenuPermissions(prev => ({
      ...prev,
      [selectedRole]: newMenus,
    }));

    // 检查是否有更改
    const original = originalMenuPermissions[selectedRole] || {};
    const hasChanged = JSON.stringify(original) !== JSON.stringify(newMenus);
    setHasMenuChanges(hasChanged);
  };

  // 保存菜单权限
  const handleSaveMenus = async () => {
    if (!selectedRole) return;

    try {
      setSaving(true);
      const menuPermissions = roleMenuPermissions[selectedRole] || {};
      const result = await rolesPermissionsAPI.updateRoleMenus(selectedRole, menuPermissions);

      if (result.success) {
        message.success('菜单权限保存成功');
        setOriginalMenuPermissions(prev => ({
          ...prev,
          [selectedRole]: { ...menuPermissions },
        }));
        setHasMenuChanges(false);
      } else {
        message.error(result.message || '保存失败');
      }
    } catch (error) {
      const status = error?.response?.status;
      const backendMsg = error?.response?.data?.message;
      if (status && status >= 500) {
        console.error('[菜单权限保存] 服务器错误:', { role: selectedRole, status, backendMsg, error });
      } else {
        message.error(`保存菜单权限失败: ${getApiErrorMessage(error, '未知错误')}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // 重置菜单更改
  const handleResetMenus = () => {
    if (!selectedRole) return;

    Modal.confirm({
      title: '确认重置',
      content: '确定要放弃所有未保存的菜单权限更改吗？',
      onOk: () => {
        const original = originalMenuPermissions[selectedRole] || {};
        setRoleMenuPermissions(prev => ({
          ...prev,
          [selectedRole]: { ...original },
        }));
        setHasMenuChanges(false);
      },
    });
  };

  // 检查父菜单是否全选
  const isParentMenuChecked = parentMenu => {
    if (!selectedRole) return false;
    const currentMenus = roleMenuPermissions[selectedRole] || {};
    const parentMenuObj = menuDefinitions.find(m => m.menu_key === parentMenu);
    if (!parentMenuObj) return false;

    const findChildren = menu => {
      const children = [];
      if (menu.children && menu.children.length > 0) {
        menu.children.forEach(child => {
          children.push(child.menu_key);
          if (child.children && child.children.length > 0) {
            children.push(...findChildren(child).map(c => c));
          }
        });
      }
      return children;
    };

    const children = findChildren(parentMenuObj);
    const allChildren = [parentMenu, ...children];
    return allChildren.every(key => currentMenus[key] === true);
  };

  // 检查父菜单是否部分选中
  const isParentMenuIndeterminate = parentMenu => {
    if (!selectedRole) return false;
    const currentMenus = roleMenuPermissions[selectedRole] || {};
    const parentMenuObj = menuDefinitions.find(m => m.menu_key === parentMenu);
    if (!parentMenuObj) return false;

    const findChildren = menu => {
      const children = [];
      if (menu.children && menu.children.length > 0) {
        menu.children.forEach(child => {
          children.push(child.menu_key);
          if (child.children && child.children.length > 0) {
            children.push(...findChildren(child).map(c => c));
          }
        });
      }
      return children;
    };

    const children = findChildren(parentMenuObj);
    const allChildren = [parentMenu, ...children];
    const checkedCount = allChildren.filter(key => currentMenus[key] === true).length;
    return checkedCount > 0 && checkedCount < allChildren.length;
  };

  // 重置更改
  const handleReset = () => {
    if (!selectedRole) return;

    Modal.confirm({
      title: '确认重置',
      content: '确定要放弃所有未保存的更改吗？',
      onOk: () => {
        const original = originalPermissions[selectedRole] || [];
        setRolePermissions(prev => ({
          ...prev,
          [selectedRole]: [...original],
        }));
        setHasChanges(false);
      },
    });
  };

  // 检查分类是否全选
  const isCategoryChecked = category => {
    if (!selectedRole) return false;
    const categoryPermissions = permissionDefinitions[category] || [];
    const currentPermissions = rolePermissions[selectedRole] || [];
    return (
      categoryPermissions.length > 0 &&
      categoryPermissions.every(p => currentPermissions.includes(p.permission))
    );
  };

  // 检查分类是否部分选中
  const isCategoryIndeterminate = category => {
    if (!selectedRole) return false;
    const categoryPermissions = permissionDefinitions[category] || [];
    const currentPermissions = rolePermissions[selectedRole] || [];
    const checkedCount = categoryPermissions.filter(p =>
      currentPermissions.includes(p.permission)
    ).length;
    return checkedCount > 0 && checkedCount < categoryPermissions.length;
  };

  // 获取角色标签
  const getRoleLabel = role => {
    if (!role) return '';
    const roleObj = roles.find(r => (r.role || r.role_code || r.value) === role);
    if (roleObj) {
      return roleObj.label || roleObj.role_name || roleObj.role || role;
    }
    const roleMap = {
      system_admin: '系统管理员',
      asset_admin: '资产管理员',
      department_admin: '科室管理员',
    };
    return roleMap[role] || role;
  };

  // 检查是否为系统角色
  const isSystemRole = role => {
    const roleObj = roles.find(r => r.role === role);
    return roleObj?.is_system_role === 1;
  };

  // 创建角色
  const handleCreateRole = async () => {
    try {
      const values = await createRoleForm.validateFields();
      const { role_code, role_name, description } = values;

      const result = await rolesPermissionsAPI.createRole({
        role_code,
        role_name,
        description,
        permissions: selectedPermissionsForNewRole,
      });

      if (result.success) {
        message.success('角色创建成功');
        setCreateRoleModalVisible(false);
        createRoleForm.resetFields();
        setSelectedPermissionsForNewRole([]);
        await loadData();
      } else {
        message.error(result.message || '创建角色失败');
      }
    } catch (error) {
      if (error.errorFields) {
        return; // 表单验证错误
      }
      message.error('创建角色失败');
    }
  };

  // 删除角色
  const handleDeleteRole = async role => {
    try {
      const result = await rolesPermissionsAPI.deleteRole(role);
      if (result.success) {
        message.success('角色删除成功');
        if (selectedRole === role) {
          setSelectedRole(null);
        }
        await loadData();
      } else {
        message.error(result.message || '删除角色失败');
      }
    } catch (error) {
      message.error('删除角色失败');
    }
  };

  const currentPermissions = selectedRole ? rolePermissions[selectedRole] || [] : [];

  return (
    <div
      style={{ padding: isMobile ? '8px' : '24px', backgroundColor: '#f5f7fa', minHeight: '100vh' }}
    >
      <Card
        title={
          <Space wrap>
            <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
              角色和权限管理
            </Title>
            {(hasChanges || hasMenuChanges) && (
              <Tag
                color="orange"
                icon={<CloseCircleOutlined />}
                style={{ fontSize: isMobile ? '11px' : '12px' }}
              >
                有未保存的更改
              </Tag>
            )}
          </Space>
        }
        extra={
          <Space wrap size={isMobile ? 'small' : 'middle'}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateRoleModalVisible(true)}
              size={isMobile ? 'small' : 'middle'}
            >
              {isMobile ? '添加' : '添加角色'}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              disabled={loading}
              size={isMobile ? 'small' : 'middle'}
            >
              {isMobile ? '刷新' : '刷新'}
            </Button>
            {(hasChanges || hasMenuChanges) && (
              <>
                <Button
                  onClick={() => {
                    if (activeTab === 'permissions') {
                      handleReset();
                    } else {
                      handleResetMenus();
                    }
                  }}
                  size={isMobile ? 'small' : 'middle'}
                >
                  重置
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={() => {
                    if (activeTab === 'permissions') {
                      handleSave();
                    } else {
                      handleSaveMenus();
                    }
                  }}
                  loading={saving}
                  size={isMobile ? 'small' : 'middle'}
                >
                  {isMobile ? '保存' : '保存更改'}
                </Button>
              </>
            )}
          </Space>
        }
        style={{ borderRadius: '8px' }}
        size={isMobile ? 'small' : 'default'}
      >
        {loading && !roles.length ? (
          <div style={{ textAlign: 'center', padding: isMobile ? '20px' : '40px' }}>
            <Spin size={isMobile ? 'default' : 'large'} />
          </div>
        ) : (
          <Row gutter={isMobile ? 8 : 24}>
            {/* 左侧：角色列表 */}
            <Col xs={24} sm={24} md={10} lg={8} xl={7}>
              <Card
                title="角色列表"
                size={isMobile ? 'small' : 'default'}
                style={{ height: '100%', marginBottom: isMobile ? '16px' : 0 }}
              >
                <Space orientation="vertical" style={{ width: '100%' }} size="small">
                  {roles.map(roleItem => {
                    // 确保获取正确的角色代码和名称
                    const roleCode = roleItem.role || roleItem.role_code || roleItem.value || '';
                    // 优先使用 label，然后是 role_name，最后使用 getRoleLabel
                    const roleName =
                      roleItem.label || roleItem.role_name || getRoleLabel(roleCode) || roleCode;

                    // 调试日志
                    if (!roleItem.label && !roleItem.role_name) {
                      console.warn('[角色卡片] 缺少名称字段:', { roleCode, roleItem, roleName });
                    }

                    return (
                      <div
                        key={roleCode}
                        style={{
                          position: 'relative',
                          width: '100%',
                          marginBottom: isMobile ? '8px' : '12px',
                        }}
                      >
                        <div
                          onClick={() => handleRoleChange(roleCode)}
                          style={{
                            border:
                              selectedRole === roleCode ? '2px solid #1890ff' : '1px solid #d9d9d9',
                            borderRadius: '6px',
                            padding: isMobile ? '10px' : '14px',
                            backgroundColor: selectedRole === roleCode ? '#e6f7ff' : '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            width: '100%',
                          }}
                          onMouseEnter={e => {
                            if (selectedRole !== roleCode) {
                              e.currentTarget.style.borderColor = '#40a9ff';
                              e.currentTarget.style.backgroundColor = '#f0f9ff';
                            }
                          }}
                          onMouseLeave={e => {
                            if (selectedRole !== roleCode) {
                              e.currentTarget.style.borderColor = '#d9d9d9';
                              e.currentTarget.style.backgroundColor = '#fff';
                            }
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: isMobile ? '6px' : '8px',
                            }}
                          >
                            {/* 第一行：角色名称和标签 */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: isMobile ? '6px' : '10px',
                                flexWrap: 'nowrap',
                              }}
                            >
                              {selectedRole === roleCode && (
                                <CheckCircleOutlined
                                  style={{
                                    flexShrink: 0,
                                    fontSize: isMobile ? '16px' : '18px',
                                    color: '#1890ff',
                                  }}
                                />
                              )}
                              <span
                                title={roleName}
                                style={{
                                  flex: '1 1 auto',
                                  minWidth: 0,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontWeight: selectedRole === roleCode ? 600 : 500,
                                  fontSize: isMobile ? '14px' : '16px',
                                  color: selectedRole === roleCode ? '#1890ff' : '#262626',
                                }}
                              >
                                {roleName}
                              </span>
                              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                <Tag
                                  color="blue"
                                  style={{
                                    fontSize: isMobile ? '11px' : '12px',
                                    margin: 0,
                                    flexShrink: 0,
                                    lineHeight: isMobile ? '18px' : '20px',
                                    padding: isMobile ? '0 6px' : '0 8px',
                                    height: isMobile ? '20px' : '22px',
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                >
                                  {roleItem.permission_count}
                                </Tag>
                                {roleItem.is_system_role === 1 && (
                                  <Tag
                                    color="red"
                                    size="small"
                                    style={{
                                      fontSize: isMobile ? '11px' : '12px',
                                      margin: 0,
                                      flexShrink: 0,
                                      lineHeight: isMobile ? '18px' : '20px',
                                      padding: isMobile ? '0 6px' : '0 8px',
                                      height: isMobile ? '20px' : '22px',
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    系统
                                  </Tag>
                                )}
                              </div>
                            </div>
                            {/* 第二行：角色描述 */}
                            {roleItem.description && (
                              <div
                                style={{
                                  fontSize: isMobile ? '11px' : '12px',
                                  color: '#8c8c8c',
                                  lineHeight: isMobile ? '1.4' : '1.5',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  marginLeft: selectedRole === roleCode ? '24px' : '0',
                                }}
                              >
                                {roleItem.description}
                              </div>
                            )}
                          </div>
                        </div>
                        {!isSystemRole(roleCode) && (
                          <div
                            style={{
                              position: 'absolute',
                              top: isMobile ? '8px' : '12px',
                              right: isMobile ? '8px' : '12px',
                              zIndex: 10,
                            }}
                          >
                            <Popconfirm
                              title="确定要删除这个角色吗？"
                              description="删除角色将同时删除该角色的所有权限配置"
                              onConfirm={() => handleDeleteRole(roleCode)}
                              okText="确定"
                              cancelText="取消"
                              onCancel={e => e?.stopPropagation()}
                            >
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                style={{
                                  padding: isMobile ? '4px' : '6px',
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                            </Popconfirm>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Space>
              </Card>
            </Col>

            {/* 右侧：权限配置 */}
            <Col xs={24} sm={24} md={14} lg={16} xl={17}>
              {selectedRole ? (
                <Card
                  title={
                    <Space wrap>
                      <Text strong style={{ fontSize: isMobile ? '13px' : '14px' }}>
                        {isMobile
                          ? '权限配置'
                          : `权限配置：${(() => {
                              const roleObj = roles.find(r => r.role === selectedRole);
                              return (
                                roleObj?.label || roleObj?.role_name || getRoleLabel(selectedRole)
                              );
                            })()}`}
                      </Text>
                    </Space>
                  }
                  size={isMobile ? 'small' : 'small'}
                >
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    size={isMobile ? 'small' : 'default'}
                    items={[
                      {
                        key: 'permissions',
                        label: (
                          <span>
                            功能权限
                            <Tag color="blue" style={{ marginLeft: '8px', fontSize: '12px' }}>
                              {currentPermissions.length}
                            </Tag>
                          </span>
                        ),
                        children: (
                          <>
                            {selectedRole === 'system_admin' && (
                              <Alert
                                title="系统管理员"
                                description="系统管理员默认拥有所有权限，无需配置。"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                              />
                            )}

                            {Object.keys(permissionDefinitions).length > 0 ? (
                              <Tabs
                                defaultActiveKey={Object.keys(permissionDefinitions)[0]}
                                size={isMobile ? 'small' : 'default'}
                                items={Object.entries(permissionDefinitions).map(
                                  ([category, permissions]) => ({
                                    key: category,
                                    label: (
                                      <span style={{ fontSize: isMobile ? '12px' : '14px' }}>
                                        <Checkbox
                                          checked={isCategoryChecked(category)}
                                          indeterminate={isCategoryIndeterminate(category)}
                                          onChange={e =>
                                            handleCategoryToggle(category, e.target.checked)
                                          }
                                          onClick={e => e.stopPropagation()}
                                          style={{ marginRight: isMobile ? '4px' : '8px' }}
                                        />
                                        {category}
                                        <Tag
                                          color="default"
                                          style={{
                                            marginLeft: isMobile ? '4px' : '8px',
                                            fontSize: isMobile ? '10px' : '12px',
                                          }}
                                        >
                                          {
                                            permissions.filter(p =>
                                              currentPermissions.includes(p.permission)
                                            ).length
                                          }{' '}
                                          / {permissions.length}
                                        </Tag>
                                      </span>
                                    ),
                                    children: (
                                      <div
                                        style={{
                                          maxHeight: isMobile ? '300px' : '500px',
                                          overflowY: 'auto',
                                        }}
                                      >
                                        <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
                                          {permissions.map(permission => {
                                            const isChecked = currentPermissions.includes(
                                              permission.permission
                                            );
                                            return (
                                              <Col
                                                xs={24}
                                                sm={24}
                                                md={12}
                                                lg={12}
                                                xl={12}
                                                key={permission.permission}
                                              >
                                                <Checkbox
                                                  checked={isChecked}
                                                  onChange={e =>
                                                    handlePermissionToggle(
                                                      permission.permission,
                                                      e.target.checked
                                                    )
                                                  }
                                                  style={{ fontSize: isMobile ? '12px' : '14px' }}
                                                >
                                                  <div>
                                                    <div
                                                      style={{
                                                        fontWeight: 500,
                                                        fontSize: isMobile ? '12px' : '14px',
                                                      }}
                                                    >
                                                      {permission.name}
                                                    </div>
                                                    {permission.description && (
                                                      <div
                                                        style={{
                                                          fontSize: isMobile ? '11px' : '12px',
                                                          color: '#999',
                                                          marginTop: '4px',
                                                        }}
                                                      >
                                                        {permission.description}
                                                      </div>
                                                    )}
                                                  </div>
                                                </Checkbox>
                                              </Col>
                                            );
                                          })}
                                        </Row>
                                      </div>
                                    ),
                                  })
                                )}
                              />
                            ) : (
                              <Alert
                                title="权限定义未初始化"
                                description="请先运行 extend-permissions-system.js 脚本初始化权限系统"
                                type="warning"
                                showIcon
                                style={{ marginBottom: '16px' }}
                              />
                            )}
                          </>
                        ),
                      },
                      {
                        key: 'menus',
                        label: (
                          <span>
                            菜单权限
                            <Tag color="green" style={{ marginLeft: '8px', fontSize: '12px' }}>
                              {(() => {
                                const currentMenus = roleMenuPermissions[selectedRole] || {};
                                return Object.values(currentMenus).filter(v => v === true).length;
                              })()}
                            </Tag>
                          </span>
                        ),
                        children: (
                          <div
                            style={{ maxHeight: isMobile ? '400px' : '600px', overflowY: 'auto' }}
                          >
                            {menuDefinitions.length > 0 ? (
                              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                                {menuDefinitions.map(menu => {
                                  const currentMenus = roleMenuPermissions[selectedRole] || {};
                                  const isChecked = currentMenus[menu.menu_key] === true;
                                  const hasChildren = menu.children && menu.children.length > 0;

                                  return (
                                    <div key={menu.menu_key} style={{ marginBottom: '12px' }}>
                                      <Checkbox
                                        checked={isChecked}
                                        indeterminate={
                                          hasChildren && isParentMenuIndeterminate(menu.menu_key)
                                        }
                                        onChange={e => {
                                          if (hasChildren) {
                                            handleParentMenuToggle(menu.menu_key, e.target.checked);
                                          } else {
                                            handleMenuToggle(menu.menu_key, e.target.checked);
                                          }
                                        }}
                                        style={{
                                          fontSize: isMobile ? '13px' : '14px',
                                          fontWeight: 500,
                                        }}
                                      >
                                        {menu.menu_label}
                                      </Checkbox>
                                      {hasChildren && (
                                        <div style={{ marginLeft: '24px', marginTop: '8px' }}>
                                          <Space
                                            orientation="vertical"
                                            style={{ width: '100%' }}
                                            size="small"
                                          >
                                            {menu.children.map(child => {
                                              const childChecked =
                                                currentMenus[child.menu_key] === true;
                                              return (
                                                <div key={child.menu_key}>
                                                  <Checkbox
                                                    checked={childChecked}
                                                    onChange={e =>
                                                      handleMenuToggle(
                                                        child.menu_key,
                                                        e.target.checked
                                                      )
                                                    }
                                                    style={{ fontSize: isMobile ? '12px' : '13px' }}
                                                  >
                                                    {child.menu_label}
                                                  </Checkbox>
                                                </div>
                                              );
                                            })}
                                          </Space>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </Space>
                            ) : (
                              <Alert
                                title="菜单定义未加载"
                                description="请先运行 create-menu-permissions-table.js 脚本初始化菜单系统"
                                type="warning"
                                showIcon
                              />
                            )}
                          </div>
                        ),
                      },
                    ]}
                  />
                </Card>
              ) : (
                <Card>
                  <div
                    style={{
                      textAlign: 'center',
                      padding: isMobile ? '20px' : '40px',
                      color: '#999',
                      fontSize: isMobile ? '13px' : '14px',
                    }}
                  >
                    请选择一个角色进行权限配置
                  </div>
                </Card>
              )}
            </Col>
          </Row>
        )}
      </Card>

      {/* 创建角色模态框 */}
      <Modal
        title="创建新角色"
        open={createRoleModalVisible}
        onCancel={() => {
          setCreateRoleModalVisible(false);
          createRoleForm.resetFields();
          setSelectedPermissionsForNewRole([]);
        }}
        onOk={handleCreateRole}
        width={isMobile ? '95vw' : 800}
        okText="创建"
        cancelText="取消"
        styles={{ body: { maxHeight: isMobile ? '70vh' : '80vh', overflowY: 'auto' } }}
      >
        <Form form={createRoleForm} layout="vertical" initialValues={{}}>
          <Form.Item
            name="role_code"
            label="角色代码"
            rules={[
              { required: true, message: '请输入角色代码' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '角色代码只能包含字母、数字和下划线' },
            ]}
            extra="角色代码用于系统内部标识，只能包含字母、数字和下划线"
          >
            <Input placeholder="例如：custom_role" />
          </Form.Item>

          <Form.Item
            name="role_name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="例如：自定义角色" />
          </Form.Item>

          <Form.Item name="description" label="角色描述">
            <TextArea rows={3} placeholder="可选：角色的描述信息" />
          </Form.Item>
        </Form>

        <Divider>初始权限配置</Divider>
        <div style={{ maxHeight: isMobile ? '300px' : '400px', overflowY: 'auto' }}>
          {Object.keys(permissionDefinitions).length > 0 ? (
            Object.entries(permissionDefinitions).map(([category, permissions]) => (
              <div key={category} style={{ marginBottom: isMobile ? '12px' : '16px' }}>
                <div
                  style={{
                    marginBottom: isMobile ? '6px' : '8px',
                    fontWeight: 500,
                    fontSize: isMobile ? '12px' : '14px',
                  }}
                >
                  <Checkbox
                    checked={permissions.every(p =>
                      selectedPermissionsForNewRole.includes(p.permission)
                    )}
                    indeterminate={
                      permissions.some(p => selectedPermissionsForNewRole.includes(p.permission)) &&
                      !permissions.every(p => selectedPermissionsForNewRole.includes(p.permission))
                    }
                    onChange={e => {
                      if (e.target.checked) {
                        const categoryPerms = permissions.map(p => p.permission);
                        setSelectedPermissionsForNewRole(prev => [
                          ...new Set([...prev, ...categoryPerms]),
                        ]);
                      } else {
                        const categoryPerms = permissions.map(p => p.permission);
                        setSelectedPermissionsForNewRole(prev =>
                          prev.filter(p => !categoryPerms.includes(p))
                        );
                      }
                    }}
                    style={{ fontSize: isMobile ? '12px' : '14px' }}
                  >
                    {category}
                    <Tag
                      color="default"
                      style={{
                        marginLeft: isMobile ? '4px' : '8px',
                        fontSize: isMobile ? '10px' : '12px',
                      }}
                    >
                      {
                        permissions.filter(p =>
                          selectedPermissionsForNewRole.includes(p.permission)
                        ).length
                      }{' '}
                      / {permissions.length}
                    </Tag>
                  </Checkbox>
                </div>
                <Row gutter={[isMobile ? 8 : 16, isMobile ? 6 : 8]}>
                  {permissions.map(permission => (
                    <Col xs={24} sm={24} md={12} lg={12} xl={12} key={permission.permission}>
                      <Checkbox
                        checked={selectedPermissionsForNewRole.includes(permission.permission)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedPermissionsForNewRole(prev => [
                              ...prev,
                              permission.permission,
                            ]);
                          } else {
                            setSelectedPermissionsForNewRole(prev =>
                              prev.filter(p => p !== permission.permission)
                            );
                          }
                        }}
                        style={{ fontSize: isMobile ? '12px' : '13px' }}
                      >
                        <div>
                          <div style={{ fontWeight: 500, fontSize: isMobile ? '12px' : '13px' }}>
                            {permission.name}
                          </div>
                          {permission.description && (
                            <div
                              style={{
                                fontSize: isMobile ? '10px' : '11px',
                                color: '#999',
                                marginTop: '2px',
                              }}
                            >
                              {permission.description}
                            </div>
                          )}
                        </div>
                      </Checkbox>
                    </Col>
                  ))}
                </Row>
              </div>
            ))
          ) : (
            <Alert
              title="权限定义未加载"
              description="请先刷新页面加载权限定义"
              type="warning"
              showIcon
            />
          )}
        </div>
        <div
          style={{
            marginTop: isMobile ? '12px' : '16px',
            padding: isMobile ? '8px' : '12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
          }}
        >
          <Text type="secondary" style={{ fontSize: isMobile ? '12px' : '14px' }}>
            已选择 <strong>{selectedPermissionsForNewRole.length}</strong> 项权限
          </Text>
        </div>
      </Modal>
    </div>
  );
};

export default RolePermissionManagement;
