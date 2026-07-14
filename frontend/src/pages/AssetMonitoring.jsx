import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Image,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';

import { assetAPI, assetLocationAPI } from '../utils/api';
import TimeSeriesLineChart from '../components/iot/TimeSeriesLineChart';
import useIsMobile from '../hooks/useIsMobile';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const DEFAULT_ERROR_PAGINATION = {
  current: 1,
  pageSize: 10,
  total: 0,
};

const severityMap = {
  critical: { color: 'red', label: '严重' },
  high: { color: 'volcano', label: '高' },
  medium: { color: 'gold', label: '中' },
  low: { color: 'blue', label: '低' },
};

const formatDateTime = value => {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : String(value);
};

const buildAbsoluteFileUrl = fileUrl => {
  if (!fileUrl) return '';
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  if (typeof window === 'undefined') return fileUrl;
  return `${window.location.origin}${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`;
};

const normalizeSeverity = value => {
  const key = String(value || '').trim().toLowerCase();
  return severityMap[key] || { color: 'default', label: value || '未设置' };
};

const AssetMonitoring = () => {
  const [deviceId, setDeviceId] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [assetOptions, setAssetOptions] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [latest, setLatest] = useState(null);
  const [series, setSeries] = useState([]);
  const [pipelineHealth, setPipelineHealth] = useState(null);
  const [pipelineDocs, setPipelineDocs] = useState(null);
  const [metric, setMetric] = useState('battery_level');
  const [loading, setLoading] = useState(false);
  const [errorLoading, setErrorLoading] = useState(false);
  const [errorDeviceId, setErrorDeviceId] = useState('');
  const [errorTimeRange, setErrorTimeRange] = useState([]);
  const [errorReports, setErrorReports] = useState([]);
  const [errorPagination, setErrorPagination] = useState(DEFAULT_ERROR_PAGINATION);
  const selectedAssetCode = assetCode.trim();

  useEffect(() => {
    loadAssets();
    loadPipelineMeta();
  }, []);

  useEffect(() => {
    if (!selectedAssetCode) {
      setErrorReports([]);
      setErrorPagination(DEFAULT_ERROR_PAGINATION);
      return;
    }

    loadErrorReports(1, DEFAULT_ERROR_PAGINATION.pageSize);
  }, [selectedAssetCode]);

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
        const normalizedList = Array.isArray(assetList) ? assetList : [];
        setAssetOptions(normalizedList);

        if (!assetCode && normalizedList.length > 0 && normalizedList[0]?.asset_code) {
          setAssetCode(normalizedList[0].asset_code);
        }
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
        assetLocationAPI.getAssetMonitoringPipelineHealth(),
        assetLocationAPI.getAssetMonitoringPipelineDocs(),
      ]);
      if (healthRes?.success) setPipelineHealth(healthRes.data);
      if (docsRes?.success) setPipelineDocs(docsRes.data);
    } catch (e) {
      message.warning(e?.response?.data?.message || '管道状态读取失败');
    }
  };

  const handleAssetCodeChange = value => {
    setAssetCode(value || '');
    setErrorReports([]);
    setErrorPagination(DEFAULT_ERROR_PAGINATION);
  };

  const loadLatest = async () => {
    if (!deviceId.trim()) return message.warning('请输入设备ID');
    try {
      setLoading(true);
      const res = await assetLocationAPI.getAssetMonitoringLatestByDevice(deviceId.trim());
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
      const res = await assetLocationAPI.getAssetMonitoringSeriesByAsset(assetCode.trim(), {
        limit: 120,
      });
      if (res.success) setSeries(Array.isArray(res.data) ? res.data.reverse() : []);
    } catch (e) {
      message.error(e?.response?.data?.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const loadErrorReports = async (
    page = 1,
    pageSize = errorPagination.pageSize,
    overrides = {},
  ) => {
    if (!assetCode.trim()) return message.warning('请先选择资产编码');

    const deviceKeyword =
      overrides.errorDeviceId !== undefined ? overrides.errorDeviceId : errorDeviceId;
    const timeRange =
      overrides.errorTimeRange !== undefined ? overrides.errorTimeRange : errorTimeRange;

    const params = {
      page,
      pageSize,
    };

    if (deviceKeyword.trim()) {
      params.device_id = deviceKeyword.trim();
    }

    if (Array.isArray(timeRange) && timeRange.length === 2) {
      params.start_time = timeRange[0]?.toDate?.()?.toISOString?.() || undefined;
      params.end_time = timeRange[1]?.toDate?.()?.toISOString?.() || undefined;
    }

    try {
      setErrorLoading(true);
      const res = await assetLocationAPI.getAssetMonitoringErrorReportsByAsset(
        assetCode.trim(),
        params,
      );
      if (res?.success) {
        const pagination = res.data?.pagination || {};
        setErrorReports(Array.isArray(res.data?.list) ? res.data.list : []);
        setErrorPagination({
          current: pagination.page || page,
          pageSize: pagination.page_size || pageSize,
          total: pagination.total || 0,
        });
      }
    } catch (e) {
      message.error(e?.response?.data?.message || '故障记录查询失败');
    } finally {
      setErrorLoading(false);
    }
  };

  const resetErrorFilters = () => {
    setErrorDeviceId('');
    setErrorTimeRange([]);
    if (selectedAssetCode) {
      loadErrorReports(1, DEFAULT_ERROR_PAGINATION.pageSize, {
        errorDeviceId: '',
        errorTimeRange: [],
      });
      return;
    }
    setErrorReports([]);
    setErrorPagination(DEFAULT_ERROR_PAGINATION);
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
          runtime_state: idx % 5 === 0 ? 'warning' : 'running',
          battery_level: Math.max(50, 94 - idx),
          signal_strength: -45 - idx,
          cpu_usage: 25 + (idx % 4) * 6.5,
          memory_usage: 40 + (idx % 3) * 8.2,
          error_code: idx % 7 === 0 ? 'E-IO-LOW-SIGNAL' : null,
        },
      }));
      const res = await assetLocationAPI.ingestAssetMonitoringSample(events);
      if (res?.success) {
        message.success('样例监测数据已写入');
        await Promise.all([loadLatest(), loadSeries()]);
      }
    } catch (e) {
      message.error(e?.response?.data?.message || '写入样例数据失败');
    } finally {
      setLoading(false);
    }
  };

  const chartPoints = useMemo(
    () =>
      (series || [])
        .filter(row => row?.[metric] !== null && row?.[metric] !== undefined)
        .map(row => ({ time: row.event_time, value: Number(row[metric]) })),
    [series, metric],
  );

  const latestData = latest
    ? Object.entries(latest).map(([key, value], idx) => ({ id: idx + 1, key, value: value ?? '-' }))
    : [];

  const assetCodePlaceholder = selectedAssetCode || '{asset_code}';
  const encodedAssetCode = encodeURIComponent(assetCodePlaceholder);
  const seriesApiPath = `/api/iot/asset-monitoring/assets/${encodedAssetCode}/series?limit=120`;
  const errorApiPath = `/api/iot/asset-monitoring/assets/${encodedAssetCode}/error-reports?page=1&pageSize=10`;
  const seriesApiUrl = `${window.location.origin}${seriesApiPath}`;
  const errorApiUrl = `${window.location.origin}${errorApiPath}`;

  const errorSummary = useMemo(() => {
    if (!errorReports.length) {
      return {
        latestTime: '-',
        criticalCount: 0,
        highCount: 0,
      };
    }

    return {
      latestTime: formatDateTime(errorReports[0]?.event_time),
      criticalCount: errorReports.filter(item => String(item?.severity || '').toLowerCase() === 'critical')
        .length,
      highCount: errorReports.filter(item => String(item?.severity || '').toLowerCase() === 'high').length,
    };
  }, [errorReports]);

  const errorColumns = [
    {
      title: '时间',
      dataIndex: 'event_time',
      key: 'event_time',
      width: 170,
      render: value => formatDateTime(value),
    },
    {
      title: '设备ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 140,
      render: value => <Text code>{value || '-'}</Text>,
    },
    {
      title: '故障码',
      dataIndex: 'error_code',
      key: 'error_code',
      width: 160,
      render: value => (value ? <Tag color="red">{value}</Tag> : <Tag>未提供</Tag>),
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: value => {
        const severity = normalizeSeverity(value);
        return <Tag color={severity.color}>{severity.label}</Tag>;
      },
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      ellipsis: true,
      render: value => value || '-',
    },
    {
      title: '错误分析',
      dataIndex: 'error_analysis',
      key: 'error_analysis',
      ellipsis: true,
      render: value => value || '-',
    },
    {
      title: '截图',
      dataIndex: 'uploaded_images',
      key: 'uploaded_images',
      width: 220,
      render: (_, record) => {
        const imageList = Array.isArray(record?.uploaded_images)
          ? record.uploaded_images
          : (record?.screenshot_urls || []).map(url => ({ file_url: url }));

        if (!imageList.length) {
          return <Text type="secondary">无</Text>;
        }

        return (
          <Space wrap size={8}>
            {imageList.slice(0, 3).map((item, index) => {
              const fileUrl = buildAbsoluteFileUrl(item?.file_url);
              return (
                <Image
                  key={`${record.id || record.event_time || 'fault'}-${index}`}
                  width={44}
                  height={44}
                  style={{ borderRadius: 8, objectFit: 'cover' }}
                  src={fileUrl}
                  alt={item?.original_name || `fault-${index + 1}`}
                  fallback="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
                />
              );
            })}
            {imageList.length > 3 ? <Tag>+{imageList.length - 3}</Tag> : null}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card>
          <Title level={4} style={{ marginTop: 0 }}>资产监测硬件接入控制台</Title>
          <Space wrap>
            <Tag color="blue">HTTP: /api/iot/asset-monitoring/ingest</Tag>
            <Tag color="purple">MQTT: iot/asset-monitoring/+/up</Tag>
            <Tag color="orange">Kafka: iot.asset.monitoring.raw</Tag>
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
                style={{ minWidth: 360 }}
                loading={assetLoading}
                filterOption={false}
                onSearch={loadAssets}
                onOpenChange={open => {
                  if (open) loadAssets();
                }}
                onChange={handleAssetCodeChange}
              >
                {assetOptions.map(asset => (
                  <Option key={asset.asset_code} value={asset.asset_code}>
                    {asset.asset_code} - {asset.asset_name || '未命名资产'}
                  </Option>
                ))}
              </Select>
            </Space>
            <Paragraph style={{ marginBottom: 0 }}>
              <Text strong>时序接口：</Text> <Text code copyable>{seriesApiPath}</Text>
            </Paragraph>
            <Paragraph style={{ marginBottom: 0 }}>
              <Text strong>故障列表接口：</Text> <Text code copyable>{errorApiPath}</Text>
            </Paragraph>
            <Text code copyable>{seriesApiUrl}</Text>
            <Text code copyable>{errorApiUrl}</Text>
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
                <Input
                  value={deviceId}
                  onChange={e => setDeviceId(e.target.value)}
                  placeholder="设备ID"
                  onPressEnter={loadLatest}
                />
                <Button type="primary" loading={loading} onClick={loadLatest}>查询</Button>
              </Space.Compact>
              <Button style={{ marginBottom: 12 }} onClick={injectSampleData} loading={loading}>
                一键生成样例数据
              </Button>
              <div className="hide-on-mobile">
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '字段', dataIndex: 'key' },
                    { title: '值', dataIndex: 'value' },
                  ]}
                  dataSource={latestData}
                />
              </div>
              <div className="mobile-table-cards show-on-mobile">
                {latestData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>暂无数据</div>
                ) : (
                  latestData.map(row => (
                    <div key={row.id} className="mobile-card-item">
                      <div className="mobile-card-body">
                        <div className="mobile-card-field mobile-card-field--full">
                          <span className="mobile-card-label">{row.key}</span>
                          <span className="mobile-card-value">
                            {typeof row.value === 'object' && row.value !== null
                              ? JSON.stringify(row.value)
                              : String(row.value ?? '-')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
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
                  style={{ flex: 1, minWidth: 280 }}
                  loading={assetLoading}
                  filterOption={false}
                  onSearch={loadAssets}
                  onOpenChange={open => {
                    if (open) loadAssets();
                  }}
                  onChange={handleAssetCodeChange}
                >
                  {assetOptions.map(asset => (
                    <Option key={asset.asset_code} value={asset.asset_code}>
                      {asset.asset_code} - {asset.asset_name || '未命名资产'}
                    </Option>
                  ))}
                </Select>
                <Button onClick={loadSeries} loading={loading}>加载</Button>
              </Space>
              <Space style={{ marginBottom: 12 }}>
                <Text>指标</Text>
                <Select
                  value={metric}
                  onChange={setMetric}
                  style={{ width: 180 }}
                  options={[
                    { value: 'battery_level', label: '电量' },
                    { value: 'signal_strength', label: '信号强度' },
                    { value: 'cpu_usage', label: 'CPU占用' },
                    { value: 'memory_usage', label: '内存占用' },
                  ]}
                />
              </Space>
              <TimeSeriesLineChart points={chartPoints} color="#fa8c16" />
            </Card>
          </Col>
        </Row>

        <Card title="故障监测查询与错误列表">
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Space wrap style={{ width: '100%' }} size={12}>
              <Select
                showSearch
                allowClear
                placeholder="选择资产编码（必选）"
                value={selectedAssetCode || undefined}
                style={{ minWidth: 320 }}
                loading={assetLoading}
                filterOption={false}
                onSearch={loadAssets}
                onOpenChange={open => {
                  if (open) loadAssets();
                }}
                onChange={handleAssetCodeChange}
              >
                {assetOptions.map(asset => (
                  <Option key={asset.asset_code} value={asset.asset_code}>
                    {asset.asset_code} - {asset.asset_name || '未命名资产'}
                  </Option>
                ))}
              </Select>
              <Input
                allowClear
                value={errorDeviceId}
                onChange={e => setErrorDeviceId(e.target.value)}
                placeholder="设备ID（可选）"
                style={{ width: 220 }}
                onPressEnter={() => loadErrorReports(1, errorPagination.pageSize)}
              />
              <RangePicker
                showTime
                allowClear
                value={errorTimeRange}
                onChange={value => setErrorTimeRange(value || [])}
              />
              <Button
                type="primary"
                loading={errorLoading}
                onClick={() => loadErrorReports(1, errorPagination.pageSize)}
              >
                查询故障
              </Button>
              <Button onClick={resetErrorFilters}>清空条件</Button>
            </Space>

            <Space wrap>
              <Tag color="red">故障总数：{errorPagination.total || 0}</Tag>
              <Tag color="orange">高优先级：{errorSummary.highCount}</Tag>
              <Tag color="magenta">严重：{errorSummary.criticalCount}</Tag>
              <Tag color="blue">最近故障：{errorSummary.latestTime}</Tag>
              <Tag color="cyan">默认展示所选资产最新故障</Tag>
            </Space>

            <div className="hide-on-mobile">
              <Table
                rowKey="id"
                size="middle"
                loading={errorLoading}
                scroll={{ x: 1100 }}
                columns={errorColumns}
                dataSource={errorReports}
                pagination={{
                  current: errorPagination.current,
                  pageSize: errorPagination.pageSize,
                  total: errorPagination.total,
                  showSizeChanger: true,
                  showTotal: total => `共 ${total} 条故障记录`,
                }}
                onChange={pagination => {
                  loadErrorReports(pagination.current, pagination.pageSize);
                }}
                locale={{ emptyText: selectedAssetCode ? '当前条件下暂无故障记录' : '请选择资产编码后查询故障记录' }}
              />
            </div>

            <div className="mobile-table-cards show-on-mobile">
              {errorReports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                  {selectedAssetCode ? '当前条件下暂无故障记录' : '请选择资产编码后查询故障记录'}
                </div>
              ) : (
                errorReports.map((record, idx) => {
                  const severity = normalizeSeverity(record.severity);
                  const imageList = Array.isArray(record?.uploaded_images)
                    ? record.uploaded_images
                    : (record?.screenshot_urls || []).map(url => ({ file_url: url }));
                  return (
                    <div key={record.id || `${record.asset_code}-${record.device_id}-${record.event_time}-${idx}`} className="mobile-card-item">
                      <div className="mobile-card-header">
                        <span className="mobile-card-title">
                          {record.error_code ? <Tag color="red">{record.error_code}</Tag> : <Tag>未提供故障码</Tag>}
                        </span>
                        <span className="mobile-card-badge">
                          <Tag color={severity.color}>{severity.label}</Tag>
                        </span>
                      </div>
                      <div className="mobile-card-body">
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">时间</span>
                          <span className="mobile-card-value">{formatDateTime(record.event_time)}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">设备ID</span>
                          <span className="mobile-card-value">{record.device_id || '-'}</span>
                        </div>
                        {record.error_message && (
                          <div className="mobile-card-field mobile-card-field--full">
                            <span className="mobile-card-label">错误信息</span>
                            <span className="mobile-card-value">{record.error_message}</span>
                          </div>
                        )}
                        {record.error_analysis && (
                          <div className="mobile-card-field mobile-card-field--full">
                            <span className="mobile-card-label">错误分析</span>
                            <span className="mobile-card-value">{record.error_analysis}</span>
                          </div>
                        )}
                        {imageList.length > 0 && (
                          <div className="mobile-card-field mobile-card-field--full">
                            <span className="mobile-card-label">截图</span>
                            <span className="mobile-card-value">
                              <Space wrap size={8}>
                                {imageList.slice(0, 3).map((item, index) => {
                                  const fileUrl = buildAbsoluteFileUrl(item?.file_url);
                                  return (
                                    <Image
                                      key={`m-${record.id || idx}-${index}`}
                                      width={44}
                                      height={44}
                                      style={{ borderRadius: 8, objectFit: 'cover' }}
                                      src={fileUrl}
                                      alt={item?.original_name || `fault-${index + 1}`}
                                      fallback="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
                                    />
                                  );
                                })}
                                {imageList.length > 3 ? <Tag>+{imageList.length - 3}</Tag> : null}
                              </Space>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default AssetMonitoring;
