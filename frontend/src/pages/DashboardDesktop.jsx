import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Modal, Card, Button, message, Spin, Switch } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  DashboardOutlined,
  CloudOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  BellOutlined,
  LockOutlined,
  WifiOutlined,
  SoundOutlined,
  CloseOutlined,
  ExpandOutlined,
  CompressOutlined,
  RightOutlined,
  LeftOutlined,
  ReloadOutlined,
  AppstoreAddOutlined,
  AppstoreOutlined,
  PictureOutlined,
  ExperimentOutlined as QCOutlined,
  ToolOutlined as MaintenanceOutlined,
  SendOutlined,
  SunOutlined,
  MoonOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  RobotOutlined,
  UserOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { assetAPI, maintenanceAPI, rolesPermissionsAPI, desktopPrefsAPI } from '../utils/api';
import auth from '../utils/auth';
import { sendOpenClawAssistantMessage, createConversationId } from '../api/openclawAssistant';
import { isAdminRole } from '../utils/roleUtils';
import { desktopMenuItems } from './dashboardDesktopConfig.jsx';
import { PRESET_WALLPAPERS, DESKTOP_WALLPAPER_KEY, DESKTOP_THEME_KEY, normalizeWallpaper } from './dashboardDesktopWallpaper';
import './DashboardDesktop.css';

// 独立的时钟组件，避免父组件每秒重渲染
const DesktopClock = ({ formatTime, formatDate }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fnos-taskbar-clock">
      <div className="fnos-taskbar-clock-time">{formatTime(time)}</div>
      <div className="fnos-taskbar-clock-date">{formatDate(time)}</div>
    </div>
  );
};


