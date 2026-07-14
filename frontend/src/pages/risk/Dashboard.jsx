/**
 * 风险管理仪表盘
 * 符合 ISO 14971:2019《医疗器械风险管理》标准
 * 响应式设计适配移动端和桌面端
 */

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Spin, message, Alert, Progress, Typography, Empty } from 'antd';
import { WarningOutlined, AlertOutlined, ClockCircleOutlined, SafetyOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { riskAPI } from '../../utils/api';
import useIsMobile from '../../hooks/useIsMobile';

const { Title, Text } = Typography;

const RISK_LEVEL_CONFIG = {
  critical: { label: '灾难性', color: 'purple', bgColor: '#722ed1' },
  high: { label: '高风险', color: 'red', bgColor: '#cf1322' },
  medium: { label: '中风险', color: 'orange', bgColor: '#fa8c16' },
  low: { label: '低风险', color: 'green', bgColor: '#3f8600' },
};

const COL_RESPONSIVE = { xs: 24, sm: 12, md: 8, lg: 6, xl: 6 };
const COL_HALF = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };

const RiskDashboard = () => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await riskAPI.getDashboardStats();
      if (response?.success) {
        setDashboardData(response.data);
      } else {
        setError(response?.message || '加载数据失败');
      }
    } catch (_error) {
      setError('加载风险仪表盘失败');
    } finally {
      setLoading(false);
    }
  };

  const renderRiskTag = (level) => {
    const config = RISK_LEVEL_CONFIG[level] || RISK_LEVEL_CONFIG.low;
    return <Tag color={config.color}>{config.label}</Tag>;
  };

  const recentColumns = [
    { title: '资产', dataIndex: 'asset_name', key: 'asset_name', render: (text, record) => text || record.asset_code, ellipsis: true },
    { title: '风险等级', dataIndex: 'risk_level', key: 'risk_level', render: renderRiskTag, width: 100 },
    { title: '评分', dataIndex: 'risk_score', key: 'risk_score', width: 80 },
    { title: '评估日期', dataIndex: 'assessment_date', key: 'assessment_date', width: 120, ellipsis: true },
  ];

  const highRiskColumns = [
    { title: '资产', dataIndex: 'asset_name', key: 'asset_name', render: (text, record) => text || record.asset_code, ellipsis: true },
    { title: '类型', dataIndex: 'asset_type', key: 'asset_type', width: 100, ellipsis: true },
    { title: '风险等级', dataIndex: 'risk_level', key: 'risk_level', render: renderRiskTag, width: 100 },
    { title: '评分', dataIndex: 'risk_score', key: 'risk_score', width: 80 },
    { title: '下次复评', dataIndex: 'next_assessment_date', key: 'next_assessment_date', width: 120, ellipsis: true },
  ];

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <Alert title="加载失败" description={error} type="error" showIcon />
      </div>
    );
  }

  const overview = dashboardData?.overview || { total: 0, critical: 0, high: 0, medium: 0, low: 0 };

  return (
    <div style={{ padding: 12 }}>
      <Title level={4} style={{ marginBottom: 8 }}><WarningOutlined /> 风险管理仪表盘</Title>
      <Text type="secondary" style={{ fontSize: 12 }}>符合 ISO 14971:2019 标准</Text>

      <Spin spinning={loading} description="加载中...">
        {/* 风险警示 */}
        {(dashboardData?.pending_risks > 0 || dashboardData?.overdue_reviews > 0) && (
          <Alert
            title={`需要关注：${dashboardData.pending_risks}个高风险资产待处理，${dashboardData.overdue_reviews}个评估已过期`}
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
          />
        )}

        {/* 概览统计 - 第一行 */}
        <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
          <Col {...COL_RESPONSIVE}>
            <Card size="small" hoverable>
              <Statistic
                title="总评估数"
                value={overview.total}
                prefix={<SafetyOutlined />}
              />
            </Card>
          </Col>
          <Col {...COL_RESPONSIVE}>
            <Card size="small" hoverable>
              <Statistic
                title="灾难性"
                value={overview.critical}
                styles={{ content: { color: '#722ed1' } }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
          <Col {...COL_RESPONSIVE}>
            <Card size="small" hoverable>
              <Statistic
                title="高风险"
                value={overview.high}
                styles={{ content: { color: '#cf1322' } }}
                prefix={<AlertOutlined />}
              />
            </Card>
          </Col>
          <Col {...COL_RESPONSIVE}>
            <Card size="small" hoverable>
              <Statistic
                title="中风险"
                value={overview.medium}
                styles={{ content: { color: '#fa8c16' } }}
              />
            </Card>
          </Col>
        </Row>

        {/* 概览统计 - 第二行 */}
        <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
          <Col {...COL_RESPONSIVE}>
            <Card size="small" hoverable>
              <Statistic
                title="低风险"
                value={overview.low}
                styles={{ content: { color: '#3f8600' } }}
              />
            </Card>
          </Col>
          <Col {...COL_RESPONSIVE}>
            <Card size="small" hoverable>
              <Statistic
                title="本月新增"
                value={dashboardData?.this_month_assessments || 0}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col {...COL_RESPONSIVE}>
            <Card size="small" hoverable>
              <Statistic
                title="待复评(30天)"
                value={dashboardData?.upcoming_reviews || 0}
                styles={{ content: { color: '#fa8c16' } }}
              />
            </Card>
          </Col>
          <Col {...COL_RESPONSIVE}>
            <Card size="small" hoverable>
              <Statistic
                title="已过期复评"
                value={dashboardData?.overdue_reviews || 0}
                styles={{ content: { color: '#cf1322' } }}
              />
            </Card>
          </Col>
        </Row>

        {/* 风险分布 & 高风险资产 */}
        <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
          <Col {...COL_HALF}>
            <Card title="风险等级分布" size="small">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(RISK_LEVEL_CONFIG).map(([level, config]) => {
                  const count = overview[level] || 0;
                  const percent = overview.total > 0 ? (count / overview.total * 100) : 0;
                  return (
                    <div key={level}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text style={{ fontSize: 12 }}>{config.label}</Text>
                        <Text strong style={{ fontSize: 12 }}>{count} ({percent.toFixed(1)}%)</Text>
                      </div>
                      <Progress percent={percent} showInfo={false} strokeColor={config.bgColor} size="small" />
                    </div>
                  );
                })}
              </div>
            </Card>
          </Col>
          <Col {...COL_HALF}>
            <Card title="高风险资产" size="small">
              <div className="hide-on-mobile">
                <Table
                  size="small"
                  dataSource={(dashboardData?.high_risk_assets || []).slice(0, 5)}
                  columns={[
                    { title: '资产', dataIndex: 'asset_name', key: 'asset_name', render: (text) => text || '-', ellipsis: true },
                    { title: '等级', dataIndex: 'risk_level', key: 'risk_level', render: renderRiskTag, width: 70 },
                  ]}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: '暂无高风险资产' }}
                />
              </div>
              <div className="mobile-table-cards show-on-mobile">
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                ) : Array.isArray(dashboardData?.high_risk_assets) && dashboardData.high_risk_assets.length > 0 ? (
                  dashboardData.high_risk_assets.slice(0, 5).map(record => (
                    <div key={record.id} className="mobile-card-item">
                      <div className="mobile-card-header">
                        <span className="mobile-card-title">{record.asset_name || record.asset_code || '-'}</span>
                        {renderRiskTag(record.risk_level)}
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty description="暂无高风险资产" />
                )}
              </div>
            </Card>
          </Col>
        </Row>

        {/* 近期评估记录 */}
        <Card title="近期评估记录" size="small" style={{ marginTop: 16 }}>
          <div className="hide-on-mobile">
            <Table
              columns={recentColumns}
              dataSource={dashboardData?.recent_assessments || []}
              rowKey="id"
              pagination={{ pageSize: 5, size: 'small' }}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: '暂无评估记录' }}
            />
          </div>
          <div className="mobile-table-cards show-on-mobile">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
            ) : Array.isArray(dashboardData?.recent_assessments) && dashboardData.recent_assessments.length > 0 ? (
              dashboardData.recent_assessments.slice(0, 5).map(record => (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{record.asset_name || record.asset_code || '-'}</span>
                    {renderRiskTag(record.risk_level)}
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">评分</span>
                      <span className="mobile-card-value">{record.risk_score ?? '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">评估日期</span>
                      <span className="mobile-card-value">{record.assessment_date || '-'}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <Empty description="暂无评估记录" />
            )}
          </div>
        </Card>

        {/* 高风险资产详情 */}
        <Card title="高风险资产详情" size="small" style={{ marginTop: 16 }}>
          <div className="hide-on-mobile">
            <Table
              columns={highRiskColumns}
              dataSource={dashboardData?.high_risk_assets || []}
              rowKey="id"
              pagination={{ pageSize: 5, size: 'small' }}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: '暂无高风险资产' }}
            />
          </div>
          <div className="mobile-table-cards show-on-mobile">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
            ) : Array.isArray(dashboardData?.high_risk_assets) && dashboardData.high_risk_assets.length > 0 ? (
              dashboardData.high_risk_assets.slice(0, 5).map(record => (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{record.asset_name || record.asset_code || '-'}</span>
                    {renderRiskTag(record.risk_level)}
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">类型</span>
                      <span className="mobile-card-value">{record.asset_type || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">评分</span>
                      <span className="mobile-card-value">{record.risk_score ?? '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">下次复评</span>
                      <span className="mobile-card-value">{record.next_assessment_date || '-'}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <Empty description="暂无高风险资产" />
            )}
          </div>
        </Card>
      </Spin>
    </div>
  );
};

export default RiskDashboard;
