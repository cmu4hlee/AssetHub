import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Upload, message, Space, Alert, Descriptions, Spin } from 'antd';
import { UploadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { technicalDocumentsAPI } from '../utils/api';
import dayjs from 'dayjs';

const { TextArea } = Input;

const AssetShareUpload = () => {
  const { token } = useParams();
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [assetInfo, setAssetInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploaded, setUploaded] = useState(false);

  useEffect(() => {
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      setLoading(true);
      const result = await technicalDocumentsAPI.verifyAssetShareToken(token);
      if (result.success) {
        setAssetInfo(result.data);
      } else {
        message.error(result.message || '分享链接无效');
      }
    } catch (error) {
      console.error('验证分享令牌失败:', error);
      message.error('分享链接无效或已过期');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async values => {
    if (fileList.length === 0) {
      message.warning('请选择要上传的文件');
      return;
    }

    if (!assetInfo) {
      message.error('资产信息无效');
      return;
    }

    // 检查上传次数
    if (assetInfo.current_uploads >= assetInfo.max_uploads) {
      message.error('已达到最大上传次数');
      return;
    }

    try {
      setUploading(true);
      const file = fileList[0].originFileObj;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('originalFileName', encodeURIComponent(file.name));
      if (values.title) formData.append('title', values.title);
      if (values.description) formData.append('description', values.description);
      if (values.uploader_name) formData.append('uploader_name', values.uploader_name);
      if (values.uploader_company) formData.append('uploader_company', values.uploader_company);

      const result = await technicalDocumentsAPI.uploadTechnicalDocumentViaAssetShare(token, formData);
      if (result.success) {
        message.success('文件上传成功！感谢您的配合。');
        setUploaded(true);
        form.resetFields();
        setFileList([]);
        // 重新验证令牌以更新上传次数
        verifyToken();
      }
    } catch (error) {
      console.error('上传失败:', error);
      message.error(error.response?.data?.message || '上传失败，请稍后重试');
    } finally {
      setUploading(false);
    }
  };

  const uploadProps = {
    beforeUpload: file => {
      // 检查文件大小（100MB）
      const isLt100M = file.size / 1024 / 1024 < 100;
      if (!isLt100M) {
        message.error('文件大小不能超过100MB');
        return false;
      }
      setFileList([{ uid: file.uid, name: file.name, originFileObj: file }]);
      return false; // 阻止自动上传
    },
    onRemove: () => {
      setFileList([]);
    },
    fileList,
    maxCount: 1,
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>正在验证分享链接...</p>
      </div>
    );
  }

  if (!assetInfo) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <Card>
          <Alert
            title="分享链接无效"
            description="该分享链接已过期或不存在，请联系管理员获取新的分享链接。"
            type="error"
            showIcon
          />
        </Card>
      </div>
    );
  }

  const canUpload = assetInfo.current_uploads < assetInfo.max_uploads;
  // 检查是否过期（允许到过期日期的23:59:59）
  const expiresAt = new Date(assetInfo.expires_at);
  expiresAt.setHours(23, 59, 59, 999);
  const isExpired = expiresAt < new Date();

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px' }}>
      <Card
        title="技术资料上传"
        style={{
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        {isExpired && (
          <Alert
            title="分享链接已过期"
            description="该分享链接已过期，请联系管理员获取新的分享链接。"
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {!isExpired && !canUpload && (
          <Alert
            title="已达到最大上传次数"
            description="该分享链接已达到最大上传次数，无法继续上传。"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 资产基本信息（受限信息） */}
        {assetInfo && (
          <Card
            title="资产基本信息"
            style={{ marginBottom: 24, backgroundColor: '#fafafa' }}
            size="small"
          >
            <Descriptions bordered column={2}>
              <Descriptions.Item label="资产名称" span={2}>
                {assetInfo.asset_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="品牌">{assetInfo.brand || '-'}</Descriptions.Item>
              <Descriptions.Item label="型号">{assetInfo.model || '-'}</Descriptions.Item>
              <Descriptions.Item label="序列号">{assetInfo.serial_number || '-'}</Descriptions.Item>
              <Descriptions.Item label="所属科室">{assetInfo.department || '-'}</Descriptions.Item>
            </Descriptions>
            <Alert
              title="信息说明"
              description="您只能查看上述资产基本信息，其他敏感信息（如价格、责任人等）不可见。"
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          </Card>
        )}

        {/* 上传信息 */}
        {assetInfo && (
          <Descriptions title="上传信息" bordered style={{ marginBottom: 24 }} size="small">
            <Descriptions.Item label="最大上传次数">{assetInfo.max_uploads}</Descriptions.Item>
            <Descriptions.Item label="已上传次数">{assetInfo.current_uploads}</Descriptions.Item>
            <Descriptions.Item label="有效期至" span={2}>
              {dayjs(assetInfo.expires_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}

        {uploaded && (
          <Alert
            title="上传成功"
            description="文件已成功上传，感谢您的配合！"
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}

        {!isExpired && canUpload && (
          <Form form={form} layout="vertical" onFinish={handleUpload}>
            <Form.Item
              name="title"
              label="资料标题"
              rules={[{ required: true, message: '请输入资料标题' }]}
            >
              <Input placeholder="例如：XX设备补充资料" />
            </Form.Item>

            <Form.Item name="description" label="资料描述">
              <TextArea rows={3} placeholder="可选：资料描述信息" />
            </Form.Item>

            <Form.Item name="uploader_name" label="上传人姓名">
              <Input placeholder="可选：您的姓名" />
            </Form.Item>

            <Form.Item name="uploader_company" label="公司/单位">
              <Input placeholder="可选：您的公司或单位名称" />
            </Form.Item>

            <Form.Item
              name="file"
              label="选择文件"
              rules={[{ required: true, message: '请选择要上传的文件' }]}
              help="支持常见文档和图片格式，最大100MB"
            >
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={uploading} size="large">
                  上传文件
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default AssetShareUpload;
