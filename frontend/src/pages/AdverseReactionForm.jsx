import React, { useState, useEffect } from 'react';
import { useCan } from '../hooks';
import {
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Card,
  message,
  Space,
  Upload,
  Switch,
} from 'antd';

import { useNavigate, useParams } from 'react-router-dom';
import { adverseReactionAPI, assetAPI } from '../utils/api';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const AdverseReactionForm = () => {
  const canDelete = useCan('adverse', 'delete');
  const canEdit = useCan('adverse', 'edit');
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
      const result = await adverseReactionAPI.getRecord(id);
      if (result.success) {
        const data = result.data;
        setRecord(data);
        setAttachments(data.attachments || []);
        form.setFieldsValue({
          ...data,
          occurrence_date: data.occurrence_date ? dayjs(data.occurrence_date) : null,
          discovery_date: data.discovery_date ? dayjs(data.discovery_date) : null,
          handle_date: data.handle_date ? dayjs(data.handle_date) : null,
          review_date: data.review_date ? dayjs(data.review_date) : null,
          is_serious: data.is_serious === 1,
          involved_persons: data.involved_persons
            ? (typeof data.involved_persons === 'string'
                ? (() => { try { return JSON.parse(data.involved_persons); } catch { return []; } })()
                : data.involved_persons)
            : [],
          related_assets: data.related_assets
            ? typeof data.related_assets === 'string'
              ? JSON.parse(data.related_assets)
              : data.related_assets
            : null,
        });
      }
    } catch (error) {
      message.error('加载记录失败');
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
        occurrence_date: values.occurrence_date
          ? values.occurrence_date.format('YYYY-MM-DD HH:mm:ss')
          : null,
        discovery_date: values.discovery_date
          ? values.discovery_date.format('YYYY-MM-DD HH:mm:ss')
          : null,
        handle_date: values.handle_date ? values.handle_date.format('YYYY-MM-DD HH:mm:ss') : null,
        review_date: values.review_date ? values.review_date.format('YYYY-MM-DD HH:mm:ss') : null,
        is_serious: values.is_serious ? 1 : 0,
        involved_persons: values.involved_persons && values.involved_persons.length > 0
          ? JSON.stringify(values.involved_persons)
          : null,
        related_assets: values.related_assets ? JSON.stringify(values.related_assets) : null,
      };

      let apiResult;
      if (isEdit) {
        apiResult = await adverseReactionAPI.updateRecord(id, data);
      } else {
        apiResult = await adverseReactionAPI.createRecord(data);
      }

      if (apiResult.success) {
        const recordId = isEdit ? id : apiResult.data.id;

        // 如果有待上传的文件，创建记录后立即上传
        if (fileList.length > 0 && recordId) {
          await handleUpload(recordId, fileList);
        }

        message.success(isEdit ? '更新成功' : '创建成功');
        navigate('/adverse-reaction');
      }
    } catch (error) {
      message.error(isEdit ? '更新失败' : '创建失败');
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

      const result = await adverseReactionAPI.uploadAttachments(recordId, files);
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
      const result = await adverseReactionAPI.deleteAttachment(attachmentId);
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
        <h2>{isEdit ? '编辑不良事件记录' : '新建不良事件上报'}</h2>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            severity: '一般',
            status: '待处理',
            is_serious: false,
          }}
        >
          <Form.Item name="report_no" label="报告编号" tooltip="留空将自动生成">
            <Input placeholder="留空将自动生成报告编号" />
          </Form.Item>

          <Form.Item name="asset_id" label="关联资产">
            <Select
              placeholder="请选择资产（可选）"
              showSearch
              filterOption={(input, option) =>
                (option?.label || '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              loading={assetLoading}
              allowClear
              labelInValue={false}
              options={assets.map(asset => ({
                value: asset.id,
                label: `${asset.asset_code} - ${asset.asset_name}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="report_type"
            label="报告类型"
            rules={[{ required: true, message: '请选择报告类型' }]}
          >
            <Select placeholder="请选择报告类型">
              <Option value="设备故障">设备故障</Option>
              <Option value="安全事故">安全事故</Option>
              <Option value="质量事故">质量事故</Option>
              <Option value="使用异常">使用异常</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item name="event_category" label="事件分类">
            <Input placeholder="请输入事件分类（如：设备故障-电气故障）" />
          </Form.Item>

          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="severity" label="严重程度" style={{ flex: 1 }}>
              <Select placeholder="请选择严重程度">
                <Option value="轻微">轻微</Option>
                <Option value="一般">一般</Option>
                <Option value="严重">严重</Option>
                <Option value="重大">重大</Option>
              </Select>
            </Form.Item>

            <Form.Item name="event_consequence" label="事件后果" style={{ flex: 1 }}>
              <Select placeholder="请选择事件后果">
                <Option value="无伤害">无伤害</Option>
                <Option value="轻微伤害">轻微伤害</Option>
                <Option value="中度伤害">中度伤害</Option>
                <Option value="重度伤害">重度伤害</Option>
                <Option value="死亡">死亡</Option>
                <Option value="设备损坏">设备损坏</Option>
                <Option value="其他">其他</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="is_serious"
              label="是否严重事件"
              valuePropName="checked"
              style={{ flex: 1 }}
            >
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item label="自动计算事件等级" style={{ marginBottom: 0 }}>
            <Input
              disabled
              value={
                (() => {
                  const s = form.getFieldValue('severity') || '一般';
                  const c = form.getFieldValue('event_consequence') || '无伤害';
                  const serious = form.getFieldValue('is_serious');
                  if (serious || c === '死亡') return 'I级（特别严重）';
                  if (c === '重度伤害' || s === '重大') return 'II级（严重）';
                  if (c === '中度伤害' || s === '严重') return 'III级（较重）';
                  return 'IV级（一般）';
                })()
              }
              style={{ width: 200 }}
            />
          </Form.Item>

          <Space style={{ width: '100%' }} size="middle">
            <Form.Item
              name="occurrence_date"
              label="发生时间"
              rules={[{ required: true, message: '请选择发生时间' }]}
              style={{ flex: 1 }}
            >
              <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
            </Form.Item>

            <Form.Item name="discovery_date" label="发现时间" style={{ flex: 1 }}>
              <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="location" label="发生地点" style={{ flex: 1 }}>
              <Input placeholder="请输入发生地点" />
            </Form.Item>

            <Form.Item name="department" label="发生科室" style={{ flex: 1 }}>
              <Input placeholder="请输入发生科室" />
            </Form.Item>
          </Space>

          <Form.Item name="involved_persons" label="涉及人员">
            <Select
              mode="tags"
              placeholder="输入涉及人员姓名后回车添加"
              tokenSeparators={[',', '，', ';', '；']}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Space style={{ width: '100%' }} size="middle">
            <Form.Item
              name="reporter"
              label="上报人"
              rules={[{ required: true, message: '请输入上报人' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="请输入上报人" />
            </Form.Item>

            <Form.Item name="reporter_phone" label="上报人电话" style={{ flex: 1 }}>
              <Input placeholder="请输入上报人电话" />
            </Form.Item>

            <Form.Item name="report_source" label="上报来源" style={{ flex: 1 }}>
              <Select placeholder="请选择上报来源">
                <Option value="系统上报">系统上报</Option>
                <Option value="电话上报">电话上报</Option>
                <Option value="邮件上报">邮件上报</Option>
                <Option value="现场上报">现场上报</Option>
                <Option value="其他">其他</Option>
              </Select>
            </Form.Item>
          </Space>

          <Form.Item
            name="description"
            label="事件描述"
            rules={[{ required: true, message: '请输入事件描述' }]}
          >
            <TextArea rows={4} placeholder="请详细描述事件发生的情况" />
          </Form.Item>

          <Form.Item name="cause_analysis" label="原因分析">
            <TextArea rows={3} placeholder="请分析事件发生的原因" />
          </Form.Item>

          <Form.Item name="cause_category" label="原因分类">
            <Select placeholder="请选择原因分类">
              <Option value="设备故障">设备故障</Option>
              <Option value="操作失误">操作失误</Option>
              <Option value="管理缺陷">管理缺陷</Option>
              <Option value="环境因素">环境因素</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item name="impact_assessment" label="影响评估">
            <TextArea rows={3} placeholder="请评估事件造成的影响" />
          </Form.Item>

          <Form.Item name="handling_measures" label="处理措施">
            <TextArea rows={3} placeholder="请描述已采取的处理措施" />
          </Form.Item>

          <Form.Item name="prevention_measures" label="预防措施">
            <TextArea rows={3} placeholder="请描述预防类似事件再次发生的措施" />
          </Form.Item>

          <Form.Item name="improvement_suggestions" label="改进建议">
            <TextArea rows={3} placeholder="请提出改进建议" />
          </Form.Item>

          <Form.Item name="status" label="处理状态">
            <Select>
              <Option value="待处理">待处理</Option>
              <Option value="处理中">处理中</Option>
              <Option value="已处理">已处理</Option>
              <Option value="已关闭">已关闭</Option>
              <Option value="已归档">已归档</Option>
            </Select>
          </Form.Item>

          {isEdit && (
            <>
              <Space style={{ width: '100%' }} size="middle">
                <Form.Item name="handler" label="处理人" style={{ flex: 1 }}>
                  <Input placeholder="请输入处理人" />
                </Form.Item>

                <Form.Item name="handle_date" label="处理时间" style={{ flex: 1 }}>
                  <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
                </Form.Item>
              </Space>

              <Form.Item name="handle_result" label="处理结果">
                <TextArea rows={3} placeholder="请描述处理结果" />
              </Form.Item>

              <Space style={{ width: '100%' }} size="middle">
                <Form.Item name="reviewer" label="审核人" style={{ flex: 1 }}>
                  <Input placeholder="请输入审核人" />
                </Form.Item>

                <Form.Item name="review_date" label="审核时间" style={{ flex: 1 }}>
                  <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
                </Form.Item>
              </Space>

              <Form.Item name="review_comment" label="审核意见">
                <TextArea rows={3} placeholder="请输入审核意见" />
              </Form.Item>
            </>
          )}

          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
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
            label={isEdit ? '上传附件（证据材料等）' : '上传附件（证据材料等，创建后自动上传）'}
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
              支持上传图片、文档等证据材料，单个文件不超过50MB
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
              <Button onClick={() => navigate('/adverse-reaction')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default AdverseReactionForm;
