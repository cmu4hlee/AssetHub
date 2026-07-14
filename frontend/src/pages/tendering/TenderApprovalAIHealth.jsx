import React, { useEffect, useState } from 'react';
import { Card, Button, Space, Tag, Alert, Spin, Row, Col } from 'antd';
import {
  RobotOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ApiOutlined, ClockCircleOutlined, WarningOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { tenderingAPI } from '../../api/domains/tendering';
import { PageHeader, KpiCard } from '../../components/tendering';

const MODE_COLORS = { api_key: 'blue', oauth: 'green', none: 'red' };
const MODE_LABELS = { api_key: 'API Key', oauth: 'OAuth Bearer', none: '未配置' };

export default function TenderApprovalAIHealth() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await tenderingAPI.aiHealth();
      setData(res?.data || res);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const isLive = data?.live === true;
  const isOffline = data?.live === false;

  return (
    <div>
      <PageHeader
        title={
          <Space><RobotOutlined /> MiniMax AI 健康自检</Space>
        }
        description="检查 AI 审批服务的连通性、配置状态和性能"
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetch} loading={loading}>
            刷新
          </Button>
        }
      />

      {error ? (
        <Alert
          type="error"
          message={error}
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {loading && !data ? (
        <Card><Spin /> 正在检测…</Card>
      ) : data ? (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <KpiCard
                title="连通性"
                value={isLive ? '在线' : isOffline ? '离线' : '未知'}
                tone={isLive ? 'success' : isOffline ? 'danger' : 'default'}
                icon={isLive ? <CheckCircleOutlined /> : isOffline ? <CloseCircleOutlined /> : <WarningOutlined />}
                hint={isLive ? '可正常调用' : isOffline ? '需要排查' : '等待检测'}
              />
            </Col>
            <Col xs={12} sm={6}>
              <KpiCard
                title="认证模式"
                value={MODE_LABELS[data.mode] || data.mode}
                tone="primary"
                icon={<SafetyCertificateOutlined />}
                hint={data.configured ? '已配置' : '未配置'}
              />
            </Col>
            <Col xs={12} sm={6}>
              <KpiCard
                title="延迟"
                value={data.latency_ms != null ? `${data.latency_ms} ms` : '-'}
                tone={data.latency_ms > 3000 ? 'warning' : 'cyan'}
                icon={<ClockCircleOutlined />}
                hint={data.latency_ms > 3000 ? '偏高' : '正常'}
              />
            </Col>
            <Col xs={12} sm={6}>
              <KpiCard
                title="模型"
                value={data.model || '-'}
                tone="purple"
                icon={<ApiOutlined />}
                hint="当前生效模型"
              />
            </Col>
          </Row>

          <Card title="连接详情" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 12]}>
              <Col xs={24} sm={12}>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>端点</div>
                <code style={{ wordBreak: 'break-all', fontSize: 13 }}>{data.endpoint}</code>
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>配置状态</div>
                <Tag color={data.configured ? 'green' : 'red'}>
                  {data.configured ? '已配置' : '未配置'}
                </Tag>
              </Col>
            </Row>
          </Card>

          {data.reason ? (
            <Alert
              type={isLive ? 'success' : 'warning'}
              message={isLive ? '连通成功' : '连通失败'}
              description={data.reason}
              showIcon
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <Alert
            type="info"
            showIcon
            message="安全提示"
            description={
              <span>
                本页<strong>不会</strong>返回任何 key/token/header 内容。
                任何字段都不含敏感凭证；如需配置请直接修改 <code>backend/.env</code> 文件。
              </span>
            }
          />
        </>
      ) : null}
    </div>
  );
}
