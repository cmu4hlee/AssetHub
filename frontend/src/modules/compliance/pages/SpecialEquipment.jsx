/**
 * 特种设备管理页面
 * 管理电梯、压力容器、锅炉、起重机械等特种设备
 * 完善版：搜索筛选、资产关联、详情抽屉、增强表单
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCan } from '../../../hooks';
import { 
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select, 
  DatePicker, message, Popconfirm, Row, Col, Statistic,
  Tabs, Badge, Alert, Drawer, Descriptions, InputNumber,
  Divider, Tooltip
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, ToolOutlined,
  ClockCircleOutlined, CheckCircleOutlined,
  WarningOutlined, FileSearchOutlined,
  HistoryOutlined, SearchOutlined, ReloadOutlined,
  EyeOutlined, FilterOutlined, ClearOutlined
} from '@ant-design/icons';
import { complianceAPI } from '../../../utils/api';
import { assetAPI } from '../../../api/domains/assets';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const SpecialEquipmentManagement = () => {
  const canDelete = useCan('compliance', 'delete');
  const canEdit = useCan('compliance', 'edit');
  const [activeTab, setActiveTab] = useState('equipment');
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  
  // 筛选状态
  const [equipmentFilters, setEquipmentFilters] = useState({ keyword: '', equipment_type: undefined, safety_status: undefined });
  const [inspectionFilters, setInspectionFilters] = useState({ keyword: '', inspection_type: undefined, inspection_result: undefined });
  const searchTimerRef = useRef(null);
  
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
  
  // 详情抽屉
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailEquipment, setDetailEquipment] = useState(null);
  const [detailInspections, setDetailInspections] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 资产联想
  const [assetSearchLoading, setAssetSearchLoading] = useState(false);
  const [assetOptions, setAssetOptions] = useState([]);
  
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
  const [typeStatistics, setTypeStatistics] = useState([]);

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

  const inspectionTypeOptions = [
    { value: 'regular', label: '定期检验' },
    { value: 'initial', label: '首次检验' },
    { value: 'reinspection', label: '复检' },
    { value: 'special', label: '特殊检验' }
  ];

  const inspectionResults = [
    { value: 'pass', label: '合格', color: 'green' },
    { value: 'conditional', label: '有条件合格', color: 'orange' },
    { value: 'fail', label: '不合格', color: 'red' }
  ];

  const getEquipmentTypeLabel = (v) => {
    const type = equipmentTypes.find(t => t.value === v);
    return type ? `${type.icon} ${type.label}` : (v || '-');
  };

  const getSafetyStatusTag = (v) => {
    const status = safetyStatusOptions.find(s => s.value === v);
    if (!status) return <Tag>{v || '-'}</Tag>;
    return <Tag color={status.color}>{status.label}</Tag>;
  };

  const getInspectionResultTag = (v) => {
    const result = inspectionResults.find(r => r.value === v);
    if (!result) return <Tag>{v || '-'}</Tag>;
    return <Tag color={result.color}>{result.label}</Tag>;
  };

  const fetchSpecialEquipmentStats = useCallback(async () => {
    try {
      const response = await complianceAPI.getSpecialEquipmentStatistics();
      if (response?.success && response.data) {
        const inspectionStatus = response.data.inspection_status || {};
        setStats({
          total: Number(response.data.total) || 0,
          normal: Number(inspectionStatus.normal_count) || 0,
          expiring: Number(inspectionStatus.expiring_count) || 0,
          expired: Number(inspectionStatus.expired_count) || 0
        });
        setTypeStatistics(Array.isArray(response.data.type_statistics) ? response.data.type_statistics : []);
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

  const fetchEquipment = useCallback(async (paginationParams = {}, filters = null) => {
    setEquipmentLoading(true);
    const currentFilters = filters || equipmentFilters;
    const current = paginationParams.current || equipmentCurrent;
    const pageSize = paginationParams.pageSize || equipmentPageSize;

    try {
      const params = { page: current, pageSize };
      if (currentFilters.keyword) params.keyword = currentFilters.keyword;
      if (currentFilters.equipment_type) params.equipment_type = currentFilters.equipment_type;
      if (currentFilters.safety_status) params.safety_status = currentFilters.safety_status;

      const response = await complianceAPI.getSpecialEquipment(params);
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
      }
    } catch (_error) {
      message.error('加载设备失败');
    } finally {
      setEquipmentLoading(false);
    }
  }, [equipmentCurrent, equipmentPageSize, equipmentFilters]);

  const fetchInspections = useCallback(
    async (paginationParams = {}, equipmentId = selectedEquipment?.id, filters = null) => {
      setInspectionLoading(true);
      const currentFilters = filters || inspectionFilters;
      const current = paginationParams.current || inspectionCurrent;
      const pageSize = paginationParams.pageSize || inspectionPageSize;

      try {
        const params = { page: current, pageSize };
        if (equipmentId) params.equipment_id = equipmentId;
        if (currentFilters.keyword) params.keyword = currentFilters.keyword;
        if (currentFilters.inspection_type) params.inspection_type = currentFilters.inspection_type;
        if (currentFilters.inspection_result) params.inspection_result = currentFilters.inspection_result;

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
    [inspectionCurrent, inspectionPageSize, selectedEquipment?.id, inspectionFilters]
  );

  useEffect(() => {
    void fetchEquipment({ current: 1, pageSize: equipmentPageSize });
    void fetchEquipmentOptions();
    void fetchSpecialEquipmentStats();
  }, [equipmentPageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 'inspections') return;
    void fetchInspections({ current: 1, pageSize: inspectionPageSize }, selectedEquipment?.id);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // 筛选更新（带防抖）
  const handleEquipmentFilterChange = (key, value) => {
    const newFilters = { ...equipmentFilters, [key]: value };
    setEquipmentFilters(newFilters);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchEquipment({ current: 1, pageSize: equipmentPageSize }, newFilters);
    }, 300);
  };

  const handleInspectionFilterChange = (key, value) => {
    const newFilters = { ...inspectionFilters, [key]: value };
    setInspectionFilters(newFilters);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchInspections({ current: 1, pageSize: inspectionPageSize }, selectedEquipment?.id, newFilters);
    }, 300);
  };

  const clearEquipmentFilters = () => {
    const cleared = { keyword: '', equipment_type: undefined, safety_status: undefined };
    setEquipmentFilters(cleared);
    fetchEquipment({ current: 1, pageSize: equipmentPageSize }, cleared);
  };

  const clearInspectionFilters = () => {
    const cleared = { keyword: '', inspection_type: undefined, inspection_result: undefined };
    setInspectionFilters(cleared);
    fetchInspections({ current: 1, pageSize: inspectionPageSize }, selectedEquipment?.id, cleared);
  };

  // 资产联想搜索
  const handleAssetSearch = async (value) => {
    if (!value || value.length < 1) {
      setAssetOptions([]);
      return;
    }
    setAssetSearchLoading(true);
    try {
      const response = await assetAPI.getAssets({ keyword: value, pageSize: 20 });
      if (response?.success && Array.isArray(response.data)) {
        setAssetOptions(response.data.map(a => ({
          label: `${a.asset_code} - ${a.asset_name}${a.department ? ` (${a.department})` : ''}`,
          value: a.id,
          asset_code: a.asset_code,
          asset_name: a.asset_name,
          department: a.department
        })));
      }
    } catch (_error) {
      // 资产搜索失败不打断流程
    } finally {
      setAssetSearchLoading(false);
    }
  };

  const handleAssetSelect = (value, option) => {
    if (option) {
      equipmentForm.setFieldsValue({
        asset_code: option.asset_code,
        asset_name: option.asset_name,
        department: option.department
      });
    }
  };

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
      next_inspection_date: record.next_inspection_date ? dayjs(record.next_inspection_date) : null,
      manufacturing_date: record.manufacturing_date ? dayjs(record.manufacturing_date) : null,
    });
    // 预加载已关联资产信息
    if (record.asset_id) {
      setAssetOptions([{
        label: `${record.asset_code || ''} - ${record.asset_name || ''}`,
        value: record.asset_id,
        asset_code: record.asset_code,
        asset_name: record.asset_name,
      }]);
    }
    setEquipmentModalVisible(true);
  };

  const handleDeleteEquipment = async (id) => {
    try {
      await complianceAPI.deleteSpecialEquipment(id);
      message.success('删除成功');
      if (selectedEquipment?.id === id) setSelectedEquipment(null);
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
      ['registration_date', 'first_inspection_date', 'next_inspection_date', 'manufacturing_date'].forEach(field => {
        if (values[field]) values[field] = values[field].format('YYYY-MM-DD');
      });
      
      if (editingEquipment) {
        await complianceAPI.updateSpecialEquipment(editingEquipment.id, values);
        message.success('更新成功');
      } else {
        await complianceAPI.createSpecialEquipment(values);
        message.success('创建成功');
      }
      setEquipmentModalVisible(false);
      setAssetOptions([]);
      await fetchEquipment({ current: 1, pageSize: equipmentPagination.pageSize });
      await fetchEquipmentOptions();
      await fetchSpecialEquipmentStats();
    } catch (_error) {
      if (_error?.errorFields) return; // 表单校验错误，不提示
      message.error('操作失败');
    }
  };

  // 查看设备详情
  const handleViewDetail = async (record) => {
    setDetailEquipment(record);
    setDetailDrawerVisible(true);
    setDetailLoading(true);
    try {
      const response = await complianceAPI.getSpecialEquipmentInspections({
        page: 1,
        pageSize: 100,
        equipment_id: record.id
      });
      if (response?.success) {
        setDetailInspections(Array.isArray(response.data) ? response.data : []);
      }
    } catch (_error) {
      // 详情加载失败不阻断
    } finally {
      setDetailLoading(false);
    }
  };

  // 检验记录管理功能
  const handleAddInspection = () => {
    setEditingInspection(null);
    inspectionForm.resetFields();
    if (selectedEquipment) {
      // 从设备列表跳转时，预选设备
      inspectionForm.setFieldsValue({
        equipment_id: selectedEquipment.id
      });
    }
    setInspectionModalVisible(true);
  };

  const handleEditInspection = (record) => {
    setEditingInspection(record);
    inspectionForm.setFieldsValue({
      ...record,
      inspection_date: record.inspection_date ? dayjs(record.inspection_date) : null,
      next_date: record.next_date ? dayjs(record.next_date) : null,
      rectification_deadline: record.rectification_deadline ? dayjs(record.rectification_deadline) : null,
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
      await fetchSpecialEquipmentStats();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handleInspectionSubmit = async () => {
    try {
      const values = await inspectionForm.validateFields();
      if (values.inspection_date) values.inspection_date = values.inspection_date.format('YYYY-MM-DD');
      if (values.next_date) values.next_date = values.next_date.format('YYYY-MM-DD');
      if (values.rectification_deadline) values.rectification_deadline = values.rectification_deadline.format('YYYY-MM-DD');
      
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
      await fetchEquipmentOptions();
    } catch (_error) {
      if (_error?.errorFields) return;
      message.error('操作失败');
    }
  };

  const handleEquipmentTableChange = (pagination) => {
    fetchEquipment({ current: pagination.current, pageSize: pagination.pageSize });
  };

  const handleInspectionTableChange = (pagination) => {
    fetchInspections(
      { current: pagination.current, pageSize: pagination.pageSize },
      selectedEquipment?.id
    );
  };

  const equipmentColumns = [
    { title: '设备编号', dataIndex: 'equipment_code', key: 'equipment_code', width: 130 },
    { title: '设备名称', dataIndex: 'equipment_name', key: 'equipment_name', width: 150 },
    { 
      title: '设备类型', dataIndex: 'equipment_type', key: 'equipment_type', width: 140,
      render: (v) => getEquipmentTypeLabel(v)
    },
    { 
      title: '关联资产', dataIndex: 'asset_code', key: 'asset_code', width: 130,
      render: (v, record) => v ? <Tooltip title={record.asset_name}>{v}</Tooltip> : '-'
    },
    { title: '所属部门', dataIndex: 'department', key: 'department', width: 120 },
    { title: '所在位置', dataIndex: 'location', key: 'location', width: 120,
      render: (v, record) => v || record.install_location || '-'
    },
    {
      title: '状态', dataIndex: 'safety_status', key: 'safety_status', width: 100,
      render: (v) => getSafetyStatusTag(v)
    },
    { 
      title: '下次检验日期', dataIndex: 'next_inspection_date', key: 'next_inspection_date', width: 140,
      render: (v) => {
        if (!v) return <Tag color="default">未设置</Tag>;
        const days = dayjs(v).diff(dayjs(), 'days');
        if (days < 0) return <Tag color="red">{v} (已过期)</Tag>;
        if (days <= 30) return <Tag color="orange">{v} (剩{days}天)</Tag>;
        if (days <= 90) return <Tag color="gold">{v} (剩{days}天)</Tag>;
        return <span style={{ color: '#52c41a' }}>{v}</span>;
      }
    },
    {
      title: '操作', key: 'action', width: 220, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>详情</Button>
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => {
            setSelectedEquipment(record);
            setActiveTab('inspections');
          }}>检验记录</Button>
          {canEdit && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditEquipment(record)}>编辑</Button>
          )}
          {canDelete && (
            <Popconfirm title="确认删除该设备？" onConfirm={() => handleDeleteEquipment(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const inspectionColumns = [
    { title: '检验编号', dataIndex: 'inspection_code', key: 'inspection_code', width: 130 },
    { title: '设备名称', dataIndex: 'equipment_name', key: 'equipment_name', width: 150 },
    { title: '设备编号', dataIndex: 'equipment_code', key: 'equipment_code', width: 130 },
    { title: '检验类型', dataIndex: 'inspection_type', key: 'inspection_type', width: 100,
      render: (v) => {
        const type = inspectionTypeOptions.find(t => t.value === v);
        return type?.label || v || '-';
      }
    },
    { title: '检验日期', dataIndex: 'inspection_date', key: 'inspection_date', width: 120 },
    { 
      title: '检验结果', dataIndex: 'inspection_result', key: 'inspection_result', width: 120,
      render: (v) => getInspectionResultTag(v)
    },
    { title: '检验机构', dataIndex: 'inspection_org', key: 'inspection_org', width: 140,
      render: (v, record) => v || record.inspection_agency || '-'
    },
    { title: '检验人员', dataIndex: 'inspector', key: 'inspector', width: 100 },
    { title: '下次检验', dataIndex: 'next_date', key: 'next_date', width: 120,
      render: (v) => {
        if (!v) return '-';
        const days = dayjs(v).diff(dayjs(), 'days');
        if (days < 0) return <Tag color="red">{v}</Tag>;
        if (days <= 30) return <Tag color="orange">{v}</Tag>;
        return v;
      }
    },
    { title: '证书编号', dataIndex: 'certificate_no', key: 'certificate_no', width: 130,
      render: (v) => v || '-'
    },
    {
      title: '操作', key: 'action', width: 150, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {canEdit && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditInspection(record)}>编辑</Button>
          )}
          {canDelete && (
            <Popconfirm title="确认删除？" onConfirm={() => handleDeleteInspection(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  // 设备详情抽屉内检验记录列
  const detailInspectionColumns = [
    { title: '检验编号', dataIndex: 'inspection_code', width: 130 },
    { title: '检验类型', dataIndex: 'inspection_type', width: 100,
      render: (v) => inspectionTypeOptions.find(t => t.value === v)?.label || v || '-'
    },
    { title: '检验日期', dataIndex: 'inspection_date', width: 120 },
    { title: '检验结果', dataIndex: 'inspection_result', width: 110,
      render: (v) => getInspectionResultTag(v)
    },
    { title: '检验机构', dataIndex: 'inspection_org', width: 140 },
    { title: '检验人员', dataIndex: 'inspector', width: 100 },
    { title: '下次检验', dataIndex: 'next_date', width: 120 },
    { title: '证书编号', dataIndex: 'certificate_no', width: 130 },
  ];

  const tabItems = [
    {
      key: 'equipment',
      label: <span><ToolOutlined />特种设备台账</span>,
      children: (
        <>
          {/* 搜索筛选栏 */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[12, 12]} align="middle">
              <Col flex="auto">
                <Input
                  placeholder="搜索设备编号、名称、资产编码..."
                  prefix={<SearchOutlined />}
                  value={equipmentFilters.keyword}
                  onChange={e => handleEquipmentFilterChange('keyword', e.target.value)}
                  allowClear
                  style={{ maxWidth: 320 }}
                />
              </Col>
              <Col>
                <Select
                  placeholder="设备类型"
                  value={equipmentFilters.equipment_type}
                  onChange={v => handleEquipmentFilterChange('equipment_type', v)}
                  allowClear
                  style={{ width: 150 }}
                >
                  {equipmentTypes.map(t => (
                    <Option key={t.value} value={t.value}>{t.icon} {t.label}</Option>
                  ))}
                </Select>
              </Col>
              <Col>
                <Select
                  placeholder="安全状态"
                  value={equipmentFilters.safety_status}
                  onChange={v => handleEquipmentFilterChange('safety_status', v)}
                  allowClear
                  style={{ width: 120 }}
                >
                  {safetyStatusOptions.map(s => (
                    <Option key={s.value} value={s.value}>{s.label}</Option>
                  ))}
                </Select>
              </Col>
              <Col>
                <Button icon={<ClearOutlined />} onClick={clearEquipmentFilters} disabled={!equipmentFilters.keyword && !equipmentFilters.equipment_type && !equipmentFilters.safety_status}>
                  重置
                </Button>
              </Col>
              <Col>
                <Button icon={<ReloadOutlined />} onClick={() => fetchEquipment({ current: 1, pageSize: equipmentPageSize })}>
                  刷新
                </Button>
              </Col>
              <Col>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddEquipment}>
                  新增设备
                </Button>
              </Col>
            </Row>
          </Card>

          <Card>
            <Table 
              columns={equipmentColumns} 
              dataSource={equipment} 
              rowKey="id"
              loading={equipmentLoading}
              scroll={{ x: 1200 }}
              pagination={{
                current: equipmentPagination.current,
                pageSize: equipmentPagination.pageSize,
                total: equipmentPagination.total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: total => `共 ${total} 条`
              }}
              onChange={handleEquipmentTableChange}
            />
          </Card>
        </>
      )
    },
    {
      key: 'inspections',
      label: <span><FileSearchOutlined />检验记录</span>,
      children: (
        <>
          {/* 检验记录搜索筛选栏 */}
          {selectedEquipment && (
            <Alert title={
                <span>
                  当前查看设备：<strong>{selectedEquipment.equipment_name}</strong> ({selectedEquipment.equipment_code})
                  <Button type="link" size="small" onClick={() => setSelectedEquipment(null)} style={{ marginLeft: 8 }}>清除筛选</Button>
                </span>
              }
              type="info"
              closable
              onClose={() => setSelectedEquipment(null)}
              style={{ marginBottom: 16 }}
            />
          )}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[12, 12]} align="middle">
              <Col flex="auto">
                <Input
                  placeholder="搜索检验编号、设备、人员..."
                  prefix={<SearchOutlined />}
                  value={inspectionFilters.keyword}
                  onChange={e => handleInspectionFilterChange('keyword', e.target.value)}
                  allowClear
                  style={{ maxWidth: 280 }}
                />
              </Col>
              <Col>
                <Select
                  placeholder="检验类型"
                  value={inspectionFilters.inspection_type}
                  onChange={v => handleInspectionFilterChange('inspection_type', v)}
                  allowClear
                  style={{ width: 130 }}
                >
                  {inspectionTypeOptions.map(t => (
                    <Option key={t.value} value={t.value}>{t.label}</Option>
                  ))}
                </Select>
              </Col>
              <Col>
                <Select
                  placeholder="检验结果"
                  value={inspectionFilters.inspection_result}
                  onChange={v => handleInspectionFilterChange('inspection_result', v)}
                  allowClear
                  style={{ width: 130 }}
                >
                  {inspectionResults.map(r => (
                    <Option key={r.value} value={r.value}>{r.label}</Option>
                  ))}
                </Select>
              </Col>
              <Col>
                <Button icon={<ClearOutlined />} onClick={clearInspectionFilters} disabled={!inspectionFilters.keyword && !inspectionFilters.inspection_type && !inspectionFilters.inspection_result}>
                  重置
                </Button>
              </Col>
              <Col>
                <Button icon={<ReloadOutlined />} onClick={() => fetchInspections({ current: 1, pageSize: inspectionPageSize }, selectedEquipment?.id)}>
                  刷新
                </Button>
              </Col>
              <Col>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddInspection}>
                  新增检验记录
                </Button>
              </Col>
            </Row>
          </Card>

          <Card>
            <Table 
              columns={inspectionColumns} 
              dataSource={inspections}
              rowKey="id"
              loading={inspectionLoading}
              scroll={{ x: 1400 }}
              pagination={{
                current: inspectionPagination.current,
                pageSize: inspectionPagination.pageSize,
                total: inspectionPagination.total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: total => `共 ${total} 条`
              }}
              onChange={handleInspectionTableChange}
            />
          </Card>
        </>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="特种设备总数" value={stats.total} prefix={<ToolOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="状态正常" value={stats.normal} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="即将过期" value={stats.expiring} prefix={<ClockCircleOutlined />} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="已过期" value={stats.expired} prefix={<WarningOutlined />} styles={{ content: { color: '#f5222d' } }} />
          </Card>
        </Col>
      </Row>

      {/* 设备类型分布 */}
      {typeStatistics.length > 0 && (
        <Card size="small" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <FilterOutlined />
            <span style={{ fontWeight: 500, fontSize: 14 }}>设备类型分布</span>
          </div>
          <Row gutter={[12, 8]}>
            {typeStatistics.map(t => {
              const eqType = equipmentTypes.find(et => et.value === t.equipment_type);
              return (
                <Col key={t.equipment_type} xs={12} sm={8} md={6} lg={4} xl={3}>
                  <Card size="small" styles={{ body: { padding: '8px 12px', textAlign: 'center' } }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{eqType?.icon || '🔧'}</div>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>{t.label || t.equipment_type}</div>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>{t.count}</div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>
      )}

      {stats.expired > 0 && (
        <Alert title={`警告：有 ${stats.expired} 台特种设备检验已过期，请立即安排检验！`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} destroyOnHidden />

      {/* 设备编辑弹窗 */}
      <Modal
        title={editingEquipment ? '编辑特种设备' : '新增特种设备'}
        open={equipmentModalVisible}
        onOk={handleEquipmentSubmit}
        onCancel={() => { setEquipmentModalVisible(false); setAssetOptions([]); }}
        width={900}
        destroyOnHidden
      >
        <Form form={equipmentForm} layout="vertical">
          <Divider orientation="left" plain>基本信息</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="equipment_code" label="设备编号" rules={[{ required: true, message: '请输入设备编号' }]}>
                <Input placeholder="请输入设备编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="equipment_name" label="设备名称" rules={[{ required: true, message: '请输入设备名称' }]}>
                <Input placeholder="请输入设备名称" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="equipment_type" label="设备类型" rules={[{ required: true, message: '请选择设备类型' }]}>
                <Select placeholder="请选择设备类型">
                  {equipmentTypes.map(t => (
                    <Option key={t.value} value={t.value}>{t.icon} {t.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="manufacturer" label="制造商">
                <Input placeholder="请输入制造商" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="model_spec" label="型号规格">
                <Input placeholder="请输入型号规格" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="serial_number" label="出厂编号">
                <Input placeholder="请输入出厂编号" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="manufacturing_date" label="制造日期">
                <DatePicker style={{ width: '100%' }} placeholder="选择制造日期" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="inspection_cycle_months" label="检验周期(月)">
                <InputNumber min={1} max={120} placeholder="如：12" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>关联资产</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="asset_id" label="关联资产" tooltip="选择系统中的资产进行关联，可选">
                <Select
                  placeholder="输入资产编码或名称搜索..."
                  showSearch
                  filterOption={false}
                  onSearch={handleAssetSearch}
                  onSelect={handleAssetSelect}
                  loading={assetSearchLoading}
                  allowClear
                  options={assetOptions}
                  notFoundContent={assetSearchLoading ? '搜索中...' : '请输入关键词搜索'}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label="所属部门">
                <Input placeholder="请输入所属部门" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>注册与检验信息</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="use_certificate_no" label="使用登记证编号">
                <Input placeholder="请输入使用登记证编号" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="registration_date" label="注册登记日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="safety_manager" label="安全管理员">
                <Input placeholder="请输入安全管理员" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="first_inspection_date" label="首次检验日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="next_inspection_date" label="下次检验日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="safety_status" label="安全状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态">
                  {safetyStatusOptions.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>其他信息</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="location" label="安装位置">
                <Input placeholder="请输入安装位置" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="registrant" label="登记人">
                <Input placeholder="请输入登记人" />
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
        width={800}
        destroyOnHidden
      >
        <Form form={inspectionForm} layout="vertical">
          <Divider orientation="left" plain>基本信息</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="inspection_code" label="检验编号" rules={[{ required: true, message: '请输入检验编号' }]}>
                <Input placeholder="请输入检验编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="equipment_id" label="选择设备" rules={[{ required: true, message: '请选择设备' }]}>
                <Select 
                  placeholder="请选择设备" 
                  showSearch 
                  optionFilterProp="children"
                  disabled={!!selectedEquipment && !editingInspection}
                >
                  {equipmentOptions.map(e => (
                    <Option key={e.id} value={e.id}>{e.equipment_name} ({e.equipment_code})</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="inspection_type" label="检验类型" rules={[{ required: true, message: '请选择检验类型' }]}>
                <Select placeholder="请选择检验类型">
                  {inspectionTypeOptions.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="inspection_date" label="检验日期" rules={[{ required: true, message: '请选择检验日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="inspection_result" label="检验结果" rules={[{ required: true, message: '请选择检验结果' }]}>
                <Select placeholder="请选择检验结果">
                  {inspectionResults.map(r => <Option key={r.value} value={r.value}>{r.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="inspection_org" label="检验机构">
                <Input placeholder="请输入检验机构" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="inspector" label="检验人员">
                <Input placeholder="请输入检验人员" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="certificate_no" label="证书编号">
                <Input placeholder="请输入证书编号" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="next_date" label="下次检验日期">
                <DatePicker style={{ width: '100%' }} placeholder="选择下次检验日期" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="inspection_items" label="检验项目">
                <Input placeholder="请输入检验项目，多个用逗号分隔" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>整改信息</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="issues_found" label="发现的问题">
                <TextArea rows={2} placeholder="请输入检验发现的问题" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rectification_measures" label="整改措施">
                <TextArea rows={2} placeholder="请输入整改措施" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="rectification_deadline" label="整改截止日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="remarks" label="备注">
                <TextArea rows={2} placeholder="请输入备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 设备详情抽屉 */}
      <Drawer
        title="特种设备详情"
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setDetailEquipment(null); setDetailInspections([]); }}
        width={800}
      >
        {detailEquipment && (
          <>
            <Descriptions title="基本信息" bordered column={2} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="设备编号">{detailEquipment.equipment_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="设备名称">{detailEquipment.equipment_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="设备类型">{getEquipmentTypeLabel(detailEquipment.equipment_type)}</Descriptions.Item>
              <Descriptions.Item label="安全状态">{getSafetyStatusTag(detailEquipment.safety_status)}</Descriptions.Item>
              <Descriptions.Item label="制造商">{detailEquipment.manufacturer || '-'}</Descriptions.Item>
              <Descriptions.Item label="型号规格">{detailEquipment.model_spec || '-'}</Descriptions.Item>
              <Descriptions.Item label="出厂编号">{detailEquipment.serial_number || '-'}</Descriptions.Item>
              <Descriptions.Item label="制造日期">{detailEquipment.manufacturing_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="使用登记证编号">{detailEquipment.use_certificate_no || detailEquipment.registration_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="注册登记日期">{detailEquipment.registration_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="检验周期">{detailEquipment.inspection_cycle_months ? `${detailEquipment.inspection_cycle_months} 个月` : '-'}</Descriptions.Item>
              <Descriptions.Item label="安全管理员">{detailEquipment.safety_manager || '-'}</Descriptions.Item>
            </Descriptions>

            <Descriptions title="关联资产" bordered column={2} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="资产编码">{detailEquipment.asset_code || '未关联'}</Descriptions.Item>
              <Descriptions.Item label="资产名称">{detailEquipment.asset_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="所属部门">{detailEquipment.department || '-'}</Descriptions.Item>
              <Descriptions.Item label="安装位置">{detailEquipment.location || detailEquipment.install_location || '-'}</Descriptions.Item>
            </Descriptions>

            <Descriptions title="检验信息" bordered column={2} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="首次检验日期">{detailEquipment.first_inspection_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="下次检验日期">
                {detailEquipment.next_inspection_date ? (
                  <span style={{ 
                    color: dayjs(detailEquipment.next_inspection_date).diff(dayjs(), 'days') < 0 ? '#f5222d' : 
                           dayjs(detailEquipment.next_inspection_date).diff(dayjs(), 'days') <= 30 ? '#fa8c16' : '#52c41a'
                  }}>
                    {detailEquipment.next_inspection_date}
                    {' '}({dayjs(detailEquipment.next_inspection_date).diff(dayjs(), 'days') >= 0 ? '剩' : '已过'}
                    {Math.abs(dayjs(detailEquipment.next_inspection_date).diff(dayjs(), 'days'))}天)
                  </span>
                ) : '未设置'}
              </Descriptions.Item>
              <Descriptions.Item label="登记人">{detailEquipment.registrant || '-'}</Descriptions.Item>
              <Descriptions.Item label="安全注意事项" span={2}>{detailEquipment.safety_notes || '-'}</Descriptions.Item>
            </Descriptions>

            <Card title="检验记录历史" size="small" style={{ marginTop: 16 }}>
              <Table
                columns={detailInspectionColumns}
                dataSource={detailInspections}
                rowKey="id"
                loading={detailLoading}
                size="small"
                pagination={false}
                scroll={{ x: 900 }}
                locale={{ emptyText: '暂无检验记录' }}
              />
            </Card>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default SpecialEquipmentManagement;
