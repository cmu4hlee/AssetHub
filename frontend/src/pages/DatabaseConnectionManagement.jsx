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
  Typography,
  Divider,
  Tag,
  Modal,
} from 'antd';

import {
  DatabaseOutlined,
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { systemConfigAPI } from '../utils/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

const DatabaseConnectionManagement = () => {
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

  // 加载当前数据库配置
  const loadConfig = async () => {
    try {
      setLoading(true);
      console.log('[数据库连接管理] 开始加载当前配置...');
      const result = await systemConfigAPI.getDatabaseConfig();
      if (result.success) {
        const config = result.data;
        console.log('[数据库连接管理] 加载到的配置:', {
          host: config.host,
          port: config.port,
          user: config.user,
          database: config.database,
          hasPassword: !!config.password,
          connectionLimit: config.connectionLimit,
        });
        setCurrentConfig(config);
        // 设置表单值
        const formValues = {
          host: config.host || '',
          port: config.port || 3306,
          user: config.user || '',
          password: config.password || '******', // 如果有密码配置，显示掩码
          database: config.database || '',
          connectionLimit: config.connectionLimit || 10,
          connectTimeout: config.connectTimeout || 10000,
          idleTimeout: config.idleTimeout || 300000,
          maxIdle: config.maxIdle || 3600000,
        };
        console.log('[数据库连接管理] 设置表单值:', formValues);
        form.setFieldsValue(formValues);
        message.success('配置加载成功');
      } else {
        console.error('[数据库连接管理] 加载配置失败:', result.message);
        message.error(result.message || '加载配置失败');
      }
    } catch (error) {
      console.error('[数据库连接管理] 加载配置异常:', error);
      message.error('加载配置失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 测试数据库连接
  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields(['host', 'port', 'user', 'password', 'database']);
      setTesting(true);
      setTestResult(null);

      const result = await systemConfigAPI.testDatabaseConnection({
        host: values.host,
        port: values.port,
        user: values.user,
        password: values.password === '******' ? undefined : values.password, // 如果未修改密码，不发送
        database: values.database,
      });

      if (result.success) {
        setTestResult({
          success: true,
          message: '数据库连接测试成功',
          details: result.data,
        });
        message.success('数据库连接测试成功');
      } else {
        setTestResult({
          success: false,
          message: result.message || '数据库连接测试失败',
          error: result.error,
        });
        message.error(result.message || '数据库连接测试失败');
      }
    } catch (error) {
      if (error.errorFields) {
        return; // 表单验证错误
      }
      console.error('测试连接失败:', error);
      setTestResult({
        success: false,
        message: '测试连接时发生错误',
        error: error.message,
      });
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

      // 如果密码是 ******，说明用户没有修改，不发送密码字段
      const updateData = {
        host: values.host,
        port: values.port,
        user: values.user,
        database: values.database,
        connectionLimit: values.connectionLimit,
        connectTimeout: values.connectTimeout,
        idleTimeout: values.idleTimeout,
        maxIdle: values.maxIdle,
      };

      // 只有当密码不是 ****** 时才发送密码
      if (values.password && values.password !== '******') {
        updateData.password = values.password;
      }

      const result = await systemConfigAPI.updateDatabaseConfig(updateData);
      if (result.success) {
        message.success('数据库配置保存成功，请重启服务器使配置生效');
        await loadConfig(); // 重新加载配置
        setTestResult(null);
      } else {
        message.error(result.message || '保存配置失败');
      }
    } catch (error) {
      if (error.errorFields) {
        return; // 表单验证错误
      }
      console.error('保存配置失败:', error);
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
            <DatabaseOutlined />
            <span>数据库连接管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadConfig}
              loading={loading}
              size={isMobile ? 'small' : 'middle'}
            >
              刷新
            </Button>
          </Space>
        }
        style={{ borderRadius: '8px' }}
      >
        {loading && !currentConfig ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            <Alert
              title="配置说明"
              description="修改数据库配置后需要重启服务器才能生效。建议在修改前先测试连接，确保配置正确。密码字段显示为 ****** 表示当前配置的密码，如需修改请输入新密码。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            {testResult && (
              <Alert
                title={testResult.success ? '连接测试成功' : '连接测试失败'}
                description={
                  <div>
                    <div>{testResult.message}</div>
                    {testResult.details && (
                      <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                        连接信息: {JSON.stringify(testResult.details, null, 2)}
                      </div>
                    )}
                    {testResult.error && (
                      <div style={{ marginTop: 8, fontSize: '12px', color: '#ff4d4f' }}>
                        错误详情: {testResult.error}
                      </div>
                    )}
                  </div>
                }
                type={testResult.success ? 'success' : 'error'}
                showIcon
                icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                style={{ marginBottom: 24 }}
                closable
                onClose={() => setTestResult(null)}
              />
            )}

            <Form form={form} layout="vertical" style={{ maxWidth: 800 }} onFinish={handleSave}>
              <Title level={4} style={{ marginTop: 0 }}>
                基本连接信息
              </Title>

              <Form.Item
                name="host"
                label="数据库主机"
                rules={[{ required: true, message: '请输入数据库主机地址' }]}
              >
                <Input
                  placeholder="例如: 101.37.236.101 或 localhost"
                  size={isMobile ? 'small' : 'middle'}
                />
              </Form.Item>

              <Form.Item
                name="port"
                label="数据库端口"
                rules={[
                  { required: true, message: '请输入数据库端口' },
                  { type: 'number', min: 1, max: 65535, message: '端口号必须在 1-65535 之间' },
                ]}
              >
                <InputNumber
                  placeholder="例如: 3306"
                  style={{ width: '100%' }}
                  min={1}
                  max={65535}
                  size={isMobile ? 'small' : 'middle'}
                />
              </Form.Item>

              <Form.Item
                name="user"
                label="数据库用户名"
                rules={[{ required: true, message: '请输入数据库用户名' }]}
              >
                <Input placeholder="例如: root" size={isMobile ? 'small' : 'middle'} />
              </Form.Item>

              <Form.Item
                name="password"
                label="数据库密码"
                rules={[{ required: true, message: '请输入数据库密码' }]}
                extra="显示为 ****** 表示当前配置的密码，如需修改请输入新密码"
              >
                <Input.Password
                  placeholder="请输入数据库密码"
                  size={isMobile ? 'small' : 'middle'}
                />
              </Form.Item>

              <Form.Item
                name="database"
                label="数据库名称"
                rules={[{ required: true, message: '请输入数据库名称' }]}
              >
                <Input placeholder="例如: zcgl" size={isMobile ? 'small' : 'middle'} />
              </Form.Item>

              <Divider />

              <Title level={4}>连接池配置</Title>

              <Form.Item
                name="connectionLimit"
                label="最大连接数"
                rules={[
                  { required: true, message: '请输入最大连接数' },
                  { type: 'number', min: 1, max: 100, message: '连接数必须在 1-100 之间' },
                ]}
                extra="连接池中允许的最大连接数"
              >
                <InputNumber
                  placeholder="例如: 10"
                  style={{ width: '100%' }}
                  min={1}
                  max={100}
                  size={isMobile ? 'small' : 'middle'}
                />
              </Form.Item>

              <Form.Item
                name="connectTimeout"
                label="连接超时时间（毫秒）"
                rules={[
                  { required: true, message: '请输入连接超时时间' },
                  {
                    type: 'number',
                    min: 1000,
                    max: 60000,
                    message: '超时时间必须在 1000-60000 毫秒之间',
                  },
                ]}
                extra="建立数据库连接的超时时间"
              >
                <InputNumber
                  placeholder="例如: 10000"
                  style={{ width: '100%' }}
                  min={1000}
                  max={60000}
                  step={1000}
                  size={isMobile ? 'small' : 'middle'}
                />
              </Form.Item>

              <Form.Item
                name="idleTimeout"
                label="空闲连接超时（毫秒）"
                rules={[
                  { required: true, message: '请输入空闲连接超时时间' },
                  {
                    type: 'number',
                    min: 60000,
                    max: 3600000,
                    message: '超时时间必须在 60000-3600000 毫秒之间',
                  },
                ]}
                extra="空闲连接在连接池中的最大存活时间"
              >
                <InputNumber
                  placeholder="例如: 300000"
                  style={{ width: '100%' }}
                  min={60000}
                  max={3600000}
                  step={60000}
                  size={isMobile ? 'small' : 'middle'}
                />
              </Form.Item>

              <Form.Item
                name="maxIdle"
                label="连接最大存活时间（毫秒）"
                rules={[
                  { required: true, message: '请输入连接最大存活时间' },
                  {
                    type: 'number',
                    min: 300000,
                    max: 7200000,
                    message: '存活时间必须在 300000-7200000 毫秒之间',
                  },
                ]}
                extra="连接在连接池中的最大存活时间"
              >
                <InputNumber
                  placeholder="例如: 3600000"
                  style={{ width: '100%' }}
                  min={300000}
                  max={7200000}
                  step={300000}
                  size={isMobile ? 'small' : 'middle'}
                />
              </Form.Item>

              <Divider />

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={saving}
                    size={isMobile ? 'small' : 'middle'}
                  >
                    保存配置
                  </Button>
                  <Button
                    icon={<CheckCircleOutlined />}
                    onClick={handleTestConnection}
                    loading={testing}
                    size={isMobile ? 'small' : 'middle'}
                  >
                    测试连接
                  </Button>
                  <Button onClick={handleReset} size={isMobile ? 'small' : 'middle'}>
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
};

export default DatabaseConnectionManagement;
