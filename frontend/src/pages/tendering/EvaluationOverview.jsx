import React, { useState, useEffect, useCallback } from 'react';
import { Empty, Row, Col } from 'antd';
import {
  StarOutlined, FileTextOutlined, CheckCircleOutlined, RiseOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  TENDER_STATUS, formatDateTime,
} from '../../constants/tendering';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import {
  PageHeader, FilterBar, StatusTag, KpiCard, ResponsiveTable,
} from '../../components/tendering';

const STATUS_OPTIONS = Object.entries(TENDER_STATUS).map(([k, v]) => ({ value: k, label: v.text }));

export default function EvaluationOverview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ tenders: 0, suppliers: 0, totalEvaluations: 0, recommend: 0 });
  const [filters, setFilters] = useState({ keyword: '', status: '' });
  const debounced = useDebouncedValue(filters.keyword, 300);

  const evaluationRowKey = useCallback(r => `${r.tender_id}-${r.supplier_id}`, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.listProjects({ pageSize: 200 });
      const list = Array.isArray(res?.data) ? res.data : [];
      const summary = {};
      await Promise.all(list.map(async t => {
        try {
          const r = await tenderingAPI.summarizeEvaluations(t.id);
          const arr = Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [];
          summary[t.id] = arr;
        } catch (e) {
          summary[t.id] = [];
        }
      }));
      const flat = [];
      list.forEach(t => {
        const arr = summary[t.id] || [];
        arr.forEach(s => flat.push({
          ...s,
          tender_id: t.id,
          tender_title: t.title,
          tender_code: t.tender_code,
          tender_status: t.status,
        }));
      });
      setRows(flat);
      // 统计
      const totalEval = flat.reduce((s, r) => s + (Number(r.evaluator_count) || 0), 0);
      const totalRec = flat.reduce((s, r) => s + (Number(r.recommend_count) || 0), 0);
      setStats({
        tenders: list.length,
        suppliers: new Set(flat.map(r => r.supplier_id)).size,
        totalEvaluations: totalEval,
        recommend: totalRec,
      });
    } catch (err) {
      // 静默
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = rows.filter(r => {
    if (filters.status && r.tender_status !== filters.status) return false;
    if (debounced) {
      const k = debounced.toLowerCase();
      const hit = (r.supplier_name || '').toLowerCase().includes(k) ||
                  (r.tender_title || '').toLowerCase().includes(k);
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
        <a onClick={() => navigate(`/tendering/projects/${record.tender_id}/evaluations`)}>
          {text || '-'}
        </a>
      ),
    },
    { title: '招标编号', dataIndex: 'tender_code', width: 200, ellipsis: true },
    { title: '供应商', dataIndex: 'supplier_name', width: 200, ellipsis: true },
    {
      title: '项目状态',
      dataIndex: 'tender_status',
      width: 110,
      render: v => <StatusTag status={v} statusMap={TENDER_STATUS} size="small" />,
    },
    { title: '评标人数', dataIndex: 'evaluator_count', width: 110, align: 'right' },
    {
      title: '平均总分',
      dataIndex: 'avg_score',
      width: 130,
      align: 'right',
      render: v => v != null
        ? <strong style={{ color: '#fa8c16' }}>{Number(v).toFixed(2)}</strong>
        : '-',
    },
    {
      title: '平均价格分',
      dataIndex: 'avg_price_score',
      width: 130,
      align: 'right',
      render: v => v != null ? Number(v).toFixed(2) : '-',
    },
    {
      title: '平均技术分',
      dataIndex: 'avg_tech_score',
      width: 130,
      align: 'right',
      render: v => v != null ? Number(v).toFixed(2) : '-',
    },
    {
      title: '推荐中标',
      dataIndex: 'recommend_count',
      width: 110,
      align: 'right',
      render: v => v > 0
        ? <StatusTag status="1" statusMap={{ 1: { text: v, color: 'success' } }} size="small" />
        : 0,
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      fixed: 'right',
      render: (_, r) => (
        <a onClick={() => navigate(`/tendering/projects/${r.tender_id}/evaluations`)}>
          <StarOutlined /> 进入评标
        </a>
      ),
    },
  ];

  const mobileFields = [
    { label: '招标编号', key: 'tender_code' },
    {
      label: '项目状态',
      key: 'tender_status',
      render: v => <StatusTag status={v} statusMap={TENDER_STATUS} size="small" />,
    },
    { label: '评标人数', key: 'evaluator_count' },
    {
      label: '平均总分',
      key: 'avg_score',
      span: 2,
      render: v => v != null ? <strong style={{ color: '#fa8c16' }}>{Number(v).toFixed(2)}</strong> : '-',
    },
    { label: '价格分', key: 'avg_price_score', render: v => v != null ? Number(v).toFixed(2) : '-' },
    { label: '技术分', key: 'avg_tech_score', render: v => v != null ? Number(v).toFixed(2) : '-' },
    { label: '推荐', key: 'recommend_count',
      render: v => v > 0
        ? <StatusTag status="1" statusMap={{ 1: { text: v, color: 'success' } }} size="small" />
        : 0 },
  ];

  const mobileActions = r => [
    {
      key: 'enter', text: '进入评标', icon: <StarOutlined />, type: 'primary',
      onClick: () => navigate(`/tendering/projects/${r.tender_id}/evaluations`),
    },
  ];

  return (
    <div>
      <PageHeader
        title="评标管理（全部项目）"
        count={stats.tenders}
        description={`汇总展示所有招标项目的评标数据，便于跨项目横向对比`}
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <KpiCard
            title="招标项目"
            value={stats.tenders}
            tone="primary"
            icon={<FileTextOutlined />}
            hint="全部项目数"
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="参与供应商"
            value={stats.suppliers}
            tone="cyan"
            icon={<TeamOutlined />}
            hint="去重后"
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="评标次数"
            value={stats.totalEvaluations}
            tone="success"
            icon={<RiseOutlined />}
            hint="累计评标记录"
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="推荐中标"
            value={stats.recommend}
            tone="warning"
            icon={<CheckCircleOutlined />}
            hint="累计推荐次数"
          />
        </Col>
      </Row>

      <FilterBar
        fields={[
          { name: 'keyword', type: 'input', placeholder: '搜索项目/供应商', width: 260 },
          { name: 'status', type: 'select', placeholder: '项目状态', options: STATUS_OPTIONS, width: 160 },
        ]}
        values={filters}
        onChange={setFilters}
        onSearch={() => null}
        onReset={handleReset}
        searchLoading={loading}
      />

      {rows.length === 0 && !loading ? (
        <Empty description="暂无评标数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <ResponsiveTable
          dataSource={filtered}
          columns={columns}
          loading={loading}
          rowKey={evaluationRowKey}
          scroll={{ x: 1500 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          mobileTitleKey="tender_title"
          mobileStatusRender={r => <StatusTag status={r.tender_status} statusMap={TENDER_STATUS} size="small" />}
          mobileFields={mobileFields}
          mobileActions={mobileActions}
        />
      )}
    </div>
  );
}
