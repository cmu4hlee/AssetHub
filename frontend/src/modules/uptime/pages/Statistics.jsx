/**
 * 开机率统计管理页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../../hooks';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  DatePicker, InputNumber, message, Popconfirm, Row, Col, Statistic,
  Badge, Progress, Alert, Descriptions, Empty
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, BarChartOutlined,
  CheckCircleOutlined, WarningOutlined, ClockCircleOutlined,
  DashboardOutlined, EyeOutlined
} from '@ant-design/icons';
import { uptimeAPI } from '../../../utils/api';
import useIsMobile from '../../../hooks/useIsMobile';
import dayjs from 'dayjs';

const { Option } = Select;
const UptimeStatistics = () => {
  const isMobile = useIsMobile();
  const canDelete = useCan('uptime', 'delete');
  const canEdit = useCan('uptime', 'edit');
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);

  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    excellent: 0,  // >= 99%
    good: 0,       // >= 95%
    warning: 0,    // >= 90%
    danger: 0      // < 90%
  });

  const statusOptions = [
    { value: 'normal', label: '正常', color: 'success' },
    { value: 'warning', label: '警告', color: 'warning' },
    { value: 'danger', label: '危险', color: 'error' }
  ];

  const updateStats = useCallback((data) => {
    setStats({
      total: data.length,
      excellent: data.filter(s => s.uptime_rate >= 99).length,
      good: data.filter(s => s.uptime_rate >= 95 && s.uptime_rate < 99).length,
      warning: data.filter(s => s.uptime_rate >= 90 && s.uptime_rate < 95).length,
      danger: data.filter(s => s.uptime_rate < 90).length
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await uptimeAPI.getStatistics({ pageSize: 100 });
      if (response?.success) {
        const data = response.data || [];
        setStatistics(data);
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
    form.setFieldsValue({ total_hours: 720, status: 'normal' });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      period: record.period ? dayjs(record.period) : null
    });
    setModalVisible(true);
  };

  const handleView = (record) => {
    setViewingRecord(record);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await uptimeAPI.deleteUptime(id);
      message.success('删除成功');
      fetchData();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (values.period) {
        values.period = values.period.format('YYYY-MM');
      }

      // 计算开机率
      if (values.total_hours && values.running_hours) {
        values.uptime_rate = (values.running_hours / values.total_hours * 100).toFixed(2);

        // 自动判断状态
        if (values.uptime_rate >= 99) values.status = 'normal';
        else if (values.uptime_rate >= 90) values.status = 'warning';
        else values.status = 'danger';
      }

      if (editingRecord) {
        await uptimeAPI.updateUptime(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await uptimeAPI.createUptime(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (_error) {
      message.error('操作失败');
    }
  };

  const getUptimeColor = (rate) => {
    if (rate >= 99) return '#52c41a';
    if (rate >= 95) return '#1890ff';
    if (rate >= 90) return '#faad14';
    return '#f5222d';
  };

  const columns = [
    { title: '统计周期', dataIndex: 'period', key: 'period' },
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code' },
    { title: '资产名称', dataIndex: 'asset_name', key: 'asset_name' },
    { title: '所属科室', dataIndex: 'department', key: 'department' },
    {
      title: '应运行时长',
      dataIndex: 'total_hours',
      key: 'total_hours',
      render: (v) => `${v}小时`
    },
    {
      title: '实际运行时长',
      dataIndex: 'running_hours',
      key: 'running_hours',
      render: (v) => `${v}小时`
    },
    {
      title: '开机率',
      dataIndex: 'uptime_rate',
      key: 'uptime_rate',
      render: (v) => (
        <Progress
          percent={parseFloat(v).toFixed(1)}
          size="small"
          strokeColor={getUptimeColor(v)}
          style={{ width: 100 }}
        />
      ),
      sorter: (a, b) => a.uptime_rate - b.uptime_rate
    },
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

  const avgUptime = statistics.length > 0
    ? (statistics.reduce((sum, s) => sum + parseFloat(s.uptime_rate || 0), 0) / statistics.length).toFixed(2)
    : 0;

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={4}>
          <Card>
            <Statistic title="统计总数" value={stats.total} prefix={<BarChartOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={5}>
          <Card>
            <Statistic title="优秀(≥99%)" value={stats.excellent} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={5}>
          <Card>
            <Statistic title="良好(≥95%)" value={stats.good} prefix={<DashboardOutlined />} styles={{ content: { color: '#1890ff' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={5}>
          <Card>
            <Statistic title="警告(≥90%)" value={stats.warning} prefix={<WarningOutlined />} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={5}>
          <Card>
            <Statistic title="危险(<90%)" value={stats.danger} prefix={<ClockCircleOutlined />} styles={{ content: { color: '#f5222d' } }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="平均开机率">
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={avgUptime}
                size={120}
                strokeColor={getUptimeColor(avgUptime)}
                format={(percent) => <span style={{ fontSize: 24 }}>{percent}%</span>}
              />
              <div style={{ marginTop: 16, fontSize: 16, color: '#8c8c8c' }}>
                整体设备运行状态：
                <Tag color={getUptimeColor(avgUptime)}>
                  {avgUptime >= 99 ? '优秀' : avgUptime >= 95 ? '良好' : avgUptime >= 90 ? '警告' : '危险'}
                </Tag>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="状态分布">
            <Row gutter={16} style={{ marginTop: 24 }}>
              <Col xs={12} sm={6} style={{ textAlign: 'center' }}>
                <Progress type="dashboard" percent={stats.total > 0 ? (stats.excellent / stats.total * 100) : 0} size={80} strokeColor="#52c41a" />
                <div>优秀</div>
              </Col>
              <Col xs={12} sm={6} style={{ textAlign: 'center' }}>
                <Progress type="dashboard" percent={stats.total > 0 ? (stats.good / stats.total * 100) : 0} size={80} strokeColor="#1890ff" />
                <div>良好</div>
              </Col>
              <Col xs={12} sm={6} style={{ textAlign: 'center' }}>
                <Progress type="dashboard" percent={stats.total > 0 ? (stats.warning / stats.total * 100) : 0} size={80} strokeColor="#faad14" />
                <div>警告</div>
              </Col>
              <Col xs={12} sm={6} style={{ textAlign: 'center' }}>
                <Progress type="dashboard" percent={stats.total > 0 ? (stats.danger / stats.total * 100) : 0} size={80} strokeColor="#f5222d" />
                <div>危险</div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {stats.danger > 0 && (
        <Alert
          message={`警告：有 ${stats.danger} 台设备开机率低于90%，请关注设备运行状态！`}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card
        title={<span><BarChartOutlined /> 开机率统计</span>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} block={isMobile}>
            新增统计
          </Button>
        }
      >
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={statistics}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(statistics) && statistics.length > 0 ? (
            statistics.map(record => {
              const status = statusOptions.find(s => s.value === record.status);
              return (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{record.asset_name}</span>
                    <Tag color={status?.color}>{status?.label}</Tag>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">统计周期</span>
                      <span className="mobile-card-value">{record.period}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">资产编号</span>
                      <span className="mobile-card-value">{record.asset_code}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">所属科室</span>
                      <span className="mobile-card-value">{record.department || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">应运行时长</span>
                      <span className="mobile-card-value">{record.total_hours}小时</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">实际运行时长</span>
                      <span className="mobile-card-value">{record.running_hours}小时</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">开机率</span>
                      <span className="mobile-card-value">
                        <Progress
                          percent={parseFloat(record.uptime_rate).toFixed(1)}
                          size="small"
                          strokeColor={getUptimeColor(record.uptime_rate)}
                        />
                      </span>
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

      {/* 编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑统计' : '新增统计'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={isMobile ? '95vw' : 700}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="asset_id" label="选择资产" rules={[{ required: true }]}>
                <Select placeholder="请选择资产" showSearch>
                  {/* 这里应该从API加载资产列表 */}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="period" label="统计周期" rules={[{ required: true }]}>
                <DatePicker picker="month" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="total_hours" label="应运行时长(小时)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="running_hours" label="实际运行时长(小时)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="downtime_reasons" label="停机原因">
            <Input placeholder="请输入停机原因" />
          </Form.Item>

          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select placeholder="请选择状态">
              {statusOptions.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
            </Select>
          </Form.Item>

          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="统计详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[<Button key="close" onClick={() => setDetailModalVisible(false)} block={isMobile}>关闭</Button>]}
        width={isMobile ? '95vw' : 600}
      >
        {viewingRecord && (
          <Descriptions bordered column={isMobile ? 1 : 2}>
            <Descriptions.Item label="统计周期">{viewingRecord.period}</Descriptions.Item>
            <Descriptions.Item label="资产编号">{viewingRecord.asset_code}</Descriptions.Item>
            <Descriptions.Item label="资产名称">{viewingRecord.asset_name}</Descriptions.Item>
            <Descriptions.Item label="所属科室">{viewingRecord.department || '-'}</Descriptions.Item>
            <Descriptions.Item label="应运行时长">{viewingRecord.total_hours}小时</Descriptions.Item>
            <Descriptions.Item label="实际运行时长">{viewingRecord.running_hours}小时</Descriptions.Item>
            <Descriptions.Item label="开机率" span={2}>
              <Progress percent={parseFloat(viewingRecord.uptime_rate).toFixed(1)} strokeColor={getUptimeColor(viewingRecord.uptime_rate)} />
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Badge status={statusOptions.find(s => s.value === viewingRecord.status)?.color} text={statusOptions.find(s => s.value === viewingRecord.status)?.label} />
            </Descriptions.Item>
            <Descriptions.Item label="停机原因">{viewingRecord.downtime_reasons || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{viewingRecord.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default UptimeStatistics;
