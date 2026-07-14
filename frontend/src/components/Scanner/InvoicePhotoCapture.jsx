import React, { useState, useRef, useCallback } from 'react';
import {
  Modal,
  Button,
  Upload,
  Tabs,
  Space,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Card,
  Spin,
  message,
  Alert,
  Descriptions,
  Tag,
  Divider,
  Result,
  Row,
  Col,
} from 'antd';
import {
  CameraOutlined,
  PictureOutlined,
  UploadOutlined,
  ScanOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  EditOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { tenderingAPI } from '../../api/domains/tendering';
import { INVOICE_KIND } from '../../constants/tendering';

const KIND_OPTIONS = Object.entries(INVOICE_KIND).map(([k, v]) => ({ value: k, label: v.text }));

/**
 * 发票拍照录入对话框
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onConfirm: (data: Object) => void  — 用户确认识别结果后回调，data 为整理后的字段
 */
export default function InvoicePhotoCapture({ open, onClose, onConfirm }) {
  const cameraInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('camera');
  const [loading, setLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('capture'); // capture → reviewing → done
  const [editing, setEditing] = useState(false);

  // 当前识别的图片预览 URL
  const [previewUrl, setPreviewUrl] = useState(null);

  // 编辑用表单
  const [form] = Form.useForm();

  // 重置状态
  const resetState = useCallback(() => {
    setStep('capture');
    setOcrResult(null);
    setError(null);
    setEditing(false);
    setPreviewUrl(null);
    setActiveTab('camera');
    form.resetFields();
  }, [form]);

  // 关闭
  const handleClose = useCallback(() => {
    resetState();
    // 释放预览 URL
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose && onClose();
  }, [onClose, previewUrl, resetState]);

  // OCR 识别
  const doOcr = useCallback(async (file) => {
    if (!file) return;
    setLoading(true);
    setError(null);

    // 创建预览
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    try {
      const res = await tenderingAPI.ocrInvoiceImage(file);
      const data = res?.data?.data || res?.data;

      if (data) {
        setOcrResult(data);
        // 预填编辑表单
        form.setFieldsValue({
          invoice_kind: data.invoice_kind || 'other',
          invoice_no: data.invoice_no || '',
          invoice_code_str: data.invoice_code_str || '',
          issue_date: data.issue_date ? dayjs(data.issue_date) : null,
          amount: data.amount,
          tax_rate: data.tax_rate,
          tax_amount: data.tax_amount,
          excluding_amount: data.excluding_amount,
          remark: data.remark || '',
        });
        setStep('reviewing');
      } else {
        setError('OCR 未能识别出任何发票信息，请重试或手动填写');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'OCR 识别失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [form, previewUrl]);

  // 处理拍照/选择图片
  const handleFileSelect = useCallback((file) => {
    doOcr(file);
    return false; // 阻止默认上传
  }, [doOcr]);

  // 确认并提交
  const handleConfirm = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        issue_date: values.issue_date ? values.issue_date.format('YYYY-MM-DD') : null,
      };
      onConfirm && onConfirm(payload);
      setStep('done');
    } catch (e) {
      // 校验失败
    }
  }, [form, onConfirm]);

  // 重新拍照
  const handleRetake = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setOcrResult(null);
    setError(null);
    setEditing(false);
    setStep('capture');
    form.resetFields();
  }, [form, previewUrl]);

  // 渲染：捕获步骤
  const renderCapture = () => (
    <div>
      <Tabs
        size="small"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'camera',
            label: (
              <span><CameraOutlined /> 拍照</span>
            ),
            children: (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{
                  background: '#f5f5f5',
                  borderRadius: 12,
                  padding: 40,
                  marginBottom: 16,
                  border: '2px dashed #d9d9d9',
                }}>
                  <CameraOutlined style={{ fontSize: 64, color: '#999', marginBottom: 16 }} />
                  <div style={{ fontSize: 15, color: '#666', marginBottom: 8 }}>
                    对准发票，点击拍照
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 24 }}>
                    支持增值税专票/普票/电子发票/收据
                  </div>
                  <Button
                    type="primary"
                    size="large"
                    icon={<CameraOutlined />}
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    拍照识别发票
                  </Button>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                      e.target.value = '';
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, color: '#999' }}>
                  <p>• 确保发票平整、光线充足、字迹清晰</p>
                  <p>• 系统自动识别发票关键字段</p>
                  <p>• 识别结果可手动修正</p>
                </div>
              </div>
            ),
          },
          {
            key: 'upload',
            label: (
              <span><PictureOutlined /> 上传图片</span>
            ),
            children: (
              <div style={{ padding: '8px 0' }}>
                <Upload.Dragger
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={handleFileSelect}
                  disabled={loading}
                >
                  <p className="ant-upload-drag-icon">
                    <UploadOutlined />
                  </p>
                  <p className="ant-upload-text">
                    {loading ? '正在识别...' : '点击或拖入发票图片'}
                  </p>
                  <p className="ant-upload-hint">
                    支持 JPG / PNG / WEBP / BMP 格式的发票照片或扫描件
                  </p>
                </Upload.Dragger>
              </div>
            ),
          },
        ]}
      />
    </div>
  );

  // 渲染：识别结果审查
  const renderReview = () => (
    <div>
      <Alert
        type="success"
        showIcon
        message="识别完成，请核对以下信息"
        description={'如有识别不准确，可点击\u201c编辑\u201d按钮修改，确认无误后点击\u201c录入到表单\u201d'}
        style={{ marginBottom: 16 }}
      />

      <Row gutter={16}>
        <Col xs={24} sm={10}>
          {previewUrl && (
            <Card size="small" title="原图" style={{ marginBottom: 16 }}>
              <img
                src={previewUrl}
                alt="发票原图"
                style={{ width: '100%', borderRadius: 4 }}
              />
            </Card>
          )}
        </Col>
        <Col xs={24} sm={14}>
          {!editing ? (
            <Card
              size="small"
              title="识别结果"
              extra={
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setEditing(true)}
                >
                  编辑
                </Button>
              }
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="发票类型">
                  <Tag color={INVOICE_KIND[ocrResult?.invoice_kind]?.color || 'default'}>
                    {INVOICE_KIND[ocrResult?.invoice_kind]?.text || '未知'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="发票号码">
                  {ocrResult?.invoice_no || <span style={{ color: '#ccc' }}>未识别</span>}
                </Descriptions.Item>
                <Descriptions.Item label="发票代码">
                  {ocrResult?.invoice_code_str || <span style={{ color: '#ccc' }}>未识别</span>}
                </Descriptions.Item>
                <Descriptions.Item label="开票日期">
                  {ocrResult?.issue_date || <span style={{ color: '#ccc' }}>未识别</span>}
                </Descriptions.Item>
                <Descriptions.Item label="含税金额">
                  {ocrResult?.amount != null ? `¥ ${Number(ocrResult.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : <span style={{ color: '#ccc' }}>未识别</span>}
                </Descriptions.Item>
                <Descriptions.Item label="税率">
                  {ocrResult?.tax_rate != null ? `${ocrResult.tax_rate}%` : <span style={{ color: '#ccc' }}>未识别</span>}
                </Descriptions.Item>
                <Descriptions.Item label="税额">
                  {ocrResult?.tax_amount != null ? `¥ ${Number(ocrResult.tax_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : <span style={{ color: '#ccc' }}>未识别</span>}
                </Descriptions.Item>
                <Descriptions.Item label="不含税金额">
                  {ocrResult?.excluding_amount != null ? `¥ ${Number(ocrResult.excluding_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : <span style={{ color: '#ccc' }}>未识别</span>}
                </Descriptions.Item>
                {ocrResult?.supplier_name && (
                  <Descriptions.Item label="销售方">
                    {ocrResult.supplier_name}
                  </Descriptions.Item>
                )}
                {ocrResult?.buyer_name && (
                  <Descriptions.Item label="购买方">
                    {ocrResult.buyer_name}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          ) : (
            <Card
              size="small"
              title="编辑识别结果"
              extra={
                <Button
                  size="small"
                  onClick={() => {
                    setEditing(false);
                    // 回退到当前 form 值
                  }}
                >
                  完成编辑
                </Button>
              }
            >
              <Form
                form={form}
                layout="vertical"
                size="small"
              >
                <Form.Item label="发票类型" name="invoice_kind" rules={[{ required: true }]}>
                  <Select options={KIND_OPTIONS} />
                </Form.Item>
                <Form.Item label="发票号码" name="invoice_no">
                  <Input placeholder="票面发票号" />
                </Form.Item>
                <Form.Item label="发票代码" name="invoice_code_str">
                  <Input placeholder="发票代码" />
                </Form.Item>
                <Form.Item label="开票日期" name="issue_date">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="含税金额" name="amount" rules={[{ required: true, message: '请填写含税金额' }]}>
                  <InputNumber
                    min={0}
                    precision={2}
                    style={{ width: '100%' }}
                    placeholder="0.00"
                    prefix="¥"
                  />
                </Form.Item>
                <Form.Item label="税率(%)" name="tax_rate">
                  <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="税额" name="tax_amount">
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
                </Form.Item>
                <Form.Item label="不含税金额" name="excluding_amount">
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
                </Form.Item>
                <Form.Item label="备注" name="remark">
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Form>
            </Card>
          )}
        </Col>
      </Row>

      <Divider />

      <div style={{ textAlign: 'right' }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRetake}>
            重新拍照
          </Button>
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleConfirm}>
            录入到表单
          </Button>
        </Space>
      </div>
    </div>
  );

  // 渲染：完成
  const renderDone = () => (
    <Result
      status="success"
      title="已录入"
      subTitle="发票信息已识别并填充到表单，请确认后提交"
      extra={[
        <Button key="close" type="primary" onClick={handleClose}>
          返回表单
        </Button>,
      ]}
    />
  );

  // 渲染：错误
  const renderError = () => (
    <div style={{ textAlign: 'center', padding: 24 }}>
      {previewUrl && (
        <img
          src={previewUrl}
          alt="原图"
          style={{ maxWidth: 240, maxHeight: 180, borderRadius: 4, marginBottom: 16 }}
        />
      )}
      <Alert
        type="error"
        showIcon
        message="识别失败"
        description={error || '无法识别发票信息，请确保图片清晰完整'}
        style={{ marginBottom: 16 }}
      />
      <Space>
        <Button icon={<ReloadOutlined />} onClick={handleRetake}>
          重新拍照
        </Button>
        <Button type="primary" onClick={handleClose}>
          手动填写
        </Button>
      </Space>
    </div>
  );

  // 加载动画
  const renderLoading = () => (
    <div style={{ textAlign: 'center', padding: '64px 0' }}>
      <Spin size="large" />
      <div style={{ marginTop: 24, fontSize: 15, color: '#666' }}>
        <ScanOutlined style={{ marginRight: 8 }} />
        正在识别发票信息...
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
        系统正在通过 AI 分析发票图片中的文字内容
      </div>
    </div>
  );

  return (
    <Modal
      title={
        <Space>
          <CameraOutlined />
          拍照录入发票
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={760}
      destroyOnHidden
      footer={null}
    >
      {loading && renderLoading()}
      {!loading && step === 'capture' && renderCapture()}
      {!loading && error && !ocrResult && renderError()}
      {!loading && step === 'reviewing' && ocrResult && renderReview()}
      {!loading && step === 'done' && renderDone()}
    </Modal>
  );
}
