import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  Button,
  Alert,
  Space,
  Switch,
  Select,
  Tag,
  Tabs,
  Input,
  Upload,
  message,
} from 'antd';

import {
  CameraOutlined,
  ScanOutlined,
  PictureOutlined,
  StopOutlined,
  ReloadOutlined,
  QrcodeOutlined,
  AudioOutlined,
  AudioMutedOutlined,
} from '@ant-design/icons';

/**
 * 可复用的扫码对话框组件
 *
 * Props:
 *  - open / onClose
 *  - onScan(code: string, format?: string)  扫描成功回调
 *  - title
 *  - formats: 支持的格式(BarcodeDetector 模式)。默认 qr_code,code_128,ean_13,ean_8,code_39,pdf_417,data_matrix
 *  - acceptImageUpload: 是否允许从相册/上传图片识别(默认 true)
 *  - acceptManual: 是否允许手动输入(默认 true)
 *  - bulkMode: 是否开启连续扫描模式
 */
const SUPPORTED_FORMATS = [
  'qr_code',
  'code_128',
  'code_39',
  'code_93',
  'ean_13',
  'ean_8',
  'itf',
  'pdf_417',
  'data_matrix',
  'aztec',
];

const ScannerDialog = ({
  open,
  onClose,
  onScan,
  title = '资产扫码',
  formats = SUPPORTED_FORMATS,
  acceptImageUpload = true,
  acceptManual = true,
  initialBulkMode = false,
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const scanningRef = useRef(false);
  const zxingReaderRef = useRef(null);
  const lastCodeRef = useRef({ value: '', at: 0 });
  const audioContextRef = useRef(null);
  // 拍照识别：通过 <input type="file" capture> 触发系统相机，不需要 getUserMedia，
  // 兼容 HTTP 内网域名（secure context 限制下也能用）
  const cameraInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('camera');
  const [cameraError, setCameraError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [bulkMode, setBulkMode] = useState(initialBulkMode);
  const [deduplicationTimeout, setDeduplicationTimeout] = useState(2000);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const [manualValue, setManualValue] = useState('');
  const [decoding, setDecoding] = useState(false);

  useEffect(() => {
    return () => {
      stopScanning();
      try {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch (e) { /* 静默忽略 */ }
    };
  }, []);

  useEffect(() => {
    if (open) {
      setActiveTab('camera');
    } else {
      stopScanning();
      setManualValue('');
    }
  }, [open]);

  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioContextRef.current && audioContextRef.current.state !== 'closed'
        ? audioContextRef.current
        : new Ctx();
      audioContextRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1200;
      osc.type = 'sine';
      gain.gain.value = 0.2;
      osc.start();
      setTimeout(() => {
        osc.stop();
      }, 80);
    } catch (e) { /* 静默忽略 */ }
  }, [soundEnabled]);

  const emit = useCallback(
    (code, format) => {
      const now = Date.now();
      const last = lastCodeRef.current;
      // 去重逻辑
      if (!bulkMode && last.value === code && now - last.at < deduplicationTimeout) {
        return;
      }
      lastCodeRef.current = { value: code, at: now };

      if (vibrateEnabled && 'vibrate' in navigator) {
        try {
          navigator.vibrate(100);
        } catch (e) { /* 静默忽略 */ }
      }
      playBeep();
      if (onScan) onScan(code, format);
    },
    [bulkMode, deduplicationTimeout, vibrateEnabled, playBeep, onScan],
  );

  const decodeFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !scanningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 路径 A: BarcodeDetector
    if (window.BarcodeDetector) {
      try {
        const detector = new window.BarcodeDetector({ formats });
        const barcodes = await detector.detect(canvas);
        if (barcodes.length > 0) {
          emit(barcodes[0].rawValue, barcodes[0].format);
          return;
        }
      } catch (e) {
        // fallthrough to zxing
      }
    }
    // 路径 B: @zxing/browser
    if (zxingReaderRef.current) {
      try {
        const result = await zxingReaderRef.current.decodeFromCanvas(canvas);
        if (result) {
          emit(result.getText(), result.getBarcodeFormat().toString());
          return;
        }
      } catch (e) {
        // 没有结果继续扫描
      }
    }
  }, [formats, emit]);

  const startScanning = useCallback(async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('您的浏览器不支持摄像头访问,请使用 Chrome / Edge / Safari');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // 初始化 zxing 备选
      if (!zxingReaderRef.current) {
        try {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          zxingReaderRef.current = new BrowserMultiFormatReader();
        } catch (e) {
          // 模块未安装也能用 BarcodeDetector
        }
      }

      scanningRef.current = true;
      setScanning(true);

      const tick = async () => {
        if (!scanningRef.current) return;
        await decodeFrame();
        if (scanningRef.current) {
          scanTimerRef.current = setTimeout(tick, 120);
        }
      };
      scanTimerRef.current = setTimeout(tick, 120);
    } catch (err) {
      scanningRef.current = false;
      if (err && err.name === 'NotAllowedError') {
        setCameraError('摄像头权限被拒绝,请在浏览器设置中允许访问摄像头');
      } else if (err && err.name === 'NotFoundError') {
        setCameraError('未检测到摄像头设备');
      } else {
        setCameraError(`无法访问摄像头: ${err && err.message ? err.message : err}`);
      }
      setScanning(false);
    }
  }, [decodeFrame]);

  const stopScanning = useCallback(() => {
    scanningRef.current = false;
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const handleManualSubmit = () => {
    const value = manualValue.trim();
    if (!value) {
      message.warning('请输入资产编号');
      return;
    }
    emit(value, 'manual');
    if (bulkMode) {
      setManualValue('');
    } else {
      setManualValue('');
      onClose && onClose();
    }
  };

  const handleImage = async file => {
    if (!file) return false;
    try {
      setDecoding(true);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // 优先 BarcodeDetector
      if (window.BarcodeDetector) {
        try {
          const detector = new window.BarcodeDetector({ formats });
          const barcodes = await detector.detect(canvas);
          URL.revokeObjectURL(url);
          setDecoding(false);
          if (barcodes.length > 0) {
            emit(barcodes[0].rawValue, barcodes[0].format);
            return false;
          }
        } catch (e) { /* 静默忽略 */ }
      }
      // 降级 zxing
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const r = new BrowserMultiFormatReader();
        const result = r.decodeFromCanvas(canvas);
        URL.revokeObjectURL(url);
        setDecoding(false);
        if (result) {
          emit(result.getText(), result.getBarcodeFormat().toString());
          return false;
        }
      } catch (e) { /* 静默忽略 */ }
      URL.revokeObjectURL(url);
      setDecoding(false);
      message.warning('未识别到二维码/条码,请确认图片清晰');
    } catch (e) {
      setDecoding(false);
      message.error('图片处理失败');
    }
    return false; // 阻止 Upload 默认上传
  };

  return (
    <Modal
      title={
        <Space>
          <ScanOutlined />
          {title}
        </Space>
      }
      open={open}
      onCancel={() => {
        stopScanning();
        onClose && onClose();
      }}
      width={520}
      destroyOnHidden
      footer={[
        <Space key="opts">
          <span style={{ fontSize: 12 }}>
            <AudioOutlined /> 声音
          </span>
          <Switch
            size="small"
            checked={soundEnabled}
            onChange={setSoundEnabled}
            checkedChildren="开"
            unCheckedChildren="关"
          />
          <span style={{ fontSize: 12 }}>振动</span>
          <Switch
            size="small"
            checked={vibrateEnabled}
            onChange={setVibrateEnabled}
            checkedChildren="开"
            unCheckedChildren="关"
          />
        </Space>,
        <Button
          key="close"
          onClick={() => {
            stopScanning();
            onClose && onClose();
          }}
        >
          关闭
        </Button>,
      ]}
    >
      <Tabs
        size="small"
        activeKey={activeTab}
        onChange={k => {
          setActiveTab(k);
          if (k !== 'camera') stopScanning();
        }}
        items={[
          {
            key: 'camera',
            label: (
              <span>
                <CameraOutlined /> 摄像头
              </span>
            ),
            children: (
              <div>
                <Space style={{ marginBottom: 12 }} wrap>
                  <Tag color="blue">支持 QR / Code128 / EAN13 / PDF417 / DataMatrix</Tag>
                </Space>
                <div style={{ marginBottom: 8 }}>
                  <Space wrap>
                    <span style={{ fontSize: 12 }}>连续扫描</span>
                    <Switch
                      size="small"
                      checked={bulkMode}
                      onChange={setBulkMode}
                      checkedChildren="开"
                      unCheckedChildren="关"
                    />
                    {bulkMode && (
                      <>
                        <span style={{ fontSize: 12 }}>去重间隔</span>
                        <Select
                          size="small"
                          value={deduplicationTimeout}
                          onChange={setDeduplicationTimeout}
                          style={{ width: 110 }}
                          options={[
                            { value: 1000, label: '1秒' },
                            { value: 2000, label: '2秒' },
                            { value: 3000, label: '3秒' },
                            { value: 5000, label: '5秒' },
                          ]}
                        />
                      </>
                    )}
                  </Space>
                </div>

                {cameraError ? (
                  <>
                    <Alert
                      type="error"
                      showIcon
                      title={cameraError}
                      description="如摄像头权限不可用，可改用「拍照识别」调用手机/电脑相机拍二维码。"
                      style={{ marginBottom: 12 }}
                      action={
                        <Button
                          size="small"
                          icon={<ReloadOutlined />}
                          onClick={() => {
                            setCameraError(null);
                            startScanning();
                          }}
                        >
                          重试
                        </Button>
                      }
                    />
                    <Button
                      type="primary"
                      size="large"
                      icon={<CameraOutlined />}
                      onClick={() => cameraInputRef.current?.click()}
                      block
                    >
                      拍照识别二维码
                    </Button>
                  </>
                ) : scanning ? (
                  <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      style={{ width: '100%', display: 'block', maxHeight: 320 }}
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '60%',
                        height: '35%',
                        border: '2px solid #52c41a',
                        borderRadius: 8,
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
                        pointerEvents: 'none',
                      }}
                    />
                    <div style={{ position: 'absolute', bottom: 8, left: 8 }}>
                      <Button
                        size="small"
                        danger
                        icon={<StopOutlined />}
                        onClick={stopScanning}
                      >
                        停止
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                    <Button
                      type="primary"
                      size="large"
                      icon={<CameraOutlined />}
                      onClick={startScanning}
                      block
                    >
                      打开摄像头扫码
                    </Button>
                    <Button
                      size="large"
                      icon={<CameraOutlined />}
                      onClick={() => cameraInputRef.current?.click()}
                      block
                    >
                      拍照识别二维码
                    </Button>
                  </Space>
                )}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleImage(file);
                    e.target.value = '';
                  }}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                  提示:将二维码/条码对准取景框,识别成功会有声音与振动反馈。
                </div>
              </div>
            ),
          },
          ...(acceptImageUpload
            ? [
                {
                  key: 'image',
                  label: (
                    <span>
                      <PictureOutlined /> 图片
                    </span>
                  ),
                  children: (
                    <Upload.Dragger
                      accept="image/*"
                      showUploadList={false}
                      beforeUpload={handleImage}
                      disabled={decoding}
                    >
                      <p className="ant-upload-drag-icon">
                        <QrcodeOutlined />
                      </p>
                      <p className="ant-upload-text">
                        {decoding ? '正在识别...' : '点击或拖入二维码/条码图片'}
                      </p>
                      <p className="ant-upload-hint">
                        支持识别图片中的二维码、条码、医疗/IT 设备贴标
                      </p>
                    </Upload.Dragger>
                  ),
                },
              ]
            : []),
          ...(acceptManual
            ? [
                {
                  key: 'manual',
                  label: (
                    <span>
                      <AudioMutedOutlined /> 手动
                    </span>
                  ),
                  children: (
                    <div>
                      <Input.Search
                        placeholder="手动输入或扫码枪键入资产编号"
                        enterButton="确认"
                        size="large"
                        value={manualValue}
                        onChange={e => setManualValue(e.target.value)}
                        onSearch={handleManualSubmit}
                      />
                      <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                        支持 USB/蓝牙物理扫码枪直接键入
                      </div>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
    </Modal>
  );
};

export default ScannerDialog;
