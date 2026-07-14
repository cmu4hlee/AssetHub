/**
 * 租户角色权限配置页面（需求④可视化面板）
 *
 * 面向：system_admin / super_admin（后端 requireSystemAdmin 守护）。
 * 特点：
 *  - 配置只作用于「当前租户」（X-Tenant-ID 由请求拦截器自动注入，后端再以
 *    req.user.tenant_id 二次校验），不同租户之间的角色/菜单/数据范围/操作权限
 *    相互独立。
 *  - 切换顶部角色下拉即切换被配置的角色，所有保存仅影响该角色在当前租户下的授权。
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useIsMobile } from '../hooks';
import {
  Card,
  Select,
  Tabs,
  Button,
  Checkbox,
  Space,
  message,
  Spin,
  Alert,
  Tag,
  Input,
  Typography,
  Empty,
  Divider,
} from 'antd';
import { SaveOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons';
import { tenantRoleConfigAPI } from '../api/domains/tenantRoleConfig';
import { rolesPermissionsAPI } from '../utils/api';
import { getApiErrorMessage } from '../api/client';

const { Title, Text } = Typography;
const { Option } = Select;

// 把菜单定义树拍平为带层级的列表（用于勾选）
function flattenMenuTree(nodes, depth = 0, acc = []) {
  (nodes || []).forEach(node => {
    acc.push({
      menu_key: node.menu_key,
      menu_label: node.menu_label || node.label || node.menu_key,
      depth,
    });
    if (Array.isArray(node.children) && node.children.length > 0) {
      flattenMenuTree(node.children, depth + 1, acc);
    }
  });
  return acc;
}

const DATA_SCOPE_OPTIONS = [
  { value: 'all', label: '全部数据' },
  { value: 'department', label: '仅本部门数据' },
  { value: 'self', label: '仅本人数据' },
  { value: 'custom', label: '自定义部门' },
];

const ROLE_LABELS = {
  super_admin: '超级管理员',
  system_admin: '系统管理员',
  asset_admin: '资产管理员',
  department_admin: '科室管理员',
  metrology_admin: '计量管理员',
  quality_admin: '质控管理员',
  maintenance_admin: '维修管理员',
  maintenance_engineer: '维修工程师',
  acceptance_admin: '验收管理员',
  transfer_admin: '调配管理员',
  inventory_admin: '盘点管理员',
  user: '普通用户',
};

const TenantRoleConfig = () => {
  const isMobile = useIsMobile();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentTenantName = currentUser.tenant_name || '(当前租户)';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);

  // 菜单权限
  const [menuDefs, setMenuDefs] = useState([]); // 拍平后的菜单定义
  const [roleMenuMap, setRoleMenuMap] = useState({}); // { menu_key: bool }
  const [origMenuMap, setOrigMenuMap] = useState({});

  // 数据范围
  const [dataScope, setDataScope] = useState('department');
  const [origDataScope, setOrigDataScope] = useState('department');

  // 操作权限
  const [permissions, setPermissions] = useState([]); // [permission_key]
  const [origPermissions, setOrigPermissions] = useState([]);
  const [permInput, setPermInput] = useState('');

  // ===== 加载 =====
  const loadRoles = useCallback(async () => {
    const res = await tenantRoleConfigAPI.getRoles();
    if (res.success) {
      const list = (res.data || []).map(r => ({
        role: r.role_code || r.role,
        label: r.role_name || r.label || ROLE_LABELS[r.role_code] || r.role_code,
        description: r.description,
      }));
      setRoles(list);
      return list;
    }
    return [];
  }, []);

  const loadMenuDefs = useCallback(async () => {
    const res = await rolesPermissionsAPI.getMenuDefinitions();
    if (res.success) {
      setMenuDefs(flattenMenuTree(res.data || []));
    }
  }, []);

  const loadRoleAll = useCallback(async role => {
    if (!role) return;
    setLoading(true);
    try {
      const [menusRes, scopeRes, permRes] = await Promise.all([
        tenantRoleConfigAPI.getRoleMenus(role),
        tenantRoleConfigAPI.getRoleDataScope(role),
        tenantRoleConfigAPI.getRolePermissions(role),
      ]);
      const mMap = {};
      (menusRes.data || []).forEach(m => {
        mMap[m.menu_key] = m.is_visible === 1 || m.is_visible === true;
      });
      setRoleMenuMap(mMap);
      setOrigMenuMap({ ...mMap });

      const ds = scopeRes.data?.data_scope || 'department';
      setDataScope(ds);
      setOrigDataScope(ds);

      const perms = Array.isArray(permRes.data) ? permRes.data : [];
      setPermissions(perms);
      setOrigPermissions([...perms]);
    } catch (e) {
      message.error('加载角色配置失败：' + getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [list] = await Promise.all([loadRoles(), loadMenuDefs()]);
        if (list && list.length > 0) {
          const first = list[0].role;
          setSelectedRole(first);
          await loadRoleAll(first);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [loadRoles, loadMenuDefs, loadRoleAll]);

  const handleRoleChange = async role => {
    setSelectedRole(role);
    await loadRoleAll(role);
  };

  // ===== 保存：菜单权限 =====
  const saveMenus = async () => {
    setSaving(true);
    try {
      const menus = menuDefs.map(m => ({
        menu_key: m.menu_key,
        is_visible: roleMenuMap[m.menu_key] ? 1 : 0,
      }));
      const res = await tenantRoleConfigAPI.updateRoleMenus(selectedRole, menus);
      if (res.success) {
        setOrigMenuMap({ ...roleMenuMap });
        message.success('菜单权限已保存（仅对当前租户生效）');
      } else {
        message.error(res.message || '保存失败');
      }
    } catch (e) {
      message.error('保存失败：' + getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // ===== 保存：数据范围 =====
  const saveDataScope = async () => {
    setSaving(true);
    try {
      const res = await tenantRoleConfigAPI.updateRoleDataScope(selectedRole, dataScope);
      if (res.success) {
        setOrigDataScope(dataScope);
        message.success('数据范围已保存（仅对当前租户生效）');
      } else {
        message.error(res.message || '保存失败');
      }
    } catch (e) {
      message.error('保存失败：' + getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // ===== 保存：操作权限 =====
  const savePermissions = async () => {
    setSaving(true);
    try {
      const res = await tenantRoleConfigAPI.updateRolePermissions(selectedRole, permissions);
      if (res.success) {
        setOrigPermissions([...permissions]);
        message.success('操作权限已保存（仅对当前租户生效）');
      } else {
        message.error(res.message || '保存失败');
      }
    } catch (e) {
      message.error('保存失败：' + getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const addPermission = () => {
    const v = permInput.trim();
    if (!v) return;
    if (!permissions.includes(v)) setPermissions([...permissions, v]);
    setPermInput('');
  };
  const removePermission = p => setPermissions(permissions.filter(x => x !== p));

  const menuDirty = JSON.stringify(roleMenuMap) !== JSON.stringify(origMenuMap);
  const scopeDirty = dataScope !== origDataScope;
  const permDirty = JSON.stringify(permissions) !== JSON.stringify(origPermissions);

  const roleLabel = roles.find(r => r.role === selectedRole)?.label || selectedRole;

  const tabItems = [
    {
      key: 'menus',
      label: '菜单权限',
      children: (
        <Spin spinning={loading}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="勾选即代表该角色在当前租户下可见对应菜单；取消勾选则隐藏。修改仅作用于当前租户。"
          />
          <div
            style={{
              maxHeight: '55vh',
              overflowY: 'auto',
              border: '1px solid #f0f0f0',
              borderRadius: 6,
              padding: 12,
            }}
          >
            {menuDefs.length === 0 && <Empty description="暂无菜单定义" />}
            {menuDefs.map(m => (
              <div
                key={m.menu_key}
                style={{ paddingLeft: m.depth * 18, paddingTop: 4, paddingBottom: 4 }}
              >
                <Checkbox
                  checked={!!roleMenuMap[m.menu_key]}
                  onChange={e =>
                    setRoleMenuMap(prev => ({ ...prev, [m.menu_key]: e.target.checked }))
                  }
                >
                  {m.menu_label}
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    {m.menu_key}
                  </Text>
                </Checkbox>
              </div>
            ))}
          </div>
          <Divider />
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={!menuDirty}
              onClick={saveMenus}
            >
              保存菜单权限
            </Button>
            <Button
              icon={<ReloadOutlined />}
              disabled={!menuDirty}
              onClick={() => setRoleMenuMap({ ...origMenuMap })}
            >
              撤销更改
            </Button>
          </Space>
        </Spin>
      ),
    },
    {
      key: 'scope',
      label: '数据范围',
      children: (
        <Spin spinning={loading}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="控制该角色在当前租户下能看到的数据边界（资产、工单、文档等）。"
          />
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              value={dataScope}
              style={{ width: 280 }}
              onChange={setDataScope}
              options={DATA_SCOPE_OPTIONS}
            />
            <Text type="secondary">自定义部门需配合后端部门编码，当前租户生效。</Text>
          </Space>
          <Divider />
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={!scopeDirty}
              onClick={saveDataScope}
            >
              保存数据范围
            </Button>
            <Button
              icon={<ReloadOutlined />}
              disabled={!scopeDirty}
              onClick={() => setDataScope(origDataScope)}
            >
              撤销更改
            </Button>
          </Space>
        </Spin>
      ),
    },
    {
      key: 'permissions',
      label: '操作权限',
      children: (
        <Spin spinning={loading}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="维护该角色在当前租户下拥有的操作级权限标识（如 asset:export、user:invite）。留空表示仅继承菜单可见性。"
          />
          <Space wrap style={{ marginBottom: 12 }}>
            {permissions.length === 0 && <Text type="secondary">尚未配置操作权限</Text>}
            {permissions.map(p => (
              <Tag
                key={p}
                closable
                onClose={() => removePermission(p)}
                color="blue"
              >
                {p}
              </Tag>
            ))}
          </Space>
          <Space.Compact style={{ width: '100%', maxWidth: 420 }}>
            <Input
              placeholder="输入权限标识后回车，如 asset:export"
              value={permInput}
              onChange={e => setPermInput(e.target.value)}
              onPressEnter={addPermission}
            />
            <Button type="primary" onClick={addPermission}>
              添加
            </Button>
          </Space.Compact>
          <Divider />
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={!permDirty}
              onClick={savePermissions}
            >
              保存操作权限
            </Button>
            <Button
              icon={<ReloadOutlined />}
              disabled={!permDirty}
              onClick={() => setOrigPermissions([...origPermissions])}
            >
              撤销更改
            </Button>
          </Space>
        </Spin>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? 12 : 24, maxWidth: 1000, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 4 }}>
        租户角色权限配置
      </Title>
      <Alert
        type="success"
        showIcon
        icon={<TeamOutlined />}
        style={{ marginBottom: 16 }}
        message={`当前配置租户：${currentTenantName}`}
        description="以下所有修改仅对当前租户生效，各租户的角色与权限体系相互独立、互不干扰。"
      />

      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space wrap>
            <Text strong>配置角色：</Text>
            <Select
              value={selectedRole}
              style={{ minWidth: 220 }}
              onChange={handleRoleChange}
              loading={loading && roles.length === 0}
              options={roles.map(r => ({ value: r.role, label: r.label }))}
            />
            {selectedRole && (
              <Text type="secondary">
                {roleLabel}（{selectedRole}）
              </Text>
            )}
          </Space>

          {selectedRole ? (
            <Tabs items={tabItems} />
          ) : (
            <Empty description="请选择一个角色" />
          )}
        </Space>
      </Card>
    </div>
  );
};

export default TenantRoleConfig;
