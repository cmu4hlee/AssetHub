/**
 * 通知配置管理
 * 包含通知规则、通知模板、发送记录三个 Tab
 * 改进：流程类型面板、模板实时预览、事件中文描述
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Tabs, Tag, Button, Space, Form, Input, Select, Switch,
  Modal, message, Popconfirm, DatePicker, Row, Col, Statistic, Badge,
  Tooltip, Divider, Alert, Empty, InputNumber, Typography,
} from 'antd';
import {
  BellOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, SendOutlined, EyeOutlined,
  NotificationOutlined, FileTextOutlined, HistoryOutlined,
  CheckCircleOutlined, MinusCircleOutlined,
  ToolOutlined, ProfileOutlined,
  SwapOutlined, AuditOutlined, SoundOutlined, SafetyCertificateOutlined, SafetyOutlined,
  SyncOutlined, UserSwitchOutlined, DollarOutlined,
  TeamOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import { notificationAPI, recipientStrategyAPI, userAPI, departmentsAPI } from '../utils/api';
import dayjs from 'dayjs';
import { useIsMobile } from '../hooks';
import { ResponsiveTable } from '../components';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Text } = Typography;

const CHANNEL_COLORS = { feishu: 'blue', email: 'green', socket: 'purple' };
const CHANNEL_LABELS = { feishu: '飞书', email: '邮件', socket: '站内' };
const STATUS_COLORS = { success: 'success', failed: 'error' };

/** 流程类型图标映射 */
const PROCESS_ICONS = {
  maintenance: <ToolOutlined />,
  approval: <ProfileOutlined />,
  scrapping: <DeleteOutlined />,
  transfer: <SwapOutlined />,
  inventory: <AuditOutlined />,
  tender: <SoundOutlined />,
  acceptance: <CheckCircleOutlined />,
  quality: <SafetyCertificateOutlined />,
  compliance: <SafetyOutlined />,
  asset: <SyncOutlined />,
  user: <UserSwitchOutlined />,
  finance: <DollarOutlined />,
};

/** 事件代码中文描述映射 */
const EVENT_LABELS = {
  // 维修维护
  // 维修维护（兼容两种命名格式）
  'maintenance.request.created': '报修申请创建',
  'maintenance.request.approved': '报修申请批准',
  'maintenance.request.rejected': '报修申请驳回',
  'maintenance.request.started': '维修开始',
  'maintenance.request.completed': '维修完成',
  'maintenance.request.cancelled': '报修申请取消',
  'maintenance_request:created': '报修申请创建',
  'maintenance_request:approved': '报修申请批准',
  'maintenance_request:rejected': '报修申请驳回',
  'maintenance_request:started': '维修开始',
  'maintenance_request:completed': '维修完成',
  'maintenance_request:cancelled': '报修申请取消',
  'workorder:assigned': '工单分配',
  'workorder:completed': '工单完成',
  'maintenance:approved': '维修审批通过',
  // 审批流程
  'approval:created': '审批发起',
  'approval:approved': '审批通过',
  'approval:rejected': '审批驳回',
  'approval:completed': '审批完成',
  // 资产报废
  'scrapping:created': '报废申请创建',
  'scrapping:approved': '报废申请批准',
  'scrapping:rejected': '报废申请驳回',
  'scrapping:completed': '报废处置完成',
  // 资产调配
  'transfer:created': '调配申请创建',
  'transfer:approved': '调配申请批准',
  'transfer:rejected': '调配申请驳回',
  'transfer:completed': '调配完成',
  // 资产盘点
  'inventory:created': '盘点创建',
  'inventory:started': '盘点开始',
  'inventory:completed': '盘点完成',
  'inventory_task:created': '盘点任务创建',
  'inventory_task:completed': '盘点任务完成',
  'inventory_task:cancelled': '盘点任务取消',
  // 招标采购
  'tender:created': '招标创建',
  'tender:published': '招标发布',
  'tender:awarded': '招标定标',
  'tender:completed': '招标完成',
  'tender:cancelled': '招标取消',
  'bid:submitted': '投标提交',
  'bid:awarded': '投标中标',
  'qualification:reviewed': '资质审核',
  'tender:invitation-sent': '邀请发送',
  'tender:invoice:created': '发票创建',
  'tender:invoice:verified': '发票核验',
  'tender:payment:created': '付款创建',
  'tender:payment:submitted': '付款提交',
  'tender:payment:paid': '付款完成',
  'tender:payment:failed': '付款失败',
  'tender:payment:approval_pending': '付款待审',
  // 验收
  'acceptance:reminder': '验收提醒',
  // 质量管理
  'quality:metrology-expiring': '计量证书到期',
  // 合规 / 特种设备
  'special_equipment:inspection_expiring': '特种设备检验到期',
  // 资产状态
  'asset_workflow:transition': '资产状态变更',
  // 用户管理
  'notification:role_request': '角色申请',
  // 财务
  'tender:invoice:paid': '发票已付款',
  'tender:invoice:archived': '发票归档',
  'tender:invoice:cancelled': '发票取消',
};

/** 获取事件的可读标签 */
function getEventLabel(code) {
  return EVENT_LABELS[code] || code;
}

