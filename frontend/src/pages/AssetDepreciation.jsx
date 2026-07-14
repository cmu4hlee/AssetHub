import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Select,
  Space,
  Tag,
  Typography,
  Statistic,
  Row,
  Col,
  DatePicker,
  message,
  Spin,
  Tabs,
  Progress,
} from 'antd';

import {
  DollarOutlined,
  BarChartOutlined,
  DownloadOutlined,
  ReloadOutlined,
  PieChartOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { depreciationAPI } from '../utils/api';
import { printDepreciationReport } from '../utils/printReport';
import { useDepartment } from '../contexts/DepartmentContext';
import useIsMobile from '../hooks/useIsMobile';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const AssetDepreciation = () => {
  const { selectedDepartmentId } = useDepartment();
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [method, setMethod] = useState('straight-line');
  const [asOfDate, setAsOfDate] = useState(dayjs());
  const [depreciationData, setDepreciationData] = useState(null);
  const [summaryByDept, setSummaryByDept] = useState([]);
  const [summaryByType, setSummaryByType] = useState([]);
  const [summaryByMonth, setSummaryByMonth] = useState([]);
  const [activeTab, setActiveTab] = useState('summary');
  const activeDepartmentId =
    selectedDepartmentId && selectedDepartmentId !== 'all' ? selectedDepartmentId : undefined;

  const loadDepreciation = useCallback(async () => {
    try {
      setLoading(true);
      const result = await depreciationAPI.getDepreciation({
        method,
        as_of_date: asOfDate?.format('YYYY-MM-DD'),
        department_id: activeDepartmentId,
      });
      if (result.success) {
        setDepreciationData(result.data);
      }
    } catch (error) {
      console.error('加载折旧数据失败:', error);
      message.error('加载折旧数据失败');
    } finally {
      setLoading(false);
    }
  }, [activeDepartmentId, asOfDate, method]);

  const loadSummaryByDepartment = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const result = await depreciationAPI.getSummaryByDepartment({
        method,
        as_of_date: asOfDate?.format('YYYY-MM-DD'),
        department_id: activeDepartmentId,
      });
      if (result.success) {
        setSummaryByDept(result.data.summaries || []);
      }
    } catch (error) {
      console.error('加载部门汇总失败:', error);
    } finally {
      setSummaryLoading(false);
    }
  }, [activeDepartmentId, asOfDate, method]);

  const loadSummaryByType = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const result = await depreciationAPI.getSummaryByType({
        method,
        as_of_date: asOfDate?.format('YYYY-MM-DD'),
        department_id: activeDepartmentId,
      });
      if (result.success) {
        setSummaryByType(result.data.summaries || []);
      }
    } catch (error) {
      console.error('加载类型汇总失败:', error);
    } finally {
      setSummaryLoading(false);
    }
  }, [activeDepartmentId, asOfDate, method]);

  const loadSummaryByMonth = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const result = await depreciationAPI.getSummaryByMonth({
        method,
        as_of_date: asOfDate?.format('YYYY-MM-DD'),
        department_id: activeDepartmentId,
        months: 12,
      });
      if (result.success) {
        setSummaryByMonth(result.data.trend || []);
      }
    } catch (error) {
      console.error('加载月度趋势失败:', error);
    } finally {
      setSummaryLoading(false);
    }
  }, [activeDepartmentId, asOfDate, method]);

  useEffect(() => {
    loadDepreciation();
    loadSummaryByDepartment();
    loadSummaryByType();
    loadSummaryByMonth();
  }, [loadDepreciation, loadSummaryByDepartment, loadSummaryByMonth, loadSummaryByType]);

  const handleExport = async () => {
    try {
      message.loading('正在导出...', 0);
      const result = await depreciationAPI.export({
        method,
        as_of_date: asOfDate?.format('YYYY-MM-DD'),
        department_id: activeDepartmentId,
        format: 'csv',
      });
      message.destroy();

      if (result.success) {
        const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `折旧报表_${dayjs().format('YYYYMMDD')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        message.success('导出成功');
      }
    } catch (error) {
      message.destroy();
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  const handlePrintReport = () => {
    printDepreciationReport(depreciationData, summaryByDept, summaryByType, summaryByMonth, {
      period: asOfDate ? asOfDate.format('YYYY-MM-DD') : '全部数据',
    });
  };

  const methodOptions = [
    { value: 'straight-line', label: '直线法' },
    { value: 'double-declining', label: '双倍余额递减法' },
    { value: 'sum-of-years-digits', label: '年数总和法' },
    { value: 'none', label: '不计提折旧' },
  ];

  const assetColumns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 150,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 200,
    },
    {
      title: '资产类型',
      dataIndex: 'asset_type',
      key: 'asset_type',
      width: 120,
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
    },
    {
      title: '购置金额',
      dataIndex: ['depreciation', 'purchasePrice'],
      key: 'purchasePrice',
      width: 120,
      render: value => `¥${(value || 0).toLocaleString()}`,
    },
    {
      title: '累计折旧',
      dataIndex: ['depreciation', 'accumulatedDepreciation'],
      key: 'accumulatedDepreciation',
      width: 120,
      render: value => (
        <Text type="warning">¥{(value || 0).toLocaleString()}</Text>
      ),
    },
    {
      title: '账面净值',
      dataIndex: ['depreciation', 'currentBookValue'],
      key: 'currentBookValue',
      width: 120,
      render: value => (
        <Text type="success">¥{(value || 0).toLocaleString()}</Text>
      ),
    },
    {
      title: '折旧率',
      dataIndex: ['depreciation', 'depreciationRate'],
      key: 'depreciationRate',
      width: 100,
      render: value => (
        <Progress
          percent={parseFloat(value) || 0}
          size="small"
          status={parseFloat(value) > 80 ? 'exception' : 'active'}
        />
      ),
    },
    {
      title: '已用月数',
      dataIndex: ['depreciation', 'monthsUsed'],
      key: 'monthsUsed',
      width: 100,
      render: value => `${value || 0}月`,
    },
    {
      title: '剩余月数',
      dataIndex: ['depreciation', 'remainingMonths'],
      key: 'remainingMonths',
      width: 100,
      render: value => (
        <Tag color={value > 12 ? 'green' : value > 6 ? 'orange' : 'red'}>
          {value || 0}月
        </Tag>
      ),
    },
  ];

  const deptColumns = [
    {
      title: '部门',
      dataIndex: 'departmentName',
      key: 'departmentName',
    },
    {
      title: '资产数量',
      dataIndex: 'assetCount',
      key: 'assetCount',
      width: 100,
    },
    {
      title: '购置金额',
      dataIndex: 'totalPurchasePrice',
      key: 'totalPurchasePrice',
      width: 150,
      render: value => `¥${(value || 0).toLocaleString()}`,
    },
    {
      title: '累计折旧',
      dataIndex: 'totalAccumulatedDepreciation',
      key: 'totalAccumulatedDepreciation',
      width: 150,
      render: value => `¥${(value || 0).toLocaleString()}`,
    },
    {
      title: '账面净值',
      dataIndex: 'totalBookValue',
      key: 'totalBookValue',
      width: 150,
      render: value => (
        <Text type="success" strong>¥{(value || 0).toLocaleString()}</Text>
      ),
    },
    {
      title: '折旧率',
      dataIndex: 'depreciationRate',
      key: 'depreciationRate',
      width: 120,
      render: value => (
        <Progress
          percent={parseFloat(value) || 0}
          size="small"
          format={p => `${p}%`}
        />
      ),
    },
  ];

  const typeColumns = [
    {
      title: '资产类型',
      dataIndex: 'assetType',
      key: 'assetType',
    },
    {
      title: '资产数量',
      dataIndex: 'assetCount',
      key: 'assetCount',
      width: 100,
    },
    {
      title: '购置金额',
      dataIndex: 'totalPurchasePrice',
      key: 'totalPurchasePrice',
      width: 150,
      render: value => `¥${(value || 0).toLocaleString()}`,
    },
    {
      title: '累计折旧',
      dataIndex: 'totalAccumulatedDepreciation',
      key: 'totalAccumulatedDepreciation',
      width: 150,
      render: value => `¥${(value || 0).toLocaleString()}`,
    },
    {
      title: '账面净值',
      dataIndex: 'totalBookValue',
      key: 'totalBookValue',
      width: 150,
      render: value => (
        <Text type="success" strong>¥{(value || 0).toLocaleString()}</Text>
      ),
    },
    {
      title: '折旧率',
      dataIndex: 'depreciationRate',
      key: 'depreciationRate',
      width: 120,
      render: value => (
        <Progress
          percent={parseFloat(value) || 0}
          size="small"
          format={p => `${p}%`}
        />
      ),
    },
  ];

  const summary = depreciationData?.summary || {};

  const monthColumns = [
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      width: 120,
    },
    {
      title: '累计折旧',
      dataIndex: 'totalAccumulatedDepreciation',
      key: 'totalAccumulatedDepreciation',
      width: 160,
      render: value => `¥${(value || 0).toLocaleString()}`,
    },
    {
      title: '账面净值',
      dataIndex: 'totalBookValue',
      key: 'totalBookValue',
      width: 160,
      render: value => <Text type="success">¥{(value || 0).toLocaleString()}</Text>,
    },
    {
      title: '折旧率',
      dataIndex: 'averageDepreciationRate',
      key: 'averageDepreciationRate',
      width: 140,
      render: value => `${(value || 0).toFixed(2)}%`,
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title={
          <Space>
            <DollarOutlined />
            <span>资产折旧</span>
          </Space>
        }
        extra={
          <Space>
            <Select
              value={method}
              onChange={setMethod}
              style={{ width: 150 }}
              options={methodOptions}
            />
            <DatePicker
              value={asOfDate}
              onChange={value => setAsOfDate(value || dayjs())}
              allowClear={false}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                loadDepreciation();
                loadSummaryByDepartment();
                loadSummaryByType();
                loadSummaryByMonth();
              }}
              loading={loading || summaryLoading}
            >
              刷新
            </Button>
            <Button
              icon={<PrinterOutlined />}
              onClick={handlePrintReport}
            >
              打印报表
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
            >
              导出报表
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="资产总数"
                value={summary.totalAssets || 0}
                prefix={<BarChartOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="购置总金额"
                value={summary.totalPurchasePrice || 0}
                precision={2}
                prefix="¥"
                styles={{ content: { color: '#1890ff' } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="累计折旧"
                value={summary.totalAccumulatedDepreciation || 0}
                precision={2}
                prefix="¥"
                styles={{ content: { color: '#faad14' } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="账面总净值"
                value={summary.totalBookValue || 0}
                precision={2}
                prefix="¥"
                styles={{ content: { color: '#52c41a' } }}
              />
            </Card>
          </Col>
        </Row>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'summary',
              label: (
                <span>
                  <PieChartOutlined />
                  折旧汇总
                </span>
              ),
              children: (
                <Spin spinning={loading || summaryLoading}>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                      <Title level={5}>
                        <BarChartOutlined /> 按部门汇总
                      </Title>
                      <div className="hide-on-mobile">
                        <Table
                          dataSource={summaryByDept}
                          columns={deptColumns}
                          rowKey="departmentName"
                          size="small"
                          pagination={false}
                          scroll={{ x: 800 }}
                        />
                      </div>
                      <div className="mobile-table-cards show-on-mobile">
                        {summaryByDept.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>暂无数据</div>
                        ) : (
                          summaryByDept.map(item => (
                            <div key={item.departmentName} className="mobile-card-item">
                              <div className="mobile-card-header">
                                <span className="mobile-card-title">{item.departmentName || '-'}</span>
                              </div>
                              <div className="mobile-card-body">
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">资产数量</span>
                                  <span className="mobile-card-value">{item.assetCount ?? 0}</span>
                                </div>
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">折旧率</span>
                                  <span className="mobile-card-value">{parseFloat(item.depreciationRate || 0).toFixed(1)}%</span>
                                </div>
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">购置金额</span>
                                  <span className="mobile-card-value">¥{(item.totalPurchasePrice || 0).toLocaleString()}</span>
                                </div>
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">累计折旧</span>
                                  <span className="mobile-card-value" style={{ color: '#fa8c16' }}>¥{(item.totalAccumulatedDepreciation || 0).toLocaleString()}</span>
                                </div>
                                <div className="mobile-card-field mobile-card-field--full">
                                  <span className="mobile-card-label">账面净值</span>
                                  <span className="mobile-card-value" style={{ color: '#52c41a', fontWeight: 600 }}>¥{(item.totalBookValue || 0).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Title level={5}>
                        <PieChartOutlined /> 按类型汇总
                      </Title>
                      <div className="hide-on-mobile">
                        <Table
                          dataSource={summaryByType}
                          columns={typeColumns}
                          rowKey="assetType"
                          size="small"
                          pagination={false}
                          scroll={{ x: 800 }}
                        />
                      </div>
                      <div className="mobile-table-cards show-on-mobile">
                        {summaryByType.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>暂无数据</div>
                        ) : (
                          summaryByType.map(item => (
                            <div key={item.assetType} className="mobile-card-item">
                              <div className="mobile-card-header">
                                <span className="mobile-card-title">{item.assetType || '-'}</span>
                              </div>
                              <div className="mobile-card-body">
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">资产数量</span>
                                  <span className="mobile-card-value">{item.assetCount ?? 0}</span>
                                </div>
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">折旧率</span>
                                  <span className="mobile-card-value">{parseFloat(item.depreciationRate || 0).toFixed(1)}%</span>
                                </div>
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">购置金额</span>
                                  <span className="mobile-card-value">¥{(item.totalPurchasePrice || 0).toLocaleString()}</span>
                                </div>
                                <div className="mobile-card-field">
                                  <span className="mobile-card-label">累计折旧</span>
                                  <span className="mobile-card-value" style={{ color: '#fa8c16' }}>¥{(item.totalAccumulatedDepreciation || 0).toLocaleString()}</span>
                                </div>
                                <div className="mobile-card-field mobile-card-field--full">
                                  <span className="mobile-card-label">账面净值</span>
                                  <span className="mobile-card-value" style={{ color: '#52c41a', fontWeight: 600 }}>¥{(item.totalBookValue || 0).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Col>
                  </Row>
                </Spin>
              ),
            },
            {
              key: 'assets',
              label: (
                <span>
                  <DollarOutlined /> 资产明细
                </span>
              ),
              children: (
                <>
                  <div className="hide-on-mobile">
                    <Table
                      dataSource={depreciationData?.assets || []}
                      columns={assetColumns}
                      rowKey="id"
                      loading={loading}
                      pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: total => `共 ${total} 条`,
                      }}
                      scroll={{ x: 1400 }}
                    />
                  </div>
                  <div className="mobile-table-cards show-on-mobile">
                    {(depreciationData?.assets || []).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>暂无数据</div>
                    ) : (
                      (depreciationData?.assets || []).map(item => {
                        const dep = item.depreciation || {};
                        return (
                          <div key={item.id} className="mobile-card-item">
                            <div className="mobile-card-header">
                              <span className="mobile-card-title">{item.asset_name || item.asset_code || `#${item.id}`}</span>
                            </div>
                            <div className="mobile-card-body">
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">资产编号</span>
                                <span className="mobile-card-value">{item.asset_code || '-'}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">类型</span>
                                <span className="mobile-card-value">{item.asset_type || '-'}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">部门</span>
                                <span className="mobile-card-value">{item.department || '-'}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">购置金额</span>
                                <span className="mobile-card-value">¥{(dep.purchasePrice || 0).toLocaleString()}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">累计折旧</span>
                                <span className="mobile-card-value" style={{ color: '#fa8c16' }}>¥{(dep.accumulatedDepreciation || 0).toLocaleString()}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">账面净值</span>
                                <span className="mobile-card-value" style={{ color: '#52c41a', fontWeight: 600 }}>¥{(dep.currentBookValue || 0).toLocaleString()}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">已用/剩余</span>
                                <span className="mobile-card-value">
                                  {dep.monthsUsed || 0}月 / <Tag color={(dep.remainingMonths || 0) > 12 ? 'green' : (dep.remainingMonths || 0) > 6 ? 'orange' : 'red'} style={{ marginInline: 0 }}>{dep.remainingMonths || 0}月</Tag>
                                </span>
                              </div>
                              <div className="mobile-card-field mobile-card-field--full">
                                <span className="mobile-card-label">折旧率</span>
                                <span className="mobile-card-value">
                                  <Progress percent={parseFloat(dep.depreciationRate || 0)} size="small" status={parseFloat(dep.depreciationRate || 0) > 80 ? 'exception' : 'active'} />
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ),
            },
            {
              key: 'trend',
              label: (
                <span>
                  <BarChartOutlined /> 月度趋势
                </span>
              ),
              children: (
                <>
                  <div className="hide-on-mobile">
                    <Table
                      dataSource={summaryByMonth}
                      columns={monthColumns}
                      rowKey="month"
                      loading={summaryLoading}
                      pagination={false}
                      scroll={{ x: 640 }}
                    />
                  </div>
                  <div className="mobile-table-cards show-on-mobile">
                    {summaryByMonth.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>暂无数据</div>
                    ) : (
                      summaryByMonth.map(item => (
                        <div key={item.month} className="mobile-card-item">
                          <div className="mobile-card-header">
                            <span className="mobile-card-title">{item.month}</span>
                          </div>
                          <div className="mobile-card-body">
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">累计折旧</span>
                              <span className="mobile-card-value" style={{ color: '#fa8c16' }}>¥{(item.totalAccumulatedDepreciation || 0).toLocaleString()}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">账面净值</span>
                              <span className="mobile-card-value" style={{ color: '#52c41a', fontWeight: 600 }}>¥{(item.totalBookValue || 0).toLocaleString()}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">折旧率</span>
                              <span className="mobile-card-value">{parseFloat(item.averageDepreciationRate || 0).toFixed(2)}%</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default AssetDepreciation;
