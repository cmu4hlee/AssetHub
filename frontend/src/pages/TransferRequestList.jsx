import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Select, Space, Popconfirm, message, Tag, Modal, Form, Input } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { assetAPI } from '../utils/api';
import { useCurrentUser } from '../hooks';

const TransferRequestList = () => {
  const { user: currentUser } = useCurrentUser();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  // 默认显示待审批和已审批的申请（不显示已拒绝的）
  const [statusFilter, setStatusFilter] = useState('');
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [currentRequest, setCurrentRequest] = useState(null);

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        // 如果选择了"全部"，传'all'；如果选择了具体状态，传该状态；否则不传（后端默认显示待审批和已审批）
        status:
          statusFilter === ''
            ? undefined
            : statusFilter === 'all'
              ? 'all'
              : statusFilter || undefined,
      };
      console.log('========== 开始加载调配申请 ==========');
      console.log('请求参数:', params);
      const result = await assetAPI.getTransferRequests(params);
      console.log('API返回完整结果:', JSON.stringify(result, null, 2));
      if (result.success) {
        console.log(
          '调配申请加载成功，数据量:',
          result.data?.length,
          '总数:',
          result.pagination?.total
        );
        console.log('分页信息:', result.pagination);
        console.log(
          '返回的数据（包含日期）:',
          result.data?.map(item => ({
            id: item.id,
            asset_code: item.asset_code,
            status: item.status,
            created_at: item.created_at,
            current_department: item.current_department,
            target_department: item.target_department,
          }))
        );
        setData(result.data || []);
        setPagination(prev => ({
          ...prev,
          total: result.pagination?.total || 0,
        }));
        // 如果没有数据，显示提示
        if (!result.data || result.data.length === 0) {
          console.warn('没有找到调配申请数据');
        } else {
          // 检查日期范围
          const dates = result.data.map(item => item.created_at).filter(Boolean);
          if (dates.length > 0) {
            console.log('数据日期范围:', {
              earliest: dates.sort()[0],
              latest: dates.sort().reverse()[0],
              allDates: [...new Set(dates.map(d => (d ? d.split(' ')[0] : null)))].filter(Boolean),
            });
          }
        }
      } else {
        console.error('API返回失败:', result);
        message.error(result.message || '加载调配申请失败');
      }
    } catch (error) {
      console.error('========== 加载调配申请异常 ==========');
      console.error('错误对象:', error);
      console.error('错误消息:', error.message);
      console.error('错误响应:', error.response);
      console.error('错误响应数据:', error.response?.data);
      console.error('=====================================');
      const errorMessage = error.response?.data?.message || error.message || '加载调配申请失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 获取租户ID
  const getTenantId = useCallback(async () => {
    if (currentUser?.tenant_id) {
      return currentUser.tenant_id;
    }
    return null;
  }, [currentUser]);

  const handleApprove = async (id, approved) => {
    try {
      const tenantId = await getTenantId();
      const result = await assetAPI.approveTransferRequest(id, {
        approved,
        comment: '',
        tenant_id: tenantId,
      });
      if (result.success) {
        message.success(`调配申请已${approved ? '批准' : '拒绝'}`);
        loadData();
      }
    } catch (error) {
      message.error(`处理调配申请失败`);
    }
  };

  const getStatusTag = status => {
    const statusMap = {
      pending: { color: 'warning', text: '待审批' },
      approved: { color: 'success', text: '已批准' },
      rejected: { color: 'default', text: '已拒绝' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: '申请ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 120,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 180,
    },
    {
      title: '当前部门',
      dataIndex: 'current_department',
      key: 'current_department',
      width: 120,
    },
    {
      title: '目标部门',
      dataIndex: 'target_department',
      key: 'target_department',
      width: 120,
    },
    {
      title: '申请原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 200,
      ellipsis: true,
      render: text => <span title={text}>{text}</span>,
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 100,
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: text => (text ? new Date(text).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: status => getStatusTag(status),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              setCurrentRequest(record);
              setPreviewModalVisible(true);
            }}
          >
            查看
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record.id, true)}
              >
                批准
              </Button>
              <Popconfirm
                title="确定要拒绝这个调配申请吗？"
                onConfirm={() => handleApprove(record.id, false)}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<CloseCircleOutlined />}>
                  拒绝
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2>资产调配申请处理</h2>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Select
          placeholder="筛选状态"
          style={{ width: 150 }}
          allowClear
          value={statusFilter || undefined}
          onChange={value => {
            setStatusFilter(value || '');
            setPagination({ ...pagination, current: 1 });
          }}
        >
          <Select.Option value="">待审批和已审批</Select.Option>
          <Select.Option value="all">全部状态</Select.Option>
          <Select.Option value="pending">待审批</Select.Option>
          <Select.Option value="approved">已批准</Select.Option>
          <Select.Option value="rejected">已拒绝</Select.Option>
        </Select>
        <span style={{ marginLeft: 16, color: '#666' }}>共 {pagination.total} 条申请</span>
      </div>
      {/* 桌面端表格 */}
      <div className="hide-on-mobile">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => {
              console.log('分页变化 - 页码:', page, '每页数量:', pageSize);
              setPagination({ ...pagination, current: page, pageSize });
            },
            onShowSizeChange: (current, size) => {
              console.log('每页数量变化 - 当前页:', current, '新数量:', size);
              setPagination({ ...pagination, current: 1, pageSize: size });
            },
          }}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: loading ? '加载中...' : '暂无调配申请数据',
          }}
        />
      </div>

      {/* 移动端卡片列表 */}
      <div className="mobile-table-cards show-on-mobile">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
        ) : Array.isArray(data) && data.length > 0 ? (
          <>
            {data.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">申请 #{record.id}</span>
                  {getStatusTag(record.status)}
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">资产编号</span>
                    <span className="mobile-card-value">{record.asset_code || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">资产名称</span>
                    <span className="mobile-card-value">{record.asset_name || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">当前部门</span>
                    <span className="mobile-card-value">{record.current_department || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">目标部门</span>
                    <span className="mobile-card-value">{record.target_department || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">申请原因</span>
                    <span className="mobile-card-value">{record.reason || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">申请人</span>
                    <span className="mobile-card-value">{record.applicant || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">申请时间</span>
                    <span className="mobile-card-value">
                      {record.created_at
                        ? new Date(record.created_at).toLocaleString('zh-CN')
                        : '-'}
                    </span>
                  </div>
                </div>
                <div className="mobile-card-actions">
                  <Button
                    type="primary"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => {
                      setCurrentRequest(record);
                      setPreviewModalVisible(true);
                    }}
                    block
                  >
                    查看
                  </Button>
                  {record.status === 'pending' && (
                    <>
                      <Button
                        type="primary"
                        size="small"
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleApprove(record.id, true)}
                        block
                      >
                        批准
                      </Button>
                      <Popconfirm
                        title="确定要拒绝这个调配申请吗？"
                        onConfirm={() => handleApprove(record.id, false)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button danger size="small" icon={<CloseCircleOutlined />} block>
                          拒绝
                        </Button>
                      </Popconfirm>
                    </>
                  )}
                </div>
              </div>
            ))}
            {/* 移动端分页 */}
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <Space>
                <Button
                  disabled={pagination.current === 1}
                  onClick={() => setPagination({ ...pagination, current: pagination.current - 1 })}
                >
                  上一页
                </Button>
                <span>
                  第 {pagination.current} / {Math.ceil(pagination.total / pagination.pageSize)} 页
                </span>
                <Button
                  disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                  onClick={() => setPagination({ ...pagination, current: pagination.current + 1 })}
                >
                  下一页
                </Button>
              </Space>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
        )}
      </div>

      {/* 申请详情预览模态框 */}
      <Modal
        title="调配申请详情"
        open={previewModalVisible}
        onCancel={() => {
          setPreviewModalVisible(false);
          setCurrentRequest(null);
        }}
        footer={null}
        width={600}
      >
        {currentRequest && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                  资产编号
                </label>
                <Input value={currentRequest.asset_code} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                  资产名称
                </label>
                <Input value={currentRequest.asset_name} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                  当前使用部门
                </label>
                <Input value={currentRequest.current_department} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                  目标部门
                </label>
                <Input value={currentRequest.target_department} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                  调配原因
                </label>
                <Input.TextArea rows={4} value={currentRequest.reason} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                  申请人
                </label>
                <Input value={currentRequest.applicant} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                  申请时间
                </label>
                <Input
                  value={
                    currentRequest.created_at
                      ? new Date(currentRequest.created_at).toLocaleString('zh-CN')
                      : '-'
                  }
                  disabled
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                  审批人
                </label>
                <Input value={currentRequest.approved_by || '-'} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                  审批时间
                </label>
                <Input
                  value={
                    currentRequest.approved_at
                      ? new Date(currentRequest.approved_at).toLocaleString('zh-CN')
                      : '-'
                  }
                  disabled
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                  状态
                </label>
                <Input value={getStatusTag(currentRequest.status)} disabled />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TransferRequestList;
