import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import { Button, Space, Popconfirm, message, Row, Col, Modal } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, FileTextOutlined,
  BarChartOutlined, ClockCircleOutlined, CheckCircleOutlined,
  RiseOutlined, FileProtectOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  TENDER_STATUS,
  TENDER_TYPE,
  TENDER_METHOD,
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

const TYPE_OPTIONS = Object.entries(TENDER_TYPE).map(([k, v]) => ({ value: k, label: v.text }));
const METHOD_OPTIONS = Object.entries(TENDER_METHOD).map(([k, v]) => ({ value: k, label: v.text }));
const STATUS_OPTIONS = Object.entries(TENDER_STATUS).map(([k, v]) => ({ value: k, label: v.text }));

// 可操作的状态
const isEditable = status => status === 'draft' || status === 'cancelled';
const isPublishable = status => status === 'draft';

export default function XXX() {
  const canDelete = useCan('tender', 'delete');
  const canEdit = useCan('tender', 'edit');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ published: 0, bidding: 0, evaluating: 0, awarded: 0 });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [filters, setFilters] = useState({ keyword: '', tender_type: '', status: '' });
  const debouncedKeyword = useDebouncedValue(filters.keyword, 300);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.listProjects({
        page: pagination.page,
        pageSize: pagination.pageSize,
        tender_type: filters.tender_type,
        status: filters.status,
        keyword: debouncedKeyword,
      });
      const dataArr = Array.isArray(res?.data) ? res.data : [];
      const totalVal = Number(res?.pagination?.total ?? dataArr.length);
      setData(dataArr);
      setTotal(totalVal);
      // 简单统计
      const counts = dataArr.reduce((acc, r) => {
        if (r.status) acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      setStats({
        published: counts.published || 0,
        bidding: counts.bidding || 0,
        evaluating: counts.evaluating || 0,
        awarded: counts.awarded || 0,
      });
    } catch (err) {
      message.error(err.response?.data?.message || '获取招标项目列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters.tender_type, filters.status, debouncedKeyword]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async id => {
    try {
      await tenderingAPI.deleteProject(id);
      message.success('删除成功');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await tenderingAPI.changeProjectStatus(id, status);
      message.success('状态更新成功');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '状态更新失败');
    }
  };

  const confirmPublish = id => {
    Modal.confirm({
      title: '确认发布该招标项目？',
      content: '发布后供应商可见并可以参与投标',
      okText: '发布',
      onOk: () => handleStatusChange(id, 'published'),
    });
  };

  const handleReset = () => {
    setFilters({ keyword: '', tender_type: '', status: '' });
    setPagination({ page: 1, pageSize: 20 });
  };

  const columns = [
    {
      title: '招标编号',
      dataIndex: 'tender_code',
      width: 200,
      fixed: 'left',
      ellipsis: true,
    },
    {
      title: '项目名称',
      dataIndex: 'title',
      ellipsis: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/tendering/projects/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '招标类型',
      dataIndex: 'tender_type',
      width: 110,
      render: v => <StatusTag status={v} statusMap={TENDER_TYPE} size="small" bordered />,
    },
    {
      title: '招标方式',
      dataIndex: 'tender_method',
      width: 110,
      render: v => <StatusTag status={v} statusMap={TENDER_METHOD} size="small" />,
    },
    { title: '需求部门', dataIndex: 'department', width: 120, render: v => v || '-' },
    {
      title: '预算金额',
      dataIndex: 'budget_amount',
      width: 130,
      align: 'right',
      render: v => <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: v => <StatusTag status={v} statusMap={TENDER_STATUS} />,
    },
    {
      title: '投标截止',
      dataIndex: 'deadline',
      width: 160,
      render: v => formatDateTime(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_, record) => {
        const editable = isEditable(record.status);
        const publishable = isPublishable(record.status);
        return (
          <Space size="small" wrap>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/tendering/projects/${record.id}`)}
            >
              详情
            </Button>
            {publishable ? (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/tendering/projects/edit/${record.id}`)}
              >
                编辑
              </Button>
            ) : null}
            {publishable ? (
              <Button type="link" size="small" onClick={() => confirmPublish(record.id)}>
                发布
              </Button>
            ) : null}
            {editable ? (
              <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
                <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
                  删除
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        );
      },
    },
  ];

  const mobileFields = [
    { label: '招标编号', key: 'tender_code', span: 2 },
    {
      label: '类型',
      key: 'tender_type',
      render: v => <StatusTag status={v} statusMap={TENDER_TYPE} size="small" bordered />,
    },
    {
      label: '方式',
      key: 'tender_method',
      render: v => <StatusTag status={v} statusMap={TENDER_METHOD} size="small" />,
    },
    {
      label: '预算',
      key: 'budget_amount',
      render: v => <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    { label: '需求部门', key: 'department' },
    { label: '投标截止', key: 'deadline', render: formatDateTime },
  ];

  const mobileActions = row => {
    const editable = isEditable(row.status);
    const publishable = isPublishable(row.status);
    return [
      {
        key: 'view',
        text: '详情',
        icon: <EyeOutlined />,
        type: 'primary',
        onClick: r => navigate(`/tendering/projects/${r.id}`),
      },
      {
        key: 'doc',
        text: '招标文件',
        icon: <FileTextOutlined />,
        onClick: r => navigate(`/tendering/projects/${r.id}/document`),
      },
      {
        key: 'edit',
        text: '编辑',
        icon: <EditOutlined />,
        hidden: !publishable,
        onClick: r => navigate(`/tendering/projects/edit/${r.id}`),
      },
      {
        key: 'delete',
        text: '删除',
        icon: <DeleteOutlined />,
        danger: true,
        hidden: !editable,
        confirm: '确认删除该招标项目？',
        onClick: r => handleDelete(r.id),
      },
    ];
  };

  return (
    <div>
      <PageHeader
        title="招标项目"
        count={total}
        description="管理所有招标项目，从立项、发布、投标、评标到定标的全流程"
        extra={
          <Space>
            <Button
              icon={<BarChartOutlined />}
              onClick={() => navigate('/tendering/dashboard')}
            >
              统计概览
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/tendering/projects/new')}
            >
              新建招标项目
            </Button>
          </Space>
        }
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已发布"
            value={stats.published}
            tone="primary"
            icon={<ClockCircleOutlined />}
            hint="等待进入投标期"
            onClick={() => setFilters(f => ({ ...f, status: 'published' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="投标中"
            value={stats.bidding}
            tone="cyan"
            icon={<RiseOutlined />}
            hint="正在接收投标"
            onClick={() => setFilters(f => ({ ...f, status: 'bidding' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="评标中"
            value={stats.evaluating}
            tone="warning"
            icon={<CheckCircleOutlined />}
            hint="正在评标打分"
            onClick={() => setFilters(f => ({ ...f, status: 'evaluating' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已定标"
            value={stats.awarded}
            tone="success"
            icon={<FileProtectOutlined />}
            hint="可创建合同"
            onClick={() => setFilters(f => ({ ...f, status: 'awarded' }))}
          />
        </Col>
      </Row>

      <FilterBar
        fields={[
          { name: 'keyword', type: 'input', placeholder: '搜索编号/名称/资产', width: 240 },
          { name: 'tender_type', type: 'select', placeholder: '招标类型', options: TYPE_OPTIONS, width: 140 },
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
        scroll={{ x: 1400 }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total,
          showSizeChanger: true,
          showTotal: t => `共 ${t} 条`,
          onChange: (page, pageSize) => setPagination({ page, pageSize }),
        }}
        mobileTitleKey="title"
        mobileStatusRender={r => <StatusTag status={r.status} statusMap={TENDER_STATUS} size="small" />}
        mobileFields={mobileFields}
        mobileActions={mobileActions}
      />
    </div>
  );
}
