import React, { useEffect, useState } from 'react';
import {
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Card,
  Row,
  Col,
  message,
  Result,
  Upload,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  CloseOutlined,
  ThunderboltOutlined,
  FormOutlined,
  CheckCircleOutlined,
  CameraOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { maintenanceAPI, assetAPI } from '../utils/api';
import dayjs from 'dayjs';
import { getApiErrorMessage } from '../api/client';

const { Option } = Select;
const { TextArea } = Input;

const FAULT_LEVEL_OPTIONS = [
  { value: '一般', label: '一般故障', color: 'blue' },
  { value: '严重', label: '严重故障', color: 'orange' },
  { value: '紧急', label: '紧急故障', color: 'red' },
];

const toDateString = value => {
  if (!value) {
    return undefined;
  }

  if (dayjs.isDayjs(value)) {
    return value.format('YYYY-MM-DD');
  }

  return String(value).slice(0, 10);
};

const compactValue = value => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return value;
};

const buildPayload = values => {
  const payload = {
    asset_code: compactValue(values.asset_code),
    fault_description: compactValue(values.fault_description),
    fault_level: compactValue(values.fault_level) || '一般',
    request_date: toDateString(values.request_date),
    request_department: compactValue(values.request_department),
    contact_phone: compactValue(values.contact_phone),
    expected_repair_date: toDateString(values.expected_repair_date),
    remark: compactValue(values.remark),
  };

  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  return payload;
};

const getInitialValues = record => ({
  asset_code: record?.asset_code || undefined,
  fault_level: record?.fault_level || '一般',
  request_date: record?.request_date ? dayjs(record.request_date) : dayjs(),
  request_department: record?.request_department || record?.department || undefined,
  contact_phone: record?.contact_phone || undefined,
  expected_repair_date: record?.expected_repair_date ? dayjs(record.expected_repair_date) : null,
  fault_description: record?.fault_description || undefined,
  remark: record?.remark || undefined,
});

