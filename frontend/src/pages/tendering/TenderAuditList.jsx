import React, { useState, useEffect, useCallback } from 'react';
import { Tag } from 'antd';
import { AuditOutlined, PlusCircleOutlined, SwapOutlined } from '@ant-design/icons';
import { tenderingAPI } from '../../api/domains/tendering';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { formatDateTime } from '../../constants/tendering';
import {
  PageHeader, FilterBar, StatusTag, KpiCard, ResponsiveTable,
} from '../../components/tendering';

const ENTITY_OPTIONS = [
  { value: 'tender_projects',           label: '招标项目',   color: 'blue' },
  { value: 'tender_contracts',          label: '合同',       color: 'cyan' },
  { value: 'tender_invoices',           label: '发票',       color: 'green' },
  { value: 'tender_payment_milestones', label: '付款里程碑', color: 'gold' },
  { value: 'tender_payments',           label: '付款单',     color: 'lime' },
  { value: 'tender_acceptances',        label: '验收单',     color: 'geekblue' },
  { value: 'tender_suppliers',          label: '供应商',     color: 'purple' },
  { value: 'tender_bids',               label: '投标',       color: 'magenta' },
];

const ENTITY_LABELS = Object.fromEntries(ENTITY_OPTIONS.map(o => [o.value, o.label]));

const ACTION_OPTIONS = [
  { value: 'create',        label: '创建',        color: 'green', icon: <PlusCircleOutlined /> },
  { value: 'status_change', label: '状态变更',    color: 'blue',  icon: <SwapOutlined /> },
];

const ACTION_LABELS = Object.fromEntries(ACTION_OPTIONS.map(o => [o.value, o]));

export default function TenderAuditList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ create: 0, status_change: 0, today: 0 });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [filters, setFilters] = useState({ keyword: '', entity_type: '', action: '' });
  const debouncedKeyword = useDebouncedValue(filters.keyword, 300);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.listAuditLogs({
        page: pagination.page,
        pageSize: pagination.pageSize,
        entity_type: filters.entity_type,
        action: filters.action,
        keyword: debouncedKeyword,
      });
      const arr = Array.isArray(res?.data) ? res.data : [];
      setData(arr);
      setTotal(Number(res?.pagination?.total ?? arr.length));
      // 简单统计
      const counts = arr.reduce((acc, r) => {
        if (r.action) acc[r.action] = (acc[r.action] || 0) + 1;
        if (r.occurred_at && r.occurred_at.startsWith(new Date().toISOString().slice(0, 10))) {
          acc.today = (acc.today || 0) + 1;
        }
        return acc;
      }, {});
      setStats({
        create: counts.create || 0,
        status_change: counts.status_change || 0,
        today: counts.today || 0,
      });
    } catch (_) {
      // 静默
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters.entity_type, filters.action, debouncedKeyword]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleReset = () => {
    setFilters({ keyword: '', entity_type: '', action: '' });
    setPagination({ page: 1, pageSize: 20 });
  };

  const columns = [
    { title: '时间', dataIndex: 'occurred_at', width: 170, fixed: 'left', render: v => formatDateTime(v) },
    {
      title: '对象',
      dataIndex: 'entity_type',
      width: 150,
      render: v => <StatusTag status={v} statusMap={ENTITY_LABELS} size="small" bordered />,
    },
    { title: '对象ID', dataIndex: 'entity_id', width: 100 },
    {
      title: '动作',
      dataIndex: 'action',
      width: 140,
      render: v => {
        const info = ACTION_LABELS[v] || { label: v, color: 'default' };
        return (
          <span>
            <Tag color={info.color} style={{ margin: 0 }}>
              {info.icon ? <span style={{ marginRight: 4 }}>{info.icon}</span> : null}
              {info.label}
            </Tag>
          </span>
        );
      },
    },
    { title: '原状态', dataIndex: 'from_status', width: 120, render: v => v ? <Tag>{v}</Tag> : '-' },
    {
      title: '新状态',
      dataIndex: 'to_status',
      width: 120,
      render: v => v ? <StatusTag status={v} statusMap={{ 1: { text: v, color: 'cyan' } }} size="small" /> : '-',
    },
    { title: '操作人', dataIndex: 'operator_name', width: 120, render: v => v || '-' },
    {
      title: '详情',
      dataIndex: 'payload',
      ellipsis: true,
      render: v => v ? (() => {
        try { return JSON.stringify(JSON.parse(v)); }
        catch (_) { return String(v).slice(0, 80); }
      })() : '-',
    },
  ];

  const mobileFields = [
    { label: '对象', key: 'entity_type', render: v => <StatusTag status={v} statusMap={ENTITY_LABELS} size="small" bordered /> },
    { label: '动作', key: 'action', render: v => {
      const info = ACTION_LABELS[v] || { label: v, color: 'default' };
      return <Tag color={info.color}>{info.label}</Tag>;
    } },
    { label: '操作人', key: 'operator_name' },
    { label: '时间', key: 'occurred_at', render: formatDateTime },
  ];

  return (
    <div>
      <PageHeader
        title="审计日志"
        count={total}
        description="记录招标采购全流程的关键操作，便于审计和追溯"
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <KpiCard
            title="总操作数"
            value={total}
            tone="primary"
            icon={<AuditOutlined />}
            hint="所有审计记录"
          />
        </Col>
        <Col xs={12} sm={8}>
          <KpiCard
            title="创建操作"
            value={stats.create}
            tone="success"
            icon={<PlusCircleOutlined />}
            hint="本批记录中"
            onClick={() => setFilters(f => ({ ...f, action: 'create' }))}
          />
        </Col>
        <Col xs={12} sm={8}>
          <KpiCard
            title="状态变更"
            value={stats.status_change}
            tone="cyan"
            icon={<SwapOutlined />}
            hint="本批记录中"
            onClick={() => setFilters(f => ({ ...f, action: 'status_change' }))}
          />
        </Col>
      </Row>

      <FilterBar
        fields={[
          { name: 'keyword', type: 'input', placeholder: '搜索操作人/对象ID', width: 240 },
          { name: 'entity_type', type: 'select', placeholder: '对象类型', options: ENTITY_OPTIONS.map(o => ({ value: o.value, label: o.label })), width: 160 },
          { name: 'action', type: 'select', placeholder: '动作', options: ACTION_OPTIONS.map(o => ({ value: o.value, label: o.label })), width: 140 },
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
        mobileTitleKey="entity_type"
        mobileStatusRender={r => {
          const info = ACTION_LABELS[r.action] || { label: r.action, color: 'default' };
          return <Tag color={info.color}>{info.label}</Tag>;
        }}
        mobileFields={mobileFields}
      />
    </div>
  );
}

import { Row, Col } from 'antd';
