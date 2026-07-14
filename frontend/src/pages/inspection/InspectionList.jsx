/**
 * 巡检任务列表页面
 * 巡检管理主入口，展示巡检任务、记录单、问题等
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select, DatePicker,
  message, Popconfirm, Row, Col, Statistic, Tabs, Badge, Tooltip, Progress, Empty,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, FileTextOutlined,
  ReconciliationOutlined, ClockCircleOutlined, CheckCircleOutlined,
  WarningOutlined, ExclamationCircleOutlined, AlertOutlined,
  CalendarOutlined, ScheduleOutlined, EnvironmentOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { inspectionAPI } from '../../utils/api';
import dayjs from 'dayjs';
import useIsMobile from '../../hooks/useIsMobile';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const taskStatusMap = {
  pending: { label: '待巡检', color: 'default' },
  in_progress: { label: '巡检中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  overdue: { label: '已逾期', color: 'error' },
  cancelled: { label: '已取消', color: 'default' },
};

const priorityMap = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'blue' },
};

const inspectionTypeMap = {
  daily: '日常巡检',
  weekly: '周巡检',
  monthly: '月巡检',
  quarterly: '季巡检',
  special: '专项巡检',
};

const InspectionList = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const canDelete = useCan('inspection', 'delete');
  const canEdit = useCan('inspection', 'edit');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form] = Form.useForm();
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, overdue: 0 });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await inspectionAPI.getTasks({ page, pageSize, ...filters });
      if (response?.success) {
        setTasks(response.data || []);
        setTotal(response.pagination?.total || 0);
        // 简单统计（基于当前页，实际应单独请求统计接口）
      }
    } catch (_e) {
      message.error('加载巡检任务失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await inspectionAPI.getStatistics();
      if (response?.success) {
        const t = response.data?.tasks || {};
        setStats({
          total: t.total_tasks || 0,
          completed: t.completed_tasks || 0,
          pending: (t.pending_tasks || 0) + (t.in_progress_tasks || 0),
          overdue: t.overdue_tasks || 0,
        });
      }
    } catch (_e) {
      // 忽略统计错误
    }
  }, []);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleAdd = () => {
    setEditingTask(null);
    form.resetFields();
    form.setFieldsValue({
      inspection_type: 'daily',
      priority: 'medium',
      plan_date: dayjs(),
      status: 'pending',
    });
    setModalVisible(true);
  };

  const handleEdit = record => {
    setEditingTask(record);
    form.setFieldsValue({
      ...record,
      plan_date: record.plan_date ? dayjs(record.plan_date) : null,
      deadline: record.deadline ? dayjs(record.deadline) : null,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        plan_date: values.plan_date ? values.plan_date.format('YYYY-MM-DD') : null,
        deadline: values.deadline ? values.deadline.format('YYYY-MM-DD') : null,
      };
      if (editingTask) {
        await inspectionAPI.updateTask(editingTask.id, payload);
        message.success('更新成功');
      } else {
        await inspectionAPI.createTask(payload);
        message.success('创建成功');
      }
      setModalVisible(false);
      void fetchTasks();
      void fetchStats();
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error.message || '操作失败');
    }
  };

  const handleDelete = async id => {
    try {
      await inspectionAPI.deleteTask(id);
      message.success('删除成功');
      void fetchTasks();
      void fetchStats();
    } catch (_e) {
      message.error('删除失败');
    }
  };

  const handleFillRecord = record => {
    navigate(`/inspection/records/new?taskId=${record.id}`);
  };

  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchForm] = Form.useForm();
  const [batchAssets, setBatchAssets] = useState([]);
  const [batchAssetList, setBatchAssetList] = useState([]);

  const handleBatchSearch = async keyword => {
    if (!keyword || keyword.length < 1) { setBatchAssetList([]); return; }
    const res = await inspectionAPI.getTasks; // 简化:搜索资产由其他模块提供,这里先占位
    setBatchAssetList([]);
  };

  const handleBatchSubmit = async () => {
    try {
      const v = await batchForm.validateFields();
      const payload = {
        ...v,
        plan_date: v.plan_date.format('YYYY-MM-DD'),
        deadline: v.deadline ? v.deadline.format('YYYY-MM-DD') : null,
        asset_ids: batchAssets,
      };
      const r = await inspectionAPI.batchCreateTasks(payload);
      message.success(`生成完成:成功 ${r.data.success} 条,失败 ${r.data.failed} 条`);
      setBatchModalVisible(false);
      setBatchAssets([]);
      batchForm.resetFields();
      void fetchTasks();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || '生成失败');
    }
  };

  const columns = [
    {
      title: '任务编号',
      dataIndex: 'task_code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '任务名称',
      dataIndex: 'task_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '巡检类型',
      dataIndex: 'inspection_type',
      width: 100,
      render: v => inspectionTypeMap[v] || v,
    },
    {
      title: '关联资产',
      dataIndex: 'asset_name',
      width: 180,
      ellipsis: true,
      render: (v, r) => v || r.inspection_area || '-',
    },
    {
      title: '巡检人',
      dataIndex: 'assignee_name',
      width: 100,
    },
    {
      title: '计划日期',
      dataIndex: 'plan_date',
      width: 110,
      sorter: true,
    },
    {
      title: '截止日期',
      dataIndex: 'deadline',
      width: 110,
      render: v => v || '-',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      render: v => {
        const p = priorityMap[v] || priorityMap.medium;
        return <Tag color={p.color}>{p.label}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: v => {
        const s = taskStatusMap[v] || taskStatusMap.pending;
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="填写巡检记录单">
            <Button
              type="link"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => handleFillRecord(record)}
              disabled={record.status === 'completed'}
            />
          </Tooltip>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确认删除该任务？" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? '8px' : '24px' }}>
      <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size={isMobile ? 'small' : 'default'}>
            <Statistic
              title="巡检任务总数"
              value={stats.total}
              prefix={<ReconciliationOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size={isMobile ? 'small' : 'default'}>
            <Statistic
              title="待巡检"
              value={stats.pending}
              styles={{ content: { color: '#1890ff' } }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size={isMobile ? 'small' : 'default'}>
            <Statistic
              title="已完成"
              value={stats.completed}
              styles={{ content: { color: '#52c41a' } }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size={isMobile ? 'small' : 'default'}>
            <Statistic
              title="已逾期"
              value={stats.overdue}
              styles={{ content: { color: '#ff4d4f' } }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="巡检任务管理"
        extra={
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              size={isMobile ? 'small' : 'middle'}
            >
              新建巡检任务
            </Button>
            <Button icon={<ThunderboltOutlined />} onClick={() => setBatchModalVisible(true)} size={isMobile ? 'small' : 'middle'}>
              批量生成
            </Button>
            {!isMobile && (
              <>
                <Button icon={<CalendarOutlined />} onClick={() => navigate('/inspection/calendar')}>日历</Button>
                <Button icon={<ScheduleOutlined />} onClick={() => navigate('/inspection/plans')}>计划</Button>
                <Button icon={<EnvironmentOutlined />} onClick={() => navigate('/inspection/routes')}>路线</Button>
                <Button onClick={() => navigate('/inspection/records')}>
                  <EyeOutlined /> 巡检记录单
                </Button>
                <Button onClick={() => navigate('/inspection/issues')}>
                  <AlertOutlined /> 异常问题
                </Button>
              </>
            )}
          </Space>
        }
      >
        <Form layout={isMobile ? 'vertical' : 'inline'} style={{ marginBottom: 16 }}>
          <Form.Item label="关键词">
            <Input
              allowClear
              placeholder="任务名称/编号"
              style={{ width: isMobile ? '100%' : 180 }}
              onPressEnter={e => setFilters({ ...filters, keyword: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="状态">
            <Select
              allowClear
              style={{ width: isMobile ? '100%' : 120 }}
              placeholder="全部"
              onChange={v => setFilters({ ...filters, status: v })}
            >
              {Object.entries(taskStatusMap).map(([k, v]) => (
                <Option key={k} value={k}>{v.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="巡检类型">
            <Select
              allowClear
              style={{ width: isMobile ? '100%' : 120 }}
              placeholder="全部"
              onChange={v => setFilters({ ...filters, inspection_type: v })}
            >
              {Object.entries(inspectionTypeMap).map(([k, v]) => (
                <Option key={k} value={k}>{v}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" block={isMobile} onClick={() => { setPage(1); void fetchTasks(); }}>
              查询
            </Button>
          </Form.Item>
        </Form>

        {/* 桌面端表格 */}
        <div className="hide-on-mobile">
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={tasks}
            scroll={{ x: 1400 }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: t => `共 ${t} 条`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
          />
        </div>

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(tasks) && tasks.length > 0 ? (
            <>
              {tasks.map(record => {
                const s = taskStatusMap[record.status] || taskStatusMap.pending;
                const p = priorityMap[record.priority] || priorityMap.medium;
                return (
                  <div key={record.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{record.task_name || record.task_code || '-'}</span>
                      <Tag color={s.color}>{s.label}</Tag>
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">任务编号</span>
                        <span className="mobile-card-value">{record.task_code || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">巡检类型</span>
                        <span className="mobile-card-value">{inspectionTypeMap[record.inspection_type] || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">关联资产</span>
                        <span className="mobile-card-value">{record.asset_name || record.inspection_area || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">巡检人</span>
                        <span className="mobile-card-value">{record.assignee_name || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">计划日期</span>
                        <span className="mobile-card-value">{record.plan_date || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">截止日期</span>
                        <span className="mobile-card-value">{record.deadline || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">优先级</span>
                        <span className="mobile-card-value"><Tag color={p.color}>{p.label}</Tag></span>
                      </div>
                    </div>
                    <div className="mobile-card-actions">
                      <Button
                        type="primary"
                        size="small"
                        icon={<FileTextOutlined />}
                        onClick={() => handleFillRecord(record)}
                        disabled={record.status === 'completed'}
                        block
                      >
                        填写记录
                      </Button>
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        block
                      >
                        编辑
                      </Button>
                      <Popconfirm title="确认删除该任务？" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
                        <Button type="primary" danger size="small" icon={<DeleteOutlined />} block disabled={!canDelete}>
                          删除
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                );
              })}
              {/* 移动端分页 */}
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Space>
                  <Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    上一页
                  </Button>
                  <span>
                    第 {page} / {Math.ceil(total / pageSize) || 1} 页
                  </span>
                  <Button
                    disabled={page >= Math.ceil(total / pageSize)}
                    onClick={() => setPage(p => p + 1)}
                  >
                    下一页
                  </Button>
                </Space>
                <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                  共 {total} 条
                </div>
              </div>
            </>
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>

      <Modal
        title={editingTask ? '编辑巡检任务' : '新建巡检任务'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={isMobile ? '95vw' : 700}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="task_name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
                <Input placeholder="请输入任务名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inspection_type" label="巡检类型" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(inspectionTypeMap).map(([k, v]) => (
                    <Option key={k} value={k}>{v}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="asset_id" label="关联资产ID">
                <Input placeholder="可选，输入资产ID" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="inspection_area" label="巡检区域">
                <Input placeholder="如：放射科、ICU等" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="assignee_name" label="巡检人">
                <Input placeholder="指派巡检人员姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="assignee_id" label="巡检人ID">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="plan_date" label="计划日期" rules={[{ required: true, message: '请选择计划日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="deadline" label="截止日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="priority" label="优先级">
                <Select>
                  {Object.entries(priorityMap).map(([k, v]) => (
                    <Option key={k} value={k}>{v.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="template_id" label="关联模板ID">
            <Input placeholder="可选，使用巡检模板" />
          </Form.Item>
          <Form.Item name="remark" label="任务说明">
            <TextArea rows={3} placeholder="任务详细说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量生成任务 */}
      <Modal
        title="批量生成巡检任务"
        open={batchModalVisible}
        onOk={handleBatchSubmit}
        onCancel={() => setBatchModalVisible(false)}
        width={isMobile ? '95vw' : 700}
        destroyOnHidden
      >
        <Form form={batchForm} layout="vertical">
          <Form.Item label="资产列表(逗号分隔的 ID)" required>
            <Input.TextArea
              rows={2}
              placeholder="如: 101,102,103"
              onChange={e => {
                const arr = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                setBatchAssets(arr);
              }}
            />
            <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
              已解析 {batchAssets.length} 个资产 ID
            </div>
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="task_name" label="任务名称前缀" rules={[{ required: true }]}>
                <Input placeholder="如: 月度巡检" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="plan_date" label="计划日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="deadline" label="截止日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="priority" label="优先级" initialValue="medium">
                <Select>
                  <Option value="low">低</Option>
                  <Option value="medium">中</Option>
                  <Option value="high">高</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="assignee_name" label="巡检人">
                <Input placeholder="指派给某人" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="inspection_type" label="巡检类型" initialValue="daily">
                <Select>
                  {Object.entries(inspectionTypeMap).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default InspectionList;
