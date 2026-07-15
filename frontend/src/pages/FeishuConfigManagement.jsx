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
  MessageOutlined,
  SaveOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { systemConfigAPI } from '../utils/api';

const FeishuConfigManagement = () => {
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

  // 加载当前飞书配置
  const loadConfig = async () => {
    try {
      setLoading(true);
      const result = await systemConfigAPI.getFeishuConfig();
      if (result.success) {
        const config = result.data;
        setCurrentConfig(config);
        form.setFieldsValue({
          app_id: config.app_id || '',
          app_secret: config.app_secret || (config.app_id ? '******' : ''),
          redirect_uri: config.redirect_uri || '',
          host: config.host || 'https://open.feishu.cn',
          notification_enabled: config.notification_enabled !== false,
          scheduler_enabled: config.scheduler_enabled !== false,
          alert_scan_interval: config.alert_scan_interval || 3600000,
        });
        message.success('飞书配置加载成功');
      } else {
        message.error(result.message || '加载飞书配置失败');
      }
    } catch (error) {
      message.error('加载飞书配置失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 测试飞书连接
  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields(['app_id', 'app_secret']);
      setTesting(true);
      setTestResult(null);

      const result = await systemConfigAPI.testFeishuConnection({
        app_id: values.app_id?.trim(),
        app_secret: values.app_secret === '******' ? undefined : values.app_secret?.trim(),
      });

      if (result.success) {
        setTestResult({ success: true, message: '飞书连接测试成功', details: result.data });
        message.success('飞书连接测试成功');
      } else {
        setTestResult({ success: false, message: result.message || '飞书连接测试失败' });
        message.error(result.message || '飞书连接测试失败');
      }
    } catch (error) {
      if (error.errorFields) return;
      setTestResult({ success: false, message: '测试连接时发生错误', error: error.message });
      message.error('测试连接失败');
    } finally {
      setTesting(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const updateData = {
        app_id: values.app_id?.trim(),
        redirect_uri: values.redirect_uri?.trim(),
        host: values.host?.trim(),
        notification_enabled: values.notification_enabled,
        scheduler_enabled: values.scheduler_enabled,
        alert_scan_interval: values.alert_scan_interval,
      };
      // 只有当 app_secret 不是 ****** 时才发送（防止覆盖原值）
      if (values.app_secret && values.app_secret !== '******') {
        updateData.app_secret = values.app_secret.trim();
      }

      const result = await systemConfigAPI.updateFeishuConfig(updateData);
      if (result.success) {
        message.success('飞书配置保存成功，已立即生效');
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
            <MessageOutlined />
            <span>飞书配置管理</span>
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
              description="配置当前企业空间的飞书自建应用凭证（App ID / App Secret），用于发送业务通知卡片。不同企业空间可独立配置各自的飞书应用。配置保存后立即生效，无需重启服务器。App Secret 显示为 ****** 表示已配置，如需修改请输入新值。建议保存前先点击「测试连接」验证凭证。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            {testResult && (
              <Alert title={testResult.success ? '连接测试成功' : '连接测试失败'}
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
                name="app_id"
                label="App ID"
                rules={[{ required: true, message: '请输入飞书 App ID' }]}
              >
                <Input placeholder="cli_xxxxxxxxxxxxxxxx" />
              </Form.Item>

              <Form.Item
                name="app_secret"
                label="App Secret"
                rules={[{ required: true, message: '请输入飞书 App Secret' }]}
                extra="在飞书开放平台「凭证与基础信息」页面获取；****** 表示已配置，留空或保持 ****** 不修改原值"
              >
                <Input.Password placeholder="输入新的 App Secret 以更新" />
              </Form.Item>

              <Form.Item name="redirect_uri" label="OAuth 回调地址">
                <Input placeholder={`${window.location.origin}/feishu-binding/callback`} />
              </Form.Item>

              <Form.Item
                name="host"
                label="飞书 API 网关地址"
                rules={[{ required: true, message: '请输入飞书 API 网关地址' }]}
                extra="国内版：https://open.feishu.cn；国际版：https://open.larksuite.com"
              >
                <Input />
              </Form.Item>

              <Form.Item
                name="notification_enabled"
                label="启用飞书业务通知"
                valuePropName="checked"
                extra="关闭后将不再推送任何业务场景的飞书卡片"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>

              <Form.Item
                name="scheduler_enabled"
                label="启用定时推送调度器"
                valuePropName="checked"
                extra="开启后将定时扫描智能预警并每日推送数据报表"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>

              <Form.Item
                name="alert_scan_interval"
                label="智能预警扫描间隔（毫秒）"
                rules={[{ required: true, message: '请输入扫描间隔' }]}
                extra="默认 3600000 = 1 小时"
              >
                <InputNumber min={60000} step={60000} style={{ width: '100%' }} />
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
                    测试连接
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

export default FeishuConfigManagement;
