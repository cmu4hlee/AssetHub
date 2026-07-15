import React, { useState, useEffect } from 'react';
import { useCan } from '../hooks';
import {
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Card,
  message,
  Space,
  Upload,
} from 'antd';

import { useNavigate, useParams } from 'react-router-dom';
import { qualityControlAPI, assetAPI } from '../utils/api';
import { getApiErrorMessage } from '../api/client';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const MetrologyForm = () => {
  const canDelete = useCan('metrology', 'delete');
  const canEdit = useCan('metrology', 'edit');
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
      const result = await qualityControlAPI.getMetrologyRecord(id);
      if (result.success) {
        const data = result.data;
        setRecord(data);
        setAttachments(data.attachments || []);
        form.setFieldsValue({
          ...data,
          metrology_date: data.metrology_date ? dayjs(data.metrology_date) : null,
          next_metrology_date: data.next_metrology_date ? dayjs(data.next_metrology_date) : null,
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
        metrology_date: values.metrology_date ? values.metrology_date.format('YYYY-MM-DD') : null,
        next_metrology_date: values.next_metrology_date
          ? values.next_metrology_date.format('YYYY-MM-DD')
          : null,
        standard_validity: values.standard_validity
          ? values.standard_validity.format('YYYY-MM-DD')
          : null,
        certificate_validity_date: values.certificate_validity_date
          ? values.certificate_validity_date.format('YYYY-MM-DD')
          : null,
      };

      let apiResult;
      if (isEdit) {
        apiResult = await qualityControlAPI.updateMetrologyRecord(id, data);
      } else {
        apiResult = await qualityControlAPI.createMetrologyRecord(data);
      }

      if (apiResult.success) {
        const recordId = isEdit ? id : apiResult.data.id;

        // 如果有待上传的文件，创建记录后立即上传
        if (fileList.length > 0 && recordId) {
          await handleUpload(recordId, fileList);
        }

        message.success(isEdit ? '更新成功' : '创建成功');
        navigate('/quality-control/metrology');
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

      const result = await qualityControlAPI.uploadMetrologyAttachments(recordId, files);
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
      const result = await qualityControlAPI.deleteMetrologyAttachment(attachmentId);
      if (result.success) {
        message.success('删除成功');
        setAttachments(attachments.filter(att => att.id !== attachmentId));
      } else {
        const errorMsg = getApiErrorMessage({ message: result.message });
        message.error(`删除失败: ${errorMsg}`);
      }
    } catch (error) {
      const errorMsg = getApiErrorMessage(error, '删除失败');
      message.error(errorMsg);
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
        <h2>{isEdit ? '编辑计量记录' : '新建计量记录'}</h2>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            result: '待检',
            status: '待检',
            cost: 0,
          }}
        >
          <Form.Item
            name="record_no"
            label="计量单号"
            rules={[{ required: true, message: '请输入计量单号' }]}
          >
            <Input placeholder="请输入计量单号" />
          </Form.Item>

          <Form.Item
            name="asset_id"
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
                <Option key={asset.id} value={asset.id}>
                  {asset.asset_code} - {asset.asset_name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="metrology_type"
            label="计量类型"
            rules={[{ required: true, message: '请选择计量类型' }]}
          >
            <Select placeholder="请选择计量类型">
              <Option value="强制检定">强制检定</Option>
              <Option value="非强制检定">非强制检定</Option>
              <Option value="校准">校准</Option>
              <Option value="测试">测试</Option>
              <Option value="期间核查">期间核查</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="metrology_date"
            label="计量日期"
            rules={[{ required: true, message: '请选择计量日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="next_metrology_date" label="下次计量日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="metrology_agency" label="计量机构" rules={[{ max: 200, message: '计量机构不能超过200个字符' }]}>
            <Input placeholder="请输入计量机构" maxLength={200} />
          </Form.Item>

          <Form.Item name="certificate_no" label="证书编号" rules={[{ max: 100, message: '证书编号不能超过100个字符' }]}>
            <Input placeholder="请输入证书编号" maxLength={100} />
          </Form.Item>

          <Form.Item name="result" label="计量结果">
            <Select>
              <Option value="合格">合格</Option>
              <Option value="不合格">不合格</Option>
              <Option value="限用">限用</Option>
              <Option value="待检">待检</Option>
            </Select>
          </Form.Item>

          <Form.Item name="accuracy_level" label="准确度等级" rules={[{ max: 50, message: '准确度等级不能超过50个字符' }]}>
            <Input placeholder="请输入准确度等级" maxLength={50} />
          </Form.Item>

          <Form.Item name="measurement_range" label="测量范围" rules={[{ max: 100, message: '测量范围不能超过100个字符' }]}>
            <Input placeholder="请输入测量范围" maxLength={100} />
          </Form.Item>

          <Form.Item name="calibration_environment" label="校准环境" rules={[{ max: 200, message: '校准环境不能超过200个字符' }]}>
            <Input placeholder="请输入校准环境（如：温度20±2℃，湿度50±10%RH）" maxLength={200} />
          </Form.Item>

          <Form.Item name="standard_instrument" label="标准器具">
            <Input placeholder="请输入标准器具信息" />
          </Form.Item>

          <Form.Item name="standard_certificate_no" label="标准证书编号">
            <Input placeholder="请输入标准证书编号" />
          </Form.Item>

          <Form.Item name="standard_validity" label="标准有效期">
            <DatePicker style={{ width: '100%' }} placeholder="请选择标准有效期" />
          </Form.Item>

          <Form.Item name="uncertainty" label="扩展不确定度">
            <Input placeholder="请输入扩展不确定度" />
          </Form.Item>

          <Form.Item name="certificate_validity_date" label="证书有效期">
            <DatePicker style={{ width: '100%' }} placeholder="请选择证书有效期" />
          </Form.Item>

          <Form.Item name="calibration_items" label="校准项目">
            <TextArea rows={3} placeholder="请输入校准项目" />
          </Form.Item>

          <Form.Item name="calibration_data" label="校准数据">
            <TextArea rows={6} placeholder="请输入校准数据" />
          </Form.Item>

          <Form.Item name="calibration_conclusion" label="校准结论">
            <TextArea rows={3} placeholder="请输入校准结论" />
          </Form.Item>

          <Form.Item
            name="cost"
            label="计量费用"
            rules={[
              { type: 'number', min: 0, message: '计量费用不能为负数' },
              { type: 'number', max: 999999.99, message: '计量费用不能超过999999.99' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={999999.99}
              precision={2}
              placeholder="请输入计量费用"
            />
          </Form.Item>

          <Form.Item name="operator" label="操作人">
            <Input placeholder="请输入操作人" />
          </Form.Item>

          <Form.Item name="approver" label="批准人">
            <Input placeholder="请输入批准人" />
          </Form.Item>

          <Form.Item name="status" label="状态">
            <Select>
              <Option value="待检">待检</Option>
              <Option value="进行中">进行中</Option>
              <Option value="已完成">已完成</Option>
              <Option value="已取消">已取消</Option>
            </Select>
          </Form.Item>

          <Form.Item name="remark" label="备注" rules={[{ max: 1000, message: '备注不能超过1000个字符' }]}>
            <TextArea rows={4} placeholder="请输入备注" maxLength={1000} showCount />
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
            label={isEdit ? '上传附件（计量证书等）' : '上传附件（计量证书等，创建后自动上传）'}
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
              支持上传计量证书、检测报告等文件，单个文件不超过50MB
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
              <Button onClick={() => navigate('/quality-control/metrology')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default MetrologyForm;
