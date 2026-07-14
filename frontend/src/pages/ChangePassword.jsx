/**
 * 修改密码 - 表单 (旧密码 + 新密码 + 确认密码) + 密码强度检测 + 提交
 */
import React, { useState, useMemo } from 'react';
import { Card, Form, Input, Button, Space, Typography, message, Alert, Progress } from 'antd';
import { KeyOutlined, LockOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { userAPI } from '../api/domains/users';
import auth from '../utils/auth';
import crypto from '../utils/crypto';

const { Title, Text } = Typography;

// 密码强度评分规则
const getPasswordStrength = (pwd) => {
  let score = 0;
  if (!pwd) return { score: 0, level: '', color: '#d9d9d9', percent: 0 };

  // 长度评分 (0-2)
  if (pwd.length >= 6) score += 1;
  if (pwd.length >= 10) score += 1;

  // 字符类型评分
  if (/[a-z]/.test(pwd)) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;

  const levels = [
    { score: 0, level: '极弱', color: '#ff4d4f', percent: 10 },
    { score: 1, level: '弱', color: '#ff7a45', percent: 25 },
    { score: 2, level: '一般', color: '#ffa940', percent: 50 },
    { score: 3, level: '良好', color: '#73d13d', percent: 65 },
    { score: 4, level: '强', color: '#52c41a', percent: 80 },
    { score: 5, level: '很强', color: '#1677ff', percent: 95 },
  ];

  return levels[Math.min(score, 5)];
};

const ChangePassword = () => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  const handleSubmit = async (values) => {
    const user = auth.getUser();
    if (!user?.id) {
      message.error('无法获取当前用户信息，请刷新页面后重试');
      return;
    }

    setSubmitting(true);
    try {
      await userAPI.changePassword(user.id, {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      message.success('密码修改成功，请使用新密码重新登录');
      form.resetFields();
      setNewPassword('');
      // 清除登录态，引导重新登录
      setTimeout(() => {
        crypto.removeItem('token');
        crypto.removeItem('user');
        window.location.href = '/login';
      }, 1500);
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || '修改失败，请重试';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '16px', maxWidth: 720 }}>
      <Card
        variant="borderless"
        title={
          <Space>
            <KeyOutlined />
            <span>修改密码</span>
          </Space>
        }
      >
        <Alert
          title="安全提示"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>新密码长度建议 8 位以上，包含字母与数字</li>
              <li>修改成功后需要重新登录</li>
            </ul>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark
          initialValues={{}}
        >
          <Form.Item
            name="oldPassword"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入当前密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码长度不能少于 8 位' },
              {
                pattern: /^(?=.*[a-zA-Z])(?=.*\d)/,
                message: '密码必须同时包含字母和数字',
              },
            ]}
            hasFeedback
            extra={
              newPassword ? (
                <div style={{ marginTop: 4 }}>
                  <Progress
                    percent={strength.percent}
                    showInfo={false}
                    strokeColor={strength.color}
                    size="small"
                  />
                  <Text style={{ fontSize: 12, color: strength.color }}>
                    密码强度：{strength.level}
                  </Text>
                </div>
              ) : null
            }
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入新密码 (至少 8 位，含字母和数字)"
              autoComplete="new-password"
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            hasFeedback
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请再次输入新密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<CheckCircleOutlined />}
                loading={submitting}
              >
                提交修改
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  setNewPassword('');
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ChangePassword;
