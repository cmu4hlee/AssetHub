import React, { useState, useEffect, useCallback } from 'react';
import { message, Row, Col } from 'antd';
import {
  TrophyOutlined, EyeOutlined, FileTextOutlined, CheckCircleOutlined,
  ClockCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { tenderingAPI } from '../../api/domains/tendering';
import { BID_STATUS, TENDER_STATUS, formatDateTime } from '../../constants/tendering';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import {
  PageHeader, FilterBar, StatusTag, KpiCard, ResponsiveTable,
} from '../../components/tendering';

const STATUS_OPTIONS = Object.entries(BID_STATUS).map(([k, v]) => ({ value: k, label: v.text }));

export default function BidOverview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [allBids, setAllBids] = useState([]);
  const [stats, setStats] = useState({ total: 0, submitted: 0, won: 0, lost: 0, withdrawn: 0 });
  const [filters, setFilters] = useState({ keyword: '', status: '' });
  const debounced = useDebouncedValue(filters.keyword, 300);

  // 复合 key：投标记录的 (tender_id, id) 唯一组合，抽出到 const 避免内联函数重复创建
  const bidRowKey = useCallback(r => `${r.tender_id}-${r.id}`, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.listProjects({ pageSize: 200 });
      const list = Array.isArray(res?.data) ? res.data : [];
      const bidMap = {};
      await Promise.all(list.map(async t => {
        try {
          const b = await tenderingAPI.listBids(t.id, { pageSize: 200 });
          bidMap[t.id] = Array.isArray(b?.data) ? b.data : [];
        } catch (e) {
          bidMap[t.id] = [];
        }
      }));
      const bids = list.flatMap(t => (bidMap[t.id] || []).map(b => ({
        ...b,
        tender_title: t.title,
        tender_code: t.tender_code,
        tender_status: t.status,
      })));
      setAllBids(bids);
      const counts = bids.reduce((acc, b) => {
        if (b.status) acc[b.status] = (acc[b.status] || 0) + 1;
        return acc;
      }, {});
      setStats({
        total: bids.length,
        submitted: counts.submitted || 0,
        won: counts.won || 0,
        lost: counts.lost || 0,
        withdrawn: counts.withdrawn || 0,
      });
    } catch (err) {
      message.error(err.response?.data?.message || '加载投标概览失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = allBids.filter(b => {
    if (filters.status && b.status !== filters.status) return false;
    if (debounced) {
      const k = debounced.toLowerCase();
      const hit = (b.supplier_name || '').toLowerCase().includes(k) ||
                  (b.tender_title || '').toLowerCase().includes(k);
      if (!hit) return false;
    }
    return true;
  });

  const handleReset = () => setFilters({ keyword: '', status: '' });

  const columns = [
    {
      title: '招标项目',
      dataIndex: 'tender_title',
      width: 240,
      ellipsis: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/tendering/projects/${record.tender_id}`)}>{text || '-'}</a>
      ),
    },
    { title: '招标编号', dataIndex: 'tender_code', width: 200, ellipsis: true },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      width: 200,
      ellipsis: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/tendering/bids/${record.id}`)}>{text || '-'}</a>
      ),
    },
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
      title: '项目状态',
      dataIndex: 'tender_status',
      width: 110,
      render: v => <StatusTag status={v} statusMap={TENDER_STATUS} size="small" />,
    },
    {
      title: '投标状态',
      dataIndex: 'status',
      width: 110,
      render: v => <StatusTag status={v} statusMap={BID_STATUS} />,
    },
    { title: '提交时间', dataIndex: 'submitted_at', width: 160, render: v => formatDateTime(v) },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <a onClick={() => navigate(`/tendering/bids/${record.id}`)}>
          <EyeOutlined /> 详情
        </a>
      ),
    },
  ];

  const mobileFields = [
    { label: '招标编号', key: 'tender_code' },
    { label: '项目状态', key: 'tender_status', render: v => <StatusTag status={v} statusMap={TENDER_STATUS} size="small" /> },
    { label: '供应商', key: 'supplier_name' },
    {
      label: '报价',
      key: 'bid_amount',
      span: 2,
      render: (v, r) => <span style={{ color: '#fa8c16' }}>
        {v != null ? `${r.bid_currency || 'CNY'} ${Number(v).toLocaleString()}` : '-'}
      </span>,
    },
    { label: '提交时间', key: 'submitted_at', render: formatDateTime },
  ];

  const mobileActions = row => [
    {
      key: 'view', text: '详情', icon: <EyeOutlined />, type: 'primary',
      onClick: r => navigate(`/tendering/bids/${r.id}`),
    },
    {
      key: 'project', text: '进入项目', icon: <FileTextOutlined />,
      onClick: r => navigate(`/tendering/projects/${r.tender_id}`),
    },
  ];

  return (
    <div>
      <PageHeader
        title="投标概览"
        count={stats.total}
        description="汇总展示所有招标项目的投标情况，便于跨项目监控"
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <KpiCard
            title="投标总数"
            value={stats.total}
            tone="primary"
            icon={<FileTextOutlined />}
            hint="所有项目的投标"
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已提交"
            value={stats.submitted}
            tone="default"
            icon={<ClockCircleOutlined />}
            hint="等待评标/定标"
            onClick={() => setFilters(f => ({ ...f, status: 'submitted' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已中标"
            value={stats.won}
            tone="success"
            icon={<CheckCircleOutlined />}
            hint="完成定标"
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
      </Row>

      <FilterBar
        fields={[
          { name: 'keyword', type: 'input', placeholder: '搜索项目/供应商', width: 260 },
          { name: 'status', type: 'select', placeholder: '投标状态', options: STATUS_OPTIONS, width: 140 },
        ]}
        values={filters}
        onChange={setFilters}
        onSearch={() => null}
        onReset={handleReset}
        searchLoading={loading}
      />

      <ResponsiveTable
        dataSource={filtered}
        columns={columns}
        loading={loading}
        rowKey={bidRowKey}
        scroll={{ x: 1300 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
        mobileTitleKey="tender_title"
        mobileStatusRender={r => <StatusTag status={r.status} statusMap={BID_STATUS} size="small" />}
        mobileFields={mobileFields}
        mobileActions={mobileActions}
      />
    </div>
  );
}
