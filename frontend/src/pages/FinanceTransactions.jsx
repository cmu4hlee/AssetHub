import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Space, Modal, Form, Input, Select,
  InputNumber, DatePicker, message, Tag, Popconfirm
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, ExportOutlined,
  EditOutlined, DeleteOutlined, DollarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { financeAPI } from '../utils/api';
import useIsMobile from '../hooks/useIsMobile';
import { ResponsiveTable } from '../components';

const TRANSACTION_CATEGORIES = {
  income: [
    { value: 'service_income', label: '服务收入' },
    { value: 'equipment_sale', label: '设备出售' },
    { value: 'rental_income', label: '租赁收入' },
    { value: 'subsidy', label: '补贴收入' },
    { value: 'other_income', label: '其他收入' },
  ],
  expense: [
    { value: 'equipment_purchase', label: '设备采购' },
    { value: 'maintenance_cost', label: '维修维护费' },
    { value: 'consumables', label: '耗材支出' },
    { value: 'insurance', label: '保险费用' },
    { value: 'tax', label: '税费' },
    { value: 'labor', label: '人工费用' },
    { value: 'other_expense', label: '其他支出' },
  ],
};

const FinanceTransactions = () => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [filters, setFilters] = useState({});

  const fetchData = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = { ...filters, page, pageSize };
      if (params.dateRange) {
        params.start_date = params.dateRange[0]?.format('YYYY-MM-DD');
        params.end_date = params.dateRange[1]?.format('YYYY-MM-DD');
        delete params.dateRange;
      }
      const res = await financeAPI.getTransactions(params);
      if (res.success) {
        setData(res.data.list || []);
        setPagination({
          page: res.data.pagination?.page || 1,
          pageSize: res.data.pagination?.pageSize || 20,
          total: res.data.pagination?.total || 0
        });
      }
    } catch (e) {
      message.error('获取收支记录失败: ' + (e.message || '网络错误'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleSearch = () => {
    const values = searchForm.getFieldsValue();
    const clean = {};
    Object.keys(values).forEach(k => { if (values[k] !== undefined && values[k] !== null && values[k] !== '') clean[k] = values[k]; });
    setFilters(clean);
  };

  const handleReset = () => {
    searchForm.resetFields();
    setFilters({});
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ transaction_date: dayjs() });
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({ ...record, transaction_date: record.transaction_date ? dayjs(record.transaction_date) : undefined });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      const res = await financeAPI.deleteTransaction(id);
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
      const payload = { ...values, transaction_date: values.transaction_date.format('YYYY-MM-DD') };
      let res;
      if (editingRecord) {
        res = await financeAPI.updateTransaction(editingRecord.id, payload);
      } else {
        res = await financeAPI.createTransaction(payload);
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

  const handleExport = async () => {
    try {
      const blob = await financeAPI.exportTransactions({});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `收支记录_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      message.error('导出失败');
    }
  };

  const [transactionType, setTransactionType] = useState('expense');

  const columns = [
    {
      title: '日期', dataIndex: 'transaction_date', width: 110,
      render: v => v ? dayjs(v).format('YYYY-MM-DD') : '-'
    },
    {
      title: '类型', dataIndex: 'transaction_type', width: 80,
      render: v => <Tag color={v === 'income' ? 'green' : 'red'}>{v === 'income' ? '收入' : '支出'}</Tag>
    },
    { title: '类别', dataIndex: 'category', width: 120 },
    {
      title: '金额(元)', dataIndex: 'amount', width: 120, align: 'right',
      render: (v, r) => (
        <span style={{ color: r.transaction_type === 'income' ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
          {r.transaction_type === 'income' ? '+' : '-'}
          ¥{Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    { title: '资产编码', dataIndex: 'asset_code', width: 120 },
    { title: '凭证号', dataIndex: 'voucher_no', width: 120 },
    { title: '说明', dataIndex: 'description', width: 160, ellipsis: true },
    { title: '创建人', dataIndex: 'created_by', width: 100 },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right',
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

  return (
    <div style={{ padding: isMobile ? 8 : 16 }}>
      <Card
        title={<Space><DollarOutlined /><span>收支记录</span></Space>}
        extra={
          isMobile ? (
            <Space wrap>
              <Button icon={<ExportOutlined />} onClick={handleExport} size="small">导出</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="small">新增</Button>
            </Space>
          ) : (
            <Space>
              <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增记录</Button>
            </Space>
          )
        }
      >
        <Form form={searchForm} layout={isMobile ? 'vertical' : 'inline'} style={{ marginBottom: 16 }}>
          <Form.Item name="transaction_type" style={{ marginBottom: isMobile ? 8 : 0 }}>
            <Select placeholder="收支类型" style={{ width: 110 }} allowClear>
              <Select.Option value="income">收入</Select.Option>
              <Select.Option value="expense">支出</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="category" style={{ marginBottom: isMobile ? 8 : 0 }}>
            <Input placeholder="类别" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="dateRange" style={{ marginBottom: isMobile ? 8 : 0 }}>
            <DatePicker.RangePicker style={{ width: 240 }} />
          </Form.Item>
          <Form.Item name="keyword" style={{ marginBottom: isMobile ? 8 : 0 }}>
            <Input placeholder="关键词搜索" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item style={{ marginBottom: isMobile ? 8 : 0 }}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>

        <ResponsiveTable
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size={isMobile ? 'small' : 'middle'}
          scroll={{ x: isMobile ? 700 : 1100 }}
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
          mobileTitleKey="category"
          mobileStatusRender={r => (
            <Tag color={r.transaction_type === 'income' ? 'green' : 'red'}>
              {r.transaction_type === 'income' ? '收入' : '支出'}
            </Tag>
          )}
          mobileFields={[
            {
              label: '日期',
              key: 'transaction_date',
              render: v => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
            },
            {
              label: '金额',
              key: 'amount',
              render: (v, r) => (
                <span style={{
                  color: r.transaction_type === 'income' ? '#52c41a' : '#ff4d4f',
                  fontWeight: 600,
                }}>
                  {r.transaction_type === 'income' ? '+' : '-'}¥{Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </span>
              ),
            },
            { label: '资产编码', key: 'asset_code' },
            { label: '凭证号', key: 'voucher_no' },
            { label: '创建人', key: 'created_by' },
          ]}
          mobileActions={[
            { key: 'edit', text: '编辑', icon: <EditOutlined />, onClick: handleEdit },
            {
              key: 'delete',
              text: '删除',
              danger: true,
              icon: <DeleteOutlined />,
              confirm: '确定删除?',
              onClick: r => handleDelete(r.id),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingRecord ? '编辑收支记录' : '新增收支记录'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={isMobile ? '95%' : 500}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="transaction_type" label="收支类型" rules={[{ required: true, message: '请选择收支类型' }]}>
            <Select onChange={v => setTransactionType(v)}>
              <Select.Option value="income">💰 收入</Select.Option>
              <Select.Option value="expense">💸 支出</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="category" label="类别" rules={[{ required: true, message: '请选择或输入类别' }]}>
            <Select mode="tags" maxCount={1} placeholder="选择或输入类别">
              {(TRANSACTION_CATEGORIES[form.getFieldValue('transaction_type') || 'expense'] || []).map(c => (
                <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} precision={2} prefix="¥" />
          </Form.Item>
          <Form.Item name="transaction_date" label="日期" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="asset_code" label="关联资产编码">
            <Input placeholder="可选，输入资产编码" />
          </Form.Item>
          <Form.Item name="voucher_no" label="凭证号">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FinanceTransactions;
