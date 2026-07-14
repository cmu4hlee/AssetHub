import React, { useEffect, useState } from 'react';
import { Button, Space, message, Modal, Input, Row, Col, Descriptions, Empty, Spin, Timeline, Alert, Card } from 'antd';
import {
  CheckOutlined, CloseOutlined, EditOutlined, PrinterOutlined,
  ToolOutlined, FileTextOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { tenderingAPI } from '../../api/domains/tendering';
import { ACCEPTANCE_STATUS, formatDateTime } from '../../constants/tendering';
import { PageHeader, StatusTag, FlowSteps } from '../../components/tendering';

const FLOW_STEPS = [
  { key: 'pending', title: '待验收' },
  { key: 'accepted', title: '已通过' },
  { key: 'closed', title: '已关闭' },
];
const STATUS_TO_STEP = { pending: 0, accepted: 1, closed: 2, rejected: 0 };

const ACTION_CONFIG = {
  accept: { text: '通过', icon: <CheckOutlined />, type: 'primary' },
  close: { text: '关闭', icon: <ToolOutlined /> },
  reprocess: { text: '重新提交', icon: <ClockCircleOutlined />, type: 'primary' },
};

const NEXT_ACTIONS = {
  pending: ['accept', 'reject'],
  accepted: ['close'],
  rejected: ['reprocess'],
};

export default function TenderAcceptanceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const r = await tenderingAPI.getAcceptance(id);
      setData(r?.data?.id ? r.data : r);
    } catch (e) {
      message.error('获取验收详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [id]);

  const onAction = async name => {
    const fnMap = {
      accept: () => tenderingAPI.acceptAcceptance(id),
      reject: reason => tenderingAPI.rejectAcceptance(id, reason),
      reprocess: () => tenderingAPI.reprocessAcceptance(id),
      close: () => tenderingAPI.closeAcceptance(id),
    };
    try {
      if (name === 'reject') {
        showRejectModal();
        return;
      }
      await fnMap[name]();
      message.success('操作成功');
      fetch();
    } catch (e) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const showRejectModal = () => {
    setRejectReason('');
    Modal.confirm({
      title: '驳回验收',
      content: (
        <Input.TextArea
          rows={3}
          placeholder="请填写驳回理由"
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
          maxLength={500}
          showCount
        />
      ),
      okText: '确认驳回',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await tenderingAPI.rejectAcceptance(id, rejectReason);
          message.success('已驳回');
          fetch();
        } catch (e) {
          message.error(e.response?.data?.message || '驳回失败');
        }
      },
    });
  };

  if (loading && !data) return <Card><Spin /> 正在加载…</Card>;
  if (!data) return <Card><Empty description="验收单不存在" /></Card>;

  const statusInfo = ACCEPTANCE_STATUS[data.status] || { text: data.status, color: 'default' };
  const nextActions = NEXT_ACTIONS[data.status] || [];
  const currentStep = STATUS_TO_STEP[data.status] ?? 0;
  const isRejected = data.status === 'rejected';
  const isEditable = data.status === 'pending';

  return (
    <div>
      <PageHeader
        title="验收单详情"
        description={data.acceptance_code}
        onBack={() => navigate('/tendering/acceptances')}
        statusTag={<StatusTag status={data.status} statusMap={ACCEPTANCE_STATUS} />}
        extra={
          <Space wrap>
            {isEditable ? (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => navigate(`/tendering/acceptances/${id}/edit`)}
              >
                编辑
              </Button>
            ) : null}
            {nextActions.map(name => {
              const cfg = ACTION_CONFIG[name];
              if (!cfg) return null;
              return (
                <Button
                  key={name}
                  type={cfg.type}
                  icon={cfg.icon}
                  danger={name === 'reject'}
                  onClick={() => onAction(name)}
                >
                  {cfg.text}
                </Button>
              );
            })}
            {isRejected ? (
              <Button danger icon={<CloseOutlined />} onClick={() => onAction('reject')}>
                驳回
              </Button>
            ) : null}
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>打印</Button>
          </Space>
        }
      />

      {isRejected ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="此验收单已被驳回"
          description={data.reject_reason || '请修改后重新提交'}
        />
      ) : null}

      {/* 流程步骤 */}
      <div style={{ marginBottom: 16 }}>
        <FlowSteps
          current={currentStep}
          steps={FLOW_STEPS.map((s, idx) => ({
            ...s,
            status: isRejected && idx === 0
              ? 'error'
              : idx < currentStep
              ? 'finish'
              : idx === currentStep
              ? 'process'
              : 'wait',
            description: idx === currentStep ? statusInfo.text : undefined,
          }))}
        />
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card size="small" title="基本信息" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" colon>
              <Descriptions.Item label="验收单号">
                <span style={{ fontFamily: 'monospace' }}>{data.acceptance_code}</span>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusTag status={data.status} statusMap={ACCEPTANCE_STATUS} />
              </Descriptions.Item>
              <Descriptions.Item label="合同">
                {data.contract_code || data.contract_id || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="招标项目">
                {data.tender_code || data.tender_id || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="资产">
                {data.asset_code || data.asset_id || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="计划日期">
                {data.scheduled_date || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="合格数">
                <span style={{ color: '#52c41a', fontWeight: 600 }}>{data.accepted_quantity ?? 0}</span>
              </Descriptions.Item>
              <Descriptions.Item label="不合格数">
                <span style={{ color: '#ff4d4f', fontWeight: 600 }}>{data.rejected_quantity ?? 0}</span>
              </Descriptions.Item>
              <Descriptions.Item label="实际通过时间" span={2}>
                {formatDateTime(data.accepted_at)}
              </Descriptions.Item>
              <Descriptions.Item label="验收说明" span={2}>
                {data.inspection_note || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {data.remark || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card size="small" title="关键节点" style={{ marginBottom: 16 }}>
            <Timeline
              size="small"
              items={[
                {
                  color: 'green',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>创建验收单</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {formatDateTime(data.created_at)}
                      </div>
                    </>
                  ),
                },
                data.accepted_at ? {
                  color: data.status === 'rejected' ? 'red' : 'green',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>
                        {data.status === 'rejected' ? '验收驳回' : '验收通过'}
                      </div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {formatDateTime(data.accepted_at)}
                      </div>
                    </>
                  ),
                } : null,
                {
                  color: statusInfo.color === 'success' ? 'green' : 'gray',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>当前状态</div>
                      <div style={{ marginTop: 4 }}>
                        <StatusTag status={data.status} statusMap={ACCEPTANCE_STATUS} />
                      </div>
                    </>
                  ),
                },
              ].filter(Boolean)}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
