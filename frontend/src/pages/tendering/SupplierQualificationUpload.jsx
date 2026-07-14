import React, { useState, useEffect } from 'react';
import { Card, Spin, Result, Form, Input, Select, Upload, Button, message, List, Tag, Space, DatePicker, Alert, Empty } from 'antd';
import { UploadOutlined, FileOutlined, CheckCircleOutlined, InboxOutlined, SafetyCertificateOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { tenderingPublicAPI } from '../../api/domains/tendering';
import { QUALIFICATION_TYPE_LABELS } from '../../constants/tendering';
import dayjs from 'dayjs';

const { Dragger } = Upload;

export default function SupplierQualificationUpload() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState(null);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedList, setUploadedList] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    (async () => {
      if (!token) {
        setError('二维码无效');
        setLoading(false);
        return;
      }
      try {
        const res = await tenderingPublicAPI.getSupplierByToken(token);
        const data = res.data?.data ?? res.data;
        if (data?.expired) {
          setExpired(true);
          setSupplier(data);
        } else if (data) {
          setSupplier(data);
        } else {
          setError('二维码无效或供应商不存在');
        }
      } catch (err) {
        setError(err.response?.data?.message || '二维码校验失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleUpload = async fileObj => {
    const { file } = fileObj;
    if (!file) return false;
    try {
      const values = await form.validateFields();
      setUploading(true);
      const res = await tenderingPublicAPI.uploadQualification(token, file, {
        qualification_type: values.qualification_type,
        qualification_name: values.qualification_name,
        valid_until: values.valid_until ? values.valid_until.format('YYYY-MM-DD') : undefined,
      });
      const data = res.data?.data ?? res.data;
      message.success('资质材料上传成功');
      setUploadedList(prev => [
        {
          uid: data.id,
          name: file.name,
          qualification_type: values.qualification_type,
          qualification_name: values.qualification_name || QUALIFICATION_TYPE_LABELS[values.qualification_type],
          status: 'done',
        },
        ...prev,
      ]);
      form.resetFields(['qualification_name', 'valid_until']);
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || '上传失败');
    } finally {
      setUploading(false);
    }
    return false;
  };

  // 通用容器样式（公开页面无 Layout）
  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #e4eaf0 100%)',
    padding: '40px 20px',
  };
  const cardStyle = {
    maxWidth: 720,
    margin: '0 auto',
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <Card style={cardStyle}>
          <Spin  description="校验二维码中...">
            <div style={{ height: 120 }} />
          </Spin>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <Card style={cardStyle}>
          <Result status="error" title="二维码无效" subTitle={error} />
        </Card>
      </div>
    );
  }

  if (expired) {
    return (
      <div style={containerStyle}>
        <Card style={cardStyle}>
          <Result
            status="warning"
            title="二维码已过期"
            subTitle={`供应商「${supplier?.supplier_name || ''}」的资质上传二维码已过期，请联系招标方重新生成二维码`}
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <Card style={cardStyle}>
        {/* 顶部欢迎区 */}
        <div style={{
          textAlign: 'center',
          padding: '24px 0',
          borderBottom: '1px solid #f0f0f0',
          marginBottom: 24,
        }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SafetyCertificateOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#262626' }}>
            供应商资质材料上传
          </h2>
          <p style={{ margin: '4px 0 0', color: '#8c8c8c', fontSize: 13 }}>
            免登录 · 安全上传 · 自动加密
          </p>
        </div>

        {/* 供应商信息卡 */}
        <Alert
          type="success"
          icon={<CheckCircleOutlined />}
          showIcon
          style={{ marginBottom: 24 }}
          message={
            <span style={{ fontSize: 15, fontWeight: 500 }}>
              欢迎您，{supplier?.supplier_name}
            </span>
          }
          description={
            <div style={{ marginTop: 4 }}>
              {supplier?.unified_code && (
                <div>统一社会信用代码：{supplier.unified_code}</div>
              )}
              <div style={{ marginTop: 4, fontSize: 12 }}>
                请按招标方要求上传对应资质材料，上传完成后等待招标方审核
              </div>
            </div>
          }
        />

        {/* 步骤提示 */}
        <div style={{ marginBottom: 20 }}>
          <Space size="large" wrap style={{ width: '100%', justifyContent: 'center' }}>
            <StepItem num={1} text="选择资质类型" />
            <StepItem num={2} text="填写资质信息" />
            <StepItem num={3} text="上传文件" />
            <StepItem num={4} text="等待审核" />
          </Space>
        </div>

        <Form form={form} layout="vertical" initialValues={{ qualification_type: 'business_license' }}>
          <Form.Item
            name="qualification_type"
            label="资质类型"
            rules={[{ required: true, message: '请选择资质类型' }]}
          >
            <Select size="large" placeholder="请选择">
              {Object.entries(QUALIFICATION_TYPE_LABELS).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="qualification_name"
            label="资质名称"
            extra="如：医疗器械经营许可证、ISO9001 认证证书等"
          >
            <Input size="large" placeholder="如：医疗器械经营许可证" />
          </Form.Item>

          <Form.Item
            name="valid_until"
            label="资质有效期"
            extra="如资质有明确有效期请填写，便于招标方核验"
          >
            <DatePicker
              size="large"
              style={{ width: '100%' }}
              disabledDate={current => current && current < dayjs().startOf('day')}
            />
          </Form.Item>

          <Form.Item label="上传资质文件" required>
            <Dragger
              multiple={false}
              showUploadList={false}
              beforeUpload={() => false}
              customRequest={handleUpload}
              disabled={uploading}
              style={{
                padding: '24px 0',
                background: uploading ? '#fafafa' : '#fafbfc',
                border: '2px dashed #d9d9d9',
                borderRadius: 8,
              }}
            >
              <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
                <InboxOutlined style={{ fontSize: 48, color: '#1677ff' }} />
              </p>
              <p className="ant-upload-text" style={{ fontSize: 15, fontWeight: 500 }}>
                {uploading ? '上传中...' : '点击或拖拽文件到此区域上传'}
              </p>
              <p className="ant-upload-hint" style={{ color: '#8c8c8c' }}>
                支持营业执照、资质证书、授权书等，单个文件
              </p>
            </Dragger>
          </Form.Item>
        </Form>

        {uploadedList.length > 0 ? (
          <div style={{ marginTop: 24 }}>
            <div style={{
              fontSize: 14, fontWeight: 500, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              本次已上传 {uploadedList.length} 份材料
            </div>
            <List
              dataSource={uploadedList}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<FileOutlined style={{ fontSize: 20, color: '#52c41a' }} />}
                    title={item.name}
                    description={
                      <Space>
                        <Tag color="green">{QUALIFICATION_TYPE_LABELS[item.qualification_type] || item.qualification_type}</Tag>
                        {item.qualification_name && <span>{item.qualification_name}</span>}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        ) : null}

        <Alert
          type="info"
          icon={<ClockCircleOutlined />}
          showIcon
          style={{ marginTop: 24 }}
          message="温馨提示"
          description={
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
              <li>如需上传多份材料，请选择对应资质类型后逐个上传</li>
              <li>上传完成后等待招标方审核，结果将通过您预留的邮箱通知</li>
              <li>如有疑问请联系招标方，不要在此页面泄露敏感信息</li>
            </ul>
          }
        />
      </Card>
    </div>
  );
}

// 步骤组件
function StepItem({ num, text }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 100 }}>
      <div style={{
        width: 32, height: 32, margin: '0 auto 4px',
        background: '#f0f5ff',
        color: '#1677ff',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 600,
      }}>
        {num}
      </div>
      <div style={{ fontSize: 12, color: '#595959' }}>{text}</div>
    </div>
  );
}
