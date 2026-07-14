import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Tag, Button, Space, Spin, message, Empty, Table, Modal, Popconfirm,
  Row, Col, Descriptions, Alert, Timeline,
} from 'antd';
import {
  EditOutlined, FileTextOutlined, TeamOutlined, TrophyOutlined,
  BarChartOutlined, UnorderedListOutlined, QrcodeOutlined,
  FileProtectOutlined, PrinterOutlined, ReloadOutlined,
  ClockCircleOutlined, UserOutlined, LinkOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  TENDER_STATUS,
  TENDER_TYPE,
  TENDER_METHOD,
  CONTRACT_STATUS,
  formatMoney,
  formatDateTime,
} from '../../constants/tendering';
import {
  PageHeader,
  StatusTag,
  FlowSteps,
  ResponsiveTable,
} from '../../components/tendering';
import TenderShareQRModal from './TenderShareQRModal';

// 流程节点
const FLOW_STEPS = [
  { key: 'draft', title: '草稿' },
  { key: 'published', title: '已发布' },
  { key: 'bidding', title: '投标中' },
  { key: 'evaluating', title: '评标中' },
  { key: 'awarded', title: '已定标' },
  { key: 'contract_signing', title: '合同签订' },
  { key: 'completed', title: '已完成' },
];
const STATUS_TO_STEP = {
  draft: 0, published: 1, bidding: 2, evaluating: 3, awarded: 4,
  contract_signing: 5, completed: 6, cancelled: 0,
};

const STATUS_ACTION_CONFIG = {
  published: { text: '进入投标期', confirm: '进入投标期后供应商开始提交投标。' },
  bidding: { text: '进入评标', confirm: '投标期结束，进入评标阶段。' },
};

