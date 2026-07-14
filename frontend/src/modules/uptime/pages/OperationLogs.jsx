/**
 * 运行日志管理页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../../hooks';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  DatePicker, TimePicker, message, Popconfirm, Row, Col, Statistic,
  Badge, Timeline, Descriptions, Tabs, Calendar, Empty
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, HistoryOutlined,
  WarningOutlined, PlayCircleOutlined,
  PauseCircleOutlined, ToolOutlined, FileTextOutlined, EyeOutlined,
  CalendarOutlined, ClockCircleOutlined, PoweroffOutlined
} from '@ant-design/icons';
import { uptimeAPI } from '../../../utils/api';
import useIsMobile from '../../../hooks/useIsMobile';
import dayjs from 'dayjs';

const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

const OperationLogManagement = () => {
  const isMobile = useIsMobile();
  const canDelete = useCan('uptime', 'delete');
  const canEdit = useCan('uptime', 'edit');
  const [activeTab, setActiveTab] = useState('logs');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);

  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    running: 0,
    stopped: 0,
    maintenance: 0,
    fault: 0
  });

  const operationTypes = [
    { value: 'startup', label: '开机', color: 'green', icon: <PoweroffOutlined /> },
    { value: 'shutdown', label: '关机', color: 'red', icon: <PoweroffOutlined /> },
    { value: 'maintenance', label: '维护', color: 'blue', icon: <ToolOutlined /> },
    { value: 'fault', label: '故障', color: 'orange', icon: <WarningOutlined /> },
    { value: 'repair', label: '维修', color: 'purple', icon: <ToolOutlined /> },
    { value: 'inspection', label: '巡检', color: 'cyan', icon: <FileTextOutlined /> }
  ];

  const statusOptions = [
    { value: 'running', label: '运行中', color: 'success' },
    { value: 'stopped', label: '已停机', color: 'default' },
    { value: 'maintenance', label: '维护中', color: 'processing' },
    { value: 'fault', label: '故障', color: 'error' }
  ];

  const updateStats = useCallback((data) => {
    setStats({
      total: data.length,
      running: data.filter(l => l.status === 'running').length,
      stopped: data.filter(l => l.status === 'stopped').length,
      maintenance: data.filter(l => l.status === 'maintenance').length,
      fault: data.filter(l => l.status === 'fault').length
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await uptimeAPI.getOperationLogs({ pageSize: 100 });
      if (response?.success) {
        const data = response.data || [];
        setLogs(data);
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
      operation_date: dayjs(),
      operation_time: dayjs(),
      status: 'running'
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      operation_date: record.operation_date ? dayjs(record.operation_date) : null,
      operation_time: record.operation_time ? dayjs(record.operation_time, 'HH:mm:ss') : null
    });
    setModalVisible(true);
  };

  const handleView = (record) => {
    setViewingRecord(record);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await uptimeAPI.deleteOperationLog(id);
      message.success('删除成功');
      fetchData();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (values.operation_date) {
        values.operation_date = values.operation_date.format('YYYY-MM-DD');
      }
      if (values.operation_time) {
        values.operation_time = values.operation_time.format('HH:mm:ss');
      }

      if (editingRecord) {
        await uptimeAPI.updateOperationLog(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await uptimeAPI.createOperationLog(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (_error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '日志编号', dataIndex: 'log_code', key: 'log_code', width: 120 },
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code' },
    { title: '资产名称', dataIndex: 'asset_name', key: 'asset_name' },
    {
      title: '操作类型',
      dataIndex: 'operation_type',
      key: 'operation_type',
      render: (v) => {
        const type = operationTypes.find(t => t.value === v);
        return <Tag color={type?.color} icon={type?.icon}>{type?.label}</Tag>;
      }
    },
    { title: '操作日期', dataIndex: 'operation_date', key: 'operation_date' },
    { title: '操作时间', dataIndex: 'operation_time', key: 'operation_time' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v) => {
        const status = statusOptions.find(s => s.value === v);
        return <Badge status={status?.color} text={status?.label} />;
      }
    },
    { title: '操作人', dataIndex: 'operator_name', key: 'operator_name' },
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

  const dateCellRender = (value) => {
    const dateStr = value.format('YYYY-MM-DD');
    const dayLogs = logs.filter(l => l.operation_date === dateStr);

    if (dayLogs.length === 0) return null;

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {dayLogs.slice(0, 3).map((log, index) => (
          <li key={index}>
            <Badge
              status={statusOptions.find(s => s.value === log.status)?.color}
              text={<span style={{ fontSize: 12 }}>{log.asset_name}</span>}
            />
          </li>
        ))}
        {dayLogs.length > 3 && <li style={{ fontSize: 12, color: '#999' }}>+{dayLogs.length - 3} more</li>}
      </ul>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={4}>
          <Card>
            <Statistic title="日志总数" value={stats.total} prefix={<HistoryOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={5}>
          <Card>
            <Statistic title="运行中" value={stats.running} prefix={<PlayCircleOutlined />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={5}>
          <Card>
            <Statistic title="已停机" value={stats.stopped} prefix={<PauseCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={5}>
          <Card>
            <Statistic title="维护中" value={stats.maintenance} prefix={<ToolOutlined />} styles={{ content: { color: '#1890ff' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={5}>
          <Card>
            <Statistic title="故障" value={stats.fault} prefix={<WarningOutlined />} styles={{ content: { color: '#f5222d' } }} />
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab={<span><HistoryOutlined /> 运行日志</span>} key="logs">
          <Card
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} block={isMobile}>
                新增日志
              </Button>
            }
          >
            <div className="hide-on-mobile">
              <Table
                columns={columns}
                dataSource={logs}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            </div>
            <div className="mobile-table-cards show-on-mobile">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
              ) : Array.isArray(logs) && logs.length > 0 ? (
                logs.map(record => {
                  const type = operationTypes.find(t => t.value === record.operation_type);
                  const status = statusOptions.find(s => s.value === record.status);
                  return (
                    <div key={record.id} className="mobile-card-item">
                      <div className="mobile-card-header">
                        <span className="mobile-card-title">{record.asset_name}</span>
                        <Tag color={type?.color} icon={type?.icon}>{type?.label}</Tag>
                      </div>
                      <div className="mobile-card-body">
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">日志编号</span>
                          <span className="mobile-card-value">{record.log_code}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">资产编号</span>
                          <span className="mobile-card-value">{record.asset_code}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">操作日期</span>
                          <span className="mobile-card-value">{record.operation_date} {record.operation_time}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">设备状态</span>
                          <span className="mobile-card-value"><Badge status={status?.color} text={status?.label} /></span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">操作人</span>
                          <span className="mobile-card-value">{record.operator_name || '-'}</span>
                        </div>
                      </div>
                      <div className="mobile-card-actions">
                        <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>详情</Button>
                        <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
                        <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
                          <Button type="primary" danger size="small" icon={<DeleteOutlined />}>删除</Button>
                        </Popconfirm>
                      </div>
                    </div>
                  );
                })
              ) : (
                <Empty description="暂无数据" />
              )}
            </div>
          </Card>
        </TabPane>

        <TabPane tab={<span><CalendarOutlined /> 日历视图</span>} key="calendar">
          <Card>
            <Calendar
              dateCellRender={dateCellRender}
            />
          </Card>
        </TabPane>

        <TabPane tab={<span><ClockCircleOutlined /> 时间轴</span>} key="timeline">
          <Card title="近期运行记录">
            <Timeline mode="left">
              {logs.slice(0, 20).map((log, index) => {
                const type = operationTypes.find(t => t.value === log.operation_type);
                return (
                  <Timeline.Item
                    key={index}
                    label={`${log.operation_date} ${log.operation_time}`}
                    color={type?.color}
                  >
                    <p><strong>{log.asset_name}</strong> - {type?.label}</p>
                    <p style={{ color: '#8c8c8c' }}>{log.remarks || '无备注'}</p>
                  </Timeline.Item>
                );
              })}
            </Timeline>
          </Card>
        </TabPane>
      </Tabs>

      {/* 编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑日志' : '新增日志'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={isMobile ? '95vw' : 700}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="log_code" label="日志编号" rules={[{ required: true }]}>
                <Input placeholder="请输入日志编号" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="asset_id" label="选择资产" rules={[{ required: true }]}>
                <Select placeholder="请选择资产" showSearch>
                  {/* 这里应该从API加载资产列表 */}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="operation_type" label="操作类型" rules={[{ required: true }]}>
                <Select placeholder="请选择操作类型">
                  {operationTypes.map(t => <Option key={t.value} value={t.value}>{t.icon} {t.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="status" label="设备状态" rules={[{ required: true }]}>
                <Select placeholder="请选择设备状态">
                  {statusOptions.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="operation_date" label="操作日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="operation_time" label="操作时间" rules={[{ required: true }]}>
                <TimePicker style={{ width: '100%' }} format="HH:mm:ss" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="operator_id" label="操作人">
            <Select placeholder="请选择操作人" showSearch>
              {/* 这里应该从API加载人员列表 */}
            </Select>
          </Form.Item>

          <Form.Item name="remarks" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="日志详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[<Button key="close" onClick={() => setDetailModalVisible(false)} block={isMobile}>关闭</Button>]}
        width={isMobile ? '95vw' : 600}
      >
        {viewingRecord && (
          <Descriptions bordered column={isMobile ? 1 : 2}>
            <Descriptions.Item label="日志编号">{viewingRecord.log_code}</Descriptions.Item>
            <Descriptions.Item label="资产编号">{viewingRecord.asset_code}</Descriptions.Item>
            <Descriptions.Item label="资产名称">{viewingRecord.asset_name}</Descriptions.Item>
            <Descriptions.Item label="操作类型">
              <Tag color={operationTypes.find(t => t.value === viewingRecord.operation_type)?.color}>
                {operationTypes.find(t => t.value === viewingRecord.operation_type)?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="操作日期">{viewingRecord.operation_date}</Descriptions.Item>
            <Descriptions.Item label="操作时间">{viewingRecord.operation_time}</Descriptions.Item>
            <Descriptions.Item label="设备状态">
              <Badge status={statusOptions.find(s => s.value === viewingRecord.status)?.color} text={statusOptions.find(s => s.value === viewingRecord.status)?.label} />
            </Descriptions.Item>
            <Descriptions.Item label="操作人">{viewingRecord.operator_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{viewingRecord.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default OperationLogManagement;
