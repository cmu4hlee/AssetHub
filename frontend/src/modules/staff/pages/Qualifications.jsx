import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../../hooks';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  DatePicker, message, Popconfirm, Row, Col, Statistic,
  Badge, Descriptions, Alert
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, WarningOutlined, ClockCircleOutlined,
  UserOutlined, EyeOutlined, SafetyCertificateOutlined,
  SearchOutlined, ReloadOutlined
} from '@ant-design/icons';
import { staffAPI, userAPI } from '../../../utils/api';
import moment from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const QualificationManagement = () => {
  const canDelete = useCan('staff', 'delete');
  const canEdit = useCan('staff', 'edit');
  const [loading, setLoading] = useState(false);
  const [qualifications, setQualifications] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ qualification_type: undefined, status: undefined });

  const [stats, setStats] = useState({
    total: 0,
    valid: 0,
    expiring: 0,
    expired: 0
  });

  const qualificationTypes = [
    { value: 'professional', label: '专业资质', color: 'blue' },
    { value: 'skill', label: '技能资质', color: 'green' },
    { value: 'safety', label: '安全资质', color: 'red' },
    { value: 'special', label: '特殊资质', color: 'purple' }
  ];

  const statusOptions = [
    { value: 'active', label: '有效', color: 'success', icon: <CheckCircleOutlined /> },
    { value: 'expiring', label: '即将过期', color: 'warning', icon: <ClockCircleOutlined /> },
    { value: 'expired', label: '已过期', color: 'error', icon: <WarningOutlined /> },
    { value: 'revoked', label: '已撤销', color: 'default', icon: <WarningOutlined /> }
  ];

  const getStatusDisplay = (status) => {
    if (status === 'active') {
      return statusOptions.find(s => s.value === 'active');
    }
    const found = statusOptions.find(s => s.value === status);
    return found || statusOptions.find(s => s.value === 'active');
  };

  const updateStats = useCallback((data) => {
    setStats({
      total: data.length,
      valid: data.filter(q => q.status === 'active').length,
      expiring: data.filter(q => q.status === 'expiring').length,
      expired: data.filter(q => q.status === 'expired').length
    });
  }, []);

  const fetchStaffList = useCallback(async () => {
    try {
      const response = await userAPI?.getUsers?.({ pageSize: 100, status: 'active' });
      if (response?.data) {
        setStaffList(response.data);
      } else if (response?.success && response.data) {
        setStaffList(Array.isArray(response.data) ? response.data : []);
      }
    } catch (_error) {
      console.error('获取员工列表失败');
    }
  }, []);

  const fetchData = useCallback(async (page = 1, pageSize = 10, currentFilters = filters) => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (currentFilters.qualification_type) {
        params.qualification_type = currentFilters.qualification_type;
      }
      if (currentFilters.status) {
        params.status = currentFilters.status;
      }
      const response = await staffAPI.getQualifications(params);
      if (response?.success) {
        const data = response.data || [];
        setQualifications(data);
        if (response.pagination) {
          setPagination({
            current: response.pagination.page || page,
            pageSize: response.pagination.pageSize || pageSize,
            total: response.pagination.total || 0
          });
        }
        updateStats(data);
      }
    } catch (_error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [filters, updateStats]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleTableChange = (pag) => {
    fetchData(pag.current, pag.pageSize);
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
    fetchData(1, pagination.pageSize, newFilters);
  };

  const handleResetFilters = () => {
    const newFilters = { qualification_type: undefined, status: undefined };
    setFilters(newFilters);
    fetchData(1, pagination.pageSize, newFilters);
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ status: 'active' });
    fetchStaffList();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      issue_date: record.issue_date ? moment(record.issue_date) : null,
      expiry_date: record.expiry_date ? moment(record.expiry_date) : null
    });
    fetchStaffList();
    setModalVisible(true);
  };

  const handleView = (record) => {
    setViewingRecord(record);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await staffAPI.deleteQualification(id);
      message.success('删除成功');
      fetchData(pagination.current, pagination.pageSize);
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (values.issue_date) {
        values.issue_date = values.issue_date.format('YYYY-MM-DD');
      }
      if (values.expiry_date) {
        values.expiry_date = values.expiry_date.format('YYYY-MM-DD');
      }

      if (editingRecord) {
        await staffAPI.updateQualification(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await staffAPI.createQualification(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData(pagination.current, pagination.pageSize);
    } catch (_error) {
      if (_error.errorFields) {
        return;
      }
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '资质编号', dataIndex: 'qualification_code', key: 'qualification_code', width: 120 },
    { title: '员工姓名', dataIndex: 'staff_name', key: 'staff_name', render: (v) => <><UserOutlined /> {v}</> },
    { title: '资质名称', dataIndex: 'qualification_name', key: 'qualification_name' },
    {
      title: '资质类型',
      dataIndex: 'qualification_type',
      key: 'qualification_type',
      render: (v) => {
        const type = qualificationTypes.find(t => t.value === v);
        return <Tag color={type?.color}>{type?.label || v}</Tag>;
      }
    },
    { title: '发证机构', dataIndex: 'issuing_authority', key: 'issuing_authority' },
    { title: '发证日期', dataIndex: 'issue_date', key: 'issue_date' },
    {
      title: '到期日期',
      dataIndex: 'expiry_date',
      key: 'expiry_date',
      render: (v) => {
        if (!v) return '-';
        const days = moment(v).diff(moment(), 'days');
        if (days < 0) return <Tag color="red">{v} (已过期)</Tag>;
        if (days < 90) return <Tag color="orange">{v} (剩{days}天)</Tag>;
        return v;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v) => {
        const status = getStatusDisplay(v);
        return <Badge status={status?.color} text={status?.label} />;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record)}>查看</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="资质总数" value={stats.total} prefix={<SafetyCertificateOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="有效" value={stats.valid} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="即将过期" value={stats.expiring} prefix={<ClockCircleOutlined />} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已过期" value={stats.expired} prefix={<WarningOutlined />} styles={{ content: { color: '#f5222d' } }} />
          </Card>
        </Col>
      </Row>

      {stats.expired > 0 && (
        <Alert
          message={`警告：有 ${stats.expired} 项资质已过期，请立即安排重新认证！`}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {stats.expiring > 0 && (
        <Alert
          message={`提醒：有 ${stats.expiring} 项资质即将过期，请提前安排续期！`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card
        title={<span><SafetyCertificateOutlined /> 人员资质管理</span>}
        extra={
          <Space>
            <Select
              placeholder="资质类型"
              allowClear
              style={{ width: 130 }}
              value={filters.qualification_type}
              onChange={(v) => handleFilterChange('qualification_type', v)}
            >
              {qualificationTypes.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
            </Select>
            <Select
              placeholder="状态"
              allowClear
              style={{ width: 120 }}
              value={filters.status}
              onChange={(v) => handleFilterChange('status', v)}
            >
              {statusOptions.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>重置</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增资质
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={qualifications}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          onChange={handleTableChange}
        />
      </Card>

      <Modal
        title={editingRecord ? '编辑资质' : '新增资质'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="qualification_code" label="资质编号" rules={[{ required: true, message: '请输入资质编号' }]}>
                <Input placeholder="请输入资质编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="staff_id" label="选择员工" rules={[{ required: true, message: '请选择员工' }]}>
                <Select placeholder="请选择员工" showSearch optionFilterProp="label">
                  {staffList.map(staff => (
                    <Option key={staff.id} value={staff.id} label={staff.real_name || staff.username || staff.name}>
                      {staff.real_name || staff.username || staff.name} {staff.username && staff.real_name ? `(${staff.username})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="qualification_name" label="资质名称" rules={[{ required: true, message: '请输入资质名称' }]}>
                <Input placeholder="请输入资质名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="qualification_type" label="资质类型" rules={[{ required: true, message: '请选择资质类型' }]}>
                <Select placeholder="请选择资质类型">
                  {qualificationTypes.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="issuing_authority" label="发证机构" rules={[{ required: true, message: '请输入发证机构' }]}>
                <Input placeholder="请输入发证机构" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="certificate_no" label="证书编号">
                <Input placeholder="请输入证书编号" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="issue_date" label="发证日期" rules={[{ required: true, message: '请选择发证日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expiry_date" label="到期日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="scope" label="资质范围">
            <TextArea rows={2} placeholder="请输入资质适用范围" />
          </Form.Item>

          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="资质详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[<Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>]}
        width={700}
      >
        {viewingRecord && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="资质编号">{viewingRecord.qualification_code}</Descriptions.Item>
            <Descriptions.Item label="员工姓名">{viewingRecord.staff_name}</Descriptions.Item>
            <Descriptions.Item label="资质名称">{viewingRecord.qualification_name}</Descriptions.Item>
            <Descriptions.Item label="资质类型">
              <Tag color={qualificationTypes.find(t => t.value === viewingRecord.qualification_type)?.color}>
                {qualificationTypes.find(t => t.value === viewingRecord.qualification_type)?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="发证机构">{viewingRecord.issuing_authority}</Descriptions.Item>
            <Descriptions.Item label="证书编号">{viewingRecord.certificate_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="发证日期">{viewingRecord.issue_date}</Descriptions.Item>
            <Descriptions.Item label="到期日期">{viewingRecord.expiry_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {(() => {
                const s = getStatusDisplay(viewingRecord.status);
                return <Badge status={s?.color} text={s?.label} />;
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="资质范围" span={2}>{viewingRecord.scope || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{viewingRecord.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default QualificationManagement;
