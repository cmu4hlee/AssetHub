/**
 * 巡检路线管理
 * 按顺序巡检多个点位
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select, message,
  Popconfirm, InputNumber, Empty,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { inspectionAPI, assetAPI } from '../../utils/api';
import dayjs from 'dayjs';
import useIsMobile from '../../hooks/useIsMobile';

const { Option } = Select;

const InspectionRoutes = () => {
  const isMobile = useIsMobile();
  const canDelete = useCan('inspection', 'delete');
  const canEdit = useCan('inspection', 'edit');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [points, setPoints] = useState([]);
  const [assets, setAssets] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inspectionAPI.getRoutes({ page, pageSize });
      if (res?.success) {
        setRoutes(res.data || []);
        setTotal(res.pagination?.total || 0);
      }
    } catch (_e) { message.error('加载失败'); }
    finally { setLoading(false); }
  }, [page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: 'active', estimated_minutes: 60 });
    setPoints([]);
    setModalVisible(true);
  };

  const handleEdit = async record => {
    setEditing(record);
    form.setFieldsValue(record);
    const r = await inspectionAPI.getRoute(record.id);
    setPoints(r?.data?.points || []);
    setModalVisible(true);
  };

  const handleSearchAssets = async keyword => {
    if (!keyword || keyword.length < 1) { setAssets([]); return; }
    const res = await assetAPI.getAssets({ keyword, page: 1, pageSize: 30 });
    setAssets(res?.data || []);
  };

  const addPoint = () => {
    setPoints([...points, { point_order: points.length, asset_id: null, location_name: '' }]);
  };

  const removePoint = idx => {
    const next = points.filter((_, i) => i !== idx);
    next.forEach((p, i) => { p.point_order = i; });
    setPoints(next);
  };

  const updatePoint = (idx, key, val) => {
    const next = [...points];
    next[idx] = { ...next[idx], [key]: val };
    setPoints(next);
  };

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields();
      const payload = { ...v, points };
      if (editing) {
        await inspectionAPI.updateRoute(editing.id, payload);
        message.success('更新成功');
      } else {
        await inspectionAPI.createRoute(payload);
        message.success('创建成功');
      }
      setModalVisible(false);
      load();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || '操作失败');
    }
  };

  const columns = [
    { title: '路线编号', dataIndex: 'route_code', width: 160, fixed: 'left' },
    { title: '路线名称', dataIndex: 'route_name', width: 200, ellipsis: true },
    { title: '点位数量', dataIndex: 'point_count', width: 100, render: v => v || 0 },
    { title: '预计耗时(分钟)', dataIndex: 'estimated_minutes', width: 130 },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: v => v === 'active' ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '操作', width: 150, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
          <Popconfirm title="删除该路线?" onConfirm={async () => {
            try { await inspectionAPI.deleteRoute(r.id); message.success('删除成功'); load(); }
            catch (_e) { message.error('删除失败'); }
          }}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? '8px' : '24px' }}>
      <Card
        title={<span><EnvironmentOutlined /> 巡检路线</span>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建路线</Button>}
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={routes}
          scroll={{ x: 900 }}
          pagination={{
            current: page, pageSize, total,
            showSizeChanger: true,
            showTotal: t => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </Card>

      <Modal
        title={editing ? '编辑路线' : '新建路线'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={isMobile ? '95vw' : 800}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="route_name" label="路线名称" rules={[{ required: true }]}>
            <Input placeholder="如:1号楼 3 楼巡检路线" />
          </Form.Item>
          <Form.Item name="estimated_minutes" label="预计耗时(分钟)">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="巡检点位">
            <Button type="dashed" block icon={<PlusOutlined />} onClick={addPoint} style={{ marginBottom: 12 }}>
              添加点位
            </Button>
            {points.length === 0 ? (
              <Empty description="暂无点位" />
            ) : (
              <div>
                {points.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <Tag color="blue">#{idx + 1}</Tag>
                    <Select
                      showSearch
                      placeholder="搜索资产(可空,纯位置)"
                      style={{ flex: 1 }}
                      allowClear
                      filterOption={false}
                      onSearch={handleSearchAssets}
                      value={p.asset_id}
                      onChange={v => updatePoint(idx, 'asset_id', v)}
                    >
                      {assets.map(a => <Option key={a.id} value={a.id}>{a.asset_code} - {a.asset_name}</Option>)}
                    </Select>
                    <Input
                      placeholder="位置名称"
                      style={{ flex: 1 }}
                      value={p.location_name}
                      onChange={e => updatePoint(idx, 'location_name', e.target.value)}
                    />
                    <Button danger size="small" onClick={() => removePoint(idx)}>删除</Button>
                  </div>
                ))}
              </div>
            )}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InspectionRoutes;
