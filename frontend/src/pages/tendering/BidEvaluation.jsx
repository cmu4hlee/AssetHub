import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import {
  Card, Button, Space, message, Form, Modal, InputNumber, Input, Empty, Checkbox,
  Row, Col, Spin, Alert, Statistic,
} from 'antd';
import {
  ArrowLeftOutlined, BarChartOutlined, CheckCircleOutlined, EditOutlined,
  UserOutlined, DollarOutlined, TrophyOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  BID_STATUS, RECOMMEND_LABELS, TENDER_STATUS,
} from '../../constants/tendering';
import {
  PageHeader, StatusTag, ResponsiveTable,
} from '../../components/tendering';

const RECOMMEND_MAP = {
  0: { text: '未推荐', color: 'default' },
  1: { text: '推荐中标', color: 'success' },
};

export default function BidEvaluation() {
  const canDelete = useCan('tender', 'delete');
  const canEdit = useCan('tender', 'edit');
  const navigate = useNavigate();
  const { id: tenderId } = useParams();
  const [loading, setLoading] = useState(false);
  const [tender, setTender] = useState(null);
  const [bids, setBids] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [summary, setSummary] = useState([]);
  const [evalModal, setEvalModal] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!tenderId) return;
    setLoading(true);
    try {
      const [tenderRes, bidsRes, evalRes, summaryRes] = await Promise.all([
        tenderingAPI.getProject(tenderId),
        tenderingAPI.listBids(tenderId, { pageSize: 200 }),
        tenderingAPI.listEvaluations(tenderId),
        tenderingAPI.summarizeEvaluations(tenderId),
      ]);
      setTender(tenderRes?.data ?? tenderRes);
      setBids(Array.isArray(bidsRes?.data) ? bidsRes.data : []);
      setEvaluations(Array.isArray(evalRes?.data) ? evalRes.data : []);
      setSummary(Array.isArray(summaryRes?.data) ? summaryRes.data : []);
    } catch (err) {
      message.error(err.response?.data?.message || '加载评标数据失败');
    } finally {
      setLoading(false);
    }
  }, [tenderId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openEval = bid => {
    form.resetFields();
    form.setFieldsValue({ score: 0, price_score: 0, tech_score: 0, recommended: false });
    setEvalModal({ bid });
  };

  const submitEval = async () => {
    if (!evalModal) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await tenderingAPI.submitEvaluation(tenderId, {
        ...values,
        supplier_id: evalModal.bid.supplier_id,
        bid_id: evalModal.bid.id,
      });
      message.success('评标已提交');
      setEvalModal(null);
      fetchAll();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const visibleBids = bids.filter(b => b.status !== 'withdrawn');
  const topBid = summary.length > 0
    ? summary.reduce((a, b) => Number(a.avg_score || 0) > Number(b.avg_score || 0) ? a : b)
    : null;

  return (
    <div>
      <PageHeader
        title="评标打分"
        description={tender ? `${tender.title} · ${tender.tender_code}` : '加载中...'}
        onBack={() => navigate(`/tendering/projects/${tenderId}`)}
        statusTag={tender ? <StatusTag status={tender.status} statusMap={TENDER_STATUS} /> : null}
        extra={
          <Space wrap>
            <Button icon={<BarChartOutlined />} onClick={() => navigate(`/tendering/projects/${tenderId}/bids`)}>
              投标管理
            </Button>
          </Space>
        }
      />

      {topBid ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <span>
              当前最高分：<strong style={{ color: '#fa8c16' }}>{Number(topBid.avg_score).toFixed(2)}</strong>
              ，供应商：<strong>{topBid.supplier_name}</strong>
              {Number(topBid.recommend_count) > 0 ? ` · ${topBid.recommend_count} 人推荐` : ''}
            </span>
          }
        />
      ) : null}

      {loading ? (
        <Card><Spin /> 正在加载…</Card>
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic title="投标数" value={visibleBids.length} prefix={<UserOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic title="已评标数" value={evaluations.length} prefix={<EditOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic
                  title="推荐中标"
                  value={evaluations.filter(e => e.recommended).length}
                  prefix={<CheckCircleOutlined />}
                  styles={{ content: { color: '#52c41a' } }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic
                  title="最高平均分"
                  value={topBid ? Number(topBid.avg_score).toFixed(2) : '-'}
                  prefix={<TrophyOutlined />}
                  styles={{ content: { color: '#fa8c16' } }}
                />
              </Card>
            </Col>
          </Row>

          <Card size="small" title="待评标投标" style={{ marginBottom: 16 }}>
            {visibleBids.length === 0 ? (
              <Empty description="尚无投标" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveTable
                size="small"
                dataSource={visibleBids}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: '供应商', dataIndex: 'supplier_name', fixed: 'left', width: 200, ellipsis: true },
                  {
                    title: '投标报价',
                    dataIndex: 'bid_amount',
                    width: 160,
                    align: 'right',
                    render: (v, r) => <span style={{ color: '#fa8c16', fontWeight: 600 }}>
                      {v != null ? `${r.bid_currency || 'CNY'} ${Number(v).toLocaleString()}` : '-'}
                    </span>,
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 110,
                    render: v => <StatusTag status={v} statusMap={BID_STATUS} size="small" />,
                  },
                  {
                    title: '操作',
                    key: 'action',
                    width: 100,
                    fixed: 'right',
                    render: (_, record) => (
                      <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEval(record)}>
                        打分
                      </Button>
                    ),
                  },
                ]}
                mobileTitleKey="supplier_name"
                mobileStatusRender={r => <StatusTag status={r.status} statusMap={BID_STATUS} size="small" />}
                mobileFields={[
                  {
                    label: '报价',
                    key: 'bid_amount',
                    span: 2,
                    render: (v, r) => <span style={{ color: '#fa8c16' }}>
                      {v != null ? `${r.bid_currency || 'CNY'} ${Number(v).toLocaleString()}` : '-'}
                    </span>,
                  },
                ]}
                mobileActions={[
                  {
                    key: 'eval', text: '打分', icon: <EditOutlined />, type: 'primary',
                    onClick: r => openEval(r),
                  },
                ]}
              />
            )}
          </Card>

          {summary.length > 0 ? (
            <Card size="small" title="综合评分汇总" style={{ marginBottom: 16 }}>
              <ResponsiveTable
                size="small"
                dataSource={summary}
                rowKey="supplier_id"
                pagination={false}
                columns={[
                  { title: '供应商', dataIndex: 'supplier_name', fixed: 'left', width: 180, ellipsis: true },
                  { title: '评标人数', dataIndex: 'evaluator_count', align: 'right', width: 110 },
                  {
                    title: '平均总分',
                    dataIndex: 'avg_score',
                    align: 'right',
                    width: 130,
                    render: v => v != null ? <strong style={{ color: '#fa8c16' }}>{Number(v).toFixed(2)}</strong> : '-',
                  },
                  { title: '平均价格分', dataIndex: 'avg_price_score', align: 'right', width: 130 },
                  { title: '平均技术分', dataIndex: 'avg_tech_score', align: 'right', width: 130 },
                  {
                    title: '推荐次数',
                    dataIndex: 'recommend_count',
                    align: 'right',
                    width: 110,
                    render: v => v > 0
                      ? <StatusTag status="1" statusMap={RECOMMEND_MAP} size="small" extra={v} />
                      : 0,
                  },
                ]}
                mobileTitleKey="supplier_name"
                mobileFields={[
                  { label: '评标人数', key: 'evaluator_count' },
                  { label: '平均总分', key: 'avg_score', render: v => v != null ? <strong style={{ color: '#fa8c16' }}>{Number(v).toFixed(2)}</strong> : '-' },
                  { label: '平均价格分', key: 'avg_price_score' },
                  { label: '平均技术分', key: 'avg_tech_score' },
                  { label: '推荐', key: 'recommend_count', render: v => v > 0
                    ? <StatusTag status="1" statusMap={RECOMMEND_MAP} size="small" extra={v} /> : 0 },
                ]}
              />
            </Card>
          ) : null}

          <Card size="small" title="所有评标记录">
            {evaluations.length === 0 ? (
              <Empty description="尚无评标记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveTable
                size="small"
                dataSource={evaluations}
                rowKey="id"
                pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
                columns={[
                  { title: '供应商', dataIndex: 'supplier_name', width: 180, ellipsis: true },
                  { title: '评标人', dataIndex: 'evaluator_name', width: 120, render: (v, r) => v || r.evaluator_username || '-' },
                  { title: '总分', dataIndex: 'score', align: 'right', width: 90 },
                  { title: '价格分', dataIndex: 'price_score', align: 'right', width: 90 },
                  { title: '技术分', dataIndex: 'tech_score', align: 'right', width: 90 },
                  {
                    title: '推荐',
                    dataIndex: 'recommended',
                    width: 110,
                    render: v => <StatusTag status={String(v)} statusMap={RECOMMEND_MAP} size="small" />,
                  },
                  { title: '意见', dataIndex: 'evaluation_comment', ellipsis: true },
                  { title: '时间', dataIndex: 'evaluated_at', width: 150, render: v => v ? v.replace('T', ' ').slice(0, 16) : '-' },
                ]}
                mobileTitleKey="supplier_name"
                mobileStatusRender={r => <StatusTag status={String(r.recommended)} statusMap={RECOMMEND_MAP} size="small" />}
                mobileFields={[
                  { label: '评标人', key: 'evaluator_name' },
                  { label: '总分', key: 'score', render: v => <strong style={{ color: '#fa8c16' }}>{v ?? '-'}</strong> },
                  { label: '价格分', key: 'price_score' },
                  { label: '技术分', key: 'tech_score' },
                  { label: '意见', key: 'evaluation_comment', span: 2 },
                ]}
              />
            )}
          </Card>
        </>
      )}

      <Modal
        title={evalModal ? `为「${evalModal.bid.supplier_name}」打分` : '评标'}
        open={!!evalModal}
        onOk={submitEval}
        onCancel={() => setEvalModal(null)}
        okText="提交"
        cancelText="取消"
        confirmLoading={submitting}
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="score" label="总分" rules={[{ type: 'number', min: 0, max: 100, message: '0-100' }]}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} precision={2} placeholder="0-100" />
          </Form.Item>
          <Form.Item name="price_score" label="价格分" rules={[{ type: 'number', min: 0, max: 100 }]}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} precision={2} />
          </Form.Item>
          <Form.Item name="tech_score" label="技术分" rules={[{ type: 'number', min: 0, max: 100 }]}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} precision={2} />
          </Form.Item>
          <Form.Item name="evaluation_comment" label="评标意见">
            <Input.TextArea rows={3} placeholder="技术能力、商务条款、风险评估等" />
          </Form.Item>
          <Form.Item name="recommended" valuePropName="checked" initialValue={false}>
            <Checkbox>推荐中标</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
