import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCan } from '../hooks';
import {
  Card,
  Typography,
  Table,
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  Modal,
  Tag,
  Space,
  Row,
  Col,
  InputNumber,
  message,
  Popconfirm,
  Collapse,
  Switch,
  Alert,
  Statistic,
  Drawer,
  Empty,
} from 'antd';

import {
  BellOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { warrantyAPI } from '../utils/api';
import dayjs from 'dayjs';
import useIsMobile from '../hooks/useIsMobile';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// 安全解析 JSON 字段
const safeParse = (value, defaultValue = []) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return defaultValue;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : defaultValue;
  } catch {
    return defaultValue;
  }
};

// 提醒类型颜色映射
const REMINDER_TYPE_COLOR = {
  到期提醒: 'orange',
  过保提醒: 'red',
  报修提醒: 'blue',
  续保提醒: 'cyan',
};

// 状态颜色映射
const STATUS_COLOR = {
  待发送: 'blue',
  已发送: 'green',
  已处理: 'cyan',
  已忽略: 'default',
};

// 提醒方式映射
const REMINDER_METHOD_MAP = {
  system: '系统通知',
  email: '邮件',
  sms: '短信',
};

const WarrantyReminderManagement = () => {
  const canDelete = useCan('maintenance', 'delete');
  const canEdit = useCan('maintenance', 'edit');
  const isMobile = useIsMobile();
  // ===== 提醒列表状态 =====
  const [reminders, setReminders] = useState([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersPagination, setRemindersPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [searchParams, setSearchParams] = useState({});
  const [searchForm] = Form.useForm();

  // 提醒表单 Modal
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderForm] = Form.useForm();
  const [editingReminder, setEditingReminder] = useState(null);
  const [reminderSaving, setReminderSaving] = useState(false);

  // ===== 提醒配置状态 =====
  const [configs, setConfigs] = useState([]);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configForm] = Form.useForm();
  const [editingConfig, setEditingConfig] = useState(null);
  const [configSaving, setConfigSaving] = useState(false);

  // ===== 到期检查状态 =====
  const [checkResult, setCheckResult] = useState(null);
  const [checkModalVisible, setCheckModalVisible] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);

  // ===== 统计数据状态 =====
  const [statistics, setStatistics] = useState({
    in_warranty_count: 0,
    out_warranty_count: 0,
    expiring_count: 0,
    total_contract_amount: 0,
  });

  // 提醒详情 Drawer
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // ===== 加载提醒列表 =====
  const loadReminders = useCallback(
    async (params = {}) => {
      setRemindersLoading(true);
      try {
        const response = await warrantyAPI.getReminders({
          page: params.page || remindersPagination.current,
          pageSize: params.pageSize || remindersPagination.pageSize,
          ...searchParams,
          ...params,
        });
        if (response.success || response.data) {
          const list = response.data || [];
          setReminders(list);
          setRemindersPagination(prev => ({
            ...prev,
            current: params.page || prev.current,
            pageSize: params.pageSize || prev.pageSize,
            total: response.pagination?.total ?? list.length,
          }));
        } else {
          message.error(response.message || '加载提醒列表失败');
        }
      } catch (error) {
        console.error('加载提醒列表失败:', error);
        message.error('网络错误，加载提醒列表失败');
      } finally {
        setRemindersLoading(false);
      }
    },
    [searchParams, remindersPagination.current, remindersPagination.pageSize]
  );

  // ===== 加载提醒配置列表 =====
  const loadConfigs = useCallback(async () => {
    setConfigsLoading(true);
    try {
      const response = await warrantyAPI.getReminderConfigs();
      if (response.success || response.data) {
        const list = response.data || response.items || response;
        setConfigs(Array.isArray(list) ? list : []);
      } else {
        message.error(response.message || '加载提醒配置失败');
      }
    } catch (error) {
      console.error('加载提醒配置失败:', error);
      message.error('网络错误，加载提醒配置失败');
    } finally {
      setConfigsLoading(false);
    }
  }, []);

  // ===== 加载统计数据 =====
  const loadStatistics = useCallback(async () => {
    try {
      const response = await warrantyAPI.getStatistics();
      if (response.success || response.data) {
        const data = response.data || response;
        setStatistics({
          in_warranty_count: data.in_warranty_count ?? data.inWarrantyCount ?? 0,
          out_warranty_count: data.out_warranty_count ?? data.outWarrantyCount ?? 0,
          expiring_count: data.expiring_count ?? data.expiringCount ?? 0,
          total_contract_amount: data.total_contract_amount ?? data.totalContractAmount ?? 0,
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, []);

  useEffect(() => {
    loadReminders({ page: 1 });
    loadConfigs();
    loadStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 提醒列表搜索 =====
  const handleSearch = values => {
    const params = { ...values };
    if (values.dateRange && values.dateRange.length === 2) {
      params.start_date = values.dateRange[0].format('YYYY-MM-DD');
      params.end_date = values.dateRange[1].format('YYYY-MM-DD');
    }
    delete params.dateRange;
    setSearchParams(params);
    loadReminders({ ...params, page: 1 });
  };

  const handleResetSearch = () => {
    searchForm.resetFields();
    setSearchParams({});
    loadReminders({ page: 1, status: undefined, reminder_type: undefined, start_date: undefined, end_date: undefined });
  };

  // ===== 提醒表单：新增/编辑 =====
  const handleOpenCreateReminder = () => {
    setEditingReminder(null);
    reminderForm.resetFields();
    reminderForm.setFieldsValue({
      reminder_type: '到期提醒',
      reminder_days_before: 30,
    });
    setReminderModalVisible(true);
  };

  const handleOpenEditReminder = record => {
    setEditingReminder(record);
    reminderForm.setFieldsValue({
      ...record,
      reminder_date: record.reminder_date ? dayjs(record.reminder_date) : undefined,
      expire_date: record.expire_date ? dayjs(record.expire_date) : undefined,
    });
    setReminderModalVisible(true);
  };

  const handleSaveReminder = async () => {
    try {
      const values = await reminderForm.validateFields();
      setReminderSaving(true);
      const payload = {
        ...values,
        reminder_date: values.reminder_date ? values.reminder_date.format('YYYY-MM-DD') : undefined,
        expire_date: values.expire_date ? values.expire_date.format('YYYY-MM-DD') : undefined,
      };
      let response;
      if (editingReminder) {
        response = await warrantyAPI.updateReminder(editingReminder.id, payload);
      } else {
        response = await warrantyAPI.createReminder(payload);
      }
      if (response.success || response.id || response.data) {
        message.success(editingReminder ? '提醒更新成功' : '提醒创建成功');
        setReminderModalVisible(false);
        reminderForm.resetFields();
        setEditingReminder(null);
        loadReminders();
        loadStatistics();
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      if (error.errorFields) return; // 表单校验错误
      console.error('保存提醒失败:', error);
      message.error('网络错误，保存失败');
    } finally {
      setReminderSaving(false);
    }
  };

  // ===== 删除提醒 =====
  const handleDeleteReminder = async id => {
    try {
      const response = await warrantyAPI.deleteReminder(id);
      if (response.success || response.status === 200 || response.data) {
        message.success('删除成功');
        loadReminders();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      console.error('删除提醒失败:', error);
      message.error('网络错误，删除失败');
    }
  };

  // ===== 标记已发送 =====
  const handleMarkAsSent = async record => {
    try {
      const response = await warrantyAPI.updateReminder(record.id, { status: '已发送' });
      if (response.success || response.id || response.data) {
        message.success('已标记为已发送');
        loadReminders();
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('标记已发送失败:', error);
      message.error('网络错误，操作失败');
    }
  };

  // ===== 配置表单：新增/编辑 =====
  const handleOpenCreateConfig = () => {
    setEditingConfig(null);
    configForm.resetFields();
    configForm.setFieldsValue({
      reminder_days_before: 30,
      reminder_dates: [],
      reminder_types: ['system'],
      enabled: true,
    });
    setConfigModalVisible(true);
  };

  const handleOpenEditConfig = record => {
    setEditingConfig(record);
    configForm.setFieldsValue({
      ...record,
      reminder_dates: safeParse(record.reminder_dates, []),
      reminder_types: safeParse(record.reminder_types, ['system']),
      enabled: record.enabled !== false,
    });
    setConfigModalVisible(true);
  };

  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields();
      setConfigSaving(true);
      const payload = {
        ...values,
        reminder_dates: JSON.stringify(values.reminder_dates || []),
        reminder_types: JSON.stringify(values.reminder_types || []),
        recipients: values.recipients || '',
        recipient_names: values.recipient_names || '',
      };
      let response;
      if (editingConfig) {
        response = await warrantyAPI.saveReminderConfig({ ...payload, id: editingConfig.id });
      } else {
        response = await warrantyAPI.saveReminderConfig(payload);
      }
      if (response.success || response.id || response.data) {
        message.success(editingConfig ? '配置更新成功' : '配置创建成功');
        setConfigModalVisible(false);
        configForm.resetFields();
        setEditingConfig(null);
        loadConfigs();
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      if (error.errorFields) return;
      console.error('保存配置失败:', error);
      message.error('网络错误，保存失败');
    } finally {
      setConfigSaving(false);
    }
  };

  // ===== 删除配置 =====
  const handleDeleteConfig = async id => {
    try {
      const response = await warrantyAPI.deleteReminderConfig(id);
      if (response.success || response.status === 200 || response.data) {
        message.success('删除成功');
        loadConfigs();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      console.error('删除配置失败:', error);
      message.error('网络错误，删除失败');
    }
  };

  // ===== 启用/禁用配置（Switch） =====
  const handleToggleConfigEnabled = async (record, checked) => {
    try {
      const response = await warrantyAPI.saveReminderConfig({
        id: record.id,
        enabled: checked,
        reminder_days_before: record.reminder_days_before,
        reminder_dates: record.reminder_dates,
        recipients: record.recipients || '',
        recipient_names: record.recipient_names || '',
        reminder_types: record.reminder_types,
        asset_code: record.asset_code || '',
      });
      if (response.success || response.id || response.data) {
        message.success(checked ? '已启用' : '已禁用');
        loadConfigs();
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('切换配置状态失败:', error);
      message.error('网络错误，操作失败');
    }
  };

  // ===== 到期检查 =====
  const handleCheckExpiring = async () => {
    setCheckLoading(true);
    try {
      const response = await warrantyAPI.checkExpiringWarranties();
      if (response.success || response.data) {
        const data = response.data || response;
        setCheckResult({
          warranty_info_expiring: data.warranty_info_expiring || data.warrantyInfoExpiring || [],
          assets_expiring: data.assets_expiring || data.assetsExpiring || [],
          count:
            data.count ??
            (((data.warranty_info_expiring?.length || 0) + (data.assets_expiring?.length || 0)) ||
            (Array.isArray(data) ? data.length : 0)),
          message: data.message || '',
          checkedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        });
        setCheckModalVisible(true);
        loadReminders();
        loadStatistics();
      } else {
        message.error(response.message || '检查失败');
      }
    } catch (error) {
      console.error('检查到期保修失败:', error);
      message.error('网络错误，检查失败');
    } finally {
      setCheckLoading(false);
    }
  };

  // ===== 渲染提醒类型 Tag =====
  const renderReminderTypeTag = type => {
    if (!type) return <Tag>-</Tag>;
    const color = REMINDER_TYPE_COLOR[type] || 'default';
    return <Tag color={color}>{type}</Tag>;
  };

  // ===== 渲染状态 Tag =====
  const renderStatusTag = status => {
    if (!status) return <Tag>-</Tag>;
    const color = STATUS_COLOR[status] || 'default';
    return <Tag color={color}>{status}</Tag>;
  };

  // ===== 提醒列表列定义 =====
  const reminderColumns = [
    {
      title: '提醒日期',
      dataIndex: 'reminder_date',
      key: 'reminder_date',
      width: 120,
      sorter: (a, b) => new Date(a.reminder_date) - new Date(b.reminder_date),
      defaultSortOrder: 'ascend',
      render: v => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '到期日期',
      dataIndex: 'expire_date',
      key: 'expire_date',
      width: 120,
      render: v => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
      ellipsis: true,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 160,
      ellipsis: true,
      render: v => v || '-',
    },
    {
      title: '提醒类型',
      dataIndex: 'reminder_type',
      key: 'reminder_type',
      width: 100,
      render: type => renderReminderTypeTag(type),
    },
    {
      title: '提醒人',
      dataIndex: 'recipient_names',
      key: 'recipient_names',
      width: 150,
      ellipsis: true,
      render: v => v || '-',
    },
    {
      title: '提前天数',
      dataIndex: 'reminder_days_before',
      key: 'reminder_days_before',
      width: 90,
      render: v => (v != null ? `${v} 天` : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: status => renderStatusTag(status),
    },
    {
      title: '发送时间',
      dataIndex: 'sent_at',
      key: 'sent_at',
      width: 160,
      render: v => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditReminder(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此提醒吗？"
            onConfirm={() => handleDeleteReminder(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
          {record.status === '待发送' && (
            <Popconfirm
              title="确定标记为已发送吗？"
              onConfirm={() => handleMarkAsSent(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" icon={<SendOutlined />}>
                标记已发送
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // ===== 配置列表列定义 =====
  const configColumns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
      render: v => v || <Tag color="blue">全局配置</Tag>,
    },
    {
      title: '提前天数',
      dataIndex: 'reminder_days_before',
      key: 'reminder_days_before',
      width: 100,
      render: v => (v != null ? `${v} 天` : '-'),
    },
    {
      title: '提醒日期',
      dataIndex: 'reminder_dates',
      key: 'reminder_dates',
      width: 200,
      render: value => {
        const dates = safeParse(value, []);
        if (dates.length === 0) return '-';
        return (
          <Space size={[4, 4]} wrap>
            {dates.map((d, idx) => (
              <Tag key={idx} color="blue">
                {d}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '提醒人',
      dataIndex: 'recipient_names',
      key: 'recipient_names',
      width: 160,
      ellipsis: true,
      render: v => v || '-',
    },
    {
      title: '提醒方式',
      dataIndex: 'reminder_types',
      key: 'reminder_types',
      width: 180,
      render: value => {
        const types = safeParse(value, []);
        if (types.length === 0) return '-';
        return (
          <Space size={[4, 4]} wrap>
            {types.map((t, idx) => (
              <Tag key={idx}>{REMINDER_METHOD_MAP[t] || t}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled, record) => (
        <Switch
          checked={enabled !== false}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          onChange={checked => handleToggleConfigEnabled(record, checked)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditConfig(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此配置吗？"
            onConfirm={() => handleDeleteConfig(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ===== 到期检查结果表格列 =====
  const expiryCheckColumns = [
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code', width: 140, ellipsis: true },
    { title: '资产名称', dataIndex: 'asset_name', key: 'asset_name', width: 160, ellipsis: true, render: v => v || '-' },
    {
      title: '到期日期',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 120,
      render: v => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '剩余天数',
      dataIndex: 'days_until_expire',
      key: 'days_until_expire',
      width: 100,
      render: v => {
        if (v == null) return '-';
        const num = Number(v);
        if (!Number.isFinite(num)) return v;
        return <Tag color={num < 0 ? 'red' : num <= 30 ? 'orange' : 'green'}>{num < 0 ? `已过 ${Math.abs(num)} 天` : `${num} 天`}</Tag>;
      },
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 140,
      ellipsis: true,
      render: v => v || '-',
    },
  ];

  // ===== 统计卡片 =====
  const statisticsCards = useMemo(() => {
    return [
      {
        title: '在保数量',
        value: statistics.in_warranty_count,
        icon: <SafetyCertificateOutlined />,
        color: '#52c41a',
      },
      {
        title: '过保数量',
        value: statistics.out_warranty_count,
        icon: <ExclamationCircleOutlined />,
        color: '#ff4d4f',
      },
      {
        title: '即将到期(30天内)',
        value: statistics.expiring_count,
        icon: <BellOutlined />,
        color: '#fa8c16',
      },
      {
        title: '合同总额',
        value: statistics.total_contract_amount,
        icon: <AuditOutlined />,
        color: '#1890ff',
        prefix: '¥',
        precision: 2,
      },
    ];
  }, [statistics]);

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>保修提醒管理</Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {statisticsCards.map((card, idx) => (
          <Col xs={12} sm={6} key={idx}>
            <Card size="small">
              <Statistic
                title={card.title}
                value={card.value}
                prefix={card.prefix || card.icon}
                styles={{ content: { color: card.color } }}
                precision={card.precision}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 操作按钮 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: '100%' }} orientation={isMobile ? 'vertical' : 'horizontal'}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreateReminder}
            block={isMobile}
          >
            新增提醒
          </Button>
          <Button
            type="dashed"
            icon={<ExclamationCircleOutlined />}
            onClick={handleCheckExpiring}
            loading={checkLoading}
            block={isMobile}
          >
            检查到期保修
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadReminders();
              loadStatistics();
            }}
            block={isMobile}
          >
            刷新
          </Button>
        </Space>
      </Card>

      {/* 搜索栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout={isMobile ? 'vertical' : 'inline'} onFinish={handleSearch}>
          <Form.Item name="status" label="状态">
            <Select placeholder="选择状态" style={{ width: isMobile ? '100%' : 120 }} allowClear>
              <Option value="待发送">待发送</Option>
              <Option value="已发送">已发送</Option>
              <Option value="已处理">已处理</Option>
              <Option value="已忽略">已忽略</Option>
            </Select>
          </Form.Item>
          <Form.Item name="reminder_type" label="提醒类型">
            <Select placeholder="选择类型" style={{ width: isMobile ? '100%' : 120 }} allowClear>
              <Option value="到期提醒">到期提醒</Option>
              <Option value="过保提醒">过保提醒</Option>
              <Option value="报修提醒">报修提醒</Option>
              <Option value="续保提醒">续保提醒</Option>
            </Select>
          </Form.Item>
          <Form.Item name="dateRange" label="日期范围">
            <RangePicker style={{ width: isMobile ? '100%' : 280 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} block={isMobile}>
              搜索
            </Button>
          </Form.Item>
          <Form.Item>
            <Button onClick={handleResetSearch} block={isMobile}>重置</Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 保修提醒列表 */}
      <Card title="保修提醒列表" style={{ marginBottom: 16 }}>
        <div className="hide-on-mobile">
          <Table
            columns={reminderColumns}
            dataSource={reminders}
            loading={remindersLoading}
            rowKey="id"
            scroll={{ x: 1400 }}
            pagination={{
              current: remindersPagination.current,
              pageSize: remindersPagination.pageSize,
              total: remindersPagination.total,
              showSizeChanger: true,
              showTotal: t => `共 ${t} 条记录`,
              onChange: (page, pageSize) => loadReminders({ page, pageSize }),
            }}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {remindersLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(reminders) && reminders.length > 0 ? (
            reminders.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.asset_name || record.asset_code || '-'}</span>
                  {renderStatusTag(record.status)}
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">资产编号</span>
                    <span className="mobile-card-value">{record.asset_code || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">提醒类型</span>
                    <span className="mobile-card-value">{renderReminderTypeTag(record.reminder_type)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">提醒日期</span>
                    <span className="mobile-card-value">{record.reminder_date ? dayjs(record.reminder_date).format('YYYY-MM-DD') : '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">到期日期</span>
                    <span className="mobile-card-value">{record.expire_date ? dayjs(record.expire_date).format('YYYY-MM-DD') : '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">提醒人</span>
                    <span className="mobile-card-value">{record.recipient_names || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">提前天数</span>
                    <span className="mobile-card-value">{record.reminder_days_before != null ? `${record.reminder_days_before} 天` : '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">发送时间</span>
                    <span className="mobile-card-value">{record.sent_at ? dayjs(record.sent_at).format('YYYY-MM-DD HH:mm') : '-'}</span>
                  </div>
                </div>
                <div className="mobile-card-actions">
                  <Button type="primary" size="small" block onClick={() => handleOpenEditReminder(record)}>
                    编辑
                  </Button>
                  <Popconfirm
                    title="确定删除此提醒吗？"
                    onConfirm={() => handleDeleteReminder(record.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button type="primary" size="small" danger block>
                      删除
                    </Button>
                  </Popconfirm>
                  {record.status === '待发送' && (
                    <Popconfirm
                      title="确定标记为已发送吗？"
                      onConfirm={() => handleMarkAsSent(record)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button size="small" block icon={<SendOutlined />}>
                        标记已发送
                      </Button>
                    </Popconfirm>
                  )}
                </div>
              </div>
            ))
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>

      {/* 提醒配置 Collapse */}
      <Collapse
        style={{ marginBottom: 16 }}
        items={[
          {
            key: 'config',
            label: (
              <span>
                <SettingOutlined style={{ marginRight: 8 }} />
                提醒配置
              </span>
            ),
            children: (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleOpenCreateConfig}
                    block={isMobile}
                  >
                    新增配置
                  </Button>
                </div>
                <div className="hide-on-mobile">
                  <Table
                    columns={configColumns}
                    dataSource={configs}
                    loading={configsLoading}
                    rowKey="id"
                    scroll={{ x: 1000 }}
                    pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条记录` }}
                  />
                </div>
                <div className="mobile-table-cards show-on-mobile">
                  {configsLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                  ) : Array.isArray(configs) && configs.length > 0 ? (
                    configs.map(record => (
                      <div key={record.id || `${record.asset_code}_${record.reminder_days_before}`} className="mobile-card-item">
                        <div className="mobile-card-header">
                          <span className="mobile-card-title">{record.asset_code || '全局配置'}</span>
                          <Tag color={record.enabled !== false ? 'green' : 'default'}>
                            {record.enabled !== false ? '启用' : '禁用'}
                          </Tag>
                        </div>
                        <div className="mobile-card-body">
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">提前天数</span>
                            <span className="mobile-card-value">{record.reminder_days_before != null ? `${record.reminder_days_before} 天` : '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">提醒日期</span>
                            <span className="mobile-card-value">
                              {(() => {
                                const dates = safeParse(record.reminder_dates, []);
                                if (dates.length === 0) return '-';
                                return dates.join('、');
                              })()}
                            </span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">提醒人</span>
                            <span className="mobile-card-value">{record.recipient_names || '-'}</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">提醒方式</span>
                            <span className="mobile-card-value">
                              {(() => {
                                const types = safeParse(record.reminder_types, []);
                                if (types.length === 0) return '-';
                                return types.map(t => REMINDER_METHOD_MAP[t] || t).join('、');
                              })()}
                            </span>
                          </div>
                        </div>
                        <div className="mobile-card-actions">
                          <Switch
                            checked={record.enabled !== false}
                            checkedChildren="启用"
                            unCheckedChildren="禁用"
                            onChange={checked => handleToggleConfigEnabled(record, checked)}
                          />
                          <Button type="primary" size="small" block onClick={() => handleOpenEditConfig(record)}>
                            编辑
                          </Button>
                          <Popconfirm
                            title="确定删除此配置吗？"
                            onConfirm={() => handleDeleteConfig(record.id)}
                            okText="确定"
                            cancelText="取消"
                          >
                            <Button type="primary" size="small" danger block>
                              删除
                            </Button>
                          </Popconfirm>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty description="暂无数据" />
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* 提醒新增/编辑 Modal */}
      <Modal
        title={editingReminder ? '编辑提醒' : '新增提醒'}
        open={reminderModalVisible}
        onOk={handleSaveReminder}
        onCancel={() => {
          setReminderModalVisible(false);
          reminderForm.resetFields();
          setEditingReminder(null);
        }}
        confirmLoading={reminderSaving}
        styles={{ wrapper: { width: 600 } }}
        destroyOnHidden
      >
        <Form form={reminderForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item
                name="asset_code"
                label="资产编号"
                rules={[{ required: true, message: '请输入资产编号' }]}
              >
                <Input placeholder="请输入资产编号" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="reminder_type" label="提醒类型">
                <Select placeholder="选择提醒类型">
                  <Option value="到期提醒">到期提醒</Option>
                  <Option value="过保提醒">过保提醒</Option>
                  <Option value="报修提醒">报修提醒</Option>
                  <Option value="续保提醒">续保提醒</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item name="warranty_info_id" label="保修信息ID（可选）">
                <InputNumber placeholder="保修信息ID" style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="contract_id" label="合同ID（可选）">
                <InputNumber placeholder="合同ID" style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item
                name="reminder_date"
                label="提醒日期"
                rules={[{ required: true, message: '请选择提醒日期' }]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="选择提醒日期" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="expire_date" label="到期日期">
                <DatePicker style={{ width: '100%' }} placeholder="选择到期日期" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item name="reminder_days_before" label="提前天数">
                <Space.Compact style={{ width: '100%' }}>
                  <InputNumber
                    placeholder="提前天数"
                    min={0}
                    max={365}
                    style={{ width: '100%' }}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 11px', background: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 0 }}>天</span>
                </Space.Compact>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="recipients" label="提醒人ID（逗号分隔）">
            <Input placeholder="设置提醒人，如: 1,2,3 或 张三,李四" />
          </Form.Item>
          <Form.Item name="recipient_names" label="提醒人姓名（逗号分隔）">
            <Input placeholder="设置提醒人显示名称，如: 张三,李四" />
          </Form.Item>
          <Form.Item name="message" label="提醒消息">
            <Input.TextArea rows={3} placeholder="自定义提醒消息内容" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 配置新增/编辑 Modal */}
      <Modal
        title={editingConfig ? '编辑配置' : '新增配置'}
        open={configModalVisible}
        onOk={handleSaveConfig}
        onCancel={() => {
          setConfigModalVisible(false);
          configForm.resetFields();
          setEditingConfig(null);
        }}
        confirmLoading={configSaving}
        styles={{ wrapper: { width: 600 } }}
        destroyOnHidden
      >
        <Form form={configForm} layout="vertical">
          <Form.Item
            name="asset_code"
            label="资产编号"
            extra="留空则为全局配置"
          >
            <Input placeholder="输入资产编号（留空为全局配置）" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item
                name="reminder_days_before"
                label="提前天数"
                rules={[{ required: true, message: '请输入提前天数' }]}
              >
                <Space.Compact style={{ width: '100%' }}>
                  <InputNumber
                    placeholder="提前天数"
                    min={1}
                    max={365}
                    style={{ width: '100%' }}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 11px', background: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 0 }}>天</span>
                </Space.Compact>
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="enabled" label="启用状态" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reminder_dates" label="提醒日期">
            <Select
              mode="tags"
              placeholder="输入提醒日期，如 到期前30天、每月1号"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="recipients" label="提醒人ID（逗号分隔）">
            <Input placeholder="设置提醒人，如: 1,2,3" />
          </Form.Item>
          <Form.Item name="recipient_names" label="提醒人姓名（逗号分隔）">
            <Input placeholder="设置提醒人显示名称，如: 张三,李四" />
          </Form.Item>
          <Form.Item name="reminder_types" label="提醒方式">
            <Select
              mode="multiple"
              placeholder="选择提醒方式"
              style={{ width: '100%' }}
            >
              <Option value="system">系统通知</Option>
              <Option value="email">邮件</Option>
              <Option value="sms">短信</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 到期检查结果 Modal */}
      <Modal
        title="到期检查结果"
        open={checkModalVisible}
        onCancel={() => setCheckModalVisible(false)}
        footer={<Button onClick={() => setCheckModalVisible(false)} block={isMobile}>关闭</Button>}
        styles={{ wrapper: { width: 600 } }}
      >
        {checkResult && (
          <div>
            <Alert title={
                checkResult.count > 0
                  ? `发现 ${checkResult.count} 个到期/即将到期的保修`
                  : '暂无到期或即将到期的保修'
              }
              type={checkResult.count > 0 ? 'warning' : 'success'}
              showIcon
              style={{ marginBottom: 16 }}
            />
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">检查时间：{checkResult.checkedAt}</Text>
            </div>

            {checkResult.warranty_info_expiring.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <Title level={5}>保修信息到期</Title>
                <div className="hide-on-mobile">
                  <Table
                    size="small"
                    dataSource={checkResult.warranty_info_expiring}
                    columns={expiryCheckColumns}
                    rowKey="id"
                    pagination={false}
                    scroll={{ y: 300 }}
                  />
                </div>
                <div className="mobile-table-cards show-on-mobile">
                  {checkResult.warranty_info_expiring.map((record, idx) => (
                    <div key={record.id || record.asset_code || idx} className="mobile-card-item">
                      <div className="mobile-card-header">
                        <span className="mobile-card-title">{record.asset_name || record.asset_code || '-'}</span>
                        {(() => {
                          const v = record.days_until_expire;
                          if (v == null) return <Tag>-</Tag>;
                          const num = Number(v);
                          if (!Number.isFinite(num)) return <Tag>{v}</Tag>;
                          return (
                            <Tag color={num < 0 ? 'red' : num <= 30 ? 'orange' : 'green'}>
                              {num < 0 ? `已过 ${Math.abs(num)} 天` : `${num} 天`}
                            </Tag>
                          );
                        })()}
                      </div>
                      <div className="mobile-card-body">
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">资产编号</span>
                          <span className="mobile-card-value">{record.asset_code || '-'}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">到期日期</span>
                          <span className="mobile-card-value">{record.end_date ? dayjs(record.end_date).format('YYYY-MM-DD') : '-'}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">供应商</span>
                          <span className="mobile-card-value">{record.supplier_name || '-'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {checkResult.assets_expiring.length > 0 && (
              <div>
                <Title level={5}>资产保修到期</Title>
                <div className="hide-on-mobile">
                  <Table
                    size="small"
                    dataSource={checkResult.assets_expiring}
                    columns={expiryCheckColumns}
                    rowKey="id"
                    pagination={false}
                    scroll={{ y: 300 }}
                  />
                </div>
                <div className="mobile-table-cards show-on-mobile">
                  {checkResult.assets_expiring.map((record, idx) => (
                    <div key={record.id || record.asset_code || idx} className="mobile-card-item">
                      <div className="mobile-card-header">
                        <span className="mobile-card-title">{record.asset_name || record.asset_code || '-'}</span>
                        {(() => {
                          const v = record.days_until_expire;
                          if (v == null) return <Tag>-</Tag>;
                          const num = Number(v);
                          if (!Number.isFinite(num)) return <Tag>{v}</Tag>;
                          return (
                            <Tag color={num < 0 ? 'red' : num <= 30 ? 'orange' : 'green'}>
                              {num < 0 ? `已过 ${Math.abs(num)} 天` : `${num} 天`}
                            </Tag>
                          );
                        })()}
                      </div>
                      <div className="mobile-card-body">
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">资产编号</span>
                          <span className="mobile-card-value">{record.asset_code || '-'}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">到期日期</span>
                          <span className="mobile-card-value">{record.end_date ? dayjs(record.end_date).format('YYYY-MM-DD') : '-'}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">供应商</span>
                          <span className="mobile-card-value">{record.supplier_name || '-'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {checkResult.warranty_info_expiring.length === 0 &&
              checkResult.assets_expiring.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  暂无到期数据
                </div>
              )}

            {checkResult.message && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">{checkResult.message}</Text>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 提醒详情 Drawer */}
      <Drawer
        title="提醒详情"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        styles={{ wrapper: { width: 600 } }}
      >
        {detailRecord && (
          <div>
            <p>
              <Text strong>提醒日期：</Text>
              <Text>{detailRecord.reminder_date ? dayjs(detailRecord.reminder_date).format('YYYY-MM-DD') : '-'}</Text>
            </p>
            <p>
              <Text strong>到期日期：</Text>
              <Text>{detailRecord.expire_date ? dayjs(detailRecord.expire_date).format('YYYY-MM-DD') : '-'}</Text>
            </p>
            <p>
              <Text strong>资产编号：</Text>
              <Text>{detailRecord.asset_code || '-'}</Text>
            </p>
            <p>
              <Text strong>资产名称：</Text>
              <Text>{detailRecord.asset_name || '-'}</Text>
            </p>
            <p>
              <Text strong>提醒类型：</Text>
              {renderReminderTypeTag(detailRecord.reminder_type)}
            </p>
            <p>
              <Text strong>提醒人：</Text>
              <Text>{detailRecord.recipient_names || '-'}</Text>
            </p>
            <p>
              <Text strong>状态：</Text>
              {renderStatusTag(detailRecord.status)}
            </p>
            <p>
              <Text strong>消息内容：</Text>
              <Text>{detailRecord.message || '-'}</Text>
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default WarrantyReminderManagement;
