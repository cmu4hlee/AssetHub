/**
 * 能力考核管理页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../../hooks';
import { 
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select, 
  DatePicker, InputNumber, message, Popconfirm, Row, Col, Statistic,
  Badge, Progress, Descriptions, Result
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, TrophyOutlined,
  CheckCircleOutlined, WarningOutlined,
  FileTextOutlined, EyeOutlined, StarOutlined
} from '@ant-design/icons';
import { staffAPI, userAPI } from '../../../utils/api';
import moment from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const CompetencyAssessment = () => {
  const canDelete = useCan('staff', 'delete');
  const canEdit = useCan('staff', 'edit');
  const [loading, setLoading] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [examinerList, setExaminerList] = useState([]);
  
  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    excellent: 0,
    good: 0,
    qualified: 0,
    unqualified: 0
  });

  const assessmentTypes = [
    { value: 'skill', label: '技能考核', color: 'blue' },
    { value: 'knowledge', label: '知识考核', color: 'green' },
    { value: 'comprehensive', label: '综合考核', color: 'purple' },
    { value: 'practical', label: '实操考核', color: 'orange' }
  ];

  const statusOptions = [
    { value: 'planned', label: '计划中', color: 'default' },
    { value: 'in_progress', label: '进行中', color: 'processing' },
    { value: 'completed', label: '已完成', color: 'success' }
  ];

  const resultOptions = [
    { value: 'excellent', label: '优秀', color: 'success', minScore: 90 },
    { value: 'good', label: '良好', color: 'blue', minScore: 80 },
    { value: 'qualified', label: '合格', color: 'warning', minScore: 60 },
    { value: 'unqualified', label: '不合格', color: 'error', minScore: 0 }
  ];

  const updateStats = useCallback((data) => {
    setStats({
      total: data.length,
      excellent: data.filter(a => a.result === 'excellent').length,
      good: data.filter(a => a.result === 'good').length,
      qualified: data.filter(a => a.result === 'qualified').length,
      unqualified: data.filter(a => a.result === 'unqualified').length
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await staffAPI.getAssessments({ pageSize: 100 });
      if (response?.success) {
        const data = response.data || [];
        setAssessments(data);
        updateStats(data);
      }
    } catch (_error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [updateStats]);

  // 获取员工和考官列表
  const fetchStaffAndExaminers = useCallback(async () => {
    try {
      const response = await userAPI.getUsers({ pageSize: 100, status: 'active' });
      const users = response?.data || Array.isArray(response) ? response : [];
      setStaffList(users);
      setExaminerList(users);
    } catch (_error) {
      console.error('获取用户列表失败');
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ status: 'planned', total_score: 100 });
    fetchStaffAndExaminers();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      assessment_date: record.assessment_date ? moment(record.assessment_date) : null
    });
    setModalVisible(true);
  };

  const handleView = (record) => {
    setViewingRecord(record);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await staffAPI.deleteAssessment(id);
      message.success('删除成功');
      fetchData();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const calculateResult = (score) => {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 60) return 'qualified';
    return 'unqualified';
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (values.assessment_date) {
        values.assessment_date = values.assessment_date.format('YYYY-MM-DD');
      }
      
      // 自动计算考核结果
      if (values.score !== undefined) {
        values.result = calculateResult(values.score);
      }
      
      if (editingRecord) {
        await staffAPI.updateAssessment(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await staffAPI.createAssessment(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (_error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '考核编号', dataIndex: 'assessment_code', key: 'assessment_code', width: 120 },
    { title: '员工姓名', dataIndex: 'staff_name', key: 'staff_name' },
    { 
      title: '考核类型', 
      dataIndex: 'assessment_type', 
      key: 'assessment_type',
      render: (v) => {
        const type = assessmentTypes.find(t => t.value === v);
        return <Tag color={type?.color}>{type?.label}</Tag>;
      }
    },
    { title: '考核日期', dataIndex: 'assessment_date', key: 'assessment_date' },
    { 
      title: '得分', 
      dataIndex: 'score', 
      key: 'score',
      render: (v) => (
        <Progress 
          percent={v} 
          size="small" 
          status={v >= 60 ? 'success' : 'exception'}
          style={{ width: 80 }}
        />
      ),
      sorter: (a, b) => a.score - b.score
    },
    { 
      title: '考核结果', 
      dataIndex: 'result', 
      key: 'result',
      render: (v) => {
        const result = resultOptions.find(r => r.value === v);
        return <Tag color={result?.color}>{result?.label}</Tag>;
      }
    },
    { title: '考官', dataIndex: 'examiner_name', key: 'examiner_name' },
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

  const passRate = stats.total > 0 ? Math.round(((stats.excellent + stats.good + stats.qualified) / stats.total) * 100) : 0;

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic title="考核总数" value={stats.total} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="优秀" value={stats.excellent} prefix={<TrophyOutlined />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="良好" value={stats.good} prefix={<StarOutlined />} styles={{ content: { color: '#1890ff' } }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="合格" value={stats.qualified} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="不合格" value={stats.unqualified} prefix={<WarningOutlined />} styles={{ content: { color: '#f5222d' } }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="考核通过率">
            <Progress 
              percent={passRate} 
              status={passRate >= 90 ? 'success' : passRate >= 70 ? 'normal' : 'exception'}
              strokeColor={passRate >= 90 ? '#52c41a' : passRate >= 70 ? '#1890ff' : '#f5222d'}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="考核结果分布">
            <Row gutter={16}>
              <Col span={6} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, color: '#52c41a', fontWeight: 'bold' }}>{stats.excellent}</div>
                <div>优秀</div>
              </Col>
              <Col span={6} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, color: '#1890ff', fontWeight: 'bold' }}>{stats.good}</div>
                <div>良好</div>
              </Col>
              <Col span={6} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, color: '#faad14', fontWeight: 'bold' }}>{stats.qualified}</div>
                <div>合格</div>
              </Col>
              <Col span={6} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, color: '#f5222d', fontWeight: 'bold' }}>{stats.unqualified}</div>
                <div>不合格</div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card
        title={<span><TrophyOutlined /> 能力考核管理</span>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增考核
          </Button>
        }
      >
        <Table 
          columns={columns} 
          dataSource={assessments} 
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑考核' : '新增考核'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="assessment_code" label="考核编号" rules={[{ required: true }]}>
                <Input placeholder="请输入考核编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="staff_id" label="选择员工" rules={[{ required: true }]}>
                <Select placeholder="请选择员工" showSearch optionFilterProp="label">
                  {staffList.map(staff => (
                    <Option key={staff.id} value={staff.id} label={staff.real_name || staff.username}>
                      {staff.real_name || staff.username} {staff.department ? `- ${staff.department}` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="assessment_type" label="考核类型" rules={[{ required: true }]}>
                <Select placeholder="请选择考核类型">
                  {assessmentTypes.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assessment_date" label="考核日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="total_score" label="满分分值" rules={[{ required: true }]}>
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="score" label="实际得分" rules={[{ required: true }]}>
                <InputNumber min={0} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="examiner_id" label="考官">
                <Select placeholder="请选择考官" showSearch allowClear optionFilterProp="label">
                  {examinerList.map(examiner => (
                    <Option key={examiner.id} value={examiner.id} label={examiner.real_name || examiner.username}>
                      {examiner.real_name || examiner.username} {examiner.role ? `- ${examiner.role}` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                <Select placeholder="请选择状态">
                  {statusOptions.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="assessment_items" label="考核项目">
            <TextArea rows={3} placeholder="请输入考核项目" />
          </Form.Item>
          
          <Form.Item name="feedback" label="考核反馈">
            <TextArea rows={3} placeholder="请输入考核反馈和建议" />
          </Form.Item>
          
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="考核详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[<Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>]}
        width={700}
      >
        {viewingRecord && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Result
                status={viewingRecord.result === 'unqualified' ? 'error' : 'success'}
                title={resultOptions.find(r => r.value === viewingRecord.result)?.label}
                subTitle={`得分：${viewingRecord.score} / ${viewingRecord.total_score || 100}`}
              />
            </div>
            
            <Descriptions bordered column={2}>
              <Descriptions.Item label="考核编号">{viewingRecord.assessment_code}</Descriptions.Item>
              <Descriptions.Item label="员工姓名">{viewingRecord.staff_name}</Descriptions.Item>
              <Descriptions.Item label="考核类型">
                <Tag color={assessmentTypes.find(t => t.value === viewingRecord.assessment_type)?.color}>
                  {assessmentTypes.find(t => t.value === viewingRecord.assessment_type)?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="考核日期">{viewingRecord.assessment_date}</Descriptions.Item>
              <Descriptions.Item label="考官">{viewingRecord.examiner_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Badge status={statusOptions.find(s => s.value === viewingRecord.status)?.color} text={statusOptions.find(s => s.value === viewingRecord.status)?.label} />
              </Descriptions.Item>
              <Descriptions.Item label="考核项目" span={2}>{viewingRecord.assessment_items || '-'}</Descriptions.Item>
              <Descriptions.Item label="考核反馈" span={2}>{viewingRecord.feedback || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{viewingRecord.remarks || '-'}</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>
    </div>
  );
};

export default CompetencyAssessment;
