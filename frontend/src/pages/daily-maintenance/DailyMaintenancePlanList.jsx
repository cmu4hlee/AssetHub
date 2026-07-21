/**
 * 日常保养计划列表
 *
 * 接收 maintenanceLevel prop ('level1' | 'level2')，按级别过滤数据。
 * 功能：列表展示、搜索、新增、编辑、查看详情、执行保养、删除。
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Space, Tag, Modal, message,
  Popconfirm, Card, Row, Col, Statistic, Form, DatePicker, InputNumber,
  Tooltip, Descriptions,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  CheckCircleOutlined, SearchOutlined, ReloadOutlined,
  ExclamationCircleOutlined, ScheduleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { dailyMaintenanceAPI } from '../../utils/api';

const { Search } = Input;
const { Option } = Select;

const LEVEL_LABELS = {
  level1: '临床一级保养',
  level2: '医工二级保养',
};

const RESULT_OPTIONS = [
  { label: '正常', value: '正常', color: 'green' },
  { label: '异常', value: '异常', color: 'orange' },
  { label: '需报修', value: '需报修', color: 'red' },
];

const getStatusTag = (status) => {
  const map = { '启用': 'green', '停用': 'default', '已完成': 'blue' };
  return <Tag color={map[status] || 'default'}>{status}</Tag>;
};

const DailyMaintenancePlanList = ({ maintenanceLevel = 'level1' }) => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [completeModal, setCompleteModal] = useState({ visible: false, plan: null });
  const [completeForm] = Form.useForm();
  const [stats, setStats] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dailyMaintenanceAPI.getPlans({
        page: pagination.page,
        pageSize: pagination.pageSize,
        keyword,
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
      message.error('加载保养计划失败: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, keyword, statusFilter, maintenanceLevel]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await dailyMaintenanceAPI.getStatistics({ maintenanceLevel });
      const s = res.data?.data;
      if (s?.plans) setStats(s.plans);
    } catch (e) {
      // 静默
    }
  }, [maintenanceLevel]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // 级别变化时重置分页
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1, total: 0 }));
    setKeyword('');
    setStatusFilter('');
  }, [maintenanceLevel]);

  const handleComplete = async () => {
    try {
      const values = await completeForm.validateFields();
      await dailyMaintenanceAPI.completePlan(completeModal.plan.id, {
        ...values,
        maintenance_date: values.maintenance_date?.format('YYYY-MM-DD'),
      });
      message.success('保养执行记录已提交');
      setCompleteModal({ visible: false, plan: null });
      completeForm.resetFields();
      fetchData();
      fetchStats();
    } catch (e) {
      if (e.errorFields) return;
      message.error('提交失败: ' + (e.message || ''));
    }
  };

  const handleDelete = async (id) => {
    try {
      await dailyMaintenanceAPI.deletePlan(id);
      message.success('删除成功');
      fetchData();
      fetchStats();
    } catch (e) {
      message.error('删除失败: ' + (e.message || ''));
    }
  };

  const columns = [
    {
      title: '计划名称', dataIndex: 'plan_name', key: 'plan_name', width: 180, ellipsis: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/daily-maintenance/${record.id}`)}>{text}</a>
      ),
    },
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code', width: 130, ellipsis: true },
    { title: '资产名称', dataIndex: 'asset_name', key: 'asset_name', width: 160, ellipsis: true },
    {
      title: '周期', key: 'cycle', width: 100,
      render: (_, r) => `每${r.cycle_value}${r.cycle_type?.replace('按', '')}`,
    },
    {
      title: '下次保养', dataIndex: 'next_maintenance_date', key: 'next_maintenance_date', width: 120,
      render: (date) => {
        if (!date) return '-';
        const d = dayjs(date);
        const days = d.diff(dayjs().startOf('day'), 'day');
        const color = days < 0 ? 'red' : days <= 3 ? 'orange' : 'blue';
        return <Tooltip title={days < 0 ? `已逾期${Math.abs(days)}天` : `${days}天后到期`}>
          <Tag color={color}>{d.format('YYYY-MM-DD')}</Tag>
        </Tooltip>;
      },
    },
    {
      title: '上次保养', dataIndex: 'last_maintenance_date', key: 'last_maintenance_date', width: 120,
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    { title: '责任部门', dataIndex: 'responsible_department', key: 'responsible_department', width: 130, ellipsis: true },
    { title: '责任人', dataIndex: 'responsible_person', key: 'responsible_person', width: 90, ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: getStatusTag },
    {
      title: '操作', key: 'action', width: 200, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="执行保养">
            <Button size="small" icon={<CheckCircleOutlined />}
              onClick={() => {
                setCompleteModal({ visible: true, plan: record });
                completeForm.setFieldsValue({
                  maintenance_date: dayjs(),
                  execution_result: '正常',
                });
              }}
              disabled={record.status === '停用'}
            />
          </Tooltip>
          <Tooltip title="详情">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => navigate(`/daily-maintenance/${record.id}`)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />}
              onClick={() => navigate(`/daily-maintenance/edit/${record.id}`)} />
          </Tooltip>
          <Popconfirm title="确定删除此保养计划？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small"><Statistic title="计划总数" value={stats.total_plans || 0} /></Card>
        </Col>
        <Col span={4}>
          <Card size="small"><Statistic title="启用中" value={stats.active_plans || 0}
            styles={{ content: {  color: '#52c41a'  } }} /></Card>
        </Col>
        <Col span={4}>
          <Card size="small"><Statistic title="已逾期" value={stats.due_plans || 0}
            styles={{ content: {  color: '#ff4d4f'  } }} prefix={<ExclamationCircleOutlined />} /></Card>
        </Col>
        <Col span={4}>
          <Card size="small"><Statistic title="7天内到期" value={stats.upcoming_plans || 0}
            styles={{ content: {  color: '#faad14'  } }} /></Card>
        </Col>
        <Col span={4}>
          <Card size="small"><Statistic title="已完成" value={stats.completed_plans || 0}
            styles={{ content: {  color: '#1890ff'  } }} /></Card>
        </Col>
      </Row>

      {/* 搜索栏 */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Search
          placeholder="搜索计划名称/资产"
          allowClear
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onSearch={() => { setPagination(prev => ({ ...prev, page: 1 })); fetchData(); }}
          style={{ width: 250 }}
        />
        <Select
          placeholder="状态筛选"
          allowClear
          value={statusFilter || undefined}
          onChange={v => { setStatusFilter(v || ''); setPagination(prev => ({ ...prev, page: 1 })); }}
          style={{ width: 120 }}
        >
          <Option value="启用">启用</Option>
          <Option value="停用">停用</Option>
          <Option value="已完成">已完成</Option>
        </Select>
        <Button icon={<ReloadOutlined />} onClick={() => { setPagination(prev => ({ ...prev, page: 1 })); fetchData(); }}>刷新</Button>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => navigate(`/daily-maintenance/new?level=${maintenanceLevel}`)}>
          新增保养计划
        </Button>
      </Space>

      {/* 数据表格 */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 1400 }}
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

      {/* 执行保养弹窗 */}
      <Modal
        title={`执行保养 — ${completeModal.plan?.plan_name || ''}`}
        open={completeModal.visible}
        onOk={handleComplete}
        onCancel={() => { setCompleteModal({ visible: false, plan: null }); completeForm.resetFields(); }}
        width={600}
        okText="提交记录"
        cancelText="取消"
      >
        {completeModal.plan && (
          <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="资产">{completeModal.plan.asset_code}</Descriptions.Item>
            <Descriptions.Item label="级别">{LEVEL_LABELS[completeModal.plan.maintenance_level]}</Descriptions.Item>
            <Descriptions.Item label="周期">每{completeModal.plan.cycle_value}{completeModal.plan.cycle_type}</Descriptions.Item>
            <Descriptions.Item label="计划到期">{completeModal.plan.next_maintenance_date ? dayjs(completeModal.plan.next_maintenance_date).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
          </Descriptions>
        )}
        <Form form={completeForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="maintenance_date" label="保养日期" rules={[{ required: true, message: '请选择保养日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="executor" label="执行人" rules={[{ required: true, message: '请输入执行人' }]}>
                <Input placeholder="执行人姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="execution_result" label="执行结果" rules={[{ required: true }]}>
                <Select>
                  {RESULT_OPTIONS.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="actual_duration" label="实际耗时(小时)">
                <InputNumber style={{ width: '100%' }} min={0} step={0.5} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="executor_department" label="执行部门">
            <Input placeholder="执行部门" />
          </Form.Item>
          <Form.Item name="issues_found" label="发现问题">
            <Input.TextArea rows={2} placeholder="保养中发现的问题（如有）" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={2} placeholder="其他说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DailyMaintenancePlanList;
