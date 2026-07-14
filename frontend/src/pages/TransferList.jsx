import React, { useState, useEffect } from 'react';
import { Table, Button, Select, Space, Popconfirm, message, Tag, Empty, Card, Row, Col, Modal, Input } from 'antd';
import { useIsMobile, useCan } from '../hooks';
import { PlusOutlined, DeleteOutlined, PrinterOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { transferAPI } from '../utils/api';
import { printTransferReport } from '../utils/printReport';

const { Option } = Select;

const TransferList = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const isMobile = useIsMobile();
  const canDelete = useCan('transfer', 'delete');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);

  useEffect(() => {
    loadData();
    loadStats();
  }, [pagination.current, pagination.pageSize, statusFilter]);

  const loadStats = async () => {
    try {
      const result = await transferAPI.getTransferStats();
      if (result.success) {
        setStats(result.data || { total: 0, pending: 0, approved: 0, rejected: 0 });
      }
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        status: statusFilter || undefined,
      };
      const result = await transferAPI.getTransfers(params);
      if (result.success) {
        setData(result.data);
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total,
        }));
      }
    } catch (error) {
      message.error('加载调配记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async id => {
    try {
      const result = await transferAPI.deleteTransfer(id);
      if (result.success) {
        message.success('删除成功');
        loadData();
        loadStats();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleApprove = async (id, approved) => {
    try {
      const result = approved
        ? await transferAPI.approveTransfer(id, { comment: '' })
        : await transferAPI.rejectTransfer(id, { comment: '' });
      if (result.success) {
        message.success(`调配申请已${approved ? '批准' : '拒绝'}`);
        loadData();
        loadStats();
      } else {
        message.error(result.message || '操作失败');
      }
    } catch (error) {
      message.error(`处理调配申请失败: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleViewDetail = record => {
    setCurrentRecord(record);
    setDetailModalVisible(true);
  };

  const handlePrintReport = () => {
    if (!data || data.length === 0) {
      message.warning('暂无数据可打印');
      return;
    }
    printTransferReport(data);
  };

  const getStatusTag = status => {
    const statusMap = {
      待审批: { color: 'warning', text: '待审批' },
      已批准: { color: 'success', text: '已批准' },
      已完成: { color: 'success', text: '已完成' },
      已取消: { color: 'default', text: '已取消' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: '调配单号',
      dataIndex: 'transfer_no',
      key: 'transfer_no',
      width: 150,
    },
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 150,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 200,
    },
    {
      title: '调出部门',
      dataIndex: 'from_department',
      key: 'from_department',
      width: 120,
    },
    {
      title: '调入部门',
      dataIndex: 'to_department',
      key: 'to_department',
      width: 120,
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 100,
    },
    {
      title: '调配日期',
      dataIndex: 'transfer_date',
      key: 'transfer_date',
      width: 120,
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
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            查看
          </Button>
          {record.status === '待审批' && (
            <>
              <Button type="link" icon={<CheckCircleOutlined />} onClick={() => handleApprove(record.id, true)}>
                批准
              </Button>
              <Popconfirm
                title="确定要拒绝这个调配申请吗？"
                onConfirm={() => handleApprove(record.id, false)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" danger icon={<CloseCircleOutlined />}>
                  拒绝
                </Button>
              </Popconfirm>
            </>
          )}
          <Popconfirm
            title="确定要删除这个调配记录吗？"
            onConfirm={() => handleDelete(record.id)}
            disabled={!canDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{stats.total}</div>
              <div style={{ color: '#666' }}>总调配数</div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>{stats.pending}</div>
              <div style={{ color: '#666' }}>待审批</div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{stats.approved}</div>
              <div style={{ color: '#666' }}>已批准</div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#8c8c8c' }}>{stats.rejected}</div>
              <div style={{ color: '#666' }}>已拒绝</div>
            </div>
          </Card>
        </Col>
      </Row>

      <div
        style={{
          marginBottom: isMobile ? 12 : 16,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? 8 : 0,
        }}
      >
        <h2 style={{ fontSize: isMobile ? '18px' : '24px', margin: 0 }}>调配记录</h2>
        <Space>
          <Button
            icon={<PrinterOutlined />}
            onClick={handlePrintReport}
            block={isMobile}
            size={isMobile ? 'small' : 'middle'}
          >
            打印报表
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/transfer/new')}
            block={isMobile}
            size={isMobile ? 'small' : 'middle'}
          >
            调配申请
          </Button>
        </Space>
      </div>
      <div style={{ marginBottom: isMobile ? 12 : 16 }}>
        <Select
          placeholder="筛选状态"
          style={{ width: isMobile ? '100%' : 150 }}
          allowClear
          value={statusFilter || undefined}
          onChange={value => {
            setStatusFilter(value || '');
            setPagination({ ...pagination, current: 1 });
          }}
          size={isMobile ? 'small' : 'middle'}
        >
          <Option value="待审批">待审批</Option>
          <Option value="已批准">已批准</Option>
          <Option value="已取消">已取消</Option>
        </Select>
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
            showTotal: total => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            },
          }}
          scroll={{ x: 1300 }}
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
                  <span className="mobile-card-title">{record.transfer_no || '-'}</span>
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
                    <span className="mobile-card-label">调出部门</span>
                    <span className="mobile-card-value">{record.from_department || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">调入部门</span>
                    <span className="mobile-card-value">{record.to_department || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">申请人</span>
                    <span className="mobile-card-value">{record.applicant || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">调配日期</span>
                    <span className="mobile-card-value">{record.transfer_date || '-'}</span>
                  </div>
                </div>
                <div className="mobile-card-actions">
                  <Popconfirm
                    title="确定要删除这个调配记录吗？"
                    onConfirm={() => handleDelete(record.id)}
              disabled={!canDelete}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button type="primary" danger size="small" icon={<DeleteOutlined />} block disabled={!canDelete}>
                      删除
                    </Button>
                  </Popconfirm>
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
              <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                共 {pagination.total} 条
              </div>
            </div>
          </>
        ) : (
          <Empty description="暂无数据" />
        )}
      </div>

      {/* 详情弹窗 */}
      <Modal
        title="调配详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setCurrentRecord(null);
        }}
        footer={null}
        width={600}
      >
        {currentRecord && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>调配单号</label>
                <Input value={currentRecord.transfer_no || '-'} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>资产编号</label>
                <Input value={currentRecord.asset_code || '-'} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>资产名称</label>
                <Input value={currentRecord.asset_name || '-'} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>调出部门</label>
                <Input value={currentRecord.from_department || '-'} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>调入部门</label>
                <Input value={currentRecord.to_department || '-'} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>调配原因</label>
                <Input.TextArea rows={2} value={currentRecord.transfer_reason || '-'} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>申请人</label>
                <Input value={currentRecord.applicant || '-'} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>调配日期</label>
                <Input value={currentRecord.transfer_date || '-'} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>审批人</label>
                <Input value={currentRecord.approved_by || '-'} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>审批时间</label>
                <Input value={currentRecord.approved_at || '-'} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>审批意见</label>
                <Input value={currentRecord.remark || '-'} disabled />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>状态</label>
                {getStatusTag(currentRecord.status)}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TransferList;
