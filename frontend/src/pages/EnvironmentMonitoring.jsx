import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Input, Row, Select, Space, Table, Tag, Typography, message } from 'antd';
import { assetAPI, assetLocationAPI } from '../utils/api';
import TimeSeriesLineChart from '../components/iot/TimeSeriesLineChart';
import useIsMobile from '../hooks/useIsMobile';

const { Title, Text } = Typography;
const { Option } = Select;

const EnvironmentMonitoring = () => {
  const isMobile = useIsMobile();
  const [deviceId, setDeviceId] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [assetOptions, setAssetOptions] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [latest, setLatest] = useState(null);
  const [series, setSeries] = useState([]);
  const [pipelineHealth, setPipelineHealth] = useState(null);
  const [pipelineDocs, setPipelineDocs] = useState(null);
  const [metric, setMetric] = useState('temperature');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAssets();
    loadPipelineMeta();
  }, []);

  const loadAssets = async keyword => {
    try {
      setAssetLoading(true);
      const res = await assetAPI.getAssets({
        page: 1,
        pageSize: 30,
        keyword: keyword || undefined,
      });
      if (res.success) {
        const assetList = res.data?.list || res.data || [];
        setAssetOptions(Array.isArray(assetList) ? assetList : []);
      }
    } catch (e) {
      message.error(e?.response?.data?.message || '资产列表加载失败');
    } finally {
      setAssetLoading(false);
    }
  };

  const loadPipelineMeta = async () => {
    try {
      const [healthRes, docsRes] = await Promise.all([
        assetLocationAPI.getEnvironmentPipelineHealth(),
        assetLocationAPI.getEnvironmentPipelineDocs(),
      ]);
      if (healthRes?.success) setPipelineHealth(healthRes.data);
      if (docsRes?.success) setPipelineDocs(docsRes.data);
    } catch (e) {
      message.warning(e?.response?.data?.message || '管道状态读取失败');
    }
  };

  const loadLatest = async () => {
    if (!deviceId.trim()) return message.warning('请输入设备ID');
    try {
      setLoading(true);
      const res = await assetLocationAPI.getEnvironmentLatestByDevice(deviceId.trim());
      if (res.success) setLatest(res.data || null);
    } catch (e) {
      message.error(e?.response?.data?.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSeries = async () => {
    if (!assetCode.trim()) return message.warning('请输入资产编码');
    try {
      setLoading(true);
      const res = await assetLocationAPI.getEnvironmentSeriesByAsset(assetCode.trim(), { limit: 120 });
      if (res.success) setSeries(Array.isArray(res.data) ? res.data.reverse() : []);
    } catch (e) {
      message.error(e?.response?.data?.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const injectSampleData = async () => {
    if (!assetCode.trim() || !deviceId.trim()) {
      return message.warning('请先选择资产并输入设备ID');
    }
    try {
      setLoading(true);
      const now = Date.now();
      const events = Array.from({ length: 12 }).map((_, idx) => ({
        device_id: deviceId.trim(),
        asset_code: assetCode.trim(),
        ts: now - (11 - idx) * 60 * 1000,
        values: {
          temperature: 22 + (idx % 4) * 0.6,
          humidity: 42 + (idx % 5) * 1.2,
          pressure: 1012 + (idx % 3) * 0.8,
          co2: 500 + idx * 7,
          pm25: 8 + (idx % 4) * 1.1,
          voc: 0.15 + (idx % 4) * 0.03,
          battery_level: 88 - idx,
        },
      }));
      const res = await assetLocationAPI.ingestEnvironmentSample(events);
      if (res?.success) {
        message.success('样例环境数据已写入');
        await Promise.all([loadLatest(), loadSeries()]);
      }
    } catch (e) {
      message.error(e?.response?.data?.message || '写入样例数据失败');
    } finally {
      setLoading(false);
    }
  };

  const chartPoints = useMemo(
    () => (series || []).filter(row => row?.[metric] !== null && row?.[metric] !== undefined).map(row => ({ time: row.event_time, value: Number(row[metric]) })),
    [series, metric],
  );

  const latestData = latest ? Object.entries(latest).map(([key, value], idx) => ({ id: idx + 1, key, value: value ?? '-' })) : [];

  const selectedAssetCode = assetCode.trim();
  const assetCodePlaceholder = selectedAssetCode || '{asset_code}';
  const encodedAssetCode = encodeURIComponent(assetCodePlaceholder);
  const apiPath = `/api/iot/environment-monitoring/assets/${encodedAssetCode}/series?limit=120`;
  const apiUrl = `${window.location.origin}${apiPath}`;

  return (
    <div style={{ padding: isMobile ? 8 : 16 }}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card>
          <Title level={4} style={{ marginTop: 0 }}>环境监测硬件接入控制台</Title>
          <Space wrap>
            <Tag color="blue">HTTP: /api/iot/environment-monitoring/ingest</Tag>
            <Tag color="purple">MQTT: iot/environment/+/up</Tag>
            <Tag color="orange">Kafka: iot.environment.raw</Tag>
            <Tag color={pipelineHealth?.initialized ? 'green' : 'red'}>
              管道: {pipelineHealth?.initialized ? '已初始化' : '未初始化'}
            </Tag>
          </Space>
        </Card>

        <Card title="资产接口链接与调用说明">
          <Space orientation="vertical" size={10} style={{ width: '100%' }}>
            <Space wrap style={{ width: '100%' }}>
              <Text strong>选择资产：</Text>
              <Select
                showSearch
                allowClear
                placeholder="选择资产（asset_code）"
                value={selectedAssetCode || undefined}
                style={{ minWidth: isMobile ? '100%' : 360 }}
                loading={assetLoading}
                filterOption={false}
                onSearch={loadAssets}
                onOpenChange={open => {
                  if (open) loadAssets();
                }}
                onChange={value => setAssetCode(value || '')}
              >
                {assetOptions.map(asset => (
                  <Option key={asset.asset_code} value={asset.asset_code}>
                    {asset.asset_code} - {asset.asset_name || '未命名资产'}
                  </Option>
                ))}
              </Select>
            </Space>
            <Text code copyable>{apiPath}</Text>
            <Text code copyable>{apiUrl}</Text>
            <Text type="secondary">
              {pipelineDocs?.auth?.token_header
                ? `上报鉴权支持 ${pipelineDocs.auth.token_header} 或 Bearer token`
                : '上报鉴权：按服务端环境变量配置'}
            </Text>
          </Space>
        </Card>

        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Card title="最新上报（按设备）">
              <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                <Input value={deviceId} onChange={e => setDeviceId(e.target.value)} placeholder="设备ID" onPressEnter={loadLatest} />
                <Button type="primary" loading={loading} onClick={loadLatest}>查询</Button>
              </Space.Compact>
              <Button style={{ marginBottom: 12 }} onClick={injectSampleData} loading={loading} block={isMobile}>
                一键生成样例数据
              </Button>
              <div className="hide-on-mobile">
                <Table rowKey="id" size="small" pagination={false} columns={[{ title: '字段', dataIndex: 'key' }, { title: '值', dataIndex: 'value' }]} dataSource={latestData} />
              </div>
              <div className="mobile-table-cards show-on-mobile">
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                ) : latestData.length > 0 ? (
                  <div className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">最新上报数据</span>
                    </div>
                    <div className="mobile-card-body">
                      {latestData.map(item => (
                        <div key={item.id} className="mobile-card-field">
                          <span className="mobile-card-label">{item.key}</span>
                          <span className="mobile-card-value">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Empty description="暂无数据" />
                )}
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="时序曲线（按资产）">
              <Space style={{ width: '100%', marginBottom: 12 }} wrap>
                <Select
                  showSearch
                  allowClear
                  placeholder="选择资产编码"
                  value={selectedAssetCode || undefined}
                  style={{ flex: 1, minWidth: isMobile ? '100%' : 280 }}
                  loading={assetLoading}
                  filterOption={false}
                  onSearch={loadAssets}
                  onOpenChange={open => {
                    if (open) loadAssets();
                  }}
                  onChange={value => setAssetCode(value || '')}
                >
                  {assetOptions.map(asset => (
                    <Option key={asset.asset_code} value={asset.asset_code}>
                      {asset.asset_code} - {asset.asset_name || '未命名资产'}
                    </Option>
                  ))}
                </Select>
                <Button onClick={loadSeries} loading={loading} block={isMobile}>加载</Button>
              </Space>
              <Space style={{ marginBottom: 12 }}>
                <Text>指标</Text>
                <Select value={metric} onChange={setMetric} style={{ width: isMobile ? '100%' : 180 }} options={[
                  { value: 'temperature', label: '温度' },
                  { value: 'humidity', label: '湿度' },
                  { value: 'pressure', label: '气压' },
                  { value: 'co2', label: 'CO2' },
                  { value: 'pm25', label: 'PM2.5' },
                  { value: 'voc', label: 'VOC' },
                ]} />
              </Space>
              <TimeSeriesLineChart points={chartPoints} color="#52c41a" />
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  );
};

export default EnvironmentMonitoring;
