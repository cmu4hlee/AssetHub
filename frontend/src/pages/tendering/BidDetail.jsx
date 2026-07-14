import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Descriptions, Button, Space, message, Modal, Form, InputNumber, Input, Checkbox,
  Row, Col, Empty, Spin, Alert, Tag as AntdTag,
} from 'antd';
import {
  ArrowLeftOutlined, TrophyOutlined, RollbackOutlined, EditOutlined,
  CheckCircleOutlined, UserOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  BID_STATUS, RECOMMEND_LABELS, formatDateTime,
} from '../../constants/tendering';
import {
  PageHeader, StatusTag, ResponsiveTable,
} from '../../components/tendering';

const RECOMMEND_MAP = {
  0: { text: '未推荐', color: 'default' },
  1: { text: '推荐中标', color: 'success' },
};

export default function BidDetail() {
  const navigate = useNavigate();
  const { bidId } = useParams();
  const [loading, setLoading] = useState(false);
  const [bid, setBid] = useState(null);
  const [evalModalVisible, setEvalModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.getBid(bidId);
      setBid(res?.data ?? res);
    } catch (err) {
      message.error(err.response?.data?.message || '获取投标详情失败');
    } finally {
      setLoading(false);
    }
  }, [bidId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleWithdraw = () => {
    Modal.confirm({
      title: '确认撤销该投标？',
      okType: 'danger',
      onOk: async () => {
        try {
          await tenderingAPI.withdrawBid(bidId);
          message.success('已撤销');
          fetchData();
        } catch (err) {
          message.error(err.response?.data?.message || '撤销失败');
        }
      },
    });
  };

  const handleAward = () => {
    Modal.confirm({
      title: '确认定标',
      content: `确认将「${bid?.supplier_name}」标记为中标供应商？`,
      okText: '确认定标',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await tenderingAPI.awardBid(bid.tender_id, bidId);
          message.success('定标成功');
          fetchData();
        } catch (err) {
          message.error(err.response?.data?.message || '定标失败');
        }
      },
    });
  };

  const openEvalModal = () => {
    form.resetFields();
    form.setFieldsValue({ score: 0, price_score: 0, tech_score: 0, recommended: false });
    setEvalModalVisible(true);
  };

  const handleSubmitEval = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await tenderingAPI.submitEvaluation(bid.tender_id, {
        ...values,
        supplier_id: bid.supplier_id,
        bid_id: bidId,
      });
      message.success('评标已提交');
      setEvalModalVisible(false);
      fetchData();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !bid) return <Card><Spin /> 正在加载…</Card>;
  if (!bid) return <Card><Empty description="投标记录不存在" /></Card>;

  const statusInfo = BID_STATUS[bid.status] || { text: bid.status, color: 'default' };
  const canWithdraw = ['submitted', 'draft'].includes(bid.status);
  const canAward = ['submitted', 'lost'].includes(bid.status);
  const isWon = bid.status === 'won';

  const evalColumns = [
    {
      title: '评标人',
      dataIndex: 'evaluator_name',
      render: (v, r) => v || r.evaluator_username || '-',
    },
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
    { title: '时间', dataIndex: 'evaluated_at', width: 150, render: v => formatDateTime(v) },
  ];

  return (
    <div>
      <PageHeader
        title={`投标详情 - ${bid.supplier_name || ''}`}
        onBack={() => navigate(`/tendering/projects/${bid.tender_id}/bids`)}
        statusTag={<StatusTag status={bid.status} statusMap={BID_STATUS} />}
        extra={
          <Space wrap>
            {canWithdraw ? (
              <Button danger icon={<RollbackOutlined />} onClick={handleWithdraw}>
                撤销投标
              </Button>
            ) : null}
            {canAward ? (
              <Button type="primary" icon={<TrophyOutlined />} onClick={handleAward}>
                定标
              </Button>
            ) : null}
          </Space>
        }
      />

      {isWon ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="此投标已中标，可基于此创建合同"
          action={
            <Button
              size="small"
              type="primary"
              onClick={() => navigate(`/tendering/contracts/new?tender_id=${bid.tender_id}`)}
            >
              创建合同
            </Button>
          }
        />
      ) : null}

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card size="small" title="基本信息" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" colon>
              <Descriptions.Item label="供应商">{bid.supplier_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="统一信用代码">{bid.unified_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="联系人">{bid.contact_person || '-'}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{bid.contact_phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="投标报价" span={2}>
                <span style={{ color: '#fa8c16', fontWeight: 600, fontSize: 18 }}>
                  {bid.bid_amount != null
                    ? `${bid.bid_currency || 'CNY'} ${Number(bid.bid_amount).toLocaleString()}`
                    : '-'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="提交时间" span={2}>
                {formatDateTime(bid.submitted_at)}
              </Descriptions.Item>
              <Descriptions.Item label="投标说明" span={2}>
                {bid.bid_desc || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            size="small"
            title="评标记录"
            style={{ marginBottom: 16 }}
            extra={
              <Button type="primary" icon={<EditOutlined />} onClick={openEvalModal}>
                提交评标
              </Button>
            }
          >
            {(!bid.evaluations || bid.evaluations.length === 0) ? (
              <Empty description="尚未评标" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveTable
                size="small"
                dataSource={bid.evaluations}
                rowKey="id"
                pagination={false}
                columns={evalColumns}
                mobileTitleKey="evaluator_name"
                mobileStatusRender={r => (
                  <StatusTag status={String(r.recommended)} statusMap={RECOMMEND_MAP} size="small" />
                )}
                mobileFields={[
                  { label: '总分', key: 'score', render: v => v ?? '-' },
                  { label: '价格分', key: 'price_score' },
                  { label: '技术分', key: 'tech_score' },
                  { label: '时间', key: 'evaluated_at', render: formatDateTime },
                  { label: '意见', key: 'evaluation_comment', span: 2 },
                ]}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card size="small" title="供应商速览" style={{ marginBottom: 16 }}>
            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <UserOutlined style={{ color: '#8c8c8c', marginRight: 6 }} />
                <strong>{bid.supplier_name || '-'}</strong>
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                信用代码：{bid.unified_code || '-'}
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                联系人：{bid.contact_person || '-'} · {bid.contact_phone || '-'}
              </div>
            </Space>
          </Card>

          {bid.evaluations?.length > 0 ? (
            <Card size="small" title="评分汇总">
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>平均总分</div>
                <div style={{ fontSize: 32, fontWeight: 600, color: '#fa8c16' }}>
                  {(
                    bid.evaluations.reduce((s, e) => s + Number(e.score || 0), 0) / bid.evaluations.length
                  ).toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                  共 {bid.evaluations.length} 人评标
                </div>
              </div>
            </Card>
          ) : null}
        </Col>
      </Row>

      <Modal
        title="提交评标"
        open={evalModalVisible}
        onOk={handleSubmitEval}
        onCancel={() => setEvalModalVisible(false)}
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
