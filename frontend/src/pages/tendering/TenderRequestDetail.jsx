import React, { useEffect, useState } from 'react';
import {
  Card, Button, Space, message, Modal, Input, Row, Col, Descriptions, Empty, Spin,
  Timeline, Alert, Divider,
} from 'antd';
import {
  CheckOutlined, CloseOutlined, EditOutlined, PrinterOutlined,
  UserOutlined, CalendarOutlined, FileTextOutlined, LinkOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  REQUEST_STATUS,
  REQUEST_STATUS_TRANSITIONS,
  TENDER_CATEGORY,
  formatMoney,
  formatDateTime,
} from '../../constants/tendering';
import {
  PageHeader,
  StatusTag,
  FlowSteps,
} from '../../components/tendering';

// 完整流程步骤定义（按 REQUEST_STATUS_TRANSITIONS 顺序）
const FLOW_STEP_DEFS = [
  { key: 'draft', title: '草稿' },
  { key: 'applying', title: '提交审批' },
  { key: 'approved', title: '审批通过' },
  { key: 'awarded', title: '已定标' },
  { key: 'contract_signing', title: '合同签订' },
  { key: 'accepting', title: '验收中' },
  { key: 'completed', title: '已完成' },
];

// 状态 → 流程步骤索引
const STATUS_TO_STEP = {
  draft: 0,
  applying: 1,
  approved: 2,
  awarded: 3,
  contract_signing: 4,
  accepting: 5,
  completed: 6,
  rejected: 1, // 驳回时回退到审批节点
  cancelled: 0,
};

