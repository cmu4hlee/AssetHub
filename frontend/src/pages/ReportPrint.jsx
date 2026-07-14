/**
 * 报表打印页面
 * 提供统计数据、维修维护、工单三大类报表的打印功能
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Space,
  Tabs,
  DatePicker,
  Select,
  Form,
  Radio,
  message,
  Spin,
  Row,
  Col,
  Alert,
  Typography,
  Empty,
} from 'antd';

import {
  PrinterOutlined,
  BarChartOutlined,
  ToolOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { assetAPI, maintenanceAPI } from '../utils/api';
import {
  printStatisticsReport,
  printMaintenanceReport,
  printWorkOrderReport,
} from '../utils/printReport';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;

const REPORT_TYPES = {
  statistics: { label: '统计报表', icon: <BarChartOutlined /> },
  maintenance: { label: '维修维护报表', icon: <ToolOutlined /> },
  workorder: { label: '工单报表', icon: <FileTextOutlined /> },
};

const ReportPrint = () => {
  const [activeTab, setActiveTab] = useState('statistics');
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [dateRange, setDateRange] = useState([null, null]);
  const [reportScope, setReportScope] = useState('all'); // all | filtered
  const [statusFilter, setStatusFilter] = useState('');

  // 数据缓存
  const [statsData, setStatsData] = useState(null);
  const [maintenanceStatsData, setMaintenanceStatsData] = useState(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [dispatchPanel, setDispatchPanel] = useState(null);

  const buildParams = useCallback(() => {
    const params = {};
    if (dateRange && dateRange[0] && dateRange[1]) {
      params.start_date = dateRange[0].format('YYYY-MM-DD');
      params.end_date = dateRange[1].format('YYYY-MM-DD');
    }
    if (statusFilter) {
      params.status = statusFilter;
    }
    return params;
  }, [dateRange, statusFilter]);

  const getPeriodLabel = useCallback(() => {
    if (dateRange && dateRange[0] && dateRange[1]) {
      return `${dateRange[0].format('YYYY-MM-DD')} ~ ${dateRange[1].format('YYYY-MM-DD')}`;
    }
    return '全部数据';
  }, [dateRange]);

  // 加载统计数据
  const fetchStatisticsData = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const [statsRes, maintRes] = await Promise.allSettled([
        assetAPI.getStatistics(params),
        maintenanceAPI.getMaintenanceStatistics(params),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        setStatsData(statsRes.value.data);
      } else if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
        setStatsData(statsRes.value.data);
      }

      if (maintRes.status === 'fulfilled') {
        const data = maintRes.value?.data || maintRes.value;
        if (data) setMaintenanceStatsData(data);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // 加载维修维护日志
  const fetchMaintenanceData = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const [logsRes, statsRes] = await Promise.allSettled([
        maintenanceAPI.getMaintenanceLogs({ ...params, page: 1, pageSize: 1000 }),
        maintenanceAPI.getMaintenanceStatistics(params),
      ]);

      if (logsRes.status === 'fulfilled') {
        const data = logsRes.value?.data || logsRes.value?.items || [];
        setMaintenanceLogs(Array.isArray(data) ? data : []);
      }

      if (statsRes.status === 'fulfilled') {
        const data = statsRes.value?.data || statsRes.value;
        if (data) setMaintenanceStatsData(data);
      }
    } catch (error) {
      console.error('加载维修维护数据失败:', error);
      message.error('加载维修维护数据失败');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // 加载工单数据
  const fetchWorkOrderData = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const [ordersRes, panelRes] = await Promise.allSettled([
        maintenanceAPI.getMaintenanceWorkOrders({ ...params, page: 1, pageSize: 1000 }),
        maintenanceAPI.getWorkOrderDispatchPanel(params),
      ]);

      if (ordersRes.status === 'fulfilled') {
        const data = ordersRes.value?.data || ordersRes.value?.items || [];
        setWorkOrders(Array.isArray(data) ? data : []);
      }

      if (panelRes.status === 'fulfilled' && panelRes.value?.success) {
        setDispatchPanel(panelRes.value.data);
      }
    } catch (error) {
      console.error('加载工单数据失败:', error);
      message.error('加载工单数据失败');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // 根据当前 Tab 加载对应数据
  const loadData = useCallback(() => {
    switch (activeTab) {
      case 'statistics':
        fetchStatisticsData();
        break;
      case 'maintenance':
        fetchMaintenanceData();
        break;
      case 'workorder':
        fetchWorkOrderData();
        break;
      default:
        break;
    }
  }, [activeTab, fetchStatisticsData, fetchMaintenanceData, fetchWorkOrderData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 打印统计报表
  const handlePrintStatistics = async () => {
    if (!statsData && !maintenanceStatsData) {
      message.warning('暂无数据可打印');
      return;
    }
    setPrinting(true);
    try {
      printStatisticsReport(statsData, maintenanceStatsData, {
        period: getPeriodLabel(),
        generatedBy: '系统用户',
      });
      message.success('正在生成统计报表');
    } catch (error) {
      console.error('打印统计报表失败:', error);
      message.error('打印失败');
    } finally {
      setPrinting(false);
    }
  };

  // 打印维修维护报表
  const handlePrintMaintenance = async () => {
    if (!maintenanceLogs.length && !maintenanceStatsData) {
      message.warning('暂无数据可打印');
      return;
    }
    setPrinting(true);
    try {
      printMaintenanceReport(maintenanceLogs, maintenanceStatsData, {
        period: getPeriodLabel(),
        generatedBy: '系统用户',
      });
      message.success('正在生成维修维护报表');
    } catch (error) {
      console.error('打印维修维护报表失败:', error);
      message.error('打印失败');
    } finally {
      setPrinting(false);
    }
  };

  // 打印工单报表
  const handlePrintWorkOrder = async () => {
    if (!workOrders.length && !dispatchPanel) {
      message.warning('暂无数据可打印');
      return;
    }
    setPrinting(true);
    try {
      printWorkOrderReport(workOrders, dispatchPanel, {
        period: getPeriodLabel(),
        generatedBy: '系统用户',
      });
      message.success('正在生成工单报表');
    } catch (error) {
      console.error('打印工单报表失败:', error);
      message.error('打印失败');
    } finally {
      setPrinting(false);
    }
  };

  const handleRefresh = () => {
    loadData();
  };

  const tabItems = [
    {
      key: 'statistics',
      label: (
        <span>
          <BarChartOutlined /> 统计报表
        </span>
      ),
      children: (
        <StatisticsReportPanel
          loading={loading}
          statsData={statsData}
          maintenanceStatsData={maintenanceStatsData}
          period={getPeriodLabel()}
          onPrint={handlePrintStatistics}
          printing={printing}
        />
      ),
    },
    {
      key: 'maintenance',
      label: (
        <span>
          <ToolOutlined /> 维修维护报表
        </span>
      ),
      children: (
        <MaintenanceReportPanel
          loading={loading}
          logs={maintenanceLogs}
          statistics={maintenanceStatsData}
          period={getPeriodLabel()}
          onPrint={handlePrintMaintenance}
          printing={printing}
        />
      ),
    },
    {
      key: 'workorder',
      label: (
        <span>
          <FileTextOutlined /> 工单报表
        </span>
      ),
      children: (
        <WorkOrderReportPanel
          loading={loading}
          workOrders={workOrders}
          dispatchPanel={dispatchPanel}
          period={getPeriodLabel()}
          onPrint={handlePrintWorkOrder}
          printing={printing}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title={
          <Space>
            <PrinterOutlined style={{ color: '#1890ff' }} />
            <span>报表打印中心</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
              刷新数据
            </Button>
          </Space>
        }
      >
        <Alert
          message="报表打印说明"
          description="选择报表类型和筛选条件后，点击「打印报表」按钮，系统将打开新窗口生成可打印的报表。可在打印窗口中另存为 PDF。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form layout="inline" style={{ marginBottom: 16 }}>
          <Form.Item label="日期范围">
            <RangePicker
              value={dateRange}
              onChange={dates => setDateRange(dates ? [dates[0], dates[1]] : [null, null])}
              placeholder={['开始日期', '结束日期']}
            />
          </Form.Item>
          {activeTab !== 'statistics' && (
            <Form.Item label="状态筛选">
              <Select
                allowClear
                placeholder="选择状态"
                value={statusFilter || undefined}
                onChange={value => setStatusFilter(value || '')}
                style={{ width: 140 }}
              >
                {activeTab === 'maintenance' && (
                  <>
                    <Option value="pending">待处理</Option>
                    <Option value="in_progress">处理中</Option>
                    <Option value="completed">已完成</Option>
                    <Option value="cancelled">已取消</Option>
                  </>
                )}
                {activeTab === 'workorder' && (
                  <>
                    <Option value="pending">待分配</Option>
                    <Option value="assigned">已分配</Option>
                    <Option value="in_progress">进行中</Option>
                    <Option value="completed">已完成</Option>
                    <Option value="closed">已关闭</Option>
                    <Option value="cancelled">已取消</Option>
                  </>
                )}
              </Select>
            </Form.Item>
          )}
        </Form>

        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>
    </div>
  );
};

/**
 * 统计报表预览面板
 */
