/**
 * 临时保养管理
 *
 * 临时保养（按需/轻量维护）：
 * - 区别于正式维修工单, 适用于清洁/紧固/润滑/调试/巡检保养等轻量场景
 * - 一线人员录入: 选资产 + 选保养类型 + 记录耗时/结果/下次保养
 * - API: /api/preventive-maintenance/temporary (阶段3工单重构后统一路径)
 *
 * 实时保养中心: 该页面 + 预防性维护 + 模板 + 提醒 4 个 tab 在 PreventiveMaintenanceHub 聚合
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Table, Button, Input, Select, Space, Tag, Modal, Form, DatePicker, InputNumber, message, Popconfirm,
  Row, Col, Statistic, Drawer, Descriptions, Empty, Spin, Tooltip, Progress,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, EyeOutlined,
  ToolOutlined, CheckCircleOutlined, WarningOutlined, ClockCircleOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { maintenanceAPI, assetAPI } from '../utils/api';
import { ResponsiveTable } from '../components';
import { useIsMobile, useCan } from '../hooks';

// 保养类型 (5 类常见, 与后端 service 注释一致: 清洁/紧固/润滑/调试/巡检保养)
const TEMP_TYPE_OPTIONS = [
  { value: '清洁', color: 'blue', icon: '🧹' },
  { value: '紧固', color: 'cyan', icon: '🔧' },
  { value: '润滑', color: 'gold', icon: '🛢️' },
  { value: '调试', color: 'purple', icon: '⚙️' },
  { value: '巡检保养', color: 'green', icon: '🔍' },
  { value: '其他', color: 'default', icon: '📋' },
];

const STATUS_LABEL = {
  '已完成': { color: 'green' },
  '已取消': { color: 'red' },
  '进行中': { color: 'blue' },
};
const RESULT_LABEL = {
  '正常': { color: 'green', icon: <CheckCircleOutlined /> },
  '异常': { color: 'red', icon: <WarningOutlined /> },
};

const typeMeta = v => TEMP_TYPE_OPTIONS.find(t => t.value === v) || { color: 'default', icon: '📋' };

const PreventiveMaintenanceTemporary = () => {
  const isMobile = useIsMobile();
  const canWrite = useCan('maintenance', 'write');
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState();
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const load = useCallback(async (page = pagination.current, pageSize = pagination.pageSize) => {
    try {
      setLoading(true);
      const r = await maintenanceAPI.getTemporaryRecords({
        keyword: keyword || undefined,
        maintenance_type: type || undefined,
        page,
        pageSize,
      });
      setData(r.data || []);
      setPagination(prev => ({ ...prev, current: page, pageSize, total: r.total || 0 }));
    } catch (e) {
      message.error('加载临时保养失败');
    } finally {
      setLoading(false);
    }
  }, [keyword, type, pagination.current, pagination.pageSize]);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const r = await maintenanceAPI.getTemporaryStatistics();
      if (r.success) setStats(r.data);
    } catch (e) {
      console.warn('临时保养统计加载失败:', e?.message);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { load(1, pagination.pageSize); }, [keyword, type]); // eslint-disable-line

  // 打开新增/编辑
  const openEdit = (row) => {
    setEditing(row || {});
    form.resetFields();
    if (row) {
      form.setFieldsValue({
        ...row,
        maintenance_date: row.maintenance_date ? dayjs(row.maintenance_date) : null,
        next_maintenance_date: row.next_maintenance_date ? dayjs(row.next_maintenance_date) : null,
      });
    } else {
      form.setFieldsValue({
        maintenance_date: dayjs(),
        result: '正常',
        status: '已完成',
      });
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        maintenance_date: values.maintenance_date?.format('YYYY-MM-DD HH:mm:ss'),
        next_maintenance_date: values.next_maintenance_date?.format('YYYY-MM-DD') || null,
      };
      if (editing?.id) {
        await maintenanceAPI.updateTemporaryRecord(editing.id, payload);
        message.success('已更新');
      } else {
        await maintenanceAPI.createTemporaryRecord(payload);
        message.success('已创建');
      }
      setEditing(null);
      load();
      loadStats();
    } catch (e) {
      if (e.errorFields) return; // 校验错误 antd 自己显示
      message.error(e.response?.data?.message || e.message || '保存失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await maintenanceAPI.deleteTemporaryRecord(id);
      message.success('已删除');
      load();
      loadStats();
    } catch (e) {
      message.error(e.response?.data?.message || '删除失败');
    }
  };

  // 资产联想: 输入资产编码/名称时建议 (但 API 走 assetAPI.getList 太重, 简化为手动输入)
  const columns = useMemo(() => [
    {
      title: '资产编码', dataIndex: 'asset_code', width: 140, fixed: 'left',
      render: v => <Tag color="geekblue">{v}</Tag>,
    },
    { title: '资产名称', dataIndex: 'asset_name', width: 200, ellipsis: true },
    { title: '科室', dataIndex: 'department', width: 140, ellipsis: true },
    {
      title: '保养类型', dataIndex: 'maintenance_type', width: 120,
      render: v => {
        const m = typeMeta(v);
        return <Tag color={m.color}>{m.icon} {v}</Tag>;
      },
    },
    {
      title: '保养人', dataIndex: 'maintenance_person', width: 100,
      render: v => v || '-',
    },
    {
      title: '保养日期', dataIndex: 'maintenance_date', width: 160,
      render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '耗时(分)', dataIndex: 'maintenance_duration', width: 90,
      align: 'right',
      render: v => v != null ? <Tag>{v}</Tag> : '-',
    },
    {
      title: '结果', dataIndex: 'result', width: 90,
      render: v => {
        const m = RESULT_LABEL[v] || { color: 'default' };
        return <Tag color={m.color} icon={m.icon}>{v || '-'}</Tag>;
      },
    },
    {
      title: '下次保养', dataIndex: 'next_maintenance_date', width: 130,
      render: v => {
        if (!v) return '-';
        const days = dayjs(v).diff(dayjs(), 'day');
        const color = days < 0 ? 'red' : days < 7 ? 'orange' : 'blue';
        return <Tag color={color}>{dayjs(v).format('YYYY-MM-DD')}</Tag>;
      },
    },
    { title: '备注', dataIndex: 'remark', width: 200, ellipsis: true },
    {
      title: '操作', width: 160, fixed: 'right',
      render: (_, r) => canWrite ? (
        <Space size={4}>
          <Tooltip title="详情">
            <Button size="small" type="link" icon={<EyeOutlined />} onClick={async () => {
              try {
                const res = await maintenanceAPI.getTemporaryRecord(r.id);
                setDetail(res.data || res);
              } catch (e) { message.error('加载详情失败'); }
            }}>详情</Button>
          </Tooltip>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ) : '-',
    },
  ], [canWrite]);

  // 统计卡片
  const renderStats = () => {
    if (statsLoading && !stats) {
      return <div style={{ textAlign: 'center', padding: 40 }}><Spin description="加载统计..." /></div>;
    }
    const total = stats?.total || 0;
    const abnormal = stats?.abnormal_count || 0;
    const byType = stats?.by_type || [];
    const abnormalRate = total > 0 ? Math.round((abnormal / total) * 100) : 0;

    return (
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic
              title="临时保养总数"
              value={total}
              prefix={<ToolOutlined />}
              styles={{ content: { color: '#1890ff' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic
              title="异常数"
              value={abnormal}
              prefix={<WarningOutlined />}
              styles={{ content: { color: abnormal > 0 ? '#ff4d4f' : '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic
              title="异常率"
              value={abnormalRate}
              suffix="%"
              prefix={<ExperimentOutlined />}
              styles={{ content: { color: abnormalRate > 10 ? '#ff4d4f' : abnormalRate > 5 ? '#faad14' : '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small" title="按类型分布" variant="borderless" styles={{ body: { padding: 12 } }}>
            {byType.length > 0 ? (
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                {byType.slice(0, 4).map(t => {
                  const m = typeMeta(t.maintenance_type);
                  const rate = total > 0 ? Math.round((t.count / total) * 100) : 0;
                  return (
                    <div key={t.maintenance_type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag color={m.color} style={{ minWidth: 70, textAlign: 'center', margin: 0 }}>
                        {m.icon} {t.maintenance_type}
                      </Tag>
                      <Progress
                        percent={rate}
                        size="small"
                        showInfo={false}
                        strokeColor={m.color === 'default' ? '#8c8c8c' : m.color}
                        style={{ flex: 1, margin: 0 }}
                      />
                      <span style={{ minWidth: 40, textAlign: 'right', fontSize: 12 }}>{t.count}</span>
                    </div>
                  );
                })}
              </Space>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
            )}
          </Card>
        </Col>
      </Row>
    );
  };

  return (
    <div style={{ padding: isMobile ? 8 : 16 }}>
      {renderStats()}

      <Card
        title={
          <Space>
            <ToolOutlined />
            <span>临时保养台账</span>
            <Tag color="blue">{pagination.total}</Tag>
          </Space>
        }
        variant="borderless"
        extra={
          <Space>
            <Select
              placeholder="保养类型" allowClear style={{ width: 140 }} value={type}
              onChange={setType}
              options={TEMP_TYPE_OPTIONS.map(t => ({ value: t.value, label: `${t.icon} ${t.value}` }))}
            />
            <Input
              placeholder="资产编码/名称/保养人" allowClear style={{ width: 220 }}
              prefix={<SearchOutlined />}
              onPressEnter={e => setKeyword(e.target.value)}
              onChange={e => e.target.value === '' && setKeyword('')}
            />
            <Button icon={<ReloadOutlined />} onClick={() => load()}>刷新</Button>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit({})}>
                新增临时保养
              </Button>
            )}
          </Space>
        }
      >
        <ResponsiveTable
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={columns}
          scroll={{ x: 1500 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page, pageSize) => load(page, pageSize),
            showSizeChanger: true,
            showTotal: t => `共 ${t} 条`,
          }}
        />
      </Card>

      {/* 新增/编辑 Modal */}
      <Modal
        title={editing?.id ? '编辑临时保养' : '新增临时保养'}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={handleSave}
        destroyOnHidden
        width={640}
        okText="保存"
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="asset_code" label="资产编码" rules={[{ required: true, message: '请填写资产编码' }]}>
                <Input placeholder="如 EQ-00001" prefix={<ToolOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="asset_name" label="资产名称" rules={[{ required: true, message: '请填写资产名称' }]}>
                <Input placeholder="如 心电图机" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="department" label="科室">
                <Input placeholder="如 心内科" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maintenance_type" label="保养类型" rules={[{ required: true, message: '请选择保养类型' }]}>
                <Select
                  placeholder="选择保养类型"
                  options={TEMP_TYPE_OPTIONS.map(t => ({ value: t.value, label: `${t.icon} ${t.value}` }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="maintenance_content" label="保养内容">
            <Input.TextArea rows={2} placeholder="详细描述本次保养操作 (如: 清洁滤网 + 紧固螺丝 + 校验精度)" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="maintenance_person" label="保养人">
                <Input placeholder="如 张工" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="maintenance_date" label="保养日期" rules={[{ required: true, message: '请选择保养日期' }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="maintenance_duration" label="耗时(分钟)">
                <InputNumber min={0} max={9999} style={{ width: '100%' }} placeholder="如 30" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="result" label="结果">
                <Select
                  options={Object.keys(RESULT_LABEL).map(k => ({ value: k, label: k }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="next_maintenance_date" label="下次保养">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态">
                <Select
                  options={Object.keys(STATUS_LABEL).map(k => ({ value: k, label: k }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="可选, 记录异常情况 / 配件更换 / 待跟进事项" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="临时保养详情"
        placement="right"
        size={isMobile ? 'default' : 'large'}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="资产编码">
              <Tag color="geekblue">{detail.asset_code}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="资产名称">{detail.asset_name}</Descriptions.Item>
            <Descriptions.Item label="科室">{detail.department || '-'}</Descriptions.Item>
            <Descriptions.Item label="保养类型">
              {(() => {
                const m = typeMeta(detail.maintenance_type);
                return <Tag color={m.color}>{m.icon} {detail.maintenance_type}</Tag>;
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="保养内容">
              {detail.maintenance_content || <span style={{ color: '#999' }}>-</span>}
            </Descriptions.Item>
            <Descriptions.Item label="保养人">{detail.maintenance_person || '-'}</Descriptions.Item>
            <Descriptions.Item label="保养日期">
              {detail.maintenance_date ? dayjs(detail.maintenance_date).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="耗时">
              {detail.maintenance_duration != null ? `${detail.maintenance_duration} 分钟` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="结果">
              {(() => {
                const m = RESULT_LABEL[detail.result] || { color: 'default' };
                return <Tag color={m.color} icon={m.icon}>{detail.result || '-'}</Tag>;
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="下次保养">
              {detail.next_maintenance_date ? dayjs(detail.next_maintenance_date).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {(() => {
                const m = STATUS_LABEL[detail.status] || { color: 'default' };
                return <Tag color={m.color}>{detail.status || '-'}</Tag>;
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="创建人">{detail.created_by || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {detail.created_at ? dayjs(detail.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="备注">
              {detail.remark || <span style={{ color: '#999' }}>-</span>}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty />
        )}
      </Drawer>
    </div>
  );
};

export default PreventiveMaintenanceTemporary;
