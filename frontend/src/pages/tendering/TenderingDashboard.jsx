import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Spin, Empty, Tag, Button, Space, Progress, Alert, message,
} from 'antd';
import {
  ReloadOutlined, FileTextOutlined, RiseOutlined, TrophyOutlined,
  WarningOutlined, DollarOutlined, TeamOutlined, ClockCircleOutlined,
  ArrowRightOutlined, AuditOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  TENDER_STATUS,
  SUPPLIER_STATUS,
  CONTRACT_STATUS,
  formatMoney,
  formatDateTime,
} from '../../constants/tendering';
import {
  PageHeader, KpiCard, StatusTag, ResponsiveTable,
} from '../../components/tendering';
import './tendering-dashboard.css';

// 流程漏斗：把状态分布按流程顺序展示
const FLOW_STAGES = [
  { key: 'draft', label: '草稿', color: '#d9d9d9' },
  { key: 'published', label: '已发布', color: '#1677ff' },
  { key: 'bidding', label: '投标中', color: '#13c2c2' },
  { key: 'evaluating', label: '评标中', color: '#faad14' },
  { key: 'awarded', label: '已定标', color: '#52c41a' },
  { key: 'contract_signing', label: '合同签订', color: '#722ed1' },
  { key: 'completed', label: '已完成', color: '#389e0d' },
];

