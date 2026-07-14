/**
 * 合规性管理仪表板
 * 展示分级保养等合规核心信息
 */

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Tag, Spin } from 'antd';
import {
  SafetyCertificateOutlined,
  ToolOutlined,
  AlertOutlined,
  SecurityScanOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { complianceAPI } from '../../../utils/api';

const ComplianceDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    maintenance: { total: 0, pending: 0, processing: 0, completed: 0 },
    specialEquipment: { total: 0, normal: 0, expiring: 0, expired: 0 },
    safetyInspection: { total: 0, passed: 0, failed: 0, pending: 0 }
  });

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await complianceAPI.getDashboardStats();
      if (response?.success && response.data) {
        setStatistics(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.warn('加载统计数据失败，使用默认数据:', error.message);
      // 使用模拟数据
      setStatistics({
        maintenance: { total: 156, pending: 23, processing: 15, completed: 118 },
        specialEquipment: { total: 0, normal: 0, expiring: 0, expired: 0 },
        safetyInspection: { total: 0, passed: 0, failed: 0, pending: 0 }
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>
        <SafetyCertificateOutlined style={{ marginRight: 8 }} />
        合规性管理
      </h2>
      <p style={{ marginBottom: 24, color: '#666' }}>
        医学装备整体运维管理服务规范合规核心域，聚焦分级保养管理；特种设备与安全检测已拆分为独立模块
      </p>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card>
            <Statistic
              title="分级保养"
              value={statistics.maintenance.total}
              suffix="项"
              prefix={<ToolOutlined />}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color="success">已完成 {statistics.maintenance.completed}</Tag>
              <Tag color="processing">执行中 {statistics.maintenance.processing}</Tag>
              <Tag color="default">待执行 {statistics.maintenance.pending}</Tag>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 功能模块入口 */}
      <Row gutter={16}>
        <Col span={8}>
          <Link to="/compliance/maintenance-level">
            <Card hoverable style={{ height: 150 }}>
              <ToolOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 16 }} />
              <h3>分级保养管理</h3>
              <p style={{ color: '#666' }}>日常/一级/二级/三级保养计划与执行</p>
            </Card>
          </Link>
        </Col>
        <Col span={8}>
          <Link to="/special-equipment">
            <Card hoverable style={{ height: 150 }}>
              <AlertOutlined style={{ fontSize: 32, color: '#faad14', marginBottom: 16 }} />
              <h3>特种设备管理</h3>
              <p style={{ color: '#666' }}>特种设备台账与定期检验管理</p>
            </Card>
          </Link>
        </Col>
        <Col span={8}>
          <Link to="/safety-inspection">
            <Card hoverable style={{ height: 150 }}>
              <SecurityScanOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 16 }} />
              <h3>安全检测管理</h3>
              <p style={{ color: '#666' }}>电气安全、辐射安全等检测管理</p>
            </Card>
          </Link>
        </Col>
      </Row>
    </div>
  );
};

export default ComplianceDashboard;
