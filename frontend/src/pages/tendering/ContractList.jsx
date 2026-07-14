import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import { Button, Space, Popconfirm, message, Row, Col } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, BarChartOutlined,
  FileTextOutlined, SignatureOutlined, DollarOutlined, AuditOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  CONTRACT_STATUS,
  CONTRACT_TYPE,
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

const STATUS_OPTIONS = Object.entries(CONTRACT_STATUS).map(([k, v]) => ({ value: k, label: v.text }));
const TYPE_OPTIONS = Object.entries(CONTRACT_TYPE).map(([k, v]) => ({ value: k, label: v.text }));

const isEditable = status => status === 'draft' || status === 'rejected';
const isDeletable = status => status === 'draft' || status === 'terminated';

export default function ContractList() {
  const canDelete = useCan('tender', 'delete');
  const canEdit = useCan('tender', 'edit');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, signed: 0, executing: 0, archived: 0 });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [filters, setFilters] = useState({
    keyword: '',
    status: searchParams.get('status') || '',
    tender_id: searchParams.get('tender_id') || '',
    supplier_id: searchParams.get('supplier_id') || '',
    contract_type: '',
  });
  const debouncedKeyword = useDebouncedValue(filters.keyword, 300);

  const fetchStats = useCallback(async () => {
    try {
      const res = await tenderingAPI.getContractStatistics();
      setStats(res?.data || res);
    } catch {
      // 静默
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.listContracts({
        page: pagination.page,
        pageSize: pagination.pageSize,
        status: filters.status,
        tender_id: filters.tender_id,
        supplier_id: filters.supplier_id,
        contract_type: filters.contract_type,
        keyword: debouncedKeyword,
      });
      const dataArr = Array.isArray(res?.data) ? res.data : [];
      setData(dataArr);
      setTotal(Number(res?.pagination?.total ?? dataArr.length));
    } catch (err) {
      message.error(err.response?.data?.message || '获取合同列表失败');
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page, pagination.pageSize,
    filters.status, filters.tender_id, filters.supplier_id, filters.contract_type,
    debouncedKeyword,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleDelete = async id => {
    try {
      await tenderingAPI.deleteContract(id);
      message.success('删除成功');
      fetchData();
      fetchStats();
    } catch (err) {
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const handleReset = () => {
    setFilters({
      keyword: '', status: '', tender_id: '', supplier_id: '', contract_type: '',
    });
    setPagination({ page: 1, pageSize: 20 });
  };

  const columns = [
    { title: '合同编号', dataIndex: 'contract_code', width: 200, fixed: 'left', ellipsis: true },
    {
      title: '合同名称',
      dataIndex: 'contract_name',
      ellipsis: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/tendering/contracts/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '合同类型',
      dataIndex: 'contract_type',
      width: 110,
      render: v => <StatusTag status={v} statusMap={CONTRACT_TYPE} size="small" bordered />,
    },
    { title: '供应商', dataIndex: 'supplier_name', width: 160, render: v => v || '-' },
    {
      title: '关联招标',
      dataIndex: 'tender_code',
      width: 180,
      render: (v, record) => v ? (
        <a onClick={() => navigate(`/tendering/projects/${record.tender_id}`)}>{v}</a>
      ) : '-',
    },
    {
      title: '合同金额',
      dataIndex: 'contract_amount',
      width: 140,
      align: 'right',
      render: v => <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: v => <StatusTag status={v} statusMap={CONTRACT_STATUS} />,
    },
    { title: '签订日期', dataIndex: 'sign_date', width: 120, render: v => v || '-' },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/tendering/contracts/${record.id}`)}
          >
            详情
          </Button>
          {isEditable(record.status) ? (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/tendering/contracts/edit/${record.id}`)}
            >
              编辑
            </Button>
          ) : null}
          {isDeletable(record.status) ? (
            <Popconfirm title="确认删除该合同？" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
                删除
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const mobileFields = [
    { label: '合同编号', key: 'contract_code', span: 2 },
    {
      label: '类型',
      key: 'contract_type',
      render: v => <StatusTag status={v} statusMap={CONTRACT_TYPE} size="small" bordered />,
    },
    { label: '供应商', key: 'supplier_name' },
    {
      label: '金额',
      key: 'contract_amount',
      render: v => <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    { label: '关联招标', key: 'tender_code' },
    { label: '签订日期', key: 'sign_date' },
  ];

  const mobileActions = row => {
    const editable = isEditable(row.status);
    const deletable = isDeletable(row.status);
    return [
      {
        key: 'view', text: '详情', icon: <EyeOutlined />, type: 'primary',
        onClick: r => navigate(`/tendering/contracts/${r.id}`),
      },
      {
        key: 'edit', text: '编辑', icon: <EditOutlined />, hidden: !editable,
        onClick: r => navigate(`/tendering/contracts/edit/${r.id}`),
      },
      {
        key: 'delete', text: '删除', icon: <DeleteOutlined />, danger: true, hidden: !deletable,
        confirm: '确认删除该合同？', onClick: r => handleDelete(r.id),
      },
    ];
  };

  const totals = stats?.totals || {};

  return (
    <div>
      <PageHeader
        title="合同管理"
        count={total}
        description="管理从起草、审批、签订到执行归档的全流程"
        extra={
          <Space wrap>
            <Button icon={<BarChartOutlined />} onClick={() => navigate('/tendering/dashboard')}>
              统计概览
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tendering/contracts/new')}>
              新建合同
            </Button>
          </Space>
        }
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <KpiCard
            title="合同总数"
            value={totals.total_contracts || 0}
            tone="primary"
            icon={<FileTextOutlined />}
            hint={`已签订 ${totals.signed_count || 0} 份`}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已签订金额"
            value={formatMoney(totals.signed_amount || 0, false, 0)}
            suffix="元"
            tone="success"
            icon={<SignatureOutlined />}
            hint="累计签订合同金额"
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="执行中"
            value={totals.executing_count || 0}
            tone="cyan"
            icon={<DollarOutlined />}
            hint="正在履行合同"
            onClick={() => setFilters(f => ({ ...f, status: 'executing' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="归档金额"
            value={formatMoney(totals.archived_amount || 0, false, 0)}
            suffix="元"
            tone="purple"
            icon={<AuditOutlined />}
            hint="已归档合同金额"
          />
        </Col>
      </Row>

      <FilterBar
        fields={[
          { name: 'keyword', type: 'input', placeholder: '搜索合同编号/名称', width: 240 },
          { name: 'contract_type', type: 'select', placeholder: '合同类型', options: TYPE_OPTIONS, width: 140 },
          { name: 'status', type: 'select', placeholder: '合同状态', options: STATUS_OPTIONS, width: 140 },
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
        scroll={{ x: 1400 }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total,
          showSizeChanger: true,
          showTotal: t => `共 ${t} 条`,
          onChange: (page, pageSize) => setPagination({ page, pageSize }),
        }}
        mobileTitleKey="contract_name"
        mobileStatusRender={r => <StatusTag status={r.status} statusMap={CONTRACT_STATUS} size="small" />}
        mobileFields={mobileFields}
        mobileActions={mobileActions}
      />
    </div>
  );
}