const StatisticsReportPanel = ({ loading, statsData, maintenanceStatsData, period, onPrint, printing }) => {
  const overview = statsData?.overview || {};
  const totalCount = overview.total_count || statsData?.total_assets || 0;
  const totalValue = overview.total_value || statsData?.total_value || 0;

  const formatCurrency = value => {
    if (value >= 100000000) return `${(value / 100000000).toFixed(2)} 亿元`;
    if (value >= 10000) return `${(value / 10000).toFixed(2)} 万元`;
    return `${Number(value || 0).toLocaleString()} 元`;
  };

  const statsItems = [
    { label: '资产总数', value: totalCount },
    { label: '在用资产', value: overview.in_use_count || 0 },
    { label: '闲置资产', value: overview.idle_count || 0 },
    { label: '维修中', value: overview.repair_count || 0 },
    { label: '调配中', value: overview.transfer_count || 0 },
    { label: '已报废', value: overview.scrap_count || 0 },
    { label: '资产总值', value: formatCurrency(totalValue) },
    { label: '保修期内', value: overview.warranty_count || 0 },
  ];

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {statsItems.map(item => (
          <Col xs={12} sm={8} md={6} key={item.label}>
            <Card size="small">
              <div style={{ fontSize: 20, fontWeight: 600, color: '#1890ff' }}>
                {item.value}
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>{item.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {maintenanceStatsData && (
        <Card title="维护统计概览" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 8]}>
            <Col span={6}>维护总数: {maintenanceStatsData.total_count || 0}</Col>
            <Col span={6}>已完成: {maintenanceStatsData.completed_count || 0}</Col>
            <Col span={6}>处理中: {maintenanceStatsData.in_progress_count || 0}</Col>
            <Col span={6}>
              总费用: {Number(maintenanceStatsData.total_cost || 0).toLocaleString()} 元
            </Col>
          </Row>
        </Card>
      )}

      <Card
        title="报表预览"
        size="small"
        extra={
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={onPrint}
            loading={printing}
            disabled={!statsData && !maintenanceStatsData}
          >
            打印统计报表
          </Button>
        }
      >
        <div style={{ padding: '12px 0' }}>
          <Title level={5}>资产统计数据报表</Title>
          <Text type="secondary">统计范围: {period}</Text>
          <div style={{ marginTop: 12 }}>
            {statsData ? (
              <ul>
                <li>资产总数: {totalCount}</li>
                <li>资产总值: {formatCurrency(totalValue)}</li>
                <li>分类数量: {(statsData.by_category || []).length}</li>
                <li>部门数量: {(statsData.by_department || []).length}</li>
              </ul>
            ) : (
              <Empty description="暂无统计数据" />
            )}
          </div>
        </div>
      </Card>
    </Spin>
  );
};

/**
 * 维修维护报表预览面板
 */
const MaintenanceReportPanel = ({ loading, logs, statistics, period, onPrint, printing }) => {
  return (
    <Spin spinning={loading}>
      {statistics && (
        <Card title="维护统计概览" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 8]}>
            <Col span={6}>维护总数: {statistics.total_count || 0}</Col>
            <Col span={6}>已完成: {statistics.completed_count || 0}</Col>
            <Col span={6}>处理中: {statistics.in_progress_count || 0}</Col>
            <Col span={6}>
              总费用: {Number(statistics.total_cost || 0).toLocaleString()} 元
            </Col>
          </Row>
        </Card>
      )}

      <Card
        title={`维护日志明细 (${logs.length} 条)`}
        size="small"
        extra={
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={onPrint}
            loading={printing}
            disabled={!logs.length && !statistics}
          >
            打印维修维护报表
          </Button>
        }
      >
        <div style={{ padding: '12px 0' }}>
          <Title level={5}>维修维护报表</Title>
          <Text type="secondary">统计范围: {period}</Text>
          <div style={{ marginTop: 12 }}>
            {logs.length > 0 ? (
              <div>
                <p>共 {logs.length} 条维护日志记录</p>
                <p>报表将包含: 维护统计概览 + 维护日志明细表</p>
              </div>
            ) : (
              <Empty description="暂无维护日志数据" />
            )}
          </div>
        </div>
      </Card>
    </Spin>
  );
};