const MaintenanceRequestForm = ({
  record,
  onSuccess,
  onCancel,
  mode = 'create',
  quickMode = false,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [quickCreateMode, setQuickCreateMode] = useState(quickMode);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [lastCreated, setLastCreated] = useState(null);
  const [attachmentFileList, setAttachmentFileList] = useState([]);

  // Antd Upload 6.x 不透传 capture 到 input — 移动端用户点"拍照"却只看到文件选择器, 体验差
  // 用 MutationObserver 监听新 input 出现 (Upload 懒渲染), 给所有 image input 补 capture="environment"
  // 桌面端忽略此属性, 移动端直接调起后置摄像头
  useEffect(() => {
    const addCapture = input => {
      if (input.type === 'file' && (input.accept || '').startsWith('image') && !input.hasAttribute('capture')) {
        input.setAttribute('capture', 'environment');
      }
    };
    // 已有 input
    document.querySelectorAll('input[type="file"]').forEach(addCapture);
    // 后续新 input (Upload 懒渲染)
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeName === 'INPUT') {
            addCapture(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('input[type="file"]').forEach(addCapture);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const assetOptions =
    record && !assets.some(item => item.asset_code === record.asset_code)
      ? [record, ...assets]
      : assets;

  const fetchAssets = async (keyword = '') => {
    setAssetLoading(true);
    try {
      const response = await assetAPI.getAssets({
        page: 1,
        pageSize: 20,
        keyword,
      });

      if (response?.success) {
        setAssets(response.data || []);
      } else {
        setAssets([]);
      }
    } catch (error) {
      console.error('获取资产列表失败:', error);
      setAssets([]);
    } finally {
      setAssetLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  useEffect(() => {
    form.setFieldsValue(getInitialValues(record));
  }, [form, record]);

  const handleAssetSearch = keyword => {
    fetchAssets(keyword);
  };

  const handleAssetSelect = value => {
    const asset = assetOptions.find(item => item.asset_code === value);
    if (!asset) {
      return;
    }

    const currentDepartment = form.getFieldValue('request_department');
    if (!currentDepartment) {
      form.setFieldsValue({
        request_department: asset.department_new || asset.department || undefined,
      });
    }
  };

  const handleSubmit = async values => {
    setLoading(true);
    try {
      const payload = buildPayload(values);
      const response =
        mode === 'edit' && record?.id
          ? await maintenanceAPI.updateMaintenanceRequest(record.id, payload)
          : await maintenanceAPI.createMaintenanceRequest(payload);

      if (!response.success) {
        message.error(response.message || '保存失败');
        return;
      }

      if (mode === 'edit') {
        message.success('更新成功');
        onSuccess?.({ ...record, ...payload, id: record.id });
        return;
      }

      const createdRecord = {
        ...payload,
        ...response.data,
      };
      const createdId = createdRecord.id || response.data?.id;

      // 上传附件（如果有）
      const pendingFiles = attachmentFileList
        .map(item => item.originFileObj)
        .filter(Boolean);

      let uploadFailures = 0;
      if (pendingFiles.length > 0 && createdId) {
        for (const file of pendingFiles) {
          try {
            const formData = new FormData();
            // 后端 multer 是 upload.single('file')，严格匹配字段名，不能多发字段
            formData.append('file', file);
            await maintenanceAPI.uploadMaintenanceRequestAttachment(createdId, formData);
          } catch (uploadError) {
            uploadFailures++;
            console.error('上传维修申请附件失败:', file.name, uploadError);
          }
        }
      }

      if (uploadFailures > 0) {
        message.warning(
          `维修申请已提交，但 ${uploadFailures} 张图片上传失败，可在详情页补充上传`,
        );
      }

      if (quickCreateMode) {
        setLastCreated(createdRecord);
        setSubmitSuccess(true);
        message.success('维修申请已提交');
        return;
      }

      message.success('维修申请已提交');
      onSuccess?.(createdRecord);
    } catch (error) {
      console.error('保存维修申请失败:', error);
      const status = error?.response?.status;
      const backendMsg = error?.response?.data?.message;
      if (status === 409 && backendMsg) {
        message.warning(backendMsg);
      } else {
        message.error(getApiErrorMessage(error, '保存失败'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContinueCreating = () => {
    setSubmitSuccess(false);
    setLastCreated(null);
    form.resetFields();
    form.setFieldsValue(getInitialValues(null));
    setQuickCreateMode(true);
  };

  if (submitSuccess) {
    return (
      <Card className="maintenance-request-form">
        <Result
          status="success"
          icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          title="维修申请创建成功"
          subTitle={`申请单号：${lastCreated?.request_no || '未知'}`}
          extra={[
            <Button
              type="primary"
              key="continue"
              icon={<PlusOutlined />}
              onClick={handleContinueCreating}
            >
              继续创建
            </Button>,
            <Button key="view" onClick={() => onSuccess?.(lastCreated)}>
              查看详情
            </Button>,
            <Button key="close" icon={<CloseOutlined />} onClick={onCancel}>
              关闭
            </Button>,
          ]}
        />
      </Card>
    );
  }

  const assetField = (
    <Form.Item
      name="asset_code"
      label="关联资产"
      rules={[{ required: true, message: '请选择关联资产' }]}
    >
      <Select
        showSearch
        placeholder="搜索资产编号或名称"
        loading={assetLoading}
        onSearch={handleAssetSearch}
        onChange={handleAssetSelect}
        filterOption={false}
        optionLabelProp="label"
        disabled={mode === 'edit'}
      >
        {assetOptions.map(asset => (
          <Option
            key={asset.asset_code || asset.id}
            value={asset.asset_code}
            label={`${asset.asset_code} - ${asset.asset_name}`}
          >
            <div>
              <div>{asset.asset_code}</div>
              <div style={{ color: '#8c8c8c', fontSize: 12 }}>{asset.asset_name}</div>
            </div>
          </Option>
        ))}
      </Select>
    </Form.Item>
  );

  const faultLevelField = (
    <Form.Item
      name="fault_level"
      label="故障等级"
      rules={[{ required: true, message: '请选择故障等级' }]}
    >
      <Select placeholder="选择故障等级">
        {FAULT_LEVEL_OPTIONS.map(option => (
          <Option key={option.value} value={option.value}>
            <span style={{ color: option.color }}>{option.label}</span>
          </Option>
        ))}
      </Select>
    </Form.Item>
  );

  // 附件上传控件：移动端用 capture="environment" 调起相机；桌面端 accept 触发文件选择
  const attachmentsField = (
    <Form.Item label="故障图片" extra="支持拍照或上传图片，最多 10 张，单张不超过 50MB">
      <Upload
        listType="picture-card"
        fileList={attachmentFileList}
        onChange={({ fileList }) => setAttachmentFileList(fileList)}
        beforeUpload={() => false}
        accept="image/*"
        multiple
        // Antd Upload 6.x 不会自动透传 capture 到 input；
        // 通过 onPreview 里挂 capture 不便，这里只在移动端通过 accept 触发系统选择（相机+相册）
        maxCount={10}
      >
        {attachmentFileList.length >= 10 ? null : (
          <div>
            <CameraOutlined style={{ fontSize: 22 }} />
            <div style={{ marginTop: 6, fontSize: 12 }}>拍照/上传</div>
          </div>
        )}
      </Upload>
    </Form.Item>
  );

  if (quickCreateMode) {
    return (
      <Card
        title={
          <>
            <ThunderboltOutlined style={{ marginRight: 8 }} />
            快速提交维修申请
          </>
        }
        extra={
          <Button type="link" icon={<FormOutlined />} onClick={() => setQuickCreateMode(false)}>
            切换到完整模式
          </Button>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              {assetField}
            </Col>
            <Col xs={24} sm={12}>
              {faultLevelField}
            </Col>
          </Row>
          <Form.Item
            name="fault_description"
            label="故障描述"
            rules={[
              { required: true, message: '请输入故障描述' },
              { min: 5, message: '故障描述至少输入 5 个字符' },
            ]}
          >
            <TextArea rows={4} placeholder="描述故障现象、影响和出现时间" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="expected_repair_date" label="期望维修日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="contact_phone" label="联系电话">
                <Input placeholder="输入联系电话" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder="补充说明" />
          </Form.Item>
          {attachmentsField}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button icon={<CloseOutlined />} onClick={onCancel}>
              取消
            </Button>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              htmlType="submit"
              loading={loading}
            >
              快速提交
            </Button>
          </div>
        </Form>
      </Card>
    );
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Card
        title={mode === 'edit' ? '编辑维修申请' : '新建维修申请'}
        extra={
          <div style={{ display: 'flex', gap: 8 }}>
            {mode === 'create' && (
              <Button type="link" icon={<ThunderboltOutlined />} onClick={() => setQuickCreateMode(true)}>
                快速模式
              </Button>
            )}
            <Button icon={<CloseOutlined />} onClick={onCancel}>
              取消
            </Button>
            <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={loading}>
              发送申请
            </Button>
          </div>
        }
      >
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            {assetField}
          </Col>
          <Col xs={24} sm={12}>
            {faultLevelField}
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="request_date" label="申请日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="expected_repair_date" label="期望维修日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="request_department" label="申请部门">
              <Input placeholder="输入申请部门" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="contact_phone" label="联系电话">
              <Input placeholder="输入联系电话" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="fault_description"
          label="故障描述"
          rules={[
            { required: true, message: '请输入故障描述' },
            { min: 5, message: '故障描述至少输入 5 个字符' },
          ]}
        >
          <TextArea rows={5} placeholder="详细描述故障现象、影响范围和现场情况" />
        </Form.Item>
        <Form.Item name="remark" label="备注">
          <TextArea rows={3} placeholder="其他补充说明" />
        </Form.Item>
        {attachmentsField}
      </Card>
    </Form>
  );
};

export default MaintenanceRequestForm;
