/**
 * 培训管理页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../../hooks';
import { 
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select, 
  DatePicker, InputNumber, message, Popconfirm, Row, Col, Statistic,
  Badge, Alert, Descriptions, Tabs
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, BookOutlined,
  CheckCircleOutlined, ClockCircleOutlined,
  TeamOutlined, EyeOutlined, PlayCircleOutlined
} from '@ant-design/icons';
import { staffAPI, userAPI } from '../../../utils/api';
import moment from 'dayjs';

const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

const TrainingManagement = () => {
  const [activeTab, setActiveTab] = useState('trainings');
  const canDelete = useCan('staff', 'delete');
  const canEdit = useCan('staff', 'edit');
  const [loading, setLoading] = useState(false);
  const [trainings, setTrainings] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [trainingRecords, setTrainingRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  
  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    planned: 0,
    inProgress: 0,
    completed: 0
  });

  const trainingTypes = [
    { value: 'safety', label: '安全培训', color: 'red' },
    { value: 'skill', label: '技能培训', color: 'blue' },
    { value: 'management', label: '管理培训', color: 'purple' },
    { value: 'professional', label: '专业培训', color: 'green' },
    { value: 'regulatory', label: '法规培训', color: 'orange' }
  ];

  const statusOptions = [
    { value: 'planned', label: '计划中', color: 'default' },
    { value: 'in_progress', label: '进行中', color: 'processing' },
    { value: 'completed', label: '已完成', color: 'success' },
    { value: 'cancelled', label: '已取消', color: 'error' }
  ];

  const updateStats = useCallback((data) => {
    setStats({
      total: data.length,
      planned: data.filter(t => t.status === 'planned').length,
      inProgress: data.filter(t => t.status === 'in_progress').length,
      completed: data.filter(t => t.status === 'completed').length
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await staffAPI.getTrainingRecords({ pageSize: 100 });
      if (response?.success) {
        const data = response.data || [];
        setTrainings(data);
        updateStats(data);
      }
    } catch (_error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [updateStats]);

  const fetchStaffList = useCallback(async () => {
    try {
      const response = await userAPI.getUsers({ pageSize: 100, status: 'active' });
      const users = response?.data || Array.isArray(response) ? response : [];
      setStaffList(users);
    } catch (_error) {
      console.error('获取员工列表失败');
    }
  }, []);

  const fetchTrainingRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const response = await staffAPI.getTrainingRecords({ pageSize: 100 });
      if (response?.success) {
        setTrainingRecords(response.data || []);
      }
    } catch (_error) {
      console.error('获取培训记录失败');
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    void fetchStaffList();
  }, [fetchData, fetchStaffList]);

  // 当切换到记录Tab时加载数据
  useEffect(() => {
    if (activeTab === 'records') {
      void fetchTrainingRecords();
    }
  }, [activeTab, fetchTrainingRecords]);

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ status: 'planned', duration: 8 });
    fetchStaffList();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      start_date: record.start_date ? moment(record.start_date) : null,
      end_date: record.end_date ? moment(record.end_date) : null
    });
    setModalVisible(true);
  };

  const handleView = (record) => {
    setViewingRecord(record);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await staffAPI.deleteTrainingRecord(id);
      message.success('删除成功');
      fetchData();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (values.start_date) {
        values.start_date = values.start_date.format('YYYY-MM-DD');
      }
      if (values.end_date) {
        values.end_date = values.end_date.format('YYYY-MM-DD');
      }
      
      if (editingRecord) {
        await staffAPI.updateTrainingRecord(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await staffAPI.createTrainingRecord(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (_error) {
      message.error('操作失败');
    }
  };

  const trainingColumns = [
    { title: '培训编号', dataIndex: 'training_code', key: 'training_code', width: 120 },
    { title: '培训名称', dataIndex: 'training_name', key: 'training_name' },
    { 
      title: '培训类型', 
      dataIndex: 'training_type', 
      key: 'training_type',
      render: (v) => {
        const type = trainingTypes.find(t => t.value === v);
        return <Tag color={type?.color}>{type?.label}</Tag>;
      }
    },
    { title: '培训对象', dataIndex: 'target_audience', key: 'target_audience' },
    { 
      title: '培训时长', 
      dataIndex: 'duration', 
      key: 'duration',
      render: (v) => `${v}小时`
    },
    { title: '开始日期', dataIndex: 'start_date', key: 'start_date' },
    { title: '结束日期', dataIndex: 'end_date', key: 'end_date' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (v) => {
        const status = statusOptions.find(s => s.value === v);
        return <Badge status={status?.color} text={status?.label} />;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record)}>详情</Button>
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
            <Statistic title="培训总数" value={stats.total} prefix={<BookOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="计划中" value={stats.planned} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="进行中" value={stats.inProgress} prefix={<PlayCircleOutlined />} styles={{ content: { color: '#1890ff' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已完成" value={stats.completed} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'trainings',
            label: <span><BookOutlined /> 培训计划</span>,
            children: (
              <Card
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    新增培训
                  </Button>
                }
              >
                <Table
                  columns={trainingColumns}
                  dataSource={trainings}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            ),
          },
          {
            key: 'records',
            label: <span><TeamOutlined /> 培训记录</span>,
            children: (
              <Card>
                <Alert
                  title="培训记录功能"
                  description="显示员工的培训参与记录和成绩"
                  type="info"
                  showIcon
                />
                <div style={{ marginTop: 24 }}>
                  <Table
                    columns={[
                      { title: '员工姓名', dataIndex: 'staff_name', key: 'staff_name', render: v => v || '-' },
                      { title: '培训名称', dataIndex: 'training_name', key: 'training_name' },
                      { title: '培训日期', dataIndex: 'start_date', key: 'start_date', render: v => v || '-' },
                      { title: '培训时长', dataIndex: 'duration', key: 'duration', render: v => v ? `${v}小时` : '-' },
                      { title: '状态', dataIndex: 'status', key: 'status', render: v => {
                        const s = statusOptions.find(s => s.value === v);
                        return s ? <Tag color={s.color}>{s.label}</Tag> : v;
                      }}
                    ]}
                    dataSource={trainingRecords}
                    rowKey="id"
                    loading={recordsLoading}
                  />
                </div>
              </Card>
            ),
          },
        ]}
      />

      {/* 编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑培训' : '新增培训'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="training_code" label="培训编号" rules={[{ required: true }]}>
                <Input placeholder="请输入培训编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="training_name" label="培训名称" rules={[{ required: true }]}>
                <Input placeholder="请输入培训名称" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="training_type" label="培训类型" rules={[{ required: true }]}>
                <Select placeholder="请选择培训类型">
                  {trainingTypes.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="duration" label="培训时长(小时)" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="start_date" label="开始日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_date" label="结束日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="target_audience" label="培训对象">
            <Input placeholder="请输入培训对象" />
          </Form.Item>
          
          <Form.Item name="trainer" label="培训讲师">
            <Input placeholder="请输入培训讲师" />
          </Form.Item>
          
          <Form.Item name="training_content" label="培训内容">
            <TextArea rows={3} placeholder="请输入培训内容" />
          </Form.Item>
          
          <Form.Item name="location" label="培训地点">
            <Input placeholder="请输入培训地点" />
          </Form.Item>
          
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select placeholder="请选择状态">
              {statusOptions.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
            </Select>
          </Form.Item>
          
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="培训详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[<Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>]}
        width={700}
      >
        {viewingRecord && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="培训编号">{viewingRecord.training_code}</Descriptions.Item>
            <Descriptions.Item label="培训名称">{viewingRecord.training_name}</Descriptions.Item>
            <Descriptions.Item label="培训类型">
              <Tag color={trainingTypes.find(t => t.value === viewingRecord.training_type)?.color}>
                {trainingTypes.find(t => t.value === viewingRecord.training_type)?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="培训时长">{viewingRecord.duration}小时</Descriptions.Item>
            <Descriptions.Item label="开始日期">{viewingRecord.start_date}</Descriptions.Item>
            <Descriptions.Item label="结束日期">{viewingRecord.end_date}</Descriptions.Item>
            <Descriptions.Item label="培训对象">{viewingRecord.target_audience || '-'}</Descriptions.Item>
            <Descriptions.Item label="培训讲师">{viewingRecord.trainer || '-'}</Descriptions.Item>
            <Descriptions.Item label="培训地点">{viewingRecord.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Badge status={statusOptions.find(s => s.value === viewingRecord.status)?.color} text={statusOptions.find(s => s.value === viewingRecord.status)?.label} />
            </Descriptions.Item>
            <Descriptions.Item label="培训内容" span={2}>{viewingRecord.training_content || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{viewingRecord.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default TrainingManagement;
