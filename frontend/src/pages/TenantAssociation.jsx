import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Radio, message, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../utils/api';
import crypto from '../utils/crypto';
import { getHomePath } from '../utils/feishu';
import './TenantAssociation.css';

const TenantAssociation = () => {
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState('create');
  const [isNewUser, setIsNewUser] = useState(false);
  const [createdTenant, setCreatedTenant] = useState(null);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  useEffect(() => {
    const checkNewUser = async () => {
      const user = await crypto.getItemAsync('user');
      const isNew = user?.tenant_id === null || user?.tenant_id === undefined;
      setIsNewUser(isNew);
    };
    checkNewUser();
  }, []);

  const handleCreateTenant = async (values) => {
    setLoading(true);
    try {
      const token = await crypto.getItemAsync('token');
      const result = await fetch('/api/tenant-association/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      }).then(r => r.json());

      if (result.success) {
        setCreatedTenant(result.data);
        message.success('企业创建成功');
        const enterprises = [{ id: result.data.tenant_id, tenant_name: result.data.tenant_name, tenant_code: result.data.tenant_code }];
        await crypto.setItemAsync('enterprises', enterprises);
        await crypto.setItemAsync('selectedEnterprise', enterprises[0]);
        await crypto.setItemAsync('user', { ...(await crypto.getItemAsync('user') || {}), tenant_id: result.data.tenant_id, tenant_name: result.data.tenant_name });
      } else {
        message.error(result.message || '创建失败');
      }
    } catch (error) {
      message.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTenant = async (values) => {
    setLoading(true);
    try {
      const token = await crypto.getItemAsync('token');
      const result = await fetch('/api/tenant-association/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      }).then(r => r.json());

      if (result.success) {
        message.success('加入企业成功');
        const enterprises = [{ id: result.data.tenant_id, tenant_name: result.data.tenant_name }];
        await crypto.setItemAsync('enterprises', enterprises);
        await crypto.setItemAsync('selectedEnterprise', enterprises[0]);
        await crypto.setItemAsync('user', { ...(await crypto.getItemAsync('user') || {}), tenant_id: result.data.tenant_id, tenant_name: result.data.tenant_name });
        navigate(getHomePath());
      } else {
        message.error(result.message || '企业编码无效');
      }
    } catch (error) {
      message.error('企业编码无效');
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values) => {
    if (createdTenant) {
      navigate(getHomePath());
      return;
    }
    if (method === 'create') {
      await handleCreateTenant(values);
    } else {
      await handleJoinTenant(values);
    }
  };

  if (createdTenant) {
    return (
      <div className="tenant-association-container">
        <Card className="tenant-association-card">
          <Result
            status="success"
            title="企业创建成功！"
            subTitle={`您已成功成为「${createdTenant.tenant_name}」的系统管理员`}
            extra={[
              <div key="tenant-code" style={{ marginBottom: 24, textAlign: 'center' }}>
                <p style={{ fontSize: 16, margin: 0 }}>您的企业编码：</p>
                <p style={{ 
                  fontSize: 32, 
                  fontWeight: 'bold', 
                  color: '#1890ff', 
                  letterSpacing: 8, 
                  margin: '16px 0 8px',
                  fontFamily: 'monospace'
                }}>
                  {createdTenant.tenant_code}
                </p>
                <p style={{ fontSize: 12, color: '#999', margin: 0 }}>请妥善保存此编码，其他成员将通过此编码加入您的企业</p>
              </div>,
              <Button 
                key="enter" 
                type="primary" 
                size="large" 
                block
                onClick={() => navigate(getHomePath())}
              >
                进入企业空间
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="tenant-association-container">
      <Card className="tenant-association-card" title={isNewUser ? '欢迎加入AssetHost' : '企业关联'}>
        <p className="tenant-desc">
          {isNewUser 
            ? '您已成功注册，请选择创建企业或加入已有企业以开始使用：'
            : '您暂未关联任何企业，请选择以下方式之一进行企业关联：'}
        </p>

        <Radio.Group 
          value={method} 
          onChange={(e) => setMethod(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          style={{ marginBottom: 24 }}
        >
          <Radio.Button value="create">创建新企业</Radio.Button>
          <Radio.Button value="join">加入已有企业</Radio.Button>
        </Radio.Group>

        <Form form={form} onFinish={onFinish} layout="vertical">
          {method === 'create' ? (
            <>
              <Form.Item
                name="tenant_name"
                label="企业名称"
                rules={[{ required: true, message: '请输入企业名称' }]}
              >
                <Input placeholder="请输入企业名称" size="large" />
              </Form.Item>

              <Form.Item
                name="contact_person"
                label="联系人"
              >
                <Input placeholder="请输入联系人姓名" size="large" />
              </Form.Item>

              <Form.Item
                name="contact_phone"
                label="联系电话"
              >
                <Input placeholder="请输入联系电话" size="large" />
              </Form.Item>

              <Form.Item
                name="description"
                label="企业描述"
              >
                <Input.TextArea placeholder="请输入企业描述" rows={3} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="tenant_code"
                label="企业编码"
                rules={[
                  { required: true, message: '请输入4位企业编码' },
                  { len: 4, message: '企业编码必须为4位数字' },
                  { pattern: /^\d{4}$/, message: '企业编码必须是4位数字' },
                ]}
              >
                <Input 
                  placeholder="请输入4位数字企业编码" 
                  size="large" 
                  maxLength={4}
                />
              </Form.Item>
              <div className="invitation-hint">
                请联系企业管理员获取4位数字企业编码
              </div>
            </>
          )}

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              {method === 'create' ? '创建企业' : '加入企业'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default TenantAssociation;
