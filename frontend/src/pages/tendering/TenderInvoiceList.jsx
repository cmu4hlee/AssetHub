import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import { Button, Space, Popconfirm, message, Row, Col } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, BarChartOutlined,
  FileTextOutlined, SendOutlined, CheckCircleOutlined,
  InboxOutlined, ExclamationCircleOutlined, DollarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  INVOICE_STATUS,
  INVOICE_KIND,
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

const STATUS_OPTIONS = Object.entries(INVOICE_STATUS).map(([k, v]) => ({ value: k, label: v.text }));
const KIND_OPTIONS = Object.entries(INVOICE_KIND).map(([k, v]) => ({ value: k, label: v.text }));

const ACTIONS = {
  draft: [{ name: 'submit', label: '提交', icon: <SendOutlined /> }],
  pending: [{ name: 'verify', label: '核验', icon: <CheckCircleOutlined />, type: 'primary' }],
  errored: [{ name: 'retry', label: '重提', icon: <ExclamationCircleOutlined />, type: 'primary' }],
  verified: [{ name: 'claim', label: '认证抵扣', icon: <FileTextOutlined />, type: 'primary' }],
  claimed: [{ name: 'pay', label: '付款', icon: <DollarOutlined />, type: 'primary' }],
  paid: [{ name: 'archive', label: '归档', icon: <InboxOutlined /> }],
};

const FN_MAP = {
  submit: tenderingAPI.submitInvoice,
  verify: tenderingAPI.verifyInvoice,
  claim: tenderingAPI.claimInvoice,
  pay: tenderingAPI.payInvoice,
  archive: tenderingAPI.archiveInvoice,
  cancel: tenderingAPI.cancelInvoice,
  retry: tenderingAPI.retryInvoice,
};

const CANCELABLE = ['draft', 'pending', 'errored', 'verified', 'claimed'];

