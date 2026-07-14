import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Menu, Button, Dropdown, message, Drawer, Select } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import crypto from '../utils/crypto';
import { openPathInExternalBrowser } from '../utils/feishu';
import './Layout.css';
import {
  DashboardOutlined,
  AppstoreOutlined,
  FileSearchOutlined,
  SwapOutlined,
  GiftOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuOutlined,
  ApartmentOutlined,
  ToolOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  SettingOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  RobotOutlined,
  ExperimentOutlined,
  WarningOutlined,
  PrinterOutlined,
  MessageOutlined,
  ApiOutlined,
  DollarOutlined,
  SafetyOutlined,
  AlertOutlined,
  ShopOutlined,
  FileProtectOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  ReconciliationOutlined,
  ProfileOutlined,
  BarChartOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { assetAPI, rolesPermissionsAPI, tenantAPI, userAPI } from '../utils/api';
import { menuAPI } from '../api/domains/platform';
import auth from '../utils/auth';
import { useDepartment } from '../contexts/DepartmentContext';
import { isAdminRole, isSuperAdminOnlyMenu, getRoleDisplayName } from '../utils/roleUtils';
import useFeishu from '../hooks/useFeishu';
import AlertNotification from './AlertNotification';

const { Header, Sider, Content } = Layout;
const { Option } = Select;

const ICON_MAP = {
  DashboardOutlined: <DashboardOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  FileSearchOutlined: <FileSearchOutlined />,
  SwapOutlined: <SwapOutlined />,
  GiftOutlined: <GiftOutlined />,
  UserOutlined: <UserOutlined />,
  LogoutOutlined: <LogoutOutlined />,
  MenuOutlined: <MenuOutlined />,
  ApartmentOutlined: <ApartmentOutlined />,
  ToolOutlined: <ToolOutlined />,
  EnvironmentOutlined: <EnvironmentOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  SettingOutlined: <SettingOutlined />,
  AuditOutlined: <AuditOutlined />,
  CheckCircleOutlined: <CheckCircleOutlined />,
  RobotOutlined: <RobotOutlined />,
  ExperimentOutlined: <ExperimentOutlined />,
  WarningOutlined: <WarningOutlined />,
  PrinterOutlined: <PrinterOutlined />,
  MessageOutlined: <MessageOutlined />,
  ApiOutlined: <ApiOutlined />,
  DollarOutlined: <DollarOutlined />,
  SafetyOutlined: <SafetyOutlined />,
  AlertOutlined: <AlertOutlined />,
  ShopOutlined: <ShopOutlined />,
  ReconciliationOutlined: <ReconciliationOutlined />,
  ProfileOutlined: <ProfileOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  FileProtectOutlined: <FileProtectOutlined />,
};

const HIDDEN_MENU_KEYS = new Set([
  '/ai-maintenance',
  '/ai-question-records',
  '/technical-documents/ai',
  '/asset-query',
  '/ai-assistant/ct-maintenance',
  '/ai-tools-parent',
  '/feishu-binding',
]);

const AppLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(true); // 默认收起侧边菜单
  const [user, setUser] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [managedDepartments, setManagedDepartments] = useState([]);
  const [visibleMenuKeys, setVisibleMenuKeys] = useState([]); // 用户可见的菜单键列表
  const [menuPermissionLoaded, setMenuPermissionLoaded] = useState(false); // 权限是否已加载
  const [tenants, setTenants] = useState([]); // 用户关联的企业列表
  const [currentTenantId, setCurrentTenantId] = useState(null); // 当前选中的企业ID
  const [menuTree, setMenuTree] = useState([]); // 基于模块配置的菜单树
  const { selectedDepartmentId, updateSelectedDepartment } = useDepartment();
  const navigate = useNavigate();
  const location = useLocation();
  const feishu = useFeishu();

  // 从 URL 读取主题参数（来自 DashboardDesktop 桌面窗口）
  const shellThemeClass = useMemo(() => {
    const urlParams = new URLSearchParams(location.search);
    const themeParam = urlParams.get('theme');
    if (themeParam === 'light') return 'theme-light';
    if (themeParam === 'dark') return 'theme-dark';
    if (feishu.theme === 'dark') return 'theme-dark';
    if (feishu.theme === 'light') return 'theme-light';
    return '';
  }, [location.search, feishu.theme]);

  // 飞书窄视图(移动端工作台)默认收起侧边栏,使用抽屉式菜单
  const isFeishuNarrow = feishu.isFeishu && feishu.isNarrow;

  // 加载企业列表
  const loadTenants = async () => {
    try {
      const userData = crypto.getItem('user');
      if (!userData) return;

      // 只有超级管理员和系统管理员（租户级）可以加载企业列表
      if (userData.role === 'super_admin' || userData.role === 'system_admin') {
        const result = await tenantAPI.getTenants();

        if (result && result.success) {
          let allTenants = Array.isArray(result.data?.data)
            ? result.data.data
            : Array.isArray(result.data)
              ? result.data
              : [];
          setTenants(allTenants);
        }
      } else {
        // 普通用户：从登录返回的 enterprises 填充切换器（支持多租户切换）
        const enterprises = crypto.getItem('enterprises');
        const entList = Array.isArray(enterprises) ? enterprises : [];
        if (entList.length > 1) {
          setTenants(entList);
        }
      }
    } catch (error) {
      console.error('加载企业列表失败:', error);
    }
  };

  // 处理企业切换
  const handleTenantChange = async tenantId => {
    try {
      // 先从已加载的 tenants 列表取企业名（普通用户也可用），getTenant 作兜底（管理员）
      let tenantName = tenants.find(t => Number(t.id) === Number(tenantId))?.tenant_name;
      if (!tenantName) {
        try {
          const result = await tenantAPI.getTenant(tenantId);
          if (result?.success && result.data?.tenant_name) tenantName = result.data.tenant_name;
        } catch (e) {
          /* 普通用户可能无权调 getTenant，忽略 */
        }
      }

      // 写入选中的企业空间（拦截器会据此发送 X-Tenant-ID）
      await crypto.setItemAsync('selectedEnterprise', {
        id: tenantId,
        tenant_name: tenantName,
      });

      // 从服务器获取最新的用户信息（携带新 X-Tenant-ID → 返回该租户下的角色）
      const profileResult = await userAPI.getProfile();
      if (profileResult.success) {
        const updatedUser = profileResult.data;

        // 更新localStorage中的用户信息（加密存储）
        await crypto.setItemAsync('user', updatedUser);
        setUser(updatedUser);
        setCurrentTenantId(tenantId);

        // 重新加载菜单和科室（此时 X-Tenant-ID 已切换 → 菜单实时更新）
        await loadUserMenus();
        if (updatedUser.role === 'super_admin' || updatedUser.role === 'system_admin') {
          await loadAllDepartments();
        } else if (
          updatedUser.managed_departments &&
          updatedUser.managed_departments.length > 0
        ) {
          await loadManagedDepartments(updatedUser.managed_departments);
        }

        // 发送自定义事件，通知所有组件数据已更新
        window.dispatchEvent(
          new CustomEvent('tenantChanged', {
            detail: {
              tenantId,
              tenantName: tenantName,
            },
          })
        );

        // 使用React Router的navigate方法刷新当前页面，避免全页面刷新
        navigate(location.pathname, { replace: true });
      }
    } catch (error) {
      console.error('切换企业失败:', error);
      message.error('切换企业失败');
    }
  };

  // 加载用户可见菜单
  const loadUserMenus = async () => {
    try {
      // 获取基于模块配置的菜单树
      const menuResult = await menuAPI.getMenuTree();
      console.log('[Layout] menuResult:', JSON.stringify(menuResult));
      if (menuResult.success && menuResult.data) {
        console.log('模块菜单树:', menuResult.data);
        setMenuTree(menuResult.data.menus || []);
      } else if (menuResult.data?.menus) {
        // 后端返回 success:false 但携带兜底菜单数据
        setMenuTree(menuResult.data.menus || []);
      }

      // 同时获取用户的菜单权限（用于控制可见性）
      const permResult = await rolesPermissionsAPI.getUserMenus();
      if (permResult.success) {
        console.log('用户菜单权限:', permResult.data);
        // 获取当前用户角色
        const currentUser = crypto.getItem('user');

        // 如果是超级管理员，确保包含企业管理菜单
        let finalVisibleKeys = [...(permResult.data || [])];
        if (currentUser?.role === 'super_admin') {
          if (!finalVisibleKeys.includes('/tenants')) {
            console.log('超级管理员菜单中缺少 /tenants，添加中...');
            finalVisibleKeys.push('/tenants');
          }
        }
        setVisibleMenuKeys(finalVisibleKeys);
        setMenuPermissionLoaded(true);
      } else {
        setMenuPermissionLoaded(true);
      }
    } catch (error) {
      console.error('加载用户菜单失败:', error);
      // 后端 500 响应仍会携带兜底菜单数据
      const fallbackMenus = error?.response?.data?.data?.menus;
      if (Array.isArray(fallbackMenus) && fallbackMenus.length > 0) {
        setMenuTree(fallbackMenus);
      }
      setMenuPermissionLoaded(true);
    }
  };

  // 加载所有科室（系统管理员使用）
  const loadAllDepartments = async () => {
    try {
      const result = await assetAPI.getDepartments();
      if (result.success) {
        console.log('系统管理员加载所有科室:', result.data);
        setManagedDepartments(result.data);
      }
    } catch (error) {
      console.error('加载所有科室失败:', error);
    }
  };

  // 加载管理科室的详细信息
  const loadManagedDepartments = async departmentIds => {
    try {
      const result = await assetAPI.getDepartments();
      if (result.success) {
        const depts = result.data.filter(dept => departmentIds.includes(dept.id));
        console.log('加载到的管理科室:', depts);
        setManagedDepartments(depts);

        // 如果用户只有1个科室，默认选中该科室
        if (depts.length === 1) {
          const singleDeptId = depts[0].id.toString();
          if (selectedDepartmentId === 'all' || !selectedDepartmentId) {
            updateSelectedDepartment(singleDeptId);
          }
        } else if (depts.length > 1) {
          // 如果用户管理多个科室，默认选择"全部科室"
          // 检查当前选中的科室ID是否有效
          if (selectedDepartmentId && selectedDepartmentId !== 'all') {
            const selectedId = parseInt(selectedDepartmentId);
            // 如果选中的科室不在管理科室列表中，重置为"全部科室"
            if (!departmentIds.includes(selectedId)) {
              console.log('选中的科室不在管理科室列表中，重置为"全部科室"');
              updateSelectedDepartment('all');
            }
          } else if (!selectedDepartmentId || selectedDepartmentId === 'all') {
            // 如果没有选择或已经是'all'，确保设置为'all'
            if (selectedDepartmentId !== 'all') {
              console.log('用户管理多个科室，默认选择"全部科室"');
              updateSelectedDepartment('all');
            }
          }
        }
      } else {
        console.error('获取科室列表失败:', result);
      }
    } catch (error) {
      console.error('加载管理科室失败:', error);
    }
  };

  // 检测屏幕尺寸变化
  useEffect(() => {
    const checkMobile = () => {
      // 飞书窄视图(≤540px,常见于移动端工作台)也视作移动端布局
      const width = window.innerWidth || 0;
      setIsMobile(width < 768 || (feishu.isFeishu && width <= 540));
    };

    // 初始化检测
    checkMobile();
    // 添加屏幕尺寸变化监听
    window.addEventListener('resize', checkMobile);
    // 清理监听
    return () => window.removeEventListener('resize', checkMobile);
  }, [feishu.isFeishu]);

  // 移动端菜单点击后关闭抽屉
  const handleMobileMenuClick = ({ key }) => {
    const externalPaths = ['/inventory', '/self-inventory', '/inventory-self'];
    const shouldUseExternal = feishu.isFeishu && feishu.isNarrow &&
      externalPaths.some(p => key.startsWith(p));
    if (shouldUseExternal) {
      setDrawerVisible(false);
      openPathInExternalBrowser(key);
    } else {
      navigate(key);
      setDrawerVisible(false);
    }
  };

  // 加载用户信息和管理科室
  useEffect(() => {
    let cancelled = false;

    const loadUserInfo = async () => {
      try {
        // 从服务器获取最新的用户信息，确保角色来源于企业角色表
        const result = await userAPI.getProfile();
        if (cancelled) return;
        if (result.success) {
          const userData = result.data;
          setUser(userData);
          setCurrentTenantId(userData.tenant_id);

          // 更新localStorage中的用户信息（加密存储）
          await crypto.setItemAsync('user', userData);

          // 超级管理员和系统管理员（租户级）默认拥有所有科室
          if (userData.role === 'super_admin' || userData.role === 'system_admin') {
            // 加载所有科室
            loadAllDepartments();
            // 加载企业列表
            loadTenants();
          } else if (userData.managed_departments && userData.managed_departments.length > 0) {
            // 如果用户有管理科室，加载科室详细信息
            console.log('用户管理科室ID:', userData.managed_departments);
            loadManagedDepartments(userData.managed_departments);
          } else {
            console.log('用户没有管理科室或管理科室为空');
          }

          // 加载用户可见菜单
          loadUserMenus();
        }
      } catch (error) {
        if (cancelled) return;
        console.error('从服务器加载用户信息失败:', error);
        // 如果从服务器获取失败，尝试从localStorage获取（优先尝试解密读取）
        const rawUser = localStorage.getItem('user');
        // 如果是 JWT token 格式，不解析
        if (rawUser && rawUser.includes('.')) {
          console.warn('localStorage 中的 user 数据是 JWT token，清除并重新登录');
          localStorage.removeItem('user');
          return;
        }
        const userData =
          crypto.getItem('user') ||
          (rawUser
            ? (() => {
                try {
                  return JSON.parse(rawUser);
                } catch {
                  return null;
                }
              })()
            : null);
        if (!cancelled && userData) {
          setUser(userData);
          setCurrentTenantId(userData.tenant_id);

          // 超级管理员和系统管理员（租户级）默认拥有所有科室
          if (userData.role === 'super_admin' || userData.role === 'system_admin') {
            // 加载所有科室
            loadAllDepartments();
            // 加载企业列表
            loadTenants();
          } else if (userData.managed_departments && userData.managed_departments.length > 0) {
            // 如果用户有管理科室，加载科室详细信息
            console.log('用户管理科室ID:', userData.managed_departments);
            loadManagedDepartments(userData.managed_departments);
          } else {
            console.log('用户没有管理科室或管理科室为空');
          }

          // 加载用户可见菜单
          loadUserMenus();
        }
      }
    };

    loadUserInfo();

    return () => {
      cancelled = true;
    };
  }, []);

  // 处理科室切换
  const handleDepartmentChange = value => {
    updateSelectedDepartment(value);
    // 刷新当前页面数据（通过React Router的navigate方法，避免全页面刷新）
    navigate(location.pathname, { replace: true });
  };

  const handleLogout = () => {
    crypto.removeItem('token');
    crypto.removeItem('user');
    crypto.removeItem('selectedEnterprise');
    crypto.removeItem('enterprises');
    auth.clearOpenClawCredentials();
    message.success('已退出登录');
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'change-password',
      icon: <KeyOutlined />,
      label: '修改密码',
      onClick: () => navigate('/change-password'),
    },
    {
      key: 'preferences',
      icon: <SettingOutlined />,
      label: '偏好设置',
      onClick: () => navigate('/preferences'),
    },
    { type: 'divider' },
    ...(feishu.isFeishu
      ? [
          {
            key: 'feishu-close',
            icon: <CloseOutlined />,
            label: '关闭网页应用',
            onClick: () => feishu.close(),
          },
        ]
      : []),
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  // 菜单数据源：来自后端 API 的菜单树（非硬编码）
  const allMenuItems = useMemo(() => menuTree, [menuTree]);

  // 过滤菜单项（递归过滤子菜单，使用useMemo缓存）
  const menuItems = useMemo(() => {
    const menuVisibilityAliases = {
      '/technical-documents/batch-upload': ['/technical-documents/upload'],
    };

    // 标准化菜单项，确保只使用中文简标签
    const normalizeItem = item => {
      // 提取标签
      let label = item.label || item.menu_label || '';
      // 只有包含路径分隔符才需要提取最后一段
      if (label.includes('/')) {
        label = label.split('/').pop();
      } else if (label.includes('\\')) {
        label = label.split('\\').pop();
      }
      label = label.trim();
      // 如果 label 为空，使用 item.key（此时 item.key 已经是处理后的 key）
      if (!label) {
        label = item.key || '';
      }

      // icon 处理：字符串转 React 组件，其他保持不变
      let icon = item.icon;
      if (typeof icon === 'string' && icon) {
        const mapped = ICON_MAP[icon];
        icon = mapped || null;
      }

      // 一级菜单图标兜底：如果没有icon，根据菜单路径设置合适的图标
      if (!icon && item.children && item.children.length > 0) {
        const key = item.key || '';
        if (key.includes('asset')) icon = <AppstoreOutlined />;
        else if (key.includes('ai')) icon = <RobotOutlined />;
        else if (key.includes('transfer')) icon = <SwapOutlined />;
        else if (key.includes('idle')) icon = <GiftOutlined />;
        else if (key.includes('maintenance')) icon = <ToolOutlined />;
        else if (key.includes('monitoring') || key.includes('location'))
          icon = <EnvironmentOutlined />;
        else if (key.includes('document')) icon = <FileTextOutlined />;
        else if (key.includes('quality') || key.includes('qc')) icon = <ExperimentOutlined />;
        else if (key.includes('acceptance')) icon = <CheckCircleOutlined />;
        else if (key.includes('depreciation')) icon = <DollarOutlined />;
        else if (key.includes('system')) icon = <SettingOutlined />;
        else if (key.includes('dashboard')) icon = <DashboardOutlined />;
        else if (key.includes('special-equipment')) icon = <AlertOutlined />;
        else if (key.includes('safety-inspection')) icon = <SafetyOutlined />;
        else if (key.includes('inspection')) icon = <ReconciliationOutlined />;
        else icon = <AppstoreOutlined />;
      }

      return {
        key: item.key,
        label,
        icon,
      };
    };

    // 移动端隐藏的菜单项（打印功能在手机端无意义）
    const MOBILE_HIDDEN_MENU_KEYS = new Set([
      '/asset-labels/print',
      '/report-print',
    ]);

    // 定义过滤函数
    const filter = items => {
      return items
        .map(item => {
          if (HIDDEN_MENU_KEYS.has(item.key)) {
            return null;
          }

          // 移动端隐藏打印相关菜单
          if (isMobile && MOBILE_HIDDEN_MENU_KEYS.has(item.key)) {
            return null;
          }

          // 超级管理员专属菜单检查
          if (isSuperAdminOnlyMenu(item.key)) {
            if (!isAdminRole(user?.role)) {
              return null;
            }
          }

          // 角色白名单检查（安全冗余，后端已过滤）
          if (item.roles && item.roles.length > 0 && !item.roles.includes(user?.role)) {
            return null;
          }

          const selfVisible =
            isAdminRole(user?.role) ||
            (menuPermissionLoaded && visibleMenuKeys.length > 0 && (
              visibleMenuKeys.includes(item.key) ||
              (Array.isArray(menuVisibilityAliases[item.key]) &&
                menuVisibilityAliases[item.key].some(aliasKey => visibleMenuKeys.includes(aliasKey)))
            ));

          if (item.children && item.children.length > 0) {
            const filteredChildren = filter(item.children);
            // 父菜单本身可见，或存在至少一个可见子菜单时显示
            if (!selfVisible && filteredChildren.length === 0) {
              return null;
            }
            const normalized = normalizeItem(item);
            return {
              ...normalized,
              children: filteredChildren,
            };
          }

          return selfVisible ? normalizeItem(item) : null;
        })
        .filter(item => item !== null);
    };

    // 菜单结构以本地规范目录为准，再叠加权限过滤。
    return filter(allMenuItems);
  }, [allMenuItems, user, visibleMenuKeys, menuPermissionLoaded, isMobile]);

  const handleMenuClick = ({ key }) => {
    const externalPaths = ['/inventory', '/self-inventory', '/inventory-self'];
    const shouldUseExternal = feishu.isFeishu && feishu.isNarrow &&
      externalPaths.some(p => key.startsWith(p));
    if (shouldUseExternal) {
      openPathInExternalBrowser(key);
    } else {
      navigate(key);
    }
  };

  const isAIAssistantRoute = location.pathname === '/ai-assistant';

  return (
    <Layout
      className={`app-shell ${shellThemeClass} ${feishu.isFeishu ? 'app-shell--feishu' : ''} ${
        isFeishuNarrow ? 'app-shell--feishu-narrow' : ''
      }`.trim()}
    >
      {/* 桌面端显示侧边栏 */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme="light"
          width={feishu.isFeishu && !feishu.isWide ? 180 : 200}
          collapsedWidth={feishu.isFeishu && !feishu.isWide ? 44 : 48}
          className="app-sider"
        >
          <div className="app-sider-brand">
            <span className="app-sider-brand-mark">A</span>
            {collapsed ? (
              <span style={{ display: 'none' }}></span>
            ) : (
              <span className="app-sider-brand-name">
                {user?.tenant_name || 'AssetHost'}
              </span>
            )}
          </div>
          <Menu
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={[
              location.pathname,
              location.pathname.split('/')[1]
                ? `/${location.pathname.split('/')[1]}`
                : '/dashboard',
            ]}
            items={menuItems}
            onClick={handleMenuClick}
            className="app-menu"
          />
        </Sider>
      )}
      <Layout className="app-main-layout">
        <Header className="app-topbar">
          {/* 移动端 / 飞书窄视图显示菜单按钮 */}
          {(isMobile || isFeishuNarrow) && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setDrawerVisible(true)}
              className="mobile-menu-btn"
              aria-label="打开菜单"
            />
          )}
          {/* 飞书环境下显示返回/关闭按钮,便于用户在嵌套 webview 中快速退出 */}
          {feishu.isFeishu && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  feishu.close();
                }
              }}
              className="feishu-back-btn"
              aria-label="返回"
            />
          )}
          <span className="app-topbar-title">
            {feishu.isFeishu && !user?.tenant_name ? 'AssetHost' : user?.tenant_name || 'AssetHost'}
          </span>

          {/* 移动端/飞书窄视图隐藏企业/科室切换器,移入抽屉菜单以节省顶部空间 */}
          {!isMobile && !isFeishuNarrow && tenants.length > 0 && (
            <div className="header-selector">
              <span className="header-selector-label">企业:</span>
              <Select
                value={currentTenantId}
                onChange={handleTenantChange}
                style={{ minWidth: 200 }}
                size="middle"
                placeholder="选择企业"
              >
                {tenants.map(tenant => (
                  <Option key={tenant.id} value={tenant.id}>
                    {tenant.tenant_name}
                  </Option>
                ))}
              </Select>
            </div>
          )}

          {/* 科室切换器 - 移动端隐藏,移入抽屉 */}
          {!isMobile && !isFeishuNarrow &&
            user?.role !== 'super_admin' &&
            user?.role !== 'system_admin' &&
            managedDepartments.length > 0 && (
              <div className="header-selector">
                <span className="header-selector-label">科室:</span>
                <Select
                  value={selectedDepartmentId}
                  onChange={handleDepartmentChange}
                  style={{ minWidth: 200 }}
                  size="middle"
                  placeholder="选择科室"
                >
                  {managedDepartments.length > 1 && (
                    <Option value="all">
                      <ApartmentOutlined /> 全部科室
                    </Option>
                  )}
                  {managedDepartments.map(dept => (
                    <Option key={dept.id} value={dept.id.toString()}>
                      {dept.department_name}
                    </Option>
                  ))}
                </Select>
              </div>
            )}

          {/* 通知中心 - 实时推送 + 预警通知 */}
          <AlertNotification />

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button
              type="text"
              icon={<UserOutlined />}
              className="header-user-btn"
            >
              {/* 移动端只显示图标,不显示文字,节省顶部空间 */}
              {!isMobile && !isFeishuNarrow && (
                <>
                  {user?.real_name || user?.username || '用户'}
                  {user?.role && (
                    <span className="header-user-role">({getRoleDisplayName(user.role)})</span>
                  )}
                </>
              )}
            </Button>
          </Dropdown>
        </Header>
        <Content
          className={`app-content-surface ${
            isAIAssistantRoute ? 'app-content-surface--conversation' : ''
          }`.trim()}
        >
          {children}
        </Content>
      </Layout>

      {/* 移动端 / 飞书窄视图抽屉菜单 */}
      <Drawer
        title="菜单"
        placement="left"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        size={feishu.isFeishu && feishu.isNarrow ? Math.min(280, window.innerWidth - 32) : 280}
        className="mobile-menu-drawer"
      >
        {/* 移动端:将企业/科室切换器放入抽屉,减轻顶栏压力 */}
        {(isMobile || isFeishuNarrow) && (
          <div className="mobile-drawer-selectors">
            {tenants.length > 0 && (
              <div className="mobile-drawer-selector-item">
                <span className="mobile-drawer-selector-label">企业</span>
                <Select
                  value={currentTenantId}
                  onChange={handleTenantChange}
                  style={{ width: '100%' }}
                  size="middle"
                  placeholder="选择企业"
                >
                  {tenants.map(tenant => (
                    <Option key={tenant.id} value={tenant.id}>
                      {tenant.tenant_name}
                    </Option>
                  ))}
                </Select>
              </div>
            )}
            {user?.role !== 'super_admin' &&
              user?.role !== 'system_admin' &&
              managedDepartments.length > 0 && (
                <div className="mobile-drawer-selector-item">
                  <span className="mobile-drawer-selector-label">科室</span>
                  <Select
                    value={selectedDepartmentId}
                    onChange={handleDepartmentChange}
                    style={{ width: '100%' }}
                    size="middle"
                    placeholder="选择科室"
                  >
                    {managedDepartments.length > 1 && (
                      <Option value="all">
                        <ApartmentOutlined /> 全部科室
                      </Option>
                    )}
                    {managedDepartments.map(dept => (
                      <Option key={dept.id} value={dept.id.toString()}>
                        {dept.department_name}
                      </Option>
                    ))}
                  </Select>
                </div>
              )}
          </div>
        )}
        <Menu
          mode="inline"
          selectedKeys={[
            location.pathname,
            location.pathname.split('/')[1] ? `/${location.pathname.split('/')[1]}` : '/dashboard',
          ]}
          items={menuItems}
          onClick={handleMobileMenuClick}
          style={{ borderRight: 'none' }}
        />
      </Drawer>
    </Layout>
  );
};

export default AppLayout;
