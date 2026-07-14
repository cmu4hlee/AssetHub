/**
 * 偏好设置 - 主题/语言/通知/业务提醒
 * 设置保存到 localStorage，后续可接入后端用户偏好表
 */
import React, { useState, useEffect } from 'react';
import {
  Card, Form, Switch, Select, Space, Typography,
  Button, Divider, message, Row, Col, Spin, Popconfirm,
} from 'antd';
import {
  SettingOutlined, BgColorsOutlined, GlobalOutlined, BellOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const PREFS_STORAGE_KEY = 'user_preferences';

// 默认值
const defaultPreferences = {
  theme: 'light',
  compact: false,
  language: 'zh-CN',
  enableSound: true,
  enableDesktopNotif: false,
  enableEmailNotif: true,
  enableSmsNotif: false,
  maintenanceReminder: true,
  warrantyExpiryAlert: true,
  inventoryDueAlert: false,
};

const loadPreferences = () => {
  try {
    const stored = localStorage.getItem(PREFS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // 合并默认值，确保新增字段有默认值
      return { ...defaultPreferences, ...parsed };
    }
  } catch {
    // 损坏数据，清除
    localStorage.removeItem(PREFS_STORAGE_KEY);
  }
  return { ...defaultPreferences };
};

const savePreferences = (values) => {
  try {
    localStorage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({ ...values, savedAt: new Date().toISOString() }),
    );
    return true;
  } catch {
    // localStorage 配额不足等
    return false;
  }
};

const Preferences = () => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const saved = loadPreferences();
    form.setFieldsValue(saved);
    setInitialLoading(false);
  }, [form]);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const ok = savePreferences(values);
      if (ok) {
        message.success('偏好设置已保存');
      } else {
        message.warning('设置已应用，但本地存储空间不足，刷新后可能丢失');
      }
    } catch (err) {
      message.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    form.setFieldsValue(defaultPreferences);
    savePreferences(defaultPreferences);
    message.success('已恢复默认设置');
  };

  if (initialLoading) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', maxWidth: 960 }}>
      <Card
        variant="borderless"
        title={
          <Space>
            <SettingOutlined />
            <span>偏好设置</span>
          </Space>
        }
        extra={
          <Space>
            <Popconfirm
              title="确定恢复默认设置？"
              description="所有偏好设置将重置为默认值"
              onConfirm={handleReset}
              okText="确定"
              cancelText="取消"
            >
              <Button>恢复默认</Button>
            </Popconfirm>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              保存
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Title level={5}>
            <BgColorsOutlined /> 主题外观
          </Title>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item name="theme" label="主题模式">
                <Select
                  options={[
                    { value: 'light', label: '浅色' },
                    { value: 'dark', label: '深色' },
                    { value: 'auto', label: '跟随系统' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="compact" label="紧凑布局" valuePropName="checked">
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Title level={5}>
            <GlobalOutlined /> 语言与时区
          </Title>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item name="language" label="界面语言">
                <Select
                  options={[
                    { value: 'zh-CN', label: '简体中文' },
                    { value: 'zh-TW', label: '繁體中文' },
                    { value: 'en-US', label: 'English' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Title level={5}>
            <BellOutlined /> 通知设置
          </Title>
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Form.Item name="enableSound" label="声音提醒" valuePropName="checked">
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="enableDesktopNotif" label="桌面通知" valuePropName="checked">
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="enableEmailNotif" label="邮件通知" valuePropName="checked">
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="enableSmsNotif" label="短信通知" valuePropName="checked">
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Title level={5}>业务提醒</Title>
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Form.Item
                name="maintenanceReminder"
                label="维保到期提醒"
                valuePropName="checked"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="warrantyExpiryAlert"
                label="保修到期告警"
                valuePropName="checked"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="inventoryDueAlert"
                label="盘点到期提醒"
                valuePropName="checked"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: '#f5f5f5',
            borderRadius: 4,
            color: '#8c8c8c',
            fontSize: 12,
          }}
        >
          <Text type="secondary">
            偏好设置保存到本地浏览器存储。后续将支持：个性化首页卡片、快捷键自定义、邮件订阅主题管理。
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Preferences;
