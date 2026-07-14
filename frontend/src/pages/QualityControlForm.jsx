import React, { useState, useEffect } from 'react';
import { useCan } from '../hooks';
import { Form, Input, Select, DatePicker, Button, Card, message, Space, Upload } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { qualityControlAPI, assetAPI } from '../utils/api';
import { getApiErrorMessage } from '../api/client';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const QualityControlForm = () => {
  const canDelete = useCan('quality', 'delete');
  const canEdit = useCan('quality', 'edit');
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [record, setRecord] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const isEdit = !!id;

  useEffect(() => {
    if (isEdit) {
      loadRecord();
    }
    loadAssets();
  }, [id]);

  const loadRecord = async () => {
    try {
      setLoading(true);
      const result = await qualityControlAPI.getQualityControlRecord(id);
      if (result.success) {
        const data = result.data;
        setRecord(data);
        setAttachments(data.attachments || []);
        form.setFieldsValue({
          ...data,
          qc_date: data.qc_date ? dayjs(data.qc_date) : null,
          next_qc_date: data.next_qc_date ? dayjs(data.next_qc_date) : null,
          review_date: data.review_date ? dayjs(data.review_date) : null,
        });
      } else {
        message.error(result.message || '加载记录失败');
      }
    } catch (error) {
      const errorMsg = getApiErrorMessage(error, '加载记录失败');
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadAssets = async () => {
    try {
      setAssetLoading(true);
      const result = await assetAPI.getAssets({ page: 1, pageSize: 1000 });
      if (result.success) {
        setAssets(result.data || []);
      }
    } catch (error) {
      console.error('加载资产列表失败:', error);
    } finally {
      setAssetLoading(false);
    }
  };

  const handleSubmit = async values => {
    try {
      setLoading(true);
      const data = {
        ...values,
        qc_date: values.qc_date ? values.qc_date.format('YYYY-MM-DD') : null,
        next_qc_date: values.next_qc_date ? values.next_qc_date.format('YYYY-MM-DD') : null,
        review_date: values.review_date ? values.review_date.format('YYYY-MM-DD') : null,
      };

      let apiResult;
      if (isEdit) {
        apiResult = await qualityControlAPI.updateQualityControlRecord(id, data);
      } else {
        apiResult = await qualityControlAPI.createQualityControlRecord(data);
      }

      if (apiResult.success) {
        const recordId = isEdit ? id : apiResult.data.id;

        // 如果有待上传的文件，创建记录后立即上传
        if (fileList.length > 0 && recordId) {
          await handleUpload(recordId, fileList);
        }

        message.success(isEdit ? '更新成功' : '创建成功');
        navigate('/quality-control/qc');
      } else {
        const errorMsg = getApiErrorMessage({ message: apiResult.message });
        message.error(isEdit ? `更新失败: ${errorMsg}` : `创建失败: ${errorMsg}`);
      }
    } catch (error) {
      const errorMsg = getApiErrorMessage(error, isEdit ? '更新失败' : '创建失败');
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (recordId, filesToUpload) => {
    try {
      setUploading(true);
      const files = filesToUpload
        .map(item => item.originFileObj || item)
        .filter(file => file instanceof File);

      if (files.length === 0) {
        message.warning('没有有效的文件可以上传');
        return;
      }

      const result = await qualityControlAPI.uploadQualityControlAttachments(recordId, files);
      if (result.success) {
        message.success(`成功上传 ${result.data.length} 个文件`);
        setFileList([]);
        if (isEdit) {
          loadRecord();
        }
      }
    } catch (error) {
      message.error('上传失败：' + (error.response?.data?.message || error.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async attachmentId => {
    try {
      const result = await qualityControlAPI.deleteQualityControlAttachment(attachmentId);
      if (result.success) {
        message.success('删除成功');
        setAttachments(attachments.filter(att => att.id !== attachmentId));
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const formatFileSize = bytes => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <h2>{isEdit ? '编辑质控记录' : '新建质控记录'}</h2>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            result: '待检',
            status: '待检',
          }}
        >
          <Form.Item
            name="record_no"
            label="质控单号"
            rules={[{ required: true, message: '请输入质控单号' }]}
          >
            <Input placeholder="请输入质控单号" />
          </Form.Item>

          <Form.Item
            name="asset_code"
            label="资产"
            rules={[{ required: true, message: '请选择资产' }]}
          >
            <Select
              placeholder="请选择资产"
              showSearch
              filterOption={(input, option) =>
                (option?.children?.props?.children || '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              loading={assetLoading}
            >
              {assets.map(asset => (
                <Option key={asset.asset_code} value={asset.asset_code}>
                  {asset.asset_code} - {asset.asset_name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="qc_type"
            label="质控类型"
            rules={[{ required: true, message: '请选择质控类型' }]}
          >
            <Select placeholder="请选择质控类型">
              <Option value="日常质控">日常质控</Option>
              <Option value="定期质控">定期质控</Option>
              <Option value="专项质控">专项质控</Option>
              <Option value="验收质控">验收质控</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="qc_date"
            label="质控日期"
            rules={[{ required: true, message: '请选择质控日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="next_qc_date" label="下次质控日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="qc_item" label="质控项目">
            <Input placeholder="请输入质控项目" />
          </Form.Item>

          <Form.Item name="qc_method" label="质控方法">
            <Input placeholder="请输入质控方法" />
          </Form.Item>

          <Form.Item name="qc_standard" label="质控标准">
            <Input placeholder="请输入质控标准" />
          </Form.Item>

          <Form.Item name="result" label="质控结果">
            <Select>
              <Option value="合格">合格</Option>
              <Option value="不合格">不合格</Option>
              <Option value="待检">待检</Option>
              <Option value="整改中">整改中</Option>
            </Select>
          </Form.Item>

          <Form.Item name="qc_value" label="质控数值">
            <Input placeholder="请输入质控数值" />
          </Form.Item>

          <Form.Item name="standard_value" label="标准值">
            <Input placeholder="请输入标准值" />
          </Form.Item>

          <Form.Item name="deviation" label="偏差">
            <Input placeholder="请输入偏差" />
          </Form.Item>

          <Form.Item name="operator" label="操作人">
            <Input placeholder="请输入操作人" />
          </Form.Item>

          <Form.Item name="reviewer" label="审核人">
            <Input placeholder="请输入审核人" />
          </Form.Item>

          <Form.Item name="review_date" label="审核日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="status" label="状态">
            <Select>
              <Option value="待检">待检</Option>
              <Option value="进行中">进行中</Option>
              <Option value="已完成">已完成</Option>
              <Option value="已取消">已取消</Option>
              <Option value="整改中">整改中</Option>
            </Select>
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <TextArea rows={4} placeholder="请输入备注" />
          </Form.Item>

          {attachments.length > 0 && (
            <Form.Item label="已上传的附件">
              <Space orientation="vertical" style={{ width: '100%' }}>
                {attachments.map(att => (
                  <div
                    key={att.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px',
                      border: '1px solid #d9d9d9',
                      borderRadius: '4px',
                      backgroundColor: '#fafafa',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <a
                        href={`${import.meta.env.VITE_BACKEND_URL || window.location.origin}${att.file_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ marginRight: '8px' }}
                      >
                        {att.file_name}
                      </a>
                      <span style={{ color: '#999', fontSize: '12px' }}>
                        ({formatFileSize(att.file_size || 0)})
                      </span>
                    </div>
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteAttachment(att.id)}
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </Space>
            </Form.Item>
          )}

          <Form.Item
            label={isEdit ? '上传附件（质控报告等）' : '上传附件（质控报告等，创建后自动上传）'}
          >
            <Upload
              multiple
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: newFileList }) => {
                setFileList(newFileList);
              }}
              onRemove={file => {
                const index = fileList.indexOf(file);
                const newFileList = fileList.slice();
                newFileList.splice(index, 1);
                setFileList(newFileList);
              }}
            >
              <Button icon={<UploadOutlined />} loading={uploading}>
                选择文件
              </Button>
            </Upload>
            <div style={{ marginTop: '8px', color: '#999', fontSize: '12px' }}>
              支持上传质控报告、检测数据等文件，单个文件不超过50MB
            </div>
            {isEdit && fileList.length > 0 && (
              <Button
                type="primary"
                onClick={() => handleUpload(id, fileList)}
                loading={uploading}
                style={{ marginTop: '8px' }}
              >
                立即上传
              </Button>
            )}
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                {isEdit ? '更新' : '创建'}
              </Button>
              <Button onClick={() => navigate('/quality-control/qc')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default QualityControlForm;
