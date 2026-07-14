/**
 * 智能预警通知组件
 * 显示系统预警通知 + 实时维修审批推送通知
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Badge, Dropdown, List, Tag, Typography, Empty, Button, Spin,
  Tooltip, Tabs, Space
} from 'antd';
import { 
  BellOutlined, ToolOutlined, SafetyOutlined, 
  SolutionOutlined, FileSearchOutlined, WarningOutlined,
  SettingOutlined, RocketOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { intelligentAlertAPI } from '../utils/api';
import socket from '../utils/socket';
import auth from '../utils/auth';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;
const { TabPane } = Tabs;

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
  const [activeTab, setActiveTab] = useState('all');
  
  // 实时推送通知（维修审批等）
  const [pushNotifications, setPushNotifications] = useState([]);
  const pushNotifRef = useRef([]);

  // 获取预警数据
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const [overviewRes, alertsRes] = await Promise.all([
        intelligentAlertAPI.getOverview(),
        intelligentAlertAPI.getAlerts({ pageSize: 50 })
      ]);

      if (overviewRes?.success) {
        setOverview(overviewRes.data);
      }
      if (alertsRes?.success) {
        setAlerts(alertsRes.data || []);
      }
    } catch (error) {
      console.error('获取预警数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 定时刷新预警数据
  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 5 * 60 * 1000); // 每5分钟刷新
    return () => clearInterval(timer);
  }, [fetchAlerts]);

  // 连接 Socket.IO 接收实时推送
  useEffect(() => {
    const user = auth.getUser();
    if (!user) return;

    // 连接 WebSocket
    socket.connect();

    // 监听维修审批通知
    const unsubMaintenance = socket.on('maintenance:notification', (data) => {
      console.log('[Socket] 收到维修审批通知:', data);
      
      // 添加到推送通知列表
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

      // 显示桌面通知（浏览器 Notification API）
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('新维修工单', {
          body: notif.content,
          icon: '/favicon.ico',
        });
      }
    });

    // 清理函数
    return () => {
      unsubMaintenance();
      socket.disconnect();
    };
  }, []);

  // 请求浏览器通知权限
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // 获取推送通知未读数量
  const getPushUnreadCount = () => {
    return pushNotifications.filter(n => !n.isRead).length;
  };

  // 标记推送通知为已读
  const markPushAsRead = (notifId) => {
    pushNotifRef.current = pushNotifRef.current.map(n =>
      n.id === notifId ? { ...n, isRead: true } : n
    );
    setPushNotifications(pushNotifRef.current);
  };

  // 标记所有推送通知为已读
  const markAllPushAsRead = () => {
    pushNotifRef.current = pushNotifRef.current.map(n => ({ ...n, isRead: true }));
    setPushNotifications(pushNotifRef.current);
  };

  // 获取紧急预警数量
  const getUrgentCount = () => {
    const alertCount = alerts.filter(alert => alert.urgency === 'high' && !alert.is_read).length;
    const pushCount = getPushUnreadCount();
    return alertCount + pushCount;
  };

  // 获取类型图标
  const getTypeIcon = (type) => {
    const icons = {
      maintenance_due: <ToolOutlined style={{ color: '#1890ff' }} />,
      qualification_expire: <SolutionOutlined style={{ color: '#722ed1' }} />,
      inspection_due: <FileSearchOutlined style={{ color: '#fa8c16' }} />,
      safety_expire: <SafetyOutlined style={{ color: '#52c41a' }} />,
      uptime_low: <WarningOutlined style={{ color: '#f5222d' }} />,
      maintenance_approved: <RocketOutlined style={{ color: '#d97757' }} />,
    };
    return icons[type] || <WarningOutlined />;
  };

  // 获取类型名称
  const getTypeName = (type) => {
    const names = {
      maintenance_due: '保养到期',
      qualification_expire: '资质到期',
      inspection_due: '检验到期',
      safety_expire: '安全检测',
      uptime_low: '开机率异常',
      maintenance_approved: '维修工单',
    };
    return names[type] || type;
  };

  // 获取紧急度标签
  const getUrgencyTag = (urgency) => {
    const config = {
      high: { color: 'error', text: '紧急' },
      medium: { color: 'warning', text: '重要' },
      low: { color: 'default', text: '一般' },
    };
    const { color, text } = config[urgency] || config.low;
    return <Tag color={color} size="small">{text}</Tag>;
  };

  // 处理预警点击
  const handleAlertClick = (alert) => {
    setVisible(false);
    if (alert.actionUrl) {
      navigate(alert.actionUrl);
    }
  };

  // 处理推送通知点击
  const handlePushClick = (notif) => {
    markPushAsRead(notif.id);
    setVisible(false);
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  // 过滤预警数据
  const getFilteredAlerts = () => {
    if (activeTab === 'all') return alerts;
    if (activeTab === 'urgent') return alerts.filter(a => a.urgency === 'high');
    if (activeTab === 'push') return []; // push tab 使用独立渲染
    return alerts.filter(a => a.type === activeTab);
  };

  // 预警列表内容
  const alertListContent = (
    <div style={{ width: 420, maxHeight: 520, overflow: 'auto' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong>通知中心</Text>
        <Space size={8}>
          {getPushUnreadCount() > 0 && (
            <Button type="link" size="small" onClick={markAllPushAsRead}>
              全部已读
            </Button>
          )}
          <Button 
            type="link" 
            size="small" 
            icon={<SettingOutlined />}
            onClick={() => {
              setVisible(false);
              navigate('/alert-settings');
            }}
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
          { key: 'all', label: <Badge count={getUrgentCount()} size="small" offset={[5, 0]}>全部</Badge> },
          { key: 'push', label: <Badge count={getPushUnreadCount()} size="small" offset={[5, 0]} style={{ backgroundColor: '#d97757' }}>实时推送</Badge> },
          { key: 'urgent', label: <Badge count={alerts.filter(a => a.urgency === 'high').length} size="small" offset={[5, 0]} style={{ backgroundColor: '#ff4d4f' }}>紧急</Badge> },
          { key: 'maintenance_due', label: '保养' },
          { key: 'qualification_expire', label: '资质' },
        ]}
      />

      {activeTab === 'push' ? (
        // 实时推送通知列表
        pushNotifications.length === 0 ? (
          <Empty description="暂无实时推送通知" style={{ padding: 40 }} />
        ) : (
          <List
            dataSource={pushNotifications.slice(0, 15)}
            renderItem={item => (
              <List.Item
                style={{ 
                  padding: '12px 16px', 
                  cursor: 'pointer',
                  backgroundColor: item.isRead ? '#fafafa' : '#fff7f3',
                  borderLeft: `3px solid ${item.urgency === 'high' ? '#ff4d4f' : '#d97757'}`,
                  opacity: item.isRead ? 0.7 : 1,
                }}
                onClick={() => handlePushClick(item)}
              >
                <List.Item.Meta
                  avatar={getTypeIcon(item.type)}
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
      ) : loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : getFilteredAlerts().length === 0 ? (
        <Empty description="暂无预警通知" style={{ padding: 40 }} />
      ) : (
        <List
          dataSource={getFilteredAlerts().slice(0, 10)}
          renderItem={item => (
            <List.Item
              style={{ 
                padding: '12px 16px', 
                cursor: 'pointer',
                backgroundColor: item.is_read ? '#fafafa' : item.urgency === 'high' ? '#fff2f0' : 'transparent',
                borderLeft: `3px solid ${item.urgency === 'high' ? '#ff4d4f' : item.urgency === 'medium' ? '#faad14' : '#d9d9d9'}`,
                opacity: item.is_read ? 0.7 : 1,
              }}
              onClick={() => handleAlertClick(item)}
            >
              <List.Item.Meta
                avatar={getTypeIcon(item.type)}
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
                      {getTypeName(item.type)} · {dayjs(item.read_at || item.created_at || new Date()).fromNow()}
                    </Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}

      <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
        <Button type="link" onClick={() => { setVisible(false); navigate('/alert-center'); }}>
          查看全部预警
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown
      popupRender={() => alertListContent}
      trigger={['click']}
      open={visible}
      onOpenChange={setVisible}
      placement="bottomRight"
    >
      <Badge count={getUrgentCount()} overflowCount={99} style={{ backgroundColor: getPushUnreadCount() > 0 ? '#d97757' : '#ff4d4f' }}>
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 18 }} />}
          style={{ color: getUrgentCount() > 0 ? (getPushUnreadCount() > 0 ? '#d97757' : '#ff4d4f') : 'inherit' }}
        />
      </Badge>
    </Dropdown>
  );
};

export default AlertNotification;