/**
 * 工单报表预览面板
 */
const WorkOrderReportPanel = ({ loading, workOrders, dispatchPanel, period, onPrint, printing }) => {
  const overview = dispatchPanel?.overview || {};

  return (
    <Spin spinning={loading}>
      {dispatchPanel && (
        <Card title="工单调度概览" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 8]}>
            <Col span={6}>工单总数: {overview.total_count || 0}</Col>
            <Col span={6}>待分配: {overview.pending_count || 0}</Col>
            <Col span={6}>进行中: {overview.in_progress_count || 0}</Col>
            <Col span={6}>已完成: {overview.completed_count || 0}</Col>
          </Row>
        </Card>
      )}

      <Card
        title={`工单明细 (${workOrders.length} 条)`}
        size="small"
        extra={
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={onPrint}
            loading={printing}
            disabled={!workOrders.length && !dispatchPanel}
          >
            打印工单报表
          </Button>
        }
      >
        <div style={{ padding: '12px 0' }}>
          <Title level={5}>维护工单报表</Title>
          <Text type="secondary">统计范围: {period}</Text>
          <div style={{ marginTop: 12 }}>
            {workOrders.length > 0 ? (
              <div>
                <p>共 {workOrders.length} 条工单记录</p>
                <p>报表将包含: 工单概览 + 工程师工作量 + 工单明细表</p>
              </div>
            ) : (
              <Empty description="暂无工单数据" />
            )}
          </div>
        </div>
      </Card>
    </Spin>
  );
};

export default ReportPrint;
