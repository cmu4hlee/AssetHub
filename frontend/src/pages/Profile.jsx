/**
 * 个人中心 - 查看/编辑当前用户基本信息
 * 支持编辑：真实姓名、邮箱、手机号
 */
import React, { useEffect, useState } from 'react';
import {
  Card, Descriptions, Avatar, Tag, Space, Typography, Spin, Empty,
  Button, Form, Input, message, Modal, Divider,
} from 'antd';
import {
  UserOutlined, ReloadOutlined, EditOutlined,
  CloseOutlined, CheckOutlined, MailOutlined, PhoneOutlined,
} from '@ant-design/icons';
import { userAPI } from '../api/domains/users';
import crypto from '../utils/crypto';
import auth from '../utils/auth';
import { getRoleDisplayName } from '../utils/roleUtils';
import { getApiErrorMessage } from '../api/client';

const { Title, Text } = Typography;

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadUser = async () => {
    setLoading(true);
    try {
      // 先从缓存读取
      let cached = crypto.getItem('user');
      if (!cached) {
        cached = await crypto.getItemAsync('user');
      }

      // 尝试从服务端获取最新数据
      try {
        const res = await userAPI.getProfile();
        if (res?.success && res?.data) {
          const merged = { ...(cached || {}), ...res.data };
          setUser(merged);
          // 更新缓存
          await crypto.setItemAsync('user', merged);
          setLoading(false);
          return;
        }
      } catch (apiErr) {
        // API 失败时回退缓存数据
        console.warn('[Profile] 获取服务端资料失败，使用缓存:', apiErr?.response?.status);
      }

      setUser(cached);
    } catch (err) {
      console.error('[Profile] 加载当前用户失败:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const startEdit = () => {
    form.setFieldsValue({
      real_name: user?.real_name || '',
      email: user?.email || '',
      phone: user?.phone || user?.mobile || '',
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    form.resetFields();
    setEditing(false);
  };

  const handleSave = async (values) => {
    if (!user?.id) {
      message.error('无法获取用户ID，请刷新后重试');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        real_name: values.real_name?.trim(),
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
      };

      const res = await userAPI.updateUser(user.id, updateData);

      if (res?.success) {
        // 更新本地缓存
        const updatedUser = { ...user, ...updateData };
        if (res.data) {
          Object.assign(updatedUser, res.data);
        }
        setUser(updatedUser);
        await crypto.setItemAsync('user', updatedUser);
        message.success('个人信息修改成功');
        setEditing(false);
      } else {
        message.error(res?.message || '保存失败');
      }
    } catch (err) {
      message.error(getApiErrorMessage(err, '保存失败，请重试'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
        <Spin description="加载中..." />
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <Empty description="未获取到当前用户信息" />
      </Card>
    );
  }

  const roleName = getRoleDisplayName(user.role);
  const isAdmin = user.role === 'super_admin' || user.role === 'system_admin';

  return (
    <div style={{ padding: '16px', maxWidth: 800 }}>
      <Card
        variant="borderless"
        title={
          <Space>
            <UserOutlined />
            <span>个人中心</span>
          </Space>
        }
        extra={
          <Space>
            {!editing ? (
              <>
                <Button icon={<EditOutlined />} onClick={startEdit}>
                  编辑资料
                </Button>
                <Button icon={<ReloadOutlined />} onClick={loadUser}>
                  刷新
                </Button>
              </>
            ) : (
              <>
                <Button onClick={cancelEdit} icon={<CloseOutlined />}>
                  取消
                </Button>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={saving}
                  onClick={() => form.submit()}
                >
                  保存
                </Button>
              </>
            )}
          </Space>
        }
      >
        {/* 用户头像和信息区 */}
        <Space size="large" align="start" style={{ marginBottom: 24 }}>
          <Avatar size={80} icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }}>
            {user.real_name?.[0] || user.username?.[0]?.toUpperCase()}
          </Avatar>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {user.real_name || user.username || '未命名用户'}
            </Title>
            <Space size="small" style={{ marginTop: 8 }}>
              <Tag color={isAdmin ? 'red' : 'blue'}>{roleName}</Tag>
              {user.is_super_admin ? <Tag color="gold">超管</Tag> : null}
              {user.status === 'disabled' ? <Tag color="default">已停用</Tag> : null}
            </Space>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">@{user.username}</Text>
            </div>
          </div>
        </Space>

        <Divider style={{ margin: '16px 0' }} />

        {/* 编辑模式 */}
        {editing ? (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            style={{ maxWidth: 480 }}
          >
            <Form.Item
              name="real_name"
              label="真实姓名"
              rules={[
                { required: true, message: '请输入真实姓名' },
                { max: 50, message: '姓名不能超过50个字符' },
              ]}
            >
              <Input placeholder="请输入真实姓名" />
            </Form.Item>

            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="请输入邮箱地址" />
            </Form.Item>

            <Form.Item
              name="phone"
              label="手机号"
              rules={[
                { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' },
              ]}
            >
              <Input prefix={<PhoneOutlined />} placeholder="请输入手机号" maxLength={11} />
            </Form.Item>

            {/* 表单内的保存/取消按钮——视觉效果同上 */}
            <Form.Item style={{ display: 'none' }}>
              <Button htmlType="submit" />
            </Form.Item>
          </Form>
        ) : (
          /* 查看模式 */
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="用户名">{user.username || '-'}</Descriptions.Item>
            <Descriptions.Item label="姓名">{user.real_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="角色">{roleName}</Descriptions.Item>
            <Descriptions.Item label="角色编码">{user.role || '-'}</Descriptions.Item>
            <Descriptions.Item label="邮箱">
              {user.email ? (
                <Space size={4}>
                  <MailOutlined style={{ color: '#8c8c8c' }} />
                  <span>{user.email}</span>
                </Space>
              ) : (
                <Text type="secondary">未设置</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="手机号">
              {user.phone || user.mobile ? (
                <Space size={4}>
                  <PhoneOutlined style={{ color: '#8c8c8c' }} />
                  <span>{user.phone || user.mobile}</span>
                </Space>
              ) : (
                <Text type="secondary">未设置</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="所属部门">
              {user.department_name || user.department || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="企业空间">
              {user.tenant_name || user.tenant_id || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="最后登录">{user.last_login_at || user.lastLoginAt || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{user.created_at || user.createdAt || '-'}</Descriptions.Item>
          </Descriptions>
        )}

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
            支持修改：真实姓名、邮箱、手机号。如需修改密码，请通过右上角菜单「修改密码」操作。后续将支持头像上传与第三方账号绑定。
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Profile;
