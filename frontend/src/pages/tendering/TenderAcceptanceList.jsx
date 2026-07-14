import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import { Button, Space, Popconfirm, message, Row, Col, Modal, Input } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  CheckCircleOutlined, CloseCircleOutlined, InboxOutlined,
  ClockCircleOutlined, ToolOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  ACCEPTANCE_STATUS,
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

const STATUS_OPTIONS = Object.entries(ACCEPTANCE_STATUS).map(([k, v]) => ({ value: k, label: v.text }));

// 状态 → 可执行操作
const ACTIONS = {
  pending: [
    { name: 'accept', label: '通过', type: 'primary', icon: <CheckCircleOutlined /> },
    { name: 'reject', label: '驳回', danger: true, icon: <CloseCircleOutlined />, needReason: true },
  ],
  accepted: [
    { name: 'close', label: '关闭', icon: <InboxOutlined /> },
  ],
  rejected: [
    { name: 'reprocess', label: '重新提交', type: 'primary' },
  ],
};

const FN_MAP = {
  accept: tenderingAPI.acceptAcceptance,
  reject: tenderingAPI.rejectAcceptance,
  reprocess: tenderingAPI.reprocessAcceptance,
  close: tenderingAPI.closeAcceptance,
};

export default function XXX() {
  const canDelete = useCan('tender', 'delete');
  const canEdit = useCan('tender', 'edit');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ pending: 0, accepted: 0, rejected: 0 });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [filters, setFilters] = useState({ keyword: '', status: '' });
  const debounced = useDebouncedValue(filters.keyword, 300);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.listAcceptances({
        page: pagination.page,
        pageSize: pagination.pageSize,
        status: filters.status,
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
        pending: counts.pending || 0,
        accepted: counts.accepted || 0,
        rejected: counts.rejected || 0,
      });
    } catch (e) {
      message.error(e.response?.data?.message || '获取验收列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters.status, debounced]);

  useEffect(() => { fetch(); }, [fetch]);

  const onAction = async (name, id) => {
    const cfg = (ACTIONS[getStatus(id)] || []).find(a => a.name === name);
    if (cfg?.needReason) {
      promptReason(reason => runAction(name, id, reason));
      return;
    }
    runAction(name, id);
  };

  const getStatus = id => data.find(d => d.id === id)?.status;

  const runAction = async (name, id, reason) => {
    const fn = FN_MAP[name];
    if (!fn) return;
    try {
      await fn(id, reason);
      message.success('操作成功');
      fetch();
    } catch (e) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const promptReason = onConfirm => {
    let reason = '';
    Modal.confirm({
      title: '请填写驳回理由',
      content: (
        <Input.TextArea
          rows={3}
          maxLength={500}
          showCount
          onChange={e => { reason = e.target.value; }}
        />
      ),
      okText: '确认驳回',
      okButtonProps: { danger: true },
      onOk: () => onConfirm(reason),
    });
  };

  const onDelete = async id => {
    try {
      await tenderingAPI.deleteAcceptance(id);
      message.success('已删除');
      fetch();
    } catch (e) {
      message.error(e.response?.data?.message || '删除失败');
    }
  };

  const handleReset = () => {
    setFilters({ keyword: '', status: '' });
    setPagination({ page: 1, pageSize: 20 });
  };

  const columns = [
    { title: '验收单号', dataIndex: 'acceptance_code', width: 200, fixed: 'left', ellipsis: true },
    { title: '合同', dataIndex: 'contract_code', width: 160, ellipsis: true, render: v => v || '-' },
    { title: '招标项目', dataIndex: 'tender_code', width: 160, ellipsis: true, render: v => v || '-' },
    { title: '资产', dataIndex: 'asset_code', width: 140, ellipsis: true, render: v => v || '-' },
    { title: '计划日期', dataIndex: 'scheduled_date', width: 120, render: v => v || '-' },
    {
      title: '合格数',
      dataIndex: 'accepted_quantity',
      width: 90,
      align: 'right',
      render: v => v ?? 0,
    },
    {
      title: '不合格数',
      dataIndex: 'rejected_quantity',
      width: 100,
      align: 'right',
      render: v => v ? <span style={{ color: '#ff4d4f' }}>{v}</span> : 0,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: v => <StatusTag status={v} statusMap={ACCEPTANCE_STATUS} />,
    },
    { title: '实际通过时间', dataIndex: 'accepted_at', width: 160, render: v => formatDateTime(v) },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right',
      render: (_, row) => {
        const next = ACTIONS[row.status] || [];
        return (
          <Space size="small" wrap>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/tendering/acceptances/${row.id}`)}
            >
              详情
            </Button>
            {next.map(a => (
              <Button
                key={a.name}
                size="small"
                danger={a.danger}
                type={a.type || 'link'}
                onClick={() => onAction(a.name, row.id)}
              >
                {a.label}
              </Button>
            ))}
            {row.status === 'pending' ? (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/tendering/acceptances/${row.id}/edit`)}
                >
                  编辑
                </Button>
                <Popconfirm title="删除验收单？" onConfirm={() => onDelete(row.id)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
                    删除
                  </Button>
                </Popconfirm>
              </>
            ) : null}
          </Space>
        );
      },
    },
  ];

  const mobileFields = [
    { label: '单号', key: 'acceptance_code', span: 2 },
    { label: '合同', key: 'contract_code' },
    { label: '计划日期', key: 'scheduled_date' },
    { label: '合格', key: 'accepted_quantity', render: v => v ?? 0 },
    { label: '不合格', key: 'rejected_quantity', render: v => v || 0 },
    { label: '通过时间', key: 'accepted_at', render: formatDateTime },
  ];

  const mobileActions = row => {
    const next = ACTIONS[row.status] || [];
    return [
      {
        key: 'view',
        text: '详情',
        icon: <EyeOutlined />,
        type: 'primary',
        onClick: r => navigate(`/tendering/acceptances/${r.id}`),
      },
      ...next.map(a => ({
        key: a.name,
        text: a.label,
        icon: a.icon,
        type: a.type,
        danger: a.danger,
        onClick: r => onAction(a.name, r.id),
      })),
      {
        key: 'edit',
        text: '编辑',
        icon: <EditOutlined />,
        hidden: row.status !== 'pending',
        onClick: r => navigate(`/tendering/acceptances/${r.id}/edit`),
      },
      {
        key: 'delete',
        text: '删除',
        icon: <DeleteOutlined />,
        danger: true,
        hidden: row.status !== 'pending',
        confirm: '删除验收单？',
        onClick: r => onDelete(r.id),
      },
    ];
  };

  return (
    <div>
      <PageHeader
        title="验收管理"
        count={total}
        description="管理合同履约后的验收单据，记录合格/不合格情况"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tendering/acceptances/new')}>
            新增验收单
          </Button>
        }
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <KpiCard
            title="待验收"
            value={stats.pending}
            tone="warning"
            icon={<ClockCircleOutlined />}
            hint="等待验收处理"
            onClick={() => setFilters(f => ({ ...f, status: 'pending' }))}
          />
        </Col>
        <Col xs={12} sm={8}>
          <KpiCard
            title="已通过"
            value={stats.accepted}
            tone="success"
            icon={<CheckCircleOutlined />}
            hint="验收合格的批次"
            onClick={() => setFilters(f => ({ ...f, status: 'accepted' }))}
          />
        </Col>
        <Col xs={12} sm={8}>
          <KpiCard
            title="已驳回"
            value={stats.rejected}
            tone="danger"
            icon={<CloseCircleOutlined />}
            hint="需要返工或重新提交"
            onClick={() => setFilters(f => ({ ...f, status: 'rejected' }))}
          />
        </Col>
      </Row>

      <FilterBar
        fields={[
          { name: 'keyword', type: 'input', placeholder: '搜索单号/合同/招标', width: 240 },
          { name: 'status', type: 'select', placeholder: '验收状态', options: STATUS_OPTIONS, width: 140 },
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
        mobileTitleKey="acceptance_code"
        mobileStatusRender={r => <StatusTag status={r.status} statusMap={ACCEPTANCE_STATUS} size="small" />}
        mobileFields={mobileFields}
        mobileActions={mobileActions}
      />
    </div>
  );
}
