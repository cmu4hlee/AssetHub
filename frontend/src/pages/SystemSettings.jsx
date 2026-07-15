import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, Tag, Typography, Space, Divider, Spin, Alert, Button, Tooltip,
} from 'antd';
import {
  SettingOutlined, TeamOutlined, SafetyOutlined, AppstoreOutlined, DatabaseOutlined,
  ToolOutlined, CloudServerOutlined, AuditOutlined, ApiOutlined, MailOutlined,
  RobotOutlined, PrinterOutlined, DashboardOutlined, KeyOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, BankOutlined,
  UserOutlined, PartitionOutlined, CodeOutlined, DeploymentUnitOutlined,
  BarChartOutlined, SyncOutlined, GlobalOutlined, NodeIndexOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { systemConfigAPI } from '../api/domains/platform';

const { Title, Text, Paragraph } = Typography;

// ==================== 系统状态概览 ====================
function StatusOverview({ status, loading, onRefresh }) {
  if (loading) {
    return (
      <Card style={{ marginBottom: 24 }}>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <Paragraph type="secondary" style={{ marginTop: 16 }}>正在获取系统状态...</Paragraph>
        </div>
      </Card>
    );
  }

  if (!status) return null;

  const dbConnected = status.database?.connected;
  const uptimeDays = Math.floor((status.uptime || 0) / 86400);
  const uptimeHours = Math.floor(((status.uptime || 0) % 86400) / 3600);
  const uptimeMins = Math.floor(((status.uptime || 0) % 3600) / 60);

  return (
    <Card
      title={
        <Space>
          <CloudServerOutlined />
          <span>系统运行状态</span>
          <Tag color={dbConnected ? 'success' : 'error'} style={{ marginLeft: 8 }}>
            {dbConnected ? '运行中' : '异常'}
          </Tag>
        </Space>
      }
      extra={
        <Tooltip title="刷新状态">
          <Button icon={<ReloadOutlined spin={loading} />} size="small" onClick={onRefresh} />
        </Tooltip>
      }
      style={{ marginBottom: 24 }}
    >
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Statistic
            title="系统版本"
            value={status.version || '-'}
            prefix={<CodeOutlined />}
          />
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Statistic
            title="运行时长"
            value={`${uptimeDays}d ${uptimeHours}h ${uptimeMins}m`}
            prefix={<ClockCircleOutlined />}
          />
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Statistic
            title="数据库"
            value={dbConnected ? '正常' : '断开'}
            prefix={dbConnected ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            styles={{ content: { color: dbConnected ? '#52c41a' : '#ff4d4f' } }}
            suffix={status.database?.version ? <Text type="secondary" style={{ fontSize: 12 }}>v{status.database.version}</Text> : null}
          />
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Statistic
            title="内存使用"
            value={status.memory?.heapUsed || 0}
            suffix={`/ ${status.memory?.heapTotal || 0} MB`}
            prefix={<DeploymentUnitOutlined />}
          />
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Statistic
            title="Node.js"
            value={status.nodeVersion || '-'}
            prefix={<NodeIndexOutlined />}
          />
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Statistic
            title="运行环境"
            value={status.env === 'production' ? '生产' : status.env === 'development' ? '开发' : (status.env || '-')}
            prefix={<GlobalOutlined />}
            styles={{ content: { color: status.env === 'production' ? '#1890ff' : '#faad14' } }}
          />
        </Col>
      </Row>
    </Card>
  );
}

// ==================== 设置分类卡片 ====================
const SETTING_CATEGORIES = [
  {
    key: 'tenant',
    title: '企业空间',
    icon: <BankOutlined style={{ fontSize: 28, color: '#1890ff' }} />,
    description: '管理租户/企业空间、访问URL、模块和角色配置',
    items: [
      { title: '企业空间管理', desc: '创建和管理租户/企业空间', path: '/tenant-management', icon: <BankOutlined /> },
      { title: '企业列表', desc: '查看所有租户列表', path: '/tenants', icon: <TeamOutlined /> },
      { title: '访问URL管理', desc: '配置企业专属访问地址', path: '/tenant-access-url', icon: <GlobalOutlined /> },
      { title: '企业模块配置', desc: '按企业启用/禁用功能模块', path: '/tenant-module-config', icon: <AppstoreOutlined /> },
      { title: '企业角色配置', desc: '企业级菜单、数据、权限配置', path: '/tenant-role-config', icon: <SafetyOutlined /> },
    ],
  },
  {
    key: 'users',
    title: '用户与权限',
    icon: <SafetyOutlined style={{ fontSize: 28, color: '#722ed1' }} />,
    description: '用户账号、角色权限、数据范围和部门管理',
    items: [
      { title: '用户管理', desc: '创建和管理系统用户账号', path: '/users', icon: <UserOutlined /> },
      { title: '角色权限管理', desc: '定义角色及菜单/操作权限', path: '/roles-permissions', icon: <SafetyOutlined /> },
      { title: '增强权限管理', desc: '精细化权限控制', path: '/enhanced-permissions', icon: <KeyOutlined /> },
      { title: '用户角色分配', desc: '为用户分配系统角色', path: '/user-roles', icon: <TeamOutlined /> },
      { title: '数据范围管理', desc: '配置数据可见范围规则', path: '/data-scope', icon: <PartitionOutlined /> },
      { title: '部门管理', desc: '组织架构和部门信息', path: '/departments', icon: <BankOutlined /> },
    ],
  },
  {
    key: 'modules',
    title: '模块管理',
    icon: <AppstoreOutlined style={{ fontSize: 28, color: '#13c2c2' }} />,
    description: '系统功能模块的注册、配置和状态管理',
    items: [
      { title: '模块注册', desc: '注册和管理功能模块元数据', path: '/modules', icon: <AppstoreOutlined /> },
      { title: '仪表盘配置', desc: '自定义首页仪表盘布局', path: '/dashboard-configs', icon: <DashboardOutlined /> },
    ],
  },
  {
    key: 'config',
    title: '系统配置',
    icon: <SettingOutlined style={{ fontSize: 28, color: '#fa8c16' }} />,
    description: '数据库、第三方集成、IoT等全局配置',
    items: [
      { title: '数据库连接', desc: '查看和配置数据库连接参数', path: '/database-connection', icon: <DatabaseOutlined /> },
      { title: '飞书配置', desc: '飞书应用集成与消息推送', path: '/feishu-config', icon: <RobotOutlined /> },
      { title: '邮件配置', desc: 'SMTP邮件服务配置', path: '/email-config', icon: <MailOutlined /> },
      { title: 'IoT Token管理', desc: '物联网设备认证令牌', path: '/system/token-management', icon: <KeyOutlined /> },
      { title: '云端同步', desc: '多端数据同步配置', path: '/cloud-sync', icon: <SyncOutlined /> },
    ],
  },
  {
    key: 'operations',
    title: '运维工具',
    icon: <ToolOutlined style={{ fontSize: 28, color: '#eb2f96' }} />,
    description: '审计日志、数据备份、API文档等运维功能',
    items: [
      { title: '审计日志', desc: '系统操作审计记录查询', path: '/audit-logs', icon: <AuditOutlined /> },
      { title: '数据备份', desc: '数据库备份与恢复管理', path: '/backup', icon: <CloudServerOutlined /> },
      { title: 'API文档', desc: '系统接口文档与调试', path: '/api-docs', icon: <ApiOutlined /> },
      { title: '资产标签模板', desc: '打印标签模板管理', path: '/asset-labels/templates', icon: <PrinterOutlined /> },
    ],
  },
];

// ==================== 统计卡片 ====================
function StatsRow({ status }) {
  if (!status) return null;

  const statsItems = [
    { title: '租户数', value: status.tenants?.total ?? '-', icon: <BankOutlined />, color: '#1890ff' },
    { title: '用户数', value: status.users?.total ?? '-', suffix: `活跃 ${status.users?.active ?? '-'}`, icon: <UserOutlined />, color: '#722ed1' },
    { title: '资产总数', value: status.assets?.total ?? '-', icon: <BarChartOutlined />, color: '#52c41a' },
    { title: '部门数', value: status.departments?.total ?? '-', icon: <PartitionOutlined />, color: '#13c2c2' },
    { title: '模块数', value: `${status.modules?.active ?? '-'}/${status.modules?.total ?? '-'}`, icon: <AppstoreOutlined />, color: '#fa8c16' },
    { title: '角色数', value: status.roles?.total ?? '-', icon: <SafetyOutlined />, color: '#eb2f96' },
    { title: '7天日志', value: status.auditLogs?.recent7Days ?? '-', icon: <AuditOutlined />, color: '#faad14' },
  ];

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      {statsItems.map((item, idx) => (
        <Col xs={12} sm={8} md={6} lg={Math.floor(24 / 7)} xl={3} key={idx}>
          <Card size="small" hoverable style={{ textAlign: 'center', borderRadius: 8 }}>
            <div style={{ fontSize: 24, color: item.color, marginBottom: 8 }}>{item.icon}</div>
            <Statistic
              title={item.title}
              value={item.value}
              styles={{ content: { fontSize: 22, fontWeight: 600 } }}
              suffix={item.suffix ? <Text type="secondary" style={{ fontSize: 11 }}>{item.suffix}</Text> : undefined}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

// ==================== 主页面组件 ====================
export default function SystemSettings() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(null);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await systemConfigAPI.getSystemStatus();
      if (res.success) {
        setStatus(res.data);
      } else {
        setStatusError(res.message || '获取状态失败');
      }
    } catch (err) {
      setStatusError(err.message || '网络请求失败');
      console.error('获取系统状态失败:', err);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <SettingOutlined style={{ marginRight: 8 }} />
          系统设置
        </Title>
        <Text type="secondary">集中管理系统配置、用户权限、模块和运维工具</Text>
      </div>

      {/* 系统状态 */}
      {statusError && (
        <Alert
          type="warning"
          message="系统状态获取失败"
          description={statusError}
          showIcon
          closable
          style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={fetchStatus}>重试</Button>}
        />
      )}
      <StatusOverview status={status} loading={statusLoading} onRefresh={fetchStatus} />

      {/* 数据统计 */}
      <Divider orientation="left" plain>
        <Text type="secondary">数据概览</Text>
      </Divider>
      <StatsRow status={status} />

      {/* 设置分类 */}
      <Divider orientation="left" plain>
        <Text type="secondary">管理功能</Text>
      </Divider>

      {SETTING_CATEGORIES.map(category => (
        <Card
          key={category.key}
          title={
            <Space>
              {category.icon}
              <span style={{ fontSize: 17, fontWeight: 600 }}>{category.title}</span>
            </Space>
          }
          style={{ marginBottom: 20, borderRadius: 8 }}
          styles={{ body: { padding: '16px 24px' } }}
        >
          <Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 13 }}>
            {category.description}
          </Paragraph>
          <Row gutter={[12, 12]}>
            {category.items.map((item, idx) => (
              <Col xs={24} sm={12} md={8} lg={6} xl={Math.floor(24 / category.items.length > 4 ? 4 : category.items.length)} key={idx}>
                <Card
                  size="small"
                  hoverable
                  style={{ borderRadius: 8, height: '100%' }}
                  styles={{ body: { padding: '14px 16px' } }}
                  onClick={() => navigate(item.path)}
                >
                  <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                    <Space>
                      <span style={{ fontSize: 18, color: '#1890ff' }}>{item.icon}</span>
                      <Text strong style={{ fontSize: 14 }}>{item.title}</Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12, lineHeight: '18px' }}>
                      {item.desc}
                    </Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      ))}
    </div>
  );
}
