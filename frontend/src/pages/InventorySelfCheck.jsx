import React, { useEffect, useState, useRef } from 'react';
import { Card, Select, Button, Modal, Form, Input, Tag, Space, message, List, Typography, Alert, Spin, Upload } from 'antd';
import { inventoryAPI } from '../utils/api';
import { useIsMobile } from '../hooks';
import { ScanOutlined, CheckCircleOutlined, ClockCircleOutlined, ArrowLeftOutlined, CameraOutlined, CloseOutlined, PictureOutlined, LoadingOutlined, QrcodeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import jsQR from 'jsqr';
import ScannerDialog from '../components/Scanner/ScannerDialog';
import { ResponsiveTable } from '../components';

const { Dragger } = Upload;

const { Option } = Select;
const { TextArea } = Input;

const InventorySelfCheck = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [windows, setWindows] = useState([]);
  const [selectedWindowId, setSelectedWindowId] = useState(null);
  const [assets, setAssets] = useState([]);
  const [loadingWindows, setLoadingWindows] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentAsset, setCurrentAsset] = useState(null);
  const [form] = Form.useForm();

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [scanningImage, setScanningImage] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const imageScanCanvasRef = useRef(null);
  // 拍照识别：通过 <input type="file" capture> 触发系统相机，不需要 getUserMedia，
  // 兼容 HTTP 内网域名（secure context 限制下也能用）
  const photoInputRef = useRef(null);

  const loadWindows = async () => {
    try {
      setLoadingWindows(true);
      const result = await inventoryAPI.getSelfInventoryWindows();
      if (result && result.success) {
        setWindows(result.data || []);
        if (result.data && result.data.length > 0) {
          setSelectedWindowId(result.data[0].id);
        }
      }
    } catch (error) {
      console.error('加载自助盘点窗口失败:', error);
      message.error('加载自助盘点窗口失败');
    } finally {
      setLoadingWindows(false);
    }
  };

  const loadAssets = async windowId => {
    if (!windowId) return;
    try {
      setLoadingAssets(true);
      const result = await inventoryAPI.getSelfInventoryAssets(windowId);
      if (result && result.success) {
        setAssets(result.data || []);
      }
    } catch (error) {
      console.error('加载盘点资产失败:', error);
      message.error('加载盘点资产失败');
    } finally {
      setLoadingAssets(false);
    }
  };

  useEffect(() => {
    loadWindows();
  }, []);

  useEffect(() => {
    if (selectedWindowId) {
      loadAssets(selectedWindowId);
    }
  }, [selectedWindowId]);

  const openModal = record => {
    setCurrentAsset(record);
    form.setFieldsValue({
      actual_location: record.actual_location || record.location || '',
      actual_status: record.actual_status || record.status || '',
      discrepancy_type: record.discrepancy_type || '正常',
      discrepancy_desc: record.discrepancy_desc || '',
    });
    setModalVisible(true);
  };

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        inventory_id: selectedWindowId,
        asset_code: currentAsset.asset_code,
        actual_location: values.actual_location,
        actual_status: values.actual_status,
        discrepancy_type: values.discrepancy_type,
        discrepancy_desc: values.discrepancy_desc,
      };
      const result = await inventoryAPI.confirmSelfInventory(payload);
      if (result && result.success) {
        message.success('盘点提交成功');
        setModalVisible(false);
        loadAssets(selectedWindowId);
      } else {
        message.error(result?.message || '盘点提交失败');
      }
    } catch (error) {
      console.error('盘点提交失败:', error);
      message.error('盘点提交失败');
    }
  };

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 200,
    },
    {
      title: '责任人',
      dataIndex: 'responsible_person',
      key: 'responsible_person',
      width: 120,
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
    },
    {
      title: '盘点状态',
      key: 'checked_at',
      width: 120,
      render: (_, record) =>
        record.checked_at ? (
          <Tag color="success">已盘点</Tag>
        ) : (
          <Tag color="warning">未盘点</Tag>
        ),
    },
    {
      title: '差异类型',
      dataIndex: 'discrepancy_type',
      key: 'discrepancy_type',
      width: 120,
      render: value => value || '-',
    },
    {
      title: '盘点时间',
      dataIndex: 'checked_at',
      key: 'checked_at',
      width: 160,
      render: value => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button type="link" onClick={() => openModal(record)}>
          {record.checked_at ? '更新' : '盘点'}
        </Button>
      ),
    },
  ];

  const startCameraScan = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsScanning(true);
        setCameraError(null);
        startScanLoop();
      }
    } catch (err) {
      console.error('摄像头访问失败:', err);
      setCameraError('无法访问摄像头，请确保已授权摄像头权限');
    }
  };

  const stopCameraScan = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const startScanLoop = () => {
    if (scanIntervalRef.current) return;

    scanIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleScannedCode(code.data);
        }
      }
    }, 300);
  };

  const handleScannedCode = (code) => {
    let assetCode = code;
    if (code.includes('/asset/')) {
      const match = code.match(/\/asset\/([^/?#]+)/);
      if (match) assetCode = match[1];
    }

    const asset = assets.find(a => a.asset_code === assetCode);
    if (asset) {
      stopCameraScan();
      message.success(`已扫描: ${asset.asset_code}`);
      openModal(asset);
    } else {
      message.warning(`未找到资产: ${assetCode}`);
    }
  };

  const handleAdvancedScan = (code /*, format */) => {
    handleScannedCode(code);
  };

  const scanQRFromImage = async (file) => {
    try {
      setScanningImage(true);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code && code.data) {
          handleScannedCode(code.data);
        } else {
          message.error('图片中未找到二维码');
        }
        setScanningImage(false);
      };
      img.onerror = () => {
        message.error('图片加载失败');
        setScanningImage(false);
      };
      img.src = URL.createObjectURL(file);
    } catch (err) {
      console.error('图片扫码失败:', err);
      message.error('图片扫码失败');
      setScanningImage(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCameraScan();
    };
  }, []);

  if (isMobile) {
    return (
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            style={{ marginRight: 8 }}
          />
          <Typography.Title level={4} style={{ margin: 0 }}>现场盘点</Typography.Title>
        </div>

        <Card
          title={<><ScanOutlined /> 选择盘点</>}
          style={{ marginBottom: 12 }}
        >
          <Select
            style={{ width: '100%' }}
            value={selectedWindowId}
            onChange={value => setSelectedWindowId(value)}
            loading={loadingWindows}
            placeholder="请选择盘点"
            size="large"
          >
            {windows.map(item => (
              <Option key={item.id} value={item.id}>
                {item.inventory_no} ({item.inventory_type})
              </Option>
            ))}
          </Select>
          {windows.length === 0 && <Alert title="暂无可用自助盘点窗口" type="info" showIcon />}
        </Card>

        <Card
          title={<><ScanOutlined /> 扫码 / 输入资产</>}
          style={{ marginBottom: 12 }}
        >
          {/* 拍照识别 input：放到 Card 内最外层，无论摄像头是否可用都能触发系统相机拍照识别二维码 */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) scanQRFromImage(file);
              e.target.value = '';
            }}
          />
          {cameraError ? (
            <div>
              <Alert
                title="无法访问摄像头"
                description={
                  <div>
                    <p>请尝试以下方式：</p>
                    <ol style={{ margin: '8px 0', paddingLeft: 20 }}>
                      <li>使用系统浏览器（如 Safari、Chrome）打开本页面</li>
                      <li>在浏览器设置中授权摄像头权限</li>
                      <li>确保通过 HTTPS 访问（非 HTTPS 需要使用 localhost）</li>
                    </ol>
                    <p style={{ marginTop: 8 }}>或直接输入下方资产编码进行盘点</p>
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
              />
              <Button
                type="primary"
                icon={<CameraOutlined />}
                onClick={() => photoInputRef.current?.click()}
                size="large"
                block
                style={{ marginBottom: 12 }}
              >
                拍照识别二维码
              </Button>
              <Input.Search
                placeholder="请输入资产编码"
                enterButton="查询"
                size="large"
                onSearch={value => {
                  const asset = assets.find(a => a.asset_code === value);
                  if (asset) {
                    openModal(asset);
                  } else {
                    message.error('该资产不在盘点范围内');
                  }
                }}
              />
            </div>
          ) : (
            <div>
              <Button
                type="primary"
                icon={<CameraOutlined />}
                onClick={startCameraScan}
                size="large"
                block
                style={{ marginBottom: 12 }}
              >
                打开摄像头扫码
              </Button>
              <Button
                icon={<CameraOutlined />}
                onClick={() => photoInputRef.current?.click()}
                size="large"
                block
                style={{ marginBottom: 12 }}
              >
                拍照识别二维码
              </Button>
              <Dragger
                accept="image/*"
                showUploadList={false}
                beforeUpload={file => {
                  scanQRFromImage(file);
                  return false;
                }}
                style={{ marginBottom: 12 }}
              >
                <p className="ant-upload-drag-icon">
                  {scanningImage ? <LoadingOutlined /> : <PictureOutlined />}
                </p>
                <p className="ant-upload-text">{scanningImage ? '正在识别...' : '从相册选择二维码图片'}</p>
                <p className="ant-upload-hint">支持从相册选择包含资产二维码的图片进行扫描</p>
              </Dragger>
              {isScanning && (
                <div style={{ position: 'relative', marginBottom: 12, borderRadius: 8, overflow: 'hidden', background: '#000' }}>
                  <video
                    ref={videoRef}
                    style={{ width: '100%', display: 'block' }}
                    playsInline
                    muted
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '60%',
                    height: '40%',
                    border: '2px solid #52c41a',
                    borderRadius: 8,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
                  }} />
                  <Button
                    type="default"
                    icon={<CloseOutlined />}
                    onClick={stopCameraScan}
                    style={{ position: 'absolute', top: 8, right: 8 }}
                    size="small"
                  >
                    关闭
                  </Button>
                </div>
              )}
              <Input.Search
                placeholder="或直接输入资产编码"
                enterButton="查询"
                size="large"
                onSearch={value => {
                  const asset = assets.find(a => a.asset_code === value);
                  if (asset) {
                    openModal(asset);
                  } else {
                    message.error('该资产不在盘点范围内');
                  }
                }}
              />
            </div>
          )}
        </Card>

        <Card title="盘点资产列表">
          <List
            loading={loadingAssets}
            dataSource={assets}
            renderItem={item => (
              <List.Item
                actions={[
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => openModal(item)}
                  >
                    {item.checked_at ? '更新' : '盘点'}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{item.asset_code}</span>
                      {item.checked_at ? <Tag color="success">已盘点</Tag> : <Tag color="warning">未盘点</Tag>}
                    </Space>
                  }
                  description={
                    <Space orientation="vertical" size={0}>
                      <span>{item.asset_name}</span>
                      <span>{item.location || '-'} | {item.status}</span>
                      {item.discrepancy_type && <Tag color="orange">{item.discrepancy_type}</Tag>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        <Modal
          title={`盘点: ${currentAsset?.asset_code || ''}`}
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          onOk={handleConfirm}
          okText="提交"
          cancelText="取消"
          width="90%"
        >
          <Form layout="vertical" form={form}>
            {currentAsset && (
              <Card size="small" style={{ marginBottom: 12, background: '#f5f5f5' }}>
                <p><strong>{currentAsset.asset_name}</strong></p>
                <p>位置: {currentAsset.location || '-'}</p>
                <p>状态: {currentAsset.status}</p>
              </Card>
            )}
            <Form.Item label="实际位置" name="actual_location">
              <Input placeholder="请输入实际位置" />
            </Form.Item>
            <Form.Item label="实际状态" name="actual_status">
              <Select placeholder="选择实际状态">
                <Option value="在用">在用</Option>
                <Option value="闲置">闲置</Option>
                <Option value="维修中">维修中</Option>
                <Option value="报废">报废</Option>
                <Option value="调配中">调配中</Option>
              </Select>
            </Form.Item>
            <Form.Item label="差异类型" name="discrepancy_type">
              <Select placeholder="选择差异类型">
                <Option value="正常">正常</Option>
                <Option value="位置不符">位置不符</Option>
                <Option value="状态不符">状态不符</Option>
                <Option value="缺失">缺失</Option>
                <Option value="多余">多余</Option>
              </Select>
            </Form.Item>
            <Form.Item label="差异说明" name="discrepancy_desc">
              <TextArea rows={2} placeholder="如有差异请填写说明" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <Card
        title="我的资产盘点"
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<QrcodeOutlined />}
              onClick={() => setScannerOpen(true)}
              disabled={!selectedWindowId || assets.length === 0}
            >
              扫码盘点
            </Button>
            <Button onClick={loadWindows} loading={loadingWindows}>
              刷新窗口
            </Button>
          </Space>
        }
      >
        <Space wrap>
          <span>选择盘点窗口:</span>
          <Select
            style={{ minWidth: 260 }}
            value={selectedWindowId}
            onChange={value => setSelectedWindowId(value)}
            loading={loadingWindows}
            placeholder="请选择盘点窗口"
          >
            {windows.map(item => (
              <Option key={item.id} value={item.id}>
                {item.inventory_no} ({item.inventory_type}){' '}
                {item.self_check_start
                  ? `${dayjs(item.self_check_start).format('MM-DD')} - ${dayjs(item.self_check_end).format('MM-DD')}`
                  : '长期有效'}
              </Option>
            ))}
          </Select>
          {windows.length === 0 && <Tag color="default">暂无可用自助盘点窗口</Tag>}
        </Space>
      </Card>

      <Card title="盘点资产列表">
        <ResponsiveTable
          rowKey="asset_code"
          dataSource={assets}
          columns={columns}
          loading={loadingAssets}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
          mobileTitleKey="asset_name"
          mobileStatusRender={r => r.checked_at
            ? <Tag color="success">已盘点</Tag>
            : <Tag color="warning">未盘点</Tag>}
          mobileFields={[
            { label: '资产编号', key: 'asset_code' },
            { label: '责任人', key: 'responsible_person' },
            { label: '当前状态', key: 'status' },
            { label: '差异类型', key: 'discrepancy_type' },
            {
              label: '盘点时间',
              key: 'checked_at',
              render: v => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
            },
          ]}
          mobileActions={[
            {
              key: 'check',
              text: r => (r.checked_at ? '更新' : '盘点'),
              onClick: openModal,
            },
          ]}
        />
      </Card>

      <Modal
        title={`盘点资产：${currentAsset?.asset_code || ''}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleConfirm}
        okText="提交"
        cancelText="取消"
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="实际位置" name="actual_location">
            <Input placeholder="请输入实际位置" />
          </Form.Item>
          <Form.Item label="实际状态" name="actual_status">
            <Select placeholder="选择实际状态">
              <Option value="在用">在用</Option>
              <Option value="闲置">闲置</Option>
              <Option value="维修">维修</Option>
              <Option value="报废">报废</Option>
              <Option value="调配中">调配中</Option>
            </Select>
          </Form.Item>
          <Form.Item label="差异类型" name="discrepancy_type">
            <Select placeholder="选择差异类型">
              <Option value="正常">正常</Option>
              <Option value="位置不符">位置不符</Option>
              <Option value="状态不符">状态不符</Option>
              <Option value="缺失">缺失</Option>
              <Option value="多余">多余</Option>
            </Select>
          </Form.Item>
          <Form.Item label="差异说明" name="discrepancy_desc">
            <TextArea rows={3} placeholder="如有差异请填写说明" />
          </Form.Item>
        </Form>
      </Modal>

      <ScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleAdvancedScan}
        title="扫码盘点"
      />
    </div>
  );
};

export default InventorySelfCheck;
