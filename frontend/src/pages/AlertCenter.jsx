/**
 * 预警中心页面
 * 集中管理所有类型的预警信息
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useIsMobile } from '../hooks';
import {
  Card, Table, Tag, Button, Space, Row, Col, Statistic, Select, message, Popconfirm, Switch,
  Modal, Input, Tooltip
} from 'antd';
import {
  BellOutlined, ToolOutlined, SafetyOutlined,
  SolutionOutlined, FileSearchOutlined, WarningOutlined, CheckCircleOutlined, FilterOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { intelligentAlertAPI, getApiErrorMessage } from '../utils/api';

const { Option } = Select;

const AlertCenter = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [handlingAll, setHandlingAll] = useState(false);
  const [markingReadIds, setMarkingReadIds] = useState(new Set());
  const [handlingAlertIds, setHandlingAlertIds] = useState(new Set());
  const [unhandlingAlertIds, setUnhandlingAlertIds] = useState(new Set());
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [handleModalSubmitting, setHandleModalSubmitting] = useState(false);
  const [currentHandlingAlert, setCurrentHandlingAlert] = useState(null);
  const [handlerNotes, setHandlerNotes] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [overview, setOverview] = useState({
    total: 0,
    maintenance: { total: 0, urgent: 0 },
    qualification: { total: 0, urgent: 0 },
    inspection: { total: 0, urgent: 0 },
    safety: { total: 0, urgent: 0 },
    uptime: { total: 0, urgent: 0 },
  });
  const [filters, setFilters] = useState({
    type: undefined,
    urgency: undefined,
    status: undefined,
    unreadOnly: false,
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const { current: currentPage, pageSize: currentPageSize } = pagination;

  const formatDateTime = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString('zh-CN', { hour12: false });
  };

  // 获取预警数据
  const fetchData = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      const [overviewRes, alertsRes] = await Promise.all([
        intelligentAlertAPI.getOverview(),
        intelligentAlertAPI.getAlerts({
          page: params.current || currentPage,
          pageSize: params.pageSize || currentPageSize,
          type: filters.type,
          urgency: filters.urgency,
          status: filters.status,
          unreadOnly: filters.unreadOnly || undefined,
        })
      ]);

      if (overviewRes?.success) {
        setOverview(overviewRes.data);
      }
      if (alertsRes?.success) {
        setAlerts(alertsRes.data || []);
        setPagination(prev => ({
          ...prev,
          total: alertsRes.pagination?.total || 0,
        }));
      }
    } catch (error) {
      console.error('获取预警数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, currentPageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 获取类型配置
  const getTypeConfig = (type) => {
    const configs = {
      maintenance_due: {
        icon: <ToolOutlined />,
        color: '#1890ff',
        label: '保养到期',
        actionUrl: '/maintenance/plans'
      },
      qualification_expire: {
        icon: <SolutionOutlined />,
        color: '#722ed1',
        label: '资质到期',
        actionUrl: '/staff/qualifications'
      },
      inspection_due: {
        icon: <FileSearchOutlined />,
        color: '#fa8c16',
        label: '检验到期',
        actionUrl: '/special-equipment'
      },
      safety_expire: {
        icon: <SafetyOutlined />,
        color: '#52c41a',
        label: '安全检测',
        actionUrl: '/safety-inspection'
      },
      uptime_low: {
        icon: <WarningOutlined />,
        color: '#f5222d',
        label: '开机率异常',
        actionUrl: '/uptime/statistics'
      },
    };
    return configs[type] || { icon: <WarningOutlined />, color: '#999', label: type };
  };

  // 获取紧急度配置
  const getUrgencyConfig = (urgency) => {
    const configs = {
      high: { color: 'error', label: '紧急', priority: 1 },
      medium: { color: 'warning', label: '重要', priority: 2 },
      low: { color: 'default', label: '一般', priority: 3 },
    };
    return configs[urgency] || configs.low;
  };

  // 表格列定义
  const columns = [
    {
      title: '预警类型',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (type) => {
        const config = getTypeConfig(type);
        return (
          <Space>
            <span style={{ color: config.color }}>{config.icon}</span>
            <span>{config.label}</span>
          </Space>
        );
      },
    },
    {
      title: '预警内容',
      dataIndex: 'content',
      key: 'content',
      render: (content, record) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>{record.title}</div>
          <div style={{ color: '#666', fontSize: 13 }}>{content}</div>
        </div>
      ),
    },
    {
      title: '紧急程度',
      dataIndex: 'urgency',
      key: 'urgency',
      width: 100,
      render: (urgency) => {
        const config = getUrgencyConfig(urgency);
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 130,
      render: (_, record) => {
        if (record.is_handled) {
          const handledAtText = formatDateTime(record.handled_at);
          const handledByText = record.handled_by_name || (record.handled_by ? `用户#${record.handled_by}` : '系统');
          const detailText = `处理人：${handledByText} | 处理时间：${handledAtText}`;
          return (
            <Space size={4}>
              <Tag color="success">已处理</Tag>
              <Tooltip title={detailText}>
                <Tag color="default">详情</Tag>
              </Tooltip>
              {record.handler_notes ? (
                <Tooltip title={`备注：${record.handler_notes}`}>
                  <Tag color="blue">备注</Tag>
                </Tooltip>
              ) : null}
            </Space>
          );
        }
        if (record.is_read) {
          return <Tag icon={<CheckCircleOutlined />} color="default">已读</Tag>;
        }
        return <Tag color="processing">未读</Tag>;
      },
    },
    {
      title: '关联资产/人员',
      dataIndex: 'data',
      key: 'related',
      width: 200,
      render: (data, record) => {
        if (record.type === 'qualification_expire') {
          return data?.staff_name || '-';
        }
        return data?.asset_name || data?.equipment_name || '-';
      },
    },
    {
      title: '剩余/逾期天数',
      key: 'days',
      width: 120,
      render: (_, record) => {
        const days = record.data?.days_remaining;
        if (days === undefined) return '-';
        if (days < 0) return <Tag color="error">逾期{Math.abs(days)}天</Tag>;
        if (days === 0) return <Tag color="error">今天到期</Tag>;
        return <Tag color={days <= 3 ? 'warning' : 'default'}>剩{days}天</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 230,
      render: (_, record) => {
        const config = getTypeConfig(record.type);
        const isMarkingRead = markingReadIds.has(record.id);
        const isHandling = handlingAlertIds.has(record.id);
        const isUnhandling = unhandlingAlertIds.has(record.id);
        return (
          <Space>
            <Button
              type="link"
              size="small"
              onClick={() => navigate(config.actionUrl)}
            >
              查看
            </Button>
            <Button
              type="link"
              size="small"
              disabled={record.is_read}
              loading={isMarkingRead}
              onClick={() => handleMarkAsRead(record)}
            >
              {record.is_read ? '已读' : '标记已读'}
            </Button>
            {record.is_handled ? (
              <Popconfirm
                title="确认撤销已处理状态？"
                onConfirm={() => handleUnhandle(record)}
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  loading={isUnhandling}
                >
                  撤销处理
                </Button>
              </Popconfirm>
            ) : (
              <Button
                type="link"
                size="small"
                loading={isHandling}
                onClick={() => openHandleModal(record)}
              >
                标记已处理
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  // 标记已读
  const handleMarkAsRead = async (record) => {
    if (!record?.id || record.is_read) return;

    setMarkingReadIds(prev => {
      const next = new Set(prev);
      next.add(record.id);
      return next;
    });

    try {
      await intelligentAlertAPI.markAsRead(record.id, { type: record.type });
      setAlerts(prev =>
        prev.map(alert =>
          alert.id === record.id
            ? { ...alert, is_read: true, read_at: new Date().toISOString() }
            : alert
        )
      );
      message.success('已标记为已读');
    } catch (error) {
      message.error(getApiErrorMessage(error, '标记已读失败'));
    } finally {
      setMarkingReadIds(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
    }
  };

  // 标记已处理
  const handleMarkAsHandled = async (record, notes = '') => {
    if (!record?.id || record.is_handled) return;

    setHandlingAlertIds(prev => {
      const next = new Set(prev);
      next.add(record.id);
      return next;
    });

    try {
      await intelligentAlertAPI.markAsHandled(record.id, {
        type: record.type,
        handlerNotes: notes || undefined,
      });
      setAlerts(prev =>
        prev.map(alert =>
          alert.id === record.id
            ? {
                ...alert,
                is_read: true,
                read_at: alert.read_at || new Date().toISOString(),
                is_handled: true,
                handled_at: new Date().toISOString(),
                handler_notes: notes || null,
              }
            : alert
        )
      );
      message.success('已标记为已处理');
    } catch (error) {
      message.error(getApiErrorMessage(error, '标记已处理失败'));
    } finally {
      setHandlingAlertIds(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
    }
  };

  // 撤销已处理
  const handleUnhandle = async (record) => {
    if (!record?.id || !record.is_handled) return;

    setUnhandlingAlertIds(prev => {
      const next = new Set(prev);
      next.add(record.id);
      return next;
    });

    try {
      await intelligentAlertAPI.unhandleAlert(record.id);
      setAlerts(prev =>
        prev.map(alert =>
          alert.id === record.id
            ? {
                ...alert,
                is_handled: false,
                handled_at: null,
                handled_by: null,
                handled_by_name: null,
                handler_notes: null,
              }
            : alert
        )
      );
      message.success('已撤销处理状态');
    } catch (error) {
      message.error(getApiErrorMessage(error, '撤销处理失败'));
    } finally {
      setUnhandlingAlertIds(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
    }
  };

  // 打开处理备注弹窗
  const openHandleModal = (record) => {
    if (!record || record.is_handled) return;
    setCurrentHandlingAlert(record);
    setHandlerNotes(record.handler_notes || '');
    setHandleModalVisible(true);
  };

  const closeHandleModal = () => {
    if (handleModalSubmitting) return;
    setHandleModalVisible(false);
    setCurrentHandlingAlert(null);
    setHandlerNotes('');
  };

  const confirmHandleWithNotes = async () => {
    if (!currentHandlingAlert) return;
    setHandleModalSubmitting(true);
    try {
      await handleMarkAsHandled(currentHandlingAlert, String(handlerNotes || '').trim());
      setHandleModalVisible(false);
      setCurrentHandlingAlert(null);
      setHandlerNotes('');
    } finally {
      setHandleModalSubmitting(false);
    }
  };

  // 批量标记已读
  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    try {
      const result = await intelligentAlertAPI.markAllAsRead({
        type: filters.type,
        urgency: filters.urgency,
        unreadOnly: filters.unreadOnly,
      });
      message.success(result?.message || '批量标记已读成功');
      fetchData();
    } catch (error) {
      message.error(getApiErrorMessage(error, '批量标记已读失败'));
    } finally {
      setMarkingAll(false);
    }
  };

  // 批量标记已处理
  const handleMarkAllAsHandled = async () => {
    setHandlingAll(true);
    try {
      const result = await intelligentAlertAPI.markAllAsHandled({
        type: filters.type,
        urgency: filters.urgency,
        status: filters.status,
        unreadOnly: filters.unreadOnly,
      });
      message.success(result?.message || '批量标记已处理成功');
      fetchData();
    } catch (error) {
      message.error(getApiErrorMessage(error, '批量标记已处理失败'));
    } finally {
      setHandlingAll(false);
    }
  };

  // 处理筛选变化
  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'status' && value && value !== 'unread' && prev.unreadOnly) {
        next.unreadOnly = false;
      }
      if (key === 'unreadOnly' && value === true && prev.status && prev.status !== 'unread') {
        next.status = undefined;
      }
      return next;
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // 统计卡片数据
  const statCards = [
    {
      title: '保养预警',
      total: overview.maintenance.total,
      urgent: overview.maintenance.urgent,
      icon: <ToolOutlined />,
      color: '#1890ff',
      key: 'maintenance_due'
    },
    {
      title: '资质预警',
      total: overview.qualification.total,
      urgent: overview.qualification.urgent,
      icon: <SolutionOutlined />,
      color: '#722ed1',
      key: 'qualification_expire'
    },
    {
      title: '检验预警',
      total: overview.inspection.total,
      urgent: overview.inspection.urgent,
      icon: <FileSearchOutlined />,
      color: '#fa8c16',
      key: 'inspection_due'
    },
    {
      title: '安全检测预警',
      total: overview.safety.total,
      urgent: overview.safety.urgent,
      icon: <SafetyOutlined />,
      color: '#52c41a',
      key: 'safety_expire'
    },
    {
      title: '开机率异常',
      total: overview.uptime.total,
      urgent: overview.uptime.urgent,
      icon: <WarningOutlined />,
      color: '#f5222d',
      key: 'uptime_low'
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>
        <BellOutlined style={{ marginRight: 8 }} />
        预警中心
      </h2>
      <p style={{ marginBottom: 24, color: '#666' }}>
        集中管理系统各类预警信息，及时处理异常情况
      </p>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {statCards.map(card => (
          <Col span={4} key={card.key}>
            <Card
              hoverable
              onClick={() => {
                setFilters(prev => ({ ...prev, type: card.key, urgency: undefined, status: undefined }));
                setPagination(prev => ({ ...prev, current: 1 }));
              }}
              style={{ borderTop: `3px solid ${card.color}` }}
            >
              <Statistic
                title={
                  <Space>
                    <span style={{ color: card.color }}>{card.icon}</span>
                    <span>{card.title}</span>
                  </Space>
                }
                value={card.total}
                suffix={card.urgent > 0 && <Tag color="error" size="small">{card.urgent}紧急</Tag>}
              />
            </Card>
          </Col>
        ))}
        <Col span={4}>
          <Card style={{ borderTop: '3px solid #ff4d4f', backgroundColor: '#fff2f0' }}>
            <Statistic
              title={<Space><WarningOutlined />总紧急预警</Space>}
              value={overview.maintenance.urgent + overview.qualification.urgent +
                     overview.inspection.urgent + overview.safety.urgent + overview.uptime.urgent}
              styles={{ content: { color: '#cf1322' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* 预警列表 */}
      <Card
        title={<Space><BellOutlined />预警列表</Space>}
        extra={
          <Space>
            <Select
              placeholder="预警类型"
              allowClear
              style={{ width: 120 }}
              value={filters.type}
              onChange={(value) => handleFilterChange('type', value)}
            >
              <Option value="maintenance_due">保养到期</Option>
              <Option value="qualification_expire">资质到期</Option>
              <Option value="inspection_due">检验到期</Option>
              <Option value="safety_expire">安全检测</Option>
              <Option value="uptime_low">开机率异常</Option>
            </Select>
            <Select
              placeholder="紧急程度"
              allowClear
              style={{ width: 100 }}
              value={filters.urgency}
              onChange={(value) => handleFilterChange('urgency', value)}
            >
              <Option value="high">紧急</Option>
              <Option value="medium">重要</Option>
              <Option value="low">一般</Option>
            </Select>
            <Select
              placeholder="处理状态"
              allowClear
              style={{ width: 110 }}
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
            >
              <Option value="unread">未读</Option>
              <Option value="read">已读</Option>
              <Option value="pending">待处理</Option>
              <Option value="handled">已处理</Option>
            </Select>
            <Button icon={<FilterOutlined />} onClick={() => fetchData()}>
              刷新
            </Button>
            <Space size={4}>
              <span style={{ color: '#666', fontSize: 12 }}>仅看未读</span>
              <Switch
                size="small"
                checked={Boolean(filters.unreadOnly)}
                onChange={checked => handleFilterChange('unreadOnly', checked)}
              />
            </Space>
            <Popconfirm
              title="确认将当前筛选结果全部标记为已读？"
              onConfirm={handleMarkAllAsRead}
              okButtonProps={{ loading: markingAll }}
            >
              <Button loading={markingAll}>
                全部标记已读
              </Button>
            </Popconfirm>
            <Popconfirm
              title="确认将当前筛选结果全部标记为已处理？"
              onConfirm={handleMarkAllAsHandled}
              okButtonProps={{ loading: handlingAll }}
            >
              <Button loading={handlingAll}>
                全部标记已处理
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={alerts}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            onChange={(newPagination) => {
              setPagination(newPagination);
              fetchData({
                current: newPagination.current,
                pageSize: newPagination.pageSize,
              });
            }}
          />
        </div>

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {Array.isArray(alerts) && alerts.length > 0 ? (
            alerts.map(record => {
              const typeConfig = getTypeConfig(record.type);
              const urgencyConfig = getUrgencyConfig(record.urgency);
              const isMarkingRead = markingReadIds.has(record.id);
              const isHandling = handlingAlertIds.has(record.id);
              const isUnhandling = unhandlingAlertIds.has(record.id);
              const days = record.data?.days_remaining;
              let daysNode = '-';
              if (days !== undefined) {
                if (days < 0) daysNode = <Tag color="error">逾期{Math.abs(days)}天</Tag>;
                else if (days === 0) daysNode = <Tag color="error">今天到期</Tag>;
                else daysNode = <Tag color={days <= 3 ? 'warning' : 'default'}>剩{days}天</Tag>;
              }
              let statusNode;
              if (record.is_handled) statusNode = <Tag color="success">已处理</Tag>;
              else if (record.is_read) statusNode = <Tag color="default">已读</Tag>;
              else statusNode = <Tag color="processing">未读</Tag>;
              const related = record.type === 'qualification_expire'
                ? (record.data?.staff_name || '-')
                : (record.data?.asset_name || record.data?.equipment_name || '-');
              return (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{record.title || record.content || `#${record.id}`}</span>
                    <span className="mobile-card-badge">
                      <Tag color={typeConfig.color}>{typeConfig.label}</Tag>
                    </span>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">紧急程度</span>
                      <span className="mobile-card-value">
                        <Tag color={urgencyConfig.color}>{urgencyConfig.label}</Tag>
                      </span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">状态</span>
                      <span className="mobile-card-value">{statusNode}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">关联</span>
                      <span className="mobile-card-value">{related}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">剩余/逾期</span>
                      <span className="mobile-card-value">{daysNode}</span>
                    </div>
                    {record.content && (
                      <div className="mobile-card-field mobile-card-field--full">
                        <span className="mobile-card-label">预警内容</span>
                        <span className="mobile-card-value">{record.content}</span>
                      </div>
                    )}
                  </div>
                  <div className="mobile-card-actions">
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => navigate(typeConfig.actionUrl)}
                    >
                      查看
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={<CheckOutlined />}
                      disabled={record.is_read}
                      loading={isMarkingRead}
                      onClick={() => handleMarkAsRead(record)}
                    >
                      {record.is_read ? '已读' : '标已读'}
                    </Button>
                    {record.is_handled ? (
                      <Popconfirm
                        title="确认撤销已处理状态？"
                        onConfirm={() => handleUnhandle(record)}
                      >
                        <Button
                          size="small"
                          danger
                          icon={<UndoOutlined />}
                          loading={isUnhandling}
                        >
                          撤销
                        </Button>
                      </Popconfirm>
                    ) : (
                      <Button
                        size="small"
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        loading={isHandling}
                        onClick={() => openHandleModal(record)}
                      >
                        处理
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : !loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无预警</div>
          ) : null}
        </div>
      </Card>

      <Modal
        title="标记预警为已处理"
        open={handleModalVisible}
        onCancel={closeHandleModal}
        onOk={confirmHandleWithNotes}
        confirmLoading={handleModalSubmitting}
        okText="确认处理"
        cancelText="取消"
      >
        <p style={{ marginBottom: 8, color: '#666' }}>
          {currentHandlingAlert?.title || '当前预警'}
        </p>
        <Input.TextArea
          value={handlerNotes}
          onChange={e => setHandlerNotes(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="可选：填写处理说明（最多1000字）"
          showCount
        />
      </Modal>
    </div>
  );
};

export default AlertCenter;
