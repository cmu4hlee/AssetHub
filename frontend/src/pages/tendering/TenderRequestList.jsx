import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import { Button, Space, Popconfirm, message, Row, Col } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  ClockCircleOutlined, CheckCircleOutlined, AuditOutlined, TrophyOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  REQUEST_STATUS,
  TENDER_CATEGORY,
  REQUEST_STATUS_TRANSITIONS,
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

// 下拉选项
const CATEGORY_OPTIONS = Object.entries(TENDER_CATEGORY).map(([k, v]) => ({
  value: k,
  label: v.text,
}));

const STATUS_OPTIONS = Object.entries(REQUEST_STATUS).map(([k, v]) => ({
  value: k,
  label: v.text,
}));

// 计算可操作状态(草稿/待审批等可编辑状态)
const isEditable = status => {
  const nexts = REQUEST_STATUS_TRANSITIONS[status];
  return Array.isArray(nexts) && nexts.length > 0 && status !== 'cancelled' && status !== 'completed';
};

export default function XXX() {
  const canDelete = useCan('tender', 'delete');
  const canEdit = useCan('tender', 'edit');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ applying: 0, awarded: 0, completed: 0 });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [filters, setFilters] = useState({ keyword: '', category: 'simple', status: '' });
  const debouncedKeyword = useDebouncedValue(filters.keyword, 300);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.listProcurementRequests({
        page: pagination.page,
        pageSize: pagination.pageSize,
        category: filters.category,
        status: filters.status,
        keyword: debouncedKeyword,
      });
      const body = res?.data ? res : { data: res };
      const dataArr = Array.isArray(body.data) ? body.data : [];
      const totalVal = Number(body.pagination?.total ?? dataArr.length);
      setData(dataArr);
      setTotal(totalVal);

      // 简单统计
      const counts = dataArr.reduce((acc, r) => {
        if (r.status) acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      setStats({
        applying: counts.applying || 0,
        awarded: counts.awarded || 0,
        completed: counts.completed || 0,
      });
    } catch (err) {
      message.error(err.response?.data?.message || '获取采购申请列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters.category, filters.status, debouncedKeyword]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async id => {
    try {
      await tenderingAPI.deleteProcurementRequest(id);
      message.success('删除成功');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const handleReset = () => {
    setFilters({ keyword: '', category: 'simple', status: '' });
    setPagination({ page: 1, pageSize: 20 });
  };

  // 桌面端列
  const columns = [
    {
      title: '申请编号',
      dataIndex: 'request_code',
      width: 180,
      fixed: 'left',
    },
    {
      title: '采购标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (text, row) => (
        <a onClick={() => navigate(`/tendering/requests/${row.id}`)}>{text}</a>
      ),
    },
    {
      title: '流程分类',
      dataIndex: 'tender_category',
      width: 110,
      render: v => <StatusTag status={v} statusMap={TENDER_CATEGORY} size="small" bordered />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: v => <StatusTag status={v} statusMap={REQUEST_STATUS} />,
    },
    { title: '申请人', dataIndex: 'requestor_name', width: 100 },
    { title: '申请部门', dataIndex: 'request_department', width: 140, ellipsis: true },
    {
      title: '预算',
      dataIndex: 'request_budget',
      width: 130,
      align: 'right',
      render: v => <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    {
      title: '期望到货',
      dataIndex: 'expected_delivery_date',
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: v => formatDateTime(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, row) => {
        const editable = isEditable(row.status);
        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/tendering/requests/${row.id}`)}
            >
              详情
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              disabled={!editable}
              onClick={() => navigate(`/tendering/requests/${row.id}/edit`)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除该采购申请？"
              onConfirm={() => handleDelete(row.id)}
              disabled={!editable}
            >
              <Button
                type="link"
                size="small"
                danger
                disabled={!editable}
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  // 移动卡片字段
  const mobileFields = [
    { label: '申请编号', key: 'request_code', span: 2 },
    {
      label: '分类',
      key: 'tender_category',
      render: v => <StatusTag status={v} statusMap={TENDER_CATEGORY} size="small" bordered />,
    },
    {
      label: '预算',
      key: 'request_budget',
      render: v => <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    { label: '申请人', key: 'requestor_name' },
    { label: '申请部门', key: 'request_department' },
    { label: '期望到货', key: 'expected_delivery_date' },
    { label: '创建时间', key: 'created_at', render: formatDateTime },
  ];

  // 移动卡片操作（按 row 动态算隐藏/禁用）
  const mobileActions = row => {
    const editable = isEditable(row.status);
    return [
      {
        key: 'view',
        text: '详情',
        icon: <EyeOutlined />,
        type: 'primary',
        onClick: r => navigate(`/tendering/requests/${r.id}`),
      },
      {
        key: 'edit',
        text: '编辑',
        icon: <EditOutlined />,
        hidden: !editable,
        onClick: r => navigate(`/tendering/requests/${r.id}/edit`),
      },
      {
        key: 'delete',
        text: '删除',
        icon: <DeleteOutlined />,
        danger: true,
        hidden: !editable,
        confirm: '确认删除该采购申请？',
        onClick: r => handleDelete(r.id),
      },
    ];
  };

  return (
    <div>
      <PageHeader
        title="采购申请"
        count={total}
        description="管理所有采购申请，从立项、审批、招标到合同签订的全流程"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/tendering/requests/new')}
          >
            发起采购申请
          </Button>
        }
      />

      {/* 关键状态卡：一目了然 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <KpiCard
            title="待审批"
            value={stats.applying}
            tone="warning"
            icon={<ClockCircleOutlined />}
            hint="需要尽快处理"
            onClick={() => setFilters(f => ({ ...f, status: 'applying' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已定标"
            value={stats.awarded}
            tone="cyan"
            icon={<TrophyOutlined />}
            hint="等待签订合同"
            onClick={() => setFilters(f => ({ ...f, status: 'awarded' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已完成"
            value={stats.completed}
            tone="success"
            icon={<CheckCircleOutlined />}
            hint="本周期完成"
            onClick={() => setFilters(f => ({ ...f, status: 'completed' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="申请总数"
            value={total}
            tone="primary"
            icon={<AuditOutlined />}
            hint="全部申请记录"
          />
        </Col>
      </Row>

      <FilterBar
        fields={[
          {
            name: 'keyword',
            type: 'input',
            placeholder: '搜索标题 / 编号 / 申请人',
            width: 240,
          },
          {
            name: 'category',
            type: 'select',
            placeholder: '流程分类',
            options: CATEGORY_OPTIONS,
            width: 140,
          },
          {
            name: 'status',
            type: 'select',
            placeholder: '状态',
            options: STATUS_OPTIONS,
            width: 140,
          },
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
          total,
          showSizeChanger: true,
          showTotal: t => `共 ${t} 条`,
          onChange: (page, pageSize) => setPagination({ page, pageSize }),
        }}
        mobileTitleKey="title"
        mobileStatusRender={r => (
          <StatusTag status={r.status} statusMap={REQUEST_STATUS} size="small" />
        )}
        mobileFields={mobileFields}
        mobileActions={mobileActions}
      />
    </div>
  );
}
