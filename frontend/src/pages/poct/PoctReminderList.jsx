import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Card, Tag, Modal, Form, Input, Select, InputNumber, Switch, message, Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, BellOutlined } from '@ant-design/icons';
import { poctAPI } from '../../api/domains/poct';
import { ResponsiveTable } from '../../components';
import { useCan } from '../../hooks';

const CHANNEL_OPTIONS = [
  { value: 'site',   label: '站内消息', color: 'blue' },
  { value: 'feishu', label: '飞书',     color: 'cyan' },
  { value: 'wechat', label: '微信',     color: 'green' },
  { value: 'sms',    label: '短信',     color: 'orange' },
];

const RECIPIENT_TYPE_OPTIONS = [
  { value: 'operator', label: '当班操作人' },
  { value: 'role',     label: '指定角色' },
  { value: 'user_list',label: '指定用户列表' },
];

const PoctReminderList = () => {
  const canAdmin = useCan('poct', 'admin');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await poctAPI.getReminders();
      if (r.success) setData(r.data || []);
    } catch (e) { message.error('加载提醒规则失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 字典
  useEffect(() => {
    poctAPI.getShifts().then(r => { if (r.success) setShifts(r.data); }).catch(err => { console.warn('POCT shifts load failed:', err?.message); });
    import('../../api/domains/users').then(({ departmentsAPI }) => {
      departmentsAPI.getDepartments({ pageSize: 200 }).then(r => { const list = r.data?.data || r.data || []; setDepartments(Array.isArray(list) ? list : []); }).catch(err => { console.warn('POCT depts load failed:', err?.message); });
    });
  }, []);

  const openEdit = (row) => {
    setEditing(row || {});
    form.resetFields();
    if (row) {
      form.setFieldsValue({
        ...row,
        channels: typeof row.channels === 'string' ? JSON.parse(row.channels) : row.channels,
        recipient_ids: typeof row.recipient_ids === 'string'
          ? JSON.parse(row.recipient_ids) : row.recipient_ids,
      });
    } else {
      form.setFieldsValue({
        offset_minutes: 30,
        channels: ['site', 'feishu', 'wechat'],
        recipient_type: 'operator',
        is_active: 1,
      });
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing?.id) {
        await poctAPI.updateReminder(editing.id, values);
        message.success('已更新');
      } else {
        await poctAPI.upsertReminder(values);
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
    try { await poctAPI.deleteReminder(id); message.success('已删除'); load(); }
    catch (e) { message.error(e.response?.data?.message || '删除失败'); }
  };

  const handleToggle = async (row) => {
    try {
      await poctAPI.updateReminder(row.id, { is_active: row.is_active ? 0 : 1 });
      load();
    } catch (e) { message.error('切换失败'); }
  };

  const columns = [
    { title: '规则名称', dataIndex: 'name', width: 180 },
    {
      title: '适用班次', dataIndex: 'shift_name', width: 110,
      render: t => t ? <Tag color="blue">{t}</Tag> : <Tag>全部</Tag>,
    },
    {
      title: '适用科室', dataIndex: 'department_name', width: 140,
      render: t => t ? <Tag>{t}</Tag> : <Tag color="default">全部</Tag>,
      ellipsis: true,
    },
    {
      title: '班前', dataIndex: 'offset_minutes', width: 100,
      render: t => <b>{t}</b>,
    },
    {
      title: '通知渠道', dataIndex: 'channels', width: 220,
      render: (channels) => {
        const list = typeof channels === 'string' ? JSON.parse(channels) : channels;
        return (list || []).map(c => {
          const opt = CHANNEL_OPTIONS.find(o => o.value === c);
          return <Tag key={c} color={opt?.color}>{opt?.label || c}</Tag>;
        });
      },
    },
    {
      title: '接收人', dataIndex: 'recipient_type', width: 110,
      render: t => {
        const map = { operator: '当班人', role: '角色', user_list: '用户列表' };
        return <Tag>{map[t] || t}</Tag>;
      },
    },
    {
      title: '启用', dataIndex: 'is_active', width: 90,
      render: (v, r) => canAdmin
        ? <Switch checked={!!v} onChange={() => handleToggle(r)} />
        : v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', width: 160 },
    {
      title: '操作', width: 140, fixed: 'right',
      render: (_, r) => canAdmin ? (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ) : <Tag>无权限</Tag>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title={<Space><BellOutlined /> 提醒规则</Space>} extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          {canAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit({})}>新增规则</Button>}
        </Space>
      }>
        <ResponsiveTable rowKey="id" loading={loading} dataSource={data} columns={columns} pagination={false} scroll={{ x: 1200 }} />
      </Card>

      <Modal
        title={editing?.id ? '编辑提醒规则' : '新增提醒规则'}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={handleSave}
        width={620}
        destroyOnHidden      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请填写名称' }]}>
            <Input placeholder="如:早班质控提醒" />
          </Form.Item>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="shift_id" label="适用班次" style={{ width: '50%' }}>
              <Select allowClear placeholder="全部班次" options={shifts.map(s => ({ value: s.id, label: s.shift_name }))} />
            </Form.Item>
            <Form.Item name="department_id" label="适用科室" style={{ width: '50%', marginLeft: 8 }}>
              <Select allowClear placeholder="全部科室" options={departments.map(d => ({ value: d.id, label: d.department_name || d.name }))} />
            </Form.Item>
          </Space.Compact>
          <Form.Item name="offset_minutes" label="班前提醒分钟数" rules={[{ required: true }]}>
            <InputNumber min={0} max={1440} style={{ width: '100%' }} addonAfter="分钟" />
          </Form.Item>
          <Form.Item name="channels" label="通知渠道" rules={[{ required: true, message: '至少选一个渠道' }]}>
            <Select mode="multiple" options={CHANNEL_OPTIONS} placeholder="选择通知渠道" />
          </Form.Item>
          <Form.Item name="recipient_type" label="接收人" rules={[{ required: true }]}>
            <Select options={RECIPIENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.recipient_type !== curr.recipient_type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('recipient_type');
              if (type === 'role') {
                return (
                  <Form.Item name="role_code" label="角色编码" rules={[{ required: true }]}>
                    <Input placeholder="如 nurse / doctor / poct_operator" />
                  </Form.Item>
                );
              }
              if (type === 'user_list') {
                return (
                  <Form.Item name="recipient_ids" label="用户ID列表">
                    <Select mode="tags" placeholder="输入用户ID回车添加" style={{ width: '100%' }} />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PoctReminderList;
