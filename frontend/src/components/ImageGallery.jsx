/**
 * 图片画廊组件
 * 支持网格展示、点击预览、删除操作
 */

import React, { useState } from 'react';
import { Image, Modal, Row, Col, Card, Button, Spin, Empty } from 'antd';
import { DeleteOutlined, EyeOutlined, ExpandOutlined } from '@ant-design/icons';
import { COMPONENT_CONFIG } from '../constants';

const { IMAGE_GALLERY: GALLERY_CONFIG } = COMPONENT_CONFIG;

/**
 * 图片画廊组件
 *
 * @param {Object} props
 * @param {Array} props.images - 图片列表 [{ id, src, alt, description, ... }]
 * @param {number} props.columns - 列数，默认3
 * @param {number} props.gap - 间距，默认16
 * @param {Function} props.onDelete - 删除图片回调 (image) => void
 * @param {Function} props.onPreview - 预览图片回调 (image, index) => void
 * @param {boolean} props.showDelete - 是否显示删除按钮，默认true
 * @param {boolean} props.showDescription - 是否显示描述，默认true
 * @param {boolean} props.lazyLoad - 是否懒加载，默认true
 * @param {Object} props.imageProps - 传递给Image组件的其他属性
 */
const ImageGallery = ({
  images = [],
  columns = 3,
  gap = 16,
  onDelete,
  onPreview,
  showDelete = true,
  showDescription = true,
  lazyLoad = true,
  imageProps = {},
}) => {
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无图片"
      />
    );
  }

  const handlePreview = (index) => {
    setPreviewIndex(index);
    setPreviewVisible(true);
    if (onPreview) {
      onPreview(images[index], index);
    }
  };

  const handleDelete = (e, image) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(image);
    }
  };

  const getImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('cloud://') || url.startsWith('oss://') || url.startsWith('cos://') || url.startsWith('s3://')) {
      return url;
    }
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    if (apiBaseUrl === '/api' || apiBaseUrl === '/api/') {
      return url;
    }
    return `${apiBaseUrl}${url}`;
  };

  const galleryStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: `${gap}px`,
  };

  return (
    <>
      <div style={galleryStyle}>
        {images.map((image, index) => (
          <Card
            key={image.id || `gallery-image-${index}`}
            hoverable
            size="small"
            actions={
              showDelete && onDelete
                ? [
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handlePreview(index)}
                      title="预览"
                    />,
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      danger
                      onClick={(e) => handleDelete(e, image)}
                      title="删除"
                    />,
                  ]
                : [
                    <Button
                      type="text"
                      size="small"
                      icon={<ExpandOutlined />}
                      onClick={() => handlePreview(index)}
                      title="查看大图"
                    />,
                  ]
            }
            style={{
              borderRadius: '8px',
              border: '1px solid #e8e8e8',
              overflow: 'hidden',
            }}
            styles={{ body: { padding: 0 } }}
          >
            <Image
              src={getImageUrl(image.src || image.temp_file_url || image.url)}
              alt={image.alt || image.description || `图片 ${index + 1}`}
              style={{
                width: '100%',
                height: GALLERY_CONFIG?.THUMB_SIZE || 100,
                objectFit: 'cover',
                cursor: 'pointer',
              }}
              preview={false}
              loading="lazy"
              fallback={
                image.fallback ||
                'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij7lm77uiI/QkNSPH0gbm90IGZvdW5kPC90ZXh0Pjwvc3ZnPg=='
              }
              {...imageProps}
            />
            {showDescription && image.description && (
              <div
                style={{
                  padding: '8px',
                  fontSize: '12px',
                  color: '#666',
                  borderTop: '1px solid #e8e8e8',
                  backgroundColor: '#fafafa',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={image.description}
              >
                {image.description}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* 预览弹窗 */}
      <Modal
        open={previewVisible}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width={GALLERY_CONFIG?.PREVIEW_WIDTH || 800}
        styles={{ body: {
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          maxHeight: GALLERY_CONFIG?.PREVIEW_HEIGHT || 600,
          overflow: 'auto',
        } }}
        centered
      >
        <Image
          src={getImageUrl(
            images[previewIndex]?.src ||
              images[previewIndex]?.temp_file_url ||
              images[previewIndex]?.url
          )}
          alt={images[previewIndex]?.alt || images[previewIndex]?.description || '预览图片'}
          preview={false}
          style={{
            maxWidth: '100%',
            maxHeight: GALLERY_CONFIG?.PREVIEW_HEIGHT || 600,
            objectFit: 'contain',
          }}
        />
        {images[previewIndex]?.description && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '12px 16px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: '#fff',
              fontSize: '14px',
            }}
          >
            {images[previewIndex].description}
          </div>
        )}
      </Modal>
    </>
  );
};

export default ImageGallery;
