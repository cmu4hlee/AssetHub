import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Modal, Form, Input, Select,
  InputNumber, message, Tag, Popconfirm, Descriptions
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, ExportOutlined,
  EditOutlined, DeleteOutlined, DollarOutlined, PieChartOutlined
} from '@ant-design/icons';
import { financeAPI } from '../utils/api';
import { useDepartment } from '../contexts/DepartmentContext';
import useIsMobile from '../hooks/useIsMobile';

const BUDGET_TYPES = [
  { value: 'equipment_procurement', label: '设备采购', color: 'blue' },
  { value: 'maintenance', label: '维修维护', color: 'orange' },
  { value: 'operation', label: '运营', color: 'green' },
  { value: 'other', label: '其他', color: 'default' },
];

const FinanceBudget = () => {
  const { selectedDepartmentId } = useDepartment();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [filters, setFilters] = useState({});

  const activeDeptName = selectedDepartmentId && selectedDepartmentId !== 'all' ? selectedDepartmentId : undefined;

  const buildFilters = useCallback((extra = {}) => {
    const clean = { ...filters, ...extra };
    if (activeDeptName) clean.department_name = activeDeptName;
    return clean;
  }, [filters, activeDeptName]);

  const fetchData = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = buildFilters({ page, pageSize });
      const res = await financeAPI.getBudgets(params);
      if (res.success) {
        setData(res.data.list || []);
        setPagination({
          page: res.data.pagination?.page || 1,
          pageSize: res.data.pagination?.pageSize || 20,
          total: res.data.pagination?.total || 0
        });
      }
    } catch (e) {
      message.error('获取预算数据失败: ' + (e.message || '网络错误'));
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

  // 首次加载 + 依赖变化时获取数据
  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleSearch = () => {
    const values = searchForm.getFieldsValue();
    const clean = {};
    Object.keys(values).forEach(k => {
      if (values[k] !== undefined && values[k] !== null && values[k] !== '') {
        clean[k] = values[k];
      }
    });
    setFilters(clean); // 会触发 fetchData(page=1) 因为有 useEffect
  };

  const handleReset = () => {
    searchForm.resetFields();
    setFilters({});
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      year: new Date().getFullYear(),
      department_name: activeDeptName || ''
    });
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      const res = await financeAPI.deleteBudget(id);
      if (res.success) {
        message.success('删除成功');
        fetchData(pagination.page, pagination.pageSize);
      }
    } catch (e) {
      message.error('删除失败: ' + (e.message || '网络错误'));
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let res;
      if (editingRecord) {
        res = await financeAPI.updateBudget(editingRecord.id, values);
      } else {
        res = await financeAPI.createBudget(values);
      }
      if (res.success) {
        message.success(editingRecord ? '更新成功' : '创建成功');
        setModalOpen(false);
        fetchData(pagination.page, pagination.pageSize);
      } else {
        message.error(res.message || '操作失败');
      }
    } catch (e) {
      if (e.message) message.error('操作失败: ' + e.message);
    }
  };

  const handleShowSummary = async () => {
    setShowSummary(true);
    setSummaryLoading(true);
    try {
      const res = await financeAPI.getBudgetSummary({ year: filters.year });
      if (res.success) setSummaryData(res.data);
    } catch (e) {
      message.error('获取汇总失败');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await financeAPI.exportBudgets({ year: filters.year });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `预算数据_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (e) {
      message.error('导出失败');
    }
  };

  const columns = [
    { title: '年份', dataIndex: 'year', width: 80 },
    { title: '部门', dataIndex: 'department_name', width: 140 },
    {
      title: '预算类型', dataIndex: 'budget_type', width: 100,
      render: (v) => {
        const type = BUDGET_TYPES.find(t => t.value === v);
        return <Tag color={type?.color}>{type?.label || v}</Tag>;
      }
    },
    {
      title: '预算金额', dataIndex: 'budget_amount', width: 120, align: 'right',
      render: v => v ? Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '0.00'
    },
    {
      title: '实际执行', dataIndex: 'actual_amount', width: 120, align: 'right',
      render: (v, r) => {
        const val = v ? Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '0.00';
        const rate = r.budget_amount > 0 ? ((r.actual_amount / r.budget_amount) * 100).toFixed(1) : 0;
        return <span>{val} <Tag color={rate > 100 ? 'red' : rate > 80 ? 'green' : 'default'}>{rate}%</Tag></span>;
      }
    },
    { title: '备注', dataIndex: 'notes', width: 120, ellipsis: true },
    { title: '创建人', dataIndex: 'created_by', width: 80 },
    {
      title: '操作', key: 'action', width: 110, fixed: isMobile ? undefined : 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    },
  ];

  const searchContent = (
    <Form form={searchForm} layout={isMobile ? 'vertical' : 'inline'} style={{ marginBottom: 16 }}>
      <Form.Item name="year" style={{ marginBottom: isMobile ? 8 : 0 }}>
        <InputNumber placeholder="年份" style={{ width: 100 }} min={2000} max={2100} />
      </Form.Item>
      {!activeDeptName && (
        <Form.Item name="department_name" style={{ marginBottom: isMobile ? 8 : 0 }}>
          <Input placeholder="部门名称" style={{ width: 140 }} />
        </Form.Item>
      )}
      <Form.Item name="budget_type" style={{ marginBottom: isMobile ? 8 : 0 }}>
        <Select placeholder="预算类型" style={{ width: 120 }} allowClear>
          {BUDGET_TYPES.map(t => <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>)}
        </Select>
      </Form.Item>
      <Form.Item name="keyword" style={{ marginBottom: isMobile ? 8 : 0 }}>
        <Input placeholder="关键词" style={{ width: 140 }} />
      </Form.Item>
      <Form.Item style={{ marginBottom: isMobile ? 8 : 0 }}>
        <Space>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
        </Space>
      </Form.Item>
    </Form>
  );

  const extraButtons = isMobile ? (
    <Space wrap>
      <Button icon={<PieChartOutlined />} onClick={handleShowSummary} size="small">汇总</Button>
      <Button icon={<ExportOutlined />} onClick={handleExport} size="small">导出</Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="small">新增</Button>
    </Space>
  ) : (
    <Space>
      <Button icon={<PieChartOutlined />} onClick={handleShowSummary}>汇总统计</Button>
      <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增预算</Button>
    </Space>
  );

  return (
    <div style={{ padding: isMobile ? 8 : 16 }}>
      <Card
        title={<Space><DollarOutlined /><span>{activeDeptName ? `${activeDeptName} - ` : ''}预算管理</span></Space>}
        extra={extraButtons}
      >
        {searchContent}

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size={isMobile ? 'small' : 'middle'}
          scroll={{ x: isMobile ? 700 : 1000 }}
          pagination={isMobile ? {
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            size: 'small',
            showSizeChanger: false,
            showTotal: t => `共 ${t} 条`,
            onChange: (p) => fetchData(p, 20),
          } : {
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: t => `共 ${t} 条`,
            onChange: (p, ps) => fetchData(p, ps),
          }}
        />
      </Card>

      <Modal
        title={editingRecord ? '编辑预算' : '新增预算'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={isMobile ? '95%' : 500}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="year" label="年份" rules={[{ required: true, message: '请输入年份' }]}>
            <InputNumber style={{ width: '100%' }} min={2000} max={2100} />
          </Form.Item>
          <Form.Item name="department_name" label="部门名称" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input placeholder="如：设备科" />
          </Form.Item>
          <Form.Item name="budget_type" label="预算类型" rules={[{ required: true, message: '请选择预算类型' }]}>
            <Select>
              {BUDGET_TYPES.map(t => <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="budget_amount" label="预算金额" rules={[{ required: true, message: '请输入预算金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
          </Form.Item>
          <Form.Item name="actual_amount" label="实际执行金额">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="预算执行汇总"
        open={showSummary}
        onCancel={() => setShowSummary(false)}
        width={isMobile ? '95%' : 700}
        footer={null}
      >
        {summaryData && (
          <>
            <Descriptions bordered size="small" column={isMobile ? 1 : 2} style={{ marginBottom: 16 }}>
              {summaryData.byType?.map(t => (
                <Descriptions.Item key={t.budget_type} label={BUDGET_TYPES.find(b => b.value === t.budget_type)?.label || t.budget_type}>
                  ¥{(t.total_budget || 0).toLocaleString()} / ¥{(t.total_actual || 0).toLocaleString()}
                </Descriptions.Item>
              ))}
            </Descriptions>
            <Table
              dataSource={summaryData.byDept || []}
              rowKey="department_name"
              size="small"
              loading={summaryLoading}
              columns={[
                { title: '部门', dataIndex: 'department_name' },
                { title: '预算金额', dataIndex: 'total_budget', render: v => `¥${Number(v || 0).toLocaleString()}` },
                { title: '实际执行', dataIndex: 'total_actual', render: v => `¥${Number(v || 0).toLocaleString()}` },
                {
                  title: '执行率', key: 'rate',
                  render: (_, r) => {
                    const rate = r.total_budget > 0 ? ((r.total_actual / r.total_budget) * 100).toFixed(1) : 0;
                    return <Tag color={rate > 100 ? 'red' : rate > 80 ? 'green' : 'orange'}>{rate}%</Tag>;
                  }
                },
              ]}
              pagination={isMobile ? false : { size: 'small' }}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default FinanceBudget;
