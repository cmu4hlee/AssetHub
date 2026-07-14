import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Space,
  Tag,
  Progress,
  Drawer,
  Modal,
  Form,
  Slider,
  InputNumber,
  Radio,
  Tooltip,
  Spin,
  message,
  Descriptions,
  Divider,
} from 'antd';

import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { maintenanceAPI } from '../utils/api';
import dayjs from 'dayjs';
import { useIsMobile } from '../hooks';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;

// 安全取值
const safeNum = (val, fallback = 0) => (val != null && !isNaN(Number(val)) ? Number(val) : fallback);

// 评分颜色
const getScoreColor = score => {
  const s = safeNum(score);
  if (s >= 80) return '#52c41a';
  if (s >= 60) return '#faad14';
  return '#ff4d4f';
};

// 维护类型标签
const getTypeTag = type => {
  const typeMap = {
    故障维修: { color: 'red', text: '故障维修' },
    预防性维护: { color: 'green', text: '预防性维护' },
    定期维护: { color: 'blue', text: '定期维护' },
    校准: { color: 'orange', text: '校准' },
    其他: { color: 'gray', text: '其他' },
  };
  const info = typeMap[type] || { color: 'default', text: type || '-' };
  return <Tag color={info.color}>{info.text}</Tag>;
};

// 问题解决标签
const getResolvedTag = resolved => {
  if (resolved === true || resolved === '是' || resolved === 1) {
    return <Tag color="green">是</Tag>;
  }
  return <Tag color="red">否</Tag>;
};

// 生产影响标签
const getImpactTag = impact => {
  const map = {
    无影响: { color: 'green', text: '无影响' },
    轻微影响: { color: 'blue', text: '轻微影响' },
    中度影响: { color: 'orange', text: '中度影响' },
    严重影响: { color: 'red', text: '严重影响' },
  };
  const info = map[impact] || { color: 'default', text: impact || '-' };
  return <Tag color={info.color}>{info.text}</Tag>;
};

// 评分进度条渲染
const renderScoreProgress = (score, width = 80) => {
  const s = safeNum(score, 0);
  const percent = Math.round(s * 10);
  return (
    <Progress
      percent={percent}
      size="small"
      style={{ width }}
      strokeColor={getScoreColor(s)}
      format={() => s.toFixed(1)}
    />
  );
};