export default function XXX() {
  const canDelete = useCan('tender', 'delete');
  const canEdit = useCan('tender', 'edit');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ pending: 0, verified: 0, paid: 0, errored: 0 });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [filters, setFilters] = useState({ keyword: '', status: '', kind: '' });
  const debouncedKeyword = useDebouncedValue(filters.keyword, 300);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.listInvoices({
        page: pagination.page,
        pageSize: pagination.pageSize,
        status: filters.status,
        kind: filters.kind,
        keyword: debouncedKeyword,
      });
      const dataArr = Array.isArray(res?.data) ? res.data : [];
      setData(dataArr);
      setTotal(Number(res?.pagination?.total ?? dataArr.length));
      const counts = dataArr.reduce((acc, r) => {
        if (r.status) acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      setStats({
        pending: counts.pending || 0,
        verified: counts.verified || 0,
        paid: counts.paid || 0,
        errored: counts.errored || 0,
      });
    } catch (err) {
      message.error(err.response?.data?.message || '获取发票列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters.status, filters.kind, debouncedKeyword]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (name, id) => {
    const fn = FN_MAP[name];
    if (!fn) return;
    try {
      await fn(id);
      message.success('操作成功');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  const handleDelete = async id => {
    try {
      await tenderingAPI.deleteInvoice(id);
      message.success('删除成功');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const handleReset = () => {
    setFilters({ keyword: '', status: '', kind: '' });
    setPagination({ page: 1, pageSize: 20 });
  };

  const totalAmount = data.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const totalTax = data.reduce((sum, r) => sum + (Number(r.tax_amount) || 0), 0);

  const columns = [
    { title: '发票号', dataIndex: 'invoice_code', width: 200, fixed: 'left', ellipsis: true },
    { title: '实际发票号', dataIndex: 'invoice_no', width: 140, render: v => v || '-' },
    {
      title: '类型',
      dataIndex: 'invoice_kind',
      width: 130,
      render: v => <StatusTag status={v} statusMap={INVOICE_KIND} size="small" bordered />,
    },
    {
      title: '金额(含税)',
      dataIndex: 'amount',
      width: 130,
      align: 'right',
      render: v => <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    {
      title: '税额',
      dataIndex: 'tax_amount',
      width: 110,
      align: 'right',
      render: v => formatMoney(v, false, 0),
    },
    { title: '开票日期', dataIndex: 'issue_date', width: 120, render: v => v || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: v => <StatusTag status={v} statusMap={INVOICE_STATUS} />,
    },
    {
      title: '入账属性',
      dataIndex: 'accounting_kind',
      width: 100,
      render: v => v === 'capitalize'
        ? <StatusTag status="capitalize" statusMap={{ capitalize: { text: '资本化', color: 'green' } }} size="small" bordered />
        : <StatusTag status="expense" statusMap={{ expense: { text: '费用化', color: 'orange' } }} size="small" bordered />,
    },
    { title: '创建时间', dataIndex: 'created_at', width: 160, render: v => formatDateTime(v) },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right',
      render: (_, row) => {
        const nextActions = ACTIONS[row.status] || [];
        const cancelable = CANCELABLE.includes(row.status);
        return (
          <Space size="small" wrap>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/tendering/invoices/${row.id}`)}
            >
              详情
            </Button>
            {nextActions.map(a => (
              <Button
                key={a.name}
                type="link"
                size="small"
                onClick={() => handleAction(a.name, row.id)}
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
                  onClick={() => navigate(`/tendering/invoices/${row.id}/edit`)}
                >
                  编辑
                </Button>
                <Popconfirm title="删除该发票？" onConfirm={() => handleDelete(row.id)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
                    删除
                  </Button>
                </Popconfirm>
              </>
            ) : null}
            {cancelable ? (
              <Popconfirm title="取消发票？" onConfirm={() => handleAction('cancel', row.id)}>
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
    { label: '发票号', key: 'invoice_code', span: 2 },
    { label: '实际号', key: 'invoice_no' },
    {
      label: '类型',
      key: 'invoice_kind',
      render: v => <StatusTag status={v} statusMap={INVOICE_KIND} size="small" bordered />,
    },
    {
      label: '金额',
      key: 'amount',
      render: v => <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    { label: '税额', key: 'tax_amount', render: v => formatMoney(v, false, 0) },
    { label: '开票日期', key: 'issue_date' },
  ];

  const mobileActions = row => {
    const nextActions = ACTIONS[row.status] || [];
    const cancelable = CANCELABLE.includes(row.status);
    return [
      {
        key: 'view', text: '详情', icon: <EyeOutlined />, type: 'primary',
        onClick: r => navigate(`/tendering/invoices/${r.id}`),
      },
      ...nextActions.map(a => ({
        key: a.name, text: a.label, icon: a.icon, type: a.type,
        onClick: r => handleAction(a.name, r.id),
      })),
      {
        key: 'edit', text: '编辑', icon: <EditOutlined />, hidden: row.status !== 'draft',
        onClick: r => navigate(`/tendering/invoices/${r.id}/edit`),
      },
      {
        key: 'delete', text: '删除', icon: <DeleteOutlined />, danger: true,
        hidden: row.status !== 'draft', confirm: '删除该发票？',
        onClick: r => handleDelete(r.id),
      },
      {
        key: 'cancel', text: '取消', danger: true, hidden: !cancelable,
        confirm: '取消发票？', onClick: r => handleAction('cancel', r.id),
      },
    ];
  };

  return (
    <div>
      <PageHeader
        title="发票管理"
        count={total}
        description={`管理所有发票，本页合计 ${formatMoney(totalAmount)} (含税 ${formatMoney(totalTax)} 税额)`}
        extra={
          <Space wrap>
            <Button icon={<BarChartOutlined />} onClick={() => navigate('/tendering/invoices/statistics')}>
              发票统计
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tendering/invoices/new')}>
              新增发票
            </Button>
          </Space>
        }
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <KpiCard
            title="待核验"
            value={stats.pending}
            tone="primary"
            icon={<SendOutlined />}
            hint="等待核验"
            onClick={() => setFilters(f => ({ ...f, status: 'pending' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已核验"
            value={stats.verified}
            tone="cyan"
            icon={<CheckCircleOutlined />}
            hint="可继续认证抵扣"
            onClick={() => setFilters(f => ({ ...f, status: 'verified' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已付款"
            value={stats.paid}
            tone="success"
            icon={<DollarOutlined />}
            hint="付款完成的发票"
            onClick={() => setFilters(f => ({ ...f, status: 'paid' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="异常"
            value={stats.errored}
            tone="danger"
            icon={<ExclamationCircleOutlined />}
            hint="需要处理"
            onClick={() => setFilters(f => ({ ...f, status: 'errored' }))}
          />
        </Col>
      </Row>

      <FilterBar
        fields={[
          { name: 'keyword', type: 'input', placeholder: '搜索系统号/实际号/备注', width: 240 },
          { name: 'kind', type: 'select', placeholder: '发票类型', options: KIND_OPTIONS, width: 150 },
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
        scroll={{ x: 1500 }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total,
          showSizeChanger: true,
          showTotal: t => `共 ${t} 条`,
          onChange: (page, pageSize) => setPagination({ page, pageSize }),
        }}
        mobileTitleKey="invoice_code"
        mobileStatusRender={r => <StatusTag status={r.status} statusMap={INVOICE_STATUS} size="small" />}
        mobileFields={mobileFields}
        mobileActions={mobileActions}
      />
    </div>
  );
}
