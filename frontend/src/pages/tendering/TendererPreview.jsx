import React, { useState, useEffect, useCallback } from 'react';
import { message, Empty, Alert, Space, Button, Tag, Row, Col } from 'antd';
import {
  QrcodeOutlined, LinkOutlined, ReloadOutlined, StopOutlined,
  CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined,
} from '@ant-design/icons';
import QRCode from 'qrcode';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  PageHeader, StatusTag, KpiCard, ResponsiveTable,
} from '../../components/tendering';

export default function TendererPreview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tenders, setTenders] = useState([]);
  const [tokensByTender, setTokensByTender] = useState({});
  const [qrCodes, setQrCodes] = useState({});
  const [origin] = useState(() => typeof window !== 'undefined' ? window.location.origin : '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.listProjects({ pageSize: 200 });
      const list = Array.isArray(res?.data) ? res.data : [];
      setTenders(list);
      const map = {};
      await Promise.all(list.map(async t => {
        try {
          const r = await tenderingAPI.listShareTokens(t.id);
          const arr = Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [];
          map[t.id] = arr;
        } catch (e) {
          map[t.id] = [];
        }
      }));
      setTokensByTender(map);
    } catch (err) {
      message.error(err.response?.data?.message || '加载招标项目失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderQr = useCallback(async token => {
    if (!origin || qrCodes[token]) return;
    try {
      const url = `${origin}/tenderer/${token}`;
      const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 1 });
      setQrCodes(prev => ({ ...prev, [token]: dataUrl }));
    } catch (err) {
      console.error('生成二维码失败', err);
    }
  }, [origin, qrCodes]);

  useEffect(() => {
    Object.values(tokensByTender).flat().forEach(t => { if (!t.revoked) renderQr(t.token); });
  }, [tokensByTender, renderQr]);

  const handleRegenerate = async tenderId => {
    try {
      await tenderingAPI.generateShareToken(tenderId, {
        valid_days: 30,
        permissions: ['view', 'download', 'qualify', 'bid'],
      });
      message.success('已生成新的分享 token');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || '生成失败');
    }
  };

  const handleRevoke = async tokenId => {
    try {
      await tenderingAPI.revokeShareToken(tokenId);
      message.success('已撤销');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || '撤销失败');
    }
  };

  const allTokens = Object.values(tokensByTender).flat();
  const validCount = allTokens.filter(t => !t.revoked).length;
  const revokedCount = allTokens.filter(t => t.revoked).length;
  const noTokenCount = tenders.filter(t => !tokensByTender[t.id] || tokensByTender[t.id].length === 0).length;

  const rows = [];
  tenders.forEach(t => {
    const list = tokensByTender[t.id] || [];
    if (list.length === 0) {
      rows.push({ key: `empty-${t.id}`, tender: t, token: null });
    } else {
      list.forEach((tk, idx) => {
        rows.push({
          key: `${t.id}-${tk.id}`,
          tender: t,
          token: tk,
          firstOfTender: idx === 0,
          lastOfTender: idx === list.length - 1,
        });
      });
    }
  });

  const columns = [
    {
      title: '招标项目',
      dataIndex: 'tender',
      width: 240,
      ellipsis: true,
      render: t => (<a onClick={() => navigate(`/tendering/projects/${t.id}`)}>{t.title}</a>),
    },
    { title: '招标编号', dataIndex: ['tender', 'tender_code'], width: 200, ellipsis: true, render: v => (console.log('[TPL col-2 tc]', typeof v, v?.constructor?.name, v?.id ? '<PROJECT>' : v), String(v || '-')) },
    {
      title: '二维码',
      key: 'qr',
      width: 220,
      render: (_, r) => {
        if (!r.token) return <StatusTag status="empty" statusMap={{ empty: { text: '未生成', color: 'default' } }} size="small" />;
        if (r.token.revoked) return <StatusTag status="revoked" statusMap={{ revoked: { text: '已撤销', color: 'red' } }} size="small" />;
        const dataUrl = qrCodes[r.token.token];
        return dataUrl
          ? <img src={dataUrl} alt="QR" style={{ width: 140, height: 140, border: '1px solid #eee', borderRadius: 4 }} />
          : <span style={{ color: '#8c8c8c' }}>生成中...</span>;
      },
    },
    {
      title: 'Token',
      dataIndex: ['token', 'token'],
      width: 320,
      render: (v, r) => v ? (
        <Space>
          <code style={{ background: '#f5f5f5', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
            {v.slice(0, 16)}…{v.slice(-8)}
          </code>
          <Button
            size="small"
            type="link"
            icon={<LinkOutlined />}
            onClick={() => {
              const url = `${origin}/tenderer/${v}`;
              navigator.clipboard?.writeText(url);
              message.success('链接已复制');
            }}
          >
            复制链接
          </Button>
        </Space>
      ) : '-',
    },
    {
      title: '权限',
      dataIndex: ['token', 'permissions'],
      width: 220,
      render: v => (console.log("[TPL col-5 perms]", typeof v, v?.constructor?.name, Array.isArray(v) ? v : null), Array.isArray(v))
        ? (
          <Space size={4} wrap>
            {v.map(p => <Tag key={p} color="blue">{p}</Tag>)}
          </Space>
        )
        : '-',
    },
    {
      title: '过期',
      dataIndex: ['token', 'expires_at'],
      width: 140,
      render: v => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, r) => (
        <Space wrap>
          {r.token ? (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => {
                if (window.confirm('确认撤销该 token？')) {
                  handleRevoke(r.token.id);
                }
              }}
            >
              撤销
            </Button>
          ) : null}
          <Button
            size="small"
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => handleRegenerate(r.tender.id)}
          >
            {r.token ? '刷新' : '生成'} token
          </Button>
        </Space>
      ),
    },
  ];

  const mobileFields = [
    { label: '招标编号', key: 'tender', render: t => t?.tender_code || '-' },
    {
      label: '二维码',
      key: 'token',
      span: 2,
      render: (t, r) => {
        if (!t) return '-';
        if (t.revoked) return <StatusTag status="revoked" statusMap={{ revoked: { text: '已撤销', color: 'red' } }} size="small" />;
        const dataUrl = qrCodes[t.token];
        return dataUrl
          ? <img src={dataUrl} alt="QR" style={{ width: 140, height: 140 }} />
          : '生成中...';
      },
    },
    { label: '过期', key: 'token', render: t => t?.expires_at ? dayjs(t.expires_at).format('YYYY-MM-DD') : '-' },
  ];

  const mobileActions = r => {
    if (!r.tender) return [];
    return [
      {
        key: 'regen', text: r.token ? '刷新' : '生成', icon: <ReloadOutlined />, type: 'primary',
        onClick: () => handleRegenerate(r.tender.id),
      },
      {
        key: 'revoke', text: '撤销', icon: <StopOutlined />, danger: true,
        hidden: !r.token, confirm: '确认撤销该 token？',
        onClick: () => handleRevoke(r.token.id),
      },
      {
        key: 'copy', text: '复制链接', icon: <LinkOutlined />,
        hidden: !r.token,
        onClick: () => {
          const url = `${origin}/tenderer/${r.token.token}`;
          navigator.clipboard?.writeText(url);
          message.success('链接已复制');
        },
      },
    ];
  };

  return (
    <div>
      <PageHeader
        title="公开扫码入口"
        count={tenders.length}
        description="管理每个招标项目的共享二维码，供应商扫码后无需登录即可访问"
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="扫码访问说明"
        description={
          <span>
            任何供应商扫码后，在 token 有效期内，可按授权访问 <code>/tenderer/:token</code>，
            完成查看项目、下载招标文件、上传资质、提交投标等操作。
            也可以在「招标详情页」点击「项目二维码」生成。
          </span>
        }
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <KpiCard
            title="有效 token"
            value={validCount}
            tone="success"
            icon={<CheckCircleOutlined />}
            hint="可扫码访问"
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="已撤销"
            value={revokedCount}
            tone="danger"
            icon={<CloseCircleOutlined />}
            hint="已失效"
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="未生成"
            value={noTokenCount}
            tone="warning"
            icon={<FileTextOutlined />}
            hint="需要生成"
            onClick={() => message.info('在列表中点击"生成 token"按钮')}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="项目总数"
            value={tenders.length}
            tone="primary"
            icon={<QrcodeOutlined />}
            hint="全部招标项目"
          />
        </Col>
      </Row>

      <ResponsiveTable
        dataSource={rows}
        columns={columns}
        loading={loading}
        rowKey="key"
        scroll={{ x: 1500 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        mobileTitleKey="tender"
        mobileTitleRender={r => r.tender?.title || '-'}
        mobileStatusRender={r => {
          if (!r.token) return <StatusTag status="empty" statusMap={{ empty: { text: '未生成', color: 'default' } }} size="small" />;
          if (r.token.revoked) return <StatusTag status="revoked" statusMap={{ revoked: { text: '已撤销', color: 'red' } }} size="small" />;
          return <StatusTag status="valid" statusMap={{ valid: { text: '有效', color: 'green' } }} size="small" />;
        }}
        mobileFields={mobileFields}
        mobileActions={mobileActions}
      />
    </div>
  );
}
