import React, { useEffect, useMemo, useState } from 'react';
import { useIsMobile } from '../hooks';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Result,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';

import { CopyOutlined, KeyOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getApiErrorMessage, normalizeApiMessage, systemConfigAPI } from '../utils/api';

const { Text } = Typography;

const TokenManagement = () => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [createVisible, setCreateVisible] = useState(false);
  const [createdVisible, setCreatedVisible] = useState(false);
  const [createdToken, setCreatedToken] = useState('');
  const [createdMeta, setCreatedMeta] = useState(null);
  const [rotateVisible, setRotateVisible] = useState(false);
  const [rotateTarget, setRotateTarget] = useState(null);
  const [verifyToken, setVerifyToken] = useState('');
  const [verifyScope, setVerifyScope] = useState('all');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [guideScope, setGuideScope] = useState('all');
  const [usageGuide, setUsageGuide] = useState(null);
  const [form] = Form.useForm();
  const [rotateForm] = Form.useForm();

  const scopeLabelMap = useMemo(() => {
    const map = new Map();
    scopes.forEach(item => map.set(item.key, item.label));
    return map;
  }, [scopes]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [scopeResp, listResp] = await Promise.all([
        systemConfigAPI.getIotTokenScopes(),
        systemConfigAPI.getIotTokens(),
      ]);
      if (scopeResp?.success) {
        setScopes(scopeResp.data || []);
      } else {
        message.error(
          normalizeApiMessage({
            messageText: scopeResp?.message,
            requestUrl: '/system-config/iot-tokens/scopes',
          }) || '加载Token范围失败'
        );
      }
      if (listResp?.success) {
        setTokens(listResp.data || []);
      } else {
        message.error(
          normalizeApiMessage({ messageText: listResp?.message, requestUrl: '/system-config/iot-tokens' }) ||
            '加载Token列表失败'
        );
      }
    } catch (error) {
      message.error(getApiErrorMessage(error, '加载Token数据失败'));
    } finally {
      setLoading(false);
    }
  };

  const loadUsageGuide = async scope => {
    try {
      const resp = await systemConfigAPI.getIotTokenUsageGuide({ scope: scope || 'all' });
      if (resp?.success) {
        setUsageGuide(resp.data || null);
      } else {
        message.error(
          normalizeApiMessage({
            messageText: resp?.message,
            requestUrl: '/system-config/iot-tokens/usage-guide',
          }) || '加载调用说明失败'
        );
      }
    } catch (error) {
      message.error(getApiErrorMessage(error, '加载调用说明失败'));
    }
  };

  useEffect(() => {
    loadData();
    loadUsageGuide('all');
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const response = await systemConfigAPI.generateIotToken({
        token_name: values.token_name,
        scopes: values.scopes,
        expires_in_days: values.expires_in_days || 0,
      });
      if (response?.success) {
        setCreateVisible(false);
        setCreatedToken(response.data?.token || '');
        setCreatedMeta(response.data || null);
        setCreatedVisible(true);
        form.resetFields();
        await loadData();
      } else {
        message.error(
          normalizeApiMessage({
            messageText: response?.message,
            requestUrl: '/system-config/iot-tokens/generate',
          }) || '生成失败'
        );
      }
    } catch (error) {
      if (!error?.errorFields) {
        message.error(getApiErrorMessage(error, '生成Token失败'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async id => {
    setLoading(true);
    try {
      const response = await systemConfigAPI.revokeIotToken(id);
      if (response?.success) {
        message.success('Token已撤销');
        await loadData();
      } else {
        message.error(
          normalizeApiMessage({
            messageText: response?.message,
            requestUrl: `/system-config/iot-tokens/${id}/revoke`,
          }) || '撤销失败'
        );
      }
    } catch (error) {
      message.error(getApiErrorMessage(error, '撤销失败'));
    } finally {
      setLoading(false);
    }
  };

  const openRotateModal = record => {
    setRotateTarget(record);
    rotateForm.setFieldsValue({
      token_name: `${record.token_name}-rotated`,
      expires_in_days: 90,
      rotate_mode: 'grace',
      grace_hours: 24,
    });
    setRotateVisible(true);
  };

  const handleRotate = async () => {
    if (!rotateTarget) return;
    try {
      const values = await rotateForm.validateFields();
      setLoading(true);
      const resp = await systemConfigAPI.rotateIotToken(rotateTarget.id, {
        token_name: values.token_name,
        expires_in_days: values.expires_in_days || 0,
        rotate_mode: values.rotate_mode || 'immediate',
        grace_hours: values.rotate_mode === 'grace' ? values.grace_hours || 24 : 0,
      });
      if (!resp?.success) {
        message.error(
          normalizeApiMessage({
            messageText: resp?.message,
            requestUrl: `/system-config/iot-tokens/${rotateTarget.id}/rotate`,
          }) || 'Token轮换失败'
        );
        return;
      }
      setRotateVisible(false);
      setCreatedVisible(true);
      setCreatedToken(resp.data?.token || '');
      setCreatedMeta(resp.data || null);
      await loadData();
      message.success(
        values.rotate_mode === 'grace'
          ? `Token轮换成功，旧Token将在 ${values.grace_hours || 24} 小时后自动失效`
          : 'Token轮换成功，旧Token已自动撤销',
      );
    } catch (error) {
      if (!error?.errorFields) {
        message.error(getApiErrorMessage(error, 'Token轮换失败'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const token = String(verifyToken || '').trim();
    if (!token) {
      message.warning('请输入待验证Token');
      return;
    }
    setVerifyLoading(true);
    try {
      const resp = await systemConfigAPI.verifyIotToken({
        token,
        scope: verifyScope,
      });
      if (resp?.success) {
        setVerifyResult(resp.data || null);
      } else {
        setVerifyResult(null);
        message.error(
          normalizeApiMessage({
            messageText: resp?.message,
            requestUrl: '/system-config/iot-tokens/verify',
          }) || '验证失败'
        );
      }
    } catch (error) {
      setVerifyResult(null);
      message.error(getApiErrorMessage(error, '验证失败'));
    } finally {
      setVerifyLoading(false);
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'token_name',
      key: 'token_name',
      width: 180,
    },
    {
      title: 'Token标识',
      dataIndex: 'token_prefix',
      key: 'token_prefix',
      width: 170,
      render: value => <Text code>{value}</Text>,
    },
    {
      title: '权限范围',
      dataIndex: 'scope_json',
      key: 'scope_json',
      render: value =>
        (Array.isArray(value) ? value : []).map(scope => (
          <Tag key={scope} color="purple">
            {scopeLabelMap.get(scope) || scope}
          </Tag>
        )),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const status = record.effective_status || record.status;
        if (status === 'rotating') {
          return <Tag color="gold">轮换中</Tag>;
        }
        if (status === 'expired') {
          return <Tag color="default">已过期</Tag>;
        }
        return <Tag color={record.status === 'active' ? 'green' : 'default'}>{record.status === 'active' ? '生效中' : '已撤销'}</Tag>;
      },
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 180,
      render: value => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '永不过期'),
    },
    {
      title: '轮换宽限到',
      dataIndex: 'grace_until',
      key: 'grace_until',
      width: 180,
      render: value => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '最近使用',
      dataIndex: 'last_used_at',
      key: 'last_used_at',
      width: 180,
      render: value => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => {
        if (record.status !== 'active') {
          return <Text type="secondary">-</Text>;
        }
        return (
          <Space size={4}>
            <Button type="link" onClick={() => openRotateModal(record)}>
              轮换
            </Button>
            <Popconfirm
              title="确认撤销该Token？撤销后设备上报会失败。"
              onConfirm={() => handleRevoke(record.id)}
              okText="确认撤销"
              cancelText="取消"
            >
              <Button danger type="link" icon={<StopOutlined />}>
                撤销
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <KeyOutlined />
            企业 IoT Token 管理
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
            生成Token
          </Button>
        }
      >
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 16 }}
          title="用于物联网上报接口鉴权（x-iot-token 或 Bearer Token）。建议按模块拆分Token并设置有效期。"
        />
        <div className="hide-on-mobile">
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={tokens}
            pagination={{ pageSize: 10, showSizeChanger: false }}
          />
        </div>

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {Array.isArray(tokens) && tokens.length > 0 ? (
            tokens.map(record => {
              const status = record.effective_status || record.status;
              const statusNode = status === 'rotating' ? (
                <Tag color="gold">轮换中</Tag>
              ) : status === 'expired' ? (
                <Tag color="default">已过期</Tag>
              ) : (
                <Tag color={record.status === 'active' ? 'green' : 'default'}>{record.status === 'active' ? '生效中' : '已撤销'}</Tag>
              );
              return (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{record.token_name || '-'}</span>
                    <span className="mobile-card-badge">{statusNode}</span>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field mobile-card-field--full">
                      <span className="mobile-card-label">Token标识</span>
                      <span className="mobile-card-value"><Text code>{record.token_prefix || '-'}</Text></span>
                    </div>
                    <div className="mobile-card-field mobile-card-field--full">
                      <span className="mobile-card-label">权限范围</span>
                      <span className="mobile-card-value">
                        {(Array.isArray(record.scope_json) ? record.scope_json : []).map(scope => (
                          <Tag key={scope} color="purple" style={{ marginBottom: 4 }}>
                            {scopeLabelMap.get(scope) || scope}
                          </Tag>
                        ))}
                      </span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">过期时间</span>
                      <span className="mobile-card-value">{record.expires_at ? dayjs(record.expires_at).format('YYYY-MM-DD HH:mm') : '永不过期'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">最近使用</span>
                      <span className="mobile-card-value">{record.last_used_at ? dayjs(record.last_used_at).format('YYYY-MM-DD HH:mm') : '-'}</span>
                    </div>
                    {record.grace_until && (
                      <div className="mobile-card-field mobile-card-field--full">
                        <span className="mobile-card-label">轮换宽限到</span>
                        <span className="mobile-card-value">{dayjs(record.grace_until).format('YYYY-MM-DD HH:mm:ss')}</span>
                      </div>
                    )}
                  </div>
                  {record.status === 'active' && (
                    <div className="mobile-card-actions">
                      <Button size="small" type="primary" ghost onClick={() => openRotateModal(record)}>轮换</Button>
                      <Popconfirm
                        title="确认撤销该Token？撤销后设备上报会失败。"
                        onConfirm={() => handleRevoke(record.id)}
                        okText="确认撤销"
                        cancelText="取消"
                      >
                        <Button size="small" danger icon={<StopOutlined />}>撤销</Button>
                      </Popconfirm>
                    </div>
                  )}
                </div>
              );
            })
          ) : !loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无Token</div>
          ) : null}
        </div>
      </Card>

      <Card title="Token 快速验证" style={{ marginTop: 16 }}>
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Input.Password
            value={verifyToken}
            onChange={e => setVerifyToken(e.target.value)}
            placeholder="输入需要验证的明文Token"
          />
          <Space>
            <Select
              value={verifyScope}
              style={{ minWidth: 200 }}
              onChange={setVerifyScope}
              options={scopes.map(item => ({ value: item.key, label: item.label }))}
            />
            <Button type="primary" loading={verifyLoading} onClick={handleVerify}>
              验证Token
            </Button>
          </Space>
          {verifyResult?.valid === true ? (
            <Result
              status="success"
              title="Token有效"
              subTitle="该Token可用于当前企业的物联网接口鉴权"
              style={{ padding: '8px 0' }}
              extra={
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label="Token标识">
                    {verifyResult?.token?.token_prefix || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="名称">
                    {verifyResult?.token?.token_name || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="权限">
                    {(verifyResult?.token?.scopes || []).join(', ') || '-'}
                  </Descriptions.Item>
                </Descriptions>
              }
            />
          ) : null}
          {verifyResult?.valid === false ? (
            <Result
              status="error"
              title="Token无效"
              subTitle={`原因：${verifyResult?.reason || 'UNKNOWN'}`}
              style={{ padding: '8px 0' }}
            />
          ) : null}
        </Space>
      </Card>

      <Card title="Token 调用说明" style={{ marginTop: 16 }}>
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Radio.Group
            value={guideScope}
            onChange={async e => {
              const nextScope = e.target.value;
              setGuideScope(nextScope);
              await loadUsageGuide(nextScope);
            }}
          >
            {scopes.map(item => (
              <Radio.Button key={item.key} value={item.key}>
                {item.label}
              </Radio.Button>
            ))}
          </Radio.Group>
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="鉴权Header">
              <Text code>{usageGuide?.auth?.header || 'x-iot-token: <YOUR_TOKEN>'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Bearer方式">
              <Text code>{usageGuide?.auth?.bearer || 'Authorization: Bearer <YOUR_TOKEN>'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="上报接口">
              {(usageGuide?.ingest_paths || []).map(path => (
                <div key={path}>
                  <Text code>{path}</Text>
                </div>
              ))}
            </Descriptions.Item>
            <Descriptions.Item label="curl示例">
              <Input.TextArea value={usageGuide?.curl_example || ''} readOnly autoSize={{ minRows: 3, maxRows: 8 }} />
            </Descriptions.Item>
          </Descriptions>
          <Alert
            type="info"
            showIcon
            title="支持使用 {asset_code} 作为业务资产变量拼装请求体，建议按模块最小权限分配独立Token。"
          />
        </Space>
      </Card>

      <Modal
        title="生成企业IoT Token"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={handleCreate}
        confirmLoading={loading}
        okText="生成"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            scopes: ['all'],
            expires_in_days: 90,
          }}
        >
          <Form.Item
            name="token_name"
            label="Token名称"
            rules={[{ required: true, message: '请输入Token名称' }]}
          >
            <Input placeholder="例如：影像科网关-生产环境" maxLength={120} />
          </Form.Item>
          <Form.Item
            name="scopes"
            label="接口权限范围"
            rules={[{ required: true, message: '请选择权限范围' }]}
          >
            <Select mode="multiple" options={scopes.map(item => ({ value: item.key, label: item.label }))} />
          </Form.Item>
          <Form.Item name="expires_in_days" label="有效期（天，0为永不过期）">
            <Input type="number" min={0} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`轮换Token${rotateTarget?.token_name ? `：${rotateTarget.token_name}` : ''}`}
        open={rotateVisible}
        onCancel={() => setRotateVisible(false)}
        onOk={handleRotate}
        confirmLoading={loading}
        okText="确认轮换"
        cancelText="取消"
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title="可选择立即失效或宽限并行（推荐），宽限并行可降低硬件侧切换风险。"
        />
        <Form form={rotateForm} layout="vertical">
          <Form.Item
            name="token_name"
            label="新Token名称"
            rules={[{ required: true, message: '请输入新Token名称' }]}
          >
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item name="expires_in_days" label="有效期（天，0为沿用旧Token过期时间）">
            <Input type="number" min={0} />
          </Form.Item>
          <Form.Item name="rotate_mode" label="轮换策略" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'grace', label: '宽限并行（推荐）' },
                { value: 'immediate', label: '立即失效' },
              ]}
            />
          </Form.Item>
          <Form.Item
            shouldUpdate={(prev, curr) => prev.rotate_mode !== curr.rotate_mode}
            noStyle
          >
            {({ getFieldValue }) =>
              getFieldValue('rotate_mode') === 'grace' ? (
                <Form.Item
                  name="grace_hours"
                  label="宽限期（小时，1-168）"
                  rules={[{ required: true, message: '请输入宽限小时' }]}
                >
                  <Input type="number" min={1} max={168} />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Token明文（仅显示一次）"
        open={createdVisible}
        onCancel={() => setCreatedVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setCreatedVisible(false)}>
            我已保存
          </Button>,
        ]}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title="该明文Token只展示一次，请立即复制保存。"
        />
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">名称：{createdMeta?.token_name || '-'}</Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">权限：{(createdMeta?.scopes || []).join(', ') || '-'}</Text>
        </div>
        {createdMeta?.rotate_mode === 'grace' ? (
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary">
              旧Token宽限到：{createdMeta?.grace_until ? dayjs(createdMeta.grace_until).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Text>
          </div>
        ) : null}
        <Divider style={{ margin: '8px 0 12px' }} />
        <Space.Compact style={{ width: '100%' }}>
          <Input value={createdToken} readOnly style={{ width: '100%' }} />
          <Button
            icon={<CopyOutlined />}
            onClick={async () => {
              await navigator.clipboard.writeText(createdToken || '');
              message.success('Token已复制');
            }}
          >
            复制
          </Button>
        </Space.Compact>
      </Modal>
    </div>
  );
};

export default TokenManagement;
