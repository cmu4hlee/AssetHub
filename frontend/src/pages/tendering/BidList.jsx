import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import { Button, Space, message, Modal, Form, Input, InputNumber, Select, Row, Col, Alert, Empty } from 'antd';
import {
  PlusOutlined, TrophyOutlined, RollbackOutlined, EyeOutlined, CheckCircleOutlined,
  ClockCircleOutlined, DollarOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import { BID_STATUS, TENDER_STATUS, formatDateTime } from '../../constants/tendering';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import {
  PageHeader, FilterBar, StatusTag, KpiCard, ResponsiveTable,
} from '../../components/tendering';

const STATUS_OPTIONS = Object.entries(BID_STATUS).map(([k, v]) => ({ value: k, label: v.text }));
const CURRENCY_OPTIONS = [
  { value: 'CNY', label: '人民币 CNY' },
  { value: 'USD', label: '美元 USD' },
  { value: 'EUR', label: '欧元 EUR' },
];

const formatBidAmount = (v, r) => v != null ? `${r?.bid_currency || 'CNY'} ${Number(v).toLocaleString()}` : '-';

export default function BidList() {
  const canDelete = useCan('tender', 'delete');
  const canEdit = useCan('tender', 'edit');
  const navigate = useNavigate();
  const { id: tenderId } = useParams();
  const [loading, setLoading] = useState(false);
  const [tender, setTender] = useState(null);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState([]);
  const [stats, setStats] = useState({ submitted: 0, won: 0, lost: 0, withdrawn: 0 });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [filters, setFilters] = useState({ keyword: '', status: '' });
  const debouncedKeyword = useDebouncedValue(filters.keyword, 300);
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchTender = useCallback(async () => {
    if (!tenderId) return;
    try {
      const res = await tenderingAPI.getProject(tenderId);
      setTender(res?.data ?? res);
    } catch (err) {
      message.error(err.response?.data?.message || '获取招标项目失败');
    }
  }, [tenderId]);

  const fetchData = useCallback(async () => {
    if (!tenderId) return;
    setLoading(true);
    try {
      const res = await tenderingAPI.listBids(tenderId, {
        page: pagination.page,
        pageSize: pagination.pageSize,
        status: filters.status,
        keyword: debouncedKeyword,
      });
      const dataArr = Array.isArray(res?.data) ? res.data : [];
      setData(dataArr);
      const counts = dataArr.reduce((acc, r) => {
        if (r.status) acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      setStats({
        submitted: counts.submitted || 0,
        won: counts.won || 0,
        lost: counts.lost || 0,
        withdrawn: counts.withdrawn || 0,
      });
    } catch (err) {
      message.error(err.response?.data?.message || '获取投标列表失败');
    } finally {
      setLoading(false);
    }
  }, [tenderId, pagination.page, pagination.pageSize, filters.status, debouncedKeyword]);

  const fetchSummary = useCallback(async () => {
    if (!tenderId) return;
    try {
      const res = await tenderingAPI.summarizeEvaluations(tenderId);
      const arr = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setSummary(arr);
    } catch (err) {
      setSummary([]);
    }
  }, [tenderId]);

  useEffect(() => { fetchTender(); }, [fetchTender]);
  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const loadSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    try {
      const res = await tenderingAPI.listSuppliers({ pageSize: 200 });
      setSuppliers(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      message.error('获取供应商列表失败');
    } finally {
      setSuppliersLoading(false);
    }
  }, []);

  const openSubmitModal = () => {
    loadSuppliers();
    form.resetFields();
    form.setFieldsValue({ bid_currency: 'CNY', draft_only: false });
    setSubmitModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await tenderingAPI.submitBid(tenderId, values);
      message.success('投标提交成功');
      setSubmitModalVisible(false);
      fetchData();
      fetchTender();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || '提交失败');
    }
  };

  const handleWithdraw = async bidId => {
    try {
      await tenderingAPI.withdrawBid(bidId);
      message.success('已撤销投标');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '撤销失败');
    }
  };

  const handleAward = bid => {
    Modal.confirm({
      title: '确认定标',
      content: `确认将「${bid.supplier_name}」标记为本招标项目的中标供应商？此操作不可撤销。`,
      okText: '确认定标',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await tenderingAPI.awardBid(tenderId, bid.id);
          message.success('定标成功');
          fetchData();
          fetchTender();
        } catch (err) {
          message.error(err.response?.data?.message || '定标失败');
        }
      },
    });
  };

  const handleEnterEvaluating = async () => {
    try {
      await tenderingAPI.changeProjectStatus(tenderId, 'evaluating');
      message.success('已进入评标阶段');
      fetchTender();
    } catch (err) {
      message.error(err.response?.data?.message || '状态更新失败');
    }
  };

  const handleCompleteTender = async () => {
    try {
      await tenderingAPI.changeProjectStatus(tenderId, 'completed');
      message.success('招标已完成');
      fetchTender();
    } catch (err) {
      message.error(err.response?.data?.message || '状态更新失败');
    }
  };

  const handleReset = () => {
    setFilters({ keyword: '', status: '' });
    setPagination({ page: 1, pageSize: 20 });
  };

  const totalAmount = data.reduce((sum, r) => sum + (Number(r.bid_amount) || 0), 0);

  const columns = [
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      width: 200,
      fixed: 'left',
      ellipsis: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/tendering/bids/${record.id}`)}>{text || '-'}</a>
      ),
    },
    { title: '统一信用代码', dataIndex: 'unified_code', width: 180, render: v => v || '-' },
    {
      title: '投标报价',
      dataIndex: 'bid_amount',
      width: 160,
      align: 'right',
      render: (v, r) => <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatBidAmount(v, r)}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: v => <StatusTag status={v} statusMap={BID_STATUS} />,
    },
    { title: '提交时间', dataIndex: 'submitted_at', width: 160, render: v => formatDateTime(v) },
    { title: '说明', dataIndex: 'bid_desc', ellipsis: true, render: v => v || '-' },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_, record) => {
        const canWithdraw = ['submitted', 'draft'].includes(record.status);
        const canAward = ['submitted', 'lost'].includes(record.status) && tender && tender.status === 'evaluating';
        return (
          <Space size="small" wrap>
            <Button
              type="link" size="small" icon={<EyeOutlined />}
              onClick={() => navigate(`/tendering/bids/${record.id}`)}
            >
              详情
            </Button>
            {canWithdraw ? (
              <Button
                type="link" size="small" danger icon={<RollbackOutlined />}
                onClick={() => Modal.confirm({
                  title: '确认撤销该投标？',
                  onOk: () => handleWithdraw(record.id),
                })}
              >
                撤销
              </Button>
            ) : null}
            {canAward ? (
              <Button
                type="link" size="small" icon={<TrophyOutlined />}
                onClick={() => handleAward(record)}
              >
                定标
              </Button>
            ) : null}
          </Space>
        );
      },
    },
  ];

  const mobileFields = [
    { label: '统一信用代码', key: 'unified_code' },
    {
      label: '投标报价',
      key: 'bid_amount',
      span: 2,
      render: (v, r) => <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatBidAmount(v, r)}</span>,
    },
    { label: '提交时间', key: 'submitted_at', render: formatDateTime },
    { label: '说明', key: 'bid_desc', span: 2 },
  ];

  const mobileActions = row => {
    const canWithdraw = ['submitted', 'draft'].includes(row.status);
    const canAward = ['submitted', 'lost'].includes(row.status) && tender && tender.status === 'evaluating';
    return [
      { key: 'view', text: '详情', icon: <EyeOutlined />, type: 'primary',
        onClick: r => navigate(`/tendering/bids/${r.id}`) },
      { key: 'withdraw', text: '撤销', icon: <RollbackOutlined />, danger: true,
        hidden: !canWithdraw, confirm: '确认撤销该投标？',
        onClick: r => handleWithdraw(r.id) },
      { key: 'award', text: '定标', icon: <TrophyOutlined />, type: 'primary',
        hidden: !canAward, onClick: r => handleAward(r) },
    ];
  };

  const summaryColumns = [
    { title: '供应商', dataIndex: 'supplier_name' },
    { title: '评标人数', dataIndex: 'evaluator_count', width: 110, align: 'right' },
    {
      title: '平均总分', dataIndex: 'avg_score', width: 110, align: 'right',
      render: v => v != null ? <strong style={{ color: '#fa8c16' }}>{Number(v).toFixed(2)}</strong> : '-',
    },
    { title: '平均价格分', dataIndex: 'avg_price_score', width: 130, align: 'right' },
    { title: '平均技术分', dataIndex: 'avg_tech_score', width: 130, align: 'right' },
    {
      title: '推荐次数', dataIndex: 'recommend_count', width: 110, align: 'right',
      render: v => v > 0
        ? <StatusTag status="1" statusMap={{ 1: { text: v, color: 'success' } }} size="small" />
        : 0,
    },
  ];

  return (
    <div>
      <PageHeader
        title="投标管理"
        count={data.length}
        description={
          tender
            ? `${tender.title} · 合计 ${data.length} 个投标 · 平均报价 ¥${data.length ? Math.round(totalAmount / data.length).toLocaleString() : 0}`
            : '加载中...'
        }
        onBack={() => navigate(`/tendering/projects/${tenderId}`)}
        statusTag={tender ? <StatusTag status={tender.status} statusMap={TENDER_STATUS} /> : null}
        extra={
          <Space wrap>
            {tender && ['published', 'bidding'].includes(tender.status) ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openSubmitModal}>
                录入投标
              </Button>
            ) : null}
            {tender && tender.status === 'bidding' ? (
              <Button onClick={handleEnterEvaluating}>进入评标</Button>
            ) : null}
            {tender && tender.status === 'awarded' ? (
              <Button type="primary" onClick={handleCompleteTender}>完成招标</Button>
            ) : null}
            {tender ? (
              <Button onClick={() => navigate(`/tendering/projects/${tenderId}/evaluations`)}>
                评标打分
              </Button>
            ) : null}
          </Space>
        }
      />

      {tender && tender.status === 'evaluating' ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前处于评标阶段，可以对每个投标进行打分"
        />
      ) : null}

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已提交"
            value={stats.submitted}
            tone="primary"
            icon={<ClockCircleOutlined />}
            hint="等待评标"
            onClick={() => setFilters(f => ({ ...f, status: 'submitted' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已中标"
            value={stats.won}
            tone="success"
            icon={<TrophyOutlined />}
            hint="已定标"
            onClick={() => setFilters(f => ({ ...f, status: 'won' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="未中标"
            value={stats.lost}
            tone="danger"
            icon={<CloseCircleOutlined />}
            hint="其他供应商中标"
            onClick={() => setFilters(f => ({ ...f, status: 'lost' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已撤销"
            value={stats.withdrawn}
            tone="default"
            icon={<RollbackOutlined />}
            hint="主动撤回"
            onClick={() => setFilters(f => ({ ...f, status: 'withdrawn' }))}
          />
        </Col>
      </Row>

      <FilterBar
        fields={[
          { name: 'keyword', type: 'input', placeholder: '搜索供应商/说明', width: 240 },
          { name: 'status', type: 'select', placeholder: '投标状态', options: STATUS_OPTIONS, width: 140 },
        ]}
        values={filters}
        onChange={setFilters}
        onSearch={() => setPagination(p => ({ ...p, page: 1 }))}
        onReset={handleReset}
        searchLoading={loading}
      />

      <ResponsiveTable
        dataSource={data}
        columns={columns}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1300 }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          showSizeChanger: true,
          showTotal: t => `共 ${t} 条`,
          onChange: (page, pageSize) => setPagination({ page, pageSize }),
        }}
        mobileTitleKey="supplier_name"
        mobileStatusRender={r => <StatusTag status={r.status} statusMap={BID_STATUS} size="small" />}
        mobileFields={mobileFields}
        mobileActions={mobileActions}
      />

      {summary.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <PageHeader title="评标汇总" />
          <ResponsiveTable
            size="small"
            dataSource={summary}
            rowKey="supplier_id"
            pagination={false}
            columns={summaryColumns}
            mobileTitleKey="supplier_name"
            mobileFields={[
              { label: '评标人数', key: 'evaluator_count' },
              { label: '平均总分', key: 'avg_score', render: v => v != null ? <strong style={{ color: '#fa8c16' }}>{Number(v).toFixed(2)}</strong> : '-' },
              { label: '平均价格分', key: 'avg_price_score' },
              { label: '平均技术分', key: 'avg_tech_score' },
              { label: '推荐次数', key: 'recommend_count' },
            ]}
          />
        </div>
      ) : null}

      <Modal
        title="录入投标"
        open={submitModalVisible}
        onOk={handleSubmit}
        onCancel={() => setSubmitModalVisible(false)}
        okText="提交"
        cancelText="取消"
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="supplier_id" label="供应商" rules={[{ required: true, message: '请选择供应商' }]}>
            <Select
              showSearch
              loading={suppliersLoading}
              placeholder="选择供应商"
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={suppliers.map(s => ({ value: s.id, label: s.supplier_name }))}
            />
          </Form.Item>
          <Form.Item name="bid_amount" label="投标报价" rules={[{ type: 'number', min: 0, message: '金额必须 ≥ 0' }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="0.00" />
          </Form.Item>
          <Form.Item name="bid_currency" label="币种">
            <Select options={CURRENCY_OPTIONS} />
          </Form.Item>
          <Form.Item name="bid_desc" label="投标说明">
            <Input.TextArea rows={3} placeholder="技术方案、服务承诺、交付期等" />
          </Form.Item>
          <Form.Item name="draft_only" initialValue={false}>
            <Select
              options={[
                { value: false, label: '直接提交' },
                { value: true, label: '仅保存草稿' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
