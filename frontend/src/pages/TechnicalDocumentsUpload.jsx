import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, Upload, message, Space, Row, Col } from 'antd';
import { UploadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { technicalDocumentsAPI, assetAPI } from '../utils/api';

const { Option } = Select;
const { TextArea } = Input;

const TechnicalDocumentsUpload = () => {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assetSearchLoading, setAssetSearchLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 加载分类列表
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true);
        const result = await technicalDocumentsAPI.getCategories();
        if (result.success && result.data) {
          setCategories(result.data);
        }
      } catch (error) {
        console.error('加载分类失败:', error);
      } finally {
        setLoadingCategories(false);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    // 如果URL中有asset_code参数，自动选择资产
    const assetCode = searchParams.get('asset_code');
    if (assetCode) {
      searchAssets(assetCode);
      setTimeout(() => {
        form.setFieldsValue({ asset_code: assetCode });
        handleAssetSelect(assetCode);
      }, 500);
    }
  }, []);

  // 搜索资产
  const searchAssets = async keyword => {
    if (!keyword || keyword.trim() === '') {
      setAssets([]);
      return;
    }
    try {
      setAssetSearchLoading(true);
      const result = await assetAPI.getAssets({
        keyword: keyword.trim(),
        page: 1,
        pageSize: 50,
      });
      if (result.success) {
        setAssets(result.data || []);
      }
    } catch (error) {
      console.error('搜索资产失败:', error);
    } finally {
      setAssetSearchLoading(false);
    }
  };

  // 处理资产选择
  const handleAssetSelect = assetCode => {
    const asset = assets.find(a => a.asset_code === assetCode);
    if (asset) {
      setSelectedAsset(asset);
      // 自动填充品牌和型号
      form.setFieldsValue({
        brand: asset.brand || '',
        model: asset.model || '',
        asset_type: asset.asset_type || '',
      });
    }
  };

  const handleUpload = async values => {
    if (fileList.length === 0) {
      message.warning('请选择要上传的文件');
      return;
    }

    try {
      setUploading(true);
      const file = fileList[0].originFileObj;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('originalFileName', encodeURIComponent(file.name));
      formData.append('title', values.title);
      if (values.description) formData.append('description', values.description);
      if (values.category) formData.append('category', values.category);
      if (values.asset_type) formData.append('asset_type', values.asset_type);
      if (values.brand) formData.append('brand', values.brand);
      if (values.model) formData.append('model', values.model);
      if (values.version) formData.append('version', values.version);
      if (values.language) formData.append('language', values.language);
      if (values.is_public !== undefined) formData.append('is_public', values.is_public ? 1 : 0);
      // 关联资产
      if (values.asset_code) {
        formData.append('asset_code', values.asset_code);
      }
      // 多资产关联（用于相同型号资产共享）
      if (
        values.asset_codes &&
        Array.isArray(values.asset_codes) &&
        values.asset_codes.length > 0
      ) {
        values.asset_codes.forEach(code => {
          formData.append('asset_codes[]', code);
        });
      }

      const result = await technicalDocumentsAPI.uploadTechnicalDocument(formData);
      if (result.success) {
        message.success('上传成功');
        navigate('/technical-documents');
      }
    } catch (error) {
      console.error('上传失败:', error);
      message.error('上传失败');
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

  return (
    <div>
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/technical-documents')}>
              返回
            </Button>
            <span>上传技术资料</span>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpload}
          initialValues={{
            language: 'zh-CN',
            is_public: false,
          }}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="title"
                label="资料标题"
                rules={[{ required: true, message: '请输入资料标题' }]}
              >
                <Input placeholder="例如：XX设备使用手册" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="description" label="资料描述">
                <TextArea rows={3} placeholder="可选：资料描述信息" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="asset_code"
                label="关联资产（可选）"
                extra="选择资产后会自动填充品牌和型号，相同型号的资产可以共享技术资料"
              >
                <Select
                  showSearch
                  placeholder="搜索资产编号或名称"
                  style={{ width: '100%' }}
                  onSearch={searchAssets}
                  loading={assetSearchLoading}
                  filterOption={false}
                  onChange={handleAssetSelect}
                  allowClear
                >
                  {assets.map(asset => (
                    <Option key={asset.asset_code} value={asset.asset_code}>
                      {asset.asset_code} - {asset.asset_name}{' '}
                      {asset.brand && asset.model ? `(${asset.brand} ${asset.model})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="资料分类">
                <Select placeholder="选择分类" loading={loadingCategories} showSearch allowClear>
                  {categories.map(cat => (
                    <Option key={cat} value={cat}>{cat}</Option>
                  ))}
                  <Option value="使用手册">使用手册</Option>
                  <Option value="维修手册">维修手册</Option>
                  <Option value="技术规范">技术规范</Option>
                  <Option value="操作指南">操作指南</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="asset_type" label="关联资产类型">
                <Input placeholder="例如：医疗设备" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="brand" label="品牌">
                <Input placeholder="例如：西门子" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="model" label="型号">
                <Input placeholder="例如：CT-XXX" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="version" label="版本号">
                <Input placeholder="例如：v1.0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="language" label="语言">
                <Select>
                  <Option value="zh-CN">中文</Option>
                  <Option value="en-US">英文</Option>
                  <Option value="ja-JP">日文</Option>
                  <Option value="other">其他</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
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
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={uploading}>
                上传
              </Button>
              <Button onClick={() => navigate('/technical-documents')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default TechnicalDocumentsUpload;
