import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../hooks';
import {
  Card, Table, Tag, Button, Space, Modal, Form, Select, DatePicker, Input,
  message, Row, Col, Statistic, Empty, Spin, Popconfirm, Typography, Badge,
} from 'antd';
import {
  ReloadOutlined, PlusOutlined, BellOutlined, CheckOutlined,
  StopOutlined, DeleteOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { acceptanceManagementAPI } from '../utils/api';
import useIsMobile from '../hooks/useIsMobile';

const { TextArea } = Input;
const { Title, Text } = Typography;

const REMINDER_TYPES = ['到期提醒', '超期预警', '审批待办', '整改通知'];
const REMINDER_STATUSES = ['待发送', '已发送', '已读', '已忽略'];

const reminderTypeColorMap = {
  到期提醒: 'orange',
  超期预警: 'red',
  审批待办: 'blue',
  整改通知: 'gold',
};

const reminderStatusColorMap = {
  待发送: 'orange',
  已发送: 'blue',
  已读: 'green',
  已忽略: 'default',
};

const AcceptanceReminders = () => {
  const canManage = useCan('acceptance', 'reminder:manage');
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ status: undefined, reminder_type: undefined });

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [createVisible, setCreateVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const resp = await acceptanceManagementAPI.getReminderStats();
      if (resp.success) {
        setStats(resp.data || {});
      }
    } catch (e) {
      // 统计失败不影响主列表
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadReminders = useCallback(async (page = 1, pageSize = 10, currentFilters = filters) => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (currentFilters.status) params.status = currentFilters.status;
      if (currentFilters.reminder_type) params.reminder_type = currentFilters.reminder_type;
      const resp = await acceptanceManagementAPI.getReminders(params);
      const list = resp.data || [];
      setReminders(list);
      setPagination({
        current: resp.pagination?.page || page,
        pageSize: resp.pagination?.pageSize || pageSize,
        total: resp.pagination?.total || list.length,
      });
    } catch (error) {
      console.error('获取验收提醒失败:', error);
      message.error('获取验收提醒失败');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadReminders(1, 10, filters);
    loadStats();
  }, []);

  const handleTableChange = (pag) => {
    loadReminders(pag.current, pag.pageSize, filters);
  };

  const handleFilterChange = (key, value) => {
    const next = { ...filters, [key]: value || undefined };
    setFilters(next);
    loadReminders(1, pagination.pageSize, next);
  };

  const handleMarkStatus = async (id, status) => {
    try {
      const resp = await acceptanceManagementAPI.updateReminderStatus(id, status);
      if (resp.success) {
        message.success(status === '已读' ? '已标记为已读' : '已标记为已忽略');
        loadReminders(pagination.current, pagination.pageSize, filters);
      } else {
        message.error(resp.message || '操作失败');
      }
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      const resp = await acceptanceManagementAPI.deleteReminder(id);
      if (resp.success) {
        message.success('提醒已删除');
        loadReminders(pagination.current, pagination.pageSize, filters);
        loadStats();
      } else {
        message.error(resp.message || '删除失败');
      }
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        title: values.title,
        reminder_type: values.reminder_type,
        remind_date: values.remind_date ? values.remind_date.format('YYYY-MM-DD') : undefined,
        content: values.content || undefined,
        target_department: values.target_department || undefined,
        acceptance_record_id: values.acceptance_record_id ? Number(values.acceptance_record_id) : undefined,
        application_id: values.application_id ? Number(values.application_id) : undefined,
      };
      const resp = await acceptanceManagementAPI.createReminder(payload);
      if (resp.success) {
        message.success('提醒创建成功');
        setCreateVisible(false);
        form.resetFields();
        loadReminders(1, pagination.pageSize, filters);
        loadStats();
      } else {
        message.error(resp.message || '创建失败');
      }
    } catch (e) {
      if (e?.errorFields) return;
      message.error('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '提醒标题',
      dataIndex: 'title',
      key: 'title',
      render: text => <Text strong>{text || '-'}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'reminder_type',
      key: 'reminder_type',
      width: 110,
      render: t => <Tag color={reminderTypeColorMap[t] || 'default'}>{t || '-'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: s => <Tag color={reminderStatusColorMap[s] || 'default'}>{s || '-'}</Tag>,
    },
    {
      title: '资产',
      key: 'asset',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text>{r.asset_name || '-'}</Text>
          {r.asset_code && <Text type="secondary" style={{ fontSize: 12 }}>{r.asset_code}</Text>}
        </Space>
      ),
    },
    {
      title: '关联申请',
      dataIndex: 'application_code',
      key: 'application_code',
      width: 140,
      render: t => t || '-',
    },
    {
      title: '接收对象',
      key: 'target',
      render: (_, r) => r.target_name || r.target_department || '-',
    },
    {
      title: '提醒日期',
      dataIndex: 'remind_date',
      key: 'remind_date',
      width: 120,
      render: t => (t ? String(t).split('T')[0] : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, r) => (
        <Space size={4} wrap>
          {r.status !== '已读' && (
            <Button size="small" type="link" icon={<CheckOutlined />} onClick={() => handleMarkStatus(r.id, '已读')}>
              已读
            </Button>
          )}
          {r.status !== '已忽略' && (
            <Button size="small" type="link" icon={<StopOutlined />} onClick={() => handleMarkStatus(r.id, '已忽略')}>
              忽略
            </Button>
          )}
          {canManage && (
            <Popconfirm title="确定删除该提醒？" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const typeStatMap = {};
  (stats?.byType || []).forEach(item => { typeStatMap[item.reminder_type] = item.count; });
  const statusStatMap = {};
  (stats?.byStatus || []).forEach(item => { statusStatMap[item.status] = item.count; });

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/acceptance')}>返回</Button>
          <Title level={2} style={{ margin: 0 }}>验收提醒</Title>
        </Space>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => { loadReminders(pagination.current, pagination.pageSize, filters); loadStats(); }}>
            刷新
          </Button>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
              新建提醒
            </Button>
          )}
        </Space>
      </div>

      <Spin spinning={statsLoading}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="未处理提醒" value={stats?.unresolved || 0} prefix={<BellOutlined style={{ color: '#fa8c16' }} />} />
            </Card>
          </Col>
          {REMINDER_TYPES.map(type => (
            <Col xs={12} md={6} key={type}>
              <Card size="small">
                <Statistic title={type} value={typeStatMap[type] || 0} />
              </Card>
            </Col>
          ))}
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="已读" value={statusStatMap['已读'] || 0} />
            </Card>
          </Col>
        </Row>
      </Spin>

      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title="筛选"
      >
        <Space wrap>
          <Select
            placeholder="提醒类型"
            allowClear
            style={{ width: 160 }}
            value={filters.reminder_type}
            onChange={v => handleFilterChange('reminder_type', v)}
            options={REMINDER_TYPES.map(t => ({ label: t, value: t }))}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 140 }}
            value={filters.status}
            onChange={v => handleFilterChange('status', v)}
            options={REMINDER_STATUSES.map(s => ({ label: s, value: s }))}
          />
        </Space>
      </Card>

      <Card size="small" title={`提醒列表（${pagination.total}）`}>
        <div className="hide-on-mobile">
          <Table
            rowKey="id"
            dataSource={reminders}
            columns={columns}
            loading={loading}
            scroll={{ x: 900 }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: t => `共 ${t} 条`,
            }}
            onChange={handleTableChange}
            locale={{ emptyText: '暂无提醒' }}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c' }}>加载中...</div>
          ) : reminders.length === 0 ? (
            <Empty description="暂无提醒" />
          ) : (
            reminders.map(r => (
              <div key={r.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{r.title}</span>
                  <Tag color={reminderStatusColorMap[r.status] || 'default'}>{r.status}</Tag>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">类型</span>
                    <span className="mobile-card-value"><Tag color={reminderTypeColorMap[r.reminder_type] || 'default'}>{r.reminder_type}</Tag></span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">资产</span>
                    <span className="mobile-card-value">{r.asset_name || '-'}{r.asset_code ? `（${r.asset_code}）` : ''}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">接收</span>
                    <span className="mobile-card-value">{r.target_name || r.target_department || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">日期</span>
                    <span className="mobile-card-value">{r.remind_date ? String(r.remind_date).split('T')[0] : '-'}</span>
                  </div>
                  <div className="mobile-card-actions">
                    {r.status !== '已读' && (
                      <Button size="small" type="link" icon={<CheckOutlined />} onClick={() => handleMarkStatus(r.id, '已读')}>已读</Button>
                    )}
                    {r.status !== '已忽略' && (
                      <Button size="small" type="link" icon={<StopOutlined />} onClick={() => handleMarkStatus(r.id, '已忽略')}>忽略</Button>
                    )}
                    {canManage && (
                      <Popconfirm title="确定删除该提醒？" onConfirm={() => handleDelete(r.id)}>
                        <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
                      </Popconfirm>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal
        title="新建验收提醒"
        open={createVisible}
        onOk={handleCreate}
        confirmLoading={submitting}
        onCancel={() => { setCreateVisible(false); form.resetFields(); }}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" initialValues={{ reminder_type: '到期提醒' }}>
          <Form.Item name="title" label="提醒标题" rules={[{ required: true, message: '请输入提醒标题' }]}>
            <Input placeholder="例如：资产 A-001 验收即将到期" maxLength={200} />
          </Form.Item>
          <Form.Item name="reminder_type" label="提醒类型" rules={[{ required: true }]}>
            <Select options={REMINDER_TYPES.map(t => ({ label: t, value: t }))} />
          </Form.Item>
          <Form.Item name="remind_date" label="提醒日期" rules={[{ required: true, message: '请选择提醒日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="target_department" label="接收科室">
            <Input placeholder="可选，留空则按租户管理员兜底" maxLength={100} />
          </Form.Item>
          <Form.Item name="acceptance_record_id" label="关联验收记录ID">
            <Input type="number" placeholder="可选，验收记录主键ID" />
          </Form.Item>
          <Form.Item name="application_id" label="关联验收申请ID">
            <Input type="number" placeholder="可选，验收申请主键ID" />
          </Form.Item>
          <Form.Item name="content" label="提醒内容">
            <TextArea rows={3} maxLength={500} placeholder="提醒详细说明（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AcceptanceReminders;
