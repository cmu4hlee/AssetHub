import { useState, useEffect } from 'react';
import { useIsMobile, useCan } from '../hooks';
import { Table, Button, Space, Tag, Card, Form, Input, Select, DatePicker, message, Modal, Popconfirm, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, CheckOutlined, CloseOutlined, PrinterOutlined } from '@ant-design/icons';
import { scrappingAPI } from '../utils/api';
import { printScrappingReport } from '../utils/printReport';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

const statusMap = {
  pending: { text: '待处理', color: 'default' },
  appraising: { text: '鉴定中', color: 'processing' },
  approved: { text: '已批准', color: 'success' },
  rejected: { text: '已拒绝', color: 'error' },
  disposing: { text: '处理中', color: 'warning' },
  completed: { text: '已完成', color: 'success' },
  archived: { text: '已归档', color: 'blue' },
  cancelled: { text: '已取消', color: 'default' },
};

const ScrappingList = () => {
  const navigate = useNavigate();
  const [dataSource, setDataSource] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({});
  const [form] = Form.useForm();
  const isMobile = useIsMobile();
  const canDelete = useCan('scrapping', 'delete');
  const canEdit = useCan('scrapping', 'edit');

  // 审批弹窗状态
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);
  const [approveAction, setApproveAction] = useState('approved'); // approved | rejected
  const [approveForm] = Form.useForm();
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async (page = 1, pageSize = 10, filterParams = {}) => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize,
        ...filterParams,
      };
      if (filterParams.dateRange) {
        params.start_date = filterParams.dateRange[0].format('YYYY-MM-DD');
        params.end_date = filterParams.dateRange[1].format('YYYY-MM-DD');
        delete params.dateRange;
      }
      const result = await scrappingAPI.getScrappingRecords(params);
      if (result.success) {
        setDataSource(result.data.records || []);
        setPagination({
          current: result.data.pagination?.page || 1,
          pageSize: result.data.pagination?.pageSize || 10,
          total: result.data.pagination?.total || 0,
        });
      }
    } catch (error) {
      console.error('获取报废记录失败:', error);
      message.error('获取报废记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = (values) => {
    const filterParams = {};
    if (values.status) filterParams.status = values.status;
    if (values.asset_code) filterParams.asset_code = values.asset_code;
    if (values.dateRange) {
      filterParams.dateRange = values.dateRange;
    }
    setFilters(filterParams);
    fetchData(1, 10, filterParams);
  };

  const handleTableChange = (pag) => {
    fetchData(pag.current, pag.pageSize, filters);
  };

  const handleDelete = async (id) => {
    try {
      const result = await scrappingAPI.deleteScrapping(id);
      if (result.success) {
        message.success('删除成功');
        fetchData(pagination.current, pagination.pageSize, filters);
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 打开审批弹窗
  const openApproveModal = (record, action) => {
    setApproveTarget(record);
    setApproveAction(action);
    approveForm.resetFields();
    setApproveModalVisible(true);
  };

  // 提交审批
  const handleApproveSubmit = async () => {
    try {
      const values = await approveForm.validateFields();
      setActionLoading(true);
      const id = approveTarget.id;
      let result;
      if (approveAction === 'approved') {
        result = await scrappingAPI.approveScrapping(id, {
          ...values,
          approval_status: 'approved',
        });
      } else {
        result = await scrappingAPI.rejectScrapping(id, values);
      }
      if (result.success) {
        message.success(approveAction === 'approved' ? '审批通过' : '已驳回');
        setApproveModalVisible(false);
        fetchData(pagination.current, pagination.pageSize, filters);
      } else {
        message.error(result.message || '操作失败');
      }
    } catch (error) {
      if (error?.errorFields) return; // 表单校验错误
      message.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintReport = () => {
    if (!dataSource || dataSource.length === 0) {
      message.warning('暂无数据可打印');
      return;
    }
    printScrappingReport(dataSource);
  };

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 150,
    },
    {
      title: '型号',
      dataIndex: 'asset_model',
      key: 'asset_model',
      width: 120,
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 100,
    },
    {
      title: '申请日期',
      dataIndex: 'apply_date',
      key: 'apply_date',
      width: 120,
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
    },
    {
      title: '报废原因',
      dataIndex: 'scrapping_reason',
      key: 'scrapping_reason',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'current_status',
      key: 'current_status',
      width: 100,
      render: (status) => {
        const statusInfo = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/scrapping/${record.id}`)}
          >
            详情
          </Button>
          {record.current_status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/scrapping/${record.id}/edit`)}
              >
                编辑
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => openApproveModal(record, 'approved')}
              >
                通过
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => openApproveModal(record, 'rejected')}
              >
                拒绝
              </Button>
            </>
          )}
          {(record.current_status === 'pending' || record.current_status === 'rejected') && (
            <Popconfirm
              title="确定删除此记录?"
              onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0' }}>
      <Card>
        <Form
          form={form}
          layout="inline"
          onFinish={handleSearch}
          style={{ marginBottom: 16 }}
        >
          <Form.Item name="asset_code" label="资产编号">
            <Input placeholder="请输入资产编号" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择状态" style={{ width: 120 }} allowClear>
              {Object.entries(statusMap).map(([key, value]) => (
                <Select.Option key={key} value={key}>{value.text}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="dateRange" label="申请日期">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button onClick={() => { form.resetFields(); setFilters({}); fetchData(); }}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Row justify="space-between" style={{ marginBottom: 16 }}>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/scrapping/new')}
            >
              新增报废申请
            </Button>
          </Col>
        </Row>

        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button icon={<PrinterOutlined />} onClick={handlePrintReport}>
            打印报表
          </Button>
        </div>

        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={dataSource}
            loading={loading}
            rowKey="id"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            onChange={handleTableChange}
            scroll={{ x: 1200 }}
          />
        </div>

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {dataSource.map(record => (
            <div key={record.id} className="mobile-card-item">
              <div className="mobile-card-header">
                <span className="mobile-card-title">{record.asset_code || '-'}</span>
                <Tag color={statusMap[record.current_status]?.color || 'default'}>
                  {statusMap[record.current_status]?.text || record.current_status}
                </Tag>
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-field">
                  <span className="mobile-card-label">资产名称</span>
                  <span className="mobile-card-value">{record.asset_name || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">报废原因</span>
                  <span className="mobile-card-value">{record.scrapping_reason || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">申请人</span>
                  <span className="mobile-card-value">{record.applicant || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">申请时间</span>
                  <span className="mobile-card-value">{record.apply_date ? dayjs(record.apply_date).format('YYYY-MM-DD') : '-'}</span>
                </div>
              </div>
              <div className="mobile-card-actions">
                <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/scrapping/${record.id}`)} block>详情</Button>
                {record.current_status === 'pending' && (
                  <>
                    <Button size="small" icon={<CheckOutlined />} onClick={() => openApproveModal(record, 'approved')} block>批准</Button>
                    <Button size="small" danger icon={<CloseOutlined />} onClick={() => openApproveModal(record, 'rejected')} block>拒绝</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 审批弹窗 */}
        <Modal
          title={approveAction === 'approved' ? '审批通过' : '驳回申请'}
          open={approveModalVisible}
          onOk={handleApproveSubmit}
          onCancel={() => setApproveModalVisible(false)}
          confirmLoading={actionLoading}
          okText={approveAction === 'approved' ? '确认通过' : '确认驳回'}
          okButtonProps={approveAction === 'rejected' ? { danger: true } : {}}
          cancelText="取消"
        >
          <Form form={approveForm} layout="vertical">
            {approveAction === 'rejected' ? (
              <Form.Item
                name="approval_comment"
                label="驳回原因"
                rules={[{ required: true, message: '请输入驳回原因' }]}
              >
                <TextArea rows={3} placeholder="请输入驳回原因" maxLength={500} showCount />
              </Form.Item>
            ) : (
              <Form.Item name="approval_comment" label="审批意见">
                <TextArea rows={3} placeholder="请输入审批意见（可选）" maxLength={500} showCount />
              </Form.Item>
            )}
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default ScrappingList;