export default function TenderRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [comment, setComment] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.getProcurementRequest(id);
      const row =
        res?.data && !Array.isArray(res.data)
          ? res.data
          : Array.isArray(res?.data)
          ? res.data[0]
          : res;
      setData(row);
    } catch (err) {
      message.error('获取采购申请失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleApprove = action => {
    Modal.confirm({
      title: action === 'reject' ? '驳回采购申请' : '审批通过采购申请',
      width: 460,
      content: (
        <Input.TextArea
          rows={3}
          placeholder={action === 'reject' ? '请填写驳回理由' : '请填写审批意见（可选）'}
          value={comment}
          onChange={e => setComment(e.target.value)}
        />
      ),
      okText: action === 'reject' ? '确认驳回' : '通过',
      okButtonProps: { danger: action === 'reject' },
      cancelText: '取消',
      onOk: async () => {
        try {
          await tenderingAPI.approveProcurementRequest(id, action, comment);
          message.success(action === 'reject' ? '已驳回' : '已审批');
          setComment('');
          fetchData();
        } catch (err) {
          message.error(err.response?.data?.message || '操作失败');
        }
      },
    });
  };

  if (loading && !data) {
    return (
      <Card>
        <Spin /> 正在加载…
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <Empty description="采购申请不存在或已被删除" />
      </Card>
    );
  }

  const statusInfo = REQUEST_STATUS[data.status] || { text: data.status, color: 'default' };
  const isApplying = data.status === 'applying';
  const isDraft = data.status === 'draft';
  const currentStep = STATUS_TO_STEP[data.status] ?? 0;
  const isRejected = data.status === 'rejected';
  const isCancelled = data.status === 'cancelled';

  return (
    <div>
      <PageHeader
        title={`采购申请详情`}
        description={data.request_code || data.tender_code || `ID: ${data.id}`}
        onBack={() => navigate('/tendering/requests')}
        statusTag={<StatusTag status={data.status} statusMap={REQUEST_STATUS} />}
        extra={
          <Space wrap>
            {isApplying ? (
              <>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => handleApprove('approve')}
                >
                  通过
                </Button>
                <Button danger icon={<CloseOutlined />} onClick={() => handleApprove('reject')}>
                  驳回
                </Button>
              </>
            ) : null}
            {isDraft ? (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => navigate(`/tendering/requests/${id}/edit`)}
              >
                编辑
              </Button>
            ) : null}
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              打印
            </Button>
          </Space>
        }
      />

      {/* 异常状态提示 */}
      {isRejected ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="此申请已被驳回"
          description="如需修改，请联系审批人，或重新发起采购申请"
        />
      ) : null}
      {isCancelled ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="此申请已取消"
        />
      ) : null}

      {/* 流程进度 */}
      <div style={{ marginBottom: 16 }}>
        <FlowSteps
          current={currentStep}
          steps={FLOW_STEP_DEFS.map((s, idx) => ({
            ...s,
            status:
              isRejected && idx === 1
                ? 'error'
                : idx < currentStep
                ? 'finish'
                : idx === currentStep
                ? 'process'
                : 'wait',
            description: idx === currentStep ? '当前节点' : undefined,
          }))}
        />
      </div>

      <Row gutter={16}>
        {/* 主区：详细信息 */}
        <Col xs={24} lg={16}>
          <Card size="small" title="基本信息" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" colon>
              <Descriptions.Item label="申请编号">
                <span style={{ fontFamily: 'monospace' }}>
                  {data.request_code || data.tender_code || '-'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="流程分类">
                <StatusTag
                  status={data.tender_category}
                  statusMap={TENDER_CATEGORY}
                  bordered
                />
              </Descriptions.Item>
              <Descriptions.Item label="采购标题" span={2}>
                {data.title || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="申请人">
                {data.requestor_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="申请部门">
                {data.request_department || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="预算金额" span={2}>
                <span style={{ color: '#fa8c16', fontWeight: 600, fontSize: 16 }}>
                  {formatMoney(data.request_budget)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="期望到货日期" span={2}>
                {data.expected_delivery_date || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title="规格要求" style={{ marginBottom: 16 }}>
            {data.asset_specification ? (
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'inherit',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: '#262626',
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              >
                {data.asset_specification}
              </pre>
            ) : (
              <Empty description="未填写规格要求" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>

          {/* 关联信息 */}
          <Card
            size="small"
            title={
              <Space>
                <LinkOutlined /> 关联信息
              </Space>
            }
          >
            <Empty
              description="暂无关联的招标、合同或验收记录"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Card>
        </Col>

        {/* 侧栏：关键节点、操作、申请人 */}
        <Col xs={24} lg={8}>
          <Card size="small" title="关键节点" style={{ marginBottom: 16 }}>
            <Timeline
              size="small"
              items={[
                {
                  color: 'green',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>创建申请</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {formatDateTime(data.created_at)} · {data.requestor_name || '-'}
                      </div>
                    </>
                  ),
                },
                {
                  color: data.updated_at && data.updated_at !== data.created_at ? 'blue' : 'gray',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>最近更新</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {formatDateTime(data.updated_at)}
                      </div>
                    </>
                  ),
                },
                {
                  color: statusInfo.color === 'success' ? 'green' : 'gray',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>当前状态</div>
                      <div style={{ marginTop: 4 }}>
                        <StatusTag status={data.status} statusMap={REQUEST_STATUS} />
                      </div>
                    </>
                  ),
                },
              ]}
            />
          </Card>

          <Card size="small" title="申请人" style={{ marginBottom: 16 }}>
            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
              <Space>
                <UserOutlined style={{ color: '#8c8c8c' }} />
                <span>{data.requestor_name || '未指定'}</span>
              </Space>
              <Space>
                <FileTextOutlined style={{ color: '#8c8c8c' }} />
                <span>{data.request_department || '未指定部门'}</span>
              </Space>
              <Divider style={{ margin: '8px 0' }} />
              <Space>
                <CalendarOutlined style={{ color: '#8c8c8c' }} />
                <span style={{ fontSize: 12, color: '#595959' }}>
                  创建于 {formatDateTime(data.created_at)}
                </span>
              </Space>
            </Space>
          </Card>

          {/* 可执行的下一步操作 */}
          {REQUEST_STATUS_TRANSITIONS[data.status]?.length > 0 ? (
            <Card size="small" title="可执行操作">
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                {REQUEST_STATUS_TRANSITIONS[data.status].map(next => {
                  const nextInfo = REQUEST_STATUS[next] || { text: next };
                  return (
                    <div
                      key={next}
                      style={{
                        padding: '6px 10px',
                        background: '#fafbfc',
                        borderRadius: 4,
                        fontSize: 12,
                        color: '#595959',
                      }}
                    >
                      → {nextInfo.text}
                    </div>
                  );
                })}
              </Space>
            </Card>
          ) : null}
        </Col>
      </Row>
    </div>
  );
}
