import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Radio, Space } from 'antd';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { userAPI } from '../utils/api';
import auth from '../utils/auth';
import crypto from '../utils/crypto';
import { isSuperAdmin } from '../utils/roleUtils';
import { getHomePath } from '../utils/feishu';
import './Login.css';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginMethod, setLoginMethod] = useState('password');
  const [countdown, setCountdown] = useState(0);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    form.resetFields();
    setPhone('');
    setCountdown(0);
  }, [loginMethod, form]);

  useEffect(() => {
    (async () => {
      const token = await crypto.getItemAsync('token');
      const user = await crypto.getItemAsync('user');
      if (!token || !user || location.pathname !== '/login') {
        return;
      }

      if (user.tenant_id) {
        navigate(getHomePath(), { replace: true });
        return;
      }

      // 超级管理员 JWT 中无 tenant_id，需按已缓存企业列表跳转（与密码登录成功后的路由一致）
      if (isSuperAdmin(user)) {
        const enterprises = await crypto.getItemAsync('enterprises');
        if (Array.isArray(enterprises) && enterprises.length > 1) {
          navigate('/enterprise-select', { replace: true });
        } else if (Array.isArray(enterprises) && enterprises.length === 1) {
          navigate(getHomePath(), { replace: true });
        } else {
          navigate('/tenants', { replace: true });
        }
      }
    })();
  }, [navigate, location.pathname]);

  const sendVerificationCode = async () => {
    const phoneNumber = phone || form.getFieldValue('phone');
    
    if (!phoneNumber) {
      message.warning('请先输入手机号');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      message.warning('请输入正确的手机号');
      return;
    }
    
    setCodeLoading(true);
    try {
      const result = await userAPI.sendVerificationCode(phoneNumber);
      if (result.success) {
        message.success('验证码已发送');
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (error) {
      message.error(error.response?.data?.message || '发送失败');
    } finally {
      setCodeLoading(false);
    }
  };

  const onFinish = async values => {
    if (loginMethod === 'password') {
      await passwordLogin(values);
    } else {
      await codeLogin(values);
    }
  };

  const passwordLogin = async values => {
    try {
      setLoading(true);
      const loginData = {
        username: values.username,
        password: values.password,
      };

      const result = await userAPI.login(loginData);
      if (result.success) {
        await crypto.setItemAsync('token', result.data.token);
        await crypto.setItemAsync('user', result.data.user);
        auth.setOpenClawCredentials(loginData);

        if (result.needsTenantAssociation) {
          message.warning('请先关联企业');
          navigate('/tenant-association');
        } else if (result.data && Array.isArray(result.data.enterprises) && result.data.enterprises.length > 0) {
          await crypto.setItemAsync('enterprises', result.data.enterprises);
          if (result.data.enterprises.length === 1) {
            const singleEnterprise = result.data.enterprises[0];
            await crypto.setItemAsync('selectedEnterprise', singleEnterprise);
            message.success(`自动进入企业：${singleEnterprise.tenant_name}`);
            navigate(getHomePath());
          } else {
            message.success('登录成功，请选择要进入的企业');
            navigate('/enterprise-select');
          }
        } else {
          await crypto.setItemAsync('enterprises', []);
          crypto.removeItem('selectedEnterprise');
          message.warning('请先关联企业');
          navigate('/tenant-association');
        }
      }
    } catch (error) {
      auth.clearOpenClawCredentials();
      message.error(error.response?.data?.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  const codeLogin = async values => {
    try {
      setLoading(true);
      const phoneNumber = phone || values.phone;
      const result = await userAPI.loginWithCode(phoneNumber, values.code);
      if (result.success) {
        await crypto.setItemAsync('token', result.data.token);
        await crypto.setItemAsync('user', result.data.user);
        auth.setOpenClawCredentials({
          username: result.data.user.username,
          password: '',
        });

        if (result.needsTenantAssociation) {
          if (result.isNewUser) {
            message.success('欢迎使用AssetHost！请选择新增企业或加入企业');
          } else {
            message.warning('请先关联企业');
          }
          navigate('/tenant-association');
        } else if (result.data.enterprises?.length > 0) {
          await crypto.setItemAsync('enterprises', result.data.enterprises);
          if (result.data.enterprises.length === 1) {
            const singleEnterprise = result.data.enterprises[0];
            await crypto.setItemAsync('selectedEnterprise', singleEnterprise);
            message.success(`自动进入企业：${singleEnterprise.tenant_name}`);
            navigate(getHomePath());
          } else {
            message.success('登录成功，请选择要进入的企业');
            navigate('/enterprise-select');
          }
        } else {
          await crypto.setItemAsync('enterprises', []);
          navigate('/tenant-association');
        }
      }
    } catch (error) {
      message.error(error.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Left · Brand panel */}
      <aside className="login-brand-panel">
        <div className="login-brand-content">
          <header className="login-brand-header">
            <div className="login-brand-logo">A</div>
            <div className="login-brand-name">
              Asset<span className="accent">Host</span>
            </div>
          </header>

          <div className="login-brand-statement">
            <div className="login-brand-eyebrow">资产管理系统</div>
            <h1 className="login-brand-title">
              让每一份资产<br />
              <em>井然有序</em>
            </h1>
            <p className="login-brand-tagline">
              从入库、调配、维修到报废的全生命周期管理。智能、可追溯、面向多租户的企业级资产运营平台。
            </p>
          </div>

          <div className="login-brand-features">
            <div className="login-brand-feature">
              <span className="login-brand-feature-dot" />
              <span>全生命周期资产追踪 · 实时库存可视</span>
            </div>
            <div className="login-brand-feature">
              <span className="login-brand-feature-dot" />
              <span>多租户隔离 · 精细化权限体系</span>
            </div>
            <div className="login-brand-feature">
              <span className="login-brand-feature-dot" />
              <span>AI 助手 · 自然语言驱动业务操作</span>
            </div>
          </div>
        </div>

        <footer className="login-brand-footer">
          <span>© AssetHost</span>
          <span>v1.0</span>
        </footer>
      </aside>

      {/* Right · Form panel */}
      <main className="login-form-panel">
        <div className="login-form-wrapper">
          <div className="login-form-header">
            <div className="login-form-eyebrow">Sign In</div>
            <h2 className="login-form-title">欢迎回来</h2>
            <p className="login-form-subtitle">登录以进入您的资产管理工作台</p>
          </div>

          <div className="login-method-switch">
            <Radio.Group
              value={loginMethod}
              onChange={(e) => setLoginMethod(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              style={{ display: 'flex', width: '100%' }}
            >
              <Radio.Button value="password">密码登录</Radio.Button>
              <Radio.Button value="code">验证码登录</Radio.Button>
            </Radio.Group>
          </div>

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            className="login-form"
            requiredMark={false}
          >
            {loginMethod === 'password' ? (
              <>
                <Form.Item
                  name="username"
                  label="用户名"
                  rules={[{ required: true, message: '请输入用户名' }]}
                >
                  <Input placeholder="请输入用户名" size="large" />
                </Form.Item>

                <Form.Item
                  name="password"
                  label="密码"
                  rules={[{ required: true, message: '请输入密码' }]}
                >
                  <Input.Password placeholder="请输入密码" size="large" />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item
                  name="phone"
                  label="手机号"
                  rules={[
                    { required: true, message: '请输入手机号' },
                    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
                  ]}
                >
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      placeholder="请输入手机号"
                      size="large"
                      value={phone}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPhone(value);
                        form.setFieldsValue({ phone: value });
                      }}
                    />
                    <Button
                      htmlType="button"
                      size="large"
                      onClick={sendVerificationCode}
                      disabled={countdown > 0}
                      loading={codeLoading}
                    >
                      {countdown > 0 ? `${countdown}秒` : '获取验证码'}
                    </Button>
                  </Space.Compact>
                </Form.Item>

                <Form.Item
                  name="code"
                  label="验证码"
                  rules={[{ required: true, message: '请输入验证码' }]}
                >
                  <Input placeholder="请输入6位验证码" size="large" maxLength={6} />
                </Form.Item>
              </>
            )}

            <Form.Item style={{ marginBottom: 0, marginTop: 4 }}>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                登录
              </Button>
            </Form.Item>
          </Form>

          <div className="login-footer">
            还没有账号？<Link to="/register">立即注册</Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;