const DashboardDesktop = () => {
  const navigate = useNavigate();
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [iconPositions, setIconPositions] = useState({});
  const [containerSize, setContainerSize] = useState({ width: window.innerWidth, height: window.innerHeight - 60 });
  const [widgetOpen, setWidgetOpen] = useState(true);
  const [statistics, setStatistics] = useState(null);
  const [maintenanceStats, setMaintenanceStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [draggingIcon, setDraggingIcon] = useState(null);
  const iconWasDraggedRef = useRef(false);
  const [desktopIcons, setDesktopIcons] = useState(new Set(desktopMenuItems.map(item => item.key)));
  const [visibleMenuKeys, setVisibleMenuKeys] = useState([]);
  const [menuPermissionLoaded, setMenuPermissionLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuItems, setSubmenuItems] = useState([]);
  const [submenuPosition, setSubmenuPosition] = useState({ x: 0, y: 0 });
  const [submenuParentItem, setSubmenuParentItem] = useState(null);

  const isAdmin = isAdminRole(currentUser?.role);

  const canSeeMenuItem = (itemKey) => {
    if (isAdmin) return true;
    if (!menuPermissionLoaded) return true;
    if (visibleMenuKeys.length === 0) return true;
    return visibleMenuKeys.includes(itemKey);
  };
  const [contextMenu, setContextMenu] = useState(null);
  const [desktopContextMenu, setDesktopContextMenu] = useState(null);
  const [wallpaperSubmenuOpen, setWallpaperSubmenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ left: false });
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiConversationId, setAiConversationId] = useState(null);
  const [aiChatMaximized, setAiChatMaximized] = useState(false);
  const [aiChatPosition, setAiChatPosition] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [aiChatDragging, setAiChatDragging] = useState(null);
  const [currentWallpaper, setCurrentWallpaper] = useState(() => {
    try {
      const saved = localStorage.getItem(DESKTOP_WALLPAPER_KEY);
      if (saved) return normalizeWallpaper(JSON.parse(saved)) || PRESET_WALLPAPERS[1];
    } catch (_error) {
      return PRESET_WALLPAPERS[1];
    }
    return PRESET_WALLPAPERS[1];
  });
  const [windowTheme, setWindowTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(DESKTOP_THEME_KEY);
      if (saved) return saved;
    } catch (_error) {
      return 'dark';
    }
    return 'dark';
  });
  const iconPositionsRef = useRef({});

  const ICON_WIDTH = 90;
  const ICON_HEIGHT = 100;
  const PADDING = 20;
  const GAP_X = 8;
  const GAP_Y = 8;
  const DESKTOP_ICON_POSITIONS_KEY = 'fnos_desktop_icon_positions_v1';

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DESKTOP_ICON_POSITIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setIconPositions(parsed);
      }
    } catch (e) {
      console.error('加载桌面图标位置失败:', e);
    }
  }, []);

  useEffect(() => {
    iconPositionsRef.current = iconPositions;
  }, [iconPositions]);

  useEffect(() => {
    const loadUserPermissions = async () => {
      try {
        const user = await auth.getUserAsync();
        if (user) {
          setCurrentUser(user);
        }
        const [permResult, prefsResult] = await Promise.allSettled([
          rolesPermissionsAPI.getUserMenus(),
          desktopPrefsAPI.getPreferences(),
        ]);

        if (permResult.status === 'fulfilled' && permResult.value?.success && permResult.value?.data) {
          setVisibleMenuKeys(permResult.value.data);
        }

        if (prefsResult.status === 'fulfilled' && prefsResult.value?.success && prefsResult.value?.data) {
          const { hidden_modules } = prefsResult.value.data;
          if (Array.isArray(hidden_modules) && hidden_modules.length > 0) {
            setDesktopIcons(new Set(desktopMenuItems.map(item => item.key).filter(key => !hidden_modules.includes(key))));
          }
        }
      } catch (error) {
        console.error('加载桌面图标权限失败:', error);
      } finally {
        setMenuPermissionLoaded(true);
      }
    };
    loadUserPermissions();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setContainerSize({ width: window.innerWidth, height: window.innerHeight - 60 });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadDashboardStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [statsRes, maintenanceRes] = await Promise.allSettled([
        assetAPI.getStatistics({}),
        maintenanceAPI.getMaintenanceStatistics({}),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        setStatistics(statsRes.value.data);
      }
      if (maintenanceRes.status === 'fulfilled' && maintenanceRes.value?.success) {
        setMaintenanceStats(maintenanceRes.value.data);
      }
    } catch (error) {
      console.error('加载统计信息失败:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (widgetOpen) {
      loadDashboardStats();
    }
  }, [widgetOpen, loadDashboardStats]);

  const sendAiMessage = useCallback(async () => {
    if (!aiInput.trim() || aiLoading) return;

    const userMessage = { role: 'user', content: aiInput.trim() };
    setAiMessages(prev => [...prev, userMessage]);
    setAiInput('');
    setAiLoading(true);

    const sessionId = aiConversationId || createConversationId('desktop-ai');
    if (!aiConversationId) {
      setAiConversationId(sessionId);
    }

    try {
      const response = await sendOpenClawAssistantMessage({
        messages: [...aiMessages, userMessage],
        sessionId,
      });

      const assistantMessage = { role: 'assistant', content: response.content || '收到回复了' };
      setAiMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI 发送消息失败:', error);
      const errorMessage = { role: 'assistant', content: '抱歉，服务出现异常。' };
      setAiMessages(prev => [...prev, errorMessage]);
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, aiLoading, aiMessages, aiConversationId]);

  const removeFromDesktop = useCallback((iconKey) => {
    setDesktopIcons((prev) => {
      const next = new Set(prev);
      next.delete(iconKey);
      return next;
    });
    setIconPositions((prev) => {
      const next = { ...prev };
      delete next[iconKey];
      return next;
    });
    setContextMenu(null);
    desktopPrefsAPI.hideModule(iconKey).catch(err => {
      console.error('保存隐藏偏好失败:', err);
    });
  }, []);

  const addToDesktop = useCallback((iconKey) => {
    const menuIndex = desktopMenuItems.findIndex(item => item.key === iconKey);
    const ICONS_PER_COL = 6;
    const col = Math.floor(menuIndex / ICONS_PER_COL);
    const row = menuIndex % ICONS_PER_COL;
    const newPos = {
      x: PADDING + col * (ICON_WIDTH + GAP_X),
      y: PADDING + row * (ICON_HEIGHT + GAP_Y),
    };
    setDesktopIcons((prev) => new Set([...prev, iconKey]));
    setIconPositions((prev) => {
      const next = { ...prev, [iconKey]: newPos };
      try {
        localStorage.setItem(DESKTOP_ICON_POSITIONS_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('保存图标位置失败:', e);
      }
      return next;
    });
    setContextMenu(null);
    desktopPrefsAPI.showModule(iconKey).catch(err => {
      console.error('保存显示偏好失败:', err);
    });
  }, []);

  const handleContextMenu = useCallback((e, iconKey) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      iconKey,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const closeDesktopContextMenu = useCallback(() => {
    setDesktopContextMenu(null);
  }, []);

  useEffect(() => {
    if (contextMenu) {
      const handler = () => closeContextMenu();
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  }, [contextMenu, closeContextMenu]);

  useEffect(() => {
    if (desktopContextMenu) {
      const handler = () => closeDesktopContextMenu();
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  }, [desktopContextMenu, closeDesktopContextMenu]);

  const handleDesktopContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 220;
    const submenuWidth = 200;
    const threshold = menuWidth + submenuWidth + 20;
    const openToLeft = e.clientX > window.innerWidth - threshold;
    setContextMenuPosition({ left: openToLeft });
    setDesktopContextMenu({
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  const changeWallpaper = useCallback((wallpaper) => {
    setCurrentWallpaper(wallpaper);
    try {
      localStorage.setItem(DESKTOP_WALLPAPER_KEY, JSON.stringify(wallpaper));
    } catch (e) {
      console.error('保存壁纸失败:', e);
    }
    setDesktopContextMenu(null);
  }, []);

  const changeWindowTheme = useCallback((theme) => {
    setWindowTheme(theme);
    try {
      localStorage.setItem(DESKTOP_THEME_KEY, theme);
    } catch (e) {
      console.error('保存主题失败:', e);
    }
  }, []);

  const resetIconPositions = useCallback(() => {
    setIconPositions({});
    try {
      localStorage.removeItem(DESKTOP_ICON_POSITIONS_KEY);
    } catch (e) {
      console.error('清除图标位置失败:', e);
    }
    setDesktopContextMenu(null);
  }, []);

  const calculateAutoPositions = useCallback(() => {
    const cols = Math.floor((containerSize.width - PADDING * 2) / (ICON_WIDTH + GAP_X));
    const positions = {};
    desktopMenuItems.forEach((item, index) => {
      if (!iconPositions[item.key]) {
        const col = index % cols;
        const row = Math.floor(index / cols);
        positions[item.key] = {
          x: PADDING + col * (ICON_WIDTH + GAP_X),
          y: PADDING + row * (ICON_HEIGHT + GAP_Y),
        };
      }
    });
    return positions;
  }, [containerSize, iconPositions]);

  const handleMouseMove = useCallback((e) => {
    if (draggingIcon) {
      const { key, startX, startY, currentX, currentY } = draggingIcon;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const moved = Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5;
      if (moved) {
        iconWasDraggedRef.current = true;
      }
      if (e.clientX >= 0 && e.clientY >= 0) {
        setIconPositions((prev) => ({
          ...prev,
          [key]: { x: currentX + deltaX, y: currentY + deltaY },
        }));
      }
    }
    if (aiChatDragging && !aiChatMaximized) {
      const { startX, startY, startPosX, startPosY } = aiChatDragging;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      if (e.clientX >= 0 && e.clientY >= 0) {
        setAiChatPosition({ x: startPosX + deltaX, y: startPosY + deltaY });
      }
    }
  }, [draggingIcon, aiChatDragging, aiChatMaximized]);

  const handleMouseUp = useCallback(() => {
    if (draggingIcon) {
      const finalPos = iconPositionsRef.current[draggingIcon.key];
      if (finalPos) {
        try {
          localStorage.setItem(DESKTOP_ICON_POSITIONS_KEY, JSON.stringify(iconPositionsRef.current));
        } catch (e) {
          console.error('保存桌面图标位置失败:', e);
        }
      }
    }
    setDraggingIcon(null);
    setAiChatDragging(null);
  }, [draggingIcon]);

  useEffect(() => {
    if (draggingIcon || aiChatDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingIcon, aiChatDragging, handleMouseMove, handleMouseUp]);

  const startIconDrag = useCallback((iconKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    iconWasDraggedRef.current = false;

    const menuIndex = desktopMenuItems.findIndex(item => item.key === iconKey);
    const ICONS_PER_COL = 6;
    const col = Math.floor(menuIndex / ICONS_PER_COL);
    const row = menuIndex % ICONS_PER_COL;
    const autoPos = {
      x: PADDING + col * (ICON_WIDTH + GAP_X),
      y: PADDING + row * (ICON_HEIGHT + GAP_Y),
    };

    setDraggingIcon({
      key: iconKey,
      startX: e.clientX,
      startY: e.clientY,
      currentX: iconPositions[iconKey]?.x ?? autoPos.x,
      currentY: iconPositions[iconKey]?.y ?? autoPos.y,
    });
  }, [iconPositions]);

  const startAiChatDrag = useCallback((e) => {
    if (aiChatMaximized) return;
    e.preventDefault();
    const chatWidget = e.currentTarget.closest('.fnos-ai-chat-widget');
    const rect = chatWidget ? chatWidget.getBoundingClientRect() : { left: window.innerWidth / 2 - 210, top: window.innerHeight / 2 - 280, width: 420, height: 560 };
    setAiChatDragging({
      startX: e.clientX,
      startY: e.clientY,
      startPosX: aiChatPosition.x || (rect.left + rect.width / 2),
      startPosY: aiChatPosition.y || (rect.top + rect.height / 2),
    });
  }, [aiChatMaximized, aiChatPosition]);

  const openWindow = useCallback((item, parentWindowId = null, event = null) => {
    const menuItems = item.children && item.children.length > 0
      ? item.children
      : item.path
        ? [{ key: `${item.key}-default`, label: item.label, path: item.path }]
        : [];

    if (menuItems.length === 1) {
      const child = menuItems[0];
      const baseUrl = window.location.origin;
      const targetPath = child.path.startsWith('http')
        ? child.path
        : `${baseUrl}${child.path}`;
      const windowFeatures = 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes';
      window.open(targetPath, '_blank', windowFeatures);
    } else if (menuItems.length > 1) {
      const rect = event?.currentTarget?.getBoundingClientRect();
      const x = rect ? rect.left : (event?.clientX || window.innerWidth / 2 - 150);
      const y = rect ? rect.bottom + 5 : (event?.clientY || window.innerHeight / 2 - 100);
      setSubmenuParentItem(item);
      setSubmenuItems(menuItems);
      setSubmenuPosition({ x, y });
      setSubmenuOpen(true);
    }
    
    setStartMenuOpen(false);
  }, []);

  const handleSubmenuClick = useCallback((child) => {
    if (child.path) {
      const baseUrl = window.location.origin;
      const targetPath = child.path.startsWith('http')
        ? child.path
        : `${baseUrl}${child.path}`;
      window.open(targetPath, `_blank`, 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes');
    }
    setSubmenuOpen(false);
  }, []);

  const handleChildClick = useCallback((child) => {
    if (child.path) {
      const baseUrl = window.location.origin;
      const urlWithTheme = child.path.startsWith('http')
        ? child.path
        : `${baseUrl}${child.path}`;
      window.open(urlWithTheme, `assethub-${child.key}`, 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes');
    }
    setStartMenuOpen(false);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  return (
    <div className={`fnos-desktop ${windowTheme === 'light' ? 'theme-light' : 'theme-dark'}`} onContextMenu={handleDesktopContextMenu}>
      <div className="fnos-desktop-bg">
        <div
          className="fnos-desktop-bg-gradient"
          style={currentWallpaper?.url
            ? { backgroundImage: `url(${currentWallpaper.url})` }
            : currentWallpaper?.color
              ? { background: currentWallpaper.color }
              : {}
          }
        />
        <div className="fnos-desktop-bg-grid" />
      </div>

      <div
        className="fnos-desktop-icons"
        style={{ right: widgetOpen ? 320 : 60 }}
      >
        {desktopMenuItems
          .filter(item => desktopIcons.has(item.key) && canSeeMenuItem(item.key))
          .map((item, index) => {
            const menuIndex = desktopMenuItems.findIndex(m => m.key === item.key);
            const ICONS_PER_COL = 6;
            const col = Math.floor(menuIndex / ICONS_PER_COL);
            const row = menuIndex % ICONS_PER_COL;
            const autoPos = {
              x: PADDING + col * (ICON_WIDTH + GAP_X),
              y: PADDING + row * (ICON_HEIGHT + GAP_Y),
            };
            const pos = iconPositions[item.key] || autoPos;
            return (
              <div
                key={item.key}
                className="fnos-desktop-icon"
                onClick={(e) => {
                  if (!iconWasDraggedRef.current) {
                    openWindow(item, null, e);
                  }
                }}
                onMouseDown={(e) => startIconDrag(item.key, e)}
                onContextMenu={(e) => handleContextMenu(e, item.key)}
                style={{
                  animationDelay: `${index * 0.05}s`,
                  left: pos.x,
                  top: pos.y,
                }}
              >
              <div className="fnos-desktop-icon-wrapper" style={{ backgroundColor: `${item.color}18` }}>
                <div className="fnos-desktop-icon-inner" style={{ backgroundColor: `${item.color}15` }}>
                  <div className="fnos-desktop-icon-element" style={{ color: item.color }}>
                    {item.icon}
                  </div>
                </div>
              </div>
              <span className="fnos-desktop-icon-label">{item.label}</span>
            </div>
          );
        })}
      </div>

      {!widgetOpen && (
        <button
          className="fnos-widget-expand-btn"
          onClick={() => setWidgetOpen(true)}
          title="展开企业总览"
        >
          <LeftOutlined />
        </button>
      )}

      <div className={`fnos-desktop-widget ${widgetOpen ? 'open' : 'collapsed'}`}>
        <div className="fnos-widget-header" onClick={() => setWidgetOpen(!widgetOpen)}>
          <div className="fnos-widget-title">
            <DashboardOutlined />
            <span>企业总览</span>
          </div>
          <div className="fnos-widget-actions">
            <button
              className="fnos-widget-btn"
              onClick={(e) => { e.stopPropagation(); loadDashboardStats(); }}
            >
              <ReloadOutlined spin={statsLoading} />
            </button>
            <button className="fnos-widget-btn">
              {widgetOpen ? <RightOutlined /> : <LeftOutlined />}
            </button>
          </div>
        </div>
        {widgetOpen && (
          <div className="fnos-widget-content">
            {statsLoading ? (
              <div className="fnos-widget-loading">
                <Spin size="small" />
                <span>加载中...</span>
              </div>
            ) : (
              <>
                <div className="fnos-widget-section">
                  <div className="fnos-widget-section-title">资产统计</div>
                  <div className="fnos-widget-stats">
                    <div className="fnos-widget-stat">
                      <div className="fnos-widget-stat-value" style={{ color: '#0a84ff' }}>
                        {statistics?.total_count ?? statistics?.total ?? statistics?.overview?.total_count ?? 0}
                      </div>
                      <div className="fnos-widget-stat-label">资产总数</div>
                    </div>
                    <div className="fnos-widget-stat">
                      <div className="fnos-widget-stat-value" style={{ color: '#22c55e' }}>
                        {statistics?.in_use_count ?? statistics?.inUse ?? statistics?.overview?.in_use_count ?? 0}
                      </div>
                      <div className="fnos-widget-stat-label">在用</div>
                    </div>
                    <div className="fnos-widget-stat">
                      <div className="fnos-widget-stat-value" style={{ color: '#f59e0b' }}>
                        {statistics?.idle_count ?? statistics?.idle ?? statistics?.overview?.idle_count ?? 0}
                      </div>
                      <div className="fnos-widget-stat-label">闲置</div>
                    </div>
                    <div className="fnos-widget-stat">
                      <div className="fnos-widget-stat-value" style={{ color: '#ef4444' }}>
                        {statistics?.repair_count ?? statistics?.maintenance ?? statistics?.overview?.repair_count ?? 0}
                      </div>
                      <div className="fnos-widget-stat-label">维修中</div>
                    </div>
                  </div>
                </div>

                <div className="fnos-widget-section">
                  <div className="fnos-widget-section-title">资产总值</div>
                  <div className="fnos-widget-value">
                    {(() => {
                      const value = Number(statistics?.total_value ?? statistics?.value_summary?.total_purchase_value ?? 0);
                      if (value >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
                      if (value >= 10000) return `${(value / 10000).toFixed(2)}万`;
                      return value.toLocaleString();
                    })()}
                    <span className="fnos-widget-value-unit">元</span>
                  </div>
                </div>

                <div className="fnos-widget-section">
                  <div className="fnos-widget-section-title">维护统计</div>
                  <div className="fnos-widget-stats">
                    <div className="fnos-widget-stat">
                      <div className="fnos-widget-stat-value" style={{ color: '#5e5ce6' }}>
                        {maintenanceStats?.total_count ?? 0}
                      </div>
                      <div className="fnos-widget-stat-label">总工单</div>
                    </div>
                    <div className="fnos-widget-stat">
                      <div className="fnos-widget-stat-value" style={{ color: '#f59e0b' }}>
                        {maintenanceStats?.in_progress_count ?? 0}
                      </div>
                      <div className="fnos-widget-stat-label">进行中</div>
                    </div>
                    <div className="fnos-widget-stat">
                      <div className="fnos-widget-stat-value" style={{ color: '#22c55e' }}>
                        {maintenanceStats?.completed_count ?? 0}
                      </div>
                      <div className="fnos-widget-stat-label">已完成</div>
                    </div>
                  </div>
                </div>

                <div className="fnos-widget-section">
                  <div className="fnos-widget-section-title">本月维修费用</div>
                  <div className="fnos-widget-value">
                    {(() => {
                      const value = Number(maintenanceStats?.total_cost ?? 0);
                      if (value >= 10000) return `${(value / 10000).toFixed(2)}`;
                      return value.toFixed(2);
                    })()}
                    <span className="fnos-widget-value-unit">{Number(maintenanceStats?.total_cost ?? 0) >= 10000 ? '万' : '元'}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {!aiChatOpen && (
        <button
          className="fnos-ai-chat-mini"
          onClick={() => setAiChatOpen(true)}
          title="AI 资产助手"
          aria-label="打开 AI 资产助手"
        >
          <RobotOutlined />
        </button>
      )}

      {aiChatOpen && (
        <div
          className={`fnos-ai-chat-widget ${aiChatMaximized ? 'maximized' : ''}`}
          style={
            aiChatMaximized
              ? undefined
              : {
                  left: aiChatPosition.x,
                  top: aiChatPosition.y,
                  transform: 'translate(-50%, -50%)',
                }
          }
        >
          <div
            className="fnos-ai-chat-header"
            onMouseDown={startAiChatDrag}
          >
            <div className="fnos-ai-chat-title">
              <RobotOutlined />
              <span>AI 助手</span>
            </div>
            <div className="fnos-ai-chat-controls">
              <button
                className="fnos-ai-chat-control"
                onClick={() => setAiChatMaximized(!aiChatMaximized)}
              >
                {aiChatMaximized ? <CompressOutlined /> : <ExpandOutlined />}
              </button>
              <button
                className="fnos-ai-chat-control close"
                onClick={() => {
                  setAiChatOpen(false);
                  setAiChatMaximized(false);
                }}
              >
                <CloseOutlined />
              </button>
            </div>
          </div>
          <div className="fnos-ai-chat-messages">
            {aiMessages.length === 0 && (
              <div className="fnos-ai-chat-empty">
                <RobotOutlined style={{ fontSize: 40, color: '#0a84ff', marginBottom: 12 }} />
                <p>您好，我是 AI 助手</p>
                <p>有什么可以帮助您的吗？</p>
              </div>
            )}
            {aiMessages.map((msg, index) => (
              <div
                key={index}
                className={`fnos-ai-chat-message ${msg.role === 'user' ? 'user' : 'assistant'}`}
              >
                <div className="fnos-ai-chat-message-icon">
                  {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                </div>
                <div className="fnos-ai-chat-message-content">
                  {msg.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="fnos-ai-chat-message assistant">
                <div className="fnos-ai-chat-message-icon">
                  <RobotOutlined />
                </div>
                <div className="fnos-ai-chat-message-content">
                  <span className="fnos-ai-chat-typing">思考中...</span>
                </div>
              </div>
            )}
          </div>
          <div className="fnos-ai-chat-input-area">
            <input
              type="text"
              className="fnos-ai-chat-input"
              placeholder="输入问题..."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); } }}
            />
            <button
              className="fnos-ai-chat-send"
              onClick={sendAiMessage}
              disabled={!aiInput.trim() || aiLoading}
            >
              <SendOutlined />
            </button>
          </div>
        </div>
      )}

      <div className="fnos-taskbar">
        <div className="fnos-taskbar-left">
          <button
            className={`fnos-taskbar-start ${startMenuOpen ? 'active' : ''}`}
            onClick={() => setStartMenuOpen(!startMenuOpen)}
          >
            <div className="fnos-taskbar-start-icon">
              <DatabaseOutlined />
            </div>
            <span>开始</span>
          </button>
        </div>

        <div className="fnos-taskbar-windows">
          <span className="fnos-taskbar-hint">点击桌面图标打开独立窗口</span>
        </div>

        <div className="fnos-taskbar-right">
          <div className="fnos-taskbar-tray">
            <button className="fnos-taskbar-tray-item">
              <WifiOutlined />
            </button>
            <button className="fnos-taskbar-tray-item">
              <SoundOutlined />
            </button>
            <button className="fnos-taskbar-tray-item">
              <BellOutlined />
            </button>
          </div>
          <DesktopClock formatTime={formatTime} formatDate={formatDate} />
        </div>
      </div>

      {startMenuOpen && (
        <div className="fnos-start-menu">
          <div className="fnos-start-menu-header">
            <div className="fnos-start-menu-logo">
              <DatabaseOutlined />
            </div>
            <div className="fnos-start-menu-title">AssetHost</div>
          </div>
          <div className="fnos-start-menu-apps">
            {desktopMenuItems
              .filter(item => canSeeMenuItem(item.key))
              .map((item) => {
                const isOnDesktop = desktopIcons.has(item.key);
                return (
                  <div
                    key={item.key}
                    className={`fnos-start-menu-app ${!isOnDesktop ? 'not-on-desktop' : ''}`}
                  >
                    <button
                      className="fnos-start-menu-app-main"
                      onClick={(e) => {
                        if (isOnDesktop) {
                          openWindow(item, null, e);
                        } else {
                          addToDesktop(item.key);
                        }
                      }}
                    >
                      <div className="fnos-start-menu-app-icon" style={{ color: item.color }}>
                        {item.icon}
                        {!isOnDesktop && (
                          <span className="fnos-start-menu-app-plus">+</span>
                        )}
                      </div>
                      <span>{item.label}</span>
                    </button>
                    <div
                      className="fnos-start-menu-app-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isOnDesktop) {
                          removeFromDesktop(item.key);
                        } else {
                          addToDesktop(item.key);
                        }
                      }}
                      title={isOnDesktop ? '隐藏图标' : '显示图标'}
                    >
                      {isOnDesktop ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="fnos-start-menu-footer">
            <div className="fnos-start-menu-theme">
              <MoonOutlined className={windowTheme === 'dark' ? 'active' : ''} />
              <Switch
                size="small"
                checked={windowTheme === 'light'}
                onChange={(checked) => changeWindowTheme(checked ? 'light' : 'dark')}
                checkedChildren="浅"
                unCheckedChildren="深"
              />
              <SunOutlined className={windowTheme === 'light' ? 'active' : ''} />
            </div>
            {(() => {
              const systemMenu = desktopMenuItems.find(item => item.key === 'system');
              if (!systemMenu) return null;
              return (
                <button
                  className="fnos-start-menu-action"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const submenuItems = systemMenu.children || [];
                    const submenuItemHeight = 36;
                    const submenuHeaderHeight = 36;
                    const submenuHeight = submenuItems.length * submenuItemHeight + submenuHeaderHeight + 20;
                    const gap = 8;
                    
                    let y = rect.top - 5;
                    if (y + submenuHeight > window.innerHeight - 20) {
                      y = window.innerHeight - submenuHeight - 20;
                    }
                    if (y < 20) y = 20;
                    
                    setSubmenuParentItem(systemMenu);
                    setSubmenuItems(submenuItems);
                    setSubmenuPosition({ x: rect.left, y });
                    setSubmenuOpen(true);
                    setStartMenuOpen(false);
                  }}
                >
                  <SettingOutlined />
                  <span>系统管理</span>
                </button>
              );
            })()}
            <button
              className="fnos-start-menu-action"
              onClick={() => {
                auth.clearOpenClawCredentials?.();
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('selectedEnterprise');
                window.location.href = '/login';
              }}
            >
              <LockOutlined />
              <span>锁定</span>
            </button>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="fnos-context-menu"
          style={{ left: typeof contextMenu.x === 'number' ? contextMenu.x : 0, top: typeof contextMenu.y === 'number' ? contextMenu.y : 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="fnos-context-menu-item danger"
            onClick={() => removeFromDesktop(contextMenu.iconKey)}
          >
            <CloseOutlined />
            <span>隐藏图标</span>
          </button>
          <button
            className="fnos-context-menu-item"
            onClick={() => {
              const allKeys = desktopMenuItems.map(item => item.key);
              setDesktopIcons(new Set(allKeys));
              desktopPrefsAPI.savePreferences({ hidden_modules: [] }).catch(() => {});
              setContextMenu(null);
            }}
          >
            <AppstoreAddOutlined />
            <span>显示所有图标</span>
          </button>
        </div>
      )}

      {desktopContextMenu && (
        <div
          className="fnos-desktop-context-menu"
          style={{ left: typeof desktopContextMenu.x === 'number' ? desktopContextMenu.x : 0, top: typeof desktopContextMenu.y === 'number' ? desktopContextMenu.y : 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="fnos-desktop-context-menu-item" onClick={() => { setStartMenuOpen(true); setDesktopContextMenu(null); }}>
            <AppstoreAddOutlined />
            <span>桌面图标设置</span>
          </div>
          <div className="fnos-desktop-context-menu-item" onClick={() => { loadDashboardStats(); setDesktopContextMenu(null); }}>
            <ReloadOutlined />
            <span>刷新</span>
          </div>
          <div className="fnos-desktop-context-menu-submenu">
            <div className="fnos-desktop-context-menu-item has-submenu" onMouseEnter={() => setWallpaperSubmenuOpen(true)} onMouseLeave={() => setWallpaperSubmenuOpen(false)}>
              <PictureOutlined />
              <span>更换壁纸</span>
              <RightOutlined className="submenu-arrow" />
            </div>
            <div className={`fnos-desktop-context-menu-submenu-items ${contextMenuPosition.left ? 'submenu-left' : ''} ${wallpaperSubmenuOpen ? 'show' : ''}`}>
              {PRESET_WALLPAPERS.map((wp) => (
                <div
                  key={wp.id}
                  className={`fnos-desktop-context-menu-item ${currentWallpaper?.id === wp.id ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); changeWallpaper(wp); }}
                >
                  <div
                    className="fnos-desktop-context-menu-wallpaper"
                    style={wp.url
                      ? { backgroundImage: `url(${wp.url})` }
                      : { background: wp.color }}
                  />
                  <span>{wp.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="fnos-desktop-context-menu-divider" />
          <div className="fnos-desktop-context-menu-item" onClick={resetIconPositions}>
            <ReloadOutlined />
            <span>重置图标位置</span>
          </div>
          <div className="fnos-desktop-context-menu-item" onClick={() => { setDesktopContextMenu(null); }}>
            <LockOutlined />
            <span>锁定</span>
          </div>
        </div>
      )}

      <div className="fnos-desktop-overlay" onClick={() => setStartMenuOpen(false)} />

      {submenuOpen && (
        <div
          className="fnos-submenu-overlay"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
          onClick={() => setSubmenuOpen(false)}
        >
          <div
            className="fnos-submenu-popup"
            style={{
              position: 'fixed',
              left: submenuPosition.x,
              top: submenuPosition.y,
              zIndex: 10000,
              background: 'rgba(30, 41, 59, 0.95)',
              backdropFilter: 'blur(20px)',
              borderRadius: '12px',
              padding: '8px',
              minWidth: '200px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '6px 12px', fontSize: '12px', color: '#94a3b8', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px', paddingBottom: '6px' }}>
              {submenuParentItem?.label}
            </div>
            {submenuItems.map((child) => (
              <div
                key={child.key}
                className="fnos-submenu-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  color: '#e2e8f0',
                  fontSize: '14px',
                }}
                onClick={() => handleSubmenuClick(child)}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {child.icon || <AppstoreOutlined style={{ color: '#60a5fa' }} />}
                <span>{child.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardDesktop;
