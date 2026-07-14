import React, { useState } from 'react';
import { Button, Form, Input, Modal, Space, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { EnterOutlined, PlusOutlined, LogoutOutlined, TeamOutlined } from '@ant-design/icons';
import { userAPI } from '../utils/api';
import crypto from '../utils/crypto';
import { getHomePath } from '../utils/feishu';
import './Login.css';
import './EnterpriseSelect.css';

const roleMeta = {
  super_admin: { label: '超级管理员', tone: 'role--super' },
  system_admin: { label: '系统管理员', tone: 'role--system' },
  asset_admin: { label: '资产管理员', tone: 'role--asset' },
  department_admin: { label: '部门管理员', tone: 'role--department' },
};

const formatRole = role => roleMeta[role]?.label || '普通用户';

const EnterpriseSelect = () => {
  const navigate = useNavigate();
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const [enterprises] = useState(() => {
    try {
      const cached = crypto.getItem('enterprises');
      if (cached) return cached;
      const raw = localStorage.getItem('enterprises');
      if (raw && !raw.startsWith('E:')) {
        const decoded = crypto.decodeSimple(raw);
        return decoded ? JSON.parse(decoded) : [];
      }
    } catch {
      // ignore
    }
    return [];
  });

  React.useEffect(() => {
    if (enterprises.length === 0) {
      message.error('没有找到可访问的企业，请重新登录');
      navigate('/login');
    }
  }, [enterprises, navigate]);

  const selectEnterprise = enterprise => {
    crypto.setItem('selectedEnterprise', enterprise);
    message.success(`成功进入企业：${enterprise.tenant_name}`);
    navigate(getHomePath());
  };

  const openJoinModal = () => setModalVisible(true);
  const closeJoinModal = () => {
    setModalVisible(false);
    form.resetFields();
  };

  const handleJoinSubmit = async values => {
    try {
      setLoading(true);
      const result = await userAPI.joinEnterprise({ tenant_code: values.tenant_code });
      if (result.success) {
        message.success(result.message || '申请成功，请等待管理员审核');
        closeJoinModal();
      } else {
        message.error(result.message || '申请失败');
      }
    } catch (error) {
      message.error(error.response?.data?.message || '申请失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    crypto.clearAll();
    localStorage.removeItem('enterprises');
    localStorage.removeItem('selectedEnterprise');
    navigate('/login');
  };

  return (
    <div className="login-container enterprise-container">
      {/* LEFT · Brand panel (shared with Login) */}
      <aside className="login-brand-panel">
        <div className="login-brand-content">
          <div className="login-brand-header">
            <span className="login-brand-logo" aria-hidden="true">A</span>
            <span className="login-brand-name">
              Asset<span className="accent">Host</span>
            </span>
          </div>

          <div className="login-brand-statement">
            <div className="login-brand-eyebrow">Tenant Switcher</div>
            <h1 className="login-brand-title">
              多组织一站式，<br />
              <em>切换毫不费力。</em>
            </h1>
            <p className="login-brand-tagline">
              您拥有 {enterprises.length} 个可访问的企业空间。选择一个进入工作台，或申请加入新的企业空间继续协作。
            </p>
          </div>

          <ul className="login-brand-features">
            <li className="login-brand-feature">
              <span className="login-brand-feature-dot" />
              独立的数据隔离与权限边界
            </li>
            <li className="login-brand-feature">
              <span className="login-brand-feature-dot" />
              一键切换，登录态无缝迁移
            </li>
            <li className="login-brand-feature">
              <span className="login-brand-feature-dot" />
              申请加入新企业只需 4 位编码
            </li>
          </ul>
        </div>

        <div className="login-brand-footer">
          <span>© AssetHost</span>
          <span>v1.0 · Multi-tenant</span>
        </div>
      </aside>

      {/* RIGHT · Enterprise list panel */}
      <main className="login-form-panel enterprise-form-panel">
        <div className="enterprise-form-wrapper">
          <header className="enterprise-form-header">
            <div className="login-form-eyebrow">Workspace</div>
            <h2 className="login-form-title">
              选择您的<em>企业空间</em>
            </h2>
            <p className="login-form-subtitle">
              共 {enterprises.length} 个可用空间，点击卡片即可进入工作台。
            </p>
          </header>

          <section
            className={`enterprise-grid ${
              enterprises.length === 1
                ? 'enterprise-grid--1'
                : enterprises.length >= 7
                  ? 'enterprise-grid--many'
                  : ''
            }`}
            aria-label="可访问的企业空间列表"
          >
            {enterprises.map((item, index) => {
              const meta = roleMeta[item.role] || { label: '普通用户', tone: 'role--default' };
              return (
                <article
                  key={item.id}
                  className="enterprise-card"
                  style={{ animationDelay: `${0.1 + index * 0.06}s` }}
                >
                  <div className="enterprise-card-head">
                    <span className="enterprise-card-avatar" aria-hidden="true">
                      <TeamOutlined />
                    </span>
                    <span className={`enterprise-role-badge ${meta.tone}`}>
                      {meta.label}
                    </span>
                  </div>

                  <div className="enterprise-card-body">
                    <h3 className="enterprise-card-name" title={item.tenant_name}>
                      {item.tenant_name}
                    </h3>
                    <div className="enterprise-card-code">{item.tenant_code}</div>
                    <div className="enterprise-card-meta">
                      <span>创建 {new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="enterprise-card-foot">
                    <Button
                      type="primary"
                      icon={<EnterOutlined />}
                      onClick={() => selectEnterprise(item)}
                      block
                    >
                      进入企业
                    </Button>
                  </div>
                </article>
              );
            })}
          </section>

          <footer className="enterprise-form-footer">
            <Button
              type="default"
              icon={<PlusOutlined />}
              onClick={openJoinModal}
              className="enterprise-secondary-btn"
            >
              申请加入其他企业空间
            </Button>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              className="enterprise-logout-btn"
            >
              退出登录
            </Button>
          </footer>
        </div>
      </main>

      {/* Join enterprise modal */}
      <Modal
        title={null}
        open={modalVisible}
        onCancel={closeJoinModal}
        footer={null}
        centered
        width={420}
        className="enterprise-modal"
      >
        <div className="enterprise-modal-head">
          <div className="login-form-eyebrow">Join Workspace</div>
          <h3 className="enterprise-modal-title">申请加入企业空间</h3>
          <p className="enterprise-modal-subtitle">
            向管理员提供 4 位企业空间编码以发起申请。
          </p>
        </div>
        <Form form={form} layout="vertical" onFinish={handleJoinSubmit}>
          <Form.Item
            name="tenant_code"
            label="企业空间编码"
            rules={[
              { required: true, message: '请输入企业空间编码' },
              { pattern: /^\d{4}$/, message: '企业空间编码必须是4位数字' },
            ]}
          >
            <Input placeholder="请输入4位企业空间编码" maxLength={4} size="large" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={closeJoinModal}>取消</Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                提交申请
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EnterpriseSelect;