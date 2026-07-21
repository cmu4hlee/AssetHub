/**
 * 日常保养提醒列表
 *
 * 接收 maintenanceLevel prop，按级别过滤提醒。
 * 功能：列表展示、状态筛选、手动发送提醒、标记已处理/已忽略。
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Tag, message, Popconfirm, Select,
  Statistic, Card, Row, Col, Tooltip,
} from 'antd';
import {
  ReloadOutlined, SendOutlined, CheckOutlined, StopOutlined,
  ExclamationCircleOutlined, BellOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { dailyMaintenanceAPI } from '../../utils/api';

const LEVEL_LABELS = { level1: '临床一级保养', level2: '医工二级保养' };

const getStatusTag = (status) => {
  const map = { '未处理': 'orange', '已处理': 'green', '已忽略': 'default' };
  return <Tag color={map[status] || 'default'}>{status}</Tag>;
};

const DailyMaintenanceReminderList = ({ maintenanceLevel = 'level1' }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dailyMaintenanceAPI.getReminders({
        page: pagination.page,
        pageSize: pagination.pageSize,
        status: statusFilter,
        maintenanceLevel,
      });
      // res 是 normalizer 包装的 {success, data, pagination, rawData}
      // res.data 已经是 array
      setData(Array.isArray(res.data) ? res.data : []);
      if (res.pagination) {
        setPagination(prev => ({ ...prev, total: res.pagination.total || 0 }));
      }
    } catch (e) {
      message.error('加载提醒列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, statusFilter, maintenanceLevel]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await dailyMaintenanceAPI.getStatistics({ maintenanceLevel });
      const s = res.data?.data;
      if (s?.reminders) setStats(s.reminders);
    } catch (e) { /* 静默 */ }
  }, [maintenanceLevel]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1, total: 0 }));
    setStatusFilter('');
  }, [maintenanceLevel]);

  const handleUpdateStatus = async (id, status) => {
    try {
      await dailyMaintenanceAPI.updateReminder(id, { status });
      message.success('状态更新成功');
      fetchData();
      fetchStats();
    } catch (e) {
      message.error('更新失败');
    }
  };

  const handleCheckReminders = async () => {
    try {
      const res = await dailyMaintenanceAPI.checkReminders();
      const count = res.data?.count || 0;
      message.info(`发现 ${count} 个即将到期的保养计划`);
      fetchData();
      fetchStats();
    } catch (e) {
      message.error('检查失败');
    }
  };

  const columns = [
    {
      title: '提醒日期', dataIndex: 'reminder_date', key: 'reminder_date', width: 110,
      render: (d) => d ? dayjs(d).format('YYYY-MM-DD') : '-',
    },
    {
      title: '计划名称', dataIndex: 'plan_name', key: 'plan_name', width: 180, ellipsis: true,
    },
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code', width: 120, ellipsis: true },
    { title: '资产名称', dataIndex: 'asset_name', key: 'asset_name', width: 150, ellipsis: true },
    {
      title: '计划到期', dataIndex: 'next_maintenance_date', key: 'next_maintenance_date', width: 110,
      render: (d) => d ? dayjs(d).format('YYYY-MM-DD') : '-',
    },
    {
      title: '剩余天数', dataIndex: 'days_until', key: 'days_until', width: 90,
      render: (days) => {
        if (days === null || days === undefined) return '-';
        if (days < 0) return <Tag color="red">逾期{Math.abs(days)}天</Tag>;
        if (days === 0) return <Tag color="orange">今日到期</Tag>;
        if (days <= 3) return <Tag color="orange">{days}天后</Tag>;
        return <Tag color="blue">{days}天后</Tag>;
      },
    },
    { title: '责任部门', dataIndex: 'department', key: 'department', width: 120, ellipsis: true },
    { title: '责任人', dataIndex: 'responsible_person', key: 'responsible_person', width: 90, ellipsis: true },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: getStatusTag,
    },
    {
      title: '操作', key: 'action', width: 160, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {record.status === '未处理' && (
            <>
              <Tooltip title="标记已处理">
                <Button size="small" icon={<CheckOutlined />}
                  onClick={() => handleUpdateStatus(record.id, '已处理')} />
              </Tooltip>
              <Tooltip title="忽略">
                <Button size="small" icon={<StopOutlined />}
                  onClick={() => handleUpdateStatus(record.id, '已忽略')} />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small"><Statistic title="提醒总数" value={stats.total_reminders || 0} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="未处理" value={stats.pending_count || 0}
            styles={{ content: {  color: '#faad14'  } }} prefix={<ExclamationCircleOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="已处理" value={stats.processed_count || 0}
            styles={{ content: {  color: '#52c41a'  } }} prefix={<CheckOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="已忽略" value={stats.ignored_count || 0}
            styles={{ content: {  color: '#999'  } }} prefix={<StopOutlined />} /></Card>
        </Col>
      </Row>

      {/* 操作栏 */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="状态筛选"
          allowClear
          value={statusFilter || undefined}
          onChange={v => { setStatusFilter(v || ''); setPagination(prev => ({ ...prev, page: 1 })); }}
          style={{ width: 120 }}
        >
          <Select.Option value="未处理">未处理</Select.Option>
          <Select.Option value="已处理">已处理</Select.Option>
          <Select.Option value="已忽略">已忽略</Select.Option>
        </Select>
        <Button icon={<BellOutlined />} onClick={handleCheckReminders}>检查即将到期</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setPagination(prev => ({ ...prev, page: 1 })); fetchData(); }}>刷新</Button>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 1200 }}
        size="small"
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (page, pageSize) => setPagination(prev => ({ ...prev, page, pageSize })),
        }}
      />
    </div>
  );
};

export default DailyMaintenanceReminderList;
