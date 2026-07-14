import React from 'react';
import { Card, Alert, Divider, Typography } from 'antd';

const { Title, Paragraph, Text } = Typography;

const APIDocs = ({ apiBaseUrl }) => {
  return (
    <Card style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
      <Title level={3} style={{ color: '#1890ff' }}>
        区域定位API接口说明
      </Title>
      <Alert
        title="接口说明"
        description="此接口用于接收信标设备上报的位置信息，通过信标设备ID和位置编号自动更新关联资产的位置。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Divider titlePlacement="left" plain>
        调用链接
      </Divider>
      <Paragraph>
        <Text code copyable style={{ fontSize: '14px' }}>
          {apiBaseUrl}
        </Text>
      </Paragraph>

      <Divider titlePlacement="left" plain>
        调用方法
      </Divider>
      <Paragraph>
        <Text strong>HTTP方法：</Text> <Text code>POST</Text>
      </Paragraph>
      <Paragraph>
        <Text strong>Content-Type：</Text> <Text code>application/json</Text>
      </Paragraph>
      <Paragraph>
        <Text strong>认证方式：</Text> 无需认证（供外部设备调用）
      </Paragraph>

      <Divider titlePlacement="left" plain>
        请求数据格式
      </Divider>
      <Card size="small" style={{ marginBottom: 16, boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)' }}>
        <pre
          style={{
            background: '#f5f5f5',
            padding: '16px',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '14px',
            lineHeight: '1.5',
          }}
        >
          {JSON.stringify(
            {
              device_id: 'BEACON001',
              location_code: 'LOC001',
            },
            null,
            2
          )}
        </pre>
      </Card>

      <Divider titlePlacement="left" plain>
        响应数据格式
      </Divider>
      <Card size="small" style={{ marginBottom: 16, boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)' }}>
        <pre
          style={{
            background: '#f5f5f5',
            padding: '16px',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '14px',
            lineHeight: '1.5',
          }}
        >
          {JSON.stringify(
            {
              success: true,
              message: '位置更新成功',
              data: {
                asset_code: 'ASSET001',
                asset_name: '测试设备',
                location_code: 'LOC001',
                location_name: '一楼大厅',
                updated_at: '2024-01-01T12:00:00Z',
              },
            },
            null,
            2
          )}
        </pre>
      </Card>

      <Divider titlePlacement="left" plain>
        错误响应示例
      </Divider>
      <Card size="small" style={{ marginBottom: 16, boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)' }}>
        <pre
          style={{
            background: '#f5f5f5',
            padding: '16px',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '14px',
            lineHeight: '1.5',
          }}
        >
          {JSON.stringify(
            {
              success: false,
              message: '设备未关联资产',
              data: null,
            },
            null,
            2
          )}
        </pre>
      </Card>

      <Divider titlePlacement="left" plain>
        字段说明
      </Divider>
      <Paragraph>
        <Text strong>device_id：</Text> 信标设备唯一标识
      </Paragraph>
      <Paragraph>
        <Text strong>location_code：</Text> 位置编码，对应区域编码表中的编码
      </Paragraph>
      <Paragraph>
        <Text strong>asset_code：</Text> 资产编码，通过设备ID关联获取
      </Paragraph>
      <Paragraph>
        <Text strong>asset_name：</Text> 资产名称，通过资产编码获取
      </Paragraph>
      <Paragraph>
        <Text strong>location_name：</Text> 位置名称，通过位置编码获取
      </Paragraph>
      <Paragraph>
        <Text strong>updated_at：</Text> 更新时间，ISO 8601格式
      </Paragraph>
    </Card>
  );
};

export default APIDocs;
