/**
 * 巡检统计分析
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, DatePicker, Spin, Table, Tag, Space, Empty,
} from 'antd';
import {
  ReconciliationOutlined, CheckCircleOutlined, WarningOutlined,
  AlertOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  BarChartOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { inspectionAPI } from '../../utils/api';
import dayjs from 'dayjs';
import useIsMobile from '../../hooks/useIsMobile';

const { RangePicker } = DatePicker;

const inspectionTypeMap = {
  daily: '日常巡检', weekly: '周巡检', monthly: '月巡检',
  quarterly: '季巡检', special: '专项巡检',
};

const issueStatusMap = {
  open: { label: '待处理', color: 'error' },
  in_progress: { label: '整改中', color: 'processing' },
  resolved: { label: '已整改', color: 'warning' },
  verified: { label: '已验证', color: 'success' },
  deferred: { label: '暂缓', color: 'default' },
};

const riskLevelMap = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'blue' },
};

const InspectionStatistics = () => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await inspectionAPI.getStatistics(params);
      if (res?.success) {
        setStats(res.data);
      }
    } catch (_e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const taskCompletionRate = stats?.tasks
    ? stats.tasks.total_tasks > 0
      ? ((stats.tasks.completed_tasks / stats.tasks.total_tasks) * 100).toFixed(1)
      : '0.0'
    : '0.0';

  const issueCloseRate = stats?.issues
    ? stats.issues.total_issues > 0
      ? (((stats.issues.resolved_issues + stats.issues.verified_issues) / stats.issues.total_issues) * 100).toFixed(1)
      : '0.0'
    : '0.0';

  const typeColumns = [
    {
      title: '巡检类型', dataIndex: 'inspection_type', width: 150,
      render: v => inspectionTypeMap[v] || v,
    },
    { title: '记录单数', dataIndex: 'count', width: 120 },
    {
      title: '异常数', dataIndex: 'abnormal_count', width: 120,
      render: v => <Tag color={v > 0 ? 'error' : 'success'}>{v}</Tag>,
    },
    {
      title: '异常率', width: 120,
      render: (_, r) => r.count > 0 ? `${((r.abnormal_count / r.count) * 100).toFixed(1)}%` : '-',
    },
  ];

  const trendColumns = [
    { title: '日期', dataIndex: 'date', width: 150 },
    { title: '巡检数', dataIndex: 'count', width: 100 },
    {
      title: '异常数', dataIndex: 'abnormal_count', width: 100,
      render: v => <Tag color={v > 0 ? 'error' : 'success'}>{v}</Tag>,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={<span><BarChartOutlined /> 巡检统计分析</span>}
        extra={
          <RangePicker
            value={dateRange}
            onChange={v => setDateRange(v)}
            style={{ width: isMobile ? '100%' : 'auto' }}
            presets={{
              '近7天': [dayjs().subtract(7, 'day'), dayjs()],
              '近30天': [dayjs().subtract(30, 'day'), dayjs()],
              '近90天': [dayjs().subtract(90, 'day'), dayjs()],
              '本月': [dayjs().startOf('month'), dayjs().endOf('month')],
            }}
          />
        }
        style={{ marginBottom: 16 }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : stats ? (
          <>
            {/* 任务统计 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small">
                  <Statistic title="任务总数" value={stats.tasks?.total_tasks || 0} prefix={<ReconciliationOutlined />} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small">
                  <Statistic title="已完成" value={stats.tasks?.completed_tasks || 0}
                    styles={{ content: { color: '#52c41a' } }} prefix={<CheckCircleOutlined />} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small">
                  <Statistic title="待巡检" value={stats.tasks?.pending_tasks || 0}
                    styles={{ content: { color: '#1890ff' } }} prefix={<ClockCircleOutlined />} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small">
                  <Statistic title="已逾期" value={stats.tasks?.overdue_tasks || 0}
                    styles={{ content: { color: '#ff4d4f' } }} prefix={<WarningOutlined />} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small">
                  <Statistic title="完成率" value={taskCompletionRate} suffix="%"
                    styles={{ content: { color: '#1890ff' } }} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small">
                  <Statistic title="巡检中" value={stats.tasks?.in_progress_tasks || 0}
                    styles={{ content: { color: '#faad14' } }} prefix={<ExclamationCircleOutlined />} />
                </Card>
              </Col>
            </Row>

            {/* 记录单统计 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={12} sm={6}>
                <Card size="small">
                  <Statistic title="记录单总数" value={stats.records?.total_records || 0} prefix={<FileTextOutlined />} />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small">
                  <Statistic title="正常" value={stats.records?.normal_records || 0}
                    styles={{ content: { color: '#52c41a' } }} prefix={<CheckCircleOutlined />} />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small">
                  <Statistic title="异常" value={stats.records?.abnormal_records || 0}
                    styles={{ content: { color: '#ff4d4f' } }} prefix={<WarningOutlined />} />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small">
                  <Statistic title="需关注" value={stats.records?.attention_records || 0}
                    styles={{ content: { color: '#faad14' } }} prefix={<ExclamationCircleOutlined />} />
                </Card>
              </Col>
            </Row>

            {/* 问题统计 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small">
                  <Statistic title="问题总数" value={stats.issues?.total_issues || 0} prefix={<AlertOutlined />} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small">
                  <Statistic title="待处理" value={stats.issues?.open_issues || 0}
                    styles={{ content: { color: '#ff4d4f' } }} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small">
                  <Statistic title="整改中" value={stats.issues?.in_progress_issues || 0}
                    styles={{ content: { color: '#1890ff' } }} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small">
                  <Statistic title="已验证" value={stats.issues?.verified_issues || 0}
                    styles={{ content: { color: '#52c41a' } }} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small">
                  <Statistic title="高风险" value={stats.issues?.high_risk_issues || 0}
                    styles={{ content: { color: '#ff4d4f' } }} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small">
                  <Statistic title="闭环率" value={issueCloseRate} suffix="%"
                    styles={{ content: { color: '#52c41a' } }} />
                </Card>
              </Col>
            </Row>

            {/* 分类统计与趋势 */}
            <Row gutter={16}>
              <Col xs={24} lg={12}>
                <Card title="按巡检类型统计" size="small">
                  <div className="hide-on-mobile">
                    <Table
                      rowKey="inspection_type"
                      size="small"
                      columns={typeColumns}
                      dataSource={stats.by_type || []}
                      pagination={false}
                    />
                  </div>
                  <div className="mobile-table-cards show-on-mobile">
                    {Array.isArray(stats.by_type) && stats.by_type.length > 0 ? (
                      stats.by_type.map(r => (
                        <div key={r.inspection_type || r.date} className="mobile-card-item">
                          <div className="mobile-card-header">
                            <span className="mobile-card-title">{inspectionTypeMap[r.inspection_type] || r.inspection_type || '-'}</span>
                            <Tag color={r.abnormal_count > 0 ? 'error' : 'success'}>{`异常 ${r.abnormal_count || 0}`}</Tag>
                          </div>
                          <div className="mobile-card-body">
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">记录单数</span>
                              <span className="mobile-card-value">{r.count || 0}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">异常数</span>
                              <span className="mobile-card-value">{r.abnormal_count || 0}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">异常率</span>
                              <span className="mobile-card-value">
                                {r.count > 0 ? `${((r.abnormal_count / r.count) * 100).toFixed(1)}%` : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <Empty description="暂无数据" />
                    )}
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card title="近30天巡检趋势" size="small">
                  <div className="hide-on-mobile">
                    <Table
                      rowKey="date"
                      size="small"
                      columns={trendColumns}
                      dataSource={stats.trend || []}
                      pagination={{ pageSize: 10, size: 'small' }}
                    />
                  </div>
                  <div className="mobile-table-cards show-on-mobile">
                    {Array.isArray(stats.trend) && stats.trend.length > 0 ? (
                      stats.trend.map(r => (
                        <div key={r.date} className="mobile-card-item">
                          <div className="mobile-card-header">
                            <span className="mobile-card-title">{r.date || '-'}</span>
                            <Tag color={r.abnormal_count > 0 ? 'error' : 'success'}>{`异常 ${r.abnormal_count || 0}`}</Tag>
                          </div>
                          <div className="mobile-card-body">
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">巡检数</span>
                              <span className="mobile-card-value">{r.count || 0}</span>
                            </div>
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">异常数</span>
                              <span className="mobile-card-value">{r.abnormal_count || 0}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <Empty description="暂无数据" />
                    )}
                  </div>
                </Card>
              </Col>
            </Row>
          </>
        ) : (
          <Empty description="暂无数据" />
        )}
      </Card>
    </div>
  );
};

export default InspectionStatistics;
