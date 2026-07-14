/**
 * 审计日志管理页面
 * 提供审计日志的查询、查看、统计、导出功能
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Table, Tag, Button, Space, DatePicker, Select, Input,
  Modal, Descriptions, Timeline, Row, Col, message,
  Popconfirm, Tooltip, Badge, Empty
} from 'antd';
import {
  FileTextOutlined, DownloadOutlined,
  DeleteOutlined, EyeOutlined, BarChartOutlined,
  ReloadOutlined, UserOutlined,
  CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import { api } from '../utils/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const AuditLogManagement = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const paginationRef = useRef(pagination);
  const [filters, setFilters] = useState({});
  const [detailModal, setDetailModal] = useState({ visible: false, log: null });
  const [statistics, setStatistics] = useState(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [operations, setOperations] = useState([]);
  const [resourceTypes, setResourceTypes] = useState([]);

  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  // 获取操作类型和资源类型
  useEffect(() => {
    const fetchEnums = async () => {
      try {
        const [opsRes, typesRes] = await Promise.all([
          api.get('/audit-logs/operations'),
          api.get('/audit-logs/resource-types'),
        ]);
        if (opsRes?.success) setOperations(opsRes.data);
        if (typesRes?.success) setResourceTypes(typesRes.data);
      } catch (error) {
        console.error('获取枚举数据失败:', error);
      }
    };
    fetchEnums();
  }, []);

  // 获取审计日志
  const fetchLogs = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      const { current, pageSize } = paginationRef.current;
      const response = await api.get('/audit-logs/enhanced', {
        params: {
          page: current,
          pageSize,
          ...filters,
          ...params,
        },
      });

      if (response?.success) {
        setLogs(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
        }));
      }
    } catch (_error) {
      message.error('获取审计日志失败');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 获取统计
  const fetchStatistics = async () => {
    try {
      const response = await api.get('/audit-logs/statistics', {
        params: {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      });
      if (response?.success) {
        setStatistics(response.data);
        setStatsVisible(true);
      }
    } catch (_error) {
      message.error('获取统计失败');
    }
  };

  // 导出日志
  const handleExport = async () => {
    try {
      const response = await api.get('/audit-logs/export', {
        params: {
          ...filters,
          format: 'csv',
        },
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `audit-logs-${dayjs().format('YYYY-MM-DD')}.csv`;
      link.click();

      message.success('导出成功');
    } catch (_error) {
      message.error('导出失败');
    }
  };

  // 清理过期日志
  const handleCleanup = async () => {
    try {
      const response = await api.post('/audit-logs/cleanup', {
        retentionDays: 365,
      });
      if (response?.success) {
        message.success(`已清理 ${response.deletedCount} 条过期日志`);
        fetchLogs();
      }
    } catch (_error) {
      message.error('清理失败');
    }
  };

  // 获取操作标签
  const getOperationTag = (operation) => {
    const op = operations.find(o => o.value === operation);
    return (
      <Tag color={op?.color || 'default'}>
        {op?.label || operation}
      </Tag>
    );
  };

  // 获取状态标签
  const getStatusTag = (status) => {
    return status === 'success' ? (
      <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>
    ) : (
      <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>
    );
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      width: 180,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作人',
      dataIndex: 'username',
      width: 120,
      render: (val, record) => (
        <Space>
          <UserOutlined />
          <span>{val}</span>
          <span style={{ color: '#999', fontSize: 12 }}>(ID:{record.user_id})</span>
        </Space>
      ),
    },
    {
      title: '操作类型',
      dataIndex: 'operation',
      width: 100,
      render: getOperationTag,
    },
    {
      title: '资源类型',
      dataIndex: 'resource_type',
      width: 120,
      render: (val) => {
        const type = resourceTypes.find(t => t.value === val);
        return type?.label || val;
      },
    },
    {
      title: '资源名称',
      dataIndex: 'resource_name',
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: getStatusTag,
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      width: 140,
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      width: 100,
      render: (val) => val ? `${val}ms` : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => setDetailModal({ visible: true, log: record })}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>审计日志管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<BarChartOutlined />} onClick={fetchStatistics}>
              统计报表
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出
            </Button>
            <Popconfirm
              title="清理过期日志"
              description="将清理一年前的审计日志，确定继续吗？"
              onConfirm={handleCleanup}
              okText="确定"
              cancelText="取消"
            >
              <Button icon={<DeleteOutlined />} danger>
                清理
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        {/* 筛选栏 */}
        <Space wrap style={{ marginBottom: 16 }}>
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            onChange={(dates) => {
              setFilters({
                ...filters,
                startDate: dates?.[0]?.format('YYYY-MM-DD'),
                endDate: dates?.[1]?.format('YYYY-MM-DD'),
              });
            }}
          />
          <Select
            placeholder="操作类型"
            allowClear
            style={{ width: 120 }}
            onChange={(val) => setFilters({ ...filters, operation: val })}
          >
            {operations.map(op => (
              <Option key={op.value} value={op.value}>{op.label}</Option>
            ))}
          </Select>
          <Select
            placeholder="资源类型"
            allowClear
            style={{ width: 120 }}
            onChange={(val) => setFilters({ ...filters, resourceType: val })}
          >
            {resourceTypes.map(type => (
              <Option key={type.value} value={type.value}>{type.label}</Option>
            ))}
          </Select>
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 100 }}
            onChange={(val) => setFilters({ ...filters, status: val })}
          >
            <Option value="success">成功</Option>
            <Option value="failed">失败</Option>
          </Select>
          <Input.Search
            placeholder="搜索关键词"
            allowClear
            onSearch={(val) => setFilters({ ...filters, keyword: val })}
            style={{ width: 200 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchLogs()}>
            刷新
          </Button>
        </Space>

        {/* 日志列表 */}
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={logs}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1500 }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, pageSize) => {
                setPagination({ ...pagination, current: page, pageSize });
              },
            }}
          />
        </div>

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {Array.isArray(logs) && logs.length > 0 ? (
            logs.map(record => {
              const op = operations.find(o => o.value === record.operation);
              const type = resourceTypes.find(t => t.value === record.resource_type);
              return (
                <div key={record.id} className="mobile-card-item">
                  <div className="mobile-card-header">
                    <span className="mobile-card-title">{record.description || record.resource_name || `日志 #${record.id}`}</span>
                    <span className="mobile-card-badge">
                      <Tag color={op?.color || 'default'}>{op?.label || record.operation}</Tag>
                    </span>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">时间</span>
                      <span className="mobile-card-value">{dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">操作人</span>
                      <span className="mobile-card-value">{record.username || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">资源类型</span>
                      <span className="mobile-card-value">{type?.label || record.resource_type || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">状态</span>
                      <span className="mobile-card-value">
                        {record.status === 'success' ? (
                          <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>
                        ) : (
                          <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>
                        )}
                      </span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">IP</span>
                      <span className="mobile-card-value">{record.ip_address || '-'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">耗时</span>
                      <span className="mobile-card-value">{record.duration ? `${record.duration}ms` : '-'}</span>
                    </div>
                    {record.resource_name && (
                      <div className="mobile-card-field mobile-card-field--full">
                        <span className="mobile-card-label">资源名称</span>
                        <span className="mobile-card-value">{record.resource_name}</span>
                      </div>
                    )}
                  </div>
                  <div className="mobile-card-actions">
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={<EyeOutlined />}
                      onClick={() => setDetailModal({ visible: true, log: record })}
                    >
                      详情
                    </Button>
                  </div>
                </div>
              );
            })
          ) : !loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无日志</div>
          ) : null}
        </div>
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="日志详情"
        open={detailModal.visible}
        onCancel={() => setDetailModal({ visible: false, log: null })}
        footer={[
          <Button key="close" onClick={() => setDetailModal({ visible: false, log: null })}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {detailModal.log && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="日志ID">{detailModal.log.id}</Descriptions.Item>
            <Descriptions.Item label="请求ID">{detailModal.log.request_id}</Descriptions.Item>
            <Descriptions.Item label="操作时间">
              {dayjs(detailModal.log.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="耗时">{detailModal.log.duration}ms</Descriptions.Item>
            <Descriptions.Item label="操作人">{detailModal.log.username}</Descriptions.Item>
            <Descriptions.Item label="用户ID">{detailModal.log.user_id}</Descriptions.Item>
            <Descriptions.Item label="操作类型">
              {getOperationTag(detailModal.log.operation)}
            </Descriptions.Item>
            <Descriptions.Item label="资源类型">{detailModal.log.resource_type}</Descriptions.Item>
            <Descriptions.Item label="资源ID">{detailModal.log.resource_id}</Descriptions.Item>
            <Descriptions.Item label="资源名称">{detailModal.log.resource_name}</Descriptions.Item>
            <Descriptions.Item label="状态">{getStatusTag(detailModal.log.status)}</Descriptions.Item>
            <Descriptions.Item label="IP地址">{detailModal.log.ip_address}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>{detailModal.log.description}</Descriptions.Item>

            {detailModal.log.changes && (
              <Descriptions.Item label="变更内容" span={2}>
                <Timeline>
                  {Object.entries(detailModal.log.changes).map(([key, change]) => (
                    <Timeline.Item key={key}>
                      <div><strong>{key}</strong></div>
                      <div style={{ color: '#999' }}>旧值: {JSON.stringify(change.old)}</div>
                      <div style={{ color: '#52c41a' }}>新值: {JSON.stringify(change.new)}</div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Descriptions.Item>
            )}

            {detailModal.log.error_message && (
              <Descriptions.Item label="错误信息" span={2}>
                <div style={{ color: '#ff4d4f', background: '#fff2f0', padding: 8, borderRadius: 4 }}>
                  {detailModal.log.error_message}
                </div>
              </Descriptions.Item>
            )}

            <Descriptions.Item label="User Agent" span={2}>
              <div style={{ fontSize: 12, color: '#666', wordBreak: 'break-all' }}>
                {detailModal.log.user_agent}
              </div>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 统计弹窗 */}
      <Modal
        title="审计统计"
        open={statsVisible}
        onCancel={() => setStatsVisible(false)}
        footer={null}
        width={900}
      >
        {statistics ? (
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card title="操作类型分布" size="small">
                {statistics.operationStats.map(stat => (
                  <div key={stat.operation} style={{ marginBottom: 8 }}>
                    <Space>
                      {getOperationTag(stat.operation)}
                      <Badge count={stat.count} showZero />
                    </Space>
                  </div>
                ))}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="资源类型分布" size="small">
                {statistics.resourceStats.map(stat => (
                  <div key={stat.resource_type} style={{ marginBottom: 8 }}>
                    <Space>
                      <span>{resourceTypes.find(t => t.value === stat.resource_type)?.label || stat.resource_type}</span>
                      <Badge count={stat.count} showZero />
                    </Space>
                  </div>
                ))}
              </Card>
            </Col>
            <Col span={24}>
              <Card title="活跃用户 TOP10" size="small">
                <Row gutter={[16, 8]}>
                  {statistics.userStats.map((user, index) => (
                    <Col span={8} key={user.user_id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge count={index + 1} style={{ backgroundColor: index < 3 ? '#ff4d4f' : '#1890ff' }} />
                        <span>{user.username}</span>
                        <span style={{ color: '#999' }}>({user.count}次)</span>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>
            <Col span={24}>
              <Card title="30天趋势" size="small">
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {statistics.dailyTrend.map(day => (
                    <Tooltip key={day.date} title={`${day.date}: ${day.count}次操作`}>
                      <div
                        style={{
                          width: 20,
                          height: Math.max(day.count * 2, 4),
                          backgroundColor: '#1890ff',
                          opacity: 0.7,
                          cursor: 'pointer',
                        }}
                      />
                    </Tooltip>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>
        ) : (
          <Empty description="暂无统计数据" />
        )}
      </Modal>
    </div>
  );
};

export default AuditLogManagement;
