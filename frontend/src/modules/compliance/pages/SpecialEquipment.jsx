/**
 * 特种设备管理页面
 * 管理电梯、压力容器、锅炉、起重机械等特种设备
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../../hooks';
import { 
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select, 
  DatePicker, message, Popconfirm, Row, Col, Statistic,
  Tabs, Badge, Alert
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, ToolOutlined,
  ClockCircleOutlined, CheckCircleOutlined,
  WarningOutlined, FileSearchOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { complianceAPI } from '../../../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const SpecialEquipmentManagement = () => {
  const canDelete = useCan('compliance', 'delete');
  const canEdit = useCan('compliance', 'edit');
  const [activeTab, setActiveTab] = useState('equipment');
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  
  // 设备相关状态
  const [equipment, setEquipment] = useState([]);
  const [equipmentOptions, setEquipmentOptions] = useState([]);
  const [equipmentModalVisible, setEquipmentModalVisible] = useState(false);
  const [equipmentForm] = Form.useForm();
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [equipmentPagination, setEquipmentPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  
  // 检验记录相关状态
  const [inspections, setInspections] = useState([]);
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false);
  const [inspectionForm] = Form.useForm();
  const [editingInspection, setEditingInspection] = useState(null);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [inspectionPagination, setInspectionPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const { current: equipmentCurrent, pageSize: equipmentPageSize } = equipmentPagination;
  const { current: inspectionCurrent, pageSize: inspectionPageSize } = inspectionPagination;
  
  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    normal: 0,
    expiring: 0,
    expired: 0
  });

  const equipmentTypes = [
    { value: 'elevator', label: '电梯', icon: '🛗' },
    { value: 'pressure_vessel', label: '压力容器', icon: '⚙️' },
    { value: 'boiler', label: '锅炉', icon: '🔥' },
    { value: 'crane', label: '起重机械', icon: '🏗️' },
    { value: 'forklift', label: '厂内机动车辆', icon: '🚜' },
    { value: 'pressure_pipeline', label: '压力管道', icon: '🔧' },
    { value: 'passenger_ropeway', label: '客运索道', icon: '🚡' },
    { value: 'large_amusement', label: '大型游乐设施', icon: '🎡' }
  ];

  const safetyStatusOptions = [
    { value: 'normal', label: '正常', color: 'green' },
    { value: 'expiring', label: '即将过期', color: 'orange' },
    { value: 'expired', label: '已过期', color: 'red' },
    { value: 'stopped', label: '停用', color: 'default' }
  ];

  const inspectionResults = [
    { value: 'pass', label: '合格', color: 'green' },
    { value: 'conditional', label: '有条件合格', color: 'orange' },
    { value: 'fail', label: '不合格', color: 'red' }
  ];

  const fetchSpecialEquipmentStats = useCallback(async () => {
    try {
      const response = await complianceAPI.getSpecialEquipmentStatistics();
      if (response?.success) {
        const inspectionStatus = response.data?.inspection_status || {};
        setStats(prev => ({
          ...prev,
          normal: Number(inspectionStatus.normal_count) || 0,
          expiring: Number(inspectionStatus.expiring_count) || 0,
          expired: Number(inspectionStatus.expired_count) || 0
        }));
      }
    } catch (_error) {
      // 统计信息只影响顶部看板，不阻断主流程
    }
  }, []);

  const fetchEquipmentOptions = useCallback(async () => {
    try {
      const response = await complianceAPI.getSpecialEquipment({ page: 1, pageSize: 500 });
      if (response?.success) {
        setEquipmentOptions(Array.isArray(response.data) ? response.data : []);
      }
    } catch (_error) {
      // 设备下拉选项加载失败时不打断页面展示
    }
  }, []);

  const fetchEquipment = useCallback(async (paginationParams = {}) => {
    setEquipmentLoading(true);
    const current = paginationParams.current || equipmentCurrent;
    const pageSize = paginationParams.pageSize || equipmentPageSize;

    try {
      const response = await complianceAPI.getSpecialEquipment({ page: current, pageSize });
      if (response?.success) {
        const data = Array.isArray(response.data) ? response.data : [];
        const total = Number(response.pagination?.total) || data.length;

        setEquipment(data);
        setEquipmentPagination(prev => ({
          ...prev,
          current,
          pageSize,
          total
        }));
        setStats(prev => ({
          ...prev,
          total
        }));
      }
    } catch (_error) {
      message.error('加载设备失败');
    } finally {
      setEquipmentLoading(false);
    }
  }, [equipmentCurrent, equipmentPageSize]);

  const fetchInspections = useCallback(
    async (paginationParams = {}, equipmentId = selectedEquipment?.id) => {
      setInspectionLoading(true);
      const current = paginationParams.current || inspectionCurrent;
      const pageSize = paginationParams.pageSize || inspectionPageSize;

      try {
        const params = { page: current, pageSize };
        if (equipmentId) {
          params.equipment_id = equipmentId;
        }

        const response = await complianceAPI.getSpecialEquipmentInspections(params);
        if (response?.success) {
          const data = Array.isArray(response.data) ? response.data : [];
          const total = Number(response.pagination?.total) || data.length;

          setInspections(data);
          setInspectionPagination(prev => ({
            ...prev,
            current,
            pageSize,
            total
          }));
        }
      } catch (_error) {
        message.error('加载检验记录失败');
      } finally {
        setInspectionLoading(false);
      }
    },
    [inspectionCurrent, inspectionPageSize, selectedEquipment?.id]
  );

  useEffect(() => {
    void fetchEquipment({ current: 1, pageSize: equipmentPageSize });
    void fetchEquipmentOptions();
    void fetchSpecialEquipmentStats();
  }, [equipmentPageSize, fetchEquipment, fetchEquipmentOptions, fetchSpecialEquipmentStats]);

  useEffect(() => {
    if (activeTab !== 'inspections') {
      return;
    }
    void fetchInspections(
      { current: 1, pageSize: inspectionPageSize },
      selectedEquipment?.id
    );
  }, [activeTab, fetchInspections, inspectionPageSize, selectedEquipment?.id]);

  // 设备管理功能
  const handleAddEquipment = () => {
    setEditingEquipment(null);
    equipmentForm.resetFields();
    equipmentForm.setFieldsValue({ safety_status: 'normal' });
    setEquipmentModalVisible(true);
  };

  const handleEditEquipment = (record) => {
    setEditingEquipment(record);
    equipmentForm.setFieldsValue({
      ...record,
      registration_date: record.registration_date ? dayjs(record.registration_date) : null,
      first_inspection_date: record.first_inspection_date ? dayjs(record.first_inspection_date) : null,
      next_inspection_date: record.next_inspection_date ? dayjs(record.next_inspection_date) : null
    });
    setEquipmentModalVisible(true);
  };

  const handleDeleteEquipment = async (id) => {
    try {
      await complianceAPI.deleteSpecialEquipment(id);
      message.success('删除成功');
      if (selectedEquipment?.id === id) {
        setSelectedEquipment(null);
      }
      await fetchEquipment({ current: 1, pageSize: equipmentPagination.pageSize });
      await fetchEquipmentOptions();
      await fetchSpecialEquipmentStats();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handleEquipmentSubmit = async () => {
    try {
      const values = await equipmentForm.validateFields();
      // 转换日期格式
      ['registration_date', 'first_inspection_date', 'next_inspection_date'].forEach(field => {
        if (values[field]) {
          values[field] = values[field].format('YYYY-MM-DD');
        }
      });
      
      if (editingEquipment) {
        await complianceAPI.updateSpecialEquipment(editingEquipment.id, values);
        message.success('更新成功');
      } else {
        await complianceAPI.createSpecialEquipment(values);
        message.success('创建成功');
      }
      setEquipmentModalVisible(false);
      await fetchEquipment({ current: 1, pageSize: equipmentPagination.pageSize });
      await fetchEquipmentOptions();
      await fetchSpecialEquipmentStats();
    } catch (_error) {
      message.error('操作失败');
    }
  };

  // 检验记录管理功能
  const handleAddInspection = () => {
    setEditingInspection(null);
    inspectionForm.resetFields();
    inspectionForm.setFieldsValue({
      equipment_id: selectedEquipment?.id || undefined
    });
    setInspectionModalVisible(true);
  };

  const handleEditInspection = (record) => {
    setEditingInspection(record);
    inspectionForm.setFieldsValue({
      ...record,
      inspection_date: record.inspection_date ? dayjs(record.inspection_date) : null,
      next_date: record.next_date ? dayjs(record.next_date) : null
    });
    setInspectionModalVisible(true);
  };

  const handleDeleteInspection = async (id) => {
    try {
      await complianceAPI.deleteSpecialEquipmentInspection(id);
      message.success('删除成功');
      await fetchInspections(
        { current: inspectionPagination.current, pageSize: inspectionPagination.pageSize },
        selectedEquipment?.id
      );
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
      if (values.next_date) {
        values.next_date = values.next_date.format('YYYY-MM-DD');
      }
      
      if (editingInspection) {
        await complianceAPI.updateSpecialEquipmentInspection(editingInspection.id, values);
        message.success('更新成功');
      } else {
        await complianceAPI.createSpecialEquipmentInspection(values);
        message.success('创建成功');
      }
      setInspectionModalVisible(false);
      await fetchInspections({ current: 1, pageSize: inspectionPagination.pageSize }, selectedEquipment?.id);
      await fetchSpecialEquipmentStats();
    } catch (_error) {
      message.error('操作失败');
    }
  };

  const handleEquipmentTableChange = (pagination) => {
    fetchEquipment({
      current: pagination.current,
      pageSize: pagination.pageSize
    });
  };

  const handleInspectionTableChange = (pagination) => {
    fetchInspections(
      {
        current: pagination.current,
        pageSize: pagination.pageSize
      },
      selectedEquipment?.id
    );
  };

  const equipmentColumns = [
    { title: '设备编号', dataIndex: 'equipment_code', key: 'equipment_code', width: 120 },
    { title: '设备名称', dataIndex: 'equipment_name', key: 'equipment_name' },
    { 
      title: '设备类型', 
      dataIndex: 'equipment_type', 
      key: 'equipment_type',
      render: (v) => {
        const type = equipmentTypes.find(t => t.value === v);
        return type ? `${type.icon} ${type.label}` : v;
      }
    },
    { title: '使用证编号', dataIndex: 'use_certificate_no', key: 'use_certificate_no' },
    {
      title: '状态', 
      dataIndex: 'safety_status', 
      key: 'safety_status',
      render: (v) => {
        const status = safetyStatusOptions.find(s => s.value === v);
        return <Badge status={status?.color} text={status?.label} />;
      }
    },
    { 
      title: '下次检验日期', 
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
      title: '所在位置',
      dataIndex: 'location',
      key: 'location',
      render: (v, record) => v || record.install_location || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<HistoryOutlined />} onClick={() => {
            setSelectedEquipment(record);
            setActiveTab('inspections');
          }}>检验记录</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditEquipment(record)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDeleteEquipment(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const inspectionColumns = [
    { title: '检验编号', dataIndex: 'inspection_code', key: 'inspection_code' },
    { title: '设备名称', dataIndex: 'equipment_name', key: 'equipment_name' },
    { title: '检验类型', dataIndex: 'inspection_type', key: 'inspection_type' },
    { title: '检验日期', dataIndex: 'inspection_date', key: 'inspection_date' },
    { 
      title: '检验结果', 
      dataIndex: 'inspection_result', 
      key: 'inspection_result',
      render: (v) => {
        const result = inspectionResults.find(r => r.value === v);
        return <Tag color={result?.color || 'default'}>{result?.label || v || '-'}</Tag>;
      }
    },
    { title: '检验机构', dataIndex: 'inspection_org', key: 'inspection_org' },
    { title: '下次检验', dataIndex: 'next_date', key: 'next_date' },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditInspection(record)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDeleteInspection(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const tabItems = [
    {
      key: 'equipment',
      label: <span><ToolOutlined />特种设备台账</span>,
      children: (
        <Card
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddEquipment}>
              新增设备
            </Button>
          }
        >
          <Table 
            columns={equipmentColumns} 
            dataSource={equipment} 
            rowKey="id"
            loading={equipmentLoading}
            pagination={{
              current: equipmentPagination.current,
              pageSize: equipmentPagination.pageSize,
              total: equipmentPagination.total,
              showSizeChanger: true,
              showTotal: total => `共 ${total} 条`
            }}
            onChange={handleEquipmentTableChange}
          />
        </Card>
      )
    },
    {
      key: 'inspections',
      label: <span><FileSearchOutlined />检验记录</span>,
      children: (
        <Card
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddInspection}>
              新增检验记录
            </Button>
          }
        >
          {selectedEquipment && (
            <Alert
              message={`当前查看设备：${selectedEquipment.equipment_name} (${selectedEquipment.equipment_code})`}
              type="info"
              closable
              onClose={() => setSelectedEquipment(null)}
              style={{ marginBottom: 16 }}
            />
          )}
          <Table 
            columns={inspectionColumns} 
            dataSource={inspections}
            rowKey="id"
            loading={inspectionLoading}
            pagination={{
              current: inspectionPagination.current,
              pageSize: inspectionPagination.pageSize,
              total: inspectionPagination.total,
              showSizeChanger: true,
              showTotal: total => `共 ${total} 条`
            }}
            onChange={handleInspectionTableChange}
          />
        </Card>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="特种设备总数" value={stats.total} prefix={<ToolOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="状态正常" value={stats.normal} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#52c41a' } }} />
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
          message={`警告：有 ${stats.expired} 台特种设备检验已过期，请立即安排检验！`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {/* 设备编辑弹窗 */}
      <Modal
        title={editingEquipment ? '编辑特种设备' : '新增特种设备'}
        open={equipmentModalVisible}
        onOk={handleEquipmentSubmit}
        onCancel={() => setEquipmentModalVisible(false)}
        width={800}
      >
        <Form form={equipmentForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="equipment_code" label="设备编号" rules={[{ required: true }]}>
                <Input placeholder="请输入设备编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="equipment_name" label="设备名称" rules={[{ required: true }]}>
                <Input placeholder="请输入设备名称" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="equipment_type" label="设备类型" rules={[{ required: true }]}>
                <Select placeholder="请选择设备类型">
                  {equipmentTypes.map(t => (
                    <Option key={t.value} value={t.value}>{t.icon} {t.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="manufacturer" label="制造商">
                <Input placeholder="请输入制造商" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="model_spec" label="型号规格">
                <Input placeholder="请输入型号规格" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="serial_number" label="出厂编号">
                <Input placeholder="请输入出厂编号" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="use_certificate_no" label="使用登记证编号">
                <Input placeholder="请输入使用登记证编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="registration_date" label="注册登记日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="first_inspection_date" label="首次检验日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="next_inspection_date" label="下次检验日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="location" label="所在位置">
                <Input placeholder="请输入所在位置" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="safety_status" label="状态" rules={[{ required: true }]}>
                <Select placeholder="请选择状态">
                  {safetyStatusOptions.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="safety_notes" label="安全注意事项">
            <TextArea rows={3} placeholder="请输入安全注意事项" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 检验记录编辑弹窗 */}
      <Modal
        title={editingInspection ? '编辑检验记录' : '新增检验记录'}
        open={inspectionModalVisible}
        onOk={handleInspectionSubmit}
        onCancel={() => setInspectionModalVisible(false)}
        width={700}
      >
        <Form form={inspectionForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="inspection_code" label="检验编号" rules={[{ required: true }]}>
                <Input placeholder="请输入检验编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="equipment_id" label="选择设备" rules={[{ required: true }]}>
                <Select placeholder="请选择设备" showSearch>
                  {equipmentOptions.map(e => (
                    <Option key={e.id} value={e.id}>{e.equipment_name} ({e.equipment_code})</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="inspection_type" label="检验类型" rules={[{ required: true }]}>
                <Select placeholder="请选择检验类型">
                  <Option value="regular">定期检验</Option>
                  <Option value="initial">首次检验</Option>
                  <Option value="reinspection">复检</Option>
                  <Option value="special">特殊检验</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inspection_date" label="检验日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="inspection_result" label="检验结果" rules={[{ required: true }]}>
                <Select placeholder="请选择检验结果">
                  {inspectionResults.map(r => <Option key={r.value} value={r.value}>{r.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="next_date" label="下次检验日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="inspection_org" label="检验机构">
                <Input placeholder="请输入检验机构" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inspector" label="检验人员">
                <Input placeholder="请输入检验人员" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="inspection_items" label="检验项目">
            <TextArea rows={2} placeholder="请输入检验项目" />
          </Form.Item>
          
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SpecialEquipmentManagement;
