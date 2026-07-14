import React from 'react';
import { Card, Row, Col } from 'antd';
import { Pie, Cell } from 'recharts';

const DeviceStats = ({ deviceStats, isMobile }) => {
  return (
    <Card
      title="设备状态统计"
      size="small"
      style={{
        marginBottom: isMobile ? 12 : 16,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      }}
    >
      <Row gutter={[isMobile ? 16 : 24, isMobile ? 16 : 24]}>
        <Col span={isMobile ? 24 : 12}>
          <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
            <Col span={isMobile ? 12 : 6}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                  {deviceStats.total}
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>总设备数</div>
              </div>
            </Col>
            <Col span={isMobile ? 12 : 6}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px',
                  backgroundColor: '#f6ffed',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                  {deviceStats.online}
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>在线设备</div>
              </div>
            </Col>
            <Col span={isMobile ? 12 : 6}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8c8c8c' }}>
                  {deviceStats.offline}
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>离线设备</div>
              </div>
            </Col>
            <Col span={isMobile ? 12 : 6}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px',
                  backgroundColor: '#fff1f0',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                  {deviceStats.fault}
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>故障设备</div>
              </div>
            </Col>
            <Col span={24}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px',
                  backgroundColor: '#fffbe6',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                  {deviceStats.maintenance}
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>维护中设备</div>
              </div>
            </Col>
          </Row>
        </Col>
        <Col span={isMobile ? 24 : 12}>
          <div style={{ height: '250px' }}>
            <Pie
              data={[
                { name: '在线', value: deviceStats.online, color: '#52c41a' },
                { name: '离线', value: deviceStats.offline, color: '#8c8c8c' },
                { name: '故障', value: deviceStats.fault, color: '#ff4d4f' },
                { name: '维护中', value: deviceStats.maintenance, color: '#faad14' },
              ].filter(item => item.value > 0)}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {[
                { name: '在线', value: deviceStats.online, color: '#52c41a' },
                { name: '离线', value: deviceStats.offline, color: '#8c8c8c' },
                { name: '故障', value: deviceStats.fault, color: '#ff4d4f' },
                { name: '维护中', value: deviceStats.maintenance, color: '#faad14' },
              ]
                .filter(item => item.value > 0)
                .map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
            </Pie>
          </div>
        </Col>
      </Row>
    </Card>
  );
};

export default DeviceStats;
