/**
 * 日常保养模板列表
 *
 * 接收 maintenanceLevel prop，按级别过滤模板。
 * 功能：列表展示、新增、编辑、删除。模板包含保养项目清单，创建计划时可直接引用。
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Space, Modal, Form, Select, message,
  Popconfirm, Card, Row, Col, Tag, Divider, InputNumber,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  ReloadOutlined, CopyOutlined,
} from '@ant-design/icons';
import { dailyMaintenanceAPI } from '../../utils/api';

const { TextArea } = Input;
const { Option } = Select;

const CYCLE_TYPES = ['按天', '按周', '按月', '按季度', '按年'];
const LEVEL_LABELS = { level1: '临床一级保养', level2: '医工二级保养' };

const DailyMaintenanceTemplateList = ({ maintenanceLevel = 'level1' }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [keyword, setKeyword] = useState('');
  const [modal, setModal] = useState({ visible: false, editId: null });
  const [form] = Form.useForm();
  const [items, setItems] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dailyMaintenanceAPI.getTemplates({
        page: pagination.page,
        pageSize: pagination.pageSize,
        keyword,
        maintenanceLevel,
      });
      // res 是 normalizer 包装的 {success, data, pagination, rawData}
      // res.data 已经是 array (normalizer.extractList 处理)
      setData(Array.isArray(res.data) ? res.data : []);
      if (res.pagination) {
        setPagination(prev => ({ ...prev, total: res.pagination.total || 0 }));
      }
    } catch (e) {
      message.error('加载模板失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, keyword, maintenanceLevel]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1, total: 0 }));
    setKeyword('');
  }, [maintenanceLevel]);

  const openCreate = () => {
    setModal({ visible: true, editId: null });
    form.resetFields();
    form.setFieldsValue({
      maintenance_level: maintenanceLevel,
      cycle_type: '按月',
      cycle_value: 1,
      status: '启用',
    });
    setItems([]);
  };

  const openEdit = (record) => {
    setModal({ visible: true, editId: record.id });
    form.setFieldsValue(record);
    // 解析保养项目
    let parsedItems = [];
    if (record.maintenance_items) {
      try {
        parsedItems = typeof record.maintenance_items === 'string'
          ? JSON.parse(record.maintenance_items) : record.maintenance_items;
      } catch (e) { /* 静默 */ }
    }
    setItems(Array.isArray(parsedItems) ? parsedItems : []);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        maintenance_items: items.length > 0 ? JSON.stringify(items) : null,
      };
      if (modal.editId) {
        await dailyMaintenanceAPI.updateTemplate(modal.editId, payload);
        message.success('模板更新成功');
      } else {
        await dailyMaintenanceAPI.createTemplate(payload);
        message.success('模板创建成功');
      }
      setModal({ visible: false, editId: null });
      fetchData();
    } catch (e) {
      if (e.errorFields) return;
      message.error('保存失败: ' + (e.message || ''));
    }
  };

  const handleDelete = async (id) => {
    try {
      await dailyMaintenanceAPI.deleteTemplate(id);
      message.success('删除成功');
      fetchData();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const addItem = () => setItems(prev => [...prev, { item: '', standard: '', method: '' }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const columns = [
    { title: '模板名称', dataIndex: 'template_name', key: 'template_name', width: 180, ellipsis: true },
    { title: '编码', dataIndex: 'code', key: 'code', width: 120, ellipsis: true },
    { title: '分类', dataIndex: 'category', key: 'category', width: 120, ellipsis: true },
    { title: '资产类型', dataIndex: 'asset_type', key: 'asset_type', width: 120, ellipsis: true },
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 100, ellipsis: true },
    { title: '型号', dataIndex: 'model', key: 'model', width: 100, ellipsis: true },
    {
      title: '建议周期', key: 'cycle', width: 100,
      render: (_, r) => r.cycle_type ? `每${r.cycle_value || 1}${r.cycle_type.replace('按', '')}` : '-',
    },
    {
      title: '项目数', key: 'item_count', width: 80,
      render: (_, r) => {
        let count = 0;
        if (r.maintenance_items) {
          try {
            const parsed = JSON.parse(r.maintenance_items);
            count = Array.isArray(parsed) ? parsed.length : 0;
          } catch (e) { /* 静默 */ }
        }
        return <Tag>{count}</Tag>;
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s) => <Tag color={s === '启用' ? 'green' : 'default'}>{s}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="确定删除此模板？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索模板名称/编码/分类"
          allowClear
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onSearch={() => { setPagination(prev => ({ ...prev, page: 1 })); fetchData(); }}
          style={{ width: 280 }}
        />
        <Button icon={<ReloadOutlined />} onClick={() => { setPagination(prev => ({ ...prev, page: 1 })); fetchData(); }}>刷新</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增模板</Button>
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

      {/* 新增/编辑模板弹窗 */}
      <Modal
        title={modal.editId ? '编辑模板' : '新增模板'}
        open={modal.visible}
        onOk={handleSave}
        onCancel={() => setModal({ visible: false, editId: null })}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="template_name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
                <Input placeholder="如：呼吸机一级保养模板" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="code" label="模板编码">
                <Input placeholder="如：DM-L1-001" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="maintenance_level" label="保养级别" rules={[{ required: true }]}>
                <Select>
                  <Option value="level1">临床一级保养</Option>
                  <Option value="level2">医工二级保养</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="category" label="分类">
                <Input placeholder="如：生命支持" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="asset_type" label="适用资产类型">
                <Input placeholder="如：呼吸机" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="brand" label="品牌">
                <Input placeholder="如：迈瑞" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="model" label="型号">
                <Input placeholder="如：SV800" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="cycle_type" label="建议周期类型">
                <Select>
                  {CYCLE_TYPES.map(t => <Option key={t} value={t}>{t}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="cycle_value" label="建议周期值">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="estimated_hours" label="预计工时(小时)">
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="状态">
                <Select>
                  <Option value="启用">启用</Option>
                  <Option value="停用">停用</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="maintenance_content" label="保养内容说明">
            <TextArea rows={2} placeholder="保养内容、注意事项等" />
          </Form.Item>

          <Divider>保养项目清单</Divider>
          {items.length === 0 && (
            <Card size="small" style={{ marginBottom: 16, textAlign: 'center', color: '#999' }}>
              暂无保养项目，点击下方按钮添加
            </Card>
          )}
          {items.map((item, idx) => (
            <Row key={idx} gutter={8} style={{ marginBottom: 8 }} align="middle">
              <Col span={7}>
                <Input placeholder="项目名称" value={item.item} onChange={e => updateItem(idx, 'item', e.target.value)} />
              </Col>
              <Col span={7}>
                <Input placeholder="标准/要求" value={item.standard} onChange={e => updateItem(idx, 'standard', e.target.value)} />
              </Col>
              <Col span={8}>
                <Input placeholder="检查方法" value={item.method} onChange={e => updateItem(idx, 'method', e.target.value)} />
              </Col>
              <Col span={2}>
                <Button danger icon={<DeleteOutlined />} onClick={() => removeItem(idx)} />
              </Col>
            </Row>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={addItem} style={{ width: '100%' }}>
            添加保养项目
          </Button>

          <Form.Item name="description" label="模板描述" style={{ marginTop: 16 }}>
            <TextArea rows={2} placeholder="模板用途、适用范围等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DailyMaintenanceTemplateList;
