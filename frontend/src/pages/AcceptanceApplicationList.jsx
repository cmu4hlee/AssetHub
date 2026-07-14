import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Tag,
  Modal,
  message,
  Space,
  Input,
  Select,
  Popconfirm,
  Tooltip,
} from 'antd';

import {
  PlusOutlined,
  EditOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  SendOutlined,
  UndoOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '../utils/api';
import { useIsMobile, useCan } from '../hooks';

const { Search } = Input;
const { Option } = Select;

const statusColorMap = {
  草稿: 'gray',
  待审批: 'orange',
  审批中: 'blue',
  已批准: 'green',
  已拒绝: 'red',
  已撤回: 'default',
  已完成: 'cyan',
};

const priorityColorMap = {
  低: 'default',
  中: 'blue',
  高: 'red',
};

const AcceptanceApplicationList = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const canDelete = useCan('application', 'delete');
  const canApprove = useCan('application', 'approve');
  const canEdit = useCan('application', 'edit');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        keyword: keyword.trim(),
      };
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const resp = await api.get('/acceptance-management/applications', { params });
      if (resp.success) {
        const data = resp.data;
        const list = Array.isArray(data) ? data : data?.data || [];
        setRecords(list);
        setPagination(prev => ({
          ...prev,
          total: resp.pagination?.total || data?.pagination?.total || list.length,
        }));
      } else {
        message.error(resp.message || '获取申请列表失败');
      }
    } catch (error) {
      console.error('获取申请列表失败:', error);
      message.error('获取申请列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, keyword, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleSearch = (value) => {
    setKeyword(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleAction = async (id, action, actionLabel) => {
    try {
      const resp = await api.post(`/acceptance-management/applications/${id}/${action}`);
      if (resp.success) {
        message.success(`${actionLabel}成功`);
        fetchRecords();
      } else {
        message.error(resp.message || `${actionLabel}失败`);
      }
    } catch (error) {
      console.error(`${actionLabel}失败:`, error);
      message.error(`${actionLabel}失败`);
    }
  };

  const handleViewDetail = (record) => {
    setDetailRecord(record);
    setDetailOpen(true);
  };

  const handleEdit = (record) => {
    navigate(`/acceptance-applications/edit/${record.id}`);
  };

  const handleCreate = () => {
    navigate('/acceptance-applications/create');
  };

  const columns = [
    {
      title: '申请编号',
      dataIndex: 'application_code',
      key: 'application_code',
      width: 140,
      render: text => text || '-',
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 160,
      ellipsis: true,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 140,
      ellipsis: true,
    },
    {
      title: '申请科室',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      ellipsis: true,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: text => <Tag color={priorityColorMap[text] || 'default'}>{text || '-'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: text => <Tag color={statusColorMap[text] || 'default'}>{text || '-'}</Tag>,
    },
    {
      title: '计划验收日期',
      dataIndex: 'planned_acceptance_date',
      key: 'planned_acceptance_date',
      width: 130,
      render: date => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '申请人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: date => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="查看详情">
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)} />
          </Tooltip>
          {record.status === '草稿' && (
            <Tooltip title="编辑">
              <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
            </Tooltip>
          )}
          {record.status === '草稿' && (
            <Popconfirm title="确认提交该申请？" onConfirm={() => handleAction(record.id, 'submit', '提交')} disabled={!canEdit}>
              <Button size="small" type="primary" ghost icon={<SendOutlined />} disabled={!canEdit}>提交</Button>
            </Popconfirm>
          )}
          {(record.status === '待审批' || record.status === '审批中') && (
            <Popconfirm title="确认审批通过？" onConfirm={() => handleAction(record.id, 'approve', '审批通过')} disabled={!canApprove}>
              <Button size="small" type="primary" icon={<CheckOutlined />} disabled={!canApprove}>通过</Button>
            </Popconfirm>
          )}
          {(record.status === '待审批' || record.status === '审批中') && (
            <Popconfirm title="确认拒绝该申请？" onConfirm={() => handleAction(record.id, 'reject', '拒绝')} disabled={!canApprove}>
              <Button size="small" danger icon={<CloseOutlined />} disabled={!canApprove}>拒绝</Button>
            </Popconfirm>
          )}
          {record.status === '待审批' && (
            <Popconfirm title="确认撤回该申请？" onConfirm={() => handleAction(record.id, 'withdraw', '撤回')} disabled={!canEdit}>
              <Button size="small" icon={<UndoOutlined />} disabled={!canEdit}>撤回</Button>
            </Popconfirm>
          )}
          {record.status === '已批准' && (
            <Popconfirm title="确认完成该验收？" onConfirm={() => handleAction(record.id, 'complete', '完成')}>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}>完成</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const detailRows = detailRecord
    ? [
        { label: '申请编号', value: detailRecord.application_code },
        { label: '标题', value: detailRecord.title },
        { label: '资产编号', value: detailRecord.asset_code },
        { label: '资产名称', value: detailRecord.asset_name },
        { label: '供应商', value: detailRecord.supplier },
        { label: '申请科室', value: detailRecord.department },
        { label: '职能部门', value: detailRecord.functional_department },
        { label: '优先级', value: <Tag color={priorityColorMap[detailRecord.priority]}>{detailRecord.priority}</Tag> },
        { label: '状态', value: <Tag color={statusColorMap[detailRecord.status]}>{detailRecord.status}</Tag> },
        { label: '计划验收日期', value: detailRecord.planned_acceptance_date ? dayjs(detailRecord.planned_acceptance_date).format('YYYY-MM-DD') : '-' },
        { label: '申请人', value: detailRecord.applicant_name || '-' },
        { label: '创建时间', value: detailRecord.created_at ? dayjs(detailRecord.created_at).format('YYYY-MM-DD HH:mm') : '-' },
        { label: '申请说明', value: detailRecord.description || detailRecord.remark || '-' },
      ]
    : [];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>验收申请列表</h2>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增申请
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchRecords}>刷新</Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Search
          placeholder="搜索申请编号/标题/资产名称..."
          allowClear
          onSearch={handleSearch}
          style={{ width: 320 }}
        />
        <Select
          placeholder="状态筛选"
          allowClear
          style={{ width: 130 }}
          value={statusFilter || undefined}
          onChange={(val) => {
            setStatusFilter(val || '');
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
        >
          {Object.keys(statusColorMap).map(s => (
            <Option key={s} value={s}>{s}</Option>
          ))}
        </Select>
        <Select
          placeholder="优先级筛选"
          allowClear
          style={{ width: 120 }}
          value={priorityFilter || undefined}
          onChange={(val) => {
            setPriorityFilter(val || '');
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
        >
          {Object.keys(priorityColorMap).map(p => (
            <Option key={p} value={p}>{p}</Option>
          ))}
        </Select>
      </div>

      <div className="hide-on-mobile">
        <Table
          dataSource={records}
          columns={columns}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1500 }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: total => `共 ${total} 条记录`,
            onChange: (page, pageSize) => setPagination(prev => ({ ...prev, page, pageSize })),
          }}
        />
      </div>
      <div className="mobile-table-cards show-on-mobile">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
        ) : Array.isArray(records) && records.length > 0 ? (
          records.map(record => (
            <div key={record.id} className="mobile-card-item">
              <div className="mobile-card-header">
                <span className="mobile-card-title">{record.application_code || '-'}</span>
                <Tag color={statusColorMap[record.status] || 'default'}>{record.status}</Tag>
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-field">
                  <span className="mobile-card-label">资产名称</span>
                  <span className="mobile-card-value">{record.asset_name || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">资产编码</span>
                  <span className="mobile-card-value">{record.asset_code || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">计划验收日期</span>
                  <span className="mobile-card-value">
                    {record.planned_acceptance_date ? dayjs(record.planned_acceptance_date).format('YYYY-MM-DD') : '-'}
                  </span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">申请人</span>
                  <span className="mobile-card-value">{record.applicant_name || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">优先级</span>
                  <span className="mobile-card-value">
                    <Tag color={record.priority === '高' ? 'red' : record.priority === '中' ? 'orange' : 'default'}>
                      {record.priority || '-'}
                    </Tag>
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
        )}
      </div>

      <Modal
        title="验收申请详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailOpen(false)}>关闭</Button>,
        ]}
        width={640}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
          {detailRows.map((row, idx) => (
            <div key={idx} style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', padding: '6px 0' }}>
              <span style={{ width: 90, color: '#888', flexShrink: 0 }}>{row.label}：</span>
              <span style={{ flex: 1, wordBreak: 'break-all' }}>{row.value ?? '-'}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default AcceptanceApplicationList;
