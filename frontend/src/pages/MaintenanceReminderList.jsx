import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Typography,
  Table,
  Button,
  Form,
  Input,
  Select,
  Modal,
  message,
  DatePicker,
  Space,
  Tag,
  Descriptions,
  Drawer,
  InputNumber,
  Row,
  Col,
  Statistic,
  Alert,
  Divider,
  Popconfirm,
  Collapse,
  Switch,
  Checkbox,
  Steps,
  Tooltip,
} from 'antd';

import {
  BellOutlined,
  SettingOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ThunderboltOutlined,
  DownOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { maintenanceAPI } from '../utils/api';
import dayjs from 'dayjs';
import { useIsMobile } from '../hooks';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const MaintenanceReminderList = () => {
  const isMobile = useIsMobile();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useState({});
  const [searchForm] = Form.useForm();
  const [sendForm] = Form.useForm();
  const [configForm] = Form.useForm();
  const [isSendModalVisible, setIsSendModalVisible] = useState(false);
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);
  const [maintenancePlans, setMaintenancePlans] = useState([]);
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, sent: 0, failed: 0 });

  // 检查提醒结果
  const [checkResult, setCheckResult] = useState(null);
  const [checkModalVisible, setCheckModalVisible] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);

  // 提醒配置
  const [reminderConfig, setReminderConfig] = useState(null);
  const [configSaving, setConfigSaving] = useState(false);

  // 批量发送
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [batchSendLoading, setBatchSendLoading] = useState(false);
  const [batchConfirmVisible, setBatchConfirmVisible] = useState(false);

  // 加载提醒列表
  const loadReminders = async () => {
    setLoading(true);
    try {
      const response = await maintenanceAPI.getMaintenanceReminders(searchParams);
      if (response.success) {
        const data = response.data || [];
        setReminders(data);
        setStats({
          total: data.length,
          pending: data.filter(d => d.status === '待发送').length,
          sent: data.filter(d => d.status === '已发送').length,
          failed: data.filter(d => d.status === '发送失败').length,
        });
      } else {
        message.error('加载提醒列表失败');
      }
    } catch (error) {
      console.error('加载提醒列表失败:', error);
      message.error('网络错误，加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载维护计划列表
  const loadMaintenancePlans = async () => {
    try {
      const response = await maintenanceAPI.getMaintenancePlans({ status: '启用' });
      if (response.success) {
        setMaintenancePlans(response.data || []);
      }
    } catch (error) {
      console.error('加载维护计划失败:', error);
    }
  };

  // 加载提醒配置
  const loadReminderConfig = async () => {
    try {
      const response = await maintenanceAPI.getMaintenanceReminders({ config: true });
      if (response.success && response.data) {
        const cfg = Array.isArray(response.data) ? response.data[0] : response.data;
        setReminderConfig(cfg || null);
        if (cfg) {
          configForm.setFieldsValue({
            reminder_days_before: cfg.reminder_days_before ?? cfg.reminder_days ?? 3,
            reminder_types: cfg.reminder_types || ['system'],
            enabled: cfg.enabled !== false,
          });
        }
      }
    } catch (error) {
      console.error('加载提醒配置失败:', error);
    }
  };

  useEffect(() => {
    loadReminders();
    loadMaintenancePlans();
    loadReminderConfig();
  }, [searchParams]);

  // 增强统计计算
  const enhancedStats = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD');
    const todayPending = reminders.filter(
      d => d.status === '待发送' && d.reminder_date === today
    ).length;
    const totalAttempted = stats.sent + stats.failed;
    const successRate = totalAttempted > 0 ? Math.round((stats.sent / totalAttempted) * 100) : 0;

    // 平均提前天数：计算待发送提醒中 reminder_date 到对应计划 next_maintenance_date 的天数差
    let avgDaysBefore = 0;
    const pendingReminders = reminders.filter(d => d.status === '待发送' && d.reminder_date && d.due_date);
    if (pendingReminders.length > 0) {
      const totalDays = pendingReminders.reduce((sum, d) => {
        const diff = dayjs(d.due_date).diff(dayjs(d.reminder_date), 'day');
        return sum + Math.max(diff, 0);
      }, 0);
      avgDaysBefore = Math.round((totalDays / pendingReminders.length) * 10) / 10;
    }

    return { todayPending, successRate, avgDaysBefore };
  }, [reminders, stats]);

  // 处理搜索
  const handleSearch = values => {
    const params = { ...values };
    if (values.dateRange && values.dateRange.length === 2) {
      params.start_date = values.dateRange[0].format('YYYY-MM-DD');
      params.end_date = values.dateRange[1].format('YYYY-MM-DD');
    }
    delete params.dateRange;
    setSearchParams(params);
  };

  // 检查提醒 - 增强版，使用Modal显示详细结果
  const handleCheckReminders = async () => {
    setCheckLoading(true);
    try {
      const response = await maintenanceAPI.checkMaintenanceReminders();
      if (response.success) {
        const data = response.data || {};
        const remindersFound = data.reminders || data.records || [];
        const count = data.count ?? remindersFound.length ?? response.count ?? 0;

        setCheckResult({
          count,
          reminders: remindersFound,
          message: data.message || '',
          checkedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        });
        setCheckModalVisible(true);

        // 自动刷新列表
        loadReminders();
      } else {
        message.error(response.message || '检查提醒失败');
      }
    } catch (error) {
      console.error('检查提醒失败:', error);
      message.error('检查提醒失败');
    } finally {
      setCheckLoading(false);
    }
  };

  // 手动发送提醒
  const handleSendReminder = async () => {
    try {
      const values = await sendForm.validateFields();
      const response = await maintenanceAPI.sendMaintenanceReminder(values);
      if (response.success) {
        message.success('提醒发送成功');
        setIsSendModalVisible(false);
        sendForm.resetFields();
        loadReminders();
      } else {
        message.error(response.message || '提醒发送失败');
      }
    } catch (error) {
      if (error.errorFields) return; // form validation
      console.error('发送提醒失败:', error);
      message.error('发送提醒失败');
    }
  };

  // 配置提醒规则（Modal中的旧版）
  const handleConfigReminder = async () => {
    try {
      const values = await configForm.validateFields();
      const response = await maintenanceAPI.configMaintenanceReminder(values);
      if (response.success) {
        message.success('提醒规则配置成功');
        setIsConfigModalVisible(false);
        configForm.resetFields();
      } else {
        message.error(response.message || '提醒规则配置失败');
      }
    } catch (error) {
      if (error.errorFields) return;
      console.error('配置提醒规则失败:', error);
      message.error('配置提醒规则失败');
    }
  };

  // 保存折叠面板中的提醒配置
  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      const values = await configForm.validateFields();
      const response = await maintenanceAPI.configMaintenanceReminder(values);
      if (response.success) {
        message.success('提醒配置保存成功');
        setReminderConfig({ ...reminderConfig, ...values });
      } else {
        message.error(response.message || '提醒配置保存失败');
      }
    } catch (error) {
      if (error.errorFields) return;
      console.error('保存提醒配置失败:', error);
      message.error('保存提醒配置失败');
    } finally {
      setConfigSaving(false);
    }
  };

  // 批量发送提醒
  const handleBatchSend = async () => {
    setBatchSendLoading(true);
    try {
      const response = await maintenanceAPI.sendMaintenanceReminder({
        reminder_ids: selectedRowKeys,
      });
      if (response.success) {
        message.success(`成功发送 ${selectedRowKeys.length} 条提醒`);
        setSelectedRowKeys([]);
        setBatchConfirmVisible(false);
        loadReminders();
      } else {
        message.error(response.message || '批量发送失败');
      }
    } catch (error) {
      console.error('批量发送失败:', error);
      message.error('批量发送失败');
    } finally {
      setBatchSendLoading(false);
    }
  };

  // 状态标签
  const statusTag = status => {
    switch (status) {
      case '已发送':
        return <Tag color="green" icon={<CheckCircleOutlined />}>已发送</Tag>;
      case '待发送':
        return <Tag color="blue" icon={<ExclamationCircleOutlined />}>待发送</Tag>;
      case '发送失败':
        return <Tag color="red">发送失败</Tag>;
      case '已查看':
        return <Tag color="cyan" icon={<EyeOutlined />}>已查看</Tag>;
      case '未查看':
        return <Tag color="default" icon={<EyeInvisibleOutlined />}>未查看</Tag>;
      default:
        return <Tag>{status || '-'}</Tag>;
    }
  };

  // 提醒类型标签
  const typeTag = type => {
    switch (type) {
      case 'system':
        return <Tag color="blue">系统通知</Tag>;
      case 'email':
        return <Tag color="green">邮件</Tag>;
      case 'sms':
        return <Tag color="orange">短信</Tag>;
      case 'overdue':
        return <Tag color="red">逾期提醒</Tag>;
      case 'expiring':
        return <Tag color="warning">即将到期</Tag>;
      default:
        return <Tag>{type || '-'}</Tag>;
    }
  };

  // 状态流程可视化
  const StatusFlow = ({ record }) => {
    const status = record.status;
    let currentStep = 0;
    if (status === '待发送') currentStep = 0;
    else if (status === '已发送') currentStep = 1;
    else if (status === '已查看') currentStep = 2;
    else if (status === '未查看') currentStep = 2;
    else if (status === '发送失败') currentStep = 1;

    const steps = [
      { title: '待发送', icon: <ExclamationCircleOutlined /> },
      { title: '已发送', icon: <SendOutlined /> },
    ];

    // 根据是否已查看添加第三步
    if (status === '已查看') {
      steps.push({ title: '已查看', icon: <EyeOutlined /> });
    } else if (status === '未查看') {
      steps.push({ title: '未查看', icon: <EyeInvisibleOutlined /> });
    }

    // 发送失败特殊处理
    if (status === '发送失败') {
      steps[1] = { title: '失败', icon: <ExclamationCircleOutlined /> };
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                color: idx <= currentStep
                  ? (status === '发送失败' && idx === 1 ? '#ff4d4f' : '#1890ff')
                  : '#d9d9d9',
                fontWeight: idx === currentStep ? 600 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              {step.icon}
              {step.title}
            </span>
            {idx < steps.length - 1 && (
              <span style={{ color: idx < currentStep ? '#1890ff' : '#d9d9d9', fontSize: 10 }}>→</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    getCheckboxProps: record => ({
      disabled: record.status !== '待发送',
    }),
  };

  // 列定义
  const columns = [
    {
      title: '提醒日期',
      dataIndex: 'reminder_date',
      key: 'reminder_date',
      width: 120,
      sorter: (a, b) => new Date(a.reminder_date) - new Date(b.reminder_date),
      defaultSortOrder: 'descend',
    },
    {
      title: '关联计划',
      dataIndex: 'plan_id',
      key: 'plan_id',
      width: 120,
      render: (planId, record) => {
        const plan = maintenancePlans.find(p => p.id === planId);
        return plan ? plan.plan_name : (planId || '-');
      },
    },
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 120,
      ellipsis: true,
    },
    {
      title: '提醒类型',
      dataIndex: 'reminder_type',
      key: 'reminder_type',
      width: 100,
      render: type => typeTag(type),
    },
    {
      title: '接收人',
      dataIndex: 'recipient',
      key: 'recipient',
      width: 120,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: status => statusTag(status),
    },
    {
      title: '状态流程',
      key: 'status_flow',
      width: 200,
      render: (_, record) => <StatusFlow record={record} />,
    },
    {
      title: '发送时间',
      dataIndex: 'sent_at',
      key: 'sent_at',
      width: 160,
      render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => { setDetailRecord(record); setDetailVisible(true); }}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>维护提醒管理</Title>

      {/* 增强统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="总提醒数" value={stats.total} prefix={<BellOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="待发送" value={stats.pending} styles={{ content: { color: '#1890ff' } }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="已发送" value={stats.sent} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col span={3}>
          <Card size="small">
            <Statistic title="发送失败" value={stats.failed} styles={{ content: { color: stats.failed > 0 ? '#ff4d4f' : '#52c41a' } }} />
          </Card>
        </Col>
        <Col span={3}>
          <Card size="small">
            <Statistic
              title="今日待发送"
              value={enhancedStats.todayPending}
              styles={{ content: { color: enhancedStats.todayPending > 0 ? '#fa8c16' : '#52c41a' } }}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card size="small">
            <Statistic
              title="发送成功率"
              value={enhancedStats.successRate}
              suffix="%"
              styles={{ content: { color: enhancedStats.successRate >= 80 ? '#52c41a' : enhancedStats.successRate >= 50 ? '#fa8c16' : '#ff4d4f' } }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card size="small">
            <Statistic
              title="平均提前天数"
              value={enhancedStats.avgDaysBefore}
              suffix="天"
              styles={{ content: { color: '#1890ff' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="status" label="状态">
            <Select placeholder="选择状态" style={{ width: 120 }} allowClear>
              <Option value="已发送">已发送</Option>
              <Option value="待发送">待发送</Option>
              <Option value="发送失败">发送失败</Option>
              <Option value="已查看">已查看</Option>
              <Option value="未查看">未查看</Option>
            </Select>
          </Form.Item>
          <Form.Item name="reminder_type" label="提醒类型">
            <Select placeholder="选择类型" style={{ width: 120 }} allowClear>
              <Option value="system">系统通知</Option>
              <Option value="email">邮件</Option>
              <Option value="sms">短信</Option>
            </Select>
          </Form.Item>
          <Form.Item name="dateRange" label="日期范围">
            <RangePicker style={{ width: 280 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              搜索
            </Button>
          </Form.Item>
          <Form.Item>
            <Button onClick={() => { searchForm.resetFields(); setSearchParams({}); }}>重置</Button>
          </Form.Item>
          <Form.Item>
            <Button icon={<ReloadOutlined />} onClick={loadReminders}>刷新</Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 提醒配置折叠面板 */}
      <Collapse
        style={{ marginBottom: 16 }}
        items={[
          {
            key: 'config',
            label: (
              <span>
                <SettingOutlined style={{ marginRight: 8 }} />
                提醒配置
                {reminderConfig && (
                  <Tag color={reminderConfig.enabled !== false ? 'green' : 'default'} style={{ marginLeft: 8 }}>
                    {reminderConfig.enabled !== false ? '已启用' : '已禁用'}
                  </Tag>
                )}
              </span>
            ),
            children: (
              <Form form={configForm} layout="vertical">
                <Row gutter={24}>
                  <Col span={8}>
                    <Form.Item
                      name="reminder_days_before"
                      label="提前几天提醒"
                      rules={[{ required: true, message: '请输入提前天数' }]}
                      initialValue={3}
                    >
                      <Space.Compact style={{ width: '100%' }}>
                        <InputNumber
                          placeholder="天数"
                          min={1}
                          max={90}
                          style={{ width: '100%' }}
                        />
                        <span style={{ display: 'flex', alignItems: 'center', padding: '0 11px', background: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 0 }}>天</span>
                      </Space.Compact>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="reminder_types"
                      label="提醒类型"
                      rules={[{ required: true, message: '请选择提醒类型' }]}
                      initialValue={['system']}
                    >
                      <Checkbox.Group
                        options={[
                          { value: 'system', label: '系统通知' },
                          { value: 'email', label: '邮件' },
                          { value: 'sms', label: '短信' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="enabled"
                      label="启用开关"
                      valuePropName="checked"
                      initialValue={true}
                    >
                      <Switch
                        checkedChildren="启用"
                        unCheckedChildren="禁用"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <div style={{ textAlign: 'right' }}>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={handleSaveConfig}
                    loading={configSaving}
                  >
                    保存配置
                  </Button>
                </div>
                {reminderConfig && (
                  <div style={{ marginTop: 12 }}>
                    <Alert
                      message={`当前配置：提前 ${reminderConfig.reminder_days_before ?? reminderConfig.reminder_days ?? '-'} 天提醒，提醒方式：${(reminderConfig.reminder_types || []).map(t => {
                        const map = { system: '系统通知', email: '邮件', sms: '短信' };
                        return map[t] || t;
                      }).join('、') || '未设置'}，${reminderConfig.enabled !== false ? '已启用' : '已禁用'}`}
                      type="info"
                      showIcon
                    />
                  </div>
                )}
              </Form>
            ),
          },
        ]}
      />

      {/* 操作按钮 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => { sendForm.resetFields(); setIsSendModalVisible(true); }}
          >
            手动发送提醒
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={() => { configForm.resetFields(); setIsConfigModalVisible(true); }}
          >
            配置提醒规则
          </Button>
          <Button
            type="dashed"
            icon={<ExclamationCircleOutlined />}
            onClick={handleCheckReminders}
            loading={checkLoading}
          >
            检查提醒
          </Button>
          {selectedRowKeys.length > 0 && (
            <Button
              type="primary"
              danger
              icon={<SendOutlined />}
              onClick={() => setBatchConfirmVisible(true)}
            >
              批量发送 ({selectedRowKeys.length})
            </Button>
          )}
        </Space>
      </Card>

      {/* 提醒列表 */}
      <Card>
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={reminders}
            loading={loading}
            rowKey="id"
            rowSelection={rowSelection}
            pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条记录` }}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
          ) : Array.isArray(reminders) && reminders.length > 0 ? (
            reminders.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.asset_name || record.asset_code}</span>
                  <Tag color={record.status === 'pending' ? 'orange' : record.status === 'sent' ? 'green' : 'default'}>
                    {record.status === 'pending' ? '待发送' : record.status === 'sent' ? '已发送' : record.status}
                  </Tag>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">资产编号</span>
                    <span className="mobile-card-value">{record.asset_code || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">提醒类型</span>
                    <span className="mobile-card-value">{record.reminder_type || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">提醒时间</span>
                    <span className="mobile-card-value">
                      {record.reminder_date ? dayjs(record.reminder_date).format('YYYY-MM-DD HH:mm') : '-'}
                    </span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">接收人</span>
                    <span className="mobile-card-value">{record.recipient || '-'}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
          )}
        </div>
      </Card>

      {/* 提醒详情 Drawer */}
      <Drawer
        title="提醒详情"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        styles={{ wrapper: { width: 500 } }}
      >
        {detailRecord && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="ID">{detailRecord.id}</Descriptions.Item>
            <Descriptions.Item label="提醒日期">{detailRecord.reminder_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="关联计划ID">{detailRecord.plan_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="资产编号">{detailRecord.asset_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="提醒类型">{typeTag(detailRecord.reminder_type)}</Descriptions.Item>
            <Descriptions.Item label="接收人">{detailRecord.recipient || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">{statusTag(detailRecord.status)}</Descriptions.Item>
            <Descriptions.Item label="状态流程"><StatusFlow record={detailRecord} /></Descriptions.Item>
            <Descriptions.Item label="发送时间">
              {detailRecord.sent_at ? dayjs(detailRecord.sent_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="消息内容">{detailRecord.message || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {detailRecord.created_at ? dayjs(detailRecord.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* 检查提醒结果 Modal */}
      <Modal
        title="检查提醒结果"
        open={checkModalVisible}
        onCancel={() => setCheckModalVisible(false)}
        footer={<Button onClick={() => setCheckModalVisible(false)}>关闭</Button>}
        styles={{ wrapper: { width: 700 } }}
      >
        {checkResult && (
          <div>
            <Alert
              message={checkResult.count > 0
                ? `发现 ${checkResult.count} 个需要提醒的维护计划`
                : '暂无需要提醒的维护计划'
              }
              type={checkResult.count > 0 ? 'warning' : 'success'}
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="检查时间">{checkResult.checkedAt}</Descriptions.Item>
              <Descriptions.Item label="发现提醒数">{checkResult.count}</Descriptions.Item>
            </Descriptions>
            {checkResult.reminders && checkResult.reminders.length > 0 && (
              <>
                <Divider titlePlacement="left" style={{ fontSize: 14 }}>提醒详情</Divider>
                <Table
                  size="small"
                  dataSource={checkResult.reminders}
                  rowKey="id"
                  pagination={false}
                  scroll={{ y: 300 }}
                  columns={[
                    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code', width: 120, render: v => v || '-' },
                    { title: '提醒类型', dataIndex: 'reminder_type', key: 'reminder_type', width: 100, render: v => typeTag(v) },
                    { title: '接收人', dataIndex: 'recipient', key: 'recipient', width: 100, render: v => v || '-' },
                    { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true, render: v => v || '-' },
                  ]}
                />
              </>
            )}
            {checkResult.message && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">{checkResult.message}</Text>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 批量发送确认 Modal */}
      <Modal
        title="批量发送确认"
        open={batchConfirmVisible}
        onOk={handleBatchSend}
        onCancel={() => setBatchConfirmVisible(false)}
        confirmLoading={batchSendLoading}
        okText="确认发送"
        cancelText="取消"
      >
        <Alert
          message={`即将发送 ${selectedRowKeys.length} 条提醒`}
          description="请确认以下选中的提醒均已核实，发送后不可撤回。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <div>
          <Text strong>选中的提醒ID：</Text>
          <Text>{selectedRowKeys.join(', ')}</Text>
        </div>
      </Modal>

      {/* 手动发送提醒模态框 */}
      <Modal
        title="手动发送提醒"
        open={isSendModalVisible}
        onOk={handleSendReminder}
        onCancel={() => { setIsSendModalVisible(false); sendForm.resetFields(); }}
        styles={{ wrapper: { width: 600 } }}
        destroyOnHidden
      >
        <Alert
          message="选择一个启用的维护计划，手动发送提醒通知给指定人员"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={sendForm} layout="vertical">
          <Form.Item
            name="plan_id"
            label="维护计划"
            rules={[{ required: true, message: '请选择维护计划' }]}
          >
            <Select placeholder="选择维护计划" showSearch optionFilterProp="children">
              {maintenancePlans.map(plan => (
                <Option key={plan.id} value={plan.id}>
                  {plan.plan_name} - {plan.asset_code} (下次: {plan.next_maintenance_date || '未设置'})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="reminder_type"
            label="提醒类型"
            rules={[{ required: true, message: '请选择提醒类型' }]}
          >
            <Select placeholder="选择提醒类型">
              <Option value="system">系统通知</Option>
              <Option value="email">邮件</Option>
              <Option value="sms">短信</Option>
            </Select>
          </Form.Item>
          <Form.Item name="recipient" label="接收人">
            <Input placeholder="请输入接收人（多个用逗号分隔）" />
          </Form.Item>
          <Form.Item name="message" label="自定义消息">
            <Input.TextArea rows={3} placeholder="留空则使用系统默认消息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 配置提醒规则模态框 */}
      <Modal
        title="配置提醒规则"
        open={isConfigModalVisible}
        onOk={handleConfigReminder}
        onCancel={() => { setIsConfigModalVisible(false); configForm.resetFields(); }}
        styles={{ wrapper: { width: 600 } }}
        destroyOnHidden
      >
        <Alert
          message="配置提醒规则后，系统将在维护计划到期前自动发送提醒"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={configForm} layout="vertical">
          <Form.Item
            name="plan_id"
            label="维护计划"
            rules={[{ required: true, message: '请选择维护计划' }]}
          >
            <Select placeholder="选择维护计划" showSearch optionFilterProp="children">
              {maintenancePlans.map(plan => (
                <Option key={plan.id} value={plan.id}>
                  {plan.plan_name} - {plan.asset_code}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="reminder_days"
                label="提前提醒天数"
                rules={[{ required: true, message: '请输入提前提醒天数' }]}
              >
                <InputNumber placeholder="天数" min={1} max={30} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="reminder_types"
                label="提醒方式"
                rules={[{ required: true, message: '请选择提醒方式' }]}
              >
                <Select
                  mode="multiple"
                  placeholder="选择提醒方式"
                  options={[
                    { value: 'system', label: '系统通知' },
                    { value: 'email', label: '邮件' },
                    { value: 'sms', label: '短信' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="recipient" label="提醒接收人">
            <Input placeholder="请输入提醒接收人（多个用逗号分隔）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MaintenanceReminderList;
