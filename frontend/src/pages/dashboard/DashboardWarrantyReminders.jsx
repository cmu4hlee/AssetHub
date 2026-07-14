/**
 * Dashboard - 保修提醒组件
 * 整合 assets 表保修数据 + warranty_info 表保修数据
 */
import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../../hooks';
import { Card, Table, Button, Tag, Empty, Statistic, Row, Col, Space } from 'antd';
import { WarningOutlined, SafetyCertificateOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { warrantyAPI } from '../../utils/api';

const getWarrantyStatus = (expiryDate) => {
  if (!expiryDate) return { color: 'default', text: '未知' };
  const now = dayjs();
  const expiry = dayjs(expiryDate);
  const daysLeft = expiry.diff(now, 'day');
  if (daysLeft < 0) return { color: 'red', text: '已过期' };
  if (daysLeft <= 30) return { color: 'red', text: `${daysLeft}天后到期` };
  if (daysLeft <= 90) return { color: 'orange', text: `${daysLeft}天后到期` };
  return { color: 'green', text: `${daysLeft}天后到期` };
};

const DashboardWarrantyReminders = ({ expiringWarranties, onNavigate }) => {
  const isMobile = useIsMobile();
  const [warrantyStats, setWarrantyStats] = useState(null);
  const [expiringFromWarranty, setExpiringFromWarranty] = useState([]);

  useEffect(() => {
    // 获取保修统计和到期检查
    const fetchData = async () => {
      try {
        const [statsResult, checkResult] = await Promise.all([
          warrantyAPI.getStatistics(),
          warrantyAPI.checkExpiringWarranties(),
        ]);
        if (statsResult?.success !== false) {
          setWarrantyStats(statsResult?.data || statsResult);
        }
        const checkData = checkResult?.data || checkResult;
        const combined = [
          ...(checkData?.warranty_info_expiring || []),
          ...(checkData?.assets_expiring || []).map(a => ({
            ...a,
            end_date: a.warranty_end_date,
            supplier_name: null,
          })),
        ];
        setExpiringFromWarranty(combined);
      } catch (error) {
        // 仪表盘组件静默失败，不影响主页面
        console.error('获取保修数据失败:', error);
      }
    };
    fetchData();
  }, []);

  // 合并旧数据和新API数据
  const allExpiring = [
    ...(expiringWarranties || []).map(w => ({
      asset_code: w.asset_code,
      asset_name: w.asset_name,
      warranty_expiry_date: w.warranty_expiry_date || w.warranty_end_date,
      supplier: w.supplier || w.supplier_name,
      responsible_person: w.responsible_person,
      source: 'assets',
    })),
    ...expiringFromWarranty.map(w => ({
      asset_code: w.asset_code,
      asset_name: w.asset_name,
      warranty_expiry_date: w.end_date || w.warranty_end_date,
      supplier: w.supplier_name,
      responsible_person: null,
      source: 'warranty_info',
    })),
  ];

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 150,
      ellipsis: true,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '保修截止',
      dataIndex: 'warranty_expiry_date',
      key: 'warranty_expiry_date',
      width: 120,
      render: date => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '剩余天数',
      key: 'days_left',
      width: 120,
      render: (_, record) => {
        const status = getWarrantyStatus(record.warranty_expiry_date);
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 150,
      ellipsis: true,
    },
  ];

  return (
    <Card
      title={
        <Space>
          <SafetyCertificateOutlined />
          <span>保修到期提醒</span>
        </Space>
      }
      extra={
        <Button type="primary" onClick={() => onNavigate('/maintenance/warranty-reminders')}>
          查看全部
        </Button>
      }
    >
      {/* 保修统计 */}
      {warrantyStats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Statistic
              title="在保"
              value={warrantyStats.status_stats?.find(s => s.warranty_status === '在保')?.count || 0}
              styles={{ content: { color: '#52c41a' } }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="过保"
              value={warrantyStats.status_stats?.find(s => s.warranty_status === '过保')?.count || 0}
              styles={{ content: { color: '#ff4d4f' } }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="即将到期"
              value={warrantyStats.expiring_soon || 0}
              styles={{ content: { color: '#faad14' } }}
              prefix={<WarningOutlined />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="合同总额"
              value={warrantyStats.contract_stats?.reduce((sum, c) => sum + (c.total_amount || 0), 0) || 0}
              prefix="¥"
              precision={2}
            />
          </Col>
        </Row>
      )}

      <div className="hide-on-mobile">
        <Table
          dataSource={allExpiring}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 5, size: 'small' }}
          size="small"
          locale={{ emptyText: '暂无即将过期的保修' }}
          scroll={{ x: 800 }}
        />
      </div>

      <div className="mobile-table-cards show-on-mobile">
        {Array.isArray(allExpiring) && allExpiring.length > 0 ? (
          allExpiring.slice(0, 5).map((record, index) => {
            const status = getWarrantyStatus(record.warranty_expiry_date);
            return (
              <div key={record.asset_code || index} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.asset_name || '-'}</span>
                  <Tag color={status.color}>{status.text}</Tag>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">资产编号</span>
                    <span className="mobile-card-value">{record.asset_code || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">保修截止</span>
                    <span className="mobile-card-value">{record.warranty_expiry_date ? dayjs(record.warranty_expiry_date).format('YYYY-MM-DD') : '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">供应商</span>
                    <span className="mobile-card-value">{record.supplier || '-'}</span>
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

export default DashboardWarrantyReminders;
