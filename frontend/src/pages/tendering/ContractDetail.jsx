import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import {
  Card, Tag, Button, Space, Spin, message, Empty, Modal, Popconfirm, Upload,
  Row, Col, Descriptions, Timeline, Alert, Input,
} from 'antd';
import {
  EditOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FileTextOutlined, DeleteOutlined, UploadOutlined, SolutionOutlined,
  SignatureOutlined, PlayCircleOutlined, InboxOutlined,
  PrinterOutlined, DownloadOutlined, UserOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  CONTRACT_STATUS,
  CONTRACT_TYPE,
  CONTRACT_STATUS_TRANSITIONS,
  formatMoney,
  formatDateTime,
} from '../../constants/tendering';
import {
  PageHeader,
  StatusTag,
  FlowSteps,
  ResponsiveTable,
} from '../../components/tendering';

const { TextArea } = Input;

// 完整流程
const FLOW_STEP_DEFS = [
  { key: 'draft', title: '起草' },
  { key: 'pending_review', title: '审批' },
  { key: 'approved', title: '审批通过' },
  { key: 'signed', title: '已签订' },
  { key: 'executing', title: '执行中' },
  { key: 'archived', title: '已归档' },
];

// 状态 → 步骤索引
const STATUS_TO_STEP = {
  draft: 0,
  pending_review: 1,
  approved: 2,
  signed: 3,
  executing: 4,
  archived: 5,
  rejected: 1,
  terminated: 4,
};

// 状态流转按钮配置
const STATUS_ACTION_CONFIG = {
  pending_review: { text: '提交审批', icon: <SolutionOutlined />, type: 'primary' },
  approved: { text: '审批通过', icon: <CheckCircleOutlined />, type: 'primary', needComment: true },
  rejected: { text: '审批驳回', icon: <CloseCircleOutlined />, type: 'default', danger: true, needComment: true },
  draft: { text: '退回起草', icon: <EditOutlined />, type: 'default' },
  signed: { text: '签订合同', icon: <SignatureOutlined />, type: 'primary' },
  executing: { text: '开始执行', icon: <PlayCircleOutlined />, type: 'primary' },
  archived: { text: '合同归档', icon: <InboxOutlined />, type: 'primary', confirm: '合同归档后招标项目将进入"已完成"状态，整个招标采购流程闭环。' },
  terminated: { text: '终止合同', icon: <CloseCircleOutlined />, type: 'default', danger: true, confirm: '合同终止后不可恢复，请确认。' },
};

