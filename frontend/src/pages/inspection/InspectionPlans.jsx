/**
 * 巡检计划管理
 * 按周期自动派发任务,可关联模板/资产/默认巡检人
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select, DatePicker, InputNumber,
  Switch, message, Popconfirm, Row, Col, Statistic, Empty, Tooltip, Alert,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined,
  ScheduleOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { inspectionAPI, assetAPI } from '../../utils/api';
import dayjs from 'dayjs';
import useIsMobile from '../../hooks/useIsMobile';

const { Option } = Select;
const { TextArea } = Input;

const cycleTypeMap = {
  daily: '每日', weekly: '每周', monthly: '每月', quarterly: '每季', yearly: '每年',
};

const statusMap = {
  active: { label: '运行中', color: 'success' },
  paused: { label: '已暂停', color: 'warning' },
  ended: { label: '已结束', color: 'default' },
};

const InspectionPlans = () => {
  const isMobile = useIsMobile();
  const canDelete = useCan('inspection', 'delete');
  const canEdit = useCan('inspection', 'edit');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inspectionAPI.getPlans({ page, pageSize });
      if (res?.success) {
        setPlans(res.data || []);
        setTotal(res.pagination?.total || 0);
      }
    } catch (_e) { message.error('加载计划失败'); }
    finally { setLoading(false); }
  }, [page, pageSize]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    inspectionAPI.getTemplates({ pageSize: 100 }).then(res => {
      if (res?.success) setTemplates(res.data || []);
    });
  }, []);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      cycle_type: 'monthly',
      cycle_days: 30,
      start_date: dayjs(),
      next_run_date: dayjs(),
      status: 'active',
      default_priority: 'medium',
      auto_create_workorder: false,
    });
    setSelectedAssets([]);
    setModalVisible(true);
  };

  const handleEdit = record => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      start_date: record.start_date ? dayjs(record.start_date) : null,
      end_date: record.end_date ? dayjs(record.end_date) : null,
      next_run_date: record.next_run_date ? dayjs(record.next_run_date) : null,
    });
    setSelectedAssets(record.asset_ids_parsed || []);
    setModalVisible(true);
  };

  const handleSearchAssets = async keyword => {
    if (!keyword || keyword.length < 1) { setAssets([]); return; }
    const res = await assetAPI.getAssets({ keyword, page: 1, pageSize: 30 });
    setAssets(res?.data || []);
  };

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields();
      const payload = {
        ...v,
        start_date: v.start_date.format('YYYY-MM-DD'),
        end_date: v.end_date ? v.end_date.format('YYYY-MM-DD') : null,
        next_run_date: v.next_run_date ? v.next_run_date.format('YYYY-MM-DD') : null,
        asset_ids: selectedAssets,
      };
      if (editing) {
        await inspectionAPI.updatePlan(editing.id, payload);
        message.success('更新成功');
      } else {
        await inspectionAPI.createPlan(payload);
        message.success('创建成功');
      }
      setModalVisible(false);
      load();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || '操作失败');
    }
  };

  const handleDelete = async id => {
    try {
      await inspectionAPI.deletePlan(id);
      message.success('删除成功');
      load();
    } catch (_e) { message.error('删除失败'); }
  };

  const handleDispatch = async id => {
    try {
      const r = await inspectionAPI.dispatchPlan(id);
      message.success(`派发完成:成功 ${r.data?.success || 0} 条,失败 ${r.data?.failed || 0} 条`);
      load();
    } catch (_e) { message.error('派发失败'); }
  };

  const columns = [
    { title: '计划编号', dataIndex: 'plan_code', width: 160, fixed: 'left' },
    { title: '计划名称', dataIndex: 'plan_name', width: 200, ellipsis: true },
    {
      title: '周期', width: 160,
      render: (_, r) => (
        <span>
          <Tag color="blue">{cycleTypeMap[r.cycle_type]}</Tag>
          {r.cycle_days}天
        </span>
      ),
    },
    { title: '覆盖资产', width: 100, render: (_, r) => {
      let arr = [];
      try { arr = typeof r.asset_ids === 'string' ? JSON.parse(r.asset_ids) : (r.asset_ids || []); } catch (e) { /* ignore */ }
      return <Tag>{arr.length} 个</Tag>;
    } },
    {
      title: '下次派发', dataIndex: 'next_run_date', width: 110,
      render: v => v || '-',
    },
    {
      title: '上次派发', dataIndex: 'last_run_date', width: 110,
      render: v => v || '-',
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: v => {
        const s = statusMap[v] || statusMap.active;
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '自动转工单', dataIndex: 'auto_create_workorder', width: 100,
      render: v => v ? <Tag color="red">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '操作', width: 220, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="立即派发">
            <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleDispatch(r.id)} />
          </Tooltip>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
          <Popconfirm title="删除该计划?" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? '8px' : '24px' }}>
      <Alert
        message="巡检计划按设定周期自动派发巡检任务。可配置自动转工单,异常问题时自动创建维修工单。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card
        title={<span><ScheduleOutlined /> 巡检计划</span>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建计划
          </Button>
        }
      >
        <div className="hide-on-mobile">
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={plans}
            scroll={{ x: 1300 }}
            pagination={{
              current: page, pageSize, total,
              showSizeChanger: true,
              showTotal: t => `共 ${t} 条`,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            }}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {plans.map(r => (
            <div key={r.id} className="mobile-card-item">
              <div className="mobile-card-header">
                <span className="mobile-card-title">{r.plan_name || r.plan_code}</span>
                <Tag color={statusMap[r.status]?.color}>{statusMap[r.status]?.label}</Tag>
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-field"><span className="mobile-card-label">周期</span><span className="mobile-card-value">{cycleTypeMap[r.cycle_type]} · {r.cycle_days}天</span></div>
                <div className="mobile-card-field"><span className="mobile-card-label">下次派发</span><span className="mobile-card-value">{r.next_run_date || '-'}</span></div>
              </div>
              <div className="mobile-card-actions">
                <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleDispatch(r.id)} block>派发</Button>
                <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} block>编辑</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        title={editing ? '编辑巡检计划' : '新建巡检计划'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={isMobile ? '95vw' : 800}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="plan_name" label="计划名称" rules={[{ required: true, message: '请输入' }]}>
                <Input placeholder="如:ICU 设备月巡检" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="template_id" label="关联模板">
                <Select allowClear placeholder="选择巡检模板">
                  {templates.map(t => <Option key={t.id} value={t.id}>{t.template_name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="cycle_type" label="周期类型" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(cycleTypeMap).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="cycle_days" label="周期(天)" rules={[{ required: true }]}>
                <InputNumber min={1} max={365} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="default_priority" label="默认优先级">
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
              <Form.Item name="start_date" label="起始日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="end_date" label="截止日期(空=长期)">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="覆盖资产(留空将使用模板适用范围)">
            <Select
              mode="multiple"
              showSearch
              placeholder="搜索资产名称或编码"
              filterOption={false}
              onSearch={handleSearchAssets}
              value={selectedAssets}
              onChange={setSelectedAssets}
              style={{ width: '100%' }}
            >
              {assets.map(a => (
                <Option key={a.id} value={a.id}>{a.asset_code} - {a.asset_name}</Option>
              ))}
            </Select>
            <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
              已选 {selectedAssets.length} 个资产
            </div>
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="default_assignee_name" label="默认巡检人">
                <Input placeholder="姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="status" label="状态">
                <Select>
                  <Option value="active">运行中</Option>
                  <Option value="paused">暂停</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="auto_create_workorder" label="异常自动转工单" valuePropName="checked">
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InspectionPlans;
