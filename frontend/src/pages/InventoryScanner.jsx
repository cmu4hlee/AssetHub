import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Button,
  Input,
  List,
  Tag,
  Space,
  Typography,
  Modal,
  message,
  Progress,
  Row,
  Col,
  Statistic,
  Badge,
  Divider,
  Spin,
  Alert,
  Drawer,
  Switch,
  Select,
  Empty,
} from 'antd';
import {
  QrcodeOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  HistoryOutlined,
  BarChartOutlined,
  SoundOutlined,
  EnvironmentOutlined,
  UserOutlined,
  CalendarOutlined,
  LeftOutlined,
  ReloadOutlined,
  StopOutlined,
  CloudUploadOutlined,
  FileTextOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { inventoryAPI, assetAPI } from '../utils/api';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import jsQR from 'jsqr';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

const InventoryScanner = () => {
  const { id } = useParams();
  const [inventoryId, setInventoryId] = useState(id || null);
  const [inventory, setInventory] = useState(null);
  const [scannedAssets, setScannedAssets] = useState([]);
  const [unscannedAssets, setUnscannedAssets] = useState([]);
  const [manualInput, setManualInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [lastScannedTime, setLastScannedTime] = useState(0);
  const [scanHistory, setScanHistory] = useState([]);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [deduplicationTimeout, setDeduplicationTimeout] = useState(3000);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [showOfflineDrawer, setShowOfflineDrawer] = useState(false);
  const [isProcessingOffline, setIsProcessingOffline] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const barcodeDetectorRef = useRef(null);

  useEffect(() => {
    checkCameraPermission();
    loadOfflineQueue();
    initBarcodeDetector();
    return () => {
      stopScanning();
    };
  }, []);

  // 从URL参数获取盘点ID并加载盘点数据
  useEffect(() => {
    if (id) {
      setInventoryId(id);
      loadInventory(id);
    }
  }, [id]);

  const initBarcodeDetector = async () => {
    if (window.BarcodeDetector) {
      try {
        barcodeDetectorRef.current = new window.BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39']
        });
      } catch (e) {
        barcodeDetectorRef.current = null;
      }
    } else {
      barcodeDetectorRef.current = null;
    }
  };

  const loadOfflineQueue = () => {
    try {
      const saved = localStorage.getItem(`inventory_offline_queue_${inventoryId}`);
      if (saved) {
        const queue = JSON.parse(saved);
        setOfflineQueue(queue);
      }
    } catch (e) {
      console.error('加载离线队列失败:', e);
    }
  };

  const saveOfflineQueue = (queue) => {
    try {
      localStorage.setItem(`inventory_offline_queue_${inventoryId}`, JSON.stringify(queue));
    } catch (e) {
      console.error('保存离线队列失败:', e);
    }
  };

  const checkCameraPermission = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraPermission(false);
        setCameraError('您的浏览器不支持摄像头访问，请使用Chrome或Safari浏览器');
        return;
      }
      const result = await navigator.permissions.query({ name: 'camera' });
      if (result.state === 'granted') {
        setCameraPermission(true);
        setCameraError(null);
      } else if (result.state === 'denied') {
        setCameraPermission(false);
        setCameraError('摄像头访问被拒绝，请点击设置按钮允许摄像头权限');
      }
    } catch (error) {
      console.log('无法检测摄像头权限，尝试直接访问');
      setCameraPermission(null);
    }
  };

  const startScanning = async () => {
    setCameraError(null);
    try {
      setIsScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      message.success('摄像头已启动，开始扫描二维码');
      initBarcodeDetector();
      startScanLoop();
    } catch (error) {
      console.error('无法访问摄像头:', error);
      setIsScanning(false);
      if (error.name === 'NotAllowedError') {
        setCameraError('摄像头访问被拒绝，请点击允许按钮或检查浏览器设置');
        message.error('摄像头权限被拒绝，请允许访问后重试');
      } else if (error.name === 'NotFoundError') {
        setCameraError('未检测到摄像头设备，请确保已连接');
        message.error('未找到摄像头设备');
      } else {
        setCameraError(`无法访问摄像头: ${error.message}`);
        message.error('无法访问摄像头，请确保已授予权限');
      }
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startScanLoop = () => {
    scanIntervalRef.current = setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          if (barcodeDetectorRef.current) {
            barcodeDetectorRef.current.detect(canvas).then((barcodes) => {
              if (barcodes.length > 0) {
                const code = barcodes[0].rawValue;
                handleScanResult(code);
              }
            }).catch((error) => {
              jsQRFallback(imageData);
            });
          } else {
            jsQRFallback(imageData);
          }
        }
      }
    }, bulkMode ? 200 : 500);
  };

  const jsQRFallback = (imageData) => {
    try {
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });
      if (code && code.data) {
        handleScanResult(code.data);
      }
      } catch (e) {
        // QR detection failed, continue scanning
      }
  };

  const handleScanResult = useCallback((code) => {
    const now = Date.now();
    if (!bulkMode && lastScanned === code && (now - lastScannedTime) < deduplicationTimeout) {
      return;
    }
    setLastScanned(code);
    setLastScannedTime(now);
    processAssetCode(code);

    if ('vibrate' in navigator) {
      navigator.vibrate(200);
    }

    playBeep();
  }, [lastScanned, lastScannedTime, deduplicationTimeout, bulkMode, inventoryId]);

  const processAssetCode = async (code) => {
    const scanData = {
      asset_code: code,
      scan_time: new Date().toISOString(),
      scan_type: 'qr_code'
    };

    try {
      const result = await inventoryAPI.scanAsset(inventoryId, scanData);

      if (result.success) {
        if (result.data?.is_repeated) {
          message.info({
            content: `🔄 ${result.data.asset_name || code}（已盘点过）`,
            icon: <SyncOutlined style={{ color: '#1890ff' }} />
          });
        } else {
          message.success({
            content: `✅ ${result.data.asset_name || code}`,
            icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />
          });
        }

        setScannedAssets(prev => {
          const exists = prev.find(a => a.asset_code === code);
          if (exists) return prev;
          return [...prev, {
            ...result.data,
            scan_time: new Date().toISOString(),
            scan_type: 'qr_code'
          }];
        });

        setScanHistory(prev => [{
          code,
          time: new Date().toISOString(),
          status: 'success',
          asset: result.data
        }, ...prev].slice(0, 50));

        loadStatistics();
      } else {
        message.warning(result.message || '资产未在盘点清单中');

        setScanHistory(prev => [{
          code,
          time: new Date().toISOString(),
          status: 'warning',
          message: result.message
        }, ...prev].slice(0, 50));
      }
    } catch (error) {
      console.error('扫描处理失败:', error);
      const offlineItem = {
        ...scanData,
        id: Date.now(),
        retryCount: 0,
        addedAt: new Date().toISOString()
      };

      const newQueue = [...offlineQueue, offlineItem];
      setOfflineQueue(newQueue);
      saveOfflineQueue(newQueue);

      message.warning({
        content: `⚠️ ${code} - 已加入离线队列`,
        icon: <CloudUploadOutlined style={{ color: '#faad14' }} />
      });
    }
  };

  const playBeep = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 1000;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 100);
    } catch (e) {
      // Audio not supported
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && photoCanvasRef.current) {
      const video = videoRef.current;
      const canvas = photoCanvasRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(dataUrl);
      setShowPhotoModal(true);

      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    }
  };

  const handleManualInput = async () => {
    if (!manualInput.trim()) {
      message.warning('请输入资产编号');
      return;
    }
    await processAssetCode(manualInput.trim());
    setManualInput('');
  };

  const loadInventory = async (id) => {
    setLoading(true);
    try {
      const result = await inventoryAPI.getInventory(id);
      if (result.success) {
        setInventory(result.data);
        setScannedAssets(result.data.details?.filter(d => d.actual_status) || []);
        setUnscannedAssets(result.data.details?.filter(d => !d.actual_status) || []);
      } else {
        message.error(result.message || '加载盘点信息失败');
      }
    } catch (error) {
      console.error('加载盘点信息失败:', error);
      message.error('加载盘点信息失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const processOfflineQueue = async () => {
    if (offlineQueue.length === 0 || isProcessingOffline) return;

    setIsProcessingOffline(true);
    const remaining = [];

    for (const item of offlineQueue) {
      try {
        const result = await inventoryAPI.scanAsset(inventoryId, {
          asset_code: item.asset_code,
          scan_time: item.scan_time,
          scan_type: item.scan_type
        });

        if (result.success) {
          message.success({
            content: `✅ ${result.data.asset_name || item.asset_code}`,
            icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />
          });

          setScannedAssets(prev => {
            const exists = prev.find(a => a.asset_code === item.asset_code);
            if (exists) return prev;
            return [...prev, {
              ...result.data,
              scan_time: new Date().toISOString(),
              scan_type: item.scan_type
            }];
          });

          setScanHistory(prev => [{
            code: item.asset_code,
            time: new Date().toISOString(),
            status: 'success',
            asset: result.data
          }, ...prev].slice(0, 50));
        } else {
          remaining.push(item);
        }
      } catch (error) {
        item.retryCount += 1;
        if (item.retryCount < 3) {
          remaining.push(item);
        } else {
          message.error(`多次重试失败: ${item.asset_code}`);
        }
      }
    }

    setOfflineQueue(remaining);
    saveOfflineQueue(remaining);
    setIsProcessingOffline(false);

    if (remaining.length === 0) {
      message.success('离线队列已全部处理完成');
    } else {
      message.warning(`还有 ${remaining.length} 项待处理`);
    }

    loadStatistics();
  };

  const clearOfflineQueue = () => {
    Modal.confirm({
      title: '确认清空',
      content: `确定要清空离线队列中的 ${offlineQueue.length} 项吗？`,
      onOk: () => {
        setOfflineQueue([]);
        localStorage.removeItem(`inventory_offline_queue_${inventoryId}`);
        message.success('离线队列已清空');
      }
    });
  };

  const loadStatistics = async () => {
    if (!inventoryId) return;
    try {
      const result = await inventoryAPI.getInventoryStatistics(inventoryId);
      if (result.success) {
        setInventory(prev => prev ? ({
          ...prev,
          statistics: result.data
        }) : null);
      }
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  const statistics = inventory?.statistics || {
    total: unscannedAssets.length + scannedAssets.length,
    scanned: scannedAssets.length,
    normal: scannedAssets.filter(a => a.discrepancy_type === '正常').length,
    abnormal: scannedAssets.filter(a => a.discrepancy_type && a.discrepancy_type !== '正常').length
  };

  const progress = statistics.total > 0
    ? Math.round((statistics.scanned / statistics.total) * 100)
    : 0;

  const renderScanHistory = () => (
    <List
      dataSource={scanHistory}
      renderItem={(item) => (
        <List.Item>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              {item.status === 'success' ? (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              ) : (
                <CloseCircleOutlined style={{ color: '#faad14' }} />
              )}
              <div>
                <Text strong>{item.code}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(item.time).format('HH:mm:ss')}
                </Text>
              </div>
            </Space>
            {item.asset && (
              <Tag color="blue">{item.asset.asset_name?.substring(0, 10)}...</Tag>
            )}
          </Space>
        </List.Item>
      )}
      locale={{ emptyText: '暂无扫描记录' }}
    />
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <Spin size="large" description="加载中..." />
        </div>
      )}

      <div style={{ padding: 16, background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Button icon={<LeftOutlined />} onClick={() => window.history.back()}>
            返回
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            <QrcodeOutlined /> 扫码盘点
          </Title>
          <Space>
            {offlineQueue.length > 0 && (
              <Badge count={offlineQueue.length} offset={[-5, 5]}>
                <Button
                  icon={<CloudUploadOutlined />}
                  onClick={() => setShowOfflineDrawer(true)}
                  type="dashed"
                  size="small"
                >
                  离线
                </Button>
              </Badge>
            )}
            <Button icon={<ReloadOutlined />} onClick={loadStatistics}>
              刷新
            </Button>
          </Space>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <span style={{ fontSize: 12, color: '#999' }}>连续扫描</span>
            <Switch
              checked={bulkMode}
              onChange={setBulkMode}
              checkedChildren="开"
              unCheckedChildren="关"
              size="small"
            />
          </Space>

          {bulkMode && (
            <Space>
              <span style={{ fontSize: 12, color: '#999' }}>去重间隔</span>
              <Select
                value={deduplicationTimeout}
                onChange={setDeduplicationTimeout}
                style={{ width: 100 }}
                size="small"
                options={[
                  { value: 1000, label: '1秒' },
                  { value: 2000, label: '2秒' },
                  { value: 3000, label: '3秒' },
                  { value: 5000, label: '5秒' },
                  { value: 10000, label: '10秒' }
                ]}
              />
            </Space>
          )}
        </div>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Statistic
              title="总数量"
              value={statistics.total}
              styles={{ content: { color: '#1890ff' } }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="已盘点"
              value={statistics.scanned}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="异常"
              value={statistics.abnormal}
              styles={{ content: { color: statistics.abnormal > 0 ? '#ff4d4f' : '#52c41a' } }}
            />
          </Col>
        </Row>

        <Progress
          percent={progress}
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#52c41a',
          }}
          format={() => `${progress}%`}
        />

        {cameraError && (
          <Alert title="摄像头问题"
            description={cameraError}
            type="error"
            showIcon
            style={{ marginTop: 12 }}
            action={
              <Button size="small" onClick={() => {
                if (navigator.permissions && navigator.permissions.query) {
                  navigator.permissions.query({ name: 'camera' }).then(permissionStatus => {
                    if (permissionStatus.state === 'denied') {
                      window.open('chrome://settings/content/camera', '_blank');
                    }
                  });
                }
              }}>
                设置
              </Button>
            }
          />
        )}

        {inventory && (
          <div style={{ marginTop: 12 }}>
            <Space split={<Divider type="vertical" />}>
              <Text type="secondary">
                <UserOutlined /> {inventory.inventory_person}
              </Text>
              <Text type="secondary">
                <CalendarOutlined /> {dayjs(inventory.inventory_date).format('YYYY-MM-DD')}
              </Text>
              <Tag color={inventory.status === '进行中' ? 'processing' : 'success'}>
                {inventory.status}
              </Tag>
            </Space>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {isScanning ? (
          <Card
            style={{ marginBottom: 16 }}
            styles={{ body: { padding: 0 } }}
          >
            <div style={{ position: 'relative', width: '100%', height: 300, background: '#000' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 200,
                height: 200,
                border: '2px solid #52c41a',
                borderRadius: 8,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
              }}>
                <div style={{
                  position: 'absolute',
                  top: -2,
                  left: -2,
                  right: -2,
                  height: 20,
                  borderTop: '4px solid #52c41a',
                  borderLeft: '4px solid #52c41a'
                }} />
                <div style={{
                  position: 'absolute',
                  bottom: -2,
                  left: -2,
                  right: -2,
                  height: 20,
                  borderBottom: '4px solid #52c41a',
                  borderLeft: '4px solid #52c41a'
                }} />
                <div style={{
                  position: 'absolute',
                  top: -2,
                  left: -2,
                  right: -2,
                  height: 20,
                  borderTop: '4px solid #52c41a',
                  borderRight: '4px solid #52c41a'
                }} />
                <div style={{
                  position: 'absolute',
                  bottom: -2,
                  left: -2,
                  right: -2,
                  height: 20,
                  borderBottom: '4px solid #52c41a',
                  borderRight: '4px solid #52c41a'
                }} />
              </div>

              <Button
                type="primary"
                icon={<CameraOutlined />}
                onClick={capturePhoto}
                style={{
                  position: 'absolute',
                  bottom: 16,
                  right: 24
                }}
              >
                拍照
              </Button>

              <Button
                type="primary"
                danger
                icon={<StopOutlined />}
                onClick={stopScanning}
                style={{
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              >
                停止扫描
              </Button>
            </div>
          </Card>
        ) : (
          <Button
            type="primary"
            size="large"
            icon={<CameraOutlined />}
            onClick={startScanning}
            disabled={!!cameraError}
            style={{ width: '100%', marginBottom: 16, height: 60 }}
          >
            {cameraError ? '摄像头不可用' : '打开摄像头扫描'}
          </Button>
        )}

        <Card
          title="手动输入"
          extra={
            <Button type="primary" onClick={handleManualInput}>
              确定
            </Button>
          }
          style={{ marginBottom: 16 }}
        >
          <Search
            placeholder="输入资产编号后点击确定"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onPressEnter={handleManualInput}
            enterButton="确定"
            size="large"
          />
        </Card>

        <Card
          title={
            <Space>
              <HistoryOutlined /> 扫描历史
              <Badge count={scanHistory.length} style={{ backgroundColor: '#52c41a' }} />
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          {renderScanHistory()}
        </Card>

        {scannedAssets.length > 0 && (
          <Card title={<Space><BarChartOutlined /> 已盘点资产</Space>}>
            <List
              dataSource={scannedAssets.slice(0, 10)}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Badge
                        status={item.discrepancy_type === '正常' ? 'success' : 'warning'}
                        icon={item.discrepancy_type === '正常' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                      />
                    }
                    title={item.asset_code}
                    description={
                      <div>
                        <Text>{item.asset_name || item.asset?.asset_name}</Text>
                        <br />
                        <Tag color={item.discrepancy_type === '正常' ? 'green' : 'orange'}>
                          {item.discrepancy_type || '待盘点'}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(item.scan_time).format('HH:mm:ss')}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}
      </div>

      <div style={{ padding: 16, background: '#fff', borderTop: '1px solid #f0f0f0' }}>
        <Space style={{ width: '100%', justifyContent: 'center' }}>
          <Button
            size="large"
            icon={<CheckCircleOutlined />}
            onClick={async () => {
              if (!inventoryId) {
                message.warning('盘点ID为空，请先加载盘点数据');
                return;
              }
              try {
                const result = await inventoryAPI.completeInventory(inventoryId);
                if (result.success) {
                  message.success('盘点已完成');
                  window.history.back();
                }
              } catch (error) {
                // 处理 force_complete 场景（后端返回400但有force_complete标志）
                const errData = error?.response?.data;
                if (errData?.force_complete) {
                  Modal.confirm({
                    title: '确认完成盘点',
                    content: `还有 ${errData.pending_count} 个资产未盘点，确定要强制完成吗？`,
                    okText: '强制完成',
                    cancelText: '取消',
                    onOk: async () => {
                      try {
                        await inventoryAPI.updateInventoryStatus(inventoryId, '已完成');
                        message.success('盘点已强制完成');
                        window.history.back();
                      } catch (e) {
                        message.error('强制完成失败');
                      }
                    },
                  });
                } else {
                  message.error(errData?.message || error.message || '完成盘点失败');
                }
              }
            }}
          >
            完成盘点
          </Button>
        </Space>
      </div>

      <canvas ref={photoCanvasRef} style={{ display: 'none' }} />

      <Drawer
        title={
          <Space>
            <CloudUploadOutlined />
            离线扫描队列
            <Badge count={offlineQueue.length} style={{ backgroundColor: '#faad14' }} />
          </Space>
        }
        placement="right"
        open={showOfflineDrawer}
        onClose={() => setShowOfflineDrawer(false)}
        styles={{ wrapper: { width: 360 } }}
        extra={
          <Space>
            <Button
              size="small"
              onClick={clearOfflineQueue}
              danger
              disabled={offlineQueue.length === 0}
            >
              清空
            </Button>
            <Button
              type="primary"
              size="small"
              icon={<SyncOutlined spin={isProcessingOffline} />}
              onClick={processOfflineQueue}
              loading={isProcessingOffline}
              disabled={offlineQueue.length === 0}
            >
              重新上传
            </Button>
          </Space>
        }
      >
        {offlineQueue.length === 0 ? (
          <Empty description="离线队列为空" />
        ) : (
          <List
            dataSource={offlineQueue}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  <Button
                    key="retry"
                    size="small"
                    type="link"
                    onClick={async () => {
                      const newQueue = offlineQueue.filter((_, i) => i !== index);
                      setOfflineQueue(newQueue);
                      saveOfflineQueue(newQueue);
                      await processAssetCode(item.asset_code);
                    }}
                  >
                    重试
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color="orange">待上传</Tag>
                      <Text strong>{item.asset_code}</Text>
                    </Space>
                  }
                  description={
                    <Space orientation="vertical" size={0}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        扫描时间: {dayjs(item.addedAt).format('HH:mm:ss')}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        重试次数: {item.retryCount}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>

      <Modal
        title="拍摄照片"
        open={showPhotoModal}
        onCancel={() => setShowPhotoModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowPhotoModal(false)}>
            关闭
          </Button>,
          <Button key="use" type="primary" onClick={() => {
            message.success('照片已保存');
            setShowPhotoModal(false);
          }}>
            使用照片
          </Button>
        ]}
      >
        {capturedPhoto && (
          <img
            src={capturedPhoto}
            alt="Captured"
            style={{ width: '100%', borderRadius: 8 }}
          />
        )}
      </Modal>
    </div>
  );
};

export default InventoryScanner;
