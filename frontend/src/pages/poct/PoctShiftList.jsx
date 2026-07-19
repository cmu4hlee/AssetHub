import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Card, Tag, Modal, Form, Input, InputNumber, ColorPicker, message, Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { poctAPI } from '../../api/domains/poct';
import { ResponsiveTable } from '../../components';
import { useCan } from '../../hooks';

const PoctShiftList = () => {
  const canAdmin = useCan('poct', 'admin');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await poctAPI.getShifts();
      if (r.success) setData(r.data || []);
    } catch (e) { message.error('加载班次失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (row) => {
    setEditing(row || {});
    form.resetFields();
    if (row) form.setFieldsValue(row);
    else form.setFieldsValue({ default_reminder_offset_minutes: 30, sort_order: 0 });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (values.color && typeof values.color === 'object') values.color = values.color.toHexString();
      if (editing?.id) {
        await poctAPI.updateShift(editing.id, values);
        message.success('已更新');
      } else {
        await poctAPI.createShift(values);
        message.success('已创建');
      }
      setEditing(null);
      load();
    } catch (e) {
      if (e.errorFields) return;
      message.error(e.response?.data?.message || '保存失败');
    }
  };

  const handleDelete = async (id) => {
    try { await poctAPI.deleteShift(id); message.success('已删除'); load(); }
    catch (e) { message.error(e.response?.data?.message || '删除失败'); }
  };

  const columns = [
    { title: '班次编码', dataIndex: 'shift_code', width: 120 },
    { title: '班次名称', dataIndex: 'shift_name', width: 120 },
    { title: '开始时间', dataIndex: 'start_time', width: 110 },
    { title: '结束时间', dataIndex: 'end_time', width: 110 },
    { title: '提醒提前(分钟)', dataIndex: 'default_reminder_offset_minutes', width: 130 },
    {
      title: '标识色', dataIndex: 'color', width: 100,
      render: c => c ? <Tag color={c}>{c}</Tag> : '-',
    },
    { title: '排序', dataIndex: 'sort_order', width: 80 },
    {
      title: '来源', dataIndex: 'is_builtin', width: 100,
      render: v => v ? <Tag color="blue">系统预置</Tag> : <Tag color="green">自定义</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: s => s === 'active' ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '操作', width: 150, fixed: 'right',
      render: (_, r) => canAdmin ? (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除" disabled={r.is_builtin} onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={r.is_builtin}>删除</Button>
          </Popconfirm>
        </Space>
      ) : <Tag>无权限</Tag>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="班次设置(早 / 中 / 晚)" extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          {canAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit({})}>新增班次</Button>}
        </Space>
      }>
        <ResponsiveTable rowKey="id" loading={loading} dataSource={data} columns={columns} pagination={false} />
      </Card>

      <Modal
        title={editing?.id ? '编辑班次' : '新增班次'}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={handleSave}
        destroyOnHidden      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="shift_code" label="班次编码" rules={[{ required: true, message: '请填写编码' }]}>
            <Input placeholder="morning / noon / evening / 自定义" disabled={editing?.is_builtin} />
          </Form.Item>
          <Form.Item name="shift_name" label="班次名称" rules={[{ required: true }]}>
            <Input placeholder="早班 / 中班 / 晚班" />
          </Form.Item>
          <Form.Item name="start_time" label="开始时间" rules={[{ required: true }]}>
            <Input type="time" />
          </Form.Item>
          <Form.Item name="end_time" label="结束时间" rules={[{ required: true }]}>
            <Input type="time" />
          </Form.Item>
          <Form.Item name="default_reminder_offset_minutes" label="默认班前提醒(分钟)">
            <InputNumber min={0} max={1440} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="color" label="标识色">
            <ColorPicker />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PoctShiftList;
