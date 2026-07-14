/**
 * 通知配置管理
 * 包含通知规则、通知模板、发送记录三个 Tab
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Tabs, Table, Tag, Button, Space, Form, Input, Select, Switch,
  Modal, message, Popconfirm, DatePicker, Row, Col, Statistic, Badge,
  Tooltip, Divider, Alert, Empty, InputNumber
} from 'antd';
import {
  BellOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, SendOutlined, EyeOutlined, ExclamationCircleOutlined,
  NotificationOutlined, FileTextOutlined, HistoryOutlined
} from '@ant-design/icons';
import { notificationAPI, userAPI, departmentsAPI } from '../utils/api';
import dayjs from 'dayjs';
import { useIsMobile } from '../hooks';

const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const CHANNEL_COLORS = {
  feishu: 'blue',
  email: 'green',
  socket: 'purple',
};

const STATUS_COLORS = {
  success: 'success',
  failed: 'error',
};

export default function NotificationManagement() {
  const [activeTab, setActiveTab] = useState('rules');
  const isMobile = useIsMobile();

  return (
    <div style={{ padding: isMobile ? 12 : 24 }}>
      <Card
        title={
          <Space>
            <BellOutlined />
            <span>通知配置管理</span>
          </Space>
        }
        bodyStyle={{ padding: isMobile ? 12 : 24 }}
      >
        <Alert
          message="使用说明"
          description="先创建通知模板，再创建通知规则并绑定模板。规则可按流程类型、事件、节点配置，接收人支持按角色、部门、用户、流程节点动态解析。所有通知发送记录可在「发送记录」Tab 追踪。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          destroyOnHidden
          items={[
            {
              key: 'rules',
              label: (
                <span>
                  <NotificationOutlined /> 通知规则
                </span>
              ),
              children: <NotificationRules />,
            },
            {
              key: 'templates',
              label: (
                <span>
                  <FileTextOutlined /> 通知模板
                </span>
              ),
              children: <NotificationTemplates />,
            },
            {
              key: 'logs',
              label: (
                <span>
                  <HistoryOutlined /> 发送记录
                </span>
              ),
              children: <NotificationLogs />,
            },
          ]}
        />
      </Card>
    </div>
  );
}

/* ===================== 通知规则 ===================== */

