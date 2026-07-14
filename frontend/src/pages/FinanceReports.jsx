import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tabs, Spin, message, Select, Space, Tag } from 'antd';
import {
  DollarOutlined, ArrowUpOutlined, ArrowDownOutlined,
  PieChartOutlined, FundOutlined, BankOutlined
} from '@ant-design/icons';
import { financeAPI } from '../utils/api';
import useIsMobile from '../hooks/useIsMobile';

const FinanceReports = () => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchReport();
  }, [selectedYear]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await financeAPI.getOverview({ year: selectedYear });
      if (res.success) setReportData(res.data);
    } catch (e) {
      message.error('获取报表失败');
    } finally {
      setLoading(false);
    }
  };

  const yearOptions = [];
  for (let y = new Date().getFullYear(); y >= 2020; y--) {
    yearOptions.push({ value: y, label: `${y}年` });
  }

  // 收支总额
  const totalIncome = (reportData?.transactionSummary || [])
    .filter(t => t.transaction_type === 'income')
    .reduce((s, t) => s + Number(t.total_amount || 0), 0);
  const totalExpense = (reportData?.transactionSummary || [])
    .filter(t => t.transaction_type === 'expense')
    .reduce((s, t) => s + Number(t.total_amount || 0), 0);
  const netAmount = totalIncome - totalExpense;

  // 预算汇总
  const totalBudget = (reportData?.budgetSummary || [])
    .reduce((s, t) => s + Number(t.total_budget || 0), 0);
  const totalBudgetActual = (reportData?.budgetSummary || [])
    .reduce((s, t) => s + Number(t.total_actual || 0), 0);

  // 资产总价值
  const totalAssetValue = (reportData?.depreciationByDept || [])
    .reduce((s, d) => s + Number(d.total_value || 0), 0);

  const depreciationColumns = [
    { title: '部门', dataIndex: 'dept_name', key: 'dept_name' },
    { title: '资产数量', dataIndex: 'asset_count', key: 'asset_count', align: 'right' },
    {
      title: '总价值(元)', dataIndex: 'total_value', key: 'total_value', align: 'right',
      render: v => `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
    },
  ];

  const budgetColumns = [
    { title: '预算类型', dataIndex: 'budget_type', key: 'budget_type',
      render: v => {
        const labels = { equipment_procurement: '设备采购', maintenance: '维修维护', operation: '运营', other: '其他' };
        return labels[v] || v;
      }
    },
    { title: '预算金额', dataIndex: 'total_budget', key: 'total_budget', align: 'right',
      render: v => `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
    },
    { title: '实际执行', dataIndex: 'total_actual', key: 'total_actual', align: 'right',
      render: v => `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
    },
    {
      title: '执行率', key: 'rate',
      render: (_, r) => {
        const rate = r.total_budget > 0 ? ((r.total_actual / r.total_budget) * 100).toFixed(1) : 0;
        return <Tag color={rate > 100 ? 'red' : rate > 80 ? 'green' : 'orange'}>{rate}%</Tag>;
      }
    },
  ];

  const trendColumns = [
    { title: '月份', dataIndex: 'month', key: 'month' },
    {
      title: '收入', key: 'income', align: 'right',
      render: (_, r) => r.transaction_type === 'income'
        ? `¥${Number(r.total_amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'
    },
    {
      title: '支出', key: 'expense', align: 'right',
      render: (_, r) => r.transaction_type === 'expense'
        ? `¥${Number(r.total_amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'
    },
  ];

  return (
    <div style={{ padding: isMobile ? 8 : 16 }}>
      <Card
        title={<Space><FundOutlined /><span>财务报表</span></Space>}
        extra={
          <Select value={selectedYear} onChange={setSelectedYear} options={yearOptions} style={{ width: 100 }} size={isMobile ? 'small' : 'middle'} />
        }
      >
        <Spin spinning={loading}>
          {/* 核心指标卡片 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="资产总值"
                  value={totalAssetValue}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#1677ff' }}
                  suffix={<BankOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title={`${selectedYear}年预算总额`}
                  value={totalBudget}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="总收入"
                  value={totalIncome}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#52c41a' }}
                  suffix={<ArrowUpOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="总支出"
                  value={totalExpense}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#ff4d4f' }}
                  suffix={<ArrowDownOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {/* 净收支 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={24}>
              <Card size="small">
                <Statistic
                  title="净收支"
                  value={netAmount}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: netAmount >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 28 }}
                  suffix={<Tag color={netAmount >= 0 ? 'green' : 'red'}>{netAmount >= 0 ? '盈余' : '赤字'}</Tag>}
                />
              </Card>
            </Col>
          </Row>

          {/* Tab 详情 */}
          <Tabs destroyOnHidden items={[
            {
              key: 'depreciation',
              label: <span><BankOutlined /> 资产折旧汇总</span>,
              children: (
                <Table
                  dataSource={reportData?.depreciationByDept || []}
                  columns={depreciationColumns}
                  rowKey="dept_name"
                  pagination={false}
                  size="small"
                  summary={() => (
                    <Table.Summary.Row>
                      <Table.Summary.Cell><strong>合计</strong></Table.Summary.Cell>
                      <Table.Summary.Cell align="right">
                        <strong>{(reportData?.depreciationByDept || []).reduce((s, d) => s + (d.asset_count || 0), 0)}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell align="right">
                        <strong>¥{totalAssetValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</strong>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                />
              ),
            },
            {
              key: 'budget',
              label: <span><PieChartOutlined /> 预算执行</span>,
              children: (
                <Table
                  dataSource={reportData?.budgetSummary || []}
                  columns={budgetColumns}
                  rowKey="budget_type"
                  pagination={false}
                  size="small"
                  summary={() => (
                    <Table.Summary.Row>
                      <Table.Summary.Cell><strong>合计</strong></Table.Summary.Cell>
                      <Table.Summary.Cell align="right">
                        <strong>¥{totalBudget.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell align="right">
                        <strong>¥{totalBudgetActual.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        <Tag color={totalBudget > 0 && totalBudgetActual / totalBudget > 0.8 ? 'green' : 'orange'}>
                          {totalBudget > 0 ? ((totalBudgetActual / totalBudget) * 100).toFixed(1) : 0}%
                        </Tag>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                />
              ),
            },
            {
              key: 'transaction',
              label: <span><DollarOutlined /> 收支趋势</span>,
              children: (
                <Table
                  dataSource={reportData?.transactionTrend || []}
                  columns={trendColumns}
                  rowKey={(r) => r.month + r.transaction_type}
                  pagination={false}
                  size="small"
                />
              ),
            },
          ]} />
        </Spin>
      </Card>
    </div>
  );
};

export default FinanceReports;