/** 在指定文本中用模拟值替换 {{变量}} */
function renderTemplate(text, variables = []) {
  if (!text) return '';
  let result = text;
  const varMap = {};
  variables.forEach(v => {
    varMap[v] = `【${v}】`;
  });
  // 也匹配文本中出现的 {{var}} 即使不在 variables 中
  // 使用分组的替换样本值
  const sampleValues = {
    request_no: 'BX-2026-0001', workorder_no: 'GD-2026-0001',
    approval_no: 'SP-2026-0001', scrap_no: 'BF-2026-0001',
    transfer_no: 'DP-2026-0001', tender_no: 'ZB-2026-0001',
    asset_code: 'ZC-001', asset_name: 'CT扫描仪',
    fault_description: '设备无法正常启动', fault_level: '紧急',
    request_person: '张三', approver: '李四', repair_person: '王五',
    operator: '赵六', applicant: '张三', assignee: '王五',
    created_at: '2026-07-15 10:00', approved_at: '2026-07-15 11:00',
    rejected_at: '2026-07-15 11:00', started_at: '2026-07-15 12:00',
    completed_at: '2026-07-15 15:00', cancelled_at: '2026-07-15 15:00',
    assigned_at: '2026-07-15 11:30', department: '放射科',
    from_department: '内科', to_department: '外科',
    reason: '设备老化损坏严重', reject_reason: '材料不齐全',
    cancel_reason: '用户主动取消',
    scrap_method: '回收销毁', residual_value: '500',
    task_name: '2026年Q3季度盘点', plan_name: '2026年Q3季度盘点',
    scope: '全院', plan_start: '2026-09-01', plan_end: '2026-09-15',
    responsible_person: '李四',
    total_count: '1200', checked_count: '1180', surplus_count: '5', deficit_count: '25',
    tender_name: '医疗设备采购项目', tender_type: '公开招标',
    creator: '张三', deadline: '2026-08-01',
    platform: '内部招标平台', winner_name: 'XX医疗科技公司', winner_amount: '¥500,000',
    awarded_at: '2026-07-15', bidder_name: 'YY设备有限公司', bid_amount: '¥480,000',
    submitted_at: '2026-07-10',
    project_name: '医疗设备采购', supplier_name: 'XX科技有限公司',
    expected_delivery: '2026-08-10',
    certificate_no: 'JL-2026-0001', metrology_type: '强制检定',
    expiry_date: '2026-08-01', remaining_days: '17',
    // 特种设备
    equipment_code: 'TS-001', equipment_name: '医用电梯',
    equipment_type: 'elevator', equipment_type_label: '电梯',
    next_inspection_date: '2026-08-01', days_remaining: '17',
    use_certificate_no: 'TS-2023-001', safety_manager: '张三',
    from_status: '使用中', to_status: '维修中', transition_time: '2026-07-15 10:00',
    requested_role: '资产管理员', title: '系统通知', type_name: '维修',
    message: '您有新的维修任务需要处理', time: '2026-07-15 10:00',
    result_description: '更换电源模块，设备恢复正常运行',
    replaced_parts: '电源模块', cost: '¥1,200',
    priority: '高', invoice_no: 'FP-2026-0001', payment_no: 'FK-2026-0001',
    contract_no: 'HT-2026-0001', invoice_date: '2026-07-15',
    payment_method: '银行转账', payee_name: 'XX供应商',
    amount: '¥500,000', paid_at: '2026-07-15',
    usage_years: '8', original_value: '¥2,000,000',
    approval_type: '维修审批', description: 'CT设备故障，需要紧急维修',
    comment: '同意维修', result: '通过',
    start_time: '2026-09-01', end_time: '2026-09-15',
  };
  return result.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const key = varName.trim();
    if (key.includes('||')) {
      // handle fallback like {{repair_person || '待分配'}}
      const [primary, fallback] = key.split('||').map(s => s.trim().replace(/['"]/g, ''));
      return sampleValues[primary] || fallback || `【${primary}】`;
    }
    return sampleValues[key] || `【${key}】`;
  });
}

/* ===================== 入口 ===================== */

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
        styles={{ body: { padding: isMobile ? 12 : 24 } }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          destroyOnHidden
          items={[
            {
              key: 'rules',
              label: <span><NotificationOutlined /> 通知规则</span>,
              children: <NotificationRules />,
            },
            {
              key: 'templates',
              label: <span><FileTextOutlined /> 通知模板</span>,
              children: <NotificationTemplates />,
            },
            {
              key: 'logs',
              label: <span><HistoryOutlined /> 发送记录</span>,
              children: <NotificationLogs />,
            },
            {
              key: 'recipient-strategies',
              label: <span><TeamOutlined /> 接收人策略</span>,
              children: <RecipientStrategiesTab />,
            },
          ]}
        />
      </Card>
    </div>
  );
}

/* ===================== 流程类型概览面板 ===================== */

function ProcessDashboard({ rules, metadata, onProcessClick, activeProcess }) {
  if (!metadata.process_types.length || !rules.length) return null;

  // 计算每个流程类型的规则统计
  const stats = {};
  metadata.process_types.forEach(pt => {
    const processRules = rules.filter(r => r.process_type === pt.code);
    stats[pt.code] = {
      name: pt.name,
      icon: PROCESS_ICONS[pt.code],
      total: processRules.length,
      enabled: processRules.filter(r => r.enabled === 1).length,
      events: new Set(processRules.map(r => r.event_code)).size,
    };
  });

  // 只显示有规则或有事件的流程类型
  const visibleTypes = metadata.process_types.filter(pt => {
    const events = metadata.events_by_process[pt.code];
    return events?.length > 0 || stats[pt.code]?.total > 0;
  });

  return (
    <div style={{ marginBottom: 20 }}>
      <Text type="secondary" style={{ marginBottom: 10, display: 'block', fontSize: 13 }}>
        📊 流程类型概览 — 点击卡片快速筛选
      </Text>
      <Row gutter={[12, 12]}>
        {visibleTypes.map(pt => {
          const st = stats[pt.code] || { total: 0, enabled: 0, events: 0, icon: PROCESS_ICONS[pt.code] || null, name: pt.name };
          const isActive = activeProcess === pt.code;
          const hasEnabled = st.enabled > 0;
          const hasRules = st.total > 0;
          return (
            <Col xs={12} sm={8} md={6} lg={4} key={pt.code}>
              <Card
                size="small"
                hoverable
                onClick={() => onProcessClick(pt.code === activeProcess ? null : pt.code)}
                style={{
                  cursor: 'pointer',
                  borderColor: isActive ? '#1677ff' : (hasEnabled ? '#52c41a' : (hasRules ? '#d9d9d9' : '#faad14')),
                  borderWidth: isActive ? 2 : 1,
                  background: isActive ? '#e6f4ff' : undefined,
                  transition: 'all 0.2s',
                  height: '100%',
                }}
                styles={{ body: { padding: '12px 10px' } }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 4, opacity: hasRules ? 1 : 0.5 }}>
                    {st.icon}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {st.name}
                  </div>
                  {hasRules ? (
                    <Space size={4}>
                      <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                        {st.total}条
                      </Tag>
                      {st.enabled > 0 && (
                        <Tag color="green" style={{ margin: 0, fontSize: 11 }}>
                          {st.enabled}启用
                        </Tag>
                      )}
                    </Space>
                  ) : (
                    <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>未配置</Tag>
                  )}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
      {activeProcess && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            当前筛选：{metadata.process_types.find(p => p.code === activeProcess)?.name || activeProcess}
            <Button type="link" size="small" onClick={() => onProcessClick(null)}>清除筛选</Button>
          </Text>
        </div>
      )}
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
  const [activeProcess, setActiveProcess] = useState(null);
  const isMobile = useIsMobile();

  // 加载全量规则用于统计面板
  const [allRules, setAllRules] = useState([]);

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

  const fetchAllRules = useCallback(async () => {
    try {
      const res = await notificationAPI.getRules({ pageSize: 1000 });
      if (res.success) setAllRules(res.data.list || []);
    } catch (e) { /* ignore */ }
  }, []);

  const fetchData = useCallback(async (page = pagination.current, pageSize = pagination.pageSize) => {
    try {
      setLoading(true);
      const q = { page, pageSize };
      if (activeProcess) q.processType = activeProcess;
      if (filters.keyword) q.keyword = filters.keyword;
      if (filters.enabled !== undefined) q.enabled = filters.enabled;
      const res = await notificationAPI.getRules(q);
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
  }, [filters, activeProcess, pagination.current, pagination.pageSize]);

  useEffect(() => {
    fetchMetadata();
    fetchTemplates();
    fetchEnums();
    fetchAllRules();
  }, [fetchMetadata, fetchTemplates, fetchEnums, fetchAllRules]);

  useEffect(() => { fetchData(1); }, [filters, activeProcess]);

  const handleDelete = async (id) => {
    try {
      await notificationAPI.deleteRule(id);
      message.success('删除成功');
      fetchData();
      fetchAllRules();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleProcessClick = (code) => {
    setActiveProcess(code);
  };

  const columns = [
    {
      title: '规则名称', dataIndex: 'rule_name', key: 'rule_name',
      render: (v, record) => (
        <Space size={4}>
          {record.enabled === 1
            ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
            : <MinusCircleOutlined style={{ color: '#d9d9d9' }} />
          }
          <span>{v}</span>
        </Space>
      ),
    },
    {
      title: '流程 / 事件', key: 'process_event',
      render: (_, record) => {
        const processName = metadata.process_types.find(p => p.code === record.process_type)?.name || record.process_type;
        const eventLabel = getEventLabel(record.event_code);
        return (
          <Space size={4} wrap>
            <Tag>{processName}</Tag>
            <Text code style={{ fontSize: 12 }}>{eventLabel}</Text>
          </Space>
        );
      },
    },
    { title: '节点', dataIndex: 'node_code', key: 'node_code', render: v => v ? <Tag>{v}</Tag> : '-' },
    {
      title: '模板', key: 'template',
      render: (_, record) => `${record.template_name || record.template_code || record.template_id}`,
    },
    {
      title: '渠道', key: 'channel',
      render: (_, record) => <Tag color={CHANNEL_COLORS[record.channel]}>{CHANNEL_LABELS[record.channel] || record.channel}</Tag>,
    },
    {
      title: '接收人', key: 'recipients',
      render: (_, record) => {
        if (!record.recipients?.length) return <Tag color="red">未配置</Tag>;
        return (
          <Space size={2} wrap>
            {record.recipients.map((r, i) => (
              <Tag key={i} color="blue" style={{ margin: '1px 0' }}>
                {metadata.recipient_types.find(t => t.code === r.recipient_type)?.name || r.recipient_type}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '启用', dataIndex: 'enabled', key: 'enabled', width: 60,
      render: (v) => <Switch checked={v === 1} disabled size="small" />,
    },
    {
      title: '操作', key: 'action', width: 220,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => setModal({ open: true, record })}>编辑</Button>
          <Button size="small" icon={<SendOutlined />} onClick={() => setTestModal({ open: true, record })}>测试</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 流程类型概览面板 */}
      {allRules.length > 0 && (
        <ProcessDashboard
          rules={allRules}
          metadata={metadata}
          onProcessClick={handleProcessClick}
          activeProcess={activeProcess}
        />
      )}

      {/* 快捷操作提示 */}
      {allRules.length === 0 && (
        <Alert title="开始配置通知"
          description="请先添加通知模板，然后在此创建通知规则。每条规则可以绑定模板，配置接收人（按角色/部门/用户/流程节点），系统将在特定事件发生时自动发送通知。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

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
              placeholder="启用状态"
              allowClear
              style={{ width: 120 }}
              onChange={(v) => setFilters(prev => ({ ...prev, enabled: v }))}
            >
              <Option value="true">启用</Option>
              <Option value="false">禁用</Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={() => { setFilters({}); setActiveProcess(null); fetchAllRules(); }}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ open: true, record: null })}>新建规则</Button>
          </Space>
        </Col>
      </Row>

      <ResponsiveTable
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={(p) => setPagination({ ...pagination, current: p.current, pageSize: p.pageSize })}
        size="small"
        scroll={{ x: isMobile ? 800 : 'max-content' }}
        mobileTitleKey="rule_name"
        mobileStatusRender={r => r.enabled
          ? <Tag color="success">启用</Tag>
          : <Tag>停用</Tag>}
        mobileFields={[
          { label: '流程 / 事件', key: 'process_event' },
          { label: '触发条件', key: 'trigger_condition' },
        ]}
        mobileActions={[
          { key: 'edit', text: '编辑', icon: <EditOutlined />, onClick: (r) => setModal({ open: true, record: r }) },
        ]}
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
        onSuccess={() => {
          setModal({ open: false, record: null });
          fetchData();
          fetchAllRules();
        }}
      />
      <TestModal
        open={testModal.open}
        record={testModal.record}
        onClose={() => setTestModal({ open: false, record: null })}
      />
    </div>
  );
}

/* ===================== 规则弹窗（增强版） ===================== */

function TemplatePreview({ templateId, templates }) {
  const tpl = templates.find(t => t.id === templateId);
  if (!tpl) return null;
  const vars = Array.isArray(tpl.variables_json) ? tpl.variables_json : [];
  const previewTitle = renderTemplate(tpl.title_template, vars);
  const previewContent = renderTemplate(tpl.content_template, vars);
  return (
    <div style={{
      marginTop: 8, padding: 12,
      background: '#f6f8fa', borderRadius: 8,
      border: '1px solid #e0e0e0',
      maxHeight: 200, overflowY: 'auto',
    }}>
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
        👁 预览效果（变量已用模拟值替换）
      </Text>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: '#1677ff' }}>
        {previewTitle}
      </div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#555', lineHeight: 1.6 }}>
        {previewContent}
      </div>
      {vars.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>变量：</Text>
          {vars.map(v => <Tag key={v} style={{ fontSize: 10, margin: '1px 2px' }}>{v}</Tag>)}
        </div>
      )}
    </div>
  );
}

function RuleModal({ open, record, metadata, templates, roles, departments, users, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [processType, setProcessType] = useState(record?.process_type);
  const [selectedTemplateId, setSelectedTemplateId] = useState(record?.template_id);

  // 按渠道分组模板
  const templatesByChannel = useMemo(() => {
    const map = { feishu: [], email: [], socket: [] };
    templates.forEach(t => {
      if (map[t.channel]) map[t.channel].push(t);
    });
    return map;
  }, [templates]);

  useEffect(() => {
    if (open) {
      if (record) {
        setProcessType(record.process_type);
        setSelectedTemplateId(record.template_id);
        form.setFieldsValue({
          ...record,
          recipients: record.recipients || [],
        });
      } else {
        setProcessType(undefined);
        setSelectedTemplateId(undefined);
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
      width={780}
      onOk={handleSubmit}
      confirmLoading={loading}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Row gutter={16}>
          <Col span={16}>
            <Form.Item name="rule_name" label="规则名称" rules={[{ required: true }]}>
              <Input placeholder="例如：维修申请审批通过通知工程师" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="process_type" label="流程类型" rules={[{ required: true }]}>
              <Select placeholder="选择流程类型" onChange={(v) => { setProcessType(v); form.setFieldsValue({ event_code: undefined }); }}>
                {metadata.process_types.map(p => (
                  <Option key={p.code} value={p.code}>
                    <Space>
                      {PROCESS_ICONS[p.code]}
                      {p.name}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="event_code" label="事件" rules={[{ required: true }]}>
              <Select
                placeholder="选择触发事件"
                showSearch
                disabled={!processType}
                optionFilterProp="label"
              >
                {eventOptions.map(e => (
                  <Option key={e} value={e} label={getEventLabel(e)}>
                    <Space>
                      <Text type="secondary" style={{ fontSize: 11 }}>{e.split(':')[0]}</Text>
                      <span>{getEventLabel(e)}</span>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="node_code" label="流程节点（可选）">
              <Input placeholder="例如：approved" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="template_id" label="通知模板" rules={[{ required: true }]}
              tooltip="选择模板后可查看预览效果"
            >
              <Select
                placeholder="选择模板"
                showSearch
                optionFilterProp="label"
                onChange={setSelectedTemplateId}
              >
                <Option key="feishu-group" disabled><strong>📘 飞书模板</strong></Option>
                {templatesByChannel.feishu.map(t => (
                  <Option key={t.id} value={t.id} label={t.name}>
                    <Space>
                      <Tag color="blue">飞书</Tag>
                      <span>{t.name}</span>
                    </Space>
                  </Option>
                ))}
                <Option key="email-group" disabled><strong>📧 邮件模板</strong></Option>
                {templatesByChannel.email.map(t => (
                  <Option key={t.id} value={t.id} label={t.name}>
                    <Space>
                      <Tag color="green">邮件</Tag>
                      <span>{t.name}</span>
                    </Space>
                  </Option>
                ))}
                <Option key="socket-group" disabled><strong>💬 站内模板</strong></Option>
                {templatesByChannel.socket.map(t => (
                  <Option key={t.id} value={t.id} label={t.name}>
                    <Space>
                      <Tag color="purple">站内</Tag>
                      <span>{t.name}</span>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="priority" label="优先级">
              <InputNumber style={{ width: '100%' }} placeholder="数字越大越优先（可选）" />
            </Form.Item>
          </Col>
        </Row>

        {/* 模板实时预览 */}
        {selectedTemplateId && (
          <Form.Item label="模板预览">
            <TemplatePreview templateId={selectedTemplateId} templates={templates} />
          </Form.Item>
        )}

        <Form.Item name="trigger_condition" label="触发条件（JSON，可选）">
          <TextArea rows={2} placeholder='{"fault_level": {"__in": ["紧急", "严重"]}}' style={{ fontFamily: 'monospace', fontSize: 12 }} />
        </Form.Item>

        <Form.Item
          label="接收人配置"
          tooltip="支持多级接收人：按角色/部门/用户/流程节点动态解析"
        >
          <Form.List name="recipients">
            {(fields, { add, remove }) => (
              <div>
                {fields.map(field => (
                  <Row key={field.key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={6}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'recipient_type']}
                        rules={[{ required: true, message: '选类型' }]}
                        noStyle
                      >
                        <Select placeholder="接收人类型">
                          {metadata.recipient_types.map(t => (
                            <Option key={t.code} value={t.code}>{t.name}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'recipient_value']}
                        rules={[{ required: true, message: '必填' }]}
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
                      <Button type="link" danger size="small" onClick={() => remove(field.name)}>✕</Button>
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add({})} block icon={<PlusOutlined />}>
                  添加接收人
                </Button>
              </div>
            )}
          </Form.List>
        </Form.Item>
      </Form>
    </Modal>
  );
}

/* ===================== 接收人选择 ===================== */

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

/* ===================== 测试发送 ===================== */

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
      destroyOnHidden
    >
      <div style={{ marginBottom: 12 }}>
        <div>规则：<strong>{record?.rule_name}</strong></div>
        <div>事件：{record?.event_code}</div>
      </div>
      <Alert title="请输入模拟事件 payload（JSON 对象），例如 { asset_code: 'ZC001', request_person_id: 1 }"
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
        <Alert title={result.success ? '发送成功' : '发送失败'}
          description={JSON.stringify(result.data, null, 2)}
          type={result.success ? 'success' : 'error'}
          showIcon
          style={{ marginTop: 12 }}
        />
      )}
    </Modal>
  );
}

/* ===================== 通知模板（增强版） ===================== */

function NotificationTemplates() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [modal, setModal] = useState({ open: false, record: null });
  const [previewModal, setPreviewModal] = useState({ open: false, record: null });
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
    {
      title: '模板名称', dataIndex: 'name', key: 'name',
      render: (v, record) => (
        <Space>
          {record.enabled === 1
            ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
            : <MinusCircleOutlined style={{ color: '#d9d9d9' }} />
          }
          <span>{v}</span>
        </Space>
      ),
    },
    { title: '编码', dataIndex: 'code', key: 'code', width: 200, ellipsis: true,
      render: v => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: '渠道', dataIndex: 'channel', key: 'channel', width: 80,
      render: (v) => <Tag color={CHANNEL_COLORS[v]}>{CHANNEL_LABELS[v] || v}</Tag>,
    },
    {
      title: '标题预览', dataIndex: 'title_template', key: 'title_template',
      ellipsis: true,
      render: (v, record) => {
        const vars = Array.isArray(record.variables_json) ? record.variables_json : [];
        return (
          <Tooltip title={v}>
            <span style={{ fontSize: 13 }}>{renderTemplate(v.substring(0, 30), vars)}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '启用', dataIndex: 'enabled', key: 'enabled', width: 60,
      render: (v) => <Switch checked={v === 1} disabled size="small" />,
    },
    {
      title: '操作', key: 'action', width: 200,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setPreviewModal({ open: true, record })}>预览</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => setModal({ open: true, record })}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" icon={<DeleteOutlined />} danger />
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

      <ResponsiveTable
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={(p) => setPagination({ ...pagination, current: p.current, pageSize: p.pageSize })}
        size="small"
        mobileTitleKey="name"
        mobileStatusRender={r => <Tag color={CHANNEL_COLORS[r.channel]}>{CHANNEL_LABELS[r.channel] || r.channel}</Tag>}
        mobileFields={[
          { label: '编码', key: 'code' },
          { label: '标题', key: 'title' },
        ]}
        mobileActions={[
          { key: 'edit', text: '编辑', icon: <EditOutlined />, onClick: (r) => setModal({ open: true, record: r }) },
        ]}
      />

      <TemplateModal
        open={modal.open}
        record={modal.record}
        onClose={() => setModal({ open: false, record: null })}
        onSuccess={() => { setModal({ open: false, record: null }); fetchData(); }}
      />
      <TemplatePreviewModal
        open={previewModal.open}
        record={previewModal.record}
        onClose={() => setPreviewModal({ open: false, record: null })}
      />
    </div>
  );
}

/* ===================== 模板编辑弹窗（增强版） ===================== */

function TemplateModal({ open, record, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [previewVars, setPreviewVars] = useState([]);

  const watchTitle = Form.useWatch('title_template', form);
  const watchContent = Form.useWatch('content_template', form);
  const watchVars = Form.useWatch('variables_json', form);

  // 实时提取变量并更新预览
  useEffect(() => {
    if (watchVars) {
      const vars = watchVars.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
      setPreviewVars(vars);
    } else {
      setPreviewVars([]);
    }
  }, [watchVars]);

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
        variables_json: values.variables_json ? values.variables_json.split(/[\n,]/).map(s => s.trim()).filter(Boolean) : [],
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

  const previewTitle = renderTemplate(watchTitle || '', previewVars);
  const previewContent = renderTemplate(watchContent || '', previewVars);

  return (
    <Modal
      title={record ? '编辑通知模板' : '新建通知模板'}
      open={open}
      onCancel={onClose}
      width={720}
      onOk={handleSubmit}
      confirmLoading={loading}
      destroyOnHidden
    >
      <Row gutter={16}>
        {/* 左侧：编辑区 */}
        <Col span={14}>
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
                    <Option value="feishu">📘 飞书</Option>
                    <Option value="email">📧 邮件</Option>
                    <Option value="socket">💬 站内消息</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="enabled" label="启用" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="title_template" label="标题模板" rules={[{ required: true }]}
              tooltip="使用 {{变量名}} 语法插入动态值"
            >
              <Input placeholder="例如：维修申请 {{request_no}} 已批准" />
            </Form.Item>
            <Form.Item name="content_template" label="内容模板" rules={[{ required: true }]}
              tooltip="使用 {{变量名}} 语法插入动态值"
            >
              <TextArea rows={5} placeholder="支持 {{变量名}} 动态替换" />
            </Form.Item>
            <Form.Item name="variables_json"
              label="变量说明" tooltip="每行一个变量名，用于预览渲染"
            >
              <TextArea rows={2} placeholder="request_no&#10;asset_code&#10;asset_name" />
            </Form.Item>
          </Form>
        </Col>

        {/* 右侧：实时预览 */}
        <Col span={10}>
          <div style={{
            marginTop: 12, padding: 12,
            background: '#f6f8fa', borderRadius: 8,
            border: '1px solid #e8e8e8',
            height: 'calc(100% - 12px)', minHeight: 360,
          }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
              👁 实时预览
            </Text>
            {(watchTitle || watchContent) ? (
              <div>
                <div style={{
                  fontWeight: 600, marginBottom: 8, fontSize: 14,
                  color: '#1677ff', lineHeight: 1.5,
                }}>
                  {previewTitle || <Text type="secondary">标题预览…</Text>}
                </div>
                <Divider style={{ margin: '6px 0' }} />
                <div style={{
                  whiteSpace: 'pre-wrap', fontSize: 12,
                  color: '#333', lineHeight: 1.7,
                }}>
                  {previewContent || <Text type="secondary">内容预览…</Text>}
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 300, color: '#bbb', fontSize: 13,
              }}>
                输入标题和内容后\n此处显示实时预览
              </div>
            )}
          </div>
        </Col>
      </Row>
    </Modal>
  );
}

/* ===================== 模板预览弹窗 ===================== */

function TemplatePreviewModal({ open, record, onClose }) {
  if (!record) return null;
  const vars = Array.isArray(record.variables_json) ? record.variables_json : [];
  const title = renderTemplate(record.title_template, vars);
  const content = renderTemplate(record.content_template, vars);

  return (
    <Modal
      title={
        <Space>
          <Tag color={CHANNEL_COLORS[record.channel]}>{CHANNEL_LABELS[record.channel] || record.channel}</Tag>
          <span>{record.name}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      width={600}
    >
      <div style={{ marginBottom: 12 }}>
        <Text code style={{ fontSize: 11 }}>{record.code}</Text>
      </div>
      <div style={{
        background: '#f6f8fa', borderRadius: 8,
        border: '1px solid #e8e8e8', padding: 16,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16, color: '#1677ff' }}>
          {title}
        </div>
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#333', lineHeight: 1.8 }}>
          {content}
        </div>
      </div>
      {vars.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary">模板变量：</Text>
          <div style={{ marginTop: 4 }}>
            {vars.map(v => <Tag key={v} style={{ marginBottom: 4 }}>{`{{${v}}}`}</Tag>)}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ===================== 发送记录（保持原有） ===================== */

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

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchData(1); }, [filters]);

  const columns = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm:ss') },
    { title: '事件', dataIndex: 'event_code', key: 'event_code' },
    {
      title: '渠道', dataIndex: 'channel', key: 'channel',
      render: (v) => <Tag color={CHANNEL_COLORS[v]}>{CHANNEL_LABELS[v] || v}</Tag>,
    },
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: '发送状态', dataIndex: 'status', key: 'status',
      render: (v, record) => (
        <Badge status={STATUS_COLORS[v]} text={`${v} ${record.sent_count}/${record.total_count}`} />
      ),
    },
    {
      title: '操作', key: 'action',
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
          <Col xs={12} md={6}><Card><Statistic title="成功" value={stats.successCount} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="失败" value={stats.failedCount} styles={{ content: { color: '#ff4d4f' } }} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="渠道数" value={stats.channels?.length || 0} /></Card></Col>
        </Row>
      )}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Input.Search placeholder="搜索标题/事件/错误" allowClear
            onSearch={(v) => setFilters(prev => ({ ...prev, keyword: v }))} />
        </Col>
        <Col xs={24} md={16} style={{ textAlign: isMobile ? 'left' : 'right' }}>
          <Space>
            <Select placeholder="渠道" allowClear style={{ width: 120 }}
              onChange={(v) => setFilters(prev => ({ ...prev, channel: v }))}>
              <Option value="feishu">飞书</Option>
              <Option value="email">邮件</Option>
              <Option value="socket">站内消息</Option>
            </Select>
            <Select placeholder="状态" allowClear style={{ width: 120 }}
              onChange={(v) => setFilters(prev => ({ ...prev, status: v }))}>
              <Option value="success">成功</Option>
              <Option value="failed">失败</Option>
            </Select>
            <RangePicker onChange={(v) => setFilters(prev => ({ ...prev, dateRange: v }))} />
            <Button icon={<ReloadOutlined />} onClick={() => { setFilters({}); fetchData(1); }}>刷新</Button>
          </Space>
        </Col>
      </Row>
      <ResponsiveTable
        rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={pagination}
        onChange={(p) => setPagination({ ...pagination, current: p.current, pageSize: p.pageSize })}
        size="small"
        mobileTitleKey="title"
        mobileStatusRender={r => (
          <Badge status={STATUS_COLORS[r.status]} text={`${r.status} ${r.sent_count || 0}/${r.total_count || 0}`} />
        )}
        mobileFields={[
          {
            label: '时间',
            key: 'created_at',
            render: v => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'),
          },
          { label: '事件', key: 'event_code' },
          {
            label: '渠道',
            key: 'channel',
            render: v => <Tag color={CHANNEL_COLORS[v]}>{CHANNEL_LABELS[v] || v}</Tag>,
          },
        ]}
        mobileActions={[
          { key: 'view', text: '详情', icon: <EyeOutlined />, onClick: r => setDetail(r) },
        ]}
      />
      <Modal title="发送详情" open={!!detail} onCancel={() => setDetail(null)} footer={null} width={600}>
        {detail && (
          <div>
            <p><strong>事件：</strong>{detail.event_code}</p>
            <p><strong>渠道：</strong><Tag color={CHANNEL_COLORS[detail.channel]}>{CHANNEL_LABELS[detail.channel] || detail.channel}</Tag></p>
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

/* ===================== 接收人策略 Tab ===================== */

function RecipientStrategiesTab() {
  const [meta, setMeta] = useState({ strategyTypes: [], knownEvents: [], configuredEvents: [] });
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ eventCode: undefined });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);

  const fetchMeta = useCallback(async () => {
    try {
      const r = await recipientStrategyAPI.getMeta();
      if (r?.success) setMeta(r.data);
    } catch (e) { console.error(e); }
  }, []);

  const fetchList = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const r = await recipientStrategyAPI.list({
        eventCode: filters.eventCode,
        page,
        pageSize: pagination.pageSize,
      });
      if (r?.success) {
        setList(r.data.list);
        setPagination(p => ({ ...p, current: r.data.pagination.page, total: r.data.pagination.total }));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filters, pagination.pageSize]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchList(1); }, [fetchList]);

  const handleDelete = async (id) => {
    try {
      const r = await recipientStrategyAPI.remove(id);
      if (r?.success) { message.success('已删除'); fetchList(pagination.current); }
    } catch (e) { message.error('删除失败'); }
  };

  const handleBatchDelete = async (ids) => {
    try {
      const r = await recipientStrategyAPI.batchDelete(ids);
      if (r?.success) { message.success(`已删除 ${r.data.deleted} 条`); fetchList(1); }
    } catch (e) { message.error('删除失败'); }
  };

  const handleToggleEnabled = async (row) => {
    try {
      const r = await recipientStrategyAPI.update(row.id, { enabled: !row.enabled });
      if (r?.success) { message.success(r.data.enabled ? '已启用' : '已禁用'); fetchList(pagination.current); }
    } catch (e) { message.error('操作失败'); }
  };

  const strategyTypeMap = (meta.strategyTypes || []).reduce((m, s) => { m[s.code] = s; return m; }, {});
  const eventTitleMap = (meta.knownEvents || []).reduce((m, e) => { m[e.eventCode] = e.title; return m; }, {});

  const columns = [
    {
      title: '事件', dataIndex: 'eventCode', width: 280,
      render: v => (
        <Tooltip title={v}>
          <Tag color="blue">{v}</Tag>
          {eventTitleMap[v] && <span style={{ marginLeft: 8, color: '#666' }}>{eventTitleMap[v]}</span>}
        </Tooltip>
      ),
    },
    {
      title: '策略类型', dataIndex: 'strategyType', width: 140,
      render: v => {
        const meta = strategyTypeMap[v];
        return meta ? <Tag color="geekblue">{meta.name}</Tag> : <Tag>{v}</Tag>;
      },
    },
    {
      title: '策略值', dataIndex: 'strategyValue', ellipsis: true,
      render: v => v == null ? <span style={{ color: '#999' }}>-</span> : (
        <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 3 }}>
          {Array.isArray(v) ? v.join(', ') : String(v)}
        </code>
      ),
    },
    { title: '优先级', dataIndex: 'priority', width: 80, sorter: (a, b) => a.priority - b.priority },
    {
      title: '启用', dataIndex: 'enabled', width: 80,
      render: (v, row) => <Switch checked={v} onChange={() => handleToggleEnabled(row)} size="small" />,
    },
    {
      title: '备注', dataIndex: 'remark', ellipsis: true,
      render: v => v || <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '操作', width: 180, fixed: 'right',
      render: (_, row) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />}
            onClick={() => { setEditing(row); setEditorOpen(true); }}
          >编辑</Button>
          <Button type="link" size="small" icon={<ExperimentOutlined />}
            onClick={() => openPreview(row)}
          >预览</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(row.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const openPreview = async (row) => {
    try {
      const r = await recipientStrategyAPI.preview(row.eventCode, {
        tenantId: row.tenantId,
        applicantId: 1,
        approverId: 1,
        assigneeId: 1,
        request_person_id: 1,
      });
      if (r?.success) {
        setPreviewResult({ ...r.data, eventTitle: eventTitleMap[row.eventCode] });
        setPreviewOpen(true);
      }
    } catch (e) { message.error('预览失败'); }
  };

  // 事件下拉选项：合并 knownEvents + configuredEvents
  const eventOptions = useMemo(() => {
    const map = new Map();
    (meta.knownEvents || []).forEach(e => map.set(e.eventCode, e));
    (meta.configuredEvents || []).forEach(c => {
      if (!map.has(c)) map.set(c, { eventCode: c, title: c });
    });
    return Array.from(map.values());
  }, [meta]);

  return (
    <div>
      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        title="接收人策略配置化"
        description={
          <span>
            为不同事件配置接收人策略。优先级：admin 配置策略 &gt; handler 默认逻辑。
            配置多策略时按优先级合并去重。
            <strong>飞书和站内消息通道共用同一套配置。</strong>
          </span>
        }
      />
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col>
          <Select
            placeholder="按事件筛选" allowClear style={{ width: 320 }}
            value={filters.eventCode}
            onChange={v => setFilters({ eventCode: v })}
            showSearch optionFilterProp="children"
            options={eventOptions.map(e => ({ value: e.eventCode, label: `${e.eventCode} - ${e.title}` }))}
          />
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={() => fetchList(1)}>刷新</Button>
        </Col>
        <Col flex="auto" />
        <Col>
          <Space>
            <Button icon={<ExperimentOutlined />} onClick={() => {
              if (!filters.eventCode) {
                message.warning('请先选择事件');
                return;
              }
              openPreview({ eventCode: filters.eventCode, tenantId: 0 });
            }}>预览当前事件</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setEditorOpen(true); }}>
              新建策略
            </Button>
          </Space>
        </Col>
      </Row>

      <ResponsiveTable
        rowKey="id" columns={columns} dataSource={list} loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          onChange: (page, pageSize) => { setPagination(p => ({ ...p, current: page, pageSize })); fetchList(page); },
        }}
        size="middle" rowSelection={{
          selectedRowKeys: [],
          onChange: (keys) => keys.length && handleBatchDelete(keys),
        }}
        mobileTitleKey="eventCode"
        mobileStatusRender={r => r.enabled
          ? <Tag color="success">启用</Tag>
          : <Tag>停用</Tag>}
        mobileFields={[
          {
            label: '策略类型',
            key: 'strategyType',
            render: v => {
              const meta = strategyTypeMap[v];
              return meta ? <Tag color="geekblue">{meta.name}</Tag> : <Tag>{v}</Tag>;
            },
          },
          { label: '优先级', key: 'priority' },
          { label: '备注', key: 'remark' },
        ]}
        mobileActions={[
          { key: 'edit', text: '编辑', icon: <EditOutlined />, onClick: (r) => { setEditing(r); setEditorOpen(true); } },
        ]}
      />

      <StrategyEditor
        open={editorOpen}
        editing={editing}
        meta={meta}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { setEditorOpen(false); fetchList(pagination.current); }}
      />

      <Modal
        title="接收人预览" open={previewOpen} footer={null} width={680}
        onCancel={() => setPreviewOpen(false)}
      >
        {previewResult && (
          <div>
            <p><strong>事件：</strong><Tag color="blue">{previewResult.eventCode}</Tag> {previewResult.eventTitle}</p>
            <p><strong>匹配策略数：</strong>{previewResult.strategyCount}</p>
            <div style={{ background: '#fafafa', padding: 8, borderRadius: 4, marginBottom: 12 }}>
              {previewResult.strategies.length === 0 ? (
                <span style={{ color: '#999' }}>（无配置，将走 handler 默认逻辑）</span>
              ) : (
                previewResult.strategies.map(s => (
                  <div key={s.id} style={{ marginBottom: 4 }}>
                    <Tag color="geekblue">{strategyTypeMap[s.strategyType]?.name || s.strategyType}</Tag>
                    {s.strategyValue && <code style={{ marginLeft: 8 }}>{JSON.stringify(s.strategyValue)}</code>}
                    <span style={{ marginLeft: 8, color: '#999' }}>priority={s.priority}</span>
                  </div>
                ))
              )}
            </div>
            <p><strong>解析出的接收人 userId：</strong></p>
            <div style={{ background: '#f0f5ff', padding: 12, borderRadius: 4 }}>
              {previewResult.userIds.length === 0 ? (
                <span style={{ color: '#999' }}>（解析为空）</span>
              ) : (
                <Space wrap>
                  {previewResult.userIds.map(uid => <Tag key={uid} color="cyan">user #{uid}</Tag>)}
                </Space>
              )}
            </div>
            <p style={{ marginTop: 12 }}>共 <strong>{previewResult.count}</strong> 个接收人</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StrategyEditor({ open, editing, meta, onClose, onSaved }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const strategyType = Form.useWatch('strategy_type', form);
  const eventCode = Form.useWatch('event_code', form);

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (editing) {
        form.setFieldsValue({
          event_code: editing.eventCode,
          strategy_type: editing.strategyType,
          strategy_value: editing.strategyValue,
          priority: editing.priority,
          enabled: editing.enabled,
          remark: editing.remark,
        });
      } else {
        form.setFieldsValue({ priority: 0, enabled: true });
      }
    }
  }, [open, editing, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      let r;
      // 把数组类型的 strategy_value 转成 JSON
      const meta2 = (meta.strategyTypes || []).find(s => s.code === values.strategy_type);
      let sv = values.strategy_value;
      if (meta2?.multi && typeof sv === 'string' && sv.trim()) {
        // 逗号分隔 → 数组
        sv = sv.split(/[,，\s]+/).filter(Boolean);
      } else if (meta2?.multi && Array.isArray(sv)) {
        // ok
      } else if (!meta2?.multi && meta2?.needValue && typeof sv === 'string') {
        sv = sv.trim();
      } else if (!meta2?.needValue) {
        sv = null;
      }
      if (editing) {
        r = await recipientStrategyAPI.update(editing.id, { ...values, strategy_value: sv });
      } else {
        r = await recipientStrategyAPI.create({ ...values, strategy_value: sv });
      }
      if (r?.success) { message.success('保存成功'); onSaved(); }
    } catch (e) {
      if (e?.errorFields) return; // 表单校验失败
      message.error(e?.response?.data?.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const typeMeta = (meta.strategyTypes || []).find(s => s.code === strategyType);
  const eventOptions = (meta.knownEvents || []).map(e => ({ value: e.eventCode, label: `${e.eventCode} - ${e.title}` }));

  return (
    <Modal
      title={editing ? '编辑策略' : '新建策略'}
      open={open} onCancel={onClose} onOk={handleSubmit}
      confirmLoading={submitting} width={560} destroyOnHidden
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item label="事件编码" name="event_code" rules={[{ required: true, message: '请选择事件' }]}>
          {editing ? (
            <Input disabled value={editing.eventCode} />
          ) : (
            <Select
              showSearch optionFilterProp="label"
              placeholder="选择要配置的事件"
              options={eventOptions}
              filterOption={(input, opt) =>
                opt.label.toLowerCase().includes(input.toLowerCase())
              }
            />
          )}
        </Form.Item>
        <Form.Item label="策略类型" name="strategy_type" rules={[{ required: true, message: '请选择策略类型' }]}>
          {editing ? (
            <Input disabled value={strategyType} />
          ) : (
            <Select
              placeholder="选择策略类型"
              onChange={() => form.setFieldValue('strategy_value', undefined)}
              options={(meta.strategyTypes || []).map(s => ({
                value: s.code,
                label: s.name + (s.needValue ? '' : '（无需值）'),
              }))}
            />
          )}
        </Form.Item>
        {typeMeta?.needValue && (
          <Form.Item
            label={typeMeta.multi ? '策略值（多个用逗号分隔）' : '策略值'}
            name="strategy_value"
            extra={typeMeta.description}
            rules={[{ required: true, message: '请输入策略值' }]}
          >
            <Input placeholder={typeMeta.code === 'role' ? 'maintenance_admin' : typeMeta.code === 'user' ? '1, 2, 3' : ''} />
          </Form.Item>
        )}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="优先级" name="priority">
              <InputNumber style={{ width: '100%' }} min={-100} max={100} placeholder="数字越大越靠前" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="启用" name="enabled" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="备注" name="remark">
          <Input.TextArea rows={2} placeholder="例如：报废申请只通知系统管理员" maxLength={200} showCount />
        </Form.Item>
        {typeMeta && !typeMeta.needValue && (
          <Alert type="info" showIcon description={typeMeta.description} style={{ marginTop: 8 }} />
        )}
        {eventCode && !editing && (
          <Alert
            type="warning" showIcon style={{ marginTop: 8 }}
            title="保存后将覆盖该事件的默认接收人逻辑"
            description="可随时禁用或删除此策略，事件会回退到 handler 的硬编码默认逻辑"
          />
        )}
      </Form>
    </Modal>
  );
}
