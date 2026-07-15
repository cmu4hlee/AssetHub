/**
 * 智能预警 + 站内消息通知组件
 *
 * 数据源：
 *   1. intelligentAlertAPI —— 系统级智能预警（保养到期/资质到期/检验到期等）
 *   2. inAppNotificationAPI —— 业务事件站内消息（与飞书通知并列、来自 WebSocket + 落库）
 *   3. WebSocket 'app:notification' 事件 —— 业务事件实时推送（前端收到后入本地列表 + 调 API 持久化）
 *   4. WebSocket 'maintenance:notification' 事件 —— 维修审批实时推送（兼容老接口）
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Badge, Dropdown, List, Tag, Typography, Empty, Button, Spin,
  Tooltip, Tabs, Space, message as antMessage,
} from 'antd';
import {
  BellOutlined, ToolOutlined, SafetyOutlined,
  SolutionOutlined, FileSearchOutlined, WarningOutlined,
  SettingOutlined, RocketOutlined, ReloadOutlined,
  DeleteOutlined, CheckOutlined, BellFilled, ClockCircleOutlined, NotificationOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { intelligentAlertAPI, inAppNotificationAPI, notificationPreferenceAPI } from '../utils/api';
import socket from '../utils/socket';
import auth from '../utils/auth';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

/* ===================== 分类图标与配色 ===================== */
const CATEGORY_META = {
  maintenance: { icon: <ToolOutlined style={{ color: '#1890ff' }} />, name: '维修' },
  scrapping: { icon: <WarningOutlined style={{ color: '#ff7a45' }} />, name: '报废' },
  transfer: { icon: <RocketOutlined style={{ color: '#722ed1' }} />, name: '调配' },
  asset: { icon: <FileSearchOutlined style={{ color: '#13c2c2' }} />, name: '资产' },
  asset_usage: { icon: <ToolOutlined style={{ color: '#52c41a' }} />, name: '领用' },
  inventory: { icon: <FileSearchOutlined style={{ color: '#fa8c16' }} />, name: '盘点' },
  tendering: { icon: <FileSearchOutlined style={{ color: '#2f54eb' }} />, name: '招标' },
  finance: { icon: <FileSearchOutlined style={{ color: '#eb2f96' }} />, name: '财务' },
  acceptance: { icon: <SafetyOutlined style={{ color: '#52c41a' }} />, name: '验收' },
  user: { icon: <SolutionOutlined style={{ color: '#722ed1' }} />, name: '用户' },
  system: { icon: <BellOutlined style={{ color: '#1890ff' }} />, name: '系统' },
};

const URGENCY_META = {
  high: { color: 'error', text: '紧急' },
  medium: { color: 'warning', text: '重要' },
  low: { color: 'default', text: '一般' },
};

