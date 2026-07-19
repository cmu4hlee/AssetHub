import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Card, Tag, Modal, Form, Input, Select, DatePicker, message, Popconfirm,
  Radio, Empty, Tooltip, Alert,
} from 'antd';
import { userAPI } from '../../api/domains/users';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, CalendarOutlined,
  ThunderboltOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { poctAPI } from '../../api/domains/poct';
import { ResponsiveTable } from '../../components';
import { useCan } from '../../hooks';

const { RangePicker } = DatePicker;

const STATUS_MAP = {
  pending:      { color: 'default',   text: '待录入', icon: <ClockCircleOutlined /> },
  in_progress:  { color: 'processing',text: '进行中', icon: <ClockCircleOutlined /> },
  completed:    { color: 'success',   text: '已完成', icon: <CheckCircleOutlined /> },
  missed:       { color: 'error',     text: '已漏检', icon: <CloseCircleOutlined /> },
  skipped:      { color: 'warning',   text: '已跳过', icon: <CloseCircleOutlined /> },
};

const PoctScheduleList = () => {
  const canAdmin = useCan('poct', 'admin');
  const [view, setView] = useState('week');  // week | day
  const [baseDate, setBaseDate] = useState(dayjs());
  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [filterDept, setFilterDept] = useState();

  // 字典
  useEffect(() => {
    poctAPI.getShifts().then(r => { if (r.success) setShifts(r.data); }).catch(err => { console.warn('POCT shifts load failed:', err?.message); });
    poctAPI.getSubjects({ pageSize: 200 }).then(r => { if (r.success) setSubjects(r.data || []); }).catch(err => { console.warn('POCT subjects load failed:', err?.message); });
    import('../../api/domains/users').then(({ departmentsAPI }) => {
      departmentsAPI.getDepartments({ pageSize: 200 }).then(r => { const list = r.data?.data || r.data || []; setDepartments(Array.isArray(list) ? list : []); }).catch(err => { console.warn('POCT depts load failed:', err?.message); });
      userAPI.getUsers({ pageSize: 200 }).then(r => {
        const list = r.data?.data?.list || r.data?.data || r.data?.list || r.data || [];
        setUsers(Array.isArray(list) ? list : []);
      }).catch(() => {});
    });
  }, []);

  const dateRange = view === 'day'
    ? [baseDate, baseDate]
    : [baseDate.startOf('week'), baseDate.endOf('week')];

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [start, end] = dateRange;
      const params = {
        start_date: start.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD'),
        department_id: filterDept || undefined,
      };
      const r = await poctAPI.getSchedules(params);
      if (r.success) setData(r.data || []);
    } catch (e) { message.error('加载排班失败'); }
    finally { setLoading(false); }
  }, [dateRange, filterDept]);

  useEffect(() => { load(); }, [load]);

  // 排班按 日期+班次 分组
  const grouped = (() => {
    const m = new Map();
    data.forEach(s => {
      const k = `${s.schedule_date}__${s.shift_id}`;
      if (!m.has(k)) m.set(k, { date: s.schedule_date, shift: s, items: [] });
      m.get(k).items.push(s);
    });
    return Array.from(m.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.shift.start_time || '').localeCompare(b.shift.start_time || '');
    });
  })();

  // 单条
  const openEdit = (row) => {
    setEditing(row || { schedule_date: baseDate.format('YYYY-MM-DD') });
    form.resetFields();
    if (row) {
      form.setFieldsValue({
        ...row,
        schedule_date: dayjs(row.schedule_date),
      });
    } else {
      form.setFieldsValue({ schedule_date: baseDate });
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        schedule_date: values.schedule_date.format('YYYY-MM-DD'),
        id: editing?.id,
      };
      await poctAPI.upsertSchedule(payload);
      message.success(editing?.id ? '已更新' : '已创建');
      setEditing(null);
      load();
    } catch (e) {
      if (e.errorFields) return;
      message.error(e.response?.data?.message || '保存失败');
    }
  };

  const handleDelete = async (id) => {
    try { await poctAPI.deleteSchedule(id); message.success('已删除'); load(); }
    catch (e) { message.error(e.response?.data?.message || '删除失败'); }
  };

  // 批量生成
  const handleBatch = async () => {
    try {
      const values = await batchForm.validateFields();
      const [start, end] = values.date_range;
      const dates = [];
      let cur = start.clone();
      while (cur.isBefore(end) || cur.isSame(end, 'day')) {
        dates.push(cur.format('YYYY-MM-DD'));
        cur = cur.add(1, 'day');
      }
      const days = values.exclude_weekend ? [0, 6] : [];
      const validDates = dates.filter(d => !days.includes(dayjs(d).day()));

      // 一次性提交,服务端有 UNIQUE KEY 自动去重
      const tasks = validDates.flatMap(d =>
        values.shift_ids.flatMap(sid =>
          values.subject_ids.map(subId => ({
            schedule_date: d,
            shift_id: sid,
            department_id: values.department_id,
            subject_id: subId,
            operator_id: values.operator_id,
            backup_operator_id: values.backup_operator_id || null,
          })),
        ),
      );

      let ok = 0, fail = 0;
      // 串行提交避免连接爆掉
      for (const t of tasks) {
        try {
          await poctAPI.upsertSchedule(t);
          ok++;
        } catch { fail++; }
      }
      message.success(`批量生成完成:成功 ${ok} 条${fail ? `,失败 ${fail} 条` : ''}`);
      setBatchOpen(false);
      batchForm.resetFields();
      load();
    } catch (e) {
      if (e.errorFields) return;
      message.error(e.response?.data?.message || '生成失败');
    }
  };

  // 渲染分组
  const renderGroup = (group) => {
    const isToday = dayjs(group.date).isSame(dayjs(), 'day');
    return (
      <Card
        key={`${group.date}__${group.shift.shift_id}`}
        size="small"
        style={{ marginBottom: 12, borderLeft: `4px solid ${group.shift.color || '#1890ff'}` }}
        title={
          <Space>
            <CalendarOutlined />
            <span style={{ fontWeight: isToday ? 'bold' : 'normal' }}>
              {dayjs(group.date).format('MM-DD')}
              {isToday && <Tag color="red" style={{ marginLeft: 4 }}>今日</Tag>}
              {' '}{dayjs(group.date).format('ddd')}
            </span>
            <Tag color={group.shift.color}>{group.shift.shift_name}</Tag>
            <span style={{ color: '#999', fontSize: 12 }}>
              {group.shift.start_time?.slice(0, 5)} - {group.shift.end_time?.slice(0, 5)}
            </span>
          </Space>
        }
        extra={
          canAdmin && (
            <Button size="small" icon={<PlusOutlined />} onClick={() => openEdit({
              schedule_date: group.date, shift_id: group.shift.shift_id,
            })}>
              加科目
            </Button>
          )
        }
      >
        <ResponsiveTable
          size="small"
          rowKey="id"
          dataSource={group.items}
          pagination={false}
          columns={[
            { title: '科目', render: (_, r) => <span>{r.subject_name}<Tag style={{ marginLeft: 4 }}>{r.subject_code}</Tag></span> },
            { title: '靶值', dataIndex: 'target_value', width: 100 },
            { title: '容差', dataIndex: 'tolerance', width: 100 },
            { title: '操作人', dataIndex: 'operator_name', width: 100 },
            {
              title: '状态', dataIndex: 'status', width: 100,
              render: s => {
                const m = STATUS_MAP[s] || STATUS_MAP.pending;
                return <Tag color={m.color} icon={m.icon}>{m.text}</Tag>;
              },
            },
            {
              title: '完成时间', dataIndex: 'completed_at', width: 150,
              render: t => t ? dayjs(t).format('MM-DD HH:mm') : '-',
            },
            {
              title: '操作', width: 100, fixed: 'right',
              render: (_, r) => canAdmin ? (
                <Space>
                  <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
                  <Popconfirm title="删除排班" onConfirm={() => handleDelete(r.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ) : null,
            },
          ]}
        />
      </Card>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={<Space><CalendarOutlined /> 排班管理</Space>}
        extra={
          <Space wrap>
            <Select
              placeholder="筛选科室" allowClear style={{ width: 160 }}
              value={filterDept} onChange={setFilterDept}
              options={departments.map(d => ({ value: d.id, label: d.department_name || d.name }))}
            />
            <Radio.Group value={view} onChange={e => setView(e.target.value)}>
              <Radio.Button value="day">日</Radio.Button>
              <Radio.Button value="week">周</Radio.Button>
            </Radio.Group>
            <DatePicker
              value={baseDate}
              onChange={v => v && setBaseDate(v)}
              allowClear={false}
            />
            <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
            {canAdmin && (
              <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => {
                batchForm.resetFields();
                batchForm.setFieldsValue({ date_range: [baseDate, baseDate.add(6, 'day')] });
                setBatchOpen(true);
              }}>
                批量生成排班
              </Button>
            )}
          </Space>
        }
      >
        {data.length === 0 ? (
          <Empty
            description={
              <div>
                <div>{view === 'day' ? '当日' : '本周'}暂无排班</div>
                {canAdmin && <div style={{ marginTop: 8, fontSize: 12 }}>点击右上角「批量生成排班」或「加科目」开始排班</div>}
              </div>
            }
          />
        ) : (
          <Alert
            message={`${view === 'day' ? '当日' : '本周'}共 ${grouped.length} 个班次, ${data.length} 条排班`}
            type="info" showIcon style={{ marginBottom: 12 }}
          />
        )}
        {loading ? <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div> : grouped.map(renderGroup)}
      </Card>

      {/* 单条编辑 */}
      <Modal
        title={editing?.id ? '编辑排班' : '新增排班'}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={handleSave}
        destroyOnHidden      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="schedule_date" label="日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="shift_id" label="班次" rules={[{ required: true }]}>
            <Select options={shifts.map(s => ({ value: s.id, label: s.shift_name }))} />
          </Form.Item>
          <Form.Item name="department_id" label="科室" rules={[{ required: true }]}>
            <Select options={departments.map(d => ({ value: d.id, label: d.department_name || d.name }))} />
          </Form.Item>
          <Form.Item name="subject_id" label="监测科目" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={subjects.map(s => ({ value: s.id, label: `${s.subject_name} (${s.subject_code})` }))}
            />
          </Form.Item>
          <Form.Item name="operator_id" label="主操作人" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="搜索姓名/用户名"
              options={users.map(u => ({ value: u.id, label: u.real_name ? `${u.real_name} (${u.username})` : u.username }))}
            />
          </Form.Item>
          <Form.Item name="backup_operator_id" label="备班人(可选)">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="搜索姓名/用户名"
              options={users.map(u => ({ value: u.id, label: u.real_name ? `${u.real_name} (${u.username})` : u.username }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量生成 */}
      <Modal
        title="批量生成排班"
        open={batchOpen}
        onCancel={() => setBatchOpen(false)}
        onOk={handleBatch}
        width={600}
        okText="生成"
        destroyOnHidden      >
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message="重复排班会自动去重(同一天同一班次同一科目同一科室只保留最新)"
        />
        <Form form={batchForm} layout="vertical" preserve={false}>
          <Form.Item name="date_range" label="日期范围" rules={[{ required: true }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="shift_ids" label="班次(可多选)" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              options={shifts.map(s => ({ value: s.id, label: s.shift_name }))}
              placeholder="如选早班+中班+晚班"
            />
          </Form.Item>
          <Form.Item name="subject_ids" label="监测科目(可多选)" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              options={subjects.map(s => ({ value: s.id, label: `${s.subject_name} (${s.subject_code})` }))}
              placeholder="如选血糖+血气"
            />
          </Form.Item>
          <Form.Item name="department_id" label="科室" rules={[{ required: true }]}>
            <Select options={departments.map(d => ({ value: d.id, label: d.department_name || d.name }))} />
          </Form.Item>
          <Form.Item name="operator_id" label="主操作人" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="搜索姓名/用户名"
              options={users.map(u => ({ value: u.id, label: u.real_name ? `${u.real_name} (${u.username})` : u.username }))}
            />
          </Form.Item>
          <Form.Item name="backup_operator_id" label="备班人(可选)">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="搜索姓名/用户名"
              options={users.map(u => ({ value: u.id, label: u.real_name ? `${u.real_name} (${u.username})` : u.username }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PoctScheduleList;
