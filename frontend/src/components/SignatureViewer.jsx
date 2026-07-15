/**
 * SignatureViewer - 已保存签名的回显组件
 *
 * 用法：
 *   <SignatureViewer src={record.engineer_signature} label="工程师签名" signedAt={...} />
 *
 * - 缩略图（带边框）
 * - 点击放大弹 Modal
 * - Modal 内提供「下载」按钮（PNG）
 */
import React, { useState } from 'react';
import { Image, Modal, Button, Space, Typography } from 'antd';
import { DownloadOutlined, ZoomInOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

function dataURLToBlob(dataURL) {
  const [meta, base64] = dataURL.split(',');
  const mimeMatch = /data:([^;]+);base64/.exec(meta);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 立即 revoke 在某些浏览器会中断下载，延后一点
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const SignatureViewer = ({
  src,
  label = '签名',
  signedAt,
  fileName,
  thumbMaxWidth = 260,
  thumbMaxHeight = 120,
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!src) return null;

  const handleDownload = () => {
    try {
      const blob = dataURLToBlob(src);
      const name = fileName || `${label}-${dayjs(signedAt || undefined).format('YYYYMMDD-HHmmss') || Date.now()}.png`;
      triggerDownload(blob, name);
    } catch (e) {
      console.error('下载签名失败:', e);
    }
  };

  return (
    <div>
      {label && <div className="detail-label">{label}</div>}
      <div
        style={{
          border: '1px dashed #d9d9d9',
          background: '#fafafa',
          padding: 8,
          borderRadius: 6,
          display: 'inline-block',
          maxWidth: thumbMaxWidth + 24,
          cursor: 'zoom-in',
          position: 'relative',
        }}
        onClick={() => setPreviewOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setPreviewOpen(true);
          }
        }}
      >
        <img
          src={src}
          alt={label}
          style={{
            maxWidth: thumbMaxWidth,
            maxHeight: thumbMaxHeight,
            display: 'block',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 4,
            bottom: 4,
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            pointerEvents: 'none',
          }}
        >
          <ZoomInOutlined /> 查看大图
        </div>
      </div>
      {signedAt && (
        <div className="detail-label" style={{ marginTop: 4 }}>
          {dayjs(signedAt).format('YYYY-MM-DD HH:mm:ss')}
        </div>
      )}

      <Modal
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        title={label}
        width="auto"
        centered
        destroyOnHidden
      >
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <img
            src={src}
            alt={label}
            style={{ maxWidth: '80vw', maxHeight: '70vh', display: 'inline-block' }}
          />
        </div>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginTop: 12 }}>
          {signedAt ? <Text type="secondary">签署时间：{dayjs(signedAt).format('YYYY-MM-DD HH:mm:ss')}</Text> : <span />}
          <Space>
            <Button onClick={() => setPreviewOpen(false)}>关闭</Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
              下载签名
            </Button>
          </Space>
        </Space>
      </Modal>
    </div>
  );
};

export default SignatureViewer;
