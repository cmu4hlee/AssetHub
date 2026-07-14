import React, { useState, useEffect } from 'react';
import { useIsMobile, useCan } from '../hooks';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Modal,
  Form,
  message,
  Tag,
  Popconfirm,
  Card,
  Descriptions,
  Row,
  Col,
  Empty,
  Tabs,
  Typography,
} from 'antd';

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  LinkOutlined,
  DisconnectOutlined,
  ApiOutlined,
  FileTextOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { iotDeviceAPI, assetAPI, locationCodeAPI } from '../utils/api';
import DeviceForm from '../components/iot/DeviceForm';
import DeviceStats from '../components/iot/DeviceStats';
import DeviceCard from '../components/iot/DeviceCard';
import APIDocs from '../components/iot/APIDocs';

const { Title, Paragraph, Text } = Typography;

const { Option } = Select;
const { Search } = Input;

const IoTDeviceManagement = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const canDelete = useCan('iot', 'delete');
  const canEdit = useCan('iot', 'edit');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState({
    keyword: '',
    device_type: '',
    status: '',
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [assets, setAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [form] = Form.useForm();
  const [linkForm] = Form.useForm();
  const [linkSubmitLoading, setLinkSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  // 区域编码管理相关状态
  const [locationCodes, setLocationCodes] = useState([]);
  const [locationCodeLoading, setLocationCodeLoading] = useState(false);
  const [locationCodePagination, setLocationCodePagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [locationCodeModalVisible, setLocationCodeModalVisible] = useState(false);
  const [selectedLocationCode, setSelectedLocationCode] = useState(null);
  const [locationCodeForm] = Form.useForm();

  // API文档相关状态
  const [apiDocsVisible, setApiDocsVisible] = useState(false);

  useEffect(() => {
    loadDevices();
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    loadLocationCodes();
  }, [locationCodePagination.current, locationCodePagination.pageSize]);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      };
      const result = await iotDeviceAPI.getDevices(params);
      if (result.success) {
        setDevices(result.data || []);
        setPagination(prev => ({
          ...prev,
          total: result.pagination?.total || 0,
        }));
      } else {
        message.error(result.message || '加载设备列表失败');
      }
    } catch (error) {
      console.error('加载设备列表失败:', error);
      message.error('加载设备列表失败，请检查网络连接或联系管理员');
    } finally {
      setLoading(false);
    }
  };

  const loadAssets = async (keyword = '') => {
    try {
      setAssetLoading(true);
      const result = await assetAPI.getAssets({
        page: 1,
        pageSize: 50,
        keyword,
      });
      if (result.success) {
        setAssets(result.data || []);
      } else {
        message.error(result.message || '加载资产列表失败');
      }
    } catch (error) {
      console.error('加载资产列表失败:', error);
      message.error('加载资产列表失败，请检查网络连接或联系管理员');
    } finally {
      setAssetLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedDevice(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = record => {
    setSelectedDevice(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async id => {
    try {
      setDeleteLoading(true);
      const result = await iotDeviceAPI.deleteDevice(id);
      if (result.success) {
        message.success('设备删除成功');
        loadDevices();
      } else {
        message.error(result.message || '设备删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('设备删除失败，请检查网络连接或联系管理员');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleLink = record => {
    setSelectedDevice(record);
    loadAssets();
    setLinkModalVisible(true);
  };

  const handleUnlink = async device => {
    try {
      setUnlinkLoading(true);
      // 需要先获取关联的资产编码
      const linkResult = await iotDeviceAPI.getDeviceAssets(device.device_id);
      if (linkResult.success && linkResult.data && linkResult.data.length > 0) {
        const assetCode = linkResult.data[0].asset_code;
        const result = await iotDeviceAPI.unlinkDevice(assetCode, device.device_id);
        if (result.success) {
          message.success('解绑成功');
          loadDevices();
        } else {
          message.error(result.message || '解绑失败');
        }
      } else {
        message.warning('该设备未关联资产');
      }
    } catch (error) {
      console.error('解绑失败:', error);
      message.error('解绑失败');
    } finally {
      setUnlinkLoading(false);
    }
  };

  const [submitLoading, setSubmitLoading] = useState(false);

  const handleSubmit = async values => {
    try {
      setSubmitLoading(true);
      if (selectedDevice) {
        const result = await iotDeviceAPI.updateDevice(selectedDevice.id, values);
        if (result.success) {
          message.success('设备更新成功');
          setModalVisible(false);
          form.resetFields();
          loadDevices();
        } else {
          message.error(result.message || '设备更新失败');
        }
      } else {
        const result = await iotDeviceAPI.createDevice(values);
        if (result.success) {
          message.success('设备创建成功');
          setModalVisible(false);
          form.resetFields();
          loadDevices();
        } else {
          message.error(result.message || '设备创建失败');
        }
      }
    } catch (error) {
      console.error(selectedDevice ? '更新失败' : '创建失败:', error);
      message.error(
        selectedDevice
          ? '设备更新失败，请检查网络连接或联系管理员'
          : '设备创建失败，请检查网络连接或联系管理员'
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleLinkSubmit = async values => {
    try {
      setLinkSubmitLoading(true);
      const result = await iotDeviceAPI.linkDevice(values.asset_code, {
        device_id: selectedDevice.device_id,
        device_type: selectedDevice.device_type,
      });
      if (result.success) {
        message.success('设备关联资产成功');
        setLinkModalVisible(false);
        linkForm.resetFields();
        loadDevices();
      } else {
        message.error(result.message || '设备关联资产失败');
      }
    } catch (error) {
      console.error('关联失败:', error);
      message.error('设备关联资产失败，请检查网络连接或联系管理员');
    } finally {
      setLinkSubmitLoading(false);
    }
  };

  const getStatusTag = status => {
    const statusMap = {
      在线: { color: 'success', text: '在线' },
      离线: { color: 'default', text: '离线' },
      故障: { color: 'error', text: '故障' },
      维护中: { color: 'warning', text: '维护中' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getDeviceTypeTag = type => {
    const typeMap = {
      RFID: { color: 'blue', text: 'RFID' },
      GPS: { color: 'green', text: 'GPS' },
      蓝牙: { color: 'purple', text: '蓝牙' },
      WiFi: { color: 'orange', text: 'WiFi' },
      UWB: { color: 'cyan', text: 'UWB' },
      其他: { color: 'default', text: '其他' },
    };
    const config = typeMap[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 设备状态统计
  const [deviceStats, setDeviceStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    fault: 0,
    maintenance: 0,
  });

  // 计算设备状态统计
  useEffect(() => {
    if (devices && devices.length > 0) {
      const stats = {
        total: devices.length,
        online: devices.filter(d => d.status === '在线').length,
        offline: devices.filter(d => d.status === '离线').length,
        fault: devices.filter(d => d.status === '故障').length,
        maintenance: devices.filter(d => d.status === '维护中').length,
      };
      setDeviceStats(stats);
    } else {
      setDeviceStats({
        total: 0,
        online: 0,
        offline: 0,
        fault: 0,
        maintenance: 0,
      });
    }
  }, [devices]);

  const columns = [
    {
      title: '设备ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 150,
      sorter: (a, b) => a.device_id.localeCompare(b.device_id),
      sortDirections: ['ascend', 'descend'],
    },
    {
      title: '设备名称',
      dataIndex: 'device_name',
      key: 'device_name',
      width: 150,
      sorter: (a, b) => a.device_name.localeCompare(b.device_name),
      sortDirections: ['ascend', 'descend'],
    },
    {
      title: '设备类型',
      dataIndex: 'device_type',
      key: 'device_type',
      width: 100,
      render: type => getDeviceTypeTag(type),
      filters: [
        { text: 'RFID', value: 'RFID' },
        { text: 'GPS', value: 'GPS' },
        { text: '蓝牙', value: '蓝牙' },
        { text: 'WiFi', value: 'WiFi' },
        { text: 'UWB', value: 'UWB' },
        { text: '其他', value: '其他' },
      ],
      onFilter: (value, record) => record.device_type === value,
    },
    {
      title: '制造商',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
      width: 120,
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: status => getStatusTag(status),
      filters: [
        { text: '在线', value: '在线' },
        { text: '离线', value: '离线' },
        { text: '故障', value: '故障' },
        { text: '维护中', value: '维护中' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: '最后在线时间',
      dataIndex: 'last_online_time',
      key: 'last_online_time',
      width: 180,
      render: time => (time ? new Date(time).toLocaleString() : '-'),
      sorter: (a, b) => {
        if (!a.last_online_time) return 1;
        if (!b.last_online_time) return -1;
        return new Date(a.last_online_time) - new Date(b.last_online_time);
      },
      sortDirections: ['ascend', 'descend'],
    },
    {
      title: '关联资产',
      dataIndex: 'linked_asset_id',
      key: 'linked_asset_id',
      width: 120,
      render: (linked_asset_id, record) => {
        if (linked_asset_id) {
          return <Tag color="blue">{linked_asset_id}</Tag>;
        }
        return <Tag color="default">未关联</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            title="查看详情"
          >
            详情
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            title="编辑设备"
          >
            编辑
          </Button>
          <Button
            type="link"
            icon={<LinkOutlined />}
            onClick={() => handleLink(record)}
            disabled={record.linked_asset_id}
            title="关联资产"
          >
            关联
          </Button>
          {record.linked_asset_id && (
            <Popconfirm
              title="确定要解绑该设备吗？"
              onConfirm={() => handleUnlink(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                danger
                icon={<DisconnectOutlined />}
                title="解绑资产"
                loading={unlinkLoading}
              >
                解绑
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title="确定要删除这个设备吗？"
            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              title="删除设备"
              loading={deleteLoading}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleViewDetail = record => {
    setSelectedDevice(record);
    setDetailModalVisible(true);
  };

  // 区域编码管理相关函数
  const loadLocationCodes = async () => {
    try {
      setLocationCodeLoading(true);
      const params = {
        page: locationCodePagination.current,
        pageSize: locationCodePagination.pageSize,
      };
      const result = await locationCodeAPI.getLocationCodes(params);
      if (result.success) {
        setLocationCodes(result.data || []);
        setLocationCodePagination(prev => ({
          ...prev,
          total: result.pagination.total,
        }));
      }
    } catch (error) {
      message.error('加载区域编码列表失败');
    } finally {
      setLocationCodeLoading(false);
    }
  };

  const handleLocationCodeCreate = () => {
    setSelectedLocationCode(null);
    locationCodeForm.resetFields();
    setLocationCodeModalVisible(true);
  };

  const handleLocationCodeEdit = record => {
    setSelectedLocationCode(record);
    locationCodeForm.setFieldsValue(record);
    setLocationCodeModalVisible(true);
  };

  const handleLocationCodeDelete = async id => {
    try {
      const result = await locationCodeAPI.deleteLocationCode(id);
      if (result.success) {
        message.success('删除成功');
        loadLocationCodes();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleLocationCodeSubmit = async values => {
    try {
      // 处理表单数据，确保数据类型正确
      const processedValues = {
        ...values,
        floor_number:
          values.floor_number !== undefined &&
          values.floor_number !== null &&
          values.floor_number !== ''
            ? parseInt(values.floor_number)
            : undefined,
        latitude:
          values.latitude !== undefined && values.latitude !== null && values.latitude !== ''
            ? parseFloat(values.latitude)
            : undefined,
        longitude:
          values.longitude !== undefined && values.longitude !== null && values.longitude !== ''
            ? parseFloat(values.longitude)
            : undefined,
        is_active: values.is_active !== undefined ? (values.is_active ? 1 : 0) : 1,
      };

      if (selectedLocationCode) {
        const result = await locationCodeAPI.updateLocationCode(
          selectedLocationCode.id,
          processedValues
        );
        if (result.success) {
          message.success('更新成功');
          setLocationCodeModalVisible(false);
          locationCodeForm.resetFields();
          loadLocationCodes();
        } else {
          message.error(result.message || '更新失败');
        }
      } else {
        const result = await locationCodeAPI.createLocationCode(processedValues);
        if (result.success) {
          message.success('创建成功');
          setLocationCodeModalVisible(false);
          locationCodeForm.resetFields();
          loadLocationCodes();
        } else {
          message.error(result.message || '创建失败');
        }
      }
    } catch (error) {
      console.error(selectedLocationCode ? '更新失败' : '创建失败:', error);
      message.error(selectedLocationCode ? '更新失败' : '创建失败');
    }
  };

  // 获取当前域名和端口
  const getApiBaseUrl = () => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;
    const baseUrl = port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
    return `${baseUrl}/api/asset-location/beacon-location`;
  };

  const apiBaseUrl = getApiBaseUrl();

  return (
    <div
      className="iot-device-management"
      style={{ backgroundColor: '#f5f5f5', minHeight: '100vh', padding: '20px' }}
    >
      <div
        style={{
          marginBottom: isMobile ? 16 : 24,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? 12 : 0,
          backgroundColor: '#fff',
          padding: isMobile ? '16px' : '24px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? '20px' : '28px',
            margin: 0,
            color: '#1890ff',
            fontWeight: 'bold',
          }}
        >
          物联网硬件管理
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            icon={<ApiOutlined />}
            size={isMobile ? 'small' : 'middle'}
            onClick={() => setApiDocsVisible(true)}
            style={{ backgroundColor: '#e6f7ff', borderColor: '#91d5ff' }}
          >
            API文档
          </Button>
        </div>
      </div>

      <Tabs
        defaultActiveKey="devices"
        size={isMobile ? 'small' : 'middle'}
        items={[
          {
            key: 'devices',
            label: (
              <span>
                <FileTextOutlined /> 定位硬件管理
              </span>
            ),
            children: (
              <>
                <div
                  style={{
                    marginBottom: isMobile ? 12 : 16,
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'stretch' : 'center',
                    gap: isMobile ? 8 : 0,
                  }}
                >
                  <Space wrap>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleCreate}
                      size={isMobile ? 'small' : 'middle'}
                      style={{ boxShadow: '0 2px 8px rgba(24, 144, 255, 0.3)' }}
                    >
                      添加设备
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={loadDevices}
                      size={isMobile ? 'small' : 'middle'}
                      loading={loading}
                    >
                      刷新
                    </Button>
                  </Space>
                </div>

                <Card
                  title="筛选条件"
                  size="small"
                  style={{
                    marginBottom: isMobile ? 12 : 16,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: isMobile ? 'column' : 'row',
                      gap: isMobile ? 8 : 12,
                      alignItems: isMobile ? 'stretch' : 'center',
                    }}
                  >
                    <Search
                      placeholder="搜索设备ID/名称"
                      style={{ width: isMobile ? '100%' : 300 }}
                      allowClear
                      value={filters.keyword}
                      onChange={e => setFilters({ ...filters, keyword: e.target.value })}
                      onSearch={loadDevices}
                      enterButton
                      size={isMobile ? 'small' : 'middle'}
                    />
                    <Select
                      placeholder="设备类型"
                      style={{ width: isMobile ? '100%' : 150 }}
                      allowClear
                      value={filters.device_type || undefined}
                      onChange={value => setFilters({ ...filters, device_type: value || '' })}
                      size={isMobile ? 'small' : 'middle'}
                    >
                      <Option value="RFID">RFID</Option>
                      <Option value="GPS">GPS</Option>
                      <Option value="蓝牙">蓝牙</Option>
                      <Option value="WiFi">WiFi</Option>
                      <Option value="UWB">UWB</Option>
                      <Option value="其他">其他</Option>
                    </Select>
                    <Select
                      placeholder="设备状态"
                      style={{ width: isMobile ? '100%' : 120 }}
                      allowClear
                      value={filters.status || undefined}
                      onChange={value => setFilters({ ...filters, status: value || '' })}
                      size={isMobile ? 'small' : 'middle'}
                    >
                      <Option value="在线">在线</Option>
                      <Option value="离线">离线</Option>
                      <Option value="故障">故障</Option>
                      <Option value="维护中">维护中</Option>
                    </Select>
                  </div>
                </Card>

                {/* 设备状态统计 */}
                <DeviceStats deviceStats={deviceStats} isMobile={isMobile} />

                {/* 桌面端表格 */}
                <div className="hide-on-mobile">
                  <Table
                    columns={columns}
                    dataSource={devices}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                      ...pagination,
                      showSizeChanger: true,
                      showTotal: total => `共 ${total} 条`,
                      onChange: (page, pageSize) => {
                        setPagination({ ...pagination, current: page, pageSize });
                      },
                      showQuickJumper: true,
                    }}
                    scroll={{ x: 1200 }}
                    size={isMobile ? 'small' : 'middle'}
                    className="iot-device-table"
                    style={{
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                    onRow={(record, index) => ({
                      onMouseEnter: () => {
                        // 鼠标悬停效果已通过CSS实现
                      },
                      style: {
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      },
                      onClick: () => handleViewDetail(record),
                    })}
                  />
                </div>

                {/* 移动端卡片列表 */}
                <div className="mobile-table-cards show-on-mobile">
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                      <div style={{ fontSize: '16px', color: '#1890ff', marginBottom: '8px' }}>
                        加载中...
                      </div>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          border: '3px solid #1890ff',
                          borderTop: '3px solid transparent',
                          borderRadius: '50%',
                          margin: '0 auto',
                          animation: 'spin 1s linear infinite',
                        }}
                      ></div>
                      <style>{`
                        @keyframes spin {
                          0% { transform: rotate(0deg); }
                          100% { transform: rotate(360deg); }
                        }
                      `}</style>
                    </div>
                  ) : Array.isArray(devices) && devices.length > 0 ? (
                    <>
                      {devices.map(device => (
                        <DeviceCard
                          key={device.id}
                          device={device}
                          onViewDetail={handleViewDetail}
                          onEdit={handleEdit}
                          onLink={handleLink}
                          onUnlink={handleUnlink}
                          getStatusTag={getStatusTag}
                          getDeviceTypeTag={getDeviceTypeTag}
                          unlinkLoading={unlinkLoading}
                        />
                      ))}
                      {/* 移动端分页 */}
                      <div
                        style={{
                          marginTop: '16px',
                          textAlign: 'center',
                          padding: '16px',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '8px',
                        }}
                      >
                        <Space>
                          <Button
                            disabled={pagination.current === 1}
                            onClick={() =>
                              setPagination({ ...pagination, current: pagination.current - 1 })
                            }
                            size="small"
                          >
                            上一页
                          </Button>
                          <span style={{ fontSize: '14px', color: '#666' }}>
                            第 {pagination.current} /{' '}
                            {Math.ceil(pagination.total / pagination.pageSize)} 页
                          </span>
                          <Button
                            disabled={
                              pagination.current >=
                              Math.ceil(pagination.total / pagination.pageSize)
                            }
                            onClick={() =>
                              setPagination({ ...pagination, current: pagination.current + 1 })
                            }
                            size="small"
                          >
                            下一页
                          </Button>
                        </Space>
                        <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                          共 {pagination.total} 条
                        </div>
                      </div>
                    </>
                  ) : (
                    <Empty description="暂无设备" style={{ padding: '40px 0' }}>
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                        添加设备
                      </Button>
                    </Empty>
                  )}
                </div>

                {/* 设备表单模态框 */}
                <Modal
                  title={selectedDevice ? '编辑设备' : '添加设备'}
                  open={modalVisible}
                  onCancel={() => {
                    setModalVisible(false);
                    form.resetFields();
                  }}
                  onOk={() => form.submit()}
                  confirmLoading={submitLoading}
                  width={isMobile ? '95vw' : 600}
                  centered
                  style={{ borderRadius: '8px' }}
                >
                  <DeviceForm
                    form={form}
                    onFinish={handleSubmit}
                    submitLoading={submitLoading}
                    selectedDevice={selectedDevice}
                  />
                </Modal>

                {/* 设备详情模态框 */}
                <Modal
                  title="设备详情"
                  open={detailModalVisible}
                  onCancel={() => setDetailModalVisible(false)}
                  footer={[
                    <Button key="close" onClick={() => setDetailModalVisible(false)}>
                      关闭
                    </Button>,
                  ]}
                  width={isMobile ? '95vw' : 700}
                  centered
                  style={{ borderRadius: '8px' }}
                >
                  {selectedDevice && (
                    <Descriptions
                      column={isMobile ? 1 : 2}
                      bordered
                      size={isMobile ? 'small' : 'middle'}
                    >
                      <Descriptions.Item label="设备ID">
                        {selectedDevice.device_id}
                      </Descriptions.Item>
                      <Descriptions.Item label="设备名称">
                        {selectedDevice.device_name}
                      </Descriptions.Item>
                      <Descriptions.Item label="设备类型">
                        {getDeviceTypeTag(selectedDevice.device_type)}
                      </Descriptions.Item>
                      <Descriptions.Item label="状态">
                        {getStatusTag(selectedDevice.status)}
                      </Descriptions.Item>
                      <Descriptions.Item label="制造商">
                        {selectedDevice.manufacturer || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="型号">
                        {selectedDevice.model || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="序列号">
                        {selectedDevice.serial_number || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="MAC地址">
                        {selectedDevice.mac_address || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="固件版本">
                        {selectedDevice.firmware_version || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="最后在线时间">
                        {selectedDevice.last_online_time
                          ? new Date(selectedDevice.last_online_time).toLocaleString()
                          : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="创建时间">
                        {selectedDevice.created_at
                          ? new Date(selectedDevice.created_at).toLocaleString()
                          : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="备注" span={isMobile ? 1 : 2}>
                        {selectedDevice.remark || '-'}
                      </Descriptions.Item>
                    </Descriptions>
                  )}
                </Modal>

                {/* 关联资产模态框 */}
                <Modal
                  title="关联资产"
                  open={linkModalVisible}
                  onCancel={() => {
                    setLinkModalVisible(false);
                    linkForm.resetFields();
                  }}
                  onOk={() => linkForm.submit()}
                  confirmLoading={linkSubmitLoading}
                  width={isMobile ? '95vw' : 600}
                  centered
                  style={{ borderRadius: '8px' }}
                >
                  <Form form={linkForm} layout="vertical" onFinish={handleLinkSubmit}>
                    <Form.Item
                      name="asset_code"
                      label="选择资产"
                      rules={[{ required: true, message: '请选择要关联的资产' }]}
                    >
                      <Select
                        showSearch
                        placeholder="搜索资产编号或名称"
                        filterOption={false}
                        onSearch={loadAssets}
                        onFocus={() => loadAssets()}
                        loading={assetLoading}
                        notFoundContent={assetLoading ? '加载中...' : '暂无数据'}
                        size={isMobile ? 'small' : 'middle'}
                      >
                        {assets.map(asset => (
                          <Option key={asset.asset_code} value={asset.asset_code}>
                            {asset.asset_code} - {asset.asset_name}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Form>
                </Modal>
              </>
            ),
          },
          {
            key: 'location-codes',
            label: (
              <span>
                <AppstoreOutlined /> 区域编码管理
              </span>
            ),
            children: (
              <>
                <div
                  style={{
                    marginBottom: isMobile ? 12 : 16,
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'stretch' : 'center',
                    gap: isMobile ? 8 : 0,
                  }}
                >
                  <Space wrap>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleLocationCodeCreate}
                      size={isMobile ? 'small' : 'middle'}
                      style={{ boxShadow: '0 2px 8px rgba(24, 144, 255, 0.3)' }}
                    >
                      添加区域编码
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={loadLocationCodes}
                      loading={locationCodeLoading}
                      size={isMobile ? 'small' : 'middle'}
                    >
                      刷新
                    </Button>
                  </Space>
                </div>
                <Table
                  columns={[
                    {
                      title: '序号',
                      key: 'index',
                      width: 80,
                      fixed: 'left',
                      render: (_, __, index) => {
                        const { current, pageSize } = locationCodePagination;
                        return (current - 1) * pageSize + index + 1;
                      },
                    },
                    {
                      title: '编码',
                      dataIndex: 'location_code',
                      key: 'location_code',
                      width: 200,
                    },
                    {
                      title: '区域名称',
                      dataIndex: 'location_name',
                      key: 'location_name',
                      width: 300,
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: 150,
                      fixed: 'right',
                      render: (_, record) => (
                        <Space>
                          <Button
                            type="link"
                            icon={<EditOutlined />}
                            onClick={() => handleLocationCodeEdit(record)}
                            size="small"
                          >
                            编辑
                          </Button>
                          <Popconfirm
                            title="确定要删除这个区域编码吗？"
                            onConfirm={() => handleLocationCodeDelete(record.id)}
                            okText="确定"
                            cancelText="取消"
                          >
                            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete} size="small">
                              删除
                            </Button>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                  dataSource={locationCodes}
                  rowKey="id"
                  loading={locationCodeLoading}
                  pagination={{
                    ...locationCodePagination,
                    showSizeChanger: true,
                    showTotal: total => `共 ${total} 条`,
                    onChange: (page, pageSize) => {
                      setLocationCodePagination({
                        ...locationCodePagination,
                        current: page,
                        pageSize,
                      });
                    },
                  }}
                  scroll={{ x: 800 }}
                  size={isMobile ? 'small' : 'middle'}
                  style={{
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                />
                {/* 区域编码表单模态框 */}
                <Modal
                  title={selectedLocationCode ? '编辑区域编码' : '添加区域编码'}
                  open={locationCodeModalVisible}
                  onCancel={() => {
                    setLocationCodeModalVisible(false);
                    locationCodeForm.resetFields();
                  }}
                  onOk={() => locationCodeForm.submit()}
                  width={isMobile ? '95vw' : 600}
                  centered
                  style={{ borderRadius: '8px' }}
                >
                  <Form
                    form={locationCodeForm}
                    layout="vertical"
                    onFinish={handleLocationCodeSubmit}
                  >
                    <Form.Item
                      name="location_code"
                      label="编码"
                      rules={[{ required: true, message: '请输入编码' }]}
                    >
                      <Input placeholder="请输入区域编码" disabled={!!selectedLocationCode} />
                    </Form.Item>
                    <Form.Item
                      name="location_name"
                      label="区域名称"
                      rules={[{ required: true, message: '请输入区域名称' }]}
                    >
                      <Input placeholder="请输入区域名称" />
                    </Form.Item>
                    <Form.Item name="description" label="描述">
                      <Input.TextArea rows={3} placeholder="请输入区域描述" />
                    </Form.Item>
                    <Form.Item name="building_name" label="建筑物名称">
                      <Input placeholder="例如：主楼、东楼" />
                    </Form.Item>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item name="floor_number" label="楼层号">
                          <Input type="number" placeholder="例如：1、2" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="room_number" label="房间号">
                          <Input placeholder="例如：101、A201" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="area_name" label="区域名称">
                      <Input placeholder="例如：一楼大厅、停车场" />
                    </Form.Item>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item name="latitude" label="纬度">
                          <Input type="number" step="0.000001" placeholder="例如：39.9042" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="longitude" label="经度">
                          <Input type="number" step="0.000001" placeholder="例如：116.4074" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="is_active" label="状态" initialValue={1}>
                      <Select>
                        <Option value={1}>激活</Option>
                        <Option value={0}>停用</Option>
                      </Select>
                    </Form.Item>
                  </Form>
                </Modal>
              </>
            ),
          },
          {
            key: 'api-docs',
            label: (
              <span>
                <ApiOutlined /> API调用说明
              </span>
            ),
            children: <APIDocs apiBaseUrl={apiBaseUrl} />,
          },
        ]}
      />

      {/* API文档模态框 */}
      <Modal
        title="IoT设备管理API文档"
        open={apiDocsVisible}
        onCancel={() => setApiDocsVisible(false)}
        footer={[
          <Button key="close" onClick={() => setApiDocsVisible(false)}>
            关闭
          </Button>,
        ]}
        width={isMobile ? '95vw' : 900}
        centered
        style={{ borderRadius: '8px' }}
      >
        <div style={{ padding: '16px' }}>
          <Typography>
            <Title level={4}>API接口说明</Title>
            <Paragraph>
              本模块提供了完整的物联网设备管理API，支持设备的创建、查询、更新、删除以及与资产的关联操作。
            </Paragraph>

            <Title level={5}>设备管理接口</Title>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="获取设备列表">
                <Text strong>GET /api/iot/devices</Text>
                <Paragraph>支持分页、关键词搜索、设备类型和状态过滤</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="创建设备">
                <Text strong>POST /api/iot/devices</Text>
                <Paragraph>需要提供设备ID、名称、类型等基本信息</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="更新设备">
                <Text strong>
                  PUT /api/iot/devices/{'{'}id{'}'}
                </Text>
                <Paragraph>更新设备的基本信息和状态</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="删除设备">
                <Text strong>
                  DELETE /api/iot/devices/{'{'}id{'}'}
                </Text>
                <Paragraph>删除指定的设备</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="获取设备详情">
                <Text strong>
                  GET /api/iot/devices/{'{'}id{'}'}
                </Text>
                <Paragraph>获取设备的详细信息</Paragraph>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>资产关联接口</Title>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="关联设备到资产">
                <Text strong>
                  POST /api/iot/assets/{'{'}assetCode{'}'}/devices
                </Text>
                <Paragraph>将设备与资产进行关联</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="解绑设备">
                <Text strong>
                  DELETE /api/iot/assets/{'{'}assetCode{'}'}/devices/{'{'}deviceId{'}'}
                </Text>
                <Paragraph>解除设备与资产的关联</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="获取设备的关联资产">
                <Text strong>
                  GET /api/iot/devices/{'{'}deviceId{'}'}/assets
                </Text>
                <Paragraph>获取设备关联的资产信息</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="获取资产的关联设备">
                <Text strong>
                  GET /api/iot/assets/{'{'}assetCode{'}'}/devices
                </Text>
                <Paragraph>获取资产关联的设备信息</Paragraph>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>设备数据接口</Title>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="硬件数据上报接口">
                <Text strong>
                  POST /api/iot/devices/{'{'}deviceId{'}'}/data
                </Text>
                <Paragraph>外部设备上报数据的接口</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="获取设备数据">
                <Text strong>
                  GET /api/iot/devices/{'{'}deviceId{'}'}/data
                </Text>
                <Paragraph>获取设备上报的数据，支持时间范围过滤</Paragraph>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>设备类型</Title>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {['RFID', 'GPS', '蓝牙', 'WiFi', 'UWB', '其他'].map(type => (
                <Tag key={type} color="blue">
                  {type}
                </Tag>
              ))}
            </div>

            <Title level={5}>设备状态</Title>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              <Tag color="success">在线</Tag>
              <Tag color="default">离线</Tag>
              <Tag color="error">故障</Tag>
              <Tag color="warning">维护中</Tag>
            </div>
          </Typography>
        </div>
      </Modal>
    </div>
  );
};

export default IoTDeviceManagement;