const AlertNotification = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [overview, setOverview] = useState({
    total: 0,
    maintenance: { total: 0, urgent: 0 },
    qualification: { total: 0, urgent: 0 },
    inspection: { total: 0, urgent: 0 },
    safety: { total: 0, urgent: 0 },
    uptime: { total: 0, urgent: 0 },
  });
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('app');

  // 站内消息（来自后端 inAppNotificationAPI + WebSocket 实时增量）
  const [appNotifs, setAppNotifs] = useState([]);
  const [appNotifUnread, setAppNotifUnread] = useState(0);
  const [appNotifLoading, setAppNotifLoading] = useState(false);
  const appNotifRef = useRef([]);

  // 勿扰模式状态：null=无偏好 / { inDnd: bool, pref: object }
  const [dndState, setDndState] = useState(null);
  const [dndTick, setDndTick] = useState(0); // 强制每分钟重算

  // 兼容老接口：维修审批实时推送（仅前端在内存中展示）
  const [pushNotifications, setPushNotifications] = useState([]);
  const pushNotifRef = useRef([]);

  /* ===================== 智能预警数据 ===================== */

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const [overviewRes, alertsRes] = await Promise.all([
        intelligentAlertAPI.getOverview(),
        intelligentAlertAPI.getAlerts({ pageSize: 50 }),
      ]);
      if (overviewRes?.success) setOverview(overviewRes.data);
      if (alertsRes?.success) setAlerts(alertsRes.data || []);
    } catch (error) {
      console.error('获取预警数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchAlerts]);

  /* ===================== 站内消息：拉取历史 + 未读数 ===================== */

  const fetchAppNotifs = useCallback(async () => {
    try {
      setAppNotifLoading(true);
      const [listRes, countRes] = await Promise.all([
        inAppNotificationAPI.list({ pageSize: 30 }),
        inAppNotificationAPI.unreadCount(),
      ]);
      if (listRes?.success) {
        const list = listRes.data?.list || [];
        appNotifRef.current = list;
        setAppNotifs(list);
      }
      if (countRes?.success) {
        setAppNotifUnread(countRes.data?.unread || 0);
      }
    } catch (error) {
      console.error('获取站内消息失败:', error);
    } finally {
      setAppNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppNotifs();
  }, [fetchAppNotifs]);

  /* ===================== 勿扰状态查询 + 实时计算 ===================== */

  // 拉取用户全局偏好（轻量，不依赖数据刷新）
  const fetchDndPref = useCallback(async () => {
    try {
      const r = await notificationPreferenceAPI.getEffective(null);
      if (r?.success) setDndState(r.data.preferences || null);
    } catch (_e) { /* ignore */ }
  }, []);

  useEffect(() => { fetchDndPref(); }, [fetchDndPref]);

  // 每分钟重新计算 dndTick，驱动 DND in/out 状态自动切换
  useEffect(() => {
    const t = setInterval(() => setDndTick(v => v + 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // 计算当前是否处于 DND
  const isInDndNow = useMemo(() => {
    if (!dndState || !dndState.dndEnabled) return false;
    if (!dndState.dndStartTime || !dndState.dndEndTime) return false;
    const now = new Date();
    const day = now.getDay() === 0 ? 7 : now.getDay();
    const dndDays = (dndState.dndDays || '1,2,3,4,5,6,7').split(',').map(s => s.trim());
    if (!dndDays.includes(String(day))) return false;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = (dndState.dndStartTime || '').split(':').map(Number);
    const [eh, em] = (dndState.dndEndTime || '').split(':').map(Number);
    if (isNaN(sh) || isNaN(eh)) return false;
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return start <= end
      ? (nowMin >= start && nowMin < end)
      : (nowMin >= start || nowMin < end);
    // 依赖 dndTick 触发每分钟重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dndState, dndTick]);

  // DND 时间窗口（格式化显示用）
  const dndWindowLabel = useMemo(() => {
    if (!dndState || !dndState.dndEnabled) return '';
    const start = (dndState.dndStartTime || '').slice(0, 5);
    const end = (dndState.dndEndTime || '').slice(0, 5);
    return `${start} - ${end}`;
  }, [dndState]);

  /* ===================== WebSocket 实时推送 ===================== */

  useEffect(() => {
    const user = auth.getUser();
    if (!user) return undefined;

    socket.connect();

    // 1. 通用业务事件站内消息（in-app-notification.service 推送）
    const unsubApp = socket.on('app:notification', data => {
      console.log('[Socket] 收到 app:notification:', data);

      // 插入到列表头部（不重复插入：按 id 或临时 key 去重）
      const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newNotif = {
        id: tempId,
        event_code: data.eventCode,
        category: data.category || 'system',
        title: data.title,
        content: data.content,
        urgency: data.urgency || 'medium',
        action_url: data.actionUrl,
        action_text: data.actionText || '查看详情',
        is_read: false,
        created_at: data.timestamp || new Date().toISOString(),
        _fromSocket: true,
      };
      appNotifRef.current = [newNotif, ...appNotifRef.current].slice(0, 50);
      setAppNotifs(appNotifRef.current);
      setAppNotifUnread(c => c + 1);

      // 桌面通知
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(data.title || '系统通知', {
            body: data.content || '',
            icon: '/favicon.ico',
          });
        } catch (_e) { /* 忽略权限/浏览器限制 */ }
      }

      // 顶部轻提示
      antMessage.info({
        content: data.title || '您有一条新通知',
        duration: 3,
      });
    });

    // 2. 兼容老的维修审批推送通道
    const unsubMaintenance = socket.on('maintenance:notification', data => {
      console.log('[Socket] 收到 maintenance:notification:', data);
      const notif = {
        id: `push_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'maintenance_approved',
        title: data.title || '新维修工单待处理',
        content: `工单 ${data.workOrderNo} · 资产 ${data.assetCode}(${data.assetName || ''}) · ${data.faultDescription || ''}`,
        workOrderNo: data.workOrderNo,
        assetCode: data.assetCode,
        approver: data.approver,
        timestamp: data.timestamp || new Date().toISOString(),
        actionUrl: data.actionUrl || '/maintenance/workorders',
        isRead: false,
        urgency: data.faultLevel === '紧急' ? 'high' : 'medium',
      };
      pushNotifRef.current = [notif, ...pushNotifRef.current].slice(0, 20);
      setPushNotifications(pushNotifRef.current);

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('新维修工单', { body: notif.content, icon: '/favicon.ico' });
        } catch (_e) { /* ignore */ }
      }
    });

    return () => {
      unsubApp();
      unsubMaintenance();
    };
  }, []);

  // 浏览器通知权限
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  /* ===================== 操作方法 ===================== */

  const handleAppNotifClick = async notif => {
    // 1. 乐观更新
    if (!notif.is_read) {
      appNotifRef.current = appNotifRef.current.map(n =>
        n.id === notif.id ? { ...n, is_read: true } : n,
      );
      setAppNotifs(appNotifRef.current);
      setAppNotifUnread(c => Math.max(0, c - 1));
    }
    // 2. 服务端标记（_fromSocket 临时 id 不调 API，等下次 list 拉取自然覆盖）
    if (notif.id && !String(notif.id).startsWith('tmp_')) {
      inAppNotificationAPI.markAsRead(notif.id).catch(e => console.warn('markAsRead failed', e));
    }
    // 3. 跳转
    setVisible(false);
    if (notif.action_url) navigate(notif.action_url);
  };

  const handleMarkAllAppAsRead = async () => {
    try {
      await inAppNotificationAPI.markAllAsRead();
      appNotifRef.current = appNotifRef.current.map(n => ({ ...n, is_read: true }));
      setAppNotifs(appNotifRef.current);
      setAppNotifUnread(0);
      antMessage.success('已全部标记为已读');
    } catch (e) {
      antMessage.error('操作失败');
    }
  };

  const handleClearReadApp = async () => {
    try {
      await inAppNotificationAPI.clearRead();
      appNotifRef.current = appNotifRef.current.filter(n => !n.is_read);
      setAppNotifs(appNotifRef.current);
      antMessage.success('已读消息已清空');
    } catch (e) {
      antMessage.error('清空失败');
    }
  };

  const handleDeleteApp = async (e, notif) => {
    e.stopPropagation();
    if (!notif.id || String(notif.id).startsWith('tmp_')) {
      // 临时推送消息，乐观删除即可
      appNotifRef.current = appNotifRef.current.filter(n => n.id !== notif.id);
      setAppNotifs(appNotifRef.current);
      return;
    }
    try {
      await inAppNotificationAPI.remove(notif.id);
      appNotifRef.current = appNotifRef.current.filter(n => n.id !== notif.id);
      setAppNotifs(appNotifRef.current);
      if (!notif.is_read) setAppNotifUnread(c => Math.max(0, c - 1));
    } catch (e) {
      antMessage.error('删除失败');
    }
  };

  const getPushUnreadCount = () => pushNotifications.filter(n => !n.isRead).length;
  const markAllPushAsRead = () => {
    pushNotifRef.current = pushNotifRef.current.map(n => ({ ...n, isRead: true }));
    setPushNotifications(pushNotifRef.current);
  };
  const markPushAsRead = notifId => {
    pushNotifRef.current = pushNotifRef.current.map(n =>
      n.id === notifId ? { ...n, isRead: true } : n,
    );
    setPushNotifications(pushNotifRef.current);
  };

  const handlePushClick = notif => {
    markPushAsRead(notif.id);
    setVisible(false);
    if (notif.actionUrl) navigate(notif.actionUrl);
  };

  /* ===================== 数量统计 ===================== */

  const getUrgentAlertCount = () =>
    alerts.filter(a => a.urgency === 'high' && !a.is_read).length;

  const getBadgeCount = () => appNotifUnread + getPushUnreadCount() + getUrgentAlertCount();

  const getFilteredAlerts = () => {
    if (activeTab === 'urgent') return alerts.filter(a => a.urgency === 'high');
    if (activeTab === 'maintenance_due') return alerts.filter(a => a.type === 'maintenance_due');
    if (activeTab === 'qualification_expire') return alerts.filter(a => a.type === 'qualification_expire');
    return alerts;
  };

  const getAlertTypeIcon = type => {
    const icons = {
      maintenance_due: <ToolOutlined style={{ color: '#1890ff' }} />,
      qualification_expire: <SolutionOutlined style={{ color: '#722ed1' }} />,
      inspection_due: <FileSearchOutlined style={{ color: '#fa8c16' }} />,
      safety_expire: <SafetyOutlined style={{ color: '#52c41a' }} />,
      uptime_low: <WarningOutlined style={{ color: '#f5222d' }} />,
    };
    return icons[type] || <WarningOutlined />;
  };

  const getAlertTypeName = type => ({
    maintenance_due: '保养到期',
    qualification_expire: '资质到期',
    inspection_due: '检验到期',
    safety_expire: '安全检测',
    uptime_low: '开机率异常',
  }[type] || type);

  const getUrgencyTag = urgency => {
    const meta = URGENCY_META[urgency] || URGENCY_META.low;
    return <Tag color={meta.color} size="small">{meta.text}</Tag>;
  };

  /* ===================== 渲染 ===================== */

  const alertListContent = (
    <div style={{ width: 460, maxHeight: 560, overflow: 'auto' }}>
      {/* DND 状态条 / 未读数概览 */}
      <div
        onClick={() => { setVisible(false); navigate('/notification-preferences'); }}
        style={{
          padding: '8px 16px', background: isInDndNow ? '#fff7e6' : '#fafafa',
          borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <Space size={6}>
          {isInDndNow
            ? <Tag color="orange" icon={<ClockCircleOutlined />}>勿扰中</Tag>
            : dndState?.dndEnabled
              ? <Tag color="default" icon={<BellFilled />}>勿扰已设置</Tag>
              : <Tag color="default" icon={<NotificationOutlined />}>通知正常</Tag>
          }
          {isInDndNow && dndWindowLabel && (
            <Text type="secondary" style={{ fontSize: 12 }}>{dndWindowLabel}</Text>
          )}
        </Space>
        <Space size={4}>
          {appNotifUnread > 0 && (
            <Badge count={appNotifUnread} size="small" style={{ backgroundColor: '#d97757' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>站内未读</Text>
            </Badge>
          )}
          <Text type="secondary" style={{ fontSize: 11 }}>设置 ›</Text>
        </Space>
      </div>

      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #f0f0f0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Text strong>通知中心</Text>
        <Space size={8}>
          <Tooltip title="刷新">
            <Button
              type="text" size="small" icon={<ReloadOutlined />}
              onClick={() => { fetchAlerts(); fetchAppNotifs(); }}
            />
          </Tooltip>
          {activeTab === 'app' && appNotifUnread > 0 && (
            <Tooltip title="全部标记已读">
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={handleMarkAllAppAsRead}>
                全部已读
              </Button>
            </Tooltip>
          )}
          <Button
            type="link" size="small" icon={<SettingOutlined />}
            onClick={() => { setVisible(false); navigate('/alert-settings'); }}
          >
            设置
          </Button>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="small"
        style={{ margin: '0 16px' }}
        items={[
          {
            key: 'app',
            label: (
              <Badge count={appNotifUnread} size="small" offset={[5, 0]} style={{ backgroundColor: '#d97757' }}>
                站内消息
              </Badge>
            ),
          },
          {
            key: 'push',
            label: (
              <Badge count={getPushUnreadCount()} size="small" offset={[5, 0]} style={{ backgroundColor: '#fa8c16' }}>
                维修推送
              </Badge>
            ),
          },
          {
            key: 'urgent',
            label: (
              <Badge count={getUrgentAlertCount()} size="small" offset={[5, 0]} style={{ backgroundColor: '#ff4d4f' }}>
                紧急预警
              </Badge>
            ),
          },
          { key: 'maintenance_due', label: '保养' },
          { key: 'qualification_expire', label: '资质' },
        ]}
      />

      {/* 站内消息 Tab */}
      {activeTab === 'app' && (
        <>
          {appNotifLoading && appNotifs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
          ) : appNotifs.length === 0 ? (
            <Empty description="暂无站内消息" style={{ padding: 40 }} />
          ) : (
            <List
              dataSource={appNotifs.slice(0, 20)}
              renderItem={item => {
                const meta = CATEGORY_META[item.category] || CATEGORY_META.system;
                return (
                  <List.Item
                    style={{
                      padding: '12px 16px', cursor: 'pointer',
                      backgroundColor: item.is_read ? '#fafafa' : '#fff7f3',
                      borderLeft: `3px solid ${item.urgency === 'high' ? '#ff4d4f' : (item.urgency === 'medium' ? '#faad14' : '#d9d9d9')}`,
                      // 已读未读通过 backgroundColor 区分, 不再降透明度 (影响查看)
                    }}
                    onClick={() => handleAppNotifClick(item)}
                    actions={[
                      <Button
                        key="del" type="text" size="small" danger icon={<DeleteOutlined />}
                        onClick={e => handleDeleteApp(e, item)}
                      />,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={meta.icon}
                      title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                          <Space size={4}>
                            <Tag color="blue" size="small">{meta.name}</Tag>
                            {item.urgency && getUrgencyTag(item.urgency)}
                          </Space>
                        </div>
                      }
                      description={
                        <div>
                          {item.content && (
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                              {item.content}
                            </Text>
                          )}
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {dayjs(item.created_at).fromNow()}
                            {item._fromSocket && <Tag color="cyan" size="small" style={{ marginLeft: 6 }}>实时</Tag>}
                          </Text>
                        </div>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}
          {appNotifs.some(n => n.is_read) && (
            <div style={{ padding: '8px 16px', textAlign: 'center', borderTop: '1px solid #f0f0f0' }}>
              <Button type="link" size="small" onClick={handleClearReadApp}>
                清空已读消息
              </Button>
            </div>
          )}
        </>
      )}

      {/* 维修推送 Tab（兼容老接口） */}
      {activeTab === 'push' && (
        pushNotifications.length === 0 ? (
          <Empty description="暂无实时推送通知" style={{ padding: 40 }} />
        ) : (
          <List
            dataSource={pushNotifications.slice(0, 15)}
            renderItem={item => (
              <List.Item
                style={{
                  padding: '12px 16px', cursor: 'pointer',
                  backgroundColor: item.isRead ? '#fafafa' : '#fff7f3',
                  borderLeft: `3px solid ${item.urgency === 'high' ? '#ff4d4f' : '#d97757'}`,
                  // 已读未读通过 backgroundColor 区分, 不再降透明度
                }}
                onClick={() => handlePushClick(item)}
              >
                <List.Item.Meta
                  avatar={<RocketOutlined style={{ color: '#d97757' }} />}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                      {getUrgencyTag(item.urgency)}
                    </div>
                  }
                  description={
                    <div>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                        {item.content}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        <RocketOutlined /> 实时推送 · {dayjs(item.timestamp).fromNow()}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )
      )}

      {/* 智能预警 Tab */}
      {!['app', 'push'].includes(activeTab) && (
        loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        ) : getFilteredAlerts().length === 0 ? (
          <Empty description="暂无预警通知" style={{ padding: 40 }} />
        ) : (
          <List
            dataSource={getFilteredAlerts().slice(0, 10)}
            renderItem={item => (
              <List.Item
                style={{
                  padding: '12px 16px', cursor: 'pointer',
                  backgroundColor: item.is_read ? '#fafafa' : (item.urgency === 'high' ? '#fff2f0' : 'transparent'),
                  borderLeft: `3px solid ${item.urgency === 'high' ? '#ff4d4f' : (item.urgency === 'medium' ? '#faad14' : '#d9d9d9')}`,
                  // 已读未读通过 backgroundColor 区分, 不再降透明度
                }}
                onClick={() => {
                  setVisible(false);
                  if (item.actionUrl) navigate(item.actionUrl);
                }}
              >
                <List.Item.Meta
                  avatar={getAlertTypeIcon(item.type)}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                      {getUrgencyTag(item.urgency)}
                    </div>
                  }
                  description={
                    <div>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                        {item.content}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {getAlertTypeName(item.type)} · {dayjs(item.read_at || item.created_at || new Date()).fromNow()}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )
      )}

      <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
        <Button type="link" onClick={() => { setVisible(false); navigate('/alert-center'); }}>
          查看全部预警
        </Button>
      </div>
    </div>
  );

  const totalBadge = getBadgeCount();

  return (
    <Dropdown
      popupRender={() => alertListContent}
      trigger={['click']}
      open={visible}
      onOpenChange={(open) => {
        setVisible(open);
        if (open) {
          // 打开时主动拉一次最新
          fetchAppNotifs();
          fetchDndPref();
        }
      }}
      placement="bottomRight"
    >
      <Badge
        count={totalBadge}
        overflowCount={99}
        style={{ backgroundColor: appNotifUnread > 0 ? '#d97757' : '#ff4d4f' }}
      >
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 18 }} />}
          style={{ color: totalBadge > 0 ? (appNotifUnread > 0 ? '#d97757' : '#ff4d4f') : 'inherit' }}
        />
      </Badge>
    </Dropdown>
  );
};

export default AlertNotification;