function NotificationRules() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [metadata, setMetadata] = useState({
    process_types: [],
    events_by_process: {},
    recipient_types: [],
    node_recipient_options: [],
    channels: [],
  });
  const [templates, setTemplates] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState({ open: false, record: null });
  const [testModal, setTestModal] = useState({ open: false, record: null });
  const [filters, setFilters] = useState({});
  const isMobile = useIsMobile();

  const fetchMetadata = useCallback(async () => {
    try {
      const res = await notificationAPI.getMetadata();
      if (res.success) setMetadata(res.data);
    } catch (e) { /* ignore */ }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await notificationAPI.getTemplates({ pageSize: 1000 });
      if (res.success) setTemplates(res.data.list || []);
    } catch (e) { /* ignore */ }
  }, []);

  const fetchEnums = useCallback(async () => {
    try {
      const [rolesRes, deptsRes, usersRes] = await Promise.all([
        userAPI.getRoles(),
        departmentsAPI.getDepartments(),
        userAPI.getUsers(),
      ]);
      if (rolesRes.success) setRoles(rolesRes.data || []);
      if (deptsRes.success) setDepartments(deptsRes.data?.list || []);
      if (usersRes.success) setUsers(usersRes.data?.list || usersRes.data || []);
    } catch (e) { /* ignore */ }
  }, []);

  const fetchData = useCallback(async (page = pagination.current, pageSize = pagination.pageSize) => {
    try {
      setLoading(true);
      const res = await notificationAPI.getRules({
        ...filters,
        page,
        pageSize,
      });
      if (res.success) {
        setData(res.data.list || []);
        setPagination({
          current: res.data.pagination.page,
          pageSize: res.data.pagination.pageSize,
          total: res.data.pagination.total,
        });
      }
    } catch (e) {
      message.error('加载规则失败');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.current, pagination.pageSize]);

  useEffect(() => {
    fetchMetadata();
    fetchTemplates();
    fetchEnums();
  }, [fetchMetadata, fetchTemplates, fetchEnums]);

  useEffect(() => {
    fetchData(1);
  }, [filters]);

  useEffect(() => {
    fetchData(pagination.current, pagination.pageSize);
  }, [pagination.current, pagination.pageSize]);

  const handleDelete = async (id) => {
    try {
      await notificationAPI.deleteRule(id);
      message.success('删除成功');
      fetchData();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleTest = (record) => {
    setTestModal({ open: true, record });
  };

  const columns = [
    { title: '规则名称', dataIndex: 'rule_name', key: 'rule_name' },
    {
      title: '流程类型',
      dataIndex: 'process_type',
      key: 'process_type',
      render: (v) => metadata.process_types.find(p => p.code === v)?.name || v,
    },
    { title: '事件', dataIndex: 'event_code', key: 'event_code' },
    { title: '节点', dataIndex: 'node_code', key: 'node_code', render: v => v || '-' },
    {
      title: '模板',
      key: 'template',
      render: (_, record) => `${record.template_name || record.template_code || record.template_id}`,
    },
    {
      title: '渠道',
      key: 'channel',
      render: (_, record) => <Tag color={CHANNEL_COLORS[record.channel]}>{record.channel}</Tag>,
    },
    {
      title: '接收人',
      key: 'recipients',
      render: (_, record) => (
        <span>
          {record.recipients?.map((r, i) => (
            <Tag key={i} size="small">
              {metadata.recipient_types.find(t => t.code === r.recipient_type)?.name || r.recipient_type}
            </Tag>
          ))}
        </span>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v) => <Switch checked={v === 1} disabled size="small" />,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => setModal({ open: true, record })}>编辑</Button>
          <Button size="small" icon={<SendOutlined />} onClick={() => handleTest(record)}>测试</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" icon={<DeleteOutlined />} danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Input.Search
            placeholder="搜索规则名称/事件"
            allowClear
            onSearch={(v) => setFilters(prev => ({ ...prev, keyword: v }))}
          />
        </Col>
        <Col xs={24} md={16} style={{ textAlign: isMobile ? 'left' : 'right' }}>
          <Space>
            <Select
              placeholder="流程类型"
              allowClear
              style={{ width: 140 }}
              onChange={(v) => setFilters(prev => ({ ...prev, processType: v }))}
            >
              {metadata.process_types.map(p => <Option key={p.code} value={p.code}>{p.name}</Option>)}
            </Select>
            <Select
              placeholder="启用状态"
              allowClear
              style={{ width: 120 }}
              onChange={(v) => setFilters(prev => ({ ...prev, enabled: v }))}
            >
              <Option value="true">启用</Option>
              <Option value="false">禁用</Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={() => { setFilters({}); fetchData(1); }}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ open: true, record: null })}>新建规则</Button>
          </Space>
        </Col>
      </Row>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={(p) => setPagination({ ...pagination, current: p.current, pageSize: p.pageSize })}
        size="small"
        scroll={{ x: isMobile ? 800 : 'max-content' }}
      />
      <RuleModal
        open={modal.open}
        record={modal.record}
        metadata={metadata}
        templates={templates}
        roles={roles}
        departments={departments}
        users={users}
        onClose={() => setModal({ open: false, record: null })}
        onSuccess={() => { setModal({ open: false, record: null }); fetchData(); }}
      />
      <TestModal
        open={testModal.open}
        record={testModal.record}
        onClose={() => setTestModal({ open: false, record: null })}
      />
    </div>
  );
}

