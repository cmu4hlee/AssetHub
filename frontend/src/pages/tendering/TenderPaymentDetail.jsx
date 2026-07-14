import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Button, Space, message, Popconfirm, Row, Col, Descriptions, Empty, Spin,
  Timeline, Alert, Modal,
} from 'antd';
import {
  ArrowLeftOutlined, SendOutlined, DollarOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PrinterOutlined, ToolOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  PAYMENT_STATUS, PAYMENT_STATUS_TRANSITIONS, PAYMENT_METHOD,
  formatMoney, formatDateTime,
} from '../../constants/tendering';
import {
  PageHeader, StatusTag, FlowSteps,
} from '../../components/tendering';

const ACTION_LABELS = {
  submit: { text: '提交', icon: <SendOutlined />, type: 'primary' },
  pay: { text: '开始付款', icon: <DollarOutlined />, type: 'primary' },
  complete: { text: '完成付款', icon: <CheckCircleOutlined />, type: 'primary' },
  're-submit': { text: '重新提交', icon: <SendOutlined />, type: 'primary' },
  cancel: { text: '取消付款', icon: <CloseCircleOutlined />, danger: true, needConfirm: true,
    confirmText: '确认取消该付款？取消后无法恢复。' },
};

const FLOW_STEPS = [
  { key: 'draft', title: '草稿' },
  { key: 'submitted', title: '已提交' },
  { key: 'paying', title: '付款中' },
  { key: 'paid', title: '已付款' },
];
const STATUS_TO_STEP = { draft: 0, submitted: 1, paying: 2, paid: 3, failed: 2, cancelled: 1 };

export default function TenderPaymentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await tenderingAPI.getPayment(id);
      setData(r?.data?.id ? r.data : r);
    } catch (e) {
      message.error('获取付款单失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  const onAction = async name => {
    const cfg = ACTION_LABELS[name];
    if (cfg?.needConfirm) {
      Modal.confirm({
        title: cfg.confirmText,
        okText: '确认',
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            const map = {
              submit: tenderingAPI.submitPayment, pay: tenderingAPI.payPayment,
              complete: tenderingAPI.completePayment, 're-submit': tenderingAPI.reSubmitPayment,
              cancel: tenderingAPI.cancelPayment,
            };
            await map[name](id);
            message.success('操作成功');
            fetch();
          } catch (e) {
            message.error(e.response?.data?.message || '操作失败');
          }
        },
      });
      return;
    }
    try {
      const map = {
        submit: tenderingAPI.submitPayment, pay: tenderingAPI.payPayment,
        complete: tenderingAPI.completePayment, 're-submit': tenderingAPI.reSubmitPayment,
        cancel: tenderingAPI.cancelPayment,
      };
      await map[name](id);
      message.success('操作成功');
      fetch();
    } catch (e) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  if (loading && !data) return <Card><Spin /> 正在加载…</Card>;
  if (!data) return <Card><Empty description="付款单不存在" /></Card>;

  const statusInfo = PAYMENT_STATUS[data.status] || { text: data.status, color: 'default' };
  const nextActions = PAYMENT_STATUS_TRANSITIONS[data.status] || [];
  const currentStep = STATUS_TO_STEP[data.status] ?? 0;
  const isFailed = data.status === 'failed';
  const isCancelled = data.status === 'cancelled';
  const cancelable = ['draft', 'submitted', 'paying', 'failed'].includes(data.status);

  return (
    <div>
      <PageHeader
        title="付款单详情"
        description={data.payment_code}
        onBack={() => navigate('/tendering/payments')}
        statusTag={<StatusTag status={data.status} statusMap={PAYMENT_STATUS} />}
        extra={
          <Space wrap>
            {nextActions.map(name => {
              const cfg = ACTION_LABELS[name];
              if (!cfg) return null;
              return (
                <Button
                  key={name}
                  type={cfg.type}
                  danger={cfg.danger}
                  icon={cfg.icon}
                  onClick={() => onAction(name)}
                >
                  {cfg.text}
                </Button>
              );
            })}
            {cancelable && !nextActions.includes('cancel') ? (
              <Button danger icon={<CloseCircleOutlined />} onClick={() => onAction('cancel')}>
                取消
              </Button>
            ) : null}
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>打印</Button>
          </Space>
        }
      />

      {isFailed ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="付款失败"
          description={data.failure_reason || '请检查付款信息后重新提交'}
        />
      ) : null}
      {isCancelled ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="此付款单已取消"
        />
      ) : null}

      <div style={{ marginBottom: 16 }}>
        <FlowSteps
          current={currentStep}
          steps={FLOW_STEPS.map((s, idx) => ({
            ...s,
            status: isFailed && idx === 2
              ? 'error'
              : isCancelled
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
              <Descriptions.Item label="付款单号">
                <span style={{ fontFamily: 'monospace' }}>{data.payment_code}</span>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusTag status={data.status} statusMap={PAYMENT_STATUS} />
              </Descriptions.Item>
              <Descriptions.Item label="收款方" span={2}>
                {data.payee_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="付款金额" span={2}>
                <span style={{ color: '#fa8c16', fontWeight: 600, fontSize: 18 }}>
                  {formatMoney(data.amount)} {data.currency || 'CNY'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="付款方式">
                {data.pay_method ? (PAYMENT_METHOD[data.pay_method]?.text || data.pay_method) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="计划付款日">
                {data.pay_date || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="开户银行">
                {data.bank_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="收款账号">
                {data.bank_account || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="合同ID">{data.contract_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="里程碑ID">{data.milestone_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="发票ID">{data.invoice_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="供应商ID">{data.supplier_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="审批人">{data.approved_by || '-'}</Descriptions.Item>
              <Descriptions.Item label="审批时间">{formatDateTime(data.approved_at)}</Descriptions.Item>
              <Descriptions.Item label="完成时间" span={2}>
                {formatDateTime(data.paid_at)}
              </Descriptions.Item>
              {data.failure_reason ? (
                <Descriptions.Item label="失败原因" span={2}>
                  <span style={{ color: '#ff4d4f' }}>{data.failure_reason}</span>
                </Descriptions.Item>
              ) : null}
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
                      <div style={{ fontWeight: 500, fontSize: 13 }}>创建付款单</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {formatDateTime(data.created_at)}
                      </div>
                    </>
                  ),
                },
                data.paid_at ? {
                  color: isFailed ? 'red' : 'green',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>
                        {isFailed ? '付款失败' : '完成付款'}
                      </div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {formatDateTime(data.paid_at)}
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
                        <StatusTag status={data.status} statusMap={PAYMENT_STATUS} />
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