export default function TenderingDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [contractData, setContractData] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tenderRes, contractRes] = await Promise.all([
        tenderingAPI.getStatistics(),
        tenderingAPI.getContractStatistics().catch(() => null),
      ]);
      setData(tenderRes?.data || tenderRes);
      if (contractRes) setContractData(contractRes?.data || contractRes);
    } catch (err) {
      message.error(err.response?.data?.message || '获取统计失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <Card>
        <Spin /> 正在加载…
      </Card>
    );
  }
  if (!data) {
    return <Empty description="暂无数据" />;
  }

  const totals = data.totals || {};
  const activeTenders = FLOW_STAGES.slice(1, 5).reduce(
    (sum, s) => sum + (data.status_distribution?.[s.key] || 0),
    0,
  );
  const upcomingCount = data.upcoming_deadlines?.length || 0;
  const pendingQual = totals.pending_qualifications || 0;

  // 关键告警
  const hasAlert = pendingQual > 0 || upcomingCount > 0;

  return (
    <div>
      <PageHeader
        title="招标采购概览"
        description={`共管理 ${totals.total_tenders || 0} 个招标项目，与 ${totals.total_suppliers || 0} 家供应商合作`}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            刷新
          </Button>
        }
      />

      {/* 待办预警：最显眼的位置 */}
      {hasAlert ? (
        <Alert
          type={pendingQual > 0 ? 'warning' : 'info'}
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <Space wrap>
              {pendingQual > 0 ? (
                <span>
                  <strong>{pendingQual}</strong> 个供应商资质待审核
                  <Button
                    type="link"
                    size="small"
                    onClick={() => navigate('/tendering/suppliers?status=pending')}
                  >
                    立即处理 <ArrowRightOutlined />
                  </Button>
                </span>
              ) : null}
              {upcomingCount > 0 ? (
                <span>
                  <strong>{upcomingCount}</strong> 个招标即将截止
                  <Button
                    type="link"
                    size="small"
                    onClick={() => navigate('/tendering/projects')}
                  >
                    查看 <ArrowRightOutlined />
                  </Button>
                </span>
              ) : null}
            </Space>
          }
        />
      ) : null}

      {/* 核心 KPI：5 个一级指标 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={4}>
          <KpiCard
            title="招标项目"
            value={totals.total_tenders || 0}
            tone="primary"
            icon={<FileTextOutlined />}
            hint={`近 30 天 +${totals.recent_30d_tenders || 0}`}
            onClick={() => navigate('/tendering/projects')}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiCard
            title="进行中"
            value={activeTenders}
            tone="success"
            icon={<RiseOutlined />}
            hint="已发布到定标之间"
            onClick={() => navigate('/tendering/projects?status=active')}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiCard
            title="已定标金额"
            value={formatMoney(totals.awarded_budget || 0, false, 0)}
            suffix="元"
            tone="warning"
            icon={<DollarOutlined />}
            hint={`已定标 ${totals.won_bids || 0} 单`}
            onClick={() => navigate('/tendering/projects?status=awarded')}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiCard
            title="待审资质"
            value={pendingQual}
            tone="danger"
            icon={<WarningOutlined />}
            hint={pendingQual > 0 ? '需要尽快处理' : '暂无待审'}
            onClick={() => navigate('/tendering/suppliers?status=pending')}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiCard
            title="合同金额"
            value={formatMoney(contractData?.totals?.signed_amount || 0, false, 0)}
            suffix="元"
            tone="purple"
            icon={<AuditOutlined />}
            hint={`执行中 ${contractData?.totals?.executing_count || 0} 份`}
            onClick={() => navigate('/tendering/contracts')}
          />
        </Col>
      </Row>

      {/* 流程漏斗 */}
      <Card
        size="small"
        title="招标流程概览"
        style={{ marginBottom: 16 }}
        extra={
          <Button
            type="link"
            size="small"
            onClick={() => navigate('/tendering/projects')}
            icon={<ArrowRightOutlined />}
          >
            进入项目列表
          </Button>
        }
      >
        <Row gutter={[8, 12]}>
          {FLOW_STAGES.map((stage, idx) => {
            const count = data.status_distribution?.[stage.key] || 0;
            const total =
              Object.values(data.status_distribution || {}).reduce(
                (a, b) => a + Number(b || 0),
                0,
              ) || 1;
            const percent = ((count / total) * 100).toFixed(1);
            return (
              <Col xs={12} sm={8} md={idx === FLOW_STAGES.length - 1 ? 24 / FLOW_STAGES.length : 24 / FLOW_STAGES.length} key={stage.key} flex="1">
                <div
                  className="flow-stage"
                  onClick={() => navigate(`/tendering/projects?status=${stage.key}`)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flow-stage-label">
                    {stage.label}
                  </div>
                  <div className="flow-stage-value" style={{ color: stage.color }}>
                    {count}
                  </div>
                  <Progress
                    percent={Number(percent)}
                    showInfo={false}
                    strokeColor={stage.color}
                    size="small"
                  />
                  <div className="flow-stage-percent">{percent}%</div>
                </div>
              </Col>
            );
          })}
        </Row>
      </Card>

      <Row gutter={16}>
        {/* 即将截止 */}
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#fa8c16' }} />
                即将截止的招标
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/tendering/projects')}
              >
                查看全部
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            {(!data.upcoming_deadlines || data.upcoming_deadlines.length === 0) ? (
              <Empty description="近期无即将截止的招标" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveTable
                size="small"
                dataSource={data.upcoming_deadlines}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: '项目',
                    dataIndex: 'title',
                    ellipsis: true,
                    render: (text, r) => (
                      <a onClick={() => navigate(`/tendering/projects/${r.id}`)}>
                        {text}
                      </a>
                    ),
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 100,
                    render: v => <StatusTag status={v} statusMap={TENDER_STATUS} size="small" />,
                  },
                  {
                    title: '截止时间',
                    dataIndex: 'deadline',
                    width: 150,
                    render: v => formatDateTime(v),
                  },
                ]}
                mobileTitleKey="title"
                mobileStatusRender={r => (
                  <StatusTag status={r.status} statusMap={TENDER_STATUS} size="small" />
                )}
                mobileFields={[
                  { label: '截止时间', key: 'deadline', render: formatDateTime },
                ]}
                mobileActions={[
                  {
                    key: 'view',
                    text: '查看详情',
                    type: 'primary',
                    onClick: r => navigate(`/tendering/projects/${r.id}`),
                  },
                ]}
              />
            )}
          </Card>
        </Col>

        {/* 最近招标 */}
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title={
              <Space>
                <TrophyOutlined style={{ color: '#1677ff' }} />
                最近招标项目
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/tendering/projects')}
              >
                查看全部
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            {(!data.recent_tenders || data.recent_tenders.length === 0) ? (
              <Empty description="暂无最近招标项目" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveTable
                size="small"
                dataSource={data.recent_tenders}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: '招标编号',
                    dataIndex: 'tender_code',
                    width: 160,
                    ellipsis: true,
                  },
                  {
                    title: '项目名称',
                    dataIndex: 'title',
                    ellipsis: true,
                    render: (text, r) => (
                      <a onClick={() => navigate(`/tendering/projects/${r.id}`)}>
                        {text}
                      </a>
                    ),
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 90,
                    render: v => <StatusTag status={v} statusMap={TENDER_STATUS} size="small" />,
                  },
                  {
                    title: '预算',
                    dataIndex: 'budget_amount',
                    width: 110,
                    align: 'right',
                    render: v => v != null ? Number(v).toLocaleString() : '-',
                  },
                ]}
                mobileTitleKey="title"
                mobileStatusRender={r => (
                  <StatusTag status={r.status} statusMap={TENDER_STATUS} size="small" />
                )}
                mobileFields={[
                  { label: '招标编号', key: 'tender_code', span: 2 },
                  { label: '预算', key: 'budget_amount', render: v => v != null ? formatMoney(v, false, 0) : '-' },
                ]}
                mobileActions={[
                  {
                    key: 'view',
                    text: '查看详情',
                    type: 'primary',
                    onClick: r => navigate(`/tendering/projects/${r.id}`),
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 合同状态 + 供应商资质 */}
      <Row gutter={16}>
        {contractData ? (
          <Col xs={24} lg={12}>
            <Card
              size="small"
              title={
                <Space>
                  <AuditOutlined /> 合同状态
                </Space>
              }
              extra={
                <Button
                  type="link"
                  size="small"
                  onClick={() => navigate('/tendering/contracts')}
                >
                  查看合同
                </Button>
              }
            >
              <Row gutter={[8, 8]}>
                {Object.entries(contractData.status_distribution || {}).map(
                  ([status, v]) => {
                    const info = CONTRACT_STATUS[status] || { text: status, color: 'default' };
                    return (
                      <Col xs={12} sm={8} key={status}>
                        <div className="contract-stat">
                          <div className="contract-stat-name">
                            <Tag color={info.color} style={{ margin: 0 }}>
                              {info.text}
                            </Tag>
                          </div>
                          <div className="contract-stat-value">{v.count}</div>
                          <div className="contract-stat-amount">
                            {v.amount ? formatMoney(v.amount, false, 0) : '-'}
                          </div>
                        </div>
                      </Col>
                    );
                  },
                )}
              </Row>
            </Card>
          </Col>
        ) : null}

        <Col xs={24} lg={contractData ? 12 : 24}>
          <Card
            size="small"
            title={
              <Space>
                <TeamOutlined /> 供应商资质
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/tendering/suppliers')}
              >
                管理供应商
              </Button>
            }
          >
            <Row gutter={[8, 8]}>
              {Object.entries(data.supplier_distribution || {}).map(([status, count]) => {
                const info = SUPPLIER_STATUS[status] || { text: status, color: 'default' };
                return (
                  <Col xs={12} sm={8} key={status}>
                    <div className="contract-stat">
                      <div className="contract-stat-name">
                        <Tag color={info.color} style={{ margin: 0 }}>
                          {info.text}
                        </Tag>
                      </div>
                      <div className="contract-stat-value">{count}</div>
                      <div className="contract-stat-amount">家</div>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
