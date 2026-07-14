/**
 * Dashboard - 最近新增资产组件
 * 展示最近录入的资产列表，便于快速查看
 */
import React from 'react';
import { Card, Button, Table, Tag, Empty } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import useIsMobile from '../../hooks/useIsMobile';

const formatValue = (value) => {
  if (!value && value !== 0) return '-';
  return Number(value).toLocaleString('zh-CN');
};

const getStatusTag = (status) => {
  const map = {
    '在用': { color: 'success', text: '在用' },
    '闲置': { color: 'default', text: '闲置' },
    '维修': { color: 'warning', text: '维修' },
    '报废': { color: 'error', text: '报废' },
    '调配中': { color: 'processing', text: '调配中' },
  };
  return map[status] || { color: 'default', text: status || '-' };
};

const DashboardRecentAssets = ({ recentAssets, loading, onNavigate }) => {
  const isMobile = useIsMobile();
  const columns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
      ellipsis: true,
      render: (text, record) => (
        <a onClick={() => onNavigate?.(`/assets/${record.id || record.asset_code}`)}>
          {text || record.asset_code || '-'}
        </a>
      ),
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: status => {
        const tag = getStatusTag(status);
        return <Tag color={tag.color}>{tag.text}</Tag>;
      },
    },
    {
      title: '购置价格',
      dataIndex: 'purchase_price',
      key: 'purchase_price',
      width: 110,
      align: 'right',
      render: val => `¥${formatValue(val)}`,
    },
    {
      title: '录入时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: date => {
        if (!date) return '-';
        const d = dayjs(date);
        const now = dayjs();
        const diffHours = now.diff(d, 'hour');
        if (diffHours < 1) return '刚刚';
        if (diffHours < 24) return `${diffHours}小时前`;
        if (diffHours < 24 * 7) return `${Math.floor(diffHours / 24)}天前`;
        return d.format('YYYY-MM-DD');
      },
    },
  ];

  return (
    <Card
      className="recent-assets-panel"
      loading={loading}
      extra={
        <Button
          type="primary"
          size="small"
          onClick={() => onNavigate?.('/assets')}
        >
          查看全部
        </Button>
      }
    >
      <div className="chart-panel-header" style={{ marginBottom: 10 }}>
        <ClockCircleOutlined className="chart-panel-icon" />
        <h3 className="chart-panel-title">最近新增资产</h3>
        <span className="chart-panel-total">最新录入的设备记录</span>
      </div>

      <div className="hide-on-mobile">
        <Table
          dataSource={recentAssets}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无最近资产数据' }}
          scroll={{ x: 600 }}
        />
      </div>

      <div className="mobile-table-cards show-on-mobile">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
        ) : Array.isArray(recentAssets) && recentAssets.length > 0 ? (
          recentAssets.map(record => {
            const tag = getStatusTag(record.status);
            const formatCreatedAt = (date) => {
              if (!date) return '-';
              const d = dayjs(date);
              const now = dayjs();
              const diffHours = now.diff(d, 'hour');
              if (diffHours < 1) return '刚刚';
              if (diffHours < 24) return `${diffHours}小时前`;
              if (diffHours < 24 * 7) return `${Math.floor(diffHours / 24)}天前`;
              return d.format('YYYY-MM-DD');
            };
            return (
              <div key={record.id || record.asset_code} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.asset_name || '-'}</span>
                  <Tag color={tag.color}>{tag.text}</Tag>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">资产编号</span>
                    <span className="mobile-card-value">{record.asset_code || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">购置价格</span>
                    <span className="mobile-card-value">¥{formatValue(record.purchase_price)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">录入时间</span>
                    <span className="mobile-card-value">{formatCreatedAt(record.created_at)}</span>
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
  );
};

export default DashboardRecentAssets;
