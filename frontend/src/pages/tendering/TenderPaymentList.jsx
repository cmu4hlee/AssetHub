import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import { Button, Space, Popconfirm, message, Row, Col } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  DollarOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  SendOutlined, ToolOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  formatMoney,
  formatDateTime,
} from '../../constants/tendering';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import {
  PageHeader,
  FilterBar,
  StatusTag,
  KpiCard,
  ResponsiveTable,
} from '../../components/tendering';

const STATUS_OPTIONS = Object.entries(PAYMENT_STATUS).map(([k, v]) => ({ value: k, label: v.text }));
const METHOD_OPTIONS = Object.entries(PAYMENT_METHOD).map(([k, v]) => ({ value: k, label: v.text }));

const ACTIONS = {
  draft: [{ name: 'submit', label: '提交', type: 'primary' }],
  submitted: [{ name: 'pay', label: '开始付款', type: 'primary' }],
  paying: [{ name: 'complete', label: '完成付款', type: 'primary' }],
  failed: [{ name: 're-submit', label: '重新提交', type: 'primary' }],
};

const FN_MAP = {
  submit: tenderingAPI.submitPayment,
  pay: tenderingAPI.payPayment,
  complete: tenderingAPI.completePayment,
  're-submit': tenderingAPI.reSubmitPayment,
  cancel: tenderingAPI.cancelPayment,
};

