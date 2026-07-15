import React, { useState, useEffect } from 'react';
import {
  Card,
  List,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Typography,
  Spin,
  message,
  Divider,
  Radio,
  Alert,
  Modal,
} from 'antd';

import {
  ScanOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
  CameraOutlined,
  BarcodeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { inventoryAPI } from '../utils/api';
import { useIsMobile } from '../hooks';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const SelfInventory = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [inventoryWindows, setInventoryWindows] = useState([]);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [assetCode, setAssetCode] = useState('');
  const [assetInfo, setAssetInfo] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [formData, setFormData] = useState({
    actual_location: '',
    actual_status: '',
    discrepancy_type: '',
    discrepancy_desc: '',
  });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    loadInventoryWindows();
  }, []);

  const loadInventoryWindows = async () => {
    try {
      setLoading(true);
      const result = await inventoryAPI.getSelfInventoryWindows();
      if (result.success) {
        setInventoryWindows(result.data || []);
      }
    } catch (error) {
      message.error('加载盘点窗口失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInventory = async (inventory) => {
    setSelectedInventory(inventory);
    setAssetInfo(null);
    setFormData({
      actual_location: '',
      actual_status: '',
      discrepancy_type: '',
      discrepancy_desc: '',
    });
    setAssetCode('');
    setHistory([]);
  };

  const handleScanAsset = async () => {
    if (!assetCode.trim()) {
      message.warning('请输入资产编码');
      return;
    }
    if (!selectedInventory) {
      message.warning('请先选择盘点');
      return;
    }

    try {
      setLoading(true);
      const result = await inventoryAPI.getSelfInventoryAssets(selectedInventory.id);
      const assets = result.data || [];
      const asset = assets.find(a => a.asset_code === assetCode.trim());

      if (asset) {
        setAssetInfo(asset);
        setFormData(prev => ({
          ...prev,
          actual_location: asset.location || '',
          actual_status: asset.status || '',
        }));
        message.success('资产已找到');
      } else {
        message.error('该资产不在本次盘点范围内');
        setAssetInfo(null);
      }
    } catch (error) {
      message.error('查询资产失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!assetInfo) {
      message.warning('请先扫描资产');
      return;
    }

    try {
      setConfirming(true);
      const result = await inventoryAPI.confirmSelfInventory({
        inventory_id: selectedInventory.id,
        asset_code: assetInfo.asset_code,
        actual_location: formData.actual_location || null,
        actual_status: formData.actual_status || null,
        discrepancy_type: formData.discrepancy_type || null,
        discrepancy_desc: formData.discrepancy_desc || null,
      });

      if (result.success) {
        message.success('盘点确认成功');
        setHistory(prev => [{
          asset_code: assetInfo.asset_code,
          asset_name: assetInfo.asset_name,
          discrepancy_type: formData.discrepancy_type || '正常',
          time: new Date(),
        }, ...prev]);
        setAssetInfo(null);
        setAssetCode('');
        setFormData({
          actual_location: '',
          actual_status: '',
          discrepancy_type: '',
          discrepancy_desc: '',
        });
      } else {
        message.error(result.message || '盘点确认失败');
      }
    } catch (error) {
      message.error('盘点确认失败');
    } finally {
      setConfirming(false);
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      '进行中': <Tag color="blue">进行中</Tag>,
      '已完成': <Tag color="green">已完成</Tag>,
      '已取消': <Tag color="red">已取消</Tag>,
    };
    return statusMap[status] || <Tag>{status}</Tag>;
  };

  const getDiscrepancyTag = (type) => {
    const map = {
      '正常': <Tag color="green">正常</Tag>,
      '位置不符': <Tag color="orange">位置不符</Tag>,
      '状态不符': <Tag color="red">状态不符</Tag>,
      '盘盈': <Tag color="purple">盘盈</Tag>,
      '盘亏': <Tag color="magenta">盘亏</Tag>,
    };
    return map[type] || <Tag>{type}</Tag>;
  };

  if (!selectedInventory) {
    return (
      <div style={{ padding: isMobile ? '12px' : '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            style={{ marginRight: 8 }}
          />
          <Title level={isMobile ? 4 : 3} style={{ margin: 0 }}>现场盘点</Title>
        </div>

        <Spin spinning={loading}>
          <Card title={<><ScanOutlined /> 可用的盘点</>}>
            {inventoryWindows.length === 0 ? (
              <Alert title="暂无可用盘点"
                description="当前没有已启用自助盘点且在有效期内的盘点记录"
                type="info"
                showIcon
              />
            ) : (
              <List
                dataSource={inventoryWindows}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => handleSelectInventory(item)}
                      >
                        开始盘点
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>{item.inventory_no}</span>
                          {getStatusTag(item.status)}
                        </Space>
                      }
                      description={
                        <Space orientation="vertical" size={0}>
                          <Text type="secondary">盘点类型: {item.inventory_type}</Text>
                          <Text type="secondary">
                            自助时间: {item.self_check_start ? dayjs(item.self_check_start).format('MM-DD HH:mm') : '不限'} - {item.self_check_end ? dayjs(item.self_check_end).format('MM-DD HH:mm') : '不限'}
                          </Text>
                          {item.department_name && (
                            <Text type="secondary">盘点部门: {item.department_name}</Text>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Spin>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? '12px' : '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => setSelectedInventory(null)}
          style={{ marginRight: 8 }}
        />
        <Title level={isMobile ? 4 : 3} style={{ margin: 0 }}>现场盘点</Title>
      </div>

      <Alert title={selectedInventory.inventory_no}
        description={`${selectedInventory.inventory_type} | ${selectedInventory.status}`}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card
        title={<><ScanOutlined /> 扫描资产</>}
        style={{ marginBottom: 16 }}
      >
        <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
          <Input
            placeholder="请输入资产编码"
            value={assetCode}
            onChange={(e) => setAssetCode(e.target.value)}
            onPressEnter={handleScanAsset}
            prefix={<BarcodeOutlined />}
            size="large"
          />
          <Button
            type="primary"
            size="large"
            icon={<ScanOutlined />}
            onClick={handleScanAsset}
            loading={loading}
          >
            查询
          </Button>
        </Space.Compact>
      </Card>

      {assetInfo && (
        <Card
          title={<><CheckCircleOutlined /> 资产信息</>}
          style={{ marginBottom: 16 }}
        >
          <List size="small">
            <List.Item>
              <Text type="secondary">资产编码:</Text>
              <Text strong>{assetInfo.asset_code}</Text>
            </List.Item>
            <List.Item>
              <Text type="secondary">资产名称:</Text>
              <Text strong>{assetInfo.asset_name}</Text>
            </List.Item>
            <List.Item>
              <Text type="secondary">规格型号:</Text>
              <Text>{assetInfo.specification || '-'}</Text>
            </List.Item>
            <List.Item>
              <Text type="secondary">存放地点:</Text>
              <Text>{assetInfo.location || '-'}</Text>
            </List.Item>
            <List.Item>
              <Text type="secondary">资产状态:</Text>
              <Tag color="blue">{assetInfo.status || '未知'}</Tag>
            </List.Item>
          </List>

          <Divider>盘点确认</Divider>

          <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong>实际存放地点:</Text>
              <Input
                placeholder="请输入实际存放地点"
                value={formData.actual_location}
                onChange={(e) => setFormData(prev => ({ ...prev, actual_location: e.target.value }))}
                style={{ marginTop: 4 }}
              />
            </div>

            <div>
              <Text strong>实际资产状态:</Text>
              <Select
                placeholder="请选择实际资产状态"
                value={formData.actual_status || undefined}
                onChange={(value) => setFormData(prev => ({ ...prev, actual_status: value }))}
                style={{ width: '100%', marginTop: 4 }}
                size="large"
              >
                <Option value="在用">在用</Option>
                <Option value="闲置">闲置</Option>
                <Option value="维修中">维修中</Option>
                <Option value="调配中">调配中</Option>
                <Option value="报废">报废</Option>
              </Select>
            </div>

            <div>
              <Text strong>盘点结果:</Text>
              <Radio.Group
                value={formData.discrepancy_type || '正常'}
                onChange={(e) => setFormData(prev => ({ ...prev, discrepancy_type: e.target.value }))}
                style={{ marginTop: 4 }}
              >
                <Radio.Button value="正常">正常</Radio.Button>
                <Radio.Button value="位置不符">位置不符</Radio.Button>
                <Radio.Button value="状态不符">状态不符</Radio.Button>
                <Radio.Button value="盘盈">盘盈</Radio.Button>
                <Radio.Button value="盘亏">盘亏</Radio.Button>
              </Radio.Group>
            </div>

            <div>
              <Text strong>备注说明:</Text>
              <Input.TextArea
                placeholder="请输入备注说明（如差异原因）"
                value={formData.discrepancy_desc}
                onChange={(e) => setFormData(prev => ({ ...prev, discrepancy_desc: e.target.value }))}
                rows={2}
                style={{ marginTop: 4 }}
              />
            </div>

            <Button
              type="primary"
              size="large"
              block
              icon={<CheckCircleOutlined />}
              onClick={handleConfirm}
              loading={confirming}
            >
              确认盘点
            </Button>
          </Space>
        </Card>
      )}

      {history.length > 0 && (
        <Card
          title={<><ClockCircleOutlined /> 盘点记录</>}
          size="small"
        >
          <List
            size="small"
            dataSource={history}
            renderItem={(item) => (
              <List.Item>
                <Space>
                  <Text strong>{item.asset_code}</Text>
                  <Text type="secondary">({item.asset_name})</Text>
                  {getDiscrepancyTag(item.discrepancy_type)}
                </Space>
                <Text type="secondary">
                  {dayjs(item.time).format('HH:mm:ss')}
                </Text>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default SelfInventory;
