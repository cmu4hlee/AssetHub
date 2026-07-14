/**
 * 风险控制管理页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../../hooks';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  DatePicker, Badge, message, Popconfirm, Row, Col, Statistic,
  Progress, Descriptions, Divider, Steps, Slider, Empty
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined,
  CheckCircleOutlined, ClockCircleOutlined,
  PlayCircleOutlined, PauseCircleOutlined, EyeOutlined
} from '@ant-design/icons';
import { riskAPI } from '../../../utils/api';
import useIsMobile from '../../../hooks/useIsMobile';
import dayjs from 'dayjs';

const { Option } = Select;
const { Step } = Steps;
const { TextArea } = Input;

const RiskControl = () => {
  const isMobile = useIsMobile();
  const canDelete = useCan('risk', 'delete');
  const canEdit = useCan('risk', 'edit');
  const [loading, setLoading] = useState(false);
  const [controls, setControls] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [mobilePage, setMobilePage] = useState(1);

  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    planned: 0,
    inProgress: 0,
    completed: 0
  });

  const controlTypes = [
    { value: 'preventive', label: '预防措施', color: 'blue' },
    { value: 'corrective', label: '纠正措施', color: 'orange' },
    { value: 'mitigation', label: '缓解措施', color: 'green' },
    { value: 'emergency', label: '应急措施', color: 'red' }
  ];

  const controlStatus = [
    { value: 'planned', label: '计划中', color: 'default', icon: <ClockCircleOutlined /> },
    { value: 'in_progress', label: '执行中', color: 'processing', icon: <PlayCircleOutlined /> },
    { value: 'completed', label: '已完成', color: 'success', icon: <CheckCircleOutlined /> },
    { value: 'suspended', label: '已暂停', color: 'warning', icon: <PauseCircleOutlined /> }
  ];

  const riskLevels = [
    { value: 'high', label: '高风险', color: 'red' },
    { value: 'medium', label: '中风险', color: 'orange' },
    { value: 'low', label: '低风险', color: 'green' }
  ];

  const updateStats = useCallback((data) => {
    setStats({
      total: data.length,
      planned: data.filter(c => c.status === 'planned').length,
      inProgress: data.filter(c => c.status === 'in_progress').length,
      completed: data.filter(c => c.status === 'completed').length
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await riskAPI.getRiskControls({ pageSize: 100 });
      if (response?.success) {
        const data = response.data || [];
        setControls(data);
        updateStats(data);
      }
    } catch (_error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [updateStats]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'planned',
      progress: 0
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      planned_start_date: record.planned_start_date ? dayjs(record.planned_start_date) : null,
      planned_end_date: record.planned_end_date ? dayjs(record.planned_end_date) : null,
      actual_start_date: record.actual_start_date ? dayjs(record.actual_start_date) : null,
      actual_end_date: record.actual_end_date ? dayjs(record.actual_end_date) : null
    });
    setModalVisible(true);
  };

  const handleView = (record) => {
    setViewingRecord(record);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await riskAPI.deleteRiskControl(id);
      message.success('删除成功');
      fetchData();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 转换日期格式
      ['planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date'].forEach(field => {
        if (values[field]) {
          values[field] = values[field].format('YYYY-MM-DD');
        }
      });

      if (editingRecord) {
        await riskAPI.updateRiskControl(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await riskAPI.createRiskControl(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (_error) {
      message.error('操作失败');
    }
  };

  const getStatusInfo = (status) => {
    return controlStatus.find(s => s.value === status) || { label: status, color: 'default' };
  };

  const columns = [
    { title: '控制编号', dataIndex: 'control_code', key: 'control_code', width: 120 },
    { title: '措施名称', dataIndex: 'control_name', key: 'control_name' },
    {
      title: '措施类型',
      dataIndex: 'control_type',
      key: 'control_type',
      render: (v) => {
        const type = controlTypes.find(t => t.value === v);
        return <Tag color={type?.color}>{type?.label}</Tag>;
      }
    },
    {
      title: '针对风险',
      dataIndex: 'risk_level',
      key: 'risk_level',
      render: (v) => {
        const level = riskLevels.find(l => l.value === v);
        return <Tag color={level?.color}>{level?.label}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v) => {
        const status = getStatusInfo(v);
        return <Badge status={status?.color} text={status?.label} />;
      }
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (v) => (
        <Progress percent={v} size="small" style={{ width: 80 }} />
      )
    },
    { title: '负责人', dataIndex: 'responsible_person', key: 'responsible_person' },
    { title: '计划完成', dataIndex: 'planned_end_date', key: 'planned_end_date' },
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
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="控制措施总数" value={stats.total} prefix={<SafetyOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="计划中" value={stats.planned} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="执行中" value={stats.inProgress} prefix={<PlayCircleOutlined />} styles={{ content: { color: '#1890ff' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="已完成" value={stats.completed} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
      </Row>

      <Card
        title={<span><SafetyOutlined /> 风险控制措施</span>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} block={isMobile}>
            新增措施
          </Button>
        }
      >
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={controls}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(controls) && controls.length > 0 ? (
            <>
              {controls.slice((mobilePage - 1) * 10, mobilePage * 10).map(record => {
                const status = getStatusInfo(record.status);
                const type = controlTypes.find(t => t.value === record.control_type);
                const level = riskLevels.find(l => l.value === record.risk_level);
                return (
                  <div key={record.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{record.control_name || '-'}</span>
                      <Badge status={status?.color} text={status?.label} />
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">控制编号</span>
                        <span className="mobile-card-value">{record.control_code || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">措施类型</span>
                        <span className="mobile-card-value">{type ? <Tag color={type.color}>{type.label}</Tag> : '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">针对风险</span>
                        <span className="mobile-card-value">{level ? <Tag color={level.color}>{level.label}</Tag> : '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">进度</span>
                        <span className="mobile-card-value"><Progress percent={record.progress || 0} size="small" /></span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">负责人</span>
                        <span className="mobile-card-value">{record.responsible_person || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">计划完成</span>
                        <span className="mobile-card-value">{record.planned_end_date || '-'}</span>
                      </div>
                    </div>
                    <div className="mobile-card-actions">
                      <Button type="primary" size="small" block icon={<EyeOutlined />} onClick={() => handleView(record)}>详情</Button>
                      <Button size="small" block icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
                      <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
                        <Button type="primary" danger size="small" block icon={<DeleteOutlined />}>删除</Button>
                      </Popconfirm>
                    </div>
                  </div>
                );
              })}
              {/* 移动端分页 */}
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Space>
                  <Button disabled={mobilePage === 1} onClick={() => setMobilePage(p => p - 1)}>上一页</Button>
                  <span>第 {mobilePage} / {Math.ceil(controls.length / 10) || 1} 页</span>
                  <Button disabled={mobilePage >= Math.ceil(controls.length / 10)} onClick={() => setMobilePage(p => p + 1)}>下一页</Button>
                </Space>
              </div>
            </>
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑控制措施' : '新增控制措施'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={isMobile ? '95vw' : 800}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="control_code" label="控制编号" rules={[{ required: true }]}>
                <Input placeholder="请输入控制编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="control_name" label="措施名称" rules={[{ required: true }]}>
                <Input placeholder="请输入措施名称" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="control_type" label="措施类型" rules={[{ required: true }]}>
                <Select placeholder="请选择措施类型">
                  {controlTypes.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="risk_level" label="针对风险等级" rules={[{ required: true }]}>
                <Select placeholder="请选择风险等级">
                  {riskLevels.map(l => <Option key={l.value} value={l.value}>{l.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="control_description" label="控制措施描述" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="请详细描述控制措施内容" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="planned_start_date" label="计划开始日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="planned_end_date" label="计划完成日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="actual_start_date" label="实际开始日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="actual_end_date" label="实际完成日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="responsible_person" label="负责人">
                <Input placeholder="请输入负责人" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                <Select placeholder="请选择状态">
                  {controlStatus.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="progress" label="进度(%)" rules={[{ required: true }]}>
            <Slider min={0} max={100} marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
          </Form.Item>

          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="控制措施详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[<Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>]}
        width={isMobile ? '95vw' : 700}
      >
        {viewingRecord && (
          <>
            <Steps current={controlStatus.findIndex(s => s.value === viewingRecord.status)} size="small">
              {controlStatus.map(s => (
                <Step key={s.value} title={s.label} icon={s.icon} />
              ))}
            </Steps>

            <Divider />

            <Descriptions bordered column={2}>
              <Descriptions.Item label="控制编号">{viewingRecord.control_code}</Descriptions.Item>
              <Descriptions.Item label="措施名称">{viewingRecord.control_name}</Descriptions.Item>
              <Descriptions.Item label="措施类型">
                <Tag color={controlTypes.find(t => t.value === viewingRecord.control_type)?.color}>
                  {controlTypes.find(t => t.value === viewingRecord.control_type)?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="针对风险">
                <Tag color={riskLevels.find(l => l.value === viewingRecord.risk_level)?.color}>
                  {riskLevels.find(l => l.value === viewingRecord.risk_level)?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="负责人">{viewingRecord.responsible_person || '-'}</Descriptions.Item>
              <Descriptions.Item label="当前进度">
                <Progress percent={viewingRecord.progress} size="small" style={{ width: 100 }} />
              </Descriptions.Item>
              <Descriptions.Item label="计划开始">{viewingRecord.planned_start_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="计划完成">{viewingRecord.planned_end_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="实际开始">{viewingRecord.actual_start_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="实际完成">{viewingRecord.actual_end_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="控制描述" span={2}>{viewingRecord.control_description || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{viewingRecord.remarks || '-'}</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>
    </div>
  );
};

export default RiskControl;
