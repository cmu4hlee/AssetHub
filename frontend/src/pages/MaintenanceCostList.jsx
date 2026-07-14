import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Space,
  Modal,
  message,
  Popconfirm,
  Card,
  Col,
  Row,
  Tag,
  Statistic,
  Drawer,
  Form,
  InputNumber,
  Tabs,
  Descriptions,
  Divider,
  Spin,
} from 'antd';

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  DollarOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { maintenanceAPI } from '../utils/api';
import { printMaintenanceCostReport } from '../utils/printReport';
import dayjs from 'dayjs';
import { useIsMobile, useCan } from '../hooks';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const COST_TYPE_MAP = {
  labor: { label: '人工费', color: 'blue' },
  material: { label: '材料费', color: 'green' },
  external: { label: '外部服务费', color: 'orange' },
  other: { label: '其他费用', color: 'default' },
};

const formatAmount = (value) => {
  if (value == null || isNaN(value)) return '¥0.00';
  return `¥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const MaintenanceCostList = () => {
  const isMobile = useIsMobile();
  const canDelete = useCan('maintenance', 'delete');
  const canEdit = useCan('maintenance', 'edit');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [form] = Form.useForm();

  const [searchParams, setSearchParams] = useState({
    asset_code: '',
    cost_type: '',
    department: '',
    start_date: null,
    end_date: null,
  });

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const [summaryStats, setSummaryStats] = useState({
    totalCost: 0,
    laborCost: 0,
    materialCost: 0,
    externalCost: 0,
    otherCost: 0,
  });

  // 计算统计数据
  const calcSummaryStats = useCallback((list) => {
    const safeList = Array.isArray(list) ? list : [];
    let totalCost = 0;
    let laborCost = 0;
    let materialCost = 0;
    let externalCost = 0;
    let otherCost = 0;

    safeList.forEach((item) => {
      const amount = Number(item?.amount) || 0;
      totalCost += amount;
      switch (item?.cost_type) {
        case 'labor':
          laborCost += amount;
          break;
        case 'material':
          materialCost += amount;
          break;
        case 'external':
          externalCost += amount;
          break;
        default:
          otherCost += amount;
          break;
      }
    });

    setSummaryStats({ totalCost, laborCost, materialCost, externalCost, otherCost });
  }, []);

  // 获取成本列表
  const fetchCosts = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const requestParams = {
        page: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        ...searchParams,
      };
      if (searchParams.start_date) {
        requestParams.start_date = dayjs(searchParams.start_date).format('YYYY-MM-DD');
      }
      if (searchParams.end_date) {
        requestParams.end_date = dayjs(searchParams.end_date).format('YYYY-MM-DD');
      }

      const response = await maintenanceAPI.getMaintenanceCosts(requestParams);

      if (response.data) {
        const list = response.data || [];
        setData(list);
        setPagination((prev) => ({
          ...prev,
          current: params.page || prev.current,
          pageSize: params.pageSize || prev.pageSize,
          total: response.pagination?.total || 0,
        }));
        calcSummaryStats(list);
      } else {
        message.error(response.message || '获取成本列表失败');
      }
    } catch (error) {
      console.error('获取成本列表失败:', error);
      message.error('网络错误，获取成本列表失败');
    } finally {
      setLoading(false);
    }
  }, [searchParams, pagination.current, pagination.pageSize, calcSummaryStats]);

  // 获取成本分析数据
  const fetchAnalysis = useCallback(async () => {
    setAnalysisLoading(true);
    try {
      const params = { ...searchParams };
      if (searchParams.start_date) {
        params.start_date = dayjs(searchParams.start_date).format('YYYY-MM-DD');
      }
      if (searchParams.end_date) {
        params.end_date = dayjs(searchParams.end_date).format('YYYY-MM-DD');
      }

      const response = await maintenanceAPI.getCostAnalysis(params);
      if (response.success || response.data) {
        setAnalysisData(response.data || response);
      } else {
        message.error(response.message || '获取成本分析失败');
      }
    } catch (error) {
      console.error('获取成本分析失败:', error);
      message.error('获取成本分析数据失败');
    } finally {
      setAnalysisLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchCosts();
  }, []);

  useEffect(() => {
    if (activeTab === 'analysis') {
      fetchAnalysis();
    }
  }, [activeTab, fetchAnalysis]);

  // 搜索
  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    fetchCosts({ page: 1 });
  };

  // 重置
  const handleReset = () => {
    setSearchParams({
      asset_code: '',
      cost_type: '',
      department: '',
      start_date: null,
      end_date: null,
    });
    setPagination((prev) => ({ ...prev, current: 1 }));
    setTimeout(() => fetchCosts({ page: 1 }), 0);
  };

  // 分页
  const handleTableChange = (pag) => {
    fetchCosts({ page: pag.current, pageSize: pag.pageSize });
  };

  // 新增
  const handleAdd = () => {
    setIsEditing(false);
    setCurrentRecord(null);
    form.resetFields();
    setModalOpen(true);
  };

  // 编辑
  const handleEdit = (record) => {
    setIsEditing(true);
    setCurrentRecord(record);
    form.setFieldsValue({
      ...record,
      cost_date: record.cost_date ? dayjs(record.cost_date) : null,
    });
    setModalOpen(true);
  };

  // 删除
  const handleDelete = async (id) => {
    try {
      const response = await maintenanceAPI.deleteMaintenanceCost(id);

      if (response.success || response.status === 200) {
        message.success('删除成功');
        fetchCosts();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 查看详情
  const handleView = (record) => {
    setCurrentRecord(record);
    setDrawerOpen(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const submitData = {
        ...values,
        cost_date: values.cost_date ? values.cost_date.format('YYYY-MM-DD') : null,
      };

      let response;
      if (isEditing && currentRecord?.id) {
        response = await maintenanceAPI.updateMaintenanceCost(currentRecord.id, submitData);
      } else {
        response = await maintenanceAPI.createMaintenanceCost(submitData);
      }

      if (response.success || response.data) {
        message.success(isEditing ? '更新成功' : '新增成功');
        setModalOpen(false);
        form.resetFields();
        fetchCosts();
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      if (error.errorFields) {
        return;
      }
      console.error('提交失败:', error);
      message.error('操作失败');
    }
  };

  // 打印报表
  const handlePrintReport = () => {
    if (!data || data.length === 0) {
      message.warning('暂无数据可打印');
      return;
    }
    printMaintenanceCostReport(data, summaryStats);
  };

  // 成本列表表格列
  const costColumns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_, __, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
    },
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 130,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 130,
      render: (text) => text || '-',
    },
    {
      title: '成本类型',
      dataIndex: 'cost_type',
      key: 'cost_type',
      width: 110,
      render: (type) => {
        const config = COST_TYPE_MAP[type] || COST_TYPE_MAP.other;
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right',
      render: (val) => formatAmount(val),
    },
    {
      title: '成本日期',
      dataIndex: 'cost_date',
      key: 'cost_date',
      width: 110,
      render: (text) => text || '-',
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 100,
      render: (text) => text || '-',
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      width: 100,
      render: (text) => text || '-',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 160,
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '关联日志ID',
      dataIndex: 'maintenance_log_id',
      key: 'maintenance_log_id',
      width: 100,
      render: (val) => val != null ? val : '-',
    },
    {
      title: '关联工单ID',
      dataIndex: 'work_order_id',
      key: 'work_order_id',
      width: 100,
      render: (val) => val != null ? val : '-',
    },
    {
      title: '创建人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 90,
      render: (text) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除此成本记录？"
            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 成本分析 - 汇总行
  const renderAnalysisSummary = () => {
    const summary = analysisData?.summary || {};
    const total = Number(summary.total_cost) || 0;
    const labor = Number(summary.labor_cost) || 0;
    const material = Number(summary.material_cost) || 0;
    const external = Number(summary.external_cost) || 0;
    const other = Number(summary.other_cost) || 0;

    return (
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card variant="outlined">
            <Statistic title="总成本" value={total} prefix="¥" styles={{ content: { color: '#fa8c16' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="outlined">
            <Statistic title="人工成本" value={labor} prefix="¥" styles={{ content: { color: '#1890ff' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="outlined">
            <Statistic title="材料成本" value={material} prefix="¥" styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="outlined">
            <Statistic title="外部/其他成本" value={external + other} prefix="¥" />
          </Card>
        </Col>
      </Row>
    );
  };

  // 资产分布表格
  const assetDistColumns = [
    { title: '排名', key: 'rank', width: 60, render: (_, __, idx) => idx + 1 },
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code' },
    { title: '资产名称', dataIndex: 'asset_name', key: 'asset_name', render: (t) => t || '-' },
    { title: '总成本', dataIndex: 'total_cost', key: 'total_cost', align: 'right', render: (v) => formatAmount(v) },
    { title: '记录数', dataIndex: 'count', key: 'count', align: 'right' },
  ];

  // 部门分布表格
  const deptDistColumns = [
    { title: '排名', key: 'rank', width: 60, render: (_, __, idx) => idx + 1 },
    { title: '部门', dataIndex: 'department', key: 'department' },
    { title: '总成本', dataIndex: 'total_cost', key: 'total_cost', align: 'right', render: (v) => formatAmount(v) },
    { title: '记录数', dataIndex: 'count', key: 'count', align: 'right' },
  ];

  // 月度趋势表格
  const monthlyTrendColumns = [
    { title: '月份', dataIndex: 'month', key: 'month' },
    { title: '总成本', dataIndex: 'total_cost', key: 'total_cost', align: 'right', render: (v) => formatAmount(v) },
    { title: '人工费', dataIndex: 'labor_cost', key: 'labor_cost', align: 'right', render: (v) => formatAmount(v) },
    { title: '材料费', dataIndex: 'material_cost', key: 'material_cost', align: 'right', render: (v) => formatAmount(v) },
    { title: '外部服务费', dataIndex: 'external_cost', key: 'external_cost', align: 'right', render: (v) => formatAmount(v) },
    { title: '其他费用', dataIndex: 'other_cost', key: 'other_cost', align: 'right', render: (v) => formatAmount(v) },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="outlined">
            <Statistic
              title="总成本"
              value={summaryStats.totalCost}
              prefix="¥"
              styles={{ content: { color: '#fa8c16' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="outlined">
            <Statistic
              title="人工成本"
              value={summaryStats.laborCost}
              prefix="¥"
              styles={{ content: { color: '#1890ff' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="outlined">
            <Statistic
              title="材料成本"
              value={summaryStats.materialCost}
              prefix="¥"
              styles={{ content: { color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="outlined">
            <Statistic
              title="外部/其他成本"
              value={summaryStats.externalCost + summaryStats.otherCost}
              prefix="¥"
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button icon={<PrinterOutlined />} onClick={handlePrintReport}>
          打印报表
        </Button>
      </div>

      {/* 搜索筛选 */}
      <Card variant="outlined" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={4}>
            <Input
              placeholder="资产编号"
              value={searchParams.asset_code}
              onChange={(e) => setSearchParams((prev) => ({ ...prev, asset_code: e.target.value }))}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="成本类型"
              value={searchParams.cost_type || undefined}
              onChange={(val) => setSearchParams((prev) => ({ ...prev, cost_type: val || '' }))}
              allowClear
              style={{ width: '100%' }}
            >
              {Object.entries(COST_TYPE_MAP).map(([key, { label }]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Input
              placeholder="部门"
              value={searchParams.department}
              onChange={(e) => setSearchParams((prev) => ({ ...prev, department: e.target.value }))}
              allowClear
            />
          </Col>
          <Col span={8}>
            <RangePicker
              style={{ width: '100%' }}
              value={
                searchParams.start_date && searchParams.end_date
                  ? [dayjs(searchParams.start_date), dayjs(searchParams.end_date)]
                  : null
              }
              onChange={(dates) => {
                setSearchParams((prev) => ({
                  ...prev,
                  start_date: dates?.[0] || null,
                  end_date: dates?.[1] || null,
                }));
              }}
            />
          </Col>
          <Col span={4}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 标签页 */}
      <Card variant="outlined">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'list',
              label: '成本列表',
              children: (
                <>
                  <div style={{ marginBottom: 16, textAlign: 'right' }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                      新增成本
                    </Button>
                  </div>
                  <div className="hide-on-mobile">
                    <Table
                      columns={costColumns}
                      dataSource={data}
                      rowKey="id"
                      loading={loading}
                      scroll={{ x: 1500 }}
                      pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                      }}
                      onChange={handleTableChange}
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
                            <Tag color={record.cost_type === 'labor' ? 'blue' : record.cost_type === 'material' ? 'green' : 'orange'}>
                              {record.cost_type === 'labor' ? '人工费' : record.cost_type === 'material' ? '材料费' : '其他'}
                            </Tag>
                          </div>
                          <div className="mobile-card-body">
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">资产编号</span>
                              <span className="mobile-card-value">{record.asset_code || '-'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">资产名称</span>
                              <span className="mobile-card-value">{record.asset_name || '-'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">费用金额</span>
                              <span className="mobile-card-value">¥{record.amount?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">费用日期</span>
                              <span className="mobile-card-value">
                                {record.cost_date ? dayjs(record.cost_date).format('YYYY-MM-DD') : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
                    )}
                  </div>
                </>
              ),
            },
            {
              key: 'analysis',
              label: '成本分析',
              children: (
                <Spin spinning={analysisLoading}>
                  {renderAnalysisSummary()}
                  <Divider titlePlacement="left">资产成本分布（Top 10）</Divider>
                  <Table
                    columns={assetDistColumns}
                    dataSource={analysisData?.assetDistribution || []}
                    rowKey="asset_code"
                    pagination={false}
                    size="small"
                    style={{ marginBottom: 24 }}
                  />
                  <Divider titlePlacement="left">部门成本分布</Divider>
                  <Table
                    columns={deptDistColumns}
                    dataSource={analysisData?.departmentDistribution || []}
                    rowKey="department"
                    pagination={false}
                    size="small"
                    style={{ marginBottom: 24 }}
                  />
                  <Divider titlePlacement="left">月度趋势</Divider>
                  <Table
                    columns={monthlyTrendColumns}
                    dataSource={analysisData?.monthlyTrend || []}
                    rowKey="month"
                    pagination={false}
                    size="small"
                  />
                </Spin>
              ),
            },
          ]}
        />
      </Card>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={isEditing ? '编辑成本记录' : '新增成本记录'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        styles={{ wrapper: { width: 680 } }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="asset_code"
                label="资产编号"
                rules={[{ required: true, message: '请输入资产编号' }]}
              >
                <Input placeholder="请输入资产编号" allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="cost_date"
                label="成本日期"
                rules={[{ required: true, message: '请选择成本日期' }]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="请选择日期" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="cost_type"
                label="成本类型"
                rules={[{ required: true, message: '请选择成本类型' }]}
              >
                <Select placeholder="请选择成本类型">
                  {Object.entries(COST_TYPE_MAP).map(([key, { label }]) => (
                    <Option key={key} value={key}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="金额"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  prefix="¥"
                  placeholder="请输入金额"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="description" label="描述">
                <TextArea rows={3} placeholder="请输入描述" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="department" label="部门">
                <Input placeholder="请输入部门" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label="位置">
                <Input placeholder="请输入位置" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="maintenance_log_id" label="关联日志ID">
                <InputNumber style={{ width: '100%' }} placeholder="可选" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="work_order_id" label="关联工单ID">
                <InputNumber style={{ width: '100%' }} placeholder="可选" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 详情抽屉 */}
      <Drawer
        title="成本记录详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ wrapper: { width: 560 } }}
      >
        {currentRecord && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="资产编号">{currentRecord.asset_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="资产名称">{currentRecord.asset_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="成本类型">
              {(() => {
                const config = COST_TYPE_MAP[currentRecord.cost_type] || COST_TYPE_MAP.other;
                return <Tag color={config.color}>{config.label}</Tag>;
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="金额">{formatAmount(currentRecord.amount)}</Descriptions.Item>
            <Descriptions.Item label="成本日期">{currentRecord.cost_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="部门">{currentRecord.department || '-'}</Descriptions.Item>
            <Descriptions.Item label="位置">{currentRecord.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建人">{currentRecord.created_by || '-'}</Descriptions.Item>
            <Descriptions.Item label="关联日志ID" span={1}>
              {currentRecord.maintenance_log_id != null ? currentRecord.maintenance_log_id : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="关联工单ID" span={1}>
              {currentRecord.work_order_id != null ? currentRecord.work_order_id : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {currentRecord.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>
              {currentRecord.created_at || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间" span={2}>
              {currentRecord.updated_at || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default MaintenanceCostList;
