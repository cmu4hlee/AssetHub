import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Space, Card, Tag, Modal, Form, InputNumber, message, Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { poctAPI } from '../../api/domains/poct';
import { ResponsiveTable } from '../../components';
import { useCan } from '../../hooks';

const PoctSubjectList = () => {
  const canAdmin = useCan('poct', 'admin');
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState();
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await poctAPI.getSubjects({ keyword, category, pageSize: 200 });
      if (r.success) setData(r.data || []);
    } catch (e) { message.error('加载科目失败'); }
    finally { setLoading(false); }
  }, [keyword, category]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (row) => {
    setEditing(row || {});
    form.resetFields();
    if (row) form.setFieldsValue(row);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing?.id) {
        await poctAPI.updateSubject(editing.id, values);
        message.success('已更新');
      } else {
        await poctAPI.createSubject(values);
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
    try {
      await poctAPI.deleteSubject(id);
      message.success('已删除');
      load();
    } catch (e) { message.error(e.response?.data?.message || '删除失败'); }
  };

  const columns = [
    { title: t('poct:subject.code'), dataIndex: 'subject_code', width: 100 },
    { title: t('poct:subject.name'), dataIndex: 'subject_name', width: 200 },
    { title: t('poct:subject.category'), dataIndex: 'category', width: 130 },
    { title: t('poct:subject.unit'), dataIndex: 'unit', width: 100 },
    { title: t('poct:subject.range'), dataIndex: 'reference_range', width: 130 },
    { title: '靶值', dataIndex: 'target_value', width: 100 },
    { title: '容差', dataIndex: 'tolerance', width: 100 },
    {
      title: '来源', dataIndex: 'is_builtin', width: 90,
      render: v => v ? <Tag color="blue">{t('poct:subject.builtin')}</Tag> : <Tag color="green">{t('poct:subject.custom')}</Tag>,
    },
    {
      title: '操作', width: 150, fixed: 'right',
      render: (_, r) => canAdmin ? (
        <Space>
          <Button size="small" icon={<EditOutlined />} disabled={r.is_builtin} onClick={() => openEdit(r)}>{t('poct:common.edit')}</Button>
          <Popconfirm title={t('poct:common.confirmDelete')} disabled={r.is_builtin} onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={r.is_builtin}>{t('poct:common.delete')}</Button>
          </Popconfirm>
        </Space>
      ) : <Tag>{t('poct:common.noPermission')}</Tag>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title={t('poct:subject.title')} extra={
        <Space>
          <Select
            placeholder="分类" allowClear style={{ width: 140 }} value={category}
            onChange={setCategory}
            options={['血糖类', '血气类', '血液学', '凝血类', '心肌标志物', '尿液类', '炎症标志物', '代谢', '电解质']
              .map(c => ({ value: c, label: c }))}
          />
          <Input.Search placeholder="编码/名称" allowClear style={{ width: 200 }} onSearch={setKeyword} />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          {canAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit({})}>新增科目</Button>}
        </Space>
      }>
        <ResponsiveTable rowKey="id" loading={loading} dataSource={data} columns={columns} scroll={{ x: 1200 }} pagination={{ pageSize: 20 }} />
      </Card>

      <Modal
        title={editing?.id ? '编辑科目' : '新增科目'}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={handleSave}
        destroyOnHidden      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="subject_code" label="编码" rules={[{ required: true, message: '请填写编码' }]}>
            <Input placeholder="如 GLU" disabled={editing?.is_builtin} />
          </Form.Item>
          <Form.Item name="subject_name" label="名称" rules={[{ required: true, message: '请填写名称' }]}>
            <Input placeholder="如 血糖" disabled={editing?.is_builtin} />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select allowClear options={['血糖类', '血气类', '血液学', '凝血类', '心肌标志物', '尿液类', '炎症标志物', '代谢', '电解质'].map(c => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="unit" label="单位"><Input placeholder="如 mmol/L" /></Form.Item>
          <Form.Item name="reference_range" label="参考范围"><Input placeholder="如 3.9-6.1" /></Form.Item>
          <Form.Item name="target_value" label="质控靶值"><Input placeholder="如 5.5" /></Form.Item>
          <Form.Item name="tolerance" label="允许偏差"><Input placeholder="如 ±10%" /></Form.Item>
          <Form.Item name="description" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PoctSubjectList;
