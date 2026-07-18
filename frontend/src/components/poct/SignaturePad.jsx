import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button, Space, Empty, message } from 'antd';
import { ClearOutlined, CheckOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from './useTranslationFallback';

/**
 * 手写签名组件 (Canvas)
 * 支持 PC 鼠标 + 移动端触摸
 *
 * Props:
 *  - value?: string        受控值 (base64 PNG)
 *  - onChange?: (dataUrl|null) => void
 *  - width?: number | string  默认 100%
 *  - height?: number          默认 180
 *  - disabled?: boolean
 *  - label?: string           顶部标签
 */
const SignaturePad = ({
  value,
  onChange,
  width = '100%',
  height = 180,
  disabled = false,
  label,
}) => {
  const { t } = useTranslation();
  const _label = label || t('poct:signature.label');
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(!!value);
  const lastPoint = useRef(null);

  // 初始化 canvas 尺寸 (处理高 DPI)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setup = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1f1f1f';
      // 绘制下划线
      ctx.strokeStyle = '#f0f0f0';
      ctx.beginPath();
      ctx.moveTo(10, rect.height - 20);
      ctx.lineTo(rect.width - 10, rect.height - 20);
      ctx.stroke();
      ctx.strokeStyle = '#1f1f1f';
    };
    setup();
    const ro = new ResizeObserver(setup);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // 同步外部 value
  useEffect(() => {
    if (!value) {
      setHasInk(false);
      return;
    }
    setHasInk(true);
  }, [value]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };

  const start = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    lastPoint.current = getPos(e);
    setDrawing(true);
    // 起点小圆点
    ctx.beginPath();
    ctx.arc(lastPoint.current.x, lastPoint.current.y, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#1f1f1f';
    ctx.fill();
  }, [disabled]);

  const move = useCallback((e) => {
    if (!drawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
  }, [drawing, disabled]);

  const end = useCallback(() => {
    if (!drawing) return;
    setDrawing(false);
    lastPoint.current = null;
    setHasInk(true);
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onChange?.(dataUrl);
  }, [drawing, onChange]);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    // 重绘下划线
    ctx.strokeStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.moveTo(10, rect.height - 20);
    ctx.lineTo(rect.width - 10, rect.height - 20);
    ctx.stroke();
    ctx.strokeStyle = '#1f1f1f';
    setHasInk(false);
    onChange?.(null);
  };

  const isReadOnly = disabled;

  // 拍照/上传图片备选(老人/不会 canvas 的人用)
  const fileInputRef = useRef(null);
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      message.error('请选择图片文件');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error('图片不能超过 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange?.(ev.target.result);
      setHasInk(true);
    };
    reader.onerror = () => message.error('图片读取失败');
    reader.readAsDataURL(file);
    // 允许重复选同一文件
    e.target.value = '';
  };

  return (
    <div className="poct-signature-pad">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <span style={{ color: '#666', fontSize: 13 }}>
          {_label}
          {hasInk && !isReadOnly && <span style={{ color: '#52c41a', marginLeft: 8 }}>✓ {t('poct:signature.signed')}</span>}
        </span>
        {!isReadOnly && (
          <Space>
            <Button size="small" icon={<ClearOutlined />} onClick={clear} disabled={!hasInk}>
              {t('poct:signature.clear')}
            </Button>
            <Button size="small" onClick={handleUploadClick}>
              📷 {t('poct:signature.upload') || '拍照/上传'}
            </Button>
          </Space>
        )}
      </div>

      {isReadOnly && value ? (
        <div style={{
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          padding: 8,
          background: '#fafafa',
          textAlign: 'center',
        }}>
          <img src={value} alt={t('poct:signature.label')} style={{ maxWidth: '100%', maxHeight: height }} />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          style={{
            width: typeof width === 'number' ? `${width}px` : width,
            height: `${height}px`,
            border: '1px dashed #d9d9d9',
            borderRadius: 6,
            background: '#fff',
            touchAction: 'none',
            cursor: disabled ? 'default' : 'crosshair',
            display: 'block',
          }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      )}

      {!isReadOnly && !hasInk && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#999', textAlign: 'center' }}>
          ↑ {t('poct:signature.hint')}
        </div>
      )}
    </div>
  );
};

export default SignaturePad;
