/**
 * 资产详情 - 维修维护记录
 *
 * 聚合当前资产的工单，分两类展示：
 *  - 维修记录：故障报修 / 维修申请 / 手动创建 / 其他（source_type 非 preventive/plan）
 *  - 预防性维护记录：预防性维护 / 维护计划（source_type = preventive | plan）
 *
 * 数据统一来自 work_orders（含 work_order_history 处理记录）。
 * 即「维修日志合并到工单」后的统一查看入口：在资产详情即可看到该资产的全部维修与维护轨迹。
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Tabs, Table, Tag, Drawer, Descriptions, Timeline, Empty, Spin,
  Button, Space, message, Divider,
} from 'antd';
import { ToolOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { maintenanceAPI } from '../../api/domains/maintenance';

const priorityMap = {
  1: { color: 'red', label: '紧急' },
  2: { color: 'orange', label: '高' },
  3: { color: 'blue', label: '中' },
  4: { color: 'default', label: '低' },
  urgent: { color: 'red', label: '紧急' },
  high: { color: 'orange', label: '高' },
  normal: { color: 'blue', label: '中' },
  low: { color: 'default', label: '低' },
};

const statusMap = {
  pending: { color: 'default', label: '待分配' },
  assigned: { color: 'blue', label: '已分配' },
  in_progress: { color: 'cyan', label: '进行中' },
  pending_acceptance: { color: 'gold', label: '已签字·待评价' },
  pending_review: { color: 'warning', label: '待审核' },
  completed: { color: 'green', label: '已完成' },
  closed: { color: 'default', label: '已评价·已关闭' },
  cancelled: { color: 'red', label: '已取消' },
};

const sourceTypeMap = {
  request: { color: 'blue', label: '维修申请' },
  plan: { color: 'green', label: '预防性维护' },
  preventive: { color: 'green', label: '预防性维护' },
  manual: { color: 'default', label: '手动创建' },
  fault: { color: 'red', label: '故障报修' },
  other: { color: 'default', label: '其他' },
};

const isPreventive = t => t === 'preventive' || t === 'plan';

const fmt = v => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-');

const AssetMaintenanceRecords = ({ assetId, asset }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [all, setAll] = useState([]);
  const [activeTab, setActiveTab] = useState('repair');

  const [detail, setDetail] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    if (!assetId) return;
    try {
      setLoading(true);
      const res = await maintenanceAPI.getMaintenanceWorkOrders({
        asset_code: assetId,
        pageSize: 200,
        page: 1,
      });
      if (res && res.success) {
        setAll(Array.isArray(res.data) ? res.data : []);
      } else {
        message.error((res && res.message) || '加载维修维护记录失败');
      }
    } catch (e) {
      console.error('加载资产维修维护记录失败:', e);
      message.error('加载维修维护记录失败');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => { load(); }, [load]);

  const repairRecords = all.filter(r => !isPreventive(r.source_type));
  const preventiveRecords = all.filter(r => isPreventive(r.source_type));

  const openDetail = async record => {
    setDetailVisible(true);
    setDetailLoading(true);
    setDetail(record);
    try {
      const res = await maintenanceAPI.getMaintenanceWorkOrder(record.id);
      if (res && res.success && res.data) {
        setDetail(res.data);
      }
    } catch (e) {
      // 保留基础记录，不阻断查看
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    {
      title: '工单编号',
      dataIndex: 'work_order_no',
      key: 'work_order_no',
      width: 150,
      render: (text, r) => <a onClick={() => openDetail(r)}>{text}</a>,
    },
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: '来源',
      key: 'source',
      width: 110,
      render: (_, r) => {
        const m = sourceTypeMap[r.source_type] || { color: 'default', label: r.source_type || '-' };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: p => {
        const m = priorityMap[p] || { color: 'default', label: p };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: s => {
        const m = statusMap[s] || { color: 'default', label: s };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    { title: '负责人', dataIndex: 'assigned_to', key: 'assigned_to', width: 100, render: v => v || '-' },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      key: 'completed_at',
      width: 130,
      render: v => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, r) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)}>
          查看
        </Button>
      ),
    },
  ];

  const renderTable = records => (
    <Table
      rowKey="id"
      size="small"
      loading={loading}
      dataSource={records}
      columns={columns}
      pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }}
      locale={{ emptyText: <Empty description="暂无记录" /> }}
    />
  );

  return (
    <Card
      title={
        <Space>
          <ToolOutlined />
          <span>维修维护记录</span>
        </Space>
      }
      extra={
        <Button size="small" onClick={() => navigate('/maintenance/workorders')}>
          查看全部工单
        </Button>
      }
      style={{ marginTop: 16 }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'repair',
            label: `维修记录 (${repairRecords.length})`,
            children: renderTable(repairRecords),
          },
          {
            key: 'preventive',
            label: `预防性维护记录 (${preventiveRecords.length})`,
            children: renderTable(preventiveRecords),
          },
        ]}
      />

      <Drawer
        title="维修维护详情"
        width={580}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        destroyOnClose
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin />
          </div>
        ) : detail ? (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="工单编号">{detail.work_order_no}</Descriptions.Item>
              <Descriptions.Item label="标题">{detail.title}</Descriptions.Item>
              <Descriptions.Item label="关联资产">
                {detail.asset_code}
                {detail.asset_name ? `（${detail.asset_name}）` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="来源">
                <Tag color={(sourceTypeMap[detail.source_type] || {}).color}>
                  {(sourceTypeMap[detail.source_type] || {}).label || detail.source_type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={(priorityMap[detail.priority] || {}).color}>
                  {(priorityMap[detail.priority] || {}).label || detail.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={(statusMap[detail.status] || {}).color}>
                  {(statusMap[detail.status] || {}).label || detail.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="负责人">{detail.assigned_to || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建人">{detail.created_by || '-'}</Descriptions.Item>
              <Descriptions.Item label="计划开始">
                {detail.planned_start ? fmt(detail.planned_start) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {detail.completed_at ? fmt(detail.completed_at) : '-'}
              </Descriptions.Item>
              {detail.fault_cause ? (
                <Descriptions.Item label="故障原因">{detail.fault_cause}</Descriptions.Item>
              ) : null}
              {detail.solution ? (
                <Descriptions.Item label="解决方案">{detail.solution}</Descriptions.Item>
              ) : null}
              {detail.acceptance_result ? (
                <Descriptions.Item label="验收结果">{detail.acceptance_result}</Descriptions.Item>
              ) : null}
              {detail.satisfaction_score != null ? (
                <Descriptions.Item label="满意度">{detail.satisfaction_score}</Descriptions.Item>
              ) : null}
            </Descriptions>

            {Array.isArray(detail.history) && detail.history.length > 0 && (
              <>
                <Divider>处理记录</Divider>
                <Timeline
                  items={detail.history.map(h => ({
                    children: (
                      <div>
                        <div>
                          <Tag>{h.action_type}</Tag> {h.action_description}
                        </div>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                          {h.action_by} · {fmt(h.action_at)}
                        </div>
                      </div>
                    ),
                  }))}
                />
              </>
            )}
          </>
        ) : null}
      </Drawer>
    </Card>
  );
};

export default AssetMaintenanceRecords;
