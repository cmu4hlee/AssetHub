import React, { useState, useRef, useEffect } from 'react';
import { Button, message, Modal, Spin, Alert } from 'antd';
import { ScanOutlined } from '@ant-design/icons';
import { api } from '../api/client';

const BarcodeScanner = ({ visible, onClose, onScanSuccess, inventoryId = null }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const startScannerRef = useRef(null);
  const stopScannerRef = useRef(null);

  useEffect(() => {
    if (visible) {
      startScannerRef.current?.();
    }
    return () => {
      stopScannerRef.current?.();
    };
  }, [visible]);

  const startScanner = async () => {
    try {
      setError('');
      setScanning(true);
      
      // 请求摄像头权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      // 开始识别
      setTimeout(() => {
        detectQRCode();
      }, 1000);
    } catch (err) {
      setError('无法访问摄像头，请检查权限设置');
      setScanning(false);
      console.error('摄像头访问失败:', err);
    }
  };
  startScannerRef.current = startScanner;

  const stopScanner = () => {
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  };
  stopScannerRef.current = stopScanner;

  const detectQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !scanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // 设置画布大小
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 绘制视频帧到画布
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 获取图像数据
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // 使用jsQR库识别二维码
    import('jsqr').then(({ default: jsQR }) => {
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code) {
        handleQRCodeScanned(code.data);
      } else {
        // 继续下一帧识别
        if (scanning) {
          requestAnimationFrame(detectQRCode);
        }
      }
    }).catch(err => {
      console.error('jsQR库加载失败:', err);
      setError('二维码识别库加载失败');
      setScanning(false);
    });
  };

  const handleQRCodeScanned = async (qrData) => {
    try {
      setLoading(true);
      setScanning(false);
      
      let response;
      if (inventoryId) {
        // 扫码盘点
        response = await api.post('/barcode-scan/inventory', {
          qr_data: qrData,
          inventory_id: inventoryId
        });
      } else {
        // 扫码验证
        response = await api.post('/barcode-scan/verify', {
          qr_data: qrData
        });
      }
      
      if (response.data.success) {
        message.success(response.data.message);
        if (onScanSuccess) {
          onScanSuccess(response.data.data);
        }
        onClose();
      } else {
        message.error(response.data.message);
        // 重新开始扫描
        setScanning(true);
        setTimeout(() => {
          detectQRCode();
        }, 1000);
      }
    } catch (err) {
      console.error('扫码处理失败:', err);
      message.error('扫码处理失败，请重试');
      // 重新开始扫描
      setScanning(true);
      setTimeout(() => {
        detectQRCode();
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    stopScanner();
    setTimeout(() => {
      startScanner();
    }, 500);
  };

  return (
    <Modal
      title="扫码"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        <Button 
          key="refresh" 
          type="primary" 
          icon={<ScanOutlined />} 
          onClick={handleRefresh}
          disabled={loading}
        >
          重新扫码
        </Button>
      ]}
      width={480}
    >
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        {loading ? (
          <div style={{ padding: '40px 0' }}>
            <Spin size="large" description="处理中..." />
          </div>
        ) : error ? (
          <Alert 
            title="错误" 
            description={error} 
            type="error" 
            showIcon 
            style={{ marginBottom: '20px' }}
          />
        ) : (
          <>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <video
                ref={videoRef}
                style={{ 
                  width: '100%', 
                  maxWidth: '400px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px'
                }}
                autoPlay
                playsInline
              />
              <canvas
                ref={canvasRef}
                style={{ display: 'none' }}
              />
              {scanning && (
                <div 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    border: '2px solid #1890ff',
                    borderRadius: '4px',
                    pointerEvents: 'none'
                  }}
                >
                  <div 
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '200px',
                      height: '200px',
                      border: '2px solid #1890ff',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              )}
            </div>
            <p style={{ marginTop: '16px', color: '#666' }}>
              {scanning ? '请将二维码对准摄像头' : '点击开始扫码'}
            </p>
          </>
        )}
      </div>
    </Modal>
  );
};

export default BarcodeScanner;
