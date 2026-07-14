import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Form, Input, InputNumber, Space, message, Spin, List, Tag, Popconfirm, Alert, Divider, Checkbox } from 'antd';
import { QrcodeOutlined, CopyOutlined, StopOutlined, ReloadOutlined, LinkOutlined, WifiOutlined, DownloadOutlined } from '@ant-design/icons';
import { tenderingAPI } from '../../api/domains/tendering';

const PERMISSION_OPTIONS = [
  { value: 'view', label: '查看项目详情' },
  { value: 'download', label: '下载招标文件' },
  { value: 'qualify', label: '上传资质材料' },
  { value: 'bid', label: '提交投标' },
];

// 简易 SVG QR Code（使用 qrcode 库渲染）
import QRCode from 'qrcode';

async function renderQRCanvas(canvas, text) {
  await QRCode.toCanvas(canvas, text, {
    width: 240,
    margin: 1,
    color: { dark: '#1d4ed8', light: '#ffffff' },
  });
}

export default function TenderShareQRModal({ visible, tenderId, tenderTitle, onClose }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [activeToken, setActiveToken] = useState(null);
  const [qrUrl, setQrUrl] = useState('');
  const canvasRef = React.useRef(null);

  const fetchTokens = useCallback(async () => {
    if (!tenderId) return;
    setLoading(true);
    try {
      const res = await tenderingAPI.listShareTokens(tenderId);
      // response interceptor 已解包：res 即后端 body
      const arr = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setTokens(arr);
      const active = arr.find(t => !t.revoked);
      setActiveToken(active || null);
    } catch (err) {
      message.error(err.response?.data?.message || '获取 token 列表失败');
    } finally {
      setLoading(false);
    }
  }, [tenderId]);

  useEffect(() => {
    if (visible) {
      form.resetFields();
      form.setFieldsValue({
        valid_days: 30,
        permissions: ['view', 'download', 'qualify', 'bid'],
      });
      fetchTokens();
    }
  }, [visible, form, fetchTokens]);

  // 当 activeToken 变更时计算扫码 URL
  useEffect(() => {
    if (activeToken) {
      const base = window.location.origin;
      setQrUrl(`${base}/tenderer/${activeToken.token}`);
    } else {
      setQrUrl('');
    }
  }, [activeToken]);

  // 当 qrUrl 变更时绘制 QR
  useEffect(() => {
    if (canvasRef.current && qrUrl) {
      renderQRCanvas(canvasRef.current, qrUrl).catch(err => {
        console.error('QR render failed:', err);
      });
    }
  }, [qrUrl]);

  const handleGenerate = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const res = await tenderingAPI.generateShareToken(tenderId, values);
      message.success('项目二维码已生成，原有 token 已撤销');
      setActiveToken(res.data || res);
      await fetchTokens();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (tokenId) => {
    try {
      await tenderingAPI.revokeShareToken(tokenId);
      message.success('已撤销');
      fetchTokens();
    } catch (err) {
      message.error(err.response?.data?.message || '撤销失败');
    }
  };

  const handleCopy = () => {
    if (!qrUrl) return;
    navigator.clipboard.writeText(qrUrl).then(() => {
      message.success('链接已复制');
    }).catch(() => {
      message.warning('浏览器不支持剪贴板，请手动复制');
    });
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `tender-${tenderId}-qr.png`;
    a.click();
  };

  return (
    <Modal
      title={
        <Space>
          <QrcodeOutlined />
          <span>招标项目共享二维码</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      width={760}
      destroyOnHidden
    >
      <Spin spinning={loading}>
        <Alert
          message="项目共享二维码"
          description={
            <span>
              为本招标项目生成一个公开的二维码，供应商扫码后可在有效期/权限范围内查看公告、下载招标文件、上传资质、提交投标。<br />
              {tenderTitle && <>项目：<strong>{tenderTitle}</strong>（ID: {tenderId}）</>}
            </span>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form form={form} layout="vertical" style={{ marginBottom: 12 }}>
          <Space wrap>
            <Form.Item name="valid_days" label="有效天数" rules={[{ required: true, message: '请输入' }]} style={{ marginBottom: 0 }}>
              <InputNumber min={1} max={365} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item
              name="permissions"
              label="权限（多选）"
              rules={[{ required: true, message: '至少选择一项' }]}
              style={{ marginBottom: 0 }}
            >
              <Checkbox.Group
                options={PERMISSION_OPTIONS}
              />
            </Form.Item>
            <Form.Item label=" " colon={false} style={{ marginBottom: 0 }}>
              <Button type="primary" icon={<QrcodeOutlined />} onClick={handleGenerate}>
                生成 / 刷新二维码
              </Button>
            </Form.Item>
          </Space>
        </Form>

        <Divider />

        {activeToken ? (
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <canvas ref={canvasRef} width={240} height={240} style={{ border: '1px solid #eee' }} />
              <div style={{ marginTop: 8 }}>
                <Button size="small" icon={<DownloadOutlined />} onClick={handleDownload}>下载二维码</Button>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 280 }}>
              <Space orientation="vertical" style={{ width: '100%' }} size="small">
                <div>
                  <Tag color="green">当前有效</Tag>
                  <Tag icon={<WifiOutlined />}>扫码链接</Tag>
                </div>
                <div>
                  <Input.TextArea
                    rows={2}
                    value={qrUrl}
                    readOnly
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                </div>
                <Space>
                  <Button icon={<CopyOutlined />} onClick={handleCopy}>复制链接</Button>
                  <Popconfirm title="撤销后所有扫码链接立即失效，确认？" onConfirm={() => handleRevoke(activeToken.id)}>
                    <Button danger icon={<StopOutlined />}>撤销二维码</Button>
                  </Popconfirm>
                </Space>
                <Alert
                  message="使用说明"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                      <li>可截图后发送给供应商，或打印贴在公告中</li>
                      <li>刷新/重新生成会撤销现有 token，已有扫码访问同时失效</li>
                      <li>所有扫码访问均会记录日志，可在「访问日志」中审计</li>
                    </ul>
                  }
                  type="warning"
                  showIcon
                />
                <div style={{ fontSize: 12, color: '#999' }}>
                  过期时间：{activeToken.expires_at ? new Date(activeToken.expires_at).toLocaleString() : '-'}
                </div>
                <div style={{ fontSize: 12, color: '#999' }}>
                  已开启权限：{(activeToken.permissions || []).map(p => PERMISSION_OPTIONS.find(o => o.value === p)?.label || p).join(' / ')}
                </div>
              </Space>
            </div>
          </div>
        ) : (
          <Alert
            message="尚无可用的二维码"
            description="请填写上方表单并点击「生成 / 刷新二维码」创建项目二维码。"
            type="warning"
            showIcon
          />
        )}

        {tokens.length > 0 && (
          <>
            <Divider titlePlacement="left">历史 token</Divider>
            <List
              size="small"
              dataSource={tokens}
              renderItem={item => (
                <List.Item
                  actions={
                    !item.revoked
                      ? [
                          <Popconfirm key="revoke" title="撤销该 token？" onConfirm={() => handleRevoke(item.id)}>
                            <Button type="link" size="small" danger>撤销</Button>
                          </Popconfirm>,
                        ]
                      : [<Tag key="r">已撤销</Tag>]
                  }
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span style={{ fontFamily: 'monospace' }}>{item.token.slice(0, 12)}…</span>
                        {item.revoked ? <Tag color="red">已撤销</Tag> : <Tag color="green">有效</Tag>}
                      </Space>
                    }
                    description={
                      <span style={{ fontSize: 12, color: '#999' }}>
                        创建：{item.created_at ? item.created_at.replace('T', ' ').slice(0, 16) : ''} · 过期：
                        {item.expires_at ? new Date(item.expires_at).toLocaleString() : '-'}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </>
        )}
      </Spin>
    </Modal>
  );
}
