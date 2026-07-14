import React, { useEffect, useState, useCallback } from 'react';
import { useCan } from '../../hooks';
import {
  Card, Button, Space, message, Popconfirm, Row, Col, Descriptions, Empty, Spin,
  Timeline, Alert, Modal,
} from 'antd';
import {
  SendOutlined, CheckCircleOutlined, ExclamationCircleOutlined, FileTextOutlined,
  DollarOutlined, InboxOutlined, PrinterOutlined, DeleteOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  INVOICE_STATUS, INVOICE_STATUS_TRANSITIONS, INVOICE_KIND,
  formatMoney, formatDateTime,
} from '../../constants/tendering';
import {
  PageHeader, StatusTag, FlowSteps, ResponsiveTable,
} from '../../components/tendering';

const ACTION_LABELS = {
  submit: { text: '提交核验', icon: <SendOutlined />, type: 'primary' },
  verify: { text: '核验通过', icon: <CheckCircleOutlined />, type: 'primary' },
  retry: { text: '重新提交', icon: <ExclamationCircleOutlined />, type: 'primary' },
  claim: { text: '认证抵扣', icon: <FileTextOutlined />, type: 'primary' },
  pay: { text: '标记已付款', icon: <DollarOutlined />, type: 'primary' },
  archive: { text: '归档', icon: <InboxOutlined /> },
  cancel: { text: '取消', icon: <CloseCircleOutlined />, danger: true, needConfirm: true,
    confirmText: '确认取消此发票？取消后无法恢复。' },
};

const FLOW_STEPS = [
  { key: 'draft', title: '待提交' },
  { key: 'pending', title: '待核验' },
  { key: 'verified', title: '已核验' },
  { key: 'claimed', title: '已认证' },
  { key: 'paid', title: '已付款' },
  { key: 'archived', title: '已归档' },
];
const STATUS_TO_STEP = {
  draft: 0, pending: 1, verified: 2, claimed: 3, paid: 4, archived: 5,
  errored: 1, cancelled: 1,
};

