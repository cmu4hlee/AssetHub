import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Input,
  Select,
  DatePicker,
  Space,
  Tag,
  Modal,
  Descriptions,
  message,
  Statistic,
  Row,
  Col,
  Tooltip,
} from 'antd';

import { SearchOutlined, ReloadOutlined, EyeOutlined, BarChartOutlined } from '@ant-design/icons';
import { auditLogsAPI, rolesPermissionsAPI } from '../utils/api';
import { useCurrentUser } from '../hooks';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const AuditLogsList = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState({
    username: '',
    action_type: '',
    module: '',
    resource_type: '',
    start_date: '',
    end_date: '',
    keyword: '',
  });
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [stats, setStats] = useState(null);
  const { user } = useCurrentUser();
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    loadRoles();
    loadData();
  }, [pagination.current, pagination.pageSize]);

  const loadRoles = async () => {
    try {
      // 优先使用 rolesPermissionsAPI，如果失败则使用默认映射（兼容旧系统）
      const result = await rolesPermissionsAPI.getRoles();
      if (result.success && result.data && result.data.length > 0) {
        setRoles(result.data);
      }
    } catch (error) {
      console.error('加载角色列表失败:', error);
      // 如果加载失败，使用空数组，getRoleLabel 会使用默认映射
    }
  };

  const getRoleLabel = role => {
    if (!role) return '-';
    // 从角色列表中查找角色名称
    const roleObj = roles.find(r => (r.role || r.role_code || r.value) === role);
    if (roleObj) {
      return roleObj.label || roleObj.role_name || role;
    }
    // 如果没有找到，使用默认映射
    const roleMap = {
      system_admin: '系统管理员',
      asset_admin: '资产管理员',
      department_admin: '科室管理员',
      user: '普通用户',
    };
    return roleMap[role] || role;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      };

      // 移除空值
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      const result = await auditLogsAPI.getAuditLogs(params);
      if (result.success) {
        setLogs(result.data);
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total,
        }));
      } else {
        message.error(result.message || '获取操作日志失败');
      }
    } catch (error) {
      console.error('获取操作日志失败:', error);
      message.error(error.response?.data?.message || '获取操作日志失败');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const result = await auditLogsAPI.getAuditLogStats(params);
      if (result.success) {
        setStats(result.data);
        setStatsVisible(true);
      } else {
        message.error(result.message || '获取统计失败');
      }
    } catch (error) {
      console.error('获取统计失败:', error);
      message.error(error.response?.data?.message || '获取统计失败');
    }
  };

  const handleTableChange = newPagination => {
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    }));
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    loadData();
  };

  const handleReset = () => {
    setFilters({
      username: '',
      action_type: '',
      module: '',
      resource_type: '',
      start_date: '',
      end_date: '',
      keyword: '',
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleDateRangeChange = dates => {
    if (dates && dates.length === 2) {
      setFilters(prev => ({
        ...prev,
        start_date: dates[0].format('YYYY-MM-DD'),
        end_date: dates[1].format('YYYY-MM-DD'),
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        start_date: '',
        end_date: '',
      }));
    }
  };

  const handleViewDetail = async logId => {
    try {
      const result = await auditLogsAPI.getAuditLog(logId);
      if (result.success) {
        setSelectedLog(result.data);
        setDetailModalVisible(true);
      } else {
        message.error(result.message || '获取日志详情失败');
      }
    } catch (error) {
      console.error('获取日志详情失败:', error);
      message.error(error.response?.data?.message || '获取日志详情失败');
    }
  };

  const getActionTypeColor = actionType => {
    const colorMap = {
      create: 'green',
      update: 'blue',
      delete: 'red',
      login: 'cyan',
      logout: 'default',
      view: 'purple',
      export: 'orange',
      import: 'geekblue',
      approve: 'success',
      reject: 'error',
      link: 'processing',
      unlink: 'warning',
    };
    return colorMap[actionType] || 'default';
  };

  const getActionTypeText = actionType => {
    const textMap = {
      create: '创建',
      update: '更新',
      delete: '删除',
      login: '登录',
      logout: '登出',
      view: '查看',
      export: '导出',
      import: '导入',
      approve: '审核通过',
      reject: '审核拒绝',
      link: '关联',
      unlink: '取消关联',
    };
    return textMap[actionType] || actionType;
  };

  const getModuleText = module => {
    const textMap = {
      assets: '资产管理',
      users: '用户管理',
      'technical-documents': '技术资料',
      maintenance: '维修维护',
      inventory: '资产盘点',
      transfer: '资产调配',
    };
    return textMap[module] || module;
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户',
      dataIndex: 'real_name',
      key: 'user',
      width: 120,
      render: (text, record) => (
        <div>
          <div>{text || record.username || '-'}</div>
          {record.username && record.username !== text && (
            <div style={{ fontSize: 12, color: '#999' }}>{record.username}</div>
          )}
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: role => getRoleLabel(role),
    },
    {
      title: '操作类型',
      dataIndex: 'action_type',
      key: 'action_type',
      width: 100,
      render: actionType => (
        <Tag color={getActionTypeColor(actionType)}>{getActionTypeText(actionType)}</Tag>
      ),
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 120,
      render: module => getModuleText(module),
    },
    {
      title: '资源',
      key: 'resource',
      width: 200,
      render: (_, record) => (
        <div>
          {record.resource_name && <div style={{ fontWeight: 500 }}>{record.resource_name}</div>}
          {record.resource_type && (
            <div style={{ fontSize: 12, color: '#999' }}>
              {record.resource_type} {record.resource_id ? `#${record.resource_id}` : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '操作描述',
      dataIndex: 'action_description',
      key: 'action_description',
      ellipsis: {
        showTitle: false,
      },
      render: text => (
        <Tooltip placement="topLeft" title={text}>
          {text || '-'}
        </Tooltip>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
    },
    {
      title: '状态',
      dataIndex: 'response_status',
      key: 'response_status',
      width: 80,
      render: status => {
        if (!status) return '-';
        if (status >= 200 && status < 300) {
          return <Tag color="success">{status}</Tag>;
        } else if (status >= 400 && status < 500) {
          return <Tag color="warning">{status}</Tag>;
        } else if (status >= 500) {
          return <Tag color="error">{status}</Tag>;
        }
        return <Tag>{status}</Tag>;
      },
    },
    {
      title: '执行时间',
      dataIndex: 'execution_time',
      key: 'execution_time',
      width: 100,
      render: time => (time ? `${time}ms` : '-'),
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: time => (time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="操作日志（审计）"
        extra={
          <Space>
            <Button icon={<BarChartOutlined />} onClick={loadStats}>
              统计
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              刷新
            </Button>
          </Space>
        }
      >
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          {/* 筛选条件 */}
          <Space wrap>
            <Input
              placeholder="用户名"
              value={filters.username}
              onChange={e => setFilters(prev => ({ ...prev, username: e.target.value }))}
              style={{ width: 120 }}
              allowClear
            />
            <Select
              placeholder="操作类型"
              value={filters.action_type || undefined}
              onChange={value => setFilters(prev => ({ ...prev, action_type: value }))}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="create">创建</Option>
              <Option value="update">更新</Option>
              <Option value="delete">删除</Option>
              <Option value="login">登录</Option>
              <Option value="logout">登出</Option>
              <Option value="view">查看</Option>
              <Option value="export">导出</Option>
              <Option value="import">导入</Option>
              <Option value="approve">审核通过</Option>
              <Option value="reject">审核拒绝</Option>
              <Option value="link">关联</Option>
              <Option value="unlink">取消关联</Option>
            </Select>
            <Select
              placeholder="模块"
              value={filters.module || undefined}
              onChange={value => setFilters(prev => ({ ...prev, module: value }))}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="assets">资产管理</Option>
              <Option value="users">用户管理</Option>
              <Option value="technical-documents">技术资料</Option>
              <Option value="maintenance">维修维护</Option>
              <Option value="inventory">资产盘点</Option>
              <Option value="transfer">资产调配</Option>
            </Select>
            <Select
              placeholder="资源类型"
              value={filters.resource_type || undefined}
              onChange={value => setFilters(prev => ({ ...prev, resource_type: value }))}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="asset">资产</Option>
              <Option value="user">用户</Option>
              <Option value="document">技术资料</Option>
            </Select>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              onChange={handleDateRangeChange}
              format="YYYY-MM-DD"
            />
            <Input
              placeholder="关键词搜索（操作描述、资源名称）"
              value={filters.keyword}
              onChange={e => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
              style={{ width: 200 }}
              allowClear
              onPressEnter={handleSearch}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>

          {/* 桌面端表格 */}
          <div className="hide-on-mobile">
            <Table
              columns={columns}
              dataSource={logs}
              rowKey="id"
              loading={loading}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showTotal: total => `共 ${total} 条记录`,
              }}
              onChange={handleTableChange}
              scroll={{ x: 1500 }}
            />
          </div>

          {/* 移动端卡片列表 */}
          <div className="mobile-table-cards show-on-mobile">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
            ) : Array.isArray(logs) && logs.length > 0 ? (
              <>
                {logs.map(record => (
                  <div key={record.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">
                        {record.real_name || record.username || '-'}
                      </span>
                      <Tag color={getActionTypeColor(record.action_type)}>
                        {getActionTypeText(record.action_type)}
                      </Tag>
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">角色</span>
                        <span className="mobile-card-value">{getRoleLabel(record.role)}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">模块</span>
                        <span className="mobile-card-value">{getModuleText(record.module)}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">资源</span>
                        <span className="mobile-card-value">
                          {record.resource_name || record.resource_type || '-'}
                        </span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">操作描述</span>
                        <span className="mobile-card-value">
                          {record.action_description || '-'}
                        </span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">IP地址</span>
                        <span className="mobile-card-value">{record.ip_address || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">状态</span>
                        <span className="mobile-card-value">
                          {record.response_status ? (
                            <Tag
                              color={
                                record.response_status >= 200 && record.response_status < 300
                                  ? 'success'
                                  : record.response_status >= 400 && record.response_status < 500
                                    ? 'warning'
                                    : record.response_status >= 500
                                      ? 'error'
                                      : 'default'
                              }
                            >
                              {record.response_status}
                            </Tag>
                          ) : (
                            '-'
                          )}
                        </span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">操作时间</span>
                        <span className="mobile-card-value">
                          {record.created_at
                            ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')
                            : '-'}
                        </span>
                      </div>
                    </div>
                    <div className="mobile-card-actions">
                      <Button
                        type="primary"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewDetail(record.id)}
                        block
                      >
                        详情
                      </Button>
                    </div>
                  </div>
                ))}
                {/* 移动端分页 */}
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <Space>
                    <Button
                      disabled={pagination.current === 1}
                      onClick={() =>
                        handleTableChange({
                          current: pagination.current - 1,
                          pageSize: pagination.pageSize,
                        })
                      }
                    >
                      上一页
                    </Button>
                    <span>
                      第 {pagination.current} / {Math.ceil(pagination.total / pagination.pageSize)}{' '}
                      页
                    </span>
                    <Button
                      disabled={
                        pagination.current >= Math.ceil(pagination.total / pagination.pageSize)
                      }
                      onClick={() =>
                        handleTableChange({
                          current: pagination.current + 1,
                          pageSize: pagination.pageSize,
                        })
                      }
                    >
                      下一页
                    </Button>
                  </Space>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
            )}
          </div>
        </Space>
      </Card>

      {/* 日志详情模态框 */}
      <Modal
        title="操作日志详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedLog(null);
        }}
        footer={null}
        width={800}
      >
        {selectedLog && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="日志ID">{selectedLog.id}</Descriptions.Item>
            <Descriptions.Item label="用户ID">{selectedLog.user_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="用户名">{selectedLog.username || '-'}</Descriptions.Item>
            <Descriptions.Item label="真实姓名">{selectedLog.real_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="角色">{getRoleLabel(selectedLog.role)}</Descriptions.Item>
            <Descriptions.Item label="操作类型">
              <Tag color={getActionTypeColor(selectedLog.action_type)}>
                {getActionTypeText(selectedLog.action_type)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="模块">{getModuleText(selectedLog.module)}</Descriptions.Item>
            <Descriptions.Item label="资源类型">
              {selectedLog.resource_type || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="资源ID">{selectedLog.resource_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="资源名称">
              {selectedLog.resource_name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="操作描述" span={2}>
              {selectedLog.action_description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="IP地址">{selectedLog.ip_address || '-'}</Descriptions.Item>
            <Descriptions.Item label="User-Agent">
              {selectedLog.user_agent ? (
                <Tooltip title={selectedLog.user_agent}>
                  {selectedLog.user_agent.length > 50
                    ? `${selectedLog.user_agent.substring(0, 50)}...`
                    : selectedLog.user_agent}
                </Tooltip>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="HTTP方法">
              {selectedLog.request_method || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="请求路径">
              {selectedLog.request_path || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="响应状态">
              {selectedLog.response_status ? (
                <Tag
                  color={
                    selectedLog.response_status >= 200 && selectedLog.response_status < 300
                      ? 'success'
                      : selectedLog.response_status >= 400 && selectedLog.response_status < 500
                        ? 'warning'
                        : selectedLog.response_status >= 500
                          ? 'error'
                          : 'default'
                  }
                >
                  {selectedLog.response_status}
                </Tag>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="执行时间">
              {selectedLog.execution_time ? `${selectedLog.execution_time}ms` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="错误信息" span={2}>
              {selectedLog.error_message ? (
                <span style={{ color: '#ff4d4f' }}>{selectedLog.error_message}</span>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            {selectedLog.old_value && (
              <Descriptions.Item label="修改前的值" span={2}>
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: 8,
                    borderRadius: 4,
                    maxHeight: 200,
                    overflow: 'auto',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(selectedLog.old_value, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
            {selectedLog.new_value && (
              <Descriptions.Item label="修改后的值" span={2}>
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: 8,
                    borderRadius: 4,
                    maxHeight: 200,
                    overflow: 'auto',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(selectedLog.new_value, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
            {selectedLog.request_params && (
              <Descriptions.Item label="请求参数" span={2}>
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: 8,
                    borderRadius: 4,
                    maxHeight: 200,
                    overflow: 'auto',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(selectedLog.request_params, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="操作时间" span={2}>
              {selectedLog.created_at
                ? dayjs(selectedLog.created_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 统计模态框 */}
      <Modal
        title="操作日志统计"
        open={statsVisible}
        onCancel={() => {
          setStatsVisible(false);
          setStats(null);
        }}
        footer={null}
        width={800}
      >
        {stats && (
          <Space orientation="vertical" style={{ width: '100%' }} size="large">
            <Row gutter={16}>
              <Col span={12}>
                <Card title="操作类型统计" size="small">
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    {stats.action_type_stats?.map((item, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{getActionTypeText(item.action_type)}</span>
                        <Tag color={getActionTypeColor(item.action_type)}>{item.count}</Tag>
                      </div>
                    ))}
                  </Space>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="模块统计" size="small">
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    {stats.module_stats?.map((item, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{getModuleText(item.module)}</span>
                        <Tag>{item.count}</Tag>
                      </div>
                    ))}
                  </Space>
                </Card>
              </Col>
            </Row>
            <Card title="用户操作统计（前10名）" size="small">
              <Table
                dataSource={stats.user_stats || []}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  { title: '用户名', dataIndex: 'username', key: 'username' },
                  { title: '真实姓名', dataIndex: 'real_name', key: 'real_name' },
                  { title: '操作次数', dataIndex: 'count', key: 'count' },
                ]}
              />
            </Card>
            {stats.daily_stats && stats.daily_stats.length > 0 && (
              <Card title="每日操作统计（最近30天）" size="small">
                <Table
                  dataSource={stats.daily_stats || []}
                  rowKey="date"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: '日期', dataIndex: 'date', key: 'date' },
                    { title: '操作次数', dataIndex: 'count', key: 'count' },
                  ]}
                />
              </Card>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default AuditLogsList;
