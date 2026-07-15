import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../hooks';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Space,
  message,
  Alert,
  Spin,
  Switch,
  Modal,
} from 'antd';

import {
  MailOutlined,
  SaveOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { systemConfigAPI } from '../utils/api';

const EmailConfigManagement = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [currentConfig, setCurrentConfig] = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    loadConfig();
  }, []);

  // 加载当前邮件配置
  const loadConfig = async () => {
    try {
      setLoading(true);
      const result = await systemConfigAPI.getEmailConfig();
      if (result.success) {
        const config = result.data;
        setCurrentConfig(config);
        form.setFieldsValue({
          host: config.host || '',
          port: config.port || 465,
          secure: config.secure !== false,
          user: config.user || '',
          pass: config.pass || (config.user ? '******' : ''),
          from: config.from || '',
          test_to: '', // 测试收件人默认空
        });
        message.success('邮件配置加载成功');
      } else {
        message.error(result.message || '加载邮件配置失败');
      }
    } catch (error) {
      message.error('加载邮件配置失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 测试邮件发送
  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields(['host', 'port', 'secure', 'user', 'pass', 'from', 'test_to']);
      setTesting(true);
      setTestResult(null);

      const result = await systemConfigAPI.testEmailConnection({
        host: values.host,
        port: values.port,
        secure: values.secure,
        user: values.user,
        pass: values.pass === '******' ? undefined : values.pass,
        from: values.from,
        to: values.test_to || values.user,
      });

      if (result.success) {
        setTestResult({ success: true, message: result.message, details: result.data });
        message.success('测试邮件发送成功');
      } else {
        setTestResult({ success: false, message: result.message || '邮件测试失败' });
        message.error(result.message || '邮件测试失败');
      }
    } catch (error) {
      if (error.errorFields) return;
      setTestResult({ success: false, message: '测试发送时发生错误', error: error.message });
      message.error('测试发送失败');
    } finally {
      setTesting(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    try {
      const values = await form.validateFields(['host', 'port', 'secure', 'user', 'pass', 'from']);
      setSaving(true);

      const updateData = {
        host: values.host,
        port: values.port,
        secure: values.secure,
        user: values.user,
        from: values.from,
      };
      // 只有当 pass 不是 ****** 时才发送（防止覆盖原值）
      if (values.pass && values.pass !== '******') {
        updateData.pass = values.pass;
      }

      const result = await systemConfigAPI.updateEmailConfig(updateData);
      if (result.success) {
        message.success('邮件配置保存成功，已立即生效');
        await loadConfig();
        setTestResult(null);
      } else {
        message.error(result.message || '保存配置失败');
      }
    } catch (error) {
      if (error.errorFields) return;
      message.error('保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  // 重置表单
  const handleReset = () => {
    Modal.confirm({
      title: '确认重置',
      content: '确定要重置所有修改吗？未保存的更改将丢失。',
      onOk: () => {
        loadConfig();
        setTestResult(null);
      },
    });
  };

  return (
    <div style={{ padding: isMobile ? '16px' : '24px' }}>
      <Card
        title={
          <Space>
            <MailOutlined />
            <span>邮件 SMTP 配置</span>
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadConfig} loading={loading} size={isMobile ? 'small' : 'middle'}>
            刷新
          </Button>
        }
        style={{ borderRadius: '8px' }}
      >
        {loading && !currentConfig ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            <Alert title="配置说明"
              description="配置当前企业空间的 SMTP 邮件服务器，用于向供应商发送中标通知、资质审核结果、招标邀请等邮件。不同企业空间可独立配置各自的 SMTP。配置保存后立即生效，无需重启服务器。密码字段显示为 ****** 表示已配置（如 126 邮箱需填客户端授权码而非登录密码），留空或保持 ****** 不修改原值。建议保存前先填写测试收件人并点击「测试发送」验证配置。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            {testResult && (
              <Alert title={testResult.success ? '测试发送成功' : '测试发送失败'}
                description={
                  <div>
                    <div>{testResult.message}</div>
                    {testResult.details && (
                      <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                        详情: {JSON.stringify(testResult.details, null, 2)}
                      </div>
                    )}
                    {testResult.error && (
                      <div style={{ marginTop: 8, fontSize: '12px', color: '#ff4d4f' }}>
                        错误: {testResult.error}
                      </div>
                    )}
                  </div>
                }
                type={testResult.success ? 'success' : 'error'}
                showIcon
                closable
                onClose={() => setTestResult(null)}
                style={{ marginBottom: 24 }}
              />
            )}

            <Form form={form} layout="vertical">
              <Form.Item
                name="host"
                label="SMTP 服务器地址"
                rules={[{ required: true, message: '请输入 SMTP 服务器地址' }]}
                extra="如 126 邮箱：smtp.126.com；QQ 邮箱：smtp.qq.com；企业微信：smtp.exmail.qq.com"
              >
                <Input placeholder="smtp.126.com" />
              </Form.Item>

              <Form.Item
                name="port"
                label="端口"
                rules={[{ required: true, message: '请输入端口' }]}
                extra="SSL 通常用 465；STARTTLS 用 587；25 端口已被多数运营商封禁"
              >
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                name="secure"
                label="启用 SSL 加密"
                valuePropName="checked"
                extra="465 端口选 true（SSL）；587 端口选 false（STARTTLS）"
              >
                <Switch checkedChildren="SSL" unCheckedChildren="STARTTLS" />
              </Form.Item>

              <Form.Item
                name="user"
                label="发件邮箱账号"
                rules={[{ required: true, message: '请输入发件邮箱账号' }]}
                extra="完整邮箱地址，如 xxx@126.com"
              >
                <Input placeholder="xxx@126.com" />
              </Form.Item>

              <Form.Item
                name="pass"
                label="密码 / 授权码"
                rules={[{ required: true, message: '请输入密码或授权码' }]}
                extra="126/QQ 邮箱需填网页端生成的客户端授权码，不是登录密码；****** 表示已配置"
              >
                <Input.Password placeholder="输入新的授权码以更新" />
              </Form.Item>

              <Form.Item
                name="from"
                label="发件人地址"
                rules={[{ required: true, message: '请输入发件人地址' }]}
                extra="一般与发件邮箱账号相同"
              >
                <Input placeholder="xxx@126.com" />
              </Form.Item>

              <Form.Item
                name="test_to"
                label="测试收件人"
                extra="用于点击「测试发送」时接收测试邮件，留空则默认发送到发件邮箱本身"
              >
                <Input placeholder="可选，如 admin@example.com" />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={saving}
                  >
                    保存配置
                  </Button>
                  <Button onClick={handleTestConnection} loading={testing}>
                    测试发送
                  </Button>
                  <Button onClick={handleReset}>重置</Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
};

export default EmailConfigManagement;