export default function XXX() {
  const canDelete = useCan('tender', 'delete');
  const canEdit = useCan('tender', 'edit');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ draft: 0, submitted: 0, paying: 0, paid: 0, failed: 0 });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [filters, setFilters] = useState({ keyword: '', status: '', pay_method: '' });
  const debounced = useDebouncedValue(filters.keyword, 300);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.listPayments({
        page: pagination.page,
        pageSize: pagination.pageSize,
        status: filters.status,
        pay_method: filters.pay_method,
        keyword: debounced,
      });
      const arr = Array.isArray(res?.data) ? res.data : [];
      setData(arr);
      setTotal(Number(res?.pagination?.total ?? arr.length));
      const counts = arr.reduce((acc, r) => {
        if (r.status) acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      setStats({
        draft: counts.draft || 0,
        submitted: counts.submitted || 0,
        paying: counts.paying || 0,
        paid: counts.paid || 0,
        failed: counts.failed || 0,
      });
    } catch (e) {
      message.error(e.response?.data?.message || '获取付款列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters.status, filters.pay_method, debounced]);

  useEffect(() => { fetch(); }, [fetch]);

  const onAction = async (name, id) => {
    const fn = FN_MAP[name];
    if (!fn) return;
    try {
      await fn(id);
      message.success('操作成功');
      fetch();
    } catch (e) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const onDelete = async id => {
    try {
      await tenderingAPI.deletePayment(id);
      message.success('已删除');
      fetch();
    } catch (e) {
      message.error(e.response?.data?.message || '删除失败');
    }
  };

  const handleReset = () => {
    setFilters({ keyword: '', status: '', pay_method: '' });
    setPagination({ page: 1, pageSize: 20 });
  };

  const totalAmount = data.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const columns = [
    { title: '付款单号', dataIndex: 'payment_code', width: 200, fixed: 'left', ellipsis: true },
    { title: '收款方', dataIndex: 'payee_name', width: 180, ellipsis: true, render: v => v || '-' },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 140,
      align: 'right',
      render: v => <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    {
      title: '付款方式',
      dataIndex: 'pay_method',
      width: 110,
      render: v => v ? (PAYMENT_METHOD[v]?.text || v) : '-',
    },
    { title: '合同', dataIndex: 'contract_code', width: 160, ellipsis: true, render: v => v || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: v => <StatusTag status={v} statusMap={PAYMENT_STATUS} />,
    },
    { title: '付款日期', dataIndex: 'pay_date', width: 120, render: v => v || '-' },
    { title: '完成时间', dataIndex: 'paid_at', width: 160, render: v => formatDateTime(v) },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, row) => {
        const next = ACTIONS[row.status] || [];
        const cancelable = ['draft', 'submitted', 'paying', 'failed'].includes(row.status);
        return (
          <Space size="small" wrap>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/tendering/payments/${row.id}`)}
            >
              详情
            </Button>
            {next.map(a => (
              <Button
                key={a.name}
                type="link"
                size="small"
                onClick={() => onAction(a.name, row.id)}
              >
                {a.label}
              </Button>
            ))}
            {row.status === 'draft' ? (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/tendering/payments/${row.id}/edit`)}
                >
                  编辑
                </Button>
                <Popconfirm title="删除该付款单？" onConfirm={() => onDelete(row.id)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
                    删除
                  </Button>
                </Popconfirm>
              </>
            ) : null}
            {cancelable ? (
              <Popconfirm title="取消付款？" onConfirm={() => onAction('cancel', row.id)}>
                <Button type="link" size="small" danger>
                  取消
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        );
      },
    },
  ];

  const mobileFields = [
    { label: '单号', key: 'payment_code', span: 2 },
    { label: '收款方', key: 'payee_name' },
    {
      label: '金额',
      key: 'amount',
      render: v => <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    { label: '付款方式', key: 'pay_method', render: v => v ? (PAYMENT_METHOD[v]?.text || v) : '-' },
    { label: '合同', key: 'contract_code' },
    { label: '付款日期', key: 'pay_date' },
  ];

  const mobileActions = row => {
    const next = ACTIONS[row.status] || [];
    const cancelable = ['draft', 'submitted', 'paying', 'failed'].includes(row.status);
    return [
      {
        key: 'view',
        text: '详情',
        icon: <EyeOutlined />,
        type: 'primary',
        onClick: r => navigate(`/tendering/payments/${r.id}`),
      },
      ...next.map(a => ({
        key: a.name,
        text: a.label,
        onClick: r => onAction(a.name, r.id),
      })),
      {
        key: 'edit',
        text: '编辑',
        icon: <EditOutlined />,
        hidden: row.status !== 'draft',
        onClick: r => navigate(`/tendering/payments/${r.id}/edit`),
      },
      {
        key: 'delete',
        text: '删除',
        icon: <DeleteOutlined />,
        danger: true,
        hidden: row.status !== 'draft',
        confirm: '删除该付款单？',
        onClick: r => onDelete(r.id),
      },
      {
        key: 'cancel',
        text: '取消',
        danger: true,
        hidden: !cancelable,
        confirm: '取消付款？',
        onClick: r => onAction('cancel', r.id),
      },
    ];
  };

  return (
    <div>
      <PageHeader
        title="付款管理"
        count={total}
        description={`管理所有付款单据，本页合计金额 ${formatMoney(totalAmount, false, 0)} 元`}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tendering/payments/new')}>
            新增付款单
          </Button>
        }
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <KpiCard
            title="草稿"
            value={stats.draft}
            tone="default"
            icon={<EditOutlined />}
            hint="未提交的付款单"
            onClick={() => setFilters(f => ({ ...f, status: 'draft' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已提交"
            value={stats.submitted}
            tone="primary"
            icon={<SendOutlined />}
            hint="等待付款"
            onClick={() => setFilters(f => ({ ...f, status: 'submitted' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="付款中"
            value={stats.paying}
            tone="warning"
            icon={<ClockCircleOutlined />}
            hint="正在处理"
            onClick={() => setFilters(f => ({ ...f, status: 'paying' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已付款"
            value={stats.paid}
            tone="success"
            icon={<CheckCircleOutlined />}
            hint="完成付款"
            onClick={() => setFilters(f => ({ ...f, status: 'paid' }))}
          />
        </Col>
      </Row>

      <FilterBar
        fields={[
          { name: 'keyword', type: 'input', placeholder: '搜索单号/收款方/备注', width: 240 },
          { name: 'pay_method', type: 'select', placeholder: '付款方式', options: METHOD_OPTIONS, width: 140 },
          { name: 'status', type: 'select', placeholder: '状态', options: STATUS_OPTIONS, width: 140 },
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
        scroll={{ x: 1450 }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total,
          showSizeChanger: true,
          showTotal: t => `共 ${t} 条`,
          onChange: (page, pageSize) => setPagination({ page, pageSize }),
        }}
        mobileTitleKey="payment_code"
        mobileStatusRender={r => <StatusTag status={r.status} statusMap={PAYMENT_STATUS} size="small" />}
        mobileFields={mobileFields}
        mobileActions={mobileActions}
      />
    </div>
  );
}
