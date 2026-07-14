import React, { useState, useEffect, useCallback } from 'react';
import { useCan, useIsMobile } from '../hooks';
import {
  Table,
  Button,
  Tag,
  Modal,
  message,
  Space,
  Input,
  Select,
  Popconfirm,
  Form,
  InputNumber,
  Switch,
  Card,
  Typography,
} from 'antd';

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { api } from '../utils/api';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

const AcceptanceTemplateList = () => {
  const canDelete = useCan('maintenance', 'delete');
  const canEdit = useCan('maintenance', 'edit');
  const isMobile = useIsMobile();
  const [data, setData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { grouped: false };
      if (keyword.trim()) params.keyword = keyword.trim();
      if (categoryFilter) params.category = categoryFilter;
      const resp = await api.get('/acceptance-management/templates', { params });
      if (resp.success) {
        const list = Array.isArray(resp.data) ? resp.data : resp.data?.data || [];
        setData(list);
      } else {
        message.error(resp.message || '获取模板列表失败');
      }
    } catch (error) {
      console.error('获取模板列表失败:', error);
      message.error('获取模板列表失败');
    } finally {
      setLoading(false);
    }
  }, [keyword, categoryFilter]);

  const loadCategories = useCallback(async () => {
    try {
      const resp = await api.get('/acceptance-management/templates/categories');
      if (resp.success) {
        const list = Array.isArray(resp.data) ? resp.data : resp.data?.data || [];
        setCategories(list);
      }
    } catch (error) {
      console.error('获取分类列表失败:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadCategories();
  }, [loadData, loadCategories]);

  const handleSearch = (value) => {
    setKeyword(value);
  };

  const handleCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ is_required: true, is_enabled: true, sort_order: 0 });
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      asset_category: record.asset_category,
      template_name: record.template_name,
      template_description: record.template_description,
      category: record.category,
      item_name: record.item_name,
      item_description: record.item_description,
      is_required: record.is_required === 1,
      sort_order: record.sort_order ?? 0,
      is_enabled: record.is_enabled === 1,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      const resp = await api.delete(`/acceptance-management/templates/${id}`);
      if (resp.success) {
        message.success('删除成功');
        loadData();
      } else {
        message.error(resp.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      let resp;
      if (editingRecord) {
        resp = await api.put(`/acceptance-management/templates/${editingRecord.id}`, values);
      } else {
        resp = await api.post('/acceptance-management/templates', values);
      }
      if (resp.success) {
        message.success(editingRecord ? '更新成功' : '创建成功');
        setModalOpen(false);
        loadData();
        loadCategories();
      } else {
        message.error(resp.message || (editingRecord ? '更新失败' : '创建失败'));
      }
    } catch (error) {
      if (error?.errorFields) return;
      console.error('提交失败:', error);
      message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'template_name',
      key: 'template_name',
      width: 160,
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: text => text ? <Tag color="blue">{text}</Tag> : '-',
    },
    {
      title: '资产类别',
      dataIndex: 'asset_category',
      key: 'asset_category',
      width: 120,
      ellipsis: true,
    },
    {
      title: '检查项名称',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 160,
      ellipsis: true,
    },
    {
      title: '检查项描述',
      dataIndex: 'item_description',
      key: 'item_description',
      ellipsis: true,
    },
    {
      title: '是否必检',
      dataIndex: 'is_required',
      key: 'is_required',
      width: 90,
      render: val => (val === 1 ? <Tag color="red">必检</Tag> : <Tag>选检</Tag>),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
    },
    {
      title: '启用',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      width: 80,
      render: val => (val === 1 ? <Tag color="green">启用</Tag> : <Tag color="default">禁用</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除该模板？" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Title level={2} style={{ margin: 0 }}>验收模板管理</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增模板
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Search
            placeholder="搜索模板名称/检查项..."
            allowClear
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
          <Select
            placeholder="按分类筛选"
            allowClear
            style={{ width: 180 }}
            value={categoryFilter || undefined}
            onChange={setCategoryFilter}
          >
            {categories.map(cat => (
              <Option key={cat} value={cat}>{cat}</Option>
            ))}
          </Select>
        </Space>
      </Card>

      <div className="hide-on-mobile">
        <Table
          dataSource={data}
          columns={columns}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1200 }}
        />
      </div>
      <div className="mobile-table-cards show-on-mobile">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
        ) : Array.isArray(data) && data.length > 0 ? (
          data.map(record => (
            <div key={record.id} className="mobile-card-item">
              <div className="mobile-card-header">
                <span className="mobile-card-title">{record.template_name}</span>
                {record.is_enabled === 1 ? (
                  <Tag color="green">启用</Tag>
                ) : (
                  <Tag>禁用</Tag>
                )}
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-field">
                  <span className="mobile-card-label">分类</span>
                  <span className="mobile-card-value">{record.category || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">资产类别</span>
                  <span className="mobile-card-value">{record.asset_category || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">检查项名称</span>
                  <span className="mobile-card-value">{record.item_name || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">是否必检</span>
                  <span className="mobile-card-value">
                    {record.is_required === 1 ? <Tag color="red">必检</Tag> : <Tag>选检</Tag>}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
        )}
      </div>

      <Modal
        title={editingRecord ? '编辑验收模板' : '新增验收模板'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="template_name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="请输入模板名称" />
          </Form.Item>
          <Form.Item name="template_description" label="模板描述">
            <Input.TextArea rows={2} placeholder="请输入模板描述" />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select
              placeholder="选择分类"
              showSearch
              allowClear
            >
              {categories.map(cat => (
                <Option key={cat} value={cat}>{cat}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="asset_category" label="资产类别">
            <Input placeholder="请输入资产类别，如：医疗设备、通用设备" />
          </Form.Item>
          <Form.Item
            name="item_name"
            label="检查项名称"
            rules={[{ required: true, message: '请输入检查项名称' }]}
          >
            <Input placeholder="请输入检查项名称" />
          </Form.Item>
          <Form.Item name="item_description" label="检查项描述">
            <Input.TextArea rows={2} placeholder="请输入检查项描述" />
          </Form.Item>
          <Space size="large">
            <Form.Item name="is_required" label="是否必检" valuePropName="checked">
              <Switch checkedChildren="必检" unCheckedChildren="选检" />
            </Form.Item>
            <Form.Item name="is_enabled" label="是否启用" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
            <Form.Item name="sort_order" label="排序">
              <InputNumber min={0} placeholder="0" style={{ width: 120 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default AcceptanceTemplateList;
