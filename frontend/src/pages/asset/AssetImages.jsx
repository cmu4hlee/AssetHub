/**
 * 资产详情 - 图片管理模块
 */
import { useCan } from '../../hooks';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Image,
  Row,
  Col,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Upload,
  Spin,
  Tooltip,
} from 'antd';

import {
  UploadOutlined,
  DeleteOutlined,
  ZoomInOutlined,
  EditOutlined,
  CloseOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { assetImageAPI } from '../../utils/api';
import { getApiErrorMessage } from '../../api/client';

const { TextArea } = Input;

const AssetImages = ({ assetId, asset }) => {
  const canDelete = useCan('asset', 'delete');
  const canEdit = useCan('asset', 'edit');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingImageId, setEditingImageId] = useState(null);
  const [tempDescription, setTempDescription] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (asset) {
      loadImages();
    }
  }, [asset]);

  useEffect(() => {
    return () => {
      if (previewImage && previewImage.startsWith('blob:')) {
        URL.revokeObjectURL(previewImage);
      }
    };
  }, [previewImage]);

  const loadImages = async () => {
    if (!asset) return;
    try {
      setLoading(true);
      const result = await assetImageAPI.getAssetImages(asset.asset_code);
      if (result.success) {
        setImages(result.data || []);
      }
    } catch (error) {
      console.error('加载图片失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async file => {
    if (!asset) return;
    try {
      setUploading(true);
      const result = await assetImageAPI.uploadImages(asset.asset_code, [file], [file.name.replace(/\.[^/.]+$/, '')]);
      if (result.success) {
        message.success('上传成功');
        loadImages();
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        message.error(result.message || '上传失败');
      }
    } catch (error) {
      console.error('上传失败:', error);
      message.error(getApiErrorMessage(error, '图片上传失败'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async imageId => {
    try {
      const result = await assetImageAPI.deleteImage(imageId);
      if (result.success) {
        message.success('删除成功');
        loadImages();
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleStartEditDescription = image => {
    setEditingImageId(image.id);
    setTempDescription(image.description || '');
  };

  const handleSaveDescription = async imageId => {
    try {
      const result = await assetImageAPI.updateImageDescription(imageId, tempDescription);
      if (result.success) {
        message.success('保存成功');
        setEditingImageId(null);
        loadImages();
      }
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    }
  };

  const handleCancelEditDescription = () => {
    setEditingImageId(null);
    setTempDescription('');
  };

  // /uploads/ 已由后端作为静态文件目录公开暴露，无需认证
  // cloud:// 等私有协议浏览器无法识别，返回空字符串由占位逻辑处理
  const getImageUrl = image => {
    const url = image.temp_file_url || '';
    if (url.startsWith('/uploads/') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return '';
  };

  const handlePreview = image => {
    const url = getImageUrl(image);
    if (!url) {
      message.warning('该图片格式暂不支持预览');
      return;
    }
    setPreviewImage(url);
    setPreviewTitle(image.description || '图片预览');
    setPreviewVisible(true);
  };

  return (
    <Card
      title="资产图片"
      extra={
        <>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
          >
            上传图片
          </Button>
        </>
      }
      style={{ marginBottom: 16 }}
    >
      <Spin spinning={loading}>
        {images.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            暂无图片
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {images.map(img => (
              <Col xs={24} sm={12} md={8} lg={6} key={img.id}>
                <div
                  style={{
                    border: '1px solid #f0f0f0',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: '#fff',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      paddingTop: '75%',
                      background: '#fafafa',
                      cursor: getImageUrl(img) ? 'pointer' : 'not-allowed',
                    }}
                    onClick={() => getImageUrl(img) && handlePreview(img)}
                  >
                    {getImageUrl(img) ? (
                      <Image
                        src={getImageUrl(img)}
                        alt={img.description}
                        styles={{
                          root: {
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                          },
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        preview={false}
                      />
                    ) : (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ccc',
                          fontSize: 12,
                        }}
                      >
                        暂不支持预览
                      </div>
                    )}
                    {getImageUrl(img) && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          background: 'rgba(0,0,0,0.5)',
                          borderRadius: 4,
                          padding: '2px 6px',
                        }}
                      >
                        <ZoomInOutlined style={{ color: '#fff', fontSize: 12 }} />
                      </div>
                    )}
                  </div>

                  <div style={{ padding: 12 }}>
                    {editingImageId === img.id ? (
                      <div>
                        <TextArea
                          value={tempDescription}
                          onChange={e => setTempDescription(e.target.value)}
                          placeholder="输入描述"
                          autoSize={{ minRows: 2, maxRows: 4 }}
                          style={{ marginBottom: 8 }}
                        />
                        <Space>
                          <Button
                            type="primary"
                            size="small"
                            icon={<CheckOutlined />}
                            onClick={() => handleSaveDescription(img.id)}
                          >
                            保存
                          </Button>
                          <Button
                            size="small"
                            icon={<CloseOutlined />}
                            onClick={handleCancelEditDescription}
                          >
                            取消
                          </Button>
                        </Space>
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            fontSize: 12,
                            color: '#666',
                            marginBottom: 8,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={img.description}
                        >
                          {img.description || '暂无描述'}
                        </div>
                        <Space>
                          <Tooltip title="编辑描述">
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => handleStartEditDescription(img)}
                            />
                          </Tooltip>
                          <Popconfirm
                            title="确定删除?"
                            onConfirm={() => handleDelete(img.id)}
                            okText="确定"
                            cancelText="取消"
                          >
                            <Button type="text" danger size="small" icon={<DeleteOutlined />}>
                              删除
                            </Button>
                          </Popconfirm>
                        </Space>
                      </>
                    )}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      <Modal
        open={previewVisible}
        title={previewTitle}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width={800}
      >
        <img alt={previewTitle} style={{ width: '100%' }} src={previewImage} />
      </Modal>
    </Card>
  );
};

export default AssetImages;
