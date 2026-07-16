/**
 * 分级保养管理页面
 * 支持日常保养/一级保养/二级保养/三级保养体系
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCan } from '../../../hooks';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  DatePicker, InputNumber, message, Popconfirm, Row, Col, Statistic,
  Tabs, Badge, Tooltip
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ScheduleOutlined, CheckCircleOutlined, ClockCircleOutlined,
  FileSearchOutlined, PlayCircleOutlined
} from '@ant-design/icons';
import { complianceAPI } from '../../../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const MaintenanceLevelManagement = () => {
  const [activeTab, setActiveTab] = useState('templates');
  const canDelete = useCan('compliance', 'delete');
  const canEdit = useCan('compliance', 'edit');
  const [loading, setLoading] = useState(false);
  
  // 模板相关状态
  const [templates, setTemplates] = useState([]);
  const templatesRef = useRef([]);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [templateForm] = Form.useForm();
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  // 计划相关状态
  const [plans, setPlans] = useState([]);
  const plansRef = useRef([]);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [planForm] = Form.useForm();
  const [editingPlan, setEditingPlan] = useState(null);
  
  // 统计数据
  const [stats, setStats] = useState({
    totalTemplates: 0,
    totalPlans: 0,
    pendingPlans: 0,
    completedPlans: 0
  });

  // 保养级别按业务两级分组:
  //   第一级 (使用科室): 日常保养
  //   第二级 (临床工程师): 月度/季度/年度技术保养
  // 物理 enum 保留 4 个值 (daily/level1/level2/level3), 仅在 UI 层嵌套展示
  const maintenanceLevelGroups = [
    {
      key: 'user_dept',
      label: '第一级 · 使用科室',
      desc: '使用科室的日常检查、清洁等',
      levels: [
        { value: 'daily', label: '日常保养', color: 'green', cycle: '每日', desc: '日常基础检查' },
      ],
    },
    {
      key: 'engineer',
      label: '第二级 · 临床工程师',
      desc: '临床工程师的预防性技术保养 (含月度/季度/年度 3 个子级)',
      levels: [
        { value: 'level1', label: '一级保养 · 月度', color: 'blue', cycle: '月', desc: '月度保养' },
        { value: 'level2', label: '二级保养 · 季度', color: 'orange', cycle: '季', desc: '季度保养' },
        { value: 'level3', label: '三级保养 · 年度', color: 'red', cycle: '年', desc: '年度保养' },
      ],
    },
  ];

  // 扁平化查单个 level (Tag 渲染用)
  const findLevelByValue = value => {
    for (const g of maintenanceLevelGroups) {
      const found = g.levels.find(l => l.value === value);
      if (found) return { ...found, group: g };
    }
    return null;
  };

  const cycleTypes = [
    { value: 'day', label: '天' },
    { value: 'week', label: '周' },
    { value: 'month', label: '月' },
    { value: 'quarter', label: '季度' },
    { value: 'year', label: '年' }
  ];

  const buildLocalStats = useCallback((templateList, planList) => ({
    totalTemplates: templateList.length,
    totalPlans: planList.length,
    pendingPlans: planList.filter(p => p.status === 'pending').length,
    completedPlans: planList.filter(p => p.status === 'completed').length,
  }), []);

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await complianceAPI.getMaintenanceTemplates({ pageSize: 100 });
      if (response?.success) {
        const list = response.data || [];
        templatesRef.current = list;
        setTemplates(list);
      }
    } catch (_error) {
      message.error('加载模板失败');
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const response = await complianceAPI.getMaintenancePlans({ pageSize: 100 });
      if (response?.success) {
        const list = response.data || [];
        plansRef.current = list;
        setPlans(list);
      }
    } catch (_error) {
      message.error('加载计划失败');
    }
  }, []);

  const fetchStats = useCallback(async () => {
    const localStats = buildLocalStats(templatesRef.current, plansRef.current);
    try {
      const response = await complianceAPI.getDashboardStats();
      if (response?.success) {
        const maintenance = response.data?.maintenance || {};
        setStats({
          totalTemplates: localStats.totalTemplates,
          totalPlans: Number(maintenance.total) || localStats.totalPlans,
          pendingPlans: Number(maintenance.pending) || localStats.pendingPlans,
          completedPlans: Number(maintenance.completed) || localStats.completedPlans,
        });
      } else {
        setStats(localStats);
      }
    } catch (_error) {
      // 使用本地统计
      setStats(localStats);
    }
  }, [buildLocalStats]);

  useEffect(() => {
    let alive = true;

    const loadInitialData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchTemplates(), fetchPlans()]);
        await fetchStats();
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    void loadInitialData();
    return () => {
      alive = false;
    };
  }, [fetchPlans, fetchStats, fetchTemplates]);

  // 模板管理功能
  const handleAddTemplate = () => {
    setEditingTemplate(null);
    templateForm.resetFields();
    setTemplateModalVisible(true);
  };

  const handleEditTemplate = (record) => {
    setEditingTemplate(record);
    templateForm.setFieldsValue({
      ...record,
      cycle_days: record.cycle_days || 1
    });
    setTemplateModalVisible(true);
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await complianceAPI.deleteMaintenanceTemplate(id);
      message.success('删除成功');
      fetchTemplates();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handleTemplateSubmit = async () => {
    try {
      const values = await templateForm.validateFields();
      if (editingTemplate) {
        await complianceAPI.updateMaintenanceTemplate(editingTemplate.id, values);
        message.success('更新成功');
      } else {
        await complianceAPI.createMaintenanceTemplate(values);
        message.success('创建成功');
      }
      setTemplateModalVisible(false);
      fetchTemplates();
    } catch (_error) {
      message.error('操作失败');
    }
  };

  // 计划管理功能
  const handleAddPlan = () => {
    setEditingPlan(null);
    planForm.resetFields();
    setPlanModalVisible(true);
  };

  const handleEditPlan = (record) => {
    setEditingPlan(record);
    planForm.setFieldsValue({
      ...record,
      planned_date: record.planned_date ? dayjs(record.planned_date) : null,
      completed_date: record.completed_date ? dayjs(record.completed_date) : null
    });
    setPlanModalVisible(true);
  };

  const handleDeletePlan = async (id) => {
    try {
      await complianceAPI.deleteMaintenancePlan(id);
      message.success('删除成功');
      fetchPlans();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handlePlanSubmit = async () => {
    try {
      const values = await planForm.validateFields();
      if (values.planned_date) {
        values.planned_date = values.planned_date.format('YYYY-MM-DD');
      }
      if (values.completed_date) {
        values.completed_date = values.completed_date.format('YYYY-MM-DD');
      }
      
      if (editingPlan) {
        await complianceAPI.updateMaintenancePlan(editingPlan.id, values);
        message.success('更新成功');
      } else {
        await complianceAPI.createMaintenancePlan(values);
        message.success('创建成功');
      }
      setPlanModalVisible(false);
      fetchPlans();
    } catch (_error) {
      message.error('操作失败');
    }
  };

  const handleGeneratePlans = async () => {
    try {
      await complianceAPI.generateMaintenancePlans();
      message.success('计划生成成功');
      fetchPlans();
    } catch (_error) {
      message.error('生成失败');
    }
  };

  const templateColumns = [
    { title: '模板编号', dataIndex: 'template_code', key: 'template_code', width: 120 },
    { title: '模板名称', dataIndex: 'template_name', key: 'template_name' },
    { 
      title: '保养级别', 
      dataIndex: 'maintenance_level', 
      key: 'maintenance_level',
      render: (v) => {
        const level = findLevelByValue(v);
        return (
          <Tooltip title={level?.group ? `${level.group.label} · ${level.group.desc}` : ''}>
            <Tag color={level?.color}>{level?.label || v}</Tag>
          </Tooltip>
        );
      }
    },
    { title: '适用分类', dataIndex: 'asset_category', key: 'asset_category' },
    { 
      title: '保养周期', 
      key: 'cycle',
      render: (_, record) => {
        const cycleType = cycleTypes.find(c => c.value === record.cycle_type);
        return `${record.cycle_days || 1}${cycleType?.label}`;
      }
    },
    { title: '预计工时', dataIndex: 'estimated_hours', key: 'estimated_hours', render: (v) => `${v}小时` },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (v) => v === 'active' ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditTemplate(record)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDeleteTemplate(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const planColumns = [
    { title: '计划编号', dataIndex: 'plan_code', key: 'plan_code', width: 120 },
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code' },
    { title: '资产名称', dataIndex: 'asset_name', key: 'asset_name' },
    { 
      title: '保养级别', 
      dataIndex: 'maintenance_level', 
      key: 'maintenance_level',
      render: (v) => {
        const level = findLevelByValue(v);
        return (
          <Tooltip title={level?.group ? `${level.group.label} · ${level.group.desc}` : ''}>
            <Tag color={level?.color}>{level?.label || v}</Tag>
          </Tooltip>
        );
      }
    },
    { title: '计划日期', dataIndex: 'planned_date', key: 'planned_date' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (v) => {
        const statusMap = {
          pending: { color: 'default', text: '待执行' },
          processing: { color: 'processing', text: '执行中' },
          completed: { color: 'success', text: '已完成' },
          overdue: { color: 'error', text: '已逾期' }
        };
        return <Badge status={statusMap[v]?.color} text={statusMap[v]?.text} />;
      }
    },
    { title: '负责人', dataIndex: 'assigned_to_name', key: 'assigned_to_name' },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditPlan(record)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDeletePlan(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const tabItems = [
    {
      key: 'templates',
      label: <span><FileSearchOutlined />保养模板</span>,
      children: (
        <Card
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTemplate}>
              新增模板
            </Button>
          }
        >
          <Table 
            columns={templateColumns} 
            dataSource={templates} 
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )
    },
    {
      key: 'plans',
      label: <span><ScheduleOutlined />保养计划</span>,
      children: (
        <Card
          extra={
            <Space>
              <Button icon={<PlayCircleOutlined />} onClick={handleGeneratePlans}>自动生成计划</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPlan}>新增计划</Button>
            </Space>
          }
        >
          <Table 
            columns={planColumns} 
            dataSource={plans} 
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="保养模板数" value={stats.totalTemplates} prefix={<FileSearchOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="保养计划总数" value={stats.totalPlans} prefix={<ScheduleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待执行计划" value={stats.pendingPlans} prefix={<ClockCircleOutlined />} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已完成计划" value={stats.completedPlans} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {/* 模板编辑弹窗 */}
      <Modal
        title={editingTemplate ? '编辑保养模板' : '新增保养模板'}
        open={templateModalVisible}
        onOk={handleTemplateSubmit}
        onCancel={() => setTemplateModalVisible(false)}
        width={700}
      >
        <Form form={templateForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="template_code" label="模板编号" rules={[{ required: true }]}>
                <Input placeholder="请输入模板编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="template_name" label="模板名称" rules={[{ required: true }]}>
                <Input placeholder="请输入模板名称" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="maintenance_level" label="保养级别" rules={[{ required: true }]}>
                <Select placeholder="请选择保养级别">
                  {maintenanceLevelGroups.map(g => (
                    <Select.OptGroup key={g.key} label={g.label}>
                      {g.levels.map(l => (
                        <Option key={l.value} value={l.value}>
                          {l.label} - {l.desc}
                        </Option>
                      ))}
                    </Select.OptGroup>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="asset_category" label="适用资产分类">
                <Input placeholder="请输入适用资产分类" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="cycle_days" label="周期天数" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cycle_type" label="周期类型" rules={[{ required: true }]}>
                <Select placeholder="请选择周期类型">
                  {cycleTypes.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="maintenance_items" label="保养项目">
            <TextArea rows={3} placeholder="请输入保养项目，每行一个" />
          </Form.Item>
          
          <Form.Item name="required_tools" label="所需工具">
            <TextArea rows={2} placeholder="请输入所需工具" />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="estimated_hours" label="预计工时(小时)">
                <InputNumber min={0.5} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" initialValue="active">
                <Select>
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 计划编辑弹窗 */}
      <Modal
        title={editingPlan ? '编辑保养计划' : '新增保养计划'}
        open={planModalVisible}
        onOk={handlePlanSubmit}
        onCancel={() => setPlanModalVisible(false)}
        width={700}
      >
        <Form form={planForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="plan_code" label="计划编号" rules={[{ required: true }]}>
                <Input placeholder="请输入计划编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="asset_id" label="资产" rules={[{ required: true }]}>
                <Select placeholder="请选择资产" showSearch>
                  {/* 这里应该从API加载资产列表 */}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="maintenance_level" label="保养级别" rules={[{ required: true }]}>
                <Select placeholder="请选择保养级别">
                  {maintenanceLevelGroups.map(g => (
                    <Select.OptGroup key={g.key} label={g.label}>
                      {g.levels.map(l => (
                        <Option key={l.value} value={l.value}>{l.label}</Option>
                      ))}
                    </Select.OptGroup>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="template_id" label="使用模板">
                <Select placeholder="请选择模板">
                  {templates.map(t => <Option key={t.id} value={t.id}>{t.template_name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="planned_date" label="计划日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" initialValue="pending">
                <Select>
                  <Option value="pending">待执行</Option>
                  <Option value="processing">执行中</Option>
                  <Option value="completed">已完成</Option>
                  <Option value="overdue">已逾期</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="maintenance_content" label="保养内容">
            <TextArea rows={3} placeholder="请输入保养内容" />
          </Form.Item>
          
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MaintenanceLevelManagement;
