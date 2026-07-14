import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Spin, Tag, Empty, message, Progress } from 'antd';
import {
  FileTextOutlined, TeamOutlined, DollarOutlined, CheckCircleOutlined,
  ClockCircleOutlined, FormOutlined, SignatureOutlined, InboxOutlined,
  RiseOutlined, TrophyOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  TENDER_STATUS, TENDER_TYPE, SUPPLIER_STATUS, CONTRACT_STATUS,
  formatDateTime, formatMoney,
} from '../../constants/tendering';
import { PageHeader, KpiCard, StatusTag } from '../../components/tendering';

const FLOW_STAGES = [
  { key: 'draft', label: '草稿', color: '#d9d9d9' },
  { key: 'published', label: '已发布', color: '#1677ff' },
  { key: 'bidding', label: '投标中', color: '#13c2c2' },
  { key: 'evaluating', label: '评标中', color: '#faad14' },
  { key: 'awarded', label: '已定标', color: '#52c41a' },
  { key: 'contract_signing', label: '合同签订', color: '#722ed1' },
  { key: 'completed', label: '已完成', color: '#389e0d' },
];

export default function TenderStatistics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [contractData, setContractData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tenderRes, contractRes] = await Promise.all([
        tenderingAPI.getStatistics(),
        tenderingAPI.getContractStatistics().catch(() => null),
      ]);
      setData(tenderRes?.data || tenderRes);
      if (contractRes) setContractData(contractRes?.data || contractRes);
    } catch (err) {
      message.error(err.response?.data?.message || '加载统计数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return <Card><Spin /> 正在加载…</Card>;
  }
  if (!data) {
    return <Empty description="暂无统计数据" />;
  }

  const totals = data.totals || {};
  const distToArray = (dist, keyName = 'status') => Object.entries(dist || {})
    .map(([key, cnt]) => ({ [keyName]: key, cnt: Number(cnt) }))
    .sort((a, b) => Number(b.cnt) - Number(a.cnt));
  const statusDist = distToArray(data.status_distribution, 'status');
  const typeDist = distToArray(data.type_distribution, 'tender_type');
  const supplierDist = distToArray(data.supplier_distribution, 'status');
  const recent = data.recent_tenders || [];
  const upcoming = data.upcoming_deadlines || [];

  const activeTenders = FLOW_STAGES.slice(1, 5).reduce(
    (sum, s) => sum + (data.status_distribution?.[s.key] || 0), 0,
  );

  return (
    <div>
      <PageHeader
        title="招标统计"
        count={totals.total_tenders || 0}
        description="综合展示招标/合同/供应商的关键指标与分布"
      />

      {/* 核心 KPI */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={4}>
          <KpiCard
            title="招标总数"
            value={totals.total_tenders || 0}
            tone="primary"
            icon={<FileTextOutlined />}
            hint={`近 30 天 +${totals.recent_30d_tenders || 0}`}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiCard
            title="进行中"
            value={activeTenders}
            tone="cyan"
            icon={<RiseOutlined />}
            hint="发布 → 定标之间"
            onClick={() => navigate('/tendering/projects?status=active')}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiCard
            title="已定标"
            value={totals.won_bids || 0}
            tone="success"
            icon={<TrophyOutlined />}
            hint={`中标金额 ¥${(totals.won_amount || 0).toLocaleString()}`}
            onClick={() => navigate('/tendering/projects?status=awarded')}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiCard
            title="供应商"
            value={totals.total_suppliers || 0}
            tone="purple"
            icon={<TeamOutlined />}
            hint={`合格 ${data.supplier_distribution?.qualified || 0} 家`}
            onClick={() => navigate('/tendering/suppliers')}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiCard
            title="待审资质"
            value={totals.pending_qualifications || 0}
            tone="danger"
            icon={<WarningOutlined />}
            hint={totals.pending_qualifications > 0 ? '需要处理' : '暂无'}
            onClick={() => navigate('/tendering/suppliers?status=pending')}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiCard
            title="合同总数"
            value={contractData?.totals?.total_contracts || 0}
            tone="warning"
            icon={<FormOutlined />}
            hint={`执行中 ${contractData?.totals?.executing_count || 0} 份`}
            onClick={() => navigate('/tendering/contracts')}
          />
        </Col>
      </Row>

      {/* 合同统计 */}
      {contractData ? (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <KpiCard
              title="已签订金额"
              value={formatMoney(contractData.totals?.signed_amount, false, 0)}
              suffix="元"
              tone="success"
              icon={<SignatureOutlined />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <KpiCard
              title="归档金额"
              value={formatMoney(contractData.totals?.archived_amount, false, 0)}
              suffix="元"
              tone="cyan"
              icon={<InboxOutlined />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <KpiCard
              title="中标总金额"
              value={formatMoney(totals.won_amount, false, 0)}
              suffix="元"
              tone="primary"
              icon={<DollarOutlined />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <KpiCard
              title="已定标预算"
              value={formatMoney(totals.awarded_budget, false, 0)}
              suffix="元"
              tone="warning"
              icon={<CheckCircleOutlined />}
            />
          </Col>
        </Row>
      ) : null}

      {/* 流程漏斗 */}
      <Card size="small" title="招标流程漏斗" style={{ marginBottom: 16 }}>
        {(() => {
          const total = Object.values(data.status_distribution || {}).reduce(
            (a, b) => a + Number(b || 0), 0,
          ) || 1;
          return (
            <Row gutter={[8, 12]}>
              {FLOW_STAGES.map(stage => {
                const count = data.status_distribution?.[stage.key] || 0;
                const percent = ((count / total) * 100).toFixed(1);
                return (
                  <Col xs={12} sm={8} md={24 / FLOW_STAGES.length} key={stage.key} flex="1">
                    <div
                      className="flow-stage"
                      onClick={() => navigate(`/tendering/projects?status=${stage.key}`)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flow-stage-label">{stage.label}</div>
                      <div className="flow-stage-value" style={{ color: stage.color }}>
                        {count}
                      </div>
                      <Progress percent={Number(percent)} showInfo={false} strokeColor={stage.color} size="small" />
                      <div className="flow-stage-percent">{percent}%</div>
                    </div>
                  </Col>
                );
              })}
            </Row>
          );
        })()}
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card size="small" title="项目状态分布" style={{ marginBottom: 16 }}>
            {statusDist.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <div>
                {statusDist.map(s => {
                  const total = statusDist.reduce((acc, x) => acc + Number(x.cnt), 0) || 1;
                  const percent = Math.round((Number(s.cnt) / total) * 100);
                  return (
                    <div key={s.status} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <StatusTag status={s.status} statusMap={TENDER_STATUS} size="small" />
                        <span><strong>{s.cnt}</strong> <span style={{ color: '#8c8c8c' }}>({percent}%)</span></span>
                      </div>
                      <Progress
                        percent={percent}
                        showInfo={false}
                        strokeColor={TENDER_STATUS[s.status]?.color === 'success' ? '#52c41a' : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card size="small" title="招标类型分布" style={{ marginBottom: 16 }}>
            {typeDist.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <div>
                {typeDist.map(t => (
                  <div
                    key={t.tender_type}
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}
                  >
                    <StatusTag status={t.tender_type} statusMap={TENDER_TYPE} size="small" bordered />
                    <span><strong>{t.cnt}</strong> 个</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card size="small" title="供应商状态" style={{ marginBottom: 16 }}>
            {supplierDist.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <div>
                {supplierDist.map(s => (
                  <div
                    key={s.status}
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}
                  >
                    <StatusTag status={s.status} statusMap={SUPPLIER_STATUS} size="small" bordered />
                    <span><strong>{s.cnt}</strong> 家</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {contractData && Object.keys(contractData.status_distribution || {}).length > 0 ? (
        <Card size="small" title="合同状态分布" style={{ marginBottom: 16 }}>
          {Object.entries(contractData.status_distribution)
            .map(([status, v]) => ({ status, count: v.count, amount: v.amount }))
            .sort((a, b) => Number(b.count) - Number(a.count))
            .map(item => {
              const totalContracts = contractData.totals?.total_contracts || 1;
              const percent = Math.round((Number(item.count) / totalContracts) * 100);
              return (
                <div key={item.status} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <StatusTag status={item.status} statusMap={CONTRACT_STATUS} size="small" />
                    <span>
                      <strong>{item.count}</strong> ({percent}%) ·{' '}
                      {item.amount != null && Number(item.amount) > 0
                        ? `¥${Number(item.amount).toLocaleString()}`
                        : '-'}
                    </span>
                  </div>
                  <Progress
                    percent={percent}
                    showInfo={false}
                    strokeColor={CONTRACT_STATUS[item.status]?.color === 'success' ? '#52c41a' : undefined}
                  />
                </div>
              );
            })}
        </Card>
      ) : null}

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card size="small" title="即将截止（30 天内）" style={{ marginBottom: 16 }}>
            {upcoming.length === 0 ? (
              <Empty description="暂无即将截止的招标" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div>
                {upcoming.map(t => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0', borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <a
                      onClick={() => navigate(`/tendering/projects/${t.id}`)}
                      style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {t.title}
                    </a>
                    <StatusTag status={t.status} statusMap={TENDER_STATUS} size="small" />
                    <span style={{ marginLeft: 12, color: '#ff4d4f', fontSize: 12, minWidth: 90, textAlign: 'right' }}>
                      截止 {t.deadline ? new Date(t.deadline).toLocaleDateString() : '-'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="最近招标项目" style={{ marginBottom: 16 }}>
            {recent.length === 0 ? (
              <Empty description="暂无项目" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div>
                {recent.map(t => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0', borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <a
                      onClick={() => navigate(`/tendering/projects/${t.id}`)}
                      style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {t.title}
                    </a>
                    <StatusTag status={t.status} statusMap={TENDER_STATUS} size="small" />
                    <span style={{ marginLeft: 12, color: '#8c8c8c', fontSize: 12, minWidth: 90, textAlign: 'right' }}>
                      {t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
