/**
 * 开机率管理仪表盘
 */

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Progress, Spin, Tag, Empty } from 'antd';
import { DashboardOutlined } from '@ant-design/icons';
import { uptimeAPI } from '../../../utils/api';
import useIsMobile from '../../../hooks/useIsMobile';

const UptimeDashboard = () => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    overall: { avg_rate: 0, total_assets: 0 },
    byDepartment: [],
    trend: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await uptimeAPI.getDashboard();
      if (response?.success && response.data) {
        setData(response.data);
      }
    } catch (error) {
      console.warn('加载数据失败:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: '部门', dataIndex: 'department', key: 'department' },
    { title: '开机率', dataIndex: 'rate', key: 'rate', render: (v) => <Progress percent={parseFloat(v).toFixed(1)} size="small" /> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1><DashboardOutlined /> 开机率管理</h1>
      <Spin spinning={loading}>
        <Row gutter={16} style={{ marginTop: 24 }}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="整体开机率"
                value={parseFloat(data.overall.avg_rate || 0).toFixed(1)}
                suffix="%"
                styles={{ content: { color: parseFloat(data.overall.avg_rate) >= 95 ? '#3f8600' : parseFloat(data.overall.avg_rate) >= 90 ? '#faad14' : '#cf1322' } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card><Statistic title="统计设备数" value={data.overall.total_assets || 0} suffix="台" /></Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="运行状态"
                value={parseFloat(data.overall.avg_rate || 0) >= 95 ? '优秀' : parseFloat(data.overall.avg_rate || 0) >= 90 ? '良好' : '需关注'}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginTop: 24 }}>
          <Col xs={24} lg={12}>
            <Card title="部门开机率">
              <div className="hide-on-mobile">
                <Table columns={columns} dataSource={data.byDepartment} rowKey="department" pagination={false} />
              </div>
              <div className="mobile-table-cards show-on-mobile">
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
                ) : Array.isArray(data.byDepartment) && data.byDepartment.length > 0 ? (
                  data.byDepartment.map(record => {
                    const rate = parseFloat(record.rate || 0);
                    const color = rate >= 99 ? 'success' : rate >= 95 ? 'processing' : rate >= 90 ? 'warning' : 'error';
                    const text = rate >= 99 ? '优秀' : rate >= 95 ? '良好' : rate >= 90 ? '警告' : '危险';
                    return (
                      <div key={record.department} className="mobile-card-item">
                        <div className="mobile-card-header">
                          <span className="mobile-card-title">{record.department}</span>
                          <Tag color={color}>{text}</Tag>
                        </div>
                        <div className="mobile-card-body">
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">开机率</span>
                            <span className="mobile-card-value">{rate.toFixed(1)}%</span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">进度</span>
                            <span className="mobile-card-value">
                              <Progress percent={rate.toFixed(1)} size="small" />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <Empty description="暂无数据" />
                )}
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="历史趋势">
              <div style={{ padding: 20 }}>
                {data.trend.map((item, index) => (
                  <div key={index} style={{ marginBottom: 8 }}>
                    <span style={{ display: 'inline-block', width: 80 }}>{item.period}</span>
                    <Progress percent={parseFloat(item.rate).toFixed(1)} size="small" style={{ width: 200 }} />
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default UptimeDashboard;