function RuleModal({ open, record, metadata, templates, roles, departments, users, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [processType, setProcessType] = useState(record?.process_type);

  useEffect(() => {
    if (open) {
      if (record) {
        setProcessType(record.process_type);
        form.setFieldsValue({
          ...record,
          recipients: record.recipients || [],
        });
      } else {
        setProcessType(undefined);
        form.resetFields();
        form.setFieldsValue({ enabled: true, priority: 0, recipients: [] });
      }
    }
  }, [open, record, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const payload = {
        ...values,
        enabled: values.enabled ? 1 : 0,
      };
      if (record) {
        await notificationAPI.updateRule(record.id, payload);
      } else {
        await notificationAPI.createRule(payload);
      }
      message.success('保存成功');
      onSuccess();
    } catch (e) {
      if (e.errorFields) return;
      message.error('保存失败: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  const eventOptions = processType ? (metadata.events_by_process[processType] || []) : [];

  return (
    <Modal
      title={record ? '编辑通知规则' : '新建通知规则'}
      open={open}
      onCancel={onClose}
      width={720}
      onOk={handleSubmit}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="rule_name" label="规则名称" rules={[{ required: true }]}>
              <Input placeholder="例如：维修申请审批通过通知工程师" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="process_type" label="流程类型" rules={[{ required: true }]}>
              <Select placeholder="选择流程类型" onChange={setProcessType}>
                {metadata.process_types.map(p => <Option key={p.code} value={p.code}>{p.name}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="event_code" label="事件" rules={[{ required: true }]}>
              <Select placeholder="选择事件" showSearch disabled={!processType}>
                {eventOptions.map(e => <Option key={e} value={e}>{e}</Option>)}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="node_code" label="流程节点（可选）">
              <Input placeholder="例如：approved" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="template_id" label="通知模板" rules={[{ required: true }]}>
              <Select placeholder="选择模板" showSearch>
                {templates.map(t => <Option key={t.id} value={t.id}>{t.name} ({t.channel})</Option>)}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="priority" label="优先级">
          <InputNumber style={{ width: '100%' }} placeholder="数字越大越优先" />
        </Form.Item>
        <Form.Item name="trigger_condition" label="触发条件（JSON，可选）">
          <TextArea rows={3} placeholder='{"fault_level": {"__in": ["紧急", "严重"]}}' />
        </Form.Item>
        <Form.Item label="接收人配置">
          <Form.List name="recipients">
            {(fields, { add, remove }) => (
              <div>
                {fields.map(field => (
                  <Row key={field.key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={6}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'recipient_type']}
                        rules={[{ required: true }]}
                        noStyle
                      >
                        <Select placeholder="类型">
                          {metadata.recipient_types.map(t => <Option key={t.code} value={t.code}>{t.name}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'recipient_value']}
                        rules={[{ required: true }]}
                        noStyle
                      >
                        <RecipientValueSelect
                          metadata={metadata}
                          roles={roles}
                          departments={departments}
                          users={users}
                          form={form}
                          fieldName={field.name}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button type="link" danger onClick={() => remove(field.name)}>删除</Button>
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add({})} block icon={<PlusOutlined />}>添加接收人</Button>
              </div>
            )}
          </Form.List>
        </Form.Item>
      </Form>
    </Modal>
  );
}

function RecipientValueSelect({ metadata, roles, departments, users, form, fieldName }) {
  const type = Form.useWatch(['recipients', fieldName, 'recipient_type'], form);

  if (type === 'role') {
    return (
      <Select mode="multiple" placeholder="选择角色" style={{ width: '100%' }}>
        {roles.map(r => <Option key={r.value} value={r.value}>{r.label}</Option>)}
      </Select>
    );
  }
  if (type === 'department') {
    return (
      <Select mode="multiple" placeholder="选择部门" style={{ width: '100%' }} showSearch>
        {departments.map(d => <Option key={d.id} value={d.name || d.code}>{d.name}</Option>)}
      </Select>
    );
  }
  if (type === 'user') {
    return (
      <Select mode="multiple" placeholder="选择用户" style={{ width: '100%' }} showSearch optionFilterProp="children">
        {users.map(u => <Option key={u.id} value={u.id}>{u.real_name || u.username} ({u.username})</Option>)}
      </Select>
    );
  }
  if (type === 'node') {
    return (
      <Select mode="multiple" placeholder="选择流程节点变量" style={{ width: '100%' }}>
        {metadata.node_recipient_options.map(n => <Option key={n.code} value={n.code}>{n.name}</Option>)}
      </Select>
    );
  }
  return <Input placeholder="请先选择接收人类型" disabled />;
}

function TestModal({ open, record, onClose }) {
  const [payload, setPayload] = useState('{}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    try {
      const parsed = JSON.parse(payload || '{}');
      setLoading(true);
      setResult(null);
      const res = await notificationAPI.testRule(record.id, { payload: parsed });
      setResult(res);
      message.success('测试发送已执行');
    } catch (e) {
      if (e instanceof SyntaxError) {
        message.error('JSON 格式错误');
      } else {
        message.error('测试发送失败: ' + (e.response?.data?.message || e.message));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="测试发送通知"
      open={open}
      onCancel={onClose}
      onOk={handleSend}
      confirmLoading={loading}
      destroyOnClose
    >
      <div style={{ marginBottom: 12 }}>
        <div>规则：<strong>{record?.rule_name}</strong></div>
        <div>事件：{record?.event_code}</div>
      </div>
      <Alert
        message="请输入模拟事件 payload（JSON 对象），例如 { asset_code: 'ZC001', request_person_id: 1 }"
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
      />
      <TextArea
        rows={6}
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
      />
      {result && (
        <Alert
          message={result.success ? '发送成功' : '发送失败'}
          description={JSON.stringify(result.data, null, 2)}
          type={result.success ? 'success' : 'error'}
          showIcon
          style={{ marginTop: 12 }}
        />
      )}
    </Modal>
  );
}

/* ===================== 通知模板 ===================== */

function NotificationTemplates() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [modal, setModal] = useState({ open: false, record: null });
  const [filters, setFilters] = useState({});
  const isMobile = useIsMobile();

  const fetchData = useCallback(async (page = pagination.current, pageSize = pagination.pageSize) => {
    try {
      setLoading(true);
      const res = await notificationAPI.getTemplates({ ...filters, page, pageSize });
      if (res.success) {
        setData(res.data.list || []);
        setPagination({
          current: res.data.pagination.page,
          pageSize: res.data.pagination.pageSize,
          total: res.data.pagination.total,
        });
      }
    } catch (e) {
      message.error('加载模板失败');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.current, pagination.pageSize]);

  useEffect(() => { fetchData(1); }, [filters]);
  useEffect(() => { fetchData(pagination.current, pagination.pageSize); }, [pagination.current, pagination.pageSize]);

  const handleDelete = async (id) => {
    try {
      await notificationAPI.deleteTemplate(id);
      message.success('删除成功');
      fetchData();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '模板编码', dataIndex: 'code', key: 'code' },
    { title: '模板名称', dataIndex: 'name', key: 'name' },
    {
      title: '渠道',
      dataIndex: 'channel',
      key: 'channel',
      render: (v) => <Tag color={CHANNEL_COLORS[v]}>{v}</Tag>,
    },
    { title: '标题', dataIndex: 'title_template', key: 'title_template', ellipsis: true },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v) => <Switch checked={v === 1} disabled size="small" />,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => setModal({ open: true, record })}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" icon={<DeleteOutlined />} danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Input.Search
            placeholder="搜索模板编码/名称"
            allowClear
            onSearch={(v) => setFilters(prev => ({ ...prev, keyword: v }))}
          />
        </Col>
        <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
          <Space>
            <Select
              placeholder="渠道"
              allowClear
              style={{ width: 120 }}
              onChange={(v) => setFilters(prev => ({ ...prev, channel: v }))}
            >
              <Option value="feishu">飞书</Option>
              <Option value="email">邮件</Option>
              <Option value="socket">站内消息</Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={() => { setFilters({}); fetchData(1); }}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ open: true, record: null })}>新建模板</Button>
          </Space>
        </Col>
      </Row>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={(p) => setPagination({ ...pagination, current: p.current, pageSize: p.pageSize })}
        size="small"
      />
      <TemplateModal
        open={modal.open}
        record={modal.record}
        onClose={() => setModal({ open: false, record: null })}
        onSuccess={() => { setModal({ open: false, record: null }); fetchData(); }}
      />
    </div>
  );
}

function TemplateModal({ open, record, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (record) {
        form.setFieldsValue({
          ...record,
          variables_json: Array.isArray(record.variables_json) ? record.variables_json.join('\n') : record.variables_json,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ channel: 'feishu', enabled: true, variables_json: '' });
      }
    }
  }, [open, record, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const payload = {
        ...values,
        enabled: values.enabled ? 1 : 0,
        variables_json: values.variables_json ? values.variables_json.split(/\n|,/).map(s => s.trim()).filter(Boolean) : [],
      };
      if (record) {
        await notificationAPI.updateTemplate(record.id, payload);
      } else {
        await notificationAPI.createTemplate(payload);
      }
      message.success('保存成功');
      onSuccess();
    } catch (e) {
      if (e.errorFields) return;
      message.error('保存失败: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={record ? '编辑通知模板' : '新建通知模板'}
      open={open}
      onCancel={onClose}
      width={640}
      onOk={handleSubmit}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="code" label="模板编码" rules={[{ required: true }]}>
              <Input placeholder="例如：maintenance_request_approved" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
              <Input placeholder="例如：维修申请已通过" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="channel" label="通知渠道" rules={[{ required: true }]}>
              <Select>
                <Option value="feishu">飞书</Option>
                <Option value="email">邮件</Option>
                <Option value="socket">站内消息</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="title_template" label="标题模板" rules={[{ required: true }]}>
          <Input placeholder="例如：维修申请 {{request_no}} 已批准" />
        </Form.Item>
        <Form.Item name="content_template" label="内容模板" rules={[{ required: true }]}>
          <TextArea rows={4} placeholder="支持 {{变量名}} 动态替换" />
        </Form.Item>
        <Form.Item name="variables_json" label="变量说明（每行一个变量名）">
          <TextArea rows={3} placeholder="request_no&#10;asset_code&#10;asset_name" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/* ===================== 发送记录 ===================== */

function NotificationLogs() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({});
  const [detail, setDetail] = useState(null);
  const isMobile = useIsMobile();

  const fetchStats = useCallback(async () => {
    try {
      const res = await notificationAPI.getLogStats({ days: 7 });
      if (res.success) setStats(res.data);
    } catch (e) { /* ignore */ }
  }, []);

  const fetchData = useCallback(async (page = pagination.current, pageSize = pagination.pageSize) => {
    try {
      setLoading(true);
      const params = { ...filters, page, pageSize };
      if (filters.dateRange && filters.dateRange.length === 2) {
        params.startDate = filters.dateRange[0].format('YYYY-MM-DD');
        params.endDate = filters.dateRange[1].format('YYYY-MM-DD');
      }
      delete params.dateRange;
      const res = await notificationAPI.getLogs(params);
      if (res.success) {
        setData(res.data.list || []);
        setPagination({
          current: res.data.pagination.page,
          pageSize: res.data.pagination.pageSize,
          total: res.data.pagination.total,
        });
      }
    } catch (e) {
      message.error('加载发送记录失败');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.current, pagination.pageSize]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => { fetchData(1); }, [filters]);
  useEffect(() => { fetchData(pagination.current, pagination.pageSize); }, [pagination.current, pagination.pageSize]);

  const columns = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm:ss') },
    { title: '事件', dataIndex: 'event_code', key: 'event_code' },
    {
      title: '渠道',
      dataIndex: 'channel',
      key: 'channel',
      render: (v) => <Tag color={CHANNEL_COLORS[v]}>{v}</Tag>,
    },
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: '发送状态',
      dataIndex: 'status',
      key: 'status',
      render: (v, record) => (
        <Badge
          status={STATUS_COLORS[v]}
          text={`${v} ${record.sent_count}/${record.total_count}`}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(record)}>详情</Button>
      ),
    },
  ];

  return (
    <div>
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}><Card><Statistic title="近7天发送总数" value={stats.total} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="成功" value={stats.successCount} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="失败" value={stats.failedCount} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="渠道数" value={stats.channels?.length || 0} /></Card></Col>
        </Row>
      )}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Input.Search
            placeholder="搜索标题/事件/错误"
            allowClear
            onSearch={(v) => setFilters(prev => ({ ...prev, keyword: v }))}
          />
        </Col>
        <Col xs={24} md={16} style={{ textAlign: isMobile ? 'left' : 'right' }}>
          <Space>
            <Select
              placeholder="渠道"
              allowClear
              style={{ width: 120 }}
              onChange={(v) => setFilters(prev => ({ ...prev, channel: v }))}
            >
              <Option value="feishu">飞书</Option>
              <Option value="email">邮件</Option>
              <Option value="socket">站内消息</Option>
            </Select>
            <Select
              placeholder="状态"
              allowClear
              style={{ width: 120 }}
              onChange={(v) => setFilters(prev => ({ ...prev, status: v }))}
            >
              <Option value="success">成功</Option>
              <Option value="failed">失败</Option>
            </Select>
            <RangePicker
              onChange={(v) => setFilters(prev => ({ ...prev, dateRange: v }))}
            />
            <Button icon={<ReloadOutlined />} onClick={() => { setFilters({}); fetchData(1); }}>刷新</Button>
          </Space>
        </Col>
      </Row>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={(p) => setPagination({ ...pagination, current: p.current, pageSize: p.pageSize })}
        size="small"
      />
      <Modal
        title="发送详情"
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={600}
      >
        {detail && (
          <div>
            <p><strong>事件：</strong>{detail.event_code}</p>
            <p><strong>渠道：</strong><Tag color={CHANNEL_COLORS[detail.channel]}>{detail.channel}</Tag></p>
            <p><strong>状态：</strong><Badge status={STATUS_COLORS[detail.status]} text={detail.status} /></p>
            <p><strong>标题：</strong>{detail.title}</p>
            <p><strong>内容：</strong></p>
            <div style={{ background: '#f6f6f6', padding: 12, borderRadius: 4, whiteSpace: 'pre-wrap' }}>{detail.content}</div>
            <p style={{ marginTop: 12 }}><strong>接收人ID：</strong>{(detail.recipients || []).join(', ') || '-'}</p>
            <p><strong>发送结果：</strong>{detail.sent_count}/{detail.total_count}</p>
            {detail.error && <p><strong>错误：</strong><span style={{ color: 'red' }}>{detail.error}</span></p>}
            <p><strong>时间：</strong>{dayjs(detail.created_at).format('YYYY-MM-DD HH:mm:ss')}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
