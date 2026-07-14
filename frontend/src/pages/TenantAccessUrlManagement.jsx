import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Alert, Space, Tag, Spin, Tooltip, Modal } from 'antd';
import { LinkOutlined, SaveOutlined, DeleteOutlined, GlobalOutlined } from '@ant-design/icons';
import api from '../api/client';
import auth from '../utils/auth';

/**
 * 租户访问域名配置页
 *
 * 用于配置该租户在前端可访问的公网域名。
 * - 配置后，飞书通知卡片、分享链接、邮件中的访问 URL 都将使用此域名。
 * - 不允许使用 localhost / 127.0.0.1。
 * - 不配置时使用环境变量 FRONTEND_URL 全局默认。
 */
const TenantAccessUrlManagement = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantUrl, setTenantUrl] = useState('');
  const [tenantKey, setTenantKey] = useState('access_url');
  const [globalDefault, setGlobalDefault] = useState('');
  const [effectiveUrl, setEffectiveUrl] = useState('');

  // 当前租户 ID（异步解析）
  const [currentTenantId, setCurrentTenantId] = useState(null);

  // 异步解析 tenantId（兼容 user 加密存储场景）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await auth.getUserAsync();
        const sel = await auth.getSelectedEnterpriseAsync();
        let tid = null;
        if (user?.role === 'super_admin') {
          tid = sel?.id || user?.tenant_id || null;
        } else {
          tid = user?.tenant_id || sel?.id || null;
        }
        if (!cancelled) {
          setCurrentTenantId(tid);
        }
      } catch (e) {
        if (!cancelled) setCurrentTenantId(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!currentTenantId) {
      setLoading(false);
      return;
    }
    loadConfig(currentTenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenantId]);

  const loadConfig = async (tid) => {
    const tenantId = tid || currentTenantId;
    try {
      setLoading(true);
      const res = await api.get(`/tenant-access-url/${tenantId}`);
        // axios interceptor 已经把 response.data 解包，所以 res 本身就是后端返回体
        if (res?.success) {
          const data = res.data;
          setGlobalDefault(data?.globalDefault || '');
          setEffectiveUrl(data?.effectiveUrl || '');
          const accessUrl = (data?.tenantAccessUrls || []).find(u => u.key === 'access_url');
          const frontendUrl = (data?.tenantAccessUrls || []).find(u => u.key === 'frontend_url');
          if (accessUrl && accessUrl.url) {
          setTenantUrl(accessUrl.url);
          setTenantKey('access_url');
          form.setFieldsValue({ url: accessUrl.url });
        } else if (frontendUrl && frontendUrl.url) {
          setTenantUrl(frontendUrl.url);
          setTenantKey('frontend_url');
          form.setFieldsValue({ url: frontendUrl.url });
        } else {
          form.setFieldsValue({ url: '' });
        }
      }
    } catch (e) {
      message.error('加载配置失败：' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await api.put(`/tenant-access-url/${currentTenantId}`, {
            url: values.url,
            key: tenantKey,
          });
      if (res?.success) {
        message.success('已保存，飞书卡片下次发送时将使用此域名');
        await loadConfig(currentTenantId);
      } else {
        message.error(res?.message || '保存失败');
      }
    } catch (e) {
      if (e.errorFields) return; // 表单校验失败
      const msg = e.response?.data?.message || e.message;
      message.error('保存失败：' + msg);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    Modal.confirm({
      title: '确认清除租户域名？',
      content: '清除后飞书卡片将使用全局默认域名（FRONTEND_URL），如未配置则不显示跳转按钮。',
      okText: '确认清除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await api.delete(`/tenant-access-url/${currentTenantId}`, {
            data: { key: tenantKey },
          });
          if (res?.success) {
            message.success('已清除');
            form.setFieldsValue({ url: '' });
            setTenantUrl('');
            await loadConfig(currentTenantId);
          }
        } catch (e) {
          message.error('清除失败：' + (e.response?.data?.message || e.message));
        }
      },
    });
  };

  // 提供一个简单的 Modal（避免引入 useModal hook 复杂性）

  if (!currentTenantId) {
    return (
      <Card title={<><GlobalOutlined /> 访问域名配置</>}>
        <Alert
          type="warning"
          message="无法识别当前租户，请登录后访问此页面"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Card
      title={<><GlobalOutlined /> 访问域名配置</>}
      extra={
        <Space>
          <Tooltip title="打开当前生效的访问链接，验证是否可访问">
            <Button
              type="link"
              icon={<LinkOutlined />}
              href={effectiveUrl || globalDefault || '#'}
              target="_blank"
              disabled={!effectiveUrl && !globalDefault}
            >
              测试当前生效域名
            </Button>
          </Tooltip>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="为什么需要配置？"
          description={
            <div>
              飞书通知卡片中的「查看详情」按钮 <strong>必须是绝对 URL</strong>，否则飞书客户端无法跳转。
              此处配置的域名将用于：飞书卡片按钮链接、邮件通知链接、分享链接等。
              <br />
              <strong>配置规则</strong>：必须以 <code>http://</code> 或 <code>https://</code> 开头，
              不允许 <code>localhost</code> / <code>127.0.0.1</code>，必须包含域名（如 <code>assethub.your-domain.com</code>）。
            </div>
          }
        />

        {globalDefault && (
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
            message={
              <Space>
                <span>全局默认域名（来自环境变量 FRONTEND_URL）：</span>
                <Tag color="green">{globalDefault}</Tag>
              </Space>
            }
          />
        )}

        <Form form={form} layout="vertical" style={{ maxWidth: 700 }}>
          <Form.Item
            name="url"
            label="本租户的访问域名"
            rules={[
              { required: true, message: '请输入域名' },
              {
                pattern: /^https?:\/\/([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(:\d+)?$/,
                message: '格式不正确，例如：https://assethub.example.com 或 http://103.40.14.91:17565',
              },
            ]}
            extra="例如：https://assethub.example.com 或 http://103.40.14.91:17565（末尾不要带斜杠）"
          >
            <Input
              placeholder="https://assethub.example.com"
              prefix={<LinkOutlined />}
              allowClear
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
              >
                保存
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleClear}
                disabled={!tenantUrl}
              >
                清除租户域名（使用全局默认）
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Card type="inner" title="当前生效" style={{ marginTop: 16 }}>
          <Space orientation="vertical" style={{ width: '100%' }}>
            <div>
              <strong>全局默认：</strong>
              <Tag color={globalDefault ? 'blue' : 'default'}>
                {globalDefault || '未配置（飞书卡片将无跳转按钮）'}
              </Tag>
            </div>
            <div>
              <strong>租户配置：</strong>
              <Tag color={tenantUrl ? 'purple' : 'default'}>
                {tenantUrl || '未配置'}
              </Tag>
            </div>
            <div>
              <strong>最终生效：</strong>
              <Tag color={effectiveUrl ? 'green' : 'red'}>
                {effectiveUrl || '未配置（飞书卡片将无跳转按钮）'}
              </Tag>
              {effectiveUrl && (
                <Button
                  type="link"
                  size="small"
                  href={effectiveUrl}
                  target="_blank"
                  icon={<LinkOutlined />}
                >
                  验证
                </Button>
              )}
            </div>
          </Space>
        </Card>
      </Spin>
    </Card>
  );
};

export default TenantAccessUrlManagement;