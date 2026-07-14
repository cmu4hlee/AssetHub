import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, Button, message, Modal, Input, Space, Row, Col, Drawer } from 'antd';
import {
  RobotOutlined, CheckOutlined, CloseOutlined, EyeOutlined,
  ClockCircleOutlined, CheckCircleOutlined, FireOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import { formatDateTime } from '../../constants/tendering';
import {
  PageHeader, StatusTag, KpiCard, ResponsiveTable,
} from '../../components/tendering';
import TenderApprovalAI from './TenderApprovalAI';

// 审批状态映射
const APPROVAL_STATUS = {
  pending:  { text: '待审批', color: 'warning' },
  approved: { text: '已通过', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
  expired:  { text: '已超时', color: 'volcano' },
};

const ENTITY_LABELS = {
  tender_projects: '招标项目',
  tender_contracts: '合同',
  tender_invoices: '发票',
  tender_payments: '付款单',
  tender_acceptances: '验收单',
};

const ENTITY_PATH = {
  tender_projects: 'projects',
  tender_contracts: 'contracts',
  tender_invoices: 'invoices',
  tender_payments: 'payments',
  tender_acceptances: 'acceptances',
};

export default function TenderApprovalTodo() {
  const navigate = useNavigate();
  const [todos, setTodos] = useState([]);
  const [initiated, setInitiated] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiDrawer, setAiDrawer] = useState({ open: false, entityType: null, entityId: null });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [t, i] = await Promise.all([
        tenderingAPI.listMyApprovalTodos({ status: 'pending' }),
        tenderingAPI.listMyInitiatedApprovals(),
      ]);
      setTodos(Array.isArray(t?.data) ? t.data : (Array.isArray(t) ? t : []));
      setInitiated(Array.isArray(i?.data) ? i.data : (Array.isArray(i) ? i : []));
    } catch (e) {
      message.error(e.response?.data?.message || '获取审批失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const onApprove = async recordId => {
    try {
      await tenderingAPI.approveRequest(recordId);
      message.success('已通过');
      fetch();
    } catch (e) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const onReject = recordId => {
    let opinion = '';
    Modal.confirm({
      title: '驳回审批',
      content: (
        <Input.TextArea
          rows={3}
          placeholder="请填写驳回理由"
          onChange={e => { opinion = e.target.value; }}
        />
      ),
      okText: '确认驳回',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await tenderingAPI.rejectRequest(recordId, opinion);
          message.success('已驳回');
          fetch();
        } catch (e) {
          message.error(e.response?.data?.message || '驳回失败');
        }
      },
    });
  };

  const todoColumns = [
    { title: '审批ID', dataIndex: 'record_id', width: 100 },
    {
      title: '对象',
      dataIndex: 'entity_type',
      width: 130,
      render: v => <StatusTag status={v} statusMap={ENTITY_LABELS} bordered size="small" />,
    },
    { title: '对象ID', dataIndex: 'entity_id', width: 100 },
    { title: '动作', dataIndex: 'trigger_action', width: 140, render: v => v || '-' },
    { title: '发起人', dataIndex: 'initiator_name', width: 120, render: v => v || '-' },
    { title: '发起时间', dataIndex: 'assigned_at', width: 160, render: v => formatDateTime(v) },
    { title: '到期时间', dataIndex: 'due_at', width: 160, render: v => formatDateTime(v) },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, row) => (
        <Space size="small" wrap>
          <Button
            type="link" size="small" icon={<CheckOutlined />}
            onClick={() => onApprove(row.record_id)}
          >
            通过
          </Button>
          <Button
            type="link" size="small" danger icon={<CloseOutlined />}
            onClick={() => onReject(row.record_id)}
          >
            驳回
          </Button>
          <Button
            type="link" size="small" icon={<RobotOutlined />}
            onClick={() => setAiDrawer({ open: true, entityType: row.entity_type, entityId: row.entity_id })}
          >
            AI 建议
          </Button>
          <Button
            type="link" size="small" icon={<EyeOutlined />}
            onClick={() => {
              const path = ENTITY_PATH[row.entity_type];
              if (path) navigate(`/tendering/${path}/${row.entity_id}`);
            }}
          >
            查看
          </Button>
        </Space>
      ),
    },
  ];

  const todoMobileFields = [
    { label: '对象', key: 'entity_type', render: v => <StatusTag status={v} statusMap={ENTITY_LABELS} bordered size="small" /> },
    { label: '动作', key: 'trigger_action' },
    { label: '发起人', key: 'initiator_name' },
    { label: '发起时间', key: 'assigned_at', render: formatDateTime },
    { label: '到期', key: 'due_at', render: formatDateTime },
  ];

  const todoMobileActions = row => [
    { key: 'approve', text: '通过', icon: <CheckOutlined />, type: 'primary',
      onClick: r => onApprove(r.record_id) },
    { key: 'reject', text: '驳回', icon: <CloseOutlined />, danger: true,
      confirm: '确认驳回?', onClick: r => onReject(r.record_id) },
    { key: 'ai', text: 'AI 建议', icon: <RobotOutlined />,
      onClick: r => setAiDrawer({ open: true, entityType: r.entity_type, entityId: r.entity_id }) },
    { key: 'view', text: '查看对象', icon: <EyeOutlined />,
      onClick: r => {
        const path = ENTITY_PATH[r.entity_type];
        if (path) navigate(`/tendering/${path}/${r.entity_id}`);
      } },
  ];

  const initiatedColumns = [
    { title: '审批ID', dataIndex: 'id', width: 100 },
    {
      title: '对象',
      dataIndex: 'entity_type',
      width: 130,
      render: v => <StatusTag status={v} statusMap={ENTITY_LABELS} bordered size="small" />,
    },
    { title: '对象ID', dataIndex: 'entity_id', width: 100 },
    { title: '动作', dataIndex: 'trigger_action', width: 140, render: v => v || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: v => <StatusTag status={v} statusMap={APPROVAL_STATUS} />,
    },
    {
      title: '进度',
      width: 130,
      render: (_, r) => {
        const cur = r.current_node_seq || 0;
        const total = r.total_nodes || 0;
        if (total === 0) return '-';
        return (
          <span style={{ color: '#1677ff' }}>
            {cur}/{total} 节点
          </span>
        );
      },
    },
    { title: '发起时间', dataIndex: 'created_at', width: 160, render: v => formatDateTime(v) },
    { title: '完成时间', dataIndex: 'finished_at', width: 160, render: v => formatDateTime(v) },
  ];

  const expiredCount = todos.filter(t => t.due_at && new Date(t.due_at) < new Date()).length;
  const approvedCount = initiated.filter(i => i.status === 'approved').length;

  return (
    <div>
      <PageHeader
        title="我的审批"
        count={todos.length}
        description={`待我处理 ${todos.length} 项 · 我发起的 ${initiated.length} 项 · 已超时 ${expiredCount} 项`}
        extra={
          <Space wrap>
            <Button onClick={() => navigate('/tendering/approvals/flows')}>
              审批流程模板
            </Button>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={() => navigate('/tendering/approvals/ai')}
            >
              AI 辅助审批中心
            </Button>
          </Space>
        }
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <KpiCard
            title="待我审批"
            value={todos.length}
            tone="warning"
            icon={<ClockCircleOutlined />}
            hint="需要尽快处理"
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已超时"
            value={expiredCount}
            tone="danger"
            icon={<FireOutlined />}
            hint={expiredCount > 0 ? '请优先处理' : '无超时'}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="我发起的"
            value={initiated.length}
            tone="primary"
            icon={<EyeOutlined />}
            hint="审批中"
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已通过"
            value={approvedCount}
            tone="success"
            icon={<CheckCircleOutlined />}
            hint="我发起的已通过数"
          />
        </Col>
      </Row>

      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '0 16px' }}>
        <Tabs
          defaultActiveKey="todos"
          items={[
            {
              key: 'todos',
              label: `待我审批 (${todos.length})`,
              children: (
                <ResponsiveTable
                  dataSource={todos}
                  columns={todoColumns}
                  loading={loading}
                  rowKey="record_id"
                  scroll={{ x: 1200 }}
                  pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }}
                  mobileTitleKey="entity_type"
                  mobileStatusRender={r => <StatusTag status={r.status || 'pending'} statusMap={APPROVAL_STATUS} size="small" />}
                  mobileFields={todoMobileFields}
                  mobileActions={todoMobileActions}
                />
              ),
            },
            {
              key: 'initiated',
              label: `我发起的 (${initiated.length})`,
              children: (
                <ResponsiveTable
                  dataSource={initiated}
                  columns={initiatedColumns}
                  loading={loading}
                  rowKey="id"
                  scroll={{ x: 1200 }}
                  pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }}
                  mobileTitleKey="entity_type"
                  mobileStatusRender={r => <StatusTag status={r.status} statusMap={APPROVAL_STATUS} size="small" />}
                  mobileFields={[
                    { label: '对象', key: 'entity_type', render: v => <StatusTag status={v} statusMap={ENTITY_LABELS} bordered size="small" /> },
                    { label: '动作', key: 'trigger_action' },
                    { label: '发起时间', key: 'created_at', render: formatDateTime },
                  ]}
                />
              ),
            },
          ]}
        />
      </div>

      <Drawer
        open={aiDrawer.open}
        styles={{ wrapper: { width: 720 } }}
        title="AI 辅助审批"
        onClose={() => setAiDrawer({ open: false, entityType: null, entityId: null })}
      >
        {aiDrawer.entityType ? (
          <TenderApprovalAI
            entityType={aiDrawer.entityType}
            entityId={aiDrawer.entityId}
            embedded
          />
        ) : null}
      </Drawer>
    </div>
  );
}
