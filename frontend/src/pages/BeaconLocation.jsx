import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../hooks';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  message,
  Descriptions,
  Row,
  Col,
  Empty,
  Typography,
  Divider,
} from 'antd';

import {
  SearchOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  AimOutlined,
  RadarChartOutlined,
} from '@ant-design/icons';
import { assetLocationAPI } from '../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { Title, Text } = Typography;

const BeaconLocation = () => {
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const isMobile = useIsMobile();
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

  useEffect(() => {
    loadAssets();
  }, [pagination.current, pagination.pageSize, filters]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      };
      const result = await assetLocationAPI.getBeaconAssets(params);
      if (result.success) {
        setAssets(result.data || []);
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total,
        }));
      }
    } catch (error) {
      console.error('加载区域定位资产列表失败:', error);
      message.error('加载资产列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAsset = asset => {
    setSelectedAsset(asset);
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

  const getAssetStatusTag = status => {
    const colorMap = {
      在用: 'green',
      闲置: 'orange',
      维修: 'red',
      报废: 'default',
      调配中: 'blue',
    };
    return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
  };

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 200,
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
    },
    {
      title: '资产状态',
      dataIndex: 'asset_status',
      key: 'asset_status',
      width: 100,
      render: status => getAssetStatusTag(status),
    },
    {
      title: '信标设备ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 150,
    },
    {
      title: '设备名称',
      dataIndex: 'device_name',
      key: 'device_name',
      width: 150,
    },
    {
      title: '设备类型',
      dataIndex: 'device_type',
      key: 'device_type',
      width: 100,
      render: type => getDeviceTypeTag(type),
    },
    {
      title: '设备状态',
      dataIndex: 'device_status',
      key: 'device_status',
      width: 100,
      render: status => getStatusTag(status),
    },
    {
      title: '位置信息',
      key: 'location',
      width: 200,
      render: (_, record) => {
        if (record.building_name || record.room_number || record.area_name) {
          return `${record.building_name || ''} ${record.floor_number ? `${record.floor_number}楼` : ''} ${record.room_number || ''} ${record.area_name || ''}`.trim();
        }
        if (record.latitude && record.longitude) {
          return `${parseFloat(record.latitude).toFixed(4)}, ${parseFloat(record.longitude).toFixed(4)}`;
        }
        return '-';
      },
    },
    {
      title: '最后更新时间',
      dataIndex: 'last_update_time',
      key: 'last_update_time',
      width: 180,
      render: time => (time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EnvironmentOutlined />}
          onClick={() => handleSelectAsset(record)}
          size="small"
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div
      style={{
        padding: isMobile ? '8px' : '16px',
        backgroundColor: '#f5f7fa',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          marginBottom: isMobile ? 12 : 16,
          padding: isMobile ? '12px' : '16px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #e8e8e8',
        }}
      >
        <Space align="center">
          <RadarChartOutlined style={{ fontSize: isMobile ? '20px' : '24px', color: '#1890ff' }} />
          <Title
            level={2}
            style={{
              fontSize: isMobile ? '18px' : '24px',
              margin: 0,
              color: '#1890ff',
              fontWeight: 600,
            }}
          >
            区域定位
          </Title>
        </Space>
        <Text
          type="secondary"
          style={{
            display: 'block',
            marginTop: '8px',
            fontSize: isMobile ? '12px' : '14px',
          }}
        >
          显示已关联定位信标设备的资产列表，通过信标设备实现区域定位功能
        </Text>
      </div>

      <Row gutter={isMobile ? 8 : 16}>
        {/* 左侧：资产列表 */}
        <Col xs={24} lg={selectedAsset ? 14 : 24}>
          <Card
            title={
              <Space>
                <RadarChartOutlined style={{ color: '#1890ff' }} />
                <span style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 600 }}>
                  已关联信标设备的资产
                </span>
              </Space>
            }
            extra={
              <Button
                icon={<ReloadOutlined />}
                onClick={loadAssets}
                loading={loading}
                size={isMobile ? 'small' : 'middle'}
              >
                刷新
              </Button>
            }
            style={{
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid #e8e8e8',
            }}
          >
            <Space
              orientation="vertical"
              style={{ width: '100%', marginBottom: isMobile ? '12px' : '16px' }}
            >
              <Input
                placeholder="搜索资产编号或名称"
                prefix={<SearchOutlined />}
                value={filters.keyword}
                onChange={e => setFilters({ ...filters, keyword: e.target.value })}
                onPressEnter={loadAssets}
                allowClear
                size={isMobile ? 'small' : 'middle'}
              />
              <Space wrap>
                <Select
                  placeholder="设备类型"
                  style={{ width: isMobile ? '100%' : 150 }}
                  value={filters.device_type || undefined}
                  onChange={value => setFilters({ ...filters, device_type: value || '' })}
                  allowClear
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
                  value={filters.status || undefined}
                  onChange={value => setFilters({ ...filters, status: value || '' })}
                  allowClear
                  size={isMobile ? 'small' : 'middle'}
                >
                  <Option value="在线">在线</Option>
                  <Option value="离线">离线</Option>
                  <Option value="故障">故障</Option>
                  <Option value="维护中">维护中</Option>
                </Select>
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={loadAssets}
                  size={isMobile ? 'small' : 'middle'}
                >
                  搜索
                </Button>
              </Space>
            </Space>

            {/* 桌面端表格 */}
            <div className="hide-on-mobile">
              <Table
                columns={columns}
                dataSource={assets}
                rowKey="asset_id"
                loading={loading}
                pagination={{
                  ...pagination,
                  showSizeChanger: true,
                  showTotal: total => `共 ${total} 条`,
                  onChange: (page, pageSize) => {
                    setPagination({ ...pagination, current: page, pageSize });
                  },
                }}
                scroll={{ x: 1400 }}
                size={isMobile ? 'small' : 'middle'}
                onRow={record => ({
                  onClick: () => handleSelectAsset(record),
                  style: {
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  },
                  onMouseEnter: e => {
                    e.currentTarget.style.backgroundColor = '#f5f7fa';
                  },
                  onMouseLeave: e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  },
                })}
              />
            </div>

            {/* 移动端卡片列表 */}
            <div className="mobile-table-cards show-on-mobile">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
              ) : Array.isArray(assets) && assets.length > 0 ? (
                <>
                  {assets.map(asset => (
                    <div
                      key={asset.asset_id}
                      className="mobile-card-item"
                      onClick={() => handleSelectAsset(asset)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="mobile-card-header">
                        <span className="mobile-card-title">{asset.asset_name || '-'}</span>
                        <Tag color={asset.status === '在用' ? 'green' : 'default'}>
                          {asset.status || '-'}
                        </Tag>
                      </div>
                      <div className="mobile-card-body">
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">资产编号</span>
                          <span className="mobile-card-value">{asset.asset_code || '-'}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">设备ID</span>
                          <span className="mobile-card-value">{asset.device_id || '-'}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">设备类型</span>
                          <span className="mobile-card-value">{asset.device_type || '-'}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">位置编码</span>
                          <span className="mobile-card-value">{asset.location_code || '-'}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">位置名称</span>
                          <span className="mobile-card-value">{asset.location_name || '-'}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">部门</span>
                          <span className="mobile-card-value">{asset.department || '-'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* 移动端分页 */}
                  <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <Space>
                      <Button
                        disabled={pagination.current === 1}
                        onClick={() =>
                          setPagination({ ...pagination, current: pagination.current - 1 })
                        }
                      >
                        上一页
                      </Button>
                      <span>
                        第 {pagination.current} /{' '}
                        {Math.ceil(pagination.total / pagination.pageSize)} 页
                      </span>
                      <Button
                        disabled={
                          pagination.current >= Math.ceil(pagination.total / pagination.pageSize)
                        }
                        onClick={() =>
                          setPagination({ ...pagination, current: pagination.current + 1 })
                        }
                      >
                        下一页
                      </Button>
                    </Space>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
              )}
            </div>
          </Card>
        </Col>

        {/* 右侧：资产详情 */}
        {selectedAsset && (
          <Col xs={24} lg={10}>
            <Card
              title={
                <Space>
                  <AimOutlined style={{ color: '#1890ff' }} />
                  <span style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 600 }}>
                    定位详情
                  </span>
                </Space>
              }
              extra={
                <Button type="link" onClick={() => setSelectedAsset(null)} size="small">
                  关闭
                </Button>
              }
              style={{
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid #e8e8e8',
              }}
            >
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="资产编号">{selectedAsset.asset_code}</Descriptions.Item>
                <Descriptions.Item label="资产名称">{selectedAsset.asset_name}</Descriptions.Item>
                <Descriptions.Item label="部门">
                  {selectedAsset.department || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="资产状态">
                  {getAssetStatusTag(selectedAsset.asset_status)}
                </Descriptions.Item>
                <Divider style={{ margin: '8px 0' }} />
                <Descriptions.Item label="信标设备ID">
                  <Text code>{selectedAsset.device_id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="设备名称">
                  {selectedAsset.device_name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="设备类型">
                  {getDeviceTypeTag(selectedAsset.device_type)}
                </Descriptions.Item>
                <Descriptions.Item label="设备状态">
                  {getStatusTag(selectedAsset.device_status)}
                </Descriptions.Item>
                {selectedAsset.last_online_time && (
                  <Descriptions.Item label="最后在线时间">
                    {dayjs(selectedAsset.last_online_time).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                )}
                {selectedAsset.battery_level !== null && (
                  <Descriptions.Item label="设备电量">
                    {selectedAsset.battery_level}%
                    {selectedAsset.battery_level < 20 && (
                      <Tag color="red" style={{ marginLeft: '8px' }}>
                        低电量
                      </Tag>
                    )}
                  </Descriptions.Item>
                )}
                {selectedAsset.signal_strength !== null && (
                  <Descriptions.Item label="信号强度">
                    {selectedAsset.signal_strength}
                  </Descriptions.Item>
                )}
                <Divider style={{ margin: '8px 0' }} />
                {selectedAsset.latitude && selectedAsset.longitude && (
                  <>
                    <Descriptions.Item label="地理坐标">
                      <Text code>
                        {parseFloat(selectedAsset.latitude).toFixed(6)},{' '}
                        {parseFloat(selectedAsset.longitude).toFixed(6)}
                      </Text>
                    </Descriptions.Item>
                    {selectedAsset.location_accuracy && (
                      <Descriptions.Item label="定位精度">
                        {selectedAsset.location_accuracy} 米
                      </Descriptions.Item>
                    )}
                  </>
                )}
                {selectedAsset.building_name && (
                  <Descriptions.Item label="建筑物">
                    {selectedAsset.building_name}
                  </Descriptions.Item>
                )}
                {selectedAsset.floor_number && (
                  <Descriptions.Item label="楼层">
                    {selectedAsset.floor_number} 楼
                  </Descriptions.Item>
                )}
                {selectedAsset.room_number && (
                  <Descriptions.Item label="房间号">{selectedAsset.room_number}</Descriptions.Item>
                )}
                {selectedAsset.area_name && (
                  <Descriptions.Item label="区域">{selectedAsset.area_name}</Descriptions.Item>
                )}
                {selectedAsset.address && (
                  <Descriptions.Item label="详细地址">{selectedAsset.address}</Descriptions.Item>
                )}
                <Descriptions.Item label="最后更新时间">
                  {selectedAsset.last_update_time
                    ? dayjs(selectedAsset.last_update_time).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default BeaconLocation;