export default function XXX() {
  const canDelete = useCan('tender', 'delete');
  const canEdit = useCan('tender', 'edit');
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [contract, setContract] = useState(null);
  const [reviewModal, setReviewModal] = useState({ open: false, action: null });
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.getContract(id);
      setContract(res?.data ?? res);
    } catch (err) {
      message.error(err.response?.data?.message || '获取合同详情失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (status, comment = null) => {
    setSubmitting(true);
    try {
      await tenderingAPI.changeContractStatus(id, status, comment);
      message.success(`${STATUS_ACTION_CONFIG[status]?.text || '状态更新'}成功`);
      setReviewModal({ open: false, action: null });
      setReviewComment('');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '状态更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const onActionClick = status => {
    const cfg = STATUS_ACTION_CONFIG[status];
    if (!cfg) {
      handleStatusChange(status);
      return;
    }
    if (cfg.needComment) {
      setReviewModal({ open: true, action: status });
      return;
    }
    if (cfg.confirm) {
      Modal.confirm({
        title: `确认${cfg.text}？`,
        content: cfg.confirm,
        okText: '确认',
        cancelText: '取消',
        okButtonProps: status === 'terminated' ? { danger: true } : {},
        onOk: () => handleStatusChange(status),
      });
      return;
    }
    handleStatusChange(status);
  };

  const handleUpload = async file => {
    try {
      await tenderingAPI.uploadContractFile(id, file, 'contract');
      message.success('附件上传成功');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '附件上传失败');
    }
    return false;
  };

  const handleDeleteFile = async fileId => {
    try {
      await tenderingAPI.deleteContractFile(fileId);
      message.success('附件删除成功');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '附件删除失败');
    }
  };

  const handleDelete = async () => {
    try {
      await tenderingAPI.deleteContract(id);
      message.success('合同已删除');
      navigate('/tendering/contracts');
    } catch (err) {
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  if (loading && !contract) return <Card><Spin /> 正在加载…</Card>;
  if (!contract) return <Card><Empty description="合同不存在" /></Card>;

  const statusInfo = CONTRACT_STATUS[contract.status] || { text: contract.status, color: 'default' };
  const typeInfo = CONTRACT_TYPE[contract.contract_type] || { text: contract.contract_type, color: 'default' };
  const allowedNext = CONTRACT_STATUS_TRANSITIONS[contract.status] || [];
  const currentStep = STATUS_TO_STEP[contract.status] ?? 0;
  const isRejected = contract.status === 'rejected';
  const isTerminated = contract.status === 'terminated';
  const isEditable = contract.status === 'draft' || contract.status === 'rejected';
  const isDeletable = contract.status === 'draft' || contract.status === 'terminated';

  return (
    <div>
      <PageHeader
        title={contract.contract_name}
        description={contract.contract_code}
        onBack={() => navigate('/tendering/contracts')}
        statusTag={
          <Space size="small">
            <StatusTag status={contract.contract_type} statusMap={CONTRACT_TYPE} size="small" bordered />
            <StatusTag status={contract.status} statusMap={CONTRACT_STATUS} />
          </Space>
        }
        extra={
          <Space wrap>
            {isEditable ? (
              <Button
                icon={<EditOutlined />}
                onClick={() => navigate(`/tendering/contracts/edit/${id}`)}
              >
                编辑
              </Button>
            ) : null}
            {allowedNext.map(status => {
              const cfg = STATUS_ACTION_CONFIG[status];
              if (!cfg) return null;
              return (
                <Button
                  key={status}
                  type={cfg.type}
                  danger={cfg.danger}
                  icon={cfg.icon}
                  onClick={() => onActionClick(status)}
                >
                  {cfg.text}
                </Button>
              );
            })}
            {isDeletable ? (
              <Popconfirm title="确认删除该合同？" onConfirm={handleDelete}>
                <Button danger icon={<DeleteOutlined />} disabled={!canDelete}>删除</Button>
              </Popconfirm>
            ) : null}
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              打印
            </Button>
          </Space>
        }
      />

      {isRejected ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="此合同已被驳回，请修改后重新提交审批"
        />
      ) : null}
      {isTerminated ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="此合同已终止"
        />
      ) : null}

      {/* 流程步骤 */}
      <div style={{ marginBottom: 16 }}>
        <FlowSteps
          current={currentStep}
          steps={FLOW_STEP_DEFS.map((s, idx) => ({
            ...s,
            status:
              isRejected && idx === 1
                ? 'error'
                : isTerminated && idx === 4
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
              <Descriptions.Item label="合同编号">
                <span style={{ fontFamily: 'monospace' }}>{contract.contract_code}</span>
              </Descriptions.Item>
              <Descriptions.Item label="合同类型">
                <StatusTag status={contract.contract_type} statusMap={CONTRACT_TYPE} size="small" bordered />
              </Descriptions.Item>
              <Descriptions.Item label="合同金额" span={2}>
                <span style={{ color: '#fa8c16', fontWeight: 600, fontSize: 18 }}>
                  {formatMoney(contract.contract_amount)} {contract.currency}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="关联招标项目" span={2}>
                {contract.tender_code ? (
                  <a onClick={() => navigate(`/tendering/projects/${contract.tender_id}`)}>
                    {contract.tender_code} {contract.tender_title ? `- ${contract.tender_title}` : ''}
                  </a>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="供应商" span={2}>
                {contract.supplier_name || '-'}
                {contract.unified_code ? `（统一信用代码：${contract.unified_code}）` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="签订日期">
                {contract.sign_date || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="履行期限">
                {contract.start_date && contract.end_date
                  ? `${contract.start_date} 至 ${contract.end_date}`
                  : (contract.start_date || contract.end_date || '-')}
              </Descriptions.Item>
              <Descriptions.Item label="需求部门">
                {contract.department || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="联系人">
                {contract.contact_person || '-'} {contract.contact_phone || ''}
              </Descriptions.Item>
              <Descriptions.Item label="付款条款" span={2}>
                {contract.payment_terms || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="合同内容" span={2}>
                {contract.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {contract.remark || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 流程信息 */}
          {(contract.reviewer_id || contract.signer_id || contract.archived_by) ? (
            <Card size="small" title="流程信息" style={{ marginBottom: 16 }}>
              <Descriptions column={{ xs: 1, sm: 2 }} size="small" colon>
                {contract.reviewer_id ? (
                  <>
                    <Descriptions.Item label="审批人">用户ID: {contract.reviewer_id}</Descriptions.Item>
                    <Descriptions.Item label="审批时间">
                      {formatDateTime(contract.reviewed_at)}
                    </Descriptions.Item>
                    <Descriptions.Item label="审批意见" span={2}>
                      {contract.review_comment || '-'}
                    </Descriptions.Item>
                  </>
                ) : null}
                {contract.signer_id ? (
                  <>
                    <Descriptions.Item label="签订人">用户ID: {contract.signer_id}</Descriptions.Item>
                    <Descriptions.Item label="签订时间">
                      {formatDateTime(contract.signed_at)}
                    </Descriptions.Item>
                  </>
                ) : null}
                {contract.archived_by ? (
                  <>
                    <Descriptions.Item label="归档人">用户ID: {contract.archived_by}</Descriptions.Item>
                    <Descriptions.Item label="归档时间">
                      {formatDateTime(contract.archived_at)}
                    </Descriptions.Item>
                  </>
                ) : null}
              </Descriptions>
            </Card>
          ) : null}

          {/* 合同附件 */}
          <Card
            size="small"
            title={
              <Space>
                <FileTextOutlined /> 合同附件
              </Space>
            }
            extra={
              <Upload
                showUploadList={false}
                beforeUpload={handleUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip,.rar"
              >
                <Button size="small" icon={<UploadOutlined />}>上传附件</Button>
              </Upload>
            }
          >
            {(!contract.files || contract.files.length === 0) ? (
              <Empty description="暂无附件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveTable
                size="small"
                dataSource={contract.files}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: '文件名',
                    dataIndex: 'original_name',
                    ellipsis: true,
                    render: (v, r) => (
                      <a
                        href={r.file_url || `/uploads/tendering/contracts/${r.file_name}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {v || r.file_name}
                      </a>
                    ),
                  },
                  { title: '类型', dataIndex: 'file_type', width: 100, render: v => v || 'contract' },
                  {
                    title: '大小',
                    dataIndex: 'file_size',
                    width: 110,
                    align: 'right',
                    render: v => v ? `${(Number(v) / 1024).toFixed(1)} KB` : '-',
                  },
                  { title: '上传时间', dataIndex: 'created_at', width: 160, render: v => formatDateTime(v) },
                  {
                    title: '操作',
                    key: 'action',
                    width: 80,
                    render: (_, record) => (
                      <Popconfirm title="确认删除该附件？" onConfirm={() => handleDeleteFile(record.id)}>
                        <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>删除</Button>
                      </Popconfirm>
                    ),
                  },
                ]}
                mobileTitleKey="original_name"
                mobileFields={[
                  { label: '类型', key: 'file_type' },
                  {
                    label: '大小',
                    key: 'file_size',
                    render: v => v ? `${(Number(v) / 1024).toFixed(1)} KB` : '-',
                  },
                  { label: '上传时间', key: 'created_at', render: formatDateTime },
                ]}
                mobileActions={[
                  {
                    key: 'delete',
                    text: '删除',
                    icon: <DeleteOutlined />,
                    danger: true,
                    confirm: '确认删除该附件？',
                    onClick: r => handleDeleteFile(r.id),
                  },
                ]}
              />
            )}
          </Card>
        </Col>

        {/* 侧栏 */}
        <Col xs={24} lg={8}>
          <Card size="small" title="关键节点" style={{ marginBottom: 16 }}>
            <Timeline
              size="small"
              items={[
                {
                  color: 'green',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>创建合同</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {formatDateTime(contract.created_at)}
                      </div>
                    </>
                  ),
                },
                contract.reviewed_at ? {
                  color: contract.status === 'rejected' ? 'red' : 'blue',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>审批{contract.status === 'rejected' ? '驳回' : '通过'}</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {formatDateTime(contract.reviewed_at)}
                      </div>
                    </>
                  ),
                } : null,
                contract.signed_at ? {
                  color: 'green',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>签订合同</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {formatDateTime(contract.signed_at)}
                      </div>
                    </>
                  ),
                } : null,
                contract.archived_at ? {
                  color: 'gray',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>合同归档</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {formatDateTime(contract.archived_at)}
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
                        <StatusTag status={contract.status} statusMap={CONTRACT_STATUS} />
                      </div>
                    </>
                  ),
                },
              ].filter(Boolean)}
            />
          </Card>

          <Card size="small" title="供应商信息" style={{ marginBottom: 16 }}>
            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>供应商</div>
                <div style={{ fontWeight: 500 }}>{contract.supplier_name || '-'}</div>
              </div>
              {contract.supplier_contact ? (
                <div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>联系人</div>
                  <div>{contract.supplier_contact}</div>
                </div>
              ) : null}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 审批意见弹窗 */}
      <Modal
        title={reviewModal.action === 'approved' ? '审批通过' : '审批驳回'}
        open={reviewModal.open}
        onCancel={() => {
          setReviewModal({ open: false, action: null });
          setReviewComment('');
        }}
        onOk={() => handleStatusChange(reviewModal.action, reviewComment)}
        confirmLoading={submitting}
        okText="确认"
        cancelText="取消"
        okButtonProps={reviewModal.action === 'rejected' ? { danger: true } : {}}
        width={520}
      >
        <TextArea
          rows={4}
          placeholder={reviewModal.action === 'approved' ? '请输入审批意见（可选）' : '请输入驳回原因'}
          value={reviewComment}
          onChange={e => setReviewComment(e.target.value)}
          maxLength={500}
          showCount
        />
      </Modal>
    </div>
  );
}
