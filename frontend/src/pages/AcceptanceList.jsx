import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Modal, message, Space, Input, Spin, Popconfirm, Select, Badge } from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, UndoOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { acceptanceAPI, acceptanceManagementAPI } from '../utils/api';
import AcceptanceForm from './AcceptanceForm';
import { useIsMobile, useCan } from '../hooks';

const { Search } = Input;
const { Option } = Select;

const statusColorMap = {
  待验收: 'blue',
  验收中: 'orange',
  已验收: 'green',
  验收不合格: 'red',
};

const AcceptanceList = () => {
  const isMobile = useIsMobile();
  const canDelete = useCan('acceptance', 'delete');
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const resp = await acceptanceManagementAPI.getStatisticsOverview();
      if (resp.success && resp.data?.records) {
        const records = resp.data.records;
        setStats({
          total: records.total || 0,
          待验收: records.statusDistribution?.find(s => s.status === '待验收')?.count || 0,
          验收中: records.statusDistribution?.find(s => s.status === '验收中')?.count || 0,
          已验收: records.statusDistribution?.find(s => s.status === '已验收')?.count || 0,
          验收不合格: records.statusDistribution?.find(s => s.status === '验收不合格')?.count || 0,
        });
      }
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...pagination,
        keyword: keyword.trim(),
      };
      if (statusFilter) params.status = statusFilter;
      const resp = await acceptanceAPI.getAcceptanceRecords(params);
      if (resp.success && resp.data) {
        setRecords(Array.isArray(resp.data) ? resp.data : []);
        setPagination(prev => ({ ...prev, total: resp.pagination?.total || 0 }));
      } else {
        message.error(resp.message || '获取验收列表失败');
      }
    } catch (error) {
      console.error('获取验收列表失败:', error);
      message.error('获取验收列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination, keyword, statusFilter]);

  useEffect(() => {
    fetchRecords();
    fetchStats();
  }, [fetchRecords, fetchStats]);

  const handleStatusUpdate = async (id, status) => {
    try {
      const resp = await acceptanceAPI.updateAcceptanceStatus(id, status);
      if (resp.success) {
        message.success('状态更新成功');
        fetchRecords();
      } else {
        message.error(resp.message || '更新失败');
      }
    } catch (error) {
      message.error('更新状态失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      const resp = await acceptanceAPI.deleteAcceptanceRecord(id);
      if (resp.success) {
        message.success('删除成功');
        fetchRecords();
      } else {
        message.error(resp.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleFormSuccess = () => {
    setFormModalOpen(false);
    setCurrentRecord(null);
    fetchRecords();
  };

  const handleSearch = (value) => {
    setKeyword(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
      render: (text, record) => (
        <a onClick={() => navigate(`/acceptance/${record.id}`)}>{text || '-'}</a>
      ),
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      ellipsis: true,
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 150,
      ellipsis: true,
    },
    {
      title: '验收日期',
      dataIndex: 'acceptance_date',
      key: 'acceptance_date',
      width: 120,
      render: date => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '验收人',
      dataIndex: 'acceptance_person',
      key: 'acceptance_person',
      width: 100,
    },
    {
      title: '使用科室',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: status => <Tag color={statusColorMap[status]}>{status}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/acceptance/${record.id}`)}>
            详情
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setCurrentRecord(record);
            setFormModalOpen(true);
          }}>
            编辑
          </Button>
          {record.status === '待验收' && (
            <Popconfirm title="确认标记为已验收？" onConfirm={() => handleStatusUpdate(record.id, '已验收')}>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}>通过</Button>
            </Popconfirm>
          )}
          {(record.status === '待验收' || record.status === '验收中') && (
            <Popconfirm title="确认标记为验收不合格？" onConfirm={() => handleStatusUpdate(record.id, '验收不合格')}>
              <Button size="small" danger icon={<CloseCircleOutlined />}>不合格</Button>
            </Popconfirm>
          )}
          {record.status === '验收不合格' && (
            <Popconfirm title="确认重新验收？" onConfirm={() => handleStatusUpdate(record.id, '验收中')}>
              <Button size="small" icon={<UndoOutlined />}>重新验收</Button>
            </Popconfirm>
          )}
          <Popconfirm title="确认删除这条验收记录？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>验收管理</h2>
        <Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => {
            setCurrentRecord(null);
            setFormModalOpen(true);
          }}>
            新建验收记录
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchRecords}>刷新</Button>
        </Space>
      </div>

      {stats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <Badge count={stats.total || 0} style={{ backgroundColor: '#1890ff' }} overflowCount={99999}>
            <Button>总计</Button>
          </Badge>
          <Badge count={stats.待验收 || 0} style={{ backgroundColor: statusColorMap.待验收 }} overflowCount={99999}>
            <Button>待验收</Button>
          </Badge>
          <Badge count={stats.验收中 || 0} style={{ backgroundColor: statusColorMap.验收中 }} overflowCount={99999}>
            <Button>验收中</Button>
          </Badge>
          <Badge count={stats.已验收 || 0} style={{ backgroundColor: statusColorMap.已验收 }} overflowCount={99999}>
            <Button>已验收</Button>
          </Badge>
          <Badge count={stats.验收不合格 || 0} style={{ backgroundColor: statusColorMap.验收不合格 }} overflowCount={99999}>
            <Button>验收不合格</Button>
          </Badge>
        </div>
      )}

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Search
          placeholder="搜索资产编号/资产名称..."
          allowClear
          onSearch={handleSearch}
          style={{ width: 300 }}
        />
        <Select
          placeholder="状态筛选"
          allowClear
          style={{ width: 120 }}
          value={statusFilter || undefined}
          onChange={setStatusFilter}
        >
          <Option value="待验收">待验收</Option>
          <Option value="验收中">验收中</Option>
          <Option value="已验收">已验收</Option>
          <Option value="验收不合格">验收不合格</Option>
        </Select>
      </div>

      <div className="hide-on-mobile">
        <Table
          dataSource={records}
          columns={columns}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: total => `共 ${total} 条记录`,
            onChange: (page, pageSize) => setPagination({ page, pageSize }),
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
                <span className="mobile-card-title">{record.asset_name || record.asset_code}</span>
                <Tag color="default">{record.status || '-'}</Tag>
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-field">
                  <span className="mobile-card-label">资产编码</span>
                  <span className="mobile-card-value">{record.asset_code || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">验收日期</span>
                  <span className="mobile-card-value">
                    {record.acceptance_date ? dayjs(record.acceptance_date).format('YYYY-MM-DD') : '-'}
                  </span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">验收人</span>
                  <span className="mobile-card-value">{record.acceptance_person || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">验收结果</span>
                  <span className="mobile-card-value">
                    {record.status === '已验收' ? (
                      <Tag color="success">通过</Tag>
                    ) : record.status === '验收不合格' ? (
                      <Tag color="error">不通过</Tag>
                    ) : (
                      <Tag>待验收</Tag>
                    )}
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
        title={currentRecord ? '编辑验收记录' : '新建验收记录'}
        open={formModalOpen}
        onCancel={() => setFormModalOpen(false)}
        footer={null}
        width={1200}
        destroyOnHidden
      >
        <AcceptanceForm
          record={currentRecord}
          onSuccess={handleFormSuccess}
          onCancel={() => setFormModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default AcceptanceList;
