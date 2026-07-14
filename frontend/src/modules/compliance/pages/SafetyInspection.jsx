/**
 * 安全检测管理页面
 * 电气安全、辐射安全、机械安全等检测管理
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../../hooks';
import { 
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select, 
  DatePicker, message, Popconfirm, Row, Col, Statistic,
  Badge, Descriptions, Alert, Progress
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined,
  ThunderboltOutlined, RadiusUpleftOutlined, ToolOutlined,
  CheckCircleOutlined, WarningOutlined, EyeOutlined
} from '@ant-design/icons';
import { complianceAPI } from '../../../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const SafetyInspectionManagement = () => {
  const canDelete = useCan('compliance', 'delete');
  const canEdit = useCan('compliance', 'edit');
  const [loading, setLoading] = useState(false);
  
  // 检测记录相关状态
  const [inspections, setInspections] = useState([]);
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false);
  const [inspectionForm] = Form.useForm();
  const [editingInspection, setEditingInspection] = useState(null);
  const [viewingInspection, setViewingInspection] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  
  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    pass: 0,
    conditional: 0,
    fail: 0,
    expiring: 0
  });

  const inspectionTypes = [
    { value: 'electrical', label: '电气安全检测', icon: <ThunderboltOutlined />, color: '#faad14' },
    { value: 'radiation', label: '辐射安全检测', icon: <RadiusUpleftOutlined />, color: '#722ed1' },
    { value: 'mechanical', label: '机械安全检测', icon: <ToolOutlined />, color: '#13c2c2' },
    { value: 'chemical', label: '化学安全检测', icon: <SafetyOutlined />, color: '#eb2f96' },
    { value: 'biological', label: '生物安全检测', icon: <SafetyOutlined />, color: '#52c41a' },
    { value: 'other', label: '其他安全检测', icon: <SafetyOutlined />, color: '#8c8c8c' }
  ];

  const resultOptions = [
    { value: 'pass', label: '合格', color: 'success', badge: 'success' },
    { value: 'conditional', label: '有条件合格', color: 'warning', badge: 'warning' },
    { value: 'fail', label: '不合格', color: 'error', badge: 'error' }
  ];

  const statusOptions = [
    { value: 'normal', label: '正常', color: 'green' },
    { value: 'expiring', label: '即将过期', color: 'orange' },
    { value: 'expired', label: '已过期', color: 'red' }
  ];

  const updateStats = useCallback((data) => {
    const now = dayjs();
    setStats({
      total: data.length,
      pass: data.filter(i => i.inspection_result === 'pass').length,
      conditional: data.filter(i => i.inspection_result === 'conditional').length,
      fail: data.filter(i => i.inspection_result === 'fail').length,
      expiring: data.filter(i => {
        if (!i.next_inspection_date) return false;
        const days = dayjs(i.next_inspection_date).diff(now, 'days');
        return days >= 0 && days <= 30;
      }).length
    });
  }, []);

  const fetchInspections = useCallback(async () => {
    setLoading(true);
    try {
      const response = await complianceAPI.getSafetyInspections({ pageSize: 100 });
      if (response?.success) {
        const data = response.data || [];
        setInspections(data);
        updateStats(data);
      }
    } catch (_error) {
      message.error('加载检测记录失败');
    } finally {
      setLoading(false);
    }
  }, [updateStats]);

  useEffect(() => {
    void fetchInspections();
  }, [fetchInspections]);

  // 检测记录管理功能
  const handleAddInspection = () => {
    setEditingInspection(null);
    inspectionForm.resetFields();
    inspectionForm.setFieldsValue({
      inspection_result: 'pass',
      status: 'normal'
    });
    setInspectionModalVisible(true);
  };

  const handleEditInspection = (record) => {
    setEditingInspection(record);
    inspectionForm.setFieldsValue({
      ...record,
      inspection_date: record.inspection_date ? dayjs(record.inspection_date) : null,
      next_inspection_date: record.next_inspection_date ? dayjs(record.next_inspection_date) : null
    });
    setInspectionModalVisible(true);
  };

  const handleViewDetail = (record) => {
    setViewingInspection(record);
    setDetailModalVisible(true);
  };

  const handleDeleteInspection = async (id) => {
    try {
      await complianceAPI.deleteSafetyInspection(id);
      message.success('删除成功');
      fetchInspections();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handleInspectionSubmit = async () => {
    try {
      const values = await inspectionForm.validateFields();
      if (values.inspection_date) {
        values.inspection_date = values.inspection_date.format('YYYY-MM-DD');
      }
      if (values.next_inspection_date) {
        values.next_inspection_date = values.next_inspection_date.format('YYYY-MM-DD');
      }
      
      if (editingInspection) {
        await complianceAPI.updateSafetyInspection(editingInspection.id, values);
        message.success('更新成功');
      } else {
        await complianceAPI.createSafetyInspection(values);
        message.success('创建成功');
      }
      setInspectionModalVisible(false);
      fetchInspections();
    } catch (_error) {
      message.error('操作失败');
    }
  };

  const getColumns = () => [
    { title: '检测编号', dataIndex: 'inspection_code', key: 'inspection_code', width: 120 },
    { title: '检测名称', dataIndex: 'inspection_name', key: 'inspection_name' },
    { 
      title: '检测类型', 
      dataIndex: 'inspection_type', 
      key: 'inspection_type',
      render: (v) => {
        const type = inspectionTypes.find(t => t.value === v);
        return type ? (
          <Tag icon={type.icon} color={type.color}>{type.label}</Tag>
        ) : v;
      }
    },
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code' },
    { title: '资产名称', dataIndex: 'asset_name', key: 'asset_name' },
    { title: '检测日期', dataIndex: 'inspection_date', key: 'inspection_date' },
    { 
      title: '检测结果', 
      dataIndex: 'inspection_result', 
      key: 'inspection_result',
      render: (v) => {
        const result = resultOptions.find(r => r.value === v);
        return <Badge status={result?.badge} text={result?.label} />;
      }
    },
    { 
      title: '下次检测', 
      dataIndex: 'next_inspection_date', 
      key: 'next_inspection_date',
      render: (v) => {
        if (!v) return '-';
        const days = dayjs(v).diff(dayjs(), 'days');
        if (days < 0) return <Tag color="red">{v} (已过期)</Tag>;
        if (days < 30) return <Tag color="orange">{v} (剩{days}天)</Tag>;
        return v;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>查看</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditInspection(record)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDeleteInspection(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const passRate = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0;

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic title="检测总数" value={stats.total} prefix={<SafetyOutlined />} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="合格" value={stats.pass} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="有条件合格" value={stats.conditional} prefix={<WarningOutlined />} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="不合格" value={stats.fail} prefix={<WarningOutlined />} styles={{ content: { color: '#f5222d' } }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: '#8c8c8c', marginBottom: 8 }}>合格率</div>
              <Progress type="circle" percent={passRate} size={60} status={passRate >= 90 ? 'success' : passRate >= 70 ? 'normal' : 'exception'} />
            </div>
          </Card>
        </Col>
      </Row>

      {stats.expiring > 0 && (
        <Alert
          message={`提醒：有 ${stats.expiring} 项检测即将到期，请提前安排复检！`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {stats.fail > 0 && (
        <Alert
          message={`警告：有 ${stats.fail} 项检测不合格，请立即整改！`}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card
        title={<span><SafetyOutlined /> 安全检测管理</span>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddInspection}>
            新增检测
          </Button>
        }
      >
        <Table 
          columns={getColumns()} 
          dataSource={inspections} 
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 检测记录编辑弹窗 */}
      <Modal
        title={editingInspection ? '编辑安全检测' : '新增安全检测'}
        open={inspectionModalVisible}
        onOk={handleInspectionSubmit}
        onCancel={() => setInspectionModalVisible(false)}
        width={800}
      >
        <Form form={inspectionForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="inspection_code" label="检测编号" rules={[{ required: true }]}>
                <Input placeholder="请输入检测编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inspection_name" label="检测名称" rules={[{ required: true }]}>
                <Input placeholder="请输入检测名称" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="inspection_type" label="检测类型" rules={[{ required: true }]}>
                <Select placeholder="请选择检测类型">
                  {inspectionTypes.map(t => (
                    <Option key={t.value} value={t.value}>{t.icon} {t.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="asset_id" label="选择资产" rules={[{ required: true }]}>
                <Select placeholder="请选择资产" showSearch>
                  {/* 这里应该从API加载资产列表 */}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="inspection_date" label="检测日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="next_inspection_date" label="下次检测日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="inspection_org" label="检测机构">
                <Input placeholder="请输入检测机构" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inspector_name" label="检测人员">
                <Input placeholder="请输入检测人员" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="inspection_result" label="检测结果" rules={[{ required: true }]}>
                <Select placeholder="请选择检测结果">
                  {resultOptions.map(r => <Option key={r.value} value={r.value}>{r.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态">
                <Select placeholder="请选择状态">
                  {statusOptions.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="inspection_items" label="检测项目">
            <TextArea rows={3} placeholder="请输入检测项目，每行一个" />
          </Form.Item>
          
          <Form.Item name="inspection_data" label="检测数据">
            <TextArea rows={2} placeholder="请输入检测数据" />
          </Form.Item>
          
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情查看弹窗 */}
      <Modal
        title="检测详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>
        ]}
        width={700}
      >
        {viewingInspection && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="检测编号">{viewingInspection.inspection_code}</Descriptions.Item>
            <Descriptions.Item label="检测名称">{viewingInspection.inspection_name}</Descriptions.Item>
            <Descriptions.Item label="检测类型">
              {inspectionTypes.find(t => t.value === viewingInspection.inspection_type)?.label}
            </Descriptions.Item>
            <Descriptions.Item label="资产名称">{viewingInspection.asset_name}</Descriptions.Item>
            <Descriptions.Item label="检测日期">{viewingInspection.inspection_date}</Descriptions.Item>
            <Descriptions.Item label="下次检测">{viewingInspection.next_inspection_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="检测机构">{viewingInspection.inspection_org || '-'}</Descriptions.Item>
            <Descriptions.Item label="检测人员">{viewingInspection.inspector_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="检测结果" span={2}>
              <Badge 
                status={resultOptions.find(r => r.value === viewingInspection.inspection_result)?.badge} 
                text={resultOptions.find(r => r.value === viewingInspection.inspection_result)?.label} 
              />
            </Descriptions.Item>
            <Descriptions.Item label="检测项目" span={2}>{viewingInspection.inspection_items || '-'}</Descriptions.Item>
            <Descriptions.Item label="检测数据" span={2}>{viewingInspection.inspection_data || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{viewingInspection.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default SafetyInspectionManagement;
