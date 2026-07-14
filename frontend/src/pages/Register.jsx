import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Card, message, Radio, Space, Progress, Tooltip, Modal, Select } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { userAPI } from '../utils/api';
import api from '../api/client';
import './Login.css';

const { Option } = Select;

const PASSWORD_RULES = {
  minLength: { test: p => p.length >= 8, label: '至少8个字符' },
  uppercase: { test: p => /[A-Z]/.test(p), label: '包含大写字母' },
  lowercase: { test: p => /[a-z]/.test(p), label: '包含小写字母' },
  digit: { test: p => /[0-9]/.test(p), label: '包含数字' },
  special: { test: p => /[!@#$%^&*()_+\-={}[\]:;'"|,.<>/?]/.test(p), label: '包含特殊字符' },
};

const getPasswordStrength = (password) => {
  if (!password) return 0;
  return Object.values(PASSWORD_RULES).filter(r => r.test(password)).length;
};

const getPasswordStrengthLevel = (strength) => {
  if (strength <= 1) return { color: '#ff4d4f', text: '弱' };
  if (strength <= 3) return { color: '#faad14', text: '中等' };
  if (strength <= 4) return { color: '#52c41a', text: '强' };
  return { color: '#52c41a', text: '非常强' };
};

const PasswordStrengthIndicator = ({ password }) => {
  const strength = getPasswordStrength(password);
  const { color, text } = getPasswordStrengthLevel(strength);
  const percent = (strength / 5) * 100;

  if (!password) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <Progress
        percent={percent}
        size="small"
        strokeColor={color}
        showInfo={false}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
        {Object.entries(PASSWORD_RULES).map(([key, rule]) => (
          <span
            key={key}
            style={{
              fontSize: 11,
              color: rule.test(password) ? '#52c41a' : '#bfbfbf',
              background: rule.test(password) ? '#f6ffed' : '#f5f5f5',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {rule.label}
          </span>
        ))}
      </div>
    </div>
  );
};

const Register = () => {
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [tenantOption, setTenantOption] = useState('create');
  const [registerMethod, setRegisterMethod] = useState('password');
  const [countdown, setCountdown] = useState(0);
  const [phone, setPhone] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [departmentLoading, setDepartmentLoading] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState([]);

  useEffect(() => {
    form.resetFields();
    setPhone('');
    setCountdown(0);
    setDepartments([]);
    setSelectedDepartments([]);
  }, [registerMethod, tenantOption, form]);

  const loadDepartments = async (keyword = '') => {
    const tenantCode = form.getFieldValue('tenant_code');
    if (!tenantCode || !/^\d{4}$/.test(tenantCode)) {
      message.warning('请先输入4位企业编码');
      return;
    }
    try {
      setDepartmentLoading(true);
      const result = await api.get('/departments/search', {
        params: { tenant_code: tenantCode, keyword },
      });
      if (result.data?.success) {
        setDepartments(result.data.data || []);
      } else {
        message.error(result.data?.message || '获取科室列表失败');
      }
    } catch (error) {
      const msg = error?.response?.data?.message || '获取科室列表失败';
      message.error(msg);
    } finally {
      setDepartmentLoading(false);
    }
  };

  const sendVerificationCode = async () => {
    const phoneNumber = phone || form.getFieldValue('phone');
    const currentTenantOption = tenantOption;
    const tenantCode = form.getFieldValue('tenant_code');

    if (!phoneNumber) {
      message.warning('请先输入手机号');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      message.warning('请输入正确的手机号');
      return;
    }
    if (currentTenantOption === 'join' && !/^\d{4}$/.test(tenantCode || '')) {
      message.warning('请先输入4位企业编码');
      return;
    }

    setCodeLoading(true);
    try {
      const result = await userAPI.sendVerificationCode(phoneNumber, {
        tenantCode: currentTenantOption === 'join' ? tenantCode : undefined,
      });
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
      } else {
        message.error(result.message || '发送失败');
      }
    } catch (error) {
      message.error(error.response?.data?.message || '发送失败');
    } finally {
      setCodeLoading(false);
    }
  };

  const onFinish = async values => {
    if (registerMethod === 'code') {
      await codeRegister(values);
    } else {
      await passwordRegister(values);
    }
  };

  const passwordRegister = async values => {
    try {
      setLoading(true);
      const { confirmPassword, phone, code, ...registerData } = values;
      registerData.tenant_option = tenantOption;
      registerData.phone = phone;

      const result = await userAPI.register(registerData);
      if (result.success) {
        if (tenantOption === 'create') {
          message.success('注册成功！已自动创建企业空间，您是系统管理员。');
        } else {
          message.success('注册成功！已提交企业空间加入申请，请等待系统管理员审核。');
        }
        navigate('/login');
      }
    } catch (error) {
      message.error(error.response?.data?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const codeRegister = async values => {
    try {
      setLoading(true);

      const generatedPassword = `Aa!${values.phone}`;
      const registerData = {
        username: values.phone,
        password: generatedPassword,
        real_name: values.real_name || values.phone,
        phone: values.phone,
        code: values.code,
        tenant_option: tenantOption,
        tenant_name: tenantOption === 'create' ? values.tenant_name : undefined,
        tenant_code: tenantOption === 'join' ? values.tenant_code : undefined,
        managed_departments: values.managed_departments || [],
      };

      const result = await userAPI.register(registerData);
      if (result.success) {
        Modal.success({
          title: '注册成功',
          content: (
            <div>
              <p>您的账号密码为：<strong style={{ fontSize: 18, color: '#1890ff' }}>{generatedPassword}</strong></p>
              <p style={{ color: '#ff4d4f', marginTop: 8 }}>请保存此密码，用于下次登录！</p>
            </div>
          ),
          okText: '去登录',
          onOk: () => navigate('/login'),
        });
      }
    } catch (error) {
      message.error(error.response?.data?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card" title="用户注册">
        <div style={{ marginBottom: 16 }}>
          <Radio.Group
            value={registerMethod}
            onChange={(e) => setRegisterMethod(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="password">账号密码注册</Radio.Button>
            <Radio.Button value="code">验证码注册</Radio.Button>
          </Radio.Group>
        </div>

        <Form form={form} name="register" onFinish={onFinish} autoComplete="off" layout="vertical">
          {registerMethod === 'password' ? (
            <>
              <Form.Item
                name="username"
                label="用户名"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '用户名至少3个字符' },
                  { max: 20, message: '用户名最多20个字符' },
                ]}
              >
                <Input placeholder="请输入用户名" size="large" autoComplete="off" />
              </Form.Item>

              <Form.Item
                name="password"
                label="密码"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 8, message: '密码至少8个字符' },
                ]}
              >
                <Input.Password
                  placeholder="请输入密码"
                  size="large"
                  autoComplete="new-password"
                />
              </Form.Item>

              <PasswordStrengthIndicator password={form.getFieldValue('password')} />

              <Form.Item
                name="confirmPassword"
                label="确认密码"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请确认密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="请再次输入密码" size="large" autoComplete="new-password" />
              </Form.Item>

              <Form.Item
                name="real_name"
                label="真实姓名"
                rules={[{ required: true, message: '请输入真实姓名' }]}
              >
                <Input placeholder="请输入真实姓名" size="large" />
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
                    style={{ width: '60%' }}
                    value={phone}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPhone(value);
                      form.setFieldsValue({ phone: value });
                    }}
                  />
                  <Tooltip title={countdown > 0 ? `请 ${countdown} 秒后再试` : '点击获取验证码'}>
                    <Button
                      htmlType="button"
                      size="large"
                      style={{ width: '40%' }}
                      onClick={sendVerificationCode}
                      disabled={countdown > 0}
                      loading={codeLoading}
                    >
                      {countdown > 0 ? `${countdown}秒` : '获取验证码'}
                    </Button>
                  </Tooltip>
                </Space.Compact>
                <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
                  验证码注册会自动生成账号密码，用于后续登录和账号管理。
                </div>
              </Form.Item>

              <Form.Item
                name="code"
                label="验证码"
                rules={[
                  { required: true, message: '请输入验证码' },
                  { len: 6, message: '验证码必须是6位数字' },
                  { pattern: /^\d+$/, message: '验证码必须是数字' },
                ]}
              >
                <Input placeholder="请输入6位验证码" size="large" maxLength={6} />
              </Form.Item>

              <Form.Item
                name="real_name"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" size="large" />
              </Form.Item>
            </>
          )}

          <Form.Item label="企业空间">
            <Radio.Group
              value={tenantOption}
              onChange={e => setTenantOption(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="create">创建新企业空间</Radio.Button>
              <Radio.Button value="join">加入现有企业空间</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {tenantOption === 'create' ? (
            <Form.Item
              name="tenant_name"
              label="企业名称"
              rules={[{ required: true, message: '请输入企业名称' }]}
              extra="创建后您将自动成为该企业的系统管理员"
            >
              <Input placeholder="请输入企业名称" size="large" />
            </Form.Item>
          ) : (
            <Form.Item
              name="tenant_code"
              label="企业编码"
              rules={[
                { required: true, message: '请输入企业编码' },
                { len: 4, message: '企业编码必须是4位数字' },
                { pattern: /^\d+$/, message: '企业编码必须是数字' },
              ]}
              extra="请向企业管理员索取4位数字编码"
            >
              <Input placeholder="请输入4位数字企业编码" size="large" maxLength={4} />
            </Form.Item>
          )}

          {registerMethod === 'password' && (
            <Form.Item
              name="email"
              label="邮箱"
              rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
            >
              <Input placeholder="请输入邮箱（可选）" size="large" />
            </Form.Item>
          )}

          {tenantOption === 'join' && (
            <Form.Item
              name="managed_departments"
              label="管理部门（可选）"
              extra="可选择多个科室作为您的管理部门，方便后续资产数据权限控制"
            >
              <Select
                mode="multiple"
                placeholder="输入科室名称关键字搜索"
                showSearch
                filterOption={false}
                onSearch={loadDepartments}
                onFocus={() => !departments.length && loadDepartments()}
                onChange={setSelectedDepartments}
                loading={departmentLoading}
                allowClear
                notFoundContent={departmentLoading ? '搜索中...' : '请输入4位企业编码后搜索科室'}
                maxTagCount={5}
                maxTagTextLength={8}
              >
                {departments.map(dept => (
                  <Option key={dept.department_code} value={dept.department_code}>
                    {dept.department_name} ({dept.department_code})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {registerMethod === 'code' && (
            <div style={{ marginBottom: 16, color: '#8c8c8c', fontSize: 12 }}>
              说明：验证码注册仍会创建账号密码，便于后续登录；如需纯验证码登录，请使用登录页的验证码方式。
            </div>
          )}

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              {loading ? '注册中...' : '注册'}
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to="/login">已有账号？立即登录</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Register;