export default function XXX() {
  const canDelete = useCan('tender', 'delete');
  const canEdit = useCan('tender', 'edit');
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.getInvoice(id);
      setData(res?.data?.id ? res.data : res);
    } catch (err) {
      message.error('获取发票失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAction = async name => {
    const cfg = ACTION_LABELS[name];
    const fnMap = {
      submit: tenderingAPI.submitInvoice,
      verify: tenderingAPI.verifyInvoice,
      claim: tenderingAPI.claimInvoice,
      pay: tenderingAPI.payInvoice,
      archive: tenderingAPI.archiveInvoice,
      cancel: tenderingAPI.cancelInvoice,
      retry: tenderingAPI.retryInvoice,
    };
    const doIt = async () => {
      try {
        await fnMap[name](id);
        message.success('操作成功');
        fetchData();
      } catch (err) {
        message.error(err.response?.data?.message || '操作失败');
      }
    };
    if (cfg?.needConfirm) {
      Modal.confirm({
        title: cfg.confirmText,
        okText: '确认',
        okButtonProps: { danger: true },
        onOk: doIt,
      });
      return;
    }
    doIt();
  };

  const handleGenerateMilestone = () => {
    Modal.confirm({
      title: '生成付款里程碑',
      content: `基于发票 ${data.invoice_code} 自动创建付款里程碑，确认继续？`,
      onOk: async () => {
        try {
          const r = await tenderingAPI.generateMilestone(id, `由发票 ${data.invoice_code} 自动创建`);
          message.success(`已生成里程碑 #${r?.data?.id || r.id}`);
          fetchData();
        } catch (err) {
          message.error(err.response?.data?.message || '生成里程碑失败');
        }
      },
    });
  };

  const handleDeleteFile = async fileId => {
    try {
      await tenderingAPI.deleteInvoiceFile(fileId);
      message.success('已删除');
      fetchData();
    } catch (e) {
      message.error(e.response?.data?.message || '删除失败');
    }
  };

  if (loading && !data) return <Card><Spin /> 正在加载…</Card>;
  if (!data) return <Card><Empty description="发票不存在" /></Card>;

  const statusInfo = INVOICE_STATUS[data.status] || { text: data.status, color: 'default' };
  const kindInfo = INVOICE_KIND[data.invoice_kind] || { text: data.invoice_kind, color: 'default' };
  const nextActions = INVOICE_STATUS_TRANSITIONS[data.status] || [];
  const currentStep = STATUS_TO_STEP[data.status] ?? 0;
  const isErrored = data.status === 'errored';
  const isCancelled = data.status === 'cancelled';
  const canGenerateMilestone = data.contract_id && !data.milestone_id &&
    ['draft', 'pending', 'errored'].includes(data.status);

  const fileColumns = [
    {
      title: '文件名',
      dataIndex: 'original_name',
      ellipsis: true,
      render: (v, r) => v || r.file_name,
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      width: 100,
      align: 'right',
      render: v => v ? `${(Number(v) / 1024).toFixed(1)} KB` : '-',
    },
    { title: '上传人', dataIndex: 'uploaded_by', width: 100, render: v => v || '-' },
    { title: '上传时间', dataIndex: 'created_at', width: 160, render: v => formatDateTime(v) },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, row) => (
        <Popconfirm title="删除附件？" onConfirm={() => handleDeleteFile(row.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="发票详情"
        description={data.invoice_code}
        onBack={() => navigate('/tendering/invoices')}
        statusTag={
          <Space size="small">
            <StatusTag status={data.invoice_kind} statusMap={INVOICE_KIND} size="small" bordered />
            <StatusTag status={data.status} statusMap={INVOICE_STATUS} />
          </Space>
        }
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
                  onClick={() => runAction(name)}
                >
                  {cfg.text}
                </Button>
              );
            })}
            {canGenerateMilestone ? (
              <Button onClick={handleGenerateMilestone}>生成付款里程碑</Button>
            ) : null}
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>打印</Button>
          </Space>
        }
      />

      {isErrored ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="核验失败"
          description={data.verify_failed_reason || '请检查发票信息后重新提交'}
        />
      ) : null}
      {isCancelled ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="此发票已取消"
        />
      ) : null}

      <div style={{ marginBottom: 16 }}>
        <FlowSteps
          current={currentStep}
          steps={FLOW_STEPS.map((s, idx) => ({
            ...s,
            status: isErrored && idx === 1
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
              <Descriptions.Item label="系统编号">
                <span style={{ fontFamily: 'monospace' }}>{data.invoice_code}</span>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusTag status={data.status} statusMap={INVOICE_STATUS} />
              </Descriptions.Item>
              <Descriptions.Item label="实际发票号">{data.invoice_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="发票代码">{data.invoice_code_str || '-'}</Descriptions.Item>
              <Descriptions.Item label="开票日期">{data.issue_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="入账属性">
                {data.accounting_kind === 'capitalize' ? '资本化' : '费用化'}
              </Descriptions.Item>
              <Descriptions.Item label="含税金额" span={2}>
                <span style={{ color: '#fa8c16', fontWeight: 600, fontSize: 18 }}>
                  {formatMoney(data.amount)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="税率">{data.tax_rate ?? '-'}%</Descriptions.Item>
              <Descriptions.Item label="税额">{formatMoney(data.tax_amount)}</Descriptions.Item>
              <Descriptions.Item label="不含税金额" span={2}>
                {formatMoney(data.excluding_amount)}
              </Descriptions.Item>
              <Descriptions.Item label="关联合同ID">{data.contract_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="关联里程碑">{data.milestone_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="关联招标">{data.tender_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="供应商">{data.supplier_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="资产入账">{data.asset_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="核验时间" span={2}>{formatDateTime(data.verified_at)}</Descriptions.Item>
              <Descriptions.Item label="抵扣时间" span={2}>{formatDateTime(data.claimed_at)}</Descriptions.Item>
              <Descriptions.Item label="付款时间" span={2}>{formatDateTime(data.paid_at)}</Descriptions.Item>
              <Descriptions.Item label="归档时间" span={2}>{formatDateTime(data.archived_at)}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{data.remark || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title="发票附件" style={{ marginBottom: 16 }}>
            {(!data.files || data.files.length === 0) ? (
              <Empty description="暂无附件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveTable
                size="small"
                dataSource={data.files}
                rowKey="id"
                pagination={false}
                columns={fileColumns}
                mobileTitleKey="original_name"
                mobileFields={[
                  { label: '大小', key: 'file_size', render: v => v ? `${(Number(v) / 1024).toFixed(1)} KB` : '-' },
                  { label: '上传时间', key: 'created_at', render: formatDateTime },
                ]}
                mobileActions={[
                  {
                    key: 'delete', text: '删除', icon: <DeleteOutlined />, danger: true,
                    confirm: '删除附件？', onClick: r => handleDeleteFile(r.id),
                  },
                ]}
              />
            )}
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
                      <div style={{ fontWeight: 500, fontSize: 13 }}>开票</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {data.issue_date || formatDateTime(data.created_at)}
                      </div>
                    </>
                  ),
                },
                data.verified_at ? {
                  color: isErrored ? 'red' : 'blue',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>核验</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {formatDateTime(data.verified_at)}
                      </div>
                    </>
                  ),
                } : null,
                data.paid_at ? {
                  color: 'green',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>付款</div>
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
                        <StatusTag status={data.status} statusMap={INVOICE_STATUS} />
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
