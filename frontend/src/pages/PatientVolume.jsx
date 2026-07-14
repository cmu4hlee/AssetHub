import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Button,
  Card,
  Col,
  Collapse,
  DatePicker,
  Empty,
  Input,
  Modal,
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
const DEFAULT_PAGINATION = {
  current: 1,
  pageSize: 10,
  total: 0,
};
const DEFAULT_PATIENT_PAGINATION = {
  current: 1,
  pageSize: 10,
  total: 0,
};
const DEFAULT_RECENT_PAGINATION = {
  current: 1,
  pageSize: 10,
  total: 0,
};

const createEmptyPatientSummary = assetCode => ({
  asset_code: assetCode || '',
  asset_name: '',
  total_records: 0,
  unique_patient_count: 0,
  first_event_time: null,
  last_event_time: null,
});

const createEmptyRecentSummary = () => ({
  total_records: 0,
  asset_count: 0,
  patient_count: 0,
  earliest_event_time: null,
  latest_event_time: null,
});

const formatDateTime = value => {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : String(value);
};

const PatientVolume = () => {
  const isMobile = useIsMobile();
  const [selectedAssetCode, setSelectedAssetCode] = useState('');
  const [patientModalVisible, setPatientModalVisible] = useState(false);
  const [searchAssetCode, setSearchAssetCode] = useState('');
  const [recordKeyword, setRecordKeyword] = useState('');
  const [assetOptions, setAssetOptions] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [pipelineHealth, setPipelineHealth] = useState(null);
  const [pipelineDocs, setPipelineDocs] = useState(null);
  const [timeRange, setTimeRange] = useState([]);
  const [granularity, setGranularity] = useState('day');
  const [statsLoading, setStatsLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [usageStats, setUsageStats] = useState([]);
  const [usageSummary, setUsageSummary] = useState({
    total_records: 0,
    total_patients: 0,
    asset_count: 0,
  });
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [recentRecords, setRecentRecords] = useState([]);
  const [recentSummary, setRecentSummary] = useState(() => createEmptyRecentSummary());
  const [recentPagination, setRecentPagination] = useState(DEFAULT_RECENT_PAGINATION);
  const [series, setSeries] = useState([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientKeyword, setPatientKeyword] = useState('');
  const [patientList, setPatientList] = useState([]);
  const [patientSummary, setPatientSummary] = useState(() => createEmptyPatientSummary());
  const [patientPagination, setPatientPagination] = useState(DEFAULT_PATIENT_PAGINATION);

  useEffect(() => {
    loadAssets();
    loadPipelineMeta();
    loadUsageStats(1, DEFAULT_PAGINATION.pageSize);
    loadRecentRecords(1, DEFAULT_RECENT_PAGINATION.pageSize);
  }, []);

  useEffect(() => {
    if (!selectedAssetCode) {
      setPatientList([]);
      setPatientSummary(createEmptyPatientSummary());
      setPatientPagination({ ...DEFAULT_PATIENT_PAGINATION });
      return;
    }

    if (!patientModalVisible) {
      setPatientList([]);
      setPatientSummary(createEmptyPatientSummary(selectedAssetCode));
      setPatientPagination(prev => ({
        current: 1,
        pageSize: prev.pageSize || DEFAULT_PATIENT_PAGINATION.pageSize,
        total: 0,
      }));
      return;
    }

    loadPatientList(selectedAssetCode, 1, patientPagination.pageSize);
  }, [patientModalVisible, selectedAssetCode]);

  useEffect(() => {
    if (!selectedAssetCode) {
      setSeries([]);
      return;
    }

    loadSeries(selectedAssetCode);
  }, [selectedAssetCode, granularity]);

  const loadAssets = async keyword => {
    try {
      setAssetLoading(true);
      const res = await assetAPI.getAssets({
        page: 1,
        pageSize: 30,
        keyword: keyword || undefined,
      });

      if (res?.success) {
        const assetList = res.data?.list || res.data || [];
        const normalizedList = Array.isArray(assetList) ? assetList : [];
        setAssetOptions(normalizedList);

        if (!selectedAssetCode && normalizedList.length > 0 && normalizedList[0]?.asset_code) {
          setSelectedAssetCode(normalizedList[0].asset_code);
        }
      }
    } catch (error) {
      message.error(error?.response?.data?.message || '资产列表加载失败');
    } finally {
      setAssetLoading(false);
    }
  };

  const loadPipelineMeta = async () => {
    try {
      const [healthRes, docsRes] = await Promise.all([
        assetLocationAPI.getPatientVolumePipelineHealth(),
        assetLocationAPI.getPatientVolumePipelineDocs(),
      ]);
      if (healthRes?.success) setPipelineHealth(healthRes.data);
      if (docsRes?.success) setPipelineDocs(docsRes.data);
    } catch (error) {
      message.warning(error?.response?.data?.message || '管道状态读取失败');
    }
  };

  const buildSharedQueryParams = (overrides = {}) => {
    const effectiveTimeRange = overrides.timeRange !== undefined ? overrides.timeRange : timeRange;
    const params = {};

    if (Array.isArray(effectiveTimeRange) && effectiveTimeRange.length === 2) {
      params.start_time = effectiveTimeRange[0]?.toISOString?.();
      params.end_time = effectiveTimeRange[1]?.toISOString?.();
    }

    return params;
  };

  const loadUsageStats = async (page = 1, pageSize = pagination.pageSize, overrides = {}) => {
    try {
      setStatsLoading(true);
      const effectiveSearchAssetCode =
        overrides.searchAssetCode !== undefined ? overrides.searchAssetCode : searchAssetCode;
      const params = {
        page,
        pageSize,
        ...buildSharedQueryParams(overrides),
      };

      if (effectiveSearchAssetCode.trim()) {
        params.keyword = effectiveSearchAssetCode.trim();
      }

      const res = await assetLocationAPI.getPatientVolumeUsageStats(params);
      if (res?.success) {
        const data = res.data || {};
        const nextPagination = data.pagination || {};
        setUsageStats(Array.isArray(data.list) ? data.list : []);
        setUsageSummary(data.summary || { total_records: 0, total_patients: 0, asset_count: 0 });
        setPagination({
          current: nextPagination.page || page,
          pageSize: nextPagination.page_size || pageSize,
          total: nextPagination.total || 0,
        });
      }
    } catch (error) {
      message.error(error?.response?.data?.message || '资产使用量统计查询失败');
    } finally {
      setStatsLoading(false);
    }
  };

  const loadRecentRecords = async (
    page = 1,
    pageSize = recentPagination.pageSize,
    overrides = {},
  ) => {
    try {
      setRecentLoading(true);
      const effectiveRecordKeyword =
        overrides.recordKeyword !== undefined ? overrides.recordKeyword : recordKeyword;
      const params = {
        page,
        pageSize,
        ...buildSharedQueryParams(overrides),
      };

      if (effectiveRecordKeyword.trim()) {
        params.keyword = effectiveRecordKeyword.trim();
      }

      const res = await assetLocationAPI.getPatientVolumeRecentRecords(params);
      if (res?.success) {
        const data = res.data || {};
        const nextPagination = data.pagination || {};
        setRecentRecords(Array.isArray(data.list) ? data.list : []);
        setRecentSummary(data.summary || createEmptyRecentSummary());
        setRecentPagination({
          current: nextPagination.page || page,
          pageSize: nextPagination.page_size || pageSize,
          total: nextPagination.total || 0,
        });
      }
    } catch (error) {
      message.error(error?.response?.data?.message || '查询最新患者使用记录失败');
    } finally {
      setRecentLoading(false);
    }
  };

  const loadSeries = async (assetCode, overrides = {}) => {
    if (!assetCode) return;
    try {
      setDetailLoading(true);
      const res = await assetLocationAPI.getPatientVolumeSeriesByAsset(assetCode, {
        granularity,
        limit: 30,
        ...buildSharedQueryParams(overrides),
      });
      if (res?.success) {
        setSeries(Array.isArray(res.data) ? res.data.slice().reverse() : []);
      }
    } catch (error) {
      message.error(error?.response?.data?.message || '查询患者量趋势失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const loadPatientList = async (
    assetCode,
    page = 1,
    pageSize = patientPagination.pageSize,
    overrides = {},
  ) => {
    if (!assetCode) return;
    try {
      setPatientLoading(true);
      const effectivePatientKeyword =
        overrides.patientKeyword !== undefined ? overrides.patientKeyword : patientKeyword;
      const params = {
        page,
        pageSize,
        ...buildSharedQueryParams(overrides),
      };

      if (effectivePatientKeyword.trim()) {
        params.patient_id = effectivePatientKeyword.trim();
      }

      const res = await assetLocationAPI.getPatientVolumePatientsByAsset(assetCode, params);
      if (res?.success) {
        const data = res.data || {};
        const nextPagination = data.pagination || {};
        setPatientList(Array.isArray(data.list) ? data.list : []);
        setPatientSummary(data.summary || createEmptyPatientSummary(assetCode));
        setPatientPagination({
          current: nextPagination.page || page,
          pageSize: nextPagination.page_size || pageSize,
          total: nextPagination.total || 0,
        });
      }
    } catch (error) {
      message.error(error?.response?.data?.message || '查询患者列表失败');
    } finally {
      setPatientLoading(false);
    }
  };

  const handleSelectAsset = (assetCode, options = {}) => {
    const nextAssetCode = String(assetCode || '').trim();
    const shouldResetPatientKeyword = options.resetPatientKeyword !== false;
    const nextPatientPageSize = patientPagination.pageSize || DEFAULT_PATIENT_PAGINATION.pageSize;

    if (shouldResetPatientKeyword) {
      setPatientKeyword('');
    }

    if (!nextAssetCode) {
      setSelectedAssetCode('');
      setSeries([]);
      setPatientList([]);
      setPatientSummary(createEmptyPatientSummary());
      setPatientPagination({ ...DEFAULT_PATIENT_PAGINATION });
      return;
    }

    const isSameAsset = nextAssetCode === selectedAssetCode;
    setSelectedAssetCode(nextAssetCode);
    setPatientList([]);
    setPatientSummary(createEmptyPatientSummary(nextAssetCode));
    setPatientPagination(prev => ({
      current: 1,
      pageSize: prev.pageSize || DEFAULT_PATIENT_PAGINATION.pageSize,
      total: 0,
    }));

    if (isSameAsset) {
      loadSeries(nextAssetCode);
      loadPatientList(nextAssetCode, 1, nextPatientPageSize, {
        patientKeyword: shouldResetPatientKeyword ? '' : undefined,
      });
    }
  };

  const openPatientModal = (assetCode, options = {}) => {
    const nextAssetCode = String(assetCode || '').trim();
    if (!nextAssetCode) {
      setPatientModalVisible(false);
      return;
    }

    handleSelectAsset(nextAssetCode, options);
    setPatientModalVisible(true);
  };

  const applyFilters = async () => {
    await Promise.all([
      loadUsageStats(1, pagination.pageSize),
      loadRecentRecords(1, recentPagination.pageSize),
    ]);

    if (selectedAssetCode) {
      loadSeries(selectedAssetCode);
      if (patientModalVisible) {
        loadPatientList(selectedAssetCode, 1, patientPagination.pageSize);
      }
    }
  };

  const injectSampleData = async () => {
    if (!selectedAssetCode.trim()) {
      return message.warning('请先选择资产编码');
    }

    try {
      setDetailLoading(true);
      const now = Date.now();
      const events = Array.from({ length: 24 }).map((_, idx) => ({
        patient_id: `PAT-${String(1000 + idx).padStart(4, '0')}`,
        asset_code: selectedAssetCode.trim(),
        ts: now - (23 - idx) * 60 * 60 * 1000,
      }));

      const res = await assetLocationAPI.ingestPatientVolumeSample(events);
      if (res?.success) {
        message.success('样例患者量数据已写入');
        await Promise.all([
          loadUsageStats(1, pagination.pageSize),
          loadRecentRecords(1, recentPagination.pageSize),
          loadSeries(selectedAssetCode.trim()),
          loadPatientList(selectedAssetCode.trim(), 1, patientPagination.pageSize),
        ]);
      }
    } catch (error) {
      message.error(error?.response?.data?.message || '写入样例患者量数据失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const resetFilters = () => {
    setSearchAssetCode('');
    setTimeRange([]);
    loadUsageStats(1, DEFAULT_PAGINATION.pageSize, {
      searchAssetCode: '',
      timeRange: [],
    });
    loadRecentRecords(1, recentPagination.pageSize, {
      timeRange: [],
    });

    if (selectedAssetCode) {
      loadSeries(selectedAssetCode, { timeRange: [] });
      if (patientModalVisible) {
        loadPatientList(selectedAssetCode, 1, patientPagination.pageSize, {
          timeRange: [],
        });
      }
    }
  };

  const chartPoints = useMemo(
    () =>
      (series || []).map(item => ({
        time: item.bucket_time,
        value: Number(item.usage_count || 0),
      })),
    [series],
  );

  const usageApiPath = `/api/iot/patient-volume/assets/usage-stats?page=1&pageSize=${pagination.pageSize}`;
  const recentRecordsApiPath = `/api/iot/patient-volume/records/recent?page=1&pageSize=${recentPagination.pageSize}`;
  const detailAssetCodePlaceholder = selectedAssetCode || '{asset_code}';
  const encodedAssetCode = encodeURIComponent(detailAssetCodePlaceholder);
  const seriesApiPath = `/api/iot/patient-volume/assets/${encodedAssetCode}/series?granularity=${granularity}&limit=30`;
  const patientsApiPath = `/api/iot/patient-volume/assets/${encodedAssetCode}/patients?page=1&pageSize=${patientPagination.pageSize}`;

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      render: value => <Text code>{value}</Text>,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      ellipsis: true,
    },
    {
      title: '使用量',
      dataIndex: 'usage_count',
      key: 'usage_count',
      width: 120,
      render: value => <Tag color="blue">{value || 0}</Tag>,
    },
    {
      title: '患者数',
      dataIndex: 'unique_patient_count',
      key: 'unique_patient_count',
      width: 120,
      render: value => <Tag color="purple">{value || 0}</Tag>,
    },
    {
      title: '首次使用',
      dataIndex: 'first_use_time',
      key: 'first_use_time',
      width: 180,
      render: value => formatDateTime(value),
    },
    {
      title: '最近使用',
      dataIndex: 'last_use_time',
      key: 'last_use_time',
      width: 180,
      render: value => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          size="small"
          onClick={() => {
            openPatientModal(record.asset_code);
          }}
        >
          查看详情
        </Button>
      ),
    },
  ];

  const recentColumns = [
    {
      title: '使用时间',
      dataIndex: 'event_time',
      key: 'event_time',
      width: 180,
      render: value => formatDateTime(value),
    },
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 220,
      render: value => <Text code>{value || '-'}</Text>,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '患者ID',
      dataIndex: 'patient_id',
      key: 'patient_id',
      width: 220,
      render: value => <Text code>{value || '-'}</Text>,
    },
    {
      title: '写入来源',
      dataIndex: 'ingest_source',
      key: 'ingest_source',
      width: 140,
      render: value => <Tag color="blue">{value || '-'}</Tag>,
    },
    {
      title: '写入时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: value => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          size="small"
          onClick={() => {
            openPatientModal(record.asset_code);
          }}
        >
          查看详情
        </Button>
      ),
    },
  ];

  const patientColumns = [
    {
      title: '使用时间',
      dataIndex: 'event_time',
      key: 'event_time',
      width: 180,
      render: value => formatDateTime(value),
    },
    {
      title: '患者ID',
      dataIndex: 'patient_id',
      key: 'patient_id',
      width: 220,
      render: value => <Text code>{value || '-'}</Text>,
    },
    {
      title: '写入来源',
      dataIndex: 'ingest_source',
      key: 'ingest_source',
      width: 140,
      render: value => <Tag color="blue">{value || '-'}</Tag>,
    },
    {
      title: '写入时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: value => formatDateTime(value),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card>
          <Title level={4} style={{ marginTop: 0 }}>患者量统计控制台</Title>
          <Space wrap>
            <Tag color="blue">HTTP: /api/iot/patient-volume/ingest</Tag>
            <Tag color={pipelineHealth?.initialized ? 'green' : 'red'}>
              管道: {pipelineHealth?.initialized ? '已初始化' : '未初始化'}
            </Tag>
            <Tag color="geekblue">统计资产数：{usageSummary.asset_count || 0}</Tag>
            <Tag color="magenta">患者数：{usageSummary.total_patients || 0}</Tag>
            <Tag color="orange">记录数：{usageSummary.total_records || 0}</Tag>
          </Space>
        </Card>

        <Collapse
          items={[
            {
              key: 'api-docs',
              label: '接口链接与调用说明',
              children: (
                <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                  <Paragraph style={{ marginBottom: 0 }}>
                    <Text strong>统计接口：</Text> <Text code copyable>{usageApiPath}</Text>
                  </Paragraph>
                  <Paragraph style={{ marginBottom: 0 }}>
                    <Text strong>最新记录列表接口：</Text> <Text code copyable>{recentRecordsApiPath}</Text>
                  </Paragraph>
                  <Paragraph style={{ marginBottom: 0 }}>
                    <Text strong>趋势接口：</Text> <Text code copyable>{seriesApiPath}</Text>
                  </Paragraph>
                  <Paragraph style={{ marginBottom: 0 }}>
                    <Text strong>患者列表接口：</Text> <Text code copyable>{patientsApiPath}</Text>
                  </Paragraph>
                  <Text type="secondary">
                    {pipelineDocs?.auth?.mode === 'jwt'
                      ? `上报鉴权：请先调用 ${pipelineDocs.auth.login_path || '/api/users/login'} 获取 Bearer JWT`
                      : pipelineDocs?.auth?.token_header
                        ? `上报鉴权支持 ${pipelineDocs.auth.token_header} 或 Bearer token`
                        : '上报鉴权：按服务端环境变量配置'}
                  </Text>
                </Space>
              ),
            },
          ]}
        />

        <Card title="资产使用量列表">
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Space wrap style={{ width: '100%' }}>
              <Input.Search
                allowClear
                placeholder="输入资产编号查询"
                value={searchAssetCode}
                onChange={e => setSearchAssetCode(e.target.value)}
                onSearch={applyFilters}
                style={{ width: isMobile ? '100%' : 260 }}
              />
              <RangePicker
                showTime
                allowClear
                value={timeRange}
                onChange={value => setTimeRange(value || [])}
                style={{ width: isMobile ? '100%' : undefined }}
              />
              <Button type="primary" loading={statsLoading} onClick={applyFilters} block={isMobile}>
                查询
              </Button>
              <Button onClick={resetFilters} block={isMobile}>
                清空条件
              </Button>
            </Space>

            <div className="hide-on-mobile">
              <Table
                rowKey="asset_code"
                loading={statsLoading}
                columns={columns}
                dataSource={usageStats}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  showSizeChanger: true,
                  showTotal: total => `共 ${total} 项资产`,
                }}
                onChange={nextPagination => {
                  loadUsageStats(nextPagination.current, nextPagination.pageSize);
                }}
                locale={{ emptyText: '当前条件下暂无患者量统计数据' }}
              />
            </div>

            <div className="mobile-table-cards show-on-mobile">
              {statsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
                  加载中...
                </div>
              ) : Array.isArray(usageStats) && usageStats.length > 0 ? (
                <>
                  {usageStats.map(record => (
                    <div key={record.asset_code} className="mobile-card-item">
                      <div className="mobile-card-header">
                        <span className="mobile-card-title">
                          {record.asset_name || record.asset_code || '-'}
                        </span>
                        <Tag color="blue">使用量 {record.usage_count || 0}</Tag>
                      </div>
                      <div className="mobile-card-body">
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">资产编号</span>
                          <span className="mobile-card-value">{record.asset_code || '-'}</span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">患者数</span>
                          <span className="mobile-card-value">
                            <Tag color="purple">{record.unique_patient_count || 0}</Tag>
                          </span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">首次使用</span>
                          <span className="mobile-card-value">
                            {formatDateTime(record.first_use_time)}
                          </span>
                        </div>
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">最近使用</span>
                          <span className="mobile-card-value">
                            {formatDateTime(record.last_use_time)}
                          </span>
                        </div>
                      </div>
                      <div className="mobile-card-actions">
                        <Button
                          type="primary"
                          size="small"
                          block
                          onClick={() => openPatientModal(record.asset_code)}
                        >
                          查看详情
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <Space>
                      <Button
                        disabled={pagination.current === 1}
                        onClick={() =>
                          loadUsageStats(pagination.current - 1, pagination.pageSize)
                        }
                      >
                        上一页
                      </Button>
                      <span>
                        第 {pagination.current} /{' '}
                        {Math.max(1, Math.ceil(pagination.total / pagination.pageSize))} 页
                      </span>
                      <Button
                        disabled={
                          pagination.current >= Math.ceil(pagination.total / pagination.pageSize)
                        }
                        onClick={() =>
                          loadUsageStats(pagination.current + 1, pagination.pageSize)
                        }
                      >
                        下一页
                      </Button>
                    </Space>
                    <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                      共 {pagination.total} 项资产
                    </div>
                  </div>
                </>
              ) : (
                <Empty description="暂无数据" />
              )}
            </div>
          </Space>
        </Card>

        <div style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col xs={24} lg={14}>
              <Card title="最新患者使用记录">
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <Space wrap style={{ width: '100%' }}>
                    <Input.Search
                      allowClear
                      placeholder="输入资产编号、资产名称或患者ID查询"
                      value={recordKeyword}
                      onChange={e => setRecordKeyword(e.target.value)}
                      onSearch={() => loadRecentRecords(1, recentPagination.pageSize)}
                      style={{ width: isMobile ? '100%' : 320 }}
                    />
                    <Button
                      loading={recentLoading}
                      onClick={() => loadRecentRecords(1, recentPagination.pageSize)}
                      block={isMobile}
                    >
                      刷新记录
                    </Button>
                    <Button
                      onClick={() => {
                        setRecordKeyword('');
                        loadRecentRecords(1, recentPagination.pageSize, { recordKeyword: '' });
                      }}
                      block={isMobile}
                    >
                      清空记录条件
                    </Button>
                  </Space>

                  <Space wrap>
                    <Tag color="orange">记录数：{recentSummary.total_records || 0}</Tag>
                    <Tag color="geekblue">设备数：{recentSummary.asset_count || 0}</Tag>
                    <Tag color="magenta">患者数：{recentSummary.patient_count || 0}</Tag>
                    <Tag color="blue">最近使用：{formatDateTime(recentSummary.latest_event_time)}</Tag>
                    <Tag color="cyan">最早使用：{formatDateTime(recentSummary.earliest_event_time)}</Tag>
                  </Space>

                  <div className="hide-on-mobile">
                    <Table
                      rowKey="id"
                      size="middle"
                      loading={recentLoading}
                      columns={recentColumns}
                      dataSource={recentRecords}
                      scroll={{ x: 1240 }}
                      pagination={{
                        current: recentPagination.current,
                        pageSize: recentPagination.pageSize,
                        total: recentPagination.total,
                        showSizeChanger: true,
                        showTotal: total => `共 ${total} 条患者使用记录`,
                      }}
                      onChange={nextPagination => {
                        loadRecentRecords(nextPagination.current, nextPagination.pageSize);
                      }}
                      locale={{ emptyText: '当前租户暂无患者使用记录' }}
                    />
                  </div>

                  <div className="mobile-table-cards show-on-mobile">
                    {recentLoading ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
                        加载中...
                      </div>
                    ) : Array.isArray(recentRecords) && recentRecords.length > 0 ? (
                      <>
                        {recentRecords.map(record => (
                          <div
                            key={record.id || `${record.asset_code}-${record.patient_id}-${record.event_time}`}
                            className="mobile-card-item"
                          >
                            <div className="mobile-card-header">
                              <span className="mobile-card-title">
                                {formatDateTime(record.event_time)}
                              </span>
                              <Tag color="blue">{record.ingest_source || '-'}</Tag>
                            </div>
                            <div className="mobile-card-body">
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">资产编号</span>
                                <span className="mobile-card-value">
                                  {record.asset_code || '-'}
                                </span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">资产名称</span>
                                <span className="mobile-card-value">
                                  {record.asset_name || '-'}
                                </span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">患者ID</span>
                                <span className="mobile-card-value">
                                  {record.patient_id || '-'}
                                </span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">写入时间</span>
                                <span className="mobile-card-value">
                                  {formatDateTime(record.created_at)}
                                </span>
                              </div>
                            </div>
                            <div className="mobile-card-actions">
                              <Button
                                type="primary"
                                size="small"
                                block
                                onClick={() => openPatientModal(record.asset_code)}
                              >
                                查看详情
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div style={{ marginTop: '16px', textAlign: 'center' }}>
                          <Space>
                            <Button
                              disabled={recentPagination.current === 1}
                              onClick={() =>
                                loadRecentRecords(
                                  recentPagination.current - 1,
                                  recentPagination.pageSize,
                                )
                              }
                            >
                              上一页
                            </Button>
                            <span>
                              第 {recentPagination.current} /{' '}
                              {Math.max(
                                1,
                                Math.ceil(recentPagination.total / recentPagination.pageSize),
                              )}{' '}
                              页
                            </span>
                            <Button
                              disabled={
                                recentPagination.current >=
                                Math.ceil(recentPagination.total / recentPagination.pageSize)
                              }
                              onClick={() =>
                                loadRecentRecords(
                                  recentPagination.current + 1,
                                  recentPagination.pageSize,
                                )
                              }
                            >
                              下一页
                            </Button>
                          </Space>
                          <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                            共 {recentPagination.total} 条患者使用记录
                          </div>
                        </div>
                      </>
                    ) : (
                      <Empty description="暂无数据" />
                    )}
                  </div>
                </Space>
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card
                title="资产使用趋势"
                extra={selectedAssetCode ? <Text code>{selectedAssetCode}</Text> : null}
              >
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                  <Select
                    showSearch
                    allowClear
                    placeholder="选择查看详情的资产编码"
                    value={selectedAssetCode || undefined}
                    style={{ width: '100%' }}
                    loading={assetLoading}
                    filterOption={false}
                    onSearch={loadAssets}
                    onOpenChange={open => {
                      if (open) loadAssets();
                    }}
                    onChange={value => handleSelectAsset(value || '')}
                  >
                    {assetOptions.map(asset => (
                      <Option key={asset.asset_code} value={asset.asset_code}>
                        {asset.asset_code} - {asset.asset_name || '未命名资产'}
                      </Option>
                    ))}
                  </Select>
                  <Space wrap>
                    <Text>粒度</Text>
                    <Select value={granularity} onChange={setGranularity} style={{ width: 140 }}>
                      <Option value="day">按天</Option>
                      <Option value="hour">按小时</Option>
                    </Select>
                    <Button
                      disabled={!selectedAssetCode}
                      onClick={() => loadSeries(selectedAssetCode)}
                      loading={detailLoading}
                    >
                      刷新趋势
                    </Button>
                    <Button disabled={!selectedAssetCode} onClick={injectSampleData} loading={detailLoading}>
                      一键生成样例数据
                    </Button>
                  </Space>
                  <TimeSeriesLineChart points={chartPoints} color="#13c2c2" />
                </Space>
              </Card>
            </Col>
          </Row>
        </div>
      </Space>

      <Modal
        title={(
          <Space wrap size={8}>
            <span>患者列表</span>
            {selectedAssetCode ? <Text code>{selectedAssetCode}</Text> : null}
          </Space>
        )}
        open={patientModalVisible}
        onCancel={() => setPatientModalVisible(false)}
        footer={null}
        width={isMobile ? '95vw' : 1080}
        destroyOnHidden={false}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Space wrap>
            <Tag color="geekblue">记录数：{patientSummary.total_records || 0}</Tag>
            <Tag color="magenta">患者数：{patientSummary.unique_patient_count || 0}</Tag>
            <Tag color="cyan">首次使用：{formatDateTime(patientSummary.first_event_time)}</Tag>
            <Tag color="blue">最近使用：{formatDateTime(patientSummary.last_event_time)}</Tag>
            {patientSummary.asset_name ? <Tag>{patientSummary.asset_name}</Tag> : null}
          </Space>

          <Space wrap style={{ width: '100%' }}>
            <Input.Search
              allowClear
              disabled={!selectedAssetCode}
              placeholder="输入患者ID查询"
              value={patientKeyword}
              onChange={e => setPatientKeyword(e.target.value)}
              onSearch={() => loadPatientList(selectedAssetCode, 1, patientPagination.pageSize)}
              style={{ width: isMobile ? '100%' : 280 }}
            />
            <Button
              type="primary"
              disabled={!selectedAssetCode}
              loading={patientLoading}
              onClick={() => loadPatientList(selectedAssetCode, 1, patientPagination.pageSize)}
              block={isMobile}
            >
              查询患者
            </Button>
            <Button
              disabled={!selectedAssetCode}
              onClick={() => {
                setPatientKeyword('');
                loadPatientList(selectedAssetCode, 1, patientPagination.pageSize, {
                  patientKeyword: '',
                });
              }}
              block={isMobile}
            >
              清空患者条件
            </Button>
          </Space>

          <div className="hide-on-mobile">
            <Table
              rowKey="id"
              size="middle"
              loading={patientLoading}
              columns={patientColumns}
              dataSource={patientList}
              pagination={{
                current: patientPagination.current,
                pageSize: patientPagination.pageSize,
                total: patientPagination.total,
                showSizeChanger: true,
                showTotal: total => `共 ${total} 条患者使用记录`,
              }}
              onChange={nextPagination => {
                loadPatientList(selectedAssetCode, nextPagination.current, nextPagination.pageSize);
              }}
              locale={{ emptyText: selectedAssetCode ? '当前资产暂无患者记录' : '请选择资产编码' }}
            />
          </div>

          <div className="mobile-table-cards show-on-mobile">
            {patientLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
                加载中...
              </div>
            ) : Array.isArray(patientList) && patientList.length > 0 ? (
              <>
                {patientList.map(record => (
                  <div
                    key={record.id || `${record.patient_id}-${record.event_time}-${record.created_at}`}
                    className="mobile-card-item"
                  >
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{record.patient_id || '-'}</span>
                      <Tag color="blue">{record.ingest_source || '-'}</Tag>
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">使用时间</span>
                        <span className="mobile-card-value">
                          {formatDateTime(record.event_time)}
                        </span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">写入时间</span>
                        <span className="mobile-card-value">
                          {formatDateTime(record.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <Space>
                    <Button
                      disabled={patientPagination.current === 1}
                      onClick={() =>
                        loadPatientList(
                          selectedAssetCode,
                          patientPagination.current - 1,
                          patientPagination.pageSize,
                        )
                      }
                    >
                      上一页
                    </Button>
                    <span>
                      第 {patientPagination.current} /{' '}
                      {Math.max(
                        1,
                        Math.ceil(patientPagination.total / patientPagination.pageSize),
                      )}{' '}
                      页
                    </span>
                    <Button
                      disabled={
                        patientPagination.current >=
                        Math.ceil(patientPagination.total / patientPagination.pageSize)
                      }
                      onClick={() =>
                        loadPatientList(
                          selectedAssetCode,
                          patientPagination.current + 1,
                          patientPagination.pageSize,
                        )
                      }
                    >
                      下一页
                    </Button>
                  </Space>
                  <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                    共 {patientPagination.total} 条患者使用记录
                  </div>
                </div>
              </>
            ) : (
              <Empty description="暂无数据" />
            )}
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default PatientVolume;