const MaintenanceEvaluationList = () => {
  const isMobile = useIsMobile();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState({
    asset_code: '',
    maintenance_type: '',
    start_date: null,
    end_date: null,
  });

  // 统计数据
  const [stats, setStats] = useState({
    totalEvaluations: 0,
    avgOverallScore: 0,
    problemResolvedRate: 0,
    avgDowntime: 0,
  });

  // 抽屉 / 模态框
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();

  // 维护日志下拉选项
  const [logOptions, setLogOptions] = useState([]);
  const [logSearch, setLogSearch] = useState('');
  const [logLoading, setLogLoading] = useState(false);

  // 评分自动计算
  const scoreFields = [
    'effectiveness_score',
    'technician_skill_score',
    'response_time_score',
    'quality_score',
  ];

  const watchedScores = Form.useWatch(scoreFields, form);

  // 自动计算综合评分
  useEffect(() => {
    if (!watchedScores || !form) return;
    const validScores = scoreFields
      .map((_, i) => safeNum(watchedScores[i]))
      .filter(v => v > 0);
    if (validScores.length > 0) {
      const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
      form.setFieldValue('overall_score', Math.round(avg * 10) / 10);
    }
  }, [watchedScores, form]);

  // ======== 数据获取 ========

  const fetchEvaluations = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const response = await maintenanceAPI.getMaintenanceEvaluations({
        page: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        ...searchParams,
      });
      if (response?.success) {
        const list = response.data || [];
        setData(list);
        setPagination(prev => ({
          ...prev,
          current: params.page || prev.current,
          pageSize: params.pageSize || prev.pageSize,
          total: response.pagination?.total || 0,
        }));
        // 计算统计
        if (list.length > 0) {
          const totalEvaluations = response.pagination?.total || list.length;
          const avgOverallScore = list.reduce((s, r) => s + safeNum(r.overall_score), 0) / list.length;
          const resolvedCount = list.filter(
            r => r.problem_resolved === true || r.problem_resolved === '是' || r.problem_resolved === 1
          ).length;
          const problemResolvedRate = (resolvedCount / list.length) * 100;
          const avgDowntime = list.reduce((s, r) => s + safeNum(r.downtime_hours), 0) / list.length;
          setStats({ totalEvaluations, avgOverallScore, problemResolvedRate, avgDowntime });
        } else {
          setStats({ totalEvaluations: 0, avgOverallScore: 0, problemResolvedRate: 0, avgDowntime: 0 });
        }
      } else {
        message.error(response?.message || '获取评估列表失败');
      }
    } catch (error) {
      console.error('获取评估列表失败:', error);
      message.error('网络错误，获取评估列表失败');
    } finally {
      setLoading(false);
    }
  }, [searchParams, pagination.current, pagination.pageSize]);

  // 获取维护日志选项
  const fetchLogOptions = useCallback(async (keyword = '') => {
    setLogLoading(true);
    try {
      const response = await maintenanceAPI.getMaintenanceLogs({
        page: 1,
        pageSize: 20,
        keyword,
        status: '已完成',
      });
      if (response?.success) {
        const list = response.data || [];
        setLogOptions(list.map(item => ({
          value: item.id,
          label: `${item.asset_code || ''} - ${item.asset_name || ''} (${item.maintenance_type || ''} ${item.maintenance_date ? dayjs(item.maintenance_date).format('YYYY-MM-DD') : ''})`,
          record: item,
        })));
      }
    } catch (error) {
      console.error('获取维护日志失败:', error);
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvaluations();
  }, []);

  // ======== 搜索 / 重置 ========

  const handleSearch = () => {
    fetchEvaluations({ page: 1 });
  };

  const handleReset = () => {
    setSearchParams({
      asset_code: '',
      maintenance_type: '',
      start_date: null,
      end_date: null,
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // ======== 操作 ========

  const handleView = record => {
    setCurrentRecord(record);
    setDetailOpen(true);
  };

  const handleAdd = () => {
    setCurrentRecord(null);
    setIsEditing(false);
    form.resetFields();
    form.setFieldsValue({
      effectiveness_score: 5,
      technician_skill_score: 5,
      response_time_score: 5,
      quality_score: 5,
      overall_score: 5,
      problem_resolved: '是',
      downtime_hours: 0,
      production_impact: '无影响',
    });
    fetchLogOptions();
    setFormOpen(true);
  };

  const handleEdit = record => {
    setCurrentRecord(record);
    setIsEditing(true);
    fetchLogOptions();
    form.setFieldsValue({
      maintenance_log_id: record.maintenance_log_id,
      asset_code: record.asset_code,
      asset_name: record.asset_name,
      maintenance_date: record.maintenance_date ? dayjs(record.maintenance_date) : undefined,
      maintenance_type: record.maintenance_type,
      effectiveness_score: safeNum(record.effectiveness_score, 5),
      problem_resolved: record.problem_resolved === true || record.problem_resolved === '是' ? '是' : '否',
      downtime_hours: safeNum(record.downtime_hours, 0),
      production_impact: record.production_impact || '无影响',
      technician_skill_score: safeNum(record.technician_skill_score, 5),
      response_time_score: safeNum(record.response_time_score, 5),
      quality_score: safeNum(record.quality_score, 5),
      overall_score: safeNum(record.overall_score, 5),
      evaluation_remark: record.evaluation_remark || '',
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        maintenance_date: values.maintenance_date ? dayjs(values.maintenance_date).format('YYYY-MM-DD') : undefined,
        problem_resolved: values.problem_resolved === '是',
      };

      if (isEditing && currentRecord?.id) {
        const response = await maintenanceAPI.updateMaintenanceEvaluation(currentRecord.id, payload);
        if (response?.success) {
          message.success('更新评估成功');
        } else {
          message.error(response?.message || '更新失败');
          return;
        }
      } else {
        const response = await maintenanceAPI.createMaintenanceEvaluation(payload);
        if (response?.success) {
          message.success('创建评估成功');
        } else {
          message.error(response?.message || '创建失败');
          return;
        }
      }
      setFormOpen(false);
      fetchEvaluations();
    } catch (err) {
      if (err?.errorFields) {
        message.warning('请填写必填项');
      } else {
        console.error('提交评估失败:', err);
        message.error('提交评估失败');
      }
    }
  };

  // 日志选择后自动填充
  const handleLogSelect = logId => {
    const selected = logOptions.find(o => o.value === logId);
    if (selected?.record) {
      const r = selected.record;
      form.setFieldsValue({
        asset_code: r.asset_code || '',
        asset_name: r.asset_name || '',
        maintenance_date: r.maintenance_date ? dayjs(r.maintenance_date) : undefined,
        maintenance_type: r.maintenance_type || undefined,
      });
    }
  };

  // ======== 表格列 ========

  const columns = [
    {
      title: '序号',
      dataIndex: 'index',
      key: 'index',
      width: 60,
      render: (_, __, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
    },
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 120,
      ellipsis: true,
      render: text => <Tooltip title={text}>{text || '-'}</Tooltip>,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 120,
      ellipsis: true,
      render: text => <Tooltip title={text}>{text || '-'}</Tooltip>,
    },
    {
      title: '维护类型',
      dataIndex: 'maintenance_type',
      key: 'maintenance_type',
      width: 110,
      render: text => getTypeTag(text),
    },
    {
      title: '维护日期',
      dataIndex: 'maintenance_date',
      key: 'maintenance_date',
      width: 110,
      render: text => (text ? dayjs(text).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '效果评分',
      dataIndex: 'effectiveness_score',
      key: 'effectiveness_score',
      width: 130,
      render: val => renderScoreProgress(val),
    },
    {
      title: '问题解决',
      dataIndex: 'problem_resolved',
      key: 'problem_resolved',
      width: 90,
      render: val => getResolvedTag(val),
    },
    {
      title: '停机时长(h)',
      dataIndex: 'downtime_hours',
      key: 'downtime_hours',
      width: 110,
      render: val => safeNum(val, 0).toFixed(1),
    },
    {
      title: '生产影响',
      dataIndex: 'production_impact',
      key: 'production_impact',
      width: 100,
      render: val => getImpactTag(val),
    },
    {
      title: '技术评分',
      dataIndex: 'technician_skill_score',
      key: 'technician_skill_score',
      width: 130,
      render: val => renderScoreProgress(val),
    },
    {
      title: '响应评分',
      dataIndex: 'response_time_score',
      key: 'response_time_score',
      width: 130,
      render: val => renderScoreProgress(val),
    },
    {
      title: '质量评分',
      dataIndex: 'quality_score',
      key: 'quality_score',
      width: 130,
      render: val => renderScoreProgress(val),
    },
    {
      title: '综合评分',
      dataIndex: 'overall_score',
      key: 'overall_score',
      width: 140,
      render: val => renderScoreProgress(val, 100),
    },
    {
      title: '评估人',
      dataIndex: 'evaluator',
      key: 'evaluator',
      width: 90,
      render: text => text || '-',
    },
    {
      title: '评估日期',
      dataIndex: 'evaluation_date',
      key: 'evaluation_date',
      width: 110,
      render: text => (text ? dayjs(text).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="新建评估">
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => handleAdd()} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ======== 详情抽屉中评分可视化 ========

  const renderDetailScores = record => {
    if (!record) return null;
    const items = [
      { label: '效果评分', value: record.effectiveness_score },
      { label: '技术评分', value: record.technician_skill_score },
      { label: '响应评分', value: record.response_time_score },
      { label: '质量评分', value: record.quality_score },
      { label: '综合评分', value: record.overall_score },
    ];
    return (
      <div style={{ marginTop: 16 }}>
        <Divider titlePlacement="left">评分可视化</Divider>
        {items.map(item => (
          <div key={item.label} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>{item.label}</span>
              <span style={{ color: getScoreColor(safeNum(item.value, 0) * 10), fontWeight: 600 }}>
                {safeNum(item.value, 0).toFixed(1)}
              </span>
            </div>
            <Progress
              percent={Math.round(safeNum(item.value, 0) * 10)}
              strokeColor={getScoreColor(safeNum(item.value, 0) * 10)}
              showInfo={false}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="maintenance-evaluation-list">
      {/* 页头 */}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20 }}>维护评估管理</h1>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchEvaluations()}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建评估
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card variant="outlined" size="small">
            <Statistic
              title="评估总数"
              value={stats.totalEvaluations}
              prefix={<FileTextOutlined />}
              suffix="条"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card variant="outlined" size="small">
            <Statistic
              title="平均综合评分"
              value={stats.avgOverallScore}
              precision={1}
              prefix={<StarOutlined />}
              styles={{ content: { color: getScoreColor(stats.avgOverallScore * 10) } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card variant="outlined" size="small">
            <Statistic
              title="问题解决率"
              value={stats.problemResolvedRate}
              precision={1}
              prefix={<CheckCircleOutlined />}
              suffix="%"
              styles={{ content: { color: stats.problemResolvedRate >= 80 ? '#52c41a' : stats.problemResolvedRate >= 60 ? '#faad14' : '#ff4d4f' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card variant="outlined" size="small">
            <Statistic
              title="平均停机时长"
              value={stats.avgDowntime}
              precision={1}
              prefix={<ClockCircleOutlined />}
              suffix="小时"
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索筛选 */}
      <Card variant="outlined" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="资产编号"
              value={searchParams.asset_code}
              onChange={e => setSearchParams({ ...searchParams, asset_code: e.target.value })}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="维护类型"
              value={searchParams.maintenance_type || undefined}
              onChange={value => setSearchParams({ ...searchParams, maintenance_type: value })}
              style={{ width: '100%' }}
              allowClear
            >
              <Option value="故障维修">故障维修</Option>
              <Option value="预防性维护">预防性维护</Option>
              <Option value="定期维护">定期维护</Option>
              <Option value="校准">校准</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              onChange={dates => {
                if (dates) {
                  setSearchParams({
                    ...searchParams,
                    start_date: dates[0].format('YYYY-MM-DD'),
                    end_date: dates[1].format('YYYY-MM-DD'),
                  });
                } else {
                  setSearchParams({
                    ...searchParams,
                    start_date: null,
                    end_date: null,
                  });
                }
              }}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Space>
              <Button icon={<FilterOutlined />} type="primary" onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 表格 */}
      <Spin spinning={loading}>
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            scroll={{ x: 2000 }}
            pagination={{
              ...pagination,
              onChange: (page, pageSize) => fetchEvaluations({ page, pageSize }),
              showSizeChanger: true,
              showTotal: total => `共 ${total} 条`,
            }}
            size="middle"
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
          ) : Array.isArray(data) && data.length > 0 ? (
            data.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.asset_name}</span>
                  <Tag color={record.evaluation_result === '优秀' ? 'green' : record.evaluation_result === '良好' ? 'blue' : record.evaluation_result === '一般' ? 'orange' : 'default'}>
                    {record.evaluation_result || '-'}
                  </Tag>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">资产编号</span>
                    <span className="mobile-card-value">{record.asset_code || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">评分</span>
                    <span className="mobile-card-value">{record.total_score || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">评估日期</span>
                    <span className="mobile-card-value">
                      {record.evaluation_date ? dayjs(record.evaluation_date).format('YYYY-MM-DD') : '-'}
                    </span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">评估人</span>
                    <span className="mobile-card-value">{record.evaluated_by || '-'}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
          )}
        </div>
      </Spin>

      {/* 新建/编辑评估 Drawer */}
      <Drawer
        title={isEditing ? '编辑评估' : '新建评估'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        styles={{ wrapper: { width: 600 } }}
        extra={
          <Space>
            <Button onClick={() => setFormOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleSubmit}>
              提交
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            effectiveness_score: 5,
            technician_skill_score: 5,
            response_time_score: 5,
            quality_score: 5,
            overall_score: 5,
            problem_resolved: '是',
            downtime_hours: 0,
            production_impact: '无影响',
          }}
        >
          <Form.Item
            name="maintenance_log_id"
            label="维护日志"
            rules={[{ required: true, message: '请选择维护日志' }]}
          >
            <Select
              showSearch
              placeholder="搜索选择维护日志"
              filterOption={false}
              onSearch={val => {
                setLogSearch(val);
                fetchLogOptions(val);
              }}
              onChange={handleLogSelect}
              loading={logLoading}
              notFoundContent={logLoading ? '搜索中...' : '无匹配数据'}
            >
              {logOptions.map(opt => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="asset_code" label="资产编号">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="asset_name" label="资产名称">
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="maintenance_date" label="维护日期">
                <DatePicker style={{ width: '100%' }} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maintenance_type" label="维护类型">
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left">评分</Divider>

          <Form.Item name="effectiveness_score" label="效果评分">
            <Slider min={1} max={10} step={0.5} marks={{ 1: '1', 5: '5', 10: '10' }} />
          </Form.Item>

          <Form.Item name="problem_resolved" label="问题是否解决">
            <Radio.Group>
              <Radio value="是">是</Radio>
              <Radio value="否">否</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="downtime_hours" label="停机时长（小时）">
            <InputNumber min={0} max={9999} step={0.5} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="production_impact" label="生产影响">
            <Select>
              <Option value="无影响">无影响</Option>
              <Option value="轻微影响">轻微影响</Option>
              <Option value="中度影响">中度影响</Option>
              <Option value="严重影响">严重影响</Option>
            </Select>
          </Form.Item>

          <Form.Item name="technician_skill_score" label="技术评分">
            <Slider min={1} max={10} step={0.5} marks={{ 1: '1', 5: '5', 10: '10' }} />
          </Form.Item>

          <Form.Item name="response_time_score" label="响应评分">
            <Slider min={1} max={10} step={0.5} marks={{ 1: '1', 5: '5', 10: '10' }} />
          </Form.Item>

          <Form.Item name="quality_score" label="质量评分">
            <Slider min={1} max={10} step={0.5} marks={{ 1: '1', 5: '5', 10: '10' }} />
          </Form.Item>

          <Form.Item name="overall_score" label="综合评分（自动计算）">
            <Slider min={1} max={10} step={0.5} marks={{ 1: '1', 5: '5', 10: '10' }} />
          </Form.Item>

          <Form.Item name="evaluation_remark" label="评估备注">
            <TextArea rows={4} placeholder="请输入评估备注" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 详情抽屉 */}
      <Drawer
        title="评估详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        styles={{ wrapper: { width: 640 } }}
        extra={
          <Space>
            {currentRecord && (
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setDetailOpen(false);
                  handleEdit(currentRecord);
                }}
              >
                编辑
              </Button>
            )}
            <Button onClick={() => setDetailOpen(false)}>关闭</Button>
          </Space>
        }
      >
        {currentRecord && (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="资产编号">{currentRecord.asset_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="资产名称">{currentRecord.asset_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="维护类型">{getTypeTag(currentRecord.maintenance_type)}</Descriptions.Item>
              <Descriptions.Item label="维护日期">
                {currentRecord.maintenance_date ? dayjs(currentRecord.maintenance_date).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="问题解决">{getResolvedTag(currentRecord.problem_resolved)}</Descriptions.Item>
              <Descriptions.Item label="停机时长">{safeNum(currentRecord.downtime_hours, 0).toFixed(1)} 小时</Descriptions.Item>
              <Descriptions.Item label="生产影响">{getImpactTag(currentRecord.production_impact)}</Descriptions.Item>
              <Descriptions.Item label="评估人">{currentRecord.evaluator || '-'}</Descriptions.Item>
              <Descriptions.Item label="评估日期">
                {currentRecord.evaluation_date ? dayjs(currentRecord.evaluation_date).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
            </Descriptions>

            {renderDetailScores(currentRecord)}

            {currentRecord.evaluation_remark && (
              <>
                <Divider titlePlacement="left">评估备注</Divider>
                <div style={{ whiteSpace: 'pre-wrap', color: '#555' }}>
                  {currentRecord.evaluation_remark}
                </div>
              </>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
};

export default MaintenanceEvaluationList;