export default function TenderProjectDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [tender, setTender] = useState(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [evaluations, setEvaluations] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [bids, setBids] = useState([]);
  const [contracts, setContracts] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tenderRes, inviteRes, bidsRes, evalRes, contractsRes] = await Promise.all([
        tenderingAPI.getProject(id),
        tenderingAPI.listInvitations(id),
        tenderingAPI.listBids(id),
        tenderingAPI.listEvaluations(id),
        tenderingAPI.listContractsByTender(id),
      ]);
      setTender(tenderRes?.data ?? tenderRes);
      setInvitations(Array.isArray(inviteRes?.data) ? inviteRes.data : []);
      setBids(Array.isArray(bidsRes?.data) ? bidsRes.data : []);
      setEvaluations(Array.isArray(evalRes?.data) ? evalRes.data : []);
      setContracts(Array.isArray(contractsRes?.data) ? contractsRes.data : []);
    } catch (err) {
      message.error(err.response?.data?.message || '获取招标详情失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async status => {
    try {
      await tenderingAPI.changeProjectStatus(id, status);
      message.success('状态更新成功');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '状态更新失败');
    }
  };

  const onActionClick = (status) => {
    const cfg = STATUS_ACTION_CONFIG[status];
    if (cfg) {
      Modal.confirm({
        title: `确认${cfg.text}？`,
        content: cfg.confirm,
        okText: '确认',
        cancelText: '取消',
        onOk: () => handleStatusChange(status),
      });
    } else {
      handleStatusChange(status);
    }
  };

  if (loading && !tender) {
    return <Card><Spin /> 正在加载…</Card>;
  }
  if (!tender) {
    return <Card><Empty description="招标项目不存在" /></Card>;
  }

  const typeInfo = TENDER_TYPE[tender.tender_type] || { text: tender.tender_type, color: 'default' };
  const methodInfo = TENDER_METHOD[tender.tender_method] || { text: tender.tender_method, color: 'default' };
  const statusInfo = TENDER_STATUS[tender.status] || { text: tender.status, color: 'default' };
  const currentStep = STATUS_TO_STEP[tender.status] ?? 0;
  const isDraft = tender.status === 'draft';
  const isPublished = tender.status === 'published';
  const isBidding = tender.status === 'bidding';
  const isEvaluating = tender.status === 'evaluating';
  const isAwarded = tender.status === 'awarded';
  const isContract = tender.status === 'contract_signing';
  const isCancelled = tender.status === 'cancelled';

  return (
    <div>
      <PageHeader
        title={tender.title}
        description={tender.tender_code}
        onBack={() => navigate('/tendering/projects')}
        statusTag={
          <Space size="small">
            <StatusTag status={tender.tender_type} statusMap={TENDER_TYPE} size="small" bordered />
            <StatusTag status={tender.status} statusMap={TENDER_STATUS} />
          </Space>
        }
        extra={
          <Space wrap>
            {isDraft ? (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => navigate(`/tendering/projects/edit/${id}`)}
              >
                编辑
              </Button>
            ) : null}
            {isPublished ? (
              <Button type="primary" icon={<TeamOutlined />} onClick={() => navigate(`/tendering/suppliers?tender=${id}`)}>
                邀请供应商
              </Button>
            ) : null}
            {isBidding ? (
              <Button onClick={() => onActionClick('evaluating')}>进入评标</Button>
            ) : null}
            {isAwarded ? (
              <Button
                type="primary"
                icon={<FileProtectOutlined />}
                onClick={() => navigate(`/tendering/contracts/new?tender_id=${id}`)}
              >
                创建合同
              </Button>
            ) : null}
            {isContract ? (
              <Button
                type="primary"
                icon={<FileProtectOutlined />}
                onClick={() => navigate(`/tendering/contracts?tender_id=${id}`)}
              >
                查看合同
              </Button>
            ) : null}
            {isPublished || isBidding || isEvaluating || isAwarded || isContract ? (
              <Button icon={<TrophyOutlined />} onClick={() => navigate(`/tendering/projects/${id}/bids`)}>
                投标管理
              </Button>
            ) : null}
            {isBidding || isEvaluating || isAwarded ? (
              <Button icon={<BarChartOutlined />} onClick={() => navigate(`/tendering/projects/${id}/evaluations`)}>
                评标打分
              </Button>
            ) : null}
            <Button icon={<FileTextOutlined />} onClick={() => navigate(`/tendering/projects/${id}/document`)}>
              招标文件
            </Button>
            <Button icon={<QrcodeOutlined />} onClick={() => setQrModalVisible(true)}>
              二维码
            </Button>
          </Space>
        }
      />

      {isCancelled ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="此招标项目已取消"
        />
      ) : null}

      {/* 流程进度 */}
      <div style={{ marginBottom: 16 }}>
        <FlowSteps
          current={currentStep}
          steps={FLOW_STEPS.map((s, idx) => ({
            ...s,
            status:
              isCancelled
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
          {/* 基本信息 */}
          <Card size="small" title="基本信息" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" colon>
              <Descriptions.Item label="招标编号">
                <span style={{ fontFamily: 'monospace' }}>{tender.tender_code}</span>
              </Descriptions.Item>
              <Descriptions.Item label="招标方式">
                <StatusTag status={tender.tender_method} statusMap={TENDER_METHOD} size="small" bordered />
              </Descriptions.Item>
              <Descriptions.Item label="需求部门">
                {tender.department || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="预算金额">
                <span style={{ color: '#fa8c16', fontWeight: 600 }}>
                  {formatMoney(tender.budget_amount)} {tender.currency}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="关联资产编号">
                {tender.asset_code || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="关联资产名称">
                {tender.asset_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="发布日期">
                {tender.publish_date || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="投标截止">
                {formatDateTime(tender.deadline)}
              </Descriptions.Item>
              <Descriptions.Item label="开标时间">
                {formatDateTime(tender.open_bid_date)}
              </Descriptions.Item>
              <Descriptions.Item label="联系人">
                {tender.contact_person || '-'} {tender.contact_phone || ''}
              </Descriptions.Item>
              <Descriptions.Item label="项目概况" span={2}>
                {tender.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {tender.remark || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 已邀请供应商 */}
          {invitations.length > 0 ? (
            <Card size="small" title="已邀请供应商" style={{ marginBottom: 16 }}>
              <ResponsiveTable
                size="small"
                dataSource={invitations}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: '供应商', dataIndex: 'supplier_name', ellipsis: true },
                  { title: '统一信用代码', dataIndex: 'unified_code', render: v => v || '-' },
                  { title: '联系人', dataIndex: 'contact_person', render: v => v || '-' },
                  { title: '邀请时间', dataIndex: 'invited_at', render: v => formatDateTime(v) },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    render: v => <StatusTag status={v} statusMap={TENDER_STATUS} size="small" />,
                  },
                ]}
                mobileTitleKey="supplier_name"
                mobileFields={[
                  { label: '信用代码', key: 'unified_code' },
                  { label: '联系人', key: 'contact_person' },
                  { label: '邀请时间', key: 'invited_at', render: formatDateTime },
                ]}
              />
            </Card>
          ) : null}

          {/* 投标记录 */}
          {bids.length > 0 ? (
            <Card size="small" title="投标记录" style={{ marginBottom: 16 }}>
              <ResponsiveTable
                size="small"
                dataSource={bids}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: '供应商', dataIndex: 'supplier_name', ellipsis: true },
                  {
                    title: '投标报价',
                    dataIndex: 'bid_amount',
                    align: 'right',
                    render: v => <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatMoney(v)}</span>,
                  },
                  { title: '投标说明', dataIndex: 'bid_desc', ellipsis: true, render: v => v || '-' },
                  { title: '提交时间', dataIndex: 'submitted_at', render: v => formatDateTime(v) },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    render: v => <StatusTag status={v} statusMap={TENDER_STATUS} size="small" />,
                  },
                ]}
                mobileTitleKey="supplier_name"
                mobileFields={[
                  {
                    label: '报价',
                    key: 'bid_amount',
                    render: v => <span style={{ color: '#fa8c16' }}>{formatMoney(v)}</span>,
                  },
                  { label: '提交时间', key: 'submitted_at', render: formatDateTime },
                  { label: '说明', key: 'bid_desc', span: 2 },
                ]}
              />
            </Card>
          ) : null}

          {/* 评标结果 */}
          {evaluations.length > 0 ? (
            <Card size="small" title="评标结果" style={{ marginBottom: 16 }}>
              <ResponsiveTable
                size="small"
                dataSource={evaluations}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: '供应商', dataIndex: 'supplier_name', ellipsis: true },
                  { title: '总分', dataIndex: 'score', align: 'right', width: 80 },
                  { title: '价格分', dataIndex: 'price_score', align: 'right', width: 80 },
                  { title: '技术分', dataIndex: 'tech_score', align: 'right', width: 80 },
                  { title: '评标意见', dataIndex: 'evaluation_comment', ellipsis: true },
                  {
                    title: '推荐',
                    dataIndex: 'recommended',
                    width: 100,
                    render: v => v ? <Tag color="success">推荐</Tag> : '-',
                  },
                ]}
                mobileTitleKey="supplier_name"
                mobileFields={[
                  { label: '总分', key: 'score' },
                  { label: '价格分', key: 'price_score' },
                  { label: '技术分', key: 'tech_score' },
                  { label: '评标意见', key: 'evaluation_comment', span: 2 },
                ]}
              />
            </Card>
          ) : null}

          {/* 合同信息 */}
          {['awarded', 'contract_signing', 'completed'].includes(tender.status) ? (
            <Card
              size="small"
              title={
                <Space>
                  <FileProtectOutlined /> 合同信息
                </Space>
              }
              style={{ marginBottom: 16 }}
              extra={
                isAwarded ? (
                  <Button
                    size="small"
                    type="primary"
                    icon={<FileProtectOutlined />}
                    onClick={() => navigate(`/tendering/contracts/new?tender_id=${id}`)}
                  >
                    创建合同
                  </Button>
                ) : null
              }
            >
              {contracts.length === 0 ? (
                <Empty
                  description={isAwarded ? '尚未创建合同，请点击"创建合同"开始合同签订流程' : '暂无合同'}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <ResponsiveTable
                  size="small"
                  dataSource={contracts}
                  rowKey="id"
                  pagination={false}
                  columns={[
                    { title: '合同编号', dataIndex: 'contract_code', width: 180 },
                    {
                      title: '合同名称',
                      dataIndex: 'contract_name',
                      render: (text, r) => (
                        <a onClick={() => navigate(`/tendering/contracts/${r.id}`)}>{text}</a>
                      ),
                    },
                    { title: '供应商', dataIndex: 'supplier_name', render: v => v || '-' },
                    {
                      title: '合同金额',
                      dataIndex: 'contract_amount',
                      align: 'right',
                      render: v => <span style={{ color: '#fa8c16' }}>{formatMoney(v)}</span>,
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      render: v => <StatusTag status={v} statusMap={CONTRACT_STATUS} size="small" />,
                    },
                    { title: '签订日期', dataIndex: 'sign_date', render: v => v || '-' },
                  ]}
                  mobileTitleKey="contract_name"
                  mobileStatusRender={r => (
                    <StatusTag status={r.status} statusMap={CONTRACT_STATUS} size="small" />
                  )}
                  mobileFields={[
                    { label: '合同编号', key: 'contract_code' },
                    { label: '供应商', key: 'supplier_name' },
                    {
                      label: '金额',
                      key: 'contract_amount',
                      render: v => <span style={{ color: '#fa8c16' }}>{formatMoney(v)}</span>,
                    },
                    { label: '签订日期', key: 'sign_date' },
                  ]}
                  mobileActions={[
                    {
                      key: 'view',
                      text: '查看详情',
                      type: 'primary',
                      onClick: r => navigate(`/tendering/contracts/${r.id}`),
                    },
                  ]}
                />
              )}
            </Card>
          ) : null}
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
                      <div style={{ fontWeight: 500, fontSize: 13 }}>创建项目</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {formatDateTime(tender.created_at)}
                      </div>
                    </>
                  ),
                },
                tender.publish_date ? {
                  color: 'blue',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>发布日期</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>{tender.publish_date}</div>
                    </>
                  ),
                } : null,
                tender.deadline ? {
                  color: 'orange',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>投标截止</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>{formatDateTime(tender.deadline)}</div>
                    </>
                  ),
                } : null,
                {
                  color: statusInfo.color === 'success' ? 'green' : 'gray',
                  children: (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>当前状态</div>
                      <div style={{ marginTop: 4 }}>
                        <StatusTag status={tender.status} statusMap={TENDER_STATUS} />
                      </div>
                    </>
                  ),
                },
              ].filter(Boolean)}
            />
          </Card>

          <Card size="small" title="统计" style={{ marginBottom: 16 }}>
            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
              <Row>
                <Col span={12}>
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>已邀请供应商</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{invitations.length}</div>
                </Col>
                <Col span={12}>
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>收到投标</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{bids.length}</div>
                </Col>
              </Row>
              <Row>
                <Col span={12}>
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>评标完成</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{evaluations.length}</div>
                </Col>
                <Col span={12}>
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>关联合同</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{contracts.length}</div>
                </Col>
              </Row>
            </Space>
          </Card>
        </Col>
      </Row>

      <TenderShareQRModal
        visible={qrModalVisible}
        tenderId={tender.id}
        tenderTitle={tender.title}
        onClose={() => setQrModalVisible(false)}
      />
    </div>
  );
}
